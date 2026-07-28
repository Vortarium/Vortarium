const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Dev mode - set to true for cheat keys
const DEV_MODE = false;

// Global speed multiplier - simple 2x speed for everything
window.speedMultiplier = 2;

// Audio
let soundEnabled = true;
let audioContext;
let volume = 0.3;
const sounds = {
    music: null,
    hit: null,
    buy: null,
    button: null,
    zap: null,
    quest: null
};

function initAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    sounds.music = new Audio('breakout_music.mp3');
    sounds.music.loop = true;
    sounds.music.volume = volume;
    
    sounds.hit = new Audio('breakout_main.mp3');
    sounds.hit.volume = volume;
    
    sounds.buy = new Audio('breakout_buy.mp3');
    sounds.buy.volume = volume;
    
    sounds.button = new Audio('breakout_button.mp3');
    sounds.button.volume = volume;
    
    sounds.zap = new Audio('breakout_zap.mp3');
    sounds.zap.volume = volume;
    
    sounds.quest = new Audio('breakout_quest.mp3');
    sounds.quest.volume = volume;
    
    // Resume audio context if suspended (browser autoplay policy)
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

function playSound(soundName) {
    if (!soundEnabled || !sounds[soundName]) return;
    
    // Resume audio context if needed
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    // Create new audio instance to allow overlapping sounds
    const sound = new Audio(sounds[soundName].src);
    
    // Use appropriate volume based on sound type
    if (soundName === 'music') {
        sound.volume = musicVolume;
    } else {
        sound.volume = sfxVolume;
    }
    
    sound.play().catch(e => {
        console.log('Sound play error:', e);
    });
}

function updateSfxVolume(newVolume) {
    sfxVolume = newVolume / 100;
    document.getElementById('sfxValue').textContent = `${newVolume}%`;
}

function updateMusicVolume(newVolume) {
    musicVolume = newVolume / 100;
    document.getElementById('musicValue').textContent = `${newVolume}%`;
    
    if (sounds.music) {
        sounds.music.volume = musicVolume;
    }
}

// Game state
let money = 0;
let level = 1;
let balls = [];
let bricks = [];
let ballSpeed = 0.5;
let ballPower = 1;
let clickPower = 1;
let gameRunning = true;
let bbCurrency = 0;
let maxBalls = 50;
let bbMaxSpeedBonus = 0; // starts at 0, each upgrade adds +0.10 (10%)
let bbMaxPowerBonus = 1; // removed, no longer used
let sfxVolume = 0.01;
let musicVolume = 0.01;

// Damage tracking
let damageStats = {
    basic: 0,
    plasma: 0,
    sniper: 0,
    scatter: 0,
    cannonball: 0,
    poison: 0,
    click: 0,
    laser: 0
};

// Prestige system
let gold = 0;
let goldEarnedThisPrestige = 0;
let bossesKilled = 0;
let prestigeLevel = 0;

// Permanent prestige buffs
let prestigeBuffs = {
    speed: 0,
    damage: 0,
    maxBalls: 0,
    goldBoost: 0
};

// Laser system
let lasers = [];
let laserDamage = 500;
let laserUpgradeCost = 250000;
let laserPurchases = {
    laser1: false,
    laser2: false,
    laser3: false,
    laser4: false
};

// Prestige upgrade costs
let prestigeUpgradeCosts = {
    prestigeSpeed: 10,
    prestigeDamage: 10,
    prestigeMaxBalls: 10,
    goldBoost: 10
};

// Boss rush system
let bossRushLevel = 1;
let bossRushCost = 1000;
let inBossRush = false;
let bossRushProgress = 0; // Current boss in the rush
let bossRushBosses = []; // Array of boss objects for current rush
let bossRushTimer = 0; // Timer in seconds
let bossRushMaxTime = 0; // Max time for current boss
let bossRushGoldReward = 0; // Gold earned in current rush
let savedLevel = 1; // Save level before boss rush

// Ball types and costs
const ballTypes = {
    basic: { cost: 10, damage: 1, speed: 1.0, color: '#e94560', radius: 8 },
    plasma: { cost: 200, damage: 3, speed: 1.0, color: '#9b59b6', radius: 10 },
    sniper: { cost: 1500, damage: 3, speed: 2.0, color: '#3498db', radius: 7 },
    scatter: { cost: 10000, damage: 10, speed: 0.4, color: '#f1c40f', radius: 6 },
    cannonball: { cost: 75000, damage: 50, speed: 0.5, color: '#808080', radius: 15 },
    poison: { cost: 75000, damage: 10, speed: 3.0, color: '#27ae60', radius: 9 }
};

// Track purchase count for each ball type
let ballPurchaseCounts = {
    basic: 0,
    plasma: 0,
    sniper: 0,
    scatter: 0,
    cannonball: 0,
    poison: 0
};

// Base costs for price calculation
const ballBaseCosts = {
    basic: 10,
    plasma: 200,
    sniper: 1500,
    scatter: 10000,
    cannonball: 75000,
    poison: 75000
};

// Ball-specific upgrades
let ballUpgrades = {
    basic: { power: 0, special: 0 },
    plasma: { power: 0, special: 0 },
    sniper: { power: 0, special: 0 },
    scatter: { power: 0, special: 0 },
    cannonball: { power: 0, special: 0 },
    poison: { power: 0, special: 0 }
};

// Ball upgrade costs
let ballUpgradeCosts = {
    basic: { power: 50, special: 75 },
    plasma: { power: 100, special: 150 },
    sniper: { power: 100, special: 150 },
    scatter: { power: 100, special: 150 },
    cannonball: { power: 200, special: 300 },
    poison: { power: 200, special: 300 }
};

// Global upgrade costs
let upgradeCosts = {
    click: 100
};

// BB upgrade costs
let bbUpgradeCosts = {
    maxBalls: 100,
    maxSpeed: 25,
    maxPower: 25
};

// Ball class
class Ball {
    constructor(type) {
        this.type = type;
        const config = ballTypes[type];
        this.x = canvas.width / 2;
        this.y = canvas.height - 100;
        this.radius = config.radius;
        this.baseSpeed = config.speed;
        this.baseDamage = config.damage;
        this.color = config.color;
        
        // Random direction (not perfectly horizontal or vertical) - normalized to unit vector
        const angle = (Math.random() * Math.PI / 2) + Math.PI / 4;
        const direction = Math.random() < 0.5 ? 1 : -1;
        this.dx = Math.cos(angle) * direction;
        this.dy = -Math.sin(angle);
        
        // Special abilities
        this.scatterBalls = [];
        this.poisonedBricks = new Set();
        this.targetBrick = null; // For sniper targeting
        this.hasAimed = false; // Track if sniper has aimed at current target
        this.frozen = false; // For boss freeze mechanic
        this.freezeTimer = 0;
    }

    update() {
        // Handle freeze timer
        if (this.frozen) {
            this.freezeTimer -= deltaTime * 60; // Convert to frames for compatibility
            if (this.freezeTimer <= 0) {
                this.frozen = false;
            }
            return; // Don't move if frozen
        }
        
        const speedMultiplier = (ballSpeed / 0.5) * this.getSpeedMultiplier() * (1 + bbMaxSpeedBonus) * window.speedMultiplier * 0.5;
        const damageMultiplier = ballPower;
        
        // Use deltaTime for consistent movement across refresh rates
        const movementScale = deltaTime * 60; // Scale to 60fps baseline
        this.x += this.dx * speedMultiplier * movementScale;
        this.y += this.dy * speedMultiplier * movementScale;

        // Wall collisions
        if (this.x - this.radius < 0) {
            this.dx = Math.abs(this.dx);
            this.x = this.radius;
            this.handleWallBounce();
        }
        if (this.x + this.radius > canvas.width) {
            this.dx = -Math.abs(this.dx);
            this.x = canvas.width - this.radius;
            this.handleWallBounce();
        }
        if (this.y - this.radius < 0) {
            this.dy = Math.abs(this.dy);
            this.y = this.radius;
            this.handleWallBounce();
        }
        if (this.y + this.radius > canvas.height) {
            this.dy = -Math.abs(this.dy);
            this.y = canvas.height - this.radius;
            this.handleWallBounce();
        }

        // Update scatter balls
        this.scatterBalls = this.scatterBalls.filter(ball => {
            ball.update();
            // Remove if out of bounds or lifetime expired
            if (ball.x <= 0 || ball.x >= canvas.width || ball.y <= 0 || ball.y >= canvas.height || ball.lifetime <= 0) {
                return false;
            }
            return true;
        });
    }

    handleWallBounce() {
        // Sniper targets nearest brick on wall bounce
        if (this.type === 'sniper') {
            this.targetNearestBrick();
            if (this.targetBrick) {
                this.aimAtTarget();
            }
        }
        
        // Scatter ball spawns mini balls on wall bounce
        if (this.type === 'scatter') {
            const ballCount = this.getScatterBallCount();
            for (let i = 0; i < ballCount; i++) {
                const scatterBall = {
                    x: this.x,
                    y: this.y,
                    dx: (Math.random() - 0.5) * 6,
                    dy: (Math.random() - 0.5) * 6,
                    radius: 4,
                    damage: this.baseDamage * 0.5 * ballPower,
                    color: this.color,
                    lifetime: 600, // 10 seconds at 60fps
                    lastHitTime: 0,
                    update: function() {
                        const movementScale = deltaTime * 60; // Scale to 60fps baseline
                        this.x += this.dx * (ballSpeed / 2.8) * window.speedMultiplier * movementScale;
                        this.y += this.dy * (ballSpeed / 2.8) * window.speedMultiplier * movementScale;
                        this.lifetime -= deltaTime * 60; // Convert to frames
                    },
                    draw: function() {
                        ctx.beginPath();
                        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                        ctx.fillStyle = this.color;
                        ctx.fill();
                        ctx.closePath();
                    }
                };
                this.scatterBalls.push(scatterBall);
            }
        }
    }

