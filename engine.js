// RAGEBAIT 3 â€” Engine v3
// ============================================================
// CONSTANTS
// ============================================================
const TILE = 20;
const CW = 800, CH = 450;
const PW = 10, PH = 10;

// Collision model:
// Every tile is a FULL solid block (not just a slab).
// Platforms are drawn as thick slabs but their hitbox is the
// FULL tile cell. This eliminates all fall-through bugs.
// Spikes (type 2) sit ON TOP of a platform tile â€” they are
// placed in the tile row ABOVE the platform and kill on touch.

// ============================================================
// LEVEL SELECT
// ============================================================
let currentLevelIndex = 0;

function updateLevelSelectCard() {
  const def = LEVEL_DEFS[currentLevelIndex];
  const ld  = save.levels[def.id];
  const ts  = totalStars();
  const locked = def.lockStars > 0 && ts < def.lockStars;

  document.getElementById('ls-level-num').textContent  = 'LEVEL ' + def.id;
  document.getElementById('ls-level-name').textContent = def.name;
  const diffEl = document.getElementById('ls-difficulty');
  diffEl.textContent = def.difficulty;
  diffEl.style.color = def.diffColor;

  for (let i = 0; i < 3; i++) {
    const el = document.getElementById('ls-star-' + i);
    el.textContent = ld.stars[i] ? 'â­' : 'â˜†';
    el.style.color  = ld.stars[i] ? '#ffcc00' : '#334466';
  }
  document.getElementById('ls-deaths').textContent = 'DEATHS: ' + ld.deaths;
  document.getElementById('ls-time').textContent   = 'BEST: ' + (ld.bestTime !== null ? fmtTime(ld.bestTime) : '--:--.--');

  const lockMsg = document.getElementById('ls-lock-msg');
  const playBtn = document.getElementById('ls-play-btn');
  if (locked) {
    lockMsg.style.display = 'block';
    lockMsg.textContent   = 'ðŸ”’ Need ' + def.lockStars + ' â­ (have ' + ts + ')';
    playBtn.disabled      = true;
    playBtn.style.opacity = '0.4';
  } else {
    lockMsg.style.display = 'none';
    playBtn.disabled      = false;
    playBtn.style.opacity = '1';
  }
  document.getElementById('ls-stars-display').textContent = 'â­ ' + ts;
  document.getElementById('ls-prev').disabled = currentLevelIndex === 0;
  document.getElementById('ls-next').disabled = currentLevelIndex === LEVEL_DEFS.length - 1;
}

document.getElementById('ls-prev').addEventListener('click', () => {
  playClick();
  if (currentLevelIndex > 0) { currentLevelIndex--; updateLevelSelectCard(); }
});
document.getElementById('ls-next').addEventListener('click', () => {
  playClick();
  if (currentLevelIndex < LEVEL_DEFS.length - 1) { currentLevelIndex++; updateLevelSelectCard(); }
});
document.getElementById('ls-play-btn').addEventListener('click', () => {
  playClick();
  startLevel(LEVEL_DEFS[currentLevelIndex]);
});

function fmtTime(ms) {
  const m  = Math.floor(ms / 60000);
  const s  = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0') + '.' + String(cs).padStart(2,'0');
}

// ============================================================
// TILE MAP
// ============================================================
function buildTileMap(def) {
  const W = def.mapW, H = def.mapH;
  const m = [];
  for (let y = 0; y < H; y++) m.push(new Uint8Array(W));
  for (const p of def.platforms) {
    const w = p.w || 1;
    for (let i = 0; i < w; i++) {
      const tx = p.x + i, ty = p.y;
      if (tx >= 0 && tx < W && ty >= 0 && ty < H)
        m[ty][tx] = p.type !== undefined ? p.type : 1;
    }
  }
  return m;
}

function getTile(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= gMapW || ty >= gMapH) return 0;
  const raw = gMap[ty][tx];
  if (raw === 3) {
    const key = tx + ',' + ty;
    if (breakStates[key] && breakStates[key].state === 'broken') return 0;
  }
  return raw;
}

// A tile is solid (blocks movement) if it's a platform type
function isSolid(tx, ty) {
  const t = getTile(tx, ty);
  return t === 1 || t === 3 || t === 4 || t === 7;
}

// Kill on touch
function isKill(tx, ty) {
  return getTile(tx, ty) === 2;
}

// ============================================================
// MOVING PLATFORMS
// ============================================================
let movingPlatforms = [];

function buildMovingPlatforms(def) {
  movingPlatforms = [];
  if (!def.moving) return;
  for (const mp of def.moving) {
    movingPlatforms.push({
      x:      mp.x * TILE,
      y:      mp.y * TILE,
      w:      (mp.w || 3) * TILE,
      h:      TILE,
      type:   mp.type || 1,
      axis:   mp.axis || 'h',
      range:  (mp.range || 4) * TILE,
      speed:  mp.speed || 1.2,
      _dir:   1,
      _originX: mp.x * TILE,
      _originY: mp.y * TILE,
      _offset:  0,
    });
  }
}

