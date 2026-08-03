// Game State
const gameState = {
    inGame: false,
    inSettings: false,
    inAchievements: false,
    isPaused: false,
    isDead: false,
    canSkipCutscene: true,
    totalPlaytime: 0,
    sessionStartTime: null,
    movementTime: 0,
    movementKeys: {
        forward: 0,
        backward: 0,
        left: 0,
        right: 0
    },
    deathCount: 0,
    healCount: 0,
    healWithoutDeathCount: 0,
    rightClickCount: 0,
    rareEventCount: 0,
    russianQuestProgress: {
        movementKeys: 0,
        rareEvents: 0,
        healsWithoutDeath: 0
    },
    snipeTarget: null,
    healCooldown: false,
    isSprinting: false,
    isSneaking: false,
    musicVolume: 1,
    keybinds: {
        forward: 'w',
        backward: 's',
        left: 'a',
        right: 'd',
        weapon: 'click',
        activate: 'rightclick',
        jump: ' ',
        inventory: 'e',
        heal: 'z',
        sprint: 'shift',
        sneak: 'ctrl',
        scope: 'x',
        perspective: 'arrows',
        fov: '1-10',
        reload: 'r',
        crouch: 'c',
        prone: 'v',
        melee: 'f',
        grenade: 'g',
        useitem: 'h',
        drop: 'q',
        interact: 'f',
        map: 'm',
        compass: 'n',
        flashlight: 't',
        nightvision: 'b'
    }
};

// Achievement Definitions
const achievements = [
    {
        id: 'total_darkness',
        title: 'Total Darkness',
        description: 'Start the game for the first time',
        unlocked: false
    },
    {
        id: 'run_5k',
        title: 'Run a 5K',
        description: 'Walk a total of 5000m',
        unlocked: false
    },
    {
        id: 'snipe_citizen',
        title: 'Snipe a Citizen',
        description: 'Use your gun to shoot down a person',
        unlocked: false
    },
    {
        id: 'hit_by_car',
        title: 'Get hit by a car',
        description: 'You must be an idiot',
        unlocked: false
    },
    {
        id: 'all_nighter',
        title: 'Pull an all nighter',
        description: 'What a waste of time',
        unlocked: false
    },
    {
        id: 'drink_poison',
        title: 'Drink poison',
        description: 'How did you miss this?',
        unlocked: false
    },
    {
        id: 'run_10k',
        title: 'Run a 10K',
        description: 'How on earth did you do this',
        unlocked: false
    },
    {
        id: 'marathon',
        title: 'Run a marathon',
        description: 'This is lwk impressive',
        unlocked: false
    },
    {
        id: 'russia',
        title: 'Make a diplomatic relationship with Russia',
        description: 'Спасибо вам за это',
        unlocked: false
    },
    {
        id: 'ascension',
        title: 'Ascension',
        description: 'You are one with the stars',
        unlocked: false
    }
];

// DOM Elements
const mainMenu = document.getElementById('main-menu');
const gameScreen = document.getElementById('game-screen');
const settingsMenu = document.getElementById('settings-menu');
const achievementsMenu = document.getElementById('achievements-menu');
const deathScreen = document.getElementById('death-screen');
const achievementsList = document.getElementById('achievements-list');

// Load saved data
function loadGameData() {
    try {
        const savedData = localStorage.getItem('helenKellerSimulator');
        if (savedData) {
            const data = JSON.parse(savedData);
            gameState.totalPlaytime = data.totalPlaytime || 0;
            gameState.deathCount = data.deathCount || 0;
            gameState.movementTime = data.movementTime || 0;
            
            // Load achievement states by ID
            if (data.achievements) {
                data.achievements.forEach(savedAchievement => {
                    const achievement = achievements.find(a => a.id === savedAchievement.id);
                    if (achievement) {
                        achievement.unlocked = savedAchievement.unlocked;
                    }
                });
            }
            console.log('Game data loaded successfully');
        }
    } catch (err) {
        console.error('Error loading game data:', err);
    }
}

