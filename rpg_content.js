/* =========================================================================
   DRAGONEER — rpg_content.js
   Content expansion: 50 forageables, 30 minerals, 90 fish, potions, ~400 recipes,
   plus the job-mode rules and odds-pool helpers that power the Chance Sheet.
   Pure data + helpers (no Firebase / no game state) so rpg_app.js imports it.
   ========================================================================= */
const R = ["common","uncommon","rare","epic","legendary"];
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,"");

/* ---------- 44 new foraged items (+6 existing = 50) ---------- */
// [slug, name, type, rarity, sellPrice, description]
const FORAGE_NEW = [
  // common
  ["blackberry","Blackberries","consumable","common",3,"Sweet, finger-staining brambleberries."],
  ["blueberry","Blueberries","consumable","common",3,"Plump blue berries, still dewy."],
  ["raspberry","Raspberries","consumable","common",4,"Tart little jewels from a thorny bush."],
  ["hazelnut","Hazelnuts","consumable","common",4,"A crunchy handful of woodland nuts."],
  ["acorn","Acorns","material","common",2,"Oak seeds. Squirrels would be furious."],
  ["pinecone","Pine Cone","material","common",2,"Spiky and resinous. Burns well."],
  ["dandelion","Dandelion","material","common",3,"A cheerful yellow weed with surprising uses."],
  ["clover","Clover Patch","material","common",3,"Soft clover. Rarely, it has four leaves."],
  ["fourleafclover","Four-Leaf Clover","material","rare",33,"A genuine four-leaf clover. Luck potions are brewed from these."],
  ["wildgarlic","Wild Garlic","consumable","common",4,"Pungent forest garlic."],
  ["cattail","Cattail Reed","material","common",3,"A fuzzy marsh reed."],
  ["twigs","Dry Twigs","material","common",2,"A bundle of snappy kindling."],
  ["wildonion","Wild Onion","consumable","common",4,"Sharp and savory."],
  ["sorrel","Sorrel Leaves","consumable","common",3,"Lemony green leaves."],
  ["fiddlehead","Fiddlehead Fern","consumable","common",5,"A curled young fern, edible when cooked."],
  ["chestnut","Chestnuts","consumable","common",5,"Glossy brown nuts in a spiny husk."],
  ["moss","Moss Clump","material","common",2,"Cool, damp moss from a mossy log."],
  // uncommon
  ["elderberry","Elderberries","consumable","uncommon",9,"Dark berries said to ward off the sniffles."],
  ["honeycomb","Wild Honeycomb","consumable","uncommon",12,"Dripping with golden honey."],
  ["chanterelle","Chanterelle","consumable","uncommon",11,"A golden, trumpet-shaped mushroom."],
  ["morel","Morel Mushroom","consumable","uncommon",13,"A honeycombed spring mushroom."],
  ["lavender","Lavender","material","uncommon",9,"Calming purple blooms."],
  ["chamomile","Chamomile","material","uncommon",10,"Tiny daisy-like flowers with a soothing scent."],
  ["mint","Mint Leaves","material","uncommon",9,"Cool, bright, and very green."],
  ["sage","Sage","material","uncommon",10,"Silvery, earthy leaves."],
  ["wildplum","Wild Plum","consumable","uncommon",10,"Sweet-sour plum from a roadside tree."],
  ["crabapple","Crabapple","consumable","uncommon",8,"Tiny, puckery apples."],
  ["birchbark","Birch Bark","material","uncommon",8,"Papery bark that peels in curls."],
  ["pineresin","Pine Resin","material","uncommon",11,"Sticky amber goo."],
  // rare
  ["porcini","Porcini","consumable","rare",28,"A fat, nutty king of mushrooms."],
  ["ginseng","Wild Ginseng","material","rare",35,"A gnarled, potent root."],
  ["moonpetal","Moonpetal","material","rare",38,"Only opens under moonlight."],
  ["frostbloom","Frostbloom","material","rare",34,"A flower rimmed with permanent frost."],
  ["sunblossom","Sunblossom","material","rare",34,"Warm to the touch, even at night."],
  ["royaljelly","Royal Jelly","consumable","rare",40,"Rich, creamy, and unreasonably nourishing."],
  ["silverleaf","Silverleaf","material","rare",32,"Leaves that shimmer like coins."],
  ["ambersap","Amber Sap","material","rare",30,"Hardening tree sap with a glow inside."],
  ["saffron","Wild Saffron","material","rare",42,"Crimson threads worth their weight."],
  // epic
  ["dragonroot","Dragonroot","material","epic",85,"A scaly red root that hums when held."],
  ["starcap","Starcap Mushroom","consumable","epic",78,"Speckled like a night sky."],
  ["emberlotus","Ember Lotus","material","epic",90,"A flower that smolders but never burns out."],
  ["glowshroom","Glowshroom","consumable","epic",72,"Pulses with soft blue light."],
  ["mistwillow","Mistwillow Bark","material","epic",80,"Bark that is always faintly damp with fog."],
  // legendary
  ["heartwood","Heartwood Sprig","material","legendary",190,"A living twig from the heart of an ancient tree."],
  ["worldtreedew","World Tree Dew","consumable","legendary",210,"A single drop that fills a cup."]
];

/* ---------- 20 new minerals (+10 existing = 30 mineable) ---------- */
// [id, name, rarity, sellPrice, description]
const MINERAL_NEW = [
  ["rock_granite","Granite","common",4,"Speckled and sturdy building stone."],
  ["rock_limestone","Limestone","common",4,"Pale sedimentary rock."],
  ["rock_flint","Flint","common",5,"Sparks beautifully when struck."],
  ["rock_slate","Slate","common",5,"Flat, dark rock that splits into sheets."],
  ["ore_tin","Tin Ore","common",6,"Soft, silvery ore."],
  ["ore_lead","Lead Ore","common",6,"Heavy, dull grey ore."],
  ["ore_zinc","Zinc Ore","uncommon",13,"Bluish-white ore."],
  ["rock_obsidian","Obsidian","uncommon",16,"Glassy black volcanic rock."],
  ["gem_garnet","Garnet","uncommon",18,"A deep red gem."],
  ["gem_onyx","Onyx","uncommon",17,"A polished black gem."],
  ["gem_citrine","Citrine","uncommon",19,"A warm yellow quartz."],
  ["gem_peridot","Peridot","uncommon",20,"A lime-green gem."],
  ["ore_titanium","Titanium Ore","rare",44,"Light but astonishingly strong ore."],
  ["gem_amethyst","Amethyst","rare",48,"A violet crystal cluster."],
  ["gem_topaz","Topaz","rare",52,"A sparkling golden-orange gem."],
  ["gem_jade","Jade","rare",50,"A smooth green stone prized for luck."],
  ["ore_platinum","Platinum Ore","rare",105,"Dense, silvery-white precious ore."],
  ["gem_opal","Opal","epic",115,"Shifts through every color of the rainbow."],
  ["ore_mithril","Mythril Ore","epic",125,"Faintly glowing ore, light as a feather."],
  ["ore_adamantite","Adamantite Ore","legendary",340,"Nearly unbreakable ore. Your pickaxe winces."]
];
export const MINERAL_SELL = {   // what each mineral actually sells for (common ~7-15, uncommon ~24-49, rare ~64-114, epic 150-228, legendary 380-560)
  rock_granite:7, rock_limestone:8, ore_coal:8, rock_slate:8, rock_flint:10, ore_lead:13, ore_tin:14, ore_copper:15,
  ore_zinc:24, ore_iron:29, rock_obsidian:32, gem_garnet:34, gem_onyx:37, ore_silver:41, gem_citrine:44, gem_peridot:49,
  gem_amethyst:64, ore_titanium:77, gem_topaz:85, ore_gold:96, gem_jade:103, gem_quartz:70, gem_sapphire:114,
  gem_emerald:150, gem_ruby:176, ore_platinum:196, gem_opal:212, ore_mithril:228,
  gem_diamond:380, ore_adamantite:560
};
const MINERAL_LEGACY = ["ore_copper","ore_iron","ore_coal","gem_quartz","ore_silver","ore_gold","gem_ruby","gem_sapphire","gem_emerald","gem_diamond"];
const FORAGE_LEGACY = ["forage_berry","forage_mushroom","forage_herb","forage_apple","forage_truffle","forage_goldapple"];