function updateMovingPlatforms(dt) {
  for (const mp of movingPlatforms) {
    const move = mp.speed * (dt / 16);
    mp._offset += move * mp._dir;
    if (Math.abs(mp._offset) >= mp.range) {
      mp._dir   *= -1;
      mp._offset = mp._dir * mp.range;
    }
    if (mp.axis === 'h') {
      mp.x = mp._originX + mp._offset;
    } else {
      mp.y = mp._originY + mp._offset;
    }
  }
}

// Returns the moving platform the player is standing on, or null
function getMovingPlatformBelow() {
  for (const mp of movingPlatforms) {
    // Player bottom must be just above the top of the moving platform
    const mpTop = mp.y;
    if (px + PW > mp.x && px < mp.x + mp.w) {
      if (py + PH >= mpTop - 1 && py + PH <= mpTop + 6) {
        return mp;
      }
    }
  }
  return null;
}

// ============================================================
// GAME STATE
// ============================================================
let gRunning = false;
let gRaf     = null;
let gDef     = null;
let gMap     = null;
let gMapW    = 0, gMapH = 0;

let px, py, pvx, pvy;
let pOnGround, pOnWallL, pOnWallR, pOnIce;
let pCoyote, pJumpBuffer;
let pJumpHeld;          // is jump key currently held
let pJumpConsumed;      // did we already jump from this press
let pDoubleJump;
let pHasStarCoin;
let pAlive;
let pColor;
let pOnMoving = null;

let sessionDeaths   = 0;
let sessionStartTime = 0;
let sessionElapsed  = 0;
let attemptDeaths   = 0;

let breakStates  = {};
let turretTimers = {};
let orbUsed      = {};
let bullets      = [];
let particles    = [];
let levelMusic   = null;

const bgImgs = {};
function getBgImg(src) {
  if (!bgImgs[src]) {
    const img = new Image();
    img.src = src;
    bgImgs[src] = img;
  }
  return bgImgs[src];
}

const gCanvas = document.getElementById('game-canvas');
const gCtx    = gCanvas.getContext('2d');

// ============================================================
// FULLSCREEN LAYOUT
// ============================================================
function doLayout() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const HUD_H = 32; // fixed HUD bar height
  const availH = vh - HUD_H;
  const ratio = CW / CH; // 800/450
  let w = vw, h = vw / ratio;
  if (h > availH) { h = availH; w = h * ratio; }
  gCanvas.style.width    = w + 'px';
  gCanvas.style.height   = h + 'px';
  gCanvas.style.position = 'absolute';
  gCanvas.style.left     = Math.round((vw - w) / 2) + 'px';
  gCanvas.style.top      = HUD_H + 'px';
}
window.addEventListener('resize', doLayout);
doLayout();

// ============================================================
// LEVEL MUSIC
// ============================================================
function startLevelMusic(id) {
  stopLevelMusic();
  // Only play if the file likely exists (levels 1-8)
  if (id >= 1 && id <= 8) {
    levelMusic = new Audio('ragebait 3_' + id + '.mp3');
    levelMusic.loop   = true;
    levelMusic.volume = 0.4;
    levelMusic.play().catch(() => {});
  }
}
function stopLevelMusic() {
  if (levelMusic) { levelMusic.pause(); levelMusic.currentTime = 0; levelMusic = null; }
}

// ============================================================
// START / LEAVE LEVEL
// ============================================================
function startLevel(def) {
  gDef  = def;
  gMap  = buildTileMap(def);
  gMapW = def.mapW;
  gMapH = def.mapH;

  breakStates  = {};
  turretTimers = {};
  orbUsed      = {};
  bullets      = [];
  particles    = [];

  sessionDeaths    = 0;
  attemptDeaths    = 0;
  sessionStartTime = performance.now();
  sessionElapsed   = 0;

  buildMovingPlatforms(def);
  spawnPlayer();

  stopBgMusic();
  startLevelMusic(def.id);

  showScreen('game');
  gRunning = true;
  if (gRaf) cancelAnimationFrame(gRaf);
  gLastTs = 0;
  gRaf = requestAnimationFrame(gameLoop);
}

function leaveGame() {
  gRunning = false;
  if (gRaf) { cancelAnimationFrame(gRaf); gRaf = null; }
  stopLevelMusic();
  ensureMusicPlaying();
  currentLevelIndex = Math.max(0, LEVEL_DEFS.findIndex(d => d.id === (gDef ? gDef.id : 1)));
  updateLevelSelectCard();
  showScreen('levelselect');
}

function spawnPlayer() {
  // Find first solid platform and spawn above it
  let spawnX = 2 * TILE, spawnY = 10 * TILE;
  for (const p of gDef.platforms) {
    if (p.type === 1 || p.type === 3 || p.type === 4) {
      spawnX = p.x * TILE + Math.floor((p.w || 1) / 2) * TILE;
      spawnY = p.y * TILE - PH - 1;
      break;
    }
  }
  px = spawnX; py = spawnY;
  pvx = 0; pvy = 0;
  pOnGround = false; pOnWallL = false; pOnWallR = false; pOnIce = false;
  pCoyote = 0; pJumpBuffer = 0;
  pJumpHeld = false; pJumpConsumed = false;
  pDoubleJump  = false;
  pHasStarCoin = false;
  pAlive       = true;
  pOnMoving    = null;
  orbUsed      = {};
  bullets      = [];
  const col = COLORS.find(c => c.id === save.equippedColor);
  pColor = col ? col.hex : '#ffffff';
}

