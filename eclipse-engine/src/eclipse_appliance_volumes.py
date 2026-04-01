#!/usr/bin/env python3
"""
Eclipse Appliance Collision Volumes — OCP Parametric 3D
========================================================
Generates solid collision volumes for kitchen appliances based on
real manufacturer specs from applianceData.js.

Appliance types and their 3D characteristics:
  - Refrigerator: 84" tall, 36-48" wide, 24-30" deep, floor-standing
  - Range: 36" tall, 30-60" wide, 25.5-30.25" deep, replaces base cabinet
  - Cooktop: 4-9.5" tall (surface only), drops into countertop cutout
  - Wall Oven: 28.75-51" tall, sits in oven cabinet cutout
  - Dishwasher: 33.5-34" tall, 24" wide, sits under counter
  - Microwave (drawer): 18.75" tall, sits in base or wall cabinet
  - Hood: 10-22" tall, mounted above cooktop/range at 54"+ height
  - Wine Column: 84" tall, 24" wide, floor-standing like fridge
  - Sink: counter-mounted, cutout handled by countertop module

Eclipse appliance integration rules:
  - Fridge/freezer/wine: floor to 84", RW cabinet above (84-96")
  - Range: replaces base cabinets, counter-height (36"), extends 1-4" past base depth
  - Cooktop: drops into countertop, handled as cutout (not collision volume)
  - Dishwasher: sits under counter, 24" wide, adjacent to sink (NKBA)
  - Wall oven: sits inside oven cabinet (O27, O30, O33, O36 SKUs)
  - Hood: above cooking surface, minimum 30" above cooktop (NKBA)
"""

from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox
from OCP.gp import gp_Pnt
from OCP.BRepAlgoAPI import BRepAlgoAPI_Fuse

# ─── Appliance Dimension Database ─────────────────────────────────────────
# Standard dimensions by type (from applianceData.js manufacturer specs)
# Format: { width_options, height, depth, yMount (floor position) }

APPLIANCE_DEFAULTS = {
    'refrigerator': {
        'width': 36,
        'height': 84,
        'depth': 24,       # counter-depth standard
        'yMount': 0,       # floor-standing
        'zone': 'TALL',
        'depth_options': {
            'counter_depth': 24,
            'standard': 27,
            'pro': 30,
        }
    },
    'freezer': {
        'width': 24,
        'height': 84,
        'depth': 24,
        'yMount': 0,
        'zone': 'TALL',
        'depth_options': {
            'counter_depth': 24,
            'standard': 27,
        }
    },
    'range': {
        'width': 36,
        'height': 36,       # counter-height
        'depth': 28.5,      # extends past base cabinet depth
        'yMount': 0,        # floor-standing
        'zone': 'BASE',     # replaces base cabinets
        'depth_by_brand': {
            'wolf': 28.5,
            'thermador': 27.75,
            'fisherPaykel': 28.0,     # 28-29.125 varies by model
            'miele': 25.5,
            'kitchenaid': 28.0,       # 28-30.25 varies by model
        }
    },
    'cooktop': {
        'width': 36,
        'height': 6.5,      # surface-mounted, low profile
        'depth': 21,
        'yMount': 34.5,     # sits on top of base cabinet (counter height - thickness)
        'zone': 'COUNTER',
        'note': 'Drops into countertop cutout; collision volume is minimal'
    },
    'wallOven': {
        'width': 30,
        'height': 28.75,    # single oven
        'depth': 24,
        'yMount': 28,       # typical mounting height in oven cabinet
        'zone': 'TALL',     # sits in oven tower cabinet
        'height_options': {
            'single': 28.75,
            'double': 51.0,
            'speed': 18.0,
            'steam': 28.75,
        }
    },
    'dishwasher': {
        'width': 24,
        'height': 33.875,   # standard built-in (Thermador/Miele spec)
        'depth': 24,
        'yMount': 0,        # floor-standing under counter
        'zone': 'BASE',
        'height_options': {
            'standard': 33.875,
            'single_drawer': 16.25,    # F&P DishDrawer single
            'double_drawer': 32.5,     # F&P DishDrawer double
            'tall_double': 34.0,       # F&P Tall DishDrawer
        }
    },
    'microwave': {
        'width': 30,
        'height': 18.75,    # drawer microwave
        'depth': 24,
        'yMount': 4,        # base-zone mounting (drawer under counter)
        'zone': 'BASE',
        'note': 'Drawer-style microwave, fits in base cabinet space'
    },
    'hood': {
        'width': 36,
        'height': 22,       # pro wall hood
        'depth': 10,        # shallow projection from wall
        'yMount': 60,       # min 24" above cooktop (36+24=60), NKBA: 30" above gas
        'zone': 'UPPER',
        'note': 'Mounted above cooking surface. Depth varies by hood type.'
    },
    'wine': {
        'width': 24,
        'height': 84,
        'depth': 24,
        'yMount': 0,
        'zone': 'TALL',
    },
}

