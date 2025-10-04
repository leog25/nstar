// iOS Detection
function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Main App Class
class NorthStarApp {
    constructor() {
        this.canvas = document.getElementById('starCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.morseController = new MorseController();

        // Device orientation data
        this.orientation = {
            alpha: 0,  // Compass direction (0-360)
            beta: 0,   // Tilt front-to-back (-180 to 180)
            gamma: 0   // Roll left-to-right (-90 to 90)
        };

        // Smoothing filter
        this.smoothedOrientation = { ...this.orientation };
        this.smoothingFactor = 0.1;

        // North Star position (Polaris)
        // Polaris is at approximately 89.26° declination (nearly at celestial north pole)
        this.polarisDeclinaton = 89.26;

        // Device location
        this.latitude = 40; // Default to 40°N (will be updated by geolocation)
        this.longitude = -74; // Default longitude
        this.locationAcquired = false;

        // Star properties
        this.starBrightness = 1.0;
        this.isMorseBlinking = false;
        this.starSize = 3;

        // Animation
        this.twinklePhase = 0;
        this.animationFrame = null;

        this.init();
    }

    init() {
        // Check if iOS
        if (!isIOS()) {
            this.showFallback();
            return;
        }

        // Set up canvas
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Set up controls
        this.setupControls();

        // Get device location
        this.getLocation();

        // Request permission for iOS 13+
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            document.getElementById('permissionBtn').classList.remove('hidden');
            document.getElementById('permissionBtn').addEventListener('click', () => {
                this.requestOrientationPermission();
            });
        } else {
            // iOS 12 and below - no permission needed
            this.startOrientationTracking();
            document.getElementById('morseControls').classList.remove('hidden');
        }

        // Start animation loop
        this.animate();
    }

