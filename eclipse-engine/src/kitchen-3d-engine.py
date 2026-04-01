#!/usr/bin/env python3
"""
Eclipse Kitchen 3D Engine — OCP (OpenCascade) solid geometry backend
====================================================================
Called from Node.js via child_process.execSync. Receives cabinet placement
data as JSON on stdin, returns validated 3D model data as JSON on stdout.

Capabilities:
  - True parametric 3D solid modeling (every cabinet = real box geometry)
  - Boolean intersection collision detection
  - Vertical stacking validation against NKBA rules
  - Ceiling clearance verification
  - Depth conflict detection (layered zones)
  - Elevation slice extraction for accurate 2D rendering
"""

import json
import sys

from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox
from OCP.BRepAlgoAPI import BRepAlgoAPI_Common
from OCP.gp import gp_Pnt
from OCP.GProp import GProp_GProps
from OCP.BRepGProp import BRepGProp
from OCP.Bnd import Bnd_Box
from OCP.BRepBndLib import BRepBndLib

# Import the SKU-aware shape factory for parametric geometry
try:
    import os as _os
    sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
    from eclipse_shape_factory import (
        create_cabinet_shape, classify_sku, get_sku_defaults,
        validate_sku_dimensions, parse_sku_width
    )
    HAS_SHAPE_FACTORY = True
except ImportError:
    HAS_SHAPE_FACTORY = False

# Import interior detail geometry
try:
    from eclipse_interior_details import generate_interior_details, get_detail_summary
    HAS_INTERIOR_DETAILS = True
except ImportError:
    HAS_INTERIOR_DETAILS = False

# Import countertop & backsplash geometry
try:
    from eclipse_countertop_geometry import (
        build_wall_countertop, make_island_countertop, make_waterfall_edge,
        COUNTER_HEIGHT, COUNTER_THICKNESS, COUNTER_DEPTH
    )
    HAS_COUNTERTOP = True
except ImportError:
    HAS_COUNTERTOP = False

# Import appliance collision volumes
try:
    from eclipse_appliance_volumes import (
        create_appliance_volume, validate_appliance_clearances, get_appliance_defaults
    )
    HAS_APPLIANCE_VOLUMES = True
except ImportError:
    HAS_APPLIANCE_VOLUMES = False

# Import room geometry
try:
    from eclipse_room_geometry import (
        build_room_shell, validate_cabinets_vs_openings, get_available_wall_space
    )
    HAS_ROOM_GEOMETRY = True
except ImportError:
    HAS_ROOM_GEOMETRY = False

# ─── Eclipse Vertical Zones (inches from floor) ───────────────────────────────
VERTICAL_ZONES = {
    'TOE_KICK':    {'yMin': 0,    'yMax': 4},
    'BASE':        {'yMin': 4,    'yMax': 34.5},
    'COUNTER':     {'yMin': 34.5, 'yMax': 36},
    'BACKSPLASH':  {'yMin': 36,   'yMax': 54},
    'UPPER':       {'yMin': 54,   'yMax': 84},
    'CROWN':       {'yMin': 84,   'yMax': 96},
    'ABOVE_TALL':  {'yMin': 84,   'yMax': 96},
}

# Depth tiers (inches from wall surface)
DEPTH_TIERS = {
    'UPPER': 13.875,       # 13" body + 7/8" door
    'BASE': 24.875,        # 24" body + 7/8" door
    'FRIDGE': 27.875,      # 27" body + 7/8" door
    'COUNTER': 26.375,     # 24.875" base + 1.5" overhang
    'TALL': 24.875,        # 24" body + 7/8" door
}

# Stacking rules
STACKING_RULES = {
    'BASE_TO_UPPER': {'minGap': 18, 'maxGap': 24},     # counter-top to upper bottom
    'FRIDGE_TO_RW':  {'minGap': 0,  'maxGap': 3},      # fridge top to RW bottom
    'UPPER_TO_CROWN': {'minGap': 0, 'maxGap': 3},      # upper top to crown
}


# ─── OCP Helpers ──────────────────────────────────────────────────────────────

def make_box(x, y, z, w, h, d):
    """Create an OCP solid box. OCP axes: X=along wall, Y=depth from wall, Z=height."""
    box = BRepPrimAPI_MakeBox(gp_Pnt(float(x), float(y), float(z)), float(w), float(d), float(h))
    return box.Shape()

