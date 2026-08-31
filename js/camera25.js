/* =====================================================================
   CAMERA25 — a 2.5D board camera for HEAT                      (drop-in)
   ---------------------------------------------------------------------
   Loads AFTER js/game.js and AFTER js/fpview.js:

       <script src="js/camera25.js"></script>

   The board stays exactly what it is — your traced SVG over the
   satellite plate. This file only changes how it is LOOKED at:

     · a CSS rotateX on a wrapper so the board lies back like a table
     · a live viewBox that pans and zooms to follow a car
     · dust kicked up by fast moves, and a full burst on a spin-out
     · a heat shimmer over the tarmac that thickens as your Engine
       empties

   THREE MODES, cycled by the ⛰ button on the board (or Camera25.cycle()):
       board  — untouched, exactly the classic view (the default)
       chase  — laid back and zoomed onto your own car
       wide   — gentler tilt, follows the race leader

   It stands down completely whenever fpview's cockpit owns the board
   (#trackwrap.fp-live), and restores every attribute it borrowed.

   Nothing here reads or writes game state. Car positions are read off
   the rendered SVG transforms, so the game's own animation stays the
   single source of truth.
   ===================================================================== */
"use strict";
(function(){

const LS = "heat.cam25.mode";
const MODES = {
  board: {tilt:0,  zoom:1,    follow:null,     label:"Board"},
  chase: {tilt:26, zoom:2.35, follow:"you",    label:"Chase"},
  wide:  {tilt:15, zoom:1.55, follow:"leader", label:"Wide"}
};
const ORDER = ["board", "chase", "wide"];
const REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

let wrap, svg, stage, fx, shim, btn;
let mode = "board", suspended = false, raf = 0, last = 0;
let cam = {x:0, y:0, z:1, set:false};
let baseVB = {w:1200, h:800};
let borrowed = null;                 // the svg attributes we overwrote
const carState = new Map();          // id → {total, spin, dustAt}

const $ = s => document.querySelector(s);
const gl = n => { try{ return (typeof window[n] !== "undefined") ? window[n] : eval(n); }catch(e){ return undefined; } };
const players = () => { const G = gl("G"); return (G && G.players) || []; };
const me = () => { const f = gl("curHuman"); try{ return f ? f() : null; }catch(e){ return null; } };

/* =====================================================================
   STYLE
   ===================================================================== */
function injectCSS(){
  if(document.getElementById("cam25css")) return;
  const s = document.createElement("style");
  s.id = "cam25css";
  s.textContent = `
  #camstage{ transform-origin:50% 50%; will-change:transform; }
  #trackwrap.cam-on{ overflow:hidden; perspective:1000px; perspective-origin:50% 42%; }
  #trackwrap.cam-on #camstage{ height:var(--cam-h,320px); }
  #trackwrap.cam-on #tracksvg{ width:100%; height:100%; display:block; }
  /* a soft horizon so the receding far edge doesn't just stop dead */
  #trackwrap.cam-on::after{
    content:""; position:absolute; inset:0; pointer-events:none; z-index:42;
    background:linear-gradient(180deg, rgba(10,8,14,.55) 0%, transparent 26%, transparent 82%, rgba(10,8,14,.4) 100%);
  }
  #trackwrap.cam-shake #camstage{ animation:cam25Shake .5s cubic-bezier(.36,.07,.19,.97); }
  @keyframes cam25Shake{
    0%,100%{ margin-left:0; margin-top:0 }
    15%{ margin-left:-7px; margin-top:4px }
    35%{ margin-left:6px;  margin-top:-4px }
    55%{ margin-left:-4px; margin-top:2px }
    75%{ margin-left:3px;  margin-top:-1px }
  }

  /* ---- effects layer: dust + shimmer, never interactive ---- */
  #camfx{ position:absolute; inset:0; pointer-events:none; z-index:44; overflow:hidden; }
  .dustp{
    position:absolute; border-radius:50%; opacity:0;
    background:radial-gradient(circle at 40% 35%, rgba(226,208,178,.95), rgba(150,128,96,.5) 55%, rgba(120,100,74,0) 72%);
    animation:cam25Dust var(--life,750ms) ease-out forwards;
    will-change:transform,opacity;
  }
  .dustp.smoke{
    background:radial-gradient(circle at 40% 35%, rgba(240,240,240,.9), rgba(120,120,120,.45) 55%, rgba(90,90,90,0) 72%);
  }
  @keyframes cam25Dust{
    0%  { opacity:.85; transform:translate(-50%,-50%) scale(.35) }
    100%{ opacity:0;   transform:translate(calc(-50% + var(--dx,0px)), calc(-50% + var(--dy,0px))) scale(var(--gs,2.4)) }
  }
  #camshim{
    position:absolute; inset:0; pointer-events:none; opacity:0;
    transition:opacity .5s ease;
    background:repeating-linear-gradient(180deg,
      rgba(255,170,110,.16) 0px, rgba(255,170,110,0) 3px,
      rgba(255,120,60,.13) 6px, rgba(255,120,60,0) 10px);
    mix-blend-mode:screen;
    animation:cam25Shim 2.6s ease-in-out infinite;
  }
  @keyframes cam25Shim{
    0%,100%{ transform:translateY(0)    scaleY(1) }
    50%    { transform:translateY(-6px) scaleY(1.06) }
  }

  /* ---- mode button ---- */
  #camtoggle{
    position:absolute; top:8px; right:8px; z-index:58;
    display:flex; align-items:center; gap:5px;
    padding:5px 9px; border-radius:999px; cursor:pointer;
    font-family:var(--disp,sans-serif); font-size:10px; font-weight:800;
    letter-spacing:1.8px; text-transform:uppercase;
    color:var(--cream,#f0e7d3);
    background:rgba(13,10,19,.82); border:1px solid rgba(169,133,255,.45);
    box-shadow:0 3px 10px rgba(0,0,0,.55);
    backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px);
  }
  #camtoggle:active{ transform:translateY(1px) }
  #camtoggle .cmi{ font-size:12px; line-height:1 }
  #trackwrap.fp-live #camtoggle{ display:none }

  @media (prefers-reduced-motion:reduce){
    #camshim, #trackwrap.cam-shake #camstage{ animation:none !important }
  }`;
  document.head.appendChild(s);
}

/* =====================================================================
   MOUNT
   ===================================================================== */
function mount(){
  wrap = document.getElementById("trackwrap");
  svg  = document.getElementById("tracksvg");
  if(!wrap || !svg) return false;

  if(!document.getElementById("camstage")){
    stage = document.createElement("div");
    stage.id = "camstage";
    wrap.insertBefore(stage, svg);
    stage.appendChild(svg);                 // svg keeps its id, so game.js is none the wiser
  } else stage = document.getElementById("camstage");

  if(!document.getElementById("camfx")){
    fx = document.createElement("div");
    fx.id = "camfx";
    shim = document.createElement("div");
    shim.id = "camshim";
    fx.appendChild(shim);
    wrap.appendChild(fx);
  } else { fx = document.getElementById("camfx"); shim = document.getElementById("camshim"); }

  if(!document.getElementById("camtoggle")){
    btn = document.createElement("button");
    btn.id = "camtoggle";
    btn.title = "Camera — board / chase / wide";
    btn.innerHTML = `<span class="cmi">⛰</span><span class="cml">Board</span>`;
    btn.onclick = cycle;
    wrap.appendChild(btn);
  } else btn = document.getElementById("camtoggle");

  /* fpview borrows the board for its cockpit and PiP; when it does, we
     get out of the way entirely and hand every attribute back */
  new MutationObserver(() => {
    const fpOn = wrap.classList.contains("fp-live");
    if(fpOn && !suspended){ suspended = true; release(); }
    else if(!fpOn && suspended){ suspended = false; apply(); }
  }).observe(wrap, {attributes:true, attributeFilter:["class"]});

  return true;
}

/* =====================================================================
   BORROW / RETURN the svg presentation attributes
   ===================================================================== */
function borrow(){
  if(borrowed) return;
  const r = svg.getBoundingClientRect();
  borrowed = {
    vb:  svg.getAttribute("viewBox"),
    par: svg.getAttribute("preserveAspectRatio"),
    w:   svg.style.width,
    h:   svg.style.height,
    natH: Math.max(200, Math.round(r.height) || 320)
  };
  stage.style.setProperty("--cam-h", borrowed.natH + "px");
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
}
function release(){
  wrap.classList.remove("cam-on", "cam-shake");
  stage.style.transform = "";
  stage.style.removeProperty("--cam-h");
  if(borrowed){
    if(borrowed.vb) svg.setAttribute("viewBox", borrowed.vb);
    if(borrowed.par) svg.setAttribute("preserveAspectRatio", borrowed.par);
    else svg.removeAttribute("preserveAspectRatio");
    svg.style.width  = borrowed.w  || "";
    svg.style.height = borrowed.h  || "";
    borrowed = null;
  }
  cam.set = false;
  if(shim) shim.style.opacity = "0";
}

/* board dimensions, straight from the loaded track so a circuit swap
   is picked up without any hook */
function baseSize(){
  const T = gl("TRACK");
  if(T && T.imgW && T.imgH) return {w:T.imgW, h:T.imgH};
  if(svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width)
    return {w:svg.viewBox.baseVal.width, h:svg.viewBox.baseVal.height};
  return baseVB;
}

/* =====================================================================
   READING THE CARS
   Positions come off the rendered SVG, not the model — whatever the
   game's animation is doing this frame is what the camera sees.
   ===================================================================== */
function carNode(p){ return document.getElementById("car-" + p.id); }
function carPoint(p){
  const g = carNode(p); if(!g) return null;
  const t = g.getAttribute("transform") || "";
  const m = /translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/.exec(t);
  if(!m) return null;
  let ang = 0;
  const rot = g.querySelector(".car-rot");
  if(rot){
    const rm = /rotate\(\s*(-?[\d.]+)/.exec(rot.getAttribute("transform") || "");
    if(rm) ang = parseFloat(rm[1]);
  }
  return {x:parseFloat(m[1]), y:parseFloat(m[2]), ang};
}
function subject(){
  const list = players().filter(p => !p.finished);
  const cfg = MODES[mode];
  if(cfg.follow === "you"){
    const p = me();
    if(p && !p.finished && carNode(p)) return p;
  }
  return list.sort((a, b) => b.total - a.total)[0] || players()[0] || null;
}

/* =====================================================================
   THE FRAME
   ===================================================================== */
function frame(now){
  raf = 0;
  const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;

  if(!suspended && mode !== "board") drive(dt);
  effects(dt);

  if(alive()) raf = requestAnimationFrame(frame);
}
function carsMoving(){
  for(const p of players()){ const v = p._v; if(v && (v.total !== p.total || v.spin > 0)) return true; }
  return false;
}
/* the loop only runs when it has something to do: a live camera, dust on
   screen, or cars the game is still animating. The shimmer is repainted
   by the heartbeat instead, so a low Engine costs nothing per frame. */
function alive(){
  return (!suspended && mode !== "board") || (fx && fx.childElementCount > 1) || carsMoving();
}
function kick(){
  if(!raf){ last = performance.now(); raf = requestAnimationFrame(frame); }
}

function drive(dt){
  const cfg = MODES[mode];
  const base = baseSize();
  const sw = stage.clientWidth || 1, sh = stage.clientHeight || 1;
  const aspect = sh / sw;

  const vw = Math.min(base.w, base.w / cfg.zoom);
  const vh = Math.min(base.h, vw * aspect);

  const s = subject();
  const pt = s ? carPoint(s) : null;
  let tx, ty;
  if(pt){
    /* look a little way up the road so you can see what you're driving into */
    const lead = vw * 0.14;
    const rad = (pt.ang || 0) * Math.PI / 180;
    tx = pt.x + Math.cos(rad) * lead;
    ty = pt.y + Math.sin(rad) * lead;
  } else { tx = base.w / 2; ty = base.h / 2; }

  /* clamp so the camera never shows off the edge of the plate */
  tx = Math.max(vw / 2, Math.min(base.w - vw / 2, tx));
  ty = Math.max(vh / 2, Math.min(base.h - vh / 2, ty));

  if(!cam.set){ cam.x = tx; cam.y = ty; cam.set = true; }
  else{
    const jump = Math.hypot(tx - cam.x, ty - cam.y) > base.w * 0.45;   // restart / grid reset
    const k = jump ? 1 : Math.min(1, dt * 4.2);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
  }

  svg.setAttribute("viewBox",
    `${(cam.x - vw / 2).toFixed(1)} ${(cam.y - vh / 2).toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`);

  /* rotateX foreshortens; scale back up so the board still fills the box */
  const rad = cfg.tilt * Math.PI / 180;
  const comp = Math.min(1.35, 1 / Math.max(.4, Math.cos(rad)));
  stage.style.transform = `rotateX(${cfg.tilt}deg) scale(${comp.toFixed(3)})`;
}

/* =====================================================================
   EFFECTS — dust, spin bursts, heat shimmer
   ===================================================================== */
function wrapRect(){ return wrap.getBoundingClientRect(); }

function puff(px, py, opts){
  if(!fx) return;
  const d = document.createElement("div");
  d.className = "dustp" + (opts.smoke ? " smoke" : "");
  const size = opts.size || (7 + Math.random() * 9);
  d.style.left = px + "px";
  d.style.top  = py + "px";
  d.style.width = size + "px";
  d.style.height = size + "px";
  d.style.setProperty("--dx", (opts.dx || (Math.random() * 30 - 15)).toFixed(1) + "px");
  d.style.setProperty("--dy", (opts.dy || (-8 - Math.random() * 22)).toFixed(1) + "px");
  d.style.setProperty("--gs", (opts.grow || (2 + Math.random() * 2)).toFixed(2));
  d.style.setProperty("--life", (opts.life || (620 + Math.random() * 380)) + "ms");
  const life = parseInt(d.style.getPropertyValue("--life"), 10) || 800;
  d.addEventListener("animationend", () => d.remove(), {once:true});
  setTimeout(() => d.remove(), life + 500);   // if the animation never fires (tab hidden, display:none)
  fx.appendChild(d);
}

function puffAtCar(p, opts){
  const g = carNode(p); if(!g) return;
  const r = g.getBoundingClientRect(), w = wrapRect();
  if(!r.width && !r.height) return;
  puff(r.left + r.width / 2 - w.left, r.top + r.height / 2 - w.top, opts || {});
}

function burst(p, n){
  for(let i = 0; i < n; i++){
    const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 46;
    setTimeout(() => puffAtCar(p, {
      dx: Math.cos(a) * d, dy: Math.sin(a) * d * .6,
      size: 10 + Math.random() * 14, grow: 2.6 + Math.random() * 1.8,
      life: 700 + Math.random() * 500, smoke: i % 3 === 0
    }), i * 16);
  }
}

function shimWanted(){
  const p = me();
  if(!p || p.finished) return 0;
  const capFn = gl("heatCapFor");
  const cap = (typeof capFn === "function") ? capFn(p) : 6;
  const empty = 1 - (p.engine / Math.max(1, cap));      // 0 cool → 1 cooked
  return empty > .55 ? Math.min(.5, (empty - .55) * 1.15) : 0;
}

/* shimmer over the tarmac, thickening as the Engine drains */
function paintShim(){
  if(!shim) return;
  const wantOn = !suspended && !wrap.classList.contains("fp-live");
  shim.style.opacity = wantOn ? shimWanted().toFixed(3) : "0";
}

function effects(dt){
  paintShim();

  const list = players();
  for(const p of list){
    const v = p._v;
    if(!v) continue;
    let st = carState.get(p.id);
    if(!st){ st = {total:v.total, spin:0, dustAt:0}; carState.set(p.id, st); }

    /* a spin-out shoves the car BACKWARDS, which is when the game's own
       animation sets v.spin — the cleanest universal hook there is */
    if(v.spin > 250 && st.spin <= 250){
      burst(p, 14);
      if(!REDUCED && (p === me() || mode !== "board")){
        wrap.classList.add("cam-shake");
        setTimeout(() => wrap.classList.remove("cam-shake"), 520);
      }
    }
    st.spin = v.spin || 0;

    /* rolling dust while the car is genuinely travelling */
    const d = v.total - st.total;
    st.total = v.total;
    if(dt > 0 && d > 0){
      const spacesPerSec = d / dt;
      if(spacesPerSec > 3.5){
        const now = performance.now();
        const gap = spacesPerSec > 9 ? 55 : 100;
        if(now - st.dustAt > gap){
          st.dustAt = now;
          puffAtCar(p, {size:6 + Math.random() * 7, grow:1.8 + Math.random(), life:520 + Math.random() * 260});
        }
      }
    }
  }
  if(fx && fx.childElementCount > 1) kick();
}

/* =====================================================================
   MODE SWITCHING
   ===================================================================== */
function apply(){
  if(!wrap) return;
  const cfg = MODES[mode];
  if(btn){
    const lbl = btn.querySelector(".cml"); if(lbl) lbl.textContent = cfg.label;
    const ico = btn.querySelector(".cmi"); if(ico) ico.textContent = mode === "board" ? "⛰" : mode === "chase" ? "🏎" : "📡";
  }
  if(mode === "board" || suspended){ release(); kick(); return; }
  borrow();
  wrap.classList.add("cam-on");
  cam.set = false;
  kick();
}
function set(next){
  if(!MODES[next]) return;
  mode = next;
  try{ localStorage.setItem(LS, mode); }catch(e){}
  apply();
}
function cycle(){ set(ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]); }

/* =====================================================================
   BOOT
   ===================================================================== */
function boot(){
  injectCSS();
  if(!mount()) return;
  try{ const m = localStorage.getItem(LS); if(m && MODES[m]) mode = m; }catch(e){}
  apply();
  window.addEventListener("resize", () => { cam.set = false; if(borrowed){ release(); apply(); } }, {passive:true});
  setInterval(() => { paintShim(); kick(); }, 500);   // heartbeat: shimmer + wake the loop
}

window.Camera25 = {
  set, cycle, puff: puffAtCar, burst,
  get mode(){ return mode; },
  off(){ set("board"); }
};

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, {once:true});
else boot();

})();