/* ---------- 90 fish: 30 per difficulty (green = easy, yellow = medium, red = hard) ---------- */
const FISH_NAMES = {
  easy: ["Minnow","Bass","Trout","Sunfish","Perch","Bluegill","Carp","Catfish","Crappie","Roach","Chub","Dace","Bream","Tench","Goby","Shiner","Smelt","Sardine","Herring","Anchovy","Mackerel","Whitefish","Bullhead","Stickleback","Mudfish","Rudd","Gudgeon","Loach","Killifish","Grayling"],
  medium: ["Swordfish","Salmon","Walleye","Pike","Muskie","Snapper","Grouper","Flounder","Halibut","Cod","Haddock","Barracuda","Pompano","Mahi-Mahi","Sturgeon","Arctic Char","Steelhead","Tarpon","Bonito","Wahoo","Amberjack","Sea Bass","Redfish","Dorado","Yellowtail","Lionfish","Pufferfish","Moonfish","Lantern Fish","Eel"],
  hard: ["Golden Koi","Bluefin Tuna","Blue Marlin","Sailfish","Oarfish","Coelacanth","Anglerfish","Gulper Eel","Viperfish","Fangtooth","Hammerhead Shark","Tiger Shark","Great White","Whale Shark","Manta Ray","Ocean Sunfish","Arapaima","Goliath Tigerfish","Dragonfish","Ghost Carp","Crystal Trout","Rainbow Koi","Ember Eel","Frost Pike","Storm Marlin","Moon Koi","Void Angler","Phoenix Fish","Kraken Fry","Abyssal Leviathan"]
};
const FISH_LEGACY = { "Minnow":"fish_minnow","Bass":"fish_bass","Trout":"fish_trout","Swordfish":"fish_swordfish","Golden Koi":"fish_golden" };
const FISH_RARITY_LAYOUT = {
  easy:   [["common",12],["uncommon",10],["rare",6],["epic",2]],
  medium: [["common",3],["uncommon",9],["rare",10],["epic",6],["legendary",2]],
  hard:   [["rare",8],["epic",14],["legendary",8]]
};
const FISH_BASE_SELL = { common:6, uncommon:14, rare:35, epic:80, legendary:180 };
const FISH_TIER_MULT = { easy:1, medium:1.5, hard:2.2 };
const FISH_BLURB = {
  easy:   n=>`A ${n.toLowerCase()} from calm, shallow water. Easy to reel in.`,
  medium: n=>`A ${n.toLowerCase()} that fights back. Takes some skill to land.`,
  hard:   n=>`A ${n.toLowerCase()}: elusive, strong, and a real trophy catch.`
};


/* =========================================================================
   GEAR — every weapon and armor piece in the game lives here.
   100 weapons (20 per rarity) and 200 armor pieces (10 per body part per rarity).
   Everything is explicit data + deterministic maths, so all players see identical items.
   ========================================================================= */
export const WEAPON_DAMAGE = {          // [lowest, highest] attack in each rarity; the 20 weapons are spread evenly across it
  common:[1,8], uncommon:[5,20], rare:[15,45], epic:[40,100], legendary:[80,200]
};
const WEAPON_NAMES = {
  common:["Wooden Club","Stone Dagger","Sharpened Stick","Rusty Sword","Hunting Knife","Short Bow","Wooden Staff","Hand Axe","Slingshot","Bone Club",
          "Flint Spear","Farmer's Pitchfork","Iron Nail Bat","Cracked Mace","Fishing Spear","Practice Sword","Cudgel","Woodcutter's Axe","Reed Blowgun","Hatchet"],
  uncommon:["Birch Wand","Ash Staff","Brass Knuckles","Bronze Rapier","Sailor's Cutlass","Throwing Axe","Hunter's Spear","Oak Longbow","Crossbow","Spiked Mace",
            "Battle Axe","Warhammer","Scimitar","Morning Star","Guardsman's Halberd","Tempered Shortsword","Iron Cleaver","Iron Sword","Silver-Tipped Bow","Steel Dagger"],
  rare:["Enchanted Blade","Frostbite Dagger","Flameforged Axe","Stormcaller Bow","Moonsilver Spear","Thunder Mace","Runed Staff","Venomfang Dagger","Knight's Claymore","Windrunner Rapier",
        "Emberstrike Hammer","Tidal Trident","Shadowstep Katana","Crystal Wand","Ironbark Greataxe","Sunfire Scimitar","Hawkeye Longbow","Stonebreaker Maul","Glacier Pike","Phantom Chakram"],
  epic:["Dragonbone Sword","Voidpiercer Dagger","Inferno Greataxe","Tempest Warbow","Celestial Spear","Earthshaker Warhammer","Archmage Staff","Nightshade Katana","Soulreaver Scythe","Stormbringer Blade",
        "Obsidian Claymore","Leviathan Trident","Wyrmtooth Rapier","Starfall Wand","Titan's Cleaver","Bloodmoon Axe","Hellfire Crossbow","Frostfang Glaive","Thornlord Mace","Aether Chakram"],
  legendary:["Dragoneer's Edge","Sunforged Greatsword","Worldsplitter Axe","Eclipse Dagger","Heavenfall Spear","Ragnarok Hammer","Staff of Eternity","Phoenix Longbow","Voidlord's Scythe","Kraken's Wrath Trident",
             "Starlight Rapier","Doomcaller Mace","Primordial Katana","Wand of Creation","Oblivion Blade","Titanbane Glaive","Stormking's Warbow","Elderwyrm Fang","Ashen Crown Cleaver","Moonfall Chakram"]
};
const ARMOR_MATERIALS = {
  common:["Burlap","Leather","Wooden","Hide","Padded","Linen","Reed","Bone","Tin","Rawhide"],
  uncommon:["Studded","Oakbark","Wolfhide","Scaled","Ringed","Chainmail","Brass","Bronze","Hardened","Iron"],
  rare:["Silvered","Frostforged","Emberweave","Moonlit","Stormhide","Ironbark","Crystal","Jade","Shadowsilk","Steel"],
  epic:["Dragonscale","Obsidian","Voidweave","Starforged","Wyrmhide","Thunderplate","Bloodsteel","Celestial","Abyssal","Mythril"],
  legendary:["Divine","Eternal","Elderwyrm","Worldforged","Sunsteel","Eclipse","Primordial","Titanbone","Dragoneer's","Adamantine"]
};
const ARMOR_NOUNS = {   // the 10 pieces of each body part (index j = tier within the rarity, weakest to strongest)
  helmet:    ["Cap","Hood","Helm","Coif","Visor","Cowl","Circlet","Mask","Crown","Greathelm"],
  chestplate:["Vest","Tunic","Jerkin","Cuirass","Breastplate","Hauberk","Mantle","Brigandine","Plate","Chestguard"],
  leggings:  ["Trousers","Leggings","Greaves","Chaps","Legguards","Cuisses","Pants","Kilt","Legwraps","Tassets"],
  boots:     ["Sandals","Boots","Shoes","Treads","Sabatons","Stompers","Walkers","Slippers","Striders","Footguards"]
};
const ARMOR_RANGES = {   // [min stat, max stat, min max-HP, max max-HP] across the 10 pieces of a body part
  common:[1,2,1,10], uncommon:[2,4,5,20], rare:[4,8,10,50], epic:[8,14,20,100], legendary:[14,24,50,200]
};
const ARMOR_FAV = { helmet:["SMARTS","CHARM","SMARTS","SPEED"], chestplate:["STRENGTH","STRENGTH","SMARTS","CHARM"],
                    leggings:["SPEED","SPEED","STRENGTH","CHARM"], boots:["SPEED","CHARM","SPEED","STRENGTH"] };
const GEAR_STATS = ["SPEED","STRENGTH","CHARM","SMARTS"];
const ELEMENT_KEYS = ["fire","water","earth","air"];
const WEAPON_PRICE_BASE = { common:12, uncommon:30, rare:70, epic:150, legendary:320 };
const ARMOR_PRICE_BASE  = { common:40, uncommon:100, rare:260, epic:650, legendary:1600 };
export const GEAR_SHOP_WEIGHT = { common:1, uncommon:.6, rare:.3, epic:.12, legendary:.05 };   // rarer gear turns up less in shops and drops

/* Registers all 300 pieces in ITEM_BY_ID (I). Returns their ids. `fixedStats` keeps the
   gear-rebalance pass in rpg_app.js from touching their numbers. */
function registerGear(I){
  const ids = { weapon:[], armor:[] };
  const seen = new Set();
  R.forEach((rar, ri)=>{
    const [lo,hi] = WEAPON_DAMAGE[rar];
    WEAPON_NAMES[rar].forEach((name, i)=>{
      const id = `wpn_${rar}_${i+1}`, attack = Math.round(lo + (hi-lo)*i/19);
      const price = Math.round(WEAPON_PRICE_BASE[rar] + attack*5);
      I[id] = { id, name, type:"weapon", rarity:rar, element:ELEMENT_KEYS[(i+ri)%4], price, sellPrice:Math.max(1,Math.round(price*0.35)),
        desc:`${rar==="epic"?"An":"A"} ${rar} weapon. Deals ${attack} damage.`, stats:{ attack }, fixedStats:true };
      ids.weapon.push(id);
    });
    const [smin,smax,hmin,hmax] = ARMOR_RANGES[rar];
    Object.keys(ARMOR_NOUNS).forEach((slot, si)=>{
      for(let j=0;j<10;j++){
        const id = `arm_${rar}_${slot}_${j+1}`, t = j/9, fav = ARMOR_FAV[slot];
        const main = Math.round(smin + (smax-smin)*t), stat = fav[j%4];
        const out = { hp: Math.round(hmin + (hmax-hmin)*t) };
        out[stat] = main;
        if(j%3===2){                                   // every third piece is a trade-off: a bit less of another stat for more HP
          const other = GEAR_STATS.filter(k=>k!==stat)[(j+si)%3];
          out[other] = -Math.max(1, Math.round(main/3)); out.hp += Math.round((hmax-hmin)/9);
        }
        const sig = o=> `${slot}|${rar}|${o.hp}|` + GEAR_STATS.map(k=>o[k]||0).join("|");
        let guard = 0; while(seen.has(sig(out)) && guard++ < 200) out.hp += 1;     // no two pieces of a body part share a stat line
        seen.add(sig(out));
        const name = `${ARMOR_MATERIALS[rar][j]} ${ARMOR_NOUNS[slot][j]}`;
        const price = Math.round(ARMOR_PRICE_BASE[rar]*(0.7+0.06*j));
        I[id] = { id, name, type:"armor", armorSlot:slot, rarity:rar, element:ELEMENT_KEYS[(j+si+ri)%4], price, sellPrice:Math.max(1,Math.round(price*0.35)),
          desc:`${rar[0].toUpperCase()+rar.slice(1)} ${slot} armor. Wearing it shifts your stats.`, stats:out, fixedStats:true };
        ids.armor.push(id);
      }
    });
  });
  return ids;
}

