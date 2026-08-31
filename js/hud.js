/* =====================================================================
   HUD — presentation layer for HEAT                            (drop-in)
   ---------------------------------------------------------------------
   Loads AFTER js/game.js. It never calls into the rules and never edits
   game state: it watches the DOM the game already builds and dresses it.

       <link rel="stylesheet" href="css/hud.css">      (after game.css)
       <script src="js/hud.js"></script>               (after game.js)

   What it does
     · #hand becomes a fanned hand — arc layout, hover lift, and a
       drag-up-to-play gesture that ends by calling the card's OWN click
       handler, so selection stays entirely the game's business.
     · #geargate becomes a gated lever with a knob that slides to the
       chosen gear.
     · #gauges gains a live Engine thermometer and a Discard tile.
     · A broadcast-style position ladder sits over the board and
       re-orders itself with a FLIP animation as places change.

   Everything is defensive. If the game changes shape underneath it the
   worst case is that an enhancement quietly doesn't apply — the plain
   game.css UI is always underneath, fully playable.

   Kill switch:  HUD.disable()   ·   re-enable with HUD.enable()
   ===================================================================== */
"use strict";
(function(){

const LS = "heat.hud.on";
const DRAG_COMMIT = 44;          // px of vertical travel that commits a card
const DRAG_SLOP   = 7;           // px before a press becomes a drag

const $ = s => document.querySelector(s);
const on = () => { try{ return localStorage.getItem(LS) !== "0"; }catch(e){ return true; } };

/* the game's globals are declared in other classic scripts, so they are
   reachable by name — but only once game.js has run. Everything below
   asks politely. */
const g = n => { try{ return (typeof window[n] !== "undefined") ? window[n] : eval(n); }catch(e){ return undefined; } };
const you = () => { const f = g("curHuman"); try{ return f ? f() : null; }catch(e){ return null; } };
const players = () => { const G = g("G"); return (G && G.players) || []; };

let enabled = false, panelObs = null, handObs = null, tickTimer = 0, resizeRaf = 0;

/* =====================================================================
   1 · FANNED HAND
   ===================================================================== */

/* Arc layout. Step is clamped to the container so a 9-card hand still
   fits a phone; the vertical drop and rotation follow from the step so
   the fan reads as one curve at any hand size. */
function layoutFan(hand){
  const cards = [...hand.children].filter(el => el.classList && el.classList.contains("card"));
  const n = cards.length;
  if(!n){ hand.style.removeProperty("--fan-h"); return; }

  const box   = hand.clientWidth || hand.getBoundingClientRect().width || 320;
  const cardW = cards[0].offsetWidth || 66;
  const cardH = cards[0].offsetHeight || 96;
  const step  = n < 2 ? 0 : Math.max(24, Math.min(58, (box - cardW - 10) / (n - 1)));
  const mid   = (n - 1) / 2;
  const perDeg = Math.min(6.5, 46 / Math.max(1, n));   // tighter fan as the hand grows
  const drop   = step > 40 ? 2.0 : 1.2;                // shallower curve when squeezed

  let maxDrop = 0;
  cards.forEach((el, i) => {
    const o = i - mid, dy = o * o * drop;
    maxDrop = Math.max(maxDrop, dy);
    el.style.setProperty("--dx",  (o * step).toFixed(1) + "px");
    el.style.setProperty("--dy",  dy.toFixed(1) + "px");
    el.style.setProperty("--rot", (o * perDeg).toFixed(2) + "deg");
    el.style.setProperty("--z",   String(10 + i));
  });
  hand.style.setProperty("--fan-h", Math.round(cardH + maxDrop + 40) + "px");
}

function dropRibbon(hand){
  let el = hand.querySelector("#hud-drop");
  if(!el){
    el = document.createElement("div");
    el.id = "hud-drop";
    el.textContent = "drag up to play";
    hand.appendChild(el);
  }
  return el;
}

/* Drag-to-play. The gesture deliberately does NOT touch selection state
   itself — past the threshold it fires the card's existing click
   handler, which is the same code path a tap uses. */
function wireDrag(el, hand){
  if(el._hudDrag) return;
  el._hudDrag = true;

  let pid = null, sx = 0, sy = 0, live = false, armed = 0;

  const reset = () => {
    el.classList.remove("dragging", "armed", "armed-off");
    el.style.removeProperty("--drag-x");
    el.style.removeProperty("--drag-y");
    el.style.removeProperty("--drag-rot");
    const rib = hand.querySelector("#hud-drop");
    if(rib) rib.classList.remove("on", "hot", "off");
    pid = null; live = false; armed = 0;
  };

  el.addEventListener("pointerdown", e => {
    if(el.classList.contains("dim")) return;     // Heat cards can't be played
    if(typeof el.onclick !== "function") return; // read-only preview hand (step 1)
    if(e.button !== undefined && e.button !== 0) return;
    pid = e.pointerId; sx = e.clientX; sy = e.clientY; live = false; armed = 0;
  });

  el.addEventListener("pointermove", e => {
    if(pid !== e.pointerId) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if(!live){
      if(Math.hypot(dx, dy) < DRAG_SLOP) return;
      live = true;
      try{ el.setPointerCapture(pid); }catch(err){}
      el.classList.add("dragging");
      dropRibbon(hand).classList.add("on");
    }
    el.style.setProperty("--drag-x", dx.toFixed(1) + "px");
    el.style.setProperty("--drag-y", dy.toFixed(1) + "px");
    el.style.setProperty("--drag-rot", (dx * 0.06).toFixed(2) + "deg");

    const sel = el.classList.contains("sel");
    armed = (!sel && dy <= -DRAG_COMMIT) ?  1
          : ( sel && dy >=  DRAG_COMMIT) ? -1 : 0;

    el.classList.toggle("armed",     armed ===  1);
    el.classList.toggle("armed-off", armed === -1);
    const rib = hand.querySelector("#hud-drop");
    if(rib){
      rib.classList.toggle("hot", armed === 1);
      rib.classList.toggle("off", armed === -1);
      rib.textContent = armed === -1 ? "release to take back"
                      : armed ===  1 ? "release to play"
                      : sel ? "drag down to take back" : "drag up to play";
    }
  });

  const finish = e => {
    if(pid !== e.pointerId) return;
    const fired = live && armed !== 0;
    if(live) hand._hudSwallow = true;      // eat the click the browser is about to send
    reset();
    if(fired){ try{ el.onclick(); }catch(err){ console.warn("HUD: card handler threw", err); } }
  };
  el.addEventListener("pointerup", finish);
  el.addEventListener("pointercancel", e => { if(pid === e.pointerId){ if(live) hand._hudSwallow = true; reset(); } });
}

/* one capture-phase listener per hand, ahead of the cards' own onclick */
function wireSwallow(hand){
  if(hand._hudSwallowWired) return;
  hand._hudSwallowWired = true;
  hand.addEventListener("click", e => {
    if(hand._hudSwallow){ hand._hudSwallow = false; e.stopPropagation(); e.preventDefault(); }
  }, true);
}

/* "2 of 3 committed" line under the fan */
function countLine(hand){
  let el = document.getElementById("hud-count");
  if(!el){
    el = document.createElement("div");
    el.id = "hud-count";
    hand.parentNode.insertBefore(el, hand.nextSibling);
  }
  const p = you();
  const need = p ? p.gear : 0;
  const got  = hand.querySelectorAll(".card.sel").length;
  const playable = [...hand.children].filter(c => c.classList && c.classList.contains("card") && !c.classList.contains("dim")).length;
  if(!need || !playable){ el.textContent = ""; return; }
  el.innerHTML = `<b>${got}</b> of <b>${need}</b> committed`;
  el.classList.toggle("full", got === need);
}

function enhanceHand(){
  const hand = document.getElementById("hand");
  if(!hand) return;
  hand.classList.add("fan");
  wireSwallow(hand);
  dropRibbon(hand);
  [...hand.children].forEach(el => { if(el.classList && el.classList.contains("card")) wireDrag(el, hand); });
  layoutFan(hand);
  countLine(hand);

  if(handObs) handObs.disconnect();
  handObs = new MutationObserver(() => countLine(hand));
  handObs.observe(hand, {subtree:true, attributes:true, attributeFilter:["class"]});
}

/* =====================================================================
   2 · GEAR STICK
   ===================================================================== */
function placeKnob(gate){
  const knob = gate.querySelector("#gearknob");
  const sel  = gate.querySelector(".gearopt.sel");
  if(!knob || !sel) return;
  knob.style.left = (sel.offsetLeft + sel.offsetWidth / 2 - 22) + "px";
  knob.classList.toggle("heat", sel.classList.contains("heatcost"));
}
function enhanceGate(){
  const gate = document.getElementById("geargate");
  if(!gate || !gate.children.length) return;
  gate.classList.add("stick");
  if(!gate.querySelector("#gearknob")){
    const knob = document.createElement("div");
    knob.id = "gearknob";
    gate.appendChild(knob);
  }
  if(!gate._hudWired){
    gate._hudWired = true;
    gate.addEventListener("click", () => requestAnimationFrame(() => placeKnob(gate)));
  }
  requestAnimationFrame(() => placeKnob(gate));
}

/* =====================================================================
   3 · DASHBOARD RIBBON
   ===================================================================== */
function ensureGaugeExtras(){
  const bar = document.getElementById("gauges");
  if(!bar) return;
  const heatTile = bar.querySelector(".gauge.heatg");
  if(heatTile && !document.getElementById("hud-heatbar")){
    const b = document.createElement("div");
    b.id = "hud-heatbar";
    heatTile.appendChild(b);
  }
  if(!document.getElementById("g-disc-tile")){
    const t = document.createElement("div");
    t.className = "gauge";
    t.id = "g-disc-tile";
    t.innerHTML = `<div class="lbl">Discard</div><div class="val" id="g-disc">–</div>`;
    const deck = document.getElementById("g-deck-tile");
    if(deck && deck.parentNode) deck.parentNode.insertBefore(t, deck.nextSibling);
    else bar.appendChild(t);
  }
}

function paintGauges(){
  const p = you(); if(!p) return;
  const bar = document.getElementById("hud-heatbar");
  const capFn = g("heatCapFor");
  const cap = (typeof capFn === "function") ? capFn(p) : 6;
  if(bar){
    if(bar.children.length !== cap){
      bar.innerHTML = "";
      for(let i = 0; i < cap; i++) bar.appendChild(document.createElement("i"));
    }
    [...bar.children].forEach((pip, i) => pip.classList.toggle("on", i < p.engine));
  }
  const tile = document.querySelector(".gauge.heatg");
  if(tile) tile.classList.toggle("low", p.engine <= 1);

  const disc = document.getElementById("g-disc");
  if(disc && p.discard) disc.textContent = p.discard.length;

  /* pop any gauge whose number just changed */
  document.querySelectorAll("#gauges .gauge").forEach(t => {
    const v = t.querySelector(".val"); if(!v) return;
    const now = v.textContent;
    if(t._hudLast !== undefined && t._hudLast !== now){
      t.classList.add("bump");
      setTimeout(() => t.classList.remove("bump"), 220);
    }
    t._hudLast = now;
  });
}

/* =====================================================================
   4 · POSITION LADDER
   ===================================================================== */
function ladderEl(){
  const wrap = document.getElementById("trackwrap");
  if(!wrap) return null;
  let lad = document.getElementById("hud-ladder");
  if(!lad){
    lad = document.createElement("div");
    lad.id = "hud-ladder";
    lad.innerHTML = `<div class="lad-hd">Order</div><div class="lad-body"></div>`;
    wrap.appendChild(lad);
  }
  return lad;
}

function paintLadder(){
  const lad = ladderEl(); if(!lad) return;
  const body = lad.querySelector(".lad-body");
  const G = g("G");
  const list = players();
  if(!list.length){ lad.style.display = "none"; return; }
  lad.style.display = "";

  const fin = (G && G.finishOrder) || [];
  const order = [...list].sort((a, b) => {
    if(a.finished && b.finished) return fin.indexOf(a) - fin.indexOf(b);
    if(a.finished) return -1;
    if(b.finished) return 1;
    return b.total - a.total || a.spot - b.spot;
  });
  const me = you();
  const lead = order[0];

  /* FLIP: measure, reorder, then animate the delta away */
  const rows = new Map();
  [...body.children].forEach(r => rows.set(r.dataset.pid, {el:r, top:r.offsetTop}));

  order.forEach((p, i) => {
    let hit = rows.get(String(p.id));
    let row = hit && hit.el;
    if(!row){
      row = document.createElement("div");
      row.className = "lad-row";
      row.dataset.pid = String(p.id);
      row.innerHTML = `<span class="lad-pos"></span><span class="lad-dot"></span>`
                    + `<span class="lad-name"></span><span class="lad-gap"></span>`;
    }
    row.querySelector(".lad-pos").textContent  = (i + 1);
    row.querySelector(".lad-dot").style.background = p.color || "#888";
    row.querySelector(".lad-name").textContent = p.name || "—";
    const gap = p.finished ? "FIN" : (p === lead ? "LDR" : "+" + (lead.total - p.total));
    row.querySelector(".lad-gap").textContent = gap;
    row.classList.toggle("you",  p === me);
    row.classList.toggle("lead", p === lead);
    row.classList.toggle("out",  !!p.finished);
    body.appendChild(row);                       // appending in order = reorder
  });
  [...body.children].forEach(r => { if(!order.some(p => String(p.id) === r.dataset.pid)) r.remove(); });

  [...body.children].forEach(r => {
    const was = rows.get(r.dataset.pid);
    if(!was) return;
    const d = was.top - r.offsetTop;
    if(!d) return;
    r.style.transition = "none";
    r.style.transform = `translateY(${d}px)`;
    r.classList.add(d > 0 ? "gain" : "lose");     // moved up the list = gained
    requestAnimationFrame(() => {
      r.style.transition = "";
      r.style.transform = "";
      setTimeout(() => r.classList.remove("gain", "lose"), 820);
    });
  });
}

/* =====================================================================
   5 · WIRING
   ===================================================================== */
function enhanceAll(){
  if(!enabled) return;
  try{ enhanceHand();      }catch(e){ console.warn("HUD hand:", e); }
  try{ enhanceGate();      }catch(e){ console.warn("HUD gate:", e); }
  try{ ensureGaugeExtras();}catch(e){ console.warn("HUD gauges:", e); }
}

function tick(){
  if(!enabled) return;
  try{ paintGauges(); }catch(e){}
  try{ paintLadder(); }catch(e){}
}

function enable(){
  if(enabled) return;
  enabled = true;
  try{ localStorage.setItem(LS, "1"); }catch(e){}
  document.body.classList.add("hud");

  /* the game rebuilds #panel wholesale for every phase — that rebuild is
     our cue to re-dress it */
  const panel = document.getElementById("panel");
  if(panel){
    panelObs = new MutationObserver(() => {
      clearTimeout(enable._t);
      enable._t = setTimeout(enhanceAll, 0);
    });
    panelObs.observe(panel, {childList:true, subtree:true});
  }
  window.addEventListener("resize", onResize, {passive:true});
  tickTimer = setInterval(tick, 140);
  enhanceAll();
  tick();
}

function disable(){
  if(!enabled) return;
  enabled = false;
  try{ localStorage.setItem(LS, "0"); }catch(e){}
  document.body.classList.remove("hud");
  if(panelObs){ panelObs.disconnect(); panelObs = null; }
  if(handObs){ handObs.disconnect(); handObs = null; }
  clearInterval(tickTimer); tickTimer = 0;
  window.removeEventListener("resize", onResize);
  const hand = document.getElementById("hand");
  if(hand){
    hand.classList.remove("fan");
    hand.style.removeProperty("--fan-h");
    [...hand.children].forEach(c => ["--dx","--dy","--rot","--z","--drag-x","--drag-y","--drag-rot"]
      .forEach(v => c.style && c.style.removeProperty(v)));
  }
  const gate = document.getElementById("geargate"); if(gate) gate.classList.remove("stick");
  const lad  = document.getElementById("hud-ladder"); if(lad) lad.remove();
  const cnt  = document.getElementById("hud-count");  if(cnt) cnt.remove();
}

function onResize(){
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    const hand = document.getElementById("hand");
    if(hand && hand.classList.contains("fan")) layoutFan(hand);
    const gate = document.getElementById("geargate");
    if(gate && gate.classList.contains("stick")) placeKnob(gate);
  });
}

window.HUD = {enable, disable, refresh: enhanceAll, get on(){ return enabled; }};

if(on()){
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", enable, {once:true});
  else enable();
}

})();
