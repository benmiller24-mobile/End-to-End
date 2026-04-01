#!/usr/bin/env python3
"""
Eclipse Countertop & Backsplash Geometry — OCP Parametric 3D
=============================================================
Generates solid geometry for countertops and backsplashes:
  - Continuous countertop slabs spanning adjacent base cabinets
  - Sink cutouts (undermount rectangular opening)
  - Cooktop cutouts (rectangular opening for drop-in cooktops)
  - Backsplash slabs (4" or full-height)
  - Island countertops with overhangs for seating
  - Waterfall edges (countertop wraps down to floor)
  - L-shaped and U-shaped countertop miters at corners

Eclipse Countertop Standards (from constraints.js / spatial-model.js):
  - Counter height: 36" from floor (34.5" base total + 1.5" slab)
  - Counter thickness: 1.5" (standard, can be 0.75" or 3" mitered)
  - Counter depth: 26.375" (24.875" base incl door + 1.5" front overhang)
  - Backsplash height: 4" standard, 18" full-height (to upper bottom)
  - Backsplash thickness: 0.75" (3/4" stone) or 0.375" (tile)
  - Sink cutout: sized from sink spec, setback 2" from front edge
  - Cooktop cutout: sized from appliance spec, centered in cabinet width
  - Island overhang for seating: 12-15" past base (NKBA standard)
"""

from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox
from OCP.BRepAlgoAPI import BRepAlgoAPI_Cut, BRepAlgoAPI_Fuse
from OCP.gp import gp_Pnt

# ─── Constants ──────────────────────────────────────────────────────────────

# Countertop dimensions (Eclipse standard from constraints.js)
COUNTER_HEIGHT = 36.0           # floor to top of counter
COUNTER_THICKNESS = 1.5         # standard slab thickness
COUNTER_DEPTH = 26.375          # 24.875" base (24+7/8 door) + 1.5" overhang
COUNTER_OVERHANG_FRONT = 1.5    # overhang past base face
COUNTER_OVERHANG_SIDES = 0.0    # no overhang at sides (filler handles transition)
BASE_DEPTH = 24.875             # base cabinet depth (24" body + 7/8" door)

# Backsplash dimensions
BACKSPLASH_HEIGHT_STANDARD = 4.0    # standard backsplash
BACKSPLASH_HEIGHT_FULL = 18.0       # full-height (counter to upper bottom)
BACKSPLASH_THICKNESS = 0.75         # 3/4" stone (match counter material)

# Sink cutout dimensions (standard undermount clearances)
SINK_CUTOUT_SETBACK_FRONT = 2.0     # from front edge of counter
SINK_CUTOUT_SETBACK_BACK = 2.0      # from back edge (wall)
SINK_CUTOUT_SETBACK_SIDES = 2.5     # from each side of sink cabinet
SINK_CUTOUT_CORNER_RADIUS = 0.75    # undermount corners (simplified as box)

# Cooktop cutout dimensions
COOKTOP_CUTOUT_SETBACK_FRONT = 2.0
COOKTOP_CUTOUT_SETBACK_BACK = 4.0   # more clearance at back for gas lines
COOKTOP_CUTOUT_SETBACK_SIDES = 3.0

# Island seating overhang
ISLAND_SEATING_OVERHANG = 12.0      # NKBA minimum for knee clearance
ISLAND_SEATING_OVERHANG_MAX = 15.0  # common maximum

# Waterfall edge
WATERFALL_THICKNESS = 1.5           # matches counter thickness


# ─── Countertop Slab Generation ──────────────────────────────────────────

def make_countertop_slab(x_start, x_end, y_back, depth=COUNTER_DEPTH,
                          thickness=COUNTER_THICKNESS, z_top=COUNTER_HEIGHT):
    """Create a countertop slab solid.

    Args:
        x_start: left edge X coordinate (inches)
        x_end: right edge X coordinate (inches)
        y_back: Y coordinate of wall face (depth-from-wall origin)
        depth: counter depth (default 26.375")
        thickness: slab thickness (default 1.5")
        z_top: top surface height (default 36")

    Returns:
        OCP TopoDS_Shape solid
    """
    width = x_end - x_start
    z_bottom = z_top - thickness

    box = BRepPrimAPI_MakeBox(
        gp_Pnt(float(x_start), float(y_back), float(z_bottom)),
        float(width), float(depth), float(thickness)
    )
    return box.Shape()


