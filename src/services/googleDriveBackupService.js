/**
 * Google Drive Backup Service
 *
 * Uploads CancerCare backup files to the user's Google Drive.
 * Requires REACT_APP_GOOGLE_CLIENT_ID and REACT_APP_GOOGLE_API_KEY in .env
 *
 * Setup: Google Cloud Console → Enable Drive API → Create OAuth Client ID (Web) + API Key
 * Add authorized origins: http://localhost:3000, https://your-domain.com
 */

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file'; // App-created files only (least privilege)

let gapiLoaded = false;
let gisLoaded = false;
let tokenClient = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function ensureGapiLoaded() {
  if (gapiLoaded) return;
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise((resolve) => {
    window.gapi.load('client', resolve);
  });
  await window.gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: [DISCOVERY_DOC]
  });
  gapiLoaded = true;
}

async function ensureGisLoaded() {
  if (gisLoaded) return;
  await loadScript('https://accounts.google.com/gsi/client');
  gisLoaded = true;
}

function getTokenClient() {
  if (!tokenClient) {
    if (!CLIENT_ID) {
      throw new Error('Google Drive backup is not configured. Add REACT_APP_GOOGLE_CLIENT_ID to your .env file.');
    }
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: () => {} // Set per-request
    });
  }
  return tokenClient;
}

/**
 * Request OAuth token from user
 */
function requestAccessToken(prompt = 'consent') {
  return new Promise((resolve, reject) => {
    const client = getTokenClient();
    client.callback = (resp) => {
      if (resp.error) {
        reject(new Error(resp.error.message || 'Google sign-in failed'));
        return;
      }
      // Set token on gapi for API calls
      window.gapi.client.setToken({ access_token: resp.access_token });
      resolve(resp.access_token);
    };
    if (window.gapi.client.getToken() === null) {
      client.requestAccessToken({ prompt });
    } else {
      client.requestAccessToken({ prompt: '' });
    }
  });
}

/**
 * Upload backup to Google Drive (JSON or ZIP)
 * @param {Object|Blob} backupDataOrBlob - Serialized backup object (JSON) or Blob (ZIP with documents)
 * @param {string} filename - Filename for the backup (e.g. CancerCare-backup-2025-01-27.json or .zip)
 * @returns {Promise<{id: string, name: string, webViewLink: string}>}
 */
export async function uploadBackupToDrive(backupDataOrBlob, filename = null) {
  if (!CLIENT_ID || !API_KEY) {
    throw new Error(
      'Google Drive backup is not configured. Add REACT_APP_GOOGLE_CLIENT_ID and REACT_APP_GOOGLE_API_KEY to your .env file. See README for setup instructions.'
    );
  }

  await ensureGapiLoaded();
  await ensureGisLoaded();

  // Get fresh token
  await requestAccessToken('consent');

  const isZip = backupDataOrBlob instanceof Blob;
  const dateStr = new Date().toISOString().slice(0, 10);
  const name = filename || (isZip ? `CancerCare-backup-${dateStr}.zip` : `CancerCare-backup-${dateStr}.json`);
  const mimeType = isZip ? 'application/zip' : 'application/json';

  let fileContent;
  if (isZip) {
    fileContent = await backupDataOrBlob.arrayBuffer();
  } else {
    fileContent = JSON.stringify(backupDataOrBlob, null, 2);
  }

  const metadata = {
    name,
    mimeType,
    description: `CancerCare health data backup - ${new Date().toISOString()}`
  };

  // Drive API multipart/related format: metadata first, then file content
  const boundary = 'CancerCare_backup_' + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const metadataPart = `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  const filePart = `Content-Type: ${mimeType}\r\n\r\n`;
  const body = delimiter + metadataPart + delimiter + filePart;

  // Build multipart body: metadata + binary file
  const encoder = new TextEncoder();
  const metadataBytes = encoder.encode(body);
  const closeBytes = encoder.encode(closeDelim);
  const bodyBlob = new Blob([metadataBytes, fileContent, closeBytes]);

  const token = window.gapi.client.getToken();
  if (!token?.access_token) {
    throw new Error('Failed to get Google access token. Please try again.');
  }

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: bodyBlob
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Upload failed: ${response.status}`);
  }

  const result = await response.json();
  return {
    id: result.id,
    name: result.name,
    webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`
  };
}

/**
 * Check if Google Drive backup is configured
 */
export function isGoogleDriveConfigured() {
  return !!(CLIENT_ID && API_KEY);
}
