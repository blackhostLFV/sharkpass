const CACHE='sharkpass-ingreso-shell-v1';
const ASSETS=['/ingreso/','/ingreso/app.css','/ingreso/app.js','/ingreso/state.js','/ingreso/manifest.webmanifest','/ingreso/icon-192.png','/ingreso/icon-512.png','/brand/sharkpass-logo-light.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('sharkpass-ingreso-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
// Exact public asset allowlist only. Never intercept API, tickets, login or POSTs.
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||!ASSETS.includes(url.pathname))return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;}).catch(()=>caches.match(event.request,{ignoreSearch:true})));
});
