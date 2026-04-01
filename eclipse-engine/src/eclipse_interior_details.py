#!/usr/bin/env python3
"""
Eclipse Interior Detail Geometry — OCP Parametric 3D
=====================================================
Generates interior detail geometry for Eclipse cabinets:
  - Shelves (adjustable shelf positions)
  - Drawer boxes (with proper box heights and spacing)
  - Door swing arcs (left/right hinge, overlay)
  - Hinge-side indicators
  - Rollout trays

All dimensions from Eclipse v8.8.0 catalog specs.
Called from kitchen-3d-engine.py to add detail geometry to cabinet solids.

Eclipse Cabinet Interior Standards:
  - Shelf thickness: 0.75" (3/4" plywood)
  - Shelf setback from face: 0.5" (behind door overlay)
  - Drawer box height: 3.5" (standard), 6" (deep), 10" (pot drawer)
  - Drawer box sides: 0.625" (5/8" plywood)
  - Drawer gap between stacked drawers: 1.0"
  - Door overlay: 0.5" per side (full overlay Eclipse standard)
  - Hinge bore: 35mm (1.378") diameter, 3mm from edge
  - Concealed hinge cup depth: 0.5"
  - Toe kick board: 0.75" thick, 4" tall, set back 3" from face
"""

from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox, BRepPrimAPI_MakeCylinder
from OCP.gp import gp_Pnt, gp_Ax2, gp_Dir
from OCP.BRepAlgoAPI import BRepAlgoAPI_Fuse
import math

# ─── Constants (Eclipse v8.8.0 specs) ─────────────────────────────────────

# Shelf dimensions
SHELF_THICKNESS = 0.75          # 3/4" plywood
SHELF_SETBACK_FRONT = 0.5      # setback from face frame
SHELF_SETBACK_SIDES = 0.125    # 1/8" clearance per side
SHELF_SETBACK_BACK = 0.25      # 1/4" clearance from back

# Drawer box dimensions
DRAWER_BOX_SIDE_THICKNESS = 0.625   # 5/8" plywood sides
DRAWER_BOX_BOTTOM_THICKNESS = 0.25  # 1/4" plywood bottom
DRAWER_GAP = 1.0                     # gap between stacked drawers
DRAWER_SLIDE_CLEARANCE = 0.5         # per side for slides
DRAWER_FRONT_THICKNESS = 0.75        # 3/4" drawer front panel

# Standard drawer box heights (interior box, not including front)
DRAWER_HEIGHT_STANDARD = 3.5    # standard utensil drawer
DRAWER_HEIGHT_MEDIUM = 6.0      # medium/file drawer
DRAWER_HEIGHT_DEEP = 10.0       # pot/pan drawer
DRAWER_HEIGHT_TRAY = 2.5        # tray divider drawer

# Door dimensions
DOOR_THICKNESS = 0.75           # 3/4" door panel
DOOR_OVERLAY = 0.5              # overlay per side (full overlay)
DOOR_GAP = 0.125                # 1/8" gap between double doors
DOOR_SWING_ANGLE = 110          # degrees (concealed hinge max opening)

# Hinge dimensions
HINGE_CUP_DIAMETER = 1.378     # 35mm cup
HINGE_CUP_DEPTH = 0.5          # cup boring depth
HINGE_FROM_EDGE = 3.0           # center of hinge cup from top/bottom edge
HINGE_SETBACK = 0.118           # 3mm from door edge

# Toe kick
TOE_KICK_HEIGHT = 4.0
TOE_KICK_DEPTH = 3.0            # setback from face
TOE_KICK_THICKNESS = 0.75

# Cabinet box material
BOX_SIDE_THICKNESS = 0.75       # 3/4" plywood
BOX_BACK_THICKNESS = 0.25       # 1/4" plywood back


# ─── SKU Parsing Helpers ──────────────────────────────────────────────────

def _get_door_count(sku, width):
    """Determine number of doors from SKU and width.
    Eclipse convention:
      - Single door: width <= 21"
      - Double door: width >= 24"
      - Exception: B3D/B4D (all drawers, no doors)
    """
    sku_upper = sku.upper()
    # All-drawer cabinets: no doors
    if any(sku_upper.startswith(p) for p in ('B3D', 'B4D', 'B2TD', 'B2HD', 'STB4D')):
        return 0
    # Drawer base with single door below
    if sku_upper.startswith('BBD') or sku_upper.startswith('BBBD'):
        return 1
    # Wall and base standard: single if narrow, double if wide
    if width <= 21:
        return 1
    return 2


