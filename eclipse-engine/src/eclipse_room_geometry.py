#!/usr/bin/env python3
"""
Eclipse Wall & Room Geometry — OCP Parametric 3D
=================================================
Generates solid geometry for the room shell:
  - Wall solids (with configurable thickness)
  - Window openings (boolean cut from wall)
  - Door openings (boolean cut from wall)
  - Floor slab
  - Ceiling plane
  - Soffit boxes (dropped ceiling sections)
  - Room bounding box for spatial queries

Eclipse Kitchen Room Standards:
  - Standard ceiling: 96" (8 ft), also common: 108" (9 ft), 120" (10 ft)
  - Wall thickness: 4.5" (2x4 framing + 0.5" drywall each side)
  - Exterior wall: 6.5" (2x6 framing + drywall)
  - Window sill height: 36-42" (above counter) or 48" (above backsplash)
  - Window header: 80-84" from floor (standard)
  - Door opening: 32-36" wide × 80" tall (standard interior)
  - Door header: 82" from floor (80" door + 2" frame)
  - Floor thickness: 1" (subfloor + finish)
  - Soffit depth: varies (typically 12-24" from ceiling)

Coordinate system (matches kitchen-3d-engine.py):
  X = along wall (left-to-right)
  Y = depth from wall face (into room)
  Z = height from floor (bottom-to-top)
"""

from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox
from OCP.BRepAlgoAPI import BRepAlgoAPI_Cut, BRepAlgoAPI_Fuse
from OCP.gp import gp_Pnt

# ─── Constants ──────────────────────────────────────────────────────────────

# Wall dimensions
WALL_THICKNESS_INTERIOR = 4.5    # 2×4 + drywall both sides
WALL_THICKNESS_EXTERIOR = 6.5    # 2×6 + drywall both sides
WALL_THICKNESS_DEFAULT = 4.5

# Standard ceiling heights
CEILING_HEIGHT_8FT = 96
CEILING_HEIGHT_9FT = 108
CEILING_HEIGHT_10FT = 120
CEILING_DEFAULT = 96

# Floor
FLOOR_THICKNESS = 1.0

# Window defaults
WINDOW_SILL_ABOVE_COUNTER = 42     # typical kitchen window above counter
WINDOW_SILL_ABOVE_BACKSPLASH = 54  # above backsplash zone
WINDOW_HEADER_HEIGHT = 84          # top of window frame from floor
WINDOW_WIDTH_DEFAULT = 36          # common kitchen window
WINDOW_FRAME_THICKNESS = 3.5       # wood frame depth

# Door defaults
DOOR_WIDTH_DEFAULT = 36            # standard kitchen doorway
DOOR_HEIGHT_DEFAULT = 80           # standard door height
DOOR_HEADER_HEIGHT = 82            # 80" door + 2" frame/header
DOOR_FRAME_THICKNESS = 4.5        # matches wall thickness

# Soffit
SOFFIT_DEPTH_DEFAULT = 14          # drop from ceiling (above uppers)
SOFFIT_PROJECTION_DEFAULT = 14     # projection from wall (matches upper depth + 1")


# ─── Wall Solid Generation ───────────────────────────────────────────────

def make_wall_solid(x_start, x_end, y_face, thickness=WALL_THICKNESS_DEFAULT,
                     height=CEILING_DEFAULT, z_floor=0):
    """Create a solid wall panel.

    Args:
        x_start: left edge X coordinate
        x_end: right edge X coordinate
        y_face: Y position of the room-facing surface
        thickness: wall thickness (into the wall, away from room)
        height: wall height (floor to ceiling)
        z_floor: floor elevation (usually 0)

    Returns:
        OCP TopoDS_Shape solid
    """
    width = x_end - x_start
    # Wall extends from y_face backward (negative Y = into wall)
    box = BRepPrimAPI_MakeBox(
        gp_Pnt(float(x_start), float(y_face - thickness), float(z_floor)),
        float(width), float(thickness), float(height)
    )
    return box.Shape()


