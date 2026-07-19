/* =====================================================================
   FPVIEW — OutRun-style first-person cockpit cam for HEAT     (Phase 3)
   ---------------------------------------------------------------------
   A self-contained drop-in. Loads AFTER js/game.js (and before
   career-mods.js so wrap chains stack cleanly):

       <script src="js/fpview.js"></script>

   PHASE 1: whenever the human car is visually moving, a canvas fades
   over #trackwrap and renders the run from the driver's seat — flat-
   plane projection of the traced centreline, kerbs, corner boards with
   live limits, chequered gantry, tunnels, rivals as billboard sprites,
   minimap.

   PHASE 2: the cockpit holds for the human's whole resolution turn;
   payHeat / spin-outs / slipstream / gravel drive windshield FX; a
   driver HUD shows speed, gear, Engine pips and the next corner; the
   road wears its gravel, weather sectors and screen weather.

   PHASE 3 — FULL HUD MODE: the whole ROUND is played from the cockpit.
     · The real #panel (gear gate, hand of cards, every action button)
       stays in its natural place in the page — BELOW the
       gear/engine/speed gauge ribbon — and is simply re-skinned as a
       translucent dashboard sheet whenever HUD mode is up. All game
       logic and edge cases (tournament mode, cluttered hands, hotseat,
       weather specials, championship events) keep working untouched,
       because it IS the same DOM the game drives.
     · stageShift / stagePlay raise the cockpit at the START of the
       round: you shift gears and choose cards from the driver's seat,
       then watch the reveal drive itself out of the windshield.
     · Landing previews (highlightSpaces) are mirrored onto the ROAD —
       glowing bands ahead of you where the selected cards would land —
       and as rings on the minimap, replacing the hidden board preview.
     · A grab-tab above the panel collapses the dashboard;
       H toggles HUD mode entirely (remembered between sessions).

   PHASE 4 (new):
     · A PERSPECTIVE BUTTON floats on the track view — one tap flips
       between the cockpit cam and the classic board-game view, no
       keyboard needed (same switch as the V key).
     · TERRAIN SKIES — the windshield world is themed from
       TRACK.terrain (the same field the painted art board uses):
       desert sunsets with dunes & saguaros, city skylines with lit
       windows, snowy peaks, savannah acacias, parkland trees…

   PHASE 5 (new) — DEPTH:
     · ROAD ELEVATION — the road rolls over hills and dips. Crests
       properly OCCLUDE the road behind them (cars and corner boards
       peek over the brow). Profile is deterministic per track and
       loop-seamless; a track file may override it by declaring
       `elev: [ ...one height per space... ]` or tune the amount with
       `elevScale: 1.5` in its defineTrack data. The camera gently
       pitches into climbs and over crests.
     · DISTANCE FOG — road, kerbs, scenery, cars and boards all fade
       into the terrain's horizon haze, killing draw-distance pop-in.
       Orange haze in the desert, cold blue over the arctic, etc.
     · TRACKSIDE PROPS — world-space scenery flows past outside the
       kerbs, themed per terrain: cacti/rocks (desert), pines
       (mountain, snowy in arctic), oaks & bushes (parkland/oval),
       fence posts & barns (farmland), acacias (savannah), lit street
       lamps & buildings (urban) — plus white marshal tents before
       every corner and the odd HEAT billboard.

   PHASE 6 (new) — LIFE:
     · SMARTER RIVALS — rival sprites steer: their nose swings with
       their real heading relative to yours, so cars visibly turn in
       ahead. Brake lights flare when they decelerate hard, and cars
       running through gravel spaces kick up dust.
     · HEAT SHIMMER — as the Engine drains, hot air ripples over the
       hood (a sinusoidal displacement band) and a warm vignette
       creeps in. Your overheating engine is something you SEE.
     · SURFACE DETAIL — darkened tyre arcs build up on the approach
       to every corner, a subtle specular sheen rides the racing
       line, and near tarmac carries speckle grain that scrolls with
       the road.
     · STEERING WHEEL — a wheel with gloved hands (cuffs in your car
       colour) turns with your steering in the foreground.
     · GAUGE TILES — the SPEED tile becomes CORNER (spaces to the
       next corner line) and HAND becomes LIMIT (that corner's speed
       limit with road-condition tokens, weather wind and your
       upgrade adjustments already folded in; goes heat-red when your
       current speed would bust it).

   Controls / API:
       tap or click the view ....... dismiss cockpit for the current turn
       ▦ / ● button (top right) ... switch cockpit ⇄ board view
       V key ....................... same toggle from the keyboard
       H key ....................... toggle full-HUD (dash) mode
       dash grab-tab ............... collapse / raise the dashboard sheet
       FPCAM.enabled / FPCAM.hud ... same switches from the console
   ===================================================================== */
