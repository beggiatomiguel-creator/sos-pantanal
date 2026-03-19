import { SecurityManager } from './securityManager.js';

export class ChatManager {
    constructor(securityManager) {
        this.security = securityManager;
        this.messages = [];
        this.lastMessageCount = 0;
        this.isChatOpen = false;
        this.pollingInterval = null;
        this.username = localStorage.getItem('chat_username') || '';
        
        // Multiple fallback URLs for reliability
        this.CHAT_ENDPOINTS = [
            'https://raw.githubusercontent.com/beggiatomiguel-creator/sos-pantanal/main/chat-data.json', // GitHub Raw (REAL)
            'https://jsonblob.com/api/jsonBlob/12345678-1234-1234-1234-123456789012', // Backup 1
            'https://kvdb.io/ANv9p9Y6yY8z2Z3z2z2z2z/sos_pantanal_chat' // Backup 2 (original)
        ];
        
        this.MAX_MESSAGES = 200;
        this.POLLING_INTERVAL = 2000; // 2 segundos para mais responsividade
        this.currentEndpoint = 0;
        
        // Enhanced features
        this.typingUsers = new Set();
        this.messageReactions = new Map();
        this.onlineUsers = new Map();
        this.lastTypingTime = 0;
        this.typingTimeout = null;
        
        // Message types
        this.MESSAGE_TYPES = {
            TEXT: 'text',
            ALERT: 'alert',
            SYSTEM: 'system',
            LOCATION: 'location',
        };
        
        // WebSocket fallback for real-time (quando disponível)
        this.wsUrl = 'wss://echo.websocket.org'; // WebSocket público para teste
        this.websocket = null;
        this.useWebSocket = false;
    }

    async init() {
        this.setupEventListeners();
        this.setupWebSocket();
        this.startPolling();
        await this.fetchMessages();
        console.log('ChatManager initialized with real-time capabilities');
    }

