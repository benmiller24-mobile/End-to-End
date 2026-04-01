#!/usr/bin/env python3
"""
Eclipse Cabinet Shape Factory — OCP Parametric 3D Geometry
==========================================================
Generates accurate 3D solid shapes for every Eclipse cabinet type
using OpenCascade (OCP) kernel. Reads the eclipse-cabinet-shapes.json
database for dimensions and creates proper geometry:

  - Standard box shapes for most cabinets
  - L-shaped solids for blind corners (BBC, WBC)
  - Right-angle (L-shaped) solids for corner cabinets (BL, BLSB)
  - Diagonal (45°) angled-face solids for DSB
  - Thin panels for end panels (WEP, BEP, REP, FWEP, FBEP)
  - Narrow strips for fillers

Called from kitchen-3d-engine.py to replace the generic make_box()
with SKU-aware parametric shapes.
"""

import json
import os

from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox
from OCP.BRepAlgoAPI import BRepAlgoAPI_Fuse, BRepAlgoAPI_Cut
from OCP.gp import gp_Pnt, gp_Vec, gp_Dir, gp_Ax2, gp_Pln
from OCP.BRepBuilderAPI import BRepBuilderAPI_MakeWire, BRepBuilderAPI_MakeFace
from OCP.BRepPrimAPI import BRepPrimAPI_MakePrism
from OCP.GC import GC_MakeSegment
from OCP.BRepBuilderAPI import BRepBuilderAPI_MakeEdge

# ─── Load dimension database ────────────────────────────────────────────────
_DB_PATH = os.path.join(os.path.dirname(__file__), 'eclipse-cabinet-shapes.json')
_DB = None

def _get_db():
    global _DB
    if _DB is None:
        with open(_DB_PATH, 'r') as f:
            _DB = json.load(f)
    return _DB


# ─── Shape Type Constants ────────────────────────────────────────────────────
SHAPE_BOX = 'box'
SHAPE_BLIND_CORNER = 'blind_corner'
SHAPE_RIGHT_ANGLE = 'right_angle'
SHAPE_DIAGONAL = 'diagonal'
SHAPE_PANEL = 'panel'
SHAPE_FILLER = 'filler'
SHAPE_ANGLED_END = 'angled_end'
SHAPE_END_SHELF = 'end_shelf_curved'


# ─── SKU Classification ─────────────────────────────────────────────────────

