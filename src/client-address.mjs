import { isIP } from "node:net";
const normalize = (value) => value?.startsWith("::ffff:") ? value.slice(7) : value;
export function trustedProxyAddresses(value = "") {
  const addresses = value.split(",").map((part) => normalize(part.trim())).filter(Boolean);
  if (addresses.some((address) => !isIP(address)))
    throw new Error("TRUSTED_PROXY_IPS solo admite direcciones IP explícitas.");
  return new Set(addresses);
}
export function clientAddress(req, trusted) {
  let address = normalize(req.socket.remoteAddress) ?? "unknown";
  const forwarded = req.headers["x-forwarded-for"];
  if (!trusted.has(address) || typeof forwarded !== "string") return address;
  const chain = forwarded.split(",").map((part) => normalize(part.trim()));
  if (chain.length > 10 || chain.some((part) => !isIP(part))) return address;
  for (let index = chain.length - 1; index >= 0 && trusted.has(address); index--)
    address = chain[index];
  return address;
}
