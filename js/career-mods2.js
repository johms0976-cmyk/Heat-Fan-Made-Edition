"use strict";
/* =====================================================================
   CAREER · MODS, BOSSES & RIVALS
   Load order: AFTER js/game.js, BEFORE js/career.js.

   This file does three things and nothing else:
     1. MODS    — 15 Slay-the-Spire-style relics, heat themed.
     2. RACERS  — boss + rival drivers with one signature trick each.
     3. HOOKS   — wraps a handful of game.js functions so those effects
                  actually bite during a race. game.js itself is NOT
                  edited; every wrap calls through to the original, so
                  deleting this <script> line restores stock behaviour.

   HOW EFFECTS ARE APPLIED
   -----------------------
   Everything funnels through one per-driver object, `p._fx`, built once
   at race start. Hooks read `p._fx` and nothing else, so adding a mod or
   a boss is a data change, not a code change.

   Five of the fields (tank / cool / limitAdj / slipBase / spinStress) are
   things game.js reads off the driver's *vehicle class*, via classOf().
   That's a const arrow, so it can't be wrapped — instead careerApplyFx()
   mints a private derived class for the driver and repoints them at it.
   Derived classes are stripped again before every race so they never leak
   into the deck-select screen or a rival's random class roll.

   _fx fields the hooks understand:
     tank        +n   Heat capacity (Engine size)           [derived class]
     cool        +n   Cooldown in every gear                [derived class]
     limitAdj    +n   corner speed limits, this driver only [derived class]
     slipBase    +n   slipstream distance                   [derived class]
     spinStress  +n   extra/fewer Stress on a spin-out      [derived class]
     stress      +n   Stress cards shuffled into the deck
     startGear   n    gear you line up in
     handBonus   +n   extra cards in the opening hand
     ignoreCorners n  free passes on the first n corner checks of the race
     forgive     +n   over-limit by <= n costs nothing
     roundCool   +n   auto-cooldown from hand at the top of every round
     spinSave    n    survive n spin-outs (Engine refills instead)
     noSpin      bool never spins out; Engine tops up each round
     occupyBoth  bool the car blocks both spots of its Space
     noSlip      bool other cars may not slipstream off this one
     stressOnPass bool being passed by this car costs you a Stress card

   Career-layer fields live under _fx.career and are read by career.js:
     money, fuel   paid after every race
     fuelDiscount  cheaper travel
     goalEase      race goals drop one step
     shopDisc      fraction off speed-shop prices
     shopExtra     extra cards in shop stock
   ===================================================================== */

/* ============================================================
   1 · MODS  (15)
   ============================================================ */
