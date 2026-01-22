/**
 * Insight Cache Utility Module
 * 
 * Context-aware caching for insights and patterns.
 * Caches insights per context type, allowing free context switching.
 */

/**
 * Simple hash function for context data
 * @param {Object} data - Data to hash
 * @returns {string} - Hash string
 */
function hashContext(data) {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate cache key for insights
 * @param {string} userId - User ID
 * @param {string} contextType - 'health' | 'trial' | 'notebook' | 'none'
 * @param {Object} contextData - Context data (labs, vitals, symptoms, etc.)
 * @param {string} timeWindow - Time window string (e.g., '12months')
 * @returns {string} - Cache key
 */
export function generateCacheKey(userId, contextType, contextData, timeWindow = '12months') {
  // Create hash of context data (counts + last update timestamps)
  const contextHash = hashContext({
    labsCount: contextData.labs?.length || 0,
    vitalsCount: contextData.vitals?.length || 0,
    symptomsCount: contextData.symptoms?.length || 0,
    notesCount: contextData.notes?.length || 0,
    medicationsCount: contextData.medications?.length || 0,
    lastUpdate: Math.max(
      ...(contextData.labs?.map(l => l.updatedAt?.getTime?.() || 0) || [0]),
      ...(contextData.vitals?.map(v => v.updatedAt?.getTime?.() || 0) || [0]),
      ...(contextData.symptoms?.map(s => s.createdAt?.getTime?.() || 0) || [0]),
      ...(contextData.notes?.map(n => n.createdAt?.getTime?.() || 0) || [0]),
      ...(contextData.medications?.map(m => m.createdAt?.getTime?.() || 0) || [0])
    )
  });
  
  return `insights_${userId}_${contextType}_${contextHash}_${timeWindow}`;
}

// In-memory cache storage
const cache = new Map();

// Cache expiration time (5-10 minutes default)
const CACHE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached insights
 * @param {string} cacheKey - Cache key
 * @returns {Object|null} - Cached insights or null if expired/missing
 */
export function getCachedInsights(cacheKey) {
  const cached = cache.get(cacheKey);
  if (!cached) return null;
  
  // Check expiration
  if (Date.now() - cached.timestamp > CACHE_EXPIRATION_MS) {
    cache.delete(cacheKey);
    return null;
  }
  
  return cached.data;
}

/**
 * Set cached insights
 * @param {string} cacheKey - Cache key
 * @param {Object} insights - Insights data to cache
 */
export function setCachedInsights(cacheKey, insights) {
  cache.set(cacheKey, {
    data: insights,
    timestamp: Date.now()
  });
}

/**
 * Clear cache for a specific context
 * @param {string} userId - User ID
 * @param {string} contextType - Context type
 */
export function clearContextCache(userId, contextType) {
  const keysToDelete = [];
  cache.forEach((value, key) => {
    if (key.startsWith(`insights_${userId}_${contextType}_`)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => cache.delete(key));
}

/**
 * Clear all cache for a user
 * @param {string} userId - User ID
 */
export function clearUserCache(userId) {
  const keysToDelete = [];
  cache.forEach((value, key) => {
    if (key.startsWith(`insights_${userId}_`)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => cache.delete(key));
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache() {
  const now = Date.now();
  const keysToDelete = [];
  cache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_EXPIRATION_MS) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => cache.delete(key));
}

// Clean up expired cache every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(clearExpiredCache, 10 * 60 * 1000);
}
