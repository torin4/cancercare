# ZIP Optimization Implementation Plan
## Implementing Research Recommendations for 500MB+ DICOM Archives

## Current State vs. Recommendations

### ❌ What We're NOT Doing (But Should Be)

| Recommendation | Current State | Status |
|---------------|---------------|--------|
| **fflate or zip.js** | Using JSZip | ❌ Not optimal |
| **Custom zipImageLoader** | Using fileManager/wadouri | ❌ No custom loader |
| **Web Workers for ZIP** | Main thread only | ❌ Blocking UI |
| **Transferable Objects** | Not used | ❌ Copying data |
| **Streaming Support** | Not implemented | ❌ Loads entire ZIP |

### ✅ What We ARE Doing

| Feature | Implementation | Status |
|---------|---------------|--------|
| **Metadata Pre-fetching** | DICOMDIR parsing | ✅ Implemented |
| **Cornerstone3D** | VolumeViewport + StreamingImageVolumeLoader | ✅ Implemented |
| **Progressive Loading** | Interleaved slice loading | ✅ Implemented |
| **SharedArrayBuffer** | Headers configured | ✅ Implemented |

---

## Implementation Roadmap

### Phase 1: Replace JSZip with fflate (HIGH PRIORITY)

**Why fflate?**
- **3-5x faster** than JSZip for decompression
- **Smaller bundle size** (~15KB vs ~50KB)
- **Better async support** for large files
- **Transferable Objects** support for zero-copy transfers

**Changes Required:**

1. **Install fflate**
   ```bash
   npm install fflate
   ```

2. **Create fflate-based ZIP service**
   ```javascript
   // src/services/zipViewerServiceFflate.js
   import { unzip } from 'fflate';
   
   export async function prepareZipForViewingFflate(zipFileOrBuffer, onProgress = null) {
     // Use fflate for faster decompression
     // Returns same structure as current zipViewerService
   }
   ```

3. **Update imports**
   - Replace `zipViewerService.js` imports with `zipViewerServiceFflate.js`
   - Keep JSZip as fallback for complex ZIPs

**Expected Impact:**
- 3-5x faster ZIP parsing
- Lower memory footprint
- Better UI responsiveness

---

### Phase 2: Create Custom zipImageLoader (CRITICAL)

**Why Custom Loader?**
- Cornerstone3D doesn't natively support ZIP archives
- Current approach (fileManager) loads all files into memory
- Custom loader enables true on-demand extraction

**Implementation:**

1. **Create zipImageLoader**
   ```javascript
   // src/services/zipImageLoader.js
   import { imageLoader } from '@cornerstonejs/core';
   
   // ImageId format: "zipentry:seriesIndex:fileIndex"
   function parseZipImageId(imageId) {
     const parts = imageId.split(':');
     if (parts[0] !== 'zipentry') return null;
     return {
       seriesIndex: parseInt(parts[1], 10),
       fileIndex: parseInt(parts[2], 10)
     };
   }
   
   async function loadZipImage(imageId) {
     const { seriesIndex, fileIndex } = parseZipImageId(imageId);
     
     // Get ZIP structure (cached)
     const zipStructure = getZipStructure(seriesIndex);
     const doc = zipStructure.files[fileIndex];
     
     // Extract blob on-demand (only when volume loader requests it)
     const blob = await doc.zipEntry.async('blob');
     
     // Use DICOM image loader to decode
     const objectUrl = URL.createObjectURL(blob);
     const dicomImageId = `wadouri:${objectUrl}`;
     
     // Load via DICOM loader
     const image = await imageLoader.loadImage(dicomImageId);
     
     // Cleanup
     URL.revokeObjectURL(objectUrl);
     
     return image;
   }
   
   // Register custom loader
   imageLoader.registerImageLoader('zipentry', loadZipImage);
   ```

2. **Update generateImageIds**
   ```javascript
   // Don't extract blobs - just create lazy imageIds
   const generateImageIds = () => {
     return fileList.map((doc, i) => 
       `zipentry:${selectedSeriesIndex}:${i}`
     );
   };
   ```

**Expected Impact:**
- **Zero upfront blob extraction** - only when volume loader requests
- **True lazy loading** - matches IMAIOS behavior
- **Memory efficient** - blobs extracted on-demand, released immediately

---

### Phase 3: Web Workers with Transferable Objects (HIGH PRIORITY)

**Why Web Workers?**
- ZIP decompression is CPU-intensive
- Blocks main thread (causes UI freezing)
- Can use multiple workers for parallel extraction

**Implementation:**

1. **Create ZIP Worker**
   ```javascript
   // public/workers/zipWorker.js
   self.onmessage = async function(e) {
     const { zipBuffer, fileIndex, seriesIndex } = e.data;
     
     // Decompress specific file from ZIP using fflate
     const { unzip } = await import('https://cdn.jsdelivr.net/npm/fflate@0.7.3/esm/browser.js');
     
     const files = await unzip(new Uint8Array(zipBuffer));
     const fileData = files[fileIndex];
     
     // Transfer ArrayBuffer back (zero-copy)
     self.postMessage({
       fileIndex,
       data: fileData.buffer // Transferable - no copy!
     }, [fileData.buffer]);
   };
   ```

