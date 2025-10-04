const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const nonIOSScreen = document.getElementById('non-ios-screen');

if (!isIOS) {
    nonIOSScreen.style.display = 'flex';
    throw new Error('Non-iOS device detected');
}

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const permissionScreen = document.getElementById('permission-screen');
const enableBtn = document.getElementById('enable-btn');
const debugDiv = document.getElementById('debug');
const morseBtn = document.getElementById('morse-btn');
const morseInput = document.getElementById('morse-input');
const morseText = document.getElementById('morse-text');
const sendMorseBtn = document.getElementById('send-morse');
const cancelMorseBtn = document.getElementById('cancel-morse');

const POLARIS_RA = 37.95456067;
const POLARIS_DEC = 89.264109;

let deviceOrientation = {
    alpha: 0,
    beta: 0,
    gamma: 0
};

let locationData = {
    latitude: null,
    longitude: null
};

let starOpacity = 1.0;
let starPulse = 0;
let isMorseBlinking = false;
let morseQueue = [];

const DOT_DURATION = 200;
const DASH_DURATION = 600;
const SYMBOL_GAP = 200;
const LETTER_GAP = 600;
const WORD_GAP = 1400;

const MORSE_CODE = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
    'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
    'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
    'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
    'Y': '-.--', 'Z': '--..', '1': '.----', '2': '..---', '3': '...--',
    '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..',
    '9': '----.', '0': '-----', ' ': ' '
};

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

enableBtn.addEventListener('click', async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission === 'granted') {
                initSensors();
                permissionScreen.classList.add('hidden');
            }
        } catch (error) {
            alert('Permission denied: ' + error.message);
        }
    } else {
        initSensors();
        permissionScreen.classList.add('hidden');
    }
});

function initSensors() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                locationData.latitude = position.coords.latitude;
                locationData.longitude = position.coords.longitude;
            },
            (error) => {
                console.warn('Location access denied, using default location');
                locationData.latitude = 40.7128;
                locationData.longitude = -74.0060;
            }
        );
    }

    window.addEventListener('deviceorientation', handleOrientation, true);

    animate();
}

function handleOrientation(event) {
    deviceOrientation.alpha = event.alpha || 0;
    deviceOrientation.beta = event.beta || 0;
    deviceOrientation.gamma = event.gamma || 0;
}

function calculateStarPosition() {
    if (locationData.latitude === null) {
        return null;
    }

    const now = new Date();
    const lst = calculateLocalSiderealTime(now, locationData.longitude);

    const polarisHA = lst - (POLARIS_RA / 15.0);

    const lat = locationData.latitude * Math.PI / 180;
    const dec = POLARIS_DEC * Math.PI / 180;
    const ha = polarisHA * 15 * Math.PI / 180;

    const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
    const altitude = Math.asin(sinAlt) * 180 / Math.PI;

    const cosAz = (Math.sin(dec) - Math.sin(lat) * sinAlt) / (Math.cos(lat) * Math.cos(Math.asin(sinAlt)));
    let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180 / Math.PI;

    if (Math.sin(ha) > 0) {
        azimuth = 360 - azimuth;
    }

    return { altitude, azimuth };
}

function calculateLocalSiderealTime(date, longitude) {
    const J2000 = new Date('2000-01-01T12:00:00Z');
    const daysSinceJ2000 = (date - J2000) / (1000 * 60 * 60 * 24);

    const GMST = 18.697374558 + 24.06570982441908 * daysSinceJ2000;

    const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    const hoursSinceJ2000 = hours * 1.00273790935;

    const LST = (GMST + hoursSinceJ2000 + longitude / 15) % 24;

    return LST < 0 ? LST + 24 : LST;
}

function getScreenPosition(altitude, azimuth) {
    const compassHeading = deviceOrientation.alpha;
    const tilt = deviceOrientation.beta;

    let relativeAzimuth = azimuth - compassHeading;

    if (relativeAzimuth > 180) relativeAzimuth -= 360;
    if (relativeAzimuth < -180) relativeAzimuth += 360;

    const relativeAltitude = altitude - (90 - tilt);

    const fov = 60;
    if (Math.abs(relativeAzimuth) > fov / 2 || Math.abs(relativeAltitude) > fov / 2) {
        return null;
    }

    const x = canvas.width / 2 + (relativeAzimuth / fov) * canvas.width;
    const y = canvas.height / 2 - (relativeAltitude / fov) * canvas.height;

    return { x, y };
}