def make_sink_cutout(sink_x, sink_width, sink_depth, y_back,
                     counter_depth=COUNTER_DEPTH, z_top=COUNTER_HEIGHT,
                     thickness=COUNTER_THICKNESS):
    """Create a solid representing the sink cutout volume.
    This gets boolean-subtracted from the countertop slab.

    Args:
        sink_x: left edge of sink cabinet (X coordinate)
        sink_width: sink opening width (from sink spec, e.g. 33")
        sink_depth: sink opening depth (from sink spec, e.g. 22")
        y_back: Y coordinate of wall face
        counter_depth: counter depth
        z_top: counter top height
        thickness: counter thickness

    Returns:
        OCP TopoDS_Shape solid (to be subtracted)
    """
    # Cutout centered in the cabinet width, setback from front edge
    cutout_w = sink_width - 2 * SINK_CUTOUT_SETBACK_SIDES
    cutout_d = sink_depth - SINK_CUTOUT_SETBACK_FRONT - SINK_CUTOUT_SETBACK_BACK

    if cutout_w <= 0 or cutout_d <= 0:
        # Sink too small for cutout, return a tiny box
        cutout_w = max(cutout_w, 6)
        cutout_d = max(cutout_d, 6)

    cutout_x = sink_x + SINK_CUTOUT_SETBACK_SIDES
    cutout_y = y_back + SINK_CUTOUT_SETBACK_BACK
    z_bottom = z_top - thickness - 0.1  # extend slightly below for clean cut

    box = BRepPrimAPI_MakeBox(
        gp_Pnt(float(cutout_x), float(cutout_y), float(z_bottom)),
        float(cutout_w), float(cutout_d), float(thickness + 0.2)
    )
    return box.Shape()


def make_cooktop_cutout(cooktop_x, cooktop_width, cooktop_depth, y_back,
                         z_top=COUNTER_HEIGHT, thickness=COUNTER_THICKNESS):
    """Create a solid representing the cooktop cutout volume.

    Args:
        cooktop_x: left edge of cooktop cabinet (X coordinate)
        cooktop_width: cooktop cutout width (from appliance spec)
        cooktop_depth: cooktop cutout depth (from appliance spec)
        y_back: Y coordinate of wall face
        z_top: counter top height
        thickness: counter thickness

    Returns:
        OCP TopoDS_Shape solid (to be subtracted)
    """
    cutout_w = cooktop_width - 2 * COOKTOP_CUTOUT_SETBACK_SIDES
    cutout_d = cooktop_depth - COOKTOP_CUTOUT_SETBACK_FRONT - COOKTOP_CUTOUT_SETBACK_BACK

    if cutout_w <= 0 or cutout_d <= 0:
        cutout_w = max(cutout_w, 12)
        cutout_d = max(cutout_d, 12)

    cutout_x = cooktop_x + COOKTOP_CUTOUT_SETBACK_SIDES
    cutout_y = y_back + COOKTOP_CUTOUT_SETBACK_BACK
    z_bottom = z_top - thickness - 0.1

    box = BRepPrimAPI_MakeBox(
        gp_Pnt(float(cutout_x), float(cutout_y), float(z_bottom)),
        float(cutout_w), float(cutout_d), float(thickness + 0.2)
    )
    return box.Shape()


def make_backsplash(x_start, x_end, y_wall, height=BACKSPLASH_HEIGHT_STANDARD,
                     thickness=BACKSPLASH_THICKNESS, z_bottom=COUNTER_HEIGHT):
    """Create a backsplash slab solid.

    Args:
        x_start: left edge X coordinate
        x_end: right edge X coordinate
        y_wall: Y coordinate of wall face (backsplash sits against wall)
        height: backsplash height (4" standard or 18" full)
        thickness: slab thickness
        z_bottom: bottom of backsplash (top of counter)

    Returns:
        OCP TopoDS_Shape solid
    """
    width = x_end - x_start
    box = BRepPrimAPI_MakeBox(
        gp_Pnt(float(x_start), float(y_wall), float(z_bottom)),
        float(width), float(thickness), float(height)
    )
    return box.Shape()


