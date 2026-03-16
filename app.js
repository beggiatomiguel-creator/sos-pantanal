// 1. CHAVE DA NASA (Prioriza localStorage)
let API_KEY = localStorage.getItem('nasa_api_key') || 'jndhJt9s4cApwgK3LwcHS9OUxhfcgoVPQ43XI7hs'; 

const apiKeyInput = document.getElementById('apiKeyInput');
if (apiKeyInput) {
    apiKeyInput.value = API_KEY;
    apiKeyInput.addEventListener('change', (e) => {
        API_KEY = e.target.value.trim();
        localStorage.setItem('nasa_api_key', API_KEY);
        renderMapState();
    });
}

// Coordenadas do Pantanal
const PANTANAL_AREA = '-59,-22,-54,-16'; 

let map;
let userMarker;
let radiusCircle;
let fireMarkers = [];
let userLocation = { lat: -19.0116, lng: -57.6534 }; // Corumbá, MS
let currentRadius = 100; // Raio padrão inicial
let lastFireCount = 0;
let isLiveData = false; // Flag para indicar se os dados são da NASA

// Configurações de Áudio
const alertAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

// 2. DADOS DE DEMONSTRAÇÃO (Fallback se a NASA falhar)
const demoFires = [
    { latitude: -19.1234, longitude: -57.5678, confidence: 'high', acq_date: '2026-03-16' },
    { latitude: -18.9876, longitude: -57.8901, confidence: 'nominal', acq_date: '2026-03-16' },
    { latitude: -19.4567, longitude: -56.7890, confidence: 'low', acq_date: '2026-03-16' }
];

