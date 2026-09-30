/* =========================================================================
   DRAGONEER — rpg_app.js
   Firebase-backed multiplayer doodle RPG.
   ========================================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, setPersistence, browserLocalPersistence,
  deleteUser, EmailAuthProvider, reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  initializeFirestore, doc, setDoc, getDoc, getDocs, updateDoc, onSnapshot, collection,
  addDoc, query, where, orderBy, limit, runTransaction, deleteDoc, arrayUnion, arrayRemove,
  increment, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAGgBTS_rLY1OFdNmEzPkeRx6ipaW-MP_o",
  authDomain: "game1-65ce0.firebaseapp.com",
  projectId: "game1-65ce0",
  storageBucket: "game1-65ce0.firebasestorage.app",
  messagingSenderId: "655445406483",
  appId: "1:655445406483:web:9264de939328cb553b20e6",
  measurementId: "G-YXYBS4VGXJ"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
setPersistence(auth, browserLocalPersistence).catch(()=>{});

/* Firebase Auth needs an email under the hood. Usernames are mapped to a
   synthetic address on the "players.dragoneer.game" domain so players only
   ever see/enter a username + password — this requires Email/Password
   sign-in to be enabled in the Firebase console (see deployment notes). */
const AUTH_DOMAIN = "players.dragoneer.game";
const usernameToEmail = (u) => `${u.toLowerCase()}@${AUTH_DOMAIN}`;

/* =========================================================================
   ERROR HANDLING HELPERS
   Every Firebase call that can plausibly fail (offline, denied by rules,
   race condition, bad input) is routed through one of these so the UI
   never just "goes quiet" — the player always gets a toast.
   ========================================================================= */
/* TEMP DEBUG SWITCH — set to false once auth/signup is confirmed working.
   While true, every Firebase error shown to the player (and logged) is the
   raw {code, message} instead of a friendly string, so nothing is hidden
   during debugging. */
const DEBUG_AUTH_ERRORS = true;

function friendlyFirebaseError(err){
  console.error("FIREBASE ERROR:", err?.code, err?.message, err);
  if(String(err?.message||"").startsWith("insufficient-item:")){
    const itemId = err.message.split(":")[1];
    return `You don't have enough ${ITEM_BY_ID[itemId]?.name || "of that item"} for that.`;
  }
  const code = err?.code || "";
  if(DEBUG_AUTH_ERRORS){
    return `[DEBUG] ${code || "unknown-code"}: ${err?.message || String(err)}`;
  }
  // NOTE: order matters here. "auth/user-not-found" and
  // "auth/configuration-not-found" both contain the substring "not-found",
  // so the generic not-found check MUST come after every specific code
  // that also happens to contain "not-found" — otherwise it shadows them
  // and every one of those errors gets mislabeled as "That no longer
  // exists.", which is exactly what was happening here.
  if(code.includes("permission-denied")) return `That action isn't allowed. (${code})`;
  if(code.includes("unavailable") || code.includes("network")) return "Connection problem — check your internet and try again.";
  if(code.includes("wrong-password") || code.includes("invalid-credential")) return "Wrong username or password.";
  if(code.includes("user-not-found")) return "No account with that username.";
  if(code.includes("email-already-in-use")) return "That username is taken.";
  if(code.includes("weak-password")) return "Password needs 6+ characters.";
  if(code.includes("invalid-email")) return `That username isn't valid. (${code})`;
  if(code.includes("configuration-not-found") || code.includes("operation-not-allowed")){
    return `Sign-in isn't configured correctly yet. (${code}) — enable Email/Password sign-in for this project in the Firebase console.`;
  }
  if(code.includes("not-found")) return `That no longer exists. (${code})`;
  // Fallback: never swallow the real reason. Show the raw code/message so
  // this is debuggable instead of a dead-end "Something went wrong."
  return `Something went wrong${code ? ` (${code})` : ""}: ${err?.message || err}`;
}
async function withErrorToast(fn){
  try{ return await fn(); }
  catch(err){ console.error(err); toast(friendlyFirebaseError(err)); return null; }
}

/* =========================================================================
   USERNAME / CHAT FILTER
   NOTE: this project intentionally does NOT ship a hard-coded list of
   slurs/profanity in source — bundling that word list is avoided on
   purpose. What's implemented instead: leetspeak/spacing normalization,
   a small blocklist of common mild profanity as a working example, and a
   clearly marked extension point (BLOCKLIST_EXTRA / moderateChatText)
   where you should plug in a real moderation source before launch — e.g.
   the Firebase "Moderate Text" / Perspective API extension, or an npm list
   like `bad-words`/`obscenity` loaded server-side via a Cloud Function so
   the real list never ships to clients (client-side lists are trivially
   bypassed anyway).
   ========================================================================= */
const BLOCKLIST_EXTRA = []; // <-- load a real moderation list/service here
const BASIC_BLOCKLIST = ["damn","hell","crap","ass","piss"]; // mild example only
function normalizeWord(w){
  return w.toLowerCase()
    .replace(/[0@]/g,'o').replace(/1|!/g,'i').replace(/3/g,'e')
    .replace(/4/g,'a').replace(/5|\$/g,'s').replace(/7/g,'t')
    .replace(/[^a-z]/g,'');
}
// IMPORTANT: this checks whole WORDS, not raw substrings. The previous
// version stripped spaces before matching, so "hello" (contains "hell"),
// "class"/"mass"/"glass" (contain "ass"), "scrap"/"crap" etc. were all
// getting silently mangled into asterisks — which is what made chat feel
// broken. Splitting on word boundaries first and only flagging an exact
// normalized-word match fixes that without weakening the filter itself.
function containsBlockedWord(raw){
  const blocked = new Set([...BASIC_BLOCKLIST, ...BLOCKLIST_EXTRA]);
  const words = String(raw).split(/[^A-Za-z0-9@!$]+/).map(normalizeWord).filter(Boolean);
  return words.some(w => blocked.has(w));
}
function isValidUsername(u){
  if(!/^[A-Za-z0-9_]{3,16}$/.test(u)) return "3-16 letters, numbers, underscore only.";
  if(containsBlockedWord(u)) return "That username isn't allowed.";
  return null;
}
function moderateChatText(t){
  return containsBlockedWord(t) ? "*".repeat(Math.min(t.length,12)) : t;
}

/* =========================================================================
   CORE GAME DATA
   ========================================================================= */
const ELEMENTS = {
  fire:  { name:"Fire",  boon:"rage",  strong:"earth", weak:"water", color:"#FFB199" },
  water: { name:"Water", boon:"mana",  strong:"fire",  weak:"air",   color:"#A8D8F0" },
  earth: { name:"Earth", boon:"xp",    strong:"air",   weak:"fire",  color:"#B7E4A8" },
  air:   { name:"Air",   boon:"hp",    strong:"water", weak:"earth", color:"#E4D6F7" }
};
const ARCHETYPE_DESC = {
  fire:  "More RAGE. Strong against Earth, weak to Water.",
  water: "More MANA. Strong against Fire, weak to Air.",
  earth: "More XP gain. Strong against Air, weak to Fire.",
  air:   "More HP. Strong against Water, weak to Earth."
};
const CLASSES = {
  warrior:{ name:"Warrior", desc:"Stronger, sword fighter, slower.", bonus:{STRENGTH:1} },
  mage:   { name:"Mage",    desc:"Smarter, mana fighter (spells), weaker.", bonus:{SMARTS:1} },
  cleric: { name:"Cleric",  desc:"More charm, mana/weapon mix, less smart.", bonus:{CHARM:1} },
  rogue:  { name:"Rogue",   desc:"Faster, small weapons and ranged, less charm.", bonus:{SPEED:1} }
};
const REGIONS = {
  forest:    { name:"Enchanted Forest", element:"earth", css:"region-forest",    track:"rpg_earth.mp3" },
  mountains: { name:"Frosted Mountains",element:"air",   css:"region-mountains", track:"rpg_air.mp3" },
  volcano:   { name:"Blackrock Volcano",element:"fire",  css:"region-volcano",   track:"rpg_fire.mp3" },
  reef:      { name:"Coral Reef Cove",  element:"water", css:"region-reef",      track:"rpg_water.mp3" }
};
const RARITIES = ["common","uncommon","rare","epic","legendary"];
const HEAL_BY_RARITY = { common:10, uncommon:40, rare:120, epic:300, legendary:500 };
const RARITY_MULT = { common:1, uncommon:1.4, rare:2, epic:3, legendary:4.5 };

function fmtMoney(n){
  n = Math.floor(n);
  const units = [[1e15,"Q"],[1e12,"T"],[1e9,"B"],[1e6,"M"],[1e3,"K"]];
  for(const [val,suf] of units){
    if(Math.abs(n) >= val) return (n/val).toFixed(2)+suf;
  }
  return String(n);
}

/* ---------- procedural item bank: 5 types x 96 = 480 items ---------- */
const ITEM_TYPES = ["weapon","armor","trinket","consumable","material"];
const PREFIXES = ["Rusty","Sturdy","Ancient","Glowing","Cursed","Blessed","Mystic","Shadow",
  "Radiant","Fragile","Gilded","Frosted","Ember","Coral","Windswept","Stone-etched",
  "Moonlit","Sunburnt","Dew-kissed","Thorned","Feathered","Scaled","Runic","Doodled"];
const BASE_NAMES = {
  weapon:["Sword","Dagger","Staff","Bow","Axe","Mace","Wand","Spear","Claws","Rapier","Fan","Chakram"],
  armor:["Helm","Hood","Coif","Tunic","Plate","Cuirass","Greaves","Leggings","Legwraps","Boots","Treads","Sabatons"],
  trinket:["Charm","Ring","Amulet","Locket","Bell","Feather","Bead","Totem","Pendant","Coin","Idol","Sigil"],
  consumable:["Potion","Elixir","Berry","Bread","Stew","Tonic","Draught","Cookie","Tea","Scroll","Candy","Brew"],
  material:["Scale","Claw","Fang","Ore","Crystal","Fiber","Resin","Dust","Shard","Feather","Root","Ember"]
};
// Armor now splits into 4 equip slots (helmet/chestplate/leggings/boots)
// instead of one generic "armor" slot — each base name below maps to
// exactly one of the 4, 3 names apiece, so the existing 12-name/96-item
// generation loop still produces an even spread across all four.
const ARMOR_SLOT_BY_NAME = {
  Helm:"helmet", Hood:"helmet", Coif:"helmet",
  Tunic:"chestplate", Plate:"chestplate", Cuirass:"chestplate",
  Greaves:"leggings", Leggings:"leggings", Legwraps:"leggings",
  Boots:"boots", Treads:"boots", Sabatons:"boots"
};
const ARMOR_SLOTS = ["helmet","chestplate","leggings","boots"];
function seededRand(seed){ let s = seed % 2147483647; if(s<=0)s+=2147483646;
  return () => (s = s*16807 % 2147483647) / 2147483647; }

function buildItemBank(){
  const bank = [];
  let id = 0;
  for(const type of ITEM_TYPES){
    const rnd = seededRand(1000 + ITEM_TYPES.indexOf(type));
    for(let i=0;i<96;i++){
      const prefix = PREFIXES[i % PREFIXES.length];
      const base = BASE_NAMES[type][i % BASE_NAMES[type].length];
      const rarity = RARITIES[Math.min(4, Math.floor(rnd()*rnd()*5))];
      const elementKeys = Object.keys(ELEMENTS);
      const element = elementKeys[i % 4];
      const mult = RARITY_MULT[rarity];
      const basePrice = Math.round((8 + rnd()*40) * mult * (type==="weapon"||type==="armor"?2.2:1));
      const item = {
        id: `itm_${type}_${id++}`,
        name: `${prefix} ${base}`,
        type, rarity, element,
        price: basePrice,
        sellPrice: Math.max(1, Math.round(basePrice*0.35)),
        desc: itemFlavor(type, prefix, base, element, rarity),
        stats: itemStats(type, rarity)
      };
      if(type==="armor") item.armorSlot = ARMOR_SLOT_BY_NAME[base] || "chestplate";
      bank.push(item);
    }
  }
  return bank;
}
function itemFlavor(type, prefix, base, element, rarity){
  const flavors = {
    weapon:`A ${rarity} ${base.toLowerCase()}, ${prefix.toLowerCase()} and humming faintly with ${ELEMENTS[element].name.toLowerCase()} energy.`,
    armor:`${prefix} ${base.toLowerCase()} that smells faintly of ${ELEMENTS[element].name.toLowerCase()} weather. Offers ${rarity} protection.`,
    trinket:`A small ${base.toLowerCase()}, ${prefix.toLowerCase()}, said to nudge fate for its wearer.`,
    consumable:`A ${prefix.toLowerCase()} ${base.toLowerCase()} — drink or eat to feel its ${rarity} effects.`,
    material:`Raw crafting material: a ${prefix.toLowerCase()} ${base.toLowerCase()}, useful at the forge.`
  };
  return flavors[type];
}
function itemStats(type, rarity){
  const m = RARITY_MULT[rarity];
  if(type==="weapon") return { attack: Math.round(3*m) };
  if(type==="armor") return { defense: Math.round(2*m), hp: Math.round(4*m) };
  if(type==="trinket"){
    const pool = ["SPEED","STRENGTH","CHARM","SMARTS"];
    const stat = pool[Math.floor(Math.random()*pool.length)];
    return { [stat]: Math.round(1*m), curse: Math.random()<0.15 };
  }
  if(type==="consumable") return { heal: HEAL_BY_RARITY[rarity], mana: Math.round(5*m) };
  return {}; // material: no combat stats, used in crafting
}
const ITEM_BANK = buildItemBank();
ITEM_BANK.filter(i=>i.type==="consumable").forEach(i=>{ i.price=Math.max(2,Math.round(i.price*0.3)); i.sellPrice=Math.max(1,Math.round(i.price*0.4)); });
const ITEM_BY_ID = Object.fromEntries(ITEM_BANK.map(i=>[i.id,i]));

/* ---------- job items: fish, ores/gems, and the tools jobs need ---------- */
const JOB_ITEM_BANK = [
  { id:"tool_pickaxe", name:"Pickaxe", type:"tool", rarity:"common", price:60, sellPrice:20, desc:"Needed to mine rocks.", stats:{} },
  { id:"tool_fishingrod", name:"Fishing Rod", type:"tool", rarity:"common", price:60, sellPrice:20, desc:"Needed to fish.", stats:{} },
  { id:"fish_minnow", name:"Minnow", type:"consumable", rarity:"common", sellPrice:4, desc:"A tiny fish.", stats:{} },
  { id:"fish_bass", name:"Bass", type:"consumable", rarity:"uncommon", sellPrice:10, desc:"A decent catch.", stats:{} },
  { id:"fish_trout", name:"Trout", type:"consumable", rarity:"uncommon", sellPrice:14, desc:"A tasty trout.", stats:{} },
  { id:"fish_swordfish", name:"Swordfish", type:"consumable", rarity:"rare", sellPrice:35, desc:"A prized catch.", stats:{} },
  { id:"fish_golden", name:"Golden Koi", type:"consumable", rarity:"legendary", sellPrice:120, desc:"Extremely rare.", stats:{} },
  { id:"ore_copper", name:"Copper Ore", type:"material", rarity:"common", sellPrice:5, desc:"Common ore.", stats:{} },
  { id:"ore_iron", name:"Iron Ore", type:"material", rarity:"uncommon", sellPrice:12, desc:"Sturdy ore.", stats:{} },
  { id:"gem_quartz", name:"Quartz Shard", type:"material", rarity:"rare", sellPrice:30, desc:"A clear gem.", stats:{} },
  { id:"gem_ruby", name:"Ruby", type:"material", rarity:"epic", sellPrice:80, desc:"A brilliant red gem.", stats:{} },
  { id:"forage_berry", name:"Wild Berries", type:"consumable", rarity:"common", sellPrice:3, desc:"Foraged berries.", stats:{heal:4} },
  { id:"forage_herb", name:"Healing Herb", type:"material", rarity:"uncommon", sellPrice:9, desc:"A useful herb.", stats:{} },
  { id:"forage_mushroom", name:"Wild Mushroom", type:"material", rarity:"common", sellPrice:5, desc:"Foraged mushroom.", stats:{} }
];
// Durability tiers: basic 3 -> 10 -> 25 -> 50 -> 100 (best). Tiers 5 and 6 both top out at 100.
const TOOL_USES = { tool_pickaxe:3, tool_fishingrod:3, tool_pickaxe2:10, tool_fishingrod2:10, tool_pickaxe3:25, tool_fishingrod3:25 };
[["tool_pickaxe2","Sturdy Pickaxe",150,"uncommon",10],["tool_pickaxe3","Iron Pickaxe",400,"rare",25],
 ["tool_fishingrod2","Sturdy Fishing Rod",150,"uncommon",10],["tool_fishingrod3","Iron Fishing Rod",400,"rare",25]]
 .forEach(([id,name,price,rarity,uses])=> JOB_ITEM_BANK.push({ id,name,type:"tool",rarity,price,sellPrice:Math.round(price/3),desc:`Breaks after ${uses} uses.`,stats:{} }));
JOB_ITEM_BANK.push(
 { id:"ore_coal", name:"Coal", type:"material", rarity:"common", sellPrice:4, desc:"Fuel for cooking and smelting.", stats:{} },
 { id:"ore_silver", name:"Silver Ore", type:"material", rarity:"uncommon", sellPrice:18, desc:"A gleaming ore.", stats:{} },
 { id:"ore_gold", name:"Gold Ore", type:"material", rarity:"rare", sellPrice:40, desc:"Heavy, shiny ore.", stats:{} },
 { id:"gem_sapphire", name:"Sapphire", type:"material", rarity:"rare", sellPrice:55, desc:"A deep blue gem.", stats:{} },
 { id:"gem_emerald", name:"Emerald", type:"material", rarity:"epic", sellPrice:110, desc:"A vivid green gem.", stats:{} },
 { id:"gem_diamond", name:"Diamond", type:"material", rarity:"legendary", sellPrice:250, desc:"The hardest gem of all.", stats:{} },
 { id:"forage_apple", name:"Wild Apple", type:"consumable", rarity:"uncommon", sellPrice:8, desc:"A crisp foraged apple.", stats:{} },
 { id:"forage_truffle", name:"Forest Truffle", type:"consumable", rarity:"rare", sellPrice:25, desc:"A prized foraged truffle.", stats:{} },
 { id:"forage_goldapple", name:"Golden Apple", type:"consumable", rarity:"legendary", sellPrice:100, desc:"Glows faintly. Restores a ton.", stats:{} });
JOB_ITEM_BANK.filter(i=>i.id==="tool_pickaxe"||i.id==="tool_fishingrod").forEach(i=> i.desc+=" Breaks after 3 uses.");
JOB_ITEM_BANK.filter(i=>i.type==="consumable").forEach(i=> i.stats.heal = Math.round(HEAL_BY_RARITY[i.rarity]*(i.id.startsWith("fish_")?0.6:1)));
JOB_ITEM_BANK.forEach(i=> ITEM_BY_ID[i.id]=i);

/* ---------- procedural enemy bank: 4 regions x 3 difficulties x 10 = 120 ---------- */
const ENEMY_NAME_PARTS = {
  forest:["Bramblefang","Mosshide","Thornback","Glade Sprite","Root Walker","Acorn Golem","Fern Wisp","Vine Serpent","Bark Beetle","Sap Slime"],
  mountains:["Frost Yeti","Gale Hawk","Ice Wraith","Snow Wolf","Cloud Ram","Rime Bat","Windshard","Glacier Troll","Peak Harpy","Chill Sprite"],
  volcano:["Ember Imp","Ash Drake","Magma Crab","Cinder Wolf","Lava Golem","Flare Bat","Coal Fiend","Soot Hound","Sulfur Wisp","Brimstone Ogre"],
  reef:["Coral Crab","Tide Serpent","Bubble Jelly","Pearl Turtle","Riptide Shark","Kelp Wisp","Foam Sprite","Shell Guardian","Abyssal Eel","Barnacle Brute"]
};
const DIFF = {
  easy:{ mult:0.9, xp:[4,8], money:[8,20] },
  medium:{ mult:1.0, xp:[8,14], money:[15,35] },
  hard:{ mult:1.3, xp:[16,32], money:[35,80] }
};
/* Monster level is generated RELATIVE to the player's CURRENT level at the
   moment the monster spawns, per design:
     easy:   playerLevel - (0 to 2), floored at level 1
     medium: playerLevel +/- 3, randomly
     hard:   playerLevel + (1 to 3)
   buildEnemyBank() only enumerates the 10 name slots per region for
   variety; level/stats are computed fresh in makeMonsterFromSlot() using
   whatever the player's level is right now. */
function rollMonsterLevel(diff, playerLevel, rnd=Math.random){
  playerLevel = Math.max(1, playerLevel||1);
  if(diff==="easy"){
    const under = Math.floor(rnd()*3); // 0-2 levels under, min level 1
    return Math.max(1, playerLevel - under);
  }
  if(diff==="hard"){
    const over = 1 + Math.floor(rnd()*3); // 1-3 levels over
    return playerLevel + over;
  }
  const delta = Math.floor(rnd()*7) - 3; // medium: -3..+3, randomly
  return Math.max(1, playerLevel + delta);
}
function buildEnemyBank(){
  const bank = [];
  let id=0;
  for(const region of Object.keys(REGIONS)){
    for(const diff of Object.keys(DIFF)){
      const names = ENEMY_NAME_PARTS[region];
      for(let i=0;i<10;i++){
        bank.push({ id:`enm_${id++}`, name:names[i], region, difficulty:diff });
      }
    }
  }
  return bank;
}
const ENEMY_BANK = buildEnemyBank();
// Builds a full monster from a name/region/diff slot at a level computed
// relative to the player's level right now.
function makeMonsterFromSlot(slot, playerLevel, rnd=Math.random){
  const d = DIFF[slot.difficulty];
  const lvl = rollMonsterLevel(slot.difficulty, playerLevel, rnd);
  return {
    id: slot.id, name: slot.name, region: slot.region, difficulty: slot.difficulty,
    level: lvl, element: REGIONS[slot.region].element,
    hp: Math.round((20 + lvl*8) * d.mult),
    attack: Math.round((3 + lvl*1.5) * d.mult),
    xpReward: Math.round(d.xp[0] + rnd()*(d.xp[1]-d.xp[0])),
    moneyReward: Math.round(d.money[0] + rnd()*(d.money[1]-d.money[0])),
    dropChance: slot.difficulty==="easy"?0.25:slot.difficulty==="medium"?0.45:0.7
  };
}