const CAREER_MODS = [
  /* ---- in-race · common ---- */
  { id:"coldstart", name:"Cold Start", icon:"\u2744\uFE0F", rarity:"common",
    text:"Ignore the first corner check of every race.",
    flavour:"The engine's still cold. Use it while it lasts.",
    fx:{ ignoreCorners:1 } },

  { id:"heatsink", name:"Heat Sink", icon:"\uD83E\uDDCA", rarity:"common",
    text:"+1 Cooldown in every gear.",
    flavour:"Finned alloy, bolted where the bodywork used to be.",
    fx:{ cool:1 } },

  { id:"bigbore", name:"Big-Bore Radiator", icon:"\uD83D\uDEE2\uFE0F", rarity:"common",
    text:"+2 Heat capacity, and your Engine starts every race full.",
    flavour:"It weighs a ton and you do not care.",
    fx:{ tank:2 } },

  { id:"steadyhands", name:"Steady Hands", icon:"\u270B", rarity:"common",
    text:"Start every race with 1 fewer Stress card in your deck.",
    flavour:"You stopped reading the pit board halfway through last season.",
    fx:{ stress:-1 } },

  /* ---- in-race · uncommon ---- */
  { id:"stickies", name:"Sticky Compound", icon:"\uD83D\uDEDE", rarity:"uncommon",
    text:"Every corner speed limit is 1 higher — for you.",
    flavour:"Softer than the regulations strictly allow.",
    fx:{ limitAdj:1 } },

  { id:"towhook", name:"Tow Hook", icon:"\uD83E\uDE9D", rarity:"uncommon",
    text:"Slipstream 3 spaces instead of 2.",
    flavour:"Close enough to read their oil pressure.",
    fx:{ slipBase:1 } },

  { id:"icyveins", name:"Ice in the Veins", icon:"\uD83E\uDE78", rarity:"uncommon",
    text:"At the start of every round, return 1 Heat from your hand to the Engine — whatever gear you're in.",
    flavour:"Your pulse never went above ninety. Not once.",
    fx:{ roundCool:1 } },

  { id:"latebraker", name:"Late Braker", icon:"\uD83C\uDD7F\uFE0F", rarity:"uncommon",
    text:"Exceeding a corner limit by exactly 1 costs no Heat.",
    flavour:"Brake when you see God. Not before.",
    fx:{ forgive:1 } },

  { id:"warmtyres", name:"Warm Tyres", icon:"\uD83D\uDD25", rarity:"uncommon",
    text:"Line up in 2nd gear, and hold 8 cards instead of 7.",
    flavour:"Blankets off thirty seconds before anyone else's.",
    fx:{ startGear:2, handBonus:1 } },

  /* ---- in-race · rare ---- */
  { id:"gloves", name:"Fireproof Gloves", icon:"\uD83E\uDDE4", rarity:"rare",
    text:"Once per race, survive a spin-out: you keep your place and your gear, and 2 Heat stay in the Engine.",
    flavour:"Scorched to the knuckle and still buckled on.",
    fx:{ spinSave:1 } },

  { id:"steelnerves", name:"Steel Nerves", icon:"\uD83E\uDE9B", rarity:"rare",
    text:"A spin-out never costs you more than 1 Stress card.",
    flavour:"Spin it, gather it, carry on. No commentary.",
    fx:{ spinStress:-1 } },

  /* ---- career economy ---- */
  { id:"scavcrate", name:"Scavenger's Crate", icon:"\uD83E\uDDF0", rarity:"common",
    text:"After every race, +$20 and +1 fuel — win or lose.",
    flavour:"Half the paddock's spares end up in the back of your truck.",
    fx:{ career:{ money:20, fuel:1 } } },

  { id:"jerrycan", name:"Jerry Can", icon:"\u26FD", rarity:"uncommon",
    text:"Every stop costs 1 less fuel to reach (minimum 1).",
    flavour:"Strapped to the roll bar. Almost certainly illegal.",
    fx:{ career:{ fuelDiscount:1 } } },

  { id:"ledger", name:"Grease-Stained Ledger", icon:"\uD83D\uDCB5", rarity:"uncommon",
    text:"Speed shops knock 25% off, and always have one extra part on the shelf.",
    flavour:"You know what they paid for it. They know you know.",
    fx:{ career:{ shopDisc:0.25, shopExtra:1 } } },

  { id:"teamorders", name:"Team Orders", icon:"\uD83D\uDCFB", rarity:"rare",
    text:"Every race goal drops one step — a win becomes a top 2, a podium becomes a top 5.",
    flavour:"\"Just bring it home, kid.\"",
    fx:{ career:{ goalEase:1 } } },
];
const modById = id => CAREER_MODS.find(m => m.id === id);
const MOD_TINT = { common:"#9fb8d0", uncommon:"#6bd48c", rare:"#ffd86b" };

/* ============================================================
   2 · BOSSES & RIVALS
   ============================================================ */
const CAREER_BOSSES = [
  { id:"wall", name:"No. 3 Bruno \"The Wall\" Kessel", color:"#c0563f", icon:"\uD83E\uDDF1",
    brief:"Kessel parks that barge of a car across the whole road. There is no way past — only through, and there is no through.",
    threat:"Blocks both spots of every Space he occupies. You can never share his Space.",
    ace:true, fx:{ occupyBoth:true, tank:2 } },

  { id:"ghost", name:"No. 0 Nadia \"Ghost\" Vlk", color:"#9aa6b8", icon:"\uD83D\uDC7B",
    brief:"Vlk's car leaves no wake. Tuck in behind her and you get nothing but clean, useless air.",
    threat:"Cannot be slipstreamed. Slipstreams 3 herself.",
    ace:true, fx:{ noSlip:true, slipBase:1 } },

  { id:"furnace", name:"No. 66 Duke \"Furnace\" Randall", color:"#ff6b1f", icon:"\uD83D\uDD25",
    brief:"Randall's engine has been glowing since practice. It has not stopped and it is not going to.",
    threat:"Never spins out. His Engine refills to full every round.",
    ace:true, fx:{ noSpin:true, tank:4 } },

  { id:"metronome", name:"No. 11 Yuki \"Metronome\" Sato", color:"#4fb8d8", icon:"\u23F1\uFE0F",
    brief:"Sato has driven this circuit ten thousand times in her head. Every apex is a decision she made years ago.",
    threat:"Corner limits are 2 higher for her, and she cools better than anyone in the field.",
    ace:true, fx:{ limitAdj:2, cool:1 } },

  { id:"bulldozer", name:"No. 7 Otto \"Bulldozer\" Krantz", color:"#8a6b3f", icon:"\uD83D\uDE9C",
    brief:"Krantz does not overtake so much as relocate you. The stewards stopped writing it up years ago.",
    threat:"Every round he takes a place off you, you pick up a Stress card.",
    ace:true, fx:{ stressOnPass:true, spinStress:-1 } },

  { id:"tailgunner", name:"No. 24 Rui \"Tailgunner\" Marques", color:"#6bd48c", icon:"\uD83C\uDF00",
    brief:"Marques lives in other people's dirty air and comes out the front of it. Every single lap.",
    threat:"Slipstreams 4 spaces.",
    ace:true, fx:{ slipBase:2 } },
];

