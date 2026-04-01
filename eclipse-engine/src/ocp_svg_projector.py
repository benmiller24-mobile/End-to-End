#!/usr/bin/env python3
"""
Eclipse OCP → SVG Projector
============================
Generates accurate 2D SVG floor plans and wall elevations by:
1. Building 3D OCP (OpenCascade) solid geometry for each cabinet
2. Composing cabinets into a scene at their solver-assigned positions
3. Projecting via HLR (Hidden Line Removal) to 2D
4. Extracting visible/hidden edges as SVG paths

This replaces the basic SVG rect-drawing in renderer.js with true
parametric geometry projected from 3D solids.

Usage:
    python ocp_svg_projector.py layout.json --output floor_plan.svg elevation_A.svg
"""

import json, math, sys, os

from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox
from OCP.BRepAlgoAPI import BRepAlgoAPI_Fuse
from OCP.gp import gp_Pnt, gp_Vec, gp_Dir, gp_Ax2, gp_Trsf, gp_Ax1
from OCP.HLRBRep import HLRBRep_Algo, HLRBRep_HLRToShape
from OCP.HLRAlgo import HLRAlgo_Projector
from OCP.BRepBuilderAPI import (
    BRepBuilderAPI_Transform,
    BRepBuilderAPI_MakeWire,
    BRepBuilderAPI_MakeEdge,
    BRepBuilderAPI_MakeFace,
)
from OCP.BRepPrimAPI import BRepPrimAPI_MakePrism
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_EDGE
from OCP.TopoDS import TopoDS, TopoDS_Compound
from OCP.BRep import BRep_Builder, BRep_Tool
from OCP.BRepAdaptor import BRepAdaptor_Curve
from OCP.GeomAbs import GeomAbs_Line, GeomAbs_Circle, GeomAbs_BSplineCurve
from OCP.GCPnts import GCPnts_QuasiUniformDeflection
from OCP.Bnd import Bnd_Box
from OCP.BRepBndLib import BRepBndLib


# ══════════════════════════════════════════════════════════════════════════════
# DEPTH / HEIGHT CONSTANTS (with 7/8" door thickness)
# ══════════════════════════════════════════════════════════════════════════════
DEPTH_BASE = 24.875     # 24 body + 0.875 door
DEPTH_UPPER = 13.875    # 13 body + 0.875 door
DEPTH_TALL = 24.875
DEPTH_COUNTER = 26.375  # 24.875 + 1.5 overhang
DEPTH_FRIDGE = 27.875
DEPTH_PANEL_W = 13.0    # panels have no door
DEPTH_PANEL_B = 24.0

HEIGHT_BASE = 30.5
HEIGHT_UPPER_30 = 30.0
HEIGHT_UPPER_36 = 36.0
HEIGHT_UPPER_39 = 39.0
HEIGHT_UPPER_42 = 42.0
HEIGHT_TALL_84 = 84.0
HEIGHT_TALL_90 = 90.0
HEIGHT_TALL_96 = 96.0

TOE_KICK = 4.0
COUNTER_THICK = 1.5
UPPER_MOUNT = 54.0  # AFF to bottom of wall cabinets

# Material colors for SVG fills (species-based)
SPECIES_COLORS = {
    'TFL':        '#8B8B8B',
    'Maple':      '#D4AF9F',
    'White Oak':  '#C9B89F',
    'Walnut':     '#4A3728',
    'Rift WO':    '#A89968',
    'Cherry':     '#8B4513',
    'Paint':      '#E8E4DF',
    'Custom Paint':'#D5CFC8',
    'default':    '#C0B49A',
}


# ══════════════════════════════════════════════════════════════════════════════
# CABINET GEOMETRY BUILDERS
# ══════════════════════════════════════════════════════════════════════════════

def make_base_cabinet(w, d=DEPTH_BASE, h=HEIGHT_BASE):
    """Base cabinet: main box on toe kick."""
    cab = BRepPrimAPI_MakeBox(gp_Pnt(0, 0, TOE_KICK), w, d, h).Shape()
    toe = BRepPrimAPI_MakeBox(gp_Pnt(3, 0, 0), w - 6, d - 0.5, TOE_KICK).Shape()
    return BRepAlgoAPI_Fuse(cab, toe).Shape()

def make_upper_cabinet(w, d=DEPTH_UPPER, h=36.0):
    """Wall cabinet mounted at UPPER_MOUNT."""
    return BRepPrimAPI_MakeBox(gp_Pnt(0, 0, UPPER_MOUNT), w, d, h).Shape()

def make_tall_cabinet(w, d=DEPTH_TALL, h=HEIGHT_TALL_84):
    """Tall/pantry cabinet from toe kick to near ceiling."""
    cab = BRepPrimAPI_MakeBox(gp_Pnt(0, 0, TOE_KICK), w, d, h - TOE_KICK).Shape()
    toe = BRepPrimAPI_MakeBox(gp_Pnt(3, 0, 0), w - 6, d - 0.5, TOE_KICK).Shape()
    return BRepAlgoAPI_Fuse(cab, toe).Shape()

def make_countertop(w, d=DEPTH_COUNTER):
    """Countertop slab above base cabinets."""
    z = TOE_KICK + HEIGHT_BASE
    return BRepPrimAPI_MakeBox(gp_Pnt(-0.75, -0.75, z), w + 1.5, d, COUNTER_THICK).Shape()

def make_appliance_volume(w, d, h, z_offset=TOE_KICK):
    """Generic appliance cutout volume."""
    return BRepPrimAPI_MakeBox(gp_Pnt(0, 0, z_offset), w, d, h).Shape()

def make_island_cabinet(w, d=DEPTH_BASE, h=HEIGHT_BASE, seating_depth=13.875):
    """Island with prep side (full depth) and seating side (shallow FHD backs)."""
    prep = BRepPrimAPI_MakeBox(gp_Pnt(0, 0, TOE_KICK), w, d, h).Shape()
    return prep

def make_panel(w, d, h, z_offset=0):
    """Thin end panel."""
    return BRepPrimAPI_MakeBox(gp_Pnt(0, 0, z_offset), w, d, h).Shape()


# ══════════════════════════════════════════════════════════════════════════════
# CABINET CLASSIFICATION → GEOMETRY
# ══════════════════════════════════════════════════════════════════════════════

def sku_to_solid(sku, width, height=None, depth=None, zone='BASE'):
    """Create 3D solid geometry from SKU code and dimensions."""
    s = sku.upper().strip()
    w = float(width)

    # End panels
    if any(s.startswith(p) for p in ('FWEP', 'FBEP', 'FREP', 'WEP', 'BEP', 'REP')):
        ep_h = float(height or 30.5)
        ep_d = float(depth or (13.0 if 'W' in s else 24.0))
        return make_panel(0.75, ep_d, ep_h, TOE_KICK)

    # Fillers
    if s.startswith('F') and any(c.isdigit() for c in s[1:4]):
        f_h = float(height or 30.5)
        return make_panel(w, 0.75, f_h, TOE_KICK)

    # Tall cabinets
    if any(s.startswith(p) for p in ('UT', 'PEC', 'O30', 'OM', 'FIO', 'TC')):
        t_h = float(height or 84.0)
        t_d = float(depth or DEPTH_TALL)
        return make_tall_cabinet(w, t_d, t_h)

    # Upper / wall cabinets
    if s.startswith('W') or s.startswith('SW') or s.startswith('RH'):
        u_h = float(height or 36.0)
        u_d = float(depth or DEPTH_UPPER)
        return make_upper_cabinet(w, u_d, u_h)

    # Base cabinets (B, SB, DSB, BBC, B2TD, B3D, B4D, BPOS, etc.)
    b_h = float(height or HEIGHT_BASE)
    b_d = float(depth or DEPTH_BASE)
    return make_base_cabinet(w, b_d, b_h)


# ══════════════════════════════════════════════════════════════════════════════
# SCENE COMPOSITION — place cabinets in 3D world coordinates
# ══════════════════════════════════════════════════════════════════════════════

def translate_shape(shape, dx, dy, dz):
    """Translate an OCP shape by (dx, dy, dz)."""
    trsf = gp_Trsf()
    trsf.SetTranslation(gp_Vec(dx, dy, dz))
    return BRepBuilderAPI_Transform(shape, trsf, True).Shape()

def rotate_shape_z(shape, angle_deg, cx=0, cy=0):
    """Rotate shape around Z axis at (cx, cy)."""
    trsf = gp_Trsf()
    trsf.SetRotation(gp_Ax1(gp_Pnt(cx, cy, 0), gp_Dir(0, 0, 1)), math.radians(angle_deg))
    return BRepBuilderAPI_Transform(shape, trsf, True).Shape()

def compose_compound(shapes):
    """Combine multiple shapes into a single compound."""
    builder = BRep_Builder()
    compound = TopoDS_Compound()
    builder.MakeCompound(compound)
    for s in shapes:
        builder.Add(compound, s)
    return compound