// Save game data
function saveGameData() {
    try {
        const data = {
            totalPlaytime: gameState.totalPlaytime,
            deathCount: gameState.deathCount,
            movementTime: gameState.movementTime,
            achievements: achievements.map(a => ({ id: a.id, unlocked: a.unlocked }))
        };
        localStorage.setItem('helenKellerSimulator', JSON.stringify(data));
        console.log('Game data saved successfully');
    } catch (err) {
        console.error('Error saving game data:', err);
    }
}

// Audio control functions
const bgMusic = document.getElementById('bg-music');
const uiSound = document.getElementById('ui-sound');

// Set UI sound to 10% volume
uiSound.volume = 0.1;

function playUISound() {
    uiSound.currentTime = 0;
    uiSound.play().catch(err => console.log('UI sound error:', err));
}

function fadeInMusic() {
    let volume = 0;
    bgMusic.volume = 0;
    bgMusic.play().catch(err => console.log('Music play error:', err));
    
    const fadeInterval = setInterval(() => {
        volume += 0.05;
        if (volume >= gameState.musicVolume) {
            volume = gameState.musicVolume;
            clearInterval(fadeInterval);
        }
        bgMusic.volume = volume;
    }, 100);
}

function fadeOutMusic(callback) {
    let volume = bgMusic.volume;
    
    const fadeInterval = setInterval(() => {
        volume -= 0.05;
        if (volume <= 0) {
            volume = 0;
            clearInterval(fadeInterval);
            bgMusic.pause();
            if (callback) callback();
        }
        bgMusic.volume = volume;
    }, 100);
}

// Start music on first click
let musicStarted = false;

function startMusic() {
    if (!musicStarted) {
        musicStarted = true;
        bgMusic.volume = 0;
        bgMusic.play().catch(err => console.log('Music play error:', err));
        fadeInMusic();
    }
}

// Start music on first click anywhere
document.addEventListener('click', () => {
    startMusic();
}, { once: true });

// Unlock achievement
function unlockAchievement(id) {
    const achievement = achievements.find(a => a.id === id);
    if (achievement && !achievement.unlocked) {
        achievement.unlocked = true;
        saveGameData();
        console.log(`Achievement Unlocked: ${achievement.title}`);
        showAchievementToast(achievement);
    }
}

