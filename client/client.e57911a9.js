function t(){}const e=t=>t;function n(t,e){for(const n in e)t[n]=e[n];return t}function r(t){return t()}function o(){return Object.create(null)}function s(t){t.forEach(r)}function i(t){return"function"==typeof t}function c(t,e){return t!=t?e==e:t!==e||t&&"object"==typeof t||"function"==typeof t}function a(t,e,n,r){if(t){const o=l(t,e,n,r);return t[0](o)}}function l(t,e,r,o){return t[1]&&o?n(r.ctx.slice(),t[1](o(e))):r.ctx}function u(t,e,n,r,o,s,i){const c=function(t,e,n,r){if(t[2]&&r){const o=t[2](r(n));if(void 0===e.dirty)return o;if("object"==typeof o){const t=[],n=Math.max(e.dirty.length,o.length);for(let r=0;r<n;r+=1)t[r]=e.dirty[r]|o[r];return t}return e.dirty|o}return e.dirty}(e,r,o,s);if(c){const o=l(e,n,r,i);t.p(o,c)}}function f(t){const e={};for(const n in t)"$"!==n[0]&&(e[n]=t[n]);return e}function d(t){return null==t?"":t}const p="undefined"!=typeof window;let h=p?()=>window.performance.now():()=>Date.now(),m=p?t=>requestAnimationFrame(t):t;const g=new Set;function $(t){g.forEach((e=>{e.c(t)||(g.delete(e),e.f())})),0!==g.size&&m($)}function _(t,e){t.appendChild(e)}function y(t,e,n){t.insertBefore(e,n||null)}function b(t){t.parentNode.removeChild(t)}function v(t,e){for(let n=0;n<t.length;n+=1)t[n]&&t[n].d(e)}function w(t){return document.createElement(t)}function E(t){return document.createElementNS("http://www.w3.org/2000/svg",t)}function S(t){return document.createTextNode(t)}function x(){return S(" ")}function P(){return S("")}function R(t,e,n,r){return t.addEventListener(e,n,r),()=>t.removeEventListener(e,n,r)}function N(t,e,n){null==n?t.removeAttribute(e):t.getAttribute(e)!==n&&t.setAttribute(e,n)}function C(t){return Array.from(t.childNodes)}function j(t,e,n,r){for(let r=0;r<t.length;r+=1){const o=t[r];if(o.nodeName===e){let e=0;const s=[];for(;e<o.attributes.length;){const t=o.attributes[e++];n[t.name]||s.push(t.name)}for(let t=0;t<s.length;t++)o.removeAttribute(s[t]);return t.splice(r,1)[0]}}return r?E(e):w(e)}function A(t,e){for(let n=0;n<t.length;n+=1){const r=t[n];if(3===r.nodeType)return r.data=""+e,t.splice(n,1)[0]}return S(e)}function L(t){return A(t," ")}function O(t,e){e=""+e,t.wholeText!==e&&(t.data=e)}function k(t,e,n,r){t.style.setProperty(e,n,r?"important":"")}function I(t,e=document.body){return Array.from(e.querySelectorAll(t))}const T=new Set;let U,q=0;function J(t,e,n,r,o,s,i,c=0){const a=16.666/r;let l="{\n";for(let t=0;t<=1;t+=a){const r=e+(n-e)*s(t);l+=100*t+`%{${i(r,1-r)}}\n`}const u=l+`100% {${i(n,1-n)}}\n}`,f=`__svelte_${function(t){let e=5381,n=t.length;for(;n--;)e=(e<<5)-e^t.charCodeAt(n);return e>>>0}(u)}_${c}`,d=t.ownerDocument;T.add(d);const p=d.__svelte_stylesheet||(d.__svelte_stylesheet=d.head.appendChild(w("style")).sheet),h=d.__svelte_rules||(d.__svelte_rules={});h[f]||(h[f]=!0,p.insertRule(`@keyframes ${f} ${u}`,p.cssRules.length));const m=t.style.animation||"";return t.style.animation=`${m?`${m}, `:""}${f} ${r}ms linear ${o}ms 1 both`,q+=1,f}function B(t,e){const n=(t.style.animation||"").split(", "),r=n.filter(e?t=>t.indexOf(e)<0:t=>-1===t.indexOf("__svelte")),o=n.length-r.length;o&&(t.style.animation=r.join(", "),q-=o,q||m((()=>{q||(T.forEach((t=>{const e=t.__svelte_stylesheet;let n=e.cssRules.length;for(;n--;)e.deleteRule(n);t.__svelte_rules={}})),T.clear())})))}function D(t){U=t}function K(){if(!U)throw new Error("Function called outside component initialization");return U}function z(t){K().$$.on_mount.push(t)}function M(t){K().$$.after_update.push(t)}const F=[],H=[],V=[],G=[],Y=Promise.resolve();let W=!1;function X(t){V.push(t)}let Q=!1;const Z=new Set;function tt(){if(!Q){Q=!0;do{for(let t=0;t<F.length;t+=1){const e=F[t];D(e),et(e.$$)}for(D(null),F.length=0;H.length;)H.pop()();for(let t=0;t<V.length;t+=1){const e=V[t];Z.has(e)||(Z.add(e),e())}V.length=0}while(F.length);for(;G.length;)G.pop()();W=!1,Q=!1,Z.clear()}}function et(t){if(null!==t.fragment){t.update(),s(t.before_update);const e=t.dirty;t.dirty=[-1],t.fragment&&t.fragment.p(t.ctx,e),t.after_update.forEach(X)}}let nt;function rt(t,e,n){t.dispatchEvent(function(t,e){const n=document.createEvent("CustomEvent");return n.initCustomEvent(t,!1,!1,e),n}(`${e?"intro":"outro"}${n}`))}const ot=new Set;let st;function it(){st={r:0,c:[],p:st}}function ct(){st.r||s(st.c),st=st.p}function at(t,e){t&&t.i&&(ot.delete(t),t.i(e))}function lt(t,e,n,r){if(t&&t.o){if(ot.has(t))return;ot.add(t),st.c.push((()=>{ot.delete(t),r&&(n&&t.d(1),r())})),t.o(e)}}const ut={duration:0};function ft(n,r,o,c){let a=r(n,o),l=c?0:1,u=null,f=null,d=null;function p(){d&&B(n,d)}function _(t,e){const n=t.b-l;return e*=Math.abs(n),{a:l,b:t.b,d:n,duration:e,start:t.start,end:t.start+e,group:t.group}}function y(r){const{delay:o=0,duration:i=300,easing:c=e,tick:y=t,css:b}=a||ut,v={start:h()+o,b:r};r||(v.group=st,st.r+=1),u||f?f=v:(b&&(p(),d=J(n,l,r,i,o,c,b)),r&&y(0,1),u=_(v,i),X((()=>rt(n,r,"start"))),function(t){let e;0===g.size&&m($),new Promise((n=>{g.add(e={c:t,f:n})}))}((t=>{if(f&&t>f.start&&(u=_(f,i),f=null,rt(n,u.b,"start"),b&&(p(),d=J(n,l,u.b,u.duration,0,c,a.css))),u)if(t>=u.end)y(l=u.b,1-l),rt(n,u.b,"end"),f||(u.b?p():--u.group.r||s(u.group.c)),u=null;else if(t>=u.start){const e=t-u.start;l=u.a+u.d*c(e/u.duration),y(l,1-l)}return!(!u&&!f)})))}return{run(t){i(a)?(nt||(nt=Promise.resolve(),nt.then((()=>{nt=null}))),nt).then((()=>{a=a(),y(t)})):y(t)},end(){p(),u=f=null}}}function dt(t,e){const n={},r={},o={$$scope:1};let s=t.length;for(;s--;){const i=t[s],c=e[s];if(c){for(const t in i)t in c||(r[t]=1);for(const t in c)o[t]||(n[t]=c[t],o[t]=1);t[s]=c}else for(const t in i)o[t]=1}for(const t in r)t in n||(n[t]=void 0);return n}function pt(t){return"object"==typeof t&&null!==t?t:{}}function ht(t){t&&t.c()}function mt(t,e){t&&t.l(e)}function gt(t,e,n,o){const{fragment:c,on_mount:a,on_destroy:l,after_update:u}=t.$$;c&&c.m(e,n),o||X((()=>{const e=a.map(r).filter(i);l?l.push(...e):s(e),t.$$.on_mount=[]})),u.forEach(X)}function $t(t,e){const n=t.$$;null!==n.fragment&&(s(n.on_destroy),n.fragment&&n.fragment.d(e),n.on_destroy=n.fragment=null,n.ctx=[])}function _t(t,e){-1===t.$$.dirty[0]&&(F.push(t),W||(W=!0,Y.then(tt)),t.$$.dirty.fill(0)),t.$$.dirty[e/31|0]|=1<<e%31}function yt(e,n,r,i,c,a,l=[-1]){const u=U;D(e);const f=e.$$={fragment:null,ctx:null,props:a,update:t,not_equal:c,bound:o(),on_mount:[],on_destroy:[],on_disconnect:[],before_update:[],after_update:[],context:new Map(u?u.$$.context:[]),callbacks:o(),dirty:l,skip_bound:!1};let d=!1;if(f.ctx=r?r(e,n.props||{},((t,n,...r)=>{const o=r.length?r[0]:n;return f.ctx&&c(f.ctx[t],f.ctx[t]=o)&&(!f.skip_bound&&f.bound[t]&&f.bound[t](o),d&&_t(e,t)),n})):[],f.update(),d=!0,s(f.before_update),f.fragment=!!i&&i(f.ctx),n.target){if(n.hydrate){const t=C(n.target);f.fragment&&f.fragment.l(t),t.forEach(b)}else f.fragment&&f.fragment.c();n.intro&&at(e.$$.fragment),gt(e,n.target,n.anchor,n.customElement),tt()}D(u)}class bt{$destroy(){$t(this,1),this.$destroy=t}$on(t,e){const n=this.$$.callbacks[t]||(this.$$.callbacks[t]=[]);return n.push(e),()=>{const t=n.indexOf(e);-1!==t&&n.splice(t,1)}}$set(t){var e;this.$$set&&(e=t,0!==Object.keys(e).length)&&(this.$$.skip_bound=!0,this.$$set(t),this.$$.skip_bound=!1)}}const vt=[];function wt(e,n=t){let r;const o=[];function s(t){if(c(e,t)&&(e=t,r)){const t=!vt.length;for(let t=0;t<o.length;t+=1){const n=o[t];n[1](),vt.push(n,e)}if(t){for(let t=0;t<vt.length;t+=2)vt[t][0](vt[t+1]);vt.length=0}}}return{set:s,update:function(t){s(t(e))},subscribe:function(i,c=t){const a=[i,c];return o.push(a),1===o.length&&(r=n(s)||t),i(e),()=>{const t=o.indexOf(a);-1!==t&&o.splice(t,1),0===o.length&&(r(),r=null)}}}}const Et={};function St(t){let e,n;const r=t[1].default,o=a(r,t,t[0],null);return{c(){o&&o.c(),e=x(),this.h()},l(t){o&&o.l(t),e=L(t);I('[data-svelte="svelte-drnbxg"]',document.head).forEach(b),this.h()},h(){document.title="Shriveling the world"},m(t,r){o&&o.m(t,r),y(t,e,r),n=!0},p(t,[e]){o&&o.p&&1&e&&u(o,r,t,t[0],e,null,null)},i(t){n||(at(o,t),n=!0)},o(t){lt(o,t),n=!1},d(t){o&&o.d(t),t&&b(e)}}}function xt(t,e,n){let{$$slots:r={},$$scope:o}=e;return t.$$set=t=>{"$$scope"in t&&n(0,o=t.$$scope)},[o,r]}class Pt extends bt{constructor(t){super(),yt(this,t,xt,St,c,{})}}function Rt(t){let e,n,r=t[1].stack+"";return{c(){e=w("pre"),n=S(r)},l(t){e=j(t,"PRE",{});var o=C(e);n=A(o,r),o.forEach(b)},m(t,r){y(t,e,r),_(e,n)},p(t,e){2&e&&r!==(r=t[1].stack+"")&&O(n,r)},d(t){t&&b(e)}}}function Nt(e){let n,r,o,s,i,c,a,l,u,f=e[1].message+"";document.title=n=e[0];let d=e[2]&&e[1].stack&&Rt(e);return{c(){r=x(),o=w("h1"),s=S(e[0]),i=x(),c=w("p"),a=S(f),l=S("\noops something went wrong, we are sorry, don't hesitate to create an issue in the [github](https://github.com/theworldisnotflat/shriveling_world/issues), we are still in beta mode\n"),d&&d.c(),u=P(),this.h()},l(t){I('[data-svelte="svelte-1o9r2ue"]',document.head).forEach(b),r=L(t),o=j(t,"H1",{class:!0});var n=C(o);s=A(n,e[0]),n.forEach(b),i=L(t),c=j(t,"P",{class:!0});var p=C(c);a=A(p,f),p.forEach(b),l=A(t,"\noops something went wrong, we are sorry, don't hesitate to create an issue in the [github](https://github.com/theworldisnotflat/shriveling_world/issues), we are still in beta mode\n"),d&&d.l(t),u=P(),this.h()},h(){N(o,"class","svelte-8lferx"),N(c,"class","svelte-8lferx")},m(t,e){y(t,r,e),y(t,o,e),_(o,s),y(t,i,e),y(t,c,e),_(c,a),y(t,l,e),d&&d.m(t,e),y(t,u,e)},p(t,[e]){1&e&&n!==(n=t[0])&&(document.title=n),1&e&&O(s,t[0]),2&e&&f!==(f=t[1].message+"")&&O(a,f),t[2]&&t[1].stack?d?d.p(t,e):(d=Rt(t),d.c(),d.m(u.parentNode,u)):d&&(d.d(1),d=null)},i:t,o:t,d(t){t&&b(r),t&&b(o),t&&b(i),t&&b(c),t&&b(l),d&&d.d(t),t&&b(u)}}}function Ct(t,e,n){let{status:r}=e,{error:o}=e;return t.$$set=t=>{"status"in t&&n(0,r=t.status),"error"in t&&n(1,o=t.error)},[r,o,false]}class jt extends bt{constructor(t){super(),yt(this,t,Ct,Nt,c,{status:0,error:1})}}function At(t){let e,r,o;const s=[t[4].props];var i=t[4].component;function c(t){let e={};for(let t=0;t<s.length;t+=1)e=n(e,s[t]);return{props:e}}return i&&(e=new i(c())),{c(){e&&ht(e.$$.fragment),r=P()},l(t){e&&mt(e.$$.fragment,t),r=P()},m(t,n){e&&gt(e,t,n),y(t,r,n),o=!0},p(t,n){const o=16&n?dt(s,[pt(t[4].props)]):{};if(i!==(i=t[4].component)){if(e){it();const t=e;lt(t.$$.fragment,1,0,(()=>{$t(t,1)})),ct()}i?(e=new i(c()),ht(e.$$.fragment),at(e.$$.fragment,1),gt(e,r.parentNode,r)):e=null}else i&&e.$set(o)},i(t){o||(e&&at(e.$$.fragment,t),o=!0)},o(t){e&&lt(e.$$.fragment,t),o=!1},d(t){t&&b(r),e&&$t(e,t)}}}function Lt(t){let e,n;return e=new jt({props:{error:t[0],status:t[1]}}),{c(){ht(e.$$.fragment)},l(t){mt(e.$$.fragment,t)},m(t,r){gt(e,t,r),n=!0},p(t,n){const r={};1&n&&(r.error=t[0]),2&n&&(r.status=t[1]),e.$set(r)},i(t){n||(at(e.$$.fragment,t),n=!0)},o(t){lt(e.$$.fragment,t),n=!1},d(t){$t(e,t)}}}function Ot(t){let e,n,r,o;const s=[Lt,At],i=[];function c(t,e){return t[0]?0:1}return e=c(t),n=i[e]=s[e](t),{c(){n.c(),r=P()},l(t){n.l(t),r=P()},m(t,n){i[e].m(t,n),y(t,r,n),o=!0},p(t,o){let a=e;e=c(t),e===a?i[e].p(t,o):(it(),lt(i[a],1,1,(()=>{i[a]=null})),ct(),n=i[e],n?n.p(t,o):(n=i[e]=s[e](t),n.c()),at(n,1),n.m(r.parentNode,r))},i(t){o||(at(n),o=!0)},o(t){lt(n),o=!1},d(t){i[e].d(t),t&&b(r)}}}function kt(t){let e,r;const o=[{segment:t[2][0]},t[3].props];let s={$$slots:{default:[Ot]},$$scope:{ctx:t}};for(let t=0;t<o.length;t+=1)s=n(s,o[t]);return e=new Pt({props:s}),{c(){ht(e.$$.fragment)},l(t){mt(e.$$.fragment,t)},m(t,n){gt(e,t,n),r=!0},p(t,[n]){const r=12&n?dt(o,[4&n&&{segment:t[2][0]},8&n&&pt(t[3].props)]):{};147&n&&(r.$$scope={dirty:n,ctx:t}),e.$set(r)},i(t){r||(at(e.$$.fragment,t),r=!0)},o(t){lt(e.$$.fragment,t),r=!1},d(t){$t(e,t)}}}function It(t,e,n){let{stores:r}=e,{error:o}=e,{status:s}=e,{segments:i}=e,{level0:c}=e,{level1:a=null}=e,{notify:l}=e;var u,f;return M(l),u=Et,f=r,K().$$.context.set(u,f),t.$$set=t=>{"stores"in t&&n(5,r=t.stores),"error"in t&&n(0,o=t.error),"status"in t&&n(1,s=t.status),"segments"in t&&n(2,i=t.segments),"level0"in t&&n(3,c=t.level0),"level1"in t&&n(4,a=t.level1),"notify"in t&&n(6,l=t.notify)},[o,s,i,c,a,r,l]}class Tt extends bt{constructor(t){super(),yt(this,t,It,kt,c,{stores:5,error:0,status:1,segments:2,level0:3,level1:4,notify:6})}}const Ut=[/^\/marks\/(.+)\.json$/],qt=[{js:()=>Promise.all([import("./index.5447dc79.js"),__inject_styles(["client-325e7710.css","menu-178d3906.css","index-c6872644.css"])]).then((function(t){return t[0]}))},{js:()=>Promise.all([import("./about.e93e5b01.js"),__inject_styles(["client-325e7710.css"])]).then((function(t){return t[0]}))},{js:()=>Promise.all([import("./[...slug].622ee89e.js"),__inject_styles(["client-325e7710.css","menu-178d3906.css","[...slug]-d96b7141.css"])]).then((function(t){return t[0]}))},{js:()=>Promise.all([import("./index.7438236d.js"),__inject_styles(["client-325e7710.css","menu-178d3906.css","index-5491e7ca.css"])]).then((function(t){return t[0]}))},{js:()=>Promise.all([import("./index.ac19222f.js"),__inject_styles(["client-325e7710.css","menu-178d3906.css","index-4cc1ad90.css"])]).then((function(t){return t[0]}))}],Jt=(Bt=decodeURIComponent,[{pattern:/^\/$/,parts:[{i:0}]},{pattern:/^\/about\/?$/,parts:[{i:1}]},{pattern:/^\/marks\/(.+)\/?$/,parts:[null,{i:2,params:t=>({slug:Bt(t[1]).split("/")})}]},{pattern:/^\/app\/?$/,parts:[{i:3}]},{pattern:/^\/doc\/?$/,parts:[{i:4}]}]);var Bt;
/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
function Dt(t,e,n,r){return new(n||(n=Promise))((function(o,s){function i(t){try{a(r.next(t))}catch(t){s(t)}}function c(t){try{a(r.throw(t))}catch(t){s(t)}}function a(t){var e;t.done?o(t.value):(e=t.value,e instanceof n?e:new n((function(t){t(e)}))).then(i,c)}a((r=r.apply(t,e||[])).next())}))}function Kt(t){for(;t&&"A"!==t.nodeName.toUpperCase();)t=t.parentNode;return t}let zt,Mt=1;const Ft="undefined"!=typeof history?history:{pushState:()=>{},replaceState:()=>{},scrollRestoration:"auto"},Ht={};let Vt,Gt;function Yt(t){const e=Object.create(null);return t.length?(t=>"undefined"!=typeof URLSearchParams?[...new URLSearchParams(t).entries()]:t.slice(1).split("&").map((t=>{const[,e,n=""]=/([^=]*)(?:=([\S\s]*))?/.exec(decodeURIComponent(t.replace(/\+/g," ")));return[e,n]})))(t).reduce(((t,[e,n])=>("string"==typeof t[e]&&(t[e]=[t[e]]),"object"==typeof t[e]?t[e].push(n):t[e]=n,t)),e):e}function Wt(t){if(t.origin!==location.origin)return null;if(!t.pathname.startsWith(Vt))return null;let e=t.pathname.slice(Vt.length);if(""===e&&(e="/"),!Ut.some((t=>t.test(e))))for(let n=0;n<Jt.length;n+=1){const r=Jt[n],o=r.pattern.exec(e);if(o){const n=Yt(t.search),s=r.parts[r.parts.length-1],i=s.params?s.params(o):{},c={host:location.host,path:e,query:n,params:i};return{href:t.href,route:r,match:o,page:c}}}}function Xt(t){if(1!==function(t){return null===t.which?t.button:t.which}(t))return;if(t.metaKey||t.ctrlKey||t.shiftKey||t.altKey)return;if(t.defaultPrevented)return;const e=Kt(t.target);if(!e)return;if(!e.href)return;const n="object"==typeof e.href&&"SVGAnimatedString"===e.href.constructor.name,r=String(n?e.href.baseVal:e.href);if(r===location.href)return void(location.hash||t.preventDefault());if(e.hasAttribute("download")||"external"===e.getAttribute("rel"))return;if(n?e.target.baseVal:e.target)return;const o=new URL(r);if(o.pathname===location.pathname&&o.search===location.search)return;const s=Wt(o);if(s){te(s,null,e.hasAttribute("sapper:noscroll"),o.hash),t.preventDefault(),Ft.pushState({id:zt},"",o.href)}}function Qt(){return{x:pageXOffset,y:pageYOffset}}function Zt(t){if(Ht[zt]=Qt(),t.state){const e=Wt(new URL(location.href));e?te(e,t.state.id):location.href=location.href}else Mt=Mt+1,function(t){zt=t}(Mt),Ft.replaceState({id:zt},"",location.href)}function te(t,e,n,r){return Dt(this,void 0,void 0,(function*(){const o=!!e;if(o)zt=e;else{const t=Qt();Ht[zt]=t,zt=e=++Mt,Ht[zt]=n?t:{x:0,y:0}}if(yield Gt(t),document.activeElement&&document.activeElement instanceof HTMLElement&&document.activeElement.blur(),!n){let t,n=Ht[e];r&&(t=document.getElementById(r.slice(1)),t&&(n={x:0,y:t.getBoundingClientRect().top+scrollY})),Ht[zt]=n,n&&(o||t)?scrollTo(n.x,n.y):scrollTo(0,0)}}))}function ee(t){let e=t.baseURI;if(!e){const n=t.getElementsByTagName("base");e=n.length?n[0].href:t.URL}return e}let ne,re=null;function oe(t){const e=Kt(t.target);e&&e.hasAttribute("sapper:prefetch")&&function(t){const e=Wt(new URL(t,ee(document)));if(e)re&&t===re.href||(re={href:t,promise:ve(e)}),re.promise}(e.href)}function se(t){clearTimeout(ne),ne=setTimeout((()=>{oe(t)}),20)}function ie(t,e={noscroll:!1,replaceState:!1}){const n=Wt(new URL(t,ee(document)));if(n){const r=te(n,null,e.noscroll);return Ft[e.replaceState?"replaceState":"pushState"]({id:zt},"",t),r}return location.href=t,new Promise((()=>{}))}const ce="undefined"!=typeof __SAPPER__&&__SAPPER__;let ae,le,ue,fe=!1,de=[],pe="{}";const he={page:function(t){const e=wt(t);let n=!0;return{notify:function(){n=!0,e.update((t=>t))},set:function(t){n=!1,e.set(t)},subscribe:function(t){let r;return e.subscribe((e=>{(void 0===r||n&&e!==r)&&t(r=e)}))}}}({}),preloading:wt(null),session:wt(ce&&ce.session)};let me,ge,$e;function _e(t,e){const{error:n}=t;return Object.assign({error:n},e)}function ye(t){return Dt(this,void 0,void 0,(function*(){ae&&he.preloading.set(!0);const e=function(t){return re&&re.href===t.href?re.promise:ve(t)}(t),n=le={},r=yield e,{redirect:o}=r;if(n===le)if(o)yield ie(o.location,{replaceState:!0});else{const{props:e,branch:n}=r;yield be(n,e,_e(e,t.page))}}))}function be(t,e,n){return Dt(this,void 0,void 0,(function*(){he.page.set(n),he.preloading.set(!1),ae?ae.$set(e):(e.stores={page:{subscribe:he.page.subscribe},preloading:{subscribe:he.preloading.subscribe},session:he.session},e.level0={props:yield ue},e.notify=he.page.notify,ae=new Tt({target:$e,props:e,hydrate:!0})),de=t,pe=JSON.stringify(n.query),fe=!0,ge=!1}))}function ve(t){return Dt(this,void 0,void 0,(function*(){const{route:e,page:n}=t,r=n.path.split("/").filter(Boolean);let o=null;const s={error:null,status:200,segments:[r[0]]},i={fetch:(t,e)=>fetch(t,e),redirect:(t,e)=>{if(o&&(o.statusCode!==t||o.location!==e))throw new Error("Conflicting redirects");o={statusCode:t,location:e}},error:(t,e)=>{s.error="string"==typeof e?new Error(e):e,s.status=t}};if(!ue){const t=()=>({});ue=ce.preloaded[0]||t.call(i,{host:n.host,path:n.path,query:n.query,params:{}},me)}let c,a=1;try{const o=JSON.stringify(n.query),l=e.pattern.exec(n.path);let u=!1;c=yield Promise.all(e.parts.map(((e,c)=>Dt(this,void 0,void 0,(function*(){const f=r[c];if(function(t,e,n,r){if(r!==pe)return!0;const o=de[t];return!!o&&(e!==o.segment||!(!o.match||JSON.stringify(o.match.slice(1,t+2))===JSON.stringify(n.slice(1,t+2)))||void 0)}(c,f,l,o)&&(u=!0),s.segments[a]=r[c+1],!e)return{segment:f};const d=a++;let p;if(ge||u||!de[c]||de[c].part!==e.i){u=!1;const{default:r,preload:o}=yield qt[e.i].js();let s;s=fe||!ce.preloaded[c+1]?o?yield o.call(i,{host:n.host,path:n.path,query:n.query,params:e.params?e.params(t.match):{}},me):{}:ce.preloaded[c+1],p={component:r,props:s,segment:f,match:l,part:e.i}}else p=de[c];return s[`level${d}`]=p})))))}catch(t){s.error=t,s.status=500,c=[]}return{redirect:o,props:s,branch:c}}))}var we,Ee,Se;he.session.subscribe((t=>Dt(void 0,void 0,void 0,(function*(){if(me=t,!fe)return;ge=!0;const e=Wt(new URL(location.href)),n=le={},{redirect:r,props:o,branch:s}=yield ve(e);n===le&&(r?yield ie(r.location,{replaceState:!0}):yield be(s,o,_e(o,e.page)))})))),we={target:document.querySelector("#sapper")},Ee=we.target,$e=Ee,Se=ce.baseUrl,Vt=Se,Gt=ye,"scrollRestoration"in Ft&&(Ft.scrollRestoration="manual"),addEventListener("beforeunload",(()=>{Ft.scrollRestoration="auto"})),addEventListener("load",(()=>{Ft.scrollRestoration="manual"})),addEventListener("click",Xt),addEventListener("popstate",Zt),addEventListener("touchstart",oe),addEventListener("mousemove",se),ce.error?Promise.resolve().then((()=>function(){const{host:t,pathname:e,search:n}=location,{session:r,preloaded:o,status:s,error:i}=ce;ue||(ue=o&&o[0]);const c={error:i,status:s,session:r,level0:{props:ue},level1:{props:{status:s,error:i},component:jt},segments:o},a=Yt(n);be([],c,{host:t,path:e,query:a,params:{},error:i})}())):Promise.resolve().then((()=>{const{hash:t,href:e}=location;Ft.replaceState({id:Mt},"",e);const n=Wt(new URL(location.href));if(n)return te(n,Mt,!0,t)}));export{a as A,R as B,it as C,ct as D,u as E,I as F,z as G,M as H,k as I,O as J,v as K,H as L,bt as S,mt as a,lt as b,ht as c,$t as d,w as e,S as f,j as g,C as h,yt as i,A as j,b as k,N as l,gt as m,y as n,_ as o,E as p,d as q,t as r,c as s,at as t,n as u,f as v,x as w,L as x,X as y,ft as z};

import __inject_styles from './inject_styles.5607aec6.js';