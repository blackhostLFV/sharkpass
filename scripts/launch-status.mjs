import { readFileSync } from "node:fs";
import { Mailer } from "../src/mail.mjs";
import { wompiConfig } from "../src/payments.mjs";
const event = JSON.parse(
  readFileSync(
    new URL("../content/pitch-competition.json", import.meta.url),
    "utf8",
  ),
);
const pending = [];
let config = null;
try {
  config = wompiConfig();
} catch {
  pending.push(
    "Revisar las claves Wompi: están incompletas o mezclan ambientes.",
  );
}
if (!config) pending.push("Configurar Wompi Sandbox en el entorno privado.");
if (!new Mailer(null, { publicUrl: process.env.PUBLIC_URL }).configured)
  pending.push("Configurar transporte de correo y remitente verificado.");
if (!process.env.PUBLIC_URL?.startsWith("https://"))
  pending.push(
    "Disponer de endpoint HTTPS para pruebas reales de correo y webhooks.",
  );
if (!event.time) pending.push("Confirmar hora del Pitch Competition.");
if (!event.ticketTypes.length)
  pending.push("Confirmar tipos, precios y cupos de entradas.");
else if (event.ticketTypes.some(type => !Number.isSafeInteger(type.capacity) || type.capacity < 1))
  pending.push("Confirmar cupo de cada tipo de entrada antes de publicar.");
pending.push(
  "Realizar y documentar pruebas con Wompi Sandbox y el dispositivo de ingreso.",
);
console.log(
  JSON.stringify(
    {
      readyForPublicSales: false,
      localImplementation: true,
      paymentEnvironment: config?.mode ?? "not_configured",
      pending,
    },
    null,
    2,
  ),
);
process.exitCode = 1;
