# Vercel Environment Variables Setup

## Current Status

✅ **App is working correctly!** The warnings you see are expected when environment variables aren't set yet.

The app is designed to:
- Load without crashing when Firebase isn't configured
- Show helpful warnings in the console
- Display user-friendly error messages when trying to use Firebase features

## Quick Setup (5 minutes)

### Step 1: Go to Vercel Dashboard
1. Go to https://vercel.com
2. Select your CancerCare project
3. Click **Settings** → **Environment Variables**

### Step 2: Add Firebase Variables

Add these **required** variables:

```
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

**Where to find these values:**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click the gear icon ⚙️ → **Project settings**
4. Scroll to "Your apps" section
5. Click the web app icon `</>` or "Add app" if you haven't created one
6. Copy the values from the `firebaseConfig` object

### Step 3: Add Gemini API Key

```
REACT_APP_GEMINI_API_KEY=your_gemini_api_key
GEMINI_API_KEY=your_gemini_api_key
```

**Get your Gemini API key:**
1. Go to https://makersuite.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key

### Step 4: Optional Variables

These are optional but recommended:

```
REACT_APP_SENTRY_DSN=your_sentry_dsn (for error tracking)
REACT_APP_PROXY_URL=https://your-domain.vercel.app (if using custom proxy)
```

### Step 5: Important Settings

⚠️ **CRITICAL:** For each variable:
- ✅ Select **all environments** (Production, Preview, Development)
- ✅ Click **Save**
- ✅ **Redeploy** your application

### Step 6: Redeploy

After adding all variables:
1. Go to **Deployments** tab
2. Click the **⋯** menu on the latest deployment
3. Click **Redeploy**
4. Or push a new commit to trigger automatic deployment

## Verification

After redeploying, check:
- ✅ No more Firebase warnings in console
- ✅ Login page works
- ✅ Google sign-in works
- ✅ File uploads work
- ✅ Chat works

## Troubleshooting

### Still seeing warnings?
- Make sure you selected **all environments** for each variable
- Make sure you **redeployed** after adding variables
- Check that variable names match exactly (case-sensitive)

### Firebase errors?
- Verify all Firebase variables are set correctly
- Check Firebase Console → Authentication → Sign-in method is enabled
- Ensure Google Sign-In is enabled in Firebase Console

### Need help?
Check the console for specific error messages - they'll tell you which variable is missing.

## Chrome Extension Errors

Those `chrome-extension://` errors are **harmless** and come from browser extensions, not your app. You can safely ignore them or disable the extension if it's annoying.
