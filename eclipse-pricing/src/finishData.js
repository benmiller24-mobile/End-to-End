/**
 * Eclipse Cabinetry — Finish & Species Data
 * Species percentage markups, construction multipliers, and finish color mappings
 */

/** Species percentage markup/discount over stock price */
export const SPECIES_PCT = {
  "TFL": -25, "Rauvisio noir Matte HPL": -4, "Red Oak": -2,
  "PV": -10, "White Oak": 0, "Hickory": 0, "American Poplar": 0,
  "Acrylic HG": 0, "Acrylic Matte": 0, "Recon White Oak": 4,
  "Recon Walnut": 4, "Rustic Hickory": 5,
  "Rustic White Oak": 5, "Rustic Red Oak": 3, "Alder": 12, "Rustic Alder": 17, "Maple": 8,
  "Select Poplar": 8, "Paint (Std SW)": 18, "Paint (Trend)": 18,
  "Cherry": 10, "Rustic Maple": 13, "Rustic Cherry": 15,
  "QS White Oak": 16, "Rift White Oak": 19, "Walnut": 20,
  "Custom Paint (SW)": 28, "Rustic Walnut": 25,
};

/** Construction type multiplier (% over base) */
export const CONSTRUCTION_PCT = { "Standard": 0, "Plywood": 10 };

/** Material options */
export const MATERIALS = [
  { v: "PB", l: "Particle Board (Standard)" },
  { v: "PLY", l: "Plywood (+10%)" },
];

/** Interior options */
export const INTERIORS = [
  { v: "STD-MAPL", l: "Std Maple Laminate Interior" },
  { v: "LINEN", l: "Linen Interior (No Charge)" },
  { v: "FI", l: "Finished Interior (+25%)" },
];

/** Available finish colors by species */
export const FINISH_COLORS = (() => {
  const o = {};
  const OW = ["OW-Beige","OW-Black","OW-Clary Sage","OW-Dovetail Gray","OW-Iron Ore","OW-Mindful Gray","OW-Naval","OW-Polar","OW-Pure White","OW-Repose Gray","OW-Unusual Gray"];
  const NE = ["Clay","Creekside","Dusk","Flagstone","Mineral","Morel"];
  const oakS = ["Natural","Almond","Aqua","Autumn","Braun","Cadet","Cotton","Espresso","Harbor","Hudson","Ink","Medium","Moss","Sandrift","Silas","Sky","Sterling","Stratus","Straw","Thyme","Whitewash","Yosemite Brown"];

  o["Alder"] = o["Rustic Alder"] = ["Natural","Aqua","Bistre","Caramel","Caviar","Cola","Cotton","Dusty Road","Espresso","Sierra","Silas","Stonehenge","Thyme","Umber","Walnut","White Sands","Barnwood",...OW];
  o["Hickory"] = o["Rustic Hickory"] = ["Natural","Aqua","Burnt Sugar","Cadet","Chestnut","Cotton","Harbor","Hudson","Medium","Moss","Silas","Sky","Sterling","Stratus","Thyme",...OW];
  o["Cherry"] = o["Rustic Cherry"] = ["Natural","Bourbon","Carob","Coffee","Espresso","Medium","Red","Silas","Thyme","Rosewood","Tobacco",...OW];
  o["Maple"] = o["Rustic Maple"] = ["Natural","Acorn","Cashmere","Cayenne","Cocoa","Espresso","Golden","Pebble","Perfect Brown","Rockbridge","Sable","Silas","Spice","Thyme","Gunstock","Oatmeal","Roasted Pepper",...OW];
  o["Paint (Std SW)"] = ["Amazing Gray","Arctic","Beige","Black","Clary Sage","Dovetail Gray","Eggshell","Evergreen Fog","Hale Navy","Iron Ore","Light French Gray","Mindful Gray","Naval","Niebla Azul","Outerspace","Pewter Green","Polar","Pure White","Repose Gray","Soft White","Shoji White","Slate Tile","Unusual Gray"];
  o["Paint (Trend)"] = ["Plum Brown","Studio Clay","Taiga"];
  o["Custom Paint (SW)"] = ["Custom"];
  o["Red Oak"] = o["Rustic Red Oak"] = ["Natural","Aqua","Autumn","Braun","Cadet","Espresso","Harbor","Harvest","Hudson","Medium","Moss","Silas","Sterling","Thyme","Wiley",...NE,...OW];
  o["QS White Oak"] = [...oakS,...NE];
  o["Rift White Oak"] = [...oakS,...NE];
  o["White Oak"] = o["Rustic White Oak"] = [...oakS,...NE,...OW];
  o["Select Poplar"] = ["Carbon","Heatherstone","River Rock","Seagull"];
  o["American Poplar"] = ["Cadet","Harbor","Hudson","Moss","Sky","Sterling","Stratus","Thyme"];
  o["Recon White Oak"] = ["Natural","Ashfall","Meadow"];
  o["Recon Walnut"] = ["Natural","Dakota","Mountain Haze"];
  o["Walnut"] = o["Rustic Walnut"] = ["Natural","Bison","Cadet","Rye","Seagull","Stratus","Thyme"];
  o["TFL"] = ["Arizona Cypress","Battle Creek Oak","Canella Rustik","Dark Walnut","Door County Oak","Evening Notte","Gregio Pine","Grey Echo","Kirsche","Morning Fog","Natural Elm","Natural Rustik","Outer Bank Oak","Pearl White","Serotina","Takase Teak","White Nebbia"];
  o["Rauvisio noir Matte HPL"] = ["After Dark","Boxcar Blonde","Capital Starlit","Casa Blanca","Gaslit Alley","High Low","Maltese Mist","Midnight Dash","Olive Detour","Silver Lake","Smoke Stack","Trench Coat"];
  o["Acrylic HG"] = ["Bianco","Bigio","Cubanite","Gabbiano"];
  o["Acrylic Matte"] = ["White Velvet","Ash Velvet","Carbon Velvet","Charcoal Velvet"];
  o["PV"] = ["American Oak","Classic Walnut","Hazelnut Oak","Natural Oak","Tropic Walnut"];
  return o;
})();

/** Get all available species names */
export function getSpeciesNames() {
  return Object.keys(SPECIES_PCT);
}

/** Get colors available for a species */
export function getColorsForSpecies(species) {
  return FINISH_COLORS[species] || [];
}

/** Glazes */
export const GLAZES = [
  { v: "NONE", l: "No Glazes" }, { v: "BLK-GL", l: "Black Glaze" },
  { v: "MCH-GL", l: "Mocha Glaze" }, { v: "VDK-GL", l: "Van Dyke Glaze" },
  { v: "NKL-GL", l: "Nickel Glaze" },
];

/** Highlights */
export const HIGHLIGHTS = [
  { v: "NONE", l: "No Highlight" }, { v: "GRPH-HL", l: "Graphite Highlight" },
  { v: "CAFE-HL", l: "Café Highlight" }, { v: "SLATE-HL", l: "Slate Highlight" },
];

/** Character Techniques */
export const CHAR_TECHNIQUES = [
  { v: "NONE", l: "No Character Technique" }, { v: "AGED", l: "Aged" },
  { v: "SNDTHRU", l: "Sand-Through" }, { v: "WEAR", l: "Wearing" },
  { v: "WTHR", l: "Weathered Collection" }, { v: "OLDE", l: "Olde World" },
];