/* Registers every new item in ITEM_BY_ID (I) and returns the catalog of ids. */
export function registerItems(I){
  const cat = { forage:[...FORAGE_LEGACY], mineral:[...MINERAL_LEGACY], fish:{ easy:[], medium:[], hard:[] }, gear:registerGear(I) };
  FORAGE_NEW.forEach(([s,name,type,rarity,sell,desc])=>{
    const id = "forage_"+s;
    if(!I[id]) I[id] = { id, name, type, rarity, sellPrice:sell, desc, stats:{} };
    cat.forage.push(id);
  });
  MINERAL_NEW.forEach(([id,name,rarity,sell,desc])=>{
    if(!I[id]) I[id] = { id, name, type:"material", rarity, sellPrice:sell, desc, stats:{} };
    cat.mineral.push(id);
  });
  Object.keys(FISH_NAMES).forEach(tier=>{
    const rars = []; FISH_RARITY_LAYOUT[tier].forEach(([r,n])=>{ for(let i=0;i<n;i++) rars.push(r); });
    FISH_NAMES[tier].forEach((name,i)=>{
      const id = FISH_LEGACY[name] || "fish_"+slug(name);
      if(!I[id]){
        const rarity = rars[i] || "common";
        I[id] = { id, name, type:"consumable", rarity, desc:FISH_BLURB[tier](name),
          sellPrice: Math.max(2, Math.round(FISH_BASE_SELL[rarity]*FISH_TIER_MULT[tier]*(0.9+(i%5)*0.05))), stats:{} };
      }
      cat.fish[tier].push(id);
    });
  });
  cat.mineral.forEach(id=>{ if(MINERAL_SELL[id] && I[id]) I[id].sellPrice = Math.round(MINERAL_SELL[id]/0.9); });   // /0.9 because every sell price is later cut 10%
  cat.gearAll = [...cat.gear.weapon, ...cat.gear.armor];
  return cat;
}

/* ---------- job modes: green = normal, yellow = risky, red = extreme ---------- */
export const MODES = {
  green:  { label:"Green",  emoji:"🟢", blurb:"Normal. Forage: 50% chance of 1 item (30s cooldown). Mine: 90% reward / 10% hazard, 1 durability, 1 mineral. Fish: easy fish (10s). Bugs: easy bugs (10s)." },
  yellow: { label:"Yellow", emoji:"🟡", blurb:"Risky. Forage: 75% for 1–2 items, better rare odds (5 min cooldown). Mine: 2 durability, better gems, same 10% hazard. Fish: medium fish (10s). Bugs: medium bugs (10s)." },
  red:    { label:"Red",    emoji:"🔴", blurb:"Extreme. Forage: 90% for 1–3 items, best rare odds (30 min cooldown). Mine: 3 durability, best gems, same 10% hazard. Fish: hard fish (10s). Bugs: hard bugs (15s)." }
};
export const FORAGE_RULES = {
  green:  { chance:.50, qty:[1,1], cooldown:30*1000 },
  yellow: { chance:.75, qty:[1,2], cooldown:5*60*1000 },
  red:    { chance:.90, qty:[1,3], cooldown:30*60*1000 }
};
// Every mode: always exactly 1 mineral (double:0) and the SAME 10% hazard chance (disasters).
// Higher modes only cost more durability and shift the gem rarity odds (see RARITY_W).
export const MINE_RULES = {
  green:  { pos:.90, neg:.10, wear:1, double:0, cash:[20,100] },
  yellow: { pos:.90, neg:.10, wear:2, double:0, cash:[50,220] },
  red:    { pos:.90, neg:.10, wear:3, double:0, cash:[100,450] }
};
export const MINE_CASH_SHARE = 0.08;     // share of "good" swings that turn up cash instead of a mineral
export const FISH_RULES = {
  // bar = catch-bar height (px), time = ms before the fish slips off, speed = fish swim speed,
  // jitter = chance/tick of picking a new target, dash = chance/tick of a sudden dart, pause = max hover ticks
  // Difficulty shift: old medium -> easy, old hard -> medium, and a brand-new chaotic hard.
  // Optional extras (defaults keep the old behaviour): dashMul = dart speed multiplier, dashLen = [min,max] dart ticks,
  // flip = chance/tick a dart reverses mid-way, longMove = chance a new target is a full-bar leap, wobble = hover shake.
  green:  { tier:"easy",   bar:72, time:10000, speed:1.7, jitter:.040, dash:.014, pause:6,  gain:1.4, loss:1.2 },
  yellow: { tier:"medium", bar:72, time:10000, speed:2.4, jitter:.060, dash:.030, pause:4,  gain:1.3, loss:1.4 },
  red:    { tier:"hard",   bar:72, time:10000, speed:3.4, jitter:.120, dash:.065, pause:2,  gain:1.2, loss:1.7,
            dashMul:4.2, dashLen:[5,11], flip:.12, longMove:.65, wobble:2.2 }
};
// rarity weights (they sum to the odds of each RARITY; each item inside a rarity gets a random-but-fixed share)
export const RARITY_W = {
  // yellow and red now lean much harder into rare+ finds; uncommon is boosted too (green is unchanged)
  forage: { green:{common:78,uncommon:16,rare:4.5,epic:1.2,legendary:.3}, yellow:{common:46,uncommon:29,rare:15,epic:7,legendary:3}, red:{common:28,uncommon:30,rare:22,epic:13,legendary:7} },
  // mining: weights are tuned so every single item's odds fall in order common > uncommon > rare > epic > legendary (8/8/7/5/2 minerals per rarity)
  mine:   { green:{common:80,uncommon:15,rare:4,epic:.8,legendary:.2},    yellow:{common:49,uncommon:29,rare:15.5,epic:5.5,legendary:1}, red:{common:44,uncommon:30,rare:17,epic:7,legendary:2} },
  // fish tiers only contain some rarities (easy has no legendary, hard has no common/uncommon) — absent rarities are skipped and the rest re-normalised
  fish:   { green:{common:70,uncommon:22,rare:6.5,epic:1.5,legendary:0}, yellow:{common:32,uncommon:34,rare:20,epic:10,legendary:4}, red:{common:0,uncommon:0,rare:52,epic:33,legendary:15} }
};
export const MINE_NEG = [
  { id:"trap",      label:"Hidden trap",   w:30, desc:"Lose 3–10% of your money" },
  { id:"cavein",    label:"Cave-in",       w:30, desc:"Lose 5–15% of your max HP" },
  { id:"gas",       label:"Poison gas",    w:20, desc:"Lose 20–40% of your mana and a little HP" },
  { id:"rockslide", label:"Rockslide",     w:20, desc:"Lose 2–5% money and 3–8% max HP" }
];

const hash01 = s => { let h = 2166136261; for(const c of s){ h ^= c.charCodeAt(0); h = Math.imul(h,16777619); } return ((h>>>0)%100000)/100000; };
/* Builds [{id, rarity, p}] where p sums to 1. Every item gets a fixed random scale (0.55x–1.45x)
   inside its rarity, so odds feel uneven but are always identical for everybody. */
export function buildPool(items, weights, seed){
  const by = {}; items.forEach(it=> (by[it.rarity] ||= []).push(it));
  const raw = []; let total = 0;
  for(const r of R){
    const arr = by[r], w = weights[r]||0;
    if(!arr || !w) continue;
    const sc = arr.map(it=> 0.55 + 0.9*hash01(seed+it.id)), sum = sc.reduce((a,b)=>a+b,0);
    arr.forEach((it,i)=> raw.push({ id:it.id, rarity:r, p:w*sc[i]/sum }));
    total += w;
  }
  return raw.map(e=>({ ...e, p:e.p/total })).sort((a,b)=> b.p-a.p);
}
/* LUCK: flattens the odds so the rarest things stop being so rare.
   At luck L (0.1 / 0.2 / 0.4): commons x1/(1+L), uncommon x1, rare x(1+3L), epic x(1+6L), legendary x(1+10L).
   e.g. a +40% potion = commons x0.71, rare x2.2, epic x3.4, legendary x5. Used by forage, mining, fishing and bugs. */
export function luckMult(luck=0){
  return { common:1/(1+luck), uncommon:1, rare:1+3*luck, epic:1+6*luck, legendary:1+10*luck };
}
export function rollPool(pool, luck=0){
  if(luck > 0){
    const mult = luckMult(luck);
    const w = pool.map(e=> e.p*(mult[e.rarity]||1)), tot = w.reduce((a,b)=>a+b,0);
    let t = Math.random()*tot;
    for(let i=0;i<pool.length;i++){ t -= w[i]; if(t<=0) return pool[i].id; }
    return pool[pool.length-1].id;
  }
  let r = Math.random(), acc = 0;
  for(const e of pool){ acc += e.p; if(r <= acc) return e.id; }
  return pool[pool.length-1].id;
}


/* ---------- crafted gear stats: forged pieces are always better than any shop/drop piece of the same rarity ----------
   Each ore sets a main stat and a paired second stat: helmet+chestplate lean on the main stat, leggings+boots on the pair.
   Crafted armor beats the best regular armor of its rarity on both the stat line and max HP. */
