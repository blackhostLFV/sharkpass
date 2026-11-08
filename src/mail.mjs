import {paymentPricing,orderPricing} from "./pricing.mjs";
import {seatLabel} from "./seating.mjs";
import { AppError } from "./store.mjs";
import {randomUUID} from "node:crypto";
import nodemailer from "nodemailer";
import { accountEmail, receiptEmail } from "./mail-templates.mjs";
export class Mailer {
  constructor(
    store,
    { env = process.env, publicUrl, fetchImpl = fetch, clock = Date.now, createTransport = nodemailer.createTransport } = {},
  ) {
    this.store = store;
    this.env = env;
    this.publicUrl = publicUrl;
    this.fetch = fetchImpl;
    this.clock = clock;
    this.provider = env.MAIL_PROVIDER || "resend";
    const port = Number(env.SMTP_PORT || 465);
    this.configured = Boolean(env.MAIL_FROM && publicUrl?.startsWith("https://") && (
      this.provider === "resend" ? env.RESEND_API_KEY :
      this.provider === "smtp" && env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD && [465, 587].includes(port)
    ));
    if (this.configured && this.provider === "smtp") {
      this.transport = createTransport({
        host: env.SMTP_HOST, port, secure: port === 465, requireTLS: true,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
        tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
        connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
        disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false,
      });
    }
  }
  async accountMessage(email, purpose, token, id) {
    await this.send({ from: this.env.MAIL_FROM, to: [email],
      ...accountEmail({publicUrl:this.publicUrl,support:this.env.MAIL_REPLY_TO,purpose,token}),
    }, `sharkpass-account-${id}`);
  }
  async send(message, key) {
    if (!this.configured) throw new Error("mail_not_configured");
    if (this.env.MAIL_REPLY_TO) message = { ...message, replyTo: this.env.MAIL_REPLY_TO };
    if (this.provider === "smtp") {
      let result;
      try {
        result = await this.transport.sendMail({ ...message,
          messageId: `<${key}@${new URL(this.publicUrl).hostname}>`,
        });
      } catch (error) {
        // Only bounded diagnostic codes: never log provider responses, addresses or credentials.
        console.warn(JSON.stringify({ operation: "smtp_send_failed",
          code: /^[A-Z_]{1,30}$/.test(error.code ?? "") ? error.code : "UNKNOWN",
          responseCode: Number.isInteger(error.responseCode) ? error.responseCode : null,
        }));
        throw error;
      }
      if (!result.accepted?.length || result.rejected?.length) {
        const error = new Error("mail_recipient_rejected");
        error.responseCode = 550;
        throw error;
      }
      return result.messageId;
    }
    const response = await this.fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.env.RESEND_API_KEY}`,
        "Content-Type": "application/json", "Idempotency-Key": key },
      signal: AbortSignal.timeout(10000), body: JSON.stringify(this.env.MAIL_REPLY_TO
        ? { ...message, replyTo: undefined, reply_to: this.env.MAIL_REPLY_TO } : message),
    });
    if (!response.ok) throw new Error("mail_send_failed");
    const result = await response.json();
    if (!result.id) throw new Error("mail_response_invalid");
    return result.id;
  }
  delivery(user, orderId) {
    this.store.orderDetail(user, orderId);
    return this.store.get("SELECT COALESCE(m.email,p.email) AS email,m.state,m.sent_at FROM mail_outbox m LEFT JOIN payment_attempts p ON p.id=m.payment_id JOIN orders o ON o.id=COALESCE(m.order_id,p.order_id) WHERE o.id=? AND o.user_id=?", orderId, user.id) ?? null;
  }
  retry(user, orderId) {
    const delivery = this.delivery(user, orderId);
    if (!this.configured) throw new AppError(503,"El correo no está configurado.");
    if (!delivery) throw new AppError(409,"Esta compra no tiene un envío de correo asociado.");
    const row=this.store.get("SELECT m.* FROM mail_outbox m LEFT JOIN payment_attempts p ON p.id=m.payment_id JOIN orders o ON o.id=COALESCE(m.order_id,p.order_id) WHERE o.id=? AND o.user_id=?",orderId,user.id);
    if (!row || row.state === 'sending' || (row.state === 'queued' && row.attempts > 0 && row.next_at > this.clock()) || (row.sent_at && this.clock()-row.sent_at<300000))
      throw new AppError(429,"Espera unos minutos antes de volver a solicitar el correo.");
    this.store.run("UPDATE mail_outbox SET id=?,state='queued',next_at=?,first_attempt_at=NULL,provider_id=NULL,sent_at=NULL WHERE id=?",randomUUID(),this.clock(),row.id);
    return {ok:true,message:"Solicitamos el envío al correo de esta compra. Revisa también Spam."};
  }
  async copy(user,orderId,input) {
    const order=this.store.orderDetail(user,orderId);
    if(order.state!=="confirmed")throw new AppError(409,"La compra no está confirmada.");
    const email=this.store.emailAddress(input.email);
    const seats=order.tickets.map(ticket=>ticket.seatLabel).filter(Boolean);if(seats.length)order.type_name+=` · Sillas ${seats.join(", ")}`;
    if(!this.configured)throw new AppError(503,"El correo no está configurado.");
    this.store.transaction(()=>{
      if(this.store.get("SELECT id FROM audit WHERE actor_id=? AND action='receipt_copy' AND event_id=? AND created_at>?",user.id,order.event_id,new Date(this.clock()-60000).toISOString()))
        throw new AppError(429,"Espera un minuto antes de enviar otra copia.");
      this.store.audit(user,"receipt_copy",order.event_id);
    });
    try{
      await this.send({from:this.env.MAIL_FROM,to:[email],...receiptEmail({publicUrl:this.publicUrl,support:this.env.MAIL_REPLY_TO,order:{...order,order_id:order.id,amount_cents:order.total_cop*100,environment:order.is_demo?'test':'prod'}})},`sharkpass-copy-${randomUUID()}`);
    }catch{throw new AppError(503,"No pudimos enviar la copia. Inténtalo nuevamente en un minuto.");}
    return {ok:true,message:"El servidor de correo aceptó la copia. Revisa también Spam."};
  }
  async flush() {
    if (!this.configured) return;
    for (let n = 0; n < 10; n++) {
      const row = this.store.transaction(() => {
        const item = this.store.get(
          "SELECT * FROM mail_outbox WHERE ((state='queued' AND next_at<=?) OR (state='sending' AND next_at<=?)) ORDER BY next_at LIMIT 1",
          this.clock(),
          this.clock(),
        );
        if (!item) return null;
        // SMTP has no idempotency guarantee: a crashed in-flight delivery needs review.
        // Resend retries stop before its 24h idempotency window expires.
        if (
          (this.provider === "smtp" && item.state === "sending") ||
          (item.first_attempt_at && this.clock() - item.first_attempt_at > 23 * 60 * 60 * 1000)
        ) {
          this.store.run(
            "UPDATE mail_outbox SET state='attention' WHERE id=?",
            item.id,
          );
          return null;
        }
        this.store.run(
          "UPDATE mail_outbox SET state='sending',attempts=attempts+1,next_at=?,first_attempt_at=COALESCE(first_attempt_at,?) WHERE id=?",
          this.clock() + 120000,
          this.clock(),
          item.id,
        );
        return item;
      });
      if (!row) return;
      const order = row.order_id
        ? this.store.get("SELECT o.id AS order_id,o.state,o.quantity,o.total_cop*100 AS amount_cents,e.title,e.venue,e.starts_at,tt.name AS type_name,CASE WHEN e.is_demo=1 THEN 'test' ELSE 'prod' END AS environment,? AS email FROM orders o JOIN events e ON e.id=o.event_id JOIN ticket_types tt ON tt.id=o.type_id WHERE o.id=?",row.email,row.order_id)
        : this.store.get("SELECT p.*,e.title,e.venue,e.starts_at,tt.name AS type_name FROM payment_attempts p JOIN events e ON e.id=p.event_id JOIN ticket_types tt ON tt.id=p.type_id WHERE p.id=?",row.payment_id);
      if (!order || order.state !== "confirmed") {
        this.store.run(
          "UPDATE mail_outbox SET state='attention' WHERE id=?",
          row.id,
        );
        continue;
      }
      order.pricing=row.payment_id?paymentPricing(this.store,row.payment_id):orderPricing(this.store,row.order_id);
      const seatedOrderId=order.order_id;
      if(seatedOrderId){const labels=this.store.all("SELECT t.id FROM tickets t WHERE t.order_id=?",seatedOrderId).map(ticket=>seatLabel(this.store,ticket.id)).filter(Boolean);if(labels.length)order.type_name+=` · Sillas ${labels.join(", ")}`;}
      try {
        const providerId = await this.send({
          from: this.env.MAIL_FROM, to: [order.email],
          ...receiptEmail({publicUrl:this.publicUrl,support:this.env.MAIL_REPLY_TO,order}),
        }, `sharkpass-receipt-${row.id}`);
        this.store.run(
          "UPDATE mail_outbox SET state='sent',provider_id=?,sent_at=? WHERE id=?",
          providerId,
          this.clock(),
          row.id,
        );
      } catch (error) {
        const safeRetry = this.provider !== "smtp" ||
          (error.responseCode >= 400 && error.responseCode < 500) ||
          ["CONN", "AUTH", "MAIL FROM", "RCPT TO"].includes(error.command) ||
          ["EDNS", "ECONNECTION", "EAUTH"].includes(error.code);
        if (!safeRetry || (this.provider === "smtp" && error.responseCode >= 500)) {
          this.store.run("UPDATE mail_outbox SET state='attention' WHERE id=?", row.id);
          continue;
        }
        this.store.run(
          "UPDATE mail_outbox SET state='queued',next_at=? WHERE id=?",
          this.clock() +
            Math.min(3600000, 60000 * 2 ** Math.min(row.attempts, 6)),
          row.id,
        );
      }
    }
  }
}
