"use strict";
/* ============================================================
   CAREER MODE — "Road to the Grand Final"
   A Mapforge-driven overworld for HEAT. Maps are genuine Mapforge
   JSON ({nodes,edges,...}) so they can be authored/edited in
   Mapforge and pasted straight in via Import.
   Node types → career meaning:
     enemy = race · elite = showdown (hard race) · boss = grand final
     event = roadside event · merchant = speed shop · rest = fuel stop
     treasure = prize crate · city/town/poi = "any" (you choose)
   Travelling to a node costs FUEL (+ a MONEY entry fee on big races).
   Each race has a win condition; meet it to claim the node. Fail and
   you may retry — but you pay the entry cost again.
   Label conventions (optional, set in Mapforge): a race node labelled
   "monaco", "monaco|top3" or "monaco|win|2" pins track / goal / laps.
   ============================================================ */
const CAREER_STORE = "heat_career_v1";
const CAREER_START = { rep:3, money:60 };

/* ============================================================
   SPONSOR CONFIDENCE  ⭐
   The old fuel tank charged you to travel, which punished exploring and
   never once threatened you. This does the opposite job: driving anywhere
   is FREE, and the only thing that costs you is failing. Miss a stop's
   objective and a backer loses patience. Run out of backers and the season
   is over — the transporter goes home whatever's in your wallet.
   Confidence is deliberately hard to buy back: sponsor days, the odd event,
   and winning the races that matter.
   ============================================================ */
const CAREER_REP_MAX  = 5;
const CAREER_REP_ICON = "\u2B50";
const CAREER_REP_NAME = "sponsor confidence";
/* pips, so the meter reads as a threat rather than a number */
function repPips(n, max){
  n = Math.max(0, n|0); max = max || CAREER_REP_MAX;
  return CAREER_REP_ICON.repeat(Math.min(n,max)) + "\u00B7".repeat(Math.max(0, max-n));
}
function careerRepAdd(n, why){
  const C = G.career; if(!C || !n) return 0;
  const before = C.rep|0;
  C.rep = Math.max(0, Math.min(CAREER_REP_MAX, before + n));
  const d = C.rep - before;
  if(d && typeof toast === "function")
    toast(`${CAREER_REP_ICON} ${d>0?"+":""}${d} confidence${why?" — "+why:""}`, d<0?"hot":"");
  saveCareer();
  return d;
}
/* true when the backers have finally walked */
function careerBroke(){ return (G.career.rep|0) <= 0; }

/* ============================================================
   PERSISTENT DAMAGE  \uD83D\uDD29
   A spin-out used to cost you the race and nothing else. Now the car
   remembers: every spin bends something permanent into it — one more Stress
   card shuffled into your deck for the rest of the career, and one less Heat
   the Engine will hold. It is a curse card with a panel-beating bill, and
   like a curse card the only cure is paying someone to take it out (chop
   shops, and the better speed shops).
   ============================================================ */
const CAREER_DMG_MAX  = 3;
const REPAIR_BASE = 55;
const REPAIR_STEP = 35;
const CAREER_MAXUP = Infinity;                // garage slots — no cap any more
const CAREER_POS_MONEY = [60,40,30,20,15,10,10,10];
const CAREER_ACT_COUNT = 3;

/* ============================================================
   THINNING THE DECK
   The garage is uncapped and every race hands out an Upgrade, so a long
   career ends with a deck too fat to draw through. Pulling a card back out
   is therefore a SERVICE you buy, not a lucky event roll: 🔧 Chop Shops sit
   on the map, and every 🛠️ Speed shop will do it too at a mark-up.
   The price climbs with every card you've had cut out this career, so
   thinning is a real decision rather than a chore you grind at every stop.
   ============================================================ */
const CHOP_BASE   = 35;    // first strip
const CHOP_STEP   = 20;    // …and each one after that
const CHOP_NODE_X = 0.6;   // 🔧 Chop Shop — it's their trade, so 40% off
const CHOP_SHOP_X = 1.25;  // 🛠️ Speed shop — they'd rather sell you parts
const CHOP_STRESS_PRICE = [120, 200];   // permanent −1 Stress, twice a career

/* ============================================================
   THE CHAMPIONSHIP TABLE
   Every race in an act is a round of the same championship, and the grid
   scores in it whether you turn up or not. Miss goals, skip stops, or lose
   to the same driver twice and somebody else banks the points — and the act
   final reads its opposition straight off the table: the leader is the car
   you meet, carrying an extra Upgrade card for every 10 points they're
   ahead of you. A bad act doesn't cost you cash; it costs you the wall you
   have to climb at the end of it.
   ============================================================ */
const CAREER_POINTS = [10,8,6,5,4,3,2,1];
const CAREER_PT_MULT = { race:1, drag:1, elite:1.5, actboss:2, boss:2 };

/* ============================================================
   THE THREE ACTS
   A career is a BOOK of three maps — one per act, one whole map screen
   each. Mapforge exports a bundle ({maps:{act1,act2,act3}}) so the three
   can be authored side by side and land here already aligned; a single-map
   export (or a preset, or the random roadmap) is cut into three act maps on
   import instead. Everything that scales — grid size, rival AI, how many
   Upgrade cards the opposition carries, which tier of named driver turns
   up — reads off which act map you're standing on.

   Every act ends on a boss race, and every boss race runs on one of the six
   boss boards (tracks/boss/boss1.js … boss6.js), drawn fresh per career:
     Act I  final  — 👑 Act Final   · boss board 1 of 3
     Act II final  — 👑 Act Final   · boss board 2 of 3
     Act III final — 🏆 Grand Final · boss board 3 of 3
   Win one of those OUTRIGHT (P1, not merely "goal met") and you take a
   LEGENDARY mod. Three boss races, six legendaries — you never get them all.
   ============================================================ */
const CAREER_ACTS = [
  null,
  { n:1, roman:"I",   name:"Backroads",     icon:"\uD83C\uDF3E",
    blurb:"Club meetings and cash-in-hand grudge races. The field can barely drive.",
    diff:1, bots:[4,5], nUp:[0,1], rivalChance:0.20 },
  { n:2, roman:"II",  name:"The Circuit",   icon:"\uD83C\uDFC1",
    blurb:"Proper grids, proper drivers, proper money. Everyone here has a trick.",
    diff:2, bots:[5,6], nUp:[2,3], rivalChance:0.40 },
  { n:3, roman:"III", name:"The Big Leagues", icon:"\uD83D\uDD25",
    blurb:"Legends only. They have full garages and no reason to be kind about it.",
    diff:3, bots:[6,7], nUp:[4,6], rivalChance:0.65 },
];
/* Which act you're in is now simply which map screen you're on — there is no
   floor-fraction arithmetic left. A node always belongs to the act whose map
   it is drawn on. */
function careerActOf(node){
  const C = G.career;
  if(!C) return 1;
  return Math.max(1, Math.min(CAREER_ACT_COUNT, (C.act | 0) + 1));
}
function actDef(n){ return CAREER_ACTS[Math.max(1, Math.min(3, n))]; }
function actLabel(n){ const a = actDef(n); return `${a.icon} Act ${a.roman} — ${a.name}`; }
function careerActCount(){ const C = G.career; return (C && C.book && C.book.acts.length) || CAREER_ACT_COUNT; }
function careerIsLastAct(){ return (G.career.act | 0) >= careerActCount() - 1; }
/* The one race that closes an act. Each act map is sealed with one on import
   (see sealActMap), so this is normally just "the node flagged actFinal" —
   the boss node, or the furthest-up race if a hand-built map has neither. */
function careerActFinalId(map){
  const m = map || (G.career && G.career.map);
  if(!m) return null;
  if(m._finalId !== undefined) return m._finalId;
  let pick = m.nodes.find(n => n.data && n.data.actFinal) || m.nodes.find(n => n.type === "boss");
  if(!pick){
    const races = m.nodes.filter(n => careerIsRaceNode(n) && n.type!=="trial");
    const elites = races.filter(n => n.type === "elite");
    const pool = elites.length ? elites : races;
    pick = pool.slice().sort((a,b) => (b.floor - a.floor) || (a.id < b.id ? -1 : 1))[0] || null;
  }
  m._finalId = pick ? pick.id : null;
  return m._finalId;
}
function careerIsActFinal(node){ return !!node && careerActFinalId() === node.id; }

/* ============================================================
   BOSS TRACKS  (tracks/boss/boss1.js … boss6.js)
   The act finals and the Grand Final never run an ordinary circuit. Each
   career draws three DIFFERENT boss boards out of the six at roll-up and
   pins one to each act, so the wall at the end of Act I is a different
   place every career — but stays the same place if you drive away from it
   and come back for a rematch.
   ============================================================ */
