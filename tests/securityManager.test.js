import { SecurityManager } from '../js/modules/securityManager.js';

describe('SecurityManager', () => {
  let securityManager;

  beforeEach(() => {
    securityManager = new SecurityManager();
    localStorage.clear();
  });

  describe('API Key Management', () => {
    test('should validate correct API key format', () => {
      const validKey = 'jndhJt9s4cApwgK3LwcHS9OUxhfcgoVPQ43XI7hs';
      expect(securityManager.validateApiKey(validKey)).toBe(true);
    });

    test('should reject invalid API key formats', () => {
      expect(securityManager.validateApiKey('')).toBe(false);
      expect(securityManager.validateApiKey('short')).toBe(false);
      expect(securityManager.validateApiKey('invalid-chars-!@#')).toBe(false);
      expect(securityManager.validateApiKey(123)).toBe(false);
    });

    test('should set and get API key securely', () => {
      const validKey = 'jndhJt9s4cApwgK3LwcHS9OUxhfcgoVPQ43XI7hs';
      
      expect(securityManager.setApiKey(validKey)).toBe(true);
      expect(securityManager.apiKey).toBe(validKey);
      expect(localStorage.getItem('nasa_api_key')).toBe(validKey);
    });

    test('should reject invalid API key when setting', () => {
      expect(securityManager.setApiKey('invalid')).toBe(false);
      expect(localStorage.getItem('nasa_api_key')).toBeNull();
    });
  });

  describe('Input Sanitization', () => {
    test('should sanitize HTML input', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const sanitized = securityManager.sanitizeInput(maliciousInput);
      expect(sanitized).toBe('alert("xss")');
    });

    test('should sanitize JavaScript protocols', () => {
      const jsInput = 'javascript:alert("xss")';
      const sanitized = securityManager.sanitizeInput(jsInput);
      expect(sanitized).toBe('alert("xss")');
    });

    test('should sanitize event handlers', () => {
      const eventInput = 'onclick="alert("xss")"';
      const sanitized = securityManager.sanitizeInput(eventInput);
      expect(sanitized).toBe('"alert("xss")"');
    });

    test('should limit input length', () => {
      const longInput = 'a'.repeat(600);
      const sanitized = securityManager.sanitizeInput(longInput);
      expect(sanitized.length).toBe(500);
    });

    test('should handle non-string inputs', () => {
      expect(securityManager.sanitizeInput(123)).toBe('');
      expect(securityManager.sanitizeInput(null)).toBe('');
      expect(securityManager.sanitizeInput(undefined)).toBe('');
    });
  });

  describe('Coordinate Validation', () => {
    test('should validate correct coordinates', () => {
      expect(securityManager.validateCoordinates(-19.0116, -57.6534)).toBe(true);
      expect(securityManager.validateCoordinates(0, 0)).toBe(true);
      expect(securityManager.validateCoordinates(90, 180)).toBe(true);
      expect(securityManager.validateCoordinates(-90, -180)).toBe(true);
    });

    test('should reject invalid coordinates', () => {
      expect(securityManager.validateCoordinates(91, 0)).toBe(false);
      expect(securityManager.validateCoordinates(-91, 0)).toBe(false);
      expect(securityManager.validateCoordinates(0, 181)).toBe(false);
      expect(securityManager.validateCoordinates(0, -181)).toBe(false);
      expect(securityManager.validateCoordinates('invalid', 0)).toBe(false);
      expect(securityManager.validateCoordinates(0, 'invalid')).toBe(false);
      expect(securityManager.validateCoordinates(NaN, 0)).toBe(false);
    });
  });

  describe('CSRF Protection', () => {
    test('should generate CSRF token', () => {
      const token = securityManager.generateCSRFToken();
      expect(token).toMatch(/^[a-f0-9]{64}$/); // 32 bytes = 64 hex chars
    });

    test('should store and retrieve CSRF token', () => {
      const token = securityManager.generateCSRFToken();
      expect(securityManager.getCSRFToken()).toBe(token);
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should allow requests within limit', () => {
      expect(securityManager.rateLimit('test', 5, 60000)).toBe(true);
      expect(securityManager.rateLimit('test', 5, 60000)).toBe(true);
      expect(securityManager.rateLimit('test', 5, 60000)).toBe(true);
    });

    test('should block requests exceeding limit', () => {
      // Make 5 requests (limit)
      for (let i = 0; i < 5; i++) {
        securityManager.rateLimit('test', 5, 60000);
      }
      
      // 6th request should be blocked
      expect(securityManager.rateLimit('test', 5, 60000)).toBe(false);
    });

    test('should reset after time window', () => {
      // Make 5 requests (limit)
      for (let i = 0; i < 5; i++) {
        securityManager.rateLimit('test', 5, 60000);
      }
      
      // Should be blocked
      expect(securityManager.rateLimit('test', 5, 60000)).toBe(false);
      
      // Advance time by 60 seconds
      jest.advanceTimersByTime(60000);
      
      // Should be allowed again
      expect(securityManager.rateLimit('test', 5, 60000)).toBe(true);
    });
  });

  describe('Secure Fetch', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    test('should add security headers to requests', async () => {
      const mockResponse = { ok: true, json: () => Promise.resolve({}) };
      fetch.mockResolvedValue(mockResponse);

      await securityManager.secureFetch('https://example.com/api', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' })
      });

      expect(fetch).toHaveBeenCalledWith('https://example.com/api', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': expect.any(String)
        }
      });
    });

    test('should handle fetch errors', async () => {
      fetch.mockRejectedValue(new Error('Network error'));

      await expect(securityManager.secureFetch('https://example.com/api')).rejects.toThrow('Network error');
    });
  });
});
