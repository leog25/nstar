// North Star VR Viewer - Device Orientation Handler
// Handles iOS motion permissions and device orientation for VR experience

class NorthStarViewer {
    constructor() {
        this.permissionOverlay = document.getElementById('permission-overlay');
        this.requestButton = document.getElementById('request-permission');
        this.vrScene = document.getElementById('vr-scene');
        this.camera = document.getElementById('camera');
        this.northStar = document.getElementById('north-star');

        this.hasPermission = false;
        this.isIOS = this.checkIOS();

        this.init();
    }

    init() {
        // Set up North Star position (Polaris at celestial north)
        // Declination: ~89.3°, Right Ascension: 2h 31m
        this.setNorthStarPosition();

        // Check if we need to request permissions
        if (this.isIOS && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            // iOS 13+ requires permission
            this.setupPermissionRequest();
        } else {
            // Non-iOS or older iOS versions - try to start directly
            this.startTracking();
        }

        // Add keyboard controls for desktop testing
        this.setupKeyboardControls();
    }

    checkIOS() {
        return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    setNorthStarPosition() {
        // Position Polaris at the celestial north pole
        // In our coordinate system, this is nearly straight up with a slight offset
        const distance = 30; // Distance from origin
        const elevation = 89.3; // Polaris declination in degrees
        const azimuth = 0; // North direction

        // Convert to radians
        const elevRad = (elevation * Math.PI) / 180;
        const azimRad = (azimuth * Math.PI) / 180;

        // Calculate 3D position
        // A-Frame uses Y-up coordinate system
        const x = distance * Math.cos(elevRad) * Math.sin(azimRad);
        const y = distance * Math.sin(elevRad);
        const z = -distance * Math.cos(elevRad) * Math.cos(azimRad);

        this.northStar.setAttribute('position', `${x} ${y} ${z}`);
    }

    setupPermissionRequest() {
        this.requestButton.addEventListener('click', async () => {
            try {
                const response = await DeviceOrientationEvent.requestPermission();
                if (response === 'granted') {
                    this.hasPermission = true;
                    this.startTracking();
                } else {
                    alert('Motion sensor permission denied. The VR experience requires device orientation access.');
                }
            } catch (error) {
                console.error('Error requesting device orientation permission:', error);
                alert('Error requesting permissions. Please ensure you are using Safari on iOS.');
            }
        });
    }

    startTracking() {
        // Hide permission overlay
        this.permissionOverlay.style.display = 'none';

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
        this.showInstructions();
    }

    handleOrientation(event) {
        // Device orientation provides alpha (z), beta (x), gamma (y) rotations
        // A-Frame's look-controls component handles this automatically
        // But we can add custom adjustments if needed

        if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
            // The look-controls component in A-Frame handles the camera rotation
            // We can add additional logic here if needed

            // Optional: Adjust for magnetic declination based on location
            // This would require geolocation API and declination calculation
        }
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
            <p>Move your device to look around</p>
            <p>The bright star is Polaris (North Star)</p>
        `;
        document.body.appendChild(instructions);

        setTimeout(() => {
            instructions.style.opacity = '0';
            setTimeout(() => instructions.remove(), 1000);
        }, 5000);
    }

    // Optional: Add geolocation-based correction
    async getLocation() {
        return new Promise((resolve, reject) => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    position => resolve(position),
                    error => reject(error)
                );
            } else {
                reject(new Error('Geolocation not supported'));
            }
        });
    }

    // Calculate magnetic declination for true north
    calculateMagneticDeclination(latitude, longitude) {
        // Simplified magnetic declination calculation
        // In a real app, you'd use a proper magnetic model or API
        // This is a very rough approximation
        const declination = -10 + (longitude / 10); // Very simplified!
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