def _get_drawer_count(sku):
    """Determine number of drawers from SKU prefix.
    Eclipse naming: B3D = 3-drawer base, B4D = 4-drawer, etc.
    """
    sku_upper = sku.upper()
    if sku_upper.startswith('B4D') or sku_upper.startswith('STB4D'):
        return 4
    if sku_upper.startswith('B3D'):
        return 3
    if sku_upper.startswith('B2TD'):
        return 2  # 2 tray drawers
    if sku_upper.startswith('B2HD'):
        return 2  # 2 half drawers
    # Standard base with top drawer (NOT sink bases — they're open for plumbing)
    if any(sku_upper.startswith(p) for p in ('B', 'BBC', 'BL')):
        if not any(sku_upper.startswith(p) for p in ('BEP', 'BES', 'BWRX', 'BWC', 'BND')):
            return 1  # single top drawer is standard
    return 0


def _get_shelf_count(sku, height):
    """Determine number of adjustable shelves.
    Eclipse standard:
      - Wall 30": 2 shelves
      - Wall 36-42": 3 shelves
      - Wall 12-18": 1 shelf
      - Base (behind door): 1 shelf
      - Tall 84": 4 shelves
      - Tall 96": 5 shelves
    """
    sku_upper = sku.upper()
    # All-drawer cabinets: no shelves
    if any(sku_upper.startswith(p) for p in ('B3D', 'B4D', 'B2TD', 'B2HD', 'STB4D')):
        return 0
    # Sink bases: no shelves (open for plumbing)
    if any(sku_upper.startswith(p) for p in ('SB', 'DSB', 'SBBC')):
        return 0

    # Tall cabinets
    if any(sku_upper.startswith(p) for p in ('UT', 'PEC')):
        if height >= 96:
            return 5
        if height >= 84:
            return 4
        return 3

    # Wall cabinets
    if sku_upper.startswith('W') or sku_upper.startswith('SW') or sku_upper.startswith('RW'):
        if height <= 18:
            return 1
        if height <= 30:
            return 2
        if height <= 42:
            return 3
        return 4

    # Standard base (interior behind door below drawer): 1 shelf
    return 1


def _get_hinge_side(sku):
    """Determine hinge side from SKU suffix.
    Eclipse convention: -L = left hinge, -R = right hinge
    No suffix = double door or default left.
    """
    sku_upper = sku.upper().strip()
    if sku_upper.endswith('-R') or sku_upper.endswith('R'):
        # Check it's a hinge designation, not part of the model number
        if any(sku_upper.endswith(s) for s in ('-R', '-RH', '-RT')):
            if sku_upper.endswith('-RT'):
                return 'right'  # rollout tray, still indicates side
            return 'right'
    if sku_upper.endswith('-L') or sku_upper.endswith('-LH'):
        return 'left'
    return 'left'  # default


# ─── OCP Shape Builders ──────────────────────────────────────────────────

def make_shelf(x, y, z, width, depth):
    """Create a single shelf solid.
    x, y, z: bottom-left-back corner of shelf
    width: shelf width (cabinet interior width)
    depth: shelf depth (cabinet depth minus setbacks)
    """
    shelf_w = width - 2 * SHELF_SETBACK_SIDES
    shelf_d = depth - SHELF_SETBACK_FRONT - SHELF_SETBACK_BACK
    box = BRepPrimAPI_MakeBox(
        gp_Pnt(float(x + SHELF_SETBACK_SIDES),
                float(y + SHELF_SETBACK_BACK),
                float(z)),
        float(shelf_w), float(shelf_d), float(SHELF_THICKNESS)
    )
    return box.Shape()


def make_drawer_box(x, y, z, width, depth, box_height):
    """Create a drawer box solid (U-shaped: bottom + two sides + back).
    For simplicity, modeled as a solid box with the interior cavity.
    The drawer front is a separate piece.

    x, y, z: bottom-left-back of the drawer box space
    width: cabinet interior width
    depth: cabinet depth (drawer extends nearly full depth)
    box_height: interior box height
    """
    # Drawer box outer dimensions
    drawer_w = width - 2 * DRAWER_SLIDE_CLEARANCE
    drawer_d = depth - 1.0  # 1" clearance behind drawer
    drawer_h = box_height

    # Simplified: create as solid box representing the drawer space
    box = BRepPrimAPI_MakeBox(
        gp_Pnt(float(x + DRAWER_SLIDE_CLEARANCE),
                float(y + 0.5),
                float(z)),
        float(drawer_w), float(drawer_d), float(drawer_h)
    )
    return box.Shape()


def make_drawer_front(x, y, z, width, front_height):
    """Create a drawer front panel.
    x, y, z: bottom-left corner of the front face
    width: full cabinet width (front overlays the box)
    front_height: visible front height
    """
    box = BRepPrimAPI_MakeBox(
        gp_Pnt(float(x), float(y), float(z)),
        float(width), float(DRAWER_FRONT_THICKNESS), float(front_height)
    )
    return box.Shape()


def make_door_panel(x, y, z, door_width, door_height):
    """Create a door panel solid (closed position, flat against face).
    x, y, z: bottom-left of the door face
    """
    box = BRepPrimAPI_MakeBox(
        gp_Pnt(float(x), float(y), float(z)),
        float(door_width), float(DOOR_THICKNESS), float(door_height)
    )
    return box.Shape()


def make_hinge_indicator(x, y, z, side='left', door_height=30):
    """Create small cylinders at hinge positions to indicate hinge side.
    Eclipse uses concealed 35mm cup hinges.
    Standard positions: 3" from top edge, 3" from bottom edge.
    """
    indicators = []
    radius = HINGE_CUP_DIAMETER / 2

    # Hinge positions (distance from bottom of door)
    positions = [HINGE_FROM_EDGE, door_height - HINGE_FROM_EDGE]
    # Add middle hinge for tall doors (>40")
    if door_height > 40:
        positions.append(door_height / 2)

    for hz in positions:
        # X position depends on hinge side
        if side == 'left':
            hx = x + HINGE_SETBACK + radius
        else:
            hx = x + HINGE_SETBACK + radius  # offset calculated by caller

        ax = gp_Ax2(gp_Pnt(float(hx), float(y), float(z + hz)),
                     gp_Dir(0, 1, 0))  # cylinder axis into door
        cyl = BRepPrimAPI_MakeCylinder(ax, float(radius), float(HINGE_CUP_DEPTH))
        indicators.append(cyl.Shape())

    return indicators


def make_toe_kick_board(x, y, z, width):
    """Create the toe kick board (recessed panel at cabinet base).
    x, y, z: bottom-left-front of toe kick area
    """
    box = BRepPrimAPI_MakeBox(
        gp_Pnt(float(x), float(y + TOE_KICK_DEPTH), float(z)),
        float(width), float(TOE_KICK_THICKNESS), float(TOE_KICK_HEIGHT)
    )
    return box.Shape()


# ─── Main Interior Detail Generator ──────────────────────────────────────