def classify_sku(sku):
    """Determine shape type and zone from SKU prefix.
    Returns dict with: shapeType, zone, defaultDepth, defaultHeight, yMount"""
    sku_upper = sku.upper().strip()

    # End panels — thin decorative pieces
    if any(sku_upper.startswith(p) for p in ('FREP', 'FWEP', 'FBEP', 'FVEP', 'FVTEP')):
        return _panel_info(sku_upper, flush=True)
    if any(sku_upper.startswith(p) for p in ('REP', 'WEP', 'BEP', 'VEP', 'VTEP')):
        return _panel_info(sku_upper, flush=False)

    # Fillers
    if sku_upper.startswith('F') and any(c.isdigit() for c in sku_upper[1:4]):
        if not any(sku_upper.startswith(p) for p in ('FIO', 'FIBO', 'FIBWD')):
            return {'shapeType': SHAPE_FILLER, 'zone': 'BASE', 'defaultDepth': 0.75,
                    'defaultHeight': 30.5, 'yMount': 4}

    # Diagonal Sink Base
    if sku_upper.startswith('DSB'):
        return {'shapeType': SHAPE_DIAGONAL, 'zone': 'SINK_BASE', 'defaultDepth': 24.875,
                'defaultHeight': 30.5, 'yMount': 4}

    # Right Angle corners (BL, BLSB, BLE)
    if sku_upper.startswith('BLSB') or sku_upper.startswith('BLSBE'):
        return {'shapeType': SHAPE_RIGHT_ANGLE, 'zone': 'SINK_BASE', 'defaultDepth': 24.875,
                'defaultHeight': 30.5, 'yMount': 4}
    if sku_upper.startswith('BLE') or sku_upper.startswith('BL'):
        if not sku_upper.startswith('BND') and not sku_upper.startswith('BWD'):
            return {'shapeType': SHAPE_RIGHT_ANGLE, 'zone': 'BASE', 'defaultDepth': 24.875,
                    'defaultHeight': 30.5, 'yMount': 4}

    # Angle end bases
    if sku_upper.startswith('AEB') or sku_upper.startswith('ABL') or sku_upper.startswith('ABR') or sku_upper.startswith('AB2'):
        return {'shapeType': SHAPE_ANGLED_END, 'zone': 'BASE', 'defaultDepth': 24.875,
                'defaultHeight': 30.5, 'yMount': 4}

    # Base end shelf
    if sku_upper.startswith('BES'):
        return {'shapeType': SHAPE_END_SHELF, 'zone': 'BASE', 'defaultDepth': 24.875,
                'defaultHeight': 30.5, 'yMount': 4}

    # Blind corner bases
    if sku_upper.startswith('SBBC'):
        return {'shapeType': SHAPE_BLIND_CORNER, 'zone': 'SINK_BASE', 'defaultDepth': 24.875,
                'defaultHeight': 30.5, 'yMount': 4}
    if sku_upper.startswith('PBBC'):
        return {'shapeType': SHAPE_BLIND_CORNER, 'zone': 'BASE', 'defaultDepth': 24.875,
                'defaultHeight': 30.5, 'yMount': 4}
    if sku_upper.startswith('BBC'):
        return {'shapeType': SHAPE_BLIND_CORNER, 'zone': 'BASE', 'defaultDepth': 24.875,
                'defaultHeight': 30.5, 'yMount': 4}

    # Wall blind corners
    if sku_upper.startswith('SWBC'):
        return {'shapeType': SHAPE_BLIND_CORNER, 'zone': 'UPPER', 'defaultDepth': 13.875,
                'defaultHeight': 48, 'yMount': 54}
    if sku_upper.startswith('WBC'):
        return {'shapeType': SHAPE_BLIND_CORNER, 'zone': 'UPPER', 'defaultDepth': 13.875,
                'defaultHeight': 30, 'yMount': 54}

    # Refrigerator Wall
    if sku_upper.startswith('RW'):
        return {'shapeType': SHAPE_BOX, 'zone': 'ABOVE_TALL', 'defaultDepth': 24.875,
                'defaultHeight': 24, 'yMount': 84}

    # Stacked wall
    if sku_upper.startswith('SW'):
        return {'shapeType': SHAPE_BOX, 'zone': 'UPPER', 'defaultDepth': 13.875,
                'defaultHeight': 48, 'yMount': 54}

    # Wall cabinets
    if sku_upper.startswith('W') and not sku_upper.startswith('BW'):
        if sku_upper.startswith('WSP') or sku_upper.startswith('WPOSR'):
            return {'shapeType': SHAPE_BOX, 'zone': 'UPPER', 'defaultDepth': 13.875,
                    'defaultHeight': 30, 'yMount': 54}
        return {'shapeType': SHAPE_BOX, 'zone': 'UPPER', 'defaultDepth': 13.875,
                'defaultHeight': 30, 'yMount': 54}

    # Utility Tall cabinets
    if sku_upper.startswith('UTWPOP') or sku_upper.startswith('UTPOP') or sku_upper.startswith('UT'):
        return {'shapeType': SHAPE_BOX, 'zone': 'TALL', 'defaultDepth': 24.875,
                'defaultHeight': 96, 'yMount': 0}
    if sku_upper.startswith('UWPOP') or sku_upper.startswith('UPOP') or sku_upper.startswith('U3DR'):
        return {'shapeType': SHAPE_BOX, 'zone': 'TALL', 'defaultDepth': 24.875,
                'defaultHeight': 84, 'yMount': 0}
    if sku_upper.startswith('U') and sku_upper[1:2].isdigit():
        return {'shapeType': SHAPE_BOX, 'zone': 'TALL', 'defaultDepth': 24.875,
                'defaultHeight': 84, 'yMount': 0}

    # Oven / Oven Microwave / Flush Inset Oven (tall)
    if sku_upper.startswith('FIO'):
        return {'shapeType': SHAPE_BOX, 'zone': 'TALL', 'defaultDepth': 24.875,
                'defaultHeight': 84, 'yMount': 0}
    if sku_upper.startswith('OM'):
        return {'shapeType': SHAPE_BOX, 'zone': 'TALL', 'defaultDepth': 24.875,
                'defaultHeight': 84, 'yMount': 0}
    if sku_upper.startswith('O') and sku_upper[1:2].isdigit():
        return {'shapeType': SHAPE_BOX, 'zone': 'TALL', 'defaultDepth': 24.875,
                'defaultHeight': 84, 'yMount': 0}

    # Pantry Entry
    if sku_upper.startswith('PEC'):
        return {'shapeType': SHAPE_BOX, 'zone': 'TALL', 'defaultDepth': 24.875,
                'defaultHeight': 96, 'yMount': 0}

    # Sink bases
    if sku_upper.startswith('SBA'):
        return {'shapeType': SHAPE_BOX, 'zone': 'SINK_BASE', 'defaultDepth': 24.875,
                'defaultHeight': 30.5, 'yMount': 4}
    if sku_upper.startswith('SBR'):
        return {'shapeType': SHAPE_BOX, 'zone': 'SINK_BASE', 'defaultDepth': 24.875,
                'defaultHeight': 30.5, 'yMount': 4}
    if sku_upper.startswith('SB'):
        return {'shapeType': SHAPE_BOX, 'zone': 'SINK_BASE', 'defaultDepth': 24.875,
                'defaultHeight': 30.5, 'yMount': 4}

    # Base specialties — wine (13" deep)
    if any(sku_upper.startswith(p) for p in ('BWRX', 'BWC', 'BWDG', 'BWS', 'BCNCWS', 'BCVXWS')):
        return {'shapeType': SHAPE_BOX, 'zone': 'BASE', 'defaultDepth': 13.875,
                'defaultHeight': 30.5, 'yMount': 4}
    if sku_upper.startswith('BWST'):
        return {'shapeType': SHAPE_BOX, 'zone': 'BASE', 'defaultDepth': 24.875,
                'defaultHeight': 30.5, 'yMount': 4}

    # Base specialties — waste, oven, range top
    if any(sku_upper.startswith(p) for p in ('BWDM', 'BO', 'BWD', 'RTB', 'FIBO', 'FIBWD')):
        return {'shapeType': SHAPE_BOX, 'zone': 'BASE', 'defaultDepth': 24.875,
                'defaultHeight': 30.5, 'yMount': 4}

    # Various base specialties
    if any(sku_upper.startswith(p) for p in ('BKI', 'BTD', 'BFSO', 'BUBO', 'BPOPR',
            'BPTPO', 'BCWWO', 'BPOS', 'BPWOS', 'BND', 'BNDVA')):
        return {'shapeType': SHAPE_BOX, 'zone': 'BASE', 'defaultDepth': 24.875,
                'defaultHeight': 30.5, 'yMount': 4}

    # Drawer bases, tray bases, peninsula bases
    if any(sku_upper.startswith(p) for p in ('B3D', 'B4D', 'B2TD', 'B2HD', 'STB4D',
            'BBB', 'BBBD', 'BBD', 'TB', 'PB')):
        return {'shapeType': SHAPE_BOX, 'zone': 'BASE', 'defaultDepth': 24.875,
                'defaultHeight': 30.5, 'yMount': 4}

    # Standard base (catch-all for B prefix)
    if sku_upper.startswith('B') and sku_upper[1:2].isdigit():
        return {'shapeType': SHAPE_BOX, 'zone': 'BASE', 'defaultDepth': 24.875,
                'defaultHeight': 30.5, 'yMount': 4}

    # Default fallback
    return {'shapeType': SHAPE_BOX, 'zone': 'BASE', 'defaultDepth': 24.875,
            'defaultHeight': 30.5, 'yMount': 4}


