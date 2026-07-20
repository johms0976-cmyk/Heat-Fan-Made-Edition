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
const CAREER_START = { fuel:12, money:60 };
const CAREER_MAXUP = 6;                       // garage slots
const CAREER_POS_MONEY = [60,40,30,20,15,10,10,10];
const CTYPE = {
  start:{icon:"🚩",name:"Start line",blurb:"Where the road begins."},
  enemy:{icon:"🏁",name:"Race",blurb:"A sanctioned race. Meet the goal to claim the node."},
  drag:{icon:"🚦",name:"Drag race",blurb:"A straight-line sprint from lights to flag. One run down the strip — no laps, nowhere to hide."},
  elite:{icon:"🔥",name:"Showdown",blurb:"A big-money grudge race. Harder field, richer purse — and a free Upgrade if you deliver."},
  boss:{icon:"🏆",name:"Grand Final",blurb:"The last race of the season. Win it and the title is yours."},
  event:{icon:"❓",name:"Roadside event",blurb:"Something's happening out here. Could go either way."},
  merchant:{icon:"🛠️",name:"Speed shop",blurb:"Buy fuel and Upgrade cards for your car."},
  rest:{icon:"⛽",name:"Fuel stop",blurb:"Cheap travel, free top-up: +4 fuel."},
  treasure:{icon:"💰",name:"Prize crate",blurb:"Somebody left something valuable behind."},
  city:{icon:"🌆",name:"City — your call",blurb:"Big smoke. Find a race, chase a story, or hit the parts market — your choice."},
  town:{icon:"🏘️",name:"Town — your call",blurb:"A small town with options: race, event or shop — your choice."},
  poi:{icon:"📍",name:"Landmark — your call",blurb:"A famous spot on the map. Race, event or shop — your choice."}
};
const CCOST = { start:{f:0,m:0}, enemy:{f:3,m:0}, drag:{f:2,m:0}, elite:{f:4,m:20}, boss:{f:5,m:40},
  event:{f:2,m:0}, merchant:{f:2,m:0}, rest:{f:1,m:0}, treasure:{f:2,m:0},
  city:{f:2,m:0}, town:{f:2,m:0}, poi:{f:2,m:0} };
const CNODE_R = { start:16, boss:26, elite:20, city:18, enemy:14, drag:14, event:14, merchant:15, treasure:15, rest:15, town:14, poi:12 };

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
function cnById(id){ return G.career.map.nodes.find(n=>n.id===id); }
function cnKids(id){ return G.career.map.edges.filter(e=>e[0]===id).map(e=>e[1]); }
function careerCostOf(node){
  const c = CCOST[node.type]||{f:2,m:0}, d=node.data||{};
  let f = (d.feeF!=null?+d.feeF:c.f);
  const disc = (typeof careerPerk==="function") ? careerPerk("fuelDiscount") : 0;
  if(disc && f>0) f = Math.max(1, f-disc);          // Jerry Can — never free, but cheaper
  return { f, m:(d.feeM!=null?+d.feeM:c.m) };
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
  const map = normCareerMap(rawMap);
  const start = map.nodes.find(n=>n.type==="start");
  G.career = { v:1, map, mapName:map.name,
    at: start?start.id:null, done: start?[start.id]:[], pending:null,
    fuel:CAREER_START.fuel, money:CAREER_START.money,
    cls:G.playerCls||"ghost", upgrades:[], mods:[], shopSold:{}, modSold:{},
    races:0, wins:0, seed:Math.floor(Math.random()*1e9) };
  saveCareer();
}

/* ---------------- per-node race config (deterministic per career) */
function nodeSeed(node){ return careerHash(G.career.mapName+"|"+node.id+"|"+G.career.seed); }
/* Drag strips: boards that live in tracks/drag/ (drag1.js, drag2.js, …).
   Anything whose key starts with "drag", carries a drag:true flag, or is an
   open (point-to-point) board with "drag"/"strip" in its name counts. They
   are kept OUT of the normal circuit pool and only used for drag races. */