function careerBossTracks(){
  if(typeof TRACKS === "undefined" || !TRACKS) return [];
  return Object.keys(TRACKS).filter(k => /^boss/i.test(k) || TRACKS[k].boss === true);
}
function careerPickBossTracks(seed){
  const pool = careerBossTracks();
  if(!pool.length) return [];
  const R = careerRng(careerHash("boss|" + seed));
  for(let i = pool.length - 1; i > 0; i--){          // seeded shuffle
    const j = Math.floor(R() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const out = [];
  for(let a = 0; a < CAREER_ACT_COUNT; a++) out.push(pool[a % pool.length]);
  return out;
}
/* the boss board this act runs on — filled in lazily so a save made before
   the boss boards were loaded still picks them up */
function careerBossTrackFor(act){
  const C = G.career; if(!C) return null;
  if(!C.bossTracks || !C.bossTracks.filter(Boolean).length)
    C.bossTracks = careerPickBossTracks(C.seed || 1);
  const list = C.bossTracks || [];
  if(!list.length) return null;
  const k = list[Math.max(0, Math.min(list.length - 1, (act | 0) - 1))];
  return (typeof TRACKS !== "undefined" && TRACKS[k]) ? k : null;
}
const CTYPE = {
  start:{icon:"🚩",name:"Start line",blurb:"Where the road begins."},
  enemy:{icon:"🏁",name:"Race",blurb:"A sanctioned race. Meet the goal to claim the node."},
  drag:{icon:"🚦",name:"Drag race",blurb:"A straight-line sprint from lights to flag. One run down the strip — no laps, nowhere to hide."},
  elite:{icon:"🔥",name:"Showdown",blurb:"A big-money grudge race. Harder field, richer purse — win it outright and you take a Mod."},
  actboss:{icon:"👑",name:"Act Final",blurb:"The race that closes out this act. Claim it and the road opens to the trophy room beyond — a Legendary mod is waiting there."},
  boss:{icon:"🏆",name:"Grand Final",blurb:"The last race of the season. Claim it and the title — and one last Legendary in the room beyond — are yours."},
  legend:{icon:"🎁",name:"Trophy room",blurb:"The quiet room past the final. One Legendary mod, still in its case, with your name on it."},
  event:{icon:"❓",name:"Roadside event",blurb:"Something's happening out here. Could go either way."},
  merchant:{icon:"🛠️",name:"Speed shop",blurb:"Buy fuel and Upgrade cards for your car — and pay them to cut one back out."},
  chop:{icon:"🔧",name:"Chop Shop",blurb:"A yard that takes cars apart for a living. The cheapest place to get a card cut out of your deck."},
  rest:{icon:"\uD83E\uDD1D",name:"Sponsor day",blurb:"Handshakes, hospitality and a photo by the car. Buys back 1 \u2B50 sponsor confidence."},
  grudge:{icon:"\uD83D\uDE24",name:"Grudge match",blurb:"Somebody out here has unfinished business with you. Beat them and they stop turning up \u2014 lose and they come back angrier."},
  trial:{icon:"\u23F1\uFE0F",name:"Time trial",blurb:"Empty track, one car, one clock. No grid to hide in and nobody to slipstream."},
  night:{icon:"\uD83C\uDF03",name:"Night race",blurb:"Unsanctioned, unlit and uninsured. No entry fee and a fat purse \u2014 but spin it here and they impound a part off your car."},
  treasure:{icon:"💰",name:"Prize crate",blurb:"Somebody left something valuable behind."},
  city:{icon:"🌆",name:"City — your call",blurb:"Big smoke. Find a race, chase a story, or hit the parts market — your choice."},
  town:{icon:"🏘️",name:"Town — your call",blurb:"A small town with options: race, event or shop — your choice."},
  poi:{icon:"📍",name:"Landmark — your call",blurb:"A famous spot on the map. Race, event or shop — your choice."}
};
/* Travelling is free now — the map is yours to explore. What's left is the
   ENTRY FEE on the races that pay properly, which is a money decision, not
   a tax on curiosity. Night races charge nothing at all; that's the bait. */
const CCOST = { start:{f:0,m:0}, enemy:{f:0,m:0}, drag:{f:0,m:0}, elite:{f:0,m:20}, boss:{f:0,m:40},
  grudge:{f:0,m:0}, trial:{f:0,m:10}, night:{f:0,m:0},
  event:{f:0,m:0}, merchant:{f:0,m:0}, chop:{f:0,m:0}, rest:{f:0,m:0}, treasure:{f:0,m:0},
  city:{f:0,m:0}, town:{f:0,m:0}, poi:{f:0,m:0}, legend:{f:0,m:0} };
const CNODE_R = { start:16, boss:26, elite:20, city:18, enemy:14, drag:14, grudge:17, trial:15, night:16,
  event:14, merchant:15, chop:15, treasure:15, rest:15, town:14, poi:12, legend:19 };
/* every node type that ends in a race, in one place */
const CRACE_TYPES = ["enemy","drag","elite","boss","grudge","trial","night"];
function careerIsRaceNode(n){ return !!n && CRACE_TYPES.includes(n.type); }

/* seeded rng (same recipe as Mapforge, so maps feel consistent) */
function careerHash(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function careerRng(seed){ let s=seed>>>0; return ()=>{ s=(s+0x6D2B79F5)|0; let t=Math.imul(s^s>>>15,1|s); t=(t+Math.imul(t^t>>>7,61|t))^t; return ((t^t>>>14)>>>0)/4294967296; }; }

/* ---------------- persistence */
function saveCareer(){ try{ if(G.career) localStorage.setItem(CAREER_STORE, JSON.stringify(G.career)); }catch(e){} }
function loadCareerSave(){
  try{
    const r=localStorage.getItem(CAREER_STORE); if(!r) return null;
    const c=JSON.parse(r);
    c.mods=c.mods||[]; c.modSold=c.modSold||{};   // saves made before mods existed
    c.chops=c.chops|0;                            // cards cut out of the deck so far
    c.damage=c.damage|0; c.repairs=c.repairs|0; c.prPaid=c.prPaid|0;
    c.grudge=c.grudge||null; c.grudgeBeaten=c.grudgeBeaten||[];
    /* fuel → sponsor confidence. An old tank of 12 was a comfortable
       position, not a healthy one, so it converts to a middling 3. */
    if(c.rep==null){ c.rep = Math.max(1, Math.min(CAREER_REP_MAX, Math.round((c.fuel|0)/4))); delete c.fuel; }
    c.rep = Math.max(0, Math.min(CAREER_REP_MAX, c.rep|0));
    c.tuning=c.tuning||null;                      // career-level fx bought at a Chop Shop
    c.stressCuts=c.stressCuts|0;
    /* pre-book saves carried a single map and no acts — keep them playable by
       treating that map as a one-act book rather than binning the career */
    if(!c.book){
      const legacy = c.map;
      if(!legacy) return null;
      c.book = { name:c.mapName||"Custom map", acts:[legacy] };
      c.act = 0;
    }
    c.act = c.act | 0;
    c.stops = c.stops != null ? c.stops : (c.done||[]).length;
    c.actLog = c.actLog || [];
    if(!c.table || c.table.act !== (c.act|0)+1) c.table = { act:(c.act|0)+1, rows:[] };
    careerBindMap(c);
    return c;
  }catch(e){ return null; }
}
function clearCareerSave(){ try{ localStorage.removeItem(CAREER_STORE); }catch(e){} }

/* ---------------- map normalisation (accepts any Mapforge export) */
function normCareerMap(raw){
  let m = raw;
  if(m && m.maps){ m = m.maps[Object.keys(m.maps)[0]]; }         // whole-bundle export
  if(!m || !Array.isArray(m.nodes) || !m.nodes.length) throw new Error("No nodes found — export the map as JSON from Mapforge and paste the whole thing.");
  const nodes = m.nodes.map(n=>({ id:String(n.id), type:CTYPE[n.type]?n.type:"enemy",
    label:n.label||"", floor:+n.floor||0, x:+n.x||0, y:+n.y||0, data:n.data||null }));
  const ids = new Set(nodes.map(n=>n.id));
  const edges = (m.edges||[]).map(e=>[String(e[0]),String(e[1])]).filter(e=>ids.has(e[0])&&ids.has(e[1])&&e[0]!==e[1]);
  if(!edges.length) throw new Error("No edges — join the nodes up in Mapforge first.");
  const maxFloor = Math.max(...nodes.map(n=>n.floor));
  return { name:m.name||m.key||"Custom map", w:+m.w||600, h:+m.h||1400, dir:m.dir||"up", nodes, edges, maxFloor };
}

/* ============================================================
   THE ACT BOOK — three maps, one per act
   Accepts, in order of preference:
     · a Mapforge BUNDLE   {maps:{act1:…, act2:…, act3:…}}  → one map per act
     · an explicit         {acts:[map, map, map]}
     · a single map        → cut into three act maps by floor band
   Whatever comes in, what comes out is always three sealed act maps, each
   refitted so it fills one screen on its own.
   ============================================================ */
const CAREER_ACT_MARGIN = 80;
/* act1/act2/act3 sort ahead of anything else; otherwise author order stands */
function actKeyRank(k){
  const m = /(?:^|[^0-9])([0-9]+)\s*$/.exec(String(k));
  return /act/i.test(k) && m ? +m[1] : Infinity;
}
function normCareerBook(raw){
  let maps = [];
  if(raw && raw.maps && typeof raw.maps === "object" && !Array.isArray(raw.maps)){
    const keys = Object.keys(raw.maps);
    const ranked = keys.every(k => actKeyRank(k) !== Infinity)
      ? keys.slice().sort((a,b) => actKeyRank(a) - actKeyRank(b)) : keys;
    maps = ranked.map(k => normCareerMap(raw.maps[k]));
  } else if(raw && Array.isArray(raw.acts) && raw.acts.length){
    maps = raw.acts.map(normCareerMap);
  } else {
    maps = [normCareerMap(raw)];
  }
  const bookName = (raw && (raw.name || raw.key)) || maps[0].name || "Custom map";
  if(maps.length === 1) maps = splitMapIntoActs(maps[0]);
  if(maps.length > CAREER_ACT_COUNT) maps = maps.slice(0, CAREER_ACT_COUNT);
  /* an author who only drew two acts gets two acts — we don't invent a third */
  maps.forEach((m,i) => { sealActMap(m, i === maps.length-1, i); refitActMap(m); });
  return { name:bookName, acts:maps };
}
/* one map → three, cut across the floors. Edges that would have crossed a cut
   are dropped; each act's own final race is added by sealActMap afterwards. */
function splitMapIntoActs(map){
  const F = map.maxFloor;
  if(F < CAREER_ACT_COUNT - 1) return [map];          // too short to cut sensibly
  const out = [];
  for(let a = 0; a < CAREER_ACT_COUNT; a++){
    const lo = Math.round(a * (F + 1) / CAREER_ACT_COUNT);
    const hi = (a === CAREER_ACT_COUNT - 1) ? F : Math.round((a + 1) * (F + 1) / CAREER_ACT_COUNT) - 1;
    let nodes = map.nodes.filter(n => n.floor >= lo && n.floor <= hi);
    /* the start flag only makes sense at the bottom of Act I */
    if(a > 0) nodes = nodes.filter(n => n.type !== "start");
    if(!nodes.length) continue;
    const ids = new Set(nodes.map(n => n.id));
    const edges = map.edges.filter(e => ids.has(e[0]) && ids.has(e[1]));
    const acted = nodes.map(n => Object.assign({}, n, { floor: n.floor - lo }));
    out.push({ name: map.name, w: map.w, h: map.h, dir: map.dir,
               nodes: acted, edges: edges.map(e => e.slice(0,2)),
               maxFloor: Math.max(...acted.map(n => n.floor)) });
  }
  return out.length ? out : [map];
}
/* Guarantee the act ends where it should: one race node above everything
   else, fed by every node on the previous top floor, so there is no way to
   drive out of an act without going through its boss. If the author already
   drew a boss node we use theirs and just flag it. */
function sealActMap(map, isLast, idx){
  if(!(map.maxFloor >= 0)) map.maxFloor = Math.max(...map.nodes.map(n => +n.floor || 0));
  const xs = map.nodes.map(n => n.x), ys = map.nodes.map(n => n.y);
  const span = Math.max(...ys) - Math.min(...ys);
  const gap = Math.max(90, span / Math.max(1, map.maxFloor));
  /* dir "up" means higher floors sit further up the screen (smaller y) */
  const upY = y => (map.dir === "down") ? y + gap : y - gap;
  let fin = map.nodes.find(n => n.data && n.data.actFinal) || map.nodes.find(n => n.type === "boss");
  if(fin){
    fin.type = isLast ? "boss" : (fin.type === "boss" ? "elite" : fin.type);
    fin.data = Object.assign({}, fin.data, { actFinal:true });
  } else {
    const top = map.maxFloor;
    const topRow = map.nodes.filter(n => n.floor === top);
    const y0 = (map.dir === "down") ? Math.max(...ys) : Math.min(...ys);
    const id = "actfinal" + (idx == null ? "" : idx);
    fin = { id, type: isLast ? "boss" : "elite", label:"",
            floor: top + 1, x: Math.round((Math.min(...xs) + Math.max(...xs)) / 2),
            y: Math.round(upY(y0)), data:{ actFinal:true } };
    map.nodes.push(fin);
    for(const n of topRow) map.edges.push([n.id, fin.id]);
    map.maxFloor = top + 1;
  }
  map._finalId = fin.id;
  /* The transition room — one floor past the boss, holding the act's
     Legendary mod. Every act map gets exactly one, drag-drawn or generated,
     so an act always ends: boss race → trophy room → next map screen. */
  let trans = map.nodes.find(n => n.type === "legend");
  if(!trans){
    trans = { id: "acttrans" + (idx == null ? "" : idx), type:"legend", label:"",
              floor: fin.floor + 1, x: fin.x, y: Math.round(upY(fin.y)),
              data:{ transition:true } };
    map.nodes.push(trans);
    map.edges.push([fin.id, trans.id]);
    map.maxFloor = Math.max(map.maxFloor, trans.floor);
  } else if(!map.edges.some(e => e[0] === fin.id && e[1] === trans.id)){
    map.edges.push([fin.id, trans.id]);
  }
  return map;
}
/* Sit the act's content in its own box so "fit" shows the whole act, full
   screen, with nothing letterboxed off the side. Nothing is rescaled — the
   shape the map was drawn in is kept, the frame just shrinks to it. */
function refitActMap(map){
  const xs = map.nodes.map(n => n.x), ys = map.nodes.map(n => n.y);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const dx = CAREER_ACT_MARGIN - x0, dy = CAREER_ACT_MARGIN - y0;
  map.nodes.forEach(n => { n.x = Math.round(n.x + dx); n.y = Math.round(n.y + dy); });
  map.w = Math.round(Math.max(...map.nodes.map(n => n.x)) + CAREER_ACT_MARGIN);
  map.h = Math.round(Math.max(...map.nodes.map(n => n.y)) + CAREER_ACT_MARGIN);
  return map;
}
/* C.map is always "the act you're standing on". Defined non-enumerably so it
   never gets written into the save twice — the book is the single source. */
function careerBindMap(C){
  if(!C || !C.book) return C;
  try{ delete C.map; }catch(e){}
  Object.defineProperty(C, "map", {
    configurable:true, enumerable:false,
    get(){ const a = C.book.acts; return a[Math.max(0, Math.min(a.length - 1, C.act | 0))]; }
  });
  return C;
}
/* ---------------- mod lookup (data lives in js/career-mods.js)
   These wrappers deliberately do NOT declare modById / MOD_TINT / CAREER_MODS
   themselves — career-mods.js owns those names, and a duplicate top-level
   declaration here would kill that file with a SyntaxError. Instead we look
   the real ones up at call time, so if career-mods.js is missing the career
   map still renders (just with no mods) rather than throwing. */
function cmodList(){
  if(typeof CAREER_MODS === "undefined" || !CAREER_MODS) return [];
  return Array.isArray(CAREER_MODS) ? CAREER_MODS : Object.values(CAREER_MODS);
}
function cmodById(id){
  if(id == null) return null;
  if(typeof modById === "function") return modById(id) || null;
  return cmodList().find(m => m && String(m.id) === String(id)) || null;
}
const CMOD_TINT_FALLBACK = { common:"#9fb8d0", uncommon:"#6bd48c", rare:"#ffd86b", legendary:"#ff7bd5" };
function cmodTint(rarity){
  const t = (typeof MOD_TINT !== "undefined" && MOD_TINT) ? MOD_TINT : CMOD_TINT_FALLBACK;
  return t[rarity] || CMOD_TINT_FALLBACK[rarity] || "#9fb8d0";
}

function cnById(id){ return G.career.map.nodes.find(n=>n.id===id); }
function cnKids(id){ return G.career.map.edges.filter(e=>e[0]===id).map(e=>e[1]); }
function careerCostOf(node){
  const c = CCOST[node.type]||{f:0,m:0}, d=node.data||{};
  let m = (d.feeM!=null?+d.feeM:c.m);
  /* Jerry Can and friends used to make travel cheaper; there is no travel
     cost left to cut, so the same perk now knocks $10 a point off entry
     fees. The mod keeps working, it just works on the thing that's left. */
  const disc = (typeof careerPerk==="function") ? careerPerk("fuelDiscount") : 0;
  if(disc && m>0) m = Math.max(0, m - 10*disc);
  return { f:0, m };
}
function careerReachable(){
  const C=G.career;
  if(C.at==null){
    const mf=Math.min(...C.map.nodes.map(n=>n.floor));
    return C.map.nodes.filter(n=>n.floor===mf && n.type!=="start");
  }
  return cnKids(C.at).filter(id=>!C.done.includes(id)).map(cnById).filter(Boolean);
}

/* ---------------- new career */
function newCareer(rawMap){
  const book = normCareerBook(rawMap);
  const start = book.acts[0].nodes.find(n=>n.type==="start");
  const seed = Math.floor(Math.random()*1e9);
  G.career = { v:2, book, mapName:book.name, act:0,
    at: start?start.id:null, done: start?[start.id]:[], pending:null, stops:0, actLog:[],
    rep:CAREER_START.rep, money:CAREER_START.money,
    cls:G.playerCls||"ghost", upgrades:[], mods:[], shopSold:{}, modSold:{},
    chops:0, stressCuts:0, tuning:null, table:{ act:1, rows:[] },
    damage:0, repairs:0, prPaid:0, grudge:null, grudgeBeaten:[],
    races:0, wins:0, seed, bossTracks: careerPickBossTracks(seed) };
  careerBindMap(G.career);
  saveCareer();
}
/* Act over — wipe the road behind you and open the next map screen. Fuel,
   money, upgrades and mods all carry across; only the map resets. */
function careerAdvanceAct(){
  const C=G.career;
  /* the act's championship goes in the logbook and a fresh table opens —
     points never carry across, so every act is its own season */
  C.actLog.push({ act:(C.act|0)+1, stops:(C.done||[]).length,
                  table:(C.table&&C.table.rows||[]).slice(0,5).map(r=>({name:r.name,pts:r.pts})) });
  C.act = (C.act|0) + 1;
  C.table = { act:(C.act|0)+1, rows:[] };
  C.pending=null;
  const start = C.map.nodes.find(n=>n.type==="start");
  C.at = start?start.id:null;
  C.done = start?[start.id]:[];
  saveCareer();
}

/* ============================================================
   CHAMPIONSHIP TABLE
   One table per act. Every car that takes a start scores, including you,
   and the rows persist between races so the same names climb the sheet
   across the act. Identity is deliberately loose: a named driver is keyed
   by their roster id (so Cinder is Cinder wherever she turns up), and an
   anonymous bot is keyed by its grid index, which BOT_POOL keeps stable —
   good enough to read like a season without inventing a driver market.
   ============================================================ */
function careerTable(){
  const C=G.career; if(!C) return { act:1, rows:[] };
  if(!C.table || C.table.act !== (C.act|0)+1) C.table = { act:(C.act|0)+1, rows:[] };
  return C.table;
}
function careerTableKey(p){
  if(!p.isBot) return "you";
  if(p._careerSpec && p._careerSpec.id) return "r:"+p._careerSpec.id;
  return "b:"+(p.botIndex!=null?p.botIndex:p.name||"?");
}
function careerTableRow(key, p){
  const T=careerTable();
  let row=T.rows.find(r=>r.key===key);
  if(!row){
    row={ key, name: p.isBot?(p.name||"Privateer"):"No. 17 — You", color:p.color||"#ffd86b",
          named: !!(p._careerSpec&&p._careerSpec.id), rivalId:(p._careerSpec&&p._careerSpec.id)||null,
          pts:0, starts:0, wins:0, best:null };
    T.rows.push(row);
  }
  if(p.isBot && p.name) row.name=p.name;
  return row;
}
/* points for one finished race — called from careerRaceOver */
function careerTableRecord(order, cfg){
  const mult=CAREER_PT_MULT[cfg.kind]!=null?CAREER_PT_MULT[cfg.kind]:1;
  order.forEach((p,i)=>{
    const row=careerTableRow(careerTableKey(p), p);
    const base=p.dq?0:(CAREER_POINTS[i]!=null?CAREER_POINTS[i]:0);
    row.pts   += Math.round(base*mult);
    row.starts+= 1;
    if(!p.dq && i===0) row.wins+=1;
    if(!p.dq && (row.best==null || i+1<row.best)) row.best=i+1;
  });
  careerTable().rows.sort((a,b)=> b.pts-a.pts || b.wins-a.wins || (a.best||99)-(b.best||99));
}
function careerTableYou(){ return careerTable().rows.find(r=>r.key==="you") || null; }
/* the driver at the top of the table who isn't you */
function careerTableLeader(){ return careerTable().rows.filter(r=>r.key!=="you")[0] || null; }
function careerTableGap(){
  const you=careerTableYou(), lead=careerTableLeader();
  if(!lead) return 0;
  return Math.max(0, lead.pts - (you?you.pts:0));
}
/* How much harder the act final gets because the championship ran away from
   you: one extra Upgrade card per 10 points of deficit, capped at 2. */
function careerTableBump(){ return Math.max(0, Math.min(2, Math.floor(careerTableGap()/10))); }
function careerTablePos(){
  const rows=careerTable().rows, i=rows.findIndex(r=>r.key==="you");
  return i<0?null:i+1;
}
function careerTableHTML(compact){
  const rows=careerTable().rows;
  if(!rows.length) return `<div class="crow" style="color:#8f86a8">No rounds run in this act yet — the table opens with your first race.</div>`;
  const list=compact?rows.slice(0,6):rows;
  return list.map((r,i)=>`
    <div class="standrow"${r.key==="you"?' style="background:rgba(180,140,255,.14);border-radius:6px"':""}>
      <div class="p">${i+1}</div>
      <div class="dot" style="background:${r.color}"></div>
      <div>${esc(r.name)}${r.named?" ★":""}</div>
      <div style="margin-left:auto;color:var(--cream-dim);font-size:12px">${r.starts} start${r.starts===1?"":"s"}</div>
      <div style="width:42px;text-align:right;font-weight:800;color:#ffd86b">${r.pts}</div>
    </div>`).join("");
}
function showCareerStandings(){
  const box=$("#cdetail"); if(!box) return;
  const lead=careerTableLeader(), gap=careerTableGap(), bump=careerTableBump(), pos=careerTablePos();
  box.innerHTML=`<div class="cdetail">
    <h3>📊 ${esc(actLabel((G.career.act|0)+1))} — championship</h3>
    <div class="crow" style="color:#bdb3d4">Every start in this act scores. The act final fields the leader.</div>
    ${careerTableHTML(false)}
    ${lead?`<div class="crow" style="margin-top:8px">${pos?`You're <b>P${pos}</b>. `:""}${gap
      ? `<b style="color:${bump?"#e0b070":"#bdb3d4"}">${esc(lead.name)}</b> is ${gap} point${gap===1?"":"s"} up the road${bump?` — they'll bring <b style="color:#e0b070">${bump} extra Upgrade card${bump===1?"":"s"}</b> to the act final.`:"."}`
      : `You're leading the act. The final still has to be won, but nobody's turning up better armed than usual.`}</div>`:""}
    <div class="btnrow" style="margin-top:8px"><button class="act secondary" id="cstClose">Close</button></div></div>`;
  $("#cstClose").onclick=()=>{ box.innerHTML=""; };
}

/* ============================================================
   THE NEMESIS  \uD83D\uDE24
   A grudge node doesn't roll a fresh driver — it fields the one driver in
   this act who has a problem with you, and keeps fielding them until one of
   you settles it. Beat them and they're off your card for good (and you
   take a Mod for it). Lose and they come back a level up, carrying another
   Upgrade card and another grudge. Derived, never guessed: this function is
   pure so the map can render it without committing to anything.
   ============================================================ */
function careerGrudgeRival(act){
  const C=G.career; if(!C) return null;
  if(C.grudge && C.grudge.id && typeof rivalById==="function" && rivalById(C.grudge.id))
    return rivalById(C.grudge.id);
  const tier = (typeof rivalsOfTier==="function") ? rivalsOfTier(act) : CAREER_RIVALS;
  const beaten = C.grudgeBeaten||[];
  /* someone from this act's tier who hasn't already been seen off; failing
     that anyone at all who hasn't; and only if you've beaten the entire
     roster does a retired driver get dragged back out */
  const fresh = l => l.filter(r=>!beaten.includes(r.id));
  const list = fresh(tier).length ? fresh(tier)
             : fresh(CAREER_RIVALS).length ? fresh(CAREER_RIVALS)
             : tier;
  if(!list.length) return null;
  const R = careerRng(careerHash("grudge|"+C.seed+"|"+act+"|"+beaten.length));
  return list[Math.floor(R()*list.length)];
}
function careerGrudgeLevel(foe){
  const C=G.career;
  return (C && C.grudge && foe && C.grudge.id===foe.id) ? (C.grudge.level|0) : 0;
}
/* called from the result screen — the only place the grudge state moves */
function careerGrudgeSettle(foe, beat){
  const C=G.career; if(!C||!foe) return;
  if(beat){
    C.grudgeBeaten=(C.grudgeBeaten||[]).concat([foe.id]);
    C.grudge=null;
  } else {
    C.grudge={ id:foe.id, level:careerGrudgeLevel(foe)+1 };
  }
  saveCareer();
}

/* ---------------- time trials */
/* Target round count for a solo run. Worked out from the actual board once
   it's loaded, so it scales with track length instead of being a guess, and
   tightens as the acts go on. */
function careerTrialTarget(cfg){
  let spaces = 0;
  try{ if(typeof lapEndTotal==="function") spaces = lapEndTotal(cfg.laps||1); }catch(e){}
  if(!spaces) spaces = 60*(cfg.laps||1);
  const slack = cfg.act>=3 ? 0 : cfg.act===2 ? 1 : 2;
  return Math.max(4, Math.ceil(spaces/8.5) + slack);
}

/* ---------------- per-node race config (deterministic per career) */
function nodeSeed(node){ return careerHash(G.career.mapName+"|a"+(G.career.act|0)+"|"+node.id+"|"+G.career.seed); }
/* Drag strips: boards that live in tracks/drag/ (drag1.js, drag2.js, …).
   Anything whose key starts with "drag", carries a drag:true flag, or is an
   open (point-to-point) board with "drag"/"strip" in its name counts. They
   are kept OUT of the normal circuit pool and only used for drag races. */
function careerDragTracks(){
  return Object.keys(TRACKS).filter(k => /^drag/i.test(k) || TRACKS[k].drag===true ||
    (typeof layoutOf==="function" && layoutOf(TRACKS[k])==="open" && /drag|strip/i.test(TRACKS[k].name||"")));
}
/* The Grand-Prix distance printed on a board. track.js may carry it as
   laps / gpLaps / meta.laps — whatever's there and sane (1–9) is honoured;
   a board that doesn't say defaults to the classic 2. */
function trackGpLaps(k){
  const t = (typeof TRACKS!=="undefined" && TRACKS) ? TRACKS[k] : null;
  const raw = t ? (t.laps!=null?t.laps : t.gpLaps!=null?t.gpLaps : (t.meta&&t.meta.laps)) : null;
  const n = +raw;
  return (n>=1 && n<=9) ? Math.round(n) : 2;
}
function nodeRaceCfg(node, kindOverride){
  const R = careerRng(nodeSeed(node));
  /* Four kinds. An "actboss" is the race that closes Act I or Act II; the
     same node on the last act's map is the "boss" — the Grand Final.
     kindOverride ("race", from a city/town/poi stop) never promotes. */
  const actFinal = !kindOverride && careerIsActFinal(node);
  const kind = kindOverride ||
    (actFinal ? (careerIsLastAct() ? "boss" : "actboss") :
     node.type==="boss"   ? "boss" :
     node.type==="elite"  ? "elite" :
     node.type==="grudge" ? "grudge" :
     node.type==="trial"  ? "trial" :
     node.type==="night"  ? "night" : "race");
  const dragKeys = careerDragTracks();
  const bossKeys = careerBossTracks();
  /* ordinary stops draw from circuits only — no drag strips, no boss boards */
  let tks = Object.keys(TRACKS).filter(k=>!dragKeys.includes(k) && !bossKeys.includes(k));
  if(!tks.length) tks = Object.keys(TRACKS).filter(k=>!bossKeys.includes(k));
  if(!tks.length) tks = Object.keys(TRACKS);
  let track=null, cond=null, laps=null, dragPin=false;
  (node.label||"").toLowerCase().split("|").map(s=>s.trim()).forEach(p=>{
    if(TRACKS[p]) track=p;
    else if(p==="drag") dragPin=true;
    else if(["win","top2","top3","top5","lap1","rival"].includes(p)) cond=p;
    else if(/^[123]$/.test(p)) laps=+p;
  });
  const d=node.data||{};
  const pinned = !!(track || (d.track && TRACKS[d.track]));   // author's call wins
  track = track || (TRACKS[d.track]?d.track:null) || tks[Math.floor(R()*tks.length)];
  const frac = node.floor/Math.max(1,G.career.map.maxFloor);
  /* ---- act scaling ------------------------------------------------------
     Difficulty, grid size and how tooled-up the opposition is all come off
     the act now. Act I is a club meeting; Act III is a legends' grid where
     every bot is carrying four to six Upgrade cards. The player is meant to
     have out-built them by then — that's what the unlimited garage is for. */
  const act = careerActOf(node);
  const A = actDef(act);
  /* ---- the boss board ---------------------------------------------------
     An act final / Grand Final is always run on this act's boss board, drawn
     out of tracks/boss/ at roll-up. A track pinned on the node in Mapforge
     still wins — that's the escape hatch for hand-authored maps. */
  let onBossBoard = false;
  if(kind==="boss" || kind==="actboss"){
    const bt = pinned ? null : careerBossTrackFor(act);
    if(bt){ track = bt; onBossBoard = true; }
  }
  let diff = A.diff;
  let bots = A.bots[0] + Math.floor(R()*(A.bots[1]-A.bots[0]+1));
  if(kind==="elite"){ diff=Math.min(3,diff+1); bots=Math.min(7,bots+1); }
  if(kind==="grudge"){ diff=Math.min(3,diff+1); bots=Math.max(3,Math.min(6,bots-1)); }
  if(kind==="night"){ diff=Math.min(3,diff+1); bots=Math.min(7,bots+1); }
  if(kind==="trial"){ diff=A.diff; bots=0; }        // empty track — you and the clock
  if(kind==="actboss"){ diff=Math.min(3,diff+1); bots=7; }
  if(kind==="boss"){ diff=3; bots=7; }
  /* Regular (enemy) races always run a single lap — 2 laps drags on. A lap
     count pinned in the label or node data is still honoured, and Showdowns /
     the Grand Final keep their old roll. (The unused roll is still drawn so
     the seeded stream — cond, weather, rival — stays identical on old saves.) */
  const lapsPinned = laps || (+d.laps>=1?Math.min(3,+d.laps):null);
  const lapRoll = lapsPinned ? null : (R()<0.35?2:1);
  laps = lapsPinned || (kind==="race" ? 1 : lapRoll);
  if(kind==="trial" && !lapsPinned) laps = 1;      // one flying lap, not an endurance run
  /* Showdowns and the act/grand finals are full Grand Prix distance — the
     lap count printed on their board (2 or 3, per track.js). A lap count
     pinned on the node in Mapforge still wins. */
  if((kind==="boss"||kind==="actboss"||kind==="elite") && !lapsPinned) laps = trackGpLaps(track);
  cond = cond || d.cond || null;
  if(kind==="trial")  cond="time";                  // the clock is the only opponent
  if(kind==="grudge") cond="rival";                 // and here it's only ever the one car
  if(!cond){
    if(kind==="boss") cond="win";
    else if(kind==="actboss") cond = R()<0.6?"win":"top2";
    else if(kind==="elite") cond = R()<0.5?"win":"top2";
    else { const pool = laps>=2 ? ["top5","top3","top3","lap1","rival","win"] : ["top5","top3","top3","rival","win"];
           cond = pool[Math.floor(R()*pool.length)]; }
  }
  if(cond==="lap1" && laps<2) laps=2;
  /* Drawn here so the seeded stream stays byte-identical to older saves.
     When a NAMED driver is on the grid this gets repointed at slot 0 below,
     because that's where startCareerRace always parks them. */
  let rivalIdx = Math.floor(R()*Math.min(bots,BOT_POOL.length));
  const wkeys = Object.keys(WEATHER_TYPES).filter(k=>k!=="none");
  const weather = R()<0.45 ? wkeys[Math.floor(R()*wkeys.length)] : "none";
  const mult = kind==="elite"?1.5 : kind==="actboss"?1.8 : kind==="boss"?2.2
             : kind==="night"?1.7 : kind==="grudge"?1.4 : kind==="trial"?1.2 : 1;
  const posM = CAREER_POS_MONEY.map(v=>Math.round(v*mult*(1+0.15*(act-1))));
  /* ---- what's on the table ---------------------------------------------
     upg    — hit the goal and you pick 1 Upgrade card out of 3. Every race
              pays this now; there's no garage cap to run into any more.
     mod    — WIN OUTRIGHT (P1) at a Showdown and you pick a Mod. Merely
              meeting an easier goal doesn't do it.
     legend — the act's Legendary now lives in the transition room PAST the
              final (see the "legend" node), so the boss races themselves no
              longer carry it: claim the final, walk through, collect. */
/* ---- what meeting the goal is worth ------------------------------------
     rep — the only places sponsor confidence is handed back for driving.
           Ordinary stops pay nothing: keeping the backers happy is about
           NOT missing goals, and the big races are how you claw one back. */
  const bonus = kind==="boss"     ? {m:140,rep:2,upg:true}
              : kind==="actboss"  ? {m:90, rep:1,upg:true}
              : kind==="elite"    ? {m:60, rep:1,upg:true,mod:true}
              : kind==="grudge"   ? {m:70, rep:1,upg:true,mod:true}
              : kind==="night"    ? {m:80, rep:0,upg:true,mod:true}
              : kind==="trial"    ? {m:55, rep:0,upg:true}
              :                     {m:30, rep:0,upg:true};
  /* Upgrade cards in the opposition's decks — the toughness dial that the
     player's own (uncapped) garage is meant to answer. */
  /* ---- how tooled-up the opposition is ---------------------------------
     The act sets the floor, but the grid also answers YOUR car: every 4
     Upgrade cards in your garage puts one more in each of theirs. Nothing
     here is retroactive — walk into a shop, buy four cards, and the next
     stop you look at has already re-armed. */
  let nUp = A.nUp[0] + Math.floor(R()*(A.nUp[1]-A.nUp[0]+1));
  const garageBump = Math.floor(((G.career.upgrades||[]).length)/4);
  nUp += garageBump;
  if(kind==="elite")   nUp += 1;
  if(kind==="actboss") nUp += 2;
  if(kind==="boss")    nUp += 2;
  /* An act final is the championship's last round, so it also reads the
     table: the further the leader has run away from you, the deeper the
     garage they turn up with. */
  const tableBump = (kind==="actboss"||kind==="boss") ? careerTableBump() : 0;
  nUp += tableBump;
  nUp = Math.max(0, Math.min(8, nUp));
  /* ---- drag races -------------------------------------------------------
     A stop runs as a drag race when: the node is a 🚦 drag node, its label
     says "drag" (or names a drag board directly), or — so drags also show up
     on presets and imported maps — a seeded ~1-in-6 of ordinary race stops
     converts, whenever drag boards are loaded. A drag is one straight sprint:
     forced 1 lap, no lap-1 goal, its own board. Rolled off a separate seeded
     stream so it never disturbs the config of the other stops. */
  let drag=false;
  if(dragKeys.length && !onBossBoard){
    const R2 = careerRng(nodeSeed(node)+13);
    const convert = R2();
    drag = node.type==="drag" || dragPin ||
           (dragKeys.includes(track) && ["race","drag"].includes(kind)) ||
           (kind==="race" && node.type==="enemy" && !kindOverride && convert<0.17);
    if(drag){
      if(!dragKeys.includes(track)) track = dragKeys[Math.floor(R2()*dragKeys.length)];
      laps = 1;
      if(cond==="lap1") cond = ["win","top2","top2","top3","rival"][Math.floor(R2()*5)];
    }
  }
  /* ---- named opposition -------------------------------------------------
     Tier follows the act, so the same "Showdown" node type fields a club
     rookie in Act I and a legend in Act III. The Grand Final draws from the
     boss roster; act finals draw the top rival of their act (Act II's final
     borrows a tier-3 legend early, which is exactly the wall it should be).
     Ordinary races roll for a named driver at the act's rivalChance.
     All seeded off the node, so a stop always fields the same driver — you
     can lose to them, drive away, and come back for a rematch. */
  let boss=null, rival=null;
  const pickFrom = (list, r) => list[Math.floor(r*list.length)];
  const tierList = t => (typeof rivalsOfTier==="function") ? rivalsOfTier(t) : CAREER_RIVALS;
  if(kind==="boss"){
    boss = (node.data&&bossById(node.data.boss)) || pickFrom(CAREER_BOSSES, R());
  } else if(kind==="actboss"){
    rival = (node.data&&rivalById(node.data.rival)) || pickFrom(tierList(Math.min(3, act+1)), R());
  } else if(kind==="elite"){
    rival = (node.data&&rivalById(node.data.rival)) || pickFrom(tierList(act), R());
  } else if(kind==="grudge"){
    rival = (node.data&&rivalById(node.data.rival)) || careerGrudgeRival(act);
  } else if(kind==="trial"){
    rival = null;                                   // nobody out there but you
  } else {
    const roll = R();
    if(node.data&&rivalById(node.data.rival)) rival = rivalById(node.data.rival);
    else if(roll < A.rivalChance) rival = pickFrom(tierList(act), R());
  }
  /* ---- the table picks the fight ----------------------------------------
     If a NAMED driver is top of the act's championship, they are the one
     waiting at the act final — the seeded pick is only the fallback for a
     table with nobody on it. Beating them all act is how you avoid this. */
  if(kind==="actboss" && !(node.data&&node.data.rival)){
    const lead = careerTableLeader();
    const led  = lead && lead.rivalId && (typeof rivalById==="function") ? rivalById(lead.rivalId) : null;
    if(led) rival = led;
  }
  const foe = boss || rival;
  /* Named drivers always take grid slot 0 (see startCareerRace), so the
     "beat your rival" goal points at them and nowhere else. foeId is the
     identity the result screen scores against — an index alone goes stale
     the moment the grid is rebuilt. */
  if(foe) rivalIdx = 0;
  /* every round they've beaten you, the nemesis turns up better prepared */
  const grudgeLvl = kind==="grudge" ? careerGrudgeLevel(foe) : 0;
  return { kind, act, track, laps, diff, bots, cond, rivalIdx, weather, posM, bonus, nUp, drag,
           garageBump, tableBump, grudgeLvl,
           night: kind==="night", trial: kind==="trial",
           foeUps: foe ? Math.min(9, (foe.ups!=null?foe.ups:nUp) + garageBump + tableBump + grudgeLvl) : nUp,
           foeId: foe?foe.id:null,
           bossId:boss?boss.id:null, rivalId:rival?rival.id:null, seed:nodeSeed(node) };
}
/* the face a race stop wears on the map — drags show 🚦, act finals show 👑 */
function careerNodeFace(node, cfg){
  if(cfg && cfg.drag) return CTYPE.drag;
  if(cfg && cfg.kind==="actboss") return CTYPE.actboss;
  return CTYPE[node.type] || CTYPE.enemy;
}
function careerNodeIsDrag(node){
  if(node.type==="drag") return true;
  if(node.type!=="enemy") return false;
  try{ return !!nodeRaceCfg(node).drag; }catch(e){ return false; }
}
/* the icon a node wears on the map: 🚦 for a converted drag, 👑 for an act
   final, otherwise its own type icon. Safe on non-race nodes. */
function careerMapFace(node){
  if(!careerIsRaceNode(node)) return CTYPE[node.type];
  try{ return careerNodeFace(node, nodeRaceCfg(node)); }catch(e){ return CTYPE[node.type]; }
}
/* Team Orders drops a goal one rung. Applied at read time so picking up or
   scrapping the mod re-rates every stop on the map immediately. */
const COND_EASE = { win:"top2", top2:"top3", top3:"top5", top5:"top5", lap1:"lap1", rival:"rival" };
function effectiveCond(cfg){
  const ease = (typeof careerPerk==="function") ? careerPerk("goalEase") : 0;
  let c = cfg.cond;
  for(let i=0;i<ease;i++) c = COND_EASE[c] || c;
  return c;
}
function condName(cfg){
  cfg = Object.assign({}, cfg, {cond:effectiveCond(cfg)});
  switch(cfg.cond){
    case "win":  return "Win the race";
    case "top2": return "Finish 1st or 2nd";
    case "top3": return "Finish on the podium — top 3";
    case "top5": return "Finish 5th or better";
    case "lap1": return "Lead at the end of lap 1";
    case "rival":return "Finish ahead of "+careerRivalLabel(cfg);
    case "time": return cfg.target ? `Finish inside ${cfg.target} rounds` : "Beat the target time";
  }
  return "Finish the race";
}
/* the named driver for this race, if there is one */
function careerFoe(cfg){ return (cfg.bossId&&bossById(cfg.bossId)) || (cfg.rivalId&&rivalById(cfg.rivalId)) || null; }
function careerFoeName(cfg){ const f=careerFoe(cfg); return f?f.name:null; }

/* ============================================================
   THE RIVAL TARGET
   One definition, used by the goal text, the briefing, the 🎯 marker on the
   result sheet and the pass/fail check — so the car the goal NAMES is always
   the car the goal SCORES. Identity first (a named driver keeps their id
   wherever they're gridded), grid index only as the fallback for an
   anonymous "beat the blue car" goal.
   ============================================================ */
function careerRivalIs(p, cfg){
  if(!p || !p.isBot || !cfg) return false;
  if(cfg.foeId) return !!(p._careerSpec && p._careerSpec.id === cfg.foeId);
  return p.botIndex === cfg.rivalIdx;
}
/* the live car being targeted — only ever consults a grid that belongs to
   THIS cfg, so the map screen can't read a name off the last race's field */
function careerRivalCar(order, cfg){
  if(order) return order.find(p => careerRivalIs(p, cfg)) || null;
  const live = G._careerCfg && cfg && G._careerCfg.seed === cfg.seed ? (G.players||[]) : [];
  return live.find(p => careerRivalIs(p, cfg)) || null;
}
function careerRivalLabel(cfg){
  const named = careerFoeName(cfg);
  if(named) return named;
  const live = careerRivalCar(null, cfg);
  if(live && live.name) return live.name;
  return (BOT_POOL[cfg.rivalIdx]||{}).name || "your rival";
}
function careerRivalColor(cfg){
  const f = careerFoe(cfg); if(f && f.color) return f.color;
  const live = careerRivalCar(null, cfg);
  return (live && live.color) || (BOT_POOL[cfg.rivalIdx]||{}).color || "#fff";
}

/* ============================================================
   CAREER SELECT / INTRO
   ============================================================ */
function showCareerSelect(){
  const el=$("#setup"); el.onclick=null; el.style.display="flex"; el.scrollTop=0;
  const save=loadCareerSave();
  const card=(id,icon,name,meta,go)=>`<button class="trackcard" id="${id}">
    <div class="tc-art" style="display:flex;align-items:center;justify-content:center;font-size:40px">${icon}</div>
    <div class="tc-body"><div class="tc-name">${name}</div><div class="tc-meta">${meta}</div></div>
    <div class="tc-go">${go}</div></button>`;
  el.innerHTML=`<div class="sheet rules">
    <h1>HEAT <span>· career</span></h1>
    <div class="tag">Pick your route across the map. Fuel gets you there, prize money keeps you rolling, the Grand Final crowns you.</div>
    <div class="racerules" style="margin-top:6px">
      ${save?card("car-cont","🗺️","Continue career",`${esc(save.mapName||"Custom map")} · Act ${actDef((save.act|0)+1).roman} · ${repPips(save.rep!=null?save.rep:3)} · $${save.money} · ${(save.stops!=null?save.stops:save.done.length)} stops made`,"Resume ▸"):""}
      ${CAREER_PRESETS.map((p,i)=>card("car-pre"+i,i?"⛰️":"🌊",p.name,`${careerPresetBlurb(p)} · hand-built roadmap`,"Start ▸")).join("")}
      ${card("car-rand","🎲","Random roadmap","A fresh map every time — lanes, forks and showdowns rolled on the spot.","Roll ▸")}
      ${card("car-imp","📋","Import from Mapforge","Paste a JSON export from the Mapforge editor and race across your own map.","Paste ▸")}
    </div>
    <div class="phase-hint" style="margin-top:14px">Three acts, one road. Every stop costs fuel to reach (big races also charge an entry fee). Races set a goal — win, podium, top-5, lead lap 1, beat a named rival. Hit the goal to claim the stop and bank the purse; miss it and you can pay to re-enter, or route around. Run out of fuel and the season's over.</div>
    <div class="btnrow" style="margin-top:10px"><button class="act secondary" id="carback">◂ Back</button></div>
  </div>`;
  $("#carback").onclick=()=>{ el.style.display="none"; showModeSelect(); };
  if(save) $("#car-cont").onclick=()=>{ G.career=save; G.mode="career"; G.playerCls=save.cls; showCareerMap(); };
  CAREER_PRESETS.forEach((p,i)=>{ $("#car-pre"+i).onclick=()=>careerPickCar(p); });
  $("#car-rand").onclick=()=>careerPickCar(careerGenBook());
  $("#car-imp").onclick=showCareerImport;
}
function careerPickCar(rawMap){
  showDeckSelect(()=>{ try{ newCareer(rawMap); }catch(e){ alert(e.message); showCareerSelect(); return; }
    showCareerIntro(); }, showCareerSelect);
}
function showCareerIntro(){
  const C=G.career, el=$("#setup"); el.onclick=null; el.style.display="flex"; el.scrollTop=0;
  const c=classByKey(C.cls);
  const acts=C.book.acts;
  const races=acts.reduce((t,m)=>t+m.nodes.filter(n=>["enemy","drag","elite","boss"].includes(n.type)).length,0);
  const stops=acts.reduce((t,m)=>t+m.nodes.length,0);
  const bossRow=acts.map((m,i)=>{ const k=careerBossTrackFor(i+1); return k?trackName(k):"?"; }).join(" → ");
  el.innerHTML=`<div class="sheet">
    <h1>HEAT <span>· ${esc(C.mapName.toLowerCase())}</span></h1>
    <div class="tag">Season opener. One tank, one car, one road to the Grand Final.</div>
    <div class="optgroup"><div class="olbl">Your rig</div>
      <div class="deckcard" style="padding:12px">
        <div class="dk-art" style="height:130px">${DECK_ART[c.key]==="ok"?`<img src="${c.art}" alt="${esc(c.name)}">`:classCarSVG(c.key)}</div>
        <div class="dk-name">${esc(c.name)}</div><div class="dk-tag">${esc(c.tag)}</div>
      </div></div>
    <div class="optgroup"><div class="olbl">The deal</div>
      ${summaryRow("Sponsors", repPips(C.rep)+" — miss a stop's goal and one of them walks")}
      ${summaryRow("Starting purse","$"+C.money)}
      ${summaryRow("The road",`${acts.length} act maps · ${stops} stops · ${races} races`)}
      ${summaryRow("Claiming a stop","Meet the race goal shown before lights-out")}
      ${summaryRow("Every goal met","Your pick of 3 Upgrade cards — no limit on how many you carry")}
      ${summaryRow("Three acts",`${actLabel(1)} → ${actLabel(2)} → ${actLabel(3)} — one map screen each`)}
      ${summaryRow("Boss boards",`${esc(bossRow)} — drawn fresh for this career`)}
      ${summaryRow("The fields","Club rookies in Act I; legends with full garages by Act III")}
      ${summaryRow("Boss races","Every act ends on a boss board — win one outright for a LEGENDARY mod")}
      ${summaryRow("Missed the goal?","Re-enter for the same cost, or route around")}
      ${summaryRow("The title","Win the 🏆 Grand Final at the end of the road")}
    </div>
    <div class="btnrow" style="margin-top:14px"><button class="act" id="ciGo">Hit the road ▸</button></div>
    <div class="btnrow" style="margin-top:8px"><button class="act secondary" id="ciBack">◂ Different map</button></div>
  </div>`;
  $("#ciGo").onclick=()=>{ G.mode="career"; showCareerMap(); };
  $("#ciBack").onclick=()=>{ G.career=null; showCareerSelect(); };
}
function showCareerImport(){
  const el=$("#setup"); el.onclick=null; el.style.display="flex"; el.scrollTop=0;
  el.innerHTML=`<div class="sheet">
    <h1>HEAT <span>· import a map</span></h1>
    <div class="tag">Paste a Mapforge export — the JSON download, the export box contents, or the paste-in <code>const</code> block all work. A bundle of three maps (<code>act1</code>, <code>act2</code>, <code>act3</code>) becomes the three acts; a single map is cut into three for you.</div>
    <textarea id="cimpBox" rows="10" spellcheck="false" style="width:100%;background:#12101a;color:#cfe3b8;border:1px solid #333;border-radius:8px;padding:10px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px"></textarea>
    <div class="phase-hint" style="margin-top:8px">Tip: in Mapforge, label a race node <code>monaco|top3|2</code> to pin its circuit, goal and laps. Unlabelled nodes get a seeded circuit and goal.</div>
    <div class="btnrow" style="margin-top:12px"><button class="act" id="cimpGo">Use this map ▸</button>
    <button class="act secondary" id="cimpBack">◂ Back</button></div>
  </div>`;
  $("#cimpBack").onclick=showCareerSelect;
  $("#cimpGo").onclick=()=>{
    let t=$("#cimpBox").value.trim();
    const a=t.indexOf("{"), b=t.lastIndexOf("}");
    if(a<0||b<0){ alert("That doesn't look like a Mapforge export."); return; }
    try{ const raw=JSON.parse(t.slice(a,b+1)); normCareerBook(raw); careerPickCar(raw); }
    catch(e){ alert("Couldn't read that map: "+e.message); }
  };
}

/* one line under a preset card, whether it's a single map or a 3-act bundle */
function careerPresetBlurb(p){
  try{
    if(p && p.maps){
      const ms=Object.values(p.maps);
      return `${ms.length} act map${ms.length===1?"":"s"} · ${ms.reduce((t,m)=>t+(m.nodes||[]).length,0)} stops`;
    }
    if(p && Array.isArray(p.acts)) return `${p.acts.length} act maps · ${p.acts.reduce((t,m)=>t+(m.nodes||[]).length,0)} stops`;
    return `${(p.nodes||[]).length} stops · cut into ${CAREER_ACT_COUNT} acts`;
  }catch(e){ return "hand-built"; }
}

/* ---------------- random roadmap — three act maps, one per screen.
   Every act now follows the same fixed 17-floor structure (see careerGenMap),
   so the acts stay legible AND predictable when the camera fits them. */
function careerGenBook(){
  const maps={};
  for(let a=0;a<CAREER_ACT_COUNT;a++){
    const m=careerGenMap();
    m.name="Random Roadmap";
    m.key="act"+(a+1);
    maps["act"+(a+1)]=m;
  }
  return { name:"Random Roadmap", maps };
}
/* ---------------- random roadmap (port of Mapforge's generator)
   FIXED ACT STRUCTURE — every act is the same 17-floor climb:
     floors  1–15 (idx 0–14)  the main climb, up to 6 nodes a floor,
                              walked by 6 paths (1–3 links up per node)
     floor   9    (idx 8)     guaranteed MOD row — every node a 💰 crate
                              that always holds a Mod
     floor  15    (idx 14)    guaranteed SPONSOR row — every node a 🤝
                              Sponsor day
     floor  16    (idx 15)    the act boss (👑 Act Final / 🏆 Grand Final)
     floor  17    (idx 16)    the transition room with the Legendary —
                              added by sealActMap on roll-up
   Elites and garage sites (🛠️ Speed shop / 🔧 Chop Shop, plus the other
   ambush stops) never spawn on the first 5 floors of an act. */
function careerGenMap(){
  const W={enemy:30,drag:7,night:8,trial:8,grudge:7,event:15,merchant:9,chop:9,elite:8,city:7,town:5,poi:2};
  if(typeof TRACKS==="undefined" || !careerDragTracks().length){ delete W.drag; W.enemy=42; }
  const CLIMB=15,                       // floors 1–15: the walkable climb
        MODF=8,                         // idx 8  = floor 9  — guaranteed mod crates
        RESTF=CLIMB-1,                  // idx 14 = floor 15 — guaranteed sponsor row
        RESTRICT=5,                     // no elites/garages on idx 0–4 (floors 1–5)
        floors=CLIMB+1,                 // + the boss floor; the transition comes from sealActMap
        lanes=6, paths=6;
  const MARGIN=70, w=640, h=1600;
  const fp=f=>h-MARGIN-f*(h-2*MARGIN)/(floors-1), lp=l=>MARGIN+l*(w-2*MARGIN)/(lanes-1);
  for(let attempt=0;attempt<40;attempt++){
    const nodes=[], edges=[], grid={}; let nextId=1;
    const mk=(f,l)=>{ const k=f+","+l; if(grid[k]) return grid[k];
      const n={id:"n"+(nextId++),type:"enemy",label:"",floor:f,x:Math.round(lp(l)+Math.random()*18-9),y:Math.round(fp(f)),data:null};
      grid[k]=n; nodes.push(n); return n; };
    const topWalk=RESTF, edgeKeys=new Set(), laneEdges={};
    for(let p=0;p<paths;p++){
      let lane=Math.floor(Math.random()*lanes);
      if(p===1){ let tr=0; while(grid["0,"+lane]&&tr++<20) lane=Math.floor(Math.random()*lanes); }
      mk(0,lane);
      for(let f=0;f<topWalk;f++){
        const opts=[];
        for(const dd of [-1,0,1]){ const nl=lane+dd; if(nl<0||nl>=lanes) continue;
          if((laneEdges[f]||[]).some(([a,b])=>(a<lane&&b>nl)||(a>lane&&b<nl))) continue; opts.push(nl); }
        const nl=opts.length?opts[Math.floor(Math.random()*opts.length)]:lane;
        (laneEdges[f]=laneEdges[f]||[]).push([lane,nl]);
        const a=mk(f,lane),b=mk(f+1,nl), ek=a.id+">"+b.id;
        if(!edgeKeys.has(ek)){ edgeKeys.add(ek); edges.push([a.id,b.id]); }
        lane=nl;
      }
    }
    const pool=Object.keys(W), parents=id=>edges.filter(e=>e[1]===id).map(e=>nodes.find(x=>x.id===e[0]));
    for(const n of nodes){
      if(n.floor===0){ n.type="enemy"; continue; }
      if(n.floor===MODF){ n.type="treasure"; n.data={mod:true}; continue; }   // floor 9 — the crate always holds a Mod
      if(n.floor===topWalk){ n.type="rest"; continue; }                       // floor 15 — sponsor day, every lane
      let t=null,tries=0;
      while(tries++<30){
        const late=k=>["elite","grudge","night","merchant","chop"].includes(k);
        let tot=0; for(const k of pool) tot+=(late(k)&&n.floor<RESTRICT?0:W[k]);
        let r=Math.random()*tot;
        for(const k of pool){ const wv=(late(k)&&n.floor<RESTRICT?0:W[k]); if((r-=wv)<0){ t=k; break; } }
        if(!t) t="enemy";
        if(["merchant","chop","elite","grudge","trial","night"].includes(t)&&parents(n.id).some(p=>p&&p.type===t)){ t=null; continue; }
        break;
      }
      n.type=t||"enemy";
    }
    const boss={id:"n"+(nextId++),type:"boss",label:"",floor:floors-1,x:w/2,y:Math.round(fp(floors-1)),data:null};
    nodes.push(boss);
    for(const n of nodes) if(n.floor===topWalk&&n.id!==boss.id) edges.push([n.id,boss.id]);
    const st={id:"n"+(nextId++),type:"start",label:"",floor:0,x:w/2,y:Math.round(fp(0))+46,data:null};
    nodes.push(st);
    for(const n of nodes) if(n.floor===0&&n.type!=="start") edges.push([st.id,n.id]);
    // sanity: everything reachable, no dead ends short of the boss
    const kids={}; edges.forEach(([a,b])=>{(kids[a]=kids[a]||[]).push(b);});
    const seen=new Set([st.id]),q=[st.id];
    while(q.length){ const id=q.shift(); for(const c of kids[id]||[]) if(!seen.has(c)){ seen.add(c); q.push(c); } }
    const ok = nodes.every(n=>seen.has(n.id)) && nodes.every(n=>n.type==="boss"||(kids[n.id]||[]).length);
    if(ok || attempt===39)
      return {key:"random",name:"Random Roadmap",w,h,dir:"up",floors,nodes,edges};
  }
}

/* ============================================================
   MAP CAMERA
   The old map screen scaled the SVG to the panel width and scrolled it
   vertically, which meant a map wider than it was tall couldn't be reached
   sideways, and a tall thin map (500 × 1400) blew up to several screens
   high with no way to shrink it.

   This replaces that with a camera: the SVG fills the viewport box at a
   fixed size and we move a viewBox rectangle around over the map instead.
   "Fit" is therefore always possible whatever the map's aspect ratio, and
   panning works in both axes because nothing relies on scrollbars.
   ============================================================ */
const careerMapCam = {
  wrap:null, svg:null, map:null,
  x:0, y:0, w:0,                 // viewBox rect in MAP units (h is derived)
  _drag:null, _pinch:null,

  get aspect(){
    const r = this.wrap.getBoundingClientRect();
    return (r.height > 0) ? r.width / r.height : 1;
  },
  get h(){ return this.w / this.aspect; },
  /* widest viewBox worth showing = the whole map, letterboxed */
  get wMax(){ return Math.max(this.map.w, this.map.h * this.aspect); },
  get wMin(){ return Math.max(80, this.map.w / 6); },

  attach(wrap, svg, map){
    this.wrap = wrap; this.svg = svg; this.map = map;
    this.fit();
    /* The overlay may still be laying out on the first call, which would give
       a zero-height box and a bogus aspect — re-fit once we have real numbers. */
    const w0 = this.w;
    requestAnimationFrame(() => {
      if(!document.body.contains(this.wrap)) return;
      if(Math.abs(this.w - w0) < 0.01 && this.w >= this.wMax - 0.01) this.fit();
      else { this.clamp(); this.apply(); }
    });
    if(this._onResize) window.removeEventListener("resize", this._onResize);
    this._onResize = () => { if(!document.body.contains(this.wrap)) return; this.clamp(); this.apply(); };
    window.addEventListener("resize", this._onResize);
    this.wire();
  },
  apply(){
    if(!this.svg) return;
    this.svg.setAttribute("viewBox", `${this.x.toFixed(1)} ${this.y.toFixed(1)} ${this.w.toFixed(1)} ${this.h.toFixed(1)}`);
  },
  clamp(){
    this.w = Math.max(this.wMin, Math.min(this.wMax, this.w));
    const h = this.h;
    // when the map is smaller than the view on an axis, centre it there
    if(this.w >= this.map.w) this.x = (this.map.w - this.w) / 2;
    else this.x = Math.max(0, Math.min(this.map.w - this.w, this.x));
    if(h >= this.map.h) this.y = (this.map.h - h) / 2;
    else this.y = Math.max(0, Math.min(this.map.h - h, this.y));
  },
  fit(){ this.w = this.wMax; this.clamp(); this.apply(); },
  /* centre on a map point; bias 0.5 = dead centre, 0.55 = slightly high */
  focusOn(mx, my, bias){
    this.w = Math.min(this.wMax, Math.max(this.wMin, this.map.w * 1.05));
    this.x = mx - this.w / 2;
    this.y = my - this.h * (bias == null ? 0.5 : bias);
    this.clamp(); this.apply();
  },
  /* zoom about a point given in map units (defaults to the view centre) */
  zoomTo(w, ax, ay){
    const oldW = this.w, oldH = this.h;
    if(ax == null){ ax = this.x + oldW / 2; ay = this.y + oldH / 2; }
    const fx = (ax - this.x) / oldW, fy = (ay - this.y) / oldH;
    this.w = Math.max(this.wMin, Math.min(this.wMax, w));
    this.x = ax - fx * this.w;
    this.y = ay - fy * this.h;
    this.clamp(); this.apply();
  },
  zoomBy(f, ax, ay){ this.zoomTo(this.w / f, ax, ay); },
  /* screen px -> map units */
  toMap(clientX, clientY){
    const r = this.wrap.getBoundingClientRect();
    return { x: this.x + ((clientX - r.left) / r.width) * this.w,
             y: this.y + ((clientY - r.top) / r.height) * this.h };
  },

  wire(){
    const wrap = this.wrap, cam = this;
    const pts = new Map();                 // live pointers, for pinch
    let moved = 0, gesturing = false;

    /* Pointer capture would stop clicks reaching the node <g> elements, so
       the gesture is tracked on window instead and torn down on release. */
    const onMove = e => {
      if(!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x:e.clientX, y:e.clientY });
      if(pts.size >= 2 && cam._pinch){
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if(d > 4){
          const mid = cam.toMap((a.x + b.x) / 2, (a.y + b.y) / 2);
          cam.zoomTo(cam._pinch.w * (cam._pinch.d / d), mid.x, mid.y);
        }
        moved = 99;
        e.preventDefault();
        return;
      }
      if(!cam._drag) return;
      const r = wrap.getBoundingClientRect();
      moved = Math.max(moved, Math.hypot(e.clientX - cam._drag.x, e.clientY - cam._drag.y));
      if(moved <= 6) return;               // below the threshold it's still a tap
      cam.x = cam._drag.vx - (e.clientX - cam._drag.x) * (cam.w / r.width);
      cam.y = cam._drag.vy - (e.clientY - cam._drag.y) * (cam.h / r.height);
      cam.clamp(); cam.apply();
      e.preventDefault();
    };
    const onUp = e => {
      pts.delete(e.pointerId);
      if(pts.size < 2) cam._pinch = null;
      if(pts.size === 0){
        cam._drag = null;
        // a pan shouldn't also register as a tap on the node underneath
        wrap.dataset.dragged = (moved > 6) ? "1" : "";
        if(gesturing){
          gesturing = false;
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onUp);
        }
      }
    };
    wrap.onpointerdown = e => {
      pts.set(e.pointerId, { x:e.clientX, y:e.clientY });
      moved = 0;
      if(pts.size === 2){
        const [a, b] = [...pts.values()];
        cam._pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), w: cam.w };
      } else {
        cam._drag = { x:e.clientX, y:e.clientY, vx:cam.x, vy:cam.y };
      }
      if(!gesturing){
        gesturing = true;
        window.addEventListener("pointermove", onMove, { passive:false });
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
      }
    };
    wrap.onwheel = e => {
      e.preventDefault();
      const m = cam.toMap(e.clientX, e.clientY);
      cam.zoomBy(e.deltaY < 0 ? 1.18 : 1 / 1.18, m.x, m.y);
    };
    const btn = (id, fn) => { const b = $(id); if(b) b.onclick = fn; };
    btn("#cmZoomIn",  () => cam.zoomBy(1.35));
    btn("#cmZoomOut", () => cam.zoomBy(1 / 1.35));
    btn("#cmFit",     () => cam.fit());
    btn("#cmMe",      () => {
      const C = G.career, n = C && C.at ? cnById(C.at) : null;
      if(n) cam.focusOn(n.x, n.y, 0.5); else cam.fit();
    });
  }
};

