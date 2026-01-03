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

## What to Look For

After taking a picture, check the console for these log messages:

1. `[DocumentUploadOnboarding] File input changed` - File was selected
2. `[DocumentUploadOnboarding] Calling onUploadClick` - Upload process started
3. `[FilesTab] onUploadClick called` - Upload handler received file
4. `[FilesTab] Setting upload state to true` - Upload overlay should appear
5. `[FilesTab] Starting to read document` - File processing started

If logs stop at a certain point, that's where the issue is occurring.

## Common Issues

- **Blank screen after camera**: Check if `[FilesTab] Setting upload state to true` appears
- **No file selected**: Check if `[DocumentUploadOnboarding] File input changed` appears
- **Error messages**: Look for `[FilesTab] Error` or `[DocumentUploadOnboarding] Error` logs

