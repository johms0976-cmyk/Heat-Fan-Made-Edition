/* =====================================================================
   FPVIEW-POLY — the flat-shaded car & cockpit option
   ---------------------------------------------------------------------
   Load AFTER game.js, poly.js, the models, and fpview.js:

       <script src="js/poly.js"></script>
       <script src="js/models/car-f1.js"></script>
       <script src="js/models/cockpit.js"></script>
       <script src="js/game.js"></script>
       <script src="js/fpview.js"></script>
       <script src="js/fpview-poly.js"></script>

   What this file owns:
     · the player's Graphics preference (persisted, and a row in Settings)
     · palette assembly — turning a car's hex into a full set of slots
     · the three draw entry points fpview calls when Polygon is selected

   fpview.js is an IIFE, so it cannot be monkey-patched from out here.
   It carries five small hook points instead; see the FPVIEW HOOKS block
   at the bottom of this file for exactly what they are.

   Painted stays the default. Nothing under assets/ is removed — the two
   looks are peers, switchable mid-race.
   ===================================================================== */
"use strict";
(function(){

/* ---------------------------------------------------------- preference */
const LS = "heat.gfx.v1";

const GFX = window.GFX = {
  /* "painted" = the existing PNG art.  "polygon" = flat-shaded meshes.
     Held as two flags so either half can be driven from the console while
     you iterate; the Settings control always sets both together. */
  cars    : "painted",
  cockpit : "painted",

  /* tunables — safe to nudge live */
  carFoot : 1.30,    // on-screen car width = carFoot x fpview's `w`
  carModel: "f1_60s",
  lockPal : false,   // true = snap liveries to the STYLE.md palette
  numbers : true,    // stamp the car number on the engine cover
  lodPx   : 60,      // below this on-screen width, drop the fine detail
  heatCap : 6,       // Heat cards a full engine holds — scales the oil gauge
  shadow  : 0.34,    // contact-shadow alpha (flat, hard-edged)

  /* Steering hub in eye space (metres).  Solved so the polygon wheel frames
     exactly like the painted one: hub at 0.86H, rim half-width 0.26W.
        |z| / y = 0.44   ->  hub projects to 0.86H
         R  / y = 0.44   ->  rim spans +/-0.26W   (R = 0.20) */
  cockpitModel : "cockpit_60s_hi",   // "cockpit_60s" is the light version
  bakeCockpit  : true,               // false = re-project every frame
  bakeMaxDpr   : 1.5,                // bake resolution cap
  bakeMaxPx    : 6.0e6,              // and a hard pixel budget (~24MB RGBA)
  bakeBudgetMs : 40,                 // over this, fall back to the light model
  instruments  : true,               // live needles, lamps and the nose number

  hub     : { y:0.46, z:-0.20 },
  lean    : 0.26,                 // wheel lean-forward, radians
  turn    : 0.30,                 // radians of wheel per unit steer
  turnMax : 0.60,

  save, mode, set
};

function load(){
  try{
    const j = JSON.parse(localStorage.getItem(LS));
    if(j && typeof j === "object"){
      if(j.cars)    GFX.cars    = j.cars;
      if(j.cockpit) GFX.cockpit = j.cockpit;
    }
  }catch(e){}
}
function save(){
  try{ localStorage.setItem(LS, JSON.stringify({ cars:GFX.cars, cockpit:GFX.cockpit })); }
  catch(e){}
}
/* the single value the Settings control reads/writes */
function mode(){ return (GFX.cars === "polygon" && GFX.cockpit === "polygon")
                        ? "polygon" : "painted"; }
function set(v){ GFX.cars = GFX.cockpit = (v === "polygon" ? "polygon" : "painted"); save(); }
load();

/* ------------------------------------------------------------- palette */
/* Materials shared by every livery — STYLE.md section 4. */
const MAT = {
  stripe:"#f0e7d3", tyre:"#1b1820", hub:"#8f8a96", dark:"#151219",
  chrome:"#b6b2bd", glass:"#2a3742", helm:"#e6e2d8", plate:"#f0e7d3",
  ink:"#151218", glove:"#221d26"
};

/* the ten authored liveries */
const LIVERY = {
  purple:"#8a5cf6", red:"#d63a2a", orange:"#e8792a", yellow:"#e8c62a",
  green :"#2f9e52", blue:"#2f6fd0", pink  :"#d8508f", white :"#e6e2d8",
  grey  :"#8b8892", black:"#2a2730"
};

/* Snap an arbitrary hex to the nearest authored livery.  Only used when
   GFX.lockPal is on — by default we honour the game's own colour so the
   car matches its board token, minimap dot, cards and HUD. */
function snap(hex){
  const m = /^#?([0-9a-f]{6})$/i.exec((hex||"").toLowerCase());
  if(!m) return LIVERY.grey;
  const n = parseInt(m[1],16), r=(n>>16)/255, g=((n>>8)&255)/255, b=(n&255)/255;
  const mx = Math.max(r,g,b), mn = Math.min(r,g,b), L = (mx+mn)/2, d = mx-mn;
  const S = d === 0 ? 0 : d/(1-Math.abs(2*L-1));
  if(L > 0.82) return LIVERY.white;
  if(L < 0.16) return LIVERY.black;
  if(S < 0.18) return LIVERY.grey;
  let hue;
  if(mx === r)      hue = 60*(((g-b)/d)%6);
  else if(mx === g) hue = 60*(((b-r)/d)+2);
  else              hue = 60*(((r-g)/d)+4);
  if(hue < 0) hue += 360;
  const H = { red:0, orange:30, yellow:55, green:130, blue:220, purple:275, pink:330 };
  let best = "red", bd = 1e9;
  for(const k in H){ let dd = Math.abs(hue-H[k]); dd = Math.min(dd, 360-dd);
                     if(dd < bd){ bd = dd; best = k; } }
  return LIVERY[best];
}

const PAL = new Map();
function palFor(hex){
  const base = GFX.lockPal ? snap(hex) : (hex || "#8b8892");
  const key  = base;
  let p = PAL.get(key);
  if(!p){
    p = Object.assign({ body:base }, MAT);
    if(PAL.size > 40) PAL.clear();
    PAL.set(key, p);
  }
  return p;
}

/* --------------------------------------------------------- frame state */
/* fpview publishes W/H/DPR and the live projector on window.FPCTX. */
function view(){
  const C = window.FPCTX;
  if(C && C.W) return C;
  const cv = document.getElementById("fpcam");
  return { W:(cv && cv.clientWidth) || 800, H:(cv && cv.clientHeight) || 450, P:null };
}
function horizonOf(v){ return (v.P && v.P.horizon != null) ? v.P.horizon : v.H*0.40; }
function focalOf(v){   return (v.P && v.P.focal   != null) ? v.P.focal   : v.H*1.05; }

function digits(o){
  const m = ((o && (o.name || o.id)) || "").match(/\d+/);
  return m ? m[0] : null;
}

/* ================================================================ CARS */
/* Called from fpview's drawRival with the same arguments, plus the player
   object so we can read the car number.

   (x, y) is the car's contact point on the road, already projected;
   `w` is the width fpview would have given the painted sprite.
   `rel` is the car's heading relative to the camera. */
function car(g, x, y, w, color, glow, rel, brake, o){
  const v = view(), P = window.POLY;
  if(!P) return false;

  /* Look-down angle to this car, straight from its position on screen:
     level with the horizon = seen edge-on, low in frame = seen from above.
     Free, exact, and it makes near cars read as three-dimensional. */
  const pitch = Math.max(0, Math.min(0.55,
                  Math.atan2(y - horizonOf(v), focalOf(v))));

  /* Model +Y is the nose. With yaw = 0 the nose points into the screen, so
     we see the car's back — which is the common case. Deriving the sign:
     fpview's camera-right is the heading rotated +90 degrees, so a car
     turned by `rel` has forward = (right: sin rel, fwd: cos rel), while
     POLY's yaw sends +Y to (-sin yaw, cos yaw).  Hence yaw = -rel. */
  const yaw = -(rel || 0);

  const pal = palFor(color);
  const scale = (w * GFX.carFoot) / 1.90;   // 1.90 = the model's X extent

  /* flat, hard-edged contact shadow — no gradient (STYLE.md rule 1) */
  if(GFX.shadow > 0){
    const L = window.FPCTX && window.FPCTX.LIGHT;
    const sx = x - (L ? L.side : 0) * w * 0.16;
    g.save();
    g.fillStyle = "rgba(12,10,16," + GFX.shadow + ")";
    g.beginPath();
    g.ellipse(sx, y, w*0.62, w*0.135, 0, 0, 6.2832);
    g.fill();
    g.restore();
  }

  const res = P.draw(g, GFX.carModel, { mode:"sprite", pal, x, y, scale, yaw,
                                        pitch, persp:0.06, far: w < GFX.lodPx });
  const A = res && res.anchors;

  /* tail lamps + engine heat: flat quads, never a radial bloom */
  if(A && A.tail && (brake || glow > 0.02)){
    const s = A.tail.s, hw = 0.30*s, hh = 0.075*s;
    if(brake){
      g.fillStyle = "#ff3c28";
      g.fillRect(A.tail.x - hw, A.tail.y - hh, hw*2, hh*2);
    }else{
      g.globalAlpha *= Math.min(0.75, glow);
      g.fillStyle = "#ff8c3c";
      g.fillRect(A.tail.x - hw*0.7, A.tail.y - hh*0.7, hw*1.4, hh*1.4);
      g.globalAlpha /= Math.min(0.75, glow);
    }
  }

  /* number roundel — only once the car is big enough to read */
  if(GFX.numbers && A && A.num && w > 34){
    const n = digits(o);
    if(n){
      const r = Math.max(5, 0.20 * A.num.s);
      g.save();
      g.fillStyle = MAT.plate;
      g.beginPath(); g.arc(A.num.x, A.num.y, r, 0, 6.2832); g.fill();
      g.fillStyle = MAT.ink;
      g.font = "800 " + Math.round(r*1.28) + "px var(--mono, monospace)";
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(n, A.num.x, A.num.y + r*0.06);
      g.restore();
    }
  }
  return true;
}

/* ============================================================= COCKPIT */
/* The cockpit is authored in eye space (see js/models/cockpit.js), so it
   shares fpview's focal length and horizon and needs no camera transform.

   BAKING.  Across a frame the only things that move it are the horizon
   (camera bob and pitch) and the steer sway — both pure translations —
   plus the focal length, which fpview widens with speed and which acts as
   a zoom about (cx, horizon).  So the whole thing can be projected and
   filled ONCE into an offscreen canvas and blitted thereafter with a
   translate and a scale.  That is what pays for ~900 faces of rivets,
   dials and suspension: they cost bake time, not frame time.

   Two details make it correct rather than nearly correct:

     · The bake happens at the MAXIMUM focal fpview will ask for
       (H * 1.05, its zero-speed value), so the blit only ever scales DOWN.
       Upscaling a baked bitmap would soften exactly the fine detail the
       bake exists to afford.

     · The canvas carries a margin on every side sized for that zoom range.
       Scaling down by k pulls a larger area of the bake into view, so a
       margin of (Z-1) x the distance from the anchor to each screen edge
       is the minimum that never reveals an empty band.

   The canvas keeps per-pixel alpha, so the 30%-opacity aeroscreen in the
   model composites over the road correctly at blit time. */

const BAKE = { key:null, cv:null, ox:0, oy:0, w:0, h:0, focal:1, ms:0 };
const ZOOM = 1.17;                 // 1 / min(focal factor) in fpview, plus slack

function bakeKey(v, hex){
  return v.W+"x"+v.H+"@"+(v.DPR||1)+"|"+hex+"|"+GFX.cockpitModel;
}

function bake(v, pal, hex){
  const key = bakeKey(v, hex);
  if(BAKE.key === key) return BAKE;

  const W = v.W, H = v.H;
  const hz = H * 0.40;                              // the bake's own anchor
  const mx = Math.ceil(W*0.5*(ZOOM-1)) + 48;
  const mt = Math.ceil(hz    *(ZOOM-1)) + 32;
  const mb = Math.ceil((H-hz)*(ZOOM-1)) + 32;
  const bw = W + mx*2, bh = H + mt + mb;

  /* Resolution: the device's DPR, capped, and then capped again by a pixel
     budget.  Without the second cap a 4K display would ask for a 3092x1749
     canvas at 1.5x — about 46MB of backing store for a dashboard. */
  let dpr = Math.min(GFX.bakeMaxDpr, v.DPR || 1);
  dpr = Math.max(1, Math.min(dpr, Math.sqrt(GFX.bakeMaxPx / (bw*bh))));

  const cv = BAKE.cv || (BAKE.cv = document.createElement("canvas"));
  cv.width  = Math.round(bw*dpr);
  cv.height = Math.round(bh*dpr);
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, bw, bh);

  const t0 = (typeof performance !== "undefined" && performance.now)
             ? performance.now() : Date.now();
  const focal = H * 1.05;                            // fpview's maximum
  window.POLY.draw(g, GFX.cockpitModel, {
    mode:"persp", pal, cx:mx + W/2, horizon:mt + hz, focal, near:0.18
  });
  const ms = ((typeof performance !== "undefined" && performance.now)
              ? performance.now() : Date.now()) - t0;

  Object.assign(BAKE, { key, cv, ox:mx + W/2, oy:mt + hz, w:bw, h:bh, focal, ms });

  /* self-tuning: if this device cannot bake the detailed model in a
     reasonable slice, drop to the light one and bake that instead */
  if(ms > GFX.bakeBudgetMs && GFX.cockpitModel !== "cockpit_60s"){
    GFX.cockpitModel = "cockpit_60s";
    BAKE.key = null;
    return bake(v, pal, hex);
  }
  return BAKE;
}

/* project an eye-space point with the CURRENT frame's camera */
function eyeProj(v, a, cx, hz, fc){
  const y = a[1] < 0.18 ? 0.18 : a[1], s = fc / y;
  return { x: cx + a[0]*s, y: hz - a[2]*s, s };
}

function hood(g, p, steer){
  const v = view(), P = window.POLY;
  if(!P) return false;
  const hex = GFX.lockPal ? snap((p && p.color) || "#8a5cf6")
                          : ((p && p.color) || "#8a5cf6");
  const pal = palFor((p && p.color) || "#8a5cf6");
  const cx = v.W/2 + steer * v.W * 0.006;
  const hz = horizonOf(v), fc = focalOf(v);

  if(GFX.bakeCockpit && typeof document !== "undefined" && document.createElement){
    const b = bake(v, pal, hex);
    const k = Math.min(1, fc / b.focal);
    g.save();
    g.translate(cx, hz);
    g.scale(k, k);
    g.drawImage(b.cv, -b.ox, -b.oy, b.w, b.h);
    g.restore();
  }else{
    P.draw(g, GFX.cockpitModel, { mode:"persp", pal, cx, horizon:hz,
                                  focal:fc, near:0.18 });
  }

  if(GFX.instruments) instruments(g, p, v, cx, hz, fc);
  return true;
}

/* ---- live layer: needles, lamps and the number, drawn over the blit ---- */
const SWEEP0 = -2.30, SWEEP = 4.60;     // must match dial() in the model file

function needle(g, A, cx, hz, fc, v, t, len, col, w){
  if(!A) return;
  const a = SWEEP0 + Math.max(0, Math.min(1, t))*SWEEP;
  const ca = Math.sin(a), sa = -Math.cos(a);
  const p0 = eyeProj(v, [A[0], A[1]-0.007, A[2]], cx, hz, fc);
  const p1 = eyeProj(v, [A[0]+ca*len, A[1]-0.007, A[2]+sa*len], cx, hz, fc);
  g.strokeStyle = col;
  g.lineWidth = Math.max(1.2, w * p0.s * 0.004);
  g.lineCap = "round";
  g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke();
}

function lamp(g, A, cx, hz, fc, v, col){
  if(!A) return;
  const p = eyeProj(v, [A[0], A[1]-0.006, A[2]], cx, hz, fc);
  const r = Math.max(1.5, 0.0072 * p.s);
  g.fillStyle = col;
  g.beginPath(); g.arc(p.x, p.y, r, 0, 6.2832); g.fill();
}

function instruments(g, p, v, cx, hz, fc){
  const P = window.POLY;
  const mdl = P && P.models[GFX.cockpitModel];
  const A = mdl && (mdl._mesh ? mdl._mesh.anchors : mdl.anchors);
  if(!A || !A.tach) return;

  const cam = (window.FPCTX && window.FPCTX.cam) || null;
  const spd = cam ? (cam.spd || 0) : 0;
  const eng = Math.max(0, (p && p.engine) || 0);
  const cap = Math.max(1, GFX.heatCap);
  const hand = (p && p.hand && p.hand.length) || 0;

  g.save();
  needle(g, A.tach,  cx, hz, fc, v, Math.min(1, spd/9),        0.048, "#e4573d", 2.2);
  needle(g, A.oil,   cx, hz, fc, v, Math.min(1, eng/cap),      0.028, "#f0e7d3", 1.6);
  needle(g, A.water, cx, hz, fc, v, 1 - Math.min(1, eng/cap),  0.028, "#f0e7d3", 1.6);
  needle(g, A.fuel,  cx, hz, fc, v, Math.min(1, hand/7),       0.024, "#f0e7d3", 1.6);
  needle(g, A.volts, cx, hz, fc, v, 0.72,                      0.024, "#f0e7d3", 1.6);

  /* two of the four lamps are wired to the thing the game is actually
     about: how much Heat is left in the engine */
  if(eng <= 1)       lamp(g, A.lamp0, cx, hz, fc, v, "#ff3c28");
  if(eng <= cap*0.5) lamp(g, A.lamp2, cx, hz, fc, v, "#e8c62a");

  /* car number on the nose roundel */
  const n = digits(p);
  if(n && A.roundel){
    const q = eyeProj(v, A.roundel, cx, hz, fc);
    const r = Math.max(6, 0.052 * q.s);
    g.fillStyle = MAT.plate;
    g.beginPath(); g.arc(q.x, q.y, r, 0, 6.2832); g.fill();
    g.fillStyle = MAT.ink;
    g.font = "800 " + Math.round(r*1.24) + "px var(--mono, monospace)";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(n, q.x, q.y + r*0.06);
  }
  g.restore();
}

function wheel(g, steer, p){
  const v = view(), P = window.POLY;
  if(!P) return false;
  const pal = palFor((p && p.color) || "#8a5cf6");
  const spin = Math.max(-GFX.turnMax, Math.min(GFX.turnMax, (steer||0) * GFX.turn));
  P.draw(g, "wheel_60s", {
    mode    : "persp",
    pal,
    cx      : v.W/2 + steer * v.W * 0.004,
    horizon : horizonOf(v),
    focal   : focalOf(v),
    at      : [0, GFX.hub.y, GFX.hub.z],
    yaw     : -spin,
    tiltX   : Math.PI/2 - GFX.lean,
    near    : 0.20
  });
  return true;
}

/* ------------------------------------------------------- fpview's view */
window.FPPOLY = {
  on(what){
    if(!window.POLY) return false;
    return GFX[what] === "polygon";
  },
  /* keep the polygon sun agreeing with the sky's sun each frame */
  sun(side){ if(window.POLY) window.POLY.setSunSide(side); },
  car, hood, wheel, palFor, LIVERY, MAT,
  /* force a re-bake — call after changing a livery or GFX.cockpitModel */
  invalidate(){ BAKE.key = null; },
  bakeInfo(){ return { model:GFX.cockpitModel, ms:BAKE.ms,
                       size:BAKE.w+"x"+BAKE.h }; }
};


/* =====================================================================
   SETTINGS ROW
   ---------------------------------------------------------------------
   game.js declares openSettings() at top level of a classic script, so it
   is a real global and can be wrapped without touching game.js at all.
   It writes the sheet's innerHTML synchronously, so we append our section
   immediately afterwards and wire it up.

   Reuses .setrow and .seg from css/game.css so it looks native — no new
   styles, no new vocabulary.
   ===================================================================== */
function injectRow(){
  const sheet = document.querySelector("#setup .sheet");
  if(!sheet || sheet.querySelector("#gfxSeg")) return;

  const tag = document.createElement("div");
  tag.className = "tag";
  tag.style.marginTop = "18px";
  tag.textContent = "Graphics";

  const row = document.createElement("div");
  row.className = "setrow";
  row.innerHTML =
    '<div class="setrow-top"><span class="setlbl">Cars &amp; cockpit</span></div>' +
    '<div class="seg" id="gfxSeg">' +
      '<button type="button" data-v="painted">Painted</button>' +
      '<button type="button" data-v="polygon">Polygon</button>' +
    '</div>' +
    '<div class="phase-hint" style="margin-top:10px">' +
      'Painted uses the hand-drawn car art. Polygon draws the cars and your ' +
      'cockpit as flat-shaded 3D. Switch any time, even mid-race.' +
    '</div>';

  const anchor = sheet.querySelector(".btnrow");
  if(anchor){ sheet.insertBefore(tag, anchor); sheet.insertBefore(row, anchor); }
  else      { sheet.appendChild(tag); sheet.appendChild(row); }

  const seg = row.querySelector("#gfxSeg");
  const paint = () => {
    const m = mode();
    seg.querySelectorAll("button").forEach(b =>
      b.classList.toggle("sel", b.dataset.v === m));
  };
  seg.querySelectorAll("button").forEach(b => {
    b.onclick = () => { set(b.dataset.v); paint(); };
  });
  paint();
}

(function wrapSettings(){
  const orig = window.openSettings;
  if(typeof orig !== "function"){
    /* game.js hasn't defined it yet — try again once the page settles */
    if(document.readyState === "loading"){
      document.addEventListener("DOMContentLoaded", wrapSettings, { once:true });
    }
    return;
  }
  window.openSettings = function(...a){
    const r = orig.apply(this, a);
    try{ injectRow(); }catch(e){ console.warn("[fpview-poly] settings row:", e); }
    return r;
  };
})();

})();