async function fetchFireData() {
    if (!API_KEY || API_KEY.trim().length < 5) {
        isLiveData = false;
        updateDataIndicator();
        return demoFires;
    }

    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${API_KEY.trim()}/VIIRS_SNPP_NRT/${PANTANAL_AREA}/1`;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos de timeout

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const text = await response.text();
        if (text.toLowerCase().includes("invalid api call")) {
            console.error("NASA API Key is invalid.");
            isLiveData = false;
            updateDataIndicator();
            return demoFires;
        }

        const data = parseCSV(text);
        if (data.length === 0) {
            isLiveData = true; // API funcionou, mas não há focos
            updateDataIndicator();
            return [];
        }

        isLiveData = true;
        updateDataIndicator();
        return data;
    } catch (error) {
        console.warn("NASA API fetch failed, using demo data:", error.message);
        isLiveData = false;
        updateDataIndicator();
        return demoFires;
    }
}

function updateDataIndicator() {
    const statusDiv = document.getElementById('data-status');
    if (!statusDiv) return;
    
    if (isLiveData) {
        statusDiv.innerHTML = `<span class="px-2 py-0.5 bg-green-500/10 text-green-500 text-[10px] font-bold rounded-full border border-green-500/20 flex items-center gap-1 animate-pulse"><i data-lucide="wifi" class="w-3 h-3"></i> NASA LIVE</span>`;
    } else {
        statusDiv.innerHTML = `<span class="px-2 py-0.5 bg-yellow-500/10 text-yellow-500 text-[10px] font-bold rounded-full border border-yellow-500/20 flex items-center gap-1"><i data-lucide="wifi-off" class="w-3 h-3"></i> MODO DEMO</span>`;
    }
    lucide.createIcons();
}

function parseCSV(csvData) {
    if (!csvData || typeof csvData !== 'string') return [];
    
    try {
        const lines = csvData.trim().split('\n');
        if (lines.length < 2) return [];
        
        const headers = lines[0].split(',').map(h => h.trim());
        return lines.slice(1).map(line => {
            const values = line.split(',');
            let fire = {};
            headers.forEach((header, i) => {
                if (values[i] !== undefined) {
                    fire[header] = values[i].trim();
                }
            });
            return fire;
        }).filter(f => f.latitude && f.longitude);
    } catch (e) {
        console.error("CSV parsing error:", e);
        return [];
    }
}

function initMap() {
    try {
        map = L.map('map', { 
            center: [userLocation.lat, userLocation.lng], 
            zoom: 8, 
            zoomControl: false 
        });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
        }).addTo(map);
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        updateUserLocation();
    } catch (error) {
        console.error("Map initialization failed:", error);
        document.getElementById('map').innerHTML = `<div class="flex items-center justify-center h-full text-slate-500 p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-700">Erro ao carregar o mapa. Por favor, recarregue a página.</div>`;
    }
}

async function updateUserLocation() {
    if (navigator.geolocation) {
        setAudioStatus('Aguardando Localização...', '#64748b');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = { 
                    lat: position.coords.latitude, 
                    lng: position.coords.longitude 
                };
                renderMapState();
            },
            (error) => {
                console.warn("Geolocation denied/failed:", error.message);
                document.getElementById('location-text').innerText = "Localização padrão: Corumbá, MS (GPS negado)";
                renderMapState();
            },
            { timeout: 10000 }
        );
    } else {
        renderMapState();
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function renderMapState() {
    if (!map) return; 

    const loader = document.getElementById('mapLoader');
    if (loader) loader.classList.replace('hidden', 'flex');

    try {
        fireMarkers.forEach(m => map.removeLayer(m));
        fireMarkers = [];
        if (radiusCircle) map.removeLayer(radiusCircle);
        if (userMarker) map.removeLayer(userMarker);

        document.getElementById('location-text').innerText = `Localização: ${userLocation.lat.toFixed(2)}, ${userLocation.lng.toFixed(2)}`;
        
        const coordsDisplay = document.getElementById('currentCoords');
        if (coordsDisplay) coordsDisplay.innerText = `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`;
        
        map.setView([userLocation.lat, userLocation.lng], map.getZoom());

        const userIcon = L.divIcon({ 
            html: `<div class="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>`, 
            className: '', 
            iconSize: [16, 16] 
        });
        userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map);

        radiusCircle = L.circle([userLocation.lat, userLocation.lng], { 
            radius: currentRadius * 1000, 
            color: '#3b82f6', 
            weight: 1, 
            fillOpacity: 0.05 
        }).addTo(map);

        const allFires = await fetchFireData();
        let firesInRange = 0;

        allFires.forEach(fire => {
            const lat = parseFloat(fire.latitude);
            const lng = parseFloat(fire.longitude);
            if (isNaN(lat) || isNaN(lng)) return;

            const distance = calculateDistance(userLocation.lat, userLocation.lng, lat, lng);

            if (distance <= currentRadius) {
                firesInRange++;
                const conf = String(fire.confidence).toLowerCase();
                const color = (conf === 'high' || parseInt(conf) > 80) ? '#ef4444' : (conf === 'nominal' || parseInt(conf) > 50) ? '#f59e0b' : '#22c55e';
                const icon = L.divIcon({
                    html: `<div class="w-6 h-6 rounded-full flex items-center justify-center border-2 border-white animate-pulse shadow-lg" style="background-color: ${color}"><i data-lucide="flame" class="w-4 h-4 text-white"></i></div>`,
                    className: '', iconSize: [24, 24]
                });
                const marker = L.marker([lat, lng], { icon }).bindPopup(`<b>Foco Detectado</b><br>Distância: ${distance.toFixed(1)} km<br>Confiança: ${conf}`).addTo(map);
                fireMarkers.push(marker);
            }
        });

        if (firesInRange > lastFireCount) {
            alertAudio.play().catch(e => console.log("Audio blocked. Unlock by playing mini-game."));
        }
        lastFireCount = firesInRange;

        const countEl = document.getElementById('fire-count');
        if (countEl) {
            countEl.innerText = firesInRange;
            countEl.classList.add('scale-110', 'text-red-400');
            setTimeout(() => countEl.classList.remove('scale-110', 'text-red-400'), 1000);
        }
        
        lucide.createIcons();
    } finally {
        if (loader) loader.classList.replace('flex', 'hidden');
    }
}