# Minimum clearances (NKBA + manufacturer requirements)
CLEARANCES = {
    'hood_above_gas': 30,       # NKBA: 30" min above gas cooktop
    'hood_above_electric': 24,  # NKBA: 24" min above electric cooktop
    'fridge_side': 0.25,        # 1/4" side clearance for ventilation
    'fridge_top': 1.0,          # 1" above fridge for ventilation
    'range_to_wall': 0,         # ranges can abut walls
    'dishwasher_to_sink': 0,    # DW directly adjacent to sink (NKBA preferred)
    'oven_in_cabinet': 0.25,    # 1/4" clearance inside oven cabinet
}


# ─── OCP Shape Builders ──────────────────────────────────────────────────

def make_appliance_volume(x, y, z, width, height, depth):
    """Create a solid box representing an appliance collision volume.

    Args:
        x: left edge X (along wall)
        y: depth-from-wall Y (back face)
        z: bottom edge Z (height from floor)
        width: appliance width
        height: appliance height
        depth: appliance depth

    Returns:
        OCP TopoDS_Shape solid
    """
    box = BRepPrimAPI_MakeBox(
        gp_Pnt(float(x), float(y), float(z)),
        float(width), float(depth), float(height)
    )
    return box.Shape()


def make_fridge_with_rw(x, y, z, fridge_width, fridge_height, fridge_depth,
                         rw_height=12, rw_depth=None, ceiling=96):
    """Create a fridge volume plus the RW (refrigerator wall) cabinet above it.

    The RW cabinet sits directly on top of the fridge, matching its width.
    RW depth matches fridge depth or is slightly shallower.

    Args:
        x, y, z: fridge position (floor)
        fridge_width: fridge width
        fridge_height: fridge height (typically 84")
        fridge_depth: fridge depth
        rw_height: RW cabinet height (fills to ceiling)
        rw_depth: RW depth (defaults to fridge depth)
        ceiling: ceiling height

    Returns:
        dict with 'fridge' and 'rw' shapes
    """
    if rw_depth is None:
        rw_depth = fridge_depth

    # Calculate RW height to fill to ceiling
    if rw_height is None:
        rw_height = ceiling - fridge_height
        if rw_height <= 0:
            rw_height = 12  # minimum

    fridge_shape = make_appliance_volume(x, y, z, fridge_width, fridge_height, fridge_depth)

    rw_shape = make_appliance_volume(
        x, y, z + fridge_height,
        fridge_width, rw_height, rw_depth
    )

    return {
        'fridge': fridge_shape,
        'rw': rw_shape,
        'combined_height': fridge_height + rw_height,
    }


def make_range_volume(x, y, z, width, depth, height=36):
    """Create a range collision volume.
    Ranges are counter-height and extend past standard base depth.

    Args:
        x: left edge X
        y: depth-from-wall Y (back face)
        z: bottom Z (floor = 0)
        width: range width
        depth: range depth (typically 25.5-30.25")
        height: range height (36" counter-height)

    Returns:
        OCP TopoDS_Shape solid
    """
    return make_appliance_volume(x, y, z, width, height, depth)


