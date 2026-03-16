// Initialize map
let map;
let userMarker;
let radiusCircle;
let fireMarkers = [];
let userLocation = { lat: -19.0116, lng: -57.6534 }; // Default to Corumbá, MS (heart of Pantanal)

// Mock Fire Data (Active spots in Pantanal region)
const mockFires = [
    { id: 1, lat: -19.1000, lng: -57.5000, intensity: 'high', date: '2026-03-16 10:30' },
    { id: 2, lat: -18.8000, lng: -57.8000, intensity: 'medium', date: '2026-03-16 09:15' },
    { id: 3, lat: -19.5000, lng: -56.8000, intensity: 'low', date: '2026-03-16 11:45' },
    { id: 4, lat: -20.2000, lng: -56.2000, intensity: 'high', date: '2026-03-16 08:00' },
    { id: 5, lat: -17.5000, lng: -57.0000, intensity: 'medium', date: '2026-03-16 12:00' },
];

function initMap() {
    map = L.map('map', {
        center: [userLocation.lat, userLocation.lng],
        zoom: 8,
        zoomControl: false
    });

    // Dark theme tiles (using CartoDB Voyager)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initial load
    updateUserLocation();
}

function updateUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                renderMapState();
                document.getElementById('location-text').innerText = `Sua localização: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`;
                document.getElementById('currentCoords').innerText = `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`;
            },
            (error) => {
                console.warn('Geolocation error:', error);
                document.getElementById('location-text').innerText = 'Localização padrão: Corumbá, MS (GPS não disponível)';
                document.getElementById('currentCoords').innerText = `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`;
                renderMapState();
            }
        );
    } else {
        renderMapState();
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function renderMapState() {
    // Clear existing markers
    fireMarkers.forEach(m => map.removeLayer(m));
    if (radiusCircle) map.removeLayer(radiusCircle);
    if (userMarker) map.removeLayer(userMarker);

    map.setView([userLocation.lat, userLocation.lng], 8);

    // Add user marker
    const userIcon = L.divIcon({
        html: `<div class="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-lg shadow-blue-500/50"></div>`,
        className: 'custom-div-icon',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });
    userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map);

    // Add 100km radius circle
    radiusCircle = L.circle([userLocation.lat, userLocation.lng], {
        radius: 100000, // 100km in meters
        color: '#3b82f6',
        weight: 1,
        fillColor: '#3b82f6',
        fillOpacity: 0.05,
        dashArray: '5, 10'
    }).addTo(map);

    // Filter and add fire markers
    let firesInRange = 0;
    mockFires.forEach(fire => {
        const distance = calculateDistance(userLocation.lat, userLocation.lng, fire.lat, fire.lng);
        
        if (distance <= 100) {
            firesInRange++;
            const color = fire.intensity === 'high' ? '#ef4444' : (fire.intensity === 'medium' ? '#f59e0b' : '#22c55e');
            const icon = L.divIcon({
                html: `<div class="w-6 h-6 bg-${fire.intensity === 'high' ? 'red' : (fire.intensity === 'medium' ? 'yellow' : 'green')}-500 rounded-full flex items-center justify-center border-2 border-white animate-pulse shadow-lg shadow-red-500/50">
                        <i data-lucide="flame" class="w-4 h-4 text-white"></i>
                       </div>`,
                className: 'custom-div-icon',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            
            const marker = L.marker([fire.lat, fire.lng], { icon: icon })
                .bindPopup(`
                    <div class="text-slate-900 p-2">
                        <h4 class="font-bold flex items-center gap-1">
                            <span class="w-2 h-2 rounded-full bg-${fire.intensity === 'high' ? 'red' : (fire.intensity === 'medium' ? 'yellow' : 'green')}-500"></span>
                            Foco de Incêndio
                        </h4>
                        <p class="text-xs text-slate-500">Intensidade: ${fire.intensity.toUpperCase()}</p>
                        <p class="text-xs text-slate-500">Detectado em: ${fire.date}</p>
                        <p class="text-xs text-slate-500">Distância: ${distance.toFixed(1)} km</p>
                    </div>
                `)
                .addTo(map);
            fireMarkers.push(marker);
        }
    });

    document.getElementById('fire-count').innerText = firesInRange;
    lucide.createIcons();
}

// Modal and Form Logic
const reportBtn = document.getElementById('reportBtn');
const reportModal = document.getElementById('reportModal');
const closeModal = document.getElementById('closeModal');
const reportForm = document.getElementById('reportForm');
const refreshMap = document.getElementById('refreshMap');

reportBtn.addEventListener('click', () => {
    reportModal.classList.remove('hidden');
    reportModal.classList.add('flex');
});

closeModal.addEventListener('click', () => {
    reportModal.classList.add('hidden');
    reportModal.classList.remove('flex');
});

reportForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const intensity = reportForm.querySelector('input[name="intensity"]:checked').value;
    
    // Simulate adding a new fire to the system
    const newFire = {
        id: Date.now(),
        lat: userLocation.lat + (Math.random() - 0.5) * 0.1, // Near user
        lng: userLocation.lng + (Math.random() - 0.5) * 0.1,
        intensity: intensity,
        date: new Date().toLocaleString('pt-BR')
    };
    
    mockFires.push(newFire);
    alert('Relatório enviado com sucesso! Obrigado por ajudar a proteger o Pantanal.');
    
    reportModal.classList.add('hidden');
    reportModal.classList.remove('flex');
    renderMapState();
});

refreshMap.addEventListener('click', () => {
    updateUserLocation();
});

// Start the app
initMap();
