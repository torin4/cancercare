# Document Security Implementation

This document outlines the comprehensive security measures implemented for patient document protection in the CancerCare application.

## Overview

Patient documents are protected through multiple layers of security:
1. **Storage Rules** - Firebase Storage security rules
2. **Firestore Rules** - Database security rules for metadata
3. **File Validation** - Client and server-side validation
4. **Audit Logging** - Complete access trail
5. **Rate Limiting** - Protection against abuse
6. **Secure URLs** - Signed, authenticated download URLs

## Security Features

### 1. Storage Rules (`storage.rules`)

Enhanced Firebase Storage rules provide:

- **User Isolation**: Users can only access files in their own directory (`documents/{userId}/`)
- **File Type Validation**: Only medical document types allowed:
  - PDF files (`application/pdf`)
  - Images (`image/jpeg`, `image/png`, `image/gif`, `image/webp`)
  - Word documents (`application/msword`, `.docx`)
  - Text files (`text/plain`, `text/csv`)
- **File Size Limits**: 
  - Minimum: 1KB (prevents empty files)
  - Maximum: 10MB (prevents abuse)
- **Extension Validation**: Files must have valid medical document extensions
- **Path Validation**: Prevents path traversal attacks

### 2. Firestore Rules (`firestore.rules`)

Enhanced database rules for document metadata:

- **Ownership Verification**: Users can only access documents with their `patientId`
- **Structure Validation**: Documents must have required fields (`patientId`, `fileName`, `fileUrl`, `storagePath`)
- **Immutable Security Fields**: Critical fields (`patientId`, `fileUrl`, `storagePath`) cannot be modified after creation
- **Type Safety**: All fields must be of correct type (strings, timestamps, etc.)

### 3. File Validation (`documentSecurityService.js`)

Client-side and server-side validation:

- **MIME Type Checking**: Validates file content type
- **Extension Validation**: Secondary validation via file extension
- **Size Validation**: Enforces min/max file size limits
- **Filename Sanitization**: Prevents path traversal and dangerous characters
- **Comprehensive Error Messages**: Clear feedback for validation failures

### 4. Audit Logging

All document operations are logged to `documentAccessLogs` collection:

- **Actions Logged**:
  - `upload` - File uploads
  - `download` - File downloads
  - `view` - File URL access
  - `delete` - File deletions
- **Metadata Captured**:
  - User ID
  - Document ID
  - Timestamp
  - File name and size
  - IP address (if available)
  - User agent (if available)

### 5. Rate Limiting

Upload rate limiting prevents abuse:

- **Limit**: 50 uploads per hour per user
- **Implementation**: In-memory tracking (for production, use Redis or similar)
- **Error Handling**: Clear error messages when limit exceeded

### 6. Secure Download URLs

Firebase Storage provides signed URLs that:

- **Require Authentication**: URLs are signed tokens validated by storage rules
- **Automatic Expiration**: URLs expire after a period (managed by Firebase)
- **Access Control**: Only authenticated users matching the file owner can access
- **Proxy Protection**: Storage proxy validates URLs and content types

### 7. Storage Proxy Security (`api/storage-proxy.js`)

Enhanced serverless function for CORS bypass:

- **URL Validation**: Only Firebase Storage URLs allowed
- **Protocol Validation**: Only HTTPS URLs accepted
- **Content Type Validation**: Only medical document types allowed
- **SSRF Protection**: Validates URL format to prevent Server-Side Request Forgery
- **Security Headers**: 
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
- **CORS Control**: Configurable allowed origins via environment variable
- **Redirect Limits**: Maximum 3 redirects to prevent redirect attacks

## File Type Restrictions

### Allowed Types

**Images:**
- JPEG/JPG (`image/jpeg`, `image/jpg`)
- PNG (`image/png`)
- GIF (`image/gif`)
- WebP (`image/webp`)

**Documents:**
- PDF (`application/pdf`)
- Word (`application/msword`, `.doc`, `.docx`)
- Text (`text/plain`, `.txt`)
- CSV (`text/csv`, `.csv`)

### File Size Limits

- **Minimum**: 1KB (prevents empty or corrupted files)
- **Maximum**: 10MB (prevents abuse and ensures reasonable storage usage)

## Access Control

### User Isolation

Each user's documents are stored in a separate directory:
```
documents/{userId}/{filename}
```

Storage rules ensure users can only access their own directory.

### Authentication Required

All operations require:
- Valid Firebase Authentication token
- User ID matching the resource owner
- Proper authorization through security rules

## Audit Trail

All document operations are logged to the `documentAccessLogs` collection:

```javascript
{
  userId: string,
  documentId: string,
  action: 'upload' | 'download' | 'view' | 'delete',
  timestamp: Timestamp,
  fileName: string,
  fileSize: number,
  fileType: string,
  ipAddress: string | null,
  userAgent: string | null
}
```

## HIPAA Compliance Considerations

These security measures support HIPAA compliance:

1. **Access Controls**: Only authorized users can access their own documents
2. **Audit Logs**: Complete trail of all document access
3. **Encryption**: Firebase Storage encrypts data at rest
4. **Transmission Security**: HTTPS for all transfers
5. **Data Integrity**: File validation and checksums
6. **User Authentication**: Required for all operations

## Deployment Checklist

Before deploying to production:

1. ✅ Deploy updated `storage.rules` to Firebase
2. ✅ Deploy updated `firestore.rules` to Firebase
3. ✅ Set `ALLOWED_ORIGINS` environment variable for storage proxy
4. ✅ Configure Firebase Storage CORS settings
5. ✅ Enable audit logging in Firestore
6. ✅ Set up monitoring for `documentAccessLogs` collection
7. ✅ Configure rate limiting service (Redis recommended for production)
8. ✅ Review and test all security rules
9. ✅ Perform security audit

## Testing Security Rules

### Test Storage Rules

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Test storage rules
firebase emulators:start --only storage
```

### Test Firestore Rules

```bash
# Test firestore rules
firebase emulators:start --only firestore
```

## Monitoring

Monitor the following for security:

1. **documentAccessLogs** collection - Review for suspicious activity
2. **Storage usage** - Monitor for unusual upload patterns
3. **Rate limit violations** - Track users hitting limits
4. **Failed authentication attempts** - Monitor for brute force
5. **Error logs** - Review validation failures

## Future Enhancements

Potential additional security measures:

1. **Virus Scanning**: Integrate with cloud antivirus service
2. **Content Analysis**: AI-based content validation
3. **Encryption at Rest**: Client-side encryption before upload
4. **Watermarking**: Add watermarks to sensitive documents
5. **Access Expiration**: Time-based access tokens
6. **IP Whitelisting**: Restrict access by IP address
7. **Multi-Factor Authentication**: Require MFA for sensitive operations
8. **Data Loss Prevention**: Scan for PII/PHI in documents

## Support

For security concerns or questions:
- Review Firebase Security Rules documentation
- Check audit logs in Firestore console
- Monitor Firebase Storage access logs
- Contact security team for incidents