def build_wall_scene(placements, wall_id, wall_length, materials=None):
    """Build 3D scene for a single wall from solver placements.

    Placements is a list of dicts: {sku, width, x, zone, height?, depth?}
    Returns a TopoDS_Compound of all cabinet solids positioned along the wall.
    """
    shapes = []
    species = (materials or {}).get('species', 'default')

    for p in placements:
        if p.get('wall') != wall_id:
            continue

        sku = p.get('sku', 'B24')
        w = float(p.get('width', 24))
        x = float(p.get('x', 0))
        h = p.get('height')
        d = p.get('depth')
        zone = p.get('zone', 'BASE')

        solid = sku_to_solid(sku, w, h, d, zone)
        solid = translate_shape(solid, x, 0, 0)
        shapes.append(solid)

    # Add countertop spanning full base run
    base_cabs = [p for p in placements if p.get('wall') == wall_id and
                 p.get('zone', 'BASE') in ('BASE', 'SINK_BASE', 'CORNER')]
    if base_cabs:
        min_x = min(float(p.get('x', 0)) for p in base_cabs)
        max_x = max(float(p.get('x', 0)) + float(p.get('width', 0)) for p in base_cabs)
        ct = make_countertop(max_x - min_x)
        ct = translate_shape(ct, min_x, 0, 0)
        shapes.append(ct)

    return compose_compound(shapes) if shapes else None


def build_full_scene(placements, walls, island=None, materials=None):
    """Build complete 3D kitchen scene from all solver placements.

    walls: list of {id, length, angle?} — for floor plan layout
    Returns compound with all walls arranged at correct angles.
    """
    shapes = []

    for i, wall in enumerate(walls):
        wid = wall.get('id', chr(65 + i))
        wlen = float(wall.get('length', 120))
        angle = float(wall.get('angle', 0))

        wall_compound = build_wall_scene(placements, wid, wlen, materials)
        if wall_compound is None:
            continue

        # For L-shape: wall B is perpendicular to wall A
        if i == 0:
            shapes.append(wall_compound)
        elif i == 1:
            # Rotate 90° and place at end of wall A
            wall_a_len = float(walls[0].get('length', 120))
            rotated = rotate_shape_z(wall_compound, -90, 0, 0)
            rotated = translate_shape(rotated, wall_a_len, 0, 0)
            shapes.append(rotated)
        elif i == 2:
            # U-shape: wall C parallel to wall A at depth
            wall_b_len = float(walls[1].get('length', 120))
            rotated = rotate_shape_z(wall_compound, 180, 0, 0)
            rotated = translate_shape(rotated, float(walls[0].get('length', 120)),
                                       wall_b_len, 0)
            shapes.append(rotated)

    # Island
    island_cabs = [p for p in placements if p.get('zone') == 'ISLAND' or
                   p.get('wall') == 'ISLAND']
    if island_cabs:
        for p in island_cabs:
            sku = p.get('sku', 'B24')
            w = float(p.get('width', 24))
            solid = sku_to_solid(sku, w)
            # Position island in center of room
            ix = float(p.get('x', 48))
            iy = float(p.get('y', 60))
            solid = translate_shape(solid, ix, iy, 0)
            shapes.append(solid)

    return compose_compound(shapes) if shapes else None


# ══════════════════════════════════════════════════════════════════════════════
# HLR PROJECTION — 3D → 2D edge extraction
# ══════════════════════════════════════════════════════════════════════════════

def project_top_down(compound):
    """Project compound looking straight down (floor plan view).

    Projector: eye at (0,0,200) looking -Z, Vx=(1,0,0).
    Result: proj_X = model_X, proj_Y = -model_Y.
    Returns (visible_edges, hidden_edges) as TopoDS_Shapes.
    """
    hlr = HLRBRep_Algo()
    hlr.Add(compound)
    proj = HLRAlgo_Projector(
        gp_Ax2(gp_Pnt(0, 0, 200), gp_Dir(0, 0, -1), gp_Dir(1, 0, 0))
    )
    hlr.Projector(proj)
    hlr.Update()
    hlr.Hide()
    shape = HLRBRep_HLRToShape(hlr)
    return shape.VCompound(), shape.HCompound()


def project_front_face(compound, wall_angle=0):
    """Project compound looking at front face (wall elevation).

    Projector: eye at (0,200,0) looking -Y, Vx=(1,0,0).
    Result: proj_X = model_X, proj_Y = model_Z.
    Returns (visible_edges, hidden_edges).
    """
    hlr = HLRBRep_Algo()
    hlr.Add(compound)
    proj = HLRAlgo_Projector(
        gp_Ax2(gp_Pnt(0, 200, 0), gp_Dir(0, -1, 0), gp_Dir(1, 0, 0))
    )
    hlr.Projector(proj)
    hlr.Update()
    hlr.Hide()
    shape = HLRBRep_HLRToShape(hlr)
    return shape.VCompound(), shape.HCompound()


# ══════════════════════════════════════════════════════════════════════════════
# EDGE → SVG PATH EXTRACTION
# ══════════════════════════════════════════════════════════════════════════════

def edges_to_svg_paths(edge_compound, scale=1.0, offset_x=0, offset_y=0, flip_y=False):
    """Extract all edges from a compound and convert to SVG path data.

    Returns list of path 'd' strings ready for <path d="..."/>.
    """
    if edge_compound is None or edge_compound.IsNull():
        return []

    paths = []
    explorer = TopExp_Explorer(edge_compound, TopAbs_EDGE)

    while explorer.More():
        edge = TopoDS.Edge_s(explorer.Current())
        try:
            path_d = _edge_to_svg_path(edge, scale, offset_x, offset_y, flip_y)
            if path_d:
                paths.append(path_d)
        except Exception:
            pass
        explorer.Next()

    return paths


def _edge_to_svg_path(edge, scale, ox, oy, flip_y):
    """Convert a single OCP edge to an SVG path 'd' string."""
    curve = BRepAdaptor_Curve(edge)
    ctype = curve.GetType()

    if ctype == GeomAbs_Line:
        p1 = curve.Value(curve.FirstParameter())
        p2 = curve.Value(curve.LastParameter())
        x1 = p1.X() * scale + ox
        y1 = (-p1.Y() if flip_y else p1.Y()) * scale + oy
        x2 = p2.X() * scale + ox
        y2 = (-p2.Y() if flip_y else p2.Y()) * scale + oy
        return f"M {x1:.2f} {y1:.2f} L {x2:.2f} {y2:.2f}"

    # For curves (circles, splines) — sample points
    try:
        defl = GCPnts_QuasiUniformDeflection(curve, 0.1)
        if defl.NbPoints() < 2:
            return None
        pts = []
        for i in range(1, defl.NbPoints() + 1):
            p = defl.Value(i)
            x = p.X() * scale + ox
            y = (-p.Y() if flip_y else p.Y()) * scale + oy
            pts.append((x, y))
        parts = [f"M {pts[0][0]:.2f} {pts[0][1]:.2f}"]
        for x, y in pts[1:]:
            parts.append(f"L {x:.2f} {y:.2f}")
        return " ".join(parts)
    except Exception:
        # Fallback: sample at fixed intervals
        p1 = curve.Value(curve.FirstParameter())
        p2 = curve.Value(curve.LastParameter())
        x1 = p1.X() * scale + ox
        y1 = (-p1.Y() if flip_y else p1.Y()) * scale + oy
        x2 = p2.X() * scale + ox
        y2 = (-p2.Y() if flip_y else p2.Y()) * scale + oy
        return f"M {x1:.2f} {y1:.2f} L {x2:.2f} {y2:.2f}"


# ══════════════════════════════════════════════════════════════════════════════
# SVG DOCUMENT GENERATION
# ══════════════════════════════════════════════════════════════════════════════

def get_bounding_box(compound):
    """Get the axis-aligned bounding box of a compound."""
    bbox = Bnd_Box()
    BRepBndLib.Add_s(compound, bbox)
    xmin, ymin, zmin, xmax, ymax, zmax = bbox.Get()
    return (xmin, ymin, zmin, xmax, ymax, zmax)


def get_projected_bounds(visible, hidden):
    """Get 2D bounds from HLR-projected edge compounds.
    Returns (xmin, ymin, xmax, ymax) of the actual projected edges."""
    bbox = Bnd_Box()
    has_data = False
    if visible is not None and not visible.IsNull():
        BRepBndLib.Add_s(visible, bbox)
        has_data = True
    if hidden is not None and not hidden.IsNull():
        BRepBndLib.Add_s(hidden, bbox)
        has_data = True
    if not has_data:
        return (0, 0, 100, 100)
    xmin, ymin, _, xmax, ymax, _ = bbox.Get()
    return (xmin, ymin, xmax, ymax)


