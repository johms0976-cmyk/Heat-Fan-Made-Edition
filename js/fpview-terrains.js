/* =====================================================================
   FPVIEW-TERRAINS — destination-terrain expansion pack       (drop-in)
   ---------------------------------------------------------------------
   Loads AFTER js/fpview.js:

       <script src="js/fpview.js"></script>
       <script src="js/fpview-terrains.js"></script>

   Adds 7 new TRACK.terrain values to the cockpit cam:

       forest    — Ardennes / Eifel pinewood: hazed double conifer
                   ridge, mist band, dense pines & rocks (spa, germany)
       coast     — North-Sea dunes: flat sea horizon with sails,
                   marram foredunes, dune grass, a lighthouse (zandvoort)
       holland   — polder: table-flat land, smock mills & church
                   spires on the dyke, tulip strips, canal posts (dutch)
       vineyard  — French wine country: golden hills (tuscany
                   silhouette, cooler palette), trellised vines,
                   poplars, a slate-turreted château (france)
       mexico    — high desert: one great snow-capped volcano
                   (reuses the Fuji cone painter), agaves, adobe
                   casas, dry brush (mexico)
       aotearoa  — NZ pastoral: soft green hills, grazing sheep,
                   ponga tree ferns, fence posts (pukekohe)
       nyc       — big-city waterfront: tall lit skyline with
                   spires, a suspension bridge, Lady Liberty on her
                   island (newyork)

   Everything hooks the same three extension points fpview exposes at
   global scope: the FP_TERRAIN catalogue (mutated), drawSilhouette
   (wrapped — new sil kinds handled here, everything else falls through
   to the original) and drawProp (wrapped the same way). If fpview.js
   isn't loaded first, this file logs a warning and does nothing.
   ===================================================================== */
"use strict";

