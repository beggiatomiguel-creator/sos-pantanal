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

        playAttempt();
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

    generateAIResponse(question) {
        this.hideAITyping();
        
        const responses = {
            // Greetings
            'oi': ['Olá! Como posso ajudar você hoje?', 'Oi! 😊 Em que posso ser útil?', 'Olá! Estou aqui para ajudar!'],
            'olá': ['Olá! Como posso ajudar você hoje?', 'Oi! 😊 Em que posso ser útil?', 'Olá! Estou aqui para ajudar!'],
            'bom dia': ['Bom dia! ☀️ Como posso ajudar?', 'Bom dia! Espero que tenha um ótimo dia!', 'Bom dia! Em que posso auxiliar?'],
            'boa tarde': ['Boa tarde! 🌤️ Como posso ajudar?', 'Boa tarde! Em que posso ser útil?', 'Boa tarde! Estou à disposição!'],
            'boa noite': ['Boa noite! 🌙 Como posso ajudar?', 'Boa noite! Em que posso auxiliar?', 'Boa noite! Estou aqui para ajudar!'],
            
            // Pantanal specific
            'pantanal': [
                '🌿 O Pantanal é o maior área alagada do mundo, com cerca de 170.000 km². Abriga uma biodiversidade incrível e é vital para o equilíbrio ecológico.',
                '🦒 O Pantanal abriga mais de 1.000 espécies de animais, incluindo onças-pintadas, capivaras, jacarés e centenas de espécies de aves.',
                '🌊 O Pantanal estende-se pelo Brasil, Bolívia e Paraguai, com 85% em território brasileiro, principalmente no Mato Grosso e Mato Grosso do Sul.'
            ],
            'incêndio': [
                '🔥 Incêndios no Pantanal são uma preocupação séria. Eles podem ser causados por ação humana ou natural. Mantenha-se informado e reporte qualquer foco de incêndio imediatamente.',
                '🚨 Se você avistar fogo, mantenha-se afastado e ligue para os bombeiros (193) ou IBAMA (0800 61 8080). Não tente combater incêndios grandes sozinho.',
                '📊 Os dados de incêndios vêm dos satélites VIIRS e MODIS da NASA, que detectam anomalias térmicas em tempo real.'
            ],
            'fogo': [
                '🔥 Se você avistar fogo, mantenha-se afastado e ligue para os bombeiros (193) ou IBAMA (0800 61 8080). Não tente combater incêndios grandes sozinho.',
                '🛡️ Para prevenir incêndios: evite queimadas na seca, não jogue cigarros, mantenha áreas limpas e denuncie atividades suspeitas.',
                '🌡️ O fogo no Pantanal se espalha rápido devido ao vento e à vegetação seca. Nunca tente combater um incêndio florestal sem treinamento.'
            ],
            'nasa': [
                '🛰️ A NASA utiliza o sistema FIRMS para gerenciar dados de incêndios globais. Nós nos conectamos diretamente aos servidores deles para trazer os dados mais recentes para você.',
                '🌍 Os dados vêm dos instrumentos VIIRS (no satélite Suomi NPP) e MODIS (nos satélites Terra e Aqua), que são referências mundiais em detecção de fogo.',
                '📡 A NASA monitora o planeta inteiro 24/7, detectando focos de calor com precisão impressionante.'
            ],
            
            // General knowledge
            'tempo': [
                '🌤️ O tempo no Pantanal varia entre estação seca (abril-setembro) e chuvosa (outubro-março). A temperatura média anual é de 25°C.',
                '☀️ Na estação seca, as temperaturas podem chegar a 40°C, enquanto na chuvosa as chuvas intensas transformam a paisagem.',
                '🌧️ O clima tropical úmido define o ritmo de vida no Pantanal, influenciando migrações de animais e ciclos de vegetação.'
            ],
            'clima': [
                '🌡️ O clima do Pantanal é tropical com estação seca (abril-setembro) e chuvosa (outubro-março). A estação seca é o período de maior risco de incêndios.',
                '🌍 As mudanças climáticas estão afetando os padrões tradicionais do Pantanal, com secas mais intensas e chuvas mais irregulares.',
                '📊 O Pantanal é um dos ecossistemas mais importantes do mundo para regular o clima regional.'
            ],
            'animais': [
                '🦒 O Pantanal abriga mais de 1.000 espécies de animais: onças-pintadas, capivaras, jacarés, araras-azuis, tucanos, cervos, antas e muito mais!',
                '🐊 O jacaré-do-pantanal pode chegar a 3 metros de comprimento e é um dos predadores top do ecossistema.',
                '🦅 A arara-azul é o símbolo do Pantanal, mas está ameaçada de extinção devido ao tráfico de animais.'
            ],
            'biodiversidade': [
                '🌿 O Pantanal é considerado hotspot de biodiversidade mundial, com espécies únicas que não existem em nenhum outro lugar do planeta.',
                '🦒 A diversidade de aves é impressionante: mais de 650 espécies, incluindo tucanos, araras, gaviões e beija-flores.',
                '🐟 Os rios do Pantanal abrigam mais de 400 espécies de peixes, incluindo o dourado, o pintado e o pacu.'
            ],
            
            // Emergency and help
            'ajuda': [
                '🆘 Em emergência: Corpo de Bombeiros 193 | IBAMA/Prevfogo 0800 61 8080 | Polícia Ambiental 0800 644 0404',
                '📋 Posso ajudar com: informações sobre o Pantanal, dados de incêndios, prevenção, emergências, curiosidades sobre a natureza, e muito mais!',
                '🤖 Sou seu assistente virtual para tudo relacionado ao Pantanal e segurança ambiental. Pergunte qualquer coisa!'
            ],
            'emergência': [
                '🚨 LIGUE IMEDIATAMENTE: Bombeiros 193 | IBAMA 0800 61 8080 | Polícia 190',
                '🔥 Em caso de incêndio: afaste-se, não tente combater sozinho, ligue para os bombeiros.',
                '📞 Mantenha esses números sempre à mão: 193 (Bombeiros), 0800 61 8080 (IBAMA), 190 (Polícia).'
            ],
            
            // Technology and science
            'tecnologia': [
                '🛰️ Usamos tecnologia de satélite da NASA para monitoramento em tempo real, com dados atualizados a cada poucas horas.',
                '📱 O aplicativo funciona com geolocalização, mapas interativos, e comunidade em tempo real.',
                '🤖 Sou um assistente de IA projetado para fornecer informações precisas e atualizadas sobre o Pantanal.',
                '🔬 A ciência por trás do monitoramento de incêndios usa sensores térmicos que detectam calor extremo de centenas de quilômetros de altitude.'
            ],
            'satélite': [
                '🛰️ Os satélites VIIRS e MODIS da NASA passam sobre o Pantanal várias vezes ao dia, capturando imagens térmicas.',
                '📡 A tecnologia permite detectar focos de incêndio com apenas 1km² de tamanho, mesmo através de nuvens.',
                '🌍 Esses satélites monitoram o planeta inteiro, fornecendo dados cruciais para combater mudanças climáticas.'
            ],
            
            // Personal and conversational
            'você': [
                '🤖 Sou um assistente de IA especializado em Pantanal e segurança ambiental. Estou sempre aprendendo para ajudar melhor!',
                '🧠 Fui desenvolvido com conhecimento sobre ecologia, tecnologia de monitoramento, e emergências ambientais.',
                '💬 Meu objetivo é fornecer informações rápidas e precisas para proteger o Pantanal e suas comunidades.',
                '🌱 Estou aqui 24/7 para ajudar com qualquer dúvida sobre o maior tesouro natural do Brasil!'
            ],
            'nome': [
                '🤖 Você pode me chamar de Assistente SOS Pantanal! Estou aqui para ajudar com informações sobre incêndios e o ecossistema.',
                '🌿 Sou o guardião virtual do Pantanal, sempre pronto para ajudar com informações importantes.',
                '🔥 Meu propósito é ajudar a proteger o Pantanal através da informação e tecnologia!'
            ],
            
            // Fun and creative
            'curiosidade': [
                '🦒 Sabia que o nome "Pantanal" vem de "pântano", mas na verdade é uma planície alagável, não um pântano?',
                '🌊 O Pantanal tem um ritmo anual de cheias e secas que transforma completamente a paisagem a cada 6 meses!',
                '🦅 A arara-azul pode voar até 56 km/h e viver mais de 60 anos na natureza!',
                '🐊 O jacaré-do-pantanal pode ficar até 2 horas sem respirar debaixo d\'água!',
                '🌅 O Pantanal tem um dos pores do sol mais bonitos do mundo, com cores incríveis refletidas nas águas.'
            ],
            'piada': [
                '🦒 Por que a capivara é tão popular? Porque ela é amiga de todo mundo! 😄',
                '🔥 O que um incêndio disse para outro? "Vamos nos apagar e ir embora!" 🚒',
                '🌿 Por que o Pantanal nunca fica triste? Porque ele sempre tem muita água para "desafogar"! 💧',
                '🦅 O que a arara-azul disse para o tucano? "Você é muito colorido, mas eu sou o símbolo daqui!" 🦜'
            ],
            
            // Educational
            'aprender': [
                '📚 O Pantanal é uma sala de aula viva! Podemos aprender sobre ecologia, conservação, clima, e muito mais.',
                '🎓 Cada espécie do Pantanal tem uma história incrível de adaptação e sobrevivência.',
                '🔬 A ciência nos ensina que proteger o Pantanal é proteger o futuro do planeta.',
                '🌍 O Pantanal mostra como a natureza cria ecossistemas perfeitos quando deixada em equilíbrio.'
            ],
            'escola': [
                '🏫 O Pantanal é o maior laboratório a céu aberto do mundo! Biólogos, ecólogos e cientistas estudam aqui.',
                '📚 Muitas escolas visitam o Pantanal para educação ambiental - é transformador!',
                '🎓 Aprender sobre o Pantanal é aprender sobre a importância da conservação ambiental.',
                '🌱 Cada criança que conhece o Pantanal se torna um guardião da natureza no futuro.'
            ],
            
            // Weather and environment
            'chuva': [
                '🌧️ No Pantanal, as chuvas de outubro a março podem chegar a 1.500mm, transformando tudo num gigantesco espelho d\'água!',
                '💧 A chuva é a vida do Pantanal - recarrega os rios, alimenta os animais e renova a vegetação.',
                '⛈️ As tempestades no Pantanal são espetaculares, com raios que iluminam a planície por quilômetros!',
                '🌈 Depois da chuva, o céu do Pantanal fica com arco-íris duplos frequentemente!'
            ],
            'seca': [
                '☀️ A seca de abril a setembro é crítica - é quando o risco de incêndios aumenta e os animais se concentram nas áreas com água.',
                '🔥 Na seca, o Pantanal pode perder até 80% de sua superfície aquática, criando desafios para a fauna.',
                '🌾 A vegetação seca becomes combustível natural, por isso a prevenção de incêndios é tão importante.',
                '💧 Mesmo na seca, o Pantanal mantém poços e rios que são refúgios vitais para os animais.'
            ],
            
            // Conservation
            'conservação': [
                '🛡️ Conservar o Pantanal é proteger o maior patrimônio natural do Brasil - essencial para o equilíbrio climático global.',
                '🌱 Cada ação de conservação ajuda: não poluir rios, respeitar os animais, denunciar crimes ambientais.',
                '🤝 O turismo sustentável é uma ferramenta poderosa para conservação - gera renda e conscientização!',
                '🔬 A ciência mostra que áreas conservadas no Pantanal são 70% mais resilientes às mudanças climáticas.'
            ],
            'proteger': [
                '🛡️ Proteger o Pantanal é responsabilidade de todos! Pequenas ações fazem grande diferença.',
                '🚨 Denuncie queimadas ilegais, caça, poluição - ligue 0800 61 8080 (IBAMA) ou 193 (Bombeiros).',
                '🌱 Plante árvores nativas, respeite os animais, não descarte lixo na natureza.',
                '📚 Eduque outras pessoas sobre a importância do Pantanal - conhecimento é poder de proteção!'
            ],
            
            // Travel and tourism
            'turismo': [
                '✈️ O turismo sustentável é vital para o Pantanal - gera renda local e promove conservação!',
                '🦒 Os melhores períodos para visitar: seca (julho-setembro) para ver animais concentrados, ou cheia (janeiro-março) para paisagens aquáticas.',
                '🏨 Existem pousadas ecológicas incríveis que oferecem passeios de jeep, cavalos, barcos - sempre com guias locais!',
                '📸 Fotógrafos do mundo todo vêm ao Pantanal - é um dos melhores lugares para wildlife photography!'
            ],
            'viajar': [
                '🗺️ Para chegar: Cuiabá (MT) ou Campo Grande (MS) são as portas de entrada, com voos diários das principais cidades.',
                '🚗 Aluguel de carro é recomendado, mas muitos hotéis oferecem transfer e passeios guiados.',
                '📅 Melhor época: seca (julho-setembro) para observação de fauna, cheia (janeiro-março) para paisagens aquáticas.',
                '🎒 Leve: repelente, protetor solar, binóculos, câmera, roupas leves e calçado confortável.'
            ],
            
            // Food and culture
            'comida': [
                '🐟 Peixes do Pantanal são deliciosos: pintado, dourado, pacu - preparados na brasa ou moqueca!',
                '🥩 Carne de pantaneiro é famosa - gado criado livre na planície, com sabor único.',
                '🌾 Arroz carreteiro, sopa paraguaia, pão de queijo - influências das culturas regionais.',
                '🍺 Tereré e chá mate são tradições - bebidas refrescantes para o calor pantaneiro!'
            ],
            'cultura': [
                '🤝 O pantaneiro é um povo hospitaleiro, com cultura rica em música, contos e tradições.',
                '🎵 Música regional: viola, cateretê, cururu - ritmos que contam histórias da vida no Pantanal.',
                '🏠 Arquitetura local adapta-se às cheias: casas sobre palafitas, erguidas para proteger das águas.',
                '📖 Literatura pantaneira é rica - autores como Manoel de Barros imortalizaram a poesia da região.'
            ],
            
            // Science and research
            'pesquisa': [
                '🔬 O Pantanal é um laboratório natural - cientistas estudam aqui ecologia, climatologia, hidrologia.',
                '📚 Centenas de pesquisas publicadas anualmente sobre biodiversidade, mudanças climáticas, conservação.',
                '🎓 Universidades brasileiras e internacionais mantêm estações de pesquisa no Pantanal.',
                '🌍 Descobertas no Pantanal ajudam a entender ecossistemas úmidos em todo o mundo.'
            ],
            'estudo': [
                '📚 Estudar o Pantanal é entender a complexidade da vida na Terra - cada espécie tem um papel vital.',
                '🔬 A pesquisa científica no Pantanal já salvou espécies da extinção e desenvolvido técnicas de recuperação ambiental.',
                '🎓 Estudantes de biologia, ecologia, geologia, climatologia encontram no Pantanal um campo de estudo infinito.',
                '🌱 Cada estudo publicado sobre o Pantanal contribui para políticas públicas de conservação mais eficazes.'
            ],
            
            // Future and sustainability
            'futuro': [
                '🌍 O futuro do Pantanal depende de ações agora - mudanças climáticas, agricultura sustentável, turismo responsável.',
                '🔬 Ciência e tecnologia são aliadas: monitoramento por satélite, recuperação de áreas degradadas, educação ambiental.',
                '🤝 Cooperação internacional é essencial - o Pantanal é patrimônio da humanidade, não só do Brasil.',
                '🌱 As novas gerações serão os guardiões do Pantanal - educação ambiental é investimento no futuro.'
            ],
            'sustentável': [
                '🌱 Desenvolvimento sustentável no Pantanal significa equilibrar economia e ecologia.',
                '🐟 Pesca sustentável, turismo consciente, pecuária responsável - modelos que já funcionam na região.',
                '🔋 Energia solar, tratamento de água, gestão de resíduos - tecnologias limpas sendo adotadas.',
                '🤝 Comunidades locais são protagonistas - elas conhecem melhor como viver em harmonia com a natureza.'
            ],
            
            // Random fun facts
            'legal': [
                '🤖 Sou legal mesmo! 😄 Estou sempre pronto para ajudar com qualquer informação sobre o Pantanal!',
                '🦒 Sabia que as capivaras são super sociáveis? Fazem amizade com outros animais!',
                '🔥 O monitoramento por satélite é incrível - detecta focos de calor do tamanho de uma sala!',
                '🌊 O Pantanal tem mais espécies de peixes que toda a Europa!',
                '🦅 As araras-azuis formam casais para a vida toda - super romântico! 💙'
            ],
            'interessante': [
                '🧠 O cérebro humano tem 86 bilhões de neurônios - quase o número de estrelas na Via Láctea!',
                '🌍 Se a Terra fosse uma maçã, a atmosfera seria mais fina que a casca!',
                '🦒 As capivaras podem ficar submersas por até 5 minutos - super nadadoras!',
                '🔥 Um incêndio florestal pode criar seu próprio clima - ventos e nuvens de fumaça!',
                '🌊 O Pantanal armazena água equivalente a 5 vezes a Baía de Guanabara!'
            ],
            
            // Philosophy and life
            'vida': [
                '🌅 A vida no Pantanal segue ritmos milenares - cheias que trazem vida, secas que testam a resiliência.',
                '🦒 Cada animal, cada planta tem um propósito no grande ecossistema - tudo interconectado.',
                '🌱 A natureza nos ensina que adaptação é a chave da sobrevivência - lição valiosa para a vida humana.',
                '🤝 Viver em harmonia com a natureza não é apenas possível, é necessário para nosso futuro.'
            ],
            'natureza': [
                '🌿 A natureza é perfeita em seu equilíbrio - cada espécie tem seu papel, cada ciclo sua razão.',
                '🦒 No Pantanal, vemos a natureza em sua máxima expressão - vida abundante, ciclos poderosos.',
                '🌊 A água molda paisagens, sustenta vida, conecta ecossistemas - elemento vital do Pantanal.',
                '🔥 Até o fogo tem seu papel na natureza - renova solo, abre clareiras, estimula nova vida.'
            ]
        };

        const lowerQuestion = question.toLowerCase();
        
        // Check for exact matches first
        for (const [key, responseList] of Object.entries(responses)) {
            if (lowerQuestion.includes(key)) {
                return responseList[Math.floor(Math.random() * responseList.length)];
            }
        }
        
        // Fallback responses for general questions
        const fallbackResponses = [
            '🤖 Essa é uma ótima pergunta! Posso ajudar com informações sobre o Pantanal, incêndios, animais, clima, ou qualquer outro tópico. Sobre o que você gostaria de saber mais?',
            '🌿 Estou aqui para ajudar! Se tiver perguntas sobre o Pantanal, meio ambiente, tecnologia, ou qualquer outro assunto, é só perguntar!',
            '🦒 Sou especialista em Pantanal, mas posso conversar sobre muitos temas! O que você gostaria de discutir?',
            '🔥 Interessante! Posso te dar informações detalhadas sobre incêndios, conservação, biodiversidade, ou outros assuntos. Em que posso ajudar?',
            '🌍 Adoro conversar! Seja sobre ciência, natureza, tecnologia, ou curiosidades, estou pronto para responder. O que você tem em mente?',
            '📚 Conhecimento é poder! Estou aqui para compartilhar informações sobre o Pantanal e muito mais. Pergunte qualquer coisa!',
            '🤔 Boa pergunta! Vou pesquisar e te dar a melhor resposta possível. Enquanto isso, quer saber algo sobre o Pantanal?',
            '🎯 Estou aqui para ajudar! Seja informação séria sobre incêndios ou curiosidades sobre a natureza, estou à disposição!',
            '🌟 Excelente questionamento! Posso te ajudar com dados científicos, dicas práticas, ou informações gerais. Sobre o que você quer saber?',
            '🚀 Vamos explorar esse conhecimento juntos! Seja sobre ecologia, tecnologia, ou qualquer outro tema, estou pronto!'
        ];
        
        return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
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
}