def _cabinet_footprints_2d(placements, walls, scale, ox, oy, species_color):
    """Generate PROFESSIONAL 2D cabinet footprints with appliance details (floor plan).

    Draws cabinet outlines with interior details:
    - Sink: rounded rectangle basin + drain circle
    - Range/Cooktop: 4 burner circles (2×2 grid)
    - Fridge: outline with door swing arc
    - Dishwasher: diagonal hatching
    - Base cabinets: door line(s) + knob
    - Upper cabinets: dashed outline
    - Corner: lazy susan circle

    Coordinate mapping: SVG_X = model_X * scale + ox, SVG_Y = model_Y * scale + oy
    """
    rects = []
    details = []
    labels = []
    hatches = []  # For DW hatching

    wall_a_len = float(walls[0].get('length', 120)) if walls else 120

    for p in placements:
        sku = p.get('sku', '').upper().strip()
        w = float(p.get('width', 24))
        x = float(p.get('x', 0))
        wall_id = p.get('wall', 'A')
        zone = p.get('zone', 'BASE')

        if zone in ('UPPER', 'WALL', 'CROWN'):
            depth = DEPTH_UPPER
        elif zone in ('TALL', 'PANTRY'):
            depth = DEPTH_TALL
        else:
            depth = DEPTH_BASE

        wall_idx = next((i for i, ww in enumerate(walls) if ww.get('id') == wall_id), 0)

        # Compute SVG rectangle position
        if wall_id == 'ISLAND':
            ix = float(p.get('x', 48))
            iy = float(p.get('y', 60))
            rx = ix * scale + ox
            ry = iy * scale + oy
            rw = w * scale
            rh = depth * scale
        elif wall_idx == 0:
            rx = x * scale + ox
            ry = 0 * scale + oy
            rw = w * scale
            rh = depth * scale
        elif wall_idx == 1:
            rx = wall_a_len * scale + ox
            ry = -(x + w) * scale + oy
            rw = depth * scale
            rh = w * scale
        else:
            rx = x * scale + ox
            ry = oy
            rw = w * scale
            rh = depth * scale

        # Cabinet outline
        opacity = 0.15 if zone in ('UPPER', 'WALL', 'CROWN') else 0.30
        rects.append(f'<rect x="{rx:.1f}" y="{ry:.1f}" width="{rw:.1f}" height="{rh:.1f}" '
                     f'fill="{species_color}" fill-opacity="{opacity}" '
                     f'stroke="#555" stroke-width="1.0" rx="0"/>')

        # ─────────────────────────────────────────────────────────
        # APPLIANCE & CABINET DETAILS
        # ─────────────────────────────────────────────────────────

        # SINK: Rounded basin + drain
        if 'SB' in sku:
            basin_margin = 3 * scale
            basin_x = rx + basin_margin
            basin_y = ry + basin_margin
            basin_w = rw - 2 * basin_margin
            basin_h = rh - 2 * basin_margin
            details.append(f'<ellipse cx="{basin_x + basin_w/2:.1f}" cy="{basin_y + basin_h/2:.1f}" '
                          f'rx="{basin_w/2:.1f}" ry="{basin_h/2:.1f}" '
                          f'fill="none" stroke="#333" stroke-width="1.5"/>')
            # Drain circle
            drain_cx = basin_x + basin_w * 0.75
            drain_cy = basin_y + basin_h * 0.75
            details.append(f'<circle cx="{drain_cx:.1f}" cy="{drain_cy:.1f}" r="2.5" '
                          f'fill="none" stroke="#666" stroke-width="0.8"/>')

        # RANGE/COOKTOP: 4 burners in 2×2 grid
        elif 'RANGE' in sku or 'COOKTOP' in sku:
            burner_margin = 2.5 * scale
            burner_x_start = rx + burner_margin
            burner_y_start = ry + burner_margin
            burner_width = (rw - 3 * burner_margin) / 2
            burner_height = (rh - 3 * burner_margin) / 2
            # Front burners (smaller)
            for i in range(2):
                cx = burner_x_start + i * (burner_width + burner_margin) + burner_width/2
                cy = burner_y_start + burner_height/2
                r = (burner_width / 2) * 0.6
                details.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" '
                              f'fill="none" stroke="#333" stroke-width="1"/>')
            # Back burners (larger)
            for i in range(2):
                cx = burner_x_start + i * (burner_width + burner_margin) + burner_width/2
                cy = burner_y_start + burner_height + burner_margin + burner_height/2
                r = (burner_width / 2) * 0.75
                details.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" '
                              f'fill="none" stroke="#333" stroke-width="1"/>')

        # FRIDGE: Outline + door swing arc
        elif 'FRIDGE' in sku:
            details.append(f'<rect x="{rx+1:.1f}" y="{ry+1:.1f}" width="{rw-2:.1f}" height="{rh-2:.1f}" '
                          f'fill="none" stroke="#333" stroke-width="1.2"/>')
            # Door swing arc (90° from hinge)
            arc_r = (rw - 2) * 0.9
            details.append(f'<path d="M {rx+1:.1f} {ry+1:.1f} A {arc_r:.1f} {arc_r:.1f} 0 0 1 {rx+1+arc_r:.1f} {ry+1:.1f}" '
                          f'fill="none" stroke="#999" stroke-width="0.6" stroke-dasharray="2,1.5"/>')

        # DISHWASHER: Diagonal hatching
        elif 'DW' in sku:
            hatch_spacing = 2.5 * scale
            num_lines = int((rw + rh) / hatch_spacing) + 2
            for i in range(-num_lines, num_lines):
                x1 = rx + i * hatch_spacing
                y1 = ry
                x2 = x1 + rh * 1.5
                y2 = ry + rh
                hatches.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
                              f'stroke="#ddd" stroke-width="0.5"/>')
            details.append(f'<rect x="{rx:.1f}" y="{ry:.1f}" width="{rw:.1f}" height="{rh:.1f}" '
                          f'fill="none" stroke="#333" stroke-width="1"/>')

        # BASE CABINETS: Door line(s) + knob
        elif zone not in ('UPPER', 'WALL', 'CROWN', 'TALL', 'PANTRY'):
            if w < 24:
                # Single door
                door_x = rx + rw / 2
                details.append(f'<line x1="{door_x:.1f}" y1="{ry+1:.1f}" x2="{door_x:.1f}" '
                              f'y2="{ry+rh-1:.1f}" stroke="#333" stroke-width="0.8"/>')
                # Knob
                knob_y = ry + rh * 0.6
                details.append(f'<circle cx="{door_x + 4:.1f}" cy="{knob_y:.1f}" r="1.5" '
                              f'fill="#999" stroke="none"/>')
            else:
                # Two door panels
                door1_x = rx + rw * 0.25
                door2_x = rx + rw * 0.75
                details.append(f'<line x1="{door1_x:.1f}" y1="{ry+1:.1f}" x2="{door1_x:.1f}" '
                              f'y2="{ry+rh-1:.1f}" stroke="#333" stroke-width="0.8"/>')
                details.append(f'<line x1="{door2_x:.1f}" y1="{ry+1:.1f}" x2="{door2_x:.1f}" '
                              f'y2="{ry+rh-1:.1f}" stroke="#333" stroke-width="0.8"/>')
                # Knobs
                details.append(f'<circle cx="{door1_x + 3:.1f}" cy="{ry + rh*0.6:.1f}" r="1.5" '
                              f'fill="#999" stroke="none"/>')
                details.append(f'<circle cx="{door2_x + 3:.1f}" cy="{ry + rh*0.6:.1f}" r="1.5" '
                              f'fill="#999" stroke="none"/>')

        # UPPER CABINETS: Dashed outline
        if zone in ('UPPER', 'WALL', 'CROWN'):
            details.append(f'<rect x="{rx+0.5:.1f}" y="{ry+0.5:.1f}" width="{rw-1:.1f}" height="{rh-1:.1f}" '
                          f'fill="none" stroke="#888" stroke-width="0.7" stroke-dasharray="4,2"/>')

        # CORNER (BL36, BR36): Lazy susan circle
        if 'BL36' in sku or 'BR36' in sku:
            ls_r = min(rw, rh) * 0.35
            cx = rx + rw / 2
            cy = ry + rh / 2
            details.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{ls_r:.1f}" '
                          f'fill="none" stroke="#666" stroke-width="0.8" stroke-dasharray="2,1"/>')

        # Label
        lx = rx + rw / 2
        ly = ry + rh / 2 + 3
        font_size = 7 if len(sku) > 8 else 8
        labels.append(f'<text x="{lx:.1f}" y="{ly:.1f}" text-anchor="middle" '
                      f'fill="#333" font-size="{font_size}" font-weight="500">{sku}</text>')

    return rects + hatches + details, labels