    targetNearestBrick() {
        let nearestBrick = null;
        let minDist = Infinity;
        
        for (let brick of bricks) {
            if (!brick.alive) continue;
            const dist = Math.sqrt((brick.x - this.x) ** 2 + (brick.y - this.y) ** 2);
            if (dist < minDist) {
                minDist = dist;
                nearestBrick = brick;
            }
        }
        
        if (nearestBrick) {
            const angle = Math.atan2(nearestBrick.y - this.y, nearestBrick.x - this.x);
            // Keep direction normalized to unit vector
            this.dx = Math.cos(angle);
            this.dy = Math.sin(angle);
        }
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
        
        // Draw scatter balls
        for (let scatterBall of this.scatterBalls) {
            scatterBall.draw();
        }
    }

    getDamage(targetBrick = null) {
        const powerLevel = ballUpgrades[this.type].power;
        const prestigeBaseDamage = prestigeBuffs.damage * 2; // +2 flat base damage per prestige upgrade
        // Power upgrades add base damage each time (current base value per upgrade)
        let damage = ((this.baseDamage * (1 + powerLevel)) + prestigeBaseDamage) * ballPower;
        
        // Apply boss debuffs if target is a boss
        if (targetBrick && targetBrick.isBoss && targetBrick.bossDebuffs) {
            const debuff = targetBrick.bossDebuffs.find(d => d.type === this.type);
            if (debuff) {
                damage *= debuff.multiplier;
            }
        }
        
        return damage;
    }
    
    getSpeedMultiplier() {
        if (this.type === 'basic' || this.type === 'cannonball' || this.type === 'sniper') {
            const speedBonus = ballUpgrades[this.type].special * 0.05;
            const prestigeSpeedMultiplier = 1 + (prestigeBuffs.speed * 0.25); // +25% per prestige upgrade
            return (1 + speedBonus) * prestigeSpeedMultiplier;
        }
        const prestigeSpeedMultiplier = 1 + (prestigeBuffs.speed * 0.25); // +25% per prestige upgrade
        return prestigeSpeedMultiplier;
    }
    
    getPlasmaRadius() {
        if (this.type === 'plasma') {
            return 100 + (ballUpgrades[this.type].special * 5);
        }
        return 100;
    }
    
    getScatterBallCount() {
        if (this.type === 'scatter') {
            return 3 + ballUpgrades[this.type].special;
        }
        return 3;
    }
    
    getPoisonBonus() {
        if (this.type === 'poison') {
            return 1 + (ballUpgrades[this.type].special * 0.05);
        }
        return 1;
    }
    
    getPoisonMultiplier() {
        if (this.type === 'poison') {
            return 2.0 + (ballUpgrades[this.type].special * 0.05);
        }
        return 2.0;
    }
    
    targetNearestBrick() {
        let nearestBrick = null;
        let nearestDist = Infinity;
        
        for (let brick of bricks) {
            if (brick.alive) {
                const dist = Math.sqrt((brick.x + brick.width/2 - this.x) ** 2 + (brick.y + brick.height/2 - this.y) ** 2);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestBrick = brick;
                }
            }
        }
        
        this.targetBrick = nearestBrick;
    }
    
    aimAtTarget() {
        if (!this.targetBrick) return;
        
        const targetX = this.targetBrick.x + this.targetBrick.width / 2;
        const targetY = this.targetBrick.y + this.targetBrick.height / 2;
        
        const angle = Math.atan2(targetY - this.y, targetX - this.x);
        const speed = Math.sqrt(this.dx ** 2 + this.dy ** 2);
        
        this.dx = Math.cos(angle) * speed;
        this.dy = Math.sin(angle) * speed;
    }
}

// Laser class
class Laser {
    constructor(position) {
        this.position = position; // 'top', 'bottom', 'left', 'right'
        this.x = 0;
        this.y = 0;
        this.width = 20;
        this.height = 20;
        this.speed = 2;
        this.timer = 0;
        this.fireInterval = 90; // 1.5 seconds at 60fps
        this.firing = false;
        this.fireDuration = 10; // How long the beam lasts
        
        this.initPosition();
    }
    
    initPosition() {
        if (this.position === 'top') {
            this.x = 0;
            this.y = 0;
        } else if (this.position === 'bottom') {
            this.x = canvas.width; // starts at right, moves left
            this.y = canvas.height - 20;
        } else if (this.position === 'left') {
            this.x = 0;
            this.y = canvas.height; // starts at bottom, moves up
        } else if (this.position === 'right') {
            this.x = canvas.width - 20;
            this.y = 0; // starts at top, moves down
        }
    }
    
    update() {
        this.timer += deltaTime * 60; // Convert to frames for compatibility
        
        if (this.timer >= this.fireInterval && !this.firing) {
            this.fire();
            this.timer = 0;
            this.firing = true;
        }
        
        if (this.firing) {
            this.fireDuration -= deltaTime * 60;
            if (this.fireDuration <= 0) {
                this.firing = false;
                this.fireDuration = 10;
            }
        }
        
        // Move laser across — bottom and right move opposite to top and left
        const movementScale = deltaTime * 60; // Scale to 60fps baseline
        const laserSpeed = this.speed * window.speedMultiplier;
        if (this.position === 'top') {
            this.x += laserSpeed * movementScale;
            if (this.x > canvas.width) this.x = -20;
        } else if (this.position === 'bottom') {
            this.x -= laserSpeed * movementScale;
            if (this.x < -20) this.x = canvas.width;
        } else if (this.position === 'left') {
            this.y -= laserSpeed * movementScale;
            if (this.y < -20) this.y = canvas.height;
        } else if (this.position === 'right') {
            this.y += laserSpeed * movementScale;
            if (this.y > canvas.height) this.y = -20;
        }
    }
    
    fire() {
        playSound('zap');
        
        for (let brick of bricks) {
            if (!brick.alive) continue;
            
            let hit = false;
            // Hit entire column for top/bottom lasers - check x overlap
            if ((this.position === 'top' || this.position === 'bottom')) {
                // Check if brick's x range overlaps with laser's x range
                if (brick.x < this.x + this.width && brick.x + brick.width > this.x) {
                    hit = true;
                }
            }
            // Hit entire row for left/right lasers - check y overlap
            else if ((this.position === 'left' || this.position === 'right')) {
                // Check if brick's y range overlaps with laser's y range
                if (brick.y < this.y + this.height && brick.y + brick.height > this.y) {
                    hit = true;
                }
            }
            
            if (hit) {
                let damage = laserDamage;
                
                // Apply boss debuffs if target is a boss (lasers don't have a type, so they're not affected by ball-specific debuffs)
                // Lasers are unaffected by debuffs per the spec
                
                damageStats.laser += damage;
                brick.hit(damage);
                if (!brick.alive) {
                    awardBrickKill(brick);
                }
            }
        }
        
        updateUI();
    }
    
    draw() {
        // Draw the laser emitter (rectangle with ball inside)
        ctx.fillStyle = '#ff0000';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff0000';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Draw ball inside
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.closePath();
        
        // Draw beam when firing
        if (this.firing) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
            if (this.position === 'top') {
                ctx.fillRect(this.x + this.width / 2 - 2, this.y + this.height, 4, canvas.height);
            } else if (this.position === 'bottom') {
                ctx.fillRect(this.x + this.width / 2 - 2, 0, 4, this.y);
            } else if (this.position === 'left') {
                ctx.fillRect(this.x + this.width, this.y + this.height / 2 - 2, canvas.width, 4);
            } else if (this.position === 'right') {
                ctx.fillRect(0, this.y + this.height / 2 - 2, this.x, 4);
            }
        }
        
        ctx.shadowBlur = 0;
    }
}

// Brick class
class Brick {
    constructor(x, y, health) {
        this.x = x;
        this.y = y;
        this.width = 70;
        this.height = 25;
        this.health = health;
        this.maxHealth = health;
        this.alive = true;
        this.poisoned = false;
        this.poisonTimer = 0;
        this.poisonBonus = 1;
        this.isBoss = false;
        this.isBB = false;
        this.poisonMultiplier = 1; // 2.0x damage multiplier for other balls
    }

