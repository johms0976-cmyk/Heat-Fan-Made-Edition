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
  shadow  : 0.34,    // contact-shadow alpha (flat, hard-edged)

  hub     : { y:0.42, z:-0.30 },  // steering hub in eye space (metres)
  lean    : 0.26,                 // wheel lean-forward, radians
  turn    : 0.42,                 // radians of wheel per unit steer
  turnMax : 0.85,

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
                                        pitch, persp:0.06 });
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
/* The cockpit model is authored in eye space (see js/models/cockpit.js),
   so it shares fpview's focal length and horizon and needs no camera
   transform.  It only sways a little with the steer. */
function hood(g, p, steer){
  const v = view(), P = window.POLY;
  if(!P) return false;
  const pal = palFor((p && p.color) || "#8a5cf6");
  P.draw(g, "cockpit_60s", {
    mode    : "persp",
    pal,
    cx      : v.W/2 + steer * v.W * 0.006,
    horizon : horizonOf(v),
    focal   : focalOf(v),
    near    : 0.30
  });
  return true;
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
  car, hood, wheel, palFor, LIVERY, MAT
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