(function(){
"use strict";

/* bail out quietly if the game script didn't load */
if(typeof G === "undefined" || typeof PT !== "function"){ return; }

function loadPref(k, dflt){
  try{ const v = localStorage.getItem("fpcam."+k); return v==null ? dflt : v==="1"; }
  catch(_){ return dflt; }
}
function savePref(k, v){ try{ localStorage.setItem("fpcam."+k, v?"1":"0"); }catch(_){} }

const FP = window.FPCAM = {
  enabled : loadPref("enabled", true),  // master switch (V key toggles)
  hud     : loadPref("hud", true),      // Phase 3: play the round from the cockpit
  active  : false,
  snooze  : false,
  hold    : false,
  phase   : "",         // "shift" | "play" | "move" | "react" | "slip" | "corner" | ""
  linger  : 0,
  cam     : { total:0, off:0, head:null, roll:0, spd:0, bob:0, shake:0 },
  fx      : [],
  parts   : [],
  lastT   : 0,
  _lastTot: null,
  _stagePhase: "",      // "shift" | "play" | "" — where the round currently is
  _land   : []          // mirrored landing highlights [{total, kind}]
};

/* ---------- tuning ---------- */
const VIEW_SPACES = 16;
const STEP        = 0.22;
const NEAR        = 3.0;
const ROAD_HW     = 19;
const KERB_W      = 4.5;
const GRAVEL_W    = 8;
const CAR_W       = 15;
const CAM_H       = 10;
const LINGER_MS   = 850;
const RELEASE_MS  = 1600;
const FOG_START   = 3.5;   // spaces before the haze starts
const FOG_MAX     = 0.90;  // how fully things dissolve at max distance

/* fog amount for a point d spaces ahead */
function fogAt(d){
  const t = (d - FOG_START) / (VIEW_SPACES - FOG_START);
  return t <= 0 ? 0 : Math.min(1, Math.pow(t, 1.35)) * FOG_MAX;
}
/* cached colour mixer (hex or rgb() in, rgb() out) — hot path in the row loop */
const MIXC = new Map();
function colParse(c){
  let m = /^#?([0-9a-f]{6})$/i.exec(c||"");
  if(m){ const n=parseInt(m[1],16); return [n>>16, (n>>8)&255, n&255]; }
  m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(c||"");
  return m ? [ +m[1], +m[2], +m[3] ] : null;
}
function mixHex(c1, c2, t){
  if(t <= 0) return c1;
  if(t >= 1) return c2;
  const q = Math.round(t*24), key = c1 + "\u0000" + c2 + q;
  const hit = MIXC.get(key); if(hit) return hit;
  const a = colParse(c1), b = colParse(c2); if(!a || !b) return c1;
  const f = q/24;
  const v = "rgb(" + Math.round(a[0]+(b[0]-a[0])*f) + "," +
                     Math.round(a[1]+(b[1]-a[1])*f) + "," +
                     Math.round(a[2]+(b[2]-a[2])*f) + ")";
  if(MIXC.size > 6000) MIXC.clear();
  MIXC.set(key, v);
  return v;
}

const REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- theme ---------- */
function cssVar(n, fb){
  const v = getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  return v || fb;
}
const THEME = {
  purple : cssVar("--purple",      "#8a5cf6"),
  glow   : cssVar("--purple-glow", "#a985ff"),
  deep   : cssVar("--purple-deep", "#4b2fa8"),
  cream  : cssVar("--cream",       "#f0e7d3"),
  dim    : cssVar("--cream-dim",   "#b9ae95"),
  grass  : cssVar("--grass",       "#2c3a24"),
  heat   : cssVar("--heat",        "#e4573d"),
  stress : cssVar("--stress",      "#d8c23a"),
};

/* ---------- DOM ---------- */
const wrap = document.getElementById("trackwrap");
if(!wrap) return;

const style = document.createElement("style");
style.textContent = `
  #fpcam{position:absolute; inset:0; z-index:40; opacity:0; pointer-events:none;
         transition:opacity .32s ease; background:#0d0a13}
  #fpcam.on{opacity:1; pointer-events:auto}
  #fpchip{position:absolute; top:8px; right:10px; z-index:41; opacity:0; pointer-events:none;
          transition:opacity .32s ease; font:700 9px/1.2 var(--mono, monospace);
          letter-spacing:1.6px; text-transform:uppercase; color:${THEME.dim};
          background:rgba(13,10,19,.55); border:1px solid ${THEME.deep};
          border-radius:8px; padding:4px 8px}
  #fpcam.on ~ #fpchip{opacity:1}

  /* ---------- perspective switch (cockpit ⇄ board), always tappable ----- */
  #fpviewbtn{
    position:absolute; right:10px; bottom:10px; z-index:47; cursor:pointer;
    font:800 10px/1 var(--mono, monospace); letter-spacing:1.6px;
    text-transform:uppercase; color:${THEME.cream};
    background:rgba(24,18,36,.82); border:1px solid ${THEME.purple};
    border-radius:9px; padding:6px 10px 7px; user-select:none;
    box-shadow:0 2px 10px rgba(0,0,0,.45);
  }
  #fpviewbtn:active{ transform:translateY(1px); }

  /* ---------- Phase 3: the dashboard sheet ------------------------------
     The REAL #panel no longer moves — it stays in the page flow right
     below the #gauges ribbon and is only re-skinned while HUD mode is
     up, so the reading order is: windshield → gauges → dashboard.     */
  body.fp-hud-mode #panel{
    max-height:48vh; overflow-y:auto; -webkit-overflow-scrolling:touch;
    padding:10px 12px 12px;
    background:linear-gradient(180deg, rgba(24,18,36,.92), rgba(13,10,19,.96));
    border-top:2px solid ${THEME.deep};
    box-shadow:0 -10px 30px rgba(0,0,0,.45);
    transition:max-height .28s ease, padding .28s ease;
  }
  body.fp-hud-mode.fp-dashmin #panel{
    max-height:0; padding-top:0; padding-bottom:0; overflow:hidden;
    border-top-width:0;
  }
  /* grab-tab sits in the flow between the gauges and the sheet */
  #fpdocktab{
    display:none; width:100%; text-align:center; cursor:pointer;
    padding:4px 0 6px; user-select:none;
    background:${THEME.deep}; color:${THEME.cream};
    border-top:1px solid ${THEME.purple};
    font:800 10px/1 var(--mono, monospace); letter-spacing:2px;
  }
  body.fp-hud-mode #fpdocktab{ display:block; }

  /* dashboard flavour on the controls */
  body.fp-hud-mode #geargate{ display:flex; gap:8px; justify-content:center; }
  body.fp-hud-mode .gearopt{
    border-radius:50%; width:56px; height:56px; box-shadow:inset 0 3px 8px rgba(0,0,0,.6),
      0 2px 0 rgba(255,255,255,.08);
  }
  body.fp-hud-mode #hand{ padding-bottom:6px; }
  body.fp-hud-mode .phase-title{ font-size:11px; }
`;
document.head.appendChild(style);

const cv = document.createElement("canvas");
cv.id = "fpcam";
wrap.appendChild(cv);
const chip = document.createElement("div");
chip.id = "fpchip";
chip.textContent = "● cockpit — tap road to skip · ▦ btn / V switch view · H dash";
wrap.appendChild(chip);
const tab = document.createElement("div");
tab.id = "fpdocktab";
tab.textContent = "▾ DASH";
const vbtn = document.createElement("button");
vbtn.id = "fpviewbtn";
vbtn.type = "button";
wrap.appendChild(vbtn);
const ctx = cv.getContext("2d");

/* one switch for keyboard + button: cockpit cam ⇄ classic board view */
function updateViewBtn(){
  vbtn.textContent = FP.enabled ? "▦ BOARD VIEW" : "● COCKPIT VIEW";
  vbtn.title = FP.enabled ? "Switch to the board-game view"
                          : "Switch to the cockpit view";
}
function toggleView(){
  FP.enabled = !FP.enabled; savePref("enabled", FP.enabled);
  if(!FP.enabled){ FP.hold = false; hide(); }
  else{
    FP.snooze = false;
    /* if we're mid shift/play stage, raise the cockpit right away */
    if(FP.hud && FP._stagePhase) engageHold(FP._stagePhase);
  }
  updateViewBtn();
  if(typeof toast === "function")
    toast(FP.enabled ? "Cockpit view ON" : "Board view — cockpit cam off");
}
updateViewBtn();
vbtn.addEventListener("pointerdown", e => e.stopPropagation());
vbtn.addEventListener("click", e => { e.stopPropagation(); toggleView(); });

let W=0, H=0, DPR=1;
function fit(){
  const r = wrap.getBoundingClientRect();
  DPR = Math.min(2, window.devicePixelRatio||1);
  W = Math.max(2, r.width); H = Math.max(2, r.height);
  cv.width = Math.round(W*DPR); cv.height = Math.round(H*DPR);
  cv.style.width = W+"px"; cv.style.height = H+"px";
}
fit();
if(window.ResizeObserver) new ResizeObserver(fit).observe(wrap);
else addEventListener("resize", fit);

cv.addEventListener("pointerdown", ()=>{ FP.snooze = true; hide(); });
tab.addEventListener("pointerdown", e=>{
  e.stopPropagation();
  const min = document.body.classList.toggle("fp-dashmin");
  tab.textContent = min ? "▴ DASH" : "▾ DASH";
});
addEventListener("keydown", e=>{
  if(e.key==="v" || e.key==="V"){ toggleView(); }
  if(e.key==="h" || e.key==="H"){
    FP.hud = !FP.hud; savePref("hud", FP.hud);
    if(FP.active){ FP.hud ? dock() : undock(); }
    if(typeof toast === "function") toast(FP.hud ? "Full-HUD dash ON" : "Full-HUD dash OFF");
  }
});

function show(){ if(FP.active) return; FP.active = true; cv.classList.add("on"); if(FP.hud) dock(); }
function hide(){ if(!FP.active) return; FP.active = false; cv.classList.remove("on"); undock(); }

/* ---------- Phase 3: dress the real #panel as the dashboard ----------
   The panel stays exactly where it lives in the page — right below the
   gear/engine/speed gauge ribbon — so the layout while driving reads:
   windshield → gauges → dashboard sheet. Docking is now purely a
   re-skin (a body class) plus a grab-tab slotted in above the panel. */
let DOCKED = false;
function panelEl(){ return document.getElementById("panel"); }
function dock(){
  const panel = panelEl();
  if(DOCKED || !panel) return;
  /* seat the grab-tab in the flow, directly above the panel */
  if(tab.parentNode !== panel.parentNode || tab.nextSibling !== panel){
    panel.parentNode.insertBefore(tab, panel);
  }
  document.body.classList.add("fp-hud-mode");
  document.body.classList.remove("fp-dashmin");
  tab.textContent = "▾ DASH";
  DOCKED = true;
}
function undock(){
  if(!DOCKED) return;
  document.body.classList.remove("fp-hud-mode");
  document.body.classList.remove("fp-dashmin");
  DOCKED = false;
}

/* =====================================================================
   Game hooks (same monkey-wrap pattern career-mods.js uses)
   ===================================================================== */
function wrapFn(name, before, after){
  const f = window[name];
  if(typeof f !== "function") return;
  window[name] = function(...a){
    try{ if(before) before.apply(this, a); }catch(_){}
    const r = f.apply(this, a);
    try{ if(after)  after.apply(this, [r].concat(a)); }catch(_){}
    return r;
  };
}
const isHumanP = p => p && !p.isBot && !p.sim;

function stamp(text, color, sub){
  FP.fx.push({kind:"stamp", text, sub:sub||"", color:color||THEME.cream,
              t0:performance.now(), dur:1500});
}
function flare(strength, dur){
  FP.fx.push({kind:"flare", a:strength, t0:performance.now(), dur:dur||900});
}
function burst(n, col, spread, up){
  for(let k=0;k<n;k++){
    FP.parts.push({
      x: W/2 + (Math.random()-.5)*W*0.5,
      y: H*0.72 + (Math.random()-.5)*H*0.12,
      vx:(Math.random()-.5)*(spread||140),
      vy:-(20 + Math.random()*(up||90)),
      r: 6 + Math.random()*16, life:1, col: col||"rgba(120,115,125,"
    });
  }
}

function engageHold(phase){
  const p = safeHuman();
  if(!p || !FP.enabled || REDUCED) return;
  FP.hold = true; FP.phase = phase; FP.snooze = false;
  if(FP._lastTot == null) FP._lastTot = p.total;
  resetCamIfFar(p);
}

function hookGame(){
  /* --- Phase 3: the round starts in the cockpit --- */
  wrapFn("stageShift", function(){ FP._stagePhase="shift"; if(FP.hud && FP.enabled) engageHold("shift"); });
  wrapFn("stagePlay",  function(){ FP._stagePhase="play";  if(FP.hud && FP.enabled) engageHold("play");  });

  /* --- the resolution turn --- */
  wrapFn("playerReveal", function(){
    FP._stagePhase = "";
    engageHold("move");
    const p = safeHuman(); if(p) FP._lastTot = p.total;
  });
  wrapFn("playerReact",       function(){ if(FP.hold) FP.phase = "react";  });
  wrapFn("playerSlipstream",  function(){ if(FP.hold) FP.phase = "slip";   });
  wrapFn("playerCornerCheck", function(){ if(FP.hold) FP.phase = "corner"; });
  const release = () => {
    FP._stagePhase = "";
    if(FP.hold){ FP.hold=false; FP.phase=""; FP.linger = performance.now() + RELEASE_MS; }
  };
  wrapFn("playerDiscard",   release);
  wrapFn("playerReplenish", release);
  wrapFn("endRound",        release);
  wrapFn("raceOver",  function(){ FP.hold=false; FP.phase=""; FP._stagePhase=""; hide(); });
  ["restartRace","newGame","startChampRace"].forEach(n =>
    wrapFn(n, function(){ FP.hold=false; FP.phase=""; FP._stagePhase=""; FP.fx.length=0;
                          FP.parts.length=0; FP._land=[]; hide(); }));

  /* --- landing previews → windshield road + minimap --- */
  wrapFn("highlightSpaces", function(items){ FP._land = (items||[]).slice(0, 400); });
  wrapFn("clearHighlights", function(){ FP._land = []; });

  /* --- events --- */
  wrapFn("payHeat", function(p, n){
    if(!isHumanP(p) || !(FP.active || FP.hold) || !(n>0)) return;
    flare(Math.min(.55, .16 + .09*n), 800 + 200*n);
    const sub = FP.phase==="corner" ? "over the limit"
              : FP.phase==="shift"  ? "double shift" : "";
    stamp(`−${n} HEAT`, THEME.heat, sub);
    FP.cam.shake = Math.min(1, .3 + .12*n);
  });
  wrapFn("weatherSpinOut", function(p){
    if(!isHumanP(p)) return;
    stamp("SPIN OUT!", "#ff5340", "back before the corner · 1st gear");
    flare(.5, 1400);
    FP.cam.shake = 1.4;
    burst(26, "rgba(150,145,155,", 260, 130);
  });
  wrapFn("applyGravel", function(p){
    if(!isHumanP(p) || !(FP.active || FP.hold)) return;
    if(typeof onGravel === "function" && !onGravel(p)) return;
    if((p.engine|0) <= 0) return;
    burst(16, "rgba(178,150,105,", 200, 70);
    stamp("GRAVEL", "#c9a86a", "loose surface — Engine rattles");
  });
}
function safeHuman(){
  try{ return (G.players && G.players.length) ? curHuman() : null; }catch(_){ return null; }
}
function resetCamIfFar(p){
  const v = p._v; if(!v) return;
  if(Math.abs(FP.cam.total - v.total) > 25){
    FP.cam.total = v.total; FP.cam.off = v.off; FP.cam.head = null;
    FP.cam.spd = 0; FP.cam.roll = 0; FP._lastTot = p.total;
  }
}
hookGame();

/* =====================================================================
   GAUGE TILES — repurpose two ribbon tiles for racecraft:
     SPEED → CORNER : spaces to the next corner line
     HAND  → LIMIT  : that corner's speed limit with road-condition
                      tokens (limitAt), weather wind (windAdjAt) and the
                      player's upgrade/class adjustments (limitAdj) all
                      folded in. Turns heat-red when your current speed
                      would bust it.
   Piggybacks on the game's own renderGauges(), so it refreshes exactly
   when the game refreshes.
   ===================================================================== */
function effLimitAt(p, ct){
  let lim = null;
  try{
    lim = limitAt(ct) + (p.limitAdj||0)
        - (typeof windAdjAt === "function" ? (windAdjAt(ct)||0) : 0);
  }catch(_){}
  return lim;
}
function nextCornerOf(p){
  try{ if(typeof nextCornerTotal === "function") return nextCornerTotal(p.total); }catch(_){}
  try{ for(const c of cornerTotals()){ if(c > p.total) return c; } }catch(_){}
  return Infinity;
}
function retitleGauges(){
  const sv = document.getElementById("g-speed"), hv = document.getElementById("g-hand");
  if(sv && sv.previousElementSibling){
    sv.previousElementSibling.textContent = "Corner";
    if(sv.parentNode && sv.parentNode.setAttribute)
      sv.parentNode.setAttribute("title", "Spaces to the next corner line");
  }
  if(hv && hv.previousElementSibling){
    hv.previousElementSibling.textContent = "Limit";
    if(hv.parentNode && hv.parentNode.setAttribute)
      hv.parentNode.setAttribute("title",
        "Next corner's speed limit — tokens, weather wind and your upgrades included");
  }
}
function fpGauges(){
  const sv = document.getElementById("g-speed"), hv = document.getElementById("g-hand");
  if(!sv && !hv) return;
  const p = safeHuman(); if(!p) return;
  const nc = nextCornerOf(p);
  if(sv) sv.textContent = (nc === Infinity) ? "🏁"
                        : String(Math.max(0, Math.ceil(nc - p.total)));
  if(hv){
    if(nc === Infinity){ hv.textContent = "–"; hv.style.color = ""; }
    else{
      const lim = effLimitAt(p, nc);
      hv.textContent = (lim == null) ? "?" : String(lim);
      hv.style.color = (lim != null && (p.speed||0) > lim) ? THEME.heat : "";
    }
  }
}
retitleGauges();
wrapFn("renderGauges", null, fpGauges);
try{ fpGauges(); }catch(_){}

/* ---------- geometry ---------- */
function lerpPose(totF){
  const i = Math.floor(totF), f = totF - i;
  const a = PT(phys(i)), b = PT(phys(i+1));
  if(!a || !b) return null;
  return {
    x : a.x + (b.x-a.x)*f,  y : a.y + (b.y-a.y)*f,
    tx: a.tx + (b.tx-a.tx)*f, ty: a.ty + (b.ty-a.ty)*f,
    nx: a.nx + (b.nx-a.nx)*f, ny: a.ny + (b.ny-a.ny)*f
  };
}
const shortTurn = (from, to) => { let d=(to-from)%(2*Math.PI);
  if(d> Math.PI) d-=2*Math.PI; if(d<-Math.PI) d+=2*Math.PI; return d; };

function makeProjector(cam){
  const fx = Math.cos(cam.head), fy = Math.sin(cam.head);
  const rx = -fy, ry = fx;
  const FOCAL = H * 1.05;
  const horizon = H * 0.40 + cam.bob + (cam.pitch||0);
  const eyeH = CAM_H + (cam.elev||0);   // camera rides the road's elevation
  return {
    horizon,
    proj(px, py, hz){                    // hz = world elevation of the point
      const dx = px - cam.x, dy = py - cam.y;
      const zf = dx*fx + dy*fy;
      if(zf < NEAR) return null;
      const lat = dx*rx + dy*ry;
      const s = FOCAL / zf;
      return { x: W/2 + lat*s, y: horizon + (eyeH - (hz||0))*s, s, z: zf };
    }
  };
}

/* ---------- road elevation ----------------------------------------------
   Deterministic rolling profile per track, loop-seamless (periodic in S).
   A track file may override it entirely with `elev:[...]` (one height per
   space, in board-pixel units — ROAD_HW is 19 for scale) or just scale the
   generated hills with `elevScale`. Terrain sets the default drama level. */
let ELEVC = { track:null, vals:null };
function elevCache(){
  if(ELEVC.track === TRACK && ELEVC.vals) return ELEVC;
  const TT  = fpTerrain();
  const amp = (TRACK && TRACK.elevScale != null) ? TRACK.elevScale
            : (TT.elev != null ? TT.elev : 1);
  const vals = new Float32Array(S);
  if(TRACK && TRACK.elev && TRACK.elev.length){
    for(let sp=0; sp<S; sp++) vals[sp] = (TRACK.elev[sp % TRACK.elev.length] || 0) * amp;
  }else{
    for(let sp=0; sp<S; sp++){
      const t = sp/S * Math.PI*2;          // periodic → the lap wraps seamlessly
      vals[sp] = (Math.sin(t*3)*4.2 + Math.sin(t*7+1.7)*2.6 + Math.sin(t*13+0.6)*1.3) * amp;
    }
  }
  ELEVC = { track:TRACK, vals };
  return ELEVC;
}
function elevAt(totF){
  const E = elevCache().vals; if(!E) return 0;
  const i = Math.floor(totF), f = totF - i;
  const a = E[((phys(i)  )%S+S)%S];
  const b = E[((phys(i+1))%S+S)%S];
  const u = (1 - Math.cos(Math.PI*f)) * 0.5;   // cosine-smoothed between spaces
  return a + (b - a)*u;
}

function cornersAhead(fromTot, span){
  const out = [];
  try{ for(const c of cornerTotals()) if(c > fromTot && c <= fromTot + span) out.push(c); }catch(_){}
  return out;
}
function flagsAhead(fromTot, span){
  const out = [], RD = (typeof raceDist==="function") ? raceDist() : 1e9;
  if(typeof LAYOUT === "undefined") return out;
  if(LAYOUT === "loop"){
    for(let k=Math.ceil(fromTot/S)*S; k<=fromTot+span; k+=S) if(k>fromTot && k<=RD) out.push(k);
  }else if(LAYOUT === "leadin"){
    for(let k=LAP_START; k<=fromTot+span; k+=LAP_LEN) if(k>fromTot && k<=RD) out.push(k);
  }else{ if(S>fromTot && S<=fromTot+span) out.push(S); }
  return out;
}

/* ---------- track feature caches ---------- */
let FEAT = { track:null, gravelIn:new Set(), gravelOut:new Set(), wSector:new Set() };
function featCache(){
  if(FEAT.track === TRACK && FEAT.weather === (G.weather||null)) return FEAT;
  FEAT = { track:TRACK, weather:G.weather||null,
           gravelIn:new Set(), gravelOut:new Set(), wSector:new Set() };
  try{
    if(typeof gravelLists === "function"){
      const g = gravelLists(TRACK);
      g.inner.forEach(i=>FEAT.gravelIn.add(i));
      g.outer.forEach(i=>FEAT.gravelOut.add(i));
    }
  }catch(_){}
  try{
    if(G.weather && G.weather.sectorOfSpace && G.weather.sectorOfSpace.length &&
       typeof isWeatherSector === "function"){
      for(let sp=0; sp<S; sp++)
        if(isWeatherSector(G.weather.sectorOfSpace[sp])) FEAT.wSector.add(sp);
    }
  }catch(_){}
  return FEAT;
}
function weatherFlags(){
  const d = (G.weather && G.weather.def && G.weather.def.sector) || {};
  const key = (G.weather && G.weather.key) || "none";
  return { d, key };
}

/* =====================================================================
   TERRAIN SKIES — the windshield world themed from TRACK.terrain
   (the same field the painted art board uses):
   oval · mountain · parkland · farmland · desert · savannah · urban · arctic
   sky: [top, mid, low] dusk gradient · sun: rgb string · ground: [far, near]
   sil: horizon silhouette painter + colours
   ===================================================================== */
const FP_TERRAIN = {
  oval:     { sky:["#171128","#33254e","#5a3f7e"], sun:"240,231,211",
              ground:["#233020","#2c3a24"], elev:0.55,
              props:[["tree",3],["bush",2],["panel",0.7]],
              sil:{kind:"hills",    col:"#241c38"} },
  mountain: { sky:["#101a26","#26405a","#4d7089"], sun:"235,242,248",
              ground:["#28381f","#33452a"], elev:1.7,
              props:[["pine",4],["rock",2]],
              sil:{kind:"peaks",    col:"#182634", snow:"rgba(223,233,242,.85)"} },
  parkland: { sky:["#141d2c","#2b4544","#597a52"], sun:"246,240,214",
              ground:["#2a3c20","#3a4c2b"], elev:0.85,
              props:[["tree",4],["bush",2],["panel",0.4]],
              sil:{kind:"trees",    col:"#1c2a1d"} },
  farmland: { sky:["#1a1a2e","#403a5e","#7d5f72"], sun:"250,236,200",
              ground:["#2b3a20","#3a4c2b"], elev:0.6,
              props:[["post",3],["tree",2],["barn",0.5],["bush",1]],
              sil:{kind:"fields",   col:"#232a1c"} },
  desert:   { sky:["#2a162e","#7c3a4a","#d78a4e"], sun:"255,214,150",
              ground:["#7d6136","#a8895c"], elev:0.9,
              props:[["cactus",3],["rock",2],["drybush",2]],
              sil:{kind:"dunes",    col:"#4a2e2a", prop:"#232d1e"} },
  savannah: { sky:["#231a2c","#6e4045","#c98a45"], sun:"255,206,130",
              ground:["#6a5730","#8a7040"], elev:0.5,
              props:[["acacia",3],["drybush",2],["rock",1]],
              sil:{kind:"savannah", col:"#382b1f", prop:"#241c14"} },
  urban:    { sky:["#0c1020","#212a44","#3a4666"], sun:"216,226,255",
              ground:["#26272d","#37383e"], elev:0.35,
              props:[["lamp",4],["block",1.6],["panel",1]],
              sil:{kind:"city",     col:"#131826", win:"rgba(255,214,130,.75)"} },
  arctic:   { sky:["#1b2836","#3a5570","#7d9ab2"], sun:"238,246,255",
              ground:["#a9bccb","#d5e2ec"], elev:1.25,
              props:[["pine",3],["snowrock",2]],
              sil:{kind:"peaks",    col:"#c3d3e0", snow:"rgba(255,255,255,.9)"} }
};
function fpTerrain(){
  const t = (typeof TRACK !== "undefined" && TRACK && TRACK.terrain) || "oval";
  return FP_TERRAIN[t] || FP_TERRAIN.oval;
}
/* deterministic 0..1 hash for prop heights/variants */
function hsh(i){ const s = Math.sin(i*127.1 + 311.7)*43758.5453; return s - Math.floor(s); }

/* horizon silhouette, parallaxed against the camera heading */
function drawSilhouette(hz, TT){
  const sil = TT.sil, head = FP.cam.head;
  ctx.fillStyle = sil.col;

  if(sil.kind === "hills" || sil.kind === "fields"){
    const soft = sil.kind === "fields" ? 0.6 : 1;      // farmland lies flatter
    ctx.beginPath(); ctx.moveTo(0, hz);
    for(let x=0; x<=W; x+=12){
      const t = (x*0.013 - head*2.2);
      ctx.lineTo(x, hz - 10 - soft*Math.abs(Math.sin(t)*14 + Math.sin(t*2.7)*6));
    }
    ctx.lineTo(W, hz); ctx.closePath(); ctx.fill();
    return;
  }

  if(sil.kind === "peaks"){
    ctx.beginPath(); ctx.moveTo(0, hz);
    const pts = [];
    for(let x=0; x<=W; x+=8){
      const t = (x*0.010 - head*2.2);
      const h = 14 + Math.abs(Math.sin(t)*30 + Math.sin(t*2.3+1.7)*16 + Math.sin(t*5.1)*6);
      pts.push([x, hz - h]);
      ctx.lineTo(x, hz - h);
    }
    ctx.lineTo(W, hz); ctx.closePath(); ctx.fill();
    if(sil.snow){                                       // snow caps along the ridge
      ctx.strokeStyle = sil.snow; ctx.lineWidth = 2.5; ctx.beginPath();
      pts.forEach((q,i)=> i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]));
      ctx.stroke();
    }
    return;
  }

  if(sil.kind === "trees"){                             // parkland canopy bumps
    ctx.beginPath(); ctx.moveTo(0, hz);
    for(let x=0; x<=W; x+=6){
      const t = (x*0.020 - head*2.2);
      const h = 8 + Math.abs(Math.sin(t)*10) + Math.abs(Math.sin(t*3.7+0.9))*9;
      ctx.lineTo(x, hz - h);
    }
    ctx.lineTo(W, hz); ctx.closePath(); ctx.fill();
    return;
  }

  if(sil.kind === "dunes"){                             // long soft dunes + saguaros
    ctx.beginPath(); ctx.moveTo(0, hz);
    for(let x=0; x<=W; x+=14){
      const t = (x*0.006 - head*2.2);
      ctx.lineTo(x, hz - 6 - Math.abs(Math.sin(t)*16 + Math.sin(t*1.9+2.2)*8));
    }
    ctx.lineTo(W, hz); ctx.closePath(); ctx.fill();
    scatterProps(hz, 140, (x, r)=>{                     // cacti
      const ch = 10 + r*14, cw = Math.max(1.6, ch*0.16);
      ctx.fillStyle = TT.sil.prop;
      ctx.fillRect(x-cw/2, hz-ch, cw, ch);
      ctx.fillRect(x-cw*1.9, hz-ch*0.62, cw*1.4, cw);   // left arm
      ctx.fillRect(x-cw*1.9, hz-ch*0.62, cw*0.8, ch*0.30);
      ctx.fillRect(x+cw*0.5, hz-ch*0.48, cw*1.4, cw);   // right arm
      ctx.fillRect(x+cw*1.1, hz-ch*0.48, cw*0.8, ch*0.22);
    });
    return;
  }

  if(sil.kind === "savannah"){                          // flat veld + acacias
    ctx.beginPath(); ctx.moveTo(0, hz);
    for(let x=0; x<=W; x+=16){
      const t = (x*0.008 - head*2.2);
      ctx.lineTo(x, hz - 4 - Math.abs(Math.sin(t)*7));
    }
    ctx.lineTo(W, hz); ctx.closePath(); ctx.fill();
    scatterProps(hz, 180, (x, r)=>{                     // umbrella canopies
      const th = 9 + r*10, cw = 14 + r*16;
      ctx.strokeStyle = TT.sil.prop; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x, hz); ctx.lineTo(x, hz-th); ctx.stroke();
      ctx.fillStyle = TT.sil.prop;
      ctx.beginPath(); ctx.ellipse(x, hz-th, cw/2, 3.2+r*2, 0, 0, 7); ctx.fill();
    });
    return;
  }

  if(sil.kind === "city"){                              // skyline with lit windows
    const R = 190, bw = 34;
    const k0 = Math.floor((head*R)/bw) - 1, kN = k0 + Math.ceil(W/bw) + 3;
    for(let k=k0; k<=kN; k++){
      const x = k*bw - head*R;
      if(x > W + bw || x < -bw*2) continue;
      const r = hsh(k);
      const bh = 18 + r*54, w2 = bw*(0.62 + hsh(k+9.7)*0.30);
      ctx.fillStyle = sil.col;
      ctx.fillRect(x, hz-bh, w2, bh);
      if(r > 0.35 && sil.win){                          // a few lit windows
        ctx.fillStyle = sil.win;
        const rows = 2 + Math.floor(r*4);
        for(let wy=0; wy<rows; wy++) for(let wx=0; wx<2; wx++){
          if(hsh(k*13.7 + wy*3.1 + wx) < 0.45) continue;
          ctx.fillRect(x + 4 + wx*(w2/2), hz - bh + 5 + wy*9, 3, 3.6);
        }
      }
      if(hsh(k+4.2) > 0.82){                            // occasional antenna
        ctx.strokeStyle = sil.col; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(x+w2/2, hz-bh); ctx.lineTo(x+w2/2, hz-bh-8); ctx.stroke();
      }
    }
    return;
  }
}
/* place discrete props (cacti, acacias) on a parallax belt, wrapping */
function scatterProps(hz, spacing, draw){
  const R = 190, span = W + spacing*2;
  const off = ((FP.cam.head*R) % span + span) % span;
  for(let k=0; k<Math.ceil(span/spacing); k++){
    const x = ((k*spacing - off) % span + span) % span - spacing;
    if(x < -spacing || x > W + spacing) continue;
    draw(x, hsh(k+0.5));
  }
}