    draw() {
        if (!this.alive) return;
        
        const healthPercent = this.health / this.maxHealth;
        const hue = healthPercent * 120;
        
        if (this.isBB) {
            ctx.fillStyle = '#000000';
        } else if (this.isBoss) {
            ctx.fillStyle = this.poisoned ? `hsl(120, 70%, ${30 + healthPercent * 20}%)` : `hsl(0, 70%, 50%)`;
        } else {
            ctx.fillStyle = this.poisoned ? `hsl(120, 70%, ${30 + healthPercent * 20}%)` : `hsl(${hue}, 70%, 50%)`;
        }
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        ctx.strokeStyle = this.isBB ? (this.poisoned ? '#27ae60' : '#ffd700') : (this.isBoss ? '#ffd700' : (this.poisoned ? '#27ae60' : '#fff'));
        ctx.lineWidth = this.isBB ? 3 : (this.isBoss ? 4 : 2);
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        
        ctx.fillStyle = this.isBB ? '#ffd700' : '#fff';
        ctx.font = this.isBoss ? '24px Arial' : '14px Arial';
        ctx.textAlign = 'center';
        
        if (this.isBB) {
            ctx.fillText(simplifyNumber(this.health) + ' BB', this.x + this.width / 2, this.y + this.height / 2 + 5);
        } else if (this.isBoss) {
            // Draw gold reward above
            const goldMultiplier = Math.pow(2, prestigeBuffs.goldBoost);
            const goldReward = 1 + goldMultiplier;
            ctx.font = '16px Arial';
            ctx.fillText(`+${goldReward} Gold`, this.x + this.width / 2, this.y - 10);
            
            // Draw HP inside
            ctx.font = '24px Arial';
            ctx.fillText(simplifyNumber(this.health), this.x + this.width / 2, this.y + this.height / 2 + 10);
            
            // Draw debuffs below
            if (this.bossDebuffs && this.bossDebuffs.length > 0) {
                ctx.font = '12px Arial';
                let debuffY = this.y + this.height + 15;
                for (let debuff of this.bossDebuffs) {
                    const color = debuff.multiplier < 1 ? '#e74c3c' : '#2ecc71';
                    ctx.fillStyle = color;
                    ctx.fillText(`${capitalizeFirstLetter(debuff.type)}: ${debuff.multiplier}x`, this.x + this.width / 2, debuffY);
                    debuffY += 15;
                }
            }
            
            // Draw freeze indicator
            if (this.hasFreeze) {
                ctx.fillStyle = '#3498db';
                ctx.fillText('❄️ Freeze Active', this.x + this.width / 2, debuffY + 5);
            }
        } else {
            ctx.fillText(simplifyNumber(this.health), this.x + this.width / 2, this.y + this.height / 2 + 5);
        }
    }

    hit(damage = 1) {
        this.health -= damage;
        // Auto-destroy bricks with health < 1
        if (this.health < 1 && this.health > 0) {
            this.health = 0;
        }
        if (this.health <= 0) {
            this.alive = false;
            if (this.isBB) {
                return 1; // BB gives 1 BB currency
            }
            return this.maxHealth;
        }
        return 0;
    }

    poison(bonus = 1, multiplier = 2.0) {
        this.poisoned = true;
        this.poisonBonus = bonus;
        this.poisonMultiplier = multiplier; // Damage multiplier for other balls
        this.poisonTimer = 300; // 5 seconds at 60fps
    }

    updatePoison() {
        if (this.poisoned) {
            this.poisonTimer -= deltaTime * 60; // Convert to frames for compatibility
            if (this.poisonTimer <= 0) {
                this.poisoned = false;
                this.poisonMultiplier = 1; // Reset multiplier
            } else if (this.poisonTimer % 120 < deltaTime * 60) {
                // Take poison damage every 2 seconds (120 frames at 60fps)
                this.health -= ballPower * this.poisonBonus;
                // Auto-destroy bricks with health < 1
                if (this.health < 1 && this.health > 0) {
                    this.health = 0;
                }
                if (this.health <= 0) {
                    this.alive = false;
                    // Award currency when poison kills a brick
                    awardBrickKill(this);
                    updateUI();
                }
            }
        }
    }
}

// Award currency when a brick is destroyed - single source of truth
function awardBrickKill(brick) {
    // All bricks give money equal to their max health
    money += brick.maxHealth;
    if (brick.isBB) {
        // BB bricks additionally give +1 BB currency
        bbCurrency += 1;
    }
    if (brick.isBoss) {
        bossesKilled++;
        const goldMultiplier = Math.pow(2, prestigeBuffs.goldBoost);
        goldEarnedThisPrestige += 1 + goldMultiplier;
    }
}

// Simplify large numbers
function simplifyNumber(num) {
    if (num < 1000) return Math.floor(num).toString();
    
    const suffixes = ['', 'K', 'M', 'B', 'T', 'Q', 'q', 'O', 'N', 'D'];
    const suffixIndex = Math.floor(Math.log10(num) / 3);
    
    if (suffixIndex >= suffixes.length) {
        return num.toExponential(2);
    }
    
    const scaled = num / Math.pow(1000, suffixIndex);
    return scaled.toFixed(scaled < 10 ? 2 : 1) + suffixes[suffixIndex];
}

// Initialize bricks for a level
function initBricks() {
    bricks = [];
    
    // Boss level every 20 levels
    if (level % 20 === 0) {
        const bossHealth = level * 100;
        const bossBrick = new Brick(
            canvas.width / 2 - 100,
            canvas.height / 2 - 50,
            bossHealth
        );
        bossBrick.width = 200;
        bossBrick.height = 100;
        bossBrick.isBoss = true;
        bricks.push(bossBrick);
        return;
    }
    
    const rows = Math.min(5 + Math.floor(level / 3), 10);
    const cols = 10;
    const padding = 10;
    const offsetX = (canvas.width - (cols * (70 + padding))) / 2;
    const offsetY = 50;

    // BB chance after level 100
    let bbChance = 0;
    if (level >= 100) {
        bbChance = Math.min((level - 99) * 0.001, 1);
    }

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = offsetX + col * (70 + padding);
            const y = offsetY + row * (25 + padding);
            const brick = new Brick(x, y, level);
            
            // Chance to be BB after level 100
            if (level >= 100 && Math.random() < bbChance) {
                brick.isBB = true;
                // BB health multiplier: 10x at level 100, 20x at 200, 30x at 300, etc.
                const bbMultiplier = Math.floor(level / 100) * 10;
                brick.health = level * bbMultiplier;
                brick.maxHealth = level * bbMultiplier;
            }
            
            bricks.push(brick);
        }
    }
}

// Save game to localStorage
function saveGame() {
    const saveData = {
        money: money,
        level: level,
        ballSpeed: ballSpeed,
        ballPower: ballPower,
        clickPower: clickPower,
        ballTypes: ballTypes,
        ballUpgrades: ballUpgrades,
        ballUpgradeCosts: ballUpgradeCosts,
        upgradeCosts: upgradeCosts,
        bbCurrency: bbCurrency,
        maxBalls: maxBalls,
        bbMaxSpeedBonus: bbMaxSpeedBonus,
        bbMaxPowerBonus: bbMaxPowerBonus,
        bbUpgradeCosts: bbUpgradeCosts,
        balls: balls.map(ball => ({ type: ball.type, x: ball.x, y: ball.y })),
        sfxVolume: Math.round(sfxVolume * 100),
        musicVolume: Math.round(musicVolume * 100),
        damageStats: damageStats,
        gold: gold,
        goldEarnedThisPrestige: goldEarnedThisPrestige,
        bossesKilled: bossesKilled,
        prestigeLevel: prestigeLevel,
        prestigeBuffs: prestigeBuffs,
        laserDamage: laserDamage,
        laserUpgradeCost: laserUpgradeCost,
        laserPurchases: laserPurchases,
        prestigeUpgradeCosts: prestigeUpgradeCosts,
        bossRushLevel: bossRushLevel,
        bossRushCost: bossRushCost,
        ballPurchaseCounts: ballPurchaseCounts,
        lastSaveTime: Date.now()
    };
    localStorage.setItem('idleBreakoutSave', JSON.stringify(saveData));
    localStorage.setItem('idleBreakoutSfxVolume', Math.round(sfxVolume * 100));
    localStorage.setItem('idleBreakoutMusicVolume', Math.round(musicVolume * 100));
}

