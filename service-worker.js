!function(){"use strict";const s=1634664539617,e=`cache${s}`,t=["/client/client.e19a404b.js","/client/inject_styles.803b7e80.js","/client/index.2970e4bd.js","/client/menu.5ce496a4.js","/client/about.3112cf62.js","/client/[...slug].96d486c3.js","/client/_commonjsHelpers.6d477d8d.js","/client/index.3e7f60d1.js","/client/index.5b8007a7.js","/client/bigBoard.d9a1b087.js"].concat(["/service-worker-index.html","/assets/boundaries.geojson","/assets/coneTexture.png","/assets/conesVilles.svg","/assets/css/main.css","/assets/css/main.css.map","/assets/data_model_v10.svg","/assets/data_model_v11.svg","/assets/earth_normalmap_flat4k.jpg","/assets/earthbump4k.jpg","/assets/earthmap4k.jpg","/assets/earthspec4k.jpg","/assets/favicon.ico","/assets/gentilis_regular.typeface.json","/assets/images/icons.png","/assets/images/icons@2x.png","/assets/images/widgets.png","/assets/images/widgets@2x.png","/assets/js/main.js","/assets/js/search.js","/assets/nwx.jpg","/assets/nwy.jpg","/assets/nwz.jpg","/assets/nx.jpg","/assets/ny.jpg","/assets/nz.jpg","/assets/pwx.jpg","/assets/pwy.jpg","/assets/pwz.jpg","/assets/px.jpg","/assets/py.jpg","/assets/pz.jpg","/bulma.css","/classes/default.html","/datasets/19","/datasets/19 reduced","/datasets/China_Taiwan_1M","/datasets/Europe_1M","/datasets/Europe_1M_FUA","/datasets/France","/datasets/Germany_22","/datasets/Japan","/datasets/Japan_1M","/datasets/World","/datasets/World_1M","/datasets/datasets.json","/datasets/user-test_1","/documentation.html","/modules.html"]),a=new Set(t);self.addEventListener("install",(s=>{s.waitUntil(caches.open(e).then((s=>s.addAll(t))).then((()=>{self.skipWaiting()})))})),self.addEventListener("activate",(s=>{s.waitUntil(caches.keys().then((async s=>{for(const t of s)t!==e&&await caches.delete(t);self.clients.claim()})))})),self.addEventListener("fetch",(e=>{if("GET"!==e.request.method||e.request.headers.has("range"))return;const t=new URL(e.request.url),n=t.protocol.startsWith("http"),c=t.hostname===self.location.hostname&&t.port!==self.location.port,i=t.host===self.location.host&&a.has(t.pathname),o="only-if-cached"===e.request.cache&&!i;!n||c||o||e.respondWith((async()=>i&&await caches.match(e.request)||async function(e){const t=await caches.open(`offline${s}`);try{const s=await fetch(e);return t.put(e,s.clone()),s}catch(s){const a=await t.match(e);if(a)return a;throw s}}(e.request))())}))}();
