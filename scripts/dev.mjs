import { homedir, platform } from "node:os";
import { join } from "node:path";
if (process.env.WOMPI_ENVIRONMENT === "prod")
  throw new Error("La vista de desarrollo no admite Wompi producción.");
process.env.PORT ??= "3201";
process.env.PUBLIC_URL ??= `http://localhost:${process.env.PORT}`;
const folder =
  platform() === "darwin"
    ? join(homedir(), "Library", "Application Support", "SharkPass")
    : join(homedir(), ".local", "share", "SharkPass");
process.env.DATABASE_PATH ??= join(folder, "development.sqlite");
const { createApp } = await import("../src/server.mjs");
const { server } = createApp();
server.listen(Number(process.env.PORT), "127.0.0.1", () =>
  console.log(
    `SharkPass local: ${process.env.PUBLIC_URL}. Development data is persistent and separate from the office pilot.`,
  ),
);
