# Production Testing Checklist

## Pre-Build Checks

- [ ] All environment variables set in `.env` file
- [ ] Dependencies installed (`npm install`)
- [ ] No TypeScript/linting errors
- [ ] Code compiles without errors

## Build Testing

### 1. Production Build
```bash
npm run build
```

**Expected:**
- ✅ Build completes successfully
- ✅ No errors or warnings
- ✅ `build/` directory created
- ✅ Static files generated

**Check:**
- [ ] Build size is reasonable (< 5MB for main bundle)
- [ ] No console errors during build
- [ ] All assets included

### 2. Build Size Analysis
```bash
# After build completes
du -sh build/static/js/*
du -sh build/static/css/*
```

**Expected sizes:**
- Main JS bundle: ~1-3MB (gzipped: ~300-800KB)
- CSS: ~100-500KB
- Total build: < 10MB

## Local Production Server Test

### 1. Serve Production Build
```bash
# Install serve if not already installed
npx serve -s build

# Or use Python
python3 -m http.server 3000 -d build
```

### 2. Test in Browser
Open http://localhost:3000 (or port shown)

**Test Checklist:**
- [ ] App loads without errors
- [ ] No console errors (check browser DevTools)
- [ ] Login works
- [ ] Navigation works
- [ ] All tabs load correctly

### 3. Test Critical Features

#### Authentication
- [ ] Login works
- [ ] Logout works
- [ ] User session persists

#### Dashboard
- [ ] Dashboard loads
- [ ] Charts render correctly
- [ ] Data displays properly

#### Files Tab
- [ ] File list loads
- [ ] Upload button works
- [ ] Document upload modal opens
- [ ] File deletion works

#### Health Tab
- [ ] Labs section loads
- [ ] Vitals section loads
- [ ] Charts display correctly
- [ ] Add lab/vital works

#### Chat Tab
- [ ] Chat interface loads
- [ ] Messages send/receive
- [ ] AI responses work
- [ ] File attachments work

#### Clinical Trials
- [ ] Search works
- [ ] Results display
- [ ] Trial details show

## Error Handling Tests

### 1. Error Boundary
- [ ] Trigger an error (if possible)
- [ ] Error boundary catches it
- [ ] Error UI displays
- [ ] "Try Again" button works

### 2. Network Errors
- [ ] Disconnect internet
- [ ] Try to upload file
- [ ] Error message displays
- [ ] Reconnect and retry works

### 3. Missing Data
- [ ] Test with empty profile
- [ ] Test with no documents
- [ ] Test with no labs/vitals
- [ ] App handles gracefully

## Performance Tests

### 1. Load Time
- [ ] Initial load < 3 seconds
- [ ] Tab switching < 1 second
- [ ] File upload starts immediately

### 2. Memory Usage
- [ ] Open browser DevTools → Performance
- [ ] Record session
- [ ] Check for memory leaks
- [ ] Memory should stabilize

### 3. Bundle Analysis
```bash
# Install analyzer
npm install -g source-map-explorer

# Analyze bundle
npx source-map-explorer 'build/static/js/*.js'
```

**Check for:**
- [ ] No duplicate dependencies
- [ ] Large dependencies justified
- [ ] Code splitting working

## Browser Compatibility

Test in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

## Responsive Design

Test at different screen sizes:
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)
- [ ] Large mobile (414x896)

## Environment Variable Validation

### Test Missing Variables
1. Remove one env var from `.env`
2. Run `npm run build`
3. Should show error or warning

### Test Production Validation
1. Set `NODE_ENV=production`
2. Remove required env var
3. Should throw error

## Sentry Integration Test

### 1. Verify Sentry Initializes
- [ ] Check browser console (should see no errors)
- [ ] Check Network tab for Sentry requests (in production)

### 2. Test Error Reporting
1. Add temporary error in code:
   ```javascript
   // In a component
   useEffect(() => {
     throw new Error('Test error');
   }, []);
   ```
2. Deploy to staging
3. Trigger error
4. Check Sentry dashboard (should see error)

## Security Checks

- [ ] No API keys in code
- [ ] No secrets in build files
- [ ] Environment variables not exposed
- [ ] Firebase rules configured
- [ ] CORS properly set

## Accessibility (Basic)

- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Screen reader friendly (test with VoiceOver/NVDA)
- [ ] Color contrast sufficient
- [ ] Alt text on images

## Final Checklist

Before deploying to production:
- [ ] All tests pass
- [ ] Build successful
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Error tracking configured
- [ ] Environment variables set
- [ ] Documentation updated