/* =====================================================================
   TRACKSIDE PROPS — world-space scenery outside the kerbs, themed per
   terrain and deterministic per space (so the same bush is always on
   the same brow, lap after lap). Marshal tents spawn before corners.
   ===================================================================== */
let PROPC = { track:null, terr:"", bySp:null };
function propCache(){
  const terr = (typeof TRACK !== "undefined" && TRACK && TRACK.terrain) || "oval";
  if(PROPC.track === TRACK && PROPC.terr === terr && PROPC.bySp) return PROPC;
  const conf = (FP_TERRAIN[terr] || FP_TERRAIN.oval).props || [["tree",1]];
  const totW = conf.reduce((s,c)=>s+c[1], 0) || 1;
  const bySp = new Map();
  const put  = (sp,p)=>{ const a=bySp.get(sp)||[]; a.push(p); bySp.set(sp,a); };
  for(let sp=0; sp<S; sp++){
    for(const side of [-1,1]){
      if(hsh(sp*7.31 + side*13.7) > 0.42) continue;          // density gate
      let pick = hsh(sp*3.17 + side*5.5)*totW, kind = conf[0][0];
      for(const [k,w] of conf){ if(pick < w){ kind=k; break; } pick -= w; }
      put(sp, { side, kind,
                frac: hsh(sp*9.1 + side),                    // where in the space
                lat : 8 + hsh(sp*4.7 + side*2.3)*22,         // beyond the gravel strip
                sc  : 0.8 + hsh(sp*6.3 + side*8.8)*0.7,
                r   : hsh(sp*11.7 + side*3.9) });
    }
  }
  /* a white marshal tent shortly before every corner */
  try{
    const seen = new Set();
    for(const c of cornerTotals()){
      const sp = ((phys(Math.floor(c) - 2))%S+S)%S;
      if(seen.has(sp)) continue; seen.add(sp);
      put(sp, { side: hsh(sp*2.2) < .5 ? -1 : 1, kind:"tent",
                frac:.5, lat:9, sc:1.05, r:hsh(sp) });
    }
  }catch(_){}
  PROPC = { track:TRACK, terr, bySp };
  return PROPC;
}