def make_waterfall_edge(x, y_back, depth=COUNTER_DEPTH,
                         thickness=WATERFALL_THICKNESS,
                         z_top=COUNTER_HEIGHT, side='left'):
    """Create a waterfall edge (counter wraps down side to floor).

    Args:
        x: X position of the waterfall
        y_back: Y coordinate of wall face
        depth: counter depth
        thickness: waterfall panel thickness (matches counter)
        z_top: top of counter
        side: 'left' or 'right' — determines X offset

    Returns:
        OCP TopoDS_Shape solid
    """
    # Waterfall runs from counter top down to floor
    z_bottom = 0
    waterfall_h = z_top - z_bottom

    if side == 'left':
        wx = x - thickness  # extends left of the counter edge
    else:
        wx = x  # starts at right edge

    box = BRepPrimAPI_MakeBox(
        gp_Pnt(float(wx), float(y_back), float(z_bottom)),
        float(thickness), float(depth), float(waterfall_h)
    )
    return box.Shape()


def make_island_countertop(x_start, x_end, y_front, y_back,
                            seating_side=None, seating_overhang=ISLAND_SEATING_OVERHANG,
                            thickness=COUNTER_THICKNESS, z_top=COUNTER_HEIGHT):
    """Create an island countertop with optional seating overhang.

    Args:
        x_start: left edge X
        x_end: right edge X
        y_front: front face Y (toward room)
        y_back: back face Y (toward work side)
        seating_side: 'front', 'back', 'left', 'right', or None
        seating_overhang: overhang distance for seating
        thickness: slab thickness
        z_top: top surface height

    Returns:
        OCP TopoDS_Shape solid (may be fused from main + overhang)
    """
    width = x_end - x_start
    depth = y_back - y_front
    z_bottom = z_top - thickness

    # Main slab
    main = BRepPrimAPI_MakeBox(
        gp_Pnt(float(x_start), float(y_front), float(z_bottom)),
        float(width), float(depth), float(thickness)
    ).Shape()

    if seating_side is None:
        return main

    # Seating overhang extension
    if seating_side == 'front':
        overhang = BRepPrimAPI_MakeBox(
            gp_Pnt(float(x_start), float(y_front - seating_overhang), float(z_bottom)),
            float(width), float(seating_overhang), float(thickness)
        ).Shape()
    elif seating_side == 'back':
        overhang = BRepPrimAPI_MakeBox(
            gp_Pnt(float(x_start), float(y_back), float(z_bottom)),
            float(width), float(seating_overhang), float(thickness)
        ).Shape()
    elif seating_side == 'left':
        overhang = BRepPrimAPI_MakeBox(
            gp_Pnt(float(x_start - seating_overhang), float(y_front), float(z_bottom)),
            float(seating_overhang), float(depth), float(thickness)
        ).Shape()
    elif seating_side == 'right':
        overhang = BRepPrimAPI_MakeBox(
            gp_Pnt(float(x_end), float(y_front), float(z_bottom)),
            float(seating_overhang), float(depth), float(thickness)
        ).Shape()
    else:
        return main

    # Fuse main slab and overhang
    fused = BRepAlgoAPI_Fuse(main, overhang)
    if fused.IsDone():
        return fused.Shape()
    return main


# ─── Composite Countertop Builder ────────────────────────────────────────

