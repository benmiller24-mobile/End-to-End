import { solve } from './src/index.js';

// Add a simple test to trace the issue
const result = solve({
  layoutType: 'single-wall',
  roomType: 'kitchen',
  walls: [
    { id: 'A', length: 180, role: 'general', ceilingHeight: 120 },
  ],
  appliances: [],
  prefs: { sophistication: 'very_high', upperApproach: 'standard', glassStyle: 'leaded' },
});

const firstSW = result.uppers[0].cabinets.find(c => c.type === 'wall_glass_display');
console.log('First SW modifications:', JSON.stringify(firstSW.modifications, null, 2));
