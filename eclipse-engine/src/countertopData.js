// ─── Eclipse Kitchen Designer — Countertop Material Database ───
// Real manufacturer colors, collections, and 2025-2026 pricing tiers
// Sources: Neolith, Dekton/Cosentino, Caesarstone, Cambria, regional quartzite suppliers

export const COUNTERTOP_BRANDS = {
  neolith:    'Neolith',
  dekton:     'Dekton by Cosentino',
  caesarstone:'Caesarstone',
  cambria:    'Cambria',
  quartzite:  'Natural Quartzite'
};

// ─── Pricing tiers (installed $/sqft, 2025-2026) ───
export const COUNTERTOP_PRICING = {
  neolith:     { low: 95, high: 155, material: 'Sintered Stone' },
  dekton:      { low: 80, high: 210, material: 'Ultra-Compact Surface' },
  caesarstone: { low: 50, high: 125, material: 'Engineered Quartz' },
  cambria:     { low: 60, high: 125, material: 'Natural Quartz' },
  quartzite:   { low: 90, high: 220, material: 'Natural Quartzite' }
};

// Add-on costs ($/sqft unless noted)
export const COUNTERTOP_ADDONS = {
  edgeProfiles:  { low: 5,   high: 15,  unit: 'sqft', note: 'Bullnose, waterfall, mitered, etc.' },
  backsplash:    { low: 10,  high: 50,  unit: 'sqft', note: 'Optional backsplash in same material' },
  cutouts:       { low: 200, high: 500, unit: 'each', note: 'Per opening (sink, cooktop)' },
  seaming:       { pctAdder: 15, note: '+10-20% for complex seaming patterns' }
};

// ─── Edge profile options ───
export const EDGE_PROFILES = [
  { id: 'straight',  label: 'Straight / Eased' },
  { id: 'bevel',     label: 'Beveled' },
  { id: 'bullnose',  label: 'Bullnose' },
  { id: 'ogee',      label: 'Ogee' },
  { id: 'waterfall', label: 'Waterfall' },
  { id: 'mitered',   label: 'Mitered' },
  { id: 'dupont',    label: 'DuPont' }
];

