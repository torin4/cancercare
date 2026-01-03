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

**IMPORTANT:** `chrome://inspect` is opened on your **COMPUTER**, not your phone!

1. **On your Android device:**
   - Open your app in Chrome (the Vercel URL or localhost) - **Keep Chrome open on your phone!**
   - Go to Settings → About phone
   - Tap "Build number" 7 times to enable Developer options
   - Go back to Settings → Developer options
   - Enable "USB debugging"
   - **Also enable "Stay awake"** (keeps screen on while charging - helpful for debugging)

2. **Connect to computer:**
   - Connect your device to your computer via USB cable
   - **Unlock your phone** (keep it unlocked)
   - On your device, you should see a popup: **"Allow USB debugging?"** - Check "Always allow from this computer" and tap **"Allow"**
   - If no popup appears, try unplugging and replugging the USB cable
   - **Set USB connection mode to "File Transfer" or "MTP"** (not "Charge only")

3. **On your COMPUTER (not phone):**
   - Open Chrome browser on your computer
   - Type `chrome://inspect` in the address bar and press Enter
   - **Make sure "Discover USB devices" checkbox is checked** (top of page)
   - Click the refresh button or wait a few seconds
   - You should see your device listed under "Remote Target"
   - Find your website in the list (e.g., "cancercare.vercel.app" or "192.168.1.9:3000")
   - Click "Inspect" next to your website
   - A new DevTools window will open on your computer showing console logs

**Troubleshooting if device doesn't appear or shows "Pending authentication":**

1. **Revoke USB debugging authorizations (FIRST STEP):**
   - On phone: Settings → Developer options → Scroll down → "Revoke USB debugging authorizations"
   - Tap "OK" to confirm
   - Unplug USB cable completely
   - Wait 5 seconds
   - Plug USB cable back in
   - **Unlock your phone** (keep it unlocked)
   - The popup should appear now - tap "Allow" and check "Always allow from this computer"

2. **Check USB connection mode:**
   - Pull down notification shade on phone
   - Look for "USB" or "Charging this device via USB" notification
   - Tap it and select "File Transfer" or "MTP" (NOT "Charge only" or "PTP")
   - If you don't see this notification, go to Settings → Developer options → "Select USB Configuration" → Choose "File Transfer (MTP)"

3. **Check Developer options settings:**
   - Settings → Developer options
   - Make sure "USB debugging" is ON
   - Also enable "USB debugging (Security settings)" if available
   - Enable "Stay awake" (keeps screen on - helpful)

4. **Try a different USB cable:**
   - Some cables are "charge-only" and don't support data transfer
   - Try the cable that came with your phone

5. **If still no popup:**
   - On phone: Settings → Developer options → "Revoke USB debugging authorizations"
   - On Mac: Close Chrome completely
   - Unplug USB cable
   - Restart your phone
   - After restart, enable USB debugging again
   - Plug in USB cable
   - Open Chrome on Mac and go to `chrome://inspect`
   - The popup should appear on your phone

6. **Alternative: Use Visual Debug Panel (No USB needed!):**
   - The black debug panel in bottom-right corner of your phone screen shows logs
   - This works without any USB debugging setup
   - Just take a picture and watch the debug panel for logs

### Alternative: Remote Debugging (No USB Required)

#### For Android (Wireless Debugging):
**Note:** This requires Android 11+ and both devices on same Wi-Fi network.

1. **On your phone:**
   - Make sure phone and computer are on same Wi-Fi network
   - Open your app in Chrome on phone
   - Go to Settings → Developer options
   - Enable "Wireless debugging" (Android 11+) or "Network debugging" (older)
   
2. **On your COMPUTER (not phone):**
   - Open Chrome browser on your computer
   - Go to `chrome://inspect` (type this in address bar)
   - Enable "Discover network targets" checkbox at the top
   - Your phone should appear in the list automatically
   - Click "Inspect" next to your website
   - Console logs will appear in DevTools on your computer

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

## Using Android Studio to Verify USB Connection

If you have Android Studio installed, you can use it to verify your USB connection:

1. **Open Android Studio** (you don't need to open a project)
2. **Open Device Manager:**
   - Click "More Actions" → "Virtual Device Manager" OR
   - Tools → Device Manager
3. **Check "Physical" tab:**
   - Your phone should appear here if USB connection is working
   - If it shows "Unauthorized", you need to accept the popup on your phone
4. **Use ADB from Android Studio:**
   - Android Studio includes ADB tools
   - You can use Terminal in Android Studio to run: `adb devices`
   - This will show if your device is connected

**Note:** Android Studio won't debug your web app - you still need Chrome DevTools (`chrome://inspect`) for that. But it can help verify the USB connection is working.

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

