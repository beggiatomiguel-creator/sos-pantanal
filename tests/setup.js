// Jest setup file
import 'jest-canvas-mock';

// Mock Leaflet
global.L = {
  map: jest.fn(() => ({
    setView: jest.fn(),
    removeLayer: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    invalidateSize: jest.fn(),
    getZoom: jest.fn(() => 8),
    getCenter: jest.fn(() => ({ lat: -19.0116, lng: -57.6534 }))
  })),
  
  tileLayer: jest.fn(() => ({
    addTo: jest.fn(),
    remove: jest.fn()
  })),
  
  marker: jest.fn(() => ({
    addTo: jest.fn(),
    bindPopup: jest.fn(),
    remove: jest.fn()
  })),
  
  circle: jest.fn(() => ({
    addTo: jest.fn(),
    remove: jest.fn(),
    setRadius: jest.fn()
  })),
  
  divIcon: jest.fn(() => ({})),
  
  control: {
    zoom: jest.fn(() => ({
      addTo: jest.fn()
    }))
  }
};

// Mock Lucide icons
global.lucide = {
  createIcons: jest.fn()
};

// Mock Web APIs
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock navigator.geolocation
global.navigator.geolocation = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
};

// Mock fetch
global.fetch = jest.fn();

// Mock crypto for UUID generation
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: jest.fn(() => new Uint8Array(32)),
    randomUUID: jest.fn(() => 'mock-uuid-1234')
  }
});

// Mock Audio
global.Audio = jest.fn().mockImplementation(() => ({
  play: jest.fn(),
  pause: jest.fn(),
  load: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  volume: 1,
  currentTime: 0,
  paused: true,
  readyState: 4
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 16));
global.cancelAnimationFrame = jest.fn(id => clearTimeout(id));

// Mock console methods to avoid noise in tests
const originalConsole = { ...console };
beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
  console.info = jest.fn();
});

afterAll(() => {
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
});
