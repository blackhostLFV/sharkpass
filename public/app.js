import {summarizePricing} from "/pricing.js?v=20261108-iva19";
import {mountOrganizerLanding} from "/organizers.js?v=20261107-organizers-v5";
import {mountSeatPicker} from "/seating.js?v=20261108-iva19";
import {mountAdminConsole} from "/admin-console.js?v=20261107-console";
import {setupMobileNavigation} from "/navigation.js?v=20261107-mobile-nav";
import { demoEvents } from "/demo-events.js";
import {parseCart,sameSelection,remainingReservationMs,formatReservation} from "/cart-state.js?v=20261107-checkout";

const params = new URLSearchParams(location.search);
const previewMode = params.get("demo") === "1";
const content = document.querySelector("#content"),
  message = document.querySelector("#message");
let paymentEnvironment = null,
  paymentsConfigured = false,
  emailConfigured = false,
  accountEmail = null,
  pendingAccountEmail = null,
  returnEvent = null;
let authMode = params.get("auth") === "register" ? "register" : "login";
let platformAdmin = false;
const cartStorageKey="sharkpass-cart-v1";
let basket=null,checkoutReturn=false,checkoutTimer=null,paymentPoller=null,cartMutating=false;
try{basket=parseCart(localStorage.getItem(cartStorageKey));checkoutReturn=sessionStorage.getItem("sharkpass-checkout-return")==="1";}catch{/* Storage is optional. */}
const favoriteKey = previewMode
  ? "sharkpass-demo-favorites"
  : "sharkpass-favorites";
let savedEvents = new Set();
try {
  savedEvents = new Set(JSON.parse(localStorage.getItem(favoriteKey) ?? "[]"));
} catch {
  /* Storage can be unavailable. */
}
let me = null,
  organizations = [],
  managed = [],
  view = [
    "events",
    "search",
    "favorites",
    "orders",
    "organizer",
    "scan",
    "account",
    "admin",
    "cart",
    "checkout",
  ].includes(params.get("view"))
    ? params.get("view")
    : "events";
const el = (tag, text, attrs = {}) => {
  const n = document.createElement(tag);
  if (text !== null && text !== undefined) n.textContent = text;
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const fmtDate = (v) =>
  new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(v));
const price = (v) =>
  v === 0
    ? "Gratis"
    : new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }).format(v);