const CRAFT_ARMOR_HP_MULT = 2, CRAFT_WEAPON_DMG_MULT = 2;   // ONLY crafted (gear_*) pieces — shop weapons/armor (wpn_*/arm_*) are unchanged
const STAT_PAIR = { SPEED:"CHARM", STRENGTH:"SPEED", CHARM:"SMARTS", SMARTS:"STRENGTH" };
/* Metal progression (weakest -> strongest):
     tin -> copper -> lead -> iron -> silver -> platinum -> steel -> gold -> titanium -> mithril -> adamantite
   Every crafted set is [rarity, t]: its rarity and how far through that rarity's range (0 = bottom, 1 = top) it sits.
   Weapons, max HP and stat bonuses all interpolate inside the same per-rarity ranges as shop gear
   (WEAPON_DAMAGE / ARMOR_RANGES), so progression is gradual and never jumps a rarity band. */
export const GEAR_TIER = {
  tin:["common",.25], copper:["common",.6], lead:["common",1],
  zinc:["uncommon",.05], pewter:["uncommon",.15], bronze:["uncommon",.3], brass:["uncommon",.4],
  garnet:["uncommon",.3], citrine:["uncommon",.4], onyx:["uncommon",.5], peridot:["uncommon",.6],
  iron:["uncommon",.8], silver:["uncommon",1],
  platinum:["rare",.2], quartz:["rare",.05], sapphire:["rare",.2], amethyst:["rare",.3], steel:["rare",.35],
  topaz:["rare",.45], electrum:["rare",.55], jade:["rare",.6], gold:["rare",.85],
  titanium:["epic",.3], opal:["epic",.35], ruby:["epic",.4], emerald:["epic",.5], darksteel:["epic",.55], mithril:["epic",.75],
  adamantite:["legendary",.5], diamond:["legendary",.65], starmetal:["legendary",1],
  // forest-crafted sets (rpg_content.js, FORAGE CRAFTING)
  wooden:["common",.15], wicker:["common",.35], thatch:["common",.55], mossweave:["common",.8],
  birchbark:["uncommon",.1], resin:["uncommon",.25], oakwood:["uncommon",.45], pinewood:["uncommon",.65], blossom:["uncommon",.85],
  silverleaf:["rare",.1], frostweave:["rare",.25], sunpetal:["rare",.4], amberwood:["rare",.55], moonsilk:["rare",.75],
  mistwillow:["epic",.2], emberwood:["epic",.45], dragonroot:["epic",.65], glowcap:["epic",.9],
  heartwood:["legendary",.4], worldtree:["legendary",.8]
};
const gearPower = (key, rar)=> GEAR_TIER[String(key||"").toLowerCase()] || [rar, .5];
export const gearRarity = (key, rar)=> gearPower(key, rar)[0];
const clamp01 = x=> Math.max(0, Math.min(1, x));
const lerpR = ([lo,hi], t)=> Math.round(lo + (hi-lo)*clamp01(t));
const CRAFT_SLOT = { helmet:{pri:0,pm:1,sh:-.05}, chestplate:{pri:0,pm:1.15,sh:.1}, leggings:{pri:1,pm:1,sh:0}, boots:{pri:1,pm:.85,sh:-.1} };
export function craftedArmorStats(slot, rar, stat, variant=0, key){
  const [r, t] = gearPower(key, rar), c = CRAFT_SLOT[slot], [smin,smax,hmin,hmax] = ARMOR_RANGES[r];
  const main = Math.max(1, Math.round(lerpR([smin,smax], t)*c.pm)), other = STAT_PAIR[stat];
  const [p, q] = c.pri===0 ? [stat, other] : [other, stat];
  return { hp: lerpR([hmin,hmax], t + c.sh) * CRAFT_ARMOR_HP_MULT, [p]: main, [q]: Math.max(1, Math.round(main*0.5)) };
}
const WEAPON_SHIFT = [0, -.06, .06, 0, .04, -.04];   // sword, dagger, axe, spear, mace, bow
export const craftedWeaponAttack = (rar, i=0, key)=>{
  const [r, t] = gearPower(key, rar);
  return lerpR(WEAPON_DAMAGE[r], t + WEAPON_SHIFT[i%6]) * CRAFT_WEAPON_DMG_MULT;
};
export function gearStatText(st){
  const bits = [];
  if(st.attack) bits.push(`+${st.attack} attack`);
  if(st.hp) bits.push(`+${st.hp} max HP`);
  ["STRENGTH","SPEED","CHARM","SMARTS"].forEach(k=>{ if(st[k]) bits.push(`${st[k]>0?"+":""}${st[k]} ${k}`); });
  return bits.join(", ");
}
/* The stat line is shown by the item panel itself, so it is no longer repeated in [brackets] inside the description. */
export const gearExtra = (stats, desc)=> ({ stats, fixedStats:true, desc });
const CRAFT_TRINK = { common:[1,2], uncommon:[2,4], rare:[4,7], epic:[7,12], legendary:[12,20] };
export function craftedTrinketStats(kind, rar, stat, key){
  const [r, t] = gearPower(key, rar), base = lerpR(CRAFT_TRINK[r], t);
  return kind==="ring" ? { [stat]:base, curse:false } : { [stat]:base+2, [STAT_PAIR[stat]]:Math.max(1,Math.round(base*0.6)), curse:false };
}

