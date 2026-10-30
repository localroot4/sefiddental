/**
 * The inline layout latch of the pins (phase 7 F2, F3): writes `html[data-pins]` before the first
 * paint when the latch that the tier store sets at hydration will pin, so the sticky stages and
 * their rooms (`HomeSection.tsx` PinRoom) are in the document the browser restores a reload into
 * and places an anchor in. Rendered with the request nonce by `IntroScript`, after the intro
 * script and long before the restored scroll or an anchor target exists; the root's
 * `data-site-cap` precedes it.
 *
 * The inputs are the store's own at hydration (`tierStore.ts` `derive`, before any probe): reduced
 * motion and `(min-width: 1024px)`; `?tier=N` (fixed, or auto with `monitor=1`), else the saved
 * «کیفیت» (`sefid-quality`), else detection before the probe: the cached detect-gpu answer
 * (`sefid-gpu`, `hydrationGpu`'s rules, then the renderer, device memory and Save-Data rules of
 * `selectTier`), or tier 1 without one; the site cap; and in auto mode the session's monitor cap
 * (`sefid-tier-cap`). Pins need tier 2 or more
 * from 1024 px (`tierSettings`). Blocked storage reads as empty, and any error leaves the
 * attribute off: `ExperienceRoot` then writes it with the engine, as before. pinsScript.test.ts
 * checks the script against the store.
 */
export const PINS_SCRIPT =
  '(function(){try{var d=document,n=navigator,v=/^[0-3]$/,p=new URLSearchParams(location.search),q=p.get("tier"),r=d.querySelector("[data-experience-root]"),c=r&&r.getAttribute("data-site-cap"),s,t,k,o,y;function g(f){try{return f()}catch(e){return null}}function m(x){return matchMedia(x).matches}s=g(function(){return localStorage.getItem("sefid-quality")});q=v.test(q)?+q:null;s=v.test(s)?+s:null;if(q!==null)t=q;else if(s!==null)t=s;else{t=1;o=g(function(){var j=JSON.parse(localStorage.getItem("sefid-gpu"));return j&&typeof j=="object"&&!Array.isArray(j)&&j.v==="5.0.70"&&typeof j.renderer=="string"&&typeof j.tier=="number"&&typeof j.type=="string"&&/^(SSR|WEBGL_UNSUPPORTED|BLOCKLISTED|FALLBACK|BENCHMARK)$/.test(j.type)&&(j.fps==null||typeof j.fps=="number")?j:null});if(o)t=o.type==="BENCHMARK"?(isFinite(o.tier)?Math.min(3,Math.max(0,Math.floor(o.tier))):0):o.type==="FALLBACK"?1:0;y=n.deviceMemory;if(typeof y=="number"&&y<=4)t=Math.min(t,y<=2?1:2);if((n.connection||{}).saveData===true||o&&/swiftshader|llvmpipe|softpipe|lavapipe|software rasterizer|basic render driver|apple software renderer/i.test(o.renderer))t=0}if(v.test(c))t=Math.min(t,+c);if((q===null||p.get("monitor")==="1")&&s===null){k=g(function(){return sessionStorage.getItem("sefid-tier-cap")});if(v.test(k))t=Math.min(t,+k)}if(t>=2&&m("(min-width:1024px)")&&!m("(prefers-reduced-motion:reduce)"))d.documentElement.setAttribute("data-pins","")}catch(e){}})();';
