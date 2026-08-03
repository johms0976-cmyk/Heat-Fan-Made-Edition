/* =====================================================================
   MODEL — cockpit_60s_hi   ·  the detailed driver's-seat view
   ---------------------------------------------------------------------
   Same eye-space frame as cockpit_60s (read that file first), but roughly
   ten times the geometry: a riveted aluminium dash carrying five
   instruments with tick marks, warning lamps, magneto toggles, a steering
   column and gear lever; mirrors on stalks; rolled coaming padding; a
   full front suspension with wishbones, coil-overs, tie rods, brake drums
   and knock-off spinners; and a riveted nose with a filler cap and strap.

   This is affordable because js/fpview-poly.js BAKES it.  The cockpit is
   static in eye space — only the horizon and the steer sway move it, and
   both are pure translations — so it is projected and filled once into an
   offscreen canvas, then blitted.  Detail costs bake time, not frame time.
   Live parts (needles, lamps, the car number, the wheel) go over the top.

   LAYOUT NOTE.  Every z here was solved against the projection rather than
   guessed, because a pinhole from the eye is unforgiving: screen height is
   horizon + |z|/y * focal.  With the horizon at 0.40H and focal 1.05H, the
   dash face at y=0.55 puts a given z at:

       z = -0.13  ->  0.65H        z = -0.235 ->  0.85H
       z = -0.205 ->  0.79H        z = -0.30  ->  0.97H

   so the instrument plane lives between z=-0.155 and z=-0.315 and nothing
   important sits below -0.30, or it falls off the bottom of the screen.
   Move anything and re-check it against that relation.

   Slots: body stripe tyre hub dark chrome glass plate lamp

   Requires js/poly.js.
   ===================================================================== */
"use strict";

