import { solve, selectGlassStyle } from './src/index.js';

const prefs = { sophistication: 'very_high', upperApproach: 'standard', glassStyle: 'leaded' };

console.log('Input prefs:', prefs);
console.log('selectGlassStyle(prefs):', selectGlassStyle(prefs));

const result = solve({
  layoutType: 'single-wall',
  roomType: 'kitchen',
  walls: [
    { id: 'A', length: 180, role: 'general', ceilingHeight: 120 },
  ],
  appliances: [],
  prefs: prefs,
});

const firstSW = result.uppers[0].cabinets.find(c => c.type === 'wall_glass_display');
console.log('\nFirst SW cab mods:', firstSW.modifications.map(m => m.mod).join(','));
