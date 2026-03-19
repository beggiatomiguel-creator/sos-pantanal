export class GameManager {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.gameRunning = false;
        this.animationId = null;
        this.audioUnlocked = false;
        
        // Game state
        this.score = 0;
        this.level = 1;
        this.enemiesDefeated = 0;
        this.frameCount = 0;
        
        // Player state
        this.ship = {
            x: 200,
            y: 150,
            width: 30,
            height: 20,
            speed: 4,
            hp: 100,
            maxHp: 100,
            tp: 0,
            maxTp: 100
        };
        
        // Game entities
        this.hazards = [];
        this.playerBullets = [];
        this.boss = null;
        this.bossActive = false;
        
        // Game mechanics
        this.keys = {};
        this.isMoving = false;
        this.isImmune = false;
        this.immunityTimer = 0;
        this.chargeTime = 0;
        this.supernovaState = 'none';
        this.shotDisabledTimer = 0;
        this.doubleDamageTimer = 0;
        
        // Constants
        this.CHARGE_REQUIRED = 60;
        this.ENEMIES_PER_LEVEL = 10;
        
        this.init();
    }

    startFireFighterGame() {
        this.currentGame = 'firefighter';
        this.showGameContainer();
        this.initFireFighterGame();
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
    
    initFireFighterGame() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.score = 0;
        this.level = 1;
        this.gameRunning = true;
        this.isPaused = false;
        
        // Initialize game objects
        this.player = {
            x: 50,
            y: 200,
            width: 40,
            height: 30,
            speed: 5,
            color: '#22c55e'
        };
        
        this.fires = [];
        this.water = [];
        this.particles = [];
        
        this.updateGameUI();
        this.gameLoop();
    }
    
    initQuizGame() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.score = 0;
        this.level = 1;
        this.gameRunning = true;
        this.isPaused = false;
        
        this.currentQuestion = 0;
        this.quizQuestions = [
            {
                question: "Qual é a maior área alagada do mundo?",
                options: ["Pantanal", "Amazônia", "Pantanal Matogrossense", "Everglades"],
                correct: 2
            },
            {
                question: "Que porcentagem do Pantanal está no Brasil?",
                options: ["50%", "70%", "85%", "95%"],
                correct: 1
            },
            {
                question: "Qual é o principal período de queimadas no Pantanal?",
                options: ["Janeiro-Março", "Abril-Junho", "Julho-Setembro", "Outubro-Dezembro"],
                correct: 2
            }
        ];
        
        this.selectedAnswer = -1;
        this.showQuizQuestion();
    }

    setupCanvas() {
        this.canvas = document.getElementById('rocketGame');
        if (!this.canvas) {
            console.warn('Game canvas not found');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 400;
        this.canvas.height = 300;
    }

    setupEventListeners() {
        // Keyboard controls
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            
            // Prevent default for game keys
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'KeyZ'].includes(e.code)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            
            // Handle shooting on key release
            if (this.gameRunning && ['KeyZ', 'Space', 'Enter'].includes(e.code)) {
                if (this.chargeTime >= this.CHARGE_REQUIRED) {
                    this.superShoot();
                } else {
                    this.shoot();
                }
                this.chargeTime = 0;
            }
        });

    init() {
        this.setupEventListeners();
        this.setupAudio();
        console.log('GameManager initialized');
    }

    setupEventListeners() {
        // Game controls
        const startFireBtn = document.getElementById('startFireGame');
        const startQuizBtn = document.getElementById('startQuizGame');
        const pauseBtn = document.getElementById('pauseGame');
        const restartBtn = document.getElementById('restartGame');
        
        if (startFireBtn) {
            startFireBtn.addEventListener('click', () => this.startFireFighterGame());
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
        
        // Keyboard controls
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    setupAudio() {
        // Unlock audio on first user interaction
        const unlockAudio = () => {
            if (!this.audioUnlocked) {
                this.audioUnlocked = true;
                this.setAudioStatus('Pronto', '#22c55e');
                
                // Load all audio elements
                ['musicLow', 'musicMid', 'musicHigh'].forEach(id => {
                    const audio = document.getElementById(id);
                    if (audio) {
                        audio.load();
                    }
                });
            }
        };

        document.addEventListener('click', unlockAudio, { once: true });
    }

    startGame() {
        if (!this.canvas) return;

        // Hide start UI, show canvas
        const startUI = document.getElementById('gameStartUI');
        if (startUI) {
            startUI.classList.add('hidden');
        }
        this.canvas.classList.remove('hidden');

        // Reset game state
        this.resetGameState();
        
        // Start game loop
        this.gameRunning = true;
        this.gameLoop();
        
        // Start music
        this.playMusic('musicLow');
        
        // Start spawning hazards
        this.startSpawning();
    }

    resetGameState() {
        this.score = 0;
        this.level = 1;
        this.enemiesDefeated = 0;
        this.frameCount = 0;
        
        this.ship = {
            x: 200,
            y: 150,
            width: 30,
            height: 20,
            speed: 4,
            hp: 100,
            maxHp: 100,
            tp: 0,
            maxTp: 100
        };
        
        this.hazards = [];
        this.playerBullets = [];
        this.boss = null;
        this.bossActive = false;
        this.isImmune = false;
        this.immunityTimer = 0;
        this.chargeTime = 0;
        this.supernovaState = 'none';
        this.shotDisabledTimer = 0;
        this.doubleDamageTimer = 0;
        
        this.updateUI();
    }

    gameLoop() {
        if (!this.gameRunning) return;

        this.update();
        this.render();
        
        this.animationId = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        this.frameCount++;
        
        // Update player
        this.updatePlayer();
        
        // Update hazards
        this.updateHazards();
        
        // Update bullets
        this.updateBullets();
        
        // Check collisions
        this.checkCollisions();
        
        // Update game mechanics
        this.updateMechanics();
        
        // Check level up
        this.checkLevelUp();
        
        // Update music
        this.updateMusic();
        
        // Update UI
        this.updateUI();
    }

    updatePlayer() {
        let moveX = 0;
        let moveY = 0;
        
        if (this.keys['ArrowUp']) moveY -= 1;
        if (this.keys['ArrowDown']) moveY += 1;
        if (this.keys['ArrowLeft']) moveX -= 1;
        if (this.keys['ArrowRight']) moveX += 1;

        this.isMoving = (moveX !== 0 || moveY !== 0);

        // Normalize diagonal movement
        if (moveX !== 0 && moveY !== 0) {
            moveX *= 0.707;
            moveY *= 0.707;
        }

        // Update position with bounds checking
        this.ship.x = Math.max(15, Math.min(385, this.ship.x + moveX * this.ship.speed));
        this.ship.y = Math.max(10, Math.min(290, this.ship.y + moveY * this.ship.speed));

        // Handle charging
        if (this.keys['KeyZ'] || this.keys['Space'] || this.keys['Enter']) {
            const chargeSpeed = (this.level >= 10) ? 1.5 : 1;
            this.chargeTime += chargeSpeed;
        }

        // Update immunity
        if (this.isImmune) {
            this.immunityTimer--;
            if (this.immunityTimer <= 0) {
                this.isImmune = false;
            }
        }

        // Update debuffs
        if (this.shotDisabledTimer > 0) this.shotDisabledTimer--;
        if (this.doubleDamageTimer > 0) this.doubleDamageTimer--;
    }

    updateHazards() {
        this.hazards.forEach((hazard, index) => {
            // Update position
            hazard.x += hazard.vx || 0;
            hazard.y += hazard.vy || 0;
            
            // Remove off-screen hazards
            if (hazard.x < -100 || hazard.x > 500 || hazard.y < -100 || hazard.y > 400) {
                this.hazards.splice(index, 1);
            }
        });
    }

    updateBullets() {
        this.playerBullets.forEach((bullet, index) => {
            bullet.x += bullet.vx;
            
            // Remove off-screen bullets
            if (bullet.x > this.canvas.width + 20) {
                this.playerBullets.splice(index, 1);
            }
        });
    }

    checkCollisions() {
        // Bullet-hazard collisions
        this.playerBullets.forEach((bullet, bulletIndex) => {
            this.hazards.forEach((hazard, hazardIndex) => {
                const dist = this.calculateDistance(bullet.x, bullet.y, hazard.x, hazard.y);
                
                if (dist < (hazard.size/2 + bullet.size)) {
                    // Handle different hazard types
                    this.handleHazardHit(hazard, hazardIndex, bullet, bulletIndex);
                }
            });
        });

        // Player-hazard collisions
        this.hazards.forEach((hazard, index) => {
            const dist = this.calculateDistance(this.ship.x, this.ship.y, hazard.x, hazard.y);
            
            if (dist < (hazard.size/2 + 12)) {
                this.handlePlayerHit(hazard, index, dist);
            }
        });
    }

    handleHazardHit(hazard, hazardIndex, bullet, bulletIndex) {
        const damage = bullet.isSuper ? 5 : 1;
        
        if (hazard.type === 'galaxy') {
            hazard.hp -= damage;
            if (hazard.hp <= 0) {
                this.hazards.splice(hazardIndex, 1);
                this.score += 500;
                this.enemiesDefeated += 10;
            }
        } else if (hazard.type === 'asteroid') {
            this.hazards.splice(hazardIndex, 1);
            this.score += 100;
            this.enemiesDefeated++;
        } else if (hazard.type === 'heal') {
            this.hazards.splice(hazardIndex, 1);
            this.ship.hp = Math.min(this.ship.maxHp, this.ship.hp + 10);
            this.ship.tp = Math.min(this.ship.maxTp, this.ship.tp + 20);
        } else if (hazard.type === 'debuff') {
            this.hazards.splice(hazardIndex, 1);
            this.shotDisabledTimer = 180;
            this.doubleDamageTimer = 300;
        }
        
        if (!bullet.isSuper) {
            this.playerBullets.splice(bulletIndex, 1);
        }
    }

    handlePlayerHit(hazard, index, dist) {
        if (hazard.type === 'heal') {
            this.hazards.splice(index, 1);
            this.ship.hp = Math.min(this.ship.maxHp, this.ship.hp + 10);
            this.ship.tp = Math.min(this.ship.maxTp, this.ship.tp + 20);
        } else if (hazard.type === 'debuff') {
            this.hazards.splice(index, 1);
            this.shotDisabledTimer = 180;
            this.doubleDamageTimer = 300;
        } else if (!this.isImmune) {
            let damage = hazard.type === 'galaxy' ? 15 : 5;
            if (this.doubleDamageTimer > 0) damage *= 2;
            
            this.ship.hp -= damage;
            this.isImmune = true;
            this.immunityTimer = 90;
            this.hazards.splice(index, 1);
            
            if (this.ship.hp <= 0) {
                this.gameOver();
            }
        }
    }

    updateMechanics() {
        // Supernova mechanics
        this.updateSupernova();
        
        // Level 15 regeneration
        if (this.level >= 15 && this.frameCount % 120 === 0 && this.ship.hp < this.ship.maxHp) {
            this.ship.hp = Math.min(this.ship.maxHp, this.ship.hp + 1);
        }
    }

    updateSupernova() {
        // Trigger supernova every 15 seconds
        if (this.frameCount % 900 === 0 && this.supernovaState === 'none') {
            this.supernovaState = 'warning';
            this.supernovaType = Math.random() > 0.5 ? 'blue' : 'orange';
            this.supernovaTimer = 90;
        }

        if (this.supernovaState === 'warning') {
            this.supernovaTimer--;
            if (this.supernovaTimer <= 0) {
                this.supernovaState = 'active';
                this.supernovaTimer = 60;
            }
        } else if (this.supernovaState === 'active') {
            this.supernovaTimer--;
            
            // Apply damage
            if (!this.isImmune) {
                if ((this.supernovaType === 'blue' && this.isMoving) || 
                    (this.supernovaType === 'orange' && !this.isMoving)) {
                    this.ship.hp -= 0.6;
                    if (this.ship.hp <= 0) {
                        this.gameOver();
                    }
                }
            }
            
            if (this.supernovaTimer <= 0) {
                this.supernovaState = 'none';
            }
        }
    }

    checkLevelUp() {
        if (this.enemiesDefeated >= this.ENEMIES_PER_LEVEL) {
            if (this.level >= 20) {
                if (!this.bossActive) {
                    this.startBossFight();
                }
                return;
            }
            
            this.level++;
            this.enemiesDefeated = 0;
            this.applyLevelUpBonus();
            this.showLevelUpMessage();
        }
    }

    applyLevelUpBonus() {
        switch(this.level) {
            case 2: this.ship.speed += 0.5; break;
            case 3: this.ship.maxHp += 20; this.ship.hp = this.ship.maxHp; break;
            case 6: this.ship.speed += 0.5; break;
            case 8: this.ship.maxHp += 20; this.ship.hp = this.ship.maxHp; break;
            case 12: this.ship.maxHp += 30; this.ship.hp = this.ship.maxHp; break;
            case 16: this.ship.speed += 1; break;
            case 18: this.immunityTimer = 120; break;
        }
    }

    showLevelUpMessage() {
        // This would be rendered in the next frame
        this.levelUpMessage = `LEVEL UP! LV ${this.level}`;
        setTimeout(() => {
            this.levelUpMessage = null;
        }, 2000);
    }

    updateMusic() {
        const hasBoss = this.hazards.some(h => h.type === 'galaxy') || this.bossActive;
        const hasSupernova = this.supernovaState !== 'none';
        
        if (hasBoss || hasSupernova) {
            this.playMusic('musicHigh');
        } else if (this.hazards.length > 5) {
            this.playMusic('musicMid');
        } else {
            this.playMusic('musicLow');
        }
    }

    updateUI() {
        // Update score
        const scoreElement = document.getElementById('highScore');
        if (scoreElement) {
            scoreElement.textContent = Math.floor(this.score / 10);
        }
        
        // Update level
        const levelElement = document.getElementById('playerLevel');
        if (levelElement) {
            levelElement.textContent = this.level;
        }
        
        // Update HP
        const hpBar = document.getElementById('hpBar');
        const hpText = document.getElementById('hpText');
        if (hpBar && hpText) {
            const hpPercent = (this.ship.hp / this.ship.maxHp) * 100;
            hpBar.style.width = hpPercent + '%';
            hpText.textContent = `${Math.ceil(this.ship.hp)}/${this.ship.maxHp}`;
        }
        
        // Update TP
        const tpBar = document.getElementById('tpBar');
        const tpText = document.getElementById('tpText');
        if (tpBar && tpText) {
            const tpPercent = (this.ship.tp / this.ship.maxTp) * 100;
            tpBar.style.width = tpPercent + '%';
            tpText.textContent = `${Math.floor(tpPercent)}%`;
        }
    }

    render() {
        if (!this.ctx) return;

        // Clear canvas
        this.ctx.fillStyle = '#000814';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Render game elements
        this.renderSupernova();
        this.renderShip();
        this.renderBullets();
        this.renderHazards();
        this.renderCharge();
        this.renderLevelUpMessage();
    }

    renderShip() {
        if (!this.isImmune || this.frameCount % 10 < 5) {
            this.ctx.save();
            this.ctx.translate(this.ship.x, this.ship.y);
            
            // Ship color based on level
            let color = '#00f5ff';
            if (this.level >= 5) color = '#00ff88';
            if (this.level >= 10) color = '#ffeb3b';
            if (this.level >= 15) color = '#f0f';
            if (this.level >= 20) color = '#fff';
            
            this.ctx.fillStyle = color;
            this.ctx.shadowBlur = (this.level >= 10) ? 10 : 0;
            this.ctx.shadowColor = color;
            
            // Draw ship based on level
            this.drawShipShape();
            
            this.ctx.restore();
        }
    }

    drawShipShape() {
        this.ctx.beginPath();
        
        if (this.level < 5) {
            // Basic triangle
            this.ctx.moveTo(15, 0);
            this.ctx.lineTo(-15, -10);
            this.ctx.lineTo(-10, 0);
            this.ctx.lineTo(-15, 10);
        } else if (this.level < 10) {
            // With small wings
            this.ctx.moveTo(18, 0);
            this.ctx.lineTo(-10, -8);
            this.ctx.lineTo(-18, -15);
            this.ctx.lineTo(-12, 0);
            this.ctx.lineTo(-18, 15);
            this.ctx.lineTo(-10, 8);
        } else if (this.level < 15) {
            // Delta wing
            this.ctx.moveTo(20, 0);
            this.ctx.lineTo(-5, -10);
            this.ctx.lineTo(-20, -20);
            this.ctx.lineTo(-10, -5);
            this.ctx.lineTo(-10, 5);
            this.ctx.lineTo(-20, 20);
            this.ctx.lineTo(-5, 10);
        } else {
            // Advanced cross/star
            this.ctx.moveTo(25, 0);
            this.ctx.lineTo(5, -10);
            this.ctx.lineTo(-5, -25);
            this.ctx.lineTo(-10, -10);
            this.ctx.lineTo(-25, 0);
            this.ctx.lineTo(-10, 10);
            this.ctx.lineTo(-5, 25);
            this.ctx.lineTo(5, 10);
        }
        
        this.ctx.closePath();
        this.ctx.fill();
    }

    renderBullets() {
        this.playerBullets.forEach(bullet => {
            if (bullet.isSuper) {
                const grad = this.ctx.createRadialGradient(bullet.x, bullet.y, 0, bullet.x, bullet.y, bullet.size);
                grad.addColorStop(0, '#fff');
                grad.addColorStop(0.5, '#ffeb3b');
                grad.addColorStop(1, 'transparent');
                this.ctx.fillStyle = grad;
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = '#ffeb3b';
            } else {
                this.ctx.fillStyle = '#ffeb3b';
                this.ctx.shadowBlur = 0;
            }
            
            this.ctx.beginPath();
            this.ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });
    }

    renderHazards() {
        this.hazards.forEach(hazard => {
            this.ctx.fillStyle = hazard.color;
            
            if (hazard.type === 'asteroid' || hazard.type === 'heal' || hazard.type === 'debuff') {
                this.ctx.beginPath();
                this.ctx.arc(hazard.x, hazard.y, hazard.size/2, 0, Math.PI * 2);
                this.ctx.fill();
                
                if (hazard.type === 'heal') {
                    this.ctx.strokeStyle = '#fff';
                    this.ctx.stroke();
                } else if (hazard.type === 'debuff') {
                    this.ctx.strokeStyle = '#00f5ff';
                    this.ctx.lineWidth = 3;
                    this.ctx.beginPath();
                    this.ctx.arc(hazard.x, hazard.y, hazard.size/2 + 5, 0, Math.PI * 2);
                    this.ctx.stroke();
                }
            } else if (hazard.type === 'galaxy') {
                this.ctx.save();
                this.ctx.translate(hazard.x, hazard.y);
                this.ctx.rotate(this.frameCount * 0.05);
                
                const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, hazard.size);
                gradient.addColorStop(0, '#fff');
                gradient.addColorStop(0.5, '#f0f');
                gradient.addColorStop(1, 'transparent');
                this.ctx.fillStyle = gradient;
                
                this.ctx.beginPath();
                for(let a = 0; a < Math.PI * 2; a += 0.1) {
                    let r = hazard.size * Math.sin(a * 3);
                    this.ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
                }
                this.ctx.fill();
                this.ctx.restore();
            }
        });
    }

    renderSupernova() {
        if (this.supernovaState === 'warning') {
            const color = this.supernovaType === 'blue' ? '#00f5ff' : '#ff8c00';
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 10;
            
            if (this.frameCount % 10 < 5) {
                this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.fillStyle = color;
                this.ctx.font = 'bold 30px "Determination Mono", monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`! SUPERNOVA ${this.supernovaType === 'blue' ? 'AZUL' : 'LARANJA'} !`, this.canvas.width/2, 50);
                this.ctx.font = '16px "Determination Mono", monospace';
                this.ctx.fillText(this.supernovaType === 'blue' ? 'FIQUE PARADO!' : 'MOVA-SE!', this.canvas.width/2, 80);
            }
        } else if (this.supernovaState === 'active') {
            const color = this.supernovaType === 'blue' ? 'rgba(0, 245, 255, 0.5)' : 'rgba(255, 140, 0, 0.5)';
            this.ctx.fillStyle = color;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    renderCharge() {
        if (this.chargeTime > 0) {
            const chargeRatio = Math.min(1, this.chargeTime / this.CHARGE_REQUIRED);
            this.ctx.strokeStyle = `rgba(255, 235, 59, ${chargeRatio})`;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(this.ship.x, this.ship.y, 25 * chargeRatio, 0, Math.PI * 2);
            this.ctx.stroke();
            
            if (this.chargeTime >= this.CHARGE_REQUIRED) {
                this.ctx.fillStyle = '#ffeb3b';
                if (this.frameCount % 4 < 2) {
                    this.ctx.beginPath();
                    this.ctx.arc(this.ship.x, this.ship.y, 28, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
        }
    }

    renderLevelUpMessage() {
        if (this.levelUpMessage) {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 30px "Determination Mono", monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(this.levelUpMessage, this.canvas.width/2, this.canvas.height/2);
        }
    }

    shoot() {
        if (this.shotDisabledTimer > 0 || this.ship.tp < 1) return;
        
        this.ship.tp -= 1;
        
        const bulletSize = (this.level >= 4) ? 7 : 5;
        const bulletSpeed = (this.level >= 9) ? 10 : 7;
        
        if (this.level < 5) {
            // Single shot
            this.playerBullets.push({ 
                x: this.ship.x + 15, 
                y: this.ship.y, 
                vx: bulletSpeed, 
                vy: 0, 
                size: bulletSize, 
                isSuper: false 
            });
        } else if (this.level < 13) {
            // Double shot
            this.playerBullets.push({ 
                x: this.ship.x + 15, 
                y: this.ship.y - 5, 
                vx: bulletSpeed, 
                vy: 0, 
                size: bulletSize, 
                isSuper: false 
            });
            this.playerBullets.push({ 
                x: this.ship.x + 15, 
                y: this.ship.y + 5, 
                vx: bulletSpeed, 
                vy: 0, 
                size: bulletSize, 
                isSuper: false 
            });
        } else {
            // Triple shot
            this.playerBullets.push({ 
                x: this.ship.x + 15, 
                y: this.ship.y - 8, 
                vx: bulletSpeed, 
                vy: 0, 
                size: bulletSize, 
                isSuper: false 
            });
            this.playerBullets.push({ 
                x: this.ship.x + 15, 
                y: this.ship.y, 
                vx: bulletSpeed, 
                vy: 0, 
                size: bulletSize, 
                isSuper: false 
            });
            this.playerBullets.push({ 
                x: this.ship.x + 15, 
                y: this.ship.y + 8, 
                vx: bulletSpeed, 
                vy: 0, 
                size: bulletSize, 
                isSuper: false 
            });
        }
    }

    superShoot() {
        if (this.shotDisabledTimer > 0) return;
        
        const cost = (this.level >= 17) ? 7 : 10;
        if (this.ship.tp < cost) return;
        
        this.ship.tp -= cost;
        const size = (this.level >= 19) ? 35 : 20;
        
        this.playerBullets.push({ 
            x: this.ship.x + 15, 
            y: this.ship.y, 
            vx: 10, 
            vy: 0, 
            size: size, 
            isSuper: true 
        });
    }

    startSpawning() {
        const spawn = () => {
            if (!this.gameRunning) return;
            
            this.frameCount++;
            
            // Spawn different hazard types
            if (!this.bossActive) {
                if (this.frameCount % 60 === 0) {
                    this.spawnAsteroid();
                }
                
                if (this.frameCount % 300 === 0) {
                    this.spawnHeal();
                }
                
                if (this.frameCount % 600 === 0) {
                    this.spawnGalaxy();
                }
            }
            
            requestAnimationFrame(spawn);
        };
        
        spawn();
    }

    spawnAsteroid() {
        const side = Math.floor(Math.random() * 4);
        let hazard = { 
            size: 15 + Math.random() * 15, 
            type: 'asteroid', 
            color: '#888' 
        };
        
        if (side === 0) {
            hazard.x = Math.random() * 400; 
            hazard.y = -50; 
            hazard.vy = 1.5 + Math.random() * 1.5;
        } else if (side === 1) {
            hazard.x = Math.random() * 400; 
            hazard.y = 350; 
            hazard.vy = -(1.5 + Math.random() * 1.5);
        } else if (side === 2) {
            hazard.x = -50; 
            hazard.y = Math.random() * 300; 
            hazard.vx = 1.5 + Math.random() * 1.5;
        } else {
            hazard.x = 450; 
            hazard.y = Math.random() * 300; 
            hazard.vx = -(1.5 + Math.random() * 1.5);
        }
        
        this.hazards.push(hazard);
    }

    spawnHeal() {
        this.hazards.push({
            x: Math.random() * 400,
            y: -50,
            vx: 0,
            vy: 1.5,
            size: 20,
            type: 'heal',
            color: '#22c55e'
        });
    }

    spawnGalaxy() {
        this.hazards.push({
            x: 450,
            y: Math.random() * 200 + 50,
            vx: -0.7,
            vy: 0,
            size: 70,
            type: 'galaxy',
            color: '#f0f',
            hp: 10
        });
    }

    startBossFight() {
        this.bossActive = true;
        this.hazards = [];
        
        this.boss = {
            x: 500,
            y: 150,
            hp: 1500,
            maxHp: 1500,
            size: 100,
            state: 'idle',
            phase: 1,
            timer: 0
        };
        
        this.playMusic('musicHigh');
    }

    calculateDistance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }

    playMusic(trackId) {
        const track = document.getElementById(trackId);
        if (!track || !this.audioUnlocked) return;
        
        const volume = parseFloat(localStorage.getItem('app_volume') || '0.5');
        track.volume = volume;
        
        track.play().catch(() => {
            // Audio blocked - ignore
        });
    }

    toggleAudio() {
        const toggleBtn = document.getElementById('toggleAudio');
        if (!toggleBtn) return;
        
        const tracks = ['musicLow', 'musicMid', 'musicHigh'];
        const currentTrack = tracks.find(id => {
            const audio = document.getElementById(id);
            return audio && !audio.paused;
        });
        
        if (currentTrack) {
            const audio = document.getElementById(currentTrack);
            if (audio.paused) {
                audio.play();
                toggleBtn.textContent = '[ 🔈 ]';
            } else {
                audio.pause();
                toggleBtn.textContent = '[ 🔇 ]';
            }
        }
    }

    setAudioStatus(text, color) {
        const statusElement = document.getElementById('audioStatus');
        if (statusElement) {
            statusElement.textContent = `Som: ${text}`;
            statusElement.style.color = color || '#64748b';
        }
    }

    gameOver() {
        this.gameRunning = false;
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Stop music
        ['musicLow', 'musicMid', 'musicHigh'].forEach(id => {
            const audio = document.getElementById(id);
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
        });
        
        // Show game over screen
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 40px "Determination Mono", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('FIM DE MISSÃO', this.canvas.width/2, this.canvas.height/2 - 20);
        
        this.ctx.font = '20px "Determination Mono", monospace';
        this.ctx.fillText('Mantenha a Determinação!', this.canvas.width/2, this.canvas.height/2 + 20);
        
        this.ctx.font = '16px "Determination Mono", monospace';
        this.ctx.fillText(`Pontuação Final: ${Math.floor(this.score / 10)}`, this.canvas.width/2, this.canvas.height/2 + 60);
        
        setTimeout(() => {
            this.stopGame();
        }, 3000);
    }

    stopGame() {
        this.gameRunning = false;
        this.bossActive = false;
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Stop all music
        ['musicLow', 'musicMid', 'musicHigh'].forEach(id => {
            const audio = document.getElementById(id);
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
        });
        
        // Show start screen
        const startUI = document.getElementById('gameStartUI');
        if (startUI) {
            startUI.classList.remove('hidden');
        }
        
        if (this.canvas) {
            this.canvas.classList.add('hidden');
        }
    }

    cleanup() {
        this.stopGame();
        
        // Remove event listeners
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
    }
}
