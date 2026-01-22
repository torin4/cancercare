/**
 * InsightVisualAid Component
 * 
 * Simple, non-intimidating visual representations of patterns.
 * Types: Trend Arrow, Cycle Indicator, Correlation Dot, Mini Sparkline
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Link } from 'lucide-react';
import { DesignTokens, combineClasses } from '../design/designTokens';

export default function InsightVisualAid({ type, data }) {
  if (!type || !data) return null;
  
  switch (type) {
    case 'trend-arrow':
      const direction = data.direction || 'stable';
      const percent = data.percent || 0;
      const ArrowIcon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
      const arrowColor = direction === 'up' ? 'text-red-600' : direction === 'down' ? 'text-green-600' : 'text-gray-600';
      
      return (
        <div className="flex items-center gap-1">
          <ArrowIcon className={combineClasses('w-4 h-4', arrowColor)} />
          {percent !== 0 && (
            <span className={combineClasses('text-xs', arrowColor)}>
              {Math.abs(percent)}%
            </span>
          )}
        </div>
      );
      
    case 'cycle-indicator':
      return (
        <div className="flex items-center gap-1">
          <RefreshCw className="w-4 h-4 text-purple-600" />
          <span className="text-xs text-purple-600">
            ~{data.interval || 0} days
          </span>
        </div>
      );
      
    case 'correlation-dot':
      return (
        <div className="flex items-center gap-1">
          <Link className="w-4 h-4 text-blue-600" />
          <span className="text-xs text-blue-600">
            {data.lag || 0} days
          </span>
        </div>
      );
      
    default:
      return null;
  }
}
