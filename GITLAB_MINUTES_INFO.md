# GitLab CI/CD Compute Minutes Information

## Your Current Situation

**Status:** You've exhausted your monthly compute minutes  
**Free Tier Allowance:** 400 minutes per month  
**Reset Date:** Minutes reset monthly (typically on the 1st of each month)

## When Minutes Reset

- **Monthly Reset:** Compute minutes reset at the beginning of each month
- **Current Date:** January 27, 2026
- **Next Reset:** Likely February 1, 2026 (or based on your account creation date)

## Check Your Usage

1. Go to GitLab → Your Project → **Settings** → **Usage Quotas** → **CI/CD**
2. You'll see:
   - Current month's usage
   - When your minutes reset
   - Remaining minutes (if any)

## Options While Waiting

### Option 1: Wait for Monthly Reset (Recommended)
- Minutes reset automatically each month
- No action needed
- Free and easy

### Option 2: Optimize CI Jobs
- I've added a 5-minute timeout to your Pages job
- This prevents jobs from running too long
- Uses fewer minutes per run

### Option 3: Manual Pages Deployment (If Urgent)
If you need Pages deployed immediately, you can:
1. Build the Pages files locally
2. Use GitLab's web interface to upload artifacts
3. Or use GitLab API to deploy manually

### Option 4: Purchase Additional Minutes
- Go to GitLab → **Settings** → **Usage Quotas** → **CI/CD**
- Click "Purchase additional minutes"
- Minutes are valid for 12 months from purchase
- Unused purchased minutes carry over to next month

## Optimizations Made

I've optimized your `.gitlab-ci.yml` to:
- ✅ Add 5-minute timeout (prevents runaway jobs)
- ✅ Use lightweight Alpine image (faster startup)
- ✅ Minimal script execution (just file copying)

## Tips to Save Minutes

1. **Only run on main branch** (already configured ✅)
2. **Use lightweight images** (Alpine instead of full Linux ✅)
3. **Set timeouts** (prevents stuck jobs ✅)
4. **Cache dependencies** (if you add build steps later)
5. **Combine jobs** (if you add more later)

## Alternative: Skip GitLab Pages

Since your privacy policy is already working in the app modal, you could:
- Remove GitLab Pages deployment entirely
- Save all CI minutes for other uses
- Privacy policy is accessible via the app login page

To disable Pages:
- Comment out the `pages` job in `.gitlab-ci.yml`
- Or remove the file entirely

## Next Steps

1. **Check your reset date:** Settings → Usage Quotas → CI/CD
2. **Wait for reset** (usually just a few days)
3. **Or optimize further** if you need to use CI before reset

Your Pages job is already optimized, so once minutes reset, it should use minimal compute time!