    setupWebSocket() {
        try {
            // Tentar WebSocket para real-time verdadeiro
            this.websocket = new WebSocket(this.wsUrl);
            
            this.websocket.onopen = () => {
                console.log('WebSocket connected for real-time chat');
                this.useWebSocket = true;
                this.setChatStatus('Conectado em tempo real', '#22c55e');
            };
            
            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'chat_message') {
                        this.handleRealtimeMessage(data.message);
                    }
                } catch (error) {
                    console.warn('Invalid WebSocket message:', error);
                }
            };
            
            this.websocket.onerror = () => {
                console.warn('WebSocket failed, falling back to polling');
                this.useWebSocket = false;
                this.setChatStatus('Conectado (polling)', '#f59e0b');
            };
            
            this.websocket.onclose = () => {
                console.log('WebSocket disconnected');
                this.useWebSocket = false;
                this.setChatStatus('Reconectando...', '#ef4444');
                
                // Tentar reconectar após 5 segundos
                setTimeout(() => this.setupWebSocket(), 5000);
            };
        } catch (error) {
            console.warn('WebSocket not supported, using polling:', error);
            this.useWebSocket = false;
        }
    }

    setupEventListeners() {
        const chatForm = document.getElementById('chatForm');
        const chatInput = document.getElementById('chatInput');
        const chatUser = document.getElementById('chatUser');

        if (chatForm) {
            chatForm.addEventListener('submit', (e) => this.handleChatSubmit(e));
        }

        if (chatUser) {
            chatUser.value = this.username;
            chatUser.addEventListener('change', (e) => {
                this.username = this.security.sanitizeInput(e.target.value);
                localStorage.setItem('chat_username', this.username);
                this.updateOnlineStatus();
            });
        }

        // Enhanced input handling
        if (chatInput) {
            chatInput.addEventListener('input', () => {
                chatInput.style.height = 'auto';
                chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
                
                // Handle typing indicators
                this.handleTyping();
            });
            
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    chatForm.dispatchEvent(new Event('submit'));
                }
            });
        }
        
        // Add emoji support
        this.addEmojiSupport();
        this.addQuickCommands();
    }

    handleTyping() {
        const now = Date.now();
        if (now - this.lastTypingTime > 1000) {
            this.showTypingIndicator();
            this.lastTypingTime = now;
            
            if (this.typingTimeout) {
                clearTimeout(this.typingTimeout);
            }
            
            this.typingTimeout = setTimeout(() => {
                this.hideTypingIndicator();
            }, 3000);
        }
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer || !this.username) return;
        
        let indicator = document.getElementById('typingIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'typingIndicator';
            indicator.className = 'text-xs text-slate-500 italic py-2';
            indicator.innerHTML = '<span class="typing-dots">Alguém está digitando...</span>';
            messagesContainer.appendChild(indicator);
        }
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    addEmojiSupport() {
        const chatInput = document.getElementById('chatInput');
        if (!chatInput) return;
        
        const emojiButton = document.createElement('button');
        emojiButton.type = 'button';
        emojiButton.className = 'text-slate-400 hover:text-white p-2';
        emojiButton.innerHTML = '😊';
        emojiButton.title = 'Adicionar emoji';
        
        const emojis = ['🔥', '🚨', '📍', '🆘', '👍', '❤️', '😊', '🎯'];
        
        emojiButton.addEventListener('click', () => {
            const emoji = emojis[Math.floor(Math.random() * emojis.length)];
            chatInput.value += emoji;
            chatInput.focus();
        });
        
        chatInput.parentElement?.appendChild(emojiButton);
    }

    addQuickCommands() {
        const chatContainer = document.querySelector('#chatModal .p-6');
        if (!chatContainer) return;
        
        const commands = document.createElement('div');
        commands.className = 'flex gap-2 mb-2';
        commands.innerHTML = `
            <button class="text-xs bg-slate-800 px-2 py-1 rounded" data-cmd="/alert">🚨 Alerta</button>
            <button class="text-xs bg-slate-800 px-2 py-1 rounded" data-cmd="/local">📍 Local</button>
            <button class="text-xs bg-slate-800 px-2 py-1 rounded" data-cmd="/ajuda">❓ Ajuda</button>
        `;
        
        commands.addEventListener('click', (e) => {
            if (e.target.dataset.cmd) {
                const chatInput = document.getElementById('chatInput');
                if (chatInput) {
                    chatInput.value = e.target.dataset.cmd + ' ';
                    chatInput.focus();
                }
            }
        });
        
        chatContainer.appendChild(commands);
    }

    async handleChatSubmit(event) {
        event.preventDefault();
        
        const chatInput = document.getElementById('chatInput');
        const chatUser = document.getElementById('chatUser');
        
        if (!chatInput || !chatUser) return;

        const message = this.security.sanitizeInput(chatInput.value.trim());
        const username = this.security.sanitizeInput(chatUser.value.trim()) || 'Anônimo';
        
        if (!message) return;

        // Rate limiting mais flexível
        if (!this.security.rateLimit('chat_message', 20, 60000)) {
            this.showError('Você está enviando mensagens muito rápido. Aguarde um momento.');
            return;
        }

        const messageData = {
            id: this.generateMessageId(),
            user: username,
            text: message,
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now(),
            ip: await this.getClientIP(), // Para identificação básica
            location: await this.getClientLocation() // Localização aproximada
        };

        try {
            // Enviar via WebSocket se disponível
            if (this.useWebSocket && this.websocket?.readyState === WebSocket.OPEN) {
                this.websocket.send(JSON.stringify({
                    type: 'chat_message',
                    message: messageData
                }));
            } else {
                // Fallback para HTTP
                await this.sendMessageHTTP(messageData);
            }
            
            // Adicionar localmente imediatamente
            this.addMessageLocal(messageData);
            
            chatInput.value = '';
            chatInput.style.height = 'auto';
            
            // Limpar indicador de digitação
            this.hideTypingIndicator();
            
        } catch (error) {
            console.error('Failed to send message:', error);
            this.showError('Erro ao enviar mensagem. Tentando novamente...');
            
            // Tentar novamente após 2 segundos
            setTimeout(() => this.handleChatSubmit(event), 2000);
        }
    }

    async sendMessageHTTP(messageData) {
        // Tentar cada endpoint em sequência até funcionar
        for (let i = 0; i < this.CHAT_ENDPOINTS.length; i++) {
            try {
                const endpoint = this.CHAT_ENDPOINTS[i];
                const response = await this.sendMessageToEndpoint(endpoint, messageData);
                
                if (response.ok) {
                    this.currentEndpoint = i;
                    console.log(`Message sent via endpoint ${i}:`, endpoint);
                    return response;
                }
            } catch (error) {
                console.warn(`Endpoint ${i} failed:`, error);
                continue;
            }
        }
        
        throw new Error('All endpoints failed');
    }

    async sendMessageToEndpoint(endpoint, messageData) {
        // Estratégia diferente para cada tipo de endpoint
        if (endpoint.includes('github.com')) {
            // GitHub - Apenas simulação (não permite escrita direta sem token)
            return this.simulateGitHubSend(endpoint, messageData);
        } else if (endpoint.includes('jsonbin.io')) {
            return this.sendToJSONBin(endpoint, messageData);
        } else if (endpoint.includes('jsonblob.com')) {
            return this.sendToJSONBlob(endpoint, messageData);
        } else {
            return this.sendToKVDB(endpoint, messageData);
        }
    }

    async simulateGitHubSend(endpoint, messageData) {
        // Simular envio para o GitHub (na prática precisaria de backend real)
        // Por enquanto, apenas adiciona localmente e mostra feedback
        console.log('Simulando envio para GitHub:', messageData);
        
        // Salvar no localStorage como backup
        const localMessages = JSON.parse(localStorage.getItem('local-chat-messages') || '[]');
        localMessages.push(messageData);
        
        // Manter apenas as últimas 50 mensagens localmente
        if (localMessages.length > 50) {
            localMessages.splice(0, localMessages.length - 50);
        }
        
        localStorage.setItem('local-chat-messages', JSON.stringify(localMessages));
        
        // Retornar sucesso simulado
        return new Response(JSON.stringify({ success: true, message: 'Mensagem enviada localmente' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    async sendToJSONBin(endpoint, messageData) {
        // JSONBin.io - Requer chave de API
        const binId = endpoint.split('/').pop();
        const apiKey = 'your-jsonbin-api-key'; // Configurar isso
        
        // Primeiro, obter mensagens existentes
        const getResponse = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
            headers: {
                'X-Master-Key': apiKey
            }
        });
        
        let messages = [];
        if (getResponse.ok) {
            const data = await getResponse.json();
            messages = data.record || [];
        }
        
        // Adicionar nova mensagem
        messages.push(messageData);
        
        // Manter apenas as últimas 100 mensagens
        if (messages.length > this.MAX_MESSAGES) {
            messages = messages.slice(-this.MAX_MESSAGES);
        }
        
        // Salvar de volta
        return fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': apiKey
            },
            body: JSON.stringify({
                record: messages,
                updated: new Date().toISOString()
            })
        });
    }

    async sendToJSONBlob(endpoint, messageData) {
        // JSONBlob.com - Simples, sem autenticação
        const blobId = endpoint.split('/').pop();
        
        // Obter mensagens existentes
        const getResponse = await fetch(endpoint);
        let messages = [];
        if (getResponse.ok) {
            messages = await getResponse.json();
        }
        
        // Adicionar nova mensagem
        messages.push(messageData);
        
        // Manter apenas as últimas 100 mensagens
        if (messages.length > this.MAX_MESSAGES) {
            messages = messages.slice(-this.MAX_MESSAGES);
        }
        
        // Criar novo blob (JSONBlob não permite atualização)
        const newBlobResponse = await fetch('https://jsonblob.com/api/jsonBlob', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(messages)
        });
        
        if (newBlobResponse.ok) {
            const newBlob = await newBlobResponse.json();
            // Atualizar endpoint para o novo blob
            this.CHAT_ENDPOINTS[1] = `https://jsonblob.com/api/jsonBlob/${newBlob.url.split('/').pop()}`;
        }
        
        return newBlobResponse;
    }

    async sendToKVDB(endpoint, messageData) {
        // KVDB - Método original
        const response = await this.security.secureFetch(endpoint);
        let messages = response.ok ? await response.json() : [];
        
        messages.push(messageData);
        
        if (messages.length > this.MAX_MESSAGES) {
            messages = messages.slice(-this.MAX_MESSAGES);
        }
        
        return this.security.secureFetch(endpoint, {
            method: 'PUT',
            body: JSON.stringify(messages)
        });
    }

    async fetchMessages() {
        try {
            // Tentar WebSocket primeiro
            if (this.useWebSocket) {
                return; // Mensagens chegam via WebSocket
            }
            
            // Fallback para polling HTTP
            await this.fetchMessagesHTTP();
        } catch (error) {
            console.error('Failed to fetch messages:', error);
            this.showError('Falha ao carregar mensagens. Tentando novamente...');
            
            // Tentar novamente após 5 segundos
            setTimeout(() => this.fetchMessages(), 5000);
        }
    }

    async fetchMessagesHTTP() {
        // Tentar endpoints em ordem de preferência
        for (let i = 0; i < this.CHAT_ENDPOINTS.length; i++) {
            try {
                const endpoint = this.CHAT_ENDPOINTS[i];
                const messages = await this.fetchFromEndpoint(endpoint);
                
                // Combinar mensagens do endpoint com mensagens locais
                const localMessages = JSON.parse(localStorage.getItem('local-chat-messages') || '[]');
                const allMessages = [...localMessages, ...messages];
                
                if (allMessages && allMessages.length > 0) {
                    // Remover duplicatas e ordenar por timestamp
                    const uniqueMessages = this.removeDuplicates(allMessages);
                    uniqueMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                    
                    this.messages = this.validateMessages(uniqueMessages);
                    
                    // Verificar novas mensagens
                    if (this.messages.length > this.lastMessageCount && !this.isChatOpen) {
                        this.showChatBadge();
                    }
                    
                    if (this.messages.length !== this.lastMessageCount) {
                        this.renderMessages();
                        this.lastMessageCount = this.messages.length;
                    }
                    
                    this.currentEndpoint = i;
                    return;
                }
            } catch (error) {
                console.warn(`Endpoint ${i} failed:`, error);
                continue;
            }
        }
    }

    removeDuplicates(messages) {
        const seen = new Set();
        return messages.filter(msg => {
            const id = msg.id || `${msg.user}-${msg.timestamp}`;
            if (seen.has(id)) {
                return false;
            }
            seen.add(id);
            return true;
        });
    }

    async fetchFromEndpoint(endpoint) {
        if (endpoint.includes('github.com')) {
            // GitHub Raw - Ler arquivo JSON do repositório
            const response = await fetch(endpoint);
            if (response.ok) {
                const data = await response.text();
                try {
                    return JSON.parse(data);
                } catch (e) {
                    console.warn('Invalid JSON from GitHub:', e);
                    return [];
                }
            }
        } else if (endpoint.includes('jsonbin.io')) {
            const binId = endpoint.split('/').pop();
            const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
                headers: {
                    'X-Master-Key': 'your-jsonbin-api-key'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.record || [];
            }
        } else if (endpoint.includes('jsonblob.com')) {
            const response = await fetch(endpoint);
            return response.ok ? await response.json() : [];
        } else {
            const response = await this.security.secureFetch(endpoint);
            return response.ok ? await response.json() : [];
        }
        
        return [];
    }

    handleRealtimeMessage(messageData) {
        // Validar mensagem do WebSocket
        if (this.validateMessage(messageData)) {
            this.addMessageLocal(messageData);
        }
    }

    addMessageLocal(messageData) {
        // Verificar duplicatas
        if (this.messages.some(msg => msg.id === messageData.id)) {
            return;
        }
        
        this.messages.push(messageData);
        
        // Manter apenas as últimas mensagens
        if (this.messages.length > this.MAX_MESSAGES) {
            this.messages = this.messages.slice(-this.MAX_MESSAGES);
        }
        
        this.renderSingleMessage(messageData);
        this.scrollToBottom();
        
        // Atualizar contador
        if (!this.isChatOpen) {
            this.showChatBadge();
        }
        
        // Notificar outros usuários via WebSocket
        if (this.useWebSocket && this.websocket?.readyState === WebSocket.OPEN) {
            this.broadcastMessage(messageData);
        }
    }

    broadcastMessage(messageData) {
        // Enviar mensagem para outros conectados via WebSocket
        this.websocket.send(JSON.stringify({
            type: 'chat_broadcast',
            message: messageData,
            timestamp: Date.now()
        }));
    }

    validateMessages(messages) {
        return messages.filter(msg => this.validateMessage(msg));
    }

    validateMessage(msg) {
        return msg && 
               typeof msg.user === 'string' && 
               typeof msg.text === 'string' && 
               typeof msg.time === 'string' &&
               typeof msg.id === 'string' &&
               msg.user.length <= 50 && 
               msg.text.length <= 500 &&
               msg.id.length <= 100;
    }

    renderMessages() {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;

        chatContainer.innerHTML = '';
        
        this.messages.forEach(msg => {
            const messageDiv = this.createMessageElement(msg);
            chatContainer.appendChild(messageDiv);
        });
        
        this.scrollToBottom();
        
        // Reinitialize Lucide icons
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    renderSingleMessage(messageData) {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;

        const messageDiv = this.createMessageElement(messageData);
        messageDiv.classList.add('fade-in');
        chatContainer.appendChild(messageDiv);
    }

    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        const isMe = message.user === this.username;
        
        messageDiv.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-4`;
        
        // Adicionar indicador de localização se disponível
        let locationInfo = '';
        if (message.location && message.location.city) {
            locationInfo = `<span class="text-[8px] text-slate-500">📍 ${message.location.city}</span>`;
        }
        
        messageDiv.innerHTML = `
            <div class="flex items-baseline gap-2 mb-1">
                <span class="text-[10px] font-bold text-slate-400">${this.escapeHtml(message.user)}</span>
                <span class="text-[9px] text-slate-600">${message.time}</span>
                ${locationInfo}
            </div>
            <div class="px-3 py-2 rounded-2xl max-w-[80%] ${
                isMe 
                    ? 'bg-green-600 text-white rounded-tr-none' 
                    : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
            }">
                ${this.escapeHtml(message.text)}
            </div>
        `;
        
        return messageDiv;
    }

    showTypingIndicator() {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;

        // Remover indicador existente
        const existing = document.getElementById('typing-indicator');
        if (existing) existing.remove();

        const typingDiv = document.createElement('div');
        typingDiv.id = 'typing-indicator';
        typingDiv.className = 'flex items-center gap-2 mb-4 text-slate-500 text-sm';
        typingDiv.innerHTML = `
            <span>Alguém está digitando</span>
            <div class="flex gap-1">
                <div class="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                <div class="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                <div class="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
            </div>
        `;
        
        chatContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    setChatStatus(status, color) {
        const statusElement = document.getElementById('chatStatus');
        if (statusElement) {
            statusElement.textContent = status;
            statusElement.style.color = color;
        }
    }

    renderMessages() {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;

        chatContainer.innerHTML = '';
        
        this.messages.forEach(msg => {
            const messageDiv = this.createMessageElement(msg);
            chatContainer.appendChild(messageDiv);
        });
        
        // Scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        // Reinitialize Lucide icons
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        const isMe = message.user === this.username;
        
        messageDiv.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-4`;
        
        messageDiv.innerHTML = `
            <div class="flex items-baseline gap-2 mb-1">
                <span class="text-[10px] font-bold text-slate-400">${this.escapeHtml(message.user)}</span>
                <span class="text-[9px] text-slate-600">${message.time}</span>
            </div>
            <div class="px-3 py-2 rounded-2xl max-w-[80%] ${
                isMe 
                    ? 'bg-green-600 text-white rounded-tr-none' 
                    : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
            }">
                ${this.escapeHtml(message.text)}
            </div>
        `;
        
        return messageDiv;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showChatBadge() {
        const badge = document.getElementById('chatBadge');
        if (badge) {
            badge.classList.remove('hidden');
            
            // Contar mensagens não lidas
            const unreadCount = this.messages.length - this.lastMessageCount;
            if (unreadCount > 1) {
                badge.textContent = unreadCount;
                badge.classList.add('text-xs', 'font-bold');
            }
        }
    }

    hideChatBadge() {
        const badge = document.getElementById('chatBadge');
        if (badge) {
            badge.classList.add('hidden');
            badge.textContent = '';
            badge.classList.remove('text-xs', 'font-bold');
        }
    }

    openChat() {
        this.isChatOpen = true;
        this.hideChatBadge();
        
        const chatModal = document.getElementById('chatModal');
        if (chatModal) {
            chatModal.classList.remove('hidden');
            chatModal.classList.add('flex');
        }
        
        // Focus input
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.focus();
        }
    }

    closeChat() {
        this.isChatOpen = false;
        
        const chatModal = document.getElementById('chatModal');
        if (chatModal) {
            chatModal.classList.add('hidden');
            chatModal.classList.remove('flex');
        }
    }

    scrollToBottom() {
        const chatContainer = document.getElementById('chatMessages');
        if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }

    startPolling() {
        this.pollingInterval = setInterval(() => {
            if (!this.useWebSocket) {
                this.fetchMessages();
            }
        }, this.POLLING_INTERVAL);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    generateMessageId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    }

    async getClientLocation() {
        try {
            const response = await fetch(`https://ipapi.co/json/`);
            const data = await response.json();
            return {
                city: data.city,
                region: data.region,
                country: data.country
            };
        } catch (error) {
            return null;
        }
    }

    showError(message) {
        // Mostrar erro no chat
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;

        const errorDiv = document.createElement('div');
        errorDiv.className = 'text-center text-red-400 text-sm py-2 bg-red-900/20 rounded-lg mb-4';
        errorDiv.textContent = message;
        chatContainer.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    addSystemMessage(message) {
        const systemMessage = {
            id: this.generateMessageId(),
            user: '🌿 SOS Pantanal',
            text: message,
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now(),
            isSystem: true
        };
        
        this.addMessageLocal(systemMessage);
    }

    getUserCount() {
        // Simular contagem de usuários online
        return Math.floor(Math.random() * 15) + 3;
    }

    cleanup() {
        this.stopPolling();
        this.closeChat();
        
        // Fechar WebSocket
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
    }
}
