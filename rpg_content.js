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
  ["ore_platinum","Platinum Ore","epic",105,"Dense, silvery-white precious ore."],
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
  green:  { label:"Green",  emoji:"🟢", blurb:"Normal. Forage: 50% chance of 1 item (30s cooldown). Mine: 80% reward / 20% hazard, 1 durability, 1 mineral. Fish: easy fish." },
  yellow: { label:"Yellow", emoji:"🟡", blurb:"Risky. Forage: 75% for 1–2 items, better rare odds (5 min cooldown). Mine: 2 durability, better gems, same 20% hazard. Fish: medium fish." },
  red:    { label:"Red",    emoji:"🔴", blurb:"Extreme. Forage: 90% for 1–3 items, best rare odds (30 min cooldown). Mine: 3 durability, best gems, same 20% hazard. Fish: hard fish." }
};
export const FORAGE_RULES = {
  green:  { chance:.50, qty:[1,1], cooldown:30*1000 },
  yellow: { chance:.75, qty:[1,2], cooldown:5*60*1000 },
  red:    { chance:.90, qty:[1,3], cooldown:30*60*1000 }
};
// Every mode: always exactly 1 mineral (double:0) and the SAME 20% hazard chance.
// Higher modes only cost more durability and shift the gem rarity odds (see RARITY_W).
export const MINE_RULES = {
  green:  { pos:.80, neg:.20, wear:1, double:0, cash:[20,100] },
  yellow: { pos:.80, neg:.20, wear:2, double:0, cash:[50,220] },
  red:    { pos:.80, neg:.20, wear:3, double:0, cash:[100,450] }
};
export const MINE_CASH_SHARE = 0.08;     // share of "good" swings that turn up cash instead of a mineral
export const FISH_RULES = {
  // bar = catch-bar height (px), time = ms before the fish slips off, speed = fish swim speed,
  // jitter = chance/tick of picking a new target, dash = chance/tick of a sudden dart, pause = max hover ticks
  // Difficulty shift: old medium -> easy, old hard -> medium, and a brand-new chaotic hard.
  // Optional extras (defaults keep the old behaviour): dashMul = dart speed multiplier, dashLen = [min,max] dart ticks,
  // flip = chance/tick a dart reverses mid-way, longMove = chance a new target is a full-bar leap, wobble = hover shake.
  green:  { tier:"easy",   bar:72, time:20000, speed:1.7, jitter:.040, dash:.014, pause:6,  gain:1.4, loss:1.2 },
  yellow: { tier:"medium", bar:72, time:20000, speed:2.4, jitter:.060, dash:.030, pause:4,  gain:1.3, loss:1.4 },
  red:    { tier:"hard",   bar:72, time:20000, speed:3.4, jitter:.120, dash:.065, pause:2,  gain:1.2, loss:1.7,
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
/* luck (0.1 = +10% luck): rare items weigh x(1+luck), epics x(1+2*luck), legendaries x(1+3*luck), then odds are re-normalised. */
export function rollPool(pool, luck=0){
  if(luck > 0){
    const mult = { rare:1+luck, epic:1+2*luck, legendary:1+3*luck };
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
  adamantite:["legendary",.5], diamond:["legendary",.65], starmetal:["legendary",1]
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
  return { hp: lerpR([hmin,hmax], t + c.sh), [p]: main, [q]: Math.max(1, Math.round(main*0.5)) };
}
const WEAPON_SHIFT = [0, -.06, .06, 0, .04, -.04];   // sword, dagger, axe, spear, mace, bow
export const craftedWeaponAttack = (rar, i=0, key)=>{
  const [r, t] = gearPower(key, rar);
  return lerpR(WEAPON_DAMAGE[r], t + WEAPON_SHIFT[i%6]);
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
   ["titanium","Titanium","ore_titanium","rare"],["platinum","Platinum","ore_platinum","epic"],
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
    ["Darksteel","ing_darksteel","epic","STRENGTH"],["Platinum","ing_platinum","epic","CHARM"],
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
  const heal = [[8,30],[25,65],[55,110],[100,160],[150,200]], mana = [[5,12],[10,25],[20,45],[35,80],[60,120]], rest = [[6,24],[20,50],[45,90],[85,140],[130,190]], restMana = [[3,8],[6,15],[12,28],[20,45],[35,70]];
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