function respawnPlayer() {
  // Reset only player state â€” NOT the tile map, NOT breakStates
  // Moving platforms keep their current position (don't rebuild)
  pHasStarCoin = false;
  // Reset orb used states so orbs are available again after death
  orbUsed = {};
  bullets = [];

  let spawnX = 2 * TILE, spawnY = 10 * TILE;
  for (const p of gDef.platforms) {
    if (p.type === 1 || p.type === 3 || p.type === 4) {
      spawnX = p.x * TILE + Math.floor((p.w || 1) / 2) * TILE;
      spawnY = p.y * TILE - PH - 1;
      break;
    }
  }
  px = spawnX; py = spawnY;
  pvx = 0; pvy = 0;
  pOnGround = false; pOnWallL = false; pOnWallR = false; pOnIce = false;
  pCoyote = 0; pJumpBuffer = 0;
  pJumpHeld = false; pJumpConsumed = false;
  pDoubleJump = false;
  pAlive = true;
  pOnMoving = null;
  const col = COLORS.find(c => c.id === save.equippedColor);
  pColor = col ? col.hex : '#ffffff';

  hideOverlay('overlay-death');
}

// ============================================================
// GAME LOOP
// ============================================================
let gLastTs = 0;

function gameLoop(ts) {
  if (!gRunning) return;
  const dt = Math.min(ts - gLastTs, 50);
  gLastTs = ts;
  sessionElapsed = ts - sessionStartTime;
  update(dt);
  render();
  updateHUD();
  gRaf = requestAnimationFrame(gameLoop);
}

// ============================================================
// INPUT
// ============================================================
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))
    e.preventDefault();
  if (document.getElementById('overlay-death').classList.contains('active')) {
    respawnPlayer(); return;
  }
  if (e.code === 'Escape' && gRunning) leaveGame();
});
document.addEventListener('keyup', e => {
  keys[e.code] = false;
  // When jump key released, allow next jump press
  if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
    pJumpConsumed = false;
  }
});
document.getElementById('overlay-death').addEventListener('click', () => {
  if (document.getElementById('overlay-death').classList.contains('active')) respawnPlayer();
});
document.getElementById('win-continue').addEventListener('click', () => {
  playClick(); hideOverlay('overlay-win'); leaveGame();
});
document.getElementById('win-retry').addEventListener('click', () => {
  playClick(); hideOverlay('overlay-win'); startLevel(gDef);
});
document.getElementById('hud-back').addEventListener('click', () => {
  playClick(); leaveGame();
});

// ============================================================
// UPDATE
// ============================================================
function update(dt) {
  if (!pAlive) { updateParticles(dt); return; }
  updateBreaking(dt);
  updateMovingPlatforms(dt);
  updateTurrets(dt);
  updateBullets(dt);
  updatePlayer(dt);
  updateParticles(dt);
}

function updateBreaking(dt) {
  for (const key in breakStates) {
    const bs = breakStates[key];
    bs.timer += dt;
    if (bs.state === 'wobble' && bs.timer >= 500)  { bs.state = 'broken'; bs.timer = 0; }
    if (bs.state === 'broken' && bs.timer >= 2000) { bs.state = 'solid';  bs.timer = 0; }
  }
}

function updateTurrets(dt) {
  for (let ty = 0; ty < gMapH; ty++) {
    for (let tx = 0; tx < gMapW; tx++) {
      if (gMap[ty][tx] !== 7) continue;
      const key = tx + ',' + ty;
      if (turretTimers[key] === undefined)
        turretTimers[key] = ((tx * 1300 + ty * 700) % 4000);
      turretTimers[key] += dt;
      if (turretTimers[key] >= 4000) {
        turretTimers[key] = 0;
        // Bullet spawns from left side of turret tile, at mid-height
        bullets.push({ x: tx * TILE - 6, y: ty * TILE + 8, vx: -3, vy: 0, alive: true });
      }
    }
  }
}

function updateBullets(dt) {
  for (const b of bullets) {
    if (!b.alive) continue;
    b.x += b.vx;
    if (b.x < -80 || b.x > gMapW * TILE + 80) { b.alive = false; continue; }
    // Destroy on solid tile
    const btx = Math.floor((b.x + 3) / TILE);
    const bty = Math.floor((b.y + 3) / TILE);
    if (isSolid(btx, bty)) { b.alive = false; continue; }
    // Hit player
    if (pAlive && b.x < px + PW + 3 && b.x + 6 > px - 3 &&
                  b.y < py + PH + 3 && b.y + 6 > py - 3) {
      killPlayer(); b.alive = false;
    }
  }
  bullets = bullets.filter(b => b.alive);
}