// Show achievement toast
function showAchievementToast(achievement) {
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
        <div class="achievement-icon">🏆</div>
        <div class="achievement-info">
            <div class="achievement-title">${achievement.title}</div>
            <div class="achievement-description">${achievement.description}</div>
        </div>
    `;
    document.body.appendChild(toast);
    
    // Remove toast after animation completes (4.5s total: 0.5s fall + 4s linger + 0.5s float)
    setTimeout(() => {
        toast.remove();
    }, 4500);
}

// Initialize achievements menu
function initAchievementsMenu() {
    achievementsList.innerHTML = '';
    achievements.forEach(achievement => {
        const div = document.createElement('div');
        div.className = `achievement ${achievement.unlocked ? '' : 'locked'}`;
        div.innerHTML = `
            <div class="achievement-icon">${achievement.unlocked ? '🏆' : '?'}</div>
            <div class="achievement-info">
                <div class="achievement-title">${achievement.title}</div>
                <div class="achievement-description">${achievement.unlocked ? achievement.description : '???'}</div>
            </div>
        `;
        achievementsList.appendChild(div);
    });
}

// Main Menu Navigation
document.getElementById('play-btn').addEventListener('click', () => {
    playUISound();
    // Unlock Total Darkness achievement
    unlockAchievement('total_darkness');
    
    // Fade out music when entering game
    fadeOutMusic(() => {
        mainMenu.classList.add('fade-out');
        setTimeout(() => {
            mainMenu.classList.add('hidden');
            gameScreen.classList.remove('hidden');
            gameState.inGame = true;
            gameState.sessionStartTime = Date.now();
            generateSnipeTarget();
            startFPSCounter();
        }, 500);
    });
});

document.getElementById('settings-btn').addEventListener('click', () => {
    playUISound();
    fadeInMusic();
    mainMenu.classList.add('fade-out');
    setTimeout(() => {
        mainMenu.classList.add('hidden');
        settingsMenu.classList.remove('hidden');
        gameState.inSettings = true;
    }, 500);
});

document.getElementById('achievements-btn').addEventListener('click', () => {
    playUISound();
    fadeInMusic();
    initAchievementsMenu();
    mainMenu.classList.add('fade-out');
    setTimeout(() => {
        mainMenu.classList.add('hidden');
        achievementsMenu.classList.remove('hidden');
        gameState.inAchievements = true;
    }, 500);
});

// Settings Menu
document.getElementById('back-btn').addEventListener('click', () => {
    playUISound();
    settingsMenu.classList.add('fade-out');
    setTimeout(() => {
        settingsMenu.classList.add('hidden');
        settingsMenu.classList.remove('fade-out');
        gameState.inSettings = false;
        
        // Return to pause screen if in game, otherwise main menu
        if (gameState.inGame) {
            document.getElementById('pause-screen').classList.remove('hidden');
        } else {
            mainMenu.classList.remove('hidden');
            mainMenu.classList.remove('fade-out');
        }
    }, 500);
});

// Quality slider
const qualitySlider = document.getElementById('quality-slider');
const qualityValue = document.getElementById('quality-value');
const qualityLevels = ['Low', 'Medium', 'High', 'Very High', 'Realism'];
qualitySlider.addEventListener('input', (e) => {
    playUISound();
    qualityValue.textContent = qualityLevels[e.target.value - 1];
});

// Sound sliders
document.getElementById('sfx-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('sfx-value').textContent = e.target.value + '%';
});

document.getElementById('music-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('music-value').textContent = e.target.value + '%';
});

document.getElementById('bg-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('bg-value').textContent = e.target.value + '%';
});

// Useless graphics sliders
document.getElementById('bloom-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('bloom-value').textContent = e.target.value + '%';
});

document.getElementById('blur-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('blur-value').textContent = e.target.value + '%';
});

document.getElementById('ao-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('ao-value').textContent = e.target.value + '%';
});

document.getElementById('aa-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('aa-value').textContent = e.target.value + '%';
});

document.getElementById('shadow-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('shadow-value').textContent = e.target.value + '%';
});

document.getElementById('reflection-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('reflection-value').textContent = e.target.value + '%';
});

document.getElementById('refraction-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('refraction-value').textContent = e.target.value + '%';
});

document.getElementById('texture-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('texture-value').textContent = e.target.value + '%';
});

document.getElementById('geometry-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('geometry-value').textContent = e.target.value + '%';
});

document.getElementById('particle-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('particle-value').textContent = e.target.value + '%';
});

document.getElementById('water-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('water-value').textContent = e.target.value + '%';
});

document.getElementById('foliage-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('foliage-value').textContent = e.target.value + '%';
});

document.getElementById('lighting-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('lighting-value').textContent = e.target.value + '%';
});

document.getElementById('post-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('post-value').textContent = e.target.value + '%';
});

document.getElementById('fog-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('fog-value').textContent = e.target.value + '%';
});

// Keybind customization
let listeningKeybind = null;
document.querySelectorAll('.keybind-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playUISound();
        if (listeningKeybind) {
            listeningKeybind.classList.remove('listening');
        }
        btn.classList.add('listening');
        listeningKeybind = btn;
    });
});

document.addEventListener('keydown', (e) => {
    if (listeningKeybind) {
        e.preventDefault();
        const action = listeningKeybind.dataset.action;
        gameState.keybinds[action] = e.key.toLowerCase();
        listeningKeybind.textContent = e.key.toUpperCase();
        listeningKeybind.classList.remove('listening');
        listeningKeybind = null;
    }
});

// Reset keybinds button
document.getElementById('reset-keybinds-btn').addEventListener('click', () => {
    playUISound();
    gameState.keybinds = {
        forward: 'w',
        backward: 's',
        left: 'a',
        right: 'd',
        weapon: 'click',
        activate: 'rightclick',
        jump: ' ',
        inventory: 'e',
        heal: 'z',
        sprint: 'shift',
        sneak: 'ctrl',
        scope: 'x',
        perspective: 'arrows',
        fov: '1-10',
        reload: 'r',
        crouch: 'c',
        prone: 'v',
        melee: 'f',
        grenade: 'g',
        useitem: 'h',
        drop: 'q',
        interact: 'f',
        map: 'm',
        compass: 'n',
        flashlight: 't',
        nightvision: 'b'
    };
    
    // Update button text
    const keybindButtons = {
        forward: 'W',
        backward: 'S',
        left: 'A',
        right: 'D',
        weapon: 'Left Click',
        activate: 'Right Click',
        jump: 'Space',
        inventory: 'E',
        heal: 'Z',
        sprint: 'Shift',
        sneak: 'Ctrl',
        scope: 'X',
        perspective: 'Arrow Keys',
        fov: '1-10',
        reload: 'R',
        crouch: 'C',
        prone: 'V',
        melee: 'F',
        grenade: 'G',
        useitem: 'H',
        drop: 'Q',
        interact: 'F',
        map: 'M',
        compass: 'N',
        flashlight: 'T',
        nightvision: 'B'
    };
    
    Object.keys(keybindButtons).forEach(action => {
        const btn = document.querySelector(`[data-action="${action}"]`);
        if (btn) {
            btn.textContent = keybindButtons[action];
        }
    });
});

// Toggle buttons (satire - do nothing)
document.querySelectorAll('.toggle-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        playUISound();
        // These are satire toggles that don't actually do anything
        console.log('Toggle changed (satire)');
        
        // Show FPS toggle actually works
        if (checkbox.id === 'toggle25') {
            const fpsCounter = document.getElementById('fps-counter');
            if (checkbox.checked) {
                fpsCounter.classList.remove('hidden');
            } else {
                fpsCounter.classList.add('hidden');
            }
        }
    });
});

// FPS Counter
let lastFrameTime = performance.now();
let frameCount = 0;
let fps = 0;

function updateFPS() {
    const currentTime = performance.now();
    frameCount++;
    
    if (currentTime - lastFrameTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastFrameTime = currentTime;
        
        const fpsCounter = document.getElementById('fps-counter');
        if (fpsCounter && !fpsCounter.classList.contains('hidden')) {
            fpsCounter.textContent = `FPS: ${fps}`;
        }
    }
    
    requestAnimationFrame(updateFPS);
}

// Start FPS counter when game starts
function startFPSCounter() {
    lastFrameTime = performance.now();
    frameCount = 0;
    requestAnimationFrame(updateFPS);
}

// Character customization sliders
const eyeColors = ['Blue', 'Green', 'Brown', 'Hazel', 'Gray', 'Amber', 'Violet', 'Red', 'Black', 'Gold'];
const hairColors = ['Black', 'Brown', 'Blonde', 'Red', 'Gray', 'White', 'Pink', 'Blue', 'Green', 'Purple'];
const skinTones = ['Pale', 'Fair', 'Light', 'Medium', 'Olive', 'Tan', 'Brown', 'Dark', 'Deep', 'Ebony'];
const heights = ['Short', 'Below Average', 'Average', 'Above Average', 'Tall', 'Very Tall', 'Giant', 'Tiny', 'Huge', 'Massive'];
const bodyTypes = ['Skinny', 'Slim', 'Athletic', 'Muscular', 'Average', 'Heavy', 'Obese', 'Ripped', 'Bulky', 'Godlike'];
const facialHair = ['Clean', 'Stubble', 'Beard', 'Goatee', 'Mustache', 'Sideburns', 'Full Beard', 'Mutton Chops', 'Soul Patch', 'Handlebar'];
const hairstyles = ['Bald', 'Short', 'Medium', 'Long', 'Ponytail', 'Mohawk', 'Afro', 'Dreadlocks', 'Braids', 'Spiky'];
const scars = ['None', 'Small', 'Medium', 'Large', 'Facial', 'Body', 'Many', 'Battle', 'Burn', 'Brutal'];
const tattoos = ['None', 'Small', 'Medium', 'Large', 'Sleeve', 'Full Body', 'Face', 'Neck', 'Hands', 'Everywhere'];
const clothingStyles = ['Casual', 'Formal', 'Military', 'Athletic', 'Gothic', 'Punk', 'Business', 'Street', 'Traditional', 'Fantasy'];

document.getElementById('eye-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('eye-value').textContent = eyeColors[e.target.value - 1];
});

document.getElementById('hair-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('hair-value').textContent = hairColors[e.target.value - 1];
});

document.getElementById('skin-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('skin-value').textContent = skinTones[e.target.value - 1];
});

document.getElementById('height-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('height-value').textContent = heights[e.target.value - 1];
});

document.getElementById('body-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('body-value').textContent = bodyTypes[e.target.value - 1];
});

document.getElementById('facial-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('facial-value').textContent = facialHair[e.target.value - 1];
});

document.getElementById('hairstyle-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('hairstyle-value').textContent = hairstyles[e.target.value - 1];
});

document.getElementById('scars-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('scars-value').textContent = scars[e.target.value - 1];
});

document.getElementById('tattoos-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('tattoos-value').textContent = tattoos[e.target.value - 1];
});

document.getElementById('clothing-slider').addEventListener('input', (e) => {
    playUISound();
    document.getElementById('clothing-value').textContent = clothingStyles[e.target.value - 1];
});

// Achievements Menu
document.getElementById('achievements-back-btn').addEventListener('click', () => {
    playUISound();
    achievementsMenu.classList.add('fade-out');
    setTimeout(() => {
        achievementsMenu.classList.add('hidden');
        achievementsMenu.classList.remove('fade-out');
        gameState.inAchievements = false;
        
        // Return to pause screen if in game, otherwise main menu
        if (gameState.inGame) {
            document.getElementById('pause-screen').classList.remove('hidden');
        } else {
            mainMenu.classList.remove('hidden');
            mainMenu.classList.remove('fade-out');
        }
    }, 500);
});

// Game Screen
document.addEventListener('keydown', (e) => {
    // Fullscreen toggle (F key - works globally)
    if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log('Fullscreen error:', err);
            });
        } else {
            document.exitFullscreen();
        }
        return;
    }
    
    if (gameState.inGame && !gameState.isDead) {
        if (e.key === 'Escape' || e.key === 'Backspace') {
            if (gameState.isPaused) {
                resumeGame();
            } else {
                pauseGame();
            }
            return;
        }
        
        // Don't process game input if paused
        if (gameState.isPaused) return;
        
        // Movement key tracking
        const key = e.key.toLowerCase();
        
        // Sprint detection
        if (key === 'shift') {
            gameState.isSprinting = true;
        }
        
        // Sneak detection
        if (key === 'ctrl') {
            gameState.isSneaking = true;
        }
        
        // Movement keys
        if (key === gameState.keybinds.forward || key === 'w') {
            gameState.movementKeys.forward++;
            trackMovement();
        }
        if (key === gameState.keybinds.backward || key === 's') {
            gameState.movementKeys.backward++;
            trackMovement();
        }
        if (key === gameState.keybinds.left || key === 'a') {
            gameState.movementKeys.left++;
            trackMovement();
        }
        if (key === gameState.keybinds.right || key === 'd') {
            gameState.movementKeys.right++;
            trackMovement();
        }
        
        // Heal (Z)
        if (key === gameState.keybinds.heal || key === 'z') {
            heal();
        }
        
        // Jump (Space)
        if (key === gameState.keybinds.jump || key === ' ') {
            // Jump functionality (satire - does nothing)
        }
        
        // FOV (1-10)
        if (key >= '1' && key <= '10') {
            // FOV change (satire - does nothing)
        }
        
        // Check car death condition
        checkCarDeath();
        
        // Track Russian quest progress
        trackRussianQuest();
    }
});

document.addEventListener('keyup', (e) => {
    if (gameState.inGame && !gameState.isDead) {
        const key = e.key.toLowerCase();
        
        // Stop sprinting
        if (key === 'shift') {
            gameState.isSprinting = false;
        }
        
        // Stop sneaking
        if (key === 'ctrl') {
            gameState.isSneaking = false;
        }
    }
});

// Mouse tracking for snipe
gameScreen.addEventListener('click', (e) => {
    if (gameState.inGame && !gameState.isDead) {
        checkSnipe(e.clientX, e.clientY);
    }
});

gameScreen.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (gameState.inGame && !gameState.isDead) {
        gameState.rightClickCount++;
        // 5% chance for rare event
        if (Math.random() < 0.05) {
            gameState.rareEventCount++;
            console.log('Rare event triggered!');
        }
        trackRussianQuest();
    }
});

// Generate random snipe target
function generateSnipeTarget() {
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    const radius = Math.random() * 3 + 2; // 2-5 pixels
    gameState.snipeTarget = { x, y, radius };
}

// Check if click hits snipe target
function checkSnipe(clickX, clickY) {
    if (!gameState.snipeTarget) return;
    
    const dx = clickX - gameState.snipeTarget.x;
    const dy = clickY - gameState.snipeTarget.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= gameState.snipeTarget.radius) {
        unlockAchievement('snipe_citizen');
        generateSnipeTarget(); // Generate new target
    }
}

// Track movement time
let movementInterval = null;
function trackMovement() {
    if (!movementInterval) {
        movementInterval = setInterval(() => {
            let timeToAdd = 1000; // Base 1 second
            
            // Sprint makes it 50% faster (add 1500ms instead of 1000ms)
            if (gameState.isSprinting) {
                timeToAdd = 1500;
            }
            
            // Sneak makes it 50% slower (add 500ms instead of 1000ms)
            if (gameState.isSneaking) {
                timeToAdd = 500;
            }
            
            gameState.movementTime += timeToAdd;
            checkRunningAchievements();
        }, 1000);
    }
    
    // Clear interval after 1 second of no movement
    clearTimeout(movementInterval.timeout);
    movementInterval.timeout = setTimeout(() => {
        clearInterval(movementInterval);
        movementInterval = null;
    }, 1000);
}

// Check running achievements
function checkRunningAchievements() {
    // 5K = 30 minutes = 1800 seconds
    if (gameState.movementTime >= 1800000) {
        unlockAchievement('run_5k');
    }
    
    // 10K = 1 hour = 3600 seconds
    if (gameState.movementTime >= 3600000) {
        unlockAchievement('run_10k');
    }
    
    // Marathon = 5 hours = 18000 seconds
    if (gameState.movementTime >= 18000000) {
        unlockAchievement('marathon');
    }
}

// Check car death condition
function checkCarDeath() {
    const forward = gameState.movementKeys.forward;
    const backward = gameState.movementKeys.backward;
    const left = gameState.movementKeys.left;
    const right = gameState.movementKeys.right;
    
    if (forward >= 200 && forward <= 1000 &&
        left >= 100 && left <= 500 &&
        right >= 100 && right <= 500 &&
        backward >= 200 && backward <= 600) {
        die();
        unlockAchievement('hit_by_car');
    }
}

// Heal function
function heal() {
    if (gameState.healCooldown) return;
    
    gameState.healCooldown = true;
    gameState.healCount++;
    
    // 1% chance of poison death
    if (Math.random() < 0.01) {
        unlockAchievement('drink_poison');
        die();
    } else {
        gameState.healWithoutDeathCount++;
        trackRussianQuest();
    }
    
    // 5 second cooldown
    setTimeout(() => {
        gameState.healCooldown = false;
    }, 5000);
}

// Track Russian quest progress
function trackRussianQuest() {
    const totalMovement = gameState.movementKeys.forward + 
                         gameState.movementKeys.backward + 
                         gameState.movementKeys.left + 
                         gameState.movementKeys.right;
    
    if (totalMovement >= 2000 && totalMovement <= 8000) {
        gameState.russianQuestProgress.movementKeys = totalMovement;
    }
    
    gameState.russianQuestProgress.rareEvents = gameState.rareEventCount;
    gameState.russianQuestProgress.healsWithoutDeath = gameState.healWithoutDeathCount;
    
    // Check if all conditions met
    if (gameState.russianQuestProgress.movementKeys >= 2000 &&
        gameState.russianQuestProgress.movementKeys <= 8000 &&
        gameState.russianQuestProgress.rareEvents >= 10 &&
        gameState.russianQuestProgress.healsWithoutDeath >= 50) {
        unlockAchievement('russia');
    }
}

// Die function
function die() {
    gameState.isDead = true;
    gameState.deathCount++;
    deathScreen.classList.remove('hidden');
    
    // Reset Russian quest progress on death
    gameState.russianQuestProgress = {
        movementKeys: 0,
        rareEvents: 0,
        healsWithoutDeath: 0
    };
    
    // Check ascension achievement
    if (gameState.deathCount >= 100) {
        unlockAchievement('ascension');
    }
    
    saveGameData();
}

// Restart button
document.getElementById('restart-btn').addEventListener('click', () => {
    deathScreen.classList.add('hidden');
    gameState.isDead = false;
    gameState.movementKeys = { forward: 0, backward: 0, left: 0, right: 0 };
    generateSnipeTarget();
});

// Pause game
function pauseGame() {
    gameState.isPaused = true;
    document.getElementById('pause-screen').classList.remove('hidden');
    
    // Fade in music when pausing
    fadeInMusic();
    
    // Update skip cutscene button state
    const skipBtn = document.getElementById('skip-cutscene-btn');
    if (gameState.canSkipCutscene) {
        skipBtn.disabled = false;
    } else {
        skipBtn.disabled = true;
    }
}

// Resume game
function resumeGame() {
    gameState.isPaused = false;
    document.getElementById('pause-screen').classList.add('hidden');
    
    // Fade out music when resuming
    fadeOutMusic();
}

// Return to main menu
function returnToMainMenu() {
    // Save playtime
    if (gameState.sessionStartTime) {
        const sessionTime = Date.now() - gameState.sessionStartTime;
        gameState.totalPlaytime += sessionTime;
        gameState.sessionStartTime = null;
    }
    
    // Check all-nighter achievement (24 hours = 86400000 ms)
    if (gameState.totalPlaytime >= 86400000) {
        unlockAchievement('all_nighter');
    }
    
    saveGameData();
    
    gameScreen.classList.add('fade-out');
    setTimeout(() => {
        gameScreen.classList.add('hidden');
        gameScreen.classList.remove('fade-out');
        mainMenu.classList.remove('hidden');
        mainMenu.classList.remove('fade-out');
        gameState.inGame = false;
        gameState.isPaused = false;
        gameState.isDead = false;
        deathScreen.classList.add('hidden');
        document.getElementById('pause-screen').classList.add('hidden');
        
        // Fade in music when returning to main menu
        fadeInMusic();
    }, 500);
}

// Playtime tracking
setInterval(() => {
    if (gameState.inGame && gameState.sessionStartTime && !gameState.isDead && !gameState.isPaused) {
        const sessionTime = Date.now() - gameState.sessionStartTime;
        const totalPlaytime = gameState.totalPlaytime + sessionTime;
        
        // Check all-nighter achievement
        if (totalPlaytime >= 86400000) {
            unlockAchievement('all_nighter');
        }
    }
}, 60000); // Check every minute

// Pause menu buttons
document.getElementById('resume-btn').addEventListener('click', () => {
    playUISound();
    resumeGame();
});

document.getElementById('skip-cutscene-btn').addEventListener('click', () => {
    playUISound();
    if (gameState.canSkipCutscene) {
        gameState.canSkipCutscene = false;
        document.getElementById('skip-cutscene-btn').style.display = 'none';
        
        // Create black overlay for fade effect
        const blackOverlay = document.createElement('div');
        blackOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:300;opacity:0;transition:opacity 0.5s ease;';
        document.body.appendChild(blackOverlay);
        
        // Fade to black
        setTimeout(() => {
            blackOverlay.style.opacity = '1';
        }, 10);
        
        // Hide pause screen and resume after fade
        setTimeout(() => {
            document.getElementById('pause-screen').classList.add('hidden');
            resumeGame();
            
            // Fade out black overlay
            setTimeout(() => {
                blackOverlay.style.opacity = '0';
                setTimeout(() => {
                    blackOverlay.remove();
                }, 500);
            }, 100);
        }, 500);
    }
});

document.getElementById('pause-settings-btn').addEventListener('click', () => {
    playUISound();
    document.getElementById('pause-screen').classList.add('hidden');
    settingsMenu.classList.remove('hidden');
    gameState.inSettings = true;
});

document.getElementById('pause-achievements-btn').addEventListener('click', () => {
    playUISound();
    initAchievementsMenu();
    document.getElementById('pause-screen').classList.add('hidden');
    achievementsMenu.classList.remove('hidden');
    gameState.inAchievements = true;
});

document.getElementById('return-to-menu-btn').addEventListener('click', () => {
    playUISound();
    document.getElementById('pause-screen').classList.add('hidden');
    returnToMainMenu();
});

// Initialize
loadGameData();
initAchievementsMenu();
