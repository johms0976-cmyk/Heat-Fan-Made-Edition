#!/usr/bin/env python3
"""
Generate js/models/cockpit-shell.js — the part of the CAR you can see from the
driver's seat, built from the same hull as the rival model.

    python3 tools/cockpit-shell-gen.py > js/models/cockpit-shell.js

WHY
---
js/models/cockpit.js and cockpit-hi.js used to draw the bonnet as a tapered
box. The rival draws it as a nine-station lofted hull (f1_shape.STATIONS).
Two different cars. From the seat you saw a flat-sided wedge; alongside you
saw a round-flanked cigar. This file emits the real hull, in eye space, so the
two agree. Both cockpit models call cockpitShell() for it and keep owning
their own furniture — dash, dials, steering wheel, gloves, suspension detail —
none of which exists on the rival and none of which belongs here.

WHAT IT COVERS
--------------
Everything of the CAR forward of the driver's eyes:

    body     the lofted hull from the scuttle (y=0.35) to the nose tip,
             capped at the near end — that cap IS the scuttle face
    stripe   the centre stripe ribbon riding the deck
    coaming  the rolled lip down each side of the cockpit opening, trimmed
             at the near clamp, which frames the view left and right
    flank    the tub sides between the clamp and the scuttle — the outer
             thirds of the screen
    screen   the aeroscreen hoop

Not here: wheels and suspension (the cockpit files detail those far past what
the rival carries), and anything behind the eye.

TESSELLATION
------------
Coarser than the rival is not an option — the near end of this hull fills a
third of the screen, where the rival is 60px wide. So NSEG is 20 (not 12) and
the deck is resampled every ~0.11m. That costs ~420 faces, which is free:
fpview-poly BAKES the cockpit to an offscreen canvas once and blits it, so
cockpit detail costs bake time, not frame time. Do NOT copy this budget to
anything drawn live.

EYE HEIGHT
----------
Authored around f1_shape.EYE — the centre of the visor, 0.716m over the
tarmac. That number is the reason a 60s car shows so little bonnet, and it is
the number that puts the deck exactly where cockpit-hi.js's hand-solved
framing already had it. cockpitShell({eyeH}) can shift it if you want to sit
the driver higher, but check the dash still reads: screen height is
horizon + |z|/y * focal.
"""
import math, sys
from f1_shape import (EYE, NSEG as CAR_NSEG, lerp_station, deck_z, half_w,
                      cockpit_hw, COAMING, COAMING_R, AEROSCREEN, AEROSCREEN_R,
                      STRIPE_Y, stripe_hw, stripe_z, EXP)

NSEG      = 20        # ring segments — the near end is huge on screen
Y_SCUTTLE = 0.35      # loft starts just ahead of the cockpit opening
Y_TIP     = 2.32
Y_STEP    = 0.11      # deck resample pitch
NEAR_Y    = 0.28      # fpview's near clamp, in EYE space

EYE_Y, EYE_Z = EYE[1], EYE[2]

PARTS = {}


def emit(name, slot, verts, faces, z=0, d=0):
    """Merge into one mesh part per (name, slot, z-bias, detail-flag). The name
    is what cockpitShell({skip:[...]}) filters on, so each cockpit model can
    drop the pieces it already draws better itself."""
    p = PARTS.setdefault((name, slot, z, d), {"v": [], "f": []})
    base = len(p["v"]) // 3
    for x, y, zz in verts:
        # car space -> eye space. A pure translation: the model IS already in
        # camera coordinates, which is why no camera transform is needed.
        p["v"] += [x, y - EYE_Y, zz - EYE_Z]
    for f in faces:
        p["f"].append([base + i for i in f])


def ring(y, seg=NSEG):
    """Superelliptical station ring at y — same profile as f1_shape.ring, but
    at the cockpit's finer segment count."""
    hw, hT, hB, zc = lerp_station(y)
    pts = []
    for i in range(seg):
        t = 2 * math.pi * i / seg
        c, s = math.cos(t), math.sin(t)
        hh = hT if s >= 0 else hB
        x = hw * math.copysign(abs(c) ** (2 / EXP), c)
        z = hh * math.copysign(abs(s) ** (2 / EXP), s)
        pts.append((x, y, zc + z))
    return pts