/* =========================================================================
   DRAGON DOODLE (2-frame hand-drawn animation)
   Redrawn as one cohesive curled-up dragon (snout, horns, folded wings,
   a spiral tail, closed sleepy eyes, tucked paw) instead of loose floating
   shapes, while keeping the flat pastel hand-drawn look and the 2-frame
   swap-every-second "gif" breathing effect.
   ========================================================================= */
function dragonFrame(breathe){
  const lift = breathe ? -3 : 0;     // whole body rises slightly on the "in-breath" frame
  const INK = "#4A3F35";
  const BODY = "#CDEFC2";
  const BODY_D = "#A9DE9B";
  const BELLY = "#F3FBEE";
  return `
  <!-- curled tail, drawn first so the body overlaps its base -->
  <path d="M266,${178+lift} C298,${186+lift} 320,${164+lift} 313,${134+lift}
           C309,${116+lift} 292,${104+lift} 277,${112+lift}
           C289,${118+lift} 299,${132+lift} 294,${147+lift}
           C290,${160+lift} 278,${168+lift} 264,${170+lift} Z"
        fill="${BODY}" stroke="${INK}" stroke-width="4" filter="url(#doodleWobble)"/>

  <!-- main curled body -->
  <ellipse cx="190" cy="${172+lift}" rx="112" ry="50" fill="${BODY}" stroke="${INK}" stroke-width="4.5" filter="url(#doodleWobble)"/>

  <!-- folded wings along the spine -->
  <path d="M152,${132+lift} Q145,${106+lift} 163,${99+lift} Q170,${116+lift} 163,${128+lift}
           Q176,${114+lift} 188,${120+lift} Q180,${134+lift} 165,${138+lift} Z"
        fill="${BODY_D}" stroke="${INK}" stroke-width="3" filter="url(#doodleWobble)"/>
  <path d="M206,${130+lift} Q202,${104+lift} 220,${99+lift} Q226,${116+lift} 218,${127+lift}
           Q231,${115+lift} 242,${122+lift} Q233,${135+lift} 219,${138+lift} Z"
        fill="${BODY_D}" stroke="${INK}" stroke-width="3" filter="url(#doodleWobble)"/>

  <!-- spine ridge bumps -->
  <path d="M118,${132+lift} l9,-15 l9,15 Z" fill="${BODY_D}" stroke="${INK}" stroke-width="2"/>
  <path d="M148,${122+lift} l8,-14 l8,14 Z" fill="${BODY_D}" stroke="${INK}" stroke-width="2"/>

  <!-- tucked front paw -->
  <ellipse cx="150" cy="${203+lift}" rx="17" ry="11" fill="${BODY}" stroke="${INK}" stroke-width="3"/>
  <path d="M140,${205+lift} l-4,5 M148,${208+lift} l-2,6 M157,${208+lift} l1,6" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>

  <!-- belly shading -->
  <path d="M108,${196+lift} Q190,${214+lift} 270,${194+lift}" stroke="${BELLY}" stroke-width="10" fill="none" opacity="0.55" stroke-linecap="round"/>

  <!-- neck bridge so head reads as part of the body, not a floating circle -->
  <ellipse cx="132" cy="${158+lift}" rx="38" ry="31" fill="${BODY}" stroke="${INK}" stroke-width="3.5" filter="url(#doodleWobble)"/>

  <!-- head -->
  <ellipse cx="98" cy="${149+lift}" rx="44" ry="37" fill="${BODY}" stroke="${INK}" stroke-width="4.5" filter="url(#doodleWobble)"/>

  <!-- horns -->
  <path d="M84,${116+lift} Q73,${92+lift} 58,${86+lift}" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M104,${113+lift} Q99,${88+lift} 87,${79+lift}" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>

  <!-- snout -->
  <ellipse cx="60" cy="${159+lift}" rx="25" ry="18" fill="${BODY}" stroke="${INK}" stroke-width="4" filter="url(#doodleWobble)"/>

  <!-- closed sleepy eye -->
  <path d="M72,${138+lift} Q83,${131+lift} 94,${138+lift}" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <path d="M92,${137+lift} l7,-4" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>

  <!-- nostril + mouth -->
  <circle cx="42" cy="${161+lift}" r="2.6" fill="${INK}"/>
  <path d="M50,${170+lift} Q62,${176+lift} 74,${170+lift}" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>

  <!-- breath puff, only on the exhale frame -->
  ${breathe ? `
  <circle cx="30" cy="${158}" r="4.5" fill="#FFFFFF" opacity="0.75"/>
  <circle cx="20" cy="151" r="2.8" fill="#FFFFFF" opacity="0.55"/>` : ``}

  <text x="150" y="${68+lift}" font-family="Caveat, cursive" font-size="28" fill="${INK}" opacity="${breathe?1:0.45}">z z z</text>
  `;
}
function setupDragonAnim(){
  let frame = false;
  const svgs = () => document.querySelectorAll(".dragon-doodle");
  const render = () => svgs().forEach(s => s.innerHTML = dragonFrame(frame));
  render();
  setInterval(()=>{ frame = !frame; render(); }, 1000);
}

/* =========================================================================
   AUDIO
   ========================================================================= */
const musicEl = () => document.getElementById("music-player");
function playSfx(name){
  if(state.settings.muteSfx) return;
  const el = document.getElementById(`sfx-${name}`); if(!el) return;
  // a fresh Audio per play, so repeated sounds overlap instead of restarting
  const a = new Audio(el.currentSrc || el.src); a.volume = el.volume;
  a.addEventListener("ended", ()=> a.remove?.()); a.play().catch(()=>{});
}
function playMusic(src){
  const el = musicEl(); if(!el) return;
  if(state.settings.muteMusic){ el.pause(); return; }
  if(el.getAttribute('data-track') === src) return;
  el.style.transition="opacity 1s";
  el.volume = 0.5;
  el.setAttribute('data-track', src);
  el.src = src;
  el.play().catch(()=>{});
}

/* =========================================================================
   TOASTS
   ========================================================================= */
function toast(msg, ms=3500, cls=""){
  const stack = document.getElementById("toast-stack");
  const t = document.createElement("div");
  t.className="toast"+(cls?" "+cls:""); t.textContent=msg;
  stack.appendChild(t);
  setTimeout(()=>t.remove(), ms);
}

/* =========================================================================
   SCREEN NAV
   ========================================================================= */
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}
function openModal(id){ document.getElementById(id).classList.add("active"); }
function closeModal(id){ document.getElementById(id).classList.remove("active"); }
document.querySelectorAll("[data-close-modal]").forEach(b=>{
  b.addEventListener("click", ()=> b.closest(".modal-backdrop").classList.remove("active"));
});

/* =========================================================================
   GLOBAL STATE
   ========================================================================= */
const state = {
  uid:null, username:null,
  profile:null,           // mirrors Firestore player doc
  settings:{ muteMusic:false, muteSfx:false },
  selArchetype:null, selClass:null,
  invPage:0,
  currentChatPartner:null,
  pmContactsExtra:{},     // uid -> username for people you've PM'd who aren't (yet) friends
  craftA:null, craftB:null,
  selectedInvItem:null,
  battle:null,
  unsubs:[]
};

/* Player doc must be creatable with NO archetype/class yet (signup happens
   before archetype/class selection), so every lookup below is guarded. */
function defaultPlayerDoc(username, archetype, klass){
  const bonus = (klass && CLASSES[klass]) ? CLASSES[klass].bonus : {};
  const stats = { SPEED:0, STRENGTH:0, CHARM:0, SMARTS:0, ...bonus };
  const boon = (archetype && ELEMENTS[archetype]) ? ELEMENTS[archetype].boon : null;
  const bars = { hp:100, hpMax:100, mana:20, manaMax:20, rage:10, rageMax:10, xp:0, xpMax:10 };
  if(boon==="hp"){ bars.hp=120; bars.hpMax=120; }
  if(boon==="mana"){ bars.mana=26; bars.manaMax=26; }
  if(boon==="rage"){ bars.rage=14; bars.rageMax=14; }
  return {
    username, archetype: archetype||null, klass: klass||null, level:1, money:100,
    stats, ...bars,
    region:"forest",
    inventory: [], // {itemId, qty}
    equipped: { weapon:null, helmet:null, chestplate:null, leggings:null, boots:null, trinket:null },
    kills:0, deaths:0, killstreak:0, monstersKilled:0,
    friends: [], sentFriendRequests: [], createdAt: Date.now(),
    lastHpRegenTs: Date.now(), // used to catch up 10hp/hour regen even while the game was closed
    lastForageTs: 0, mineHourStart: 0, minePicksThisHour: 0, fishingXp: 0, miningXp: 0, foragingXp: 0
  };
}
const HP_REGEN_PER_HOUR = 1; // now per MINUTE
const HP_REGEN_MS = 60*1000;
/* Catches up HP regen for however long the player was away (or since the
   last catch-up), at 10 HP per full hour elapsed, capped at hpMax. Safe to
   call often — it's a no-op unless at least one full hour has passed. Also
   used for the live in-session ticking (called every minute while the tab
   is open) so regen keeps happening even if the player never reloads. */
async function catchUpHpRegen(p){
  if(!p || p.hp >= p.hpMax) {
    // still bump the timestamp forward so a full-HP player doesn't bank
    // hours of regen for later
    if(p && p.lastHpRegenTs && Date.now()-p.lastHpRegenTs >= HP_REGEN_MS){
      await updateDoc(doc(db,"players",state.uid), { lastHpRegenTs: Date.now() }).catch(()=>{});
    }
    return;
  }
  const last = p.lastHpRegenTs || p.createdAt || Date.now();
  const elapsedHours = Math.floor((Date.now()-last)/HP_REGEN_MS);
  if(elapsedHours <= 0) return;
  const newHp = Math.min(p.hpMax, p.hp + elapsedHours*HP_REGEN_PER_HOUR);
  const newTs = last + elapsedHours*HP_REGEN_MS; // carry remainder forward, don't discard partial progress
  await updateDoc(doc(db,"players",state.uid), { hp:newHp, lastHpRegenTs:newTs }).catch(()=>{});
}
/* Applies the chosen archetype/class to an EXISTING player doc without
   wiping fields the player may already have (money/inventory/etc.), unlike
   re-running defaultPlayerDoc() over the top of it. */
function archetypeClassUpdates(archetype, klass){
  const bonus = CLASSES[klass].bonus;
  const stats = { SPEED:0, STRENGTH:0, CHARM:0, SMARTS:0, ...bonus };
  const boon = ELEMENTS[archetype].boon;
  const updates = { archetype, klass, stats };
  if(boon==="hp"){ updates.hp=120; updates.hpMax=120; }
  if(boon==="mana"){ updates.mana=26; updates.manaMax=26; }
  if(boon==="rage"){ updates.rage=14; updates.rageMax=14; }
  return updates;
}

/* =========================================================================
   AUTH FLOW
   ========================================================================= */
let authMode = "signup";
document.getElementById("btnLogin").addEventListener("click", ()=>{
  authMode="login";
  document.getElementById("authTitle").textContent="Log In";
  document.getElementById("authSubmit").textContent="Log In";
  document.getElementById("authError").textContent="";
  openModal("authModal");
});
document.getElementById("btnSignup").addEventListener("click", ()=>{
  authMode="signup";
  document.getElementById("authTitle").textContent="Sign Up";
  document.getElementById("authSubmit").textContent="Create Account";
  document.getElementById("authError").textContent="";
  openModal("authModal");
});
// Set true for the entire duration of the signup/login submit handler.
// onAuthStateChanged fires the instant Firebase considers the user signed
// in — which, on signup, is BEFORE this file has finished writing
// /players/{uid} and /usernames/{username}. Without this guard the global
// listener races the signup handler, sees no player doc yet, and signs the
// brand-new account back out — which then makes the signup handler's own
// still-pending setDoc calls fail with permission-denied because the user
// is no longer authenticated by the time they run.
let authFlowBusy = false;

/* Shared by onAuthStateChanged (page load / token refresh / other tabs)
   and the auth form itself (right after a signup/login it just performed),
   so both paths route the player the same way without racing each other. */
async function loadPlayerAndRoute(user){
  cleanupSubs();
  if(!user){ showScreen("screen-title"); playMusic("rpg_title.mp3"); return; }
  state.uid = user.uid;
  let psnap;
  try{
    psnap = await getDoc(doc(db,"players",user.uid));
  }catch(err){
    toast(friendlyFirebaseError(err));
    showScreen("screen-title");
    return;
  }
  if(!psnap.exists()){
    // signed in but the player document is missing (deleted, or account
    // creation was interrupted) — don't hang silently, get them back to a
    // known-good state instead.
    toast("Your account data couldn't be found. Please sign up again.");
    await signOut(auth).catch(()=>{});
    showScreen("screen-title");
    return;
  }
  const p = psnap.data();
  state.username = p.username;
  if(!p.archetype || !p.klass){
    showScreen("screen-archetype");
  } else {
    enterGame();
  }
}

document.getElementById("authForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const uname = document.getElementById("authUsername").value.trim();
  const pass = document.getElementById("authPassword").value;
  const errEl = document.getElementById("authError");
  const submitBtn = document.getElementById("authSubmit");
  errEl.textContent="";
  submitBtn.disabled = true;
  authFlowBusy = true;
  try{
    if(authMode==="signup"){
      const problem = isValidUsername(uname);
      if(problem){ errEl.textContent = problem; return; }
      if(pass.length < 6){ errEl.textContent="Password needs 6+ characters."; return; }

      // reserve the username first so two people can't grab the same one
      let takenSnap;
      try{
        takenSnap = await getDoc(doc(db,"usernames",uname.toLowerCase()));
      }catch(err){ errEl.textContent = friendlyFirebaseError(err); return; }
      if(takenSnap.exists()){ errEl.textContent="That username is taken."; return; }

      let cred;
      try{
        cred = await createUserWithEmailAndPassword(auth, usernameToEmail(uname), pass);
      }catch(err){ errEl.textContent = friendlyFirebaseError(err); return; }

      try{
        const pdoc = defaultPlayerDoc(uname, null, null);
        await setDoc(doc(db,"players",cred.user.uid), pdoc);
        await setDoc(doc(db,"usernames",uname.toLowerCase()), { uid:cred.user.uid });
      }catch(err){
        console.error("SIGNUP FIRESTORE ERROR:", err);
        // roll back the auth account so we don't leave an orphaned login
        // with no matching player document
        try{ await cred.user.delete(); }catch(e2){ console.error("ROLLBACK DELETE FAILED:", e2); }
        errEl.textContent = DEBUG_AUTH_ERRORS
          ? `[DEBUG] player/username doc create failed: ${err?.code||"unknown"}: ${err?.message||err}`
          : "Couldn't finish creating your account. Please try again.";
        return;
      }
      closeModal("authModal");
      await loadPlayerAndRoute(cred.user);
    } else {
      let cred;
      try{
        cred = await signInWithEmailAndPassword(auth, usernameToEmail(uname), pass);
      }catch(err){ errEl.textContent = friendlyFirebaseError(err); return; }
      closeModal("authModal");
      await loadPlayerAndRoute(cred.user);
    }
  } finally {
    authFlowBusy = false;
    submitBtn.disabled = false;
  }
});
document.getElementById("btnLogout").addEventListener("click", async ()=>{
  await withErrorToast(()=> signOut(auth));
  closeModal("settingsModal");
});

document.getElementById("btnShowDeleteAccount").addEventListener("click", ()=>{
  document.getElementById("deleteAccountConfirm").style.display = "block";
  document.getElementById("deleteAccountPassword").value = "";
  document.getElementById("deleteAccountError").textContent = "";
});
document.getElementById("btnConfirmDeleteAccount").addEventListener("click", async ()=>{
  const pass = document.getElementById("deleteAccountPassword").value;
  const errEl = document.getElementById("deleteAccountError");
  errEl.textContent = "";
  if(!pass){ errEl.textContent = "Enter your password to confirm."; return; }
  const btn = document.getElementById("btnConfirmDeleteAccount");
  btn.disabled = true;
  try{
    // Firebase requires a recent sign-in for account deletion; re-proving
    // the password here covers both that requirement and "are you sure".
    const cred = EmailAuthProvider.credential(usernameToEmail(state.username), pass);
    await reauthenticateWithCredential(auth.currentUser, cred);

    // Firestore data must go BEFORE the Auth user — once that's deleted
    // the client is signed out and loses write access to clean anything up.
    const questsSnap = await getDocs(collection(db,"players",state.uid,"quests"));
    for(const d of questsSnap.docs) await deleteDoc(d.ref);
    const inboxSnap = await getDocs(collection(db,"players",state.uid,"inbox"));
    for(const d of inboxSnap.docs) await deleteDoc(d.ref);
    await deleteDoc(doc(db,"players",state.uid));
    await deleteDoc(doc(db,"usernames",state.username.toLowerCase())).catch(()=>{});

    await deleteUser(auth.currentUser);
    toast("Your account has been deleted.");
    closeModal("settingsModal");
    cleanupSubs();
    showScreen("screen-title");
    playMusic("rpg_title.mp3");
  }catch(err){
    errEl.textContent = friendlyFirebaseError(err);
  }finally{
    btn.disabled = false;
  }
});

onAuthStateChanged(auth, async (user)=>{
  // The auth form calls loadPlayerAndRoute() itself once signup/login
  // finishes — skip here so we don't race it (see authFlowBusy above).
  if(authFlowBusy) return;
  await loadPlayerAndRoute(user);
});

/* =========================================================================
   ARCHETYPE + CLASS SELECT
   ========================================================================= */
function renderRuneGrid(){
  const grid = document.getElementById("runeGrid");
  grid.innerHTML="";
  Object.entries(ELEMENTS).forEach(([key,el])=>{
    const card = document.createElement("div");
    card.className = `rune-card rune-${key}`;
    card.innerHTML = `<div style="font-size:34px">${{fire:"🔥",water:"💧",earth:"🌱",air:"💨"}[key]}</div><div>${el.name}</div>`;
    card.addEventListener("mouseenter", ()=> document.getElementById("archetypeDesc").innerHTML=`<b>${el.name}:</b> ${ARCHETYPE_DESC[key]}`);
    card.addEventListener("click", ()=>{
      state.selArchetype = key;
      grid.querySelectorAll(".rune-card").forEach(c=>c.classList.remove("selected"));
      card.classList.add("selected");
      document.getElementById("btnConfirmArchetype").disabled=false;
      document.getElementById("archetypeDesc").innerHTML=`<b>${el.name}:</b> ${ARCHETYPE_DESC[key]}`;
      playSfx("click");
    });
    grid.appendChild(card);
  });
}
document.getElementById("btnConfirmArchetype").addEventListener("click", ()=>{
  if(!state.selArchetype) return;
  showScreen("screen-class");
});
function renderClassGrid(){
  const grid = document.getElementById("classGrid");
  grid.innerHTML="";
  Object.entries(CLASSES).forEach(([key,c])=>{
    const card = document.createElement("div");
    card.className="class-card";
    card.innerHTML = `<div style="font-size:34px">${{warrior:"⚔️",mage:"🪄",cleric:"✨",rogue:"🗡️"}[key]}</div><div>${c.name}</div>`;
    card.addEventListener("mouseenter", ()=> document.getElementById("classDesc").innerHTML=`<b>${c.name}:</b> ${c.desc}`);
    card.addEventListener("click", ()=>{
      state.selClass = key;
      grid.querySelectorAll(".class-card").forEach(c2=>c2.classList.remove("selected"));
      card.classList.add("selected");
      document.getElementById("btnConfirmClass").disabled=false;
      document.getElementById("classDesc").innerHTML=`<b>${c.name}:</b> ${c.desc}`;
      playSfx("click");
    });
    grid.appendChild(card);
  });
}
document.getElementById("btnConfirmClass").addEventListener("click", async ()=>{
  if(!state.selClass || !state.uid) return;
  const btn = document.getElementById("btnConfirmClass");
  btn.disabled = true;
  const ok = await withErrorToast(async ()=>{
    await updateDoc(doc(db,"players",state.uid), archetypeClassUpdates(state.selArchetype, state.selClass));
    return true;
  });
  btn.disabled = false;
  if(ok) enterGame();
});
renderRuneGrid();
renderClassGrid();

/* =========================================================================
   ENTER GAME / LIVE SYNC
   ========================================================================= */
function cleanupSubs(){
  state.unsubs.forEach(u=>u()); state.unsubs=[]; chatSubbed=false; pmUnsub=null;
  if(auctionUnsub){ auctionUnsub(); auctionUnsub=null; }
  stopManaRegen(); bossCleanup();
  if(state.hpRegenInterval){ clearInterval(state.hpRegenInterval); state.hpRegenInterval=null; }
}

function enterGame(){
  showScreen("screen-game");
  let firstSnapshot = true;
  const unsub = onSnapshot(doc(db,"players",state.uid), (snap)=>{
    if(!snap.exists()) return;
    const prevRegion = state.profile?.region;
    state.profile = snap.data();
    renderHUD();
    if(document.getElementById("journalModal").classList.contains("active")) renderInventory();
    // Keep music in sync with whatever region is actually on the player
    // doc — on first load (including re-signing in mid-session) and any
    // time the region field itself changes, not just on manual travel.
    if(firstSnapshot || state.profile.region !== prevRegion){
      const r = REGIONS[state.profile.region] || REGIONS.forest;
      playMusic(r.track);
    }
    if(firstSnapshot){
      catchUpHpRegen(state.profile); // pick up hours missed while the game was closed
      const since = state.profile.lastSeen; updateDoc(doc(db,"players",state.uid), { lastSeen: Date.now() }).catch(()=>{}); showRecap(since); ensureChatSubscriptions(); initBoss(); startManaRegen();
    }
    firstSnapshot = false;
  }, (err)=> toast(friendlyFirebaseError(err)));
  state.unsubs.push(unsub);
  subscribeGlobalChat();
  if(state.hpRegenInterval) clearInterval(state.hpRegenInterval);
  // Re-check every minute while the tab is open so regen still lands on
  // the hour even without a reload; catchUpHpRegen itself no-ops unless a
  // full hour has actually elapsed.
  // 1 HP/min now rides on the single per-minute heartbeat (startManaRegen)
}
function renderHUD(){
  const p = state.profile; if(!p) return;
  document.getElementById("hudName").textContent = p.username;
  document.getElementById("hudLevel").textContent = p.level;
  document.getElementById("hudArchetype").textContent = ELEMENTS[p.archetype].name;
  document.getElementById("hudClass").textContent = CLASSES[p.klass].name;
  document.getElementById("hudMoney").textContent = fmtMoney(p.money);
  document.getElementById("hudRegion").textContent = REGIONS[p.region].name;

  document.getElementById("regionBg").className = "paper-bg " + REGIONS[p.region].css;

  setBar("HP", p.hp, p.hpMax);
  setBar("MANA", p.mana, p.manaMax);
  setBar("RAGE", p.rage, p.rageMax);
  setBar("XP", p.xp, p.xpMax);

  document.getElementById("statSPEED").textContent = p.stats.SPEED;
  document.getElementById("statSTRENGTH").textContent = p.stats.STRENGTH;
  document.getElementById("statCHARM").textContent = p.stats.CHARM;
  document.getElementById("statSMARTS").textContent = p.stats.SMARTS;
  const bm=document.getElementById("bossMine"); if(bm) bm.textContent=fmtBig(p.bossDamage||0);
}
function setBar(key, val, max){
  const pct = Math.max(0, Math.min(100, (val/max)*100));
  document.getElementById("bar"+key).style.width = pct+"%";
  document.getElementById("num"+key).textContent = `${Math.max(0,Math.round(val))}/${max}`;
}