/* one prop billboard. (x,y) = base on the ground, u = screen px per world
   unit at that depth (road half-width is 19u for scale), r = 0..1 variant */
function drawProp(g, kind, x, y, u, r){
  switch(kind){
  case "tree":{
    const th = (7+r*3)*u, cw = (6.5+r*2)*u;
    g.strokeStyle="#3a2c1c"; g.lineWidth=Math.max(1, 1.5*u); g.lineCap="round";
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y-th); g.stroke();
    g.fillStyle = r<.5 ? "#2e4a26" : "#3a5c30";
    g.beginPath(); g.arc(x, y-th-cw*0.55, cw*0.75, 0, 7); g.fill();
    g.fillStyle = r<.5 ? "#3a5c30" : "#456b38";
    g.beginPath(); g.arc(x-cw*0.4, y-th-cw*0.30, cw*0.5, 0, 7);
    g.arc(x+cw*0.4, y-th-cw*0.34, cw*0.52, 0, 7); g.fill();
    break; }
  case "pine":{
    const th=(9+r*5)*u, cw=(5+r*2)*u, snow = fpTerrain().sil.snow;
    g.strokeStyle="#33261a"; g.lineWidth=Math.max(1, 1.3*u);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y-th*0.35); g.stroke();
    g.fillStyle="#26402a";
    for(let k=0;k<3;k++){
      const ty=y-th*(0.30+k*0.24), w2=cw*(1-k*0.26);
      g.beginPath(); g.moveTo(x-w2, ty); g.lineTo(x+w2, ty); g.lineTo(x, ty-th*0.32);
      g.closePath(); g.fill();
    }
    if(snow){ g.strokeStyle=snow; g.lineWidth=Math.max(1, 1.2*u);
      g.beginPath(); g.moveTo(x-cw*0.8, y-th*0.52); g.lineTo(x, y-th*0.86);
      g.lineTo(x+cw*0.8, y-th*0.52); g.stroke(); }
    break; }
  case "cactus":{
    const ch=(6+r*5)*u, cw=Math.max(1.4, ch*0.16);
    g.fillStyle="#3f5a2e"; g.strokeStyle="#2c4020"; g.lineWidth=Math.max(1, 0.8*u);
    const arm=(ax,ah)=>{ g.fillRect(ax, y-ch*0.55, cw*0.8, cw*0.8);
                         g.fillRect(ax, y-ch*0.55-ah, cw*0.8, ah); };
    g.fillRect(x-cw/2, y-ch, cw, ch); g.strokeRect(x-cw/2, y-ch, cw, ch);
    arm(x-cw*1.7, ch*0.28); arm(x+cw*0.9, ch*0.22);
    break; }
  case "rock": case "snowrock":{
    const rh=(2.5+r*2.5)*u, rw=rh*(1.4+r*0.6);
    g.fillStyle = kind==="snowrock" ? "#b9c9d6" : "#6d6862";
    g.beginPath(); g.moveTo(x-rw, y); g.lineTo(x-rw*0.5, y-rh);
    g.lineTo(x+rw*0.35, y-rh*(0.75+r*0.3)); g.lineTo(x+rw, y);
    g.closePath(); g.fill();
    g.fillStyle = kind==="snowrock" ? "#e9f2f8" : "#8a847c";
    g.beginPath(); g.moveTo(x-rw*0.5, y-rh); g.lineTo(x+rw*0.35, y-rh*(0.75+r*0.3));
    g.lineTo(x+rw*0.1, y-rh*0.35); g.closePath(); g.fill();
    break; }
  case "bush": case "drybush":{
    const bw=(3+r*2)*u;
    g.fillStyle = kind==="drybush" ? "#5c5630" : "#33502a";
    g.beginPath(); g.ellipse(x, y-bw*0.35, bw, bw*0.55, 0, 0, 7); g.fill();
    break; }
  case "acacia":{
    const th=(7+r*3)*u, cw=(8+r*4)*u;
    g.strokeStyle="#41301e"; g.lineWidth=Math.max(1, 1.2*u); g.lineCap="round";
    g.beginPath(); g.moveTo(x, y); g.lineTo(x+cw*0.08, y-th); g.stroke();
    g.beginPath(); g.moveTo(x+cw*0.04, y-th*0.6); g.lineTo(x-cw*0.25, y-th*0.9); g.stroke();
    g.fillStyle="#3c4a24";
    g.beginPath(); g.ellipse(x, y-th, cw*0.7, (1.4+r)*u, 0, 0, 7); g.fill();
    break; }
  case "post":{
    const ph=(3+r)*u;
    g.fillStyle="#7a6a4c"; g.fillRect(x-0.4*u, y-ph, Math.max(1, 0.8*u), ph);
    break; }
  case "barn":{
    const bw=(9+r*3)*u, bh=(5+r*1.5)*u;
    g.fillStyle="#8c3a2e"; g.fillRect(x-bw/2, y-bh, bw, bh);
    g.fillStyle="#5e2620";
    g.beginPath(); g.moveTo(x-bw*0.58, y-bh); g.lineTo(x, y-bh-bw*0.30);
    g.lineTo(x+bw*0.58, y-bh); g.closePath(); g.fill();
    g.fillStyle="#3a2320"; g.fillRect(x-bw*0.12, y-bh*0.6, bw*0.24, bh*0.6);
    break; }
  case "lamp":{
    const lh=(11+r*2)*u;
    g.strokeStyle="#8a8f98"; g.lineWidth=Math.max(1, 0.9*u); g.lineCap="round";
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y-lh);
    g.lineTo(x + 2.4*u, y-lh+0.6*u); g.stroke();
    const gl = g.createRadialGradient(x+2.4*u, y-lh+1.2*u, 0.3*u, x+2.4*u, y-lh+1.2*u, 3.4*u);
    gl.addColorStop(0,"rgba(255,214,130,.85)"); gl.addColorStop(1,"rgba(255,214,130,0)");
    g.fillStyle=gl; g.beginPath(); g.arc(x+2.4*u, y-lh+1.2*u, 3.4*u, 0, 7); g.fill();
    g.fillStyle="#ffe9b8"; g.beginPath(); g.arc(x+2.4*u, y-lh+1.2*u, 0.8*u, 0, 7); g.fill();
    break; }
  case "block":{
    const bw=(10+r*6)*u, bh=(12+r*10)*u;
    g.fillStyle="#3a3f4c"; g.fillRect(x-bw/2, y-bh, bw, bh);
    g.fillStyle="#2c313c"; g.fillRect(x+bw*0.28, y-bh, bw*0.22, bh);
    if(u > 0.8){
      g.fillStyle="rgba(255,214,130,.55)";
      for(let wy=0; wy<4; wy++) for(let wx=0; wx<2; wx++){
        if(hsh(r*97 + wy*3.1 + wx) < 0.5) continue;
        g.fillRect(x-bw*0.34+wx*bw*0.3, y-bh+ (1.5+wy*2.6)*u, 1.1*u, 1.4*u);
      }
    }
    break; }
  case "panel":{
    const pw=(9+r*2)*u, ph2=(4.5+r)*u, py=y-(5+r*2)*u;
    g.strokeStyle="#8b8577"; g.lineWidth=Math.max(1, 0.9*u);
    g.beginPath(); g.moveTo(x-pw*0.32, y); g.lineTo(x-pw*0.32, py);
    g.moveTo(x+pw*0.32, y); g.lineTo(x+pw*0.32, py); g.stroke();
    g.fillStyle="#efe6d4"; g.fillRect(x-pw/2, py-ph2, pw, ph2);
    g.strokeStyle="#c8322c"; g.lineWidth=Math.max(1, 0.7*u);
    g.strokeRect(x-pw/2, py-ph2, pw, ph2);
    if(u > 1.1){
      g.fillStyle="#c8322c"; g.font=`900 ${Math.max(5, 2.6*u)}px var(--mono, monospace)`;
      g.textAlign="center"; g.textBaseline="middle";
      g.fillText("HEAT", x, py-ph2/2);
    }
    break; }
  case "tent":{
    const tw=(8+r*2)*u, th2=(4+r)*u;
    g.fillStyle="#efe9dd";
    g.fillRect(x-tw/2, y-th2, tw, th2);
    g.beginPath(); g.moveTo(x-tw*0.58, y-th2); g.lineTo(x, y-th2-tw*0.28);
    g.lineTo(x+tw*0.58, y-th2); g.closePath(); g.fill();
    g.fillStyle="#c9c2b2";
    g.beginPath(); g.moveTo(x, y-th2-tw*0.28); g.lineTo(x+tw*0.58, y-th2);
    g.lineTo(x+tw*0.5, y); g.lineTo(x+tw*0.1, y); g.closePath(); g.fill();
    g.fillStyle="#57506a"; g.fillRect(x-tw*0.14, y-th2*0.7, tw*0.28, th2*0.7);
    break; }
  }
}