def make_window_opening(x_center, y_face, sill_height=WINDOW_SILL_ABOVE_COUNTER,
                         header_height=WINDOW_HEADER_HEIGHT,
                         width=WINDOW_WIDTH_DEFAULT,
                         thickness=WALL_THICKNESS_DEFAULT):
    """Create a solid box representing a window opening (for boolean cut from wall).

    Args:
        x_center: X center of window
        y_face: Y position of wall face
        sill_height: bottom of window (Z from floor)
        header_height: top of window (Z from floor)
        width: window width
        thickness: wall thickness (opening goes full depth)

    Returns:
        OCP TopoDS_Shape solid (to be subtracted from wall)
    """
    window_h = header_height - sill_height
    x_left = x_center - width / 2

    box = BRepPrimAPI_MakeBox(
        gp_Pnt(float(x_left), float(y_face - thickness - 0.1), float(sill_height)),
        float(width), float(thickness + 0.2), float(window_h)
    )
    return box.Shape()


def make_door_opening(x_center, y_face, width=DOOR_WIDTH_DEFAULT,
                       height=DOOR_HEIGHT_DEFAULT,
                       thickness=WALL_THICKNESS_DEFAULT, z_floor=0):
    """Create a solid box representing a door opening (for boolean cut from wall).

    Args:
        x_center: X center of door
        y_face: Y position of wall face
        width: door opening width
        height: door opening height
        thickness: wall thickness
        z_floor: floor elevation

    Returns:
        OCP TopoDS_Shape solid (to be subtracted from wall)
    """
    x_left = x_center - width / 2

    box = BRepPrimAPI_MakeBox(
        gp_Pnt(float(x_left), float(y_face - thickness - 0.1), float(z_floor)),
        float(width), float(thickness + 0.2), float(height)
    )
    return box.Shape()


def make_floor_slab(x_min, x_max, y_min, y_max,
                     thickness=FLOOR_THICKNESS, z_top=0):
    """Create a floor slab solid.

    Args:
        x_min, x_max: X extent of room
        y_min, y_max: Y extent of room (depth)
        thickness: floor thickness
        z_top: top of floor (usually 0, cabinets sit on top)

    Returns:
        OCP TopoDS_Shape solid
    """
    box = BRepPrimAPI_MakeBox(
        gp_Pnt(float(x_min), float(y_min), float(z_top - thickness)),
        float(x_max - x_min), float(y_max - y_min), float(thickness)
    )
    return box.Shape()


def make_ceiling_slab(x_min, x_max, y_min, y_max,
                       thickness=FLOOR_THICKNESS, z_bottom=CEILING_DEFAULT):
    """Create a ceiling slab solid.

    Args:
        x_min, x_max: X extent of room
        y_min, y_max: Y extent of room
        thickness: ceiling thickness
        z_bottom: bottom of ceiling (top of room)

    Returns:
        OCP TopoDS_Shape solid
    """
    box = BRepPrimAPI_MakeBox(
        gp_Pnt(float(x_min), float(y_min), float(z_bottom)),
        float(x_max - x_min), float(y_max - y_min), float(thickness)
    )
    return box.Shape()


def make_soffit(x_start, x_end, y_face, projection=SOFFIT_PROJECTION_DEFAULT,
                drop=SOFFIT_DEPTH_DEFAULT, ceiling=CEILING_DEFAULT):
    """Create a soffit box (dropped ceiling section above cabinets).

    Soffits are common above upper cabinets when ceiling > 96" to fill
    the gap between cabinet top and ceiling.

    Args:
        x_start: left edge X
        x_end: right edge X
        y_face: Y position of wall face
        projection: soffit depth from wall (typically 13-14" to match uppers)
        drop: soffit height (distance from ceiling downward)
        ceiling: ceiling height

    Returns:
        OCP TopoDS_Shape solid
    """
    width = x_end - x_start
    z_top = ceiling
    z_bottom = ceiling - drop

    box = BRepPrimAPI_MakeBox(
        gp_Pnt(float(x_start), float(y_face), float(z_bottom)),
        float(width), float(projection), float(drop)
    )
    return box.Shape()


