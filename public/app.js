// North Star VR Viewer - Device Orientation Handler
// Handles iOS motion permissions and device orientation for VR experience

class NorthStarViewer {
    constructor() {
        this.vrScene = document.getElementById('vr-scene');
        this.camera = document.getElementById('camera');
        this.northStar = document.getElementById('north-star');

        this.hasPermission = false;
        this.isIOS = this.checkIOS();

        // Location and compass data
        this.userLocation = null;
        this.magneticDeclination = 0;
        this.trueHeading = null;
        this.magneticHeading = null;

        // Track if we've positioned the star
        this.starPositioned = false;

        this.init();
    }

    init() {
        // Request permissions BEFORE A-Frame initializes to prevent A-Frame's dialog
        if (this.isIOS && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            // For iOS 13+, request permission immediately
            // This happens before A-Frame tries to request it
            this.requestIOSPermission();
        } else {
            // Non-iOS or older iOS versions - start directly
            this.startTracking();
        }

        // Get user's location
        this.getUserLocation().then(() => {
            // Set up North Star position based on user's latitude
            this.updateNorthStarPosition();
        }).catch((error) => {
            console.warn('Could not get location, using default position:', error);
            // Fallback to default position (40°N latitude)
            this.userLocation = { latitude: 40, longitude: 0 };
            this.updateNorthStarPosition();
        });

        // Add keyboard controls for desktop testing
        this.setupKeyboardControls();
    }

