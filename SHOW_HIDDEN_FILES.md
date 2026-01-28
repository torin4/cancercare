# How to Show Hidden Files in Finder (macOS)

## Method 1: Keyboard Shortcut (Easiest)

1. Open **Finder**
2. Press: **`Command + Shift + .`** (period)
3. Hidden files will now be visible (they appear dimmed)
4. Press again to hide them

## Method 2: Terminal Command

Open Terminal and run:
```bash
defaults write com.apple.finder AppleShowAllFiles -bool true
killall Finder
```

To hide them again:
```bash
defaults write com.apple.finder AppleShowAllFiles -bool false
killall Finder
```

## Method 3: Open File Directly

You can also open the file directly from Terminal:
```bash
open /Users/joe/CancerCare/.env.production
```

Or navigate to the folder:
```bash
cd /Users/joe/CancerCare
open .
```

Then use **Command + Shift + .** to show hidden files.

## Your Files

Once hidden files are visible, you'll see:
- `.env` - Your local environment file
- `.env.production` - Production-ready file for Vercel upload
- `.env.example` - Example template
- `.gitignore` - Git ignore rules

## Quick Access

The easiest way: **Press `Command + Shift + .` in Finder** - that's it!