def get_volume(shape):
    """Get volume of a solid shape."""
    props = GProp_GProps()
    BRepGProp.VolumeProperties_s(shape, props)
    return props.Mass()

def get_bbox(shape):
    """Get axis-aligned bounding box."""
    bbox = Bnd_Box()
    BRepBndLib.Add_s(shape, bbox)
    xmin, ymin, zmin, xmax, ymax, zmax = bbox.Get()
    return {
        'xMin': round(xmin, 3), 'yMin': round(ymin, 3), 'zMin': round(zmin, 3),
        'xMax': round(xmax, 3), 'yMax': round(ymax, 3), 'zMax': round(zmax, 3),
    }

def check_collision(shape_a, shape_b):
    """Boolean intersection test — returns overlap volume."""
    common = BRepAlgoAPI_Common(shape_a, shape_b)
    if common.IsDone():
        vol = get_volume(common.Shape())
        return vol if vol > 0.001 else 0
    return 0


# ─── Core 3D Model ───────────────────────────────────────────────────────────

class Kitchen3DModel:
    """Full 3D parametric kitchen model using OCP solid geometry."""

    def __init__(self, ceiling_height=96):
        self.ceiling_height = ceiling_height
        self.solids = []
        self.collisions = []
        self.stacking_issues = []
        self.depth_conflicts = []

    def add_cabinet(self, cab_data):
        """Add a cabinet from solver placement data.

        Expected fields: sku, wall, x, width, height, depth,
                         yMount (vertical position from floor),
                         zone, depthFromWall (optional, default 0)
        """
        sku = cab_data.get('sku', 'UNKNOWN')
        wall = cab_data.get('wall', 'A')
        raw_x = cab_data.get('x', 0)
        try:
            x = float(raw_x)
        except (ValueError, TypeError):
            x = 0.0  # handle string positions like 'left', 'right', 'end'
        w = float(cab_data.get('width', 36))
        h = float(cab_data.get('height', 30))
        d = float(cab_data.get('depth', 24.875))
        y_mount = float(cab_data.get('yMount', 4))
        depth_from_wall = float(cab_data.get('depthFromWall', 0))
        zone = cab_data.get('zone', 'BASE')
        name = cab_data.get('name', sku)

        # Use SKU-aware shape factory for accurate geometry
        if HAS_SHAPE_FACTORY:
            shape = create_cabinet_shape({
                'sku': sku, 'x': x, 'depthFromWall': depth_from_wall,
                'yMount': y_mount, 'width': w, 'height': h, 'depth': d,
                'zone': zone,
            })
        else:
            shape = make_box(x, depth_from_wall, y_mount, w, h, d)
        bbox = get_bbox(shape)

        entry = {
            'name': name,
            'sku': sku,
            'shape': shape,
            'bbox': bbox,
            'wall': wall,
            'zone': zone,
            'x': x,
            'width': w,
            'height': h,
            'depth': d,
            'yMount': y_mount,
            'yTop': y_mount + h,
            'depthFromWall': depth_from_wall,
        }
        self.solids.append(entry)
        return entry

    @staticmethod
    def _is_accessory_panel(cab):
        """End panels (REP, FWEP, FBEP, etc.) are thin decorative pieces
        that intentionally overlap cabinet faces — exempt from collision checks."""
        sku = cab.get('sku', '').upper()
        if cab.get('width', 99) <= 3:
            return True
        # Check via shape factory if available
        if HAS_SHAPE_FACTORY:
            info = classify_sku(sku)
            return info['shapeType'] in ('panel', 'filler')
        return any(sku.startswith(p) for p in ('REP', 'FWEP', 'FBEP', 'FEP', 'SEP', 'EP',
                                                'WEP', 'BEP', 'VEP', 'VTEP', 'FREP', 'FVEP', 'FVTEP'))

    def detect_collisions(self):
        """Check every pair of same-wall cabinets for 3D overlap.
        Skips thin accessory panels (end panels, fillers) which intentionally
        overlap adjacent cabinets."""
        self.collisions = []
        walls = {}
        for s in self.solids:
            walls.setdefault(s['wall'], []).append(s)

        for wall_id, cabs in walls.items():
            for i in range(len(cabs)):
                for j in range(i + 1, len(cabs)):
                    a, b = cabs[i], cabs[j]
                    # Skip collisions involving decorative end panels
                    if self._is_accessory_panel(a) or self._is_accessory_panel(b):
                        continue
                    overlap_vol = check_collision(a['shape'], b['shape'])
                    if overlap_vol > 0:
                        self.collisions.append({
                            'severity': 'error',
                            'rule': '3d_collision',
                            'cabinet_a': a['name'],
                            'sku_a': a['sku'],
                            'cabinet_b': b['name'],
                            'sku_b': b['sku'],
                            'wall': wall_id,
                            'overlap_volume': round(overlap_vol, 1),
                            'message': f"3D collision: {a['sku']} overlaps {b['sku']} on wall {wall_id} ({round(overlap_vol, 1)} in³)"
                        })
        return self.collisions

    def validate_stacking(self):
        """Validate vertical stacking using true 3D positions."""
        self.stacking_issues = []
        walls = {}
        for s in self.solids:
            walls.setdefault(s['wall'], []).append(s)

        for wall_id, cabs in walls.items():
            bases = [c for c in cabs if c['zone'] in ('BASE', 'SINK_BASE')]
            uppers = [c for c in cabs if c['zone'] in ('UPPER',)]
            talls = [c for c in cabs if c['zone'] in ('TALL',)]
            above_talls = [c for c in cabs if c['zone'] in ('ABOVE_TALL',)]

            # Base → Upper gap check (counter top at 36" to upper bottom)
            counter_top = 36.0
            for upper in uppers:
                gap = upper['yMount'] - counter_top
                if gap < STACKING_RULES['BASE_TO_UPPER']['minGap']:
                    self.stacking_issues.append({
                        'severity': 'error',
                        'rule': 'stacking_gap_small',
                        'cabinet': upper['name'],
                        'sku': upper['sku'],
                        'wall': wall_id,
                        'gap': gap,
                        'message': f"Gap {gap}\" from counter to {upper['sku']} is < 18\" NKBA minimum (wall {wall_id})"
                    })
                elif gap > STACKING_RULES['BASE_TO_UPPER']['maxGap']:
                    self.stacking_issues.append({
                        'severity': 'warning',
                        'rule': 'stacking_gap_large',
                        'cabinet': upper['name'],
                        'sku': upper['sku'],
                        'wall': wall_id,
                        'gap': gap,
                        'message': f"Gap {gap}\" from counter to {upper['sku']} exceeds 24\" recommended max (wall {wall_id})"
                    })

            # Tall → Above-tall gap check
            for at in above_talls:
                for tall in talls:
                    # Check X overlap
                    if tall['x'] < at['x'] + at['width'] and at['x'] < tall['x'] + tall['width']:
                        gap = at['yMount'] - tall['yTop']
                        if gap < STACKING_RULES['FRIDGE_TO_RW']['minGap']:
                            self.stacking_issues.append({
                                'severity': 'error',
                                'rule': 'stacking_overlap_tall',
                                'cabinet': at['name'],
                                'sku': at['sku'],
                                'wall': wall_id,
                                'gap': gap,
                                'message': f"{at['sku']} overlaps tall cabinet below by {abs(gap)}\" (wall {wall_id})"
                            })
                        elif gap > STACKING_RULES['FRIDGE_TO_RW']['maxGap']:
                            self.stacking_issues.append({
                                'severity': 'warning',
                                'rule': 'stacking_gap_above_tall',
                                'cabinet': at['name'],
                                'sku': at['sku'],
                                'wall': wall_id,
                                'gap': gap,
                                'message': f"{gap}\" gap between tall and {at['sku']} (wall {wall_id})"
                            })

            # Ceiling violation check
            for cab in cabs:
                if cab['yTop'] > self.ceiling_height + 0.01:
                    self.stacking_issues.append({
                        'severity': 'error',
                        'rule': 'exceeds_ceiling',
                        'cabinet': cab['name'],
                        'sku': cab['sku'],
                        'wall': wall_id,
                        'yTop': cab['yTop'],
                        'ceiling': self.ceiling_height,
                        'message': f"{cab['sku']} top at {cab['yTop']}\" exceeds {self.ceiling_height}\" ceiling (wall {wall_id})"
                    })

        return self.stacking_issues

    def detect_depth_conflicts(self):
        """Find cabinets whose depth zones clash (e.g. upper deeper than expected)."""
        self.depth_conflicts = []
        expected_depths = {
            'BASE': 24.875, 'SINK_BASE': 24.875, 'UPPER': 13.875,
            'TALL': 27.875, 'ABOVE_TALL': 27.875,  # TALL includes fridges at 27"+door
        }
        for cab in self.solids:
            expected = expected_depths.get(cab['zone'])
            if expected and cab['depth'] > expected + 2:
                self.depth_conflicts.append({
                    'severity': 'warning',
                    'rule': 'depth_oversize',
                    'cabinet': cab['name'],
                    'sku': cab['sku'],
                    'wall': cab['wall'],
                    'depth': cab['depth'],
                    'expected': expected,
                    'message': f"{cab['sku']} depth {cab['depth']}\" exceeds expected {expected}\" for {cab['zone']} zone"
                })
        return self.depth_conflicts

    def get_elevation(self, wall_id):
        """Extract 2D elevation data for a wall (sorted by vertical then horizontal position)."""
        cabs = sorted(
            [s for s in self.solids if s['wall'] == wall_id],
            key=lambda c: (c['yMount'], c['x'])
        )
        return [{
            'sku': c['sku'],
            'x': c['x'],
            'yMount': c['yMount'],
            'yTop': c['yTop'],
            'width': c['width'],
            'height': c['height'],
            'depth': c['depth'],
            'zone': c['zone'],
            'depthFromWall': c['depthFromWall'],
        } for c in cabs]

    def get_all_elevations(self):
        """Get elevation data for every wall."""
        wall_ids = sorted(set(s['wall'] for s in self.solids))
        return {wid: self.get_elevation(wid) for wid in wall_ids}

    def full_validation(self):
        """Run all 3D checks and return combined results."""
        results = {
            'collisions': self.detect_collisions(),
            'stacking': self.validate_stacking(),
            'depth': self.detect_depth_conflicts(),
            'catalog': self._validate_against_catalog(),
            'room': self.validate_vs_room(),
        }
        results['all_issues'] = (results['collisions'] + results['stacking'] +
                                  results['depth'] + results['catalog'] +
                                  results['room'])
        results['error_count'] = sum(1 for i in results['all_issues'] if i.get('severity') == 'error')
        results['warning_count'] = sum(1 for i in results['all_issues'] if i.get('severity') == 'warning')
        return results

    # ─── Interior Details ────────────────────────────────────────────────────

    def generate_all_interior_details(self):
        """Generate interior details (shelves, drawers, doors, hinges) for all cabinets."""
        if not HAS_INTERIOR_DETAILS:
            return {}

        details = {}
        for s in self.solids:
            cab_data = {
                'sku': s['sku'], 'x': s['x'],
                'depthFromWall': s['depthFromWall'],
                'yMount': s['yMount'],
                'width': s['width'], 'height': s['height'],
                'depth': s['depth'], 'zone': s['zone'],
            }
            detail = generate_interior_details(cab_data)
            key = f"{s['wall']}:{s['sku']}:{s['x']}"
            details[key] = get_detail_summary(detail)
            details[key]['shapes'] = detail  # keep full shapes for 3D export
        return details

    # ─── Countertop & Backsplash ─────────────────────────────────────────────

    def generate_countertops(self, appliances=None):
        """Generate countertop slabs and backsplashes for all walls."""
        if not HAS_COUNTERTOP:
            return {}

        walls = {}
        for s in self.solids:
            walls.setdefault(s['wall'], []).append(s)

        countertops = {}
        for wall_id, cabs in walls.items():
            wall_cabs = [{
                'sku': c['sku'], 'x': c['x'], 'width': c['width'],
                'depth': c['depth'], 'zone': c['zone'], 'yMount': c['yMount'],
            } for c in cabs]

            wall_apps = []
            if appliances:
                wall_apps = [a for a in appliances if a.get('wall') == wall_id]

            ct = build_wall_countertop(wall_cabs, y_wall=0, appliances=wall_apps)
            countertops[wall_id] = {
                'slab_count': len(ct['slabs']),
                'backsplash_count': len(ct['backsplashes']),
                'cutout_count': ct['metadata']['cutout_count'],
                'total_length': ct['metadata']['total_length'],
                'total_sqft': ct['metadata']['total_sqft'],
                'shapes': ct,  # keep for 3D export
            }
        return countertops

    # ─── Appliance Volumes ───────────────────────────────────────────────────

    def add_appliance(self, app_data):
        """Add an appliance and create its collision volume.

        Args:
            app_data: dict with type, x, width, height, depth, wall, etc.

        Returns:
            dict with appliance info and shape
        """
        if not HAS_APPLIANCE_VOLUMES:
            # Fallback: add as a basic box
            x = float(app_data.get('x', 0))
            y = float(app_data.get('depthFromWall', 0))
            w = float(app_data.get('width', 36))
            h = float(app_data.get('height', 84))
            d = float(app_data.get('depth', 24.875))
            z = float(app_data.get('yMount', 0))
            shape = make_box(x, y, z, w, h, d)
            entry = {
                'name': app_data.get('type', 'appliance'),
                'sku': app_data.get('id', 'APPLIANCE'),
                'shape': shape,
                'bbox': get_bbox(shape),
                'wall': app_data.get('wall', 'A'),
                'zone': 'TALL',
                'x': x, 'width': w, 'height': h, 'depth': d,
                'yMount': z, 'yTop': z + h,
                'depthFromWall': y,
                'isAppliance': True,
            }
            self.solids.append(entry)
            return entry

        vol = create_appliance_volume(app_data)
        shape = vol['shape']
        meta = vol['metadata']

        entry = {
            'name': app_data.get('type', 'appliance'),
            'sku': app_data.get('id', app_data.get('model', 'APPLIANCE')),
            'shape': shape,
            'bbox': get_bbox(shape),
            'wall': app_data.get('wall', 'A'),
            'zone': meta['zone'],
            'x': meta['x'],
            'width': meta['width'],
            'height': meta['height'],
            'depth': meta['depth'],
            'yMount': meta['yMount'],
            'yTop': meta['yMount'] + meta['height'],
            'depthFromWall': float(app_data.get('depthFromWall', 0)),
            'isAppliance': True,
        }
        self.solids.append(entry)

        # Add secondary shapes (e.g., RW zone above fridge)
        for sec in vol.get('secondary_shapes', []):
            if sec.get('shape'):
                sec_bbox = get_bbox(sec['shape'])
                self.solids.append({
                    'name': f"{entry['name']}_rw_zone",
                    'sku': f"{entry['sku']}_RW_ZONE",
                    'shape': sec['shape'],
                    'bbox': sec_bbox,
                    'wall': entry['wall'],
                    'zone': 'ABOVE_TALL',
                    'x': entry['x'],
                    'width': entry['width'],
                    'height': sec.get('height', 12),
                    'depth': entry['depth'],
                    'yMount': entry['yTop'],
                    'yTop': entry['yTop'] + sec.get('height', 12),
                    'depthFromWall': entry['depthFromWall'],
                    'isAppliance': False,  # RW zone is cabinet space
                })

        return entry

    # ─── Room Geometry ───────────────────────────────────────────────────────

    def set_room(self, room_def):
        """Set the room shell geometry (walls, windows, doors).

        Args:
            room_def: dict with walls, ceiling, floor definitions
                      (see eclipse_room_geometry.build_room_shell)
        """
        if not HAS_ROOM_GEOMETRY:
            self.room = None
            return

        self.room = build_room_shell(room_def)
        if room_def.get('ceiling'):
            self.ceiling_height = float(room_def['ceiling'])

    def validate_vs_room(self):
        """Validate all cabinets against room openings (windows, doors)."""
        if not HAS_ROOM_GEOMETRY or not hasattr(self, 'room') or self.room is None:
            return []

        cabs = [{
            'sku': s['sku'], 'x': s['x'], 'width': s['width'],
            'yMount': s['yMount'], 'height': s['height'],
            'wall': s['wall'],
        } for s in self.solids]

        return validate_cabinets_vs_openings(cabs, self.room)

    def get_available_space(self, wall_id):
        """Get available wall space after subtracting openings."""
        if not HAS_ROOM_GEOMETRY or not hasattr(self, 'room') or self.room is None:
            return None
        return get_available_wall_space(wall_id, self.room)

    # ─── Catalog Validation ──────────────────────────────────────────────────

    def _validate_against_catalog(self):
        """Validate cabinet dimensions against Eclipse catalog specs."""
        issues = []
        if not HAS_SHAPE_FACTORY:
            return issues

        for cab in self.solids:
            sku_issues = validate_sku_dimensions(
                cab['sku'],
                width=cab.get('width'),
                height=cab.get('height'),
                depth=cab.get('depth')
            )
            for issue in sku_issues:
                issue['cabinet'] = cab['name']
                issue['sku'] = cab['sku']
                issue['wall'] = cab['wall']
            issues.extend(sku_issues)

        return issues

    def to_json(self):
        """Export full model as JSON-serializable dict."""
        validation = self.full_validation()
        elevations = self.get_all_elevations()

        # Per-cabinet _elev data the JS renderer needs
        elev_data = {}
        for s in self.solids:
            key = f"{s['wall']}:{s['sku']}:{s['x']}"
            elev_data[key] = {
                'zone': s['zone'],
                'yMount': s['yMount'],
                'yTop': s['yTop'],
                'height': s['height'],
                'depth': s['depth'],
                'depthFromWall': s['depthFromWall'],
                'width': s['width'],
            }

        # Interior details (shelves, drawers, doors, hinges)
        interior = {}
        if HAS_INTERIOR_DETAILS:
            raw_details = self.generate_all_interior_details()
            for key, det in raw_details.items():
                interior[key] = {k: v for k, v in det.items() if k != 'shapes'}

        # Countertop info
        countertop_info = {}
        if HAS_COUNTERTOP:
            raw_ct = self.generate_countertops()
            for wall_id, ct in raw_ct.items():
                countertop_info[wall_id] = {k: v for k, v in ct.items() if k != 'shapes'}

        # Room info
        room_info = None
        if hasattr(self, 'room') and self.room is not None:
            room_info = {
                'ceiling_height': self.room['metadata']['ceiling_height'],
                'wall_count': self.room['metadata']['wall_count'],
                'window_count': self.room['metadata']['window_count'],
                'door_count': self.room['metadata']['door_count'],
                'windows': self.room.get('windows', []),
                'doors': self.room.get('doors', []),
                'bounding_box': self.room.get('bounding_box'),
            }

        return {
            'success': True,
            'totalSolids': len(self.solids),
            'ceilingHeight': self.ceiling_height,
            'walls': sorted(set(s['wall'] for s in self.solids)),
            'validation': validation,
            'elevations': elevations,
            'elevData': elev_data,
            'interiorDetails': interior,
            'countertops': countertop_info,
            'room': room_info,
            'features': {
                'shapeFactory': HAS_SHAPE_FACTORY,
                'interiorDetails': HAS_INTERIOR_DETAILS,
                'countertops': HAS_COUNTERTOP,
                'applianceVolumes': HAS_APPLIANCE_VOLUMES,
                'roomGeometry': HAS_ROOM_GEOMETRY,
            },
            'cabinets': [{
                'name': s['name'],
                'sku': s['sku'],
                'wall': s['wall'],
                'zone': s['zone'],
                'x': s['x'],
                'yMount': s['yMount'],
                'yTop': s['yTop'],
                'width': s['width'],
                'height': s['height'],
                'depth': s['depth'],
                'bbox': s['bbox'],
                'volume': round(get_volume(s['shape']), 1),
                'isAppliance': s.get('isAppliance', False),
            } for s in self.solids],
        }


# ─── Main Entry Point (stdin JSON → stdout JSON) ─────────────────────────────

def main():
    try:
        input_data = json.loads(sys.stdin.read())
    except json.JSONDecodeError as e:
        print(json.dumps({'success': False, 'error': f'Invalid JSON input: {e}'}))
        sys.exit(1)

    ceiling = input_data.get('ceilingHeight', 96)
    cabinets = input_data.get('cabinets', [])
    appliances = input_data.get('appliances', [])
    room_def = input_data.get('room', None)

    model = Kitchen3DModel(ceiling_height=ceiling)

    # Set room shell if provided
    if room_def:
        model.set_room(room_def)

    # Add cabinets
    for cab in cabinets:
        model.add_cabinet(cab)

    # Add appliances
    for app in appliances:
        model.add_appliance(app)

    result = model.to_json()
    print(json.dumps(result))


if __name__ == '__main__':
    main()