/* =====================================================================
   FPVIEW HOOKS — the five edits made to js/fpview.js
   ---------------------------------------------------------------------
   Recorded here so they are easy to find, review and re-apply if fpview
   is ever regenerated.

   1. makeProjector() — expose the focal length on the returned projector:
          return { horizon, focal: FOCAL, proj(px, py, hz){ ... } };

   2. render(), just after `const P = makeProjector(cam);`
          if(window.FPCTX){ FPCTX.P = P; FPCTX.cam = cam; }
          if(window.FPPOLY) FPPOLY.sun(LIGHT.side);

   3. drawRival() — signature gains `o`, and delegates first:
          function drawRival(g, x, y, w, color, glow, rel, brake, o){
            if(window.FPPOLY && FPPOLY.on("cars") &&
               FPPOLY.car(g, x, y, w, color, glow, rel, brake, o)) return;
      ...and its one call site passes the extra argument.

   4. drawHood() / drawWheel() — same shape, keyed on "cockpit":
          if(window.FPPOLY && FPPOLY.on("cockpit") && FPPOLY.hood(g,p,steer)) return;
          if(window.FPPOLY && FPPOLY.on("cockpit") && FPPOLY.wheel(g,steer,p)) return;

   5. Just before `requestAnimationFrame(tick);` — publish the frame state:
          try{ window.FPCTX = { get W(){return W;}, get H(){return H;},
                                get DPR(){return DPR;}, LIGHT, THEME,
                                P:null, cam:null }; }catch(e){}

   Every hook fails open: if poly.js is missing, or FPPOLY.car() returns
   false, fpview carries straight on into the painted path.
   ===================================================================== */
