/* =====================================================================
   MODELS — cockpit_60s  ·  wheel_60s
   ---------------------------------------------------------------------
   The driver's-seat furniture, authored in EYE SPACE:

       origin = the driver's eyes
       +X right   +Y forward   +Z up
       the road surface sits at z = -EYE_H

   Authoring in eye space rather than car space means the perspective
   projection needs no camera transform — the model IS already in camera
   coordinates, so it shares fpview's focal length and horizon directly.

   NOTE ON SCALE: a pinhole projection from the origin is scale-invariant,
   so multiplying this whole model by any constant changes NOTHING on
   screen.  Framing is controlled entirely by the proportions below —
   specifically by how far each part sits from the eye relative to EYE_H.
   If the hood looks too small, move the eye forward and down. Don't scale.

   Nothing is authored closer than y = 0.28, which is the near clamp.
   Anything at or behind the eye would blow up under the divide.

   Slots used: body stripe tyre hub dark chrome glove

   Requires js/poly.js.
   ===================================================================== */
"use strict";

(function(){

const EYE_H = 0.80;          // eyes above the tarmac, metres (a 60s F1 sits low)
const G = -EYE_H;            // the road plane, in eye space

/* ===================================================================
   COCKPIT SURROUND
   =================================================================== */
defineModel("cockpit_60s", {

  width : 1.68,
  anchors : { dial:[0, 0.50, -0.26] },

  parts : [

    /* ---------------- nose running away ahead ----------------
       Rear end tucks under the scuttle; the tip pinches and droops. */
    { k:"box", c:"body", at:[0, 1.55, G + 0.30], size:[0.58, 2.00, 0.30],
      taper:{ f:[0.40, 0.46, -0.07], b:[1.02, 1.10, 0.03] } },

    /* centre stripe, floated proud, shadowing the same pinch */
    { k:"box", c:"stripe", z:1, at:[0, 1.55, G + 0.452], size:[0.12, 2.00, 0.02],
      taper:{ f:[0.44, 1, -0.086], b:[1.02, 1, 0.04] } },

    /* ---------------- scuttle in front of the driver ---------------- */
    { k:"box", c:"body", z:1, at:[0, 0.46, -0.34], size:[0.66, 0.36, 0.32],
      taper:{ f:[0.90, 0.80, -0.04], b:[1.00, 1.00, 0.02] } },

    /* ---------------- coaming, sweeping out of frame either side ------------- */
    { k:"box", c:"body", z:1, at:[-0.37, 0.57, -0.24], size:[0.11, 0.58, 0.18],
      taper:{ f:[1, 0.90, -0.02], b:[1, 1.20, 0.05] } },
    { k:"box", c:"body", z:1, at:[ 0.37, 0.57, -0.24], size:[0.11, 0.58, 0.18],
      taper:{ f:[1, 0.90, -0.02], b:[1, 1.20, 0.05] } },

    /* ---------------- instruments ---------------- */
    { k:"box", c:"dark", z:2, at:[0, 0.52, -0.28], size:[0.50, 0.03, 0.17] },
    { k:"cyl", c:"hub",  z:3, axis:"y", sides:10, at:[ 0.00, 0.505, -0.26],
      r:0.058, len:0.02 },
    { k:"cyl", c:"hub",  z:3, axis:"y", sides:8,  at:[-0.16, 0.505, -0.28],
      r:0.036, len:0.02 },
    { k:"cyl", c:"hub",  z:3, axis:"y", sides:8,  at:[ 0.16, 0.505, -0.28],
      r:0.036, len:0.02 },

    /* aeroscreen frame across the top of the scuttle */
    { k:"box", c:"chrome", z:2, at:[0, 0.63, -0.15], size:[0.44, 0.03, 0.09] },

    /* ---------------- mirrors on stalks ---------------- */
    { k:"box", c:"chrome",      at:[-0.40, 0.62, -0.26], size:[0.035, 0.035, 0.13] },
    { k:"box", c:"chrome",      at:[ 0.40, 0.62, -0.26], size:[0.035, 0.035, 0.13] },
    { k:"box", c:"chrome", z:1, at:[-0.40, 0.62, -0.17], size:[0.13, 0.045, 0.09] },
    { k:"box", c:"chrome", z:1, at:[ 0.40, 0.62, -0.17], size:[0.13, 0.045, 0.09] },

    /* ---------------- front wheels + suspension ---------------- */
    { k:"cyl", c:"tyre", capC:"hub", axis:"x", sides:8, phase:0.39,
      at:[-0.72, 1.55, G + 0.30], r:0.30, len:0.24 },
    { k:"cyl", c:"tyre", capC:"hub", axis:"x", sides:8, phase:0.39,
      at:[ 0.72, 1.55, G + 0.30], r:0.30, len:0.24 },
    { k:"box", c:"chrome", at:[-0.47, 1.52, G + 0.24], size:[0.48, 0.05, 0.045] },
    { k:"box", c:"chrome", at:[ 0.47, 1.52, G + 0.24], size:[0.48, 0.05, 0.045] },
    { k:"box", c:"chrome", at:[-0.47, 1.52, G + 0.44], size:[0.48, 0.04, 0.035] },
    { k:"box", c:"chrome", at:[ 0.47, 1.52, G + 0.44], size:[0.48, 0.04, 0.035] }
  ]
});


/* ===================================================================
   STEERING WHEEL
   ---------------------------------------------------------------------
   Authored FACE-ON in the XY plane, hub at the origin, so the disc's own
   axis is +Z.  That makes POLY's `yaw` (rotation about Z) the steering
   spin for free; the caller then stands the wheel up with tiltX ≈ 90°
   and drops it into place with `at`.  POLY.draw applies yaw before tilt,
   which is exactly right: spin in the disc plane first, stand it up next.
   =================================================================== */
const SEG   = 12;                        // rim segments — polygon budget
const R_OUT = 0.200, R_IN = 0.170, TH = 0.030;

const parts = [];

/* rim: a driver-facing annulus band plus the outer edge */
for(let k=0; k<SEG; k++){
  const a0 = (k/SEG)*Math.PI*2, a1 = ((k+1)/SEG)*Math.PI*2;
  const c0 = Math.cos(a0), s0 = Math.sin(a0);
  const c1 = Math.cos(a1), s1 = Math.sin(a1);
  /* +Z ends up facing the driver once tiltX stands the disc upright:
     (x,y,z) -> (x, y·cos t - z·sin t, ...), so at t≈75° a +Z offset maps to
     a NEGATIVE y, i.e. toward the eye.  Front face is therefore +TH/2. */
  const f = TH/2, b = -TH/2;

  parts.push({ k:"quad", c:"dark", p:[
    [R_IN *c0, R_IN *s0, f], [R_OUT*c0, R_OUT*s0, f],
    [R_OUT*c1, R_OUT*s1, f], [R_IN *c1, R_IN *s1, f]
  ]});
  parts.push({ k:"quad", c:"dark", p:[
    [R_OUT*c0, R_OUT*s0, f], [R_OUT*c0, R_OUT*s0, b],
    [R_OUT*c1, R_OUT*s1, b], [R_OUT*c1, R_OUT*s1, f]
  ]});
}

/* three spokes: 9 o'clock, 3 o'clock, straight down */
for(const a of [Math.PI, 0, -Math.PI/2]){
  const c = Math.cos(a), s = Math.sin(a);
  const nx = -s, ny = c, w = 0.020, zf = 0.006;   // spokes on the driver's side
  parts.push({ k:"quad", c:"chrome", z:1, p:[
    [0.05*c + nx*w, 0.05*s + ny*w, zf],
    [R_IN*c + nx*w, R_IN*s + ny*w, zf],
    [R_IN*c - nx*w, R_IN*s - ny*w, zf],
    [0.05*c - nx*w, 0.05*s - ny*w, zf]
  ]});
}

/* boss */
parts.push({ k:"cyl", c:"dark", capC:"body", z:2, axis:"z", sides:8,
             at:[0,0,0], r:0.055, len:0.05 });

/* gloved hands at 9 and 3, cuffs in the car's colour */
for(const side of [-1, 1]){
  parts.push({ k:"box", c:"glove", z:3,
               at:[side*R_OUT, 0, 0.03], size:[0.090, 0.125, 0.105] });
  parts.push({ k:"box", c:"body", z:2,
               at:[side*(R_OUT + 0.058), -0.02, 0.01], size:[0.080, 0.100, 0.090] });
}

defineModel("wheel_60s", { width:R_OUT*2, anchors:{ boss:[0,0,0.04] }, parts });

})();
