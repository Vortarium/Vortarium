/* =========================================================================
   DRAGONEER — rpg_skilltree.js
   Skill trees for the four archetypes (25 rows each). Pure data + helpers (no Firebase).
   Every level = +1 skill token. You may own ONE node per row: buying a node
   locks the rest of its row and unlocks the next row. Any node in a row can be
   picked (no column restrictions); you just can never go back up.
   Every row offers ONE of each basic upgrade (Damage, HP, Mana) — never two of the same kind —
   plus, in some rows, one extra: a stat boost, a healing spell, or one of the 3 big attacks.
   Node format: "Name|cost|code"
     M#=+Max Mana   H#=+Max HP   D#=+Damage
     S:<STAT>:<n>            = +n to SPEED / STRENGTH / CHARM / SMARTS  (+1 or +2)
     A<mana>:<dmg>           = new attack costing <mana> that deals +<dmg> over a basic attack
     L<mana>:<lo>-<hi>:<cd>  = attack that also HEALS lo-hi HP, usable once every <cd> of your moves
     N<mana>:<lo>-<hi>:<cd>:<hp> = attack that also restores lo-hi MANA but costs <hp> HP to cast, cooldown <cd> moves
   ========================================================================= */
export const SKILL_TREES = {
  fire: { rows:[
    ["Ember Edge|1|D1", "Ember Spark|1|M4", "Ember Heart|1|H3"],
    ["Scorching Well|1|M5", "Scorching Strike|1|D1", "Scorching Body|1|H4", "Phoenix Swiftness|2|S:SPEED:1"],
    ["Kindled Blood|1|H6", "Kindled Soul|1|M6", "Solar Might|2|S:STRENGTH:1", "Kindled Fury|1|D2"],
    ["Cinder Skin|1|H7", "Cinder Reservoir|1|M8", "Cinder Flame|1|D2"],
    ["Molten Flesh|2|H8", "Molten Fist|2|D2", "Molten Core|2|M9"],
    ["Blazing Edge|2|D3", "Blazing Spark|2|M11", "Blazing Heart|2|H10", "Firebolt|3|A25:15"],
    ["Ashen Body|2|H11", "Ashen Strike|2|D3", "Ashen Well|2|M12"],
    ["Searing Fury|2|D4", "Ember Mending|3|L40:50-65:2", "Searing Soul|2|M14", "Searing Blood|2|H13"],
    ["Radiant Allure|3|S:CHARM:1", "Infernal Reservoir|2|M15", "Infernal Skin|2|H14", "Infernal Flame|2|D4"],
    ["Crimson Flesh|2|H15", "Crimson Fist|2|D4", "Crimson Core|2|M17", "Spark Siphon|3|N10:25-32:2:40"],
    ["Hellfire Wit|4|S:SMARTS:2", "Smoldering Heart|2|H17", "Smoldering Edge|2|D5", "Smoldering Spark|2|M18"],
    ["Eternal Might|3|S:STRENGTH:1", "Volcanic Strike|2|D5", "Volcanic Body|2|H18", "Volcanic Well|2|M20"],
    ["Magma Blood|3|H20", "Meteor Burst|4|A50:35", "Magma Soul|3|M21", "Magma Fury|3|D6"],
    ["Ember Wit|4|S:SMARTS:1", "Phoenix Reservoir|3|M22", "Phoenix Skin|3|H21", "Phoenix Flame|3|D6"],
    ["Solar Core|3|M24", "Solar Fist|3|D6", "Solar Flesh|3|H22", "Cinder Focus|4|N15:32-42:3:60"],
    ["Obsidian Edge|3|D7", "Kindled Allure|4|S:CHARM:1", "Obsidian Spark|3|M25", "Obsidian Heart|3|H24"],
    ["Phoenix Rite|4|L70:65-85:3", "Pyre Body|3|H25", "Pyre Strike|3|D7", "Pyre Well|3|M27"],
    ["Brimstone Soul|3|M28", "Brimstone Fury|3|D7", "Brimstone Blood|3|H26"],
    ["Wildfire Skin|3|H28", "Wildfire Reservoir|3|M30", "Blazing Swiftness|5|S:SPEED:2", "Wildfire Flame|3|D8"],
    ["Furnace Flesh|3|H29", "Furnace Fist|3|D8", "Furnace Core|3|M31"],
    ["Radiant Spark|4|M33", "Radiant Heart|4|H30", "Supernova|5|A100:50", "Radiant Edge|4|D8"],
    ["Infernal Wit|5|S:SMARTS:1", "Scarlet Strike|4|D9", "Scarlet Well|4|M34", "Scarlet Body|4|H32"],
    ["Hellfire Fury|4|D9", "Hellfire Blood|4|H33", "Hellfire Soul|4|M36", "Rebirth Flame|5|L100:80-100:4"],
    ["Eternal Reservoir|4|M37", "Eternal Skin|4|H35", "Eternal Flame|4|D10"],
    ["Worldfire Flesh|4|H36", "Worldfire Core|4|M38", "Worldfire Fist|4|D10", "Solar Draw|5|N20:40-50:4:80"]
  ], linked:false, title:"Fire Skill Tree", sub:"Highest damage growth, aggressive paths and a smaller high-HP path.", icon:"🔥", rowNames:{ 1:"The First Flame", 6:"First Spell: Firebolt", 13:"Second Spell: Meteor Burst", 21:"Final Spell: Supernova", 25:"Final Flame" } },

  air: { rows:[
    ["Gentle Spirit|1|H2", "Zephyr Swiftness|3|S:SPEED:2", "Gentle Breeze|1|M5", "Gentle Strike|1|D1"],
    ["Upper Allure|2|S:CHARM:1", "Skybound Slash|1|D1", "Skybound Frame|1|H4", "Skybound Soul|1|M7"],
    ["Windborne Body|1|H5", "Windborne Well|1|M9", "Windborne Fury|1|D2"],
    ["Thunderhead Wit|2|S:SMARTS:1", "Open Breath|1|H6", "Open Sky|1|M11", "Open Gust|1|D2"],
    ["Soothing Breeze|3|L40:50-65:2", "Highwind Edge|2|D2", "Highwind Heart|2|H7", "Highwind Current|2|M13"],
    ["Cloudstep Breeze|2|M15", "Cloudstep Strike|2|D3", "Cloudstep Spirit|2|H8", "Wind Slash|3|A25:15"],
    ["Razor Frame|2|H9", "Razor Slash|2|D3", "Storm Might|3|S:STRENGTH:1", "Razor Soul|2|M18"],
    ["Boreal Wit|3|S:SMARTS:1", "Cyclone Well|2|M20", "Cyclone Body|2|H11", "Cyclone Fury|2|D3"],
    ["Stormheart Gust|2|D4", "Stormheart Breath|2|H12", "Breath of Focus|3|N10:25-32:2:40", "Stormheart Sky|2|M22"],
    ["Gale Current|2|M24", "Gale Edge|2|D4", "Gale Heart|2|H13"],
    ["Tempest Strike|2|D4", "Tempest Spirit|2|H14", "Healing Gale|3|L70:65-85:3", "Tempest Breeze|2|M26"],
    ["Jetstream Soul|2|M28", "Jetstream Slash|2|D5", "Jetstream Frame|2|H15"],
    ["Zephyr Fury|3|D5", "Zephyr Body|3|H16", "Cyclone|4|A50:35", "Zephyr Well|3|M30"],
    ["Upper Gust|3|D5", "Upper Breath|3|H17", "Upper Sky|3|M32"],
    ["Heaven's Current|3|M34", "Heaven's Heart|3|H19", "Sky Siphon|4|N15:32-42:3:60", "Heaven's Edge|3|D6"],
    ["Thunderhead Breeze|3|M36", "Thunderhead Strike|3|D6", "Thunderhead Spirit|3|H20"],
    ["Skyward Frame|3|H21", "Skyward Soul|3|M38", "Skyward Slash|3|D6", "Open Might|4|S:STRENGTH:1"],
    ["Featherlight Well|3|M40", "Featherlight Fury|3|D7", "Heaven's Mercy|4|L100:80-100:4", "Featherlight Body|3|H22"],
    ["Cloudstep Swiftness|4|S:SPEED:1", "Storm Sky|3|M42", "Storm Gust|3|D7", "Storm Breath|3|H23"],
    ["Razor Allure|4|S:CHARM:1", "Boreal Heart|3|H24", "Boreal Edge|3|D7", "Boreal Current|3|M45"],
    ["Cirrus Spirit|4|H25", "Cirrus Strike|4|D8", "Divine Hurricane|5|A100:50", "Cirrus Breeze|4|M47"],
    ["Celestial Frame|4|H27", "Celestial Soul|4|M49", "Celestial Slash|4|D8", "Aether Draw|5|N20:40-50:4:80"],
    ["Monsoon Body|4|H28", "Monsoon Fury|4|D8", "Monsoon Well|4|M51"],
    ["Eye of Breath|4|H29", "Eye of Gust|4|D9", "Eye of Sky|4|M53"],
    ["Infinite Edge|4|D9", "Jetstream Might|5|S:STRENGTH:1", "Infinite Current|4|M55", "Infinite Heart|4|H30"]
  ], linked:false, title:"Air Skill Tree", sub:"The lightest tree: lots of Mana and Damage, fewer HP upgrades.", icon:"🌪️", rowNames:{ 1:"First Breath", 6:"First Spell: Wind Slash", 13:"Second Spell: Cyclone", 21:"Final Spell: Divine Hurricane", 25:"Final Sky" } },

  water: { rows:[
    ["Gentle Spring|1|M6", "Gentle Crash|1|D1", "Gentle Hull|1|H4"],
    ["Deepwater Wave|1|D1", "Deepwater Depth|1|M8", "Deepwater Heart|1|H6"],
    ["Clear Force|1|D1", "Clear Stream|1|M10", "Clear Blood|1|H8"],
    ["Riverstone Tide|1|M12", "Riverstone Flesh|1|H10", "Riverstone Strike|1|D1"],
    ["Tidal Focus|3|N10:25-32:2:40", "Tidal Surge|2|D2", "Tidal Body|2|H11", "Tidal Reservoir|2|M15"],
    ["Rushing Spring|2|M17", "Rushing Hull|2|H13", "Water Spear|3|A25:15", "Rushing Crash|2|D2"],
    ["Oceanic Depth|2|M19", "Oceanic Wave|2|D2", "Oceanic Heart|2|H15"],
    ["Trench Might|3|S:STRENGTH:1", "Abyssal Blood|2|H17", "Abyssal Force|2|D3", "Abyssal Stream|2|M22"],
    ["Mending Stream|3|L40:50-65:2", "Drowning Flesh|2|H19", "Drowning Strike|2|D3", "Drowning Tide|2|M24"],
    ["Undertow Surge|2|D3", "Undertow Body|2|H20", "Undertow Reservoir|2|M26"],
    ["Leviathan Spring|2|M28", "Leviathan Crash|2|D3", "Leviathan Hull|2|H22", "Restoring Tide|3|L70:65-85:3"],
    ["Coral Depth|2|M31", "Boundless Allure|4|S:CHARM:2", "Coral Heart|2|H24", "Coral Wave|2|D4"],
    ["Brine Blood|3|H26", "Brine Stream|3|M33", "Tidal Crash|4|A50:35", "Brine Force|3|D4"],
    ["Sea Flesh|3|H28", "Gentle Swiftness|4|S:SPEED:1", "Sea Strike|3|D4", "Sea Tide|3|M35"],
    ["Crushing Surge|3|D4", "Crushing Reservoir|3|M38", "Crushing Body|3|H30", "Moonwell Draw|4|N15:32-42:3:60"],
    ["Mariner's Crash|3|D5", "Clear Wit|4|S:SMARTS:1", "Mariner's Spring|3|M40", "Mariner's Hull|3|H32"],
    ["Stormtide Wave|3|D5", "Stormtide Depth|3|M42", "Stormtide Heart|3|H33", "Riverstone Wit|5|S:SMARTS:2"],
    ["Glacial Blood|3|H35", "Glacial Stream|3|M44", "Glacial Force|3|D5"],
    ["Moonlit Tide|3|M47", "Moonlit Strike|3|D5", "Moonlit Flesh|3|H37", "Rushing Allure|4|S:CHARM:1"],
    ["Trench Reservoir|3|M49", "Deep Meditation|4|N20:40-50:4:80", "Trench Surge|3|D6", "Trench Body|3|H39"],
    ["Kraken Hull|4|H41", "Kraken Crash|4|D6", "Ocean's End|5|A100:50", "Kraken Spring|4|M51"],
    ["Tsunami Heart|4|H42", "Tsunami Depth|4|M54", "Tsunami Wave|4|D6", "Drowning Swiftness|6|S:SPEED:2"],
    ["Primordial Force|4|D6", "Undertow Might|6|S:STRENGTH:2", "Primordial Blood|4|H44", "Primordial Stream|4|M56"],
    ["Boundless Strike|4|D7", "Boundless Flesh|4|H46", "Boundless Tide|4|M58", "Spring of Life|5|L100:80-100:4"],
    ["Endless Surge|4|D7", "Endless Reservoir|4|M61", "Endless Body|4|H48", "Coral Allure|5|S:CHARM:1"]
  ], linked:false, title:"Water Skill Tree", sub:"The Mana-heavy archetype, balanced with HP and moderate Damage.", icon:"🌊", rowNames:{ 1:"First Drop", 6:"First Spell: Water Spear", 13:"Second Spell: Tidal Crash", 21:"Final Spell: Ocean's End", 25:"The Deep" } },

  earth: { rows:[
    ["Seismic Allure|2|S:CHARM:1", "Pebble Strike|1|D1", "Pebble Frame|1|H6", "Pebble Vein|1|M2"],
    ["Stone Heart|1|H9", "Stone Hands|1|D1", "Bedrock Wit|2|S:SMARTS:1", "Stone Well|1|M3"],
    ["Granite Core|1|H11", "Obsidian Swiftness|2|S:SPEED:1", "Granite Reservoir|1|M4", "Granite Might|1|D1"],
    ["Cavern Might|2|S:STRENGTH:1", "Solid Hide|1|H14", "Solid Force|1|D2", "Solid Seam|1|M4"],
    ["Crystal Focus|3|N10:25-32:2:40", "Ironstone Core|2|M5", "Ironstone Body|2|H17", "Ironstone Fist|2|D2"],
    ["Stone Spike|3|A25:15", "Boulder Vein|2|M6", "Boulder Frame|2|H20", "Boulder Strike|2|D2"],
    ["Monolith Swiftness|3|S:SPEED:1", "Mountain Well|2|M7", "Mountain Hands|2|D3", "Mountain Heart|2|H22"],
    ["Tremor Core|2|H25", "Tremor Might|2|D3", "Tremor Reservoir|2|M8", "Mossy Salve|3|L40:50-65:2"],
    ["Buried Force|2|D3", "Buried Hide|2|H28", "Buried Seam|2|M9"],
    ["Ancient Fist|2|D4", "Ancient Core|2|M10", "Ancient Body|2|H31"],
    ["Titan's Frame|2|H34", "Titan's Strike|2|D4", "Titan's Vein|2|M10", "Geode Draw|3|N15:32-42:3:60"],
    ["Continental Hands|2|D4", "Continental Heart|2|H36", "Continental Well|2|M11", "Unbreakable Might|3|S:STRENGTH:1"],
    ["Seismic Reservoir|3|M12", "Earthquake|4|A50:35", "Seismic Core|3|H39", "Seismic Might|3|D4"],
    ["Bedrock Hide|3|H42", "Bedrock Seam|3|M13", "Bedrock Force|3|D5"],
    ["Stone Mending|4|L70:65-85:3", "Obsidian Body|3|H44", "Obsidian Core|3|M14", "Obsidian Fist|3|D5"],
    ["Cavern Frame|3|H47", "Cavern Strike|3|D5", "Granite Allure|5|S:CHARM:2", "Cavern Vein|3|M14"],
    ["Basalt Well|3|M15", "Basalt Hands|3|D6", "Basalt Heart|3|H50"],
    ["Colossus Core|3|H53", "Colossus Reservoir|3|M16", "Ironstone Wit|4|S:SMARTS:1", "Colossus Might|3|D6"],
    ["Monolith Seam|3|M17", "Monolith Force|3|D6", "Monolith Hide|3|H56"],
    ["Quarry Body|3|H58", "Quarry Core|3|M18", "Quarry Fist|3|D6", "Ley Line|4|N20:40-50:4:80"],
    ["Meteorite|5|A100:50", "Geode Strike|4|D7", "Geode Vein|4|M19", "Geode Frame|4|H61"],
    ["Buried Allure|5|S:CHARM:1", "Tectonic Well|4|M20", "Tectonic Heart|4|H64", "Tectonic Hands|4|D7"],
    ["Life of the Mountain|5|L100:80-100:4", "Primeval Might|4|D7", "Primeval Reservoir|4|M20", "Primeval Core|4|H66"],
    ["Unbreakable Seam|4|M21", "Unbreakable Hide|4|H69", "Unbreakable Force|4|D8"],
    ["Worldshaker Fist|4|D8", "Worldshaker Core|4|M22", "Worldshaker Body|4|H72"]
  ], linked:false, title:"Earth Skill Tree", sub:"The highest HP potential and strong Damage, but little Mana.", icon:"🪨", rowNames:{ 1:"Stone Awakening", 6:"First Spell: Stone Spike", 13:"Second Spell: Earthquake", 21:"Final Spell: Meteorite", 25:"The Colossus" } }
};