/* ---------- sprites ---------- */
/* rel   = rival's heading relative to the camera (radians) — the nose and
           front wheels swing sideways with it, so cars visibly turn in
   brake = flare the brake lights on the wing endplates */
function drawRival(g, x, y, w, color, glow, rel, brake){
  const h = w*0.72;
  const k  = Math.max(-1, Math.min(1, Math.sin(rel||0)*1.6));
  const fx = k*w*0.40;                       // how far the nose swings
  g.save(); g.translate(x, y);
  g.fillStyle = "rgba(0,0,0,.4)";
  g.beginPath(); g.ellipse(fx*0.25, 0, w*0.62, w*0.10, 0, 0, 7); g.fill();
  /* front wheels — the far pair, shifted with the steer */
  g.fillStyle = "#1d1a22";
  rr(g, -w*0.50 + fx, -h*0.88, w*0.17, h*0.32, w*0.05);
  rr(g,  w*0.33 + fx, -h*0.88, w*0.17, h*0.32, w*0.05);
  /* rear wheels — planted */
  g.fillStyle = "#141117";
  rr(g, -w*0.60, -h*0.62, w*0.24, h*0.62, w*0.06);
  rr(g,  w*0.36, -h*0.62, w*0.24, h*0.62, w*0.06);
  g.fillStyle = "#2e2a33";
  rr(g, -w*0.56, -h*0.56, w*0.16, h*0.16, w*0.04);
  rr(g,  w*0.40, -h*0.56, w*0.16, h*0.16, w*0.04);
  /* body: rear track fixed, nose follows the steer */
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(-w*0.34, 0);
  g.lineTo(-w*0.28 + fx*0.85, -h*0.52);
  g.lineTo( w*0.28 + fx*0.85, -h*0.52);
  g.lineTo( w*0.34, 0); g.closePath(); g.fill();
  g.fillStyle = shade(color, -25);
  rr(g, -w*0.42, -h*0.78, w*0.84, h*0.14, w*0.03);
  g.fillStyle = "#1a1620";
  rr(g, -w*0.05 + fx*0.30, -h*0.70, w*0.10, h*0.20, w*0.02);
  g.fillStyle = "#e8e2d2";
  g.beginPath(); g.arc(fx*0.30, -h*0.56, w*0.11, 0, 7); g.fill();
  if(glow > 0.02){
    g.fillStyle = `rgba(255,140,60,${Math.min(.75, glow)})`;
    g.beginPath(); g.ellipse(-w*0.16, -h*0.06, w*0.05, w*0.03, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse( w*0.16, -h*0.06, w*0.05, w*0.03, 0, 0, 7); g.fill();
  }
  if(brake){
    const bl = g.createRadialGradient(0, -h*0.72, w*0.03, 0, -h*0.72, w*0.55);
    bl.addColorStop(0, "rgba(255,60,40,.28)"); bl.addColorStop(1, "rgba(255,60,40,0)");
    g.fillStyle = bl; g.fillRect(-w*0.62, -h*1.05, w*1.24, h*0.75);
    g.fillStyle = "rgba(255,64,44,.95)";
    g.beginPath(); g.ellipse(-w*0.34, -h*0.72, w*0.055, w*0.038, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse( w*0.34, -h*0.72, w*0.055, w*0.038, 0, 0, 7); g.fill();
  }
  g.restore();
}
function rr(g, x, y, w, h, r){
  g.beginPath();
  g.moveTo(x+r, y); g.arcTo(x+w, y, x+w, y+h, r); g.arcTo(x+w, y+h, x, y+h, r);
  g.arcTo(x, y+h, x, y, r); g.arcTo(x, y, x+w, y, r); g.closePath(); g.fill();
}
function shade(hex, amt){
  const m = /^#?([0-9a-f]{6})$/i.exec(hex||""); if(!m) return hex;
  const n = parseInt(m[1],16);
  const c = v => Math.max(0, Math.min(255, v+amt));
  return "#"+((c(n>>16)<<16)|(c((n>>8)&255)<<8)|c(n&255)).toString(16).padStart(6,"0");
}
function drawHood(g, p, steer){
  const w = Math.min(W*0.42, 340), h = w*0.62;
  const cx = W/2 + steer*W*0.02, by = H + h*0.06;
  const color = (p && p.color) || THEME.purple;
  const num = ((p && p.name) || "").match(/\d+/);
  g.save(); g.translate(cx, by); g.rotate(steer*0.02);
  g.strokeStyle = "#9aa0a8"; g.lineWidth = Math.max(3, w*0.02); g.lineCap="round";
  g.beginPath(); g.moveTo(-w*0.42,-h*0.52); g.lineTo(-w*0.85,-h*0.70); g.stroke();
  g.beginPath(); g.moveTo(-w*0.42,-h*0.40); g.lineTo(-w*0.85,-h*0.52); g.stroke();
  g.beginPath(); g.moveTo( w*0.42,-h*0.52); g.lineTo( w*0.85,-h*0.70); g.stroke();
  g.beginPath(); g.moveTo( w*0.42,-h*0.40); g.lineTo( w*0.85,-h*0.52); g.stroke();
  g.fillStyle = "#131017";
  rr(g, -w*1.06, -h*0.95, w*0.26, h*0.95, w*0.05);
  rr(g,  w*0.80, -h*0.95, w*0.26, h*0.95, w*0.05);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(-w*0.50, 0); g.quadraticCurveTo(-w*0.46, -h*0.85, -w*0.16, -h);
  g.lineTo(w*0.16, -h); g.quadraticCurveTo(w*0.46, -h*0.85, w*0.50, 0);
  g.closePath(); g.fill();
  g.strokeStyle = shade(color,-40); g.lineWidth = 2; g.stroke();
  g.fillStyle = "#efe9dd";
  g.beginPath();
  g.moveTo(-w*0.075, 0); g.lineTo(-w*0.06, -h); g.lineTo(w*0.06, -h); g.lineTo(w*0.075, 0);
  g.closePath(); g.fill();
  if(num){
    g.fillStyle="#efe9dd"; g.beginPath(); g.arc(0,-h*0.30, w*0.13, 0, 7); g.fill();
    g.fillStyle="#151218";
    g.font = `800 ${Math.round(w*0.15)}px var(--mono, monospace)`;
    g.textAlign="center"; g.textBaseline="middle";
    g.fillText(num[0], 0, -h*0.29);
  }
  g.restore();
}

/* steering wheel + gloved hands in the foreground, turning with the steer.
   The wheel centre sits below the screen edge so only the upper rim, the
   hands and the boss are in shot — framing without stealing road. */
function drawWheel(g, steer, p){
  const R  = Math.min(W*0.26, 170);
  const cx = W/2, cy = H + R*0.52;
  const rot = Math.max(-1.1, Math.min(1.1, steer*0.5));
  const color = (p && p.color) || THEME.purple;
  g.save(); g.translate(cx, cy); g.rotate(rot);
  /* rim — dark torus with a soft top highlight */
  g.lineCap = "round";
  g.strokeStyle = "#141118"; g.lineWidth = R*0.17;
  g.beginPath(); g.arc(0, 0, R, 0, 7); g.stroke();
  g.strokeStyle = "rgba(255,255,255,.10)"; g.lineWidth = R*0.05;
  g.beginPath(); g.arc(0, 0, R*1.04, Math.PI*1.15, Math.PI*1.85); g.stroke();
  /* spokes: 9 o'clock, 3 o'clock, straight down */
  g.strokeStyle = "#2a2531"; g.lineWidth = R*0.10;
  for(const a of [Math.PI, 0, Math.PI/2]){
    g.beginPath(); g.moveTo(Math.cos(a)*R*0.20, Math.sin(a)*R*0.20);
    g.lineTo(Math.cos(a)*R*0.92, Math.sin(a)*R*0.92); g.stroke();
  }
  /* boss with the car number */
  g.fillStyle = "#1c1822"; g.beginPath(); g.arc(0, 0, R*0.24, 0, 7); g.fill();
  g.strokeStyle = shade(color, -20); g.lineWidth = Math.max(1.5, R*0.03);
  g.beginPath(); g.arc(0, 0, R*0.24, 0, 7); g.stroke();
  const num = ((p && p.name) || "").match(/\d+/);
  if(num){
    g.fillStyle = "#efe9dd";
    g.font = `800 ${Math.round(R*0.20)}px var(--mono, monospace)`;
    g.textAlign="center"; g.textBaseline="middle";
    g.fillText(num[0], 0, R*0.01);
  }
  /* gloved hands at 9 & 3 — cuffs in the car colour */
  for(const side of [-1, 1]){
    const hx = side*R, hy = 0;
    g.fillStyle = "#221d26";
    g.beginPath(); g.ellipse(hx, hy, R*0.155, R*0.20, side*0.25, 0, 7); g.fill();
    g.fillStyle = "#2e2833";                      // thumb over the rim
    g.beginPath(); g.ellipse(hx - side*R*0.09, hy - R*0.10, R*0.06, R*0.09, side*0.5, 0, 7); g.fill();
    g.fillStyle = color;                          // cuff
    g.beginPath(); g.ellipse(hx + side*R*0.13, hy + R*0.13, R*0.075, R*0.10, side*0.35, 0, 7); g.fill();
  }
  g.restore();
}

/* ---------- one rendered frame ---------- */
function render(dt){
  const p = safeHuman(); if(!p || !p._v) return;
  const v = p._v, cam = FP.cam, now = performance.now();

  cam.total = v.total; cam.off += (v.off - cam.off)*Math.min(1, dt*8);
  const here = lerpPose(cam.total); if(!here) return;
  const look = lerpPose(cam.total + 1.4) || here;
  const targHead = Math.atan2(look.ty + here.ty, look.tx + here.tx);
  if(cam.head == null) cam.head = targHead;
  else cam.head += shortTurn(cam.head, targHead)*Math.min(1, dt*6);

  const spd = Math.max(0, (v.total - (cam._pt==null?v.total:cam._pt)) / Math.max(dt, 1e-4));
  cam._pt = v.total;
  cam.spd += (spd - cam.spd)*Math.min(1, dt*5);
  const idle = FP.hold && cam.spd < 0.3;
  cam.bob = idle ? Math.sin(now/38)*0.7
                 : Math.sin(now/90) * Math.min(3, cam.spd*0.5);

  const spin = v.spin || 0;
  cam.roll += ((spin>0 ? Math.sin(spin/57)*0.35 : 0) - cam.roll)*Math.min(1, dt*6);
  cam.shake = Math.max(0, cam.shake - dt*1.6);

  cam.x = here.x - here.tx*2 + here.nx*cam.off*0.85;
  cam.y = here.y - here.ty*2 + here.ny*cam.off*0.85;

  /* elevation: camera rides the road; gentle pitch into climbs & crests */
  cam.elev = elevAt(cam.total);
  const elevAhead = elevAt(cam.total + 2.2);
  const targPitch = Math.max(-10, Math.min(10, (cam.elev - elevAhead) * 1.1));
  cam.pitch = (cam.pitch==null) ? targPitch
            : cam.pitch + (targPitch - cam.pitch)*Math.min(1, dt*5);

  if(FP._lastTot != null && p.total > FP._lastTot){
    const d = p.total - FP._lastTot;
    if(FP.phase === "slip")       stamp(`SLIPSTREAM +${d}`, "#5fd8d0", "free tow — corner lines still count");
    else if(FP.phase === "react") stamp(`+${d} SPEED`, "#8fe08a");
    FP._lastTot = p.total;
  }else if(FP._lastTot != null && p.total < FP._lastTot){
    FP._lastTot = p.total;
  }else if(FP._lastTot == null){ FP._lastTot = p.total; }

  const P = makeProjector(cam);
  const FT = featCache();
  const WX = weatherFlags();
  const camSp = phys(Math.floor(cam.total));
  const inWSec = FT.wSector.has(camSp);

  /* landing highlights, keyed by total (they're race-long totals already) */
  const LAND = new Map();
  for(const it of FP._land) LAND.set(it.total, it.kind);

  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,W,H);
  ctx.save();
  if(cam.shake > 0.01){
    ctx.translate((Math.random()-.5)*cam.shake*9, (Math.random()-.5)*cam.shake*9);
  }
  if(cam.roll){ ctx.translate(W/2,H/2); ctx.rotate(cam.roll); ctx.translate(-W/2,-H/2); }

  /* ----- sky (themed by TRACK.terrain) ----- */
  const TT = fpTerrain();
  const sky = ctx.createLinearGradient(0,0,0,P.horizon);
  sky.addColorStop(0, TT.sky[0]); sky.addColorStop(.72, TT.sky[1]); sky.addColorStop(1, TT.sky[2]);
  ctx.fillStyle = sky; ctx.fillRect(0,0,W,P.horizon+1);
  const sunX = W/2 - cam.head*140 % W;
  const sun = ctx.createRadialGradient(sunX, P.horizon-8, 2, sunX, P.horizon-8, 70);
  sun.addColorStop(0,`rgba(${TT.sun},.9)`); sun.addColorStop(1,`rgba(${TT.sun},0)`);
  ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(sunX, P.horizon-8, 70, 0, 7); ctx.fill();
  drawSilhouette(P.horizon, TT);

  /* ----- ground (themed: grass, sand, snow, asphalt…) -----
     base fill fades to the horizon haze; the row loop then lays fogged
     terrain strips over it at each depth so hills read on the land too */
  const FOGH = TT.sky[2];
  const gnd = ctx.createLinearGradient(0,P.horizon,0,H);
  gnd.addColorStop(0, mixHex(TT.ground[0], FOGH, FOG_MAX));
  gnd.addColorStop(1, TT.ground[1]);
  ctx.fillStyle = gnd; ctx.fillRect(0, P.horizon, W, H-P.horizon);

  /* ----- road samples (now with elevation) ----- */
  const rows = [];
  for(let d=0.30; d<=VIEW_SPACES; d+=STEP){
    const q = lerpPose(cam.total + d); if(!q) break;
    const hz = elevAt(cam.total + d);
    const L  = P.proj(q.x - q.nx*ROAD_HW,                   q.y - q.ny*ROAD_HW,                   hz);
    const R  = P.proj(q.x + q.nx*ROAD_HW,                   q.y + q.ny*ROAD_HW,                   hz);
    const Lk = P.proj(q.x - q.nx*(ROAD_HW+KERB_W),          q.y - q.ny*(ROAD_HW+KERB_W),          hz);
    const Rk = P.proj(q.x + q.nx*(ROAD_HW+KERB_W),          q.y + q.ny*(ROAD_HW+KERB_W),          hz);
    const Lg = P.proj(q.x - q.nx*(ROAD_HW+KERB_W+GRAVEL_W), q.y - q.ny*(ROAD_HW+KERB_W+GRAVEL_W), hz);
    const Rg = P.proj(q.x + q.nx*(ROAD_HW+KERB_W+GRAVEL_W), q.y + q.ny*(ROAD_HW+KERB_W+GRAVEL_W), hz);
    rows.push({ d, sp: cam.total + d, hz, L, R, Lk, Rk, Lg, Rg });
  }

  /* crest occlusion: walking near→far, anything projecting BELOW the
     lowest ridge line seen so far is hidden behind a brow */
  let ridgeY = H + 2;
  for(const r of rows){
    r.clip = ridgeY;                     // clip level set by NEARER rows
    if(!r.L || !r.R){ r.vis = false; continue; }
    const topY = Math.min(r.L.y, r.R.y);
    r.vis = topY < ridgeY;
    ridgeY = Math.min(ridgeY, topY);
  }
  const clipAt = d => {
    const i = Math.max(0, Math.min(rows.length-1, Math.round((d-0.30)/STEP)));
    return rows[i] ? rows[i].clip : H+2;
  };
  /* draw fn with everything below the crest line at distance d cut away */
  const withClip = (d, fn) => {
    const cy = clipAt(d);
    if(cy > H){ fn(); return; }
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, cy); ctx.clip();
    fn();
    ctx.restore();
  };

  /* skid build-up on the braking zone before each corner: space → intensity */
  const SKID = new Map();
  for(const c of cornersAhead(cam.total - 1, VIEW_SPACES + 4)){
    const ci = Math.floor(c);
    for(let k=1; k<=4; k++)
      SKID.set(ci-k, Math.max(SKID.get(ci-k)||0, (5-k)/5));
  }
  /* point at lateral fraction f (−0.5 left edge … +0.5 right edge) of a row */
  const spanPt = (r, f) => ({ x: r.L.x + (r.R.x - r.L.x)*(0.5 + f),
                              y: r.L.y + (r.R.y - r.L.y)*(0.5 + f) });

  for(let i=rows.length-2; i>=0; i--){
    const a = rows[i], b = rows[i+1];
    if(!a.L || !a.R || !b.L || !b.R) continue;
    if(!a.vis && !b.vis) continue;                 // fully behind a crest
    const spIdx = Math.floor(a.sp), spPhys = phys(spIdx);
    const stripe = Math.floor(a.sp*2) % 2 === 0;
    const fogT = fogAt(a.d);

    /* terrain strip at this depth — makes the hills read on the land */
    const gTop = Math.min(a.L.y, a.R.y, b.L.y, b.R.y);
    const gBot = Math.max(a.L.y, a.R.y);
    if(gBot > gTop){
      const depthT = Math.min(1, a.d / VIEW_SPACES);
      ctx.fillStyle = mixHex(mixHex(TT.ground[1], TT.ground[0], depthT), FOGH, fogT);
      ctx.fillRect(0, gTop, W, gBot - gTop + 1);
    }
    ctx.fillStyle = stripe ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.05)";
    ctx.fillRect(0, gTop, W, Math.max(1, gBot - gTop + 1));
    if(FT.gravelIn.has(spPhys)  && a.Lg && b.Lg && a.Lk && b.Lk){
      ctx.fillStyle = mixHex(stripe ? "#a8895c" : "#b29668", FOGH, fogT);
      quad(ctx, a.Lg, a.Lk, b.Lk, b.Lg);
    }
    if(FT.gravelOut.has(spPhys) && a.Rg && b.Rg && a.Rk && b.Rk){
      ctx.fillStyle = mixHex(stripe ? "#a8895c" : "#b29668", FOGH, fogT);
      quad(ctx, a.Rk, a.Rg, b.Rg, b.Rk);
    }
    if(a.Lk && b.Lk){ ctx.fillStyle = mixHex(stripe ? "#c8322c" : "#efe6d4", FOGH, fogT);
                      quad(ctx, a.Lk, a.L, b.L, b.Lk); }
    if(a.Rk && b.Rk){ ctx.fillStyle = mixHex(stripe ? "#c8322c" : "#efe6d4", FOGH, fogT);
                      quad(ctx, a.R, a.Rk, b.Rk, b.R); }
    ctx.fillStyle = mixHex((spIdx % 2 === 0) ? "#3b3542" : "#37313d", FOGH, fogT);
    quad(ctx, a.L, a.R, b.R, b.L);

    /* specular sheen riding the racing line */
    ctx.fillStyle = "rgba(255,255,255,.028)";
    quad(ctx, spanPt(a,-0.15), spanPt(a,0.15), spanPt(b,0.15), spanPt(b,-0.15));
    /* darkened tyre arcs building into the braking zone */
    const sk = SKID.get(spIdx);
    if(sk){
      const wob = Math.sin(a.sp*2.1)*0.05;
      ctx.fillStyle = `rgba(10,8,12,${(0.16*sk*(1-fogT)).toFixed(3)})`;
      for(const off of [-0.27, -0.17, 0.17, 0.27]){
        quad(ctx, spanPt(a, off+wob-0.016), spanPt(a, off+wob+0.016),
                  spanPt(b, off+wob+0.016), spanPt(b, off+wob-0.016));
      }
    }
    /* speckle grain on the near tarmac — keyed to sp so it scrolls with the road */
    if(a.d < 5){
      ctx.fillStyle = `rgba(0,0,0,${(0.16*(1 - a.d/5)).toFixed(3)})`;
      const seed = Math.floor(a.sp*7);
      for(let j=0; j<3; j++){
        const q1 = spanPt(a, (hsh(seed*3.7 + j*11.3) - 0.5)*0.86);
        ctx.fillRect(q1.x, q1.y, 1.6, 1.1);
      }
    }
    if(FT.wSector.has(spPhys)){
      ctx.fillStyle = wSectorTint(WX);
      quad(ctx, a.L, a.R, b.R, b.L);
    }
    /* Phase 3: landing preview bands glowing on the tarmac */
    const hl = LAND.get(spIdx);
    if(hl){
      const pulse = 0.65 + 0.35*Math.sin(now/220);
      ctx.fillStyle = hl === "exact"
        ? `rgba(169,133,255,${0.38*pulse})`
        : `rgba(216,194,58,${0.22*pulse})`;
      quad(ctx, a.L, a.R, b.R, b.L);
    }
    if((a.sp % 1) < 0.42){
      const cwA = (a.R.x - a.L.x)*0.012, cwB = (b.R.x - b.L.x)*0.012;
      ctx.fillStyle = "rgba(240,231,211," + (0.5*(1-fogT)).toFixed(3) + ")";
      quad(ctx, {x:(a.L.x+a.R.x)/2-cwA, y:(a.L.y+a.R.y)/2},
                 {x:(a.L.x+a.R.x)/2+cwA, y:(a.L.y+a.R.y)/2},
                 {x:(b.L.x+b.R.x)/2+cwB, y:(b.L.y+b.R.y)/2},
                 {x:(b.L.x+b.R.x)/2-cwB, y:(b.L.y+b.R.y)/2});
    }
  }

  /* ----- trackside props (world-space scenery, sorted far→near) ----- */
  const PB = propCache().bySp;
  if(PB && PB.size){
    const plist = [];
    for(let k=1; k<=VIEW_SPACES; k++){
      const spIdx = Math.floor(cam.total) + k;
      const arr = PB.get(((phys(spIdx))%S+S)%S); if(!arr) continue;
      for(const pp of arr){
        const tot = spIdx + pp.frac;
        const q = lerpPose(tot); if(!q) continue;
        const lat = pp.side * (ROAD_HW + KERB_W + GRAVEL_W + pp.lat);
        const pr = P.proj(q.x + q.nx*lat, q.y + q.ny*lat, elevAt(tot));
        if(!pr) continue;
        plist.push({ pr, pp, d: tot - cam.total });
      }
    }
    plist.sort((a,b)=> b.pr.z - a.pr.z);
    for(const it of plist){
      const u = it.pr.s * it.pp.sc;
      if(u*8 < 2 || u*8 > H) continue;              // too small / absurdly close
      withClip(it.d, ()=>{
        ctx.save();
        ctx.globalAlpha *= Math.max(0, 1 - fogAt(it.d)*0.85);
        drawProp(ctx, it.pp.kind, it.pr.x, it.pr.y, u, it.pp.r);
        ctx.restore();
      });
    }
  }

  /* ----- billboards ----- */
  const bills = [];
  for(const c of cornersAhead(cam.total, VIEW_SPACES)){
    const idx = (typeof cornerIdxOf === "function") ? cornerIdxOf(c) : -1;
    let lim = "?";
    try{ lim = (typeof limitAt === "function") ? limitAt(c) + (p.limitAdj||0)
             : (idx>=0 ? limitOfCorner(idx) : "?"); }catch(_){}
    bills.push({ tot:c, kind:"corner", lim });
  }
  for(const f of flagsAhead(cam.total, VIEW_SPACES)) bills.push({ tot:f, kind:"flag" });
  bills.sort((a,b)=>b.tot-a.tot);

  for(const b of bills){
    const q = lerpPose(b.tot); if(!q) continue;
    const hzB = elevAt(b.tot);
    const L = P.proj(q.x - q.nx*ROAD_HW, q.y - q.ny*ROAD_HW, hzB);
    const R = P.proj(q.x + q.nx*ROAD_HW, q.y + q.ny*ROAD_HW, hzB);
    if(!L || !R) continue;
    const dB = b.tot - cam.total;
    withClip(dB, ()=>{
    ctx.save();
    ctx.globalAlpha *= Math.max(0.05, 1 - fogAt(dB)*0.85);
    if(b.kind === "corner"){
      const hot = (p.speed||0) > b.lim;
      ctx.strokeStyle = hot ? "rgba(228,87,61,.9)" : "rgba(255,209,102,.85)";
      ctx.lineWidth = Math.max(1.5, L.s*1.4);
      ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.lineTo(R.x, R.y); ctx.stroke();
      const B = P.proj(q.x + q.nx*(ROAD_HW+10), q.y + q.ny*(ROAD_HW+10), hzB);
      if(B){
        const s = B.s, bw = 14*s, bh = 14*s, ph = 22*s;
        ctx.strokeStyle="#8b8577"; ctx.lineWidth=Math.max(1, 1.6*s);
        ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.lineTo(B.x, B.y-ph); ctx.stroke();
        ctx.fillStyle="#efe6d4"; rr(ctx, B.x-bw/2, B.y-ph-bh, bw, bh, 2.5*s);
        ctx.strokeStyle = hot ? THEME.heat : "#c8322c"; ctx.lineWidth=Math.max(1,2*s);
        ctx.strokeRect(B.x-bw/2+1.5*s, B.y-ph-bh+1.5*s, bw-3*s, bh-3*s);
        ctx.fillStyle="#151218"; ctx.font=`800 ${Math.max(6, 9*s)}px var(--mono, monospace)`;
        ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText(String(b.lim), B.x, B.y-ph-bh/2);
      }
    }else{
      const n=8;
      for(let k=0;k<n;k++){
        ctx.fillStyle = k%2 ? "#efe6d4" : "#151218";
        const x0=L.x+(R.x-L.x)*k/n, x1=L.x+(R.x-L.x)*(k+1)/n;
        const y0=L.y+(R.y-L.y)*k/n, y1=L.y+(R.y-L.y)*(k+1)/n;
        quad(ctx, {x:x0,y:y0-L.s*1.5},{x:x1,y:y1-L.s*1.5},{x:x1,y:y1+L.s*1.5},{x:x0,y:y0+L.s*1.5});
      }
      const gh = 34*L.s;
      ctx.strokeStyle="#8b8577"; ctx.lineWidth=Math.max(1,2*L.s);
      ctx.beginPath(); ctx.moveTo(L.x,L.y); ctx.lineTo(L.x,L.y-gh);
      ctx.lineTo(R.x,R.y-gh); ctx.lineTo(R.x,R.y); ctx.stroke();
      ctx.fillStyle=THEME.deep; rr(ctx, L.x, L.y-gh, (R.x-L.x), 8*L.s, 2*L.s);
      ctx.fillStyle=THEME.cream; ctx.font=`800 ${Math.max(6,6.5*L.s)}px var(--mono, monospace)`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText("HEAT", (L.x+R.x)/2, L.y-gh+4*L.s);
    }
    ctx.restore();
    });
  }

  /* ----- opponents ----- */
  const others = (G.players||[])
    .filter(o => o !== p && !(o.finished && o._v && o._v.blend >= 1))
    .map(o => {
      const oT = o._v ? o._v.total : o.total;
      const oO = o._v ? o._v.off   : spotOffOf(o.spot);
      const pos = carPose(oT, oO);
      const pr = P.proj(pos.x, pos.y, elevAt(oT));
      return pr ? { o, pr, d: oT - cam.total } : null;
    })
    .filter(Boolean)
    .sort((a,b) => b.pr.z - a.pr.z);
  for(const {o, pr, d} of others){
    const w = CAR_W * pr.s;
    if(w < 1.2 || w > W) continue;
    const oT = o._v ? o._v.total : o.total;
    /* heading relative to the camera → the sprite steers */
    const oq  = lerpPose(oT);
    const rel = oq ? shortTurn(cam.head, Math.atan2(oq.ty, oq.tx)) : 0;
    let glow = 0, brake = false;
    if(o._v){
      const sNow = Math.abs(o._v.total - (o._v._fp==null ? o._v.total : o._v._fp)) / Math.max(dt,1e-4);
      glow = Math.min(.7, sNow * 0.12);
      o._v._fp = o._v.total;
      /* brake lights: hard decel vs their smoothed speed, held ~450ms */
      const sAvg = (o._v._fpS == null) ? sNow : o._v._fpS;
      if(sAvg - sNow > 1.1 && sAvg > 0.8) o._v._fpB = now;
      o._v._fpS = sAvg + (sNow - sAvg)*Math.min(1, dt*6);
      brake = (now - (o._v._fpB||0)) < 450;
      /* dust when running through a gravel-pocket space */
      const oSp = phys(Math.floor(oT));
      if(sNow > 0.5 && (FT.gravelIn.has(oSp) || FT.gravelOut.has(oSp)) &&
         Math.random() < 0.45 && FP.parts.length < 90){
        FP.parts.push({ x: pr.x + (Math.random()-.5)*w*0.7, y: pr.y,
                        vx:(Math.random()-.5)*46, vy:-(8 + Math.random()*34),
                        r: Math.max(2, w*0.10 + Math.random()*w*0.10),
                        life:.8, col:"rgba(178,150,105," });
      }
    }
    withClip(Math.max(0.31, d), ()=>{
      ctx.save();
      ctx.globalAlpha *= Math.max(0.05, 1 - fogAt(Math.max(0, d))*0.8);
      drawRival(ctx, pr.x, pr.y, w, o.color || "#888", glow, rel, brake);
      ctx.restore();
    });
  }

  /* ----- slipstream tow-lines ----- */
  if(FP.phase === "slip" && cam.spd > 0.4){
    ctx.strokeStyle = "rgba(95,216,208,.5)"; ctx.lineWidth = 2;
    for(let k=0;k<10;k++){
      const t = ((k*0.1 + now/600) % 1);
      const yy = P.horizon + (H-P.horizon)*(0.05+0.9*t);
      const xx = (k%2 ? 1 : -1)*(W*0.46)*(1-t);
      ctx.beginPath(); ctx.moveTo(W/2+xx, yy); ctx.lineTo(W/2+xx*0.55, yy - (H-P.horizon)*0.10); ctx.stroke();
    }
  }

  /* ----- tunnel ----- */
  if(typeof inTunnelSpace === "function" && inTunnelSpace(camSp)){
    ctx.fillStyle = "rgba(8,6,12,.55)"; ctx.fillRect(0,0,W,P.horizon);
    ctx.fillStyle = "rgba(8,6,12,.30)"; ctx.fillRect(0,P.horizon,W,H-P.horizon);
    for(let k=1;k<6;k++){
      const t = ((cam.total*2 + k*1.2) % 6)/6;
      const y = P.horizon*(0.15 + 0.6*t*t);
      ctx.fillStyle = `rgba(255,224,150,${.5*(1-t)})`;
      ctx.fillRect(W*0.3, y, W*0.4, Math.max(1, 3*t));
    }
  }

  if(inWSec) drawWeatherFX(WX, P, dt, now);

  /* ----- speed streaks ----- */
  const streak = Math.min(1, cam.spd/9);
  if(streak > .15){
    ctx.strokeStyle = `rgba(240,231,211,${streak*.20})`;
    for(let k=0;k<8;k++){
      const y = P.horizon + (H-P.horizon)*(0.12 + 0.8*((k*0.137 + cam.total*0.7) % 1));
      const l = 30 + 90*streak;
      ctx.lineWidth = 1 + streak;
      ctx.beginPath(); ctx.moveTo(W*0.06, y); ctx.lineTo(W*0.06+l, y+2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W*0.94, y); ctx.lineTo(W*0.94-l, y+2); ctx.stroke();
    }
  }

  /* ----- particles ----- */
  for(let i=FP.parts.length-1; i>=0; i--){
    const q = FP.parts[i];
    q.x += q.vx*dt; q.y += q.vy*dt; q.vy += 24*dt; q.life -= dt*0.9;
    if(q.life <= 0){ FP.parts.splice(i,1); continue; }
    ctx.fillStyle = q.col + (q.life*0.5) + ")";
    ctx.beginPath(); ctx.arc(q.x, q.y, q.r*(1.6-q.life*0.6), 0, 7); ctx.fill();
  }

  /* ----- heat shimmer: the emptier the Engine, the wavier the air ----- */
  let heatCap = 6;
  try{ if(typeof heatCapFor === "function") heatCap = heatCapFor(p); }catch(_){}
  heatCap = Math.max(1, heatCap, p.engine|0);
  const hot  = Math.max(0, 1 - (p.engine|0)/heatCap);     // 0 = cool, 1 = spent
  const shim = Math.max(0, (hot - 0.35)/0.65);            // kicks in past ~1/3 spent
  if(shim > 0.02){
    const bandTop = Math.round(H*0.50), bandBot = Math.round(H*0.80), strip = 3;
    ctx.save();
    ctx.setTransform(DPR,0,0,DPR,0,0);                    // strips must not inherit shake/roll
    for(let y=bandTop; y<bandBot; y+=strip){
      const tW  = (y-bandTop)/(bandBot-bandTop);
      const amp = shim * (1.2 + 3.4*tW);                  // stronger nearer the hood
      const dx  = Math.sin(y*0.11 + now/85) * amp;
      ctx.drawImage(cv, 0, Math.round(y*DPR), cv.width, Math.max(1, Math.round(strip*DPR)),
                        dx, y, W, strip);
    }
    ctx.restore();
    const vg = ctx.createRadialGradient(W/2, H*0.55, H*0.20, W/2, H*0.55, H*0.78);
    vg.addColorStop(0, "rgba(228,87,61,0)");
    vg.addColorStop(1, `rgba(228,87,61,${(0.16*shim).toFixed(3)})`);
    ctx.fillStyle = vg; ctx.fillRect(0,0,W,H);
  }

  /* ----- hood + wheel + spin flash ----- */
  const steer = shortTurn(cam.head, targHead)*8;
  drawHood(ctx, p, steer);
  drawWheel(ctx, steer, p);
  if(spin > 40){
    ctx.fillStyle = `rgba(200,50,44,${Math.min(.30, spin/900)})`;
    ctx.fillRect(0,0,W,H);
  }

  /* ----- event FX ----- */
  for(let i=FP.fx.length-1; i>=0; i--){
    const e = FP.fx[i], t = (now - e.t0)/e.dur;
    if(t >= 1){ FP.fx.splice(i,1); continue; }
    if(e.kind === "flare"){
      const a = e.a * Math.sin(Math.min(1,t)*Math.PI);
      const vg = ctx.createRadialGradient(W/2,H/2, H*0.25, W/2,H/2, H*0.72);
      vg.addColorStop(0,"rgba(228,87,61,0)");
      vg.addColorStop(1,`rgba(228,87,61,${a})`);
      ctx.fillStyle = vg; ctx.fillRect(0,0,W,H);
    }
  }
  const stamps = FP.fx.filter(e=>e.kind==="stamp");
  stamps.forEach((e, k)=>{
    const t = (now - e.t0)/e.dur;
    const pop = t<0.15 ? (t/0.15) : 1;
    const scl = 0.6 + 0.4*(pop<1 ? 1-Math.pow(1-pop,3) : 1);
    const alpha = t>0.7 ? (1-t)/0.3 : 1;
    const y = H*0.26 + k*Math.min(46, H*0.09);
    ctx.save(); ctx.translate(W/2, y); ctx.scale(scl, scl); ctx.globalAlpha = alpha;
    ctx.font = `italic 900 ${Math.min(34, W*0.06)}px var(--mono, monospace)`;
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.lineWidth = 5; ctx.strokeStyle = "rgba(13,10,19,.85)";
    ctx.strokeText(e.text, 0, 0);
    ctx.fillStyle = e.color; ctx.fillText(e.text, 0, 0);
    if(e.sub){
      ctx.font = `700 ${Math.min(11, W*0.02)}px var(--mono, monospace)`;
      ctx.fillStyle = THEME.dim;
      ctx.fillText(e.sub, 0, Math.min(24, W*0.045));
    }
    ctx.restore();
  });
  ctx.restore();

  drawHUD(p, v);
  drawMinimap(p, LAND);
}