const inform = (v) => {
  message.textContent = v;
  if (v) {
    const rect=message.getBoundingClientRect();
    if(rect.top<0 || rect.bottom>window.innerHeight)message.scrollIntoView({block:"start",behavior:"instant"});
  }
};
async function request(path, method = "GET", body, headers = {}) {
  const response = await fetch(`/api/${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) {const error=new Error(data.error ?? "No se pudo completar.");error.status=response.status;throw error;}
  return data;
}
function button(label, action, cls = "") {
  const b = el("button", label, { type: "button", class: cls });
  b.addEventListener("click", async () => {
    b.disabled = true;
    inform("");
    try {
      await action();
    } catch (e) {
      inform(e.message);
    } finally {
      b.disabled = false;
    }
  });
  return b;
}
function field(form, label, name, type = "text", value = "", required = true) {
  const l = el("label", label),
    input = el(type === "textarea" ? "textarea" : "input", null, {
      name,
      ...(type !== "textarea" ? { type } : {}),
      ...(required ? { required: "" } : {}),
    });
  input.value = value;
  l.append(input);
  form.append(l);
  return input;
}
function form(action, label) {
  const f = el("form");
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const b = f.querySelector("button[type=submit]");
    if(b.disabled)return;
    b.disabled = true;
    inform("");
    f.querySelector(".purchase-form-error")?.remove();
    try {
      await action(Object.fromEntries(new FormData(f)), f);
    } catch (err) {
      if(f.classList.contains("checkout-buyer-form")){const error=el("p",err.message,{class:"purchase-form-error",role:"alert",tabindex:"-1"});b.before(error);error.focus();}
      else inform(err.message);
    } finally {
      b.disabled = false;
    }
  });
  f.appendSubmit = () => f.append(el("button", label, { type: "submit" }));
  return f;
}
function updateSessionIdentity(){
  const firstName=(me?.fullName??"").trim().split(/\s+/)[0];
  const greeting=me?(firstName?`Hola, ${firstName}`:"Sesión iniciada"):"Iniciar sesión";
  document.body.dataset.signedIn=String(Boolean(me));
  const signup=document.querySelector("#signup-access");if(signup)signup.hidden=Boolean(me);
  for(const link of document.querySelectorAll(".main-nav [data-view=account]")){
    link.textContent="Iniciar sesión";link.dataset.session=String(Boolean(me));link.hidden=Boolean(me);
    link.setAttribute("aria-label",me?`${greeting}. Sesión iniciada. Abrir Mi cuenta`:"Iniciar sesión");
    link.title=me?"Sesión iniciada · Mi cuenta":"Iniciar sesión";
  }
  const chip=document.querySelector(".header-session");
  if(chip){chip.hidden=!me;chip.querySelector(".header-session-label").textContent=me?greeting:"";chip.querySelector(".header-session-avatar").textContent=me?(me.fullName??"").trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>Array.from(part)[0]).join("").toLocaleUpperCase("es"):"";}
}
async function loadMe() {
  const data = await request("me");
  me = data.user ? {...data.user, email: data.loginEmail} : null;
  platformAdmin = Boolean(data.platformAdmin);
  const adminLink = document.querySelector("#platform-admin-link");
  if (adminLink) adminLink.hidden = !platformAdmin;
  updateSessionIdentity();
  organizations = data.organizations;
  paymentEnvironment = data.paymentEnvironment;
  paymentsConfigured = data.paymentsConfigured;
  emailConfigured = data.emailConfigured;
  accountEmail = data.email;
  pendingAccountEmail = data.pendingEmail ?? null;
  if (paymentsConfigured) {
    document
      .querySelector("#pilot-notice")
      .replaceChildren(
        el(
          "span",
          paymentEnvironment === "test"
            ? "WOMPI SANDBOX · Pruebas sin dinero real. Solo eventos DEMO."
            : "Pagos con Wompi · Confirma siempre tus entradas en Mis entradas.",
        ),
      );
  }
}
function heading(title, description) {
  content.classList.remove("account-workspace","ticket-wallet","orders-workspace","admin-workspace","organizer-marketing");
  stopCheckoutTimers();
  delete document.body.dataset.checkoutAuth;
  window.scrollTo({ top: 0, behavior: "instant" });
  content.replaceChildren(
    el("p", "SHARKPASS", { class: "eyebrow" }),
    el("h1", title),
  );
  if (description) content.append(el("p", description));
}
function authRequired() {
  if (me) return false;
  heading(
    "Inicia sesión",
    "Crea tu cuenta en SharkPass para conseguir entradas u organizar eventos.",
  );
  content.append(button("Ir a mi cuenta", () => show("account")));
  return true;
}
function eventCard(event, compact = false) {
  const mascot=event.card_image&&event.card_image!==event.image,coverImage=event.card_image||event.image;
  const card = el("article", null, {
    class: `${compact ? "card event-card compact-event" : "card event-card"}${mascot?" event-card-mascot":""}`,
  });
  const cover = el("div", null, { class: "event-cover" });
  cover.append(
    el("img", null, {
      src: coverImage || "/brand/sharkpass-official.png",
      alt: coverImage ? mascot?`Tiburón de Shark Caribe con el pase de Pitch Competition`: `Portada de ${event.title}` : "",
      class: coverImage ? "" : "cover-symbol",
      loading: "lazy",
    }),
  );
  if (event.is_demo)
    cover.append(el("span", "EVENTO DEMO", { class: "cover-tag" }));
  if(!mascot)cover.append(
    el("span", event.category ?? "Eventos", { class: "cover-category" }),
  );
  if (!compact)
    cover.append(
      el(
        "span",
        new Intl.DateTimeFormat("es-CO", {
          timeZone: "America/Bogota",
          day: "2-digit",
          month: "short",
        }).format(new Date(event.starts_at)),
        { class: "event-date-badge" },
      ),
    );
  const info = el("div", null, { class: "event-info" });
  if(mascot&&!compact)info.append(el("p",event.category??"Eventos",{class:"catalog-category"}));
  info.append(
    el("p", fmtDate(event.starts_at), { class: compact ? "event-date compact-date" : "event-date sr-only" }),
    el("h3", event.title),
    el("p", event.venue, { class: "event-location" }),
  );
  const pin = el("img", null, {
    src: "/design/eventora/150e5.svg",
    width: "16",
    height: "16",
    alt: "",
  });
  info.querySelector(".event-location").prepend(pin);
  const bottom = el("div", null, { class: "event-bottom" });
  bottom.append(
    el(
      "span",
      previewMode
        ? event.price_cop === 0 ? "Entrada libre" : `Desde ${price(event.price_cop)}`
        : event.has_available_tickets === false ? "Sin disponibilidad"
          : Number.isInteger(event.min_price_cop) ? event.min_price_cop===0 ? "Desde Gratis" : `Desde · ${pricingText(event.min_pricing,1,event.min_price_cop)}` : "Consulta las entradas",
      { class: "price" },
    ),
    button("Ver evento", () => eventDetail(event.id)),
  );
  info.append(bottom);
  if (!compact) {
    const save = button(
      "",
      () => {
        if (savedEvents.has(event.id)) savedEvents.delete(event.id);
        else savedEvents.add(event.id);
        try {
          localStorage.setItem(favoriteKey, JSON.stringify([...savedEvents]));
        } catch {
          inform("No pudimos conservar favoritos en este dispositivo.");
        }
        save.setAttribute("aria-pressed", String(savedEvents.has(event.id)));
        save.setAttribute(
          "aria-label",
          `${savedEvents.has(event.id) ? "Quitar de" : "Añadir a"} favoritos: ${event.title}`,
        );
        if (view === "favorites") return favorites();
      },
      "save-event",
    );
    save.setAttribute(
      "aria-label",
      `${savedEvents.has(event.id) ? "Quitar de" : "Añadir a"} favoritos: ${event.title}`,
    );
    save.setAttribute("aria-pressed", String(savedEvents.has(event.id)));
    save.append(
      el("img", null, {
        src: "/design/eventora/f44ac.svg",
        width: "16",
        height: "16",
        alt: "",
      }),
    );
    cover.append(save);
  }
  card.append(cover, info);
  return card;
}
async function events() {
  content.classList.remove("account-workspace","ticket-wallet","orders-workspace","admin-workspace","organizer-marketing");
  content.replaceChildren(
    document.querySelector("#home-template").content.cloneNode(true),
  );
  if (view === "search") {
    const back = button("", () => show("events"), "search-back");
    back.setAttribute("aria-label", "Volver al inicio");
    back.append(
      el("img", null, {
        src: "/design/eventora/37ea9.svg",
        width: "24",
        height: "24",
        alt: "",
      }),
    );
    content.querySelector("#event-search").prepend(back);
    content.querySelector("#catalog-title").textContent =
      "Resultados de búsqueda";
  }
  const grid = content.querySelector("#event-list"),
    search = content.querySelector("#event-search"),
    count = content.querySelector("#result-count");
  count.textContent = "Cargando eventos…";
  let items;
  try {
    items = previewMode ? demoEvents : await request("events");
  } catch (error) {
    count.textContent = "No pudimos cargar el catálogo.";
    grid.append(button("Reintentar", () => show("events"), "secondary"));
    throw error;
  }
  const firstPublished = items.find(
    (event) =>
      !event.is_demo && event.id === "f73a9bc4-337b-4d83-a067-6d8722c1a8c6",
  );
  if (firstPublished) {
    const panel = content.querySelector(".first-event");
    const publishedPanel = el("section", null, { class: "first-event" });
    publishedPanel.replaceChildren(
      el("p", "PRIMER EVENTO · PUBLICADO", { class: "eyebrow" }),
      el("h2", firstPublished.title, { id: "first-event-title" }),
      el("p", `${fmtDate(firstPublished.starts_at)} · ${firstPublished.venue}`),
      button("Ver entradas", () => eventDetail(firstPublished.id)),
    );
    publishedPanel.id="sharkcaribe-info";
    panel.replaceWith(publishedPanel);
    const launchCta=content.querySelector("#official-event-cta");
    if(launchCta){launchCta.href=`/evento/${firstPublished.id}`;launchCta.textContent="Ver entradas ↗";content.querySelector("#official-sale-status").textContent="Selecciona tu ubicación y revisa la disponibilidad.";}
  }
  if (previewMode)
    content.querySelector("#catalog-mode").textContent =
      "DEMO · Ejemplos sin venta";
  const headerSearch=document.querySelector("#header-search");
  const category = search.elements.category;
  const previousCategory=headerSearch.elements.category.value;
  setHeaderCategories(items);
  headerSearch.elements.category.value=previousCategory;
  search.elements.query.value=headerSearch.elements.query.value;
  const tabs = content.querySelector("#category-tabs");
  const upcoming = content.querySelector("#upcoming-list");
  for (const value of new Set(
    items.map((event) => event.category ?? "Eventos"),
  ))
    category.append(el("option", value, { value }));
  category.value=headerSearch.elements.category.value;
  const tabButtons = [];
  for (const [value, label] of [
    ["", "Todos"],
    ...Array.from(
      new Set(items.map((event) => event.category ?? "Eventos")),
    ).map((value) => [value, value]),
  ]) {
    const tab = button(
      label,
      () => {
        category.value = value;
        render();
      },
      "category-tab",
    );
    tab.dataset.category = value;
    tabs.append(tab);
    tabButtons.push(tab);
  }
  const normalize = (value) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es-CO");
  const render = () => {
    headerSearch.elements.query.value=search.elements.query.value;
    headerSearch.elements.category.value=category.value;
    if(view==="search"){
      const target=new URL(location.href);
      target.searchParams.delete("q");target.searchParams.delete("category");
      if(search.elements.query.value.trim())target.searchParams.set("q",search.elements.query.value.trim());
      if(category.value)target.searchParams.set("category",category.value);
      history.replaceState(null,"",target.pathname+target.search);
    }
    const query = normalize(search.elements.query.value.trim());
    const found = items.filter(
      (event) =>
        (!category.value || (event.category ?? "Eventos") === category.value) &&
        normalize(`${event.title} ${event.venue} ${event.organizer} ${event.description??""}`).includes(
          query,
        ),
    );
    grid.replaceChildren();
    upcoming.replaceChildren();
    for (const tab of tabButtons)
      tab.setAttribute(
        "aria-pressed",
        String(tab.dataset.category === category.value),
      );
    count.textContent = `${found.length} ${found.length === 1 ? "experiencia disponible" : "experiencias disponibles"}${previewMode ? " · Datos ficticios de demostración" : ""}`;
    for (const event of found) grid.append(eventCard(event));
    for (const event of [...found]
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
      .slice(0, 6))
      upcoming.append(eventCard(event, true));
    if (!found.length)
      upcoming.append(
        el("p", "Los eventos aparecerán aquí cuando estén disponibles.", {
          class: "muted",
        }),
      );
    if (!found.length) {
      const empty = el("div", null, { class: "empty-state" });
      empty.append(
        el(
          "h3",
          items.length
            ? "Ese plan todavía está por llegar."
            : "El próximo evento podría ser el tuyo.",
        ),
        el(
          "p",
          items.length
            ? "Prueba otro nombre, lugar o categoría."
            : "Aún no hay eventos publicados en este piloto de SharkPass.",
        ),
      );
      if (items.length)
        empty.append(
          button(
            "Limpiar búsqueda",
            () => {
              search.reset();
              render();
            },
            "secondary",
          ),
        );
      else
        empty.append(
          button("Quiero organizar un evento", () => show("organizer")),
        );
      grid.append(empty);
    }
  };
  search.addEventListener("submit", (event) => {
    event.preventDefault();
    render();
    content.querySelector("#catalog").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  search.elements.query.addEventListener("input", render);
  category.addEventListener("change", render);
  render();
}
function previewWorkspace(next) {
  if (next === "account") return authScreen(authMode);
  if (next === "organizer") return organizerLanding();
  if (next === "orders") {
    heading("Mis entradas", "DEMO · No hay compras ni entradas emitidas.");
    const empty = el("section", null, { class: "booking-empty" });
    empty.append(
      el("img", null, {
        src: "/design/eventora/fd06a.svg",
        width: "18.165",
        height: "19.91",
        alt: "",
      }),
      el("h2", "Tu próxima experiencia empieza aquí"),
      el(
        "p",
        "Cuando compres una entrada real, podrás abrirla desde esta pantalla.",
      ),
      button("Explorar eventos", () => show("events")),
    );
    content.append(empty);
    return;
  }

  const titles = {
    account: "Tu cuenta. Tus experiencias.",
    orders: "Tus entradas, en un solo lugar.",
    organizer: "Tú creas el momento.",
    scan: "Una bienvenida sin complicaciones.",
  };
  heading(
    titles[next],
    "Esta es una demo visual independiente de SharkPass. No crea cuentas, pedidos, entradas ni códigos QR.",
  );
  const card = el("section", null, { class: "card organizer-intro" });
  card.append(
    el("h2", "La operación sucede en SharkPass."),
    el(
      "p",
      "Las cuentas, los organizadores, el catálogo y el control de ingreso pertenecen a esta ticketera. Localia solo puede enlazar eventos publicados; no comparte su sesión ni emite entradas.",
    ),
    el("a", "Salir de la demo y abrir SharkPass", {
      href: `/?view=${next}`,
      class: "action",
    }),
  );
  content.append(
    card,
    button("Volver a los ejemplos", () => show("events"), "secondary"),
  );
}
function previewEventDetail(id) {
  window.scrollTo({ top: 0, behavior: "instant" });
  const event = demoEvents.find((item) => item.id === id);
  if (!event) {
    heading(
      "Este ejemplo no está disponible",
      "Vuelve al catálogo de demostración.",
    );
    content.append(button("Ver catálogo", () => show("events")));
    return;
  }
  document.body.dataset.view = "detail";
  history.replaceState(null, "", `/?demo=1&event=${event.id}`);
  content.replaceChildren();
  const back = button(
    "← Explorar los ejemplos",
    () => show("events"),
    "secondary back-link",
  );
  back.setAttribute("aria-label", "Volver a los eventos");
  back.replaceChildren(
    el("img", null, {
      src: "/design/eventora/37ea9.svg",
      width: "24",
      height: "24",
      alt: "",
    }),
  );
  content.prepend(back);
  const layout = el("div", null, { class: "detail-layout" }),
    story = el("section"),
    summary = el("aside", null, {
      class: "detail-summary",
      "aria-label": "Resumen de entradas de demostración",
    });
  const hero = el("div", null, { class: "detail-hero" });
  hero.append(
    el("img", null, {
      src: event.image,
      alt: `Fotografía ilustrativa de ${event.title}`,
      class: "detail-cover",
    }),
    back,
    el("span", "Detalle del evento", { class: "detail-hero-label" }),
  );
  story.append(
    hero,
    el("p", "DEMO · Fotografía de Canva, evento ficticio", { class: "demo-note" }),
    el("h1", event.title),
    el("p", event.venue, { class: "muted" }),
    el("h2", "Acerca del evento"),
    el("p", event.description),
    el("h2", "Fecha y lugar"),
    el("p", `${fmtDate(event.starts_at)} · ${event.venue}`),
    el("p", `Organiza: ${event.organizer}`),
  );
  summary.append(
    el("p", "TU ENTRADA A LA EXPERIENCIA", { class: "eyebrow" }),
    el(
      "div",
      event.price_cop === 0 ? "Entrada libre" : price(event.price_cop),
      { class: "price" },
    ),
    el("p", "Precio ilustrativo de demostración."),
  );
  const unavailable = el("button", "Sin venta · Evento DEMO", {
    type: "button",
    disabled: "",
  });
  summary.append(
    unavailable,
    el(
      "p",
      "No se generan entradas, reservas ni códigos QR. No se procesa ningún pago.",
    ),
    el("hr"),
    el(
      "p",
      "SharkPass es la ticketera. Localia es una guía independiente que puede enlazar a este evento.",
    ),
  );
  layout.append(story, summary);
  content.append(layout);
}
function appendEventMedia(event){
  if(!event.image)return;
  const media=el("figure",null,{class:"event-detail-media"});
  media.append(el("img",null,{src:event.image,alt:`Portada de ${event.title}`,decoding:"async"}));
  content.append(media);
}
function stopCheckoutTimers(){
  if(checkoutTimer)clearInterval(checkoutTimer);
  if(paymentPoller)clearInterval(paymentPoller);
  checkoutTimer=null;paymentPoller=null;
}
function money(value){return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(value);}
function updateCartBadge(){
  const count=document.querySelector("#cart-count"),access=document.querySelector("#cart-access");
  if(count)count.textContent=String(basket?.quantity??0);
  if(access)access.setAttribute("aria-label",`Carrito, ${basket?.quantity??0} ${(basket?.quantity??0)===1?"entrada":"entradas"}`);
}
function saveBasket(value){
  basket=value?parseCart(value):null;
  try{if(basket)localStorage.setItem(cartStorageKey,JSON.stringify(basket));else localStorage.removeItem(cartStorageKey);}catch{/* Keep the in-memory selection. */}
  updateCartBadge();
}
function setCheckoutReturn(value){
  checkoutReturn=value;
  try{if(value)sessionStorage.setItem("sharkpass-checkout-return","1");else sessionStorage.removeItem("sharkpass-checkout-return");}catch{/* The current flow can still continue. */}
}
function checkoutSteps(current){
  const nav=el("ol",null,{class:"checkout-steps","aria-label":"Pasos de tu compra"});
  for(const [i,label]of["Entradas","Carrito","Tus datos","Pago"].entries()){
    const item=el("li",null,{class:i<current?"complete":i===current?"current":""});
    item.append(el("span",String(i+1),{"aria-hidden":"true"}),el("span",label));
    if(i===current)item.setAttribute("aria-current","step");nav.append(item);
  }
  return nav;
}
function sandboxNotice(event){
  return event.is_demo?el("p","EVENTO DEMO · Solo para probar el sistema. No es una actividad real.",{class:"checkout-callout"}):null;
}
function pricingText(pricing,quantity=1,total=pricing?.totalCop*quantity){
 const amounts=summarizePricing(pricing,quantity,total);
 return amounts?`Base ${money(amounts.baseCop)} + IVA (${amounts.vatRate}%) ${money(amounts.vatCop)} = Total ${money(amounts.totalCop)}`:`Total ${money(total)} · Sin desglose de IVA registrado`;
}
function pricingLines(pricing,quantity,total){
 const lines=el("dl",null,{class:"checkout-totals price-breakdown"}),amounts=summarizePricing(pricing,quantity,total);
 if(amounts)lines.append(el("dt","Precio base"),el("dd",money(amounts.baseCop)),el("dt",`IVA (${amounts.vatRate}%)`),el("dd",money(amounts.vatCop)));
 else lines.append(el("dt","Desglose de IVA"),el("dd","No registrado en esta compra original"));
 lines.append(el("dt","Total · COP",{class:"checkout-total-label"}),el("dd",money(total),{class:"checkout-total"}));
 return lines;
}
function checkoutSummary(event,type,quantity,total){
  const aside=el("aside",null,{class:"checkout-summary","aria-label":"Resumen de tu compra"});
  aside.append(el("h2","Resumen de compra"));
  const head=el("div",null,{class:"checkout-summary-event"});
  if(event.image)head.append(el("img",null,{src:event.image,alt:`Portada de ${event.title}`}));
  const info=el("div");info.append(el("h3",event.title),el("p",fmtDate(event.starts_at)),el("p",event.venue));head.append(info);aside.append(head);
  const lines=pricingLines(type.pricing,quantity,total);
  aside.append(el("p",`${quantity} × ${type.name}`));
  const seatNames=event.seats?.filter(seat=>basket?.seatIds?.includes(seat.id)).map(seat=>seat.row+seat.number)??[];
  if(seatNames.length)aside.append(el("p",`Sillas: ${seatNames.join(", ")}`,{class:"cart-seat-labels"}));
  aside.append(lines,el("p",type.pricing?"El total incluye el IVA desglosado arriba. Sin cargos de servicio adicionales.":"Esta compra conserva su importe original. No se ha añadido IVA retroactivamente.",{class:"checkout-fine-print"}));
  const note=sandboxNotice(event);if(note)aside.append(note);
  const breakdown=el("details",null,{class:"order-breakdown"});breakdown.open=!matchMedia("(max-width:780px)").matches;
  const overview=el("summary");overview.append(el("span",event.title),el("strong",`${quantity} ${quantity===1?"entrada":"entradas"} · ${money(total)}`),el("small","Ver datos del evento"));
  const detail=el("div");detail.append(head);breakdown.append(overview,detail);aside.insertBefore(breakdown,lines);
  return aside;
}
async function cartPayment(){
  if(!basket||!me||!paymentsConfigured)return null;
  try{
    let payment=await request(`payments/by-key/${basket.key}`);
    if(["expired","failed"].includes(payment.state))payment=await request(`payments/${payment.id}/refresh`,"POST",{transactionId:params.get("payment")===payment.id?params.get("id"):null});
    if(!sameSelection(basket,payment))return null;
    if(basket.paymentId!==payment.id)saveBasket({...basket,paymentId:payment.id});
    return payment;
  }catch(error){if(error.status===404)return null;throw error;}
}
async function releaseCartReservation(){
  let payment=await cartPayment();
  if(payment?.state==="pending")payment=await request(`payments/${payment.id}/refresh`,"POST",{transactionId:params.get("payment")===payment.id?params.get("id"):null});
  if(payment?.state==="confirmed"){
    await paymentDetail(payment.id);
    throw new Error("Esta compra ya se confirmó. Tus entradas están disponibles en Mis entradas.");
  }
  if(payment?.state==="review")throw new Error("Este pago necesita revisión antes de preparar otra compra.");
  if(payment?.state==="pending"){
    if(!confirm("Cambiar tu selección cancela la reserva actual. Si ya pagaste en Wompi, vuelve a comprobar el estado antes de continuar. ¿Liberar la reserva?"))throw new Error("Tu reserva se conserva. Puedes retomar el pago desde el carrito.");
    await request(`payments/${payment.id}/cancel`,"POST",{});
  }
}
async function changeBasket(next){
  if(cartMutating)return false;
  cartMutating=true;
  try{await releaseCartReservation();saveBasket(next?{version:1,eventId:next.eventId,typeId:next.typeId,quantity:next.quantity,...(next.seatIds?{seatIds:next.seatIds}:{}),key:crypto.randomUUID()}:null);return true;}
  finally{cartMutating=false;}
}
async function addToBasket(event,type,quantity){
  if(basket&&(basket.eventId!==event.id||basket.typeId!==type.id)){
    if(!confirm("El carrito admite un evento y una localidad por compra. ¿Reemplazar tu selección actual?"))return;
  }else if(basket){quantity+=basket.quantity;}
  if(quantity>6)throw new Error("Puedes elegir hasta 6 entradas por compra.");
  if(quantity>type.available)throw new Error("La cantidad elegida supera la disponibilidad actual.");
  if(await changeBasket({eventId:event.id,typeId:type.id,quantity}))await show("cart");
}
async function cartContext(){
  if(!basket)return null;
  const event=await request(`events/${basket.eventId}`);
  const type=event.types.find(t=>t.id===basket.typeId);
  if(!type){const error=new Error("La localidad seleccionada ya no está disponible. Elige tus entradas de nuevo.");error.status=404;throw error;}
  const payment=await cartPayment();
  const available=type.available+(payment?.state==="pending"?payment.quantity:0);
  return {event,type:payment?.state==="pending"?{...type,pricing:payment.pricing}:type,payment,available,total:payment?.state==="pending"?payment.totalCop:type.price_cop*basket.quantity};
}
function emptyCart(){
  heading("Tu carrito","Tu próximo gran plan empieza con una entrada.");
  const empty=el("section",null,{class:"checkout-empty"});
  empty.append(el("span","01",{class:"checkout-empty-mark","aria-hidden":"true"}),el("h2","Aún no has elegido tus entradas"),el("p","Explora los eventos y añade la localidad y la cantidad que quieras."),button("Explorar eventos",()=>show("events")));
  content.append(empty);
}
async function cartScreen(){
  if(!basket)return emptyCart();
  let ctx;
  try{ctx=await cartContext();}catch(error){
    if(error.status!==404)throw error;
    heading("Tu selección ya no está disponible","El evento o la localidad cambió desde que añadiste las entradas.");
    content.append(button("Quitar selección",async()=>{if(await changeBasket(null))await show("cart");}),button("Explorar eventos",()=>show("events"),"secondary"));return;
  }
  if(ctx.payment?.state==="confirmed")return paymentDetail(ctx.payment.id);
  heading("Tu carrito","Revisa la localidad y la cantidad antes de continuar.");
  content.append(checkoutSteps(1));
  const layout=el("div",null,{class:"checkout-layout"}),main=el("section",null,{class:"checkout-main"});
  const item=el("article",null,{class:"cart-item"});
  if(ctx.event.image)item.append(el("img",null,{src:ctx.event.image,alt:`Portada de ${ctx.event.title}`,class:"cart-poster"}));
  const body=el("div",null,{class:"cart-item-body"});
  body.append(el("p",ctx.event.organizer,{class:"eyebrow"}),el("h2",ctx.event.title),el("p",fmtDate(ctx.event.starts_at)),el("p",ctx.event.venue,{class:"muted"}));
  const label=el("label","Localidad"),select=el("select",null,{"aria-label":"Localidad del carrito"});
  for(const type of ctx.event.types){const option=el("option",`${type.name} · ${price(type.price_cop)}`,{value:type.id});option.disabled=type.available===0&&type.id!==ctx.type.id;select.append(option);}
  select.value=ctx.type.id;
  if(basket.seatIds)select.disabled=true;
  select.addEventListener("change",async()=>{
    try{const next=ctx.event.types.find(t=>t.id===select.value);if(await changeBasket({eventId:ctx.event.id,typeId:next.id,quantity:Math.min(basket.quantity,Math.max(1,next.available))}))await show("cart");}
    catch(error){select.value=ctx.type.id;
  if(basket.seatIds)select.disabled=true;inform(error.message);}
  });label.append(select);body.append(label);
  const quantity=el("div",null,{class:"cart-quantity","aria-label":"Cantidad de entradas"});
  const setQuantity=async value=>{if(await changeBasket({...basket,quantity:value}))await show("cart");};
  const minus=button("−",()=>setQuantity(basket.quantity-1),"quantity-button");minus.setAttribute("aria-label","Disminuir cantidad");minus.disabled=basket.quantity<=1;
  const count=el("span",String(basket.quantity),{"aria-label":`${basket.quantity} ${basket.quantity===1?"entrada":"entradas"}`});
  const plus=button("+",()=>setQuantity(basket.quantity+1),"quantity-button");plus.setAttribute("aria-label","Aumentar cantidad");plus.disabled=basket.quantity>=Math.min(6,ctx.available);
  quantity.append(minus,count,plus,el("span",pricingText(ctx.type.pricing,1,ctx.payment?.state==="pending"?ctx.payment.totalCop/ctx.payment.quantity:ctx.type.price_cop),{class:"quantity-price"}));
  if(basket.seatIds){minus.disabled=true;plus.disabled=true;body.append(el("p",`Sillas: ${ctx.event.seats.filter(seat=>basket.seatIds.includes(seat.id)).map(seat=>seat.row+seat.number).join(", ")}`,{class:"cart-seat-labels"}),button("Cambiar sillas",async()=>{if(await changeBasket(null))await eventDetail(ctx.event.id);},"secondary"));}
  body.append(quantity,button("Eliminar del carrito",async()=>{if(await changeBasket(null))await show("cart");},"text-button cart-remove"));item.append(body);main.append(item);
  main.append(el("p","Puedes comprar hasta 6 entradas de una localidad por pedido.",{class:"checkout-fine-print"}));
  const sufficient=ctx.available>=basket.quantity;
  if(!sufficient)main.append(el("p","La disponibilidad cambió. Reduce la cantidad o elige otra localidad.",{class:"checkout-callout"}));
  const aside=checkoutSummary(ctx.event,ctx.type,basket.quantity,ctx.total);
  aside.append(el("p","Boletas digitales · Un QR por entrada",{class:"checkout-assurance"}));
  const continuePurchase=async()=>{
    if(ctx.payment?.state==="pending")return paymentDetail(ctx.payment.id);
    await show("checkout");
  };
  const next=button(ctx.payment?.state==="pending"?"Retomar mi pago":"Continuar con mis datos",continuePurchase,"checkout-primary");next.disabled=!sufficient||ctx.payment?.state==="review";aside.append(next);
  aside.append(el("p",ctx.payment?.state==="pending"?"Tu reserva conserva su vencimiento original.":"La selección aún no reserva cupo. Lo confirmaremos al preparar el pago.",{class:"checkout-fine-print"}));
  main.append(button("Ver el evento",()=>eventDetail(ctx.event.id),"secondary"));layout.append(main,aside);content.append(layout);
  const mobileBar=el("div",null,{class:"mobile-purchase-bar"});
  const amount=el("div");amount.append(el("small",`${basket.quantity} entradas · Total COP`),el("strong",money(ctx.total)));
  const mobileNext=button(ctx.payment?.state==="pending"?"Retomar pago":"Continuar",continuePurchase,"checkout-primary");mobileNext.disabled=next.disabled;
  mobileBar.append(amount,mobileNext);content.append(mobileBar);
}
async function checkoutScreen(){
  if(!basket)return emptyCart();
  await loadMe();
  if(!me){setCheckoutReturn(true);return authScreen("login");}
  let ctx;
  try{ctx=await cartContext();}catch(error){if(error.status===404)return cartScreen();throw error;}
  if(ctx.payment && !["expired","failed","voided"].includes(ctx.payment.state))return paymentDetail(ctx.payment.id);
  if(ctx.payment){saveBasket({...basket,key:crypto.randomUUID(),paymentId:undefined});}
  heading("Completa tu compra","Tus entradas llegarán al correo que indiques aquí.");content.append(checkoutSteps(2));
  const layout=el("div",null,{class:"checkout-layout"}),main=el("section",null,{class:"checkout-main"});
  const profile=await request("account/profile"),paid=ctx.type.price_cop>0;
  const f=form(async data=>{
    if(data.email.trim().toLowerCase()!==data.confirmEmail.trim().toLowerCase()) throw new Error("Los correos no coinciden. Revísalos para recibir tus entradas.");
    if(data.fullName!==profile.fullName||data.phone!==profile.phone)await request("account/profile","PUT",{fullName:data.fullName,phone:data.phone});
    const registration=ctx.event.saleRules?.requireAttendees?{attendees:Array.from({length:basket.quantity},(_,i)=>data[`attendee${i}`]),termsVersion:ctx.event.saleRules.version,acceptTerms:data.acceptTerms==="on"}:{};
    if(paid){
      const payment=await request("payments/checkout","POST",{eventId:basket.eventId,typeId:basket.typeId,quantity:basket.quantity,email:data.email,...registration,...(basket.seatIds?{seatIds:basket.seatIds}:{})},{"Idempotency-Key":basket.key});
      saveBasket({...basket,paymentId:payment.id});await paymentDetail(payment.id);
    }else{
      const order=await request("orders","POST",{eventId:basket.eventId,typeId:basket.typeId,quantity:basket.quantity,email:data.email,...registration,...(basket.seatIds?{seatIds:basket.seatIds}:{})},{"Idempotency-Key":basket.key});
      saveBasket(null);setCheckoutReturn(false);await orderDetail(order.id);inform("Entradas gratuitas confirmadas. No se realizó ningún cobro.");
    }
  },paid?"Revisar y preparar el pago":"Confirmar entradas gratuitas");f.className="checkout-buyer-form";
  f.append(el("p","01 / QUIÉN COMPRA",{class:"checkout-section-label"}),el("h2","Tus datos"),el("p",`Tu cuenta: ${me.email || me.fullName || "SharkPass"}`,{class:"checkout-fine-print"}));
  const fullName=field(f,"Nombre completo","fullName","text",profile.fullName);fullName.minLength=2;fullName.maxLength=120;fullName.autocomplete="name";
  const phone=field(f,"Teléfono","phone","tel",profile.phone);phone.minLength=10;phone.maxLength=24;phone.autocomplete="tel";
  {
    f.append(el("div","02 / DÓNDE RECIBIRÁS TUS ENTRADAS",{class:"checkout-section-label checkout-section-break"}));
    const email=field(f,"Correo del comprador","email","email",accountEmail?.email??me.email??"");email.autocomplete="email";email.maxLength=254;email.placeholder="tu@correo.com";
    f.append(el("p","Enviaremos la confirmación y el acceso a todas las boletas a este correo.",{class:"checkout-field-help"}));
    const confirmEmail=field(f,"Confirma tu correo","confirmEmail","email");confirmEmail.maxLength=254;confirmEmail.placeholder="Escribe el mismo correo de nuevo";confirmEmail.autocomplete="off";
    const validateEmail=()=>confirmEmail.setCustomValidity(confirmEmail.value && email.value.trim().toLowerCase()!==confirmEmail.value.trim().toLowerCase()?"Los correos no coinciden.":"");
    email.addEventListener("input",validateEmail);confirmEmail.addEventListener("input",validateEmail);
  }
  f.append(el("p","Los datos de nombre y teléfono también quedarán actualizados en tu perfil.",{class:"checkout-fine-print"}),el("div","03 / TUS BOLETAS, CONTIGO",{class:"checkout-section-label checkout-section-break"}),el("h2","Entrega digital"),el("p","Al confirmar la compra, tendrás un QR individual por boleta en Mis entradas. Puedes guardar cada una o compartirla con quien te acompañe."));
  if(paid)f.append(el("p","En el siguiente paso revisarás la reserva y continuarás al pago seguro en Wompi."));
  if(ctx.event.saleRules?.requireAttendees){
    const group=el("fieldset",null,{class:"attendee-registration"});group.append(el("legend","Registro de asistentes"),el("p","Un registro por entrada. Usa el nombre que aparece en el documento de identidad. No solicitamos su número aquí.",{class:"checkout-field-help"}));
    const labels=ctx.event.seats?.filter(seat=>basket.seatIds?.includes(seat.id))??[];
    for(let i=0;i<basket.quantity;i++){const name=field(group,`Asistente ${i+1}${labels[i]?` · Silla ${labels[i].row}${labels[i].number}`:""}: nombre completo`,`attendee${i}`);name.minLength=2;name.maxLength=120;name.autocomplete="off";}
    const rules=el("ul",null,{class:"event-terms"});for(const term of ctx.event.saleRules.terms)rules.append(el("li",term));group.append(rules);const label=el("label",null,{class:"terms-acceptance"}),check=el("input",null,{type:"checkbox",name:"acceptTerms",required:""});label.append(check,el("span","He leído y acepto las condiciones. Todos los asistentes tienen 8 años o más."));group.append(label);f.append(group);
  }
  f.appendSubmit();
  f.append(el("p",paid?"Aún no realizarás un cobro. Primero revisarás la reserva y continuarás a Wompi.":"No necesitas tarjeta para confirmar estas entradas.",{class:"checkout-field-help"}));
  f.querySelector("button[type=submit]").disabled=ctx.available<basket.quantity||(paid&&(!paymentsConfigured||(paymentEnvironment==="test"&&!ctx.event.is_demo)));
  const overview=el("div",null,{class:"checkout-order-strip"});
  overview.append(el("strong",ctx.event.title),el("span",`${basket.quantity} × ${ctx.type.name} · ${money(ctx.total)}`));
  if(basket.seatIds)overview.append(el("span",`Sillas ${ctx.event.seats.filter(seat=>basket.seatIds.includes(seat.id)).map(seat=>seat.row+seat.number).join(", ")}`));
  main.append(overview,f,button("Volver al carrito",()=>show("cart"),"secondary"));layout.append(main,checkoutSummary(ctx.event,ctx.type,basket.quantity,ctx.total));content.append(layout);
  const mobileBar=el("div",null,{class:"mobile-purchase-bar"}),amount=el("div");amount.append(el("small",`${basket.quantity} entradas · Total COP`),el("strong",money(ctx.total)));
  const mobileNext=button(paid?"Continuar al pago":"Confirmar entradas",()=>f.requestSubmit(),"checkout-primary");mobileNext.disabled=f.querySelector("button[type=submit]").disabled;
  mobileBar.append(amount,mobileNext);content.append(mobileBar);
}

async function eventDetail(id,adminPreview=false) {
  if(previewMode)return previewEventDetail(id);
  stopCheckoutTimers();
  const event=await request(adminPreview?`admin/events/${id}/preview`:`events/${id}`);
  heading(event.title,event.category??"Encuentra tu próximo momento");
  document.body.dataset.view="detail";history.replaceState(null,"",adminPreview?`/?previewEvent=${id}`:`/evento/${id}`);
  const layout=el("div",null,{class:"purchase-event-layout"}),story=el("section",null,{class:"purchase-event-story"});
  if(event.image)story.append(el("img",null,{src:event.image,alt:`Portada de ${event.title}`,class:"purchase-event-poster"}));
  const facts=el("dl",null,{class:"event-purchase-facts"});
  for(const [label,value] of [["Fecha y hora",fmtDate(event.starts_at)],["Lugar",event.venue],["Organiza",event.organizer]])facts.append(el("dt",label),el("dd",value));
  story.append(facts,el("h2","Acerca del evento"),el("p",event.description));
  if(event.saleRules){const rules=el("section",null,{class:"event-conditions"});rules.append(el("h2","Condiciones de ingreso"));const list=el("ul");for(const term of event.saleRules.terms)list.append(el("li",term));rules.append(list);story.append(rules);}
  if(adminPreview)story.prepend(el("p","VISTA PREVIA ADMINISTRATIVA · El evento permanece en borrador. Esta vista no permite compras.",{class:"checkout-callout"}));
  const notice=sandboxNotice(event);if(notice)story.append(notice);
  const purchase=el("aside",null,{class:"event-ticket-picker"});purchase.append(el("p","TU ENTRADA A VIVIRLO",{class:"eyebrow"}),el("h2","Elige tus entradas"));
  if(!event.types.length){purchase.append(el("p","Las entradas aún no están disponibles."));}
  else if(event.seats?.length){
    purchase.append(el("p","Escoge tus puestos en el mapa. Un QR por silla y un solo ingreso por entrada.",{class:"checkout-fine-print"}));
    const availability=el("dl",null,{class:"seated-availability"});for(const type of event.types)availability.append(el("dt",type.name),el("dd",`${pricingText(type.pricing)} · ${type.available} disponibles`));purchase.append(availability,el("p","Precio base e IVA detallados por entrada. Sin cargos de servicio adicionales. Únicamente ingreso al evento.",{class:"checkout-fine-print"}),button("Elegir mis sillas",()=>{const target=story.querySelector(".seat-picker");target.scrollIntoView({block:"start",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});target.querySelector(".seat-map-scroll").focus({preventScroll:true});},"checkout-primary"));
    mountSeatPicker(story,event,{el,button,money,onChoose:async(type,seatIds)=>{if(adminPreview)throw new Error("Vista previa: la venta aún no está habilitada.");if(await changeBasket({eventId:event.id,typeId:type.id,quantity:seatIds.length,seatIds}))await show("cart");}});
  }
  else{
    const f=form(async data=>{
      const type=event.types.find(t=>t.id===data.typeId);
      if(!type)throw new Error("Elige una localidad.");
      await addToBasket(event,type,Number(data.quantity));
    },"Añadir al carrito");f.className="ticket-selection-form";
    const types=el("fieldset",null,{class:"ticket-options"});types.append(el("legend","Localidad"));
    const selected=event.types.find(t=>t.id===basket?.typeId&&t.available>0)??event.types.find(t=>t.available>0);
    const quantityLabel=el("label","Cantidad"),quantities=el("select",null,{name:"quantity",required:""});
    const updateQuantity=()=>{
      const type=event.types.find(t=>t.id===f.elements.typeId.value);const max=Math.min(6,type?.available??0);quantities.replaceChildren();
      for(let q=1;q<=max;q++)quantities.append(el("option",`${q} ${q===1?"entrada":"entradas"}`,{value:String(q)}));
      f.querySelector("button[type=submit]").disabled=max===0;
      total.textContent=max?pricingText(type.pricing,Number(quantities.value),type.price_cop*Number(quantities.value)):"Sin disponibilidad";
    };
    for(const type of event.types){
      const label=el("label",null,{class:`ticket-option ${type.available===0?"sold-out":""}`});
      const radio=el("input",null,{type:"radio",name:"typeId",value:type.id,required:""});radio.checked=type.id===selected?.id;radio.disabled=type.available===0;
      const info=el("span",null,{class:"ticket-option-copy"});info.append(el("strong",type.name),el("small",type.available>0?`${type.available} disponibles`:"Agotado"));
      label.append(radio,info,el("strong",pricingText(type.pricing),{class:"ticket-option-price"}));radio.addEventListener("change",updateQuantity);types.append(label);
    }
    const total=el("strong",null,{class:"picker-total"});quantityLabel.append(quantities);f.append(types,quantityLabel,el("p","Un evento y una localidad por compra. Hasta 6 entradas.",{class:"checkout-fine-print"}),total);f.appendSubmit();
    quantities.addEventListener("change",()=>{const type=event.types.find(t=>t.id===f.elements.typeId.value);total.textContent=pricingText(type.pricing,Number(quantities.value),type.price_cop*Number(quantities.value));});
    purchase.append(f,el("p","Podrás revisar tu carrito antes de iniciar sesión o pagar.",{class:"checkout-fine-print"}));updateQuantity();
    const section=el("section",null,{class:"locality-prices","aria-labelledby":"locality-prices-title"});section.append(el("p","ELIGE TU EXPERIENCIA",{class:"eyebrow"}),el("h2","Ubicación y precio",{id:"locality-prices-title"}),el("p","Compara las localidades antes de elegir. Valores por entrada en pesos colombianos.",{class:"locality-intro"}));
    const table=el("table"),caption=el("caption","Localidades y disponibilidad actual");table.append(caption);const head=el("thead"),tr=el("tr");for(const name of ["Localidad","Precio COP","Disponibles","Elegir"])tr.append(el("th",name,{scope:"col"}));head.append(tr);table.append(head);const tbody=el("tbody");
    for(const type of event.types){const row=el("tr");row.append(el("th",type.name,{scope:"row"}),el("td",pricingText(type.pricing)),el("td",type.available>0?String(type.available):"Agotado"));const action=el("td");const choose=button("Elegir",()=>{for(const radio of types.querySelectorAll("input"))radio.checked=radio.value===type.id;updateQuantity();purchase.scrollIntoView({block:"start",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});quantities.focus({preventScroll:true});},"locality-choose");choose.setAttribute("aria-label",`Elegir ${type.name}`);choose.disabled=type.available===0;action.append(choose);row.append(action);tbody.append(row);}table.append(tbody);const scroll=el("div",null,{class:"locality-table-wrap"});scroll.append(table);section.append(scroll,el("p","El total actual corresponde a las entradas seleccionadas, sin cargos de servicio adicionales. La disponibilidad se vuelve a comprobar al preparar tu compra.",{class:"checkout-fine-print"}));
    if(event.is_demo)section.append(el("p","En esta prueba compras por localidad. El mapa de puestos es una demostración independiente y no asigna sillas a las boletas.",{class:"checkout-callout"}));story.append(section);
  }
  if(event.is_demo)purchase.append(el("a","Probar mapa de asientos →",{href:"/asientos-demo.html",class:"seat-demo-link"}),el("p","Demo visual independiente. No reserva puestos ni modifica esta compra.",{class:"checkout-fine-print"}));
  layout.append(story,purchase);content.append(checkoutSteps(0),layout,button("Explorar otros eventos",()=>show("events"),"secondary back-link"));
}

function accountIcon(name){
  const paths={user:'<circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',ticket:'<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4Z"/><path d="M15 5v3m0 3v2m0 3v3"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',exit:'<path d="M9 5H5v14h4m5-14 7 7-7 7m-5-7h12"/>',compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5Z"/>',shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>'};
  const span=el("span",null,{class:"account-icon","aria-hidden":"true"});
  span.innerHTML=`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name]??paths.user}</svg>`;
  return span;
}
function accountFeedback(node,text,kind="success"){
  node.hidden=false;node.dataset.kind=kind;node.setAttribute("role",kind==="error"?"alert":"status");node.textContent=text;
  if(kind==="error")node.focus();
}
async function account() {
  if(!me)return authScreen(authMode);
  const profile=await request("account/profile"),verified=Boolean(accountEmail),pending=pendingAccountEmail;
  document.body.dataset.view="account";delete document.body.dataset.auth;
  heading("Mi cuenta","Tus datos y tus próximos planes, en un solo lugar.");
  content.classList.add("account-workspace");
  const firstName=()=>((profile.fullName||"").trim().split(/\s+/)[0]);
  const title=content.querySelector("h1");title.textContent=firstName()?`Hola, ${firstName()}.`:"Tu cuenta, tus planes.";
  content.querySelector(".eyebrow").textContent="TU ESPACIO SHARKPASS";
  const layout=el("div",null,{class:"account-layout"}),sidebar=el("aside",null,{class:"account-sidebar","aria-label":"Tu perfil y accesos"});
  const identity=el("section",null,{class:"account-identity"});
  const initials=()=>profile.fullName?profile.fullName.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join("").toUpperCase():"SP";
  const avatar=el("span",initials(),{class:"account-avatar","aria-hidden":"true"}),identityName=el("h2",profile.fullName||"Tu perfil"),badge=el("span",verified?"Correo verificado":pending?"Verificación pendiente":"Verifica tu correo",{class:`account-badge ${verified?"verified":"pending"}`});
  identity.append(avatar,identityName,el("p","Tu entrada a vivirlo.",{class:"account-identity-caption"}),badge);
  const shortcuts=el("nav",null,{class:"account-shortcuts","aria-label":"Accesos de tu cuenta"});
  for(const [label,view,icon]of[["Mis entradas","orders","ticket"],["Favoritos","favorites","heart"],["Explorar eventos","events","compass"]]){
    const item=button(label,()=>show(view),"account-shortcut");item.prepend(accountIcon(icon));item.append(accountIcon("arrow"));shortcuts.append(item);
  }
  if(platformAdmin){const item=button("Administración",()=>show("admin"),"account-shortcut");item.prepend(accountIcon("shield"));shortcuts.append(item);}
  const logout=button("Cerrar sesión",async()=>{await request("logout","POST",{});await loadMe();await show("events");},"account-signout");logout.prepend(accountIcon("exit"));
  sidebar.append(identity,shortcuts,logout);
  const main=el("div",null,{class:"account-panels"});
  const tickets=el("section",null,{class:"account-ticket-banner"});
  const ticketCopy=el("div");ticketCopy.append(el("p","QUE EL PLAN SEA VIVIRLO",{class:"account-kicker"}),el("h2","Tus boletas, siempre contigo."),el("p","Abre tus entradas, guarda cada QR y comparte una boleta con quien te acompañe."));
  const ticketAction=button("Ver mis entradas",()=>show("orders"),"account-ticket-action");ticketAction.append(accountIcon("arrow"));tickets.append(accountIcon("ticket"),ticketCopy,ticketAction);main.append(tickets);
  const personal=el("section",null,{class:"account-panel","aria-labelledby":"account-personal-title"});
  const panelHead=el("div",null,{class:"account-panel-heading"}),panelCopy=el("div");panelCopy.append(el("h2","Datos personales",{id:"account-personal-title"}),el("p","Tu información para las próximas experiencias."));
  const summary=el("dl",null,{class:"account-summary"}),summaryName=el("dd",profile.fullName||"Añade tu nombre"),summaryPhone=el("dd",profile.phone||"Añade tu teléfono");summary.append(el("dt","Nombre completo"),summaryName,el("dt","Teléfono"),summaryPhone);
  const personalStatus=el("p",null,{class:"account-feedback",role:"status",tabindex:"-1",hidden:""});
  let nameInput,phoneInput;
  const details=form(async(data)=>{
    personalStatus.hidden=true;
    try{
      const updated=await request("account/profile","PUT",data);Object.assign(profile,updated);me.fullName=profile.fullName;updateSessionIdentity();
      summaryName.textContent=profile.fullName;summaryPhone.textContent=profile.phone;identityName.textContent=profile.fullName;avatar.textContent=initials();title.textContent=`Hola, ${firstName()}.`;
      closeEdit();accountFeedback(personalStatus,"Listo. Tus datos se guardaron correctamente.");edit.focus();
    }catch(error){accountFeedback(personalStatus,error.message,"error");}
  },"Guardar cambios");details.className="account-form";details.id="account-profile-edit";details.hidden=true;
  const edit=button("Editar datos",()=>{
    if(!details.hidden){closeEdit();return;}
    details.hidden=false;summary.hidden=true;personalStatus.hidden=true;edit.textContent="Cerrar edición";edit.setAttribute("aria-expanded","true");nameInput.focus();
  },"account-edit");edit.setAttribute("aria-expanded","false");edit.setAttribute("aria-controls",details.id);
  function closeEdit(){details.hidden=true;summary.hidden=false;edit.textContent="Editar datos";edit.setAttribute("aria-expanded","false");nameInput.value=profile.fullName;phoneInput.value=profile.phone;}
  nameInput=field(details,"Nombre completo","fullName","text",profile.fullName);nameInput.minLength=2;nameInput.maxLength=120;nameInput.autocomplete="name";
  phoneInput=field(details,"Teléfono","phone","tel",profile.phone);phoneInput.minLength=10;phoneInput.maxLength=24;phoneInput.autocomplete="tel";
  details.append(el("p","Incluye el código de país si usas un número internacional.",{class:"account-help"}));details.appendSubmit();
  const cancel=button("Cancelar",()=>{closeEdit();personalStatus.hidden=true;edit.focus();},"account-cancel");details.append(cancel);
  panelHead.append(accountIcon("user"),panelCopy,edit);personal.append(panelHead,summary,details,personalStatus);main.append(personal);
  const emailPanel=el("section",null,{class:"account-panel account-email-panel","aria-labelledby":"account-email-title"}),emailHead=el("div",null,{class:"account-panel-heading"}),emailCopy=el("div");emailCopy.append(el("h2","Correo y acceso",{id:"account-email-title"}),el("p","Para entrar y recuperar tu cuenta."));emailHead.append(accountIcon("mail"),emailCopy);emailPanel.append(emailHead);
  const emailNotice=el("div",null,{class:`account-email-notice ${verified?"verified":"pending"}`,role:"status"});
  const emailNoticeTitle=el("strong",verified?"Tu correo está verificado":pending?"Revisa tu bandeja de entrada":"Dale el último paso a tu cuenta");
  const emailNoticeText=el("p",verified?accountEmail.email:pending?`Enviamos un enlace a ${pending.email}. Ábrelo para confirmar que ese correo es tuyo.`:"Verifica tu correo para entrar con él y recuperar el acceso cuando lo necesites.");emailNotice.append(accountIcon("shield"),el("div"));emailNotice.lastChild.append(emailNoticeTitle,emailNoticeText);emailPanel.append(emailNotice);
  const emailStatus=el("p",null,{class:"account-feedback",role:"status",tabindex:"-1",hidden:""});
  const contact=form(async(data)=>{
    emailStatus.hidden=true;
    try{
      await request("account/email","POST",data);pendingAccountEmail={email:data.email.trim().toLowerCase()};
      accountFeedback(emailStatus,`Enlace enviado a ${pendingAccountEmail.email}. Revisa tu bandeja y Spam. Es válido durante 15 minutos.`);
      emailNoticeTitle.textContent="Revisa tu bandeja de entrada";emailNoticeText.textContent=`Abre el enlace que enviamos a ${pendingAccountEmail.email}. Usa el mensaje más reciente si solicitaste otro.`;
      contact.querySelector("button[type=submit]").textContent="Reenviar verificación";
      if(!verified)badge.textContent="Verificación pendiente";
    }catch(error){accountFeedback(emailStatus,error.message,"error");}
  },pending?"Reenviar verificación":"Enviar enlace de verificación");contact.className="account-form";contact.id="account-email-edit";
  const emailInput=field(contact,"Correo electrónico","email","email",pending?.email??accountEmail?.email??me.email??"");emailInput.autocomplete="email";emailInput.maxLength=254;emailInput.placeholder="tu@correo.com";
  contact.append(el("p","Tu correo se actualizará cuando abras el enlace de verificación.",{class:"account-help"}));contact.appendSubmit();
  if(verified){
    contact.hidden=true;const change=button("Cambiar correo",()=>{contact.hidden=!contact.hidden;change.setAttribute("aria-expanded",String(!contact.hidden));change.textContent=contact.hidden?"Cambiar correo":"Cerrar edición";if(!contact.hidden)emailInput.focus();},"account-edit");change.setAttribute("aria-expanded","false");change.setAttribute("aria-controls",contact.id);emailHead.append(change);
    if(pending)emailPanel.append(el("p",`Cambio pendiente: ${pending.email}. Confirma el enlace que enviamos a esa dirección.`,{class:"account-help"}));
  }
  if(emailConfigured)emailPanel.append(contact,emailStatus);
  else emailPanel.append(el("p","La verificación por correo no está disponible en este momento. Inténtalo más tarde.",{class:"account-help"}));
  main.append(emailPanel,el("p","¿Necesitas ayuda con tus entradas? Escríbenos a ",{class:"account-support"}));
  main.lastChild.append(el("a","soporte@sharkpass.co",{href:"mailto:soporte@sharkpass.co"}));layout.append(sidebar,main);content.append(layout);
}
function linkLegacyEmail() {
  heading("Activa el acceso con correo","Si tu cuenta anterior solo tenía usuario, verifica tu correo una vez para conservar tus compras.");
  const f=form(async data=>{
    await request("login","POST",{username:data.username,password:data.password});
    await loadMe();
    const result=await request("account/email","POST",{email:data.email});
    await show("account");inform(result.message);
  },"Enviar enlace de verificación");
  field(f,"Usuario anterior","username").autocomplete="username";
  const password=field(f,"Contraseña actual","password","password");password.autocomplete="current-password";
  field(f,"Tu correo electrónico","email","email").autocomplete="email";
  f.appendSubmit();content.append(f,button("Volver al acceso con correo",()=>authScreen("login"),"secondary"));
}
function authScreen(mode = "login") {
  authMode = mode;
  if (!previewMode) {
    const target=new URLSearchParams({view:"account"});
    if(mode==="register")target.set("auth","register");
    for(const name of ["payment","order","previewEvent"]){const value=params.get(name);if(value&&/^[a-f0-9-]{36}$/i.test(value))target.set(name,value);}
    const provider=params.get("id");if(target.has("payment")&&provider&&/^[a-zA-Z0-9-]{1,100}$/.test(provider))target.set("id",provider);
    history.replaceState(null,"",`/?${target}`);
  }
  document.body.dataset.auth = "true";
  const register = mode === "register",
    recover = mode === "recover";
  heading(
    recover
      ? "¿Olvidaste tu contraseña?"
      : register
        ? "Crea tu cuenta"
        : "Inicia sesión",
    recover
      ? "Te enviaremos un enlace a tu correo verificado."
      : register
        ? "Crea tu acceso y empieza a descubrir experiencias."
        : "Nos alegra verte. Vamos a empezar.",
  );
  const f = form(
    async (data) => {
      if (previewMode) {
        inform(
          "DEMO · Este formulario muestra el diseño. Sal de la demo para usar una cuenta real.",
        );
        return;
      }
      if (recover) {
        const result = await request("account/recovery-request", "POST", data);
        inform(result.message);
        return;
      }
      await request(register ? "register" : "login", "POST", data);
      if (register) await request("login", "POST", data);
      await loadMe();
      let verificationMessage = "";
      if(register && emailConfigured){
        try {await request("account/email","POST",{email:data.email});verificationMessage=" Revisa tu correo para verificar la cuenta.";}
        catch {verificationMessage=" Cuenta creada. Puedes solicitar la verificación desde Mi cuenta.";}
      }
      delete document.body.dataset.auth;
      if(params.get("previewEvent"))await eventDetail(params.get("previewEvent"),true);
      else if (params.get("payment")) await paymentDetail(params.get("payment"));
      else if (params.get("order")) await orderDetail(params.get("order"));
      else if (checkoutReturn && basket) {setCheckoutReturn(false);await show("checkout");}
      else if (returnEvent) await eventDetail(returnEvent);
      else await show("account");
      inform(register ? "Cuenta creada." + verificationMessage : "Sesión iniciada.");
    },
    recover ? "Enviar enlace" : register ? "Crear cuenta" : "Iniciar sesión",
  );
  f.className = "auth-form";
  if (recover) {
    field(f, "Correo verificado", "email", "email").placeholder =
      "Escribe tu correo";
    if (!emailConfigured)
      f.append(
        el(
          "p",
          "La recuperación se habilitará cuando esté configurado el correo.",
          { class: "muted" },
        ),
      );
  } else {
    if (register) {
      field(f, "Nombre completo", "fullName").placeholder = "Escribe tu nombre";
      const phone = field(f, "Teléfono", "phone", "tel");
      phone.placeholder = "Tu número con código de país";
      phone.maxLength = 24;
    }
    const email = field(f, "Correo electrónico", "email", "email");
    email.placeholder = "tu@correo.com";
    email.maxLength = 254;
    email.autocomplete = "email";
    const pass = field(f, "Contraseña", "password", "password");
    pass.placeholder = "Escribe tu contraseña";
    pass.minLength = register ? 10 : 1;
    pass.maxLength = 256;
    pass.autocomplete = register ? "new-password" : "current-password";
    const wrap = el("span", null, { class: "password-field" });
    pass.replaceWith(wrap);
    wrap.append(pass);
    const toggle = button(
      "",
      () => {
        const visible = pass.type === "password";
        pass.type = visible ? "text" : "password";
        toggle.setAttribute(
          "aria-label",
          visible ? "Ocultar contraseña" : "Mostrar contraseña",
        );
      },
      "password-toggle",
    );
    toggle.setAttribute("aria-label", "Mostrar contraseña");
    toggle.append(
      el("img", null, {
        src: "/design/eventora/91cf0.svg",
        width: "24",
        height: "24",
        alt: "",
      }),
    );
    wrap.append(toggle);
    if (!register)
      f.append(
        button(
          "¿Olvidaste tu contraseña?",
          () => authScreen("recover"),
          "forgot-link",
        ),
      );
    else
      f.append(
        el(
          "p",
          "Usa al menos 10 caracteres. Entrarás siempre con tu correo y contraseña.",
          { class: "auth-hint" },
        ),
      );
  }
  f.appendSubmit();
  if (recover && !emailConfigured)
    f.querySelector("button[type=submit]").disabled = true;
  content.append(f);
  if (!register && !recover && !previewMode) content.append(button("Vincular correo a mi cuenta anterior",linkLegacyEmail,"text-button"));
  if (!register && !recover && !checkoutReturn) {
    const social = el("section", null, {
      class: "social-options",
      "aria-label": "Acceso social aún no disponible",
    });
    const divider = el("div", null, { class: "social-divider" });
    divider.append(
      el("img", null, {
        src: "/design/eventora/90f22.svg",
        width: "115.5",
        height: "1",
        alt: "",
      }),
      el("span", "Continuar con"),
      el("img", null, {
        src: "/design/eventora/90f22.svg",
        width: "115.5",
        height: "1",
        alt: "",
      }),
    );
    const row = el("div", null, { class: "social-row" });
    for (const [name, file] of [
      ["Google", "9c3b7.svg"],
      ["Apple", "269f3.svg"],
      ["Facebook", "1b00a.svg"],
    ]) {
      const item = el("button", null, {
        type: "button",
        disabled: "",
        "aria-label": `${name}: próximamente`,
      });
      item.append(
        el("img", null, {
          src: `/design/eventora/${file}`,
          width: "24",
          height: "24",
          alt: "",
        }),
      );
      row.append(item);
    }
    social.append(divider, row, el("p", "Acceso social aún no disponible"));
    content.append(social);
  }
  const switcher = el("div", null, { class: "auth-switch" });
  switcher.append(
    el(
      "span",
      register || recover ? "¿Ya tienes cuenta?" : "¿Aún no tienes cuenta?",
    ),
    button(
      register || recover ? "Inicia sesión" : "Crear cuenta",
      () => authScreen(register || recover ? "login" : "register"),
      "inline-link",
    ),
  );
  content.insertBefore(switcher, f);
  if(checkoutReturn && basket){
    document.body.dataset.checkoutAuth="true";
    const panel=el("section",null,{class:"checkout-login-panel"});
    while(content.firstChild)panel.append(content.firstChild);
    panel.prepend(checkoutSteps(2),el("p","Tu selección está guardada. Entra o crea tu cuenta para continuar.",{class:"checkout-callout"}));
    const story=el("aside",null,{class:"checkout-login-story"});
    story.append(el("img",null,{src:"/media/sharkpass-concert-hero-hd.webp",alt:"Concierto iluminado en azul, imagen ilustrativa"}),el("div",null,{class:"checkout-login-shade"}));
    const copy=el("div",null,{class:"checkout-login-copy"});copy.append(el("p","SHARKPASS",{class:"eyebrow"}),el("h2","Una cuenta. Todos tus momentos."),el("p","Conserva tus compras y encuentra tus entradas en un solo lugar."));story.append(copy);
    const layout=el("div",null,{class:"checkout-login-layout"});layout.append(panel,story);content.append(layout);
  }
  const returnPayment = params.get("payment");
  if (returnPayment && /^[a-f0-9-]{36}$/i.test(returnPayment))
    content.append(
      el("a", "Volver a la app SharkPass", {
        href: `sharkpass://payment?id=${encodeURIComponent(returnPayment)}`,
        class: "auth-demo-link",
      }),
    );
  if (previewMode)
    content.append(
      el("a", "Salir de la demo para usar mi cuenta", {
        href: "/?view=account",
        class: "auth-demo-link",
      }),
    );
}
async function favorites() {
  heading(
    "Favoritos",
    "Guardados en este dispositivo. No se sincronizan con tu cuenta.",
  );
  const items = previewMode ? demoEvents : await request("events");
  const grid = el("div", null, { class: "favorite-grid" });
  for (const item of items.filter((item) => savedEvents.has(item.id)))
    grid.append(eventCard(item));
  if (!grid.childElementCount) {
    const empty = el("section", null, { class: "booking-empty" });
    empty.append(
      el("h2", "Guarda los planes que te gustan"),
      el("p", "Toca el corazón de un evento para encontrarlo aquí."),
      button("Explorar eventos", () => show("events")),
    );
    grid.append(empty);
  }
  content.append(grid);
}

