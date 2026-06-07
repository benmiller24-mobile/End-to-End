/**
 * Eclipse Kitchen & Bath Designer — Appliance Database
 * Real manufacturer specs: Sub-Zero, Wolf, Thermador, Fisher & Paykel, Miele, KitchenAid
 * Dimensions in inches, prices in USD (MSRP where available)
 */

// ═══ BRANDS ═══
export const APPLIANCE_BRANDS = [
  { id: 'subzero', name: 'Sub-Zero', tier: 'ultra', logo: '❄️', categories: ['refrigerator','freezer','wine'] },
  { id: 'wolf', name: 'Wolf', tier: 'ultra', logo: '🔥', categories: ['range','cooktop','wallOven','microwave','hood'] },
  { id: 'cove', name: 'Cove', tier: 'ultra', logo: '💎', categories: ['dishwasher'] },
  { id: 'thermador', name: 'Thermador', tier: 'premium', logo: '⭐', categories: ['range','cooktop','wallOven','dishwasher','refrigerator','freezer'] },
  { id: 'fisherPaykel', name: 'Fisher & Paykel', tier: 'premium', logo: '🌿', categories: ['range','cooktop','dishwasher','refrigerator'] },
  { id: 'miele', name: 'Miele', tier: 'premium', logo: '🏔️', categories: ['range','cooktop','wallOven','dishwasher','refrigerator'] },
  { id: 'kitchenaid', name: 'KitchenAid', tier: 'mid-premium', logo: '🍳', categories: ['range','cooktop','wallOven','dishwasher','refrigerator'] },
  { id: 'gaggenau', name: 'Gaggenau', tier: 'ultra', logo: '🖤', categories: ['cooktop','wallOven','steamOven','speedOven','warmingDrawer','refrigerator','freezer','wine','dishwasher','coffee','hood'] },
];