const CAREER_RIVALS = [
  { id:"sparks",   name:"No. 18 \"Sparks\" Delacroix", color:"#ffd86b", icon:"\u2728",
    threat:"Corner limits 1 higher for her.",                 fx:{ limitAdj:1 } },
  { id:"cooler",   name:"No. 31 \"Cooler\" Nakamura",  color:"#7fd4ff", icon:"\u2744\uFE0F",
    threat:"+1 Cooldown in every gear.",                      fx:{ cool:1 } },
  { id:"anchor",   name:"No. 5 \"Anchor\" Vance",      color:"#b07de0", icon:"\u2693",
    threat:"Blocks both spots of his Space.",                 fx:{ occupyBoth:true } },
  { id:"slick",    name:"No. 27 \"Slick\" Moreau",     color:"#6bd48c", icon:"\uD83C\uDF00",
    threat:"Slipstreams 3 spaces.",                           fx:{ slipBase:1 } },
  { id:"ironlung", name:"No. 40 \"Ironlung\" Petrov",  color:"#d86b6b", icon:"\uD83E\uDEC1",
    threat:"Carries 2 extra Heat in the Engine.",             fx:{ tank:2 } },
  { id:"twitch",   name:"No. 2 \"Twitch\" Okafor",     color:"#ff9f4f", icon:"\u26A1",
    threat:"Drives a full step above the rest of the field.", ace:true, fx:{} },
];

const bossById  = id => CAREER_BOSSES.find(b => b.id === id);
const rivalById = id => CAREER_RIVALS.find(r => r.id === id);

/* ============================================================
   3 · FX PLUMBING
   ============================================================ */
/* Merge fx blobs into one. Numbers add; booleans OR. */
function mergeFx(list){
  const out = { career:{} };
  for(const fx of list){
    if(!fx) continue;
    for(const k in fx){
      if(k === "career"){
        for(const ck in fx.career){
          const v = fx.career[ck];
          out.career[ck] = (typeof v === "number") ? (out.career[ck]||0) + v : (out.career[ck] || v);
        }
      } else {
        const v = fx[k];
        out[k] = (typeof v === "number") ? (out[k]||0) + v : (out[k] || v);
      }
    }
  }
  return out;
}
/* The player's merged mod fx for the career currently loaded. */
function careerModFx(){
  if(typeof G === "undefined" || !G.career || !G.career.mods) return mergeFx([]);
  return mergeFx(G.career.mods.map(id => (modById(id)||{}).fx));
}
/* Career-layer shortcut: careerPerk("fuelDiscount") -> 0 when no mod grants it. */
function careerPerk(key){ return careerModFx().career[key] || 0; }
const fxOf = p => (p && p._fx) || null;

/* ---- derived vehicle classes -----------------------------------------
   classOf()/classByKey() are const arrows and can't be wrapped, but they
   resolve through the VEHICLE_CLASSES array — which is mutable. So a driver
   carrying class-shaped fx gets a private clone of their class pushed onto
   that array, and their `cls` key repointed at it. */