// ─── Color catalog ───
// Each entry: { id, brand, collection, name, code?, hex, finishes[], popularity(1-5), priceTier }
// priceTier: 'standard' | 'mid' | 'premium' | 'luxury'
export const COUNTERTOP_COLORS = [
  // ────────── NEOLITH ──────────
  { id: 'neo-estatuario',     brand: 'neolith', collection: 'Classtone',  name: 'Estatuario',       hex: '#F5F5F5', finishes: ['Ultrasoft','Décor Polished','Silk'], popularity: 5, priceTier: 'premium' },
  { id: 'neo-calacatta',      brand: 'neolith', collection: 'Marble Style', name: 'Calacatta',      hex: '#F8F8F8', finishes: ['Polished','Honed'], popularity: 4, priceTier: 'premium' },
  { id: 'neo-calacatta-gold', brand: 'neolith', collection: 'Marble Style', name: 'Calacatta Gold', hex: '#FAF3E0', finishes: ['Polished','Honed'], popularity: 3, priceTier: 'premium' },
  { id: 'neo-calacatta-luxe', brand: 'neolith', collection: 'Marble Style', name: 'Calacatta Luxe', hex: '#F8F8F8', finishes: ['Polished','Honed'], popularity: 3, priceTier: 'premium' },
  { id: 'neo-calacatta-roma', brand: 'neolith', collection: 'Marble Style', name: 'Calacatta Roma', hex: '#F8F8F8', finishes: ['Polished','Honed'], popularity: 2, priceTier: 'premium' },
  { id: 'neo-calacatta-royale',brand:'neolith', collection: 'Marble Style', name: 'Calacatta Royale',hex:'#F8F8F8', finishes: ['Polished','Honed'], popularity: 2, priceTier: 'premium' },
  { id: 'neo-alexandra',      brand: 'neolith', collection: 'Marble Style', name: 'Alexandra',      hex: '#E8E8E8', finishes: ['Polished','Honed'], popularity: 2, priceTier: 'premium' },
  { id: 'neo-iron-grey',      brand: 'neolith', collection: 'Industrial',   name: 'Iron Grey',      hex: '#4A4A4A', finishes: ['Matte','Polished'], popularity: 1, priceTier: 'mid' },
  { id: 'neo-concrete',       brand: 'neolith', collection: 'Industrial',   name: 'Concrete',       hex: '#666666', finishes: ['Matte','Polished'], popularity: 1, priceTier: 'mid' },
  { id: 'neo-weathered-steel',brand: 'neolith', collection: 'Industrial',   name: 'Weathered Steel',hex: '#5A5A5A', finishes: ['Matte','Polished'], popularity: 1, priceTier: 'mid' },
  { id: 'neo-arctic-white',   brand: 'neolith', collection: 'Solid',        name: 'Arctic White',   hex: '#FFFFFF', finishes: ['Polished','Honed'], popularity: 2, priceTier: 'mid' },
  { id: 'neo-pure-white',     brand: 'neolith', collection: 'Solid',        name: 'Pure White',     hex: '#FAFAFA', finishes: ['Polished','Honed'], popularity: 2, priceTier: 'mid' },
  { id: 'neo-black',          brand: 'neolith', collection: 'Solid',        name: 'Black',          hex: '#1A1A1A', finishes: ['Polished','Honed'], popularity: 1, priceTier: 'mid' },
  { id: 'neo-boho',           brand: 'neolith', collection: 'Faux Wood',    name: 'Boho',           hex: '#C4A574', finishes: ['Matte'], popularity: 1, priceTier: 'mid' },
  { id: 'neo-summerdale',     brand: 'neolith', collection: 'Faux Wood',    name: 'Summerdale',     hex: '#D4B896', finishes: ['Matte'], popularity: 1, priceTier: 'mid' },

  // ────────── DEKTON ──────────
  { id: 'dek-olimpo',   brand: 'dekton', collection: 'Stonika',    name: 'Olimpo',   hex: '#F0F0F0', finishes: ['Matte','Polished'], popularity: 4, priceTier: 'premium' },
  { id: 'dek-bergen',   brand: 'dekton', collection: 'Stonika',    name: 'Bergen',   hex: '#D4C5B0', finishes: ['Matte','Polished'], popularity: 2, priceTier: 'premium' },
  { id: 'dek-arga',     brand: 'dekton', collection: 'Stonika',    name: 'Arga',     hex: '#E8E0D0', finishes: ['Matte','Polished'], popularity: 3, priceTier: 'premium' },
  { id: 'dek-taga',     brand: 'dekton', collection: 'Stonika',    name: 'Taga',     hex: '#E0D8C8', finishes: ['Matte','Polished'], popularity: 2, priceTier: 'premium' },
  { id: 'dek-aura',     brand: 'dekton', collection: 'Natural',    name: 'Aura',     hex: '#F5F5F0', finishes: ['Matte','Polished'], popularity: 5, priceTier: 'premium' },
  { id: 'dek-kelya',    brand: 'dekton', collection: 'Natural',    name: 'Kelya',    hex: '#2A2A2A', finishes: ['Matte','Polished'], popularity: 4, priceTier: 'premium' },
  { id: 'dek-rem',      brand: 'dekton', collection: 'Natural',    name: 'Rem',      hex: '#B0A090', finishes: ['Matte','Polished'], popularity: 2, priceTier: 'mid' },
  { id: 'dek-trilium',  brand: 'dekton', collection: 'Industrial', name: 'Trilium',  hex: '#3A3A38', finishes: ['Matte','Polished'], popularity: 3, priceTier: 'mid' },

  // ────────── CAESARSTONE ──────────
  { id: 'cs-pure-white',      brand: 'caesarstone', collection: 'Standard',      name: 'Pure White',        code: '1141', hex: '#FFFFFF', finishes: ['Polished'], popularity: 4, priceTier: 'standard' },
  { id: 'cs-calacatta-nuvo',  brand: 'caesarstone', collection: 'Supernatural',  name: 'Calacatta Nuvo',    code: '5131', hex: '#F5F0E8', finishes: ['Polished'], popularity: 5, priceTier: 'mid' },
  { id: 'cs-statuario-max',   brand: 'caesarstone', collection: 'Supernatural',  name: 'Statuario Maximus', code: '5031', hex: '#F5F5F5', finishes: ['Polished'], popularity: 4, priceTier: 'mid' },
  { id: 'cs-statuario-nuvo',  brand: 'caesarstone', collection: 'Supernatural',  name: 'Statuario Nuvo',    code: '5111', hex: '#E8DCC8', finishes: ['Polished'], popularity: 3, priceTier: 'mid' },
  { id: 'cs-empira-white',    brand: 'caesarstone', collection: 'Supernatural',  name: 'Empira White',      code: '5151', hex: '#F8F8F8', finishes: ['Polished'], popularity: 2, priceTier: 'mid' },

  // ────────── CAMBRIA ──────────
  { id: 'cam-inverness-frost',brand: 'cambria', collection: 'Signature',     name: 'Inverness Frost',       hex: '#F0F0F0', finishes: ['Polished'], popularity: 5, priceTier: 'mid' },
  { id: 'cam-brittanicca-gw', brand: 'cambria', collection: 'Signature',     name: 'Brittanicca Gold Warm', hex: '#E8D8C0', finishes: ['Polished'], popularity: 4, priceTier: 'premium' },
  { id: 'cam-brittanicca',    brand: 'cambria', collection: 'White Family',  name: 'Brittanicca',           hex: '#E8E8E0', finishes: ['Polished'], popularity: 5, priceTier: 'premium' },
  { id: 'cam-torquay',        brand: 'cambria', collection: 'White Family',  name: 'Torquay',               hex: '#EAE8E0', finishes: ['Polished'], popularity: 4, priceTier: 'mid' },
  { id: 'cam-ella',           brand: 'cambria', collection: 'Gray Family',   name: 'Ella',                  hex: '#D0D0C8', finishes: ['Polished'], popularity: 3, priceTier: 'mid' },
  { id: 'cam-ironsbridge',    brand: 'cambria', collection: 'Mixed Tones',   name: 'Ironsbridge',           hex: '#D8C8B8', finishes: ['Polished'], popularity: 3, priceTier: 'mid' },
  { id: 'cam-st-isley',       brand: 'cambria', collection: '2025 New',      name: 'St. Isley',             hex: '#E0D0C0', finishes: ['Polished'], popularity: 2, priceTier: 'mid' },
  { id: 'cam-traymore-bay',   brand: 'cambria', collection: '2025 New',      name: 'Traymore Bay',          hex: '#D8C8B0', finishes: ['Polished'], popularity: 2, priceTier: 'mid' },
  { id: 'cam-claremont',      brand: 'cambria', collection: '2025 New',      name: 'Claremont',             hex: '#E8D8C8', finishes: ['Polished'], popularity: 2, priceTier: 'mid' },
  { id: 'cam-kenwood',        brand: 'cambria', collection: '2025 New',      name: 'Kenwood',               hex: '#D0C0A8', finishes: ['Polished'], popularity: 1, priceTier: 'mid' },

  // ────────── NATURAL QUARTZITE ──────────
  { id: 'qz-taj-mahal',         brand: 'quartzite', collection: 'Premium',  name: 'Taj Mahal',          hex: '#E8D8C8', finishes: ['Polished','Honed','Leathered'], popularity: 5, priceTier: 'luxury',  origin: 'Brazil', priceOverride: { low: 100, high: 250 } },
  { id: 'qz-super-white',       brand: 'quartzite', collection: 'Premium',  name: 'Super White',        hex: '#F5F5F0', finishes: ['Polished','Honed','Leathered'], popularity: 5, priceTier: 'premium', origin: 'Brazil', priceOverride: { low: 90, high: 180 } },
  { id: 'qz-calacatta-macaubas',brand: 'quartzite', collection: 'Premium',  name: 'Calacatta Macaubas', hex: '#E8E0D8', finishes: ['Polished','Honed','Leathered'], popularity: 4, priceTier: 'premium', origin: 'Brazil', priceOverride: { low: 90, high: 180 } },
  { id: 'qz-fantasy-brown',     brand: 'quartzite', collection: 'Standard', name: 'Fantasy Brown',      hex: '#C8C0B8', finishes: ['Polished','Honed','Leathered'], popularity: 4, priceTier: 'mid',     origin: 'India',  priceOverride: { low: 75, high: 150 } },
  { id: 'qz-fantasy-macaubas',  brand: 'quartzite', collection: 'Standard', name: 'Fantasy Macaubas',   hex: '#D0C8C0', finishes: ['Polished','Honed','Leathered'], popularity: 3, priceTier: 'premium', origin: 'Brazil', priceOverride: { low: 90, high: 180 } }
];

