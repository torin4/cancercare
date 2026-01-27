# How to Upload .env File to Vercel

## Option 1: Upload .env File (Easiest)

### Step 1: Prepare Your .env File
I've created `.env.production` with your values. You can use this file or your existing `.env` file.

**Important:** Remove or comment out:
- `REACT_APP_PROXY_URL=http://localhost:4000` (won't work in production)
- `REACT_APP_PROCESSOR_DEBUG=true` (debug mode, not needed in production)

### Step 2: Upload to Vercel

1. Go to **Vercel Dashboard** → Your Project
2. Click **Settings** → **Environment Variables**
3. Scroll down to find **"Upload .env file"** or **"Import from .env"** button
4. Click the button
5. Select your `.env.production` file (or `.env` file)
6. Choose which environments to apply to:
   - ✅ **Production**
   - ✅ **Preview** 
   - ✅ **Development** (optional)
7. Click **Upload** or **Save**

### Step 3: Verify Variables Were Added

After uploading, you should see all variables listed:
- ✅ REACT_APP_FIREBASE_API_KEY
- ✅ REACT_APP_FIREBASE_AUTH_DOMAIN
- ✅ REACT_APP_FIREBASE_PROJECT_ID
- ✅ REACT_APP_FIREBASE_STORAGE_BUCKET
- ✅ REACT_APP_FIREBASE_MESSAGING_SENDER_ID
- ✅ REACT_APP_FIREBASE_APP_ID
- ✅ REACT_APP_GEMINI_API_KEY
- ✅ GEMINI_API_KEY

### Step 4: Redeploy

1. Go to **Deployments** tab
2. Click **⋯** on latest deployment
3. Click **Redeploy**
4. Wait for deployment to complete

## Option 2: Add Variables Manually (If Upload Doesn't Work)

If Vercel doesn't have an upload option, add them one by one:

1. Go to **Settings** → **Environment Variables**
2. Click **Add New**
3. For each variable:
   - **Name:** `REACT_APP_FIREBASE_API_KEY`
   - **Value:** `AIzaSyBUM7vkTz9IyRle-udONeimjjEp20QlG3o`
   - **Environment:** Select all (Production, Preview, Development)
   - Click **Save**
4. Repeat for all variables

## Quick Copy-Paste List

If adding manually, here are your values:

```
REACT_APP_FIREBASE_API_KEY=AIzaSyBUM7vkTz9IyRle-udONeimjjEp20QlG3o
REACT_APP_FIREBASE_AUTH_DOMAIN=cancercare-db3f9.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=cancercare-db3f9
REACT_APP_FIREBASE_STORAGE_BUCKET=cancercare-db3f9.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=953598585294
REACT_APP_FIREBASE_APP_ID=1:953598585294:web:f924b98b59e6e4dd5fa39f
REACT_APP_GEMINI_API_KEY=AIzaSyCwM_B5QstkFZ96r35sjPRRFoCv8hn3D6Y
GEMINI_API_KEY=AIzaSyCwM_B5QstkFZ96r35sjPRRFoCv8hn3D6Y
```

## After Uploading

1. ✅ Check that all variables are listed
2. ✅ Verify they're set for **Production** environment
3. ✅ **Redeploy** your application
4. ✅ Test login - it should work now!

## Troubleshooting

### Variables not showing up?
- Make sure you selected the correct environment (Production)
- Try refreshing the page
- Check that variable names match exactly (case-sensitive)

### Still seeing warnings?
- Make sure you **redeployed** after adding variables
- Check that variables are set for **Production** (not just Preview/Development)

### Login still not working?
- Verify Firebase Authentication is enabled in Firebase Console
- Check that Google Sign-In is enabled (if using Google login)
- Check browser console for specific error messages
