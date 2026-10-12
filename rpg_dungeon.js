/* =========================================================================
   DRAGONEER — rpg_dungeon.js
   Pure dungeon rules (no Firebase / no DOM): floor odds, rarity odds,
   monster scaling, door outcomes, countdown formatting.
   ========================================================================= */
export const DG_TRACK = "rpg_dungeon.mp3";
export const DG_COOLDOWN_MS = 24*60*60*1000;      // the door re-opens 24h after you leave
export const DG_LOCKED_TABS = ["map","jobs","shop","farm","duel"];
export const DG_SKIP_PRICE = 100;
export const DG_REWARD_MULT = 0.5;                // nerfed: dungeon monsters now pay only half of their default XP and money (they used to pay 2x)
export const DG_MONEY_MULT = 1;                   // extra money multiplier on top of DG_REWARD_MULT (was 2): money is now 0.5x default in total
/* Boss-rush style scaling: every dungeon enemy has MORE HP than you. hp = your max HP x (base roll + 1 per floor). */
export const DG_HP_BASE  = { normal:[2,8], wave:[2,5], boss:[12,20] };   // base HP multiplier range of your max HP, rolled per monster
export const DG_HP_PER_FLOOR = 1;                 // +1x your max HP for every floor deeper
export const DG_DMG_BASE = { normal:1, wave:0.75, boss:1.5 };            // damage multiplier, same idea as the boss rush
export const DG_DMG_PER_FLOOR = 0.03;             // +3% damage per floor
export const DG_BASE_HIT_DIV = 4;                 // base hit = your max HP / 4 (same as the boss rush)
export const isCheckpoint = f => f % 10 === 0;    // 0, 10, 20, 30 ... (0 is the entrance) — escape door every 10 floors

const pickWeighted = (w, rnd)=>{
  const keys = Object.keys(w).filter(k=>w[k]>0); let t = keys.reduce((a,k)=>a+w[k],0)*rnd();
  for(const k of keys){ t -= w[k]; if(t<=0) return k; }
  return keys[keys.length-1];
};
/* Odds of each room type on floor f. Easy rooms fade out, hard rooms grow with depth. */
export function eventWeights(f){
  const t = Math.min(1, f/40);
  return {
    nothing: 2 + 10*(1-t),
    chest:   20 - 6*t,
    shop:    7,
    doors:   12 - 4*t,
    battle:  32 + 16*t,          // monsters show up far more often than before
    waves:   f<3 ? 0 : 12 + 14*t,
    boss:    f<4 ? 0 : 4 + 10*t
  };
}
export const rollEventType = (f, rnd=Math.random)=> pickWeighted(eventWeights(f), rnd);

/* Loot rarity by floor: commons fade, epics/legendaries creep in. */
export function rarityWeights(f){
  const t = Math.min(1, f/60);
  return { common:60-52*t, uncommon:28-8*t, rare:9+22*t, epic:2.5+22*t, legendary:0.5+16*t };
}
export const rollRarity = (f, rnd=Math.random)=> pickWeighted(rarityWeights(f), rnd);

export const NORMAL_NAMES = ["Skeleton","Cave Bat","Wraith","Giant Spider","Ghoul","Dire Rat","Shade","Mimic Imp","Bone Hound","Crypt Slime"];
export const BOSS_NAMES   = ["Crypt Warden","Bone Tyrant","The Hollow King","Gloom Colossus","Candle Eater"];
const SPRITES = { Skeleton:"💀","Cave Bat":"🦇",Wraith:"👻","Giant Spider":"🕷️",Ghoul:"🧟","Dire Rat":"🐀",Shade:"👤","Mimic Imp":"👹","Bone Hound":"🐕‍🦺","Crypt Slime":"🟢" };

/* Turns a monster's stored multipliers into real stats from the player's CURRENT max HP (never below max HP + 1). */
export const monsterHp  = (hpX, playerHpMax)=> Math.max(Math.round(playerHpMax*hpX), playerHpMax+1);
export const monsterAtk = (atkX, playerHpMax)=> Math.max(1, Math.round(playerHpMax/DG_BASE_HIT_DIV*atkX));
export const scaleMonster = (m, playerHpMax)=> { const php = Math.max(1, playerHpMax||1); return { ...m, hp:monsterHp(m.hpX ?? 4, php), attack:monsterAtk(m.atkX ?? 1, php) }; };

/* kind: "normal" | "boss" | "wave". HP and damage scale off the PLAYER's max HP (see DG_* constants above). */
export function buildMonster(f, kind, playerLevel, playerHpMax=100, rnd=Math.random){
  const lvl = Math.max(1, Math.round((playerLevel||1)*0.7 + f*1.4));
  const [lo,hi] = DG_HP_BASE[kind] || DG_HP_BASE.normal;
  const hpX = lo + rnd()*(hi-lo) + f*DG_HP_PER_FLOOR, atkX = (DG_DMG_BASE[kind] ?? 1) * (1 + f*DG_DMG_PER_FLOOR);
  const rewM = kind==="boss" ? 4 : 1;
  const names = kind==="boss" ? BOSS_NAMES : NORMAL_NAMES, name = names[Math.floor(rnd()*names.length)];
  const difficulty = kind==="boss" ? "hard" : kind==="wave" ? "easy" : (f<10 ? "easy" : f<25 ? "medium" : "hard");
  return {
    id:"dg_"+name.toLowerCase().replace(/\W+/g,""), name, region:"dungeon", difficulty, level:lvl, element:"earth",
    sprite: kind==="boss" ? "👁️" : (SPRITES[name]||"💀"),
    hpX, atkX, hp: monsterHp(hpX, playerHpMax), attack: monsterAtk(atkX, playerHpMax),
    xpReward: Math.round((6+lvl*0.8)*rewM*DG_REWARD_MULT), moneyReward: Math.round((8+lvl*1.2+f)*rewM*DG_REWARD_MULT*DG_MONEY_MULT), dropChance:0
  };
}
export const waveSize = (f, rnd=Math.random)=> 2 + Math.floor(rnd()*3) + Math.floor(f/15);   // 2-4, +1 per 15 floors
export function doorOutcome(rnd=Math.random){ const r = rnd(); return r<1/3 ? "safe" : r<2/3 ? "spike" : "pickpocket"; }
export const doorPct = (rnd=Math.random)=> 0.10 + rnd()*0.15;                                   // 10-25%
export function fmtCountdown(ms){
  const s = Math.max(0, Math.ceil(ms/1000)), h = Math.floor(s/3600), m = Math.floor(s%3600/60);
  return `${h}h ${m}m ${s%60}s`;
}