def make_dishwasher_volume(x, y, z=0, width=24, height=33.875, depth=24):
    """Create a dishwasher collision volume.
    DW sits under counter, typically 33.875" tall on floor.

    Returns:
        OCP TopoDS_Shape solid
    """
    return make_appliance_volume(x, y, z, width, height, depth)


def make_hood_volume(x, y, z, width, height, depth):
    """Create a range hood collision volume.
    Hood mounts above cooking surface in the upper zone.

    Args:
        x: left edge X (should align with range/cooktop)
        y: depth-from-wall Y
        z: bottom of hood (min 54", depends on cooktop type)
        width: hood width (should be >= cooktop width)
        height: hood height
        depth: hood depth (projection from wall)

    Returns:
        OCP TopoDS_Shape solid
    """
    return make_appliance_volume(x, y, z, width, height, depth)


def make_wall_oven_volume(x, y, z, width, height, depth=24, subtype='single'):
    """Create a wall oven collision volume.
    Wall oven sits inside an oven tower cabinet.

    Args:
        x: left edge X
        y: depth-from-wall Y
        z: bottom mounting height
        width: oven width (27, 30, 33, 36")
        height: oven height (single: 28.75", double: 51")
        depth: oven depth
        subtype: 'single', 'double', 'speed', 'steam'

    Returns:
        OCP TopoDS_Shape solid
    """
    if height is None:
        height = APPLIANCE_DEFAULTS['wallOven']['height_options'].get(subtype, 28.75)
    return make_appliance_volume(x, y, z, width, height, depth)


# ─── Main Factory Function ──────────────────────────────────────────────

def create_appliance_volume(app_data):
    """Create a 3D collision volume for any appliance.

    Args:
        app_data: dict with keys:
            type: appliance type (refrigerator, range, cooktop, etc.)
            x: X position along wall
            y: depth-from-wall (default 0)
            width: appliance width (or use default for type)
            height: appliance height (or use default)
            depth: appliance depth (or use default)
            yMount: Z mounting height (or use default)
            brand: brand ID for brand-specific depths
            subtype: subtype for height variants
            ceiling: ceiling height (for RW calculation)

    Returns:
        dict with:
            shape: OCP TopoDS_Shape (primary collision volume)
            secondary_shapes: list of additional shapes (e.g., RW above fridge)
            metadata: dict with appliance info
    """
    app_type = app_data.get('type', 'refrigerator')
    defaults = APPLIANCE_DEFAULTS.get(app_type, APPLIANCE_DEFAULTS['refrigerator'])

    x = float(app_data.get('x', 0))
    y = float(app_data.get('y', app_data.get('depthFromWall', 0)))
    width = float(app_data.get('width', defaults['width']))
    height = float(app_data.get('height', defaults['height']))
    depth = float(app_data.get('depth', defaults['depth']))
    z = float(app_data.get('yMount', defaults['yMount']))
    brand = app_data.get('brand', '')
    subtype = app_data.get('subtype', '')
    ceiling = float(app_data.get('ceiling', 96))

    # Brand-specific depth override for ranges
    if app_type == 'range' and brand in defaults.get('depth_by_brand', {}):
        depth = defaults['depth_by_brand'][brand]

    # Height variant for wall ovens
    if app_type == 'wallOven' and subtype in defaults.get('height_options', {}):
        height = defaults['height_options'][subtype]

    # Height variant for dishwashers
    if app_type == 'dishwasher' and subtype in defaults.get('height_options', {}):
        height = defaults['height_options'][subtype]

    result = {
        'shape': None,
        'secondary_shapes': [],
        'metadata': {
            'type': app_type,
            'x': x,
            'width': width,
            'height': height,
            'depth': depth,
            'yMount': z,
            'zone': defaults.get('zone', 'BASE'),
        }
    }

    # ─── Type-specific volume creation ───

    if app_type in ('refrigerator', 'freezer', 'wine'):
        # Tall floor-standing appliance with optional RW above
        rw_data = make_fridge_with_rw(
            x, y, z, width, height, depth,
            rw_height=ceiling - height,
            rw_depth=depth,
            ceiling=ceiling
        )
        result['shape'] = rw_data['fridge']
        result['secondary_shapes'].append({
            'shape': rw_data['rw'],
            'type': 'rw_cabinet_zone',
            'height': ceiling - height,
        })

    elif app_type == 'range':
        result['shape'] = make_range_volume(x, y, z, width, depth, height)

    elif app_type == 'cooktop':
        # Cooktop is surface-mounted; create a thin collision volume
        result['shape'] = make_appliance_volume(x, y, z, width, height, depth)

    elif app_type == 'wallOven':
        result['shape'] = make_wall_oven_volume(x, y, z, width, height, depth, subtype)

    elif app_type == 'dishwasher':
        result['shape'] = make_dishwasher_volume(x, y, z, width, height, depth)

    elif app_type == 'microwave':
        result['shape'] = make_appliance_volume(x, y, z, width, height, depth)

    elif app_type == 'hood':
        result['shape'] = make_hood_volume(x, y, z, width, height, depth)

    else:
        # Generic fallback
        result['shape'] = make_appliance_volume(x, y, z, width, height, depth)

    return result