/* level-up: xp scales by 1.2x rounded down each level */
const SKILL_KEYS = ["SPEED","STRENGTH","CHARM","SMARTS"];
async function grantXP(amount){
  await withErrorToast(async ()=>{
    let p = state.profile;
    let xp = p.xp + amount;
    let xpMax = p.xpMax;
    let level = p.level;
    let levelsGained = 0;
    const stats = { ...p.stats };
    while(xp >= xpMax){
      xp -= xpMax;
      xpMax = Math.floor(xpMax*1.2);
      level++;
      levelsGained++;
      // one free skill point per level, dropped into a random stat
      const pick = SKILL_KEYS[Math.floor(Math.random()*SKILL_KEYS.length)];
      stats[pick] = (stats[pick]||0) + 1;
    }
    const updates = { xp, xpMax, level };
    if(levelsGained > 0){
      updates.stats = stats;
      updates.hpMax = p.hpMax + 10*levelsGained;
      updates.hp = updates.hpMax;
      updates.manaMax = p.manaMax + 3*levelsGained;
      updates.mana = updates.manaMax;
      playSfx("levelup");
      toast(`Level up! You are now level ${level} (+${levelsGained} skill point${levelsGained>1?"s":""}).`);
    }
    await updateDoc(doc(db,"players",state.uid), updates);
  });
}
async function grantMoney(amount){
  await withErrorToast(()=> runTransaction(db, async tx=>{
    const ref = doc(db,"players",state.uid), snap = await tx.get(ref);
    tx.update(ref, { money: Math.max(0, (snap.data().money||0) + amount) });
  }));
}

/* =========================================================================
   INVENTORY / EQUIPMENT / JOURNAL
   ========================================================================= */
document.getElementById("btnJournal").addEventListener("click", ()=>{ openModal("journalModal"); renderInventory(); renderLeaderboard("money"); renderQuests(); });
document.querySelectorAll("[data-jtab]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll("[data-jtab]").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".jtab-page").forEach(p=>p.classList.remove("active"));
    document.getElementById("jtab-"+btn.dataset.jtab).classList.add("active");
  });
});

function invExpanded(){
  const p = state.profile; if(!p) return [];
  return (p.inventory||[]).map(entry => ({ ...entry, item: ITEM_BY_ID[entry.itemId] })).filter(e=>e.item);
}
function renderInventory(){
  const grid = document.getElementById("invGrid");
  const items = invExpanded();
  const perPage = 12;
  const pages = Math.max(1, Math.ceil(items.length/perPage));
  state.invPage = Math.min(state.invPage, pages-1);
  const slice = items.slice(state.invPage*perPage, state.invPage*perPage+perPage);
  grid.innerHTML="";
  for(let i=0;i<perPage;i++){
    const cell = document.createElement("div");
    const entry = slice[i];
    cell.className = "inv-cell" + (entry? " rarity-"+entry.item.rarity : "");
    if(entry){
      cell.innerHTML = `<div>${entry.item.name}</div><span class="qty-badge">x${entry.qty}</span>`;
      cell.addEventListener("click", ()=> selectInvItem(entry));
    }
    grid.appendChild(cell);
  }
  document.getElementById("invPageLabel").textContent = `Page ${state.invPage+1}/${pages}`;
  renderEquipSlots();
}
document.getElementById("invPrev").addEventListener("click", ()=>{ state.invPage=Math.max(0,state.invPage-1); renderInventory(); });
document.getElementById("invNext").addEventListener("click", ()=>{ state.invPage++; renderInventory(); });

// One-line effect summary for the inspect panel: heal/mana for consumables,
// damage for weapons, defense/HP for armor, +/- stat buffs for trinkets, uses for tools.
function itemEffectText(item){
  const st = item.stats || {};
  if(item.type==="consumable"){
    const bits = [];
    if(st.heal) bits.push(`Restores ${st.heal} HP`);
    if(st.mana) bits.push(`Restores ${st.mana} mana`);
    return bits.join(" · ") || "No effect";
  }
  if(item.type==="weapon") return `Damage: +${st.attack||0} attack`;
  if(item.type==="armor"){
    const bits = [];
    if(st.defense) bits.push(`+${st.defense} defense`);
    if(st.hp) bits.push(`+${st.hp} max HP`);
    Object.keys(st).filter(k=>!["defense","hp","curse"].includes(k)).forEach(k=> bits.push(`${st[k]>=0?"+":""}${st[k]} ${k}`));
    return `${item.armorSlot?item.armorSlot[0].toUpperCase()+item.armorSlot.slice(1)+": ":""}${bits.join(", ")||"No bonuses"}`;
  }
  if(item.type==="trinket"){
    const bits = Object.keys(st).filter(k=>k!=="curse").map(k=>{
      const v = st[k]; const n = st.curse ? -Math.abs(v) : v;
      return `${n>=0?"+":""}${n} ${k}${st.curse?" (cursed)":""}`;
    });
    return bits.join(", ") || "No bonuses";
  }
  if(item.type==="tool") return `Durability: ${TOOL_USES[item.id]||"?"} uses before it breaks`;
  return "Crafting material — no combat effect";
}
function selectInvItem(entry){
  state.selectedInvItem = entry;
  const canEquip = ["weapon","armor","trinket"].includes(entry.item.type);
  const detail = document.getElementById("itemDetail");
  detail.innerHTML = `
    <b>${entry.item.name}</b> <i>(${entry.item.rarity})</i><br>
    ${entry.item.desc}<br>
    <b>${escapeHTML(itemEffectText(entry.item))}</b><br>
    <div style="margin-top:6px; display:flex; gap:8px; flex-wrap:wrap;">
      ${canEquip? `<button class="doodle-btn btn-sm btn-blue" id="btnEquip">Equip</button>`:""}
      ${entry.item.type==="consumable"? `<button class="doodle-btn btn-sm btn-green" id="btnUse">Use</button>`:""}
      <button class="doodle-btn btn-sm" id="btnToss">Toss</button>
      <button class="doodle-btn btn-sm btn-yellow" id="btnSell">Sell ($${entry.item.sellPrice})</button>
    </div>`;
  const eq = document.getElementById("btnEquip");
  if(eq) eq.addEventListener("click", ()=> equipItem(entry.item));
  const use = document.getElementById("btnUse");
  if(use) use.addEventListener("click", ()=> useConsumable(entry.item));
  document.getElementById("btnToss").addEventListener("click", async ()=>{
    await changeInvQty(entry.item.id, -1);
    afterInvChangeRefreshDetail(entry.item.id);
  });
  document.getElementById("btnSell").addEventListener("click", async ()=>{
    await sellItem(entry.item);
    afterInvChangeRefreshDetail(entry.item.id);
  });
}
// After a use/toss/sell, re-check how many of that item are left: if none,
// clear the detail panel and deselect instead of leaving stale Use/Toss/Sell
// buttons that still fire against a stack that no longer exists (which is
// what let people spam "Use" past having zero of an item).
function afterInvChangeRefreshDetail(itemId){
  const fresh = invExpanded().find(e=>e.item.id===itemId);
  if(fresh){ selectInvItem(fresh); }
  else {
    state.selectedInvItem = null;
    document.getElementById("itemDetail").innerHTML = "Select an item to inspect it.";
  }
  renderInventory();
}
// All inventory-array mutations go through here so that a multi-item
// action (like crafting, which removes 2 ingredients and adds 1 result)
// reads the inventory ONCE and writes it ONCE. Doing separate sequential
// changeInvQty() calls for that was the actual cause of the "crafting
// duplicates items" bug: the 2nd call could read state.profile before the
// 1st call's write had round-tripped back down, so it wrote a version of
// the array that still had the 1st ingredient at full quantity.
// Runs entirely inside a Firestore transaction: reads the CURRENT
// server-side inventory (never the possibly-stale local state.profile),
// validates every `remove` actually has enough quantity available, and
// writes the merged result in one atomic round-trip. This is what closes
// the "crafting duplicates items / creates items out of thin air" bug —
// two rapid actions (e.g. double-clicking Craft, or crafting right after
// eating) can no longer both read the same stale pre-write inventory,
// because each transaction re-reads from the server and Firestore retries
// on conflict instead of silently racing.
// extraFields may be a plain object OR a function (freshData)=>object, so
// callers that need to compute a field off the CURRENT server value (like
// healing off current hp, not the possibly-stale local state.profile.hp)
// can do so from inside the same transaction that validates/spends items.
async function applyInvChanges({remove=[], add=[]}={}, extraFields={}){
  return withErrorToast(async ()=>{
    const pref = doc(db,"players",state.uid);
    await runTransaction(db, async (tx)=>{
      const snap = await tx.get(pref);
      const data = snap.data() || {};
      const inv = (data.inventory||[]).map(e=>({...e}));
      for(const {itemId, qty} of remove){
        const idx = inv.findIndex(e=>e.itemId===itemId);
        const have = idx>=0 ? inv[idx].qty : 0;
        if(have < qty){
          throw new Error(`insufficient-item:${itemId}`);
        }
        inv[idx].qty -= qty;
      }
      for(const {itemId, qty} of add){
        const idx = inv.findIndex(e=>e.itemId===itemId);
        if(idx>=0) inv[idx].qty += qty;
        else inv.push({ itemId, qty });
      }
      const fields = typeof extraFields==="function" ? extraFields(data) : extraFields;
      tx.update(pref, { inventory: inv.filter(e=>e.qty>0), ...fields });
    });
  });
}
async function changeInvQty(itemId, delta){
  return delta>=0
    ? applyInvChanges({ add:[{itemId, qty:delta}] })
    : applyInvChanges({ remove:[{itemId, qty:-delta}] });
}
async function addItemToInv(itemId, qty=1){
  return applyInvChanges({ add:[{itemId, qty}] });
}
async function sellItem(item){
  await changeInvQty(item.id, -1);
  await grantMoney(item.sellPrice);
  playSfx("sell");
  toast(`Sold ${item.name} for $${item.sellPrice}`);
}
async function equipItem(item){
  const slot = item.type==="armor" ? item.armorSlot : item.type; // weapon/helmet/chestplate/leggings/boots/trinket
  let swapped = null;
  const ok = await withErrorToast(()=> runTransaction(db, async tx=>{
    const pref = doc(db,"players",state.uid), snap = await tx.get(pref), d = snap.data()||{};
    const inv = (d.inventory||[]).map(e=>({...e}));
    const idx = inv.findIndex(e=>e.itemId===item.id);
    if(idx<0 || inv[idx].qty<1) throw new Error(`insufficient-item:${item.id}`);
    inv[idx].qty -= 1;
    const old = d.equipped?.[slot] || null;
    if(old){                                   // swap: old piece goes back to the bag
      const oi = inv.findIndex(e=>e.itemId===old);
      if(oi>=0) inv[oi].qty += 1; else inv.push({ itemId:old, qty:1 });
      swapped = old;
    }
    tx.update(pref, { inventory: inv.filter(e=>e.qty>0), [`equipped.${slot}`]: item.id });
  }));
  if(ok!==null){
    toast(`Equipped ${item.name}` + (swapped ? ` (${ITEM_BY_ID[swapped]?.name||"old item"} returned to inventory)` : ""));
    afterInvChangeRefreshDetail(item.id);
  }
}
async function unequipItem(slot){
  let name = "item";
  const ok = await withErrorToast(()=> runTransaction(db, async tx=>{
    const pref = doc(db,"players",state.uid), snap = await tx.get(pref), d = snap.data()||{};
    const itemId = d.equipped?.[slot];
    if(!itemId) return;
    name = ITEM_BY_ID[itemId]?.name || "item";
    const inv = (d.inventory||[]).map(e=>({...e}));
    const idx = inv.findIndex(e=>e.itemId===itemId);
    if(idx>=0) inv[idx].qty += 1; else inv.push({ itemId, qty:1 });
    tx.update(pref, { inventory: inv, [`equipped.${slot}`]: null });
  }));
  if(ok!==null) toast(`${name} moved back to your inventory`);
}
const EQUIP_SLOTS = ["weapon","helmet","chestplate","leggings","boots","trinket"];
function renderEquipSlots(){
  const p = state.profile; if(!p) return;
  EQUIP_SLOTS.forEach(slot=>{
    const el = document.getElementById("equip"+slot.charAt(0).toUpperCase()+slot.slice(1));
    if(!el) return;
    const itemId = p.equipped?.[slot];
    if(itemId && ITEM_BY_ID[itemId]){
      el.classList.add("filled");
      el.innerHTML = `<span>${ITEM_BY_ID[itemId].name}</span><button type="button" class="doodle-btn btn-sm equip-deslot-btn" data-deequip="${slot}" title="Take off">✕</button>`;
      el.querySelector("[data-deequip]").addEventListener("click", (ev)=>{ ev.stopPropagation(); unequipItem(slot); });
    } else {
      el.classList.remove("filled");
      el.innerHTML = `<span>${slot[0].toUpperCase()+slot.slice(1)}</span>`;
    }
  });
}
async function useConsumable(item){
  // Everything — the qty check, the qty decrement, AND the hp/mana gain —
  // happens inside ONE transaction now (via applyInvChanges' extraFields),
  // reading the server's current inventory each time. That's what stops a
  // double-click (or eating right after crafting) from consuming an item
  // you don't actually have anymore, or applying its effect twice.
  const ok = await applyInvChanges({ remove:[{itemId:item.id, qty:1}] }, (fresh)=>{
    const fields = {};
    if(item.stats.heal) fields.hp = Math.min(fresh.hpMax, fresh.hp+item.stats.heal);
    if(item.stats.mana) fields.mana = Math.min(fresh.manaMax, fresh.mana+item.stats.mana);
    return fields;
  });
  if(ok===null){
    afterInvChangeRefreshDetail(item.id);
    return;
  }
  toast(`Used ${item.name}`);
  afterInvChangeRefreshDetail(item.id);
}

/* =========================================================================
   LEADERBOARD + PROFILE BOOK
   ========================================================================= */
async function computeFollowerCount(uid, friendCount){
  try{
    const q = query(collection(db,"players"), where("sentFriendRequests","array-contains",uid));
    const snap = await getDocs(q);
    return friendCount + snap.size;
  }catch(err){ console.error(err); return friendCount; }
}
document.querySelectorAll(".lb-cat").forEach(b=>{
  b.addEventListener("click", ()=>{
    document.querySelectorAll(".lb-cat").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    renderLeaderboard(b.dataset.cat);
  });
});
const LB_FIELDS = { money:"money", level:"level", kills:"monstersKilled", pvpkills:"kills", deaths:"deaths" };
const LB_LABEL = { money:"💰", level:"⭐", kills:"👹", pvpkills:"⚔️", deaths:"💀" };
const lbCache = {};
async function getLb(cat){
  const c = lbCache[cat]; if(c && Date.now()-c.t < 60000) return c.rows;
  const snap = await getDocs(query(collection(db,"players"), orderBy(LB_FIELDS[cat],"desc"), limit(30)));
  const rows = snap.docs.filter(d=>!d.data().banned).map(d=>({id:d.id, data:d.data()}));
  lbCache[cat] = { t:Date.now(), rows }; return rows;
}
let lbUnsub = null;
function renderLeaderboard(cat){
  const field = LB_FIELDS[cat], list = document.getElementById("lbList");
  if(lbUnsub){ lbUnsub(); lbUnsub = null; }
  else state.unsubs.push(()=>{ if(lbUnsub){ lbUnsub(); lbUnsub = null; } });
  list.innerHTML = "<li>Loading…</li>";
  lbUnsub = onSnapshot(query(collection(db,"players"), orderBy(field,"desc"), limit(30)), snap=>{
    lbCache[cat] = { t:Date.now(), rows: snap.docs.filter(d=>!d.data().banned).map(d=>({id:d.id, data:d.data()})) };
    const rows = lbCache[cat].rows.slice(0,10);
    list.innerHTML = "";
    rows.forEach((r,i)=>{
      const data = r.data, li = document.createElement("li");
      li.innerHTML = `<span>#${i+1} ${escapeHTML(data.username)}</span><span>${cat==="money"? "$"+fmtMoney(data[field]||0) : (data[field]||0)}</span>`;
      li.addEventListener("click", ()=> openProfileBook(r.id, data, i+1, cat));
      list.appendChild(li);
    });
    if(!rows.length) list.innerHTML = "<li>No players yet.</li>";
  }, e=>{ console.error(e); list.innerHTML = "<li>Leaderboard unavailable right now.</li>"; });
}
function openProfileBook(uid, data, rank, cat){
  document.getElementById("profileName").textContent = data.username;
  document.getElementById("profileStats").innerHTML = `
    Level ${data.level} ${ELEMENTS[data.archetype]?.name||""} ${CLASSES[data.klass]?.name||""}<br>
    Money: $${fmtMoney(data.money||0)}<br>
    Monsters Killed: ${data.monstersKilled||0}<br>
    PvP Kills: ${data.kills||0} &middot; Deaths: ${data.deaths||0} &middot; Killstreak: ${data.killstreak||0}<br>
    Friends: ${(data.friends||[]).length} &middot; Followers: <span id="profileFollowerCount">…</span><br>
    Playtime: ${fmtPlaytime(data.playtime||0)}<div class="lb-bubbles" id="lbBubbles"></div>`;
  document.getElementById("profileRank").textContent = rank? `Ranked #${rank} in ${cat}` : "";
  const card = document.querySelector("#profileModal .book-card");
  card.style.background = ELEMENTS[data.archetype]?.color || "";
  Promise.all(Object.keys(LB_FIELDS).map(getLb)).then(all=>{
    const box = document.getElementById("lbBubbles"); if(!box) return;
    box.innerHTML = Object.keys(LB_FIELDS).map((c,i)=>{ const pos = all[i].findIndex(r=>r.id===uid); return `<span class="lb-bubble${pos>=0&&pos<3?" top":""}" title="${c}">${LB_LABEL[c]} ${pos>=0?"#"+(pos+1):"30+"}</span>`; }).join("");
  }).catch(()=>{});
  const payBox = document.getElementById("payBox");
  payBox.style.display = uid===state.uid ? "none" : "";
  document.getElementById("payAmount").value = "";
  document.getElementById("btnPay").onclick = async ()=>{ if(await payPlayer(uid, data.username, Number(document.getElementById("payAmount").value))) document.getElementById("payAmount").value=""; };
  // Followers = friends + people who have a pending friend request out to
  // this player (i.e. anyone whose own sentFriendRequests contains them).
  computeFollowerCount(uid, (data.friends||[]).length).then(count=>{
    const el = document.getElementById("profileFollowerCount");
    if(el) el.textContent = count;
  });

  const pmBtn = document.getElementById("btnPM");
  const friendBtn = document.getElementById("btnFriendReq");
  const banBtn = document.getElementById("btnBanUser");
  const isSelf = uid === state.uid;
  pmBtn.style.display = isSelf ? "none" : "";
  friendBtn.style.display = isSelf ? "none" : "";
  banBtn.style.display = (!isSelf && isAdminUI()) ? "" : "none";
  if(!isSelf && isAdminUI()){
    banBtn.onclick = ()=> banUser(uid, data.username);
  }
  if(!isSelf){
    pmBtn.onclick = ()=>{ closeModal("profileModal"); openPrivateChatWith(uid, data.username); };
    const isFriend = (state.profile.friends||[]).includes(uid);
    const isPending = (state.profile.sentFriendRequests||[]).includes(uid);
    if(isFriend){
      // accepted: red "Remove Friend"
      friendBtn.textContent = "Remove Friend";
      friendBtn.className = "doodle-btn btn-danger";
      friendBtn.disabled = false;
      friendBtn.onclick = ()=> withErrorToast(async ()=>{
        await updateDoc(doc(db,"players",state.uid), { friends: arrayRemove(uid) });
        toast(`Removed ${data.username} as a friend.`);
        closeModal("profileModal");
      });
    } else if(isPending){
      // sent, waiting on them: yellow "Pending", not clickable again
      friendBtn.textContent = "Pending";
      friendBtn.className = "doodle-btn btn-yellow";
      friendBtn.disabled = true;
      friendBtn.onclick = null;
    } else {
      // green "Add Friend"
      friendBtn.textContent = "Add Friend";
      friendBtn.className = "doodle-btn btn-blue";
      friendBtn.disabled = false;
      friendBtn.onclick = ()=> sendFriendRequest(uid, data.username);
    }
  }
  openModal("profileModal");
}
/* Bans a user: scrubs their display name to banneduser_##### (so old chat
   lines and the leaderboard show that instead of their real name) and
   wipes their public chat history. Enforced server-side by isAdmin() in
   rpg_firestore.rules, not by this client-side isAdminUI() check.
   NOTE: fully deleting another user's Firebase Auth account (so they can
   never log back in at all) is not something a client app can do for
   someone else's account — Firebase only allows a user to delete their
   OWN auth account. Truly deleting the Auth record too requires a small
   Cloud Function using the Admin SDK, triggered off this banned:true
   flag; this client-side ban already fully removes them from chat and
   leaderboards and scrubs their name in the meantime. */
async function banUser(uid, username){
  if(!isAdminUI()) return;
  if(!confirm(`Ban ${username}? This scrubs their name everywhere and cannot be undone from here.`)) return;
  const bannedName = `banneduser_${Math.floor(10000 + Math.random()*90000)}`;
  const ok = await withErrorToast(async ()=>{
    await updateDoc(doc(db,"players",uid), { username: bannedName, banned:true });
    const gcSnap = await getDocs(query(collection(db,"globalChat"), where("uid","==",uid)));
    for(const d of gcSnap.docs) await deleteDoc(d.ref);
  });
  if(ok!==null){ toast(`${username} has been banned.`); closeModal("profileModal"); }
}

/* =========================================================================
   SIDEQUESTS — 3 slots (Tier I / II / III), 12h / 24h / 3-day reroll while
   unaccepted, 24h to complete once accepted, and the same 24h also gates
   the slot's refill (accepting locks the slot for exactly that window).
   ========================================================================= */