async function orders() {
  if(authRequired())return;
  heading("Mis entradas","Tus próximos planes y el acceso a cada boleta, en un solo lugar.");content.classList.add("orders-workspace");
  const items=await request("orders"),list=el("div",null,{class:"order-collection"});
  if(!items.length){const empty=el("section",null,{class:"wallet-empty"});empty.append(accountIcon("ticket"),el("h2","Tu próximo plan empieza aquí"),el("p","Cuando confirmes una compra, encontrarás aquí todas tus entradas."),button("Explorar eventos",()=>show("events"),"checkout-primary"));list.append(empty);}
  for(const order of items){
    const card=el("article",null,{class:"wallet-order"}),date=el("div",null,{class:"wallet-date","aria-hidden":"true"});
    date.append(el("span",new Intl.DateTimeFormat("es-CO",{day:"2-digit",timeZone:"America/Bogota"}).format(new Date(order.starts_at))),el("small",new Intl.DateTimeFormat("es-CO",{month:"short",timeZone:"America/Bogota"}).format(new Date(order.starts_at))));
    const info=el("div",null,{class:"wallet-order-info"});info.append(el("span",order.state==="confirmed"?"Confirmada":"Cancelada",{class:`wallet-status ${order.state!=="confirmed"?"inactive":""}`}),el("h2",order.title),el("p",fmtDate(order.starts_at)),el("p",order.venue),el("small",`${order.quantity} ${order.quantity===1?"entrada":"entradas"} · ${order.type_name}`));
    card.append(date,info,button("Ver entradas",()=>orderDetail(order.id),"wallet-open"));list.append(card);
  }
  content.append(list);
  if(paymentsConfigured){const attempts=(await request("payments")).filter(p=>p.state!=="confirmed");if(attempts.length){const pending=el("details",null,{class:"wallet-tools"});pending.append(el("summary",`Pagos por revisar (${attempts.length})`));for(const attempt of attempts){const row=el("div",null,{class:"wallet-payment"});row.append(el("span",`${pricingText(attempt.pricing,attempt.quantity,attempt.totalCop)} · ${paymentLabels[attempt.state]??attempt.state}`),button("Consultar pago",()=>paymentDetail(attempt.id),"secondary"));pending.append(row);}content.append(pending);}}
}
function openTicketViewer(order,index){
  const dialog=el("dialog",null,{class:"ticket-viewer","aria-labelledby":"ticket-viewer-title"});
  const head=el("div",null,{class:"ticket-viewer-head"}),title=el("h2","",{id:"ticket-viewer-title"});
  const close=button("Cerrar",()=>dialog.close(),"viewer-close");head.append(title,close);
  const eventInfo=el("div",null,{class:"viewer-event"});eventInfo.append(el("p","SHARKPASS",{class:"eyebrow"}),el("h3",order.title),el("p",fmtDate(order.starts_at)),el("p",`${order.venue} · ${order.type_name}`));
  const image=el("img",null,{class:"viewer-art"}),notice=el("p","",{class:"viewer-notice",role:"status"}),controls=el("div",null,{class:"viewer-controls"});
  const draw=()=>{const ticket=order.tickets[index];title.textContent=`Entrada ${index+1} de ${order.tickets.length}`;image.hidden=ticket.status!=="valid";if(ticket.status==="valid")image.src=`/api/tickets/${ticket.id}/qr`;else image.removeAttribute("src");image.alt=`${order.title} · ${ticket.status==="valid"?"Válida":ticket.status==="used"?"Ya utilizada":"Anulada"}`;notice.textContent=ticket.status==="valid"?"Un QR por persona · Un solo ingreso":"Esta entrada no permite un nuevo ingreso";previous.disabled=index===0;next.disabled=index===order.tickets.length-1;};
  const previous=el("button","Anterior",{type:"button",class:"secondary"}),next=el("button","Siguiente",{type:"button",class:"secondary"});previous.addEventListener("click",()=>{if(index>0){index--;draw();}});next.addEventListener("click",()=>{if(index<order.tickets.length-1){index++;draw();}});controls.append(previous,next);
  dialog.append(head,eventInfo,image,notice,controls);dialog.addEventListener("close",()=>dialog.remove(),{once:true});document.body.append(dialog);draw();dialog.showModal();close.focus();
}
async function orderDetail(id) {
  if (authRequired()) return;
  const order = await request(`orders/${id}`);
  history.replaceState(null, "", `/?order=${id}`);
  heading(order.state==="confirmed"?"Tus entradas, listas para vivirlo":"Estado de tus entradas","Guarda tus boletas y presenta el QR de cada persona al ingresar.");
  document.body.dataset.view="checkout";delete document.body.dataset.auth;content.classList.add("ticket-wallet");
  content.append(button("← Mis entradas",()=>show("orders"),"wallet-back"));
  const receipt=el("section",null,{class:"wallet-receipt"}),identity=el("div",null,{class:"wallet-receipt-info"});
  identity.append(el("span",order.state==="confirmed"?"Compra confirmada":"Compra anulada",{class:`wallet-status ${order.state!=="confirmed"?"inactive":""}`}),el("h2",order.title),el("p",fmtDate(order.starts_at)),el("p",order.venue));
  const stats=el("div",null,{class:"wallet-receipt-stats"});stats.append(el("span",`${order.quantity} ${order.quantity===1?"entrada":"entradas"}`),el("strong",price(order.total_cop)),el("small",order.type_name));receipt.append(identity,stats);content.append(receipt,pricingLines(order.pricing,order.quantity,order.total_cop));
  if(order.is_demo)content.append(el("p","ENTRADAS DEMO · Sin validez comercial ni ingreso a un evento real.",{class:"wallet-demo"}));
  const tools=el("details",null,{class:"wallet-tools"});tools.append(el("summary","Correo y comprobante"),el("p",`Referencia: ${order.id}`,{class:"checkout-reference"}));
  let delivery;try{delivery=await request(`orders/${id}/email`);}catch{tools.append(el("p","No pudimos consultar el correo. Tus entradas siguen disponibles aquí."));}
  if(delivery){
    const box=el("div",null,{class:"delivery-status",role:"status"});
    box.append(el("strong","Tus entradas, también por correo"),el("p",`Destino: ${delivery.email}`),el("p",({sent:"El servidor de correo aceptó el mensaje. Revisa tu bandeja y Spam.",sending:"Estamos enviando tu confirmación.",queued:"Tu confirmación está pendiente de envío.",attention:"No pudimos confirmar la entrega del correo. Tus entradas siguen disponibles aquí."})[delivery.state]||"El envío necesita revisión."));
    const retry=button("Volver a enviar el correo",async()=>{await request(`orders/${id}/email`,"POST",{});inform("Envío solicitado. Revisa tu correo y Spam.");retry.disabled=true;},"secondary");
    retry.disabled=delivery.state==="sending";box.append(retry);tools.append(box);
  }
  if(order.state==="confirmed" && emailConfigured){
    const copy=form(async data=>{const result=await request(`orders/${id}/email-copy`,"POST",data);inform(result.message);},"Enviar copia de la confirmación");
    copy.className="receipt-copy-form";
    field(copy,"Enviar una copia a otro correo","email","email").autocomplete="email";
    copy.append(el("p","La copia contiene el resumen y el enlace a esta compra. Para regalar una boleta, usa Compartir en esa entrada.",{class:"checkout-fine-print"}));copy.appendSubmit();const more=el("details",null,{class:"receipt-extra"});more.append(el("summary","Enviar una copia a otro correo"),copy);tools.append(more);
  }
  const ticketHeading=el("div",null,{class:"wallet-ticket-heading"});ticketHeading.append(el("h2","Tus boletas"),el("p","Abre una entrada para ampliar el QR. Cada boleta permite un solo ingreso."));content.append(ticketHeading);
  const ticketsGrid = el("section", null, { class: "ticket-grid", id:"purchase-tickets", "aria-label": "Boletas de esta compra" });
  content.append(ticketsGrid);
  for (const [index, ticket] of order.tickets.entries()) {
    const card = el("article", null, {
      class: `ticket issued-ticket ${ticket.status === "used" ? "used" : ""}`,
    });
    const cardHead=el("div",null,{class:"wallet-card-head"});cardHead.append(el("h3",`Entrada ${String(index+1).padStart(2,"0")}${ticket.seatLabel?` · Silla ${ticket.seatLabel}`:""}`,{class:"ticket-number"}),el("span",ticket.status==="valid"?"Válida":ticket.status==="used"?"Utilizada":"Anulada",{class:`wallet-status ${ticket.status!=="valid"?"inactive":""}`}));
    const preview=button("",()=>openTicketViewer(order,index),"ticket-preview");preview.setAttribute("aria-label",`Abrir entrada ${index+1} y ampliar QR`);preview.append(el("img",null,{src:`/api/tickets/${ticket.id}/art`,alt:`Entrada ${order.title} · ${ticket.status==="valid"?"Válida":ticket.status==="used"?"Ya utilizada":"Anulada"}`,class:"ticket-art"}));
    const expand=button(ticket.status==="valid"?"Mostrar QR":"Ver estado",()=>openTicketViewer(order,index),"wallet-show-qr");
    const actions=el("details",null,{class:"wallet-card-actions"});actions.append(el("summary","Guardar o compartir"),el("a","Descargar ticket completo",{href:`/api/tickets/${ticket.id}/download`,download:`sharkpass-${ticket.id}.svg`,class:"wallet-download"}));card.append(cardHead,preview,expand);if(ticket.attendeeName)cardHead.after(el("p",ticket.attendeeName,{class:"ticket-attendee-name"}));
    const exportTicket=async shareRequested=>{
      const response=await fetch(`/api/tickets/${ticket.id}/download`,{credentials:"same-origin"});
      if(!response.ok)throw new Error("No pudimos preparar esta entrada. Inicia sesión e inténtalo de nuevo.");
      const svg=await response.text(),image=new Image();
      image.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await image.decode();
      const canvas=document.createElement("canvas");canvas.width=1000;canvas.height=Math.round(image.naturalHeight/image.naturalWidth*1000);
      const context=canvas.getContext("2d");if(!context)throw new Error("Descarga el ticket completo para compartirlo.");
      context.fillStyle="#ffffff";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
      const png=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
      if(!png)throw new Error("Descarga el ticket completo para compartirlo.");
      const file=new File([png],`SharkPass-entrada-${index+1}.png`,{type:"image/png"});
      if(shareRequested && navigator.canShare?.({files:[file]})){
        try{await navigator.share({files:[file],title:`Entrada ${index+1} · ${order.title}`,text:"Tu entrada SharkPass. El QR permite un solo ingreso: no lo compartas públicamente."});}
        catch(error){if(error.name!=="AbortError")throw error;}
      }else{
        const url=URL.createObjectURL(file),link=el("a",null,{href:url,download:file.name});
        document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
        inform(`Descargamos solo la entrada ${index+1}. Puedes enviarla por WhatsApp o correo. El QR permite un solo ingreso.`);
      }
    };
    const share=button(`Compartir entrada ${index+1}`,()=>exportTicket(true),"secondary ticket-share");
    const save=button("Guardar imagen",()=>exportTicket(false),"secondary ticket-share");
    if(ticket.status!=="valid"){share.disabled=true;save.disabled=true;}
    actions.append(share,save);card.append(actions);
    ticketsGrid.append(card);
  }
  content.append(
    button(
      "Imprimir entradas / Guardar PDF",
      () => window.print(),
      "secondary print-tickets",
    ),
  );
  content.append(tools,el("p","Comparte solo la boleta de quien te acompaña. Compartir el archivo no cambia su titularidad y el QR admite un solo uso.",{class:"wallet-support"}));
}
function eventDraftSteps(f) {
  const inputs = [...f.children].filter(node => node.tagName === "LABEL");
  const submit = f.querySelector("button[type=submit]");
  const required = new Set(inputs.map(label => label.querySelector("input,textarea,select")).filter(input => input?.required));
  const steps = [inputs.slice(0, 3), inputs.slice(3)];
  const progress = el("ol", null, { class: "draft-progress", "aria-label": "Pasos para crear el borrador" });
  for (const label of ["Información", "Fecha y lugar", "Revisión"]) progress.append(el("li", label));
  const review = el("dl", null, { class: "draft-review" });
  const controls = el("div", null, { class: "draft-controls" });
  let current = 0;
  const previous = button("Anterior", () => { current--; draw(); }, "secondary");
  const next = button("Continuar", () => {
    for (const label of steps[current]) {
      const input = label.querySelector("input,textarea,select");
      if (input && !input.reportValidity()) return;
    }
    current++;
    draw();
  });
  controls.append(previous, next);
  f.prepend(progress);
  f.append(review, submit, controls);
  f.addEventListener("submit", (event) => {
    if (current < 2) {
      event.preventDefault();
      event.stopImmediatePropagation();
      next.click();
    }
  }, true);
  function draw() {
    steps.forEach((labels, index) => labels.forEach(label => {
      label.hidden = current !== index;
      const input = label.querySelector("input,textarea,select");
      if (input) input.required = required.has(input) && (current === index || current === 2);
    }));
    [...progress.children].forEach((item, index) => {
      if (index === current) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
    previous.hidden = current === 0;
    next.hidden = current === 2;
    submit.hidden = current !== 2;
    review.hidden = current !== 2;
    if (current === 2) {
      review.replaceChildren();
      for (const label of inputs) {
        const input = label.querySelector("input,textarea,select");
        if (!input || input.type === "checkbox") continue;
        review.append(el("dt", label.firstChild.textContent), el("dd", input.tagName === "SELECT" ? input.selectedOptions[0]?.textContent : input.value));
      }
      review.append(el("dt", "Estado inicial"), el("dd", "Borrador. Añade tipos de entrada y cupos antes de publicar."));
    }
  }
  f.showField = (name) => {
    const index = steps.findIndex(labels => labels.some(label => label.querySelector("input,textarea,select")?.name === name));
    if (index >= 0) { current = index; draw(); f.elements[name].focus(); }
  };
  draw();
}
function organizerLanding() {
  heading("Organiza con SharkPass");
  content.replaceChildren();content.classList.add("organizer-marketing");
  mountOrganizerLanding(content,{el,button,money,icon:accountIcon,onStart:()=>me?organizer():show("account"),onLogin:()=>show("account")});
}

async function organizer() {
  if (!me) return organizerLanding();
  await loadMe();
  heading(
    "Haz que suceda.",
    "Organiza tus eventos y gestiona las entradas desde un solo lugar.",
  );
  content.append(button("Conoce SharkPass para organizadores",()=>organizerLanding(),"secondary"));
  const create = el("section", null, { class: "card" });
  create.append(el("h2", "Crear organizador"));
  const orgForm = form(async (data) => {
    await request("organizations", "POST", data);
    await show("organizer");
    inform(
      "Organizador creado. Sus eventos y ventas quedan separados de los demás.",
    );
  }, "Crear organizador");
  field(orgForm, "Nombre de la empresa u organizador", "name");
  orgForm.appendSubmit();
  create.append(orgForm);
  content.append(create);
  const owned = organizations.filter((o) => o.role === "owner");
  if (owned.length) {
    const card = el("section", null, { class: "card" });
    card.append(el("h2", "Nuevo evento"));
    card.append(
      el(
        "p",
        "Primer evento: Pitch Competition by Shark Caribe · 25 de noviembre de 2026. Confirma la hora antes de crear el borrador.",
      ),
    );
    const f = form(async (data) => {
      const result = await request("events", "POST", {
        ...data,
        startsAt: `${data.date}T${data.time}:00-05:00`,
        isDemo: data.isDemo === "on",
      });
      await manageEvent(result.id);
      inform("Borrador creado. Añade las entradas antes de publicar.");
    }, "Crear borrador");
    const label = el("label", "Organizador"),
      select = el("select", null, { name: "organizationId", required: "" });
    for (const org of owned)
      select.append(el("option", org.name, { value: org.id }));
    label.append(select);
    f.append(label);
    field(f, "Nombre del evento", "title");
    field(f, "Descripción", "description", "textarea");
    field(f, "Lugar y dirección", "venue");
    field(f, "Fecha en Colombia", "date", "date");
    field(f, "Hora en Colombia", "time", "time");
    field(f, "Es un evento de demostración", "isDemo", "checkbox", "on", false);
    card.append(
      button(
        "Preparar Pitch Competition",
        () => {
          f.elements.title.value = "Pitch Competition by Shark Caribe";
          f.elements.description.value =
            "Asiste y apoya a los participantes del Pitch Competition by Shark Caribe.";
          f.elements.venue.value =
            "Hotel Dann Carlton Barranquilla · Salón Laureles";
          f.elements.date.value = "2026-11-25";
          if (f.showField) f.showField("time");
          else f.elements.time.focus();
          inform(
            "Confirma la hora. El borrador no crea entradas ni habilita la venta.",
          );
        },
        "secondary",
      ),
    );
    f.appendSubmit();
    eventDraftSteps(f);
    card.append(f);
    content.append(card);
  }
  managed = await request("manage");
  const dashboard = el("div", null, { class: "dashboard-metrics" });
  for (const [label, count] of [["Mis eventos", managed.length], ["Publicados", managed.filter(item => item.state === "published").length], ["Borradores", managed.filter(item => item.state === "draft").length]]) {
    const metric = el("article", null, { class: "card" });
    metric.append(el("p", label), el("strong", String(count)));
    dashboard.append(metric);
  }
  content.prepend(dashboard);
  content.append(el("h2", "Mis eventos"));
  for (const event of managed) {
    const card = el("section", null, { class: "card" });
    card.append(
      el("h2", event.title),
      el("p", `${fmtDate(event.starts_at)} · ${event.state}`),
    );
    if (event.role === "owner")
      card.append(button("Administrar evento", () => manageEvent(event.id)));
    else card.append(el("p", "Tienes permiso para controlar el ingreso."));
    content.append(card);
  }
}
async function manageEvent(id) {
  const data = await request(`events/${id}/sales`),
    event = data.event;
  heading(event.title, "Administración del evento");
  appendEventMedia(event);
  const stats = el("section", null, { class: "card" });
  stats.append(
    el(
      "p",
      `${data.summary.issued} entradas emitidas · ${data.used} ingresos · ${price(data.summary.revenueCop)} recaudados`,
    ),
    el("p", `Estado: ${event.state}`),
    el("p", `ID para vincular con Localia: ${event.id}`, { class: "code" }),
  );
  const link = el("a", "Abrir ficha pública", {
    href: `/evento/${event.id}`,
    class: "action",
  });
  if (event.state === "published") stats.append(link);
  content.append(stats);
  for (const type of event.types)
    content.append(
      el(
        "p",
        `${type.name} · ${price(type.price_cop)} · ${type.available}/${type.capacity} disponibles`,
      ),
    );
  const paymentRows = await request(`events/${id}/payments`);
  if (paymentRows.length) {
    content.append(el("h2", "Pagos y entrega"));
    for (const payment of paymentRows) {
      const row = el("section", null, { class: "card" });
      row.append(
        el("h3", paymentLabels[payment.state] ?? payment.state),
        el(
          "p",
          `${price(payment.amount_cents / 100)} · ${payment.quantity} entrada(s) · ${payment.environment === "test" ? "SANDBOX" : "Producción"}`,
        ),
        el(
          "p",
          `Entrega: ${payment.email} · Correo: ${{ queued: "pendiente de envío", sending: "enviando", sent: "aceptado por proveedor", attention: "requiere revisión" }[payment.email_state] ?? "sin emisión"}`,
        ),
        el(
          "p",
          `Referencia: ${payment.id} · Wompi: ${payment.provider_id ?? "pendiente"}`,
          { class: "code" },
        ),
      );
      if (payment.state === "review")
        row.append(
          el(
            "p",
            "No se emitieron entradas. Revisa el pago en Wompi y gestiona su devolución antes de cerrar el caso.",
            { class: "notice" },
          ),
        );
      content.append(row);
    }
  }
  const f = form(async (data) => {
    await request(`events/${id}/types`, "POST", {
      name: data.name,
      priceCop: Number(data.priceCop),
      capacity: Number(data.capacity),
    });
    await manageEvent(id);
  }, "Añadir tipo de entrada");
  field(f, "Nombre: General, VIP…", "name");
  const amount = field(
    f,
    "Precio COP (0 para gratuita)",
    "priceCop",
    "number",
    "0",
  );
  amount.min = "0";
  amount.max = "100000000";
  const cap = field(f, "Cupo", "capacity", "number", "100");
  cap.min = "1";
  cap.max = "100000";
  f.appendSubmit();
  content.append(f);
  const actions = el("div", null, { class: "row" });
  if (event.state !== "cancelled")
    actions.append(
      button("Publicar evento", async () => {
        await request(`events/${id}/state`, "POST", { state: "published" });
        await manageEvent(id);
        inform(
          "Evento publicado. Los pagos dependen de la configuración de Wompi; Sandbox solo admite eventos DEMO.",
        );
      }),
      button(
        "Cancelar evento y anular entradas",
        async () => {
          if (!confirm("¿Cancelar el evento y anular sus entradas?")) return;
          await request(`events/${id}/state`, "POST", { state: "cancelled" });
          await manageEvent(id);
          inform(
            "Evento cancelado y entradas anuladas. Si hubo pagos, concilia y gestiona las devoluciones en Wompi.",
          );
        },
        "danger",
      ),
    );
  content.append(actions);
  const staff = form(async (input) => {
    await request(`organizations/${event.organization_id}`, "POST", input);
    inform(
      "Usuario añadido al equipo de ingreso. No tiene acceso a ventas ni edición.",
    );
  }, "Añadir al equipo de ingreso");
  field(staff, "Correo del personal de ingreso", "email", "email");
  staff.appendSubmit();
  content.append(el("h2", "Personal de ingreso"), staff);
}
async function scan() {
  if (authRequired()) return;
  heading(
    "Bienvenidos al evento.",
    "Escanea con un lector conectado o pega el código. Si este navegador lo permite, también puedes usar la cámara.",
  );
  content.append(el("a","Abrir app de ingreso instalable",{href:"/ingreso/",class:"action"}));
  managed = await request("manage");
  const f = form(async (input) => {
    const result = await request(`events/${input.eventId}/scan`, "POST", {
      code: input.code,
    });
    if (result.accepted) {
      inform("INGRESO AUTORIZADO. La entrada quedó utilizada.");
      f.elements.code.value = "";
      f.elements.code.focus();
    }
  }, "Validar ingreso");
  const l = el("label", "Evento"),
    select = el("select", null, { name: "eventId", required: "" });
  for (const e of managed.filter((e) => e.state === "published"))
    select.append(el("option", e.title, { value: e.id }));
  l.append(select);
  f.append(l);
  field(f, "Código QR", "code");
  f.appendSubmit();
  content.append(f);
  if (
    typeof BarcodeDetector !== "undefined" &&
    navigator.mediaDevices?.getUserMedia
  ) {
    let stream = null,
      frame = null,
      busy = false,
      cameraSession = 0,
      observer = null;
    const video = el("video", null, {
      playsinline: "",
      muted: "",
      class: "scanner-video",
    });
    const stop = () => {
      cameraSession++;
      if (frame) cancelAnimationFrame(frame);
      frame = null;
      observer?.disconnect();
      observer = null;
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      video.remove();
    };
    content.append(
      button("Detener cámara", stop, "secondary"),
      button(
        "Escanear con cámara",
        async () => {
          stop();
          busy = false;
          const session = cameraSession;
          const acquired = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false,
          });
          if (session !== cameraSession || !f.isConnected) {
            acquired.getTracks().forEach((track) => track.stop());
            return;
          }
          stream = acquired;
          video.srcObject = stream;
          content.append(video);
          await video.play();
          if (session !== cameraSession || !stream || !f.isConnected) return;
          const detector = new BarcodeDetector({ formats: ["qr_code"] });
          observer = new MutationObserver(() => {
            if (!f.isConnected) {
              stop();
            }
          });
          observer.observe(content, { childList: true });
          const next = async () => {
            if (session !== cameraSession) return;
            if (!stream || !f.isConnected) {
              stop();
              return;
            }
            try {
              const codes = await detector.detect(video);
              if (session !== cameraSession || !stream || !f.isConnected) return;
              if (codes.length && !busy) {
                busy = true;
                f.elements.code.value = codes[0].rawValue;
                stop();
                f.requestSubmit();
                return;
              }
            } catch {
              if (session !== cameraSession) return;
              stop();
              inform(
                "No se pudo leer la cámara. Usa el lector o pega el código.",
              );
              return;
            }
            frame = requestAnimationFrame(next);
          };
          void next();
        },
        "secondary",
      ),
    );
  } else
    content.append(
      el(
        "p",
        "Cámara no compatible en este navegador. Usa un lector QR conectado o pega el código.",
      ),
    );
}
const paymentLabels = {
  pending: "Pago pendiente de confirmación",
  confirmed: "Pago confirmado",
  failed: "Pago rechazado o con error",
  expired: "Reserva vencida",
  review:
    "Pago recibido: requiere revisión del organizador. No hay entrada emitida.",
  voided: "Pago anulado",
};
const returnedPayments = new Set();
async function paymentDetail(id) {
  stopCheckoutTimers();
  if (!me) return authScreen("login");
  let payment = await request(`payments/${id}`), refreshError="";
  const providerId=params.get("payment")===id?params.get("id"):null;
  if(providerId&&!returnedPayments.has(id)){
    returnedPayments.add(id);
    try{payment=await request(`payments/${id}/refresh`,"POST",{transactionId:providerId});}
    catch(error){refreshError=error.message;}
  }
  if(payment.state==="confirmed"&&payment.orderId){
    if(sameSelection(basket,payment)){saveBasket(null);setCheckoutReturn(false);}
    return orderDetail(payment.orderId);
  }
  heading(payment.state==="pending"?"Completa tu pago":paymentLabels[payment.state]??"Tu pago","Revisa tu reserva y completa el pago de tus entradas.");
  document.body.dataset.view="checkout";delete document.body.dataset.auth;
  history.replaceState(null,"",`/?payment=${id}${providerId?`&id=${encodeURIComponent(providerId)}`:""}`);
  content.append(checkoutSteps(3));
  const layout=el("div",null,{class:"checkout-layout"}),main=el("section",null,{class:"checkout-main payment-main"});
  if(payment.environment==="test")main.append(el("p","WOMPI SANDBOX · PRUEBA SIN DINERO REAL",{class:"checkout-callout"}));
  if(refreshError)main.append(el("p",`No pudimos actualizar el pago: ${refreshError} Puedes volver a comprobar su estado.`,{class:"checkout-callout"}));
  const panel=el("article",null,{class:"payment-panel"});
  panel.append(el("p",payment.state==="pending"?"ENTRADAS RESERVADAS": "ESTADO DE TU COMPRA",{class:"eyebrow"}),el("h2",paymentLabels[payment.state]??"Tu pago"));
  const aside=checkoutSummary(payment.event,payment.type,payment.quantity,payment.totalCop);
  const refresh=button("Comprobar estado del pago",async()=>{await request(`payments/${id}/refresh`,"POST",{transactionId:providerId});await paymentDetail(id);},"secondary");
  if(payment.state==="pending"){
    const clock=el("strong","",{class:"reservation-clock",role:"timer","aria-label":"Tiempo restante de la reserva"});
    panel.append(el("p","Tiempo para completar tu pago",{class:"checkout-fine-print"}),clock,el("p","Esta reserva mantiene tu cupo hasta que termine el tiempo. Si vence sin pago confirmado, las entradas vuelven a estar disponibles."));
    panel.append(el("h3","Pago seguro con Wompi"),el("p",`Correo de esta compra: ${payment.email}`),el("p","Elegirás el medio de pago en Wompi. Al volver, comprobaremos el resultado antes de emitir las entradas."));
    const pay=el("a",payment.environment==="test"?"Continuar a Wompi Sandbox":"Pagar con Wompi",{href:payment.checkoutUrl,class:"action checkout-primary"});aside.append(pay);
    const started=performance.now();
    const tick=()=>{
      const remaining=remainingReservationMs(payment,performance.now()-started);clock.textContent=formatReservation(remaining);
      if(remaining<=0){
        clearInterval(checkoutTimer);checkoutTimer=null;pay.removeAttribute("href");pay.setAttribute("aria-disabled","true");pay.textContent="Reserva vencida";
        void paymentDetail(id).catch(error=>inform(error.message));
      }
    };
    tick();if(remainingReservationMs(payment)>0)checkoutTimer=setInterval(tick,1000);
    main.append(button("Volver al carrito y liberar reserva",async()=>{
      const latest=await request(`payments/${id}/refresh`,"POST",{transactionId:providerId});
      if(latest.state!=="pending")return paymentDetail(id);
      const cancelled=await request(`payments/${id}/cancel`,"POST",{});
      if(cancelled.state!=="expired")return paymentDetail(id);
      saveBasket({version:1,eventId:payment.event.id,typeId:payment.type.id,quantity:payment.quantity,key:crypto.randomUUID()});await show("cart");
    },"text-button"));
    let polling=false;
    paymentPoller=setInterval(async()=>{
      if(!panel.isConnected){stopCheckoutTimers();return;}
      if(polling||document.hidden)return;polling=true;
      try{const latest=await request(`payments/${id}`);if(latest.state!==payment.state&&panel.isConnected)await paymentDetail(id);}
      catch{/* The manual refresh remains available during a connection interruption. */}
      finally{polling=false;}
    },5000);
  }else{
    const messages={expired:"La reserva terminó y ya no retiene cupo. Si ya realizaste un pago, comprueba su estado antes de intentar otra compra.",failed:"Wompi no confirmó este pago. Revisa su estado y, si corresponde, prepara un nuevo intento.",review:"Estamos revisando el pago. No vuelvas a pagar esta compra. Aún no hay entradas emitidas; consulta al organizador con esta referencia.",voided:"Este pago está anulado. Las entradas asociadas no permiten el ingreso."};
    panel.append(el("p",messages[payment.state]??"Consulta el estado de tu compra."));
    if(["expired","failed"].includes(payment.state))aside.append(button("Revisar entradas e intentar de nuevo",async()=>{
      // A canonical refresh must succeed before allowing a new payment attempt.
      const latest=await request(`payments/${id}/refresh`,"POST",{transactionId:providerId});
      if(!["expired","failed"].includes(latest.state))return paymentDetail(id);
      saveBasket({version:1,eventId:payment.event.id,typeId:payment.type.id,quantity:payment.quantity,key:crypto.randomUUID()});await show("cart");
    },"checkout-primary"));
  }
  panel.append(el("p",`Referencia de compra: ${payment.id}`,{class:"checkout-reference"}),refresh);
  main.prepend(panel);aside.append(el("p","Las entradas se emiten únicamente después de confirmar el pago.",{class:"checkout-fine-print"}));
  main.append(button("Ver mis entradas",()=>show("orders"),"secondary"));layout.append(main,aside);content.append(layout);
}