// ============================================================
// PLAYER PHYSICS â€” sweep-based, no tunneling
// ============================================================
function updatePlayer(dt) {
  const left    = keys['ArrowLeft']  || keys['KeyA'];
  const right   = keys['ArrowRight'] || keys['KeyD'];
  const jumpKey = keys['ArrowUp'] || keys['KeyW'] || keys['Space'];

  // ---- Horizontal ----
  if (left)       pvx = -3.8;
  else if (right) pvx =  3.8;
  else {
    // Ice: almost no friction. Ground: normal friction. Air: light friction.
    if (pOnGround && pOnIce) {
      pvx *= 0.995; // nearly frictionless
    } else if (pOnGround) {
      pvx *= 0.70;
    } else {
      pvx *= 0.92;
    }
    if (Math.abs(pvx) < 0.1) pvx = 0;
  }

  // ---- Wall slide ----
  const wallSliding = !pOnGround && ((pOnWallL && left) || (pOnWallR && right));
  const maxFall = wallSliding ? 2.0 : 14;

  // ---- Gravity ----
  pvy += 0.58;
  if (pvy > maxFall) pvy = maxFall;

  // ---- Coyote time ----
  if (pOnGround) pCoyote = 7;
  else if (pCoyote > 0) pCoyote--;

  // ---- Jump â€” hold to keep jumping each time you land ----
  // pJumpConsumed resets on keyup, so holding space auto-jumps on landing
  if (jumpKey) {
    if (!pJumpConsumed) {
      if (pCoyote > 0) {
        pvy = -11.5; pCoyote = 0; pJumpConsumed = true;
        sfx('ragebait 3_jump.mp3', 0.5);
      } else if (wallSliding) {
        pvy = -11; pvx = pOnWallL ? 5.5 : -5.5;
        pCoyote = 0; pJumpConsumed = true;
        sfx('ragebait 3_jump.mp3', 0.5);
      } else if (pDoubleJump) {
        pvy = -11.5; pDoubleJump = false; pJumpConsumed = true;
        sfx('ragebait 3_jump.mp3', 0.5);
      }
    }
  } else {
    pJumpConsumed = false;
  }

  // ---- Carry on moving platform ----
  if (pOnMoving) {
    if (pOnMoving.axis === 'h') px += pOnMoving.speed * pOnMoving._dir * (dt / 16);
    else                        py += pOnMoving.speed * pOnMoving._dir * (dt / 16) * 0.4;
  }

  // ---- Sweep X ----
  sweepX();
  // ---- Sweep Y ----
  sweepY();
  // ---- Moving platform landing ----
  landOnMovingPlatforms();

  spawnTrail();
  checkOrbs();
  checkStarCoin();
  checkGoal();
  checkKillTiles();

  if (py > gMapH * TILE + 100) killPlayer();
}

// ---- Sweep X: move px by pvx, resolve tile collisions ----
function sweepX() {
  pOnWallL = false; pOnWallR = false;
  if (pvx === 0) return;

  px += pvx;

  // Player occupies rows from Math.floor(py/TILE) to Math.floor((py+PH-1)/TILE)
  const tyT = Math.floor(py / TILE);
  const tyB = Math.floor((py + PH - 1) / TILE);

  if (pvx > 0) {
    // Moving right â€” check right edge
    const txR = Math.floor((px + PW - 1) / TILE);
    for (let ty = tyT; ty <= tyB; ty++) {
      if (isSolid(txR, ty)) {
        px = txR * TILE - PW;
        pvx = 0; pOnWallR = true;
        triggerBreak(txR, ty);
        break;
      }
      if (isKill(txR, ty)) { killPlayer(); return; }
    }
  } else {
    // Moving left â€” check left edge
    const txL = Math.floor(px / TILE);
    for (let ty = tyT; ty <= tyB; ty++) {
      if (isSolid(txL, ty)) {
        px = (txL + 1) * TILE;
        pvx = 0; pOnWallL = true;
        triggerBreak(txL, ty);
        break;
      }
      if (isKill(txL, ty)) { killPlayer(); return; }
    }
  }
}

// ---- Sweep Y: move py by pvy, resolve tile collisions ----
function sweepY() {
  pOnGround = false; pOnIce = false;
  if (pvy === 0) return;

  py += pvy;

  const txL = Math.floor(px / TILE);
  const txR = Math.floor((px + PW - 1) / TILE);

  if (pvy > 0) {
    // Moving down â€” check bottom edge
    const tyB = Math.floor((py + PH - 1) / TILE);
    for (let tx = txL; tx <= txR; tx++) {
      if (isSolid(tx, tyB)) {
        py = tyB * TILE - PH;
        pvy = 0;
        pOnGround = true;
        pDoubleJump = false;
        // Allow re-jump when holding space (pJumpConsumed already false from keyup,
        // but if still held we want to jump again next frame)
        if (pJumpConsumed && (keys['ArrowUp'] || keys['KeyW'] || keys['Space'])) {
          pJumpConsumed = false; // re-enable jump on landing while holding
        }
        if (getTile(tx, tyB) === 4) pOnIce = true;
        triggerBreak(tx, tyB);
        break;
      }
      if (isKill(tx, tyB)) { killPlayer(); return; }
    }
  } else {
    // Moving up â€” check top edge
    const tyT = Math.floor(py / TILE);
    for (let tx = txL; tx <= txR; tx++) {
      if (isSolid(tx, tyT)) {
        py = (tyT + 1) * TILE;
        pvy = 0;
        triggerBreak(tx, tyT);
        break;
      }
      if (isKill(tx, tyT)) { killPlayer(); return; }
    }
  }
}