// ═══ APPLIANCE CATALOG ═══
// Each entry: { id, brand, type, subtype, model, width, height, depth, panelReady, ss, msrp, fuel?, features }
export const APPLIANCES = [

  // ──────────── SUB-ZERO REFRIGERATION ────────────
  { id:'sz-cl3650ufd', brand:'subzero', type:'refrigerator', subtype:'french-door', model:'CL3650UFD/O', width:36, height:84, depth:24, panelReady:true, ss:true, msrp:9615, builtIn:true, features:['French Door','Split Climate','Air Purification'] },
  { id:'sz-bi-36ufd', brand:'subzero', type:'refrigerator', subtype:'french-door', model:'BI-36UFD/S', width:36, height:84, depth:24, panelReady:true, ss:true, msrp:10500, builtIn:true, features:['French Door','NASA Air Purification'] },
  { id:'sz-bi-42s', brand:'subzero', type:'refrigerator', subtype:'side-by-side', model:'BI-42S/S', width:42, height:84, depth:24, panelReady:true, ss:true, msrp:12500, builtIn:true, features:['Side-by-Side','42"'] },
  { id:'sz-cl4850ufd', brand:'subzero', type:'refrigerator', subtype:'french-door', model:'CL4850UFDSP', width:48, height:84, depth:24, panelReady:true, ss:true, msrp:14000, builtIn:true, features:['48" French Door','Smart','28.9 cu ft'] },
  { id:'sz-cl4850ss', brand:'subzero', type:'refrigerator', subtype:'side-by-side', model:'CL4850SSP', width:48, height:84, depth:24, panelReady:true, ss:true, msrp:14000, builtIn:true, features:['48" Side-by-Side','Smart','29.1 cu ft'] },
  // Sub-Zero Columns
  { id:'sz-dec2450r', brand:'subzero', type:'refrigerator', subtype:'column', model:'DEC2450R', width:24, height:84, depth:24, panelReady:true, ss:false, msrp:6500, builtIn:true, features:['24" Column Refrigerator','Designer'] },
  { id:'sz-dec3050r', brand:'subzero', type:'refrigerator', subtype:'column', model:'DEC3050R', width:30, height:84, depth:24, panelReady:true, ss:false, msrp:7500, builtIn:true, features:['30" Column Refrigerator','Designer'] },
  { id:'sz-det3650r', brand:'subzero', type:'refrigerator', subtype:'column', model:'DET3650R', width:36, height:84, depth:24, panelReady:true, ss:false, msrp:8500, builtIn:true, features:['36" Integrated Column'] },
  // Sub-Zero Freezer Columns
  { id:'sz-dec2450f', brand:'subzero', type:'freezer', subtype:'column', model:'DEC2450F', width:24, height:84, depth:24, panelReady:true, ss:false, msrp:6200, builtIn:true, features:['24" Column Freezer','Designer'] },
  { id:'sz-dec3050f', brand:'subzero', type:'freezer', subtype:'column', model:'DEC3050F', width:30, height:84, depth:24, panelReady:true, ss:false, msrp:7200, builtIn:true, features:['30" Column Freezer','Designer'] },
  // Sub-Zero Wine
  { id:'sz-dew2450', brand:'subzero', type:'wine', subtype:'column', model:'DEW2450', width:24, height:84, depth:24, panelReady:true, ss:false, msrp:5500, features:['24" Wine Column','146 bottles'] },
  // Sub-Zero Undercounter
  { id:'sz-uc24r', brand:'subzero', type:'refrigerator', subtype:'undercounter', model:'UC-24R', width:24, height:34.25, depth:24, panelReady:true, ss:true, msrp:2255, features:['Undercounter Refrigerator'] },
  // Sub-Zero Additional Models
  { id:'sz-cl4250ufd', brand:'subzero', type:'refrigerator', subtype:'french-door', model:'CL4250UFD', width:42, height:84, depth:24, panelReady:true, ss:true, msrp:12000, builtIn:true, features:['42" French Door','24.7 cu ft','Panel-ready'] },
  { id:'sz-cl3650u', brand:'subzero', type:'refrigerator', subtype:'over-under', model:'CL3650U', width:36, height:84, depth:24, panelReady:true, ss:true, msrp:9000, builtIn:true, features:['36" Over-and-Under','Bottom Freezer','Panel-ready'] },

  // ──────────── WOLF COOKING ────────────
  // Wolf Pro Ranges
  { id:'wolf-gr304', brand:'wolf', type:'range', subtype:'pro', model:'GR304', width:30, height:36, depth:28.5, panelReady:false, ss:true, msrp:5699, fuel:'gas', features:['4 Burners','4.4 cu ft','Dual VertiFlow Convection'] },
  { id:'wolf-gr366', brand:'wolf', type:'range', subtype:'pro', model:'GR366', width:36, height:36, depth:28.375, panelReady:false, ss:true, msrp:8999, fuel:'gas', features:['6 Burners','5.5 cu ft'] },
  { id:'wolf-df364g', brand:'wolf', type:'range', subtype:'pro', model:'DF364G', width:36, height:36, depth:28.5, panelReady:false, ss:true, msrp:8999, fuel:'dual', features:['4 Burners + Griddle','5.5 cu ft','Dual Fuel'] },
  { id:'wolf-df366', brand:'wolf', type:'range', subtype:'pro', model:'DF366', width:36, height:36, depth:29.5, panelReady:false, ss:true, msrp:8499, fuel:'dual', features:['6 Burners','5.5 cu ft','Dual Fuel'] },
  { id:'wolf-ir36550', brand:'wolf', type:'range', subtype:'pro', model:'IR36550', width:36, height:36, depth:28.25, panelReady:false, ss:true, msrp:8999, fuel:'induction', features:['6 Induction Zones','5.5 cu ft'] },
  { id:'wolf-df484dg', brand:'wolf', type:'range', subtype:'pro', model:'DF484DG', width:48, height:36, depth:28.5, panelReady:false, ss:true, msrp:12699, fuel:'dual', features:['4 Burners + Griddle + Grill','Double Oven','Dual Fuel'] },
  { id:'wolf-df486g', brand:'wolf', type:'range', subtype:'pro', model:'DF486G', width:48, height:36, depth:28.5, panelReady:false, ss:true, msrp:12199, fuel:'dual', features:['6 Burners + Griddle','Double Oven','Dual Fuel'] },
  { id:'wolf-df606dg', brand:'wolf', type:'range', subtype:'pro', model:'DF606DG', width:60, height:36, depth:28.5, panelReady:false, ss:true, msrp:16999, fuel:'dual', features:['6 Burners + Griddle + Grill','Double Oven','60"'] },
  // Wolf Rangetops
  { id:'wolf-srt304', brand:'wolf', type:'cooktop', subtype:'rangetop', model:'SRT304', width:30, height:9.5, depth:27, panelReady:false, ss:true, msrp:3500, fuel:'gas', features:['4 Sealed Burners','20K BTU'] },
  { id:'wolf-srt364g', brand:'wolf', type:'cooktop', subtype:'rangetop', model:'SRT364G', width:36, height:9.5, depth:27, panelReady:false, ss:true, msrp:4500, fuel:'gas', features:['4 Burners + Griddle','20K BTU'] },
  { id:'wolf-srt484cg', brand:'wolf', type:'cooktop', subtype:'rangetop', model:'SRT484CG', width:48, height:9.5, depth:27, panelReady:false, ss:true, msrp:6500, fuel:'gas', features:['4 Burners + Charbroiler + Griddle'] },
  // Wolf Wall Ovens
  { id:'wolf-so30', brand:'wolf', type:'wallOven', subtype:'single', model:'SO30PM/S/PH', width:30, height:28.75, depth:24, panelReady:false, ss:true, msrp:4200, features:['Single Oven','4.7 cu ft','Dual VertiFlow'] },
  { id:'wolf-do30', brand:'wolf', type:'wallOven', subtype:'double', model:'DO30PM/S/PH', width:30, height:51, depth:24, panelReady:false, ss:true, msrp:7230, features:['Double Oven','Dual VertiFlow'] },
  // Wolf Microwave
  { id:'wolf-mdd30', brand:'wolf', type:'microwave', subtype:'drawer', model:'MDD30PM/S', width:30, height:18.75, depth:24, panelReady:false, ss:true, msrp:2100, features:['Drawer Microwave','1.6 cu ft'] },
  { id:'wolf-mdd24', brand:'wolf', type:'microwave', subtype:'drawer', model:'MDD24', width:24, height:18.75, depth:24, panelReady:false, ss:true, msrp:1800, features:['24" Drawer Microwave'] },
  // Wolf Hood
  { id:'wolf-pw362210', brand:'wolf', type:'hood', subtype:'pro-wall', model:'PW362210', width:36, height:22, depth:10, panelReady:false, ss:true, msrp:2800, features:['Pro Wall Hood','600 CFM'] },
  { id:'wolf-pw482210', brand:'wolf', type:'hood', subtype:'pro-wall', model:'PW482210', width:48, height:22, depth:10, panelReady:false, ss:true, msrp:3200, features:['Pro Wall Hood','1200 CFM'] },

  // ──────────── COVE DISHWASHERS (Sub-Zero/Wolf Group) ────────────
  { id:'cove-dw2450ws', brand:'cove', type:'dishwasher', subtype:'panel-ready', model:'DW2450WS', width:24, height:34, depth:24, panelReady:true, ss:false, msrp:2599, features:['24" Panel Ready','40 dBA','TrueDry','Wi-Fi','3rd Rack','FlexFit'] },
  { id:'cove-dw2450', brand:'cove', type:'dishwasher', subtype:'stainless', model:'DW2450', width:24, height:34, depth:24, panelReady:false, ss:true, msrp:2399, features:['24" Stainless Steel','42 dBA','TrueDry','3rd Rack'] },

  // ──────────── THERMADOR ────────────
  // Thermador Pro Ranges
  { id:'therm-prd305whu', brand:'thermador', type:'range', subtype:'pro', model:'PRD305WHU', width:30, height:36, depth:24.75, panelReady:false, ss:true, msrp:5699, fuel:'dual', features:['5 Burners','4.6 cu ft','Dual Fuel'] },
  { id:'therm-prd364wdhu', brand:'thermador', type:'range', subtype:'pro', model:'PRD364WDHU', width:36, height:36, depth:24.75, panelReady:false, ss:true, msrp:8499, fuel:'dual', features:['4 Burners + Griddle','5.5 cu ft','Star Burner'] },
  { id:'therm-prd366whu', brand:'thermador', type:'range', subtype:'pro', model:'PRD366WHU', width:36, height:36, depth:24.75, panelReady:false, ss:true, msrp:7999, fuel:'dual', features:['6 Star Burners','5.5 cu ft'] },
  { id:'therm-prd484wdhu', brand:'thermador', type:'range', subtype:'pro', model:'PRD484WDHU', width:48, height:36, depth:24.75, panelReady:false, ss:true, msrp:11999, fuel:'dual', features:['4 Burners + Griddle','Double Oven','Star Burner'] },
  { id:'therm-prd486wdhu', brand:'thermador', type:'range', subtype:'pro', model:'PRD486WDHU', width:48, height:36, depth:24.75, panelReady:false, ss:true, msrp:11499, fuel:'dual', features:['6 Star Burners','Double Oven'] },
  { id:'therm-prd606wesg', brand:'thermador', type:'range', subtype:'pro', model:'PRD606WESG', width:60, height:36, depth:24.75, panelReady:false, ss:true, msrp:12699, fuel:'dual', features:['6 Burners + Griddle + Grill','60"'] },
  // Thermador Cooktops
  { id:'therm-sgsx305ts', brand:'thermador', type:'cooktop', subtype:'gas', model:'SGSX305TS', width:30, height:6.5, depth:21.25, panelReady:false, ss:true, msrp:2399, fuel:'gas', features:['5 Pedestal Star Burners','18K BTU'] },
  { id:'therm-sgsx365ts', brand:'thermador', type:'cooktop', subtype:'gas', model:'SGSX365TS', width:36, height:6.5, depth:21.25, panelReady:false, ss:true, msrp:2899, fuel:'gas', features:['5 Pedestal Star Burners','18K BTU'] },
  { id:'therm-cit367ygs', brand:'thermador', type:'cooktop', subtype:'induction', model:'CIT367YGS', width:36, height:4, depth:21.25, panelReady:false, ss:false, msrp:3199, fuel:'induction', features:['7 Flex Induction Zones','HomeConnect'] },
  // Thermador Wall Ovens
  { id:'therm-med301lws', brand:'thermador', type:'wallOven', subtype:'single', model:'MED301LWS', width:30, height:28.75, depth:24, panelReady:false, ss:true, msrp:3099, features:['Single Oven','4.5 cu ft','SoftClose Door'] },
  { id:'therm-med302lws', brand:'thermador', type:'wallOven', subtype:'double', model:'MED302LWS', width:30, height:50.5, depth:24, panelReady:false, ss:true, msrp:5699, features:['Double Oven','SoftClose','SoftOpen'] },
  { id:'therm-mecfs45es', brand:'thermador', type:'wallOven', subtype:'steam', model:'MECFS45ES', width:30, height:28.75, depth:24, panelReady:false, ss:true, msrp:5999, features:['Steam Oven','Full Steam + Convection'] },
  // Thermador Refrigerator Columns (Freedom Collection)
  { id:'therm-t24ir905sp', brand:'thermador', type:'refrigerator', subtype:'column', model:'T24IR905SP', width:24, height:84, depth:24, panelReady:true, ss:false, msrp:5899, builtIn:true, features:['24" Freedom Column','Panel Ready'] },
  { id:'therm-t30ir905sp', brand:'thermador', type:'refrigerator', subtype:'column', model:'T30IR905SP', width:30, height:84, depth:24, panelReady:true, ss:false, msrp:7099, builtIn:true, features:['30" Freedom Column','16.8 cu ft'] },
  { id:'therm-t36ir905sp', brand:'thermador', type:'refrigerator', subtype:'column', model:'T36IR905SP', width:36, height:84, depth:24, panelReady:true, ss:false, msrp:8099, builtIn:true, features:['36" Freedom Column','20.6 cu ft'] },
  { id:'therm-t24if905sp', brand:'thermador', type:'freezer', subtype:'column', model:'T24IF905SP', width:24, height:84, depth:24, panelReady:true, ss:false, msrp:5699, builtIn:true, features:['24" Freedom Freezer Column'] },
  { id:'therm-t36if905sp', brand:'thermador', type:'freezer', subtype:'column', model:'T36IF905SP', width:36, height:84, depth:24, panelReady:true, ss:false, msrp:9099, builtIn:true, features:['36" Freedom Freezer Column'] },
  // Thermador Additional Refrigerator Models
  { id:'therm-t36ft820ns', brand:'thermador', type:'refrigerator', subtype:'french-door', model:'T36FT820NS', width:36, height:83.75, depth:24, panelReady:false, ss:true, msrp:8500, builtIn:true, features:['36" French Door','Stainless','20.8 cu ft'] },
  { id:'therm-it100np', brand:'thermador', type:'refrigerator', subtype:'french-door', model:'IT100NP', width:36, height:83.75, depth:24, panelReady:true, ss:false, msrp:9000, builtIn:true, features:['36" French Door','Panel-Ready','Integrated'] },
  { id:'therm-t42it100np', brand:'thermador', type:'refrigerator', subtype:'french-door', model:'T42IT100NP', width:42, height:84, depth:24, panelReady:true, ss:false, msrp:11000, builtIn:true, features:['42" French Door','Panel-Ready','23.9 cu ft'] },
  // Thermador Dishwashers
  { id:'therm-dwhd870wfp', brand:'thermador', type:'dishwasher', subtype:'star-sapphire', model:'DWHD870WFP', width:24, height:33.875, depth:24, panelReady:true, ss:true, msrp:2799, features:['Star Sapphire','42 dBA','WiFi','StarDry'] },
  { id:'therm-dwhd660wfp', brand:'thermador', type:'dishwasher', subtype:'sapphire', model:'DWHD660WFP', width:24, height:33.875, depth:24, panelReady:true, ss:true, msrp:2199, features:['Sapphire','44 dBA','StarDry'] },
  { id:'therm-dwhd560cfp', brand:'thermador', type:'dishwasher', subtype:'emerald', model:'DWHD560CFP', width:24, height:33.875, depth:24, panelReady:true, ss:true, msrp:1599, features:['Emerald','48 dBA','24/7 Aqua Stop'] },

  // ──────────── FISHER & PAYKEL ────────────
  // F&P Ranges
  { id:'fp-rhv3484n', brand:'fisherPaykel', type:'range', subtype:'pro', model:'RHV3-484-N', width:48, height:35.75, depth:29.125, panelReady:false, ss:true, msrp:17149, fuel:'hybrid', features:['4 Gas + 4 Induction','Twin Ovens','6.9 cu ft'] },
  { id:'fp-riv3486', brand:'fisherPaykel', type:'range', subtype:'pro', model:'RIV3-486', width:48, height:35.75, depth:29.125, panelReady:false, ss:true, msrp:16849, fuel:'induction', features:['Full Induction','Twin Convection Ovens'] },
  { id:'fp-rgv3305n', brand:'fisherPaykel', type:'range', subtype:'pro', model:'RGV3-305-N', width:30, height:35.75, depth:28, panelReady:false, ss:true, msrp:4999, fuel:'gas', features:['5 Burners','4.9 cu ft'] },
  { id:'fp-rgv3366n', brand:'fisherPaykel', type:'range', subtype:'pro', model:'RGV3-366-N', width:36, height:35.75, depth:28, panelReady:false, ss:true, msrp:6999, fuel:'gas', features:['6 Burners','5.3 cu ft'] },
  // F&P Refrigeration
  { id:'fp-rs2484sr', brand:'fisherPaykel', type:'refrigerator', subtype:'column', model:'RS2484SRHE1', width:24, height:84, depth:24.5, panelReady:true, ss:false, msrp:5999, builtIn:true, features:['24" Column','ActiveSmart','Series 11'] },
  { id:'fp-rs3084wr', brand:'fisherPaykel', type:'refrigerator', subtype:'column', model:'RS3084WRUE1', width:30, height:84, depth:24.5, panelReady:true, ss:false, msrp:7999, builtIn:true, features:['30" Column','Ice & Water','Series 11'] },
  { id:'fp-rs3684wr', brand:'fisherPaykel', type:'refrigerator', subtype:'column', model:'RS3684WRUVE1', width:36, height:84, depth:24, panelReady:true, ss:false, msrp:10499, builtIn:true, features:['36" Integrated Bottom Mount','19.2 cu ft','Ice & Water'] },
  // F&P DishDrawer
  { id:'fp-dd24sax9', brand:'fisherPaykel', type:'dishwasher', subtype:'single-drawer', model:'DD24SAX9-N', width:24, height:16.25, depth:22.5, panelReady:false, ss:true, msrp:1099, features:['Single DishDrawer','SmartDrive'] },
  { id:'fp-dd24dax9', brand:'fisherPaykel', type:'dishwasher', subtype:'double-drawer', model:'DD24DAX9-N', width:24, height:32.5, depth:22.5, panelReady:false, ss:true, msrp:1599, features:['Double DishDrawer','Independent Drawers'] },
  { id:'fp-dd24dtx6', brand:'fisherPaykel', type:'dishwasher', subtype:'tall-double', model:'DD24DTX6PX1', width:24, height:34, depth:22.5, panelReady:true, ss:true, msrp:2199, features:['Tall Double DishDrawer','Professional','Panel Ready'] },
  // F&P Cooktops
  { id:'fp-cdv3365hn', brand:'fisherPaykel', type:'cooktop', subtype:'gas', model:'CDV3365HN', width:36, height:5.5, depth:21, panelReady:false, ss:true, msrp:2999, fuel:'gas', features:['5 Burners','20K BTU'] },
  { id:'fp-ci365dtb4', brand:'fisherPaykel', type:'cooktop', subtype:'induction', model:'CI365DTB4', width:36, height:4.5, depth:21, panelReady:false, ss:false, msrp:2499, fuel:'induction', features:['5 Zones','SmartZone'] },

  // ──────────── MIELE ────────────
  // Miele Ranges
  { id:'miele-hr14223i', brand:'miele', type:'range', subtype:'pro', model:'HR 1422-3 I', width:30, height:36, depth:27.5, panelReady:false, ss:true, msrp:5499, fuel:'gas', features:['TwinPower Convection','SoftClose'] },
  { id:'miele-hr19362g', brand:'miele', type:'range', subtype:'pro', model:'HR 1936-2 G', width:36, height:36, depth:27.5, panelReady:false, ss:true, msrp:8899, fuel:'gas', features:['6 Burners','M Touch'] },
  { id:'miele-hr1956g48', brand:'miele', type:'range', subtype:'pro', model:'HR 1956-3 G', width:48, height:36, depth:27.5, panelReady:false, ss:true, msrp:17999, fuel:'dual', features:['3-Door Design','Speed Oven','Warming Drawer'] },
  // Miele Ovens
  { id:'miele-h7280bp', brand:'miele', type:'wallOven', subtype:'single', model:'H 7280 BP', width:30, height:28.625, depth:24.625, panelReady:true, ss:true, msrp:4499, features:['PureLine Convection','TwinPower'] },
  { id:'miele-h7780bp', brand:'miele', type:'wallOven', subtype:'single', model:'H 7780 BP', width:30, height:28.625, depth:24.625, panelReady:true, ss:true, msrp:5999, features:['Premium Convection','M Touch'] },
  { id:'miele-h7240bm', brand:'miele', type:'wallOven', subtype:'speed', model:'H 7240 BM', width:24, height:18, depth:22, panelReady:true, ss:true, msrp:3999, features:['Speed Oven','Microwave + Convection'] },
  // Miele Cooktops
  { id:'miele-km2355g', brand:'miele', type:'cooktop', subtype:'gas', model:'KM 2355 G', width:36, height:3, depth:20.25, panelReady:false, ss:true, msrp:2999, fuel:'gas', features:['5 Burners','ComfortClean Grates'] },
  { id:'miele-km7745', brand:'miele', type:'cooktop', subtype:'induction', model:'KM 7745', width:36, height:4.125, depth:21.25, panelReady:false, ss:false, msrp:3599, fuel:'induction', features:['6 Cooking Zones','PowerFlex'] },
  { id:'miele-km7720fr', brand:'miele', type:'cooktop', subtype:'induction', model:'KM 7720 FR', width:24, height:3.5, depth:20, panelReady:false, ss:false, msrp:2199, fuel:'induction', features:['Flush-Mounted','4 Zones'] },
  // Miele Dishwashers
  { id:'miele-g7186scvi', brand:'miele', type:'dishwasher', subtype:'panel-ready', model:'G 7186 SCVi', width:24, height:33.5, depth:22.5, panelReady:true, ss:false, msrp:2499, features:['38 dBA','AutoDos','Panel Ready'] },
  { id:'miele-g7266scvi', brand:'miele', type:'dishwasher', subtype:'panel-ready', model:'G 7266 SCVi', width:24, height:33.5, depth:22.5, panelReady:true, ss:false, msrp:1999, features:['42 dBA','AutoDos','Panel Ready'] },
  { id:'miele-g7366scvi', brand:'miele', type:'dishwasher', subtype:'panel-ready', model:'G 7366 SCVi', width:24, height:33.5, depth:22.5, panelReady:true, ss:false, msrp:1799, features:['44 dBA','Panel Ready','3D MultiFlex Tray'] },
  // Miele Refrigeration
  { id:'miele-kfnf9959ide', brand:'miele', type:'refrigerator', subtype:'french-door', model:'KFNF 9959 iDE', width:36, height:84, depth:24, panelReady:true, ss:false, msrp:9500, builtIn:true, features:['36" French Door','Panel-Ready','18.9 cu ft'] },
  { id:'miele-kf2912vi', brand:'miele', type:'refrigerator', subtype:'column', model:'KF 2912 VI', width:36, height:84, depth:24, panelReady:true, ss:false, msrp:8999, builtIn:true, features:['MasterCool','NoFrost','Panel Ready'] },
  { id:'miele-kf2982vi', brand:'miele', type:'refrigerator', subtype:'french-door', model:'KF 2982 VI', width:36, height:84, depth:24, panelReady:true, ss:false, msrp:9299, builtIn:true, features:['French Door','MasterCool','19.5 cu ft'] },

  // ──────────── KITCHENAID ────────────
  // KitchenAid Ranges
  { id:'ka-kfdc558jss', brand:'kitchenaid', type:'range', subtype:'commercial', model:'KFDC558JSS', width:48, height:36, depth:30.25, panelReady:false, ss:true, msrp:9576, fuel:'dual', features:['Griddle','Smart','6.3 cu ft','Even-Heat Convection'] },
  { id:'ka-kfgs936', brand:'kitchenaid', type:'range', subtype:'commercial', model:'KFGS936SSS', width:36, height:36, depth:28, panelReady:false, ss:true, msrp:5999, fuel:'gas', features:['6 Burners','5.1 cu ft','Even-Heat Convection'] },
  { id:'ka-kfgs930', brand:'kitchenaid', type:'range', subtype:'commercial', model:'KFGS930SSS', width:30, height:36, depth:28, panelReady:false, ss:true, msrp:4499, fuel:'gas', features:['4 Burners','4.1 cu ft'] },
  // KitchenAid Refrigerators
  { id:'ka-krfc136rps', brand:'kitchenaid', type:'refrigerator', subtype:'french-door', model:'KRFC136RPS', width:36, height:70, depth:24, panelReady:false, ss:true, msrp:2800, builtIn:false, features:['36" Counter-Depth','Freestanding','20 cu ft'] },
  { id:'ka-kbsd706mps', brand:'kitchenaid', type:'refrigerator', subtype:'side-by-side', model:'KBSD706MPS', width:36, height:84, depth:24, panelReady:false, ss:true, msrp:8999, builtIn:true, features:['20.8 cu ft','Built-In','PrintShield'] },
  { id:'ka-kbfn506epa', brand:'kitchenaid', type:'refrigerator', subtype:'french-door', model:'KBFN506EPA', width:36, height:84, depth:24, panelReady:true, ss:false, msrp:8999, builtIn:true, features:['20.8 cu ft','Panel Ready','French Door'] },
  { id:'ka-kbsn702mpa', brand:'kitchenaid', type:'refrigerator', subtype:'side-by-side', model:'KBSN702MPA', width:42, height:84, depth:24, panelReady:true, ss:false, msrp:10500, builtIn:true, features:['25.5 cu ft','Panel Ready'] },
  { id:'ka-kbsd708mss', brand:'kitchenaid', type:'refrigerator', subtype:'side-by-side', model:'KBSD708MSS', width:48, height:84, depth:24, panelReady:false, ss:true, msrp:11000, builtIn:true, features:['29.4 cu ft','48"'] },
  // KitchenAid Dishwashers
  { id:'ka-kdtf324ppa', brand:'kitchenaid', type:'dishwasher', subtype:'panel-ready', model:'KDTF324PPA', width:24, height:33.5, depth:24.75, panelReady:true, ss:false, msrp:1299, features:['44 dBA','ProWash','Door-Open Dry'] },
  { id:'ka-kdfe204kps', brand:'kitchenaid', type:'dishwasher', subtype:'stainless', model:'KDFE204KPS', width:24, height:33.5, depth:24.75, panelReady:false, ss:true, msrp:1099, features:['39 dBA','ProWash','3rd Rack','PrintShield'] },
  // KitchenAid Wall Ovens
  { id:'ka-kose500ess', brand:'kitchenaid', type:'wallOven', subtype:'single', model:'KOSE500ESS', width:30, height:28.75, depth:27.125, panelReady:false, ss:true, msrp:2999, features:['Even-Heat Convection','5.0 cu ft'] },
  { id:'ka-koed527pss', brand:'kitchenaid', type:'wallOven', subtype:'double', model:'KOED527PSS', width:27, height:50, depth:27.125, panelReady:false, ss:true, msrp:4599, features:['Air Fry Mode','Even-Heat Convection'] },
  // KitchenAid Cooktops
  { id:'ka-kcgs550ess', brand:'kitchenaid', type:'cooktop', subtype:'gas', model:'KCGS550ESS', width:30, height:3.625, depth:21, panelReady:false, ss:true, msrp:1399, fuel:'gas', features:['5 Burners','17K BTU','Even-Heat Simmer'] },
  { id:'ka-kcgs356ess', brand:'kitchenaid', type:'cooktop', subtype:'gas', model:'KCGS356ESS', width:36, height:3.625, depth:21, panelReady:false, ss:true, msrp:1799, fuel:'gas', features:['5 Burners','ADA Compliant'] },

  // ──────────── GAGGENAU ────────────
  // priceNote: 'retail' = list price verified from an authorized US retailer;
  // 'map-est' = Gaggenau enforces MAP (no public price), value is an estimate.
  // Dimensions are standard built-in cutout sizes from Gaggenau planning docs.
  { id:'gag-vi492', brand:'gaggenau', type:'cooktop', subtype:'induction', model:'VI492613', width:36, height:4, depth:21.25, panelReady:false, ss:true, msrp:5499, priceNote:'map-est', fuel:'induction', features:['Vario 400','Flex Induction','5 Zones','Home Connect'] },
  { id:'gag-cx482', brand:'gaggenau', type:'cooktop', subtype:'induction', model:'CX482611', width:30, height:4, depth:21.25, panelReady:false, ss:true, msrp:8000, priceNote:'map-est', fuel:'induction', features:['400 Full-Surface Induction','Free Placement'] },
  { id:'gag-vg491', brand:'gaggenau', type:'cooktop', subtype:'gas', model:'VG491220', width:36, height:4.5, depth:21.25, panelReady:false, ss:true, msrp:4500, priceNote:'map-est', fuel:'gas', features:['Vario 400 Gas','Wok Burner'] },
  { id:'gag-vi462', brand:'gaggenau', type:'cooktop', subtype:'induction', model:'VI462613', width:30, height:4, depth:21.25, panelReady:false, ss:true, msrp:4800, priceNote:'map-est', fuel:'induction', features:['Vario 400 Induction'] },
  { id:'gag-ci282', brand:'gaggenau', type:'cooktop', subtype:'induction', model:'CI282602', width:30, height:3.75, depth:20.25, panelReady:false, ss:false, msrp:4499, priceNote:'retail', fuel:'induction', features:['200 Flex Induction','TwistPad','Home Connect'] },
  { id:'gag-bo481', brand:'gaggenau', type:'wallOven', subtype:'single', model:'BO481611', width:30, height:28.75, depth:24, panelReady:false, ss:true, msrp:8440, priceNote:'retail', features:['400 Single Oven','Auto Door','Pyrolytic','TFT Display'] },
  { id:'gag-bs484', brand:'gaggenau', type:'steamOven', subtype:'combi-steam', model:'BS484612', width:30, height:28.75, depth:24, panelReady:false, ss:true, msrp:10500, priceNote:'map-est', features:['400 Combi-Steam','Plumbed','Sous-Vide'] },
  { id:'gag-bm484', brand:'gaggenau', type:'speedOven', subtype:'combi-microwave', model:'BM484710', width:30, height:18, depth:24, panelReady:false, ss:true, msrp:8200, priceNote:'map-est', features:['400 Combi-Microwave','Speed Oven'] },
  { id:'gag-ws482', brand:'gaggenau', type:'warmingDrawer', subtype:'warming', model:'WS482710', width:30, height:11, depth:24, panelReady:false, ss:true, msrp:2400, priceNote:'map-est', features:['400 Warming Drawer'] },
  { id:'gag-dv461', brand:'gaggenau', type:'warmingDrawer', subtype:'vacuum', model:'DV461100', width:24, height:5.5, depth:24, panelReady:false, ss:true, msrp:3500, priceNote:'map-est', features:['400 Vacuuming Drawer','Sous-Vide Seal'] },
  { id:'gag-bop220', brand:'gaggenau', type:'wallOven', subtype:'single', model:'BOP220612', width:30, height:28.75, depth:24, panelReady:false, ss:true, msrp:3700, priceNote:'map-est', features:['200 Single Oven','Pyrolytic'] },
  { id:'gag-rc462', brand:'gaggenau', type:'refrigerator', subtype:'column', model:'RC462704', width:24, height:84, depth:24, panelReady:true, ss:false, msrp:8000, priceNote:'map-est', builtIn:true, features:['24" 400 Refrigeration Column','Integrated'] },
  { id:'gag-rc472', brand:'gaggenau', type:'refrigerator', subtype:'column', model:'RC472704', width:30, height:84, depth:24, panelReady:true, ss:false, msrp:9500, priceNote:'map-est', builtIn:true, features:['30" 400 Refrigeration Column'] },
  { id:'gag-rc492', brand:'gaggenau', type:'refrigerator', subtype:'column', model:'RC492704', width:36, height:84, depth:24, panelReady:true, ss:false, msrp:11000, priceNote:'map-est', builtIn:true, features:['36" 400 Refrigeration Column'] },
  { id:'gag-rf461', brand:'gaggenau', type:'freezer', subtype:'column', model:'RF461705', width:24, height:84, depth:24, panelReady:true, ss:false, msrp:8200, priceNote:'map-est', builtIn:true, features:['24" 400 Freezer Column','Ice Maker'] },
  { id:'gag-rf471', brand:'gaggenau', type:'freezer', subtype:'column', model:'RF471705', width:30, height:84, depth:24, panelReady:true, ss:false, msrp:9600, priceNote:'map-est', builtIn:true, features:['30" 400 Freezer Column'] },
  { id:'gag-rf411', brand:'gaggenau', type:'freezer', subtype:'column', model:'RF411705', width:18, height:84, depth:24, panelReady:true, ss:false, msrp:7000, priceNote:'map-est', builtIn:true, features:['18" 400 Freezer Column'] },
  { id:'gag-rw466', brand:'gaggenau', type:'wine', subtype:'column', model:'RW466365', width:24, height:84, depth:24, panelReady:true, ss:false, msrp:7500, priceNote:'map-est', builtIn:true, features:['24" 400 Wine Climate Column','2 Zones'] },
  { id:'gag-rw414', brand:'gaggenau', type:'wine', subtype:'column', model:'RW414365', width:18, height:84, depth:24, panelReady:true, ss:false, msrp:6500, priceNote:'map-est', builtIn:true, features:['18" 400 Wine Climate Column'] },
  { id:'gag-df480', brand:'gaggenau', type:'dishwasher', subtype:'panel-ready', model:'DF480701', width:24, height:34, depth:24, panelReady:true, ss:false, msrp:3899, priceNote:'retail', features:['400 Fully Integrated','42 dBA','Push-to-Open','3rd Rack','Home Connect'] },
  { id:'gag-df210', brand:'gaggenau', type:'dishwasher', subtype:'panel-ready', model:'DF210701', width:24, height:34, depth:24, panelReady:true, ss:false, msrp:2400, priceNote:'map-est', features:['200 Fully Integrated','Euro Tub','ADA'] },
  { id:'gag-cm470', brand:'gaggenau', type:'coffee', subtype:'built-in', model:'CM470711', width:24, height:17.9, depth:22, panelReady:false, ss:true, msrp:8500, priceNote:'map-est', features:['400 Fully Automatic Espresso','Plumbed','Bean-to-Cup'] },
  { id:'gag-cm450', brand:'gaggenau', type:'coffee', subtype:'built-in', model:'CM450710', width:24, height:17.9, depth:22, panelReady:false, ss:true, msrp:5500, priceNote:'map-est', features:['400 Automatic Coffee','Steam Clean'] },
  { id:'gag-aw442', brand:'gaggenau', type:'hood', subtype:'wall', model:'AW442720', width:48, height:18, depth:20, panelReady:false, ss:true, msrp:4500, priceNote:'map-est', features:['400 Wall Hood','48"','Stainless'] },
];

