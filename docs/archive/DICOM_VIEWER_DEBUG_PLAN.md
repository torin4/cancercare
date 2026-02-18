# DICOM Viewer Debugging & Optimization Plan
## Target: IMAIOS-like Performance (20-30s for 420MB ZIP)

> **See also:** `ZIP_OPTIMIZATION_IMPLEMENTATION.md` for implementing research recommendations (fflate, custom loader, Web Workers)

## 🔴 CRITICAL ISSUES IDENTIFIED

### 1. **Memory Explosion: Extracting ALL Blobs Upfront**
**Location:** `Cornerstone3DViewer.js:157-219` (`generateImageIds`)

**Problem:**
- Extracts ALL blobs from ZIP into memory before creating volume
- For 420MB ZIP with multiple series, this could be 2000+ DICOM files
- Each blob extraction: `zipEntry.async('blob')` creates a new Blob in memory
- All Object URLs created at once: `URL.createObjectURL(blob)`
- **Result:** Browser heap explodes, laptop overheats, app crashes

**Current Code:**
```javascript
for (let i = 0; i < fileList.length; i++) {
  blob = await doc.zipEntry.async('blob'); // ❌ Extracts ALL files
  const file = new File([blob], ...);
  const imageId = fileManager.add(file); // ❌ All in memory
  imageIds.push(imageId);
}
```

**Fix Required:**
- Extract blobs **on-demand** as volume loader requests them
- Use lazy imageId generation - don't create all imageIds upfront
- Only extract priority slices (every 10th) initially

---

### 2. **No True Progressive Loading**
**Location:** `Cornerstone3DViewer.js:244-271` (`createAndLoadVolume`)

**Problem:**
- Sorts imageIds for interleaved loading, BUT...
- All imageIds are already created (all blobs extracted)
- Volume loader receives all imageIds at once
- StreamingImageVolumeLoader can't stream if data is already in memory

**Current Code:**
```javascript
// All imageIds already created with extracted blobs
const sortedImageIds = [...]; // ❌ All blobs already extracted
volume = await volumeLoader.createAndCacheVolume(volumeId, {
  imageIds: sortedImageIds // ❌ All data already in memory
});
```

**Fix Required:**
- Create imageIds lazily - only when volume loader requests them
- Use custom image loader that extracts from ZIP on-demand
- Don't extract blobs until volume loader calls for them

---

### 3. **Object URL Memory Leaks**
**Location:** `Cornerstone3DViewer.js:199` (fallback path)

**Problem:**
- Creating Object URLs for all blobs: `URL.createObjectURL(blob)`
- Object URLs hold references to Blobs in memory
- Not properly revoked when volume is destroyed
- Cleanup only happens on component unmount

**Current Code:**
```javascript
const objectUrl = URL.createObjectURL(blob); // ❌ Never revoked
imageIds.push(`wadouri:${objectUrl}`);
```

**Fix Required:**
- Track all Object URLs created
- Revoke immediately after volume loader consumes them
- Or better: don't use Object URLs, use direct blob references

---

### 4. **File Manager Overhead**
**Location:** `Cornerstone3DViewer.js:193-195`

**Problem:**
- `fileManager.add(file)` for every file creates internal tracking
- Each File object is kept in memory by fileManager
- For 2000+ files, this is massive memory overhead

**Current Code:**
```javascript
const file = new File([blob], `dicom-${i}.dcm`, ...);
const imageId = fileManager.add(file); // ❌ All files tracked in memory
```

**Fix Required:**
- Only use fileManager for files currently being loaded
- Remove files from fileManager after volume loader consumes them
- Or use wadouri: scheme with direct blob extraction

---

### 5. **ZIP Kept Entirely in Memory**
**Location:** `zipViewerService.js:38-455`

**Problem:**
- Entire 420MB ZIP loaded as ArrayBuffer: `await zipFileOrBuffer.arrayBuffer()`
- JSZip instance keeps entire ZIP structure in memory
- All zipEntry objects held in memory
- **Result:** 420MB + decompressed blobs = 1GB+ memory usage