function careerDragTracks(){
  return Object.keys(TRACKS).filter(k => /^drag/i.test(k) || TRACKS[k].drag===true ||
    (typeof layoutOf==="function" && layoutOf(TRACKS[k])==="open" && /drag|strip/i.test(TRACKS[k].name||"")));
}
function nodeRaceCfg(node, kindOverride){
  const R = careerRng(nodeSeed(node));
  const kind = kindOverride || (node.type==="elite"?"elite" : node.type==="boss"?"boss" : "race");
  const dragKeys = careerDragTracks();
  let tks = Object.keys(TRACKS).filter(k=>!dragKeys.includes(k));   // circuits only
  if(!tks.length) tks = Object.keys(TRACKS);
  let track=null, cond=null, laps=null, dragPin=false;
  (node.label||"").toLowerCase().split("|").map(s=>s.trim()).forEach(p=>{
    if(TRACKS[p]) track=p;
    else if(p==="drag") dragPin=true;
    else if(["win","top2","top3","top5","lap1","rival"].includes(p)) cond=p;
    else if(/^[12]$/.test(p)) laps=+p;
  });
  const d=node.data||{};
  track = track || (TRACKS[d.track]?d.track:null) || tks[Math.floor(R()*tks.length)];
  const frac = node.floor/Math.max(1,G.career.map.maxFloor);
  let diff = frac<0.34?1 : frac<0.67?2 : 3;
  let bots = 4+Math.floor(R()*3);
  if(kind==="elite"){ diff=Math.min(3,diff+1); bots=6+Math.floor(R()*2); }
  if(kind==="boss"){ diff=3; bots=7; }
  /* Regular (enemy) races always run a single lap — 2 laps drags on. A lap
     count pinned in the label or node data is still honoured, and Showdowns /
     the Grand Final keep their old roll. (The unused roll is still drawn so
     the seeded stream — cond, weather, rival — stays identical on old saves.) */
  const lapsPinned = laps || (+d.laps>=1?Math.min(2,+d.laps):null);
  const lapRoll = lapsPinned ? null : (R()<0.35?2:1);
  laps = lapsPinned || (kind==="race" ? 1 : lapRoll);
  cond = cond || d.cond || null;
  if(!cond){
    if(kind==="boss") cond="win";
    else if(kind==="elite") cond = R()<0.5?"win":"top2";
    else { const pool = laps>=2 ? ["top5","top3","top3","lap1","rival","win"] : ["top5","top3","top3","rival","win"];
           cond = pool[Math.floor(R()*pool.length)]; }
  }
  if(cond==="lap1" && laps<2) laps=2;
  const rivalIdx = Math.floor(R()*Math.min(bots,BOT_POOL.length));
  const wkeys = Object.keys(WEATHER_TYPES).filter(k=>k!=="none");
  const weather = R()<0.45 ? wkeys[Math.floor(R()*wkeys.length)] : "none";
  const mult = kind==="elite"?1.5 : kind==="boss"?2 : 1;
  const posM = CAREER_POS_MONEY.map(v=>Math.round(v*mult));
  const bonus = kind==="elite" ? {m:50,f:3,mod:true} : kind==="boss" ? {m:100,f:0} : {m:30,f:2};
  const nUp = Math.min(3, Math.floor(frac*4) + (kind==="elite"?1:0) + (kind==="boss"?1:0));
  /* ---- drag races -------------------------------------------------------
     A stop runs as a drag race when: the node is a 🚦 drag node, its label
     says "drag" (or names a drag board directly), or — so drags also show up
     on presets and imported maps — a seeded ~1-in-6 of ordinary race stops
     converts, whenever drag boards are loaded. A drag is one straight sprint:
     forced 1 lap, no lap-1 goal, its own board. Rolled off a separate seeded
     stream so it never disturbs the config of the other stops. */
  let drag=false;
  if(dragKeys.length){
    const R2 = careerRng(nodeSeed(node)+13);
    const convert = R2();
    drag = node.type==="drag" || dragPin || dragKeys.includes(track) ||
           (kind==="race" && node.type==="enemy" && !kindOverride && convert<0.17);
    if(drag){
      if(!dragKeys.includes(track)) track = dragKeys[Math.floor(R2()*dragKeys.length)];
      laps = 1;
      if(cond==="lap1") cond = ["win","top2","top2","top3","rival"][Math.floor(R2()*5)];
    }
  }
  /* Named opposition. Showdowns draw a Rival, the Grand Final draws a Boss.
     Both are seeded off the node, so the same stop always fields the same
     driver — you can lose to Kessel, go away, and come back for him. */
  let boss=null, rival=null;
  if(kind==="boss")  boss  = (node.data&&bossById(node.data.boss))  || CAREER_BOSSES[Math.floor(R()*CAREER_BOSSES.length)];
  if(kind==="elite") rival = (node.data&&rivalById(node.data.rival)) || CAREER_RIVALS[Math.floor(R()*CAREER_RIVALS.length)];
  const foe = boss || rival;
  return { kind, track, laps, diff, bots, cond, rivalIdx, weather, posM, bonus, nUp, drag,
           bossId:boss?boss.id:null, rivalId:rival?rival.id:null, seed:nodeSeed(node) };
}
/* the map/briefing face for a race stop — converted drags show the 🚦 */
function careerNodeFace(node, cfg){ return (cfg&&cfg.drag) ? CTYPE.drag : CTYPE[node.type]; }
function careerNodeIsDrag(node){
  if(node.type==="drag") return true;
  if(node.type!=="enemy") return false;
  try{ return !!nodeRaceCfg(node).drag; }catch(e){ return false; }
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
    case "rival":return "Finish ahead of "+(careerFoeName(cfg)||(BOT_POOL[cfg.rivalIdx]||{}).name||"your rival");
  }
  return "Finish the race";
}
/* the named driver for this race, if there is one */
function careerFoe(cfg){ return (cfg.bossId&&bossById(cfg.bossId)) || (cfg.rivalId&&rivalById(cfg.rivalId)) || null; }
function careerFoeName(cfg){ const f=careerFoe(cfg); return f?f.name:null; }

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
      ${save?card("car-cont","🗺️","Continue career",`${esc(save.mapName||"Custom map")} · ⛽ ${save.fuel} · $${save.money} · ${save.done.length} stops made`,"Resume ▸"):""}
      ${CAREER_PRESETS.map((p,i)=>card("car-pre"+i,i?"⛰️":"🌊",p.name,`${p.nodes.length} stops · ${p.floors} legs · hand-built roadmap`,"Start ▸")).join("")}
      ${card("car-rand","🎲","Random roadmap","A fresh map every time — lanes, forks and showdowns rolled on the spot.","Roll ▸")}
      ${card("car-imp","📋","Import from Mapforge","Paste a JSON export from the Mapforge editor and race across your own map.","Paste ▸")}
    </div>
    <div class="phase-hint" style="margin-top:14px">Every stop costs fuel to reach (big races also charge an entry fee). Races set a goal — win, podium, top-5, lead lap 1, beat a named rival. Hit the goal to claim the stop and bank the purse; miss it and you can pay to re-enter, or route around. Run out of fuel and the season's over.</div>
    <div class="btnrow" style="margin-top:10px"><button class="act secondary" id="carback">◂ Back</button></div>
  </div>`;
  $("#carback").onclick=()=>{ el.style.display="none"; showModeSelect(); };
  if(save) $("#car-cont").onclick=()=>{ G.career=save; G.mode="career"; G.playerCls=save.cls; showCareerMap(); };
  CAREER_PRESETS.forEach((p,i)=>{ $("#car-pre"+i).onclick=()=>careerPickCar(p); });
  $("#car-rand").onclick=()=>careerPickCar(careerGenMap());
  $("#car-imp").onclick=showCareerImport;
}
function careerPickCar(rawMap){
  showDeckSelect(()=>{ try{ newCareer(rawMap); }catch(e){ alert(e.message); showCareerSelect(); return; }
    showCareerIntro(); }, showCareerSelect);
}
function showCareerIntro(){
  const C=G.career, el=$("#setup"); el.onclick=null; el.style.display="flex"; el.scrollTop=0;
  const c=classByKey(C.cls);
  const races=C.map.nodes.filter(n=>["enemy","drag","elite","boss"].includes(n.type)).length;
  el.innerHTML=`<div class="sheet">
    <h1>HEAT <span>· ${esc(C.mapName.toLowerCase())}</span></h1>
    <div class="tag">Season opener. One tank, one car, one road to the Grand Final.</div>
    <div class="optgroup"><div class="olbl">Your rig</div>
      <div class="deckcard" style="padding:12px">
        <div class="dk-art" style="height:130px">${DECK_ART[c.key]==="ok"?`<img src="${c.art}" alt="${esc(c.name)}">`:classCarSVG(c.key)}</div>
        <div class="dk-name">${esc(c.name)}</div><div class="dk-tag">${esc(c.tag)}</div>
      </div></div>
    <div class="optgroup"><div class="olbl">The deal</div>
      ${summaryRow("Starting tank","⛽ "+C.fuel+" fuel")}
      ${summaryRow("Starting purse","$"+C.money)}
      ${summaryRow("The map",`${C.map.nodes.length} stops · ${races} races on the board`)}
      ${summaryRow("Claiming a stop","Meet the race goal shown before lights-out")}
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
    <div class="tag">Paste a Mapforge export — the JSON download, the export box contents, or the paste-in <code>const</code> block all work.</div>
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
    try{ const raw=JSON.parse(t.slice(a,b+1)); normCareerMap(raw); careerPickCar(raw); }
    catch(e){ alert("Couldn't read that map: "+e.message); }
  };
}