function landOnMovingPlatforms() {
  pOnMoving = null;
  if (pvy < 0) return; // only land when falling or still
  for (const mp of movingPlatforms) {
    const mpTop = mp.y;
    if (px + PW > mp.x && px < mp.x + mp.w) {
      if (py + PH >= mpTop - 1 && py + PH <= mpTop + 8) {
        py = mpTop - PH;
        pvy = 0;
        pOnGround = true;
        pDoubleJump = false;
        if (pJumpConsumed && (keys['ArrowUp'] || keys['KeyW'] || keys['Space'])) {
          pJumpConsumed = false;
        }
        if (mp.type === 4) pOnIce = true;
        pOnMoving = mp;
        break;
      }
    }
    // Kill moving platform
    if (mp.type === 2 && px + PW > mp.x && px < mp.x + mp.w &&
        py + PH >= mp.y - 2 && py + PH <= mp.y + 8) {
      killPlayer();
    }
  }
}

function checkKillTiles() {
  // Spike (type 2): narrow hitbox matching the single spike visual (center 10px wide)
  const txL = Math.floor(px / TILE), txR = Math.floor((px+PW-1) / TILE);
  const tyT = Math.floor(py / TILE), tyB = Math.floor((py+PH-1) / TILE);
  for (let ty = tyT; ty <= tyB; ty++) {
    for (let tx = txL; tx <= txR; tx++) {
      if (getTile(tx, ty) !== 2) continue;
      // Spike hitbox: center 10px wide (5px each side of center), full height
      const spikeCX    = tx * TILE + TILE / 2;
      const spikeLeft  = spikeCX - 5;
      const spikeRight = spikeCX + 5;
      const spikeTop   = ty * TILE + 4;   // tip starts at y+4
      const spikeBot   = ty * TILE + TILE;
      if (px + PW > spikeLeft && px < spikeRight &&
          py + PH > spikeTop  && py < spikeBot) {
        killPlayer(); return;
      }
    }
  }
}

function triggerBreak(tx, ty) {
  if (!gMap[ty] || gMap[ty][tx] !== 3) return;
  const key = tx + ',' + ty;
  if (!breakStates[key]) breakStates[key] = { state: 'solid', timer: 0 };
  if (breakStates[key].state === 'solid') {
    breakStates[key].state = 'wobble';
    breakStates[key].timer = 0;
  }
}

// ============================================================
// COLLECTIBLES & GOAL
// ============================================================
function checkOrbs() {
  const txL = Math.floor(px / TILE), txR = Math.floor((px+PW-1) / TILE);
  const tyT = Math.floor(py / TILE), tyB = Math.floor((py+PH-1) / TILE);
  for (let ty = tyT; ty <= tyB; ty++)
    for (let tx = txL; tx <= txR; tx++)
      if (getTile(tx, ty) === 5) {
        const key = tx + ',' + ty;
        if (!orbUsed[key]) { orbUsed[key] = true; pDoubleJump = true; }
      }
}

function checkStarCoin() {
  if (pHasStarCoin) return;
  const txL = Math.floor(px / TILE), txR = Math.floor((px+PW-1) / TILE);
  const tyT = Math.floor(py / TILE), tyB = Math.floor((py+PH-1) / TILE);
  for (let ty = tyT; ty <= tyB; ty++)
    for (let tx = txL; tx <= txR; tx++)
      if (getTile(tx, ty) === 6) pHasStarCoin = true;
}

function checkGoal() {
  const txL = Math.floor(px / TILE), txR = Math.floor((px+PW-1) / TILE);
  const tyT = Math.floor(py / TILE), tyB = Math.floor((py+PH-1) / TILE);
  for (let ty = tyT; ty <= tyB; ty++)
    for (let tx = txL; tx <= txR; tx++)
      if (getTile(tx, ty) === 8) { winLevel(); return; }
}

// ============================================================
// DEATH & WIN
// ============================================================
function killPlayer() {
  if (!pAlive) return;
  pAlive = false;
  const deathFiles = { default:'ragebait 3_death.mp3', dramatic:'ragebait 3_death2.mp3', realistic:'ragebait 3_death3.mp3' };
  sfx(deathFiles[save.equippedDeath] || 'ragebait 3_death.mp3', 0.7);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    particles.push({ x: px+PW/2, y: py+PH/2,
      vx: Math.cos(a)*4, vy: Math.sin(a)*4,
      life:400, maxLife:400, kind:'explosion',
      color: i%2===0 ? '#ff2200' : '#ff8800', size:3 });
  }
  save.levels[gDef.id].deaths++;
  sessionDeaths++;
  attemptDeaths++;
  writeSave();
  setTimeout(() => {
    if (!gRunning) return;
    document.getElementById('overlay-death').classList.add('active');
  }, 420);
}

