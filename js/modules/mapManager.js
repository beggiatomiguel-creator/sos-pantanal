import { SecurityManager } from './securityManager.js';

export class MapManager {
    constructor(securityManager) {
        this.security = securityManager;
        this.map = null;
        this.userMarker = null;
        this.radiusCircle = null;
        this.fireMarkers = [];
        this.userLocation = { lat: -19.0116, lng: -57.6534 };
        this.currentRadius = 100;
        this.lastFireCount = 0;
        this.isLiveData = false;
        this.updateInterval = null;
        
        // Constants
        this.PANTANAL_AREA = '-59,-22,-54,-16';
        this.COMMUNITY_REPORTS_URL = 'https://kvdb.io/ANv9p9Y6yY8z2Z3z2z2z2z/sos_pantanal_reports';
        this.NASA_BASE_URL = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
        
        // Demo data fallback
        this.demoFires = [
            { latitude: -19.1234, longitude: -57.5678, confidence: 'high', acq_date: '2026-03-16' },
            { latitude: -18.9876, longitude: -57.8901, confidence: 'nominal', acq_date: '2026-03-16' },
            { latitude: -19.4567, longitude: -56.7890, confidence: 'low', acq_date: '2026-03-16' }
        ];
    }

    async init() {
        try {
            await this.initMap();
            this.setupEventListeners();
            this.startAutoUpdate();
            console.log('MapManager initialized');
        } catch (error) {
            console.error('MapManager initialization failed:', error);
            throw error;
        }
    }

    async initMap() {
        if (!L) {
            throw new Error('Leaflet not loaded');
        }

        try {
            this.map = L.map('map', {
                center: [this.userLocation.lat, this.userLocation.lng],
                zoom: 8,
                zoomControl: false
            });

            // Add tile layer
            this.addTileLayer('dark');
            
            // Add zoom control
            L.control.zoom({ position: 'bottomright' }).addTo(this.map);

            await this.updateUserLocation();
            await this.renderMapState();
        } catch (error) {
            this.showMapError('Erro ao carregar o mapa. Por favor, recarregue a página.');
            throw error;
        }
    }

    addTileLayer(style = 'dark') {
        const layers = {
            dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        };

        const attributions = {
            dark: '&copy; OpenStreetMap contributors &copy; CARTO',
            satellite: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        };

        if (this.currentTileLayer) {
            this.map.removeLayer(this.currentTileLayer);
        }

        this.currentTileLayer = L.tileLayer(layers[style], {
            attribution: attributions[style]
        }).addTo(this.map);
    }