// ═══ APPLIANCE DESIGN RULES (from Eclipse Specs Reference) ═══
export const APPLIANCE_DESIGN_RULES = {
  // Counter-depth is the Eclipse default
  counterDepthDefault: true,
  counterDepthBodyDepth: 24,       // inches, body only
  counterDepthPlanningDepth: 27,   // inches, body + door + handle (safe planning dim)
  integratedPlanningDepth: 25,     // inches, for panel-ready units

  // Built-in fridge height
  builtInFridgeHeight: 84,         // Sub-Zero, Thermador, F&P, Miele integrated
  freestandingFridgeHeight: 70,    // KitchenAid counter-depth freestanding

  // Range depth by brand (body, excl handles)
  rangeDepthByBrand: {
    wolf: 28.5,           // 28.25-29.5" depending on model
    thermador: 24.75,     // Pro Harmony ~24.63" (nearly flush!)
    kitchenaid: 27.75,    // Commercial style
    fisherPaykel: 28,     // 27-29"
    miele: 27.5,          // 27-28"
  },

  // Range protrusion past 24" cabinets
  rangeProtrusionByBrand: {
    wolf: 5,              // ~4-5.5"
    thermador: 0.75,      // ~0.5" (nearly flush)
    kitchenaid: 3.75,     // ~3.75"
    fisherPaykel: 4,      // ~3-4"
    miele: 3.5,           // ~3-4"
  },

  // Hood sizing
  hoodMinWidth: (rangeWidth) => rangeWidth,        // at least as wide as range
  hoodRecommendedWidth: (rangeWidth) => rangeWidth + 6, // 3" wider per side

  // Hood mounting heights
  hoodAboveGas: { min: 30, max: 36 },
  hoodAboveElectric: { min: 24, max: 30 },
  hoodAboveProGas: { min: 36 },  // high-BTU pro ranges

  // Hood CFM
  hoodCFMForGas: (totalBTU) => Math.ceil(totalBTU / 10000) * 100,
  hoodCFMForWallMount: (cooktopWidthFt) => cooktopWidthFt * 100,
  hoodCFMForIsland: (cooktopWidthFt) => cooktopWidthFt * 150,

  // Wall oven installation
  wallOvenCenterHeight: { min: 42, max: 48 },  // from floor
  wallOvenMaxBottomHeight: 54,                   // never above this

  // DW standard cutout
  dwStandardCutout: { width: 24, height: 34, depth: 24 },
  dwSlimCutout: { width: 18, height: 34, depth: 23 },     // Miele 18"

  // Cooktop island rules
  islandCooktopMinDepth: 27,  // 21" cooktop + 3" rear + 3" front clearance
  islandCooktopIdealDepth: 36,

  // Thermador actual cooktop width (37" not 36")
  thermadorCooktopActualWidth: 37,

  // Panel-ready is Eclipse default
  panelReadyDefault: true,
};