/* the little row of earned mods under the map */
function modStripHTML(){
  const C = G.career;
  const mods = (C.mods || []).map(id => cmodById(id)).filter(Boolean);
  if(!mods.length)
    return `<div class="cmodstrip empty">No mods fitted yet — win Showdowns, crack prize crates or buy them at speed shops.</div>`;
  return `<div class="cmodstrip" id="cmodstrip">${mods.map(m =>
    `<button class="cmod" data-mid="${m.id}" title="${esc(m.name)}" style="border-color:${cmodTint(m.rarity)}">${m.icon}</button>`
  ).join("")}</div>`;
}
/* one mod, rendered as a card */
function modCardHTML(m, extra){
  return `<div class="cmodcard" style="border-color:${cmodTint(m.rarity)}">
    <div class="cm-ico">${m.icon}</div>
    <div class="cm-body">
      <div class="cm-name">${esc(m.name)}<span class="cm-rar" style="color:${cmodTint(m.rarity)}">${m.rarity}</span></div>
      <div class="cm-text">${esc(m.text)}</div>
      <div class="cm-flav">${esc(m.flavour)}</div>
    </div>${extra||""}</div>`;
}
function showModDetail(id){
  const m = cmodById(id); if(!m) return;
  const box = $("#cdetail"); if(!box) return;
  box.innerHTML = `<div class="cdetail">${modCardHTML(m)}
    <div class="btnrow" style="margin-top:8px"><button class="act secondary" id="cmdClose">Close</button></div></div>`;
  $("#cmdClose").onclick = () => { box.innerHTML = ""; };
}
/* mods that are actually doing something once the lights go out */
function modBriefHTML(){
  const mods = (G.career.mods || []).map(id => cmodById(id)).filter(Boolean).filter(m => !(m.fx && m.fx.career));
  if(!mods.length) return "";
  return `<div class="cmodbrief">${mods.map(m =>
    `<span class="cmodpill" style="border-color:${cmodTint(m.rarity)}">${m.icon} ${esc(m.name)}</span>`).join("")}</div>`;
}
/* one line describing what a stop pays out, used on the map card and briefing */
function prizeLine(cfg){
  const b = cfg.bonus || {};
  const bits = [];
  if(b.m) bits.push(`+$${b.m}`);
  if(b.rep) bits.push(`+${b.rep} ${CAREER_REP_ICON}`);
  if(b.upg) bits.push("your pick of 3 Upgrade cards");
  if(b.mod) bits.push("<b style='color:#6bd48c'>a Mod if you win outright</b>");
  if(b.legend) bits.push("<b style='color:#ff7bd5'>a LEGENDARY mod if you win outright</b>");
  return bits.join(" \u00B7 ");
}
/* the named opposition, on the node card and the briefing.
   `kind` is the race kind from nodeRaceCfg — it only picks the eyebrow. */
