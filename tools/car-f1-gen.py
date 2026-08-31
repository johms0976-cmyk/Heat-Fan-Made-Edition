#!/usr/bin/env python3
"""
Generate js/models/car-f1.js — the f1_60s mesh, as POLY `k:"mesh"` parts.

Same shape as the Blender model (heat-f1-60s.blend), rebuilt at a face budget
poly.js can afford: the painter's-algorithm renderer costs ~2.5ms/frame for
5 cars at ~500 faces and falls off a cliff past ~1200 (object churn in the
depth sort, not fill rate).

Frame: +X right, +Y forward (nose), +Z up, z=0 = contact patch. Metres.
"""
import math, json

# The car's SHAPE lives in f1_shape so cockpit-shell-gen.py can build the
# same hull from the driver's seat. Only the tessellation and the face
# budget are this file's business.
from f1_shape import (STATIONS, NSEG, EXP, lerp_station, deck_z, half_w,
                      ring, cockpit_hw)

# ---------------------------------------------------------------- accumulator
# parts are keyed by (slot, z-bias, detail-flag) so everything sharing a
# palette slot and sort bias merges into ONE mesh part.
PARTS = {}

def emit(slot, verts, faces, z=0, d=0):
    key = (slot, z, d)
    p = PARTS.setdefault(key, {"v": [], "f": []})
    base = len(p["v"]) // 3
    for x, y, zz in verts:
        p["v"] += [x, y, zz]
    for f in faces:
        p["f"].append([base + i for i in f])

def build_body():
    verts, faces = [], []
    rings = []
    for st in STATIONS:
        idx = []
        for p in ring(*st):
            idx.append(len(verts)); verts.append(p)
        rings.append(idx)
    for a, b in zip(rings[:-1], rings[1:]):
        for j in range(NSEG):
            k = (j + 1) % NSEG
            faces.append([a[j], a[k], b[k], b[j]])
    faces.append(list(reversed(rings[0])))      # n-gon caps: 1 face each
    faces.append(list(rings[-1]))
    emit("body", verts, faces)

# --------------------------------------------------------------------- wheels
def build_wheel(cx, cy, cz, R, W, Rr, seg=10, dish=0.030):
    half = W / 2.0
    sh   = R * 0.16
    bul  = half * 1.06
    # 4-point profile: rim -> flared sidewall -> flat tread -> sidewall -> rim.
    # A 6-point profile with rounded shoulders costs 20 more faces per wheel
    # (80 across the car, ~11% of the budget) for a radius that is under a
    # pixel wide at every size the game actually draws a rival.
    prof = [(-half, Rr), (-bul, R), (bul, R), (half, Rr)]
    verts, tyre, hub = [], [], []
    cols = []
    for u, r in prof:
        col = []
        for i in range(seg):
            t = 2 * math.pi * i / seg
            col.append(len(verts))
            verts.append((cx + u, cy + r * math.sin(t), cz + r * math.cos(t)))
        cols.append(col)
    for a, b in zip(cols[:-1], cols[1:]):
        for j in range(seg):
            k = (j + 1) % seg
            tyre.append([a[j], a[k], b[k], b[j]])
    for col, sgn in ((cols[0], -1.0), (cols[-1], 1.0)):
        c = len(verts); verts.append((cx + sgn * (half - dish), cy, cz))
        for j in range(seg):
            k = (j + 1) % seg
            hub.append([c, col[j], col[k]] if sgn > 0 else [c, col[k], col[j]])
    emit("tyre", verts, tyre)
    emit("hub",  verts, hub)

