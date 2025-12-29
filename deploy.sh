#!/bin/bash

echo "🚀 CancerCare - Deployment Setup"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js detected: $(node --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Check for .env file
if [ ! -f .env ]; then
    echo "⚠️  No .env file found"
    echo ""
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and add your Gemini API key!"
    echo "   Get your key at: https://makersuite.google.com/app/apikey"
    echo ""
    read -p "Press Enter after you've added your API key to .env..."
fi

echo ""
echo "🎯 Choose deployment option:"
echo ""
echo "1) Run locally (http://localhost:3000)"
echo "2) Deploy to Vercel"
echo ""
read -p "Enter choice (1 or 2): " choice

case $choice in
    1)
        echo ""
        echo "🚀 Starting local development server..."
        npm start
        ;;
    2)
        echo ""
        if ! command -v vercel &> /dev/null; then
            echo "📥 Installing Vercel CLI..."
            npm install -g vercel
        fi
        
        echo ""
        echo "🚀 Deploying to Vercel..."
        echo ""
        echo "⚠️  IMPORTANT: After deployment:"
        echo "   1. Go to your Vercel dashboard"
        echo "   2. Settings → Environment Variables"
        echo "   3. Add: GEMINI_API_KEY = your_api_key"
        echo "   4. Redeploy with: vercel --prod"
        echo ""
        read -p "Press Enter to continue with deployment..."
        vercel
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac
