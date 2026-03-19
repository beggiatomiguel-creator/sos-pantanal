export class SecurityManager {
    constructor() {
        this.apiKey = this.getSecureApiKey();
        this.setupCSRFProtection();
    }

    getSecureApiKey() {
        // Get API key from secure storage with fallback
        const key = localStorage.getItem('nasa_api_key');
        if (key && this.validateApiKey(key)) {
            return key;
        }
        return 'jndhJt9s4cApwgK3LwcHS9OUxhfcgoVPQ43XI7hs'; // Demo key
    }

    validateApiKey(key) {
        // Basic validation for NASA FIRMS API key format
        return typeof key === 'string' && key.length >= 32 && /^[a-zA-Z0-9]+$/.test(key);
    }

    setApiKey(key) {
        if (this.validateApiKey(key)) {
            localStorage.setItem('nasa_api_key', key);
            this.apiKey = key;
            return true;
        }
        return false;
    }

    sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        
        // Basic XSS protection
        return input
            .replace(/[<>]/g, '') // Remove HTML tags
            .replace(/javascript:/gi, '') // Remove JS protocols
            .replace(/on\w+=/gi, '') // Remove event handlers
            .trim()
            .substring(0, 500); // Limit length
    }

    sanitizeHtml(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }

    setupCSRFProtection() {
        // Generate and store CSRF token
        if (!localStorage.getItem('csrf_token')) {
            const token = this.generateCSRFToken();
            localStorage.setItem('csrf_token', token);
        }
    }

    generateCSRFToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    getCSRFToken() {
        return localStorage.getItem('csrf_token');
    }

    async secureFetch(url, options = {}) {
        const secureOptions = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': this.getCSRFToken(),
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, secureOptions);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response;
        } catch (error) {
            console.error('Secure fetch failed:', error);
            throw error;
        }
    }

    validateCoordinates(lat, lng) {
        const latNum = parseFloat(lat);
        const lngNum = parseFloat(lng);
        
        return !isNaN(latNum) && !isNaN(lngNum) &&
               latNum >= -90 && latNum <= 90 &&
               lngNum >= -180 && lngNum <= 180;
    }

    rateLimit(action, limit = 5, windowMs = 60000) {
        const key = `rate_limit_${action}`;
        const now = Date.now();
        const attempts = JSON.parse(localStorage.getItem(key) || '[]');
        
        // Filter old attempts
        const recent = attempts.filter(time => now - time < windowMs);
        
        if (recent.length >= limit) {
            return false; // Rate limited
        }
        
        recent.push(now);
        localStorage.setItem(key, JSON.stringify(recent));
        return true;
    }
}