(function(){
if (typeof FP_TERRAIN === "undefined" || typeof drawSilhouette !== "function" ||
    typeof drawProp !== "function" || typeof scatterProps !== "function"){
  console.warn("[fpview-terrains] fpview.js not found — load fpview.js first.");
  return;
}

/* =====================================================================
   1 · NEW TERRAIN CATALOGUE ENTRIES
   sky:[top,mid,low] dusk gradient · sun rgb · ground:[far,near] ·
   elev multiplier · props:[kind,weight] · sil painter + colours
   ===================================================================== */
Object.assign(FP_TERRAIN, {

  forest:   { sky:["#0f1622","#223a44","#3f6156"], sun:"228,240,230",   // Ardennes pinewood
              ground:["#22331e","#2d4227"], elev:1.45,
              props:[["pine",5],["rock",1],["bush",1.5]],
              sil:{kind:"pinewood", col:"#152218", mist:"rgba(180,205,200,.16)"} },

  coast:    { sky:["#141a2e","#3c4a6e","#7a86a0"], sun:"244,240,224",   // North-Sea dunes
              ground:["#8a7c54","#a6996a"], elev:0.7,
              props:[["dunegrass",4],["post",1],["parasol",0.5],["lighth",0.2]],
              sil:{kind:"sea", col:"#1c2438", sea:"#2a3b58", sail:"#e8e2d2"} },

  holland:  { sky:["#181630","#4a3a62","#8a6a80"], sun:"250,236,208",   // tulip polder
              ground:["#2a3c22","#3a4e2c"], elev:0.3,
              props:[["tulip",4],["dutchmill",0.8],["post",1.5],["tree",1]],
              sil:{kind:"polder", col:"#20242e"} },

  vineyard: { sky:["#221430","#6e3a52","#c9825a"], sun:"255,222,168",   // French wine country
              ground:["#4a4426","#5e5630"], elev:0.9,
              props:[["vine",4],["poplar",2],["chateau",0.5],["bale",0.8]],
              sil:{kind:"tuscany", col:"#33203a", prop:"#241830"} },

  mexico:   { sky:["#26102e","#7e2e48","#d9784a"], sun:"255,198,130",   // volcano high desert
              ground:["#755a32","#94743e"], elev:0.8,
              props:[["agave",3],["casa",1],["drybush",2],["rock",1]],
              sil:{kind:"fuji", col:"#3a1e2e", snow:"rgba(244,236,238,.9)"} },

  aotearoa: { sky:["#12202c","#2a4a4e","#4f7a62"], sun:"240,246,228",   // NZ pastoral
              ground:["#28421f","#35552a"], elev:1.0,
              props:[["sheep",3],["treefern",2],["tree",1.5],["post",1.5]],
              sil:{kind:"hills", col:"#1c3026"} },

  nyc:      { sky:["#0a0d1e","#1c2340","#333e60"], sun:"214,224,255",   // skyline + bridge
              ground:["#25262c","#36373d"], elev:0.3,
              props:[["lamp",4],["towerblk",1.2],["block",1],["panel",1]],
              sil:{kind:"nyc", col:"#10152a", win:"rgba(255,206,120,.75)",
                   cable:"#2a3452"} }
});

/* =====================================================================
   2 · NEW HORIZON SILHOUETTES — wrap drawSilhouette
   New kinds handled here; anything else falls through to the original.
   (mexico reuses "fuji", aotearoa "hills", vineyard "tuscany" — those
   painters already live in fpview.js.)
   ===================================================================== */
const _sil = drawSilhouette;
drawSilhouette = function(hz, TT){
  const sil = TT.sil, head = FP.cam.head;

  if(sil.kind === "pinewood"){                          // double conifer ridge + mist
    ctx.fillStyle = sil.col;
    ctx.globalAlpha = 0.5;                              // far ridge, hazed
    ctx.beginPath(); ctx.moveTo(0, hz);
    for(let x=0; x<=W; x+=10){
      const t = (x*0.011 - head*1.3);
      ctx.lineTo(x, hz - 15 - Math.abs(Math.sin(t)*13 + Math.sin(t*2.3+1.1)*6));
    }
    ctx.lineTo(W, hz); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    const R = 190, tw = 9;                              // near wall of tree tips
    const k0 = Math.floor((head*R)/tw) - 1, kN = k0 + Math.ceil(W/tw) + 2;
    ctx.beginPath(); ctx.moveTo(-2, hz);
    for(let k=k0; k<=kN; k++){
      const x = k*tw - head*R;
      const h = 9 + hsh(k*1.7)*13;
      ctx.lineTo(x, hz - h*0.35);
      ctx.lineTo(x + tw/2, hz - h);
      ctx.lineTo(x + tw, hz - h*0.35);
    }
    ctx.lineTo(W+2, hz); ctx.closePath(); ctx.fill();
    if(sil.mist){ ctx.fillStyle = sil.mist; ctx.fillRect(0, hz-14, W, 14); }
    return;
  }

  if(sil.kind === "sea"){                               // sea horizon + foredunes
    ctx.fillStyle = sil.sea || "#2a3b58";               // the water
    ctx.fillRect(0, hz-9, W, 9);
    ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, hz-9); ctx.lineTo(W, hz-9); ctx.stroke();
    scatterProps(hz, 150, (x, r)=>{                     // sails out on the water
      if(r < 0.35) return;
      const sh = 3 + r*4, sy = hz - 2 - r*6;
      ctx.fillStyle = sil.sail || "#e8e2d2";
      ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x, sy-sh);
      ctx.lineTo(x+sh*0.6, sy); ctx.closePath(); ctx.fill();
    });
    ctx.fillStyle = sil.col;                            // marram foredunes in front
    ctx.beginPath(); ctx.moveTo(0, hz);
    for(let x=0; x<=W; x+=12){
      const t = (x*0.010 - head*2.2);
      ctx.lineTo(x, hz - 3 - Math.abs(Math.sin(t)*8 + Math.sin(t*2.4+1.9)*4));
    }
    ctx.lineTo(W, hz); ctx.closePath(); ctx.fill();
    return;
  }

  if(sil.kind === "polder"){                            // flat polder, mills on the dyke
    ctx.fillStyle = sil.col;
    ctx.beginPath(); ctx.moveTo(0, hz);
    for(let x=0; x<=W; x+=16){
      const t = (x*0.006 - head*2.2);
      ctx.lineTo(x, hz - 2 - Math.abs(Math.sin(t)*3));
    }
    ctx.lineTo(W, hz); ctx.closePath(); ctx.fill();
    scatterProps(hz, 170, (x, r)=>{
      if(r < 0.30) return;
      if(r > 0.82){                                     // a church spire
        ctx.fillStyle = sil.col;
        ctx.fillRect(x-1.6, hz-14, 3.2, 14);
        ctx.beginPath(); ctx.moveTo(x-2.2, hz-14); ctx.lineTo(x, hz-20);
        ctx.lineTo(x+2.2, hz-14); ctx.closePath(); ctx.fill();
        return;
      }
      const th = 8 + r*7;                               // smock mill + sails
      ctx.fillStyle = sil.col;
      ctx.beginPath(); ctx.moveTo(x-3, hz); ctx.lineTo(x-1.7, hz-th);
      ctx.lineTo(x+1.7, hz-th); ctx.lineTo(x+3, hz); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = sil.col; ctx.lineWidth = 1.2;
      for(let s=0; s<4; s++){
        const a = r*6.28 + s*Math.PI/2;
        ctx.beginPath(); ctx.moveTo(x, hz-th);
        ctx.lineTo(x+Math.cos(a)*6, hz-th+Math.sin(a)*6); ctx.stroke();
      }
    });
    return;
  }

  if(sil.kind === "nyc"){                               // skyline · bridge · the Lady
    const R = 190, bw = 30;                             // skyscrapers, taller than "city"
    const k0 = Math.floor((head*R)/bw) - 1, kN = k0 + Math.ceil(W/bw) + 3;
    for(let k=k0; k<=kN; k++){
      const x = k*bw - head*R;
      if(x > W + bw || x < -bw*2) continue;
      const r = hsh(k);
      const bh = 22 + r*66, w2 = bw*(0.58 + hsh(k+9.7)*0.32);
      ctx.fillStyle = sil.col;
      ctx.fillRect(x, hz-bh, w2, bh);
      if(hsh(k+2.4) > 0.72){                            // deco spire
        ctx.beginPath(); ctx.moveTo(x+w2*0.30, hz-bh);
        ctx.lineTo(x+w2*0.5, hz-bh-10-r*8); ctx.lineTo(x+w2*0.70, hz-bh);
        ctx.closePath(); ctx.fill();
      }
      if(r > 0.3 && sil.win){                           // lit windows
        ctx.fillStyle = sil.win;
        const rows = 3 + Math.floor(r*5);
        for(let wy=0; wy<rows; wy++) for(let wx=0; wx<2; wx++){
          if(hsh(k*13.7 + wy*3.1 + wx) < 0.5) continue;
          ctx.fillRect(x + 4 + wx*(w2/2), hz - bh + 5 + wy*9, 2.6, 3.2);
        }
      }
    }
    /* suspension bridge + Liberty island on a slower belt, wrapping */
    const R2 = 110, span = W*2.4;
    const off = ((head*R2) % span + span) % span;
    const bx = ((W*0.15 - off) % span + span) % span - span*0.2;
    const bwid = W*0.6, ty = hz - 34;
    ctx.fillStyle = sil.col;
    for(const tx of [bx, bx+bwid]){                     // towers
      ctx.fillRect(tx-2.5, ty, 5, 34);
      ctx.fillRect(tx-4, ty+10, 8, 3);
    }
    ctx.strokeStyle = sil.cable || sil.col;
    ctx.lineWidth = 2;                                  // main cable
    ctx.beginPath(); ctx.moveTo(bx, ty);
    ctx.quadraticCurveTo(bx+bwid/2, hz-6, bx+bwid, ty); ctx.stroke();
    ctx.lineWidth = 2.4;                                // deck
    ctx.beginPath(); ctx.moveTo(bx, hz-10); ctx.lineTo(bx+bwid, hz-10); ctx.stroke();
    ctx.lineWidth = 1;                                  // suspenders
    for(let s=1; s<12; s++){
      const sx = bx + bwid*(s/12), q = 2*(s/12)-1;
      const cy = ty + (hz-8-ty)*(1-q*q);
      ctx.beginPath(); ctx.moveTo(sx, cy); ctx.lineTo(sx, hz-10); ctx.stroke();
    }
    const lx = ((W*0.85 - off*0.9) % span + span) % span - span*0.2;
    ctx.fillStyle = sil.col;                            // Lady Liberty
    ctx.fillRect(lx-4, hz-6, 8, 6);                     // pedestal
    ctx.fillRect(lx-1.4, hz-13, 2.8, 7);                // figure
    ctx.beginPath(); ctx.arc(lx, hz-14, 1.4, 0, 7); ctx.fill();
    ctx.strokeStyle = sil.col; ctx.lineWidth = 1.2;     // torch arm
    ctx.beginPath(); ctx.moveTo(lx+1, hz-13); ctx.lineTo(lx+3.4, hz-18); ctx.stroke();
    if(sil.win){ ctx.fillStyle = sil.win; ctx.fillRect(lx+2.6, hz-19.8, 1.7, 1.9); }
    return;
  }

  _sil(hz, TT);                                         // everything else — original
};

