import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Store } from "../src/store.mjs";
import { createApp } from "../src/server.mjs";
function fixture() {
  const store = new Store();
  const a = store.register({
      username: "organizer-a",
      password: "a-long-test-password-123",
    }),
    b = store.register({
      username: "organizer-b",
      password: "another-test-password-123",
    });
  const org = store.createOrganization(a, { name: "Shark Caribe prueba" });
  const event = store.createEvent(a, {
    organizationId: org.id,
    title: "Evento de prueba",
    description: "Contenido sintético de prueba, sin asistentes reales.",
    venue: "Lugar de prueba",
    startsAt: "2031-01-02T23:30:00-05:00",
    isDemo: true,
  });
  const type = store.addType(a, event.id, {
    name: "General",
    priceCop: 0,
    capacity: 2,
  });
  store.setEventState(a, event.id, "published");
  return { store, a, b, org, event, type };
}
test("organizers and customers cannot access each other’s private data", () => {
  const { store, a, b, org, event, type } = fixture();
  try {
    assert.throws(
      () =>
        store.addType(b, event.id, { name: "VIP", priceCop: 0, capacity: 1 }),
      (e) => e.status === 403,
    );
    assert.throws(
      () => store.createEvent(b, { organizationId: org.id }),
      (e) => e.status === 403,
    );
    assert.throws(
      () => store.sales(b, event.id),
      (e) => e.status === 403,
    );
    const order = store.order(
      a,
      { eventId: event.id, typeId: type.id, quantity: 1 },
      randomUUID(),
    );
    assert.throws(
      () => store.orderDetail(b, order.id),
      (e) => e.status === 404,
    );
    assert.throws(
      () => store.ticket(b, order.tickets[0].id),
      (e) => e.status === 404,
    );
    assert.throws(
      () => store.scan(b, event.id, order.tickets[0].token),
      (e) => e.status === 403,
    );
  } finally {
    store.close();
  }
});
test("confirmed free orders are idempotent and cannot exceed capacity", () => {
  const { store, a, b, event, type } = fixture();
  try {
    const key = randomUUID(),
      input = { eventId: event.id, typeId: type.id, quantity: 2 };
    const first = store.order(a, input, key),
      retry = store.order(a, input, key);
    assert.equal(first.id, retry.id);
    assert.equal(retry.tickets.length, 2);
    assert.throws(
      () => store.order(a, { ...input, quantity: 1 }, key),
      (e) => e.status === 409,
    );
    assert.throws(
      () => store.order(b, { ...input, quantity: 1 }, randomUUID()),
      (e) => e.status === 409,
    );
    assert.equal(store.event(null, event.id).types[0].available, 0);
  } finally {
    store.close();
  }
});
test("a scanner can admit once but cannot edit or read sales", () => {
  const { store, a, b, org, event, type } = fixture();
  try {
    store.addScanner(a, org.id, { username: b.username });
    const order = store.order(
      a,
      { eventId: event.id, typeId: type.id, quantity: 1 },
      randomUUID(),
    );
    assert.equal(
      store.scan(b, event.id, `sharkpass:v1:${order.tickets[0].token}`)
        .accepted,
      true,
    );
    assert.throws(
      () => store.scan(b, event.id, order.tickets[0].token),
      (e) => e.status === 409,
    );
    assert.throws(
      () => store.sales(b, event.id),
      (e) => e.status === 403,
    );
    assert.throws(
      () => store.setEventState(b, event.id, "cancelled"),
      (e) => e.status === 403,
    );
    assert.throws(
      () => store.addScanner(b, org.id, { username: a.username }),
      (e) => e.status === 403,
    );
  } finally {
    store.close();
  }
});
test("paid orders are never fabricated and cancelled tickets cannot be used", () => {
  const { store, a, event, type } = fixture();
  try {
    const paid = store.addType(a, event.id, {
      name: "VIP",
      priceCop: 50000,
      capacity: 3,
    });
    assert.throws(
      () =>
        store.order(
          a,
          { eventId: event.id, typeId: paid.id, quantity: 1 },
          randomUUID(),
        ),
      (e) => e.status === 503,
    );
    assert.equal(store.orders(a).length, 0);
    const order = store.order(
      a,
      { eventId: event.id, typeId: type.id, quantity: 1 },
      randomUUID(),
    );
    store.setEventState(a, event.id, "cancelled");
    assert.throws(
      () => store.scan(a, event.id, order.tickets[0].token),
      (e) => e.status === 409,
    );
    assert.equal(store.orderDetail(a, order.id).tickets[0].status, "void");
    assert.throws(
      () => store.setEventState(a, event.id, "published"),
      (e) => e.status === 409,
    );
  } finally {
    store.close();
  }
});
test("sessions are real, logout revokes them, and dates retain Bogota midnight", () => {
  const { store, a, event } = fixture();
  try {
    assert.throws(
      () => store.login({ username: a.username, password: "incorrect" }),
      (e) => e.status === 401,
    );
    const session = store.login({
      username: a.username,
      password: "a-long-test-password-123",
    });
    assert.equal(store.session(session.token).id, a.id);
    store.logout(session.token);
    assert.equal(store.session(session.token), null);
    assert.equal(
      store.event(null, event.id).starts_at,
      "2031-01-03T04:30:00.000Z",
    );
    assert.throws(
      () => store.createEvent(a, { organizationId: "missing" }),
      (e) => e.status === 403,
    );
  } finally {
    store.close();
  }
});
test("HTTP rejects cross-origin writes and concurrent orders never oversell", async () => {
  const { store, a, event, type } = fixture();
  const { server } = createApp({ store, publicUrl: "http://localhost:3200" });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const denied = await fetch(`${url}/register`, {
      method: "POST",
      headers: {
        Origin: "https://bad.invalid",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(denied.status, 403);
    const login = await fetch(`${url}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: a.username,
        password: "a-long-test-password-123",
      }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        fetch(`${url}/orders`, {
          method: "POST",
          headers: {
            Cookie: cookie,
            "Content-Type": "application/json",
            "Idempotency-Key": randomUUID(),
          },
          body: JSON.stringify({
            eventId: event.id,
            typeId: type.id,
            quantity: 1,
          }),
        }),
      ),
    );
    assert.equal(results.filter((r) => r.status === 201).length, 2);
    assert.equal(results.filter((r) => r.status === 409).length, 4);
    const order = await results.find((r) => r.status === 201).json();
    const qr = await fetch(`${url}/tickets/${order.tickets[0].id}/qr`, {
      headers: { Cookie: cookie },
    });
    assert.equal(qr.status, 200);
    assert.equal(qr.headers.get("content-type"), "image/png");
    const unauthorized = await fetch(
      `${url}/tickets/${order.tickets[0].id}/qr`,
    );
    assert.equal(unauthorized.status, 401);
  } finally {
    await new Promise((r) => server.close(r));
    store.close();
  }
});

test("web branding and demo assets are public without exposing arbitrary files", async () => {
  const store = new Store();
  const { server } = createApp({ store });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [path, mime] of [
      ["/brand/sharkpass-logo.svg", "image/svg+xml"],
      ["/brand/sharkpass-logo-light.svg", "image/svg+xml"],
      ["/brand/sharkpass-symbol.svg", "image/svg+xml"],
      ["/media/rio-abierto.jpg", "image/jpeg"],
      ["/fonts/manrope/Manrope_400Regular.ttf", "font/ttf"],
      ["/fonts/manrope/Manrope_500Medium.ttf", "font/ttf"],
      ["/fonts/manrope/Manrope_600SemiBold.ttf", "font/ttf"],
      ["/fonts/manrope/Manrope_700Bold.ttf", "font/ttf"],
      ["/app-shell.css", "text/css; charset=utf-8"],
      ["/design/eventora/91cf0.svg", "image/svg+xml"],
      ["/design/eventora/96b60.png", "image/png"],
      ["/design/eventora/afe74.svg", "image/svg+xml"],
      ["/design/eventora/150e5.svg", "image/svg+xml"],
      ["/demo-events.js", "text/javascript; charset=utf-8"],
    ]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), mime);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.ok((await response.arrayBuffer()).byteLength > 0);
    }
    const unknown = await fetch(base + "/brand/unlisted.svg");
    assert.equal(unknown.status, 404);
    for (const path of [
      "/fonts/manrope/OFL.txt",
      "/design/eventora/unlisted.svg",
      "/fonts/manrope/../../src/store.mjs",
    ]) {
      assert.equal((await fetch(base + path)).status, 404);
    }
    const privateFile = await fetch(base + "/src/store.mjs");
    assert.equal(privateFile.status, 404);
    const write = await fetch(base + "/brand/sharkpass-logo.svg", {
      method: "POST",
    });
    assert.equal(write.status, 405);
    const page = await fetch(base + "/?demo=1");
    assert.equal(page.status, 200);
    assert.match(
      page.headers.get("content-security-policy"),
      /default-src 'self'/,
    );
    assert.equal(store.all("SELECT id FROM orders").length, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
});

test("mobile sessions authenticate, reject invalid credentials and revoke access without exposing web tokens", async () => {
  const { store, a, b, event, type } = fixture();
  const { server } = createApp({ store, publicUrl: "http://localhost:3200" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const credentials = {
    username: a.username,
    password: "a-long-test-password-123",
  };
  const post = (route, body, extra = {}) =>
    fetch(base + route, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extra },
      body: JSON.stringify(body),
    });
  try {
    assert.equal(
      (
        await post("/mobile/login", credentials, {
          Origin: "http://localhost:3200",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await post("/mobile/login", {
          ...credentials,
          password: "wrong-password-123",
        })
      ).status,
      401,
    );
    const login = await post("/mobile/login", credentials);
    assert.equal(login.status, 200);
    const session = await login.json();
    assert.equal(session.token.length, 43);
    const headers = { Authorization: `Bearer ${session.token}` };
    assert.equal(
      (await (await fetch(base + "/me", { headers })).json()).user.id,
      a.id,
    );
    assert.equal((await fetch(base + "/orders", { headers })).status, 200);
    assert.equal(
      (
        await fetch(base + "/orders", {
          headers: { Authorization: "Bearer invalid" },
        })
      ).status,
      401,
    );
    const owned = store.order(
      a,
      { eventId: event.id, typeId: type.id, quantity: 1 },
      randomUUID(),
    );
    const other = await (
      await post("/mobile/login", {
        username: b.username,
        password: "another-test-password-123",
      })
    ).json();
    assert.equal(
      (
        await fetch(base + `/orders/${owned.id}`, {
          headers: { Authorization: `Bearer ${other.token}` },
        })
      ).status,
      404,
    );
    assert.equal(
      (await fetch(base + `/orders/${owned.id}`, { headers })).status,
      200,
    );
    const web = await post("/login", credentials);
    assert.equal((await web.json()).token, undefined);
    await post("/logout", {}, headers);
    assert.equal((await fetch(base + "/orders", { headers })).status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
});

test("customer profiles persist signup fields and remain private to the session owner", async () => {
  const { store, a, b } = fixture();
  const { server } = createApp({ store });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const fresh = store.register({
      username: "profile-example",
      password: "a-long-test-password-123",
      fullName: "Persona de prueba",
      phone: "+57 300 000 0000",
    });
    assert.deepEqual(store.customerProfile(fresh), {
      fullName: "Persona de prueba",
      phone: "+573000000000",
    });
    assert.throws(
      () =>
        store.register({
          username: "bad-profile",
          password: "a-long-test-password-123",
          fullName: "Persona",
          phone: "invalid",
        }),
      (e) => e.status === 400,
    );
    assert.equal((await fetch(base + "/account/profile")).status, 401);
    const session = store.login({
        username: a.username,
        password: "a-long-test-password-123",
      }),
      headers = {
        Authorization: `Bearer ${session.token}`,
        "Content-Type": "application/json",
      };
    const saved = await fetch(base + "/account/profile", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        fullName: "Otro ejemplo",
        phone: "+57 311 000 0000",
      }),
    });
    assert.equal(saved.status, 200);
    assert.equal(
      (await (await fetch(base + "/account/profile", { headers })).json())
        .fullName,
      "Otro ejemplo",
    );
    assert.equal(store.customerProfile(b).fullName, "");
    const denied = await fetch(base + "/account/profile", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        userId: b.id,
        fullName: "No permitido",
        phone: "+573110000000",
      }),
    });
    assert.equal(denied.status, 400);
    assert.equal(store.customerProfile(b).fullName, "");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
});

test('catalog starting prices exclude sold-out types and follow current availability',()=>{
 const {store,a,event,type}=fixture();
 try{
  assert.equal(store.events().find(item=>item.id===event.id).min_price_cop,0);
  store.order(a,{eventId:event.id,typeId:type.id,quantity:2},randomUUID());
  const sold=store.events().find(item=>item.id===event.id);assert.equal(sold.has_available_tickets,false);assert.equal(sold.min_price_cop,null);
  store.addType(a,event.id,{name:'Preferencial',priceCop:80000,capacity:4});
  assert.equal(store.events().find(item=>item.id===event.id).min_price_cop,80000);
 }finally{store.close();}
});
