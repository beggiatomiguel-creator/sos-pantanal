const CACHE_NAME = 'sos-pantanal-v2.0.0';
const STATIC_CACHE = 'static-v2.0.0';
const DYNAMIC_CACHE = 'dynamic-v2.0.0';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/modules/securityManager.js',
  '/js/modules/mapManager.js',
  '/js/modules/uiManager.js',
  '/js/modules/chatManager.js',
  '/js/modules/gameManager.js',
  '/manifest.json',
  '/assets/logo.png',
  '/assets/icon-192x192.png',
  '/assets/icon-512x512.png'
];

const API_ENDPOINTS = [
  'https://firms.modaps.eosdis.nasa.gov/api/',
  'https://kvdb.io/ANv9p9Y6yY8z2Z3z2z2z2z/sos_pantanal_reports',
  'https://kvdb.io/ANv9p9Y6yY8z2Z3z2z2z2z/sos_pantanal_chat'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('SW: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('SW: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('SW: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('SW: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle API requests
  if (API_ENDPOINTS.some(endpoint => url.href.startsWith(endpoint))) {
    event.respondWith(handleAPIRequest(request));
    return;
  }
  
  // Handle static assets
  if (STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname.endsWith(asset.split('/').pop()))) {
    event.respondWith(handleStaticRequest(request));
    return;
  }
  
  // Handle other requests with cache-first strategy
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }
        
        // Network request for non-cached content
        return fetch(request)
          .then((response) => {
            // Cache successful responses
            if (response.ok && response.type === 'basic') {
              const responseClone = response.clone();
              caches.open(DYNAMIC_CACHE)
                .then((cache) => {
                  cache.put(request, responseClone);
                });
            }
            return response;
          })
          .catch(() => {
            // Return offline page for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Handle static requests with cache-first strategy
function handleStaticRequest(request) {
  return new Promise(async (resolve) => {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      // Update cache in background
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const cache = caches.open(STATIC_CACHE);
            cache.then(c => c.put(request, response));
          }
        })
        .catch(() => {
          // Ignore network errors for cached content
        });
      
      resolve(cachedResponse);
      return;
    }
    
    // Network request with cache fallback
    try {
      const networkResponse = await fetch(request);
      
      if (networkResponse.ok) {
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, networkResponse.clone());
        resolve(networkResponse);
        return;
      }
    } catch (error) {
      console.log('SW: Network failed, trying cache:', error);
    }
    
    // Return cached version if available
    const fallbackResponse = await caches.match(request);
    resolve(fallbackResponse);
  });
}

// Handle API requests with network-first strategy
function handleAPIRequest(request) {
  return new Promise(async (resolve) => {
    try {
      const networkResponse = await fetch(request);
      
      if (networkResponse.ok) {
        // Cache successful API responses for offline access
        const cache = await caches.open(DYNAMIC_CACHE);
        cache.put(request, networkResponse.clone());
        resolve(networkResponse);
        return;
      }
    } catch (error) {
      console.log('SW: API network failed, trying cache:', error);
    }
    
    // Return cached API response if available
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      resolve(cachedResponse);
      return;
    }
    
    // Return offline response for API requests
    resolve(new Response(
      JSON.stringify({ 
        error: 'Offline', 
        message: 'Sem conexão com a internet. Usando dados em cache.' 
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    ));
  });
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Handle queued offline actions
  const cache = await caches.open(DYNAMIC_CACHE);
  const pendingRequests = await cache.match('/pending-requests');
  
  if (pendingRequests) {
    const requests = await pendingRequests.json();
    
    for (const request of requests) {
      try {
        await fetch(request.url, request.options);
        console.log('SW: Synced request:', request.url);
      } catch (error) {
        console.error('SW: Failed to sync request:', error);
      }
    }
    
    // Clear synced requests
    await cache.delete('/pending-requests');
  }
}

// Push notifications (if implemented later)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'Novo alerta de incêndio no Pantanal',
      icon: '/assets/icon-192x192.png',
      badge: '/assets/icon-96x96.png',
      vibrate: [100, 50, 100],
      data: data.url || '/',
      actions: [
        {
          action: 'open',
          title: 'Ver Mapa'
        },
        {
          action: 'dismiss',
          title: 'Dispensar'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'SOS Pantanal', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data || '/')
    );
  }
});

// Cleanup old dynamic cache periodically
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_CLEANUP') {
    event.waitUntil(cleanupDynamicCache());
  }
});

async function cleanupDynamicCache() {
  const cache = await caches.open(DYNAMIC_CACHE);
  const requests = await cache.keys();
  
  // Keep only recent entries (last 100)
  if (requests.length > 100) {
    const toDelete = requests.slice(0, -100);
    await Promise.all(toDelete.map(request => cache.delete(request)));
  }
}