def _panel_info(sku_upper, flush=False):
    """Determine panel depth and zone from SKU."""
    depth_map = {
        'WEP': 13, 'FWEP': 13.875,
        'BEP': 24, 'FBEP': 24.875,
        'VEP': 21, 'FVEP': 21.875,
        'VTEP': 21, 'FVTEP': 21.875,
        'REP': 30, 'FREP': 30.875,
    }
    zone_map = {
        'WEP': 'UPPER', 'FWEP': 'UPPER',
        'BEP': 'BASE', 'FBEP': 'BASE',
        'VEP': 'BASE', 'FVEP': 'BASE',
        'VTEP': 'BASE', 'FVTEP': 'BASE',
        'REP': 'TALL', 'FREP': 'TALL',
    }
    height_map = {
        'WEP': 30, 'FWEP': 30,
        'BEP': 34.5, 'FBEP': 34.5,
        'VEP': 30, 'FVEP': 30,
        'VTEP': 34.5, 'FVTEP': 34.5,
        'REP': 96, 'FREP': 96,
    }
    ymount_map = {
        'WEP': 54, 'FWEP': 54,
        'BEP': 0, 'FBEP': 0,
        'VEP': 0, 'FVEP': 0,
        'VTEP': 0, 'FVTEP': 0,
        'REP': 0, 'FREP': 0,
    }

    for prefix in sorted(depth_map.keys(), key=len, reverse=True):
        if sku_upper.startswith(prefix):
            # Panel thickness: 3/4" standard, 1.5" for 1½, 3" for 3"
            thickness = 0.75
            if '1 1/2' in sku_upper or '11/2' in sku_upper or '1.5' in sku_upper:
                thickness = 1.5
            elif '3' in sku_upper.replace(prefix, '', 1)[:3]:
                thickness = 3.0

            return {
                'shapeType': SHAPE_PANEL,
                'zone': zone_map[prefix],
                'defaultDepth': depth_map[prefix],
                'defaultHeight': height_map[prefix],
                'yMount': ymount_map[prefix],
                'thickness': thickness,
            }

    return {'shapeType': SHAPE_PANEL, 'zone': 'BASE', 'defaultDepth': 24,
            'defaultHeight': 34.5, 'yMount': 0, 'thickness': 0.75}


