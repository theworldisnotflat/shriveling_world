import{S as s,i as t,s as a,c as e,a as r,m as c,t as n,b as o,d as f,e as i,f as l,g as $,h as m,j as u,k as h,l as d,n as p,o as x}from"./client.e081f47f.js";import{M as g}from"./menu.170d5b22.js";function b(s){let t,a;return{c(){t=i("h1"),a=l("Great success!"),this.h()},l(s){t=$(s,"H1",{class:!0});var e=m(t);a=u(e,"Great success!"),e.forEach(h),this.h()},h(){d(t,"class","svelte-mbs4hh")},m(s,e){p(s,t,e),x(t,a)},d(s){s&&h(t)}}}function j(s){let t,a;return t=new g({props:{fixed:!1,$$slots:{default:[b]},$$scope:{ctx:s}}}),{c(){e(t.$$.fragment)},l(s){r(t.$$.fragment,s)},m(s,e){c(t,s,e),a=!0},p(s,[a]){const e={};1&a&&(e.$$scope={dirty:a,ctx:s}),t.$set(e)},i(s){a||(n(t.$$.fragment,s),a=!0)},o(s){o(t.$$.fragment,s),a=!1},d(s){f(t,s)}}}async function k(){return this.redirect(302,"marks/index")}export default class extends s{constructor(s){super(),t(this,s,null,j,a,{})}}export{k as preload};