(function(){

const EYE_H = 0.80;
const G  = -EYE_H;
const PA = [];                                   // parts accumulate here
const push = (...a) => PA.push(...a);
const both = fn => { fn(-1); fn(1); };           // mirror about the centreline

/* ------------------------------------------------------------ helpers */

/* A flat n-gon in the plane spanned by u and v.  One face each, so a
   hundred rivet heads cost a hundred polygons rather than a thousand. */
function stud(c, r, n, u, v, col, z){
  const p = [];
  for(let k=0;k<n;k++){
    const a = (k/n)*Math.PI*2, ca = Math.cos(a)*r, sa = Math.sin(a)*r;
    p.push([ c[0]+u[0]*ca+v[0]*sa, c[1]+u[1]*ca+v[1]*sa, c[2]+u[2]*ca+v[2]*sa ]);
  }
  return { k:"poly", c:col, z:z||0, p };
}

/* A run of rivets from a to b. */
function rivets(a, b, n, r, u, v, col, z){
  const out = [];
  for(let i=0;i<n;i++){
    const t = n === 1 ? 0.5 : i/(n-1);
    out.push(stud([a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t],
                  r, 6, u, v, col, z));
  }
  return out;
}

/* An instrument on the dash, facing the driver (normal along -Y).
   Depth order matters and smaller y is nearer the eye, so:
       ticks (cy-0.004) in front of bezel (cy-0.002) in front of face (cy). */
function dial(cx, cy, cz, r, ticks, z0){
  const U = [1,0,0], V = [0,0,1];
  const out = [
    stud([cx, cy, cz], r*0.86, 16, U, V, "dark", z0),
    { k:"ring", c:"chrome", axis:"y", at:[cx, cy-0.002, cz],
      r:r, ri:r*0.84, sides:16, open:true, z:z0+1 }
  ];
  for(let k=0;k<ticks;k++){
    const a  = -2.30 + (k/(ticks-1))*4.60;       // a real tach's sweep
    const ca = Math.sin(a), sa = -Math.cos(a);
    const r0 = r*0.58, r1 = r*0.78, w = r*0.05;
    out.push({ k:"quad", c:"plate", z:z0+2, p:[
      [cx+ca*r0-sa*w, cy-0.004, cz+sa*r0+ca*w],
      [cx+ca*r1-sa*w, cy-0.004, cz+sa*r1+ca*w],
      [cx+ca*r1+sa*w, cy-0.004, cz+sa*r1-ca*w],
      [cx+ca*r0+sa*w, cy-0.004, cz+sa*r0-ca*w] ]});
  }
  return out;
}


/* ======================================================== A · THE NOSE */

push(
  { k:"box", c:"body", at:[0, 1.45, G+0.44], size:[0.66, 1.80, 0.28],
    taper:{ f:[0.52, 0.55, -0.05], b:[1.02, 1.10, 0.02] } },

  { k:"box", c:"stripe", z:1, at:[0, 1.45, G+0.585], size:[0.13, 1.80, 0.02],
    taper:{ f:[0.56, 1, -0.083], b:[1.02, 1, 0.035] } },

  /* air intake at the tip: dark mouth in a chrome surround */
  { k:"ring", c:"chrome", z:2, axis:"y", at:[0, 2.33, G+0.40],
    r:0.100, ri:0.074, sides:12, open:true },
  stud([0, 2.335, G+0.40], 0.076, 12, [1,0,0], [0,0,1], "dark", 1),

  /* filler cap and its leather strap, offset left of the stripe */
  { k:"ring", c:"chrome", z:3, axis:"z", at:[-0.135, 1.06, G+0.556],
    r:0.050, ri:0.038, sides:12, open:true },
  stud([-0.135, 1.06, G+0.554], 0.040, 12, [1,0,0], [0,1,0], "hub", 2),
  { k:"box", c:"dark", z:2, at:[-0.135, 1.06, G+0.552], size:[0.022, 0.150, 0.006] }
);

/* three panel seams across the deck, each with a rivet line */
for(const [y, hw, deck] of [[0.92, 0.300, 0.566], [1.52, 0.245, 0.540],
                            [2.10, 0.185, 0.512]]){
  push({ k:"quad", c:"dark", z:2, p:[
    [-hw, y-0.008, G+deck], [hw, y-0.008, G+deck],
    [ hw, y+0.008, G+deck], [-hw, y+0.008, G+deck] ]});
  push(...rivets([-hw*0.94, y, G+deck+0.002], [hw*0.94, y, G+deck+0.002],
                 9, 0.011, [1,0,0], [0,1,0], "hub", 3));
}
/* two long rivet lines down the shoulders */
both(s => push(...rivets([s*0.300, 0.80, G+0.570], [s*0.150, 2.24, G+0.500],
                         14, 0.010, [1,0,0], [0,1,0], "hub", 3)));


/* ============================== B · FRONT SUSPENSION AND WHEELS ======= */
/* NOTE ON MIRRORING: every x must be written s*MAGNITUDE.  Writing
   s*(TR - s*0.115) looks symmetric and is not — on the left it ADDS. */

const AXY = 1.55, HZ = G + 0.30, TR = 0.72;

both(s => push(
  /* tyre — 16 sides now that the budget allows it */
  { k:"cyl", c:"tyre", capC:"tyre", axis:"x", sides:16, phase:0.20,
    at:[s*TR, AXY, HZ], r:0.30, len:0.24 },

  /* rim face and polished centre, set inboard of the tyre's outer wall */
  { k:"ring", c:"hub", z:1, axis:"x", at:[s*(TR-0.115), AXY, HZ],
    r:0.205, ri:0.086, sides:16, open:true },
  stud([s*(TR-0.122), AXY, HZ], 0.088, 12, [0,1,0], [0,0,1], "chrome", 2),

  /* knock-off spinner: hub cone plus three ears */
  { k:"cyl", c:"chrome", z:3, axis:"x", sides:8,
    at:[s*(TR-0.150), AXY, HZ], r:0.040, len:0.06 },
  { k:"box", c:"chrome", z:4, at:[s*(TR-0.170), AXY, HZ+0.052],
    size:[0.028, 0.026, 0.070] },
  { k:"box", c:"chrome", z:4, at:[s*(TR-0.170), AXY+0.047, HZ-0.028],
    size:[0.028, 0.070, 0.026] },
  { k:"box", c:"chrome", z:4, at:[s*(TR-0.170), AXY-0.047, HZ-0.028],
    size:[0.028, 0.070, 0.026] },

  /* brake drum, glimpsed through the rim */
  { k:"cyl", c:"dark", axis:"x", sides:12, at:[s*(TR+0.008), AXY, HZ],
    r:0.140, len:0.10 },

  /* upright */
  { k:"box", c:"chrome", at:[s*(TR-0.140), AXY, HZ], size:[0.05, 0.07, 0.28] },

  /* upper and lower wishbones, inboard to the tub */
  { k:"tube", c:"chrome", sides:6, r:0.017,
    path:[ [s*0.20, AXY-0.16, HZ+0.15], [s*(TR-0.16), AXY, HZ+0.13] ] },
  { k:"tube", c:"chrome", sides:6, r:0.017,
    path:[ [s*0.20, AXY+0.16, HZ+0.15], [s*(TR-0.16), AXY, HZ+0.13] ] },
  { k:"tube", c:"chrome", sides:6, r:0.020,
    path:[ [s*0.22, AXY-0.18, HZ-0.15], [s*(TR-0.16), AXY, HZ-0.13] ] },
  { k:"tube", c:"chrome", sides:6, r:0.020,
    path:[ [s*0.22, AXY+0.18, HZ-0.15], [s*(TR-0.16), AXY, HZ-0.13] ] },

  /* coil-over damper body */
  { k:"tube", c:"dark", sides:8, r:0.028,
    path:[ [s*0.34, AXY-0.02, HZ+0.30], [s*(TR-0.20), AXY, HZ-0.11] ] },

  /* steering tie rod, running back toward the rack */
  { k:"tube", c:"chrome", sides:6, r:0.014,
    path:[ [s*0.18, AXY-0.42, HZ-0.02], [s*(TR-0.17), AXY-0.09, HZ-0.02] ] }
));

/* spring coils around each damper — bands lerped along its axis */
both(s => {
  const a = [s*0.34, AXY-0.02, HZ+0.30], b = [s*(TR-0.20), AXY, HZ-0.11];
  for(let i=0;i<5;i++){
    const t = 0.16 + i*0.15;
    push({ k:"ring", c:"chrome", z:1, axis:"y", sides:8, open:true,
           r:0.045, ri:0.033,
           at:[ a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t ] });
  }
});


/* ==================================== C · SCUTTLE, DASH, INSTRUMENTS == */

const DY = 0.55;                                 // the dash face plane

push(
  /* scuttle.  Top edge runs 0.79H (near) to 0.66H (far) — the nose deck at
     0.56H therefore clears it, which is the whole point of the layout. */
  { k:"box", c:"body", z:1, at:[0, 0.44, -0.285], size:[0.64, 0.34, 0.33],
    taper:{ f:[0.94, 0.92, -0.02], b:[1.00, 1.00, 0.02] } },

  /* riveted aluminium instrument panel.  Held to z = -0.145 .. -0.280,
     i.e. 0.68H .. 0.93H — above the scuttle line and above the steering
     wheel hub at 0.86H, so nothing important hides behind the rim. */
  { k:"box", c:"hub", z:2, at:[0, DY+0.012, -0.212], size:[0.58, 0.022, 0.135] },

  /* aeroscreen frame, and the perspex itself at 30% — the bake canvas keeps
     per-pixel alpha, so this composites correctly over the road at blit */
  { k:"tube", c:"chrome", z:4, sides:6, r:0.010,
    path:[ [-0.215, 0.600, -0.168], [-0.140, 0.614, -0.116],
           [ 0.000, 0.620, -0.100],
           [ 0.140, 0.614, -0.116], [ 0.215, 0.600, -0.168] ] },
  { k:"quad", c:"glass", z:3, a:0.30, p:[
    [-0.215, 0.601, -0.168], [ 0.215, 0.601, -0.168],
    [ 0.215, 0.616, -0.108], [-0.215, 0.616, -0.108] ]},

  /* steering column, dash to wheel hub */
  { k:"tube", c:"dark", z:3, sides:8, r:0.024,
    path:[ [0, DY-0.005, -0.212], [0, 0.468, -0.204] ] }
);

/* panel rivets, top and bottom edges */
push(...rivets([-0.272, DY, -0.156], [0.272, DY, -0.156],
               15, 0.0080, [1,0,0], [0,0,1], "chrome", 4));
push(...rivets([-0.272, DY, -0.268], [0.272, DY, -0.268],
               15, 0.0080, [1,0,0], [0,0,1], "chrome", 4));

/* Instruments: one row, big tach centre, two pairs flanking it.  Radii and
   spacing solved so the rings never touch on screen —
     tach   outer 0.064W | inner pair 0.088..0.166W | outer pair 0.176..0.244W */
push(...dial( 0.000, DY, -0.212, 0.060, 13, 5));
both(s => push(...dial(s*0.118, DY, -0.212, 0.036, 9, 5)));
both(s => push(...dial(s*0.196, DY, -0.212, 0.032, 9, 5)));

/* four warning lamps, stacked in the gaps between the tach and the inner
   pair — the one strip of panel nothing else wants */
both(s => { for(const z of [-0.190, -0.234]){
  push({ k:"ring", c:"chrome", z:6, axis:"y", at:[s*0.072, DY-0.004, z],
         r:0.0105, ri:0.0074, sides:8, open:true });
  push(stud([s*0.072, DY-0.001, z], 0.0078, 8, [1,0,0], [0,0,1], "dark", 5));
}});

/* magneto and fuel-pump toggles, right of the gauges only — a real dash is
   not symmetric, and the asymmetry is worth keeping */
for(const z of [-0.180, -0.222, -0.264]){
  push({ k:"box", c:"chrome", z:6, at:[0.258, DY-0.002, z], size:[0.018, 0.012, 0.018] });
  push({ k:"tube", c:"dark", z:7, sides:5, r:0.0045,
         path:[ [0.258, DY-0.008, z], [0.258, DY-0.016, z+0.013] ] });
}

/* gear lever, right hand, canted back toward the driver */
push(
  { k:"tube", c:"chrome", z:4, sides:8, r:0.015,
    path:[ [0.312, 0.500, -0.420], [0.298, 0.470, -0.322],
           [0.288, 0.452, -0.250] ] },
  { k:"cyl", c:"dark", z:5, axis:"z", sides:10,
    at:[0.286, 0.448, -0.226], r:0.032, len:0.048 }
);

/* mirrors on stalks, outboard of the bodywork so they show against the road */
both(s => push(
  { k:"tube", c:"chrome", sides:6, r:0.010,
    path:[ [s*0.392, 0.592, -0.290], [s*0.400, 0.606, -0.208],
           [s*0.398, 0.616, -0.164] ] },
  { k:"ring", c:"chrome", z:2, axis:"y", at:[s*0.398, 0.622, -0.150],
    r:0.058, ri:0.047, sides:12, open:true },
  stud([s*0.398, 0.617, -0.150], 0.049, 12, [1,0,0], [0,0,1], "glass", 1)
));


/* ============================== D · COAMING AND TUB SIDES ============= */

both(s => push(
  /* tub flank, sweeping out of frame */
  /* Starts at y=0.32, not 0.28: the tube and box both add their own radius
     or half-depth, and anything that lands below the 0.18 near clamp gets
     DISTORTED rather than clipped.  Leave the margin. */
  { k:"box", c:"body", z:1, at:[s*0.370, 0.560, -0.270], size:[0.11, 0.52, 0.22],
    taper:{ f:[1, 0.88, -0.02], b:[1, 1.22, 0.05] } },

  /* rolled padding along the cockpit edge */
  { k:"tube", c:"dark", z:3, sides:7, r:0.028,
    path:[ [s*0.350, 0.340, -0.134], [s*0.356, 0.470, -0.160],
           [s*0.348, 0.590, -0.192], [s*0.322, 0.700, -0.222] ] },

  /* riveted seam down the flank */
  ...rivets([s*0.424, 0.360, -0.245], [s*0.404, 0.700, -0.330],
            9, 0.010, [0,1,0], [0,0,1], "hub", 4)
));


/* ---------------------------------------------------------------------- */
defineModel("cockpit_60s_hi", {
  width : 1.68,
  anchors : {
    /* needle pivots and lamp centres, projected live over the bake */
    tach   : [ 0.000, DY, -0.212 ],
    oil    : [-0.118, DY, -0.212 ],
    water  : [ 0.118, DY, -0.212 ],
    fuel   : [-0.196, DY, -0.212 ],
    volts  : [ 0.196, DY, -0.212 ],
    lamp0  : [-0.072, DY, -0.190 ],
    lamp1  : [-0.072, DY, -0.234 ],
    lamp2  : [ 0.072, DY, -0.190 ],
    lamp3  : [ 0.072, DY, -0.234 ],
    roundel: [ 0.000, 1.72,  G+0.523 ]
  },
  parts : PA
});

})();
