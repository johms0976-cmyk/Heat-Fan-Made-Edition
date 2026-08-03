/* =====================================================================
   MODEL — f1_60s   ·  the rival / opponent car
   ---------------------------------------------------------------------
   A cigar-bodied 1960s Grand Prix car to match the game's card art:
   exposed wheels, no wings, centre stripe, roll hoop, open cockpit.

   Frame:  +X right   +Y forward (nose)   +Z up   z=0 is the contact patch
   Units:  metres.  Track 1.62 (rear), length 4.24.

   ~194 faces near, ~130 far.  Every colour is a palette SLOT, so one mesh
   serves all ten liveries — see STYLE.md §4.  Slots used here:
       body stripe tyre hub dark chrome glass helm plate

   Requires js/poly.js (for defineModel).

   ---------------------------------------------------------------------
   PROPORTION NOTE — read before editing any coordinate.

   The previous mesh was 4.15 long on a 1.90 track: a length:width of 2.18.
   A Lotus 49 is 2.7. Because `width` is what the renderer divides into
   CAR_W, a wide car is a car the renderer draws SHORT — every extra
   centimetre of track buys a centimetre off the apparent wheelbase. So the
   track came in (rear 1.62, front 1.52, both period-correct) rather than
   the length going out. On screen the car is exactly as wide as before and
   noticeably longer, and it still occupies the same road.

   Everything below is built off that decision. If you widen the track
   again, lengthen the body to match or it goes back to reading as a kart.
   ===================================================================== */
"use strict";

