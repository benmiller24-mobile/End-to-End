// ─── Eclipse Kitchen Designer — Countertop Material Database ───
// Real manufacturer colors, collections, and 2025-2026 pricing tiers
// Sources: Neolith, Dekton/Cosentino, Caesarstone, Cambria, Silestone, MSI Q/Stile,
// LG Viatera, HanStone, porcelain slab makers, regional quartzite suppliers (2025-2026)

export const COUNTERTOP_BRANDS = {
  neolith:    'Neolith',
  dekton:     'Dekton by Cosentino',
  caesarstone:'Caesarstone',
  cambria:    'Cambria',
  quartzite:  'Natural Quartzite',
  silestone:  'Silestone by Cosentino',
  msi:        'MSI Surfaces',
  viatera:    'LG Viatera',
  hanstone:   'HanStone Quartz',
  porcelain:  'Porcelain Slab'
};

// ─── Pricing tiers (installed $/sqft, 2025-2026) ───
export const COUNTERTOP_PRICING = {
  neolith:     { low: 95, high: 155, material: 'Sintered Stone' },
  dekton:      { low: 80, high: 210, material: 'Ultra-Compact Surface' },
  caesarstone: { low: 50, high: 125, material: 'Engineered Quartz' },
  cambria:     { low: 60, high: 125, material: 'Natural Quartz' },
  quartzite:   { low: 90, high: 220, material: 'Natural Quartzite' },
  silestone:   { low: 55, high: 120, material: 'Engineered Quartz' },
  msi:         { low: 45, high: 110, material: 'Engineered Quartz' },
  viatera:     { low: 50, high: 115, material: 'Engineered Quartz' },
  hanstone:    { low: 50, high: 115, material: 'Engineered Quartz' },
  porcelain:   { low: 65, high: 135, material: 'Porcelain Sintered Slab' }
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
  { id: 'qz-fantasy-macaubas',  brand: 'quartzite', collection: 'Standard', name: 'Fantasy Macaubas',   hex: '#D0C8C0', finishes: ['Polished','Honed','Leathered'], popularity: 3, priceTier: 'premium', origin: 'Brazil', priceOverride: { low: 90, high: 180 } },

  // ────────── SILESTONE (Cosentino engineered quartz) ──────────
  { id: 'sil-et-calacatta-gold', brand: 'silestone', collection: 'Eternal',  name: 'Eternal Calacatta Gold', hex: '#F2EAD9', finishes: ['Polished','Suede'], popularity: 5, priceTier: 'premium' },
  { id: 'sil-ethereal-glow',     brand: 'silestone', collection: 'Ethereal', name: 'Ethereal Glow',          hex: '#F4F1EA', finishes: ['Polished','Suede'], popularity: 5, priceTier: 'premium' },
  { id: 'sil-ethereal-haze',     brand: 'silestone', collection: 'Ethereal', name: 'Ethereal Haze',          hex: '#ECE9E2', finishes: ['Polished','Suede'], popularity: 4, priceTier: 'premium' },
  { id: 'sil-ethereal-noctis',   brand: 'silestone', collection: 'Ethereal', name: 'Ethereal Noctis',        hex: '#20211F', finishes: ['Polished','Suede'], popularity: 3, priceTier: 'premium' },
  { id: 'sil-et-statuario',      brand: 'silestone', collection: 'Eternal',  name: 'Eternal Statuario',      hex: '#F4F4F1', finishes: ['Polished','Suede'], popularity: 4, priceTier: 'premium' },
  { id: 'sil-et-marquina',       brand: 'silestone', collection: 'Eternal',  name: 'Eternal Marquina',       hex: '#201F1D', finishes: ['Polished','Suede'], popularity: 3, priceTier: 'premium' },
  { id: 'sil-calacatta-gold',    brand: 'silestone', collection: 'Classic',  name: 'Calacatta Gold',         hex: '#F1E8D6', finishes: ['Polished'], popularity: 4, priceTier: 'mid' },
  { id: 'sil-miami-vena',        brand: 'silestone', collection: 'Classic',  name: 'Miami Vena',             hex: '#EFEDE8', finishes: ['Polished'], popularity: 4, priceTier: 'mid' },
  { id: 'sil-pietra',            brand: 'silestone', collection: 'Classic',  name: 'Pietra',                 hex: '#2C2C2A', finishes: ['Polished','Suede'], popularity: 3, priceTier: 'mid' },
  { id: 'sil-lyra',              brand: 'silestone', collection: 'Eternal',  name: 'Lyra',                   hex: '#E7E3DA', finishes: ['Polished'], popularity: 3, priceTier: 'mid' },
  { id: 'sil-white-storm',       brand: 'silestone', collection: 'Classic',  name: 'White Storm',            hex: '#EDEBE4', finishes: ['Polished'], popularity: 2, priceTier: 'standard' },
  { id: 'sil-charcoal-soapstone',brand: 'silestone', collection: 'Eternal',  name: 'Charcoal Soapstone',     hex: '#2E312F', finishes: ['Polished','Suede'], popularity: 3, priceTier: 'mid' },
  { id: 'sil-blanco-zeus',       brand: 'silestone', collection: 'Classic',  name: 'Blanco Zeus',            hex: '#F0EEE9', finishes: ['Polished'], popularity: 3, priceTier: 'standard' },

  // ────────── MSI — Q PREMIUM QUARTZ ──────────
  { id: 'msi-calacatta-laza',     brand: 'msi', collection: 'Q Premium Quartz', name: 'Calacatta Laza',          hex: '#F4EFE6', finishes: ['Polished'], popularity: 5, priceTier: 'mid' },
  { id: 'msi-calacatta-laza-oro', brand: 'msi', collection: 'Q Premium Quartz', name: 'Calacatta Laza Oro',      hex: '#F2E9D6', finishes: ['Polished'], popularity: 4, priceTier: 'mid' },
  { id: 'msi-miraggio-gold',      brand: 'msi', collection: 'Q Premium Quartz', name: 'Calacatta Miraggio Gold', hex: '#F3ECDB', finishes: ['Polished'], popularity: 5, priceTier: 'mid' },
  { id: 'msi-miraggio-cove',      brand: 'msi', collection: 'Q Premium Quartz', name: 'Calacatta Miraggio Cove', hex: '#F1E9D8', finishes: ['Polished'], popularity: 4, priceTier: 'mid' },
  { id: 'msi-miraggio-cielo',     brand: 'msi', collection: 'Q Premium Quartz', name: 'Calacatta Miraggio Cielo',hex: '#EDEBE6', finishes: ['Polished'], popularity: 4, priceTier: 'mid' },
  { id: 'msi-carrara-marmi',      brand: 'msi', collection: 'Q Premium Quartz', name: 'Carrara Marmi',           hex: '#ECEBE6', finishes: ['Polished'], popularity: 4, priceTier: 'standard' },
  { id: 'msi-babylon-gray',       brand: 'msi', collection: 'Q Premium Quartz', name: 'Babylon Gray',            hex: '#CFCDC7', finishes: ['Polished'], popularity: 3, priceTier: 'standard' },
  { id: 'msi-fossil-gray',        brand: 'msi', collection: 'Q Premium Quartz', name: 'Fossil Gray',             hex: '#B7B5AF', finishes: ['Polished'], popularity: 2, priceTier: 'standard' },
  { id: 'msi-iced-white',         brand: 'msi', collection: 'Q Premium Quartz', name: 'Iced White',              hex: '#F4F4F1', finishes: ['Polished'], popularity: 3, priceTier: 'standard' },
  { id: 'msi-frost-white',        brand: 'msi', collection: 'Q Premium Quartz', name: 'Frost White',             hex: '#F6F5F1', finishes: ['Polished'], popularity: 3, priceTier: 'standard' },

  // ────────── LG VIATERA (LX Hausys engineered quartz) ──────────
  { id: 'via-minuet',             brand: 'viatera', collection: 'Quartz', name: 'Minuet',              hex: '#F0EEE9', finishes: ['Polished'], popularity: 4, priceTier: 'standard' },
  { id: 'via-soprano',            brand: 'viatera', collection: 'Quartz', name: 'Soprano',             hex: '#ECEAE4', finishes: ['Polished'], popularity: 3, priceTier: 'standard' },
  { id: 'via-aria',               brand: 'viatera', collection: 'Quartz', name: 'Aria',                hex: '#F3F0E9', finishes: ['Polished'], popularity: 4, priceTier: 'mid' },
  { id: 'via-rococo',             brand: 'viatera', collection: 'Quartz', name: 'Rococo',              hex: '#EFE9DC', finishes: ['Polished'], popularity: 4, priceTier: 'mid' },
  { id: 'via-everest',            brand: 'viatera', collection: 'Quartz', name: 'Everest',             hex: '#F4F3EE', finishes: ['Polished'], popularity: 3, priceTier: 'mid' },
  { id: 'via-calacatta-classique',brand:'viatera', collection: 'Quartz', name: 'Calacatta Classique', hex: '#F2ECDE', finishes: ['Polished'], popularity: 4, priceTier: 'mid' },
  { id: 'via-thunderstorm',       brand: 'viatera', collection: 'Quartz', name: 'Thunderstorm',        hex: '#B9B7B1', finishes: ['Polished'], popularity: 2, priceTier: 'standard' },
  { id: 'via-muse',               brand: 'viatera', collection: 'Quartz', name: 'Muse',                hex: '#E8E5DE', finishes: ['Polished'], popularity: 2, priceTier: 'standard' },
  { id: 'via-encanto',            brand: 'viatera', collection: 'Quartz', name: 'Encanto',             hex: '#EDE7DA', finishes: ['Polished'], popularity: 3, priceTier: 'mid' },

  // ────────── HANSTONE QUARTZ (Hanwha) ──────────
  { id: 'han-montauk',        brand: 'hanstone', collection: 'Quartz', name: 'Montauk',         hex: '#E9E7E1', finishes: ['Polished'], popularity: 3, priceTier: 'standard' },
  { id: 'han-aspen',          brand: 'hanstone', collection: 'Quartz', name: 'Aspen',           hex: '#F2F0EB', finishes: ['Polished'], popularity: 3, priceTier: 'standard' },
  { id: 'han-carrara-grigio', brand: 'hanstone', collection: 'Quartz', name: 'Carrara Grigio',  hex: '#E7E6E1', finishes: ['Polished'], popularity: 3, priceTier: 'standard' },
  { id: 'han-bianco-drift',   brand: 'hanstone', collection: 'Quartz', name: 'Bianco Drift',    hex: '#EFEDE7', finishes: ['Polished'], popularity: 4, priceTier: 'mid' },
  { id: 'han-tranquility',    brand: 'hanstone', collection: 'Quartz', name: 'Tranquility',     hex: '#ECEAE3', finishes: ['Polished'], popularity: 3, priceTier: 'mid' },
  { id: 'han-frost-white',    brand: 'hanstone', collection: 'Quartz', name: 'Frost White',     hex: '#F5F4F0', finishes: ['Polished'], popularity: 2, priceTier: 'standard' },
  { id: 'han-specchio-white', brand: 'hanstone', collection: 'Quartz', name: 'Specchio White',  hex: '#F3F2ED', finishes: ['Polished'], popularity: 2, priceTier: 'standard' },

  // ────────── PORCELAIN SLAB (MSI Stile / LX Teracanto / Atlas Plan / Laminam style) ──────────
  { id: 'porc-calacatta-gold',  brand: 'porcelain', collection: 'Marble Look',   name: 'Calacatta Gold',   hex: '#F2EAD8', finishes: ['Polished','Matte'], popularity: 5, priceTier: 'premium' },
  { id: 'porc-statuario',       brand: 'porcelain', collection: 'Marble Look',   name: 'Statuario Bianco', hex: '#F4F3EF', finishes: ['Polished','Matte'], popularity: 5, priceTier: 'premium' },
  { id: 'porc-carrara',         brand: 'porcelain', collection: 'Marble Look',   name: 'Carrara',          hex: '#ECEBE6', finishes: ['Polished','Matte'], popularity: 4, priceTier: 'mid' },
  { id: 'porc-calacatta-prici', brand: 'porcelain', collection: 'Marble Look',   name: 'Calacatta Prici',  hex: '#F3ECDC', finishes: ['Polished','Matte'], popularity: 4, priceTier: 'premium' },
  { id: 'porc-pietra-grey',     brand: 'porcelain', collection: 'Stone Look',    name: 'Pietra Grey',      hex: '#4A4D50', finishes: ['Polished','Matte'], popularity: 3, priceTier: 'mid' },
  { id: 'porc-sahara-noir',     brand: 'porcelain', collection: 'Marble Look',   name: 'Sahara Noir',      hex: '#2A2622', finishes: ['Polished','Matte'], popularity: 3, priceTier: 'premium' },
  { id: 'porc-nero-marquina',   brand: 'porcelain', collection: 'Marble Look',   name: 'Nero Marquina',    hex: '#1E1E1C', finishes: ['Polished','Matte'], popularity: 3, priceTier: 'premium' },
  { id: 'porc-concrete',        brand: 'porcelain', collection: 'Concrete Look', name: 'Concrete Grey',    hex: '#8C8A85', finishes: ['Matte'], popularity: 2, priceTier: 'mid' },
  { id: 'porc-calacatta-black', brand: 'porcelain', collection: 'Marble Look',   name: 'Calacatta Black',  hex: '#232220', finishes: ['Polished','Matte'], popularity: 3, priceTier: 'premium' },
  { id: 'porc-taj-beige',       brand: 'porcelain', collection: 'Marble Look',   name: 'Taj Beige',        hex: '#E5DBC8', finishes: ['Polished','Matte'], popularity: 2, priceTier: 'mid' },

  // ────────── CAESARSTONE (expanded) ──────────
  { id: 'cs-frosty-carrina',     brand: 'caesarstone', collection: 'Supernatural',  name: 'Frosty Carrina',     code: '5141', hex: '#EFEEEA', finishes: ['Polished'], popularity: 4, priceTier: 'mid' },
  { id: 'cs-london-grey',        brand: 'caesarstone', collection: 'Metropolitan',  name: 'London Grey',        code: '5000', hex: '#CFCDC7', finishes: ['Polished','Honed'], popularity: 4, priceTier: 'mid' },
  { id: 'cs-cloudburst-concrete',brand: 'caesarstone', collection: 'Metropolitan',  name: 'Cloudburst Concrete',code: '4011', hex: '#9C9A95', finishes: ['Polished','Honed'], popularity: 3, priceTier: 'mid' },
  { id: 'cs-raw-concrete',       brand: 'caesarstone', collection: 'Metropolitan',  name: 'Raw Concrete',       code: '4004', hex: '#8E8C87', finishes: ['Honed'], popularity: 4, priceTier: 'mid' },
  { id: 'cs-rugged-concrete',    brand: 'caesarstone', collection: 'Metropolitan',  name: 'Rugged Concrete',    code: '4033', hex: '#7C7A75', finishes: ['Honed'], popularity: 3, priceTier: 'mid' },
  { id: 'cs-airy-concrete',      brand: 'caesarstone', collection: 'Metropolitan',  name: 'Airy Concrete',      code: '4001', hex: '#C7C5BF', finishes: ['Honed'], popularity: 2, priceTier: 'mid' },
  { id: 'cs-empira-black',       brand: 'caesarstone', collection: 'Supernatural',  name: 'Empira Black',       code: '5101', hex: '#211F1D', finishes: ['Polished'], popularity: 3, priceTier: 'premium' },
  { id: 'cs-calacatta-maximus',  brand: 'caesarstone', collection: 'Supernatural',  name: 'Calacatta Maximus',  code: '5143', hex: '#F3EEE4', finishes: ['Polished'], popularity: 4, priceTier: 'mid' },
  { id: 'cs-black-tempal',       brand: 'caesarstone', collection: 'Standard',      name: 'Black Tempal',       code: '3100', hex: '#232323', finishes: ['Polished'], popularity: 2, priceTier: 'standard' },
  { id: 'cs-clamshell',          brand: 'caesarstone', collection: 'Standard',      name: 'Clamshell',          code: '3141', hex: '#E3E0D8', finishes: ['Polished'], popularity: 2, priceTier: 'standard' },
  { id: 'cs-georgian-bluffs',    brand: 'caesarstone', collection: 'Metropolitan',  name: 'Georgian Bluffs',    code: '4046', hex: '#6E6C68', finishes: ['Honed'], popularity: 2, priceTier: 'mid' },
  { id: 'cs-sleek-concrete',     brand: 'caesarstone', collection: 'Metropolitan',  name: 'Sleek Concrete',     code: '4003', hex: '#9A9893', finishes: ['Honed'], popularity: 2, priceTier: 'mid' },

  // ────────── CAMBRIA (expanded) ──────────
  { id: 'cam-swanbridge',        brand: 'cambria', collection: 'Coastal',          name: 'Swanbridge',        hex: '#ECEAE3', finishes: ['Polished'], popularity: 4, priceTier: 'mid' },
  { id: 'cam-skara-brae',        brand: 'cambria', collection: 'Marble Collection',name: 'Skara Brae',        hex: '#EDE7DB', finishes: ['Polished'], popularity: 5, priceTier: 'premium' },
  { id: 'cam-whitehall',         brand: 'cambria', collection: 'Coastal',          name: 'Whitehall',         hex: '#EFEEE9', finishes: ['Polished'], popularity: 3, priceTier: 'mid' },
  { id: 'cam-montgomery',        brand: 'cambria', collection: 'Black Family',     name: 'Montgomery',        hex: '#2A2A28', finishes: ['Polished'], popularity: 3, priceTier: 'premium' },
  { id: 'cam-delgatie',          brand: 'cambria', collection: 'Marble Collection',name: 'Delgatie',          hex: '#ECE6DA', finishes: ['Polished'], popularity: 3, priceTier: 'premium' },
  { id: 'cam-berwyn',            brand: 'cambria', collection: 'Gray Family',      name: 'Berwyn',            hex: '#C9C7C1', finishes: ['Polished'], popularity: 2, priceTier: 'mid' },
  { id: 'cam-annicca',           brand: 'cambria', collection: 'Marble Collection',name: 'Annicca',           hex: '#EAE3D5', finishes: ['Polished'], popularity: 3, priceTier: 'premium' },
  { id: 'cam-newport',           brand: 'cambria', collection: 'White Family',     name: 'Newport',           hex: '#EFEEE8', finishes: ['Polished'], popularity: 3, priceTier: 'mid' },
  { id: 'cam-praa-sands',        brand: 'cambria', collection: 'White Family',     name: 'Praa Sands',        hex: '#F0EFE9', finishes: ['Polished'], popularity: 3, priceTier: 'mid' },
  { id: 'cam-seagrove',          brand: 'cambria', collection: 'Coastal',          name: 'Seagrove',          hex: '#EDEBE5', finishes: ['Polished'], popularity: 2, priceTier: 'mid' },
  { id: 'cam-brittanicca-warm',  brand: 'cambria', collection: 'Signature',       name: 'Brittanicca Warm',  hex: '#EDE6D6', finishes: ['Polished'], popularity: 5, priceTier: 'premium' },
  { id: 'cam-portrush',          brand: 'cambria', collection: 'Gray Family',      name: 'Portrush',          hex: '#D2D0CA', finishes: ['Polished'], popularity: 2, priceTier: 'mid' },

  // ────────── NATURAL QUARTZITE (expanded) ──────────
  { id: 'qz-mont-blanc',      brand: 'quartzite', collection: 'Premium',  name: 'Mont Blanc',      hex: '#ECEBE6', finishes: ['Polished','Honed','Leathered'], popularity: 5, priceTier: 'premium', origin: 'Brazil', priceOverride: { low: 90, high: 180 } },
  { id: 'qz-sea-pearl',       brand: 'quartzite', collection: 'Premium',  name: 'Sea Pearl',       hex: '#BFC4BA', finishes: ['Polished','Honed','Leathered'], popularity: 4, priceTier: 'premium', origin: 'Brazil', priceOverride: { low: 85, high: 170 } },
  { id: 'qz-white-macaubas',  brand: 'quartzite', collection: 'Premium',  name: 'White Macaubas',  hex: '#EDEAE0', finishes: ['Polished','Honed','Leathered'], popularity: 4, priceTier: 'premium', origin: 'Brazil', priceOverride: { low: 90, high: 185 } },
  { id: 'qz-cristallo',       brand: 'quartzite', collection: 'Exotic',   name: 'Cristallo',       hex: '#EDE9E2', finishes: ['Polished'], popularity: 4, priceTier: 'luxury', origin: 'Brazil', priceOverride: { low: 150, high: 350 } },
  { id: 'qz-azul-macaubas',   brand: 'quartzite', collection: 'Exotic',   name: 'Azul Macaubas',   hex: '#5E7C92', finishes: ['Polished','Honed'], popularity: 4, priceTier: 'luxury', origin: 'Brazil', priceOverride: { low: 150, high: 320 } },
  { id: 'qz-perla-venata',    brand: 'quartzite', collection: 'Standard', name: 'Perla Venata',    hex: '#E0DCCF', finishes: ['Polished','Honed','Leathered'], popularity: 3, priceTier: 'mid', origin: 'Brazil', priceOverride: { low: 75, high: 150 } },
  { id: 'qz-patagonia',       brand: 'quartzite', collection: 'Exotic',   name: 'Patagonia',       hex: '#E6E2D8', finishes: ['Polished'], popularity: 3, priceTier: 'luxury', origin: 'Brazil', priceOverride: { low: 160, high: 360 } },
  { id: 'qz-madre-perola',    brand: 'quartzite', collection: 'Premium',  name: 'Madre Perola',    hex: '#E8E2D4', finishes: ['Polished','Honed','Leathered'], popularity: 3, priceTier: 'premium', origin: 'Brazil', priceOverride: { low: 90, high: 185 } },
  { id: 'qz-macaubas-gold',   brand: 'quartzite', collection: 'Premium',  name: 'Macaubas Gold',   hex: '#E7DCC4', finishes: ['Polished','Honed'], popularity: 3, priceTier: 'premium', origin: 'Brazil', priceOverride: { low: 95, high: 190 } },
  { id: 'qz-sienna-bordeaux', brand: 'quartzite', collection: 'Standard', name: 'Sienna Bordeaux', hex: '#9A6A5A', finishes: ['Polished','Honed'], popularity: 2, priceTier: 'mid', origin: 'Brazil', priceOverride: { low: 75, high: 150 } },
];

// ─── Thickness options by brand ───
export const THICKNESS_OPTIONS = {
  neolith:     ['6mm', '12mm', '20mm'],
  dekton:      ['8mm', '12mm', '20mm', '30mm'],
  caesarstone: ['20mm', '30mm'],
  cambria:     ['20mm', '30mm'],
  quartzite:   ['20mm', '30mm'],
  silestone:   ['10mm', '20mm', '30mm'],
  msi:         ['2cm', '3cm', '6mm', '12mm'],
  viatera:     ['20mm', '30mm'],
  hanstone:    ['20mm', '30mm'],
  porcelain:   ['6mm', '12mm', '20mm']
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