const FX_CLASS_TAG = "__fx__";
function careerStripDerivedClasses(){
  for(let i = VEHICLE_CLASSES.length - 1; i >= 0; i--)
    if(VEHICLE_CLASSES[i]._fxDerived) VEHICLE_CLASSES.splice(i, 1);
}
/* Call once, after every driver in the race has been created. */
function careerApplyFx(players){
  careerStripDerivedClasses();
  let n = 0;
  for(const p of (players || [])){
    const fx = fxOf(p);
    if(!fx) continue;
    if(fx.tank || fx.cool || fx.limitAdj || fx.slipBase || fx.spinStress){
      const base = classByKey(p.cls);
      const derived = Object.assign({}, base, {
        key:        base.key + FX_CLASS_TAG + (n++),
        _fxDerived: true,
        tank:       (base.tank||0)     + (fx.tank||0),
        limitAdj:   (base.limitAdj||0) + (fx.limitAdj||0),
        slipBase:   (base.slipBase||2) + (fx.slipBase||0),
        spinStress: Math.max(-1, (base.spinStress||0) + (fx.spinStress||0)),
        cool:       (base.cool||[]).map(v => Math.max(0, (v||0) + (fx.cool||0)))
      });
      VEHICLE_CLASSES.push(derived);
      p.cls = derived.key;
    }
    // Engine size may have just changed; round scratch caches limitAdj
    p.engine = heatCapFor(p);
    if(typeof resetRoundScratch === "function") resetRoundScratch(p);
    if(fx.startGear) p.gear = fx.startGear;
    p._ignoreLeft   = fx.ignoreCorners || 0;
    p._spinSaveLeft = fx.spinSave || 0;
  }
}

/* ============================================================
   4 · HOOKS INTO game.js
   Each wraps the stock function and calls through to it.
   ============================================================ */