/* Version of the tree layout. Accounts saved on an older layout are refunded once on login (see app.js). */
export const SKILL_TREE_VERSION = 2;
/* The OLD 12-row trees' Max HP / Max Mana nodes only (id -> kind+value), kept so old purchases can be refunded exactly. */
export const LEGACY_SKILL_HM = {"fire_1_1":"M5","fire_1_2":"H5","fire_2_1":"M5","fire_2_2":"H8","fire_3_1":"M10","fire_3_2":"H10","fire_4_1":"M10","fire_4_3":"H12","fire_5_2":"M10","fire_5_3":"H15","fire_6_2":"M15","fire_6_3":"H15","fire_7_2":"M10","fire_7_3":"H15","fire_8_2":"M15","fire_8_3":"H20","fire_9_2":"M15","fire_9_3":"H20","fire_10_2":"M20","fire_10_3":"H20","fire_11_2":"M20","fire_11_3":"H25","fire_12_2":"M25","fire_12_3":"H30","air_1_1":"M5","air_1_3":"H5","air_2_1":"M5","air_2_3":"M5","air_3_1":"M10","air_3_3":"H8","air_3_4":"M10","air_4_1":"M10","air_4_3":"M10","air_5_1":"M10","air_5_3":"M15","air_6_2":"M15","air_7_2":"M15","air_7_3":"M15","air_8_2":"M20","air_8_4":"H15","air_9_2":"M20","air_9_4":"H20","air_10_2":"M20","air_11_2":"M25","air_11_4":"M20","air_12_2":"M30","air_12_4":"H25","water_1_1":"M5","water_1_2":"H5","water_2_1":"M5","water_2_2":"H8","water_3_1":"M10","water_3_3":"H10","water_3_4":"M10","water_4_1":"M10","water_4_3":"M15","water_4_4":"H10","water_5_1":"M15","water_5_3":"M15","water_6_2":"M15","water_6_3":"H10","water_7_2":"M20","water_7_3":"H15","water_8_2":"M20","water_8_3":"H20","water_9_2":"M25","water_9_4":"H20","water_10_2":"M25","water_10_4":"H20","water_11_2":"M25","water_11_4":"M25","water_12_2":"M30","water_12_4":"H30","earth_1_1":"H5","earth_1_3":"M5","earth_2_1":"H8","earth_2_3":"H5","earth_3_1":"H10","earth_3_3":"H10","earth_3_4":"M10","earth_4_1":"H12","earth_4_3":"H15","earth_5_1":"H15","earth_5_3":"H15","earth_6_2":"M10","earth_6_3":"H15","earth_7_2":"H15","earth_7_3":"H20","earth_8_2":"H20","earth_8_3":"H20","earth_9_2":"M15","earth_9_4":"H25","earth_10_2":"H20","earth_10_4":"H25","earth_11_2":"H25","earth_11_4":"H30","earth_12_2":"H30","earth_12_4":"H35"};