def generate_interior_details(cab_data):
    """Generate all interior detail geometry for a cabinet.

    Args:
        cab_data: dict with keys:
            sku, x, depthFromWall (y), yMount (z),
            width, height, depth, zone

    Returns:
        dict with keys:
            shelves: list of OCP shapes
            drawers: list of dicts {box: shape, front: shape}
            doors: list of OCP shapes
            hinges: list of OCP shapes
            toe_kick: OCP shape or None
            metadata: dict with counts and positions
    """
    sku = cab_data.get('sku', 'UNKNOWN')
    x = float(cab_data.get('x', 0))
    y = float(cab_data.get('depthFromWall', 0))
    z = float(cab_data.get('yMount', 4))
    w = float(cab_data.get('width', 36))
    h = float(cab_data.get('height', 30))
    d = float(cab_data.get('depth', 24.875))
    zone = cab_data.get('zone', 'BASE')

    result = {
        'shelves': [],
        'drawers': [],
        'doors': [],
        'hinges': [],
        'toe_kick': None,
        'metadata': {
            'sku': sku,
            'door_count': 0,
            'drawer_count': 0,
            'shelf_count': 0,
            'hinge_side': 'left',
        }
    }

    # Skip detail generation for panels and fillers
    sku_upper = sku.upper()
    if any(sku_upper.startswith(p) for p in ('REP', 'WEP', 'BEP', 'VEP', 'FREP',
            'FWEP', 'FBEP', 'FVEP', 'F3', 'F4', 'F6')):
        return result

    # Interior dimensions (inside the cabinet box)
    interior_w = w - 2 * BOX_SIDE_THICKNESS
    interior_d = d - BOX_BACK_THICKNESS
    interior_x = x + BOX_SIDE_THICKNESS
    interior_y = y  # front face

    # ─── Toe Kick ───
    if zone in ('BASE', 'SINK_BASE'):
        result['toe_kick'] = make_toe_kick_board(x, y, 0, w)

    # ─── Drawers ───
    drawer_count = _get_drawer_count(sku)
    result['metadata']['drawer_count'] = drawer_count

    drawer_z = z + h  # start from top of cabinet, work down
    drawer_heights = []

    if drawer_count >= 3:
        # All-drawer cabinet: B3D, B4D
        if drawer_count == 4:
            # B4D: top tray + 3 equal drawers
            available_h = h - 4 * DRAWER_GAP  # gaps between drawers
            tray_h = DRAWER_HEIGHT_TRAY
            remaining = available_h - tray_h
            equal_h = remaining / 3
            drawer_heights = [tray_h, equal_h, equal_h, equal_h]
        else:
            # B3D: 3 equal drawers (graduating is common but we simplify)
            available_h = h - 3 * DRAWER_GAP
            equal_h = available_h / 3
            drawer_heights = [equal_h, equal_h, equal_h]
    elif drawer_count == 2:
        # B2TD: 2 tray drawers, or B2HD: 2 half drawers
        if sku_upper.startswith('B2TD'):
            drawer_heights = [DRAWER_HEIGHT_TRAY, DRAWER_HEIGHT_TRAY]
        else:
            available_h = h - 2 * DRAWER_GAP
            equal_h = available_h / 2
            drawer_heights = [equal_h, equal_h]
    elif drawer_count == 1:
        # Standard base: single top drawer
        drawer_heights = [DRAWER_HEIGHT_STANDARD]

    # Place drawers top-down
    current_z = z + h
    for i, dh in enumerate(drawer_heights):
        front_h = dh + DRAWER_GAP  # front includes visual gap
        current_z -= front_h
        box_shape = make_drawer_box(interior_x, interior_y, current_z,
                                     interior_w, interior_d, dh)
        front_shape = make_drawer_front(x, y, current_z, w, front_h - 0.125)
        result['drawers'].append({
            'box': box_shape,
            'front': front_shape,
            'height': dh,
            'z_position': current_z,
        })

    # Door area starts below drawers
    door_area_top = current_z if drawer_heights else z + h
    door_area_bottom = z
    door_height = door_area_top - door_area_bottom

    # ─── Doors ───
    door_count = _get_door_count(sku, w)
    result['metadata']['door_count'] = door_count
    hinge_side = _get_hinge_side(sku)
    result['metadata']['hinge_side'] = hinge_side

    if door_count > 0 and door_height > 2:
        if door_count == 1:
            # Single door — full width
            door_w = w
            door = make_door_panel(x, y, door_area_bottom, door_w, door_height)
            result['doors'].append(door)
            # Hinge indicator
            hinges = make_hinge_indicator(x, y, door_area_bottom,
                                          side=hinge_side, door_height=door_height)
            result['hinges'].extend(hinges)
        elif door_count == 2:
            # Double doors — each half width minus gap
            door_w = (w - DOOR_GAP) / 2
            # Left door
            left_door = make_door_panel(x, y, door_area_bottom, door_w, door_height)
            result['doors'].append(left_door)
            left_hinges = make_hinge_indicator(x, y, door_area_bottom,
                                               side='left', door_height=door_height)
            result['hinges'].extend(left_hinges)
            # Right door
            right_x = x + door_w + DOOR_GAP
            right_door = make_door_panel(right_x, y, door_area_bottom, door_w, door_height)
            result['doors'].append(right_door)
            right_hinges = make_hinge_indicator(right_x + door_w - HINGE_SETBACK - HINGE_CUP_DIAMETER,
                                                y, door_area_bottom,
                                                side='right', door_height=door_height)
            result['hinges'].extend(right_hinges)

    # ─── Shelves ───
    # Shelves go in the door area (below drawers, behind door)
    shelf_count = _get_shelf_count(sku, h)
    result['metadata']['shelf_count'] = shelf_count

    if shelf_count > 0 and door_height > 4:
        # Evenly space shelves in the door area
        shelf_zone_h = door_height - SHELF_THICKNESS  # leave room at top
        spacing = shelf_zone_h / (shelf_count + 1)
        for i in range(1, shelf_count + 1):
            shelf_z = door_area_bottom + spacing * i
            shelf = make_shelf(interior_x, interior_y, shelf_z,
                               interior_w, interior_d)
            result['shelves'].append(shelf)

    return result


def get_detail_summary(details):
    """Get a text summary of interior details for validation.

    Args:
        details: dict returned by generate_interior_details

    Returns:
        dict with summary info
    """
    meta = details.get('metadata', {})
    return {
        'sku': meta.get('sku', '?'),
        'doors': meta.get('door_count', 0),
        'drawers': meta.get('drawer_count', 0),
        'shelves': meta.get('shelf_count', 0),
        'hinge_side': meta.get('hinge_side', 'left'),
        'has_toe_kick': details.get('toe_kick') is not None,
        'total_shapes': (
            len(details.get('shelves', [])) +
            len(details.get('drawers', [])) +
            len(details.get('doors', [])) +
            len(details.get('hinges', []))
        ),
    }
