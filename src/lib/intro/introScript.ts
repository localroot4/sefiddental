/**
 * The home intro's inline assets (phase 7 scene 0; report decisions D10, D11, D14): the script
 * that opens `<dialog id="intro">` before first paint, and the dialog's stylesheet. Both are
 * rendered inline by `IntroOverlay` with the request nonce; the script is also allowed by its
 * hash in the public CSP, so the exact bytes matter: any edit must update INTRO_SCRIPT_SHA256
 * (introScript.test.ts recomputes it and pins the size under 2048 bytes).
 *
 * What the script does, in order. It exits (no overlay, `html[data-intro]` absent) off the home
 * path, under reduced motion, with Save-Data, with a saved «کیفیت» of 0, once per session
 * (`sessionStorage['sefid-intro']`), with an active light floor (`localStorage['sefid-light']`,
 * `n` at least 2 and `until` ahead), or in phone mode (no fine pointer, under 1024 px) with
 * `navigator.deviceMemory` at most 2: a weak phone's keyframes would compete with its LCP and
 * hydration (phone spec D23). Else it arms the 1400 ms cap, marks `html[data-intro]`
 * `playing`, opens the dialog as a modal (the page behind is inert, Esc closes it natively),
 * marks `intro:start`, and stages the choreography by timers from its own start: `s2` at 500 ms
 * (strokes snap, the word fills), `s3` at 900 ms (the frame opens onto the hero), the end at
 * 1300 ms. The bar is `--intro-p` on the dialog (an inherited custom property written on `<html>`
 * restyles the whole document, about 10 ms per write at 1x): the mean of four loading shares (a 400 ms floor,
 * the fonts after the first layout, the hero image decode, `load`), plus a fifth share once
 * phase 8 feeds `sefid:intro-progress` (`detail.p` in 0..1). A click anywhere on the dialog
 * (the last event of a tap or a mouse press: closing on pointer down or up lets the click the
 * browser synthesizes after touchend land on what is beneath, the hero's call link included),
 * any key, a native close or a reduced-motion switch ends it early. The end closes the dialog, sets
 * `data-intro="done"`, stores the session flag, marks `intro:end`, removes every listener and
 * dispatches `sefid:intro-end` with `{ skipped, reduced }`. The end also moves the sequential
 * focus start to the body, so the next Tab (or the ending Tab itself) lands on the site's skip
 * link instead of the element after the dialog. Wheel events on the dialog are cancelled: the
 * dialog is not a scroll container (see the stylesheet), so they would scroll the page beneath.
 * Everything after the cap timer runs in one try/catch whose catch ends the intro.
 */
export const INTRO_SCRIPT =
  '(function(){var d=document,h=d.documentElement,D=d.getElementById("intro"),M=matchMedia("(prefers-reduced-motion:reduce)"),S={},L=[],E=0;function g(f){try{return f()}catch(e){}}if(location.pathname!=="/"||M.matches||(navigator.connection||{}).saveData||g(function(){return sessionStorage.getItem("sefid-intro")})||g(function(){return localStorage.getItem("sefid-quality")==="0"})||g(function(){var r=JSON.parse(localStorage.getItem("sefid-light"));return r.n>=2&&Date.now()<r.until})||!matchMedia("(pointer:fine),(min-width:1024px)").matches&&navigator.deviceMemory<=2)return;function end(k){if(E)return;E=1;g(function(){D.close();var b=d.body;b.tabIndex=-1;b.focus();b.removeAttribute("tabindex")});h.dataset.intro="done";g(function(){sessionStorage.setItem("sefid-intro","1")});performance.mark("intro:end");L.forEach(function(a){a[0].removeEventListener(a[1],a[2])});d.dispatchEvent(new CustomEvent("sefid:intro-end",{detail:{skipped:!!k,reduced:M.matches}}))}function on(t,n,f){t.addEventListener(n,f);L.push([t,n,f])}function up(){var n=0,s=0,k;for(k in S){n++;s+=S[k]}D.style.setProperty("--intro-p",s/n)}function m(k){return function(){S[k]=1;up()}}function skip(){end(1)}setTimeout(end,1400);try{h.dataset.intro="playing";D.showModal();performance.mark("intro:start");setTimeout(function(){D.classList.add("s2")},500);setTimeout(function(){D.classList.add("s3")},900);setTimeout(end,1300);S.t=S.f=S.i=S.l=0;up();setTimeout(m("t"),400);on(window,"load",m("l"));requestAnimationFrame(function(){requestAnimationFrame(function(){d.fonts.ready.then(m("f"))})});on(d,"DOMContentLoaded",function(){var i=d.querySelector(\'[data-scene="hero"] img\');i?i.decode().then(m("i"),m("i")):m("i")()});on(d,"sefid:intro-progress",function(e){S.h=Math.max(0,Math.min(1,+e.detail.p||0));up()});on(D,"click",skip);on(d,"keydown",skip);on(D,"close",skip);on(M,"change",skip);on(D,"wheel",function(e){e.preventDefault()})}catch(e){end(1)}})();';