// Controle de Raio com Debounce
const radiusRange = document.getElementById('radiusRange');
const radiusValue = document.getElementById('radiusValue');
let radiusTimeout;

radiusRange.addEventListener('input', (e) => {
    currentRadius = parseInt(e.target.value);
    radiusValue.innerText = currentRadius;
    
    clearTimeout(radiusTimeout);
    radiusTimeout = setTimeout(() => {
        renderMapState();
    }, 300);
});

// Modal de Reporte
document.getElementById('reportBtn').addEventListener('click', () => document.getElementById('reportModal').classList.replace('hidden', 'flex'));
document.getElementById('closeModal').addEventListener('click', () => document.getElementById('reportModal').classList.replace('hidden', 'flex'));

const reportForm = document.getElementById('reportForm');
if (reportForm) {
    reportForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Obrigado! Seu relatório foi enviado e será validado pelas brigadas locais.');
        document.getElementById('reportModal').classList.replace('flex', 'hidden');
        reportForm.reset();
    });
}

// Mini-Games Logic (Space Adventure Style)
const gamesBtn = document.getElementById('gamesBtn');
const gamesModal = document.getElementById('gamesModal');
const closeGames = document.getElementById('closeGames');
const toggleAudioBtn = document.getElementById('toggleAudio');
const audioStatus = document.getElementById('audioStatus');
const startGameBtn = document.getElementById('startGameBtn');
const canvas = document.getElementById('rocketGame');
const ctx = canvas.getContext('2d');
const hpBar = document.getElementById('hpBar');
const hpText = document.getElementById('hpText');
const tpBar = document.getElementById('tpBar');
const tpText = document.getElementById('tpText');
const musicLow = document.getElementById('musicLow');
const musicMid = document.getElementById('musicMid');
const musicHigh = document.getElementById('musicHigh');
let currentMusic = null;
let audioUnlocked = false;

function setAudioStatus(text, color) {
    if (audioStatus) {
        audioStatus.innerText = `Som: ${text}`;
        audioStatus.style.color = color || '#64748b';
    }
}

// Tenta desbloquear áudio no primeiro clique
document.addEventListener('click', () => {
    if (!audioUnlocked) {
        audioUnlocked = true;
        setAudioStatus('Pronto', '#22c55e');
        [musicLow, musicMid, musicHigh, alertAudio].forEach(audio => {
            audio.load();
        });
    }
}, { once: true });

let gameRunning = false;
let score = 0;
let ship = { x: 200, y: 150, width: 30, height: 20, speed: 4 };
let hazards = []; 
let playerBullets = [];
let animationId;
let hp = 100;
let maxHp = 100;
let tp = 0;
let maxTp = 100;
let keys = {};
let frameCount = 0;
let isMoving = false;
let isImmune = false;
let immunityTimer = 0;
let level = 1;
let enemiesDefeated = 0;

// Supernova States
let supernovaState = 'none'; // 'none', 'warning', 'active'
let supernovaType = 'blue'; // 'blue' (stay still), 'orange' (keep moving)
let supernovaTimer = 0;

let chargeTime = 0;
const CHARGE_REQUIRED = 60; // 1 segundo (60 frames)

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
});

window.addEventListener('keyup', (e) => {
    if (gameRunning && (e.code === 'KeyZ' || e.code === 'Space' || e.code === 'Enter')) {
        if (chargeTime >= CHARGE_REQUIRED) {
            superShoot();
        } else {
            shoot();
        }
        chargeTime = 0;
    }
    keys[e.code] = false;
});

