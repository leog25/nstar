class NorthStarViewer {
    constructor() {
        this.vrScene = document.getElementById('vr-scene');
        this.camera = document.getElementById('camera');
        this.northStar = document.getElementById('north-star');

        this.hasPermission = false;
        this.isIOS = this.checkIOS();

        this.userLocation = null;
        this.magneticDeclination = 0;
        this.trueHeading = null;
        this.magneticHeading = null;

        this.starPositioned = false;

        this.init();
    }

    init() {
        if (this.isIOS && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            this.showPermissionButton();
        } else {
            this.startTracking();
        }

        this.getUserLocation().then(() => {
            this.updateNorthStarPosition();
        }).catch((error) => {
            console.warn('Could not get location, using default position:', error);
            this.userLocation = { latitude: 40, longitude: 0 };
            this.updateNorthStarPosition();
        });

        this.setupKeyboardControls();
    }

    showPermissionButton() {
        const overlay = document.createElement('div');
        overlay.className = 'overlay';
        overlay.innerHTML = `
            <button class="permission-btn" id="allow-motion-btn">
                N*
            </button>
            <p class="permission-info">
                This app uses your device's motion sensors
            </p>
        `;
        document.body.appendChild(overlay);

        document.getElementById('allow-motion-btn').addEventListener('click', () => {
            this.requestIOSPermission();
            overlay.remove();
        });
    }

    checkIOS() {
        return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    updateNorthStarPosition() {
        if (!this.userLocation) {
            console.warn('No user location available, using default');
            this.userLocation = { latitude: 40, longitude: 0 };
        }

        this.polarisElevation = this.userLocation.latitude;

        console.log(`Polaris elevation for latitude ${this.userLocation.latitude}°: ${this.polarisElevation}°`);

        if (this.trueHeading !== null) {
            this.positionPolarisWithCompass();
        }
    }

    positionPolarisWithCompass() {
        if (this.polarisElevation === undefined || this.trueHeading === null || this.starPositioned) {
            return;
        }

        const distance = 30;

        const azimuth = this.trueHeading;

        const elevRad = (this.polarisElevation * Math.PI) / 180;
        const azimRad = (azimuth * Math.PI) / 180;

        const x = -distance * Math.cos(elevRad) * Math.sin(azimRad);
        const y = distance * Math.sin(elevRad);
        const z = -distance * Math.cos(elevRad) * Math.cos(azimRad);

        this.northStar.setAttribute('position', `${x} ${y} ${z}`);

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
                this.startTracking();
            }
        } catch (error) {
            console.error('Error requesting device orientation permission:', error);
            this.startTracking();
        }
    }

    startTracking() {
        if (window.DeviceOrientationEvent) {
            window.addEventListener('deviceorientation', (event) => {
                this.handleOrientation(event);
            });
        }

        if (window.DeviceMotionEvent) {
            window.addEventListener('devicemotion', (event) => {
                this.handleMotion(event);
            });
        }

        this.vrScene.style.display = 'block';

        console.log('North Star VR Viewer initialized successfully');
    }

    handleOrientation(event) {
        if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
            this.magneticHeading = 360 - event.alpha;

            this.trueHeading = (this.magneticHeading + this.magneticDeclination + 360) % 360;

            const pitch = Math.round(event.beta);
            const roll = Math.round(event.gamma);

            const compass = this.getCompassDirection(this.trueHeading);

            if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
                this.magneticHeading = event.webkitCompassHeading;
                this.trueHeading = (this.magneticHeading + this.magneticDeclination + 360) % 360;

                const accurateCompass = this.getCompassDirection(this.trueHeading);

                if (event.webkitCompassAccuracy !== undefined) {
                    console.log(`Compass accuracy: ±${event.webkitCompassAccuracy}°`);
                }
            }

            if (!this.starPositioned) {
                this.positionPolarisWithCompass();
            }
        }
    }

    getCompassDirection(heading) {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round(heading / 45) % 8;
        return directions[index];
    }

    handleMotion(event) {
        if (event.rotationRate) {
        }
    }

    setupKeyboardControls() {
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
                    case 'g':
                        const grid = document.getElementById('orientation-grid');
                        grid.setAttribute('visible', !grid.getAttribute('visible'));
                        break;
                }

                camera.setAttribute('rotation', rotation);
            }
        });
    }

    showInstructions() {
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

    calculateMagneticDeclination(latitude, longitude) {
        let declination = 0;

        if (longitude >= -130 && longitude <= -70) {
            declination = (longitude + 100) * 0.5 - 10;
        } else if (longitude >= -10 && longitude <= 40) {
            declination = longitude * 0.25;
        } else if (longitude >= 70 && longitude <= 150) {
            declination = (longitude - 110) * 0.3;
        } else {
            declination = longitude * 0.1;
        }

        declination += (latitude - 45) * 0.05;

        return declination;
    }


}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.northStarViewer = new NorthStarViewer();
    });
} else {
    window.northStarViewer = new NorthStarViewer();
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
    });
}