import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { Store } from "../src/store.mjs";
import { Payments, wompiConfig, verifyWompiEvent } from "../src/payments.mjs";
import { Accounts } from "../src/accounts.mjs";
import { Mailer } from "../src/mail.mjs";
import { ticketSvg } from "../src/ticket.mjs";
import { createApp } from "../src/server.mjs";
const config = {
  mode: "test",
  publicKey: "pub_test_fixture",
  privateKey: "prv_test_fixture",
  integritySecret: "test_integrity_fixture",
  eventsSecret: "test_events_fixture",
  api: "https://sandbox.wompi.co/v1",
};
function fixture(capacity = 2) {
  const store = new Store();
  const owner = store.register({
      username: "owner",
      password: "test-password-owner-123",
    }),
    buyer = store.register({
      username: "buyer",
      password: "test-password-buyer-123",
    });
  const org = store.createOrganization(owner, { name: "Organizador DEMO" });
  const event = store.createEvent(owner, {
    organizationId: org.id,
    title: "Evento sintético DEMO",
    description: "Prueba automatizada, sin asistentes reales.",
    venue: "Sede de prueba",
    startsAt: "2031-11-25T18:00:00-05:00",
    isDemo: true,
  });
  const type = store.addType(owner, event.id, {
    name: "General",
    priceCop: 45000,
    capacity,
  });
  store.setEventState(owner, event.id, "published");
  const payments = new Payments(store, {
    config,
    publicUrl: "http://localhost:3201",
  });
  const input = {
    eventId: event.id,
    typeId: type.id,
    quantity: 1,
    email: "buyer@example.invalid",
  };
  return { store, owner, buyer, event, type, payments, input };
}
function transaction(payment, status = "APPROVED") {
  return {
    id: "sandbox-" + payment.id,
    reference: payment.id,
    amount_in_cents: 4500000,
    currency: "COP",
    status,
  };
}
function notification(tx, environment = "test") {
  const body = {
    event: "transaction.updated",
    environment,
    timestamp: Math.floor(Date.now() / 1000),
    data: { transaction: tx },
    signature: {
      properties: [
        "transaction.id",
        "transaction.status",
        "transaction.amount_in_cents",
      ],
    },
  };
  body.signature.checksum = createHash("sha256")
    .update(
      tx.id +
        tx.status +
        tx.amount_in_cents +
        body.timestamp +
        config.eventsSecret,
    )
    .digest("hex");
  return body;
}
test("checkout reserves capacity, binds idempotency to buyer and signs server price with expiry", () => {
  const { store, payments, buyer, owner, input, event } = fixture(1);
  try {
    const key = randomUUID(),
      p = payments.checkout(buyer, { ...input, amount: 1 }, key),
      url = new URL(p.checkoutUrl);
    assert.equal(p.state, "pending");
    assert.equal(url.searchParams.get("amount-in-cents"), "4500000");
    assert.equal(
      url.searchParams.get("signature:integrity"),
      createHash("sha256")
        .update(`${p.id}4500000COP${p.expiresAt}${config.integritySecret}`)
        .digest("hex"),
    );
    assert.equal(payments.checkout(buyer, input, key).id, p.id);
    assert.throws(
      () => payments.checkout(buyer, { ...input, quantity: 2 }, key),
      (e) => e.status === 409,
    );
    assert.throws(
      () => payments.checkout(owner, input, randomUUID()),
      (e) => e.status === 409,
    );
    assert.throws(
      () => payments.detail(owner, p.id),
      (e) => e.status === 404,
    );
    assert.throws(
      () => payments.checkout(null, input, randomUUID()),
      (e) => e.status === 401,
    );
    assert.equal(store.event(null, event.id).types[0].available, 0);
    assert.equal(store.all("SELECT * FROM tickets").length, 0);
    store.run(
      "UPDATE payment_attempts SET expires_at=? WHERE id=?",
      Date.now() - 1,
      p.id,
    );
    assert.equal(payments.detail(buyer, p.id).state, "expired");
    assert.equal(store.event(null, event.id).types[0].available, 1);
    payments.checkout(owner, input, randomUUID());
  } finally {
    store.close();
  }
});
test("signed provider approval creates tickets once and reversal voids access", async () => {
  const { store, payments, buyer, owner, input, event } = fixture();
  try {
    const p = payments.checkout(buyer, input, randomUUID()),
      tx = transaction(p);
    let calls = 0;
    payments.fetch = async () => {
      calls++;
      return { ok: true, json: async () => ({ data: tx }) };
    };
    const body = notification(tx);
    await payments.webhook(body);
    await payments.webhook(body);
    assert.equal(calls, 2);
    const detail = payments.detail(buyer, p.id);
    assert.equal(detail.state, "confirmed");
    const order = store.orderDetail(buyer, detail.orderId);
    assert.equal(order.tickets.length, 1);
    assert.equal(store.all("SELECT * FROM mail_outbox").length, 1);
    assert.throws(
      () => store.orderDetail(owner, detail.orderId),
      (e) => e.status === 404,
    );
    assert.equal(
      store.scan(owner, event.id, order.tickets[0].token).accepted,
      true,
    );
    assert.throws(
      () => store.scan(owner, event.id, order.tickets[0].token),
      (e) => e.status === 409,
    );
    tx.status = "VOIDED";
    await payments.webhook(notification(tx));
    assert.equal(
      store.orderDetail(buyer, detail.orderId).tickets[0].status,
      "void",
    );
    tx.status = "APPROVED";
    await payments.webhook(notification(tx));
    assert.equal(payments.detail(buyer, p.id).state, "voided");
    assert.equal(store.all("SELECT * FROM orders").length, 1);
  } finally {
    store.close();
  }
});
test("tampered signatures, mixed environments, wrong amounts and currencies never issue tickets", async () => {
  const { store, payments, buyer, input } = fixture();
  try {
    const p = payments.checkout(buyer, input, randomUUID()),
      tx = transaction(p),
      body = notification(tx);
    let calls = 0;
    payments.fetch = async () => {
      calls++;
      return { ok: true, json: async () => ({ data: tx }) };
    };
    body.data.transaction.amount_in_cents = 1;
    await assert.rejects(
      () => payments.webhook(body),
      (e) => e.status === 403,
    );
    assert.equal(calls, 0);
    tx.amount_in_cents = 4500000;
    await assert.rejects(
      () => payments.webhook(notification(tx, "prod")),
      (e) => e.status === 400,
    );
    assert.throws(
      () =>
        verifyWompiEvent(
          {
            ...notification(tx),
            signature: {
              properties: ["__proto__.id"],
              checksum: "a".repeat(64),
            },
          },
          config,
        ),
      (e) => e.status === 400,
    );
    tx.currency = "USD";
    await assert.rejects(
      () => payments.webhook(notification(tx)),
      (e) => e.status === 409,
    );
    tx.currency = "COP";
    tx.amount_in_cents = 1;
    await assert.rejects(
      () => payments.webhook(notification(tx)),
      (e) => e.status === 409,
    );
    assert.equal(store.all("SELECT * FROM tickets").length, 0);
  } finally {
    store.close();
  }
});
test("late or cancelled-event approvals require reconciliation and never oversell", () => {
  const { store, payments, buyer, owner, input, event } = fixture(1);
  try {
    const p = payments.checkout(buyer, input, randomUUID());
    store.run(
      "UPDATE payment_attempts SET expires_at=? WHERE id=?",
      Date.now() - 1,
      p.id,
    );
    const other = payments.checkout(owner, input, randomUUID());
    assert.equal(payments.settle(transaction(p)).state, "review");
    assert.equal(store.all("SELECT * FROM tickets").length, 0);
    store.setEventState(owner, event.id, "cancelled");
    assert.equal(payments.settle(transaction(other)).state, "review");
    assert.equal(store.all("SELECT * FROM tickets").length, 0);
  } finally {
    store.close();
  }
});
test("declined and pending payments never create entries; canonical lookup failure is retryable", async () => {
  const { store, payments, buyer, input } = fixture();
  try {
    const p = payments.checkout(buyer, input, randomUUID());
    assert.equal(payments.settle(transaction(p, "PENDING")).state, "pending");
    assert.equal(payments.settle(transaction(p, "DECLINED")).state, "failed");
    payments.fetch = async () => ({ ok: false });
    await assert.rejects(
      () => payments.webhook(notification(transaction(p))),
      (e) => e.status === 502,
    );
    assert.equal(store.all("SELECT * FROM orders").length, 0);
  } finally {
    store.close();
  }
});
test("configuration is fail-closed and sandbox cannot sell a real event", () => {
  assert.equal(wompiConfig({}), null);
  assert.throws(() =>
    wompiConfig({ WOMPI_ENVIRONMENT: "test", WOMPI_PUBLIC_KEY: "pub_prod_no" }),
  );
  assert.throws(() =>
    wompiConfig({
      WOMPI_ENVIRONMENT: "prod",
      WOMPI_PUBLIC_KEY: "pub_prod_x",
      WOMPI_INTEGRITY_SECRET: "prod_integrity_x",
      WOMPI_EVENTS_SECRET: "prod_events_x",
      WOMPI_ENABLE_PRODUCTION: "yes",
      PUBLIC_URL: "http://example.invalid",
    }),
  );
  const { store, payments, buyer, input, event } = fixture();
  try {
    store.run("UPDATE events SET is_demo=0 WHERE id=?", event.id);
    assert.throws(
      () => payments.checkout(buyer, input, randomUUID()),
      (e) => e.status === 409,
    );
  } finally {
    store.close();
  }
});
test("verified email recovery is one use, expires, does not enumerate accounts, and revokes sessions", async () => {
  const { store, buyer } = fixture();
  let clock = Date.now();
  const sent = [];
  const accounts = new Accounts(
    store,
    { configured: true, accountMessage: async (...args) => sent.push(args) },
    { clock: () => clock },
  );
  try {
    await accounts.request(buyer, { email: "buyer@example.invalid" }, "verify");
    const verify = sent.at(-1)[2];
    accounts.complete({ token: verify }, "verify");
    assert.throws(
      () => accounts.complete({ token: verify }, "verify"),
      (e) => e.status === 400,
    );
    const session = store.login({
      username: buyer.username,
      password: "test-password-buyer-123",
    });
    await accounts.request(null, { email: "buyer@example.invalid" }, "reset");
    const reset = sent.at(-1)[2];
    assert.throws(() => accounts.complete({token:reset,password:"abcdefghi"},"reset"),e=>e.status===400);
    accounts.complete(
      { token: reset, password: "changedten" },
      "reset",
    );
    assert.equal(store.session(session.token), null);
    assert.throws(
      () =>
        accounts.complete(
          { token: reset, password: "other-password-123" },
          "reset",
        ),
      (e) => e.status === 400,
    );
    assert.equal(
      store.login({
        username: buyer.username,
        password: "changedten",
      }).user.id,
      buyer.id,
    );
    const count = sent.length;
    const unknown = await accounts.request(
      null,
      { email: "missing@example.invalid" },
      "reset",
    );
    assert.equal(unknown.ok, true);
    assert.equal(sent.length, count);
    await accounts.request(null, { email: "buyer@example.invalid" }, "reset");
    clock += 16 * 60 * 1000;
    assert.throws(
      () =>
        accounts.complete(
          { token: sent.at(-1)[2], password: "new-password-123" },
          "reset",
        ),
      (e) => e.status === 400,
    );
  } finally {
    store.close();
  }
});
test("mail receipt retries durably, is idempotent, and sends no QR secrets in email links", async () => {
  const { store, payments, buyer, input } = fixture();
  let at = Date.now(),
    calls = 0;
  const payloads = [];
  try {
    const p = payments.checkout(buyer, input, randomUUID());
    payments.settle(transaction(p));
    at += 1000;
    const mailer = new Mailer(store, {
      env: {
        RESEND_API_KEY: "test-only",
        MAIL_FROM: "SharkPass <sender@example.invalid>",
      },
      publicUrl: "https://example.invalid",
      clock: () => at,
      fetchImpl: async (url, options) => {
        calls++;
        payloads.push(options);
        return calls === 1
          ? { ok: false }
          : { ok: true, json: async () => ({ id: "mail-test" }) };
      },
    });
    await mailer.flush();
    assert.equal(store.get("SELECT state FROM mail_outbox").state, "queued");
    at += 120000;
    await mailer.flush();
    assert.equal(store.get("SELECT state FROM mail_outbox").state, "sent");
    assert.equal(
      payloads[0].headers["Idempotency-Key"],
      payloads[1].headers["Idempotency-Key"],
    );
    assert.doesNotMatch(payloads[1].body, /sharkpass:v1:/);
    await mailer.flush();
    assert.equal(calls, 2);
  } finally {
    store.close();
  }
});
test("ticket export safely escapes event content and removes access QR from void or used tickets", async () => {
  const ticket = {
    id: randomUUID(),
    title: "<script>alert(1)</script> DEMO",
    venue: "A & B",
    type_name: "General",
    starts_at: "2031-11-25T23:00:00Z",
    status: "valid",
    token: "synthetic-token",
    is_demo: true,
  };
  const svg = await ticketSvg(ticket);
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt;/);
  assert.match(svg, /data:image\/png;base64,/);
  assert.match(svg, /DEMO/);
  const voided = await ticketSvg({ ...ticket, status: "void" });
  assert.doesNotMatch(voided, /class="access-qr"/);
  assert.match(voided, /class="official-logo"/);
  assert.match(svg, /class="access-qr"/);
  const used = await ticketSvg({ ...ticket, status: "used" });
  assert.doesNotMatch(used, /class="access-qr"/);
  assert.match(used, /YA UTILIZADA/);
  assert.match(voided, /ANULADA/);
});
test("HTTP authenticated checkout and downloads isolate buyers; webhook accepts only signed canonical transactions", async () => {
  const { store, buyer, owner, input } = fixture();
  let tx;
  const { server } = createApp({
    store,
    publicUrl: "http://localhost:3201",
    paymentConfig: config,
    mailConfig: {},
    fetchImpl: async () => ({ ok: true, json: async () => ({ data: tx }) }),
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = async (name, password) => {
    const r = await fetch(base + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: name, password }),
    });
    return r.headers.get("set-cookie").split(";")[0];
  };
  try {
    const checkoutKey=randomUUID();
    const cookie = await login("buyer", "test-password-buyer-123");
    let response = await fetch(base + "/api/payments/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": checkoutKey,
      },
      body: JSON.stringify(input),
    });
    assert.equal(response.status, 401);
    response = await fetch(base + "/api/payments/checkout", {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
        "Idempotency-Key": checkoutKey,
      },
      body: JSON.stringify(input),
    });
    assert.equal(response.status, 201);
    const p = await response.json();
    const resumed=await fetch(base+"/api/payments/by-key/"+checkoutKey,{headers:{Cookie:cookie}});
    assert.equal(resumed.status,200);
    assert.equal((await resumed.json()).id,p.id);
    assert.equal((await fetch(base+"/api/payments/by-key/"+checkoutKey)).status,401);
    const ownerCookie=await login("owner","test-password-owner-123");
    assert.equal((await fetch(base+"/api/payments/by-key/"+checkoutKey,{headers:{Cookie:ownerCookie}})).status,404);
    tx = transaction(p);
    response = await fetch(base + "/api/payments/wompi/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notification(tx)),
    });
    assert.equal(response.status, 400);
    assert.equal(store.all("SELECT * FROM tickets").length, 0);
    response = await fetch(base + "/api/payments/wompi/events/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notification(tx)),
    });
    assert.equal(response.status, 200);
    const payment = await (
      await fetch(base + "/api/payments/" + p.id, {
        headers: { Cookie: cookie },
      })
    ).json();
    const order = await (
      await fetch(base + "/api/orders/" + payment.orderId, {
        headers: { Cookie: cookie },
      })
    ).json();
    const path = "/api/tickets/" + order.tickets[0].id + "/download";
    assert.equal((await fetch(base + path)).status, 401);
    const otherCookie = await login(owner.username, "test-password-owner-123");
    assert.equal(
      (await fetch(base + path, { headers: { Cookie: otherCookie } })).status,
      404,
    );
    response = await fetch(base + path, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-disposition"), /attachment/);
    assert.match(await response.text(), /data:image\/png/);
  } finally {
    await new Promise((r) => server.close(r));
    store.close();
  }
});