# ------------------------------------------------------------------ the hull
def build_hull():
    ys = [Y_SCUTTLE]
    while ys[-1] < Y_TIP - 1e-6:
        ys.append(min(Y_TIP, ys[-1] + Y_STEP))
    # make sure every real station lands exactly on a ring, so the loft keeps
    # the creases the shape was drawn with
    for y, *_ in [(s[0],) for s in __import__("f1_shape").STATIONS]:
        if Y_SCUTTLE < y < Y_TIP and min(abs(y - v) for v in ys) > 0.02:
            ys.append(y)
    ys = sorted(set(round(v, 4) for v in ys))

    verts, faces, rings = [], [], []
    for y in ys:
        idx = []
        for p in ring(y):
            idx.append(len(verts)); verts.append(p)
        rings.append(idx)
    for a, b in zip(rings[:-1], rings[1:]):
        for j in range(NSEG):
            k = (j + 1) % NSEG
            faces.append([a[j], a[k], b[k], b[j]])
    faces.append(list(reversed(rings[0])))    # scuttle face, one n-gon
    faces.append(list(rings[-1]))             # nose tip
    emit("hull", "body", verts, faces)
    return len(ys)


# ----------------------------------------------------------------- the stripe
def build_stripe(steps=22):
    y0, y1 = STRIPE_Y
    verts, faces, L, R = [], [], [], []
    for i in range(steps + 1):
        y = y0 + (y1 - y0) * i / steps
        hw, zz = stripe_hw(y), stripe_z(y)
        L.append(len(verts)); verts.append((-hw, y, zz))
        R.append(len(verts)); verts.append(( hw, y, zz))
    for i in range(steps):
        faces.append([L[i], R[i], R[i + 1], L[i + 1]])
    emit("stripe", "stripe", verts, faces, z=1)


# ---------------------------------------------------------- swept round tube
def tube(name, slot, path, r, sides=8, z=0, d=0, caps=True):
    P = [tuple(p) for p in path]
    n = len(P)
    fwd = []
    for i in range(n):
        a, b = (P[0], P[1]) if i == 0 else (P[-2], P[-1]) if i == n - 1 else (P[i - 1], P[i + 1])
        v = (b[0] - a[0], b[1] - a[1], b[2] - a[2])
        L = math.dist((0, 0, 0), v) or 1.0
        fwd.append((v[0] / L, v[1] / L, v[2] / L))
    ref = (1.0, 0.0, 0.0) if abs(fwd[0][2]) > 0.9 else (0.0, 0.0, 1.0)
    verts, faces, rings = [], [], []
    for i in range(n):
        f = fwd[i]
        rx, ry, rz = (f[1] * ref[2] - f[2] * ref[1],
                      f[2] * ref[0] - f[0] * ref[2],
                      f[0] * ref[1] - f[1] * ref[0])
        m = math.dist((0, 0, 0), (rx, ry, rz)) or 1.0
        rx, ry, rz = rx / m, ry / m, rz / m
        ux, uy, uz = (ry * f[2] - rz * f[1], rz * f[0] - rx * f[2], rx * f[1] - ry * f[0])
        ref = (ux, uy, uz)
        idx = []
        for k in range(sides):
            t = 2 * math.pi * k / sides
            ca, sa = math.cos(t) * r, math.sin(t) * r
            idx.append(len(verts))
            verts.append((P[i][0] + rx * ca + ux * sa,
                          P[i][1] + ry * ca + uy * sa,
                          P[i][2] + rz * ca + uz * sa))
        rings.append(idx)
    for a, b in zip(rings[:-1], rings[1:]):
        for k in range(sides):
            j = (k + 1) % sides
            faces.append([a[k], a[j], b[j], b[k]])
    if caps:
        faces.append(list(reversed(rings[0])))
        faces.append(list(rings[-1]))
    emit(name, slot, verts, faces, z, d)