const QUEST_TIERS = ["I","II","III"];
const QUEST_TIER_PERIOD_MS = { I:12*3600*1000, II:24*3600*1000, III:3*24*3600*1000 };
const QUEST_ACCEPT_WINDOW_MS = 24*3600*1000;
const QUEST_MATERIAL_IDS = ITEM_BANK.filter(i=>i.type==="material").map(i=>i.id)
  .concat(["ore_copper","ore_iron","gem_quartz","gem_ruby","forage_herb","forage_mushroom"]);
const QUEST_TEMPLATES = [
  (rnd, tier) => {
    const itemId = QUEST_MATERIAL_IDS[Math.floor(rnd()*QUEST_MATERIAL_IDS.length)];
    const item = ITEM_BY_ID[itemId];
    const target = { I:3, II:6, III:12 }[tier] + Math.floor(rnd()*4);
    return {
      type:"gather", itemId, target,
      label:`Gather ${target}x ${item.name}`,
      moneyReward: Math.round(target * (8+rnd()*6) * {I:1,II:1.6,III:2.4}[tier])
    };
  },
  (rnd, tier) => {
    const target = Math.round({ I:60, II:150, III:400 }[tier] + rnd()*100);
    return {
      type:"money", target,
      label:`Earn $${target}`,
      itemRewardId: QUEST_MATERIAL_IDS[Math.floor(rnd()*QUEST_MATERIAL_IDS.length)],
      itemRewardQty: {I:1,II:2,III:3}[tier]
    };
  },
  (rnd, tier) => {
    const target = { I:3, II:6, III:14 }[tier] + Math.floor(rnd()*3);
    return {
      type:"slay", target,
      label:`Slay ${target} enemies`,
      moneyReward: Math.round(target * (12+rnd()*8) * {I:1,II:1.6,III:2.4}[tier])
    };
  }
];
function offeredQuestFor(tier){
  const period = QUEST_TIER_PERIOD_MS[tier];
  const seed = Math.floor(Date.now()/period) + tier.charCodeAt(0)*7919 + tier.length*131;
  const rnd = seededRand(seed);
  const tpl = QUEST_TEMPLATES[Math.floor(rnd()*QUEST_TEMPLATES.length)];
  return { tier, ...tpl(rnd, tier) };
}
function questProgress(quest, p){
  if(quest.type==="gather") return Math.max(0, (p.inventory||[]).find(e=>e.itemId===quest.itemId)?.qty - quest.baseline || 0);
  if(quest.type==="money") return Math.max(0, p.money - quest.baseline);
  if(quest.type==="slay") return Math.max(0, (p.monstersKilled||0) - quest.baseline);
  return 0;
}
function questBaseline(quest, p){
  if(quest.type==="gather") return (p.inventory||[]).find(e=>e.itemId===quest.itemId)?.qty || 0;
  if(quest.type==="money") return p.money||0;
  if(quest.type==="slay") return p.monstersKilled||0;
  return 0;
}
async function renderQuests(){
  const list = document.getElementById("questList");
  list.innerHTML="<li>Loading…</li>";
  const p = state.profile;
  const rows = [];
  for(let i=0;i<3;i++){
    const slotKey = `slot${i+1}`;
    const ref = doc(db,"players",state.uid,"quests",slotKey);
    const snap = await getDoc(ref).catch(()=>null);
    const quest = snap?.exists() ? snap.data() : null;
    if(quest && Date.now() >= quest.deadlineAt){
      // 24h window is up either way — free the slot
      await deleteDoc(ref).catch(()=>{});
      rows.push(renderEmptySlotRow(slotKey));
    } else if(quest){
      rows.push(renderActiveSlotRow(slotKey, quest, p, ref));
    } else {
      rows.push(renderEmptySlotRow(slotKey));
    }
  }
  list.innerHTML = rows.join("");
  document.querySelectorAll("[data-quest-accept]").forEach(btn=>{
    btn.addEventListener("click", ()=> acceptQuest(btn.dataset.questAccept, btn.dataset.questTier));
  });
  document.querySelectorAll("[data-quest-claim]").forEach(btn=>{
    btn.addEventListener("click", ()=> claimQuest(btn.dataset.questClaim));
  });
}
function renderEmptySlotRow(slotKey){
  // slot's tier is fixed to slot 1/2/3 = I/II/III for the FIRST ever
  // offer; after that a slot's tier is effectively whatever it re-rolls
  // to via offeredQuestFor's own period, so this stays simple and stable.
  const tier = QUEST_TIERS[Number(slotKey.slice(-1))-1];
  const q = offeredQuestFor(tier);
  const period = QUEST_TIER_PERIOD_MS[tier];
  const msIntoPeriod = Date.now() % period;
  const msLeft = period - msIntoPeriod;
  const hrsLeft = Math.max(1, Math.round(msLeft/3600000));
  return `<li class="quest-row">
    <div><b>Tier ${tier}:</b> ${q.label}</div>
    <div style="font-size:12px">Rerolls in ~${hrsLeft}h if not accepted &middot; Reward: ${q.moneyReward?`$${q.moneyReward}`:""}${q.itemRewardId?` + ${q.itemRewardQty}x ${ITEM_BY_ID[q.itemRewardId].name}`:""}</div>
    <button class="doodle-btn btn-sm btn-green" data-quest-accept="${slotKey}" data-quest-tier="${tier}">Accept (24h)</button>
  </li>`;
}
function renderActiveSlotRow(slotKey, quest, p, ref){
  const progress = questProgress(quest, p);
  const done = progress >= quest.target;
  const msLeft = Math.max(0, quest.deadlineAt - Date.now());
  const hrsLeft = Math.floor(msLeft/3600000), minsLeft = Math.floor((msLeft%3600000)/60000);
  return `<li class="quest-row">
    <div><b>Tier ${quest.tier}:</b> ${quest.label}</div>
    <div style="font-size:12px">Progress: ${Math.min(progress,quest.target)}/${quest.target} &middot; ${hrsLeft}h ${minsLeft}m left</div>
    ${done && !quest.rewardClaimed
      ? `<button class="doodle-btn btn-sm btn-green" data-quest-claim="${slotKey}">Claim Reward</button>`
      : quest.rewardClaimed
        ? `<div style="font-size:12px">Reward claimed — slot frees up when the 24h window ends.</div>`
        : `<div style="font-size:12px">In progress…</div>`}
  </li>`;
}
async function acceptQuest(slotKey, tier){
  const p = state.profile;
  const offered = offeredQuestFor(tier);
  const quest = {
    ...offered,
    baseline: questBaseline(offered, p),
    acceptedAt: Date.now(),
    deadlineAt: Date.now() + QUEST_ACCEPT_WINDOW_MS,
    rewardClaimed: false
  };
  await withErrorToast(()=> setDoc(doc(db,"players",state.uid,"quests",slotKey), quest));
  toast(`Accepted: ${offered.label}`);
  renderQuests();
}
async function claimQuest(slotKey){
  const ref = doc(db,"players",state.uid,"quests",slotKey);
  const snap = await getDoc(ref).catch(()=>null);
  if(!snap?.exists()) return;
  const quest = snap.data();
  if(quest.rewardClaimed) return;
  await withErrorToast(async ()=>{
    if(quest.moneyReward) await grantMoney(quest.moneyReward);
    if(quest.itemRewardId) await addItemToInv(quest.itemRewardId, quest.itemRewardQty||1);
    await updateDoc(ref, { rewardClaimed:true });
  });
  toast(`Quest reward claimed!${quest.moneyReward?` +$${quest.moneyReward}`:""}`);
  renderQuests();
}

/* =========================================================================
   COMPASS: MAP / SHOP / CHAT / AUCTION / BATTLE / CRAFT
   ========================================================================= */
document.getElementById("btnCompass").addEventListener("click", ()=>{
  openModal("compassModal"); renderRegionGrid(); renderShop(); renderAuction(); renderCraftInv();
});
document.querySelectorAll("[data-ctab]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll("[data-ctab]").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".ctab-page").forEach(p=>p.classList.remove("active"));
    document.getElementById("ctab-"+btn.dataset.ctab).classList.add("active");
    if(btn.dataset.ctab==="chat"){ ensureChatSubscriptions(); setTimeout(focusVisibleChat,0); }
  });
});

/* --- map --- */
/* --- map: now doubles as fast-travel — clicking a region teleports you
   into that quadrant instead of just flipping a cosmetic field, since your
   region is normally whatever quadrant your live x/y position is in. --- */
function renderRegionGrid(){
  const grid = document.getElementById("regionGrid");
  grid.innerHTML="";
  Object.entries(REGIONS).forEach(([key,r])=>{
    const card = document.createElement("div");
    card.className = `region-card ${r.css}-c` + (state.profile.region===key? " current":"");
    card.innerHTML = `<div style="font-size:30px">${{forest:"🌲",mountains:"⛰️",volcano:"🌋",reef:"🪸"}[key]}</div><div>${r.name}</div>`;
    card.addEventListener("click", async ()=>{
      if(state.profile.region===key) return;
      await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { region:key }));
      renderRegionGrid(); renderShop();
      toast(`Traveled to ${r.name}`);
    });
    grid.appendChild(card);
  });
}

/* --- shop ---
   Stock is 2 random weapons, 2 armor, 2 trinkets, 2 consumables
   (food/potion) and 2 materials — reshuffled once per day per region, but
   stable across re-renders/reloads on the same day (seeded by date+region
   so it doesn't change every time the shop is opened). */
function shopItemsForRegion(){
  const p = state.profile;
  const region = REGIONS[p.region];
  const own = ITEM_BANK.filter(i => i.element === region.element);
  const day = new Date().toISOString().slice(0,10);
  const seedStr = day + p.region;
  const seed = [...seedStr].reduce((a,c)=>a+c.charCodeAt(0),0) + 7000;
  const rnd = seededRand(seed);
  const pickTwo = (type) => {
    const pool = own.filter(i => i.type===type);
    const picked = [];
    const used = new Set();
    while(picked.length < 2 && picked.length < pool.length){
      const idx = Math.floor(rnd()*pool.length);
      if(used.has(idx)) continue;
      used.add(idx); picked.push(pool[idx]);
    }
    return picked;
  };
  return [
    ...pickTwo("weapon"), ...pickTwo("armor"), ...pickTwo("trinket"),
    ...pickTwo("consumable"), ...pickTwo("material")
  ];
}
function dailyItem(){
  const day = new Date().toISOString().slice(0,10);
  const seed = [...day].reduce((a,c)=>a+c.charCodeAt(0),0);
  return ITEM_BANK[seed % ITEM_BANK.length];
}
function renderShop(){
  document.getElementById("shopRegionLabel").textContent = `${REGIONS[state.profile.region].name} Shop`;
  const daily = dailyItem();
  document.getElementById("dailyItemBox").innerHTML = `<b>Today's Special:</b> ${daily.name} (${daily.rarity}) — $${daily.price} <button class="doodle-btn btn-sm btn-yellow" id="buyDaily">Buy</button>`;
  document.getElementById("buyDaily").addEventListener("click", ()=> buyItem(daily));
  const grid = document.getElementById("shopGrid");
  grid.innerHTML="";
  shopItemsForRegion().forEach(item=>{
    const cell = document.createElement("div");
    cell.className="shop-cell";
    cell.innerHTML = `<b>${item.name}</b><span>${item.rarity}</span><span>$${item.price}</span><button class="doodle-btn btn-sm btn-green">Buy</button>`;
    cell.querySelector("button").addEventListener("click", ()=> buyItem(item));
    grid.appendChild(cell);
  });
}
async function buyItem(item){
  if(state.profile.money < item.price){ toast("Not enough money!"); return; }
  await grantMoney(-item.price);
  await addItemToInv(item.id, 1);
  playSfx("buy");
  toast(`Bought ${item.name}`);
}

/* =========================================================================
   WORLD RESOURCE GATHERING — foraging, mining, fishing
   These used to be their own tab UIs; now they're triggered by walking up
   to a tree/bush/rocky cliff/pond in the open world and pressing Space.
   The reward math is unchanged from the old tab-based version.
   ========================================================================= */
function jobLog(msg){ toast(msg); const l=document.getElementById("jobLog"); if(l) l.textContent=msg; }
const toolIds = kind=> ["tool_"+kind+"6","tool_"+kind+"5","tool_"+kind+"4","tool_"+kind+"3","tool_"+kind+"2","tool_"+kind];  // best tool is used first
async function useTool(kind){
  const id = toolIds(kind).find(hasItem);
  if(!id){ toast(`You need a ${kind==="pickaxe"?"Pickaxe":"Fishing Rod"} — buy one in the Shop.`); return false; }
  const uses = { ...(state.profile.toolUses||{}) };
  const left = (uses[id] ?? TOOL_USES[id]) - 1;
  if(left<=0){ delete uses[id]; await changeInvQty(id,-1); jobLog(`Your ${ITEM_BY_ID[id].name} broke!`); } else uses[id]=left;
  await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { toolUses: uses }));
  return true;
}
function toolUsesLeft(kind){
  const id = toolIds(kind).find(hasItem);
  return id ? `${ITEM_BY_ID[id].name}: ${(state.profile.toolUses||{})[id] ?? TOOL_USES[id]} uses left` : `No ${kind==="pickaxe"?"pickaxe":"fishing rod"}`;
}
[["pickaxe","Pickaxe"],["fishingrod","Fishing Rod"]].forEach(([k,n])=>[2,3].forEach(t=>{
  const it = ITEM_BY_ID[`tool_${k}${t}`];
  document.getElementById("toolShelf").insertAdjacentHTML("beforeend", ` <button class="doodle-btn btn-sm btn-yellow" data-buytool="${it.id}">${it.name} ($${it.price})</button>`);
}));
document.querySelectorAll("[data-buytool]").forEach(b=> b.addEventListener("click", ()=> buyItem(ITEM_BY_ID[b.dataset.buytool])));
document.getElementById("btnForage").addEventListener("click", doForageAction);
document.getElementById("btnMine").addEventListener("click", doMineAction);
document.getElementById("btnFish").addEventListener("click", ()=>{ closeModal("compassModal"); doFishAction(); });
setInterval(()=>{
  if(!state.profile) return;
  const r = forageReadyIn(), fb = document.getElementById("btnForage");
  fb.disabled = r>0; fb.textContent = r>0 ? `Forage (${Math.ceil(r/1000)}s)` : "Forage";
  document.getElementById("jobToolStatus").innerHTML = `⛏️ ${toolUsesLeft("pickaxe")} &nbsp;·&nbsp; 🎣 ${toolUsesLeft("fishingrod")}`;
}, 500);
function hasItem(itemId){ return (state.profile.inventory||[]).some(e=>e.itemId===itemId && e.qty>0); }

/* --- foraging (bush): free, once every 60s, 5% money / 45% item / 50% nothing --- */
const FORAGE_COOLDOWN_MS = 20*1000;
function forageReadyIn(){ return FORAGE_COOLDOWN_MS - (Date.now() - (state.profile.lastForageTs||0)); }
async function doForageAction(){
  if(forageReadyIn() > 0) return;
  await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), {
    lastForageTs: Date.now(), foragingXp: (state.profile.foragingXp||0)+1
  }));
  const roll = Math.random();
  if(roll < 0.05){
    const amt = 5 + Math.floor(Math.random()*15);
    await grantMoney(amt);
    jobLog(`You found $${amt} in the bush!`);
  } else if(roll < 0.50){
    const pool = [...Array(10).fill("forage_berry"),...Array(4).fill("forage_mushroom"),...Array(3).fill("forage_herb"),"forage_apple","forage_apple","forage_truffle"];
    const pick = Math.random()<0.01 ? "forage_goldapple" : pool[Math.floor(Math.random()*pool.length)];
    await addItemToInv(pick, 1);
    jobLog(`You foraged a ${ITEM_BY_ID[pick].name}!`);
  } else {
    jobLog("Nothing this time.");
  }
}

/* --- mining (rocky cliff): 3 pulls per hour, needs a Pickaxe --- */
const MINE_HOUR_MS = 60*60*1000;
document.getElementById("btnBuyPickaxe").addEventListener("click", async ()=>{
  if(hasItem("tool_pickaxe")){ toast("You already have a pickaxe."); return; }
  await buyItem(ITEM_BY_ID.tool_pickaxe);
});
function minePicksLeft(){
  const p = state.profile;
  const inWindow = Date.now() - (p.mineHourStart||0) < MINE_HOUR_MS;
  return inWindow ? Math.max(0, 3-(p.minePicksThisHour||0)) : 3;
}
async function doMineAction(){
  if(!(await useTool("pickaxe"))) return;
  const p = state.profile;
  const inWindow = Date.now() - (p.mineHourStart||0) < MINE_HOUR_MS;
  const hourStart = inWindow ? p.mineHourStart : Date.now();
  const picks = inWindow ? (p.minePicksThisHour||0) : 0;
  const roll = Math.random();
  let msg;
  const updates = { mineHourStart: hourStart, minePicksThisHour: picks+1, miningXp: (p.miningXp||0)+1 };
  if(roll < 0.4){ // good
    const pool = ["ore_copper","ore_iron","ore_coal","gem_quartz","ore_silver","ore_gold","gem_ruby","gem_sapphire","gem_emerald","gem_diamond","money"];
    const w = [0.16,0.13,0.32,0.10,0.08,0.05,0.04,0.04,0.02,0.01,0.05];
    let r = Math.random(), pick=pool[0], acc=0;
    for(let i=0;i<pool.length;i++){ acc+=w[i]; if(r<=acc){ pick=pool[i]; break; } }
    if(pick==="money"){
      const amt = 20 + Math.floor(Math.random()*80);
      updates.money = p.money + amt;
      msg = `Found $${amt} under the rock!`;
    } else {
      await addItemToInv(pick, 1);
      msg = `Found a ${ITEM_BY_ID[pick].name}!`;
    }
  } else if(roll < 0.75){ // neutral
    const pool = ["ore_copper","ore_coal","ore_coal","forage_mushroom"];
    const pick = pool[Math.floor(Math.random()*pool.length)];
    await addItemToInv(pick, 1);
    msg = `Just some ${ITEM_BY_ID[pick].name}.`;
  } else { // negative
    if(Math.random()<0.5){
      const loss = Math.round(p.money * (0.03+Math.random()*0.07));
      updates.money = Math.max(0, p.money - loss);
      msg = `A trap! Lost $${loss}.`;
    } else {
      const hpLoss = Math.round(p.hpMax * (0.05+Math.random()*0.1));
      updates.hp = Math.max(1, p.hp - hpLoss);
      msg = `Ouch! Lost ${hpLoss} HP.`;
    }
  }
  await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), updates));
  jobLog(msg);
}

/* --- fishing (pond): vertical hold-to-catch minigame, needs a Fishing Rod --- */
document.getElementById("btnBuyRod").addEventListener("click", async ()=>{
  if(hasItem("tool_fishingrod")){ toast("You already have a fishing rod."); return; }
  await buyItem(ITEM_BY_ID.tool_fishingrod);
});
let fishGame = null;
// Each fish that bites gets a random speed trait — slow/medium/fast —
// picked once per bite. Faster fish are harder to keep the bar on, but
// bias the catch roll toward higher quality/rarity as a reward for landing one.
const FISH_TRAITS = [
  { id:"slow",   label:"slow",   weight:50, speedMult:0.6,  rarityBonus:0 },
  { id:"medium", label:"medium", weight:35, speedMult:1.0,  rarityBonus:0.12 },
  { id:"fast",   label:"fast",   weight:15, speedMult:1.6,  rarityBonus:0.28 }
];
function rollFishTrait(){
  const total = FISH_TRAITS.reduce((s,t)=>s+t.weight,0);
  let r = Math.random()*total;
  for(const t of FISH_TRAITS){ if((r-=t.weight)<=0) return t; }
  return FISH_TRAITS[0];
}
async function doFishAction(){
  if(fishGame) return;
  if(!(await useTool("fishingrod"))) return;
  if(fishGame) return;
  document.getElementById("fishOverlay").classList.add("show");
  const trait = rollFishTrait();
  toast(`Something's biting — feels ${trait.label}!`);
  const track = document.querySelector(".fish-track-v");
  const trackH = track.clientHeight || 260;
  const barH = 64;
  let barY = trackH - barH;
  let vel = 0;
  let held = false;
  let progress = 0;
  const progressNeeded = 100;
  let fishY = Math.random()*(trackH-26);
  let fishVel = (Math.random()<0.5?-1:1) * (0.6+Math.random()*0.8) * trait.speedMult;
  const emojiEl = document.getElementById("fishEmoji");
  const barEl = document.getElementById("fishBar");
  const fillEl = document.getElementById("fishProgressFill");

  const holdOn = ()=> held = true;
  const holdOff = ()=> held = false;
  const keyDown = (e)=>{ if(e.code==="Space"){ e.preventDefault(); held=true; } };
  const keyUp = (e)=>{ if(e.code==="Space"){ held=false; } };
  track.addEventListener("mousedown", holdOn); track.addEventListener("touchstart", holdOn);
  window.addEventListener("mouseup", holdOff); window.addEventListener("touchend", holdOff);
  window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp);

  const GRAVITY = 0.9, LIFT = -1.8, MAXV = 6;
  fishGame = setInterval(()=>{
    fishY += fishVel;
    if(fishY < 0){ fishY = 0; fishVel = Math.abs(fishVel); }
    if(fishY > trackH-26){ fishY = trackH-26; fishVel = -Math.abs(fishVel); }
    if(Math.random()<0.03) fishVel = (Math.random()<0.5?-1:1) * (0.5+Math.random()*1.2) * trait.speedMult;
    emojiEl.style.top = fishY+"px";

    vel += held ? LIFT : GRAVITY;
    vel = Math.max(-MAXV, Math.min(MAXV, vel));
    barY += vel;
    if(barY < 0){ barY = 0; vel = 0; }
    if(barY > trackH-barH){ barY = trackH-barH; vel = 0; }
    barEl.style.height = barH+"px";
    barEl.style.top = barY+"px";

    const fishCenter = fishY + 13;
    const inBar = fishCenter >= barY && fishCenter <= barY+barH;
    progress += inBar ? 1.4 : -1.2;
    progress = Math.max(0, Math.min(progressNeeded, progress));
    fillEl.style.height = progress+"%";

    if(progress >= progressNeeded){ endFishing(true, trait); }
  }, 50);
  setTimeout(()=>{ if(fishGame) endFishing(false, trait); }, 15000);
  fishGame.cleanup = ()=>{
    track.removeEventListener("mousedown", holdOn); track.removeEventListener("touchstart", holdOn);
    window.removeEventListener("mouseup", holdOff); window.removeEventListener("touchend", holdOff);
    window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp);
  };
}
async function endFishing(success, trait){
  if(!fishGame) return;
  clearInterval(fishGame); fishGame.cleanup?.(); fishGame = null;
  document.getElementById("fishOverlay").classList.remove("show");
  document.getElementById("fishProgressFill").style.height = "0%";
  if(success){
    // Roll is nudged up by the fish's speed trait — a fast bite is harder
    // to reel in but skews the catch toward the rarer/higher-quality pools.
    const roll = Math.min(0.999, Math.random() + (trait?.rarityBonus||0));
    const pool = roll<0.55 ? ["fish_minnow"] : roll<0.85 ? ["fish_bass","fish_trout"] : roll<0.98 ? ["fish_swordfish"] : ["fish_golden"];
    const pick = pool[Math.floor(Math.random()*pool.length)];
    await addItemToInv(pick, 1);
    await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { fishingXp: (state.profile.fishingXp||0)+1 }));
    jobLog(`Caught a ${ITEM_BY_ID[pick].name}!`);
  } else {
    jobLog("The fish got away.");
  }
}
document.getElementById("btnCancelFish").addEventListener("click", ()=> endFishing(false));