defineModel("f1_60s", {

  width : 1.62,                    // rear track incl. tyres — used for scaling

  anchors : {
    num  : [ 0, -0.78,  0.62 ],    // roundel on the engine deck, seen from behind
    tail : [ 0, -1.58,  0.42 ]     // brake-light bar
  },

  parts : [

    /* ---------------- wheels ----------------
       8-sided.  Never more — see the polygon budget.

       Rears are both fatter AND on a wider track than the fronts, which is
       what actually says "1968" at a glance; the old mesh had them nearly
       square to each other. Front 1.52 track / 0.28 section, rear 1.62 /
       0.42.

       phase is shared across all four so the octagon flats line up — four
       wheels facetted out of sync reads as an error, in sync it reads as a
       style. If the contact patch ever looks like it's balanced on a
       corner, nudge phase by half a facet (0.0625) rather than adding
       sides. */
    { k:"cyl", c:"tyre", capC:"hub", axis:"x", sides:8, phase:0.39,
      at:[-0.60, -1.00, 0.34], r:0.34, len:0.42 },
    { k:"cyl", c:"tyre", capC:"hub", axis:"x", sides:8, phase:0.39,
      at:[ 0.60, -1.00, 0.34], r:0.34, len:0.42 },
    { k:"cyl", c:"tyre", capC:"hub", axis:"x", sides:8, phase:0.39,
      at:[-0.62,  1.34, 0.30], r:0.30, len:0.28 },
    { k:"cyl", c:"tyre", capC:"hub", axis:"x", sides:8, phase:0.39,
      at:[ 0.62,  1.34, 0.30], r:0.30, len:0.28 },

    /* ---------------- suspension ----------------
       d:1 throughout — none of it reads below ~60px, and the far LOD saves
       about 60 faces a car.

       Still four bars, but thinner and now spanning the real gap: fronts
       sit low (wishbone height), rears sit at hub height where a driveshaft
       would be. Thin beats thick here — a fat bar reads as bodywork. */
    { k:"box", c:"chrome", d:1, at:[-0.44,  1.34, 0.24], size:[0.42, 0.06, 0.05] },
    { k:"box", c:"chrome", d:1, at:[ 0.44,  1.34, 0.24], size:[0.42, 0.06, 0.05] },
    { k:"box", c:"chrome", d:1, at:[-0.34, -1.00, 0.32], size:[0.46, 0.07, 0.055] },
    { k:"box", c:"chrome", d:1, at:[ 0.34, -1.00, 0.32], size:[0.46, 0.07, 0.055] },

    /* ================ body ================
       Was one box for the whole tub, which is why it read as a plank. It's
       three now, and the widths tell the story down the length:

           nose 0.18 → footwell 0.52 → cockpit 0.62 → engine 0.60 → tail 0.36

       That swell at the bulkhead and the pinch behind it is the cigar
       shape. Each section's `f` taper is set to land on the previous
       section's back face — if you move one, re-solve its neighbour or
       you'll get a visible step in the flank. */

    /* forward tub / footwell — low and narrow, feet-under-the-dash */
    { k:"box", c:"body", at:[0, 0.72, 0.38], size:[0.52, 0.86, 0.36],
      taper:{ f:[0.64, 0.74, -0.03], b:[1.00, 1.06, 0.02] } },

    /* nose cone — blunt oval, not a spike; the tip carries the intake */
    { k:"box", c:"body", at:[0, 1.72, 0.32], size:[0.34, 1.14, 0.28],
      taper:{ f:[0.52, 0.62, -0.02], b:[1.00, 1.02, 0.03] } },

    /* cockpit section — the widest, tallest part of the car */
    { k:"box", c:"body", at:[0, -0.06, 0.40], size:[0.62, 0.72, 0.46],
      taper:{ f:[0.86, 0.84, -0.01], b:[1.00, 1.00, 0.0] } },

    /* engine cover — falls away hard to the tail */
    { k:"box", c:"body", at:[0, -0.93, 0.44], size:[0.60, 1.02, 0.44],
      taper:{ f:[1.03, 1.05, -0.04], b:[0.60, 0.52, -0.05] } },

    /* ---------------- centre stripe ----------------
       Nose and footwell only. It stops at the screen, as it does on the
       card art, and the engine deck carries the roundel instead — two
       white marks in a row down the spine would fight each other.
       Each segment shadows its parent's taper and floats 15mm proud. */
    { k:"box", c:"stripe", z:1, at:[0, 1.72, 0.475], size:[0.11, 1.14, 0.02],
      taper:{ f:[0.55, 1, -0.073], b:[1.00, 1, 0.032] } },
    { k:"box", c:"stripe", z:1, at:[0, 0.72, 0.575], size:[0.13, 0.86, 0.02],
      taper:{ f:[0.64, 1, -0.077], b:[1.00, 1, 0.031] } },

    /* nose intake — a dark inset in the tip.
       Cheap, and it's the difference between a nose and a wedge at
       distance. Every car in the era had a hole here. */
    { k:"box", c:"dark", z:1, at:[0, 2.24, 0.30], size:[0.15, 0.07, 0.13] },

    /* ---------------- cockpit ---------------- */
    /* the opening: a dark inset laid into the tub's top face */
    { k:"box", c:"dark", z:2, at:[0, -0.02, 0.61], size:[0.40, 0.62, 0.05] },
    /* coaming lip around it */
    { k:"box", c:"body", z:1, at:[-0.25, -0.02, 0.615], size:[0.09, 0.66, 0.07] },
    { k:"box", c:"body", z:1, at:[ 0.25, -0.02, 0.615], size:[0.09, 0.66, 0.07] },

    /* headrest fairing behind the driver — new.
       Six faces that break the flat run from helmet to engine deck. From
       the chase camera this is the shape that stops the car looking like a
       box with a ball on it. */
    { k:"box", c:"body", z:1, at:[0, -0.42, 0.68], size:[0.26, 0.16, 0.11],
      taper:{ f:[1.0, 1.0, 0], b:[0.80, 0.70, -0.02] } },

    /* aeroscreen frame — wraps slightly wider than the opening */
    { k:"box", c:"chrome", z:2, d:1, at:[0, 0.34, 0.68], size:[0.38, 0.03, 0.12],
      taper:{ f:[1,1,0], b:[1,1,0] } },

    /* driver: helmet + visor. Helmet base sits on the coaming, crown clears
       it by 0.24 — any lower and the driver looks buried. */
    { k:"box", c:"helm", z:2, at:[0, -0.16, 0.75], size:[0.26, 0.28, 0.24],
      taper:{ f:[0.90, 0.86, -0.01], b:[0.92, 0.92, 0] } },
    { k:"box", c:"glass", z:3, d:1, at:[0, -0.04, 0.77], size:[0.21, 0.06, 0.08] },

    /* roll hoop — now genuinely clears the helmet (0.93 vs 0.87 crown).
       It was only 0.04 proud before, which read as a lump, not a hoop. */
    { k:"box", c:"chrome", z:1, at:[0, -0.40, 0.79], size:[0.32, 0.06, 0.28],
      taper:{ f:[1,1,0], b:[1,1,0] } },

    /* ---------------- mirrors ---------------- */
    { k:"box", c:"chrome", d:1, at:[-0.30, 0.42, 0.63], size:[0.10, 0.05, 0.07] },
    { k:"box", c:"chrome", d:1, at:[ 0.30, 0.42, 0.63], size:[0.10, 0.05, 0.07] },

    /* ---------------- number plate ----------------
       Flat panel on the engine deck under anchors.num, sloped to sit on the
       cover's taper. Gives the number something to live on instead of
       floating over paint, and reads as a white patch even when the digits
       are too small to resolve.
       If `plate` isn't in your palette, `stripe` is the right substitute. */
    { k:"box", c:"plate", z:1, at:[0, -0.78, 0.60], size:[0.30, 0.34, 0.02],
      taper:{ f:[1.0, 1, 0.006], b:[0.92, 1, -0.02] } },

    /* ---------------- exhausts ----------------
       Pulled in and shortened: they now finish 0.37 behind the tail panel
       rather than trailing off into nothing. */
    { k:"cyl", c:"chrome", d:1, axis:"y", sides:6, at:[-0.17, -1.55, 0.50],
      r:0.055, len:0.80 },
    { k:"cyl", c:"chrome", d:1, axis:"y", sides:6, at:[ 0.17, -1.55, 0.50],
      r:0.055, len:0.80 },

    /* rear panel — reads as the tail when you're behind the car.
       Sized to the engine cover's back face (0.36 × 0.23). */
    { k:"box", c:"dark", z:1, at:[0, -1.46, 0.39], size:[0.38, 0.05, 0.22] }
  ]
});