test("HTTP Wompi routes separate sandbox and production and require a valid signature", async () => {
  for (const mode of ["test", "prod", null]) {
    const store = new Store();
    const paymentConfig = mode ? { ...config, mode } : null;
    const { server } = createApp({ store, paymentConfig, mailConfig: {},
      fetchImpl: async () => assert.fail("Rejected notifications must not query Wompi"),
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      for (const [path, routeMode] of [["/api/payments/wompi/events/test", "test"], ["/api/payments/wompi/events", "prod"]]) {
        const body = notification({ id:"test-transaction", status:"APPROVED", amount_in_cents:50000 }, mode ?? "test");
        body.signature.checksum = "0".repeat(64);
        const response = await fetch(base + path, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
        assert.equal(response.status, mode === null ? 503 : mode === routeMode ? 403 : 400);
      }
      assert.equal(store.all("SELECT * FROM tickets").length, 0);
    } finally {
      await new Promise(resolve => server.close(resolve)); store.close();
    }
  }
});
test("authenticated reconciliation verifies provider transaction ownership and callback cannot mint tickets", async () => {
  const { store, payments, buyer, owner, input } = fixture(1);
  try {
    const p = payments.checkout(buyer, input, randomUUID());
    const tx = transaction(p);
    payments.fetch = async (url, options) => {
      assert.equal(options.headers.Authorization, "Bearer prv_test_fixture");
      return { ok: true, json: async () => ({ data: tx }) };
    };
    await assert.rejects(
      () => payments.refresh(owner, p.id, tx.id),
      (e) => e.status === 404,
    );
    tx.reference = randomUUID();
    await assert.rejects(
      () => payments.refresh(buyer, p.id, tx.id),
      (e) => e.status === 409,
    );
    assert.equal(store.all("SELECT * FROM tickets").length, 0);
    tx.reference = p.id;
    const complete = await payments.refresh(buyer, p.id, tx.id);
    assert.equal(complete.state, "confirmed");
    assert.equal(store.all("SELECT * FROM tickets").length, 1);
  } finally {
    store.close();
  }
});
test("release of pending reservation restores capacity and later payment is reviewed without overbooking", () => {
  const { store, payments, buyer, owner, input } = fixture(1);
  try {
    const p = payments.checkout(buyer, input, randomUUID());
    assert.equal(payments.cancel(buyer, p.id).state, "expired");
    payments.checkout(owner, input, randomUUID());
    assert.equal(payments.settle(transaction(p)).state, "review");
    assert.equal(store.all("SELECT * FROM tickets").length, 0);
  } finally {
    store.close();
  }
});

test("changing environments cannot turn a sandbox reservation into a production checkout", async () => {
  const { store, payments, buyer, input } = fixture();
  try {
    const p = payments.checkout(buyer, input, randomUUID());
    payments.config = {
      ...config,
      mode: "prod",
      publicKey: "pub_prod_fixture",
      privateKey: "prv_prod_fixture",
    };
    assert.equal(payments.detail(buyer, p.id).checkoutUrl, null);
    await assert.rejects(
      () => payments.refresh(buyer, p.id, "transaction-foreign"),
      (e) => e.status === 409,
    );
  } finally {
    store.close();
  }
});
test("concurrent HTTP payment reservations cannot exceed capacity", async () => {
  const { store, input } = fixture(2);
  const { server } = createApp({
    store,
    publicUrl: "http://localhost:3201",
    paymentConfig: config,
    mailConfig: {},
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const cookies = [];
    for (const [username, password] of [
      ["buyer", "test-password-buyer-123"],
      ["owner", "test-password-owner-123"],
    ]) {
      const response = await fetch(base + "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      cookies.push(response.headers.get("set-cookie").split(";")[0]);
    }
    const responses = await Promise.all(
      cookies.map((Cookie) =>
        fetch(base + "/api/payments/checkout", {
          method: "POST",
          headers: {
            Cookie,
            "Content-Type": "application/json",
            "Idempotency-Key": randomUUID(),
          },
          body: JSON.stringify({ ...input, quantity: 2 }),
        }),
      ),
    );
    assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
    assert.equal(
      store.get(
        "SELECT SUM(quantity) AS n FROM payment_attempts WHERE state='pending'",
      ).n,
      2,
    );
    assert.equal(store.all("SELECT * FROM tickets").length, 0);
  } finally {
    await new Promise((r) => server.close(r));
    store.close();
  }
});

test("payment management and verified contacts enforce owner and session permissions", async () => {
  const { store, payments, buyer, owner, input, event } = fixture();
  try {
    payments.checkout(buyer, input, randomUUID());
    assert.throws(
      () => payments.report(buyer, event.id),
      (e) => e.status === 403,
    );
    assert.equal(payments.report(owner, event.id).length, 1);
    const accounts = new Accounts(store, { configured: false });
    assert.throws(
      () => accounts.profile(null),
      (e) => e.status === 401,
    );
    await assert.rejects(
      () =>
        accounts.request(buyer, { email: "buyer@example.invalid" }, "verify"),
      (e) => e.status === 503,
    );
    assert.throws(
      () => accounts.complete({ token: "not-a-token" }, "reset"),
      (e) => e.status === 400,
    );
    assert.equal(store.all("SELECT * FROM account_tokens").length, 0);
  } finally {
    store.close();
  }
});

test("resuming checkout is buyer scoped, keeps its expiry and price snapshot, and creates no extra hold", () => {
  const {store,payments,buyer,owner,input,event,type}=fixture(6);
  try {
    const key=randomUUID(),created=payments.checkout(buyer,{...input,quantity:2},key);
    store.run("UPDATE ticket_types SET price_cop=? WHERE id=?",55000,type.id);
    const resumed=payments.resume(buyer,key);
    assert.equal(resumed.id,created.id);
    assert.equal(resumed.expiresAt,created.expiresAt);
    assert.equal(resumed.totalCop,90000);
    assert.equal(resumed.type.unitPriceCop,45000);
    assert.equal(resumed.event.id,event.id);
    assert.equal(resumed.type.id,type.id);
    assert.equal(resumed.email,input.email);
    assert.ok(Date.parse(resumed.serverNow));
    assert.equal(store.event(null,event.id).types[0].available,4);
    assert.equal(store.all("SELECT * FROM payment_attempts").length,1);
    assert.throws(()=>payments.resume(null,key),error=>error.status===401);
    assert.throws(()=>payments.resume(owner,key),error=>error.status===404);
    assert.throws(()=>payments.resume(buyer,randomUUID()),error=>error.status===404);
    assert.throws(()=>payments.resume(buyer,'x'),error=>error.status===400);
    const encoded=JSON.stringify(resumed);
    for(const secret of [config.privateKey,config.eventsSecret,config.integritySecret])assert.ok(!encoded.includes(secret));
    store.run("UPDATE payment_attempts SET expires_at=? WHERE id=?",Date.now()-1,created.id);
    assert.equal(payments.resume(buyer,key).state,'expired');
    assert.equal(payments.resume(buyer,key).checkoutUrl,null);
    assert.equal(store.event(null,event.id).types[0].available,6);
  }finally{store.close();}
});

test('shark-shaped ticket retains its artwork, contains long data, and dates use Bogota',async()=>{
 const input={id:randomUUID(),title:'Evento de demostración '.repeat(8),venue:'Recinto de demostración '.repeat(8),type_name:'Localidad de demostración '.repeat(4),starts_at:'2031-11-25T04:59:00Z',status:'valid',token:'synthetic-ticket-layout-token',is_demo:true};
 const svg=await ticketSvg(input),height=Number(svg.match(/viewBox="0 0 400 ([\d.]+)"/)[1]);
 const qrY=Number(svg.match(/class="access-qr" x="90" y="([\d.]+)"/)[1]);assert.ok(qrY+220<height);assert.match(svg,/24 de noviembre/);assert.match(svg,/fill="#092C3A"/);
 const midnight=await ticketSvg({...input,starts_at:'2031-11-25T05:00:00Z'});assert.match(midnight,/25 de noviembre/);
});