const FOE_EYEBROW = {
  boss:    "Grand Final \u2014 your title fight",
  actboss: "Act Final \u2014 the wall at the end of the act",
  elite:   "Showdown \u2014 named rival",
  race:    "On the grid \u2014 a name you know"
};
function foeCardHTML(foe, kind, big){
  if(kind === true) kind = "boss";                 // old two-arg callers
  const k = FOE_EYEBROW[kind] ? kind : "elite";
  return `<div class="cfoe ${(k==="boss"||k==="actboss")?"boss":""} ${big?"big":""}" style="--foe:${foe.color}">
    <div class="cf-ico">${foe.icon}</div>
    <div class="cf-body">
      <div class="cf-eyebrow">${FOE_EYEBROW[k]}</div>
      <div class="cf-name">${esc(foe.name)}</div>
      ${foe.brief?`<div class="cf-brief">${esc(foe.brief)}</div>`:""}
      <div class="cf-threat">\u26A0 ${esc(foe.threat)}</div>
    </div></div>`;
}

/* ---- earning mods ----------------------------------------------------
   Mods are never duplicated: the pool is filtered against what you already
   carry, and the roll is seeded so a given crate always holds the same
   thing whether or not you walked away from it first. */
function careerModPool(){
  const have = new Set(G.career.mods || []);
  return cmodList().filter(m => !have.has(m.id) && m.rarity !== "legendary");
}
/* Legendaries live in their own pool and are never stocked, crated or
   offered by an event — the only door is winning a boss race outright. */
function careerLegendPool(){
  const have = new Set(G.career.mods || []);
  return cmodList().filter(m => !have.has(m.id) && m.rarity === "legendary");
}
function careerGrantMod(id, why){
  const C = G.career, m = cmodById(id);
  if(!m || (C.mods || []).includes(id)) return false;
  (C.mods = C.mods || []).push(id);
  saveCareer();
  toast(`${m.icon} ${m.name} fitted`);
  if(why) log(`${m.icon} ${m.name} — ${why}`, "me");
  return true;
}
/* offer a choice of mods (Showdown win, crate, event) */
function showCareerModPick(seed, title, done, count, opts){
  opts = opts || {};
  const C = G.career, pool = opts.legendary ? careerLegendPool() : careerModPool();
  if(!pool.length){
    const cash = opts.legendary ? 250 : 60;
    C.money += cash; saveCareer();
    careerNotice("\uD83D\uDD27 Nothing new", opts.legendary
      ? "You already own every legendary the sport has left. The crew quietly sell the trophy's contents."
      : "You've already fitted every mod worth having. The crew sell the spare.", "+$"+cash, done);
    return;
  }
  const R = careerRng(seed), offer = [];
  const bag = pool.slice();
  const n = Math.min(count || 3, bag.length);
  while(offer.length < n && bag.length) offer.push(bag.splice(Math.floor(R() * bag.length), 1)[0]);
  const el = $("#setup"); el.onclick = null; el.style.display = "flex"; el.scrollTop = 0;
  el.innerHTML = `<div class="sheet">
    <h2>${title}</h2>
    <div class="tag">${opts.legendary
      ? "Legendary. There are only six of these in the whole sport and you cannot buy one. Tap to take it."
      : "Mods are permanent — one bolts on for the rest of the career. Tap to take it."}</div>
    <div class="cmodpick" id="modPick">${offer.map(m =>
      `<button class="cmodpickbtn" data-mid="${m.id}">${modCardHTML(m)}</button>`).join("")}</div>
    <div class="btnrow" style="margin-top:12px"><button class="act secondary" id="modSkip">Leave it</button></div>
  </div>`;
  el.querySelectorAll(".cmodpickbtn").forEach(b => b.onclick = () => { careerGrantMod(b.dataset.mid); done(); });
  $("#modSkip").onclick = done;
}
/* boss loot */
function showCareerLegendPick(seed, title, done, count){
  return showCareerModPick(seed, title, done, count || 2, { legendary:true });
}
function modPrice(m){
  const base = { common:55, uncommon:80, rare:120, legendary:400 }[m.rarity] || 70;
  const disc = (typeof careerPerk === "function") ? careerPerk("shopDisc") : 0;
  return Math.max(20, Math.round(base * (1 - disc)));
}

/* ============================================================
   THE MAP SCREEN
   ============================================================ */
