# Quick Start - 5 Minutes to Deploy

## Step 1: Get Your Gemini API Key (1 min)

1. Go to https://makersuite.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key

## Step 2: Run the Deployment Script (2 min)

**On Mac/Linux:**
```bash
./deploy.sh
```

**On Windows:**
```
deploy.bat
```

Choose option 2 (Deploy to Vercel)

## Step 3: Add Your API Key to Vercel (2 min)

1. After deployment, go to vercel.com
2. Click your project → Settings → Environment Variables
3. Add:
   - Name: `GEMINI_API_KEY`
   - Value: [paste your key from Step 1]
4. Run: `vercel --prod`

## Done!

Your app is now live! The URL will be shown in the terminal.

---

## Alternative: Run Locally Only

If you just want to use it on your computer:

1. Run deployment script, choose option 1
2. Open http://localhost:3000

No Vercel needed - your API key stays in `.env` file locally.

---

## Test It Out

Try these messages in the chat:

- "Her BP today was 175/56"
- "CA-125 came back at 70"
- "Weight is 61.5 kg this morning"

The AI will extract and log all values automatically!
