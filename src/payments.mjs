import {paymentPricing} from "./pricing.mjs";
import {checkoutRegistration} from "./registration.mjs";
import {normalizeSeatIds,selectedSeats,holdSeats,paymentSeats,heldSeatsMatch,assignSeat} from "./seating.mjs";
import {
  createHash,
  timingSafeEqual,
  randomUUID,
  randomBytes,
} from "node:crypto";
import { AppError } from "./store.mjs";
const digest = (value) => createHash("sha256").update(value).digest("hex");
const fail = (status, message) => {
  throw new AppError(status, message);
};
export function wompiConfig(env = process.env) {
  if (
    !env.WOMPI_PUBLIC_KEY &&
    !env.WOMPI_INTEGRITY_SECRET &&
    !env.WOMPI_EVENTS_SECRET &&
    !env.WOMPI_PRIVATE_KEY
  )
    return null;
  const mode = env.WOMPI_ENVIRONMENT;
  const prefix = mode === "test" ? "test" : mode === "prod" ? "prod" : null;
  if (
    !prefix ||
    !env.WOMPI_PUBLIC_KEY?.startsWith(`pub_${prefix}_`) ||
    !env.WOMPI_PRIVATE_KEY?.startsWith(`prv_${prefix}_`) ||
    !env.WOMPI_INTEGRITY_SECRET?.startsWith(`${prefix}_integrity_`) ||
    !env.WOMPI_EVENTS_SECRET?.startsWith(`${prefix}_events_`)
  )
    throw new Error("Configuración Wompi incompleta o ambientes mezclados.");
  if (
    prefix === "prod" &&
    (env.WOMPI_ENABLE_PRODUCTION !== "yes" ||
      !env.PUBLIC_URL?.startsWith("https://"))
  )
    throw new Error(
      "Producción Wompi requiere HTTPS y habilitación explícita.",
    );
  return {
    mode,
    publicKey: env.WOMPI_PUBLIC_KEY,
    privateKey: env.WOMPI_PRIVATE_KEY,
    integritySecret: env.WOMPI_INTEGRITY_SECRET,
    eventsSecret: env.WOMPI_EVENTS_SECRET,
    api:
      mode === "test"
        ? "https://sandbox.wompi.co/v1"
        : "https://production.wompi.co/v1",
  };
}
export function verifyWompiEvent(body, config, header) {
  if (!config) fail(503, "Wompi no está configurado.");
  if (
    body.event !== "transaction.updated" ||
    body.environment !== config.mode ||
    !Number.isSafeInteger(body.timestamp)
  )
    fail(400, "Evento Wompi inválido o de otro ambiente.");
  const props = body.signature?.properties;
  if (!Array.isArray(props) || props.length < 1 || props.length > 30)
    fail(400, "Firma Wompi inválida.");
  if (
    ![
      "transaction.id",
      "transaction.status",
      "transaction.amount_in_cents",
    ].every((p) => props.includes(p))
  )
    fail(400, "Firma sin campos críticos de transacción.");
  const values = props.map((path) => {
    if (
      typeof path !== "string" ||
      !/^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*$/.test(path) ||
      /(?:^|\.)(?:__proto__|constructor|prototype)(?:\.|$)/.test(path)
    )
      fail(400, "Propiedad de firma inválida.");
    let value = body.data;
    for (const part of path.split(".")) {
      if (!value || !Object.hasOwn(value, part)) fail(400, "Firma incompleta.");
      value = value[part];
    }
    if (!["string", "number", "boolean"].includes(typeof value))
      fail(400, "Valor de firma inválido.");
    return String(value);
  });
  const expected = digest(
    values.join("") + body.timestamp + config.eventsSecret,
  );
  const provided = header ?? body.signature?.checksum;
  if (
    typeof provided !== "string" ||
    !/^[a-f0-9]{64}$/i.test(provided) ||
    !timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"))
  )
    fail(403, "Firma Wompi no válida.");
  const id = body.data?.transaction?.id;
  if (typeof id !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(id))
    fail(400, "Transacción inválida.");
  return id;
}
export class Payments {
  constructor(
    store,
    {
      config = wompiConfig(),
      publicUrl,
      fetchImpl = fetch,
      clock = Date.now,
    } = {},
  ) {
    this.store = store;
    this.config = config;
    this.publicUrl = publicUrl;
    this.fetch = fetchImpl;
    this.clock = clock;
  }
  requireConfigured() {
    if (!this.config)
      fail(503, "Wompi no está configurado. No se realizó ningún cobro.");
  }
  checkout(user, input, key) {
    this.requireConfigured();
    this.store.requireUser(user);
    if (typeof key !== "string" || key.length < 16 || key.length > 100)
      fail(400, "Identificador de compra inválido.");
    if (
      !Number.isInteger(input.quantity) ||
      input.quantity < 1 ||
      input.quantity > 6
    )
      fail(400, "Cantidad inválida.");
    if (
      typeof input.email !== "string" ||
      input.email.length > 254 ||
      !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(input.email)
    )
      fail(400, "Escribe un correo válido para la entrega.");
    const email = input.email.trim().toLowerCase();
    const registration=checkoutRegistration(this.store,input.eventId,input.quantity,input);
    const fingerprint = digest(
      JSON.stringify([input.eventId, input.typeId, input.quantity, email,...(input.seatIds!==undefined?[normalizeSeatIds(input.seatIds)]:[]),...(registration?[registration]:[])]),
    );
    return this.store.transaction(() => {
      let row = this.store.get(
        "SELECT * FROM payment_attempts WHERE user_id=? AND idempotency_key=?",
        user.id,
        key,
      );
      if (row) {
        if (row.request_hash !== fingerprint)
          fail(409, "Identificador usado con otra compra.");
        return this.response(row);
      }
      const event = this.store.event(user, input.eventId);
      if (Date.parse(event.starts_at) <= this.clock())
        fail(409, "La venta ya terminó.");
      if (this.config.mode === "test" && !event.is_demo)
        fail(409, "Sandbox solo admite eventos identificados como DEMO.");
      if (this.config.mode === "prod" && event.is_demo)
        fail(409, "Los eventos DEMO no admiten cobros reales.");
      const type = event.types.find((t) => t.id === input.typeId);
      if (!type || type.price_cop < 1)
        fail(400, "Tipo de entrada de pago inválido.");
      if (type.available < input.quantity)
        fail(409, "No quedan suficientes entradas.");
      if (
        this.store.get(
          "SELECT id FROM orders WHERE user_id=? AND idempotency_key=?",
          user.id,
          key,
        )
      )
        fail(409, "Identificador usado con otra compra.");
      const seats=selectedSeats(this.store,event.id,type.id,input.quantity,input.seatIds,this.clock());
      const id = randomUUID(),
        at = this.clock(),
        expires = Math.min(at + 15 * 60 * 1000, Date.parse(event.starts_at));
      this.store.run(
        "INSERT INTO payment_attempts(id,user_id,event_id,type_id,quantity,amount_cents,email,state,environment,idempotency_key,request_hash,created_at,expires_at,updated_at) VALUES(?,?,?,?,?,?,?,'pending',?,?,?,?,?,?)",
        id,
        user.id,
        event.id,
        type.id,
        input.quantity,
        type.price_cop * input.quantity * 100,
        email,
        this.config.mode,
        key,
        fingerprint,
        at,
        expires,
        at,
      );
      const pricing=type.pricing;
      this.store.run("INSERT INTO payment_pricing VALUES(?,?,?,?,?)",id,pricing.baseCop,pricing.vatRate,pricing.vatCop,pricing.totalCop);
      holdSeats(this.store,seats,id,expires);
      if(registration)this.store.run("INSERT INTO payment_registrations VALUES(?,?,?,?)",id,JSON.stringify(registration.attendees),registration.termsVersion,at);
      row = this.store.get("SELECT * FROM payment_attempts WHERE id=?", id);
      return this.response(row);
    });
  }
  response(row) {
    const state =
      row.state === "pending" && row.expires_at <= this.clock()
        ? "expired"
        : row.state;
    const event = this.store.get("SELECT e.id,e.title,e.starts_at,e.venue,e.is_demo,p.image,o.name AS organizer FROM events e JOIN organizations o ON o.id=e.organization_id LEFT JOIN event_presentation p ON p.event_id=e.id WHERE e.id=?",row.event_id);
    const type = this.store.get("SELECT id,name FROM ticket_types WHERE id=?",row.type_id);
    const customer = this.store.customerProfile({id:row.user_id});
    let checkoutUrl = null;
    if (state === "pending" && row.environment === this.config.mode) {
      const expiration = new Date(row.expires_at).toISOString();
      const signature = digest(
        `${row.id}${row.amount_cents}COP${expiration}${this.config.integritySecret}`,
      );
      const checkout = new URL("https://checkout.wompi.co/p/");
      for (const [key, value] of Object.entries({
        "public-key": this.config.publicKey,
        currency: "COP",
        "amount-in-cents": row.amount_cents,
        reference: row.id,
        "signature:integrity": signature,
        "expiration-time": expiration,
        "redirect-url": `${this.publicUrl}/?payment=${row.id}`,
        "customer-data:email": row.email,
        ...(customer.fullName ? {"customer-data:full-name":customer.fullName} : {}),
        ...(customer.phone ? {"customer-data:phone-number":customer.phone} : {}),
      }))
        checkout.searchParams.set(key, value);
      checkoutUrl = checkout.href;
    }
    const seats=paymentSeats(this.store,row.id);
    return {
      id: row.id,
      state,
      environment: row.environment,
      totalCop: row.amount_cents / 100,
      pricing: paymentPricing(this.store,row.id),
      quantity: row.quantity,
      expiresAt: new Date(row.expires_at).toISOString(),
      orderId: row.order_id,
      email: row.email,
      event,
      type: {...type,pricing:paymentPricing(this.store,row.id),name:type.name+(seats.length?` · Sillas ${seats.map(seat=>seat.row+seat.number).join(", ")}`:""),unitPriceCop:row.amount_cents / 100 / row.quantity},
      seats,
      seatIds:seats.map(seat=>seat.id).sort(),
      serverNow: new Date(this.clock()).toISOString(),
      checkoutUrl,
    };
  }
  detail(user, id) {
    this.requireConfigured();
    this.store.requireUser(user);
    const row = this.store.get(
      "SELECT * FROM payment_attempts WHERE id=? AND user_id=?",
      id,
      user.id,
    );
    if (!row) fail(404, "Pago no disponible.");
    return this.response(row);
  }
  resume(user,key) {
    this.requireConfigured();this.store.requireUser(user);
    if(typeof key!=="string" || key.length<16 || key.length>100)fail(400,"Identificador de compra inválido.");
    const row=this.store.get("SELECT * FROM payment_attempts WHERE user_id=? AND idempotency_key=?",user.id,key);
    if(!row)fail(404,"No hay una reserva para esta selección.");
    return this.response(row);
  }
  list(user) {
    this.requireConfigured();
    this.store.requireUser(user);
    return this.store
      .all(
        "SELECT * FROM payment_attempts WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
        user.id,
      )
      .map((r) => this.response(r));
  }
  report(user, eventId) {
    const event = this.store.event(user, eventId, true);
    this.store.org(user, event.organization_id, true);
    return this.store
      .all(
        "SELECT p.id,p.state,p.environment,p.amount_cents,p.email,p.quantity,p.provider_id,p.order_id,p.created_at,p.expires_at,m.state AS email_state FROM payment_attempts p LEFT JOIN mail_outbox m ON m.payment_id=p.id WHERE p.event_id=? ORDER BY p.created_at DESC LIMIT 200",
        eventId,
      )
      .map((row) => ({
        ...row,
        state:
          row.state === "pending" && row.expires_at <= this.clock()
            ? "expired"
            : row.state,
      }));
  }
  async webhook(body, header) {
    this.requireConfigured();
    const id = verifyWompiEvent(body, this.config, header);
    // Re-read canonical transaction: fields such as reference/currency are not always signed in notifications.
    const transaction = await this.lookup(id);
    return this.settle(transaction);
  }
  async lookup(id) {
    if (typeof id !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(id))
      fail(400, "Transacción inválida.");
    const response = await this.fetch(
      `${this.config.api}/transactions/${encodeURIComponent(id)}`,
      {
        headers: { Authorization: `Bearer ${this.config.privateKey}` },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok)
      fail(502, "No se pudo comprobar la transacción con Wompi.");
    const transaction = (await response.json()).data;
    if (!transaction || transaction.id !== id)
      fail(502, "Respuesta Wompi inválida.");
    return transaction;
  }
  async refresh(user, id, providerId) {
    this.requireConfigured();
    this.store.requireUser(user);
    const row = this.store.get(
      "SELECT * FROM payment_attempts WHERE id=? AND user_id=?",
      id,
      user.id,
    );
    if (!row) fail(404, "Pago no disponible.");
    if (row.environment !== this.config.mode)
      fail(409, "El pago corresponde a otro ambiente de Wompi.");
    const txId = row.provider_id || providerId;
    if (!txId) return this.response(row);
    const tx = await this.lookup(txId);
    if (tx.reference !== id)
      fail(409, "La transacción corresponde a otra compra.");
    this.settle(tx);
    return this.detail(user, id);
  }
  cancel(user, id) {
    const payment = this.detail(user, id);
    if (payment.state !== "pending")
      fail(409, "La reserva ya no está pendiente.");
    this.store.run(
      "UPDATE payment_attempts SET state='expired',expires_at=?,updated_at=? WHERE id=? AND state='pending'",
      this.clock(),
      this.clock(),
      id,
    );
    return this.detail(user, id);
  }
  settle(tx) {
    if (
      !["PENDING", "APPROVED", "DECLINED", "ERROR", "VOIDED"].includes(
        tx.status,
      )
    )
      fail(400, "Estado Wompi desconocido.");
    return this.store.transaction(() => {
      const row = this.store.get(
        "SELECT * FROM payment_attempts WHERE id=?",
        tx.reference,
      );
      if (!row) return { received: true, ignored: true };
      if (
        row.environment !== this.config.mode ||
        tx.currency !== "COP" ||
        tx.amount_in_cents !== row.amount_cents
      )
        fail(409, "El pago no coincide con la compra.");
      if (row.provider_id && row.provider_id !== tx.id)
        fail(409, "La referencia ya tiene otra transacción.");
      if (
        this.store.get(
          "SELECT id FROM payment_attempts WHERE provider_id=? AND id<>?",
          tx.id,
          row.id,
        )
      )
        fail(409, "Transacción ya utilizada.");
      this.store.run(
        "UPDATE payment_attempts SET provider_id=?,updated_at=? WHERE id=?",
        tx.id,
        this.clock(),
        row.id,
      );
      if (tx.status === "VOIDED") {
        this.store.run("DELETE FROM seat_allocations WHERE payment_id=?",row.id);
        if (row.order_id) {
          this.store.run(
            "UPDATE orders SET state='cancelled' WHERE id=?",
            row.order_id,
          );
          this.store.run(
            "UPDATE tickets SET status='void' WHERE order_id=?",
            row.order_id,
          );
        }
        this.store.run(
          "UPDATE payment_attempts SET state='voided' WHERE id=?",
          row.id,
        );
        return { received: true, state: "voided" };
      }
      if (["confirmed", "voided", "review"].includes(row.state))
        return { received: true, state: row.state };
      if (tx.status === "PENDING") return { received: true, state: row.state };
      if (["DECLINED", "ERROR"].includes(tx.status)) {
        this.store.run(
          "UPDATE payment_attempts SET state='failed' WHERE id=?",
          row.id,
        );
        return { received: true, state: "failed" };
      }
      const event = this.store.get(
        "SELECT * FROM events WHERE id=?",
        row.event_id,
      );
      const type = this.store.get(
        "SELECT * FROM ticket_types WHERE id=?",
        row.type_id,
      );
      const occupied = this.store.get(
        "SELECT COALESCE(SUM(quantity),0) AS n FROM orders WHERE type_id=? AND state='confirmed'",
        row.type_id,
      ).n;
      const held = this.store.get(
        "SELECT COALESCE(SUM(quantity),0) AS n FROM payment_attempts WHERE type_id=? AND id<>? AND state='pending' AND expires_at>?",
        row.type_id,
        row.id,
        this.clock(),
      ).n;
      if (
        row.expires_at <= this.clock() ||
        event.state !== "published" ||
        Date.parse(event.starts_at) <= this.clock() ||
        !heldSeatsMatch(this.store,row,this.clock()) ||
        type.capacity < occupied + held + row.quantity
      ) {
        this.store.run(
          "UPDATE payment_attempts SET state='review' WHERE id=?",
          row.id,
        );
        return { received: true, state: "review" }; // Money received but no admission: owner must reconcile/refund, never oversell.
      }
      const orderId = randomUUID();
      this.store.run(
        "INSERT INTO orders VALUES(?,?,?,?,?,?,?,?,?,?)",
        orderId,
        row.user_id,
        row.event_id,
        row.type_id,
        row.quantity,
        "confirmed",
        row.amount_cents / 100,
        row.idempotency_key,
        row.request_hash,
        new Date(this.clock()).toISOString(),
      );
      const seats=paymentSeats(this.store,row.id);
      const registration=this.store.get("SELECT attendees_json FROM payment_registrations WHERE payment_id=?",row.id);
      const attendees=registration?JSON.parse(registration.attendees_json):[];
      for(let i=0;i<row.quantity;i++){
        const ticketId=randomUUID();
        this.store.run("INSERT INTO tickets VALUES(?,?,?,?,?,?)",ticketId,orderId,randomBytes(24).toString("base64url"),"valid",null,null);
        if(seats[i])assignSeat(this.store,seats[i],ticketId,row.id);
        if(attendees[i])this.store.run("INSERT INTO ticket_attendees VALUES(?,?)",ticketId,attendees[i]);
      }
      this.store.run(
        "UPDATE payment_attempts SET state='confirmed',order_id=? WHERE id=?",
        orderId,
        row.id,
      );
      this.store.run(
        "INSERT INTO mail_outbox(id,payment_id,next_at) VALUES(?,?,?)",
        randomUUID(),
        row.id,
        this.clock(),
      );
      this.store.audit({ id: row.user_id }, "paid_order", row.event_id);
      return { received: true, state: "confirmed" };
    });
  }
}