// Load game from localStorage
function loadGame() {
    const saveData = localStorage.getItem('idleBreakoutSave');
    if (saveData) {
        const data = JSON.parse(saveData);
        money = data.money || 0;
        level = data.level || 1;
        ballSpeed = data.ballSpeed || 0.5;
        ballPower = data.ballPower || 1;
        clickPower = data.clickPower || 1;
        bbCurrency = data.bbCurrency || 0;
        maxBalls = data.maxBalls || 50;
        bbMaxSpeedBonus = data.bbMaxSpeedBonus || 0;
        bbMaxPowerBonus = data.bbMaxPowerBonus || 1;
        
        if (data.ballTypes) {
            for (let type in data.ballTypes) {
                ballTypes[type].cost = data.ballTypes[type].cost;
            }
        }
        
        if (data.ballUpgrades) {
            ballUpgrades = data.ballUpgrades;
        }
        
        if (data.ballUpgradeCosts) {
            ballUpgradeCosts = data.ballUpgradeCosts;
        }
        
        if (data.ballPurchaseCounts) {
            ballPurchaseCounts = data.ballPurchaseCounts;
            // Recalculate current costs based on purchase counts
            for (let type in ballPurchaseCounts) {
                ballTypes[type].cost = Math.floor(ballBaseCosts[type] * Math.pow(1.5, ballPurchaseCounts[type]));
            }
        }
        
        if (data.upgradeCosts) {
            upgradeCosts = data.upgradeCosts;
        }
        
        if (data.bbUpgradeCosts) {
            bbUpgradeCosts = data.bbUpgradeCosts;
        }
        
        if (data.sfxVolume !== undefined) {
            sfxVolume = data.sfxVolume / 100;
        }
        
        if (data.musicVolume !== undefined) {
            musicVolume = data.musicVolume / 100;
        }
        
        if (data.damageStats) {
            damageStats = data.damageStats;
        }
        
        if (data.gold !== undefined) {
            gold = data.gold;
        }
        
        if (data.goldEarnedThisPrestige !== undefined) {
            goldEarnedThisPrestige = data.goldEarnedThisPrestige;
        }
        
        if (data.bossesKilled !== undefined) {
            bossesKilled = data.bossesKilled;
        }
        
        if (data.prestigeLevel !== undefined) {
            prestigeLevel = data.prestigeLevel;
        }
        
        if (data.prestigeBuffs) {
            prestigeBuffs = data.prestigeBuffs;
            // Ensure goldBoost exists in loaded data
            if (prestigeBuffs.goldBoost === undefined) {
                prestigeBuffs.goldBoost = 0;
            }
        }
        
        if (data.laserDamage !== undefined) {
            laserDamage = data.laserDamage;
        }
        
        if (data.laserUpgradeCost !== undefined) {
            laserUpgradeCost = data.laserUpgradeCost;
        }
        
        if (data.laserPurchases) {
            laserPurchases = data.laserPurchases;
            // Rebuild lasers
            lasers = [];
            if (laserPurchases.laser1) lasers.push(new Laser('top'));
            if (laserPurchases.laser2) lasers.push(new Laser('bottom'));
            if (laserPurchases.laser3) lasers.push(new Laser('left'));
            if (laserPurchases.laser4) lasers.push(new Laser('right'));
        }
        
        if (data.prestigeUpgradeCosts) {
            prestigeUpgradeCosts = data.prestigeUpgradeCosts;
        }
        
        if (data.bossRushLevel !== undefined) {
            bossRushLevel = data.bossRushLevel;
        }
        
        if (data.bossRushCost !== undefined) {
            bossRushCost = data.bossRushCost;
        }
        
        // Ensure goldBoost cost is set if not present in save
        if (!prestigeUpgradeCosts.goldBoost) {
            prestigeUpgradeCosts.goldBoost = 10;
        }
        
        balls = [];
        if (data.balls) {
            data.balls.forEach(ballData => {
                const ball = new Ball(ballData.type);
                ball.x = ballData.x;
                ball.y = ballData.y;
                balls.push(ball);
            });
        }
        
        initBricks();
        updateUI();
        
        // Calculate offline progress
        if (data.lastSaveTime) {
            const now = Date.now();
            const offlineTime = (now - data.lastSaveTime) / 1000; // Convert to seconds
            const maxOfflineTime = 8 * 60 * 60; // Max 8 hours of offline progress
            const effectiveOfflineTime = Math.min(offlineTime, maxOfflineTime);
            
            if (effectiveOfflineTime > 60) { // Only if offline for more than 1 minute
                // Calculate average DPS (damage per second)
                let totalDPS = 0;
                for (let ball of balls) {
                    const damage = ball.getDamage();
                    const speed = ball.baseSpeed * ballSpeed * ball.getSpeedMultiplier() * (1 + bbMaxSpeedBonus) * window.speedMultiplier;
                    totalDPS += damage * speed * 10; // Rough estimate of hits per second
                }
                
                // Add laser damage
                for (let laser of lasers) {
                    totalDPS += laserDamage * (1 / 3); // Lasers fire every 3 seconds
                }
                
                // Calculate offline earnings
                const offlineMoney = totalDPS * effectiveOfflineTime * 0.5; // 50% efficiency offline
                const offlineLevels = Math.floor(effectiveOfflineTime / 300); // Rough estimate: 5 minutes per level
                
                if (offlineMoney > 0) {
                    money += offlineMoney;
                    level += offlineLevels;
                    
                    // Show offline progress notification
                    setTimeout(() => {
                        showPopup('Welcome Back!', `You were away for ${Math.floor(effectiveOfflineTime / 60)} minutes.<br><br>You earned:<br>$${simplifyNumber(offlineMoney)}<br>${offlineLevels} levels<br>while offline.`);
                    }, 500);
                }
            }
        }
    }
}

// Reset game
function resetGame() {
    localStorage.removeItem('idleBreakoutSave');
    localStorage.removeItem('idleBreakoutVolume');
    money = 0;
    level = 1;
    balls = [];
    ballSpeed = 0.5;
    ballPower = 1;
    clickPower = 1;
    bbCurrency = 0;
    maxBalls = 50;
    bbMaxSpeedBonus = 0;
    bbMaxPowerBonus = 1; // unused now but keep for save compatibility
    sfxVolume = 0.1;
    musicVolume = 0.1;
    
    // Reset damage stats
    damageStats = {
        basic: 0,
        plasma: 0,
        sniper: 0,
        scatter: 0,
        cannonball: 0,
        poison: 0,
        click: 0,
        laser: 0
    };
    
    // Reset ball costs
    ballTypes.basic.cost = 10;
    ballTypes.plasma.cost = 200;
    ballTypes.sniper.cost = 1500;
    ballTypes.scatter.cost = 10000;
    ballTypes.cannonball.cost = 75000;
    ballTypes.poison.cost = 75000;
    
    // Reset ball upgrades
    ballUpgrades = {
        basic: { power: 0, special: 0 },
        plasma: { power: 0, special: 0 },
        sniper: { power: 0, special: 0 },
        scatter: { power: 0, special: 0 },
        cannonball: { power: 0, special: 0 },
        poison: { power: 0, special: 0 }
    };
    
    // Reset ball upgrade costs
    ballUpgradeCosts = {
        basic: { power: 50, special: 75 },
        plasma: { power: 100, special: 150 },
        sniper: { power: 100, special: 150 },
        scatter: { power: 100, special: 150 },
        cannonball: { power: 200, special: 300 },
        poison: { power: 200, special: 300 }
    };
    
    // Reset upgrade costs
    upgradeCosts = {
        click: 100
    };
    
    // Reset BB upgrade costs
    bbUpgradeCosts = {
        maxBalls: 100,
        maxSpeed: 25,
        maxPower: 25
    };
    
    // Reset prestige
    gold = 0;
    goldEarnedThisPrestige = 0;
    bossesKilled = 0;
    prestigeLevel = 0;
    prestigeBuffs = {
        speed: 0,
        damage: 0,
        maxBalls: 0,
        goldBoost: 0
    };
    prestigeUpgradeCosts = {
        prestigeSpeed: 10,
        prestigeDamage: 10,
        prestigeMaxBalls: 10,
        goldBoost: 10
    };
    
    // Reset lasers
    lasers = [];
    laserDamage = 1;
    laserUpgradeCost = 100;
    laserPurchases = {
        laser1: false,
        laser2: false,
        laser3: false,
        laser4: false
    };
    
    // Reset boss rush
    bossRushLevel = 1;
    bossRushCost = 1000;
    inBossRush = false;
    bossRushProgress = 0;
    bossRushBosses = [];
    bossRushTimer = 0;
    bossRushMaxTime = 0;
    bossRushGoldReward = 0;
    savedLevel = 1;
    
    initBricks();
    updateUI();
}

// Initialize game
function initGame() {
    loadGame();
    if (balls.length === 0) {
        initBricks();
    }
    updateUI();
    
    // Initialize volume sliders
    const savedSfxVolume = localStorage.getItem('idleBreakoutSfxVolume');
    const savedMusicVolume = localStorage.getItem('idleBreakoutMusicVolume');
    
    if (savedSfxVolume) {
        sfxVolume = parseInt(savedSfxVolume) / 100;
        document.getElementById('sfxSlider').value = savedSfxVolume;
        document.getElementById('sfxValue').textContent = savedSfxVolume + '%';
        // Update all sound volumes
        if (sounds.hit) sounds.hit.volume = sfxVolume;
        if (sounds.buy) sounds.buy.volume = sfxVolume;
        if (sounds.button) sounds.button.volume = sfxVolume;
        if (sounds.zap) sounds.zap.volume = sfxVolume;
        if (sounds.quest) sounds.quest.volume = sfxVolume;
    }
    
    if (savedMusicVolume) {
        musicVolume = parseInt(savedMusicVolume) / 100;
        document.getElementById('musicSlider').value = savedMusicVolume;
        document.getElementById('musicValue').textContent = savedMusicVolume + '%';
        // Update music volume
        if (sounds.music) sounds.music.volume = musicVolume;
    }
    
    // Auto-save every 10 seconds
    setInterval(saveGame, 10000);
}

// Check ball-brick collision
function checkCollisions() {
    for (let ball of balls) {
        // Check main ball
        checkBallCollision(ball);
        
        // Check scatter balls
        for (let scatterBall of ball.scatterBalls) {
            checkScatterBallCollision(scatterBall);
        }
    }
}