def build_wall_countertop(wall_cabinets, y_wall=0, appliances=None):
    """Build a continuous countertop for a wall's base cabinets.

    Finds contiguous runs of base-zone cabinets, creates slabs for each run,
    and cuts out sink and cooktop openings.

    Args:
        wall_cabinets: list of dicts, each with:
            sku, x, width, depth, zone, yMount
        y_wall: Y coordinate of the wall face
        appliances: list of dicts with:
            type ('sink', 'cooktop', 'range'), x, width, depth

    Returns:
        dict with:
            slabs: list of OCP shapes (countertop segments)
            backsplashes: list of OCP shapes
            cutouts: list of dicts {type, shape} for reference
            metadata: dict with measurements
    """
    result = {
        'slabs': [],
        'backsplashes': [],
        'cutouts': [],
        'metadata': {
            'total_length': 0,
            'total_sqft': 0,
            'cutout_count': 0,
        }
    }

    if not wall_cabinets:
        return result

    # Filter to base-zone cabinets (get counter on top)
    base_cabs = [c for c in wall_cabinets
                 if c.get('zone', '') in ('BASE', 'SINK_BASE')
                 and not _is_panel_or_filler(c.get('sku', ''))]

    if not base_cabs:
        return result

    # Sort by X position
    base_cabs.sort(key=lambda c: float(c.get('x', 0)))

    # Find contiguous runs (cabinets touching or within 0.25" gap)
    runs = _find_contiguous_runs(base_cabs)

    appliances = appliances or []
    total_length = 0

    for run in runs:
        x_start = float(run[0].get('x', 0))
        last_cab = run[-1]
        x_end = float(last_cab.get('x', 0)) + float(last_cab.get('width', 0))
        run_length = x_end - x_start
        total_length += run_length

        # Create countertop slab for this run
        slab = make_countertop_slab(x_start, x_end, y_wall,
                                     depth=COUNTER_DEPTH,
                                     thickness=COUNTER_THICKNESS)

        # Find and apply cutouts within this run
        for cab in run:
            cab_sku = cab.get('sku', '').upper()
            cab_x = float(cab.get('x', 0))
            cab_w = float(cab.get('width', 36))

            # Sink cutout
            if any(cab_sku.startswith(p) for p in ('SB', 'DSB', 'SBBC')):
                # Find matching sink spec from appliances
                sink = _find_appliance_at(appliances, 'sink', cab_x, cab_w)
                sink_w = sink.get('width', 33) if sink else min(cab_w, 33)
                sink_d = sink.get('depth', 22) if sink else 22

                cutout = make_sink_cutout(cab_x, sink_w, sink_d, y_wall)
                cut_result = BRepAlgoAPI_Cut(slab, cutout)
                if cut_result.IsDone():
                    slab = cut_result.Shape()
                result['cutouts'].append({
                    'type': 'sink',
                    'shape': cutout,
                    'x': cab_x,
                    'width': sink_w,
                })

        # Cooktop cutouts (from appliance list)
        for app in appliances:
            if app.get('type') in ('cooktop',):
                app_x = float(app.get('x', 0))
                app_w = float(app.get('width', 36))
                app_d = float(app.get('depth', 21))
                # Check if cooktop is within this run
                if app_x >= x_start and app_x + app_w <= x_end:
                    cutout = make_cooktop_cutout(app_x, app_w, app_d, y_wall)
                    cut_result = BRepAlgoAPI_Cut(slab, cutout)
                    if cut_result.IsDone():
                        slab = cut_result.Shape()
                    result['cutouts'].append({
                        'type': 'cooktop',
                        'shape': cutout,
                        'x': app_x,
                        'width': app_w,
                    })

        result['slabs'].append(slab)

        # Create backsplash for this run
        backsplash = make_backsplash(x_start, x_end, y_wall,
                                      height=BACKSPLASH_HEIGHT_STANDARD)
        result['backsplashes'].append(backsplash)

    # Metadata
    result['metadata']['total_length'] = total_length
    result['metadata']['total_sqft'] = round(
        total_length * COUNTER_DEPTH / 144, 2)  # convert sq inches to sq feet
    result['metadata']['cutout_count'] = len(result['cutouts'])

    return result


# ─── Helpers ──────────────────────────────────────────────────────────────

def _is_panel_or_filler(sku):
    """Check if SKU is a panel or filler (doesn't get countertop)."""
    sku_upper = sku.upper()
    return any(sku_upper.startswith(p) for p in (
        'REP', 'WEP', 'BEP', 'VEP', 'FREP', 'FWEP', 'FBEP', 'FVEP',
        'F3', 'F4', 'F6', 'EDGTL'
    ))


def _find_contiguous_runs(sorted_cabs, max_gap=0.25):
    """Group sorted cabinets into contiguous runs.
    Cabinets within max_gap inches of each other are considered touching.
    """
    if not sorted_cabs:
        return []

    runs = [[sorted_cabs[0]]]
    for cab in sorted_cabs[1:]:
        prev = runs[-1][-1]
        prev_end = float(prev.get('x', 0)) + float(prev.get('width', 0))
        cab_start = float(cab.get('x', 0))
        if cab_start - prev_end <= max_gap:
            runs[-1].append(cab)
        else:
            runs.append([cab])

    return runs


def _find_appliance_at(appliances, app_type, x, width):
    """Find an appliance of given type near the specified position."""
    for app in appliances:
        if app.get('type') != app_type:
            continue
        app_x = float(app.get('x', -999))
        app_w = float(app.get('width', 0))
        # Check overlap
        if app_x < x + width and app_x + app_w > x:
            return app
    return None