/* =========================================================================
   CHAT
   ========================================================================= */
let chatSubbed = false;
// Client-side display toggle only — decides whether to SHOW the mod
// buttons. The actual permission is enforced in Firestore rules against a
// real Firebase Auth UID (see isAdmin() in rpg_firestore.rules), so a
// modified client that fakes this check still gets rejected server-side.
const ADMIN_USERNAME = "Vortarium";
function isAdminUI(){ return state.profile?.username === ADMIN_USERNAME; }
function ensureChatSubscriptions(){
  if(chatSubbed) return; chatSubbed=true;
  subscribeInbox();
  subscribeFriendsAsContacts();
}
async function openProfileByUid(uid){
  if(uid===state.uid){ openProfileBook(uid, state.profile, null, null); return; }
  const snap = await getDoc(doc(db,"players",uid)).catch(()=>null);
  if(!snap || !snap.exists()){ toast("That player no longer exists."); return; }
  openProfileBook(uid, snap.data(), null, null);
}
function chatMessageHTML(m, id, collectionPath){
  const canDelete = m.uid===state.uid || isAdminUI();
  return `
      <div class="chat-msg ${m.uid===state.uid?'mine':'theirs'}" data-mid="${id}">
        <div class="who chat-username" data-uid="${m.uid}">${escapeHTML(m.username)}</div>
        <div class="bubble">${escapeHTML(m.text)}</div>
        ${canDelete ? `<button class="chat-del-btn" data-del="${id}" data-cpath="${collectionPath}" title="Delete message">&times;</button>` : ""}
      </div>`;
}
const lrKey = k=> `lr_${state.uid}_${k}`;
function chatAtBottom(log){ return log.scrollHeight - log.scrollTop - log.clientHeight < 8; }
function markRead(log, key){ localStorage.setItem(lrKey(key), String(Date.now())); log?.querySelector(".unread-line")?.remove(); }
function renderChatLog(log, rows, key, path){
  log._key = key;
  if(localStorage.getItem(lrKey(key))===null) localStorage.setItem(lrKey(key), String(Date.now()));
  const last = +localStorage.getItem(lrKey(key));
  const visible = log.offsetParent!==null, first = !log.dataset.init;
  const wasBottom = chatAtBottom(log), prevTop = log.scrollTop;
  const fu = rows.findIndex(m=> m.ts>last && m.uid!==state.uid);
  const live = !first && visible && wasBottom;           // new msg arrives while you're reading the bottom: no line
  log.innerHTML = rows.map((m,i)=> (i===fu && !live ? '<div class="unread-line"></div>' : "") + chatMessageHTML(m, m.id, path)).join("");
  wireChatRowInteractions(log);
  if(!log._sw){ log._sw = true; log.addEventListener("scroll", ()=>{ if(chatAtBottom(log) && log.querySelector(".unread-line")) markRead(log, log._key); }); }
  log.dataset.init = "1";
  if(first){ if(visible) focusChatLog(log); }
  else if(live){ log.scrollTop = log.scrollHeight; markRead(log, key); }
  else log.scrollTop = prevTop;
}
function focusChatLog(log){
  const line = log.querySelector(".unread-line");
  log.scrollTop = line ? Math.max(0, line.offsetTop-10) : log.scrollHeight;
  if(line && chatAtBottom(log)) setTimeout(()=>{ if(log.querySelector(".unread-line")) markRead(log, log._key); }, 2000);
}
function focusVisibleChat(){ ["chatLogGlobal","chatLogPrivate"].forEach(id=>{ const l=document.getElementById(id); if(l.offsetParent!==null) focusChatLog(l); }); }
document.querySelectorAll("[data-chatsub]").forEach(b=> b.addEventListener("click", ()=> setTimeout(focusVisibleChat,0)));
function wireChatRowInteractions(log){
  log.querySelectorAll(".chat-username").forEach(el=>{
    el.addEventListener("click", ()=> openProfileByUid(el.dataset.uid));
  });
  log.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const [col, ...rest] = btn.dataset.cpath.split("/");
      const ref = rest.length ? doc(db, col, ...rest, btn.dataset.del) : doc(db, col, btn.dataset.del);
      await withErrorToast(()=> deleteDoc(ref));
    });
  });
}
function subscribeGlobalChat(){
  const q = query(collection(db,"globalChat"), orderBy("ts","desc"), limit(50));
  const unsub = onSnapshot(q, (snap)=>{
    const log = document.getElementById("chatLogGlobal");
    const rows = [];
    snap.forEach(d=>rows.unshift({id:d.id, ...d.data()}));
    renderChatLog(log, rows, "global", "globalChat");
  }, (err)=> toast(friendlyFirebaseError(err)));
  state.unsubs.push(unsub);
}
function escapeHTML(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
document.getElementById("globalChatForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const input = document.getElementById("globalChatInput");
  const raw = input.value.trim();
  if(!raw) return;
  hideChatCmdPopup();
  if(raw.startsWith("/")){
    await runChatCommand(raw);
    input.value="";
    return;
  }
  const text = moderateChatText(raw);
  if(!text) return;
  input.value=""; markRead(document.getElementById("chatLogGlobal"), "global");
  const ok = await withErrorToast(()=> addDoc(collection(db,"globalChat"), { uid:state.uid, username:state.profile.username, text, ts: Date.now() }));
  if(ok===null) input.value = raw;
});

/* ---------- slash commands ---------- */
const CHAT_COMMANDS = [
  { cmd:"/pay [username] [amount]", desc:"Send money to another player." },
  { cmd:"/ah", desc:"Jump to the Auction House." },
  { cmd:"/ah sell [item] [price]", desc:"List 1 of that item on the auction for that price." },
  { cmd:"/friend [username]", desc:"Send a friend request." },
  { cmd:"/friend remove [username]", desc:"Unfriend a player." },
  { cmd:"/msg [username]", desc:"Open a private chat with a player." }
];
function hideChatCmdPopup(){
  const pop = document.getElementById("chatCmdPopup");
  pop.style.display = "none"; pop.innerHTML = "";
}
function showChatCmdPopup(filterText){
  const pop = document.getElementById("chatCmdPopup");
  const matches = CHAT_COMMANDS.filter(c=> c.cmd.toLowerCase().startsWith(filterText.toLowerCase()) || filterText==="/");
  if(!matches.length){ hideChatCmdPopup(); return; }
  pop.innerHTML = matches.map(c=>`<div class="chat-cmd-row"><b>${escapeHTML(c.cmd)}</b> — ${escapeHTML(c.desc)}</div>`).join("");
  pop.style.display = "flex";
}
document.getElementById("globalChatInput").addEventListener("input", (e)=>{
  const v = e.target.value;
  if(v.startsWith("/")) showChatCmdPopup(v);
  else hideChatCmdPopup();
});
document.getElementById("globalChatInput").addEventListener("blur", ()=> setTimeout(hideChatCmdPopup, 150));

async function findUidByUsername(username){
  const q = query(collection(db,"players"), where("username","==",username));
  const snap = await getDocs(q);
  if(snap.empty) return null;
  return { uid: snap.docs[0].id, data: snap.docs[0].data() };
}
async function runChatCommand(raw){
  const parts = raw.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  if(cmd === "/pay"){
    const [ , username, amountStr ] = parts;
    const amount = Number(amountStr);
    if(!username || !Number.isFinite(amount) || amount<=0){ toast("Usage: /pay [username] [amount]"); return; }
    if(amount > (state.profile.money||0)){ toast("You don't have that much money."); return; }
    if(username.toLowerCase() === state.profile.username.toLowerCase()){ toast("You can't pay yourself."); return; }
    const target = await findUidByUsername(username);
    if(!target){ toast(`No player named ${username}.`); return; }
    // Never write another player's doc directly — deduct from OUR OWN
    // balance, then drop an inbox notice on theirs (same pattern as
    // auction/duel payouts) that their own client auto-credits.
    const ok = await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { money: (state.profile.money||0) - amount }));
    if(ok===null) return;
    await withErrorToast(()=> addDoc(collection(db,"players",target.uid,"inbox"), {
      type:"payment_received", amount, fromUsername: state.profile.username, ts: Date.now(), credited:false
    }));
    toast(`Paid $${amount} to ${username}.`);
    return;
  }
  if(cmd === "/ah"){
    if(parts[1]?.toLowerCase() === "sell"){
      const itemName = parts[2];
      const price = Number(parts[3]);
      if(!itemName || !Number.isFinite(price) || price<=0){ toast("Usage: /ah sell [item] [price]"); return; }
      const entry = invExpanded().find(e=> e.item.name.toLowerCase() === itemName.toLowerCase() || e.item.name.toLowerCase().replace(/\s+/g,"") === itemName.toLowerCase());
      if(!entry || entry.qty<1){ toast(`You don't have a ${itemName}.`); return; }
      try{
        const mySnap = await getDocs(query(collection(db,"auction"), where("sellerUid","==",state.uid)));
        const activeCount = mySnap.docs.filter(d=>d.data().status==="active").length;
        if(activeCount >= 10){ toast("You can only have 10 auction slots."); return; }
      }catch(err){ toast(friendlyFirebaseError(err)); return; }
      const ok = await applyInvChanges({ remove:[{itemId:entry.item.id, qty:1}] });
      if(ok===null) return;
      const posted = await withErrorToast(()=> addDoc(collection(db,"auction"), {
        sellerUid: state.uid, sellerName: state.profile.username, itemId: entry.item.id, qty:1, pricePer: price,
        status:"active", postedAt: Date.now(), expiresAt: Date.now() + 1000*60*60*24
      }));
      if(posted===null){ await addItemToInv(entry.item.id, 1); return; }
      toast(`Posted 1 ${entry.item.name} to the auction for $${price}.`);
      return;
    }
    document.querySelector('[data-ctab="auction"]')?.click();
    return;
  }
  if(cmd === "/friend"){
    if(parts[1]?.toLowerCase() === "remove"){
      const username = parts[2];
      if(!username){ toast("Usage: /friend remove [username]"); return; }
      const target = await findUidByUsername(username);
      if(!target){ toast(`No player named ${username}.`); return; }
      if(!(state.profile.friends||[]).includes(target.uid)){ toast(`You're not friends with ${username}.`); return; }
      await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { friends: arrayRemove(target.uid) }));
      toast(`Removed ${username} as a friend.`);
      return;
    }
    const username = parts[1];
    if(!username){ toast("Usage: /friend [username]"); return; }
    const target = await findUidByUsername(username);
    if(!target){ toast(`No player named ${username}.`); return; }
    await sendFriendRequest(target.uid, username);
    return;
  }
  if(cmd === "/msg"){
    const username = parts[1];
    if(!username){ toast("Usage: /msg [username]"); return; }
    const target = await findUidByUsername(username);
    if(!target){ toast(`No player named ${username}.`); return; }
    openPrivateChatWith(target.uid, username);
    return;
  }
  toast(`Unknown command: ${cmd}`);
}
document.querySelectorAll("[data-chatsub]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll("[data-chatsub]").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".chatsub-page").forEach(p=>p.classList.remove("active"));
    document.getElementById("chatsub-"+btn.dataset.chatsub).classList.add("active");
  });
});
function pmThreadId(a,b){ return [a,b].sort().join("_"); }
function openPrivateChatWith(uid, username){
  state.currentChatPartner = { uid, username };
  // Immediately make sure this person's PM subsection shows up in the
  // contacts list to click between, even if you're not friends yet.
  state.pmContactsExtra[uid] = username;
  openModal("compassModal");
  document.querySelector('[data-ctab="chat"]').click();
  document.querySelector('[data-chatsub="private"]').click();
  subscribePrivateThread();
  renderPMContacts();
}
function subscribeFriendsAsContacts(){
  const unsub = onSnapshot(doc(db,"players",state.uid), snap=>{
    if(snap.exists()) renderPMContacts(snap.data().friends||[]);
  }, (err)=> toast(friendlyFirebaseError(err)));
  state.unsubs.push(unsub);
}
async function renderPMContacts(friendUids){
  const list = document.getElementById("pmContacts");
  friendUids = friendUids || state.profile?.friends || [];
  // Merge in anyone you've privately messaged who isn't a mutual friend,
  // so their thread stays reachable without needing to add them.
  const allUids = [...new Set([...friendUids, ...Object.keys(state.pmContactsExtra)])];
  list.innerHTML="";
  for(const uid of allUids){
    try{
      const snap = await getDoc(doc(db,"players",uid));
      if(!snap.exists()) continue;
      const li = document.createElement("li");
      li.textContent = snap.data().username;
      if(state.currentChatPartner?.uid===uid) li.classList.add("active");
      li.addEventListener("click", ()=> openPrivateChatWith(uid, snap.data().username));
      list.appendChild(li);
    }catch(err){ console.error(err); }
  }
}
let pmUnsub = null;
function subscribePrivateThread(){
  if(pmUnsub) pmUnsub();
  document.getElementById("chatLogPrivate").dataset.init="";
  if(!state.currentChatPartner) return;
  const threadId = pmThreadId(state.uid, state.currentChatPartner.uid);
  const q = query(collection(db,"privateChats",threadId,"messages"), orderBy("ts","desc"), limit(100));
  pmUnsub = onSnapshot(q, snap=>{
    const log = document.getElementById("chatLogPrivate");
    const rows = [];
    snap.forEach(d=>rows.unshift({id:d.id, ...d.data()}));
    renderChatLog(log, rows, "pm_"+threadId, `privateChats/${threadId}/messages`);
  }, (err)=> toast(friendlyFirebaseError(err)));
}
document.getElementById("privateChatForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  if(!state.currentChatPartner) { toast("Pick a friend to message."); return; }
  const input = document.getElementById("privateChatInput");
  const raw = input.value.trim();
  const text = moderateChatText(raw);
  if(!text) return;
  const threadId = pmThreadId(state.uid, state.currentChatPartner.uid);
  input.value=""; markRead(document.getElementById("chatLogPrivate"), "pm_"+threadId);
  const ok = await withErrorToast(()=> addDoc(collection(db,"privateChats",threadId,"messages"), { uid:state.uid, username:state.profile.username, text, ts:Date.now() }));
  if(ok===null){ input.value = raw; return; }
  // Ping the recipient's inbox so they get a popup if that chat isn't open
  // (the recipient's client shows the toast, then deletes this ping).
  addDoc(collection(db,"players",state.currentChatPartner.uid,"inbox"), {
    type:"new_message", fromUid: state.uid, fromUsername: state.profile.username, ts: Date.now()
  }).catch(()=>{});
});
/* Friend requests / accept notifications only ever write to the CURRENT
   user's own player doc — never to another player's — because the
   Firestore rules (correctly) forbid writing someone else's document.
   The other side of the handshake is applied by the OTHER player's own
   client, triggered by an inbox notification only they can read. */
async function sendFriendRequest(uid, username){
  if(uid === state.uid){ toast("You can't friend yourself!"); return; }
  if((state.profile.friends||[]).includes(uid)){ toast("You're already friends."); return; }
  if((state.profile.sentFriendRequests||[]).includes(uid)){ toast("Request already pending."); return; }
  const ok = await withErrorToast(async ()=>{
    await addDoc(collection(db,"players",uid,"inbox"), {
      type:"friend_request", fromUid: state.uid, fromUsername: state.profile.username, ts: Date.now()
    });
    // mark pending on OUR OWN doc only — flips the button to yellow
    // everywhere we view this profile, and blocks sending a 2nd request.
    await updateDoc(doc(db,"players",state.uid), { sentFriendRequests: arrayUnion(uid) });
  });
  if(ok!==null){ toast(`Friend request sent to ${username}`); closeModal("profileModal"); }
}
let crediting = false, creditQueued = null;
async function creditInbox(docs){
  if(crediting){ creditQueued = docs; return; } crediting = true;
  const items = [];
  try{
    await runTransaction(db, async tx=>{
      items.length = 0;
      const pref = doc(db,"players",state.uid), ps = await tx.get(pref), fresh = [];
      for(const d of docs){ const s = await tx.get(d.ref); if(s.exists() && !s.data().credited) fresh.push(s); }
      if(!fresh.length) return;
      tx.update(pref, { money: (ps.data().money||0) + fresh.reduce((a,s)=>a+(s.data().amount||0),0) });
      fresh.forEach(s=>{ tx.update(s.ref, { credited:true }); if(s.data().type==="duel_won" && s.data().itemName) items.push(s.data().itemName); });
    });
    items.forEach(n=>{ const it = Object.values(ITEM_BY_ID).find(i=>i.name===n); if(it) addItemToInv(it.id,1); });
  }catch(e){ console.error(e); toast(friendlyFirebaseError(e)); }
  finally{
    crediting = false;
    if(creditQueued){ const q = creditQueued; creditQueued = null; creditInbox(q); }
  }
}
function subscribeInbox(){
  const q = query(collection(db,"players",state.uid,"inbox"), orderBy("ts","desc"));
  let inboxFirst = true;
  const unsub = onSnapshot(q, snap=>{
    // Pop-up notification the instant a payment / auction sale lands
    // (the first snapshot is skipped; the welcome-back recap covers those).
    snap.docChanges().forEach(ch=>{
      if(ch.type!=="added") return;
      const n = ch.doc.data();
      if(n.type==="new_message"){
        const log = document.getElementById("chatLogPrivate");
        const viewing = log && log.offsetParent!==null && state.currentChatPartner?.uid===n.fromUid;
        if(!inboxFirst && !viewing) toast(`💬 ${n.fromUsername} sent you a new message`, 5000, "toast-money");
        deleteDoc(ch.doc.ref).catch(()=>{});
        return;
      }
      if(inboxFirst) return;
      if(n.type==="payment_received" && !n.credited){ toast(`💰 ${n.fromUsername} paid you $${fmtMoney(n.amount)}!`, 6000, "toast-money"); playSfx("buy"); }
      else if(n.type==="auction_sold" && !n.credited){ toast(`🏷️ ${n.buyerName||"Someone"} bought your ${n.itemName} for $${fmtMoney(n.amount)}!`, 6000, "toast-money"); playSfx("buy"); }
    });
    inboxFirst = false;
    // Auto-credit ALL not-yet-credited auction sales in this batch as ONE
    // combined write (not one write per doc) — several sales landing in
    // the same snapshot and each reading state.profile.money separately
    // would race the same way the old crafting bug did.
    const uncredited = snap.docs.filter(d=> ["auction_sold","duel_won","payment_received"].includes(d.data().type) && !d.data().credited);
    if(uncredited.length) creditInbox(uncredited);
    const list = document.getElementById("inboxList");
    list.innerHTML="";
    snap.forEach(d=>{
      const n = d.data();
      if(n.type==="new_message") return;
      const li = document.createElement("li");
      if(n.type==="friend_request"){
        li.innerHTML = `<span>${escapeHTML(n.fromUsername)} wants to be friends</span>
          <span><button class="doodle-btn btn-sm btn-green" data-a="accept">Accept</button>
          <button class="doodle-btn btn-sm" data-a="decline">Decline</button></span>`;
        li.querySelector('[data-a="accept"]').addEventListener("click", ()=> withErrorToast(async ()=>{
          // only ever write to OUR OWN doc; notify the other player so
          // their own client adds the friendship on their side too
          await updateDoc(doc(db,"players",state.uid), { friends: arrayUnion(n.fromUid) });
          await addDoc(collection(db,"players",n.fromUid,"inbox"), {
            type:"friend_accept", byUid: state.uid, byUsername: state.profile.username, ts: Date.now()
          });
          await deleteDoc(doc(db,"players",state.uid,"inbox",d.id));
        }));
        li.querySelector('[data-a="decline"]').addEventListener("click", ()=> withErrorToast(async ()=>{
          // tell the sender so THEIR client can clear its own pending flag
          // (their button goes back to green) — we still never write to
          // their document directly.
          await addDoc(collection(db,"players",n.fromUid,"inbox"), {
            type:"friend_declined", byUid: state.uid, byUsername: state.profile.username, ts: Date.now()
          });
          await deleteDoc(doc(db,"players",state.uid,"inbox",d.id));
        }));
      } else if(n.type==="friend_accept"){
        li.innerHTML = `<span>${escapeHTML(n.byUsername)} accepted your friend request!</span><button class="doodle-btn btn-sm" data-a="ok">OK</button>`;
        li.querySelector('[data-a="ok"]').addEventListener("click", ()=> withErrorToast(async ()=>{
          await updateDoc(doc(db,"players",state.uid), {
            friends: arrayUnion(n.byUid), sentFriendRequests: arrayRemove(n.byUid)
          });
          await deleteDoc(doc(db,"players",state.uid,"inbox",d.id));
        }));
      } else if(n.type==="friend_declined"){
        li.innerHTML = `<span>${escapeHTML(n.byUsername)} declined your friend request.</span><button class="doodle-btn btn-sm" data-a="ok">OK</button>`;
        li.querySelector('[data-a="ok"]').addEventListener("click", ()=> withErrorToast(async ()=>{
          await updateDoc(doc(db,"players",state.uid), { sentFriendRequests: arrayRemove(n.byUid) });
          await deleteDoc(doc(db,"players",state.uid,"inbox",d.id));
        }));
      } else if(n.type==="payment_received"){
        li.innerHTML = `<span>${escapeHTML(n.fromUsername)} paid you $${fmtMoney(n.amount)}! (credited to your balance)</span><button class="doodle-btn btn-sm" data-a="ok">Dismiss</button>`;
        li.querySelector('[data-a="ok"]').addEventListener("click", ()=> withErrorToast(()=> deleteDoc(doc(db,"players",state.uid,"inbox",d.id))));
      } else if(n.type==="duel_won"){
        const itemMsg = n.itemName ? ` and their ${escapeHTML(n.itemName)}` : "";
        li.innerHTML = `<span>You won a duel vs ${escapeHTML(n.fromUsername)}! +$${n.amount}${itemMsg} (credited)</span><button class="doodle-btn btn-sm" data-a="ok">Dismiss</button>`;
        li.querySelector('[data-a="ok"]').addEventListener("click", ()=> withErrorToast(()=> deleteDoc(doc(db,"players",state.uid,"inbox",d.id))));
      } else if(n.type==="auction_sold"){
        // Money is auto-credited above the moment this doc is seen — this
        // is now purely a dismissible reminder, no claim step.
        li.innerHTML = `<span>${escapeHTML(n.buyerName||"Someone")} bought your ${escapeHTML(n.itemName)} for $${fmtMoney(n.amount)}! (credited to your balance)</span><button class="doodle-btn btn-sm" data-a="ok">Dismiss</button>`;
        li.querySelector('[data-a="ok"]').addEventListener("click", ()=> withErrorToast(()=> deleteDoc(doc(db,"players",state.uid,"inbox",d.id))));
      } else {
        li.innerHTML = `<span>${escapeHTML(n.text||"Notification")}</span><button class="doodle-btn btn-sm" data-a="ok">OK</button>`;
        li.querySelector('[data-a="ok"]').addEventListener("click", ()=> withErrorToast(()=> deleteDoc(doc(db,"players",state.uid,"inbox",d.id))));
      }
      list.appendChild(li);
    });
    if(list.children.length===0) list.innerHTML="<li>Inbox is empty.</li>";
  }, (err)=> toast(friendlyFirebaseError(err)));
  state.unsubs.push(unsub);
}