function drawStar(x, y, opacity) {
    const baseSize = 3;
    const glowSize = 40;

    ctx.save();

    const gradient1 = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
    gradient1.addColorStop(0, `rgba(255, 255, 255, ${0.3 * opacity})`);
    gradient1.addColorStop(0.2, `rgba(200, 220, 255, ${0.15 * opacity})`);
    gradient1.addColorStop(0.5, `rgba(150, 180, 255, ${0.05 * opacity})`);
    gradient1.addColorStop(1, 'rgba(100, 150, 255, 0)');

    ctx.fillStyle = gradient1;
    ctx.fillRect(x - glowSize, y - glowSize, glowSize * 2, glowSize * 2);

    const gradient2 = ctx.createRadialGradient(x, y, 0, x, y, glowSize / 2);
    gradient2.addColorStop(0, `rgba(255, 255, 255, ${0.6 * opacity})`);
    gradient2.addColorStop(0.3, `rgba(230, 240, 255, ${0.3 * opacity})`);
    gradient2.addColorStop(1, 'rgba(200, 220, 255, 0)');

    ctx.fillStyle = gradient2;
    ctx.fillRect(x - glowSize / 2, y - glowSize / 2, glowSize, glowSize);

    const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, baseSize * 3);
    coreGradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
    coreGradient.addColorStop(0.5, `rgba(240, 245, 255, ${0.8 * opacity})`);
    coreGradient.addColorStop(1, `rgba(220, 230, 255, ${0.3 * opacity})`);

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(x, y, baseSize * 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.beginPath();
    ctx.arc(x, y, baseSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * opacity})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2 + starPulse;
        const rayLength = 15 + Math.sin(starPulse * 2) * 3;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * baseSize, y + Math.sin(angle) * baseSize);
        ctx.lineTo(x + Math.cos(angle) * rayLength, y + Math.sin(angle) * rayLength);
        ctx.stroke();
    }

    ctx.restore();
}

function textToMorse(text) {
    return text.toUpperCase().split('').map(char => MORSE_CODE[char] || '').join(' ');
}

function startMorseCode(text) {
    const morse = textToMorse(text);
    morseQueue = [];

    for (let char of morse) {
        if (char === '.') {
            morseQueue.push({ type: 'on', duration: DOT_DURATION });
            morseQueue.push({ type: 'off', duration: SYMBOL_GAP });
        } else if (char === '-') {
            morseQueue.push({ type: 'on', duration: DASH_DURATION });
            morseQueue.push({ type: 'off', duration: SYMBOL_GAP });
        } else if (char === ' ') {
            morseQueue.push({ type: 'off', duration: LETTER_GAP });
        }
    }

    isMorseBlinking = true;
    processMorseQueue();
}

function processMorseQueue() {
    if (morseQueue.length === 0) {
        isMorseBlinking = false;
        starOpacity = 1.0;
        return;
    }

    const signal = morseQueue.shift();
    starOpacity = signal.type === 'on' ? 1.0 : 0.0;

    setTimeout(() => processMorseQueue(), signal.duration);
}

function animate() {
    requestAnimationFrame(animate);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!isMorseBlinking) {
        starPulse += 0.02;
        starOpacity = 0.9 + Math.sin(starPulse) * 0.1;
    }

    const starPos = calculateStarPosition();
    if (starPos) {
        const screenPos = getScreenPosition(starPos.altitude, starPos.azimuth);

        if (screenPos) {
            drawStar(screenPos.x, screenPos.y, starOpacity);
        }

        debugDiv.innerHTML = `
            Latitude: ${locationData.latitude?.toFixed(4) || 'N/A'}<br>
            Longitude: ${locationData.longitude?.toFixed(4) || 'N/A'}<br>
            Compass: ${deviceOrientation.alpha.toFixed(1)}°<br>
            Tilt: ${deviceOrientation.beta.toFixed(1)}°<br>
            Roll: ${deviceOrientation.gamma.toFixed(1)}°<br>
            Star Alt: ${starPos.altitude.toFixed(1)}°<br>
            Star Az: ${starPos.azimuth.toFixed(1)}°<br>
            ${screenPos ? 'Star visible' : 'Star not in view'}
        `;
    }
}

morseBtn.addEventListener('click', () => {
    morseInput.classList.add('visible');
});

cancelMorseBtn.addEventListener('click', () => {
    morseInput.classList.remove('visible');
});

sendMorseBtn.addEventListener('click', () => {
    const text = morseText.value.trim();
    if (text) {
        startMorseCode(text);
        morseInput.classList.remove('visible');
        morseText.value = '';
    }
});
