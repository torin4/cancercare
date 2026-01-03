# Mobile Debugging Guide

## Viewing Console Logs on Mobile Devices

### iOS (iPhone/iPad) - Safari Web Inspector

1. **On your iPhone/iPad:**
   - Go to Settings → Safari → Advanced
   - Enable "Web Inspector"

2. **Connect to Mac:**
   - Connect your device to your Mac via USB cable
   - Unlock your device and trust the computer if prompted

3. **On your Mac:**
   - Open Safari
   - Go to Safari → Preferences → Advanced
   - Enable "Show Develop menu in menu bar"
   - Go to Develop → [Your iPhone Name] → [Your Website Name]
   - The Web Inspector will open showing console logs

### Android - Chrome DevTools

1. **On your Android device:**
   - Go to Settings → About phone
   - Tap "Build number" 7 times to enable Developer options
   - Go back to Settings → Developer options
   - Enable "USB debugging"

2. **Connect to computer:**
   - Connect your device to your computer via USB
   - On your device, allow USB debugging when prompted

3. **On your computer:**
   - Open Chrome browser
   - Go to `chrome://inspect`
   - Under "Remote Target", find your device
   - Click "Inspect" next to your website
   - Console logs will appear in the DevTools window

### Alternative: Remote Debugging (No USB Required)

#### For Android:
1. On your phone, open Chrome
2. Go to `chrome://inspect`
3. Enable "Discover USB devices" and "Port forwarding"
4. On your computer, open Chrome and go to `chrome://inspect`
5. You should see your device listed

#### For iOS:
- Requires USB connection (Safari Web Inspector doesn't support wireless debugging)

## Localhost vs Vercel for Debugging

### Using Vercel (Production) ✅ WORKS
- ✅ You CAN debug the Vercel version
- ✅ Access your Vercel URL on phone (e.g., `https://cancercare.vercel.app`)
- ⚠️ **Must deploy latest code first** to see new debug logging
- ⚠️ Phone and computer must be on same network OR use port forwarding
- ✅ Visual debug panel will show on page (bottom-right corner)

### Using Localhost (Recommended for Debugging) ⭐ BEST
- ✅ See changes immediately without deploying
- ✅ Faster iteration - no need to wait for Vercel deployment
- ⚠️ Phone must be on same Wi-Fi network as computer
- ⚠️ Use your computer's local IP address (not `localhost`)

**To find your local IP:**
- Mac: System Settings → Network → Wi-Fi → IP Address (e.g., `192.168.1.5`)
- Windows: `ipconfig` in Command Prompt → IPv4 Address
- Then access: `http://YOUR_IP:3000` on your phone

**Port Forwarding (Alternative):**
1. In Chrome DevTools → `chrome://inspect`
2. Click "Port forwarding..."
3. Add port: `3000` → `localhost:3000`
4. Access `localhost:3000` on your phone (will forward to your computer)

## Visual Debug Panel

A **black debug panel** will appear in the bottom-right corner of your phone screen showing real-time logs. This works even if console isn't accessible!

## What to Look For

After taking a picture, check the console OR the visual debug panel for these log messages:

1. `onUploadClick: [type], hasFile: true` - File was selected
2. `File received: [filename]` - Upload process started
3. `Setting upload overlay to visible` - Upload overlay should appear
4. `Upload overlay should be visible` - Confirmation overlay is showing
5. `Starting document processing` - File processing started

If logs stop at a certain point, that's where the issue is occurring.

## Common Issues

- **Blank screen after camera**: Check if `Setting upload overlay to visible` appears in debug panel
- **No file selected**: Check if `onUploadClick` appears with `hasFile: false`
- **Error messages**: Look for red text in debug panel or `ERROR:` logs
- **Console shows nothing**: Use the visual debug panel instead - it's always visible on the page