# ------------------------------------------------------------------ the flanks
def build_flank():
    """The tub sides between the near clamp and the scuttle.

    The hull proper starts at the scuttle (y=0.35) because behind that the deck
    has a hole in it — the cockpit opening you are sitting in. But the SIDES of
    the tub carry on past your elbows, and at 0.25m from the eye they are what
    fills the outer thirds of the screen. Drop them and the view opens onto bare
    road either side of the dash, which is what happened the first time.

    So: the same station rings, but only the segments whose normal points
    sideways (|cos| > 0.45), swept from the near clamp forward to meet the hull.
    No top, no bottom — nothing that could poke through the deck or the floor."""
    ys = [NEAR_Y + EYE_Y - 0.03, 0.26, 0.31, Y_SCUTTLE]
    keep = [j for j in range(NSEG)
            if abs(math.cos(2 * math.pi * j / NSEG)) > 0.45]
    verts, faces, rings = [], [], []
    for y in ys:
        idx = []
        for p in ring(y):
            idx.append(len(verts)); verts.append(p)
        rings.append(idx)
    for a, b in zip(rings[:-1], rings[1:]):
        for j in keep:
            k = (j + 1) % NSEG
            if k in keep:
                faces.append([a[j], a[k], b[k], b[j]])
    emit("flank", "body", verts, faces)


# ---------------------------------------------------------------- the coaming
def build_coaming():
    """The rolled lip runs from y=0.345 back past the driver. Only the front of
    it is in front of the eye, so it is trimmed at the near clamp — but that
    stub is within 0.3m of the eye, so it is what frames the view left and
    right, and it wants segments."""
    y_cut = NEAR_Y + EYE_Y - 0.02          # car-space y of the near clamp
    for sx in (-1, 1):
        pts = []
        for (x, y), lift in zip(COAMING, COAMING_R and [0.012, 0.014, 0.012]):
            pts.append((sx * x, y, deck_z(y) + lift))
        # interpolate a cut point, then keep only what is ahead of it
        out = []
        for a, b in zip(pts[:-1], pts[1:]):
            if a[1] >= y_cut >= b[1]:
                t = (a[1] - y_cut) / (a[1] - b[1])
                out.append(tuple(a[i] + (b[i] - a[i]) * t for i in range(3)))
                break
        kept = [p for p in pts if p[1] > y_cut] + out
        if len(kept) >= 2:
            tube("coaming", "body", kept, COAMING_R, sides=8, z=1)


def build_screen():
    tube("screen", "chrome", AEROSCREEN, AEROSCREEN_R, sides=6, z=2, d=1)


# ================================================================== assemble
nrings = build_hull()
build_flank()
build_stripe()
build_coaming()
build_screen()