/* =========================================================================
   AUCTION HOUSE
   Purchases are done as an UPDATE (mark status "sold"), never a delete by
   a non-owner — Firestore rules only allow the seller to delete their own
   listing (cancel). See rpg_firestore.rules for the exact conditions this
   depends on, and the note in the final write-up about why this still
   isn't fully trustless without a Cloud Function.
   ========================================================================= */
document.querySelectorAll("[data-aucsub]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll("[data-aucsub]").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".aucsub-page").forEach(p=>p.classList.remove("active"));
    document.getElementById("aucsub-"+btn.dataset.aucsub).classList.add("active");
    if(btn.dataset.aucsub==="mine") populatePostForm();
  });
});
let auctionUnsub = null;
let auctionListingsCache = {}; // id -> {listing, item}
let auctionSelectedId = null;
let auctionDetailTimerInterval = null;
function renderAuction(){
  // NOTE: this intentionally does NOT combine where("status","==","active")
  // with orderBy("postedAt") — mixing an equality filter with an orderBy on
  // a DIFFERENT field requires a Firestore composite index. Firebase won't
  // create that automatically, and without it this query fails outright
  // (which is why the auction house looked "broken"). Filtering status and
  // expiry client-side instead avoids needing any manual index.
  const q = query(collection(db,"auction"), orderBy("postedAt","desc"), limit(60));
  if(auctionUnsub) auctionUnsub();
  auctionUnsub = onSnapshot(q, snap=>{
    const grid = document.getElementById("auctionGrid");
    grid.innerHTML="";
    auctionListingsCache = {};
    snap.forEach(d=>{
      const listing = d.data();
      if(listing.status !== "active") return;
      if(listing.expiresAt < Date.now()) return;
      const item = ITEM_BY_ID[listing.itemId];
      if(!item) return;
      auctionListingsCache[d.id] = { listing, item };
      const cell = document.createElement("div");
      cell.className = "inv-cell rarity-"+item.rarity + (auctionSelectedId===d.id ? " selected" : "");
      cell.dataset.listingId = d.id;
      cell.innerHTML = `<div>${item.name}</div><span class="qty-badge">x${listing.qty}</span><div style="font-size:11px">$${listing.pricePer} ea</div>`;
      // Hover OR click shows the details/buy panel — buying itself always
      // needs the separate confirm button below, never the cell itself,
      // so a stray click can't accidentally purchase something.
      cell.addEventListener("mouseenter", ()=> showAuctionDetail(d.id));
      cell.addEventListener("click", ()=> selectAuctionListing(d.id));
      grid.appendChild(cell);
    });
    // if the selected/hovered listing just disappeared (sold/expired/cancelled), hide the panel
    if(auctionSelectedId && !auctionListingsCache[auctionSelectedId]) hideAuctionDetail();
  }, (err)=> toast(friendlyFirebaseError(err)));
}
function selectAuctionListing(id){
  auctionSelectedId = id;
  document.querySelectorAll("#auctionGrid .inv-cell").forEach(c=> c.classList.toggle("selected", c.dataset.listingId===id));
  showAuctionDetail(id);
}
function showAuctionDetail(id){
  const entry = auctionListingsCache[id];
  const panel = document.getElementById("auctionDetail");
  if(!entry){ hideAuctionDetail(); return; }
  const { listing, item } = entry;
  panel.style.display = "";
  document.getElementById("aucDetailName").textContent = `${item.name} (${item.rarity}) x${listing.qty}`;
  document.getElementById("aucDetailMeta").textContent =
    `Posted by ${listing.sellerName} — $${listing.pricePer} each, $${listing.pricePer*listing.qty} total`;
  const buyBtn = document.getElementById("aucDetailBuyBtn");
  const isOwnListing = listing.sellerUid === state.uid;
  buyBtn.style.display = isOwnListing ? "none" : "";
  buyBtn.disabled = false;
  buyBtn.textContent = "Buy";
  buyBtn.onclick = ()=> buyAuctionListing(id, listing, item);
  if(auctionDetailTimerInterval) clearInterval(auctionDetailTimerInterval);
  const tick = ()=>{
    const entryNow = auctionListingsCache[id];
    const timerEl = document.getElementById("aucDetailTimer");
    if(!entryNow){ clearInterval(auctionDetailTimerInterval); return; }
    const msLeft = entryNow.listing.expiresAt - Date.now();
    if(msLeft <= 0){ timerEl.textContent = "Expired"; clearInterval(auctionDetailTimerInterval); return; }
    const mins = Math.floor(msLeft/60000), secs = Math.floor((msLeft%60000)/1000);
    timerEl.textContent = `Expires in ${mins}m ${secs}s`;
  };
  tick();
  auctionDetailTimerInterval = setInterval(tick, 1000);
}
function hideAuctionDetail(){
  auctionSelectedId = null;
  document.getElementById("auctionDetail").style.display = "none";
  if(auctionDetailTimerInterval){ clearInterval(auctionDetailTimerInterval); auctionDetailTimerInterval=null; }
}
async function buyAuctionListing(listingId, listing, item){
  const buyBtn = document.getElementById("aucDetailBuyBtn");
  buyBtn.disabled = true; buyBtn.textContent = "Buying…";
  let bought = null, err = null;
  try{
    bought = await runTransaction(db, async (tx)=>{
      const lref = doc(db,"auction",listingId), pref = doc(db,"players",state.uid);
      const lsnap = await tx.get(lref), psnap = await tx.get(pref);
      if(!lsnap.exists() || lsnap.data().status !== "active" || lsnap.data().expiresAt < Date.now()) throw new Error("gone");
      const L = lsnap.data(), cost = L.pricePer * L.qty, d = psnap.data() || {};
      if(L.sellerUid === state.uid) throw new Error("own");
      if((d.money||0) < cost) throw new Error("nomoney");
      const inv = (d.inventory||[]).map(e=>({...e}));
      const idx = inv.findIndex(e=>e.itemId===L.itemId);
      if(idx>=0) inv[idx].qty += L.qty; else inv.push({ itemId:L.itemId, qty:L.qty });
      tx.update(lref, { status:"sold", buyerUid: state.uid, buyerName: state.profile.username, soldAt: Date.now() });
      tx.update(pref, { money: (d.money||0) - cost, inventory: inv });
      return { cost, qty:L.qty, sellerUid:L.sellerUid };
    });
  }catch(e){ err = e; }
  buyBtn.disabled=false; buyBtn.textContent="Buy";
  if(!bought){
    if(err?.message==="nomoney") toast("Not enough money!");
    else if(err?.message==="own") toast("You can't buy your own listing.");
    else if(err?.message==="gone") toast("That listing is no longer available.");
    else toast(friendlyFirebaseError(err));
    return;
  }
  hideAuctionDetail();
  playSfx("buy");
  toast(`Bought ${item.name} x${bought.qty}`);
  // seller credits themselves from this notification — see subscribeInbox()
  await withErrorToast(()=> addDoc(collection(db,"players",bought.sellerUid,"inbox"), {
    type:"auction_sold", itemName:item.name, amount: bought.cost, buyerName: state.profile.username, ts: Date.now()
  }));
}
function populatePostForm(){
  const sel = document.getElementById("postItemSelect");
  sel.innerHTML="";
  invExpanded().forEach(e=>{
    const opt = document.createElement("option");
    opt.value = e.itemId; opt.textContent = `${e.item.name} (x${e.qty})`;
    sel.appendChild(opt);
  });
  updatePostTotal();
  renderMySlots();
}
function updatePostTotal(){
  const qty = Number(document.getElementById("postQty").value)||0;
  const price = Number(document.getElementById("postPrice").value)||0;
  document.getElementById("postTotalLabel").textContent = `Total: $${qty*price}`;
}
document.getElementById("postQty").addEventListener("input", updatePostTotal);
document.getElementById("postPrice").addEventListener("input", updatePostTotal);
document.getElementById("btnPostAuction").addEventListener("click", async ()=>{
  const itemId = document.getElementById("postItemSelect").value;
  const qty = Number(document.getElementById("postQty").value);
  const price = Number(document.getElementById("postPrice").value);
  if(!itemId || qty<1 || price<1){ toast("Enter a valid quantity and price."); return; }
  try{
    const mySnap = await getDocs(query(collection(db,"auction"), where("sellerUid","==",state.uid)));
    const activeCount = mySnap.docs.filter(d=>d.data().status==="active").length;
    if(activeCount >= 10){ toast("You can only have 10 auction slots."); return; }
  }catch(err){ toast(friendlyFirebaseError(err)); return; }
  const entry = invExpanded().find(e=>e.itemId===itemId);
  if(!entry || entry.qty < qty){ toast("You don't have that many."); return; }
  await changeInvQty(itemId, -qty);
  const ok = await withErrorToast(()=> addDoc(collection(db,"auction"), {
    sellerUid: state.uid, sellerName: state.profile.username, itemId, qty, pricePer: price,
    status:"active", postedAt: Date.now(), expiresAt: Date.now() + 1000*60*60*24
  }));
  if(ok===null){ await addItemToInv(itemId, qty); return; } // roll back on failure
  toast("Posted to auction house!");
  populatePostForm();
});
let mySlotsUnsub = null;
function renderMySlots(){
  if(mySlotsUnsub) return; // already live
  const q = query(collection(db,"auction"), where("sellerUid","==",state.uid));
  mySlotsUnsub = onSnapshot(q, snap=>{
    const grid = document.getElementById("myAuctionSlots");
    grid.innerHTML="";
    snap.forEach(d=>{
      const listing = d.data();
      if(listing.status !== "active") return;
      const item = ITEM_BY_ID[listing.itemId];
      if(!item) return;
      const cell = document.createElement("div");
      cell.className="inv-cell rarity-"+item.rarity;
      cell.innerHTML = `<div>${item.name}</div><span class="qty-badge">x${listing.qty}</span><button class="doodle-btn btn-sm" style="margin-top:4px">Cancel</button>`;
      cell.querySelector("button").addEventListener("click", async (ev)=>{
        ev.stopPropagation();
        const ok = await withErrorToast(()=> deleteDoc(doc(db,"auction",d.id)));
        if(ok===null) return;
        await addItemToInv(item.id, listing.qty);
      });
      grid.appendChild(cell);
    });
  }, err=> toast(friendlyFirebaseError(err)));
  state.unsubs.push(()=>{ if(mySlotsUnsub){ mySlotsUnsub(); mySlotsUnsub = null; } });
}

/* --- crafting: recipe book (banners you scroll; pick one, confirm with CRAFT) --- */
const RECIPES = [];
(function buildRecipes(){
  const I = ITEM_BY_ID;
  const add = (id, name, type, rarity, extra, ing)=>{
    if(!I[id]){
      const sell = Math.max(1, Math.round(ing.reduce((s,[iid,q])=> s+(I[iid]?.sellPrice||3)*q, 0)*1.3));
      I[id] = { id, name, type, rarity, price:sell*3, sellPrice:sell, desc:"Crafted.", stats:{}, ...extra };
    }
    RECIPES.push({ id:"rc_"+id, out:id, ing });
  };
  // coal-fired basics
  add("ing_copper","Copper Ingot","material","common",{desc:"Smelted copper."},[["ore_copper",2],["ore_coal",1]]);
  add("ing_iron","Iron Ingot","material","uncommon",{desc:"Smelted iron."},[["ore_iron",2],["ore_coal",1]]);
  add("ing_bronze","Bronze Ingot","material","uncommon",{desc:"Copper and iron alloy."},[["ore_copper",2],["ore_iron",1],["ore_coal",1]]);
  add("ing_steel","Steel Ingot","material","rare",{desc:"Hardened steel."},[["ing_iron",2],["ore_coal",2]]);
  add("gem_quartz_cut","Polished Quartz","material","rare",{desc:"A cut gem."},[["gem_quartz",2]]);
  add("gem_ruby_cut","Cut Ruby","material","epic",{desc:"A flawless cut gem."},[["gem_ruby",2]]);
  add("ing_silver","Silver Ingot","material","uncommon",{desc:"Smelted silver."},[["ore_silver",2],["ore_coal",1]]);
  add("ing_gold","Gold Ingot","material","rare",{desc:"Smelted gold."},[["ore_gold",2],["ore_coal",1]]);
  add("gem_sapphire_cut","Cut Sapphire","material","rare",{desc:"A cut gem."},[["gem_sapphire",2]]);
  add("gem_emerald_cut","Cut Emerald","material","epic",{desc:"A cut gem."},[["gem_emerald",2]]);
  add("gem_diamond_cut","Cut Diamond","material","legendary",{desc:"A flawless cut diamond."},[["gem_diamond",2]]);
  // cooked fish: 1 fish + 1 coal
  ["fish_minnow","fish_bass","fish_trout","fish_swordfish","fish_golden"].forEach(f=>
    add("cooked_"+f, "Cooked "+I[f].name, "consumable", I[f].rarity, { stats:{heal:HEAL_BY_RARITY[I[f].rarity]}, desc:"Grilled over coal. Heals well." }, [[f,1],["ore_coal",1]]));
  // roasted forage
  ["forage_berry","forage_mushroom","forage_herb","forage_apple","forage_truffle","forage_goldapple"].forEach(f=>
    add("roast_"+f, "Roasted "+I[f].name.replace(/^Wild |^Healing |^Forest /,""), "consumable", I[f].rarity, { stats:{heal:HEAL_BY_RARITY[I[f].rarity]}, desc:"Roasted over coal." }, [[f,1],["ore_coal",1]]));
  // dishes: every pair of edible ingredients
  const edible = ["forage_berry","forage_mushroom","forage_herb","forage_apple","forage_truffle","forage_goldapple","fish_minnow","fish_bass","fish_trout","fish_swordfish","fish_golden"];
  const short = id=> I[id].name.replace(/^Wild |^Healing |^Forest /,"");
  const sfx = ["Stew","Skewer","Pie","Soup","Salad","Roast"]; let n=0;
  for(let i=0;i<edible.length;i++) for(let j=i+1;j<edible.length;j++){
    const a=edible[i], b=edible[j];
    const rarity = RARITIES[Math.max(RARITIES.indexOf(I[a].rarity), RARITIES.indexOf(I[b].rarity))];
    add(`dish_${a}_${b}`, `${short(a)} & ${short(b)} ${sfx[n++%6]}`, "consumable", rarity, { stats:{heal:HEAL_BY_RARITY[rarity]}, desc:"A hearty homemade dish." }, [[a,1],[b,1]]);
  }
  // gear tiers
  const tiers = [["Copper","ing_copper","common","SPEED"],["Bronze","ing_bronze","uncommon","STRENGTH"],["Iron","ing_iron","uncommon","STRENGTH"],
                 ["Quartz","gem_quartz_cut","rare","SMARTS"],["Steel","ing_steel","rare","STRENGTH"],["Ruby","gem_ruby_cut","epic","CHARM"],
                 ["Silver","ing_silver","uncommon","SMARTS"],["Gold","ing_gold","rare","CHARM"],["Sapphire","gem_sapphire_cut","rare","SMARTS"],
                 ["Emerald","gem_emerald_cut","epic","SPEED"],["Diamond","gem_diamond_cut","legendary","STRENGTH"]];
  const weapons = ["Sword","Dagger","Axe","Spear","Mace","Bow"];
  const armors = [["Helm","helmet",3],["Chestplate","chestplate",5],["Leggings","leggings",4],["Boots","boots",3]];
  tiers.forEach(([t,mat,rar,stat])=>{
    const m = RARITY_MULT[rar], k = t.toLowerCase();
    weapons.forEach((w,i)=> add(`gear_${k}_${w.toLowerCase()}`, `${t} ${w}`, "weapon", rar, { stats:{attack:Math.round(3*m)+2+(i%3)}, desc:`A ${t.toLowerCase()} ${w.toLowerCase()} you forged yourself.` }, [[mat,2+(i%2)],["ore_coal",1]]));
    armors.forEach(([a,slot,q])=> add(`gear_${k}_${a.toLowerCase()}`, `${t} ${a}`, "armor", rar, { armorSlot:slot, stats:{defense:Math.round(2*m)+1, hp:Math.round(4*m)}, desc:`Sturdy ${t.toLowerCase()} protection.` }, [[mat,q],["ore_coal",1]]));
    add(`gear_${k}_ring`, `${t} Ring`, "trinket", rar, { stats:{[stat]:Math.max(1,Math.round(m)), curse:false}, desc:`A ${t.toLowerCase()} ring boosting ${stat}.` }, [[mat,1],["ore_coal",1]]);
    add(`gear_${k}_amulet`, `${t} Amulet`, "trinket", rar, { stats:{[stat]:Math.max(1,Math.round(m))+1, curse:false}, desc:`A ${t.toLowerCase()} amulet boosting ${stat}.` }, [[mat,2],["forage_herb",2]]);
  });
  // tools
  [["tool_pickaxe","ing_copper"],["tool_pickaxe2","ing_iron"],["tool_pickaxe3","ing_steel"]].forEach(([o,m])=> add(o,"","tool","common",{},[[m,2],["forage_mushroom",1]]));
  [["tool_fishingrod","ing_copper"],["tool_fishingrod2","ing_iron"],["tool_fishingrod3","ing_steel"]].forEach(([o,m])=> add(o,"","tool","common",{},[[m,1],["forage_herb",2]]));
  // gem/mineral tools: far more durable
  [[4,"Gold","ing_gold","rare",50],[5,"Emerald","gem_emerald_cut","epic",100],[6,"Diamond","gem_diamond_cut","legendary",100]].forEach(([n,nm,mat,rar,u])=>{
    TOOL_USES["tool_pickaxe"+n] = u; TOOL_USES["tool_fishingrod"+n] = u;
    add("tool_pickaxe"+n, `${nm} Pickaxe`, "tool", rar, { desc:`Breaks after ${u} uses.` }, [[mat,2],["ing_steel",1]]);
    add("tool_fishingrod"+n, `${nm} Fishing Rod`, "tool", rar, { desc:`Breaks after ${u} uses.` }, [[mat,1],["ing_steel",1],["forage_herb",2]]);
  });
  // gem elixirs
  ["gem_quartz_cut","gem_ruby_cut","gem_sapphire_cut","gem_emerald_cut","gem_diamond_cut"].forEach(g=>
    add("elixir_"+g, "Elixir of "+I[g].name.replace(/^Polished |^Cut /,""), "consumable", I[g].rarity, { stats:{heal:HEAL_BY_RARITY[I[g].rarity]}, desc:"A shimmering gem elixir." }, [[g,1],["forage_herb",1]]));
})();
const haveQty = id=> (state.profile.inventory||[]).find(e=>e.itemId===id)?.qty||0;
const canCraft = r=> r.ing.every(([id,q])=> haveQty(id)>=q);
function renderCraftInv(){
  const p = state.profile; if(!p) return;
  const owned = invExpanded().map(e=>e.item.id), disc = new Set(p.discovered||[]);
  const fresh = owned.filter(id=>!disc.has(id));
  if(fresh.length){ fresh.forEach(id=>disc.add(id)); updateDoc(doc(db,"players",state.uid), { discovered: arrayUnion(...fresh) }).catch(()=>{}); }
  const unlocked = RECIPES.filter(r=> r.ing.every(([id])=> disc.has(id)));
  unlocked.sort((a,b)=> canCraft(b)-canCraft(a));
  document.getElementById("recipeCount").textContent = `${unlocked.length} / ${RECIPES.length} recipes discovered`;
  const list = document.getElementById("recipeList"); list.innerHTML = "";
  unlocked.forEach(r=>{
    const it = ITEM_BY_ID[r.out], ok = canCraft(r);
    const el = document.createElement("div");
    el.className = `recipe-banner rarity-${it.rarity}` + (ok?" can":"") + (state.selRecipe===r.id?" sel":"");
    el.innerHTML = `<b>${it.name}</b><span>${r.ing.map(([id,q])=>`${q}x ${ITEM_BY_ID[id].name}`).join(" + ")}</span>`;
    el.addEventListener("click", ()=>{ state.selRecipe=r.id; renderCraftInv(); });
    list.appendChild(el);
  });
  const sel = RECIPES.find(r=>r.id===state.selRecipe), det = document.getElementById("recipeDetail"), btn = document.getElementById("btnCraft");
  if(!sel){ det.textContent = "Pick a recipe above."; btn.disabled = true; return; }
  const it = ITEM_BY_ID[sel.out], st = it.stats||{};
  const eff = st.heal?`Heals ${st.heal} HP`: st.attack?`+${st.attack} attack`: st.defense?`+${st.defense} defense, +${st.hp||0} HP`: Object.keys(st).filter(k=>k!=="curse").map(k=>`+${st[k]} ${k}`).join(" ");
  det.innerHTML = `<h3>${it.name} <small>(${it.rarity})</small></h3><p>${it.desc||""} ${eff}</p>` +
    sel.ing.map(([id,q])=>`<div class="${haveQty(id)>=q?"ok":"no"}">${ITEM_BY_ID[id].name}: ${haveQty(id)}/${q}</div>`).join("");
  btn.disabled = !canCraft(sel);
}
document.getElementById("btnCraft").addEventListener("click", async ()=>{
  const r = RECIPES.find(x=>x.id===state.selRecipe); if(!r) return;
  if(!canCraft(r)){ toast("You're missing ingredients."); return; }
  const ok = await applyInvChanges({ remove:r.ing.map(([itemId,qty])=>({itemId,qty})), add:[{itemId:r.out, qty:1}] });
  if(ok===null) return;
  toast(`Crafted ${ITEM_BY_ID[r.out].name}!`);
  renderCraftInv();
});