function showCareerMap(){
  const C=G.career; if(!C) { showCareerSelect(); return; }
  G.mode="career"; G.hotseat=false; G.champ=null;
  const el=$("#setup"); el.onclick=null; el.style.display="flex"; el.scrollTop=0;
  const reach=careerReachable();
  const afford=reach.filter(n=>C.money>=careerCostOf(n).m);
  const doneSet=new Set(C.done);
  /* which act the player is standing in — drives the banner under the stats */
  const hereAct = C.at ? careerActOf(cnById(C.at)||{floor:0}) : 1;
  const pathEdges=new Set(); for(let i=1;i<C.done.length;i++) pathEdges.add(C.done[i-1]+">"+C.done[i]);
  const edgeSvg=C.map.edges.map(([a,b])=>{
    const A=cnById(a),B=cnById(b); if(!A||!B) return "";
    const walked=pathEdges.has(a+">"+b);
    const live = (C.at===a||(C.at==null&&A.floor===0)) && !doneSet.has(b);
    return `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${walked?"#8a5cf6":live?"#c9b46b":"#453d5e"}" stroke-width="${walked?5:3}" stroke-dasharray="${walked?"none":"7 8"}" stroke-linecap="round" opacity="${walked||live?0.95:0.45}"/>`;
  }).join("");
  const nodeSvg=C.map.nodes.map(n=>{
    const r=CNODE_R[n.type]||14, t=CTYPE[n.type], done=doneSet.has(n.id);
    const isReach=reach.some(x=>x.id===n.id), can=afford.some(x=>x.id===n.id);
    const cur=C.at===n.id;
    const ring = cur?"#b48cff" : done?"#5b8f57" : isReach?(can?"#ffd86b":"#c05a5a") : "#4a4260";
    const op = done||cur||isReach?1:0.42;
    const c=careerCostOf(n);
    const face = careerMapFace(n);
    const cost = (isReach && c.m) ? `<text x="${n.x}" y="${n.y+r+16}" text-anchor="middle" font-size="13" font-weight="800" fill="${can?"#ffd86b":"#e08a8a"}">$${c.m}</text>` : "";
    return `<g class="${isReach?"cnode-hit":""}" data-nid="${isReach?n.id:""}" opacity="${op}">
      <circle cx="${n.x}" cy="${n.y}" r="${r+5}" fill="#171225" stroke="${ring}" stroke-width="3" class="${cur?"cpulse":""}"/>
      <text x="${n.x}" y="${n.y+r*0.42}" text-anchor="middle" font-size="${Math.round(r*1.25)}">${done&&!cur?"✔":face.icon}</text>
      ${cost}</g>`;
  }).join("");
  el.innerHTML=`<div class="sheet" style="max-width:640px">
    <h1>HEAT <span>· ${esc(C.mapName.toLowerCase())}</span></h1>
    <div class="cstatbar">
      <span class="cstat" title="Sponsor confidence — miss a goal and you lose one">${repPips(C.rep)}</span>
      ${(C.damage|0)?`<span class="cstat" style="color:#e0b070" title="Spin-out damage: +${C.damage} Stress, −${C.damage} Heat capacity">\uD83D\uDD29 <b>${C.damage}</b> damage</span>`:""}
      <span class="cstat">💰 <b>$${C.money}</b></span>
      <span class="cstat">🛠️ <b>${C.upgrades.length}</b> upgrades</span>
      <span class="cstat">⚙️ <b>${(C.mods||[]).length}</b> mods</span>
      <span class="cstat">🏁 <b>${C.wins}</b>/${C.races} goals hit</span>
      ${careerTablePos()?`<span class="cstat">📊 <b>P${careerTablePos()}</b> in the act</span>`:""}
    </div>
    <div class="phase-hint" style="min-height:0;margin:2px 0 6px"><b>${actLabel(hereAct)}</b> <span style="opacity:.7">· map ${hereAct} of ${careerActCount()}</span> — ${esc(actDef(hereAct).blurb)}</div>
    <div class="cmapwrap" id="cmapwrap">
      <svg id="cmapsvg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${edgeSvg}${nodeSvg}</svg>
      <div class="cmapctl">
        <button id="cmZoomIn"  aria-label="Zoom in">＋</button>
        <button id="cmZoomOut" aria-label="Zoom out">−</button>
        <button id="cmFit"     aria-label="Fit whole map" title="Fit whole map">⤢</button>
        <button id="cmMe"      aria-label="Centre on my car" title="Centre on my car">🎯</button>
      </div>
    </div>
    <div class="phase-hint" style="margin:8px 0 0">Drag to pan, pinch or ＋/− to zoom, ⤢ for the whole map, 🎯 to snap back to your car. <b>Driving anywhere is free</b> — what costs you is missing a stop's goal, which burns a ${CAREER_REP_ICON}. Some races charge an entry fee; that's the only number under a node.</div>
    ${modStripHTML()}
    <div id="cdetail"></div>
    <div class="btnrow" style="margin-top:12px">
      <button class="act secondary" id="cmGarage">🛠️ My car</button>
      <button class="act secondary" id="cmTable">📊 Standings</button>
      <button class="act secondary" id="cmMenu">Main menu</button>
      <button class="act secondary" id="cmAbandon" style="color:#e08a8a">Abandon career</button>
    </div>
  </div>`;
  el.querySelectorAll(".cnode-hit").forEach(g=>{ g.onclick=()=>{
    // a pan that ended over a node shouldn't open it
    const wrap=$("#cmapwrap");
    if(wrap && wrap.dataset.dragged==="1"){ wrap.dataset.dragged=""; return; }
    showCareerNodeDetail(cnById(g.dataset.nid));
  }; });
  el.querySelectorAll(".cmod").forEach(b=>{ b.onclick=()=>showModDetail(b.dataset.mid); });
  $("#cmMenu").onclick=()=>{ saveCareer(); el.style.display="none"; showModeSelect(); };
  $("#cmGarage").onclick=showCareerGarage;
  $("#cmTable").onclick=showCareerStandings;
  $("#cmAbandon").onclick=()=>{ if(confirm("Abandon this career? The save is deleted.")){ clearCareerSave(); G.career=null; showModeSelect(); } };
  // camera: an act is one screen, so the default view is the whole act map
  careerMapCam.attach($("#cmapwrap"), $("#cmapsvg"), C.map);
  careerMapCam.fit();
  // stranded?
  if(reach.length && !afford.length) careerStranded(reach);
  if(!reach.length && C.at!=null){ // nothing left on this act's map
    const here=cnById(C.at);
    if(here && careerIsActFinal(here) === false && here.type!=="boss"){
      if(!careerIsLastAct()) showActBreak(); else showCareerVictory(true);
    }
  }
}
/* ============================================================
   BETWEEN ACTS
   The road doesn't continue — a new map screen opens. Everything you've
   built carries over; the map is the only thing that resets.
   ============================================================ */
