/* =====================================================================
   POLY — a tiny flat-shaded polygon rasteriser for canvas 2D.
   ---------------------------------------------------------------------
   No WebGL, no z-buffer, no build step. Painter's algorithm over filled
   paths, three shade bands per face, palette-slot colouring so one mesh
   serves every livery.  See STYLE.md for the rules this implements.

   Load order:   <script src="js/poly.js"></script>      ← first
                 <script src="js/models/*.js"></script>   ← then models

   Model authoring frame (right-handed, metres-ish):
       +X = the object's right
       +Y = forward (the direction it faces)
       +Z = up      (z = 0 is the ground / contact plane)

   A model is a list of primitives.  POLY.build() expands them once into
   {verts, faces} and caches the result on the model.

       defineModel("f1_60s", {
         width : 1.90,                       // overall X extent, for scaling
         anchors: { num:[0, 1.30, 0.66] },   // projected and handed back
         parts : [
           { k:"box", c:"body", at:[0,0.2,0.42], size:[0.72,3.0,0.44],
             taper:{ f:[0.35,0.55,-0.08], b:[0.85,0.90,0] } },
           { k:"cyl", c:"tyre", axis:"x", at:[-0.78,1.05,0.33], r:0.33,
             len:0.26, sides:8, capC:"hub" },
           { k:"quad", c:"stripe", p:[ [..],[..],[..],[..] ] }
         ]
       });

   Per-part options shared by every primitive:
       c     palette slot name, or {top,bot,left,right,front,back} for box
       z     sort bias: higher draws later (on top).  Default 0.
       d     detail flag: 1 = dropped from the far LOD.  Put it on anything
             that stops reading below ~60px — mirrors, exhausts, suspension.

   Why no backface culling: with closed primitives the back faces are
   overdrawn by the front ones anyway, and skipping the cull removes a
   whole class of winding bugs.  Cost is ~2x fill on ~150 tiny polygons,
   which is free.  Set POLY.cull = true if you ever need the fill rate.
   ===================================================================== */
