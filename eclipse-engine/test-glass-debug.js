import { solve } from './src/index.js';

const result = solve({
  layoutType: 'single-wall',
  roomType: 'kitchen',
  walls: [
    { id: 'A', length: 180, role: 'general', ceilingHeight: 120 },
  ],
  appliances: [],
  prefs: { sophistication: 'very_high', upperApproach: 'standard', glassStyle: 'leaded' },
});

console.log('Wall 0 uppers:', result.uppers[0].cabinets.map(c => ({
  type: c.type,
  mods: c.modifications ? c.modifications.map(m => m.mod).join(',') : 'none'
})));
