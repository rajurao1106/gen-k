import "dotenv/config";
import app, { initializeServer } from "./app.js";

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.info(`Server running on port ${PORT}`);
});
initializeServer().catch((error) => {
  console.error("[server] MongoDB startup connection failed; health endpoint will report unavailable.", {
    name: error?.name ?? "Error",
    code: error?.code ?? "UNKNOWN",
  });
});
