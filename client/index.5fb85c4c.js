import{S as t,i as s,s as e,c as a,a as r,m as o,t as c,b as n,d as i,e as l,g as m,h,k as d,l as f,n as $}from"./client.32134592.js";import{M as u}from"./menu.2c2312d1.js";function g(t){let s,e;return{c(){s=l("iframe"),this.h()},l(t){s=m(t,"IFRAME",{src:!0,frameborder:!0,height:!0,width:!0,scrolling:!0,title:!0,class:!0}),h(s).forEach(d),this.h()},h(){s.src!==(e="documentation.html")&&f(s,"src","documentation.html"),f(s,"frameborder","0"),f(s,"height","99vh"),f(s,"width","99vw"),f(s,"scrolling","auto"),f(s,"title","documentation"),f(s,"class","svelte-1f7wgx7")},m(t,e){$(t,s,e)},d(t){t&&d(s)}}}function p(t){let s,e;return s=new u({props:{$$slots:{default:[g]},$$scope:{ctx:t}}}),{c(){a(s.$$.fragment)},l(t){r(s.$$.fragment,t)},m(t,a){o(s,t,a),e=!0},p(t,[e]){const a={};1&e&&(a.$$scope={dirty:e,ctx:t}),s.$set(a)},i(t){e||(c(s.$$.fragment,t),e=!0)},o(t){n(s.$$.fragment,t),e=!1},d(t){i(s,t)}}}export default class extends t{constructor(t){super(),s(this,t,null,p,e,{})}}