/* =========================================================================
   BATTLE: PvE
   ========================================================================= */
/* PvE no longer opens a menu-driven battle modal — monsters live in the
   open world and are fought in real time with Space (see the WORLD
   section below). These pieces are still shared by that system. */
function pickEnemy(difficulty){
  const pool = ENEMY_BANK.filter(e=>e.region===state.profile.region && e.difficulty===difficulty);
  const slot = pool[Math.floor(Math.random()*pool.length)];
  return slot && makeMonsterFromSlot(slot, state.profile.level);
}
function playerAttackPower(){
  const p = state.profile;
  const weapon = p.equipped.weapon && ITEM_BY_ID[p.equipped.weapon];
  return 4 + p.stats.STRENGTH*1.5 + p.stats.SMARTS + (weapon?.stats.attack||0);
}
function playerDefense(){
  const p = state.profile;
  return ARMOR_SLOTS.reduce((sum,slot)=>{
    const piece = p.equipped[slot] && ITEM_BY_ID[p.equipped[slot]];
    return sum + (piece?.stats.defense||0);
  }, 0);
}
/* Skill-based attacks: Space = basic attack, number keys 1-4 in the open
   world trigger the others (see WORLD section). Kept from the old menu
   system so unlock levels/costs stay consistent. */
const ATTACK_SKILLS = [
  { id:"basic", name:"Attack", key:"1", unlockLevel:1,
    dmgMult:()=>1, desc:"A standard strike. Always available." },
  { id:"power", name:"Power Strike", key:"2", unlockLevel:1, needsFullRage:true,
    dmgMult:()=>2, desc:"Costs full Rage. Double damage." },
  { id:"precision", name:"Precision Strike", key:"3", unlockLevel:10, manaCost:6,
    dmgMult:()=>1.35, desc:"Unlocked at Lv.10. Costs 6 mana. Extra damage, ignores half enemy defense." },
  { id:"ultimate", name:"Ultimate Strike", key:"4", unlockLevel:30, manaCost:12,
    dmgMult:()=>3, desc:"Unlocked at Lv.30. Costs 12 mana. Devastating hit." },
];
function attackSkillById(id){ return ATTACK_SKILLS.find(s=>s.id===id) || ATTACK_SKILLS[0]; }
// Mana regenerates 1 point/minute while the world is loaded. Persisted to
// Firestore, not just local state, so it survives navigating away.
let manaRegenInterval=null;
function startManaRegen(){
  if(manaRegenInterval) clearInterval(manaRegenInterval);
  manaRegenInterval = setInterval(()=>{
    const p = state.profile; if(!p) return;
    const u = { playtime:(p.playtime||0)+60, lastSeen:Date.now() };
    if((p.mana||0) < (p.manaMax||0)) u.mana = (p.mana||0)+1;
    if((p.hp||0) < (p.hpMax||0)){ u.hp = Math.min(p.hpMax, p.hp+1); u.lastHpRegenTs = Date.now(); }
    updateDoc(doc(db,"players",state.uid), u).catch(()=>{});
  }, 60000);
}
function stopManaRegen(){ if(manaRegenInterval){ clearInterval(manaRegenInterval); manaRegenInterval=null; } }
function battleLogPush(msg){
  state.battle.log.push(msg);
  const el = document.getElementById("battleLog");
  el.innerHTML = state.battle.log.slice(-30).map(m=>`<div>${m}</div>`).join("");
  el.scrollTop = el.scrollHeight;
}
// Dying = hitting 1 HP in battle: you're kicked out, lose 10-25% of your
// money, and lose one random item from your inventory. extraFields lets
// callers (world PvE/PvP loss vs. duel loss) merge in their own updates
// in one write.
async function applyDeathPenalty(extraFields={}){
  const p = state.profile;
  const pct = 0.10 + Math.random()*0.15;
  const moneyLoss = Math.floor((p.money||0) * pct);
  const updates = {
    hp: 1, rage: 0,
    deaths: (p.deaths||0)+1,
    money: Math.max(0, (p.money||0) - moneyLoss),
    killstreak: 0,
    ...extraFields
  };
  await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), updates));
  const inv = p.inventory||[];
  let lostItemName = null;
  if(inv.length){
    const pick = inv[Math.floor(Math.random()*inv.length)];
    lostItemName = ITEM_BY_ID[pick.itemId]?.name || null;
    await changeInvQty(pick.itemId, -1);
  }
  return { moneyLoss, lostItemName };
}


/* =========================================================================
   PvE: strategic turn-based monster battles (Monsters tab)
   Each turn the monster TELEGRAPHS its intent (hard/medium ones sometimes
   feint). Pick a move that answers it, and manage Mana, Rage and food.
   ========================================================================= */
const INTENTS = {
  attack:{ icon:"⚔️", label:"Attack",     tip:"A normal hit." },
  heavy: { icon:"💥", label:"Heavy Slam", tip:"2.2x damage — Guard or Counter it!" },
  brace: { icon:"🛡️", label:"Brace",      tip:"Takes 60% less damage — set up a Focus, or use Precision." },
  drain: { icon:"🩸", label:"Drain",      tip:"Light hit that heals it — Counter whiffs on this." }
};
const INTENT_WEIGHTS = { easy:{attack:4,heavy:2,brace:2,drain:1}, medium:{attack:4,heavy:2,brace:2,drain:2}, hard:{attack:3,heavy:3,brace:2,drain:2} };
const FEINT_CHANCE = { easy:0.05, medium:0.12, hard:0.2 };
const REGION_SPRITE = { forest:"🐺", mountains:"🦅", volcano:"🐲", reef:"🦀" };
function rollIntent(diff){
  const bag = Object.entries(INTENT_WEIGHTS[diff]).flatMap(([k,n])=>Array(n).fill(k));
  return bag[Math.floor(Math.random()*bag.length)];
}
function nextIntent(b){
  b.shown = rollIntent(b.m.difficulty);
  b.actual = Math.random()<FEINT_CHANCE[b.m.difficulty] ? rollIntent(b.m.difficulty) : b.shown;
  battleLogPush(`Enemy intends: ${INTENTS[b.shown].icon} ${INTENTS[b.shown].label} — ${INTENTS[b.shown].tip}`);
}
function startPve(diff){
  const p = state.profile, m = pickEnemy(diff);
  if(!m){ toast("No monsters here."); return; }
  if(state.battle && state.battle.mode==="duel"){ toast("Finish your duel first."); return; }
  state.battle = { mode:"pve", m, ehp:m.hp, php:p.hp, mana:p.mana, rage:p.rage, guard:false, focus:false, counter:false, log:[], over:false, busy:false };
  document.querySelectorAll(".modal-backdrop.active").forEach(x=>x.classList.remove("active"));
  openModal("battleModal");
  battleLogPush(`A wild ${m.name} (Lv.${m.level}) appears!`);
  nextIntent(state.battle);
  renderPve();
}
function renderPve(){
  const b = state.battle, p = state.profile, m = b.m;
  document.getElementById("battleEnemyName").textContent = `${m.name} Lv.${m.level} — ${INTENTS[b.shown].icon} ${INTENTS[b.shown].label}`;
  document.getElementById("battleEnemySprite").textContent = REGION_SPRITE[m.region]||"🐉";
  document.getElementById("battleEnemyHPBar").style.width = (100*Math.max(0,b.ehp)/m.hp)+"%";
  document.getElementById("battleEnemyHPNum").textContent = `${Math.max(0,b.ehp)}/${m.hp}`;
  document.getElementById("battlePlayerName").textContent = p.username;
  document.getElementById("battlePlayerHPBar").style.width = (100*Math.max(0,b.php)/p.hpMax)+"%";
  document.getElementById("battlePlayerHPNum").textContent = `${Math.max(0,b.php)}/${p.hpMax}`;
  document.getElementById("battleStaminaLabel").textContent = `Mana ${b.mana}/${p.manaMax}${b.focus?" · 🎯 Focused (next hit x2)":""}`;
  document.getElementById("battleRageLabel").textContent = `${b.rage}/${p.rageMax}`;
  const box = document.getElementById("battleActions"); box.innerHTML = "";
  if(b.over) return;
  const add = (label, tip, fn, disabled, cls="btn-pink")=>{
    const el = document.createElement("button");
    el.className = `doodle-btn btn-sm ${cls}`; el.textContent = label; el.title = tip; el.disabled = !!disabled;
    el.addEventListener("click", fn); box.appendChild(el);
  };
  ATTACK_SKILLS.filter(s=>p.level>=s.unlockLevel).forEach(s=>{
    const dis = (s.needsFullRage && b.rage<p.rageMax) || (s.manaCost && b.mana<s.manaCost);
    add(s.name, s.desc, ()=>pveAct(s.id), dis);
  });
  add("Guard", "Take 65% less damage this turn and gain 2 Rage.", ()=>pveAct("guard"), false, "btn-blue");
  add("Focus", "Skip attacking. Your next attack deals double damage.", ()=>pveAct("focus"), b.focus, "btn-blue");
  add(b.lastMove==="counter" ? "Counter (recovering)" : "Counter", "Negate an Attack/Slam and hit back 1.5x. Against Brace/Drain you take +30%. Beware feints! Ends your turn, and can't be used two turns in a row.", ()=>pveAct("counter"), b.lastMove==="counter", "btn-blue");
  const food = bestFood();
  add(food?`Eat ${food.name} (+${food.stats.heal})`:"Eat (no food)", "Heal using food from your inventory. Free action — does NOT end your turn.", ()=>pveAct("eat"), !food, "btn-green");
  add("Flee", "Escape safely — you lose nothing.", pveFlee, false, "btn-yellow");
}
function bestFood(){
  const b = state.battle, missing = state.profile.hpMax - b.php;
  const foods = (state.profile.inventory||[]).filter(e=>e.qty>0).map(e=>ITEM_BY_ID[e.itemId]).filter(i=>i && i.type==="consumable" && i.stats.heal);
  foods.sort((a,c)=>a.stats.heal-c.stats.heal);
  return foods.find(f=>f.stats.heal>=missing) || foods[foods.length-1] || null;
}
async function pveAct(move){
  const b = state.battle; if(!b || b.mode!=="pve" || b.over || b.busy) return;
  b.busy = true;
  const p = state.profile, m = b.m, intent = b.actual, rnd = ()=>0.9+Math.random()*0.2;
  if(move==="counter" && b.lastMove==="counter"){ toast("You can't Counter two turns in a row."); b.busy=false; return; }
  // Eating is a free action: heal and stay on your turn (no enemy response).
  if(move==="eat"){
    const f = bestFood();
    if(f){
      const heal = Math.min(f.stats.heal, p.hpMax-b.php);
      const ok = await changeInvQty(f.id,-1);
      if(ok!==null){ b.php+=heal; battleLogPush(`You eat ${f.name}: +${heal} HP. (free action)`); }
    }
    b.busy=false; renderPve(); return;
  }
  b.lastMove = move;
  const brace = intent==="brace";
  let guard=false, counter=false;
  if(move==="guard"){ guard=true; b.rage=Math.min(p.rageMax,b.rage+2); battleLogPush("You raise your guard."); }
  else if(move==="counter"){ counter=true; battleLogPush("You ready a counter…"); }
  else if(move==="focus"){ b.focus=true; battleLogPush("You focus, gathering strength."); }
  else {
    const s = attackSkillById(move);
    if(s.needsFullRage) b.rage = 0;
    if(s.manaCost) b.mana -= s.manaCost;
    else if(s.id==="basic") b.rage = Math.min(p.rageMax, b.rage+1);
    let d = playerAttackPower()*s.dmgMult()*rnd()*(b.focus?2:1);
    if(brace && s.id!=="precision") d*=0.4;
    d = Math.max(1, Math.round(d)); b.focus = false; b.ehp -= d;
    battleLogPush(`You use ${s.name}: ${d} damage${brace&&s.id!=="precision"?" (braced!)":""}.`);
  }
  if(b.ehp<=0) return pveEnd(true);
  // enemy turn
  if(intent!==b.shown) battleLogPush(`It feinted! It actually used ${INTENTS[intent].label}.`);
  if(intent==="brace") battleLogPush(`${m.name} braces itself.`);
  else {
    const mult = intent==="heavy"?2.2 : intent==="drain"?0.6 : 1;
    if(counter && (intent==="attack"||intent==="heavy")){
      const back = Math.max(1,Math.round(playerAttackPower()*1.5*rnd())); b.ehp-=back;
      battleLogPush(`Countered! ${m.name}'s ${INTENTS[intent].label} is negated and you deal ${back}.`);
    } else {
      let d = m.attack*mult*rnd() - playerDefense()*0.5;
      if(guard) d*=0.35; if(counter) d*=1.3;
      d = Math.max(1, Math.round(d)); b.php -= d; b.rage=Math.min(p.rageMax,b.rage+2);
      battleLogPush(`${m.name} uses ${INTENTS[intent].label}: ${d} damage${guard?" (guarded)":""}.`);
      if(intent==="drain"){ b.ehp=Math.min(m.hp,b.ehp+d); battleLogPush(`${m.name} heals ${d}.`); }
    }
  }
  if(b.ehp<=0) return pveEnd(true);
  if(b.php<=0) return pveEnd(false);
  nextIntent(b); b.busy=false; renderPve();
}
async function pveFlee(){
  const b = state.battle; if(!b || b.mode!=="pve" || b.over) return;
  b.over = true;
  await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { hp:Math.max(1,b.php), mana:b.mana, rage:b.rage }));
  toast("You fled safely — nothing lost.");
  closeModal("battleModal"); state.battle = null;
}
async function pveEnd(won){
  const b = state.battle, m = b.m; b.over = true; renderPve();
  if(won){
    battleLogPush(`Victory! +${m.xpReward} XP, +$${m.moneyReward}.`);
    await grantMoney(m.moneyReward); await grantXP(m.xpReward);
    if(Math.random()<m.dropChance){
      const pool = ITEM_BANK.filter(i=>i.element===m.element && i.type!=="consumable");
      const it = pool[Math.floor(Math.random()*pool.length)];
      if(it){ await addItemToInv(it.id,1); battleLogPush(`It dropped ${it.name}!`); }
    }
    await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { hp:Math.max(1,b.php), mana:b.mana, rage:b.rage, monstersKilled:increment(1) }));
  } else {
    battleLogPush("You were defeated…");
    const r = await applyDeathPenalty({ mana:b.mana });
    toast(`Defeated. Lost $${r.moneyLoss}${r.lostItemName?` and your ${r.lostItemName}`:""}.`);
  }
  setTimeout(()=>{ closeModal("battleModal"); state.battle=null; }, 1800);
}
document.querySelectorAll("[data-pve]").forEach(btn=> btn.addEventListener("click", ()=> startPve(btn.dataset.pve)));

/* --- duel (challenge a friend) --- */
document.getElementById("btnFightFriend").addEventListener("click", renderDuelPanel);
function renderDuelPanel(){
  const panel = document.getElementById("duelPanel");
  panel.innerHTML = `
    <button class="doodle-btn btn-sm btn-blue" id="btnStartRoom">Start a Duel Room</button>
    <div style="margin-top:8px;">
      <input type="text" id="joinCodeInput" maxlength="5" placeholder="5-digit code" style="font-family:'Patrick Hand'; padding:6px; border:2px solid #4A3F35; border-radius:8px;">
      <button class="doodle-btn btn-sm btn-green" id="btnJoinRoom">Join</button>
    </div>
    <div style="margin-top:8px;">
      <button class="doodle-btn btn-sm btn-yellow" id="btnJoinQueue">Join Random Queue</button>
      <button class="doodle-btn btn-sm" id="btnCancelQueue">Leave Queue</button>
      <span id="queueTimerLabel"></span>
    </div>
    <div id="roomStatus" style="margin-top:8px;"></div>`;
  document.getElementById("btnStartRoom").addEventListener("click", startDuelRoom);
  document.getElementById("btnJoinRoom").addEventListener("click", ()=>{
    const code = document.getElementById("joinCodeInput").value.trim();
    joinDuelRoom(code);
  });
  document.getElementById("btnJoinQueue").addEventListener("click", joinQueue);
  document.getElementById("btnCancelQueue").addEventListener("click", cancelQueue);
}
function randCode(){ return String(Math.floor(10000+Math.random()*90000)); }
let roomUnsub=null, queueInterval=null;
async function startDuelRoom(){
  const code = randCode();
  const p = state.profile;
  const ok = await withErrorToast(()=> setDoc(doc(db,"duelRooms",code), {
    hostUid: state.uid, hostName: state.profile.username,
    hostHp: p.hpMax, hostHpMax: p.hpMax, hostMana: p.mana, hostManaMax: p.manaMax,
    guestUid:null, guestName:null, guestHp:null, guestHpMax:null, guestMana:null, guestManaMax:null,
    // Host always goes first. Turn-based: only "turn" may attack; the
    // other side's Attack button is disabled until turn flips (see
    // renderDuelBattle/duelAttack).
    turn: state.uid,
    status:"waiting", winner:null, createdAt: Date.now(), log:[]
  }));
  if(ok===null) return;
  document.getElementById("roomStatus").textContent = `Room code: ${code} — waiting for opponent…`;
  watchDuelRoom(code);
}
async function joinDuelRoom(code){
  if(!/^\d{5}$/.test(code)){ toast("Enter a valid 5-digit code."); return; }
  const rref = doc(db,"duelRooms",code);
  try{
    const snap = await getDoc(rref);
    if(!snap.exists() || snap.data().status!=="waiting"){ toast("Room not found or full."); return; }
    // Joining immediately flips the room to "active" — there is no separate
    // "host clicks start" step, both sides connect live at the same moment.
    await updateDoc(rref, {
      guestUid: state.uid, guestName: state.profile.username,
      guestHp: state.profile.hpMax, guestHpMax: state.profile.hpMax,
      guestMana: state.profile.mana, guestManaMax: state.profile.manaMax,
      status:"active", turn: Math.random()<0.5 ? state.uid : snap.data().hostUid
    });
    document.getElementById("roomStatus").textContent = "Duel starting…";
    watchDuelRoom(code);
  }catch(err){ toast(friendlyFirebaseError(err)); }
}
function watchDuelRoom(code){
  if(roomUnsub) roomUnsub();
  state.duel = { code };
  roomUnsub = onSnapshot(doc(db,"duelRooms",code), snap=>{
    if(!snap.exists()){ const el=document.getElementById("roomStatus"); if(el) el.textContent="Room closed."; return; }
    const d = snap.data();
    if(d.status==="waiting"){
      const el=document.getElementById("roomStatus"); if(el) el.textContent = `Room code: ${code} — waiting for opponent…`;
      return;
    }
    // Whoever is the host flips to "active" the instant a guest doc appears,
    // so both clients enter the live duel together with no manual start.
    // Checked against our battle state (not just the modal's CSS class) so
    // a stale modal-closing animation can't stop the host from joining.
    if(d.status==="active" && d.guestUid && !(state.battle && state.battle.mode==="duel" && state.battle.code===code)){
      openDuelBattle(code, d);
    }
    if(state.battle?.mode==="duel" && state.battle.code===code){
      renderDuelBattle(d);
    }
    if(d.status==="finished" && state.battle?.mode==="duel" && state.battle.code===code && !state.battle.resolved){
      state.battle.resolved = true;
      const won = d.winner===state.uid;
      if(won){
        battleLogPush("You won the duel!");
        toast("Duel won!");
        withErrorToast(()=> updateDoc(doc(db,"players",state.uid), {
          kills:(state.profile.kills||0)+1, killstreak:(state.profile.killstreak||0)+1
        }));
      } else {
        battleLogPush("You were defeated in the duel.");
        // The LOSER'S own client computes and applies the loss (never
        // writes another player's doc), then forwards the exact amount/
        // item to the WINNER's inbox — same pattern as auction payouts —
        // so the winner's subscribeInbox() can credit it to their own doc.
        (d.fledBy===state.uid ? Promise.resolve(null) : applyDeathPenalty()).then((res)=>{
          if(!res){ toast("You fled the duel — nothing lost."); return; }
          const {moneyLoss,lostItemName} = res;
          const lossMsg = lostItemName ? `Lost $${moneyLoss} and your ${lostItemName}.` : `Lost $${moneyLoss}.`;
          toast(`Duel lost. ${lossMsg}`);
          withErrorToast(()=> addDoc(collection(db,"players",d.winner,"inbox"), {
            type:"duel_won", amount: moneyLoss, itemName: lostItemName,
            fromUsername: state.profile.username, ts: Date.now(), credited:false
          }));
        });
      }
      setTimeout(()=>{ closeModal("battleModal"); state.battle=null; if(roomUnsub){roomUnsub(); roomUnsub=null;} }, 1400);
    }
  }, (err)=> toast(friendlyFirebaseError(err)));
}
function openDuelBattle(code, d){
  const iAmHost = d.hostUid===state.uid;
  state.battle = { mode:"duel", code, iAmHost, resolved:false, log:[`${d.hostName} vs ${d.guestName} — fight!`] };
  document.querySelectorAll(".modal-backdrop.active").forEach(m=>m.classList.remove("active"));
  openModal("battleModal");
  renderDuelBattle(d);
}
function renderDuelBattle(d){
  const b = state.battle;
  const iAmHost = b.iAmHost;
  const myHp = iAmHost ? d.hostHp : d.guestHp, myMax = iAmHost ? d.hostHpMax : d.guestHpMax;
  const oppHp = iAmHost ? d.guestHp : d.hostHp, oppMax = iAmHost ? d.guestHpMax : d.hostHpMax;
  document.getElementById("battleEnemyName").textContent = iAmHost ? d.guestName : d.hostName;
  document.getElementById("battleEnemyHPBar").style.width = (100*Math.max(0,oppHp)/oppMax)+"%";
  document.getElementById("battleEnemyHPNum").textContent = `${Math.max(0,oppHp)}/${oppMax}`;
  document.getElementById("battlePlayerName").textContent = state.profile.username;
  document.getElementById("battlePlayerHPBar").style.width = (100*Math.max(0,myHp)/myMax)+"%";
  document.getElementById("battlePlayerHPNum").textContent = `${Math.max(0,myHp)}/${myMax}`;
  const me = iAmHost ? "host" : "guest", pp = state.profile;
  const myFx = d[me+"Fx"]||{}, opFxNow = d[(iAmHost?"guest":"host")+"Fx"]||{};
  document.getElementById("battleStaminaLabel").textContent = `Mana ${d[me+"Mana"] ?? pp.mana}/${pp.manaMax} · One move per turn` + (myFx.focus?" · 🎯 Focused":"") + (myFx.guard?" · 🛡️ Guarding":"") + (myFx.counter?" · ↩️ Countering":"") + (opFxNow.guard?" · Foe guarding":"") + (opFxNow.counter?" · Foe countering":"");
  document.getElementById("battleRageLabel").textContent = `${d[me+"Rage"] ?? pp.rage}/${pp.rageMax}`;
  // The log is stored on the room doc itself (not local state) so both
  // players see the same "who did what" history, attributed by name.
  const logEl = document.getElementById("battleLog");
  logEl.innerHTML = (d.log||[]).slice(-30).map(m=>`<div>${escapeHTML(m)}</div>`).join("");
  logEl.scrollTop = logEl.scrollHeight;
  const actions = document.getElementById("battleActions");
  actions.innerHTML="";
  if(d.status==="finished") return;
  const isMyTurn = d.turn === state.uid;
  const mana = d[me+"Mana"] ?? pp.mana, rage = d[me+"Rage"] ?? pp.rage;
  const addBtn = (id, label, tip, extraDis, cls)=>{
    const el = document.createElement("button");
    el.className = `doodle-btn btn-sm ${cls}`; el.textContent = label; el.title = tip;
    el.disabled = !isMyTurn || myHp<=0 || oppHp<=0 || !!extraDis;
    el.addEventListener("click", ()=> duelAct(d, id)); actions.appendChild(el);
  };
  ATTACK_SKILLS.filter(s=>pp.level>=s.unlockLevel).forEach(s=>
    addBtn(s.id, s.name, s.desc, (s.needsFullRage && rage<pp.rageMax) || (s.manaCost && mana<s.manaCost), "btn-pink"));
  addBtn("guard", "Guard", "Take 65% less from their next hit and gain 2 Rage.", false, "btn-blue");
  addBtn("focus", "Focus", "Your next attack deals double damage.", false, "btn-blue");
  addBtn("counter", "Counter", "If they attack next, negate it and bounce the damage back at them. Ends your turn.", false, "btn-blue");
  const food = duelFood(d[me+"HpMax"] - myHp);
  addBtn("eat", food?`Eat ${food.name} (+${food.stats.heal})`:"Eat (no food)", "Heal with food from your inventory. Free action — does not end your turn.", !food, "btn-green");
  if(!isMyTurn){ const w = document.createElement("span"); w.textContent = "Waiting for opponent…"; actions.appendChild(w); }
  const fleeBtn = document.createElement("button");
  fleeBtn.className = "doodle-btn btn-sm btn-yellow"; fleeBtn.textContent = "Flee";
  fleeBtn.addEventListener("click", ()=> duelFlee(d));
  actions.appendChild(fleeBtn);
}
function duelFood(missing){
  const foods = (state.profile.inventory||[]).filter(e=>e.qty>0).map(e=>ITEM_BY_ID[e.itemId]).filter(i=>i && i.type==="consumable" && i.stats.heal).sort((a,c)=>a.stats.heal-c.stats.heal);
  return foods.find(f=>f.stats.heal>=missing) || foods[foods.length-1] || null;
}
/* Each move can be used once per cycle; once every move has been used the
   list refreshes. Each side stores its own Hp/Mana/Rage/Fx/Used on the room. */