/* ---------------- random roadmap (port of Mapforge's generator) */
function careerGenMap(){
  const W={enemy:36,drag:8,event:16,merchant:9,rest:7,elite:9,treasure:2,city:8,town:5,poi:2};
  if(typeof TRACKS==="undefined" || !careerDragTracks().length){ delete W.drag; W.enemy=42; }
  const floors=11+Math.floor(Math.random()*4), lanes=5+Math.floor(Math.random()*2), paths=5+Math.floor(Math.random()*2);
  const MARGIN=70, w=600, h=1400, tfloor=Math.floor(floors/2), elmin=4;
  const fp=f=>h-MARGIN-f*(h-2*MARGIN)/(floors-1), lp=l=>MARGIN+l*(w-2*MARGIN)/(lanes-1);
  for(let attempt=0;attempt<40;attempt++){
    const nodes=[], edges=[], grid={}; let nextId=1;
    const mk=(f,l)=>{ const k=f+","+l; if(grid[k]) return grid[k];
      const n={id:"n"+(nextId++),type:"enemy",label:"",floor:f,x:Math.round(lp(l)+Math.random()*18-9),y:Math.round(fp(f)),data:null};
      grid[k]=n; nodes.push(n); return n; };
    const topWalk=floors-2, edgeKeys=new Set(), laneEdges={};
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
      if(n.floor===tfloor){ n.type="treasure"; continue; }
      if(n.floor===topWalk){ n.type="rest"; continue; }
      let t=null,tries=0;
      while(tries++<30){
        let tot=0; for(const k of pool) tot+=((k==="elite"||k==="rest")&&n.floor<elmin?0:W[k]);
        let r=Math.random()*tot;
        for(const k of pool){ const wv=((k==="elite"||k==="rest")&&n.floor<elmin?0:W[k]); if((r-=wv)<0){ t=k; break; } }
        if(!t) t="enemy";
        if(["rest","merchant","elite"].includes(t)&&parents(n.id).some(p=>p&&p.type===t)){ t=null; continue; }
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
  const mods = (C.mods || []).map(modById).filter(Boolean);
  if(!mods.length)
    return `<div class="cmodstrip empty">No mods fitted yet — win Showdowns, crack prize crates or buy them at speed shops.</div>`;
  return `<div class="cmodstrip" id="cmodstrip">${mods.map(m =>
    `<button class="cmod" data-mid="${m.id}" title="${esc(m.name)}" style="border-color:${MOD_TINT[m.rarity]}">${m.icon}</button>`
  ).join("")}</div>`;
}
/* one mod, rendered as a card */
function modCardHTML(m, extra){
  return `<div class="cmodcard" style="border-color:${MOD_TINT[m.rarity]}">
    <div class="cm-ico">${m.icon}</div>
    <div class="cm-body">
      <div class="cm-name">${esc(m.name)}<span class="cm-rar" style="color:${MOD_TINT[m.rarity]}">${m.rarity}</span></div>
      <div class="cm-text">${esc(m.text)}</div>
      <div class="cm-flav">${esc(m.flavour)}</div>
    </div>${extra||""}</div>`;
}
function showModDetail(id){
  const m = modById(id); if(!m) return;
  const box = $("#cdetail"); if(!box) return;
  box.innerHTML = `<div class="cdetail">${modCardHTML(m)}
    <div class="btnrow" style="margin-top:8px"><button class="act secondary" id="cmdClose">Close</button></div></div>`;
  $("#cmdClose").onclick = () => { box.innerHTML = ""; };
}
/* mods that are actually doing something once the lights go out */
function modBriefHTML(){
  const mods = (G.career.mods || []).map(modById).filter(Boolean).filter(m => !m.fx.career);
  if(!mods.length) return "";
  return `<div class="cmodbrief">${mods.map(m =>
    `<span class="cmodpill" style="border-color:${MOD_TINT[m.rarity]}">${m.icon} ${esc(m.name)}</span>`).join("")}</div>`;
}
/* the named opposition, on the node card and the briefing */
function foeCardHTML(foe, isBoss, big){
  return `<div class="cfoe ${isBoss?"boss":""} ${big?"big":""}" style="--foe:${foe.color}">
    <div class="cf-ico">${foe.icon}</div>
    <div class="cf-body">
      <div class="cf-eyebrow">${isBoss?"Grand Final \u2014 your title fight":"Showdown \u2014 named rival"}</div>
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
  return CAREER_MODS.filter(m => !have.has(m.id));
}
function careerGrantMod(id, why){
  const C = G.career, m = modById(id);
  if(!m || (C.mods || []).includes(id)) return false;
  (C.mods = C.mods || []).push(id);
  saveCareer();
  toast(`${m.icon} ${m.name} fitted`);
  if(why) log(`${m.icon} ${m.name} — ${why}`, "me");
  return true;
}
/* offer a choice of mods (Showdown prize, boss reward, crate, event) */
function showCareerModPick(seed, title, done, count){
  const C = G.career, pool = careerModPool();
  if(!pool.length){ C.money += 60; saveCareer();
    careerNotice("\uD83D\uDD27 Nothing new", "You've already fitted every mod worth having. The crew sell the spare.", "+$60", done); return; }
  const R = careerRng(seed), offer = [];
  const bag = pool.slice();
  const n = Math.min(count || 3, bag.length);
  while(offer.length < n && bag.length) offer.push(bag.splice(Math.floor(R() * bag.length), 1)[0]);
  const el = $("#setup"); el.onclick = null; el.style.display = "flex"; el.scrollTop = 0;
  el.innerHTML = `<div class="sheet">
    <h2>${title}</h2>
    <div class="tag">Mods are permanent — one bolts on for the rest of the career. Tap to take it.</div>
    <div class="cmodpick" id="modPick">${offer.map(m =>
      `<button class="cmodpickbtn" data-mid="${m.id}">${modCardHTML(m)}</button>`).join("")}</div>
    <div class="btnrow" style="margin-top:12px"><button class="act secondary" id="modSkip">Leave it</button></div>
  </div>`;
  el.querySelectorAll(".cmodpickbtn").forEach(b => b.onclick = () => { careerGrantMod(b.dataset.mid); done(); });
  $("#modSkip").onclick = done;
}
function modPrice(m){
  const base = { common:55, uncommon:80, rare:120 }[m.rarity] || 70;
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
  const afford=reach.filter(n=>{ const c=careerCostOf(n); return C.fuel>=c.f&&C.money>=c.m; });
  const doneSet=new Set(C.done);
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
    const face = (n.type==="enemy" && careerNodeIsDrag(n)) ? CTYPE.drag : t;
    const cost = isReach ? `<text x="${n.x}" y="${n.y+r+16}" text-anchor="middle" font-size="13" font-weight="800" fill="${can?"#ffd86b":"#e08a8a"}">⛽${c.f}${c.m?` · $${c.m}`:""}</text>` : "";
    return `<g class="${isReach?"cnode-hit":""}" data-nid="${isReach?n.id:""}" opacity="${op}">
      <circle cx="${n.x}" cy="${n.y}" r="${r+5}" fill="#171225" stroke="${ring}" stroke-width="3" class="${cur?"cpulse":""}"/>
      <text x="${n.x}" y="${n.y+r*0.42}" text-anchor="middle" font-size="${Math.round(r*1.25)}">${done&&!cur?"✔":face.icon}</text>
      ${cost}</g>`;
  }).join("");
  el.innerHTML=`<div class="sheet" style="max-width:640px">
    <h1>HEAT <span>· ${esc(C.mapName.toLowerCase())}</span></h1>
    <div class="cstatbar">
      <span class="cstat">⛽ <b>${C.fuel}</b> fuel</span>
      <span class="cstat">💰 <b>$${C.money}</b></span>
      <span class="cstat">🛠️ <b>${C.upgrades.length}</b>/${CAREER_MAXUP} upgrades</span>
      <span class="cstat">⚙️ <b>${(C.mods||[]).length}</b> mods</span>
      <span class="cstat">🏁 <b>${C.wins}</b>/${C.races} goals hit</span>
    </div>
    <div class="cmapwrap" id="cmapwrap">
      <svg id="cmapsvg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${edgeSvg}${nodeSvg}</svg>
      <div class="cmapctl">
        <button id="cmZoomIn"  aria-label="Zoom in">＋</button>
        <button id="cmZoomOut" aria-label="Zoom out">−</button>
        <button id="cmFit"     aria-label="Fit whole map" title="Fit whole map">⤢</button>
        <button id="cmMe"      aria-label="Centre on my car" title="Centre on my car">🎯</button>
      </div>
    </div>
    <div class="phase-hint" style="margin:8px 0 0">Drag to pan, pinch or ＋/− to zoom, ⤢ for the whole map, 🎯 to snap back to your car. Gold ring = you can afford it · red ring = too rich right now · tap a ringed stop to see the deal.</div>
    ${modStripHTML()}
    <div id="cdetail"></div>
    <div class="btnrow" style="margin-top:12px">
      <button class="act secondary" id="cmGarage">🛠️ My car</button>
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
  $("#cmAbandon").onclick=()=>{ if(confirm("Abandon this career? The save is deleted.")){ clearCareerSave(); G.career=null; showModeSelect(); } };
  // camera: fit the whole map, then ease onto your car if there's one to find
  careerMapCam.attach($("#cmapwrap"), $("#cmapsvg"), C.map);
  const focus = C.at ? cnById(C.at) : null;
  if(focus) careerMapCam.focusOn(focus.x, focus.y, 0.55);
  else careerMapCam.fit();
  // stranded?
  if(reach.length && !afford.length) careerStranded(reach);
  if(!reach.length && C.at!=null){ // walked off the end of a boss-less map
    const here=cnById(C.at);
    if(here && here.type!=="boss") showCareerVictory(true);
  }
}
function showCareerNodeDetail(node){
  if(!node) return;
  const C=G.career, box=$("#cdetail"), t=CTYPE[node.type], c=careerCostOf(node);
  const can=C.fuel>=c.f&&C.money>=c.m;
  const isRace=["enemy","drag","elite","boss"].includes(node.type);
  let inner=`<h3>${t.icon} ${esc(t.name)}</h3><div class="crow">${esc(t.blurb)}</div>`;
  if(isRace){
    const cfg=nodeRaceCfg(node);
    const face=careerNodeFace(node,cfg);
    if(cfg.drag) inner=`<h3>${face.icon} ${esc(face.name)}</h3><div class="crow">${esc(face.blurb)}</div>`;
    inner+=`<div class="crow">${cfg.drag?"Strip":"Circuit"}: <b>${esc(trackName(cfg.track))}</b> · ${cfg.drag?"straight-line sprint":`${cfg.laps} lap${cfg.laps>1?"s":""}`} · ${cfg.bots+1}-car grid · ${DIFF_NAMES[cfg.diff]} rivals${cfg.weather!=="none"?` · ${WEATHER_TYPES[cfg.weather].icon} ${WEATHER_TYPES[cfg.weather].name}`:""}</div>
    ${careerFoe(cfg)?foeCardHTML(careerFoe(cfg), node.type==="boss"):""}
    <div class="cgoal">🎯 Goal: ${condName(cfg)}</div>
    <div class="crow">Purse: <b>$${cfg.posM[0]}</b> for the win, paid down to last · goal bonus <b>+$${cfg.bonus.m}${cfg.bonus.f?` & +${cfg.bonus.f} ⛽`:""}${cfg.bonus.upg?" & a free Upgrade":""}${cfg.bonus.mod?" & your pick of a Mod":""}</b></div>
    <div class="crow" style="color:#8f86a8">Miss the goal and you keep half the position money — re-enter for the same cost, or route around.</div>`;
  } else if(["city","town","poi"].includes(node.type)){
    inner+=`<div class="crow">On arrival you choose: <b>🏁 find a race</b> (seeded circuit &amp; goal), <b>❓ chase the local story</b>, or <b>🛠️ hit the parts market</b>.</div>`;
  }
  inner+=`<div class="crow" style="margin-top:6px">Cost to go: <b style="color:${can?"#ffd86b":"#e08a8a"}">⛽ ${c.f} fuel${c.m?` + $${c.m} entry`:""}</b>${can?"":" — you can't cover this yet"}</div>
  <div class="btnrow" style="margin-top:10px">
    <button class="act" id="cGo" ${can?"":"disabled style='opacity:.45'"}>Drive there ▸</button>
    <button class="act secondary" id="cNah">Not yet</button>
  </div>`;
  box.innerHTML=`<div class="cdetail">${inner}</div>`;
  box.scrollIntoView({behavior:"smooth",block:"nearest"});
  $("#cNah").onclick=()=>{ box.innerHTML=""; };
  if(can) $("#cGo").onclick=()=>careerTravel(node);
}
function careerStranded(reach){
  const C=G.career, box=$("#cdetail");
  const cheapest=Math.min(...reach.map(n=>careerCostOf(n).f));
  const opts=[];
  if(C.upgrades.length) opts.push(`<button class="act" id="cScrap">Scrap an Upgrade → +4 ⛽</button>`);
  if(C.money>=30) opts.push(`<button class="act" id="cSiphon">Trade $30 → +1 ⛽</button>`);
  if(!opts.length){ showCareerGameOver(); return; }
  box.innerHTML=`<div class="cdetail"><h3>⛽ Running on fumes</h3>
    <div class="crow">The cheapest road out needs <b>${cheapest} fuel</b> and you can't cover any stop. Time to get creative.</div>
    <div class="btnrow" style="margin-top:10px">${opts.join("")}</div></div>`;
  const scrapBtn=$("#cScrap"), sipBtn=$("#cSiphon");
  if(scrapBtn) scrapBtn.onclick=()=>{
    const id=C.upgrades.pop(); const def=upgradeById(id);
    C.fuel+=4; saveCareer(); toast(`🗑 ${def?def.name:"Upgrade"} scrapped — +4 fuel`); showCareerMap();
  };
  if(sipBtn) sipBtn.onclick=()=>{ C.money-=30; C.fuel+=1; saveCareer(); showCareerMap(); };
}
function showCareerGarage(){
  const C=G.career, box=$("#cdetail");
  const defs=C.upgrades.map(id=>upgradeById(id)).filter(Boolean);
  const mods=(C.mods||[]).map(modById).filter(Boolean);
  box.innerHTML=`<div class="cdetail"><h3>🛠️ ${esc(classByKey(C.cls).name)} — ${defs.length}/${CAREER_MAXUP} Upgrades fitted</h3>
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
  if(C.fuel<c.f||C.money<c.m){ toast("You can't cover that stop"); return; }
  C.fuel-=c.f; C.money-=c.m; C.pending=node.id; saveCareer();
  careerResolve(node);
}
function careerArrive(node){
  const C=G.career;
  C.at=node.id; if(!C.done.includes(node.id)) C.done.push(node.id);
  C.pending=null; saveCareer();
}
function careerResolve(node){
  const C=G.career;
  switch(node.type){
    case "enemy": case "drag": case "elite": case "boss":
      launchCareerRace(node); break;
    case "rest": {
      careerArrive(node);
      const rb=(typeof careerPerk==="function")?careerPerk("restBonus"):0;
      C.fuel+=4+rb; saveCareer();
      careerNotice("⛽ Fuel stop", rb?"Tank topped up on the cheap — and the long-range tank swallows extra.":"Tank topped up on the cheap.", `+${4+rb} fuel`, ()=>showCareerMap()); break; }
    case "treasure": {
      careerArrive(node);
      const R=careerRng(nodeSeed(node));
      const roll=R();
      if(roll<0.3 && careerModPool().length){
        showCareerModPick(nodeSeed(node)+91,"💰 Prize crate — a mod, still in its wrapping",()=>showCareerMap(),2);
      } else if(roll<0.65 || C.upgrades.length>=CAREER_MAXUP){
        const amt=50+Math.floor(R()*5)*10; C.money+=amt; saveCareer();
        careerNotice("💰 Prize crate","Cash under the spare wheel. No questions asked.","+$"+amt,()=>showCareerMap());
      } else {
        showCareerUpgradePick(nodeSeed(node)+33,"💰 Prize crate — pick a free Upgrade",()=>showCareerMap());
      } break; }
    case "merchant":
      careerArrive(node); showCareerShop(node); break;
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
  const full=C.upgrades.length>=CAREER_MAXUP;
  const msold=(C.modSold=C.modSold||{})[node.id]=C.modSold[node.id]||[];
  const modStock=careerShopMods(node).filter(ms=>!msold.includes(ms.id)&&!(C.mods||[]).includes(ms.id));
  el.innerHTML=`<div class="sheet">
    <h1>HEAT <span>· speed shop</span></h1>
    <div class="cstatbar"><span class="cstat">⛽ <b>${C.fuel}</b></span><span class="cstat">💰 <b>$${C.money}</b></span><span class="cstat">🛠️ <b>${C.upgrades.length}</b>/${CAREER_MAXUP}</span></div>
    <div class="olbl" style="margin:6px 0 2px">Fuel by the can</div>
    <div class="btnrow"><button class="act" id="shFuel" ${C.money>=15?"":"disabled style='opacity:.45'"}>Buy 1 ⛽ — $15</button></div>
    <div class="olbl" style="margin:12px 0 2px">Upgrade cards${full?" — your garage is full":" — tap to buy"}</div>
    <div class="draftmkt" id="shMkt">${stock.length?"":"<div class='phase-hint' style='min-height:0'>Sold out — you cleaned this place out.</div>"}</div>
    <div class="olbl" style="margin:14px 0 2px">Mods — permanent, no slot limit</div>
    <div id="shMods">${modStock.length?modStock.map(ms=>{
      const m=modById(ms.id), afford=C.money>=ms.price;
      return `<button class="cmodbuy ${afford?"":"broke"}" data-mid="${m.id}" data-price="${ms.price}">
        ${modCardHTML(m,`<div class="cm-price" style="color:${afford?"#ffd86b":"#e08a8a"}">$${ms.price}${afford?"":" ✗"}</div>`)}</button>`;
    }).join(""):"<div class='phase-hint' style='min-height:0'>No mods on the shelf here.</div>"}</div>
    <div class="btnrow" style="margin-top:14px"><button class="act" id="shGo">Hit the road ▸</button></div>
  </div>`;
  $("#shFuel").onclick=()=>{ if(C.money<15) return; C.money-=15; C.fuel+=1; saveCareer(); showCareerShop(node); };
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
/* free upgrade pick (prize crates, Showdown wins, events) */
function showCareerUpgradePick(seed,title,done){
  const C=G.career;
  if(C.upgrades.length>=CAREER_MAXUP){ C.money+=40; saveCareer(); careerNotice("🛠️ Garage full","No slot left — you flip the part for cash instead.","+$40",done); return; }
  const R=careerRng(seed), pool=UPGRADE_CARDS.slice(), offer=[];
  while(offer.length<3&&pool.length) offer.push(pool.splice(Math.floor(R()*pool.length),1)[0]);
  const el=$("#setup"); el.onclick=null; el.style.display="flex"; el.scrollTop=0;
  el.innerHTML=`<div class="sheet"><h2>${title}</h2>
    <div class="tag">Tap one to bolt it on — it rides in your deck for the rest of the career.</div>
    <div class="draftmkt" id="upPick"></div>
    <div class="btnrow" style="margin-top:12px"><button class="act secondary" id="upSkip">Leave it</button></div></div>`;
  const mkt=$("#upPick");
  offer.forEach(def=>{ const cd=renderCard(makeUpgCard(def));
    cd.onclick=()=>{ C.upgrades.push(def.id); saveCareer(); toast(`🛠️ ${def.name} fitted`); done(); };
    mkt.appendChild(cd); });
  $("#upSkip").onclick=done;
}

/* ---------------- roadside events */
const CAREER_EVENTS=[
  {name:"Roadside Sponsor", icon:"🎥", text:"A film crew flags you down — they want footage of your car for a petrol ad.",
    a:{lbl:"Pose for the cameras (+$40)", m:40}, b:{lbl:"No time for fame (+1 ⛽ shortcut tip)", f:1}},
  {name:"Black-market Fuel", icon:"🛢️", text:"A tanker driver in a layby offers cheap gas. No receipts, no questions.",
    a:{lbl:"Buy 3 ⛽ for $25", m:-25, f:3, needM:25}, b:{lbl:"Walk away"}},
  {name:"Backroad Wager", icon:"🎲", text:"A local hotshot in a rusted V8 bets you can't beat him to the next town.",
    a:{lbl:"Take the bet — 50/50: +$60 or −$30", gamble:{win:{m:60},lose:{m:-30}}}, b:{lbl:"Keep your money"}},
  {name:"Broken-down Rival", icon:"🔧", text:"One of the circuit regulars is steaming on the shoulder, bonnet up.",
    a:{lbl:"Tow them in (−1 ⛽, +$50 thanks)", f:-1, m:50, needF:1}, b:{lbl:"Wave and drive past"}},
  {name:"Pit-lane Rumour", icon:"🤫", text:"A mechanic whispers about parts that fell off the back of a truck.",
    a:{lbl:"Pay $35 for a mystery Upgrade", m:-35, upg:true, needM:35}, b:{lbl:"Too risky"}},
  {name:"Storm Warning", icon:"⛈️", text:"Black clouds are stacking up over the pass ahead.",
    a:{lbl:"Take the long detour (−1 ⛽, safe)", f:-1, needF:1}, b:{lbl:"Drive through — 50/50: −2 ⛽ or +$30 saved", gamble:{win:{m:30},lose:{f:-2}}}},
  {name:"Lock-Up Auction", icon:"🔑", text:"A defunct team's lock-up is being cleared out by the bailiffs. Half of it is junk. Half of it isn't.",
    a:{lbl:"Bid $45 on the crate", m:-45, mod:true, needM:45}, b:{lbl:"Let someone else gamble"}},
  {name:"Fan Club", icon:"📸", text:"Kids from the local kart club recognise the car and swarm the forecourt.",
    a:{lbl:"Sign everything (+$25 in merch)", m:25}, b:{lbl:"Rev it and roll out (+1 ⛽ — they push-start you, somehow)", f:1}},
];
function showCareerEvent(node){
  const C=G.career, R=careerRng(nodeSeed(node)+55);
  const ev=CAREER_EVENTS[Math.floor(R()*CAREER_EVENTS.length)];
  const el=$("#setup"); el.onclick=null; el.style.display="flex"; el.scrollTop=0;
  const optBtn=(o,id)=>{
    const blocked=(o.needM&&C.money<o.needM)||(o.needF&&C.fuel<o.needF);
    return `<button class="act ${id==="evB"?"secondary":""}" id="${id}" ${blocked?"disabled style='opacity:.45'":""}>${esc(o.lbl)}${blocked?" — can't afford":""}</button>`;
  };
  el.innerHTML=`<div class="sheet" style="max-width:480px">
    <h2>${ev.icon} ${esc(ev.name)}</h2>
    <div class="tag">Roadside event</div>
    <div class="phase-hint" style="min-height:0;margin:8px 0 14px">${esc(ev.text)}</div>
    <div class="btnrow" style="flex-direction:column;align-items:stretch">${optBtn(ev.a,"evA")}${optBtn(ev.b,"evB")}</div>
    <div class="cstatbar" style="margin-top:12px"><span class="cstat">⛽ <b>${C.fuel}</b></span><span class="cstat">💰 <b>$${C.money}</b></span></div>
  </div>`;
  const apply=(o)=>{
    let outcome=o, tag="";
    if(o.gamble){ const luck=(typeof careerPerk==="function")?careerPerk("luck"):0;
      const won=Math.random()<0.5+luck; outcome=won?o.gamble.win:o.gamble.lose; tag=won?"You won the coin flip. ":"It went badly. "; }
    C.money=Math.max(0,C.money+(outcome.m||0));
    C.fuel=Math.max(0,C.fuel+(outcome.f||0));
    saveCareer();
    const bits=[]; if(outcome.m) bits.push((outcome.m>0?"+$":"−$")+Math.abs(outcome.m));
    if(outcome.f) bits.push((outcome.f>0?"+":"−")+Math.abs(outcome.f)+" ⛽");
    if(o.mod){ showCareerModPick(nodeSeed(node)+88,"🔑 Lock-Up Auction — what was in the crate",()=>showCareerMap(),2); return; }
    if(o.upg){ showCareerUpgradePick(nodeSeed(node)+77,"🤫 The truck's cargo — pick one",()=>showCareerMap()); return; }
    careerNotice(ev.icon+" "+ev.name, tag+(bits.length?"The road settles up.":"You move on, nothing gained, nothing lost."), bits.join(" · "), ()=>showCareerMap());
  };
  const bA=$("#evA"), bB=$("#evB");
  if(bA&&!bA.disabled) bA.onclick=()=>apply(ev.a);
  if(bB&&!bB.disabled) bB.onclick=()=>apply(ev.b);
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
  G.activeHuman=null;
  /* The named Boss / Rival always takes grid slot 0 in the bot list, so the
     "beat your rival" goal and the briefing both know where to look. */
  const foe=careerFoe(cfg);
  G._careerRacers = foe ? {0:foe} : null;
  if(foe) cfg.rivalIdx = 0;
  G.players=[ makeHuman(C.upgrades.slice(), null, C.cls) ];
  const R=careerRng(cfg.seed+7);
  for(let i=0;i<cfg.bots;i++){
    const ups=[]; for(let u=0;u<cfg.nUp;u++) ups.push(UPGRADE_CARDS[Math.floor(R()*UPGRADE_CARDS.length)].id);
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
    <div class="tag">${esc(TRACK.name)} · ${cfg.drag?"straight-line sprint":`${cfg.laps} lap${cfg.laps>1?"s":""}`} · ${cfg.bots+1} cars · ${DIFF_NAMES[cfg.diff]} rivals</div>
    <div class="cgoal" style="font-size:17px;text-align:center">🎯 ${condName(cfg)}</div>
    ${careerFoe(cfg)?foeCardHTML(careerFoe(cfg), node.type==="boss", true):""}
    ${modBriefHTML()}
    ${cfg.cond==="rival"?`<div class="phase-hint" style="min-height:0;margin:4px 0">Watch for the <b style="color:${(BOT_POOL[cfg.rivalIdx]||{}).color||"#fff"}">${esc((BOT_POOL[cfg.rivalIdx]||{}).name||"rival")}</b> car — that's the one you have to beat home.</div>`:""}
    ${wx?`<div class="phase-hint" style="min-height:0;margin:4px 0">${wx.def.icon} <b>${esc(wx.def.name)}</b> — ${esc(wx.def.blurb)}</div>`:""}
    <div class="crow" style="justify-content:center;color:#bdb3d4;font-size:13px;margin-top:6px">Purse: $${cfg.posM[0]} / $${cfg.posM[1]} / $${cfg.posM[2]} … · goal bonus +$${cfg.bonus.m}${cfg.bonus.f?` & +${cfg.bonus.f} ⛽`:""}${cfg.bonus.upg?" & a free Upgrade":""}${cfg.bonus.mod?" & your pick of a Mod":""}</div>
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
      const rb=order.find(p=>p.isBot&&p.botIndex===cfg.rivalIdx);
      ok=!you.dq&&(!rb||order.indexOf(you)<order.indexOf(rb)); break; }
  }
  C.races++;
  const pm=(typeof careerPerk==="function")?careerPerk("purseMult"):0;
  const posM=you.dq?0:Math.round(((cfg.posM[pos-1]!=null?cfg.posM[pos-1]:cfg.posM[cfg.posM.length-1]))*(1+pm));
  let gainM=0, gainF=0;
  if(ok){ C.wins++; gainM=posM+(cfg.bonus.m||0); gainF=cfg.bonus.f||0; careerArrive(node); }
  else gainM=Math.floor(posM/2);
  /* mod payouts that fire whatever the result (Scavenger's Crate) */
  const perkM=(typeof careerPerk==="function")?careerPerk("money"):0;
  const perkF=(typeof careerPerk==="function")?careerPerk("fuel"):0;
  gainM+=perkM; gainF+=perkF;
  C.money+=gainM; C.fuel+=gainF;
  careerStripDerivedClasses();     // don't let a race's derived classes leak onward
  saveCareer();
  showCareerRaceResult(node,cfg,order,you,pos,ok,gainM,gainF);
}
function showCareerRaceResult(node,cfg,order,you,pos,ok,gainM,gainF){
  const C=G.career, c0=careerCostOf(node);
  const pass=(typeof careerPerk==="function")&&careerPerk("retryHalf");
  const c={ f: pass?Math.max(1,Math.ceil(c0.f/2)):c0.f, m: pass?0:c0.m };
  const canRetry=C.fuel>=c.f&&C.money>=c.m;
  const rows=order.map((p,i)=>`
    <div class="standrow"><div class="p">P${i+1}</div>
      <div class="dot" style="background:${p.color}"></div>
      <div>${p.isBot?p.name:"No. 17 — You"}${(cfg.cond==="rival"&&p.isBot&&p.botIndex===cfg.rivalIdx)?" 🎯":""}</div>
      <div style="margin-left:auto;color:var(--cream-dim);font-size:12px">${p.dq?"DQ":p.finishRound?("R"+p.finishRound):"DNF"}</div>
    </div>`).join("");
  const el=$("#setup"); el.style.display="flex"; el.onclick=null; el.scrollTop=0;
  const isBoss=node.type==="boss";
  el.innerHTML=`<div class="sheet">
    <h2>${ok?(isBoss?"🏆 GRAND FINAL — WON!":"🎯 Goal met!"):"Goal missed"}</h2>
    <div class="tag">${esc(TRACK.name)} · 🎯 ${condName(cfg)} · you finished P${pos}${you.dq?" (DQ)":""}</div>
    ${ok?"":`<div class="cfailhero">💨</div>`}
    <div class="cgoal" style="text-align:center">${ok?`Stop claimed — +$${gainM}${gainF?` & +${gainF} ⛽`:""}`:`Half purse only — +$${gainM}. The stop stays open.`}</div>
    ${rows}
    <div class="cstatbar" style="margin-top:10px"><span class="cstat">⛽ <b>${C.fuel}</b></span><span class="cstat">💰 <b>$${C.money}</b></span></div>
    <div class="btnrow" style="margin-top:14px">
      ${replayBtnHTML()}
      ${ok
        ? `<button class="act" id="crGo">${isBoss?"Take the title ▸":((cfg.bonus.upg||cfg.bonus.mod)?"Collect your prize ▸":"Back to the map ▸")}</button>`
        : `<button class="act" id="crRetry" ${canRetry?"":"disabled style='opacity:.45'"}>↻ Re-enter — ⛽${c.f}${c.m?` + $${c.m}`:""}</button>
           <button class="act secondary" id="crMap">Back to the map</button>`}
    </div>
    ${!ok&&!canRetry?`<div class="phase-hint" style="margin-top:8px;min-height:0">You can't cover re-entry right now — head back to the map and find money or fuel first.</div>`:""}
  </div>`;
  wireReplayBtn();
  if(ok){
    $("#crGo").onclick=()=>{
      if(isBoss){ showCareerVictory(false); return; }
      if(cfg.bonus.mod){ showCareerModPick(cfg.seed+99,"🔥 Showdown prize — pick a Mod",()=>showCareerMap()); return; }
      if(cfg.bonus.upg){ showCareerUpgradePick(cfg.seed+99,"🔥 Showdown prize — pick an Upgrade",()=>showCareerMap()); return; }
      showCareerMap();
    };
  } else {
    const rb=$("#crRetry");
    if(rb&&!rb.disabled) rb.onclick=()=>{
      C.fuel-=c.f; C.money-=c.m; saveCareer();
      showRaceLoading(trackName(cfg.track), `Career · re-entry paid · 🎯 ${condName(cfg)}`, ()=>startCareerRace(node,cfg));
    };
    $("#crMap").onclick=()=>showCareerMap();
  }
}
function showCareerVictory(journeyOnly){
  const C=G.career, el=$("#setup"); el.style.display="flex"; el.onclick=null; el.scrollTop=0;
  el.innerHTML=`<div class="sheet" style="text-align:center">
    <h2>${journeyOnly?"🏁 End of the road":"🏆 CHAMPION!"}</h2>
    <div class="tag">${journeyOnly?`You drove ${esc(C.mapName)} end to end.`:`You took the Grand Final — ${esc(C.mapName)} is yours.`}</div>
    <div class="cfailhero" style="font-size:56px">${journeyOnly?"🚗💨":"🏆"}</div>
    <div class="optgroup" style="text-align:left"><div class="olbl">The season</div>
      ${summaryRow("Stops made", String(C.done.length))}
      ${summaryRow("Race goals hit", `${C.wins} of ${C.races}`)}
      ${summaryRow("Final wallet", `⛽ ${C.fuel} · $${C.money}`)}
      ${summaryRow("Car", `${classByKey(C.cls).name} — ${C.upgrades.length} Upgrade${C.upgrades.length===1?"":"s"} fitted`)}
      ${summaryRow("Mods", (C.mods||[]).length ? (C.mods||[]).map(id=>(modById(id)||{}).icon||"").join(" ") : "none")}
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
    <h2>⛽ Out of gas</h2>
    <div class="tag">${esc(C.mapName)} · ${C.done.length} stops in — the tank's dry and the wallet's empty.</div>
    <div class="cfailhero" style="font-size:56px">🚗…</div>
    <div class="optgroup" style="text-align:left"><div class="olbl">How it ended</div>
      ${summaryRow("Stops made", String(C.done.length))}
      ${summaryRow("Race goals hit", `${C.wins} of ${C.races}`)}
      ${summaryRow("Car", `${classByKey(C.cls).name} — ${C.upgrades.length} Upgrade${C.upgrades.length===1?"":"s"}`)}
    </div>
    <div class="btnrow" style="margin-top:16px;justify-content:center">
      <button class="act" id="cgNew">New career</button>
      <button class="act secondary" id="cgMenu">Main menu</button>
    </div></div>`;
  clearCareerSave(); G.career=null;
  $("#cgNew").onclick=()=>showCareerSelect();
  $("#cgMenu").onclick=()=>{ el.style.display="none"; showModeSelect(); };
}
