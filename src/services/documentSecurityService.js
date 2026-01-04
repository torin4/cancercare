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
  'text/csv'
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
  '.csv', '.CSV'
];

/**
 * Maximum file size: 10MB
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Minimum file size: 1KB (to prevent empty files)
 */
const MIN_FILE_SIZE = 1024; // 1KB

/**
 * Validate file type by MIME type
 * @param {File} file - The file to validate
 * @returns {boolean} - True if file type is allowed
 */
export const validateFileType = (file) => {
  if (!file || !file.type) {
    return false;
  }
  
  // Check MIME type
  const isValidMimeType = ALLOWED_MIME_TYPES.some(allowedType => {
    // Support wildcard matching for image types
    if (allowedType.endsWith('.*')) {
      const baseType = allowedType.replace('.*', '');
      return file.type.startsWith(baseType);
    }
    return file.type === allowedType;
  });
  
  if (!isValidMimeType) {
    return false;
  }
  
  // Also check file extension as secondary validation
  const fileName = file.name || '';
  const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => 
    fileName.toLowerCase().endsWith(ext.toLowerCase())
  );
  
  return hasValidExtension;
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
 * @returns {{valid: boolean, error?: string}} - Validation result
 */
export const validateFile = (file) => {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }
  
  // Validate file type
  if (!validateFileType(file)) {
    const allowedTypes = ALLOWED_EXTENSIONS.join(', ');
    return { 
      valid: false, 
      error: `File type not allowed. Allowed types: ${allowedTypes}` 
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