function accountLink(purpose, token) {
  heading(
    purpose === "verify" ? "Verificar correo" : "Recuperar cuenta",
    "Este enlace es temporal y de un solo uso.",
  );
  history.replaceState(null, "", "/");
  const f = form(
    async (data) => {
      await request(
        purpose === "verify" ? "account/verify" : "account/recover",
        "POST",
        { token, ...data },
      );
      await loadMe();
      await show("account");
      inform(
        purpose === "verify"
          ? "Correo verificado."
          : "Contraseña actualizada. Inicia sesión nuevamente.",
      );
    },
    purpose === "verify" ? "Confirmar correo" : "Guardar nueva contraseña",
  );
  if (purpose === "reset") {
    const password = field(
      f,
      "Nueva contraseña (mínimo 10 caracteres)",
      "password",
      "password",
    );
    password.minLength = 10;
    password.maxLength = 256;
    password.autocomplete = "new-password";
  }
  f.appendSubmit();
  content.append(f);
}
async function admin() {
  await loadMe();if(!me)return show("account");
  heading("Administración","Control de eventos, ventas, ingreso y operación de SharkPass.");
  if(!platformAdmin){content.append(el("p","Tu cuenta no tiene permisos de administración. Inicia sesión con la cuenta administradora autorizada.",{class:"notice"}));return;}
  content.classList.add("admin-workspace","organizer-marketing");await mountAdminConsole(content,{request,el,button,field,form,fmtDate,money,me});
}
async function show(next) {
  stopCheckoutTimers();
  window.scrollTo({ top: 0, behavior: "instant" });
  view = [
    "events",
    "search",
    "favorites",
    "orders",
    "organizer",
    "scan",
    "account",
    "admin",
    "cart",
    "checkout",
  ].includes(next)
    ? next
    : "events";
  content.classList.remove("organizer-marketing");
  document.body.dataset.view = view;
  delete document.body.dataset.auth;
  for (const item of document.querySelectorAll(
    ".main-nav [data-view], .mobile-nav [data-view]",
  )) {
    if (item.dataset.view === view) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  }
  history.replaceState(
    null,
    "",
    previewMode
      ? `/?demo=1${view === "events" ? "" : `&view=${view}`}`
      : view === "events"
        ? "/"
        : `/?view=${view}`,
  );
  if(view==="search"){
    const target=new URL(location.href),search=document.querySelector("#header-search");
    const query=search.elements.query.value.trim(),category=search.elements.category.value;
    if(query)target.searchParams.set("q",query);if(category)target.searchParams.set("category",category);
    history.replaceState(null,"",target.pathname+target.search);
  }
  inform("");
  try {
    if (previewMode && !["events", "search", "favorites"].includes(view))
      return previewWorkspace(view);
    await {
      events,
      search: events,
      favorites,
      orders,
      organizer,
      scan,
      account,
      admin,
      cart:cartScreen,
      checkout:checkoutScreen,
    }[view]();
  } catch (e) {
    inform(e.message);
  }
}
document.addEventListener("click", (event) => {
  const signup = event.target.closest("[data-auth=register]");
  if (signup) { event.preventDefault(); authMode="register"; void show("account"); return; }
  const target = event.target.closest("button[data-view], a[data-view]");
  if (target) {
    event.preventDefault();
    void show(target.dataset.view);
  }
});
function setHeaderCategories(items){
  const select=document.querySelector("#header-search").elements.category,previous=select.value;
  select.replaceChildren(el("option","Todas las experiencias",{value:""}));
  for(const value of new Set(items.map(item=>item.category??"Eventos")))select.append(el("option",value,{value}));
  select.value=[...select.options].some(option=>option.value===previous)?previous:"";
}
const headerSearch=document.querySelector("#header-search"),filterToggle=document.querySelector("#search-filter-toggle"),headerFilters=document.querySelector("#header-filters");
headerSearch.elements.query.value=(params.get("q")??"").slice(0,150);
if(params.get("category")){
  const category=params.get("category").slice(0,100);
  headerSearch.elements.category.append(el("option",category,{value:category}));headerSearch.elements.category.value=category;
}
function setSearchFilters(open){
  headerFilters.hidden=!open;filterToggle.setAttribute("aria-expanded",String(open));filterToggle.setAttribute("aria-label",open?"Ocultar filtros de búsqueda":"Mostrar filtros de búsqueda");
}
filterToggle.addEventListener("click",async()=>{
  const open=headerFilters.hidden;setSearchFilters(open);
  if(open && headerSearch.elements.category.options.length===1){
    try{setHeaderCategories(previewMode?demoEvents:await request("events"));}catch{inform("No pudimos cargar las categorías. Puedes buscar por nombre.");}
  }
  if(open)headerSearch.elements.category.focus();
});
headerSearch.addEventListener("keydown",event=>{if(event.key==="Escape"&&!headerFilters.hidden){setSearchFilters(false);filterToggle.focus();}});
headerSearch.addEventListener("submit",async event=>{
  event.preventDefault();setSearchFilters(false);
  const menu=document.querySelector("#menu-toggle");if(menu.getAttribute("aria-expanded")==="true")menu.click();
  await show("search");
  content.querySelector("#catalog")?.scrollIntoView({behavior:"smooth",block:"start"});
});
setupMobileNavigation(document,window);
updateCartBadge();
if (previewMode) {
  document
    .querySelector("#pilot-notice")
    .replaceChildren(
      el(
        "span",
        "DEMO VISUAL · Eventos ficticios, sin reservas, pagos ni emisión de entradas.",
      ),
      el("a", "Salir de la demo", { href: "/" }),
    );
  if (params.get("event")) previewEventDetail(params.get("event"));
  else void show(view);
} else {
  loadMe()
    .then(() => {
      const match = location.pathname.match(/^\/evento\/([a-f0-9-]{36})$/);
      if (params.get("verify"))
        return accountLink("verify", params.get("verify"));
      if (params.get("reset")) return accountLink("reset", params.get("reset"));
      if(params.get("previewEvent")&&/^[a-f0-9-]{36}$/.test(params.get("previewEvent")))return me?eventDetail(params.get("previewEvent"),true):show("account");
      if (params.get("payment")) return paymentDetail(params.get("payment"));
      if (params.get("order")) return orderDetail(params.get("order"));
      return match ? eventDetail(match[1]) : show(view);
    })
    .catch((e) => inform(e.message));
}
