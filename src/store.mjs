import {typePricing,orderPricing} from "./pricing.mjs";
import {saleRules,checkoutRegistration,attendeeName} from "./registration.mjs";
import {publicSeatMap,selectedSeats,assignSeat,normalizeSeatIds} from "./seating.mjs";
import { DatabaseSync } from "node:sqlite";
import {
  randomUUID,
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new AppError(status, message);
};
const hash = (v) => createHash("sha256").update(v).digest("hex");
const now = () => new Date().toISOString();
function text(value, min, max, label) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    fail(400, `${label}: revisa el valor.`);
  return value.trim();
}
function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    fail(400, `${label}: valor fuera de rango.`);
  return value;
}
function passwordHash(value) {
  if (typeof value !== "string" || value.length < 10 || value.length > 256)
    fail(400, "Usa una contraseña de 10 a 256 caracteres.");
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(value, salt, 64).toString("hex")}`;
}
function passwordMatches(value, stored) {
  if (typeof value !== "string" || value.length > 256) return false;
  const [salt, key] = stored.split(":");
  return timingSafeEqual(scryptSync(value, salt, 64), Buffer.from(key, "hex"));
}
function profileDetails(input) {
  const fullName = text(input.fullName, 2, 120, "Nombre");
  if (
    typeof input.phone !== "string" ||
    !/^[+0-9 ()-]{10,24}$/.test(input.phone)
  )
    fail(400, "Teléfono inválido.");
  const phone = input.phone.replace(/[ ()-]/g, "");
  if (!/^\+?[0-9]{10,15}$/.test(phone)) fail(400, "Teléfono inválido.");
  return { fullName, phone };
}
export class Store {
  constructor(path = ":memory:") {
    if (path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
    );
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY,checksum TEXT NOT NULL)",
    );
    const folder = fileURLToPath(new URL("../migrations/", import.meta.url));
    for (const name of readdirSync(folder)
      .filter((v) => v.endsWith(".sql"))
      .sort()) {
      const source = readFileSync(`${folder}/${name}`, "utf8"), checksum = hash(source);
      this.transaction(() => {
        const old = this.get("SELECT checksum FROM schema_migrations WHERE name=?", name);
        if (old && old.checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
        if (!old) {
          this.db.exec(source);
          this.run("INSERT INTO schema_migrations VALUES(?,?)", name, checksum);
        }
      });
    }
  }
  get(sql, ...args) {
    return this.db.prepare(sql).get(...args);
  }
  all(sql, ...args) {
    return this.db.prepare(sql).all(...args);
  }
  run(sql, ...args) {
    return this.db.prepare(sql).run(...args);
  }
  transaction(action) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = action();
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  close() {
    this.db.close();
  }
  emailAddress(value) {
    const email = text(value, 3, 254, "Correo").toLowerCase();
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) fail(400, "Correo inválido.");
    return email;
  }
  register(input) {
    const email = input.email !== undefined ? this.emailAddress(input.email) : null;
    const username = email ? `u-${randomUUID()}` : text(input.username, 3, 40, "Usuario");
    if (!/^[a-zA-Z0-9_.-]+$/.test(username))
      fail(
        400,
        "El usuario admite letras, números, punto, guion y guion bajo.",
      );
    const profile =
      input.fullName !== undefined || input.phone !== undefined
        ? profileDetails(input)
        : null;
    const password = passwordHash(input.password),
      id = randomUUID();
    return this.transaction(() => {
      if (email && this.get("SELECT user_id FROM login_emails WHERE email=?", email)) fail(409, "Ya existe una cuenta con ese correo. Inicia sesión o recupera tu acceso.");
      if (this.get("SELECT id FROM users WHERE username=?", username))
        fail(409, "Ese usuario ya existe.");
      this.run(
        "INSERT INTO users VALUES(?,?,?,?)",
        id,
        username,
        password,
        now(),
      );
      if (profile)
        this.run(
          "INSERT INTO customer_profiles VALUES(?,?,?)",
          id,
          profile.fullName,
          profile.phone,
        );
      if (email) this.run("INSERT INTO login_emails VALUES(?,?)", id, email);
      return { id, username, ...(email ? {email} : {}) };
    });
  }
  customerProfile(user) {
    this.requireUser(user);
    const row = this.get(
      "SELECT full_name,phone FROM customer_profiles WHERE user_id=?",
      user.id,
    );
    return row
      ? { fullName: row.full_name, phone: row.phone }
      : { fullName: "", phone: "" };
  }
  updateCustomerProfile(user, input) {
    this.requireUser(user);
    if (Object.keys(input).some((key) => !["fullName", "phone"].includes(key)))
      fail(400, "Solo puedes actualizar tu nombre y teléfono.");
    const profile = profileDetails(input);
    this.run(
      "INSERT INTO customer_profiles(user_id,full_name,phone) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET full_name=excluded.full_name,phone=excluded.phone",
      user.id,
      profile.fullName,
      profile.phone,
    );
    return profile;
  }
  resetPassword(userId, value) {
    const encoded = passwordHash(value);
    this.run("UPDATE users SET password_hash=? WHERE id=?", encoded, userId);
    this.run("DELETE FROM sessions WHERE user_id=?", userId);
  }
  login(input) {
    const user = input.email !== undefined
      ? this.get("SELECT u.* FROM users u JOIN login_emails e ON e.user_id=u.id WHERE e.email=?", this.emailAddress(input.email))
      : this.get("SELECT * FROM users WHERE username=?", text(input.username, 3, 40, "Usuario"));
    const dummy =
      "0".repeat(32) +
      ":" +
      scryptSync("not-a-real-password", "0".repeat(32), 64).toString("hex");
    const valid = passwordMatches(input.password, user?.password_hash ?? dummy);
    if (!user || !valid) fail(401, "Correo o contraseña incorrectos.");
    const token = randomBytes(32).toString("base64url");
    this.run("DELETE FROM sessions WHERE expires_at<?", Date.now());
    this.run(
      "INSERT INTO sessions VALUES(?,?,?)",
      hash(token),
      user.id,
      Date.now() + 12 * 60 * 60 * 1000,
    );
    return { token, user: { id: user.id, username: user.username } };
  }
  session(token) {
    if (!token) return null;
    return (
      this.get(
        "SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
        hash(token),
        Date.now(),
      ) ?? null
    );
  }
  logout(token) {
    if (token) this.run("DELETE FROM sessions WHERE token_hash=?", hash(token));
  }
  isPlatformAdmin(user) {
    return Boolean(user && this.get("SELECT user_id FROM platform_admins WHERE user_id=?", user.id));
  }
  requirePlatformAdmin(user) {
    this.requireUser(user);
    if (!this.isPlatformAdmin(user)) fail(403, "Acceso exclusivo de administración de SharkPass.");
    return user;
  }
  confirmPlatformAction(user, input) {
    this.requirePlatformAdmin(user);
    const row = this.get("SELECT password_hash FROM users WHERE id=?", user.id);
    if (!row || !passwordMatches(input.password, row.password_hash)) fail(401, "Confirma tu contraseña actual.");
    return text(input.reason, 12, 500, "Motivo de la acción");
  }
  platformAudit(actor, operator, action, targetId, reason) {
    this.run("INSERT INTO platform_admin_audit VALUES(?,?,?,?,?,?,?)", randomUUID(), actor?.id ?? null, operator, action, targetId, reason, now());
  }
  // Private operational entry: no HTTP route accepts a role or calls this method.
  provisionPlatformAdmin(userId, operator, reason) {
    if (!this.get("SELECT id FROM users WHERE id=?", userId)) fail(404, "La cuenta debe existir antes de asignar permisos.");
    operator = text(operator, 3, 100, "Operador");
    reason = text(reason, 12, 500, "Motivo");
    return this.transaction(() => {
      if (this.get("SELECT user_id FROM platform_admins WHERE user_id=?", userId)) return { changed: false };
      this.run("INSERT INTO platform_admins VALUES(?,?,?)", userId, now(), operator);
      this.run("DELETE FROM sessions WHERE user_id=?", userId);
      this.platformAudit(null, operator, "admin_granted", userId, reason);
      return { changed: true };
    });
  }
  initializePlatformAdmin(userId) {
    return this.transaction(() => {
      if (this.get("SELECT singleton FROM platform_admin_setup WHERE singleton=1")) return { changed: false };
      if (this.get("SELECT user_id FROM platform_admins LIMIT 1")) fail(409, "La administración ya fue configurada.");
      if (!this.get("SELECT id FROM users WHERE id=?", userId)) fail(404, "La cuenta inicial indicada no existe.");
      this.run("INSERT INTO platform_admins VALUES(?,?,?)", userId, now(), "private-startup");
      this.run("INSERT INTO platform_admin_setup VALUES(1,?,?)", userId, now());
      this.run("DELETE FROM sessions WHERE user_id=?", userId);
      this.platformAudit(null, "private-startup", "initial_admin_granted", userId, "Activación inicial por UUID configurado en el alojamiento privado.");
      return { changed: true };
    });
  }
  revokePlatformAdmin(userId, operator, reason) {
    operator = text(operator, 3, 100, "Operador"); reason = text(reason, 12, 500, "Motivo");
    return this.transaction(() => {
      if (!this.get("SELECT user_id FROM platform_admins WHERE user_id=?", userId)) fail(404, "Administrador no encontrado.");
      if (this.get("SELECT COUNT(*) AS n FROM platform_admins").n <= 1) fail(409, "No se puede retirar al último superadministrador.");
      this.run("DELETE FROM platform_admins WHERE user_id=?", userId);
      this.run("DELETE FROM sessions WHERE user_id=?", userId);
      this.platformAudit(null, operator, "admin_revoked", userId, reason);
      return { changed: true };
    });
  }
  platformOverview(user) {
    this.requirePlatformAdmin(user);
    return {
      users: this.get("SELECT COUNT(*) AS n FROM users").n,
      organizers: this.get("SELECT COUNT(*) AS n FROM organizations").n,
      events: this.get("SELECT COUNT(*) AS n FROM events").n,
      published: this.get("SELECT COUNT(*) AS n FROM events WHERE state='published'").n,
      confirmedOrders: this.get("SELECT COUNT(*) AS n FROM orders WHERE state='confirmed'").n,
      grossConfirmedCop: this.get("SELECT COALESCE(SUM(total_cop),0) AS n FROM orders WHERE state='confirmed'").n,
    };
  }
  platformOrganizations(user) {
    this.requirePlatformAdmin(user);
    return this.all("SELECT o.id,o.name,u.username AS owner,(SELECT COUNT(*) FROM events e WHERE e.organization_id=o.id) AS events FROM organizations o JOIN users u ON u.id=o.owner_id ORDER BY o.name LIMIT 200");
  }
  platformEvents(user) {
    this.requirePlatformAdmin(user);
    return this.all("SELECT e.id,e.title,e.starts_at,e.state,e.is_demo,o.name AS organizer,(SELECT COUNT(*) FROM orders x WHERE x.event_id=e.id AND x.state='confirmed') AS confirmedOrders FROM events e JOIN organizations o ON o.id=e.organization_id ORDER BY e.starts_at DESC LIMIT 200");
  }
  platformUsers(user) {
    this.requirePlatformAdmin(user);
    return this.all("SELECT u.id,u.username,u.created_at,EXISTS(SELECT 1 FROM platform_admins a WHERE a.user_id=u.id) AS platformAdmin,(SELECT COUNT(*) FROM sessions s WHERE s.user_id=u.id AND s.expires_at>?) AS activeSessions FROM users u ORDER BY u.created_at DESC LIMIT 200",Date.now());
  }
  platformOrders(user) {
    this.requirePlatformAdmin(user);
    return this.all("SELECT x.id,x.state,x.quantity,x.total_cop,x.created_at,e.title AS event,u.username AS buyer FROM orders x JOIN events e ON e.id=x.event_id JOIN users u ON u.id=x.user_id ORDER BY x.created_at DESC LIMIT 200");
  }
  platformAuditLog(user) {
    this.requirePlatformAdmin(user);
    return this.all("SELECT a.id,u.username AS actor,a.operator,a.action,a.target_id,a.reason,a.created_at FROM platform_admin_audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC,a.rowid DESC LIMIT 200");
  }
  platformRevokeSessions(user, userId, input) {
    const reason = this.confirmPlatformAction(user, input);
    if (userId === user.id) fail(400, "Usa Cerrar sesión para salir de tu propia cuenta.");
    if (!this.get("SELECT id FROM users WHERE id=?", userId)) fail(404, "Cuenta no encontrada.");
    return this.transaction(() => {
      this.run("DELETE FROM sessions WHERE user_id=?", userId);
      this.platformAudit(user, "web", "sessions_revoked", userId, reason);
      return { ok: true };
    });
  }
  platformSetEventState(user, eventId, input) {
    const reason = this.confirmPlatformAction(user, input);
    const event = this.get("SELECT * FROM events WHERE id=?",eventId);
    if (!event) fail(404, "Evento no encontrado.");
    event.types = this.all("SELECT id FROM ticket_types WHERE event_id=?",eventId);
    return this._transitionEventState(user,event,input.state,reason);
  }
  requireUser(user) {
    if (!user) fail(401, "Inicia sesión para continuar.");
    return user;
  }
  org(user, id, owner = false) {
    this.requireUser(user);
    const row = this.get(
      "SELECT o.*,m.role FROM organizations o JOIN members m ON m.organization_id=o.id WHERE o.id=? AND m.user_id=?",
      id,
      user.id,
    );
    if (!row || (owner && row.role !== "owner"))
      fail(403, "No tienes acceso a este organizador.");
    return row;
  }
  organizations(user) {
    this.requireUser(user);
    return this.all(
      "SELECT o.id,o.name,m.role FROM organizations o JOIN members m ON m.organization_id=o.id WHERE m.user_id=?",
      user.id,
    );
  }
  createOrganization(user, input) {
    this.requireUser(user);
    const name = text(input.name, 2, 100, "Organizador"),
      id = randomUUID();
    return this.transaction(() => {
      this.run("INSERT INTO organizations VALUES(?,?,?)", id, name, user.id);
      this.run("INSERT INTO members VALUES(?,?,?)", id, user.id, "owner");
      return { id, name, role: "owner" };
    });
  }
  addScanner(user, orgId, input) {
    this.org(user, orgId, true);
    const member = input.email !== undefined
      ? this.get("SELECT user_id AS id FROM login_emails WHERE email=?", this.emailAddress(input.email))
      : this.get("SELECT id FROM users WHERE username=?", text(input.username, 3, 40, "Usuario"));
    if (!member) fail(404, "El usuario debe crear su cuenta primero.");
    if (
      this.get(
        "SELECT role FROM members WHERE organization_id=? AND user_id=?",
        orgId,
        member.id,
      )
    )
      fail(409, "Ese usuario ya pertenece al equipo.");
    this.run("INSERT INTO members VALUES(?,?,?)", orgId, member.id, "scanner");
    return { added: true };
  }
  createEvent(user, input) {
    return this.transaction(() => this._createEvent(user, input));
  }
  // Internal variant for private atomic content preparation; not an HTTP operation.
  _createEvent(user, input, id = randomUUID()) {
    this.org(user, input.organizationId, true);
    const title = text(input.title, 3, 160, "Evento"),
      description = text(input.description, 10, 5000, "Descripción"),
      venue = text(input.venue, 3, 200, "Lugar");
    const starts = text(input.startsAt, 20, 40, "Fecha");
    const image = input.image ? text(input.image, 8, 180, "Imagen") : null;
    const category = input.category ? text(input.category, 2, 60, "Categoría") : "Eventos";
    if (image && !/^\/media\/[a-zA-Z0-9][a-zA-Z0-9_-]*\.(?:png|jpe?g|webp)$/.test(image))
      fail(400, "Selecciona una imagen local válida del catálogo.");
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/.test(starts) ||
      !Number.isFinite(Date.parse(starts)) ||
      Date.parse(starts) <= Date.now()
    )
      fail(400, "El evento necesita una fecha futura con zona horaria.");
    this.run(
      "INSERT INTO events VALUES(?,?,?,?,?,?,?,?)",
      id,
      input.organizationId,
      title,
      description,
      venue,
      new Date(starts).toISOString(),
      "draft",
      input.isDemo === true ? 1 : 0,
    );
    this.run("INSERT INTO event_presentation VALUES(?,?,?)", id, image, category);
    return { id };
  }
  event(user, id, manage = false) {
    const event = this.get(
      "SELECT e.*,o.name AS organizer,p.image,p.category FROM events e JOIN organizations o ON o.id=e.organization_id LEFT JOIN event_presentation p ON p.event_id=e.id WHERE e.id=?",
      id,
    );
    if (!event) fail(404, "Evento no disponible.");
    if (manage) this.org(user, event.organization_id);
    else if (event.state !== "published") fail(404, "Evento no disponible.");
    return {
      ...event,
      types: this.eventTypes(id,manage),
      seats:publicSeatMap(this,id),
      saleRules:saleRules(this,id),
    };
  }
  eventTypes(id,includeInternal=false) {
    return this.all("SELECT t.*,MAX(0,t.capacity-(SELECT COUNT(*) FROM seat_blocks b JOIN event_seats s ON s.id=b.seat_id WHERE s.type_id=t.id)-COALESCE((SELECT SUM(quantity) FROM orders WHERE type_id=t.id AND state='confirmed'),0)-COALESCE((SELECT SUM(quantity) FROM payment_attempts WHERE type_id=t.id AND state='pending' AND expires_at>?),0)) AS available FROM ticket_types t LEFT JOIN ticket_type_visibility v ON v.type_id=t.id WHERE t.event_id=? AND (? OR COALESCE(v.visibility,'public')='public')",Date.now(),id,includeInternal?1:0).map(type=>({...type,pricing:typePricing(this,type)}));
  }
  events() {
    return this.all(
      "SELECT e.*,o.name AS organizer,p.image,p.category FROM events e JOIN organizations o ON o.id=e.organization_id LEFT JOIN event_presentation p ON p.event_id=e.id WHERE e.state='published' AND e.starts_at>? ORDER BY e.starts_at LIMIT 100",
      now(),
    ).map(event=>{
      const available=this.eventTypes(event.id).filter(type=>type.available>0);
      return {...event,min_pricing:available.length?available.reduce((a,b)=>a.price_cop<=b.price_cop?a:b).pricing:null,min_price_cop:available.length?Math.min(...available.map(type=>type.price_cop)):null,has_available_tickets:available.length>0};
    });
  }
  managedEvents(user) {
    this.requireUser(user);
    return this.all(
      "SELECT e.*,m.role FROM events e JOIN members m ON m.organization_id=e.organization_id WHERE m.user_id=? ORDER BY starts_at DESC LIMIT 200",
      user.id,
    );
  }
  addType(user, eventId, input) {
    const event = this.event(user, eventId, true);
    this.org(user, event.organization_id, true);
    if (event.state === "cancelled") fail(409, "Evento cancelado.");
    const id = randomUUID(),
      name = text(input.name, 2, 80, "Tipo"),
      price = integer(input.priceCop, 0, 100000000, "Precio COP"),
      capacity = integer(input.capacity, 1, 100000, "Cupo");
    if (
      this.get(
        "SELECT id FROM ticket_types WHERE event_id=? AND name=?",
        eventId,
        name,
      )
    )
      fail(409, "Ya existe ese tipo de entrada.");
    this.run(
      "INSERT INTO ticket_types VALUES(?,?,?,?,?)",
      id,
      eventId,
      name,
      price,
      capacity,
    );
    return { id };
  }
  setEventState(user, eventId, state) {
    const event = this.event(user, eventId, true);
    this.org(user, event.organization_id, true);
    return this._transitionEventState(user, event, state);
  }
  _transitionEventState(user, event, state, adminReason = null) {
    if (adminReason !== null) this.requirePlatformAdmin(user);
    else this.org(user, event.organization_id, true);
    const eventId = event.id;
    if (!["draft", "published", "cancelled"].includes(state))
      fail(400, "Estado inválido.");
    if (event.state === "cancelled" && state !== "cancelled")
      fail(409, "La cancelación es definitiva.");
    if (
      state === "published" &&
      (!event.types.length || Date.parse(event.starts_at) <= Date.now())
    )
      fail(400, "Añade tipos de entrada y una fecha futura antes de publicar.");
    if (
      state === "draft" &&
      this.get(
        "SELECT id FROM orders WHERE event_id=? AND state='confirmed'",
        eventId,
      )
    )
      fail(
        409,
        "Un evento con entradas emitidas debe cancelarse, no ocultarse.",
      );
    return this.transaction(() => {
      this.run("UPDATE events SET state=? WHERE id=?", state, eventId);
      if (state === "cancelled") {
        this.run(
          "UPDATE tickets SET status='void' WHERE order_id IN (SELECT id FROM orders WHERE event_id=?)",
          eventId,
        );
        this.run(
          "UPDATE orders SET state='cancelled' WHERE event_id=?",
          eventId,
        );
      }
      this.audit(user, "event_" + state, eventId);
      if (adminReason !== null) this.platformAudit(user, "web", "event_" + state, eventId, adminReason);
      return { state };
    });
  }
  audit(user, action, eventId) {
    this.run(
      "INSERT INTO audit VALUES(?,?,?,?,?)",
      randomUUID(),
      user.id,
      action,
      eventId,
      now(),
    );
  }
  order(user, input, key) {
    const email=input.email !== undefined ? this.emailAddress(input.email) : this.get("SELECT email FROM login_emails WHERE user_id=?",user?.id ?? "")?.email;
    this.requireUser(user);
    text(key, 16, 100, "Identificador de compra");
    const registration=checkoutRegistration(this,input.eventId,input.quantity,input);
    const quantity = integer(input.quantity, 1, 6, "Cantidad"),
      fingerprint = hash(
        JSON.stringify([input.eventId, input.typeId, quantity,...(input.seatIds!==undefined?[normalizeSeatIds(input.seatIds)]:[]),...(registration?[registration]:[])]),
      );
    return this.transaction(() => {
      const existing = this.get(
        "SELECT id,request_hash FROM orders WHERE user_id=? AND idempotency_key=?",
        user.id,
        key,
      );
      if (existing) {
        if (existing.request_hash !== fingerprint)
          fail(409, "Ese identificador corresponde a otra compra.");
        return this.orderDetail(user, existing.id);
      }
      if (
        this.get(
          "SELECT id FROM payment_attempts WHERE user_id=? AND idempotency_key=?",
          user.id,
          key,
        )
      )
        fail(409, "Identificador usado en un pago.");
      const event = this.event(user, input.eventId);
      if (Date.parse(event.starts_at) <= Date.now())
        fail(409, "La venta ya terminó.");
      const type = event.types.find((t) => t.id === input.typeId);
      if (!type) fail(400, "Tipo de entrada inválido.");
      if (type.price_cop !== 0)
        fail(
          503,
          "Las ventas de pago estarán disponibles al conectar la pasarela. No se realizó ningún cobro.",
        );
      if (type.available < quantity)
        fail(409, "No quedan suficientes entradas.");
      const seats=selectedSeats(this,event.id,type.id,quantity,input.seatIds);
      const id = randomUUID();
      this.run(
        "INSERT INTO orders VALUES(?,?,?,?,?,?,?,?,?,?)",
        id,
        user.id,
        event.id,
        type.id,
        quantity,
        "confirmed",
        0,
        key,
        fingerprint,
        now(),
      );
      for (let i = 0; i < quantity; i++){
        const ticketId=randomUUID();
        this.run("INSERT INTO tickets VALUES(?,?,?,?,?,?)",ticketId,id,randomBytes(24).toString("base64url"),"valid",null,null);
        if(seats[i])assignSeat(this,seats[i],ticketId);
        if(registration)this.run("INSERT INTO ticket_attendees VALUES(?,?)",ticketId,registration.attendees[i]);
      }
      if(email) this.run("INSERT INTO mail_outbox(id,order_id,email,next_at) VALUES(?,?,?,?)",randomUUID(),id,email,Date.now());
      this.audit(user, "free_order", event.id);
      return this.orderDetail(user, id);
    });
  }
  orderDetail(user, id) {
    this.requireUser(user);
    const order = this.get(
      "SELECT o.*,e.title,e.starts_at,e.venue,e.is_demo,t.name AS type_name FROM orders o JOIN events e ON e.id=o.event_id JOIN ticket_types t ON t.id=o.type_id WHERE o.id=? AND o.user_id=?",
      id,
      user.id,
    );
    if (!order) fail(404, "Compra no disponible.");
    return {
      ...order,
      pricing:orderPricing(this,id),
      tickets: this.all(
        "SELECT t.id,t.token,t.status,t.used_at,a.full_name AS attendeeName,CASE WHEN s.id IS NOT NULL THEN s.row_label||s.seat_number END AS seatLabel FROM tickets t LEFT JOIN ticket_attendees a ON a.ticket_id=t.id LEFT JOIN ticket_seats x ON x.ticket_id=t.id LEFT JOIN event_seats s ON s.id=x.seat_id WHERE t.order_id=?",
        id,
      ),
    };
  }
  orders(user) {
    this.requireUser(user);
    return this.all(
      "SELECT o.id,o.state,o.quantity,e.title,e.starts_at,e.venue,t.name AS type_name FROM orders o JOIN events e ON e.id=o.event_id JOIN ticket_types t ON t.id=o.type_id WHERE o.user_id=? ORDER BY o.created_at DESC LIMIT 200",
      user.id,
    );
  }
  ticket(user, id) {
    this.requireUser(user);
    const ticket = this.get(
      "SELECT t.token FROM tickets t JOIN orders o ON o.id=t.order_id WHERE t.id=? AND o.user_id=?",
      id,
      user.id,
    );
    if (!ticket) fail(404, "Entrada no disponible.");
    return ticket;
  }
  scan(user, eventId, value) {
    const event = this.event(user, eventId, true);
    if (event.state !== "published")
      fail(409, "Este evento no admite ingresos.");
    const token = text(value, 10, 100, "Código").replace(/^sharkpass:v1:/, "");
    return this.transaction(() => {
      const ticket = this.get(
        "SELECT t.* FROM tickets t JOIN orders o ON o.id=t.order_id WHERE t.token=? AND o.event_id=? AND o.state='confirmed'",
        token,
        eventId,
      );
      if (!ticket) fail(404, "Entrada inválida para este evento.");
      if (ticket.status === "used") fail(409, "Esta entrada ya fue utilizada.");
      if (ticket.status !== "valid") fail(409, "Entrada anulada.");
      this.run(
        "UPDATE tickets SET status='used',used_at=?,used_by=? WHERE id=? AND status='valid'",
        now(),
        user.id,
        ticket.id,
      );
      this.audit(user, "ticket_used", eventId);
      return { accepted: true, ticketId: ticket.id,attendeeName:attendeeName(this,ticket.id),seatLabel:this.get("SELECT s.row_label||s.seat_number label FROM ticket_seats x JOIN event_seats s ON s.id=x.seat_id WHERE x.ticket_id=?",ticket.id)?.label??null };
    });
  }
  sales(user, eventId) {
    const event = this.event(user, eventId, true);
    this.org(user, event.organization_id, true);
    return {
      event,
      summary: this.get(
        "SELECT COALESCE(SUM(quantity),0) AS issued,COALESCE(SUM(total_cop),0) AS revenueCop FROM orders WHERE event_id=? AND state='confirmed'",
        eventId,
      ),
      used: this.get(
        "SELECT count(*) AS count FROM tickets t JOIN orders o ON o.id=t.order_id WHERE o.event_id=? AND t.status='used'",
        eventId,
      ).count,
    };
  }
}