# ------------------------------------------------------- generic swept tube
def tube(slot, path, r, sides=5, r_end=None, z=0, d=0, caps=True):
    import copy
    P = [tuple(p) for p in path]
    n = len(P)
    fwd = []
    for i in range(n):
        if   i == 0:     a, b = P[0], P[1]
        elif i == n - 1: a, b = P[-2], P[-1]
        else:            a, b = P[i-1], P[i+1]
        v = (b[0]-a[0], b[1]-a[1], b[2]-a[2])
        L = math.dist((0,0,0), v) or 1.0
        fwd.append((v[0]/L, v[1]/L, v[2]/L))
    ref = (0.0, 0.0, 1.0)
    if abs(fwd[0][2]) > 0.9:
        ref = (1.0, 0.0, 0.0)
    verts, faces, rings = [], [], []
    for i in range(n):
        f = fwd[i]
        rx = f[1]*ref[2] - f[2]*ref[1]
        ry = f[2]*ref[0] - f[0]*ref[2]
        rz = f[0]*ref[1] - f[1]*ref[0]
        m = math.dist((0,0,0), (rx,ry,rz)) or 1.0
        rx, ry, rz = rx/m, ry/m, rz/m
        ux = ry*f[2] - rz*f[1]; uy = rz*f[0] - rx*f[2]; uz = rx*f[1] - ry*f[0]
        ref = (ux, uy, uz)
        rad = r if r_end is None else r + (r_end - r) * (i / (n - 1))
        idx = []
        for k in range(sides):
            t = 2 * math.pi * k / sides
            ca, sa = math.cos(t) * rad, math.sin(t) * rad
            idx.append(len(verts))
            verts.append((P[i][0] + rx*ca + ux*sa,
                          P[i][1] + ry*ca + uy*sa,
                          P[i][2] + rz*ca + uz*sa))
        rings.append(idx)
    for a, b in zip(rings[:-1], rings[1:]):
        for k in range(sides):
            j = (k + 1) % sides
            faces.append([a[k], a[j], b[j], b[k]])
    if caps:
        faces.append(list(reversed(rings[0])))
        faces.append(list(rings[-1]))
    emit(slot, verts, faces, z, d)

def box(slot, ctr, size, taper=1.0, z=0, d=0):
    cx, cy, cz = ctr; sx, sy, sz = (s / 2 for s in size)
    verts = []
    for sgn, sc in ((-1, 1.0), (1, taper)):
        for ax, az in ((-1,-1), (1,-1), (1,1), (-1,1)):
            verts.append((cx+ax*sx*sc, cy+sgn*sy, cz+az*sz*sc))
    faces = [[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]]
    emit(slot, verts, faces, z, d)

def ribbon(slot, y0, y1, hw_fn, z_fn, steps, z=0, d=0):
    verts, faces = [], []
    L, R = [], []
    for i in range(steps + 1):
        y = y0 + (y1 - y0) * i / steps
        hw, zz = hw_fn(y), z_fn(y)
        L.append(len(verts)); verts.append((-hw, y, zz))
        R.append(len(verts)); verts.append(( hw, y, zz))
    for i in range(steps):
        faces.append([L[i], R[i], R[i+1], L[i+1]])
    emit(slot, verts, faces, z, d)

def disc_flat(slot, ctr, rx, ry, seg=10, z=0, d=0):
    cx, cy, cz = ctr
    verts = [(cx + rx*math.cos(2*math.pi*i/seg), cy + ry*math.sin(2*math.pi*i/seg), cz)
             for i in range(seg)]
    emit(slot, verts, [list(range(seg))], z, d)

def disc_rear(slot, ctr, rx, rz, seg=10, z=0, d=0):
    cx, cy, cz = ctr
    verts = [(cx + rx*math.cos(2*math.pi*i/seg), cy, cz + rz*math.sin(2*math.pi*i/seg))
             for i in range(seg)]
    emit(slot, verts, [list(range(seg))], z, d)

# ===================================================================== assemble
build_body()
for spec in (("RL", -0.60, -1.00, 0.34, 0.34, 0.42, 0.20),
             ("RR",  0.60, -1.00, 0.34, 0.34, 0.42, 0.20),
             ("FL", -0.62,  1.34, 0.30, 0.30, 0.28, 0.17),
             ("FR",  0.62,  1.34, 0.30, 0.30, 0.28, 0.17)):
    build_wheel(*spec[1:])