# ─── Room Shell Builder ─────────────────────────────────────────────────

def build_room_shell(room_def):
    """Build the complete room shell geometry.

    Args:
        room_def: dict with:
            walls: list of wall definitions, each with:
                id: wall identifier
                x_start: left edge X
                x_end: right edge X
                y_face: Y position of wall face (room-facing surface)
                thickness: wall thickness (optional, default 4.5")
                is_exterior: bool (optional, uses 6.5" thickness)
                windows: list of window definitions (optional)
                doors: list of door definitions (optional)
                soffits: list of soffit definitions (optional)
            ceiling: ceiling height (default 96")
            floor: dict with x_min, x_max, y_min, y_max (optional)

    Returns:
        dict with:
            walls: dict of wallId -> OCP shape
            windows: list of window info dicts
            doors: list of door info dicts
            floor: OCP shape or None
            ceiling_slab: OCP shape or None
            soffits: list of OCP shapes
            bounding_box: dict with room extents
            metadata: dict with room info
    """
    ceiling_h = float(room_def.get('ceiling', CEILING_DEFAULT))

    result = {
        'walls': {},
        'windows': [],
        'doors': [],
        'floor': None,
        'ceiling_slab': None,
        'soffits': [],
        'bounding_box': None,
        'metadata': {
            'ceiling_height': ceiling_h,
            'wall_count': 0,
            'window_count': 0,
            'door_count': 0,
        }
    }

    # Track room extents for bounding box
    x_mins, x_maxs, y_mins, y_maxs = [], [], [], []

    walls = room_def.get('walls', [])
    for wall_def in walls:
        wall_id = wall_def.get('id', 'wall_unknown')
        x_start = float(wall_def.get('x_start', 0))
        x_end = float(wall_def.get('x_end', 120))
        y_face = float(wall_def.get('y_face', 0))

        is_ext = wall_def.get('is_exterior', False)
        thickness = float(wall_def.get('thickness',
                          WALL_THICKNESS_EXTERIOR if is_ext else WALL_THICKNESS_DEFAULT))

        # Create base wall solid
        wall_shape = make_wall_solid(x_start, x_end, y_face, thickness, ceiling_h)

        # Cut window openings
        for win_def in wall_def.get('windows', []):
            win_x = float(win_def.get('x_center', (x_start + x_end) / 2))
            win_w = float(win_def.get('width', WINDOW_WIDTH_DEFAULT))
            win_sill = float(win_def.get('sill_height', WINDOW_SILL_ABOVE_COUNTER))
            win_header = float(win_def.get('header_height', WINDOW_HEADER_HEIGHT))

            opening = make_window_opening(win_x, y_face, win_sill, win_header,
                                           win_w, thickness)
            cut = BRepAlgoAPI_Cut(wall_shape, opening)
            if cut.IsDone():
                wall_shape = cut.Shape()

            result['windows'].append({
                'wall': wall_id,
                'x_center': win_x,
                'width': win_w,
                'sill_height': win_sill,
                'header_height': win_header,
                'x_min': win_x - win_w / 2,
                'x_max': win_x + win_w / 2,
            })

        # Cut door openings
        for door_def in wall_def.get('doors', []):
            door_x = float(door_def.get('x_center', x_start + 18))
            door_w = float(door_def.get('width', DOOR_WIDTH_DEFAULT))
            door_h = float(door_def.get('height', DOOR_HEIGHT_DEFAULT))

            opening = make_door_opening(door_x, y_face, door_w, door_h, thickness)
            cut = BRepAlgoAPI_Cut(wall_shape, opening)
            if cut.IsDone():
                wall_shape = cut.Shape()

            result['doors'].append({
                'wall': wall_id,
                'x_center': door_x,
                'width': door_w,
                'height': door_h,
                'x_min': door_x - door_w / 2,
                'x_max': door_x + door_w / 2,
            })

        # Create soffits
        for soffit_def in wall_def.get('soffits', []):
            s_x_start = float(soffit_def.get('x_start', x_start))
            s_x_end = float(soffit_def.get('x_end', x_end))
            s_proj = float(soffit_def.get('projection', SOFFIT_PROJECTION_DEFAULT))
            s_drop = float(soffit_def.get('drop', SOFFIT_DEPTH_DEFAULT))

            soffit_shape = make_soffit(s_x_start, s_x_end, y_face, s_proj, s_drop, ceiling_h)
            result['soffits'].append(soffit_shape)

        result['walls'][wall_id] = wall_shape

        # Track extents
        x_mins.append(x_start)
        x_maxs.append(x_end)
        y_mins.append(y_face - thickness)
        y_maxs.append(y_face)

    result['metadata']['wall_count'] = len(walls)
    result['metadata']['window_count'] = len(result['windows'])
    result['metadata']['door_count'] = len(result['doors'])

    # Floor and ceiling
    floor_def = room_def.get('floor')
    if floor_def:
        result['floor'] = make_floor_slab(
            float(floor_def.get('x_min', min(x_mins) if x_mins else 0)),
            float(floor_def.get('x_max', max(x_maxs) if x_maxs else 120)),
            float(floor_def.get('y_min', min(y_mins) if y_mins else -6)),
            float(floor_def.get('y_max', max(y_maxs) if y_maxs else 120)),
        )
        result['ceiling_slab'] = make_ceiling_slab(
            float(floor_def.get('x_min', min(x_mins) if x_mins else 0)),
            float(floor_def.get('x_max', max(x_maxs) if x_maxs else 120)),
            float(floor_def.get('y_min', min(y_mins) if y_mins else -6)),
            float(floor_def.get('y_max', max(y_maxs) if y_maxs else 120)),
            z_bottom=ceiling_h
        )

    # Bounding box
    if x_mins:
        result['bounding_box'] = {
            'x_min': min(x_mins),
            'x_max': max(x_maxs),
            'y_min': min(y_mins),
            'y_max': max(y_maxs) if y_maxs else 120,
            'z_min': 0,
            'z_max': ceiling_h,
        }

    return result