/* ---------- recipes: ~400 more (smelting, gems, gear tiers, cooking, teas, potions) ---------- */
export function addExpansionRecipes(add, I, ctx){
  const { RARITY_MULT, armorStats, cat } = ctx;
  const nm = id=> I[id].name;
  const short = id=> nm(id).replace(/^Wild |^Healing |^Forest |^Cut |^Polished /,"");
  const rar = id=> I[id].rarity;
  const maxRar = (a,b)=> R[Math.max(R.indexOf(a),R.indexOf(b))];

  // ---- smelting + alloys ----
  [["tin","Tin","ore_tin","common"],["lead","Lead","ore_lead","common"],["zinc","Zinc","ore_zinc","uncommon"],
   ["titanium","Titanium","ore_titanium","rare"],["platinum","Platinum","ore_platinum","rare"],
   ["mithril","Mythril","ore_mithril","epic"],["adamantite","Adamantite","ore_adamantite","legendary"]]
   .forEach(([k,n,ore,r])=> add("ing_"+k, n+" Ingot", "material", r, { desc:`Smelted ${n.toLowerCase()}, ready for the forge.` }, [[ore,2],["ore_coal",1]]));
  add("ing_brass","Brass Ingot","material","uncommon",{desc:"A golden alloy of copper and zinc."},[["ing_copper",2],["ing_zinc",1]]);
  add("ing_pewter","Pewter Ingot","material","uncommon",{desc:"A soft, shiny tin-and-lead alloy."},[["ing_tin",2],["ing_lead",1]]);
  add("ing_electrum","Electrum Ingot","material","rare",{desc:"Gold and silver, melted together."},[["ing_gold",1],["ing_silver",1]]);
  add("ing_darksteel","Darksteel Ingot","material","epic",{desc:"Steel folded with volcanic glass. Jet black."},[["ing_steel",1],["rock_obsidian",2]]);
  add("ing_starmetal","Starmetal Ingot","material","legendary",{desc:"Mythril and adamantite fused. It hums."},[["ing_mithril",1],["ing_adamantite",1]]);

  // ---- stonework ----
  add("rock_granite_brick","Granite Brick","material","common",{desc:"A squared-off, polished block."},[["rock_granite",2],["ore_coal",1]]);
  add("rock_limestone_mortar","Limestone Mortar","material","common",{desc:"Ground and mixed. Holds anything together."},[["rock_limestone",2]]);
  add("rock_slate_tile","Slate Tile","material","common",{desc:"A neat, flat roofing tile."},[["rock_slate",2]]);
  add("rock_flint_heads","Flint Arrowheads","material","common",{desc:"Knapped to a wicked point."},[["rock_flint",2]]);
  add("rock_obsidian_blade","Obsidian Blade","material","uncommon",{desc:"A razor-sharp black shard."},[["rock_obsidian",2],["rock_flint",1]]);

  // ---- cut gems + gem elixirs ----
  ["garnet","onyx","citrine","peridot","amethyst","topaz","jade","opal"].forEach(g=>{
    const raw = "gem_"+g, cut = raw+"_cut", n = nm(raw);
    add(cut, "Cut "+n, "material", rar(raw), { desc:`A flawlessly faceted ${n.toLowerCase()}.` }, [[raw,2]]);
    add("elixir_"+cut, "Elixir of "+n, "consumable", rar(raw), { desc:`A shimmering ${n.toLowerCase()} elixir that mends wounds.` }, [[cut,1],["forage_herb",1]]);
  });

  // ---- gear tiers: 6 weapons + 4 armor + ring + amulet per tier ----
  const tiers = [
    ["Tin","ing_tin","common","SPEED"],["Pewter","ing_pewter","uncommon","CHARM"],["Brass","ing_brass","uncommon","SMARTS"],
    ["Garnet","gem_garnet_cut","uncommon","STRENGTH"],["Citrine","gem_citrine_cut","uncommon","CHARM"],
    ["Onyx","gem_onyx_cut","uncommon","SPEED"],["Peridot","gem_peridot_cut","uncommon","SMARTS"],
    ["Titanium","ing_titanium","rare","STRENGTH"],["Amethyst","gem_amethyst_cut","rare","SMARTS"],
    ["Topaz","gem_topaz_cut","rare","CHARM"],["Jade","gem_jade_cut","rare","SPEED"],["Electrum","ing_electrum","rare","CHARM"],
    ["Darksteel","ing_darksteel","epic","STRENGTH"],["Platinum","ing_platinum","rare","CHARM"],
    ["Opal","gem_opal_cut","epic","SMARTS"],["Mythril","ing_mithril","epic","SPEED"],
    ["Adamantite","ing_adamantite","legendary","STRENGTH"],["Starmetal","ing_starmetal","legendary","SPEED"],
    ["Lead","ing_lead","common","STRENGTH"],["Zinc","ing_zinc","uncommon","SPEED"]      // every smeltable ore now has its own set
  ];
  const weapons = ["Sword","Dagger","Axe","Spear","Mace","Bow"];
  const armors = [["Helm","helmet",3],["Chestplate","chestplate",5],["Leggings","leggings",4],["Boots","boots",3]];
  tiers.forEach(([t,mat,rr0,stat],ti)=>{
    const k = t.toLowerCase(), lc = t.toLowerCase(), rr = gearRarity(k, rr0);
    weapons.forEach((w,i)=> add(`gear_${k}_${w.toLowerCase()}`, `${t} ${w}`, "weapon", rr,
      gearExtra({ attack:craftedWeaponAttack(rr,i,k) }, `A ${lc} ${w.toLowerCase()}, forged with your own hands.`), [[mat,2+(i%2)],["ore_coal",1]]));
    armors.forEach(([a,slot,q])=> add(`gear_${k}_${a.toLowerCase()}`, `${t} ${a}`, "armor", rr,
      { armorSlot:slot, ...gearExtra(craftedArmorStats(slot,rr,stat,0,k), `Sturdy ${lc} protection for your ${slot}.`) }, [[mat,q],["ore_coal",1]]));
    add(`gear_${k}_ring`, `${t} Ring`, "trinket", rr, gearExtra(craftedTrinketStats("ring",rr,stat,k), `A ${lc} ring that sharpens your ${stat.toLowerCase()}.`), [[mat,1],["ore_coal",1]]);
    add(`gear_${k}_amulet`, `${t} Amulet`, "trinket", rr, gearExtra(craftedTrinketStats("amulet",rr,stat,k), `A ${lc} amulet that greatly boosts ${stat.toLowerCase()}.`), [[mat,2],["forage_herb",2]]);
  });

  // ---- cooking: every new fish, every new edible forage ----
  const legacyFish = new Set(Object.values(FISH_LEGACY));
  ["easy","medium","hard"].forEach(tier=> cat.fish[tier].forEach(f=>{
    if(legacyFish.has(f)) return;
    add("cooked_"+f, "Cooked "+nm(f), "consumable", rar(f), { desc:`${nm(f)} grilled over coal until the skin crackles. Heals well.` }, [[f,1],["ore_coal",1]]);
  }));
  const edibleNew = FORAGE_NEW.filter(r=>r[2]==="consumable").map(r=>"forage_"+r[0]);
  edibleNew.forEach(f=> add("roast_"+f, "Roasted "+short(f), "consumable", rar(f), { desc:`${short(f)} roasted over coal. Smoky and satisfying.` }, [[f,1],["ore_coal",1]]));
  const sfx = ["Stew","Skewer","Pie","Soup","Salad","Roast"];
  edibleNew.forEach((f,i)=>{
    const tier = ["common","uncommon"].includes(rar(f)) ? "easy" : rar(f)==="rare" ? "medium" : "hard";
    const fish = cat.fish[tier][(i*7+3)%cat.fish[tier].length];
    add(`dish_${f}_${fish}`, `${short(f)} & ${nm(fish)} ${sfx[i%6]}`, "consumable", maxRar(rar(f),rar(fish)),
      { desc:`${short(f)} and ${nm(fish).toLowerCase()}, simmered into a proper meal.` }, [[f,1],[fish,1]]);
  });
  ["blackberry","blueberry","raspberry","elderberry","wildplum","crabapple"].forEach(s=>{
    const f = "forage_"+s;
    add("jam_"+s, `${short(f)} Jam`, "material", rar(f), { sellPrice:Math.round((I[f].sellPrice||4)*3*1.9), desc:`Three batches of ${short(f).toLowerCase()}, boiled down and jarred. Sells for a lot.` }, [[f,3]]);
  });

  // ---- teas (herbs & flowers) ----
  ["lavender","chamomile","mint","sage","dandelion","clover","moonpetal","frostbloom","sunblossom","silverleaf","saffron","emberlotus","mistwillow","dragonroot"]
    .forEach(s=> add("tea_"+s, `${short("forage_"+s)} Tea`, "consumable", rar("forage_"+s), { desc:`A warm cup of ${short("forage_"+s).toLowerCase()}. Soothing and restorative.` }, [["forage_"+s,2]]));

  // ---- potions: healing / mana / restoration, 5 tiers each ----
  const T = ["Minor","Lesser","Greater","Superior","Supreme"];
  const x5 = a=> a.map(r=> r.map(v=> v*5));      // healing potions restore 5x the HP in every tier
  const heal = x5([[8,30],[25,65],[55,110],[100,160],[150,200]]), mana = [[5,12],[10,25],[20,45],[35,80],[60,120]], rest = x5([[6,24],[20,50],[45,90],[85,140],[130,190]]), restMana = [[3,8],[6,15],[12,28],[20,45],[35,70]];
  const healIng = [[["forage_herb",2],["forage_berry",1]],[["forage_chamomile",2],["forage_herb",2]],[["forage_ginseng",1],["forage_chamomile",2],["forage_royaljelly",1]],[["forage_dragonroot",1],["forage_ginseng",2],["gem_ruby_cut",1]],[["forage_heartwood",1],["forage_dragonroot",1],["gem_diamond_cut",1]]];
  const manaIng = [[["forage_mint",2],["forage_blueberry",1]],[["forage_mint",2],["forage_lavender",2]],[["forage_moonpetal",2],["gem_sapphire_cut",1]],[["forage_starcap",1],["forage_moonpetal",2],["gem_amethyst_cut",1]],[["forage_worldtreedew",1],["forage_starcap",1],["gem_opal_cut",1]]];
  T.forEach((t,i)=>{
    add(`potion_heal_${i+1}`, `${t} Healing Potion`, "consumable", R[i], { healFinal:heal[i], stats:{}, desc:`Restores ${heal[i][0]}–${heal[i][1]} HP. Tastes like pond water and hope.` }, healIng[i]);
    add(`potion_mana_${i+1}`, `${t} Mana Potion`, "consumable", R[i], { healFinal:[0,0], manaFinal:mana[i], stats:{}, desc:`Restores ${mana[i][0]}–${mana[i][1]} mana. Fizzes blue and tingles.` }, manaIng[i]);
  });
  T.forEach((t,i)=>
    add(`potion_rest_${i+1}`, `${t} Restoration Potion`, "consumable", R[i], { healFinal:rest[i], manaFinal:restMana[i], stats:{}, desc:`Restores ${rest[i][0]}–${rest[i][1]} HP and ${restMana[i][0]}–${restMana[i][1]} mana in one swig.` }, [[`potion_heal_${i+1}`,1],[`potion_mana_${i+1}`,1]]));

  // ---- luck potions (brewed from Four-Leaf Clovers; also rarely sold in shops) ----
  // [numeral, luck fraction, minutes, rarity, shop price, sell price (pre the global 10% sell cut), ingredients]
  [["I",.10,3,"uncommon",60,33,[["forage_fourleafclover",1],["forage_clover",2],["forage_dandelion",1]]],
   ["II",.20,5,"rare",140,78,[["forage_fourleafclover",2],["gem_jade_cut",1],["forage_silverleaf",1]]],
   ["III",.40,8,"epic",300,167,[["forage_fourleafclover",3],["gem_emerald_cut",1],["forage_starcap",1]]]]
   .forEach(([n,pct,min,rr,price,sell,ing],i)=>
     add(`potion_luck_${i+1}`, `Luck Potion ${n}`, "consumable", rr, { healFinal:[0,0], stats:{ luck:pct, luckMs:min*60000 }, price, sellPrice:sell,
       desc:`Drink for +${Math.round(pct*100)}% luck for ${min} minutes: better odds on rare finds while foraging, mining and fishing.` }, ing));
}


/* =========================================================================
   FORAGE CRAFTING — every foragable now has a use.
   Raw forage -> processed materials (lumber, cordage, wreaths, dyes, syrups, planks, silks ...)
   -> better materials made from those -> gear sets, foods, tonics and more.
   Written as data + a few generator loops; ingredients are "name:qty" tokens:
     twigs:4      -> forage_twigs      m.lumber:2 -> mat_lumber      tea_mint / ore_coal / gem_x -> used as-is
   ========================================================================= */
const WOOD_TIERS = [   // [Tier name, material id, rarity (fallback), stat]  — rarity / power come from GEAR_TIER
  ["Wooden","mat_lumber","common","SPEED"],["Wicker","mat_wicker","common","CHARM"],["Thatch","mat_thatch","common","STRENGTH"],["Mossweave","mat_mossweave","common","SMARTS"],
  ["Birchbark","mat_bark_plate","uncommon","SPEED"],["Resin","mat_resin_plate","uncommon","STRENGTH"],["Oakwood","mat_oak_plank","uncommon","STRENGTH"],
  ["Pinewood","mat_pine_beam","uncommon","SMARTS"],["Blossom","mat_petalweave","uncommon","CHARM"],
  ["Silverleaf","mat_silverleaf_mesh","rare","SMARTS"],["Frostweave","mat_frostweave","rare","SMARTS"],["Sunpetal","mat_sunweave","rare","CHARM"],
  ["Amberwood","mat_amber_plank","rare","STRENGTH"],["Moonsilk","mat_moonsilk","rare","SPEED"],
  ["Mistwillow","mat_mist_plank","epic","SMARTS"],["Emberwood","mat_ember_plank","epic","STRENGTH"],["Dragonroot","mat_dragon_fiber","epic","SPEED"],["Glowcap","mat_glow_weave","epic","CHARM"],
  ["Heartwood","mat_heartwood_plank","legendary","STRENGTH"],["Worldtree","mat_worldtree_weave","legendary","SMARTS"]
];

