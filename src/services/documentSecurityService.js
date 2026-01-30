/**
 * Document Security Service
 * 
 * Provides enhanced security measures for patient documents:
 * - File type validation
 * - File size validation
 * - Content validation
 * - Audit logging
 * - Rate limiting
 */

/**
 * Valid medical document file types (MIME types)
 */
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'application/json',
  'application/dicom',
  'application/x-dicom',
  'application/zip',
  'application/x-zip-compressed'
];

/**
 * Valid file extensions
 */
const ALLOWED_EXTENSIONS = [
  '.pdf', '.PDF',
  '.jpg', '.jpeg', '.JPG', '.JPEG',
  '.png', '.PNG',
  '.gif', '.GIF',
  '.webp', '.WEBP',
  '.doc', '.DOC',
  '.docx', '.DOCX',
  '.txt', '.TXT',
  '.csv', '.CSV',
  '.json', '.JSON',
  '.dcm', '.DCM',
  '.dicom', '.DICOM',
  '.zip', '.ZIP'
];

/**
 * Maximum file size: 500MB (increased for DICOM ZIP files which can be very large)
 * Individual DICOM files are typically 1-50MB, but ZIP archives of multiple scans can be 100-500MB+
 */
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

/**
 * Minimum file size: 1KB (to prevent empty files)
 */
const MIN_FILE_SIZE = 1024; // 1KB

/**
 * Validate file type by MIME type
 * @param {File} file - The file to validate
 * @returns {boolean} - True if file type is allowed
 */
export const validateFileType = async (file) => {
  if (!file) {
    return false;
  }
  
  const fileName = file.name || '';
  const lowerName = fileName.toLowerCase();
  
  // Check file extension first
  const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => 
    lowerName.endsWith(ext.toLowerCase())
  );
  
  // If file has no extension, check if it might be a DICOM file by header
  if (!hasValidExtension && !fileName.includes('.')) {
    try {
      // Check for DICOM signature (128-byte preamble + "DICM")
      const headerSlice = file.slice(0, 132);
      const arrayBuffer = await headerSlice.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      if (uint8Array.length >= 132) {
        const dicomSignature = String.fromCharCode(
          uint8Array[128],
          uint8Array[129],
          uint8Array[130],
          uint8Array[131]
        );
        
        if (dicomSignature === 'DICM') {
          return true; // Valid DICOM file without extension
        }
      }
    } catch (error) {
      // If we can't read header, continue with normal validation
    }
  }
  
  // If file has valid extension, check MIME type
  if (hasValidExtension) {
    // For files with extensions, MIME type check is optional (browsers may not detect it correctly)
    // But if MIME type is provided and doesn't match, that's a problem
    if (file.type) {
      const isValidMimeType = ALLOWED_MIME_TYPES.some(allowedType => {
        // Support wildcard matching for image types
        if (allowedType.endsWith('.*')) {
          const baseType = allowedType.replace('.*', '');
          return file.type.startsWith(baseType);
        }
        return file.type === allowedType;
      });
      
      // If MIME type is provided and doesn't match, reject (unless it's a DICOM file)
      if (!isValidMimeType && !file.type.includes('dicom') && !file.type.includes('octet-stream')) {
        return false;
      }
    }
    
    return true; // Valid extension found
  }
  
  return false;
};

/**
 * Validate file size
 * @param {File} file - The file to validate
 * @returns {{valid: boolean, error?: string}} - Validation result
 */
export const validateFileSize = (file) => {
  if (!file || file.size === undefined) {
    return { valid: false, error: 'Invalid file' };
  }
  
  if (file.size < MIN_FILE_SIZE) {
    return { valid: false, error: `File is too small. Minimum size is ${MIN_FILE_SIZE / 1024}KB` };
  }
  
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  }
  
  return { valid: true };
};

/**
 * Comprehensive file validation
 * @param {File} file - The file to validate
 * @returns {Promise<{valid: boolean, error?: string}>} - Validation result
 */