**Current Code:**
```javascript
arrayBuffer = await zipFileOrBuffer.arrayBuffer(); // ❌ 420MB in memory
zip = await JSZip.loadAsync(arrayBuffer); // ❌ Entire ZIP structure
```

**Fix Required:**
- Use streaming ZIP extraction (if possible)
- Or accept that ZIP must be in memory, but optimize blob extraction
- Extract blobs on-demand, don't keep extracted blobs

---

## ✅ SOLUTION ARCHITECTURE

### Phase 1: True Lazy Loading (CRITICAL - Do First)

**Goal:** Extract blobs only when volume loader requests them

**Changes:**

1. **Custom Image Loader for ZIP Files**
   ```javascript
   // Register custom loader for ZIP entries
   imageLoader.registerImageLoader('zipentry', async (imageId) => {
     // imageId format: "zipentry:seriesIndex:fileIndex"
     const [seriesIndex, fileIndex] = parseImageId(imageId);
     const doc = fileList[fileIndex];
     const blob = await doc.zipEntry.async('blob'); // Extract on-demand
     return loadImageFromBlob(blob);
   });
   ```

2. **Lazy ImageId Generation**
   ```javascript
   // Don't extract blobs - just create imageIds that reference ZIP entries
   const generateImageIds = () => {
     return fileList.map((doc, i) => `zipentry:${selectedSeriesIndex}:${i}`);
   };
   ```

3. **Progressive Volume Creation**
   ```javascript
   // Create volume with lazy imageIds
   const imageIds = generateImageIds(); // No blob extraction yet
   const sortedImageIds = sortForInterleavedLoading(imageIds);
   volume = await volumeLoader.createAndCacheVolume(volumeId, {
     imageIds: sortedImageIds // Volume loader will request blobs on-demand
   });
   ```

---

### Phase 2: Optimize Memory Management

**Goal:** Reduce memory footprint during loading

**Changes:**

1. **Limit Concurrent Extractions**
   ```javascript
   const MAX_CONCURRENT_EXTRACTIONS = 5;
   const extractionQueue = [];
   
   async function extractBlobWithLimit(doc) {
     // Wait if too many extractions in progress
     while (extractionQueue.length >= MAX_CONCURRENT_EXTRACTIONS) {
       await Promise.race(extractionQueue);
     }
     // Extract...
   }
   ```

2. **Immediate Blob Cleanup**
   ```javascript
   // After volume loader consumes blob, release it
   imageLoader.loadImage(imageId).then(image => {
     // Blob consumed, can be garbage collected
     // Don't keep blob reference
   });
   ```

3. **Volume Cache Management**
   ```javascript
   // Limit number of volumes in cache
   const MAX_CACHED_VOLUMES = 2;
   if (cache.getVolumes().length > MAX_CACHED_VOLUMES) {
     // Remove oldest volume
     cache.removeVolumeLoadObject(oldestVolumeId);
   }
   ```

---

### Phase 3: Optimize ZIP Handling

**Goal:** Minimize ZIP memory overhead

**Changes:**

1. **Streaming ZIP Parser** (if possible)
   - Use `JSZip.loadAsync` with streaming options
   - Parse DICOMDIR first, then lazy-load file entries

2. **ZIP Entry Caching**
   ```javascript
   // Cache only ZIP structure, not extracted blobs
   const zipStructureCache = new Map(); // seriesIndex -> zipEntries[]
   // Extract blobs on-demand from cached zipEntries
   ```

3. **Memory Monitoring**
   ```javascript
   // Add memory usage logging
   if (performance.memory) {
     console.log('Memory:', {
       used: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1) + 'MB',
       total: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(1) + 'MB'
     });
   }
   ```

---

## 🎯 IMPLEMENTATION PRIORITY

