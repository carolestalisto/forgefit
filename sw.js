const CACHE='forgefit-shell-v4-safe-sync-20261026';
const ASSETS=['./','./index.html','./src/app.js','./src/solver.js','./src/pulley-solver.js','./src/exercise-db.js','./src/catalog.js','./src/styles.css','./firebase-config.js','./manifest.webmanifest','./assets/icon.svg'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('forgefit-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 event.respondWith(fetch(req).then(response=>{
  if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(req,copy));}
  return response;
 }).catch(()=>caches.match(req)));
});
