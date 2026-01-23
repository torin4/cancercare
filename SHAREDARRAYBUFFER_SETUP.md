# SharedArrayBuffer Configuration Guide

This document explains how SharedArrayBuffer is configured for zero-copy data transfers in the DICOM viewer.

## What is SharedArrayBuffer?

SharedArrayBuffer enables zero-copy data transfer between Web Workers and the main thread, significantly improving performance for large DICOM datasets (500MB+). Instead of copying data, both threads share the same memory.

## Required HTTP Headers

For SharedArrayBuffer to work, the following headers **must** be set on all responses:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## Configuration Locations

### 1. Development Server (React/Webpack)

**File:** `config-overrides.js`

The webpack dev server is configured to add these headers to all responses, including the main HTML page.

### 2. Proxy Server (Local Development)

**File:** `server/proxy.js`

The Express proxy server adds these headers to all API responses.

### 3. Storage Proxy API

**File:** `api/storage-proxy.js`

The Vercel serverless function adds these headers to storage proxy responses.

### 4. Production Deployment

For production, you **must** configure your web server to add these headers:

#### Vercel
Add to `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        },
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "require-corp"
        }
      ]
    }
  ]
}
```

#### Nginx
Add to your nginx config:
```nginx
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Cross-Origin-Embedder-Policy "require-corp" always;
```

#### Apache
Add to `.htaccess` or Apache config:
```apache
Header always set Cross-Origin-Opener-Policy "same-origin"
Header always set Cross-Origin-Embedder-Policy "require-corp"
```

## Verification

The viewer automatically checks for SharedArrayBuffer support on initialization. Check the browser console for:
- `[Cornerstone3D] SharedArrayBuffer available - zero-copy transfers enabled` ✅
- `[Cornerstone3D] SharedArrayBuffer not available...` ⚠️

## Impact

**With SharedArrayBuffer:**
- 2-3x faster data transfer for large datasets
- Reduced CPU usage
- Smoother UI during loads
- Zero-copy transfers between Workers and main thread

**Without SharedArrayBuffer:**
- Data is copied (structured cloning)
- Higher CPU usage
- Potential UI jank during large loads
- Still functional, but slower

## Browser Support

SharedArrayBuffer is supported in:
- Chrome/Edge 92+
- Firefox 79+
- Safari 15.2+

All modern browsers support it when the required headers are present.

## Troubleshooting

If SharedArrayBuffer is not available:

1. **Check headers are set**: Use browser DevTools → Network tab → Check response headers
2. **Verify all resources use headers**: All HTML, JS, CSS, and API responses need the headers
3. **Check for mixed content**: All resources must be from the same origin or have proper CORS headers
4. **Restart dev server**: After changing `config-overrides.js`, restart the React dev server

## Security Note

These headers provide security benefits beyond SharedArrayBuffer:
- `Cross-Origin-Opener-Policy: same-origin` prevents cross-origin attacks
- `Cross-Origin-Embedder-Policy: require-corp` enforces CORS for embedded resources

These are recommended security headers even if SharedArrayBuffer isn't needed.