/** base64 SHA-256 of INTRO_SCRIPT, for `script-src 'sha256-…'`. */
export const INTRO_SCRIPT_SHA256 = '0tNx+ymxQkGkApZU+SDpYkR81K0zFKuZhAiPdVaXOc8=';

/**
 * The dialog's stylesheet, rendered as `<style nonce>` inside the dialog (at most 3.5 KB).
 * Every moving part is its own `<svg>` element moved by a CSS transform on the element, never
 * on an SVG child (a child transform repaints the whole `<svg>` each frame). The lockup parts
 * sit in `.i-lk`, a zero-sized box at the viewport's (50%, 42%) scaled by `--k` (.34, .42 from
 * 744 px, .5 from 1280 px), so their offsets are lockup units: the mark at 1.6x around the
 * origin, «سفید» at .9x below it as in prototype 0a. The frame `.i-f` is one evenodd path (a
 * 10 000 unit square minus the mark) in a 1 px `<svg>` whose user unit is 1 px and whose
 * origin is the mark's centre: scaled by transform from 1.6k (the hole exactly under the mark
 * pieces) to 28.8k (the hole past every viewport edge), then faded. `will-change` only on the
 * current stage's parts. `i-fade` has no `from`: every part it hides keeps an underlying
 * opacity of 1, so the diamonds and the word enter through their own delayed animation
 * (`both` holds the first keyframe) instead of a base `opacity: 0` that the fade would start from.
 * `#intro:not([open])` is hidden by this sheet, not only by the user-agent one: a browser without
 * `<dialog>` would render the closed element. While `html[data-intro="playing"]`, the document is one pixel taller
 * than the viewport: with the modal open, Chromium renders a first frame before the rest of the
 * page has parsed, the document is still one screen tall, and the classic scrollbar that
 * appears a frame later (on the left in RTL) would move everything 15 px, a 0.011 CLS on
 * desktop; a scrollbar present from the first frame never moves anything, the real page is far
 * taller once parsed, and no rule toggles later (`scrollbar-gutter` on the root reports a
 * phantom shift in RTL when it changes). The dialog is 100vw by 100dvh so its `50%` children
 * never follow the layout viewport. The dialog clips with `overflow: clip`, never `hidden`: a scroll
 * container tracks the transformed frame's growing overflow and repaints every frame of stage 3
 * (measured on 390 and 820 px). `html[data-intro="playing"] #intro` carries a 0 s animation
 * delayed 1400 ms as a failsafe: a stalled timer still hides the overlay (IntroRemover closes it).
 */
