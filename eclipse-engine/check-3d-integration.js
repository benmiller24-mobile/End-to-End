import { configureProject } from './src/configurator.js';

const quote = configureProject({
  room: {
    layoutType: 'l-shape',
    roomType: 'kitchen',
    walls: [
      { id: 'A', length: 156, role: 'range', ceilingHeight: 96 },
      { id: 'B', length: 120, role: 'sink', ceilingHeight: 96 },
    ],
    appliances: [
      { type: 'range', width: 30, wall: 'A' },
      { type: 'sink', width: 36, wall: 'B' },
      { type: 'dishwasher', width: 24, wall: 'B' },
      { type: 'refrigerator', width: 36, wall: 'A', position: 'end' },
      { type: 'hood', width: 30, wall: 'A' },
    ],
    prefs: { cornerTreatment: 'auto', preferDrawerBases: true, sophistication: 'high' },
  },
  materials: { species: 'Walnut', construction: 'Plywood', doorStyle: 'Napa VG FP', drawerType: '5/8" Hdwd Dovetail', drawerGuide: 'Blum FEG Guide' },
  options: { projectName: 'Test', clientName: 'Test', touchUpKit: 'TUK-STAIN', includeEstimate: true },
});

const layout = quote._raw.solverOutput;

// Check for 3D model
if (layout._3dModel) {
  console.log('✓ 3D Model present in solver output');
  console.log(`  Success: ${layout._3dModel.success}`);
  console.log(`  Solids: ${layout._3dModel.totalSolids}`);
  console.log(`  Walls: ${layout._3dModel.walls?.join(', ')}`);
  console.log(`  Errors: ${layout._3dModel.validation?.error_count}`);
  console.log(`  Warnings: ${layout._3dModel.validation?.warning_count}`);
  
  // Show elevation data
  for (const [wallId, cabs] of Object.entries(layout._3dModel.elevations || {})) {
    console.log(`\n  Wall ${wallId} elevation (${cabs.length} cabinets):`);
    for (const c of cabs) {
      console.log(`    ${c.sku.padEnd(14)} x=${String(c.x).padStart(6)} y=${String(c.yMount).padStart(5)}→${String(c.yTop).padStart(5)} ${c.width}w×${c.height}h×${c.depth}d [${c.zone}]`);
    }
  }
  
  // Show any validation issues from the 3D engine
  const issues3d = (layout.validation || []).filter(v => v.rule?.startsWith('3d_'));
  if (issues3d.length > 0) {
    console.log(`\n  3D validation issues in solver output:`);
    for (const i of issues3d) {
      console.log(`    ${i.severity}: ${i.message}`);
    }
  } else {
    console.log('\n  ✓ No 3D validation issues');
  }
} else {
  console.log('✗ No 3D model in solver output');
  // Check for 3d_engine_unavailable message
  const unavail = (layout.validation || []).find(v => v.rule === '3d_engine_unavailable');
  if (unavail) console.log(`  Reason: ${unavail.message}`);
}

// Verify _elev data on source objects
let elevCount = 0;
for (const wall of (layout.walls || [])) {
  for (const cab of (wall.cabinets || [])) {
    if (cab._elev) elevCount++;
  }
}
for (const upper of (layout.uppers || [])) {
  for (const cab of (upper.cabinets || [])) {
    if (cab._elev) elevCount++;
  }
}
for (const tall of (layout.talls || [])) {
  if (tall._elev) elevCount++;
}
console.log(`\n✓ ${elevCount} source objects have _elev data for renderer`);
