#!/usr/bin/env python3
"""
Generate assets/road/asphalt.png — the seamless asphalt tile fpview MULTIPLIES
over the tarmac trapezoids.

RUN INSIDE BLENDER (it needs bpy):

    blender --background --python tools/asphalt-gen.py

or paste it into Blender's Scripting tab. It builds its own scene, renders,
and removes the scene again, so it never touches whatever you have open.

WHY BLENDER AND NOT MORE CANVAS CODE
------------------------------------
js/fpview.js still carries buildAsphalt(), which speckles a canvas with flat
alpha dots. Flat dots have no light direction: they read as noise, not as
stones. Here every chip is a real solid lit by one sun, so it gets a lit face,
a shaded face and a cast shadow, and the tile reads as a surface. That is the
whole reason this file exists — if you only want different grain density, tune
buildAsphalt() instead and skip the bake.

HOW IT STAYS SEAMLESS
---------------------
Two independent tricks, because the tile has two scales of detail:

  chips  — scattered over the unit square [0,1]^2, and any chip within its own
           radius of an edge is DUPLICATED at the opposite edge (and corner).
           The camera is orthographic and frames exactly [0,1]^2, so a chip
           clipped by the right edge is completed by its copy on the left.
           This is exact — no blending, no mirroring.

  mottle — the broad tonal drift is a sum of integer-frequency harmonics,
           f(x,y) = SUM a*sin(2*pi*fx*x + px)*cos(2*pi*fy*y + py), which is
           periodic on the unit square BY CONSTRUCTION. Perlin/Voronoi are
           not, which is why they are not used here.

Keep MOTTLE low. Pushed past ~0.3 the tonal drift clumps the pale chips and
the tile stops reading as asphalt and starts reading as granite worktop.

OUTPUT
------
512x512 PNG, sRGB, mean ~0.73, no clipped highlights. It is multiplied over
the road's flat fill, so mid-to-bright with the detail in the shadows is what
you want; a dark tile would just dim the road.
"""
import bpy, bmesh, random, math, os
from mathutils import Euler

SCENE   = "TILE_BAKE"
OUT     = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "assets", "road", "asphalt.png")
RES     = 512
SAMPLES = 48
MOTTLE  = 0.20          # how hard the broad tonal field biases chip albedo
SEED    = 1965

# chip layers: (count, r_min, r_max, flatness, icosphere_subdiv)
LAYERS = [(3000, 0.0055, 0.0125, 0.34, 1),
          (6000, 0.0026, 0.0058, 0.40, 0),
          (9000, 0.0013, 0.0028, 0.45, 0)]

# aggregate albedos, pale limestone -> dark basalt, with roughness to match
ALBEDOS = [(0.90, 0.55), (0.82, 0.50), (0.74, 0.62), (0.60, 0.70),
           (0.46, 0.78), (0.33, 0.84), (0.22, 0.88), (0.14, 0.90)]
BINDER  = 0.60          # the bitumen showing between the stones


# ------------------------------------------------------------------ helpers
def periodic_field(seed=77):
    """A strictly tile-periodic -1..1 field. Sums of integer-frequency
    harmonics repeat exactly on the unit square; noise textures do not."""
    rng = random.Random(seed)
    harm = [(fx, fy, a, rng.uniform(0, math.tau), rng.uniform(0, math.tau))
            for fx, fy, a in [(1, 0, 1.0), (0, 1, 0.95), (1, 1, 0.8),
                              (2, 1, 0.6), (1, 2, 0.6), (2, 2, 0.45), (3, 2, 0.3)]]
    norm = sum(h[2] for h in harm) * 0.5
    def f(x, y):
        return sum(a * math.sin(math.tau * fx * x + px) * math.cos(math.tau * fy * y + py)
                   for fx, fy, a, px, py in harm) / norm
    return f


def grey(name, val, rough):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (val, val, val * 1.03, 1)
    b.inputs["Roughness"].default_value = rough
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = 0.2
    return m


def icosphere(name, subdiv):
    m = bpy.data.meshes.get(name)
    if m:
        return m
    m = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    bm.to_mesh(m); bm.free()
    return m


