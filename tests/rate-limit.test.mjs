import { test } from "node:test";
import assert from "node:assert/strict";
import { clientAddress, trustedProxyAddresses } from "../src/client-address.mjs";
import { Store } from "../src/store.mjs";
import { createApp } from "../src/server.mjs";
const request = (remoteAddress, forwarded) => ({ socket: { remoteAddress }, headers: { "x-forwarded-for": forwarded } });
test("client addresses ignore untrusted forwarding and stop at first untrusted proxy hop", () => {
  const trusted = trustedProxyAddresses("127.0.0.1,::1");
  assert.equal(clientAddress(request("198.51.100.10", "203.0.113.3"), trusted), "198.51.100.10");
  assert.equal(clientAddress(request("127.0.0.1", "192.0.2.1, 198.51.100.10"), trusted), "198.51.100.10");
  assert.equal(clientAddress(request("::ffff:127.0.0.1", "203.0.113.3"), trusted), "203.0.113.3");
  assert.equal(clientAddress(request("127.0.0.1", "not-an-address"), trusted), "127.0.0.1");
  assert.throws(() => trustedProxyAddresses("*"));
});
async function serverFixture(trustedProxyIps = "") {
  const store = new Store();
  const { server } = createApp({ store, paymentConfig: null, mailConfig: {}, trustedProxyIps });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return { store, server, base: `http://127.0.0.1:${server.address().port}` };
}
test("public API saturation cannot exhaust the Wompi notification bucket", async () => {
  const { store, server, base } = await serverFixture();
  try {
    for (let n = 0; n < 300; n++) assert.equal((await fetch(`${base}/api/me`)).status, 200);
    assert.equal((await fetch(`${base}/api/me`)).status, 429);
    for (const path of ["/api/payments/wompi/events", "/api/payments/wompi/events/test"]) {
    const response = await fetch(`${base}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}"
    });
    // Notification reached provider/config validation; public traffic did not rate-limit it.
    assert.equal(response.status, 503);
    }
  } finally {
    await new Promise(resolve => server.close(resolve)); store.close();
  }
});
test("explicit trusted proxies isolate auth limits while unsolicited forwarded headers cannot bypass limits", async () => {
  for (const trust of ["", "127.0.0.1"]) {
    const { store, server, base } = await serverFixture(trust);
    try {
      for (let n = 0; n < 20; n++) {
        const response = await fetch(`${base}/api/login`, {
          method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.10" }, body: "{}"
        });
        assert.notEqual(response.status, 429);
      }
      const response = await fetch(`${base}/api/login`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.11" }, body: "{}"
      });
      if (trust) assert.notEqual(response.status, 429);
      else assert.equal(response.status, 429);
    } finally {
      await new Promise(resolve => server.close(resolve)); store.close();
    }
  }
});
