// Run only on the private server against its explicitly configured database.
import { Store } from "../src/store.mjs";
if (!process.env.DATABASE_PATH) throw new Error("Define DATABASE_PATH explícitamente; no se usará una base predeterminada.");
const [action, username, operator, reason] = process.argv.slice(2);
if (!["grant","revoke"].includes(action) || !username || !operator || !reason)
  throw new Error('Uso: node --experimental-sqlite scripts/platform-admin.mjs grant|revoke usuario operador "motivo de al menos 12 caracteres"');
const store = new Store(process.env.DATABASE_PATH);
try {
  const user = store.get("SELECT id FROM users WHERE username=?", username);
  if (!user) throw new Error("La cuenta debe registrarse primero. No se crean cuentas ni contraseñas desde este comando.");
  const result = action === "grant" ? store.provisionPlatformAdmin(user.id,operator,reason) : store.revokePlatformAdmin(user.id,operator,reason);
  console.log(JSON.stringify(result));
} finally { store.close(); }