export const INTRO_CSS =
  'html[data-intro=playing]{min-height:calc(100dvh + 1px)}' +
  '#intro{position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:none;color:var(--color-ink);overflow:clip;touch-action:none;--k:.34}' +
  '#intro:not([open]){display:none}' +
  '#intro::backdrop{background:none}' +
  '@media(min-width:744px){#intro{--k:.42}}' +
  '@media(min-width:1280px){#intro{--k:.5}}' +
  '#intro svg{position:absolute;display:block;overflow:visible}' +
  '.i-f{left:calc(50% - .5px);top:calc(42% - .5px);width:1px;height:1px;fill:var(--color-surface);transform:scale(calc(1.6*var(--k)));will-change:transform}' +
  '.i-lk{position:absolute;left:50%;top:42%;width:0;height:0;transform:scale(var(--k))}' +
  '.i-m,.i-sl,.i-sr{left:-134.42px;top:-165.84px;width:268.85px;height:331.68px}' +
  '.i-m{fill:var(--color-surface);stroke:var(--color-brand-logo);stroke-width:2.5}' +
  '.i-sl,.i-sr{fill:var(--color-brand-logo);opacity:0}' +
  '.i-w{left:-365.49px;top:274.65px;width:345.89px;height:154.97px;fill:currentColor;animation:i-in .4s var(--ease-in-out) .5s both;will-change:transform,opacity}' +
  '.i-b{left:-19.6px;top:288.37px;width:385.47px;height:127.53px;fill:currentColor;transform-origin:100% 50%;transform:scaleX(var(--intro-p,0));transition:transform .12s linear;will-change:transform}' +
  '.i-d{fill:currentColor;animation:i-fly .5s cubic-bezier(.34,1.4,.64,1) both;will-change:transform}' +
  '.i-d1{left:-227.32px;top:437.77px;width:26.37px;height:26.46px;--x:calc(-60vw/var(--k));--y:0px}' +
  '.i-d2{left:-199.78px;top:437.77px;width:26.55px;height:26.46px;--x:0px;--y:calc(60vh/var(--k));animation-delay:40ms}' +
  '.i-d3{left:-110.14px;top:338.23px;width:27.81px;height:27.9px;--x:calc(60vw/var(--k));--y:0px;animation-delay:80ms}' +
  '.i-d4{left:-109.33px;top:226.63px;width:26.1px;height:26.37px;--x:0px;--y:calc(-60vh/var(--k));animation-delay:120ms}' +
  '@keyframes i-fly{from{transform:translate(var(--x),var(--y));opacity:0}30%{opacity:1}to{transform:none;opacity:1}}' +
  '.i-skip{position:absolute;left:50%;bottom:max(24px,env(safe-area-inset-bottom));transform:translateX(-50%);min-width:44px;min-height:44px;padding:0 16px;border:1px solid transparent;border-radius:var(--radius-pill);background:none;color:var(--color-ink-muted);font:inherit;font-size:var(--text-small);cursor:pointer}' +
  '.i-skip:hover{color:var(--color-brand-strong);border-color:var(--color-line)}' +
  '#intro.s2 .i-sl{animation:i-l .32s var(--ease-out) both;will-change:transform,opacity}' +
  '#intro.s2 .i-sr{animation:i-r .32s var(--ease-out) 40ms both;will-change:transform,opacity}' +
  '#intro.s2 .i-m{animation:i-fade .24s linear .16s both}' +
  '@keyframes i-l{from{transform:translateX(-18px);opacity:0}to{transform:none;opacity:1}}' +
  '@keyframes i-r{from{transform:translateX(18px);opacity:0}to{transform:none;opacity:1}}' +
  '@keyframes i-in{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}' +
  '@keyframes i-fade{to{opacity:0}}' +
  '#intro.s3 .i-f{animation:i-grow .4s cubic-bezier(.6,0,.9,.4) both,i-fade .15s linear .25s both}' +
  '#intro.s3 .i-m{animation:none;opacity:0}' +
  '#intro.s3 :is(.i-sl,.i-sr){animation:i-piece .4s cubic-bezier(.6,0,.9,.4) both;will-change:transform,opacity}' +
  '#intro.s3 :is(.i-w,.i-b,.i-d){animation:i-fade .2s linear both;will-change:opacity}' +
  '#intro.s3 .i-skip{animation:i-fade .15s linear .25s both}' +
  '@keyframes i-grow{from{transform:scale(calc(1.6*var(--k)))}to{transform:scale(calc(28.8*var(--k)))}}' +
  '@keyframes i-piece{from{transform:none;opacity:1}40%{opacity:0}to{transform:scale(18);opacity:0}}' +
  'html[data-intro=playing] #intro{animation:i-fade 0s 1400ms forwards}';
