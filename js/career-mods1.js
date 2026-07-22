"use strict";
/* =====================================================================
   CAREER · MODS, BOSSES & RIVALS
   Load order: AFTER js/game.js, BEFORE js/career.js.

   This file does three things and nothing else:
     1. MODS    — 36 Slay-the-Spire-style relics, heat themed. 30 of them
                  are common/uncommon/rare and turn up in shops, crates and
                  events; the last 6 are LEGENDARY and drop only from
                  winning a boss race outright (Act I final, Act II final,
                  Grand Final).
     2. RACERS  — boss + rival drivers with one signature trick each,
                  sorted into three tiers so Act I fields club rookies and
                  Act III fields legends with a garage full of Upgrades.
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
     stress      +n   Stress cards shuffled into the deck (damage adds here)
     startGear   n    gear you line up in
     handBonus   +n   extra cards in the opening hand
     ignoreCorners n  free passes on the first n corner checks of the race
     forgive     +n   over-limit by <= n costs nothing
     roundCool   +n   auto-cooldown from hand at the top of every round
     roundShed   +n   auto-discard n Stress from hand at the top of every round
     roundReclaim +n  n Heat from the discard pile back to the Engine each round
     noOverheat  bool Overheat corner tokens don't add their +1 for you
     softSpinGear bool a spin-out drops you 1 gear instead of all the way to 1st
     gravelProof bool gravel Spots never rattle Heat out of your Engine
     tunnelRat   bool you may discard from hand inside tunnels
     floodProof  bool flooded Spaces don't charge extra Heat to downshift
     alwaysAdrenaline bool you count among the last cars every round
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
     restBonus     extra fuel at ⛽ fuel stops
     purseMult     fraction added to position purses
     luck          added to the 50/50 on roadside gambles
     retryHalf     re-entering a missed race: half fuel, no entry fee
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

  /* ============================================================
     WAVE 2 — 15 more relics
     ============================================================ */
  /* ---- in-race · common ---- */
  { id:"oilcooler", name:"Oil Cooler", icon:"\uD83D\uDEE2\uFE0F", rarity:"common",
    text:"+1 Heat capacity.",
    flavour:"Bolted in sideways. It fits if you don't look at it.",
    fx:{ tank:1 } },

  { id:"pitboard", name:"Pit Board", icon:"\uD83E\uDEA7", rarity:"common",
    text:"At the start of every round, discard 1 Stress card from your hand.",
    flavour:"P4. GAP 2.2. CALM DOWN.",
    fx:{ roundShed:1 } },

  { id:"rallysprings", name:"Rally Suspension", icon:"\uD83D\uDEFB", rarity:"common",
    text:"Gravel never rattles Heat out of your Engine.",
    flavour:"Half the ride height, twice the travel, all of the noise.",
    fx:{ gravelProof:true } },

  { id:"headlights", name:"Halogen Headlights", icon:"\uD83D\uDD26", rarity:"common",
    text:"You may discard from your hand inside tunnels.",
    flavour:"You can finally see what you're throwing away in there.",
    fx:{ tunnelRat:true } },

  { id:"longrange", name:"Long-Range Tank", icon:"\uD83D\uDEE2", rarity:"common",
    text:"Fuel stops top you up with +2 extra fuel.",
    flavour:"Where the passenger seat used to be.",
    fx:{ career:{ restBonus:2 } } },

  /* ---- in-race · uncommon ---- */
  { id:"launchctl", name:"Launch Control", icon:"\uD83D\uDEA6", rarity:"uncommon",
    text:"Line up in 3rd gear at every start. Made for the drag strip.",
    flavour:"Clutch in, revs up, prayers optional.",
    fx:{ startGear:3 } },

  { id:"returnline", name:"Return Line", icon:"\u267B\uFE0F", rarity:"uncommon",
    text:"At the start of every round, move 1 Heat from your discard pile back into the Engine.",
    flavour:"Nothing burnt is ever really gone.",
    fx:{ roundReclaim:1 } },

  { id:"ceramic", name:"Ceramic Manifold", icon:"\uD83C\uDFFA", rarity:"uncommon",
    text:"Overheat corners never add their extra Heat to your bill.",
    flavour:"Glows white. Still legal. Probably.",
    fx:{ noOverheat:true } },

  { id:"wetkit", name:"Wet-Weather Kit", icon:"\uD83C\uDF27\uFE0F", rarity:"uncommon",
    text:"Flooded spaces never charge you extra Heat to shift down.",
    flavour:"Sealed electrics, treaded rubber, dry socks.",
    fx:{ floodProof:true } },

  { id:"agent", name:"Silver-Tongued Agent", icon:"\uD83D\uDD7A", rarity:"uncommon",
    text:"Position purses pay out 25% more.",
    flavour:"Takes ten percent. Worth every cent of the other twenty-five.",
    fx:{ career:{ purseMult:0.25 } } },

  { id:"rabbitfoot", name:"Rabbit's Foot", icon:"\uD83D\uDC30", rarity:"uncommon",
    text:"Roadside 50/50 gambles land your way 70% of the time.",
    flavour:"Hasn't washed the gloves since Monza.",
    fx:{ career:{ luck:0.2 } } },

  /* ---- in-race · rare ---- */
  { id:"chassisflex", name:"Chassis Flex", icon:"\uD83E\uDD8E", rarity:"rare",
    text:"Exceeding a corner limit by up to 2 costs no Heat.",
    flavour:"The whole car corners. Not just the wheels.",
    fx:{ forgive:2 } },

  { id:"gearguard", name:"Gearbox Guard", icon:"\uD83D\uDEE1\uFE0F", rarity:"rare",
    text:"A spin-out drops you one gear instead of all the way to 1st.",
    flavour:"Spin it, catch second, floor it. The box forgives.",
    fx:{ softSpinGear:true } },

  { id:"caffeine", name:"Caffeine Drip", icon:"\u2615", rarity:"rare",
    text:"You always count among the last cars: Adrenaline (+1 Speed & +1 Cooldown) every round.",
    flavour:"Sleep is for the podium ceremony.",
    fx:{ alwaysAdrenaline:true } },

  { id:"paddockpass", name:"Paddock Pass", icon:"\uD83C\uDFAB", rarity:"rare",
    text:"Re-entering a race you missed costs half the fuel and no entry fee.",
    flavour:"Laminated, out of date, and nobody ever checks.",
    fx:{ career:{ retryHalf:true } } },

  /* ============================================================
     WAVE 3 — LEGENDARY (6)
     These never appear in a shop, a crate or an ordinary event. The only
     way to own one is to WIN a boss race outright: the Act I final, the
     Act II final, or the Grand Final. Three boss races, six relics — no
     career ever collects the set.
     ============================================================ */
  { id:"blueprint", name:"Blueprint Engine", icon:"\uD83D\uDCD0", rarity:"legendary",
    text:"+4 Heat capacity, +1 Cooldown in every gear, and your Engine starts every race brim-full.",
    flavour:"Hand-built to the drawings nobody was ever supposed to see.",
    fx:{ tank:4, cool:1 } },

  { id:"nomex", name:"Nomex Soul", icon:"\uD83E\uDDEF", rarity:"legendary",
    text:"Survive the first 3 spin-outs of every race, and a spin never costs more than 1 Stress card.",
    flavour:"Three fires. Three walk-aways. The suit still smells of Monza.",
    fx:{ spinSave:3, spinStress:-1 } },

  { id:"crown", name:"The Slipstream Crown", icon:"\uD83D\uDC51", rarity:"legendary",
    text:"You slipstream 4 spaces — and nobody may ever slipstream off you.",
    flavour:"They can follow you all day. They just can't have any of it.",
    fx:{ slipBase:2, noSlip:true } },

  { id:"icechamber", name:"Ice Chamber", icon:"\u2744\uFE0F", rarity:"legendary",
    text:"Every round: return 2 Heat from your hand to the Engine and pull 1 Heat back out of the discard pile.",
    flavour:"The cockpit runs cold. So does the driver.",
    fx:{ roundCool:2, roundReclaim:1, tank:1 } },

  { id:"apexcontract", name:"The Apex Contract", icon:"\uD83D\uDCDC", rarity:"legendary",
    text:"Every corner limit is 2 higher for you, exceeding a limit by 1 more is free, and Overheat corners never surcharge you.",
    flavour:"Signed in oil. Countersigned by something with better lawyers.",
    fx:{ limitAdj:2, forgive:1, noOverheat:true } },

  { id:"roadpresence", name:"Road Presence", icon:"\uD83D\uDDFF", rarity:"legendary",
    text:"Your car fills both spots of its Space, and you count among the last cars every round — Adrenaline, every single lap.",
    flavour:"Mirrors full of you is a place nobody drives well.",
    fx:{ occupyBoth:true, alwaysAdrenaline:true } },
];
const modById = id => CAREER_MODS.find(m => m.id === id);
const MOD_TINT = { common:"#9fb8d0", uncommon:"#6bd48c", rare:"#ffd86b", legendary:"#ff7bd5" };
/* Legendaries are boss loot only — every other pool filters them out. */
const isLegendaryMod = m => !!m && m.rarity === "legendary";
const CAREER_LEGEND_MODS = CAREER_MODS.filter(isLegendaryMod);

/* ============================================================
   2 · BOSSES & RIVALS
   ============================================================ */
const CAREER_BOSSES = [
  { id:"wall", name:"No. 3 Bruno \"The Wall\" Kessel", color:"#c0563f", icon:"\uD83E\uDDF1",
    brief:"Kessel parks that barge of a car across the whole road. There is no way past — only through, and there is no through.",
    threat:"Blocks both spots of every Space he occupies. You can never share his Space.",
    tier:3, ups:6, ace:true, fx:{ occupyBoth:true, tank:2 } },

  { id:"ghost", name:"No. 0 Nadia \"Ghost\" Vlk", color:"#9aa6b8", icon:"\uD83D\uDC7B",
    brief:"Vlk's car leaves no wake. Tuck in behind her and you get nothing but clean, useless air.",
    threat:"Cannot be slipstreamed. Slipstreams 3 herself.",
    tier:3, ups:6, ace:true, fx:{ noSlip:true, slipBase:1 } },

  { id:"furnace", name:"No. 66 Duke \"Furnace\" Randall", color:"#ff6b1f", icon:"\uD83D\uDD25",
    brief:"Randall's engine has been glowing since practice. It has not stopped and it is not going to.",
    threat:"Never spins out. His Engine refills to full every round.",
    tier:3, ups:6, ace:true, fx:{ noSpin:true, tank:4 } },

  { id:"metronome", name:"No. 11 Yuki \"Metronome\" Sato", color:"#4fb8d8", icon:"\u23F1\uFE0F",
    brief:"Sato has driven this circuit ten thousand times in her head. Every apex is a decision she made years ago.",
    threat:"Corner limits are 2 higher for her, and she cools better than anyone in the field.",
    tier:3, ups:6, ace:true, fx:{ limitAdj:2, cool:1 } },

  { id:"bulldozer", name:"No. 7 Otto \"Bulldozer\" Krantz", color:"#8a6b3f", icon:"\uD83D\uDE9C",
    brief:"Krantz does not overtake so much as relocate you. The stewards stopped writing it up years ago.",
    threat:"Every round he takes a place off you, you pick up a Stress card.",
    tier:3, ups:6, ace:true, fx:{ stressOnPass:true, spinStress:-1 } },

  { id:"tailgunner", name:"No. 24 Rui \"Tailgunner\" Marques", color:"#6bd48c", icon:"\uD83C\uDF00",
    brief:"Marques lives in other people's dirty air and comes out the front of it. Every single lap.",
    threat:"Slipstreams 4 spaces.",
    tier:3, ups:6, ace:true, fx:{ slipBase:2 } },
];