function wSectorTint(WX){
  const d = WX.d;
  if(d.aqua || WX.key==="light_rain" || d.storm) return "rgba(90,130,190,.16)";
  if(WX.key==="cold")   return "rgba(190,215,235,.10)";
  if(d.noCool)          return "rgba(255,140,60,.10)";
  if(d.noSlip)          return "rgba(200,200,215,.12)";
  if(d.lowSun)          return "rgba(255,214,150,.10)";
  return "rgba(140,150,200,.07)";
}
let RAIN = [];
function drawWeatherFX(WX, P, dt, now){
  const d = WX.d;
  const heavy = !!(d.aqua || d.storm);
  const rainy = heavy || WX.key === "light_rain";
  if(rainy){
    const want = heavy ? 90 : 40;
    while(RAIN.length < want) RAIN.push({x:Math.random()*W, y:Math.random()*H, l:8+Math.random()*14, s:260+Math.random()*260});
    ctx.strokeStyle = "rgba(170,200,240,.45)"; ctx.lineWidth = 1;
    for(const r of RAIN){
      r.y += r.s*dt; r.x -= r.s*dt*0.18;
      if(r.y > H){ r.y = -10; r.x = Math.random()*W; }
      ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + r.l*0.2, r.y + r.l); ctx.stroke();
    }
    if(heavy){ ctx.fillStyle="rgba(40,55,90,.14)"; ctx.fillRect(0,0,W,H); }
  }else RAIN.length = 0;
  if(d.noSlip){
    const fog = ctx.createLinearGradient(0,P.horizon-40,0,H);
    fog.addColorStop(0,"rgba(205,205,220,.42)"); fog.addColorStop(1,"rgba(205,205,220,.10)");
    ctx.fillStyle = fog; ctx.fillRect(0,0,W,H);
  }
  if(d.noCool){
    ctx.fillStyle = "rgba(255,140,60,.05)"; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = "rgba(255,170,90,.12)";
    for(let k=0;k<4;k++){
      const y = P.horizon + 8 + k*10 + Math.sin(now/160+k)*2;
      ctx.beginPath(); ctx.moveTo(W*0.2,y); ctx.quadraticCurveTo(W/2, y+4, W*0.8, y); ctx.stroke();
    }
  }
  if(d.wind || d.gust){
    ctx.strokeStyle = "rgba(220,230,240,.20)"; ctx.lineWidth = 1.5;
    for(let k=0;k<6;k++){
      const y = H*0.18 + ((k*0.17 + now/900) % 1)*H*0.5;
      const x = ((k*0.31 + now/700) % 1)*W;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x+40, y-4, x+90, y); ctx.stroke();
    }
  }
  if(d.lowSun){
    const g = ctx.createRadialGradient(W/2, P.horizon, 10, W/2, P.horizon, H*0.8);
    g.addColorStop(0,"rgba(255,230,170,.35)"); g.addColorStop(1,"rgba(255,230,170,0)");
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
  }
}