    checkIOS() {
        return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    updateNorthStarPosition() {
        // Calculate Polaris position based on user's latitude

        if (!this.userLocation) {
            console.warn('No user location available, using default');
            this.userLocation = { latitude: 40, longitude: 0 };
        }

        // Store elevation for later use
        this.polarisElevation = this.userLocation.latitude; // Elevation angle in degrees

        console.log(`Polaris elevation for latitude ${this.userLocation.latitude}°: ${this.polarisElevation}°`);

        // Location info no longer displayed

        // Position the star immediately if we have compass data
        if (this.trueHeading !== null) {
            this.positionPolarisWithCompass();
        }
    }

    // Position Polaris based on initial compass heading (only called once)
    positionPolarisWithCompass() {
        if (this.polarisElevation === undefined || this.trueHeading === null || this.starPositioned) {
            return; // Don't reposition if already positioned
        }

        const distance = 30; // Distance from origin in 3D space

        // Calculate where north is relative to current device orientation
        // After compass fix: 0° = North, 90° = East, 180° = South, 270° = West
        // We need to place the star so it appears in the north direction
        // If facing North (0°), star should be straight ahead (azimuth = 0°)
        // If facing East (90°), star should be to the left (azimuth = -90°)
        // If facing South (180°), star should be behind (azimuth = 180°)
        // If facing West (270°), star should be to the right (azimuth = 90°)
        // Since we inverted the compass, we now use positive heading
        const azimuth = this.trueHeading; // Use positive after compass inversion fix

        // Convert to radians
        const elevRad = (this.polarisElevation * Math.PI) / 180;
        const azimRad = (azimuth * Math.PI) / 180;

        // Calculate 3D position
        // A-Frame uses Y-up coordinate system, -Z is forward
        // Need to negate X to fix East/West orientation
        const x = -distance * Math.cos(elevRad) * Math.sin(azimRad);
        const y = distance * Math.sin(elevRad);
        const z = -distance * Math.cos(elevRad) * Math.cos(azimRad);

        this.northStar.setAttribute('position', `${x} ${y} ${z}`);

        // Make star visible after positioning
        this.northStar.setAttribute('visible', 'true');
        this.starPositioned = true;

        console.log(`Polaris positioned once at launch: heading=${this.trueHeading}°, azimuth=${azimuth}°, elevation=${this.polarisElevation}°`);
    }

    async requestIOSPermission() {
        try {
            const response = await DeviceOrientationEvent.requestPermission();
            if (response === 'granted') {
                this.hasPermission = true;
                this.startTracking();
            } else {
                console.warn('Motion sensor permission denied');
                // Start anyway but without orientation tracking
                this.startTracking();
            }
        } catch (error) {
            console.error('Error requesting device orientation permission:', error);
            // Start anyway
            this.startTracking();
        }
    }

    startTracking() {
        // No overlays to hide or show anymore

        // Enable device orientation tracking
        if (window.DeviceOrientationEvent) {
            window.addEventListener('deviceorientation', (event) => {
                this.handleOrientation(event);
            });
        }

        // Also listen for device motion for additional smoothness
        if (window.DeviceMotionEvent) {
            window.addEventListener('devicemotion', (event) => {
                this.handleMotion(event);
            });
        }

        // Start the VR experience
        this.vrScene.style.display = 'block';

        // Log successful initialization
        console.log('North Star VR Viewer initialized successfully');

        // Optional: Show instructions
        // this.showInstructions();
    }

    handleOrientation(event) {
        // Device orientation provides alpha (z), beta (x), gamma (y) rotations
        // alpha = compass heading (0-360)
        // beta = pitch (-180 to 180)
        // gamma = roll (-90 to 90)

        if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
            // Get magnetic heading from device
            // Fix: Invert the compass reading for correct East/West
            this.magneticHeading = 360 - event.alpha;

            // Calculate true heading using magnetic declination
            this.trueHeading = (this.magneticHeading + this.magneticDeclination + 360) % 360;

            const pitch = Math.round(event.beta);
            const roll = Math.round(event.gamma);

            // Compass direction is calculated but not displayed anymore
            const compass = this.getCompassDirection(this.trueHeading);

            // Use webkitCompassHeading for iOS if available (more accurate)
            if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
                // webkitCompassHeading gives us magnetic north
                // Note: webkitCompassHeading is already in the correct orientation
                this.magneticHeading = event.webkitCompassHeading;
                this.trueHeading = (this.magneticHeading + this.magneticDeclination + 360) % 360;

                // More accurate iOS compass data (not displayed anymore)
                const accurateCompass = this.getCompassDirection(this.trueHeading);

                // If we have accuracy data, show it
                if (event.webkitCompassAccuracy !== undefined) {
                    console.log(`Compass accuracy: ±${event.webkitCompassAccuracy}°`);
                }
            }

            // Position Polaris only once (first compass reading)
            if (!this.starPositioned) {
                this.positionPolarisWithCompass();
            }
        }
    }

    getCompassDirection(heading) {
        // Fix: When turning left from North, heading increases (0 -> 270 -> 180 -> 90 -> 0)
        // When turning right from North, heading decreases (0 -> 90 -> 180 -> 270 -> 0)
        // Standard compass: N=0°, E=90°, S=180°, W=270°
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round(heading / 45) % 8;
        return directions[index];
    }

    handleMotion(event) {
        // Handle device motion for smoother tracking
        // This is handled by A-Frame's look-controls, but we can enhance it

        if (event.rotationRate) {
            // Rotation rate can be used for predictive smoothing
            // A-Frame handles this internally
        }
    }

    setupKeyboardControls() {
        // For desktop testing - arrow keys to look around
        document.addEventListener('keydown', (event) => {
            if (!this.isIOS) {
                const camera = document.querySelector('a-camera');
                const rotation = camera.getAttribute('rotation');

                switch(event.key) {
                    case 'ArrowUp':
                        rotation.x = Math.min(rotation.x + 5, 90);
                        break;
                    case 'ArrowDown':
                        rotation.x = Math.max(rotation.x - 5, -90);
                        break;
                    case 'ArrowLeft':
                        rotation.y += 5;
                        break;
                    case 'ArrowRight':
                        rotation.y -= 5;
                        break;
                    case 'g': // Toggle grid
                        const grid = document.getElementById('orientation-grid');
                        grid.setAttribute('visible', !grid.getAttribute('visible'));
                        break;
                }

                camera.setAttribute('rotation', rotation);
            }
        });
    }

    showInstructions() {
        // Show brief instructions that auto-hide
        const instructions = document.createElement('div');
        instructions.className = 'instructions';
        instructions.innerHTML = `
            <p>The bright star is Polaris - positioned based on your location and compass</p>
        `;
        document.body.appendChild(instructions);

        setTimeout(() => {
            instructions.style.opacity = '0';
            setTimeout(() => instructions.remove(), 1000);
        }, 5000);
    }

    // Get user's geographic location
    async getUserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.userLocation = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    };

                    // Calculate magnetic declination for this location
                    this.magneticDeclination = this.calculateMagneticDeclination(
                        this.userLocation.latitude,
                        this.userLocation.longitude
                    );

                    console.log(`Location: ${this.userLocation.latitude}°, ${this.userLocation.longitude}°`);
                    console.log(`Magnetic declination: ${this.magneticDeclination}°`);

                    resolve(this.userLocation);
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    }

    // Calculate magnetic declination using World Magnetic Model approximation
    calculateMagneticDeclination(latitude, longitude) {
        // This is a simplified approximation of magnetic declination
        // For production, use the NOAA API or World Magnetic Model
        // API endpoint: https://www.ngdc.noaa.gov/geomag/calculators/magcalc.shtml

        // Rough approximation based on location
        // Eastern US: -10 to -15 degrees
        // Western US: +10 to +15 degrees
        // Europe: -5 to +5 degrees

        let declination = 0;

        // Very rough approximation for demo purposes
        if (longitude >= -130 && longitude <= -70) { // North America
            // Linear interpolation across US
            declination = (longitude + 100) * 0.5 - 10;
        } else if (longitude >= -10 && longitude <= 40) { // Europe
            declination = longitude * 0.25;
        } else if (longitude >= 70 && longitude <= 150) { // Asia
            declination = (longitude - 110) * 0.3;
        } else {
            // Default rough estimate
            declination = longitude * 0.1;
        }

        // Latitude adjustment (very rough)
        declination += (latitude - 45) * 0.05;

        return declination;
    }


}

// Initialize the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.northStarViewer = new NorthStarViewer();
    });
} else {
    window.northStarViewer = new NorthStarViewer();
}

// Service worker registration for PWA capabilities (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Uncomment to enable service worker
        // navigator.serviceWorker.register('/sw.js');
    });
}