/* ---- rivals, in three tiers ------------------------------------------
   tier 1 — ACT I. Club racers. Barely a trick between them, and they line
            up with one or two Upgrade cards at most.
   tier 2 — ACT II. Circuit regulars. One real signature move each.
   tier 3 — ACT III. Legends. Stacked effects, ace AI, a deck full of
            Upgrades. These are the drivers you need your own garage for.
   `ups` is how many Upgrade cards the driver's own deck carries — career.js
   deals them that many instead of the field default. */
const CAREER_RIVALS = [
  /* ---------- tier 1 · rookies ---------- */
  { id:"cadet",    name:"No. 44 \"Cadet\" Ellery",     color:"#9fb8d0", icon:"\uD83E\uDDE2", tier:1, ups:0,
    threat:"Quick hands, no plan. Nothing special about the car.",
    brief:"Ellery's been racing three months and tells everyone about all of them.",
    fx:{} },
  { id:"barnsley", name:"No. 62 \"Spanner\" Barnsley", color:"#c9a06b", icon:"\uD83D\uDD29", tier:1, ups:1,
    threat:"One spare Heat in the Engine. That's the whole plan.",
    brief:"Runs the family garage on weekdays and the family car on Sundays.",
    fx:{ tank:1 } },
  { id:"junior",   name:"No. 9 \"Junior\" Halvorsen",  color:"#8fd6a8", icon:"\uD83C\uDF31", tier:1, ups:1,
    threat:"Cools 1 better than the rest of the club field.",
    brief:"Patient, tidy, and about four years from being a problem.",
    fx:{ cool:1 } },
  { id:"dusty",    name:"No. 71 \"Dusty\" Meara",      color:"#d4b483", icon:"\uD83C\uDF2B\uFE0F", tier:1, ups:1,
    threat:"Corner limits 1 higher for her.",
    brief:"Learned on gravel. Treats tarmac as a rumour.",
    fx:{ limitAdj:1 } },
  { id:"tailgate", name:"No. 15 \"Tailgate\" Sousa",   color:"#7fd4ff", icon:"\uD83D\uDE97", tier:1, ups:1,
    threat:"Slipstreams 3 spaces.",
    brief:"Sits in your mirrors like a tax bill.",
    fx:{ slipBase:1 } },
  { id:"twoquid",  name:"No. 88 \"Two-Quid\" Nkemdi",  color:"#e0a0d0", icon:"\uD83E\uDE99", tier:1, ups:2,
    threat:"Cheap car, expensive habits — starts in 2nd gear.",
    brief:"Bought the car for scrap money and has never once lifted.",
    fx:{ startGear:2 } },

  /* ---------- tier 2 · circuit regulars ---------- */
  { id:"sparks",   name:"No. 18 \"Sparks\" Delacroix", color:"#ffd86b", icon:"\u2728", tier:2, ups:2,
    threat:"Corner limits 1 higher for her.",
    brief:"Delacroix carries speed into places the rest of the field brakes for.",
    fx:{ limitAdj:1 } },
  { id:"cooler",   name:"No. 31 \"Cooler\" Nakamura",  color:"#7fd4ff", icon:"\u2744\uFE0F", tier:2, ups:2,
    threat:"+1 Cooldown in every gear.",
    brief:"Nakamura's engine never seems to get hot enough to matter.",
    fx:{ cool:1 } },
  { id:"anchor",   name:"No. 5 \"Anchor\" Vance",      color:"#b07de0", icon:"\u2693", tier:2, ups:3,
    threat:"Blocks both spots of his Space.",
    brief:"Vance defends a line he isn't even using, purely on principle.",
    fx:{ occupyBoth:true } },
  { id:"slick",    name:"No. 27 \"Slick\" Moreau",     color:"#6bd48c", icon:"\uD83C\uDF00", tier:2, ups:2,
    threat:"Slipstreams 3 spaces.",
    brief:"Moreau turns up in your mirrors and leaves out of your windscreen.",
    fx:{ slipBase:1 } },
  { id:"ironlung", name:"No. 40 \"Ironlung\" Petrov",  color:"#d86b6b", icon:"\uD83E\uDEC1", tier:2, ups:3,
    threat:"Carries 2 extra Heat in the Engine.",
    brief:"Petrov's car has more radiator than bodywork and he likes it that way.",
    fx:{ tank:2 } },
  { id:"twitch",   name:"No. 2 \"Twitch\" Okafor",     color:"#ff9f4f", icon:"\u26A1", tier:2, ups:3,
    threat:"Drives a full step above the rest of the field.",
    brief:"Okafor reacts to things that haven't happened yet.",
    ace:true, fx:{} },

  /* ---------- tier 3 · legends ---------- */
  { id:"maestro",  name:"No. 1 Elio \"Maestro\" Ferranti", color:"#ffd86b", icon:"\uD83C\uDFBC", tier:3, ups:5,
    threat:"Corner limits 2 higher, +1 Cooldown, and a garage full of parts.",
    brief:"Ferranti won his first title before you had a licence and has not been in a hurry since.",
    ace:true, fx:{ limitAdj:2, cool:1 } },
  { id:"comet",    name:"No. 21 Ines \"Comet\" Aguirre",   color:"#6bd48c", icon:"\u2604\uFE0F", tier:3, ups:5,
    threat:"Slipstreams 4 spaces and cannot be slipstreamed herself.",
    brief:"Aguirre spends the whole race in somebody's dirty air and arrives first anyway.",
    ace:true, fx:{ slipBase:2, noSlip:true } },
  { id:"anvil",    name:"No. 8 Magnus \"Anvil\" Thorsen",  color:"#8a6b3f", icon:"\uD83D\uDD28", tier:3, ups:5,
    threat:"Fills both spots of his Space and carries 3 spare Heat.",
    brief:"Thorsen has never conceded a corner in his life and isn't starting with you.",
    ace:true, fx:{ occupyBoth:true, tank:3 } },
  { id:"cinder",   name:"No. 13 Roza \"Cinder\" Balan",    color:"#ff6b1f", icon:"\uD83C\uDF0B", tier:3, ups:6,
    threat:"Huge Engine, refuels from her own discard pile every round.",
    brief:"Balan burns everything she has by half distance and somehow still has more.",
    ace:true, fx:{ tank:3, roundReclaim:1 } },
  { id:"scalpel",  name:"No. 6 Tam \"Scalpel\" Okonjo",    color:"#7fd4ff", icon:"\uD83D\uDD2A", tier:3, ups:5,
    threat:"Never spins out, and cools 1 better than anyone.",
    brief:"Okonjo has finished every race she has ever started. Every single one.",
    ace:true, fx:{ noSpin:true, cool:1 } },
  { id:"warlord",  name:"No. 99 Bo \"Warlord\" Vasseur",   color:"#d86b6b", icon:"\u2694\uFE0F", tier:3, ups:6,
    threat:"Every round he takes a place off you, you pick up a Stress card. Slipstreams 3.",
    brief:"Vasseur races like the stewards' room is somebody else's problem. It is.",
    ace:true, fx:{ stressOnPass:true, slipBase:1, spinStress:-1 } },
];