function hideOverlay(id) {
  document.getElementById(id).classList.remove('active');
}

function winLevel() {
  if (!pAlive) return;
  pAlive = false;
  sfx('win.mp3', 0.7);
  const elapsed = sessionElapsed;
  const ld = save.levels[gDef.id];
  const star1 = pHasStarCoin;
  const star2 = elapsed / 1000 <= gDef.timeThreshold;
  const star3 = attemptDeaths === 0;
  const newStars = [star1, star2, star3];
  let earned = 0;
  for (let i = 0; i < 3; i++)
    if (newStars[i] && !ld.stars[i]) { ld.stars[i] = true; earned++; }
  if (ld.bestTime === null || elapsed < ld.bestTime) ld.bestTime = elapsed;
  writeSave();
  document.getElementById('win-stars').innerHTML = newStars.map(s =>
    `<span style="color:${s?'#ffcc00':'#334466'};text-shadow:${s?'0 0 8px #ffcc00':'none'}">${s?'â­':'â˜†'}</span>`
  ).join('');
  document.getElementById('win-stats').innerHTML =
    `<span>TIME: ${fmtTime(elapsed)}</span><span>NEW STARS: +${earned}</span><span>TOTAL â­: ${totalStars()}</span>`;
  document.getElementById('overlay-win').classList.add('active');
}

// ============================================================
// TRAIL PARTICLES
// ============================================================
function spawnTrail() {
  const trail = save.equippedTrail;
  if (trail === 'none') return;
  if (Math.abs(pvx) < 0.2 && Math.abs(pvy) < 0.2) return;
  const cx = px+PW/2, cy = py+PH/2;
  if (trail === 'dots')
    particles.push({ x:cx+(Math.random()-.5)*4, y:cy+(Math.random()-.5)*4,
      vx:(Math.random()-.5)*.4, vy:(Math.random()-.5)*.4,
      life:700, maxLife:700, kind:'trail', color:'#ffffff', size:2, glow:false });
  else if (trail === 'fireflies')
    particles.push({ x:cx+(Math.random()-.5)*6, y:cy+(Math.random()-.5)*6,
      vx:(Math.random()-.5)*1.2, vy:(Math.random()-.5)*1.2,
      life:1000, maxLife:1000, kind:'trail', color:'#00ff88', size:2, glow:true });
  else if (trail === 'embers')
    particles.push({ x:cx+(Math.random()-.5)*3, y:cy+(Math.random()-.5)*3,
      vx:(Math.random()-.5)*.6, vy:-.8-Math.random()*.6,
      life:800, maxLife:800, kind:'trail', color:Math.random()>.5?'#cc44ff':'#ff44cc', size:2, glow:false });
}

function updateParticles(dt) {
  for (const p of particles) { p.life -= dt; p.x += p.vx; p.y += p.vy; }
  particles = particles.filter(p => p.life > 0);
}

function updateHUD() {
  document.getElementById('hud-deaths').textContent  = 'DEATHS: '  + save.levels[gDef.id].deaths;
  document.getElementById('hud-session').textContent = 'SESSION: ' + sessionDeaths;
  document.getElementById('hud-time').textContent    = 'TIME: '    + fmtTime(sessionElapsed);
}

// ============================================================
// RENDER
// ============================================================
let camX = 0;

