/**
 * useDebouncedValue Hook
 * 
 * Custom hook to debounce a value. Useful for search inputs to avoid
 * triggering expensive operations on every keystroke.
 * 
 * @param {*} value - The value to debounce
 * @param {number} delay - The delay in milliseconds (default: 300)
 * @returns {*} The debounced value
 * 
 * @example
 * const [searchQuery, setSearchQuery] = useState('');
 * const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
 * // Use debouncedSearchQuery in filter operations
 */

import { useState, useEffect } from 'react';

export function useDebouncedValue(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Set up the timeout
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup function to cancel the timeout if value changes before delay
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
