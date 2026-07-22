/* =====================================================================
   BOARD TERRAIN PACK — 16 extra painted-board themes for game_4_2.js
   ---------------------------------------------------------------------
   Destination flavours : tuscany · street · riviera · medieval · miami
                          ruins · japan · spain · jungle
   Expansion pack       : forest · coast · holland · vineyard · mexico
                          aotearoa · nyc

   Load AFTER game_4_2.js:
       <script src="game_4_2.js"></script>
       <script src="board-terrains.js"></script>

   The file registers itself three ways:
     1. merges palettes into the script-global TERRAIN_THEMES
     2. exposes window.BOARD_SCENERY  — the scenery painters, keyed by
        theme.scenery, each called with a context object of the drawing
        helpers that live inside drawArtBoard()
     3. exposes window.BOARD_TINTS    — mini-map tints for the track picker

   Painter contract:  fn(ctx)  where ctx = {
     g, defs, el, W, H, rnd, TH,
     scatter(count,minClear,fn,opts), poi(), clearAll(x,y), okBox(x,y,pad),
     inPoly(x,y), propShadow(x,y,rx,ry,op), oak(), pine(), rock(), P, S }
   Everything is drawn UNDER the road ribbon, so keep props off the tarmac
   with clearAll()/scatter's minClear — exactly as the core themes do.
   ===================================================================== */
