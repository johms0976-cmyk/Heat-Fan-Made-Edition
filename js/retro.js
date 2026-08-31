/* =====================================================================
   RETRO — 16-bit pixel layer for FPVIEW (HEAT cockpit cam)
   ---------------------------------------------------------------------
   Drop in AFTER fpview_5_2.js:

       <script src="js/fpview_5_2.js"></script>
       <script src="js/retro.js"></script>

   It never touches fpview's 3000 lines. It works by shimming three
   things on the #fpcam canvas:

     1. RESOLUTION — fpview's fit() sets the backing store to
        W*DPR and then draws everything in CSS-pixel space via
        ctx.setTransform(DPR,0,0,DPR,0,0). We intercept the width /
        height setters and that one setTransform call, so the same
        drawing code lands in a 320x180-ish buffer that the browser
        then upscales with nearest-neighbour. Every quad, sprite and
        kerb becomes chunky for free.

     2. COLOUR — a posterise pass collapses each channel to N levels.
        'svg' mode does it on the GPU with feComponentTransfer
        (free, no dithering). 'js' mode does it per-pixel with a 4x4
        Bayer ordered dither, which is what actually sells the
        16-bit look: hard bands with a dot-pattern seam, like a SNES
        gradient.

     3. GRID — optional CRT scanline / shadow-mask overlay, sized to
        the integer upscale factor so it never moires.

   Console API:  RETRO.on = false        // back to smooth
                 RETRO.targetH = 144     // chunkier
                 RETRO.levels  = 5       // fewer colours
                 RETRO.mode    = 'js'    // 'js' | 'svg' | 'none'
                 RETRO.scanlines = true
   Key:  P toggles the whole thing.
   ===================================================================== */