// ─── Thickness options by brand ───
export const THICKNESS_OPTIONS = {
  neolith:     ['6mm', '12mm', '20mm'],
  dekton:      ['8mm', '12mm', '20mm', '30mm'],
  caesarstone: ['20mm', '30mm'],
  cambria:     ['20mm', '30mm'],
  quartzite:   ['20mm', '30mm']
};

// ─── Helper functions ───

/** Get all colors for a brand */
export function getColorsByBrand(brandId) {
  return COUNTERTOP_COLORS.filter(c => c.brand === brandId);
}

/** Get all colors in a collection */
export function getColorsByCollection(brandId, collection) {
  return COUNTERTOP_COLORS.filter(c => c.brand === brandId && c.collection === collection);
}

/** Get a color by ID */
export function getColorById(id) {
  return COUNTERTOP_COLORS.find(c => c.id === id) || null;
}

/** Get brand display name */
export function getBrandName(brandId) {
  return COUNTERTOP_BRANDS[brandId] || brandId;
}

/** Get unique collections for a brand */
export function getCollections(brandId) {
  const cols = new Set();
  COUNTERTOP_COLORS.filter(c => c.brand === brandId).forEach(c => cols.add(c.collection));
  return [...cols];
}

/** Get price range for a specific color (uses override if available, else brand default) */
export function getColorPrice(colorId) {
  const color = getColorById(colorId);
  if (!color) return null;
  if (color.priceOverride) return { ...color.priceOverride, unit: 'sqft' };
  return { ...COUNTERTOP_PRICING[color.brand], unit: 'sqft' };
}