def _cabinet_faces_2d(placements, wall_id, scale, ox, oy, species_color):
    """Generate PROFESSIONAL 2D cabinet faces with door/drawer details (elevation).

    Draws cabinet faces with:
    - Door panels with 3mm reveal gaps
    - Drawer faces with 2mm gaps
    - Hardware pulls at proper heights
    - Special appliance details (range, hood, fridge, etc.)

    Coordinate mapping: SVG_X = model_X * scale + ox, SVG_Y = -model_Z * scale + oy
    (Higher Z → lower SVG_Y → higher on screen)
    """
    rects = []
    details = []
    labels = []

    for p in placements:
        if p.get('wall') != wall_id:
            continue

        sku = p.get('sku', '').upper().strip()
        w = float(p.get('width', 24))
        x = float(p.get('x', 0))
        zone = p.get('zone', 'BASE')
        h_cab = float(p.get('height', 0))

        rx = x * scale + ox

        if zone in ('UPPER', 'WALL', 'CROWN'):
            h_cab = h_cab or 36.0
            z_top = UPPER_MOUNT + h_cab
            z_bot = UPPER_MOUNT
            opacity = 0.15
            is_upper = True
        elif zone in ('TALL', 'PANTRY'):
            h_cab = h_cab or 84.0
            z_top = h_cab
            z_bot = TOE_KICK
            opacity = 0.25
            is_upper = False
        else:
            h_cab = h_cab or HEIGHT_BASE
            z_top = TOE_KICK + h_cab
            z_bot = TOE_KICK
            opacity = 0.25
            is_upper = False

        rw = w * scale
        ry = -z_top * scale + oy
        rh = (z_top - z_bot) * scale

        # Cabinet outline
        rects.append(f'<rect x="{rx:.1f}" y="{ry:.1f}" width="{rw:.1f}" height="{rh:.1f}" '
                     f'fill="{species_color}" fill-opacity="{opacity}" '
                     f'stroke="#555" stroke-width="1.0" rx="0"/>')

        # ─────────────────────────────────────────────────────────
        # DOOR & DRAWER DETAILS
        # ─────────────────────────────────────────────────────────

        reveal = 1.5 * scale  # 3mm reveal gap
        gap = 1.0 * scale    # 2mm gaps

        # DRAWER BASE (B3D = 3-drawer)
        if 'B3D' in sku:
            drawer_h = (rh - 2 * gap) / 3
            for i in range(3):
                dy = i * (drawer_h + gap)
                dr_y = ry + gap + dy
                dr_h = drawer_h
                details.append(f'<rect x="{rx + reveal:.1f}" y="{dr_y:.1f}" '
                              f'width="{rw - 2*reveal:.1f}" height="{dr_h:.1f}" '
                              f'fill="none" stroke="#333" stroke-width="0.8"/>')
                # Pull handle
                pull_x = rx + rw / 2
                pull_y = dr_y + dr_h / 2
                details.append(f'<line x1="{pull_x - 3:.1f}" y1="{pull_y:.1f}" '
                              f'x2="{pull_x + 3:.1f}" y2="{pull_y:.1f}" '
                              f'stroke="#666" stroke-width="1.2"/>')

        # ROLL-OUT TRAY BASE (B-RT)
        elif 'RT' in sku:
            door_y = ry + reveal
            door_h = rh - 2 * reveal
            details.append(f'<rect x="{rx + reveal:.1f}" y="{door_y:.1f}" '
                          f'width="{rw - 2*reveal:.1f}" height="{door_h:.1f}" '
                          f'fill="none" stroke="#333" stroke-width="0.9"/>')
            # RT label
            details.append(f'<text x="{rx + rw/2:.1f}" y="{ry + rh/2 + 2:.1f}" '
                          f'text-anchor="middle" fill="#666" font-size="6" '
                          f'font-weight="600">RT</text>')

        # SINK BASE (SB) — 2 door panels or single FHD
        elif 'SB' in sku:
            if w >= 36:
                # 2 panels
                door1_x = rx + reveal
                door1_w = (rw - 3 * reveal) / 2
                door2_x = rx + reveal + door1_w + gap
                door_y = ry + reveal
                door_h = rh - 2 * reveal
                for door_x in [door1_x, door2_x]:
                    details.append(f'<rect x="{door_x:.1f}" y="{door_y:.1f}" '
                                  f'width="{door1_w:.1f}" height="{door_h:.1f}" '
                                  f'fill="none" stroke="#333" stroke-width="0.9"/>')
                    # Pull bar
                    pull_y = door_y + door_h * 0.65
                    details.append(f'<line x1="{door_x + 2:.1f}" y1="{pull_y:.1f}" '
                                  f'x2="{door_x + door1_w - 2:.1f}" y2="{pull_y:.1f}" '
                                  f'stroke="#666" stroke-width="1"/>')
            else:
                # Single panel or FHD
                door_y = ry + reveal
                door_h = rh - 2 * reveal
                details.append(f'<rect x="{rx + reveal:.1f}" y="{door_y:.1f}" '
                              f'width="{rw - 2*reveal:.1f}" height="{door_h:.1f}" '
                              f'fill="none" stroke="#333" stroke-width="0.9"/>')
                pull_y = door_y + door_h * 0.65
                details.append(f'<line x1="{rx + 2:.1f}" y1="{pull_y:.1f}" '
                              f'x2="{rx + rw - 2:.1f}" y2="{pull_y:.1f}" '
                              f'stroke="#666" stroke-width="1"/>')

        # RANGE — stovetop + oven door
        elif 'RANGE' in sku:
            # Cooktop area (top 40% of cabinet)
            cooktop_h = rh * 0.4
            details.append(f'<rect x="{rx + 2:.1f}" y="{ry + 2:.1f}" '
                          f'width="{rw - 4:.1f}" height="{cooktop_h - 2:.1f}" '
                          f'fill="#f5f5f5" stroke="#333" stroke-width="0.8"/>')
            # Burner circles (2×2)
            b_x_step = (rw - 4) / 2.5
            b_y_step = cooktop_h / 2.2
            for row in range(2):
                for col in range(2):
                    b_x = rx + 3 + col * b_x_step + b_x_step / 2 - 0.5
                    b_y = ry + 3 + row * b_y_step + b_y_step / 2
                    b_r = (2.5 if row == 0 else 3) * scale
                    details.append(f'<circle cx="{b_x:.1f}" cy="{b_y:.1f}" r="{b_r:.1f}" '
                                  f'fill="none" stroke="#333" stroke-width="0.7"/>')
            # Oven door (bottom 60%)
            oven_y = ry + cooktop_h
            oven_h = rh - cooktop_h - 2
            details.append(f'<rect x="{rx + 2:.1f}" y="{oven_y:.1f}" '
                          f'width="{rw - 4:.1f}" height="{oven_h:.1f}" '
                          f'fill="none" stroke="#333" stroke-width="0.9"/>')
            # Door handle
            handle_y = oven_y + oven_h * 0.5
            details.append(f'<line x1="{rx + rw - 3:.1f}" y1="{handle_y - 2:.1f}" '
                          f'x2="{rx + rw - 3:.1f}" y2="{handle_y + 2:.1f}" '
                          f'stroke="#666" stroke-width="1.2"/>')
            # Front knobs
            knob_y = oven_y + oven_h - 4
            for knob_x in [rx + 4, rx + rw/3, rx + 2*rw/3, rx + rw - 4]:
                details.append(f'<circle cx="{knob_x:.1f}" cy="{knob_y:.1f}" r="1.5" '
                              f'fill="#999" stroke="none"/>')

        # RANGE HOOD (RH) — Trapezoidal profile
        elif 'RH' in sku:
            hood_y = ry + 2
            hood_h = rh - 4
            # Wider at bottom, narrower at top
            bottom_w = rw * 0.9
            top_w = rw * 0.7
            bottom_margin = (rw - bottom_w) / 2
            top_margin = (rw - top_w) / 2
            points = (f"{rx + bottom_margin:.1f},{hood_y + hood_h:.1f} "
                     f"{rx + bottom_margin + bottom_w:.1f},{hood_y + hood_h:.1f} "
                     f"{rx + top_margin + top_w:.1f},{hood_y:.1f} "
                     f"{rx + top_margin:.1f},{hood_y:.1f}")
            details.append(f'<polygon points="{points}" fill="none" '
                          f'stroke="#333" stroke-width="0.9"/>')

        # REFRIGERATOR — Full height panel + handle bar
        elif 'FRIDGE' in sku:
            details.append(f'<rect x="{rx + reveal:.1f}" y="{ry + reveal:.1f}" '
                          f'width="{rw - 2*reveal:.1f}" height="{rh - 2*reveal:.1f}" '
                          f'fill="none" stroke="#333" stroke-width="1"/>')
            # Handle bar (vertical)
            handle_x = rx + rw - 3
            details.append(f'<line x1="{handle_x:.1f}" y1="{ry + 4:.1f}" '
                          f'x2="{handle_x:.1f}" y2="{ry + rh - 4:.1f}" '
                          f'stroke="#666" stroke-width="1.2"/>')

        # DISHWASHER (DW) — Panel + bar handle
        elif 'DW' in sku:
            door_y = ry + reveal
            door_h = rh - 2 * reveal
            details.append(f'<rect x="{rx + reveal:.1f}" y="{door_y:.1f}" '
                          f'width="{rw - 2*reveal:.1f}" height="{door_h:.1f}" '
                          f'fill="none" stroke="#333" stroke-width="0.9"/>')
            # Bar handle
            handle_y = door_y + door_h * 0.5
            details.append(f'<line x1="{rx + 2:.1f}" y1="{handle_y:.1f}" '
                          f'x2="{rx + rw - 2:.1f}" y2="{handle_y:.1f}" '
                          f'stroke="#666" stroke-width="1.2"/>')

        # STANDARD BASE CABINET — 1 or 2 door panels
        elif zone not in ('UPPER', 'WALL', 'CROWN', 'TALL', 'PANTRY'):
            if w < 24:
                # Single door
                door_y = ry + reveal
                door_h = rh - 2 * reveal
                details.append(f'<rect x="{rx + reveal:.1f}" y="{door_y:.1f}" '
                              f'width="{rw - 2*reveal:.1f}" height="{door_h:.1f}" '
                              f'fill="none" stroke="#333" stroke-width="0.9"/>')
                # Pull
                pull_y = door_y + door_h * 0.65
                details.append(f'<circle cx="{rx + rw - 3.5:.1f}" cy="{pull_y:.1f}" r="1.2" '
                              f'fill="none" stroke="#666" stroke-width="0.8"/>')
            else:
                # Two door panels
                door1_x = rx + reveal
                door1_w = (rw - 3 * reveal) / 2
                door2_x = rx + reveal + door1_w + gap
                door_y = ry + reveal
                door_h = rh - 2 * reveal
                for door_x in [door1_x, door2_x]:
                    details.append(f'<rect x="{door_x:.1f}" y="{door_y:.1f}" '
                                  f'width="{door1_w:.1f}" height="{door_h:.1f}" '
                                  f'fill="none" stroke="#333" stroke-width="0.9"/>')
                    # Pull (centered on each door)
                    pull_x = door_x + door1_w - 3.5
                    pull_y = door_y + door_h * 0.65
                    details.append(f'<circle cx="{pull_x:.1f}" cy="{pull_y:.1f}" r="1.2" '
                                  f'fill="none" stroke="#666" stroke-width="0.8"/>')

        # UPPER CABINET DOORS
        if is_upper:
            if w < 24:
                # Single door
                door_y = ry + reveal
                door_h = rh - 2 * reveal
                details.append(f'<rect x="{rx + reveal:.1f}" y="{door_y:.1f}" '
                              f'width="{rw - 2*reveal:.1f}" height="{door_h:.1f}" '
                              f'fill="none" stroke="#333" stroke-width="0.8"/>')
                # Pull at bottom of door
                pull_y = door_y + door_h - 4
                details.append(f'<circle cx="{rx + rw - 3:.1f}" cy="{pull_y:.1f}" r="1" '
                              f'fill="none" stroke="#666" stroke-width="0.7"/>')
            else:
                # Two doors
                door1_x = rx + reveal
                door1_w = (rw - 3 * reveal) / 2
                door2_x = rx + reveal + door1_w + gap
                door_y = ry + reveal
                door_h = rh - 2 * reveal
                for door_x in [door1_x, door2_x]:
                    details.append(f'<rect x="{door_x:.1f}" y="{door_y:.1f}" '
                                  f'width="{door1_w:.1f}" height="{door_h:.1f}" '
                                  f'fill="none" stroke="#333" stroke-width="0.8"/>')
                    pull_x = door_x + door1_w - 3
                    pull_y = door_y + door_h - 4
                    details.append(f'<circle cx="{pull_x:.1f}" cy="{pull_y:.1f}" r="1" '
                                  f'fill="none" stroke="#666" stroke-width="0.7"/>')

        # Label
        lx = rx + rw / 2
        ly = ry + rh / 2 + 3
        font_size = 7 if len(sku) > 8 else 8
        labels.append(f'<text x="{lx:.1f}" y="{ly:.1f}" text-anchor="middle" '
                      f'fill="#333" font-size="{font_size}" font-weight="600">{sku}</text>')

    return rects + details, labels