(function(){
"use strict";

const CFG = window.RETRO = {
  on        : true,
  targetH   : 180,     // internal vertical resolution (Top Gear was 224)
  levels    : 6,       // colour steps per channel (6 => 216 colours)
  mode      : 'js',    // 'js' = posterise + dither, 'svg' = GPU posterise
  dither    : true,
  scanlines : true,
  _f        : 1        // integer upscale factor, filled in at fit time
};

/* ---------- wait for fpview to build the canvas ---------------------- */
let tries = 0;
(function boot(){
  const cv   = document.getElementById("fpcam");
  const wrap = document.getElementById("trackwrap");
  if(!cv || !wrap){
    if(tries++ < 200) return setTimeout(boot, 50);
    return console.warn("[retro] #fpcam never appeared — is fpview loaded first?");
  }
  init(cv, wrap);
})();

function init(cv, wrap){
  /* getContext('2d') hands back the SAME context object fpview holds,
     so wrapping a method here patches fpview's own draw calls. */
  const ctx = cv.getContext("2d");

  /* ---------- 1. resolution -------------------------------------- */
  const dW = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "width");
  const dH = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "height");

  function target(){
    const r    = wrap.getBoundingClientRect();
    const cssW = Math.max(2, r.width), cssH = Math.max(2, r.height);
    /* integer factor only — a fractional upscale makes uneven pixels
       and the whole image shimmers as the camera moves. */
    const f = Math.max(1, Math.round(cssH / CFG.targetH));
    CFG._f = f;
    return { w: Math.max(2, Math.round(cssW / f)),
             h: Math.max(2, Math.round(cssH / f)), cssW, cssH, f };
  }

  Object.defineProperty(cv, "width", {
    configurable: true,
    get(){ return dW.get.call(cv); },
    set(v){ dW.set.call(cv, CFG.on ? target().w : v); }
  });
  Object.defineProperty(cv, "height", {
    configurable: true,
    get(){ return dH.get.call(cv); },
    set(v){ dH.set.call(cv, CFG.on ? target().h : v); }
  });

  function forceFit(){
    const t = target();
    if(CFG.on){ dW.set.call(cv, t.w); dH.set.call(cv, t.h); }
    else {
      const d = Math.min(2, window.devicePixelRatio || 1);
      dW.set.call(cv, Math.round(t.cssW * d));
      dH.set.call(cv, Math.round(t.cssH * d));
    }
    cv.style.width  = t.cssW + "px";
    cv.style.height = t.cssH + "px";
    sizeOverlay(t);
  }

  /* fpview draws in CSS-pixel space and installs its DPR transform once
     per frame. Swap in our own uniform scale and the whole scene is
     rendered into the small buffer with no other changes. */
  const _setT = ctx.setTransform;
  ctx.setTransform = function(a, b, c, d, e, f){
    if(CFG.on && arguments.length === 6 && b === 0 && c === 0 && a === d && !e && !f){
      const s = cv.width / (cv.clientWidth || 1);
      const r = _setT.call(ctx, s, 0, 0, s, 0, 0);
      ctx.imageSmoothingEnabled = false;   // sprites blit hard-edged
      return r;
    }
    return _setT.apply(ctx, arguments);
  };

  /* ---------- CSS: nearest-neighbour upscale + CRT grid ----------- */
  const style = document.createElement("style");
  style.textContent = `
    #fpcam{ image-rendering: pixelated; image-rendering: crisp-edges; }
    #fpcrt{ position:absolute; inset:0; z-index:44; pointer-events:none;
            opacity:0; transition:opacity .3s ease; mix-blend-mode:multiply; }
    #fpcam.on ~ #fpcrt{ opacity:.55; }
    body.retro-off #fpcam{ image-rendering:auto; }
    body.retro-off #fpcrt{ display:none; }
  `;
  document.head.appendChild(style);

  const crt = document.createElement("div");
  crt.id = "fpcrt";
  wrap.appendChild(crt);
  function sizeOverlay(t){
    if(!CFG.on || !CFG.scanlines){ crt.style.background = "none"; return; }
    const px = Math.max(2, t.f);           // one source pixel on screen
    crt.style.background =
      `repeating-linear-gradient(to bottom,` +
      ` rgba(255,255,255,1) 0 ${px - 1}px, rgba(120,120,140,1) ${px - 1}px ${px}px)`;
  }

  /* ---------- 2. colour: SVG posterise (GPU path) ------------------ */
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", 0); svg.setAttribute("height", 0);
  svg.style.cssText = "position:absolute;width:0;height:0";
  const filt = document.createElementNS(NS, "filter");
  filt.setAttribute("id", "retroPosterise");
  filt.setAttribute("color-interpolation-filters", "sRGB");
  const fct = document.createElementNS(NS, "feComponentTransfer");
  const funcs = ["feFuncR", "feFuncG", "feFuncB"].map(n => {
    const f = document.createElementNS(NS, n);
    f.setAttribute("type", "discrete");
    fct.appendChild(f); return f;
  });
  filt.appendChild(fct); svg.appendChild(filt); document.body.appendChild(svg);

  function buildDiscrete(){
    const n = Math.max(2, CFG.levels|0);
    const t = [];
    for(let i = 0; i < n; i++) t.push((i / (n - 1)).toFixed(4));
    funcs.forEach(f => f.setAttribute("tableValues", t.join(" ")));
  }

  /* ---------- 2b. colour: JS posterise + 4x4 Bayer dither ---------- */
  const BAYER = [ 0, 8, 2,10, 12, 4,14, 6, 3,11, 1, 9, 15, 7,13, 5];
  let LUT = null, lutKey = "";
  function buildLUT(){
    const key = CFG.levels + "|" + CFG.dither;
    if(key === lutKey) return;
    lutKey = key;
    const n = Math.max(2, CFG.levels|0), step = 255 / (n - 1);
    LUT = new Uint8Array(16 * 256);
    for(let b = 0; b < 16; b++){
      const off = CFG.dither ? ((BAYER[b] + 0.5) / 16 - 0.5) * step : 0;
      for(let v = 0; v < 256; v++){
        let q = Math.round((v + off) / step) * step;
        LUT[b * 256 + v] = q < 0 ? 0 : q > 255 ? 255 : q;
      }
    }
  }

  function quantise(){
    const w = cv.width, h = cv.height;
    if(w < 2 || h < 2) return;
    buildLUT();
    let img;
    try { img = ctx.getImageData(0, 0, w, h); } catch(_){ return; }
    const d = img.data;
    for(let y = 0; y < h; y++){
      const row = (y & 3) << 2;
      let i = y * w * 4;
      for(let x = 0; x < w; x++, i += 4){
        if(d[i + 3] === 0) continue;
        const base = (row | (x & 3)) * 256;
        d[i]     = LUT[base + d[i]];
        d[i + 1] = LUT[base + d[i + 1]];
        d[i + 2] = LUT[base + d[i + 2]];
      }
    }
    /* putImageData ignores the transform, so save/restore isn't needed */
    ctx.putImageData(img, 0, 0);
  }

  function applyMode(){
    buildDiscrete();
    cv.style.filter = (CFG.on && CFG.mode === "svg") ? "url(#retroPosterise)" : "";
    document.body.classList.toggle("retro-off", !CFG.on);
  }

  /* ---------- pump: runs right after fpview's own rAF -------------- */
  function pump(){
    requestAnimationFrame(pump);
    if(!CFG.on) return;
    if(CFG.mode === "js" && cv.classList.contains("on")) quantise();
  }
  /* register from inside a frame so we're queued behind fpview's tick */
  requestAnimationFrame(() => requestAnimationFrame(pump));

  if(window.ResizeObserver) new ResizeObserver(forceFit).observe(wrap);
  addEventListener("resize", forceFit);
  addEventListener("keydown", e => {
    if(e.key === "p" || e.key === "P"){
      CFG.on = !CFG.on; forceFit(); applyMode();
      if(typeof toast === "function") toast(CFG.on ? "Retro mode ON" : "Retro mode OFF");
    }
  });

  applyMode(); forceFit();
  console.log("[retro] pixel layer up — P to toggle, RETRO.* to tune");
}
})();
