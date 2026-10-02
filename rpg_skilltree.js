/* =========================================================================
   DRAGONEER — rpg_skilltree.js
   Skill trees for the four archetypes. Pure data + helpers (no Firebase).
   Every level = +1 skill token. You may own ONE node per row: buying a node
   locks the rest of its row and unlocks the next row. Any node in a row can be
   picked (no column restrictions); you just can never go back up.
   Node format: "Name|cost|code"  code: M#=+Mana  H#=+HP  D#=+Damage
                A<mana>:<dmg> = new attack costing <mana> that deals +<dmg> over a basic attack
   ========================================================================= */
const T = (rows, linked=false)=> ({ rows, linked });

export const SKILL_TREES = {
  fire: { ...T([
    ["Ember Heart|1|M5","Scorching Blood|1|H5","Burning Fist|1|D1"],
    ["Kindled Soul|1|M5","Coal-Forged Body|1|H8","Flickering Flame|1|D1"],
    ["Furnace Within|2|M10","Charred Flesh|2|H10","Blazing Hands|2|D2"],
    ["Flame Channeler|2|M10","Firebrand|2|D2","Magma Blood|2|H12","Smoldering Strength|2|D2"],
    ["Crimson Flame|2|D2","Blazing Core|2|M10","Molten Heart|2|H15","Infernal Force|2|D2"],
    ["Firebolt|3|A10:12","Ashen Reservoir|2|M15","Volcanic Frame|2|H15","Hellfire Strength|3|D3"],
    ["Flame Mastery|2|D2","Endless Ember|2|M10","Obsidian Flesh|2|H15","Infernal Might|2|D3"],
    ["Scarlet Inferno|3|D3","Great Furnace|3|M15","Mountain of Ash|3|H20","Demonfire|3|D3"],
    ["Meteor Burst|3|A20:25","Eternal Flame|3|M15","Titan's Ember|3|H20","Apocalypse Force|3|D4"],
    ["Inferno Mastery|3|D3","Sunfire Reservoir|3|M20","Living Volcano|3|H20","Hellstorm|3|D4"],
    ["Grand Inferno|3|D4","Solar Furnace|3|M20","Volcanic Colossus|3|H25","Worldfire|3|D4"],
    ["Supernova|4|A30:40","Eternal Inferno|4|M25","Heart of the Volcano|4|H30","Lord of Flame|4|D5"],
  ], false), title:"Fire Skill Tree", sub:"Highest damage growth, aggressive paths and a smaller high-HP path.", icon:"🔥", rowNames:{1:"The First Flame",2:"Kindling",3:"Rising Heat",4:"The Fire Splits",6:"First Major Choice",9:"Second Major Choice",12:"Final Flame"} },

  air: { ...T([
    ["Gentle Breeze|1|M5","Skybound Heart|1|D1","Windborne Body|1|H5"],
    ["Open Skies|1|M5","Cutting Wind|1|D1","Feathered Soul|1|M5"],
    ["Highwind|2|M10","Razor Gale|2|D2","Cloudstep|2|H8","Sky's Gift|2|M10"],
    ["Windcaller|2|M10","Cyclone Edge|2|D2","Stormheart|2|M10","Skybreaker|2|D2"],
    ["Endless Current|2|M10","Gale Force|2|D2","Upper Atmosphere|2|M15","Tempest Soul|2|D2"],
    ["Wind Slash|3|A10:12","Jetstream|2|M15","Storm Runner|2|D3"],
    ["Razorwind|2|D3","Skywell|2|M15","Heaven's Breath|2|M15","Tempest Edge|2|D3"],
    ["Cyclone Heart|3|D3","Endless Sky|3|M20","Storm Soul|3|D3","Wind Titan|3|H15"],
    ["Cyclone|3|A20:25","Heavenly Reservoir|3|M20","Tempest Might|3|D4","Sky Guardian|3|H20"],
    ["Hurricane Force|3|D4","Infinite Wind|3|M20","Stormforged|3|D4"],
    ["Eye of the Storm|3|D5","Endless Horizon|3|M25","Heaven's Fury|3|D5","Celestial Breath|3|M20"],
    ["Divine Hurricane|4|A30:40","Infinite Atmosphere|4|M30","Storm Sovereign|4|D6","Heart of Heaven|4|H25"],
  ]), title:"Air Skill Tree", sub:"The lightest tree: lots of Mana and Damage, fewer HP upgrades.", icon:"🌪️", rowNames:{1:"First Breath",12:"Final Sky"} },

  water: { ...T([
    ["Gentle Current|1|M5","Deepwater Heart|1|H5","Flowing Power|1|D1"],
    ["Clear Spring|1|M5","Riverstone|1|H8","Waterforce|1|D1"],
    ["Deep Current|2|M10","Tidal Strength|2|D2","Oceanblood|2|H10","Endless Stream|2|M10"],
    ["Rushing River|2|M10","Crashing Wave|2|D2","Abyssal Heart|2|M15","Waterborne Soul|2|H10"],
    ["Ocean's Depth|2|M15","Tidal Force|2|D2","Bottomless Sea|2|M15","Drowning Strength|2|D3"],
    ["Water Spear|3|A10:12","Ocean Reservoir|2|M15","Undertow|2|H10"],
    ["Deepsea Force|2|D3","Abyssal Reservoir|2|M20","Leviathan Blood|2|H15","Crushing Current|2|D3"],
    ["Tidal Mastery|3|D3","Endless Ocean|3|M20","Sea Titan|3|H20","Abyssal Power|3|D3"],
    ["Tidal Crash|3|A20:25","Ocean of Mana|3|M25","Leviathan's Strength|3|D4","Deepsea Body|3|H20"],
    ["Crushing Tide|3|D4","Bottomless Reservoir|3|M25","Ocean's Wrath|3|D4","Abyss Walker|3|H20"],
    ["Tsunami Force|3|D5","World Ocean|3|M25","Leviathan's Might|3|D5","Ancient Sea|3|M25"],
    ["Ocean's End|4|A30:40","Infinite Abyss|4|M30","Leviathan's Wrath|4|D6","Heart of the Ocean|4|H30"],
  ]), title:"Water Skill Tree", sub:"The Mana-heavy archetype, balanced with HP and moderate Damage.", icon:"🌊", rowNames:{1:"First Drop",12:"The Deep"} },

  earth: { ...T([
    ["Pebble Heart|1|H5","Earthen Strength|1|D1","Stone Core|1|M5"],
    ["Solid Foundation|1|H8","Heavy Hands|1|D1","Grounded Soul|1|H5"],
    ["Granite Heart|2|H10","Stone Fist|2|D2","Deep Earth|2|H10","Buried Reservoir|2|M10"],
    ["Ironstone|2|H12","Boulder Force|2|D2","Mountain Blood|2|H15","Earthshaper|2|D2"],
    ["Granite Body|2|H15","Tremor Force|2|D3","Mountain Core|2|H15","Colossus Strength|2|D3"],
    ["Stone Spike|3|A10:12","Earth Reservoir|2|M10","Granite Soul|2|H15"],
    ["Boulder Mastery|2|D3","Ancient Stone|2|H15","Titan's Blood|2|H20","Earthshatter|2|D3"],
    ["Mountain's Might|3|D3","Continental Core|3|H20","Stone Colossus|3|H20","Tremor Heart|3|D4"],
    ["Earthquake|3|A20:25","Mountain Reservoir|3|M15","Titan Force|3|D4","Immovable Mountain|3|H25"],
    ["Seismic Power|3|D4","Earth's Depths|3|H20","Continental Strength|3|D4","Ancient Mountain|3|H25"],
    ["Worldshaker|3|D5","Heart of Stone|3|H25","Titan's Wrath|3|D5","Earth's Foundation|3|H30"],
    ["Meteorite|4|A30:40","World Pillar|4|H30","Earth's Fury|4|D6","Heart of the World|4|H35"],
  ]), title:"Earth Skill Tree", sub:"The highest HP potential and strong Damage, but little Mana.", icon:"🪨", rowNames:{1:"Stone Awakening",12:"The Colossus"} }
};

/* Parse once into nodes: { id, el, row, col, name, cost, kind, val, mana, parent } */
export const SKILL_NODES = {};
Object.keys(SKILL_TREES).forEach(el=>{
  const t = SKILL_TREES[el], list = [];
  t.rows.forEach((row, r)=> row.forEach((s, c)=>{
    const [name, cost, code] = s.split("|"), kind = code[0];
    const n = { id:`${el}_${r+1}_${c+1}`, el, row:r+1, col:c, name, cost:+cost, kind, parent:null };
    if(kind==="A"){ const [m,d] = code.slice(1).split(":"); n.mana=+m; n.val=+d; } else n.val = +code.slice(1);
    list.push(n);
  }));
  SKILL_NODES[el] = list;
});
export const SKILL_BY_ID = {};
Object.values(SKILL_NODES).forEach(l=> l.forEach(n=> SKILL_BY_ID[n.id] = n));

export function describeSkill(n){
  if(n.kind==="M") return `+${n.val} Max Mana`;
  if(n.kind==="H") return `+${n.val} Max HP`;
  if(n.kind==="D") return `+${n.val} Damage`;
  return `NEW ATTACK — costs ${n.mana} Mana, deals +${n.val} damage compared with a basic attack`;
}