2. **Update zipImageLoader to use Worker**
   ```javascript
   async function loadZipImage(imageId) {
     const { seriesIndex, fileIndex } = parseZipImageId(imageId);
     
     // Get ZIP buffer (cached)
     const zipBuffer = getZipBuffer(seriesIndex);
     
     // Decompress in worker (non-blocking)
     const worker = new Worker('/workers/zipWorker.js');
     const blob = await new Promise((resolve, reject) => {
       worker.onmessage = (e) => {
         const blob = new Blob([e.data.data]);
         worker.terminate();
         resolve(blob);
       };
       worker.onerror = reject;
       worker.postMessage({ zipBuffer, fileIndex, seriesIndex });
     });
     
     // Continue with DICOM loading...
   }
   ```

**Expected Impact:**
- **UI stays responsive** during ZIP extraction
- **Parallel extraction** - multiple files at once
- **Zero-copy transfers** - faster data movement

---

### Phase 4: Streaming Support (MEDIUM PRIORITY)

**Why Streaming?**
- Don't need entire ZIP in memory
- Can start viewing while ZIP is still downloading
- Better for very large archives (1GB+)

**Implementation Options:**

1. **HTTP Range Requests** (if ZIP is on server)
   ```javascript
   // Use zip.js for streaming
   import { ZipReader, BlobReader } from 'https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.6.40/index.js';
   
   async function streamZipFromUrl(url) {
     const reader = new ZipReader(new BlobReader(await fetch(url).then(r => r.blob())));
     const entries = await reader.getEntries();
     // Can read individual entries without loading entire ZIP
   }
   ```

2. **Chunked Reading** (for local files)
   ```javascript
   // Read ZIP in chunks, parse central directory first
   const chunkSize = 1024 * 1024; // 1MB chunks
   const reader = file.stream().getReader();
   // Parse ZIP structure incrementally
   ```

**Expected Impact:**
- **Lower memory usage** - don't load entire ZIP
- **Faster initial load** - start viewing sooner
- **Better for large files** - 1GB+ archives

---

## Migration Strategy

### Step 1: Add fflate (Non-Breaking)
- Install fflate
- Create `zipViewerServiceFflate.js`
- Test alongside JSZip
- Switch when stable

### Step 2: Create Custom Loader (Breaking)
- Implement `zipImageLoader.js`
- Register with Cornerstone3D
- Update `generateImageIds` to use lazy imageIds
- Test with small ZIP first

### Step 3: Add Web Workers (Enhancement)
- Create ZIP worker
- Update loader to use worker
- Test parallel extraction
- Monitor performance

### Step 4: Add Streaming (Future)
- Evaluate if needed (420MB might not need streaming)
- Implement if ZIPs grow larger
- Test with 1GB+ archives

---

## Performance Comparison

### Current (JSZip + fileManager)
- ZIP parsing: **5-10 seconds** (420MB)
- Blob extraction: **ALL upfront** (crashes)
- Memory usage: **1GB+** (crashes)
- UI responsiveness: **Frozen** during load

### Target (fflate + Custom Loader + Workers)
- ZIP parsing: **1-2 seconds** (420MB) ✅ 5x faster
- Blob extraction: **On-demand** (no upfront) ✅ Lazy
- Memory usage: **~500MB peak** ✅ 50% reduction
- UI responsiveness: **Smooth** ✅ Non-blocking

---

## Code Structure

```
src/
├── services/
│   ├── zipViewerService.js (current - JSZip)
│   ├── zipViewerServiceFflate.js (new - fflate)
│   └── zipImageLoader.js (new - custom Cornerstone loader)
├── workers/
│   └── zipWorker.js (new - Web Worker for extraction)
└── components/
    └── Cornerstone3DViewer.js (update to use custom loader)
```

---

## Testing Plan

1. **Small ZIP (50MB)**
   - Verify custom loader works
   - Check memory usage
   - Test series switching

2. **Medium ZIP (200MB)**
   - Test with Web Workers
   - Monitor CPU usage
   - Verify UI responsiveness

3. **Large ZIP (420MB)**
   - Full performance test
   - Compare to IMAIOS (20-30s target)
   - Memory profiling
   - CPU profiling

4. **Very Large ZIP (1GB+)**
   - Test streaming support
   - Verify no crashes
   - Check memory limits

---

## Dependencies to Add

```json
{
  "dependencies": {
    "fflate": "^0.7.3"  // Fast ZIP decompression
  }
}
```

**Optional (for streaming):**
```json
{
  "dependencies": {
    "@zip.js/zip.js": "^2.6.40"  // Streaming ZIP support
  }
}
```

---

## Risk Assessment

| Change | Risk | Mitigation |
|--------|------|------------|
| Replace JSZip | Medium | Keep JSZip as fallback |
| Custom Loader | High | Extensive testing, error handling |
| Web Workers | Low | Well-supported API |
| Streaming | Low | Optional enhancement |

---

## Success Metrics

- ✅ ZIP parsing: <2 seconds (420MB)
- ✅ Volume appears: <5 seconds
- ✅ Memory usage: <600MB peak
- ✅ UI stays responsive: No freezing
- ✅ Load time: 20-30 seconds (matches IMAIOS)

---

## Next Steps

1. **Immediate:** Implement Phase 1 (fflate) - fastest win
2. **This Week:** Implement Phase 2 (Custom Loader) - critical fix
3. **Next Week:** Implement Phase 3 (Web Workers) - performance boost
4. **Future:** Consider Phase 4 (Streaming) if needed