# roll hoop
tube("chrome", [(-0.205,-0.40,0.60), (-0.150,-0.40,0.88), (0.0,-0.40,0.945),
                ( 0.150,-0.40,0.88), ( 0.205,-0.40,0.60)], 0.026, sides=5, z=1)

# cockpit opening + coaming lips  (cockpit_hw comes from f1_shape)
ribbon("dark", -0.30, 0.33, cockpit_hw, lambda y: deck_z(y) + 0.004, 6, z=2)
for sx in (-1, 1):
    tube("body", [(sx*0.200, 0.345, deck_z(0.345)+0.012),
                  (sx*0.232, 0.020, deck_z(0.020)+0.014),
                  (sx*0.205,-0.325, deck_z(-0.325)+0.012)], 0.034, sides=5, z=1)
box("body", (0.0,-0.45,0.655), (0.245,0.20,0.115), taper=0.72, z=1)   # headrest

# driver — two stacked cones so the helmet reads as a head in profile,
# not as the bare cylinder a single tube would give
tube("helm", [(0.0,-0.300,0.694), (0.0,-0.175,0.700)], 0.082, sides=8, r_end=0.132, z=2)
tube("helm", [(0.0,-0.175,0.700), (0.0,-0.040,0.696)], 0.132, sides=8, r_end=0.096, z=2)
box("glass", (0.0,-0.058,0.716), (0.205,0.075,0.072), z=3)

# aeroscreen
tube("chrome", [(-0.185,0.315,0.585), (0.0,0.355,0.655), (0.185,0.315,0.585)],
     0.020, sides=5, z=2, d=1)

# mirrors
for sx in (-1, 1):
    box("chrome", (sx*0.285, 0.415, 0.615), (0.095,0.048,0.062), z=1, d=1)

# gearbox / bellhousing
tube("dark", [(0.0,-0.72,0.400), (0.0,-1.02,0.385)], 0.190, sides=7, r_end=0.165)
tube("dark", [(0.0,-1.02,0.385), (0.0,-1.40,0.356), (0.0,-1.66,0.340)],
     0.163, sides=7, r_end=0.082)

# exhausts
for sx in (-1, 1):
    for ox, oz in ((0.052,0.485), (0.101,0.466), (0.148,0.442)):
        tube("dark", [(sx*ox*0.6,-0.80,oz-0.030), (sx*ox,-1.66,oz+0.018)],
             0.017, sides=4, r_end=0.023, d=1)

# suspension
for sx in (-1, 1):
    hub_u, hub_l = (sx*0.455, 1.34, 0.395), (sx*0.470, 1.34, 0.180)
    for a in ((sx*0.135,1.10,0.400), (sx*0.135,1.58,0.400)):
        tube("chrome", [a, hub_u], 0.024, sides=4, d=1)
    for a in ((sx*0.150,1.10,0.215), (sx*0.150,1.58,0.215)):
        tube("chrome", [a, hub_l], 0.024, sides=4, d=1)
    tube("chrome", [hub_l, hub_u], 0.030, sides=4, d=1)
    tube("chrome", [(sx*0.330,1.34,0.235), (sx*0.150,1.30,0.520)], 0.032, sides=4, d=1)

    hub_u, hub_l = (sx*0.375,-1.00,0.470), (sx*0.385,-1.00,0.215)
    for a in ((sx*0.140,-0.76,0.480), (sx*0.140,-1.24,0.480)):
        tube("chrome", [a, hub_u], 0.024, sides=4, d=1)
    for a in ((sx*0.155,-0.76,0.230), (sx*0.155,-1.24,0.230)):
        tube("chrome", [a, hub_l], 0.024, sides=4, d=1)
    tube("chrome", [(sx*0.150,-1.00,0.340), (sx*0.395,-1.00,0.340)], 0.030, sides=4, d=1)
    tube("chrome", [(sx*0.330,-1.02,0.250), (sx*0.155,-0.90,0.545)], 0.034, sides=4, d=1)