# ─── Window/Door Collision Checks ────────────────────────────────────────

def validate_cabinets_vs_openings(cabinets, room_geometry):
    """Check if any cabinets overlap with window or door openings.

    Args:
        cabinets: list of cabinet dicts with x, width, yMount, height, wall
        room_geometry: dict returned by build_room_shell

    Returns:
        list of validation issues
    """
    issues = []

    for cab in cabinets:
        cab_x = float(cab.get('x', 0))
        cab_w = float(cab.get('width', 0))
        cab_z = float(cab.get('yMount', 0))
        cab_h = float(cab.get('height', 0))
        cab_right = cab_x + cab_w
        cab_top = cab_z + cab_h
        cab_wall = cab.get('wall', '')

        # Check against windows on the same wall
        for win in room_geometry.get('windows', []):
            if win.get('wall', '') != cab_wall:
                continue

            win_left = win['x_min']
            win_right = win['x_max']
            win_bottom = win['sill_height']
            win_top = win['header_height']

            # Check X overlap
            x_overlap = cab_x < win_right and cab_right > win_left
            # Check Z overlap
            z_overlap = cab_z < win_top and cab_top > win_bottom

            if x_overlap and z_overlap:
                # Calculate overlap dimensions
                overlap_x = min(cab_right, win_right) - max(cab_x, win_left)
                overlap_z = min(cab_top, win_top) - max(cab_z, win_bottom)

                issues.append({
                    'severity': 'error',
                    'rule': 'window_obstruction',
                    'cabinet': cab.get('sku', '?'),
                    'wall': cab_wall,
                    'message': (f"{cab.get('sku', '?')} ({cab_w}\"w × {cab_h}\"h at x={cab_x}\", "
                               f"z={cab_z}\") overlaps window at x={win_left:.0f}-{win_right:.0f}\", "
                               f"z={win_bottom:.0f}-{win_top:.0f}\" "
                               f"(overlap: {overlap_x:.1f}\"w × {overlap_z:.1f}\"h)")
                })

        # Check against doors on the same wall
        for door in room_geometry.get('doors', []):
            if door.get('wall', '') != cab_wall:
                continue

            door_left = door['x_min']
            door_right = door['x_max']
            door_top = door['height']

            # Check X overlap (doors go from floor to header)
            x_overlap = cab_x < door_right and cab_right > door_left
            z_overlap = cab_z < door_top and cab_top > 0

            if x_overlap and z_overlap:
                overlap_x = min(cab_right, door_right) - max(cab_x, door_left)

                issues.append({
                    'severity': 'error',
                    'rule': 'door_obstruction',
                    'cabinet': cab.get('sku', '?'),
                    'wall': cab_wall,
                    'message': (f"{cab.get('sku', '?')} overlaps door opening at "
                               f"x={door_left:.0f}-{door_right:.0f}\" "
                               f"(overlap: {overlap_x:.1f}\")")
                })

    return issues