/* ----- driver HUD ----- */
function drawHUD(p, v){
  const mono = "var(--mono, monospace)";
  /* bottom-left cluster — hidden while the dashboard sheet is docked
     (the panel itself carries the engine bar and hints there) */
  if(!DOCKED){
    const bx = 10, bh = 58, by = H - bh - 10, bw = Math.min(190, W*0.4);
    ctx.save(); ctx.globalAlpha = .94;
    ctx.fillStyle = "rgba(13,10,19,.66)"; rr(ctx, bx, by, bw, bh, 10);
    ctx.strokeStyle = THEME.deep; ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, bw, bh);
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = THEME.dim; ctx.font = `700 8px ${mono}`; ctx.textAlign="left";
    ctx.fillText("SPD",  bx+12, by+16);
    ctx.fillText("GEAR", bx+62, by+16);
    ctx.fillText("ENGINE", bx+108, by+16);
    ctx.fillStyle = THEME.glow; ctx.font = `800 24px ${mono}`;
    ctx.fillText(String(p.speed||0), bx+12, by+42);
    ctx.fillStyle = THEME.cream;
    ctx.fillText(String(p.gear||1),  bx+62, by+42);
    let cap = 6;
    try{ if(typeof heatCapFor === "function") cap = heatCapFor(p); }catch(_){}
    cap = Math.max(cap, p.engine|0);
    const pw = Math.min(10, (bw-118-10)/Math.max(1,cap));
    for(let k=0;k<cap;k++){
      ctx.fillStyle = k < (p.engine|0) ? THEME.heat : "rgba(255,255,255,.12)";
      rr(ctx, bx+108+k*pw, by+26, pw-2, 16, 2);
    }
    ctx.restore();
  }

  /* next-corner plaque, top centre */
  let nxt = null;
  try{ for(const c of cornerTotals()){ if(c > v.total){ nxt = c; break; } } }catch(_){}
  if(nxt != null && (nxt - v.total) <= 24){
    let lim = effLimitAt(p, nxt); if(lim == null) lim = "?";
    const distSp = Math.max(0, Math.ceil(nxt - v.total));
    const hot = (p.speed||0) > lim;
    const txt = `CORNER in ${distSp} · LIMIT ${lim}`;
    ctx.save(); ctx.globalAlpha = .94;
    ctx.font = `800 11px ${mono}`;
    const tw = ctx.measureText(txt).width + 26;
    const px = W/2 - tw/2, py = 8;
    ctx.fillStyle = "rgba(13,10,19,.66)"; rr(ctx, px, py, tw, 22, 8);
    ctx.strokeStyle = hot ? THEME.heat : THEME.deep; ctx.lineWidth = 1.5;
    ctx.strokeRect(px, py, tw, 22);
    ctx.fillStyle = hot ? THEME.heat : THEME.cream;
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(txt, W/2, py+11);
    ctx.restore();
  }
}