def generate_floor_plan_svg(placements, walls, island=None, materials=None,
                            title="Floor Plan", scale=5.0, margin=80):
    """Generate a PROFESSIONAL floor plan SVG with architectural details.

    Includes:
    - 6" wall lines with proper L-corner junctions
    - Countertop outline (1.5" overhang) in teal
    - Work triangle (sink/range/fridge) with labeled leg lengths
    - Zone labels with colors
    - Proper architectural dimension lines with tick marks
    - Window indicator on Wall B
    - North arrow in top-right corner
    - OCP HLR projection for accurate cabinet geometry
    """
    # Build 3D scene
    compound = build_full_scene(placements, walls, island, materials)
    if compound is None:
        return _empty_svg(title, 800, 600)

    # Project top-down
    visible, hidden = project_top_down(compound)

    # Get bounds from PROJECTED edges
    pxmin, pymin, pxmax, pymax = get_projected_bounds(visible, hidden)

    # Content area dimensions
    content_w = (pxmax - pxmin) * scale
    content_h = (pymax - pymin) * scale
    header_h = 70
    footer_h = 100
    w = content_w + margin * 2
    h = content_h + margin * 2 + header_h + footer_h

    species = (materials or {}).get('species', 'default')
    door_style = (materials or {}).get('doorStyle', '')
    fill_color = SPECIES_COLORS.get(species, SPECIES_COLORS['default'])

    ox = margin - pxmin * scale
    oy = margin + header_h + pymax * scale

    # Extract SVG paths
    vis_paths = edges_to_svg_paths(visible, scale, ox, oy, flip_y=True)
    hid_paths = edges_to_svg_paths(hidden, scale, ox, oy, flip_y=True)

    # Cabinet footprints with appliance details
    fp_rects, fp_labels = _cabinet_footprints_2d(placements, walls, scale, ox, oy, fill_color)

    # Find appliance positions for work triangle
    wall_a_len = float(walls[0].get('length', 120)) if walls else 120
    sink_pos = None
    range_pos = None
    fridge_pos = None

    for p in placements:
        sku = p.get('sku', '').upper()
        w_cab = float(p.get('width', 24))
        x = float(p.get('x', 0))
        wall_id = p.get('wall', 'A')

        if 'SB' in sku:
            # Sink position (center of cabinet)
            if wall_id == 'A':
                sink_pos = ((x + w_cab/2) * scale + ox, oy)
            elif wall_id == 'B':
                sink_pos = (wall_a_len * scale + ox, -(x + w_cab/2) * scale + oy)

        elif 'RANGE' in sku:
            if wall_id == 'A':
                range_pos = ((x + w_cab/2) * scale + ox, oy)
            elif wall_id == 'B':
                range_pos = (wall_a_len * scale + ox, -(x + w_cab/2) * scale + oy)

        elif 'FRIDGE' in sku:
            if wall_id == 'A':
                fridge_pos = ((x + w_cab/2) * scale + ox, oy)
            elif wall_id == 'B':
                fridge_pos = (wall_a_len * scale + ox, -(x + w_cab/2) * scale + oy)

    # Build SVG
    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" '
        f'width="{w:.0f}" height="{h:.0f}" '
        f'style="background:#fff;font-family:Calibri,Helvetica,sans-serif;">',
        '<defs>',
        '  <marker id="tick" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">',
        '    <rect x="0" y="-1" width="4" height="2" fill="#1B3A5C"/>',
        '  </marker>',
        '  <pattern id="wall_fill" patternUnits="userSpaceOnUse" width="8" height="8">',
        '    <rect width="8" height="8" fill="#e2e8f0"/>',
        '  </pattern>',
        '</defs>',
        '',
        '<!-- Title bar -->',
        f'<rect x="0" y="0" width="{w:.0f}" height="36" fill="#1B3A5C"/>',
        f'<text x="16" y="24" fill="#fff" font-size="13" font-weight="600" '
        f'letter-spacing="1.5">ECLIPSE CABINETRY</text>',
        f'<text x="{w-16:.0f}" y="24" fill="#fff" font-size="10" text-anchor="end">'
        f'FLOOR PLAN</text>',
        '',
        f'<text x="40" y="58" fill="#1B3A5C" font-size="16" font-weight="700">{title}</text>',
        f'<line x1="40" y1="64" x2="{w-40:.0f}" y2="64" stroke="#1B3A5C" stroke-width="2"/>',
        '',
    ]

    # --- WALL OUTLINES (6" thick, #555 color) ---
    wall_thickness = 6 * scale
    lines.append('<!-- Wall outlines (6" thick) -->')
    if walls:
        # Wall A
        wall_a_len = float(walls[0].get('length', 120))
        wall_a_x1 = ox
        wall_a_x2 = ox + wall_a_len * scale
        wall_a_y = oy
        lines.append(f'<rect x="{wall_a_x1:.1f}" y="{wall_a_y:.1f}" '
                    f'width="{wall_a_x2 - wall_a_x1:.1f}" height="{wall_thickness:.1f}" '
                    f'fill="#e2e8f0" stroke="#555" stroke-width="1.5"/>')
        lines.append(f'<text x="{wall_a_x1 + (wall_a_x2-wall_a_x1)/2:.0f}" y="{wall_a_y + wall_thickness/2 + 3:.0f}" '
                    f'text-anchor="middle" fill="#666" font-size="8" font-weight="600">WALL A</text>')

        if len(walls) > 1:
            # Wall B (perpendicular)
            wall_b_len = float(walls[1].get('length', 120))
            wall_b_x = ox + wall_a_len * scale
            wall_b_y1 = oy
            wall_b_y2 = oy - wall_b_len * scale
            lines.append(f'<rect x="{wall_b_x:.1f}" y="{wall_b_y2:.1f}" '
                        f'width="{wall_thickness:.1f}" height="{wall_b_y1 - wall_b_y2:.1f}" '
                        f'fill="#e2e8f0" stroke="#555" stroke-width="1.5"/>')
            lines.append(f'<text x="{wall_b_x + wall_thickness/2:.0f}" y="{wall_b_y2 + (wall_b_y1-wall_b_y2)/2:.0f}" '
                        f'text-anchor="middle" fill="#666" font-size="8" font-weight="600" '
                        f'transform="rotate(90,{wall_b_x + wall_thickness/2:.0f},{wall_b_y2 + (wall_b_y1-wall_b_y2)/2:.0f})">WALL B</text>')

    # --- COUNTERTOP OUTLINE (1.5" overhang, teal) ---
    lines.append('')
    lines.append('<!-- Countertop outline (1.5" overhang, teal) -->')
    ct_overhang = 1.5 * scale
    for p in placements:
        zone = p.get('zone', 'BASE')
        if zone in ('BASE', 'SINK_BASE', 'CORNER'):
            w_cab = float(p.get('width', 24))
            x = float(p.get('x', 0))
            wall_id = p.get('wall', 'A')
            wall_idx = next((i for i, ww in enumerate(walls) if ww.get('id') == wall_id), 0)

            if wall_idx == 0:
                ct_x = x * scale + ox - ct_overhang
                ct_y = oy - DEPTH_BASE * scale - ct_overhang
                ct_w = w_cab * scale + 2 * ct_overhang
                ct_h = (DEPTH_BASE + 1.5) * scale + ct_overhang
            elif wall_idx == 1:
                ct_x = ox + wall_a_len * scale - (DEPTH_BASE + 1.5) * scale - ct_overhang
                ct_y = -(x + w_cab) * scale + oy - ct_overhang
                ct_w = (DEPTH_BASE + 1.5) * scale + ct_overhang
                ct_h = w_cab * scale + 2 * ct_overhang
            else:
                continue

            lines.append(f'<rect x="{ct_x:.1f}" y="{ct_y:.1f}" width="{ct_w:.1f}" height="{ct_h:.1f}" '
                        f'fill="none" stroke="#0d9488" stroke-width="1.5" stroke-dasharray="4,2"/>')

    # --- CABINET FOOTPRINTS ---
    lines.append('')
    lines.append('<!-- Cabinet footprints (filled) -->')
    for r in fp_rects:
        lines.append(r)
    lines.append('')

    # --- HLR VISIBLE EDGES ---
    lines.append('<!-- OCP HLR visible edges -->')
    lines.append('<g stroke="#333" stroke-width="1.0" fill="none" stroke-linecap="round">')
    for p in vis_paths:
        lines.append(f'  <path d="{p}"/>')
    lines.append('</g>')

    # --- HLR HIDDEN EDGES ---
    if hid_paths:
        lines.append('')
        lines.append('<!-- OCP HLR hidden edges -->')
        lines.append('<g stroke="#bbb" stroke-width="0.4" fill="none" '
                     'stroke-dasharray="3,2" stroke-linecap="round">')
        for p in hid_paths:
            lines.append(f'  <path d="{p}"/>')
        lines.append('</g>')

    # --- WORK TRIANGLE ---
    if sink_pos and range_pos and fridge_pos:
        lines.append('')
        lines.append('<!-- Work triangle -->')
        lines.append('<g stroke="#ff8c00" stroke-width="1.2" fill="none" stroke-dasharray="6,3">')
        lines.append(f'  <line x1="{sink_pos[0]:.1f}" y1="{sink_pos[1]:.1f}" '
                    f'x2="{range_pos[0]:.1f}" y2="{range_pos[1]:.1f}"/>')
        lines.append(f'  <line x1="{range_pos[0]:.1f}" y1="{range_pos[1]:.1f}" '
                    f'x2="{fridge_pos[0]:.1f}" y2="{fridge_pos[1]:.1f}"/>')
        lines.append(f'  <line x1="{fridge_pos[0]:.1f}" y1="{fridge_pos[1]:.1f}" '
                    f'x2="{sink_pos[0]:.1f}" y2="{sink_pos[1]:.1f}"/>')
        lines.append('</g>')
        # Dimension labels on triangle legs
        mx_sr = (sink_pos[0] + range_pos[0]) / 2
        my_sr = (sink_pos[1] + range_pos[1]) / 2
        dist_sr = math.sqrt((sink_pos[0]-range_pos[0])**2 + (sink_pos[1]-range_pos[1])**2) / scale
        lines.append(f'<text x="{mx_sr:.0f}" y="{my_sr - 8:.0f}" text-anchor="middle" '
                    f'fill="#ff8c00" font-size="9" font-weight="600">{dist_sr:.0f}"</text>')

    # --- ZONE LABELS ---
    lines.append('')
    lines.append('<!-- Zone labels -->')
    lines.append(f'<circle cx="{ox + wall_a_len*scale*0.25:.0f}" cy="{oy - DEPTH_BASE*scale/2:.0f}" r="25" '
                f'fill="#fed7aa" fill-opacity="0.4" stroke="none"/>')
    lines.append(f'<text x="{ox + wall_a_len*scale*0.25:.0f}" y="{oy - DEPTH_BASE*scale/2:.0f}" '
                f'text-anchor="middle" dominant-baseline="middle" '
                f'fill="#b45309" font-size="9" font-weight="700">PREP &amp; COOK</text>')

    # --- SKU LABELS ---
    lines.append('')
    lines.append('<!-- SKU labels -->')
    for lbl in fp_labels:
        lines.append(lbl)

    # --- DIMENSION LINES (architectural style with tick marks) ---
    lines.append('')
    lines.append('<!-- Dimension lines with tick marks -->')
    y_dim = h - footer_h + 30
    for i, wall in enumerate(walls):
        wlen = float(wall.get('length', 120))
        wid = wall.get('id', chr(65 + i))
        tick_len = 8
        if i == 0:
            x1 = ox
            x2 = ox + wlen * scale
            lines.append(f'<line x1="{x1:.0f}" y1="{y_dim - tick_len:.0f}" x2="{x1:.0f}" y2="{y_dim + tick_len:.0f}" '
                        f'stroke="#1B3A5C" stroke-width="0.8"/>')
            lines.append(f'<line x1="{x2:.0f}" y1="{y_dim - tick_len:.0f}" x2="{x2:.0f}" y2="{y_dim + tick_len:.0f}" '
                        f'stroke="#1B3A5C" stroke-width="0.8"/>')
            lines.append(f'<line x1="{x1:.0f}" y1="{y_dim:.0f}" x2="{x2:.0f}" y2="{y_dim:.0f}" '
                        f'stroke="#1B3A5C" stroke-width="1.2"/>')
            lines.append(f'<text x="{(x1+x2)/2:.0f}" y="{y_dim - 12:.0f}" text-anchor="middle" '
                        f'fill="#1B3A5C" font-size="11" font-weight="700">{wlen:.0f}"</text>')
        elif i == 1:
            x_dim = w - 55
            y1 = oy
            y2 = oy - wlen * scale
            lines.append(f'<line x1="{x_dim - tick_len:.0f}" y1="{y1:.0f}" x2="{x_dim + tick_len:.0f}" y2="{y1:.0f}" '
                        f'stroke="#1B3A5C" stroke-width="0.8"/>')
            lines.append(f'<line x1="{x_dim - tick_len:.0f}" y1="{y2:.0f}" x2="{x_dim + tick_len:.0f}" y2="{y2:.0f}" '
                        f'stroke="#1B3A5C" stroke-width="0.8"/>')
            lines.append(f'<line x1="{x_dim:.0f}" y1="{y1:.0f}" x2="{x_dim:.0f}" y2="{y2:.0f}" '
                        f'stroke="#1B3A5C" stroke-width="1.2"/>')
            lines.append(f'<text x="{x_dim + 18:.0f}" y="{(y1+y2)/2 + 3:.0f}" text-anchor="start" '
                        f'fill="#1B3A5C" font-size="11" font-weight="700">{wlen:.0f}"</text>')

    # --- NORTH ARROW (top-right) ---
    lines.append('')
    lines.append('<!-- North arrow -->')
    arrow_x = w - 40
    arrow_y = 50
    arrow_size = 15
    lines.append(f'<circle cx="{arrow_x:.0f}" cy="{arrow_y:.0f}" r="12" '
                f'fill="none" stroke="#1B3A5C" stroke-width="1.5"/>')
    lines.append(f'<polygon points="{arrow_x:.0f},{arrow_y - arrow_size:.0f} {arrow_x - 6:.0f},{arrow_y - 3:.0f} '
                f'{arrow_x + 6:.0f},{arrow_y - 3:.0f}" fill="#1B3A5C"/>')
    lines.append(f'<text x="{arrow_x:.0f}" y="{arrow_y + 22:.0f}" text-anchor="middle" '
                f'fill="#1B3A5C" font-size="9" font-weight="700">N</text>')

    # --- MATERIAL LEGEND ---
    lines.append('')
    lines.append('<!-- Material legend -->')
    ly = h - 50
    lines.append(f'<rect x="40" y="{ly:.0f}" width="14" height="14" '
                 f'fill="{fill_color}" stroke="#666" stroke-width="1" rx="1"/>')
    mat_text = species
    if door_style:
        mat_text += f' · {door_style}'
    lines.append(f'<text x="60" y="{ly + 11:.0f}" fill="#333" font-size="10" font-weight="500">'
                 f'{mat_text}</text>')

    # --- FOOTER ---
    lines.append(f'<text x="40" y="{h - 15:.0f}" fill="#999" font-size="8">'
                 f'Professional Floor Plan | OCP Parametric Geometry | Door Thickness 7/8" Included</text>')
    lines.append(f'<text x="{w-40:.0f}" y="{h-15:.0f}" text-anchor="end" '
                 f'fill="#999" font-size="8">Eclipse Kitchen Designer v8.8.0</text>')

    lines.append('</svg>')
    return '\n'.join(lines)


