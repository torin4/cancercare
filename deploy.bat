@echo off
echo.
echo CancerCare - Deployment Setup
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Node.js is not installed. Please install Node.js 16+ first.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js detected
echo.

REM Install dependencies
echo Installing dependencies...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo Failed to install dependencies
    pause
    exit /b 1
)

echo Dependencies installed
echo.

REM Check for .env file
if not exist .env (
    echo No .env file found
    echo.
    echo Creating .env file from template...
    copy .env.example .env
    echo.
    echo IMPORTANT: Edit .env and add your Gemini API key!
    echo Get your key at: https://makersuite.google.com/app/apikey
    echo.
    pause
)

echo.
echo Choose deployment option:
echo.
echo 1) Run locally (http://localhost:3000)
echo 2) Deploy to Vercel
echo.
set /p choice="Enter choice (1 or 2): "

if "%choice%"=="1" (
    echo.
    echo Starting local development server...
    call npm start
) else if "%choice%"=="2" (
    echo.
    where vercel >nul 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo Installing Vercel CLI...
        call npm install -g vercel
    )
    
    echo.
    echo Deploying to Vercel...
    echo.
    echo IMPORTANT: After deployment:
    echo   1. Go to your Vercel dashboard
    echo   2. Settings - Environment Variables
    echo   3. Add: GEMINI_API_KEY = your_api_key
    echo   4. Redeploy with: vercel --prod
    echo.
    pause
    call vercel
) else (
    echo Invalid choice
    pause
    exit /b 1
)
