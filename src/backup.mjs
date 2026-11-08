import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
export function backupDatabase(path) {
process.umask(0o077);
const folder = join(dirname(path), "backups");
mkdirSync(folder, { recursive: true, mode: 0o700 });
const destination = join(
  folder,
  `sharkpass-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`,
);
const db = new DatabaseSync(path);
db.exec("PRAGMA busy_timeout=5000");
db.prepare("VACUUM INTO ?").run(destination);
chmodSync(destination, 0o600);
const restored = new DatabaseSync(destination, { readOnly: true });
if (restored.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
  throw new Error("Backup integrity verification failed");
if (restored.prepare("PRAGMA foreign_key_check").all().length)
  throw new Error("Backup foreign keys are inconsistent");
restored.close();
db.close();
return destination;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  backupDatabase(process.env.DATABASE_PATH ?? "data/sharkpass.sqlite");
  console.log("SharkPass backup and isolated integrity verification passed.");
}