def generate_elevation_svg(placements, wall_id, wall_length, materials=None,
                           title=None, scale=3.5, margin=60):
    """Generate a PROFESSIONAL wall elevation SVG with architectural details.

    Includes:
    - 4" backsplash zone above countertop (subtle hatching)
    - Countertop edge profile at 36" AFF with bullnose detail
    - 4" toe kick recess with darker fill
    - Crown molding line at top of upper cabinets
    - Window frame (42"-72" AFF) on Wall B
    - Ceiling line at 96" AFF
    - Proper height dimension lines with extension lines on left
    - Appliance details (range knobs, hood profile, etc.)
    - OCP HLR projection for accurate cabinet geometry
    """
    title = title or f"Wall {wall_id} Elevation"
    compound = build_wall_scene(placements, wall_id, wall_length, materials)
    if compound is None:
        return _empty_svg(title, 800, 500)

    # Project front face
    visible, hidden = project_front_face(compound)

    # Get bounds from projected edges
    pxmin, pymin, pxmax, pymax = get_projected_bounds(visible, hidden)

    species = (materials or {}).get('species', 'default')
    fill_color = SPECIES_COLORS.get(species, SPECIES_COLORS['default'])
    door_style = (materials or {}).get('doorStyle', 'Metropolitan')

    header_h = 70
    footer_h = 70
    content_w = (pxmax - pxmin) * scale
    content_h = (pymax - pymin) * scale
    w = content_w + margin * 2
    h = content_h + margin * 2 + header_h + footer_h

    ox = margin - pxmin * scale
    oy = margin + header_h + pymax * scale

    vis_paths = edges_to_svg_paths(visible, scale, ox, oy, flip_y=True)
    hid_paths = edges_to_svg_paths(hidden, scale, ox, oy, flip_y=True)

    # Cabinet face fills with door/drawer details
    face_rects, face_labels = _cabinet_faces_2d(placements, wall_id, scale, ox, oy, fill_color)

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" '
        f'width="{w:.0f}" height="{h:.0f}" '
        f'style="background:#fff;font-family:Calibri,Helvetica,sans-serif;">',
        '<defs>',
        '  <pattern id="backsplash" patternUnits="userSpaceOnUse" width="6" height="6">',
        '    <circle cx="3" cy="3" r="1.5" fill="#d1d5db" fill-opacity="0.6"/>',
        '  </pattern>',
        '</defs>',
        '',
        '<!-- Header -->',
        f'<rect x="0" y="0" width="{w:.0f}" height="36" fill="#1B3A5C"/>',
        f'<text x="16" y="24" fill="#fff" font-size="13" font-weight="600" '
        f'letter-spacing="1.5">ECLIPSE CABINETRY</text>',
        f'<text x="{w-16:.0f}" y="24" fill="#fff" font-size="10" text-anchor="end">'
        f'WALL {wall_id} ELEVATION</text>',
        '',
        f'<text x="40" y="58" fill="#1B3A5C" font-size="16" font-weight="700">{title}</text>',
        f'<line x1="40" y1="64" x2="{w-40:.0f}" y2="64" stroke="#1B3A5C" stroke-width="2"/>',
        '',
    ]

    # --- FLOOR LINE ---
    floor_y = oy
    lines.append('<!-- Floor line (FFL) -->')
    lines.append(f'<line x1="25" y1="{floor_y:.0f}" x2="{w-25:.0f}" y2="{floor_y:.0f}" '
                f'stroke="#666" stroke-width="2.0"/>')
    lines.append(f'<text x="18" y="{floor_y + 4:.0f}" fill="#666" font-size="8" '
                f'text-anchor="end" font-weight="600">FFL</text>')

    # --- TOE KICK (4" recess below base cabinets) ---
    lines.append('')
    lines.append('<!-- Toe kick (4" recess) -->')
    toe_z = TOE_KICK
    toe_y = -toe_z * scale + oy
    lines.append(f'<rect x="25" y="{toe_y:.0f}" width="{w-50:.0f}" height="{TOE_KICK * scale:.1f}" '
                f'fill="#d4d4d4" stroke="none" fill-opacity="0.5"/>')

    # --- COUNTERTOP (at 36" AFF, 1.5" thick edge) ---
    lines.append('')
    lines.append('<!-- Countertop edge profile (bullnose) -->')
    ct_z = TOE_KICK + HEIGHT_BASE
    ct_y = -ct_z * scale + oy
    ct_thick = COUNTER_THICK * scale
    lines.append(f'<rect x="25" y="{ct_y - ct_thick:.0f}" width="{w-50:.0f}" height="{ct_thick:.1f}" '
                f'fill="#c4b5a0" stroke="#8b7355" stroke-width="0.8"/>')
    # Bullnose detail
    lines.append(f'<path d="M 25 {ct_y:.0f} Q 25 {ct_y - 2:.0f} 28 {ct_y - 2:.0f}" '
                f'fill="none" stroke="#8b7355" stroke-width="0.6"/>')
    lines.append(f'<path d="M {w-25:.0f} {ct_y:.0f} Q {w-25:.0f} {ct_y - 2:.0f} {w-28:.0f} {ct_y - 2:.0f}" '
                f'fill="none" stroke="#8b7355" stroke-width="0.6"/>')

    # --- BACKSPLASH (4" zone above countertop) ---
    lines.append('')
    lines.append('<!-- Backsplash zone (4" above countertop) -->')
    backsplash_h = 4 * scale
    lines.append(f'<rect x="25" y="{ct_y - ct_thick - backsplash_h:.0f}" width="{w-50:.0f}" height="{backsplash_h:.1f}" '
                f'fill="url(#backsplash)" stroke="#999" stroke-width="0.5" stroke-dasharray="2,1"/>')

    # --- CABINET FACE FILLS ---
    lines.append('')
    lines.append('<!-- Cabinet face fills -->')
    for r in face_rects:
        lines.append(r)

    # --- HLR VISIBLE EDGES ---
    lines.append('')
    lines.append('<!-- OCP HLR visible edges -->')
    lines.append('<g stroke="#333" stroke-width="1.0" fill="none" stroke-linecap="round">')
    for p in vis_paths:
        lines.append(f'  <path d="{p}"/>')
    lines.append('</g>')

    # --- HLR HIDDEN EDGES ---
    if hid_paths:
        lines.append('')
        lines.append('<!-- OCP HLR hidden edges -->')
        lines.append('<g stroke="#ccc" stroke-width="0.4" fill="none" stroke-dasharray="3,2">')
        for p in hid_paths:
            lines.append(f'  <path d="{p}"/>')
        lines.append('</g>')

    # --- CROWN MOLDING (top of upper cabinets) ---
    lines.append('')
    lines.append('<!-- Crown molding -->')
    crown_z = UPPER_MOUNT + 36.0  # Assuming 36" upper cabinets
    crown_y = -crown_z * scale + oy
    lines.append(f'<path d="M 25 {crown_y:.0f} L {w-25:.0f} {crown_y:.0f}" '
                f'fill="none" stroke="#8b7355" stroke-width="1.2"/>')
    lines.append(f'<path d="M 25 {crown_y:.0f} Q 27 {crown_y - 2:.0f} 30 {crown_y - 2:.0f}" '
                f'fill="none" stroke="#8b7355" stroke-width="0.6"/>')

    # --- CEILING LINE (96" AFF) ---
    lines.append('')
    lines.append('<!-- Ceiling line (96" AFF) -->')
    ceiling_z = 96.0
    ceiling_y = -ceiling_z * scale + oy
    if ceiling_y > header_h:
        lines.append(f'<line x1="20" y1="{ceiling_y:.0f}" x2="{w-20:.0f}" y2="{ceiling_y:.0f}" '
                    f'stroke="#999" stroke-width="1.5" stroke-dasharray="6,3"/>')
        lines.append(f'<text x="18" y="{ceiling_y - 3:.0f}" fill="#999" font-size="7" '
                    f'text-anchor="end" font-weight="600">CLG</text>')

    # --- WINDOW on Wall B (42"-72" AFF) ---
    if wall_id == 'B':
        lines.append('')
        lines.append('<!-- Window (42"-72" AFF) -->')
        win_z_bot = 42.0
        win_z_top = 72.0
        win_y_bot = -win_z_bot * scale + oy
        win_y_top = -win_z_top * scale + oy
        win_h = (win_z_bot - win_z_top) * scale
        win_x = w / 2 - 25
        win_w = 50
        # Outer frame
        lines.append(f'<rect x="{win_x:.0f}" y="{win_y_top:.0f}" width="{win_w:.0f}" height="{win_h:.0f}" '
                    f'fill="#e0f2fe" stroke="#0369a1" stroke-width="1.5"/>')
        # X pattern
        lines.append(f'<line x1="{win_x:.0f}" y1="{win_y_top:.0f}" x2="{win_x + win_w:.0f}" y2="{win_y_top + win_h:.0f}" '
                    f'stroke="#0369a1" stroke-width="0.6" stroke-opacity="0.5"/>')
        lines.append(f'<line x1="{win_x + win_w:.0f}" y1="{win_y_top:.0f}" x2="{win_x:.0f}" y2="{win_y_top + win_h:.0f}" '
                    f'stroke="#0369a1" stroke-width="0.6" stroke-opacity="0.5"/>')
        # Window label
        lines.append(f'<text x="{win_x + win_w/2:.0f}" y="{win_y_top + win_h/2 + 2:.0f}" text-anchor="middle" '
                    f'fill="#0369a1" font-size="7" font-weight="600">WINDOW</text>')

    # --- SKU LABELS ---
    lines.append('')
    lines.append('<!-- SKU labels -->')
    for lbl in face_labels:
        lines.append(lbl)

    # --- WIDTH DIMENSIONS (with tick marks) ---
    lines.append('')
    lines.append('<!-- Width dimensions -->')
    y_dim = h - footer_h + 15
    tick_len = 6
    base_cabs = [p for p in placements if p.get('wall') == wall_id
                 and p.get('zone', 'BASE') not in ('UPPER', 'WALL', 'CROWN')]
    upper_cabs = [p for p in placements if p.get('wall') == wall_id
                  and p.get('zone', 'BASE') in ('UPPER', 'WALL', 'CROWN')]

    for p in base_cabs:
        x1 = float(p.get('x', 0)) * scale + ox
        w_cab = float(p.get('width', 24))
        x2 = x1 + w_cab * scale
        mid = (x1 + x2) / 2
        lines.append(f'<line x1="{x1:.0f}" y1="{y_dim - tick_len:.0f}" x2="{x1:.0f}" y2="{y_dim + tick_len:.0f}" '
                    f'stroke="#1B3A5C" stroke-width="0.8"/>')
        lines.append(f'<line x1="{x2:.0f}" y1="{y_dim - tick_len:.0f}" x2="{x2:.0f}" y2="{y_dim + tick_len:.0f}" '
                    f'stroke="#1B3A5C" stroke-width="0.8"/>')
        lines.append(f'<line x1="{x1:.0f}" y1="{y_dim:.0f}" x2="{x2:.0f}" y2="{y_dim:.0f}" '
                    f'stroke="#1B3A5C" stroke-width="1.2"/>')
        lines.append(f'<text x="{mid:.0f}" y="{y_dim - 8:.0f}" text-anchor="middle" '
                    f'fill="#1B3A5C" font-size="10" font-weight="700">{w_cab:.0f}"</text>')

    # Upper dimensions
    y_dim_upper = y_dim + 20
    for p in upper_cabs:
        x1 = float(p.get('x', 0)) * scale + ox
        w_cab = float(p.get('width', 24))
        x2 = x1 + w_cab * scale
        mid = (x1 + x2) / 2
        lines.append(f'<line x1="{x1:.0f}" y1="{y_dim_upper:.0f}" x2="{x2:.0f}" y2="{y_dim_upper:.0f}" '
                    f'stroke="#7A99B5" stroke-width="1" stroke-dasharray="3,2"/>')
        lines.append(f'<text x="{mid:.0f}" y="{y_dim_upper - 5:.0f}" text-anchor="middle" '
                    f'fill="#7A99B5" font-size="9" font-weight="600">{w_cab:.0f}"</text>')

    # --- HEIGHT DIMENSION LINES (on left side with extension lines) ---
    lines.append('')
    lines.append('<!-- Height dimension lines -->')
    x_hm = 15
    ext_x = 22
    dim_pts = [
        ('FFL', 0),
        ('4" TK', TOE_KICK),
        ('36" CTR', TOE_KICK + HEIGHT_BASE + COUNTER_THICK),
        ('54" UPR', UPPER_MOUNT),
        ('96" CLG', 96)
    ]
    for label, z_val in dim_pts:
        y_hm = -z_val * scale + oy
        if y_hm > header_h and y_hm < h - footer_h:
            lines.append(f'<line x1="{ext_x:.0f}" y1="{y_hm:.0f}" x2="{x_hm + 8:.0f}" y2="{y_hm:.0f}" '
                        f'stroke="#AAA" stroke-width="0.5"/>')
            lines.append(f'<text x="{x_hm - 2:.0f}" y="{y_hm + 3:.0f}" text-anchor="end" '
                        f'fill="#666" font-size="7" font-weight="600">{label}</text>')

    # --- MATERIAL & SPECS ---
    lines.append('')
    lines.append('<!-- Material and specifications -->')
    lines.append(f'<text x="40" y="{h - 18:.0f}" fill="#333" font-size="9" font-weight="600">'
                f'{species} · {door_style} Door Style</text>')
    lines.append(f'<text x="40" y="{h - 8:.0f}" fill="#999" font-size="8">'
                f'Door thickness 7/8" | OCP Parametric Geometry | Professional Elevation</text>')
    lines.append(f'<text x="{w-40:.0f}" y="{h-8:.0f}" text-anchor="end" '
                f'fill="#999" font-size="8">Eclipse Kitchen Designer v8.8.0</text>')

    lines.append('</svg>')
    return '\n'.join(lines)


