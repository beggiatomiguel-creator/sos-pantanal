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

    // Calcula Bounding Box dinâmica (aproximadamente 1 grau = 111km)
    // Para garantir os 500km, pegamos uma margem de segurança de ~5 graus
    const margin = (currentRadius / 111) + 0.5;
    const minLat = (userLocation.lat - margin).toFixed(2);
    const maxLat = (userLocation.lat + margin).toFixed(2);
    const minLon = (userLocation.lng - margin).toFixed(2);
    const maxLon = (userLocation.lng + margin).toFixed(2);
    
    const dynamicArea = `${minLon},${minLat},${maxLon},${maxLat}`;
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${API_KEY.trim()}/VIIRS_SNPP_NRT/${dynamicArea}/1`;
    
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
document.getElementById('closeModal').addEventListener('click', () => document.getElementById('reportModal').classList.replace('flex', 'hidden'));

const reportForm = document.getElementById('reportForm');
if (reportForm) {
    reportForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Criar um marcador visual temporário para o reporte do usuário
        const userReportIcon = L.divIcon({
            html: `<div class="w-8 h-8 rounded-full flex items-center justify-center border-2 border-white animate-bounce shadow-xl bg-blue-600"><i data-lucide="megaphone" class="w-5 h-5 text-white"></i></div>`,
            className: '', iconSize: [32, 32]
        });
        
        const marker = L.marker([userLocation.lat, userLocation.lng], { icon: userReportIcon })
            .bindPopup(`<b>Seu Reporte</b><br>Enviado agora<br>Status: Em análise`)
            .addTo(map);
        
        fireMarkers.push(marker); // Adiciona à lista para ser limpo no próximo refresh se necessário

        alert('Obrigado! Seu relatório foi enviado e um marcador temporário foi adicionado ao mapa para você.');
        document.getElementById('reportModal').classList.replace('flex', 'hidden');
        reportForm.reset();
        lucide.createIcons();
    });
}

// IA Assistant Logic
const aiBtn = document.getElementById('aiBtn');
const aiModal = document.getElementById('aiModal');
const closeAi = document.getElementById('closeAi');
const aiForm = document.getElementById('aiForm');
const aiInput = document.getElementById('aiInput');
const aiChat = document.getElementById('aiChat');

const aiKnowledge = {
    "queimada": {
        responses: [
            "As queimadas no Pantanal são monitoradas pelos satélites VIIRS e MODIS da NASA. Eles detectam o calor extremo e nos enviam as coordenadas quase em tempo real.",
            "O monitoramento de queimadas é essencial para as brigadas de incêndio. Satélites passam sobre o Pantanal várias vezes ao dia capturando anomalias térmicas."
        ]
    },
    "fogo": {
        responses: [
            "Se você avistar fogo real, a primeira regra é: SEGURANÇA. Afaste-se e ligue imediatamente para o 193 (Bombeiros) ou 0800 61 8080 (Prevfogo).",
            "O fogo no Pantanal se espalha rápido devido ao vento e à vegetação seca. Nunca tente combater um incêndio florestal sem treinamento e equipamento."
        ]
    },
    "mapa": {
        responses: [
            "Este mapa interativo utiliza a biblioteca Leaflet.js. Os círculos vermelhos e laranjas representam focos de calor detectados nas últimas 24 horas pela NASA.",
            "O mapa mostra sua posição (ponto azul) e os focos de incêndio ao redor. Você pode ajustar o raio de busca usando o controle deslizante."
        ]
    },
    "nasa": {
        responses: [
            "A NASA utiliza o sistema FIRMS para gerenciar dados de incêndios globais. Nós nos conectamos diretamente aos servidores deles para trazer os dados mais recentes para você.",
            "Os dados vêm dos instrumentos VIIRS (no satélite Suomi NPP) e MODIS (nos satélites Terra e Aqua), que são referências mundiais em detecção de fogo."
        ]
    },
    "raio": {
        responses: [
            "O raio de visão pode ser ajustado entre 10km e 500km. Isso ajuda você a focar no que está acontecendo bem perto de você ou ver a situação geral do estado.",
            "Ao aumentar o raio para 500km, o sistema faz uma busca em uma área muito maior da América do Sul para encontrar focos de calor."
        ]
    },
    "tp": {
        responses: [
            "Tension Points (TP) são a alma do sistema de combate no Pantanale. Você os ganha ao 'pastar' (graze) perto de perigos. Quanto mais perto, mais rápido o TP sobe!",
            "TP é sua munição. Use-o com sabedoria para disparar tiros normais ou economize para um Super Shot poderoso!"
        ]
    },
    "supernova": {
        responses: [
            "A Supernova é um ataque crítico. Azul significa que a nave deve ficar estática. Laranja significa que deve estar em movimento constante. Sobreviver sem dano te dá TP máximo!",
            "Durante a Supernova, o espaço se distorce. É o teste definitivo de reflexos. Lembre-se: Azul = Estátua, Laranja = Motorista."
        ]
    },
    "pantanale": {
        responses: [
            "Pantanale é uma homenagem aos jogos estilo Undertale, mas com o objetivo de educar sobre a preservação do nosso bioma.",
            "No Pantanale, você controla uma nave de monitoramento que evolui conforme você ganha experiência protegendo a região."
        ]
    },
    "ajuda": {
        responses: [
            "Posso te explicar sobre: 1. Como o mapa funciona. 2. De onde vêm os dados da NASA. 3. Dicas de segurança contra fogo. 4. Segredos do mini-game Pantanale.",
            "Diga palavras como 'NASA', 'Fogo', 'Níveis', 'Habilidades' ou 'Mapa' para eu te dar detalhes específicos."
        ]
    },
    "niveis": {
        responses: [
            "O sistema de 20 níveis recompensa sua persistência. A cada nível, sua nave ganha novos atributos como velocidade, HP ou habilidades de tiro.",
            "No LV 5 você ganha Tiro Duplo, no LV 13 Tiro Triplo, e no LV 20 você atinge a Forma Final com Asas de Luz!"
        ]
    },
    "habilidades": {
        responses: [
            "Suas habilidades evoluem: Tiro Duplo (LV 5), Super Charge (LV 10), Tiro Triplo (LV 13), Regeneração (LV 15) e Mega Shot (LV 19).",
            "Além das armas, você ganha velocidade e resistência. O TP Efficiency no LV 17 faz seus ataques especiais ficarem muito mais baratos."
        ]
    },
    "quem": {
        responses: [
            "Fui criado para ser seu guia no SOS Pantanal. Sou uma inteligência artificial focada em dados ambientais e conscientização.",
            "Eu sou o cérebro por trás do monitoramento. Analiso os dados da NASA e ajudo você a entender o que está acontecendo no bioma."
        ]
    },
    "oi": { responses: ["Olá! Estou pronto para responder qualquer dúvida sobre o Pantanal ou o sistema. O que deseja saber?", "Oi! Em que posso ajudar na sua exploração hoje?"] },
    "ola": { responses: ["Olá! Estou pronto para responder qualquer dúvida sobre o Pantanal ou o sistema. O que deseja saber?", "Oi! Em que posso ajudar na sua exploração hoje?"] }
};

aiBtn.addEventListener('click', () => aiModal.classList.replace('hidden', 'flex'));
closeAi.addEventListener('click', () => aiModal.classList.replace('flex', 'hidden'));

aiForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = aiInput.value.toLowerCase().trim();
    if (!query) return;

    addChatMessage('user', aiInput.value);
    aiInput.value = '';

    // Efeito de "Pensando"
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'bg-blue-600/10 border border-blue-600/20 p-3 rounded-xl mr-8 text-left text-blue-300 animate-pulse';
    thinkingDiv.innerText = 'Pensando...';
    thinkingDiv.id = 'ai-thinking';
    aiChat.appendChild(thinkingDiv);
    aiChat.scrollTop = aiChat.scrollHeight;

    setTimeout(() => {
        const thinking = document.getElementById('ai-thinking');
        if (thinking) thinking.remove();

        let bestMatch = null;
        let maxWeight = 0;

        for (let key in aiKnowledge) {
            if (query.includes(key)) {
                // Sistema de peso simples: chaves maiores valem mais
                if (key.length > maxWeight) {
                    maxWeight = key.length;
                    const responses = aiKnowledge[key].responses;
                    bestMatch = responses[Math.floor(Math.random() * responses.length)];
                }
            }
        }

        let response = bestMatch || "Interessante... Minha base de dados ainda é limitada, mas posso falar muito sobre a NASA, queimadas, o mapa ou as 20 fases do nosso jogo. Tente usar uma dessas palavras!";
        
        // Simular uma resposta mais "inteligente" com variações
        if (!bestMatch && query.length > 20) {
            response = "Essa é uma pergunta complexa. Como assistente do SOS Pantanal, meu foco é em monitoramento e segurança. Posso te ajudar com dados técnicos da NASA ou dicas do mini-game?";
        }

        addChatMessage('bot', response);
    }, 800 + Math.random() * 1000); // Tempo de resposta variável para parecer humano
});

function addChatMessage(role, text) {
    const msg = document.createElement('div');
    msg.className = role === 'user' 
        ? 'bg-slate-800 border border-slate-700 p-3 rounded-xl ml-8 text-right' 
        : 'bg-blue-600/20 border border-blue-600/30 p-3 rounded-xl mr-8 text-left text-blue-100';
    msg.innerText = text;
    aiChat.appendChild(msg);
    aiChat.scrollTop = aiChat.scrollHeight;
    lucide.createIcons();
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

// Ship Status Effects
let shotDisabledTimer = 0;
let doubleDamageTimer = 0;

// Final Boss State
let bossActive = false;
let boss = {
    x: 500,
    y: 150,
    hp: 1000,
    maxHp: 1000,
    size: 100,
    state: 'idle', // 'idle', 'attacking', 'resting'
    timer: 0,
    dialogue: "",
    dialogueTimer: 0
};
const bossDialogues = [
    "Você acha que pode apagar o fogo do destino?",
    "O Pantanal é apenas o começo da cinza.",
    "Sinta o calor de mil galáxias!",
    "Sua determinação é... irritante.",
    "EU SOU A ENTROPIA QUE QUEIMA O MUNDO!"
];

// Supernova States
let supernovaState = 'none'; // 'none', 'warning', 'active'
let supernovaType = 'blue'; // 'blue' (stay still), 'orange' (keep moving)
let supernovaTimer = 0;
let supernovaDamaged = false; // Rastreia se tomou dano durante a supernova

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
    if (shotDisabledTimer > 0) return;
    const cost = (level >= 17) ? 7 : 10;
    if (tp >= cost) {
        tp -= cost;
        updateTP();
        const size = (level >= 19) ? 35 : 20;
        playerBullets.push({ x: ship.x + 15, y: ship.y, vx: 15, vy: 0, size: size, isSuper: true });
    }
}

function shoot() {
    if (shotDisabledTimer > 0) return;
    if (tp >= 1) {
        tp -= 1;
        updateTP();
        
        const bulletSize = (level >= 4) ? 7 : 5;
        const bulletSpeed = (level >= 9) ? 15 : 10;
        
        // Tiro Simples (LV 1-4)
        if (level < 5) {
            playerBullets.push({ x: ship.x + 15, y: ship.y, vx: bulletSpeed, vy: 0, size: bulletSize, isSuper: false });
        } 
        // Tiro Duplo (LV 5-12)
        else if (level < 13) {
            playerBullets.push({ x: ship.x + 15, y: ship.y - 5, vx: bulletSpeed, vy: 0, size: bulletSize, isSuper: false });
            playerBullets.push({ x: ship.x + 15, y: ship.y + 5, vx: bulletSpeed, vy: 0, size: bulletSize, isSuper: false });
        }
        // Tiro Triplo (LV 13+)
        else {
            playerBullets.push({ x: ship.x + 15, y: ship.y - 8, vx: bulletSpeed, vy: 0, size: bulletSize, isSuper: false });
            playerBullets.push({ x: ship.x + 15, y: ship.y, vx: bulletSpeed, vy: 0, size: bulletSize, isSuper: false });
            playerBullets.push({ x: ship.x + 15, y: ship.y + 8, vx: bulletSpeed, vy: 0, size: bulletSize, isSuper: false });
        }
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

function startBossFight() {
    bossActive = true;
    hazards = []; // Limpa inimigos menores
    boss.hp = 1000;
    boss.x = 500; // Começa fora da tela e entra
    boss.y = 150;
    boss.timer = 0;
    boss.phase = 1;
    boss.dialogue = "Então você chegou ao fim da linha...";
    boss.dialogueTimer = 180;
    switchMusic(musicHigh); // Música épica
}

function spawnHazards() {
    if (!gameRunning) return;
    
    frameCount++;
    
    // Inimigos normais só aparecem se o Boss não estiver ativo
    if (!bossActive) {
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
    if (supernovaState !== 'none' || bossOnScreen || bossActive) {
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
        const chargeSpeed = (level >= 10) ? 1.5 : 1;
        chargeTime += chargeSpeed;
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
            supernovaDamaged = false; // Resetar rastreador de dano
        }
    } else if (supernovaState === 'active') {
        supernovaTimer--;
        ctx.fillStyle = supernovaType === 'blue' ? 'rgba(0, 245, 255, 0.5)' : 'rgba(255, 140, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Damage logic
        if (!isImmune) {
            if (supernovaType === 'blue' && isMoving) {
                hp -= 0.6; // Dano reduzido
                supernovaDamaged = true;
                updateHP();
            } else if (supernovaType === 'orange' && !isMoving) {
                hp -= 0.6; // Dano reduzido
                supernovaDamaged = true;
                updateHP();
            }
        }

        if (hp <= 0) gameOver();
        
        if (supernovaTimer <= 0) {
            // Se sobreviveu sem tomar dano, ganha TP máximo!
            if (!supernovaDamaged) {
                tp = maxTp;
                updateTP();
                
                // Feedback Visual
                ctx.fillStyle = '#ffeb3b';
                ctx.font = 'bold 30px "Determination Mono", monospace';
                ctx.textAlign = 'center';
                ctx.fillText('TP MAX!!', canvas.width/2, canvas.height/2);
            }
            supernovaState = 'none';
        }
    }

    // Handle Immunity
    if (isImmune) {
        immunityTimer--;
        if (immunityTimer <= 0) {
            isImmune = false;
        }
    }

    // Reduzir timers de debuff
    if (shotDisabledTimer > 0) shotDisabledTimer--;
    if (doubleDamageTimer > 0) doubleDamageTimer--;

    // Boss Logic
    if (bossActive) {
        updateBoss();
    }

    // LV 15: Regeneração (1 HP a cada 2 segundos / 120 frames)
    if (level >= 15 && frameCount % 120 === 0 && hp < maxHp) {
        hp = Math.min(maxHp, hp + 1);
        updateHP();
    }

    // Feedback visual de Debuff na Nave
    if (shotDisabledTimer > 0 || doubleDamageTimer > 0) {
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ship.x - 20, ship.y - 20);
        ctx.lineTo(ship.x + 20, ship.y + 20);
        ctx.moveTo(ship.x + 20, ship.y - 20);
        ctx.lineTo(ship.x - 20, ship.y + 20);
        ctx.stroke();
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
        if (h.type === 'asteroid' || h.type === 'heal' || h.type === 'debuff') {
            ctx.fillStyle = h.color;
            ctx.beginPath();
            ctx.arc(h.x, h.y, h.size/2, 0, Math.PI * 2);
            ctx.fill();
            
            if (h.type === 'heal') {
                ctx.strokeStyle = '#fff';
                ctx.stroke();
            } else if (h.type === 'debuff') {
                // Aura Azul para a bola vermelha
                ctx.strokeStyle = '#00f5ff';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(h.x, h.y, h.size/2 + 5, 0, Math.PI * 2);
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
            } else if (h.type === 'debuff') {
                // Efeito do Debuff: Sem tiro por 3s + Dano dobrado por 5s
                shotDisabledTimer = 180; // 3 segundos a 60fps
                doubleDamageTimer = 300; // 5 segundos a 60fps
                hazards.splice(i, 1);
                
                // Feedback visual imediato
                ctx.fillStyle = '#ff0000';
                ctx.font = 'bold 20px "Determination Mono", monospace';
                ctx.textAlign = 'center';
                ctx.fillText('ARMA DESATIVADA! DANO DOBRADO!', canvas.width/2, canvas.height/2 + 30);
            } else if (!isImmune) {
                let damage = (h.type === 'galaxy' ? 15 : 5);
                if (doubleDamageTimer > 0) damage *= 2; // Dano dobrado se tiver o debuff
                
                hp -= damage;
                if (supernovaState === 'active') supernovaDamaged = true;
                hazards.splice(i, 1);
                isImmune = true;
                immunityTimer = 90; // 1.5 segundos de imunidade
                updateHP();
                if (hp <= 0) gameOver();
            }
        }

        if (h.x < -100 || h.x > 500 || h.y < -100 || h.y > 400) hazards.splice(i, 1);
    });

    // Colisão das Balas com o Boss Final
    if (bossActive) {
        playerBullets.forEach((pb, pbi) => {
            const dx = pb.x - boss.x;
            const dy = pb.y - boss.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < (boss.size/2 + pb.size)) {
                if (!pb.isSuper) playerBullets.splice(pbi, 1);
                
                // Só toma dano se estiver descansando
                if (boss.state === 'resting') {
                    const damage = pb.isSuper ? 15 : 3;
                    boss.hp -= damage;
                    
                    if (boss.hp <= 0) {
                        bossActive = false;
                        victory();
                    }
                } else {
                    // Feedback visual de invulnerabilidade (opcional)
                    ctx.strokeStyle = '#fff';
                    ctx.beginPath();
                    ctx.arc(boss.x, boss.y, boss.size/2 + 10, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
        });
    }

    score++;
    document.getElementById('highScore').innerText = Math.floor(score / 10);
    animationId = requestAnimationFrame(updateGame);
}

function drawShip() {
    if (!isImmune || frameCount % 10 < 5) {
        ctx.save();
        ctx.translate(ship.x, ship.y);

        // Cor base da nave muda com o nível
        let baseColor = '#00f5ff'; // Ciano inicial
        if (level >= 5) baseColor = '#00ff88'; // Verde-água
        if (level >= 10) baseColor = '#ffeb3b'; // Dourado
        if (level >= 15) baseColor = '#f0f';    // Roxo
        if (level >= 20) baseColor = '#fff';    // Branco Divino

        ctx.fillStyle = baseColor;
        ctx.shadowBlur = (level >= 10) ? 10 : 0;
        ctx.shadowColor = baseColor;

        // Desenho Principal da Nave (Evolui com o nível)
        ctx.beginPath();
        if (level < 5) {
            // Forma básica (Triângulo)
            ctx.moveTo(15, 0);
            ctx.lineTo(-15, -10);
            ctx.lineTo(-10, 0);
            ctx.lineTo(-15, 10);
        } else if (level < 10) {
            // Forma com Asas Pequenas
            ctx.moveTo(18, 0);
            ctx.lineTo(-10, -8);
            ctx.lineTo(-18, -15);
            ctx.lineTo(-12, 0);
            ctx.lineTo(-18, 15);
            ctx.lineTo(-10, 8);
        } else if (level < 15) {
            // Forma Elegante (Estilo Delta)
            ctx.moveTo(20, 0);
            ctx.lineTo(-5, -10);
            ctx.lineTo(-20, -20);
            ctx.lineTo(-10, -5);
            ctx.lineTo(-10, 5);
            ctx.lineTo(-20, 20);
            ctx.lineTo(-5, 10);
        } else {
            // Forma Avançada (Cruz/Estrela)
            ctx.moveTo(25, 0);
            ctx.lineTo(5, -10);
            ctx.lineTo(-5, -25);
            ctx.lineTo(-10, -10);
            ctx.lineTo(-25, 0);
            ctx.lineTo(-10, 10);
            ctx.lineTo(-5, 25);
            ctx.lineTo(5, 10);
        }
        ctx.closePath();
        ctx.fill();

        // Detalhes Adicionais por Nível
        
        // LV 2+: Propulsor Traseiro
        if (level >= 2) {
            ctx.fillStyle = (frameCount % 4 < 2) ? '#ff4400' : '#ffcc00';
            ctx.fillRect(-15, -3, 5, 6);
        }

        // LV 4+: Cockpit
        if (level >= 4) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(2, 0, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // LV 7+: Listras de Corrida
        if (level >= 7) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-5, -5);
            ctx.lineTo(5, -5);
            ctx.moveTo(-5, 5);
            ctx.lineTo(5, 5);
            ctx.stroke();
        }

        // LV 11+: Escudo de Partículas (Aura)
        if (level >= 11) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + Math.sin(frameCount * 0.1) * 0.2})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI * 2);
            ctx.stroke();
        }

        // LV 14+: Canhões Laterais
        if (level >= 14) {
            ctx.fillStyle = '#888';
            ctx.fillRect(0, -15, 8, 4);
            ctx.fillRect(0, 11, 8, 4);
        }

        // LV 17+: Propulsores de Asa
        if (level >= 17) {
            ctx.fillStyle = '#00f5ff';
            ctx.beginPath();
            ctx.arc(-10, -15, 3, 0, Math.PI * 2);
            ctx.arc(-10, 15, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // LV 20: FORMA FINAL (Asas de Luz)
        if (level >= 20) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-10, 0);
            ctx.lineTo(-40, -40);
            ctx.moveTo(-10, 0);
            ctx.lineTo(-40, 40);
            ctx.stroke();
            
            // Halo de Luz
            ctx.beginPath();
            ctx.arc(0, 0, 40, frameCount*0.1, frameCount*0.1 + 1);
            ctx.stroke();
        }

        ctx.restore();
    }
}

function updateBoss() {
    // Entrada do Boss
    if (boss.x > 300) {
        boss.x -= 2;
        boss.state = 'idle';
    } else {
        // Movimento de flutuação (Senoide)
        boss.y = 150 + Math.sin(frameCount * 0.05) * 50;
        
        // Máquina de Estados do Boss
        boss.timer++;
        
        if (boss.state === 'idle') {
            if (boss.timer > 60) {
                boss.state = 'attacking';
                boss.timer = 0;
                boss.dialogue = "PREPARE-SE PARA A QUEIMADA!";
                boss.dialogueTimer = 60;
            }
        } else if (boss.state === 'attacking') {
            if (boss.timer % 60 === 0) {
                spawnBossAttack();
            }
            if (boss.timer > 400) { // Ataca por ~7 segundos
                boss.state = 'resting';
                boss.timer = 0;
                boss.dialogue = "*Cansado...*";
                boss.dialogueTimer = 120;
            }
        } else if (boss.state === 'resting') {
            if (boss.timer > 180) { // Descansa por 3 segundos
                boss.state = 'idle';
                boss.timer = 0;
            }
        }

        // Diálogos Aleatórios (apenas se não estiver descansando)
        if (boss.dialogueTimer > 0) {
            boss.dialogueTimer--;
        } else if (Math.random() < 0.005 && boss.state !== 'resting') {
            boss.dialogue = bossDialogues[Math.floor(Math.random() * bossDialogues.length)];
            boss.dialogueTimer = 120;
        }
    }

    drawBoss();
}

function drawBoss() {
    // Corpo do Boss (Uma galáxia gigante e sombria)
    ctx.save();
    ctx.translate(boss.x, boss.y);
    
    // Efeito visual de vulnerabilidade (piscar quando descansando)
    if (boss.state === 'resting') {
        ctx.globalAlpha = 0.5 + Math.sin(frameCount * 0.2) * 0.3;
    }

    ctx.rotate(frameCount * 0.02);
    
    // Aura externa (Muda de cor conforme o estado)
    const auraColor = boss.state === 'resting' ? 'rgba(0, 255, 255, 0.2)' : 'rgba(255, 0, 0, 0.2)';
    const aura = ctx.createRadialGradient(0, 0, 0, 0, 0, boss.size);
    aura.addColorStop(0, auraColor);
    aura.addColorStop(0.5, 'rgba(128, 0, 128, 0.1)');
    aura.addColorStop(1, 'transparent');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, boss.size, 0, Math.PI * 2);
    ctx.fill();

    // Núcleo
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, boss.size/2);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.2, boss.state === 'resting' ? '#00f5ff' : '#ff0000');
    grad.addColorStop(0.5, '#4b0082');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    for(let i=0; i<Math.PI*2; i+=0.1) {
        let r = (boss.size/2) * (1 + Math.sin(i * 5 + frameCount * 0.1) * 0.2);
        ctx.lineTo(Math.cos(i)*r, Math.sin(i)*r);
    }
    ctx.fill();
    ctx.restore();

    // Barra de Vida do Boss
    const barWidth = 300;
    const barHeight = 10;
    const barX = (canvas.width - barWidth) / 2;
    const barY = 20;
    
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    const hpPercent = boss.hp / boss.maxHp;
    ctx.fillStyle = boss.state === 'resting' ? '#00f5ff' : '#ff0000';
    ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "Determination Mono", monospace';
    ctx.textAlign = 'center';
    const statusText = boss.state === 'resting' ? "ENTROPIA VULNERÁVEL" : "ENTROPIA SUPREMA (INVULNERÁVEL)";
    ctx.fillText(statusText, canvas.width/2, barY - 5);

    // Balão de Diálogo (Estilo Undertale)
    if (boss.dialogueTimer > 0) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(boss.x - 120, boss.y - 100, 150, 50);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(boss.x - 120, boss.y - 100, 150, 50);
        
        ctx.fillStyle = '#000';
        ctx.font = '10px "Determination Mono", monospace';
        ctx.textAlign = 'left';
        // Quebra de linha simples
        const words = boss.dialogue.split(' ');
        let line = '';
        let y = boss.y - 85;
        for(let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            if (testLine.length > 25) {
                ctx.fillText(line, boss.x - 115, y);
                line = words[n] + ' ';
                y += 12;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, boss.x - 115, y);
    }
}

function spawnBossAttack() {
    const pattern = Math.floor(Math.random() * 4);
    
    if (pattern === 0) {
        // Chuva de Meteoros Vermelhos
        for(let i=0; i<5; i++) {
            hazards.push({
                x: boss.x,
                y: boss.y,
                vx: - (3 + Math.random() * 4),
                vy: -2 + Math.random() * 4,
                size: 20,
                type: 'asteroid',
                color: '#ff4400'
            });
        }
    } else if (pattern === 1) {
        // Disparo de Anéis
        for(let i=0; i<Math.PI*2; i+=Math.PI/4) {
            hazards.push({
                x: boss.x,
                y: boss.y,
                vx: Math.cos(i) * 3,
                vy: Math.sin(i) * 3,
                size: 25,
                type: 'asteroid',
                color: '#4b0082'
            });
        }
    } else if (pattern === 2) {
        // BOLA VERMELHA COM AURA AZUL (Desativa tiro + Dano Dobrado)
        hazards.push({
            x: boss.x,
            y: boss.y,
            vx: -5,
            vy: (ship.y - boss.y) / 50, // Persegue levemente
            size: 30,
            type: 'debuff',
            color: '#ff0000'
        });
    } else {
        // Supernova Rápida (Sempre Azul ou Laranja)
        supernovaState = 'warning';
        supernovaType = Math.random() > 0.5 ? 'blue' : 'orange';
        supernovaTimer = 60;
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
        if (level >= 20) {
            if (!bossActive) {
                startBossFight();
            }
            return;
        }
        level++;
        enemiesDefeated = 0;
        
        // Atributos base
        maxHp = Math.floor(maxHp * 1.05);
        hp = maxHp;
        
        // Aplicação de Habilidades Específicas por Nível
        applyLevelUpBonus();
        
        updateHP();
        
        // Feedback visual de Level Up
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 30px "Determination Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`LEVEL UP! LV ${level}`, canvas.width/2, canvas.height/2);
    }
}

function applyLevelUpBonus() {
    switch(level) {
        case 2: ship.speed += 0.5; break;
        case 3: maxHp += 20; hp = maxHp; break;
        case 6: ship.speed += 0.5; break;
        case 8: maxHp += 20; hp = maxHp; break;
        case 12: maxHp += 30; hp = maxHp; break;
        case 16: ship.speed += 1; break;
        case 18: immunityTimer = 120; break; // Bônus temporário no level up
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
    bossActive = false;
    shotDisabledTimer = 0;
    doubleDamageTimer = 0;
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