/* Parse once into nodes: { id, el, row, col, name, cost, kind, val, mana, parent, ... } */
export const SKILL_NODES = {};
Object.keys(SKILL_TREES).forEach(el=>{
  const t = SKILL_TREES[el], list = [];
  t.rows.forEach((row, r)=> row.forEach((s, c)=>{
    const [name, cost, code] = s.split("|"), kind = code[0];
    const n = { id:`${el}_${r+1}_${c+1}`, el, row:r+1, col:c, name, cost:+cost, kind, parent:null };
    if(kind==="A"){ const [m,d] = code.slice(1).split(":"); n.mana=+m; n.val=+d; }
    else if(kind==="L" || kind==="N"){ const [m,range,cd,hp] = code.slice(1).split(":"), [lo,hi] = range.split("-"); n.mana=+m; n.lo=+lo; n.hi=+hi; n.cd=+cd; n.hpCost=+(hp||0); }
    else if(kind==="S"){ const [, stat, v] = code.split(":"); n.stat=stat; n.val=+v; }
    else n.val = +code.slice(1);
    list.push(n);
  }));
  SKILL_NODES[el] = list;
});
export const SKILL_BY_ID = {};
Object.values(SKILL_NODES).forEach(l=> l.forEach(n=> SKILL_BY_ID[n.id] = n));

/* Nodes that show up in the attack list in battle */
export const isSpellNode = n => n.kind==="A" || n.kind==="L" || n.kind==="N";

export function describeSkill(n){
  if(n.kind==="M") return `+${n.val} Max Mana`;
  if(n.kind==="H") return `+${n.val} Max HP`;
  if(n.kind==="D") return `+${n.val} Damage`;
  if(n.kind==="S") return `+${n.val} ${n.stat.charAt(0)+n.stat.slice(1).toLowerCase()}`;
  if(n.kind==="L") return `HEALING ATTACK — costs ${n.mana} Mana, a basic hit that also heals ${n.lo}-${n.hi} HP. Cooldown: ${n.cd} moves`;
  if(n.kind==="N") return `MANA ATTACK — costs ${n.mana} Mana AND ${n.hpCost} HP, a basic hit that also restores ${n.lo}-${n.hi} Mana. Cooldown: ${n.cd} moves`;
  return `NEW ATTACK — costs ${n.mana} Mana, deals +${n.val} damage compared with a basic attack`;
}