def _empty_svg(title, w, h):
    """Fallback empty SVG if no geometry."""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
            f'width="{w}" height="{h}" style="background:#fff;">'
            f'<text x="50%" y="50%" text-anchor="middle" fill="#999" '
            f'font-size="14">{title} — no placements</text></svg>')


# ══════════════════════════════════════════════════════════════════════════════
# CLI ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

def generate_from_layout(layout_data, materials=None, output_dir='.'):
    """Generate floor plan + all wall elevation SVGs from a solver layout result.

    Args:
        layout_data: solver output dict with .placements and .walls
        materials: {species, doorStyle, construction}
        output_dir: directory to write SVG files

    Returns: list of output file paths
    """
    placements = layout_data.get('placements', [])
    walls = layout_data.get('walls', layout_data.get('input', {}).get('walls', []))
    layout_type = layout_data.get('layoutType', layout_data.get('input', {}).get('layoutType', ''))

    files = []

    # Floor plan
    fp_svg = generate_floor_plan_svg(placements, walls, materials=materials,
                                      title=f"{layout_type} — Floor Plan")
    fp_path = os.path.join(output_dir, 'ocp-floor-plan.svg')
    with open(fp_path, 'w') as f:
        f.write(fp_svg)
    files.append(fp_path)
    print(f"  Floor plan → {fp_path}")

    # Wall elevations
    for wall in walls:
        wid = wall.get('id', 'A')
        wlen = float(wall.get('length', 120))
        elev_svg = generate_elevation_svg(placements, wid, wlen, materials=materials,
                                           title=f"Wall {wid} Elevation")
        elev_path = os.path.join(output_dir, f'ocp-elevation-{wid}.svg')
        with open(elev_path, 'w') as f:
            f.write(elev_svg)
        files.append(elev_path)
        print(f"  Elevation {wid} → {elev_path}")

    return files


