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
       windows, snowy peaks, savannah acacias, parkland trees… plus
       destination flavours: tuscany (cypress, olives, villas),
       street (downtown circuit), riviera (Monaco-style resort),
       medieval (castles & half-timbered town), miami (art-deco
       neon beachfront), ruins (Roman aqueduct & columns), japan
       (sakura, torii, pagodas, Mt Fuji), spain (sierra, windmills,
       whitewashed casas) and jungle.

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

   PHASE 7 (new) — VIEWS:
     · TRUE VIEW SWITCH — the ▦/● button and the V key now ALWAYS work,
       whenever there is a race on the board: the cockpit is a real,
       persistent view you can sit in (not just a motion overlay), so
       "Cockpit view ON" always means the windshield is actually up.
     · LIVE PiP BOARD — the canvas minimap is replaced by the REAL game
       board (the live SVG: photo art, highlights, tokens, cars, the
       lot) shrunk into a translucent picture-in-picture pane, top left.
       Tapping the PiP jumps back to the board view.
     · ZOOM TRANSITION — switching views is a camera move: leaving the
       cockpit, the PiP board grows until it fills the whole view and
       the windshield fades away beneath it; entering the cockpit, the
       full board minimises back down into the PiP corner while the
       windshield fades in underneath.
     · COCKPIT REPLAYS — the race replay can be watched from the
       driver's seat too. Toggle with the same ▦/● button or V at any
       point during the replay; the replay's own speed / skip HUD keeps
       working, and the PiP board shows the whole-field flow while the
       windshield shows your car's run.

   Controls / API:
       tap or click the view ....... dismiss cockpit for the current turn
                                     (during a replay: switch to board view)
       tap the PiP board ........... switch to the board view
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
/* tunnel shell, in the same board-pixel units as ROAD_HW (19) */
const TUN_HW      = ROAD_HW + KERB_W + 3;   // inner wall face, just past the kerb
const TUN_H       = 26;                     // wall height before the roof springs
const TUN_CROWN   = 9;                      // extra rise at the centre of the arch
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

  /* ---------- Phase 7: the REAL board as a live PiP pane ---------------
     While the cockpit subsystem is animating or holding a view switch,
     the game's own #tracksvg is lifted above the windshield canvas
     (transform only — its layout box never moves, so the page doesn't
     jump) and driven between two poses:
       · full view  (identity transform — the classic board view)
       · PiP corner (scaled into the top-left minimap slot)
     The CSS transition between them IS the zoom in/out effect.        */
  #trackwrap.fp-live #tracksvg{
    position:relative; z-index:46;
    transform-origin:0 0;
    transition:transform .55s cubic-bezier(.22,.9,.28,1), opacity .55s ease;
    will-change:transform, opacity;
  }
  #trackwrap.fp-live.fp-pip #tracksvg{
    opacity:.82;                 /* translucent live board */
    cursor:pointer;
    filter:drop-shadow(0 0 26px rgba(0,0,0,.85));
  }

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
chip.textContent = "● cockpit — tap road to skip · tap map / ▦ / V board view · H dash";
wrap.appendChild(chip);
const tab = document.createElement("div");
tab.id = "fpdocktab";
tab.textContent = "▾ DASH";
const vbtn = document.createElement("button");
vbtn.id = "fpviewbtn";
vbtn.type = "button";
wrap.appendChild(vbtn);
const ctx = cv.getContext("2d");

/* one switch for keyboard + button: cockpit cam ⇄ classic board view.
   Phase 7: the label and the action track what is actually ON SCREEN,
   so the button can never claim "cockpit active" over a board view. */
function replayOn(){ return (typeof REPLAY !== "undefined") && REPLAY.active; }
function updateViewBtn(){
  vbtn.textContent = FP.active ? "▦ BOARD VIEW" : "● COCKPIT VIEW";
  vbtn.title = FP.active ? "Switch to the board-game view"
                         : "Switch to the cockpit view";
}
function toggleView(){
  if(FP.active){                       /* cockpit is up → go to the board */
    FP.enabled = false; savePref("enabled", FP.enabled);
    FP.hold = false; hide();
    if(typeof toast === "function") toast("Board view — cockpit cam off");
  }else{                               /* board is up → raise the cockpit */
    if(REDUCED){
      if(typeof toast === "function")
        toast("Cockpit cam is disabled by your reduced-motion setting", true);
      return;
    }
    FP.enabled = true; savePref("enabled", FP.enabled);
    FP.snooze = false;
    /* if we're mid shift/play stage, re-enter the staged hold */
    if(FP.hud && FP._stagePhase) engageHold(FP._stagePhase);
    if(!safeHuman() && typeof toast === "function" && !replayOn())
      toast("Cockpit view ON — raises once the race is on track");
    else if(typeof toast === "function") toast("Cockpit view ON");
  }
  updateViewBtn();
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
/* Phase 7 shared state — declared early so refit() can reach it */
const PIP = { on:false, r:null, _t:0 };
const svgEl = document.getElementById("tracksvg");

fit();
function refit(){ fit(); if(PIP.on) applyPipTransform(); }
if(window.ResizeObserver) new ResizeObserver(refit).observe(wrap);
else addEventListener("resize", refit);

cv.addEventListener("pointerdown", ()=>{
  if(replayOn()){ toggleView(); return; }   // replays: tap = full view switch
  FP.snooze = true; hide();                 // races: tap = peek at the board
});                                         //   (returns at the next stage)
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

/* ---------- Phase 7: live PiP board + zoom transition -----------------
   pipIn()  — entering the cockpit: the full board minimises down into
              the top-left PiP slot while the windshield fades in below.
   pipOut() — leaving the cockpit: the PiP board grows until it takes
              over the whole view, then the windshield fades away and
              the SVG is handed back to the normal page stack.         */
function pipRect(){
  const lw = (svgEl && svgEl.clientWidth)  || W || 1;
  const lh = (svgEl && svgEl.clientHeight) || H || 1;
  const mw = Math.max(110, Math.min(235, W*0.34));
  const s  = mw/lw;
  return { x:10, y:10, s, w:mw, h:lh*s };
}
function applyPipTransform(){
  if(!svgEl) return;
  const r = PIP.r = pipRect();
  svgEl.style.transform = `translate(${r.x}px,${r.y}px) scale(${r.s})`;
}
function pipIn(){
  if(!svgEl) return;
  clearTimeout(PIP._t);
  wrap.classList.add("fp-live");
  /* two frames so the transition always animates from the full pose */
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(!FP.active) return;
    wrap.classList.add("fp-pip");
    applyPipTransform();
    PIP.on = true;
  }));
}
function pipOut(){
  clearTimeout(PIP._t);
  PIP.on = false;
  if(!svgEl){ wrap.classList.remove("fp-live","fp-pip"); return; }
  wrap.classList.remove("fp-pip");
  svgEl.style.transform = "";                        // …grows back to full
  PIP._t = setTimeout(()=>{                          // then drop the lift
    wrap.classList.remove("fp-live");
    svgEl.style.transform = ""; svgEl.style.opacity = "";
  }, 620);
}
/* tapping the PiP board = switch to the board view */
if(svgEl) svgEl.addEventListener("pointerdown", e=>{
  if(!wrap.classList.contains("fp-pip")) return;
  e.stopPropagation(); e.preventDefault();
  toggleView();
}, true);

let hideT = 0;
function show(){
  if(FP.active) return;
  FP.active = true;
  clearTimeout(hideT);
  chip.textContent = replayOn()
    ? "● cockpit replay — tap road / map / ▦ / V for board view"
    : "● cockpit — tap road to skip · tap map / ▦ / V board view · H dash";
  cv.classList.add("on");
  pipIn();
  if(FP.hud && !replayOn()) dock();
  updateViewBtn();
}
function hide(){
  if(!FP.active) return;
  FP.active = false;
  undock();
  pipOut();                                          // board grows to full…
  clearTimeout(hideT);
  hideT = setTimeout(()=>{                           // …then windshield fades
    if(!FP.active) cv.classList.remove("on");
  }, 400);
  updateViewBtn();
}

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

/* =====================================================================
   Phase 7 — COCKPIT REPLAYS
   The replay engine (game.js) drives the board sprites directly from
   G.replay + REPLAY.t. Here we mirror that exact interpolation into
   each player's _v visual state every frame, so the cockpit renderer
   (which reads _v for the camera and for rival billboards) replays the
   race from the driver's seat with zero changes to the replay engine.
   ===================================================================== */
const rpOff = s => s===0 ? -9 : 9;          // same lane offsets as game.js
function syncReplayVis(){
  const R = G.replay;
  if(!R || R.length < 2 || typeof REPLAY === "undefined") return;
  const N = R.length - 1;
  const t = Math.max(0, Math.min(N, REPLAY.t || 0));
  const i = Math.min(N-1, Math.floor(t)), f = Math.min(1, t - i);
  const A = R[i], B = R[i+1];
  for(let k=0;k<G.players.length;k++){
    const p = G.players[k];
    const a = (A[k]&&A[k].id===p.id)?A[k]:A.find(s=>s.id===p.id);
    const b = (B[k]&&B[k].id===p.id)?B[k]:B.find(s=>s.id===p.id);
    if(!a || !b) continue;
    if(!p._v) p._v = {total:a.total, off:rpOff(a.spot), blend:0, spin:0,
                      pfrom:null, _tgt:null, _top:0};
    p._v.total = a.total + (b.total - a.total)*f;
    p._v.off   = rpOff(a.spot) + (rpOff(b.spot) - rpOff(a.spot))*f;
    p._v.spin  = 0;
    p._v.blend = 0;      // finishers render as cars on track, not podium
    p._v.pfrom = null;
  }
}
function snapCamToReplay(){
  const p = safeHuman(); if(!p) return;
  syncReplayVis();
  if(p._v){
    FP.cam.total = p._v.total; FP.cam.off = p._v.off;
    FP.cam.head = null; FP.cam.spd = 0; FP.cam.roll = 0;
    FP.cam._pt = p._v.total; FP._lastTot = p.total;
  }
  FP.hold = false; FP.phase = ""; FP.snooze = false;
}
/* lights-out / chequered flag of the replay: snap the camera cleanly */
wrapFn("startReplay", null, function(){ if(replayOn()) snapCamToReplay(); });
wrapFn("endReplay",   null, function(){
  const p = safeHuman();
  if(p && p._v) resetCamIfFar(p);
});
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
let FEAT = { track:null, gravelIn:new Set(), gravelOut:new Set(), wSector:new Set(),
             tunnel:new Set() };