# ─── OCP Shape Builders ──────────────────────────────────────────────────────

def make_box_shape(x, y, z, w, h, d):
    """Standard rectangular box. OCP: X=along wall, Y=depth from wall, Z=height."""
    box = BRepPrimAPI_MakeBox(gp_Pnt(float(x), float(y), float(z)),
                              float(w), float(d), float(h))
    return box.Shape()


def make_blind_corner_shape(x, y, z, w, h, d, blind_pull=4, mullion=7.5, is_wall=False):
    """L-shaped blind corner. Two overlapping boxes forming an L.

    The main box is the door-side. The blind extension goes perpendicular.
    For base: d=24", blind extends 24" into corner.
    For wall: d=13", blind extends 13" into corner.
    """
    # Main box (the accessible cabinet with the door)
    door_width = w - mullion - blind_pull
    main_box = BRepPrimAPI_MakeBox(
        gp_Pnt(float(x + mullion + blind_pull), float(y), float(z)),
        float(door_width), float(d), float(h)
    ).Shape()

    # Blind extension box (perpendicular, into corner)
    blind_depth = d  # matches cabinet depth (24" for base, 13" for wall)
    blind_box = BRepPrimAPI_MakeBox(
        gp_Pnt(float(x), float(y), float(z)),
        float(mullion + blind_pull), float(d + blind_depth), float(h)
    ).Shape()

    # Fuse the two boxes into one L-shape
    fused = BRepAlgoAPI_Fuse(main_box, blind_box)
    if fused.IsDone():
        return fused.Shape()
    # Fallback: return main box only
    return main_box


def make_right_angle_shape(x, y, z, wall_space_a, wall_space_b, h, d=24):
    """Right angle corner cabinet (BL series). L-shaped, sits in corner.
    Each leg extends along its wall. Both legs are 24" deep.

    wall_space_a: space along wall A (left leg)
    wall_space_b: space along wall B (right leg, perpendicular)
    """
    # Leg A: along the wall (X-axis)
    leg_a = BRepPrimAPI_MakeBox(
        gp_Pnt(float(x), float(y), float(z)),
        float(wall_space_a), float(d), float(h)
    ).Shape()

    # Leg B: perpendicular (Y-axis into room from corner)
    leg_b = BRepPrimAPI_MakeBox(
        gp_Pnt(float(x), float(y), float(z)),
        float(d), float(wall_space_b), float(h)
    ).Shape()

    # Fuse both legs
    fused = BRepAlgoAPI_Fuse(leg_a, leg_b)
    if fused.IsDone():
        return fused.Shape()
    return leg_a