def load_solver_json(json_path):
    """Load solver output JSON and convert to SVG placement format."""
    with open(json_path) as f:
        data = json.load(f)

    placements = data.get('svgPlacements', [])
    meta = data.get('meta', {})

    walls = [
        {'id': 'A', 'length': meta.get('wallA_length', 156), 'role': 'range'},
        {'id': 'B', 'length': meta.get('wallB_length', 120), 'role': 'sink'},
    ]
    materials = {
        'species': meta.get('species', 'Walnut'),
        'doorStyle': meta.get('doorStyle', 'Metropolitan Vertical'),
        'construction': meta.get('construction', 'Plywood'),
    }

    return placements, walls, materials, meta.get('layoutType', 'L-Shape')


if __name__ == '__main__':
    # Accept solver JSON from command line or run solver via subprocess
    json_path = sys.argv[1] if len(sys.argv) > 1 else None

    if json_path and os.path.isfile(json_path):
        print(f"Loading solver output from {json_path}")
        placements, walls, materials, layout_type = load_solver_json(json_path)
    else:
        # Run the solver directly via Node.js subprocess
        import subprocess
        engine_dir = os.path.dirname(os.path.dirname(__file__))
        solver_script = os.path.join(engine_dir, 'run-solver-full.mjs')
        if os.path.isfile(solver_script):
            print("Running solver via Node.js...")
            result = subprocess.run(
                ['node', solver_script],
                capture_output=True, text=True, cwd=engine_dir
            )
            if result.returncode != 0:
                print(f"Solver error: {result.stderr}")
                sys.exit(1)
            data = json.loads(result.stdout)
            placements = data.get('svgPlacements', [])
            meta = data.get('meta', {})
            walls = [
                {'id': 'A', 'length': meta.get('wallA_length', 156), 'role': 'range'},
                {'id': 'B', 'length': meta.get('wallB_length', 120), 'role': 'sink'},
            ]
            materials = {
                'species': meta.get('species', 'Walnut'),
                'doorStyle': meta.get('doorStyle', 'Metropolitan Vertical'),
                'construction': meta.get('construction', 'Plywood'),
            }
            layout_type = meta.get('layoutType', 'L-Shape')
            print(f"  Solver returned {len(placements)} SVG placements")
        else:
            print("ERROR: No solver JSON provided and run-solver-full.mjs not found")
            sys.exit(1)

    print(f"\nLayout: {layout_type}")
    wall_strs = [w['id'] + '=' + str(w['length']) + '"' for w in walls]
    print(f"Walls: {wall_strs}")
    print(f"Materials: {materials}")
    print(f"Placements: {len(placements)}")
    for p in placements:
        app = ' [APPL]' if p.get('is_appliance') else ''
        print(f"  wall={p['wall']}  x={p['x']:>5}  w={p['width']:>3}  zone={p['zone']:<12}  {p['sku']}{app}")

    out_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    files = generate_from_layout(
        {'placements': placements, 'walls': walls, 'layoutType': f'{layout_type} (Solver Output)'},
        materials=materials,
        output_dir=out_dir
    )
    print(f"\nGenerated {len(files)} SVG files from solver output")
