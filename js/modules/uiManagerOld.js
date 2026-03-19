export class UIManager {
    constructor() {
        this.currentModal = null;
        this.audioContext = null;
        this.currentMusic = null;
        this.volume = parseFloat(localStorage.getItem('app_volume') || '0.5');
        this.mapStyle = localStorage.getItem('app_map_style') || 'dark';
        this.initAudio();
    }

    async init() {
        this.setupModalHandlers();
        this.setupSettingsHandlers();
        this.setupAudioControls();
        this.loadSettings();
        console.log('UIManager initialized');
    }

    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('Audio context not supported:', error);
        }
    }

    setupModalHandlers() {
        // Close modal on background click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-backdrop')) {
                this.closeModal(this.currentModal);
            }
        });

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentModal) {
                this.closeModal(this.currentModal);
            }
        });
    }

    setupSettingsHandlers() {
        // Map style buttons
        const darkBtn = document.getElementById('mapStyleDark');
        const satBtn = document.getElementById('mapStyleSatellite');
        
        if (darkBtn && satBtn) {
            darkBtn.addEventListener('click', () => this.setMapStyle('dark'));
            satBtn.addEventListener('click', () => this.setMapStyle('satellite'));
        }

        // Volume control
        const volumeRange = document.getElementById('volumeRange');
        const volumeValue = document.getElementById('volumeValue');
        
        if (volumeRange && volumeValue) {
            volumeRange.value = this.volume * 100;
            volumeValue.textContent = Math.floor(this.volume * 100) + '%';
            
            volumeRange.addEventListener('input', (e) => {
                this.setVolume(e.target.value / 100);
            });
        }

        // Reset app button
        const resetBtn = document.getElementById('resetAppBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetApp());
        }
    }

    setupAudioControls() {
        const toggleBtn = document.getElementById('toggleAudio');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleAudio());
        }
    }

    loadSettings() {
        this.setMapStyle(this.mapStyle);
        this.setVolume(this.volume);
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        // Close current modal if any
        if (this.currentModal) {
            this.closeModal(this.currentModal);
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        modal.classList.add('modal-backdrop');
        this.currentModal = modalId;

        // Focus management
        const firstInput = modal.querySelector('input, button, textarea');
        if (firstInput) {
            firstInput.focus();
        }

        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        modal.classList.add('hidden');
        modal.classList.remove('flex', 'modal-backdrop');
        this.currentModal = null;

        // Restore body scroll
        document.body.style.overflow = '';
    }

    setMapStyle(style) {
        this.mapStyle = style;
        localStorage.setItem('app_map_style', style);

        // Update button styles
        const darkBtn = document.getElementById('mapStyleDark');
        const satBtn = document.getElementById('mapStyleSatellite');

        if (darkBtn && satBtn) {
            if (style === 'dark') {
                this.setButtonActive(darkBtn, satBtn);
            } else {
                this.setButtonActive(satBtn, darkBtn);
            }
        }

        // Update map if map manager exists
        if (window.SOSPantanal?.mapManager) {
            window.SOSPantanal.mapManager.setMapStyle(style);
        }
    }

    setButtonActive(activeBtn, inactiveBtn) {
        activeBtn.classList.replace('border-slate-700', 'border-blue-500');
        activeBtn.classList.replace('text-slate-400', 'text-white');
        activeBtn.classList.add('bg-blue-500/10');

        inactiveBtn.classList.replace('border-blue-500', 'border-slate-700');
        inactiveBtn.classList.replace('text-white', 'text-slate-400');
        inactiveBtn.classList.remove('bg-blue-500/10');
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        localStorage.setItem('app_volume', this.volume.toString());

        const volumeRange = document.getElementById('volumeRange');
        const volumeValue = document.getElementById('volumeValue');

        if (volumeRange) volumeRange.value = this.volume * 100;
        if (volumeValue) volumeValue.textContent = Math.floor(this.volume * 100) + '%';

        // Update all audio elements
        document.querySelectorAll('audio').forEach(audio => {
            audio.volume = this.volume;
        });
    }

    toggleAudio() {
        const toggleBtn = document.getElementById('toggleAudio');
        if (!toggleBtn) return;

        if (this.currentMusic) {
            if (this.currentMusic.paused) {
                this.currentMusic.play();
                toggleBtn.textContent = '[ 🔈 ]';
            } else {
                this.currentMusic.pause();
                toggleBtn.textContent = '[ 🔇 ]';
            }
        }
    }

    playMusic(trackId) {
        const track = document.getElementById(trackId);
        if (!track) return;

        if (this.currentMusic && this.currentMusic !== track) {
            this.currentMusic.pause();
            this.currentMusic.currentTime = 0;
        }

        this.currentMusic = track;
        track.volume = this.volume;

        const playAttempt = () => {
            track.play()
                .then(() => this.setAudioStatus('Tocando', '#22c55e'))
                .catch(() => this.setAudioStatus('Clique para Som', '#f59e0b'));
        };

        if (track.readyState >= 2) {
            playAttempt();
        } else {
            track.addEventListener('canplaythrough', playAttempt, { once: true });
            track.load();
        }
    }

    setAudioStatus(text, color) {
        const statusElement = document.getElementById('audioStatus');
        if (statusElement) {
            statusElement.textContent = `Som: ${text}`;
            statusElement.style.color = color || '#64748b';
        }
    }

    resetApp() {
        if (confirm('Tem certeza que deseja apagar todos os seus dados salvos? Isso inclui sua chave NASA e seu nome no chat.')) {
            localStorage.clear();
            location.reload();
        }
    }

    async handleAISubmit(event) {
        event.preventDefault();
        
        const input = document.getElementById('aiInput');
        const chatContainer = document.getElementById('aiChat');
        
        if (!input || !chatContainer) return;

        const query = input.value.trim();
        if (!query) return;

        this.addAIMessage('user', query);
        input.value = '';

        // Show typing indicator
        this.showAITyping();

        // Simulate AI response
        setTimeout(() => {
            this.hideAITyping();
            const response = this.generateAIResponse(query);
            this.addAIMessage('bot', response);
        }, 800 + Math.random() * 1000);
    }

    addAIMessage(role, text) {
        const chatContainer = document.getElementById('aiChat');
        if (!chatContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = role === 'user' 
            ? 'bg-slate-800 border border-slate-700 p-3 rounded-xl ml-8 text-right' 
            : 'bg-blue-600/20 border border-blue-600/30 p-3 rounded-xl mr-8 text-left text-blue-100';
        
        messageDiv.textContent = text;
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        // Reinitialize Lucide icons
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    showAITyping() {
        const chatContainer = document.getElementById('aiChat');
        if (!chatContainer) return;

        const typingDiv = document.createElement('div');
        typingDiv.id = 'ai-thinking';
        typingDiv.className = 'bg-blue-600/10 border border-blue-600/20 p-3 rounded-xl mr-8 text-left text-blue-300 animate-pulse';
        typingDiv.textContent = 'Pensando...';
        
        chatContainer.appendChild(typingDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    hideAITyping() {
        const typingDiv = document.getElementById('ai-thinking');
        if (typingDiv) {
            typingDiv.remove();
        }
    }

    generateAIResponse(query) {
        const responses = {
            'queimada': [
                'As queimadas no Pantanal são monitoradas pelos satélites VIIRS e MODIS da NASA. Eles detectam o calor extremo e nos enviam as coordenadas quase em tempo real.',
                'O monitoramento de queimadas é essencial para as brigadas de incêndio. Satélites passam sobre o Pantanal várias vezes ao dia capturando anomalias térmicas.'
            ],
            'fogo': [
                'Se você avistar fogo real, a primeira regra é: SEGURANÇA. Afaste-se e ligue imediatamente para o 193 (Bombeiros) ou 0800 61 8080 (Prevfogo).',
                'O fogo no Pantanal se espalha rápido devido ao vento e à vegetação seca. Nunca tente combater um incêndio florestal sem treinamento e equipamento.'
            ],
            'mapa': [
                'Este mapa interativo utiliza a biblioteca Leaflet.js. Os círculos vermelhos e laranjas representam focos de calor detectados nas últimas 24 horas pela NASA.',
                'O mapa mostra sua posição (ponto azul) e os focos de incêndio ao redor. Você pode ajustar o raio de busca usando o controle deslizante.'
            ],
            'nasa': [
                'A NASA utiliza o sistema FIRMS para gerenciar dados de incêndios globais. Nós nos conectamos diretamente aos servidores deles para trazer os dados mais recentes para você.',
                'Os dados vêm dos instrumentos VIIRS (no satélite Suomi NPP) e MODIS (nos satélites Terra e Aqua), que são referências mundiais em detecção de fogo.'
            ],
            'ajuda': [
                'Posso te explicar sobre: 1. Como o mapa funciona. 2. De onde vêm os dados da NASA. 3. Dicas de segurança contra fogo. 4. Segredos do mini-game Pantanale.',
                'Diga palavras como "NASA", "Fogo", "Níveis", "Habilidades" ou "Mapa" para eu te dar detalhes específicos.'
            ]
        };

        const lowerQuery = query.toLowerCase();
        
        for (const [key, responseList] of Object.entries(responses)) {
            if (lowerQuery.includes(key)) {
                return responseList[Math.floor(Math.random() * responseList.length)];
            }
        }

        return 'Interessante... Minha base de dados ainda é limitada, mas posso falar muito sobre a NASA, queimadas, o mapa ou as 20 fases do nosso jogo. Tente usar uma dessas palavras!';
    }

    showError(message, type = 'error') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-[9999] transform transition-all duration-300 translate-x-full`;
        
        if (type === 'error') {
            toast.classList.add('bg-red-600', 'text-white');
        } else if (type === 'success') {
            toast.classList.add('bg-green-600', 'text-white');
        } else {
            toast.classList.add('bg-blue-600', 'text-white');
        }
        
        toast.textContent = message;
        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.classList.remove('translate-x-full');
        }, 100);

        // Remove after 5 seconds
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    showLoading(elementId, show = true) {
        const element = document.getElementById(elementId);
        if (!element) return;

        if (show) {
            element.classList.add('opacity-50', 'pointer-events-none');
        } else {
            element.classList.remove('opacity-50', 'pointer-events-none');
        }
    }

    updateElement(elementId, content, isHtml = false) {
        const element = document.getElementById(elementId);
        if (!element) return;

        if (isHtml) {
            element.innerHTML = content;
        } else {
            element.textContent = content;
        }
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    cleanup() {
}

setAudioStatus(text, color) {
const statusElement = document.getElementById('audioStatus');
if (statusElement) {
    statusElement.textContent = `Som: ${text}`;
    statusElement.style.color = color || '#64748b';
}
}

resetApp() {
if (confirm('Tem certeza que deseja apagar todos os seus dados salvos? Isso inclui sua chave NASA e seu nome no chat.')) {
    localStorage.clear();
    location.reload();
}
}

async handleAISubmit(event) {
event.preventDefault();
    
const input = document.getElementById('aiInput');
const chatContainer = document.getElementById('aiChat');
    
if (!input || !chatContainer) return;

const query = input.value.trim();
if (!query) return;

this.addAIMessage('user', query);
input.value = '';

// Show typing indicator
this.showAITyping();

// Simulate AI response
setTimeout(() => {
    this.hideAITyping();
    const response = this.generateAIResponse(query);
    this.addAIMessage('bot', response);
}, 800 + Math.random() * 1000);
}

addAIMessage(role, text) {
const chatContainer = document.getElementById('aiChat');
if (!chatContainer) return;

const messageDiv = document.createElement('div');
messageDiv.className = role === 'user' 
    ? 'bg-slate-800 border border-slate-700 p-3 rounded-xl ml-8 text-right' 
    : 'bg-blue-600/20 border border-blue-600/30 p-3 rounded-xl mr-8 text-left text-blue-100';
    
messageDiv.textContent = text;
chatContainer.appendChild(messageDiv);
chatContainer.scrollTop = chatContainer.scrollHeight;

// Reinitialize Lucide icons
if (window.lucide) {
    window.lucide.createIcons();
}
}

showAITyping() {
const chatContainer = document.getElementById('aiChat');
if (!chatContainer) return;

const typingDiv = document.createElement('div');
typingDiv.id = 'ai-thinking';
typingDiv.className = 'bg-blue-600/10 border border-blue-600/20 p-3 rounded-xl mr-8 text-left text-blue-300 animate-pulse';
typingDiv.textContent = 'Pensando...';
    
chatContainer.appendChild(typingDiv);
chatContainer.scrollTop = chatContainer.scrollHeight;
}

hideAITyping() {
const typingDiv = document.getElementById('ai-thinking');
if (typingDiv) {
    typingDiv.remove();
}
}

generateAIResponse(query) {
const responses = {
    'queimada': [
        'As queimadas no Pantanal são monitoradas pelos satélites VIIRS e MODIS da NASA. Eles detectam o calor extremo e nos enviam as coordenadas quase em tempo real.',
        'O monitoramento de queimadas é essencial para as brigadas de incêndio. Satélites passam sobre o Pantanal várias vezes ao dia capturando anomalias térmicas.'
    ],
    'fogo': [
        'Se você avistar fogo real, a primeira regra é: SEGURANÇA. Afaste-se e ligue imediatamente para o 193 (Bombeiros) ou 0800 61 8080 (Prevfogo).',
        'O fogo no Pantanal se espalha rápido devido ao vento e à vegetação seca. Nunca tente combater um incêndio florestal sem treinamento e equipamento.'
    ],
    'mapa': [
        'Este mapa interativo utiliza a biblioteca Leaflet.js. Os círculos vermelhos e laranjas representam focos de calor detectados nas últimas 24 horas pela NASA.',
        'O mapa mostra sua posição (ponto azul) e os focos de incêndio ao redor. Você pode ajustar o raio de busca usando o controle deslizante.'
    ],
    'nasa': [
        'A NASA utiliza o sistema FIRMS para gerenciar dados de incêndios globais. Nós nos conectamos diretamente aos servidores deles para trazer os dados mais recentes para você.',
        'Os dados vêm dos instrumentos VIIRS (no satélite Suomi NPP) e MODIS (nos satélites Terra e Aqua), que são referências mundiais em detecção de fogo.'
    ],
    'ajuda': [
        'Posso te explicar sobre: 1. Como o mapa funciona. 2. De onde vêm os dados da NASA. 3. Dicas de segurança contra fogo. 4. Segredos do mini-game Pantanale.',
        'Diga palavras como "NASA", "Fogo", "Níveis", "Habilidades" ou "Mapa" para eu te dar detalhes específicos.'
    ]
};

const lowerQuery = query.toLowerCase();
    
for (const [key, responseList] of Object.entries(responses)) {
    if (lowerQuery.includes(key)) {
        return responseList[Math.floor(Math.random() * responseList.length)];
    }
}

return 'Interessante... Minha base de dados ainda é limitada, mas posso falar muito sobre a NASA, queimadas, o mapa ou as 20 fases do nosso jogo. Tente usar uma dessas palavras!';
}

showError(message, type = 'error') {
// Create toast notification
const toast = document.createElement('div');
toast.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-[9999] transform transition-all duration-300 translate-x-full`;
    
if (type === 'error') {
    toast.classList.add('bg-red-600', 'text-white');
} else if (type === 'success') {
    toast.classList.add('bg-green-600', 'text-white');
} else {
    toast.classList.add('bg-blue-600', 'text-white');
}
    
toast.textContent = message;
document.body.appendChild(toast);

// Animate in
setTimeout(() => {
    toast.classList.remove('translate-x-full');
}, 100);

// Remove after 5 seconds
setTimeout(() => {
    toast.classList.add('translate-x-full');
    setTimeout(() => toast.remove(), 300);
}, 5000);
}

showLoading(elementId, show = true) {
const element = document.getElementById(elementId);
if (!element) return;

if (show) {
    element.classList.add('opacity-50', 'pointer-events-none');
} else {
    element.classList.remove('opacity-50', 'pointer-events-none');
}
}

updateElement(elementId, content, isHtml = false) {
const element = document.getElementById(elementId);
if (!element) return;

if (isHtml) {
    element.innerHTML = content;
} else {
    element.textContent = content;
}
}

debounce(func, wait) {
let timeout;
return function executedFunction(...args) {
    const later = () => {
        clearTimeout(timeout);
        func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
};
}

throttle(func, limit) {
let inThrottle;
return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
    }
};
}

cleanup() {
// Close any open modals
if (this.currentModal) {
    this.closeModal(this.currentModal);
}

// Stop music
if (this.currentMusic) {
    this.currentMusic.pause();
    this.currentMusic = null;
}
    
if (this.audioContext) {
    this.audioContext.close();
    this.audioContext = null;
}
}

handleAISubmit(event) {
event.preventDefault();
    
const aiInput = document.getElementById('aiInput');
const aiMessages = document.getElementById('aiMessages');
    
if (!aiInput || !aiMessages) return;

const question = aiInput.value.trim();
if (!question) return;

// Add user message
this.addAIMessage(question, 'user');
aiInput.value = '';

// Show typing indicator
this.showAITyping();

// Generate AI response
setTimeout(() => {
    const response = this.generateAIResponse(question);
    this.addAIMessage(response, 'ai');
}, 1000 + Math.random() * 1000);
}

addAIMessage(message, sender) {
const aiMessages = document.getElementById('aiMessages');
if (!aiMessages) return;

const messageDiv = document.createElement('div');
messageDiv.className = `mb-3 ${sender === 'user' ? 'text-right' : 'text-left'}`;
    
const bubble = document.createElement('div');
bubble.className = `inline-block max-w-xs px-3 py-2 rounded-lg text-sm ${
    sender === 'user' 
        ? 'bg-purple-600 text-white' 
        : 'bg-slate-700 text-slate-200'
}`;
bubble.textContent = message;
    
messageDiv.appendChild(bubble);
aiMessages.appendChild(messageDiv);
aiMessages.scrollTop = aiMessages.scrollHeight;
}

showAITyping() {
const aiMessages = document.getElementById('aiMessages');
if (!aiMessages) return;

const typingDiv = document.createElement('div');
typingDiv.id = 'aiTyping';
typingDiv.className = 'mb-3 text-left';
    
const bubble = document.createElement('div');
bubble.className = 'inline-block px-3 py-2 rounded-lg text-sm bg-slate-700 text-slate-400';
bubble.innerHTML = '<span class="typing-dots">Digitando...</span>';
    
typingDiv.appendChild(bubble);
aiMessages.appendChild(typingDiv);
aiMessages.scrollTop = aiMessages.scrollHeight;
}

hideAITyping() {
const typingDiv = document.getElementById('aiTyping');
if (typingDiv) {
    typingDiv.remove();
}
}
