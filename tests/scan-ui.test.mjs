import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Execute the production camera controller with deterministic browser surfaces.
// No account, persistent database, external provider or physical camera is used.
const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const scannerSource = source.slice(
  source.indexOf("async function scan() {"),
  source.indexOf("const paymentLabels ="),
);
const flush = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
function cameraHarness(detect) {
  const buttons = [];
  const submitted = [];
  const tracks = [];
  const scheduled = new Map();
  let frame = 0;
  let detections = 0;
  const context = {
    authRequired: () => false,
    heading: () => {},
    inform: () => {},
    managed: [],
    request: async (path) => path === "manage"
      ? [{ id: "synthetic-event", title: "QA event", state: "published" }]
      : { accepted: true },
    content: { append: () => {} },
    navigator: { mediaDevices: { getUserMedia: async () => {
      const track = { stopped: false, stop() { this.stopped = true; } };
      tracks.push(track);
      return { getTracks: () => [track] };
    } } },
    BarcodeDetector: class {
      async detect() { detections++; return detect(detections); }
    },
    MutationObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: (callback) => {
      scheduled.set(++frame, callback);
      return frame;
    },
    cancelAnimationFrame: (id) => scheduled.delete(id),
    form: (action) => {
      const form = {
        elements: { code: { value: "", focus() {} } },
        isConnected: true,
        append() {},
        appendSubmit() {},
        requestSubmit() {
          const code = this.elements.code.value;
          submitted.push(code);
          void action({ eventId: "synthetic-event", code });
        },
      };
      return form;
    },
    field: () => {},
    el: () => ({ append() {}, remove() {}, async play() {} }),
    button: (label, action) => {
      const button = { label, action };
      buttons.push(button);
      return button;
    },
  };
  vm.createContext(context);
  vm.runInContext(scannerSource, context);
  return {
    async open() { await context.scan(); },
    async start() {
      await buttons.find((item) => item.label === "Escanear con cámara").action();
      await flush();
    },
    async stop() {
      await buttons.find((item) => item.label === "Detener cámara").action();
      await flush();
    },
    submitted,
    tracks,
    scheduled,
  };
}

test("camera restart processes a second ticket without reloading the scanner", async () => {
  const harness = cameraHarness(async (n) => [{ rawValue: `synthetic-ticket-${n}` }]);
  await harness.open();
  await harness.start();
  await harness.start();
  assert.deepEqual(harness.submitted, ["synthetic-ticket-1", "synthetic-ticket-2"]);
  assert.equal(harness.tracks.every((track) => track.stopped), true);
});

test("stopping while detection is pending cannot submit a ticket afterwards", async () => {
  const pending = deferred();
  const harness = cameraHarness(() => pending.promise);
  await harness.open();
  await harness.start();
  await harness.stop();
  pending.resolve([{ rawValue: "synthetic-stale-ticket" }]);
  await flush();
  assert.deepEqual(harness.submitted, []);
  assert.equal(harness.scheduled.size, 0);
  assert.equal(harness.tracks.every((track) => track.stopped), true);
});

test("a late result from the old camera cannot interfere with a new camera run", async () => {
  const pending = deferred();
  const harness = cameraHarness((n) => n === 1
    ? pending.promise
    : Promise.resolve([{ rawValue: "synthetic-current-ticket" }]));
  await harness.open();
  await harness.start();
  await harness.start();
  pending.resolve([{ rawValue: "synthetic-old-ticket" }]);
  await flush();
  assert.deepEqual(harness.submitted, ["synthetic-current-ticket"]);
  assert.equal(harness.scheduled.size, 0);
  assert.equal(harness.tracks.every((track) => track.stopped), true);
});