    setupEventListeners() {
        // Radius control with debouncing
        const radiusRange = document.getElementById('radiusRange');
        const radiusValue = document.getElementById('radiusValue');
        
        if (radiusRange) {
            let debounceTimer;
            radiusRange.addEventListener('input', (e) => {
                this.currentRadius = parseInt(e.target.value);
                if (radiusValue) radiusValue.textContent = this.currentRadius;
                
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.renderMapState();
                }, 300);
            });
        }

        // API key input
        const apiKeyInput = document.getElementById('apiKeyInput');
        if (apiKeyInput) {
            apiKeyInput.value = this.security.apiKey;
            apiKeyInput.addEventListener('change', async (e) => {
                const newKey = e.target.value.trim();
                if (this.security.setApiKey(newKey)) {
                    await this.renderMapState();
                } else {
                    this.showError('Chave da NASA inválida');
                }
            });
        }
    }

    async updateUserLocation() {
        if (!navigator.geolocation) {
            this.updateLocationText('Localização padrão: Corumbá, MS (GPS não disponível)');
            return;
        }

        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    this.updateLocationText(`Localização: ${this.userLocation.lat.toFixed(2)}, ${this.userLocation.lng.toFixed(2)}`);
                    resolve();
                },
                (error) => {
                    console.warn('Geolocation failed:', error);
                    this.updateLocationText('Localização padrão: Corumbá, MS (GPS negado)');
                    resolve();
                },
                { timeout: 10000 }
            );
        });
    }

    async renderMapState() {
        if (!this.map) return;

        try {
            this.showMapLoader(true);
            
            // Clear existing markers
            this.clearMarkers();
            
            // Add user marker
            this.addUserMarker();
            
            // Add radius circle
            this.addRadiusCircle();
            
            // Fetch and display fire data
            await this.fetchAndDisplayFires();
            
            // Update fire count
            this.updateFireCount();
            
            // Fit map to show all relevant area
            this.fitMapToArea();
            
        } catch (error) {
            console.error('Error rendering map state:', error);
            this.showMapError('Erro ao atualizar dados do mapa');
        } finally {
            this.showMapLoader(false);
        }
    }

    clearMarkers() {
        // Clear fire markers
        this.fireMarkers.forEach(marker => this.map.removeLayer(marker));
        this.fireMarkers = [];
        
        // Clear user marker
        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
            this.userMarker = null;
        }
        
        // Clear radius circle
        if (this.radiusCircle) {
            this.map.removeLayer(this.radiusCircle);
            this.radiusCircle = null;
        }
    }

    addUserMarker() {
        if (!this.userLocation) return;

        // Create custom icon for user
        const userIcon = L.divIcon({
            html: '<div style="background: #3b82f6; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [16, 16],
            className: 'user-marker'
        });

        this.userMarker = L.marker([this.userLocation.lat, this.userLocation.lng], { icon: userIcon })
            .addTo(this.map)
            .bindPopup('<b>Sua localização</b><br> Você está aqui!');
    }

    addRadiusCircle() {
        if (!this.userLocation) return;

        this.radiusCircle = L.circle([this.userLocation.lat, this.userLocation.lng], {
            radius: this.currentRadius * 1000, // Convert km to meters
            fillColor: '#3b82f6',
            fillOpacity: 0.1,
            color: '#3b82f6',
            weight: 2,
            opacity: 0.5
        }).addTo(this.map);
    }

    async fetchAndDisplayFires() {
        try {
            const fires = await this.fetchFireData();
            this.displayFires(fires);
        } catch (error) {
            console.warn('Failed to fetch fire data, using demo:', error);
            this.displayFires(this.demoFires);
        }
    }

    async fetchFireData() {
        const bounds = this.calculateBounds();
        const url = `${this.NASA_BASE_URL}/${this.security.apiKey}/${bounds}/1`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('NASA API request failed');
        
        const csvData = await response.text();
        return this.parseFireData(csvData);
    }

    calculateBounds() {
        if (!this.userLocation) return this.PANTANAL_AREA;
        
        const lat = this.userLocation.lat;
        const lng = this.userLocation.lng;
        const radius = this.currentRadius / 111; // Approximate km to degrees
        
        return `${lng + radius},${lat + radius},${lng - radius},${lat - radius}`;
    }

    parseFireData(csvData) {
        const lines = csvData.split('\n').slice(1); // Skip header
        const fires = [];
        
        lines.forEach(line => {
            const [lat, lng, , , confidence, , , , date] = line.split(',');
            if (lat && lng) {
                fires.push({
                    latitude: parseFloat(lat),
                    longitude: parseFloat(lng),
                    confidence: confidence || 'nominal',
                    acq_date: date || new Date().toISOString().split('T')[0]
                });
            }
        });
        
        return fires;
    }

    displayFires(fires) {
        fires.forEach(fire => {
            const color = this.getFireColor(fire.confidence);
            const icon = L.divIcon({
                html: `<div style="background: ${color}; width: 8px; height: 8px; border-radius: 50%; border: 1px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.5);"></div>`,
                iconSize: [10, 10],
                className: 'fire-marker'
            });

            const marker = L.marker([fire.latitude, fire.longitude], { icon })
                .addTo(this.map)
                .bindPopup(`
                    <b>Foco de Incêndio</b><br>
                    <small>Confiança: ${fire.confidence}</small><br>
                    <small>Data: ${fire.acq_date}</small><br>
                    <small>Coord: ${fire.latitude.toFixed(4)}, ${fire.longitude.toFixed(4)}</small>
                `);
            
            this.fireMarkers.push(marker);
        });
    }

    getFireColor(confidence) {
        const colors = {
            'high': '#ef4444',    // Red
            'nominal': '#f59e0b', // Orange  
            'low': '#eab308'      // Yellow
        };
        return colors[confidence] || colors.nominal;
    }

    updateFireCount() {
        const count = this.fireMarkers.length;
        const countElement = document.getElementById('fire-count');
        if (countElement) {
            countElement.textContent = count;
            
            // Add urgency styling based on count
            if (count > 10) {
                countElement.className = 'text-2xl font-bold text-red-600 animate-pulse';
            } else if (count > 5) {
                countElement.className = 'text-2xl font-bold text-orange-500';
            } else {
                countElement.className = 'text-2xl font-bold text-yellow-500';
            }
        }
    }

    fitMapToArea() {
        if (!this.userLocation || this.fireMarkers.length === 0) return;
        
        const bounds = L.latLngBounds([this.userLocation]);
        this.fireMarkers.forEach(marker => {
            bounds.extend(marker.getLatLng());
        });
        
        this.map.fitBounds(bounds, { padding: [50, 50] });
    }

    showMapLoader(show) {
        const loader = document.getElementById('mapLoader');
        if (loader) {
            loader.classList.toggle('hidden', !show);
        }
    }

    showMapError(message) {
        const mapElement = document.getElementById('map');
        if (mapElement) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'absolute inset-0 bg-red-900/80 flex items-center justify-center p-4';
            errorDiv.innerHTML = `
                <div class="text-center text-white">
                    <i data-lucide="alert-triangle" class="w-12 h-12 mx-auto mb-2"></i>
                    <p class="text-sm">${message}</p>
                </div>
            `;
            mapElement.appendChild(errorDiv);
            
            setTimeout(() => errorDiv.remove(), 5000);
        }
    }

    setMapStyle(style) {
        this.addTileLayer(style);
    }

    async refreshMap() {
        await this.renderMapState();
    }
        
        const coordsElement = document.getElementById('currentCoords');
        if (coordsElement) {
            coordsElement.textContent = `${this.userLocation.lat.toFixed(4)}, ${this.userLocation.lng.toFixed(4)}`;
        }
    }

    async fetchFireData() {
        let nasaFires = [];
        
        if (this.security.apiKey) {
            try {
                nasaFires = await this.fetchNASAData();
                this.isLiveData = true;
            } catch (error) {
                console.warn('NASA API failed, using demo data:', error);
                this.isLiveData = false;
            }
        }

        if (nasaFires.length === 0) {
            nasaFires = [...this.demoFires];
            this.isLiveData = false;
        }

        // Fetch community reports
        const communityFires = await this.fetchCommunityReports();
        
        this.updateDataIndicator();
        return [...nasaFires, ...communityFires];
    }

    async fetchNASAData() {
        const margin = (this.currentRadius / 111) + 0.5;
        const minLat = (this.userLocation.lat - margin).toFixed(2);
        const maxLat = (this.userLocation.lat + margin).toFixed(2);
        const minLon = (this.userLocation.lng - margin).toFixed(2);
        const maxLon = (this.userLocation.lng + margin).toFixed(2);
        
        const url = `${this.NASA_BASE_URL}/${this.security.apiKey}/VIIRS_SNPP_NRT/${minLon},${minLat},${maxLon},${maxLat}/1`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const text = await response.text();
            if (text.toLowerCase().includes('invalid api call')) {
                throw new Error('Invalid API key');
            }
            
            return this.parseCSV(text);
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    async fetchCommunityReports() {
        try {
            const response = await this.security.secureFetch(this.COMMUNITY_REPORTS_URL);
            const allReports = await response.json();
            
            return (allReports || []).filter(report => {
                if (!this.security.validateCoordinates(report.latitude, report.longitude)) {
                    return false;
                }
                
                const distance = this.calculateDistance(
                    this.userLocation.lat, this.userLocation.lng,
                    report.latitude, report.longitude
                );
                
                return distance <= this.currentRadius;
            });
        } catch (error) {
            console.warn('Failed to fetch community reports:', error);
            return [];
        }
    }

    parseCSV(csvData) {
        if (!csvData || typeof csvData !== 'string') return [];
        
        try {
            const lines = csvData.trim().split('\n');
            if (lines.length < 2) return [];
            
            const headers = lines[0].split(',').map(h => h.trim());
            return lines.slice(1).map(line => {
                const values = line.split(',');
                const fire = {};
                headers.forEach((header, i) => {
                    if (values[i] !== undefined) {
                        fire[header] = values[i].trim();
                    }
                });
                return fire;
            }).filter(fire => this.security.validateCoordinates(fire.latitude, fire.longitude));
        } catch (error) {
            console.error('CSV parsing error:', error);
            return [];
        }
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    async renderMapState() {
        if (!this.map) return;

        this.showLoader(true);

        try {
            // Clear existing markers
            this.clearMarkers();
            
            // Update map view
            this.map.setView([this.userLocation.lat, this.userLocation.lng], this.map.getZoom());
            
            // Add user marker
            this.addUserMarker();
            
            // Add radius circle
            this.addRadiusCircle();
            
            // Fetch and add fire markers
            const allFires = await this.fetchFireData();
            let firesInRange = 0;
            
            allFires.forEach(fire => {
                const distance = this.calculateDistance(
                    this.userLocation.lat, this.userLocation.lng,
                    parseFloat(fire.latitude), parseFloat(fire.longitude)
                );
                
                if (distance <= this.currentRadius) {
                    firesInRange++;
                    this.addFireMarker(fire, distance);
                }
            });
            
            this.updateFireCount(firesInRange);
            
        } catch (error) {
            console.error('Failed to render map state:', error);
            this.showError('Erro ao atualizar mapa');
        } finally {
            this.showLoader(false);
        }
    }

    clearMarkers() {
        this.fireMarkers.forEach(marker => this.map.removeLayer(marker));
        this.fireMarkers = [];
        
        if (this.radiusCircle) {
            this.map.removeLayer(this.radiusCircle);
            this.radiusCircle = null;
        }
        
        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
            this.userMarker = null;
        }
    }

    addUserMarker() {
        const userIcon = L.divIcon({
            html: `<div class="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>`,
            className: '',
            iconSize: [16, 16]
        });
        
        this.userMarker = L.marker([this.userLocation.lat, this.userLocation.lng], { icon: userIcon })
            .addTo(this.map);
    }

    addRadiusCircle() {
        this.radiusCircle = L.circle([this.userLocation.lat, this.userLocation.lng], {
            radius: this.currentRadius * 1000,
            color: '#3b82f6',
            weight: 1,
            fillOpacity: 0.05
        }).addTo(this.map);
    }

    addFireMarker(fire, distance) {
        const lat = parseFloat(fire.latitude);
        const lng = parseFloat(fire.longitude);
        const isCommunity = fire.is_community || false;
        
        let color = '#ef4444'; // NASA High
        if (isCommunity) {
            color = '#eab308'; // Community gold
        } else {
            const conf = String(fire.confidence).toLowerCase();
            if (conf === 'nominal' || parseInt(conf) > 50) {
                color = '#f59e0b'; // NASA Nominal
            } else if (conf === 'low' || (parseInt(conf) <= 50 && conf !== 'community')) {
                color = '#22c55e'; // NASA Low
            }
        }
        
        const icon = L.divIcon({
            html: `<div class="w-6 h-6 rounded-full flex items-center justify-center border-2 border-white ${isCommunity ? 'animate-bounce' : 'animate-pulse'} shadow-lg" style="background-color: ${color}">
                    <i data-lucide="${isCommunity ? 'megaphone' : 'flame'}" class="w-4 h-4 text-white"></i>
                   </div>`,
            className: '',
            iconSize: [24, 24]
        });
        
        const title = isCommunity ? 'Reporte Comunitário' : 'Foco Detectado (NASA)';
        const marker = L.marker([lat, lng], { icon })
            .bindPopup(`
                <div class="p-1">
                    <b class="text-slate-900">${this.security.sanitizeHtml(title)}</b><br>
                    <span class="text-xs text-slate-600">Distância: ${distance.toFixed(1)} km</span><br>
                    <span class="text-xs text-slate-600">Data: ${this.security.sanitizeHtml(fire.acq_date)}</span>
                </div>
            `)
            .addTo(this.map);
            
        this.fireMarkers.push(marker);
    }

    updateFireCount(count) {
        const countElement = document.getElementById('fire-count');
        if (countElement) {
            countElement.textContent = count;
            
            // Add animation if count increased
            if (count > this.lastFireCount) {
                countElement.classList.add('scale-110', 'text-red-400');
                setTimeout(() => {
                    countElement.classList.remove('scale-110', 'text-red-400');
                }, 1000);
                
                // Play alert sound
                this.playAlertSound();
            }
        }
        
        this.lastFireCount = count;
    }

    updateDataIndicator() {
        const statusElement = document.getElementById('data-status');
        if (!statusElement) return;
        
        if (this.isLiveData) {
            statusElement.innerHTML = `<span class="px-2 py-0.5 bg-green-500/10 text-green-500 text-[10px] font-bold rounded-full border border-green-500/20 flex items-center gap-1 animate-pulse"><i data-lucide="wifi" class="w-3 h-3"></i> NASA LIVE</span>`;
        } else {
            statusElement.innerHTML = `<span class="px-2 py-0.5 bg-yellow-500/10 text-yellow-500 text-[10px] font-bold rounded-full border border-yellow-500/20 flex items-center gap-1"><i data-lucide="wifi-off" class="w-3 h-3"></i> MODO DEMO</span>`;
        }
        
        // Reinitialize Lucide icons
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    showLoader(show) {
        const loader = document.getElementById('mapLoader');
        if (loader) {
            if (show) {
                loader.classList.remove('hidden');
                loader.classList.add('flex');
            } else {
                loader.classList.remove('flex');
                loader.classList.add('hidden');
            }
        }
    }

    showMapError(message) {
        const mapElement = document.getElementById('map');
        if (mapElement) {
            mapElement.innerHTML = `
                <div class="flex items-center justify-center h-full text-slate-500 p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-700">
                    ${this.security.sanitizeHtml(message)}
                </div>
            `;
        }
    }

    showError(message) {
        console.error(message);
        // Could integrate with a toast notification system
    }

    playAlertSound() {
        try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.volume = 0.3;
            audio.play().catch(() => {
                // Audio blocked - ignore
            });
        } catch (error) {
            // Audio failed - ignore
        }
    }

    async handleReportSubmit(event) {
        event.preventDefault();
        
        if (!this.security.rateLimit('fire_report', 3, 300000)) {
            alert('Você está reportando muito rápido. Aguarde alguns minutos.');
            return;
        }
        
        const reportData = {
            latitude: this.userLocation.lat,
            longitude: this.userLocation.lng,
            confidence: 'COMMUNITY',
            acq_date: new Date().toISOString().split('T')[0],
            is_community: true,
            timestamp: Date.now()
        };
        
        try {
            await this.submitCommunityReport(reportData);
            this.addUserReportMarker(reportData);
            alert('Obrigado! Seu reporte foi publicado globalmente.');
        } catch (error) {
            console.error('Failed to submit report:', error);
            alert('Erro ao publicar reporte. Tente novamente.');
        }
        
        // Close modal and reset form
        const modal = document.getElementById('reportModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        
        event.target.reset();
        await this.renderMapState();
    }

    async submitCommunityReport(reportData) {
        // Get existing reports
        const response = await this.security.secureFetch(this.COMMUNITY_REPORTS_URL);
        let currentReports = response.ok ? await response.json() : [];
        
        // Add new report
        currentReports.push(reportData);
        
        // Keep only last 100 reports to prevent bloat
        if (currentReports.length > 100) {
            currentReports = currentReports.slice(-100);
        }
        
        // Save back
        const putResponse = await this.security.secureFetch(this.COMMUNITY_REPORTS_URL, {
            method: 'PUT',
            body: JSON.stringify(currentReports)
        });
        
        if (!putResponse.ok) {
            throw new Error('Failed to save report');
        }
    }

    addUserReportMarker(reportData) {
        const userReportIcon = L.divIcon({
            html: `<div class="w-8 h-8 rounded-full flex items-center justify-center border-2 border-white animate-bounce shadow-xl bg-yellow-500"><i data-lucide="megaphone" class="w-5 h-5 text-white"></i></div>`,
            className: '',
            iconSize: [32, 32]
        });
        
        const marker = L.marker([reportData.latitude, reportData.longitude], { icon: userReportIcon })
            .bindPopup('<b>Seu Reporte Comunitário</b><br>Visível para todos!<br>Status: Publicado')
            .addTo(this.map);
            
        this.fireMarkers.push(marker);
    }

    startAutoUpdate() {
        // Update map every 5 minutes
        this.updateInterval = setInterval(() => {
            this.renderMapState();
        }, 300000);
    }

    refreshMap() {
        this.renderMapState();
    }

    setMapStyle(style) {
        this.addTileLayer(style);
        localStorage.setItem('app_map_style', style);
    }

    cleanup() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        if (this.map) {
            this.map.remove();
        }
    }
}