function superShoot() {
    if (tp >= 10) {
        tp -= 10;
        updateTP();
        playerBullets.push({ x: ship.x + 15, y: ship.y, vx: 15, vy: 0, size: 20, isSuper: true });
    }
}

function shoot() {
    if (tp >= 1) {
        tp -= 1;
        updateTP();
        playerBullets.push({ x: ship.x + 15, y: ship.y, vx: 10, vy: 0, size: 5, isSuper: false });
    }
}

gamesBtn.addEventListener('click', () => gamesModal.classList.replace('hidden', 'flex'));
closeGames.addEventListener('click', () => {
    gamesModal.classList.replace('flex', 'hidden');
    musicLow.pause();
    musicMid.pause();
    musicHigh.pause();
    musicLow.currentTime = 0;
    musicMid.currentTime = 0;
    musicHigh.currentTime = 0;
    stopGame();
});

toggleAudioBtn.addEventListener('click', () => {
    if (currentMusic) {
        if (currentMusic.paused) {
            currentMusic.play();
            toggleAudioBtn.innerText = '[ 🔈 ]';
        } else {
            currentMusic.pause();
            toggleAudioBtn.innerText = '[ 🔇 ]';
        }
    } else {
        // Se ainda não começou, tenta tocar a primeira
        switchMusic(musicLow);
        toggleAudioBtn.innerText = '[ 🔈 ]';
    }
});

function spawnHazards() {
    if (!gameRunning) return;
    
    frameCount++;
    
    // Trigger Supernova every ~10 seconds
    if (frameCount % 600 === 0 && supernovaState === 'none') {
        supernovaState = 'warning';
        supernovaType = Math.random() > 0.5 ? 'blue' : 'orange';
        supernovaTimer = 90; // 1.5 seconds warning
    }

    // Asteroides Normais (only spawn if no supernova is active)
    if (supernovaState === 'none' && frameCount % 40 === 0) {
        const side = Math.floor(Math.random() * 4);
        let h = { x: 0, y: 0, vx: 0, vy: 0, size: 15 + Math.random() * 15, type: 'asteroid', color: '#888' };
        if (side === 0) { h.x = Math.random() * 400; h.y = -50; h.vy = 2 + Math.random() * 2; }
        else if (side === 1) { h.x = Math.random() * 400; h.y = 350; h.vy = -(2 + Math.random() * 2); }
        else if (side === 2) { h.x = -50; h.y = Math.random() * 300; h.vx = 2 + Math.random() * 2; }
        else { h.x = 450; h.y = Math.random() * 300; h.vx = -(2 + Math.random() * 2); }
        hazards.push(h);
    }

    // Asteroides Verdes (Cura)
    if (supernovaState === 'none' && frameCount % 200 === 0) {
        let h = { x: Math.random() * 400, y: -50, vx: 0, vy: 2, size: 20, type: 'heal', color: '#22c55e' };
        hazards.push(h);
    }

    // Galáxia Boss
    if (supernovaState === 'none' && frameCount % 400 === 0) {
        let h = { x: 450, y: Math.random() * 200 + 50, vx: -1, vy: 0, size: 70, type: 'galaxy', color: '#f0f', hp: 10 };
        hazards.push(h);
    }

    requestAnimationFrame(spawnHazards);
}

function switchMusic(newTrack) {
    if (!newTrack) return;
    
    if (currentMusic === newTrack && !newTrack.paused) return;

    if (currentMusic && currentMusic !== newTrack) {
        currentMusic.pause();
    }

    currentMusic = newTrack;
    newTrack.volume = 0.4;

    const playAttempt = () => {
        newTrack.play()
            .then(() => {
                setAudioStatus('Tocando', '#22c55e');
            })
            .catch(e => {
                console.log("Audio play failed:", e);
                // Se falhar, tentamos novamente após um pequeno delay se o jogo ainda estiver rodando
                if (gameRunning) {
                    setTimeout(playAttempt, 1000);
                }
                setAudioStatus('Clique para Som', '#f59e0b');
            });
    };

    // Adiciona evento de erro para o elemento de áudio
    newTrack.onerror = () => {
        setAudioStatus('Erro no Arquivo', '#ef4444');
        console.log("Error loading audio source:", newTrack.src);
    };

    if (newTrack.readyState >= 2) {
        playAttempt();
    } else {
        setAudioStatus('Carregando...', '#64748b');
        newTrack.load(); // Força o carregamento
        newTrack.oncanplaythrough = () => {
            playAttempt();
            newTrack.oncanplaythrough = null;
        };
    }
}

