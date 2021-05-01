import{S as a,i as s,s as e,p as t,g as c,h as r,k as l,l as o,q as i,n,o as h,r as u,u as f,v as d,e as p,f as v,c as m,w,j as g,a as $,x as E,m as b,t as x,y,z as D,b as L,d as A,A as I,B,C as F,D as _,E as C}from"./client.58ccd471.js";function U(a){let s,e,f;return{c(){s=t("svg"),e=t("path"),this.h()},l(a){s=c(a,"svg",{"aria-hidden":!0,class:!0,role:!0,xmlns:!0,viewBox:!0},1);var t=r(s);e=c(t,"path",{fill:!0,d:!0},1),r(e).forEach(l),t.forEach(l),this.h()},h(){o(e,"fill","currentColor"),o(e,"d",a[0]),o(s,"aria-hidden","true"),o(s,"class",f=i(a[1])+" svelte-1d15yci"),o(s,"role","img"),o(s,"xmlns","http://www.w3.org/2000/svg"),o(s,"viewBox",a[2])},m(a,t){n(a,s,t),h(s,e)},p(a,[t]){1&t&&o(e,"d",a[0]),2&t&&f!==(f=i(a[1])+" svelte-1d15yci")&&o(s,"class",f),4&t&&o(s,"viewBox",a[2])},i:u,o:u,d(a){a&&l(s)}}}function k(a,s,e){let{icon:t}=s,c=[],r="",l="";return a.$$set=a=>{e(4,s=f(f({},s),d(a))),"icon"in a&&e(3,t=a.icon)},a.$$.update=()=>{8&a.$$.dirty&&e(2,l="0 0 "+t.icon[0]+" "+t.icon[1]),e(1,r="fa-svelte "+(s.class?s.class:"")),8&a.$$.dirty&&e(0,c=t.icon[4])},s=d(s),[c,r,l,t]}class S extends a{constructor(a){super(),s(this,a,k,U,e,{icon:3})}}var T="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:{};function q(a){var s={exports:{}};return a(s,s.exports),s.exports}function M(a){throw new Error('Could not dynamically require "'+a+'". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.')}var N=q((function(a,s){Object.defineProperty(s,"__esModule",{value:!0});var e="caret-down",t=[],c="f0d7",r="M31.3 192h257.3c17.8 0 26.7 21.5 14.1 34.1L174.1 354.8c-7.8 7.8-20.5 7.8-28.3 0L17.2 226.1C4.6 213.5 13.5 192 31.3 192z";s.definition={prefix:"fas",iconName:e,icon:[320,512,t,c,r]},s.faCaretDown=s.definition,s.prefix="fas",s.iconName=e,s.width=320,s.height=512,s.ligatures=t,s.unicode=c,s.svgPathData=r}));function j(a){const s=a-1;return s*s*s+1}function P(a,{delay:s=0,duration:e=400,easing:t=j}={}){const c=getComputedStyle(a),r=+c.opacity,l=parseFloat(c.height),o=parseFloat(c.paddingTop),i=parseFloat(c.paddingBottom),n=parseFloat(c.marginTop),h=parseFloat(c.marginBottom),u=parseFloat(c.borderTopWidth),f=parseFloat(c.borderBottomWidth);return{delay:s,duration:e,easing:t,css:a=>`overflow: hidden;opacity: ${Math.min(20*a,1)*r};height: ${a*l}px;padding-top: ${a*o}px;padding-bottom: ${a*i}px;margin-top: ${a*n}px;margin-bottom: ${a*h}px;border-top-width: ${a*u}px;border-bottom-width: ${a*f}px;`}}function z(a){let s,e,t,i,f,d,I,B,F,_,C,U,k,T,q,M,j,z,G,R,W,O,V,Y,H,J,K,Q,X,Z,aa,sa,ea,ta,ca,ra,la,oa,ia,na,ha,ua,fa,da,pa,va,ma,wa,ga,$a,Ea,ba,xa,ya,Da,La,Aa,Ia,Ba,Fa,_a;return d=new S({props:{icon:N.faCaretDown}}),Y=new S({props:{icon:N.faCaretDown}}),va=new S({props:{icon:N.faCaretDown}}),{c(){s=p("nav"),e=p("ul"),t=p("li"),i=p("a"),f=v("Shriveling world\n\t\t\t\t\t"),m(d.$$.fragment),I=w(),B=p("ul"),F=p("li"),_=p("a"),C=v("Scientific blog"),U=w(),k=p("li"),T=p("a"),q=v("Github"),M=w(),j=p("li"),z=p("a"),G=v("Application"),R=w(),W=p("li"),O=p("a"),V=v("User Doc\n\t\t\t\t\t"),m(Y.$$.fragment),H=w(),J=p("ul"),K=p("li"),Q=p("a"),X=v("Basic Usage tutorial"),Z=w(),aa=p("li"),sa=p("a"),ea=v("Forum"),ta=w(),ca=p("li"),ra=p("a"),la=v("Dataset creation"),oa=w(),ia=p("li"),na=p("a"),ha=v("Blender tutorial"),ua=w(),fa=p("li"),da=p("a"),pa=v("Dev Doc\n\t\t\t\t\t"),m(va.$$.fragment),ma=w(),wa=p("ul"),ga=p("li"),$a=p("a"),Ea=v("Developer instructions"),ba=w(),xa=p("li"),ya=p("a"),Da=v("Developer documentation"),La=w(),Aa=p("li"),Ia=p("a"),Ba=v("Forum"),this.h()},l(a){s=c(a,"NAV",{class:!0,role:!0});var o=r(s);e=c(o,"UL",{class:!0});var n=r(e);t=c(n,"LI",{class:!0,"aria-haspopup":!0});var h=r(t);i=c(h,"A",{href:!0,class:!0});var u=r(i);f=g(u,"Shriveling world\n\t\t\t\t\t"),$(d.$$.fragment,u),u.forEach(l),I=E(h),B=c(h,"UL",{class:!0,"aria-label":!0});var p=r(B);F=c(p,"LI",{class:!0});var v=r(F);_=c(v,"A",{href:!0,class:!0});var m=r(_);C=g(m,"Scientific blog"),m.forEach(l),v.forEach(l),U=E(p),k=c(p,"LI",{class:!0});var w=r(k);T=c(w,"A",{href:!0,class:!0});var b=r(T);q=g(b,"Github"),b.forEach(l),w.forEach(l),p.forEach(l),h.forEach(l),M=E(n),j=c(n,"LI",{class:!0});var x=r(j);z=c(x,"A",{href:!0,class:!0});var y=r(z);G=g(y,"Application"),y.forEach(l),x.forEach(l),R=E(n),W=c(n,"LI",{class:!0,"aria-haspopup":!0});var D=r(W);O=c(D,"A",{href:!0,class:!0});var L=r(O);V=g(L,"User Doc\n\t\t\t\t\t"),$(Y.$$.fragment,L),L.forEach(l),H=E(D),J=c(D,"UL",{class:!0,"aria-label":!0});var A=r(J);K=c(A,"LI",{class:!0});var S=r(K);Q=c(S,"A",{href:!0,class:!0});var N=r(Q);X=g(N,"Basic Usage tutorial"),N.forEach(l),S.forEach(l),Z=E(A),aa=c(A,"LI",{class:!0});var P=r(aa);sa=c(P,"A",{href:!0,class:!0});var Fa=r(sa);ea=g(Fa,"Forum"),Fa.forEach(l),P.forEach(l),ta=E(A),ca=c(A,"LI",{class:!0});var _a=r(ca);ra=c(_a,"A",{href:!0,class:!0});var Ca=r(ra);la=g(Ca,"Dataset creation"),Ca.forEach(l),_a.forEach(l),oa=E(A),ia=c(A,"LI",{class:!0});var Ua=r(ia);na=c(Ua,"A",{href:!0,class:!0});var ka=r(na);ha=g(ka,"Blender tutorial"),ka.forEach(l),Ua.forEach(l),A.forEach(l),D.forEach(l),ua=E(n),fa=c(n,"LI",{class:!0,"aria-haspopup":!0});var Sa=r(fa);da=c(Sa,"A",{href:!0,class:!0});var Ta=r(da);pa=g(Ta,"Dev Doc\n\t\t\t\t\t"),$(va.$$.fragment,Ta),Ta.forEach(l),ma=E(Sa),wa=c(Sa,"UL",{class:!0,"aria-label":!0});var qa=r(wa);ga=c(qa,"LI",{class:!0});var Ma=r(ga);$a=c(Ma,"A",{href:!0,class:!0});var Na=r($a);Ea=g(Na,"Developer instructions"),Na.forEach(l),Ma.forEach(l),ba=E(qa),xa=c(qa,"LI",{class:!0});var ja=r(xa);ya=c(ja,"A",{href:!0,class:!0});var Pa=r(ya);Da=g(Pa,"Developer documentation"),Pa.forEach(l),ja.forEach(l),La=E(qa),Aa=c(qa,"LI",{class:!0});var za=r(Aa);Ia=c(za,"A",{href:!0,class:!0});var Ga=r(Ia);Ba=g(Ga,"Forum"),Ga.forEach(l),za.forEach(l),qa.forEach(l),Sa.forEach(l),n.forEach(l),o.forEach(l),this.h()},h(){o(i,"href","./"),o(i,"class","svelte-c1wctc"),o(_,"href","https://timespace.hypotheses.org/"),o(_,"class","svelte-c1wctc"),o(F,"class","menu-item svelte-c1wctc"),o(T,"href","https://github.com/theworldisnotflat/shriveling_world"),o(T,"class","svelte-c1wctc"),o(k,"class","menu-item svelte-c1wctc"),o(B,"class","sub-menu svelte-c1wctc"),o(B,"aria-label","submenu"),o(t,"class","menu-item svelte-c1wctc"),o(t,"aria-haspopup","true"),o(z,"href","app"),o(z,"class","svelte-c1wctc"),o(j,"class","menu-item svelte-c1wctc"),o(O,"href","#0"),o(O,"class","svelte-c1wctc"),o(Q,"href","marks/usrdoc/basic_usage_tutorial"),o(Q,"class","svelte-c1wctc"),o(K,"class","menu-item svelte-c1wctc"),o(sa,"href","https://github.com/theworldisnotflat/shriveling_world/discussions"),o(sa,"class","svelte-c1wctc"),o(aa,"class","menu-item svelte-c1wctc"),o(ra,"href","marks/usrdoc/create_dataset"),o(ra,"class","svelte-c1wctc"),o(ca,"class","menu-item svelte-c1wctc"),o(na,"href","marks/usrdoc/blender_tutorial"),o(na,"class","svelte-c1wctc"),o(ia,"class","menu-item svelte-c1wctc"),o(J,"class","sub-menu svelte-c1wctc"),o(J,"aria-label","submenu"),o(W,"class","menu-item svelte-c1wctc"),o(W,"aria-haspopup","true"),o(da,"href","doc"),o(da,"class","svelte-c1wctc"),o($a,"href","marks/devdoc/dev_instructions"),o($a,"class","svelte-c1wctc"),o(ga,"class","menu-item svelte-c1wctc"),o(ya,"href","doc"),o(ya,"class","svelte-c1wctc"),o(xa,"class","menu-item svelte-c1wctc"),o(Ia,"href","https://github.com/theworldisnotflat/shriveling_world/discussions"),o(Ia,"class","svelte-c1wctc"),o(Aa,"class","menu-item svelte-c1wctc"),o(wa,"class","sub-menu svelte-c1wctc"),o(wa,"aria-label","submenu"),o(fa,"class","menu-item svelte-c1wctc"),o(fa,"aria-haspopup","true"),o(e,"class","svelte-c1wctc"),o(s,"class","menu svelte-c1wctc"),o(s,"role","navigation")},m(a,c){n(a,s,c),h(s,e),h(e,t),h(t,i),h(i,f),b(d,i,null),h(t,I),h(t,B),h(B,F),h(F,_),h(_,C),h(B,U),h(B,k),h(k,T),h(T,q),h(e,M),h(e,j),h(j,z),h(z,G),h(e,R),h(e,W),h(W,O),h(O,V),b(Y,O,null),h(W,H),h(W,J),h(J,K),h(K,Q),h(Q,X),h(J,Z),h(J,aa),h(aa,sa),h(sa,ea),h(J,ta),h(J,ca),h(ca,ra),h(ra,la),h(J,oa),h(J,ia),h(ia,na),h(na,ha),h(e,ua),h(e,fa),h(fa,da),h(da,pa),b(va,da,null),h(fa,ma),h(fa,wa),h(wa,ga),h(ga,$a),h($a,Ea),h(wa,ba),h(wa,xa),h(xa,ya),h(ya,Da),h(wa,La),h(wa,Aa),h(Aa,Ia),h(Ia,Ba),_a=!0},p:u,i(a){_a||(x(d.$$.fragment,a),x(Y.$$.fragment,a),x(va.$$.fragment,a),y((()=>{Fa||(Fa=D(s,P,{delay:250,duration:600},!0)),Fa.run(1)})),_a=!0)},o(a){L(d.$$.fragment,a),L(Y.$$.fragment,a),L(va.$$.fragment,a),Fa||(Fa=D(s,P,{delay:250,duration:600},!1)),Fa.run(0),_a=!1},d(a){a&&l(s),A(d),A(Y),A(va),a&&Fa&&Fa.end()}}}function G(a){let s,e,t,i,h,u=a[0]&&z();const f=a[4].default,d=I(f,a,a[3],null);return{c(){u&&u.c(),s=w(),e=p("main"),d&&d.c(),this.h()},l(a){u&&u.l(a),s=E(a),e=c(a,"MAIN",{class:!0});var t=r(e);d&&d.l(t),t.forEach(l),this.h()},h(){o(e,"class","svelte-c1wctc")},m(c,r){u&&u.m(c,r),n(c,s,r),n(c,e,r),d&&d.m(e,null),t=!0,i||(h=B(e,"mousemove",a[1]),i=!0)},p(a,[e]){a[0]?u?(u.p(a,e),1&e&&x(u,1)):(u=z(),u.c(),x(u,1),u.m(s.parentNode,s)):u&&(F(),L(u,1,1,(()=>{u=null})),_()),d&&d.p&&(!t||8&e)&&C(d,f,a,a[3],e,null,null)},i(a){t||(x(u),x(d,a),t=!0)},o(a){L(u),L(d,a),t=!1},d(a){u&&u.d(a),a&&l(s),a&&l(e),d&&d.d(a),i=!1,h()}}}function R(a,s,e){let{$$slots:t={},$$scope:c}=s,{fixed:r=!0}=s,l=!0;return a.$$set=a=>{"fixed"in a&&e(2,r=a.fixed),"$$scope"in a&&e(3,c=a.$$scope)},[l,function(a){e(0,l=!!r||a.clientY<80)},r,c,t]}class W extends a{constructor(a){super(),s(this,a,R,G,e,{fixed:2})}}export{W as M,T as a,M as b,q as c};
