# CancerCare - AI-Powered Cancer Care Tracking

An intelligent health tracking application for cancer patients, powered by Google's Gemini AI.

## Features

- **AI Chat Assistant**: Natural language tracking of labs, vitals, medications
- **Lab Tracking**: Monitor CA-125, WBC, Hemoglobin, Platelets, and more
- **Vitals Monitoring**: Track BP, heart rate, temperature, weight, O2 sat
- **Medication Management**: Schedule and track medication adherence
- **Symptom Calendar**: Visual symptom tracking over time
- **Document Upload**: Auto-extract values from lab reports and clinical notes
- **Clinical Trials**: Personalized trial matching based on genomic profile

## Prerequisites

- Node.js 16+ installed
- Gemini API key (get free at https://makersuite.google.com/app/apikey)
- Firebase account (free at https://firebase.google.com) - **Required for data persistence**
- Vercel account (free at https://vercel.com)

## Local Development

1. **Install dependencies**
```bash
npm install
```

2. **Set up Firebase** (Required for data storage)
   - Follow the detailed guide in [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)
   - Create a Firebase project and enable Firestore Database
   - Get your Firebase configuration values

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env and add:
# - Your GEMINI_API_KEY
# - Your Firebase configuration (REACT_APP_FIREBASE_*)
```

4. **Install Firebase SDK** (if not already installed)
```bash
npm install firebase
```

5. **Run locally**
```bash
npm start
```

App will open at `http://localhost:3000`

## Deploy to Vercel

### Option 1: Deploy via CLI (Recommended)

1. **Install Vercel CLI**
```bash
npm install -g vercel
```

2. **Deploy**
```bash
vercel
```

3. **Add your API key**
   - Go to your project dashboard on vercel.com
   - Click "Settings" → "Environment Variables"
   - Add: `REACT_APP_GEMINI_API_KEY` = your key (for client-side document processing)
   - Add: `GEMINI_API_KEY` = your key (for serverless functions)
   - Make sure to select all environments (Production, Preview, Development)
   - Redeploy: `vercel --prod` or trigger a new deployment from the dashboard

### Option 2: Deploy via GitHub

1. **Push to GitHub**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/cancercare.git
git push -u origin main
```

2. **Import to Vercel**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Add environment variable: `GEMINI_API_KEY`
   - Deploy!

## Using the App

### Chat Examples

The AI understands natural language. Just talk normally:

```
"Her BP today was 175/56"
→ Logs: Blood Pressure: 175/56 mmHg
→ Alert: "Blood pressure is elevated - consider discussing with Dr. Chen."

"CA-125 came back at 70"
→ Logs: CA-125: 70 U/mL
→ Alert: "CA-125 has increased from last reading - flagged for review."

"She weighs 61.5 kilos this morning"
→ Logs: Weight: 61.5 kg

"Temperature is 99.2"
→ Logs: Temperature: 99.2°F
```

### Document Upload

Upload lab reports, clinic notes, or imaging results:
- AI automatically extracts all values
- Logs to appropriate tracking sections
- Provides intelligent analysis

## Tech Stack

- **Frontend**: React 18, Tailwind CSS (via inline styles), Lucide Icons
- **AI**: Google Gemini Pro API
- **Database**: Firebase Firestore (for data persistence)
- **Storage**: Firebase Storage (for document uploads)
- **Backend**: Vercel Serverless Functions
- **Deployment**: Vercel

## Project Structure

```
cancercare/
├── api/
│   └── gemini.js          # Serverless function for Gemini API
├── public/
│   └── index.html         # HTML template
├── src/
│   ├── firebase/
│   │   ├── config.js      # Firebase configuration
│   │   ├── collections.js # Firestore collection schemas
│   │   ├── services.js    # Firebase service functions
│   │   ├── hooks.js       # React hooks for Firebase data
│   │   └── initData.js    # Data initialization utilities
│   ├── App.js             # Main React component
│   └── index.js           # React entry point
├── .env.example           # Environment variables template
├── .gitignore             # Git ignore rules
├── package.json           # Dependencies
├── vercel.json            # Vercel configuration
├── FIREBASE_SETUP.md      # Firebase setup guide
└── README.md              # This file
```

## Security Notes

- **Never commit your `.env` file** - it contains your API keys
- API keys are stored securely in Vercel environment variables
- All AI requests go through your serverless function (keeps key server-side)
- No API keys are exposed to the browser
- Firebase security rules protect your Firestore data (see FIREBASE_SETUP.md)

## Customization

Edit `src/App.js` to customize:
- Patient information
- Tracked lab values
- Medication list
- Genomic profile
- Clinical trial criteria

## Support

For issues or questions:
- Check Vercel deployment logs
- Verify GEMINI_API_KEY is set correctly
- Ensure API key has sufficient quota

## License

Personal use only. Not for commercial distribution.
