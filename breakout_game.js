const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

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
let bbMaxSpeedBonus = 1;
let bbMaxPowerBonus = 1;
let sfxVolume = 0.1;
let musicVolume = 0.1;

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

// Ball types and costs
const ballTypes = {
    basic: { cost: 10, damage: 1, speed: 1.0, color: '#e94560', radius: 8 },
    plasma: { cost: 200, damage: 3, speed: 1.0, color: '#9b59b6', radius: 10 },
    sniper: { cost: 1500, damage: 3, speed: 2.0, color: '#3498db', radius: 7 },
    scatter: { cost: 10000, damage: 10, speed: 0.4, color: '#f1c40f', radius: 6 },
    cannonball: { cost: 75000, damage: 50, speed: 0.5, color: '#808080', radius: 15 },
    poison: { cost: 75000, damage: 10, speed: 3.0, color: '#27ae60', radius: 9 }
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
        
        // Random direction (not perfectly horizontal or vertical)
        const angle = (Math.random() * Math.PI / 2) + Math.PI / 4;
        const direction = Math.random() < 0.5 ? 1 : -1;
        this.dx = Math.cos(angle) * this.baseSpeed * direction;
        this.dy = -Math.sin(angle) * this.baseSpeed;
        
        // Special abilities
        this.scatterBalls = [];
        this.poisonedBricks = new Set();
        this.targetBrick = null; // For sniper targeting
        this.hasAimed = false; // Track if sniper has aimed at current target
    }

    update() {
        const speedMultiplier = (ballSpeed / 0.5) * this.getSpeedMultiplier() * bbMaxSpeedBonus;
        const damageMultiplier = ballPower;
        
        this.x += this.dx * speedMultiplier;
        this.y += this.dy * speedMultiplier;

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
            ball.draw();
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
        
        if (this.type === 'scatter') {
            // Create scatter balls
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
                    lifetime: 300, // 5 seconds at 60fps
                    lastHitTime: 0,
                    update: function() {
                        this.x += this.dx * (ballSpeed / 2.8);
                        this.y += this.dy * (ballSpeed / 2.8);
                        this.lifetime--;
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
            const speed = Math.sqrt(this.dx ** 2 + this.dy ** 2);
            this.dx = Math.cos(angle) * speed;
            this.dy = Math.sin(angle) * speed;
        }
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }

    getDamage() {
        const powerLevel = ballUpgrades[this.type].power;
        const prestigeDamageMultiplier = 1 + (prestigeBuffs.damage * 0.10);
        return (this.baseDamage * (powerLevel + 1)) * ballPower * bbMaxPowerBonus * prestigeDamageMultiplier;
    }
    
    getSpeedMultiplier() {
        if (this.type === 'basic' || this.type === 'cannonball' || this.type === 'sniper') {
            const speedBonus = ballUpgrades[this.type].special * 0.05;
            const prestigeSpeedMultiplier = 1 + (prestigeBuffs.speed * 0.10);
            return (1 + speedBonus) * prestigeSpeedMultiplier;
        }
        const prestigeSpeedMultiplier = 1 + (prestigeBuffs.speed * 0.10);
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
        this.fireInterval = 180; // 3 seconds at 60fps
        this.firing = false;
        this.fireDuration = 10; // How long the beam lasts
        
        this.initPosition();
    }
    
    initPosition() {
        if (this.position === 'top') {
            this.x = 0;
            this.y = 0;
        } else if (this.position === 'bottom') {
            this.x = 0;
            this.y = canvas.height - 20;
        } else if (this.position === 'left') {
            this.x = 0;
            this.y = 0;
        } else if (this.position === 'right') {
            this.x = canvas.width - 20;
            this.y = 0;
        }
    }
    
    update() {
        this.timer++;
        
        if (this.timer >= this.fireInterval && !this.firing) {
            this.fire();
            this.timer = 0;
            this.firing = true;
        }
        
        if (this.firing) {
            this.fireDuration--;
            if (this.fireDuration <= 0) {
                this.firing = false;
                this.fireDuration = 10;
            }
        }
        
        // Move laser across
        if (this.position === 'top' || this.position === 'bottom') {
            this.x += this.speed;
            if (this.x > canvas.width) {
                this.x = -20;
            }
        } else {
            this.y += this.speed;
            if (this.y > canvas.height) {
                this.y = -20;
            }
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
                damageStats.laser += laserDamage;
                brick.hit(laserDamage);
                if (!brick.alive) {
                    if (brick.isBB) {
                        bbCurrency += 1;
                    } else {
                        money += brick.maxHealth;
                        if (brick.isBoss) {
                            bossesKilled++;
                            const goldMultiplier = Math.pow(2, prestigeBuffs.goldBoost);
                            goldEarnedThisPrestige += 1 + goldMultiplier;
                        }
                    }
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
        } else {
            ctx.fillText(simplifyNumber(this.health), this.x + this.width / 2, this.y + this.height / 2 + (this.isBoss ? 10 : 5));
        }
        
        if (this.isBoss) {
            ctx.fillStyle = '#ffd700';
            ctx.font = '16px Arial';
            ctx.fillText('BOSS', this.x + this.width / 2, this.y - 10);
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
            this.poisonTimer--;
            if (this.poisonTimer <= 0) {
                this.poisoned = false;
                this.poisonMultiplier = 1; // Reset multiplier
            } else if (this.poisonTimer % 60 === 0) {
                // Take poison damage every second
                this.health -= ballPower * this.poisonBonus;
                // Auto-destroy bricks with health < 1
                if (this.health < 1 && this.health > 0) {
                    this.health = 0;
                }
                if (this.health <= 0) {
                    this.alive = false;
                }
            }
        }
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
                brick.health = level * 10;
                brick.maxHealth = level * 10;
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
        laserPurchases: laserPurchases,
        prestigeUpgradeCosts: prestigeUpgradeCosts
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
        bbMaxSpeedBonus = data.bbMaxSpeedBonus || 1;
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
    bbMaxSpeedBonus = 1;
    bbMaxPowerBonus = 1;
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
    }
    
    if (savedMusicVolume) {
        musicVolume = parseInt(savedMusicVolume) / 100;
        document.getElementById('musicSlider').value = savedMusicVolume;
        document.getElementById('musicValue').textContent = savedMusicVolume + '%';
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
            let damage = ball.getDamage();
            
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
                    if (brick.isBB) {
                        bbCurrency += 1;
                    } else {
                        money += brick.maxHealth;
                        // Track boss kills for gold
                        if (brick.isBoss) {
                            bossesKilled++;
                            const goldMultiplier = Math.pow(2, prestigeBuffs.goldBoost);
                            goldEarnedThisPrestige += 1 + goldMultiplier;
                        }
                    }
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
            
            // Track damage (bounce case)
            damageStats[ball.type] += damage;
            
            // Plasma ball splash damage - scales 25% to 0% based on distance
            if (ball.type === 'plasma') {
                const radius = ball.getPlasmaRadius();
                for (let otherBrick of bricks) {
                    if (otherBrick !== brick && otherBrick.alive) {
                        const dist = Math.sqrt((otherBrick.x - brick.x) ** 2 + (otherBrick.y - brick.y) ** 2);
                        if (dist < radius) {
                            const splashPercent = 0.25 * (1 - dist / radius);
                            otherBrick.hit(damage * Math.max(0, splashPercent));
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
                if (brick.isBB) {
                    bbCurrency += 1;
                } else {
                    money += brick.maxHealth;
                    // Track boss kills for gold
                    if (brick.isBoss) {
                        bossesKilled++;
                        const goldMultiplier = Math.pow(2, prestigeBuffs.goldBoost);
                        goldEarnedThisPrestige += 1 + goldMultiplier;
                    }
                }
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
                    if (brick.isBB) {
                        bbCurrency += 1;
                    } else {
                        money += brick.maxHealth;
                    }
                }
                
                updateUI();
                continue; // Phase through to next brick
            }
            
            brick.hit(damage);
            playSound('hit');
            
            // Track damage (bounce case)
            damageStats.scatter += damage;
            
            if (!brick.alive) {
                if (brick.isBB) {
                    bbCurrency += 1;
                } else {
                    money += brick.maxHealth;
                }
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
                money += brick.maxHealth;
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
        } else if (upgradeType === 'laser2') {
            btn.disabled = laserPurchases.laser2 || gold < 25;
        } else if (upgradeType === 'laser3') {
            btn.disabled = laserPurchases.laser3 || gold < 50;
        } else if (upgradeType === 'laser4') {
            btn.disabled = laserPurchases.laser4 || gold < 100;
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
            costEl.textContent = `$${ballTypes[type].cost.toLocaleString()}`;
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
                btn.querySelector('.upgrade-cost').textContent = `$${cost.toLocaleString()}`;
            }
        }
    }
    
    // Update global upgrade buttons
    for (let upgrade in upgradeCosts) {
        const btn = document.querySelector(`.upgrade-btn[data-upgrade="${upgrade}"]`);
        if (btn) {
            const cost = upgradeCosts[upgrade];
            btn.disabled = money < cost;
            btn.querySelector('.upgrade-cost').textContent = `$${cost.toLocaleString()}`;
        }
    }
    
    // Update BB upgrade buttons
    for (let upgrade in bbUpgradeCosts) {
        const btn = document.querySelector(`.bb-upgrade-btn[data-bb-upgrade="${upgrade}"]`);
        if (btn) {
            const cost = bbUpgradeCosts[upgrade];
            btn.disabled = bbCurrency < cost;
            btn.querySelector('.upgrade-cost').textContent = `${cost} BB`;
        }
    }
}

// Buy ball
function buyBall(type) {
    const cost = ballTypes[type].cost;
    if (money >= cost && balls.length < maxBalls) {
        money -= cost;
        balls.push(new Ball(type));
        ballTypes[type].cost = Math.floor(ballTypes[type].cost * 1.15);
        playSound('buy');
        updateUI();
    }
}

// Sell ball
function sellBall(type) {
    const ballIndex = balls.findIndex(ball => ball.type === type);
    if (ballIndex !== -1) {
        balls.splice(ballIndex, 1);
        const refund = Math.floor(ballTypes[type].cost * 0.5);
        money += refund;
        ballTypes[type].cost = Math.floor(ballTypes[type].cost * 0.85);
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
            bbMaxSpeedBonus *= 1.05;
            bbUpgradeCosts.maxSpeed = Math.ceil(cost * 1.5);
        } else if (upgradeType === 'maxPower') {
            bbMaxPowerBonus *= 1.05;
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

document.getElementById('prestigeBtn').addEventListener('click', () => {
    if (confirm(`Are you sure you want to prestige? You will earn ${goldEarnedThisPrestige} gold and reset all progress except prestige upgrades.`)) {
        prestige();
    }
});

document.querySelectorAll('.prestige-upgrade-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const upgradeType = btn.dataset.prestige;
        buyPrestigeUpgrade(upgradeType);
    });
});

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
    bbMaxSpeedBonus = 1;
    bbMaxPowerBonus = 1;
    
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

// Game loop
function gameLoop() {
    if (!gameRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update and draw bricks
    for (let brick of bricks) {
        brick.updatePoison();
        brick.draw();
    }

    // Update and draw balls
    for (let ball of balls) {
        ball.update();
        ball.draw();
    }

    // Update and draw lasers
    for (let laser of lasers) {
        laser.update();
        laser.draw();
    }

    // Check collisions
    checkCollisions();

    // Check if level complete - auto advance
    const aliveBricks = bricks.filter(b => b.alive);
    if (aliveBricks.length === 0) {
        level++;
        initBricks();
        updateUI();
        saveGame();
    }

    requestAnimationFrame(gameLoop);
}

// Start game
initGame();
gameLoop();