// [slug, name, rarity, ingredients, description, consumable?]   (slug -> id "mat_"+slug)
const FORAGE_MATS = [
  // ---- woodwork & fibre (commons) ----
  ["lumber","Rough Lumber","common","twigs:4 pinecone:1","Twigs and cones lashed and trimmed into usable timber."],
  ["kindling","Kindling Bundle","common","twigs:3 pinecone:2","Dry, resinous and ready to catch."],
  ["charcoal","Twig Charcoal","common","twigs:6","Slow-burned twigs. Burns hot and clean."],
  ["cordage","Plant Cordage","common","cattail:3 moss:1","Twisted reed fibre. Holds more than you would think."],
  ["thatch","Thatch Bundle","common","cattail:4 clover:2","Tightly bound reed thatch."],
  ["wicker","Wicker Weave","common","cattail:2 twigs:3","Springy woven panels."],
  ["mossweave","Moss Weave","common","moss:4 cattail:2 clover:1","A cool, damp mat of felted moss."],
  ["moss_padding","Moss Padding","common","moss:3 clover:2","Soft stuffing for anything that needs cushioning."],
  ["reed_mat","Reed Mat","common","cattail:5 twigs:1","A flat woven mat."],
  ["strong_twine","Strong Twine","common","m.cordage:2 cattail:1","Cordage twisted again. Nearly rope."],
  ["fern_fiber","Fern Fiber","common","fiddlehead:4 cattail:1","Stringy and strong once dried."],
  ["pressed_greens","Pressed Greens","common","fiddlehead:2 sorrel:2 moss:1","Flattened, dried leaves."],
  ["acorn_meal","Acorn Meal","common","acorn:4","Ground acorns. Needs a good rinse."],
  ["nut_flour","Nut Flour","common","hazelnut:3 chestnut:2","Fine, nutty flour."],
  ["chestnut_flour","Chestnut Flour","common","chestnut:4","Sweet, pale flour."],
  ["nut_butter","Nut Butter","common","hazelnut:4 acorn:1","Thick and rich."],
  ["dried_berries","Dried Berry Mix","common","blackberry:2 blueberry:2 raspberry:2","Chewy, concentrated sweetness."],
  ["berry_pulp","Berry Pulp","common","blackberry:3 raspberry:2","Mashed and sweet."],
  ["apple_mash","Apple Mash","common","apple:4","Soft, sweet apple purée."],
  ["wild_seasoning","Wild Seasoning","common","wildgarlic:2 wildonion:2 sorrel:1","A pungent pinch that improves anything."],
  ["garlic_paste","Garlic Paste","common","wildgarlic:4 wildonion:1","Eye-wateringly strong."],
  ["herb_bundle","Herb Bundle","common","herb:3 sorrel:1","Tied and hung to dry."],
  ["mushroom_powder","Mushroom Powder","common","mushroom:4","Dried and ground. Pure umami."],
  ["dye_red","Red Berry Dye","common","raspberry:3 blackberry:1","A bright crimson dye."],
  ["dye_blue","Blue Berry Dye","common","blueberry:4","A deep blue dye."],
  ["dye_violet","Violet Dye","common","blackberry:3 blueberry:1","A rich purple dye."],
  ["dye_yellow","Dandelion Dye","common","dandelion:4","A sunny yellow dye."],
  ["dye_green","Green Leaf Dye","common","sorrel:3 moss:2","A fresh green dye."],
  ["dandelion_wreath","Dandelion Wreath","common","dandelion:4 clover:2 cattail:1","A cheerful flower crown."],
  ["clover_chain","Clover Chain","common","clover:5 dandelion:1","A long, braided daisy chain, but clover."],
  // ---- uncommon: bark, resin, flowers, honey ----
  ["bark_sheets","Birch Bark Sheets","uncommon","birchbark:3 moss:1","Pale, paper-thin sheets."],
  ["bark_plate","Bark Plating","uncommon","birchbark:4 m.lumber:1 pineresin:1","Layered bark pressed hard with resin."],
  ["resin_glue","Pine Glue","uncommon","pineresin:2 pinecone:2","Sticks to everything, including you."],
  ["tar_pitch","Tar Pitch","uncommon","pineresin:3 twigs:3","Waterproof black pitch."],
  ["resin_plate","Hardened Resin","uncommon","pineresin:4 birchbark:1 m.charcoal:1","Resin baked to the hardness of horn."],
  ["torch","Resin Torch","uncommon","twigs:2 pineresin:1 m.cordage:1","Burns for hours, smells like Christmas."],
  ["oak_plank","Oakwood Plank","uncommon","m.lumber:2 acorn:3 hazelnut:2","Dense, dark planking."],
  ["pine_beam","Pine Beam","uncommon","m.lumber:2 pineresin:2 pinecone:2","A straight, springy beam."],
  ["seasoned_planks","Seasoned Planks","uncommon","m.lumber:3 m.resin_glue:1","Dried, sealed and ready for the workshop."],
  ["sturdy_rope","Sturdy Rope","uncommon","m.strong_twine:3 m.resin_glue:1","Pitch-sealed rope that will not rot."],
  ["bouquet","Wildflower Bouquet","uncommon","dandelion:2 lavender:2 chamomile:1","Sweet-smelling and cheerful."],
  ["potpourri","Potpourri","uncommon","lavender:2 mint:2 sage:1","A bowlful of dried scent."],
  ["flower_wreath","Blossom Wreath","uncommon","m.dandelion_wreath:1 lavender:2 chamomile:2","A fragrant crown of real flowers."],
  ["petalweave","Petalweave","uncommon","lavender:3 chamomile:3 m.cordage:1","Pressed petals woven into a light cloth."],
  ["herbal_blend","Herbal Blend","uncommon","mint:2 sage:2 chamomile:1","A calming dried mix."],
  ["smudge","Sage Smudge Bundle","uncommon","sage:3 lavender:1 m.cordage:1","Burned to clear the air."],
  ["incense","Forest Incense","uncommon","pineresin:2 sage:1 lavender:1","Smoke that smells like a clearing."],
  ["perfume","Lavender Perfume","uncommon","lavender:4 honeycomb:1","Light and lasting."],
  ["honey_syrup","Honey Syrup","uncommon","honeycomb:2 crabapple:1","Thin, golden and tart."],
  ["elder_syrup","Elderberry Syrup","uncommon","elderberry:3 honeycomb:1","Dark, sweet and medicinal."],
  ["fruit_leather","Fruit Leather","uncommon","m.dried_berries:2 wildplum:1","Chewy fruit sheets."],
  ["mushroom_stock","Mushroom Stock","uncommon","chanterelle:2 morel:2 m.wild_seasoning:1","A deep, savory broth."],
  ["spore_dust","Fungal Spore Dust","uncommon","chanterelle:2 morel:1 mushroom:2","Faintly glittering powder. Do not sneeze."],
  ["dried_mushrooms","Dried Mushroom Mix","uncommon","chanterelle:2 morel:2","Wrinkled and fragrant."],
  ["poultice","Herbal Poultice","uncommon","m.herb_bundle:2 chamomile:1 moss:2","A cool, green wrap."],
  // ---- rare ----
  ["silverleaf_mesh","Silverleaf Mesh","rare","silverleaf:3 m.cordage:2 m.resin_glue:1","Metallic leaves woven into flexible plates."],
  ["frostweave","Frostweave","rare","frostbloom:3 m.petalweave:1 m.moss_padding:1","Cloth that never quite thaws."],
  ["sunweave","Sunpetal Weave","rare","sunblossom:3 m.petalweave:1 chamomile:1","Warm to wear even in snow."],
  ["amber_plank","Amberwood Plank","rare","ambersap:3 m.oak_plank:2 m.resin_glue:1","Timber soaked through with glowing sap."],
  ["moonsilk","Moonsilk","rare","moonpetal:3 silverleaf:1 m.petalweave:1","A pale cloth that glows after dark."],
  ["ginseng_extract","Ginseng Extract","rare","ginseng:2 m.honey_syrup:1","Bitter, potent and bright."],
  ["saffron_oil","Saffron Oil","rare","saffron:2 lavender:2","Golden and costly."],
  ["lucky_charm","Lucky Clover Charm","rare","fourleafclover:1 m.clover_chain:1 m.cordage:1","A real four-leaf clover, braided into something wearable."],
  ["frost_essence","Frost Essence","rare","frostbloom:2 mint:2","Chilled to the bone."],
  ["sun_essence","Sun Essence","rare","sunblossom:2 honeycomb:1","Captured warmth in a bottle."],
  ["moon_essence","Moon Essence","rare","moonpetal:2 lavender:2","Dreamy, silvery liquid."],
  ["porcini_extract","Porcini Extract","rare","porcini:2 m.mushroom_stock:1","Intensely meaty."],
  ["truffle_oil","Truffle Oil","rare","truffle:1 m.mushroom_powder:2","A drop transforms a dish."],
  ["royal_nectar","Royal Nectar","rare","royaljelly:1 m.honey_syrup:2","Thick, golden and unreasonably restorative.",true],
  // ---- epic ----
  ["mist_plank","Mistwillow Plank","epic","mistwillow:2 m.pine_beam:2 m.resin_glue:1","Foggy, fine-grained timber that never dries out."],
  ["ember_plank","Emberwood Plank","epic","emberlotus:2 m.amber_plank:1 m.charcoal:3","Smoldering wood that does not burn."],
  ["dragon_fiber","Dragonroot Fiber","epic","dragonroot:2 m.silverleaf_mesh:1 m.cordage:2","Scaly, tough fibres that hum when pulled."],
  ["glow_weave","Glowcap Weave","epic","glowshroom:2 m.moonsilk:1 m.spore_dust:1","A cloth that pulses softly."],
  ["starcap_dust","Starcap Dust","epic","starcap:2 m.spore_dust:2","Pinpoints of light in a pouch."],
  ["starweave","Starweave Cloth","epic","starcap:1 m.moonsilk:2 m.frostweave:1","Woven night sky."],
  ["ember_oil","Ember Oil","epic","emberlotus:1 m.saffron_oil:1","Warm, glowing oil."],
  ["dragon_brew","Dragon's Brew","epic","dragonroot:1 m.ginseng_extract:1 m.royal_nectar:1","Burns going down, heals coming up.",true],
  // ---- legendary ----
  ["heartwood_plank","Heartwood Plank","legendary","heartwood:1 m.mist_plank:2 m.amber_plank:1","Timber that is still, faintly, alive."],
  ["worldtree_weave","Worldtree Weave","legendary","worldtreedew:1 m.glow_weave:1 m.moonsilk:2","Cloth that drinks the light."],
  ["worldtree_elixir","World Tree Elixir","legendary","worldtreedew:1 m.royal_nectar:1 m.dragon_brew:1","A single sip fills you to the brim.",true]
];