def get_available_wall_space(wall_id, room_geometry):
    """Calculate available linear wall space after subtracting windows and doors.

    Args:
        wall_id: wall identifier
        room_geometry: dict from build_room_shell

    Returns:
        dict with:
            total_length: total wall length
            base_zone: available X ranges for base cabinets (below windows)
            upper_zone: available X ranges for upper cabinets (between windows)
            full_height: available X ranges for tall cabinets (no obstructions)
    """
    wall_shape = room_geometry.get('walls', {}).get(wall_id)
    if wall_shape is None:
        return {'total_length': 0, 'base_zone': [], 'upper_zone': [], 'full_height': []}

    # Get wall extents from bounding box
    bb = room_geometry.get('bounding_box', {})
    wall_left = bb.get('x_min', 0)
    wall_right = bb.get('x_max', 120)
    total = wall_right - wall_left

    # Collect obstructions
    windows = [w for w in room_geometry.get('windows', []) if w.get('wall') == wall_id]
    doors = [d for d in room_geometry.get('doors', []) if d.get('wall') == wall_id]

    # For base zone: doors block, windows don't (windows are above counter)
    base_blocked = [(d['x_min'], d['x_max']) for d in doors]
    base_zone = _subtract_ranges(wall_left, wall_right, base_blocked)

    # For upper zone: windows block, doors block
    upper_blocked = (
        [(w['x_min'], w['x_max']) for w in windows] +
        [(d['x_min'], d['x_max']) for d in doors]
    )
    upper_zone = _subtract_ranges(wall_left, wall_right, upper_blocked)

    # For full-height: both windows and doors block
    full_blocked = upper_blocked
    full_zone = _subtract_ranges(wall_left, wall_right, full_blocked)

    return {
        'total_length': total,
        'base_zone': base_zone,
        'upper_zone': upper_zone,
        'full_height': full_zone,
    }


def _subtract_ranges(start, end, blocked):
    """Subtract blocked ranges from [start, end], return available ranges.

    Args:
        start: start of total range
        end: end of total range
        blocked: list of (block_start, block_end) tuples

    Returns:
        list of (avail_start, avail_end) tuples
    """
    if not blocked:
        return [(start, end)]

    # Sort and merge overlapping blocks
    sorted_blocks = sorted(blocked, key=lambda b: b[0])
    merged = [sorted_blocks[0]]
    for block in sorted_blocks[1:]:
        if block[0] <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], block[1]))
        else:
            merged.append(block)

    # Find gaps
    available = []
    cursor = start
    for block_start, block_end in merged:
        if cursor < block_start:
            available.append((cursor, block_start))
        cursor = max(cursor, block_end)
    if cursor < end:
        available.append((cursor, end))

    return available