function showActBreak(){
  const C=G.career, el=$("#setup"); el.onclick=null; el.style.display="flex"; el.scrollTop=0;
  const done=(C.act|0)+1, next=Math.min(careerActCount(), done+1);
  const A=actDef(next);
  const nextMap=C.book.acts[Math.min(C.book.acts.length-1, (C.act|0)+1)];
  const races=nextMap.nodes.filter(n=>careerIsRaceNode(n)).length;
  const bt=careerBossTrackFor(next);
  el.innerHTML=`<div class="sheet" style="max-width:520px;text-align:center">
    <h2>${actDef(done).icon} Act ${actDef(done).roman} — done</h2>
    <div class="tag">${esc(C.mapName)} · you're through ${esc(actDef(done).name)}</div>
    <div class="cfailhero" style="font-size:56px">🗺️</div>
    <div class="optgroup" style="text-align:left"><div class="olbl">Next: ${actLabel(next)}</div>
      ${summaryRow("The road ahead", `${nextMap.nodes.length} stops · ${races} races on a fresh map`)}
      ${summaryRow("The fields", `${DIFF_NAMES[A.diff]} rivals carrying ${A.nUp[0]}–${A.nUp[1]} Upgrade cards`)}
      ${summaryRow("Act final", bt?`${next===careerActCount()?"🏆 Grand Final":"👑 Act Final"} at ${esc(trackName(bt))}`:"a boss board — not loaded yet")}
      ${summaryRow("You carry over", `${repPips(C.rep)} · $${C.money} · ${C.upgrades.length} Upgrade${C.upgrades.length===1?"":"s"} · ${(C.mods||[]).length} mod${(C.mods||[]).length===1?"":"s"}`)}
    </div>
    <div class="optgroup" style="text-align:left"><div class="olbl">📊 Final table — ${esc(actLabel(done))}</div>
      ${careerTableHTML(true)}
      <div class="crow" style="color:#8f86a8;font-size:13px">Points reset for the next act. The new table starts scoring at your first race — stay near the top of it and the act final comes at you no better armed than it has to.</div>
    </div>
    <div class="btnrow" style="margin-top:16px;justify-content:center">
      <button class="act" id="abGo">Open the next map ▸</button>
    </div></div>`;
  $("#abGo").onclick=()=>{ careerAdvanceAct(); showCareerMap(); };
}
function showCareerNodeDetail(node){
  if(!node) return;
  const C=G.career, box=$("#cdetail"), t=CTYPE[node.type], c=careerCostOf(node);
  const can=C.money>=c.m;
  const isRace=careerIsRaceNode(node);
  let inner=`<h3>${t.icon} ${esc(t.name)}</h3><div class="crow">${esc(t.blurb)}</div>`;
  if(isRace){
    const cfg=nodeRaceCfg(node);
    const face=careerNodeFace(node,cfg);
    if(face!==t) inner=`<h3>${face.icon} ${esc(face.name)}</h3><div class="crow">${esc(face.blurb)}</div>`;
    inner+=`<div class="crow" style="color:#bdb3d4">${actLabel(cfg.act)}</div>
    <div class="crow">${cfg.drag?"Strip":"Circuit"}: <b>${esc(trackName(cfg.track))}</b> · ${cfg.drag?"straight-line sprint":`${cfg.laps} lap${cfg.laps>1?"s":""}`} · ${cfg.bots+1}-car grid · ${DIFF_NAMES[cfg.diff]} rivals${cfg.nUp?` carrying ${cfg.nUp} Upgrade${cfg.nUp===1?"":"s"} each`:" running stock cars"}${cfg.weather!=="none"?` · ${WEATHER_TYPES[cfg.weather].icon} ${WEATHER_TYPES[cfg.weather].name}`:""}</div>
    ${careerFoe(cfg)?foeCardHTML(careerFoe(cfg), cfg.kind):""}
    ${(cfg.kind==="actboss"||cfg.kind==="boss")&&cfg.tableBump?`<div class="crow" style="color:#e0b070">📊 Championship: ${esc((careerTableLeader()||{}).name||"the leader")} tops the act by ${careerTableGap()} — the whole field turns up with ${cfg.tableBump} extra Upgrade card${cfg.tableBump===1?"":"s"} because of it.</div>`:""}
    ${cfg.garageBump?`<div class="crow" style="color:#8f86a8">They've matched your garage: ${C.upgrades.length} Upgrades in your deck is worth +${cfg.garageBump} in each of theirs.</div>`:""}
    <div class="cgoal">🎯 Goal: ${condName(cfg)}</div>
    <div class="crow">Purse: <b>$${cfg.posM[0]}</b> for the win, paid down to last</div>
    <div class="crow">Hit the goal for: ${prizeLine(cfg)}</div>
    <div class="crow" style="color:#8f86a8">Miss the goal and you keep half the position money, lose a sponsor, and the stop stays open — re-enter, or route around it.</div>`;
  } else if(node.type==="grudge"){
    const gf=careerGrudgeRival(careerActOf(node));
    if(gf) inner+=`<div class="crow">${gf.icon} <b>${esc(gf.name)}</b> is waiting for you${careerGrudgeLevel(gf)?` — and they've beaten you ${careerGrudgeLevel(gf)} time${careerGrudgeLevel(gf)===1?"":"s"} already`:""}. Beat them home and they're off your card for the rest of the act.</div>`;
  } else if(node.type==="chop"){
    inner+=`<div class="crow">Cut Upgrade cards out of your deck for <b>$${careerChopPrice(CHOP_NODE_X)}</b> apiece${(C.chops|0)?` (you've had ${C.chops} done — the price climbs)`:""}, or pay for permanent Stress surgery. Your deck: <b>${12+C.upgrades.length}</b> cards.</div>`;
  } else if(node.type==="merchant"){
    inner+=`<div class="crow">Fuel by the can, Upgrade cards and mods on the shelf — and they'll cut a card out of your deck for <b>$${careerChopPrice(CHOP_SHOP_X)}</b> if you ask nicely.</div>`;
  } else if(["city","town","poi"].includes(node.type)){
    inner+=`<div class="crow">On arrival you choose: <b>🏁 find a race</b> (seeded circuit &amp; goal), <b>❓ chase the local story</b>, or <b>🛠️ hit the parts market</b>.</div>`;
  }
  inner+=`<div class="crow" style="margin-top:6px">Cost to go: <b style="color:${can?"#ffd86b":"#e08a8a"}">${c.m?`$${c.m} entry fee`:"nothing — the road's free"}</b>${can?"":" — you can't cover this yet"}${isRace?` · miss the goal and it costs you <b>1 ${CAREER_REP_ICON}</b>`:""}</div>
  <div class="btnrow" style="margin-top:10px">
    <button class="act" id="cGo" ${can?"":"disabled style='opacity:.45'"}>Drive there ▸</button>
    <button class="act secondary" id="cNah">Not yet</button>
  </div>`;
  box.innerHTML=`<div class="cdetail">${inner}</div>`;
  box.scrollIntoView({behavior:"smooth",block:"nearest"});
  $("#cNah").onclick=()=>{ box.innerHTML=""; };
  if(can) $("#cGo").onclick=()=>careerTravel(node);
}
/* Only reachable stops with an ENTRY FEE can lock you out now, and the way
   out is always to sell something off the car. */
function careerStranded(reach){
  const C=G.career, box=$("#cdetail");
  const cheapest=Math.min(...reach.map(n=>careerCostOf(n).m));
  if(!C.upgrades.length){ showCareerGameOver(); return; }
  box.innerHTML=`<div class="cdetail"><h3>\uD83D\uDCB8 Nothing in the tin</h3>
    <div class="crow">The cheapest way on from here is a <b>$${cheapest}</b> entry fee and you can't cover it. Something has to come off the car.</div>
    <div class="btnrow" style="margin-top:10px"><button class="act" id="cScrap">Sell an Upgrade \u2192 +$${cheapest}</button></div></div>`;
  $("#cScrap").onclick=()=>showCareerScrapPick("\uD83D\uDCB8 Sell it on",
    "Pick the card that pays the entry fee.", { m:cheapest }, ()=>showCareerMap());
}
function showCareerGarage(){
  const C=G.career, box=$("#cdetail");
  const defs=C.upgrades.map(id=>upgradeById(id)).filter(Boolean);
  const mods=(C.mods||[]).map(id => cmodById(id)).filter(Boolean);
  box.innerHTML=`<div class="cdetail"><h3>🛠️ ${esc(classByKey(C.cls).name)} — ${defs.length} Upgrade${defs.length===1?"":"s"} fitted</h3>
    <div class="crow" style="color:#bdb3d4">Deck: <b>${12+defs.length}</b> cards before Stress${(C.chops|0)?` · ${C.chops} cut out at chop shops`:""}${(C.stressCuts|0)?` · surgery: −${C.stressCuts} Stress`:""}</div>
    <div class="crow" style="color:${(C.damage|0)?"#e0b070":"#8fd6a8"}">\uD83D\uDD29 ${(C.damage|0)
      ? `Damage ${C.damage}/${CAREER_DMG_MAX} — +${C.damage} Stress in the deck and −${C.damage} Heat capacity, every race, until a chop shop straightens it`
      : "Straight and true — no spin-out damage carried"}</div>
    <div class="crow">${repPips(C.rep)} <span style="color:#8f86a8">sponsor confidence${(C.rep|0)<=1?" — one more missed goal and they're gone":""}</span></div>
    <div class="draftmkt" id="cgar" style="max-height:26vh">${defs.length?"":"<div class='crow'>Stock engine — win Showdowns or visit Speed shops to build it up.</div>"}</div>
    <div class="olbl" style="margin:12px 0 4px">Mods — ${mods.length} fitted${mods.length?" · permanent, no slot limit":""}</div>
    ${mods.length?mods.map(m=>modCardHTML(m)).join(""):"<div class='crow'>No mods yet.</div>"}
    <div class="btnrow" style="margin-top:8px"><button class="act secondary" id="cgClose">Close</button></div></div>`;
  const gar=$("#cgar");
  defs.forEach(d=>{ const cd=renderCard(makeUpgCard(d)); cd.classList.add("taken"); gar.appendChild(cd); });
  $("#cgClose").onclick=()=>{ box.innerHTML=""; };
}

/* ============================================================
   TRAVEL + NODE RESOLUTION
   ============================================================ */
function careerTravel(node){
  const C=G.career, c=careerCostOf(node);
  if(C.money<c.m){ toast("You can't cover the entry fee"); return; }
  C.money-=c.m; C.pending=node.id; saveCareer();
  careerResolve(node);
}
function careerArrive(node){
  const C=G.career;
  C.at=node.id; if(!C.done.includes(node.id)){ C.done.push(node.id); C.stops=(C.stops|0)+1; }
  C.pending=null; saveCareer();
}
function careerResolve(node){
  const C=G.career;
  switch(node.type){
    case "enemy": case "drag": case "elite": case "boss":
    case "grudge": case "trial": case "night":
      launchCareerRace(node); break;
    case "rest": {
      careerArrive(node);
      const rb=(typeof careerPerk==="function")?careerPerk("restBonus"):0;
      const before=C.rep|0;
      careerRepAdd(1+rb);
      const got=(C.rep|0)-before;
      const cash=got?0:60;                       // already maxed out — they give you money instead
      if(cash){ C.money+=cash; saveCareer(); }
      careerNotice("\uD83E\uDD1D Sponsor day",
        got ? "A long lunch, a photo by the car and a great many handshakes. They leave believing in you again."
            : "They're already as happy as they get. So they write a cheque instead and ask you to smile for the camera.",
        got ? `+${got} ${CAREER_REP_ICON} \u2192 ${repPips(C.rep)}` : `+$${cash}`,
        ()=>showCareerMap()); break; }
    case "legend": {
      /* the transition room past an act's final — one guaranteed Legendary,
         then the curtain: next act's map, or the title after the Grand Final */
      careerArrive(node);
      const last = careerIsLastAct();
      showCareerLegendPick(nodeSeed(node)+201,
        last ? "🏆 Champion's spoils — take a Legendary"
             : "🎁 The trophy room — take a Legendary",
        ()=>{ if(last) showCareerVictory(false); else showActBreak(); }, 2);
      break; }
    case "treasure": {
      careerArrive(node);
      const R=careerRng(nodeSeed(node));
      const roll=R();
      /* the guaranteed mod row (floor 9 of every act) — the crate ALWAYS
         holds a Mod; only an emptied pool downgrades it to an Upgrade */
      if(node.data && node.data.mod){
        if(careerModPool().length)
          showCareerModPick(nodeSeed(node)+91,"💰 Prize crate — a mod, still in its wrapping",()=>showCareerMap(),2);
        else
          showCareerUpgradePick(nodeSeed(node)+33,"💰 Prize crate — pick a free Upgrade",()=>showCareerMap());
        break;
      }
      if(roll<0.3 && careerModPool().length){
        showCareerModPick(nodeSeed(node)+91,"💰 Prize crate — a mod, still in its wrapping",()=>showCareerMap(),2);
      } else if(roll<0.6){
        const amt=50+Math.floor(R()*5)*10; C.money+=amt; saveCareer();
        careerNotice("💰 Prize crate","Cash under the spare wheel. No questions asked.","+$"+amt,()=>showCareerMap());
      } else {
        showCareerUpgradePick(nodeSeed(node)+33,"💰 Prize crate — pick a free Upgrade",()=>showCareerMap());
      } break; }
    case "merchant":
      careerArrive(node); showCareerShop(node); break;
    case "chop":
      careerArrive(node); showCareerChopShop(node); break;
    case "event":
      careerArrive(node); showCareerEvent(node); break;
    case "city": case "town": case "poi":
      showCareerAnyChoice(node); break;
    default:
      careerArrive(node); showCareerMap();
  }
}
function careerNotice(title,body,delta,done){
  const el=$("#setup"); el.onclick=null; el.style.display="flex";
  el.innerHTML=`<div class="sheet" style="max-width:440px;text-align:center">
    <h2>${title}</h2><div class="tag">${esc(G.career.mapName)}</div>
    <div class="phase-hint" style="min-height:0;margin:8px 0">${esc(body)}</div>
    ${delta?`<div class="cgoal" style="text-align:center;font-size:18px">${esc(delta)}</div>`:""}
    <div class="btnrow" style="margin-top:12px;justify-content:center"><button class="act" id="cnOk">Back to the map ▸</button></div></div>`;
  $("#cnOk").onclick=done;
}
function showCareerAnyChoice(node){
  const el=$("#setup"); el.onclick=null; el.style.display="flex"; el.scrollTop=0;
  const t=CTYPE[node.type];
  el.innerHTML=`<div class="sheet" style="max-width:480px">
    <h2>${t.icon} ${esc(t.name.replace(/ — .*/,""))}</h2>
    <div class="tag">You've rolled in. What's the play?</div>
    <div class="tracklist" style="margin-top:6px">
      <button class="trackcard" id="anyRace"><div class="tc-art" style="display:flex;align-items:center;justify-content:center;font-size:34px">🏁</div>
        <div class="tc-body"><div class="tc-name">Find a race</div><div class="tc-meta">A local grid with a seeded circuit and goal. Purse on offer.</div></div><div class="tc-go">Race ▸</div></button>
      <button class="trackcard" id="anyEvent"><div class="tc-art" style="display:flex;align-items:center;justify-content:center;font-size:34px">❓</div>
        <div class="tc-body"><div class="tc-name">Chase the local story</div><div class="tc-meta">Something's going on here. Could pay, could cost.</div></div><div class="tc-go">Look ▸</div></button>
      <button class="trackcard" id="anyShop"><div class="tc-art" style="display:flex;align-items:center;justify-content:center;font-size:34px">🛠️</div>
        <div class="tc-body"><div class="tc-name">Hit the parts market</div><div class="tc-meta">Fuel by the can and Upgrade cards at street prices.</div></div><div class="tc-go">Shop ▸</div></button>
    </div></div>`;
  $("#anyRace").onclick=()=>launchCareerRace(node,"race");
  $("#anyEvent").onclick=()=>{ careerArrive(node); showCareerEvent(node); };
  $("#anyShop").onclick=()=>{ careerArrive(node); showCareerShop(node); };
}

/* ============================================================
   THINNING THE DECK — 🔧 CHOP SHOP
   The counterweight to an uncapped garage. Every race hands you an Upgrade
   whether you want it or not, so the deck only ever grows; this is where it
   comes back down. It is deliberately a PRICED service, and the price climbs
   with every card you've had cut out, so a career can't just be run through
   a chop shop until only the good cards are left — you're spending purse
   money that would otherwise have bought mods.
   ============================================================ */
/* Money into sponsor confidence — the late-game's main money sink, and
   deliberately a bad rate so it's a rescue rather than a strategy. */
function careerPRPrice(){
  const C=G.career;
  const disc=Math.min(0.5, (typeof careerPerk==="function")?careerPerk("shopDisc"):0);
  return Math.round((150 + 90*(C.prPaid|0))*(1-disc));
}
function careerChopPrice(mult){
  const C=G.career;
  const disc=Math.min(0.5, (typeof careerPerk==="function")?careerPerk("shopDisc"):0);
  const raw=(CHOP_BASE + CHOP_STEP*(C.chops|0)) * (mult||1) * (1-disc);
  return Math.max(15, Math.round(raw/5)*5);
}
/* ---- the repair bay --------------------------------------------------
   Damage is a curse card you carry in the deck AND in the Engine, so buying
   it back out is the single most valuable thing money does in a bad run.
   Priced to hurt, and to climb, so a career of spinning is a career of
   paying for it. */
function careerRepairPrice(){
  const C=G.career;
  const disc=Math.min(0.5, (typeof careerPerk==="function")?careerPerk("shopDisc"):0);
  return Math.max(30, Math.round((REPAIR_BASE + REPAIR_STEP*(C.repairs|0))*(1-disc)/5)*5);
}
function careerRepair(done){
  const C=G.career, price=careerRepairPrice();
  if(!(C.damage|0) || C.money<price) return;
  C.money-=price; C.damage=(C.damage|0)-1; C.repairs=(C.repairs|0)+1;
  saveCareer();
  toast(`\uD83D\uDD29 Panel work done — damage ${C.damage}/${CAREER_DMG_MAX}`);
  done&&done();
}
function careerRepairHTML(){
  const C=G.career, price=careerRepairPrice();
  if(!(C.damage|0))
    return `<div class="phase-hint" style="min-height:0">The car's straight. Nothing bent, nothing to bill you for.</div>`;
  return `<div class="crow">Carrying <b style="color:#e0b070">${C.damage} damage</b> — that's ${C.damage} extra Stress card${C.damage===1?"":"s"} shuffled into your deck and ${C.damage} less Heat your Engine will hold, every race, until it's put right.</div>
    <div class="btnrow"><button class="act" id="chFix" ${C.money>=price?"":"disabled style='opacity:.45'"}>Straighten one \u2014 $${price}</button></div>`;
}
function careerStressPrice(){
  const C=G.career, i=C.stressCuts|0;
  if(i>=CHOP_STRESS_PRICE.length) return null;
  const disc=Math.min(0.5, (typeof careerPerk==="function")?careerPerk("shopDisc"):0);
  return Math.round(CHOP_STRESS_PRICE[i]*(1-disc));
}
/* pull one Upgrade card out of the career deck, for money */
function careerChopCut(idx, price, done){
  const C=G.career;
  const def=upgradeById(C.upgrades[idx]); if(!def) return;
  if(C.money<price){ toast("You can't cover that cut"); return; }
  C.money-=price; C.upgrades.splice(idx,1); C.chops=(C.chops|0)+1;
  saveCareer();
  toast(`🔧 ${def.name} cut out — $${price}. Deck: ${C.upgrades.length} Upgrade${C.upgrades.length===1?"":"s"}`);
  done&&done();
}
/* the deck-thinning market, shown whole at a 🔧 node and as a strip inside
   a 🛠️ speed shop (which charges over the odds for the same work) */
function careerChopMarketHTML(mult){
  const C=G.career, price=careerChopPrice(mult);
  if(!C.upgrades.length)
    return `<div class="phase-hint" style="min-height:0">Your deck is stock — 12 Speed cards and nothing to cut. Come back when the garage has filled up.</div>`;
  return `<div class="draftmkt" id="chopMkt"></div>
    <div class="phase-hint" style="min-height:0;margin-top:6px">Next cut: <b style="color:${C.money>=price?"#ffd86b":"#e08a8a"}">$${price}</b>${(C.chops|0)?` · ${C.chops} already cut out — the price rises each time`:""}. Deck: <b>${12+C.upgrades.length}</b> cards before Stress.</div>`;
}
function careerWireChopMarket(mult, refresh){
  const C=G.career, price=careerChopPrice(mult), mkt=$("#chopMkt");
  if(!mkt) return;
  C.upgrades.forEach((id,idx)=>{
    const def=upgradeById(id); if(!def) return;
    const wrap=document.createElement("div"); wrap.className="cshopcard"; wrap.style.paddingBottom="10px";
    const cd=renderCard(makeUpgCard(def));
    const can=C.money>=price;
    if(can) cd.onclick=()=>careerChopCut(idx, price, refresh);
    else cd.classList.add("taken");
    wrap.appendChild(cd);
    const tag=document.createElement("div"); tag.className="cprice";
    tag.textContent="cut $"+price+(can?"":" ✗");
    wrap.appendChild(tag);
    mkt.appendChild(wrap);
  });
}
function showCareerChopShop(node){
  const C=G.career, el=$("#setup"); el.onclick=null; el.style.display="flex"; el.scrollTop=0;
  const sp=careerStressPrice();
  const cuts=C.stressCuts|0;
  el.innerHTML=`<div class="sheet">
    <h1>HEAT <span>· chop shop</span></h1>
    <div class="cstatbar"><span class="cstat">${repPips(C.rep)}</span><span class="cstat">💰 <b>$${C.money}</b></span><span class="cstat">🛠️ <b>${C.upgrades.length}</b> upgrades</span>${(C.damage|0)?`<span class="cstat" style="color:#e0b070">\uD83D\uDD29 <b>${C.damage}</b> damage</span>`:""}</div>
    <div class="olbl" style="margin:10px 0 2px">Panel and chassis work</div>
    ${careerRepairHTML()}
    <div class="phase-hint" style="min-height:0;margin:12px 0 0">A fat deck is a slow deck. Every card in here is one you might draw instead of the 4 you wanted — pay the man and it's gone for good.</div>
    <div class="olbl" style="margin:10px 0 2px">Cut a card out of the deck — tap to pay</div>
    ${careerChopMarketHTML(CHOP_NODE_X)}
    <div class="olbl" style="margin:14px 0 2px">Stress surgery — permanent</div>
    ${sp!=null
      ? `<div class="crow">Rebuild the pedal box and the seat, and you stop losing your head under pressure: <b>−1 Stress card in your deck for the rest of the career</b>.</div>
         <div class="btnrow"><button class="act" id="chStress" ${C.money>=sp?"":"disabled style='opacity:.45'"}>Book the surgery — $${sp}</button></div>`
      : `<div class="crow" style="color:#8f86a8">You've had this done ${cuts} time${cuts===1?"":"s"}. There's nothing left in the car to take out.</div>`}
    <div class="btnrow" style="margin-top:16px"><button class="act" id="chGo">Hit the road ▸</button></div>
  </div>`;
  careerWireChopMarket(CHOP_NODE_X, ()=>showCareerChopShop(node));
  const fx=$("#chFix"); if(fx&&!fx.disabled) fx.onclick=()=>careerRepair(()=>showCareerChopShop(node));
  const sb=$("#chStress");
  if(sb && sp!=null && C.money>=sp) sb.onclick=()=>{
    C.money-=sp; C.stressCuts=(C.stressCuts|0)+1;
    C.tuning=Object.assign({}, C.tuning||{}, { stress:-(C.stressCuts|0) });
    saveCareer();
    toast(`🩹 Stress surgery done — you start every race with ${C.stressCuts} fewer Stress card${C.stressCuts===1?"":"s"}`);
    showCareerChopShop(node);
  };
  $("#chGo").onclick=()=>showCareerMap();
}

/* ---------------- speed shop */
function careerShopStock(node){
  const R=careerRng(nodeSeed(node)+11);
  const pool=UPGRADE_CARDS.slice(), stock=[];
  while(stock.length<3 && pool.length){
    const def=pool.splice(Math.floor(R()*pool.length),1)[0];
    const price=Math.max(40,Math.min(95, 35+Math.round(upgScore(def)*9)+(def.adv?15:0)));
    stock.push({id:def.id, price});
  }
  return stock;
}
/* Mods on the shelf: 1–2 per shop, seeded so browsing away and back shows
   the same stock. Grease-Stained Ledger adds one more and cuts the price. */
function careerShopMods(node){
  const R=careerRng(nodeSeed(node)+404);
  const n=1+(R()<0.4?1:0)+((typeof careerPerk==="function")?careerPerk("shopExtra"):0);
  const pool=careerModPool(), out=[];
  while(out.length<n && pool.length){
    const m=pool.splice(Math.floor(R()*pool.length),1)[0];
    out.push({id:m.id, price:modPrice(m)});
  }
  return out;
}
function showCareerShop(node){
  const C=G.career, el=$("#setup"); el.onclick=null; el.style.display="flex"; el.scrollTop=0;
  const sold=C.shopSold[node.id]=C.shopSold[node.id]||[];
  const stock=careerShopStock(node).filter(s=>!sold.includes(s.id));
  const full=false;                       // no garage cap any more
  const msold=(C.modSold=C.modSold||{})[node.id]=C.modSold[node.id]||[];
  const modStock=careerShopMods(node).filter(ms=>!msold.includes(ms.id)&&!(C.mods||[]).includes(ms.id));
  el.innerHTML=`<div class="sheet">
    <h1>HEAT <span>· speed shop</span></h1>
    <div class="cstatbar"><span class="cstat">${repPips(C.rep)}</span><span class="cstat">💰 <b>$${C.money}</b></span><span class="cstat">🛠️ <b>${C.upgrades.length}</b></span>${(C.damage|0)?`<span class="cstat" style="color:#e0b070">\uD83D\uDD29 <b>${C.damage}</b></span>`:""}</div>
    <div class="olbl" style="margin:6px 0 2px">Smooth it over with the backers</div>
    ${(C.rep|0)>=CAREER_REP_MAX
      ? `<div class="phase-hint" style="min-height:0">Your sponsors are as happy as sponsors get. Save your money.</div>`
      : `<div class="crow">A PR firm, a nice lunch and a rewritten press release: <b>+1 ${CAREER_REP_ICON}</b>. It is never cheap and it is never cheaper the second time.</div>
         <div class="btnrow"><button class="act" id="shPR" ${C.money>=careerPRPrice()?"":"disabled style='opacity:.45'"}>Put them right — $${careerPRPrice()}</button></div>`}
    ${(C.damage|0)?`<div class="olbl" style="margin:12px 0 2px">Straighten the car</div>${careerRepairHTML()}`:""}
    <div class="olbl" style="margin:12px 0 2px">Upgrade cards${full?" — your garage is full":" — tap to buy"}</div>
    <div class="draftmkt" id="shMkt">${stock.length?"":"<div class='phase-hint' style='min-height:0'>Sold out — you cleaned this place out.</div>"}</div>
    <div class="olbl" style="margin:14px 0 2px">Mods — permanent, no slot limit</div>
    <div id="shMods">${modStock.length?modStock.map(ms=>{
      const m=cmodById(ms.id), afford=C.money>=ms.price;
      return `<button class="cmodbuy ${afford?"":"broke"}" data-mid="${m.id}" data-price="${ms.price}">
        ${modCardHTML(m,`<div class="cm-price" style="color:${afford?"#ffd86b":"#e08a8a"}">$${ms.price}${afford?"":" ✗"}</div>`)}</button>`;
    }).join(""):"<div class='phase-hint' style='min-height:0'>No mods on the shelf here.</div>"}</div>
    <div class="olbl" style="margin:14px 0 2px">Cut a card out — tap to pay <span style="opacity:.6;font-weight:400">(a chop shop does this cheaper)</span></div>
    ${careerChopMarketHTML(CHOP_SHOP_X)}
    <div class="btnrow" style="margin-top:14px"><button class="act" id="shGo">Hit the road ▸</button></div>
  </div>`;
  careerWireChopMarket(CHOP_SHOP_X, ()=>showCareerShop(node));
  const pr=$("#shPR");
  if(pr&&!pr.disabled) pr.onclick=()=>{
    const price=careerPRPrice(); if(C.money<price) return;
    C.money-=price; C.prPaid=(C.prPaid|0)+1; careerRepAdd(1,"the agency earned its fee");
    showCareerShop(node);
  };
  const fx2=$("#chFix"); if(fx2&&!fx2.disabled) fx2.onclick=()=>careerRepair(()=>showCareerShop(node));
  const mkt=$("#shMkt");
  stock.forEach(s=>{
    const def=upgradeById(s.id);
    const wrapEl=document.createElement("div"); wrapEl.className="cshopcard"; wrapEl.style.paddingBottom="10px";
    const cd=renderCard(makeUpgCard(def));
    const canBuy=!full&&C.money>=s.price;
    if(canBuy) cd.onclick=()=>{ C.money-=s.price; C.upgrades.push(s.id); sold.push(s.id); saveCareer();
      toast(`🛠️ ${def.name} fitted — $${s.price}`); showCareerShop(node); };
    else cd.classList.add("taken");
    wrapEl.appendChild(cd);
    const tag=document.createElement("div"); tag.className="cprice"; tag.textContent="$"+s.price+(canBuy?"":" ✗");
    wrapEl.appendChild(tag);
    mkt.appendChild(wrapEl);
  });
  $("#shMods")&&$("#shMods").querySelectorAll(".cmodbuy").forEach(b=>{
    const price=+b.dataset.price;
    if(C.money<price) return;
    b.onclick=()=>{ C.money-=price; msold.push(b.dataset.mid);
      careerGrantMod(b.dataset.mid,`bought for $${price}`); showCareerShop(node); };
  });
  $("#shGo").onclick=()=>showCareerMap();
}
/* free upgrade pick (race wins, prize crates, events) — no garage cap */
function showCareerUpgradePick(seed,title,done,subtitle){
  const C=G.career;
  const R=careerRng(seed), pool=UPGRADE_CARDS.slice(), offer=[];
  while(offer.length<3&&pool.length) offer.push(pool.splice(Math.floor(R()*pool.length),1)[0]);
  const el=$("#setup"); el.onclick=null; el.style.display="flex"; el.scrollTop=0;
  el.innerHTML=`<div class="sheet"><h2>${title}</h2>
    <div class="tag">${esc(subtitle||"Tap one to bolt it on — it rides in your deck for the rest of the career. There's no limit on how many you carry.")}</div>
    <div class="draftmkt" id="upPick"></div>
    <div class="phase-hint" style="min-height:0;margin-top:8px">Garage: ${C.upgrades.length} Upgrade${C.upgrades.length===1?"":"s"} fitted. A fat deck is a strong deck — but it's also a slow one to draw through.</div>
    <div class="btnrow" style="margin-top:12px"><button class="act secondary" id="upSkip">Leave it</button></div></div>`;
  const mkt=$("#upPick");
  offer.forEach(def=>{ const cd=renderCard(makeUpgCard(def));
    cd.onclick=()=>{ C.upgrades.push(def.id); saveCareer(); toast(`🛠️ ${def.name} fitted`); done(); };
    mkt.appendChild(cd); });
  $("#upSkip").onclick=done;
}
/* ---- scrapping a card ------------------------------------------------
   With no cap on Upgrades, the interesting decision stops being "which
   three do I keep" and becomes "is this deck getting too fat to draw".
   Several roadside events let you pull a card back out of it. */
function showCareerScrapPick(title, body, reward, done){
  const C=G.career;
  if(!C.upgrades.length){
    careerNotice(title, "Your deck is stock — there's nothing in it worth pulling out. You take the cash for your trouble instead.", "+$25",
      ()=>{ C.money+=25; saveCareer(); done(); });
    return;
  }
  const el=$("#setup"); el.onclick=null; el.style.display="flex"; el.scrollTop=0;
  el.innerHTML=`<div class="sheet"><h2>${title}</h2>
    <div class="tag">${esc(body||"Pick one card to pull out of your deck for good.")}</div>
    <div class="draftmkt" id="scrapPick"></div>
    ${reward&&(reward.m||reward.f)?`<div class="cgoal" style="text-align:center">You'll get ${reward.m?`+$${reward.m}`:""}${reward.m&&reward.f?" & ":""}${reward.f?`+${reward.f} ${CAREER_REP_ICON}`:""} for it</div>`:""}
    <div class="btnrow" style="margin-top:12px"><button class="act secondary" id="scrapSkip">Keep them all</button></div></div>`;
  const mkt=$("#scrapPick");
  C.upgrades.forEach((id,idx)=>{
    const def=upgradeById(id); if(!def) return;
    const cd=renderCard(makeUpgCard(def));
    cd.onclick=()=>{
      C.upgrades.splice(idx,1);
      if(reward){ C.money+=reward.m||0; if(reward.f) careerRepAdd(reward.f); }
      saveCareer();
      toast(`🗑 ${def.name} pulled out of the deck`);
      done();
    };
    mkt.appendChild(cd);
  });
  $("#scrapSkip").onclick=done;
}

/* ---------------- roadside events
   Event shape:
     { name, icon, text, minAct?, opts:[ option, … ] }
   Option shape — every field is optional:
     lbl       button text
     m / rep   money / sponsor-confidence delta, applied immediately
     fix / dmg n points of car damage repaired / inflicted
     needM/needRep gate: greys the button out if you can't cover it
     gamble    { win:{m,f}, lose:{m,f} } — a coin flip, nudged by Rabbit's Foot
     upg       true → pick 1 Upgrade card out of 3
     mod       true → pick a Mod out of 2 (never legendary)
     scrap     true → pull one Upgrade card back out of your deck
     scrapPay  { m, f } paid for scrapping
     then      a whole second event ({name?,icon?,text,opts:[…]}) that opens
               after this option resolves — this is the "part 2". A branch
               can widen: an A/B choice whose A leads to an A/B/C follow-up.
     note      one line of flavour on the outcome screen
   Legendary mods never appear here — they're boss loot only. */
const CAREER_EVENTS=[
  /* ---------- the originals ---------- */
  {name:"Roadside Sponsor", icon:"🎥", text:"A film crew flags you down — they want footage of your car for a petrol ad.",
    opts:[{lbl:"Pose for the cameras (+$40)", m:40},
          {lbl:"Give them the whole afternoon (+1 ⭐)", rep:1, note:"Your backers see the footage before you do. They're delighted."}]},
  {name:"Black-market Parts", icon:"🛢️", text:"A truck driver in a layby has half a race team's spares in the back. No receipts, no questions.",
    opts:[{lbl:"Buy the box for $25 — pick an Upgrade", m:-25, upg:true, needM:25}, {lbl:"Walk away"}]},
  {name:"Backroad Wager", icon:"🎲", text:"A local hotshot in a rusted V8 bets you can't beat him to the next town.",
    opts:[{lbl:"Take the bet — 50/50: +$60 or −$30", gamble:{win:{m:60},lose:{m:-30}}}, {lbl:"Keep your money"}]},
  {name:"Broken-down Rival", icon:"🔧", text:"One of the circuit regulars is steaming on the shoulder, bonnet up.",
    opts:[{lbl:"Tow them in (+$50, and word gets around)", m:50}, {lbl:"Wave and drive past"}]},
  {name:"Pit-lane Rumour", icon:"🤫", text:"A mechanic whispers about parts that fell off the back of a truck.",
    opts:[{lbl:"Pay $35 for a mystery Upgrade", m:-35, upg:true, needM:35}, {lbl:"Too risky"}]},
  {name:"Storm Warning", icon:"⛈️", text:"Black clouds are stacking up over the pass ahead.",
    opts:[{lbl:"Take the long detour (−$30 and a night in a motel, safe)", m:-30, needM:30},
          {lbl:"Drive through the pass — 50/50: +$30 saved, or a bent car", gamble:{win:{m:30},lose:{m:-20,dmg:1}}}]},
  {name:"Lock-Up Auction", icon:"🔑", text:"A defunct team's lock-up is being cleared out by the bailiffs. Half of it is junk. Half of it isn't.",
    opts:[{lbl:"Bid $45 on the crate", m:-45, mod:true, needM:45}, {lbl:"Let someone else gamble"}]},
  {name:"Fan Club", icon:"📸", text:"Kids from the local kart club recognise the car and swarm the forecourt.",
    opts:[{lbl:"Sign everything (+$25 in merch)", m:25},
          {lbl:"Do the photos your sponsor keeps asking for (+1 ⭐)", rep:1}]},

  /* ================= 20 NEW EVENTS ================= */

  /* --- 1. the card-removal event, front and centre --- */
  {name:"Scrapyard Sunday", icon:"🧲", text:"A yard behind the fuel station buys race parts by the kilo. Your deck has picked up a few things you'd rather not draw at the wrong moment.",
    opts:[
      {lbl:"Strip a card out of the deck (+$40)", scrap:true, scrapPay:{m:40},
       note:"Lighter deck, fatter wallet. You'll see the good cards more often now."},
      {lbl:"Sell scrap metal instead (+$20)", m:20},
      {lbl:"Nothing here for you"}
    ]},

  /* --- 2. part 2: the A branch widens to three --- */
  {name:"The Long Night", icon:"🌙", text:"Two hundred miles of empty road between you and the next meeting, and the sun's already gone.",
    opts:[
      {lbl:"Drive through the night", note:"Somewhere past midnight the road makes a decision for you.",
        then:{name:"Three in the Morning", icon:"☕", text:"The headlights pick out a truck stop, a lay-by, and a sign for a closed-off mountain shortcut. Pick one.",
          opts:[
            {lbl:"Truck stop — coffee and gossip (+$45)", m:45},
            {lbl:"Sleep in the car — free, and you wake up sharp", mod:true, note:"You wake up at first light with an idea about the car."},
            {lbl:"Take the shortcut — 50/50: +$60 saved or a bent car", gamble:{win:{m:60},lose:{m:-40,dmg:1}}}
          ]}},
      {lbl:"Pull over and sleep (−$20 on a motel)", m:-20, needM:20, note:"You arrive late but human."}
    ]},

  /* --- 3 --- */
  {name:"Border Checkpoint", icon:"🚧", text:"A customs officer walks slowly around the car with a clipboard and an expression.",
    opts:[
      {lbl:"Slip him $40 and drive on", m:-40, needM:40},
      {lbl:"Let him strip a part out of the deck — it's not road legal", scrap:true, scrapPay:{m:60},
       note:"He confiscates it, stamps the form, and waves you through."},
      {lbl:"Argue the paperwork — 50/50: waved through or a $60 fine", gamble:{win:{m:0},lose:{m:-60}}}
    ]},

  /* --- 4 --- */
  {name:"The Tyre Man's Cousin", icon:"🛞", text:"He doesn't sell tyres. He knows a man. The man is his cousin. The cousin has a box.",
    opts:[
      {lbl:"Follow him round the back ($50)", m:-50, mod:true, needM:50},
      {lbl:"Buy honest tyres and get the tracking done (−$15, −1 damage)", m:-15, fix:1, needM:15},
      {lbl:"Nope"}
    ]},

  /* --- 5. part 2 --- */
  {name:"Barn Find", icon:"🚜", text:"A farmer mentions there's an old single-seater under a tarp in the top shed. Nobody's touched it since the sixties.",
    opts:[
      {lbl:"Buy the wreck for $60", m:-60, needM:60, note:"It's yours. Now what?",
        then:{name:"Barn Find — What's It Worth?", icon:"🔦", text:"Under the dust it's rougher than you hoped and rarer than you thought.",
          opts:[
            {lbl:"Sell it on to a collector (+$180)", m:180},
            {lbl:"Strip it for parts — take an Upgrade", upg:true},
            {lbl:"Rebuild the engine into yours", mod:true, note:"Fifty years of someone else's obsession, bolted into your car."}
          ]}},
      {lbl:"Take a photo and leave it (+$20 from a magazine)", m:20}
    ]},

  /* --- 6 --- */
  {name:"Hitchhiking Mechanic", icon:"🧰", text:"Toolbox at her feet, thumb out, oil to the elbow. She says she's good.",
    opts:[
      {lbl:"Give her a lift", note:"She spends the whole drive with her head under your bonnet.",
        then:{name:"She Was Good", icon:"🔩", text:"By the time you drop her off she's rerouted two hoses and rewritten your idea of what the car can do.",
          opts:[
            {lbl:"Take her advice on the setup", mod:true},
            {lbl:"Take the part she left behind", upg:true},
            {lbl:"Take the cash she insists on (+$70)", m:70}
          ]}},
      {lbl:"Drive on by"}
    ]},

  /* --- 7 --- */
  {name:"Manufacturer Test Day", icon:"📋", text:"A works team needs a body to shake down a car nobody wants to be seen in.",
    opts:[
      {lbl:"Do the day (+$90, and miss your own meeting: −1 ⭐)", m:90, rep:-1, needRep:2},
      {lbl:"Do it for parts instead (−1 ⭐, pick an Upgrade)", rep:-1, upg:true, needRep:2},
      {lbl:"You're a racer, not a test dummy"}
    ]},

  /* --- 8 --- */
  {name:"The Weighbridge", icon:"⚖️", text:"Scrutineering. The car is over the limit and the man with the clipboard has all afternoon.",
    opts:[
      {lbl:"Take something out of the deck to make weight", scrap:true, scrapPay:{m:0}, note:"Under the limit. Barely."},
      {lbl:"Pay the fine and keep everything (−$70)", m:-70, needM:70},
      {lbl:"Withdraw and drive on (−1 ⭐ — an empty grid slot gets noticed)", rep:-1, needRep:2}
    ]},

  /* --- 9. part 2 --- */
  {name:"The Mountain Road", icon:"⛰️", text:"A famous pass. No barriers, no traffic, and a local sat on the wall who wants to see what you've got.",
    opts:[
      {lbl:"Give it everything", note:"You commit to the first corner and the day gets very simple.",
        then:{name:"The Mountain Road — Halfway", icon:"🪨", text:"Halfway up, brakes going soft, and the road forks: the fast line, the safe line, or stop and cool it.",
          opts:[
            {lbl:"Fast line — 50/50: +$120 and a legend, or you bin it", gamble:{win:{m:120},lose:{m:-20,dmg:1}}},
            {lbl:"Safe line home (+$40)", m:40},
            {lbl:"Stop, cool down, learn something", mod:true, note:"You sit on the bonnet for an hour thinking about heat."}
          ]}},
      {lbl:"Wave and cruise up (+$20 you didn't spend on brakes)", m:20}
    ]},

  /* --- 10 --- */
  {name:"The Widow's Garage", icon:"🕯️", text:"Her husband raced for twenty years. She wants the garage empty by Friday and she wants it to go to a driver.",
    opts:[
      {lbl:"Take what she offers, respectfully", mod:true, note:"She watches you load it and doesn't say anything else."},
      {lbl:"Buy the lot properly (−$80, pick an Upgrade too)", m:-80, upg:true, needM:80},
      {lbl:"Leave her to it (+$0)", note:"Some things aren't yours to take."}
    ]},

  /* --- 11 --- */
  {name:"Transport Strike", icon:"🚧", text:"The depots are picketed. Nothing is moving between here and the coast, least of all the truck with your spares on it.",
    opts:[
      {lbl:"Load the car yourself and run the picket — 50/50: +$70 or a $50 fine", gamble:{win:{m:70},lose:{m:-50}}},
      {lbl:"Pay strike prices for parts (−$60, pick an Upgrade)", m:-60, upg:true, needM:60},
      {lbl:"Sit it out and miss the meeting (−1 ⭐, +$30 doing odd jobs)", rep:-1, m:30, needRep:2}
    ]},

  /* --- 12 --- */
  {name:"Radio Interview", icon:"📻", text:"Local station, ten minutes, live. The host has clearly been told you're a character.",
    opts:[
      {lbl:"Talk up your rivals — classy (+$25, +1 ⭐)", m:25, rep:1},
      {lbl:"Call the whole field out on air (+$80 in ticket sales)", m:80,
       note:"The paddock reads the transcript. You've made this harder for yourself and richer."},
      {lbl:"Decline politely"}
    ]},

  /* --- 13 --- */
  {name:"Stolen Wheels", icon:"🔩", text:"You come out of the motel and the car's sitting on bricks.",
    opts:[
      {lbl:"Buy replacements (−$70)", m:-70, needM:70},
      {lbl:"Cannibalise your own spares — lose a card from the deck", scrap:true, scrapPay:{m:0},
       note:"It rolls again. It's not as good as it was."},
      {lbl:"Ask around the neighbourhood — 50/50: they turn up, or you lose the day and $60", gamble:{win:{m:30},lose:{m:-60}}}
    ]},

  /* --- 14. part 2 --- */
  {name:"The Karting Prodigy", icon:"🏎️", text:"Fourteen years old, no money, faster than half the paddock. She wants a lift to the next meeting.",
    opts:[
      {lbl:"Take her along",
        then:{name:"The Prodigy — Two Years Later", icon:"🌟", text:"She remembers. Word gets around that you're the one who drove her there.",
          opts:[
            {lbl:"Her family's garage owes you one", upg:true},
            {lbl:"Her sponsor owes you one (+$110)", m:110},
            {lbl:"She tells you what she saw in your driving", mod:true}
          ]}},
      {lbl:"Give her $30 for the bus", m:-30, needM:30, note:"She takes it. She doesn't forget that either."},
      {lbl:"You're not a taxi"}
    ]},

  /* --- 15 --- */
  {name:"Customs Impound", icon:"📦", text:"A container of race parts has been sitting unclaimed for eight months. It goes to auction in an hour.",
    opts:[
      {lbl:"Bid big (−$120)", m:-120, mod:true, needM:120, note:"Nobody outbids you. Nobody else even knew what was in it."},
      {lbl:"Bid small (−$45)", m:-45, upg:true, needM:45},
      {lbl:"Watch the room instead (+$25 tipping off a dealer)", m:25}
    ]},

  /* --- 16 --- */
  {name:"Roadside Chapel", icon:"⛪", text:"A tiny whitewashed chapel with racing helmets stacked on the altar rail. Drivers leave things here.",
    opts:[
      {lbl:"Leave a card from your deck as an offering", scrap:true, scrapPay:{m:70},
       note:"You walk out lighter, and there's an envelope under your wiper in the car park that nobody claims."},
      {lbl:"Leave $50 in the box", m:-50, needM:50, rep:1, note:"Word of it reaches your backers, as these things do."},
      {lbl:"Light a candle and go"}
    ]},

  /* --- 17 --- */
  {name:"Dyno Day", icon:"📈", text:"A tuner with a rolling road and a spare afternoon. He wants to know what your engine really does.",
    opts:[
      {lbl:"Full session (−$85)", m:-85, mod:true, needM:85},
      {lbl:"Quick pull (−$30, pick an Upgrade)", m:-30, upg:true, needM:30},
      {lbl:"You already know what it does"}
    ]},

  /* --- 18. part 2, gated to the back half of the career --- */
  {name:"The Old Champion", icon:"🏅", text:"He won this championship three times before you were driving. He's in the bar, and he's noticed you.", minAct:2,
    opts:[
      {lbl:"Buy him a drink and listen (−$20)", m:-20, needM:20, note:"He talks for four hours and none of it is small talk.",
        then:{name:"The Old Champion — Last Round", icon:"🥃", text:"At closing time he pushes something across the bar and tells you which it should be.",
          opts:[
            {lbl:"His old setup notes", mod:true},
            {lbl:"The part he never fitted", upg:true},
            {lbl:"His prize money — he says he never wanted it (+$150)", m:150}
          ]}},
      {lbl:"Let him drink alone"}
    ]},

  /* --- 19 --- */
  {name:"Convoy", icon:"🚚", text:"Three transporters heading your way. They'll run you in their slipstream all night if you're useful.",
    opts:[
      {lbl:"Ride the convoy (+$60 in saved everything)", m:60},
      {lbl:"Ride and trade parts along the way (+$20, pick an Upgrade)", m:20, upg:true},
      {lbl:"Overtake the lot and go alone (+$40 for the story)", m:40}
    ]},

  /* --- 20. late-career mod event --- */
  {name:"The Sponsor's Ultimatum", icon:"💼", text:"Your backer wants a bigger logo, a tamer driver and a say in the setup. There's a contract on the table.", minAct:2,
    opts:[
      {lbl:"Sign it (+$160 and +1 ⭐, but strip a card they don't like)", m:160, rep:1, scrap:true, scrapPay:{m:0},
       note:"They pay on the day. They also send a man to remove something from the car."},
      {lbl:"Renegotiate (+$60 and their engineer's ear)", m:60, mod:true},
      {lbl:"Tear it up (−1 ⭐ — that backer is gone)", rep:-1, needRep:2, note:"The crew like you a great deal more than they liked him. The bank does not."}
    ]},

  /* --- 21, one more for luck: the pure gamble --- */
  {name:"Two-Car Garage", icon:"🎰", text:"A bored millionaire will flip a coin for the pink slip on a spare car he's never driven.",
    opts:[
      {lbl:"Flip for it — +$200 or −$120", gamble:{win:{m:200},lose:{m:-120}}, needM:120},
      {lbl:"Sell him a story instead (+$45)", m:45},
      {lbl:"Finish your coffee and leave"}
    ]}
];
/* legacy a/b events still work — normalise everything to an opts[] array */
function eventOpts(ev){ return ev.opts || [ev.a, ev.b].filter(Boolean); }
function careerEventPool(node){
  const act = careerActOf(node) || 1;
  const pool = CAREER_EVENTS.filter(ev => (ev.minAct||1) <= act);
  return pool.length ? pool : CAREER_EVENTS;
}
function showCareerEvent(node){
  const pool = careerEventPool(node);
  const R = careerRng(nodeSeed(node)+55);
  renderCareerEvent(node, pool[Math.floor(R()*pool.length)], 0);
}
/* `depth` keeps the part-2 seeds apart so a follow-up mod pick isn't the
   same offer as the one the first stage would have made. */
function renderCareerEvent(node, ev, depth){
  const C=G.career;
  const opts=eventOpts(ev);
  const el=$("#setup"); el.onclick=null; el.style.display="flex"; el.scrollTop=0;
  const optBtn=(o,i)=>{
    const blocked=(o.needM&&C.money<o.needM)||(o.needRep&&(C.rep|0)<o.needRep);
    return `<button class="act ${i?"secondary":""}" id="evO${i}" ${blocked?"disabled style='opacity:.45'":""}>${esc(o.lbl)}${blocked?" — can't afford":""}</button>`;
  };
  el.innerHTML=`<div class="sheet" style="max-width:480px">
    <h2>${ev.icon||"❓"} ${esc(ev.name||"Roadside event")}</h2>
    <div class="tag">${depth?"Roadside event · part 2":"Roadside event"}</div>
    <div class="phase-hint" style="min-height:0;margin:8px 0 14px">${esc(ev.text)}</div>
    <div class="btnrow" style="flex-direction:column;align-items:stretch">${opts.map(optBtn).join("")}</div>
    <div class="cstatbar" style="margin-top:12px"><span class="cstat">${repPips(C.rep)}</span><span class="cstat">💰 <b>$${C.money}</b></span></div>
  </div>`;
  const apply=(o)=>{
    let outcome=o, tag="";
    if(o.gamble){ const luck=(typeof careerPerk==="function")?careerPerk("luck"):0;
      const won=Math.random()<0.5+luck; outcome=won?o.gamble.win:o.gamble.lose; tag=won?"You won the coin flip. ":"It went badly. "; }
    C.money=Math.max(0,C.money+(outcome.m||0));
    if(outcome.fix){ C.damage=Math.max(0,(C.damage|0)-outcome.fix); }
    if(outcome.dmg){ C.damage=Math.min(CAREER_DMG_MAX,(C.damage|0)+outcome.dmg); }
    const moved=careerRepAdd(outcome.rep||0);
    saveCareer();
    const bits=[]; if(outcome.m) bits.push((outcome.m>0?"+$":"−$")+Math.abs(outcome.m));
    if(moved) bits.push((moved>0?"+":"−")+Math.abs(moved)+" "+CAREER_REP_ICON);
    if(outcome.fix) bits.push("\uD83D\uDD29 −1 damage");
    if(outcome.dmg) bits.push("\uD83D\uDD29 +"+outcome.dmg+" damage");
    /* an event that empties the last backer ends the season there and then */
    if(careerBroke()){ careerNotice((ev.icon||"❓")+" "+ev.name,
      (o.note||"")+" And that was the last of the goodwill.", bits.join(" · "), ()=>showCareerGameOver()); return; }
    /* what happens next: part 2 beats a prize screen beats the wrap-up */
    const next = o.then
      ? ()=>renderCareerEvent(node, o.then, depth+1)
      : ()=>showCareerMap();
    const seed = nodeSeed(node)+depth*137;
    if(o.scrap){
      showCareerScrapPick(`${ev.icon||"❓"} ${ev.name}`,
        o.note || "Pick the card that goes.", o.scrapPay||null, next);
      return;
    }
    if(o.mod){ showCareerModPick(seed+88, `${ev.icon||"❓"} ${esc(ev.name)}`, next, 2); return; }
    if(o.upg){ showCareerUpgradePick(seed+77, `${ev.icon||"❓"} ${esc(ev.name)}`, next); return; }
    if(o.then){ next(); return; }
    careerNotice((ev.icon||"❓")+" "+ev.name,
      tag+(o.note || (bits.length?"The road settles up.":"You move on, nothing gained, nothing lost.")),
      bits.join(" · "), ()=>showCareerMap());
  };
  opts.forEach((o,i)=>{ const b=$("#evO"+i); if(b&&!b.disabled) b.onclick=()=>apply(o); });
}

/* ============================================================
   CAREER RACES
   ============================================================ */
function launchCareerRace(node, kindOverride){
  const cfg=nodeRaceCfg(node, kindOverride);
  G.mode="career"; G.hotseat=false; G.champ=null;
  G.career.raceNode=node.id; G.career.raceKind=kindOverride||null; saveCareer();
  const el=$("#setup"); el.style.display="none";
  const face=careerNodeFace(node,cfg);
  showRaceLoading(trackName(cfg.track), `Career · ${face.name} · 🎯 ${condName(cfg)}`, ()=>startCareerRace(node,cfg));
}
function startCareerRace(node,cfg){
  const C=G.career;
  selectTrack(cfg.track);
  G.event=null; G.pressCorners=[];
  G.laps=cfg.laps; G.aiMode="sim"; G.difficulty=cfg.diff; G.garage="none"; G.upgLevel="all";
  G.weatherKey=cfg.weather; setupWeather(cfg.weather);
  G._careerCfg=cfg; G._careerLap1Leader=null;
  G._careerSpins=0;                       // damage is counted from here (see career-mods.js)
  if(cfg.kind==="trial") cfg.target=careerTrialTarget(cfg);   // needs the loaded board
  G.activeHuman=null;
  /* The named Boss / Rival always takes grid slot 0 in the bot list, which is
     what nodeRaceCfg pinned cfg.rivalIdx / cfg.foeId to. Scoring goes by
     foeId, so a rebuilt grid can't drift off the car the goal named. */
  const foe=careerFoe(cfg);
  G._careerRacers = foe ? {0:foe} : null;
  G.players=[ makeHuman(C.upgrades.slice(), null, C.cls) ];
  const R=careerRng(cfg.seed+7);
  for(let i=0;i<cfg.bots;i++){
    /* Slot 0 is the named driver when there is one, and legends run a much
       deeper garage than the rest of the grid — that's most of what makes an
       Act III field feel different from an Act I one. */
    const n = (i===0 && foe) ? (cfg.foeUps!=null?cfg.foeUps:cfg.nUp) : cfg.nUp;
    const ups=[]; for(let u=0;u<n;u++) ups.push(UPGRADE_CARDS[Math.floor(R()*UPGRADE_CARDS.length)].id);
    G.players.push(makeBot(i, ups, randomClassKey()));
  }
  G.botCount=cfg.bots;
  /* Bake mods + boss tricks onto the drivers. Must run after every car exists
     and before any card is dealt, because it can resize the Engine. */
  careerApplyFx(G.players);
  const grid=shuffle([...G.players]);
  const slots=[]; for(let i=0;i<grid.length;i++) slots.push({t:-(1+Math.floor(i/2)), s:i%2});
  grid.forEach((p,i)=>{ p.total=slots[i].t; p.spot=slots[i].s; p.gridPos=i; });
  G.legendDeck=shuffle([...LEGEND_CARDS]);
  G.round=0; G.finishOrder=[]; G.replay=[];
  rollRoadConditions();
  renderCars({snap:true});
  for(const h of humans()){ applyWeatherCarSetup(h); drawToHand(h,handSize()); }
  for(const p of G.players) if(p.sim){ applyWeatherCarSetup(p); drawToHand(p,handSize()); }
  log(`═══ CAREER · ${careerNodeFace(node,cfg).name} — ${TRACK.name} ═══`,"me");
  log(`${actLabel(cfg.act||1)} · ${DIFF_NAMES[cfg.diff]} field, ${cfg.nUp} Upgrade card${cfg.nUp===1?"":"s"} apiece — you're carrying ${C.upgrades.length}.`,"me");
  if(cfg.drag) log(`🚦 Drag race — one straight sprint from lights to flag. No laps, no room for mistakes.`,"warn");
  log(`🎯 Goal: ${condName(cfg)}. Meet it to claim the stop.`,"warn");
  if(foe) log(`${foe.icon} ${foe.name} is on the grid — ${foe.threat}`,"warn");
  logWeatherSetup();
  renderCars(); renderGauges(); updateWeatherNote();
  showCareerBriefing(node,cfg,()=>startRound());
}
function showCareerBriefing(node,cfg,done){
  const wx=(G.weather && G.weather.key!=="none") ? G.weather : null;
  const face=careerNodeFace(node,cfg);
  const el=$("#setup"); el.onclick=null; el.style.display="flex"; el.scrollTop=0;
  el.innerHTML=`<div class="sheet" style="max-width:460px;text-align:center">
    <h2>${face.icon} <span>${esc(face.name)}</span></h2>
    <div class="tag">${esc(TRACK.name)} · ${actLabel(cfg.act||1)} · ${cfg.drag?"straight-line sprint":`${cfg.laps} lap${cfg.laps>1?"s":""}`} · ${cfg.bots+1} cars · ${DIFF_NAMES[cfg.diff]} rivals${cfg.nUp?` · ${cfg.nUp} Upgrade${cfg.nUp===1?"":"s"} each`:""}</div>
    <div class="cgoal" style="font-size:17px;text-align:center">🎯 ${condName(cfg)}</div>
    ${careerFoe(cfg)?foeCardHTML(careerFoe(cfg), cfg.kind, true):""}
    ${modBriefHTML()}
    ${(G.career.damage|0)?`<div class="phase-hint" style="min-height:0;margin:4px 0;color:#e0b070">\uD83D\uDD29 The car is carrying ${G.career.damage} damage — ${G.career.damage} extra Stress in the deck, ${G.career.damage} less Heat in the Engine.</div>`:""}
    ${cfg.kind==="trial"?`<div class="phase-hint" style="min-height:0;margin:4px 0">\u23F1\uFE0F An empty circuit and a stopwatch. No grid, no slipstream, nobody to block you — and nobody to hide behind.</div>`:""}
    ${cfg.kind==="night"?`<div class="phase-hint" style="min-height:0;margin:4px 0;color:#e08a8a">\uD83C\uDF03 Unsanctioned. No entry fee and a purse to match the risk — but put it in the scenery and they'll impound an Upgrade card off the car.</div>`:""}
    ${cfg.grudgeLvl?`<div class="phase-hint" style="min-height:0;margin:4px 0;color:#e0b070">\uD83D\uDE24 You've lost to them ${cfg.grudgeLvl} time${cfg.grudgeLvl===1?"":"s"} already. They've brought ${cfg.grudgeLvl} extra Upgrade card${cfg.grudgeLvl===1?"":"s"} for the occasion.</div>`:""}
    ${cfg.cond==="rival"?`<div class="phase-hint" style="min-height:0;margin:4px 0">Watch for the <b style="color:${careerRivalColor(cfg)}">${esc(careerRivalLabel(cfg))}</b> car — that's the one you have to beat home.</div>`:""}
    ${wx?`<div class="phase-hint" style="min-height:0;margin:4px 0">${wx.def.icon} <b>${esc(wx.def.name)}</b> — ${esc(wx.def.blurb)}</div>`:""}
    <div class="crow" style="justify-content:center;color:#bdb3d4;font-size:13px;margin-top:6px">Purse: $${cfg.posM[0]} / $${cfg.posM[1]} / $${cfg.posM[2]} … · ${prizeLine(cfg)}</div>
    <div class="btnrow" style="margin-top:14px;justify-content:center"><button class="act" id="cbGo">Lights out ▸</button></div>
  </div>`;
  $("#cbGo").onclick=()=>{ el.style.display="none"; done(); };
}
/* called from endRound() — records who leads when lap 1 first completes */
function careerLapCheck(){
  if(G.mode!=="career"||!G._careerCfg||G._careerCfg.cond!=="lap1"||G._careerLap1Leader) return;
  if(!G.players.some(p=>p.total>=lapEndTotal(1))) return;   // layout-aware: lead-in boards finish lap 1 later than space S
  const lead=[...G.players].sort((a,b)=> b.total-a.total || a.spot-b.spot)[0];
  G._careerLap1Leader=lead.id;
  log(`🏁 End of lap 1 — ${lead.isBot?lead.name:"YOU"} lead${lead.isBot?"s":""} the field.`, lead.isBot?"warn":"me");
  if(!lead.isBot) toast("🎯 You lead lap 1 — goal met!");
}
function careerRaceOver(order){
  const C=G.career, node=cnById(C.raceNode);
  const cfg=G._careerCfg||nodeRaceCfg(node, C.raceKind||null);
  order=[...order].sort((a,b)=>(a.dq?1:0)-(b.dq?1:0));
  const you=order.find(p=>!p.isBot), pos=order.indexOf(you)+1;
  let ok=false;
  switch(effectiveCond(cfg)){
    case "win":  ok=!you.dq&&pos===1; break;
    case "top2": ok=!you.dq&&pos<=2; break;
    case "top3": ok=!you.dq&&pos<=3; break;
    case "top5": ok=!you.dq&&pos<=5; break;
    case "lap1": ok=G._careerLap1Leader===you.id; break;
    case "rival": {
      const rb=careerRivalCar(order, cfg);
      ok=!you.dq&&(!rb||order.indexOf(you)<order.indexOf(rb)); break; }
    case "time":
      ok=!you.dq&&!!you.finishRound&&you.finishRound<=(cfg.target||999); break;
  }
  C.races++;
  /* the act's championship scores every start, won or lost */
  careerTableRecord(order, cfg);
  const wonOutright = cfg.kind==="trial" ? ok : (!you.dq && pos===1);

  /* ---- what the race did to the car ----------------------------------
     Every spin you didn't get saved from bends something permanent in.
     Counted during the race by the weatherSpinOut hook in career-mods.js. */
  const spins = G._careerSpins|0;
  const dmgGained = Math.max(0, Math.min(spins, CAREER_DMG_MAX-(C.damage|0)));
  if(dmgGained){ C.damage=(C.damage|0)+dmgGained; }

  /* ---- night races: the law takes a part ------------------------------
     No entry fee, fat purse, and if you put it in the scenery somebody
     official removes an Upgrade card from the car while you're explaining. */
  let impounded=null;
  if(cfg.night && spins>0 && C.upgrades.length){
    const R=careerRng(cfg.seed+spins*17);
    const i=Math.floor(R()*C.upgrades.length);
    const def=upgradeById(C.upgrades[i]);
    C.upgrades.splice(i,1);
    impounded=def?def.name:"a part";
  }

  /* ---- the nemesis settles up ---------------------------------------- */
  const gfoe = cfg.kind==="grudge" ? careerFoe(cfg) : null;
  if(gfoe) careerGrudgeSettle(gfoe, ok);

  const pm=(typeof careerPerk==="function")?careerPerk("purseMult"):0;
  const posM=you.dq?0:Math.round(((cfg.posM[pos-1]!=null?cfg.posM[pos-1]:cfg.posM[cfg.posM.length-1]))*(1+pm));
  let gainM=0;
  if(ok){ C.wins++; gainM=posM+(cfg.bonus.m||0); careerArrive(node); }
  else gainM=Math.floor(posM/2);
  /* mod payouts that fire whatever the result (Scavenger's Crate) */
  const perkM=(typeof careerPerk==="function")?careerPerk("money"):0;
  gainM+=perkM;
  C.money+=gainM;
  /* ---- the backers have their say -------------------------------------
     THE core loop of the new economy: hitting the goal costs you nothing
     and the big races buy confidence back; missing it burns a backer. */
  const repDelta = ok ? ((cfg.bonus.rep||0) + ((typeof careerPerk==="function")?careerPerk("fuel"):0)) : -1;
  const repMoved = careerRepAdd(repDelta);
  careerStripDerivedClasses();     // don't let a race's derived classes leak onward
  saveCareer();
  showCareerRaceResult(node,cfg,order,you,pos,ok,gainM,repMoved,wonOutright,
                       { spins, dmgGained, impounded, grudge:gfoe });
}
/* ---- prizes --------------------------------------------------------
   Run in order, richest first, each screen handing on to the next:
     legendary mod (boss race, won outright)
     → mod          (Showdown, won outright)
     → Upgrade card (any race, goal met)
     → back to the map, or the title screen after the Grand Final. */
function careerPrizeChain(node, cfg, ok, wonOutright, finish){
  const steps=[];
  if(ok && cfg.bonus.legend && wonOutright)
    steps.push(next=>showCareerLegendPick(cfg.seed+201,
      cfg.kind==="boss" ? "🏆 Champion's spoils — take a Legendary" : "👑 Act Final won outright — take a Legendary",
      next, 2));
  if(ok && cfg.bonus.mod && wonOutright)
    steps.push(next=>showCareerModPick(cfg.seed+99,
      cfg.kind==="grudge" ? "\uD83D\uDE24 Grudge settled — pick a Mod"
      : cfg.kind==="night" ? "\uD83C\uDF03 Won it in the dark — pick a Mod"
      : "\uD83D\uDD25 Showdown won outright — pick a Mod", next,3));
  if(ok && cfg.bonus.upg)
    steps.push(next=>showCareerUpgradePick(cfg.seed+99,"🛠️ Garage — pick an Upgrade",next));
  let i=0;
  const run=()=>{ if(i>=steps.length){ finish(); return; } steps[i++](run); };
  run();
}
function showCareerRaceResult(node,cfg,order,you,pos,ok,gainM,repMoved,wonOutright,after){
  const C=G.career, c0=careerCostOf(node);
  after=after||{};
  const pass=(typeof careerPerk==="function")&&careerPerk("retryHalf");
  const c={ f:0, m: pass?0:c0.m };
  const broke=careerBroke();
  const canRetry=!broke&&C.money>=c.m;
  const rows=order.map((p,i)=>`
    <div class="standrow"><div class="p">P${i+1}</div>
      <div class="dot" style="background:${p.color}"></div>
      <div>${p.isBot?p.name:"No. 17 — You"}${(cfg.cond==="rival"&&careerRivalIs(p,cfg))?" 🎯":""}</div>
      <div style="margin-left:auto;color:var(--cream-dim);font-size:12px">${p.dq?"DQ":p.finishRound?("R"+p.finishRound):"DNF"}</div>
    </div>`).join("");
  const el=$("#setup"); el.style.display="flex"; el.onclick=null; el.scrollTop=0;
  const isBoss=cfg.kind==="boss";
  const isActFinal=cfg.kind==="actboss";
  const head = ok ? (isBoss?"🏆 GRAND FINAL — WON!" : isActFinal?"👑 Act Final — claimed" : "🎯 Goal met!") : "Goal missed";
  /* what the player is about to be handed, spelled out before they click */
  const prizes=[];
  if(ok && cfg.bonus.legend && wonOutright) prizes.push("a <b style='color:#ff7bd5'>Legendary mod</b>");
  if(ok && cfg.bonus.mod && wonOutright)    prizes.push("a <b style='color:#6bd48c'>Mod</b>");
  if(ok && cfg.bonus.upg)                   prizes.push("an <b>Upgrade card</b>");
  /* the near-miss line: goal met but somebody beat you home, so the good loot walked */
  const missedLoot = ok && !wonOutright && (cfg.bonus.legend || cfg.bonus.mod);
  el.innerHTML=`<div class="sheet">
    <h2>${head}</h2>
    <div class="tag">${esc(TRACK.name)} · ${actLabel(cfg.act||careerActOf(node))} · 🎯 ${condName(cfg)} · you finished P${pos}${you.dq?" (DQ)":""}</div>
    ${ok?"":`<div class="cfailhero">💨</div>`}
    <div class="cgoal" style="text-align:center">${ok
      ? `Stop claimed — +$${gainM}${repMoved>0?` & +${repMoved} ${CAREER_REP_ICON}`:""}`
      : `Half purse only — +$${gainM}. The stop stays open.`}</div>
    ${!ok?`<div class="crow" style="justify-content:center;color:#e08a8a">\uD83D\uDCC9 A backer loses patience — <b>−1 ${CAREER_REP_ICON}</b>. Confidence: ${repPips(C.rep)}${broke?" — that was the last of them.":""}</div>`:""}
    ${after.dmgGained?`<div class="crow" style="justify-content:center;color:#e0b070">\uD83D\uDD29 ${after.spins>1?after.spins+" spins":"You spun it"} — the car carries it from here: <b>+${after.dmgGained} damage</b> (${C.damage}/${CAREER_DMG_MAX}). That's ${C.damage} extra Stress card${C.damage===1?"":"s"} in the deck and ${C.damage} less Heat in the Engine until it's repaired.</div>`:""}
    ${after.impounded?`<div class="crow" style="justify-content:center;color:#e08a8a">\uD83D\uDEA8 Unsanctioned race, wrecked car, awkward questions — they impounded <b>${esc(after.impounded)}</b>.</div>`:""}
    ${after.grudge?`<div class="crow" style="justify-content:center;color:${ok?"#8fd6a8":"#e0b070"}">\uD83D\uDE24 ${ok
      ? `${esc(after.grudge.name)} is done with you — they won't be on another grid this act.`
      : `${esc(after.grudge.name)} isn't finished. Next time they bring another Upgrade card.`}</div>`:""}
    ${prizes.length?`<div class="crow" style="justify-content:center">Waiting for you: ${prizes.join(" · ")}</div>`:""}
    ${missedLoot?`<div class="crow" style="justify-content:center;color:#e0b070">You met the goal, but ${cfg.bonus.legend?"a Legendary":"the Mod"} only goes to the winner. Re-enter and take P1 if you want it.</div>`:""}
    ${rows}
    <div class="olbl" style="margin:12px 0 2px">📊 ${esc(actLabel(cfg.act||careerActOf(node)))} — championship after ${C.races} round${C.races===1?"":"s"}</div>
    ${careerTableHTML(true)}
    ${(()=>{ const g=careerTableGap(), b=careerTableBump(), l=careerTableLeader();
      if(!l) return "";
      if(!g) return `<div class="crow" style="justify-content:center;color:#8fd6a8">You lead the act — the final's opposition gets no help from the table.</div>`;
      return `<div class="crow" style="justify-content:center;color:${b?"#e0b070":"#8f86a8"}">${esc(l.name)} leads you by ${g}${b?` — ${b} extra Upgrade card${b===1?"":"s"} in the act final's field`:" — not enough yet to change the act final"}.</div>`;
    })()}
    <div class="cstatbar" style="margin-top:10px"><span class="cstat">${repPips(C.rep)}</span><span class="cstat">💰 <b>$${C.money}</b></span><span class="cstat">🛠️ <b>${C.upgrades.length}</b></span>${(C.damage|0)?`<span class="cstat" style="color:#e0b070">\uD83D\uDD29 <b>${C.damage}</b></span>`:""}</div>
    <div class="btnrow" style="margin-top:14px">
      ${replayBtnHTML()}
      ${ok
        ? `<button class="act" id="crGo">${prizes.length?"Collect your prizes ▸":(isBoss?"Take the title ▸":"Back to the map ▸")}</button>
           ${missedLoot&&canRetry?`<button class="act secondary" id="crRetry">↻ Run it again for the win${c.m?` — $${c.m}`:" — free"}</button>`:""}`
        : `<button class="act" id="crRetry" ${canRetry?"":"disabled style='opacity:.45'"}>↻ Re-enter${c.m?` — $${c.m}`:" — free"}${broke?"":` · another miss costs 1 ${CAREER_REP_ICON}`}</button>
           <button class="act secondary" id="crMap">${broke?"Face the sponsors ▸":"Back to the map"}</button>`}
    </div>
    ${!ok&&!canRetry&&!broke?`<div class="phase-hint" style="margin-top:8px;min-height:0">You can't cover the entry fee right now — head back to the map and find the money first.</div>`:""}
    ${broke?`<div class="phase-hint" style="margin-top:8px;min-height:0;color:#e08a8a">That was the last backer. There's a phone call waiting for you.</div>`:""}
  </div>`;
  wireReplayBtn();
  const retry=()=>{
    C.money-=c.m; saveCareer();
    showRaceLoading(trackName(cfg.track), `Career · re-entry paid · 🎯 ${condName(cfg)}`, ()=>startCareerRace(node,cfg));
  };
  if(ok){
    $("#crGo").onclick=()=>{
      careerPrizeChain(node,cfg,ok,wonOutright,()=>{
        if(isBoss||isActFinal){
          /* the act doesn't end at the flag any more — the road runs one
             floor further, into the transition room with the Legendary.
             (Books sealed before that room existed keep the old exits.) */
          const trans = cnKids(node.id).map(cnById).find(n=>n&&n.type==="legend");
          if(trans){ showCareerMap(); return; }
          if(isBoss){ showCareerVictory(false); return; }
          showActBreak(); return;
        }
        showCareerMap();
      });
    };
    const rb2=$("#crRetry"); if(rb2) rb2.onclick=retry;
  } else {
    const rb=$("#crRetry");
    if(rb&&!rb.disabled) rb.onclick=retry;
    $("#crMap").onclick=()=>{ if(broke) showCareerGameOver(); else showCareerMap(); };
  }
}
function showCareerVictory(journeyOnly){
  const C=G.career, el=$("#setup"); el.style.display="flex"; el.onclick=null; el.scrollTop=0;
  el.innerHTML=`<div class="sheet" style="text-align:center">
    <h2>${journeyOnly?"🏁 End of the road":"🏆 CHAMPION!"}</h2>
    <div class="tag">${journeyOnly?`You drove ${esc(C.mapName)} end to end.`:`You took the Grand Final — ${esc(C.mapName)} is yours.`}</div>
    <div class="cfailhero" style="font-size:56px">${journeyOnly?"🚗💨":"🏆"}</div>
    <div class="optgroup" style="text-align:left"><div class="olbl">The season</div>
      ${summaryRow("Stops made", String(C.stops!=null?C.stops:C.done.length))}
      ${summaryRow("Race goals hit", `${C.wins} of ${C.races}`)}
      ${summaryRow("Final standing", `${repPips(C.rep)} · $${C.money}`)}
      ${summaryRow("Car", `${classByKey(C.cls).name} — ${C.upgrades.length} Upgrade${C.upgrades.length===1?"":"s"} fitted`)}
      ${summaryRow("Mods", (C.mods||[]).length ? (C.mods||[]).map(id=>(cmodById(id)||{}).icon||"").join(" ") : "none")}
      ${summaryRow("Legendaries", (()=>{ const L=(C.mods||[]).map(id=>cmodById(id)).filter(m=>m&&m.rarity==="legendary"); return L.length?L.map(m=>`${m.icon} ${m.name}`).join(" · "):"none — the trophy rooms kept theirs"; })())}
    </div>
    <div class="btnrow" style="margin-top:16px;justify-content:center">
      <button class="act" id="cvNew">New career</button>
      <button class="act secondary" id="cvMenu">Main menu</button>
    </div></div>`;
  clearCareerSave(); G.career=null;
  $("#cvNew").onclick=()=>showCareerSelect();
  $("#cvMenu").onclick=()=>{ el.style.display="none"; showModeSelect(); };
}
function showCareerGameOver(){
  const C=G.career, el=$("#setup"); el.style.display="flex"; el.onclick=null; el.scrollTop=0;
  el.innerHTML=`<div class="sheet" style="text-align:center">
    <h2>\uD83D\uDCC9 The sponsors walked</h2>
    <div class="tag">${esc(C.mapName)} · ${C.done.length} stops in — the last backer stopped returning calls.</div>
    <div class="cfailhero" style="font-size:56px">\uD83D\uDCBC</div>
    <div class="phase-hint" style="min-height:0">The transporter goes home on Friday. Whatever was in the wallet doesn't come into it — they were paying for results.</div>
    <div class="optgroup" style="text-align:left"><div class="olbl">How it ended</div>
      ${summaryRow("Stops made", String(C.stops!=null?C.stops:C.done.length))}
      ${summaryRow("Race goals hit", `${C.wins} of ${C.races}`)}
      ${summaryRow("Goals missed", String(Math.max(0,C.races-C.wins)))}
      ${summaryRow("Car", `${classByKey(C.cls).name} — ${C.upgrades.length} Upgrade${C.upgrades.length===1?"":"s"}${(C.damage|0)?`, ${C.damage} damage carried`:""}`)}
    </div>
    <div class="btnrow" style="margin-top:16px;justify-content:center">
      <button class="act" id="cgNew">New career</button>
      <button class="act secondary" id="cgMenu">Main menu</button>
    </div></div>`;
  clearCareerSave(); G.career=null;
  $("#cgNew").onclick=()=>showCareerSelect();
  $("#cgMenu").onclick=()=>{ el.style.display="none"; showModeSelect(); };
}