export const validateFile = async (file) => {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }
  
  // Validate file type (now async to check DICOM headers)
  const isValidType = await validateFileType(file);
  if (!isValidType) {
    // Check if it might be a DICOM file without extension
    const fileName = file.name || '';
    if (!fileName.includes('.')) {
      // File has no extension - might be DICOM, check header
      try {
        const headerSlice = file.slice(0, 132);
        const arrayBuffer = await headerSlice.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        if (uint8Array.length >= 132) {
          const dicomSignature = String.fromCharCode(
            uint8Array[128],
            uint8Array[129],
            uint8Array[130],
            uint8Array[131]
          );
          
          if (dicomSignature === 'DICM') {
            // It's a valid DICOM file without extension - allow it
            const sizeValidation = validateFileSize(file);
            if (!sizeValidation.valid) {
              return sizeValidation;
            }
            return { valid: true };
          }
        }
      } catch (error) {
        // If we can't read header, continue with normal error
      }
    }
    
    const allowedTypes = ALLOWED_EXTENSIONS.join(', ');
    return { 
      valid: false, 
      error: `File type not allowed. Allowed types: ${allowedTypes}, or DICOM files (with or without extension)` 
    };
  }
  
  // Validate file size
  const sizeValidation = validateFileSize(file);
  if (!sizeValidation.valid) {
    return sizeValidation;
  }
  
  return { valid: true };
};

/**
 * Log document access for audit trail
 * @param {string} userId - User ID
 * @param {string} documentId - Document ID
 * @param {string} action - Action performed (upload, download, delete, view)
 * @param {object} metadata - Additional metadata
 */
export const logDocumentAccess = async (userId, documentId, action, metadata = {}) => {
  try {
    // Import Firestore dynamically to avoid circular dependencies
    const { db } = await import('../firebase/config');
    const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
    
    await addDoc(collection(db, 'documentAccessLogs'), {
      userId,
      documentId,
      action, // 'upload', 'download', 'delete', 'view'
      timestamp: serverTimestamp(),
      ipAddress: metadata.ipAddress || null,
      userAgent: metadata.userAgent || null,
      fileSize: metadata.fileSize || null,
      fileName: metadata.fileName || null,
      ...metadata
    });
  } catch (error) {
    // Don't fail the operation if logging fails, but log the error
    console.error('Failed to log document access:', error);
  }
};

/**
 * Check rate limiting for uploads (simple in-memory implementation)
 * For production, use a proper rate limiting service like Redis
 */
const uploadRateLimits = new Map(); // userId -> { count, resetTime }

/**
 * Check if user has exceeded upload rate limit
 * @param {string} userId - User ID
 * @param {number} maxUploads - Maximum uploads per period
 * @param {number} periodMs - Time period in milliseconds (default: 1 hour)
 * @returns {{allowed: boolean, remaining?: number, resetTime?: Date}} - Rate limit check result
 */
export const checkUploadRateLimit = (userId, maxUploads = 50, periodMs = 60 * 60 * 1000) => {
  const now = Date.now();
  const userLimit = uploadRateLimits.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    // Reset or initialize
    uploadRateLimits.set(userId, {
      count: 1,
      resetTime: now + periodMs
    });
    return { allowed: true, remaining: maxUploads - 1, resetTime: new Date(now + periodMs) };
  }
  
  if (userLimit.count >= maxUploads) {
    return { 
      allowed: false, 
      remaining: 0, 
      resetTime: new Date(userLimit.resetTime),
      error: `Upload rate limit exceeded. Maximum ${maxUploads} uploads per hour.`
    };
  }
  
  userLimit.count++;
  return { 
    allowed: true, 
    remaining: maxUploads - userLimit.count, 
    resetTime: new Date(userLimit.resetTime) 
  };
};

/**
 * Sanitize filename to prevent path traversal and other security issues
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
export const sanitizeFilename = (filename) => {
  if (!filename) {
    return 'document';
  }
  
  // Remove path traversal attempts
  let sanitized = filename.replace(/\.\./g, '');
  sanitized = sanitized.replace(/\//g, '_');
  sanitized = sanitized.replace(/\\/g, '_');
  
  // Remove or replace dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*]/g, '_');
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'));
    sanitized = sanitized.substring(0, 255 - ext.length) + ext;
  }
  
  return sanitized || 'document';
};

