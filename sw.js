const V='sos-guard-v4';
const FILES=['./','index.html','style.css','app.js','manifest.json','logo.png','icon.svg','jsQR.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>Promise.all(FILES.map(f=>c.add(new Request(f,{cache:'reload'})).catch(()=>{}))))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data==='skip')self.skipWaiting()});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin||u.search.includes('speedtest'))return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).catch(()=>caches.match('index.html'))));
});
