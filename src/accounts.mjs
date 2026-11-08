import { randomBytes, createHash } from "node:crypto";
import { AppError } from "./store.mjs";
const hash = (v) => createHash("sha256").update(v).digest("hex");
const validEmail = (v) =>
  typeof v === "string" &&
  v.length <= 254 &&
  /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v);
export class Accounts {
  constructor(store, mailer, { clock = Date.now } = {}) {
    this.store = store;
    this.mailer = mailer;
    this.clock = clock;
  }
  profile(user) {
    this.store.requireUser(user);
    return (
      this.store.get(
        "SELECT email,verified_at FROM account_emails WHERE user_id=?",
        user.id,
      ) ?? null
    );
  }
  pending(user) {
    this.store.requireUser(user);
    return this.store.get("SELECT email,expires_at FROM account_tokens WHERE user_id=? AND purpose='verify' AND expires_at>? LIMIT 1",user.id,this.clock()) ?? null;
  }
  async request(user, input, purpose) {
    if (!this.mailer.configured)
      throw new AppError(
        503,
        "Configura el servicio de correo para verificar cuentas y recuperar el acceso.",
      );
    if (!validEmail(input.email)) throw new AppError(400, "Correo inválido.");
    const email = input.email.trim().toLowerCase();
    if (purpose === "verify") this.store.requireUser(user);
    else
      user = this.store.get(
        "SELECT u.id FROM users u JOIN account_emails e ON e.user_id=u.id WHERE e.email=?",
        email,
      );
    const generic = {
      ok: true,
      message:
        "Si corresponde a tu cuenta, recibirás un enlace temporal por correo.",
    };
    if (!user) return generic;
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hash(token);
    this.store.transaction(() => {
      this.store.run(
        "DELETE FROM account_tokens WHERE expires_at<=?",
        this.clock(),
      );
      this.store.run(
        "DELETE FROM account_tokens WHERE user_id=? AND purpose=?",
        user.id,
        purpose,
      );
      this.store.run(
        "INSERT INTO account_tokens VALUES(?,?,?,?,?)",
        tokenHash,
        user.id,
        purpose,
        email,
        this.clock() + 15 * 60 * 1000,
      );
    });
    try {
      await this.mailer.accountMessage(email, purpose, token, tokenHash);
    } catch {
      this.store.run(
        "DELETE FROM account_tokens WHERE token_hash=?",
        tokenHash,
      );
      if (purpose === "verify")
        throw new AppError(
          503,
          "No se pudo enviar la verificación. Intenta nuevamente.",
        );
    }
    return generic;
  }
  complete(input, purpose) {
    if (
      typeof input.token !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(input.token)
    )
      throw new AppError(400, "Enlace inválido o vencido.");
    return this.store.transaction(() => {
      const row = this.store.get(
        "SELECT * FROM account_tokens WHERE token_hash=? AND purpose=? AND expires_at>?",
        hash(input.token),
        purpose,
        this.clock(),
      );
      if (!row) throw new AppError(400, "Enlace inválido o vencido.");
      if (purpose === "verify") {
        const used = this.store.get(
          "SELECT user_id FROM account_emails WHERE email=? AND user_id<>?",
          row.email,
          row.user_id,
        );
        const reserved = this.store.get("SELECT user_id FROM login_emails WHERE email=? AND user_id<>?", row.email, row.user_id);
        if (used || reserved)
          throw new AppError(
            409,
            "No se pudo asociar ese correo. Contacta soporte.",
          );
        this.store.run(
          "INSERT INTO account_emails VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,verified_at=excluded.verified_at",
          row.user_id,
          row.email,
          this.clock(),
        );
        this.store.run("INSERT INTO login_emails VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email", row.user_id, row.email);
        // Any old reset link is invalid after changing the verified address.
        this.store.run(
          "DELETE FROM account_tokens WHERE user_id=?",
          row.user_id,
        );
      } else {
        const verified = this.store.get(
          "SELECT email FROM account_emails WHERE user_id=?",
          row.user_id,
        );
        if (verified?.email !== row.email)
          throw new AppError(400, "Enlace inválido o vencido.");
        this.store.resetPassword(row.user_id, input.password);
        this.store.run(
          "DELETE FROM account_tokens WHERE user_id=?",
          row.user_id,
        );
      }
      return { ok: true };
    });
  }
}
