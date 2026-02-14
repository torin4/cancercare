const axios = require('axios');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.REACT_APP_FIREBASE_PROJECT_ID;
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

/**
 * Parse a single Firestore REST API value wrapper into a plain JS value.
 */
function parseFirestoreValue(wrapped) {
  if (wrapped == null) return null;
  if ('stringValue' in wrapped) return wrapped.stringValue;
  if ('integerValue' in wrapped) return Number(wrapped.integerValue);
  if ('doubleValue' in wrapped) return wrapped.doubleValue;
  if ('booleanValue' in wrapped) return wrapped.booleanValue;
  if ('timestampValue' in wrapped) return wrapped.timestampValue; // ISO string
  if ('nullValue' in wrapped) return null;
  if ('mapValue' in wrapped) {
    const obj = {};
    const fields = wrapped.mapValue.fields || {};
    for (const [key, val] of Object.entries(fields)) {
      obj[key] = parseFirestoreValue(val);
    }
    return obj;
  }
  if ('arrayValue' in wrapped) {
    return (wrapped.arrayValue.values || []).map(parseFirestoreValue);
  }
  return null;
}

/**
 * Parse a Firestore REST document into { id, ...fields }.
 * The document name format is: projects/.../documents/collection/docId
 */
function parseFirestoreDocument(doc) {
  if (!doc || !doc.fields) return null;
  const name = doc.name || '';
  const id = name.split('/').pop();
  const parsed = { id };
  for (const [key, val] of Object.entries(doc.fields)) {
    parsed[key] = parseFirestoreValue(val);
  }
  return parsed;
}

/**
 * Build a Firestore value wrapper from a plain JS value.
 */
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: 'NULL_VALUE' };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  return { stringValue: String(val) };
}

/**
 * Run a structured query against a top-level Firestore collection.
 * @param {string} idToken - User's Firebase ID token for auth
 * @param {Object} structuredQuery - Firestore REST structured query
 * @returns {Promise<Array<Object>>} Parsed documents
 */
async function runQuery(idToken, structuredQuery) {
  const res = await axios.post(
    `${BASE_URL}:runQuery`,
    { structuredQuery },
    { headers: { Authorization: `Bearer ${idToken}` }, timeout: 15000 }
  );
  return (res.data || [])
    .filter(r => r.document)
    .map(r => parseFirestoreDocument(r.document));
}

/**
 * Run a structured query against a subcollection.
 * @param {string} idToken - User's Firebase ID token for auth
 * @param {string} parentPath - e.g., 'labs/abc123'
 * @param {Object} structuredQuery - Firestore REST structured query
 * @returns {Promise<Array<Object>>} Parsed documents
 */
async function runSubcollectionQuery(idToken, parentPath, structuredQuery) {
  const res = await axios.post(
    `${BASE_URL}/${parentPath}:runQuery`,
    { structuredQuery },
    { headers: { Authorization: `Bearer ${idToken}` }, timeout: 15000 }
  );
  return (res.data || [])
    .filter(r => r.document)
    .map(r => parseFirestoreDocument(r.document));
}

module.exports = { runQuery, runSubcollectionQuery, toFirestoreValue, parseFirestoreValue, parseFirestoreDocument };