async function duelAct(d, move){
  const b = state.battle; if(!b || b.mode!=="duel" || b.busy) return;
  if(d.turn !== state.uid){ toast("It's not your turn."); return; }
  b.busy = true;   // lock immediately so a fast double-click can't fire a second action off stale room data
  try{ await duelActInner(d, move); } finally { b.busy = false; }
}
async function duelActInner(d, move){
  const b = state.battle;
  const p = state.profile, me = b.iAmHost?"host":"guest", op = b.iAmHost?"guest":"host";
  const myName = p.username, opName = d[op+"Name"], opUid = d[op+"Uid"];
  let myHp = d[me+"Hp"], opHp = d[op+"Hp"], mana = d[me+"Mana"] ?? p.mana, rage = d[me+"Rage"] ?? p.rage;
  const myFx = { ...(d[me+"Fx"]||{}) }, opFx = { ...(d[op+"Fx"]||{}) }, lines = [], rnd = ()=>0.9+Math.random()*0.2;
  let eatId = null;
  if(move==="guard"){ myFx.guard = true; rage = Math.min(p.rageMax, rage+2); lines.push(`${myName} raises their guard.`); }
  else if(move==="counter"){ myFx.counter = true; lines.push(`${myName} readies a counter…`); }
  else if(move==="focus"){ myFx.focus = true; lines.push(`${myName} focuses their strength.`); }
  else if(move==="eat"){
    const f = duelFood(d[me+"HpMax"] - myHp); if(!f){ toast("You have no food."); return; }
    const heal = Math.min(f.stats.heal, d[me+"HpMax"] - myHp); myHp += heal; eatId = f.id;
    lines.push(`${myName} eats ${f.name} (+${heal} HP).`);
  } else {
    const s = attackSkillById(move);
    if((s.needsFullRage && rage<p.rageMax) || (s.manaCost && mana<s.manaCost)){ toast("Not enough Rage/Mana."); return; }
    if(s.needsFullRage) rage = 0; if(s.manaCost) mana -= s.manaCost; else if(s.id==="basic") rage = Math.min(p.rageMax, rage+1);
    let dmg = playerAttackPower()*s.dmgMult()*rnd()*(myFx.focus?2:1); myFx.focus = false;
    if(opFx.counter){ const back = Math.max(1,Math.round(dmg)); myHp -= back; lines.push(`${opName} counters! ${myName}'s ${s.name} is turned back for ${back} damage.`); }
    else { if(opFx.guard) dmg *= 0.35; dmg = Math.max(1,Math.round(dmg)); opHp -= dmg; lines.push(`${myName} uses ${s.name}: ${dmg} damage${opFx.guard?" (guarded)":""}.`); }
  }
  opFx.guard = false; opFx.counter = false;   // their stance lasts one action of mine
  let patch;
  if(move==="eat"){
    // free action: heal only, keep the turn, don't touch stances or the used list
    patch = { [me+"Hp"]:Math.max(0,myHp), log:[...(d.log||[]), ...lines].slice(-60) };
  } else {
    patch = { [me+"Hp"]:Math.max(0,myHp), [op+"Hp"]:Math.max(0,opHp), [me+"Mana"]:mana, [me+"Rage"]:rage,
      [me+"Fx"]:myFx, [op+"Fx"]:opFx, turn:opUid, log:[...(d.log||[]), ...lines].slice(-60) };
    if(opHp<=0 && myHp>0){ patch.status="finished"; patch.winner=state.uid; }
    else if(myHp<=0){ patch.status="finished"; patch.winner=opUid; }
  }
  const ok = await withErrorToast(()=> updateDoc(doc(db,"duelRooms",b.code), patch));
  if(ok!==null && eatId) changeInvQty(eatId, -1);
}
async function duelFlee(d){
  const b = state.battle;
  if(!b || b.mode!=="duel") return;
  const rref = doc(db,"duelRooms",b.code);
  const winner = b.iAmHost ? d.guestUid : d.hostUid;
  const loser = state.uid;
  await withErrorToast(()=> updateDoc(rref, {
    status:"finished", winner, fledBy: state.uid, log: arrayUnion(`${state.profile.username} fled the duel.`)
  }));
}
let queueUnsub=null, queueGuestUnsub=null;
function setQueueUI(on){ document.getElementById("queueFloat").style.display = on?"flex":"none"; }
function leaveQueueListeners(){
  setQueueUI(false);
  clearInterval(queueInterval); queueInterval=null;
  if(queueUnsub){ queueUnsub(); queueUnsub=null; }
  if(queueGuestUnsub){ queueGuestUnsub(); queueGuestUnsub=null; }
}
async function cancelQueue(){
  leaveQueueListeners();
  await withErrorToast(()=> deleteDoc(doc(db,"queue",state.uid)));
  const label = document.getElementById("queueTimerLabel");
  if(label) label.textContent = "";
  toast("Left the queue.");
}
async function joinQueue(){
  leaveQueueListeners();
  toast("Searching for an opponent…");
  let seconds=0;
  queueInterval = setInterval(()=>{
    seconds++;
    const label = document.getElementById("queueTimerLabel");
    if(label) label.textContent = ` ${Math.floor(seconds/60)}m ${seconds%60}s`;
  },1000);
  const ok = await withErrorToast(()=> setDoc(doc(db,"queue",state.uid), {
    username: state.profile.username, hpMax: state.profile.hpMax, joinedAt: Date.now()
  }));
  if(ok===null) return;
  setQueueUI(true);

  // Real matchmaking: watch the whole queue for another waiting player.
  // Whoever has the lexicographically lower uid becomes host and creates
  // the room directly (so both clients can't race to create two rooms).
  queueUnsub = onSnapshot(collection(db,"queue"), async (snap)=>{
    if(!state.profile) return;
    const others = snap.docs.filter(d=> d.id!==state.uid).map(d=>({uid:d.id,...d.data()}));
    if(others.length===0) return;
    others.sort((a,b)=> (a.joinedAt||0)-(b.joinedAt||0));
    const opp = others[0];
    if(state.uid < opp.uid){
      leaveQueueListeners();
      const code = randCode();
      const created = await withErrorToast(()=> setDoc(doc(db,"duelRooms",code), {
        hostUid: state.uid, hostName: state.profile.username,
        hostHp: state.profile.hpMax, hostHpMax: state.profile.hpMax,
        guestUid: opp.uid, guestName: opp.username,
        guestHp: opp.hpMax||100, guestHpMax: opp.hpMax||100,
        status:"active", turn: Math.random()<0.5 ? state.uid : opp.uid, winner:null, createdAt: Date.now(), log:[]
      }));
      if(created===null) return;
      await withErrorToast(()=> deleteDoc(doc(db,"queue",state.uid)));
      const el = document.getElementById("roomStatus"); if(el) el.textContent = "Opponent found!";
      watchDuelRoom(code);
    }
  }, (err)=> toast(friendlyFirebaseError(err)));

  // Watch for a room where someone else matched US as the guest.
  queueGuestUnsub = onSnapshot(
    query(collection(db,"duelRooms"), where("guestUid","==",state.uid), where("status","==","active")),
    (snap)=>{
      if(snap.empty) return;
      const fresh = snap.docs.find(dd=> (Date.now()-(dd.data().createdAt||0)) < 60000);
      if(!fresh) return;
      leaveQueueListeners();
      withErrorToast(()=> deleteDoc(doc(db,"queue",state.uid)));
      const el = document.getElementById("roomStatus"); if(el) el.textContent = "Opponent found!";
      watchDuelRoom(fresh.id);
    }, (err)=> toast(friendlyFirebaseError(err))
  );
}

/* --- playtime, players list, leaderboard cache, pay, recap --- */
function fmtPlaytime(sec){
  sec = Math.floor(sec||0);
  if(sec < 3600) return `${Math.floor(sec/60)}m ${sec%60}s`;
  if(sec < 86400) return `${Math.floor(sec/3600)}h ${Math.floor(sec%3600/60)}m`;
  return `${Math.floor(sec/86400)}d ${Math.floor(sec%86400/3600)}h`;
}
let playersCache = { t:0, rows:[] };
async function loadPlayers(){
  if(Date.now()-playersCache.t < 60000) return playersCache.rows;
  const snap = await getDocs(query(collection(db,"players"), limit(300)));
  playersCache = { t:Date.now(), rows: snap.docs.filter(d=>!d.data().banned && d.id!==state.uid).map(d=>({id:d.id, data:d.data()})) };
  return playersCache.rows;
}
async function renderPlayerList(){
  const list = document.getElementById("playerList"), q = document.getElementById("playerSearch").value.trim().toLowerCase();
  list.innerHTML = "<p class='doodle-sub'>Loading…</p>";
  try{
    const friends = new Set(state.profile.friends||[]);
    const rows = (await loadPlayers()).filter(r=> !q || (r.data.username||"").toLowerCase().includes(q))
      .sort((a,b)=> (friends.has(b.id)-friends.has(a.id)) || (b.data.level||0)-(a.data.level||0));
    list.innerHTML = rows.length ? "" : "<p class='doodle-sub'>No players found.</p>";
    rows.forEach(r=>{
      const d = r.data, el = document.createElement("div");
      el.className = "player-card"; el.style.background = ELEMENTS[d.archetype]?.color || "#FFFDF7";
      el.innerHTML = `<b>${escapeHTML(d.username)}</b><span>Lv.${d.level||1} ${ELEMENTS[d.archetype]?.name||""} ${CLASSES[d.klass]?.name||""}</span>${friends.has(r.id)?"<em>★ Friend</em>":""}`;
      el.addEventListener("click", ()=> openProfileBook(r.id, d, null, null));
      list.appendChild(el);
    });
  }catch(e){ list.innerHTML = "<p class='doodle-sub'>Couldn't load players.</p>"; }
}
document.getElementById("playerSearch").addEventListener("input", ()=>{ clearTimeout(renderPlayerList._t); renderPlayerList._t = setTimeout(renderPlayerList, 200); });
document.querySelector('[data-jtab="players"]').addEventListener("click", renderPlayerList);

async function payPlayer(uid, username, amount){
  amount = Math.floor(amount);
  if(!(amount>0)){ toast("Enter an amount."); return false; }
  if(uid === state.uid){ toast("You can't pay yourself."); return false; }
  try{
    await runTransaction(db, async tx=>{
      const ref = doc(db,"players",state.uid), snap = await tx.get(ref), m = snap.data()?.money||0;
      if(m < amount) throw new Error("nomoney");
      tx.update(ref, { money: m - amount });
    });
  }catch(e){
    toast(e.message==="nomoney" ? "You don't have that much money." : friendlyFirebaseError(e));
    return false;
  }
  const sent = await withErrorToast(()=> addDoc(collection(db,"players",uid,"inbox"), { type:"payment_received", amount, fromUsername: state.profile.username, ts: Date.now(), credited:false }));
  if(sent===null){ await grantMoney(amount); return false; } // refund
  toast(`Paid $${fmtMoney(amount)} to ${username}.`);
  return true;
}
async function showRecap(since){
  if(!since || Date.now()-since < 60000) return;
  let sold=0, soldN=0, paid=0, paidN=0, fr=0, dms=0;
  try{
    const ib = await getDocs(query(collection(db,"players",state.uid,"inbox"), where("ts",">",since)));
    ib.forEach(d=>{ const n=d.data();
      if(n.type==="auction_sold"){ sold+=n.amount||0; soldN++; }
      else if(n.type==="payment_received"){ paid+=n.amount||0; paidN++; }
      else if(n.type==="friend_request") fr++; });
    const uids = [...new Set([...(state.profile.friends||[]), ...Object.keys(state.pmContactsExtra)])];
    const counts = await Promise.all(uids.map(u=> getDocs(query(collection(db,"privateChats",pmThreadId(state.uid,u),"messages"), where("ts",">",since))).then(s=>s.docs.filter(d=>d.data().uid!==state.uid).length).catch(()=>0)));
    dms = counts.reduce((a,b)=>a+b,0);
  }catch(e){ console.error(e); }
  document.getElementById("recapBody").innerHTML = `
    <p class="recap-away">You were away for ${fmtPlaytime((Date.now()-since)/1000)}</p>
    <div class="recap-grid">
      <div><span>🏷️</span><b>$${fmtMoney(sold)}</b><small>earned from the auction (${soldN} sale${soldN===1?"":"s"})</small></div>
      <div><span>💰</span><b>$${fmtMoney(paid)}</b><small>paid to you (${paidN} payment${paidN===1?"":"s"})</small></div>
      <div><span>🤝</span><b>${fr}</b><small>friend request${fr===1?"":"s"}</small></div>
      <div><span>💬</span><b>${dms}</b><small>new private message${dms===1?"":"s"}</small></div>
    </div>`;
  openModal("recapModal");
}
document.getElementById("btnRecapOk").addEventListener("click", ()=> closeModal("recapModal"));
document.querySelectorAll("[data-pay]").forEach(b=> b.addEventListener("click", ()=>{
  const inp = document.getElementById("payAmount");
  inp.value = Math.min(state.profile.money||0, (Number(inp.value)||0) + Number(b.dataset.pay));
}));
document.getElementById("payAmount").addEventListener("input", (e)=>{
  const v = Math.floor(Number(e.target.value)||0);
  e.target.value = v>0 ? Math.min(v, state.profile.money||0) : "";
});

/* =========================================================================
   SETTINGS
   ========================================================================= */
document.getElementById("btnSettings").addEventListener("click", ()=> openModal("settingsModal"));
document.getElementById("muteMusic").addEventListener("change", (e)=>{ state.settings.muteMusic=e.target.checked; if(e.target.checked) musicEl().pause(); else musicEl().play().catch(()=>{}); });
document.getElementById("muteSfx").addEventListener("change", (e)=>{ state.settings.muteSfx=e.target.checked; });

/* =========================================================================
   GLOBAL HOVER/CLICK SFX
   ========================================================================= */
document.addEventListener("mouseover", (e)=>{ if(e.target.closest(".doodle-btn")) playSfx("hover"); });
document.addEventListener("click", (e)=>{ if(e.target.closest(".doodle-btn")) playSfx("click"); });

/* =========================================================================
   BOOT
   ========================================================================= */
/* =========================================================================
   WORLD BOSS — the sleeping dragon (shared, multiplayer) + emoji reactions
   ========================================================================= */
const BOSS_MAX = 1000000000;
const bossRef = ()=> doc(db,"boss","main");
let bossUnsub=null, rxUnsub=null, bossPending=0, bossTimer=null, bossHp=BOSS_MAX, bossResetTimer=null, lastRx=0;
function fmtBig(n){ return Math.max(0,Math.round(n)).toLocaleString(); }
function renderBoss(){
  document.getElementById("bossFill").style.width = (100*Math.max(0,bossHp)/BOSS_MAX)+"%";
  document.getElementById("bossNum").textContent = bossHp<=0 ? "DEFEATED — it stirs again soon…" : `${fmtBig(bossHp)} / ${fmtBig(BOSS_MAX)}`;
}
let bossPoll=null;
async function pollBoss(){
  if(document.hidden) return;
  const s = await getDoc(bossRef()).catch(()=>null);
  if(!s || !s.exists()) return;
  bossHp = s.data().hp - bossPending; renderBoss();
  if(s.data().hp<=0 && !bossResetTimer) bossResetTimer = setTimeout(async ()=>{
    bossResetTimer=null;
    await runTransaction(db, async tx=>{ const c=await tx.get(bossRef()); if(c.data().hp<=0) tx.update(bossRef(),{hp:BOSS_MAX}); }).catch(()=>{});
  }, 6000);
}
async function initBoss(){
  bossCleanup();
  const snap = await getDoc(bossRef()).catch(()=>null);
  if(snap && !snap.exists()) await setDoc(bossRef(), { hp:BOSS_MAX, hpMax:BOSS_MAX }).catch(()=>{});
  pollBoss(); bossPoll = setInterval(pollBoss, 5000);   // live bar refreshes every 5s (was a live listener)
  rxUnsub = onSnapshot(query(collection(db,"reactions"), where("ts",">",Date.now()-3000)), snap=>{
    snap.docChanges().forEach(c=>{ if(c.type==="added" && Date.now()-c.doc.data().ts < 4000) spawnReaction(c.doc.data()); });
  }, ()=>{});
}
function bossCleanup(){
  if(bossPoll){ clearInterval(bossPoll); bossPoll=null; }
  if(rxUnsub){ rxUnsub(); rxUnsub=null; }
  if(bossTimer){ clearTimeout(bossTimer); bossTimer=null; }
}
async function flushBoss(){
  bossTimer = null;
  const dmg = bossPending; bossPending = 0; if(!dmg) return;
  await withErrorToast(()=> runTransaction(db, async tx=>{
    const s = await tx.get(bossRef()); const hp = s.data().hp; if(hp<=0) return;
    tx.update(bossRef(), { hp: Math.max(0, hp-dmg) });
  }));
  updateDoc(doc(db,"players",state.uid), { bossDamage: increment(dmg) }).catch(()=>{});
}
document.getElementById("bossDragon").addEventListener("click", (e)=>{
  if(!state.profile) return;
  if(bossHp<=0){ toast("The dragon has fallen! It will stir again soon."); return; }
  const dmg = Math.max(1, Math.round(playerAttackPower()));
  bossPending += dmg; bossHp -= dmg; renderBoss();
  const svg = e.currentTarget; svg.classList.remove("hit"); void svg.getBoundingClientRect(); svg.classList.add("hit");
  const n = document.createElement("div"); n.className="dmg-pop"; n.textContent = "-"+fmtBig(dmg);
  const r = document.getElementById("gameStage").getBoundingClientRect();
  n.style.left = (e.clientX-r.left)+"px"; n.style.top = (e.clientY-r.top)+"px";
  document.getElementById("reactionLayer").appendChild(n); setTimeout(()=>n.remove(), 900);
  playSfx("attack");
  if(!bossTimer) bossTimer = setTimeout(flushBoss, 3000);
});
const RX_EMOJI = ["❤️","⚔️","🔥","😭"];
document.querySelectorAll("[data-rx]").forEach(btn=> btn.addEventListener("click", async ()=>{
  if(!state.profile || !RX_EMOJI.includes(btn.dataset.rx) || Date.now()-lastRx < 3000) return;
  lastRx = Date.now();
  const all = document.querySelectorAll("[data-rx]"); all.forEach(b=>b.disabled=true); setTimeout(()=>all.forEach(b=>b.disabled=false), 3000);
  const ref = await withErrorToast(()=> addDoc(collection(db,"reactions"), { uid:state.uid, username:state.profile.username, emoji:btn.dataset.rx, ts:Date.now() }));
  if(ref) setTimeout(()=> deleteDoc(ref).catch(()=>{}), 6000);
}));
function spawnReaction(r){
  const el = document.createElement("div"); el.className = "rx-bubble";
  const e = document.createElement("span"); e.className="rx-emoji"; e.textContent = r.emoji;
  const u = document.createElement("span"); u.className="rx-name"; u.textContent = r.username;
  el.append(e,u); el.style.left = (15+Math.random()*70)+"%";
  document.getElementById("reactionLayer").appendChild(el); setTimeout(()=>el.remove(), 2200);
}
window.addEventListener("pagehide", ()=>{ if(bossPending) flushBoss(); });
document.getElementById("btnLeaveQueue").addEventListener("click", cancelQueue);

setupDragonAnim();
setTimeout(()=>{ showScreen("screen-title"); document.getElementById("screen-loading").classList.remove("active"); }, 900);
