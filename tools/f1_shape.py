"""
f1_shape — the ONE description of the 1960s car's shape.

Both generators import this, so the cockpit you look out of and the rivals you
look at are the same car:

    car-f1-gen.py       -> js/models/car-f1.js        (the rival, whole car)
    cockpit-shell-gen.py-> js/models/cockpit-shell.js (the same hull, seen from
                                                       the driver's eyes)

Before this module existed the cockpit's bonnet was a hand-tuned tapered box
while the rival's was a nine-station lofted hull, so the car you drove was not
the car you raced. Anything describing the CAR's shape belongs here. Anything
describing cockpit furniture (dash, dials, steering wheel, gloves) does not —
none of that exists on the rival model, and it lives in the cockpit files.

Frame: +X right, +Y forward (nose), +Z up, z=0 = contact patch. Metres.
Source scene: heat-sprites/redheat-f1-60s.blend
"""
import math

# --------------------------------------------------------------- body loft
# y, halfwidth, above-centre, below-centre, z-centre
STATIONS = [
    (-1.62, 0.170, 0.110, 0.130, 0.400),
    (-1.20, 0.262, 0.176, 0.182, 0.412),
    (-0.85, 0.305, 0.222, 0.206, 0.426),
    (-0.30, 0.310, 0.210, 0.220, 0.420),
    ( 0.10, 0.306, 0.194, 0.227, 0.407),
    ( 0.72, 0.260, 0.160, 0.210, 0.390),
    ( 1.30, 0.200, 0.130, 0.180, 0.360),
    ( 1.90, 0.140, 0.110, 0.140, 0.330),
    ( 2.32, 0.045, 0.050, 0.060, 0.310),
]
NSEG, EXP = 12, 3.0        # ring segments; superellipse exponent (3 = soft ogee)


def lerp_station(y):
    """(halfwidth, above, below, z-centre) at any y, clamped to the ends."""
    ys = [s[0] for s in STATIONS]
    y = max(ys[0], min(ys[-1], y))
    for a, b in zip(STATIONS[:-1], STATIONS[1:]):
        if a[0] <= y <= b[0]:
            t = (y - a[0]) / (b[0] - a[0])
            return [a[j] + (b[j] - a[j]) * t for j in range(1, 5)]
    return list(STATIONS[-1][1:])


def deck_z(y):
    """Top of the bodywork at y — the line your eye runs along the bonnet."""
    hw, hT, hB, zc = lerp_station(y)
    return zc + hT


def half_w(y):
    return lerp_station(y)[0]


def ring(y, hw, hT, hB, zc):
    """One superelliptical station ring, NSEG points, counter-clockwise."""
    pts = []
    for i in range(NSEG):
        t = 2 * math.pi * i / NSEG
        c, s = math.cos(t), math.sin(t)
        hh = hT if s >= 0 else hB
        x = hw * math.copysign(abs(c) ** (2 / EXP), c)
        z = hh * math.copysign(abs(s) ** (2 / EXP), s)
        pts.append((x, y, zc + z))
    return pts


def cockpit_hw(y):
    """Half-width of the cockpit opening — a sine lobe from y=-0.30 to 0.33."""
    t = (y + 0.30) / 0.63
    return 0.175 * math.sin(max(0.0, min(1.0, t)) * math.pi) ** 0.55


# ---------------------------------------------------------------- hardpoints
# The driver's eyes, in car space: the centre of the visor. This is the origin
# the cockpit model is authored around, and EYE[2] is how high the eye sits
# above the tarmac — 0.716m, which is why a 60s car shows so little bonnet.
EYE = (0.0, -0.058, 0.716)

# coaming lip: a swept tube down each side of the opening, front -> back
COAMING = [(0.200,  0.345), (0.232,  0.020), (0.205, -0.325)]
COAMING_R, COAMING_LIFT = 0.034, (0.012, 0.014, 0.012)

AEROSCREEN = [(-0.185, 0.315, 0.585), (0.0, 0.355, 0.655), (0.185, 0.315, 0.585)]
AEROSCREEN_R = 0.020

MIRROR_AT, MIRROR_SIZE = (0.285, 0.415, 0.615), (0.095, 0.048, 0.062)

# wheels: (cx, cy, cz, R, W, Rr) — front pair only matters to the cockpit
WHEEL_FL = (-0.62, 1.34, 0.30, 0.30, 0.28, 0.17)
WHEEL_FR = ( 0.62, 1.34, 0.30, 0.30, 0.28, 0.17)
WHEEL_RL = (-0.60, -1.00, 0.34, 0.34, 0.42, 0.20)
WHEEL_RR = ( 0.60, -1.00, 0.34, 0.34, 0.42, 0.20)

# nose stripe ribbon
STRIPE_Y = (0.40, 2.27)


def stripe_hw(y):
    return min(0.068, half_w(y) * 0.46)


def stripe_z(y):
    return deck_z(y) + 0.010