function checkBallCollision(ball) {
    for (let brick of bricks) {
        if (!brick.alive) continue;

        if (ball.x + ball.radius > brick.x &&
            ball.x - ball.radius < brick.x + brick.width &&
            ball.y + ball.radius > brick.y &&
            ball.y - ball.radius < brick.y + brick.height) {
            
            // Apply damage
            let damage = ball.getDamage(brick);
            
            // Apply poison multiplier if brick is poisoned and ball is not poison
            if (brick.poisoned && ball.type !== 'poison') {
                damage *= brick.poisonMultiplier;
            }
            
            // Track damage
            damageStats[ball.type] += damage;
            
            // Phase-through if damage >= brick health
            if (damage >= brick.health) {
                // Sniper resets targeting after hitting a brick
                if (ball.type === 'sniper') {
                    ball.targetBrick = null;
                }
                
                // Plasma ball splash damage - scales 25% to 0% based on distance
                if (ball.type === 'plasma') {
                    const radius = ball.getPlasmaRadius();
                    for (let otherBrick of bricks) {
                        if (otherBrick !== brick && otherBrick.alive) {
                            const dist = Math.sqrt((otherBrick.x - brick.x) ** 2 + (otherBrick.y - brick.y) ** 2);
                            if (dist < radius) {
                                const splashPercent = 0.25 * (1 - dist / radius);
                                otherBrick.hit(damage * Math.max(0, splashPercent));
                                if (!otherBrick.alive) {
                                    awardBrickKill(otherBrick);
                                }
                            }
                        }
                    }
                }
                
                // Poison ball
                if (ball.type === 'poison') {
                    brick.poison(ball.getPoisonBonus(), ball.getPoisonMultiplier());
                    
                    // Small chance to spread poison to nearby bricks
                    if (Math.random() < 0.2) { // 20% chance
                        for (let otherBrick of bricks) {
                            if (otherBrick !== brick && otherBrick.alive && !otherBrick.poisoned) {
                                const dist = Math.sqrt((otherBrick.x - brick.x) ** 2 + (otherBrick.y - brick.y) ** 2);
                                if (dist < 150) { // Spread radius
                                    otherBrick.poison(ball.getPoisonBonus(), ball.getPoisonMultiplier());
                                }
                            }
                        }
                    }
                }
                
                // Scatter ball - spawn mini balls on boss brick destruction
                if (ball.type === 'scatter' && brick.isBoss) {
                    const ballCount = ball.getScatterBallCount();
                    for (let i = 0; i < ballCount; i++) {
                        const scatterBall = {
                            x: ball.x,
                            y: ball.y,
                            dx: (Math.random() - 0.5) * 6,
                            dy: (Math.random() - 0.5) * 6,
                            radius: 4,
                            damage: ball.baseDamage * 0.5 * ballPower,
                            color: ball.color,
                            lifetime: 600, // 10 seconds at 60fps
                            lastHitTime: 0,
                            update: function() {
                                const movementScale = deltaTime * 60; // Scale to 60fps baseline
                                this.x += this.dx * (ballSpeed / 2.8) * window.speedMultiplier * movementScale;
                                this.y += this.dy * (ballSpeed / 2.8) * window.speedMultiplier * movementScale;
                                this.lifetime -= deltaTime * 60; // Convert to frames
                            },
                            draw: function() {
                                ctx.beginPath();
                                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                                ctx.fillStyle = this.color;
                                ctx.fill();
                                ctx.closePath();
                            }
                        };
                        ball.scatterBalls.push(scatterBall);
                    }
                }

                brick.hit(damage);
                playSound('hit');
                
                if (!brick.alive) {
                    awardBrickKill(brick);
                }
                
                updateUI();
                continue; // Phase through to next brick
            }
            
            // Bounce logic (only if damage < brick health)
            // Determine collision side
            const overlapLeft = ball.x + ball.radius - brick.x;
            const overlapRight = brick.x + brick.width - (ball.x - ball.radius);
            const overlapTop = ball.y + ball.radius - brick.y;
            const overlapBottom = brick.y + brick.height - (ball.y - ball.radius);

            const minOverlapX = Math.min(overlapLeft, overlapRight);
            const minOverlapY = Math.min(overlapTop, overlapBottom);

            // Push ball out of brick to prevent getting stuck
            if (minOverlapX < minOverlapY) {
                ball.dx = -ball.dx;
                if (overlapLeft < overlapRight) {
                    ball.x = brick.x - ball.radius;
                } else {
                    ball.x = brick.x + brick.width + ball.radius;
                }
            } else {
                ball.dy = -ball.dy;
                if (overlapTop < overlapBottom) {
                    ball.y = brick.y - ball.radius;
                } else {
                    ball.y = brick.y + brick.height + ball.radius;
                }
            }

            // Sniper resets targeting after hitting a brick
            if (ball.type === 'sniper') {
                ball.targetBrick = null;
            }
            
            // Plasma ball splash damage - scales 25% to 0% based on distance
            if (ball.type === 'plasma') {
                const radius = ball.getPlasmaRadius();
                for (let otherBrick of bricks) {
                    if (otherBrick !== brick && otherBrick.alive) {
                        const dist = Math.sqrt((otherBrick.x - brick.x) ** 2 + (otherBrick.y - brick.y) ** 2);
                        if (dist < radius) {
                            const splashPercent = 0.25 * (1 - dist / radius);
                            otherBrick.hit(damage * Math.max(0, splashPercent));
                            if (!otherBrick.alive) {
                                awardBrickKill(otherBrick);
                            }
                        }
                    }
                }
            }
            
            // Poison ball
            if (ball.type === 'poison') {
                brick.poison(ball.getPoisonBonus(), ball.getPoisonMultiplier());
            }

            brick.hit(damage);
            playSound('hit');
            
            if (!brick.alive) {
                awardBrickKill(brick);
            }
            
            updateUI();
            break;
        }
    }
}

function checkScatterBallCollision(scatterBall) {
    for (let brick of bricks) {
        if (!brick.alive) continue;

        if (scatterBall.x + scatterBall.radius > brick.x &&
            scatterBall.x - scatterBall.radius < brick.x + brick.width &&
            scatterBall.y + scatterBall.radius > brick.y &&
            scatterBall.y - scatterBall.radius < brick.y + brick.height) {
            
            let damage = scatterBall.damage;
            
            // Apply boss debuffs if target is a boss
            if (brick.isBoss && brick.bossDebuffs) {
                const debuff = brick.bossDebuffs.find(d => d.type === 'scatter');
                if (debuff) {
                    damage *= debuff.multiplier;
                }
            }
            
            // Apply poison multiplier if brick is poisoned
            if (brick.poisoned) {
                damage *= brick.poisonMultiplier;
            }
            
            // Track damage
            damageStats.scatter += damage;
            
            // Phase-through if damage >= brick health
            if (damage >= brick.health) {
                brick.hit(damage);
                playSound('hit');
                
                if (!brick.alive) {
                    awardBrickKill(brick);
                }
                
                updateUI();
                continue; // Phase through to next brick
            }
            
            brick.hit(damage);
            playSound('hit');
            
            if (!brick.alive) {
                awardBrickKill(brick);
            }
            
            updateUI();
            scatterBall.lifetime = 0; // Mark for removal
            break;
        }
    }
}

// Click to damage bricks
canvas.addEventListener('click', (e) => {
    // Enable sound on first click as workaround
    if (!audioContext) {
        initAudio();
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
        sounds.music.play().catch(e => {
            console.log('Music play error:', e);
        });
    }
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    for (let brick of bricks) {
        if (!brick.alive) continue;
        
        // Cannot click on black bricks
        if (brick.isBB) continue;
        
        if (x > brick.x && x < brick.x + brick.width &&
            y > brick.y && y < brick.y + brick.height) {
            brick.hit(clickPower);
            playSound('hit');
            
            // Track click damage
            damageStats.click += clickPower;
            
            if (!brick.alive) {
                awardBrickKill(brick);
            }
            
            updateUI();
            break;
        }
    }
});