(function installCareerHooks(){
  if(typeof G === "undefined"){
    console.warn("[career] career-mods.js loaded before game.js — hooks not installed.");
    return;
  }

  /* ---- A · carsAt(space, exclude) -------------------------------------
     Two tricks live here.
     · occupyBoth — a phantom passenger is appended so spaceFull() reads the
       Space as taken and nobody can tuck in alongside.
     · noSlip — when the slipstream step asks "is there a car here?", ghosts
       answer no. G._slipQuery is raised only around that eligibility test
       (hook B), so a ghost still physically blocks a Space you move into. */
  const _carsAt = carsAt;
  carsAt = function(space, exclude){
    let list = _carsAt(space, exclude);
    if(G._slipQuery && list.some(p => fxOf(p) && fxOf(p).noSlip))
      list = list.filter(p => !(fxOf(p) && fxOf(p).noSlip));
    const hogs = list.filter(p => fxOf(p) && fxOf(p).occupyBoth);
    if(hogs.length && list.length < 2)
      list = list.concat(hogs.map(h => ({ _phantom:true, spot:(h.spot===0?1:0), total:h.total, name:h.name })));
    return list;
  };

  /* ---- B · slipstream eligibility ------------------------------------- */
  if(typeof playerSlipstream === "function"){
    const _ps = playerSlipstream;
    playerSlipstream = function(chain){
      G._slipQuery = true;
      try { return _ps.call(this, chain); } finally { G._slipQuery = false; }
    };
  }
  if(typeof simSlip === "function"){
    const _ss = simSlip;
    simSlip = function(p, prof){
      G._slipQuery = true;
      try { return _ss.call(this, p, prof); } finally { G._slipQuery = false; }
    };
  }

  /* ---- C · runCornerCheck(p) ------------------------------------------
     · ignoreCorners — drop the first n crossings of the whole race.
     · forgive       — a temporary limit bump, so an over-run of <= n is free.
     Both are pre-processing; the stock check still does the real work. */
  const _rcc = runCornerCheck;
  runCornerCheck = function(p){
    const fx = fxOf(p);
    if(!fx) return _rcc(p);
    if(fx.ignoreCorners && p.crossings && p.crossings.length && p._ignoreLeft > 0){
      const skip = Math.min(p._ignoreLeft, p.crossings.length);
      p._ignoreLeft -= skip;
      p.crossings = p.crossings.slice(skip);
      if(!p.isBot) log("\u2744\uFE0F Cold Start — the first corner check is waved through.", "me");
    }
    let restore = null;
    if(fx.forgive){ restore = p.limitAdj || 0; p.limitAdj = restore + fx.forgive; }
    const r = _rcc(p);
    if(restore !== null) p.limitAdj = restore;
    return r;
  };

  /* ---- D · weatherSpinOut(p, …) ---------------------------------------
     · noSpin   — bosses that simply refuse to lose the back end.
     · spinSave — Fireproof Gloves: eat the spin, once per race. */
  const _spin = weatherSpinOut;
  weatherSpinOut = function(p, cornerTotal, tag, induced){
    const fx = fxOf(p);
    if(fx && fx.noSpin){
      p.engine = heatCapFor(p);
      log(`${p.name} runs the corner far over the limit — and the engine just takes it.`, "warn");
      if(typeof renderGauges === "function") renderGauges();
      return;
    }
    if(fx && fx.spinSave && p._spinSaveLeft > 0){
      p._spinSaveLeft--;
      p.engine = Math.min(2, heatCapFor(p));
      if(!p.isBot){
        log("\uD83E\uDDE4 Fireproof Gloves — you gather it up. Place held, 2 Heat back in the Engine.", "me");
        toast("\uD83E\uDDE4 Saved it!", "hot");
      }
      if(typeof renderGauges === "function") renderGauges();
      return;
    }
    return _spin(p, cornerTotal, tag, induced);
  };

  /* ---- E · startRound() ------------------------------------------------
     Per-round upkeep: auto-cooldown, boss Engine top-ups, pass tracking. */
  const _startRound = startRound;
  startRound = function(){
    for(const p of (G.players || [])){
      const fx = fxOf(p);
      if(!fx || p.finished) continue;
      if(fx.noSpin) p.engine = heatCapFor(p);
      if(fx.roundCool){
        const i = (p.hand || []).findIndex(isHeat);
        if(i >= 0 && p.engine < heatCapFor(p)){
          p.hand.splice(i, 1); p.engine++;
          if(!p.isBot) log("\uD83E\uDE78 Ice in the Veins — 1 Heat slides back into the Engine.", "me");
        }
      }
      if(fx.stressOnPass){
        p._passFrom = p.total;
        p._passRivals = G.players.filter(q => q !== p && !q.isBot && !q.finished)
                                 .map(q => ({ id:q.id, t:q.total }));
      }
    }
    return _startRound.apply(this, arguments);
  };

  /* ---- F · endRound() --------------------------------------------------
     Bulldozer: any human he started behind and now leads takes a Stress card. */
  const _endRound = endRound;
  endRound = function(){
    for(const p of (G.players || [])){
      const fx = fxOf(p);
      if(!fx || !fx.stressOnPass || !p._passRivals) continue;
      for(const mark of p._passRivals){
        const q = G.players.find(x => x.id === mark.id);
        if(!q || q.finished) continue;
        if(p._passFrom < mark.t && p.total > q.total){
          q.hand.push(makeCard("stress"));
          log(`\uD83D\uDE9C ${p.name} shoulders past — you pick up a Stress card.`, "warn");
          if(typeof toast === "function") toast("\uD83D\uDE9C Barged — +1 Stress", "hot");
        }
      }
      p._passRivals = null;
    }
    return _endRound.apply(this, arguments);
  };

  /* ---- G · makeHuman(...) ---------------------------------------------
     Deck-level mods must land before the first card is drawn. buildDeck()
     reads the global weather Stress modifier, so Steady Hands borrows it. */
  const _makeHuman = makeHuman;
  makeHuman = function(upgrades, who, clsKey){
    if(G.mode !== "career" || !G.career) return _makeHuman(upgrades, who, clsKey);
    const fx = careerModFx();
    let p;
    if(fx.stress){
      const keep = WEATHER_STRESS_MOD;
      WEATHER_STRESS_MOD = keep + fx.stress;
      p = _makeHuman(upgrades, who, clsKey);
      WEATHER_STRESS_MOD = keep;
    } else {
      p = _makeHuman(upgrades, who, clsKey);
    }
    p._fx = fx;
    return p;
  };

  /* ---- H · handSize() -------------------------------------------------- */
  const _handSize = handSize;
  handSize = function(){
    const base = _handSize();
    if(G.mode !== "career" || !G.career) return base;
    return base + (careerModFx().handBonus || 0);
  };

  /* ---- I · makeBot(...) ------------------------------------------------
     career.js parks boss/rival specs on G._careerRacers, keyed by bot index. */
  const _makeBot = makeBot;
  makeBot = function(i, upgrades, clsKey){
    const b = _makeBot(i, upgrades, clsKey);
    const spec = G._careerRacers && G._careerRacers[i];
    if(spec){
      b.name  = spec.name;
      b.color = spec.color;
      b.ace   = !!spec.ace;
      b._fx   = Object.assign({}, spec.fx || {});
      b._careerSpec = spec;
    }
    return b;
  };

  console.log(`[career] hooks installed — ${CAREER_MODS.length} mods, ${CAREER_BOSSES.length} bosses, ${CAREER_RIVALS.length} rivals.`);
})();