function quad(g, a, b, c, d){
  g.beginPath(); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); g.lineTo(c.x,c.y); g.lineTo(d.x,d.y);
  g.closePath(); g.fill();
}

function drawMinimap(me, LAND){
  const Pw = TRACK && TRACK.spacePts; if(!Pw || !Pw.length) return;
  const mw = Math.min(150, W*0.30), mh = mw * (TRACK.imgH/TRACK.imgW);
  const mx = 10, my = 10, sc = mw / TRACK.imgW;
  ctx.save();
  ctx.globalAlpha = .92;
  ctx.fillStyle = "rgba(13,10,19,.66)";
  rr(ctx, mx-6, my-6, mw+12, mh+12, 8);
  ctx.strokeStyle = THEME.deep; ctx.lineWidth = 1.5;
  ctx.strokeRect(mx-6, my-6, mw+12, mh+12);
  ctx.beginPath();
  Pw.forEach((q,i)=> i ? ctx.lineTo(mx+q[0]*sc, my+q[1]*sc) : ctx.moveTo(mx+q[0]*sc, my+q[1]*sc));
  if(typeof LAYOUT==="undefined" || LAYOUT!=="open") ctx.closePath();
  ctx.strokeStyle = "#57506a"; ctx.lineWidth = 3; ctx.lineJoin="round"; ctx.stroke();
  /* landing preview rings */
  if(LAND && LAND.size){
    for(const [tot, kind] of LAND){
      const pos = carPose(tot, 0); if(!pos) continue;
      ctx.beginPath(); ctx.arc(mx+pos.x*sc, my+pos.y*sc, kind==="exact"?4:2.6, 0, 7);
      ctx.strokeStyle = kind==="exact" ? THEME.glow : THEME.stress;
      ctx.lineWidth = kind==="exact" ? 2 : 1.2; ctx.stroke();
    }
  }
  for(const o of (G.players||[])){
    if(!o._v && o.total==null) continue;
    const pos = carPose(o._v ? o._v.total : o.total, 0); if(!pos) continue;
    ctx.beginPath(); ctx.arc(mx+pos.x*sc, my+pos.y*sc, o===me?4:2.6, 0, 7);
    ctx.fillStyle = o.color || "#999"; ctx.fill();
    if(o===me){ ctx.strokeStyle = THEME.glow; ctx.lineWidth=1.6; ctx.stroke(); }
  }
  ctx.restore();
}

/* ---------- watcher loop ---------- */
function tick(now){
  requestAnimationFrame(tick);
  const dt = Math.min(.06, Math.max(0, (now - FP.lastT)/1000)); FP.lastT = now;

  const p = safeHuman();
  const replayOn = (typeof REPLAY !== "undefined") && REPLAY.active;

  const moving = p && p._v && !p.isBot &&
                 (Math.abs(p._v.total - p.total) > 0.02 || (p._v.spin||0) > 1);
  const wantUp = (moving || FP.hold) && p && !p.isBot && !p.finished &&
                 FP.enabled && !FP.snooze && !replayOn && !REDUCED;

  if(wantUp){
    if(p._v) resetCamIfFar(p);
    show();
    FP.linger = Math.max(FP.linger, now + (FP.hold ? 250 : LINGER_MS));
  }else if(FP.active && now > FP.linger){
    hide();
  }
  if(!moving && !FP.hold) FP.snooze = false;

  if(FP.active && p && p._v) render(dt || 1/60);
}
requestAnimationFrame(tick);

})();