/** Estimate total countertop cost */
export function estimateCountertopCost(colorId, sqft, edgeProfile = 'straight', cutouts = 1) {
  const price = getColorPrice(colorId);
  if (!price) return null;
  const midMaterial = ((price.low + price.high) / 2) * sqft;
  const edgeCost = edgeProfile !== 'straight'
    ? ((COUNTERTOP_ADDONS.edgeProfiles.low + COUNTERTOP_ADDONS.edgeProfiles.high) / 2) * sqft
    : 0;
  const cutoutCost = cutouts * ((COUNTERTOP_ADDONS.cutouts.low + COUNTERTOP_ADDONS.cutouts.high) / 2);
  return {
    materialLow:  price.low * sqft,
    materialHigh: price.high * sqft,
    edgeCost:     Math.round(edgeCost),
    cutoutCost:   Math.round(cutoutCost),
    totalLow:     Math.round(price.low * sqft + edgeCost + cutoutCost),
    totalHigh:    Math.round(price.high * sqft + edgeCost + cutoutCost),
    perSqft:      price
  };
}

/** Get popular colors across all brands (sorted by popularity desc) */
export function getPopularColors(limit = 10) {
  return [...COUNTERTOP_COLORS]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit);
}

/** Price tier labels */
export const PRICE_TIER_LABELS = {
  standard: 'Entry Level ($50-$70/sqft installed)',
  mid:      'Mid-Range ($70-$125/sqft installed)',
  premium:  'Premium ($125-$200/sqft installed)',
  luxury:   'Luxury ($200+/sqft installed)'
};
