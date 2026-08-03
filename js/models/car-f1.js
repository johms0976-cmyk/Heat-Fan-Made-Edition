/* =====================================================================
   MODEL — f1_60s   ·  the rival / opponent car
   ---------------------------------------------------------------------
   A cigar-bodied 1960s Grand Prix car to match the game's card art:
   exposed wheels, no wings, centre stripe, roll hoop, open cockpit.

   Frame:  +X right   +Y forward (nose)   +Z up   z=0 is the contact patch
   Units:  metres.  Overall track width 1.90, length ~4.0.

   ~140 faces.  Every colour is a palette SLOT, so one mesh serves all ten
   liveries — see STYLE.md §4.  Slots used here:
       body stripe tyre hub dark chrome glass helm plate

   Requires js/poly.js (for defineModel).
   ===================================================================== */
"use strict";

defineModel("f1_60s", {

  width : 1.90,                    // X extent incl. tyres — used for scaling

  anchors : {
    num  : [ 0, -0.72,  0.82 ],    // roundel on the engine cover, seen from behind
    tail : [ 0, -1.62,  0.50 ]     // brake-light bar
  },

  parts : [

    /* ---------------- wheels ---------------- */
    /* 8-sided.  Never more — see the polygon budget. */
    { k:"cyl", c:"tyre", capC:"hub", axis:"x", sides:8, phase:0.39,
      at:[-0.74, -0.98, 0.35], r:0.35, len:0.36 },
    { k:"cyl", c:"tyre", capC:"hub", axis:"x", sides:8, phase:0.39,
      at:[ 0.74, -0.98, 0.35], r:0.35, len:0.36 },
    { k:"cyl", c:"tyre", capC:"hub", axis:"x", sides:8, phase:0.39,
      at:[-0.70,  1.24, 0.30], r:0.30, len:0.24 },
    { k:"cyl", c:"tyre", capC:"hub", axis:"x", sides:8, phase:0.39,
      at:[ 0.70,  1.24, 0.30], r:0.30, len:0.24 },

    /* ---------------- suspension ----------------
       d:1 throughout this block — none of it reads below ~60px, and the
       far LOD saves about 60 faces a car. */
    { k:"box", c:"chrome", d:1, at:[-0.44,  1.20, 0.26], size:[0.52, 0.06, 0.05] },
    { k:"box", c:"chrome", d:1, at:[ 0.44,  1.20, 0.26], size:[0.52, 0.06, 0.05] },
    { k:"box", c:"chrome", d:1, at:[-0.46, -0.98, 0.30], size:[0.50, 0.07, 0.06] },
    { k:"box", c:"chrome", d:1, at:[ 0.46, -0.98, 0.30], size:[0.50, 0.07, 0.06] },

    /* ---------------- main tub ----------------
       Tapers narrow and low toward the nose, broad and tall at the bulkhead. */
    { k:"box", c:"body", at:[0, 0.15, 0.42], size:[0.64, 2.50, 0.46],
      taper:{ f:[0.52, 0.60, -0.06], b:[0.88, 0.96, 0.01] } },

    /* nose cone */
    { k:"box", c:"body", at:[0, 1.72, 0.34], size:[0.34, 1.10, 0.28],
      taper:{ f:[0.44, 0.52, -0.04], b:[1.00, 1.05, 0.02] } },

    /* engine cover behind the driver */
    { k:"box", c:"body", at:[0, -0.92, 0.60], size:[0.58, 0.96, 0.36],
      taper:{ f:[0.94, 0.90, 0.01], b:[0.66, 0.52, -0.06] } },

    /* ---------------- centre stripe ----------------
       Two segments, each shadowing its parent's taper, floated 15mm proud. */
    { k:"box", c:"stripe", z:1, at:[0, 0.15, 0.655], size:[0.13, 2.50, 0.02],
      taper:{ f:[0.62, 1, -0.075], b:[0.92, 1, 0.015] } },
    { k:"box", c:"stripe", z:1, at:[0, 1.72, 0.495], size:[0.10, 1.10, 0.02],
      taper:{ f:[0.50, 1, -0.055], b:[1.00, 1, 0.03] } },

    /* ---------------- cockpit ---------------- */
    /* the opening: a dark inset laid into the tub's top face */
    { k:"box", c:"dark", z:2, at:[0, 0.10, 0.655], size:[0.44, 0.66, 0.05] },
    /* coaming lip around it */
    { k:"box", c:"body", z:1, at:[-0.26, 0.10, 0.66], size:[0.09, 0.70, 0.07] },
    { k:"box", c:"body", z:1, at:[ 0.26, 0.10, 0.66], size:[0.09, 0.70, 0.07] },

    /* aeroscreen frame */
    { k:"box", c:"chrome", z:2, d:1, at:[0, 0.46, 0.74], size:[0.40, 0.03, 0.13],
      taper:{ f:[1,1,0], b:[1,1,0] } },

    /* driver: helmet + visor */
    { k:"box", c:"helm", z:2, at:[0, -0.10, 0.84], size:[0.27, 0.30, 0.26],
      taper:{ f:[0.90, 0.86, -0.01], b:[0.92, 0.92, 0] } },
    { k:"box", c:"glass", z:3, d:1, at:[0, 0.03, 0.86], size:[0.22, 0.06, 0.09] },

    /* roll hoop */
    { k:"box", c:"chrome", z:1, at:[0, -0.34, 0.86], size:[0.36, 0.07, 0.30],
      taper:{ f:[1,1,0], b:[1,1,0] } },

    /* ---------------- mirrors ---------------- */
    { k:"box", c:"chrome", d:1, at:[-0.34, 0.56, 0.70], size:[0.11, 0.05, 0.08] },
    { k:"box", c:"chrome", d:1, at:[ 0.34, 0.56, 0.70], size:[0.11, 0.05, 0.08] },

    /* ---------------- exhausts ---------------- */
    { k:"cyl", c:"chrome", d:1, axis:"y", sides:6, at:[-0.20, -1.52, 0.50],
      r:0.055, len:0.72 },
    { k:"cyl", c:"chrome", d:1, axis:"y", sides:6, at:[ 0.20, -1.52, 0.50],
      r:0.055, len:0.72 },

    /* rear panel — reads as the tail when you're behind the car */
    { k:"box", c:"dark", z:1, at:[0, -1.40, 0.44], size:[0.44, 0.06, 0.26] }
  ]
});