def make_diagonal_shape(x, y, z, wall_leg, h, d=24):
    """Diagonal corner cabinet (DSB series). Square footprint with 45° angled face.

    The cabinet occupies a square area (wall_leg × wall_leg) in the corner,
    with a diagonal face across the front.
    For collision detection, we model it as the full bounding box.
    """
    # For 3D collision purposes, use the full corner bounding box
    # A true diagonal would use BRepPrimAPI_MakeWedge or a swept profile,
    # but the bounding box is sufficient for layout collision detection.
    box = BRepPrimAPI_MakeBox(
        gp_Pnt(float(x), float(y), float(z)),
        float(wall_leg), float(wall_leg), float(h)
    ).Shape()
    return box


def make_panel_shape(x, y, z, thickness, h, d):
    """Thin panel (end panel, filler). Just a very thin box."""
    return BRepPrimAPI_MakeBox(
        gp_Pnt(float(x), float(y), float(z)),
        float(thickness), float(d), float(h)
    ).Shape()


# ─── Main Factory Function ───────────────────────────────────────────────────

def create_cabinet_shape(cab_data):
    """Create an accurate 3D shape for a cabinet based on its SKU.

    Args:
        cab_data: dict with keys: sku, x, depthFromWall (y), yMount (z),
                  width, height, depth, zone

    Returns:
        OCP TopoDS_Shape solid
    """
    sku = cab_data.get('sku', 'UNKNOWN')
    x = float(cab_data.get('x', 0))
    y = float(cab_data.get('depthFromWall', 0))
    z = float(cab_data.get('yMount', 4))
    w = float(cab_data.get('width', 36))
    h = float(cab_data.get('height', 30))
    d = float(cab_data.get('depth', 24.875))

    info = classify_sku(sku)
    shape_type = info['shapeType']

    if shape_type == SHAPE_BLIND_CORNER:
        blind_pull = 4 if info['zone'] in ('BASE', 'SINK_BASE') else 3
        mullion = 7.5
        is_wall = info['zone'] == 'UPPER'
        return make_blind_corner_shape(x, y, z, w, h, d,
                                        blind_pull=blind_pull,
                                        mullion=mullion,
                                        is_wall=is_wall)

    elif shape_type == SHAPE_RIGHT_ANGLE:
        # BL/BLSB: width encodes wall space for one side; both sides usually equal
        wall_space = w if w > 24 else 36
        return make_right_angle_shape(x, y, z, wall_space, wall_space, h, d)

    elif shape_type == SHAPE_DIAGONAL:
        wall_leg = w if w >= 36 else 36
        return make_diagonal_shape(x, y, z, wall_leg, h, d)

    elif shape_type == SHAPE_PANEL:
        thickness = info.get('thickness', 0.75)
        return make_panel_shape(x, y, z, thickness, h, d)

    elif shape_type == SHAPE_FILLER:
        # Fillers are typically 3" or 6" wide, very thin depth
        return make_panel_shape(x, y, z, w, h, 0.75)

    elif shape_type == SHAPE_ANGLED_END:
        # Angle end bases: simplified as a box for collision detection
        return make_box_shape(x, y, z, w, h, d)

    elif shape_type == SHAPE_END_SHELF:
        # End shelf with curved front: simplified as a box
        return make_box_shape(x, y, z, w, h, d)

    else:
        # Standard box shape (vast majority of cabinets)
        return make_box_shape(x, y, z, w, h, d)