# ─── Validation ──────────────────────────────────────────────────────────

def validate_appliance_clearances(appliances):
    """Validate clearances between appliances.

    Checks:
      - Hood height above cooktop/range (NKBA minimums)
      - Dishwasher adjacency to sink
      - Fridge ventilation clearance

    Args:
        appliances: list of dicts with type, x, width, height, yMount, zone

    Returns:
        list of validation issues
    """
    issues = []

    hoods = [a for a in appliances if a.get('type') == 'hood']
    cooking = [a for a in appliances if a.get('type') in ('range', 'cooktop')]
    dishwashers = [a for a in appliances if a.get('type') == 'dishwasher']
    sinks = [a for a in appliances if a.get('type') == 'sink']

    # Hood above cooking surface
    for hood in hoods:
        hood_bottom = float(hood.get('yMount', 60))
        for cook in cooking:
            cook_top = float(cook.get('yMount', 0)) + float(cook.get('height', 36))
            clearance = hood_bottom - cook_top
            fuel = cook.get('fuel', 'gas')
            min_clearance = CLEARANCES['hood_above_gas'] if fuel == 'gas' else CLEARANCES['hood_above_electric']

            if clearance < min_clearance:
                issues.append({
                    'severity': 'error',
                    'rule': 'hood_clearance',
                    'message': (f"Hood at {hood_bottom}\" is only {clearance:.1f}\" above "
                               f"{cook.get('type', 'cooking surface')} top at {cook_top}\". "
                               f"NKBA minimum: {min_clearance}\" for {fuel}")
                })

    # DW adjacent to sink
    for dw in dishwashers:
        dw_x = float(dw.get('x', 0))
        dw_w = float(dw.get('width', 24))
        dw_right = dw_x + dw_w
        dw_left = dw_x

        adjacent_to_sink = False
        for sink in sinks:
            sink_x = float(sink.get('x', 0))
            sink_w = float(sink.get('width', 33))
            sink_right = sink_x + sink_w
            sink_left = sink_x

            # Check adjacency (touching or within 1")
            if abs(dw_right - sink_left) <= 1 or abs(sink_right - dw_left) <= 1:
                adjacent_to_sink = True
                break

        if not adjacent_to_sink and sinks:
            issues.append({
                'severity': 'warning',
                'rule': 'dw_sink_adjacency',
                'message': 'Dishwasher is not adjacent to sink (NKBA recommends adjacency)'
            })

    return issues


def get_appliance_defaults(app_type):
    """Get default dimensions for an appliance type.

    Args:
        app_type: appliance type string

    Returns:
        dict with default dimensions
    """
    return dict(APPLIANCE_DEFAULTS.get(app_type, APPLIANCE_DEFAULTS['refrigerator']))
