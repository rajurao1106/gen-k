import logging
import os
import tempfile
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

import torch
import torchaudio
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

MAX_REFERENCE_BYTES = 16 * 1024 * 1024
MAX_TEXT_LENGTH = 1200
ALLOWED_EXTENSIONS = {".wav", ".mp3", ".flac", ".ogg", ".oga"}
SUPPORTED_LANGUAGES = {"en", "hi"}
logger = logging.getLogger("chatterbox-service")
generation_lock = threading.Lock()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info("Loading Chatterbox Multilingual V3 on %s", device)
    app.state.model = ChatterboxMultilingualTTS.from_pretrained(
        device=device,
        t3_model="v3",
    )
    yield


app = FastAPI(title="Local Chatterbox voice service", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ready"}


@app.post("/api/tts")
def synthesize(
    text: str = Form(...),
    language: str = Form(...),
    reference_audio: UploadFile = File(...),
) -> FileResponse:
    clean_text = text.strip()
    extension = Path(reference_audio.filename or "").suffix.lower()
    if not clean_text or len(clean_text) > MAX_TEXT_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Text must contain between 1 and {MAX_TEXT_LENGTH} characters.",
        )
    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail="Choose Hindi or English.")
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Use a WAV, MP3, FLAC, or OGG voice sample.",
        )

    reference_path = ""
    output_path = ""
    try:
        reference_bytes = reference_audio.file.read(MAX_REFERENCE_BYTES + 1)
        if not reference_bytes or len(reference_bytes) > MAX_REFERENCE_BYTES:
            raise HTTPException(
                status_code=413,
                detail="The voice sample must be 16 MB or smaller.",
            )

        with tempfile.NamedTemporaryFile(
            suffix=extension,
            delete=False,
        ) as reference_file:
            reference_file.write(reference_bytes)
            reference_path = reference_file.name

        with tempfile.NamedTemporaryFile(
            suffix=".wav",
            delete=False,
        ) as output_file:
            output_path = output_file.name

        model = app.state.model
        with generation_lock, torch.inference_mode():
            audio = model.generate(
                clean_text,
                language_id=language,
                audio_prompt_path=reference_path,
            )
        torchaudio.save(output_path, audio.detach().cpu(), model.sr)
        return FileResponse(
            output_path,
            media_type="audio/wav",
            filename="ai-friend-reply.wav",
            background=BackgroundTask(os.unlink, output_path),
        )
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Local Chatterbox speech generation failed: %s", error)
        if output_path and os.path.exists(output_path):
            os.unlink(output_path)
        raise HTTPException(
            status_code=500,
            detail="Chatterbox could not generate speech from this sample.",
        ) from error
    finally:
        if reference_path and os.path.exists(reference_path):
            os.unlink(reference_path)


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)