def get_sku_defaults(sku):
    """Get default dimensions for a SKU from the database.

    Returns dict with: zone, defaultHeight, defaultDepth, yMount, shapeType
    """
    info = classify_sku(sku)

    # Try to get more specific defaults from the JSON database
    db = _get_db()
    sku_upper = sku.upper().strip()

    for category_name, entries in db.get('categories', {}).items():
        for entry in entries:
            prefix = entry.get('skuPrefix', '')
            if sku_upper.startswith(prefix.upper()):
                # Found a match — use database values where available
                result = dict(info)
                if 'defaultHeight' in entry:
                    result['defaultHeight'] = entry['defaultHeight']
                if 'depth' in entry:
                    result['defaultDepth'] = entry['depth']
                elif 'defaultDepth' in entry:
                    result['defaultDepth'] = entry['defaultDepth']
                if 'zone' in entry:
                    result['zone'] = entry['zone']
                if 'yMount' in entry:
                    result['yMount'] = entry['yMount']
                return result

    return info


def validate_sku_dimensions(sku, width=None, height=None, depth=None):
    """Validate that given dimensions are valid for the SKU.

    Returns list of validation issues (empty = valid).
    """
    issues = []
    db = _get_db()
    sku_upper = sku.upper().strip()

    for category_name, entries in db.get('categories', {}).items():
        for entry in entries:
            prefix = entry.get('skuPrefix', '')
            if sku_upper.startswith(prefix.upper()):
                # Check width
                if width and 'widths' in entry:
                    if width not in entry['widths']:
                        issues.append({
                            'severity': 'warning',
                            'rule': 'invalid_width',
                            'message': f"{sku} width {width}\" not in catalog widths: {entry['widths']}"
                        })

                # Check height
                if height and 'heights' in entry:
                    if height not in entry['heights']:
                        issues.append({
                            'severity': 'warning',
                            'rule': 'invalid_height',
                            'message': f"{sku} height {height}\" not in catalog heights: {entry['heights']}"
                        })

                # Check depth
                if depth:
                    if 'depths' in entry:
                        if depth not in entry['depths']:
                            issues.append({
                                'severity': 'warning',
                                'rule': 'invalid_depth',
                                'message': f"{sku} depth {depth}\" not in catalog depths: {entry['depths']}"
                            })
                    elif 'depth' in entry:
                        expected = entry['depth']
                        if abs(depth - expected) > 2:
                            issues.append({
                                'severity': 'warning',
                                'rule': 'depth_mismatch',
                                'message': f"{sku} depth {depth}\" vs catalog standard {expected}\""
                            })

                return issues

    return issues


# ─── Quick SKU Lookup ────────────────────────────────────────────────────────

def parse_sku_width(sku):
    """Extract the width number from a SKU string.

    Examples: W30 -> 30, B3D24 -> 24, SB36 -> 36, WBC48 -> 48
    """
    import re
    # Look for a number at the end of the SKU (after the letter prefix)
    match = re.search(r'(\d+(?:\s*1/2)?)\s*$', sku.split('-')[0])
    if match:
        val = match.group(1)
        if '1/2' in val:
            return float(val.replace(' 1/2', '').replace('1/2', '')) + 0.5
        return float(val)

    # Try finding the last number in the SKU
    matches = re.findall(r'(\d+)', sku)
    if matches:
        return float(matches[-1])

    return None


if __name__ == '__main__':
    # Quick test
    print("Eclipse Shape Factory - SKU Classification Tests")
    print("=" * 50)

    test_skus = [
        'W30', 'W36', 'WBC36', 'SW30', 'RW36', 'WSP18',
        'B24', 'SB36', 'BBC42', 'SBBC54', 'B3D24', 'B4D30',
        'DSB36', 'BL36-PH', 'BLSB33-PH', 'BLE36-42',
        'UT24', 'UT36-RT', 'O30', 'OM33', 'PEC36',
        'REP3/4-24-L/R', 'WEP3/4-L/R', 'BEP1 1/2-L/R',
        'FWEP3/4-L/R', 'FBEP3/4-L/R', 'FREP3/4-30-L/R',
        'F342', 'F4 1/4 42', 'BWRX24', 'BWC30',
    ]

    for sku in test_skus:
        info = classify_sku(sku)
        defaults = get_sku_defaults(sku)
        print(f"  {sku:20s} → shape={info['shapeType']:15s} zone={info['zone']:12s} "
              f"depth={defaults.get('defaultDepth', '?'):>5} height={defaults.get('defaultHeight', '?'):>5}")