function updateGame() {
    if (!gameRunning) return;

    ctx.fillStyle = '#000814'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Lógica de Música Dinâmica
    let bossOnScreen = hazards.some(h => h.type === 'galaxy');
    if (supernovaState !== 'none' || bossOnScreen) {
        switchMusic(musicHigh);
    } else if (hazards.length > 5) {
        switchMusic(musicMid);
    } else {
        switchMusic(musicLow);
    }

    // Movimentação da Nave
    let moveX = 0;
    let moveY = 0;
    if (keys['ArrowUp']) moveY -= 1;
    if (keys['ArrowDown']) moveY += 1;
    if (keys['ArrowLeft']) moveX -= 1;
    if (keys['ArrowRight']) moveX += 1;

    isMoving = (moveX !== 0 || moveY !== 0);

    if (moveX !== 0 && moveY !== 0) {
        moveX *= 0.707;
        moveY *= 0.707;
    }

    ship.x = Math.max(15, Math.min(385, ship.x + moveX * ship.speed));
    ship.y = Math.max(10, Math.min(290, ship.y + moveY * ship.speed));

    // Handle Charge Mechanic
    if (keys['KeyZ'] || keys['Space'] || keys['Enter']) {
        chargeTime++;
        if (chargeTime > 0) {
            const chargeRatio = Math.min(1, chargeTime / CHARGE_REQUIRED);
            ctx.strokeStyle = `rgba(255, 235, 59, ${chargeRatio})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(ship.x, ship.y, 25 * chargeRatio, 0, Math.PI * 2);
            ctx.stroke();
            if (chargeTime >= CHARGE_REQUIRED) {
                ctx.fillStyle = '#ffeb3b';
                if (frameCount % 4 < 2) {
                    ctx.beginPath();
                    ctx.arc(ship.x, ship.y, 28, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    // Handle Supernova Logic
    if (supernovaState === 'warning') {
        supernovaTimer--;
        const color = supernovaType === 'blue' ? '#00f5ff' : '#ff8c00';
        ctx.strokeStyle = color;
        ctx.lineWidth = 10;
        if (frameCount % 10 < 5) {
            ctx.strokeRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = color;
            ctx.font = 'bold 30px "Determination Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`! SUPERNOVA ${supernovaType === 'blue' ? 'AZUL' : 'LARANJA'} !`, canvas.width/2, 50);
            ctx.font = '16px "Determination Mono", monospace';
            ctx.fillText(supernovaType === 'blue' ? 'FIQUE PARADO!' : 'MOVA-SE!', canvas.width/2, 80);
        }
        if (supernovaTimer <= 0) {
            supernovaState = 'active';
            supernovaTimer = 60; // 1 second active
        }
    } else if (supernovaState === 'active') {
        supernovaTimer--;
        ctx.fillStyle = supernovaType === 'blue' ? 'rgba(0, 245, 255, 0.5)' : 'rgba(255, 140, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Damage logic
        if (!isImmune) {
            if (supernovaType === 'blue' && isMoving) {
                hp -= 0.6; // Dano reduzido
                updateHP();
            } else if (supernovaType === 'orange' && !isMoving) {
                hp -= 0.6; // Dano reduzido
                updateHP();
            }
        }

        if (hp <= 0) gameOver();
        if (supernovaTimer <= 0) supernovaState = 'none';
    }

    // Handle Immunity
    if (isImmune) {
        immunityTimer--;
        if (immunityTimer <= 0) {
            isImmune = false;
        }
    }

    // Desenhar Nave
    drawShip();

    // Atualizar Balas do Jogador
    playerBullets.forEach((b, i) => {
        b.x += b.vx;
        if (b.isSuper) {
            const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.size);
            grad.addColorStop(0, '#fff');
            grad.addColorStop(0.5, '#ffeb3b');
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ffeb3b';
        } else {
            ctx.fillStyle = '#ffeb3b';
            ctx.shadowBlur = 0;
        }
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        if (b.x > canvas.width + 20) playerBullets.splice(i, 1);
    });

    // Atualizar Hazards e Lógica de TP (Graze)
    hazards.forEach((h, i) => {
        h.x += h.vx || 0;
        h.y += h.vy || 0;
        
        // Desenhar Hazard
        if (h.type === 'asteroid' || h.type === 'heal') {
            ctx.fillStyle = h.color;
            ctx.beginPath();
            ctx.arc(h.x, h.y, h.size/2, 0, Math.PI * 2);
            ctx.fill();
            if (h.type === 'heal') {
                ctx.strokeStyle = '#fff';
                ctx.stroke();
            }
        } else if (h.type === 'galaxy') {
            ctx.save();
            ctx.translate(h.x, h.y);
            ctx.rotate(frameCount * 0.05);
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, h.size);
            gradient.addColorStop(0, '#fff');
            gradient.addColorStop(0.5, '#f0f');
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            for(let a=0; a<Math.PI*2; a+=0.1) {
                let r = h.size * Math.sin(a * 3);
                ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
            }
            ctx.fill();
            ctx.restore();
        }

        // Colisão com Balas do Jogador
        playerBullets.forEach((pb, pbi) => {
            const dx = pb.x - h.x;
            const dy = pb.y - h.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < (h.size/2 + pb.size)) {
                if (!pb.isSuper) playerBullets.splice(pbi, 1);
                
                const damage = pb.isSuper ? 5 : 1;
                
                if (h.type === 'galaxy') {
                    h.hp -= damage;
                    if (h.hp <= 0) {
                        hazards.splice(i, 1);
                        score += 500;
                        enemiesDefeated += 10; // Galáxias contam como 10 inimigos
                        checkLevelUp();
                    }
                } else if (h.type === 'asteroid') {
                    hazards.splice(i, 1);
                    score += 100;
                    enemiesDefeated++;
                    checkLevelUp();
                }
            }
        });

        // Mecânica de TP (Graze / Tension Points)
        const dx = ship.x - h.x;
        const dy = ship.y - h.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (h.type !== 'heal' && dist < (h.size/2 + 30) && dist > (h.size/2 + 5)) {
            tp = Math.min(maxTp, tp + 0.2); 
            updateTP();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(ship.x, ship.y, 20, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Colisão com a Nave
        const hitBoxRadius = (h.type === 'galaxy' ? 20 : 12);
        if (dist < (h.size/2 + hitBoxRadius)) {
            if (h.type === 'heal') {
                hp = Math.min(maxHp, hp + 10);
                hazards.splice(i, 1);
                updateHP();
            } else if (!isImmune) {
                hp -= (h.type === 'galaxy' ? 15 : 5);
                hazards.splice(i, 1);
                isImmune = true;
                immunityTimer = 90; // 1.5 segundos de imunidade
                updateHP();
                if (hp <= 0) gameOver();
            }
        }

        if (h.x < -100 || h.x > 500 || h.y < -100 || h.y > 400) hazards.splice(i, 1);
    });

    score++;
    document.getElementById('highScore').innerText = Math.floor(score / 10);
    animationId = requestAnimationFrame(updateGame);
}

function drawShip() {
    if (!isImmune || frameCount % 10 < 5) {
        ctx.save();
        ctx.translate(ship.x, ship.y);

        // Base da Nave
        ctx.fillStyle = '#00f5ff';
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-15, -10);
        ctx.lineTo(-10, 0);
        ctx.lineTo(-15, 10);
        ctx.closePath();
        ctx.fill();

        // Detalhes baseados no nível
        if (level >= 3) {
            ctx.fillStyle = '#ffeb3b'; // Detalhes dourados
            ctx.fillRect(-5, -2, 10, 4);
        }
        if (level >= 5) {
            ctx.fillStyle = '#f0f'; // Detalhes roxos
            ctx.beginPath();
            ctx.arc(15, 0, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        if (level >= 7) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-15, -10);
            ctx.lineTo(-20, -15);
            ctx.moveTo(-15, 10);
            ctx.lineTo(-20, 15);
            ctx.stroke();
        }
        if (level >= 9) {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(0, 0, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

function updateHP() {
    const percent = (hp / maxHp) * 100;
    hpBar.style.width = percent + '%';
    hpText.innerText = `${Math.ceil(hp)} / ${maxHp}`;
    document.getElementById('playerLevel').innerText = level;
}

function updateTP() {
    const percent = (tp / maxTp) * 100;
    tpBar.style.width = percent + '%';
    tpText.innerText = `${Math.floor(percent)}%`;
}

function checkLevelUp() {
    if (enemiesDefeated >= 10) {
        if (level >= 10) {
            victory();
            return;
        }
        level++;
        enemiesDefeated = 0;
        maxHp = Math.floor(maxHp * 1.10);
        hp = maxHp; // Cura total ao subir de nível
        updateHP();
    }
}

function victory() {
    gameRunning = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px "Determination Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VITÓRIA', canvas.width/2, canvas.height/2 - 40);
    ctx.font = '20px "Determination Mono", monospace';
    ctx.fillText('Você salvou o Pantanal (por enquanto).', canvas.width/2, canvas.height/2);
    ctx.font = '16px "Determination Mono", monospace';
    ctx.fillStyle = '#22c55e'; // Verde grama
    ctx.fillText('Agora, vá tocar um pouco de grama.', canvas.width/2, canvas.height/2 + 40);

    setTimeout(() => {
        stopGame();
    }, 5000);
}

function gameOver() {
    gameRunning = false;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px "Determination Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FIM DE MISSÃO', canvas.width/2, canvas.height/2 - 20);
    ctx.font = '20px "Determination Mono", monospace';
    ctx.fillText('Mantenha a Determinação!', canvas.width/2, canvas.height/2 + 20);
    ctx.font = '16px "Determination Mono", monospace';
    ctx.fillText(`Pontuação Final: ${Math.floor(score / 10)}`, canvas.width/2, canvas.height/2 + 60);
    
    setTimeout(() => {
        stopGame();
    }, 3000);
}

function stopGame() {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    document.getElementById('gameStartUI').classList.remove('hidden');
    canvas.classList.add('hidden');
}

startGameBtn.addEventListener('click', () => {
    document.getElementById('gameStartUI').classList.add('hidden');
    canvas.classList.remove('hidden');
    gameRunning = true;
    score = 0;
    hp = 100;
    maxHp = 100;
    tp = 0;
    level = 1;
    enemiesDefeated = 0;
    isImmune = false;
    immunityTimer = 0;
    frameCount = 0;
    hazards = [];
    playerBullets = [];
    supernovaState = 'none';
    ship = { x: 200, y: 150, width: 30, height: 20, speed: 4 };
    updateHP();
    updateTP();
    spawnHazards();
    updateGame();
    // Força o desbloqueio do áudio com o clique do usuário
    audioUnlocked = true;
    switchMusic(musicLow);
});

document.getElementById('refreshMap').addEventListener('click', () => renderMapState());

initMap();
