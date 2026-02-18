# Cornerstone3D Architecture Upgrade Plan

## Current Implementation vs. Blueprint

### ✅ What We Have (Good Foundation)
1. **Cornerstone3D Library** - Using v2.x with proper imports
2. **Web Workers** - Configured for parallel decoding (limited to 4 workers)
3. **WebAssembly Codecs** - DICOM image loader uses Wasm codecs
4. **Lazy Series Loading** - Only load series when selected (good for 20+ series)
5. **DICOMDIR-First Parsing** - Fast ZIP parsing like IMAIOS
6. **ArrayBuffer Handling** - Prevents NotReadableError
7. **StackViewport** - Basic 2D scrolling works

### ❌ Critical Gaps (What We're Missing)

#### 1. **VolumeViewport + VoxelManager** (CRITICAL)
**Current:** Using `StackViewport` - loads images one at a time, 2D only
**Blueprint:** Use `VolumeViewport` with `VoxelManager` - virtualized memory, handles 500MB+ files

**Impact:** 
- Can't handle large volumes (will crash on 500MB+)
- No MPR (Multi-Planar Reconstruction) - can't view Axial/Sagittal/Coronal simultaneously
- Memory inefficient - each image loaded separately

#### 2. **StreamingImageVolumeLoader** (CRITICAL)
**Current:** Loading images sequentially via `loadDicomFile()` → `setStack([imageId], 0)`
**Blueprint:** Use `createAndCacheVolume()` with `StreamingImageVolumeLoader`

**Impact:**
- No progressive loading - user waits for all slices
- No interleaved loading - can't show "skeleton" volume quickly
- Sequential bottleneck - slow for large series

#### 3. **Progressive/Interleaved Loading** (HIGH PRIORITY)
**Current:** Load slice 0, then 1, then 2... sequentially
**Blueprint:** Load [0, 10, 20, 30...] first, then backfill [1-9, 11-19...]

**Impact:**
- No "instant" feel - user sees blank screen until first slice loads
- Can't scroll through volume while loading
- Perceived performance is poor

#### 4. **SharedArrayBuffer** (MEDIUM PRIORITY)
**Current:** Using standard ArrayBuffer (copying data from Workers to Main Thread)
**Blueprint:** Use SharedArrayBuffer for zero-copy transfers

**Impact:**
- Slower data transfer (copying 1GB+ for large series)
- Higher CPU usage
- UI jank during large loads

**Requirement:** Need HTTP headers:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

#### 5. **GPU Tier Configuration** (LOW PRIORITY)
**Current:** Default GPU tier detection
**Blueprint:** Force high GPU tier for power users

**Impact:**
- May not use maximum texture sizes
- Lower precision on some devices

#### 6. **Volume Caching** (MEDIUM PRIORITY)
**Current:** No volume-level caching
**Blueprint:** Use Cornerstone3D cache API for volume persistence

**Impact:**
- Re-loads entire series when switching back
- No memory persistence across navigation

## Recommended Upgrade Path

### Phase 1: Switch to VolumeViewport (IMMEDIATE)
**Goal:** Enable 3D volume handling and MPR

**Changes:**
1. Replace `StackViewport` with `VolumeViewport`
2. Use `createAndCacheVolume()` instead of `setStack()`
3. Load all imageIds upfront, create volume container

**Expected Impact:**
- Can handle 500MB+ files without crashing
- Enables MPR views (Axial/Sagittal/Coronal)
- Better memory management via VoxelManager

### Phase 2: Implement Progressive Loading (HIGH PRIORITY)
**Goal:** Achieve "instant" loading feel like IMAIOS

**Changes:**
1. Implement interleaved loading: [0, 10, 20, 30...] first
2. Show "skeleton" volume immediately
3. Backfill remaining slices in background

**Expected Impact:**
- User sees volume in <1 second
- Can scroll while loading
- Perceived performance matches IMAIOS

### Phase 3: Add SharedArrayBuffer (MEDIUM PRIORITY)
**Goal:** Zero-copy data transfer for speed

**Changes:**
1. Configure dev server headers (Vite/Webpack)
2. Configure production server headers (Nginx/Apache)
3. Enable SharedArrayBuffer in Cornerstone3D config

**Expected Impact:**
- 2-3x faster data transfer
- Reduced CPU usage
- Smoother UI during loads

### Phase 4: Advanced Optimizations (FUTURE)
- GPU tier detection and configuration
- Volume caching and persistence
- HTJ2K support (if available)
- WebGPU migration (when ready)

## Implementation Priority

1. **CRITICAL:** Switch to VolumeViewport + VoxelManager
2. **HIGH:** Implement progressive/interleaved loading
3. **MEDIUM:** Add SharedArrayBuffer support
4. **LOW:** GPU tier and caching optimizations

## Current Performance Characteristics

**What Works:**
- ✅ Small series (<100 slices) load reasonably fast
- ✅ Lazy series loading prevents initial memory overload
- ✅ DICOMDIR parsing is fast (like IMAIOS)
- ✅ Basic 2D scrolling works

**What Doesn't Scale:**
- ❌ Large series (500MB+) will likely crash or be very slow
- ❌ No MPR capabilities (can't view 3 planes simultaneously)
- ❌ Sequential loading = slow perceived performance
- ❌ Memory inefficient (no volume-level optimization)

## Next Steps

Should I implement Phase 1 (VolumeViewport + VoxelManager) now? This is the most critical upgrade and will enable handling of 500MB+ files.
