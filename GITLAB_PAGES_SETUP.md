# GitLab Pages Setup for Privacy Policy

## Current Status

✅ **Privacy Policy Modal** - Works in the app (click "Privacy Policy" on login page)  
✅ **GitLab Pages** - Configured to deploy privacy-policy.html  
⚠️ **Pages URL** - Needs to be enabled in GitLab settings

## How Privacy Policy Works

### In the App (Modal)
- Click "Privacy Policy" link on the login page
- Opens a modal with the full privacy policy
- Content comes from `src/constants/privacyPolicy.js`
- ✅ This should work now

### On GitLab Pages (Standalone HTML)
- Deploys `docs/privacy-policy.html` to GitLab Pages
- Accessible at: `https://torin2582.pages.gitlab.io/cancercare/privacy-policy.html`
- Or: `https://[your-group].pages.gitlab.io/[project-name]/privacy-policy.html`

## Enable GitLab Pages

### Step 1: Check CI/CD Pipeline
1. Go to GitLab → Your Project → **CI/CD** → **Pipelines**
2. Find the latest pipeline for `main` branch
3. Check if the `pages` job ran successfully
4. If it failed, check the logs

### Step 2: Enable Pages in Settings
1. Go to **Settings** → **Pages**
2. If Pages is not enabled:
   - The `pages` job must run successfully first
   - After the job completes, Pages will be available
3. You'll see a URL like: `https://torin2582.pages.gitlab.io/cancercare/`

### Step 3: Access Your Privacy Policy
Once Pages is enabled, your privacy policy will be at:
```
https://torin2582.pages.gitlab.io/cancercare/privacy-policy.html
```

Or check your actual Pages URL in Settings → Pages

## Troubleshooting

### Pages Not Showing?

1. **Check CI/CD Pipeline:**
   - Go to CI/CD → Pipelines
   - Find the `pages` job
   - Check if it completed successfully
   - Look for any errors in the logs

2. **Check GitLab Pages Settings:**
   - Settings → Pages
   - Should show "Your pages are served under: https://..."
   - If not, the `pages` job needs to run first

3. **Manual Trigger (if needed):**
   - Go to CI/CD → Pipelines
   - Click "Run pipeline"
   - Select `main` branch
   - Run the pipeline

4. **Check File Location:**
   - The CI looks for `docs/privacy-policy.html`
   - ✅ This file exists in your repo
   - The CI copies it to `public/` for Pages

### Privacy Policy Modal Not Working?

1. **Check Console:**
   - Open browser DevTools
   - Look for errors when clicking "Privacy Policy"

2. **Verify Import:**
   - The modal imports from `src/constants/privacyPolicy.js`
   - ✅ This file exists and has content

3. **Test Locally:**
   ```bash
   npm start
   # Go to login page
   # Click "Privacy Policy" link
   # Should open modal
   ```

## Files Involved

- **Modal Component:** `src/components/modals/PrivacyPolicyModal.js`
- **Content:** `src/constants/privacyPolicy.js`
- **HTML for Pages:** `docs/privacy-policy.html`
- **CI Config:** `.gitlab-ci.yml`

## Next Steps

1. ✅ CI configuration updated (committed)
2. ⏳ Wait for CI pipeline to run (or trigger manually)
3. ⏳ Check Settings → Pages for your URL
4. ⏳ Test the Pages URL once available

## Quick Test

After Pages is enabled, test the URL:
```bash
# Replace with your actual Pages URL
curl https://torin2582.pages.gitlab.io/cancercare/privacy-policy.html
```

You should see the HTML content.