"use strict";
(function(){

const POLY = window.POLY = {
  models  : Object.create(null),
  cull    : false,
  seam    : true,          // stroke each face in its own colour to kill hairlines
  bands   : [0.45, -0.05], // dot thresholds: above[0] = lit, above[1] = mid
  litMix  : 0.16,          // fraction toward white
  shadeMix: 0.34,          // fraction toward shadeInk
  shadeInk: [15, 13, 20],  // #0f0d14
  light   : [-0.45, -0.52, 0.72],  // direction TOWARD the sun, camera space
  build, draw, setSunSide, shadeOf
};

window.defineModel = function(name, def){ POLY.models[name] = def; return def; };

/* ---------------------------------------------------------------- colour */
const CMIX = new Map();
function parseHex(h){
  const m = /^#?([0-9a-f]{6})$/i.exec(h||"");
  if(!m) return [136,136,136];
  const n = parseInt(m[1],16);
  return [n>>16, (n>>8)&255, n&255];
}
/* band 0 = shade, 1 = mid, 2 = lit */
function shadeOf(hex, band){
  const key = hex + "|" + band;
  const hit = CMIX.get(key); if(hit) return hit;
  const c = parseHex(hex);
  let out;
  if(band === 1) out = hex;
  else if(band === 2){
    const t = POLY.litMix;
    out = rgb(c[0]+(255-c[0])*t, c[1]+(255-c[1])*t, c[2]+(255-c[2])*t);
  }else{
    const t = POLY.shadeMix, k = POLY.shadeInk;
    out = rgb(c[0]+(k[0]-c[0])*t, c[1]+(k[1]-c[1])*t, c[2]+(k[2]-c[2])*t);
  }
  if(CMIX.size > 900) CMIX.clear();
  CMIX.set(key, out);
  return out;
}
function rgb(r,g,b){
  return "#" + ((1<<24) | (r&255|0)<<16 | (g&255|0)<<8 | (b&255|0))
                 .toString(16).slice(1);
}

/* keep the polygon sun agreeing with the sky's sun.  side is -1..1, the
   value fpview already computes in LIGHT.side. */
function setSunSide(side){
  const s = Math.max(-1, Math.min(1, side || 0));
  const L = POLY.light;
  L[0] = -0.62 * s;            // sun on the right -> light comes from the right
  L[1] = -0.52;
  L[2] = 0.72;
  const m = Math.hypot(L[0], L[1], L[2]) || 1;
  L[0]/=m; L[1]/=m; L[2]/=m;
}
setSunSide(0);

/* ------------------------------------------------------------ primitives */
/* Every builder pushes into a shared vert array and emits faces as index
   lists.  Faces carry the palette slot, not a colour. */

function pushV(V, x, y, z){ V.push(x, y, z); return (V.length/3) - 1; }

function slot(c, face){
  if(c == null) return "body";
  if(typeof c === "string") return c;
  return c[face] || c.side || c.all || "body";
}

/* box with independent front (+Y) and back (-Y) end scaling.
   taper.f / taper.b = [widthScale, heightScale, zOffset] */
function buildBox(V, F, p){
  const at = p.at || [0,0,0], sz = p.size || [1,1,1];
  const hw = sz[0]/2, hl = sz[1]/2, hh = sz[2]/2;
  const tf = (p.taper && p.taper.f) || [1,1,0];
  const tb = (p.taper && p.taper.b) || [1,1,0];
  const end = (sign, t) => {
    const w = hw*t[0], h = hh*t[1], dz = (t[2]||0);
    const y = at[1] + sign*hl;
    return [
      pushV(V, at[0]-w, y, at[2]-h+dz),
      pushV(V, at[0]+w, y, at[2]-h+dz),
      pushV(V, at[0]+w, y, at[2]+h+dz),
      pushV(V, at[0]-w, y, at[2]+h+dz)
    ];
  };
  const b = end(-1, tb), f = end(+1, tf);   // [bl, br, tr, tl] at each end
  const z = p.z || 0;
  F.push({ i:[b[0],b[1],b[2],b[3]], c:slot(p.c,"back"),  z });
  F.push({ i:[f[0],f[1],f[2],f[3]], c:slot(p.c,"front"), z });
  F.push({ i:[b[3],b[2],f[2],f[3]], c:slot(p.c,"top"),   z });
  F.push({ i:[b[0],b[1],f[1],f[0]], c:slot(p.c,"bot"),   z });
  F.push({ i:[b[0],b[3],f[3],f[0]], c:slot(p.c,"left"),  z });
  F.push({ i:[b[1],b[2],f[2],f[1]], c:slot(p.c,"right"), z });
}

/* n-gon prism.  axis "x" | "y" | "z"; the ring lives in the other two. */
function buildCyl(V, F, p){
  const at = p.at || [0,0,0];
  const r = p.r != null ? p.r : 0.3;
  const len = p.len != null ? p.len : 0.3;
  const n = Math.max(3, p.sides || 8);
  const ax = p.axis || "x";
  const phase = (p.phase || 0);
  const ai = ax === "x" ? 0 : ax === "y" ? 1 : 2;
  const u  = ai === 0 ? 1 : 0;              // the two ring axes
  const w  = ai === 2 ? 1 : 2;
  const ringA = [], ringB = [];
  for(let k=0;k<n;k++){
    const a = phase + (k/n)*Math.PI*2;
    const c = [at[0], at[1], at[2]];
    c[u] = at[u] + Math.cos(a)*r;
    c[w] = at[w] + Math.sin(a)*r;
    c[ai] = at[ai] - len/2; ringA.push(pushV(V, c[0], c[1], c[2]));
    c[ai] = at[ai] + len/2; ringB.push(pushV(V, c[0], c[1], c[2]));
  }
  const z = p.z || 0, sc = slot(p.c,"side"), cc = p.capC || sc;
  for(let k=0;k<n;k++){
    const j = (k+1)%n;
    F.push({ i:[ringA[k], ringA[j], ringB[j], ringB[k]], c:sc, z });
  }
  F.push({ i:ringA.slice(), c:cc, z });
  F.push({ i:ringB.slice(), c:cc, z });
}

/* explicit polygon: p.p = [[x,y,z], ...] in order */
function buildPoly(V, F, p){
  const idx = p.p.map(v => pushV(V, v[0], v[1], v[2]));
  F.push({ i:idx, c:slot(p.c,"all"), z:p.z || 0 });
}

const BUILDERS = { box:buildBox, cyl:buildCyl, quad:buildPoly, tri:buildPoly, poly:buildPoly };

/* far = true builds the reduced mesh, skipping every part marked d:1.
   Both variants are cached on the model, so this costs nothing per frame. */
function build(model, far){
  if(typeof model === "string") model = POLY.models[model];
  if(!model) return null;
  const key = far ? "_meshFar" : "_mesh";
  if(model[key]) return model[key];
  const V = [], F = [];
  for(const part of (model.parts || [])){
    if(far && part.d) continue;
    const fn = BUILDERS[part.k];
    if(fn) fn(V, F, part);
  }
  model[key] = {
    verts   : Float32Array.from(V),
    faces   : F,
    width   : model.width || 1,
    anchors : model.anchors || null
  };
  return model[key];
}

/* ----------------------------------------------------------------- draw */
/* scratch buffers, grown on demand — no per-frame allocation */
let SX = new Float32Array(0), SY = new Float32Array(0);          // screen px
let AX = new Float32Array(0), AY = new Float32Array(0), AZ = new Float32Array(0);
let ORD = [];
function grow(n){
  if(SX.length >= n) return;
  SX = new Float32Array(n); SY = new Float32Array(n);
  AX = new Float32Array(n); AY = new Float32Array(n); AZ = new Float32Array(n);
}

/*  POLY.draw(g, model, o)

    Common:
      pal      { slot: "#hex", ... }        required
      alpha    0..1                          default 1
      yaw      radians about Z (object heading relative to viewer)

    mode "sprite"  — anchored billboard-with-depth.  Use for cars in world.
      x, y     screen anchor; the model's z=0 plane lands here
      scale    screen px per model unit  (or pass `w` = desired screen width)
      pitch    radians; viewer looks down on the object by this much
      persp    0..0.3 mild vanishing, default 0.06
      far      true = use the reduced LOD (drops parts marked d:1)

    mode "persp"   — true perspective from an eye at the origin looking +Y.
      cx, horizon, focal                     match fpview's projector
      at       [x,y,z] translate the model into eye space
      tiltX    radians about X, applied after yaw
      near     clamp, default 0.22

    Returns { anchors:{name:{x,y,s}}, faces:n } or null.            */
function draw(g, model, o){
  const mesh = build(model, o.far);
  if(!mesh) return null;
  const V = mesh.verts, F = mesh.faces, n = V.length/3;
  grow(n);

  const pal   = o.pal || {};
  const yaw   = o.yaw || 0;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const persp = o.mode === "persp";

  let scale = o.scale;
  if(scale == null && o.w != null) scale = o.w / (mesh.width || 1);
  if(scale == null) scale = 1;

  const pitch = o.pitch || 0, cp = Math.cos(pitch), sp = Math.sin(pitch);
  const tilt  = o.tiltX || 0, ct = Math.cos(tilt), st = Math.sin(tilt);
  const pk    = o.persp != null ? o.persp : 0.06;
  const at    = o.at || [0,0,0];
  const near  = o.near != null ? o.near : 0.22;

  /* --- transform + project every vertex --- */
  for(let k=0;k<n;k++){
    let x = V[k*3], y = V[k*3+1], z = V[k*3+2];
    /* yaw about Z */
    let ax = x*cy - y*sy, ay = x*sy + y*cy, az = z;
    /* tilt about X (persp mode: e.g. a steering wheel leaning back) */
    if(tilt){ const t = ay*ct - az*st; az = ay*st + az*ct; ay = t; }
    if(persp){
      ax += at[0]; ay += at[1]; az += at[2];
      const d = ay < near ? near : ay;
      const s = o.focal / d;
      SX[k] = o.cx + ax*s;
      SY[k] = o.horizon - az*s;
    }else{
      /* camera pitch about X: viewer tipped down toward the object */
      const t = ay*cp - az*sp; az = ay*sp + az*cp; ay = t;
      const q = 1 / (1 + ay*pk);
      SX[k] = o.x + ax*scale*q;
      SY[k] = o.y - az*scale*q;
    }
    /* keep camera space too — normals must be built here, not from pixels */
    AX[k] = ax; AY[k] = ay; AZ[k] = az;
  }

  /* --- depth-sort faces (mean camera-space depth, plus the z bias) --- */
  const nf = F.length;
  if(ORD.length !== nf){ ORD = new Array(nf); }
  for(let f=0; f<nf; f++){
    const idx = F[f].i;
    let d = 0;
    for(let j=0;j<idx.length;j++) d += AY[idx[j]];
    ORD[f] = { f, d: d/idx.length - (F[f].z||0)*1e3 };
  }
  ORD.sort((a,b) => b.d - a.d);

  /* --- fill, back to front --- */
  const L = POLY.light, b0 = POLY.bands[0], b1 = POLY.bands[1];
  const seam = POLY.seam;
  g.save();
  if(o.alpha != null && o.alpha < 1) g.globalAlpha *= o.alpha;
  g.lineJoin = "round";
  if(seam) g.lineWidth = 1;

  let drawn = 0;
  for(let s=0; s<nf; s++){
    const face = F[ORD[s].f], idx = face.i, m = idx.length;

    /* Camera-space normal.  Frame is (x = right, y = depth away, z = up),
       which is the frame POLY.light is expressed in.

       The normal is then ORIENTED TOWARD THE VIEWER before shading.  That
       makes the result independent of face winding — whichever side of a
       surface you can actually see gets a sensible normal — so a builder
       emitting a quad "backwards" can never produce a black facet. */
    const i0 = idx[0], i1 = idx[1], i2 = idx[2];
    const e1x = AX[i1]-AX[i0], e1y = AY[i1]-AY[i0], e1z = AZ[i1]-AZ[i0];
    const e2x = AX[i2]-AX[i0], e2y = AY[i2]-AY[i0], e2z = AZ[i2]-AZ[i0];
    let nx = e1y*e2z - e1z*e2y;
    let ny = e1z*e2x - e1x*e2z;
    let nz = e1x*e2y - e1y*e2x;
    const nm = Math.hypot(nx, ny, nz);
    let dot = 0;
    if(nm > 1e-9){
      nx/=nm; ny/=nm; nz/=nm;
      /* view vector to the face: the centroid in persp mode (eye at the
         origin), or simply +Y in sprite mode (near enough to orthographic) */
      let vx = 0, vy = 1, vz = 0;
      if(persp){
        vx = (AX[i0]+AX[i1]+AX[i2])/3;
        vy = (AY[i0]+AY[i1]+AY[i2])/3;
        vz = (AZ[i0]+AZ[i1]+AZ[i2])/3;
      }
      const facing = nx*vx + ny*vy + nz*vz;
      if(facing > 0){
        if(POLY.cull) continue;          // pointing away — skip it entirely
        nx = -nx; ny = -ny; nz = -nz;    // otherwise turn it to face us
      }
      dot = nx*L[0] + ny*L[1] + nz*L[2];
    }

    const band = dot > b0 ? 2 : dot > b1 ? 1 : 0;
    const base = pal[face.c] || pal.body || "#888888";
    const col  = shadeOf(base, band);

    g.beginPath();
    g.moveTo(SX[i0], SY[i0]);
    for(let j=1;j<m;j++) g.lineTo(SX[idx[j]], SY[idx[j]]);
    g.closePath();
    g.fillStyle = col; g.fill();
    if(seam){ g.strokeStyle = col; g.stroke(); }
    drawn++;
  }
  g.restore();

  /* --- project any anchors the caller asked for --- */
  let out = null;
  if(mesh.anchors){
    out = {};
    for(const key in mesh.anchors){
      const a = mesh.anchors[key];
      let ax = a[0]*cy - a[1]*sy, ay = a[0]*sy + a[1]*cy, az = a[2];
      if(tilt){ const t = ay*ct - az*st; az = ay*st + az*ct; ay = t; }
      if(persp){
        ax += at[0]; ay += at[1]; az += at[2];
        const d = ay < near ? near : ay, s = o.focal/d;
        out[key] = { x:o.cx + ax*s, y:o.horizon - az*s, s:s, z:ay };
      }else{
        const t = ay*cp - az*sp; az = ay*sp + az*cp; ay = t;
        const q = 1/(1 + ay*pk);
        out[key] = { x:o.x + ax*scale*q, y:o.y - az*scale*q, s:scale*q, z:ay };
      }
    }
  }
  return { anchors:out, faces:drawn };
}

})();