export function addForageCraftRecipes(add, I){
  const R5 = R, rar = id=> (I[id] && I[id].rarity) || "common";
  const maxRar = (a,b)=> R5[Math.max(R5.indexOf(a),R5.indexOf(b))];
  const ref = t=>{ const [k,q] = t.split(":"); const id = k.startsWith("m.") ? "mat_"+k.slice(2) : /^(tea_|ore_|gem_|rock_|mat_|ing_|food_)/.test(k) ? k : "forage_"+k; return [id, +q]; };
  const ings = s=> s.split(" ").map(ref);
  const val = ing=> ing.reduce((s,[id,q])=> s + ((I[id] && I[id].sellPrice) || 3)*q, 0);
  const short = id=> (I[id] ? I[id].name : id).replace(/^Wild |^Healing |^Forest |^Cut |^Polished |^Dry /,"");
  const sellItem = (ing, mult)=>{ const s = Math.max(2, Math.round(val(ing)*mult)); return { sellPrice:s, price:s*3 }; };

  // 1) processed materials (made from several foragables, worth far more than the pile they came from)
  FORAGE_MATS.forEach(([slug, name, r, ing, desc, food])=>{
    const list = ings(ing);
    add("mat_"+slug, name, food ? "consumable" : "material", r, { desc, ...sellItem(list, food ? 1.4 : 2.1) }, list);
  });

  // 2) wooden / woven / petal gear sets: 6 weapons, 4 armor, ring and amulet per tier, bound with cordage
  const weapons = ["Sword","Dagger","Axe","Spear","Mace","Bow"], armors = [["Helm","helmet",3],["Chestplate","chestplate",5],["Leggings","leggings",4],["Boots","boots",3]];
  WOOD_TIERS.forEach(([t,mat,r0,stat])=>{
    const k = t.toLowerCase(), rr = gearRarity(k, r0), lc = k;
    weapons.forEach((w,i)=> add(`gear_${k}_${w.toLowerCase()}`, `${t} ${w}`, "weapon", rr,
      gearExtra({ attack:craftedWeaponAttack(rr,i,k) }, `A ${lc} ${w.toLowerCase()}, crafted from forest materials.`), [[mat,2+(i%2)],["mat_cordage",1]]));
    armors.forEach(([a,slot,q])=> add(`gear_${k}_${a.toLowerCase()}`, `${t} ${a}`, "armor", rr,
      { armorSlot:slot, ...gearExtra(craftedArmorStats(slot,rr,stat,0,k), `Light but sturdy ${lc} protection for your ${slot}.`) }, [[mat,q],["mat_cordage",1]]));
    add(`gear_${k}_ring`, `${t} Ring`, "trinket", rr, gearExtra(craftedTrinketStats("ring",rr,stat,k), `A ${lc} ring that sharpens your ${stat.toLowerCase()}.`), [[mat,1],["mat_cordage",1]]);
    add(`gear_${k}_amulet`, `${t} Amulet`, "trinket", rr, gearExtra(craftedTrinketStats("amulet",rr,stat,k), `A ${lc} amulet that greatly boosts ${stat.toLowerCase()}.`), [[mat,2],["forage_herb",2]]);
  });

  // 3) cooking & brewing with the new materials
  const edibleF = FORAGE_NEW.filter(r=>r[2]==="consumable" && r[0]!=="worldtreedew").map(r=>"forage_"+r[0]).concat(["forage_berry","forage_mushroom","forage_herb","forage_apple","forage_truffle","forage_goldapple"]);
  edibleF.forEach(f=> add("food_seasoned_"+f.slice(7), "Seasoned "+short(f), "consumable", rar(f), { desc:`${short(f)} rubbed with wild seasoning and roasted until it sizzles.` }, [[f,2],["mat_wild_seasoning",1]]));
  const sweets = ["blackberry","blueberry","raspberry","elderberry","wildplum","crabapple","apple","chestnut"];
  sweets.forEach(s=>{ const f = "forage_"+s; add("food_honeyed_"+s, "Honeyed "+short(f), "consumable", rar(f), { desc:`${short(f)} candied in honey syrup.` }, [[f,2],["mat_honey_syrup",1]]); });
  sweets.slice(0,6).forEach(s=>{ const f = "forage_"+s; add("food_cordial_"+s, short(f)+" Brew", "consumable", rar(f), { desc:`${short(f)} steeped in syrup and left to ferment a little.` }, [[f,3],["mat_elder_syrup",1]]); });
  [["tea_lavender","Lavender"],["tea_chamomile","Chamomile"],["tea_mint","Mint"],["tea_sage","Sage"],["tea_dandelion","Dandelion"],["tea_clover","Clover"],["tea_moonpetal","Moonpetal"],["tea_frostbloom","Frostbloom"],
   ["tea_sunblossom","Sunblossom"],["tea_silverleaf","Silverleaf"],["tea_saffron","Saffron"],["tea_emberlotus","Ember Lotus"],["tea_mistwillow","Mistwillow"],["tea_dragonroot","Dragonroot"]]
    .forEach(([t,n])=> add("food_honeytea_"+t.slice(4), `Honeyed ${n} Tea`, "consumable", rar(t), { desc:`${n} tea sweetened with honey syrup.` }, [[t,1],["mat_honey_syrup",1]]));
  const herbs = ["herb","mint","sage","chamomile","lavender","ginseng","saffron","moonpetal","frostbloom","sunblossom","silverleaf","dragonroot","emberlotus","mistwillow","sorrel","dandelion","clover","fourleafclover","heartwood","royaljelly"];
  herbs.forEach(h=>{ const f = "forage_"+h; add("tonic_"+h, short(f)+" Tonic", "consumable", rar(f), { desc:`${short(f)} distilled into a healing tonic.` }, [[f,2],["mat_herbal_blend",1]]); });
  ["mushroom","chanterelle","morel","porcini","starcap","glowshroom","truffle"].forEach(m=>{ const f = "forage_"+m;
    add("food_stuffed_"+m, `Stuffed ${short(f)}`, "consumable", rar(f), { desc:`${short(f)} packed with garlic and nut butter, then baked.` }, [[f,2],["mat_garlic_paste",1],["mat_nut_butter",1]]);
    add("food_soup_"+m, `${short(f)} Soup`, "consumable", rar(f), { desc:`A bowl of rich ${short(f).toLowerCase()} broth.` }, [[f,1],["mat_mushroom_stock",1]]); });
  [["wildgarlic","Garlic"],["wildonion","Onion"],["sorrel","Sorrel"],["fiddlehead","Fiddlehead"],["chestnut","Chestnut"],["hazelnut","Hazelnut"],["blackberry","Blackberry"],["raspberry","Raspberry"]]
    .forEach(([s,n])=>{ const f = "forage_"+s; add("food_pickled_"+s, `Pickled ${n}s`.replace("ss","s").replace("Sorrels","Sorrel"), "consumable", rar(f), { desc:`${n}, brined with seasoning and left to sharpen.` }, [[f,3],["mat_wild_seasoning",1]]); });
  const flours = [["nut","Nut"],["chestnut","Chestnut"],["acorn","Acorn"]].map(([s,n])=>[ s==="acorn" ? "mat_acorn_meal" : `mat_${s}_flour`, n ]);
  const fills = [["mat_berry_pulp","Berry"],["mat_honey_syrup","Honey"],["mat_elder_syrup","Elderberry"],["mat_apple_mash","Apple"],["mat_fruit_leather","Fruit"]];
  flours.forEach(([fl,fn])=> fills.forEach(([fi,fin],j)=> add(`food_bake_${fl.slice(4)}_${fi.slice(4)}`, `${fn} ${fin} ${["Loaf","Tart","Cake","Pie","Pastry"][j]}`, "consumable", maxRar(rar(fl),rar(fi)), { desc:`${fn.toLowerCase()}-based baking with ${fin.toLowerCase()} filling.` }, [[fl,2],[fi,1]])));
  add("food_trail_mix","Trail Mix","consumable","uncommon",{ desc:"Berries, nuts and a drizzle of honey." },[["mat_dried_berries",1],["mat_nut_butter",1],["mat_honey_syrup",1]]);
  add("food_forager_feast","Forager's Feast","consumable","rare",{ desc:"A whole table of woodland cooking in one plate." },[["mat_mushroom_stock",1],["mat_fruit_leather",1],["mat_nut_flour",2],["mat_truffle_oil",1]]);
  add("mat_bandage","Herbal Bandage","consumable","uncommon",{ desc:"Cordage and herbs, wrapped tight.", ...sellItem(ings("m.cordage:2 m.herb_bundle:1 chamomile:1"),1.4) },ings("m.cordage:2 m.herb_bundle:1 chamomile:1"));
  add("mat_salve","Soothing Salve","consumable","uncommon",{ desc:"Cooling and sweet-smelling.", ...sellItem(ings("chamomile:2 honeycomb:1 lavender:1"),1.4) },ings("chamomile:2 honeycomb:1 lavender:1"));

  // 4) dyed fibres and scented candles (more uses for every dye and every flower)
  const dyes = [["red","Red"],["blue","Blue"],["violet","Violet"],["yellow","Yellow"],["green","Green"]];
  [["cordage","Cordage"],["wicker","Wicker"],["thatch","Thatch"],["reed_mat","Reed Mat"]].forEach(([b,bn])=> dyes.forEach(([d,dn])=>{
    const list = [[`mat_${b}`,2],[`mat_dye_${d}`,1]]; add(`mat_dyed_${b}_${d}`, `${dn} ${bn}`, "material", rar(`mat_${b}`), { desc:`${bn} dyed ${dn.toLowerCase()}.`, ...sellItem(list,2.2) }, list); }));
  ["lavender","chamomile","mint","sage","moonpetal","sunblossom","frostbloom","saffron","emberlotus"].forEach(s=>{
    const f = "forage_"+s, list = [[f,2],["mat_resin_glue",1],["mat_cordage",1]];
    add("mat_candle_"+s, `${short(f)} Candle`, "material", rar(f), { desc:`A slow-burning candle scented with ${short(f).toLowerCase()}.`, ...sellItem(list,2.1) }, list); });

  // 5) charms and talismans: the "dead-end" luxury materials become trinkets
  [["circlet","Blossom Circlet","m.flower_wreath:1 m.petalweave:1","blossom","uncommon","CHARM","ring"],
   ["dandelion_crown","Dandelion Crown","m.dandelion_wreath:2 m.cordage:1","wicker","common","CHARM","ring"],
   ["clover_amulet","Lucky Clover Amulet","m.lucky_charm:1 m.silverleaf_mesh:1","silverleaf","rare","CHARM","amulet"],
   ["frost_pendant","Frost Pendant","m.frost_essence:1 m.frostweave:1","frostweave","rare","SMARTS","amulet"],
   ["sun_pendant","Sun Pendant","m.sun_essence:1 m.sunweave:1","sunpetal","rare","CHARM","amulet"],
   ["moon_pendant","Moon Pendant","m.moon_essence:1 m.moonsilk:1","moonsilk","rare","SPEED","amulet"],
   ["star_pendant","Star Pendant","m.starweave:1 m.starcap_dust:1","glowcap","epic","CHARM","amulet"],
   ["ember_band","Ember Band","m.ember_oil:1 m.ember_plank:1","emberwood","epic","STRENGTH","ring"],
   ["sage_talisman","Sage Talisman","m.smudge:2 m.bark_plate:1","birchbark","uncommon","SMARTS","ring"],
   ["incense_charm","Forest Incense Charm","m.incense:2 m.resin_plate:1","resin","uncommon","STRENGTH","amulet"],
   ["porcini_charm","Porcini Charm","m.porcini_extract:1 m.amber_plank:1","amberwood","rare","STRENGTH","ring"],
   ["perfume_locket","Perfume Locket","m.perfume:2 m.petalweave:1","blossom","uncommon","CHARM","amulet"]]
   .forEach(([slug,name,ing,key,r0,stat,kind])=>{ const rr = gearRarity(key,r0), list = ings(ing);
     add("gear_"+slug, name, "trinket", rr, gearExtra(craftedTrinketStats(kind,rr,stat,key), `A handmade ${kind} woven from forest materials, boosting ${stat.toLowerCase()}.`), list); });

  // 6) more dishes and brews
  [["hunters_stew","Hunter's Stew","uncommon","m.mushroom_stock:1 wildonion:2 chestnut:2","Thick, hot and filling."],
   ["berry_compote","Berry Compote","common","m.berry_pulp:2 m.honey_syrup:1","Warm fruit and syrup."],
   ["nut_crusted_morels","Nut-Crusted Morels","uncommon","morel:2 m.nut_flour:1","Crispy outside, tender inside."],
   ["garlic_mushrooms","Garlic Mushrooms","common","mushroom:2 m.garlic_paste:1","Sizzled in garlic."],
   ["herb_crust_loaf","Herb Crust Loaf","common","m.nut_flour:2 m.herb_bundle:1","A savory loaf."],
   ["chanterelle_pie","Chanterelle Pie","uncommon","chanterelle:2 m.chestnut_flour:2 m.wild_seasoning:1","Golden and flaky."],
   ["porcini_risotto","Porcini Risotto","rare","porcini:2 m.mushroom_stock:1 m.truffle_oil:1","Creamy and unforgettable."],
   ["saffron_pastry","Saffron Pastry","rare","saffron:1 m.nut_flour:2 m.honey_syrup:1","Gold-threaded and sweet."],
   ["jelly_toast","Royal Jelly Toast","rare","royaljelly:1 m.nut_flour:1 m.elder_syrup:1","Fit for a queen bee."],
   ["starcap_stew","Starcap Stew","epic","starcap:2 m.mushroom_stock:2 m.truffle_oil:1","Glitters faintly in the bowl."],
   ["glowshroom_skewer","Glowshroom Skewer","epic","glowshroom:2 m.spore_dust:1 m.wild_seasoning:1","Glows in the dark, tastes like toasted chestnuts."],
   ["dragon_chili","Dragonroot Chili","epic","dragonroot:1 m.garlic_paste:2 m.mushroom_stock:1","Hot enough to warm your boots."],
   ["worldtree_feast","World Tree Feast","legendary","worldtreedew:1 food_forager_feast:1","A banquet that tastes like spring."],
   ["trail_bar","Trail Bar","common","m.dried_berries:1 m.nut_butter:1","Sticky, chewy fuel."],
   ["wild_salad","Wild Salad","common","sorrel:2 fiddlehead:2 m.wild_seasoning:1","Fresh and sharp."],
   ["frost_brew","Frost Brew","rare","m.frost_essence:1 m.honey_syrup:1","Icy cold, honey sweet."],
   ["sun_brew","Sun Brew","rare","m.sun_essence:1 m.honey_syrup:1","Tastes like July."],
   ["moon_brew","Moon Brew","rare","m.moon_essence:1 m.honey_syrup:1","Soft, silvery and calming."],
   ["ember_brew","Ember Brew","epic","m.ember_oil:1 m.elder_syrup:1","Warm all the way down."],
   ["starlight_draught","Starlight Draught","epic","m.starcap_dust:1 m.moon_essence:1","A glittering draught."],
   ["green_wrap","Green Poultice Wrap","uncommon","m.pressed_greens:2 m.poultice:1","Cooling wrap for scrapes."]]
   .forEach(([slug,name,r,ing,desc])=>{ const list = ings(ing); add("food_"+slug, name, "consumable", r, { desc }, list); });

  // 7) workshop goods (fire starters, ladders, paper) built from the processed materials
  [["fire_starter","Fire Starter Kit","common","m.kindling:2 m.tar_pitch:1","Strike once and it roars."],
   ["reinforced_planks","Reinforced Planks","uncommon","m.seasoned_planks:2 m.tar_pitch:1","Pitch-soaked and braced."],
   ["rope_ladder","Rope Ladder","uncommon","m.sturdy_rope:2 m.seasoned_planks:2","Climb anything."],
   ["torch_bundle","Torch Bundle","uncommon","m.torch:3 m.cordage:1","Light for a long night."],
   ["bark_paper","Bark Paper","uncommon","m.bark_sheets:3 m.resin_glue:1","Smooth enough to write on."],
   ["fern_rope","Fern Rope","common","m.fern_fiber:3 m.resin_glue:1","Rough but reliable."],
   ["basket","Woven Basket","common","m.wicker:3 m.cordage:1","Holds a surprising amount."],
   ["thatch_roofing","Thatch Roofing","common","m.thatch:3 m.tar_pitch:1","Keeps the rain out."],
   ["moss_cushion","Moss Cushion","common","m.moss_padding:2 m.reed_mat:1","A comfy seat."],
   ["herb_garden_kit","Herb Garden Kit","uncommon","m.herb_bundle:2 m.basket:1 m.moss_padding:1","Everything for a window planter."]]
   .forEach(([slug,name,r,ing,desc])=>{ const list = ings(ing); add("mat_"+slug, name, "material", r, { desc, ...sellItem(list,2.1) }, list); });
}