# markings
# Nose stripe. The taper factor matters more than the cap: at 0.82 the stripe
# was 82% as wide as the nose TIP, so head-on the whole nose went cream.
ribbon("stripe", 0.40, 2.27,
       lambda y: min(0.068, half_w(y) * 0.46),
       lambda y: deck_z(y) + 0.010, 10, z=1, d=1)
disc_flat("plate", (0.0,-0.855,deck_z(-0.855)+0.010), 0.115, 0.150, seg=10, z=1)
disc_rear("dark",  (0.0, 2.315, 0.310), 0.052, 0.042, seg=8, z=1)
disc_rear("dark",  (0.0,-1.615, 0.400), 0.150, 0.105, seg=8, z=1)

# ======================================================================= write
xs = [p["v"][i] for p in PARTS.values() for i in range(0, len(p["v"]), 3)]
width = max(xs) - min(xs)
nf   = sum(len(p["f"]) for p in PARTS.values())
nf_far = sum(len(p["f"]) for k, p in PARTS.items() if not k[2])
nv   = sum(len(p["v"]) // 3 for p in PARTS.values())

def num(x):
    s = f"{x:.4f}".rstrip("0").rstrip(".")
    return "0" if s in ("", "-0") else s

order = sorted(PARTS.items(), key=lambda kv: (kv[0][2], kv[0][1], kv[0][0]))
NL = "\n"
SEP = ",\n\n"
chunks = []
for (slot, z, d), p in order:
    opts = f'k:"mesh", c:"{slot}"'
    if z: opts += f", z:{z}"
    if d: opts += ", d:1"
    v = ",".join(num(x) for x in p["v"])
    f = ",".join("[" + ",".join(str(i) for i in face) + "]" for face in p["f"])
    chunks.append("  { " + opts + "," + NL +
                  "    v:[" + v + "]," + NL +
                  "    f:[" + f + "] }")

js = f'''/* =====================================================================
   MODEL — f1_60s  ·  the rival / opponent car   [GENERATED — do not hand-edit]
   ---------------------------------------------------------------------
   A 1960s Grand Prix car: cigar body, exposed wheels, no wings, roll hoop,
   open cockpit. Built in Blender as a lofted hull and re-emitted here at a
   face budget the painter's-algorithm renderer can afford.

   Source scene : heat-f1-60s.blend
   Regenerate   : python3 gen.py > car-f1.js

   Frame:  +X right   +Y forward (nose)   +Z up   z=0 is the contact patch
   Units:  metres.  Rear track 1.65, front 1.54, length 3.94.

   BUDGET — measured, 5 rivals, headless Chromium, per frame:
       194 faces  1.14ms      1000 faces  5.51ms
       500 faces  2.47ms      2330 faces  31-49ms   <- cliff
   The cliff is object churn in POLY.draw's depth sort, not fill rate, so
   the number that matters is FACE COUNT, not how big the car is on screen.
   This model: {nf} faces near, {nf_far} far. Keep it under ~600.

   Parts are merged by palette slot, so one mesh part carries every face
   wearing that colour. Slots used: body stripe plate tyre hub dark chrome
   glass helm.  Anything marked d:1 is dropped below GFX.lodPx (60px):
   suspension, mirrors, exhausts, aeroscreen, nose stripe.

   Requires js/poly.js (for defineModel and the "mesh" primitive).
   ===================================================================== */
"use strict";

defineModel("f1_60s", {{

  width : {num(width)},                  // overall X extent — the renderer divides
                              // this into CAR_W to get the on-screen scale

  anchors : {{
    num  : [ 0, -0.855, {num(deck_z(-0.855)+0.02)} ],   // roundel on the engine deck
    tail : [ 0, -1.62,  0.40 ]      // brake-light bar
  }},

  parts : [
{SEP.join(chunks)}
  ]
}});
'''
print(js)
import sys
print(f"[verts {nv}] [faces near {nf} far {nf_far}] [width {width:.3f}] "
      f"[parts {len(PARTS)}]", file=sys.stderr)
