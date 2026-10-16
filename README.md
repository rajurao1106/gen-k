# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## AI Friend chat and local voice replies

AI Friend chat uses the configured Gemini API key. Voice samples are saved
per Kundli profile in the browser's IndexedDB. Spoken replies use the local
Chatterbox Multilingual V3 service; the service listens only on `127.0.0.1`,
and the selected profile's reference sample is sent to that local process for
each generated reply. The model weights are downloaded on first startup.

Chatterbox supports Hindi and English voice cloning. See the
[Chatterbox project](https://github.com/resemble-ai/chatterbox) and its
[MIT license](https://github.com/resemble-ai/chatterbox/blob/main/LICENSE).
Browser microphone transcription uses the browser's Speech Recognition API;
the browser may use its own online speech service.

On Windows, use Python 3.13 and start the voice service in a separate terminal:

```powershell
py -3.13 -m venv .venv-chatterbox
.\.venv-chatterbox\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements-chatterbox.txt
python server\chatterbox_service.py
```

Leave that terminal running, then start the web app with `npm run dev`. The
voice model can require substantial disk space and compute; the service uses a
CUDA GPU when PyTorch detects one, otherwise it runs on CPU and may be slow.
The Chat itself can still return text when the local voice service is stopped.