(function(){
"use strict";

/* ------------------------------------------------------------------ *
 *  1. PALETTES                                                        *
 * ------------------------------------------------------------------ */
const THEMES = {

  /* ---------- Destination flavours ---------- */
  tuscany:{  base:"#c8a24f", mottle:["#b8913f","#d6b264","#a8823a","#e0c37e","#96702f"],
             verge:"#e7d7ab", tarmac:"#2a2422", tarmacHi:"#3e372f", edge:"#f4ead2",
             center:"#dfd0a6", sep:"rgba(58,44,20,.4)", kerbA:"#c8402e", kerbB:"#f7efdc",
             grainDark:.12, grainLight:.06, scenery:"tuscany" },

  street:{   base:"#2b2d36", mottle:["#24262e","#33353f","#1e2027","#3c3e49","#191b21"],
             verge:"#3c3f49", tarmac:"#15161b", tarmacHi:"#282a33", edge:"#f0f2f6",
             center:"#e8c84a", sep:"rgba(220,230,245,.35)", kerbA:"#c8402e", kerbB:"#eef0f4",
             grainDark:.16, grainLight:.04, scenery:"street" },

  riviera:{  base:"#7fb6a8", mottle:["#6fa89b","#93c6b8","#5f978c","#a8d6c8","#4f867c"],
             verge:"#efe0c0", tarmac:"#272229", tarmacHi:"#3b3441", edge:"#f8efdc",
             center:"#ded2b4", sep:"rgba(250,244,230,.5)", kerbA:"#c8402e", kerbB:"#f8f0dc",
             grainDark:.10, grainLight:.07, scenery:"riviera" },

  medieval:{ base:"#6f7a45", mottle:["#5e6a3a","#7c8850","#8a9459","#525d33","#909a63"],
             verge:"#ddd0ae", tarmac:"#282329", tarmacHi:"#3b3541", edge:"#eee5d0",
             center:"#d0c7b2", sep:"rgba(240,235,220,.5)", kerbA:"#c8402e", kerbB:"#f2ead8",
             grainDark:.12, grainLight:.05, scenery:"medieval" },

  miami:{    base:"#5fc7c2", mottle:["#4fb8b6","#79d6cf","#3fa6a6","#93e2d9","#2f9494"],
             verge:"#f6ecd0", tarmac:"#232028", tarmacHi:"#38333f", edge:"#fdf6e6",
             center:"#ffd9e8", sep:"rgba(255,250,240,.5)", kerbA:"#e8477f", kerbB:"#fdf6e6",
             grainDark:.08, grainLight:.07, scenery:"miami" },

  ruins:{    base:"#b3a260", mottle:["#a49353","#c2b174","#96843f","#d0c189","#8a7a3a"],
             verge:"#e6dcb8", tarmac:"#2a2622", tarmacHi:"#3d372f", edge:"#f2ead2",
             center:"#dbd0a8", sep:"rgba(56,44,22,.4)", kerbA:"#c8402e", kerbB:"#f6eeda",
             grainDark:.13, grainLight:.06, scenery:"ruins" },

  japan:{    base:"#7f9a63", mottle:["#6d8955","#8ea872","#5f7a4a","#9db681","#547040"],
             verge:"#eee0dc", tarmac:"#26222a", tarmacHi:"#393341", edge:"#f7ece8",
             center:"#e8cdd6", sep:"rgba(250,240,240,.5)", kerbA:"#c8402e", kerbB:"#f7efe6",
             grainDark:.10, grainLight:.06, scenery:"japan" },

  spain:{    base:"#c19a52", mottle:["#b28a45","#cfa966","#a37c39","#dcbb7c","#916c30"],
             verge:"#ecdcb0", tarmac:"#2a2521", tarmacHi:"#3e372e", edge:"#f7eed6",
             center:"#ded0a4", sep:"rgba(58,44,20,.4)", kerbA:"#c8402e", kerbB:"#f7efdc",
             grainDark:.12, grainLight:.06, scenery:"spain" },

  jungle:{   base:"#2f5a34", mottle:["#26502c","#3a6b3d","#1f4527","#458049","#16371f"],
             verge:"#d8d2ad", tarmac:"#221f26", tarmacHi:"#34303c", edge:"#ece3cb",
             center:"#cfc6ac", sep:"rgba(240,235,215,.5)", kerbA:"#c8402e", kerbB:"#f0e8d2",
             grainDark:.15, grainLight:.05, scenery:"jungle" },

  /* ---------- Expansion pack ---------- */
  forest:{   base:"#37502f", mottle:["#2e4527","#405c36","#283c22","#4a6a3e","#22341e"],
             verge:"#ded4b6", tarmac:"#232028", tarmacHi:"#363040", edge:"#eee5cf",
             center:"#cfc7b0", sep:"rgba(240,235,220,.5)", kerbA:"#c8402e", kerbB:"#f2ead8",
             grainDark:.14, grainLight:.05, scenery:"forest" },

  coast:{    base:"#d8cb92", mottle:["#cbbd82","#e4d8a4","#bdae72","#eee3b6","#ad9d63"],
             verge:"#f0e6c2", tarmac:"#27242b", tarmacHi:"#3a3541", edge:"#f7f0da",
             center:"#ded3ae", sep:"rgba(50,44,26,.4)", kerbA:"#c8402e", kerbB:"#f7f0dc",
             grainDark:.11, grainLight:.08, scenery:"coast" },

  holland:{  base:"#6f9142", mottle:["#5e8038","#7ea24e","#527433","#8db159","#476a2c"],
             verge:"#e6e0c0", tarmac:"#26222a", tarmacHi:"#393340", edge:"#f0ead4",
             center:"#d3ccb2", sep:"rgba(240,238,220,.5)", kerbA:"#c8402e", kerbB:"#f2ecd8",
             grainDark:.09, grainLight:.06, scenery:"holland" },

  vineyard:{ base:"#8a9a4e", mottle:["#788843","#99a95c","#697a38","#a8b76a","#5d6c30"],
             verge:"#e9ddb4", tarmac:"#27222a", tarmacHi:"#3a3440", edge:"#f2e9d2",
             center:"#d8cdaa", sep:"rgba(60,50,24,.42)", kerbA:"#c8402e", kerbB:"#f5edd8",
             grainDark:.11, grainLight:.06, scenery:"vineyard" },

  mexico:{   base:"#c08a55", mottle:["#b17b49","#cf9c68","#a06c3c","#dcae7e","#8f5d33"],
             verge:"#ecd8b0", tarmac:"#2b2422", tarmacHi:"#3f362f", edge:"#f6ecd2",
             center:"#dfcda4", sep:"rgba(60,40,22,.42)", kerbA:"#c8402e", kerbB:"#f7efdc",
             grainDark:.13, grainLight:.07, scenery:"mexico" },

  aotearoa:{ base:"#4f8b3f", mottle:["#437a35","#5d9c4a","#3a6b2e","#6cae57","#2f5c26"],
             verge:"#e4dcbc", tarmac:"#25212a", tarmacHi:"#383241", edge:"#efe7d2",
             center:"#d1c9b2", sep:"rgba(240,236,220,.5)", kerbA:"#c8402e", kerbB:"#f2ead8",
             grainDark:.10, grainLight:.06, scenery:"aotearoa" },

  nyc:{      base:"#6c737c", mottle:["#626971","#7a8189","#585f67","#868d95","#4e555d"],
             verge:"#b9bcc2", tarmac:"#1e1f25", tarmacHi:"#32333b", edge:"#eef0f3",
             center:"#e3c93c", sep:"rgba(250,250,255,.45)", kerbA:"#c8402e", kerbB:"#f4f4f0",
             grainDark:.12, grainLight:.05, scenery:"nyc" }
};

/* ------------------------------------------------------------------ *
 *  2. MINI-MAP TINTS (track picker thumbnails)                        *
 * ------------------------------------------------------------------ */
const TINTS = {
  tuscany: {bg:"#5a4a1e", glow:"#e6c368"},
  street:  {bg:"#16171d", glow:"#f0d34a"},
  riviera: {bg:"#1d4a4a", glow:"#6fd6c0"},
  medieval:{bg:"#333a20", glow:"#c9b06a"},
  miami:   {bg:"#12494f", glow:"#ff7fbf"},
  ruins:   {bg:"#4c4523", glow:"#d8c98a"},
  japan:   {bg:"#2c3a22", glow:"#f2a8c0"},
  spain:   {bg:"#54401d", glow:"#e8bd66"},
  jungle:  {bg:"#12301a", glow:"#5fd07a"},
  forest:  {bg:"#182617", glow:"#6fae72"},
  coast:   {bg:"#4a4626", glow:"#8fd0e8"},
  holland: {bg:"#2a3d1c", glow:"#f06a9a"},
  vineyard:{bg:"#3a4220", glow:"#c08ad0"},
  mexico:  {bg:"#523318", glow:"#f0a05a"},
  aotearoa:{bg:"#1f3a1b", glow:"#7fe07a"},
  nyc:     {bg:"#262a31", glow:"#9fb6d0"}
};

/* ------------------------------------------------------------------ *
 *  3. SHARED PROP PAINTERS                                            *
 *     Built on the ctx handed in by drawArtBoard so every prop lands   *
 *     in the same layer, with the same soft shadow language.           *
 * ------------------------------------------------------------------ */
function props(ctx){
  const {g,el,rnd,propShadow}=ctx;
  const add=(n,at)=>{ const e=el(n,at); g.appendChild(e); return e; };
  const P={

    /* tall dark spire — cypress, poplar, lombardy */
    cypress(x,y,h,c1,c2){
      propShadow(x+h*.18,y+3,h*.20,h*.07,.2);
      add("path",{d:`M ${x} ${y-h} q ${h*.20} ${h*.42} ${h*.11} ${h*.68}
                     q ${-h*.11} ${h*.16} ${-h*.22} 0
                     q ${-h*.09} ${-h*.26} ${h*.11} ${-h*.68} Z`,fill:c1});
      add("path",{d:`M ${x-h*.03} ${y-h*.92} q ${-h*.11} ${h*.44} ${-h*.05} ${h*.60}
                     q ${h*.05} ${h*.06} ${h*.07} 0 q ${-h*.05} ${-h*.24} ${h*.03} ${-h*.60} Z`,
                   fill:c2,opacity:.75});
    },

    /* silver-grey mediterranean round tree — olive, oak-scrub */
    olive(x,y,r,c1,c2){
      propShadow(x+2,y+r*.5,r*1.1,r*.42,.18);
      add("line",{x1:x,y1:y+r*.7,x2:x,y2:y,stroke:"#6b5a3c","stroke-width":Math.max(1.4,r*.22)});
      add("circle",{cx:x,cy:y-r*.25,r:r,fill:c1});
      add("circle",{cx:x-r*.34,cy:y-r*.5,r:r*.55,fill:c2,opacity:.9});
      add("circle",{cx:x+r*.38,cy:y-r*.1,r:r*.42,fill:c2,opacity:.55});
    },

    /* fan palm — riviera, miami, jungle */
    palm(x,y,h,trunk,frondA,frondB){
      propShadow(x+h*.22,y+3,h*.34,h*.10,.2);
      add("path",{d:`M ${x} ${y+2} q ${h*.10} ${-h*.5} ${h*.04} ${-h}`,
                  fill:"none",stroke:trunk,"stroke-width":Math.max(2,h*.09),"stroke-linecap":"round"});
      const tx=x+h*.04, ty=y-h;
      for(let i=0;i<7;i++){
        const a=(-Math.PI*0.96)+i*(Math.PI*0.92/6), L=h*(.42+ (i%2?.10:0));
        add("path",{d:`M ${tx} ${ty} q ${Math.cos(a)*L*.55} ${Math.sin(a)*L*.55-h*.10}
                       ${Math.cos(a)*L} ${Math.sin(a)*L+h*.06}`,
                    fill:"none",stroke:i%2?frondA:frondB,"stroke-width":Math.max(2,h*.10),
                    "stroke-linecap":"round",opacity:.95});
      }
      add("circle",{cx:tx,cy:ty,r:Math.max(1.6,h*.06),fill:frondB});
    },

    /* generic pitched-roof building; ang tilts the whole thing a touch */
    house(x,y,w,h,wall,roof,roofDark,opts){
      opts=opts||{};
      const rh=opts.roofH||h*.72, ang=opts.ang||0;
      const gg=el("g",{transform:`rotate(${ang.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`});
      const put=(n,at)=>gg.appendChild(el(n,at));
      put("ellipse",{cx:x+w*.18,cy:y+h*.55,rx:w*.62,ry:h*.24,fill:"#000",opacity:.22});
      put("rect",{x:x-w/2,y:y-h/2,width:w,height:h,fill:wall});
      put("rect",{x:x-w/2,y:y-h/2,width:w*.34,height:h,fill:"#fff",opacity:.13});
      put("path",{d:`M ${x-w/2-w*.10} ${y-h/2} L ${x} ${y-h/2-rh} L ${x+w/2+w*.10} ${y-h/2} Z`,fill:roof});
      put("path",{d:`M ${x} ${y-h/2-rh} L ${x+w/2+w*.10} ${y-h/2} L ${x+w*.16} ${y-h/2} Z`,
                  fill:roofDark,opacity:.85});
      if(opts.win!==false){
        const n=Math.max(1,Math.round(w/13));
        for(let i=0;i<n;i++)
          put("rect",{x:x-w/2+w*(i+0.5)/n-w*.09,y:y-h*.18,width:w*.18,height:h*.34,
                      fill:opts.lit?"#f7d98a":"#4a4652",opacity:opts.lit?.95:.8});
      }
      g.appendChild(gg);
      return gg;
    },

    /* flat-roofed slab — deco / adobe / tower blocks */
    slab(x,y,w,h,body,shade,opts){
      opts=opts||{};
      add("rect",{x:x-w/2+4,y:y-h/2+6,width:w,height:h,rx:opts.rx||3,fill:"#000",opacity:.26});
      add("rect",{x:x-w/2,y:y-h/2,width:w,height:h,rx:opts.rx||3,fill:body});
      add("rect",{x:x+w*.14,y:y-h/2,width:w*.36,height:h,fill:shade,opacity:.6});
      if(opts.band) add("rect",{x:x-w/2,y:y-h/2+h*.16,width:w,height:Math.max(2,h*.07),fill:opts.band,opacity:.9});
      if(opts.win){
        const cols=Math.max(2,Math.round(w/11)), rows=Math.max(2,Math.round(h/13));
        for(let cx=0;cx<cols;cx++) for(let ry=0;ry<rows;ry++){
          if(rnd()<(opts.litRate===undefined?0:1-opts.litRate)) continue;
          add("rect",{x:x-w/2+w*(cx+.28)/cols,y:y-h/2+h*(ry+.28)/rows,
                      width:w*.44/cols,height:h*.42/rows,
                      fill:opts.lit&&rnd()<(opts.litRate||0)?opts.lit:"#3c4049",opacity:.9});
        }
      }
    },

    /* fence / vine / post run between two points */
    postRun(x,y,ang,len,step,fn){
      for(let t=0;t<len;t+=step) fn(x+Math.cos(ang)*t, y+Math.sin(ang)*t, t/len);
    },

    /* water body with a lighter shoal band */
    water(x,y,rx,ry,deep,shallow,op){
      propShadow(x,y,rx,ry,.10);
      add("ellipse",{cx:x,cy:y,rx,ry,fill:deep,opacity:op===undefined?1:op});
      add("ellipse",{cx:x-rx*.18,cy:y-ry*.20,rx:rx*.62,ry:ry*.52,fill:shallow,opacity:.75});
    },

    /* how much clear board there is between an edge and the racing surface —
       water bands use this so the sea never washes across the tarmac */
    room(edge){
      const P=ctx.P||[], W=ctx.W, H=ctx.H;
      let m=1e9;
      for(const p of P){
        const d = edge==="top"    ? p[1]
                : edge==="bottom" ? H-p[1]
                : edge==="left"   ? p[0]
                :                   W-p[0];
        if(d<m) m=d;
      }
      return Math.max(0, m-30);           // 30 ≈ half the road ribbon + verge
    },

    /* horizontal sea band across one edge, with surf lines */
    seaBand(edge,depth,deep,mid,foam,W,H){
      const horiz = edge==="top"||edge==="bottom";
      const rect = edge==="top"    ? {x:0,y:0,w:W,h:depth}
                 : edge==="bottom" ? {x:0,y:H-depth,w:W,h:depth}
                 : edge==="left"   ? {x:0,y:0,w:depth,h:H}
                 :                   {x:W-depth,y:0,w:depth,h:H};
      add("rect",{x:rect.x,y:rect.y,width:rect.w,height:rect.h,fill:deep});
      for(let i=0;i<9;i++){
        const f=i/9;
        if(horiz) add("rect",{x:rect.x,y:rect.y+(edge==="top"?rect.h*f:rect.h*(1-f)-rect.h*.11),
                              width:rect.w,height:rect.h*.11,fill:mid,opacity:.12+f*.10});
        else      add("rect",{x:rect.x+(edge==="left"?rect.w*f:rect.w*(1-f)-rect.w*.11),y:rect.y,
                              width:rect.w*.11,height:rect.h,fill:mid,opacity:.12+f*.10});
      }
      for(let i=0;i<26;i++){
        const t=rnd();
        const px = horiz ? 20+rnd()*(W-40) : rect.x+rnd()*rect.w;
        const py = horiz ? rect.y+rnd()*rect.h : 20+rnd()*(H-40);
        add("path",{d:`M ${px-9} ${py} q 9 -3 18 0`,fill:"none",stroke:foam,
                    "stroke-width":1.6,opacity:.35+t*.4,"stroke-linecap":"round"});
      }
    }
  };
  return P;
}

/* ------------------------------------------------------------------ *
 *  4. SCENERY PAINTERS                                                *
 * ------------------------------------------------------------------ */
const SCENERY = {};
window.BOARD_SCENERY = SCENERY;
window.BOARD_TINTS   = TINTS;

/* merge palettes into the game's table if it is in scope */
try{
  if(typeof TERRAIN_THEMES!=="undefined") Object.assign(TERRAIN_THEMES,THEMES);
}catch(e){}
window.BOARD_THEMES = THEMES;

/* ============================ TUSCANY ============================= */
SCENERY.tuscany = function(ctx){
  const {g,el,W,H,rnd,scatter,poi,clearAll,okBox,propShadow}=ctx, X=props(ctx);
  const add=(n,at)=>g.appendChild(el(n,at));
  // sun-baked contour hills: broad tilted bands of wheat and ploughed earth
  const bands=["#d9b45f","#c69c45","#e3c67c","#b98d3c","#eed08d"];
  for(let i=0;i<9;i++){
    const y=-40+ (H+80)*(i/8), amp=26+rnd()*30;
    add("path",{d:`M -30 ${y} q ${W*.28} ${-amp} ${W*.52} ${amp*.3}
                   q ${W*.3} ${amp} ${W*.6} ${-amp*.5} L ${W+30} ${H+60} L -30 ${H+60} Z`,
                fill:bands[i%5],opacity:.34});
  }
  // ploughed strips following the contours
  for(let i=0;i<11;i++){
    const x=40+rnd()*(W-80), y=40+rnd()*(H-80);
    if(clearAll(x,y)<64||!okBox(x,y,14)) continue;
    const w=90+rnd()*150, h=46+rnd()*70, a=(rnd()*16-8);
    const t=`rotate(${a.toFixed(1)} ${x} ${y})`;
    add("ellipse",{cx:x,cy:y,rx:w/2,ry:h/2,fill:i%2?"#a8763a":"#cfa953",opacity:.5,transform:t});
    for(let k=-4;k<=4;k++)
      add("path",{d:`M ${x-w/2} ${y+k*(h/10)} q ${w/2} ${-6} ${w} 0`,fill:"none",
                  stroke:i%2?"rgba(60,38,14,.35)":"rgba(255,246,214,.30)","stroke-width":1.6,transform:t});
  }
  // strada bianca wandering out of frame
  const c=poi();
  add("path",{d:`M ${c.x-c.d} ${c.y+c.d*.4} q 90 -60 190 -30 q 130 40 ${W} -40`,
              fill:"none",stroke:"#efe2b8","stroke-width":8,opacity:.55,"stroke-linecap":"round"});
  // hilltop villa: long body, square tower, cypress guard of honour
  if(c.d>66&&okBox(c.x,c.y,26)){
    const vx=c.x, vy=c.y-6;
    X.house(vx,vy,52,24,"#e7d3a6","#b4643a","#8e4a2a",{roofH:13});
    X.house(vx+30,vy-9,20,40,"#efdcb0","#b4643a","#8e4a2a",{roofH:9,win:false});
    add("rect",{x:vx+22,y:vy-30,width:16,height:7,fill:"#efdcb0"});
    for(let i=0;i<5;i++)
      X.cypress(vx-52-i*17, vy+16+i*9, 30+rnd()*10, "#2e4326","#415c33");
  }
  // olive groves in rows + lone cypress clumps
  scatter(9,58,(x,y)=>{
    const a=rnd()*Math.PI;
    for(let r=0;r<3;r++) X.postRun(x+Math.cos(a+1.57)*r*13, y+Math.sin(a+1.57)*r*13, a, 46, 15,
      (px,py)=>{ if(clearAll(px,py)>50) X.olive(px,py,5+rnd()*2.5,"#7f8f5c","#9fae78"); });
  },{pad:10});
  scatter(10,56,(x,y)=> X.cypress(x,y,22+rnd()*16,"#2e4326","#415c33"));
  // sunflower patches
  scatter(4,58,(x,y)=>{ for(let i=0;i<14;i++)
    add("circle",{cx:x+rnd()*40-20,cy:y+rnd()*26-13,r:2.4,fill:"#e8b52c",opacity:.9}); });
};

/* ============================= STREET ============================= */
SCENERY.street = function(ctx){
  const {g,el,defs,W,H,rnd,scatter,clearAll,okBox,propShadow}=ctx, X=props(ctx);
  const add=(n,at)=>g.appendChild(el(n,at));
  // night sky wash over the whole plate
  add("rect",{x:0,y:0,width:W,height:H,fill:"#171922",opacity:.45});
  // downtown blocks: tight grid of lit towers well clear of the circuit
  const cw=112, ch=88, pal=["#2f323c","#383c47","#282b34","#41454f","#23262e"];
  const lit=["#f7d98a","#ffe9b0","#bfe4ff","#f6b45a"];
  const built=new Set();
  for(let gx=20;gx+cw<W-16;gx+=cw) for(let gy=20;gy+ch<H-16;gy+=ch){
    const cx=gx+cw/2, cy=gy+ch/2;
    if(clearAll(cx,cy)<74||!okBox(cx,cy,24)) continue;
    built.add(gx+","+gy);
    const m=9+rnd()*7, w=cw-2*m, h=ch-2*m;
    if(rnd()<.14){ // floodlit forecourt
      add("rect",{x:cx-w/2,y:cy-h/2,width:w,height:h,rx:5,fill:"#2b2f38"});
      add("ellipse",{cx:cx,cy:cy,rx:w*.34,ry:h*.30,fill:"#f4d98d",opacity:.14});
      for(let i=0;i<3;i++) add("circle",{cx:cx-w*.3+i*w*.3,cy:cy-h*.34,r:2.2,fill:"#ffe9b0"});
    } else {
      X.slab(cx,cy,w,h,pal[(rnd()*pal.length)|0],"#1b1e25",
        {rx:3,win:true,lit:lit[(rnd()*lit.length)|0],litRate:.34+rnd()*.3});
      add("rect",{x:cx-w/2,y:cy-h/2,width:w,height:h,rx:3,fill:"none",stroke:"#4c515c","stroke-width":1.4});
      if(rnd()>.55) // rooftop sign
        add("rect",{x:cx-w*.22,y:cy-h/2-6,width:w*.44,height:5,rx:2,
                    fill:rnd()>.5?"#e8477f":"#4fd6e0",opacity:.9});
    }
  }
  // side streets between built blocks, with centre dashes
  for(const key of built){
    const [gx,gy]=key.split(",").map(Number);
    if(built.has((gx+cw)+","+gy)&&clearAll(gx+cw,gy+ch/2)>60)
      add("line",{x1:gx+cw,y1:gy+12,x2:gx+cw,y2:gy+ch-12,stroke:"#c9ced8","stroke-width":1.8,
                  "stroke-dasharray":"7 10",opacity:.45});
    if(built.has(gx+","+(gy+ch))&&clearAll(gx+cw/2,gy+ch)>60)
      add("line",{x1:gx+12,y1:gy+ch,x2:gx+cw-12,y2:gy+ch,stroke:"#c9ced8","stroke-width":1.8,
                  "stroke-dasharray":"7 10",opacity:.45});
  }
  // armco / concrete wall segments hugging the outside of the circuit
  scatter(26,34,(x,y)=>{
    const a=rnd()*Math.PI;
    add("rect",{x:x-13,y:y-3,width:26,height:6,rx:2,fill:"#d7d9dd",
                transform:`rotate(${(a*180/Math.PI).toFixed(1)} ${x} ${y})`});
    add("rect",{x:x-13,y:y-3,width:26,height:2.4,rx:1,fill:"#e8477f",opacity:.75,
                transform:`rotate(${(a*180/Math.PI).toFixed(1)} ${x} ${y})`});
  },{pad:2});
  // street lamps throwing warm pools onto the verge
  scatter(30,32,(x,y)=>{
    add("ellipse",{cx:x,cy:y+7,rx:17,ry:11,fill:"#f7d98a",opacity:.16});
    add("line",{x1:x,y1:y+7,x2:x,y2:y-13,stroke:"#8f949e","stroke-width":1.8});
    add("path",{d:`M ${x} ${y-13} q 0 -4 6 -4`,fill:"none",stroke:"#8f949e","stroke-width":1.8});
    add("circle",{cx:x+6.5,cy:y-17,r:2.4,fill:"#ffe9b0"});
  },{pad:2});
};

/* ============================ RIVIERA ============================= */
SCENERY.riviera = function(ctx){
  const {g,el,W,H,rnd,scatter,poi,clearAll,okBox,propShadow}=ctx, X=props(ctx);
  const add=(n,at)=>g.appendChild(el(n,at));
  // the Med along the bottom edge, harbour wall, yachts at anchor
  const dep=Math.min(Math.max(56,X.room("bottom")+12), Math.max(90,H*.20));
  X.seaBand("bottom",dep,"#1f6f8c","#3fa0b8","#eaf6fa",W,H);
  const sy=H-dep;
  add("path",{d:`M 0 ${sy} q ${W*.25} -14 ${W*.5} 4 q ${W*.25} 16 ${W*.5} -6`,
              fill:"none",stroke:"#e6dcb8","stroke-width":9,opacity:.85});
  add("rect",{x:W*.52,y:sy+16,width:W*.30,height:7,rx:3,fill:"#cfc3a0"});  // mole
  for(let i=0;i<9;i++){ // moored yachts
    const x=W*.55+i*(W*.28/9)+rnd()*10, y=sy+34+rnd()*30;
    add("ellipse",{cx:x,cy:y,rx:11,ry:3.4,fill:"#f4f2ea"});
    add("path",{d:`M ${x-1} ${y-2} l 0 -15 l 8 13 Z`,fill:"#ffffff",opacity:.92});
    add("ellipse",{cx:x+2,cy:y+4,rx:12,ry:3,fill:"#0e4c63",opacity:.35});
  }
  // terraced resort: pastel villas stepping up the hillside
  const c=poi();
  const rows=4;
  for(let r=0;r<rows;r++){
    const yy=c.y-r*26-10;
    for(let i=0;i<5;i++){
      const xx=c.x-96+i*44+(r%2?18:0)+rnd()*8;
      if(clearAll(xx,yy)<52||!okBox(xx,yy,12)) continue;
      X.house(xx,yy,34+rnd()*10,20,["#f2e2c4","#efd6b0","#f6ead2","#e8cfa8"][(rnd()*4)|0],
              "#c86a45","#a04f34",{roofH:10,ang:rnd()*3-1.5});
    }
  }
  // grand hotel with an arcade, on the roomiest shoulder
  if(c.d>70){
    const hx=c.x+c.d*.7, hy=c.y+8;
    if(clearAll(hx,hy)>60&&okBox(hx,hy,16)){
      X.slab(hx,hy,74,34,"#f7ecd4","#dcc9a4",{rx:3});
      for(let i=0;i<6;i++) add("path",{d:`M ${hx-31+i*12} ${hy+17} v -9 q 5 -6 10 0 v 9 Z`,
        fill:"#c9b48c",opacity:.85});
      add("rect",{x:hx-37,y:hy-19,width:74,height:5,rx:2,fill:"#c86a45"});
    }
  }
  // palms along the promenade + parasols on the beach
  scatter(18,50,(x,y)=> X.palm(x,y,20+rnd()*12,"#8a6a44","#2f7a4a","#3f9a5c"));
  for(let i=0;i<16;i++){
    const x=24+rnd()*(W-48), y=sy-10-rnd()*16;
    if(clearAll(x,y)<44) continue;
    propShadow(x,y+2,7,3,.18);
    add("path",{d:`M ${x-9} ${y} q 9 -10 18 0 Z`,fill:i%2?"#e8477f":"#f2c14e"});
    add("line",{x1:x,y1:y,x2:x,y2:y+7,stroke:"#8f8676","stroke-width":1.4});
  }
  scatter(7,52,(x,y)=> X.olive(x,y,6+rnd()*3,"#5f7a4a","#7d9862"));
};

/* =========================== MEDIEVAL ============================= */
SCENERY.medieval = function(ctx){
  const {g,el,W,H,rnd,scatter,poi,clearAll,okBox,propShadow,oak}=ctx, X=props(ctx);
  const add=(n,at)=>g.appendChild(el(n,at));
  const c=poi();
  // castle mound
  add("ellipse",{cx:c.x,cy:c.y+14,rx:Math.min(190,c.d*1.5),ry:Math.min(96,c.d*.9),
                 fill:"#7b8450",opacity:.6});
  // curtain wall with towers, drawn as an arc of merlons
  const R=Math.min(130,Math.max(70,c.d*.95));
  const wallPts=[];
  for(let i=0;i<=22;i++){ const a=Math.PI*(0.08+ i/22*0.84);
    wallPts.push([c.x-Math.cos(a)*R*1.15, c.y+18+Math.sin(a)*R*.42]); }
  add("path",{d:"M "+wallPts.map(p=>p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" L "),
              fill:"none",stroke:"#8b8272","stroke-width":13,"stroke-linejoin":"round"});
  add("path",{d:"M "+wallPts.map(p=>p[0].toFixed(1)+" "+(p[1]-4).toFixed(1)).join(" L "),
              fill:"none",stroke:"#a49a88","stroke-width":5,"stroke-linejoin":"round"});
  for(let i=0;i<wallPts.length;i+=2)
    add("rect",{x:wallPts[i][0]-2.4,y:wallPts[i][1]-11,width:4.8,height:5,fill:"#a49a88"});
  // the keep + flanking towers
  const tower=(x,y,w,h,roof)=>{
    propShadow(x+3,y+h*.5,w*.7,w*.3,.24);
    add("rect",{x:x-w/2,y:y-h,width:w,height:h,fill:"#9a917f"});
    add("rect",{x:x-w/2,y:y-h,width:w*.36,height:h,fill:"#fff",opacity:.12});
    for(let i=0;i<3;i++) add("rect",{x:x-w/2+i*(w/3)+1,y:y-h-4,width:w/3-2,height:5,fill:"#9a917f"});
    add("path",{d:`M ${x-w*.62} ${y-h-4} L ${x} ${y-h-4-roof} L ${x+w*.62} ${y-h-4} Z`,fill:"#4a5a72"});
    add("rect",{x:x-1,y:y-h*.55,width:3,height:9,fill:"#3a3730"});
  };
  tower(c.x,c.y-8,30,52,20);
  tower(c.x-40,c.y+4,17,32,12);
  tower(c.x+42,c.y+2,17,34,12);
  add("path",{d:`M ${c.x+15} ${c.y-78} l 22 6 l -22 6 Z`,fill:"#a8362a"});
  add("line",{x1:c.x+15,y1:c.y-60,x2:c.x+15,y2:c.y-80,stroke:"#3a3730","stroke-width":1.6});
  // half-timbered town spilling downhill
  scatter(16,54,(x,y)=>{
    const w=22+rnd()*12, h=13+rnd()*6;
    X.house(x,y,w,h,"#efe4cd","#8a5a3c","#6d452c",{roofH:h*.8,ang:rnd()*4-2,win:false});
    for(let i=0;i<3;i++) add("line",{x1:x-w/2+3+i*(w/3),y1:y-h/2,x2:x-w/2+3+i*(w/3),y2:y+h/2,
      stroke:"#6b4a30","stroke-width":1.3,opacity:.8});
    add("line",{x1:x-w/2,y1:y,x2:x+w/2,y2:y,stroke:"#6b4a30","stroke-width":1.3,opacity:.8});
  },{pad:8});
  // church spire, orchard, ox-bow stream
  scatter(1,60,(x,y)=>{ X.house(x,y,24,16,"#e6ddc6","#7a6a52","#5e5140",{roofH:9,win:false});
    add("path",{d:`M ${x+16} ${y+8} l 0 -22 l 5 -12 l 5 12 l 0 22 Z`,fill:"#8b8272"});
    add("path",{d:`M ${x+21} ${y-34} l 0 -7 M ${x+18} ${y-38} l 6 0`,stroke:"#d8c98a","stroke-width":1.6}); });
  add("path",{d:`M -10 ${c.y+c.d*.9} q 120 40 220 6 q 120 -40 ${W+20} 30`,fill:"none",
              stroke:"#4f7d8c","stroke-width":7,opacity:.7,"stroke-linecap":"round"});
  scatter(20,52,(x,y)=> oak(x,y,7+rnd()*7,"#41552f","#57703c"));
};

/* ============================= MIAMI ============================== */
SCENERY.miami = function(ctx){
  const {g,el,W,H,rnd,scatter,poi,clearAll,okBox,propShadow}=ctx, X=props(ctx);
  const add=(n,at)=>g.appendChild(el(n,at));
  // ocean along the right edge, then sand, then the deco strip
  const dep=Math.min(Math.max(64,X.room("right")+12), Math.max(110,W*.16));
  X.seaBand("right",dep,"#0f8fa8","#4fc8d8","#f2fbfd",W,H);
  const sx=W-dep;
  add("rect",{x:sx-58,y:0,width:62,height:H,fill:"#f4e4bc"});
  add("path",{d:`M ${sx+2} 0 q -14 ${H*.25} 0 ${H*.5} q 14 ${H*.25} 0 ${H*.5}`,
              fill:"none",stroke:"#ffffff","stroke-width":4,opacity:.6});
  for(let i=0;i<22;i++){ // beach parasols + towels
    const x=sx-46+rnd()*36, y=20+rnd()*(H-40);
    propShadow(x,y+2,7,3,.16);
    add("path",{d:`M ${x-8} ${y} q 8 -9 16 0 Z`,fill:["#e8477f","#f2c14e","#4fd6e0"][(rnd()*3)|0]});
    add("line",{x1:x,y1:y,x2:x,y2:y+6,stroke:"#b7a98c","stroke-width":1.3});
  }
  // pastel art-deco hotels facing the ocean
  for(let i=0;i<7;i++){
    const x=sx-96, y=40+i*((H-80)/6)+rnd()*10;
    if(clearAll(x,y)<58||!okBox(x,y,12)) continue;
    const body=["#f6e0e8","#e6f3f0","#fbeeda","#e8e2f4"][(rnd()*4)|0];
    X.slab(x,y,54,34,body,"#d9c8cf",{rx:3,band:"#4fd6e0"});
    add("rect",{x:x-9,y:y-25,width:18,height:8,rx:2,fill:body});
    add("rect",{x:x-27,y:y+12,width:54,height:3,fill:"#e8477f",opacity:.85});
    for(let k=0;k<3;k++) add("rect",{x:x-20+k*14,y:y-8,width:8,height:14,rx:2,
      fill:"#9fd9e4",stroke:"#ffffff","stroke-width":1.2,opacity:.9});
  }
  // inland: pools, low pastel blocks, neon-lit palms
  scatter(6,58,(x,y)=>{ X.water(x,y,20+rnd()*10,12+rnd()*6,"#3fb8d0","#8fe4ee");
    add("rect",{x:x-26,y:y-16,width:52,height:32,rx:5,fill:"none",stroke:"#f4ead2","stroke-width":2.4,opacity:.7}); });
  scatter(9,56,(x,y)=> X.slab(x,y,34+rnd()*16,22,["#f6e0e8","#e6f3f0","#fbeeda"][(rnd()*3)|0],"#d9c8cf",
    {rx:3,band:"#e8477f"}));
  scatter(24,46,(x,y)=> X.palm(x,y,18+rnd()*14,"#8a6a44","#2f8a5a","#46b070"));
  // neon glow smears for a bit of night-strip swagger
  scatter(8,50,(x,y)=> add("ellipse",{cx:x,cy:y,rx:26,ry:9,
    fill:["#e8477f","#4fd6e0","#f2c14e"][(rnd()*3)|0],opacity:.14,filter:"url(#abSoft)"}));
};

/* ============================== RUINS ============================= */
SCENERY.ruins = function(ctx){
  const {g,el,W,H,rnd,scatter,poi,clearAll,okBox,propShadow,rock}=ctx, X=props(ctx);
  const add=(n,at)=>g.appendChild(el(n,at));
  const c=poi();
  // dry campagna grass
  for(let i=0;i<150;i++){
    const x=20+rnd()*(W-40), y=20+rnd()*(H-40);
    if(clearAll(x,y)<40) continue;
    add("line",{x1:x,y1:y,x2:x+rnd()*4-2,y2:y-4-rnd()*5,stroke:i%3?"#9c8f4e":"#cbbd76",
                "stroke-width":1.3,opacity:.65});
  }
  // the aqueduct: a run of arches marching off the board
  const ax=c.x-c.d*1.1, ay=c.y-10, aAng=-0.12, n=9;
  for(let i=0;i<n;i++){
    const x=ax+Math.cos(aAng)*i*34, y=ay+Math.sin(aAng)*i*34;
    if(!okBox(x,y,10)) continue;
    const fade=i>n-3?.55:1;
    propShadow(x+4,y+22,17,6,.20*fade);
    add("rect",{x:x-15,y:y-30,width:30,height:52,fill:"#c3b58c",opacity:fade});
    add("path",{d:`M ${x-9} ${y+22} v -18 q 9 -12 18 0 v 18 Z`,fill:"#8a7f5c",opacity:fade});
    add("rect",{x:x-18,y:y-36,width:36,height:8,fill:"#d3c69c",opacity:fade});
    add("rect",{x:x-15,y:y-30,width:9,height:52,fill:"#ffffff",opacity:.12*fade});
  }
  // ruined temple platform with fallen and standing columns
  const tx=c.x+c.d*.5, ty=c.y+18;
  if(clearAll(tx,ty)>60&&okBox(tx,ty,18)){
    add("rect",{x:tx-56,y:ty-6,width:112,height:16,rx:2,fill:"#ded1a6"});
    add("rect",{x:tx-56,y:ty-6,width:112,height:5,rx:2,fill:"#f2e8c4"});
    for(let i=0;i<6;i++){
      const x=tx-46+i*18, h=(i===2||i===4)?16:34;
      add("rect",{x:x-4.5,y:ty-6-h,width:9,height:h,fill:"#e6dab2"});
      add("rect",{x:x-4.5,y:ty-6-h,width:3,height:h,fill:"#c2b489"});
      if(h>20) add("rect",{x:x-6.5,y:ty-6-h-4,width:13,height:4,fill:"#f2e8c4"});
    }
    // toppled drum column lying in the grass
    add("rect",{x:tx+26,y:ty+14,width:44,height:9,rx:4,fill:"#dccfa4",
                transform:`rotate(9 ${tx+48} ${ty+18})`});
  }
  // scattered blocks, cypress-dark umbrella pines, wild flowers
  scatter(16,50,(x,y)=>{ propShadow(x+2,y+4,9,4,.2);
    add("rect",{x:x-7,y:y-5,width:14,height:10,rx:1.5,fill:"#dbcfa2",
                transform:`rotate(${(rnd()*40-20).toFixed(1)} ${x} ${y})`}); });
  scatter(13,54,(x,y)=>{ // umbrella pine: bare trunk, flat dark crown
    const h=22+rnd()*10;
    propShadow(x+4,y+3,12,4,.2);
    add("line",{x1:x,y1:y+2,x2:x+2,y2:y-h,stroke:"#6d5535","stroke-width":2.6});
    add("ellipse",{cx:x+2,cy:y-h-3,rx:16,ry:7,fill:"#2f4a2c"});
    add("ellipse",{cx:x-2,cy:y-h-6,rx:11,ry:4.5,fill:"#43613c",opacity:.9});
  });
  scatter(6,46,(x,y)=> rock(x,y,6+rnd()*6,"#b8ab84","#d6caa4"));
  scatter(5,46,(x,y)=>{ for(let i=0;i<10;i++)
    add("circle",{cx:x+rnd()*30-15,cy:y+rnd()*20-10,r:1.7,fill:"#c8453a",opacity:.8}); });
};

/* ============================== JAPAN ============================= */
SCENERY.japan = function(ctx){
  const {g,el,W,H,rnd,scatter,poi,clearAll,okBox,propShadow}=ctx, X=props(ctx);
  const add=(n,at)=>g.appendChild(el(n,at));
  // Fuji on the skyline: broad cone, snow cap, hazy foot
  const fx=W*.30, fy=H*.30;
  add("ellipse",{cx:fx,cy:fy+96,rx:300,ry:40,fill:"#8fa4b0",opacity:.22,filter:"url(#abSoftBig)"});
  add("path",{d:`M ${fx-250} ${fy+100} Q ${fx-90} ${fy-30} ${fx-34} ${fy-74}
                 Q ${fx} ${fy-92} ${fx+34} ${fy-74}
                 Q ${fx+90} ${fy-30} ${fx+250} ${fy+100} Z`,fill:"#5d6f88",opacity:.85});
  add("path",{d:`M ${fx-46} ${fy-62} Q ${fx-22} ${fy-84} ${fx-30} ${fy-70}
                 Q ${fx-10} ${fy-90} ${fx} ${fy-92}
                 Q ${fx+12} ${fy-90} ${fx+30} ${fy-70}
                 Q ${fx+24} ${fy-84} ${fx+46} ${fy-62}
                 Q ${fx} ${fy-50} ${fx-46} ${fy-62} Z`,fill:"#f4f8fb",opacity:.95});
  add("path",{d:`M ${fx-150} ${fy+40} Q ${fx-40} ${fy-20} ${fx+10} ${fy-6}`,
              fill:"none",stroke:"#7d90a4","stroke-width":6,opacity:.5});
  add("ellipse",{cx:fx,cy:fy+34,rx:230,ry:22,fill:"#eef2f6",opacity:.35,filter:"url(#abSoftBig)"});
  // garden pond with a red bridge
  const c=poi();
  if(c.d>60&&okBox(c.x,c.y,20)){
    X.water(c.x,c.y,Math.min(70,c.d*.8),Math.min(38,c.d*.45),"#3f7d8c","#6fa8b4");
    add("path",{d:`M ${c.x-34} ${c.y+6} q 34 -26 68 0`,fill:"none",stroke:"#c8402e",
                "stroke-width":5,"stroke-linecap":"round"});
    add("path",{d:`M ${c.x-34} ${c.y+6} q 34 -26 68 0`,fill:"none",stroke:"#8f2a1e","stroke-width":1.6,opacity:.7});
  }
  // torii gates and a pagoda
  const torii=(x,y,s)=>{
    propShadow(x,y+2,s*.7,s*.2,.2);
    add("rect",{x:x-s*.52,y:y-s*.9,width:s*1.04,height:s*.12,rx:2,fill:"#c8402e"});
    add("rect",{x:x-s*.60,y:y-s*1.05,width:s*1.20,height:s*.11,rx:3,fill:"#a8321f"});
    add("rect",{x:x-s*.40,y:y-s*.9,width:s*.10,height:s*.9,fill:"#c8402e"});
    add("rect",{x:x+s*.30,y:y-s*.9,width:s*.10,height:s*.9,fill:"#c8402e"});
  };
  scatter(5,52,(x,y)=> torii(x,y,20+rnd()*12));
  scatter(1,66,(x,y)=>{ // five-tier pagoda
    for(let i=0;i<5;i++){
      const w=34-i*5, yy=y-i*15;
      add("rect",{x:x-w/2+3,y:yy-12,width:w,height:11,fill:"#e8ddc8"});
      add("path",{d:`M ${x-w/2-6+3} ${yy-12} L ${x+3} ${yy-20} L ${x+w/2+6+3} ${yy-12} Z`,fill:"#8a3b2c"});
    }
    add("line",{x1:x+3,y1:y-88,x2:x+3,y2:y-98,stroke:"#c9973a","stroke-width":2});
  },{pad:16});
  // cherry trees in blossom + dark pines for contrast
  scatter(26,48,(x,y)=>{
    const r=7+rnd()*5;
    propShadow(x+2,y+r*.6,r*1.1,r*.4,.16);
    add("line",{x1:x,y1:y+r*.8,x2:x,y2:y-r*.2,stroke:"#6b4a3c","stroke-width":2});
    add("circle",{cx:x,cy:y-r*.4,r:r,fill:"#f0b8c8"});
    add("circle",{cx:x-r*.36,cy:y-r*.7,r:r*.6,fill:"#f8d6e0",opacity:.95});
    add("circle",{cx:x+r*.4,cy:y-r*.2,r:r*.45,fill:"#e096ac",opacity:.6});
  });
  scatter(12,50,(x,y)=> ctx.pine(x,y,10+rnd()*9,"#2c4430","#3d5b3c"));
  // drifting petals
  for(let i=0;i<70;i++){
    const x=rnd()*W, y=rnd()*H;
    add("circle",{cx:x,cy:y,r:1.3,fill:"#f8d6e0",opacity:.55});
  }
};

/* ============================== SPAIN ============================= */
SCENERY.spain = function(ctx){
  const {g,el,W,H,rnd,scatter,poi,clearAll,okBox,propShadow,rock}=ctx, X=props(ctx);
  const add=(n,at)=>g.appendChild(el(n,at));
  // sierra ridges stacked along the top
  const ridge=["#9a7a4e","#8a6c44","#7a5f3c"];
  for(let k=0;k<3;k++){
    const y=H*(.16+k*.07);
    let d=`M -20 ${y+40}`;
    for(let i=0;i<=8;i++) d+=` L ${(-20+ (W+40)*i/8).toFixed(0)} ${(y - (k?18:26)*Math.abs(Math.sin(i*1.7+k))).toFixed(0)}`;
    d+=` L ${W+20} ${H} L -20 ${H} Z`;
    add("path",{d,fill:ridge[k],opacity:.45});
  }
  // olive grid — the signature of the Andalusian plain
  for(let b=0;b<7;b++){
    const bx=40+rnd()*(W-120), by=40+rnd()*(H-120), a=rnd()*.5-.25;
    for(let r=0;r<4;r++) for(let cI=0;cI<6;cI++){
      const px=bx+Math.cos(a)*cI*20+Math.cos(a+1.57)*r*18;
      const py=by+Math.sin(a)*cI*20+Math.sin(a+1.57)*r*18;
      if(px<20||px>W-20||py<20||py>H-20) continue;
      if(clearAll(px,py)<50||!okBox(px,py,8)) continue;
      X.olive(px,py,5+rnd()*2,"#75855a","#95a578");
    }
  }
  // whitewashed pueblo: cubes with terracotta roofs climbing a rise
  const c=poi();
  for(let i=0;i<12;i++){
    const x=c.x-70+rnd()*140, y=c.y-40+rnd()*80;
    if(clearAll(x,y)<52||!okBox(x,y,10)) continue;
    X.house(x,y,20+rnd()*12,13+rnd()*5,"#f6f2e6","#c8663c","#a04c2c",{roofH:7,ang:rnd()*3-1.5});
  }
  // hilltop church + ridge windmills
  scatter(1,62,(x,y)=>{ X.house(x,y,26,16,"#f6f2e6","#c8663c","#a04c2c",{roofH:8,win:false});
    add("rect",{x:x+11,y:y-26,width:11,height:26,fill:"#f6f2e6"});
    add("path",{d:`M ${x+9} ${y-26} L ${x+16.5} ${y-36} L ${x+24} ${y-26} Z`,fill:"#c8663c"}); });
  scatter(3,58,(x,y)=>{
    propShadow(x+2,y+7,12,5,.22);
    add("path",{d:`M ${x-11} ${y+8} L ${x-8} ${y-16} L ${x+8} ${y-16} L ${x+11} ${y+8} Z`,fill:"#f6f2e6"});
    add("path",{d:`M ${x-10} ${y-16} q 10 -10 20 0 Z`,fill:"#3c3830"});
    for(let i=0;i<4;i++){ const a=i*Math.PI/2+.4;
      add("line",{x1:x,y1:y-20,x2:x+Math.cos(a)*16,y2:y-20+Math.sin(a)*16,
                  stroke:"#e6dcc0","stroke-width":2.4}); }
    add("circle",{cx:x,cy:y-20,r:2,fill:"#8a7f68"});
  },{pad:12});
  scatter(9,48,(x,y)=> rock(x,y,6+rnd()*6,"#a08a62","#c4ae86"));
  scatter(14,46,(x,y)=> add("circle",{cx:x,cy:y,r:3+rnd()*3.5,fill:"#8a8a45",opacity:.75}));
};

/* ============================= JUNGLE ============================= */
SCENERY.jungle = function(ctx){
  const {g,el,W,H,rnd,scatter,poi,clearAll,okBox,propShadow}=ctx, X=props(ctx);
  const add=(n,at)=>g.appendChild(el(n,at));
  // deep canopy: overlapping blobs at three depths, darkest first
  const layers=[["#1b3a20",210,.55],["#25502c",150,.6],["#31663a",95,.6]];
  for(const [col,r,op] of layers)
    for(let i=0;i<16;i++){
      const x=rnd()*W, y=rnd()*H;
      add("ellipse",{cx:x,cy:y,rx:r*(.5+rnd()*.6),ry:r*(.3+rnd()*.4),fill:col,opacity:op,
        transform:`rotate(${(rnd()*180).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})`});
    }
  // a brown river carving through, with sandbars
  const c=poi();
  add("path",{d:`M -20 ${c.y-40} q 140 60 250 20 q 150 -56 ${W+40} 40`,fill:"none",
              stroke:"#6b5a34","stroke-width":26,opacity:.85,"stroke-linecap":"round"});
  add("path",{d:`M -20 ${c.y-40} q 140 60 250 20 q 150 -56 ${W+40} 40`,fill:"none",
              stroke:"#8a7442","stroke-width":13,opacity:.7,"stroke-linecap":"round"});
  // canopy texture: leaf clusters and fern fronds
  scatter(70,40,(x,y)=>{
    const r=8+rnd()*12, k=(rnd()*3)|0;
    add("circle",{cx:x,cy:y,r,fill:["#2a5730","#356b3c","#1f4526"][k],opacity:.9});
    add("circle",{cx:x-r*.3,cy:y-r*.35,r:r*.55,fill:["#3f7d46","#4c8f54","#316238"][k],opacity:.8});
  },{pad:4});
  scatter(30,40,(x,y)=>{ // tree ferns / big leaves
    const s=10+rnd()*8;
    for(let i=0;i<6;i++){ const a=-Math.PI+ i*(Math.PI/5.5);
      add("path",{d:`M ${x} ${y} q ${Math.cos(a)*s*.6} ${Math.sin(a)*s*.6-4} ${Math.cos(a)*s} ${Math.sin(a)*s}`,
        fill:"none",stroke:i%2?"#4f9a58":"#3c7c44","stroke-width":3,"stroke-linecap":"round"}); }
  },{pad:4});
  scatter(20,44,(x,y)=> X.palm(x,y,20+rnd()*16,"#5c4a2e","#2f7a42","#46a058"));
  // mist pooling in the low ground + a splash of flowering vines
  scatter(6,44,(x,y)=> add("ellipse",{cx:x,cy:y,rx:70,ry:20,fill:"#dff0e0",opacity:.13,
    filter:"url(#abSoftBig)"}),{pad:0});
  scatter(10,42,(x,y)=>{ for(let i=0;i<8;i++)
    add("circle",{cx:x+rnd()*26-13,cy:y+rnd()*18-9,r:1.9,
      fill:["#e8477f","#f2a03c","#f0e05a"][(rnd()*3)|0],opacity:.85}); });
};

/* ============================= FOREST ============================= */
SCENERY.forest = function(ctx){
  const {g,el,W,H,rnd,scatter,poi,clearAll,okBox,propShadow,pine,rock}=ctx;
  const add=(n,at)=>g.appendChild(el(n,at));
  // dark Ardennes floor with damp hollows
  for(let i=0;i<18;i++){
    const x=rnd()*W, y=rnd()*H;
    add("ellipse",{cx:x,cy:y,rx:60+rnd()*90,ry:36+rnd()*50,fill:i%2?"#2b4023":"#3d5a32",opacity:.5,
      transform:`rotate(${(rnd()*180).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})`});
  }
  // a forestry track and a firebreak clearing
  const c=poi();
  add("path",{d:`M ${c.x-c.d} ${c.y+20} q 100 -50 200 -18 q 120 38 ${W} -26`,fill:"none",
              stroke:"#9a8a62","stroke-width":7,opacity:.42,"stroke-linecap":"round"});
  if(c.d>64&&okBox(c.x,c.y,20)){
    add("ellipse",{cx:c.x,cy:c.y,rx:Math.min(120,c.d),ry:Math.min(64,c.d*.6),fill:"#5f7a3e",opacity:.55});
    // log stack at the edge of the clearing
    const lx=c.x+c.d*.5, ly=c.y+10;
    if(clearAll(lx,ly)>56){
      propShadow(lx+2,ly+7,22,6,.22);
      for(let r=0;r<3;r++) for(let i=0;i<6-r;i++)
        add("circle",{cx:lx-18+i*7+r*3.5,cy:ly-r*6.4,r:3.4,fill:"#b08a52",stroke:"#6d5330","stroke-width":1});
    }
  }
  // dense spruce, three tones, plus scrub and boulders
  const pc=["#1f3a26","#27482d","#193020"], ph=["#2f5636","#3a6640","#284a2e"];
  scatter(120,46,(x,y)=>{ const k=(rnd()*3)|0; pine(x,y,9+rnd()*14,pc[k],ph[k]); },{pad:2});
  scatter(26,44,(x,y)=> add("circle",{cx:x,cy:y,r:4+rnd()*5,fill:"#43613a",opacity:.8}));
  scatter(12,46,(x,y)=> rock(x,y,6+rnd()*7,"#6d6a5e","#8b8779"));
  // mist bands drifting between the trunks
  for(let i=0;i<5;i++){
    const y=40+rnd()*(H-80);
    add("ellipse",{cx:rnd()*W,cy:y,rx:130+rnd()*120,ry:16+rnd()*12,fill:"#e2ece0",opacity:.13,
      filter:"url(#abSoftBig)"});
  }
};

/* ============================== COAST ============================= */
SCENERY.coast = function(ctx){
  const {g,el,W,H,rnd,scatter,poi,clearAll,okBox,propShadow}=ctx, X=props(ctx);
  const add=(n,at)=>g.appendChild(el(n,at));
  // North Sea down the left, wet sand, then marram dunes
  const depth=Math.min(Math.max(64,X.room("left")+12), Math.max(120,W*.17));
  X.seaBand("left",depth,"#2a5f77","#4d8ba0","#e8f2f6",W,H);
  add("rect",{x:depth-6,y:0,width:46,height:H,fill:"#cbbd92",opacity:.85});
  add("path",{d:`M ${depth+2} 0 q 16 ${H*.25} 0 ${H*.5} q -16 ${H*.25} 0 ${H*.5}`,
              fill:"none",stroke:"#f2f8fa","stroke-width":4,opacity:.55});
  // dune ridges running parallel to the shore
  for(let i=0;i<9;i++){
    const x=depth+50+i*((W-depth-70)/9);
    add("path",{d:`M ${x} -10 q ${18+rnd()*20} ${H*.3} ${-6} ${H*.5} q ${-16} ${H*.3} ${8} ${H*.25}`,
      fill:"none",stroke:i%2?"#c2b382":"#eee0b0","stroke-width":13+rnd()*10,opacity:.45,
      "stroke-linecap":"round"});
  }
  // lighthouse on the roomiest headland, with a beam
  const c=poi();
  const lx=Math.max(depth+70,c.x-c.d*.6), ly=c.y;
  if(clearAll(lx,ly)>62&&okBox(lx,ly,18)){
    add("ellipse",{cx:lx,cy:ly+16,rx:34,ry:13,fill:"#b7a87c"});
    propShadow(lx+5,ly+12,14,6,.26);
    add("path",{d:`M ${lx-10} ${ly+12} L ${lx-6} ${ly-46} L ${lx+6} ${ly-46} L ${lx+10} ${ly+12} Z`,fill:"#f4f2ec"});
    for(let i=0;i<3;i++) add("path",{d:`M ${lx-9+i*.6} ${ly+2-i*16} L ${lx+9-i*.6} ${ly+2-i*16} l -1 -8 l -16 0 Z`,
      fill:"#c8402e"});
    add("rect",{x:lx-8,y:ly-56,width:16,height:11,rx:2,fill:"#2f3a44"});
    add("circle",{cx:lx,cy:ly-50.5,r:3.4,fill:"#ffe9a8"});
    add("path",{d:`M ${lx} ${ly-50} L ${lx-140} ${ly-96} L ${lx-140} ${ly-6} Z`,
      fill:"#ffe9a8",opacity:.13,filter:"url(#abSoft)"});
    add("path",{d:`M ${lx-4} ${ly+12} l -22 0 l 0 -12 l 22 0`,fill:"#e2ded2"});
  }
  // groynes marching into the surf + tide-line posts
  for(let i=0;i<7;i++){
    const y=30+i*((H-60)/6);
    for(let t=0;t<9;t++)
      add("rect",{x:depth-6-t*11,y:y-2+ (t%2?1:0),width:4,height:9,rx:1.5,
        fill:"#5c4a34",opacity:.9-t*.06});
  }
  // marram grass tufts, driftwood and a beached dinghy
  scatter(60,44,(x,y)=>{ for(let i=0;i<5;i++)
    add("line",{x1:x,y1:y,x2:x+rnd()*9-4.5,y2:y-6-rnd()*7,stroke:i%2?"#9aa063":"#c2c47e",
      "stroke-width":1.3,opacity:.85}); },{pad:2});
  scatter(10,46,(x,y)=>{ add("rect",{x:x-9,y:y-2,width:18,height:3.4,rx:1.6,fill:"#a8977a",
    transform:`rotate(${(rnd()*70-35).toFixed(0)} ${x} ${y})`}); });
  scatter(1,58,(x,y)=>{ propShadow(x,y+3,14,5,.2);
    add("path",{d:`M ${x-15} ${y} q 15 12 30 0 q -15 -6 -30 0 Z`,fill:"#d8dcd6",stroke:"#5c6a70","stroke-width":1.6}); });
};

/* ============================= HOLLAND ============================ */
SCENERY.holland = function(ctx){
  const {g,el,W,H,rnd,scatter,poi,clearAll,okBox,propShadow}=ctx, X=props(ctx);
  const add=(n,at)=>g.appendChild(el(n,at));
  // ruler-straight polder: drainage ditches carving the land into strips
  const ang=-0.10;
  for(let i=-2;i<16;i++){
    const x0=-60+i*78;
    add("line",{x1:x0,y1:-40,x2:x0+Math.tan(ang)*(H+80),y2:H+40,
      stroke:"#4f7d8c","stroke-width":5,opacity:.55});
    add("line",{x1:x0+3,y1:-40,x2:x0+3+Math.tan(ang)*(H+80),y2:H+40,
      stroke:"#8fb8c4","stroke-width":1.6,opacity:.5});
  }
  // tulip beds: saturated colour bands between the ditches
  const tul=["#e8477f","#f2c14e","#d84a3c","#f6f2e6","#b45ad0"];
  for(let i=0;i<16;i++){
    const x=40+rnd()*(W-120), y=40+rnd()*(H-100);
    if(clearAll(x,y)<58||!okBox(x,y,12)) continue;
    const w=64+rnd()*90, h=34+rnd()*40, col=tul[(rnd()*5)|0];
    const t=`rotate(${(-6+rnd()*4).toFixed(1)} ${x} ${y})`;
    add("rect",{x:x-w/2,y:y-h/2,width:w,height:h,fill:"#5d7d38",opacity:.5,transform:t});
    for(let r=0;r<5;r++)
      add("rect",{x:x-w/2,y:y-h/2+r*(h/5)+1.5,width:w,height:h/5*.55,fill:col,opacity:.85,transform:t});
  }
  // smock windmills on the dyke
  const mill=(x,y,s)=>{
    propShadow(x+3,y+s*.4,s*.55,s*.2,.24);
    add("path",{d:`M ${x-s*.34} ${y+s*.36} L ${x-s*.20} ${y-s*.42} L ${x+s*.20} ${y-s*.42} L ${x+s*.34} ${y+s*.36} Z`,
      fill:"#6b5335"});
    add("path",{d:`M ${x-s*.34} ${y+s*.36} L ${x-s*.20} ${y-s*.42} L ${x-s*.02} ${y-s*.42} L ${x-s*.06} ${y+s*.36} Z`,
      fill:"#fff",opacity:.12});
    add("path",{d:`M ${x-s*.26} ${y-s*.42} q ${s*.26} ${-s*.30} ${s*.52} 0 Z`,fill:"#3c3830"});
    add("rect",{x:x-s*.44,y:y+s*.30,width:s*.88,height:s*.09,fill:"#8a6f48"});
    for(let i=0;i<4;i++){ const a=i*Math.PI/2+.5, L=s*.62;
      add("line",{x1:x,y1:y-s*.5,x2:x+Math.cos(a)*L,y2:y-s*.5+Math.sin(a)*L,
        stroke:"#e6dcc0","stroke-width":2.6});
      add("line",{x1:x,y1:y-s*.5,x2:x+Math.cos(a)*L,y2:y-s*.5+Math.sin(a)*L,
        stroke:"#8a6f48","stroke-width":1,opacity:.8}); }
    add("circle",{cx:x,cy:y-s*.5,r:2.2,fill:"#5c4a30"});
  };
  scatter(5,62,(x,y)=> mill(x,y,34+rnd()*14),{pad:14});
  // a canal barge and lifting bridge on the main ditch
  const c=poi();
  scatter(1,56,(x,y)=>{ add("rect",{x:x-16,y:y-4,width:32,height:8,rx:3,fill:"#3a4a3a"});
    add("rect",{x:x+4,y:y-9,width:9,height:6,rx:1.5,fill:"#e6dcc0"}); });
  // fence posts, poplar wind rows, grazing cattle
  scatter(14,46,(x,y)=>{ const a=rnd()*Math.PI;
    X.postRun(x,y,a,44,8,(px,py)=>{ if(clearAll(px,py)>42)
      add("rect",{x:px-1,y:py-6,width:2,height:8,fill:"#7a6a4a"}); });
    add("line",{x1:x,y1:y-4,x2:x+Math.cos(a)*44,y2:y+Math.sin(a)*44,stroke:"#9a8a68",
      "stroke-width":.9,opacity:.8}); });
  scatter(8,50,(x,y)=>{ const a=rnd()*Math.PI;
    for(let t=0;t<70;t+=17) X.cypress(x+Math.cos(a)*t,y+Math.sin(a)*t,20+rnd()*8,"#3f5c30","#547340"); });
  scatter(6,50,(x,y)=>{ for(let i=0;i<4;i++){ const ox=x+rnd()*30-15, oy=y+rnd()*18-9;
    add("ellipse",{cx:ox,cy:oy,rx:4.2,ry:2.4,fill:"#f2efe6"});
    add("ellipse",{cx:ox-1.6,cy:oy-.4,rx:2,ry:1.5,fill:"#3a352e"});
    add("circle",{cx:ox+4.2,cy:oy-1.2,r:1.2,fill:"#3a352e"}); } });
};

/* ============================ VINEYARD ============================ */
SCENERY.vineyard = function(ctx){
  const {g,el,W,H,rnd,scatter,poi,clearAll,okBox,propShadow}=ctx, X=props(ctx);
  const add=(n,at)=>g.appendChild(el(n,at));
  // rolling slopes, then vine rows combed across them
  for(let i=0;i<7;i++){
    const y=H*(i/6);
    add("path",{d:`M -30 ${y} q ${W*.3} ${-30-rnd()*26} ${W*.55} ${6} q ${W*.3} ${30} ${W*.6} ${-14}
                   L ${W+30} ${H+40} L -30 ${H+40} Z`,fill:i%2?"#7d8e46":"#93a35a",opacity:.32});
  }
  for(let b=0;b<12;b++){
    const bx=50+rnd()*(W-140), by=50+rnd()*(H-120), a=(rnd()*.7-.35);
    if(clearAll(bx,by)<60||!okBox(bx,by,14)) continue;
    const rows=4+((rnd()*4)|0), len=70+rnd()*70;
    for(let r=0;r<rows;r++){
      const ox=bx+Math.cos(a+1.57)*r*11, oy=by+Math.sin(a+1.57)*r*11;
      let broke=false;
      for(let t=0;t<len;t+=9){
        const px=ox+Math.cos(a)*t, py=oy+Math.sin(a)*t;
        if(clearAll(px,py)<48){ broke=true; break; }
        add("circle",{cx:px,cy:py,r:3.4,fill:r%2?"#4f6b30":"#5c7a38",opacity:.92});
        add("circle",{cx:px-1,cy:py-1.2,r:1.7,fill:"#7d9a52",opacity:.75});
      }
      // the trellis wire down the row
      if(!broke) add("line",{x1:ox,y1:oy,x2:ox+Math.cos(a)*len,y2:oy+Math.sin(a)*len,
        stroke:"#8a7a58","stroke-width":.9,opacity:.6});
    }
  }
  // the château: long body, two conical turrets, gravel court
  const c=poi();
  if(c.d>68&&okBox(c.x,c.y,24)){
    const x=c.x, y=c.y;
    add("ellipse",{cx:x,cy:y+22,rx:76,ry:22,fill:"#d8ceac",opacity:.7});
    X.house(x,y,66,26,"#f0e6cc","#5c6a72","#454e56",{roofH:16});
    const turret=(tx)=>{ add("rect",{x:tx-8,y:y-16,width:16,height:29,fill:"#e8dcc0"});
      add("path",{d:`M ${tx-11} ${y-16} L ${tx} ${y-44} L ${tx+11} ${y-16} Z`,fill:"#4a545c"}); };
    turret(x-36); turret(x+36);
    add("rect",{x:x-4,y:y-2,width:8,height:15,fill:"#6b4a30"});
  }
  // poplar wind-breaks, cellar barrels and a lone chapel
  scatter(9,54,(x,y)=>{ const a=rnd()*Math.PI;
    for(let t=0;t<80;t+=18) X.cypress(x+Math.cos(a)*t,y+Math.sin(a)*t,26+rnd()*10,"#465f2c","#5d7a3c"); });
  scatter(7,48,(x,y)=>{ for(let i=0;i<3;i++){
    propShadow(x+i*9,y+3,6,2.6,.2);
    add("ellipse",{cx:x+i*9,cy:y,rx:4.4,ry:6,fill:"#8a5a34",stroke:"#5c3a20","stroke-width":1});
    add("line",{x1:x+i*9-4.4,y1:y,x2:x+i*9+4.4,y2:y,stroke:"#c9a86a","stroke-width":1.2}); } });
  scatter(1,56,(x,y)=>{ X.house(x,y,20,14,"#f0e6cc","#8a6a4a","#6b5136",{roofH:8,win:false});
    add("path",{d:`M ${x} ${y-22} l 0 -8 M ${x-3} ${y-27} l 6 0`,stroke:"#8a7f68","stroke-width":1.6}); });
};

/* ============================== MEXICO ============================ */
SCENERY.mexico = function(ctx){
  const {g,el,W,H,rnd,scatter,poi,clearAll,okBox,propShadow,rock}=ctx, X=props(ctx);
  const add=(n,at)=>g.appendChild(el(n,at));
  // twin volcanoes on the horizon, one smoking
  const vol=(vx,vy,s,smoke)=>{
    add("path",{d:`M ${vx-s} ${vy+s*.42} L ${vx-s*.16} ${vy-s*.52} L ${vx+s*.16} ${vy-s*.52} L ${vx+s} ${vy+s*.42} Z`,
      fill:"#6b5a52",opacity:.9});
    add("path",{d:`M ${vx-s*.16} ${vy-s*.52} L ${vx+s*.16} ${vy-s*.52} L ${vx+s*.42} ${vy-s*.12} L ${vx-s*.42} ${vy-s*.12} Z`,
      fill:"#efe8e2",opacity:.9});
    add("path",{d:`M ${vx-s*.16} ${vy-s*.52} L ${vx+s*.16} ${vy-s*.52} L ${vx+s} ${vy+s*.42} L ${vx+s*.3} ${vy+s*.42} Z`,
      fill:"#000",opacity:.14});
    if(smoke) for(let i=0;i<4;i++)
      add("ellipse",{cx:vx+ i*10, cy:vy-s*.62-i*16, rx:16+i*7, ry:9+i*4, fill:"#e6e2dc",
        opacity:.28-i*.05, filter:"url(#abSoftBig)"});
  };
  vol(W*.26,H*.26,120,true); vol(W*.44,H*.30,78,false);
  // dry arroyo + dusty tracks
  const c=poi();
  add("path",{d:`M -20 ${c.y+c.d*.7} q 120 -50 230 -10 q 130 46 ${W+30} -30`,fill:"none",
              stroke:"#e0c08a","stroke-width":15,opacity:.6,"stroke-linecap":"round"});
  // adobe pueblo: flat-roofed cubes, ochre and rose, with vigas
  scatter(14,54,(x,y)=>{
    const w=24+rnd()*16, h=15+rnd()*7;
    const body=["#d9915c","#c87a52","#e8b184","#b96a4a"][(rnd()*4)|0];
    X.slab(x,y,w,h,body,"#9a5a3c",{rx:2});
    add("rect",{x:x-w/2,y:y-h/2-3,width:w,height:4,rx:1.5,fill:"#efd6b4"});
    for(let i=0;i<3;i++) add("rect",{x:x-w/2+4+i*(w/3.4),y:y-h/2-1,width:2.4,height:3,fill:"#6b4a30"});
    add("rect",{x:x-3,y:y+h/2-7,width:6,height:7,fill:"#4a3a2c"});
  },{pad:8});
  // a white mission church with twin bell towers
  scatter(1,64,(x,y)=>{
    X.slab(x,y,44,22,"#f4ecdc","#d6c8b0",{rx:2});
    add("path",{d:`M ${x-24} ${y-11} q 24 -16 48 0 Z`,fill:"#f4ecdc"});
    [-18,18].forEach(dx=>{ add("rect",{x:x+dx-6,y:y-30,width:12,height:22,fill:"#f4ecdc"});
      add("path",{d:`M ${x+dx-8} ${y-30} q 8 -10 16 0 Z`,fill:"#c8663c"});
      add("rect",{x:x+dx-2.5,y:y-25,width:5,height:6,fill:"#8a7a62"}); });
    add("path",{d:`M ${x} ${y-24} l 0 -9 M ${x-3.5} ${y-29} l 7 0`,stroke:"#c9973a","stroke-width":1.8});
  },{pad:16});
  // agaves, barrel cacti, dry brush and lava boulders
  scatter(26,46,(x,y)=>{ // agave rosette
    propShadow(x+2,y+3,10,4,.2);
    for(let i=0;i<9;i++){ const a=-Math.PI/2 + (i-4)*0.34, L=9+rnd()*7;
      add("path",{d:`M ${x} ${y+2} L ${x+Math.cos(a)*L*.6-1.6} ${y+2+Math.sin(a)*L*.7}
                     L ${x+Math.cos(a)*L} ${y+2+Math.sin(a)*L}
                     L ${x+Math.cos(a)*L*.6+1.6} ${y+2+Math.sin(a)*L*.7} Z`,
        fill:i%2?"#6d8f5e":"#84a56f"}); }
  });
  scatter(14,46,(x,y)=>{ propShadow(x+2,y+3,6,2.6,.2);
    add("ellipse",{cx:x,cy:y,rx:5,ry:6.4,fill:"#4e7a3c"});
    for(let i=-2;i<=2;i++) add("line",{x1:x+i*2,y1:y-6,x2:x+i*2,y2:y+6,stroke:"#659452","stroke-width":.9});
    if(rnd()>.6) add("circle",{cx:x,cy:y-7,r:1.8,fill:"#e8477f"}); });
  scatter(22,44,(x,y)=> add("circle",{cx:x,cy:y,r:3+rnd()*4,fill:"#9a8a4e",opacity:.7}));
  scatter(9,46,(x,y)=> rock(x,y,6+rnd()*7,"#6b5f58","#8d8078"));
};

/* ============================= AOTEAROA ============================ */
SCENERY.aotearoa = function(ctx){
  const {g,el,W,H,rnd,scatter,poi,clearAll,okBox,propShadow}=ctx, X=props(ctx);
  const add=(n,at)=>g.appendChild(el(n,at));
  // soft green hill country, bush-clad gullies
  for(let i=0;i<10;i++){
    const x=rnd()*W, y=rnd()*H;
    add("ellipse",{cx:x,cy:y,rx:80+rnd()*130,ry:44+rnd()*70,fill:i%2?"#457a36":"#5c9a48",opacity:.42,
      transform:`rotate(${(rnd()*180).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})`});
  }
  for(let i=0;i<7;i++){ // native bush gullies
    const x=40+rnd()*(W-80), y=40+rnd()*(H-80);
    if(clearAll(x,y)<66) continue;
    const a=rnd()*Math.PI;
    for(let t=0;t<90;t+=11){
      const px=x+Math.cos(a)*t, py=y+Math.sin(a)*t;
      if(clearAll(px,py)<52) break;
      add("circle",{cx:px,cy:py,r:9+rnd()*7,fill:["#254d28","#2f5f31","#1d3f22"][(rnd()*3)|0],opacity:.9});
    }
  }
  // paddocks fenced into neat blocks with posts and wire
  for(let i=0;i<9;i++){
    const x=50+rnd()*(W-150), y=50+rnd()*(H-130), w=90+rnd()*120, h=60+rnd()*80;
    if(clearAll(x+w/2,y+h/2)<58||!okBox(x+w/2,y+h/2,12)) continue;
    const t=`rotate(${(rnd()*8-4).toFixed(1)} ${(x+w/2).toFixed(1)} ${(y+h/2).toFixed(1)})`;
    add("rect",{x,y,width:w,height:h,fill:i%2?"#54913f":"#649f4c",opacity:.5,transform:t});
    add("rect",{x,y,width:w,height:h,fill:"none",stroke:"#e2d9b8","stroke-width":1.3,
      "stroke-dasharray":"3 7",opacity:.85,transform:t});
  }
  // woolshed + stockyards
  const c=poi();
  scatter(1,60,(x,y)=>{
    X.house(x,y,44,20,"#8a3f34","#6b322a","#52251f",{roofH:9,win:false});
    add("rect",{x:x-22,y:y-2,width:44,height:2,fill:"#c9b48c",opacity:.6});
    for(let i=0;i<4;i++) add("rect",{x:x+26,y:y-8+i*7,width:22,height:1.6,fill:"#a89a78"});
    for(let i=0;i<4;i++) add("rect",{x:x+26+i*7,y:y-8,width:1.6,height:22,fill:"#a89a78"});
  },{pad:14});
  // sheep — the obligatory national census
  scatter(16,44,(x,y)=>{
    for(let i=0;i<5+((rnd()*5)|0);i++){
      const ox=x+rnd()*38-19, oy=y+rnd()*24-12;
      if(clearAll(ox,oy)<40) continue;
      add("ellipse",{cx:ox+1,cy:oy+2,rx:4.4,ry:2,fill:"#000",opacity:.16});
      add("ellipse",{cx:ox,cy:oy,rx:4.2,ry:3,fill:"#f4f1e6"});
      add("circle",{cx:ox-3.6,cy:oy-1.4,r:1.7,fill:"#3a352e"});
      add("line",{x1:ox-1,y1:oy+2.6,x2:ox-1,y2:oy+4.6,stroke:"#3a352e","stroke-width":1});
      add("line",{x1:ox+2,y1:oy+2.6,x2:ox+2,y2:oy+4.6,stroke:"#3a352e","stroke-width":1});
    }
  },{pad:4});
  // tree ferns (ponga) and cabbage trees
  scatter(22,46,(x,y)=>{
    const h=14+rnd()*10;
    propShadow(x+3,y+3,9,4,.2);
    add("line",{x1:x,y1:y+2,x2:x,y2:y-h,stroke:"#6b5a44","stroke-width":2.4});
    for(let i=0;i<7;i++){ const a=-Math.PI+ i*(Math.PI/6.2), L=h*.85;
      add("path",{d:`M ${x} ${y-h} q ${Math.cos(a)*L*.5} ${Math.sin(a)*L*.5-3} ${Math.cos(a)*L} ${Math.sin(a)*L+2}`,
        fill:"none",stroke:i%2?"#2f6b34":"#3f8442","stroke-width":2.6,"stroke-linecap":"round"}); }
  });
  scatter(12,46,(x,y)=>{ // cabbage tree
    const h=18+rnd()*10;
    add("line",{x1:x,y1:y+2,x2:x,y2:y-h,stroke:"#8a7a5c","stroke-width":2.2});
    for(let i=0;i<10;i++){ const a=-Math.PI*.9+ i*(Math.PI*.8/9), L=9+rnd()*5;
      add("line",{x1:x,y1:y-h,x2:x+Math.cos(a)*L,y2:y-h+Math.sin(a)*L+3,
        stroke:"#5c7a3c","stroke-width":1.6}); }
  });
  // shelter belts of macrocarpa along the fence lines
  scatter(6,50,(x,y)=>{ const a=rnd()*Math.PI;
    for(let t=0;t<80;t+=13){ const px=x+Math.cos(a)*t, py=y+Math.sin(a)*t;
      if(clearAll(px,py)<46) break;
      add("circle",{cx:px,cy:py,r:7+rnd()*3,fill:"#2c4a2a",opacity:.85}); } });
};

/* =============================== NYC ============================== */
SCENERY.nyc = function(ctx){
  const {g,el,W,H,rnd,scatter,poi,clearAll,okBox,propShadow,oak}=ctx, X=props(ctx);
  const add=(n,at)=>g.appendChild(el(n,at));
  // East River along the top with piers and a suspension bridge
  const depth=Math.min(Math.max(58,X.room("top")+12), Math.max(96,H*.17));
  X.seaBand("top",depth,"#1d3c52","#3f6f8c","#dfeaf2",W,H);
  add("rect",{x:0,y:depth-8,width:W,height:12,fill:"#5a5f66"});         // bulkhead
  for(let i=0;i<6;i++){                                                  // finger piers
    const x=40+i*((W-80)/5);
    add("rect",{x:x-11,y:depth-40,width:22,height:40,rx:2,fill:"#6d737b"});
    add("rect",{x:x-8,y:depth-36,width:16,height:14,rx:2,fill:"#9aa0a8"});
  }
  { // the bridge: two towers, a catenary and hanger cables
    const bx=W*.62, by=depth-6, th=depth*.92;
    const tower=(tx)=>{ add("rect",{x:tx-8,y:by-th,width:16,height:th,fill:"#8a7f74"});
      add("path",{d:`M ${tx-9} ${by-th*.62} h 18 M ${tx-9} ${by-th*.34} h 18`,
        stroke:"#6b6157","stroke-width":3});
      add("path",{d:`M ${tx-8} ${by-th} l 8 -10 l 8 10 Z`,fill:"#8a7f74"}); };
    tower(bx-70); tower(bx+70);
    add("path",{d:`M ${bx-150} ${by-th*.42} Q ${bx-70} ${by-th*1.02} ${bx-70} ${by-th}
                   Q ${bx} ${by-th*.34} ${bx+70} ${by-th}
                   Q ${bx+70} ${by-th*1.02} ${bx+150} ${by-th*.42}`,
      fill:"none",stroke:"#c9c2b6","stroke-width":2.6});
    for(let i=-9;i<=9;i++){ const x=bx+i*15;
      const yTop=by-th+Math.abs(i/9)*(th*.62)*Math.abs(i/9);
      add("line",{x1:x,y1:Math.min(yTop,by-14),x2:x,y2:by-14,stroke:"#c9c2b6","stroke-width":1,opacity:.8}); }
    add("rect",{x:bx-152,y:by-16,width:304,height:7,fill:"#7a7168"});
  }
  // midtown: setback towers, water tanks, rooftop gardens
  const pal=["#7a6f66","#8a8078","#6b6259","#948a80","#5d554e","#a09488"];
  const cw=104, ch=86;
  for(let gx=16;gx+cw<W-12;gx+=cw) for(let gy=depth+14;gy+ch<H-12;gy+=ch){
    const cx=gx+cw/2, cy=gy+ch/2;
    if(clearAll(cx,cy)<72||!okBox(cx,cy,22)) continue;
    if(rnd()<.13){ // green square
      add("rect",{x:cx-38,y:cy-30,width:76,height:60,rx:5,fill:"#4f7038"});
      for(let i=0;i<5;i++) oak(cx-30+rnd()*60,cy-22+rnd()*44,5+rnd()*4,"#2f4a26","#456a35");
      continue;
    }
    const w=cw-24, h=ch-22;
    X.slab(cx,cy,w,h,pal[(rnd()*pal.length)|0],"#3f3a35",{rx:2,win:true,lit:"#f7d98a",litRate:.22});
    // setback upper storeys
    if(rnd()>.4){
      X.slab(cx,cy-h*.34,w*.62,h*.5,pal[(rnd()*pal.length)|0],"#3f3a35",{rx:2});
      if(rnd()>.5) add("rect",{x:cx-2,y:cy-h*.34-h*.42,width:4,height:14,fill:"#4c4640"});
    }
    // water tank
    if(rnd()>.45){ const tx=cx+w*.28, ty=cy-h*.36;
      add("rect",{x:tx-5,y:ty-9,width:10,height:10,rx:1.5,fill:"#7a5a3c"});
      add("path",{d:`M ${tx-6} ${ty-9} l 6 -5 l 6 5 Z`,fill:"#5c4530"});
      add("rect",{x:tx-4,y:ty+1,width:2,height:5,fill:"#4a4038"});
      add("rect",{x:tx+2,y:ty+1,width:2,height:5,fill:"#4a4038"}); }
  }
  // avenue lamps + yellow cabs parked kerbside
  scatter(22,34,(x,y)=>{
    add("ellipse",{cx:x,cy:y+6,rx:13,ry:8,fill:"#f7d98a",opacity:.13});
    add("line",{x1:x,y1:y+6,x2:x,y2:y-12,stroke:"#565c64","stroke-width":1.7});
    add("circle",{cx:x,cy:y-13,r:2.1,fill:"#ffe9b0"});
  },{pad:2});
  scatter(10,38,(x,y)=>{ const a=rnd()*180;
    const t=`rotate(${a.toFixed(0)} ${x} ${y})`;
    add("rect",{x:x-8,y:y-3.4,width:16,height:6.8,rx:2,fill:"#f0c02c",transform:t});
    add("rect",{x:x-3,y:y-3.4,width:6,height:6.8,fill:"#2b2d33",opacity:.7,transform:t}); });
};

})();