    showFallback() {
        document.getElementById('app').classList.add('hidden');
        document.getElementById('fallback').classList.remove('hidden');
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    getLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.latitude = position.coords.latitude;
                    this.longitude = position.coords.longitude;
                    this.locationAcquired = true;
                    console.log(`Location acquired: ${this.latitude.toFixed(2)}°N, ${this.longitude.toFixed(2)}°E`);

                    // Update info display
                    const infoDiv = document.getElementById('info');
                    const locationSpan = document.createElement('span');
                    locationSpan.id = 'location';
                    locationSpan.textContent = `Lat: ${this.latitude.toFixed(2)}°`;
                    infoDiv.appendChild(locationSpan);
                },
                (error) => {
                    console.warn('Geolocation error:', error.message);
                    console.log('Using default latitude 40°N');
                },
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );
        } else {
            console.log('Geolocation not supported, using default latitude');
        }
    }

    async requestOrientationPermission() {
        try {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission === 'granted') {
                document.getElementById('permissionBtn').classList.add('hidden');
                document.getElementById('morseControls').classList.remove('hidden');
                this.startOrientationTracking();
            }
        } catch (error) {
            console.error('Permission request failed:', error);
            alert('Please allow motion access to use this app');
        }
    }

    startOrientationTracking() {
        window.addEventListener('deviceorientation', (event) => {
            if (event.alpha !== null) {
                // Apply low-pass filter for smoothing
                this.smoothedOrientation.alpha = this.smoothedOrientation.alpha * (1 - this.smoothingFactor) +
                                                  event.alpha * this.smoothingFactor;
                this.smoothedOrientation.beta = this.smoothedOrientation.beta * (1 - this.smoothingFactor) +
                                                 event.beta * this.smoothingFactor;
                this.smoothedOrientation.gamma = this.smoothedOrientation.gamma * (1 - this.smoothingFactor) +
                                                  event.gamma * this.smoothingFactor;

                this.orientation = {
                    alpha: event.alpha,
                    beta: event.beta,
                    gamma: event.gamma
                };

                this.updateInfo();
            }
        });
    }

    updateInfo() {
        const compass = Math.round(this.orientation.alpha);
        const elevation = Math.round(this.orientation.beta);

        document.getElementById('compass').textContent = `Compass: ${compass}°`;
        document.getElementById('elevation').textContent = `Elevation: ${elevation}°`;
    }

    setupControls() {
        const morseInput = document.getElementById('morseInput');
        const morseBtn = document.getElementById('morseBtn');
        const stopMorseBtn = document.getElementById('stopMorseBtn');

        morseBtn.addEventListener('click', () => {
            const text = morseInput.value;
            if (text) {
                this.startMorse(text);
            }
        });

        stopMorseBtn.addEventListener('click', () => {
            this.stopMorse();
        });

        morseInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const text = morseInput.value;
                if (text) {
                    this.startMorse(text);
                }
            }
        });
    }

    startMorse(text) {
        document.getElementById('stopMorseBtn').classList.remove('hidden');
        this.isMorseBlinking = true;

        this.morseController.play(
            text,
            () => { this.starBrightness = 1.0; },  // On
            () => { this.starBrightness = 0.1; },  // Off
            () => {  // Complete
                this.starBrightness = 1.0;
                this.isMorseBlinking = false;
                document.getElementById('stopMorseBtn').classList.add('hidden');
            }
        );
    }

    stopMorse() {
        this.morseController.stop();
        this.starBrightness = 1.0;
        this.isMorseBlinking = false;
        document.getElementById('stopMorseBtn').classList.add('hidden');
    }

    calculateStarPosition() {
        // Calculate North Star position based on device orientation and location

        // Polaris elevation angle equals observer's latitude in Northern Hemisphere
        // In Southern Hemisphere, Polaris is below the horizon
        const polarisElevation = Math.abs(this.latitude); // degrees above horizon

        // Get device orientation
        const deviceHeading = this.smoothedOrientation.alpha; // Compass heading (0-360)
        const phoneTilt = this.smoothedOrientation.beta; // Front-to-back tilt
        const phoneRoll = this.smoothedOrientation.gamma; // Left-to-right roll

        // Calculate bearing to north
        // alpha=0 means the device is pointing north
        // We need to calculate how many degrees we are off from north
        const bearingToNorth = (360 - deviceHeading) % 360;

        // Calculate the apparent position on screen
        // When phone is level (beta=0), looking at horizon
        // When tilted up (negative beta), see higher in sky
        // When tilted down (positive beta), see lower in sky

        // For elevation: star is at latitude degrees above horizon
        // Phone tilt determines what elevation we're looking at
        const elevationDiff = polarisElevation - phoneTilt;

        // Convert to screen coordinates
        // Center of screen is straight ahead
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // Field of view (degrees visible on screen)
        const fovHorizontal = 60;
        const fovVertical = 40;

        // Calculate pixel offset based on angles
        const pixelsPerDegreeH = this.canvas.width / fovHorizontal;
        const pixelsPerDegreeV = this.canvas.height / fovVertical;

        // X position based on compass bearing to north
        // When bearingToNorth is 0, star is in center horizontally
        // Positive bearing = star to the right, negative = star to the left
        let angleDiff = bearingToNorth;

        // Normalize angle difference to -180 to 180 range
        if (angleDiff > 180) {
            angleDiff -= 360;
        }

        // Convert angle to screen position
        const xOffset = angleDiff * pixelsPerDegreeH;

        // Y position based on elevation difference
        const yOffset = -elevationDiff * pixelsPerDegreeV;

        // Check if star is visible (within reasonable bounds)
        const visible = Math.abs(angleDiff) < fovHorizontal &&
                       elevationDiff > -fovVertical/2 &&
                       elevationDiff < fovVertical/2;

        return {
            x: centerX + xOffset,
            y: centerY + yOffset,
            visible: visible
        };
    }

    drawStar(x, y) {
        // Clear canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Only draw if star is in view
        const starPos = this.calculateStarPosition();
        if (!starPos.visible) return;

        // Twinkle effect
        if (!this.isMorseBlinking) {
            this.twinklePhase += 0.05;
            const twinkle = Math.sin(this.twinklePhase) * 0.1 + 0.9;
            this.starBrightness = twinkle;
        }

        const brightness = this.starBrightness;

        // Create realistic star glow effect with multiple layers

        // Outer glow - very large and faint
        const outerGlow = this.ctx.createRadialGradient(starPos.x, starPos.y, 0, starPos.x, starPos.y, 100);
        outerGlow.addColorStop(0, `rgba(200, 220, 255, ${0.1 * brightness})`);
        outerGlow.addColorStop(0.3, `rgba(180, 200, 255, ${0.05 * brightness})`);
        outerGlow.addColorStop(1, 'rgba(150, 180, 255, 0)');

        this.ctx.fillStyle = outerGlow;
        this.ctx.fillRect(starPos.x - 100, starPos.y - 100, 200, 200);

        // Mid glow
        const midGlow = this.ctx.createRadialGradient(starPos.x, starPos.y, 0, starPos.x, starPos.y, 40);
        midGlow.addColorStop(0, `rgba(220, 230, 255, ${0.3 * brightness})`);
        midGlow.addColorStop(0.3, `rgba(200, 220, 255, ${0.15 * brightness})`);
        midGlow.addColorStop(1, 'rgba(180, 200, 255, 0)');

        this.ctx.fillStyle = midGlow;
        this.ctx.fillRect(starPos.x - 40, starPos.y - 40, 80, 80);

        // Inner glow
        const innerGlow = this.ctx.createRadialGradient(starPos.x, starPos.y, 0, starPos.x, starPos.y, 15);
        innerGlow.addColorStop(0, `rgba(255, 255, 255, ${0.8 * brightness})`);
        innerGlow.addColorStop(0.2, `rgba(240, 245, 255, ${0.6 * brightness})`);
        innerGlow.addColorStop(0.5, `rgba(220, 230, 255, ${0.3 * brightness})`);
        innerGlow.addColorStop(1, 'rgba(200, 220, 255, 0)');

        this.ctx.fillStyle = innerGlow;
        this.ctx.fillRect(starPos.x - 15, starPos.y - 15, 30, 30);

        // Star core - bright white center
        const core = this.ctx.createRadialGradient(starPos.x, starPos.y, 0, starPos.x, starPos.y, this.starSize);
        core.addColorStop(0, `rgba(255, 255, 255, ${brightness})`);
        core.addColorStop(0.5, `rgba(250, 252, 255, ${0.9 * brightness})`);
        core.addColorStop(1, `rgba(240, 245, 255, ${0.7 * brightness})`);

        this.ctx.fillStyle = core;
        this.ctx.beginPath();
        this.ctx.arc(starPos.x, starPos.y, this.starSize, 0, Math.PI * 2);
        this.ctx.fill();

        // Add diffraction spikes (cross pattern)
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 * brightness})`;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        // Horizontal spike
        this.ctx.moveTo(starPos.x - 30, starPos.y);
        this.ctx.lineTo(starPos.x + 30, starPos.y);
        // Vertical spike
        this.ctx.moveTo(starPos.x, starPos.y - 30);
        this.ctx.lineTo(starPos.x, starPos.y + 30);
        this.ctx.stroke();

        // Faint diagonal spikes
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 * brightness})`;
        this.ctx.beginPath();
        // Diagonal 1
        this.ctx.moveTo(starPos.x - 20, starPos.y - 20);
        this.ctx.lineTo(starPos.x + 20, starPos.y + 20);
        // Diagonal 2
        this.ctx.moveTo(starPos.x + 20, starPos.y - 20);
        this.ctx.lineTo(starPos.x - 20, starPos.y + 20);
        this.ctx.stroke();
    }

    animate() {
        this.drawStar();
        this.animationFrame = requestAnimationFrame(() => this.animate());
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new NorthStarApp();
});