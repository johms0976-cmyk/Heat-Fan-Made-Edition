/* =====================================================================
   FPVIEW-CHASE — third-person chase camera
   ---------------------------------------------------------------------
   Load BEFORE js/fpview.js (and after js/game.js):

       <script src="js/game.js"></script>
       <script src="js/fpview-chase.js"></script>
       <script src="js/fpview.js"></script>

   What this file owns:
     · window.FPCHASE — the preference object fpview.js reads each frame
     · the Camera row in Settings (Cockpit | Chase, plus a distance pick)
     · the C key, and the on-canvas chip caption

   It owns no drawing. fpview.js reads FPCHASE.on at the top of render()
   and, when it is true:
     · places the eye FPCHASE.dist board-pixels back down the ribbon and
       FPCHASE.up above the road,
     · lets the player's own car fall into the same depth-sorted car list
       the rivals already use, so it is drawn like any other car,
     · skips drawHood() and drawWheel().

   Nothing is removed. Cockpit stays the default and both views are peers,
   switchable mid-race.
   ===================================================================== */
"use strict";
(function(){

const LS = "fpcam.chase.v1";

/* Distances are in the same board-pixel units fpview uses for ROAD_HW (19)
   and CAR_W (15), NOT in spaces — so the framing holds on every circuit
   regardless of how tightly that track's spaces are spaced.

   dist is solved so the car reads at a sensible fraction of view height:
       on-screen car width = CAR_W x focal / dist,  focal = H x 1.05
   near 42 -> ~0.37H · standard 54 -> ~0.29H · far 72 -> ~0.22H          */
const PRESETS = {
  near     : { dist:42, up:7.5, horizon:-6 },
  standard : { dist:54, up:9.0, horizon:-4 },
  far      : { dist:72, up:12,  horizon:0  }
};

const CHASE = window.FPCHASE = {
  on      : false,
  preset  : "standard",
  dist    : PRESETS.standard.dist,
  up      : PRESETS.standard.up,
  horizon : PRESETS.standard.horizon,
  lag     : 5.0,          // chase swings on a touch lazier than the cockpit
  save, setOn, setPreset
};

function load(){
  try{
    const j = JSON.parse(localStorage.getItem(LS));
    if(j && typeof j === "object"){
      if(typeof j.on === "boolean") CHASE.on = j.on;
      if(PRESETS[j.preset]) applyPreset(j.preset);
    }
  }catch(e){}
}
function save(){
  try{ localStorage.setItem(LS, JSON.stringify({ on:CHASE.on, preset:CHASE.preset })); }
  catch(e){}
}
function applyPreset(k){
  const P = PRESETS[k]; if(!P) return;
  CHASE.preset  = k;
  CHASE.dist    = P.dist;
  CHASE.up      = P.up;
  CHASE.horizon = P.horizon;
}
function setOn(v){ CHASE.on = !!v; save(); caption(); }
function setPreset(k){ applyPreset(k); save(); }
load();

/* ------------------------------------------------------- canvas caption */
/* fpview writes the chip once at startup; keep it honest about which
   camera is actually up. Fails silently before the canvas exists. */
function caption(){
  const chip = document.getElementById("fpchip");
  if(!chip) return;
  chip.textContent = CHASE.on
    ? "● chase — tap road to skip · tap map for artwork · ▦ / V board view · C cockpit"
    : "● cockpit — tap road to skip · tap map for artwork · ▦ / V board view · C chase";
}

/* ------------------------------------------------------------ shortcut */
addEventListener("keydown", e => {
  if(e.key !== "c" && e.key !== "C") return;
  if(e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
  setOn(!CHASE.on);
  const seg = document.querySelector("#camSeg");
  if(seg) seg.querySelectorAll("button").forEach(b =>
    b.classList.toggle("sel", (b.dataset.v === "chase") === CHASE.on));
  if(typeof toast === "function")
    toast(CHASE.on ? "Chase camera — third person" : "Cockpit camera — first person");
});

/* ========================================================= SETTINGS ROW */
/* Same shape as the Graphics row in fpview-poly.js: game.js declares
   openSettings() at top level of a classic script, so it is a real global
   and can be wrapped without touching game.js. Reuses .setrow / .seg from
   css/game.css — no new styles. */
function injectRow(){
  const sheet = document.querySelector("#setup .sheet");
  if(!sheet || sheet.querySelector("#camSeg")) return;

  const tag = document.createElement("div");
  tag.className = "tag";
  tag.style.marginTop = "18px";
  tag.textContent = "Camera";

  const row = document.createElement("div");
  row.className = "setrow";
  row.innerHTML =
    '<div class="setrow-top"><span class="setlbl">Point of view</span></div>' +
    '<div class="seg" id="camSeg">' +
      '<button type="button" data-v="cockpit">Cockpit</button>' +
      '<button type="button" data-v="chase">Chase</button>' +
    '</div>' +
    '<div class="phase-hint" style="margin-top:10px">' +
      'Cockpit looks out over the hood and steering wheel. Chase sits behind ' +
      'your car so you can see it and the traffic around it — useful on a ' +
      'phone, where the cockpit eats most of the screen. Press C to swap, ' +
      'even mid-race.' +
    '</div>' +
    '<div class="setrow-top" style="margin-top:14px"><span class="setlbl">Chase distance</span></div>' +
    '<div class="seg" id="camDist">' +
      '<button type="button" data-v="near">Near</button>' +
      '<button type="button" data-v="standard">Standard</button>' +
      '<button type="button" data-v="far">Far</button>' +
    '</div>';

  const anchor = sheet.querySelector(".btnrow");
  if(anchor){ sheet.insertBefore(tag, anchor); sheet.insertBefore(row, anchor); }
  else      { sheet.appendChild(tag); sheet.appendChild(row); }

  const seg  = row.querySelector("#camSeg");
  const dist = row.querySelector("#camDist");
  const paint = () => {
    seg.querySelectorAll("button").forEach(b =>
      b.classList.toggle("sel", (b.dataset.v === "chase") === CHASE.on));
    dist.querySelectorAll("button").forEach(b =>
      b.classList.toggle("sel", b.dataset.v === CHASE.preset));
    dist.style.opacity = CHASE.on ? "" : "0.45";
  };
  seg.querySelectorAll("button").forEach(b => {
    b.onclick = () => { setOn(b.dataset.v === "chase"); paint(); };
  });
  dist.querySelectorAll("button").forEach(b => {
    b.onclick = () => { setPreset(b.dataset.v); if(!CHASE.on) setOn(true); paint(); };
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
    try{ injectRow(); }catch(e){ console.warn("[fpview-chase] settings row:", e); }
    return r;
  };
})();

if(document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", caption, { once:true });
else caption();

})();
