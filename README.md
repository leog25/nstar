# North Star VR Viewer

A WebVR application for iOS devices that uses device motion and orientation sensors to show the location of Polaris (North Star) in a 360-degree black sky environment.

## Features

- Full 360-degree motion tracking using device gyroscope/accelerometer
- iOS motion sensor permission handling
- Minimalist design with black background and bright North Star
- A-Frame WebVR for smooth VR experience
- Works on iOS Safari with proper HTTPS setup

## Local Development

### Running the Server

```bash
npm install
npm start
```

The server will run on `http://localhost:3000`

### Testing on Desktop

- Use Arrow keys to look around
- Press 'G' to toggle orientation grid

## iOS Testing Requirements

**Important:** iOS requires HTTPS for device orientation access.

### Option 1: Using ngrok (Recommended for Quick Testing)

1. Install ngrok: `npm install -g ngrok`
2. Start the local server: `npm start`
3. In another terminal: `ngrok http 3000`
4. Access the HTTPS URL provided by ngrok from your iOS device

### Option 2: Local Network with Self-Signed Certificate

1. Generate SSL certificates:
```bash
mkdir ssl
cd ssl
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes
```

2. The server will automatically use HTTPS if certificates are found
3. Access via `https://[your-computer-ip]` from iOS device
4. Accept the security warning for self-signed certificate

### Option 3: Deploy to HTTPS Service

Deploy to any service that provides HTTPS:
- Vercel: `npx vercel`
- Netlify: Drag and drop the `public` folder
- GitHub Pages with custom domain

## How It Works

1. **Permission Request**: On iOS, the app requests motion sensor permission
2. **Device Orientation**: Uses DeviceOrientationEvent to track device rotation
3. **VR Scene**: A-Frame handles the 3D rendering and camera movement
4. **North Star Position**: Polaris is positioned at celestial coordinates (89.3° declination)

## Technical Details

- **Framework**: A-Frame 1.4.0 for WebVR
- **Coordinate System**: Y-up, -Z forward (A-Frame standard)
- **North Star**: Positioned at near-celestial north pole with glow effect
- **Browser Support**: iOS Safari 13+, Chrome, Firefox with WebXR support

## File Structure

```
nstar/
├── public/
│   ├── index.html    # Main HTML with A-Frame scene
│   ├── app.js        # Device orientation logic
│   └── styles.css    # Minimal styling
├── server.js         # Express server for local development
└── package.json      # Node dependencies
```

## Troubleshooting

### iOS Permission Denied
- Ensure using Safari (not Chrome on iOS)
- Must be served over HTTPS
- Check iOS Settings > Safari > Motion & Orientation Access

### North Star Not Visible
- Point device towards north and look up (~89° elevation)
- The star is bright white with a glow effect

### Desktop Testing
- Use Arrow keys for manual camera control
- Press 'G' to toggle orientation grid for reference

## Future Enhancements

- Add constellation lines for Ursa Major/Minor
- GPS-based magnetic declination correction
- Time-based star position calculation
- Additional celestial objects
- Augmented reality mode with camera passthrough