# -------------------------------------------------------------------- scene
def build():
    if SCENE in bpy.data.scenes:
        bpy.data.scenes.remove(bpy.data.scenes[SCENE], do_unlink=True)
    sc = bpy.data.scenes.new(SCENE)

    sc.render.engine = 'CYCLES'
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    sc.render.resolution_x = sc.render.resolution_y = RES
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.view_settings.view_transform = 'Standard'   # raw greys, not Filmic
    sc.view_settings.exposure = -0.9               # keeps the highlights off 1.0

    # base plate: the bitumen. Deliberately FLAT — any pattern painted here
    # would not be tile-periodic and would show as a seam wherever the chips
    # leave it exposed.
    plate_me = bpy.data.meshes.new("TB_plate")
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1.0)
    bm.to_mesh(plate_me); bm.free()
    plate_me.materials.append(grey("TB_base", BINDER, 0.93))
    plate = bpy.data.objects.new("TB_plate", plate_me)
    plate.scale = (1.5, 1.5, 1.0)          # overhang, so wrapped chips land on it
    plate.location = (0.5, 0.5, 0.0)
    sc.collection.objects.link(plate)

    ramp   = [grey("TB_a%d" % i, v, r) for i, (v, r) in enumerate(ALBEDOS)]
    meshes = {0: icosphere("TB_chip_vlo", 0), 1: icosphere("TB_chip_lo", 1)}
    field  = periodic_field()

    rng = random.Random(SEED)
    made = 0
    for count, rmin, rmax, flat, subdiv in LAYERS:
        mesh = meshes[subdiv]
        for _ in range(count):
            x, y = rng.random(), rng.random()
            r = rmin + (rmax - rmin) * rng.random() ** 1.7
            rot = Euler((rng.uniform(-0.6, 0.6), rng.uniform(-0.6, 0.6),
                         rng.uniform(0, math.tau)))
            t = rng.random() * (1.0 - MOTTLE) + (0.5 + 0.5 * field(x, y)) * MOTTLE
            mat = ramp[max(0, min(len(ramp) - 1, int(t * len(ramp))))]
            scale = (r * rng.uniform(0.75, 1.3),
                     r * rng.uniform(0.75, 1.3),
                     r * flat * rng.uniform(0.7, 1.3))

            # WRAP — the seam trick. 1.6r of slack covers the widest scale-up.
            dxs = [0.0] + ([-1.0] if x > 1 - r * 1.6 else []) + ([1.0] if x < r * 1.6 else [])
            dys = [0.0] + ([-1.0] if y > 1 - r * 1.6 else []) + ([1.0] if y < r * 1.6 else [])
            for dx in dxs:
                for dy in dys:
                    ob = bpy.data.objects.new("c", mesh)   # linked dup: real instance
                    ob.location = (x + dx, y + dy, r * flat * 0.45)
                    ob.rotation_euler = rot
                    ob.scale = scale
                    ob.active_material = mat
                    sc.collection.objects.link(ob)
                    made += 1

    # orthographic, straight down, framing exactly [0,1]^2 — this is what makes
    # the wrapped chips line up. Do not change ortho_scale without changing the
    # scatter domain to match.
    cam_data = bpy.data.cameras.new("TB_cam")
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 1.0
    cam = bpy.data.objects.new("TB_cam", cam_data)
    cam.location = (0.5, 0.5, 2.0)
    sc.collection.objects.link(cam)
    sc.camera = cam

    # one hard-ish key at 30 degrees: low enough for the stones to cast, high
    # enough that the shadows do not emboss a direction into the road.
    sun_data = bpy.data.lights.new("TB_sun", 'SUN')
    sun_data.energy = 2.6
    sun_data.angle = math.radians(4)
    sun = bpy.data.objects.new("TB_sun", sun_data)
    sun.rotation_euler = Euler((math.radians(30), 0, math.radians(38)))
    sc.collection.objects.link(sun)

    world = bpy.data.worlds.new("TB_world")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.30, 0.31, 0.34, 1)   # low fill = deep chip shadows
    bg.inputs[1].default_value = 1.0
    sc.world = world

    return sc, made


def main():
    sc, made = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sc.render.filepath = OUT
    bpy.ops.render.render(scene=sc.name, write_still=True)
    print("[asphalt-gen] %d chips -> %s" % (made, OUT))
    bpy.data.scenes.remove(sc, do_unlink=True)   # leave the session as we found it


if __name__ == "__main__":
    main()