### **IMMEDIATE (Fix Today):**
1. ✅ Implement lazy imageId generation (no blob extraction upfront)
2. ✅ Create custom image loader for ZIP entries
3. ✅ Fix Object URL cleanup
4. ✅ Add memory usage logging

### **HIGH PRIORITY (This Week):**
5. ✅ Limit concurrent blob extractions
6. ✅ Implement proper volume cache management
7. ✅ Add error boundaries and recovery

### **MEDIUM PRIORITY (Next Week):**
8. ✅ Optimize ZIP structure caching
9. ✅ Add memory monitoring dashboard
10. ✅ Implement streaming ZIP parsing (if possible)

---

## 📊 EXPECTED PERFORMANCE

### **Before (Current):**
- Load time: **Crashes/Bricks**
- Memory usage: **1GB+ (crashes)**
- CPU: **100% (overheats)**
- User experience: **Unusable**

### **After (Target):**
- Load time: **20-30 seconds** (matches IMAIOS)
- Memory usage: **~500MB peak** (ZIP + active slices)
- CPU: **50-70% during load**
- User experience: **Smooth, progressive loading**

---

## 🔧 DEBUGGING STEPS

### Step 1: Add Memory Monitoring
```javascript
// Add to Cornerstone3DViewer.js
useEffect(() => {
  const interval = setInterval(() => {
    if (performance.memory) {
      console.log('[Memory]', {
        used: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1) + 'MB',
        total: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(1) + 'MB',
        limit: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(1) + 'MB'
      });
    }
  }, 1000);
  return () => clearInterval(interval);
}, []);
```

### Step 2: Add Blob Extraction Tracking
```javascript
let blobExtractionCount = 0;
let totalBlobSize = 0;

// Track when blobs are extracted
const blob = await doc.zipEntry.async('blob');
blobExtractionCount++;
totalBlobSize += blob.size;
console.log(`[Blob Extraction] ${blobExtractionCount} blobs, ${(totalBlobSize / 1024 / 1024).toFixed(1)}MB`);
```

### Step 3: Profile Volume Loading
```javascript
// Add performance marks
performance.mark('volume-creation-start');
volume = await volumeLoader.createAndCacheVolume(...);
performance.mark('volume-creation-end');
performance.measure('volume-creation', 'volume-creation-start', 'volume-creation-end');
console.log(performance.getEntriesByName('volume-creation'));
```

---

## 🚨 COMMON ERRORS TO WATCH FOR

1. **"Cannot read properties of null"** → Volume not ready when accessing
2. **"Out of memory"** → Too many blobs extracted at once
3. **"Failed to fetch"** → Object URL revoked too early
4. **"No image loader"** → Custom loader not registered
5. **"Volume load timeout"** → Too many imageIds, loader overwhelmed

---

## 📝 TESTING CHECKLIST

- [ ] Load 420MB ZIP with 5+ series
- [ ] Verify only priority slices extracted initially
- [ ] Check memory usage stays under 600MB
- [ ] Verify volume appears in <5 seconds
- [ ] Test series switching (should be fast)
- [ ] Verify no memory leaks on close
- [ ] Test with Chrome DevTools Memory Profiler
- [ ] Verify CPU usage doesn't stay at 100%

---

## 🎓 KEY LEARNINGS FROM IMAIOS

1. **Never extract all files upfront** - Extract on-demand
2. **Use progressive loading** - Show skeleton first
3. **Limit concurrent operations** - Don't overwhelm browser
4. **Clean up immediately** - Don't wait for unmount
5. **Monitor memory actively** - Catch issues early

---

## 📚 REFERENCES

- Cornerstone3D Volume Loading: https://www.cornerstonejs.org/docs/concepts/volumes
- JSZip Streaming: https://stuk.github.io/jszip/documentation/api_jszip/load_async.html
- Memory Management: https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory
- SharedArrayBuffer: See `SHAREDARRAYBUFFER_SETUP.md`
