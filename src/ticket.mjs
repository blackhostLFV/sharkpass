import { readFileSync } from "node:fs";
const officialLogo = `data:image/png;base64,${readFileSync(new URL("../public/brand/sharkpass-official.png", import.meta.url)).toString("base64")}`;
import QRCode from "qrcode";
export const escapeXml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
function lines(value, size = 31, max = 7) {
  const result = [];
  let current = "";
  for (const word of String(value).split(/\s+/)) {
    for (let part of word.match(new RegExp(`.{1,${size}}`, "g")) ?? []) {
      if ((current + " " + part).trim().length > size) {
        result.push(current);
        current = "";
      }
      current = (current + " " + part).trim();
    }
  }
  if (current) result.push(current);
  if (result.length > max)
    result[max - 1] = result[max - 1].slice(0, size - 1) + "…";
  return result.slice(0, max);
}
export async function ticketSvg(ticket) {
  const valid = ticket.status === "valid";
  const qr = valid
    ? await QRCode.toDataURL(`sharkpass:v1:${ticket.token}`, {
        width: 360,
        margin: 4,
        errorCorrectionLevel: "M",
      })
    : null;
  const titles = lines(ticket.title, 26, 7),
    places = lines(ticket.venue, 36, 7),
    types = lines(ticket.type_name, 36, 3);
  const date = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(new Date(ticket.starts_at));
  const dates = lines(date, 36, 3);
  let y = 462;
  const text = (items, size, color) =>
    items
      .map((line) => {
        const out = `<text x="200" y="${y}" font-size="${size}" fill="${color}" text-anchor="middle">${escapeXml(line)}</text>`;
        y += size * 1.45;
        return out;
      })
      .join("");
  const body =
    text(titles, 22, "#F3F5EF") +
    text(dates, 13, "#BDD2D0") +
    text(places, 13, "#BDD2D0") +
    text(types, 13, "#78E2C5") + (ticket.seatLabel?text([`Silla ${ticket.seatLabel}`],15,"#F3F5EF"):"")+(ticket.attendeeName?text(lines(ticket.attendeeName,32,3),13,"#BDD2D0"):"");
  const height = Math.ceil(y + 365),
    bottom = height - 20;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="${height}" viewBox="0 0 400 ${height}" role="img" aria-label="Entrada SharkPass"><path d="M22 258C106 238 144 96 321 22C278 128 297 202 378 258V${y}A12 12 0 0 0 378 ${y + 24}V${bottom - 14}L352 ${bottom}L326 ${bottom - 14}L300 ${bottom}L274 ${bottom - 14}L248 ${bottom}L222 ${bottom - 14}L196 ${bottom}L170 ${bottom - 14}L144 ${bottom}L118 ${bottom - 14}L92 ${bottom}L66 ${bottom - 14}L40 ${bottom}L22 ${bottom - 14}V${y + 24}A12 12 0 0 0 22 ${y}Z" fill="#092C3A"/><g font-family="Arial,Helvetica,sans-serif"><image class="official-logo" x="75" y="200" width="250" height="250" href="${officialLogo}"/>${body}<path d="M40 ${y + 12}H360" stroke="#78E2C5" stroke-dasharray="4 8"/>${qr ? `<image class="access-qr" x="90" y="${y + 30}" width="220" height="220" href="${qr}"/>` : ""}<text x="200" y="${y + 275}" text-anchor="middle" fill="#78E2C5" font-size="14">${valid ? (ticket.is_demo ? "DEMO · SIN VALIDEZ COMERCIAL" : "ENTRADA INDIVIDUAL · UN SOLO INGRESO") : ticket.status === "used" ? "YA UTILIZADA" : "ANULADA"}</text><text x="200" y="${y + 299}" text-anchor="middle" fill="#BDD2D0" font-size="9">${escapeXml(ticket.id)}</text></g></svg>`;
}