// ═══ APPLIANCE TYPES ═══
export const APPLIANCE_TYPES = {
  refrigerator: { label: 'Refrigerator', icon: '🧊', required: true, defaultWidth: 36 },
  freezer: { label: 'Freezer', icon: '❄️', required: false, defaultWidth: 24 },
  range: { label: 'Range', icon: '🔥', required: true, defaultWidth: 36 },
  cooktop: { label: 'Cooktop', icon: '♨️', required: false, defaultWidth: 36 },
  wallOven: { label: 'Wall Oven', icon: '📦', required: false, defaultWidth: 30 },
  dishwasher: { label: 'Dishwasher', icon: '💧', required: true, defaultWidth: 24 },
  microwave: { label: 'Microwave', icon: '📡', required: false, defaultWidth: 30 },
  hood: { label: 'Range Hood', icon: '💨', required: false, defaultWidth: 36 },
  wine: { label: 'Wine Column', icon: '🍷', required: false, defaultWidth: 24 },
  sink: { label: 'Sink', icon: '🚰', required: true, defaultWidth: 33 },
};

// ═══ STANDARD SINK OPTIONS ═══
export const SINKS = [
  { id: 'sink-ss-33', name: 'Stainless Undermount 33"', width: 33, depth: 22, material: 'stainless', msrp: 450 },
  { id: 'sink-ss-36', name: 'Stainless Undermount 36"', width: 36, depth: 22, material: 'stainless', msrp: 550 },
  { id: 'sink-farm-33', name: 'Farmhouse Apron 33"', width: 33, depth: 22, material: 'fireclay', msrp: 1200 },
  { id: 'sink-farm-36', name: 'Farmhouse Apron 36"', width: 36, depth: 22, material: 'fireclay', msrp: 1400 },
  { id: 'sink-granite-33', name: 'Granite Composite 33"', width: 33, depth: 22, material: 'granite', msrp: 650 },
  { id: 'sink-bar-15', name: 'Bar/Prep Sink 15"', width: 15, depth: 18, material: 'stainless', msrp: 250 },
  // Bathroom sinks
  { id: 'sink-vanity-under', name: 'Undermount Vanity', width: 20, depth: 17, material: 'porcelain', msrp: 350, bath: true },
  { id: 'sink-vessel', name: 'Vessel Sink', width: 16, depth: 16, material: 'porcelain', msrp: 450, bath: true },
  { id: 'sink-pedestal', name: 'Pedestal Sink', width: 24, depth: 20, material: 'porcelain', msrp: 550, bath: true },
  { id: 'sink-wall', name: 'Wall-Mount Sink', width: 18, depth: 15, material: 'porcelain', msrp: 400, bath: true },
];

// ═══ HELPERS ═══
export function filterAppliances(opts = {}) {
  let list = APPLIANCES;
  if (opts.brand) list = list.filter(a => a.brand === opts.brand);
  if (opts.type) list = list.filter(a => a.type === opts.type);
  if (opts.width) list = list.filter(a => a.width === opts.width);
  if (opts.panelReady !== undefined) list = list.filter(a => a.panelReady === opts.panelReady);
  if (opts.maxPrice) list = list.filter(a => typeof a.msrp === 'number' && a.msrp <= opts.maxPrice);
  return list;
}

export function getApplianceById(id) {
  return APPLIANCES.find(a => a.id === id);
}

export function getBrandName(brandId) {
  return APPLIANCE_BRANDS.find(b => b.id === brandId)?.name || brandId;
}

export function getWidthOptions(type) {
  const widths = [...new Set(APPLIANCES.filter(a => a.type === type).map(a => a.width))];
  return widths.sort((a, b) => a - b);
}