// Update UI
function updateUI() {
    document.getElementById('moneyDisplay').textContent = `Money: $${simplifyNumber(money)}`;
    document.getElementById('levelDisplay').textContent = `Level ${level}`;
    document.getElementById('bb').textContent = simplifyNumber(bbCurrency);
    document.getElementById('ballCount').textContent = `${balls.length}/${maxBalls}`;
    
    // Update gold display with (+n) indicator
    let goldText = `Gold: ${gold}`;
    if (goldEarnedThisPrestige > 0) {
        goldText += ` (+${goldEarnedThisPrestige})`;
    }
    document.getElementById('goldDisplay').textContent = goldText;
    
    // Update prestige shop buttons
    document.querySelectorAll('.prestige-upgrade-btn').forEach(btn => {
        const upgradeType = btn.dataset.prestige;
        const costEl = btn.querySelector('.upgrade-cost');
        
        if (upgradeType === 'laser1') {
            btn.disabled = laserPurchases.laser1 || gold < 10;
            btn.style.display = laserPurchases.laser1 ? 'none' : 'block';
        } else if (upgradeType === 'laser2') {
            btn.disabled = laserPurchases.laser2 || gold < 25;
            btn.style.display = laserPurchases.laser2 ? 'none' : 'block';
        } else if (upgradeType === 'laser3') {
            btn.disabled = laserPurchases.laser3 || gold < 50;
            btn.style.display = laserPurchases.laser3 ? 'none' : 'block';
        } else if (upgradeType === 'laser4') {
            btn.disabled = laserPurchases.laser4 || gold < 100;
            btn.style.display = laserPurchases.laser4 ? 'none' : 'block';
        } else if (upgradeType === 'prestigeSpeed') {
            const cost = prestigeUpgradeCosts.prestigeSpeed;
            btn.disabled = gold < cost;
            if (costEl && costEl.id === 'prestigeSpeedCost') {
                costEl.textContent = `${cost} Gold`;
            }
        } else if (upgradeType === 'prestigeDamage') {
            const cost = prestigeUpgradeCosts.prestigeDamage;
            btn.disabled = gold < cost;
            if (costEl && costEl.id === 'prestigeDamageCost') {
                costEl.textContent = `${cost} Gold`;
            }
        } else if (upgradeType === 'prestigeMaxBalls') {
            const cost = prestigeUpgradeCosts.prestigeMaxBalls;
            btn.disabled = gold < cost;
            if (costEl && costEl.id === 'prestigeMaxBallsCost') {
                costEl.textContent = `${cost} Gold`;
            }
        } else if (upgradeType === 'goldBoost') {
            const cost = prestigeUpgradeCosts.goldBoost;
            const goldBoostCosts = [10, 50, 100, 250, 500, 1000];
            btn.disabled = gold < cost || prestigeBuffs.goldBoost >= goldBoostCosts.length; // Cap at 6 upgrades
            if (costEl && costEl.id === 'goldBoostCost') {
                costEl.textContent = `${cost} Gold`;
            }
        }
    });
    
    // Show/hide laser damage upgrade button based on laser purchases
    const hasLaser = laserPurchases.laser1 || laserPurchases.laser2 || laserPurchases.laser3 || laserPurchases.laser4;
    const laserDamageBtn = document.getElementById('laserDamageUpgradeBtn');
    if (laserDamageBtn) {
        laserDamageBtn.style.display = hasLaser ? 'block' : 'none';
    }
    
    // Update laser damage upgrade button
    if (hasLaser) {
        const laserDamageCost = laserUpgradeCost;
        const laserDamageCostEl = document.getElementById('laserDamageUpgradeCost');
        if (laserDamageCostEl) {
            laserDamageCostEl.textContent = `$${simplifyNumber(laserDamageCost)}`;
        }
        const laserDamageUpgradeBtn = document.querySelector('.upgrade-btn[data-upgrade="laserDamage"]');
        if (laserDamageUpgradeBtn) {
            laserDamageUpgradeBtn.disabled = money < laserDamageCost;
            const nameEl = laserDamageUpgradeBtn.querySelector('.upgrade-name');
            if (nameEl) {
                nameEl.textContent = `Laser Damage: ${simplifyNumber(laserDamage)} (+500)`;
            }
        }
    }
    
    // Update boss rush button
    const bossRushBtn = document.getElementById('bossRushBtn');
    if (bossRushBtn) {
        bossRushBtn.disabled = bbCurrency < bossRushCost || inBossRush;
        const bossRushCostEl = document.getElementById('bossRushCost');
        if (bossRushCostEl) {
            bossRushCostEl.textContent = `${simplifyNumber(bossRushCost)} BB`;
        }
    }
    
    // Update ball counts
    for (let type in ballTypes) {
        const count = balls.filter(ball => ball.type === type).length;
        const countEl = document.getElementById(`count-${type}`);
        if (countEl) {
            countEl.textContent = count;
        }
    }
    
    // Update ball buy buttons
    for (let type in ballTypes) {
        const btn = document.querySelector(`.ball-buy[data-ball="${type}"]`);
        if (btn) {
            const cost = ballTypes[type].cost;
            btn.disabled = money < cost || balls.length >= maxBalls;
        }
    }
    
    // Update ball sell buttons
    for (let type in ballTypes) {
        const btn = document.querySelector(`.ball-sell[data-ball="${type}"]`);
        if (btn) {
            const count = balls.filter(ball => ball.type === type).length;
            btn.disabled = count === 0;
        }
    }
    
    // Update ball cost display
    for (let type in ballTypes) {
        const costEl = document.querySelector(`.ball-item[data-ball="${type}"] .ball-cost`);
        if (costEl) {
            costEl.textContent = `$${simplifyNumber(ballTypes[type].cost)}`;
        }
    }
    
    // Update ball upgrade buttons
    for (let ballType in ballUpgrades) {
        for (let upgradeType in ballUpgrades[ballType]) {
            const btn = document.querySelector(`.ball-upgrade-btn[data-ball="${ballType}"][data-type="${upgradeType}"]`);
            if (btn) {
                const level = ballUpgrades[ballType][upgradeType];
                const cost = ballUpgradeCosts[ballType][upgradeType];
                btn.disabled = money < cost;
                
                // Calculate boost display
                let boostText = '';
                if (upgradeType === 'power') {
                    const multiplier = level + 1;
                    const baseDamage = ballTypes[ballType].damage;
                    const actualDamage = baseDamage * multiplier;
                    boostText = actualDamage.toString();
                } else if (upgradeType === 'special') {
                    if (ballType === 'scatter') {
                        boostText = `${3 + level}`;
                    } else if (ballType === 'poison') {
                        const multiplier = 2.0 + (level * 0.05);
                        boostText = `${multiplier.toFixed(2)}x`;
                    } else {
                        boostText = `+${level * 5}%`;
                    }
                }
                
                btn.querySelector('.upgrade-boost').textContent = boostText;
                btn.querySelector('.upgrade-cost').textContent = `$${simplifyNumber(cost)}`;
            }
        }
    }
    
    // Update global upgrade buttons
    for (let upgrade in upgradeCosts) {
        const btn = document.querySelector(`.upgrade-btn[data-upgrade="${upgrade}"]`);
        if (btn) {
            const cost = upgradeCosts[upgrade];
            btn.disabled = money < cost;
            btn.querySelector('.upgrade-cost').textContent = `$${simplifyNumber(cost)}`;
        }
    }
    
    // Update BB upgrade buttons
    for (let upgrade in bbUpgradeCosts) {
        const btn = document.querySelector(`.bb-upgrade-btn[data-bb-upgrade="${upgrade}"]`);
        if (btn) {
            const cost = bbUpgradeCosts[upgrade];
            btn.disabled = bbCurrency < cost;
            btn.querySelector('.upgrade-cost').textContent = `${simplifyNumber(cost)} BB`;
        }
    }
}

// Buy ball
function buyBall(type) {
    const cost = Math.floor(ballBaseCosts[type] * Math.pow(1.5, ballPurchaseCounts[type]));
    if (money >= cost && balls.length < maxBalls) {
        money -= cost;
        balls.push(new Ball(type));
        ballPurchaseCounts[type]++;
        ballTypes[type].cost = Math.floor(ballBaseCosts[type] * Math.pow(1.5, ballPurchaseCounts[type]));
        playSound('buy');
        updateUI();
    }
}

// Sell ball
function sellBall(type) {
    const ballIndex = balls.findIndex(ball => ball.type === type);
    if (ballIndex !== -1) {
        balls.splice(ballIndex, 1);
        // Refund 50% of the current price
        const currentCost = Math.floor(ballBaseCosts[type] * Math.pow(1.5, ballPurchaseCounts[type]));
        const refund = Math.floor(currentCost * 0.5);
        money += refund;
        if (ballPurchaseCounts[type] > 0) {
            ballPurchaseCounts[type]--;
            ballTypes[type].cost = Math.floor(ballBaseCosts[type] * Math.pow(1.5, ballPurchaseCounts[type]));
        }
        playSound('buy');
        updateUI();
    }
}

// Ball upgrade
function upgradeBall(ballType, upgradeType) {
    const cost = ballUpgradeCosts[ballType][upgradeType];
    if (money >= cost) {
        money -= cost;
        ballUpgrades[ballType][upgradeType]++;
        ballUpgradeCosts[ballType][upgradeType] = Math.ceil(cost * 1.5);
        playSound('buy');
        updateUI();
    }
}

// BB upgrade
function upgradeBB(upgradeType) {
    const cost = bbUpgradeCosts[upgradeType];
    if (bbCurrency >= cost) {
        bbCurrency -= cost;
        
        if (upgradeType === 'maxBalls') {
            maxBalls += 10;
            bbUpgradeCosts.maxBalls = Math.ceil(cost * 1.5);
        } else if (upgradeType === 'maxSpeed') {
            bbMaxSpeedBonus += 0.10; // +10% flat speed boost
            bbUpgradeCosts.maxSpeed = Math.ceil(cost * 1.5);
        } else if (upgradeType === 'maxPower') {
            // +1 base damage to all ball types
            for (let type in ballTypes) {
                ballTypes[type].damage += 1;
            }
            bbUpgradeCosts.maxPower = Math.ceil(cost * 1.5);
        }
        
        playSound('buy');
        updateUI();
    }
}

// Global upgrade
function upgrade(type) {
    if (type === 'laserDamage') {
        const cost = laserUpgradeCost;
        if (money >= cost) {
            money -= cost;
            laserDamage += 500;
            laserUpgradeCost = Math.ceil(cost * 1.5);
            playSound('buy');
            updateUI();
            saveGame();
        }
        return;
    }
    
    const cost = upgradeCosts[type];
    if (money >= cost) {
        money -= cost;
        
        if (type === 'click') {
            clickPower += 1;
            upgradeCosts.click = Math.ceil(upgradeCosts.click * 1.5);
        }
        
        playSound('buy');
        updateUI();
    }
}

// Next level
function nextLevel() {
    level++;
    initBricks();
    document.getElementById('nextLevel').style.display = 'none';
    updateUI();
}

// Popup system
function showPopup(title, message) {
    const popup = document.getElementById('gamePopup');
    const titleEl = document.getElementById('popupTitle');
    const messageEl = document.getElementById('popupMessage');
    
    titleEl.textContent = title;
    messageEl.innerHTML = message;
    popup.classList.add('active');
}

function hidePopup() {
    const popup = document.getElementById('gamePopup');
    popup.classList.remove('active');
}

// Close popup button
document.getElementById('closePopup').addEventListener('click', hidePopup);

// Event listeners
document.querySelectorAll('.ball-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const type = btn.dataset.ball;
        buyBall(type);
    });
});

document.querySelectorAll('.upgrade-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const type = btn.dataset.upgrade;
        upgrade(type);
    });
});

document.querySelectorAll('.ball-upgrade-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const ballType = btn.dataset.ball;
        const upgradeType = btn.dataset.type;
        upgradeBall(ballType, upgradeType);
    });
});

document.querySelectorAll('.ball-buy').forEach(btn => {
    btn.addEventListener('click', () => {
        const type = btn.dataset.ball;
        buyBall(type);
    });
});

document.querySelectorAll('.ball-sell').forEach(btn => {
    btn.addEventListener('click', () => {
        const type = btn.dataset.ball;
        sellBall(type);
    });
});

document.querySelectorAll('.bb-upgrade-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const upgradeType = btn.dataset.bbUpgrade;
        upgradeBB(upgradeType);
    });
});

document.getElementById('sfxSlider').addEventListener('input', (e) => {
    updateSfxVolume(parseInt(e.target.value));
});