const bossById  = id => CAREER_BOSSES.find(b => b.id === id);
const rivalById = id => CAREER_RIVALS.find(r => r.id === id);
/* career.js asks for a roster by act: 1 → rookies, 2 → regulars, 3 → legends. */
function rivalsOfTier(t){
  const list = CAREER_RIVALS.filter(r => (r.tier || 2) === t);
  return list.length ? list : CAREER_RIVALS;
}

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
/* The player's merged mod fx for the career currently loaded.
   Two things that aren't mods merge in here as well, because they behave
   exactly like one:
     · G.career.tuning — work bought and paid for (Chop Shop Stress surgery)
     · G.career.damage — persistent spin-out damage, which is a mod with the
       signs reversed: every point is one more Stress card shuffled into the
       deck and one less Heat the Engine will hold. It rides along until a
       chop shop straightens the car. */
function careerDamageFx(){
  const d = (typeof G !== "undefined" && G.career) ? (G.career.damage|0) : 0;
  return d ? { stress:d, tank:-d } : null;
}
function careerModFx(){
  if(typeof G === "undefined" || !G.career || !G.career.mods) return mergeFx([]);
  const list = G.career.mods.map(id => (modById(id)||{}).fx);
  if(G.career.tuning) list.push(G.career.tuning);
  const dmg = careerDamageFx(); if(dmg) list.push(dmg);
  return mergeFx(list);
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
        /* damage can drive tank negative; the Engine still has to hold
           something or the car is undriveable, so it bottoms out at -2 */
        tank:       Math.max(-2, (base.tank||0) + (fx.tank||0)),
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
  const _cho = cornerHasOverheat;
  /* Ceramic Manifold: while the mod-holder's corner check runs, Overheat
     tokens answer "no". Everyone else's checks see the token as normal. */
  cornerHasOverheat = function(ct){
    if(G._ccNoOverheat) return false;
    return _cho(ct);
  };
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
    if(fx.noOverheat) G._ccNoOverheat = true;
    let r;
    try { r = _rcc(p); } finally { G._ccNoOverheat = false; }
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
    /* PERSISTENT DAMAGE — career mode only, and only for the human, and
       only once every "you got away with it" mod above has had its say. A
       spin that was saved (noSpin / Fireproof Gloves) never reaches here,
       so it never bends the car. career.js reads G._careerSpins when the
       race is over and converts it into permanent damage. */
    if(!p.isBot && G.mode === "career" && G.career){
      G._careerSpins = (G._careerSpins|0) + 1;
      const carried = (G.career.damage|0) + (G._careerSpins|0);
      if(carried <= 3)
        log("\uD83D\uDD29 That one bent something. The car will carry it out of here.", "warn");
    }

    /* Gearbox Guard — the spin still happens (Heat dumped, Stress taken,
       car back before the corner), but you keep all but one gear. */
    if(fx && fx.softSpinGear){
      const g = p.gear;
      const r = _spin(p, cornerTotal, tag, induced);
      if(p.gear === 1 && g > 2){
        p.gear = g - 1;
        if(!p.isBot) log(`\uD83D\uDEE1\uFE0F Gearbox Guard — you catch ${p.gear}${p.gear===2?"nd":p.gear===3?"rd":"th"} gear on the way round.`, "me");
        if(typeof renderGauges === "function") renderGauges();
      }
      return r;
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
      if(fx.roundShed){
        /* Pit Board — a Stress card leaves the hand. It's a discard, so a
           tunnel bars it (unless the headlights are fitted). */
        const inTunnel = (typeof inTunnelNow === "function") && inTunnelNow(p) && !fx.tunnelRat;
        if(!inTunnel){
          let n = fx.roundShed;
          while(n-- > 0){
            const i = (p.hand || []).findIndex(isStress);
            if(i < 0) break;
            p.discard.push(p.hand.splice(i, 1)[0]);
            if(!p.isBot) log("\uD83E\uDEA7 Pit Board — 1 Stress card goes in the bin.", "me");
          }
        }
      }
      if(fx.roundReclaim){
        /* Return Line — burnt Heat comes back from the discard pile. */
        let n = fx.roundReclaim, moved = 0;
        while(n-- > 0 && p.engine < heatCapFor(p)){
          const i = (p.discard || []).findIndex(isHeat);
          if(i < 0) break;
          p.discard.splice(i, 1); p.engine++; moved++;
        }
        if(moved && !p.isBot) log(`\u267B\uFE0F Return Line — ${moved} Heat drawn back out of the discard into the Engine.`, "me");
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

  /* ---- G · track-feature immunities -----------------------------------
     · gravelProof — Rally Suspension: applyGravel simply skips the holder.
     · tunnelRat   — Halogen Headlights: inTunnelNow answers "no" for the
       holder, which unlocks step-8 discards and Reduce Stress in tunnels.
     · floodProof  — Wet-Weather Kit: no extra Heat to downshift on a
       flooded Space (weatherShiftPenaltyHere reads 0). */
  if(typeof applyGravel === "function"){
    const _ag = applyGravel;
    applyGravel = function(p){
      const fx = fxOf(p);
      if(fx && fx.gravelProof){
        if(!p.isBot && typeof onGravel === "function" && onGravel(p))
          log("\uD83D\uDEFB Rally Suspension — the gravel hammers the sump guard and nothing else.", "me");
        return;
      }
      return _ag(p);
    };
  }
  if(typeof inTunnelNow === "function"){
    const _itn = inTunnelNow;
    inTunnelNow = function(p){
      const fx = fxOf(p);
      if(fx && fx.tunnelRat) return false;
      return _itn(p);
    };
  }
  if(typeof weatherShiftPenaltyHere === "function"){
    const _wsp = weatherShiftPenaltyHere;
    weatherShiftPenaltyHere = function(p){
      const fx = fxOf(p);
      if(fx && fx.floodProof) return 0;
      return _wsp(p);
    };
  }

  /* ---- H · beginMovementPhase() ---------------------------------------
     Caffeine Drip: the holder always counts among the "last cars", so
     Adrenaline (+1 Speed / +1 Cooldown) is on every round. Patched right
     after the stock function computes the genuine last-car list; the flag
     itself is only read later in the holder's own turn, so the timing is
     safe. Mods are player-only, so this never touches a bot. */
  const _bmp = beginMovementPhase;
  beginMovementPhase = function(){
    const r = _bmp.apply(this, arguments);
    for(const p of (G.players || [])){
      const fx = fxOf(p);
      if(fx && fx.alwaysAdrenaline && !p.isBot && !p.finished && !G.adrenalineIds.includes(p.id))
        G.adrenalineIds.push(p.id);
    }
    return r;
  };

  /* ---- I · makeHuman(...) ---------------------------------------------
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

  /* ---- J · handSize() -------------------------------------------------- */
  const _handSize = handSize;
  handSize = function(){
    const base = _handSize();
    if(G.mode !== "career" || !G.career) return base;
    return base + (careerModFx().handBonus || 0);
  };

  /* ---- K · makeBot(...) ------------------------------------------------
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

  console.log(`[career] hooks installed — ${CAREER_MODS.length} mods (${CAREER_LEGEND_MODS.length} legendary), ${CAREER_BOSSES.length} bosses, ${CAREER_RIVALS.length} rivals across 3 tiers.`);
})();
