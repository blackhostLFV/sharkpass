import {saleRules,attendeeName} from "./registration.mjs";
import {seatLabel,publicSeatMap} from "./seating.mjs";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Store, AppError } from "./store.mjs";
import QRCode from "qrcode";
import { Payments, wompiConfig } from "./payments.mjs";
import { ticketSvg } from "./ticket.mjs";
import { Mailer } from "./mail.mjs";
import { Accounts } from "./accounts.mjs";
import {adminConsole,adminDashboard} from "./admin-console.mjs";
import { clientAddress, trustedProxyAddresses } from "./client-address.mjs";
process.umask(0o077);
const root = fileURLToPath(new URL("../public/", import.meta.url));
export function createApp({
  store = new Store(process.env.DATABASE_PATH ?? "data/sharkpass.sqlite"),
  publicUrl = process.env.PUBLIC_URL ?? "http://localhost:3200",
  paymentConfig = wompiConfig(),
  fetchImpl = fetch,
  mailConfig = process.env,
  trustedProxyIps = process.env.TRUSTED_PROXY_IPS ?? "",
} = {}) {
  const expected = new URL(publicUrl),
    limits = new Map(),
    trustedProxies = trustedProxyAddresses(trustedProxyIps);
  const payments = new Payments(store, {
    config: paymentConfig,
    publicUrl,
    fetchImpl,
  });
  const mailer = new Mailer(store, { env: mailConfig, publicUrl, fetchImpl });
  const accounts = new Accounts(store, mailer);
  let delivering = false;
  const deliver = async () => {
    if (delivering) return;
    delivering = true;
    try {
      await mailer.flush();
    } catch {
      /* durable queue retries independently of payment acknowledgement */
    } finally {
      delivering = false;
    }
  };
  const mailTimer = setInterval(deliver, 60000);
  mailTimer.unref();

  const server = createServer(async (req, res) => {
    if (
      req.headers.host?.toLowerCase() === `www.${expected.host}` &&
      ["GET", "HEAD"].includes(req.method)
    ) {
      res.writeHead(308, { Location: `${expected.origin}${req.url}` });
      return res.end();
    }
    const headers = {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "Content-Security-Policy":
        "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      "X-Frame-Options": "DENY",
    };
    const send = (status, data, extra = {}) => {
      res.writeHead(status, {
        ...headers,
        "Content-Type": "application/json; charset=utf-8",
        ...extra,
      });
      res.end(JSON.stringify(data));
    };
    try {
      const url = new URL(req.url, "http://localhost"),
        parts = url.pathname.split("/").filter(Boolean),
        method = req.method;
      const cookie = req.headers.cookie
        ?.split(";")
        .map((v) => v.trim())
        .find((v) => v.startsWith("sharkpass_session="))
        ?.slice(18);
      const authorization = req.headers.authorization;
      if (authorization && !/^Bearer [A-Za-z0-9_-]{43}$/.test(authorization))
        throw new AppError(401, "Sesión no válida.");
      const sessionToken = authorization?.slice(7) ?? cookie;
      const user = store.session(sessionToken);
      if (url.pathname === "/api/health")
        return send(200, {
          status: "ok",
          payments: paymentConfig ? paymentConfig.mode : "not_configured",
          email: mailer.configured ? "configured" : "not_configured",
        });
      if (url.pathname.startsWith("/api/")) {
        if (req.headers.origin && req.headers.origin !== expected.origin)
          throw new AppError(403, "Origen no autorizado.");
        const webhookMode = url.pathname === "/api/payments/wompi/events/test" ? "test"
          : url.pathname === "/api/payments/wompi/events" ? "prod" : null;
        const webhook = method === "POST" && webhookMode !== null;
        const auth = ["login", "register", "account", "mobile"].includes(parts[1]) || (parts[1] === "admin" && method !== "GET");
        const bucket = webhook ? "wompi" : auth ? "auth" : "api";
        const identity = !auth && !webhook && user ? `user:${user.id}` : `ip:${clientAddress(req, trustedProxies)}`;
        const rateKey = `${identity}:${bucket}`,
          rate = limits.get(rateKey),
          time = Date.now();
        if (!rate || time > rate.until)
          limits.set(rateKey, { count: 1, until: time + 60000 });
        else if (++rate.count > (rateKey.endsWith(":auth") ? 20 : 300))
          throw new AppError(429, "Demasiados intentos. Espera un minuto.");
        if (limits.size > 5000)
          for (const [key, value] of limits)
            if (time > value.until) limits.delete(key);
        let body = {};
        if (["POST", "PUT", "PATCH"].includes(method)) {
          if (req.headers["content-type"]?.split(";")[0] !== "application/json")
            throw new AppError(415, "Usa JSON.");
          let size = 0;
          const chunks = [];
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 16384)
              throw new AppError(413, "Solicitud demasiado grande.");
            chunks.push(chunk);
          }
          try {
            body = JSON.parse(Buffer.concat(chunks).toString());
          } catch {
            throw new AppError(400, "JSON inválido.");
          }
          if (!body || typeof body !== "object" || Array.isArray(body))
            throw new AppError(400, "Solicitud inválida.");
        }
        const cookieHeader = (value) =>
          `sharkpass_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${value ? 43200 : 0}${expected.protocol === "https:" ? "; Secure" : ""}`;
        if (url.pathname === "/api/mobile/login" && method === "POST") {
          if (req.headers.origin)
            throw new AppError(
              403,
              "El acceso móvil no está disponible desde el navegador.",
            );
          const result = store.login(body);
          return send(200, {
            user: result.user,
            token: result.token,
            expiresIn: 43200,
          });
        }
        if (parts[1] === "register" && method === "POST" && parts.length === 2)
          return send(201, store.register(body));
        if (parts[1] === "login" && method === "POST" && parts.length === 2) {
          const result = store.login(body);
          return send(
            200,
            { user: result.user },
            { "Set-Cookie": cookieHeader(result.token) },
          );
        }
        if (parts[1] === "logout" && method === "POST" && parts.length === 2) {
          store.logout(sessionToken);
          return send(200, { ok: true }, { "Set-Cookie": cookieHeader("") });
        }
        if (parts[1] === "me" && method === "GET")
          return send(200, {
            user: user
              ? { ...user, fullName: store.customerProfile(user).fullName }
              : null,
            organizations: user ? store.organizations(user) : [],
            platformAdmin: store.isPlatformAdmin(user),
            paymentsConfigured: Boolean(paymentConfig),
            paymentEnvironment: paymentConfig?.mode ?? null,
            emailConfigured: mailer.configured,
            email: user ? accounts.profile(user) : null,
            pendingEmail: user ? accounts.pending(user) : null,
            loginEmail: user ? store.get("SELECT email FROM login_emails WHERE user_id=?", user.id)?.email ?? null : null,
          });
        if (url.pathname === "/api/account/profile" && method === "GET")
          return send(200, store.customerProfile(user));
        if (url.pathname === "/api/account/profile" && method === "PUT")
          return send(200, store.updateCustomerProfile(user, body));
        if (url.pathname === "/api/account/email" && method === "POST")
          return send(200, await accounts.request(user, body, "verify"));
        if (url.pathname === "/api/account/verify" && method === "POST")
          return send(200, accounts.complete(body, "verify"));
        if (
          url.pathname === "/api/account/recovery-request" &&
          method === "POST"
        )
          return send(200, await accounts.request(null, body, "reset"));
        if (url.pathname === "/api/account/recover" && method === "POST")
          return send(200, accounts.complete(body, "reset"));
        if (webhook) {
          if (paymentConfig && paymentConfig.mode !== webhookMode)
            throw new AppError(400, "URL Wompi de otro ambiente.");
          const result = await payments.webhook(
            body,
            req.headers["x-event-checksum"],
          );
          send(200, result);
          void deliver();
          return;
        }
        if (url.pathname === "/api/payments/checkout" && method === "POST")
          return send(
            201,
            payments.checkout(user, body, req.headers["idempotency-key"]),
          );
        if (
          parts[1] === "payments" &&
          parts[2] &&
          parts[3] === "refresh" &&
          method === "POST"
        ) {
          const result = await payments.refresh(
            user,
            parts[2],
            body.transactionId,
          );
          send(200, result);
          void deliver();
          return;
        }
        if (
          parts[1] === "payments" &&
          parts[2] &&
          parts[3] === "cancel" &&
          method === "POST"
        )
          return send(200, payments.cancel(user, parts[2]));
        if (parts[1] === "payments" && parts[2] === "by-key" && parts.length === 4 && method === "GET")
          return send(200,payments.resume(user,parts[3]));
        if (parts[1] === "payments" && method === "GET")
          return send(
            200,
            parts[2] ? payments.detail(user, parts[2]) : payments.list(user),
          );
        if (parts[1] === "admin") {
          store.requirePlatformAdmin(user);
          if (method === "GET" && parts.length === 3) {
            const readers = {
              dashboard: () => ({...adminDashboard(store,user),paymentsConfigured:Boolean(paymentConfig),paymentEnvironment:paymentConfig?.mode??null,emailConfigured:mailer.configured}),
              console: () => adminConsole(store,user,Object.fromEntries(url.searchParams)),
              overview: () => ({ ...store.platformOverview(user), paymentsConfigured: Boolean(paymentConfig), emailConfigured: mailer.configured }),
              organizations: () => store.platformOrganizations(user),
              events: () => store.platformEvents(user),
              users: () => store.platformUsers(user),
              orders: () => store.platformOrders(user),
              audit: () => store.platformAuditLog(user),
            };
            if (Object.hasOwn(readers, parts[2])) return send(200, readers[parts[2]]());
          }
          if(method==="GET"&&parts.length===5&&parts[2]==="events"&&parts[4]==="preview"){
            const event=store.get("SELECT e.*,o.name AS organizer,p.image,p.category FROM events e JOIN organizations o ON o.id=e.organization_id LEFT JOIN event_presentation p ON p.event_id=e.id WHERE e.id=?",parts[3]);
            if(!event)throw new AppError(404,"Evento no disponible.");
            return send(200,{...event,types:store.eventTypes(event.id),seats:publicSeatMap(store,event.id),saleRules:saleRules(store,event.id),adminPreview:true});
          }
          if (method === "POST" && parts.length === 5 && parts[2] === "events" && parts[4] === "state")
            return send(200, store.platformSetEventState(user, parts[3], body));
          if (method === "POST" && parts.length === 5 && parts[2] === "users" && parts[4] === "revoke-sessions")
            return send(200, store.platformRevokeSessions(user, parts[3], body));
          throw new AppError(404, "Operación de administración no disponible.");
        }
        if (parts[1] === "organizations" && method === "POST")
          return send(
            201,
            parts[2]
              ? store.addScanner(user, parts[2], body)
              : store.createOrganization(user, body),
          );
        if (parts[1] === "manage" && method === "GET")
          return send(200, store.managedEvents(user));
        if (parts[1] === "events") {
          if (method === "GET" && parts.length === 2)
            return send(200, store.events().filter(event=>paymentConfig?.mode!=="prod"||!event.is_demo).map(event=>({...event,card_image:event.id==="f73a9bc4-337b-4d83-a067-6d8722c1a8c6"?"/media/sharkcaribe-mascota-card-2026.webp":event.image})));
          if (method === "POST" && parts.length === 2)
            return send(201, store.createEvent(user, body));
          if (parts[2]) {
            if (method === "GET" && parts.length === 3){
              const manage=url.searchParams.get("manage")==="1",event=store.event(user,parts[2],manage);
              if(!manage&&paymentConfig?.mode==="prod"&&event.is_demo)throw new AppError(404,"Evento no disponible.");
              return send(200,event);
            }
            if (parts[3] === "types" && method === "POST")
              return send(201, store.addType(user, parts[2], body));
            if (parts[3] === "state" && method === "POST")
              return send(200, store.setEventState(user, parts[2], body.state));
            if (parts[3] === "scan" && method === "POST")
              return send(200, store.scan(user, parts[2], body.code));
            if (parts[3] === "payments" && method === "GET")
              return send(200, payments.report(user, parts[2]));
            if (parts[3] === "sales" && method === "GET")
              return send(200, store.sales(user, parts[2]));
          }
        }
        if (parts[1] === "orders" && parts[2] && parts[3] === "email-copy" && parts.length === 4 && method === "POST")
          return send(200,await mailer.copy(user,parts[2],body));
        if (parts[1] === "orders" && parts[2] && parts[3] === "email" && parts.length === 4) {
          if (method === "GET") return send(200, mailer.delivery(user, parts[2]));
          if (method === "POST") {
            const result = mailer.retry(user, parts[2]);
            send(202,result); void deliver(); return;
          }
        }
        if (parts[1] === "orders") {
          if (method === "POST" && parts.length === 2) {
            const order=store.order(user, body, req.headers["idempotency-key"]);
            send(201,order);void deliver();return;
          }
          if (method === "GET")
            return send(
              200,
              parts[2] ? store.orderDetail(user, parts[2]) : store.orders(user),
            );
        }
        if (
          parts[1] === "tickets" &&
          parts[2] &&
          ["download", "art"].includes(parts[3]) &&
          method === "GET" &&
          parts.length === 4
        ) {
          const ticket = store.ticket(user, parts[2]);
          const details = store.get(
            "SELECT t.id,t.status,o.id AS order_id,e.title,e.starts_at,e.venue,e.is_demo,tt.name AS type_name FROM tickets t JOIN orders o ON o.id=t.order_id JOIN events e ON e.id=o.event_id JOIN ticket_types tt ON tt.id=o.type_id WHERE t.id=?",
            parts[2],
          );
          const svg = await ticketSvg({ ...details, token: ticket.token,seatLabel:seatLabel(store,parts[2]),attendeeName:attendeeName(store,parts[2]) });
          res.writeHead(200, {
            ...headers,
            "Content-Type": "image/svg+xml",
            "Content-Disposition": `${parts[3] === "download" ? "attachment" : "inline"}; filename="sharkpass-${details.id}.svg"`,
          });
          return res.end(svg);
        }
        if (
          parts[1] === "tickets" &&
          parts[2] &&
          parts[3] === "qr" &&
          method === "GET"
        ) {
          const ticket = store.ticket(user, parts[2]);
          const png = await QRCode.toBuffer(`sharkpass:v1:${ticket.token}`, {
            width: 360,
            margin: 4,
            errorCorrectionLevel: "M",
          });
          res.writeHead(200, { ...headers, "Content-Type": "image/png" });
          return res.end(png);
        }
        throw new AppError(404, "Ruta no disponible.");
      }
      if (method !== "GET" && method !== "HEAD")
        throw new AppError(405, "Método no permitido.");
      const escapeMarkup=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
      if(url.pathname==='/robots.txt'||url.pathname==='/sitemap.xml'){
        const live=paymentConfig?.mode==='prod',events=live?store.events().filter(event=>!event.is_demo):[];
        const body=url.pathname==='/robots.txt'?(live?`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /ingreso/\nDisallow: /*?\nSitemap: ${expected.origin}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n'):`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${(live?['/',...events.map(event=>`/evento/${event.id}`)]:[]).map(path=>`<url><loc>${escapeMarkup(expected.origin+path)}</loc></url>`).join('')}</urlset>`;
        res.writeHead(200,{...headers,'Content-Type':url.pathname==='/robots.txt'?'text/plain; charset=utf-8':'application/xml; charset=utf-8'});return res.end(method==='HEAD'?undefined:body);
      }
      const assets = {
        "/seating.js": ["seating.js", "text/javascript; charset=utf-8"],
        "/admin-console.js": ["admin-console.js", "text/javascript; charset=utf-8"],
        "/ingreso/": ["ingreso/index.html", "text/html; charset=utf-8"],
        "/ingreso/index.html": ["ingreso/index.html", "text/html; charset=utf-8"],
        "/ingreso/app.css": ["ingreso/app.css", "text/css; charset=utf-8"],
        "/ingreso/app.js": ["ingreso/app.js", "text/javascript; charset=utf-8"],
        "/ingreso/state.js": ["ingreso/state.js", "text/javascript; charset=utf-8"],
        "/ingreso/sw.js": ["ingreso/sw.js", "text/javascript; charset=utf-8"],
        "/ingreso/manifest.webmanifest": ["ingreso/manifest.webmanifest", "application/manifest+json; charset=utf-8"],
        "/ingreso/icon-192.png": ["ingreso/icon-192.png", "image/png"],
        "/ingreso/icon-512.png": ["ingreso/icon-512.png", "image/png"],
        "/fonts/manrope/Manrope_400Regular.ttf": [
          "fonts/manrope/Manrope_400Regular.ttf",
          "font/ttf",
        ],
        "/fonts/manrope/Manrope_500Medium.ttf": [
          "fonts/manrope/Manrope_500Medium.ttf",
          "font/ttf",
        ],
        "/fonts/manrope/Manrope_600SemiBold.ttf": [
          "fonts/manrope/Manrope_600SemiBold.ttf",
          "font/ttf",
        ],
        "/fonts/manrope/Manrope_700Bold.ttf": [
          "fonts/manrope/Manrope_700Bold.ttf",
          "font/ttf",
        ],
        "/design/eventora/150e5.svg": [
          "design/eventora/150e5.svg",
          "image/svg+xml",
        ],
        "/design/eventora/2b6a9.svg": [
          "design/eventora/2b6a9.svg",
          "image/svg+xml",
        ],
        "/design/eventora/37ea9.svg": [
          "design/eventora/37ea9.svg",
          "image/svg+xml",
        ],
        "/design/eventora/afe74.svg": [
          "design/eventora/afe74.svg",
          "image/svg+xml",
        ],
        "/design/eventora/054e4.svg": [
          "design/eventora/054e4.svg",
          "image/svg+xml",
        ],
        "/design/eventora/fd06a.svg": [
          "design/eventora/fd06a.svg",
          "image/svg+xml",
        ],
        "/design/eventora/49f8c.svg": [
          "design/eventora/49f8c.svg",
          "image/svg+xml",
        ],
        "/app-shell.css": ["app-shell.css", "text/css; charset=utf-8"],
        "/design/eventora/02221.svg": [
          "design/eventora/02221.svg",
          "image/svg+xml",
        ],
        "/design/eventora/0c5d4.svg": [
          "design/eventora/0c5d4.svg",
          "image/svg+xml",
        ],
        "/design/eventora/2fff0.png": [
          "design/eventora/2fff0.png",
          "image/png",
        ],
        "/design/eventora/91cf0.svg": [
          "design/eventora/91cf0.svg",
          "image/svg+xml",
        ],
        "/design/eventora/96b60.png": [
          "design/eventora/96b60.png",
          "image/png",
        ],
        "/design/eventora/ad15b.svg": [
          "design/eventora/ad15b.svg",
          "image/svg+xml",
        ],
        "/design/eventora/bb67c.svg": [
          "design/eventora/bb67c.svg",
          "image/svg+xml",
        ],
        "/design/eventora/be649.svg": [
          "design/eventora/be649.svg",
          "image/svg+xml",
        ],
        "/design/eventora/dda18.svg": [
          "design/eventora/dda18.svg",
          "image/svg+xml",
        ],
        "/design/eventora/f44ac.svg": [
          "design/eventora/f44ac.svg",
          "image/svg+xml",
        ],
        "/design/eventora/fa971.svg": [
          "design/eventora/fa971.svg",
          "image/svg+xml",
        ],
        "/design/eventora/fca5f.svg": [
          "design/eventora/fca5f.svg",
          "image/svg+xml",
        ],
        "/design/eventora/9c3b7.svg": [
          "design/eventora/9c3b7.svg",
          "image/svg+xml",
        ],
        "/design/eventora/269f3.svg": [
          "design/eventora/269f3.svg",
          "image/svg+xml",
        ],
        "/design/eventora/1b00a.svg": [
          "design/eventora/1b00a.svg",
          "image/svg+xml",
        ],
        "/design/eventora/90f22.svg": [
          "design/eventora/90f22.svg",
          "image/svg+xml",
        ],
        "/app.js": ["app.js", "text/javascript; charset=utf-8"],
        "/cart-state.js": ["cart-state.js", "text/javascript; charset=utf-8"],
        "/navigation.js": ["navigation.js", "text/javascript; charset=utf-8"],
        "/style.css": ["style.css", "text/css; charset=utf-8"],
        "/demo-events.js": ["demo-events.js", "text/javascript; charset=utf-8"],
        "/asientos-demo.html": ["asientos-demo.html", "text/html; charset=utf-8"],
        "/asientos-demo.css": ["asientos-demo.css", "text/css; charset=utf-8"],
        "/asientos-demo.js": ["asientos-demo.js", "text/javascript; charset=utf-8"],
        "/brand/sharkpass-official.png": ["brand/sharkpass-official.png", "image/png"],
        "/brand/sharkpass-logo.svg": [
          "brand/sharkpass-logo.svg",
          "image/svg+xml",
        ],
        "/brand/sharkpass-logo-light.svg": [
          "brand/sharkpass-logo-light.svg",
          "image/svg+xml",
        ],
        "/brand/sharkpass-symbol.svg": [
          "brand/sharkpass-symbol.svg",
          "image/svg+xml",
        ],
        "/media/canva-concert.png": ["media/canva-concert.png", "image/png"],
        "/media/sharkpass-concert-hero-hd.webp": ["media/sharkpass-concert-hero-hd.webp", "image/webp"],
        "/media/sharkcaribe-mascota-card-2026.webp": ["media/sharkcaribe-mascota-card-2026.webp", "image/webp"],
        "/media/sharkcaribe-pitch-hero-2026.webp": ["media/sharkcaribe-pitch-hero-2026.webp", "image/webp"],
        "/media/sharkcaribe-pitch-oficial-2026.webp": ["media/sharkcaribe-pitch-oficial-2026.webp", "image/webp"],
        "/media/sharkcaribe-pitch-2026.jpg": ["media/sharkcaribe-pitch-2026.jpg", "image/jpeg"],
        "/media/canva-music.png": ["media/canva-music.png", "image/png"],
        "/media/canva-dining.png": ["media/canva-dining.png", "image/png"],
        "/media/rio-abierto.jpg": ["media/rio-abierto.jpg", "image/jpeg"],
        "/media/sabores-caribe.jpg": ["media/sabores-caribe.jpg", "image/jpeg"],
      };
      let file = assets[url.pathname];
      if (
        url.pathname === "/" ||
        /^\/evento\/[a-f0-9-]{36}$/.test(url.pathname)
      )
        file = ["index.html", "text/html; charset=utf-8"];
      if (!file) throw new AppError(404, "Página no disponible.");
      let document=readFileSync(root+file[0]);
      if(file[0]==='index.html'&&paymentConfig?.mode==='prod'){
        document=document.toString().replace(/<div id="pilot-notice"[\s\S]*?<\/div>/,'<div id="pilot-notice" class="pilot-notice">Pagos con Wompi · Confirma siempre tus entradas en Mis entradas.</div>');
        const official=store.get("SELECT id FROM events WHERE id='f73a9bc4-337b-4d83-a067-6d8722c1a8c6' AND state='published' AND is_demo=0");
        if(official)document=document.replace('href="#sharkcaribe-info">Información del evento','href="/evento/'+official.id+'">Ver entradas').replace('Estamos preparando la apertura de ventas.','Selecciona tu ubicación y revisa la disponibilidad.').replace('25 NOV · En preparación','25 NOV · Entradas disponibles').replace('Venta aún no habilitada.','Venta habilitada con selección de silla numerada.');
      }
      if(file[0]==='index.html'&&paymentConfig?.mode==='prod'&&!url.search){
        const match=url.pathname.match(/^\/evento\/([a-f0-9-]{36})$/),event=match?store.event(null,match[1]):null;
        if(event?.is_demo)throw new AppError(404,'Evento no disponible.');
        const canonical=expected.origin+url.pathname;
        document=document.toString().replace('content="noindex,nofollow"','content="index,follow"').replace('</head>',`<link rel="canonical" href="${escapeMarkup(canonical)}" /></head>`);
        if(event){
          document=document.replace('<title>SharkPass · Entra a vivirlo</title>',`<title>${escapeMarkup(event.title)} · SharkPass</title>`);
          const data={'@context':'https://schema.org','@type':'Event',name:event.title,startDate:event.starts_at,eventStatus:'https://schema.org/EventScheduled',eventAttendanceMode:'https://schema.org/OfflineEventAttendanceMode',description:event.description,url:canonical,...(event.image?{image:new URL(event.image,expected.origin).href}:{}),location:{'@type':'Place',name:event.venue,address:event.venue},organizer:{'@type':'Organization',name:event.organizer},offers:event.types.map(type=>({'@type':'Offer',name:type.name,price:type.price_cop,priceCurrency:'COP',url:canonical,availability:type.available>0?'https://schema.org/InStock':'https://schema.org/SoldOut'}))};
          document=document.replace('</head>',`<script type="application/ld+json">${JSON.stringify(data).replace(/</g,'\\u003c')}</script></head>`).replace('</body>',`<noscript><article><h1>${escapeMarkup(event.title)}</h1><p>${escapeMarkup(event.description)}</p><p>${escapeMarkup(event.starts_at)} · ${escapeMarkup(event.venue)}</p>${event.types.map(type=>`<p>${escapeMarkup(type.name)}: COP ${type.price_cop}. ${type.available} disponibles.</p>`).join('')}</article></noscript></body>`);
        }
      }
      res.writeHead(200, { ...headers, "Content-Type": file[1] });
      res.end(method === "HEAD" ? undefined : document);
    } catch (error) {
      const status = error instanceof AppError ? error.status : 500;
      send(status, {
        error:
          status === 500 ? "No se pudo completar la operación." : error.message,
      });
    }
  });
  server.on("close", () => clearInterval(mailTimer));
  return { server, store, payments, mailer, accounts };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { server } = createApp();
  server.listen(
    Number(process.env.PORT ?? 3200),
    process.env.HOST ?? "127.0.0.1",
    () =>
      console.log(
        "SharkPass ready. Check /api/health for configured services.",
      ),
  );
}
