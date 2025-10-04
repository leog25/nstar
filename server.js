const express = require('express');
const path = require('path');
const https = require('https');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Check if SSL certificates exist for HTTPS (needed for iOS device orientation)
const sslPath = path.join(__dirname, 'ssl');
const keyPath = path.join(sslPath, 'key.pem');
const certPath = path.join(sslPath, 'cert.pem');

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    // HTTPS Server (required for device orientation on iOS)
    const options = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
    };

    https.createServer(options, app).listen(443, () => {
        console.log(`HTTPS Server running on https://localhost`);
        console.log(`Access from iOS device using your computer's IP address`);
    });
} else {
    // HTTP Server (for local development)
    app.listen(PORT, () => {
        console.log(`HTTP Server running on http://localhost:${PORT}`);
        console.log('');
        console.log('⚠️  Note: Device orientation requires HTTPS on iOS devices');
        console.log('For iOS testing, either:');
        console.log('1. Use a tunneling service like ngrok: ngrok http 3000');
        console.log('2. Generate SSL certificates and place them in /ssl directory');
        console.log('3. Deploy to a service with HTTPS (Vercel, Netlify, etc.)');
        console.log('');
        console.log('For local testing on desktop, use Arrow keys to look around');
        console.log('Press "G" to toggle orientation grid');
    });
}