document.getElementById('musicSlider').addEventListener('input', (e) => {
    updateMusicVolume(parseInt(e.target.value));
});

document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to reset the game? All progress will be lost.')) {
        resetGame();
    }
});

document.getElementById('prestigeBtn').addEventListener('click', function() {
    if (confirm(`Are you sure you want to prestige? You will earn ${goldEarnedThisPrestige} gold and reset all progress except prestige upgrades.`)) {
        prestige();
    }
});

document.querySelectorAll('.prestige-upgrade-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const upgradeType = btn.dataset.prestige;
        if (upgradeType) {
            buyPrestigeUpgrade(upgradeType);
        }
    });
});

document.getElementById('bossRushBtn').addEventListener('click', () => {
    showPopup('Boss Rush', 'Boss Rush is currently in development and coming soon!');
});

// Boss rush functions
function startBossRush() {
    if (bbCurrency < bossRushCost || inBossRush) return;
    
    bbCurrency -= bossRushCost;
    inBossRush = true;
    bossRushProgress = 0;
    bossRushGoldReward = 0;
    savedLevel = level; // Save current level
    
    // Generate boss pattern for this rush
    generateBossRushPattern();
    
    // Spawn first boss
    spawnNextBoss();
    
    updateUI();
    saveGame();
}

function generateBossRushPattern() {
    bossRushBosses = [];
    
    // Pattern: rush N has N level 1 bosses, N-1 level 2 bosses, ... 1 level N boss
    for (let bossLevel = 1; bossLevel <= bossRushLevel; bossLevel++) {
        const count = bossRushLevel - bossLevel + 1;
        for (let i = 0; i < count; i++) {
            bossRushBosses.push({
                level: bossLevel,
                hp: getBossHP(bossLevel),
                maxHp: getBossHP(bossLevel),
                debuffs: generateBossDebuffs(bossLevel),
                timer: getBossTimer(bossLevel),
                maxTimer: getBossTimer(bossLevel),
                hasFreeze: bossLevel >= 10
            });
        }
    }
}

function getBossHP(bossLevel) {
    const baseHP = [10000, 50000, 100000, 250000, 500000, 1000000, 2000000, 4000000, 10000000, 25000000, 50000000];
    
    if (bossLevel <= 11) {
        return baseHP[bossLevel - 1];
    }
    
    // Boss 12+: 100M base, 2x more health for each level above 11
    return 100000000 * Math.pow(2, bossLevel - 11);
}

function generateBossDebuffs(bossLevel) {
    const debuffs = [];
    const ballTypes = ['basic', 'plasma', 'sniper', 'scatter', 'cannonball', 'poison'];
    
    if (bossLevel === 2) {
        debuffs.push({ type: 'sniper', multiplier: 0.5 });
    } else if (bossLevel === 3) {
        debuffs.push({ type: 'plasma', multiplier: 0.5 });
        debuffs.push({ type: 'cannonball', multiplier: 0.5 });
    } else if (bossLevel === 4) {
        const random1 = ballTypes[Math.floor(Math.random() * ballTypes.length)];
        const random2 = ballTypes.filter(t => t !== random1)[Math.floor(Math.random() * (ballTypes.length - 1))];
        debuffs.push({ type: random1, multiplier: 0.5 });
        debuffs.push({ type: random2, multiplier: 2.0 });
    } else if (bossLevel === 5) {
        const random1 = ballTypes[Math.floor(Math.random() * ballTypes.length)];
        const random2 = ballTypes.filter(t => t !== random1)[Math.floor(Math.random() * (ballTypes.length - 1))];
        const random3 = ballTypes.filter(t => t !== random1 && t !== random2)[Math.floor(Math.random() * (ballTypes.length - 2))];
        debuffs.push({ type: random1, multiplier: 0.5 });
        debuffs.push({ type: random2, multiplier: 0.5 });
        debuffs.push({ type: random3, multiplier: 2.0 });
    } else if (bossLevel === 6) {
        const random1 = ballTypes[Math.floor(Math.random() * ballTypes.length)];
        const random2 = ballTypes.filter(t => t !== random1)[Math.floor(Math.random() * (ballTypes.length - 1))];
        const random3 = ballTypes.filter(t => t !== random1 && t !== random2)[Math.floor(Math.random() * (ballTypes.length - 2))];
        debuffs.push({ type: random1, multiplier: 0.5 });
        debuffs.push({ type: random2, multiplier: 0.5 });
        debuffs.push({ type: random3, multiplier: 0.1 });
    } else if (bossLevel >= 7) {
        // Always 2 random balls with 0.5x
        const random1 = ballTypes[Math.floor(Math.random() * ballTypes.length)];
        const random2 = ballTypes.filter(t => t !== random1)[Math.floor(Math.random() * (ballTypes.length - 1))];
        debuffs.push({ type: random1, multiplier: 0.5 });
        debuffs.push({ type: random2, multiplier: 0.5 });
        
        // Additional debuffs based on level
        if (bossLevel === 8) {
            const random3 = ballTypes.filter(t => t !== random1 && t !== random2)[Math.floor(Math.random() * (ballTypes.length - 2))];
            debuffs.push({ type: random3, multiplier: 2.0 });
        } else if (bossLevel === 9) {
            const random3 = ballTypes.filter(t => t !== random1 && t !== random2)[Math.floor(Math.random() * (ballTypes.length - 2))];
            debuffs.push({ type: random3, multiplier: 0.1 });
        } else if (bossLevel >= 12) {
            // 50% chance for 2x, 25% chance for 0.1x
            if (Math.random() < 0.5) {
                const random3 = ballTypes.filter(t => t !== random1 && t !== random2)[Math.floor(Math.random() * (ballTypes.length - 2))];
                debuffs.push({ type: random3, multiplier: 2.0 });
            }
            if (Math.random() < 0.25) {
                const random4 = ballTypes.filter(t => t !== random1 && t !== random2 && t !== (debuffs[2]?.type || ''))[Math.floor(Math.random() * (ballTypes.length - 3))];
                debuffs.push({ type: random4, multiplier: 0.1 });
            }
        }
    }
    
    return debuffs;
}

function getBossTimer(bossLevel) {
    if (bossLevel < 7) return 0; // No timer
    if (bossLevel === 7) return 300; // 5 minutes
    if (bossLevel === 8 || bossLevel === 9) return 360; // 6 minutes
    if (bossLevel >= 10) return 300; // 5 minutes for all bosses after 10
    return 0;
}

function spawnNextBoss() {
    if (bossRushProgress >= bossRushBosses.length) {
        // All bosses defeated - win the rush
        winBossRush();
        return;
    }
    
    const bossData = bossRushBosses[bossRushProgress];
    bossRushTimer = bossData.timer;
    bossRushMaxTime = bossData.maxTimer;
    
    // Clear existing bricks and spawn boss
    bricks = [];
    const boss = new Brick(canvas.width / 2 - 233.5, canvas.height / 2 - 83.5, bossData.hp);
    boss.width = 467;
    boss.height = 167;
    boss.isBoss = true;
    boss.health = bossData.hp;
    boss.maxHealth = bossData.maxHp;
    boss.bossLevel = bossData.level;
    boss.bossDebuffs = bossData.debuffs;
    boss.hasFreeze = bossData.hasFreeze;
    boss.freezeTimer = 0;
    bricks.push(boss);
}

function winBossRush() {
    inBossRush = false;
    
    // Calculate gold reward: round 1 = 1, round 2 = 3, round 3 = 6, round 4 = 10, etc. (triangular numbers)
    const goldReward = (bossRushLevel * (bossRushLevel + 1)) / 2;
    gold += goldReward;
    goldEarnedThisPrestige += goldReward; // Add to prestige earnings
    
    // Increase boss rush level and cost
    bossRushLevel++;
    bossRushCost += 1000;
    
    showPopup('Boss Rush Complete!', `You earned ${goldReward} gold!`);
    
    // Return to normal game at saved level
    level = savedLevel;
    initBricks();
    updateUI();
    saveGame();
}

function loseBossRush() {
    inBossRush = false;
    
    showPopup('Boss Rush Failed', 'Your BB was wasted.');
    
    // Return to normal game at saved level
    level = savedLevel;
    initBricks();
    updateUI();
    saveGame();
}

function prestige() {
    gold += goldEarnedThisPrestige;
    goldEarnedThisPrestige = 0;
    prestigeLevel++;
    
    // Reset game state but keep prestige upgrades
    money = 0;
    level = 1;
    balls = [];
    ballSpeed = 0.5;
    ballPower = 1;
    clickPower = 1;
    bbCurrency = 0;
    maxBalls = 50 + (prestigeBuffs.maxBalls * 10);
    bbMaxSpeedBonus = 0;
    bbMaxPowerBonus = 1; // unused now
    
    // Reset ball costs
    ballTypes.basic.cost = 10;
    ballTypes.plasma.cost = 200;
    ballTypes.sniper.cost = 1500;
    ballTypes.scatter.cost = 10000;
    ballTypes.cannonball.cost = 75000;
    ballTypes.poison.cost = 75000;
    
    // Reset ball upgrades
    ballUpgrades = {
        basic: { power: 0, special: 0 },
        plasma: { power: 0, special: 0 },
        sniper: { power: 0, special: 0 },
        scatter: { power: 0, special: 0 },
        cannonball: { power: 0, special: 0 },
        poison: { power: 0, special: 0 }
    };
    
    // Reset ball upgrade costs
    ballUpgradeCosts = {
        basic: { power: 50, special: 75 },
        plasma: { power: 100, special: 150 },
        sniper: { power: 100, special: 150 },
        scatter: { power: 100, special: 150 },
        cannonball: { power: 200, special: 300 },
        poison: { power: 200, special: 300 }
    };
    
    // Reset upgrade costs
    upgradeCosts = {
        click: 100
    };
    
    // Reset BB upgrade costs
    bbUpgradeCosts = {
        maxBalls: 100,
        maxSpeed: 25,
        maxPower: 25
    };
    
    // Don't reset damage stats - keep achievements
    
    // Reset lasers (keep purchases)
    lasers = [];
    if (laserPurchases.laser1) lasers.push(new Laser('top'));
    if (laserPurchases.laser2) lasers.push(new Laser('bottom'));
    if (laserPurchases.laser3) lasers.push(new Laser('left'));
    if (laserPurchases.laser4) lasers.push(new Laser('right'));
    
    initBricks();
    updateUI();
    saveGame();
}