/* =====================================================================
   3 · NEW ROADSIDE PROPS — wrap drawProp
   (x,y) = base on the ground, u = screen px per world unit, r = variant
   ===================================================================== */
const _prop = drawProp;
drawProp = function(g, kind, x, y, u, r){
  switch(kind){

  case "agave":{                                  // spiky blue-green agave
    const aw = (2.6+r*1.6)*u;
    g.strokeStyle = r<.5 ? "#5f7d6a" : "#6f8d74";
    g.lineWidth = Math.max(1, 0.7*u); g.lineCap = "round";
    for(let k=0; k<7; k++){
      const a = -Math.PI*0.88 + k*(Math.PI*0.76/6);
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x+Math.cos(a)*aw*0.5, y+Math.sin(a)*aw*0.9,
                         x+Math.cos(a)*aw,     y+Math.sin(a)*aw*1.4);
      g.stroke();
    }
    if(r > 0.78){                                 // century-plant flower stalk
      g.beginPath(); g.moveTo(x, y-aw*0.4); g.lineTo(x, y-aw*2.6); g.stroke();
    }
    return; }

  case "sheep":{                                  // grazing sheep (sometimes two)
    const sw = 1.9*u;
    const one = (sx)=>{
      g.fillStyle = "#e9e6da";                    // fleece
      g.beginPath(); g.ellipse(sx, y-sw*0.75, sw, sw*0.62, 0, 0, 7); g.fill();
      g.fillStyle = "#2b2620";                    // head + legs
      g.beginPath(); g.arc(sx+sw*0.95, y-sw*0.85, sw*0.34, 0, 7); g.fill();
      g.fillRect(sx-sw*0.55, y-sw*0.3, sw*0.22, sw*0.35);
      g.fillRect(sx+sw*0.35, y-sw*0.3, sw*0.22, sw*0.35);
    };
    one(x); if(r > 0.55) one(x - sw*2.6);
    return; }

  case "treefern":{                               // ponga tree fern
    const th = (4.5+r*3)*u;
    g.strokeStyle = "#3a2e20"; g.lineWidth = Math.max(1, 0.9*u); g.lineCap = "round";
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y-th); g.stroke();
    g.strokeStyle = "#3f6b35"; g.lineWidth = Math.max(1, 0.6*u);
    for(let k=0; k<7; k++){                       // arching fronds
      const a = -Math.PI + k*(Math.PI/6);
      g.beginPath(); g.moveTo(x, y-th);
      g.quadraticCurveTo(x+Math.cos(a)*3.4*u, y-th+Math.sin(a)*2.0*u - 1.0*u,
                         x+Math.cos(a)*5.2*u, y-th+Math.sin(a)*3.2*u + 0.6*u);
      g.stroke();
    }
    return; }

  case "dunegrass":{                              // marram tuft
    g.strokeStyle = r<.5 ? "#9aa06a" : "#8a9660";
    g.lineWidth = Math.max(1, 0.4*u); g.lineCap = "round";
    for(let k=0; k<6; k++){
      const a = -Math.PI*0.5 + (k-2.5)*0.22 + (r-0.5)*0.2;
      const L = (2.4 + hsh(r*9+k)*1.8)*u;
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x+Math.cos(a)*L*0.4, y+Math.sin(a)*L*0.7,
                         x+Math.cos(a)*L*1.2, y+Math.sin(a)*L);
      g.stroke();
    }
    return; }

  case "tulip":{                                  // strip of tulips in bloom
    const cols = ["#d94a5a","#e8b23a","#c95fd0","#e8e2d2"];
    const col = cols[(r*cols.length)|0], n = 4 + Math.round(r*3);
    for(let k=0; k<n; k++){
      const tx = x + (k-(n-1)/2)*1.5*u, sh = (1.6 + hsh(r*7+k)*0.8)*u;
      g.strokeStyle = "#3f6b35"; g.lineWidth = Math.max(1, 0.3*u);
      g.beginPath(); g.moveTo(tx, y); g.lineTo(tx, y-sh); g.stroke();
      g.fillStyle = col;
      g.fillRect(tx-0.5*u, y-sh-0.9*u, 1.0*u, 1.0*u);
    }
    return; }

  case "vine":{                                   // trellised vine row, end-on
    const vh = (2.2+r*0.8)*u, n = 3 + Math.round(r*2);
    g.strokeStyle = "#5a4a34"; g.lineWidth = Math.max(1, 0.5*u);
    for(let k=0; k<n; k++){
      const vx = x + (k-(n-1)/2)*2.2*u;
      g.beginPath(); g.moveTo(vx, y); g.lineTo(vx, y-vh); g.stroke();
      g.fillStyle = r<.5 ? "#3f6b35" : "#4c7d46";
      g.beginPath(); g.arc(vx, y-vh, 1.15*u, 0, 7); g.fill();
    }
    g.strokeStyle = "#6a5a44"; g.lineWidth = Math.max(1, 0.3*u);
    g.beginPath();                                // trellis wire
    g.moveTo(x-(n-1)*1.1*u-1*u, y-vh*0.65);
    g.lineTo(x+(n-1)*1.1*u+1*u, y-vh*0.65); g.stroke();
    return; }

  case "poplar":{                                 // tall slim poplar
    const th = (9+r*4)*u, cw = Math.max(1.8, th*0.16);
    g.fillStyle = r<.5 ? "#3a5c30" : "#456b38";
    g.beginPath(); g.moveTo(x-cw/2, y);
    g.quadraticCurveTo(x-cw/2, y-th*0.72, x, y-th);
    g.quadraticCurveTo(x+cw/2, y-th*0.72, x+cw/2, y);
    g.closePath(); g.fill();
    return; }

  case "chateau":{                                // slate-turreted château
    const bw = (8+r*2.5)*u, bh = (4.5+r*1.2)*u;
    g.fillStyle = "#ddd5c2"; g.fillRect(x-bw/2, y-bh, bw, bh);
    g.fillStyle = "#3c4454";                      // slate roof
    g.beginPath(); g.moveTo(x-bw/2-0.6*u, y-bh); g.lineTo(x+bw/2+0.6*u, y-bh);
    g.lineTo(x, y-bh-2.2*u); g.closePath(); g.fill();
    for(const s of [-1,1]){                       // round turrets + cone caps
      const tx = x + s*bw/2;
      g.fillStyle = "#ddd5c2"; g.fillRect(tx-1.1*u, y-bh-1.2*u, 2.2*u, bh+1.2*u);
      g.fillStyle = "#3c4454";
      g.beginPath(); g.moveTo(tx-1.5*u, y-bh-1.2*u); g.lineTo(tx+1.5*u, y-bh-1.2*u);
      g.lineTo(tx, y-bh-3.6*u); g.closePath(); g.fill();
    }
    g.fillStyle = "#4a4436";                      // door
    g.fillRect(x-0.8*u, y-bh*0.6, 1.6*u, bh*0.6);
    return; }

  case "dutchmill":{                              // Dutch smock mill, sails turning
    const th = (5.5+r*1.5)*u;
    g.fillStyle = "#6a4f38";                      // tarred smock body
    g.beginPath(); g.moveTo(x-2.8*u, y); g.lineTo(x-1.5*u, y-th);
    g.lineTo(x+1.5*u, y-th); g.lineTo(x+2.8*u, y); g.closePath(); g.fill();
    g.fillStyle = "#8a7a4e";                      // thatched cap
    g.beginPath(); g.arc(x, y-th, 1.8*u, Math.PI, 0); g.fill();
    const spin = (typeof performance !== "undefined" ? performance.now() : 0)/2000 + r*7;
    g.strokeStyle = "#e0d8c4"; g.lineWidth = Math.max(1, 0.6*u);
    for(let s=0; s<4; s++){
      const a = spin + s*Math.PI/2;
      g.beginPath(); g.moveTo(x, y-th);
      g.lineTo(x+Math.cos(a)*5.2*u, y-th+Math.sin(a)*5.2*u); g.stroke();
    }
    return; }
  }

  _prop(g, kind, x, y, u, r);                     // everything else — original
};

console.log("[fpview-terrains] loaded — terrains:",
  "forest, coast, holland, vineyard, mexico, aotearoa, nyc");
})();
