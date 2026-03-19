export class GameManager {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.gameRunning = false;
        this.isPaused = false;
        this.currentGame = null;
        this.animationId = null;
        this.keys = {};
        
        // Enhanced game state
        this.score = 0;
        this.level = 1;
        this.combo = 0;
        this.maxCombo = 0;
        this.powerUps = [];
        this.screenShake = 0;
        this.particles = [];
        this.stars = [];
        
        // Player stats
        this.player = {
            x: 100,
            y: 200,
            width: 40,
            height: 30,
            speed: 6,
            health: 100,
            maxHealth: 100,
            shield: 0,
            color: '#00ff88',
            trail: []
        };
        
        // Game entities
        this.fires = [];
        this.water = [];
        this.enemies = [];
        this.explosions = [];
        this.powerUps = [];
        
        // Game mechanics
        this.fireSpawnRate = 0.02;
        this.difficulty = 1;
        this.timeSurvived = 0;
        this.waveNumber = 1;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.createStarfield();
        console.log('PANTANALE Enhanced Game Initialized! 🔥');
    }

    setupEventListeners() {
        // Game controls
        const startFireBtn = document.getElementById('startFireGame');
        const startQuizBtn = document.getElementById('startQuizGame');
        const pauseBtn = document.getElementById('pauseGame');
        const restartBtn = document.getElementById('restartGame');
        
        if (startFireBtn) {
            startFireBtn.addEventListener('click', () => this.startPantaleGame());
        }
        
        if (startQuizBtn) {
            startQuizBtn.addEventListener('click', () => this.startQuizGame());
        }
        
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => this.togglePause());
        }
        
        if (restartBtn) {
            restartBtn.addEventListener('click', () => this.restartGame());
        }
        
        // Enhanced keyboard controls
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            
            // Special abilities
            if (e.code === 'KeyX' && this.player.shield <= 0) {
                this.activateShield();
            }
            if (e.code === 'KeyC' && this.score >= 100) {
                this.activateMegaBlast();
            }
            
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyX', 'KeyC'].includes(e.code)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    startPantaleGame() {
        this.currentGame = 'pantale';
        this.showGameContainer();
        this.initPantaleGame();
    }
    
    startQuizGame() {
        this.currentGame = 'quiz';
        this.showGameContainer();
        this.initQuizGame();
    }
    
    showGameContainer() {
        const container = document.getElementById('gameContainer');
        const gameSelection = document.querySelector('#gamesModal .grid');
        
        if (container && gameSelection) {
            container.classList.remove('hidden');
            gameSelection.classList.add('hidden');
        }
    }

    createStarfield() {
        this.stars = [];
        for (let i = 0; i < 50; i++) {
            this.stars.push({
                x: Math.random() * 600,
                y: Math.random() * 400,
                size: Math.random() * 2,
                speed: Math.random() * 0.5 + 0.1,
                brightness: Math.random()
            });
        }
    }
    
    initPantaleGame() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.resetGameState();
        
        // Enhanced player
        this.player = {
            x: 100,
            y: 200,
            width: 40,
            height: 30,
            speed: 6,
            health: 100,
            maxHealth: 100,
            shield: 0,
            color: '#00ff88',
            trail: [],
            powerLevel: 1
        };
        
        this.gameRunning = true;
        this.isPaused = false;
        this.timeSurvived = 0;
        this.waveNumber = 1;
        
        this.updateGameUI();
        this.gameLoop();
    }

    resetGameState() {
        this.score = 0;
        this.level = 1;
        this.combo = 0;
        this.maxCombo = 0;
        this.fireSpawnRate = 0.02;
        this.difficulty = 1;
        this.fires = [];
        this.water = [];
        this.enemies = [];
        this.explosions = [];
        this.powerUps = [];
        this.particles = [];
        this.screenShake = 0;
    }

    initQuizGame() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.resetGameState();
        
        this.currentQuestion = 0;
        this.quizQuestions = [
            {
                question: "🔥 Qual é o maior área alagada do mundo?",
                options: ["🌊 Amazônia", "🌿 Pantanal", "🦒 Everglades", "🏞️ Pantanal Matogrossense"],
                correct: 1
            },
            {
                question: "🦒 Que porcentagem do Pantanal está no Brasil?",
                options: ["📊 50%", "📈 70%", "📉 85%", "📐 95%"],
                correct: 2
            },
            {
                question: "🌡️ Qual é o principal período de queimadas?",
                options: ["☀️ Jan-Mar", "🌧️ Abr-Jun", "🔥 Jul-Set", "🍃 Out-Dez"],
                correct: 2
            },
            {
                question: "🐊 Qual animal NÃO é do Pantanal?",
                options: ["🦒 Capivara", "🐊 Jacaré", "🐻 Urso Polar", "🦅 Arara Azul"],
                correct: 2
            },
            {
                question: "🛰️ Qual satélite monitora os incêndios?",
                options: ["🌙 Lua", "☀️ Sol", "🛰️ NASA FIRMS", "⭐ Estrela"],
                correct: 2
            }
        ];
        
        this.selectedAnswer = -1;
        this.showQuizQuestion();
    }

    gameLoop() {
        if (!this.gameRunning || this.isPaused) return;
        
        this.update();
        this.render();
        this.animationId = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        if (this.currentGame === 'pantale') {
            this.updatePantaleGame();
        }
    }

    updatePantaleGame() {
        this.timeSurvived++;
        
        // Update difficulty
        if (this.timeSurvived % 600 === 0) { // Every 10 seconds
            this.waveNumber++;
            this.difficulty += 0.2;
            this.fireSpawnRate = Math.min(0.08, this.fireSpawnRate + 0.005);
            this.showWaveMessage();
        }
        
        // Enhanced player movement
        this.updatePlayer();
        
        // Auto-fire with space
        if (this.keys['Space'] && !this.spacePressed) {
            this.shootWater();
            this.spacePressed = true;
        }
        if (!this.keys['Space']) {
            this.spacePressed = false;
        }
        
        // Spawn enhanced fires
        this.spawnFires();
        
        // Update all entities
        this.updateWater();
        this.updateFires();
        this.updateEnemies();
        this.updateExplosions();
        this.updatePowerUps();
        this.updateParticles();
        this.updateStars();
        
        // Check collisions
        this.checkCollisions();
        
        // Update screen shake
        if (this.screenShake > 0) {
            this.screenShake--;
        }
        
        // Update combo
        if (this.combo > 0 && this.timeSurvived % 60 === 0) {
            this.combo = Math.max(0, this.combo - 1);
        }
    }

    updatePlayer() {
        // Smooth movement with trail effect
        const oldX = this.player.x;
        const oldY = this.player.y;
        
        if (this.keys['ArrowUp'] && this.player.y > 0) {
            this.player.y -= this.player.speed;
        }
        if (this.keys['ArrowDown'] && this.player.y < this.canvas.height - this.player.height) {
            this.player.y += this.player.speed;
        }
        if (this.keys['ArrowLeft'] && this.player.x > 0) {
            this.player.x -= this.player.speed;
        }
        if (this.keys['ArrowRight'] && this.player.x < this.canvas.width - this.player.width) {
            this.player.x += this.player.speed;
        }
        
        // Add to trail
        if (oldX !== this.player.x || oldY !== this.player.y) {
            this.player.trail.push({
                x: this.player.x,
                y: this.player.y,
                life: 10
            });
        }
        
        // Update trail
        this.player.trail = this.player.trail.filter(t => {
            t.life--;
            return t.life > 0;
        });
        
        // Update shield
        if (this.player.shield > 0) {
            this.player.shield--;
        }
    }

    shootWater() {
        const waterCount = this.player.powerLevel;
        
        for (let i = 0; i < waterCount; i++) {
            const angle = (i - (waterCount - 1) / 2) * 0.1;
            
            this.water.push({
                x: this.player.x + this.player.width,
                y: this.player.y + this.player.height / 2 - 2,
                vx: 8 * Math.cos(angle),
                vy: 8 * Math.sin(angle),
                width: 12,
                height: 6,
                damage: 1,
                color: '#00ccff',
                trail: []
            });
        }
        
        // Create shoot effect
        this.createShootEffect();
    }

    createShootEffect() {
        for (let i = 0; i < 5; i++) {
            this.particles.push({
                x: this.player.x + this.player.width,
                y: this.player.y + this.player.height / 2,
                vx: Math.random() * 4 - 2,
                vy: Math.random() * 4 - 2,
                life: 20,
                color: '#00ccff',
                size: Math.random() * 3 + 1
            });
        }
    }

    spawnFires() {
        // Different fire types
        if (Math.random() < this.fireSpawnRate) {
            const fireType = Math.random();
            let fire = {
                x: this.canvas.width - 40,
                y: Math.random() * (this.canvas.height - 30),
                width: 30,
                height: 30,
                health: 1,
                type: 'normal',
                color: '#ff4444'
            };
            
            if (fireType < 0.1) { // 10% chance for boss fire
                fire = {
                    ...fire,
                    width: 50,
                    height: 50,
                    health: 3,
                    type: 'boss',
                    color: '#ff0088',
                    speed: 1
                };
            } else if (fireType < 0.3) { // 20% chance for fast fire
                fire = {
                    ...fire,
                    width: 20,
                    height: 20,
                    health: 1,
                    type: 'fast',
                    color: '#ff8800',
                    speed: 2
                };
            }
            
            this.fires.push(fire);
        }
        
        // Spawn enemies
        if (Math.random() < this.fireSpawnRate * 0.3) {
            this.enemies.push({
                x: this.canvas.width,
                y: Math.random() * this.canvas.height,
                width: 25,
                height: 25,
                speed: 1 + Math.random(),
                health: 2,
                color: '#ff00ff',
                type: 'enemy'
            });
        }
        
        // Spawn power-ups
        if (Math.random() < 0.001) {
            const powerTypes = ['health', 'shield', 'multishot', 'bomb'];
            const type = powerTypes[Math.floor(Math.random() * powerTypes.length)];
            
            this.powerUps.push({
                x: Math.random() * (this.canvas.width - 100) + 50,
                y: -20,
                width: 20,
                height: 20,
                speed: 1,
                type: type,
                color: this.getPowerUpColor(type)
            });
        }
    }

    getPowerUpColor(type) {
        const colors = {
            health: '#00ff00',
            shield: '#0088ff',
            multishot: '#ffaa00',
            bomb: '#ff00ff'
        };
        return colors[type] || '#ffffff';
    }

    updateWater() {
        this.water = this.water.filter(w => {
            w.x += w.vx;
            w.y += w.vy;
            
            // Add to trail
            w.trail.push({ x: w.x, y: w.y, life: 5 });
            w.trail = w.trail.filter(t => t.life-- > 0);
            
            return w.x < this.canvas.width && w.y > 0 && w.y < this.canvas.height;
        });
    }

    updateFires() {
        this.fires = this.fires.filter(f => {
            // Move some fires
            if (f.type === 'fast' || f.type === 'boss') {
                f.x -= (f.speed || 1) * this.difficulty;
            }
            
            // Fire animation
            if (Math.random() < 0.1) {
                this.createFireParticle(f);
            }
            
            return f.x > -50 && f.health > 0;
        });
    }

    updateEnemies() {
        this.enemies = this.enemies.filter(e => {
            e.x -= e.speed * this.difficulty;
            
            // Enemy shooting
            if (Math.random() < 0.01) {
                this.enemyShoot(e);
            }
            
            return e.x > -50 && e.health > 0;
        });
    }

    enemyShoot(enemy) {
        // Enemy shoots at player
        const angle = Math.atan2(
            this.player.y - enemy.y,
            this.player.x - enemy.x
        );
        
        this.fires.push({
            x: enemy.x,
            y: enemy.y + enemy.height / 2,
            vx: Math.cos(angle) * 3,
            vy: Math.sin(angle) * 3,
            width: 10,
            height: 10,
            health: 1,
            type: 'enemy_fire',
            color: '#ff00ff'
        });
    }

    updateExplosions() {
        this.explosions = this.explosions.filter(e => {
            e.radius += 2;
            e.life--;
            return e.life > 0;
        });
    }

    updatePowerUps() {
        this.powerUps = this.powerUps.filter(p => {
            p.y += p.speed;
            return p.y < this.canvas.height + 20;
        });
    }

    updateParticles() {
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1; // Gravity
            p.life--;
            p.size *= 0.98;
            return p.life > 0;
        });
    }

    updateStars() {
        this.stars.forEach(star => {
            star.x -= star.speed;
            if (star.x < 0) {
                star.x = this.canvas.width;
                star.y = Math.random() * this.canvas.height;
            }
        });
    }

    checkCollisions() {
        // Water vs Fires
        this.water.forEach((w, wIndex) => {
            this.fires.forEach((f, fIndex) => {
                if (this.checkCollision(w, f)) {
                    w.health--;
                    f.health--;
                    
                    if (f.health <= 0) {
                        this.createExplosion(f.x + f.width/2, f.y + f.height/2);
                        this.fires.splice(fIndex, 1);
                        this.addScore(f.type === 'boss' ? 50 : f.type === 'fast' ? 20 : 10);
                        this.combo++;
                        this.maxCombo = Math.max(this.maxCombo, this.combo);
                    }
                    
                    if (w.health <= 0) {
                        this.water.splice(wIndex, 1);
                    }
                }
            });
            
            // Water vs Enemies
            this.enemies.forEach((e, eIndex) => {
                if (this.checkCollision(w, e)) {
                    w.health--;
                    e.health--;
                    
                    if (e.health <= 0) {
                        this.createExplosion(e.x + e.width/2, e.y + e.height/2);
                        this.enemies.splice(eIndex, 1);
                        this.addScore(30);
                    }
                    
                    if (w.health <= 0) {
                        this.water.splice(wIndex, 1);
                    }
                }
            });
        });
        
        // Player vs Fires/Enemies
        if (this.player.shield <= 0) {
            [...this.fires, ...this.enemies].forEach(entity => {
                if (this.checkCollision(this.player, entity)) {
                    this.playerHit();
                    this.createExplosion(entity.x + entity.width/2, entity.y + entity.height/2);
                    const index = this.fires.indexOf(entity);
                    if (index > -1) this.fires.splice(index, 1);
                    else {
                        const eIndex = this.enemies.indexOf(entity);
                        if (eIndex > -1) this.enemies.splice(eIndex, 1);
                    }
                }
            });
        }
        
        // Player vs PowerUps
        this.powerUps.forEach((p, pIndex) => {
            if (this.checkCollision(this.player, p)) {
                this.collectPowerUp(p);
                this.powerUps.splice(pIndex, 1);
            }
        });
    }

    playerHit() {
        this.player.health -= 10;
        this.combo = 0;
        this.screenShake = 10;
        
        if (this.player.health <= 0) {
            this.gameOver();
        }
    }

    collectPowerUp(powerUp) {
        switch(powerUp.type) {
            case 'health':
                this.player.health = Math.min(this.player.maxHealth, this.player.health + 30);
                break;
            case 'shield':
                this.player.shield = 180; // 3 seconds
                break;
            case 'multishot':
                this.player.powerLevel = Math.min(5, this.player.powerLevel + 1);
                break;
            case 'bomb':
                this.activateScreenBomb();
                break;
        }
        
        this.createCollectEffect(powerUp.x, powerUp.y, powerUp.color);
        this.addScore(25);
    }

    activateShield() {
        this.player.shield = 180;
        this.createShieldEffect();
    }

    activateMegaBlast() {
        if (this.score >= 100) {
            this.score -= 100;
            this.activateScreenBomb();
        }
    }

    activateScreenBomb() {
        // Clear all enemies and fires
        this.fires.forEach(f => {
            this.createExplosion(f.x + f.width/2, f.y + f.height/2);
            this.addScore(f.type === 'boss' ? 50 : 10);
        });
        this.enemies.forEach(e => {
            this.createExplosion(e.x + e.width/2, e.y + e.height/2);
            this.addScore(30);
        });
        
        this.fires = [];
        this.enemies = [];
        this.screenShake = 20;
    }

    createExplosion(x, y) {
        this.explosions.push({
            x: x,
            y: y,
            radius: 10,
            life: 20,
            color: '#ff8800'
        });
        
        // Create particles
        for (let i = 0; i < 15; i++) {
            const angle = (Math.PI * 2 * i) / 15;
            const speed = Math.random() * 5 + 2;
            
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 30,
                color: ['#ff8800', '#ff4400', '#ffaa00'][Math.floor(Math.random() * 3)],
                size: Math.random() * 4 + 2
            });
        }
    }

    createFireParticle(fire) {
        this.particles.push({
            x: fire.x + Math.random() * fire.width,
            y: fire.y + Math.random() * fire.height,
            vx: Math.random() * 2 - 1,
            vy: -Math.random() * 2 - 1,
            life: 20,
            color: fire.color,
            size: Math.random() * 3 + 1
        });
    }

    createCollectEffect(x, y, color) {
        for (let i = 0; i < 10; i++) {
            const angle = (Math.PI * 2 * i) / 10;
            
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * 3,
                vy: Math.sin(angle) * 3,
                life: 25,
                color: color,
                size: 3
            });
        }
    }

    createShieldEffect() {
        for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 * i) / 20;
            
            this.particles.push({
                x: this.player.x + this.player.width/2,
                y: this.player.y + this.player.height/2,
                vx: Math.cos(angle) * 2,
                vy: Math.sin(angle) * 2,
                life: 30,
                color: '#0088ff',
                size: 2
            });
        }
    }

    showWaveMessage() {
        // Create wave announcement
        this.createWaveText(`WAVE ${this.waveNumber}!`);
    }

    createWaveText(text) {
        // This would create a floating text effect
        console.log(text);
    }

    checkCollision(a, b) {
        return a.x < b.x + b.width &&
               a.x + a.width > b.x &&
               a.y < b.y + b.height &&
               a.y + a.height > b.y;
    }

    addScore(points) {
        const multiplier = Math.max(1, Math.floor(this.combo / 5));
        this.score += points * multiplier;
        this.updateGameUI();
    }

    render() {
        // Apply screen shake
        if (this.screenShake > 0) {
            this.ctx.save();
            this.ctx.translate(
                Math.random() * this.screenShake - this.screenShake/2,
                Math.random() * this.screenShake - this.screenShake/2
            );
        }
        
        // Clear canvas with gradient background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#0a0a0a');
        gradient.addColorStop(1, '#1a0033');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Render stars
        this.renderStars();
        
        if (this.currentGame === 'pantale') {
            this.renderPantaleGame();
        } else if (this.currentGame === 'quiz') {
            this.renderQuizGame();
        }
        
        // Render UI overlay
        this.renderGameUI();
        
        if (this.screenShake > 0) {
            this.ctx.restore();
        }
    }

    renderStars() {
        this.stars.forEach(star => {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
            this.ctx.fillRect(star.x, star.y, star.size, star.size);
        });
    }

    renderPantaleGame() {
        // Render player trail
        this.player.trail.forEach((t, i) => {
            this.ctx.fillStyle = `rgba(0, 255, 136, ${t.life / 20})`;
            this.ctx.fillRect(t.x, t.y, this.player.width * (t.life / 10), this.player.height * (t.life / 10));
        });
        
        // Render player
        this.ctx.fillStyle = this.player.color;
        this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
        
        // Render player shield
        if (this.player.shield > 0) {
            this.ctx.strokeStyle = '#0088ff';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(
                this.player.x - 5, 
                this.player.y - 5, 
                this.player.width + 10, 
                this.player.height + 10
            );
        }
        
        // Render water with trails
        this.water.forEach(w => {
            w.trail.forEach(t => {
                this.ctx.fillStyle = `rgba(0, 204, 255, ${t.life / 10})`;
                this.ctx.fillRect(t.x, t.y, w.width * 0.8, w.height * 0.8);
            });
            
            this.ctx.fillStyle = w.color;
            this.ctx.fillRect(w.x, w.y, w.width, w.height);
        });
        
        // Render fires with glow effect
        this.fires.forEach(f => {
            // Glow
            this.ctx.shadowColor = f.color;
            this.ctx.shadowBlur = 10;
            this.ctx.fillStyle = f.color;
            this.ctx.fillRect(f.x, f.y, f.width, f.height);
            this.ctx.shadowBlur = 0;
        });
        
        // Render enemies
        this.enemies.forEach(e => {
            this.ctx.fillStyle = e.color;
            this.ctx.fillRect(e.x, e.y, e.width, e.height);
        });
        
        // Render explosions
        this.explosions.forEach(e => {
            this.ctx.strokeStyle = e.color;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
            this.ctx.stroke();
        });
        
        // Render power-ups
        this.powerUps.forEach(p => {
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(p.x, p.y, p.width, p.height);
            
            // Icon
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            const icon = p.type[0].toUpperCase();
            this.ctx.fillText(icon, p.x + p.width/2, p.y + p.height/2 + 4);
        });
        
        // Render particles
        this.particles.forEach(p => {
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(p.x, p.y, p.size, p.size);
        });
    }

    renderQuizGame() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        
        const q = this.quizQuestions[this.currentQuestion];
        this.ctx.fillText(q.question, this.canvas.width / 2, 100);
        
        q.options.forEach((option, i) => {
            const y = 200 + i * 60;
            const color = i === this.selectedAnswer ? '#00ff88' : '#666666';
            
            this.ctx.fillStyle = color;
            this.ctx.fillRect(50, y - 25, this.canvas.width - 100, 50);
            
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '18px Arial';
            this.ctx.fillText(option, this.canvas.width / 2, y + 5);
        });
    }

    renderGameUI() {
        if (this.currentGame === 'pantale') {
            // Health bar
            this.ctx.fillStyle = '#333333';
            this.ctx.fillRect(10, 10, 200, 20);
            this.ctx.fillStyle = '#00ff00';
            this.ctx.fillRect(10, 10, (this.player.health / this.player.maxHealth) * 200, 20);
            
            // Score
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`Score: ${this.score}`, 10, 50);
            
            // Combo
            if (this.combo > 0) {
                this.ctx.fillStyle = '#ffaa00';
                this.ctx.fillText(`Combo x${this.combo}`, 10, 70);
            }
            
            // Wave
            this.ctx.fillStyle = '#ff8800';
            this.ctx.fillText(`Wave ${this.waveNumber}`, 10, 90);
        }
    }

    showQuizQuestion() {
        this.render();
        
        this.canvas.onclick = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const y = e.clientY - rect.top;
            
            const answerIndex = Math.floor((y - 175) / 60);
            if (answerIndex >= 0 && answerIndex < 4) {
                this.selectedAnswer = answerIndex;
                this.checkQuizAnswer();
            }
        };
    }

    checkQuizAnswer() {
        const q = this.quizQuestions[this.currentQuestion];
        if (this.selectedAnswer === q.correct) {
            this.score += 100;
            this.updateGameUI();
        }
        
        this.currentQuestion++;
        if (this.currentQuestion >= this.quizQuestions.length) {
            this.endQuizGame();
        } else {
            this.selectedAnswer = -1;
            this.showQuizQuestion();
        }
    }

    endQuizGame() {
        this.gameRunning = false;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 30px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`QUIZ COMPLETE!`, this.canvas.width / 2, this.canvas.height / 2 - 30);
        this.ctx.font = '24px Arial';
        this.ctx.fillText(`Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 10);
    }

    gameOver() {
        this.gameRunning = false;
        
        // Save high score
        const highScore = localStorage.getItem('pantale_highscore') || 0;
        if (this.score > highScore) {
            localStorage.setItem('pantale_highscore', this.score);
        }
        
        this.ctx.fillStyle = '#ff0000';
        this.ctx.font = 'bold 40px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 30);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '20px Arial';
        this.ctx.fillText(`Final Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 10);
        this.ctx.fillText(`Max Combo: ${this.maxCombo}`, this.canvas.width / 2, this.canvas.height / 2 + 35);
        this.ctx.fillText(`Waves Survived: ${this.waveNumber}`, this.canvas.width / 2, this.canvas.height / 2 + 60);
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        if (!this.isPaused && this.gameRunning) {
            this.gameLoop();
        }
    }

    restartGame() {
        this.gameRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        if (this.currentGame === 'pantale') {
            this.initPantaleGame();
        } else if (this.currentGame === 'quiz') {
            this.initQuizGame();
        }
    }

    updateGameUI() {
        const scoreEl = document.getElementById('gameScore');
        const levelEl = document.getElementById('gameLevel');
        
        if (scoreEl) scoreEl.textContent = this.score;
        if (levelEl) levelEl.textContent = this.level;
    }

    cleanup() {
        this.gameRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
}