function buyPrestigeUpgrade(upgradeType) {
    const cost = prestigeUpgradeCosts[upgradeType];
    
    if (upgradeType === 'laser1' && !laserPurchases.laser1 && gold >= 10) {
        gold -= 10;
        laserPurchases.laser1 = true;
        lasers.push(new Laser('top'));
    } else if (upgradeType === 'laser2' && !laserPurchases.laser2 && gold >= 25) {
        gold -= 25;
        laserPurchases.laser2 = true;
        lasers.push(new Laser('bottom'));
    } else if (upgradeType === 'laser3' && !laserPurchases.laser3 && gold >= 50) {
        gold -= 50;
        laserPurchases.laser3 = true;
        lasers.push(new Laser('left'));
    } else if (upgradeType === 'laser4' && !laserPurchases.laser4 && gold >= 100) {
        gold -= 100;
        laserPurchases.laser4 = true;
        lasers.push(new Laser('right'));
    } else if (upgradeType === 'prestigeSpeed' && gold >= cost) {
        gold -= cost;
        prestigeBuffs.speed++;
        prestigeUpgradeCosts.prestigeSpeed = 10 + (prestigeBuffs.speed * 25);
    } else if (upgradeType === 'prestigeDamage' && gold >= cost) {
        gold -= cost;
        prestigeBuffs.damage++;
        prestigeUpgradeCosts.prestigeDamage = 10 + (prestigeBuffs.damage * 25);
        // Buy 2 power upgrades for every ball type
        for (let type in ballUpgrades) {
            ballUpgrades[type].power += 2;
        }
    } else if (upgradeType === 'prestigeMaxBalls' && gold >= cost) {
        gold -= cost;
        prestigeBuffs.maxBalls++;
        maxBalls += 10;
        prestigeUpgradeCosts.prestigeMaxBalls = 10 + (prestigeBuffs.maxBalls * 25);
    } else if (upgradeType === 'goldBoost' && gold >= cost) {
        gold -= cost;
        prestigeBuffs.goldBoost++;
        // Gold boost costs: 10, 50, 100, 250, 500, 1000
        const goldBoostCosts = [10, 50, 100, 250, 500, 1000];
        if (prestigeBuffs.goldBoost < goldBoostCosts.length) {
            prestigeUpgradeCosts.goldBoost = goldBoostCosts[prestigeBuffs.goldBoost];
        } else {
            prestigeUpgradeCosts.goldBoost = 1000; // Cap at 1000
        }
    }
    
    playSound('buy');
    updateUI();
    saveGame();
}

document.getElementById('achievementsBtn').addEventListener('click', () => {
    showAchievements();
});

document.getElementById('closeAchievements').addEventListener('click', () => {
    document.getElementById('achievementsPopup').classList.remove('active');
});

function showAchievements() {
    const achievementsList = document.getElementById('achievementsList');
    achievementsList.innerHTML = '';
    
    const ballNames = {
        basic: 'Basic Ball',
        plasma: 'Plasma Ball',
        sniper: 'Sniper Ball',
        scatter: 'Scatter Ball',
        cannonball: 'Cannonball',
        poison: 'Poison Ball',
        click: 'Click Damage',
        laser: 'Laser'
    };
    
    for (let type in damageStats) {
        const item = document.createElement('div');
        item.className = 'achievement-item';
        item.innerHTML = `
            <span class="achievement-name">${ballNames[type] || type}</span>
            <span class="achievement-value">${simplifyNumber(damageStats[type])}</span>
        `;
        achievementsList.appendChild(item);
    }
    
    document.getElementById('achievementsPopup').classList.add('active');
    
    // Start live update interval
    if (!window.achievementsInterval) {
        window.achievementsInterval = setInterval(() => {
            if (document.getElementById('achievementsPopup').classList.contains('active')) {
                showAchievements();
            } else {
                clearInterval(window.achievementsInterval);
                window.achievementsInterval = null;
            }
        }, 500);
    }
}

// Game loop - split into logic (runs in background) and render (rAF)
const TARGET_FPS = 60;
const FRAME_MS = 1000 / TARGET_FPS;
let lastLogicTime = 0;
let deltaTime = 0; // Delta time in seconds for consistent speeds across refresh rates

function logicLoop() {
    if (!gameRunning) return;
    
    // Calculate delta time
    const currentTime = performance.now();
    deltaTime = (currentTime - lastLogicTime) / 1000; // Convert to seconds
    lastLogicTime = currentTime;
    
    // Cap delta time to prevent huge jumps (e.g., when tab was inactive)
    if (deltaTime > 0.1) deltaTime = 0.1;

    // Update bricks (poison ticks)
    for (let brick of bricks) {
        brick.updatePoison();
        
        // Update boss freeze timer
        if (brick.isBoss && brick.hasFreeze) {
            brick.freezeTimer += deltaTime * window.speedMultiplier;
            if (brick.freezeTimer >= 3) {
                brick.freezeTimer = 0;
                // Randomly freeze/unfreeze balls touching the boss
                for (let ball of balls) {
                    if (ball.x + ball.radius > brick.x && ball.x - ball.radius < brick.x + brick.width &&
                        ball.y + ball.radius > brick.y && ball.y - ball.radius < brick.y + brick.height) {
                        // Ball is touching boss - randomly freeze or unfreeze
                        if (Math.random() < 0.5) {
                            ball.frozen = true;
                            ball.freezeTimer = 60; // Freeze for 1 second
                        } else {
                            ball.frozen = false;
                        }
                    }
                }
            }
        }
        
        // Push balls outward if inside boss hitbox
        if (brick.isBoss) {
            for (let ball of balls) {
                if (ball.x + ball.radius > brick.x && ball.x - ball.radius < brick.x + brick.width &&
                    ball.y + ball.radius > brick.y && ball.y - ball.radius < brick.y + brick.height) {
                    // Ball is inside boss - push outward
                    const centerX = brick.x + brick.width / 2;
                    const centerY = brick.y + brick.height / 2;
                    const dx = ball.x - centerX;
                    const dy = ball.y - centerY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > 0) {
                        // Normalize and push outward
                        const pushSpeed = 5;
                        ball.dx = (dx / dist) * pushSpeed;
                        ball.dy = (dy / dist) * pushSpeed;
                        
                        // Move ball outside immediately
                        ball.x = centerX + (dx / dist) * (brick.width / 2 + ball.radius + 5);
                        ball.y = centerY + (dy / dist) * (brick.height / 2 + ball.radius + 5);
                    }
                }
            }
        }
    }

    // Update boss rush timer
    if (inBossRush && bossRushMaxTime > 0) {
        bossRushTimer -= deltaTime * window.speedMultiplier;
        if (bossRushTimer <= 0) {
            loseBossRush();
            return;
        }
    }

    // Update balls
    for (let ball of balls) {
        ball.update();
    }

    // Update lasers
    for (let laser of lasers) {
        laser.update();
    }

    // Check collisions
    checkCollisions();

    // Check if level complete - auto advance
    const aliveBricks = bricks.filter(b => b.alive);
    if (aliveBricks.length === 0) {
        if (inBossRush) {
            // Boss defeated - spawn next boss
            bossRushProgress++;
            spawnNextBoss();
        } else {
            // Normal level complete
            level++;
            initBricks();
        }
        updateUI();
        saveGame();
    }

    setTimeout(logicLoop, FRAME_MS);
}

function renderLoop() {
    if (!gameRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw bricks
    for (let brick of bricks) {
        brick.draw();
    }

    // Draw balls
    for (let ball of balls) {
        ball.draw();
    }

    // Draw lasers
    for (let laser of lasers) {
        laser.draw();
    }

    // Draw boss rush timer
    if (inBossRush && bossRushMaxTime > 0) {
        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        const minutes = Math.floor(bossRushTimer / 60);
        const seconds = Math.floor(bossRushTimer % 60);
        ctx.fillText(`Boss ${bossRushProgress + 1}/${bossRushBosses.length} - ${minutes}:${seconds.toString().padStart(2, '0')}`, canvas.width / 2, 30);
    }

    requestAnimationFrame(renderLoop);
}

function gameLoop() {
    logicLoop();
    renderLoop();
}

// Dev mode cheat keys
if (DEV_MODE) {
    document.addEventListener('keydown', (e) => {
        if (e.key === '1') {
            money *= 2;
            alert('Money doubled!');
            updateUI();
            saveGame();
        } else if (e.key === '2') {
            bbCurrency *= 2;
            alert('BB doubled!');
            updateUI();
            saveGame();
        } else if (e.key === '3') {
            gold *= 2;
            alert('Gold doubled!');
            updateUI();
            saveGame();
        }
    });
}

// Start game
initGame();
gameLoop();
