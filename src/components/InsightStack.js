/**
 * InsightStack Component
 * 
 * Displays top 3 insights in a single, scannable message.
 * Shows "Show more insights" expandable section if >3 insights exist.
 */

import React, { useState } from 'react';
import { Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { DesignTokens, combineClasses } from '../design/designTokens';
import InsightCard from './InsightCard';

export default function InsightStack({ insights = [], onDiscussWithDoctor }) {
  const [showAll, setShowAll] = useState(false);
  
  if (!insights || insights.length === 0) return null;
  
  const top3 = insights.slice(0, 3);
  const remaining = insights.slice(3);
  const hasMore = remaining.length > 0;
  
  return (
    <div className="flex justify-start mt-2">
      <div className="max-w-[82%] sm:max-w-[70%] w-full">
        <div className={combineClasses(
          'rounded-lg border p-3 sm:p-4 space-y-3',
          'bg-white',
          DesignTokens.colors.neutral.border[200]
        )}>
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
            <h3 className="text-xs sm:text-sm font-semibold text-medical-neutral-900">
              Insights for You
            </h3>
          </div>
          
          <div className="space-y-3">
            {top3.map((insight, index) => (
              <InsightCard
                key={index}
                insight={insight}
                onDiscussWithDoctor={onDiscussWithDoctor}
              />
            ))}
            
            {hasMore && showAll && (
              <div className="space-y-3 pt-2 border-t border-medical-neutral-200">
                {remaining.map((insight, index) => (
                  <InsightCard
                    key={index + 3}
                    insight={insight}
                    onDiscussWithDoctor={onDiscussWithDoctor}
                  />
                ))}
              </div>
            )}
          </div>
          
          {hasMore && (
            <button
              onClick={() => setShowAll(!showAll)}
              className={combineClasses(
                'w-full text-xs flex items-center justify-center gap-1 mt-2 pt-2 border-t transition-colors',
                DesignTokens.colors.neutral.border[200],
                DesignTokens.colors.neutral.text[600],
                'hover:text-medical-neutral-900'
              )}
            >
              {showAll ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  Show fewer insights
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  Show {remaining.length} more insight{remaining.length !== 1 ? 's' : ''}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
