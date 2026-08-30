// Graphwar Game Engine - Single Player Mode
class GraphwarGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Coordinate system
        this.xMin = -25;
        this.xMax = 25;
        this.yMin = -15;
        this.yMax = 15;
        
        // Game state
        this.currentLevel = 1;
        this.moveCount = 0;
        this.isAnimating = false;
        this.equationHistory = [];
        this.levelBestScores = {}; // Store best moves per level
        
        // Audio state
        this.sfxEnabled = true;
        this.musicEnabled = true;
        this.musicStarted = false;
        
        // Game entities
        this.player = null;
        this.enemies = [];
        this.obstacles = [];
        this.currentTrajectory = [];
        this.animationIndex = 0;
        this.explosions = [];
        
        // Initialize
        this.initializeGame();
        this.setupAudio();
        this.setupEventListeners();
        this.gameLoop();
    }
    
    setupAudio() {
        // Load best scores from localStorage
        const savedScores = localStorage.getItem('graphwar_bestScores');
        if (savedScores) {
            this.levelBestScores = JSON.parse(savedScores);
        }
        
        // Get audio elements
        this.shootSound = document.getElementById('shootSound');
        this.shotSound = document.getElementById('shotSound');
        this.ballSound = document.getElementById('ballSound');
        this.uiSound = document.getElementById('uiSound');
        this.musicSound = document.getElementById('musicSound');
        
        // Set volumes
        this.shotSound.volume = 0.5;
        this.shotSound.volume = 0.5;
        this.ballSound.volume = 0.5;
        this.uiSound.volume = 0.5;
        this.musicSound.volume = 0.2;
        
        // Setup audio toggle buttons
        document.getElementById('sfxToggle').addEventListener('click', () => {
            this.sfxEnabled = !this.sfxEnabled;
            const btn = document.getElementById('sfxToggle');
            btn.textContent = this.sfxEnabled ? 'SFX: ON' : 'SFX: OFF';
            btn.classList.toggle('off', !this.sfxEnabled);
            this.playUISound();
        });
        
        document.getElementById('musicToggle').addEventListener('click', () => {
            this.musicEnabled = !this.musicEnabled;
            const btn = document.getElementById('musicToggle');
            btn.textContent = this.musicEnabled ? 'Music: ON' : 'Music: OFF';
            btn.classList.toggle('off', !this.musicEnabled);
            
            if (this.musicEnabled) {
                this.musicSound.play();
            } else {
                this.musicSound.pause();
            }
            this.playUISound();
        });
        
        // Start music on first click anywhere
        document.addEventListener('click', () => {
            if (!this.musicStarted && this.musicEnabled) {
                this.musicSound.play();
                this.musicStarted = true;
            }
        }, { once: true });
    }
    
    playShootSound() {
        if (this.sfxEnabled) {
            this.shootSound.currentTime = 0;
            this.shootSound.play();
        }
    }
    
    playShotSound() {
        if (this.sfxEnabled) {
            this.shotSound.currentTime = 0;
            this.shotSound.play();
        }
    }
    
    playBallSound() {
        if (this.sfxEnabled) {
            this.ballSound.currentTime = 0;
            this.ballSound.play();
        }
    }
    
    playUISound() {
        if (this.sfxEnabled) {
            this.uiSound.currentTime = 0;
            this.uiSound.play();
        }
    }
    
    initializeGame() {
        this.moveCount = 0;
        this.enemies = [];
        this.obstacles = [];
        this.currentTrajectory = [];
        this.animationIndex = 0;
        this.explosions = [];
        this.isAnimating = false;
        
        // Create single player soldier (left side, negative x)
        this.player = { x: -20, y: 0, color: '#4a9eff' };
        
        // Create enemy targets based on level (every 10 levels adds 1 enemy, starting with 1)
        const numEnemies = 1 + Math.floor((this.currentLevel - 1) / 10);
        
        const maxAttempts = numEnemies * 10; // Prevent infinite loop
        let attempts = 0;
        
        while (this.enemies.length < numEnemies && attempts < maxAttempts) {
            attempts++;
            // Only spawn enemies in front of player (x > player.x)
            const x = this.player.x + 5 + Math.random() * (this.xMax - this.player.x - 5);
            const y = (Math.random() * 30) - 15; // Full y range
            
            // Don't place enemies within 5 units of player
            const playerDist = Math.sqrt((x - this.player.x) ** 2 + (y - this.player.y) ** 2);
            if (playerDist < 5) continue;
            
            this.enemies.push({ x, y, alive: true, color: '#ff6b6b', radius: 0.5 });
        }
        
        // Create circular obstacles
        this.generateObstacles();
        
        this.updateUI();
    }
    
    generateObstacles() {
        this.obstacles = [];
        // Calculate number of obstacles based on level (every 20 levels adds 1 obstacle, starting with 4)
        const baseObstacles = 4;
        const levelBonus = Math.floor((this.currentLevel - 1) / 20);
        const numObstacles = baseObstacles + levelBonus;
        
        const maxAttempts = numObstacles * 10; // Prevent infinite loop
        let attempts = 0;
        
        while (this.obstacles.length < numObstacles && attempts < maxAttempts) {
            attempts++;
            const x = (Math.random() * 35) - 17;
            const y = (Math.random() * 24) - 12;
            const radius = 1 + Math.random() * 2.5;
            
            // Don't place obstacles too close to player
            const playerDist = Math.sqrt((x - this.player.x) ** 2 + (y - this.player.y) ** 2);
            if (playerDist < 5) continue;
            
            // Don't place obstacles too close to enemies
            let tooCloseToEnemy = false;
            for (const enemy of this.enemies) {
                const dist = Math.sqrt((x - enemy.x) ** 2 + (y - enemy.y) ** 2);
                if (dist < 4) {
                    tooCloseToEnemy = true;
                    break;
                }
            }
            if (tooCloseToEnemy) continue;
            
            // Don't place obstacles too close to other obstacles
            let tooCloseToObstacle = false;
            for (const obstacle of this.obstacles) {
                const dist = Math.sqrt((x - obstacle.x) ** 2 + (y - obstacle.y) ** 2);
                const minDist = radius + obstacle.radius + 1; // Add buffer
                if (dist < minDist) {
                    tooCloseToObstacle = true;
                    break;
                }
            }
            if (tooCloseToObstacle) continue;
            
            this.obstacles.push({ x, y, radius, holes: [] });
        }
    }
    
    // Coordinate conversion
    toCanvasX(x) {
        return ((x - this.xMin) / (this.xMax - this.xMin)) * this.canvas.width;
    }
    
    toCanvasY(y) {
        return this.canvas.height - ((y - this.yMin) / (this.yMax - this.yMin)) * this.canvas.height;
    }
    
    toGameX(canvasX) {
        return (canvasX / this.canvas.width) * (this.xMax - this.xMin) + this.xMin;
    }
    
    toGameY(canvasY) {
        return this.yMax - (canvasY / this.canvas.height) * (this.yMax - this.yMin);
    }
    
    // Rendering
    render() {
        this.ctx.fillStyle = '#0a0a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawGrid();
        this.drawAxes();
        this.drawObstacles();
        this.drawEnemies();
        this.drawPlayer();
        this.drawTrajectory();
        this.drawExplosions();
    }
    
    drawGrid() {
        this.ctx.strokeStyle = 'rgba(74, 158, 255, 0.1)';
        this.ctx.lineWidth = 1;
        
        // Vertical lines
        for (let x = Math.ceil(this.xMin); x <= this.xMax; x++) {
            const canvasX = this.toCanvasX(x);
            this.ctx.beginPath();
            this.ctx.moveTo(canvasX, 0);
            this.ctx.lineTo(canvasX, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = Math.ceil(this.yMin); y <= this.yMax; y++) {
            const canvasY = this.toCanvasY(y);
            this.ctx.beginPath();
            this.ctx.moveTo(0, canvasY);
            this.ctx.lineTo(this.canvas.width, canvasY);
            this.ctx.stroke();
        }
    }
    
    drawAxes() {
        this.ctx.strokeStyle = '#4a9eff';
        this.ctx.lineWidth = 2;
        
        // X axis
        const yAxis = this.toCanvasY(0);
        this.ctx.beginPath();
        this.ctx.moveTo(0, yAxis);
        this.ctx.lineTo(this.canvas.width, yAxis);
        this.ctx.stroke();
        
        // Y axis
        const xAxis = this.toCanvasX(0);
        this.ctx.beginPath();
        this.ctx.moveTo(xAxis, 0);
        this.ctx.lineTo(xAxis, this.canvas.height);
        this.ctx.stroke();
    }
    
    drawObstacles() {
        for (const obstacle of this.obstacles) {
            const cx = this.toCanvasX(obstacle.x);
            const cy = this.toCanvasY(obstacle.y);
            const radius = this.toCanvasX(obstacle.x + obstacle.radius) - this.toCanvasX(obstacle.x);
            
            // Draw main black circle
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = '#000';
            this.ctx.fill();
            this.ctx.strokeStyle = '#333';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // Draw holes in the obstacle
            for (const hole of obstacle.holes) {
                const hx = this.toCanvasX(hole.x);
                const hy = this.toCanvasY(hole.y);
                const hRadius = this.toCanvasX(hole.x + hole.radius) - this.toCanvasX(hole.x);
                
                this.ctx.beginPath();
                this.ctx.arc(hx, hy, hRadius, 0, Math.PI * 2);
                this.ctx.fillStyle = '#0a0a1a'; // Background color
                this.ctx.fill();
            }
        }
    }
    
    drawPlayer() {
        const x = this.toCanvasX(this.player.x);
        const y = this.toCanvasY(this.player.y);
        
        // Highlight player
        this.ctx.beginPath();
        this.ctx.arc(x, y, 15, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(74, 158, 255, 0.3)';
        this.ctx.fill();
        
        // Draw player
        this.ctx.beginPath();
        this.ctx.arc(x, y, 8, 0, Math.PI * 2);
        this.ctx.fillStyle = this.player.color;
        this.ctx.fill();
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }
    
    drawEnemies() {
        for (const enemy of this.enemies) {
            if (!enemy.alive) continue;
            
            const x = this.toCanvasX(enemy.x);
            const y = this.toCanvasY(enemy.y);
            const radius = this.toCanvasX(enemy.x + enemy.radius) - this.toCanvasX(enemy.x);
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = enemy.color;
            this.ctx.fill();
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
    }
    
    drawTrajectory() {
        if (this.currentTrajectory.length < 2) return;
        
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#4a9eff';
        this.ctx.lineWidth = 3;
        
        const drawIndex = Math.floor(this.animationIndex);
        
        for (let i = 0; i < drawIndex && i < this.currentTrajectory.length; i++) {
            const point = this.currentTrajectory[i];
            const cx = this.toCanvasX(point.x);
            const cy = this.toCanvasY(point.y);
            
            if (i === 0) {
                this.ctx.moveTo(cx, cy);
            } else {
                this.ctx.lineTo(cx, cy);
            }
        }
        
        this.ctx.stroke();
        
        // Draw projectile head
        if (drawIndex < this.currentTrajectory.length) {
            const point = this.currentTrajectory[drawIndex];
            const cx = this.toCanvasX(point.x);
            const cy = this.toCanvasY(point.y);
            
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, 5, 0, Math.PI * 2);
            this.ctx.fillStyle = '#fff';
            this.ctx.fill();
        }
    }
    
    
    drawExplosions() {
        for (const explosion of this.explosions) {
            const x = this.toCanvasX(explosion.x);
            const y = this.toCanvasY(explosion.y);
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, explosion.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 107, 107, ${explosion.alpha})`;
            this.ctx.fill();
            this.ctx.strokeStyle = `rgba(255, 150, 150, ${explosion.alpha})`;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
    }
    
    // Function parsing
    parseFunction(expression) {
        try {
            // Replace mathematical functions with JavaScript equivalents
            let jsExpression = expression
                // Replace power operator first (before other replacements)
                .replace(/\^/g, '**')
                .replace(/sqrt\(/g, 'Math.sqrt(')
                .replace(/log\(/g, 'Math.log10(')
                .replace(/ln\(/g, 'Math.log(')
                .replace(/abs\(/g, 'Math.abs(')
                .replace(/sin\(/g, 'Math.sin(')
                .replace(/cos\(/g, 'Math.cos(')
                .replace(/tan\(/g, 'Math.tan(')
                .replace(/exp\(/g, 'Math.exp(')
                // Handle implicit multiplication - more comprehensive patterns
                // Number followed by function or x: 2sin, 3x, 0.5x
                .replace(/(\d+\.?\d*)(?=[a-zA-Z(])/g, '$1*')
                // x followed by number: x2, x3
                .replace(/x(?=\d+\.?\d*)/g, 'x*')
                // Closing parenthesis followed by number or function: )2, )sin
                .replace(/\)(?=\d+\.?\d*[a-zA-Z(])/g, ')*')
                // Number followed by opening parenthesis: 2(
                .replace(/(\d+\.?\d*)(?=\()/g, '$1*')
                // x followed by x: xx
                .replace(/xx/g, 'x*x')
                // Handle cases like (x)(x) or (x)2
                .replace(/\)(?=\()/g, ')*')
                .replace(/\)(?=\d)/g, ')*')
                // Handle negative signs before variables/functions: -x, -sin(x)
                .replace(/-(?=[a-zA-Z])/g, '-1*')
                // Handle negative signs after operators: +-x, --x
                .replace(/([+\-*/])(-)(?=[a-zA-Z])/g, '$1-1*');
            
            console.log('Parsed expression:', jsExpression);
            
            // Create function
            return new Function('x', 'y', 'yp', `return ${jsExpression}`);
        } catch (e) {
            console.error('Parse error:', e);
            throw new Error('Invalid function syntax');
        }
    }
    
    // Fire function based on game mode
    fireFunction(expression) {
        if (this.isAnimating) {
            this.showError('Already animating!');
            return;
        }
        
        if (!expression || expression.trim() === '') {
            this.showError('Please enter a function');
            return;
        }
        
        // Add to equation history
        this.addToHistory(expression);
        
        this.playShootSound();
        
        try {
            const func = this.parseFunction(expression);
            const startX = this.player.x;
            const startY = this.player.y;
            
            // Only normal function mode
            const trajectory = this.calculateNormalFunction(func, startX, startY);
            
            if (trajectory.length > 0) {
                this.currentTrajectory = trajectory;
                this.animationIndex = 0;
                this.isAnimating = true;
                this.moveCount++;
                this.updateUI();
            } else {
                this.showError('Function produced no valid trajectory');
            }
            
        } catch (e) {
            this.showError('Error: ' + e.message);
        }
    }
    
    addToHistory(expression) {
        // Remove if already in history to move to front
        this.equationHistory = this.equationHistory.filter(eq => eq !== expression);
        // Add to front
        this.equationHistory.unshift(expression);
        // Keep only last 3
        if (this.equationHistory.length > 3) {
            this.equationHistory.pop();
        }
        this.updateHistoryUI();
    }
    
    updateHistoryUI() {
        const historyContainer = document.getElementById('equationHistory');
        historyContainer.innerHTML = '';
        
        this.equationHistory.forEach(eq => {
            const btn = document.createElement('button');
            btn.className = 'history-btn';
            btn.textContent = eq;
            btn.onclick = () => {
                this.playUISound();
                document.getElementById('functionInput').value = eq;
            };
            historyContainer.appendChild(btn);
        });
    }
    
    calculateNormalFunction(func, startX, startY) {
        const trajectory = [];
        const step = 0.1;
        const maxLength = 500;
        
        // Calculate trajectory only in forward direction (positive x from player)
        for (let i = 0; i < maxLength; i++) {
            const x = startX + i * step;
            if (x > this.xMax) break;
            
            try {
                // Evaluate function with x relative to player position
                // This makes the player position the origin for the function
                const relativeX = x - startX;
                const y = func(relativeX, 0, 0) + startY;
                
                if (isNaN(y) || !isFinite(y)) break;
                
                trajectory.push({ x, y });
                
                // Check boundaries
                if (y > this.yMax || y < this.yMin) break;
                
            } catch (e) {
                break;
            }
        }
        
        return trajectory;
    }
    
    
    updateAnimation() {
        if (!this.isAnimating) return;
        
        this.animationIndex += 2; // Faster animation for visibility
        
        if (this.animationIndex >= this.currentTrajectory.length) {
            this.isAnimating = false;
            this.currentTrajectory = [];
            this.checkWinCondition();
            return;
        }
        
        const currentPoint = this.currentTrajectory[Math.floor(this.animationIndex)];
        
        // Check if all enemies are dead - if so, stop animation
        const enemiesAlive = this.enemies.filter(e => e.alive).length;
        if (enemiesAlive === 0) {
            this.isAnimating = false;
            this.currentTrajectory = [];
            this.checkWinCondition();
            return;
        }
        
        // Check collisions during animation
        const collisionResult = this.checkCollisions(currentPoint);
        if (collisionResult === 'obstacle' || collisionResult === 'boundary') {
            // Stop animation on obstacle or boundary collision
            this.isAnimating = false;
            this.currentTrajectory = [];
            this.checkWinCondition();
        }
        // Enemy collisions don't stop animation - allow combo kills
    }
    
    checkCollisions(point) {
        const px = point.x;
        const py = point.y;
        
        // Check enemy collisions
        for (const enemy of this.enemies) {
            if (!enemy.alive) continue;
            
            const dist = Math.sqrt((px - enemy.x) ** 2 + (py - enemy.y) ** 2);
            if (dist < enemy.radius + 0.3) {
                enemy.alive = false;
                this.createExplosion(enemy.x, enemy.y);
                this.playShotSound();
                this.updateUI();
                return 'enemy';
            }
        }
        
        // Check obstacle collisions (create holes)
        for (const obstacle of this.obstacles) {
            const dist = Math.sqrt((px - obstacle.x) ** 2 + (py - obstacle.y) ** 2);
            if (dist < obstacle.radius) {
                // Check if point is within any existing hole
                let inHole = false;
                
                for (const hole of obstacle.holes) {
                    const holeDist = Math.sqrt((px - hole.x) ** 2 + (py - hole.y) ** 2);
                    if (holeDist < hole.radius) {
                        inHole = true;
                        break;
                    }
                }
                
                if (inHole) {
                    // Point is in a hole, let it pass through
                    continue;
                } else {
                    // Always create a new hole with same radius
                    obstacle.holes.push({ x: px, y: py, radius: 0.8 });
                    this.createExplosion(px, py);
                    this.playBallSound();
                    return 'obstacle';
                }
            }
        }
        
        // Check boundary collisions
        if (px <= this.xMin || px >= this.xMax || py <= this.yMin || py >= this.yMax) {
            return 'boundary';
        }
        
        return null; // No collision
    }
    
    createExplosion(x, y) {
        this.explosions.push({
            x: x,
            y: y,
            radius: 1,
            alpha: 1
        });
    }
    
    updateExplosions() {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const explosion = this.explosions[i];
            explosion.radius += 0.5;
            explosion.alpha -= 0.05;
            
            if (explosion.alpha <= 0) {
                this.explosions.splice(i, 1);
            }
        }
    }
    
    
    checkWinCondition() {
        const enemiesAlive = this.enemies.filter(e => e.alive).length;
        
        if (enemiesAlive === 0) {
            // Store best score for this level
            if (!this.levelBestScores[this.currentLevel] || this.moveCount < this.levelBestScores[this.currentLevel]) {
                this.levelBestScores[this.currentLevel] = this.moveCount;
                // Save to localStorage
                localStorage.setItem('graphwar_bestScores', JSON.stringify(this.levelBestScores));
            }
            
            // Show popup instead of alert
            setTimeout(() => {
                document.getElementById('popupMoveCount').textContent = this.moveCount;
                document.getElementById('levelCompletePopup').classList.add('active');
            }, 500);
        }
    }
    
    updateUI() {
        const enemiesAlive = this.enemies.filter(e => e.alive).length;
        document.getElementById('moveCount').textContent = this.moveCount;
        document.getElementById('enemiesRemaining').textContent = enemiesAlive;
        document.getElementById('currentLevel').textContent = this.currentLevel;
        
        // Update function hint
        document.getElementById('functionHint').textContent = 'y = f(x)';
        
        // Update best score display
        const bestScore = this.levelBestScores[this.currentLevel];
        const bestScoreDisplay = document.getElementById('bestScore');
        if (bestScore) {
            bestScoreDisplay.textContent = `Completed in ${bestScore} moves`;
        } else {
            bestScoreDisplay.textContent = 'Uncompleted';
        }
    }
    
    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.textContent = message;
        setTimeout(() => errorDiv.textContent = '', 3000);
    }
    
    setupEventListeners() {
        // Fire button
        document.getElementById('fireBtn').addEventListener('click', () => {
            const expression = document.getElementById('functionInput').value;
            if (expression.trim()) {
                this.fireFunction(expression);
                document.getElementById('functionInput').value = '';
            }
        });
        
        // Enter key to fire
        document.getElementById('functionInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('fireBtn').click();
            }
        });
        
        // Level select buttons
        document.getElementById('prevLevelBtn').addEventListener('click', () => {
            this.playUISound();
            if (this.currentLevel > 1) {
                this.currentLevel--;
                this.initializeGame();
            }
        });
        
        document.getElementById('currentLevel').addEventListener('click', () => {
            this.playUISound();
            // Click on current level button to restart level
            this.initializeGame();
        });
        
        document.getElementById('nextLevelBtn').addEventListener('click', () => {
            this.playUISound();
            this.currentLevel++;
            this.initializeGame();
        });
        
        // Popup buttons
        document.getElementById('repeatRoundBtn').addEventListener('click', () => {
            this.playUISound();
            document.getElementById('levelCompletePopup').classList.remove('active');
            this.initializeGame();
        });
        
        document.getElementById('nextRoundBtn').addEventListener('click', () => {
            this.playUISound();
            document.getElementById('levelCompletePopup').classList.remove('active');
            this.currentLevel++;
            this.initializeGame();
        });
    }
    
    gameLoop() {
        this.updateAnimation();
        this.updateExplosions();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    new GraphwarGame();
});