function featCache(){
  if(FEAT.track === TRACK && FEAT.weather === (G.weather||null)) return FEAT;
  FEAT = { track:TRACK, weather:G.weather||null,
           gravelIn:new Set(), gravelOut:new Set(), wSector:new Set(),
           tunnel:new Set() };
  try{
    if(typeof gravelLists === "function"){
      const g = gravelLists(TRACK);
      g.inner.forEach(i=>FEAT.gravelIn.add(i));
      g.outer.forEach(i=>FEAT.gravelOut.add(i));
    }
  }catch(_){}
  /* tunnels: prefer the game's own test, but fall back to reading the track's
     runs directly so the cockpit still builds a tunnel if game.js is older.
     `from > to` means the run wraps past space 0 (see the track files). */
  try{
    if(typeof inTunnelSpace === "function"){
      for(let sp=0; sp<S; sp++) if(inTunnelSpace(sp)) FEAT.tunnel.add(sp);
    }else if(TRACK && Array.isArray(TRACK.tunnels)){
      for(const r of TRACK.tunnels){
        if(!r) continue;
        let a = (((r.from|0)%S)+S)%S, b = (((r.to|0)%S)+S)%S;
        for(let k=0, sp=a; k<S; k++, sp=(sp+1)%S){ FEAT.tunnel.add(sp); if(sp===b) break; }
      }
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
/* is the space at this race total inside a tunnel? */
function tunnelAt(totF){
  return featCache().tunnel.has(((phys(Math.floor(totF)))%S+S)%S);
}
function weatherFlags(){
  const d = (G.weather && G.weather.def && G.weather.def.sector) || {};
  const key = (G.weather && G.weather.key) || "none";
  return { d, key };
}

/* =====================================================================
   TERRAIN SKIES — the windshield world themed from TRACK.terrain
   (the same field the painted art board uses):
   oval · mountain · parkland · farmland · desert · savannah · urban ·
   arctic · tuscany · street · riviera · medieval · miami · ruins ·
   japan · spain · jungle
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
              sil:{kind:"peaks",    col:"#c3d3e0", snow:"rgba(255,255,255,.9)"} },

  /* --- destination flavours (pick in the editor's terrain field) ------ */
  tuscany:  { sky:["#241430","#7a3c52","#d99a5a"], sun:"255,220,160",   // golden-hour hills
              ground:["#6a5a2c","#8a763c"], elev:1.0,
              props:[["cypress",4],["olive",2],["villa",0.5],["bush",1]],
              sil:{kind:"tuscany",  col:"#3a2438", prop:"#2a1c30"} },
  street:   { sky:["#0b0e1c","#1d2440","#354064"], sun:"222,230,255",   // downtown street circuit
              ground:["#242530","#333440"], elev:0.25,
              props:[["lamp",4],["block",2],["wallseg",1.5],["panel",1]],
              sil:{kind:"city",     col:"#10152a", win:"rgba(140,220,255,.8)"} },
  riviera:  { sky:["#1a1430","#5c3a5e","#d9825f"], sun:"255,214,170",   // Monaco-style resort
              ground:["#3a4438","#4a5442"], elev:0.8,
              props:[["palm",3],["villa",1.4],["lamp",2],["parasol",0.5]],
              sil:{kind:"riviera",  col:"#2a1e38", win:"rgba(255,224,160,.8)"} },
  medieval: { sky:["#171226","#3c2c4e","#6e4a5e"], sun:"244,232,204",   // castle town
              ground:["#2b3a22","#3a4a2c"], elev:1.1,
              props:[["halftimber",2.5],["keep",0.8],["tree",2],["post",1]],
              sil:{kind:"castles",  col:"#1e1830"} },
  miami:    { sky:["#160f2e","#4a2160","#c9527e"], sun:"255,170,200",   // pastel art-deco beachfront
              ground:["#8a7448","#a89060"], elev:0.2,
              props:[["palm",4],["deco",1.5],["lamp",2],["parasol",0.8]],
              sil:{kind:"miami",    col:"#241640", win:"rgba(120,240,255,.8)", neon:"#ff5fa2"} },
  ruins:    { sky:["#20142c","#5e3648","#c08050"], sun:"255,216,160",   // ancient Roman campagna
              ground:["#5a5138","#746a48"], elev:0.7,
              props:[["column",2.5],["ruinarch",1],["umbpine",2],["rock",1]],
              sil:{kind:"ruins",    col:"#3a2a34"} },
  japan:    { sky:["#141228","#40325e","#8a5a7e"], sun:"255,226,214",   // blossom season, Mt Fuji
              ground:["#2a3c28","#3a4c32"], elev:1.2,
              props:[["cherry",3.5],["torii",0.7],["pagoda",0.4],["tree",1]],
              sil:{kind:"fuji",     col:"#241e3c", snow:"rgba(240,244,252,.92)", blossom:"#e8a8c8"} },
  spain:    { sky:["#26142a","#83404a","#d9964e"], sun:"255,210,140",   // Andalusian sierra
              ground:["#6a5a34","#8a7444"], elev:0.85,
              props:[["olive",3],["casa",1.2],["windmill",0.6],["drybush",2]],
              sil:{kind:"sierra",   col:"#402630"} },
  jungle:   { sky:["#0e1c1a","#1d4034","#3a6a4a"], sun:"230,244,214",   // dense rainforest
              ground:["#1e3620","#2a4628"], elev:1.0,
              props:[["palm",2],["tree",3],["bush",3]],
              sil:{kind:"trees",    col:"#122016"} }
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

  if(sil.kind === "tuscany"){                           // broad golden hills + cypress rows
    ctx.beginPath(); ctx.moveTo(0, hz);
    for(let x=0; x<=W; x+=12){
      const t = (x*0.007 - head*2.2);
      ctx.lineTo(x, hz - 8 - Math.abs(Math.sin(t)*22 + Math.sin(t*1.7+0.8)*10));
    }
    ctx.lineTo(W, hz); ctx.closePath(); ctx.fill();
    scatterProps(hz, 70, (x, r)=>{                      // cypress spikes riding the ridge
      const t = (x*0.007 - head*2.2);
      const base = hz - 8 - Math.abs(Math.sin(t)*22 + Math.sin(t*1.7+0.8)*10) + 2;
      const ch = 9 + r*13, cw = Math.max(1.6, ch*0.22);
      ctx.fillStyle = sil.prop || sil.col;
      ctx.beginPath(); ctx.moveTo(x-cw/2, base); ctx.quadraticCurveTo(x-cw/2, base-ch*0.7, x, base-ch);
      ctx.quadraticCurveTo(x+cw/2, base-ch*0.7, x+cw/2, base); ctx.closePath(); ctx.fill();
      if(r > 0.6) { ctx.fillRect(x+cw*1.6, base-ch*0.75, cw*0.9, ch*0.75); }
    });
    return;
  }

  if(sil.kind === "castles"){                           // wooded hills + castle keeps
    ctx.beginPath(); ctx.moveTo(0, hz);
    for(let x=0; x<=W; x+=10){
      const t = (x*0.011 - head*2.2);
      ctx.lineTo(x, hz - 9 - Math.abs(Math.sin(t)*18 + Math.sin(t*2.6+1.1)*8));
    }
    ctx.lineTo(W, hz); ctx.closePath(); ctx.fill();
    scatterProps(hz, 210, (x, r)=>{                     // a tower with crenellations
      const th = 16 + r*14, tw = 7 + r*4, top = hz - 14 - th;
      ctx.fillStyle = sil.col;
      ctx.fillRect(x-tw/2, top, tw, th+14);
      for(let m=0;m<3;m++) ctx.fillRect(x-tw/2 + m*(tw/2.6), top-3, tw/4.5, 3);
      if(r>0.5) ctx.fillRect(x+tw*0.9, top+th*0.35, tw*0.7, th*0.65+14);
    });
    return;
  }

  if(sil.kind === "riviera"){                           // villa-stacked hillside + masts
    ctx.beginPath(); ctx.moveTo(0, hz);
    for(let x=0; x<=W; x+=10){
      const t = (x*0.009 - head*2.2);
      ctx.lineTo(x, hz - 12 - Math.abs(Math.sin(t)*20 + Math.sin(t*2.1+2.4)*9));
    }
    ctx.lineTo(W, hz); ctx.closePath(); ctx.fill();
    const R = 190, bw = 26;                             // little lit villas on the slope
    const k0 = Math.floor((head*R)/bw) - 1, kN = k0 + Math.ceil(W/bw) + 3;
    for(let k=k0; k<=kN; k++){
      const x = k*bw - head*R;
      if(x > W + bw || x < -bw*2) continue;
      const r = hsh(k*1.3);
      const t = (x*0.009 - head*2.2);
      const ridge = 12 + Math.abs(Math.sin(t)*20 + Math.sin(t*2.1+2.4)*9);
      const bh = 6 + r*9, w2 = bw*(0.45 + hsh(k+3.3)*0.3);
      const y = hz - ridge*(0.25 + hsh(k+7.1)*0.65);
      ctx.fillStyle = sil.col; ctx.fillRect(x, y-bh, w2, bh);
      if(sil.win && r > 0.3){
        ctx.fillStyle = sil.win;
        ctx.fillRect(x+2, y-bh+2, 2.4, 2.6);
        if(r > 0.62) ctx.fillRect(x+w2-5, y-bh+2, 2.4, 2.6);
      }
    }
    scatterProps(hz, 120, (x, r)=>{                     // yacht masts pricking the skyline
      if(r < 0.45) return;
      ctx.strokeStyle = sil.col; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x, hz); ctx.lineTo(x, hz - 7 - r*7); ctx.stroke();
    });
    return;
  }

  if(sil.kind === "miami"){                             // pastel deco skyline + neon + palms
    const R = 190, bw = 40;
    const k0 = Math.floor((head*R)/bw) - 1, kN = k0 + Math.ceil(W/bw) + 3;
    for(let k=k0; k<=kN; k++){
      const x = k*bw - head*R;
      if(x > W + bw || x < -bw*2) continue;
      const r = hsh(k);
      const bh = 16 + r*44, w2 = bw*(0.55 + hsh(k+9.7)*0.3);
      ctx.fillStyle = sil.col;
      ctx.fillRect(x, hz-bh, w2, bh);
      ctx.beginPath();                                  // rounded deco crown
      ctx.arc(x+w2/2, hz-bh, w2*0.32, Math.PI, 0); ctx.fill();
      if(sil.neon){                                     // neon trim line
        ctx.strokeStyle = sil.neon; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(x+2, hz-bh+3); ctx.lineTo(x+w2-2, hz-bh+3); ctx.stroke();
      }
      if(sil.win && r > 0.35){
        ctx.fillStyle = sil.win;
        for(let wy=0; wy<2+Math.floor(r*3); wy++)
          if(hsh(k*11.3+wy) > 0.4) ctx.fillRect(x+4+((wy%2)*(w2/2)), hz-bh+8+wy*8, 3, 3.4);
      }
    }
    scatterProps(hz, 90, (x, r)=>{                      // horizon palms
      const th = 8 + r*8;
      ctx.strokeStyle = sil.col; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x, hz); ctx.quadraticCurveTo(x+2, hz-th*0.6, x+3, hz-th); ctx.stroke();
      ctx.fillStyle = sil.col;
      for(let f=0; f<5; f++){
        const a = -Math.PI*0.9 + f*(Math.PI*0.8/4);
        ctx.beginPath(); ctx.moveTo(x+3, hz-th);
        ctx.quadraticCurveTo(x+3+Math.cos(a)*6, hz-th+Math.sin(a)*6-3, x+3+Math.cos(a)*9, hz-th+Math.sin(a)*9);
        ctx.lineTo(x+3, hz-th+1); ctx.closePath(); ctx.fill();
      }
    });
    return;
  }

  if(sil.kind === "ruins"){                             // aqueduct arches marching past
    ctx.beginPath(); ctx.moveTo(0, hz);                 // low campagna swell
    for(let x=0; x<=W; x+=14){
      const t = (x*0.006 - head*2.2);
      ctx.lineTo(x, hz - 4 - Math.abs(Math.sin(t)*9));
    }
    ctx.lineTo(W, hz); ctx.closePath(); ctx.fill();
    const R = 190, bw = 30, top = 26;                   // the aqueduct
    const k0 = Math.floor((head*R)/bw) - 1, kN = k0 + Math.ceil(W/bw) + 3;
    for(let k=k0; k<=kN; k++){
      const x = k*bw - head*R;
      if(x > W + bw || x < -bw*2) continue;
      const r = hsh(k*2.7);
      if(r < 0.14) continue;                            // collapsed section — a gap
      ctx.fillStyle = sil.col;
      const h2 = top - (r < 0.3 ? 8 : 0);               // some piers broken shorter
      ctx.fillRect(x, hz-h2, 6, h2);                    // pier
      if(r >= 0.3){                                     // intact span: lintel + arch cut
        ctx.fillRect(x, hz-top, bw, 6);
        ctx.beginPath(); ctx.moveTo(x+6, hz);
        ctx.lineTo(x+6, hz-top+9);
        ctx.quadraticCurveTo(x+bw/2, hz-top+2, x+bw-1, hz-top+9);
        ctx.lineTo(x+bw-1, hz);
        /* the arch void is sky — punch it by drawing in sky-low colour */
        ctx.closePath(); ctx.fillStyle = TT.sky[2]; ctx.fill();
      }
    }
    scatterProps(hz, 160, (x, r)=>{                     // lone broken columns
      if(r < 0.5) return;
      ctx.fillStyle = sil.col;
      ctx.fillRect(x-1.6, hz-8-r*8, 3.2, 8+r*8);
      ctx.fillRect(x-2.6, hz-8-r*8, 5.2, 1.6);
    });
    return;
  }

  if(sil.kind === "fuji"){                              // one great snow-capped cone
    const R = 90, span = W*1.9;                         // slow parallax, wraps
    const off = ((head*R) % span + span) % span;
    const cx = ((W*0.6 - off) % span + span) % span - span*0.22;
    const baseW = W*0.75, ch = 84;
    ctx.beginPath();                                    // the volcano
    ctx.moveTo(cx-baseW/2, hz);
    ctx.quadraticCurveTo(cx-baseW*0.16, hz-ch*0.8, cx-baseW*0.07, hz-ch);
    ctx.lineTo(cx+baseW*0.07, hz-ch);
    ctx.quadraticCurveTo(cx+baseW*0.16, hz-ch*0.8, cx+baseW/2, hz);
    ctx.closePath(); ctx.fill();
    if(sil.snow){                                       // snow cap
      ctx.fillStyle = sil.snow;
      ctx.beginPath();
      ctx.moveTo(cx-baseW*0.115, hz-ch*0.78);
      ctx.lineTo(cx-baseW*0.07, hz-ch); ctx.lineTo(cx+baseW*0.07, hz-ch);
      ctx.lineTo(cx+baseW*0.115, hz-ch*0.78);
      for(let m=4; m>=-4; m--)                          // ragged snow line
        ctx.lineTo(cx + m*baseW*0.026, hz-ch*(0.78 + (m%2 ? 0.05 : 0)));
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = sil.col;
    ctx.beginPath(); ctx.moveTo(0, hz);                 // low foothills in front
    for(let x=0; x<=W; x+=12){
      const t = (x*0.012 - head*2.2);
      ctx.lineTo(x, hz - 5 - Math.abs(Math.sin(t)*11 + Math.sin(t*3.1)*4));
    }
    ctx.lineTo(W, hz); ctx.closePath(); ctx.fill();
    if(sil.blossom) scatterProps(hz, 110, (x, r)=>{     // blossom crowns on the ridge
      ctx.fillStyle = sil.blossom; ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.arc(x, hz-8-r*5, 4.5+r*3.5, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    });
    return;
  }

  if(sil.kind === "sierra"){                            // dry flat-topped mesas
    ctx.beginPath(); ctx.moveTo(0, hz);
    for(let x=0; x<=W; x+=8){
      const t = (x*0.009 - head*2.2);
      let h = 10 + Math.abs(Math.sin(t)*26 + Math.sin(t*1.9+1.2)*11);
      h = Math.min(h, 30 + Math.sin(t*0.7)*4);          // clip to a table top
      ctx.lineTo(x, hz - h);
    }
    ctx.lineTo(W, hz); ctx.closePath(); ctx.fill();
    scatterProps(hz, 230, (x, r)=>{                     // distant windmill on the mesa
      if(r < 0.4) return;
      const t = (x*0.009 - head*2.2);
      let mh = 10 + Math.abs(Math.sin(t)*26 + Math.sin(t*1.9+1.2)*11);
      mh = Math.min(mh, 30 + Math.sin(t*0.7)*4);
      const base = hz - mh + 2, th = 12 + r*8;
      ctx.fillStyle = sil.col;
      ctx.beginPath(); ctx.moveTo(x-3, base); ctx.lineTo(x-1.6, base-th);
      ctx.lineTo(x+1.6, base-th); ctx.lineTo(x+3, base); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = sil.col; ctx.lineWidth = 1.2;
      for(let s=0; s<4; s++){
        const a = r*6 + s*Math.PI/2;
        ctx.beginPath(); ctx.moveTo(x, base-th);
        ctx.lineTo(x+Math.cos(a)*7, base-th+Math.sin(a)*7); ctx.stroke();
      }
    });
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
   TRACKSIDE FEATURES — declared per track (set in the track editor):

       trackside:[ {from:3, to:6, side:"out", kind:"grandstand"},
                   {from:10, to:20, side:"out", kind:"beach"}, … ]

   from/to are inclusive space indices (wrapping past 0 on loops), side
   is "out" (away from the Race Line) or "in" (the Race Line side), and
   kind is one of TS_KINDS below. Kinds with a `band` repaint the ground
   itself (sand running down to the sea, crops, a car-park apron); every
   kind also places deterministic props, replacing the terrain's random
   scenery on the spaces it claims. Purely visual — no rules effect.
   The editor mirrors this catalogue as TS_TYPES; keep the keys in step.
   ===================================================================== */
const TS_KINDS = {
  beach:      { band:"beach" },   lake:       { band:"water" },
  harbor:     { band:"quay"  },   lighthouse: {},
  grandstand: {},                 crowdbank:  {},
  pits:       {},                 paddock:    {},
  carpark:    { band:"lot"   },   billboards: {},
  floodlights:{},                 barrier:    {},
  buildings:  {},                 houses:     {},
  industry:   {},                 funfair:    {},
  windfarm:   {},                 forest:     {},
  palms:      {},                 field:      { band:"crops" },
  campsite:   {},                 rocks:      {}
};

let TSC = { track:null, in:null, out:null };
function tracksideCache(){
  if(TSC.track === TRACK && TSC.in) return TSC;
  const inM = new Map(), outM = new Map();
  const list = (typeof TRACK !== "undefined" && TRACK && TRACK.trackside) || [];
  for(const e of list){
    if(!e || !TS_KINDS[e.kind]) continue;
    const M = (e.side === "in" || e.side === -1) ? inM : outM;
    const a = (((e.from|0))%S+S)%S, b = (((e.to|0))%S+S)%S;
    for(let k=0, sp=a; k<S; k++, sp=(sp+1)%S){ M.set(sp, e.kind); if(sp===b) break; }
  }
  TSC = { track:TRACK, in:inM, out:outM };
  return TSC;
}

/* props a trackside kind plants on one space — deterministic, like the
   random scenery, so the same stand is on the same brow lap after lap.
   lat is EXTRA distance beyond the gravel strip (matches propCache). */
function tsProps(sp, side, kind){
  const h = a => hsh(sp*a + side*7.7);
  const out = [];
  const add = (k, frac, lat, sc, r)=> out.push({ side, kind:k, frac, lat, sc, r });
  switch(kind){
  case "grandstand": add("stand",  .5, 4.5, 1, h(3.1)); break;
  case "crowdbank":  add("bank",   .5, 5,   1, h(3.3)); break;
  case "pits":       add("pitbox", .5, 3.5, 1, h(2.9)); break;
  case "billboards": add("hoard",  .5, 3.5, 1, h(8.1)); break;
  case "barrier":    add("wallseg",.5, 2,   1, h(4.7)); break;
  case "floodlights":add("flood",  .5, 5,   1, h(5.3)); break;
  case "paddock":
    add(h(2.2) < .5 ? "truck" : "tent", .3 + h(5.1)*.4, 5 + h(4.4)*9, .95 + h(6.6)*.25, h(9.1));
    if(h(7.7) < .5) add("tent", .82, 13 + h(3.9)*8, .85, h(8.8));
    break;
  case "carpark":
    for(let k=0;k<3;k++) add("parked", (k+.5)/3 + (hsh(sp*3+k)-.5)*.14,
                             3.5 + hsh(sp*4.4+k)*4, 1, hsh(sp*5.5+k));
    break;
  case "buildings":
    add("towerblk", .5, 9 + h(4.1)*6, .9 + h(5.5)*.5, h(6.2));
    if(h(8.2) < .6) add("towerblk", .12, 20 + h(9.3)*10, .75 + h(2.4)*.35, h(3.8));
    break;
  case "houses":
    add("house", .3, 7 + h(4.6)*6, .9 + h(5.2)*.3, h(7.3));
    if(h(6.8) < .65) add("house", .75, 11 + h(8.4)*8, .8 + h(9.9)*.3, h(2.6));
    break;
  case "industry":
    add(h(3.3) < .5 ? "chimney" : "tankfarm", .5, 11 + h(5.8)*8, 1, h(4.9));
    break;
  case "funfair":
    add(h(4.4) < .35 ? "bigtop" : "ferris", .5, 13 + h(6.9)*6, 1, h(2.3));
    break;
  case "windfarm":
    add("turbine", .5, 15 + h(7.2)*14, .9 + h(3.4)*.35, h(6.7));
    break;
  case "forest":
    for(let k=0;k<3;k++) add(hsh(sp*3.3+k) < .3 ? "pine" : "tree",
                             hsh(sp*7.1+k), 4 + hsh(sp*9.2+k)*20, .9 + hsh(sp*4.6+k)*.6, hsh(sp*11.4+k));
    break;
  case "palms":
    add("palm", .28 + h(5.4)*.4, 5 + h(3.6)*10, .9 + h(7.1)*.4, h(1.9));
    if(h(4.2) < .55) add("palm", .82, 9 + h(6.3)*8, .8 + h(2.8)*.4, h(5.7));
    break;
  case "campsite":
    add(h(2.7) < .5 ? "camptent" : "campervan", .3 + h(6.4)*.4, 4 + h(4.8)*8, 1, h(9.6));
    if(h(5.9) < .45) add("fire", .8, 6 + h(3.2)*6, 1, h(7.9));
    break;
  case "rocks":
    for(let k=0;k<2;k++) add("rock", hsh(sp*6.2+k), 4 + hsh(sp*8.3+k)*16, 1.2 + hsh(sp*2.4+k)*1.2, hsh(sp*13.1+k));
    break;
  case "lighthouse":
    if(h(2.1) < .35) add("lighth", .5, 16 + h(4.3)*8, 1, h(9.4));
    else             add("rock", h(5.6), 6 + h(6.5)*10, 1 + h(3.7)*.9, h(1.4));
    break;
  case "harbor":
    add(h(3.5) < .5 ? "crane" : "containers", .5, 4 + h(5.1)*4, 1, h(6.9));
    break;
  case "beach":
    if(h(4.9) < .35) add("parasol", h(7.6), 6 + h(2.5)*9, 1, h(8.3));
    break;
  case "lake":
    if(h(6.2) < .25) add("boat", .5, 24 + h(3.1)*16, 1, h(5.2));
    break;
  case "field":
    if(h(3.9) < .28) add("bale", h(6.1), 8 + h(7.4)*14, 1, h(8.5));
    break;
  }
  return out;
}


/* =====================================================================
   TRACKSIDE PROPS — world-space scenery outside the kerbs, themed per
   terrain and deterministic per space (so the same bush is always on
   the same brow, lap after lap). Marshal tents spawn before corners.
   Spaces claimed by a track's `trackside` declarations get that feature
   instead of the random scenery on the claimed side.
   ===================================================================== */
let PROPC = { track:null, terr:"", bySp:null };
function propCache(){
  const terr = (typeof TRACK !== "undefined" && TRACK && TRACK.terrain) || "oval";
  if(PROPC.track === TRACK && PROPC.terr === terr && PROPC.bySp) return PROPC;
  const TS = tracksideCache();
  const conf = (FP_TERRAIN[terr] || FP_TERRAIN.oval).props || [["tree",1]];
  const totW = conf.reduce((s,c)=>s+c[1], 0) || 1;
  const bySp = new Map();
  const put  = (sp,p)=>{ const a=bySp.get(sp)||[]; a.push(p); bySp.set(sp,a); };
  for(let sp=0; sp<S; sp++){
    for(const side of [-1,1]){
      const tsKind = (side < 0 ? TS.in : TS.out).get(sp);
      if(tsKind){                                            // declared feature owns this side
        for(const p of tsProps(sp, side, tsKind)) put(sp, p);
        continue;
      }
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
  /* a white marshal tent shortly before every corner — on a free side */
  try{
    const seen = new Set();
    for(const c of cornerTotals()){
      const sp = ((phys(Math.floor(c) - 2))%S+S)%S;
      if(seen.has(sp)) continue; seen.add(sp);
      let side = hsh(sp*2.2) < .5 ? -1 : 1;
      if((side < 0 ? TS.in : TS.out).get(sp)) side = -side;   // that side is claimed — try the other
      if((side < 0 ? TS.in : TS.out).get(sp)) continue;       // both claimed — skip the tent
      put(sp, { side, kind:"tent",
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

  /* ---------- trackside-feature props (declared via TRACK.trackside) ---------- */
  case "stand":{                                  // grandstand packed with fans
    const w=30*u, hgt=9.5*u;
    g.fillStyle="#4a453e"; g.fillRect(x-w/2, y-hgt*0.9, w, hgt*0.9);      // frame
    for(let t3=0; t3<3; t3++){                                            // seating tiers
      const ty = y - hgt*(0.22 + t3*0.24), th3 = hgt*0.2;
      g.fillStyle = t3%2 ? "#5b554c" : "#544e46";
      g.fillRect(x-w/2, ty-th3, w, th3);
      tsCrowd(g, x, ty-th3*0.15, w*0.94, th3*0.85, r*97 + t3*13, u);
    }
    g.fillStyle="#e9e2d1";                                                // roof canopy
    g.beginPath(); g.moveTo(x-w*0.56, y-hgt*0.92); g.lineTo(x+w*0.56, y-hgt*0.92);
    g.lineTo(x+w*0.5, y-hgt*1.1); g.lineTo(x-w*0.5, y-hgt*1.1); g.closePath(); g.fill();
    g.strokeStyle="#8a8577"; g.lineWidth=Math.max(1, 0.7*u);
    g.beginPath(); g.moveTo(x-w*0.46, y); g.lineTo(x-w*0.46, y-hgt*0.92);
    g.moveTo(x+w*0.46, y); g.lineTo(x+w*0.46, y-hgt*0.92); g.stroke();
    for(const fx2 of [-0.35, 0.1, 0.4]){                                  // flags on the roof
      const px2 = x + w*fx2;
      g.strokeStyle="#8a8577"; g.beginPath(); g.moveTo(px2, y-hgt*1.1); g.lineTo(px2, y-hgt*1.36); g.stroke();
      g.fillStyle = hsh(r*31+fx2*9) < .5 ? "#c8322c" : "#3f7d8c";
      g.beginPath(); g.moveTo(px2, y-hgt*1.36); g.lineTo(px2+3.2*u, y-hgt*1.31);
      g.lineTo(px2, y-hgt*1.26); g.closePath(); g.fill();
    }
    break; }
  case "bank":{                                   // spectators on a grass bank
    const w=(26+r*6)*u, hgt=(4.5+r*1.5)*u;
    g.fillStyle="#4c6134";
    g.beginPath(); g.ellipse(x, y, w/2, hgt, 0, Math.PI, 0); g.fill();
    tsCrowd(g, x, y-hgt*0.25, w*0.8, hgt*0.9, r*61, u);
    const px2 = x + (r-0.5)*w*0.5;
    g.strokeStyle="#8a8577"; g.lineWidth=Math.max(1, 0.6*u);
    g.beginPath(); g.moveTo(px2, y-hgt); g.lineTo(px2, y-hgt-4.5*u); g.stroke();
    g.fillStyle="#d8c23a";
    g.beginPath(); g.moveTo(px2, y-hgt-4.5*u); g.lineTo(px2+3.4*u, y-hgt-3.9*u);
    g.lineTo(px2, y-hgt-3.3*u); g.closePath(); g.fill();
    break; }
  case "pitbox":{                                 // pit garage + crew + tyres
    const w=27*u, hgt=7.5*u;
    g.fillStyle="#d9d2c2"; g.fillRect(x-w/2, y-hgt, w, hgt);
    g.fillStyle="#221e28"; g.fillRect(x-w*0.30, y-hgt*0.74, w*0.60, hgt*0.74);  // open door
    g.fillStyle="#c8322c"; g.fillRect(x-w/2, y-hgt, w, hgt*0.2);                // sign strip
    if(u > 1.0){
      g.fillStyle="#f2ead8"; g.font=`900 ${Math.max(5, 2.4*u)}px var(--mono, monospace)`;
      g.textAlign="center"; g.textBaseline="middle";
      g.fillText("PIT " + (1+((r*9)|0)), x, y-hgt*0.9);
    }
    g.fillStyle="#1d1a22";                                                       // tyre stack
    for(let k=0;k<3;k++){ g.beginPath(); g.arc(x-w*0.40, y-(0.9+k*1.5)*u, 1.15*u, 0, 7); g.fill(); }
    tsCrowd(g, x+w*0.36, y, 4*u, 2.2*u, r*43, u);                                // crew
    break; }
  case "hoard":{                                  // sponsor hoardings, wall to wall
    const w=32*u, hgt=4.6*u, py=y-1.2*u;
    g.strokeStyle="#8b8577"; g.lineWidth=Math.max(1, 0.8*u);
    for(const fx2 of [-0.4, 0, 0.4]){ g.beginPath(); g.moveTo(x+w*fx2, y); g.lineTo(x+w*fx2, py); g.stroke(); }
    const pals = [["#efe6d4","#c8322c"],["#151824","#d8c23a"],["#1e4e46","#e9e2d1"],["#3f2a5a","#e08a3c"]];
    const n2 = 3;
    for(let k=0;k<n2;k++){
      const [bgc, fgc] = pals[(hsh(r*17+k*3.7)*pals.length)|0];
      const bx = x - w/2 + (w/n2)*k;
      g.fillStyle=bgc; g.fillRect(bx, py-hgt, w/n2 - 0.4*u, hgt);
      if(u > 0.9){
        g.fillStyle=fgc; g.font=`900 ${Math.max(4, 2.1*u)}px var(--mono, monospace)`;
        g.textAlign="center"; g.textBaseline="middle";
        g.fillText(["HEAT","REVUP","GAS","TYRE","OIL","V12"][(hsh(r*29+k*5.1)*6)|0], bx + w/(2*n2), py-hgt/2);
      }
    }
    break; }
  case "wallseg":{                                // concrete wall + catch fence
    const w=32*u, wh=2.4*u, fh=4.6*u;
    g.fillStyle="#a8a294"; g.fillRect(x-w/2, y-wh, w, wh);
    g.fillStyle="#8f897b"; g.fillRect(x-w/2, y-wh, w, wh*0.3);
    g.strokeStyle="rgba(90,86,78,.9)"; g.lineWidth=Math.max(1, 0.5*u);
    for(let k=0;k<5;k++){ const px2=x-w/2+w*(k+0.5)/5;
      g.beginPath(); g.moveTo(px2, y-wh); g.lineTo(px2, y-wh-fh); g.stroke(); }
    g.strokeStyle="rgba(120,116,106,.55)"; g.lineWidth=Math.max(1, 0.35*u);
    for(let k=1;k<3;k++){ const yy=y-wh-fh*k/3;
      g.beginPath(); g.moveTo(x-w/2, yy); g.lineTo(x+w/2, yy); g.stroke(); }
    break; }
  case "flood":{                                  // floodlight mast
    const lh=(15+r*3)*u;
    g.strokeStyle="#8a8f98"; g.lineWidth=Math.max(1, 1.0*u); g.lineCap="round";
    g.beginPath(); g.moveTo(x-0.8*u, y); g.lineTo(x, y-lh); g.lineTo(x+0.8*u, y); g.stroke();
    const gl = g.createRadialGradient(x, y-lh, 0.5*u, x, y-lh, 6*u);
    gl.addColorStop(0,"rgba(240,246,255,.8)"); gl.addColorStop(1,"rgba(240,246,255,0)");
    g.fillStyle=gl; g.beginPath(); g.arc(x, y-lh, 6*u, 0, 7); g.fill();
    g.fillStyle="#2c3038"; g.fillRect(x-2.4*u, y-lh-1.8*u, 4.8*u, 2.4*u);
    g.fillStyle="#f4f8ff";
    for(let ry2=0; ry2<2; ry2++) for(let rx2=0; rx2<4; rx2++)
      g.fillRect(x-2.0*u+rx2*1.1*u, y-lh-1.4*u+ry2*1.1*u, 0.7*u, 0.7*u);
    break; }
  case "truck":{                                  // team transporter
    const w=20*u, hgt=6.5*u;
    g.fillStyle = r<.5 ? "#e6e0d0" : "#4a5a8a";
    g.fillRect(x-w/2, y-hgt, w*0.78, hgt);                                 // trailer
    g.fillStyle = r<.5 ? "#c8322c" : "#d8c23a";
    g.fillRect(x-w/2, y-hgt*0.62, w*0.78, hgt*0.18);                       // livery stripe
    g.fillStyle="#39424e"; g.fillRect(x+w*0.30, y-hgt*0.62, w*0.20, hgt*0.62);   // cab
    g.fillStyle="#9fb6c9"; g.fillRect(x+w*0.33, y-hgt*0.56, w*0.13, hgt*0.2);    // windscreen
    g.fillStyle="#141117";
    for(const fx2 of [-0.36, -0.18, 0.12, 0.38]){
      g.beginPath(); g.arc(x+w*fx2, y, 1.1*u, 0, 7); g.fill(); }
    break; }
  case "parked":{                                 // a parked road car
    const w=6.5*u, hgt=2.4*u;
    const cols=["#8a2f2a","#2f4e8a","#c9c3b2","#3c5a34","#5a5a62","#b0762f"];
    g.fillStyle="rgba(0,0,0,.3)";
    g.beginPath(); g.ellipse(x, y, w*0.55, 0.5*u, 0, 0, 7); g.fill();
    g.fillStyle=cols[(r*cols.length)|0];
    rr(g, x-w/2, y-hgt, w, hgt, 0.8*u);
    g.fillStyle="#1b2530"; rr(g, x-w*0.28, y-hgt*0.95, w*0.56, hgt*0.5, 0.5*u);
    g.fillStyle="#141117";
    g.beginPath(); g.arc(x-w*0.30, y, 0.55*u, 0, 7); g.arc(x+w*0.30, y, 0.55*u, 0, 7); g.fill();
    break; }
  case "towerblk":{                               // city tower, lit windows
    const bw=(9+r*5)*u, bh=(16+r*12)*u;
    g.fillStyle="#3a3f4c"; g.fillRect(x-bw/2, y-bh, bw, bh);
    g.fillStyle="#2c313c"; g.fillRect(x+bw*0.26, y-bh, bw*0.24, bh);
    g.fillStyle="#4a5060"; g.fillRect(x-bw/2, y-bh, bw, 0.9*u);
    if(u > 0.7){
      g.fillStyle="rgba(255,214,130,.6)";
      for(let wy=0; wy<6; wy++) for(let wx=0; wx<3; wx++){
        if(hsh(r*97 + wy*3.1 + wx*1.7) < 0.45) continue;
        g.fillRect(x-bw*0.36+wx*bw*0.26, y-bh+(1.6+wy*2.3)*u, 1.0*u, 1.3*u);
      }
    }
    g.strokeStyle="#8a8f98"; g.lineWidth=Math.max(1, 0.5*u);
    g.beginPath(); g.moveTo(x, y-bh); g.lineTo(x, y-bh-2.4*u); g.stroke();
    break; }
  case "house":{                                  // pitched-roof house
    const bw=(8+r*2)*u, bh=(4+r)*u;
    g.fillStyle = r<.5 ? "#c9b89a" : "#b09a7d";
    g.fillRect(x-bw/2, y-bh, bw, bh);
    g.fillStyle="#7a4636";
    g.beginPath(); g.moveTo(x-bw*0.58, y-bh); g.lineTo(x, y-bh-bw*0.34);
    g.lineTo(x+bw*0.58, y-bh); g.closePath(); g.fill();
    g.fillStyle="#4a3a30"; g.fillRect(x-bw*0.1, y-bh*0.62, bw*0.2, bh*0.62);      // door
    g.fillStyle="rgba(255,214,130,.7)"; g.fillRect(x+bw*0.2, y-bh*0.7, bw*0.16, bh*0.3);
    if(r < .4){ g.fillStyle="#8f897b"; g.fillRect(x+bw*0.3, y-bh-bw*0.3, bw*0.1, bw*0.18); }
    break; }
  case "chimney":{                                // factory hall + smokestack
    const bw=(11+r*4)*u, bh=(5+r*1.5)*u;
    g.fillStyle="#6c6a70"; g.fillRect(x-bw/2, y-bh, bw, bh);
    g.fillStyle="#5b595f";                                                        // sawtooth roof
    for(let k=0;k<3;k++){
      const bx = x-bw/2 + bw*k/3;
      g.beginPath(); g.moveTo(bx, y-bh); g.lineTo(bx, y-bh-1.8*u);
      g.lineTo(bx+bw/3, y-bh); g.closePath(); g.fill();
    }
    const sx = x+bw*0.32, sh = (10+r*4)*u;
    g.fillStyle="#7c6a5c"; g.fillRect(sx-0.9*u, y-sh, 1.8*u, sh);
    const tnow = (typeof performance!=="undefined" ? performance.now() : Date.now());
    g.fillStyle="rgba(150,146,140,.4)";
    for(let k=0;k<3;k++){
      const t2 = ((tnow/2600 + r + k*0.33) % 1);
      g.beginPath(); g.arc(sx + t2*4*u, y-sh - t2*7*u, (1+t2*2.4)*u, 0, 7); g.fill();
    }
    break; }
  case "tankfarm":{                               // storage tanks + pipe
    const tw=4.6*u, th3=(6+r*2)*u;
    for(const fx2 of [-0.85, 0.35]){
      const tx = x + fx2*tw;
      g.fillStyle="#8f949c"; g.fillRect(tx-tw/2, y-th3, tw, th3);
      g.fillStyle="#a8adb5";
      g.beginPath(); g.ellipse(tx, y-th3, tw/2, 1.1*u, 0, Math.PI, 0); g.fill();
      g.strokeStyle="#6d7178"; g.lineWidth=Math.max(1, 0.4*u);
      g.beginPath(); g.moveTo(tx-tw/2, y-th3*0.5); g.lineTo(tx+tw/2, y-th3*0.5); g.stroke();
    }
    g.strokeStyle="#6d7178"; g.lineWidth=Math.max(1, 0.6*u);
    g.beginPath(); g.moveTo(x-tw*1.3, y-1.4*u); g.lineTo(x+tw*0.9, y-1.4*u); g.stroke();
    break; }
  case "palm":{                                   // leaning palm
    const th3=(8+r*4)*u, lean=(r-0.5)*4*u;
    g.strokeStyle="#6a5638"; g.lineWidth=Math.max(1, 1.1*u); g.lineCap="round";
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x+lean*0.4, y-th3*0.6, x+lean, y-th3); g.stroke();
    const cx2 = x+lean, cy2 = y-th3;
    g.strokeStyle="#3f6b35"; g.lineWidth=Math.max(1, 0.9*u);
    for(let k=0;k<6;k++){
      const a2 = -Math.PI*0.15 - k*(Math.PI*0.7/5) + (r-0.5)*0.3;
      g.beginPath(); g.moveTo(cx2, cy2);
      g.quadraticCurveTo(cx2+Math.cos(a2)*4.4*u, cy2+Math.sin(a2)*4.4*u - 1.2*u,
                         cx2+Math.cos(a2)*6.4*u, cy2+Math.sin(a2)*6.4*u + 1.6*u);
      g.stroke();
    }
    g.fillStyle="#5a4a2c";
    g.beginPath(); g.arc(cx2-0.7*u, cy2+0.6*u, 0.55*u, 0, 7); g.arc(cx2+0.7*u, cy2+0.7*u, 0.55*u, 0, 7); g.fill();
    break; }
  case "bale":{                                   // round hay bale
    const bw=2.6*u;
    g.fillStyle="#c9a94f"; g.beginPath(); g.arc(x, y-bw, bw, 0, 7); g.fill();
    g.strokeStyle="#a3853a"; g.lineWidth=Math.max(1, 0.4*u);
    g.beginPath(); g.arc(x, y-bw, bw*0.6, 0, 7); g.stroke();
    break; }
  case "camptent":{                               // little dome tent
    const tw=(4.5+r)*u, th3=(2.6+r*0.6)*u;
    g.fillStyle = r<.33 ? "#b0552f" : r<.66 ? "#3f6b8a" : "#4c7d46";
    g.beginPath(); g.moveTo(x-tw/2, y); g.quadraticCurveTo(x, y-th3*1.8, x+tw/2, y); g.closePath(); g.fill();
    g.fillStyle="rgba(20,16,22,.7)";
    g.beginPath(); g.moveTo(x-tw*0.14, y); g.quadraticCurveTo(x, y-th3*0.9, x+tw*0.14, y); g.closePath(); g.fill();
    break; }
  case "campervan":{                              // campervan
    const w=8*u, hgt=3.6*u;
    g.fillStyle="#e9e2d1"; rr(g, x-w/2, y-hgt, w, hgt, 0.9*u);
    g.fillStyle = r<.5 ? "#c8664a" : "#5f8a8c";
    g.fillRect(x-w/2, y-hgt*0.5, w, hgt*0.22);
    g.fillStyle="#9fb6c9"; g.fillRect(x-w*0.34, y-hgt*0.9, w*0.26, hgt*0.3);
    g.fillRect(x+w*0.1, y-hgt*0.9, w*0.2, hgt*0.3);
    g.fillStyle="#141117";
    g.beginPath(); g.arc(x-w*0.28, y, 0.7*u, 0, 7); g.arc(x+w*0.28, y, 0.7*u, 0, 7); g.fill();
    break; }
  case "fire":{                                   // campfire, flickering
    const tnow = (typeof performance!=="undefined" ? performance.now() : Date.now());
    const fl = 0.8 + 0.3*Math.sin(tnow/110 + r*20);
    const gl = g.createRadialGradient(x, y-1*u, 0.3*u, x, y-1*u, 4.5*u);
    gl.addColorStop(0,"rgba(255,170,80,.55)"); gl.addColorStop(1,"rgba(255,170,80,0)");
    g.fillStyle=gl; g.beginPath(); g.arc(x, y-1*u, 4.5*u, 0, 7); g.fill();
    g.strokeStyle="#4a3626"; g.lineWidth=Math.max(1, 0.6*u);
    g.beginPath(); g.moveTo(x-1.4*u, y); g.lineTo(x+1.4*u, y-0.5*u);
    g.moveTo(x-1.3*u, y-0.5*u); g.lineTo(x+1.3*u, y); g.stroke();
    g.fillStyle="#ffb45a";
    g.beginPath(); g.moveTo(x-1*u, y); g.quadraticCurveTo(x-0.3*u, y-2.4*u*fl, x, y-2.9*u*fl);
    g.quadraticCurveTo(x+0.4*u, y-2*u*fl, x+1*u, y); g.closePath(); g.fill();
    g.fillStyle="#ffe08a";
    g.beginPath(); g.moveTo(x-0.5*u, y); g.quadraticCurveTo(x, y-1.6*u*fl, x+0.5*u, y); g.closePath(); g.fill();
    break; }
  case "bigtop":{                                 // striped circus tent
    const tw=(11+r*3)*u, th3=(6+r*2)*u;
    g.fillStyle="#c8564a";
    g.beginPath(); g.moveTo(x-tw/2, y); g.lineTo(x-tw*0.32, y-th3*0.66); g.lineTo(x+tw*0.32, y-th3*0.66);
    g.lineTo(x+tw/2, y); g.closePath(); g.fill();
    g.fillStyle="#efe6d4";
    for(let k=-2;k<=2;k+=2){
      g.beginPath(); g.moveTo(x+k*tw*0.17, y); g.lineTo(x+k*tw*0.1, y-th3*0.66);
      g.lineTo(x+(k*0.1+0.09)*tw, y-th3*0.66); g.lineTo(x+(k*0.17+0.12)*tw, y); g.closePath(); g.fill();
    }
    g.fillStyle="#c8564a";
    g.beginPath(); g.moveTo(x-tw*0.34, y-th3*0.64); g.lineTo(x, y-th3*1.1);
    g.lineTo(x+tw*0.34, y-th3*0.64); g.closePath(); g.fill();
    g.strokeStyle="#8a8577"; g.beginPath(); g.moveTo(x, y-th3*1.1); g.lineTo(x, y-th3*1.32); g.stroke();
    g.fillStyle="#d8c23a";
    g.beginPath(); g.moveTo(x, y-th3*1.32); g.lineTo(x+2.6*u, y-th3*1.26); g.lineTo(x, y-th3*1.2);
    g.closePath(); g.fill();
    break; }
  case "ferris":{                                 // big wheel, slowly turning
    const R2=(7+r*2)*u, cy2=y-R2-2.5*u;
    const tnow = (typeof performance!=="undefined" ? performance.now() : Date.now());
    const a0 = tnow/4200 + r*7;
    g.strokeStyle="#8a8f98"; g.lineWidth=Math.max(1, 0.8*u);
    g.beginPath(); g.moveTo(x-R2*0.5, y); g.lineTo(x, cy2); g.lineTo(x+R2*0.5, y); g.stroke();
    g.strokeStyle="#aab0ba"; g.lineWidth=Math.max(1, 0.6*u);
    g.beginPath(); g.arc(x, cy2, R2, 0, 7); g.stroke();
    const cols=["#c8564a","#d8c23a","#5f8a8c","#8a5cf6","#4c7d46","#e08a3c"];
    for(let k=0;k<8;k++){
      const a2 = a0 + k*Math.PI/4;
      const sx = x+Math.cos(a2)*R2, sy = cy2+Math.sin(a2)*R2;
      g.beginPath(); g.moveTo(x, cy2); g.lineTo(sx, sy); g.stroke();
      g.fillStyle=cols[k%cols.length];
      g.fillRect(sx-0.9*u, sy, 1.8*u, 1.4*u);
    }
    break; }
  case "turbine":{                                // wind turbine, blades turning
    const th3=(14+r*4)*u;
    const tnow = (typeof performance!=="undefined" ? performance.now() : Date.now());
    const a0 = tnow/1400 + r*9;
    g.strokeStyle="#d8dde3"; g.lineWidth=Math.max(1, 1.0*u); g.lineCap="round";
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y-th3); g.stroke();
    g.fillStyle="#c3c9d0"; g.fillRect(x-1.1*u, y-th3-0.8*u, 2.2*u, 1.6*u);
    g.strokeStyle="#e9edf2"; g.lineWidth=Math.max(1, 0.8*u);
    for(let k=0;k<3;k++){
      const a2 = a0 + k*Math.PI*2/3;
      g.beginPath(); g.moveTo(x, y-th3);
      g.lineTo(x+Math.cos(a2)*6.5*u, y-th3+Math.sin(a2)*6.5*u); g.stroke();
    }
    break; }
  case "lighth":{                                 // banded lighthouse
    const th3=(13+r*3)*u, bw=3.4*u;
    for(let k=0;k<4;k++){
      g.fillStyle = k%2 ? "#c8322c" : "#efe6d4";
      const y1 = y - th3*(k+1)/4, hh = th3/4;
      const w1 = bw*(1 - k*0.09), w0 = bw*(1 - (k+1)*0.09);
      g.beginPath(); g.moveTo(x-w1/2, y1+hh); g.lineTo(x+w1/2, y1+hh);
      g.lineTo(x+w0/2, y1); g.lineTo(x-w0/2, y1); g.closePath(); g.fill();
    }
    g.fillStyle="#2c3038"; g.fillRect(x-1.3*u, y-th3-1.8*u, 2.6*u, 1.8*u);
    const gl = g.createRadialGradient(x, y-th3-0.9*u, 0.3*u, x, y-th3-0.9*u, 4*u);
    gl.addColorStop(0,"rgba(255,236,170,.9)"); gl.addColorStop(1,"rgba(255,236,170,0)");
    g.fillStyle=gl; g.beginPath(); g.arc(x, y-th3-0.9*u, 4*u, 0, 7); g.fill();
    break; }
  case "crane":{                                  // harbour gantry crane
    const th3=(11+r*3)*u, jib=(9+r*3)*u;
    g.strokeStyle="#b0762f"; g.lineWidth=Math.max(1, 1.0*u); g.lineCap="round";
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y-th3); g.stroke();
    g.beginPath(); g.moveTo(x-jib*0.35, y-th3); g.lineTo(x+jib*0.65, y-th3); g.stroke();
    g.strokeStyle="#8a6a2c"; g.lineWidth=Math.max(1, 0.45*u);
    g.beginPath(); g.moveTo(x, y-th3-2*u); g.lineTo(x+jib*0.6, y-th3);
    g.moveTo(x, y-th3-2*u); g.lineTo(x-jib*0.3, y-th3); g.stroke();
    g.beginPath(); g.moveTo(x+jib*0.5, y-th3); g.lineTo(x+jib*0.5, y-th3*0.45); g.stroke();
    g.fillStyle="#5f7d8a"; g.fillRect(x+jib*0.5-1.2*u, y-th3*0.45, 2.4*u, 1.5*u);   // hanging box
    g.fillStyle="#8f949c"; g.fillRect(x-1.6*u, y-th3, 1.6*u, 1.6*u);                // counterweight
    break; }
  case "containers":{                             // container stack
    const cw=6*u, ch=2.2*u;
    const cols=["#8a2f2a","#2f4e8a","#3c5a34","#b0762f","#5a5a62"];
    for(let row=0; row<2; row++) for(let col=0; col<2; col++){
      if(row===1 && col===1 && r<0.5) continue;
      g.fillStyle=cols[(hsh(r*23 + row*3 + col)*cols.length)|0];
      const bx = x - cw + col*cw + row*cw*0.15, by = y - ch*(row+1);
      g.fillRect(bx, by, cw-0.4*u, ch-0.25*u);
      g.strokeStyle="rgba(0,0,0,.25)"; g.lineWidth=Math.max(1, 0.3*u);
      for(let k=1;k<4;k++){ g.beginPath(); g.moveTo(bx+(cw-0.4*u)*k/4, by);
        g.lineTo(bx+(cw-0.4*u)*k/4, by+ch-0.25*u); g.stroke(); }
    }
    break; }
  case "parasol":{                                // beach umbrella + towel
    const ph=(3.6+r)*u;
    g.strokeStyle="#8a8577"; g.lineWidth=Math.max(1, 0.5*u);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y-ph); g.stroke();
    g.fillStyle = r<.5 ? "#c8564a" : "#3f7d8c";
    g.beginPath(); g.moveTo(x-3*u, y-ph); g.quadraticCurveTo(x, y-ph-2.6*u, x+3*u, y-ph); g.closePath(); g.fill();
    g.fillStyle="#efe6d4";
    g.beginPath(); g.moveTo(x-2.1*u, y-ph-0.2*u); g.quadraticCurveTo(x-0.7*u, y-ph-2.2*u, x, y-ph-2.35*u);
    g.lineTo(x-1*u, y-ph); g.closePath(); g.fill();
    g.fillStyle = r<.5 ? "#d8c23a" : "#c95f8a";
    g.fillRect(x+1.5*u, y-0.6*u, 3*u, 0.9*u);
    break; }
  case "boat":{                                   // little sailboat out on the water
    const bw=5*u;
    g.fillStyle="#6a4a34";
    g.beginPath(); g.moveTo(x-bw/2, y-1*u); g.lineTo(x+bw/2, y-1*u);
    g.lineTo(x+bw*0.32, y); g.lineTo(x-bw*0.32, y); g.closePath(); g.fill();
    g.strokeStyle="#4a3626"; g.lineWidth=Math.max(1, 0.4*u);
    g.beginPath(); g.moveTo(x, y-1*u); g.lineTo(x, y-5.4*u); g.stroke();
    g.fillStyle="#efe9dd";
    g.beginPath(); g.moveTo(x+0.3*u, y-5.2*u); g.lineTo(x+2.6*u, y-1.4*u);
    g.lineTo(x+0.3*u, y-1.4*u); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x-0.3*u, y-4.6*u); g.lineTo(x-2*u, y-1.4*u);
    g.lineTo(x-0.3*u, y-1.4*u); g.closePath(); g.fill();
    break; }

  /* ---- destination-terrain props ---- */
  case "cypress":{                                // tall dark Tuscan cypress
    const th=(9+r*6)*u, cw=(1.6+r*0.8)*u;
    g.strokeStyle="#3a2c1c"; g.lineWidth=Math.max(1, 0.7*u);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y-1.4*u); g.stroke();
    g.fillStyle = r<.5 ? "#20331e" : "#283e24";
    g.beginPath(); g.moveTo(x-cw, y-1*u);
    g.quadraticCurveTo(x-cw*1.1, y-th*0.55, x, y-th);
    g.quadraticCurveTo(x+cw*1.1, y-th*0.55, x+cw, y-1*u);
    g.closePath(); g.fill();
    break; }
  case "olive":{                                  // gnarled silvery olive tree
    const th=(3.2+r*1.4)*u, cw=(4.5+r*2)*u;
    g.strokeStyle="#5a4a34"; g.lineWidth=Math.max(1, 1.1*u); g.lineCap="round";
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x+(r-.5)*2*u, y-th*0.6, x+(r-.5)*u, y-th); g.stroke();
    g.fillStyle = r<.5 ? "#6a7a58" : "#78886a";
    g.beginPath(); g.arc(x, y-th-cw*0.4, cw*0.6, 0, 7);
    g.arc(x-cw*0.4, y-th-cw*0.18, cw*0.42, 0, 7);
    g.arc(x+cw*0.42, y-th-cw*0.22, cw*0.44, 0, 7); g.fill();
    break; }
  case "villa":{                                  // ochre villa, terracotta roof
    const bw=(9+r*3)*u, bh=(4.5+r*1.5)*u;
    g.fillStyle = r<.5 ? "#c9a06a" : "#b8926a";
    g.fillRect(x-bw/2, y-bh, bw, bh);
    g.fillStyle="#a05038";
    g.beginPath(); g.moveTo(x-bw/2-1*u, y-bh); g.lineTo(x+bw/2+1*u, y-bh);
    g.lineTo(x+bw/2-1.5*u, y-bh-2.4*u); g.lineTo(x-bw/2+1.5*u, y-bh-2.4*u);
    g.closePath(); g.fill();
    g.fillStyle="rgba(255,220,150,.8)";
    g.fillRect(x-bw*0.3, y-bh*0.7, 1.1*u, 1.4*u);
    g.fillRect(x+bw*0.18, y-bh*0.7, 1.1*u, 1.4*u);
    if(r>0.55){ g.fillStyle="#20331e";             // a cypress by the gate
      g.beginPath(); g.moveTo(x+bw/2+1.6*u, y);
      g.quadraticCurveTo(x+bw/2+0.9*u, y-3.5*u, x+bw/2+1.9*u, y-6.5*u);
      g.quadraticCurveTo(x+bw/2+2.9*u, y-3.5*u, x+bw/2+2.2*u, y);
      g.closePath(); g.fill(); }
    break; }
  case "halftimber":{                             // half-timbered medieval house
    const bw=(7+r*2.5)*u, bh=(5+r*1.5)*u;
    g.fillStyle="#e6dcc4"; g.fillRect(x-bw/2, y-bh, bw, bh);
    g.strokeStyle="#4a3624"; g.lineWidth=Math.max(1, 0.5*u);
    g.strokeRect(x-bw/2, y-bh, bw, bh);
    g.beginPath();                                 // timber X-bracing
    g.moveTo(x-bw/2, y-bh); g.lineTo(x, y-bh/2); g.lineTo(x-bw/2, y);
    g.moveTo(x+bw/2, y-bh); g.lineTo(x, y-bh/2); g.lineTo(x+bw/2, y);
    g.moveTo(x-bw/2, y-bh/2); g.lineTo(x+bw/2, y-bh/2); g.stroke();
    g.fillStyle="#6a4432";                         // steep thatched roof
    g.beginPath(); g.moveTo(x-bw/2-0.8*u, y-bh); g.lineTo(x+bw/2+0.8*u, y-bh);
    g.lineTo(x, y-bh-3.6*u); g.closePath(); g.fill();
    break; }
  case "keep":{                                   // stone castle tower
    const tw=(4.5+r*1.5)*u, th=(10+r*5)*u;
    g.fillStyle = r<.5 ? "#7a7268" : "#867e72";
    g.fillRect(x-tw/2, y-th, tw, th);
    for(let m=0;m<3;m++)                           // crenellations
      g.fillRect(x-tw/2 + m*(tw/2.6), y-th-1.4*u, tw/4.2, 1.4*u);
    g.fillStyle="#2a2420";                         // arrow slits
    g.fillRect(x-0.4*u, y-th*0.75, 0.8*u, 1.8*u);
    g.fillRect(x-0.4*u, y-th*0.4,  0.8*u, 1.8*u);
    if(r>0.5){ g.strokeStyle="#8a2c2c"; g.lineWidth=Math.max(1,0.5*u);
      g.beginPath(); g.moveTo(x, y-th-1.4*u); g.lineTo(x, y-th-4*u); g.stroke();
      g.fillStyle="#c94a3a";                       // pennant
      g.beginPath(); g.moveTo(x, y-th-4*u); g.lineTo(x+2.4*u, y-th-3.3*u);
      g.lineTo(x, y-th-2.7*u); g.closePath(); g.fill(); }
    break; }
  case "deco":{                                   // pastel art-deco block, neon trim
    const bw=(7+r*3)*u, bh=(9+r*6)*u;
    g.fillStyle = r<.33 ? "#e8c8d8" : r<.66 ? "#bfe4dc" : "#e8dfc0";
    g.fillRect(x-bw/2, y-bh, bw, bh);
    g.beginPath(); g.arc(x, y-bh, bw*0.32, Math.PI, 0); g.fill();
    g.strokeStyle="#ff5fa2"; g.lineWidth=Math.max(1, 0.5*u);
    g.beginPath(); g.moveTo(x-bw/2, y-bh+0.8*u); g.lineTo(x+bw/2, y-bh+0.8*u); g.stroke();
    g.fillStyle="rgba(120,240,255,.8)";
    for(let wy=0; wy<3; wy++) for(let wx=0; wx<2; wx++)
      if(hsh(r*97 + wy*3.1 + wx) > 0.35)
        g.fillRect(x-bw*0.32 + wx*bw*0.42, y-bh+2*u+wy*2.2*u, 1.2*u, 1.4*u);
    break; }
  case "column":{                                 // marble column, often broken
    const ch=(4+r*5)*u, cw=1.5*u;
    g.fillStyle="#c9c2b0";
    g.fillRect(x-cw/2, y-ch, cw, ch);
    g.fillRect(x-cw*0.85, y-ch, cw*1.7, 0.7*u);    // capital / broken lip
    g.fillRect(x-cw*0.85, y-0.7*u, cw*1.7, 0.7*u); // base
    g.strokeStyle="#a8a08c"; g.lineWidth=Math.max(1, 0.25*u);
    g.beginPath(); g.moveTo(x-cw*0.2, y-ch); g.lineTo(x-cw*0.2, y);
    g.moveTo(x+cw*0.2, y-ch); g.lineTo(x+cw*0.2, y); g.stroke();
    if(r>0.6){ g.fillStyle="#c9c2b0";              // toppled drum lying beside
      g.beginPath(); g.ellipse(x+3*u, y-0.6*u, 1.7*u, 0.7*u, 0, 0, 7); g.fill(); }
    break; }
  case "ruinarch":{                               // freestanding ruined arch
    const aw=(6+r*2)*u, ah=(6+r*2)*u;
    g.fillStyle="#b8b09a";
    g.fillRect(x-aw/2, y-ah, 1.6*u, ah);
    g.fillRect(x+aw/2-1.6*u, y-ah, 1.6*u, ah);
    g.beginPath(); g.moveTo(x-aw/2, y-ah);
    g.quadraticCurveTo(x, y-ah-2.6*u, x+aw/2, y-ah);
    g.lineTo(x+aw/2-1.6*u, y-ah);
    g.quadraticCurveTo(x, y-ah-1.2*u, x-aw/2+1.6*u, y-ah);
    g.closePath(); g.fill();
    break; }
  case "umbpine":{                                // Italian stone pine (umbrella crown)
    const th=(7+r*3)*u, cw=(6+r*2.5)*u;
    g.strokeStyle="#4a3624"; g.lineWidth=Math.max(1, 1*u); g.lineCap="round";
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x+(r-.5)*3*u, y-th*0.55, x+(r-.5)*1.5*u, y-th); g.stroke();
    g.fillStyle = r<.5 ? "#2e4626" : "#38522c";
    g.beginPath(); g.ellipse(x+(r-.5)*1.5*u, y-th-1*u, cw, 1.9*u, 0, 0, 7); g.fill();
    break; }
  case "cherry":{                                 // blossoming sakura
    const th=(4.5+r*2)*u, cw=(5+r*2.5)*u;
    g.strokeStyle="#4a3630"; g.lineWidth=Math.max(1, 1*u); g.lineCap="round";
    g.beginPath(); g.moveTo(x, y); g.lineTo(x+(r-.5)*2*u, y-th); g.stroke();
    g.fillStyle = r<.5 ? "#e8a8c8" : "#f0bcd4";
    g.beginPath(); g.arc(x+(r-.5)*2*u, y-th-cw*0.42, cw*0.62, 0, 7);
    g.arc(x+(r-.5)*2*u - cw*0.42, y-th-cw*0.18, cw*0.4, 0, 7);
    g.arc(x+(r-.5)*2*u + cw*0.44, y-th-cw*0.2, cw*0.44, 0, 7); g.fill();
    g.fillStyle="rgba(240,200,220,.7)";            // fallen petals
    for(let k=0;k<4;k++) g.fillRect(x+(hsh(r*31+k)-.5)*cw*1.6, y-0.4*u*hsh(r*17+k), 0.5*u, 0.35*u);
    break; }
  case "torii":{                                  // vermilion torii gate
    const gw=(5.5+r*1.5)*u, gh=(6+r*1.5)*u;
    g.strokeStyle="#c93a2c"; g.lineWidth=Math.max(1, 1*u); g.lineCap="butt";
    g.beginPath();
    g.moveTo(x-gw/2, y); g.lineTo(x-gw/2*0.88, y-gh);
    g.moveTo(x+gw/2, y); g.lineTo(x+gw/2*0.88, y-gh); g.stroke();
    g.fillStyle="#c93a2c";
    g.fillRect(x-gw*0.42, y-gh*0.72, gw*0.84, 0.8*u);  // nuki beam
    g.beginPath();                                 // curved kasagi lintel
    g.moveTo(x-gw*0.62, y-gh-0.2*u);
    g.quadraticCurveTo(x, y-gh-1.4*u, x+gw*0.62, y-gh-0.2*u);
    g.lineTo(x+gw*0.62, y-gh+0.9*u);
    g.quadraticCurveTo(x, y-gh-0.3*u, x-gw*0.62, y-gh+0.9*u);
    g.closePath(); g.fill();
    break; }
  case "pagoda":{                                 // three-tier pagoda
    const bw=(6+r*2)*u;
    g.fillStyle="#8a3a30";
    let ty=y, tw=bw;
    for(let t=0;t<3;t++){
      g.fillStyle="#5a4438";
      g.fillRect(x-tw*0.3, ty-2*u, tw*0.6, 2*u);   // storey
      g.fillStyle="#8a3a30";
      g.beginPath();                                // flared roof
      g.moveTo(x-tw/2, ty-2*u);
      g.quadraticCurveTo(x, ty-3.4*u, x+tw/2, ty-2*u);
      g.lineTo(x+tw*0.34, ty-3*u); g.lineTo(x-tw*0.34, ty-3*u);
      g.closePath(); g.fill();
      ty -= 3*u; tw *= 0.78;
    }
    g.strokeStyle="#c9a24a"; g.lineWidth=Math.max(1,0.4*u);
    g.beginPath(); g.moveTo(x, ty); g.lineTo(x, ty-1.6*u); g.stroke();
    break; }
  case "windmill":{                               // La Mancha windmill, sails turning
    const th=(7+r*2)*u;
    g.fillStyle="#e8e2d2";
    g.beginPath(); g.moveTo(x-2.4*u, y); g.lineTo(x-1.7*u, y-th);
    g.lineTo(x+1.7*u, y-th); g.lineTo(x+2.4*u, y); g.closePath(); g.fill();
    g.fillStyle="#5a4434";
    g.beginPath(); g.arc(x, y-th, 1.9*u, Math.PI, 0); g.fill();
    const spin = (typeof performance!=="undefined" ? performance.now() : 0)/2400 + r*7;
    g.strokeStyle="#6a5a44"; g.lineWidth=Math.max(1, 0.55*u);
    for(let s=0;s<4;s++){
      const a = spin + s*Math.PI/2;
      g.beginPath(); g.moveTo(x, y-th);
      g.lineTo(x+Math.cos(a)*4.6*u, y-th+Math.sin(a)*4.6*u); g.stroke();
    }
    break; }
  case "casa":{                                   // whitewashed Andalusian house
    const bw=(7+r*2.5)*u, bh=(4+r*1.2)*u;
    g.fillStyle="#f0ece0"; g.fillRect(x-bw/2, y-bh, bw, bh);
    g.fillStyle="#b05838";                         // shallow terracotta roof
    g.beginPath(); g.moveTo(x-bw/2-0.7*u, y-bh); g.lineTo(x+bw/2+0.7*u, y-bh);
    g.lineTo(x+bw/2-1*u, y-bh-1.6*u); g.lineTo(x-bw/2+1*u, y-bh-1.6*u);
    g.closePath(); g.fill();
    g.fillStyle="#2a5a8a";                         // blue door + shutters
    g.fillRect(x-0.8*u, y-bh*0.62, 1.6*u, bh*0.62);
    g.fillRect(x-bw*0.34, y-bh*0.66, 1.1*u, 1.3*u);
    g.fillRect(x+bw*0.22, y-bh*0.66, 1.1*u, 1.3*u);
    break; }
  }
}

/* rows of tiny spectators — coloured pixel pairs inside a box */
function tsCrowd(g, cx, baseY, w, h, seed, u){
  const cols = ["#e0b46a","#c95f4e","#7ea0c9","#8ec98a","#d9d2bf","#b07ac9","#d98a4e"];
  const n = Math.min(70, Math.max(6, Math.round((w*h)/(2.6*u*u + 2))));
  for(let k=0;k<n;k++){
    g.fillStyle = cols[(hsh(seed + k*5.3)*cols.length)|0];
    g.fillRect(cx + (hsh(seed + k*1.7) - 0.5)*w,
               baseY - hsh(seed + k*3.1)*h,
               Math.max(1, 0.55*u), Math.max(1, 0.8*u));
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
    const row = { d, sp: cam.total + d, hz, L, R, Lk, Rk, Lg, Rg };
    /* tunnel shell: wall foot, wall head and the crown of the arch. Only
       worth projecting where there actually is a tunnel. */
    if(FT.tunnel.size && tunnelAt(cam.total + d)){
      row.tun  = true;
      row.Lwf  = P.proj(q.x - q.nx*TUN_HW, q.y - q.ny*TUN_HW, hz);
      row.Rwf  = P.proj(q.x + q.nx*TUN_HW, q.y + q.ny*TUN_HW, hz);
      row.Lwh  = P.proj(q.x - q.nx*TUN_HW, q.y - q.ny*TUN_HW, hz + TUN_H);
      row.Rwh  = P.proj(q.x + q.nx*TUN_HW, q.y + q.ny*TUN_HW, hz + TUN_H);
      row.Crn  = P.proj(q.x, q.y, hz + TUN_H + TUN_CROWN);
    }
    rows.push(row);
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

  /* =====================================================================
     TUNNEL SHELL — walls and an arched roof built from the same rows as the
     road, so it rides the elevation and banks through corners with it.
     Painted far→near after the tarmac (it must cover the verge and sky) but
     before the props and rivals, so cars inside the bore still read.
     ===================================================================== */
  if(FT.tunnel.size){
    for(let i=rows.length-2; i>=0; i--){
      const a = rows[i], b = rows[i+1];
      if(!a.tun || !b.tun) continue;                // shell only spans tunnel↔tunnel
      if(!a.Lwf || !a.Rwf || !a.Lwh || !a.Rwh || !a.Crn) continue;
      if(!b.Lwf || !b.Rwf || !b.Lwh || !b.Rwh || !b.Crn) continue;
      if(!a.vis && !b.vis) continue;
      const fogT   = fogAt(a.d);
      const stripe = Math.floor(a.sp*2) % 2 === 0;
      /* depth shading: the bore falls away into the dark ahead of you */
      const dk = Math.min(0.72, 0.10 + a.d*0.05);

      /* roof: near rib crown → far rib crown, closed across both wall heads */
      ctx.fillStyle = mixHex(shade("#2b2630", -Math.round(dk*40)), FOGH, fogT*0.35);
      ctx.beginPath();
      ctx.moveTo(a.Lwh.x, a.Lwh.y);
      ctx.quadraticCurveTo((a.Lwh.x+a.Crn.x)/2, a.Crn.y, a.Crn.x, a.Crn.y);
      ctx.quadraticCurveTo((a.Crn.x+a.Rwh.x)/2, a.Crn.y, a.Rwh.x, a.Rwh.y);
      ctx.lineTo(b.Rwh.x, b.Rwh.y);
      ctx.quadraticCurveTo((b.Rwh.x+b.Crn.x)/2, b.Crn.y, b.Crn.x, b.Crn.y);
      ctx.quadraticCurveTo((b.Crn.x+b.Lwh.x)/2, b.Crn.y, b.Lwh.x, b.Lwh.y);
      ctx.closePath(); ctx.fill();

      /* side walls — tiled concrete, the near face catching a little more light */
      ctx.fillStyle = mixHex(stripe ? "#3a3440" : "#332e3a", "#0a0810", dk);
      quad(ctx, a.Lwf, a.Lwh, b.Lwh, b.Lwf);
      ctx.fillStyle = mixHex(stripe ? "#36303c" : "#2f2a36", "#0a0810", dk);
      quad(ctx, a.Rwf, a.Rwh, b.Rwh, b.Rwf);

      /* dirty skirt along the bottom of each wall */
      const skirt = (wf, wh, wf2, wh2) => {
        const m  = (p,q,t)=>({x:p.x+(q.x-p.x)*t, y:p.y+(q.y-p.y)*t});
        ctx.fillStyle = `rgba(12,10,16,${(0.34*(1-fogT)).toFixed(3)})`;
        quad(ctx, wf, m(wf,wh,0.22), m(wf2,wh2,0.22), wf2);
      };
      skirt(a.Lwf, a.Lwh, b.Lwf, b.Lwh);
      skirt(a.Rwf, a.Rwh, b.Rwf, b.Rwh);

      /* service lights strung along the crown, one every other space */
      if(Math.floor(a.sp) % 2 === 0 && (a.sp % 1) < STEP*1.2 && a.Crn){
        const s = a.Crn.s, gw = Math.max(2, 10*s), gh = Math.max(1, 2.4*s);
        const gy = a.Crn.y + 2.5*s;
        const gl = ctx.createRadialGradient(a.Crn.x, gy, 0, a.Crn.x, gy, gw*2.6);
        gl.addColorStop(0, `rgba(255,226,158,${(0.55*(1-fogT)).toFixed(3)})`);
        gl.addColorStop(1, "rgba(255,226,158,0)");
        ctx.fillStyle = gl;
        ctx.beginPath(); ctx.arc(a.Crn.x, gy, gw*2.6, 0, 7); ctx.fill();
        ctx.fillStyle = `rgba(255,240,206,${(0.9*(1-fogT)).toFixed(3)})`;
        ctx.fillRect(a.Crn.x - gw/2, gy - gh/2, gw, gh);
        /* the pool it throws on the tarmac below */
        if(a.L && a.R){
          const cx = (a.L.x+a.R.x)/2, cy = (a.L.y+a.R.y)/2;
          const rw = Math.max(1, Math.abs(a.R.x-a.L.x)*0.5);
          const pg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rw);
          pg.addColorStop(0, `rgba(255,226,158,${(0.13*(1-fogT)).toFixed(3)})`);
          pg.addColorStop(1, "rgba(255,226,158,0)");
          ctx.fillStyle = pg;
          ctx.beginPath(); ctx.ellipse(cx, cy, rw, rw*0.32, 0, 0, 7); ctx.fill();
        }
      }
    }

    /* ----- portal: the arch face where the tunnel starts ahead of you -----
       find the first row that flips out-of-tunnel → in-tunnel */
    for(let i=0; i<rows.length-1; i++){
      const a = rows[i], b = rows[i+1];
      if(a.tun || !b.tun) continue;                 // want the mouth, not the bore
      if(!b.Lwf || !b.Rwf || !b.Lwh || !b.Rwh || !b.Crn) break;
      const fogT = fogAt(b.d), s = b.Crn.s;
      withClip(b.d, ()=>{
        ctx.save();
        ctx.globalAlpha *= Math.max(0.05, 1 - fogT*0.8);
        /* the headwall: a big slab with the bore punched out of it.
           Two separate subpaths + evenodd = a real hole. */
        const pad = Math.max(6, 26*s), top = b.Crn.y - Math.max(8, 30*s);
        ctx.fillStyle = mixHex("#453d4a", FOGH, fogT*0.5);
        ctx.beginPath();
        ctx.moveTo(b.Lwf.x - pad, b.Lwf.y);         // subpath 1 — the slab
        ctx.lineTo(b.Lwf.x - pad, top);
        ctx.lineTo(b.Rwf.x + pad, top);
        ctx.lineTo(b.Rwf.x + pad, b.Rwf.y);
        ctx.closePath();
        ctx.moveTo(b.Lwf.x, b.Lwf.y);               // subpath 2 — the bore
        ctx.lineTo(b.Lwh.x, b.Lwh.y);
        ctx.quadraticCurveTo((b.Lwh.x+b.Crn.x)/2, b.Crn.y, b.Crn.x, b.Crn.y);
        ctx.quadraticCurveTo((b.Crn.x+b.Rwh.x)/2, b.Crn.y, b.Rwh.x, b.Rwh.y);
        ctx.lineTo(b.Rwf.x, b.Rwf.y);
        ctx.closePath();
        ctx.fill("evenodd");
        /* rim highlight round the bore */
        ctx.strokeStyle = `rgba(232,222,200,.35)`; ctx.lineWidth = Math.max(1, 1.6*s);
        ctx.beginPath();
        ctx.moveTo(b.Lwf.x, b.Lwf.y); ctx.lineTo(b.Lwh.x, b.Lwh.y);
        ctx.quadraticCurveTo((b.Lwh.x+b.Crn.x)/2, b.Crn.y, b.Crn.x, b.Crn.y);
        ctx.quadraticCurveTo((b.Crn.x+b.Rwh.x)/2, b.Crn.y, b.Rwh.x, b.Rwh.y);
        ctx.lineTo(b.Rwf.x, b.Rwf.y); ctx.stroke();
        /* the dark inside the mouth, so it reads as a hole not a painting */
        ctx.fillStyle = "rgba(10,8,14,.55)";
        ctx.beginPath();
        ctx.moveTo(b.Lwf.x, b.Lwf.y); ctx.lineTo(b.Lwh.x, b.Lwh.y);
        ctx.quadraticCurveTo((b.Lwh.x+b.Crn.x)/2, b.Crn.y, b.Crn.x, b.Crn.y);
        ctx.quadraticCurveTo((b.Crn.x+b.Rwh.x)/2, b.Crn.y, b.Rwh.x, b.Rwh.y);
        ctx.lineTo(b.Rwf.x, b.Rwf.y); ctx.closePath(); ctx.fill();
        ctx.restore();
      });
      break;
    }

    /* ----- exit: daylight at the far end while you're inside ----- */
    if(FT.tunnel.has(camSp)){
      for(let i=0; i<rows.length-1; i++){
        const a = rows[i], b = rows[i+1];
        if(!a.tun || b.tun) continue;               // last tunnel row before open air
        if(!a.Lwh || !a.Rwh || !a.Crn || !a.Lwf || !a.Rwf) break;
        const cx = (a.Lwf.x + a.Rwf.x)/2, cy = (a.Crn.y + a.Lwf.y)/2;
        const rr2 = Math.max(6, Math.abs(a.Rwf.x - a.Lwf.x)*0.75);
        const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr2);
        gg.addColorStop(0, "rgba(236,242,255,.92)");
        gg.addColorStop(0.55, "rgba(210,224,248,.45)");
        gg.addColorStop(1, "rgba(210,224,248,0)");
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(cx, cy, rr2, 0, 7); ctx.fill();
        break;
      }
    }
  }

  /* ----- trackside props (world-space scenery, sorted far→near) ----- */
  const PB = propCache().bySp;
  if(PB && PB.size){
    const plist = [];
    for(let k=1; k<=VIEW_SPACES; k++){
      const spIdx = Math.floor(cam.total) + k;
      const spP = ((phys(spIdx))%S+S)%S;
      if(FT.tunnel.has(spP)) continue;            // buried — nothing grows in the bore
      const arr = PB.get(spP); if(!arr) continue;
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

  /* ----- tunnel interior ambience -----
     The shell itself is real geometry now (drawn back with the road), so this
     is only the light: a cold vignette pressing in from the edges and a
     warm bounce off the walls. Fades in over the first space so the mouth
     doesn't snap. */
  {
    const tNow = FT.tunnel.has(camSp);
    const tPrev = FT.tunnel.has(((phys(Math.floor(cam.total)-1))%S+S)%S);
    /* 0→1 across the entry space, then held while you're inside */
    let tIn = tNow ? (tPrev ? 1 : Math.min(1, (cam.total % 1) * 2.2)) : 0;
    FP._tun = FP._tun == null ? tIn : FP._tun + (tIn - FP._tun)*Math.min(1, dt*7);
    const k = FP._tun;
    if(k > 0.01){
      const vg = ctx.createRadialGradient(W/2, H*0.46, Math.min(W,H)*0.16,
                                          W/2, H*0.46, Math.max(W,H)*0.72);
      vg.addColorStop(0, "rgba(8,6,12,0)");
      vg.addColorStop(1, `rgba(6,5,10,${(0.72*k).toFixed(3)})`);
      ctx.fillStyle = vg; ctx.fillRect(0,0,W,H);
      /* sodium bounce off the walls, strongest low and to the sides */
      ctx.fillStyle = `rgba(255,206,132,${(0.05*k).toFixed(3)})`;
      ctx.fillRect(0, P.horizon, W, H-P.horizon);
    }
  }

  if(inWSec && !FT.tunnel.has(camSp)) drawWeatherFX(WX, P, dt, now);   // no rain under a roof

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
  /* Phase 7: the minimap slot is now the LIVE board SVG shrunk into a
     translucent PiP pane (see pipIn). The canvas just paints a backing
     plate beneath it; the old drawn minimap survives only as a fallback
     for pages without a #tracksvg. */
  if(PIP.on && svgEl) drawPipBacking();
  else if(!svgEl)     drawMinimap(p, LAND);
}

function drawPipBacking(){
  const r = PIP.r || pipRect();
  ctx.save();
  ctx.globalAlpha = .9;
  ctx.fillStyle = "rgba(13,10,19,.62)";
  rr(ctx, r.x-6, r.y-6, r.w+12, r.h+12, 10);
  ctx.strokeStyle = THEME.deep; ctx.lineWidth = 1.5;
  ctx.strokeRect(r.x-6, r.y-6, r.w+12, r.h+12);
  ctx.restore();
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

/* ---------- watcher loop ----------
   Phase 7: the cockpit is a persistent VIEW, not just a motion overlay.
   Whenever it is enabled and there is a human car on a traced track —
   idle, mid-turn, watching bots, or inside a race replay — the
   windshield is up. Tapping the road snoozes it until the next stage;
   finishing the race (outside a replay) hands back the board. */
function tick(now){
  requestAnimationFrame(tick);
  const dt = Math.min(.06, Math.max(0, (now - FP.lastT)/1000)); FP.lastT = now;

  const p = safeHuman();
  const rp = replayOn();

  if(rp && FP.enabled && !REDUCED) syncReplayVis();   // mirror the replay

  const raceDone = p && p.finished && !rp;            // replays override "done"
  const wantUp = FP.enabled && !REDUCED && !FP.snooze &&
                 p && !p.isBot && !raceDone;

  if(wantUp){
    if(p._v) resetCamIfFar(p);
    show();
  }else if(FP.active){
    hide();
  }

  if(FP.active && p && p._v) render(dt || 1/60);
}
requestAnimationFrame(tick);

})();