nf = sum(len(p["f"]) for p in PARTS.values())
nv = sum(len(p["v"]) // 3 for p in PARTS.values())


def num(x):
    s = f"{x:.4f}".rstrip("0").rstrip(".")
    return "0" if s in ("", "-0") else s


# deck table — so the cockpit files can put rivets, panel seams and the filler
# cap ON the real deck instead of on numbers that matched the old box
DECK = []
_y = Y_SCUTTLE
while _y <= Y_TIP + 1e-9:
    # y in EYE space too, so callers never have to convert
    DECK.append((round(_y - EYE_Y, 3), round(half_w(_y), 4), round(deck_z(_y) - EYE_Z, 4)))
    _y = round(_y + 0.10, 3)

order = sorted(PARTS.items(), key=lambda kv: (kv[0][3], kv[0][2], kv[0][1]))
chunks = []
for (name, slot, z, d), p in order:
    opts = f'k:"mesh", n:"{name}", c:"{slot}"'
    if z: opts += f", z:{z}"
    if d: opts += ", d:1"
    v = ",".join(num(x) for x in p["v"])
    f = ",".join("[" + ",".join(str(i) for i in face) + "]" for face in p["f"])
    chunks.append("    { " + opts + ",\n      v:[" + v + "],\n      f:[" + f + "] }")

NL = ",\n\n"
js = f'''/* =====================================================================
   COCKPIT SHELL — the car, seen from the driver's seat   [GENERATED]
   ---------------------------------------------------------------------
   The bonnet, scuttle, centre stripe, coaming lips and aeroscreen, lofted
   from the SAME nine-station hull as the rival car (tools/f1_shape.py), so
   the car you drive and the cars you race are one shape. Before this, the
   cockpit's nose was a hand-tuned tapered box and they disagreed.

   Source scene : heat-sprites/redheat-f1-60s.blend
   Regenerate   : python3 tools/cockpit-shell-gen.py > js/models/cockpit-shell.js
   DO NOT HAND-EDIT — change tools/f1_shape.py and regenerate, or the rival
   drifts away from the cockpit again.

   EYE SPACE:  origin = the driver's eyes,  +X right  +Y forward  +Z up.
   The eye sits {num(EYE_Z)}m over the tarmac (the centre of the visor), so the
   road plane is z = -{num(EYE_Z)}. Nothing here is nearer than y = {NEAR_Y}, the
   near clamp — anything closer blows up under the perspective divide.

   {nf} faces, {nv} verts. That is ~4x the rival's whole body, and it is fine:
   fpview-poly BAKES the cockpit once to an offscreen canvas and blits it, so
   this costs bake time, not frame time. Do not copy the budget to anything
   drawn live.

   Slots used: body stripe chrome.
   Requires js/poly.js. Load BEFORE js/models/cockpit.js.
   ===================================================================== */
"use strict";

/* Returns a fresh parts array for splicing into a cockpit model.

     opt.eyeH   eye height over the tarmac (default {num(EYE_Z)}, the real one).
                Raising it sits the driver up and shows more bonnet; the dash
                does NOT move with it, so re-check the two against each other.
     opt.detail false strips the d:1 parts (the aeroscreen) for the light model.
     opt.skip   array of part names to leave out, for a cockpit that already
                draws that piece better itself. Names: hull stripe coaming
                screen flank. cockpit-hi.js skips "coaming" and "flank" — it
                has a rolled, riveted coaming and its own tapered tub sides.

   Screen height for anything here is  horizon + |z|/y * focal, so a part at
   y=1.5, z=-0.24 lands ~0.17 focal-units below the horizon. Solve, don't guess. */
function cockpitShell(opt){{
  opt = opt || {{}};
  const dz = (opt.eyeH == null ? {num(EYE_Z)} : opt.eyeH) - {num(EYE_Z)};
  const skip = opt.skip || [];
  const keep = p => (opt.detail !== false || !p.d) && skip.indexOf(p.n) < 0;

  const parts = [

{NL.join(chunks)}

  ].filter(keep);

  /* eye-height shim: the whole shell is one translation away from any other
     seating position, because eye space is the camera frame already. */
  if(dz) for(const p of parts){{
    const v = p.v = p.v.slice();
    for(let i = 2; i < v.length; i += 3) v[i] -= dz;
  }}
  return parts;
}}

/* The deck line, sampled every 0.10m: [ y, halfWidth, z ] in EYE space, y from
   the scuttle to the nose tip. Anything the cockpit files stick ON the bonnet —
   panel seams, rivet runs, the filler cap, a mirror foot — should sit on this
   rather than on a hand-typed z, or it will float off the hull the next time
   the shape changes. */
cockpitShell.DECK = {{deck_js}};

/* Interpolated deck at any y: {{hw, z}} in eye space, or null off either end.
   Pass the same eyeH you passed cockpitShell(). */
cockpitShell.deck = function(y, eyeH){{
  const D = cockpitShell.DECK, dz = (eyeH == null ? {num(EYE_Z)} : eyeH) - {num(EYE_Z)};
  if(!D.length || y < D[0][0] || y > D[D.length-1][0]) return null;
  for(let i = 0; i < D.length - 1; i++){{
    const a = D[i], b = D[i+1];
    if(y >= a[0] && y <= b[0]){{
      const t = b[0] === a[0] ? 0 : (y - a[0]) / (b[0] - a[0]);
      return {{ hw: a[1] + (b[1] - a[1]) * t,
               z : a[2] + (b[2] - a[2]) * t - dz }};
    }}
  }}
  return null;
}};

try {{ window.cockpitShell = cockpitShell; }} catch(e){{}}
'''.replace("{deck_js}", "[" + ",".join(
      "[%s,%s,%s]" % (num(y), num(hw), num(z)) for y, hw, z in DECK) + "]")
print(js)
print(f"[rings {nrings}] [faces {nf}] [verts {nv}] [parts {len(PARTS)}]", file=sys.stderr)
