/* =========================================================================
   DRAGONEER — rpg_dungeon.js
   Pure dungeon rules (no Firebase / no DOM): floor odds, rarity odds,
   monster scaling, door outcomes, countdown formatting.
   ========================================================================= */
export const DG_TRACK = "rpg_dungeon.mp3";
export const DG_COOLDOWN_MS = 24*60*60*1000;      // the door re-opens 24h after you leave
export const DG_LOCKED_TABS = ["map","jobs","shop","farm","duel"];
export const DG_SKIP_PRICE = 100;
/* Cash per kill follows the same tiers as the open world (bosses pay triple). */
export const DG_MONEY = { easy:[1,15], medium:[5,40], hard:[10,75] };
const rndRange = ([lo,hi], rnd)=> lo + Math.floor(rnd()*(hi-lo+1));
export const isCheckpoint = f => f % 5 === 0;     // 0, 5, 10, 15 ... (0 is the entrance)

const pickWeighted = (w, rnd)=>{
  const keys = Object.keys(w).filter(k=>w[k]>0); let t = keys.reduce((a,k)=>a+w[k],0)*rnd();
  for(const k of keys){ t -= w[k]; if(t<=0) return k; }
  return keys[keys.length-1];
};
/* Wave rooms are rare: only ONE floor in every block of 5 (never the checkpoint) is allowed to roll a wave,
   and which floor that is changes from block to block (but is the same for everyone).
   Every other room type is equally likely on every floor — depth only makes enemies and loot better. */
export const waveFloor = block => 5*block + 1 + (Math.imul(block+1, 2654435761)>>>0)%4;   // one of 5b+1 .. 5b+4
export const canWave = f => f>0 && f%5!==0 && f===waveFloor(Math.floor(f/5));
export function eventWeights(f){
  return { nothing:1, chest:1, shop:1, doors:1, battle:1, waves: canWave(f) ? 1 : 0, boss:1 };
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

/* kind: "normal" | "boss" | "wave". Bosses: much more HP, lower damage. Wave units: a bit weaker. */
export function buildMonster(f, kind, playerLevel, rnd=Math.random){
  const lvl = Math.max(1, Math.round((playerLevel||1)*0.7 + f*1.4));
  const creep = 1 + f*0.03;
  const hpM = kind==="boss" ? 3 : kind==="wave" ? 0.7 : 1, atkM = kind==="boss" ? 0.6 : kind==="wave" ? 0.85 : 1;
  const rewM = kind==="boss" ? 4 : 1;
  const names = kind==="boss" ? BOSS_NAMES : NORMAL_NAMES, name = names[Math.floor(rnd()*names.length)];
  const difficulty = kind==="boss" ? "hard" : kind==="wave" ? "easy" : (f<10 ? "easy" : f<25 ? "medium" : "hard");
  return {
    id:"dg_"+name.toLowerCase().replace(/\W+/g,""), name, region:"dungeon", difficulty, level:lvl, element:"earth",
    sprite: kind==="boss" ? "👁️" : (SPRITES[name]||"💀"),
    hp: Math.round((20+lvl*8)*creep*hpM), attack: Math.max(1, Math.round((3+lvl*1.5)*creep*atkM)),
    xpReward: Math.round((6+lvl*0.8)*rewM), moneyReward: Math.round(rndRange(DG_MONEY[difficulty], rnd)*(kind==="boss" ? 3 : 1)), dropChance:0
  };
}
export const waveSize = (f, rnd=Math.random)=> 2 + Math.floor(rnd()*3) + Math.floor(f/15);   // 2-4, +1 per 15 floors
export function doorOutcome(rnd=Math.random){ const r = rnd(); return r<1/3 ? "safe" : r<2/3 ? "spike" : "pickpocket"; }
export const doorPct = (rnd=Math.random)=> 0.10 + rnd()*0.15;                                   // 10-25%
export function fmtCountdown(ms){
  const s = Math.max(0, Math.ceil(ms/1000)), h = Math.floor(s/3600), m = Math.floor(s%3600/60);
  return `${h}h ${m}m ${s%60}s`;
}