function render() {
  const ctx = gCtx;
  ctx.clearRect(0, 0, CW, CH);

  // Background GIF â€” always cover full canvas
  const bg = getBgImg(gDef.bg);
  if (bg.complete && bg.naturalWidth > 0) {
    ctx.drawImage(bg, 0, 0, CW, CH);
  } else {
    // Fallback gradient if gif not loaded yet or missing
    const grad = ctx.createLinearGradient(0, 0, 0, CH);
    grad.addColorStop(0, '#0a0a20');
    grad.addColorStop(1, '#050510');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CW, CH);
  }

  // Camera
  camX = Math.max(0, Math.min(gMapW * TILE - CW, px + PW/2 - CW/2));

  ctx.save();
  ctx.translate(-camX, 0);

  // Tiles
  const x0 = Math.max(0, Math.floor(camX / TILE) - 1);
  const x1 = Math.min(gMapW - 1, Math.ceil((camX + CW) / TILE) + 1);
  for (let ty = 0; ty < gMapH; ty++)
    for (let tx = x0; tx <= x1; tx++)
      drawTile(ctx, tx, ty);

  // Moving platforms
  for (const mp of movingPlatforms) drawMovingPlatform(ctx, mp);

  // Bullets
  for (const b of bullets) {
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(b.x, b.y, 6, 4);
    ctx.fillStyle = '#ffaaaa';
    ctx.fillRect(b.x+1, b.y+1, 3, 2);
  }

  // Trail particles
  for (const p of particles) {
    if (p.kind !== 'trail') continue;
    ctx.globalAlpha = p.life / p.maxLife;
    if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = 4; }
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x-p.size/2), Math.round(p.y-p.size/2), p.size, p.size);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  // Player
  if (pAlive) {
    const rx = Math.round(px), ry = Math.round(py);
    ctx.fillStyle = pColor;
    ctx.fillRect(rx, ry, PW, PH);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(rx, ry, PW, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(rx, ry+PH-2, PW, 2);
    if (pHasStarCoin) {
      ctx.fillStyle = '#ffcc00';
      ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 5;
      ctx.fillRect(rx+3, ry-5, 4, 4);
      ctx.shadowBlur = 0;
    }
  }

  // Explosion particles
  for (const p of particles) {
    if (p.kind !== 'explosion') continue;
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x-p.size/2), Math.round(p.y-p.size/2), p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ============================================================
// TILE DRAWING
// ============================================================
// Tiles are FULL blocks. We draw them as thick slabs that fill
// the bottom portion of the tile, making them clearly visible.
// TILE = 20px. Slab visual: full 20px wide, 10px tall at bottom.
// Spikes (type 2) are drawn ON TOP of the tile below them.

function drawTile(ctx, tx, ty) {
  const raw = gMap[ty][tx];
  if (raw === 0) return;

  const bx = tx * TILE;  // left pixel
  const by = ty * TILE;  // top pixel of tile cell

  // Platform slab: occupies bottom 10px of tile (by+10 to by+20)
  const sY = by + 10;  // slab visual top
  const sH = 10;       // slab height

  if (raw === 1) {
    // Solid â€” bright gray
    ctx.fillStyle = '#e8e8e8'; ctx.fillRect(bx, sY,   TILE, 2); // highlight
    ctx.fillStyle = '#b0b0b0'; ctx.fillRect(bx, sY+2, TILE, 3);
    ctx.fillStyle = '#787878'; ctx.fillRect(bx, sY+5, TILE, 3);
    ctx.fillStyle = '#404040'; ctx.fillRect(bx, sY+8, TILE, 2); // shadow
    // Pixel detail
    ctx.fillStyle = '#c8c8c8';
    for (let i = 2; i < TILE-2; i += 5) ctx.fillRect(bx+i, sY+2, 2, 1);

  } else if (raw === 2) {
    // Single spike â€” one narrow triangle centered in the tile
    const cx = bx + TILE / 2;
    // Dark base
    ctx.fillStyle = '#550000';
    ctx.fillRect(bx, by + TILE - 2, TILE, 2);
    // Single spike triangle
    ctx.fillStyle = '#ff2222';
    ctx.beginPath();
    ctx.moveTo(cx - 5, by + TILE - 1); // base left
    ctx.lineTo(cx,     by + 4);         // tip
    ctx.lineTo(cx + 5, by + TILE - 1); // base right
    ctx.fill();
    // Bright tip highlight
    ctx.fillStyle = '#ffaaaa';
    ctx.fillRect(cx - 1, by + 4, 2, 3);

  } else if (raw === 3) {
    // Breaking platform
    const key = tx + ',' + ty;
    const bs = breakStates[key];
    if (bs && bs.state === 'broken') return;
    const wobble = (bs && bs.state === 'wobble') ? Math.sin(Date.now()/50)*2 : 0;
    ctx.save();
    ctx.translate(bx+TILE/2, sY+sH/2);
    ctx.rotate(wobble * 0.06);
    ctx.fillStyle = '#f0a840'; ctx.fillRect(-TILE/2, -sH/2,   TILE, 2);
    ctx.fillStyle = '#c07828'; ctx.fillRect(-TILE/2, -sH/2+2, TILE, 3);
    ctx.fillStyle = '#885018'; ctx.fillRect(-TILE/2, -sH/2+5, TILE, 3);
    ctx.fillStyle = '#502800'; ctx.fillRect(-TILE/2, -sH/2+8, TILE, 2);
    ctx.fillStyle = '#301800';
    ctx.fillRect(-5, -sH/2, 1, sH);
    ctx.fillRect(4,  -sH/2, 1, sH);
    ctx.restore();

  } else if (raw === 4) {
    // Ice
    ctx.fillStyle = '#f0faff'; ctx.fillRect(bx, sY,   TILE, 2);
    ctx.fillStyle = '#88ccee'; ctx.fillRect(bx, sY+2, TILE, 3);
    ctx.fillStyle = '#4488bb'; ctx.fillRect(bx, sY+5, TILE, 3);
    ctx.fillStyle = '#1a5588'; ctx.fillRect(bx, sY+8, TILE, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(bx+2, sY, 5, 1);
    ctx.fillRect(bx+13, sY, 3, 1);

  } else if (raw === 5) {
    // Double jump orb â€” floating in center of tile
    const key = tx + ',' + ty;
    const used = orbUsed[key];
    const pulse = Math.sin(Date.now()/280)*2;
    const cx = bx+TILE/2, cy = by+TILE/2;
    ctx.save();
    ctx.shadowColor = used ? '#444' : '#ffee00';
    ctx.shadowBlur  = used ? 2 : 10+pulse;
    ctx.fillStyle   = used ? '#333' : '#ffee00';
    ctx.beginPath(); ctx.arc(cx, cy, 5+(used?0:pulse*0.4), 0, Math.PI*2); ctx.fill();
    if (!used) { ctx.fillStyle='#fff'; ctx.fillRect(cx-1,cy-2,2,2); }
    ctx.shadowBlur = 0;
    ctx.restore();

  } else if (raw === 6) {
    // Star coin
    if (pHasStarCoin) return;
    const bob = Math.sin(Date.now()/350)*2;
    const cx = bx+TILE/2, cy = by+TILE/2+bob;
    ctx.save();
    ctx.shadowColor='#ffcc00'; ctx.shadowBlur=10;
    ctx.fillStyle='#ffcc00';
    ctx.beginPath(); ctx.arc(cx,cy,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ff8800';
    ctx.font='bold 8px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('â˜…',cx,cy+1);
    ctx.shadowBlur=0; ctx.restore();

  } else if (raw === 7) {
    // Turret â€” sits on top of slab
    const bx2 = bx+1, by2 = sY-10;
    ctx.fillStyle='#445566'; ctx.fillRect(bx2,by2,18,10);
    ctx.fillStyle='#667788'; ctx.fillRect(bx2+1,by2+1,16,8);
    ctx.fillStyle='#ff2222'; ctx.fillRect(bx2+12,by2+3,4,4);
    ctx.fillStyle='#223344'; ctx.fillRect(bx2-8,by2+3,10,4);
    ctx.fillStyle='#112233'; ctx.fillRect(bx2-8,by2+4,10,2);
    // Draw the slab under turret
    ctx.fillStyle='#e8e8e8'; ctx.fillRect(bx,sY,TILE,2);
    ctx.fillStyle='#b0b0b0'; ctx.fillRect(bx,sY+2,TILE,3);
    ctx.fillStyle='#787878'; ctx.fillRect(bx,sY+5,TILE,3);
    ctx.fillStyle='#404040'; ctx.fillRect(bx,sY+8,TILE,2);

  } else if (raw === 8) {
    // Goal flag
    const wave = Math.sin(Date.now()/180)*2.5;
    const fx = bx+TILE/2;
    ctx.save();
    ctx.shadowColor='#00ff88'; ctx.shadowBlur=14;
    ctx.fillStyle='#cccccc'; ctx.fillRect(fx-1,by-22,2,26);
    ctx.fillStyle='#00ff88';
    ctx.beginPath();
    ctx.moveTo(fx+1,by-22);
    ctx.lineTo(fx+1+13+wave,by-14);
    ctx.lineTo(fx+1,by-6);
    ctx.fill();
    // Base slab
    ctx.fillStyle='#e8e8e8'; ctx.fillRect(bx+2,sY,TILE-4,2);
    ctx.fillStyle='#b0b0b0'; ctx.fillRect(bx+2,sY+2,TILE-4,3);
    ctx.fillStyle='#787878'; ctx.fillRect(bx+2,sY+5,TILE-4,3);
    ctx.fillStyle='#404040'; ctx.fillRect(bx+2,sY+8,TILE-4,2);
    ctx.shadowBlur=0; ctx.restore();
  }
}

function drawMovingPlatform(ctx, mp) {
  const bx = mp.x, by = mp.y;
  const sY = by + 10, W = mp.w;
  if (mp.type === 1) {
    ctx.fillStyle='#ffdd66'; ctx.fillRect(bx,sY,W,2);
    ctx.fillStyle='#ddaa33'; ctx.fillRect(bx,sY+2,W,3);
    ctx.fillStyle='#aa7711'; ctx.fillRect(bx,sY+5,W,3);
    ctx.fillStyle='#775500'; ctx.fillRect(bx,sY+8,W,2);
    // Direction arrow
    ctx.fillStyle='rgba(255,255,255,0.4)';
    const ax = bx+W/2-4;
    ctx.fillRect(ax,sY+3,8,1);
    ctx.fillRect(ax+(mp._dir>0?5:0),sY+2,3,3);
  } else if (mp.type === 4) {
    ctx.fillStyle='#ccf4ff'; ctx.fillRect(bx,sY,W,2);
    ctx.fillStyle='#77ccee'; ctx.fillRect(bx,sY+2,W,3);
    ctx.fillStyle='#3399cc'; ctx.fillRect(bx,sY+5,W,3);
    ctx.fillStyle='#116699'; ctx.fillRect(bx,sY+8,W,2);
  } else if (mp.type === 3) {
    ctx.fillStyle='#f0a840'; ctx.fillRect(bx,sY,W,2);
    ctx.fillStyle='#c07828'; ctx.fillRect(bx,sY+2,W,3);
    ctx.fillStyle='#885018'; ctx.fillRect(bx,sY+5,W,3);
    ctx.fillStyle='#502800'; ctx.fillRect(bx,sY+8,W,2);
  }
}

// ============================================================
// INIT
// ============================================================
showScreen('menu');
ensureMusicPlaying();
