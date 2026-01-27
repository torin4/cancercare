/**
 * Custom Cornerstone3D Image Loader for ZIP Archives
 *
 * Enables true lazy loading - extracts DICOM files from ZIP on-demand
 * only when Cornerstone3D stack viewport requests them.
 *
 * ImageId format: "zipentry:seriesIndex:fileIndex"
 *
 * This prevents memory explosion by not extracting all blobs upfront.
 */

import { imageLoader, metaData } from '@cornerstonejs/core';

// Global cache for ZIP structures (indexed by seriesIndex)
const zipStructureCache = new Map();

// CRITICAL: Single metadata cache for all zipentry: imageIds
// This replaces per-image provider registration which caused memory explosion
const metadataCache = new Map();

// Track if our single metadata provider is registered
let metadataProviderRegistered = false;

/**
 * Register a SINGLE metadata provider for all zipentry: imageIds
 * This is called once during initialization, not per-image
 */
function ensureMetadataProviderRegistered() {
  if (metadataProviderRegistered) return;

  metaData.addProvider((type, imageId) => {
    // Only handle zipentry: imageIds
    if (!imageId || !imageId.startsWith('zipentry:')) {
      return undefined;
    }

    // Return cached metadata for this imageId
    const cached = metadataCache.get(imageId);
    if (cached) {
      return cached;
    }

    return undefined;
  }, 999); // High priority

  metadataProviderRegistered = true;
}

/**
 * Register ZIP structure for a series
 * Called when ZIP is prepared for viewing
 */
export function registerZipStructure(seriesIndex, zipStructure) {
  zipStructureCache.set(seriesIndex, zipStructure);
}

/**
 * Get ZIP structure for a series
 */
function getZipStructure(seriesIndex) {
  const structure = zipStructureCache.get(seriesIndex);
  if (!structure) {
    throw new Error(`ZIP structure not found for series ${seriesIndex}`);
  }
  return structure;
}

/**
 * Parse zipentry imageId
 * Format: "zipentry:seriesIndex:fileIndex"
 */
function parseZipImageId(imageId) {
  if (!imageId || !imageId.startsWith('zipentry:')) {
    return null;
  }
  
  const parts = imageId.split(':');
  if (parts.length !== 3) {
    console.warn(`[zipImageLoader] Invalid imageId format: ${imageId}`);
    return null;
  }
  
  const seriesIndex = parseInt(parts[1], 10);
  const fileIndex = parseInt(parts[2], 10);
  
  if (isNaN(seriesIndex) || isNaN(fileIndex)) {
    console.warn(`[zipImageLoader] Invalid series/file index: ${imageId}`);
    return null;
  }
  
  return { seriesIndex, fileIndex };
}

/**
 * Internal async function to load image from ZIP entry
 */
async function loadZipImageAsync(imageId) {
  const parsed = parseZipImageId(imageId);
  if (!parsed) {
    throw new Error(`Invalid zipentry imageId: ${imageId}`);
  }

  const { seriesIndex, fileIndex } = parsed;

  // Get ZIP structure from cache
  const zipStructure = getZipStructure(seriesIndex);
  const fileList = zipStructure.files || [];

  if (fileIndex < 0 || fileIndex >= fileList.length) {
    throw new Error(`File index ${fileIndex} out of range (${fileList.length} files)`);
  }

  const doc = fileList[fileIndex];
  if (!doc) {
    throw new Error(`File at index ${fileIndex} is null`);
  }

  // Extract blob on-demand (this is the key - only when requested!)
  let blob = null;

  if (doc.getBlob && typeof doc.getBlob === 'function') {
    blob = await doc.getBlob();
  } else if (doc.source === 'zip' && doc.zipEntry) {
    blob = await doc.zipEntry.async('blob');
  } else {
    throw new Error(`No valid blob source for file ${fileIndex}`);
  }

  if (!blob || blob.size === 0) {
    throw new Error(`Blob is empty for file ${fileIndex}`);
  }

  // Create temporary Object URL for DICOM loader
  const objectUrl = URL.createObjectURL(blob);
  const dicomImageId = `wadouri:${objectUrl}`;

  try {
    // Use Cornerstone3D's DICOM image loader to decode the blob
    const image = await imageLoader.loadImage(dicomImageId);

    if (!image) {
      throw new Error('Image loader returned null/undefined');
    }

    // Cache metadata for this imageId
    try {
      const metadataToCache = {
        pixelRepresentation: image.pixelRepresentation,
        bitsAllocated: image.bitsAllocated,
        bitsStored: image.bitsStored,
        samplesPerPixel: image.samplesPerPixel,
        photometricInterpretation: image.photometricInterpretation,
        rows: image.rows,
        columns: image.columns,
        pixelSpacing: image.pixelSpacing,
        sliceThickness: image.sliceThickness,
        imagePositionPatient: image.imagePositionPatient,
        imageOrientationPatient: image.imageOrientationPatient,
        windowCenter: image.windowCenter,
        windowWidth: image.windowWidth,
        rescaleSlope: image.rescaleSlope,
        rescaleIntercept: image.rescaleIntercept,
        ...(image.metadata || {})
      };
      metadataCache.set(imageId, metadataToCache);
    } catch (metaError) {
      console.warn(`[zipImageLoader] Failed to cache metadata:`, metaError);
    }

    // Cleanup Object URL
    URL.revokeObjectURL(objectUrl);

    return image;
  } catch (dicomError) {
    URL.revokeObjectURL(objectUrl);
    throw new Error(`Failed to load DICOM from ZIP entry: ${dicomError.message}`);
  }
}

/**
 * Load image from ZIP entry (on-demand extraction)
 * CRITICAL: Cornerstone3D image loaders must return { promise: Promise<Image> }
 * NOT just return the promise directly!
 */
function loadZipImage(imageId) {
  // Create the promise
  const promise = loadZipImageAsync(imageId);

  // Return object with promise property - this is what Cornerstone3D expects!
  return {
    promise,
    cancelFn: undefined,
    decache: undefined
  };
}

/**
 * Register the custom ZIP image loader with Cornerstone3D
 * Must be called after Cornerstone3D is initialized
 */
export function registerZipImageLoader() {
  try {
    // Register the image loader
    imageLoader.registerImageLoader('zipentry', loadZipImage);

    // Ensure single metadata provider is registered
    ensureMetadataProviderRegistered();

    return true;
  } catch (error) {
    console.error('[zipImageLoader] Failed to register loader:', error);
    return false;
  }
}

/**
 * Unregister the loader (cleanup)
 */
export function unregisterZipImageLoader() {
  try {
    // Clear all caches
    zipStructureCache.clear();
    metadataCache.clear();
  } catch (error) {
    console.error('[zipImageLoader] Error during cleanup:', error);
  }
}

/**
 * Generate lazy imageId for a file
 * This doesn't extract anything - just creates a reference
 */
export function generateZipImageId(seriesIndex, fileIndex) {
  return `zipentry:${seriesIndex}:${fileIndex}`;
}
