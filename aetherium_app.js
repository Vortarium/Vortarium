/* ============================================================
   AETHERIUM — Infinite Frontier
   A procedurally generated galaxy with hard-surface planets,
   gravity, on-foot exploration, farming, fishing, crafting,
   crew, civilisations, and an empire to build on top of it.
   ============================================================ */
(function () {
'use strict';

/* ------------------------------------------------------------
   1. MATH + UTILITIES
------------------------------------------------------------ */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

function hash2(x, y, s) {
  /* has to avalanche properly for small grid coordinates, or whole
     star systems and terrain tiles end up duplicated across the map */
  let h = (s >>> 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ ((x | 0) + 0x7f4a7c15), 0x85ebca6b);
  h = (h << 13) | (h >>> 19);
  h = Math.imul(h ^ ((y | 0) + 0x165667b1), 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x27d4eb2f); h ^= h >>> 13;
  h = Math.imul(h, 0x85ebca6b); h ^= h >>> 16;
  return h >>> 0;
}
function hash3(x, y, z, s) { return hash2(hash2(x, y, s), z, s ^ 0x9e37); }
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.min(arr.length - 1, Math.floor(r() * arr.length))];
const rr = (r, a, b) => a + r() * (b - a);
const ri = (r, a, b) => Math.floor(a + r() * (b - a + 0.999));
function shuffle(r, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

/* value noise for terrain, weather fronts and lakes */
function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const a = hash2(xi, yi, seed) / 4294967296;
  const b = hash2(xi + 1, yi, seed) / 4294967296;
  const c = hash2(xi, yi + 1, seed) / 4294967296;
  const d = hash2(xi + 1, yi + 1, seed) / 4294967296;
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, seed, oct) {
  let v = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < (oct || 3); i++) { v += vnoise(x * f, y * f, seed + i * 77) * amp; norm += amp; amp *= 0.5; f *= 2; }
  return v / norm;
}

function fmt(n) {
  n = Math.floor(n);
  const neg = n < 0; n = Math.abs(n);
  let s;
  if (n >= 1e15) s = (n / 1e15).toFixed(2) + 'Qa';
  else if (n >= 1e12) s = (n / 1e12).toFixed(2) + 'T';
  else if (n >= 1e9) s = (n / 1e9).toFixed(2) + 'B';
  else if (n >= 1e6) s = (n / 1e6).toFixed(2) + 'M';
  else if (n >= 1e4) s = (n / 1e3).toFixed(1) + 'K';
  else s = n.toLocaleString();
  return (neg ? '-' : '') + s;
}
const fmtN = n => Math.floor(n).toLocaleString();
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ------------------------------------------------------------
   2. AUDIO
   Drop these eight files next to index.html and they wire up on
   their own. Missing files are detected and silently skipped.
------------------------------------------------------------ */
/* Every file this game loads shares one prefix. Change this single string
   and every audio path follows it — nothing else needs touching. */
const ASSET_PREFIX = 'aetherium_';
const sfxFile = name => ASSET_PREFIX + name + '.mp3';

const SOUNDS = {
  music:   { file: sfxFile('music'),   loop: true,  vol: 0.55 },
  break:   { file: sfxFile('break'),   rate: [0.72, 1.45], vol: 0.6 },
  chirp:   { file: sfxFile('chirp'),   rate: [0.8, 1.7],   vol: 0.5 },
  buy:     { file: sfxFile('buy'),     rate: [0.96, 1.06], vol: 0.65 },
  lose:    { file: sfxFile('lose'),    rate: [0.95, 1.02], vol: 0.8 },
  upgrade: { file: sfxFile('upgrade'), rate: [0.94, 1.1],  vol: 0.7 },
  attack:  { file: sfxFile('attack'),  rate: [0.78, 1.35], vol: 0.6 },
  shoot:   { file: sfxFile('shoot'),   rate: [0.85, 1.28], vol: 0.45 }
};
const AU = {
  ok: typeof Audio !== 'undefined',
  pools: {}, music: null, musicOn: false, missing: {},
  init() {
    if (!this.ok) return;
    for (const k in SOUNDS) {
      const def = SOUNDS[k];
      if (def.loop) {
        try {
          const a = new Audio(def.file);
          a.loop = true; a.preload = 'auto';
          a.addEventListener('error', () => { this.missing[k] = true; });
          this.music = a;
        } catch (e) { this.missing[k] = true; }
        continue;
      }
      const pool = [];
      for (let i = 0; i < 5; i++) {
        try {
          const a = new Audio(def.file);
          a.preload = 'auto';
          a.addEventListener('error', () => { this.missing[k] = true; });
          pool.push(a);
        } catch (e) { this.missing[k] = true; }
      }
      this.pools[k] = { list: pool, i: 0 };
    }
  },
  play(k, volScale) {
    if (!this.ok || this.missing[k] || !G.set.sfx) return;
    const p = this.pools[k], def = SOUNDS[k];
    if (!p || !p.list.length) return;
    const a = p.list[p.i]; p.i = (p.i + 1) % p.list.length;
    try {
      a.currentTime = 0;
      const pitch = def.rate ? rr(Math.random, def.rate[0], def.rate[1]) : 1;
      a.playbackRate = 1;
      try { a.preservesPitch = false; } catch(e) {}
      const baseFreq = a.mozPreservesPitch !== undefined ? 1 : 1;
      a.playbackRate = pitch;
      a.volume = clamp((def.vol || 0.6) * (volScale === undefined ? 1 : volScale) * G.set.sfxVol * G.set.master, 0, 1);
      const pr = a.play();
      if (pr && pr.catch) pr.catch(() => {});
    } catch (e) {}
  },
  startMusic() {
    if (!this.ok || !this.music || this.missing.music || !G.set.music) return;
    try {
      this.music.loop = true;
      this.music.volume = clamp(SOUNDS.music.vol * G.set.musicVol * G.set.master, 0, 1);
      const p = this.music.play();
      if (p && p.catch) p.catch(() => { this.musicOn = false; this.armGesture(); });
      this.musicOn = true;
    } catch (e) { this.armGesture(); }
  },
  /* Browsers refuse to start audio until the page has been interacted
     with. Try immediately anyway, and if it is blocked, latch onto the
     first click, key or touch and start there instead. */
  armGesture() {
    if (this.armed) return;
    this.armed = true;
    const go = () => {
      this.armed = false;
      ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.removeEventListener(ev, go, true));
      if (G.set.music) this.startMusic();
    };
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, go, true));
  },
  /* loop = true covers the normal case; these catch a stall or a tab that
     was backgrounded long enough for the element to give up */
  watchMusic() {
    if (!this.music) return;
    const a = this.music;
    a.addEventListener('ended', () => { if (G.set.music) { try { a.currentTime = 0; a.play(); } catch (e) {} } });
    a.addEventListener('pause', () => {
      if (!G.set.music || !this.musicOn) return;
      setTimeout(() => { if (G.set.music && this.musicOn && a.paused) { try { a.play(); } catch (e) {} } }, 400);
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && G.set.music && this.musicOn && a.paused) { try { a.play(); } catch (e) {} }
    });
    setInterval(() => {
      if (G.set.music && this.musicOn && a.paused && !this.missing.music) { try { a.play(); } catch (e) {} }
    }, 5000);
  },
  stopMusic() { if (this.music) { try { this.music.pause(); } catch (e) {} } this.musicOn = false; },
  sync() {
    if (!this.music) return;
    try { this.music.volume = clamp(SOUNDS.music.vol * G.set.musicVol * G.set.master, 0, 1); } catch (e) {}
    if (G.set.music && !this.musicOn) this.startMusic();
    if (!G.set.music && this.musicOn) this.stopMusic();
  }
};

/* ------------------------------------------------------------
   3. NAME BANKS
------------------------------------------------------------ */
const NB = {
  s1: ['ze','kor','vel','xan','tha','ny','ori','dra','lu','py','ae','sol','mir','oct','rhe','va','ix','cyg','del','oth',
       'ban','kre','sur','ith','ven','jor','tal','esh','quo','nyx','hel','sab','var','zir','mok','ael','dun','fyr','gla','hes',
       'ilu','jyn','kae','lorn','myr','nev','oss','pra','rua','syl','tor','umb','vex','wyr','xil','yor','zan','aur','bel','cir'],
  s2: ['ra','tor','vex','lia','mos','nar','dor','sis','kai','lun','vyn','tas','rix','eon','gar','pha','tul','mera','zon','dris',
       'vala','quor','nemi','xara','lith','bane','core','delve','frost','hollow','mire','plume','reach','sund','thorn','wane',
       'aris','beth','cyra','dova','elun','fira','goss','hyra','ixen','jula','kosk','lyre','mund','noct','opal','quen',
       'ryth','soma','tarn','ulla','vesp','wend','xyla','yorn','zeph','arcus','brume','cinder','dross','ember','fathom'],
  s3: ['ix','ar','on','us','eth','ia','or','yn','ax','um','is','el','ae','oth','ur','ys','an','ek','il','os',
       'esh','ith','ond','arn','uul','ymn','ost','ael','irn','ux'],
  suffix: ['Prime','II','III','IV','V','VI','IX','XII','XV','Major','Minor','Anomaly','Reach','Rest','Deep','Verge','Gate',
           'Hollow','Expanse','Drift','Cradle','Spire','Terminus','Threshold','Watch','Shroud','Halo','Basin','Rift','Crown'],
  greek: ['Alpha','Beta','Gamma','Delta','Epsilon','Zeta','Eta','Theta','Iota','Kappa','Lambda','Mu','Nu','Xi','Omicron',
          'Pi','Rho','Sigma','Tau','Upsilon','Phi','Chi','Psi','Omega'],
  adj: ['Cold','Broken','Gilded','Silent','Hollow','Burning','Drowned','Iron','Glass','Amber','Violet','Endless','Patient',
        'Quiet','Sunken','Vast','Pale','Ashen','Emerald','Crimson','Forgotten','Singing','Sleeping','Wandering','Bitter',
        'Hungry','Narrow','Salt','Winter','Tilted','Second','Blind','Low','Far','Nameless','Weeping','Rusted','Bright','Grey'],
  noun: ['Gate','Throne','Well','Anchor','Furnace','Harbour','Garden','Lantern','Mirror','Orchard','Pillar','Quarry',
         'Refuge','Signal','Tide','Vault','Wake','Yoke','Bastion','Cairn','Ember','Foundry','Grove','Hollow',
         'Ladder','Meridian','Needle','Oath','Prospect','Reckoning','Shoal','Tally','Undertow','Verdict','Watchfire','Ziggurat'],
  /* people */
  fn: ['Vashti','Hulon','Marabel','Iridia','Ashkaar','Sable','Ossa','Cerrivane','Hadal','Sylvane','Tamsin','Orrin','Bex',
       'Juno','Kesh','Lyra','Mordo','Nadia','Oleg','Priya','Quill','Rhen','Sipho','Tove','Ulla','Vero','Wren','Xio','Yusuf',
       'Zadie','Aleph','Brix','Calla','Doru','Enne','Farrow','Gita','Hess','Ives','Jory','Kaida','Loew','Mika','Nils',
       'Odalys','Pell','Ruan','Senna','Tobi','Umi','Vane','Wim','Yara','Zephyr','Corin','Dax','Elke','Fen','Gunnar','Halla',
       'Ilse','Jem','Kwame','Linnea','Mattis','Noor','Oisin','Perrin','Qadira','Rina','Sten','Thea','Ubo','Vida','Wyn','Xan',
       'Yael','Zia','Ansel','Bede','Cato','Dilla','Esme','Frey','Goran','Hedda','Imre','Jarl','Kira','Lior','Mose','Nell'],
  ln: ['Orlan','Scree','Vaan','Merovin','Quorum','Tek','Halden','Vord','Ashby','Corvid','Delacour','Estrada','Fallow',
       'Grimm','Hale','Ingram','Jarssen','Kovac','Lund','Mbeki','Nakamura','Okonkwo','Petrov','Quist','Rask','Sorrel',
       'Thibault','Ulve','Varga','Whitlock','Yusov','Zann','Brightwater','Caldera','Dunmore','Eastmere','Fairweather',
       'Gallow','Hearne','Iyer','Jansz','Kettle','Larkspur','Moro','Nyland','Oduya','Pike','Quennell','Ravel','Strand',
       'Tiller','Ussher','Vance','Wexley','Ynge','Zoric','Ashgrove','Bellweather','Coldharbour','Danforth','Emberly'],
  /* settlements */
  settle1: ['Port','Camp','Landing','Hold','Station','Waystop','Refuge','Outpost','Colony','Anchorage','Terrace','Basin',
            'Depot','Crossing','Halt','Quarter','Reach','Steading','Wharf','Yard','Post','Kiln','Mill','Span'],
  /* creatures */
  cr1: ['Grazing','Hunting','Burrowing','Drifting','Screaming','Silent','Armoured','Translucent','Six-legged','Winged',
        'Crystalline','Blind','Horned','Bristled','Luminous','Spiny','Tusked','Feathered','Molten','Frostbitten','Gaunt',
        'Bloated','Coiled','Stilted','Shrouded','Whiskered','Plated','Ribboned','Cavernous','Nimble'],
  cr2: ['crawler','strider','lurker','glider','browser','hopper','warden','grub','stalker','drifter','skimmer','husk',
        'grazer','burrower','shrike','maw','wisp','hulk','chitterer','prowler','trundler','leaper','sifter','digger',
        'basker','screecher','wallower','clinger','nomad','sentinel'],
  /* ships */
  sh1: ['Long','Far','Deep','Slow','Bright','Last','First','Quiet','Bold','Lucky','Patient','Crooked','Honest','Hungry',
        'Second','Wayward','Steady','Idle','Grateful','Reluctant','Certain','Borrowed','Untitled','Late'],
  sh2: ['Runner','Wake','Passage','Lantern','Promise','Errand','Ledger','Harvest','Compass','Vigil','Wager','Margin','Rook',
        'Recourse','Tender','Bargain','Reply','Inheritance','Detour','Alibi','Remainder','Draught','Pretext']
};
/* extra banks so a galaxy this size does not repeat itself */
NB.s0 = ['a','be','ca','dre','e','fe','gi','ha','i','jo','ka','li','mo','na','o','pe','qu','ra','se','ta','u','ve','wo','xe','yl','zu',
         'bra','cre','dhu','esk','fal','gro','hel','iso','jar','kul','lom','nyr','obe','pyx','riv','sor','tul','umb','vor','wyn'];
NB.s4 = ['ne','ta','ri','vo','la','mir','sek','dra','pho','ulu','ceti','majo','minu','nova','pyra','thes','vela','zora','ilex','korr'];
NB.cat = ['NX','KV','HD','GL','SR','TR','VX','ZC','PH','OM','AR','BK'];
NB.honor = ['of the Deep','of Nine Winters','the Younger','the Lost','Remembered','Unlooked-for','in Absentia','Ascendant',
            'of the Long Wake','Reclaimed','the Patient','Unnumbered','of Broken Light','the Second'];

function pname(r) {
  const roll = r();
  let s;
  if (roll < 0.10) {
    /* catalogue designation */
    s = pick(r, NB.cat) + '-' + (100 + Math.floor(r() * 8900));
  } else if (roll < 0.20) {
    s = cap1(pick(r, NB.s0) + pick(r, NB.s1) + pick(r, NB.s3));
  } else if (roll < 0.34) {
    s = cap1(pick(r, NB.s1) + pick(r, NB.s4) + pick(r, NB.s2));
  } else {
    s = cap1(pick(r, NB.s1) + pick(r, NB.s2));
    if (r() < 0.55) s += pick(r, NB.s3);
  }
  const tail = r();
  if (tail < 0.22) s += ' ' + pick(r, NB.suffix);
  else if (tail < 0.30) s += ' ' + pick(r, NB.greek);
  else if (tail < 0.36) s += ' ' + (2 + Math.floor(r() * 97));
  return s;
}
function sysName(r) {
  const roll = r();
  if (roll < 0.14) return pick(r, NB.greek) + ' ' + cap1(pick(r, NB.s1) + pick(r, NB.s2) + (r() < 0.4 ? pick(r, NB.s3) : ''));
  if (roll < 0.26) return 'The ' + pick(r, NB.adj) + ' ' + pick(r, NB.noun);
  if (roll < 0.33) return pick(r, NB.adj) + '\u2019s ' + pick(r, NB.noun);
  if (roll < 0.39) return cap1(pick(r, NB.s0) + pick(r, NB.s2)) + ' ' + pick(r, NB.honor);
  return pname(r);
}
function personName(r) {
  const f = pick(r, NB.fn), l = pick(r, NB.ln);
  const roll = r();
  if (roll < 0.10) return f + ' ' + pick(r, NB.s1).toUpperCase().charAt(0) + '. ' + l;
  if (roll < 0.18) return f + '-' + cap1(pick(r, NB.s2));
  if (roll < 0.24) return f + ' ' + l + '-' + cap1(pick(r, NB.s3));
  return f + ' ' + l;
}
function settleName(r) {
  const roll = r();
  if (roll < 0.34) return pick(r, NB.settle1) + ' ' + cap1(pick(r, NB.s1) + pick(r, NB.s3));
  if (roll < 0.58) return pick(r, NB.adj) + ' ' + pick(r, NB.noun);
  if (roll < 0.76) return cap1(pick(r, NB.s1) + pick(r, NB.s2)) + ' ' + pick(r, NB.settle1);
  return pick(r, NB.settle1) + ' ' + (2 + Math.floor(r() * 88));
}
function shipName(r) {
  const roll = r();
  if (roll < 0.66) return 'The ' + pick(r, NB.sh1) + ' ' + pick(r, NB.sh2);
  if (roll < 0.84) return cap1(pick(r, NB.s1) + pick(r, NB.s2)) + '\u2019s ' + pick(r, NB.sh2);
  return 'The ' + pick(r, NB.adj) + ' ' + pick(r, NB.sh2);
}
function creatureName(r) {
  const roll = r();
  if (roll < 0.74) return pick(r, NB.cr1) + ' ' + pick(r, NB.cr2);
  return pick(r, NB.cr1) + ' ' + cap1(pick(r, NB.s1)) + '-' + pick(r, NB.cr2);
}

/* ------------------------------------------------------------
   4. MATERIALS
   Every item in the game lives in one table. Alloys are generated
   at runtime and merged in, so the real material count is the
   base list plus every pair you have ever forged.
------------------------------------------------------------ */
const MAT = {
  /* ores */
  ferrite:   { n: 'Ferrite Dust',  v: 14,   c: '#b9c7d6', t: 1, cat: 'ore' },
  carbon:    { n: 'Carbon',        v: 11,   c: '#7f8d9c', t: 1, cat: 'ore' },
  silicate:  { n: 'Silicate',      v: 19,   c: '#ffe6a8', t: 1, cat: 'ore' },
  magnetite: { n: 'Magnetite',     v: 31,   c: '#8a94a4', t: 1, cat: 'ore' },
  copper:    { n: 'Copper',        v: 58,   c: '#ff9f5f', t: 2, cat: 'ore' },
  nickel:    { n: 'Nickel',        v: 66,   c: '#cdd6df', t: 2, cat: 'ore' },
  cobalt:    { n: 'Cobalt',        v: 74,   c: '#7f9cff', t: 2, cat: 'ore' },
  titanium:  { n: 'Titanium',      v: 118,  c: '#d7e2ea', t: 3, cat: 'ore' },
  platinum:  { n: 'Platinum',      v: 152,  c: '#e8f4ff', t: 3, cat: 'ore' },
  aurum:     { n: 'Aurum',         v: 240,  c: '#ffd97a', t: 3, cat: 'ore' },
  iridium:   { n: 'Iridium',       v: 395,  c: '#c9d8ff', t: 4, cat: 'ore' },
  uranite:   { n: 'Uranite',       v: 520,  c: '#c8ff6b', t: 4, cat: 'ore' },
  lithium:   { n: 'Lithium',       v: 95,   c: '#ff6fb4', t: 2, cat: 'ore' },
  beryllium: { n: 'Beryllium',    v: 140,  c: '#c4ffb4', t: 2, cat: 'ore' },
  scandium:  { n: 'Scandium',      v: 185,  c: '#b4d4ff', t: 3, cat: 'ore' },
  vanadium:  { n: 'Vanadium',      v: 210,  c: '#ffb4b4', t: 3, cat: 'ore' },
  chromium:  { n: 'Chromium',      v: 245,  c: '#e6ffb4', t: 3, cat: 'ore' },
  manganese: { n: 'Manganese',    v: 270,  c: '#ffb4e6', t: 3, cat: 'ore' },
  zinc:      { n: 'Zinc',         v: 165,  c: '#b4ffb4', t: 2, cat: 'ore' },
  gallium:   { n: 'Gallium',      v: 320,  c: '#d4b4ff', t: 3, cat: 'ore' },
  germanium: { n: 'Germanium',    v: 380,  c: '#b4e6ff', t: 3, cat: 'ore' },
  arsenic:   { n: 'Arsenic',      v: 290,  c: '#c8ffb4', t: 3, cat: 'ore' },
  selenium:  { n: 'Selenium',     v: 340,  c: '#ffb4c8', t: 3, cat: 'ore' },
  bromine:   { n: 'Bromine',      v: 310,  c: '#ffb4ff', t: 3, cat: 'ore' },
  krypton:   { n: 'Krypton',      v: 420,  c: '#d4ffb4', t: 3, cat: 'ore' },
  rubidium:  { n: 'Rubidium',     v: 390,  c: '#ffb4d4', t: 3, cat: 'ore' },
  strontium: { n: 'Strontium',    v: 440,  c: '#e6ffb4', t: 3, cat: 'ore' },
  yttrium:   { n: 'Yttrium',      v: 490,  c: '#b4ffcc', t: 4, cat: 'ore' },
  zirconium: { n: 'Zirconium',    v: 540,  c: '#ffb4b4', t: 4, cat: 'ore' },
  niobium:   { n: 'Niobium',      v: 590,  c: '#c8ffb4', t: 4, cat: 'ore' },
  molybdenum:{ n: 'Molybdenum',   v: 640,  c: '#b4e6ff', t: 4, cat: 'ore' },
  technetium:{ n: 'Technetium',   v: 720,  c: '#ffb4e6', t: 4, cat: 'ore' },
  ruthenium: { n: 'Ruthenium',    v: 780,  c: '#d4b4ff', t: 4, cat: 'ore' },
  rhodium:   { n: 'Rhodium',      v: 850,  c: '#ffb4ff', t: 4, cat: 'ore' },
  palladium: { n: 'Palladium',    v: 920,  c: '#ffd4b4', t: 4, cat: 'ore' },
  silver:    { n: 'Silver',        v: 180,  c: '#e6e6ff', t: 2, cat: 'ore' },
  cadmium:   { n: 'Cadmium',      v: 280,  c: '#b4ffb4', t: 3, cat: 'ore' },
  tin:       { n: 'Tin',          v: 195,  c: '#c8e6ff', t: 2, cat: 'ore' },
  antimony:  { n: 'Antimony',     v: 360,  c: '#ffb4c8', t: 3, cat: 'ore' },
  tellurium: { n: 'Tellurium',    v: 410,  c: '#e6ffb4', t: 3, cat: 'ore' },
  iodine:    { n: 'Iodine',       v: 380,  c: '#ffb4ff', t: 3, cat: 'ore' },
  xenon:     { n: 'Xenon',        v: 520,  c: '#d4ffb4', t: 3, cat: 'ore' },
  cesium:    { n: 'Cesium',       v: 480,  c: '#ffb4d4', t: 3, cat: 'ore' },
  barium:    { n: 'Barium',       v: 560,  c: '#ffb4b4', t: 4, cat: 'ore' },
  lanthanum: { n: 'Lanthanum',    v: 620,  c: '#c8ffb4', t: 4, cat: 'ore' },
  cerium:    { n: 'Cerium',       v: 680,  c: '#b4e6ff', t: 4, cat: 'ore' },
  praseodymium:{ n: 'Praseodymium',v: 740, c: '#ffb4e6', t: 4, cat: 'ore' },
  neodymium: { n: 'Neodymium',    v: 800,  c: '#d4b4ff', t: 4, cat: 'ore' },
  promethium:{ n: 'Promethium',   v: 880,  c: '#ffb4ff', t: 4, cat: 'ore' },
  samarium:  { n: 'Samarium',     v: 940,  c: '#ffd4b4', t: 4, cat: 'ore' },
  europium:  { n: 'Europium',     v: 1000, c: '#e6e6ff', t: 5, cat: 'ore' },
  gadolinium: { n: 'Gadolinium',   v: 1080, c: '#b4ffb4', t: 5, cat: 'ore' },
  terbium:   { n: 'Terbium',      v: 1160, c: '#c8e6ff', t: 5, cat: 'ore' },
  dysprosium: { n: 'Dysprosium',   v: 1240, c: '#ffb4c8', t: 5, cat: 'ore' },
  holmium:   { n: 'Holmium',      v: 1320, c: '#e6ffb4', t: 5, cat: 'ore' },
  erbium:    { n: 'Erbium',       v: 1400, c: '#ffb4ff', t: 5, cat: 'ore' },
  thulium:   { n: 'Thulium',      v: 1500, c: '#d4ffb4', t: 5, cat: 'ore' },
  ytterbium: { n: 'Ytterbium',    v: 1600, c: '#ffb4d4', t: 5, cat: 'ore' },
  lutetium:  { n: 'Lutetium',     v: 1720, c: '#ffb4b4', t: 5, cat: 'ore' },
  hafnium:   { n: 'Hafnium',      v: 1840, c: '#c8ffb4', t: 5, cat: 'ore' },
  tantalum:  { n: 'Tantalum',     v: 1980, c: '#b4e6ff', t: 5, cat: 'ore' },
  tungsten:  { n: 'Tungsten',     v: 2120, c: '#ffb4e6', t: 5, cat: 'ore' },
  rhenium:   { n: 'Rhenium',      v: 2280, c: '#d4b4ff', t: 5, cat: 'ore' },
  osmium:    { n: 'Osmium',       v: 2460, c: '#ffb4ff', t: 5, cat: 'ore' },
  mercury:   { n: 'Mercury',      v: 320,  c: '#c8e6ff', t: 3, cat: 'ore' },
  thallium:  { n: 'Thallium',     v: 540,  c: '#b4ffb4', t: 4, cat: 'ore' },
  lead:      { n: 'Lead',         v: 280,  c: '#b4b4c8', t: 2, cat: 'ore' },
  bismuth:   { n: 'Bismuth',      v: 420,  c: '#e6e6ff', t: 3, cat: 'ore' },
  polonium:  { n: 'Polonium',     v: 880,  c: '#ffb4b4', t: 4, cat: 'ore' },
  astatine:  { n: 'Astatine',     v: 940,  c: '#c8ffb4', t: 4, cat: 'ore' },
  radon_gas: { n: 'Radon Gas',     v: 620,  c: '#b4ffcc', t: 4, cat: 'gas' },
  francium:  { n: 'Francium',     v: 1200, c: '#ffb4e6', t: 5, cat: 'ore' },
  radium:    { n: 'Radium',       v: 1400, c: '#d4b4ff', t: 5, cat: 'ore' },
  actinium:  { n: 'Actinium',     v: 1600, c: '#ffb4ff', t: 5, cat: 'ore' },
  thorium:   { n: 'Thorium',      v: 1800, c: '#ffd4b4', t: 5, cat: 'ore' },
  protactinium:{ n: 'Protactinium', v: 2000, c: '#e6e6ff', t: 5, cat: 'ore' },
  neptunium: { n: 'Neptunium',    v: 2200, c: '#b4ffb4', t: 5, cat: 'ore' },
  plutonium: { n: 'Plutonium',    v: 2400, c: '#c8e6ff', t: 5, cat: 'ore' },
  americium: { n: 'Americium',    v: 2600, c: '#ffb4c8', t: 5, cat: 'ore' },
  curium:    { n: 'Curium',       v: 2800, c: '#e6ffb4', t: 5, cat: 'ore' },
  berkelium: { n: 'Berkelium',    v: 3000, c: '#ffb4ff', t: 5, cat: 'ore' },
  californium:{ n: 'Californium',  v: 3200, c: '#d4ffb4', t: 5, cat: 'ore' },
  einsteinium:{ n: 'Einsteinium',  v: 3400, c: '#ffb4d4', t: 5, cat: 'ore' },
  fermium:   { n: 'Fermium',      v: 3600, c: '#ffb4b4', t: 5, cat: 'ore' },
  /* gases */
  oxygen:    { n: 'Oxygen',        v: 27,   c: '#8fe9ff', t: 1, cat: 'gas' },
  hydrogen:  { n: 'Hydrogen',      v: 22,   c: '#bfe6ff', t: 1, cat: 'gas' },
  nitrogen:  { n: 'Nitrogen',      v: 34,   c: '#a8d4ff', t: 1, cat: 'gas' },
  sulphur:   { n: 'Sulphur',       v: 48,   c: '#ffe45f', t: 2, cat: 'gas' },
  helium:    { n: 'Helium',        v: 88,   c: '#ffd0f0', t: 2, cat: 'gas' },
  radon:     { n: 'Radon',         v: 176,  c: '#b4ff8f', t: 3, cat: 'gas' },
  /* fuels */
  tritium:   { n: 'Tritium',       v: 36,   c: '#7cffd0', t: 2, cat: 'fuel', fuel: 4 },
  deuterium: { n: 'Deuterium',     v: 132,  c: '#9fffe4', t: 3, cat: 'fuel', fuel: 12 },
  antimatter:{ n: 'Antimatter',    v: 1750, c: '#fff58f', t: 5, cat: 'fuel', fuel: 60 },
  /* organics */
  fibre:     { n: 'Plant Fibre',   v: 16,   c: '#8fe08f', t: 1, cat: 'organic' },
  resin:     { n: 'Resin',         v: 42,   c: '#ffb46b', t: 2, cat: 'organic' },
  chitin:    { n: 'Chitin Plate',  v: 64,   c: '#d4a86b', t: 2, cat: 'organic' },
  leather:   { n: 'Cured Hide',    v: 92,   c: '#b4845f', t: 2, cat: 'organic' },
  bone:      { n: 'Hollow Bone',   v: 70,   c: '#e6ddc8', t: 2, cat: 'organic' },
  mold:      { n: 'Fungal Mold',   v: 38,   c: '#a4c46b', t: 1, cat: 'organic' },
  algae:     { n: 'Algae Bloom',   v: 30,   c: '#6fd8a8', t: 1, cat: 'organic' },
  pollen:    { n: 'Lumen Pollen',  v: 155,  c: '#ffe9a8', t: 3, cat: 'organic' },
  /* crystals */
  quartz:    { n: 'Quartz',        v: 45,   c: '#e6f4ff', t: 2, cat: 'crystal' },
  emeril:    { n: 'Emeril',        v: 214,  c: '#6cff8f', t: 3, cat: 'crystal' },
  chromatic: { n: 'Chromatic Metal',v: 290, c: '#ff6fd2', t: 3, cat: 'crystal' },
  indium:    { n: 'Indium',        v: 465,  c: '#a884ff', t: 4, cat: 'crystal' },
  voidcrystal:{n: 'Void Crystal',  v: 940,  c: '#c0f0ff', t: 4, cat: 'crystal' },
  stellarite:{ n: 'Stellarite',    v: 3400, c: '#ffc46b', t: 5, cat: 'crystal' },
  /* components */
  glass:     { n: 'Glass Pane',    v: 60,   c: '#cfe8f5', t: 2, cat: 'component' },
  wiring:    { n: 'Wiring Loom',   v: 110,  c: '#ffa86b', t: 2, cat: 'component' },
  alloy:     { n: 'Alloy Plate',   v: 190,  c: '#c4d2de', t: 3, cat: 'component' },
  circuit:   { n: 'Circuit Board', v: 265,  c: '#6cffb4', t: 3, cat: 'component' },
  servo:     { n: 'Servo Assembly',v: 340,  c: '#9fb4c8', t: 3, cat: 'component' },
  coolant:   { n: 'Coolant Cell',  v: 300,  c: '#8fd8ff', t: 3, cat: 'component' },
  powercell: { n: 'Power Cell',    v: 480,  c: '#ffd45f', t: 4, cat: 'component' },
  lens:      { n: 'Focusing Lens', v: 620,  c: '#e0c0ff', t: 4, cat: 'component' },
  nanotube:  { n: 'Nanotube Weave',v: 880,  c: '#a8b8c8', t: 4, cat: 'component' },
  frame:     { n: 'Hull Frame',    v: 1250, c: '#d6e6ec', t: 5, cat: 'component' },
  /* tools + consumables */
  multitool: { n: 'Mining Multitool', v: 900, c: '#4fe3d0', t: 3, cat: 'tool', tool: 'mine' },
  hoe:       { n: 'Terra Hoe',     v: 420,  c: '#b4845f', t: 2, cat: 'tool', tool: 'hoe' },
  can:       { n: 'Watering Can',  v: 360,  c: '#6fd8ff', t: 2, cat: 'tool', tool: 'water' },
  rod:       { n: 'Fishing Rod',   v: 540,  c: '#8fe09f', t: 2, cat: 'tool', tool: 'fish' },
  blaster:   { n: 'Bolt Caster',   v: 1400, c: '#ff6a4d', t: 4, cat: 'tool', tool: 'gun' },
  /* personal weapons — holding one unlocks it in the weapon wheel */
  g_sidearm: { wt: 0.03, n: 'Service Sidearm', v: 700,   c: '#9fe4ff', t: 2, cat: 'weapon', gun: 'sidearm' },
  g_scatter: { wt: 0.09, n: 'Scatter Gun',     v: 2600,  c: '#ffc46b', t: 3, cat: 'weapon', gun: 'scatter' },
  g_pulse:   { wt: 0.11, n: 'Pulse Repeater',  v: 7400,  c: '#6cff8f', t: 4, cat: 'weapon', gun: 'pulse' },
  g_rail:    { wt: 0.2, n: 'Rail Lance',      v: 19000, c: '#c0f0ff', t: 5, cat: 'weapon', gun: 'rail' },
  g_ray:     { wt: 0.13, n: 'Ray Emitter',     v: 26000, c: '#d484ff', t: 5, cat: 'weapon', gun: 'ray' },
  g_bomb:    { n: 'Seismic Charges', v: 12000, c: '#ff6a4d', t: 4, cat: 'weapon', gun: 'bombgun' },
  /* spacesuits — carrying one lets you wear it from the gear screen */
  s_scav:    { n: 'Scavenger Weave',  v: 900,    c: '#9fb3c8', t: 1, cat: 'suit', suit: 'scav' },
  s_recon:   { n: 'Recon Skin',       v: 6200,   c: '#6cff8f', t: 3, cat: 'suit', suit: 'recon' },
  s_therm:   { n: 'Thermal Shell',    v: 14000,  c: '#ffc46b', t: 3, cat: 'suit', suit: 'therm' },
  s_void:    { n: 'Void Carapace',    v: 68000,  c: '#6fd8ff', t: 4, cat: 'suit', suit: 'void' },
  s_bastion: { n: 'Bastion Plate',    v: 152000, c: '#c0f0ff', t: 5, cat: 'suit', suit: 'bastion' },
  s_null:    { n: 'Null Shroud',      v: 940000, c: '#d484ff', t: 5, cat: 'suit', suit: 'null_' },
  medkit:    { n: 'Med Kit',       v: 220,  c: '#ff9fb4', t: 2, cat: 'consumable', heal: 60 },
  ration:    { n: 'Ration Pack',   v: 90,   c: '#ffd9a0', t: 1, cat: 'consumable', food: 1 },
  oxtank:    { n: 'Air Canister',  v: 150,  c: '#9fe4ff', t: 2, cat: 'consumable', air: 100 },
  /* crops */
  grain:     { n: 'Sun Grain',     v: 46,   c: '#ffd97a', t: 1, cat: 'crop', food: 1 },
  starfruit: { n: 'Starfruit',     v: 130,  c: '#ffe45f', t: 2, cat: 'crop', food: 2 },
  lumina:    { n: 'Lumina Root',   v: 205,  c: '#a8ffd0', t: 3, cat: 'crop', food: 2 },
  frostmelon:{ n: 'Frost Melon',   v: 260,  c: '#bfe6ff', t: 3, cat: 'crop', food: 3 },
  emberpep:  { n: 'Ember Pepper',  v: 310,  c: '#ff8a5f', t: 3, cat: 'crop', food: 2 },
  gloomcap:  { n: 'Gloom Cap',     v: 470,  c: '#c48fff', t: 4, cat: 'crop', food: 3 },
  voidbloom: { n: 'Void Bloom',    v: 980,  c: '#d484ff', t: 5, cat: 'crop', food: 4 },
  /* fish */
  silverfin: { n: 'Silverfin',     v: 85,   c: '#d6e6ec', t: 1, cat: 'fish', food: 2 },
  glasseel:  { n: 'Glass Eel',     v: 165,  c: '#9fe4ff', t: 2, cat: 'fish', food: 2 },
  stonecarp: { n: 'Stone Carp',    v: 240,  c: '#98a8b4', t: 2, cat: 'fish', food: 3 },
  emberkoi:  { n: 'Ember Koi',     v: 420,  c: '#ff8a5f', t: 3, cat: 'fish', food: 3 },
  voidray:   { n: 'Void Ray',      v: 760,  c: '#c48fff', t: 4, cat: 'fish', food: 4 },
  tidewhale: { n: 'Tide Leviathan',v: 2600, c: '#6fd8ff', t: 5, cat: 'fish', food: 8 },
  /* artifacts */
  relic:     { n: 'Relic Shard',   v: 1100, c: '#d484ff', t: 4, cat: 'artifact' },
  glyph:     { n: 'Glyph Tablet',  v: 2200, c: '#ffc46b', t: 5, cat: 'artifact' },
  core:      { n: 'Ancient Core',  v: 5600, c: '#c0f0ff', t: 5, cat: 'artifact' },
  /* seeds */
  seed_grain:{ n: 'Sun Grain Seed', v: 20, c: '#ffd97a', t: 1, cat: 'seed', crop: 'grain' },
  seed_starfruit:{ n: 'Starfruit Seed', v: 62, c: '#ffe45f', t: 2, cat: 'seed', crop: 'starfruit' },
  seed_lumina:{ n: 'Lumina Seed', v: 96, c: '#a8ffd0', t: 3, cat: 'seed', crop: 'lumina' },
  seed_frostmelon:{ n: 'Frost Melon Seed', v: 124, c: '#bfe6ff', t: 3, cat: 'seed', crop: 'frostmelon' },
  seed_emberpep:{ n: 'Ember Pepper Seed', v: 148, c: '#ff8a5f', t: 3, cat: 'seed', crop: 'emberpep' },
  seed_gloomcap:{ n: 'Gloom Cap Spore', v: 225, c: '#c48fff', t: 4, cat: 'seed', crop: 'gloomcap' },
  seed_voidbloom:{ n: 'Void Bloom Seed', v: 470, c: '#d484ff', t: 5, cat: 'seed', crop: 'voidbloom' }
};
const MAT_KEYS = Object.keys(MAT);
const ORE_KEYS = MAT_KEYS.filter(k => MAT[k].cat === 'ore' || MAT[k].cat === 'crystal' || MAT[k].cat === 'fuel' || MAT[k].cat === 'gas');

/* alloys: any two base materials fuse into a named alloy.
   With 60+ inputs that is well over three thousand results. */
const ALLOY_PRE = ['Ultra','Hyper','Trans','Duro','Ferro','Cryo','Pyro','Volt','Null','Sol','Umbra','Astra','Nova','Terra','Kryo','Zenith','Aegis','Vanta'];
const ALLOY_SUF = ['steel','glass','weave','crete','forge','mesh','core','shell','lattice','flux','plate','bond','rime','spar'];
function alloyKey(a, b) { return 'alloy:' + [a, b].sort().join('+'); }
function makeAlloy(a, b) {
  const key = alloyKey(a, b);
  if (MAT[key]) return key;
  const r = rng(hash2(key.length * 31, key.charCodeAt(6) * 17 + key.charCodeAt(key.length - 1), 31337 + key.length));
  const A = MAT[a], B = MAT[b];
  const val = Math.round((A.v + B.v) * rr(r, 1.5, 2.4) + 40);
  const mix = (c1, c2) => {
    const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const x = p(c1), y = p(c2);
    const t = (i) => Math.round((x[i] + y[i]) / 2).toString(16).padStart(2, '0');
    return '#' + t(0) + t(1) + t(2);
  };
  MAT[key] = {
    n: pick(r, ALLOY_PRE) + pick(r, ALLOY_SUF),
    v: val, c: mix(A.c, B.c), t: Math.max(A.t, B.t) + 1, cat: 'alloy',
    from: [a, b], grade: Math.round(rr(r, 1, 5))
  };
  return key;
}

/* ------------------------------------------------------------
   5. RECIPES
------------------------------------------------------------ */
const RECIPES = [
  { o: 'glass',    n: 2, in: { silicate: 6 },                        cat: 'Components' },
  { o: 'wiring',   n: 1, in: { copper: 5, carbon: 3 },               cat: 'Components' },
  { o: 'alloy',    n: 1, in: { ferrite: 12, nickel: 4 },             cat: 'Components' },
  { o: 'circuit',  n: 1, in: { wiring: 2, silicate: 8, cobalt: 3 },  cat: 'Components' },
  { o: 'servo',    n: 1, in: { alloy: 2, wiring: 2, magnetite: 6 },  cat: 'Components' },
  { o: 'coolant',  n: 1, in: { glass: 2, nitrogen: 10, cobalt: 4 },  cat: 'Components' },
  { o: 'powercell',n: 1, in: { circuit: 1, tritium: 12, aurum: 3 },  cat: 'Components' },
  { o: 'lens',     n: 1, in: { glass: 4, quartz: 6, emeril: 2 },     cat: 'Components' },
  { o: 'nanotube', n: 1, in: { carbon: 40, titanium: 6, chromatic: 2 }, cat: 'Components' },
  { o: 'frame',    n: 1, in: { alloy: 6, nanotube: 2, titanium: 10 },cat: 'Components' },
  { o: 'multitool',n: 1, in: { alloy: 3, circuit: 1, lens: 1 },      cat: 'Tools' },
  { o: 'hoe',      n: 1, in: { ferrite: 20, fibre: 10 },             cat: 'Tools' },
  { o: 'can',      n: 1, in: { copper: 12, glass: 2 },               cat: 'Tools' },
  { o: 'rod',      n: 1, in: { fibre: 18, bone: 4, resin: 4 },       cat: 'Tools' },
  { o: 'blaster',  n: 1, in: { servo: 2, circuit: 2, lens: 1, iridium: 4 }, cat: 'Tools' },
  { o: 'g_sidearm',n: 1, in: { alloy: 2, wiring: 2, copper: 10 },    cat: 'Weapons' },
  { o: 'g_scatter',n: 1, in: { alloy: 4, servo: 1, magnetite: 20 },  cat: 'Weapons' },
  { o: 'g_pulse',  n: 1, in: { servo: 3, circuit: 3, coolant: 2 },   cat: 'Weapons' },
  { o: 'g_bomb',   n: 1, in: { servo: 2, sulphur: 30, alloy: 4 },    cat: 'Weapons' },
  { o: 'g_rail',   n: 1, in: { lens: 2, powercell: 2, iridium: 12 }, cat: 'Weapons' },
  { o: 'g_ray',    n: 1, in: { lens: 3, powercell: 2, indium: 8 },   cat: 'Weapons' },
  { o: 's_scav',    n: 1, in: { fibre: 14, leather: 2, alloy: 1 },     cat: 'Suits' },
  { o: 's_recon',   n: 1, in: { leather: 4, circuit: 2, fibre: 20 },   cat: 'Suits' },
  { o: 's_therm',   n: 1, in: { alloy: 8, coolant: 3, glass: 4 },      cat: 'Suits' },
  { o: 's_void',    n: 1, in: { nanotube: 3, coolant: 5, indium: 6 },  cat: 'Suits' },
  { o: 's_bastion', n: 1, in: { frame: 2, titanium: 30, nanotube: 4 }, cat: 'Suits' },
  { o: 's_null',    n: 1, in: { voidcrystal: 6, stellarite: 2, chitin: 40 }, cat: 'Suits' },
  { o: 'medkit',   n: 2, in: { mold: 6, fibre: 6, algae: 4 },        cat: 'Consumables' },
  { o: 'ration',   n: 4, in: { grain: 3, algae: 2 },                 cat: 'Consumables' },
  { o: 'oxtank',   n: 2, in: { oxygen: 25, alloy: 1 },               cat: 'Consumables' },
  { o: 'seed_grain', n: 4, in: { grain: 1, fibre: 2 },               cat: 'Seeds' },
  { o: 'seed_starfruit', n: 3, in: { starfruit: 1, fibre: 3 },       cat: 'Seeds' },
  { o: 'seed_lumina', n: 3, in: { lumina: 1, mold: 3 },              cat: 'Seeds' },
  { o: 'seed_frostmelon', n: 3, in: { frostmelon: 1, algae: 3 },     cat: 'Seeds' },
  { o: 'seed_emberpep', n: 3, in: { emberpep: 1, resin: 3 },         cat: 'Seeds' },
  { o: 'seed_gloomcap', n: 3, in: { gloomcap: 1, mold: 6 },          cat: 'Seeds' },
  { o: 'seed_voidbloom', n: 2, in: { voidbloom: 1, pollen: 4 },      cat: 'Seeds' },
  { o: 'deuterium',n: 4, in: { tritium: 10, hydrogen: 10 },          cat: 'Fuel' },
  { o: 'tritium',  n: 6, in: { hydrogen: 8, radon: 1 },              cat: 'Fuel' },
  { o: 'chromatic',n: 2, in: { copper: 12, emeril: 2 },              cat: 'Refined' },
  { o: 'indium',   n: 1, in: { chromatic: 3, iridium: 2 },           cat: 'Refined' },
  { o: 'voidcrystal', n: 1, in: { indium: 2, quartz: 12, radon: 4 }, cat: 'Refined' },
  { o: 'leather',  n: 1, in: { chitin: 3, resin: 2 },                cat: 'Refined' },
  { o: 'antimatter', n: 1, in: { voidcrystal: 2, powercell: 2, uranite: 6 }, cat: 'Refined' }
];

/* ------------------------------------------------------------
   5b. ELEMENTAL CRAFTING LINE
   Every element, gas, fuel and crystal in the game gets pulled into
   its own small family of recipes — a weapon coil, a suit plate and
   a ship-grade component apiece — so nothing mined ever sits in the
   hold with nowhere to spend it. ~90 elements × 3 families is close
   to three hundred new craftable items on top of the hand-built list
   above.
------------------------------------------------------------ */
const ELEMENT_FAMILIES = [
  { key: 'coil',  suf: ' Coil',    cat: 'Weapons',   extra: { wiring: 2, alloy: 1 },  outMul: 1,   amtDiv: 3 },
  { key: 'plate', suf: ' Plating', cat: 'Suits',     extra: { ferrite: 10, fibre: 4 },outMul: 1,   amtDiv: 2.4 },
  { key: 'cell',  suf: ' Cell',    cat: 'Components',extra: { glass: 2 },             outMul: 2,   amtDiv: 4 }
];
for (const ek of ORE_KEYS) {
  const E = MAT[ek];
  if (!E || !E.v) continue;
  for (const fam of ELEMENT_FAMILIES) {
    const outKey = 'x_' + fam.key + '_' + ek;
    if (MAT[outKey]) continue;
    const amt = clamp(Math.round(30 / (fam.amtDiv * Math.max(1, E.t))), 2, 24);
    MAT[outKey] = { n: E.n + fam.suf, v: Math.round(E.v * 2.1 + 30), c: E.c, t: E.t, cat: 'component' };
    const inputs = { [ek]: amt };
    for (const k in fam.extra) inputs[k] = fam.extra[k];
    RECIPES.push({ o: outKey, n: fam.outMul, in: inputs, cat: fam.cat });
  }
}
const RECIPE_KEYS_ELEMENTAL = RECIPES.length;

/* ------------------------------------------------------------
   6. CROPS + FISH
------------------------------------------------------------ */
const CROPS = {
  grain:     { n: 'Sun Grain',   days: 2, yield: [3, 5],  water: 2, biome: ['lush','desert','barren'] },
  starfruit: { n: 'Starfruit',   days: 3, yield: [2, 4],  water: 3, biome: ['lush','exotic'] },
  lumina:    { n: 'Lumina Root', days: 4, yield: [2, 3],  water: 3, biome: ['frozen','oceanic','lush'] },
  frostmelon:{ n: 'Frost Melon', days: 5, yield: [1, 3],  water: 4, biome: ['frozen'] },
  emberpep:  { n: 'Ember Pepper',days: 4, yield: [2, 4],  water: 2, biome: ['volcanic','desert'] },
  gloomcap:  { n: 'Gloom Cap',   days: 5, yield: [2, 3],  water: 4, biome: ['toxic','irradiated'] },
  voidbloom: { n: 'Void Bloom',  days: 8, yield: [1, 2],  water: 6, biome: ['exotic'] }
};
const FISH_TABLE = [
  { k: 'silverfin', w: 40, diff: 1 }, { k: 'glasseel', w: 26, diff: 2 },
  { k: 'stonecarp', w: 18, diff: 2 }, { k: 'emberkoi', w: 9, diff: 3 },
  { k: 'voidray', w: 5, diff: 4 },    { k: 'tidewhale', w: 2, diff: 5 }
];

/* ------------------------------------------------------------
   7. BIOMES
------------------------------------------------------------ */
const BIOMES = {
  ruined:    { n: 'Cataclysmic', sky: ['#4a1410','#120406'], gnd: '#382622', rock: '#4c352f', acc: '#ff6a4d', haz: 0.55, hazn: 'Ash storms', life: 'Extinct', flora: 0.1, water: 0, wx: ['ashfall','dust devils','dead calm'], pool: ['ferrite','carbon','tritium','copper','magnetite'] },
  lush:      { n: 'Verdant',     sky: ['#0d3a2c','#04140f'], gnd: '#1d4433', rock: '#2c5642', acc: '#6cff8f', haz: 0,    hazn: 'None', life: 'Abundant', flora: 1.0, water: 0.7, wx: ['clear skies','warm rain','drifting mist'], pool: ['carbon','oxygen','fibre','emeril','mold','resin'] },
  desert:    { n: 'Scorched',    sky: ['#4a3410','#160d04'], gnd: '#5a4426', rock: '#6b532f', acc: '#ffc46b', haz: 0.35, hazn: 'Heat', life: 'Sparse', flora: 0.25, water: 0.15, wx: ['blistering sun','sandstorm','still heat'], pool: ['silicate','ferrite','copper','platinum','sulphur','quartz'] },
  frozen:    { n: 'Glaciated',   sky: ['#12324a','#040c16'], gnd: '#2d4d61', rock: '#3d6076', acc: '#8fe9ff', haz: 0.4,  hazn: 'Deep cold', life: 'Sparse', flora: 0.2, water: 0.55, wx: ['snowfall','ice storm','pale sun'], pool: ['oxygen','cobalt','silicate','indium','nitrogen','quartz'] },
  toxic:     { n: 'Toxic',       sky: ['#2a4210','#0b1404'], gnd: '#374a1e', rock: '#455c28', acc: '#b4ff4d', haz: 0.5,  hazn: 'Caustic rain', life: 'Hostile', flora: 0.6, water: 0.4, wx: ['acid drizzle','yellow fog','corrosive squall'], pool: ['mold','carbon','emeril','indium','sulphur','algae'] },
  volcanic:  { n: 'Volcanic',    sky: ['#4a1004','#160402'], gnd: '#3a211a', rock: '#55291d', acc: '#ff7a3d', haz: 0.65, hazn: 'Firestorms', life: 'Rare', flora: 0.1, water: 0.05, wx: ['ember rain','pyroclastic wind','sulphur haze'], pool: ['ferrite','chromatic','platinum','stellarite','sulphur','aurum'] },
  barren:    { n: 'Barren',      sky: ['#23272e','#08090c'], gnd: '#3b3f47', rock: '#4a4f58', acc: '#b9c7d6', haz: 0.15, hazn: 'Vacuum', life: 'None', flora: 0, water: 0, wx: ['airless','micrometeorites','absolute quiet'], pool: ['ferrite','silicate','cobalt','platinum','titanium','magnetite'] },
  irradiated:{ n: 'Irradiated',  sky: ['#3d4210','#111304'], gnd: '#44491f', rock: '#565c28', acc: '#e4ff4d', haz: 0.7,  hazn: 'Radiation', life: 'Mutated', flora: 0.3, water: 0.2, wx: ['particle wind','glow fog','hard rain'], pool: ['cobalt','indium','chromatic','uranite','radon'] },
  oceanic:   { n: 'Oceanic',     sky: ['#0b2c4a','#030c16'], gnd: '#12415c', rock: '#1b5674', acc: '#6fd8ff', haz: 0.2,  hazn: 'Tidal surge', life: 'Aquatic', flora: 0.7, water: 1.0, wx: ['squall','flat calm','rolling fog'], pool: ['oxygen','algae','cobalt','voidcrystal','nitrogen','helium'] },
  exotic:    { n: 'Exotic',      sky: ['#3a1050','#100418'], gnd: '#3b2154', rock: '#4c2b6b', acc: '#d484ff', haz: 0.45, hazn: 'Unstable', life: 'Anomalous', flora: 0.5, water: 0.35, wx: ['gravity shear','colour storm','humming silence'], pool: ['chromatic','voidcrystal','antimatter','stellarite','pollen','helium'] },
  citadel:   { n: 'City deck',   sky: ['#0a1c2c','#020609'], gnd: '#1a2a36', rock: '#263945', acc: '#6fd8ff', haz: 0,    hazn: 'Sealed', life: 'Dense', flora: 0.15, water: 0, wx: ['recycled air'], pool: ['ferrite','alloy','circuit','wiring','glass'] },
  training:  { n: 'Temperate',   sky: ['#10324a','#04101a'], gnd: '#27443a', rock: '#35594a', acc: '#6cff8f', haz: 0,    hazn: 'None', life: 'Managed', flora: 0.8, water: 0.6, wx: ['clear skies'], pool: ['ferrite','tritium','carbon','fibre','silicate'] }
};
const BIOME_KEYS = Object.keys(BIOMES).filter(k => k !== 'ruined' && k !== 'training' && k !== 'citadel');

/* ------------------------------------------------------------
   8. SHIPS + MODULES
------------------------------------------------------------ */
const SHIPS = {
  vagrant:    { n: 'MK-0 Vagrant',  cl: 'Salvage hull', price: 0,        thrust: 240, turn: 2.7, max: 380, cargo: 150, hull: 120, shield: 60, mine: 1.0, warp: 1.0, gun: 7,  mass: 1.5, slots: 3, col: '#9fb3c8', s: 'hauler', d: 'Three dead ships welded into one. It flies. Barely.' },
  kestrel:    { n: 'Kestrel S2',    cl: 'Scout',        price: 92000,    thrust: 430, turn: 4.3, max: 680, cargo: 210, hull: 160, shield: 100, mine: 1.3, warp: 1.5, gun: 12, mass: 1.0, slots: 4, col: '#6fd8ff', s: 'scout', d: 'Light frame, oversized intake. Built to look first and think later.' },
  wraith:     { n: 'Wraith VX',     cl: 'Fighter',      price: 380000,   thrust: 550, turn: 4.9, max: 800, cargo: 180, hull: 320, shield: 220, mine: 1.2, warp: 1.3, gun: 30, mass: 1.2, slots: 5, col: '#ff6a4d', s: 'fighter', d: 'Twin rail emitters bolted to a cockpit. Pirates read the silhouette and change course.' },
  nomad:      { n: 'Nomad LR',      cl: 'Explorer',     price: 680000,   thrust: 460, turn: 3.7, max: 740, cargo: 380, hull: 270, shield: 190, mine: 2.0, warp: 2.6, gun: 16, mass: 1.3, slots: 6, col: '#6cff8f', s: 'explorer', d: 'Long-range survey vessel. The mining laser is rated for continuous burn.' },
  leviathan:  { n: 'Leviathan H9',  cl: 'Hauler',       price: 1450000,  thrust: 330, turn: 2.5, max: 560, cargo: 1200,hull: 580, shield: 300, mine: 1.7, warp: 1.9, gun: 14, mass: 2.6, slots: 7, col: '#ffc46b', s: 'hauler', d: 'A warehouse with engines. Turns like a moon, pays for itself in one run.' },
  chrysalis:  { n: 'Chrysalis',     cl: 'Living ship',  price: 5400000,  thrust: 590, turn: 5.1, max: 870, cargo: 660, hull: 620, shield: 480, mine: 2.5, warp: 3.2, gun: 34, mass: 1.4, slots: 8, col: '#d484ff', s: 'living', d: 'Grown, not built. It heals its own hull and dislikes being left in atmosphere.' },
  singularity:{ n: 'Singularity',   cl: 'Exotic',       price: 21000000, thrust: 800, turn: 5.7, max: 1200,cargo: 1500,hull: 1020,shield: 860, mine: 3.6, warp: 4.8, gun: 58, mass: 1.1, slots: 9, col: '#c0f0ff', s: 'exotic', d: 'Nobody sells these. Somebody sold you this one. Do not ask the broker twice.' },
  /* two more purely-cosmetic hulls, one per rung, so the rim doesn't look
     like it only ever ships four silhouettes */
  interdart:  { n: 'Interdart',     cl: 'Interceptor',  price: 210000,   thrust: 470, turn: 4.6, max: 720, cargo: 190, hull: 150, shield: 90,  mine: 1.1, warp: 1.4, gun: 11, mass: 0.9, slots: 4, col: '#ff9fd0', s: 'interceptor', d: 'A forked-tail needle built for one job: getting somewhere before anyone else notices you left.' },
  corsair:    { n: 'Corsair MK-7',  cl: 'Corvette',      price: 540000,   thrust: 500, turn: 4.0, max: 750, cargo: 260, hull: 340, shield: 240, mine: 1.4, warp: 1.6, gun: 26, mass: 1.3, slots: 5, col: '#8fe09f', s: 'corvette', d: 'Double-hulled and squat. Looks slow. Is not.' }
};
const SHIP_KEYS = Object.keys(SHIPS);

const MODULES = {
  eng1: { n: 'Thruster Tune I',  slot: 'engine', cr: 22000,  in: { servo: 1, alloy: 2 },            thrust: 0.18, max: 0.12 },
  eng2: { n: 'Thruster Tune II', slot: 'engine', cr: 120000, in: { servo: 3, coolant: 2, alloy: 6 },thrust: 0.4, max: 0.28 },
  eng3: { n: 'Vector Core',      slot: 'engine', cr: 620000, in: { servo: 6, powercell: 2, nanotube: 2 }, thrust: 0.8, max: 0.5, turn: 0.25 },
  shl1: { n: 'Deflector I',      slot: 'shield', cr: 30000,  in: { circuit: 1, glass: 3 },          shield: 0.3, shieldFlat: 60 },
  shl2: { n: 'Deflector II',     slot: 'shield', cr: 160000, in: { circuit: 3, coolant: 2, indium: 2 }, shield: 0.7, shieldFlat: 190, regen: 4 },
  shl3: { n: 'Phase Barrier',    slot: 'shield', cr: 840000, in: { lens: 2, powercell: 2, voidcrystal: 2 }, shield: 1.4, shieldFlat: 520, regen: 10 },
  wpn1: { n: 'Bolt Array I',     slot: 'weapon', cr: 26000,  in: { wiring: 3, alloy: 2 },           gun: 0.4, gunFlat: 9 },
  wpn2: { n: 'Bolt Array II',    slot: 'weapon', cr: 180000, in: { circuit: 2, lens: 1, iridium: 3 },gun: 1.0, gunFlat: 26, rate: 0.25 },
  wpn3: { n: 'Singularity Lance',slot: 'weapon', cr: 960000, in: { lens: 3, powercell: 3, antimatter: 2 }, gun: 2.4, gunFlat: 64, rate: 0.4 },
  cgo1: { n: 'Hold Expansion I', slot: 'cargo',  cr: 34000,  in: { alloy: 4, frame: 0 },            cargo: 0.35 },
  cgo2: { n: 'Hold Expansion II',slot: 'cargo',  cr: 210000, in: { alloy: 10, frame: 1 },           cargo: 0.8 },
  min1: { n: 'Beam Focus I',     slot: 'mining', cr: 28000,  in: { lens: 1, wiring: 2 },            mine: 0.45 },
  min2: { n: 'Beam Focus II',    slot: 'mining', cr: 190000, in: { lens: 2, circuit: 3, emeril: 6 },mine: 1.1 },
  hyp1: { n: 'Warp Coil I',      slot: 'warp',   cr: 46000,  in: { coolant: 2, cobalt: 20 },        warp: 0.5, fuel: 25 },
  hyp2: { n: 'Warp Coil II',     slot: 'warp',   cr: 280000, in: { coolant: 4, powercell: 1, indium: 6 }, warp: 1.4, fuel: 60 },
  plt1: { n: 'Ablative Plating', slot: 'plate',  cr: 52000,  in: { alloy: 8, titanium: 10 },        hull: 0.4, impact: 0.3 },
  plt2: { n: 'Crash Frame',      slot: 'plate',  cr: 300000, in: { frame: 2, nanotube: 3 },         hull: 0.9, impact: 0.65 },
  scn1: { n: 'Deep Scanner',     slot: 'scan',   cr: 88000,  in: { circuit: 2, lens: 1 },           scan: 0.6 },
  scn2: { n: 'Resonance Array',  slot: 'scan',   cr: 420000, in: { lens: 3, powercell: 1, relic: 1 },scan: 1.6 }
};
const MODULE_KEYS = Object.keys(MODULES);

/* ------------------------------------------------------------
   8a-ii. SHIP WEAPON TYPES
   The gun mounted on the hull, not the thing in your hands. Four
   families, each with three tiers. Switching family changes how
   the gun fires; buying a tier makes the family you already own
   hit harder. Bullet Mk I is free and fitted from the start.
------------------------------------------------------------ */
const SHIP_WEAPONS = {
  bullet: { n: 'Autocannon', short: 'Bullet', d: 'A single reliable barrel. No frills, no weaknesses, never runs dry.', tiers: [
    { n: 'Autocannon Mk I',   cr: 0,       in: {},                                   gun: 1.0, rate: 1.0 },
    { n: 'Autocannon Mk II',  cr: 60000,   in: { alloy: 6, wiring: 4 },              gun: 1.6, rate: 0.92 },
    { n: 'Autocannon Mk III', cr: 320000,  in: { circuit: 4, iridium: 5 },           gun: 2.5, rate: 0.85 }
  ] },
  twin: { n: 'Twin Cannon', short: 'Double bullet', d: 'Two linked barrels firing in parallel. Twice the rounds downrange, less damage per round.', tiers: [
    { n: 'Twin Cannon Mk I',   cr: 80000,   in: { alloy: 8, wiring: 6 },              gun: 0.85, rate: 0.8 },
    { n: 'Twin Cannon Mk II',  cr: 260000,  in: { circuit: 4, iridium: 6 },           gun: 1.3,  rate: 0.72 },
    { n: 'Twin Cannon Mk III', cr: 900000,  in: { lens: 3, powercell: 3, antimatter: 2 }, gun: 2.0, rate: 0.62 }
  ] },
  missile: { n: 'Missile Rack', short: 'Missile', d: 'Homing warheads that chase whatever is nearest hostile. Slow to reload, hits hard, and turns corners.', tiers: [
    { n: 'Missile Rack Mk I',   cr: 120000,  in: { frame: 1, alloy: 10 },             gun: 2.2, rate: 1.8, blast: 90 },
    { n: 'Missile Rack Mk II',  cr: 380000,  in: { nanotube: 3, powercell: 2 },       gun: 3.4, rate: 1.5, blast: 140 },
    { n: 'Missile Rack Mk III', cr: 1200000, in: { voidcrystal: 3, antimatter: 3 },   gun: 5.0, rate: 1.2, blast: 200 }
  ] },
  laser: { n: 'Beam Lance', short: 'Laser', d: 'A piercing beam that runs straight through anything in its path. No falloff, no dodging once it lands.', tiers: [
    { n: 'Beam Lance Mk I',   cr: 140000,  in: { lens: 2, circuit: 3 },               gun: 1.4, rate: 1.1,  pierce: true },
    { n: 'Beam Lance Mk II',  cr: 520000,  in: { lens: 4, powercell: 2, iridium: 4 }, gun: 2.3, rate: 0.95, pierce: true },
    { n: 'Beam Lance Mk III', cr: 1800000, in: { voidcrystal: 4, stellarite: 2 },     gun: 3.6, rate: 0.8,  pierce: true }
  ] }
};
const SHIP_WEAPON_KEYS = Object.keys(SHIP_WEAPONS);
/* double the board, then make Mk III+ cost quadratically more than a flat
   multiplier would give — the far end of a weapon ladder should feel like
   an actual investment, not the third item in a shopping list */
for (const fam of SHIP_WEAPON_KEYS) {
  SHIP_WEAPONS[fam].tiers.forEach((t, i) => { t.cr = Math.round(t.cr * 2 * Math.pow(i + 1, 1.6)); });
}
/* highest tier index (0-based) owned for a weapon family, or -1 if never bought */
function gunTierOwned(fam) { return (G.shipWeapons && G.shipWeapons[fam] !== undefined) ? G.shipWeapons[fam] : -1; }
function curShipGun() { return SHIP_WEAPONS[G.shipGun] ? G.shipGun : 'bullet'; }
function curGunTier() {
  const fam = curShipGun(); const owned = gunTierOwned(fam);
  return SHIP_WEAPONS[fam].tiers[Math.max(0, owned)];
}

/* ------------------------------------------------------------
   8b. PERSONAL WEAPONS
   Everything you can point at a creature, a person or a hut.
   Each one trades rate of fire against damage, reach and spread,
   so there is no single best pick for every situation.
------------------------------------------------------------ */
const GUNS = {
  fists:   { wt: 0, n: 'Bare hands',      mode: 'melee', dmg: 7,  rate: 0.55, range: 46,  spd: 0,    col: '#8fa9b4', sz: 0,   knock: 40,  d: 'Last resort. Short reach and it makes everything angry.' },
  sidearm: { n: 'Service Sidearm', mode: 'bolt',  dmg: 15, rate: 0.30, range: 620, spd: 940,  col: '#9fe4ff', sz: 2.4, d: 'Standard issue. Accurate, quiet, unremarkable.' },
  scatter: { n: 'Scatter Gun',     mode: 'shot',  dmg: 11, rate: 0.72, range: 300, spd: 780,  col: '#ffc46b', sz: 2.2, pellets: 6, spread: 0.38, d: 'Six pellets at once. Devastating up close, useless at range.' },
  pulse:   { n: 'Pulse Repeater',  mode: 'bolt',  dmg: 8,  rate: 0.085, range: 560, spd: 1180, col: '#6cff8f', sz: 1.8, spread: 0.07, heat: 1.6, d: 'Empties fast and overheats faster, but nothing else lays down this much fire.' },
  rail:    { n: 'Rail Lance',      mode: 'pierce',dmg: 62, rate: 1.25, range: 1150, spd: 2200, col: '#c0f0ff', sz: 3.2, d: 'Punches through everything in a line. One shot, then a long wait.' },
  ray:     { n: 'Ray Emitter',     mode: 'beam',  dmg: 46, rate: 0,    range: 460, col: '#d484ff', heat: 1.0, d: 'A held beam that burns whatever it touches. Drains the cell while you hold it.' },
  bombgun: { wt: 0.22, n: 'Seismic Charges', mode: 'bomb',  dmg: 88, rate: 1.05, range: 520, spd: 620,  col: '#ff6a4d', sz: 4, blast: 130, fuse: 0.9, d: 'Lobbed charges with a blast radius. Levels structures. Do not stand close.' }
};
const GUN_KEYS = Object.keys(GUNS);

/* ------------------------------------------------------------
   8b-ii. SPACESUITS
   What you are wearing decides how long the air lasts, how much
   punishment you can take and how fast you can walk. Every suit
   is a trade: the ones that shrug off a caustic sky are heavy,
   and the ones that let you cover ground are made of nothing.
   Weight is the cost of everything good, exactly as it is on
   the ship.
------------------------------------------------------------ */
const SUITS = {
  standard: { n: 'Standard Voidsuit', hp: 100, air: 100, haz: 0,    armour: 0,     weight: 0,
              d: 'Issue kit. No strengths, no failings, and it has kept you alive so far.' },
  scav:     { n: 'Scavenger Weave',   hp: 80,  air: 90,  haz: -0.1, armour: 0,     weight: -0.18,
              d: 'Patched from three dead suits. Lighter on its feet than issue kit, and noticeably worse at keeping a hostile sky out.' },
  recon:    { n: 'Recon Skin',        hp: 90,  air: 150, haz: 0.15, armour: -0.06, weight: -0.34,
              d: 'A membrane with a big scrubber. You will outrun anything on the ground and regret the first thing that lands a hit.' },
  therm:    { n: 'Thermal Shell',     hp: 140, air: 120, haz: 0.36, armour: 0.12,  weight: 0.26,
              d: 'Layered for heat and cold both. The obvious first upgrade, and you will feel the extra mass in your legs.' },
  void:     { n: 'Void Carapace',     hp: 190, air: 190, haz: 0.58, armour: 0.24,  weight: 0.42,
              d: 'Sealed for the places that are actively trying to get in. Slow, but you can stand in almost anything.' },
  bastion:  { n: 'Bastion Plate',     hp: 320, air: 110, haz: 0.3,  armour: 0.48,  weight: 0.8,
              d: 'Armour first and everything else second. You will walk like you are wading, and you will walk away from things that kill other people.' },
  null_:    { n: 'Null Shroud',       hp: 270, air: 270, haz: 0.86, armour: 0.38,  weight: -0.12,
              d: 'Grown rather than sewn, and it weighs less than the issue suit while doing everything better. Nobody will tell you what it is made of.' }
};
const SUIT_KEYS = Object.keys(SUITS);
function suitDef(k) { return SUITS[k || G.suitKey] || SUITS.standard; }
/* every suit you are carrying, plus the issue kit you can never lose */
function ownedSuits() {
  const out = ['standard'];
  for (const k in G.cargo) if (G.cargo[k] > 0 && MAT[k] && MAT[k].suit && out.indexOf(MAT[k].suit) < 0) out.push(MAT[k].suit);
  return out;
}
/* how much the suit and the weapon in your hands slow you down together */
function carryLoad() {
  return suitDef().weight + (curGun().wt || 0);
}
function walkSpeedMul() { return clamp(1 - carryLoad() * 0.52, 0.34, 1.45); }
function suitArmour() { return clamp(suitDef().armour, -0.5, 0.85); }
function suitHaz() { return clamp(suitDef().haz, -0.6, 0.95); }
/* keep the live pools in step with whatever is being worn */
function syncSuit() {
  const d = suitDef();
  G.suit.max = d.hp + (G.suit.bonus || 0);
  G.suit.airMax = d.air;
  G.suit.hp = clamp(G.suit.hp, 0, G.suit.max);
  G.suit.air = clamp(G.suit.air, 0, G.suit.airMax);
}
function wearSuit(k) {
  if (!SUITS[k]) return false;
  if (ownedSuits().indexOf(k) < 0) { say('You are not carrying that suit.', 'warn'); return false; }
  if (G.suitKey === k) return false;
  G.suitKey = k;
  syncSuit();
  say('Sealed into the ' + SUITS[k].n.toLowerCase() + '.', 'good');
  AU.play('upgrade', 0.6);
  return true;
}

const SLOT_NAMES = { engine: 'Engine', shield: 'Shields', weapon: 'Weapons', cargo: 'Cargo', mining: 'Mining', warp: 'Warp drive', plate: 'Plating', scan: 'Scanner' };

/* ------------------------------------------------------------
   8c. SHIP COMPONENTS
   A ship is four parts bolted together: a hull, a drive, a hold
   and a warp core. Every part carries mass, and mass is the
   price of everything good — a bigger hold and thicker plating
   both make you slower and clumsier. Shields are upgraded
   separately through the shield module slot.
------------------------------------------------------------ */
const PART_SLOTS = {
  hull:  { n: 'Hull',      d: 'Structure and crash tolerance. Heavy.' },
  drive: { n: 'Drive',     d: 'Thrust, top speed and how sharply you turn.' },
  hold:  { n: 'Hold',      d: 'How much cargo you can carry before you have to sell.' },
  warp:  { n: 'Warp core', d: 'Cell capacity and jump range. Also feeds the mining beam.' }
};
const PARTS = {
  /* --- hulls: hull points, crash armour, mass --- */
  h_salvage: { slot: 'hull', n: 'Salvage Spine',    tier: 0, cr: 0,       in: {},                                        hull: 120,  impact: 0.00, mass: 1.5, d: 'Three dead ships welded together. It holds. Mostly.' },
  h_light:   { slot: 'hull', n: 'Ladder Frame',     tier: 1, cr: 26000,   in: { alloy: 6, ferrite: 60 },                 hull: 190,  impact: 0.05, mass: 1.1, slots: 1, d: 'Barely there. Cheap, fragile, and it flies like a dart.' },
  h_plated:  { slot: 'hull', n: 'Plated Keel',      tier: 2, cr: 95000,   in: { alloy: 14, titanium: 20 },               hull: 380,  impact: 0.22, mass: 1.9, slots: 1, d: 'The sensible choice. Survives a bad landing without complaint.' },
  h_bastion: { slot: 'hull', n: 'Bastion Truss',    tier: 3, cr: 410000,  in: { frame: 2, nanotube: 4, titanium: 40 },    hull: 720,  impact: 0.48, mass: 2.8, slots: 2, d: 'Built to be shot at. You will feel every kilo of it in a turn.' },
  h_living:  { slot: 'hull', n: 'Grown Carapace',   tier: 4, cr: 1500000, in: { chitin: 60, nanotube: 8, voidcrystal: 6 },hull: 900,  impact: 0.42, mass: 1.6, slots: 2, regen: 6, d: 'Grown rather than built. Knits its own damage closed between fights.' },
  h_exotic:  { slot: 'hull', n: 'Null Lattice',     tier: 5, cr: 6800000, in: { frame: 6, stellarite: 10, antimatter: 4 },hull: 1400, impact: 0.70, mass: 1.2, slots: 3, d: 'Nobody will tell you what it is made of. It weighs almost nothing and shrugs off railfire.' },

  /* --- drives: thrust, speed, turn, mass --- */
  d_stock:   { slot: 'drive', n: 'Stock Thrusters',  tier: 0, cr: 0,       in: {},                                       thrust: 240, max: 380,  turn: 2.7, mass: 0.6, d: 'Whatever was still bolted on when you woke up.' },
  d_ion:     { slot: 'drive', n: 'Ion Cluster',      tier: 1, cr: 32000,   in: { servo: 2, coolant: 1 },                  thrust: 360, max: 560,  turn: 3.4, mass: 0.7, d: 'Efficient and forgiving. A clear step up from stock.' },
  d_burner:  { slot: 'drive', n: 'Twin Burners',     tier: 2, cr: 145000,  in: { servo: 4, coolant: 3, powercell: 1 },    thrust: 620, max: 760,  turn: 3.1, mass: 1.1, d: 'Enormous straight-line shove. Turns like it resents you.' },
  d_vector:  { slot: 'drive', n: 'Vector Gimbals',   tier: 2, cr: 168000,  in: { servo: 5, circuit: 3, coolant: 2 },      thrust: 470, max: 640,  turn: 5.2, mass: 0.8, d: 'Pivots on a coin. Slower flat out, unbeatable in a knife fight.' },
  d_fusion:  { slot: 'drive', n: 'Fusion Spine',     tier: 3, cr: 620000,  in: { powercell: 3, nanotube: 3, servo: 6 },   thrust: 840, max: 980,  turn: 4.2, mass: 1.3, d: 'Balanced and brutally quick. The drive most captains settle on.' },
  d_singul:  { slot: 'drive', n: 'Collapse Drive',   tier: 5, cr: 4900000, in: { antimatter: 6, lens: 4, powercell: 5 },  thrust: 1250, max: 1420, turn: 5.6, mass: 0.9, d: 'Folds a little space in front of you and falls into it.' },

  /* --- holds: cargo, mass --- */
  c_crate:   { slot: 'hold', n: 'Lashed Crates',     tier: 0, cr: 0,       in: {},                                       cargo: 150,  mass: 0.4, d: 'Cargo netting and hope.' },
  c_stand:   { slot: 'hold', n: 'Standard Bay',      tier: 1, cr: 24000,   in: { alloy: 5, ferrite: 40 },                cargo: 320,  mass: 0.8, d: 'A proper sealed bay. Doubles what you can haul.' },
  c_comp:    { slot: 'hold', n: 'Compressor Bay',    tier: 2, cr: 170000,  in: { alloy: 12, circuit: 3, coolant: 2 },     cargo: 640,  mass: 1.2, d: 'Squeezes ore down on the way in. Heavy machinery, worth it.' },
  c_freight: { slot: 'hold', n: 'Freight Spine',     tier: 3, cr: 700000,  in: { frame: 2, alloy: 30, nanotube: 2 },      cargo: 1500, mass: 2.6, d: 'A warehouse strapped to your ship. You will feel it on every approach.' },
  c_fold:    { slot: 'hold', n: 'Folded Hold',       tier: 5, cr: 5600000, in: { voidcrystal: 12, stellarite: 4, lens: 3 },cargo: 3600, mass: 0.9, d: 'Bigger on the inside, and almost weightless. Do not open it in atmosphere.' },

  /* --- warp cores: cells, warp range, mining --- */
  w_cracked: { slot: 'warp', n: 'Cracked Core',      tier: 0, cr: 0,       in: {},                                       fuel: 100,  warp: 1.0, mine: 1.0, mass: 0.5, d: 'Leaks cells slowly. You have been meaning to fix it.' },
  w_coil:    { slot: 'warp', n: 'Coil Core',         tier: 1, cr: 38000,   in: { coolant: 2, cobalt: 25 },               fuel: 180,  warp: 1.6, mine: 1.3, mass: 0.7, d: 'Reliable. Gets you two systems instead of one.' },
  w_deep:    { slot: 'warp', n: 'Deep Field Core',   tier: 2, cr: 210000,  in: { coolant: 4, powercell: 1, indium: 8 },   fuel: 300,  warp: 2.4, mine: 1.8, mass: 1.0, d: 'Long legs and a hotter mining beam as a side effect.' },
  w_res:     { slot: 'warp', n: 'Resonance Core',    tier: 3, cr: 880000,  in: { lens: 3, powercell: 3, voidcrystal: 3 }, fuel: 520,  warp: 3.6, mine: 2.9, mass: 1.1, d: 'Sings when it spins up. Cuts rock like it is not there.' },
  w_void:    { slot: 'warp', n: 'Void Core',         tier: 5, cr: 7200000, in: { antimatter: 8, stellarite: 6, frame: 3 },fuel: 950,  warp: 5.4, mine: 4.2, mass: 1.4, d: 'Crosses the galaxy on a quarter tank and strips a deposit in seconds.' }
};
let PART_KEYS = Object.keys(PARTS);
const DEFAULT_PARTS = { hull: 'h_salvage', drive: 'd_stock', hold: 'c_crate', warp: 'w_cracked' };

/* ------------------------------------------------------------
   8a-iii. INFINITE PART TIERS
   Every catalogue price below was underpriced for how much credit
   an established captain accumulates, so the whole board is
   doubled once here. Beyond that, nothing in the hangar ever caps
   out at "fully upgraded" — the top tier on record for a slot just
   generates the next one on demand, with cost climbing quadratically
   per tier so a late upgrade is a real investment, not a rounding
   error.
------------------------------------------------------------ */
for (const k of PART_KEYS) PARTS[k].cr = Math.round(PARTS[k].cr * 2);
for (const k of SHIP_KEYS) SHIPS[k].price = Math.round(SHIPS[k].price * 2);
for (const k of MODULE_KEYS) MODULES[k].cr = Math.round(MODULES[k].cr * 2);
/* extend a slot's tier ladder by one, generated from its current top rung */
function extraPartTier(slot, tier) {
  const key = slot + '_gen' + tier;
  if (PARTS[key]) return key;
  const rungs = PART_KEYS.filter(k => PARTS[k].slot === slot);
  const topKey = rungs.reduce((a, k) => (PARTS[k].tier > PARTS[a].tier ? k : a), rungs[0]);
  const t0 = PARTS[topKey];
  const over = tier - t0.tier; /* how many generated rungs past the hand-built top */
  const statMul = Math.pow(1.3, over);          /* stats grow steadily */
  const costMul = Math.pow(over + 1, 2) * 2.4;  /* cost grows quadratically once you're past the hand-built ladder */
  const np = { slot: slot, n: t0.n + ' Mk ' + (tier + 1), tier: tier,
    cr: Math.round(t0.cr * costMul), mass: t0.mass * (1 + over * 0.08),
    d: 'A further refinement forged rather than bought — the yards stopped making these off a catalogue.', in: {} };
  for (const stat of ['hull', 'impact', 'thrust', 'max', 'turn', 'cargo', 'fuel', 'warp', 'mine', 'regen', 'slots']) {
    if (t0[stat] !== undefined) np[stat] = stat === 'slots' ? t0[stat] : Math.round(t0[stat] * statMul * 100) / 100;
  }
  for (const mat in t0.in) np.in[mat] = Math.round(t0.in[mat] * (1 + over * 0.6));
  PARTS[key] = np; PART_KEYS.push(key);
  return key;
}

const PAINTS = ['#9fb3c8','#6fd8ff','#ff6a4d','#6cff8f','#ffc46b','#d484ff','#c0f0ff','#ff9fd0','#8fe09f','#e6ddc8'];

/* ------------------------------------------------------------
   9. STRUCTURES (colony + personal base)
------------------------------------------------------------ */
const BUILDS = {
  habitat:  { n: 'Habitation dome', cr: 6000,    in: { ferrite: 90, silicate: 45 },      pwr: -4,  cap: 260, d: 'Houses colonists. Everything else is decoration without it.' },
  solar:    { n: 'Solar array',     cr: 4500,    in: { silicate: 70, copper: 25 },       pwr: 14,  d: 'Cheap power. Unglamorous but constant.' },
  reactor:  { n: 'Fusion reactor',  cr: 48000,   in: { ferrite: 220, cobalt: 90 },       pwr: 72,  d: 'Powers a dozen structures on its own.' },
  extractor:{ n: 'Auto-extractor',  cr: 14000,   in: { ferrite: 140, copper: 50 },       pwr: -8,  ext: 0.55, d: 'Pulls this planet\u2019s resources into the store while you are away.' },
  farm:     { n: 'Hydroponics bay', cr: 11000,   in: { carbon: 130, oxygen: 70 },        pwr: -5,  grow: 0.4, d: 'Food. Population climbs much faster with it.' },
  refinery: { n: 'Refinery',        cr: 30000,   in: { ferrite: 200, cobalt: 70 },       pwr: -14, ref: 2.2, d: 'Sells stored resources automatically at 80% of market.' },
  tradehub: { n: 'Trade hub',       cr: 140000,  in: { platinum: 70, chromatic: 35 },    pwr: -10, trade: 0.55, d: 'Plugs the colony into the regional economy.' },
  lab:      { n: 'Research spire',  cr: 260000,  in: { emeril: 90, indium: 30 },         pwr: -12, res: 1, d: 'Boosts scan payouts and reveals rarer finds galaxy-wide.' },
  shield:   { n: 'Planetary shield',cr: 200000,  in: { chromatic: 130, indium: 45 },     pwr: -20, def: 1, d: 'Keeps raiders off your population. They do come.' },
  monument: { n: 'Grand monument',  cr: 2800000, in: { voidcrystal: 70, stellarite: 25 },pwr: -6,  prest: 1, d: 'Pure prestige. Raises every dome\u2019s capacity by half again.' },
  /* personal / base pieces */
  plot:     { n: 'Farm plot (6)',   cr: 1200,    in: { ferrite: 20, fibre: 15 },         pwr: 0, plots: 6, personal: true, d: 'Six tilled squares you can plant, water and harvest.' },
  well:     { n: 'Water condenser', cr: 3000,    in: { copper: 25, glass: 4 },           pwr: -1, water: 1, personal: true, d: 'Refills your can automatically each cycle.' },
  beacon:   { n: 'Landing beacon',  cr: 2500,    in: { ferrite: 40, wiring: 2 },         pwr: -1, personal: true, d: 'Marks this spot on the chart and lets you fast-travel here.' },
  storage:  { n: 'Storage vault',   cr: 8000,    in: { alloy: 6, ferrite: 60 },          pwr: -1, store: 400, personal: true, d: 'Off-ship storage. Stash what your hold cannot carry.' },
  workshop: { n: 'Fabricator shed', cr: 16000,   in: { alloy: 8, circuit: 2 },           pwr: -3, craft: 1, personal: true, d: 'Lets you craft and forge alloys while planetside.' },
  turret:   { n: 'Defence turret',  cr: 22000,   in: { servo: 2, alloy: 6, wiring: 4 },  pwr: -4, def: 0.4, personal: true, turret: 1, d: 'Shoots anything hostile that wanders too close.' },
  /* --- civilisation pieces, colony only --- */
  stabiliser:{ n: 'Weather stabiliser', cr: 85000, in: { coolant: 12, circuit: 8, powercell: 2 }, pwr: -18, stab: 1, d: 'Holds the sky still inside one border ring. No hazard, no weather, no suit drain.' },
  wall:     { n: 'Perimeter wall',  cr: 18000,   in: { ferrite: 180, alloy: 8 },        pwr: -1, wall: 1, d: 'A ring segment that raiders have to come through rather than over.' },
  battery:  { n: 'Orbital battery', cr: 460000,  in: { frame: 2, powercell: 4, iridium: 30 }, pwr: -26, def: 2.2, d: 'Answers anything that comes down the gravity well at your colony.' }
};
const BUILD_KEYS = Object.keys(BUILDS);
for (const k of BUILD_KEYS) { BUILDS[k].cr = Math.round(BUILDS[k].cr * 2); BUILDS[k].tier = 1; BUILDS[k].base = k; }

/* ------------------------------------------------------------
   9b. BUILDING TIERS
   Every structure gets two upgraded versions — same footprint, same
   purpose, but built from rarer stock and considerably more capable.
   Tier II and III cost far more in credits and pull in one extra rare
   material apiece; base materials never inflate, they just take more
   of them.
------------------------------------------------------------ */
const BUILD_TIER_MATS = [
  ['platinum', 'chromatic'],       /* tier II: solidly uncommon */
  ['voidcrystal', 'stellarite']    /* tier III: end-game rarities */
];
const BUILD_EFFECT_KEYS = ['pwr','cap','ext','grow','ref','trade','res','def','plots','store','wall','stab'];
const BUILD_BASE_KEYS = BUILD_KEYS.slice(); /* snapshot — BUILD_KEYS itself grows below */
for (const base of BUILD_BASE_KEYS) {
  const d0 = BUILDS[base];
  let prevKey = base;
  for (let tier = 2; tier <= 3; tier++) {
    const key = base + tier;
    const prev = BUILDS[prevKey];
    const rareMat = pick(rng(hash2(base.length * 977, tier * 131 + base.charCodeAt(0), 40009)), BUILD_TIER_MATS[tier - 2]);
    const mul = tier === 2 ? 1.8 : 3.2;
    const crMul = tier === 2 ? 6 : 22; /* "cost way more" — a real jump, not a linear step */
    const inputs = {};
    for (const m in d0.in) inputs[m] = Math.round(d0.in[m] * (tier === 2 ? 1.6 : 2.6));
    inputs[rareMat] = tier === 2 ? ri(rng(hash2(tier, base.charCodeAt(0), 77)), 6, 14) : ri(rng(hash2(tier, base.charCodeAt(0), 88)), 3, 8);
    const nb = { n: d0.n + (tier === 2 ? ' II' : ' III'), cr: Math.round(d0.cr * crMul), in: inputs,
      d: d0.d + (tier === 2 ? ' Reinforced build — noticeably more capable.' : ' The final-form build. Rare stock, dramatically more capable.'),
      personal: d0.personal, tier: tier, base: base, upgradeOf: prevKey };
    for (const ek of BUILD_EFFECT_KEYS) if (d0[ek] !== undefined) nb[ek] = Math.round(d0[ek] * mul * 100) / 100;
    if (d0.turret) nb.turret = 1;
    if (d0.prest) nb.prest = d0.prest * mul;
    BUILDS[key] = nb; BUILD_KEYS.push(key);
    prevKey = key;
  }
}

/* ------------------------------------------------------------
   10. FACTIONS, SPECIES, DIALOGUE
------------------------------------------------------------ */
const FACTIONS = {
  korvax:   { n: 'Korvax Assembly', c: '#6fd8ff', d: 'Machine-minds who catalogue everything and argue about it for centuries.' },
  vykeen:   { n: 'Vy\u2019keen Clans', c: '#ff6a4d', d: 'Warrior clans. They respect a straight answer and a full weapon rack.' },
  gek:      { n: 'Gek Trade Union', c: '#ffc46b', d: 'Merchants to the last. Everything has a price and most of them are negotiable.' },
  free:     { n: 'Free Traders',    c: '#6cff8f', d: 'Independents, smugglers and haulers who answer to nobody in particular.' },
  sentinel: { n: 'Sentinel Watch',  c: '#c0f0ff', d: 'Automated custodians. Polite until you take something they were guarding.' },
  drift:    { n: 'The Drift',       c: '#d484ff', d: 'Nomads born in transit. They have never touched a planet and pity those who have.' },
  outlaw:   { n: 'Outlaw Fringe',   c: '#ff5f8f', d: 'Pirates, wreckers and worse. Reputation with them costs you everywhere else.' },
  none:     { n: 'Unclaimed',       c: '#8fa9b4', d: 'Nobody has filed a claim here. That is either an opportunity or a warning.' }
};
const FACTION_KEYS = Object.keys(FACTIONS);
const SPECIES = [
  { n: 'Korvax',   f: 'korvax',  c: '#6fd8ff', head: 'orb',   d: 'Convergent machine intelligence in a sealed shell.' },
  { n: 'Vy\u2019keen', f: 'vykeen', c: '#ff8a5f', head: 'horn',  d: 'Tall, armoured, direct to the point of bluntness.' },
  { n: 'Gek',      f: 'gek',     c: '#ffd97a', head: 'beak',  d: 'Small, quick, permanently mid-negotiation.' },
  { n: 'Human',    f: 'free',    c: '#ffc4a8', head: 'round', d: 'Mostly harmless. Mostly.' },
  { n: 'Thranx',   f: 'drift',   c: '#d484ff', head: 'crest', d: 'Born in transit, uneasy under open sky.' },
  { n: 'Ossuran',  f: 'free',    c: '#cfe8f5', head: 'tall',  d: 'Long-lived, slow to speak, impossible to rush.' },
  { n: 'Grell',    f: 'outlaw',  c: '#ff5f8f', head: 'wide',  d: 'Fringe stock. Nobody asks where they came from.' }
];
const ROLES = [
  { n: 'Trader',     shop: 'general',  hire: 0,    talk: 'trade' },
  { n: 'Quartermaster', shop: 'ship',  hire: 0,    talk: 'trade' },
  { n: 'Botanist',   shop: 'seed',     hire: 0.5,  talk: 'farm', skill: 'farming' },
  { n: 'Angler',     shop: 'fish',     hire: 0.3,  talk: 'fish' },
  { n: 'Gunsmith',   shop: 'weapon',   hire: 0.2,  talk: 'war' },
  { n: 'Mechanic',   shop: null,       hire: 0.9,  talk: 'work', skill: 'engineering' },
  { n: 'Pilot',      shop: null,       hire: 0.9,  talk: 'work', skill: 'piloting' },
  { n: 'Gunner',     shop: null,       hire: 0.9,  talk: 'war',  skill: 'gunnery' },
  { n: 'Xenologist', shop: null,       hire: 0.7,  talk: 'lore', skill: 'science' },
  { n: 'Farmhand',   shop: null,       hire: 0.9,  talk: 'farm', skill: 'farming' },
  { n: 'Smuggler',   shop: 'black',    hire: 0.4,  talk: 'crime' },
  { n: 'Archivist',  shop: null,       hire: 0.4,  talk: 'lore', skill: 'science' }
];
const SHOP_TYPES = {
  general: { n: 'General store',  pool: ['ferrite','carbon','silicate','oxygen','tritium','ration','medkit','oxtank','glass','wiring','alloy','s_scav'] },
  ship:    { n: 'Ship outfitter', pool: ['alloy','circuit','servo','coolant','powercell','frame','nanotube','s_therm','s_recon'], modules: true },
  seed:    { n: 'Seed merchant',  pool: ['seed_grain','seed_starfruit','seed_lumina','seed_frostmelon','seed_emberpep','seed_gloomcap','seed_voidbloom','hoe','can','fibre'] },
  fish:    { n: 'Fish market',    pool: ['silverfin','glasseel','stonecarp','emberkoi','rod','ration'] },
  weapon:  { n: 'Gunsmith',       pool: ['g_sidearm','g_scatter','g_pulse','g_bomb','g_rail','g_ray','blaster','multitool','iridium','servo','lens','s_bastion'], modules: true },
  black:   { n: 'Black market',   pool: ['relic','glyph','core','antimatter','voidcrystal','stellarite','uranite','s_void','s_null'], markup: 1.45 }
};

/* ------------------------------------------------------------
   10b. VESSEL TIERS
   Four rungs of ship out there, hostile or friendly. A fighter
   is a nuisance. A citadel is a place.
------------------------------------------------------------ */
const VTIERS = {
  /* --- rung one: single seats --- */
  fighter: { n: 'Fighter',      rank: 1, hp: 100,  gun: 10, sp: 420, scale: 0.8,  rad: 34,  guns: ['bolt'],       pay: 4200,   d: 'Single-seat interceptor. Fast, flimsy, everywhere.' },
  seeker:  { n: 'Seeker',       rank: 1, hp: 100,  gun: 10, sp: 390, scale: 0.85, rad: 36,  guns: ['seekpod'],    pay: 5400,   d: 'Carries a rack of homing pods instead of a gun. Lobs one every three seconds and lets it do the aiming.' },

  /* --- rung two: trained crews --- */
  milita:  { n: 'Militia Lance',rank: 2, hp: 1000, gun: 19, sp: 760, scale: 1.05, rad: 46,  guns: ['twin'],       pay: 18000,  d: 'Twin emitters at double the muzzle speed. Flown by people who were trained.' },
  nova:    { n: 'Nova Lance',   rank: 2, hp: 1000, gun: 19, sp: 600, scale: 1.1,  rad: 50,  guns: ['ring16'],     pay: 22000,  d: 'Emitters ringing the whole hull. Every two seconds it throws sixteen bolts outward at once and does not care where you are.' },

  /* --- rung three: carriers --- */
  mother:  { n: 'Mothership',   rank: 3, hp: 10000, gun: 46, sp: 150, scale: 3.4,  rad: 165, guns: ['beam','bolt'],  pay: 220000, summon: [10, 10], summonTier: 'fighter',
             d: 'Carrier hull with a spinal beam. Hostile ones put a fighter in the sky every ten seconds; friendly ones sell you things.' },
  broodmother: { n: 'Brood Carrier', rank: 3, hp: 10000, gun: 46, sp: 150, scale: 3.4, rad: 165, guns: ['swarm','bolt'], pay: 245000, summon: [10, 10], summonTier: 'fighter',
             d: 'The same hull with the beam mount stripped out for missile racks. Five homing rounds every three seconds, and bolt fire in between.' },

  /* --- rung four: planetary scale --- */
  citadel: { n: 'World Bastion', rank: 4, hp: 100000, gun: 70, sp: 44, scale: 9, rad: 460, guns: ['worldlance'], pay: 1800000,
             shieldable: true, forcefield: 500, ffCool: 60,
             waves: [['fighter', 5], ['milita', 15], ['mother', 45]],
             d: 'A city the size of a small world. Threaten it and a forcefield comes up; break the field and it needs a minute to raise another. The spinal lance tracks you before it fires.' },
  warworld:{ n: 'War World',     rank: 4, hp: 100000, gun: 70, sp: 52, scale: 9, rad: 460, guns: ['streamtwin'], pay: 2150000,
             waves: [['fighter', 2.5], ['milita', 7.5], ['mother', 22.5]],
             d: 'The same tonnage with the shield generators torn out and the hangars doubled. No field, no pause in the fire, and it empties its bays twice as fast.' },

  /* --- rung five: the thing that shows up when a whole faction wants you dead --- */
  titan: { n: 'Dreadnought Titan', rank: 5, hp: 1000000, gun: 90, sp: 60, scale: 6.8, rad: 330, guns: ['t5missiles', 't5lance', 'streamtriple'], pay: 40000000,
           summon: [3, 3], summonTier: 'mother',
           d: 'A mothership hull built at twice the scale, with a carrier bay that never stops working, a locked spinal lance, and three streams of cannon fire that do not care where you hide.' }
};
const VTIER_KEYS = Object.keys(VTIERS);
/* rank lookups, so behaviour keys off the rung rather than a ship name */
function tierRank(k) { return (VTIERS[k] || VTIERS.fighter).rank; }
function isRank(t, n) { return t && tierRank(t.tier) === n; }
/* only the bastion is a place you can set down on; the war world is not */
function isLandable(t) { return t && t.tier === 'citadel'; }
const TIER_SHIPS = { citadel: 'singularity', warworld: 'singularity', mother: 'leviathan', broodmother: 'leviathan', milita: 'wraith', nova: 'wraith' };
/* rung one and rung two draw a random hull each time a ship spawns —
   friendly or hostile, it is a coin flip which of that rung's silhouettes
   you are looking at, purely for variety */
const TIER1_SKINS = ['vagrant', 'kestrel', 'interdart'];
const TIER2_SKINS = ['wraith', 'corsair'];
/* the pool a given rung draws from when something bigger calls for help */
const TIER_VARIANTS = { 1: ['fighter', 'seeker'], 2: ['milita', 'nova'], 3: ['mother', 'broodmother'], 4: ['citadel', 'warworld'] };
/* NPC weapon behaviours */
const NPC_GUNS = {
  bolt: { cd: [0.85, 1.55], spd: 1050, dmg: 0.5,  col: '#ff6a4d', n: 1, sz: 3 },
  twin: { cd: [0.55, 0.95], spd: 2100, dmg: 0.42, col: '#ffc46b', n: 2, sz: 3, sep: 13 },
  ray:  { cd: [1.9, 2.8],   spd: 1500, dmg: 0.85, col: '#d484ff', n: 1, sz: 5, pierce: true },
  beam: { cd: [4.5, 7.0],   dmg: 1.9,  col: '#c0f0ff', beam: true, dur: 1.4, width: 9, hitRad: 30 },
  bomb: { cd: [2.6, 4.2],   spd: 460,  dmg: 1.5,  col: '#ff8a5f', n: 1, sz: 6, blast: 240, fuse: 1.6 },

  /* a single homing pod, fired on a fixed three-second rhythm */
  seekpod: { cd: [3, 3], spd: 340, dmg: 1.15, col: '#ff8a5f', n: 1, sz: 5.5,
             blast: 180, fuse: 3, homing: 2.0, accel: 260, maxSpd: 900, missile: true },
  /* sixteen bolts thrown outward at once, every two seconds, aimed at nobody */
  ring16:  { cd: [2, 2], spd: 880, dmg: 0.5, col: '#ffc46b', ring: 16, sz: 3.2 },
  /* five pods at a time from a carrier that gave up its beam for the racks */
  swarm:   { cd: [3, 3], spd: 300, dmg: 0.95, col: '#d484ff', n: 5, sz: 5,
             blast: 160, fuse: 3, homing: 2.3, accel: 240, maxSpd: 860, arc: 1.15, missile: true },
  /* the war world never stops firing: two locked rows, straight down your throat */
  streamtwin: { cd: [0.17, 0.17], spd: 1500, dmg: 0.5, col: '#ff5f8f', n: 2, sz: 4.2, sep: 40 },
  /* the bastion's spinal lance: locks on, charges where you can see it, then
     burns for a full second at three times a mothership beam and four times the width */
  worldlance: { cd: [8.5, 8.5], dmg: 5.7, col: '#ff5f8f', beam: true, dur: 1.0,
                charge: 1.5, width: 44, hitRad: 46, lock: true, contact: true },

  /* --- tier 5 dreadnought weapons --- */
  /* five homing warheads a second, dead on the clock */
  t5missiles: { cd: [0.2, 0.2], spd: 520, dmg: 1.1, col: '#ff8a5f', n: 1, sz: 6,
                blast: 200, fuse: 2.5, homing: 2.4, accel: 320, maxSpd: 1050, missile: true },
  /* a targeted lance: locks on, then fires — bigger and slower than the bastion's */
  t5lance: { cd: [10, 10], dmg: 7.2, col: '#ff5f8f', beam: true, dur: 1.2,
             charge: 1.8, width: 52, hitRad: 54, lock: true, contact: true },
  /* three constant rows of cannon fire, always running */
  streamtriple: { cd: [0.15, 0.15], spd: 1500, dmg: 0.55, col: '#ff5f8f', n: 3, sz: 4.4, sep: 34 }
};

const MOODS = ['guarded','friendly','bored','wary','cheerful','tired','sharp','distracted'];
const GREET = {
  trade: ['Buying or selling? Either way, stand where I can see your hands.',
          'You have the look of someone with a full hold and no patience.',
          'Prices are what they are. Weather changed them twice this morning.',
          'Everything on the rack has a story. The story costs extra.'],
  farm:  ['Soil out here fights you for every root. Worth it though.',
          'If you can keep water in it, this ground will feed a colony.',
          'Planted too early last cycle. Lost the lot. Live and learn.'],
  fish:  ['Water\u2019s been strange lately. Things biting that should not be.',
          'Patience and a decent line. That is the whole trade.',
          'Caught something last week I still cannot name.'],
  war:   ['You carrying? Good. Nothing out here respects an empty holster.',
          'Trouble finds this system about twice a cycle. Be ready.',
          'I have buried better pilots than you for less.'],
  work:  ['I can fly, fix or shoot. Pick one and pay me.',
          'Looking for a berth. Yours look like it has room.',
          'I do not ask questions about cargo. Costs extra if you want me to.'],
  lore:  ['This system is older than the charts admit. Much older.',
          'There are structures down there nobody built in living memory.',
          'Every world remembers something. Most of it we cannot read yet.'],
  crime: ['Keep your voice down and your credits up.',
          'I can get you things that are not technically for sale.',
          'You were never here. Neither was I.']
};
const GOSSIP = [
  'A hauler went missing two jumps spinward. Nobody is looking very hard.',
  'Prices on chromatic are climbing. Somebody is stockpiling.',
  'There is a world out there where the ruins hum at night.',
  'Watch the outer orbits. Pirates have been sitting in the shadow of the gas giants.',
  'A settlement went quiet last cycle. Transponder still running, nobody answering.',
  'Somebody claimed a whole system and named every planet after themselves.',
  'The Sentinels have been more active than usual. Nobody knows why.',
  'Heard a broker is selling an exotic hull with no registry. Could be a trap.',
  'Fish in the northern lakes have started swimming in formation.',
  'A monolith moved. Not far. But it moved.'
];

/* ------------------------------------------------------------
   11. STATE
------------------------------------------------------------ */
const GALSEED = 90210, GAL_CELL = 2600, SURF_CELL = 560;
/* A star system reads as roughly 250 units across on the chart. A collapse
   is ten times that, which is nearly the whole galactic cell. */
const BLACKHOLE_R = 2500;
/* how far out the pull is felt, and how close the point of no return sits */
const BLACKHOLE_REACH = BLACKHOLE_R * 3.0;
const BLACKHOLE_CORE = BLACKHOLE_R * 0.12;
const DAY_LEN = 240; /* seconds per cycle */

const DEFAULT_SET = {
  master: 0.9, music: true, musicVol: 0.7, sfx: true, sfxVol: 0.8,
  quality: 2, shake: true, damageNums: true, hints: true, autosave: true,
  invertY: false, landingAssist: true, crashDamage: true
};

const G = {
  started: false, over: false, t: 0, day: 1, dayT: 0.32,
  mode: 'surface', onFoot: false, tutorial: false, tutStep: 0,
  credits: 1200, cargo: {}, mined: {}, minedN: 0,
  ship: 'vagrant', owned: ['vagrant'], fit: { vagrant: {} }, paint: { vagrant: '#9fb3c8' },
  shipNames: { vagrant: 'The Last Errand' },
  hull: 120, shield: 60, fuel: 26, maxFuelBase: 100,
  suit: { hp: 100, max: 100, air: 100, airMax: 100, bonus: 0 },
  suitKey: 'standard', homeId: '0|0:0',
  crew: [], colonies: {}, bases: {}, farms: {}, stash: {},
  codex: {}, codexN: 0, research: 0, quests: [], questDone: 0,
  rep: {}, relations: {}, knownNpcs: {},
  waypoint: null, waypoints6: {}, thrustersFixed: false, deaths: 0, crashes: 0,
  objIdx: 0, encTimer: 45, raidTimer: 420, hailTimer: 30,
  tools: {}, alloysMade: 0,
  parts: Object.assign({}, DEFAULT_PARTS), ownedParts: {},
  gun: 'fists', gunHeat: 0,
  shipGun: 'bullet', shipWeapons: { bullet: 0 },
  civRel: {}, civState: {}, talkCd: {}, talkGain: {},
  trackMain: {}, trackSide: {}, mainDone: {}, mainIdx: 0,
  citadels: {}, bounty: 0,
  set: Object.assign({}, DEFAULT_SET),
  stat: { mined: 0, jumps: 0, scans: 0, kills: 0, sold: 0, peak: 0, harvest: 0, caught: 0, crafted: 0, talked: 0, docked: false, landed: 0, built: 0 }
};
for (const f of FACTION_KEYS) G.rep[f] = 0;

const P = { x: 0, y: 0, vx: 0, vy: 0, ang: -Math.PI / 2, thrust: 0, boost: 0, walkT: 0, face: 1 };
const cam = { x: 0, y: 0, z: 1, shake: 0 };
let parts = [], bullets = [], hostiles = [], neutrals = [], beams = [], floaters = [], groundFx = [];
const sysCache = new Map();
let surfCache = new Map();
let planet = null, sys = null;
let shipAnchor = null;           /* where the ship sits while you are on foot */
let activeShop = null, activeNpc = null, activeBase = null;

/* --- derived ship stats: parts + fitted modules --- */
function baseShip() { return SHIPS[G.ship] || SHIPS.vagrant; }
function partOf(slot) {
  const k = G.parts && G.parts[slot];
  return PARTS[k] || PARTS[DEFAULT_PARTS[slot]];
}
function partSum(prop) {
  let s = 0;
  for (const slot in DEFAULT_PARTS) { const pt = partOf(slot); if (pt && pt[prop]) s += pt[prop]; }
  return s;
}
function shipMass() { return Math.max(0.5, partSum('mass')); }
/* every module slot on the hull comes from the hull part, plus a base three */
function moduleSlots() { return 3 + partSum('slots'); }
function fitOf(k) { return G.fit[k || G.ship] || {}; }
function modSum(prop, k) {
  let s = 0; const f = fitOf(k);
  for (const slot in f) { const m = MODULES[f[slot]]; if (m && m[prop]) s += m[prop]; }
  return s;
}
function ST() {
  const b = baseShip();
  const hullP = partOf('hull'), drive = partOf('drive'), hold = partOf('hold'), warp = partOf('warp');
  /* mass is the tax on everything good. A light ship above the 3.0 reference
     mass gets a bonus, a heavy one pays for it in thrust and turning rate. */
  const m = shipMass();
  const agility = clamp(3.0 / (m + 1.4), 0.45, 1.5);
  const gfam = curShipGun(), gt = curGunTier();
  return {
    thrust: drive.thrust * agility * (1 + modSum('thrust')),
    max: drive.max * clamp(3.4 / (m + 2.0), 0.55, 1.3) * (1 + modSum('max')),
    turn: drive.turn * agility * (1 + modSum('turn')),
    cargo: Math.round(hold.cargo * (1 + modSum('cargo'))),
    hull: Math.round(hullP.hull * (1 + modSum('hull'))),
    shield: Math.round(60 * (1 + modSum('shield')) + modSum('shieldFlat')),
    regen: 5 + modSum('regen') + (hullP.regen || 0),
    mine: warp.mine * (1 + modSum('mine')) * (1 + crewBonus('engineering') * 0.3),
    warp: warp.warp * (1 + modSum('warp')),
    gun: (6 + modSum('gunFlat')) * (1 + modSum('gun')) * gt.gun * (1 + crewBonus('gunnery') * 0.45),
    rate: (0.16 / (1 + modSum('rate'))) * gt.rate,
    gunType: gfam, gunName: gt.n, gunPierce: !!gt.pierce, gunBlast: gt.blast || 0,
    impact: clamp((hullP.impact || 0) + modSum('impact'), 0, 0.9),
    scan: 1 + modSum('scan') + crewBonus('science') * 0.5,
    mass: m, agility: agility, slots: moduleSlots(),
    col: G.paint[G.ship] || b.col, s: b.s
  };
}
function maxFuel() { return partOf('warp').fuel + modSum('fuel'); }

/* --- personal weapons --- */
function ownedGuns() {
  const out = ['fists'];
  for (const k in G.cargo) if (G.cargo[k] > 0 && MAT[k] && MAT[k].gun && out.indexOf(MAT[k].gun) < 0) out.push(MAT[k].gun);
  if (hasTool('gun') && out.indexOf('sidearm') < 0) out.splice(1, 0, 'sidearm');
  return out;
}
function curGun() {
  /* if you sold or dropped what you were holding, fall back to your hands */
  if (!GUNS[G.gun] || (G.gun !== 'fists' && ownedGuns().indexOf(G.gun) < 0)) G.gun = 'fists';
  return GUNS[G.gun];
}
function cycleGun(dir) {
  const list = ownedGuns();
  let i = list.indexOf(G.gun);
  if (i < 0) i = 0;
  i = (i + (dir || 1) + list.length) % list.length;
  G.gun = list[i];
  say('Drew the ' + GUNS[G.gun].n.toLowerCase() + '.', '');
}
function cargoUsed() { let s = 0; for (const k in G.cargo) s += G.cargo[k]; return s; }
function cargoCap() { return ST().cargo; }
function crewBonus(skill) {
  let s = 0;
  for (const c of G.crew) if (c.skill === skill && c.hp > 0) s += (c.level * (c.morale / 100));
  return s;
}
function hasTool(t) { return !!G.tools[t]; }

/* ------------------------------------------------------------
   12. PROCEDURAL GALAXY
------------------------------------------------------------ */
function systemAt(cx, cy) {
  const key = cx + '|' + cy;
  if (sysCache.has(key)) return sysCache.get(key);
  const h = hash2(cx, cy, GALSEED);
  const r = rng(h);
  const home = (cx === 0 && cy === 0);
  let s = null;

  /* One cell in a thousand (0.1%) that would have held a star holds a
     collapsed one instead. The roll uses its own hash so adding this did
     not reshuffle a single existing system in the galaxy. */
  const hole = !home && (hash2(cx, cy, 0xb1ac01) % 1000) < 1;
  if (hole) {
    const hr = rng(hash2(cx, cy, 0x5171e5));
    const R = BLACKHOLE_R;
    s = {
      key: key, cx: cx, cy: cy, blackhole: true,
      x: cx * GAL_CELL + 0.5 * GAL_CELL,
      y: cy * GAL_CELL + 0.5 * GAL_CELL,
      name: sysName(hr) + ' Collapse',
      r: R, seed: h,
      star: { n: 'Collapsed singularity', c: '#160a26', r: R, t: 9, mass: 40 },
      faction: 'none', danger: 5, wealth: 0, hasStation: false, belt: false,
      scanned: false, planets: [], price: {},
      spin: hr() < 0.5 ? 1 : -1, tilt: hr() * TAU
    };
    for (const k of MAT_KEYS) s.price[k] = 1;
    sysCache.set(key, s);
    return s;
  }

  if (home || r() < 0.6) {
    const STARS = [
      { n: 'Yellow dwarf', c: '#ffe9a8', r: 300, t: 1, mass: 1.0 },
      { n: 'Red giant',    c: '#ff7a5f', r: 440, t: 1, mass: 1.5 },
      { n: 'Blue giant',   c: '#8fc9ff', r: 390, t: 2, mass: 1.8 },
      { n: 'White dwarf',  c: '#eef6ff', r: 200, t: 2, mass: 2.4 },
      { n: 'Orange dwarf', c: '#ffb46b', r: 270, t: 1, mass: 0.9 },
      { n: 'Binary pair',  c: '#c0f0ff', r: 330, t: 3, mass: 2.0 },
      { n: 'Purple giant', c: '#d484ff', r: 410, t: 4, mass: 1.7 },
      { n: 'Neutron star', c: '#ffffff', r: 120, t: 5, mass: 4.0 }
    ];
    const star = home ? STARS[1] : pick(r, STARS);
    const fkeys = FACTION_KEYS.filter(f => f !== 'none');
    s = {
      key: key, cx: cx, cy: cy,
      x: cx * GAL_CELL + rr(r, 0.2, 0.8) * GAL_CELL,
      y: cy * GAL_CELL + rr(r, 0.2, 0.8) * GAL_CELL,
      name: home ? 'Verges' : sysName(r),
      star: star, seed: h,
      faction: home ? 'none' : (r() < 0.14 ? 'none' : pick(r, fkeys)),
      danger: home ? 0 : Math.round(rr(r, 0, 3)),
      wealth: ri(r, 1, 3),
      hasStation: home ? false : r() < 0.58,
      belt: r() < 0.5,
      scanned: false, planets: [], price: {}
    };
    for (const k of MAT_KEYS) s.price[k] = 0.62 + (hash2(h, k.length * 977 + k.charCodeAt(0), 55) / 4294967296) * 0.86;

    const n = home ? 4 : ri(r, 1, 7);
    for (let i = 0; i < n; i++) {
      const ph = hash3(h, i * 7919, 13, 4242);
      const pr = rng(ph);
      const biome = (home && i === 0) ? 'ruined' : pick(pr, BIOME_KEYS);
      const b = BIOMES[biome];
      /* every element, crystal, gas and fuel in the game can turn up as a
         rock deposit on any planet — the biome's own pool just makes those
         materials more likely, it no longer gates them out entirely.
         Each world still only settles on a handful (2-5) of them, so the
         player has to keep moving to complete the set across the galaxy. */
      const pool = b.pool.slice();
      for (const k of ORE_KEYS) if (pool.indexOf(k) < 0 && pr() < 0.16) pool.push(k);
      if (pr() < 0.4) pool.push(pick(pr, ORE_KEYS));
      if (pr() < 0.2) pool.push(pick(pr, ORE_KEYS));
      const res = [];
      const cnt = ri(pr, 2, Math.min(5, pool.length));
      const bag = pool.slice();
      while (res.length < cnt && bag.length) res.push(bag.splice(Math.floor(pr() * bag.length), 1)[0]);
      const rad = rr(pr, 80, 210);
      s.planets.push({
        id: key + ':' + i, sys: key, idx: i, seed: ph,
        name: (home && i === 0) ? 'Verges IV' : pname(pr),
        biome: biome, r: rad, mass: (rad / 110) * (rad / 110) * rr(pr, 0.7, 1.35),
        orbit: 900 + i * rr(pr, 680, 1000),
        phase: pr() * TAU, speed: rr(pr, 0.010, 0.042) * (pr() < 0.5 ? 1 : -1),
        res: (home && i === 0) ? ['ferrite','tritium','silicate','copper','magnetite'] : res,
        scanned: false, moons: ri(pr, 0, 3), rings: pr() < 0.22,
        life: b.life, hazard: b.haz, weather: b.wx,
        rich: (home && i === 0) ? true : pr() < 0.16,
        settled: !home && pr() < 0.42,
        day: rr(pr, 0.6, 1.9)
      });
    }
    if (s.hasStation) { s.stOrbit = 900 + n * 1000 + 600; s.stPhase = r() * TAU; s.stName = settleName(r) + ' Station'; }
    /* 0.3% barbarian spawn chance near star systems */
    if (!home && (hash2(cx, cy, 0xb1ac02) % 1000) < 3) {
      s.barbarianCamp = true;
    }
  }
  sysCache.set(key, s);
  if (sysCache.size > 2600) { const k0 = sysCache.keys().next().value; if (k0 !== '0|0') sysCache.delete(k0); }
  return s;
}
function nearbySystems(wx, wy, cells) {
  const cx = Math.floor(wx / GAL_CELL), cy = Math.floor(wy / GAL_CELL), out = [];
  for (let j = -cells; j <= cells; j++)
    for (let i = -cells; i <= cells; i++) { const s = systemAt(cx + i, cy + j); if (s) out.push(s); }
  return out;
}
function planetById(id) {
  if (!id) return null;
  if (id.indexOf('train') === 0) return id === 'train:1' ? TRAINING_PLANET2 : TRAINING_PLANET;
  if (id.indexOf('city:') === 0) return G.citadels[id] || null;
  const k = id.split(':');
  const c = k[0].split('|');
  const s = systemAt(+c[0], +c[1]);
  return s ? s.planets[+k[1]] : null;
}
function planetPos(pl, t) { const a = pl.phase + t * pl.speed; return [Math.cos(a) * pl.orbit, Math.sin(a) * pl.orbit]; }
function stationPos(s, t) { const a = s.stPhase + t * 0.02; return [Math.cos(a) * s.stOrbit, Math.sin(a) * s.stOrbit]; }

const TRAINING_PLANET = {
  id: 'train:0', sys: 'train', idx: 0, seed: 777001, name: 'Cadet Field',
  biome: 'training', r: 140, mass: 1, orbit: 1400, phase: 0, speed: 0.02,
  res: ['ferrite','tritium','fibre','silicate'], scanned: false, moons: 1, rings: false,
  life: 'Managed', hazard: 0, weather: ['clear skies'], rich: true, settled: true, day: 1
};
/* a second, unclaimed world in the same safe range — purely so the
   "colonize another planet" tutorial step has somewhere to land */
const TRAINING_PLANET2 = {
  id: 'train:1', sys: 'train', idx: 1, seed: 777002, name: 'Annex Field',
  biome: 'barren', r: 120, mass: 0.9, orbit: 2400, phase: 2.1, speed: 0.017,
  res: ['ferrite','silicate','copper','magnetite'], scanned: false, moons: 0, rings: false,
  life: 'None', hazard: 0, weather: ['clear skies'], rich: false, settled: false, day: 1
};

/* ------------------------------------------------------------
   13. PLANET SURFACE GENERATION
------------------------------------------------------------ */
function surfCell(pl, cx, cy) {
  const key = cx + '|' + cy;
  let c = surfCache.get(key);
  if (c) return c;
  if (pl.citadel) { c = cityCell(pl, cx, cy); surfCache.set(key, c); return c; }
  const r = rng(hash2(cx, cy, pl.seed));
  const b = BIOMES[pl.biome];
  const ox = cx * SURF_CELL, oy = cy * SURF_CELL;
  const rocks = [], flora = [], deps = [], crits = [], nodes = [];
  let lake = null, settlement = null, struct = null;

  /* terrain elevation from noise gives shading and mountain silhouettes */
  const elev = fbm(cx * 0.17, cy * 0.17, pl.seed, 3);

  /* lakes */
  if (b.water > 0) {
    const w = fbm(cx * 0.09 + 40, cy * 0.09 - 17, pl.seed ^ 0x5eed, 2);
    if (w > 1 - b.water * 0.55) lake = { x: ox + rr(r, 0.25, 0.75) * SURF_CELL, y: oy + rr(r, 0.25, 0.75) * SURF_CELL, r: rr(r, 130, 290) };
  }
  for (let i = 0, n = ri(r, 3, 7); i < n; i++)
    rocks.push({ x: ox + r() * SURF_CELL, y: oy + r() * SURF_CELL, r: rr(r, 12, 58), s: ri(r, 5, 8), a: r() * TAU, e: elev });
  for (let i = 0, n = Math.round(b.flora * ri(r, 2, 11)); i < n; i++)
    flora.push({ x: ox + r() * SURF_CELL, y: oy + r() * SURF_CELL, r: rr(r, 7, 24), t: ri(r, 0, 3), sw: r() * TAU });

  /* mineral deposits (ship laser) */
  if (r() < (pl.rich ? 0.82 : 0.58)) {
    for (let i = 0, n = ri(r, 1, 3); i < n; i++) {
      const res = pick(r, pl.res);
      const k = pl.id + '|' + cx + '|' + cy + '|' + i;
      let amt = Math.round(rr(r, 120, 320) / (1 + MAT[res].t * 0.35));
      if (G.mined[k] !== undefined) amt = G.mined[k];
      deps.push({ k: k, x: ox + r() * SURF_CELL, y: oy + r() * SURF_CELL, res: res, amt: amt, max: Math.max(1, amt), rad: rr(r, 24, 44), a: r() * TAU });
    }
  }
  /* small nodes (hand tool) — plants, gas pockets, scrap */
  for (let i = 0, n = ri(r, 2, 5); i < n; i++) {
    const roll = r();
    let res;
    if (roll < 0.3 && b.flora > 0.1) res = pick(r, ['fibre', 'mold', 'resin', 'algae']);
    else if (roll < 0.5) res = pick(r, ['oxygen', 'hydrogen', 'nitrogen']);
    else res = pick(r, pl.res);
    const k = pl.id + '|n' + cx + '|' + cy + '|' + i;
    let amt = ri(r, 4, 14);
    if (G.mined[k] !== undefined) amt = G.mined[k];
    nodes.push({ k: k, x: ox + r() * SURF_CELL, y: oy + r() * SURF_CELL, res: res, amt: amt, rad: 16, a: r() * TAU });
  }
  /* creatures */
  if (b.life !== 'None') {
    for (let i = 0, n = ri(r, 0, 2); i < n; i++) {
      if (r() > 0.45) continue;
      crits.push(makeCreature(rng(hash3(cx, cy, i * 97, pl.seed ^ 0xbeef)), pl, ox + r() * SURF_CELL, oy + r() * SURF_CELL, cx, cy, i));
    }
  }
  /* settlement — deliberately rare. You have to go looking. */
  if (pl.settled && r() < 0.0055) settlement = makeSettlement(rng(hash2(cx, cy, pl.seed ^ 0x51717)), pl, ox + SURF_CELL / 2, oy + SURF_CELL / 2, cx, cy);
  /* rare barbarian camp - aggressive civilization */
  if (!settlement && !pl.settled && r() < 0.003) {
    settlement = makeSettlement(rng(hash2(cx, cy, pl.seed ^ 0x8b8b8)), pl, ox + SURF_CELL / 2, oy + SURF_CELL / 2, cx, cy);
    settlement.hostile = true;
    settlement.barbarian = true;
    for (const npc of settlement.npcs) {
      npc.hostile = true;
      npc.weapon = pick(rng(hash2(cx, cy, npc.id)), ['bolt','ray','bomb']);
      npc.dmg = 15 + npc.level * 8;
    }
  }
  /* ancient structure */
  if (!settlement && r() < 0.045) {
    const stype = pick(r, ['monolith','ruin','wreck','beacon','cache']);
    const sx = ox + r() * SURF_CELL, sy = oy + r() * SURF_CELL;
    const A = STRUCT_ANCHOR[stype];
    struct = { x: sx, y: sy, ax: sx + A.ax, ay: sy + A.ay, irad: A.irad, t: stype,
               id: pl.id + '|s' + cx + '|' + cy, used: !!G.mined[pl.id + '|s' + cx + '|' + cy] };
  }

  /* the occasional person out on their own, miles from anywhere */
  let wanderer = null;
  if (!settlement && b.life !== 'None' && r() < 0.022) {
    const wr = rng(hash2(cx, cy, pl.seed ^ 0x77a1));
    const role = pick(wr, ROLES);
    wanderer = makeNpc(wr, role, sysFactionOf(pl), ox + rr(wr, 0.2, 0.8) * SURF_CELL, oy + rr(wr, 0.2, 0.8) * SURF_CELL,
      pl.id + '|w' + cx + '|' + cy);
    wanderer.wanderer = true;
    wanderer.shop = wr() < 0.4 ? role.shop : null;
    if (G.civState['wdead:' + wanderer.id]) wanderer.dead = true;
  }

  c = { rocks, flora, deps, nodes, crits, struct, lake, settlement, wanderer, elev };
  surfCache.set(key, c);
  if (surfCache.size > 1200) surfCache.delete(surfCache.keys().next().value);
  return c;
}
/* The deck of a floating city: plating, stacked housing, and people
   everywhere. There is no wilderness on one of these. */
function cityCell(pl, cx, cy) {
  const r = rng(hash2(cx, cy, pl.seed ^ 0xc17));
  const ox = cx * SURF_CELL, oy = cy * SURF_CELL;
  const rocks = [], flora = [], deps = [], crits = [], nodes = [];
  /* scrap and salvage instead of ore */
  for (let i = 0, n = ri(r, 1, 3); i < n; i++) {
    const k = pl.id + '|n' + cx + '|' + cy + '|' + i;
    let amt = ri(r, 4, 12);
    if (G.mined[k] !== undefined) amt = G.mined[k];
    nodes.push({ k: k, x: ox + r() * SURF_CELL, y: oy + r() * SURF_CELL,
      res: pick(r, ['ferrite','alloy','wiring','glass','circuit']), amt: amt, rad: 16, a: r() * TAU });
  }
  /* every cell is inhabited — this is the whole point of the place */
  const st = makeSettlement(rng(hash2(cx, cy, pl.seed ^ 0x51717)), pl,
    ox + SURF_CELL / 2, oy + SURF_CELL / 2, cx, cy);
  /* every cell of a city is populated, so each block has to stay small or
     the deck ends up with a thousand people walking around on it */
  st.huts = st.huts.slice(0, ri(r, 3, 5));
  st.npcs = st.npcs.slice(0, ri(r, 2, 4));
  st.city = true;
  st.name = pl.name + ' · ' + ['Spine','Undermarket','Terrace','Gallery','Rookery','Dock row','The Rings'][Math.abs(hash2(cx, cy, 11)) % 7];
  /* the city's mood is the city's mood, everywhere on it at once */
  if (pl.cityHostile) { st.hostile = true; st.alert = 999; for (const n of st.npcs) { n.state = 'fight'; n.alertT = 999; if (!n.weapon) n.weapon = 'bolt'; } }
  return { rocks, flora, deps, nodes, crits, struct: null, lake: null, settlement: st, wanderer: null, elev: 0.5 };
}

function surfAround(pl, x, y, rad) {
  const cx = Math.floor(x / SURF_CELL), cy = Math.floor(y / SURF_CELL), out = [];
  for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) out.push(surfCell(pl, cx + i, cy + j));
  return out;
}

/* Interaction anchors. Each structure is drawn around its origin
   asymmetrically, so measuring range from the origin put the "you can
   reach this" circle off to one side of the thing you were looking at.
   ax/ay move the circle onto the visible mass of the structure. */
const STRUCT_ANCHOR = {
  monolith: { ax: 0, ay: -9,  irad: 78 },
  beacon:   { ax: 0, ay: -16, irad: 74 },
  wreck:    { ax: -1, ay: 3,  irad: 90 },
  cache:    { ax: 0, ay: 0,   irad: 62 },
  ruin:     { ax: 0, ay: 0,   irad: 96 }
};
function structAnchor(s) {
  if (s.ax === undefined) { const A = STRUCT_ANCHOR[s.t] || STRUCT_ANCHOR.cache; s.ax = s.x + A.ax; s.ay = s.y + A.ay; s.irad = A.irad; }
  return s;
}

/* --- creatures with their own temperament and AI --- */
const TEMPERS = [
  { k: 'passive',   w: 34, d: 'Ignores you entirely.' },
  { k: 'skittish',  w: 24, d: 'Bolts the moment you get close.' },
  { k: 'curious',   w: 14, d: 'Follows at a distance. Harmless.' },
  { k: 'neutral',   w: 12, d: 'Leaves you alone unless you strike first.' },
  { k: 'aggressive',w: 11, d: 'Charges on sight.' },
  { k: 'predator',  w: 5,  d: 'Hunts. Fast, and it does not give up.' },
  /* a third, much rarer aggressive archetype: enormous, lobs bombs in three
     directions at once from range, then closes in to finish the job */
  { k: 'behemoth',  w: 0.4, d: 'Huge. Throws bombs in three directions and closes in once you are close.' }
];
function weighted(r, table) {
  let tot = 0; for (const t of table) tot += t.w;
  let x = r() * tot;
  for (const t of table) { x -= t.w; if (x <= 0) return t; }
  return table[table.length - 1];
}
function makeCreature(r, pl, x, y, cx, cy, i) {
  const b = BIOMES[pl.biome];
  const temper = weighted(r, TEMPERS);
  const behemoth = temper.k === 'behemoth';
  const sz = behemoth ? rr(r, 46, 60) : rr(r, 9, 26) * (temper.k === 'predator' ? 1.5 : 1);
  const drops = [];
  if (b.flora > 0.2) drops.push('fibre');
  drops.push(pick(r, ['chitin', 'bone', 'leather', 'mold']));
  if (r() < 0.2) drops.push(pick(r, pl.res));
  if (behemoth) drops.push(pick(r, pl.res), pick(r, pl.res));
  return {
    id: pl.id + '|c' + cx + '|' + cy + '|' + i,
    name: creatureName(r), temper: temper.k, tdesc: temper.d,
    hx: x, hy: y, x: x, y: y, vx: 0, vy: 0,
    sz: sz, legs: behemoth ? 6 : ri(r, 2, 6), col: b.acc, eye: r() < 0.5 ? '#fff' : b.acc,
    hp: behemoth ? 1400 : Math.round(20 + sz * 3.4), max: behemoth ? 1400 : Math.round(20 + sz * 3.4),
    sp: behemoth ? rr(r, 34, 48) : rr(r, 30, 95) * (temper.k === 'predator' ? 1.7 : temper.k === 'skittish' ? 1.5 : 1),
    rad: rr(r, 60, 220), ph: r() * TAU, state: 'wander', t: 0,
    dmg: behemoth ? 50 : temper.k === 'predator' ? 14 : temper.k === 'aggressive' ? 8 : 3,
    drops: drops, scanned: false, tamed: false, body: ri(r, 0, 3), bombCd: rr(r, 1, 2.5)
  };
}

/* A system belongs to somebody, and everyone living in it belongs to them
   too. You do not find a Gek market halfway up a Vy'keen world. */
function sysFactionOf(pl) {
  if (!pl || !pl.sys) return 'free';
  if (pl.sys === 'train') return 'free';
  const c = pl.sys.split('|');
  const s = systemAt(+c[0], +c[1]);
  if (!s) return 'free';
  if (s.faction && s.faction !== 'none') return s.faction;
  /* unclaimed space still gets a consistent resident population */
  const fkeys = FACTION_KEYS.filter(f => f !== 'none' && f !== 'sentinel');
  return fkeys[hash2(s.cx, s.cy, 0x5e77) % fkeys.length];
}

/* --- settlements: buildings, people, shops, and a militia --- */
function makeSettlement(r, pl, x, y, cx, cy) {
  const fac = sysFactionOf(pl);
  const size = ri(r, 4, 9);
  const id = pl.id + '|st' + cx + '|' + cy;
  const mem = G.civState[id] || {};
  const huts = [];
  for (let i = 0; i < size; i++) {
    const a = (i / size) * TAU + rr(r, -0.3, 0.3), d = rr(r, 120, 300);
    const hp = Math.round(rr(r, 260, 520));
    huts.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, w: rr(r, 50, 92), h: rr(r, 40, 72), t: ri(r, 0, 2),
                i: i, hp: (mem.hut && mem.hut[i] !== undefined) ? mem.hut[i] : hp, max: hp,
                dead: !!(mem.hut && mem.hut[i] <= 0) });
  }
  const npcs = [];
  const nRoles = shuffle(r, ROLES).slice(0, ri(r, 3, 7));
  for (let i = 0; i < nRoles.length; i++) {
    const a = (i / nRoles.length) * TAU + 0.6, d = rr(r, 70, 200);
    const n = makeNpc(rng(hash3(cx, cy, i * 131, pl.seed ^ 0x99ff)), nRoles[i], fac,
      x + Math.cos(a) * d, y + Math.sin(a) * d, id + '|npc' + i);
    n.home = id;
    if (mem.npcDead && mem.npcDead[n.id]) n.dead = true;
    npcs.push(n);
  }
  /* walls only go up once a place has decided it does not trust you */
  const walls = [];
  if (mem.walls) for (let i = 0; i < mem.walls; i++) {
    const a = (i / mem.walls) * TAU;
    walls.push({ x: x + Math.cos(a) * 340, y: y + Math.sin(a) * 340, a: a, hp: 600, max: 600 });
  }
  return { id: id, name: mem.name || settleName(r), fac: fac, x: x, y: y, r: 340,
    huts: huts, npcs: npcs, walls: walls,
    razed: !!mem.razed, alert: 0, hostile: false, bombCd: rr(r, 3, 7),
    stockSeed: (r() * 1e9) | 0,
    pad: { x: x + rr(r, -60, 60), y: y + 300 } };
}
function makeNpc(r, role, fac, x, y, id) {
  const spec = r() < 0.86 ? (SPECIES.find(s => s.f === fac) || pick(r, SPECIES)) : pick(r, SPECIES);
  const lvl = ri(r, 1, 4);
  const hp = Math.round(70 + lvl * 34);
  /* who is actually armed, and with what */
  const armed = role.talk === 'war' || role.talk === 'crime' || r() < 0.45;
  return {
    id: id, name: personName(r), role: role.n, roleDef: role, spec: spec.n, head: spec.head, col: spec.c,
    fac: fac, mood: pick(r, MOODS), x: x, y: y, hx: x, hy: y, ph: r() * TAU,
    shop: role.shop, skill: role.skill || null, level: lvl,
    hire: role.hire, wage: Math.round(rr(r, 10000, 30000) + (lvl - 1) * 23333),
    seed: (r() * 1e9) | 0, greeted: false, fearful: r() < 0.5,
    hp: hp, max: hp, dead: false, state: 'idle', cd: rr(r, 0.3, 1.4), alertT: 0,
    weapon: armed ? pick(r, lvl >= 3 ? ['bolt','ray','bomb'] : ['bolt','bolt','ray']) : null,
    dmg: 7 + lvl * 5,
    /* a wandering NPC will consider a berth; a shopkeeper mostly will not */
    wanderer: false,
    likes: pick(r, ['starfruit','emberkoi','relic','lumina','glasseel','frostmelon','quartz','pollen'])
  };
}

/* --- settlement standing, separate from the faction as a whole --- */
function civMem(st) {
  if (!G.civState[st.id]) G.civState[st.id] = { hut: {}, npcDead: {}, walls: 0, name: st.name, rel: 0 };
  return G.civState[st.id];
}
function civRel(st) {
  const m = civMem(st);
  return clamp((m.rel || 0) + (G.rep[st.fac] || 0) * 0.5, -100, 100);
}
function civBump(st, n) {
  const m = civMem(st);
  m.rel = clamp((m.rel || 0) + n, -100, 100);
}
function civMood(st) {
  const v = civRel(st);
  return v >= 45 ? 'allied' : v >= 15 ? 'warm' : v > -20 ? 'wary' : v > -55 ? 'cold' : 'hostile';
}

/* --- space traffic --- */
const AI_KINDS = [
  { k: 'trader',  w: 30, hostile: false },
  { k: 'patrol',  w: 16, hostile: false },
  { k: 'wanderer',w: 16, hostile: false },
  { k: 'follower',w: 12, hostile: false },
  { k: 'miner',   w: 12, hostile: false },
  { k: 'pirate',  w: 14, hostile: true }
];
/* How far out of the system you are decides what finds you. The inner
   orbits are patrolled and dull; the dark past the last planet is where
   the heavy hulls sit waiting. */
function systemEdge(s) {
  if (!s || !s.planets || !s.planets.length) return 3000;
  return s.planets[s.planets.length - 1].orbit + 900;
}
function rimFactor(s, x, y) {
  const d = Math.hypot(x, y);
  return clamp(d / systemEdge(s), 0, 3.2);
}
function rollTier(r, rim, danger) {
  /* rim 0 = on top of the star, 1 = the outermost orbit, >1 = the dark.
     Weight climbs with the square of how far out you have drifted, so the
     inner system stays survivable and the deep dark does not. */
  const out = clamp(rim - 0.6, 0, 2.6);
  const heavy = clamp(out * out * 0.34 + danger * 0.06, 0, 0.95);
  const x = r();
  let rung;
  if (x < heavy * 0.06) rung = 4;
  else if (x < heavy * 0.26) rung = 3;
  else if (x < 0.18 + heavy * 0.52) rung = 2;
  else rung = 1;
  return pick(r, TIER_VARIANTS[rung]);
}
function makeTraffic(r, s, x, y, opts) {
  opts = opts || {};
  const kindDef = weighted(r, AI_KINDS);
  let kind = opts.kind || kindDef.k;
  const rim = opts.rim === undefined ? rimFactor(s, x, y) : opts.rim;
  const danger = s ? (s.danger || 0) : 1;
  /* the inner system is policed, so pirates only really own the rim */
  if (s && s.danger === 0 && rim < 1 && kind === 'pirate' && !opts.force) kind = 'trader';
  const tierKey = opts.tier || rollTier(r, rim, danger);
  const T = VTIERS[tierKey] || VTIERS.fighter;
  const shipKey = tierRank(tierKey) === 1 ? pick(r, TIER1_SKINS)
    : tierRank(tierKey) === 2 ? pick(r, TIER2_SKINS)
    : (TIER_SHIPS[tierKey] || pick(r, ['vagrant', 'kestrel', 'wraith', 'nomad']));
  const b = SHIPS[shipKey];
  const fkeys = FACTION_KEYS.filter(f => f !== 'none');
  /* a system with an owner is flown almost entirely by that owner */
  let fac = opts.fac;
  if (!fac) {
    if (kind === 'pirate') fac = 'outlaw';
    else if (s && s.faction && s.faction !== 'none') fac = (r() < 0.86 ? s.faction : pick(r, fkeys));
    else fac = pick(r, fkeys);
  }
  const hostile = opts.hostile !== undefined ? opts.hostile : (kind === 'pirate');
  /* past the outermost orbit, nobody claims the ship traffic — it is
     barbaric, unaffiliated raiding rather than any faction's navy, so
     fighting it never moves your standing with anybody */
  const barbaric = rim >= 1 && kind === 'pirate';
  /* AI archetypes: defensive, offensive, common, progressive, brutality (1 in 5 chance each) */
  const archetypes = ['defensive', 'offensive', 'common', 'progressive', 'brutality'];
  const archetype = archetypes[Math.floor(Math.random() * 5)];
  const guns = T.guns.slice();
  if (tierKey === 'fighter' && r() < 0.18) guns[0] = 'ray';
  /* the listed hull figure is the figure — no random spread on it, so a
     fighter is always 50 and a bastion is always 25,000 */
  const hp = T.hp;
  return {
    id: 'tr' + ((r() * 1e9) | 0), kind: kind, tier: tierKey, name: tierKey === 'citadel' ? settleName(r) + ' Reach' : tierKey === 'warworld' ? settleName(r) + ' Ascendant' : shipName(r),
    capt: personName(r), fac: fac === 'none' ? pick(r, fkeys) : fac,
    shipKey: shipKey, col: hostile ? '#ff6a4d' : b.col, shape: b.s,
    x: x, y: y, vx: 0, vy: 0, ang: r() * TAU,
    hp: hp, max: hp, sp: T.sp * rr(r, 0.85, 1.15), rad: T.rad, scale: T.scale,
    gun: T.gun * rr(r, 0.8, 1.2) * (1 + danger * 0.1), cd: rr(r, 0.5, 2),
    guns: guns, gi: 0, beamT: 0, beamAng: 0, chargeT: 0, lockAng: 0,
    summonCd: T.summon ? rr(r, T.summon[0], T.summon[1]) : 0, brood: 0,
    /* a rung-four hull runs its hangars on three independent clocks */
    waveCd: T.waves ? T.waves.map(w => w[1] * rr(r, 0.4, 1)) : null,
    /* the forcefield is a flat pool that only exists once something threatens it */
    barrier: 0, barrierMax: T.forcefield || 0, ffDown: 0, ffSeen: false,
    ally: false, foe: null, foeT: 0,
    state: hostile ? 'hunt' : 'cruise', t: 0, hostile: hostile,
    tx: x + rr(r, -3000, 3000), ty: y + rr(r, -3000, 3000),
    hailed: false, cargo: pick(r, MAT_KEYS), mood: pick(r, MOODS), scanned: false, barbaric: barbaric,
    /* a fixed personal archetype for how this captain reacts to a threat —
       decided once at spawn, not re-rolled every time you lean on them */
    fearful: r() < 0.5,
    /* an NPC's opinion of where the money is must not change every time
       you ask them — bake it in when the ship is created */
    tipSeed: (r() * 1e9) | 0,
    stock: null,
    archetype: archetype
  };
}

/* ------------------------------------------------------------
   14. INVENTORY, LOG, FEEDBACK
------------------------------------------------------------ */
function addRes(k, n) {
  if (!MAT[k]) return 0;
  const free = cargoCap() - cargoUsed();
  const take = Math.min(n, free);
  if (take <= 0) return 0;
  G.cargo[k] = (G.cargo[k] || 0) + take;
  if (MAT[k].tool) G.tools[MAT[k].tool] = true;
  /* draw the first real weapon you acquire rather than leaving you empty-handed */
  if (MAT[k].gun && G.gun === 'fists') { G.gun = MAT[k].gun; say('Drew the ' + GUNS[G.gun].n.toLowerCase() + '.', ''); }
  /* likewise, the first real suit you come by goes straight on */
  if (MAT[k].suit && G.suitKey === 'standard') wearSuit(MAT[k].suit);
  return take;
}
function takeRes(k, n) {
  if ((G.cargo[k] || 0) < n - 1e-9) return false;
  G.cargo[k] -= n; if (G.cargo[k] <= 0.0001) delete G.cargo[k];
  return true;
}
function hasAll(costs) { for (const k in costs) if ((G.cargo[k] || 0) < costs[k]) return false; return true; }
function payAll(costs) { for (const k in costs) takeRes(k, costs[k]); }
function priceOf(k, s) {
  const m = MAT[k]; if (!m) return 0;
  return Math.max(1, Math.round(m.v * ((s && s.price[k]) || 1)));
}
function refreshTools() {
  G.tools = {};
  for (const k in G.cargo) if (MAT[k] && MAT[k].tool && G.cargo[k] > 0) G.tools[MAT[k].tool] = true;
}

const logEl = document.getElementById('log');
function say(msg, kind) {
  const d = document.createElement('div');
  d.className = 'logline ' + (kind || '');
  d.textContent = msg;
  logEl.appendChild(d);
  while (logEl.children.length > 6) logEl.removeChild(logEl.firstChild);
  setTimeout(() => { d.classList.add('fade'); setTimeout(() => { if (d.parentNode) d.remove(); }, 900); }, 6500);
}
function float(x, y, text, col) {
  if (!G.set.damageNums) return;
  floaters.push({ x: x, y: y, t: 0, m: 1.1, s: text, c: col || '#ffc46b' });
  if (floaters.length > 40) floaters.shift();
}
function boom(x, y, n, col, spd) {
  const q = G.set.quality;
  n = Math.round(n * (q === 0 ? 0.35 : q === 1 ? 0.7 : 1));
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = Math.random() * (spd || 180);
    parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 0, m: 0.4 + Math.random() * 0.7, c: col, sz: 1 + Math.random() * 2.6 });
  }
}
const flashEl = document.getElementById('flash');
function screenFlash(heal) {
  flashEl.className = heal ? 'heal on' : 'on';
  setTimeout(() => { flashEl.className = heal ? 'heal' : ''; }, 40);
}

/* ------------------------------------------------------------
   15. CODEX + REPUTATION + QUESTS
------------------------------------------------------------ */
function discover(id, title, kind, detail, reward) {
  if (G.codex[id]) return false;
  G.codex[id] = { t: title, k: kind, d: detail, at: G.day };
  G.codexN++;
  const pay = Math.round((reward || 2000) * ST().scan);
  G.credits += pay;
  say('Logged: ' + title + '  (+' + fmt(pay) + ' units)', 'rare');
  return true;
}
function repChange(fac, n) {
  if (!fac || fac === 'none' || !(fac in G.rep)) return;
  const before = G.rep[fac];
  G.rep[fac] = clamp(G.rep[fac] + n, -100, 100);
  const moved = G.rep[fac] - before;
  /* standing moves in small steps now, so report it to one decimal and keep
     quiet about changes too small to matter */
  if (Math.abs(moved) >= 0.05)
    say(FACTIONS[fac].n + ' standing ' + (moved > 0 ? 'up' : 'down') + ' ' +
      Math.abs(moved).toFixed(Math.abs(moved) < 1 ? 1 : 0) + ' (' + G.rep[fac].toFixed(1) + ')', moved > 0 ? 'good' : 'warn');
}
function repTitle(v) {
  if (v >= 75) return 'Honoured'; if (v >= 40) return 'Trusted'; if (v >= 15) return 'Friendly';
  if (v > -15) return 'Neutral'; if (v > -40) return 'Disliked'; if (v > -75) return 'Hostile'; return 'Kill on sight';
}
const QUEST_TYPES = [
  { k: 'deliver', mk: (r, s) => { const m = pick(r, ['ferrite','copper','cobalt','platinum','emeril','chromatic','grain','silverfin','alloy','circuit']); const n = ri(r, 25, 140);
      return { t: 'Deliver ' + n + ' ' + MAT[m].n, need: { m: m, n: n }, pay: Math.round(MAT[m].v * n * rr(r, 1.5, 2.3) + 4000), kind: 'deliver' }; } },
  { k: 'hunt',    mk: (r, s) => { const n = ri(r, 2, 6);
      return { t: 'Destroy ' + n + ' hostile ships', need: { kills: n, at: G.stat.kills }, pay: Math.round(rr(r, 9000, 30000) * n), kind: 'hunt' }; } },
  { k: 'survey',  mk: (r, s) => { const n = ri(r, 2, 5);
      return { t: 'Scan ' + n + ' unrecorded worlds', need: { scans: n, at: G.stat.scans }, pay: Math.round(rr(r, 8000, 22000) * n), kind: 'survey' }; } },
  { k: 'harvest', mk: (r, s) => { const n = ri(r, 8, 30);
      return { t: 'Bring in ' + n + ' harvested crops', need: { harvest: n, at: G.stat.harvest }, pay: Math.round(rr(r, 900, 2400) * n), kind: 'harvest' }; } },
  { k: 'catch',   mk: (r, s) => { const n = ri(r, 3, 12);
      return { t: 'Land ' + n + ' fish', need: { caught: n, at: G.stat.caught }, pay: Math.round(rr(r, 1800, 4200) * n), kind: 'catch' }; } }
];
function makeQuest(r, fac, giver) {
  const type = pick(r, QUEST_TYPES);
  const q = type.mk(r, sys);
  q.id = 'q' + ((r() * 1e9) | 0);
  q.fac = fac; q.giver = giver; q.done = false; q.rep = ri(r, 4, 12);
  return q;
}
function questProgress(q) {
  if (q.kind === 'deliver') return [Math.min(G.cargo[q.need.m] || 0, q.need.n), q.need.n];
  if (q.kind === 'hunt') return [Math.min(G.stat.kills - q.need.at, q.need.kills), q.need.kills];
  if (q.kind === 'survey') return [Math.min(G.stat.scans - q.need.at, q.need.scans), q.need.scans];
  if (q.kind === 'harvest') return [Math.min(G.stat.harvest - q.need.at, q.need.harvest), q.need.harvest];
  if (q.kind === 'catch') return [Math.min(G.stat.caught - q.need.at, q.need.caught), q.need.caught];
  return [0, 1];
}
function questReady(q) { const p = questProgress(q); return p[0] >= p[1]; }
function turnInQuest(q) {
  if (!questReady(q) || q.done) return false;
  if (q.kind === 'deliver') takeRes(q.need.m, q.need.n);
  q.done = true; G.questDone++;
  G.credits += q.pay; repChange(q.fac, q.rep);
  AU.play('buy');
  say('Contract complete: ' + q.t + '  (+' + fmt(q.pay) + ' units)', 'good');
  G.quests = G.quests.filter(x => x !== q);
  return true;
}

/* ------------------------------------------------------------
   16. COLONIES, BASES, FARMS, ECONOMY
------------------------------------------------------------ */
function claimCost() { return 40000 * Math.pow(2.1, Object.keys(G.colonies).length); }
function claimPlanet() {
  if (!planet) return;
  if (G.colonies[planet.id]) { say('You already own this world.', 'warn'); return; }
  const c = claimCost();
  if (G.credits < c) { say('Claim beacon costs ' + fmt(c) + ' units. You are short.', 'bad'); return; }
  G.credits -= c;
  G.colonies[planet.id] = { id: planet.id, sys: planet.sys, name: planet.name, biome: planet.biome,
    res: planet.res.slice(), pop: 24, build: [], stock: {}, founded: G.day, raided: 0, districts: [] };
  AU.play('upgrade');
  say('Claim beacon planted. ' + planet.name + ' is yours.', 'rare');
  discover('claim:' + planet.id, 'Colony founded: ' + planet.name, 'Empire', 'First settlement on a ' + BIOMES[planet.biome].n.toLowerCase() + ' world.', 6000);
}
function colStats(co) {
  let cap = 60, pwrP = 0, pwrC = 0, ext = 0, grow = 0.03, ref = 0, trade = 0, res = 0, def = 0, prest = 0, val = 0, plots = 0, craft = 0, store = 0, water = 0;
  for (const b of co.build) {
    const d = BUILDS[b.t]; if (!d) continue;
    val += d.cr * 0.75;
    if (d.pwr > 0) pwrP += d.pwr; else pwrC -= d.pwr;
    if (d.cap) cap += d.cap;
    if (d.ext) ext += d.ext;
    if (d.grow) grow += d.grow;
    if (d.ref) ref += d.ref;
    if (d.trade) trade += d.trade;
    if (d.res) res += d.res;
    if (d.def) def += d.def;
    if (d.prest) prest += d.prest;
    if (d.plots) plots += d.plots;
    if (d.craft) craft += d.craft;
    if (d.store) store += d.store;
    if (d.water) water += d.water;
  }
  cap = Math.round(cap * (1 + prest * 0.5));
  const eff = pwrC === 0 ? 1 : clamp(pwrP / pwrC, 0, 1);
  return { cap, pwrP, pwrC, eff, ext, grow, ref, trade, res, def, prest, val, plots, craft, store, water };
}
function colIncome(co) { const st = colStats(co); return st.eff * (co.pop * 0.02 * (1 + st.trade)) + st.eff * st.ref * 9; }
function empireIncome() { let s = 0; for (const k in G.colonies) s += colIncome(G.colonies[k]); return s; }
function empirePop() { let s = 0; for (const k in G.colonies) s += G.colonies[k].pop; return s; }
function siteFor(pid) {
  /* a "site" is whatever you have built on a planet: colony or personal base */
  return G.colonies[pid] || G.bases[pid] || null;
}
function ensureBase(pid, name, biome, res) {
  if (G.colonies[pid]) return G.colonies[pid];
  if (!G.bases[pid]) G.bases[pid] = { id: pid, name: name, biome: biome, res: res.slice(), build: [], stock: {}, pop: 0, personal: true };
  return G.bases[pid];
}
function farmFor(pid) {
  if (!G.farms[pid]) G.farms[pid] = { plots: [] };
  return G.farms[pid];
}
function netWorth() {
  let w = G.credits;
  for (const k in G.cargo) w += G.cargo[k] * (MAT[k] ? MAT[k].v : 0);
  for (const k in G.stash) w += G.stash[k] * (MAT[k] ? MAT[k].v : 0);
  for (const slot in DEFAULT_PARTS) { const pt = partOf(slot); if (pt) w += pt.cr * 0.65; }
  for (const k in G.ownedParts) if (G.ownedParts[k] && PARTS[k] && G.parts[PARTS[k].slot] !== k) w += PARTS[k].cr * 0.4;
  { const f = fitOf(); for (const sl in f) if (MODULES[f[sl]]) w += MODULES[f[sl]].cr * 0.7; }
  for (const k in G.colonies) {
    const co = G.colonies[k], st = colStats(co);
    w += st.val + co.pop * 420;
    for (const r in co.stock) w += co.stock[r] * (MAT[r] ? MAT[r].v : 0);
  }
  for (const k in G.bases) { const b = G.bases[k]; for (const x of b.build) w += (BUILDS[x.t] ? BUILDS[x.t].cr * 0.6 : 0); }
  return w;
}
const TYCOONS = [
  { n: 'Vashti Orlan',     f: 'gek',      w: 4.2e6, g: 0.00042 },
  { n: 'Hulon-Tek',        f: 'korvax',   w: 9.6e6, g: 0.00040 },
  { n: 'Marabel Scree',    f: 'free',     w: 2.4e7, g: 0.00038 },
  { n: 'The Quiet Broker', f: 'drift',    w: 6.1e7, g: 0.00036 },
  { n: 'Iridia Vaan',      f: 'free',     w: 1.3e8, g: 0.00034 },
  { n: 'Ashkaar of Ninth', f: 'vykeen',   w: 2.7e8, g: 0.00031 },
  { n: 'Sable Merovin',    f: 'gek',      w: 4.9e8, g: 0.00029 },
  { n: 'Ossuary Prime',    f: 'korvax',   w: 8.8e8, g: 0.00026 },
  { n: 'Lady Cerrivane',   f: 'drift',    w: 1.6e9, g: 0.00023 },
  { n: 'Hadal Quorum',     f: 'sentinel', w: 3.1e9, g: 0.00020 },
  { n: 'Emperor Sylvane',  f: 'outlaw',   w: 6.4e9, g: 0.00017 }
];
/* The eleven names above were never much of a ladder. Build a real one:
   a few hundred rivals generated from a fixed seed, each compounding at
   their own rate, so the board moves whether you are watching or not. */
const RIVALS = (function () {
  const out = [];
  const r = rng(0x5EED17);
  const fkeys = FACTION_KEYS.filter(f => f !== 'none');
  const TITLES = ['Consortium','Holdings','Combine','Syndicate','Reach','Line','Trust','Yards','Concern','Freight','Salvage','Assembly','Exchange','Chapter','Compact'];
  for (const t of TYCOONS) out.push({ n: t.n, f: t.f, w: t.w, g: t.g, named: true });
  for (let i = 0; i < 288; i++) {
    const fac = pick(r, fkeys);
    const style = r();
    const nm = style < 0.46 ? personName(r)
      : style < 0.78 ? settleName(r) + ' ' + pick(r, TITLES)
      : cap1(pick(r, NB.s1)) + cap1(pick(r, NB.s2)) + ' ' + pick(r, TITLES);
    /* a long tail of small operators and a thin crust of the very rich */
    const tier = Math.pow(r(), 2.6);
    out.push({ n: nm, f: fac, w: Math.round(4000 + tier * 9.4e9), g: rr(r, 0.00008, 0.00046), named: false });
  }
  out.sort((a, b) => b.w - a.w);
  return out;
})();
function ranking() {
  const list = RIVALS.map(t => ({ n: t.n, f: FACTIONS[t.f] ? FACTIONS[t.f].n : t.f, w: t.w, you: false }));
  list.push({ n: 'You', f: 'Independent', w: netWorth(), you: true });
  list.sort((a, b) => b.w - a.w);
  return list;
}
/* binary-search the sorted rival list instead of rebuilding it every frame */
function myRank() {
  const w = netWorth();
  let lo = 0, hi = RIVALS.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (RIVALS[mid].w > w) lo = mid + 1; else hi = mid; }
  return lo + 1;
}

let ecoAcc = 0, dayAcc = 0, rivalSortAcc = 0;
function economyTick(dt) {
  for (const t of RIVALS) t.w *= (1 + t.g * dt);
  /* keep the board ordered cheaply — a few adjacent swaps per tick is
     enough because everyone only drifts a fraction of a percent */
  rivalSortAcc += dt;
  if (rivalSortAcc > 2.5) { rivalSortAcc = 0; RIVALS.sort((a, b) => b.w - a.w); }
  /* day cycle */
  G.dayT += dt / DAY_LEN;
  while (G.dayT >= 1) { G.dayT -= 1; G.day++; newDay(); }

  ecoAcc += dt;
  if (ecoAcc < 0.5) return;
  const d = ecoAcc; ecoAcc = 0;

  let research = 0;
  for (const k in G.colonies) {
    const co = G.colonies[k], st = colStats(co);
    research += st.res;
    if (st.eff > 0) {
      co.pop += co.pop * st.grow * (1 - co.pop / Math.max(1, st.cap)) * st.eff * d;
      co.pop = clamp(co.pop, 1, st.cap);
    }
    if (st.ext > 0 && co.res.length) {
      const r = co.res[Math.floor(G.t * 0.3) % co.res.length];
      co.stock[r] = (co.stock[r] || 0) + st.ext * st.eff * d * 2;
    }
    if (st.ref > 0) {
      let budget = st.ref * st.eff * d * 3;
      for (const r in co.stock) {
        if (budget <= 0) break;
        const take = Math.min(co.stock[r], budget);
        co.stock[r] -= take; budget -= take;
        G.credits += take * (MAT[r] ? MAT[r].v : 0) * 0.8;
        if (co.stock[r] < 0.01) delete co.stock[r];
      }
    }
    G.credits += st.eff * (co.pop * 0.02 * (1 + st.trade)) * d;
  }
  G.research = research;
  const nw = netWorth();
  if (nw > G.stat.peak) G.stat.peak = nw;
}
function newDay() {
  /* crops grow, crew eat, wages, condensers refill */
  let grown = 0;
  for (const pid in G.farms) {
    for (const p of G.farms[pid].plots) {
      if (!p.crop) continue;
      const cd = CROPS[p.crop];
      if (p.watered) { p.stage = Math.min(cd.days, p.stage + 1); p.watered = false; }
      else p.dry = (p.dry || 0) + 1;
      if (p.dry > 3) { p.crop = null; p.stage = 0; p.dry = 0; }
      if (p.stage >= cd.days) grown++;
    }
  }
  if (grown) say(grown + ' crop' + (grown > 1 ? 's are' : ' is') + ' ready to harvest.', 'good');
  /* crew upkeep */
  let wages = 0, fed = 0, hungry = 0;
  for (const c of G.crew) {
    wages += c.wage;
    let ate = false;
    for (const k in G.cargo) {
      if (MAT[k] && MAT[k].food && G.cargo[k] >= 1) { takeRes(k, 1); ate = true; fed++; break; }
    }
    if (ate) c.morale = clamp(c.morale + 6, 0, 100);
    else { c.morale = clamp(c.morale - 18, 0, 100); hungry++; }
    if (c.hp < c.maxHp) c.hp = Math.min(c.maxHp, c.hp + 12);
  }
  if (wages) {
    if (G.credits >= wages) { G.credits -= wages; }
    else { for (const c of G.crew) c.morale = clamp(c.morale - 25, 0, 100); say('Payroll missed. The crew noticed.', 'bad'); }
  }
  if (hungry) say(hungry + ' of the crew went unfed. Morale is dropping.', 'warn');
  /* nobody walks off outright until morale is fully bottomed out, but the
     odds of losing someone climb steadily starting at 25% morale */
  const quitters = [];
  G.crew = G.crew.filter(c => {
    if (c.morale <= 0) { quitters.push(c); return false; }
    if (c.morale <= 25) {
      const chance = ((25 - c.morale) / 25) * 0.55; /* up to 55%/cycle as morale nears zero */
      if (Math.random() < chance) { quitters.push(c); return false; }
    }
    return true;
  });
  for (const q of quitters) say(q.name + ' walked off the ship for good.', 'bad');
  /* water condensers */
  for (const pid in G.bases) { const st = colStats(G.bases[pid]); if (st.water) G.waterCan = 100; }
  if (G.set.autosave) save(true);
}

/* ------------------------------------------------------------
   17. CREW
------------------------------------------------------------ */
const CREW_SKILLS = {
  piloting:   { n: 'Piloting',    d: 'Higher top speed and sharper handling.' },
  engineering:{ n: 'Engineering', d: 'Hull repairs between fights, stronger mining beam.' },
  gunnery:    { n: 'Gunnery',     d: 'Heavier weapon damage.' },
  science:    { n: 'Science',     d: 'Larger payouts from every scan and discovery.' },
  farming:    { n: 'Farming',     d: 'Bigger harvests from every plot.' }
};
function hireNpc(npc) {
  if (G.crew.length >= 6) { say('No more berths. The ship sleeps six.', 'warn'); return false; }
  const cost = npc.wage * 3;
  if (G.credits < cost) { say('Signing fee is ' + fmt(cost) + ' units.', 'bad'); return false; }
  G.credits -= cost;
  G.crew.push({ id: npc.id, name: npc.name, spec: npc.spec, role: npc.role, col: npc.col, head: npc.head,
    skill: npc.skill || pick(Math.random, Object.keys(CREW_SKILLS)), level: npc.level,
    morale: 70, hp: 100, maxHp: 100, wage: npc.wage, xp: 0 });
  AU.play('upgrade');
  say(npc.name + ' signed on as ' + npc.role + '.', 'rare');
  repChange(npc.fac, 0.3);
  return true;
}
/* fee already taken by the caller — this just puts them on the roster */
function boardCrew(npc) {
  if (G.crew.length >= 6) { say('No more berths. The ship sleeps six.', 'warn'); return false; }
  G.crew.push({ id: npc.id, name: npc.name, spec: npc.spec, role: npc.role, col: npc.col, head: npc.head,
    skill: npc.skill || pick(rng(npc.seed >>> 0), Object.keys(CREW_SKILLS)), level: npc.level,
    morale: 70, hp: 100, maxHp: 100, wage: npc.wage, xp: 0 });
  AU.play('upgrade');
  say(npc.name + ' signed on as ' + npc.role + '.', 'rare');
  repChange(npc.fac, 0.3);
  npc.recruited = true;
  return true;
}
function fitPart(k) {
  const pt = PARTS[k]; if (!pt) return;
  const old = G.parts[pt.slot];
  if (old && old !== k && PARTS[old] && PARTS[old].cr > 0) G.ownedParts[old] = 1;
  G.parts[pt.slot] = k;
  const s = ST();
  G.hull = clamp(G.hull, 1, s.hull);
  G.fuel = Math.min(G.fuel, maxFuel());
  /* a smaller hold cannot hold what the old one did */
  const over = cargoUsed() - s.cargo;
  if (over > 0) {
    let rem = over;
    for (const key in G.cargo) {
      if (rem <= 0) break;
      const t = Math.min(G.cargo[key], rem);
      takeRes(key, t); rem -= t;
    }
    refreshTools();
    say('The new hold is smaller. ' + Math.ceil(over) + ' units were left on the pad.', 'warn');
  }
  say(pt.n + ' fitted. ' + PART_SLOTS[pt.slot].n + ' online.', 'rare');
}
function crewSummary() {
  if (!G.crew.length) return 'No crew aboard';
  const avg = Math.round(G.crew.reduce((s, c) => s + c.morale, 0) / G.crew.length);
  return G.crew.length + ' crew · morale ' + avg + '%';
}

/* ------------------------------------------------------------
   18. CANVAS + INPUT
------------------------------------------------------------ */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(G.set.quality >= 2 ? 2 : 1, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const keys = Object.create(null), tapped = Object.create(null);
window.addEventListener('keydown', e => {
  if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
  if (!keys[e.code]) tapped[e.code] = true;
  keys[e.code] = true;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].indexOf(e.code) >= 0) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
const tap = c => { if (tapped[c]) { tapped[c] = false; return true; } return false; };
const down = c => !!keys[c];

/* ------------------------------------------------------------
   19. MODE TRANSITIONS
------------------------------------------------------------ */
function setSystem(key) {
  G.sysKey = key;
  if (key === 'train') { sys = TRAINING_SYSTEM; return; }
  const c = key.split('|'); sys = systemAt(+c[0], +c[1]);
}
const TRAINING_SYSTEM = {
  key: 'train', cx: 0, cy: 0, x: 0, y: 0, name: 'Cadet Field Range', seed: 777,
  star: { n: 'Yellow dwarf', c: '#ffe9a8', r: 300, t: 1, mass: 1.0 },
  faction: 'free', danger: 0, wealth: 2, hasStation: true, belt: false,
  scanned: true, planets: [TRAINING_PLANET, TRAINING_PLANET2], price: {}, stOrbit: 3000, stPhase: 1, stName: 'Academy Ring'
};
for (const k of MAT_KEYS) TRAINING_SYSTEM.price[k] = 1;

function enterSystem(s, fromAng) {
  setSystem(s.key);
  G.mode = 'system'; G.docked = false; G.onFoot = false; planet = null; G.planetId = null; shipAnchor = null;
  const a = fromAng === undefined ? Math.random() * TAU : fromAng;
  const d = (s.planets.length ? s.planets[s.planets.length - 1].orbit : 1800) + 1600;
  P.x = Math.cos(a) * d; P.y = Math.sin(a) * d;
  P.vx = 0; P.vy = 0; P.ang = a + Math.PI;
  hostiles = []; bullets = []; neutrals = []; shots = []; piles = [];
  spawnTraffic(s);
  say('Arrived in the ' + s.name + ' system · ' + FACTIONS[s.faction].n, 'good');
  if (!s.scanned) { s.scanned = true; }
}
function landOn(pl, gentle) {
  planet = pl; G.planetId = pl.id; G.mode = 'surface'; G.docked = false; G.onFoot = false;
  surfCache = new Map();
  P.x = 0; P.y = 0; P.vx = 0; P.vy = 0; P.ang = -Math.PI / 2;
  hostiles = []; bullets = []; neutrals = []; shipAnchor = null;
  shots = []; piles = []; beams.length = 0;
  G.stat.landed++;
  const b = BIOMES[pl.biome];
  say((gentle ? 'Touchdown on ' : 'Landed on ') + pl.name + ' · ' + b.n + (b.haz > 0.3 ? ' · ' + b.hazn : ''), 'good');
  if (!pl.weatherNow) pl.weatherNow = pl.weather[Math.floor(Math.random() * pl.weather.length)];
}
/* A city is big enough to set down on, so it gets treated as a world
   with a deck instead of a surface. */
function cityPlanet(t) {
  const id = 'city:' + t.id;
  if (!G.citadels[id]) {
    G.citadels[id] = { id: id, sys: G.sysKey, idx: 0, seed: (t.id.length * 7717 + t.rad) >>> 0,
      name: t.name, biome: 'citadel', r: t.rad, citadel: true, fac: t.fac,
      orbit: 0, phase: 0, speed: 0, res: ['ferrite','alloy','circuit'],
      scanned: true, moons: 0, rings: false, life: 'Dense', hazard: 0,
      weather: ['recycled air'], rich: false, settled: true, day: 1,
      atX: t.x, atY: t.y, cityHostile: !!t.hostile };
  }
  const pl = G.citadels[id];
  pl.atX = t.x; pl.atY = t.y; pl.cityHostile = !!t.hostile; pl.sys = G.sysKey;
  return pl;
}
function landOnCity(t) {
  const pl = cityPlanet(t);
  if (t.hostile) {
    say('Every gun on ' + t.name + ' is tracking you. Setting down is suicide.', 'bad');
    return;
  }
  landOn(pl, true);
  say('Cleared to the deck of ' + t.name + '. Mind the crowds.', 'rare');
  discover('cityvisit:' + t.id, t.name, 'Settlement',
    'A floating city of the ' + FACTIONS[t.fac].n + '. Never touched a planet, never will.', 22000);
}

function launch() {
  if (!G.thrustersFixed) { say('Launch thrusters are still dead. Repair them first.', 'bad'); return; }
  if (G.onFoot) { say('Board the ship first — press E beside it.', 'warn'); return; }
  if (G.fuel < 8) { say('Not enough warp cells to break atmosphere. Refine tritium in the cargo screen.', 'bad'); return; }
  G.fuel -= 8;
  const pl = planet;
  G.mode = 'system'; setSystem(pl.sys);
  if (pl.citadel) {
    P.x = pl.atX + pl.r * 1.7; P.y = pl.atY;
    P.vx = 0; P.vy = 0; P.ang = 0;
    planet = null; G.planetId = null;
    say('Lifting off the deck.', 'good');
    return;
  }
  const pp = planetPos(pl, G.t);
  const a = Math.atan2(pp[1], pp[0]);
  P.x = pp[0] + Math.cos(a) * (pl.r + 320); P.y = pp[1] + Math.sin(a) * (pl.r + 320);
  P.vx = Math.cos(a) * 120; P.vy = Math.sin(a) * 120; P.ang = a;
  planet = null; G.planetId = null;
  spawnTraffic(sys);
  say('Breaking atmosphere.', 'good');
}
function leaveSystem() {
  if (G.fuel < 4) { say('Warp cells empty. Refine tritium into cells from the cargo screen.', 'bad'); return; }
  G.mode = 'galaxy'; G.docked = false;
  const a = Math.atan2(P.y, P.x) || 0;
  P.x = sys.x + Math.cos(a) * 560; P.y = sys.y + Math.sin(a) * 560;
  P.vx = 0; P.vy = 0; P.ang = a;
  hostiles = []; bullets = []; neutrals = [];
  G.stat.jumps++;
  say('Pulse drive engaged. Open space.', 'good');
}
function spawnTraffic(s) {
  if (!s) return;
  const r = rng(hash2(s.cx, s.cy, (G.day * 31 + Math.floor(G.t / 90)) | 0));
  /* arriving inside the orbits is quiet: nought to three contacts. Coming in
     from the dark, the count climbs with the square of how far out you are. */
  const arriveRim = rimFactor(s, P.x, P.y);
  const outward = clamp(arriveRim - 0.85, 0, 2.6);
  const n = ri(r, 0, 3) + (s.hasStation ? 1 : 0) + Math.round(outward * 1.6);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = 4000 + r() * 5000;
    const t = makeTraffic(r, s, Math.cos(a) * d, Math.sin(a) * d);
    if (t.hostile) hostiles.push(t); else neutrals.push(t);
  }
  /* one resident city per owned system, parked out on the rim */
  if (s.faction && s.faction !== 'none' && hash2(s.cx, s.cy, 0xc17ade) % 100 < 22) {
    const cr = rng(hash2(s.cx, s.cy, 0xc17ade));
    const a = cr() * TAU, d = systemEdge(s) * rr(cr, 1.1, 1.5);
    const c = makeTraffic(cr, s, Math.cos(a) * d, Math.sin(a) * d,
      { tier: 'citadel', fac: s.faction, hostile: (G.rep[s.faction] || 0) < -45, kind: 'city' });
    if (c.hostile) hostiles.push(c); else neutrals.push(c);
  }
  /* if a faction wants you dead, they are waiting when you arrive */
  const rep = G.rep[s.faction] || 0;
  if (s.faction !== 'none' && rep <= -55) {
    const hr = rng((Math.random() * 1e9) | 0);
    const wave = rep <= -80 ? 4 : 2;
    for (let i = 0; i < wave; i++) {
      const a = Math.random() * TAU, d = 2200 + Math.random() * 1800;
      const t = makeTraffic(hr, s, P.x + Math.cos(a) * d, P.y + Math.sin(a) * d,
        { tier: rep <= -80 && i === 0 ? pick(hr, TIER_VARIANTS[3]) : pick(hr, TIER_VARIANTS[2]),
          fac: s.faction, hostile: true, kind: 'patrol', force: true });
      t.state = 'hunt'; hostiles.push(t);
    }
    say(FACTIONS[s.faction].n + ' has a standing order out on you. They are already moving.', 'bad');
  }
  const hn = hostiles.length;
  if (hn) say(hn + ' hostile contact' + (hn > 1 ? 's' : '') + ' on the scanner.', 'bad');
}

/* The further you drift from the star, the busier it gets out here. */
let rimAcc = 0;
let kosAcc = 0;
/* if a faction has you at "kill on sight", every second spent in one of
   their systems is a 1% roll for them to drop a full strike force on you */
function killOnSightCheck(dt) {
  if (G.mode !== 'system' || !sys || G.tutorial || sys.faction === 'none' || !sys.faction) return;
  kosAcc += dt;
  if (kosAcc < 1) return;
  kosAcc = 0;
  const rep = G.rep[sys.faction] || 0;
  if (rep > -75) return;
  if (Math.random() >= 0.01) return;
  const r = rng((Math.random() * 1e9) | 0);
  say(FACTIONS[sys.faction].n + ' just put a kill order through — a strike force is inbound.', 'bad');
  for (let i = 0; i < 2; i++) {
    const a = Math.random() * TAU, d = 2600 + Math.random() * 1600;
    const t = makeTraffic(r, sys, P.x + Math.cos(a) * d, P.y + Math.sin(a) * d,
      { tier: 'mother', fac: sys.faction, hostile: true, kind: 'patrol', force: true });
    t.state = 'hunt'; hostiles.push(t);
  }
  for (let i = 0; i < 5; i++) {
    const a = Math.random() * TAU, d = 2000 + Math.random() * 1400;
    const t = makeTraffic(r, sys, P.x + Math.cos(a) * d, P.y + Math.sin(a) * d,
      { tier: pick(r, TIER_VARIANTS[2]), fac: sys.faction, hostile: true, kind: 'patrol', force: true });
    t.state = 'hunt'; hostiles.push(t);
  }
}
function rimSpawn(dt) {
  killOnSightCheck(dt);
  if (G.mode !== 'system' || !sys) return;
  rimAcc -= dt;
  if (rimAcc > 0) return;
  const rim = rimFactor(sys, P.x, P.y);
  /* Nothing much happens inside the orbits. Past the last orbit the rate and
     the ceiling both climb linearly with distance, so drifting twice as far
     out of the system is twice the traffic, not four times. */
  const out = clamp(rim - 0.8, 0, 2.7);
  const pressure = out * 1.5 * (1 + (sys.danger || 0) * 0.28);
  rimAcc = pressure <= 0.02 ? 6 : clamp(13 / pressure, 0.9, 26);
  if (pressure <= 0.02) return;
  if (hostiles.length >= Math.round(3 + pressure * 3.6)) return;
  const r = rng((Math.random() * 1e9) | 0);
  const a = Math.random() * TAU, d = 5000 + Math.random() * 4000;
  const t = makeTraffic(r, sys, P.x + Math.cos(a) * d, P.y + Math.sin(a) * d,
    { rim: rim, hostile: r() < clamp(0.3 + rim * 0.26, 0.3, 0.92), kind: 'pirate', force: true });
  t.state = 'hunt';
  if (t.hostile) hostiles.push(t); else neutrals.push(t);
  if (tierRank(t.tier) >= 3) say('Something very large just lit up on the far scanner.', 'bad');
}

/* ------------------------------------------------------------
   20. DAMAGE + DEATH
------------------------------------------------------------ */
function hurt(n, src) {
  /* the training range is a genuinely safe haven — nothing here can put a
     scratch on you, so the ship-repair loop can be practiced without the
     one mistake that would send a new pilot back to the title screen */
  if (G.tutorial) return;
  if (G.onFoot) return hurtSuit(n);
  if (G.set.shake) cam.shake = Math.min(24, cam.shake + n * 0.14);
  screenFlash();
  if (G.shield > 0) { const a = Math.min(G.shield, n); G.shield -= a; n -= a; }
  if (n > 0) { G.hull -= n; float(P.x, P.y - 30, '-' + Math.round(n), '#ff6a4d'); }
  if (G.hull <= 0 && !G.over) death(src);
}
function hurtSuit(n) {
  if (G.tutorial) return;
  n = n * (1 - suitArmour());
  if (n <= 0) return;
  if (G.set.shake) cam.shake = Math.min(18, cam.shake + n * 0.2);
  screenFlash();
  G.suit.hp -= n; float(P.x, P.y - 24, '-' + Math.round(n), '#ff6a4d');
  if (G.suit.hp <= 0 && !G.over) {
    G.suit.hp = 1;
    /* on foot you black out and wake at the ship instead of dying outright */
    if (shipAnchor) { P.x = shipAnchor.x; P.y = shipAnchor.y; }
    G.onFoot = false; shipAnchor = null;
    syncSuit(); G.suit.hp = G.suit.max * 0.4; G.suit.air = G.suit.airMax;
    const lost = Math.round(cargoUsed() * 0.15);
    let rem = lost; for (const k in G.cargo) { const t = Math.min(G.cargo[k], rem); takeRes(k, t); rem -= t; if (rem <= 0) break; }
    AU.play('lose');
    say('You blacked out. The suit auto-recalled you to the ship. Some cargo was left behind.', 'bad');
  }
}
/* Where you wake up. Always the world the run started on, so a bad fight
   never strands you in open space with an empty tank. */
function homeWorld() {
  const pl = planetById(G.homeId || '0|0:0');
  if (pl) return pl;
  setSystem('0|0');
  return sys && sys.planets.length ? sys.planets[0] : null;
}
function homeWorldName() { const pl = homeWorld(); return pl ? pl.name : null; }
function respawnHome() {
  G.over = false;
  G.hull = ST().hull; G.shield = ST().shield;
  /* every death breaks the launch thrusters again — no drifting straight
     back into orbit, the repair loop (ferrite + tritium, then press R)
     has to happen all over */
  G.thrustersFixed = false; G.fuel = 0; G.hyperwarp = false;
  G.suit.hp = G.suit.max; G.suit.air = G.suit.airMax;
  hostiles = []; bullets = []; neutrals = []; beams.length = 0;
  shipAnchor = null; G.docked = false;
  const pl = homeWorld();
  if (pl) { setSystem(pl.sys); landOn(pl, true); say('You come round on ' + pl.name + '. The thrusters are dead again — get ferrite dust and tritium, then press R.', 'warn'); return; }
  setSystem('0|0'); enterSystem(sys);
}

function death(src) {
  G.over = true; G.deaths++;
  AU.play('lose');
  const lost = Math.round(G.credits * 0.2);
  G.credits -= lost;
  
  /* Drop all items on ground at death location */
  const deathX = P.x, deathY = P.y;
  for (const k in G.cargo) {
    const amt = G.cargo[k];
    if (amt > 0) {
      for (let i = 0; i < amt; i++) {
        piles.push({
          x: deathX + (Math.random() - 0.5) * 200,
          y: deathY + (Math.random() - 0.5) * 200,
          k: k,
          t: G.t + 300, /* 5 minutes despawn time */
          planetId: planet ? planet.id : null,
          sysId: sys ? sys.key : null
        });
      }
    }
  }
  const cargoLost = Math.round(cargoUsed());
  G.cargo = {}; refreshTools();
  boom(P.x, P.y, 90, '#ff6a4d', 320);
  showEvent('systems failure', 'The ship comes apart around you',
    'The escape pod fires on the last of its charge. A salvage crew finds you eleven hours later and bills you for the trouble. You lose ' +
    fmt(lost) + ' units and ' + cargoLost + ' units of cargo' + (src ? ' — cause of loss: ' + src : '') + '.',
    [{ l: 'Wake up on ' + (homeWorldName() || 'the home world'), f: () => { respawnHome(); } }]);
}

/* ------------------------------------------------------------
   21. FLIGHT + GRAVITY + HARD SURFACES
------------------------------------------------------------ */
function flyControls(dt, env) {
  const s = ST();
  const turn = s.turn * (env.turnMul || 1) * (1 + crewBonus('piloting') * 0.12);
  if (down('KeyA') || down('ArrowLeft')) P.ang -= turn * dt;
  if (down('KeyD') || down('ArrowRight')) P.ang += turn * dt;

  const boosting = down('ShiftLeft') || down('ShiftRight');
  const fwd = down('KeyW') || down('ArrowUp');
  /* hyperwarp: a toggle, not a hold. Burns cells at 100x the normal boost
     rate for 100x the speed, and switches itself off the instant the tank
     hits zero. */
  if (tap('KeyO') && !G.onFoot) {
    if (!G.hyperwarp && G.fuel <= 0) say('No warp cells left to spool a hyperwarp jump.', 'warn');
    else { G.hyperwarp = !G.hyperwarp; say(G.hyperwarp ? 'Hyperwarp engaged.' : 'Hyperwarp disengaged.', G.hyperwarp ? 'rare' : ''); }
  }
  if (G.hyperwarp && G.fuel <= 0) { G.hyperwarp = false; say('Warp cells dry — hyperwarp disengaged.', 'bad'); }
  P.boost = ((boosting || G.hyperwarp) && fwd && G.fuel > 0) ? 1 : 0;
  P.hyper = G.hyperwarp && P.boost ? 1 : 0;
  let th = 0;
  if (fwd) th = 1; else if (down('KeyS') || down('ArrowDown')) th = -0.45;
  P.thrust = th;

  const boostMul = (env.boostMul || 3.2) * (P.hyper ? 100 : 1);
  const mul = (env.thrustMul || 1) * (P.boost ? boostMul : 1) * (1 + crewBonus('piloting') * 0.08);
  if (th) {
    P.vx += Math.cos(P.ang) * s.thrust * mul * th * dt;
    P.vy += Math.sin(P.ang) * s.thrust * mul * th * dt;
    if (Math.random() < 0.85 && G.set.quality > 0) {
      const a = P.ang + Math.PI + (Math.random() - 0.5) * 0.5;
      parts.push({ x: P.x + Math.cos(P.ang + Math.PI) * 16, y: P.y + Math.sin(P.ang + Math.PI) * 16,
        vx: Math.cos(a) * 120 + P.vx * 0.3, vy: Math.sin(a) * 120 + P.vy * 0.3,
        l: 0, m: 0.3 + Math.random() * 0.3, c: P.hyper ? '#ffffff' : (P.boost ? '#d484ff' : s.col), sz: P.boost ? 3.4 : 2.4 });
    }
  }
  if (P.boost) { G.fuel = Math.max(0, G.fuel - 0.5 * dt * (P.hyper ? 100 : 1)); if (G.fuel === 0) { G.hyperwarp = false; say('Warp cells dry.', 'warn'); } }

  const maxS = s.max * (env.speedMul || 1) * (P.boost ? boostMul : 1);
  const sp = Math.hypot(P.vx, P.vy);
  if (sp > maxS && !env.noClamp) { const f = maxS / sp; P.vx *= f; P.vy *= f; }
  const drag = env.drag === undefined ? 0.35 : env.drag;
  P.vx -= P.vx * drag * dt; P.vy -= P.vy * drag * dt;
  P.x += P.vx * dt; P.y += P.vy * dt;
}

/* gravity from the star and every planet in the system */
const GRAV_K = 78000;
/* A body's pull comes from its size, not a number picked by hand. Radius
   cubed is close enough to volume, scaled so a 110-unit world reads as 1g. */
function bodyMass(pl) {
  const rel = pl.r / 110;
  return rel * rel * rel * (pl.dens === undefined ? 1 : pl.dens);
}
function gravityAt(x, y) {
  /* total acceleration here, for the HUD readout */
  if (!sys) return 0;
  const sd = Math.hypot(x, y) || 1;
  let g = (GRAV_K * sys.star.mass * 2.6) / (sd * sd);
  for (const pl of sys.planets) {
    const pp = planetPos(pl, G.t);
    const d = Math.hypot(x - pp[0], y - pp[1]) || 1;
    g += (GRAV_K * bodyMass(pl) * 1.5) / (d * d);
  }
  return g;
}
function applyGravity(dt) {
  let closest = null, closestD = 1e18;
  /* star */
  const sd = Math.hypot(P.x, P.y) || 1;
  const sg = (GRAV_K * sys.star.mass * 2.6) / (sd * sd);
  P.vx -= (P.x / sd) * sg * dt; P.vy -= (P.y / sd) * sg * dt;

  if (sd < sys.star.r * 0.85) {
    hurt(70 * dt, 'stellar contact');
    P.vx += (P.x / sd) * 900 * dt; P.vy += (P.y / sd) * 900 * dt;
    if (Math.random() < 0.4) boom(P.x, P.y, 3, '#ffd45f', 120);
  }
  for (const pl of sys.planets) {
    const pp = planetPos(pl, G.t);
    const dx = P.x - pp[0], dy = P.y - pp[1];
    const d = Math.hypot(dx, dy) || 1;
    if (d < closestD) { closestD = d; closest = { pl: pl, pp: pp, d: d, dx: dx, dy: dy }; }
    /* big worlds reach much further than small ones */
    if (d > pl.r * 26) continue;
    const g = (GRAV_K * bodyMass(pl) * 1.5) / (d * d);
    P.vx -= (dx / d) * g * dt; P.vy -= (dy / d) * g * dt;
  }
  return closest;
}
function surfaceContact(near) {
  if (!near) return;
  const pl = near.pl, d = near.d;
  if (d > pl.r) return;
  /* velocity component into the surface */
  const nx = near.dx / d, ny = near.dy / d;
  const vin = -(P.vx * nx + P.vy * ny);
  const soft = 150;
  if (vin < soft || !G.set.crashDamage) {
    landOn(pl, true);
    if (vin > soft * 0.6) say('Rough set-down. Watch your descent rate next time.', 'warn');
    return;
  }
  /* hard impact */
  const s = ST();
  const dmg = (vin - soft) * 0.42 * (1 - clamp(s.impact, 0, 0.85));
  G.crashes++;
  AU.play('break', 1);
  boom(P.x, P.y, 40, '#ff8a5f', 300);
  hurt(dmg, 'impact with ' + pl.name);
  float(P.x, P.y - 40, 'IMPACT ' + Math.round(vin) + ' m/s', '#ff6a4d');
  /* bounce back out */
  P.x = near.pp[0] + nx * (pl.r + 14); P.y = near.pp[1] + ny * (pl.r + 14);
  const tanx = -ny, tany = nx;
  const tanv = P.vx * tanx + P.vy * tany;
  P.vx = tanx * tanv * 0.5 + nx * vin * 0.28;
  P.vy = tany * tanv * 0.5 + ny * vin * 0.28;
  if (G.hull > 0) say('Hull struck ' + pl.name + ' at ' + Math.round(vin) + ' m/s. ' + Math.round(dmg) + ' damage.', 'bad');
}

/* ------------------------------------------------------------
   22. SPACE AI
   Every ship runs a small state machine: cruise, hail, hunt,
   attack, flee, follow. Behaviour depends on its kind, your
   reputation with its faction, and how hard you hit it.
------------------------------------------------------------ */
/* Who a given hull is currently shooting at. A hostile keeps the player as
   its default quarry but will turn on an escort that is closer and in the
   way; a friendly hull that has taken your side goes after hostiles and
   ignores you entirely. Targets are cached for a moment so ships do not
   flicker between two equally close enemies every frame. */
function allyOf(t) {
  if (!t || t.hostile || t.dead) return false;
  if (t.allyForced) return true;
  const rep = G.rep[t.fac] || 0;
  if (rep >= 20) return true;
  return rep >= 0 && (t.kind === 'patrol' || t.kind === 'city' || t.kind === 'escort');
}
function allyShips() {
  const out = [];
  for (const t of neutrals) if (!t.dead && t.ally) out.push(t);
  return out;
}
function nearestOf(list, x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const o of list) {
    if (o.dead) continue;
    const dd = (o.x - x) * (o.x - x) + (o.y - y) * (o.y - y);
    if (dd < bd) { bd = dd; best = o; }
  }
  return best;
}
function shipFoe(t, isHostile, dt) {
  t.foeT -= dt;
  if (t.foe && (t.foe.dead || t.foe.gone)) t.foe = null;
  if (t.foeT > 0 && (t.foe || !isHostile)) {
    if (t.foe) return { x: t.foe.x, y: t.foe.y, ref: t.foe };
    if (isHostile) return { x: P.x, y: P.y, ref: null };
  }
  t.foeT = 1.2;
  if (isHostile) {
    /* an escort or a friendly hull standing between you and them is fair game */
    const allies = allyShips();
    const near = nearestOf(allies, t.x, t.y, 4200);
    const dPlayer = Math.hypot(P.x - t.x, P.y - t.y);
    if (near && Math.hypot(near.x - t.x, near.y - t.y) < dPlayer * 0.7) { t.foe = near; return { x: near.x, y: near.y, ref: near }; }
    t.foe = null;
    return { x: P.x, y: P.y, ref: null };
  }
  /* friendlies only pick a fight if they are on your side */
  if (!t.ally) { t.foe = null; return null; }
  const h = nearestOf(hostiles, t.x, t.y, 6000);
  t.foe = h;
  return h ? { x: h.x, y: h.y, ref: h } : null;
}

/* something bigger calling a smaller hull into the fight */
function launchEscort(t, tierKey) {
  if (hostiles.length > 44) return null;
  const r2 = rng((Math.random() * 1e9) | 0);
  const a = Math.random() * TAU;
  const off = (t.rad || 60) + 90;
  const f = makeTraffic(r2, sys, t.x + Math.cos(a) * off, t.y + Math.sin(a) * off,
    { tier: tierKey, fac: t.fac, hostile: t.hostile, kind: 'escort', force: true });
  f.parent = t; f.state = t.hostile ? 'hunt' : 'cruise';
  f.allyForced = !t.hostile;
  t.brood++;
  if (t.hostile) hostiles.push(f); else neutrals.push(f);
  return f;
}

function aiShip(t, dt, isHostile) {
  t.t += dt;
  const T = VTIERS[t.tier] || VTIERS.fighter;
  const rep = G.rep[t.fac] || 0;
  t.ally = allyOf(t);
  const arch = t.archetype || 'common';

  const foe = shipFoe(t, isHostile, dt);
  const fx = foe ? foe.x : P.x, fy = foe ? foe.y : P.y;
  const dx = fx - t.x, dy = fy - t.y, d = Math.hypot(dx, dy) || 1;
  /* how far the player is, separately — several reactions key off that */
  const pd = Math.hypot(P.x - t.x, P.y - t.y) || 1;

  if (!isHostile) {
    if (t.ally && foe) {
      /* on your side and something to shoot */
      let fleeThreshold = t.max * 0.2;
      if (arch === 'defensive') fleeThreshold = t.max * 0.4;
      else if (arch === 'brutality') fleeThreshold = t.max * 0.05;
      t.state = t.hp < fleeThreshold ? 'flee' : 'attack';
      if (t.state === 'flee') { t.tx = t.x - dx * 4; t.ty = t.y - dy * 4; }
      else { t.tx = fx; t.ty = fy; }
    } else if (t.state === 'attack' && !foe) {
      t.state = 'cruise';
    } else if (t.state === 'cruise') {
      if (Math.hypot(t.tx - t.x, t.ty - t.y) < 260 || t.t > 24) {
        t.t = 0;
        t.tx = t.x + rr(Math.random, -3600, 3600); t.ty = t.y + rr(Math.random, -3600, 3600);
      }
      if (t.kind === 'follower' && pd < 2600) t.state = 'follow';
      if (t.kind === 'patrol' && rep < -40 && pd < 2200) { t.state = 'attack'; t.hostile = true; say(t.name + ' is moving to intercept.', 'bad'); }
      if (t.kind === 'trader' && pd < 700 && !t.hailed) { t.hailed = true; t.state = 'hail'; }
    } else if (t.state === 'follow') {
      if (pd > 3400) t.state = 'cruise';
      t.tx = P.x - Math.cos(P.ang) * 420; t.ty = P.y - Math.sin(P.ang) * 420;
      if (t.t > 18) { t.t = 0; if (Math.random() < 0.3) { t.state = 'cruise'; } }
    } else if (t.state === 'hail') {
      t.tx = P.x + (P.x - t.x) * 0.2; t.ty = P.y + (P.y - t.y) * 0.2;
      if (t.t > 5) t.state = 'cruise';
    } else if (t.state === 'flee') {
      t.tx = t.x - (P.x - t.x) * 4; t.ty = t.y - (P.y - t.y) * 4;
      if (pd > 3000) { t.state = 'cruise'; t.t = 0; }
    } else if (t.state === 'attack') {
      t.tx = P.x; t.ty = P.y;
      let attackThreshold = t.max * 0.28;
      if (arch === 'offensive') attackThreshold = t.max * 0.1;
      else if (arch === 'defensive') attackThreshold = t.max * 0.5;
      else if (arch === 'brutality') attackThreshold = t.max * 0.02;
      if (t.hp < attackThreshold) t.state = 'flee';
    }
  } else {
    let fleeThreshold = t.max * 0.22;
    let attackRange = 1700;
    if (arch === 'defensive') { fleeThreshold = t.max * 0.4; attackRange = 2200; }
    else if (arch === 'offensive') { fleeThreshold = t.max * 0.1; attackRange = 1200; }
    else if (arch === 'progressive') { fleeThreshold = t.max * 0.3; attackRange = 2000; }
    else if (arch === 'brutality') { fleeThreshold = t.max * 0.05; attackRange = 1000; }
    if (t.hp < fleeThreshold && t.kind !== 'pirate' && tierRank(t.tier) < 3) t.state = 'flee';
    else if (d < attackRange) t.state = 'attack';
    else t.state = 'hunt';
    if (t.state === 'flee') { t.tx = t.x - dx * 4; t.ty = t.y - dy * 4; }
    else { t.tx = fx; t.ty = fy; }
  }

  const want = Math.atan2(t.ty - t.y, t.tx - t.x);
  t.ang += angDiff(t.ang, want) * 2.6 * dt;
  const keep = (t.state === 'attack') ? 480 : 140;
  const dTarget = Math.hypot(t.tx - t.x, t.ty - t.y);
  const push = dTarget > keep ? 1 : -0.5;
  t.vx += Math.cos(t.ang) * t.sp * dt * 2.4 * push;
  t.vy += Math.sin(t.ang) * t.sp * dt * 2.4 * push;
  const spNow = Math.hypot(t.vx, t.vy);
  if (spNow > t.sp) { t.vx *= t.sp / spNow; t.vy *= t.sp / spNow; }
  t.vx -= t.vx * 0.5 * dt; t.vy -= t.vy * 0.5 * dt;
  t.x += t.vx * dt; t.y += t.vy * dt;

  /* ---- forcefields ----
     A rung-four bastion has no field until something threatens it. The field
     is a flat pool that soaks everything; once it is broken the generators
     need a full minute before another one can be raised. */
  if (T.forcefield) {
    t.ffDown = Math.max(0, t.ffDown - dt);
    const threatened = t.alarmed || (isHostile && pd < t.rad * 6);
    if (threatened && t.barrier <= 0 && t.ffDown <= 0) {
      t.barrierMax = T.forcefield;
      t.barrier = T.forcefield;
      if (pd < 9000) say(t.name + ' raised a forcefield. Nothing gets through until it drops.', 'bad');
    }
  } else if (t.barrierMax) {
    t.barrier = Math.min(t.barrierMax, t.barrier + t.barrierMax * 0.05 * dt);
  }

  /* ---- carrier launches ---- */
  if (T.summon) {
    t.summonCd -= dt;
    const near = d < 6000 || pd < 6000;
    if (t.summonCd <= 0 && near && t.brood < 6) {
      t.summonCd = rr(Math.random, T.summon[0], T.summon[1]);
      if (t.hostile || t.alarmed) {
        const f = launchEscort(t, pick(Math.random, TIER_VARIANTS[1]));
        if (f && pd < 4000) say(t.name + ' launched a ' + (VTIERS[f.tier] || VTIERS.fighter).n.toLowerCase() + '.', 'bad');
      }
    }
  }
  /* ---- rung-four hangars: three separate clocks, one per rung ---- */
  if (T.waves && t.waveCd && (t.hostile || t.alarmed)) {
    for (let i = 0; i < T.waves.length; i++) {
      t.waveCd[i] -= dt;
      if (t.waveCd[i] > 0) continue;
      t.waveCd[i] = T.waves[i][1];
      if (pd > 12000) continue;
      const rung = tierRank(T.waves[i][0]);
      const f = launchEscort(t, pick(Math.random, TIER_VARIANTS[rung]));
      if (f && pd < 7000 && rung >= 2) say(t.name + ' put a ' + (VTIERS[f.tier] || VTIERS.fighter).n.toLowerCase() + ' in the sky.', 'bad');
    }
  }

  /* ---- guns ---- */
  const gunKey = t.guns && t.guns.length ? t.guns[t.gi % t.guns.length] : 'bolt';
  const W2 = NPC_GUNS[gunKey] || NPC_GUNS.bolt;
  const reach = W2.beam ? (W2.lock ? 5200 : 2600) : W2.ring ? 1400 : W2.missile ? 3400 : gunKey === 'twin' ? 2200 : 1500;
  const canFire = foe !== null || isHostile;
  if (canFire && t.state === 'attack' && d < reach) {
    if (W2.charge) {
      /* the lance announces itself: it locks on, glows for a beat, then fires */
      if (t.chargeT > 0) {
        t.chargeT -= dt;
        t.lockAng = Math.atan2(fy - t.y, fx - t.x);   /* keeps tracking while charging */
        t.lockRef = foe ? foe.ref : null;
        if (t.chargeT <= 0) {
          t.beamT = W2.dur; t.beamAng = t.lockAng; t.beamGun = gunKey;
          AU.play('attack', 1);
        }
      } else {
        t.cd -= dt;
        if (t.cd <= 0) {
          t.cd = rr(Math.random, W2.cd[0], W2.cd[1]);
          t.chargeT = W2.charge;
          if (pd < 8000) say(t.name + ' is charging its lance. Break the lock.', 'bad');
        }
      }
    } else {
      t.cd -= dt;
      if (t.cd <= 0) {
        t.cd = rr(Math.random, W2.cd[0], W2.cd[1]);
        t.gi++;
        fireNpcGun(t, gunKey, fx, fy, foe ? foe.ref : null);
      }
    }
  }
  /* an active beam keeps burning for its duration */
  if (t.beamT > 0) {
    t.beamT -= dt;
    const bd = NPC_GUNS[t.beamGun || 'beam'] || NPC_GUNS.beam;
    const len = bd.lock ? 5200 : 2600;
    const ex = t.x + Math.cos(t.beamAng) * len, ey = t.y + Math.sin(t.beamAng) * len;
    beams.push({ x1: t.x, y1: t.y, x2: ex, y2: ey, c: bd.col, w: bd.width || 9 });
    const hitR = bd.hitRad || 30;
    if (t.hostile && !G.onFoot && segDist(t.x, t.y, ex, ey, P.x, P.y) < hitR) {
      hurt(t.gun * bd.dmg * dt, t.name + '\u2019s ' + (bd.lock ? 'lance' : 'beam'));
    }
    /* the beam does not care whose hull it crosses */
    const others = t.hostile ? allyShips() : hostiles;
    for (const o of others) {
      if (o.dead) continue;
      if (segDist(t.x, t.y, ex, ey, o.x, o.y) < hitR + (o.rad || 30) * 0.5)
        hitShip(o, t.gun * bd.dmg * dt, o.x, o.y, t.hostile ? 'hostile' : 'ally');
    }
  }
  if (tierRank(t.tier) >= 4) { t.gone = false; return; }
  if (Math.abs(t.x - P.x) > 16000 || Math.abs(t.y - P.y) > 16000) t.gone = true;
}

/* distance from point (px,py) to segment (x1,y1)-(x2,y2) */
function segDist(x1, y1, x2, y2, px, py) {
  const dx = x2 - x1, dy = y2 - y1;
  const L = dx * dx + dy * dy;
  let t = L ? ((px - x1) * dx + (py - y1) * dy) / L : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

function fireNpcGun(t, key, tx, ty, foeRef) {
  const W2 = NPC_GUNS[key] || NPC_GUNS.bolt;
  const ang = Math.atan2(ty - t.y, tx - t.x);
  if (W2.beam) { t.beamT = W2.dur; t.beamAng = ang; t.beamGun = key; AU.play('attack', 0.9); return; }
  /* side decides who the round is allowed to hurt: 'h' rounds come from a
     hostile and hurt you and anything flying with you, 'p' rounds come from
     a friendly hull and only hurt hostiles */
  const side = t.hostile ? 'h' : 'p';
  /* a homing round needs to know what it is chasing — the player is stored
     as the string 'P' so a stale ship reference can never keep it alive */
  const tgt = W2.homing ? (foeRef ? foeRef : (t.hostile ? 'P' : null)) : null;
  const mk = (a, spd, off) => {
    bullets.push({
      x: t.x + Math.cos(a + Math.PI / 2) * (off || 0), y: t.y + Math.sin(a + Math.PI / 2) * (off || 0),
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      l: W2.blast ? (W2.fuse || 1.6) : 2.2, d: t.gun * W2.dmg, mine: false, side: side, c: W2.col,
      sz: W2.sz || 3, blast: W2.blast || 0, pierce: !!W2.pierce,
      homing: W2.homing || 0, accel: W2.accel || 0, maxSpd: W2.maxSpd || 0,
      missile: !!W2.missile, tgt: tgt, owner: t
    });
  };
  if (W2.ring) {
    /* every emitter at once, straight outward, aimed at nothing in particular */
    for (let i = 0; i < W2.ring; i++) mk((i / W2.ring) * TAU + t.ang, W2.spd, 0);
    AU.play('attack', 0.55);
    return;
  }
  const n = W2.n || 1;
  for (let i = 0; i < n; i++) {
    const spread = W2.arc ? (n > 1 ? (i - (n - 1) / 2) * (W2.arc / n) : 0) : 0;
    const off = (!W2.arc && n > 1) ? (i - (n - 1) / 2) * (W2.sep || 12) : 0;
    mk(ang + spread, W2.spd, off);
  }
  AU.play('shoot', 0.5);
}
function updTraffic(dt) {
  for (const t of hostiles) aiShip(t, dt, true);
  for (const t of neutrals) aiShip(t, dt, false);
  hostiles = hostiles.filter(t => !t.gone && !t.dead);
  neutrals = neutrals.filter(t => !t.gone && !t.dead);
  /* a neutral that turned hostile moves lists */
  for (let i = neutrals.length - 1; i >= 0; i--)
    if (neutrals[i].hostile) { hostiles.push(neutrals[i]); neutrals.splice(i, 1); }
}

/* nearest living hostile to a point, for the missile rack to lock onto */
function nearestHostile(x, y) {
  let best = null, bd = Infinity;
  for (const t of hostiles) {
    if (t.dead || t.gone) continue;
    const d = (t.x - x) * (t.x - x) + (t.y - y) * (t.y - y);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

let gunCd = 0;
/* laser hull-lance energy pool: 3 seconds of beam time, spendable however
   the pilot likes, then a flat 5-second recharge once it hits empty */
G.laserCharge = G.laserCharge === undefined ? 3 : G.laserCharge;
G.laserRecharging = false;
function combat(dt) {
  const s = ST();
  gunCd -= dt;
  const holding = down('Space') && !G.onFoot;

  if (s.gunType === 'laser') {
    /* held physical beam. Costs charge only while actually firing; once
       the 3-second pool is spent it locks out for a flat 5 seconds. */
    if (G.laserRecharging) {
      G.laserCharge += dt * (3 / 5); /* refills over 5s */
      if (G.laserCharge >= 3) { G.laserCharge = 3; G.laserRecharging = false; }
    }
    if (holding && !G.laserRecharging && G.laserCharge > 0) {
      G.laserCharge = Math.max(0, G.laserCharge - dt);
      if (G.laserCharge <= 0) G.laserRecharging = true;
      if (!beams.beamSfxCd || beams.beamSfxCd <= 0) { AU.play('shoot', 0.5); beams.beamSfxCd = 0.4; }
      if (beams.beamSfxCd) beams.beamSfxCd -= dt;
      /* an instant hitscan lance, not a moving projectile — it starts
         dead center on the ship's nose and reaches clean across the
         screen at any zoom level, instead of a fast bullet with a trail
         that could visually clip back through the ship it fired from */
      const bx = P.x + Math.cos(P.ang) * 22, by = P.y + Math.sin(P.ang) * 22;
      const range = 6000;
      const ex = bx + Math.cos(P.ang) * range, ey = by + Math.sin(P.ang) * range;
      beams.push({ x1: bx, y1: by, x2: ex, y2: ey, c: s.col, w: 6 });
      const dmg = s.gun * dt * 6;
      const allTgt = hostiles.concat(neutrals);
      for (const t of allTgt) {
        if (t.dead) continue;
        if (segDist(bx, by, ex, ey, t.x, t.y) < (t.rad || 36) + 4) hitShip(t, dmg, t.x, t.y, 'player');
      }
    }
  } else if (holding && gunCd <= 0) {
    AU.play('shoot', 0.7);
    const bx = P.x + Math.cos(P.ang) * 22, by = P.y + Math.sin(P.ang) * 22;
    if (s.gunType === 'twin') {
      /* double bullet stream: identical shot pattern to the single stream,
         just fired at half the rate (twice the interval) */
      gunCd = s.rate * 2;
      for (const off of [-9, 9]) {
        const ox = Math.cos(P.ang + Math.PI / 2) * off, oy = Math.sin(P.ang + Math.PI / 2) * off;
        bullets.push({ x: bx + ox, y: by + oy,
          vx: Math.cos(P.ang) * 1550 + P.vx, vy: Math.sin(P.ang) * 1550 + P.vy, l: 1.4, d: s.gun, mine: true, c: s.col });
      }
    } else if (s.gunType === 'missile') {
      /* one missile per press, flat 1-second cooldown regardless of tier,
         locking onto the nearest hostile or whoever last shot the player */
      gunCd = 1;
      let tgt = (G.lastAttacker && !G.lastAttacker.dead && !G.lastAttacker.gone) ? G.lastAttacker : null;
      if (!tgt) tgt = nearestHostile(P.x, P.y);
      bullets.push({ x: bx, y: by,
        vx: Math.cos(P.ang) * 700 + P.vx, vy: Math.sin(P.ang) * 700 + P.vy, l: 2.6, d: s.gun, mine: true, c: s.col,
        sz: 5, blast: s.gunBlast || 120, missile: true, homing: 2.4, accel: 380, maxSpd: 1400, tgt: tgt || null });
    } else {
      gunCd = s.rate;
      bullets.push({ x: bx, y: by,
        vx: Math.cos(P.ang) * 1550 + P.vx, vy: Math.sin(P.ang) * 1550 + P.vy, l: 1.4, d: s.gun, mine: true, c: s.col });
    }
  }
  for (const b of bullets) {
    /* a homing round steers toward whatever it was fired at, and keeps
       accelerating up to its own ceiling while it does */
    if (b.homing) {
      let tx = null, ty = null;
      if (b.tgt === 'P') { tx = P.x; ty = P.y; }
      else if (b.tgt && !b.tgt.dead && !b.tgt.gone) { tx = b.tgt.x; ty = b.tgt.y; }
      if (tx !== null) {
        const wa = Math.atan2(ty - b.y, tx - b.x);
        let a = Math.atan2(b.vy, b.vx);
        a += angDiff(a, wa) * b.homing * dt;
        let sp = Math.hypot(b.vx, b.vy) || 1;
        if (b.accel) sp = Math.min(b.maxSpd || 900, sp + b.accel * dt);
        b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
      }
      /* a visible trail, so a missile reads differently from a bolt */
      if (G.set.quality > 0 && Math.random() < 0.7)
        parts.push({ x: b.x, y: b.y, vx: -b.vx * 0.06, vy: -b.vy * 0.06, l: 0, m: 0.35, c: b.c, sz: 2.6 });
    }
    b.x += b.vx * dt; b.y += b.vy * dt; b.l -= dt;
    if (b.mine) {
      /* an incoming homing missile can be shot down outright — one hit and
         it detonates right where it was, same as running it into a hull */
      if (!b._interceptDone) {
        for (const m of bullets) {
          if (m === b || m.mine || !m.missile || m.l <= 0) continue;
          const rad = (m.sz || 5) + 10;
          if ((m.x - b.x) * (m.x - b.x) + (m.y - b.y) * (m.y - b.y) < rad * rad) {
            if (m.blast) blastAt(m.x, m.y, m.blast, m.d, false, 'player');
            boom(m.x, m.y, 8, '#ffc46b', 120);
            m.l = 0;
            if (!b.pierce) { b.l = 0; b._interceptDone = true; }
            break;
          }
        }
      }
      if (b.l <= 0) continue;
      const all = hostiles.concat(neutrals);
      for (const t of all) {
        if (t.dead) continue;
        const rad = (t.rad || 36) + 4;
        if ((t.x - b.x) * (t.x - b.x) + (t.y - b.y) * (t.y - b.y) < rad * rad) {
          hitShip(t, b.d, b.x, b.y, 'player');
          if (!b.pierce) b.l = 0;
          boom(b.x, b.y, 5, '#ffc46b', 90);
          if (!b.pierce) break;
        }
      }
      if (b.blast && b.l <= 0) blastAt(b.x, b.y, b.blast, b.d, true, 'player');
    } else if (b.side === 'p') {
      /* friendly fire from a hull flying with you — hostiles only */
      for (const t of hostiles) {
        if (t.dead) continue;
        const rad = (t.rad || 36) + 4;
        if ((t.x - b.x) * (t.x - b.x) + (t.y - b.y) * (t.y - b.y) < rad * rad) {
          hitShip(t, b.d, b.x, b.y, 'ally');
          if (!b.pierce) b.l = 0;
          boom(b.x, b.y, 5, '#9fe4b4', 90);
          if (!b.pierce) break;
        }
      }
      if (b.blast && b.l <= 0) blastAt(b.x, b.y, b.blast, b.d, false, 'ally');
    } else {
      const hitMe = !G.onFoot && (P.x - b.x) * (P.x - b.x) + (P.y - b.y) * (P.y - b.y) < 28 * 28;
      /* hostile rounds also take out the escorts flying with you */
      let hitAlly = null;
      if (!hitMe) {
        for (const t of neutrals) {
          if (t.dead || !t.ally) continue;
          const rad = (t.rad || 36) + 4;
          if ((t.x - b.x) * (t.x - b.x) + (t.y - b.y) * (t.y - b.y) < rad * rad) { hitAlly = t; break; }
        }
      }
      if (hitMe || hitAlly || (b.blast && b.l <= 0)) {
        if (b.blast) blastAt(b.x, b.y, b.blast, b.d, false, 'hostile');
        else if (hitAlly) { hitShip(hitAlly, b.d, b.x, b.y, 'hostile'); boom(b.x, b.y, 6, '#ff6a4d', 100); }
        else { if (b.owner) G.lastAttacker = b.owner; hurt(b.d, 'weapons fire'); boom(b.x, b.y, 6, '#ff6a4d', 100); }
        b.l = 0;
      }
    }
  }
  bullets = bullets.filter(b => b.l > 0);
  hostiles = hostiles.filter(t => !t.dead);
  neutrals = neutrals.filter(t => !t.dead);
}

/* damage one vessel, stripping its barrier first */
/* What an act of violence actually costs you with the people who own the
   hull. Standing runs -100 to 100 and everybody starts at nought, so these
   are deliberately small: one body barely registers, and it takes a very
   long campaign of it before a faction turns on you. */
const REP_COST = {
  civilian: -0.1,     /* one person, on the ground */
  ship1:    -0.2,     /* a rung-one hull */
  ship2:    -0.5,     /* a rung-two hull */
  ship3:    -1,       /* a carrier */
  ship4:    -10,      /* a whole world brought down */
  structure: -0.1,    /* one building levelled */
  settlement: -1,     /* an entire settlement razed */
  provoke:  -0.2      /* opening fire on someone who was not hostile */
};
function shipRepCost(tier) {
  const r = tierRank(tier);
  return r >= 4 ? REP_COST.ship4 : r === 3 ? REP_COST.ship3 : r === 2 ? REP_COST.ship2 : REP_COST.ship1;
}

function hitShip(t, dmg, fx, fy, src) {
  src = src || 'player';
  const T = VTIERS[t.tier] || VTIERS.fighter;
  if (t.barrier > 0) {
    const a = Math.min(t.barrier, dmg);
    t.barrier -= a; dmg -= a;
    float(t.x, t.y - (t.rad || 30) - 10, 'field ' + Math.round(t.barrier), '#6fd8ff');
    if (t.barrier <= 0) {
      /* the field is down and the generators need their minute */
      if (T.forcefield) {
        t.ffDown = T.ffCool || 60;
        say(t.name + '\u2019s forcefield collapsed. It cannot raise another for a minute.', 'good');
      }
      boom(t.x, t.y, 40, '#6fd8ff', (t.rad || 60) * 2.6);
    }
    if (dmg <= 0) return;
  }
  t.hp -= dmg;
  float(t.x, t.y - (t.rad || 30) - 10, '-' + Math.round(dmg), '#ffc46b');
  t.alarmed = true;
  if (!t.hostile && src === 'player') {
    t.hostile = true; t.state = 'attack'; t.ally = false; t.allyForced = false;
    if (!t.barbaric) {
      repChange(t.fac, REP_COST.provoke);
      say(t.name + ' returns fire. ' + FACTIONS[t.fac].n + ' will remember this.', 'bad');
    } else say(t.name + ' returns fire. Barbaric raiders — nobody civilised claims them.', 'bad');
  }
  if (t.hp <= 0 && !t.dead) {
    t.dead = true;
    const rank = tierRank(t.tier);
    if (t.parent) t.parent.brood = Math.max(0, t.parent.brood - 1);
    boom(t.x, t.y, rank >= 4 ? 220 : rank === 3 ? 90 : 36, '#ff6a4d', 280 + (t.rad || 30) * 2);
    if (src !== 'player') {
      /* somebody else got the kill — no salvage, no standing hit for you */
      say(t.name + ' went down. Not your kill.', '');
      return;
    }
    G.stat.kills++;
    if (rank === 3) G.stat.motherKills = (G.stat.motherKills || 0) + 1;
    if (rank >= 4) G.stat.cityKills = (G.stat.cityKills || 0) + 1;
    const pay = Math.round(T.pay * rr(Math.random, 0.7, 1.4));
    G.credits += pay;
    const drops = rank >= 4 ? 6 : rank === 3 ? 3 : 1;
    for (let i = 0; i < drops; i++) addRes(pick(Math.random, ORE_KEYS), 12 + Math.floor(Math.random() * 22));
    /* the owners take note, in proportion to what you just destroyed —
       unless this was an unaffiliated barbarian, which nobody vouches for */
    if (!t.barbaric) {
      repChange(t.fac, shipRepCost(t.tier));
      if (t.kind === 'pirate') repChange(sys && sys.faction !== 'none' ? sys.faction : 'free', 0.02);
    }
    say(t.name + ' destroyed. Salvage worth ' + fmt(pay) + '.', rank === 1 ? 'good' : 'rare');
    if (rank >= 4) discover('city:' + t.id, t.name, 'Vessel', 'A hull the size of a world brought down. Nobody does this twice in one lifetime.', 90000);
  }
}

/* a blast hurts everything near it, including you */
function blastAt(x, y, rad, dmg, mine, src) {
  src = src || (mine ? 'player' : 'hostile');
  boom(x, y, 30, '#ff8a5f', rad * 2.4);
  if (G.set.shake) cam.shake = Math.min(30, cam.shake + 10);
  /* who the blast is allowed to touch depends on who set it off */
  const list = src === 'player' ? hostiles.concat(neutrals)
             : src === 'ally'   ? hostiles
             : hostiles.concat(neutrals).filter(t => t.ally);
  for (const t of list) {
    if (t.dead) continue;
    const d = Math.hypot(t.x - x, t.y - y);
    if (d < rad + (t.rad || 30)) hitShip(t, dmg * clamp(1 - d / (rad * 1.6), 0.25, 1), x, y, src);
  }
  if (src !== 'ally' && !G.onFoot) {
    const pd = Math.hypot(P.x - x, P.y - y);
    if (pd < rad) hurt(dmg * clamp(1 - pd / (rad * 1.6), 0.2, 1) * (mine ? 0.5 : 1), 'blast');
  }
}

/* ------------------------------------------------------------
   23. GROUND AI
------------------------------------------------------------ */
function aiCreature(c, dt) {
  c.t += dt;
  const dx = P.x - c.x, dy = P.y - c.y, d = Math.hypot(dx, dy) || 1;
  const sees = d < (c.temper === 'predator' ? 620 : c.temper === 'behemoth' ? 780 : 380);
  let tx = c.hx + Math.cos(c.t * 0.5 + c.ph) * c.rad;
  let ty = c.hy + Math.sin(c.t * 0.4 + c.ph) * c.rad;

  if (c.hp < c.max * 0.35 && c.temper !== 'predator' && c.temper !== 'behemoth') c.state = 'flee';
  else if (c.angry && d < 900) c.state = 'chase';
  else if (sees) {
    if (c.temper === 'aggressive' || c.temper === 'predator' || c.temper === 'behemoth') c.state = 'chase';
    else if (c.temper === 'skittish') c.state = 'flee';
    else if (c.temper === 'curious') c.state = 'approach';
    else c.state = 'wander';
  } else if (c.state !== 'wander' && d > 1200) c.state = 'wander';

  if (c.state === 'chase') { tx = P.x; ty = P.y; }
  else if (c.state === 'flee') { tx = c.x - dx * 3; ty = c.y - dy * 3; }
  else if (c.state === 'approach') { tx = P.x - (dx / d) * 190; ty = P.y - (dy / d) * 190; }

  const a = Math.atan2(ty - c.y, tx - c.x);
  const spd = c.sp * (c.state === 'chase' || c.state === 'flee' ? 1.6 : 0.6);
  c.vx = lerp(c.vx, Math.cos(a) * spd, 3 * dt);
  c.vy = lerp(c.vy, Math.sin(a) * spd, 3 * dt);
  c.x += c.vx * dt; c.y += c.vy * dt;
  c.face = c.vx < 0 ? -1 : 1;

  /* the behemoth lobs three bombs at once while it is still closing the
     distance, then just keeps swinging once it is on top of you */
  if (c.temper === 'behemoth' && c.state === 'chase') {
    c.bombCd = (c.bombCd || 0) - dt;
    if (c.bombCd <= 0 && d > c.sz + 40 && d < 900) {
      c.bombCd = rr(Math.random, 1.8, 2.6);
      const base = Math.atan2(dy, dx);
      for (const off of [-0.32, 0, 0.32]) {
        addShot({ x: c.x + Math.cos(base + off) * c.sz, y: c.y + Math.sin(base + off) * c.sz,
          vx: Math.cos(base + off) * 340, vy: Math.sin(base + off) * 340,
          l: 1.6, d: c.dmg, mine: false, c: '#ff6a4d', sz: 6, blast: 70, fuse: 1.6 });
      }
      AU.play('attack', 0.9);
    }
  }

  if (c.state === 'chase' && d < c.sz + 26) {
    c.hitCd = (c.hitCd || 0) - dt;
    if (c.hitCd <= 0) {
      c.hitCd = 1.2;
      if (G.onFoot) hurtSuit(c.dmg); else hurt(c.dmg * 0.6, c.name);
      AU.play('attack', 0.8);
    }
  }
}
/* Residents have their own opinions and their own trigger fingers. They
   will shoot a predator that wanders into the market, they will shoot you
   if their town has decided you are a problem, and a settlement that likes
   you will step in when something is chewing on you outside the gate. */
function npcPickTarget(n, st, cells) {
  const mood = civMood(st);
  /* you, if this place wants you gone */
  if (st.hostile || mood === 'hostile') {
    const d = Math.hypot(P.x - n.x, P.y - n.y);
    if (d < 620) return { x: P.x, y: P.y, d: d, isPlayer: true };
  }
  /* anything aggressive inside or near the perimeter */
  let best = null, bd = Infinity;
  for (const c of cells) for (const cr of c.crits) {
    if (cr.dead) continue;
    const threat = cr.angry || cr.temper === 'aggressive' || cr.temper === 'predator';
    if (!threat) continue;
    const insideTown = (cr.x - st.x) * (cr.x - st.x) + (cr.y - st.y) * (cr.y - st.y) < (st.r + 260) * (st.r + 260);
    /* a town that likes you will come out past its own fence to help */
    const nearYou = (mood === 'allied' || mood === 'warm') &&
      (cr.x - P.x) * (cr.x - P.x) + (cr.y - P.y) * (cr.y - P.y) < 420 * 420 &&
      (P.x - st.x) * (P.x - st.x) + (P.y - st.y) * (P.y - st.y) < 1400 * 1400;
    if (!insideTown && !nearYou) continue;
    /* defending the street is a short walk; covering you is a longer one,
       and the guard closes the distance before it starts shooting */
    const reach = insideTown ? 560 : (mood === 'allied' ? 1300 : 950);
    const d = (cr.x - n.x) * (cr.x - n.x) + (cr.y - n.y) * (cr.y - n.y);
    if (d > reach * reach) continue;
    if (d < bd) { bd = d; best = { x: cr.x, y: cr.y, d: Math.sqrt(d), crit: cr, escort: !insideTown }; }
  }
  return best;
}
function aiNpc(n, dt, st, cells) {
  if (n.dead) return;
  n.t = (n.t || 0) + dt;
  n.alertT = Math.max(0, (n.alertT || 0) - dt);
  n.cd -= dt;

  const tgt = (n.weapon && (n.alertT > 0 || st.alert > 0 || st.hostile)) ? npcPickTarget(n, st, cells) : null;
  if (tgt) {
    n.state = 'fight';
    n.face = tgt.x < n.x ? -1 : 1;
    /* hold a firing line rather than walking into the thing — but when
       they are coming out to help you, let them run rather than saunter */
    const keep = n.weapon === 'bomb' ? 300 : 230;
    const pace = tgt.escort ? 168 : 92;
    const a = Math.atan2(tgt.y - n.y, tgt.x - n.x);
    const push = tgt.d > keep ? 1 : -0.7;
    n.x += Math.cos(a) * pace * push * dt;
    n.y += Math.sin(a) * pace * push * dt;
    if (n.cd <= 0 && tgt.d < 620) {
      n.cd = rr(Math.random, 0.7, 1.5) * (n.weapon === 'bomb' ? 2.1 : 1);
      npcShoot(n, tgt.x, tgt.y);
    }
    return;
  }
  if (n.state === 'fight' && n.alertT <= 0) n.state = 'idle';
  /* normal day: potter about near where they live */
  const tx = n.hx + Math.cos(n.t * 0.28 + n.ph) * 55;
  const ty = n.hy + Math.sin(n.t * 0.22 + n.ph) * 40;
  n.x = lerp(n.x, tx, 1.2 * dt); n.y = lerp(n.y, ty, 1.2 * dt);
}

/* A hostile town does not only shoot — it drops charges on you and it
   walls itself in while you stand there deciding what to do. */
function settlementTick(st, dt, cells) {
  if (st.alert > 0) st.alert -= dt;
  if (!st.hostile && civMood(st) === 'hostile') {
    const d = Math.hypot(P.x - st.x, P.y - st.y);
    if (d < st.r + 400) st.hostile = true;
  }
  if (!st.hostile) return;
  const d = Math.hypot(P.x - st.x, P.y - st.y);
  st.bombCd -= dt;
  if (st.bombCd <= 0 && d < st.r + 700) {
    st.bombCd = rr(Math.random, 4.5, 9);
    /* lobbed ahead of where you are going, not where you are */
    const lead = 0.9;
    const tx = P.x + P.vx * lead, ty = P.y + P.vy * lead;
    const a = Math.atan2(ty - st.y, tx - st.x);
    addShot({ x: st.x + Math.cos(a) * 60, y: st.y + Math.sin(a) * 60,
      vx: Math.cos(a) * 340, vy: Math.sin(a) * 340, l: Math.min(2.6, Math.hypot(tx - st.x, ty - st.y) / 340),
      d: 46, mine: false, c: '#ff8a5f', sz: 6, blast: 150 });
    say(st.name + ' is dropping charges.', 'bad');
  }
  /* they put walls up between raids */
  const m = civMem(st);
  if ((m.walls || 0) < 8 && Math.random() < dt * 0.06 && d > st.r + 500) {
    m.walls = (m.walls || 0) + 1;
    const a = Math.random() * TAU;
    st.walls.push({ x: st.x + Math.cos(a) * 340, y: st.y + Math.sin(a) * 340, a: a, hp: 600, max: 600 });
  }
}

/* A lone traveller still needs a "settlement" object for the shared AI —
   they are a town of one, with no walls and nothing to defend. */
const LONE = {};
function loneTown(n) {
  if (!LONE[n.id]) LONE[n.id] = { id: 'lone:' + n.id, name: n.name, fac: n.fac, x: n.x, y: n.y, r: 120,
    huts: [], npcs: [n], walls: [], alert: 0, hostile: false, bombCd: 99, lone: true };
  const t = LONE[n.id]; t.x = n.x; t.y = n.y;
  return t;
}

/* Your own defence turrets shoot back on your behalf. */
function turretTick(dt, cells) {
  if (!planet) return;
  const site = siteFor(planet.id);
  if (!site) return;
  for (const bd of site.build) {
    const d = BUILDS[bd.t];
    if (!d || !d.turret) continue;
    bd.cd = (bd.cd || 0) - dt;
    if (bd.cd > 0) continue;
    let best = null, bdist = 620 * 620;
    for (const c of cells) for (const cr of c.crits) {
      if (cr.dead) continue;
      if (!(cr.angry || cr.temper === 'aggressive' || cr.temper === 'predator')) continue;
      const dd = (cr.x - bd.x) * (cr.x - bd.x) + (cr.y - bd.y) * (cr.y - bd.y);
      if (dd < bdist) { bdist = dd; best = cr; }
    }
    if (!best) continue;
    bd.cd = 0.8;
    const a = Math.atan2(best.y - bd.y, best.x - bd.x);
    addShot({ x: bd.x, y: bd.y, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900,
      l: 0.8, d: 22, mine: true, c: '#4fe3d0', sz: 2.6 });
  }
}


/* ------------------------------------------------------------
   23b. GROUND COMBAT
   One projectile list serves you, the militia and anything with
   a grudge. Everything on the ground that can be shot has hp,
   a faction and an opinion about being shot at.
------------------------------------------------------------ */
let shots = [];
let piles = [];
let gunCool = 0;

/* dropped cargo sits where you left it until you walk back over it */
function pileTick(dt) {
  for (let i = piles.length - 1; i >= 0; i--) {
    const q = piles[i];
    q.t += dt;
    /* Despawn after 5 minutes (300 seconds) */
    if (q.t > 300) {
      piles.splice(i, 1);
      continue;
    }
    if ((q.x - P.x) * (q.x - P.x) + (q.y - P.y) * (q.y - P.y) < 46 * 46 && q.t > 1.2) {
      const got = addRes(q.k, q.n);
      if (got > 0) {
        q.n -= got;
        float(q.x, q.y - 16, '+' + got + ' ' + MAT[q.k].n, MAT[q.k].c);
        AU.play('buy', 0.4);
        if (q.n <= 0) piles.splice(i, 1);
      }
    }
  }
}

function addShot(o) { shots.push(o); if (shots.length > 260) shots.shift(); }

function firePlayerGun(cells, dt) {
  const W2 = curGun();
  /* heat: sustained fire weapons punish you for holding the trigger */
  if (gunCool > 0) { gunCool -= dt; return; }
  if (W2.mode === 'beam') {
    G.gunHeat = Math.min(120, G.gunHeat + W2.heat * 60 * dt);
    if (G.gunHeat >= 120) { gunCool = 2.2; say('Emitter overheated.', 'warn'); return; }
    const ex = P.x + Math.cos(P.ang) * W2.range, ey = P.y + Math.sin(P.ang) * W2.range;
    beams.push({ x1: P.x, y1: P.y, x2: ex, y2: ey, c: W2.col, w: 5 });
    if (Math.random() < 0.5) AU.play('shoot', 0.3);
    for (const tgt of groundTargets(cells)) {
      if (segDist(P.x, P.y, ex, ey, tgt.x, tgt.y) < (tgt.rad || 20)) hurtGround(tgt, W2.dmg * dt, W2.col);
    }
    return;
  }
  if (P.gunCd > 0) return;
  P.gunCd = W2.rate;
  G.gunHeat = Math.min(120, G.gunHeat + (W2.heat || 0.25) * 22);
  if (G.gunHeat >= 120) { gunCool = 1.6; say(W2.n + ' jammed from heat.', 'warn'); }

  if (W2.mode === 'melee') {
    AU.play('attack', 0.8);
    let best = null, bd = W2.range * W2.range;
    for (const tgt of groundTargets(cells)) {
      const d = (tgt.x - P.x) * (tgt.x - P.x) + (tgt.y - P.y) * (tgt.y - P.y);
      if (d < bd) { bd = d; best = tgt; }
    }
    if (best) { hurtGround(best, W2.dmg, '#ffc46b'); boom(best.x, best.y, 5, '#ffc46b', 70); }
    return;
  }
  AU.play('shoot', 0.55);
  const n = W2.pellets || 1;
  for (let i = 0; i < n; i++) {
    const a = P.ang + (W2.spread ? (Math.random() - 0.5) * W2.spread : 0);
    addShot({ x: P.x + Math.cos(P.ang) * 14, y: P.y + Math.sin(P.ang) * 14,
      vx: Math.cos(a) * W2.spd, vy: Math.sin(a) * W2.spd,
      l: W2.mode === 'bomb' ? W2.fuse : W2.range / W2.spd,
      d: W2.dmg / n * (1 + crewBonus('gunnery') * 0.2), mine: true, c: W2.col, sz: W2.sz,
      blast: W2.blast || 0, pierce: W2.mode === 'pierce' });
  }
}

/* everything on the ground that can take a hit from you */
function groundTargets(cells) {
  const out = [];
  for (const c of cells) {
    for (const cr of c.crits) if (!cr.dead) out.push({ kind: 'crit', o: cr, x: cr.x, y: cr.y, rad: cr.sz + 8 });
    if (c.wanderer && !c.wanderer.dead) out.push({ kind: 'npc', o: c.wanderer, st: loneTown(c.wanderer), x: c.wanderer.x, y: c.wanderer.y, rad: 16 });
    if (c.settlement) {
      const st = c.settlement;
      for (const n of st.npcs) if (!n.dead) out.push({ kind: 'npc', o: n, st: st, x: n.x, y: n.y, rad: 16 });
      for (const h of st.huts) if (!h.dead) out.push({ kind: 'hut', o: h, st: st, x: h.x, y: h.y, rad: Math.max(h.w, h.h) * 0.55 });
      for (const w of st.walls) if (w.hp > 0) out.push({ kind: 'wall', o: w, st: st, x: w.x, y: w.y, rad: 40 });
    }
  }
  return out;
}

function hurtGround(tgt, dmg, col) {
  const o = tgt.o;
  o.hp -= dmg;
  float(tgt.x, tgt.y - (tgt.rad || 18) - 8, '-' + Math.round(dmg), col || '#ffc46b');
  if (tgt.kind === 'crit') {
    o.angry = true; o.state = 'chase';
    if (o.hp <= 0) {
      o.dead = true;
      G.stat.groundKills = (G.stat.groundKills || 0) + 1;
      let got = 0;
      for (const d of o.drops) got += addRes(d, ri(Math.random, 2, 6));
      say(o.name + ' down. Recovered ' + got + ' units.', 'good');
      AU.play('break', 0.8);
    }
    return;
  }
  const st = tgt.st;
  if (st) { alertSettlement(st, 1); civBump(st, -3); }
  if (tgt.kind === 'npc') {
    if (o.hp <= 0 && !o.dead) {
      o.dead = true;
      if (st.lone) G.civState['wdead:' + o.id] = 1; else { const m = civMem(st); m.npcDead[o.id] = 1; }
      boom(o.x, o.y, 14, o.col, 140);
      repChange(o.fac, REP_COST.civilian); civBump(st, -14);
      G.bounty += 2500;
      say('You killed ' + o.name + '. ' + FACTIONS[o.fac].n + ' will hear about it.', 'bad');
      /* the rest of them stop pretending they are not armed */
      for (const other of st.npcs) if (!other.dead) { other.state = 'fight'; other.alertT = 40; }
    }
    return;
  }
  if (tgt.kind === 'wall') {
    if (o.hp <= 0) { boom(o.x, o.y, 18, '#8fa9b4', 160); const m = civMem(st); m.walls = Math.max(0, (m.walls || 0) - 1); }
    return;
  }
  if (tgt.kind === 'hut') {
    const m = civMem(st);
    m.hut[o.i] = o.hp;
    if (o.hp <= 0 && !o.dead) {
      o.dead = true;
      boom(o.x, o.y, 30, '#ff8a5f', 220);
      AU.play('break', 1);
      /* whatever they had stored is now yours */
      let got = 0;
      const loot = ['ferrite','alloy','circuit','carbon'].concat(planet ? planet.res : []);
      for (let i = 0; i < 3; i++) got += addRes(pick(Math.random, loot), ri(Math.random, 12, 40));
      G.credits += 3000 + Math.floor(Math.random() * 7000);
      say('Structure levelled. Stripped ' + got + ' units out of the rubble.', 'warn');
      repChange(st.fac, REP_COST.structure);
      checkRazed(st);
    }
  }
}

/* a settlement with nothing left standing belongs to whoever is holding it */
function checkRazed(st) {
  const alive = st.huts.filter(h => !h.dead).length;
  if (alive > 0 || st.razed) return;
  st.razed = true;
  G.stat.razed = (G.stat.razed || 0) + 1;
  const m = civMem(st); m.razed = true;
  repChange(st.fac, REP_COST.settlement);
  G.bounty += 40000;
  const haul = {};
  for (const k of (planet ? planet.res : ['ferrite'])) haul[k] = ri(Math.random, 60, 200);
  let got = 0; for (const k in haul) got += addRes(k, haul[k]);
  G.credits += 40000;
  say(st.name + ' is gone. You take what is left: ' + got + ' units and 40K.', 'bad');
  discover('raze:' + st.id, 'Ruins of ' + st.name, 'Empire',
    'A ' + FACTIONS[st.fac].n + ' holding you pulled down yourself. The charts have not caught up.', 15000);
}

function alertSettlement(st, level) {
  st.alert = Math.max(st.alert, 26);
  const mood = civMood(st);
  if (level >= 1 && (mood === 'hostile' || mood === 'cold' || level >= 2)) st.hostile = true;
  for (const n of st.npcs) if (!n.dead) { n.state = 'fight'; n.alertT = 30; }
}

/* --------------------------- ground projectiles --------------------------- */
function groundCombat(dt, cells) {
  P.gunCd = Math.max(0, (P.gunCd || 0) - dt);
  G.gunHeat = Math.max(0, G.gunHeat - 26 * dt);

  const targets = groundTargets(cells);
  for (const s of shots) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.l -= dt;
    if (s.mine) {
      for (const tgt of targets) {
        const rad = (tgt.rad || 18) + 3;
        if ((tgt.x - s.x) * (tgt.x - s.x) + (tgt.y - s.y) * (tgt.y - s.y) < rad * rad) {
          if (!s.blast) hurtGround(tgt, s.d, s.c);
          if (!s.pierce) { s.l = 0; break; }
        }
      }
    } else {
      /* incoming — can hit you, and friendly fire hits creatures too */
      if (!s.blast) {
        for (const tgt of targets) {
          if (tgt.kind !== 'crit') continue;
          const rad = (tgt.rad || 18) + 3;
          if ((tgt.x - s.x) * (tgt.x - s.x) + (tgt.y - s.y) * (tgt.y - s.y) < rad * rad) { hurtGround(tgt, s.d, s.c); s.l = 0; break; }
        }
      }
      if (s.l > 0 && (P.x - s.x) * (P.x - s.x) + (P.y - s.y) * (P.y - s.y) < 20 * 20) {
        /* on foot, incoming fire hurts the suit. Standing in the ship on the
           surface, the same fire hits the hull instead — the body is safe
           inside the hull, so the ship soaks the round, not the player. */
        if (!s.blast) { if (G.onFoot) hurtSuit(s.d); else hurt(s.d, 'weapons fire'); boom(s.x, s.y, 5, s.c, 80); }
        s.l = 0;
      }
    }
    if (s.l <= 0 && s.blast) groundBlast(s.x, s.y, s.blast, s.d, s.mine, targets);
  }
  shots = shots.filter(s => s.l > 0);
}

function groundBlast(x, y, rad, dmg, mine, targets) {
  boom(x, y, 34, '#ff8a5f', rad * 2.2);
  AU.play('break', 1);
  if (G.set.shake) cam.shake = Math.min(26, cam.shake + 12);
  for (const tgt of targets) {
    const d = Math.hypot(tgt.x - x, tgt.y - y);
    if (d < rad + (tgt.rad || 18)) hurtGround(tgt, dmg * clamp(1 - d / (rad * 1.5), 0.25, 1), '#ff8a5f');
  }
  const pd = Math.hypot(P.x - x, P.y - y);
  if (pd < rad) {
    const amt = dmg * clamp(1 - pd / (rad * 1.5), 0.2, 1) * (mine ? 0.45 : 1);
    if (G.onFoot) hurtSuit(amt); else hurt(amt, 'a blast');
  }
}

function npcShoot(n, tx, ty) {
  const key = n.weapon || 'bolt';
  const W2 = NPC_GUNS[key] || NPC_GUNS.bolt;
  const a = Math.atan2(ty - n.y, tx - n.x) + (Math.random() - 0.5) * 0.14;
  const spd = (W2.spd || 900) * 0.62;
  AU.play('shoot', 0.35);
  addShot({ x: n.x + Math.cos(a) * 12, y: n.y + Math.sin(a) * 12,
    vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
    l: key === 'bomb' ? 1.5 : 1.3, d: n.dmg * (key === 'ray' ? 1.7 : key === 'bomb' ? 2.2 : 1),
    mine: false, c: W2.col, sz: W2.sz || 3, blast: key === 'bomb' ? 110 : 0, src: n.id });
}

/* ------------------------------------------------------------
   23c. COLONY DISTRICTS
   A claimed world is not a civilisation until you draw a line
   around part of it and say this bit is mine.
------------------------------------------------------------ */
function districtsOf(pid) {
  const co = G.colonies[pid];
  if (!co) return [];
  if (!co.districts) co.districts = [];
  return co.districts;
}
function districtCost(co) { return Math.round(30000 * Math.pow(1.9, (co.districts || []).length)); }
function insideDistrict(pid, x, y) {
  const list = districtsOf(pid);
  for (const d of list) if ((d.x - x) * (d.x - x) + (d.y - y) * (d.y - y) < d.r * d.r) return d;
  return null;
}
function sheltered(x, y) {
  if (!planet) return null;
  const d = insideDistrict(planet.id, x, y);
  return d && d.stab ? d : null;
}
/* a ring counts as stabilised when a stabiliser stands inside it */
let distAcc = 0;
function syncDistricts(pid, force) {
  if (!force) { distAcc -= 1; if (distAcc > 0) return; }
  distAcc = 30;
  const co = G.colonies[pid];
  if (!co) return;
  for (const d of districtsOf(pid)) {
    d.stab = false;
    for (const b of co.build) {
      const def = BUILDS[b.t];
      if (!def || !def.stab) continue;
      if ((b.x - d.x) * (b.x - d.x) + (b.y - d.y) * (b.y - d.y) < d.r * d.r) { d.stab = true; break; }
    }
  }
}
function upgradeDistrict(pid, i) {
  const list = districtsOf(pid), d = list[i];
  if (!d) return;
  const cost = Math.round(24000 * Math.pow(1.7, d.lvl));
  if (G.credits < cost) { say('Widening the ring costs ' + fmt(cost) + ' units.', 'bad'); return; }
  G.credits -= cost;
  d.lvl++; d.r += 300;
  syncDistricts(pid, true);
  AU.play('upgrade');
  say(d.name + ' widened to ' + Math.round(d.r) + ' metres.', 'good');
}
function addDistrict(pid) {
  const co = G.colonies[pid];
  if (!co) { say('Claim this world before you start drawing borders.', 'warn'); return; }
  const list = districtsOf(pid);
  const cost = districtCost(co);
  if (G.credits < cost) { say('A border ring costs ' + fmt(cost) + ' units.', 'bad'); return; }
  G.credits -= cost;
  list.push({ x: P.x, y: P.y, r: 700, lvl: 1, stab: false, name: co.name + ' ' + toRoman(list.length + 1) });
  AU.play('upgrade');
  say('Border ring set. ' + list[list.length - 1].name + ' is marked out on the ground.', 'rare');
}
function toRoman(n) { return ['I','II','III','IV','V','VI','VII','VIII','IX','X'][n - 1] || ('' + n); }

/* ------------------------------------------------------------
   24. MODE UPDATES
------------------------------------------------------------ */
let sysTarget = null, stTarget = false, galTarget = null, hailTarget = null, cityTarget = null;
let mineTarget = null, nodeTarget = null, talkTarget = null, structTarget = null;
let waterTarget = null, plotTarget = null, critTarget = null, baseTarget = null;
let talkTown = null;

/* The pull of a collapse. It starts as a nudge at the edge of reach and
   turns into something you cannot out-burn well before the middle; past the
   core radius there is no escape and no survival. */
let holeNear = null, holeWarn = 0;
function blackHoleTick(dt) {
  holeNear = null;
  holeWarn = Math.max(0, holeWarn - dt);
  for (const s of nearbySystems(P.x, P.y, 2)) {
    if (!s || !s.blackhole) continue;
    const dx = s.x - P.x, dy = s.y - P.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > BLACKHOLE_REACH) continue;
    const k = 1 - d / BLACKHOLE_REACH;          /* 0 at the edge, 1 at the middle */
    const a = 120 + k * k * k * 4200;
    P.vx += (dx / d) * a * dt;
    P.vy += (dy / d) * a * dt;
    /* a little sideways drag, so you spiral rather than fall straight in */
    P.vx += (-dy / d) * a * 0.22 * dt * s.spin;
    P.vy += (dx / d) * a * 0.22 * dt * s.spin;
    if (!holeNear || d < holeNear.d) holeNear = { s: s, d: d, k: k };
    if (G.set.shake) cam.shake = Math.min(26, cam.shake + k * k * 40 * dt);
    if (d < BLACKHOLE_CORE && !G.over) {
      G.hull = 0; G.shield = 0;
      boom(P.x, P.y, 60, '#d484ff', 400);
      death('the ' + s.name);
      return;
    }
  }
  if (holeNear && holeWarn <= 0) {
    holeWarn = 6;
    if (holeNear.k > 0.6) say('You are not going to out-burn this. Turn now.', 'bad');
    else if (holeNear.k > 0.28) say('The ' + holeNear.s.name + ' has you. Burn away from it.', 'bad');
    else say('Something ahead is bending the starlight. Give it a wide berth.', 'warn');
  }
}

function updGalaxy(dt) {
  flyControls(dt, { drag: 0.08, boostMul: 4.2 });
  G.shield = Math.min(ST().shield, G.shield + ST().regen * dt);
  blackHoleTick(dt);
  if (G.over) return;
  
  /* Deep space random spawns */
  if (true) {
    const roll = Math.random();
    if (roll < 0.05 * dt) {
      const r = rng((Math.random() * 1e9) | 0);
      const a = Math.random() * TAU, d = 2000 + Math.random() * 3000;
      const t = makeTraffic(r, null, P.x + Math.cos(a) * d, P.y + Math.sin(a) * d, { tier: 'fighter', hostile: true, kind: 'pirate', force: true });
      t.state = 'hunt'; hostiles.push(t);
    } else if (roll < 0.07 * dt) {
      const r = rng((Math.random() * 1e9) | 0);
      const a = Math.random() * TAU, d = 2000 + Math.random() * 3000;
      const t = makeTraffic(r, null, P.x + Math.cos(a) * d, P.y + Math.sin(a) * d, { tier: 'milita', hostile: true, kind: 'pirate', force: true });
      t.state = 'hunt'; hostiles.push(t);
    } else if (roll < 0.071 * dt) {
      /* Barbarian army: 1 tier 3, 3 tier 2s, 6 tier 1s */
      const r = rng((Math.random() * 1e9) | 0);
      const baseX = P.x + (Math.random() - 0.5) * 4000, baseY = P.y + (Math.random() - 0.5) * 4000;
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * TAU, d = 500 + Math.random() * 800;
        const t = makeTraffic(r, null, baseX + Math.cos(a) * d, baseY + Math.sin(a) * d, { tier: 'fighter', hostile: true, kind: 'barbarian', force: true });
        t.state = 'hunt'; hostiles.push(t);
      }
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * TAU, d = 800 + Math.random() * 600;
        const t = makeTraffic(r, null, baseX + Math.cos(a) * d, baseY + Math.sin(a) * d, { tier: 'milita', hostile: true, kind: 'barbarian', force: true });
        t.state = 'hunt'; hostiles.push(t);
      }
      const a = Math.random() * TAU, d = 1000 + Math.random() * 500;
      const t = makeTraffic(r, null, baseX + Math.cos(a) * d, baseY + Math.sin(a) * d, { tier: 'mother', hostile: true, kind: 'barbarian', force: true });
      t.state = 'hunt'; hostiles.push(t);
      say('A barbarian armada has appeared on sensors!', 'bad');
    }
  }
  galTarget = null; let best = 1e18;
  for (const s of nearbySystems(P.x, P.y, 2)) {
    if (s.blackhole) continue;   /* there is nothing to enter */
    const d = (s.x - P.x) * (s.x - P.x) + (s.y - P.y) * (s.y - P.y);
    if (d < 460 * 460 && d < best) { best = d; galTarget = s; }
  }
  if (tap('KeyE') && galTarget) enterSystem(galTarget, Math.atan2(P.y - galTarget.y, P.x - galTarget.x));
  if (tap('KeyF')) {
    let n = 0;
    for (const s of nearbySystems(P.x, P.y, 1)) {
      if ((s.x - P.x) * (s.x - P.x) + (s.y - P.y) * (s.y - P.y) < 2400 * 2400 && !G.codex['sys:' + s.key]) {
        n++; G.stat.scans++;
        if (s.blackhole) {
          discover('sys:' + s.key, s.name, 'System',
            'A collapsed star. No orbits, no light, and a gravity well that reaches ten times further than it looks. ' +
            'Nothing that has crossed the middle has come back.', 9000);
        } else {
          discover('sys:' + s.key, s.name + ' system', 'System',
            s.star.n + ' · ' + s.planets.length + ' worlds · ' + FACTIONS[s.faction].n, 2400);
        }
      }
    }
    if (!n) say('Long-range scan returns nothing new.', '');
  }
  combat(dt); updTraffic(dt);
  encounterTick(dt);
  followCam(dt, 0.32, 0.6, 9000, 0.3);
}

function updSystem(dt) {
  flyControls(dt, { drag: 0.10, boostMul: 3.4 });
  const s = ST();
  G.shield = Math.min(s.shield, G.shield + s.regen * dt);
  
  /* Shield regenerates slowly out of combat; hull never self-repairs —
     only the shield gets the 1-10 HP/sec trickle. */
  const inCombat = gunCd > 0 || hostiles.some(t => !t.dead && Math.hypot(t.x - P.x, t.y - P.y) < 3000);
  if (!inCombat) {
    const shieldRegen = 1 + Math.random() * 9;
    G.shield = Math.min(s.shield, G.shield + shieldRegen * dt);
  }
  
  /* Enemy ship regeneration */
  for (const t of [...hostiles, ...neutrals]) {
    if (t.dead) continue;
    const enemyInCombat = t.cd > 0 || (t.state === 'attack' || t.state === 'hunt');
    if (!enemyInCombat && t.hp < t.max) {
      const regen = 1 + Math.random() * 9;
      t.hp = Math.min(t.max, t.hp + regen * dt);
    }
  }
  
  const near = applyGravity(dt);
  surfaceContact(near);
  G.nearPlanet = near;

  sysTarget = null; stTarget = false; hailTarget = null;
  let best = 1e18;
  for (const pl of sys.planets) {
    const pp = planetPos(pl, G.t);
    const d = (pp[0] - P.x) * (pp[0] - P.x) + (pp[1] - P.y) * (pp[1] - P.y);
    if (d < (pl.r + 420) * (pl.r + 420) && d < best) { best = d; sysTarget = pl; }
  }
  if (sys.hasStation) {
    const sp = stationPos(sys, G.t);
    if ((sp[0] - P.x) * (sp[0] - P.x) + (sp[1] - P.y) * (sp[1] - P.y) < 360 * 360) { stTarget = true; sysTarget = null; }
  }
  cityTarget = null;
  for (const t of neutrals) {
    const reach = tierRank(t.tier) >= 4 ? (t.rad + 260) : tierRank(t.tier) === 3 ? (t.rad + 200) : 520;
    const d = (t.x - P.x) * (t.x - P.x) + (t.y - P.y) * (t.y - P.y);
    if (d < reach * reach) {
      if (isLandable(t)) { cityTarget = t; sysTarget = null; stTarget = false; }
      else if (!hailTarget) hailTarget = t;
    }
  }

  if (tap('KeyE')) {
    if (cityTarget) landOnCity(cityTarget);
    else if (stTarget) { G.docked = true; G.stat.docked = true; openPanel('market'); AU.play('buy', 0.5); say('Docked at ' + (sys.stName || 'the station') + '.', 'good'); }
    else if (hailTarget) hailShip(hailTarget);
    else if (sysTarget) {
      const pp = planetPos(sysTarget, G.t);
      const d = Math.hypot(pp[0] - P.x, pp[1] - P.y);
      if (d < sysTarget.r + 200) landOn(sysTarget, true);
      else say('Too high to set down. Close to within ' + Math.round(sysTarget.r + 200) + ' and try again, or just fly into it gently.', 'warn');
    }
  }
  if (tap('KeyF')) {
    let done = false;
    for (const pl of sys.planets) {
      const pp = planetPos(pl, G.t);
      if ((pp[0] - P.x) * (pp[0] - P.x) + (pp[1] - P.y) * (pp[1] - P.y) < 1600 * 1600 && !pl.scanned) {
        pl.scanned = true; G.stat.scans++; done = true;
        discover('pl:' + pl.id, pl.name, 'World',
          BIOMES[pl.biome].n + ' world · life ' + pl.life.toLowerCase() + ' · ' + pl.res.map(k => MAT[k].n).join(', '),
          3200 + pl.res.length * 900);
      }
    }
    for (const t of neutrals.concat(hostiles)) {
      if (!t.scanned && (t.x - P.x) * (t.x - P.x) + (t.y - P.y) * (t.y - P.y) < 1400 * 1400) {
        t.scanned = true; done = true;
        discover('ship:' + t.id, t.name, 'Vessel', SHIPS[t.shipKey].cl + ' flying for ' + FACTIONS[t.fac].n + ' · captain ' + t.capt + ' · reads as ' + t.kind, 1800);
      }
    }
    if (!done) say('No unscanned contacts within range.', '');
  }
  if (tap('KeyL')) leaveSystem();
  combat(dt); updTraffic(dt); rimSpawn(dt);
  followCam(dt, 0.3, 0.62, 6000, 0.34);
}

function followCam(dt, lead, zBase, zDiv, zMin) {
  cam.x = lerp(cam.x, P.x + P.vx * lead, 1 - Math.pow(0.0015, dt));
  cam.y = lerp(cam.y, P.y + P.vy * lead, 1 - Math.pow(0.0015, dt));
  const sp = Math.hypot(P.vx, P.vy);
  cam.z = lerp(cam.z, clamp(zBase - sp / zDiv, zMin, zBase), 2 * dt);
}

/* --- surface: ship or on foot --- */
let mineHold = 0, actCd = 0;
function updSurface(dt) {
  const b = BIOMES[planet.biome];
  const cells = surfAround(planet, P.x, P.y, 2);

  if (G.onFoot) updOnFoot(dt, b, cells);
  else updSurfaceShip(dt, b, cells);

  /* launching, or being recalled to the ship, can clear the planet part way
     through this function — stop here rather than walking off a null */
  if (!planet || G.mode !== 'surface') return;

  /* creatures + npcs think regardless */
  for (const c of cells) {
    for (const cr of c.crits) if (!cr.dead) aiCreature(cr, dt);
    if (c.settlement) {
      settlementTick(c.settlement, dt, cells);
      for (const n of c.settlement.npcs) aiNpc(n, dt, c.settlement, cells);
    }
    if (c.wanderer && !c.wanderer.dead) aiNpc(c.wanderer, dt, loneTown(c.wanderer), cells);
  }
  turretTick(dt, cells);
  groundCombat(dt, cells);
  pileTick(dt);
  syncDistricts(planet.id);
  if (G.minedN > 6000) { G.mined = {}; G.minedN = 0; }
  cam.x = lerp(cam.x, P.x + P.vx * 0.2, 1 - Math.pow(0.001, dt));
  cam.y = lerp(cam.y, P.y + P.vy * 0.2, 1 - Math.pow(0.001, dt));
  cam.z = lerp(cam.z, G.onFoot ? 1.35 : 1, 3 * dt);
}

function updSurfaceShip(dt, b, cells) {
  const grounded = !G.thrustersFixed;
  flyControls(dt, { thrustMul: grounded ? 0.6 : 1.05, speedMul: grounded ? 0.5 : 0.85, boostMul: 2.4, drag: 0.9 });
  const s = ST();
  if (b.haz > 0.05 && !sheltered(P.x, P.y)) {
    const d = b.haz * 3.2 * dt;
    if (G.shield > 0) G.shield = Math.max(0, G.shield - d);
    else { G.hull -= d * 0.7; if (G.hull <= 0 && !G.over) death(b.hazn); }
  } else G.shield = Math.min(s.shield, G.shield + s.regen * dt);

  /* mining beam */
  mineTarget = null; let best = 220 * 220;
  for (const c of cells) for (const d of c.deps) {
    if (d.amt <= 0) continue;
    const dd = (d.x - P.x) * (d.x - P.x) + (d.y - P.y) * (d.y - P.y);
    if (dd < best) { best = dd; mineTarget = d; }
  }
  if (mineTarget && down('Space')) {
    const rate = s.mine * 14 * dt;
    const got = Math.min(mineTarget.amt, rate);
    const stored = addRes(mineTarget.res, got);
    if (stored <= 0) { if (mineHold <= 0) { say('Hold is full.', 'warn'); mineHold = 1.6; } }
    else {
      mineTarget.amt -= got; G.mined[mineTarget.k] = Math.max(0, mineTarget.amt); G.minedN++;
      G.stat.mined += got;
      if (Math.random() < 0.13) AU.play('break', 0.5);
      if (Math.random() < 0.5 && G.set.quality > 0) parts.push({ x: mineTarget.x + (Math.random() - 0.5) * 30, y: mineTarget.y + (Math.random() - 0.5) * 30,
        vx: (P.x - mineTarget.x) * 1.3, vy: (P.y - mineTarget.y) * 1.3, l: 0, m: 0.35, c: MAT[mineTarget.res].c, sz: 2.2 });
      if (mineTarget.amt <= 0) say(MAT[mineTarget.res].n + ' deposit exhausted.', '');
    }
    beams.push({ x1: P.x, y1: P.y, x2: mineTarget.x, y2: mineTarget.y, c: MAT[mineTarget.res].c });
  }
  mineHold -= dt;

  if (tap('KeyR') && !G.thrustersFixed) {
    if ((G.cargo.ferrite || 0) >= 25 && (G.cargo.tritium || 0) >= 12) {
      takeRes('ferrite', 25); takeRes('tritium', 12);
      /* fixing the thrusters does not fill the tank — that still has to
         come from refining tritium into warp cells separately */
      G.thrustersFixed = true;
      AU.play('upgrade');
      say('Launch thrusters live. Press L to leave this rock.', 'rare');
      discover('start', 'Verges IV', 'World', 'A cataclysmic world. Atmosphere is ash. Nothing survived the event that ended it.', 3000);
    } else say('Need 25 ferrite dust and 12 tritium to rebuild the thrusters.', 'warn');
  }
  if (tap('KeyL')) launch();
  if (!planet) return;   /* launch succeeded — nothing below applies any more */
  if (tap('KeyX')) { if (planet.citadel) say('You cannot claim a city that somebody is already living on.', 'warn'); else claimPlanet(); }
  if (tap('KeyE')) { disembark(); }
  if (tap('KeyF')) { if (planet.citadel) say('The city\u2019s own scanners jam anything you point at it from the air.', 'warn'); else scanSurface(cells); }
}

function disembark() {
  shipAnchor = { x: P.x, y: P.y, ang: P.ang };
  G.onFoot = true;
  P.vx = 0; P.vy = 0; P.x += 46; 
  G.suit.air = G.suit.airMax;
  say('Stepping outside. Air supply running.', '');
}
function board() {
  G.onFoot = false;
  if (shipAnchor) { P.x = shipAnchor.x; P.y = shipAnchor.y; P.ang = shipAnchor.ang; }
  P.vx = 0; P.vy = 0; shipAnchor = null;
  G.suit.air = G.suit.airMax;
  say('Back aboard.', '');
}

function updOnFoot(dt, b, cells) {
  /* direct walking control */
  const sp = 210 * (1 + crewBonus('piloting') * 0.02) * walkSpeedMul();
  let ax = 0, ay = 0;
  if (down('KeyA') || down('ArrowLeft')) ax -= 1;
  if (down('KeyD') || down('ArrowRight')) ax += 1;
  if (down('KeyW') || down('ArrowUp')) ay -= 1;
  if (down('KeyS') || down('ArrowDown')) ay += 1;
  const run = (down('ShiftLeft') || down('ShiftRight')) ? 1.75 : 1;
  const m = Math.hypot(ax, ay) || 1;
  P.vx = lerp(P.vx, (ax / m) * sp * run * (ax || ay ? 1 : 0), 10 * dt);
  P.vy = lerp(P.vy, (ay / m) * sp * run * (ax || ay ? 1 : 0), 10 * dt);
  P.x += P.vx * dt; P.y += P.vy * dt;
  if (ax) P.face = ax > 0 ? 1 : -1;
  P.walkT += Math.hypot(P.vx, P.vy) * dt * 0.05;
  if (ax || ay) P.ang = Math.atan2(P.vy, P.vx);

  /* air + hazard — a weather stabiliser holds all of it off inside the ring */
  const shelter = sheltered(P.x, P.y);
  if (b.haz > 0.05 && !shelter) {
    /* a better-sealed suit simply loses less of it */
    G.suit.air = Math.max(0, G.suit.air - (6 + b.haz * 14) * (1 - suitHaz()) * dt);
    if (G.suit.air <= 0) hurtSuit(9 * dt);
    else if (G.suit.air < 25 && Math.random() < dt * 0.6) say('Air supply low. Return to the ship or use a canister.', 'warn');
  } else {
    G.suit.air = Math.min(G.suit.airMax, G.suit.air + 8 * dt);
    G.suit.hp = Math.min(G.suit.max, G.suit.hp + 1.6 * dt);
  }

  /* find everything in reach. These circles are deliberately tight — you
     should have to stand at the thing, not merely in its postcode. */
  nodeTarget = null; talkTarget = null; structTarget = null; waterTarget = null; critTarget = null; baseTarget = null;
  let bn = 88 * 88, bt = 104 * 104, bc = 120 * 120, bs = 1e18;
  for (const c of cells) {
    for (const n of c.nodes) {
      if (n.amt <= 0) continue;
      const d = (n.x - P.x) * (n.x - P.x) + (n.y - P.y) * (n.y - P.y);
      if (d < bn) { bn = d; nodeTarget = n; }
    }
    for (const cr of c.crits) {
      if (cr.dead) continue;
      const d = (cr.x - P.x) * (cr.x - P.x) + (cr.y - P.y) * (cr.y - P.y);
      if (d < bc) { bc = d; critTarget = cr; }
    }
    /* measure to the middle of the structure, and take the nearest one
       rather than whichever cell happened to be checked first */
    if (c.struct && !c.struct.used) {
      const s = structAnchor(c.struct);
      const d = (s.ax - P.x) * (s.ax - P.x) + (s.ay - P.y) * (s.ay - P.y);
      if (d < s.irad * s.irad && d < bs) { bs = d; structTarget = s; }
    }
    if (c.settlement) for (const n of c.settlement.npcs) {
      if (n.dead) continue;
      const d = (n.x - P.x) * (n.x - P.x) + (n.y - P.y) * (n.y - P.y);
      if (d < bt) { bt = d; talkTarget = n; talkTown = c.settlement; }
    }
    if (c.wanderer && !c.wanderer.dead) {
      const n = c.wanderer;
      const d = (n.x - P.x) * (n.x - P.x) + (n.y - P.y) * (n.y - P.y);
      if (d < bt) { bt = d; talkTarget = n; talkTown = loneTown(n); }
    }
    if (c.lake) {
      const d = Math.hypot(c.lake.x - P.x, c.lake.y - P.y);
      if (d < c.lake.r + 60 && d > c.lake.r - 40) waterTarget = c.lake;
    }
  }
  if (!talkTarget) talkTown = null;
  const site = siteFor(planet.id);
  if (site) for (const bd of site.build) {
    if ((bd.x - P.x) * (bd.x - P.x) + (bd.y - P.y) * (bd.y - P.y) < 110 * 110) { baseTarget = bd; break; }
  }
  const nearShip = shipAnchor && (shipAnchor.x - P.x) * (shipAnchor.x - P.x) + (shipAnchor.y - P.y) * (shipAnchor.y - P.y) < 96 * 96;
  G.nearShip = nearShip;

  /* --- weapons --- */
  if (tap('KeyR')) cycleGun(1);
  for (let i = 1; i <= 7; i++) if (tap('Digit' + i)) {
    const list = ownedGuns();
    if (list[i - 1]) { G.gun = list[i - 1]; say('Drew the ' + GUNS[G.gun].n.toLowerCase() + '.', ''); }
  }
  if (down('Space')) firePlayerGun(cells, dt);

  /* --- interact / harvest, both on E --- */
  actCd -= dt;
  if (tap('KeyE')) {
    if (nearShip) board();
    else if (talkTarget) startTalk(talkTarget, talkTown);
    else if (structTarget) useStruct(structTarget);
    else if (baseTarget) useBuilding(baseTarget);
  } else if (down('KeyE') && nodeTarget && actCd <= 0) {
    actCd = 0.3;
    const per = hasTool('mine') ? 3 : 1;
    const got = Math.min(nodeTarget.amt, per);
    const st2 = addRes(nodeTarget.res, got);
    if (st2 > 0) {
      nodeTarget.amt -= st2; G.mined[nodeTarget.k] = Math.max(0, nodeTarget.amt); G.minedN++;
      G.stat.mined += st2;
      AU.play('break');
      float(nodeTarget.x, nodeTarget.y - 20, '+' + st2 + ' ' + MAT[nodeTarget.res].n, MAT[nodeTarget.res].c);
      boom(nodeTarget.x, nodeTarget.y, 6, MAT[nodeTarget.res].c, 90);
    } else say('Hold is full.', 'warn');
  }
  if (tap('KeyF')) { if (planet.citadel) say('Nothing scans inside a city\u2019s hull. The plating is shielded floor to ceiling.', 'warn'); else scanSurface(cells); }
  if (tap('KeyV')) {
    if (!hasTool('fish')) say('You need a fishing rod. Craft one from fibre, bone and resin.', 'warn');
    else if (!waterTarget) say('Stand at the water\u2019s edge to cast.', 'warn');
    else startFishing();
  }
  if (tap('KeyP')) { if (siteFor(planet.id)) openPanel('farm'); else say('Build a farm plot first — press B.', 'warn'); }
  if (tap('KeyX')) { if (planet.citadel) say('You cannot claim a city that somebody is already living on.', 'warn'); else claimPlanet(); }
  if (tap('KeyL')) say(nearShip ? 'Board the ship first (E), then press L.' : 'Your ship is elsewhere on the surface.', 'warn');
}

function scanSurface(cells) {
  let found = 0;
  if (!planet.scanned) {
    planet.scanned = true; G.stat.scans++; found++;
    discover('pl:' + planet.id, planet.name, 'World',
      BIOMES[planet.biome].n + ' world · life ' + planet.life.toLowerCase() + ' · ' + planet.res.map(k => MAT[k].n).join(', '),
      3200 + planet.res.length * 900);
  }
  for (const c of cells) {
    for (const cr of c.crits) {
      if (cr.scanned || cr.dead) continue;
      if ((cr.x - P.x) * (cr.x - P.x) + (cr.y - P.y) * (cr.y - P.y) < 700 * 700) {
        cr.scanned = true; found++;
        discover('cr:' + cr.id, cr.name, 'Fauna', cr.tdesc + ' Native to ' + planet.name + '. Drops ' + cr.drops.map(d => MAT[d].n).join(', ') + '.', 2600);
      }
    }
    if (c.settlement && !G.codex['set:' + c.settlement.id] &&
        (c.settlement.x - P.x) * (c.settlement.x - P.x) + (c.settlement.y - P.y) * (c.settlement.y - P.y) < 900 * 900) {
      found++;
      discover('set:' + c.settlement.id, c.settlement.name, 'Settlement',
        FACTIONS[c.settlement.fac].n + ' holding on ' + planet.name + ' · ' + c.settlement.npcs.length + ' residents', 3400);
    }
  }
  if (!found) say('Scan complete. Nothing new in range.', '');
}
function useStruct(s) {
  s.used = true; G.mined[s.id] = 1; G.minedN++;
  if (s.t === 'monolith') { G.stat.monoliths = (G.stat.monoliths || 0) + 1; ENCOUNTERS[1](); return; }
  if (s.t === 'wreck') {
    let got = addRes('ferrite', 60) + addRes(pick(Math.random, planet.res), 40) + addRes('alloy', 2);
    G.credits += 4000; AU.play('break');
    say('Stripped the wreck: ' + got + ' units of cargo and 4K.', 'good');
  } else if (s.t === 'beacon') {
    const list = nearbySystems(sys.x, sys.y, 3).filter(x => x !== sys);
    if (list.length) { const tgt = pick(Math.random, list); G.waypoint = { x: tgt.x, y: tgt.y, name: tgt.name }; say('Beacon marks ' + tgt.name + ' on your chart.', 'rare'); }
  } else if (s.t === 'cache') {
    const k = pick(Math.random, ['relic','glyph','indium','voidcrystal','powercell','nanotube']);
    const n = addRes(k, ri(Math.random, 2, 8));
    G.credits += 12000; AU.play('buy');
    say('Supply cache: ' + n + ' ' + MAT[k].n + ' and 12K units.', 'rare');
  } else {
    G.credits += 9000;
    addRes('relic', 1);
    discover('ruin:' + s.id, 'Ruins on ' + planet.name, 'Ancient', 'Foundations of a settlement that predates the current faction charts.', 7000);
  }
}
function useBuilding(bd) {
  const d = BUILDS[bd.t];
  if (!d) return;
  if (d.plots) openPanel('farm');
  else if (d.craft) openPanel('craft');
  else if (d.store) openPanel('cargo');
  else if (d.water) { G.waterCan = 100; say('Watering can refilled.', 'good'); }
  else if (d.beacon || bd.t === 'beacon') { G.waypoint = { x: sys.x, y: sys.y, name: planet.name }; say('Beacon set as your waypoint.', 'good'); }
  else say(d.n + ' — running normally.', '');
}

/* ------------------------------------------------------------
   25. DIALOGUE
------------------------------------------------------------ */
const talkEl = document.getElementById('talk');
let talkOpen = false;
let activeTown = null;
function relOf(id) { if (G.relations[id] === undefined) G.relations[id] = 0; return G.relations[id]; }
function relBump(id, n) { G.relations[id] = clamp(relOf(id) + n, -100, 100); }

/* Standing has to be earned over time, not farmed by clicking the same
   line forty times. Each way of pleasing someone has its own cooldown,
   and repeated goodwill inside one window is worth steadily less. */
/* Conversation has a short breather on it so the same line is not worth
   farming, but giving somebody something they want has no limit at all —
   if you are willing to keep handing over goods, they will keep warming to
   you, and that is the fast road to a friendship. */
const REL_WAIT = { news: 1, chat: 1, gift: 0, work: 1 };
/* tags that ignore the diminishing-returns curve entirely */
const REL_UNCAPPED = { gift: true };
function relCooldown(id, tag) {
  if (!REL_WAIT[tag]) return 0;
  const last = G.talkCd[id + ':' + tag];
  if (last === undefined) return 0;
  return Math.max(0, REL_WAIT[tag] - (G.t - last));
}
function relGain(npc, n, tag) {
  const key = npc.id + ':' + tag;
  if (relCooldown(npc.id, tag) > 0) return 0;
  G.talkCd[key] = G.t;
  if (REL_UNCAPPED[tag]) { relBump(npc.id, n); return n; }
  const rec = G.talkGain[npc.id] || { t: -1e9, n: 0 };
  if (G.t - rec.t > 120) rec.n = 0;
  rec.t = G.t; rec.n++;
  G.talkGain[npc.id] = rec;
  /* a gentler falloff than before, and it resets twice as quickly */
  const got = n * Math.pow(0.82, Math.max(0, rec.n - 1));
  relBump(npc.id, got);
  return got;
}
function coolText(id, tag) {
  const c = relCooldown(id, tag);
  return c > 0 ? ' — heard it already (' + Math.ceil(c) + 's)' : '';
}

/* Whether somebody will actually get on your ship is their call, not
   yours. Their answer is fixed per person so you cannot reroll it. */
function recruitVerdict(npc) {
  const rel = relOf(npc.id);
  const rep = G.rep[npc.fac] || 0;
  const r = rng((npc.seed ^ 0x51f0) >>> 0);
  const want = r();
  const moraleFloor = G.crew.length ? G.crew.reduce((s, c) => s + c.morale, 0) / G.crew.length : 100;
  if (G.crew.length >= 6) return { ok: false, why: 'Six bunks, six bodies. You have no room for me.' };
  if (rep <= -30) return { ok: false, why: 'You and mine have history. Bad history. No.' };
  if (rel < 15) return { ok: false, why: 'I do not sign on with strangers. Come back when we know each other.' };
  if (moraleFloor < 35) return { ok: false, why: 'I have talked to your crew. They are miserable. Fix that first.' };
  /* some people simply want paying properly, some want a gift, some say yes */
  if (want < 0.34) return { ok: true, fee: npc.wage * 3, why: 'Point me at a bunk. I will not be trouble.' };
  if (want < 0.62) return { ok: true, fee: Math.round(npc.wage * 5.5), why: 'I am expensive and I am worth it. Pay the signing fee and I am yours.' };
  if (want < 0.84) return { ok: false, gift: npc.likes,
    why: 'Nearly. Bring me ' + MAT[npc.likes].n + ' and we will call it settled.' };
  return { ok: false, why: 'I have people here. I am not leaving them for a stranger with a ship.' };
}

function drawFace(npc) {
  const c = document.getElementById('face'), g = c.getContext('2d');
  const r = rng(npc.seed >>> 0);
  g.clearRect(0, 0, 120, 120);
  g.fillStyle = '#050d14'; g.fillRect(0, 0, 120, 120);
  /* shoulders */
  g.fillStyle = 'rgba(79,227,208,.16)';
  g.beginPath(); g.moveTo(14, 120); g.quadraticCurveTo(60, 78, 106, 120); g.closePath(); g.fill();
  g.save(); g.translate(60, 56);
  g.fillStyle = npc.col; g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2;
  g.beginPath();
  if (npc.head === 'orb') g.arc(0, 0, 30, 0, TAU);
  else if (npc.head === 'beak') { g.moveTo(-24, -14); g.lineTo(24, -18); g.lineTo(30, 12); g.lineTo(0, 30); g.lineTo(-26, 12); g.closePath(); }
  else if (npc.head === 'horn') { g.moveTo(-26, -6); g.lineTo(-20, -34); g.lineTo(0, -22); g.lineTo(20, -34); g.lineTo(26, -6); g.lineTo(0, 30); g.closePath(); }
  else if (npc.head === 'crest') { g.moveTo(-22, 0); g.lineTo(0, -38); g.lineTo(22, 0); g.lineTo(14, 28); g.lineTo(-14, 28); g.closePath(); }
  else if (npc.head === 'tall') { g.ellipse(0, -2, 20, 34, 0, 0, TAU); }
  else if (npc.head === 'wide') { g.ellipse(0, 2, 34, 24, 0, 0, TAU); }
  else g.ellipse(0, 0, 26, 30, 0, 0, TAU);
  g.fill(); g.stroke();
  /* eyes */
  const eyes = npc.head === 'orb' ? 1 : (r() < 0.25 ? 3 : 2);
  g.fillStyle = '#05101a';
  for (let i = 0; i < eyes; i++) {
    const ex = eyes === 1 ? 0 : (-14 + i * (28 / (eyes - 1)));
    g.beginPath(); g.ellipse(ex, -4, eyes === 1 ? 11 : 5, eyes === 1 ? 7 : 6.5, 0, 0, TAU); g.fill();
  }
  g.fillStyle = '#eaffff';
  for (let i = 0; i < eyes; i++) {
    const ex = eyes === 1 ? 0 : (-14 + i * (28 / (eyes - 1)));
    g.beginPath(); g.arc(ex + 1.5, -5.5, eyes === 1 ? 3.6 : 2, 0, TAU); g.fill();
  }
  g.restore();
  g.strokeStyle = 'rgba(79,227,208,.35)'; g.lineWidth = 1;
  g.strokeRect(0.5, 0.5, 119, 119);
}
function setTalkLine(text) {
  document.getElementById('talk-line').textContent = text;
  AU.play('chirp', 0.8);
  G.stat.talked++;
}
function startTalk(npc, st) {
  if (npc.dead) return;
  activeTown = st || null;
  if (st && (st.hostile || civMood(st) === 'hostile')) {
    say(npc.name + ' will not talk to you. Nobody here will.', 'bad');
    alertSettlement(st, 1);
    return;
  }
  activeNpc = npc; talkOpen = true;
  /* just striking up a conversation nudges friendship a little, separate
     from the topic-specific gains below */
  relBump(npc.id, 1);
  talkEl.classList.remove('hidden');
  document.getElementById('talk-name').textContent = npc.name;
  const where = st && !st.lone ? st.name + ' · ' + civMood(st) : 'travelling alone';
  document.getElementById('talk-role').textContent = npc.spec + ' · ' + npc.role + ' · ' + FACTIONS[npc.fac].n + ' · ' + where;
  drawFace(npc);
  const first = !G.knownNpcs[npc.id];
  G.knownNpcs[npc.id] = true;
  const pool = GREET[npc.roleDef.talk] || GREET.trade;
  const rec = G.talkGain[npc.id];
  const pestered = rec && G.t - rec.t < 30 && rec.n > 2;
  setTalkLine(first ? pick(rng(npc.seed), pool)
    : pestered ? 'You again. I have work to do, you know.'
    : npc.wanderer ? 'Out here as well, are you. Long way from anything.'
    : 'Back again. What is it?');
  updRel(npc);
  talkOptions(npc);
}
function updRel(npc) {
  const v = relOf(npc.id);
  document.getElementById('talk-rel').style.width = ((v + 100) / 2) + '%';
  document.getElementById('talk-rel').style.background = v < 0 ? '#ff6a4d' : '#d484ff';
  document.getElementById('talk-relv').textContent = (v > 0 ? '+' : '') + Math.round(v);
}
function talkOptions(npc) {
  const box = document.getElementById('talk-opts');
  box.innerHTML = '';
  const opts = [];
  const st = activeTown;
  if (npc.shop) opts.push({ l: 'Show me what you have for sale', f: () => { closeTalk(); openShop(npc); } });

  opts.push({ l: 'Any news?' + coolText(npc.id, 'news'), f: () => {
      const g = relGain(npc, 1.5, 'news');
      setTalkLine(g > 0 ? pick(Math.random, GOSSIP) : 'I told you everything I had. Go and find something out yourself.');
      updRel(npc); talkOptions(npc);
    } });
  opts.push({ l: 'Tell me about yourself' + coolText(npc.id, 'chat'), f: () => {
      const g = relGain(npc, 3, 'chat');
      if (g <= 0) { setTalkLine('We have done this. I am the same person I was ten minutes ago.'); talkOptions(npc); return; }
      const spec = SPECIES.find(s => s.n === npc.spec);
      setTalkLine(npc.name + ', ' + npc.role.toLowerCase() + '. ' + (spec ? spec.d : '') + ' ' +
        FACTIONS[npc.fac].d + (relOf(npc.id) > 20 ? ' Between us — I like ' + MAT[npc.likes].n + ' more than is reasonable.' : ''));
      updRel(npc); talkOptions(npc);
    } });

  /* Gifts: no cooldown, no cap, and you pick what to hand over. Their
     favourite is always offered first when you are carrying any. */
  const giftable = Object.keys(G.cargo).filter(k => G.cargo[k] >= 1 && MAT[k] && MAT[k].v >= 40);
  if (giftable.length) {
    const byValue = giftable.slice().sort((a, b) => MAT[b].v - MAT[a].v);
    const list = [];
    if (giftable.indexOf(npc.likes) >= 0) list.push(npc.likes);
    for (const k of byValue) { if (list.length >= 3) break; if (list.indexOf(k) < 0) list.push(k); }
    const giveOne = (k) => {
      if ((G.cargo[k] || 0) < 1) { setTalkLine('You are not carrying any of that.'); talkOptions(npc); return; }
      takeRes(k, 1);
      const loved = k === npc.likes;
      const before = relOf(npc.id);
      relGain(npc, loved ? 18 : 7, 'gift');
      repChange(npc.fac, loved ? 0.02 : 0.01);
      if (st && !st.lone) civBump(st, loved ? 3 : 1);
      const now = relOf(npc.id);
      if (now >= 100 && before >= 100) setTalkLine('There is nothing further to win here. We are as close as two people get.');
      else setTalkLine(loved ? 'You remembered. That is exactly what I like. Keep them coming.'
                             : 'Generous. Not necessary, but noted.');
      updRel(npc); talkOptions(npc);
    };
    for (const k of list) {
      opts.push({ l: 'Offer a gift: 1 ' + MAT[k].n + (k === npc.likes ? ' (their favourite)' : '') +
        ' · ' + Math.floor(G.cargo[k]) + ' held', f: () => giveOne(k) });
    }
    /* hand over ten at once when you are trying to buy a friendship quickly */
    const bulk = list[0];
    if ((G.cargo[bulk] || 0) >= 10) {
      opts.push({ l: 'Hand over 10 ' + MAT[bulk].n + ' at once', f: () => {
          const loved = bulk === npc.likes;
          let n = 0;
          for (let i = 0; i < 10 && (G.cargo[bulk] || 0) >= 1; i++) { takeRes(bulk, 1); relBump(npc.id, loved ? 18 : 7); n++; }
          repChange(npc.fac, loved ? 0.1 : 0.05);
          if (st && !st.lone) civBump(st, loved ? 8 : 4);
          setTalkLine(n ? 'All of it? ' + (loved ? 'You and I are going to get along.' : 'Well. That settles that.')
                        : 'You have nothing to give.');
          updRel(npc); talkOptions(npc);
        } });
    }
  }

  /* contracts */
  const mine = G.quests.filter(q => q.giver === npc.id);
  const ready = mine.filter(q => questReady(q));
  if (ready.length) opts.push({ l: 'Settle up on the contract', f: () => {
      turnInQuest(ready[0]); setTalkLine('Good work. That is the balance cleared.');
      relGain(npc, 9, 'work'); if (st && !st.lone) civBump(st, 4);
      updRel(npc); talkOptions(npc);
    } });
  else if (mine.length === 0 && G.quests.length < 8) {
    opts.push({ l: 'Got any work?', f: () => {
        const q = makeQuest(rng((npc.seed + G.day * 7) >>> 0), npc.fac, npc.id);
        q.where = st && !st.lone ? st.name : 'out in the open';
        G.quests.push(q);
        setTalkLine('As it happens. ' + q.t + '. Pays ' + fmt(q.pay) + ' units on delivery.');
        relGain(npc, 3, 'work'); updRel(npc); talkOptions(npc);
      } });
  }

  /* --- coming aboard is their decision --- */
  if (!G.crew.find(c => c.id === npc.id)) {
    const v = recruitVerdict(npc);
    const label = v.ok ? 'Come aboard — sign on for ' + fmt(v.fee) + ' units'
      : v.gift ? 'Ask them to come aboard'
      : 'Ask them to come aboard';
    opts.push({ l: label, f: () => {
        const vv = recruitVerdict(npc);
        if (!vv.ok) {
          if (vv.gift && (G.cargo[vv.gift] || 0) >= 1) {
            takeRes(vv.gift, 1);
            relBump(npc.id, 22);
            setTalkLine('...you actually brought it. Fine. I will get my things.');
            const v2 = { ok: true, fee: npc.wage * 3 };
            if (G.credits >= v2.fee) { G.credits -= v2.fee; boardCrew(npc); }
            else setTalkLine('I will get my things. Come back with ' + fmt(v2.fee) + ' units for the signing fee.');
          } else setTalkLine(vv.why);
          updRel(npc); talkOptions(npc);
          return;
        }
        if (G.credits < vv.fee) { setTalkLine('Come back when you can cover ' + fmt(vv.fee) + '.'); return; }
        G.credits -= vv.fee;
        boardCrew(npc);
        setTalkLine(vv.why);
        talkOptions(npc);
      } });
  }

  /* --- turning on the locals --- */
  if (st && !st.lone) {
    const mood = civMood(st);
    if (mood === 'allied' || mood === 'warm') {
      opts.push({ l: 'Ask ' + st.name + ' for supplies', f: () => {
          if (relCooldown(st.id, 'work') > 0) { setTalkLine('We gave you what we could spare. Come back in a while.'); return; }
          G.talkCd[st.id + ':work'] = G.t;
          const pool = (planet ? planet.res : ['ferrite']).concat(['ration','oxtank','medkit']);
          let got = 0;
          const n = mood === 'allied' ? 4 : 2;
          for (let i = 0; i < n; i++) got += addRes(pick(Math.random, pool), ri(Math.random, 15, 45));
          setTalkLine(got ? 'We look after the people who look after us. Take it.' : 'We would, but your hold is full.');
          if (got) say(st.name + ' loaded ' + got + ' units into your hold.', 'good');
        } });
    }
    opts.push({ l: 'Threaten them', ghost: true, f: () => {
        civBump(st, -22); repChange(npc.fac, -0.05);
        if (npc.fearful) {
          /* fearful archetype: they cave and hand over what they are
             carrying rather than fight for it */
          const pool = (planet ? planet.res : ['ferrite']).concat(['ration','oxtank']);
          const got = addRes(pick(Math.random, pool), ri(Math.random, 10, 30));
          setTalkLine('Take it. Just — take it and go.');
          npc.state = 'flee';
          if (got) say(npc.name + ' handed over ' + got + ' units and bolted.', 'warn');
        } else {
          /* brave archetype: they call the settlement's own guns on you */
          setTalkLine('Try it. See how many of us are armed.');
          alertSettlement(st, 2);
        }
        updRel(npc);
        setTimeout(closeTalk, 1100);
      } });
  } else if (st && st.lone) {
    /* a lone wanderer, no settlement backing them up */
    opts.push({ l: 'Threaten them', ghost: true, f: () => {
        repChange(npc.fac, -0.05);
        if (npc.fearful) {
          const got = addRes(pick(Math.random, MAT_KEYS.filter(k => MAT[k].v < 60)), ri(Math.random, 5, 20));
          setTalkLine('Okay! Okay — here, just do not shoot.');
          npc.x += (npc.x - P.x) * 4; npc.y += (npc.y - P.y) * 4;
          if (got) say(npc.name + ' dropped ' + got + ' units and ran.', 'warn');
        } else {
          setTalkLine('You picked the wrong stranger to lean on.');
          st.hostile = true; npc.alertT = 999;
          say(npc.name + ' draws on you.', 'bad');
        }
        updRel(npc);
        setTimeout(closeTalk, 1100);
      } });
  }

  opts.push({ l: 'Nothing else', ghost: true, f: closeTalk });
  for (const o of opts) {
    const b = document.createElement('button');
    b.className = 'btn ' + (o.ghost ? 'ghost' : '');
    b.textContent = o.l;
    b.onclick = o.f;
    box.appendChild(b);
  }
}
function closeTalk() { talkEl.classList.add('hidden'); talkOpen = false; activeNpc = null; activeTown = null; }

/* --- hailing a ship in space --- */
function hailShip(t) {
  activeNpc = { id: t.id, name: t.capt, spec: 'Captain', role: t.kind, col: t.col, head: 'round', fac: t.fac,
    mood: t.mood, seed: (t.id.length * 7717) >>> 0, roleDef: { talk: 'trade' }, shop: null, skill: null, likes: 'relic' };
  talkOpen = true; talkEl.classList.remove('hidden');
  document.getElementById('talk-name').textContent = t.capt;
  document.getElementById('talk-role').textContent = t.name + ' · ' + SHIPS[t.shipKey].cl + ' · ' + FACTIONS[t.fac].n;
  drawFace(activeNpc);
  setTalkLine(t.kind === 'trader' ? 'Open channel. I am carrying ' + MAT[t.cargo].n + ' and I am not precious about the price.'
    : t.kind === 'patrol' ? 'This is a registered patrol. State your business and keep your guns cold.'
    : t.kind === 'follower' ? 'Been trailing your wake a while. Nothing personal — you fly a clean line.'
    : t.kind === 'miner' ? 'Working the belt. Do not scare the rocks.'
    : 'Channel open. Make it quick.');
  const box = document.getElementById('talk-opts');
  box.innerHTML = '';
  const opts = [];
  const price = Math.round(priceOf(t.cargo, sys) * 0.72);
  /* a friendly carrier is a market with engines — small stock, good prices */
  if (tierRank(t.tier) >= 3) {
    opts.push({ l: 'Ask to come aboard and trade', f: () => {
        if (!t.stock) {
          const sr = rng(t.tipSeed >>> 0);
          const pool = MAT_KEYS.filter(k => MAT[k].cat !== 'alloy' && MAT[k].cat !== 'artifact');
          t.stock = shuffle(sr, pool).slice(0, tierRank(t.tier) >= 4 ? ri(sr, 8, 12) : ri(sr, 4, 6));
        }
        closeTalk();
        activeShop = { id: t.id, name: t.capt, fac: t.fac, seed: t.tipSeed,
          shop: 'general', mobile: t.stock, tierName: (VTIERS[t.tier] || VTIERS.mother).n };
        $('shop-title').textContent = (VTIERS[t.tier] || VTIERS.mother).n + ' hold · ' + t.name;
        openPanel('shop');
      } });
  }
  opts.push({ l: 'Buy 40 ' + MAT[t.cargo].n + ' at ' + fmt(price * 40) + ' units', f: () => {
      if (G.credits < price * 40) { setTalkLine('You cannot cover that. Come back heavier.'); return; }
      const got = addRes(t.cargo, 40);
      if (!got) { setTalkLine('Your hold is full. Where would I even put it?'); return; }
      G.credits -= price * got; AU.play('buy');
      repChange(t.fac, 0.1); relBump(t.id, 5);
      setTalkLine('Transferred. Fly safe.');
    } });
  opts.push({ l: 'Ask where the good systems are', f: () => {
      /* whatever they told you the first time is what they still think */
      if (!t.tipSystem) {
        const list = nearbySystems(sys.x, sys.y, 3).filter(s => s !== sys && s.hasStation);
        if (!list.length) { t.tipSystem = 'none'; }
        else {
          const tr = rng(t.tipSeed >>> 0);
          const tgt = list[Math.floor(tr() * list.length) % list.length];
          t.tipSystem = { x: tgt.x, y: tgt.y, name: tgt.name };
        }
      }
      if (t.tipSystem === 'none') { setTalkLine('Nothing worth the fuel out this way. Try further in.'); return; }
      G.waypoint = { x: t.tipSystem.x, y: t.tipSystem.y, name: t.tipSystem.name };
      setTalkLine(t.tipSystem.name + '. Station there pays well and nobody asks much. Marked it for you — same as I said last time.');
      relBump(t.id, 1);
    } });
  opts.push({ l: 'Demand they hand over cargo', f: () => {
      repChange(t.fac, -0.02); repChange('outlaw', 5);
      if (t.fearful) {
        const got = addRes(t.cargo, 60);
        setTalkLine('Fine. Take it. I want no part of you.');
        t.state = 'flee';
        say('Extorted ' + got + ' ' + MAT[t.cargo].n + '.', 'warn');
      } else {
        setTalkLine('Wrong ship, wrong day.');
        t.hostile = true; t.state = 'attack';
        say(t.name + ' is powering weapons.', 'bad');
      }
      setTimeout(closeTalk, 900);
    } });
  opts.push({ l: 'Break the channel', ghost: true, f: closeTalk });
  for (const o of opts) {
    const b = document.createElement('button');
    b.className = 'btn ' + (o.ghost ? 'ghost' : '');
    b.textContent = o.l; b.onclick = o.f; box.appendChild(b);
  }
  updRel(activeNpc);
}

/* ------------------------------------------------------------
   26. FISHING
------------------------------------------------------------ */
const fishEl = document.getElementById('fish');
let fishing = null;
function startFishing() {
  if (fishing) return;
  const r = rng((Math.random() * 1e9) | 0);
  const entry = weighted(r, FISH_TABLE);
  const width = clamp(34 - entry.diff * 5, 8, 34);
  fishing = { k: entry.k, diff: entry.diff, pos: 0, dir: 1, sp: 0.55 + entry.diff * 0.28,
    zone: rr(r, 12, 88 - width), w: width, tries: 3 };
  fishEl.classList.remove('hidden');
  document.getElementById('fish-title').textContent = 'Something is on the line';
  document.getElementById('fish-note').textContent = 'Press Space when the marker sits inside the lit band. Three attempts.';
  document.getElementById('fish-zone').style.left = fishing.zone + '%';
  document.getElementById('fish-zone').style.width = fishing.w + '%';
}
function updFishing(dt) {
  if (!fishing) return;
  fishing.pos += fishing.dir * fishing.sp * 60 * dt;
  if (fishing.pos > 100) { fishing.pos = 100; fishing.dir = -1; }
  if (fishing.pos < 0) { fishing.pos = 0; fishing.dir = 1; }
  document.getElementById('fish-cursor').style.left = fishing.pos + '%';
  if (tap('Space')) {
    const inside = fishing.pos >= fishing.zone && fishing.pos <= fishing.zone + fishing.w;
    if (inside) {
      const got = addRes(fishing.k, 1);
      G.stat.caught++;
      AU.play('buy', 0.7);
      say(got ? 'Landed a ' + MAT[fishing.k].n + '.' : 'Caught a ' + MAT[fishing.k].n + ' but the hold is full.', 'good');
      if (got) discover('fish:' + fishing.k, MAT[fishing.k].n, 'Aquatic', 'Landed on ' + planet.name + '. Market value ' + MAT[fishing.k].v + ' units.', 1800);
      endFishing();
    } else {
      fishing.tries--;
      if (fishing.tries <= 0) { say('The line went slack. It got away.', 'warn'); endFishing(); }
      else document.getElementById('fish-note').textContent = 'Missed. ' + fishing.tries + ' attempt' + (fishing.tries > 1 ? 's' : '') + ' left.';
    }
  }
  if (tap('Escape')) endFishing();
}
function endFishing() { fishing = null; fishEl.classList.add('hidden'); }

/* ------------------------------------------------------------
   27. FARMING
------------------------------------------------------------ */
function totalPlots(pid) {
  const site = siteFor(pid);
  if (!site) return 0;
  let n = 0; for (const b of site.build) if (BUILDS[b.t] && BUILDS[b.t].plots) n += BUILDS[b.t].plots;
  return n;
}
function syncPlots(pid) {
  const f = farmFor(pid), want = totalPlots(pid);
  while (f.plots.length < want) f.plots.push({ crop: null, stage: 0, watered: false, dry: 0 });
  while (f.plots.length > want) f.plots.pop();
  return f;
}
function plantSeed(pid, i, seedKey) {
  const f = syncPlots(pid), p = f.plots[i];
  if (!p || p.crop) return;
  if (!takeRes(seedKey, 1)) { say('No ' + MAT[seedKey].n + ' in the hold.', 'warn'); return; }
  p.crop = MAT[seedKey].crop; p.stage = 0; p.watered = false; p.dry = 0;
  say('Planted ' + CROPS[p.crop].n + '.', 'good');
}
function waterPlot(pid, i) {
  const f = syncPlots(pid), p = f.plots[i];
  if (!p || !p.crop || p.watered) return;
  if (!hasTool('water')) { say('You need a watering can.', 'warn'); return; }
  p.watered = true; p.dry = 0;
}
function harvestPlot(pid, i) {
  const f = syncPlots(pid), p = f.plots[i];
  if (!p || !p.crop) return;
  const cd = CROPS[p.crop];
  if (p.stage < cd.days) { say(CROPS[p.crop].n + ' is not ready — ' + (cd.days - p.stage) + ' more cycles.', 'warn'); return; }
  const n = ri(Math.random, cd.yield[0], cd.yield[1]) + Math.round(crewBonus('farming'));
  const got = addRes(p.crop, n);
  G.stat.harvest += got;
  p.crop = null; p.stage = 0; p.watered = false;
  AU.play('buy', 0.6);
  say('Harvested ' + got + ' ' + cd.n + '.', 'good');
  discover('crop:' + cd.n, cd.n, 'Agriculture', 'First harvest. Grows in ' + cd.days + ' cycles on ' + cd.biome.join(', ') + ' worlds.', 2200);
}
function harvestAll(pid) {
  const f = syncPlots(pid);
  let n = 0;
  for (let i = 0; i < f.plots.length; i++) {
    const p = f.plots[i];
    if (p.crop && p.stage >= CROPS[p.crop].days) { harvestPlot(pid, i); n++; }
  }
  if (!n) say('Nothing ready yet.', 'warn');
}
function waterAll(pid) {
  const f = syncPlots(pid);
  let n = 0;
  for (let i = 0; i < f.plots.length; i++) { const p = f.plots[i]; if (p.crop && !p.watered) { waterPlot(pid, i); n++; } }
  say(n ? 'Watered ' + n + ' plot' + (n > 1 ? 's' : '') + '.' : 'Nothing needs water.', n ? 'good' : '');
}

/* ------------------------------------------------------------
   28. ENCOUNTERS
------------------------------------------------------------ */
const modal = document.getElementById('modal');
let modalOpen = false;
function showEvent(kind, title, body, choices) {
  modalOpen = true;
  document.getElementById('modal-kind').textContent = kind;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').textContent = body;
  const box = document.getElementById('modal-choices');
  box.innerHTML = '';
  choices.forEach(ch => {
    const b = document.createElement('button');
    b.className = 'btn ' + (ch.ghost ? 'ghost' : '');
    b.textContent = ch.l;
    b.onclick = () => { modal.classList.add('hidden'); modalOpen = false; if (ch.f) ch.f(); };
    box.appendChild(b);
  });
  modal.classList.remove('hidden');
}
const ENCOUNTERS = [
  function derelict() {
    const r = rng(hash2(Math.floor(P.x), Math.floor(P.y), 11));
    const loot = Math.round(rr(r, 30000, 140000) * ST().scan);
    showEvent('derelict freighter', 'A dead ship, running lights still on',
      'It drifts nose-down with a hole punched clean through the cargo spine. The airlock cycles when you knock. Something inside is still drawing power.',
      [{ l: 'Board it and strip the hold', f: () => {
          if (Math.random() < 0.28) { const dmg = 40 + Math.random() * 60; hurt(dmg, 'a bulkhead blowout'); say('A sealed bulkhead blew. Hull down ' + Math.round(dmg) + '.', 'bad'); }
          else {
            G.credits += loot;
            const k = pick(r, ['indium','voidcrystal','powercell','nanotube','circuit']);
            const got = addRes(k, ri(r, 20, 70));
            AU.play('buy');
            say('Salvage: ' + fmt(loot) + ' units' + (got ? ' and ' + got + ' ' + MAT[k].n : ''), 'good');
            discover('derelict:' + Math.floor(P.x / 500), 'Derelict freighter', 'Wreckage', 'Boarded and stripped in deep space.', 3000);
          }
        } },
       { l: 'Log the position and move on', ghost: true, f: () => say('Coordinates logged.', '') }]);
  },
  function monolith() {
    showEvent('ancient structure', 'A monolith older than the star it orbits',
      'Black stone, no seams, no shadow on any side. It answers your scanner in a language that predates the scanner.',
      [{ l: 'Touch the surface', f: () => {
          AU.play('upgrade');
          const roll = Math.random();
          if (roll < 0.4) { G.maxFuelBase += 20; G.fuel = maxFuel(); say('Warp cell capacity increased to ' + maxFuel() + '.', 'rare'); }
          else if (roll < 0.75) { const k = pick(Math.random, ['voidcrystal','antimatter','glyph']); addRes(k, 30); say('The stone gives up 30 ' + MAT[k].n + '.', 'rare'); }
          else { G.suit.bonus = (G.suit.bonus || 0) + 25; syncSuit(); G.suit.hp = G.suit.max; say('Your suit feels heavier and stronger. Integrity now ' + G.suit.max + '.', 'rare'); }
          discover('mono:' + Math.floor(P.x / 900), 'Monolith of unknown make', 'Ancient', 'Predates local stellar formation. Purpose unresolved.', 9000);
        } },
       { l: 'Keep your distance', ghost: true }]);
  },
  function distress() {
    const fee = Math.round(20000 + Math.random() * 90000);
    showEvent('distress beacon', 'Someone is broadcasting on an old channel',
      'A hauler, engines cold, crew alive. They will pay for a tow to the nearest station — or they will pay more if you simply take the cargo.',
      [{ l: 'Tow them in for the fee', f: () => { G.credits += fee; repChange('free', 0.5); AU.play('buy'); say('Paid ' + fmt(fee) + ' units. Word gets around.', 'good'); } },
       { l: 'Take the cargo instead', f: () => {
          let got = 0; const keys = ['copper','cobalt','platinum','emeril','chromatic','alloy','circuit'];
          for (let i = 0; i < 3; i++) got += addRes(pick(Math.random, keys), 40 + Math.floor(Math.random() * 60));
          repChange('free', -1.4); repChange('outlaw', 0.8);
          say('Hold filled with ' + got + ' units of stolen cargo.', 'warn');
          const r = rng((Math.random() * 1e9) | 0);
          for (let i = 0; i < 2; i++) { const t = makeTraffic(r, sys, P.x + rr(r, -1800, 1800), P.y + rr(r, -1800, 1800)); t.hostile = true; t.kind = 'pirate'; t.state = 'hunt'; hostiles.push(t); }
        } },
       { l: 'Stay silent', ghost: true }]);
  },
  function anomaly() {
    showEvent('spatial anomaly', 'The instruments disagree with the window',
      'A fold of space the size of a moon, turning slowly. Your navigation computer reports three positions at once and is confident about all of them.',
      [{ l: 'Fly into it', f: () => {
          const roll = Math.random();
          if (roll < 0.34) {
            const jump = 14 + Math.floor(Math.random() * 30), a = Math.random() * TAU;
            P.x += Math.cos(a) * jump * GAL_CELL; P.y += Math.sin(a) * jump * GAL_CELL;
            G.stat.jumps += jump; say('Thrown ' + jump + ' sectors across the galaxy.', 'rare');
          } else if (roll < 0.7) { addRes('stellarite', 25); G.credits += 120000; AU.play('buy'); say('You come out heavier than you went in.', 'rare'); }
          else { hurt(70, 'the anomaly'); say('Hull stressed badly on the way through.', 'bad'); }
          discover('anom:' + Math.floor(P.x / 1500), 'Spatial anomaly', 'Phenomenon', 'Non-euclidean region. Traversal survivable, not repeatable.', 12000);
        } },
       { l: 'Plot around it', ghost: true }]);
  },
  function broker() {
    const avail = SHIP_KEYS.filter(k => !G.owned.includes(k) && SHIPS[k].price > 0);
    if (!avail.length) return ENCOUNTERS[0]();
    const key = pick(Math.random, avail), s = SHIPS[key];
    const price = Math.round(s.price * 0.55);
    showEvent('unregistered broker', 'A ship for sale, no questions either way',
      'A stripped tender pulls alongside and opens a channel. The ' + s.n + ' behind it has no registry, no history and no warranty. ' + s.d,
      [{ l: 'Buy it for ' + fmt(price) + ' units', f: () => {
          if (G.credits < price) { say('You cannot cover it. The broker leaves.', 'bad'); return; }
          G.credits -= price; G.owned.push(key); G.fit[key] = G.fit[key] || {}; G.paint[key] = G.paint[key] || s.col;
          G.shipNames[key] = G.shipNames[key] || shipName(rng((Math.random() * 1e9) | 0));
          G.ship = key; G.hull = ST().hull; G.shield = ST().shield;
          repChange('outlaw', 0.4); AU.play('upgrade');
          say('Now flying the ' + s.n + '.', 'rare');
        } },
       { l: 'Decline', ghost: true }]);
  },
  function blackhole() {
    showEvent('black hole', 'A hole where a star should be',
      'The accretion disc is bright enough to read by. Your charts call this a shortcut. Your charts have never come back from one.',
      [{ l: 'Fall in', f: () => {
          const jump = 40 + Math.floor(Math.random() * 60), a = Math.random() * TAU;
          P.x += Math.cos(a) * jump * GAL_CELL; P.y += Math.sin(a) * jump * GAL_CELL;
          G.stat.jumps += jump; hurt(50 + Math.random() * 60, 'tidal shear');
          for (const k in G.cargo) if (Math.random() < 0.35) delete G.cargo[k];
          refreshTools();
          say('Flung ' + jump + ' sectors. Hull scarred, some cargo gone.', 'rare');
          discover('bh:' + Math.floor(P.x / 3000), 'Black hole transit', 'Phenomenon', 'Survived a singularity crossing. Cargo loss is standard.', 25000);
        } },
       { l: 'Burn hard the other way', ghost: true }]);
  },
  function convoy() {
    showEvent('convoy', 'A line of haulers running in close formation',
      'Six ships nose to tail, escorted and moving with purpose. The lead vessel opens a channel before you can.',
      [{ l: 'Trade with the convoy', f: () => {
          let tot = 0, q = 0;
          for (const k in G.cargo) { const amt = Math.floor(G.cargo[k]); tot += amt * Math.round(priceOf(k, sys) * 1.25); q += amt; }
          if (!q) { say('You have nothing to sell them.', 'warn'); return; }
          G.cargo = {}; refreshTools(); G.credits += tot; G.stat.sold += q;
          repChange('gek', 0.4); AU.play('buy');
          say('Convoy bought the whole hold at a premium: ' + fmt(tot) + ' units.', 'good');
        } },
       { l: 'Raid the rear hauler', f: () => {
          repChange('gek', -1.8); repChange('outlaw', 1.0);
          const r = rng((Math.random() * 1e9) | 0);
          for (let i = 0; i < 3; i++) { const t = makeTraffic(r, sys, P.x + rr(r, -1400, 1400), P.y + rr(r, -1400, 1400)); t.hostile = true; t.state = 'attack'; hostiles.push(t); }
          for (let i = 0; i < 4; i++) addRes(pick(r, ['platinum','emeril','chromatic','indium']), 30);
          say('You take what you can. The escort is already turning.', 'warn');
        } },
       { l: 'Let them pass', ghost: true }]);
  }
];
function encounterTick(dt) {
  if (G.mode !== 'galaxy' || modalOpen || G.tutorial) return;
  G.encTimer -= dt * (P.boost > 0 ? 1.8 : 1);
  if (G.encTimer <= 0) { G.encTimer = 55 + Math.random() * 70; pick(Math.random, ENCOUNTERS)(); }
}
function raidCheck(dt) {
  const n = Object.keys(G.colonies).length;
  if (!n) return;
  G.raidTimer -= dt;
  if (G.raidTimer > 0) return;
  G.raidTimer = 360 + Math.random() * 420;
  const keys = Object.keys(G.colonies);
  const co = G.colonies[pick(Math.random, keys)];
  const st = colStats(co);
  if (st.def > 0) say('Raiders turned back by the shield over ' + co.name + '.', 'good');
  else {
    const lost = Math.round(co.pop * 0.18);
    co.pop = Math.max(1, co.pop - lost); co.raided++;
    AU.play('lose', 0.5);
    say('Raiders hit ' + co.name + '. ' + fmtN(lost) + ' colonists lost. Build a planetary shield.', 'bad');
  }
}

/* ------------------------------------------------------------
   29. RENDERING
------------------------------------------------------------ */
function shipPath(g, s) {
  g.beginPath();
  switch (s) {
    case 'scout':
      g.moveTo(24, 0); g.lineTo(2, 7); g.lineTo(-14, 5); g.lineTo(-10, 0); g.lineTo(-14, -5); g.lineTo(2, -7); g.closePath(); break;
    case 'fighter':
      g.moveTo(22, 0); g.lineTo(4, 6); g.lineTo(-6, 16); g.lineTo(-12, 14); g.lineTo(-8, 4); g.lineTo(-16, 0);
      g.lineTo(-8, -4); g.lineTo(-12, -14); g.lineTo(-6, -16); g.lineTo(4, -6); g.closePath(); break;
    case 'explorer':
      g.moveTo(26, 0); g.lineTo(10, 5); g.lineTo(-4, 6); g.lineTo(-6, 13); g.lineTo(-14, 12); g.lineTo(-14, 4);
      g.lineTo(-20, 0); g.lineTo(-14, -4); g.lineTo(-14, -12); g.lineTo(-6, -13); g.lineTo(-4, -6); g.lineTo(10, -5); g.closePath(); break;
    case 'living':
      g.moveTo(24, 0); g.quadraticCurveTo(6, 12, -10, 15); g.quadraticCurveTo(-18, 6, -16, 0);
      g.quadraticCurveTo(-18, -6, -10, -15); g.quadraticCurveTo(6, -12, 24, 0); break;
    case 'exotic':
      g.moveTo(24, 0); g.lineTo(0, 9); g.lineTo(-18, 14); g.lineTo(-12, 0); g.lineTo(-18, -14); g.lineTo(0, -9); g.closePath(); break;
    /* a narrow, forked-tail interceptor — a new rung-one silhouette */
    case 'interceptor':
      g.moveTo(23, 0); g.lineTo(6, 3); g.lineTo(-4, 9); g.lineTo(-14, 17); g.lineTo(-9, 4); g.lineTo(-13, 0);
      g.lineTo(-9, -4); g.lineTo(-14, -17); g.lineTo(-4, -9); g.lineTo(6, -3); g.closePath(); break;
    /* a squat, double-hulled corvette — a new rung-two silhouette */
    case 'corvette':
      g.moveTo(20, 5); g.lineTo(4, 9); g.lineTo(-16, 9); g.lineTo(-20, 4); g.lineTo(-20, -4); g.lineTo(-16, -9);
      g.lineTo(4, -9); g.lineTo(20, -5); g.lineTo(10, 0); g.closePath(); break;
    default:
      g.moveTo(20, 0); g.lineTo(12, 9); g.lineTo(-12, 11); g.lineTo(-18, 6); g.lineTo(-18, -6);
      g.lineTo(-12, -11); g.lineTo(12, -9); g.closePath();
  }
}
function drawShip(g, x, y, ang, col, scale, thrusting, shape) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(scale, scale);
  if (thrusting) {
    const f = 14 + Math.random() * 16;
    const grd = g.createLinearGradient(-16, 0, -16 - f, 0);
    grd.addColorStop(0, col); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(-14, 5); g.lineTo(-16 - f, 0); g.lineTo(-14, -5); g.closePath(); g.fill();
  }
  shipPath(g, shape || 'hauler');
  g.fillStyle = 'rgba(8,16,24,.95)'; g.fill();
  g.lineWidth = 1.6; g.strokeStyle = col; g.stroke();
  g.beginPath(); g.arc(6, 0, 3.4, 0, TAU); g.fillStyle = '#eaffff'; g.fill();
  g.restore();
}
function drawWalker(g, x, y, ang, col, t, face) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,.3)';
  g.beginPath(); g.ellipse(0, 13, 12, 5, 0, 0, TAU); g.fill();
  const sw = Math.sin(t * 6) * 5;
  g.strokeStyle = col; g.lineWidth = 3.4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 4); g.lineTo(-4 + sw, 14); g.moveTo(0, 4); g.lineTo(4 - sw, 14); g.stroke();
  g.beginPath(); g.moveTo(0, -4); g.lineTo(-7 - sw * 0.6, 4); g.moveTo(0, -4); g.lineTo(7 + sw * 0.6, 4); g.stroke();
  g.fillStyle = 'rgba(10,22,32,.95)'; g.strokeStyle = col; g.lineWidth = 2;
  g.beginPath(); g.roundRect ? g.roundRect(-6, -9, 12, 15, 3) : g.rect(-6, -9, 12, 15); g.fill(); g.stroke();
  g.beginPath(); g.arc(0, -14, 6.5, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#9fe4ff';
  g.beginPath(); g.ellipse(face * 2, -14, 3.6, 2.6, 0, 0, TAU); g.fill();
  g.lineCap = 'butt';
  g.restore();
}
function drawCreature(g, c) {
  g.save(); g.translate(c.x, c.y);
  g.fillStyle = 'rgba(0,0,0,.28)';
  g.beginPath(); g.ellipse(0, c.sz * 0.7, c.sz, c.sz * 0.35, 0, 0, TAU); g.fill();
  const wob = Math.sin(G.t * 5 + c.ph) * 0.12;
  g.rotate(wob);
  g.strokeStyle = c.col; g.lineWidth = Math.max(1.6, c.sz * 0.14); g.lineCap = 'round';
  for (let i = 0; i < c.legs; i++) {
    const a = -0.9 + (i / Math.max(1, c.legs - 1)) * 1.8 + Math.sin(G.t * 7 + i) * 0.22;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * c.sz * 1.8, Math.abs(Math.sin(a)) * c.sz * 1.5 + c.sz * 0.4); g.stroke();
  }
  g.fillStyle = c.col; g.globalAlpha = 0.9;
  g.beginPath();
  if (c.body === 0) g.ellipse(0, 0, c.sz, c.sz * 0.66, 0, 0, TAU);
  else if (c.body === 1) { g.moveTo(-c.sz, 0); g.quadraticCurveTo(0, -c.sz, c.sz, 0); g.quadraticCurveTo(0, c.sz * 0.8, -c.sz, 0); }
  else if (c.body === 2) { for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; const rad = c.sz * (i % 2 ? 0.6 : 1); i ? g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : g.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); } g.closePath(); }
  else g.ellipse(0, 0, c.sz * 1.25, c.sz * 0.5, 0, 0, TAU);
  g.fill(); g.globalAlpha = 1;
  g.fillStyle = c.eye;
  g.beginPath(); g.arc((c.face || 1) * c.sz * 0.5, -c.sz * 0.15, c.sz * 0.2, 0, TAU); g.fill();
  if (c.temper === 'aggressive' || c.temper === 'predator') {
    g.strokeStyle = '#ff6a4d'; g.lineWidth = 1.4; g.globalAlpha = 0.55;
    g.beginPath(); g.arc(0, 0, c.sz * 1.9, 0, TAU); g.stroke(); g.globalAlpha = 1;
  }
  g.lineCap = 'butt';
  g.restore();
  if (c.hp < c.max) {
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(c.x - 18, c.y - c.sz - 16, 36, 3);
    g.fillStyle = '#ff6a4d'; g.fillRect(c.x - 18, c.y - c.sz - 16, 36 * (c.hp / c.max), 3);
  }
}
function drawNpcFig(g, n) {
  g.save(); g.translate(n.x, n.y);
  g.fillStyle = 'rgba(0,0,0,.28)';
  g.beginPath(); g.ellipse(0, 14, 11, 4.5, 0, 0, TAU); g.fill();
  g.strokeStyle = n.col; g.lineWidth = 3; g.lineCap = 'round';
  const sw = Math.sin(G.t * 2.4 + n.ph) * 3;
  g.beginPath(); g.moveTo(0, 4); g.lineTo(-4 + sw, 14); g.moveTo(0, 4); g.lineTo(4 - sw, 14); g.stroke();
  g.fillStyle = 'rgba(10,22,32,.95)';
  g.beginPath(); g.rect(-6, -8, 12, 14); g.fill(); g.stroke();
  g.beginPath(); g.arc(0, -14, 6, 0, TAU); g.fillStyle = n.col; g.fill();
  /* drawn weapon shows as a short bar in the hands */
  if (n.state === 'fight' && n.weapon) {
    g.strokeStyle = '#ff6a4d'; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(0, -2); g.lineTo((n.face || 1) * 13, -4); g.stroke();
  }
  g.lineCap = 'butt';
  g.restore();
  if (n.hp < n.max) {
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(n.x - 16, n.y - 34, 32, 3);
    g.fillStyle = '#ff6a4d'; g.fillRect(n.x - 16, n.y - 34, 32 * (n.hp / n.max), 3);
  }
  g.fillStyle = 'rgba(214,230,236,.85)'; g.font = '11px "IBM Plex Mono", monospace'; g.textAlign = 'center';
  g.fillText(n.name, n.x, n.y - 44);
  g.fillStyle = n.state === 'fight' ? '#ff6a4d' : FACTIONS[n.fac].c; g.font = '10px "IBM Plex Mono", monospace';
  g.fillText(n.state === 'fight' ? 'armed' : n.role, n.x, n.y - 32);
  g.textAlign = 'left';
}

function begin() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const sk = G.set.shake ? cam.shake : 0;
  ctx.translate(W / 2 + (Math.random() - 0.5) * sk, H / 2 + (Math.random() - 0.5) * sk);
  ctx.scale(cam.z, cam.z);
  ctx.translate(-cam.x, -cam.y);
}
function end() { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }

function stars(depth, col, size) {
  if (G.set.quality === 0 && depth > 0.2) return;
  /* fixed screen-space lattice, offset by the parallax factor.
     Scaling spacing by depth put tens of thousands of points on screen. */
  const sp = G.set.quality > 1 ? 104 : 150;
  const ox = cam.x * depth, oy = cam.y * depth;
  const x0 = Math.floor((ox - W) / sp), x1 = Math.floor((ox + W) / sp);
  const y0 = Math.floor((oy - H) / sp), y1 = Math.floor((oy + H) / sp);
  ctx.fillStyle = col;
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
    const h = hash2(i, j, 7 + Math.round(depth * 1000));
    const px = i * sp + (h % 1000) / 1000 * sp, py = j * sp + ((h >> 10) % 1000) / 1000 * sp;
    const sx = px - ox + W / 2, sy = py - oy + H / 2;
    if (sx < -4 || sx > W + 4 || sy < -4 || sy > H + 4) continue;
    const tw = G.set.quality > 1 ? 0.75 + Math.sin(G.t * 2 + (h % 100)) * 0.25 : 1;
    ctx.globalAlpha = (0.25 + ((h >> 20) % 100) / 140) * tw;
    ctx.fillRect(sx, sy, size, size);
  }
  ctx.globalAlpha = 1;
}
function nebula(cols) {
  if (G.set.quality === 0) return;
  const g = ctx.createRadialGradient(W * 0.22, H * 0.2, 0, W * 0.22, H * 0.2, W * 0.7);
  g.addColorStop(0, cols[0]); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createRadialGradient(W * 0.82, H * 0.78, 0, W * 0.82, H * 0.78, W * 0.6);
  g2.addColorStop(0, cols[1]); g2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
}

/* --- surface --- */
function sunAmount() {
  /* 0 at midnight, 1 at noon */
  return clamp(Math.sin(G.dayT * TAU - Math.PI / 2) * 0.5 + 0.5, 0, 1);
}
function renderSurface() {
  const b = BIOMES[planet.biome];
  const sun = sunAmount();
  const night = 1 - sun;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  const mixNight = (hex, amt) => {
    const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const c = p(hex);
    return 'rgb(' + Math.round(c[0] * (1 - amt * 0.78)) + ',' + Math.round(c[1] * (1 - amt * 0.78)) + ',' + Math.round(c[2] * (1 - amt * 0.6)) + ')';
  };
  g.addColorStop(0, mixNight(b.sky[0], night)); g.addColorStop(1, mixNight(b.sky[1], night));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (night > 0.35) stars(0.05, 'rgba(255,255,255,' + (night * 0.7) + ')', 1.2);

  /* distant mountain parallax */
  if (G.set.quality > 0) {
    for (let layer = 0; layer < 2; layer++) {
      const par = 0.06 + layer * 0.07, yb = H * (0.34 + layer * 0.08);
      ctx.fillStyle = 'rgba(' + (20 + layer * 14) + ',' + (30 + layer * 16) + ',' + (38 + layer * 18) + ',' + (0.5 - layer * 0.16) + ')';
      ctx.beginPath(); ctx.moveTo(-10, H);
      for (let x = -10; x <= W + 10; x += 28) {
        const wx = (cam.x * par + x) * 0.0022;
        ctx.lineTo(x, yb - fbm(wx, layer * 9.1, planet.seed + layer, 3) * H * 0.22);
      }
      ctx.lineTo(W + 10, H); ctx.closePath(); ctx.fill();
    }
  }

  begin();
  ctx.fillStyle = mixNight(b.gnd, night * 0.8);
  ctx.fillRect(cam.x - W / cam.z, cam.y - H / cam.z, (W * 2) / cam.z, (H * 2) / cam.z);

  const cells = surfAround(planet, cam.x, cam.y, 3);

  /* lakes */
  for (const c of cells) if (c.lake) {
    const l = c.lake;
    const lg = ctx.createRadialGradient(l.x, l.y, l.r * 0.2, l.x, l.y, l.r);
    lg.addColorStop(0, 'rgba(30,110,150,.9)'); lg.addColorStop(1, 'rgba(12,50,80,.92)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(143,232,255,.45)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, TAU); ctx.stroke();
    if (G.set.quality > 0) {
      ctx.strokeStyle = 'rgba(190,240,255,.2)'; ctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(l.x, l.y, l.r * (0.25 * i) + Math.sin(G.t * 1.4 + i) * 6, 0, TAU); ctx.stroke();
      }
    }
  }
  /* terrain grid */
  ctx.strokeStyle = 'rgba(255,255,255,.03)'; ctx.lineWidth = 1;
  const gs = 140;
  const gx0 = Math.floor((cam.x - W / cam.z) / gs) * gs, gx1 = cam.x + W / cam.z;
  const gy0 = Math.floor((cam.y - H / cam.z) / gs) * gs, gy1 = cam.y + H / cam.z;
  ctx.beginPath();
  for (let x = gx0; x < gx1; x += gs) { ctx.moveTo(x, gy0); ctx.lineTo(x, gy1); }
  for (let y = gy0; y < gy1; y += gs) { ctx.moveTo(gx0, y); ctx.lineTo(gx1, y); }
  ctx.stroke();

  /* rocks */
  for (const c of cells) for (const rk of c.rocks) {
    ctx.save(); ctx.translate(rk.x, rk.y); ctx.rotate(rk.a);
    ctx.beginPath();
    for (let i = 0; i < rk.s; i++) {
      const a = (i / rk.s) * TAU, rad = rk.r * (0.72 + ((hash2(i, rk.s, Math.floor(rk.x)) % 100) / 340));
      i ? ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fillStyle = mixNight(b.rock, night * 0.7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath(); ctx.ellipse(rk.r * 0.3, rk.r * 0.35, rk.r * 0.55, rk.r * 0.3, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* flora */
  for (const c of cells) for (const f of c.flora) {
    ctx.save(); ctx.translate(f.x, f.y);
    ctx.rotate(Math.sin(G.t * 0.8 + f.sw) * 0.06);
    ctx.strokeStyle = b.acc; ctx.globalAlpha = 0.45 + sun * 0.3; ctx.lineWidth = 2;
    ctx.beginPath();
    if (f.t === 0) { for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * f.r, Math.sin(a) * f.r); } }
    else if (f.t === 1) { ctx.arc(0, 0, f.r * 0.7, 0, TAU); }
    else if (f.t === 2) { ctx.moveTo(-f.r, f.r); ctx.lineTo(0, -f.r); ctx.lineTo(f.r, f.r); }
    else { ctx.moveTo(0, f.r); ctx.lineTo(0, -f.r); ctx.moveTo(0, -f.r * 0.3); ctx.lineTo(-f.r * 0.7, -f.r); ctx.moveTo(0, -f.r * 0.3); ctx.lineTo(f.r * 0.7, -f.r); }
    ctx.stroke(); ctx.globalAlpha = 1; ctx.restore();
  }
  /* settlements */
  for (const c of cells) if (c.settlement) {
    const st = c.settlement;
    const hot = st.hostile || civMood(st) === 'hostile';
    ctx.strokeStyle = hot ? '#ff5f8f' : FACTIONS[st.fac].c;
    ctx.globalAlpha = hot ? 0.32 + Math.sin(G.t * 3) * 0.1 : 0.22; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(st.x, st.y, st.r || 330, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    /* walls they have put up since you last caused trouble */
    for (const w of st.walls) {
      if (w.hp <= 0) continue;
      ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.a + Math.PI / 2);
      ctx.fillStyle = 'rgba(14,26,34,.95)'; ctx.strokeStyle = FACTIONS[st.fac].c; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.rect(-42, -9, 84, 18); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#ff6a4d';
      ctx.fillRect(-42, -9, 84 * (1 - w.hp / w.max), 3); ctx.globalAlpha = 1;
      ctx.restore();
    }
    for (const h of st.huts) {
      ctx.save(); ctx.translate(h.x, h.y);
      if (h.dead) {
        /* a levelled structure leaves a footprint and a lot of smoke */
        ctx.fillStyle = 'rgba(24,18,16,.9)'; ctx.strokeStyle = '#5a4a44'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.rect(-h.w / 2, -h.h / 4, h.w, h.h / 2); ctx.fill(); ctx.stroke();
        ctx.globalAlpha = 0.25; ctx.fillStyle = '#6b5c54';
        for (let q = 0; q < 4; q++) ctx.fillRect(-h.w / 2 + q * h.w / 4, -h.h / 4 - 6 - Math.sin(G.t + q) * 3, 7, 7);
        ctx.globalAlpha = 1;
        ctx.restore();
        continue;
      }
      ctx.fillStyle = 'rgba(10,22,30,.94)'; ctx.strokeStyle = hot ? '#ff5f8f' : FACTIONS[st.fac].c; ctx.lineWidth = 2.2;
      if (h.t === 0) { ctx.beginPath(); ctx.moveTo(-h.w / 2, h.h / 2); ctx.lineTo(-h.w / 2 * 0.7, -h.h / 2); ctx.lineTo(h.w / 2 * 0.7, -h.h / 2); ctx.lineTo(h.w / 2, h.h / 2); ctx.closePath(); }
      else if (h.t === 1) { ctx.beginPath(); ctx.arc(0, 0, h.w / 2, Math.PI, TAU); ctx.lineTo(h.w / 2, h.h / 2); ctx.lineTo(-h.w / 2, h.h / 2); ctx.closePath(); }
      else { ctx.beginPath(); ctx.rect(-h.w / 2, -h.h / 2, h.w, h.h); }
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,220,150,' + (0.25 + night * 0.65) + ')';
      ctx.fillRect(-7, -4, 6, 9); ctx.fillRect(3, -4, 6, 9);
      if (h.hp < h.max) {
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(-h.w / 2, -h.h / 2 - 9, h.w, 3);
        ctx.fillStyle = '#ff6a4d'; ctx.fillRect(-h.w / 2, -h.h / 2 - 9, h.w * (h.hp / h.max), 3);
      }
      ctx.restore();
    }
    ctx.fillStyle = hot ? '#ff5f8f' : FACTIONS[st.fac].c; ctx.font = '600 15px "Chakra Petch", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(st.name + (st.razed ? ' (ruins)' : ''), st.x, st.y - 120);
    ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillStyle = 'rgba(148,176,188,.9)';
    ctx.fillText(FACTIONS[st.fac].n + ' · ' + civMood(st), st.x, st.y - 104);
    ctx.textAlign = 'left';
    for (const n of st.npcs) if (!n.dead) drawNpcFig(ctx, n);
  }
  for (const c of cells) if (c.wanderer && !c.wanderer.dead) drawNpcFig(ctx, c.wanderer);
  /* ancient structures */
  for (const c of cells) if (c.struct) {
    const s = c.struct;
    ctx.save(); ctx.translate(s.x, s.y);
    ctx.strokeStyle = s.used ? '#5a6d78' : '#d484ff'; ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(12,6,20,.85)';
    if (s.t === 'monolith') { ctx.beginPath(); ctx.moveTo(-16, 40); ctx.lineTo(-11, -58); ctx.lineTo(11, -58); ctx.lineTo(16, 40); ctx.closePath(); }
    else if (s.t === 'beacon') { ctx.beginPath(); ctx.moveTo(0, -62); ctx.lineTo(18, 30); ctx.lineTo(-18, 30); ctx.closePath(); }
    else if (s.t === 'wreck') { ctx.beginPath(); ctx.moveTo(-48, 14); ctx.lineTo(20, 24); ctx.lineTo(46, -2); ctx.lineTo(-10, -24); ctx.closePath(); }
    else if (s.t === 'cache') { ctx.beginPath(); ctx.rect(-26, -18, 52, 36); }
    else { ctx.beginPath(); ctx.rect(-44, -26, 88, 52); }
    ctx.fill(); ctx.stroke();
    if (!s.used) { ctx.globalAlpha = 0.35 + Math.sin(G.t * 3) * 0.25; ctx.lineWidth = 9; ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  /* deposits */
  for (const c of cells) for (const d of c.deps) {
    if (d.amt <= 0) continue;
    const col = MAT[d.res].c;
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.a + G.t * 0.15);
    const pulse = 1 + Math.sin(G.t * 2 + d.x) * 0.06;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU, rad = d.rad * (i % 2 ? 0.55 : 1) * pulse;
      i ? ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fillStyle = col; ctx.globalAlpha = 0.28; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.restore();
    if (d === mineTarget) {
      ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.rad + 22 + Math.sin(G.t * 4) * 3, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = col; ctx.font = '600 15px "Chakra Petch", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(MAT[d.res].n + '  ' + Math.ceil(d.amt), d.x, d.y - d.rad - 30); ctx.textAlign = 'left';
    }
  }
  /* small nodes */
  for (const c of cells) for (const n of c.nodes) {
    if (n.amt <= 0) continue;
    const col = MAT[n.res].c;
    ctx.save(); ctx.translate(n.x, n.y); ctx.rotate(n.a);
    ctx.fillStyle = col; ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, -14); ctx.lineTo(9, 4); ctx.lineTo(-9, 4); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.restore();
    if (n === nodeTarget) {
      ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(n.x, n.y, 24 + Math.sin(G.t * 5) * 2, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = col; ctx.font = '12px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText(MAT[n.res].n + ' ×' + n.amt, n.x, n.y - 28); ctx.textAlign = 'left';
    }
  }
  /* border rings — the edge of somewhere you have declared yours */
  for (const d of districtsOf(planet.id)) {
    ctx.save();
    ctx.strokeStyle = d.stab ? '#6fd8ff' : '#4fe3d0';
    ctx.globalAlpha = 0.28 + Math.sin(G.t * 1.1) * 0.06;
    ctx.lineWidth = 5;
    ctx.setLineDash([26, 18]);
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = d.stab ? 0.055 : 0.028;
    ctx.fillStyle = d.stab ? '#6fd8ff' : '#4fe3d0';
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    /* marker posts around the edge */
    ctx.fillStyle = d.stab ? '#6fd8ff' : '#4fe3d0';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      ctx.fillRect(d.x + Math.cos(a) * d.r - 3, d.y + Math.sin(a) * d.r - 3, 6, 6);
    }
    ctx.fillStyle = d.stab ? '#6fd8ff' : '#4fe3d0';
    ctx.font = '600 14px "Chakra Petch", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(d.name + (d.stab ? ' · sky held' : ''), d.x, d.y - d.r - 14);
    ctx.textAlign = 'left';
    ctx.restore();
  }
  /* dropped cargo */
  for (const q of piles) {
    ctx.save(); ctx.translate(q.x, q.y);
    ctx.fillStyle = 'rgba(8,18,26,.9)'; ctx.strokeStyle = MAT[q.k].c; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.rect(-11, -9, 22, 18); ctx.fill(); ctx.stroke();
    ctx.fillStyle = MAT[q.k].c; ctx.globalAlpha = 0.6;
    ctx.fillRect(-7, -5, 14, 4); ctx.globalAlpha = 1;
    ctx.restore();
    ctx.fillStyle = MAT[q.k].c; ctx.font = '11px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText(MAT[q.k].n + ' ×' + Math.floor(q.n), q.x, q.y - 18); ctx.textAlign = 'left';
  }
  /* base + colony buildings */
  const site = siteFor(planet.id);
  if (site) for (const bd of site.build) {
    const d = BUILDS[bd.t]; if (!d) continue;
    ctx.save(); ctx.translate(bd.x, bd.y);
    ctx.fillStyle = 'rgba(8,24,32,.94)'; ctx.strokeStyle = d.personal ? '#ffc46b' : '#4fe3d0'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-30, 22); ctx.lineTo(-22, -16); ctx.lineTo(22, -16); ctx.lineTo(30, 22); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -16, 22, Math.PI, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,220,150,' + (0.3 + night * 0.6) + ')';
    ctx.fillRect(-9, -6, 6, 10); ctx.fillRect(3, -6, 6, 10);
    ctx.fillStyle = '#8fd8cf'; ctx.font = '11px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText(d.n, 0, 40); ctx.textAlign = 'left';
    ctx.restore();
  }
  /* creatures */
  for (const c of cells) for (const cr of c.crits) if (!cr.dead) drawCreature(ctx, cr);
  /* beams */
  for (const bm of beams) {
    ctx.strokeStyle = bm.c; ctx.lineWidth = bm.w || 2.6; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(bm.x1, bm.y1); ctx.lineTo(bm.x2, bm.y2); ctx.stroke();
    ctx.lineWidth = (bm.w || 2.6) * 2.8; ctx.globalAlpha = 0.16; ctx.stroke(); ctx.globalAlpha = 1;
  }
  /* ground fire */
  for (const s of shots) {
    if (s.blast) {
      ctx.fillStyle = s.c; ctx.globalAlpha = 0.6 + Math.sin(G.t * 24) * 0.35;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.sz || 5, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = s.c; ctx.globalAlpha = 0.28; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.blast, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = s.c; ctx.lineWidth = s.sz || 2.4;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.02, s.y - s.vy * 0.02); ctx.stroke();
    }
  }
  drawParts();
  /* parked ship when on foot */
  if (G.onFoot && shipAnchor) {
    ctx.fillStyle = 'rgba(0,0,0,.34)';
    ctx.beginPath(); ctx.ellipse(shipAnchor.x + 14, shipAnchor.y + 20, 24, 10, 0, 0, TAU); ctx.fill();
    drawShip(ctx, shipAnchor.x, shipAnchor.y, shipAnchor.ang, ST().col, 1, false, ST().s);
    if (G.nearShip) {
      ctx.strokeStyle = '#4fe3d0'; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(shipAnchor.x, shipAnchor.y, 46 + Math.sin(G.t * 3) * 3, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  /* player */
  if (G.onFoot) drawWalker(ctx, P.x, P.y, P.ang, '#4fe3d0', P.walkT, P.face);
  else {
    ctx.fillStyle = 'rgba(0,0,0,.34)';
    ctx.beginPath(); ctx.ellipse(P.x + 16, P.y + 22, 22, 9, 0, 0, TAU); ctx.fill();
    drawShip(ctx, P.x, P.y, P.ang, ST().col, 1, P.thrust > 0, ST().s);
  }
  drawFloaters();
  end();
  /* weather overlay */
  renderWeather(b, night);
}
function renderWeather(b, night) {
  if (G.set.quality === 0) return;
  /* inside a stabilised border ring the sky is held still */
  if (sheltered(P.x, P.y)) {
    ctx.save();
    const gg = ctx.createRadialGradient(W / 2, H / 2, H * 0.1, W / 2, H / 2, W * 0.75);
    gg.addColorStop(0, 'rgba(111,216,255,0)'); gg.addColorStop(1, 'rgba(111,216,255,.07)');
    ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    return;
  }
  const wx = planet.weatherNow || b.wx[0];
  ctx.save();
  if (/rain|squall|drizzle/.test(wx)) {
    ctx.strokeStyle = 'rgba(160,210,255,.28)'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 140; i++) {
      const x = (i * 137 + G.t * 900) % (W + 200) - 100;
      const y = (i * 311 + G.t * 1500) % (H + 200) - 100;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 18); ctx.stroke();
    }
  } else if (/snow|ice/.test(wx)) {
    ctx.fillStyle = 'rgba(230,245,255,.5)';
    for (let i = 0; i < 110; i++) {
      const x = (i * 179 + G.t * 60 + Math.sin(G.t + i) * 30) % (W + 60) - 30;
      const y = (i * 263 + G.t * 190) % (H + 60) - 30;
      ctx.fillRect(x, y, 2.4, 2.4);
    }
  } else if (/ash|ember|sand|dust|pyro/.test(wx)) {
    ctx.fillStyle = /ember/.test(wx) ? 'rgba(255,140,80,.55)' : 'rgba(180,160,140,.35)';
    for (let i = 0; i < 130; i++) {
      const x = (i * 211 + G.t * 420) % (W + 80) - 40;
      const y = (i * 149 + G.t * 130 + Math.sin(G.t * 2 + i) * 20) % (H + 80) - 40;
      ctx.fillRect(x, y, 2.6, 2.6);
    }
  } else if (/fog|haze|mist|glow/.test(wx)) {
    const gg = ctx.createLinearGradient(0, H * 0.4, 0, H);
    gg.addColorStop(0, 'rgba(200,220,230,0)'); gg.addColorStop(1, 'rgba(200,220,230,.16)');
    ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
  }
  if (night > 0.5) { ctx.fillStyle = 'rgba(6,12,26,' + ((night - 0.5) * 0.5) + ')'; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}

/* --- system --- */
function renderSystem() {
  ctx.fillStyle = '#02040a'; ctx.fillRect(0, 0, W, H);
  nebula(['rgba(79,227,208,.055)', 'rgba(212,132,255,.05)']);
  stars(0.12, 'rgba(255,255,255,.7)', 1.3);
  stars(0.3, 'rgba(180,220,255,.6)', 1.8);

  begin();
  const st = sys.star;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, st.r * 6);
  g.addColorStop(0, st.c); g.addColorStop(0.12, st.c);
  g.addColorStop(0.3, 'rgba(255,200,120,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, st.r * 6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, st.r * 0.72, 0, TAU); ctx.fill();
  /* corona flicker */
  ctx.strokeStyle = st.c; ctx.globalAlpha = 0.25;
  ctx.lineWidth = 3 / cam.z;
  ctx.beginPath(); ctx.arc(0, 0, st.r * (0.85 + Math.sin(G.t * 1.6) * 0.03), 0, TAU); ctx.stroke();
  ctx.globalAlpha = 1;

  if (sys.belt) {
    const br = (sys.planets.length ? sys.planets[sys.planets.length - 1].orbit : 2000) + 500;
    ctx.strokeStyle = 'rgba(200,190,170,.12)'; ctx.lineWidth = 140;
    ctx.beginPath(); ctx.arc(0, 0, br, 0, TAU); ctx.stroke();
  }
  for (const pl of sys.planets) {
    ctx.strokeStyle = 'rgba(120,200,220,.12)'; ctx.lineWidth = 1.4 / cam.z;
    ctx.beginPath(); ctx.arc(0, 0, pl.orbit, 0, TAU); ctx.stroke();
    const pp = planetPos(pl, G.t);
    const b = BIOMES[pl.biome];
    /* atmosphere halo */
    const ag = ctx.createRadialGradient(pp[0], pp[1], pl.r * 0.9, pp[0], pp[1], pl.r * 1.5);
    ag.addColorStop(0, b.acc.replace(')', '')); ag.addColorStop(0, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.22; ctx.fillStyle = b.acc;
    ctx.beginPath(); ctx.arc(pp[0], pp[1], pl.r * 1.22, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    /* body lit from the star */
    const ang = Math.atan2(pp[1], pp[0]);
    const lx = pp[0] - Math.cos(ang) * pl.r * 0.45, ly = pp[1] - Math.sin(ang) * pl.r * 0.45;
    const pg = ctx.createRadialGradient(lx, ly, pl.r * 0.06, pp[0], pp[1], pl.r * 1.15);
    pg.addColorStop(0, b.acc); pg.addColorStop(0.42, b.gnd); pg.addColorStop(1, '#05070c');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(pp[0], pp[1], pl.r, 0, TAU); ctx.fill();
    /* cloud bands */
    if (G.set.quality > 1) {
      ctx.save(); ctx.beginPath(); ctx.arc(pp[0], pp[1], pl.r, 0, TAU); ctx.clip();
      ctx.globalAlpha = 0.14; ctx.fillStyle = '#ffffff';
      for (let i = -3; i <= 3; i++) {
        const yy = pp[1] + i * pl.r * 0.32 + Math.sin(G.t * 0.2 + i) * 4;
        ctx.fillRect(pp[0] - pl.r, yy, pl.r * 2, pl.r * 0.13);
      }
      ctx.globalAlpha = 1; ctx.restore();
    }
    if (pl.rings) {
      ctx.save(); ctx.translate(pp[0], pp[1]); ctx.scale(1, 0.3);
      ctx.strokeStyle = 'rgba(220,210,190,.35)'; ctx.lineWidth = pl.r * 0.18;
      ctx.beginPath(); ctx.arc(0, 0, pl.r * 1.7, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    for (let m = 0; m < pl.moons; m++) {
      const ma = G.t * (0.5 + m * 0.2) + m * 2.1;
      const mr = pl.r * (1.9 + m * 0.55);
      ctx.fillStyle = '#97a6b4';
      ctx.beginPath(); ctx.arc(pp[0] + Math.cos(ma) * mr, pp[1] + Math.sin(ma) * mr, pl.r * 0.16, 0, TAU); ctx.fill();
    }
    if (G.colonies[pl.id] || G.bases[pl.id]) {
      ctx.strokeStyle = G.colonies[pl.id] ? '#4fe3d0' : '#ffc46b'; ctx.lineWidth = 3 / cam.z; ctx.setLineDash([12, 10]);
      ctx.beginPath(); ctx.arc(pp[0], pp[1], pl.r + 26, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle = pl.scanned ? '#cfe6ee' : '#6b8894';
    ctx.font = (14 / cam.z) + 'px "Chakra Petch", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(pl.name + (pl.scanned ? '' : ' · unscanned'), pp[0], pp[1] + pl.r + 32 / cam.z);
    if (pl.settled) { ctx.fillStyle = '#ffc46b'; ctx.font = (11 / cam.z) + 'px "IBM Plex Mono", monospace'; ctx.fillText('inhabited', pp[0], pp[1] + pl.r + 48 / cam.z); }
    ctx.textAlign = 'left';
  }
  if (sys.hasStation) {
    const sp = stationPos(sys, G.t);
    ctx.save(); ctx.translate(sp[0], sp[1]); ctx.rotate(G.t * 0.25);
    ctx.strokeStyle = '#6fd8ff'; ctx.lineWidth = 5; ctx.fillStyle = 'rgba(6,18,28,.9)';
    ctx.beginPath(); ctx.arc(0, 0, 70, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-100, 0); ctx.lineTo(100, 0); ctx.moveTo(0, -100); ctx.lineTo(0, 100); ctx.stroke();
    ctx.fillStyle = '#6fd8ff';
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.fillRect(Math.cos(a) * 100 - 9, Math.sin(a) * 100 - 9, 18, 18); }
    ctx.restore();
    ctx.fillStyle = '#6fd8ff'; ctx.font = (14 / cam.z) + 'px "Chakra Petch", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(sys.stName || 'Trade station', sp[0], sp[1] + 134 / cam.z); ctx.textAlign = 'left';
  }
  for (const t of neutrals) drawTraffic(t, false);
  for (const t of hostiles) drawTraffic(t, true);
  drawBeams(); drawBullets(); drawParts();
  drawShip(ctx, P.x, P.y, P.ang, ST().col, 1.0 / cam.z, P.thrust > 0, ST().s);
  drawFloaters();
  end();
  drawHoleWarning();
}

/* A collapse: an absolutely black disc, a bright accretion ring leaning on
   its own axis, and lensed light smeared around the rim. Everything here is
   drawn in world units because the galaxy view is already transformed. */
function drawBlackHole(s) {
  const R = s.r, t = G.t * 0.12 * s.spin;
  /* the far reach of the well — a faint darkening of everything around it */
  const halo = ctx.createRadialGradient(s.x, s.y, R * 0.8, s.x, s.y, BLACKHOLE_REACH);
  halo.addColorStop(0, 'rgba(24,8,44,.85)');
  halo.addColorStop(0.35, 'rgba(14,4,26,.45)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(s.x, s.y, BLACKHOLE_REACH, 0, TAU); ctx.fill();

  /* accretion disc, drawn as leaning ellipses behind and in front of the hole */
  ctx.save();
  ctx.translate(s.x, s.y); ctx.rotate(s.tilt);
  for (let i = 0; i < 26; i++) {
    const f = i / 26;
    const rad = R * (1.16 + f * 1.5);
    ctx.globalAlpha = (1 - f) * 0.5;
    ctx.strokeStyle = i % 3 === 0 ? '#d484ff' : i % 3 === 1 ? '#ffc46b' : '#6fd8ff';
    ctx.lineWidth = R * 0.035;
    ctx.beginPath();
    ctx.ellipse(0, 0, rad, rad * 0.26, 0, t + f * 2.2, t + f * 2.2 + 2.4 + f);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  /* photon ring, then the event horizon itself */
  const ring = ctx.createRadialGradient(s.x, s.y, R * 0.92, s.x, s.y, R * 1.2);
  ring.addColorStop(0, 'rgba(255,238,200,0)');
  ring.addColorStop(0.45, 'rgba(255,226,170,.85)');
  ring.addColorStop(1, 'rgba(212,132,255,0)');
  ctx.fillStyle = ring;
  ctx.beginPath(); ctx.arc(s.x, s.y, R * 1.2, 0, TAU); ctx.fill();

  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(s.x, s.y, R, 0, TAU); ctx.fill();

  /* matter still falling in */
  for (let i = 0; i < 9; i++) {
    const a = t * 5 + (i / 9) * TAU;
    const rr2 = R * (1.24 + ((i * 7) % 5) * 0.16);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffd9a0';
    ctx.beginPath(); ctx.arc(s.x + Math.cos(a) * rr2, s.y + Math.sin(a) * rr2 * 0.42, R * 0.016, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#c9a8ff';
  ctx.font = (16 / cam.z) + 'px "Chakra Petch", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(s.name, s.x, s.y + R * 1.5);
  ctx.font = (11 / cam.z) + 'px "IBM Plex Mono", monospace'; ctx.fillStyle = '#8f6fb4';
  ctx.fillText('collapsed singularity · do not approach', s.x, s.y + R * 1.5 + 22 / cam.z);
  ctx.textAlign = 'left';
}

/* the screen-space warning while a collapse has hold of you */
function drawHoleWarning() {
  if (!holeNear) return;
  const k = holeNear.k;
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(24,4,40,' + (0.2 + k * 0.7).toFixed(3) + ')');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = k > 0.55 ? '#ff5f8f' : '#d484ff';
  ctx.font = '600 15px "Chakra Petch", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('GRAVITY WELL · ' + Math.round(k * 100) + '% · ' + holeNear.s.name.toUpperCase(), W / 2, 92);
  ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillStyle = 'rgba(207,230,238,.75)';
  ctx.fillText(k > 0.6 ? 'escape velocity exceeded' : 'burn away from the singularity', W / 2, 112);
  ctx.textAlign = 'left';
}
function drawBeams() {
  for (const bm of beams) {
    ctx.strokeStyle = bm.c; ctx.lineWidth = (bm.w || 2.6) / cam.z; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(bm.x1, bm.y1); ctx.lineTo(bm.x2, bm.y2); ctx.stroke();
    ctx.lineWidth = (bm.w || 2.6) * 3 / cam.z; ctx.globalAlpha = 0.16; ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
function drawCitadel(t, hostile) {
  const R = t.rad;
  const war = t.tier === 'warworld';
  ctx.save(); ctx.translate(t.x, t.y);
  /* hull disc */
  const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
  g.addColorStop(0, war ? '#4a1420' : hostile ? '#5b2a22' : '#1d4452');
  g.addColorStop(1, '#070d14');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  ctx.strokeStyle = war ? '#ff5f8f' : FACTIONS[t.fac].c; ctx.lineWidth = (war ? 5 : 3) / cam.z;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  /* a war world wears its hangar mouths on the outside */
  if (war) {
    ctx.strokeStyle = 'rgba(255,95,143,.55)'; ctx.lineWidth = 2.4 / cam.z;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + G.t * 0.05;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.86, a - 0.13, a + 0.13);
      ctx.stroke();
    }
  }
  /* districts of the city, spun slowly */
  ctx.rotate(G.t * 0.06);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU, rr2 = R * (0.3 + ((i * 37) % 11) / 18);
    ctx.fillStyle = 'rgba(10,26,36,.95)';
    ctx.strokeStyle = FACTIONS[t.fac].c; ctx.lineWidth = 1.4 / cam.z;
    const w = R * 0.13, h = R * 0.19;
    ctx.beginPath(); ctx.rect(Math.cos(a) * rr2 - w / 2, Math.sin(a) * rr2 - h / 2, w, h);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,220,150,.75)';
    ctx.fillRect(Math.cos(a) * rr2 - w * 0.2, Math.sin(a) * rr2 - h * 0.2, w * 0.4, h * 0.4);
  }
  ctx.restore();
  /* the forcefield, when one is up */
  if (t.barrier > 1) {
    const f = t.barrier / Math.max(1, t.barrierMax);
    ctx.strokeStyle = '#6fd8ff'; ctx.globalAlpha = 0.2 + f * 0.4;
    ctx.lineWidth = 7 / cam.z;
    ctx.beginPath(); ctx.arc(t.x, t.y, R * 1.32, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.1 + f * 0.12;
    ctx.fillStyle = '#6fd8ff';
    ctx.beginPath(); ctx.arc(t.x, t.y, R * 1.32, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  drawLanceCharge(t);
}

/* the lock-on line and the swelling muzzle glow while a lance spins up —
   this is the whole warning the player gets, so it has to be unmissable */
function drawLanceCharge(t) {
  if (!t.chargeT || t.chargeT <= 0) return;
  const W2 = NPC_GUNS[(t.guns && t.guns[t.gi % t.guns.length]) || 'worldlance'] || NPC_GUNS.worldlance;
  const full = W2.charge || 1.5;
  const k = 1 - clamp(t.chargeT / full, 0, 1);
  const len = 5200;
  const ex = t.x + Math.cos(t.lockAng) * len, ey = t.y + Math.sin(t.lockAng) * len;
  ctx.save();
  ctx.strokeStyle = W2.col; ctx.globalAlpha = 0.25 + k * 0.5;
  ctx.lineWidth = Math.max(1, (1 + k * 4) / cam.z);
  ctx.setLineDash([26 / cam.z, 18 / cam.z]);
  ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.35 + k * 0.6;
  ctx.fillStyle = W2.col;
  const mx = t.x + Math.cos(t.lockAng) * (t.rad || 60) * 0.9;
  const my = t.y + Math.sin(t.lockAng) * (t.rad || 60) * 0.9;
  ctx.beginPath(); ctx.arc(mx, my, 10 + k * 46, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1; ctx.restore();
}
function drawMother(t, hostile) {
  const R = t.rad;
  ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.ang);
  ctx.fillStyle = 'rgba(8,18,26,.96)'; ctx.strokeStyle = t.col; ctx.lineWidth = 2.6 / cam.z;
  ctx.beginPath();
  ctx.moveTo(R, 0); ctx.lineTo(R * 0.3, R * 0.42); ctx.lineTo(-R * 0.75, R * 0.5);
  ctx.lineTo(-R, R * 0.2); ctx.lineTo(-R, -R * 0.2); ctx.lineTo(-R * 0.75, -R * 0.5);
  ctx.lineTo(R * 0.3, -R * 0.42); ctx.closePath();
  ctx.fill(); ctx.stroke();
  /* launch bays down the flank */
  ctx.fillStyle = hostile ? 'rgba(255,106,77,.8)' : 'rgba(111,216,255,.8)';
  for (let i = -2; i <= 2; i++) ctx.fillRect(-R * 0.4 + i * R * 0.22, R * 0.3, R * 0.1, R * 0.08);
  ctx.fillStyle = '#eaffff';
  ctx.beginPath(); ctx.arc(R * 0.55, 0, R * 0.09, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawTraffic(t, hostile) {
  if (tierRank(t.tier) >= 4) drawCitadel(t, hostile);
  else if (tierRank(t.tier) === 3) drawMother(t, hostile);
  else {
    drawShip(ctx, t.x, t.y, t.ang, t.col, (t.scale || 0.85) / cam.z, true, t.shape);
    /* missile racks on a seeker, an emitter ring on a nova */
    if (t.tier === 'seeker') {
      ctx.fillStyle = '#ff8a5f';
      for (let i = -1; i <= 1; i += 2)
        ctx.fillRect(t.x - 3 / cam.z + Math.cos(t.ang + Math.PI / 2) * i * 12 / cam.z,
                     t.y - 3 / cam.z + Math.sin(t.ang + Math.PI / 2) * i * 12 / cam.z, 6 / cam.z, 6 / cam.z);
    } else if (t.tier === 'nova') {
      ctx.strokeStyle = 'rgba(255,196,107,.7)'; ctx.lineWidth = 1.6 / cam.z;
      ctx.beginPath(); ctx.arc(t.x, t.y, (t.rad || 46) * 0.62, 0, TAU); ctx.stroke();
    }
  }
  const p = t.hp / t.max;
  const bw = Math.max(36, (t.rad || 36) * 1.1);
  const by = (t.rad || 30) + 16;
  if (p < 1) {
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(t.x - bw / 2 / cam.z, t.y - by / cam.z, bw / cam.z, 3 / cam.z);
    ctx.fillStyle = hostile ? '#ff6a4d' : '#4fe3d0'; ctx.fillRect(t.x - bw / 2 / cam.z, t.y - by / cam.z, bw / cam.z * p, 3 / cam.z);
  }
  ctx.fillStyle = hostile ? '#ff6a4d' : 'rgba(160,190,200,.8)';
  ctx.font = (11 / cam.z) + 'px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
  const T = VTIERS[t.tier] || VTIERS.fighter;
  ctx.fillText(t.name + ' · ' + T.n.toLowerCase() + (hostile ? ' · hostile' : ''), t.x, t.y + ((t.rad || 30) + 22) / cam.z);
  ctx.textAlign = 'left';
}

/* --- galaxy --- */
function renderGalaxy() {
  ctx.fillStyle = '#01030a'; ctx.fillRect(0, 0, W, H);
  nebula(['rgba(212,132,255,.09)', 'rgba(79,227,208,.07)']);
  stars(0.05, 'rgba(255,255,255,.55)', 1.1);
  stars(0.14, 'rgba(190,225,255,.7)', 1.6);
  stars(0.34, 'rgba(255,240,220,.7)', 2.2);

  begin();
  for (const s of nearbySystems(cam.x, cam.y, 2)) {
    if (s.blackhole) { drawBlackHole(s); continue; }
    /* a proper little star: soft glow plus a bright core, coloured by its
       actual stellar type rather than a flat dot */
    const R = Math.max(14, (s.star.r || 40) * 0.05);
    const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, R * 4);
    glow.addColorStop(0, s.star.c);
    glow.addColorStop(0.35, s.star.c);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(s.x, s.y, R * 4, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = s.star.c;
    ctx.beginPath(); ctx.arc(s.x, s.y, R, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(s.x, s.y, R * 0.35, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;

    /* trade station: a small cyan marker sitting beside the star, not on top of it */
    if (s.hasStation) {
      ctx.save(); ctx.translate(s.x + R * 2.6, s.y - R * 2.6);
      ctx.fillStyle = '#6fd8ff';
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.fillRect(Math.cos(a) * 9 - 3, Math.sin(a) * 9 - 3, 6, 6); }
      ctx.restore();
    }

    let owned = 0; for (const pl of s.planets) if (G.colonies[pl.id] || G.bases[pl.id]) owned++;
    if (owned) {
      ctx.strokeStyle = '#4fe3d0'; ctx.lineWidth = 3 / cam.z; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.arc(s.x, s.y, 124, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    const known = !!G.codex['sys:' + s.key];
    ctx.fillStyle = known ? '#cfe6ee' : '#6b8894';
    ctx.font = (15 / cam.z) + 'px "Chakra Petch", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(s.name, s.x, s.y + 64 / cam.z);
    ctx.font = (11 / cam.z) + 'px "IBM Plex Mono", monospace'; ctx.fillStyle = '#6b8894';
    ctx.fillText(s.planets.length + ' worlds · ' + s.star.n + (s.hasStation ? ' · station' : ''), s.x, s.y + 84 / cam.z);
    ctx.fillStyle = FACTIONS[s.faction].c;
    ctx.fillText(FACTIONS[s.faction].n, s.x, s.y + 100 / cam.z);
    ctx.textAlign = 'left';
  }
  if (G.waypoint) {
    ctx.strokeStyle = '#d484ff'; ctx.lineWidth = 2 / cam.z; ctx.globalAlpha = 0.5; ctx.setLineDash([16, 14]);
    ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(G.waypoint.x, G.waypoint.y); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  for (const c in G.waypoints6) {
    const w = G.waypoints6[c]; if (!w) continue;
    const col = WAYPOINT_COLORS[c];
    ctx.strokeStyle = col; ctx.lineWidth = 2 / cam.z; ctx.globalAlpha = 0.55; ctx.setLineDash([16, 14]);
    ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(w.x, w.y); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(w.x, w.y, 9 / cam.z, 0, TAU); ctx.fill();
    const dist = Math.round(Math.hypot(w.x - P.x, w.y - P.y));
    const ang = Math.atan2(w.y - P.y, w.x - P.x);
    const labelD = Math.min(dist, 60 / cam.z);
    const lx = P.x + Math.cos(ang) * labelD, ly = P.y + Math.sin(ang) * labelD;
    ctx.font = (11 / cam.z) + 'px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText(fmtN(dist) + ' u', lx, ly - 10 / cam.z);
    ctx.textAlign = 'left';
  }
  for (const t of neutrals) drawTraffic(t, false);
  for (const t of hostiles) drawTraffic(t, true);
  drawBeams(); drawBullets(); drawParts();
  drawShip(ctx, P.x, P.y, P.ang, ST().col, 1.0 / cam.z, P.thrust > 0, ST().s);
  drawFloaters();
  end();
}
function drawBullets() {
  for (const b of bullets) {
    if (b.blast) {
      ctx.fillStyle = b.c; ctx.globalAlpha = 0.5 + Math.sin(G.t * 22) * 0.35;
      ctx.beginPath(); ctx.arc(b.x, b.y, (b.sz || 5), 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = b.c; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.blast, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      continue;
    }
    /* the hull laser draws as a long, thick lance rather than a short
       streak — 20x the trail length and 2x the width of a normal shot */
    const trailMul = b.beamShot ? 0.32 : 0.016;
    ctx.strokeStyle = b.c; ctx.lineWidth = (b.sz || 3) * (b.beamShot ? 2 : 1);
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * trailMul, b.y - b.vy * trailMul); ctx.stroke();
  }
}
function drawParts() {
  for (const p of parts) {
    ctx.globalAlpha = clamp(1 - p.l / p.m, 0, 1);
    ctx.fillStyle = p.c;
    ctx.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz);
  }
  ctx.globalAlpha = 1;
}
function drawFloaters() {
  ctx.textAlign = 'center';
  for (const f of floaters) {
    ctx.globalAlpha = clamp(1 - f.t / f.m, 0, 1);
    ctx.fillStyle = f.c;
    ctx.font = '600 ' + (14 / Math.max(0.4, cam.z)) + 'px "Chakra Petch", sans-serif';
    ctx.fillText(f.s, f.x, f.y - f.t * 34);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
}

/* --- scanner --- */
function renderScanner() {
  const R = 84, cx = W - R - 44, cy = H - R - 44;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
  ctx.fillStyle = 'rgba(3,10,16,.72)'; ctx.fill();
  ctx.strokeStyle = 'rgba(79,227,208,.4)'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(79,227,208,.15)';
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.5, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
  const sweep = (G.t * 1.3) % TAU;
  ctx.globalAlpha = 0.16; ctx.fillStyle = '#4fe3d0';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, sweep - 0.5, sweep); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;

  const scale = G.mode === 'surface' ? R / 2400 : G.mode === 'system' ? R / 7500 : R / (GAL_CELL * 2.2);
  const blip = (x, y, col, size) => {
    const dx = (x - P.x) * scale, dy = (y - P.y) * scale;
    if (dx * dx + dy * dy > R * R) return;
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx + dx, cy + dy, size, 0, TAU); ctx.fill();
  };
  /* ships read as triangles: red = hostile, blue = neutral, green = ally,
     sized (roughly) to their tier */
  const triBlip = (x, y, col, size) => {
    const dx = (x - P.x) * scale, dy = (y - P.y) * scale;
    if (dx * dx + dy * dy > R * R) return;
    const px = cx + dx, py = cy + dy;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(px, py - size); ctx.lineTo(px + size * 0.87, py + size * 0.6); ctx.lineTo(px - size * 0.87, py + size * 0.6); ctx.closePath(); ctx.fill();
  };
  /* trading centres get their own cyan mark instead of a plain dot */
  const tradeBlip = (x, y, size) => {
    const dx = (x - P.x) * scale, dy = (y - P.y) * scale;
    if (dx * dx + dy * dy > R * R) return;
    const px = cx + dx, py = cy + dy;
    ctx.strokeStyle = '#00ffff'; ctx.fillStyle = 'rgba(0,255,255,.25)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; const px2 = px + Math.cos(a) * size, py2 = py + Math.sin(a) * size; i ? ctx.lineTo(px2, py2) : ctx.moveTo(px2, py2); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px - size * 0.4, py); ctx.lineTo(px + size * 0.4, py); ctx.moveTo(px, py - size * 0.4); ctx.lineTo(px, py + size * 0.4); ctx.stroke();
  };
  const ROYGBIV = CHART_ROYGBIV;
  if (G.mode === 'surface' && planet) {
    for (const c of surfAround(planet, P.x, P.y, 3)) {
      for (const d of c.deps) if (d.amt > 0) blip(d.x, d.y, MAT[d.res].c, 2.4);
      for (const n of c.nodes) if (n.amt > 0) blip(n.x, n.y, MAT[n.res].c, 1.5);
      for (const cr of c.crits) if (!cr.dead) blip(cr.x, cr.y, cr.temper === 'aggressive' || cr.temper === 'predator' ? '#ff6a4d' : '#9fe4b4', 2.6);
      if (c.struct && !c.struct.used) blip(c.struct.x, c.struct.y, '#d484ff', 3.4);
      if (c.lake) blip(c.lake.x, c.lake.y, '#6fd8ff', 4);
      if (c.settlement) {
        const hot = c.settlement.hostile || civMood(c.settlement) === 'hostile';
        blip(c.settlement.x, c.settlement.y, hot ? '#ff5f8f' : FACTIONS[c.settlement.fac].c, 5);
        for (const n of c.settlement.npcs) if (!n.dead) blip(n.x, n.y, hot ? '#ff6a4d' : '#ffe9a8', 2);
      }
      if (c.wanderer && !c.wanderer.dead) blip(c.wanderer.x, c.wanderer.y, '#ffd97a', 2.6);
    }
    for (const q of piles) blip(q.x, q.y, MAT[q.k].c, 2.2);
    for (const d of districtsOf(planet.id)) {
      const dx = (d.x - P.x) * scale, dy = (d.y - P.y) * scale;
      ctx.strokeStyle = d.stab ? 'rgba(111,216,255,.5)' : 'rgba(79,227,208,.4)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx + dx, cy + dy, Math.max(2, d.r * scale), 0, TAU); ctx.stroke();
    }
    const site = siteFor(planet.id);
    if (site) for (const bd of site.build) blip(bd.x, bd.y, '#4fe3d0', 3);
    if (G.onFoot && shipAnchor) blip(shipAnchor.x, shipAnchor.y, '#ffffff', 4);
  } else if (G.mode === 'system') {
    blip(0, 0, sys.star.c, 5);
    for (let i = 0; i < sys.planets.length; i++) {
      const pl = sys.planets[i]; const pp = planetPos(pl, G.t);
      blip(pp[0], pp[1], ROYGBIV[i % 7], clamp(pl.r / 40, 2.4, 5.5));
    }
    if (sys.hasStation) { const sp = stationPos(sys, G.t); tradeBlip(sp[0], sp[1], 4.2); }
    for (const t of neutrals) triBlip(t.x, t.y, t.ally ? '#6cff8f' : '#6fb8ff', tierRank(t.tier) >= 4 ? 6.5 : tierRank(t.tier) === 3 ? 4.8 : 3);
    for (const t of hostiles) triBlip(t.x, t.y, '#ff5f5f', tierRank(t.tier) >= 4 ? 6.5 : tierRank(t.tier) === 3 ? 4.8 : 3.2);
  } else {
    for (const s of nearbySystems(P.x, P.y, 2)) {
      if (s.blackhole) {
        /* large purple circle, drawn to scale */
        const hx = cx + (s.x - P.x) * scale, hy = cy + (s.y - P.y) * scale;
        const hr = Math.max(6, s.r * scale);
        ctx.fillStyle = 'rgba(140,60,220,.75)';
        ctx.beginPath(); ctx.arc(hx, hy, Math.max(hr, BLACKHOLE_REACH * scale), 0, TAU); ctx.fill();
        ctx.fillStyle = '#1a0a2e';
        ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.fill();
        continue;
      }
      blip(s.x, s.y, ROYGBIV[Math.abs(hash2(s.cx, s.cy, 0x2e0)) % 7], s.hasStation ? 4 : 3.4);
      if (s.hasStation) tradeBlip(s.x, s.y, 5);
    }
    if (G.waypoint) blip(G.waypoint.x, G.waypoint.y, '#d484ff', 4.2);
    for (const c in G.waypoints6) { const w = G.waypoints6[c]; if (w) blip(w.x, w.y, WAYPOINT_COLORS[c], 4.2); }
    for (const t of neutrals) triBlip(t.x, t.y, t.ally ? '#6cff8f' : '#6fb8ff', 3);
    for (const t of hostiles) triBlip(t.x, t.y, '#ff5f5f', 3.2);
  }
  ctx.restore();
  ctx.fillStyle = '#4fe3d0'; ctx.beginPath(); ctx.arc(cx, cy, 2.6, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(107,136,148,.9)'; ctx.font = '10px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
  ctx.fillText(G.mode === 'surface' ? (G.onFoot ? 'ON FOOT' : 'SURFACE') : G.mode === 'system' ? 'SYSTEM' : 'DEEP SPACE', cx, cy + R + 16);
  ctx.textAlign = 'left';
}

/* ------------------------------------------------------------
   30. HUD
------------------------------------------------------------ */
const $ = id => document.getElementById(id);
function setBar(id, v, m, txt) {
  const f = $('f-' + id); if (!f) return;
  f.style.width = clamp(v / m * 100, 0, 100) + '%';
  $('v-' + id).textContent = txt !== undefined ? txt : Math.round(v) + '/' + Math.round(m);
}
let hudAcc = 0;
function renderHUD(dt) {
  hudAcc += dt; if (hudAcc < 0.1) return; hudAcc = 0;
  const s = ST();
  $('r-credits').textContent = fmt(G.credits);
  $('r-worth').textContent = fmt(netWorth());
  $('r-rank').textContent = '#' + myRank();
  $('r-pop').textContent = fmt(empirePop());
  $('r-income').textContent = fmt(empireIncome()) + '/s';
  const hh = Math.floor(G.dayT * 24), mm = Math.floor((G.dayT * 24 % 1) * 60);
  $('r-day').textContent = G.day + ' · ' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');

  setBar('hull', G.hull, s.hull);
  setBar('shield', G.shield, s.shield);
  setBar('fuel', G.fuel, maxFuel());
  setBar('cargo', cargoUsed(), cargoCap());
  $('b-suit').classList.toggle('hidden', !G.onFoot);
  $('b-air').classList.toggle('hidden', !G.onFoot);
  if (G.onFoot) { setBar('suit', G.suit.hp, G.suit.max); setBar('air', G.suit.air, G.suit.airMax); }
  $('ship-name').textContent = G.shipNames[G.ship] || baseShip().n;
  $('ship-class').textContent = baseShip().cl;
  $('crewline').textContent = crewSummary();
  const wl = $('weapline');
  if (G.mode === 'surface' && G.onFoot) {
    wl.classList.remove('hidden');
    const gd = curGun();
    const guns = ownedGuns();
    $('weap-name').textContent = gd.n + (guns.length > 1 ? '  (' + (guns.indexOf(G.gun) + 1) + '/' + guns.length + ')' : '');
    $('weap-heat').style.width = clamp(G.gunHeat / 120 * 100, 0, 100) + '%';
  } else wl.classList.add('hidden');

  let name = '', sub = '', coord = '', wx = '';
  if (G.mode === 'surface' && planet) {
    const b = BIOMES[planet.biome];
    const shel = sheltered(P.x, P.y);
    name = planet.name;
    sub = b.n + ' · ' + (shel ? 'sheltered' : b.haz > 0.3 ? b.hazn : 'Stable') + (G.colonies[planet.id] ? ' · your colony' : G.bases[planet.id] ? ' · your base' : '');
    coord = 'SURF ' + Math.round(P.x) + ' / ' + Math.round(P.y);
    wx = (sheltered(P.x, P.y) ? 'weather held off' : (planet.weatherNow || b.wx[0])) + ' · ' + (sunAmount() > 0.5 ? 'day' : 'night');
  } else if (G.mode === 'system' && sys) {
    name = sys.name;
    sub = sys.star.n + ' · ' + FACTIONS[sys.faction].n + (sys.danger ? ' · threat ' + sys.danger : '');
    coord = 'SYS ' + sys.cx + '.' + sys.cy;
    /* how hard this spot is pulling, and how far out you have drifted */
    const gpull = gravityAt(P.x, P.y);
    const rim = rimFactor(sys, P.x, P.y);
    wx = 'pull ' + gpull.toFixed(2) + ' g · ' +
      (rim < 0.35 ? 'inner system' : rim < 0.8 ? 'mid orbits' : rim < 1.15 ? 'outer orbits' : rim < 1.8 ? 'the rim' : 'deep dark') +
      (rim > 1.1 ? ' · heavy traffic' : '');
  } else {
    name = 'Deep space'; sub = 'No stellar body in range';
    coord = 'GAL ' + Math.floor(P.x / GAL_CELL) + '.' + Math.floor(P.y / GAL_CELL);
    wx = G.waypoint ? 'Waypoint: ' + G.waypoint.name : '';
  }
  $('loc-name').textContent = name; $('loc-sub').textContent = sub;
  $('loc-coord').textContent = coord; $('loc-weather').textContent = wx;

  const tracked = trackedList();
  let oh = '';
  for (const e of tracked) {
    const q = e.q;
    const title = e.main ? q.t : q.t;
    let prog = '';
    if (e.main && q.p) { const pr = q.p(); prog = fmtN(Math.min(pr[0], pr[1])) + ' / ' + fmtN(pr[1]); }
    else if (!e.main) { const pr = questProgress(q); prog = fmtN(pr[0]) + ' / ' + fmtN(pr[1]) + ' · ' + fmt(q.pay) + ' units'; }
    oh += '<div class="objrow ' + (e.main ? 'main' : 'side') + '"><span>' + title + '</span>' +
      (prog ? '<i>' + prog + '</i>' : '') + '</div>';
  }
  $('obj-text').innerHTML = oh || 'Nothing tracked. Press Q to open the journal.';
  $('obj-prog').textContent = '';

  /* landing assist */
  const la = $('landing');
  if (G.mode === 'system' && G.nearPlanet && G.set.landingAssist && G.nearPlanet.d < G.nearPlanet.pl.r * 6) {
    const n = G.nearPlanet;
    const alt = Math.round(n.d - n.pl.r);
    const vin = -((P.vx * (n.dx / n.d)) + (P.vy * (n.dy / n.d)));
    la.classList.remove('hidden');
    $('ld-alt').textContent = alt + ' km';
    $('ld-vel').textContent = Math.round(vin) + ' m/s';
    const warn = $('ld-warn');
    if (vin < 0) { warn.textContent = 'Climbing away'; warn.className = 'safe'; }
    else if (vin < 150) { warn.textContent = 'Descent safe — fly in to land'; warn.className = 'safe'; }
    else { warn.textContent = 'TOO FAST — pull up or brace for impact'; warn.className = ''; }
  } else la.classList.add('hidden');

  /* prompts */
  let pk = 'E', pt = '', p2k = '', p2t = '';
  if (G.mode === 'surface' && G.onFoot && planet) {
    if (G.nearShip) pt = 'Board the ship';
    else if (talkTarget) pt = 'Talk to ' + talkTarget.name;
    else if (structTarget) pt = 'Investigate the ' + structTarget.t;
    else if (baseTarget) pt = 'Use the ' + (BUILDS[baseTarget.t] ? BUILDS[baseTarget.t].n.toLowerCase() : 'structure');
    else if (nodeTarget) pt = 'Hold to harvest ' + MAT[nodeTarget.res].n;
    p2k = 'Space';
    p2t = curGun().n + (critTarget ? ' — ' + critTarget.name.toLowerCase() + ' (' + critTarget.temper + ')' : '') +
      (G.gunHeat > 60 ? ' · hot' : '');
    if (waterTarget && hasTool('fish')) { p2k = 'V'; p2t = 'Cast a line'; }
  } else if (G.mode === 'surface' && planet) {
    if (!G.thrustersFixed) { pk = 'R'; pt = 'Repair launch thrusters'; }
    else pt = 'Step outside on foot';
    if (mineTarget) { p2k = 'Space'; p2t = 'Mine ' + MAT[mineTarget.res].n; }
    else if (!G.colonies[planet.id]) { p2k = 'X'; p2t = 'Claim this world for ' + fmt(claimCost()); }
  } else if (G.mode === 'system' && sys) {
    if (cityTarget) pt = 'Set down on ' + cityTarget.name;
    else if (stTarget) pt = 'Dock with ' + (sys.stName || 'the station');
    else if (hailTarget) pt = 'Hail ' + hailTarget.name;
    else if (sysTarget) pt = 'Land on ' + sysTarget.name;
  } else if (galTarget) pt = 'Enter the ' + galTarget.name + ' system';
  if (pt) { $('prompt').classList.remove('hidden'); $('prompt-key').textContent = pk; $('prompt-text').textContent = pt; }
  else $('prompt').classList.add('hidden');
  if (p2t) { $('prompt2').classList.remove('hidden'); $('prompt2-key').textContent = p2k; $('prompt2-text').textContent = p2t; }
  else $('prompt2').classList.add('hidden');

  $('hints').innerHTML = !G.set.hints ? '' : keyPanel();
}

/* ------------------------------------------------------------
   30b. CONTROL LIST
   Everything you can actually press right now, not a sample of
   it. The list changes with where you are standing.
------------------------------------------------------------ */
function keyList() {
  const L = [];
  const add = (k, t, hot) => L.push({ k: k, t: t, hot: !!hot });

  if (G.mode === 'surface' && G.onFoot) {
    add('WASD', 'Walk');
    add('Shift', 'Run');
    add('Space', 'Fire ' + curGun().n.toLowerCase(), true);
    add('R', 'Next weapon');
    const guns = ownedGuns();
    if (guns.length > 1) add('1–' + guns.length, 'Pick weapon');
    if (G.nearShip) add('E', 'Board the ship', true);
    else if (talkTarget) add('E', 'Talk to ' + talkTarget.name, true);
    else if (structTarget) add('E', 'Investigate the ' + structTarget.t, true);
    else if (baseTarget) add('E', 'Use ' + (BUILDS[baseTarget.t] ? BUILDS[baseTarget.t].n.toLowerCase() : 'structure'), true);
    else if (nodeTarget) add('E', 'Hold to harvest ' + MAT[nodeTarget.res].n, true);
    else add('E', 'Interact / harvest');
    add('F', 'Scan surroundings');
    add('V', waterTarget && hasTool('fish') ? 'Cast a line' : 'Fish (need rod + water)', !!(waterTarget && hasTool('fish')));
    add('P', 'Farmland');
    add('B', 'Construction');
    if (!G.colonies[planet.id]) add('X', 'Claim this world');
    else if (G.colonies[planet.id]) add('X', 'Already yours');
  } else if (G.mode === 'surface') {
    add('WASD', 'Fly');
    add('Shift', 'Boost');
    add('Space', mineTarget ? 'Mine ' + MAT[mineTarget.res].n : 'Mining beam', !!mineTarget);
    if (!G.thrustersFixed) add('R', 'Repair launch thrusters', true);
    add('E', 'Step outside on foot', true);
    add('L', 'Launch', !!G.thrustersFixed);
    add('F', 'Scan surroundings');
    add('B', 'Construction');
    if (!G.colonies[planet.id]) add('X', 'Claim this world');
  } else if (G.mode === 'system') {
    add('WASD', 'Fly');
    add('Shift', 'Boost');
    add('Space', 'Guns');
    if (cityTarget) add('E', 'Set down on ' + cityTarget.name, true);
    else if (stTarget) add('E', 'Dock with ' + (sys.stName || 'the station'), true);
    else if (hailTarget) add('E', 'Hail ' + hailTarget.name, true);
    else if (sysTarget) add('E', 'Land on ' + sysTarget.name, true);
    else add('E', 'Land, dock or hail');
    add('F', 'Scan contacts');
    add('L', 'Leave the system');
  } else {
    add('WASD', 'Fly');
    add('Shift', 'Pulse drive');
    add('Space', 'Guns');
    add('E', galTarget ? 'Enter the ' + galTarget.name + ' system' : 'Enter a system', !!galTarget);
    add('F', 'Long-range scan');
  }

  /* panels are always reachable */
  add('I', 'Cargo hold');
  if (G.onFoot) add('Y', 'Stats and gear', true); else add('Y', 'Stats and gear');
  add('Q', 'Journal');
  add('M', 'Star chart');
  add('K', 'Fabricator');
  add('H', 'Ship parts');
  add('U', 'Refit modules');
  add('N', 'Crew');
  add('G', 'Empire');
  add('C', 'Codex');
  if (G.docked) add('T', 'Trade terminal', true);
  add('Z', 'Hold 5s to scuttle');
  add('Esc', 'Pause');
  return L;
}
function keyPanel() {
  const L = keyList();
  let h = '<div class="keyhead">Controls</div><div class="keygrid">';
  for (const e of L) h += '<div class="keyrow' + (e.hot ? ' hot' : '') + '"><kbd>' + e.k + '</kbd><span>' + e.t + '</span></div>';
  return h + '</div>';
}


/* ------------------------------------------------------------
   31. MAIN QUESTS
   The spine of the game plus the branches that open off it.
   A quest is live when its req() is satisfied and it is not
   already in G.mainDone. Most hang off the one before, but the
   lore chains open on their own terms.
------------------------------------------------------------ */
function mdone(id) { return !!G.mainDone[id]; }
const MAIN = [
  /* --- chapter one: get off the rock --- */
  { id: 'ferrite', ch: 'Salvage', t: 'Cut 25 ferrite dust out of the wreckage',
    d: 'The hull around you is mostly ferrite and the mining beam still works. Hold Space beside a deposit.',
    p: () => [G.cargo.ferrite || 0, 25], c: () => (G.cargo.ferrite || 0) >= 25, r: 800, req: () => true },
  { id: 'tritium', ch: 'Salvage', t: 'Mine 12 tritium for the thrusters',
    d: 'Tritium burns hot enough to restart a cold engine. It reads green on the scanner.',
    p: () => [G.cargo.tritium || 0, 12], c: () => (G.cargo.tritium || 0) >= 12, r: 800, req: () => mdone('ferrite') },
  { id: 'repair', ch: 'Salvage', t: 'Repair the launch thrusters — press R',
    d: 'Twenty-five ferrite and twelve tritium, and this thing flies again.',
    c: () => G.thrustersFixed, r: 1500, req: () => mdone('tritium') },
  { id: 'outside', ch: 'Salvage', t: 'Step outside on foot — press E',
    d: 'The suit holds. Walk the ash for a while and see what the event left behind.',
    c: () => (G.stat.footTime || 0) > 4, r: 1200, req: () => mdone('repair') },
  { id: 'launch', ch: 'Salvage', t: 'Break atmosphere — press L',
    d: 'Nothing here is worth a second cycle. Go up.',
    c: () => G.mode !== 'surface', r: 1500, req: () => mdone('outside') },

  /* --- chapter two: learn the shape of the galaxy --- */
  { id: 'jump', ch: 'The Frontier', t: 'Leave the system and find another star',
    d: 'Pulse out past the last orbit and pick a light you like the look of.',
    c: () => G.stat.jumps >= 1, r: 2500, req: () => mdone('launch') },
  { id: 'survey', ch: 'The Frontier', t: 'Scan three worlds with F',
    d: 'Every first sighting pays, and the codex is the only record anybody keeps of this arm.',
    p: () => [G.stat.scans, 3], c: () => G.stat.scans >= 3, r: 4000, req: () => mdone('jump') },
  { id: 'dock', ch: 'The Frontier', t: 'Dock at a trade station',
    d: 'Stations buy anything, repair anything and gossip about everything.',
    c: () => G.stat.docked, r: 5000, req: () => mdone('survey') },
  { id: 'sell', ch: 'The Frontier', t: 'Sell 200 units of cargo',
    d: 'Hauling is the trade everyone falls back on. Learn what pays where.',
    p: () => [G.stat.sold, 200], c: () => G.stat.sold >= 200, r: 6000, req: () => mdone('dock') },

  /* --- chapter three: people --- */
  { id: 'meet', ch: 'Company', t: 'Find an inhabited world and talk to someone',
    d: 'Settlements are rare. Scan from orbit for the inhabited tag, then look for lights on the surface.',
    p: () => [G.stat.talked, 1], c: () => G.stat.talked >= 1, r: 7000, req: () => mdone('sell') },
  { id: 'craft', ch: 'Company', t: 'Build something in the fabricator',
    d: 'Ore into plate, plate into circuit, circuit into everything else.',
    p: () => [G.stat.crafted, 1], c: () => G.stat.crafted >= 1, r: 8000, req: () => mdone('meet') },
  { id: 'crew', ch: 'Company', t: 'Talk someone into joining your crew',
    d: 'Get to know them first. Whether they come is their call, not yours.',
    p: () => [G.crew.length, 1], c: () => G.crew.length >= 1, r: 30000, req: () => mdone('craft') },

  /* --- chapter four: a ship of your own --- */
  { id: 'part', ch: 'The Ship', t: 'Replace one of your four ship components',
    d: 'Hull, drive, hold, warp core. Every part you bolt on adds mass, and mass costs you speed and handling.',
    c: () => { for (const s in DEFAULT_PARTS) if (G.parts[s] !== DEFAULT_PARTS[s]) return true; return false; },
    r: 14000, req: () => mdone('sell') },
  { id: 'rebuild', ch: 'The Ship', t: 'Replace all four components',
    d: 'Nothing left of the wreck you started in. Build the ship the way you actually fly.',
    p: () => { let n = 0; for (const s in DEFAULT_PARTS) if (G.parts[s] !== DEFAULT_PARTS[s]) n++; return [n, 4]; },
    c: () => { for (const s in DEFAULT_PARTS) if (G.parts[s] === DEFAULT_PARTS[s]) return false; return true; },
    r: 90000, req: () => mdone('part') },
  { id: 'gun', ch: 'The Ship', t: 'Carry a personal weapon and use it',
    d: 'Fauna out here does not always run. Craft or buy a sidearm and keep it drawn.',
    c: () => G.gun !== 'fists' && G.stat.kills + (G.stat.groundKills || 0) >= 1, r: 9000, req: () => mdone('outside') },

  /* --- chapter five: ground of your own --- */
  { id: 'claim', ch: 'Empire', t: 'Claim your first world — land and press X',
    d: 'A claim beacon makes a planet yours on every chart that matters.',
    c: () => Object.keys(G.colonies).length >= 1, r: 20000, req: () => mdone('sell') },
  { id: 'power', ch: 'Empire', t: 'Build a habitation dome and a solar array',
    d: 'People, then power. Everything else is decoration without those two.',
    c: () => { for (const k in G.colonies) { const b = G.colonies[k].build.map(x => x.t); if (b.indexOf('habitat') >= 0 && b.indexOf('solar') >= 0) return true; } return false; },
    r: 30000, req: () => mdone('claim') },
  { id: 'district', ch: 'Empire', t: 'Draw a border ring around part of your colony',
    d: 'A claim is a line on a chart. A border ring is a line on the ground.',
    c: () => { for (const k in G.colonies) if ((G.colonies[k].districts || []).length) return true; return false; },
    r: 45000, req: () => mdone('power') },
  { id: 'stab', ch: 'Empire', t: 'Put a weather stabiliser inside a border ring',
    d: 'Hold the sky still over your own streets and the hazard stops mattering.',
    c: () => { for (const k in G.colonies) for (const d of (G.colonies[k].districts || [])) if (d.stab) return true; return false; },
    r: 120000, req: () => mdone('district') },
  { id: 'farm', ch: 'Empire', t: 'Plant and harvest your first crop',
    d: 'Plots, seed, water, wait. Food keeps a crew from walking off.',
    p: () => [G.stat.harvest, 1], c: () => G.stat.harvest >= 1, r: 25000, req: () => mdone('claim') },
  { id: 'pop', ch: 'Empire', t: 'Grow your empire to 5,000 colonists',
    p: () => [Math.floor(empirePop()), 5000], c: () => empirePop() >= 5000, r: 80000, req: () => mdone('power') },
  { id: 'three', ch: 'Empire', t: 'Hold three worlds at once',
    p: () => [Object.keys(G.colonies).length, 3], c: () => Object.keys(G.colonies).length >= 3, r: 150000, req: () => mdone('pop') },

  /* --- lore branches, opened by doing rather than being told --- */
  { id: 'mono1', ch: 'The Quiet Makers', t: 'Touch three monoliths',
    d: 'They do not weather, they do not cast a shadow, and the charts that mention them are older than the charts.',
    p: () => [G.stat.monoliths || 0, 3], c: () => (G.stat.monoliths || 0) >= 3, r: 40000,
    req: () => (G.stat.monoliths || 0) >= 1 },
  { id: 'mono2', ch: 'The Quiet Makers', t: 'Log ten ancient discoveries in the codex',
    d: 'Somebody built across this whole arm and then stopped. Nobody has found out why.',
    p: () => { let n = 0; for (const k in G.codex) if (G.codex[k].k === 'Ancient') n++; return [n, 10]; },
    c: () => { let n = 0; for (const k in G.codex) if (G.codex[k].k === 'Ancient') n++; return n >= 10; },
    r: 260000, req: () => mdone('mono1') },
  { id: 'war1', ch: 'Open War', t: 'Bring down a mothership',
    d: 'They sit out past the last orbit and launch fighters until you leave or die.',
    c: () => (G.stat.motherKills || 0) >= 1, r: 300000,
    req: () => (G.stat.kills || 0) >= 12 },
  { id: 'war2', ch: 'Open War', t: 'Bring down a floating city',
    d: 'A city that never touched a planet. There is no sane reason to attempt this.',
    c: () => (G.stat.cityKills || 0) >= 1, r: 2500000, req: () => mdone('war1') },
  { id: 'raze', ch: 'Open War', t: 'Take a settlement off the map',
    d: 'Level every structure and whatever they were keeping is yours. So is the reputation.',
    c: () => (G.stat.razed || 0) >= 1, r: 90000, req: () => (G.stat.kills || 0) >= 5 },

  /* --- endgame --- */
  { id: 'worth', ch: 'The Long Game', t: 'Reach 10 million units of net worth',
    p: () => [Math.floor(netWorth()), 1e7], c: () => netWorth() >= 1e7, r: 400000, req: () => mdone('three') },
  { id: 'rank', ch: 'The Long Game', t: 'Take first place in the wealth rankings',
    d: 'There are a few hundred names above yours. Work down the list.',
    c: () => myRank() === 1, r: 2000000, req: () => mdone('worth') }
];
const MAIN_BY_ID = {};
for (const q of MAIN) MAIN_BY_ID[q.id] = q;

function mainActive() { return MAIN.filter(q => !mdone(q.id) && q.req()); }
function mainCheck() {
  for (const q of MAIN) {
    if (mdone(q.id) || !q.req()) continue;
    if (q.c && q.c()) {
      G.mainDone[q.id] = G.day;
      if (q.r) { G.credits += q.r; AU.play('upgrade', 0.6); say('Main task done: ' + q.t + '  (+' + fmt(q.r) + ' units)', 'rare'); }
      delete G.trackMain[q.id];
      /* auto-track whatever opened up, so the box is never empty */
      const next = mainActive();
      if (next.length && !Object.keys(G.trackMain).length) G.trackMain[next[0].id] = 1;
    }
  }
}
function trackedList() {
  const out = [];
  for (const q of mainActive()) if (G.trackMain[q.id]) out.push({ main: true, q: q });
  for (const q of G.quests) if (G.trackSide[q.id]) out.push({ main: false, q: q });
  if (!out.length) { const a = mainActive(); if (a.length) out.push({ main: true, q: a[0] }); }
  return out.slice(0, 4);
}

/* legacy linear list, kept only so old saves do not break */
const OBJ = [
  { t: 'Cut 25 ferrite dust out of the wreckage', p: () => [G.cargo.ferrite || 0, 25], c: () => (G.cargo.ferrite || 0) >= 25, r: 800 },
  { t: 'Mine 12 tritium for the thrusters', p: () => [G.cargo.tritium || 0, 12], c: () => (G.cargo.tritium || 0) >= 12, r: 800 },
  { t: 'Repair the launch thrusters — press R', c: () => G.thrustersFixed, r: 1500 },
  { t: 'Step outside and look around — press E', c: () => G.stat.footTime > 4, r: 1200 },
  { t: 'Break atmosphere — press L', c: () => G.mode !== 'surface', r: 1500 },
  { t: 'Leave the system and find another star', c: () => G.stat.jumps >= 1, r: 2500 },
  { t: 'Scan three worlds with F', p: () => [G.stat.scans, 3], c: () => G.stat.scans >= 3, r: 4000 },
  { t: 'Dock at a space station', c: () => G.stat.docked, r: 5000 },
  { t: 'Sell 200 units of cargo', p: () => [G.stat.sold, 200], c: () => G.stat.sold >= 200, r: 6000 },
  { t: 'Land on an inhabited world and talk to someone', p: () => [G.stat.talked, 1], c: () => G.stat.talked >= 1, r: 7000 },
  { t: 'Craft something in the fabricator', p: () => [G.stat.crafted, 1], c: () => G.stat.crafted >= 1, r: 8000 },
  { t: 'Buy a second ship', p: () => [G.owned.length, 2], c: () => G.owned.length >= 2, r: 10000 },
  { t: 'Claim your first planet — land and press X', c: () => Object.keys(G.colonies).length >= 1, r: 20000 },
  { t: 'Build a habitation dome and a solar array', c: () => { for (const k in G.colonies) { const b = G.colonies[k].build.map(x => x.t); if (b.indexOf('habitat') >= 0 && b.indexOf('solar') >= 0) return true; } return false; }, r: 30000 },
  { t: 'Plant and harvest your first crop', p: () => [G.stat.harvest, 1], c: () => G.stat.harvest >= 1, r: 25000 },
  { t: 'Hire a crew member', p: () => [G.crew.length, 1], c: () => G.crew.length >= 1, r: 30000 },
  { t: 'Grow your empire to 5,000 colonists', p: () => [Math.floor(empirePop()), 5000], c: () => empirePop() >= 5000, r: 80000 },
  { t: 'Hold three worlds at once', p: () => [Object.keys(G.colonies).length, 3], c: () => Object.keys(G.colonies).length >= 3, r: 150000 },
  { t: 'Reach 10 million units of net worth', p: () => [Math.floor(netWorth()), 1e7], c: () => netWorth() >= 1e7, r: 400000 },
  { t: 'Take first place in the wealth rankings', c: () => myRank() === 1, r: 2000000 },
  { t: 'The galaxy is yours. Keep going.', c: () => false }
];
function objCheck() { mainCheck(); }

/* ------------------------------------------------------------
   32. PANELS
------------------------------------------------------------ */
const overlay = $('overlay');
let fromTitle = false;
let openId = null, marketTab = 'trade', craftTab = 'Components', buildTab = 'colony', codexTab = 'all', crewTab = 'roster', questTab = 'main';
function openPanel(id) {
  const all = document.querySelectorAll('.panel');
  for (let i = 0; i < all.length; i++) all[i].classList.remove('open');
  const p = $('p-' + id); if (!p) return;
  p.classList.add('open'); overlay.classList.remove('hidden'); openId = id;
  renderPanel(id);
}
function closePanel() {
  overlay.classList.add('hidden');
  overlay.style.zIndex = '';
  if (fromTitle) { fromTitle = false; $('title').classList.remove('hidden'); $('hud').classList.add('hidden'); G.started = false; }
  const all = document.querySelectorAll('.panel');
  for (let i = 0; i < all.length; i++) all[i].classList.remove('open');
  openId = null; activeShop = null;
}
overlay.addEventListener('click', e => {
  if (e.target === overlay) return closePanel();
  if (e.target.closest('[data-close]')) return closePanel();
  const a = e.target.closest('[data-act]');
  if (a) { doAction(a.dataset.act, a.dataset.k, a.dataset.n); return; }
});
/* dragging a weapon or a suit onto its slot. The panel body is rebuilt from
   a string on every refresh, so all of this is delegated from the overlay
   rather than bound to the rows themselves. */
let dragPayload = null;
overlay.addEventListener('dragstart', e => {
  const el = e.target.closest && e.target.closest('[data-drag]');
  if (!el) return;
  dragPayload = el.dataset.drag;
  el.classList.add('dragging');
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragPayload); } catch (err) {} }
});
overlay.addEventListener('dragend', e => {
  dragPayload = null;
  const all = overlay.querySelectorAll('.dragging,.over');
  for (let i = 0; i < all.length; i++) all[i].classList.remove('dragging', 'over');
});
overlay.addEventListener('dragover', e => {
  const z = e.target.closest && e.target.closest('[data-drop]');
  if (!z || !dragPayload || dragPayload.split(':')[0] !== z.dataset.drop) return;
  e.preventDefault();
  z.classList.add('over');
});
overlay.addEventListener('dragleave', e => {
  const z = e.target.closest && e.target.closest('[data-drop]');
  if (z) z.classList.remove('over');
});
overlay.addEventListener('drop', e => {
  const z = e.target.closest && e.target.closest('[data-drop]');
  const payload = dragPayload || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : '');
  if (!z || !payload) return;
  e.preventDefault();
  z.classList.remove('over');
  const bits = payload.split(':');
  if (bits[0] !== z.dataset.drop) return;
  doAction(bits[0] === 'gun' ? 'equipgun' : 'equipsuit', bits[1]);
  dragPayload = null;
  refresh();
});
overlay.addEventListener('input', e => {
  const a = e.target.closest('[data-set]');
  if (a) { G.set[a.dataset.set] = parseFloat(a.value); AU.sync(); renderPanel(openId); }
});
function renderPanel(id) {
  if (!id) return;
  const el = $('p-' + id); if (!el) return;
  const body = el.querySelector('.pbody');
  if (id === 'cargo') body.innerHTML = uiCargo();
  else if (id === 'market') body.innerHTML = uiMarket();
  else if (id === 'shop') body.innerHTML = uiShop();
  else if (id === 'hangar') body.innerHTML = uiHangar();
  else if (id === 'refit') body.innerHTML = uiRefit();
  else if (id === 'craft') body.innerHTML = uiCraft();
  else if (id === 'build') body.innerHTML = uiBuild();
  else if (id === 'farm') body.innerHTML = uiFarm();
  else if (id === 'gear') body.innerHTML = uiGear();
  else if (id === 'crew') body.innerHTML = uiCrew();
  else if (id === 'empire') body.innerHTML = uiEmpire();
  else if (id === 'codex') body.innerHTML = uiCodex();
  else if (id === 'quests') body.innerHTML = uiQuests();
  else if (id === 'settings') body.innerHTML = uiSettings();
  else if (id === 'pause') body.innerHTML = uiPause();
  else if (id === 'chart') drawChart();
}
function refresh() { if (openId) renderPanel(openId); }
function matRow(k, qty, price, acts) {
  const m = MAT[k];
  return '<div class="row"><span class="dot" style="background:' + m.c + '"></span>' +
    '<span class="nm">' + m.n + '<small>' + cap1(m.cat) + ' · tier ' + m.t + (m.food ? ' · food' : '') + '</small></span>' +
    (qty !== null ? '<span class="qty">' + qty + '</span>' : '') +
    (price !== null ? '<span class="pr">' + price + '</span>' : '') +
    (acts ? '<span class="acts">' + acts + '</span>' : '') + '</div>';
}
function costText(costs) {
  const bits = [];
  for (const k in costs) {
    const ok = (G.cargo[k] || 0) >= costs[k];
    bits.push('<span class="' + (ok ? '' : 'no') + '">' + costs[k] + ' ' + MAT[k].n + '</span>');
  }
  return bits.join(' · ');
}

function uiCargo() {
  const keys = Object.keys(G.cargo).filter(k => G.cargo[k] > 0 && MAT[k]);
  let h = '<div class="stats">' +
    '<div class="stat"><i>Hold</i><b>' + Math.floor(cargoUsed()) + ' / ' + cargoCap() + '</b></div>' +
    '<div class="stat"><i>Cargo value</i><b>' + fmt(keys.reduce((s, k) => s + G.cargo[k] * priceOf(k, sys), 0)) + '</b></div>' +
    '<div class="stat"><i>Warp cells</i><b>' + Math.floor(G.fuel) + ' / ' + maxFuel() + '</b></div>' +
    '<div class="stat"><i>Distinct items</i><b>' + keys.length + '</b></div></div>';
  h += '<p class="note">Anything with a fuel rating refines into warp cells. Tools are used automatically once you hold one. ' +
    (G.mode === 'surface' ? 'Dropped cargo lands in a pile beside you and can be picked back up.' : 'Dropped cargo is vented and gone.') + '</p>';
  const fuelKeys = keys.filter(k => MAT[k].fuel);
  for (const k of fuelKeys)
    h += '<div class="row"><span class="dot" style="background:' + MAT[k].c + '"></span>' +
      '<span class="nm">Refine ' + MAT[k].n + ' into warp cells<small>10 units becomes ' + (MAT[k].fuel * 10) + ' cells</small></span>' +
      '<span class="acts"><button class="btn sm ghost" data-act="refuel" data-k="' + k + '"' + (G.cargo[k] < 10 || G.fuel >= maxFuel() ? ' disabled' : '') + '>Refine</button></span></div>';
  const site = G.mode === 'surface' && planet ? siteFor(planet.id) : null;
  const hasVault = site && colStats(site).store > 0;
  if (hasVault) {
    const stashN = Object.keys(G.stash).reduce((s, k) => s + G.stash[k], 0);
    h += '<h4 class="sec">Storage vault · ' + Math.floor(stashN) + ' / ' + colStats(site).store + '</h4>' +
      '<div class="row"><span class="dot" style="background:#ffc46b"></span><span class="nm">Move cargo in and out<small>off-ship storage on ' + planet.name + '</small></span>' +
      '<span class="acts"><button class="btn sm ghost" data-act="stashall">Store all</button><button class="btn sm ghost" data-act="unstashall">Take all</button></span></div>';
    for (const k in G.stash) if (G.stash[k] > 0) h += matRow(k, Math.floor(G.stash[k]) + ' stored', null, '<button class="btn xs ghost" data-act="unstash" data-k="' + k + '">Take</button>');
  }
  if (!keys.length) return h + '<p class="empty">The hold is empty. Land on a world and hold Space near a deposit.</p>';
  h += '<h4 class="sec">Contents</h4>';
  const sorted = keys.sort((a, b) => MAT[b].v * G.cargo[b] - MAT[a].v * G.cargo[a]);
  for (const k of sorted) {
    const m = MAT[k];
    const acts = (m.consumable || m.heal || m.air || m.food) && !MAT[k].tool ?
      '<button class="btn xs ghost" data-act="use" data-k="' + k + '">Use</button>' : '';
    h += '<div class="row"><span class="dot" style="background:' + m.c + '"></span>' +
      '<span class="nm">' + m.n + (m.cat === 'alloy' ? '<span class="pill b">alloy</span>' : '') +
      '<small>' + cap1(m.cat) + ' · tier ' + m.t + ' · ' + priceOf(k, sys) + ' units each here</small></span>' +
      '<span class="qty">' + Math.floor(G.cargo[k]) + '</span>' +
      '<span class="pr">' + fmt(G.cargo[k] * priceOf(k, sys)) + '</span>' +
      '<span class="acts">' + acts +
      '<button class="btn xs ghost" data-act="dump" data-k="' + k + '" data-n="10">Drop 10</button>' +
      '<button class="btn xs warn" data-act="dump" data-k="' + k + '" data-n="99999">Drop all</button>' +
      '</span></div>';
  }
  return h;
}

function uiMarket() {
  if (!G.docked) return '<p class="empty">Not docked. Find a trade station in a system and press E alongside it.</p>';
  let h = '<div class="tabs">' + ['trade','ships','refit','services'].map(t =>
    '<button class="tab ' + (marketTab === t ? 'on' : '') + '" data-act="mtab" data-k="' + t + '">' +
    (t === 'trade' ? 'Goods' : t === 'ships' ? 'Ship parts' : t === 'refit' ? 'Modules' : 'Services') + '</button>').join('') + '</div>';
  if (marketTab === 'ships') return h + uiHangar(true);
  if (marketTab === 'refit') return h + uiRefit(true);
  if (marketTab === 'services') {
    const s = ST();
    const rep = Math.round((s.hull - G.hull) * 90), fu = Math.round((maxFuel() - G.fuel) * 120);
    h += '<p class="note">Station services at ' + (sys.stName || sys.name) + '. Prices scale with how much you need.</p>';
    h += '<div class="row"><span class="dot" style="background:#4fe3d0"></span><span class="nm">Repair hull<small>' + Math.round(G.hull) + ' / ' + s.hull + '</small></span>' +
      '<span class="pr">' + fmt(rep) + '</span><span class="acts"><button class="btn sm ghost" data-act="repair"' + (rep <= 0 || G.credits < rep ? ' disabled' : '') + '>Repair</button></span></div>';
    h += '<div class="row"><span class="dot" style="background:#d484ff"></span><span class="nm">Fill warp cells<small>' + Math.floor(G.fuel) + ' / ' + maxFuel() + '</small></span>' +
      '<span class="pr">' + fmt(fu) + '</span><span class="acts"><button class="btn sm ghost" data-act="buyfuel"' + (fu <= 0 || G.credits < fu ? ' disabled' : '') + '>Buy</button></span></div>';
    h += '<div class="row"><span class="dot" style="background:#ffc46b"></span><span class="nm">Sell the whole hold<small>every item at local rates</small></span>' +
      '<span class="pr">' + fmt(Object.keys(G.cargo).reduce((s2, k) => s2 + G.cargo[k] * priceOf(k, sys), 0)) + '</span>' +
      '<span class="acts"><button class="btn sm" data-act="sellall"' + (!cargoUsed() ? ' disabled' : '') + '>Sell all</button></span></div>';
    h += '<div class="row"><span class="dot" style="background:#ff9fb4"></span><span class="nm">Treat the crew<small>full health and a morale lift for everyone aboard</small></span>' +
      '<span class="pr">' + fmt(G.crew.length * 4000) + '</span>' +
      '<span class="acts"><button class="btn sm ghost" data-act="shoreleave"' + (!G.crew.length || G.credits < G.crew.length * 4000 ? ' disabled' : '') + '>Shore leave</button></span></div>';
    return h;
  }
  const stock = stationStock(sys);
  h += '<p class="note">' + (sys.stName || sys.name) + ' has ' + stock.length + ' lines on the racks this cycle, and they change. ' +
    'No station carries everything — if you want options, go somewhere else and look. ' +
    'Green means this one pays above the galactic average for what you are selling.</p>';
  h += '<h4 class="sec">On the racks</h4>';
  for (const k of stock) {
    const p = priceOf(k, sys), have = Math.floor(G.cargo[k] || 0);
    const rate = p / MAT[k].v;
    const tag = rate > 1.25 ? '<span class="pill">pays well</span>' : rate < 0.8 ? '<span class="pill c">cheap here</span>' : '';
    h += '<div class="row"><span class="dot" style="background:' + MAT[k].c + '"></span>' +
      '<span class="nm">' + MAT[k].n + tag + '<small>' + cap1(MAT[k].cat) + ' · tier ' + MAT[k].t + '</small></span>' +
      '<span class="qty">' + have + '</span><span class="pr">' + fmtN(p) + '</span>' +
      '<span class="acts">' +
      '<button class="btn xs ghost" data-act="buy" data-k="' + k + '" data-n="1"' + (G.credits < p ? ' disabled' : '') + '>Buy 1</button>' +
      '<button class="btn xs" data-act="buy" data-k="' + k + '" data-n="10"' + (G.credits < p * 10 ? ' disabled' : '') + '>Buy 10</button>' +
      '</span></div>';
  }
  h += '<h4 class="sec">They will take anything you are carrying</h4>';
  const mine = Object.keys(G.cargo).filter(k => G.cargo[k] >= 1 && MAT[k]);
  if (!mine.length) h += '<p class="empty">Your hold is empty.</p>';
  for (const k of mine.sort((a, b) => MAT[b].v * G.cargo[b] - MAT[a].v * G.cargo[a])) {
    if (MAT[k].cat === 'alloy') continue;
    const p = priceOf(k, sys), have = Math.floor(G.cargo[k]);
    h += '<div class="row"><span class="dot" style="background:' + MAT[k].c + '"></span>' +
      '<span class="nm">' + MAT[k].n + '<small>' + have + ' in the hold</small></span>' +
      '<span class="pr">' + fmtN(p) + '</span>' +
      '<span class="acts">' +
      '<button class="btn xs ghost" data-act="sell" data-k="' + k + '" data-n="10">Sell 10</button>' +
      '<button class="btn xs" data-act="sell" data-k="' + k + '" data-n="99999">All</button>' +
      '</span></div>';
  }
  const alloys = Object.keys(G.cargo).filter(k => MAT[k] && MAT[k].cat === 'alloy' && G.cargo[k] > 0);
  if (alloys.length) {
    h += '<h4 class="sec">Alloys in your hold</h4>';
    for (const k of alloys) h += matRow(k, Math.floor(G.cargo[k]), fmtN(priceOf(k, sys)),
      '<button class="btn xs" data-act="sell" data-k="' + k + '" data-n="99999">Sell all</button>');
  }
  return h;
}

/* Every station picks its own handful of lines, reshuffled each cycle.
   Wealthier stations carry more, but nowhere carries the whole catalogue. */
function stationStock(s) {
  if (!s) return [];
  const key = s.key + ':' + G.day;
  if (stockCache.k === key) return stockCache.v;
  const r = rng(hash2(s.cx * 7919 + G.day, s.cy * 104729 + G.day * 31, 0x5704));
  const pool = MAT_KEYS.filter(k => MAT[k].cat !== 'alloy' && MAT[k].cat !== 'artifact');
  const n = ri(r, 9, 12) + (s.wealth || 1) * 3;
  const picked = shuffle(r, pool).slice(0, n);
  /* a station always keeps the basics in, or you could strand yourself */
  for (const must of ['tritium', 'oxygen', 'ferrite']) if (picked.indexOf(must) < 0) picked.push(must);
  stockCache = { k: key, v: picked };
  return picked;
}
let stockCache = { k: null, v: [] };

function openShop(npc) {
  activeShop = npc;
  $('shop-title').textContent = SHOP_TYPES[npc.shop].n + ' · ' + npc.name;
  openPanel('shop');
}
function uiShop() {
  if (!activeShop) return '<p class="empty">No trader in front of you.</p>';
  const def = SHOP_TYPES[activeShop.shop] || SHOP_TYPES.general;
  const rel = relOf(activeShop.id);
  const disc = clamp(1 - rel / 400, 0.75, 1.1) * (def.markup || 1);
  let h = '<p class="note">' + activeShop.name + ' deals in ' + def.n.toLowerCase() + ', and only carries what they happen to have. ' +
    'Everyone stocks something different, so the way to find a particular thing is to keep travelling and keep asking. ' +
    (rel > 20 ? 'They like you — prices are down ' + Math.round((1 - disc) * 100) + '%.' : 'Build the relationship and the prices come down.') + '</p>';
  const r = rng((activeShop.seed + G.day * 13) >>> 0);
  /* a person is not a warehouse. Two to four lines, mostly their trade,
     occasionally something odd they picked up. Ships carry their own hold. */
  const wide = MAT_KEYS.filter(k => MAT[k].cat !== 'alloy' && MAT[k].cat !== 'artifact');
  let stock;
  if (activeShop.mobile) stock = activeShop.mobile;
  else {
    stock = shuffle(r, def.pool).slice(0, ri(r, 2, 4));
    if (r() < 0.45) { const odd = pick(r, wide); if (stock.indexOf(odd) < 0) stock.push(odd); }
  }
  h += '<h4 class="sec">For sale · ' + stock.length + ' line' + (stock.length > 1 ? 's' : '') + '</h4>';
  for (const k of stock) {
    const p = Math.round(priceOf(k, sys) * disc * 1.15);
    h += '<div class="row"><span class="dot" style="background:' + MAT[k].c + '"></span>' +
      '<span class="nm">' + MAT[k].n + '<small>' + cap1(MAT[k].cat) + ' · tier ' + MAT[k].t + '</small></span>' +
      '<span class="pr">' + fmtN(p) + '</span><span class="acts">' +
      '<button class="btn xs ghost" data-act="shopbuy" data-k="' + k + '" data-n="1"' + (G.credits < p ? ' disabled' : '') + '>Buy 1</button>' +
      '<button class="btn xs" data-act="shopbuy" data-k="' + k + '" data-n="10"' + (G.credits < p * 10 ? ' disabled' : '') + '>Buy 10</button></span></div>';
  }
  h += '<h4 class="sec">They will buy from you</h4>';
  const sellable = Object.keys(G.cargo).filter(k => G.cargo[k] >= 1 && MAT[k]);
  if (!sellable.length) h += '<p class="empty">Nothing in your hold.</p>';
  for (const k of sellable.slice(0, 14)) {
    const p = Math.round(priceOf(k, sys) * (rel > 20 ? 1.1 : 0.92));
    h += '<div class="row"><span class="dot" style="background:' + MAT[k].c + '"></span>' +
      '<span class="nm">' + MAT[k].n + '<small>' + Math.floor(G.cargo[k]) + ' in the hold</small></span>' +
      '<span class="pr">' + fmtN(p) + '</span><span class="acts">' +
      '<button class="btn xs ghost" data-act="shopsell" data-k="' + k + '" data-n="1">Sell 1</button>' +
      '<button class="btn xs" data-act="shopsell" data-k="' + k + '" data-n="99999">All</button></span></div>';
  }
  return h;
}

/* what a part does, in words, including what it costs you */
function partBits(pt) {
  const b = [];
  if (pt.hull) b.push('hull ' + pt.hull);
  if (pt.impact) b.push('crash armour ' + Math.round(pt.impact * 100) + '%');
  if (pt.regen) b.push('self-repair ' + pt.regen + '/s');
  if (pt.thrust) b.push('thrust ' + pt.thrust);
  if (pt.max) b.push('top speed ' + pt.max);
  if (pt.turn) b.push('turn ' + pt.turn.toFixed(1));
  if (pt.cargo) b.push('hold ' + pt.cargo);
  if (pt.fuel) b.push('cells ' + pt.fuel);
  if (pt.warp) b.push('warp ×' + pt.warp.toFixed(1));
  if (pt.mine) b.push('mining ×' + pt.mine.toFixed(1));
  if (pt.slots) b.push('+' + pt.slots + ' module slot' + (pt.slots > 1 ? 's' : ''));
  b.push('mass ' + pt.mass.toFixed(1));
  return b.join(' · ');
}
/* the ship as it would be with one part swapped, so you can see the cost */
function previewWith(slot, key) {
  const old = G.parts[slot];
  G.parts[slot] = key;
  const s = ST();
  G.parts[slot] = old;
  return s;
}
function delta(a, b, digits, lowerIsBetter) {
  const d = b - a;
  if (Math.abs(d) < (digits ? 0.05 : 0.5)) return '';
  const txt = (d > 0 ? '+' : '') + (digits ? d.toFixed(1) : Math.round(d));
  const good = lowerIsBetter ? d < 0 : d > 0;
  return '<em class="' + (good ? 'up' : 'dn') + '">' + txt + '</em>';
}

function uiHangar(inline) {
  const s = ST();
  let h = '<div class="stats">' +
    '<div class="stat"><i>Hull</i><b>' + s.hull + '</b></div>' +
    '<div class="stat"><i>Top speed</i><b>' + Math.round(s.max) + '</b></div>' +
    '<div class="stat"><i>Thrust</i><b>' + Math.round(s.thrust) + '</b></div>' +
    '<div class="stat"><i>Turn</i><b>' + s.turn.toFixed(1) + '</b></div>' +
    '<div class="stat"><i>Hold</i><b>' + s.cargo + '</b></div>' +
    '<div class="stat"><i>Warp cells</i><b>' + maxFuel() + '</b></div>' +
    '<div class="stat"><i>Mass</i><b>' + s.mass.toFixed(1) + '</b></div>' +
    '<div class="stat"><i>Handling</i><b>' + Math.round(s.agility * 100) + '%</b></div></div>';
  h += '<p class="note">Your ship is four parts bolted to a frame. Every part carries mass, and mass is the ' +
    'price of everything good — a freight hold and heavy plating will both cost you thrust and turning rate. ' +
    'Shields are not a part; they come from the shield module in refit. Buy a part outright or build it from your hold.</p>';

  h += '<h4 class="sec">Ship types</h4>';
  h += '<p class="note">Purely cosmetic — a hull, a silhouette, a colour. Every stat you fly with comes from the parts fitted below and the modules in refit, not from which frame they are bolted to.</p>';
  for (const k of SHIP_KEYS) {
    const sd = SHIPS[k];
    const owned = G.owned.indexOf(k) >= 0;
    const active = k === G.ship;
    const price = Math.round(sd.price * (G.docked ? 1 : 1.2));
    const bits3 = [sd.cl, 'cosmetic hull only'];
    h += '<div class="row ' + (active ? 'sel' : owned ? '' : 'locked') + '"><span class="dot" style="background:' + sd.col + '"></span>' +
      '<span class="nm">' + sd.n + (active ? '<span class="pill e">flying</span>' : owned ? '<span class="pill e">owned</span>' : '<span class="pill c">' + sd.cl + '</span>') +
      '<small>' + sd.cl + ' · ' + sd.d + '</small><small class="cost">' + bits3.join(' · ') + '</small></span>' +
      '<span class="pr">' + (owned ? '—' : fmt(price)) + '</span><span class="acts">' +
      (active ? '' : owned ? '<button class="btn xs" data-act="swap" data-k="' + k + '">Fly</button>' :
        '<button class="btn xs" data-act="buyship" data-k="' + k + '" data-n="' + price + '"' + (G.credits < price ? ' disabled' : '') + '>Buy</button>') +
      '</span></div>';
  }

  h += '<h4 class="sec">Fitted</h4>';
  for (const slot in PART_SLOTS) {
    const pt = partOf(slot);
    h += '<div class="row sel"><span class="dot" style="background:#4fe3d0"></span>' +
      '<span class="nm">' + pt.n + '<small>' + PART_SLOTS[slot].n + ' · ' + PART_SLOTS[slot].d + '</small>' +
      '<small class="cost">' + partBits(pt) + '</small></span></div>';
  }
  h += '<div class="row"><span class="nm">' + (G.shipNames[G.ship] || baseShip().n) +
    '<small>Name and hull colour are yours to set</small></span><span class="acts">' +
    '<button class="btn xs ghost" data-act="rename" data-k="' + G.ship + '">Rename</button></span></div>';

  for (const slot in PART_SLOTS) {
    const cur = G.parts[slot];
    const curTier = PARTS[cur] ? PARTS[cur].tier : 0;
    h += '<h4 class="sec">' + PART_SLOTS[slot].n + '</h4>';
    /* only the immediate next tier is shown — buy or build it, and the tier
       after that unlocks in its place. Anything further out stays hidden. */
    let higher = PART_KEYS.filter(k => PARTS[k].slot === slot && PARTS[k].tier > curTier);
    if (!higher.length) { extraPartTier(slot, curTier + 1); higher = PART_KEYS.filter(k => PARTS[k].slot === slot && PARTS[k].tier > curTier); }
    const nextTier = Math.min.apply(null, higher.map(k => PARTS[k].tier));
    const nextKeys = higher.filter(k => PARTS[k].tier === nextTier);
    for (const k of nextKeys) {
      const pt = PARTS[k];
      const owned = !!G.ownedParts[k];
      const price = Math.round(pt.cr * (G.docked ? (1.05 - (sys.wealth || 2) * 0.03) : 1.25));
      const canMake = hasAll(pt.in) && Object.keys(pt.in).length > 0;
      const canBuy = G.credits >= price && hasAll(pt.in);
      const pv = previewWith(slot, k);
      const newFuel = slot === 'warp' ? pt.fuel + modSum('fuel') : maxFuel();
      const bits2 = [];
      const push2 = (lbl, d) => { if (d) bits2.push(lbl + ' ' + d); };
      push2('speed', delta(s.max, pv.max));
      push2('thrust', delta(s.thrust, pv.thrust));
      push2('turn', delta(s.turn, pv.turn, 1));
      push2('hold', delta(s.cargo, pv.cargo));
      push2('hull', delta(s.hull, pv.hull));
      push2('cells', delta(maxFuel(), newFuel));
      push2('mass', delta(s.mass, pv.mass, 1, true));
      const cmp = bits2.length ? '<small class="cost">' + bits2.join(' · ') + '</small>'
        : '<small class="cost">no change to how she flies</small>';
      h += '<div class="row ' + (owned ? '' : 'locked') + '">' +
        '<span class="dot" style="background:#6fd8ff"></span>' +
        '<span class="nm">' + pt.n + (owned ? '<span class="pill e">owned</span>' : '<span class="pill c">tier ' + pt.tier + '</span>') +
        '<small>' + pt.d + '</small><small class="cost">' + partBits(pt) + '</small>' + cmp +
        (Object.keys(pt.in).length ? '<small class="cost">' + costText(pt.in) + '</small>' : '') +
        (G.docked ? '<small class="cost good">Docked · station prices</small>' : '<small class="cost">Cheaper docked at a trade station</small>') + '</span>' +
        '<span class="pr">' + (owned ? '—' : fmt(price)) + '</span><span class="acts">' +
        (owned ? '<button class="btn xs" data-act="partfit" data-k="' + k + '">Fit</button>' :
          '<button class="btn xs ghost" data-act="partmake" data-k="' + k + '"' + (canMake ? '' : ' disabled') + '>Build</button>' +
          '<button class="btn xs" data-act="partbuy" data-k="' + k + '" data-n="' + price + '"' + (canBuy ? '' : ' disabled') + '>Buy</button>') +
        '</span></div>';
    }
  }
  return h;
}

function uiRefit(inline) {
  const s = ST(), b = baseShip(), f = fitOf();
  let h = '<div class="stats">' +
    '<div class="stat"><i>Thrust</i><b>' + Math.round(s.thrust) + '</b></div>' +
    '<div class="stat"><i>Top speed</i><b>' + Math.round(s.max) + '</b></div>' +
    '<div class="stat"><i>Hull</i><b>' + s.hull + '</b></div>' +
    '<div class="stat"><i>Shield</i><b>' + s.shield + '</b></div>' +
    '<div class="stat"><i>Hold</i><b>' + s.cargo + '</b></div>' +
    '<div class="stat"><i>Guns</i><b>' + Math.round(s.gun) + '</b></div>' +
    '<div class="stat"><i>Weapon</i><b>' + SHIP_WEAPONS[s.gunType].short + '</b></div>' +
    '<div class="stat"><i>Mining</i><b>×' + s.mine.toFixed(2) + '</b></div>' +
    '<div class="stat"><i>Crash armour</i><b>' + Math.round(s.impact * 100) + '%</b></div></div>';
  h += '<p class="note">' + Object.keys(f).length + ' of ' + s.slots + ' slots filled on the ' + (G.shipNames[G.ship] || b.n) +
    '. Modules can be bought outright or built from parts in the fabricator.</p>';

  h += '<h4 class="sec">Weapon type</h4>';
  h += '<p class="note">Pick a gun family for the hull cannon — bullet, twin bullet, missile or laser — then upgrade it through its own tiers. ' +
    'Switching family keeps whatever tiers you already own in each; only one family is mounted at a time.</p>';
  for (const fk of SHIP_WEAPON_KEYS) {
    const fam = SHIP_WEAPONS[fk];
    const ownedTier = gunTierOwned(fk);
    const active = G.shipGun === fk;
    const bitsW = (td) => {
      const arr = ['damage ×' + td.gun.toFixed(2), 'rate ×' + td.rate.toFixed(2)];
      if (td.pierce) arr.push('pierces targets');
      if (td.blast) arr.push('blast ' + td.blast);
      return arr.join(' · ');
    };
    if (ownedTier >= 0) {
      const td = fam.tiers[ownedTier];
      h += '<div class="row ' + (active ? 'sel' : '') + '"><span class="dot" style="background:#ff6a4d"></span>' +
        '<span class="nm">' + fam.n + (active ? '<span class="pill e">mounted</span>' : '<span class="pill e">owned</span>') +
        '<small>' + fam.short + ' · ' + td.n + '</small><small class="cost">' + bitsW(td) + '</small></span>' +
        '<span class="acts">' + (active ? '' : '<button class="btn xs" data-act="gunselect" data-k="' + fk + '">Mount</button>') + '</span></div>';
      const nextTier = fam.tiers[ownedTier + 1];
      if (nextTier) {
        const price = Math.round(nextTier.cr * (G.docked ? 1 : 1.2));
        const canBuy = G.credits >= price && hasAll(nextTier.in), canMake = hasAll(nextTier.in);
        h += '<div class="row locked"><span class="dot" style="background:#6fd8ff"></span>' +
          '<span class="nm">' + nextTier.n + '<span class="pill c">upgrade</span><small>' + bitsW(nextTier) + '</small>' +
          (Object.keys(nextTier.in).length ? '<small class="cost">' + costText(nextTier.in) + '</small>' : '') + '</span>' +
          '<span class="pr">' + fmt(price) + '</span><span class="acts">' +
          '<button class="btn xs ghost" data-act="gunmake" data-k="' + fk + '"' + (canMake ? '' : ' disabled') + '>Build</button>' +
          '<button class="btn xs" data-act="gunbuy" data-k="' + fk + '" data-n="' + price + '"' + (canBuy ? '' : ' disabled') + '>Buy</button>' +
          '</span></div>';
      }
    } else {
      const td = fam.tiers[0];
      const price = Math.round(td.cr * (G.docked ? 1 : 1.2));
      const canBuy = G.credits >= price && hasAll(td.in), canMake = hasAll(td.in) && Object.keys(td.in).length > 0;
      h += '<div class="row locked"><span class="dot" style="background:#6fd8ff"></span>' +
        '<span class="nm">' + fam.n + '<span class="pill c">unlock</span><small>' + fam.d + '</small><small class="cost">' + bitsW(td) + '</small>' +
        (Object.keys(td.in).length ? '<small class="cost">' + costText(td.in) + '</small>' : '') + '</span>' +
        '<span class="pr">' + fmt(price) + '</span><span class="acts">' +
        '<button class="btn xs ghost" data-act="gunmake" data-k="' + fk + '"' + (canMake ? '' : ' disabled') + '>Build</button>' +
        '<button class="btn xs" data-act="gunbuy" data-k="' + fk + '" data-n="' + price + '"' + (canBuy ? '' : ' disabled') + '>Buy</button>' +
        '</span></div>';
    }
  }

  h += '<h4 class="sec">Fitted</h4>';
  const fitKeys = Object.keys(f);
  if (!fitKeys.length) h += '<p class="empty">Nothing fitted yet.</p>';
  for (const slot of fitKeys) {
    const m = MODULES[f[slot]];
    h += '<div class="row sel"><span class="dot" style="background:#4fe3d0"></span>' +
      '<span class="nm">' + m.n + '<small>' + SLOT_NAMES[slot] + ' slot</small></span>' +
      '<span class="acts"><button class="btn xs ghost" data-act="unfit" data-k="' + slot + '">Remove</button></span></div>';
  }
  h += '<h4 class="sec">Available modules</h4>';
  for (const k of MODULE_KEYS) {
    const m = MODULES[k];
    const inUse = f[m.slot] === k;
    if (inUse) continue;
    const full = Object.keys(f).length >= s.slots && !f[m.slot];
    const canBuy = G.credits >= m.cr;
    const canMake = hasAll(m.in);
    const bits = [];
    if (m.thrust) bits.push('thrust +' + Math.round(m.thrust * 100) + '%');
    if (m.max) bits.push('speed +' + Math.round(m.max * 100) + '%');
    if (m.turn) bits.push('handling +' + Math.round(m.turn * 100) + '%');
    if (m.shield) bits.push('shield +' + Math.round(m.shield * 100) + '%');
    if (m.regen) bits.push('regen +' + m.regen);
    if (m.gun) bits.push('damage +' + Math.round(m.gun * 100) + '%');
    if (m.rate) bits.push('fire rate +' + Math.round(m.rate * 100) + '%');
    if (m.cargo) bits.push('hold +' + Math.round(m.cargo * 100) + '%');
    if (m.mine) bits.push('mining +' + Math.round(m.mine * 100) + '%');
    if (m.warp) bits.push('warp +' + Math.round(m.warp * 100) + '%');
    if (m.fuel) bits.push('cells +' + m.fuel);
    if (m.hull) bits.push('hull +' + Math.round(m.hull * 100) + '%');
    if (m.impact) bits.push('crash armour +' + Math.round(m.impact * 100) + '%');
    if (m.scan) bits.push('scan payout +' + Math.round(m.scan * 100) + '%');
    h += '<div class="row ' + (full ? 'locked' : '') + '"><span class="dot" style="background:#6fd8ff"></span>' +
      '<span class="nm">' + m.n + '<small>' + SLOT_NAMES[m.slot] + ' · ' + bits.join(' · ') + '</small>' +
      '<small class="cost">' + costText(m.in) + ' · ' + fmt(m.cr) + ' units</small></span>' +
      '<span class="acts">' +
      '<button class="btn xs" data-act="fitmake" data-k="' + k + '"' + (!canMake || !canBuy || full ? ' disabled' : '') + '>Build</button>' +
      '</span></div>';
  }
  h += '<h4 class="sec">Paint</h4><div class="row"><span class="nm">Hull colour<small>cosmetic only, and worth it</small></span><span class="acts">' +
    PAINTS.map(c => '<button class="btn xs" style="background:' + c + '" data-act="paint" data-k="' + encodeURIComponent(c) + '">&nbsp;</button>').join('') + '</span></div>';
  return h;
}

function uiCraft() {
  const cats = ['Components','Tools','Consumables','Seeds','Fuel','Refined','Alloy forge'];
  let h = '<div class="tabs">' + cats.map(c =>
    '<button class="tab ' + (craftTab === c ? 'on' : '') + '" data-act="ctab" data-k="' + encodeURIComponent(c) + '">' + c + '</button>').join('') + '</div>';

  if (craftTab === 'Alloy forge') {
    const have = Object.keys(G.cargo).filter(k => G.cargo[k] >= 5 && MAT[k] && MAT[k].cat !== 'alloy');
    h += '<p class="note">Feed the forge five units each of any two materials and it fuses them into a named alloy. ' +
      'Every pair gives a different result, so there are thousands of them — most are junk, some are worth more than the parts. ' +
      'You have forged <b>' + G.alloysMade + '</b> so far.</p>';
    if (have.length < 2) return h + '<p class="empty">You need at least five units each of two different materials.</p>';
    const a = G.forgeA && have.indexOf(G.forgeA) >= 0 ? G.forgeA : have[0];
    const b = G.forgeB && have.indexOf(G.forgeB) >= 0 && G.forgeB !== a ? G.forgeB : (have.find(x => x !== a) || have[0]);
    G.forgeA = a; G.forgeB = b;
    const preview = MAT[alloyKey(a, b)];
    h += '<div class="grid2">';
    h += '<div><h4 class="sec">First input</h4>' + have.map(k =>
      '<div class="row ' + (k === a ? 'sel' : '') + '" data-act="forgeA" data-k="' + k + '"><span class="dot" style="background:' + MAT[k].c + '"></span>' +
      '<span class="nm">' + MAT[k].n + '<small>' + Math.floor(G.cargo[k]) + ' held</small></span></div>').join('') + '</div>';
    h += '<div><h4 class="sec">Second input</h4>' + have.map(k =>
      '<div class="row ' + (k === b ? 'sel' : '') + '" data-act="forgeB" data-k="' + k + '"><span class="dot" style="background:' + MAT[k].c + '"></span>' +
      '<span class="nm">' + MAT[k].n + '<small>' + Math.floor(G.cargo[k]) + ' held</small></span></div>').join('') + '</div>';
    h += '</div>';
    h += '<h4 class="sec">Result</h4><div class="row"><span class="dot" style="background:' + (preview ? preview.c : '#4fe3d0') + '"></span>' +
      '<span class="nm">' + (preview ? preview.n + ' <span class="pill b">known</span>' : 'Unknown alloy') +
      '<small>' + MAT[a].n + ' + ' + MAT[b].n + (preview ? ' · worth ' + fmtN(preview.v) + ' each · grade ' + preview.grade : ' · never forged before') + '</small></span>' +
      '<span class="acts"><button class="btn sm" data-act="forge"' + (a === b ? ' disabled' : '') + '>Forge 3</button></span></div>';
    return h;
  }

  const list = RECIPES.filter(r => r.cat === craftTab);
  h += '<p class="note">Everything here is built from what is in your hold. Recipes chain: ore becomes plate, plate becomes circuit, circuit becomes a module.</p>';
  for (const r of list) {
    const m = MAT[r.o];
    const ok = hasAll(r.in);
    h += '<div class="row ' + (ok ? '' : 'locked') + '"><span class="dot" style="background:' + m.c + '"></span>' +
      '<span class="nm">' + m.n + ' ×' + r.n + '<small>' + cap1(m.cat) + ' · sells for ' + fmtN(m.v) + ' each</small>' +
      '<small class="cost">' + costText(r.in) + '</small></span>' +
      '<span class="qty">' + Math.floor(G.cargo[r.o] || 0) + '</span>' +
      '<span class="acts"><button class="btn xs ghost" data-act="craft" data-k="' + r.o + '" data-n="1"' + (ok ? '' : ' disabled') + '>Make</button>' +
      '<button class="btn xs" data-act="craft" data-k="' + r.o + '" data-n="5"' + (ok ? '' : ' disabled') + '>×5</button></span></div>';
  }
  return h;
}

function uiBuild() {
  if (G.mode !== 'surface' || !planet) return '<p class="empty">Construction only works while you are standing on a world.</p>';
  const isColony = !!G.colonies[planet.id];
  let h = '<div class="tabs">' +
    '<button class="tab ' + (buildTab === 'personal' ? 'on' : '') + '" data-act="btab" data-k="personal">Personal base</button>' +
    '<button class="tab ' + (buildTab === 'colony' ? 'on' : '') + '" data-act="btab" data-k="colony">Colony</button></div>';

  if (buildTab === 'colony' && !isColony) {
    h += '<p class="note">Colony structures need a claim on this world first. A claim beacon costs <b>' + fmt(claimCost()) +
      '</b> units and every world after that costs more.</p>';
    h += '<div class="row"><span class="dot" style="background:#4fe3d0"></span><span class="nm">Claim ' + planet.name +
      '<small>' + BIOMES[planet.biome].n + ' world · ' + planet.res.map(k => MAT[k].n).join(', ') + '</small></span>' +
      '<span class="pr">' + fmt(claimCost()) + '</span>' +
      '<span class="acts"><button class="btn sm" data-act="claim"' + (G.credits < claimCost() ? ' disabled' : '') + '>Plant beacon</button></span></div>';
    return h;
  }
  const site = buildTab === 'colony' ? G.colonies[planet.id] : ensureBase(planet.id, planet.name, planet.biome, planet.res);
  const st = colStats(site);
  if (buildTab === 'colony') {
    h += '<div class="stats">' +
      '<div class="stat"><i>Population</i><b>' + fmtN(site.pop) + '</b></div>' +
      '<div class="stat"><i>Capacity</i><b>' + fmtN(st.cap) + '</b></div>' +
      '<div class="stat"><i>Power</i><b>' + Math.round(st.pwrP) + ' / ' + Math.round(st.pwrC) + '</b></div>' +
      '<div class="stat"><i>Efficiency</i><b>' + Math.round(st.eff * 100) + '%</b></div>' +
      '<div class="stat"><i>Income</i><b>' + fmt(colIncome(site)) + '/s</b></div>' +
      '<div class="stat"><i>Structures</i><b>' + site.build.length + '</b></div></div>';
    if (st.eff < 1) h += '<p class="note" style="color:var(--rust)">Power deficit. Everything runs at ' + Math.round(st.eff * 100) + '% until you add generation.</p>';
  } else {
    h += '<p class="note">A personal base needs no claim. Put down plots, a condenser, storage and a workshop and this world becomes somewhere you can actually live.</p>';
    h += '<div class="stats">' +
      '<div class="stat"><i>Farm plots</i><b>' + st.plots + '</b></div>' +
      '<div class="stat"><i>Storage</i><b>' + st.store + '</b></div>' +
      '<div class="stat"><i>Structures</i><b>' + site.build.length + '</b></div></div>';
  }
  h += '<h4 class="sec">Available</h4>';
  for (const k of BUILD_KEYS) {
    const d = BUILDS[k];
    const personal = !!d.personal;
    if ((buildTab === 'personal') !== personal) continue;
    /* tier II and III are locked until at least one of the tier below is
       actually standing — no skipping straight to the rare-material end */
    if (d.upgradeOf && !site.build.some(x => x.t === d.upgradeOf)) continue;
    const owned = site.build.filter(x => x.t === k).length;
    /* the credits price climbs with each one you already own — building a
       fifth solar array is a bigger ask than the first — but the raw
       material cost never inflates; ferrite is always ferrite */
    const cr = Math.round(d.cr * Math.pow(1.35, owned));
    const cost = d.in;
    const afford = G.credits >= cr && hasAll(cost);
    const eff = [];
    if (d.pwr > 0) eff.push('+' + d.pwr + ' power'); else if (d.pwr < 0) eff.push(d.pwr + ' power');
    if (d.cap) eff.push('+' + d.cap + ' capacity');
    if (d.ext) eff.push('auto-extraction');
    if (d.grow) eff.push('+' + Math.round(d.grow * 100) + '% growth');
    if (d.ref) eff.push('auto-selling');
    if (d.trade) eff.push('+' + Math.round(d.trade * 100) + '% trade');
    if (d.res) eff.push('research');
    if (d.def) eff.push('defence');
    if (d.plots) eff.push(d.plots + ' plots');
    if (d.store) eff.push(d.store + ' storage');
    if (d.craft) eff.push('fabrication on site');
    h += '<div class="row ' + (afford ? '' : 'locked') + '"><span class="dot" style="background:' + (personal ? '#ffc46b' : '#4fe3d0') + '"></span>' +
      '<span class="nm">' + d.n + (d.tier > 1 ? '<span class="pill c">tier ' + d.tier + '</span>' : '') + (owned ? '<span class="pill e">×' + owned + '</span>' : '') +
      '<small>' + d.d + '</small><small>' + eff.join(' · ') + '</small>' +
      '<small class="cost">' + costText(cost) + '</small></span>' +
      '<span class="pr">' + fmt(cr) + '</span>' +
      '<span class="acts"><button class="btn sm" data-act="build" data-k="' + k + '"' + (afford ? '' : ' disabled') + '>Build</button></span></div>';
  }
  if (buildTab === 'colony' && isColony) {
    syncDistricts(planet.id, true);
    const list = districtsOf(planet.id);
    h += '<h4 class="sec">Borders</h4>';
    h += '<p class="note">A claim is a line on a chart. A border ring is a line on the ground — it shows you and everyone ' +
      'else exactly where your civilisation stops. Put a weather stabiliser inside one and the hazard, the weather and ' +
      'the suit drain all stop at the edge. You can have as many rings as you can pay for, and widen each of them.</p>';
    h += '<div class="row"><span class="dot" style="background:#4fe3d0"></span>' +
      '<span class="nm">New border ring<small>Drawn around wherever you are standing, 700 metres across to begin with</small></span>' +
      '<span class="pr">' + fmt(districtCost(site)) + '</span>' +
      '<span class="acts"><button class="btn sm" data-act="district"' + (G.credits < districtCost(site) ? ' disabled' : '') + '>Set ring</button></span></div>';
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      const up = Math.round(24000 * Math.pow(1.7, d.lvl));
      h += '<div class="row ' + (d.stab ? 'sel' : '') + '"><span class="dot" style="background:' + (d.stab ? '#6fd8ff' : '#4fe3d0') + '"></span>' +
        '<span class="nm">' + d.name + (d.stab ? '<span class="pill">sky held</span>' : '') +
        '<small>radius ' + Math.round(d.r) + ' m · level ' + d.lvl + '</small>' +
        '<small class="cost">' + (d.stab ? 'A stabiliser inside this ring is holding the weather off.'
          : 'No stabiliser inside this ring yet — build one within the circle.') + '</small></span>' +
        '<span class="pr">' + fmt(up) + '</span>' +
        '<span class="acts"><button class="btn xs" data-act="distup" data-n="' + i + '"' + (G.credits < up ? ' disabled' : '') + '>Widen</button></span></div>';
    }
    const stock = Object.keys(site.stock).filter(k => site.stock[k] > 0.5);
    if (stock.length) {
      h += '<h4 class="sec">Colony store</h4>';
      for (const k of stock) h += matRow(k, Math.floor(site.stock[k]), fmtN(Math.floor(site.stock[k]) * (MAT[k] ? MAT[k].v : 0)),
        '<button class="btn xs ghost" data-act="collect" data-k="' + k + '">Load</button>');
    }
  }
  return h;
}

function uiFarm() {
  if (G.mode !== 'surface' || !planet) return '<p class="empty">Farmland is tied to a world. Land first.</p>';
  const pid = planet.id;
  const total = totalPlots(pid);
  if (!total) return '<p class="empty">No plots here yet. Open construction (B) and put down a farm plot.</p>';
  const f = syncPlots(pid);
  const seeds = Object.keys(G.cargo).filter(k => MAT[k] && MAT[k].cat === 'seed' && G.cargo[k] >= 1);
  const suited = Object.keys(CROPS).filter(c => CROPS[c].biome.indexOf(planet.biome) >= 0);
  let ready = 0, planted = 0, thirsty = 0;
  for (const p of f.plots) { if (p.crop) { planted++; if (p.stage >= CROPS[p.crop].days) ready++; if (!p.watered) thirsty++; } }

  let h = '<div class="stats">' +
    '<div class="stat"><i>Plots</i><b>' + total + '</b></div>' +
    '<div class="stat"><i>Planted</i><b>' + planted + '</b></div>' +
    '<div class="stat"><i>Ready</i><b>' + ready + '</b></div>' +
    '<div class="stat"><i>Need water</i><b>' + thirsty + '</b></div></div>';
  h += '<p class="note">Water a crop and it advances one stage each cycle. Leave it dry three cycles running and it dies. ' +
    (suited.length ? 'This soil suits ' + suited.map(c => CROPS[c].n).join(', ') + ' best.' : 'Nothing grows naturally in this soil — expect poor yields.') + '</p>';
  h += '<div class="row"><span class="nm">Whole field<small>' + (hasTool('water') ? 'Watering can in hand' : 'No watering can — craft one from copper and glass') + '</small></span>' +
    '<span class="acts"><button class="btn sm ghost" data-act="waterall"' + (hasTool('water') && thirsty ? '' : ' disabled') + '>Water all</button>' +
    '<button class="btn sm" data-act="harvestall"' + (ready ? '' : ' disabled') + '>Harvest all</button></span></div>';

  h += '<div class="plot">';
  for (let i = 0; i < f.plots.length; i++) {
    const p = f.plots[i];
    const cd = p.crop ? CROPS[p.crop] : null;
    const isReady = cd && p.stage >= cd.days;
    const cls = isReady ? 'ready' : (p.crop && !p.watered ? 'dry' : '');
    const glyph = !p.crop ? '·' : isReady ? '✦' : (p.stage === 0 ? '˙' : p.stage < cd.days / 2 ? '⋎' : 'Ψ');
    const label = !p.crop ? 'empty' : (isReady ? 'ready' : p.stage + '/' + cd.days);
    h += '<div class="cellplot ' + cls + '" data-act="plot" data-n="' + i + '" title="' + (cd ? cd.n : 'Empty plot') + '"' +
      (cd ? ' style="color:' + MAT[p.crop].c + '"' : '') + '>' + glyph + '<small>' + label + '</small></div>';
  }
  h += '</div>';

  h += '<h4 class="sec">Seeds in the hold</h4>';
  if (!seeds.length) h += '<p class="empty">No seeds. Buy them from a botanist in a settlement, or craft them from a harvested crop.</p>';
  for (const k of seeds) {
    const crop = MAT[k].crop, cd = CROPS[crop];
    const good = cd.biome.indexOf(planet.biome) >= 0;
    h += '<div class="row"><span class="dot" style="background:' + MAT[k].c + '"></span>' +
      '<span class="nm">' + MAT[k].n + (good ? '<span class="pill">suits this soil</span>' : '') +
      '<small>' + cd.days + ' cycles · yields ' + cd.yield[0] + '–' + cd.yield[1] + ' · ' + Math.floor(G.cargo[k]) + ' in the hold</small></span>' +
      '<span class="acts"><button class="btn xs ' + (G.plantSel === k ? '' : 'ghost') + '" data-act="selseed" data-k="' + k + '">' +
      (G.plantSel === k ? 'Selected' : 'Select') + '</button>' +
      '<button class="btn xs ghost" data-act="plantall" data-k="' + k + '">Fill empty</button></span></div>';
  }
  h += '<p class="note">Select a seed, then click an empty plot to sow it. Click a grown plot to harvest, a thirsty one to water.</p>';
  return h;
}

/* a signed stat line: green when the number helps you, rust when it does not */
function gearStat(label, txt, good) {
  const col = good === 0 ? 'var(--dim)' : good > 0 ? 'var(--leaf)' : 'var(--rust)';
  return '<div class="stat"><i>' + label + '</i><b style="color:' + col + '">' + txt + '</b></div>';
}
function pctTxt(v, digits) {
  const n = v * 100;
  return (n > 0 ? '+' : '') + n.toFixed(digits === undefined ? 0 : digits) + '%';
}
function gunStatBits(g) {
  const bits = [];
  if (g.mode === 'melee') bits.push('melee');
  bits.push(g.dmg + ' damage');
  if (g.pellets) bits.push(g.pellets + ' pellets');
  if (g.mode === 'beam') bits.push('continuous beam');
  else if (g.rate) bits.push(g.rate.toFixed(2) + 's between shots');
  bits.push(g.range + ' reach');
  if (g.blast) bits.push(g.blast + ' blast');
  if (g.heat) bits.push('runs hot');
  bits.push('weight ' + ((g.wt || 0) === 0 ? 'none' : (g.wt || 0).toFixed(2)));
  return bits.join(' · ');
}
function suitStatBits(d) {
  return [d.hp + ' integrity', d.air + ' air',
    'hazard ' + pctTxt(d.haz), 'armour ' + pctTxt(d.armour),
    'weight ' + (d.weight === 0 ? 'none' : (d.weight > 0 ? '+' : '') + d.weight.toFixed(2))].join(' · ');
}
function uiGear() {
  const g = curGun(), d = suitDef();
  const speed = walkSpeedMul();
  let h = '<div class="stats">' +
    gearStat('Suit integrity', Math.round(G.suit.hp) + ' / ' + Math.round(G.suit.max), 0) +
    gearStat('Air supply', Math.round(G.suit.air) + ' / ' + Math.round(G.suit.airMax), 0) +
    gearStat('Hazard tolerance', pctTxt(d.haz), d.haz > 0 ? 1 : d.haz < 0 ? -1 : 0) +
    gearStat('Armour', pctTxt(d.armour), d.armour > 0 ? 1 : d.armour < 0 ? -1 : 0) +
    gearStat('Carried load', carryLoad().toFixed(2), carryLoad() > 0 ? -1 : carryLoad() < 0 ? 1 : 0) +
    gearStat('Move speed', pctTxt(speed - 1), speed > 1 ? 1 : speed < 1 ? -1 : 0) +
    '</div>';

  h += '<p class="note">Drag a weapon or a suit onto its slot to equip it, or just click Equip. ' +
    'Everything you are carrying is listed below. Heavier kit protects you better and slows you down — the move speed figure above is the whole story.</p>';

  /* --- the two equipped slots, both drop targets --- */
  h += '<div class="gearslots">';
  h += '<div class="gearslot" data-drop="gun"><div class="gs-lbl">Main hand</div>' +
    '<div class="gs-name" style="color:' + g.col + '">' + g.n + '</div>' +
    '<div class="gs-sub">' + gunStatBits(g) + '</div>' +
    (G.gun === 'fists' ? '<div class="gs-note">Nothing in your hands.</div>' : '') + '</div>';
  h += '<div class="gearslot" data-drop="suit"><div class="gs-lbl">Spacesuit</div>' +
    '<div class="gs-name" style="color:var(--cyan)">' + d.n + '</div>' +
    '<div class="gs-sub">' + suitStatBits(d) + '</div>' +
    '<div class="gs-note">' + d.d + '</div></div>';
  h += '</div>';

  /* --- weapons --- */
  h += '<h4 class="sec">Weapons carried</h4>';
  const guns = ownedGuns();
  for (const k of guns) {
    const w = GUNS[k], on = G.gun === k;
    h += '<div class="row ' + (on ? 'sel' : '') + '" draggable="true" data-drag="gun:' + k + '">' +
      '<span class="dot" style="background:' + w.col + '"></span>' +
      '<span class="nm">' + w.n + '<small>' + gunStatBits(w) + '</small>' +
      '<small class="cost">' + w.d + '</small></span>' +
      '<span class="acts"><button class="btn xs ' + (on ? '' : 'ghost') + '" data-act="equipgun" data-k="' + k + '">' +
      (on ? 'In hand' : 'Equip') + '</button></span></div>';
  }

  /* --- suits --- */
  h += '<h4 class="sec">Suits carried</h4>';
  const suits = ownedSuits();
  for (const k of suits) {
    const sd = SUITS[k], on = G.suitKey === k;
    h += '<div class="row ' + (on ? 'sel' : '') + '" draggable="true" data-drag="suit:' + k + '">' +
      '<span class="dot" style="background:var(--cyan)"></span>' +
      '<span class="nm">' + sd.n + '<small>' + suitStatBits(sd) + '</small>' +
      '<small class="cost">' + sd.d + '</small></span>' +
      '<span class="acts"><button class="btn xs ' + (on ? '' : 'ghost') + '" data-act="equipsuit" data-k="' + k + '">' +
      (on ? 'Worn' : 'Wear') + '</button></span></div>';
  }
  if (suits.length === 1)
    h += '<p class="empty">Only the issue suit. Better ones are sold by outfitters and gunsmiths, or built in the fabricator under Suits.</p>';
  return h;
}

function uiCrew() {
  let h = '<div class="tabs">' +
    '<button class="tab ' + (crewTab === 'roster' ? 'on' : '') + '" data-act="crtab" data-k="roster">Roster</button>' +
    '<button class="tab ' + (crewTab === 'skills' ? 'on' : '') + '" data-act="crtab" data-k="skills">Skills</button></div>';
  if (crewTab === 'skills') {
    h += '<p class="note">Every crew member contributes to one skill. Their level and their morale both matter, so a miserable expert is worth less than a content amateur.</p>';
    for (const k in CREW_SKILLS) {
      const b = crewBonus(k);
      h += '<div class="row"><span class="dot" style="background:#4fe3d0"></span>' +
        '<span class="nm">' + CREW_SKILLS[k].n + '<small>' + CREW_SKILLS[k].d + '</small></span>' +
        '<span class="qty">' + (b > 0 ? '+' + (b * 100).toFixed(0) + '%' : '—') + '</span></div>';
    }
    return h;
  }
  const food = Object.keys(G.cargo).filter(k => MAT[k] && MAT[k].food).reduce((s, k) => s + Math.floor(G.cargo[k]), 0);
  h += '<div class="stats">' +
    '<div class="stat"><i>Aboard</i><b>' + G.crew.length + ' / 6</b></div>' +
    '<div class="stat"><i>Daily wages</i><b>' + fmt(G.crew.reduce((s, c) => s + c.wage, 0)) + '</b></div>' +
    '<div class="stat"><i>Food stores</i><b>' + food + '</b></div>' +
    '<div class="stat"><i>Morale</i><b>' + (G.crew.length ? Math.round(G.crew.reduce((s, c) => s + c.morale, 0) / G.crew.length) + '%' : '—') + '</b></div></div>';
  h += '<p class="note">Each cycle the crew eats one unit of food apiece and draws their wage. Starve them or stiff them and morale falls; at zero they walk. ' +
    'Recruit by building a relationship with someone in a settlement, then asking them to sign on.</p>';
  if (!G.crew.length) return h + '<p class="empty">Nobody aboard but you. Land on an inhabited world, talk to a mechanic, pilot, gunner, xenologist or farmhand, and win them over.</p>';
  for (let i = 0; i < G.crew.length; i++) {
    const c = G.crew[i];
    const moodWord = c.morale > 75 ? 'content' : c.morale > 45 ? 'steady' : c.morale > 20 ? 'unhappy' : 'close to walking';
    h += '<div class="row"><span class="dot" style="background:' + c.col + '"></span>' +
      '<span class="nm">' + c.name + '<small>' + c.spec + ' · ' + c.role + ' · ' + CREW_SKILLS[c.skill].n + ' level ' + c.level + '</small>' +
      '<small>morale ' + Math.round(c.morale) + '% (' + moodWord + ') · health ' + Math.round(c.hp) + '% · ' + fmt(c.wage) + ' a cycle</small></span>' +
      '<span class="acts">' +
      '<button class="btn xs ghost" data-act="healcrew" data-n="' + i + '"' + ((G.cargo.medkit || 0) < 1 || c.hp >= c.maxHp ? ' disabled' : '') + '>Med kit</button>' +
      '<button class="btn xs warn" data-act="firecrew" data-n="' + i + '">Discharge</button></span></div>';
  }
  return h;
}

function uiEmpire() {
  const cols = Object.keys(G.colonies);
  let h = '<div class="stats">' +
    '<div class="stat"><i>Net worth</i><b>' + fmt(netWorth()) + '</b></div>' +
    '<div class="stat"><i>Rank</i><b>#' + myRank() + '</b></div>' +
    '<div class="stat"><i>Worlds</i><b>' + cols.length + '</b></div>' +
    '<div class="stat"><i>Population</i><b>' + fmt(empirePop()) + '</b></div>' +
    '<div class="stat"><i>Flow</i><b>' + fmt(empireIncome()) + '/s</b></div>' +
    '<div class="stat"><i>Discoveries</i><b>' + G.codexN + '</b></div></div>';

  h += '<h4 class="sec">Holdings</h4>';
  if (!cols.length) h += '<p class="empty">No worlds claimed. Land somewhere with resources worth having and press X.</p>';
  for (const k of cols) {
    const co = G.colonies[k], st = colStats(co);
    h += '<div class="row"><span class="dot" style="background:' + BIOMES[co.biome].acc + '"></span>' +
      '<span class="nm">' + co.name + '<small>' + BIOMES[co.biome].n + ' · founded cycle ' + co.founded +
      (co.raided ? ' · raided ' + co.raided + '×' : '') + '</small>' +
      '<small>' + fmtN(co.pop) + ' / ' + fmtN(st.cap) + ' people · ' + Math.round(st.eff * 100) + '% power · ' + co.build.length + ' structures</small></span>' +
      '<span class="pr">' + fmt(colIncome(co)) + '/s</span>' +
      '<span class="acts"><button class="btn xs ghost" data-act="goto" data-k="' + k + '">Set course</button></span></div>';
  }

  h += '<h4 class="sec">Standing with the powers</h4>';
  for (const f of FACTION_KEYS) {
    if (f === 'none') continue;
    const v = G.rep[f] || 0;
    const w = Math.abs(v) / 100 * 60;
    h += '<div class="row"><span class="dot" style="background:' + FACTIONS[f].c + '"></span>' +
      '<span class="nm">' + FACTIONS[f].n + '<small>' + FACTIONS[f].d + '</small></span>' +
      '<span class="repbar"><i class="' + (v < 0 ? 'neg' : '') + '" style="left:' + (v < 0 ? (60 - w) : 60) + 'px;width:' + w + 'px"></i></span>' +
      '<span class="qty">' + repTitle(v) + '</span></div>';
  }

  h += '<h4 class="sec">Wealth rankings</h4>';
  const list = ranking();
  const me = list.findIndex(x => x.you);
  h += '<p class="note">' + fmtN(list.length) + ' operators are worth tracking across this arm. You are ' +
    (me === 0 ? 'top of them.' : 'number ' + fmtN(me + 1) + ', ' + fmt(list[me - 1].w - list[me].w) + ' behind ' + list[me - 1].n + '.') + '</p>';
  const rows = [];
  const push = i => { if (i >= 0 && i < list.length && rows.indexOf(i) < 0) rows.push(i); };
  for (let i = 0; i < 10; i++) push(i);
  for (let i = me - 4; i <= me + 4; i++) push(i);
  rows.sort((a, b) => a - b);
  let last = -1;
  for (const i of rows) {
    if (last >= 0 && i > last + 1) h += '<div class="leadgap">' + fmtN(i - last - 1) + ' more</div>';
    const e = list[i];
    h += '<div class="lead ' + (e.you ? 'you' : '') + '"><span class="pos">' + fmtN(i + 1) + '</span>' +
      '<span class="who">' + e.n + '<small>' + e.f + '</small></span>' +
      '<span class="amt">' + fmt(e.w) + '</span></div>';
    last = i;
  }
  return h;
}

function uiCodex() {
  const entries = Object.keys(G.codex).map(k => G.codex[k]);
  const kinds = ['all'].concat(entries.map(e => e.k).filter((v, i, a) => a.indexOf(v) === i));
  let h = '<div class="tabs">' + kinds.map(c =>
    '<button class="tab ' + (codexTab === c ? 'on' : '') + '" data-act="kxtab" data-k="' + encodeURIComponent(c) + '">' +
    (c === 'all' ? 'Everything' : c) + '</button>').join('') + '</div>';
  h += '<p class="note">' + G.codexN + ' entries recorded. Every first sighting pays out, and a better scanner or a scientist aboard pays out more.</p>';
  const show = entries.filter(e => codexTab === 'all' || e.k === codexTab).reverse();
  if (!show.length) return h + '<p class="empty">Nothing logged yet. Press F near anything unfamiliar.</p>';
  for (const e of show) {
    h += '<div class="row"><span class="dot" style="background:#d484ff"></span>' +
      '<span class="nm">' + e.t + '<small>' + e.k + ' · logged cycle ' + e.at + '</small><small>' + e.d + '</small></span></div>';
  }
  return h;
}

function uiQuests() {
  let h = '<div class="tabs">' +
    '<button class="tab ' + (questTab === 'main' ? 'on' : '') + '" data-act="qtab" data-k="main">Main</button>' +
    '<button class="tab ' + (questTab === 'side' ? 'on' : '') + '" data-act="qtab" data-k="side">Side contracts</button>' +
    '<button class="tab ' + (questTab === 'done' ? 'on' : '') + '" data-act="qtab" data-k="done">Finished</button></div>';

  if (questTab === 'done') {
    const done = MAIN.filter(q => mdone(q.id));
    h += '<p class="note">' + done.length + ' of ' + MAIN.length + ' main tasks behind you, and ' + G.questDone + ' side contracts settled.</p>';
    if (!done.length) return h + '<p class="empty">Nothing finished yet.</p>';
    for (const q of done) h += '<div class="row"><span class="dot" style="background:#4fe3d0"></span>' +
      '<span class="nm">' + q.t + '<small>' + q.ch + ' · closed on cycle ' + G.mainDone[q.id] + '</small></span></div>';
    return h;
  }

  if (questTab === 'main') {
    const live = mainActive();
    const chapters = [];
    for (const q of live) if (chapters.indexOf(q.ch) < 0) chapters.push(q.ch);
    h += '<p class="note">The main line runs from the wreck you woke up in to the top of the wealth rankings. ' +
      'Chapters open as you do the work rather than in a fixed order — hitting a monolith or killing something large ' +
      'starts its own thread. Star a task to pin it to the corner of the screen.</p>';
    if (!live.length) return h + '<p class="empty">Everything open is finished. That is the whole spine.</p>';
    for (const ch of chapters) {
      h += '<h4 class="sec">' + ch + '</h4>';
      for (const q of live.filter(x => x.ch === ch)) {
        const on = !!G.trackMain[q.id];
        let prog = '';
        if (q.p) { const pr = q.p(); prog = fmtN(Math.min(pr[0], pr[1])) + ' of ' + fmtN(pr[1]); }
        h += '<div class="row ' + (on ? 'sel' : '') + '"><span class="dot" style="background:#d484ff"></span>' +
          '<span class="nm">' + q.t + (q.d ? '<small>' + q.d + '</small>' : '') +
          (prog ? '<small class="cost">' + prog + '</small>' : '') + '</span>' +
          '<span class="pr">' + fmt(q.r || 0) + '</span>' +
          '<span class="acts"><button class="btn xs ' + (on ? '' : 'ghost') + '" data-act="trackm" data-k="' + q.id + '">' +
          (on ? 'Pinned' : 'Pin') + '</button></span></div>';
      }
    }
    return h;
  }

  h += '<p class="note">Side contracts come from people. Ask anyone for work, then find them again when it is done. ' +
    'They are small by design — a favour for a settlement, paid in goods, money or goodwill.</p>';
  if (!G.quests.length) return h + '<p class="empty">No open contracts. Land somewhere inhabited and ask around.</p>';
  for (const q of G.quests) {
    const pr = questProgress(q), ready = pr[0] >= pr[1];
    const on = !!G.trackSide[q.id];
    h += '<div class="row ' + (ready ? 'sel' : '') + '"><span class="dot" style="background:' + FACTIONS[q.fac].c + '"></span>' +
      '<span class="nm">' + q.t + '<small>' + FACTIONS[q.fac].n + (q.where ? ' · ' + q.where : '') + ' · ' +
      (ready ? 'ready to hand in' : fmtN(pr[0]) + ' of ' + fmtN(pr[1])) + '</small></span>' +
      '<span class="pr">' + fmt(q.pay) + '</span>' +
      '<span class="acts"><button class="btn xs ' + (on ? '' : 'ghost') + '" data-act="tracks" data-k="' + q.id + '">' + (on ? 'Pinned' : 'Pin') + '</button>' +
      '<button class="btn xs" data-act="turnin" data-k="' + q.id + '"' + (ready ? '' : ' disabled') + '>Claim</button>' +
      '<button class="btn xs ghost" data-act="abandon" data-k="' + q.id + '">Drop</button></span></div>';
  }
  return h;
}

function uiSettings() {
  const tog = (key, name, desc) =>
    '<div class="set"><span class="nm">' + name + '<small>' + desc + '</small></span>' +
    '<span class="toggle ' + (G.set[key] ? 'on' : '') + '" data-act="toggle" data-k="' + key + '"><i></i></span></div>';
  const sld = (key, name, desc, min, max, step, fmtv) =>
    '<div class="set"><span class="nm">' + name + '<small>' + desc + '</small></span>' +
    '<input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + G.set[key] + '" data-set="' + key + '">' +
    '<span class="val">' + fmtv(G.set[key]) + '</span></div>';
  const pct = v => Math.round(v * 100) + '%';

  let h = '<h4 class="sec">Audio</h4>';
  h += '<p class="note">Sound files live beside the page and are all named with the same prefix: ' +
    ['music','break','chirp','buy','lose','upgrade','attack','shoot'].map(sfxFile).join(', ') + '. ' +
    'Missing files are skipped without errors, so the game runs fine before you add them.' +
    (Object.keys(AU.missing).length ? ' Currently not loading: ' + Object.keys(AU.missing).join(', ') + '.' : '') + '</p>';
  h += sld('master', 'Master volume', 'Scales everything', 0, 1, 0.05, pct);
  h += tog('music', 'Background music', sfxFile('music') + ', looping from the moment you start');
  h += sld('musicVol', 'Music volume', '', 0, 1, 0.05, pct);
  h += tog('sfx', 'Sound effects', 'Mining, weapons, dialogue, purchases');
  h += sld('sfxVol', 'Effects volume', '', 0, 1, 0.05, pct);

  h += '<h4 class="sec">Graphics</h4>';
  h += sld('quality', 'Detail level', '0 low · 1 medium · 2 high. Lower settings drop particles, weather and star layers.', 0, 2, 1,
    v => ['Low','Medium','High'][v] || v);
  h += tog('shake', 'Screen shake', 'Camera kick on impacts and explosions');
  h += tog('damageNums', 'Floating numbers', 'Damage and pickup readouts in the world');

  h += '<h4 class="sec">Gameplay</h4>';
  h += tog('landingAssist', 'Landing assist readout', 'Shows altitude and descent rate when you close on a planet');
  h += tog('crashDamage', 'Hard surfaces', 'Planets damage the hull when you hit them above 150 m/s. Turning this off makes every approach a safe landing.');
  h += tog('hints', 'Control list', 'The full list of keys for wherever you are standing, above the scanner');
  h += tog('autosave', 'Autosave', 'Saves to this browser at the end of every cycle');

  h += '<h4 class="sec">Save data</h4>';
  h += '<div class="set"><span class="nm">Manual save<small>Stored in this browser only</small></span>' +
    '<span class="acts"><button class="btn sm ghost" data-act="save">Save now</button>' +
    '<button class="btn sm ghost" data-act="load">Reload save</button>' +
    '<button class="btn sm warn" data-act="wipe">Delete save</button></span></div>';
  return h;
}

function uiPause() {
  let h = '<p class="note">Cycle ' + G.day + ' · ' + fmt(netWorth()) + ' net worth · rank #' + myRank() + '</p>';
  h += '<div class="stats">' +
    '<div class="stat"><i>Mined</i><b>' + fmt(G.stat.mined) + '</b></div>' +
    '<div class="stat"><i>Jumps</i><b>' + fmtN(G.stat.jumps) + '</b></div>' +
    '<div class="stat"><i>Scans</i><b>' + fmtN(G.stat.scans) + '</b></div>' +
    '<div class="stat"><i>Kills</i><b>' + fmtN(G.stat.kills) + '</b></div>' +
    '<div class="stat"><i>Harvested</i><b>' + fmtN(G.stat.harvest) + '</b></div>' +
    '<div class="stat"><i>Fish landed</i><b>' + fmtN(G.stat.caught) + '</b></div>' +
    '<div class="stat"><i>Crafted</i><b>' + fmtN(G.stat.crafted) + '</b></div>' +
    '<div class="stat"><i>Crashes</i><b>' + fmtN(G.crashes) + '</b></div>' +
    '<div class="stat"><i>Ships lost</i><b>' + fmtN(G.deaths) + '</b></div></div>';
  h += '<div class="row"><span class="nm">Settings<small>Audio, graphics, gameplay and save data</small></span>' +
    '<span class="acts"><button class="btn sm ghost" data-act="opensettings">Open</button></span></div>';
  h += '<div class="row"><span class="nm">Save<small>Keeps everything in this browser</small></span>' +
    '<span class="acts"><button class="btn sm" data-act="save">Save now</button></span></div>';
  return h;
}

/* --- multi-waypoints: six colour-coded pins, placeable from the chart --- */
const CHART_ROYGBIV = ['#ff5f5f', '#ff9f4d', '#ffe94d', '#6cff8f', '#6fb8ff', '#5f6fff', '#d484ff'];
const WAYPOINT_COLORS = { red: '#ff5f5f', orange: '#ff9f4d', yellow: '#ffe94d', green: '#6cff8f', blue: '#6fb8ff', purple: '#d484ff' };
let waypointArm = null; /* colour currently armed for placement, or null */
function setWaypoint6(color, x, y, name) {
  G.waypoints6[color] = { x: x, y: y, name: name };
  say(color[0].toUpperCase() + color.slice(1) + ' waypoint set: ' + name, 'good');
}
function clearWaypoint6(color) { delete G.waypoints6[color]; }
/* draws every placed waypoint as a dotted line from (fx,fy) out to it, with
   the live distance printed partway along the line — used by both the
   in-world renderer and the scanner/chart panel */
function drawWaypoints6(g, fx, fy, toScreen, worldUnitsPerPx) {
  for (const color in G.waypoints6) {
    const w = G.waypoints6[color]; if (!w) continue;
    const col = WAYPOINT_COLORS[color] || '#fff';
    const a = toScreen(fx, fy), b = toScreen(w.x, w.y);
    g.strokeStyle = col; g.globalAlpha = 0.6; g.setLineDash([7, 6]); g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    g.setLineDash([]); g.globalAlpha = 1;
    g.fillStyle = col;
    g.beginPath(); g.arc(b[0], b[1], 6, 0, TAU); g.fill();
    const dist = Math.round(Math.hypot(w.x - fx, w.y - fy));
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const t = Math.min(1, 26 / segLen);
    const lx = a[0] + (b[0] - a[0]) * t, ly = a[1] + (b[1] - a[1]) * t;
    g.font = '10px "IBM Plex Mono", monospace'; g.textAlign = 'center';
    g.fillStyle = col; g.fillText(fmtN(dist) + ' u', lx, ly - 8);
    g.textAlign = 'left';
  }
}

/* --- star chart --- */
let chartZoom = 1, chartCx = 0, chartCy = 0, chartSel = null, chartPanned = false;
function chartHome() {
  chartCx = G.mode === 'galaxy' ? P.x : (sys ? sys.x : 0);
  chartCy = G.mode === 'galaxy' ? P.y : (sys ? sys.y : 0);
  chartPanned = false;
}
function drawChart() {
  const c = $('chart'), g = c.getContext('2d');
  const CW = c.width, CH = c.height;
  /* Only snap the view back to the ship when the player has not moved it
     themselves. This line used to run unconditionally, which meant every
     redraw threw away the drag that had just happened and the map could
     not be panned at all. */
  if (!chartPanned && !chartSel) chartHome();
  g.fillStyle = '#02060b'; g.fillRect(0, 0, CW, CH);
  const scale = 0.06 * chartZoom;
  const span = Math.ceil(1 / (scale * GAL_CELL) * Math.max(CW, CH) / 2) + 1;
  const bcx = Math.floor(chartCx / GAL_CELL), bcy = Math.floor(chartCy / GAL_CELL);

  g.strokeStyle = 'rgba(79,227,208,.07)'; g.lineWidth = 1;
  for (let i = -span; i <= span; i++) {
    const x = CW / 2 + ((bcx + i) * GAL_CELL - chartCx) * scale;
    const y = CH / 2 + ((bcy + i) * GAL_CELL - chartCy) * scale;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, CH); g.stroke();
    g.beginPath(); g.moveTo(0, y); g.lineTo(CW, y); g.stroke();
  }
  const seen = [];
  for (let j = -span; j <= span; j++) for (let i = -span; i <= span; i++) {
    const s = systemAt(bcx + i, bcy + j);
    if (!s) continue;
    const x = CW / 2 + (s.x - chartCx) * scale, y = CH / 2 + (s.y - chartCy) * scale;
    if (x < -30 || x > CW + 30 || y < -30 || y > CH + 30) continue;
    seen.push({ s: s, x: x, y: y });
    const known = !!G.codex['sys:' + s.key];
    if (s.blackhole) {
      const hr = Math.max(5, s.r * scale);
      g.globalAlpha = known ? 1 : 0.5;
      g.strokeStyle = 'rgba(212,132,255,.35)'; g.lineWidth = 1; g.setLineDash([4, 4]);
      g.beginPath(); g.arc(x, y, Math.max(hr * 1.6, BLACKHOLE_REACH * scale), 0, TAU); g.stroke();
      g.setLineDash([]);
      g.fillStyle = 'rgba(255,214,150,.8)';
      g.beginPath(); g.arc(x, y, hr * 1.2, 0, TAU); g.fill();
      g.fillStyle = '#000';
      g.beginPath(); g.arc(x, y, hr, 0, TAU); g.fill();
      g.globalAlpha = 1;
      if (chartZoom > 0.7) {
        g.fillStyle = '#c9a8ff'; g.font = '10px "IBM Plex Mono", monospace'; g.textAlign = 'center';
        g.fillText(s.name, x, y + hr + 13);
        g.textAlign = 'left';
      }
      continue;
    }
    let owned = 0; for (const pl of s.planets) if (G.colonies[pl.id]) owned++;
    g.globalAlpha = known ? 1 : 0.4;
    g.fillStyle = CHART_ROYGBIV[Math.abs(hash2(s.cx, s.cy, 0x2e0)) % 7];
    g.beginPath(); g.arc(x, y, known ? 5 : 3, 0, TAU); g.fill();
    g.globalAlpha = 1;
    if (owned) { g.strokeStyle = '#4fe3d0'; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, 11, 0, TAU); g.stroke(); }
    if (s.hasStation && known) {
      g.strokeStyle = '#00ffff'; g.fillStyle = 'rgba(0,255,255,.2)'; g.lineWidth = 1.2;
      g.beginPath();
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6; const hx = x + Math.cos(a) * 9, hy = y + Math.sin(a) * 9; i ? g.lineTo(hx, hy) : g.moveTo(hx, hy); }
      g.closePath(); g.fill(); g.stroke();
    }
    if (chartZoom > 1.4 && known) {
      g.fillStyle = 'rgba(207,230,238,.8)'; g.font = '10px "IBM Plex Mono", monospace'; g.textAlign = 'center';
      g.fillText(s.name, x, y + 20);
    }
  }
  g.textAlign = 'left';
  /* you */
  const px = CW / 2 + ((G.mode === 'galaxy' ? P.x : sys.x) - chartCx) * scale;
  const py = CH / 2 + ((G.mode === 'galaxy' ? P.y : sys.y) - chartCy) * scale;
  g.strokeStyle = '#d484ff'; g.lineWidth = 2;
  g.beginPath(); g.arc(px, py, 9 + Math.sin(G.t * 3) * 2, 0, TAU); g.stroke();
  g.beginPath(); g.moveTo(px - 15, py); g.lineTo(px - 6, py); g.moveTo(px + 6, py); g.lineTo(px + 15, py); g.stroke();
  if (G.waypoint) {
    const wx = CW / 2 + (G.waypoint.x - chartCx) * scale, wy = CH / 2 + (G.waypoint.y - chartCy) * scale;
    g.strokeStyle = '#ffc46b'; g.setLineDash([6, 5]);
    g.beginPath(); g.moveTo(px, py); g.lineTo(wx, wy); g.stroke(); g.setLineDash([]);
    g.beginPath(); g.arc(wx, wy, 8, 0, TAU); g.stroke();
  }
  drawWaypoints6(g, (G.mode === 'galaxy' ? P.x : sys.x), (G.mode === 'galaxy' ? P.y : sys.y),
    (wx, wy) => [CW / 2 + (wx - chartCx) * scale, CH / 2 + (wy - chartCy) * scale]);
  chartHits = seen;
  let wpBar = '<div class="chartbar">';
  for (const c in WAYPOINT_COLORS) {
    const set = !!G.waypoints6[c];
    wpBar += '<button class="btn xs ' + (waypointArm === c ? '' : 'ghost') + '" style="border-color:' + WAYPOINT_COLORS[c] + ';color:' + WAYPOINT_COLORS[c] + '" ' +
      'data-act="wparm" data-k="' + c + '">' + (waypointArm === c ? 'Click a star\u2026' : (set ? c + ' \u2713' : c)) + '</button>';
  }
  wpBar += '<button class="btn xs ghost" data-act="wpclear">Clear pins</button></div>';
  $('chart-info').innerHTML = (chartSel
    ? (chartSel.blackhole
      ? '<b style="color:var(--orchid)">' + chartSel.name + '</b> · collapsed singularity · no orbits, no survivors' +
        '<br>The well reaches roughly ' + fmtN(Math.round(BLACKHOLE_REACH)) + ' units out. Plot a course around it, not through it.'
      : '<b style="color:var(--teal)">' + chartSel.name + '</b> · ' + chartSel.star.n + ' · ' + chartSel.planets.length + ' worlds · ' +
      FACTIONS[chartSel.faction].n + (chartSel.hasStation ? ' · trade station' : '') + ' · threat ' + chartSel.danger +
      '<br>Click it again to set it as your waypoint.')
    : 'Drag to pan, scroll to zoom, click a star for details. Teal rings are worlds you own; squares are stations.') +
    '<div class="chartbar"><button class="btn xs ghost" data-act="chartzoom" data-n="1">Zoom in</button>' +
    '<button class="btn xs ghost" data-act="chartzoom" data-n="-1">Zoom out</button>' +
    '<button class="btn xs ghost" data-act="chartrecentre">Centre on me</button>' +
    '<span class="cost">×' + chartZoom.toFixed(2) + (chartPanned ? ' · panned' : '') + '</span></div>' + wpBar;
}
let chartHits = [], chartDrag = null;
(function wireChart() {
  const c = $('chart');
  if (!c) return;
  c.addEventListener('wheel', e => {
    e.preventDefault();
    chartZoom = clamp(chartZoom * (e.deltaY < 0 ? 1.2 : 0.84), 0.25, 6);
    drawChart();
  }, { passive: false });
  const startDrag = (cx, cy) => {
    const r = c.getBoundingClientRect();
    chartDrag = { x: cx, y: cy, cx: chartCx, cy: chartCy, moved: false,
      sx: (cx - r.left) * (c.width / r.width), sy: (cy - r.top) * (c.height / r.height) };
  };
  const moveDrag = (cx, cy) => {
    if (!chartDrag) return;
    const dx = cx - chartDrag.x, dy = cy - chartDrag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) { chartDrag.moved = true; chartPanned = true; }
    chartCx = chartDrag.cx - dx / (0.06 * chartZoom);
    chartCy = chartDrag.cy - dy / (0.06 * chartZoom);
    if (openId === 'chart') drawChart();
  };
  c.addEventListener('mousedown', e => { e.preventDefault(); startDrag(e.clientX, e.clientY); });
  window.addEventListener('mousemove', e => moveDrag(e.clientX, e.clientY));
  /* the same drag with a finger */
  c.addEventListener('touchstart', e => {
    if (!e.touches.length) return;
    startDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  c.addEventListener('touchmove', e => {
    if (!chartDrag || !e.touches.length) return;
    e.preventDefault();
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  c.addEventListener('touchend', () => { finishDrag(); });
  const finishDrag = () => {
    if (chartDrag && !chartDrag.moved) {
      let best = null, bd = 400;
      for (const h of chartHits) {
        const d = (h.x - chartDrag.sx) * (h.x - chartDrag.sx) + (h.y - chartDrag.sy) * (h.y - chartDrag.sy);
        if (d < bd) { bd = d; best = h.s; }
      }
      if (best) {
        if (waypointArm) { setWaypoint6(waypointArm, best.x, best.y, best.name); waypointArm = null; chartSel = null; }
        else if (chartSel === best) { G.waypoint = { x: best.x, y: best.y, name: best.name }; say('Waypoint set: ' + best.name, 'good'); chartSel = null; }
        else chartSel = best;
        drawChart();
      }
    }
    chartDrag = null;
  };
  window.addEventListener('mouseup', finishDrag);
})();

/* ------------------------------------------------------------
   33. PANEL ACTIONS
------------------------------------------------------------ */
function doAction(act, k, n) {
  n = n === undefined ? 1 : (isNaN(+n) ? n : +n);
  switch (act) {
    case 'mtab': marketTab = k; break;
    case 'ctab': craftTab = decodeURIComponent(k); break;
    case 'btab': buildTab = k; break;
    case 'kxtab': codexTab = decodeURIComponent(k); break;
    case 'crtab': crewTab = k; break;
    case 'equipgun': {
      if (!GUNS[k]) break;
      if (ownedGuns().indexOf(k) < 0) { say('You are not carrying that.', 'warn'); break; }
      G.gun = k; say('Drew the ' + GUNS[k].n.toLowerCase() + '.', '');
      break;
    }
    case 'equipsuit': wearSuit(k); break;
    case 'qtab': questTab = k; break;
    case 'trackm': if (G.trackMain[k]) delete G.trackMain[k]; else G.trackMain[k] = 1; break;
    case 'tracks': if (G.trackSide[k]) delete G.trackSide[k]; else G.trackSide[k] = 1; break;

    case 'buy': {
      const p = priceOf(k, sys);
      const want = Math.min(n, Math.floor(G.credits / p), cargoCap() - Math.floor(cargoUsed()));
      if (want <= 0) { say('No room or not enough units.', 'warn'); break; }
      G.credits -= p * want; addRes(k, want); AU.play('buy');
      say('Bought ' + want + ' ' + MAT[k].n + ' for ' + fmt(p * want) + '.', 'good');
      break;
    }
    case 'sell': {
      const have = Math.floor(G.cargo[k] || 0);
      const want = Math.min(n, have);
      if (want <= 0) break;
      const p = priceOf(k, sys);
      takeRes(k, want); G.credits += p * want; G.stat.sold += want;
      refreshTools(); AU.play('buy');
      say('Sold ' + want + ' ' + MAT[k].n + ' for ' + fmt(p * want) + '.', 'good');
      break;
    }
    case 'sellall': {
      let tot = 0, q = 0;
      for (const key in G.cargo) {
        if (MAT[key] && MAT[key].tool) continue;
        const amt = Math.floor(G.cargo[key]);
        if (amt <= 0) continue;
        tot += amt * priceOf(key, sys); q += amt; takeRes(key, amt);
      }
      G.credits += tot; G.stat.sold += q; refreshTools(); AU.play('buy');
      say(q ? 'Sold ' + fmtN(q) + ' units for ' + fmt(tot) + '. Tools kept.' : 'Nothing to sell.', q ? 'good' : 'warn');
      break;
    }
    case 'repair': {
      const s = ST(), cost = Math.round((s.hull - G.hull) * 90);
      if (cost <= 0 || G.credits < cost) break;
      G.credits -= cost; G.hull = s.hull; AU.play('upgrade');
      say('Hull restored to ' + s.hull + '.', 'good');
      break;
    }
    case 'buyfuel': {
      const cost = Math.round((maxFuel() - G.fuel) * 120);
      if (cost <= 0 || G.credits < cost) break;
      G.credits -= cost; G.fuel = maxFuel(); AU.play('buy');
      say('Warp cells filled.', 'good');
      break;
    }
    case 'shoreleave': {
      const cost = G.crew.length * 4000;
      if (!G.crew.length || G.credits < cost) break;
      G.credits -= cost;
      for (const c of G.crew) { c.hp = c.maxHp; c.morale = clamp(c.morale + 35, 0, 100); }
      AU.play('buy');
      say('The crew spent a night off the ship. Morale is up.', 'good');
      break;
    }
    case 'dump': {
      const have = Math.floor(G.cargo[k] || 0);
      const want = Math.min(n, have);
      if (want <= 0) break;
      takeRes(k, want); refreshTools();
      if (G.mode === 'surface' && planet) {
        const a = Math.random() * TAU, d = 40 + Math.random() * 30;
        piles.push({ x: P.x + Math.cos(a) * d, y: P.y + Math.sin(a) * d, k: k, n: want, t: 0 });
        if (piles.length > 40) piles.shift();
        say('Dropped ' + want + ' ' + MAT[k].n + ' on the ground. Walk over it to take it back.', 'warn');
      } else {
        say('Vented ' + want + ' ' + MAT[k].n + ' into space.', 'warn');
      }
      break;
    }
    case 'refuel': {
      if ((G.cargo[k] || 0) < 10) break;
      takeRes(k, 10);
      G.fuel = Math.min(maxFuel(), G.fuel + MAT[k].fuel * 10);
      AU.play('upgrade', 0.5);
      say('Refined into warp cells. ' + Math.floor(G.fuel) + ' / ' + maxFuel() + '.', 'good');
      break;
    }
    case 'use': {
      const m = MAT[k];
      if (!m || (G.cargo[k] || 0) < 1) break;
      takeRes(k, 1);
      if (m.heal) { G.suit.hp = Math.min(G.suit.max, G.suit.hp + m.heal); G.hull = Math.min(ST().hull, G.hull + m.heal * 0.5); screenFlash(true); say('Patched up.', 'good'); }
      else if (m.air) { G.suit.air = G.suit.airMax; say('Air supply replenished.', 'good'); }
      else if (m.food) { G.suit.hp = Math.min(G.suit.max, G.suit.hp + 12); for (const c of G.crew) c.morale = clamp(c.morale + 4, 0, 100); say('Ate a ' + m.n.toLowerCase() + '.', 'good'); }
      refreshTools();
      break;
    }
    case 'stashall': {
      const site = siteFor(planet.id), cap = colStats(site).store;
      let held = Object.keys(G.stash).reduce((s, key) => s + G.stash[key], 0);
      for (const key in G.cargo) {
        if (MAT[key] && MAT[key].tool) continue;
        const room = cap - held; if (room <= 0) break;
        const amt = Math.min(Math.floor(G.cargo[key]), room);
        if (amt <= 0) continue;
        takeRes(key, amt); G.stash[key] = (G.stash[key] || 0) + amt; held += amt;
      }
      refreshTools(); say('Cargo moved to the vault.', 'good');
      break;
    }
    case 'unstashall': {
      for (const key in G.stash) {
        const got = addRes(key, G.stash[key]);
        G.stash[key] -= got;
        if (G.stash[key] <= 0.001) delete G.stash[key];
      }
      say('Pulled what would fit out of the vault.', 'good');
      break;
    }
    case 'unstash': {
      const got = addRes(k, G.stash[k] || 0);
      G.stash[k] -= got; if (G.stash[k] <= 0.001) delete G.stash[k];
      break;
    }
    case 'shopbuy': {
      if (!activeShop) break;
      const def = SHOP_TYPES[activeShop.shop];
      const disc = clamp(1 - relOf(activeShop.id) / 400, 0.75, 1.1) * (def.markup || 1);
      const p = Math.round(priceOf(k, sys) * disc * 1.15);
      const want = Math.min(n, Math.floor(G.credits / p), cargoCap() - Math.floor(cargoUsed()));
      if (want <= 0) { say('No room or not enough units.', 'warn'); break; }
      G.credits -= p * want; addRes(k, want);
      relBump(activeShop.id, 1); repChange(activeShop.fac, 0.05);
      AU.play('buy');
      say('Bought ' + want + ' ' + MAT[k].n + '.', 'good');
      break;
    }
    case 'shopsell': {
      if (!activeShop) break;
      const have = Math.floor(G.cargo[k] || 0);
      const want = Math.min(n, have);
      if (want <= 0) break;
      const p = Math.round(priceOf(k, sys) * (relOf(activeShop.id) > 20 ? 1.1 : 0.92));
      takeRes(k, want); G.credits += p * want; G.stat.sold += want;
      relBump(activeShop.id, 1); refreshTools(); AU.play('buy');
      say('Sold ' + want + ' ' + MAT[k].n + ' for ' + fmt(p * want) + '.', 'good');
      break;
    }
    case 'swap': {
      if (G.owned.indexOf(k) < 0) break;
      G.ship = k;
      G.hull = Math.min(G.hull, ST().hull); G.shield = ST().shield;
      if (G.hull <= 0) G.hull = ST().hull;
      say('Now flying the ' + (G.shipNames[k] || SHIPS[k].n) + '.', 'good');
      break;
    }
    case 'rename': {
      const cur = G.shipNames[k] || SHIPS[k].n;
      const nm = window.prompt ? window.prompt('Name this ship', cur) : null;
      if (nm && nm.trim()) { G.shipNames[k] = nm.trim().slice(0, 32); say('Renamed to ' + G.shipNames[k] + '.', 'good'); }
      break;
    }
    case 'buyship': {
      const price = +n;
      if (G.credits < price || G.owned.indexOf(k) >= 0) break;
      G.credits -= price; G.owned.push(k);
      G.fit[k] = G.fit[k] || {}; G.paint[k] = G.paint[k] || SHIPS[k].col;
      G.shipNames[k] = G.shipNames[k] || shipName(rng((Math.random() * 1e9) | 0));
      G.ship = k; G.hull = ST().hull; G.shield = ST().shield;
      repChange(sys.faction, 0.3); AU.play('upgrade');
      say('Bought the ' + SHIPS[k].n + '.', 'rare');
      break;
    }
    case 'fitbuy': case 'fitmake': {
      const m = MODULES[k]; if (!m) break;
      const f = G.fit[G.ship] = G.fit[G.ship] || {};
      if (Object.keys(f).length >= moduleSlots() && !f[m.slot]) { say('No free slots on this hull. A heavier hull carries more.', 'warn'); break; }
      if (act === 'fitbuy') { if (G.credits < m.cr) break; G.credits -= m.cr; }
      else { 
        if (!hasAll(m.in)) { say('Not enough materials in the hold.', 'warn'); break; }
        if (G.credits < m.cr) { say('Not enough units.', 'warn'); break; }
        payAll(m.in); 
        G.credits -= m.cr;
        refreshTools(); 
      }
      const old = f[m.slot];
      f[m.slot] = k;
      G.hull = clamp(G.hull, 1, ST().hull);
      AU.play('upgrade');
      say(m.n + ' fitted' + (old ? ', replacing ' + MODULES[old].n : '') + '.', 'rare');
      break;
    }
    case 'unfit': {
      const f = G.fit[G.ship] || {};
      if (!f[k]) break;
      const m = MODULES[f[k]];
      delete f[k];
      G.credits += Math.round(m.cr * 0.4);
      G.hull = Math.min(G.hull, ST().hull);
      say(m.n + ' removed. Recovered ' + fmt(Math.round(m.cr * 0.4)) + ' in parts.', '');
      break;
    }
    case 'paint': G.paint[G.ship] = decodeURIComponent(k); say('Hull repainted.', ''); break;

    case 'partbuy': case 'partmake': {
      const pt = PARTS[k]; if (!pt) break;
      if (act === 'partbuy') {
        const price = +n;
        if (G.credits < price) { say('Not enough units.', 'warn'); break; }
        if (!hasAll(pt.in)) { say('Not enough materials in the hold for that part — check what it needs.', 'warn'); break; }
        G.credits -= price; payAll(pt.in); refreshTools();
      } else {
        if (!hasAll(pt.in)) { say('Not enough materials in the hold.', 'warn'); break; }
        payAll(pt.in); refreshTools();
      }
      G.ownedParts[k] = 1;
      fitPart(k);
      AU.play('upgrade');
      break;
    }
    case 'partfit': fitPart(k); break;

    case 'gunselect': {
      if (!SHIP_WEAPONS[k]) break;
      if (gunTierOwned(k) < 0) { say('Buy the first tier of that weapon before mounting it.', 'warn'); break; }
      G.shipGun = k;
      say(SHIP_WEAPONS[k].n + ' mounted.', 'good');
      AU.play('upgrade', 0.6);
      break;
    }
    case 'gunbuy': case 'gunmake': {
      const fam = SHIP_WEAPONS[k]; if (!fam) break;
      const nextTier = gunTierOwned(k) + 1;
      const tierDef = fam.tiers[nextTier]; if (!tierDef) break;
      if (act === 'gunbuy') {
        const price = +n;
        if (G.credits < price) { say('Not enough units.', 'warn'); break; }
        if (!hasAll(tierDef.in)) { say('Not enough materials in the hold for that build — check what it needs.', 'warn'); break; }
        G.credits -= price; payAll(tierDef.in); refreshTools();
      } else {
        if (!hasAll(tierDef.in)) { say('Not enough materials in the hold.', 'warn'); break; }
        payAll(tierDef.in); refreshTools();
      }
      G.shipWeapons = G.shipWeapons || {};
      G.shipWeapons[k] = nextTier;
      G.shipGun = k;
      say(tierDef.n + ' fitted and mounted.', 'rare');
      AU.play('upgrade');
      break;
    }

    case 'craft': {
      const r = RECIPES.find(x => x.o === k); if (!r) break;
      let made = 0;
      for (let i = 0; i < n; i++) {
        if (!hasAll(r.in)) break;
        if (cargoUsed() + r.n > cargoCap()) { say('Hold is full.', 'warn'); break; }
        payAll(r.in); addRes(r.o, r.n); made += r.n;
      }
      if (made) {
        G.stat.crafted += made; refreshTools(); AU.play('upgrade', 0.6);
        say('Fabricated ' + made + ' ' + MAT[k].n + '.', 'good');
        discover('craft:' + k, MAT[k].n, 'Fabrication', 'First one built. ' + costText(r.in).replace(/<[^>]+>/g, ''), 1500);
      } else say('Not enough materials.', 'warn');
      break;
    }
    case 'forgeA': G.forgeA = k; break;
    case 'forgeB': G.forgeB = k; break;
    case 'forge': {
      const a = G.forgeA, b = G.forgeB;
      if (!a || !b || a === b) break;
      if ((G.cargo[a] || 0) < 5 || (G.cargo[b] || 0) < 5) { say('Five units of each are needed.', 'warn'); break; }
      if (cargoUsed() - 10 + 3 > cargoCap()) { say('No room in the hold for the result.', 'warn'); break; }
      takeRes(a, 5); takeRes(b, 5);
      const key = makeAlloy(a, b);
      const fresh = !G.codex['alloy:' + key];
      const got = addRes(key, 3);
      G.alloysMade++; G.stat.crafted += got;
      AU.play('upgrade');
      say('Forged ' + got + ' ' + MAT[key].n + ' · worth ' + fmtN(MAT[key].v) + ' each.', 'rare');
      if (fresh) discover('alloy:' + key, MAT[key].n, 'Alloy', MAT[a].n + ' fused with ' + MAT[b].n + '. Grade ' + MAT[key].grade + ', tier ' + MAT[key].t + '.', 1200);
      refreshTools();
      break;
    }
    case 'claim': claimPlanet(); break;
    case 'district': if (planet) addDistrict(planet.id); break;
    case 'distup': if (planet) upgradeDistrict(planet.id, +n); break;
    case 'build': {
      const d = BUILDS[k]; if (!d || !planet) break;
      const site = d.personal ? ensureBase(planet.id, planet.name, planet.biome, planet.res) : G.colonies[planet.id];
      if (!site) { say('Claim this world first.', 'warn'); break; }
      const owned = site.build.filter(x => x.t === k).length;
      const cr = Math.round(d.cr * Math.pow(1.35, owned));
      const cost = d.in;
      if (G.credits < cr || !hasAll(cost)) { say('Cannot cover the cost.', 'warn'); break; }
      G.credits -= cr; payAll(cost); refreshTools();
      const a = Math.random() * TAU, dist = 220 + Math.random() * 300;
      site.build.push({ t: k, x: P.x + Math.cos(a) * dist, y: P.y + Math.sin(a) * dist, built: G.day });
      if (planet) syncDistricts(planet.id, true);
      G.stat.built++;
      AU.play('upgrade');
      say(d.n + ' built on ' + planet.name + '.', 'rare');
      if (d.plots) syncPlots(planet.id);
      break;
    }
    case 'collect': {
      const site = G.colonies[planet.id]; if (!site) break;
      const amt = Math.floor(site.stock[k] || 0);
      const got = addRes(k, amt);
      site.stock[k] -= got; if (site.stock[k] < 0.01) delete site.stock[k];
      say('Loaded ' + got + ' ' + MAT[k].n + ' from the colony store.', 'good');
      break;
    }

    case 'selseed': G.plantSel = (G.plantSel === k ? null : k); break;
    case 'plantall': {
      const f = syncPlots(planet.id);
      let done = 0;
      for (let i = 0; i < f.plots.length; i++) {
        if (f.plots[i].crop) continue;
        if ((G.cargo[k] || 0) < 1) break;
        plantSeed(planet.id, i, k); done++;
      }
      say(done ? 'Sowed ' + done + ' plots.' : 'No empty plots or no seeds left.', done ? 'good' : 'warn');
      break;
    }
    case 'plot': {
      const i = +n, f = syncPlots(planet.id), p = f.plots[i];
      if (!p) break;
      if (!p.crop) { if (G.plantSel) plantSeed(planet.id, i, G.plantSel); else say('Select a seed first.', 'warn'); }
      else if (p.stage >= CROPS[p.crop].days) harvestPlot(planet.id, i);
      else if (!p.watered) waterPlot(planet.id, i);
      else say(CROPS[p.crop].n + ' is watered and growing. ' + (CROPS[p.crop].days - p.stage) + ' cycles left.', '');
      break;
    }
    case 'waterall': waterAll(planet.id); break;
    case 'harvestall': harvestAll(planet.id); break;

    case 'healcrew': {
      const c = G.crew[+n];
      if (!c || (G.cargo.medkit || 0) < 1) break;
      takeRes('medkit', 1); c.hp = c.maxHp; c.morale = clamp(c.morale + 8, 0, 100);
      say(c.name + ' patched up.', 'good');
      break;
    }
    case 'firecrew': {
      const c = G.crew[+n]; if (!c) break;
      G.crew.splice(+n, 1);
      say(c.name + ' was discharged.', 'warn');
      break;
    }

    case 'turnin': { const q = G.quests.find(x => x.id === k); if (q) turnInQuest(q); break; }
    case 'abandon': { G.quests = G.quests.filter(x => x.id !== k); say('Contract dropped.', 'warn'); break; }
    case 'goto': {
      const pl = planetById(k);
      if (pl) { const c = pl.sys.split('|'); const s = systemAt(+c[0], +c[1]); if (s) { G.waypoint = { x: s.x, y: s.y, name: s.name }; say('Course set for ' + s.name + '.', 'good'); } }
      break;
    }

    case 'toggle': {
      G.set[k] = !G.set[k];
      AU.sync();
      if (k === 'music' && G.set.music) AU.startMusic();
      break;
    }
    case 'chartzoom': chartZoom = clamp(chartZoom * (+n > 0 ? 1.35 : 0.74), 0.25, 6); drawChart(); return;
    case 'chartrecentre': chartSel = null; chartHome(); drawChart(); return;
    case 'wparm': waypointArm = (waypointArm === k ? null : k); drawChart(); return;
    case 'wpclear': G.waypoints6 = {}; waypointArm = null; drawChart(); return;
    case 'opensettings': openPanel('settings'); return;
    case 'save': save(); break;
    case 'load': load(); break;
    case 'wipe': {
      try { localStorage.removeItem('aetherium2'); } catch (e) {}
      say('Save deleted. Refresh to start clean.', 'warn');
      break;
    }
    default: break;
  }
  refresh();
}

/* ------------------------------------------------------------
   34. TUTORIAL
   Roughly five minutes on a safe training world, then you are
   dropped into the real galaxy with everything reset.
------------------------------------------------------------ */
const TUT = [
  { t: 'Move 500 metres in any direction — W, A, S, D to fly, Shift to burn harder.',
    h: 'The ship drifts and turns like a real hull. Get clear of the wreck before anything else.',
    setup: () => { G.tutStart = { x: P.x, y: P.y }; },
    c: () => Math.hypot(P.x - G.tutStart.x, P.y - G.tutStart.y) > 500 },
  { t: 'Press I to open the cargo hold.',
    h: 'I opens your hold — everything you mine, grow, catch or craft lives here, and it is where raw fuel gets refined into warp cells. The quest finishes the moment you press it.',
    c: () => openId === 'cargo' },
  { t: 'Press G to open the Empire overview.',
    h: 'G opens the empire screen — every colony and base you own, their population, income and build queues, all in one place.',
    c: () => openId === 'empire' },
  { t: 'Mine some tritium.',
    h: 'Tritium is a fuel-grade element — find a deposit that reads tritium on the scanner and hold Space over it to cut it. You need at least 12 in the hold.',
    c: () => (G.cargo.tritium || 0) >= 12 },
  { t: 'Mine some ferrite dust.',
    h: 'Ferrite dust is the most common ore in the game — nearly every deposit carries some. You need at least 25 in the hold.',
    c: () => (G.cargo.ferrite || 0) >= 25 },
  { t: 'Use the parts and press R to repair the launch thrusters.',
    h: 'With 25 ferrite dust and 12 tritium in the hold, press R. The thrusters were torn out in the crash — nothing flies without them, and every time you die they break again and this has to happen over.',
    c: () => G.thrustersFixed },
  { t: 'Refine 10 tritium into warp cells, from the cargo screen (I).',
    h: 'Fixing the thrusters does not fill the tank. Open the hold (I), find tritium, and use the refine action — 10 tritium becomes a stack of warp cells. You need fuel in the tank before you can launch.',
    setup: () => { G.tutFuelBase = G.fuel; },
    c: () => G.fuel > G.tutFuelBase },
  { t: 'Press L to break atmosphere.',
    h: 'L launches from the surface, straight up into orbit. It costs a handful of warp cells every time.',
    c: () => G.mode === 'system' },
  { t: () => 'Land back on ' + (homeWorldName() || 'the planet below') + '.',
    h: 'Point the nose down and fly into the planet slower than about 150 m/s. Watch the descent readout on the right — too fast and you punch a hole in your own hull.',
    c: () => G.mode === 'surface' },
  { t: 'Press F to scan nearby flora and fauna.',
    h: 'F runs a scan wherever you are — creatures and plants on a surface, ships and stations in orbit, whole systems in deep space. Every first sighting logs to the codex and pays out credits.',
    setup: () => { G.tutScans = G.stat.scans; },
    c: () => G.stat.scans > G.tutScans || G.codexN > 0 },
  { t: 'Press E to leave the ship, then fire your weapon with Space.',
    h: 'E steps you outside on foot. Space fires whatever is in your hands — even bare fists count.',
    setup: () => { G.tutGunT = G.t; },
    c: () => G.onFoot && (G.t - (G.tutGunT || 0) > 0.4) },
  { t: 'Claim this planet — press X once you have enough resources.',
    h: 'X claims the world you are standing on for your own empire, once you can cover the claim cost. Check the prompt in the corner for what is needed.',
    c: () => !!G.colonies[planet && planet.id] },
  { t: 'Build a housing unit and set up a perimeter wall.',
    h: 'Open construction (B) on your new colony and put down a Habitation dome and a Perimeter wall. The dome houses colonists; the wall keeps raiders from just walking in.',
    c: () => { for (const k in G.colonies) { const b = G.colonies[k].build.map(x => x.t); if (b.indexOf('habitat') >= 0 && b.indexOf('wall') >= 0) return true; } return false; } },
  { t: 'Trade at a trading station.',
    h: 'Fly to a station (the scanner marks them) and dock. The trade terminal buys and sells everything in your hold at that system\u2019s prices.',
    setup: () => { G.tutSold = G.stat.sold; },
    c: () => G.stat.sold > G.tutSold },
  { t: 'Buy a power unit to power the house.',
    h: 'A Habitation dome and most other buildings draw power. Put down a Solar array on the same colony to keep the lights on.',
    c: () => { for (const k in G.colonies) { const b = G.colonies[k].build.map(x => x.t); if (b.indexOf('solar') >= 0) return true; } return false; } },
  { t: 'Colonize another planet.',
    h: 'Fly to a second world — any system will do — and claim it the same way: land, meet the cost, press X.',
    c: () => Object.keys(G.colonies).length >= 2 },
  { t: 'Kill 5 enemy ships.',
    h: 'Pirates and hostile patrols show up in most systems. Engage with Space and finish them off — 5 kills clears this step.',
    setup: () => { G.tutKills = G.stat.kills; },
    c: () => G.stat.kills - (G.tutKills || 0) >= 5 },
  { t: 'Craft an upgrade to upgrade the ship.',
    h: 'Open the hangar (H) or refit (U) and either buy or build a part or weapon upgrade — anything that fits and materials cover.',
    setup: () => { G.tutUpg = Object.keys(G.ownedParts).length + Object.values(G.shipWeapons).reduce((a, b) => a + b + 1, 0); },
    c: () => (Object.keys(G.ownedParts).length + Object.values(G.shipWeapons).reduce((a, b) => a + b + 1, 0)) > (G.tutUpg || 0) },
  { t: 'Grow your empire\u2019s population to 500.',
    h: 'Population climbs on its own once a colony has housing, food and power — a Hydroponics bay speeds it up considerably. Check the total on the empire screen (G).',
    c: () => empirePop() >= 500 },
  { t: 'Craft something in the fabricator.',
    h: 'Press K to open the fabricator. It turns raw material into parts, tools, seeds and components — pick anything you can afford and build it.',
    setup: () => { G.tutCraft2 = G.stat.crafted; },
    c: () => G.stat.crafted > (G.tutCraft2 || 0) },
  { t: 'Get someone to work on your ship.',
    h: 'Talk to an NPC at a settlement and hire them on — a crew member adds a passive bonus and needs feeding and paying every cycle.',
    c: () => G.crew.length > 0 },
  { t: 'Finish the tutorial.',
    h: 'That is the whole loop: mine, craft, fly, land, claim, build, trade, fight, crew up. Finishing wipes this run and drops you into a fresh save — the real game, starting from the same broken ship. Press Skip training below when you are ready.',
    setup: () => { G.tutFinishAt = G.t + 4; },
    c: () => G.t > (G.tutFinishAt || 0) }
];
function startTutorial() {
  G.tutorial = true; G.tutStep = 0;
  /* the tutorial starts exactly like a real new game — broken thrusters,
     no fuel, no shortcuts — because everything it teaches has to still be
     true the moment it hands you off to your first real save */
  G.credits = 1200; G.cargo = {}; G.mined = {}; G.minedN = 0;
  G.ship = 'vagrant'; G.owned = ['vagrant']; G.fit = { vagrant: {} };
  G.paint = { vagrant: '#9fb3c8' }; G.shipNames = { vagrant: 'The Last Errand' };
  G.maxFuelBase = 100; G.fuel = 0;
  G.suit = { hp: 100, max: 100, air: 100, airMax: 100, bonus: 0 };
  G.suitKey = 'standard'; syncSuit();
  G.crew = []; G.colonies = {}; G.bases = {}; G.farms = {}; G.stash = {};
  G.codex = {}; G.codexN = 0; G.quests = []; G.questDone = 0;
  G.relations = {}; G.knownNpcs = {}; G.waypoint = null; G.waypoints6 = {};
  G.thrustersFixed = false; G.deaths = 0; G.crashes = 0; G.objIdx = 0;
  G.tools = {}; G.alloysMade = 0; G.day = 1; G.dayT = 0.32; G.over = false;
  G.parts = Object.assign({}, DEFAULT_PARTS); G.ownedParts = {};
  G.gun = 'fists'; G.gunHeat = 0;
  G.shipGun = 'bullet'; G.shipWeapons = { bullet: 0 };
  G.laserCharge = 3; G.laserRecharging = false; G.lastAttacker = null; G.hyperwarp = false;
  G.civRel = {}; G.civState = {}; G.talkCd = {}; G.talkGain = {};
  G.trackMain = {}; G.trackSide = {}; G.mainDone = {}; G.citadels = {}; G.bounty = 0;
  shots = []; piles = [];
  G.encTimer = 45; G.raidTimer = 420;
  G.stat = { mined: 0, jumps: 0, scans: 0, kills: 0, sold: 0, peak: 0, harvest: 0, caught: 0, crafted: 0,
    talked: 0, docked: false, landed: 0, built: 0, footTime: 0,
    groundKills: 0, monoliths: 0, motherKills: 0, cityKills: 0, razed: 0 };
  for (const f of FACTION_KEYS) G.rep[f] = 0;
  setSystem('train');
  landOn(TRAINING_PLANET, true);
  G.homeId = TRAINING_PLANET.id;
  G.hull = ST().hull; G.shield = ST().shield;
  cam.x = P.x; cam.y = P.y; cam.z = 1;
  $('objective').classList.add('hidden');
  $('tutband').classList.remove('hidden');
  tutEnter();
  say('Training flight on the Cadet Field range. Nothing here can actually hurt you — use that.', 'good');
}
function tutEnter() {
  const s = TUT[G.tutStep];
  if (!s) return;
  if (s.setup) s.setup();
  $('tb-step').textContent = 'Step ' + (G.tutStep + 1) + ' / ' + TUT.length;
  $('tb-text').textContent = typeof s.t === 'function' ? s.t() : s.t;
  $('tb-hint').textContent = s.h;
}
function tutTick() {
  if (!G.tutorial) return;
  const s = TUT[G.tutStep];
  if (!s) return;
  if (s.c()) {
    G.tutStep++;
    if (G.tutStep >= TUT.length) { endTutorial(true); return; }
    AU.play('upgrade', 0.5);
    tutEnter();
  }
}
function endTutorial(finished) {
  G.tutorial = false;
  $('tutband').classList.add('hidden');
  $('objective').classList.remove('hidden');
  if (finished) {
    showEvent('training complete', 'That is the whole of it',
      'Mine, craft, fly, land, claim, build, trade, fight, crew up. Everything else is a variation on those. ' +
      'Your record is wiped and you are put down where every pilot starts: a dead world called Verges IV, with a broken ship and no money. ' +
      'Good luck out there.',
      [{ l: 'Drop me into the galaxy', f: () => newGame() }]);
  } else newGame();
}

/* ------------------------------------------------------------
   35. SAVE / LOAD
------------------------------------------------------------ */
const SAVE_KEY = 'aetherium2';
const SAVE_FIELDS = ['credits','cargo','mined','minedN','ship','owned','fit','paint','shipNames','hull','shield','fuel',
  'maxFuelBase','suit','crew','colonies','bases','farms','stash','codex','codexN','quests','questDone','rep','relations',
  'knownNpcs','waypoint','waypoints6','thrustersFixed','deaths','crashes','objIdx','tools','alloysMade','day','dayT','mode','onFoot','stat','set','sysKey','planetId',
  'parts','ownedParts','gun','civRel','civState','talkCd','talkGain','trackMain','trackSide','mainDone','citadels','bounty',
  'homeId','suitKey','ownedSuits','shipGun','shipWeapons'];
function save(quiet) {
  try {
    const o = {};
    for (const f of SAVE_FIELDS) o[f] = G[f];
    o.px = P.x; o.py = P.y; o.pang = P.ang;
    o.alloyDefs = {};
    for (const k in MAT) if (MAT[k].cat === 'alloy') o.alloyDefs[k] = MAT[k];
    o.v = 2;
    localStorage.setItem(SAVE_KEY, JSON.stringify(o));
    if (!quiet) say('Saved to this browser.', 'good');
    return true;
  } catch (e) { if (!quiet) say('Could not save — browser storage is unavailable.', 'bad'); return false; }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { say('No save found.', 'warn'); return false; }
    const o = JSON.parse(raw);
    for (const f of SAVE_FIELDS) if (o[f] !== undefined) G[f] = o[f];
    G.set = Object.assign({}, DEFAULT_SET, G.set || {});
    /* saves written before the parts refit have none of this */
    G.parts = Object.assign({}, DEFAULT_PARTS, G.parts || {});
    G.ownedParts = G.ownedParts || {};
    G.gun = G.gun && GUNS[G.gun] ? G.gun : 'fists';
    G.shipWeapons = G.shipWeapons && Object.keys(G.shipWeapons).length ? G.shipWeapons : { bullet: 0 };
    G.shipGun = (G.shipGun && SHIP_WEAPONS[G.shipGun] && gunTierOwned(G.shipGun) >= 0) ? G.shipGun : 'bullet';
    G.civRel = G.civRel || {}; G.civState = G.civState || {};
    G.talkCd = {}; G.talkGain = {};
    G.trackMain = G.trackMain || {}; G.trackSide = G.trackSide || {};
    G.mainDone = G.mainDone || {}; G.citadels = G.citadels || {};
    G.bounty = G.bounty || 0; G.gunHeat = 0;
    G.suit = Object.assign({ hp: 100, max: 100, air: 100, airMax: 100, bonus: 0 }, G.suit || {});
    G.suitKey = SUITS[G.suitKey] ? G.suitKey : 'standard';
    syncSuit();
    for (const k in G.colonies) if (!G.colonies[k].districts) G.colonies[k].districts = [];
    for (const f of FACTION_KEYS) if (G.rep[f] === undefined) G.rep[f] = 0;
    if (o.alloyDefs) for (const k in o.alloyDefs) MAT[k] = o.alloyDefs[k];
    G.tutorial = false; G.over = false;
    G.homeId = G.homeId || '0|0:0';
    setSystem(G.sysKey || '0|0');
    if (!sys) { setSystem('0|0'); }
    if (G.mode === 'surface') {
      const pl = planetById(G.planetId);
      if (pl) { planet = pl; surfCache = new Map(); if (!pl.weatherNow) pl.weatherNow = pl.weather[0]; }
      else { G.mode = 'system'; planet = null; }
    }
    P.x = o.px || 0; P.y = o.py || 0; P.vx = 0; P.vy = 0; P.ang = o.pang || 0;
    cam.x = P.x; cam.y = P.y;
    G.onFoot = false; shipAnchor = null;
    hostiles = []; neutrals = []; bullets = [];
    if (G.mode === 'system') spawnTraffic(sys);
    refreshTools(); AU.sync();
    $('title').classList.add('hidden'); $('hud').classList.remove('hidden');
    G.started = true;
    closePanel();
    say('Save loaded. Cycle ' + G.day + '.', 'good');
    return true;
  } catch (e) { say('Save file could not be read.', 'bad'); return false; }
}

/* ------------------------------------------------------------
   36. NEW GAME
------------------------------------------------------------ */
function newGame() {
  const keepSet = G.set;
  G.credits = 1200; G.cargo = {}; G.mined = {}; G.minedN = 0;
  G.ship = 'vagrant'; G.owned = ['vagrant']; G.fit = { vagrant: {} };
  G.paint = { vagrant: '#9fb3c8' }; G.shipNames = { vagrant: 'The Last Errand' };
  G.maxFuelBase = 100; G.fuel = 0;
  G.suit = { hp: 100, max: 100, air: 100, airMax: 100, bonus: 0 };
  G.suitKey = 'standard'; syncSuit();
  G.crew = []; G.colonies = {}; G.bases = {}; G.farms = {}; G.stash = {};
  G.codex = {}; G.codexN = 0; G.quests = []; G.questDone = 0;
  G.relations = {}; G.knownNpcs = {}; G.waypoint = null; G.waypoints6 = {};
  G.thrustersFixed = false; G.deaths = 0; G.crashes = 0; G.objIdx = 0;
  G.tools = {}; G.alloysMade = 0; G.day = 1; G.dayT = 0.32; G.over = false; G.tutorial = false;
  G.parts = Object.assign({}, DEFAULT_PARTS); G.ownedParts = {};
  G.gun = 'fists'; G.gunHeat = 0;
  G.shipGun = 'bullet'; G.shipWeapons = { bullet: 0 };
  G.laserCharge = 3; G.laserRecharging = false; G.lastAttacker = null;
  G.civRel = {}; G.civState = {}; G.talkCd = {}; G.talkGain = {};
  G.trackMain = {}; G.trackSide = {}; G.mainDone = {}; G.citadels = {}; G.bounty = 0;
  shots = []; piles = [];
  G.encTimer = 45; G.raidTimer = 420;
  G.stat = { mined: 0, jumps: 0, scans: 0, kills: 0, sold: 0, peak: 0, harvest: 0, caught: 0, crafted: 0,
    talked: 0, docked: false, landed: 0, built: 0, footTime: 0,
    groundKills: 0, monoliths: 0, motherKills: 0, cityKills: 0, razed: 0 };
  for (const f of FACTION_KEYS) G.rep[f] = 0;
  G.set = keepSet;
  sysCache.delete('0|0');
  setSystem('0|0');
  const home = sys.planets[0];
  G.homeId = home.id;
  landOn(home, true);
  G.hull = ST().hull; G.shield = ST().shield;
  cam.x = P.x; cam.y = P.y; cam.z = 1;
  $('tutband').classList.add('hidden');
  $('title').classList.add('hidden'); $('hud').classList.remove('hidden');
  G.started = true;
  closePanel();
  say('Emergency landing on Verges IV. Hull intact, thrusters gone.', 'warn');
  say('Hold Space near a deposit to mine. You need 25 ferrite and 12 tritium.', '');
}

/* ------------------------------------------------------------
   37. MAIN LOOP
------------------------------------------------------------ */
let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  if (!G.started) return;

  const busy = modalOpen || openId || talkOpen || !!fishing;
  G.t += dt;
  /* never let an invalid state reach the surface code paths */
  if (G.mode === 'surface' && !planet) { G.mode = sys ? 'system' : 'galaxy'; G.onFoot = false; shipAnchor = null; }
  if (G.mode === 'system' && !sys) setSystem('0|0');

  /* runs every frame regardless of open panels — several steps (open the
     cargo hold, open the empire screen) only become true the instant a
     panel opens, which is exactly when the sim would otherwise stop
     calling this */
  tutTick();

  if (!busy && !G.over) {
    if (G.mode === 'surface') updSurface(dt);
    else if (G.mode === 'system') updSystem(dt);
    else updGalaxy(dt);
    if (G.onFoot) G.stat.footTime = (G.stat.footTime || 0) + dt;
    economyTick(dt);
    raidCheck(dt);
    objCheck();
    hotkeys();
    scuttleTick(dt);
  } else if (fishing) {
    updFishing(dt);
  } else if (busy) {
    if (tap('Escape')) { if (talkOpen) closeTalk(); else if (openId) closePanel(); }
    scuttleT = 0;
    const scEl = $('scuttle'); if (scEl) scEl.classList.add('hidden');
  }

  cam.shake *= Math.pow(0.0015, dt);
  for (const p of parts) { p.l += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; }
  parts = parts.filter(p => p.l < p.m);
  if (parts.length > 900) parts.splice(0, parts.length - 900);
  for (const f of floaters) f.t += dt;
  floaters = floaters.filter(f => f.t < f.m);

  if (G.mode === 'surface' && planet) renderSurface();
  else if (G.mode === 'system' && sys) renderSystem();
  else renderGalaxy();
  beams.length = 0;
  renderScanner();
  renderHUD(dt);
}

/* Holding the scuttle key for a full five seconds writes the ship off on
   purpose. It costs exactly what dying costs — a fifth of your units and the
   whole hold — but it gets you off a rock or out of a well you cannot climb. */
let scuttleT = 0;
const SCUTTLE_HOLD = 5;
function scuttleTick(dt) {
  const el = $('scuttle');
  if (!el) return;
  const held = down('KeyZ') && !G.over && G.started && !G.tutorial;
  if (held) scuttleT = Math.min(SCUTTLE_HOLD, scuttleT + dt);
  else scuttleT = Math.max(0, scuttleT - dt * 3.5);

  if (scuttleT <= 0.001) { if (!el.classList.contains('hidden')) el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const k = clamp(scuttleT / SCUTTLE_HOLD, 0, 1);
  const ring = $('sc-ring');
  if (ring) {
    const C = 2 * Math.PI * 78;
    ring.style.strokeDasharray = C;
    ring.style.strokeDashoffset = C * (1 - k);
  }
  const num = $('sc-num');
  if (num) num.textContent = Math.max(0, Math.ceil(SCUTTLE_HOLD - scuttleT));
  el.classList.toggle('imminent', k > 0.8);

  if (scuttleT >= SCUTTLE_HOLD && held) {
    scuttleT = 0;
    el.classList.add('hidden');
    G.shield = 0; G.hull = 0;
    boom(P.x, P.y, 70, '#ff6a4d', 340);
    if (!G.over) death('a deliberate scuttle');
  }
}

function hotkeys() {
  if (tap('KeyY')) openPanel('gear');
  else if (tap('KeyM')) openPanel('chart');
  else if (tap('KeyI')) openPanel('cargo');
  else if (tap('KeyC')) openPanel('codex');
  else if (tap('KeyG')) openPanel('empire');
  else if (tap('KeyB')) { if (G.mode === 'surface') openPanel('build'); else say('Construction needs solid ground.', 'warn'); }
  else if (tap('KeyH')) openPanel('hangar');
  else if (tap('KeyU')) openPanel('refit');
  else if (tap('KeyK')) openPanel('craft');
  else if (tap('KeyJ') || tap('KeyQ')) openPanel('quests');
  else if (tap('KeyN')) openPanel('crew');
  else if (tap('KeyT')) { if (G.docked) openPanel('market'); else say('Dock at a station to trade.', 'warn'); }
  else if (tap('Escape')) openPanel('pause');
}

/* ------------------------------------------------------------
   38. BOOT
------------------------------------------------------------ */
(function boot() {
  /* prime a system so nothing renders against null before the first frame */
  setSystem('0|0');
  planet = sys.planets[0];
  G.planetId = planet.id;
  cam.x = 0; cam.y = 0;

  const digits = ['4','7','2','9','1','8','3','6','5'];
  const bigNum = Array.from({ length: 19 }, (_, i) => digits[(i * 5 + 3) % 9]).join('');
  $('gal-stat').innerHTML =
    'addressable systems <b>' + bigNum.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '</b><br>' +
    'each with up to seven worlds, their own weather, wildlife, people and prices<br>' +
    'base materials <b>' + MAT_KEYS.length + '</b> · craftable alloy combinations <b>' +
    fmtN(MAT_KEYS.filter(k => MAT[k].cat !== 'alloy').length * (MAT_KEYS.filter(k => MAT[k].cat !== 'alloy').length - 1) / 2) + '</b> · ' +
    'recipes <b>' + RECIPES.length + '</b> · structures <b>' + BUILD_KEYS.length + '</b> · ship modules <b>' + MODULE_KEYS.length + '</b><br>' +
    'nothing is stored on a server — the galaxy is rebuilt from its seed every time you look at it';

  if (hasSave()) $('btn-continue').classList.remove('hidden');

  let audioReady = false;
  const wakeAudio = () => {
    if (audioReady) return;
    audioReady = true;
    AU.startMusic();
  };
  /* load and try to play straight away rather than waiting for a menu
     click — if the browser blocks it, armGesture picks up the first input */
  AU.init();
  AU.watchMusic();
  AU.startMusic();
  AU.armGesture();

  $('btn-start').onclick = () => { wakeAudio(); newGame(); };
  $('btn-tutorial').onclick = () => { wakeAudio(); $('title').classList.add('hidden'); $('hud').classList.remove('hidden'); G.started = true; startTutorial(); };
  $('btn-continue').onclick = () => { wakeAudio(); if (!load()) newGame(); };
  $('btn-settings').onclick = () => {
    wakeAudio(); fromTitle = true;
    $('title').classList.add('hidden');
    overlay.style.zIndex = '60';
    openPanel('settings');
  };
  $('tb-skip').onclick = () => endTutorial(false);

  setInterval(() => { if (G.started && G.set.autosave && !G.over) save(true); }, 60000);

  requestAnimationFrame(frame);
})();

})();
