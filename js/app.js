// Main application entry point
import { MapManager } from './modules/mapManager.js';
import { GameManager } from './modules/gameManager.js';
import { ChatManager } from './modules/chatManager.js';
import { UIManager } from './modules/uiManager.js';
import { SecurityManager } from './modules/securityManager.js';

// Global app state
const app = {
    mapManager: null,
    gameManager: null,
    chatManager: null,
    uiManager: null,
    securityManager: null,
    isInitialized: false
};

// Initialize application
async function initApp() {
    try {
        // Initialize managers
        app.securityManager = new SecurityManager();
        app.uiManager = new UIManager();
        app.mapManager = new MapManager(app.securityManager);
        app.chatManager = new ChatManager(app.securityManager);
        app.gameManager = new GameManager();

        // Setup event listeners
        setupEventListeners();

        // Initialize UI
        await app.uiManager.init();

        app.isInitialized = true;
        console.log('SOS Pantanal initialized successfully');
    } catch (error) {
        console.error('Failed to initialize app:', error);
        app.uiManager?.showError('Falha ao inicializar aplicação');
    }
}

function setupEventListeners() {
    // Modal controls
    document.getElementById('reportBtn')?.addEventListener('click', () => 
        app.uiManager.openModal('reportModal'));
    
    document.getElementById('settingsBtn')?.addEventListener('click', () => 
        app.uiManager.openModal('settingsModal'));
    
    document.getElementById('chatBtn')?.addEventListener('click', () => 
        app.uiManager.openModal('chatModal'));
    
    document.getElementById('aiBtn')?.addEventListener('click', () => 
        app.uiManager.openModal('aiModal'));
    
    document.getElementById('gamesBtn')?.addEventListener('click', () => 
        app.uiManager.openModal('gamesModal'));

    // Close modal handlers
    document.querySelectorAll('[id$="Modal"]').forEach(modal => {
        const closeBtn = modal.querySelector('button[aria-label="Fechar modal"]');
        closeBtn?.addEventListener('click', () => 
            app.uiManager.closeModal(modal.id));
    });

    // Map refresh
    document.getElementById('refreshMap')?.addEventListener('click', () => 
        app.mapManager?.refreshMap());

    // Form submissions
    document.getElementById('reportForm')?.addEventListener('submit', (e) => 
        app.mapManager?.handleReportSubmit(e));
    
    document.getElementById('chatForm')?.addEventListener('submit', (e) => 
        app.chatManager?.handleChatSubmit(e));
    
    document.getElementById('aiForm')?.addEventListener('submit', (e) => 
        app.uiManager?.handleAISubmit(e));
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    app.mapManager?.cleanup();
    app.chatManager?.cleanup();
    app.gameManager?.cleanup();
});

// Export for global access
window.SOSPantanal = app;
