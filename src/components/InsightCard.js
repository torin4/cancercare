/**
 * InsightCard Component
 * 
 * Displays a single insight in an inviting, scannable card format.
 * Color-coded by insight type/importance with progressive disclosure.
 */

import React, { useState } from 'react';
import { 
  TrendingDown, TrendingUp, Link, RefreshCw, Activity, Layers, 
  ChevronDown, ChevronUp, MessageSquare, AlertCircle, Clock
} from 'lucide-react';
import { DesignTokens, combineClasses } from '../design/designTokens';

const INSIGHT_COLORS = {
  'treatment-response': {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-900',
    icon: 'text-green-600',
    iconComponent: TrendingDown
  },
  'concerning': {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
    icon: 'text-amber-700',
    iconComponent: AlertCircle
  },
  'correlation': {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-900',
    icon: 'text-blue-600',
    iconComponent: Link
  },
  'cycle': {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-900',
    icon: 'text-purple-600',
    iconComponent: RefreshCw
  },
  'trend': {
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-900',
    icon: 'text-teal-600',
    iconComponent: Activity
  },
  'cluster': {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
    icon: 'text-amber-700',
    iconComponent: Layers
  },
  'temporal': {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-900',
    icon: 'text-indigo-600',
    iconComponent: Clock
  },
  'general': {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-900',
    icon: 'text-gray-600',
    iconComponent: Activity
  }
};

export default function InsightCard({ insight, onDiscussWithDoctor }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!insight) return null;
  
  const insightType = insight.type || 'general';
  const colors = INSIGHT_COLORS[insightType] || INSIGHT_COLORS.general;
  const IconComponent = colors.iconComponent;
  
  return (
    <div className={combineClasses(
      'rounded-lg border p-3 sm:p-4 transition-all',
      colors.bg,
      colors.border
    )}>
      <div className="flex items-start gap-3">
        <IconComponent className={combineClasses('w-5 h-5 flex-shrink-0 mt-0.5', colors.icon)} />
        <div className="flex-1 min-w-0">
          <h4 className={combineClasses('text-sm font-semibold mb-1', colors.text)}>
            {insight.headline || 'Insight'}
          </h4>
          {/* Only show explanation if it's different from headline */}
          {insight.explanation && 
           insight.explanation !== insight.headline && 
           insight.explanation.trim().toLowerCase() !== (insight.headline || '').trim().toLowerCase() && (
            <p className={combineClasses('text-xs leading-relaxed mb-2', colors.text, 'opacity-90')}>
              {insight.explanation}
            </p>
          )}
          
          {/* Prominently display discussion point if available (clinically validated insights) */}
          {insight.discussionPoint && (
            <div className={combineClasses('text-xs leading-relaxed mb-2 p-2 rounded bg-white/50 border', colors.border)}>
              <p className={combineClasses('font-medium mb-1', colors.text)}>
                💬 What to discuss with your doctor:
              </p>
              <p className={combineClasses('text-xs', colors.text, 'opacity-90')}>
                {insight.discussionPoint}
              </p>
            </div>
          )}
          
          {/* Show details if no discussion point or if details is different */}
          {insight.details && 
           !insight.discussionPoint &&
           insight.details !== insight.headline && 
           insight.details !== insight.explanation &&
           insight.details.trim().toLowerCase() !== (insight.headline || '').trim().toLowerCase() &&
           insight.details.trim().toLowerCase() !== (insight.explanation || '').trim().toLowerCase() && (
            <p className={combineClasses('text-xs leading-relaxed mb-2', colors.text, 'opacity-90')}>
              {insight.details}
            </p>
          )}
          
          {insight.confidence && (
            <p className={combineClasses('text-xs mb-2', colors.text, 'opacity-75')}>
              {insight.confidence}
            </p>
          )}
          
          {/* Check if details contains new information beyond what's already shown */}
          {(() => {
            if (!insight.details) return null;
            
            const headlineLower = (insight.headline || '').trim().toLowerCase();
            const explanationLower = (insight.explanation || '').trim().toLowerCase();
            const discussionPointLower = (insight.discussionPoint || '').trim().toLowerCase();
            const detailsLower = insight.details.trim().toLowerCase();
            
            // Check if details is substantially different from what's already displayed
            const hasNewInfo = 
              detailsLower !== headlineLower &&
              detailsLower !== explanationLower &&
              detailsLower !== discussionPointLower &&
              // Also check if details doesn't just contain the same content
              !detailsLower.includes(headlineLower) &&
              !detailsLower.includes(explanationLower) &&
              !detailsLower.includes(discussionPointLower) &&
              // Make sure details is long enough to be meaningful (at least 20 chars more than what's shown)
              insight.details.length > Math.max(
                (insight.headline || '').length,
                (insight.explanation || '').length,
                (insight.discussionPoint || '').length
              ) + 20;
            
            if (!hasNewInfo) return null;
            
            return (
              <>
                {isExpanded && (
                  <div className={combineClasses('text-xs mt-2 pt-2 border-t', colors.border, colors.text, 'opacity-80')}>
                    {insight.details}
                  </div>
                )}
              </>
            );
          })()}
          
          <div className="flex items-center gap-2 mt-3">
            {/* Only show "Learn more" if details has new information */}
            {(() => {
              if (!insight.details) return null;
              
              const headlineLower = (insight.headline || '').trim().toLowerCase();
              const explanationLower = (insight.explanation || '').trim().toLowerCase();
              const discussionPointLower = (insight.discussionPoint || '').trim().toLowerCase();
              const detailsLower = insight.details.trim().toLowerCase();
              
              const hasNewInfo = 
                detailsLower !== headlineLower &&
                detailsLower !== explanationLower &&
                detailsLower !== discussionPointLower &&
                !detailsLower.includes(headlineLower) &&
                !detailsLower.includes(explanationLower) &&
                !detailsLower.includes(discussionPointLower) &&
                insight.details.length > Math.max(
                  (insight.headline || '').length,
                  (insight.explanation || '').length,
                  (insight.discussionPoint || '').length
                ) + 20;
              
              if (!hasNewInfo) return null;
              
              return (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={combineClasses(
                    'text-xs flex items-center gap-1 transition-colors',
                    colors.text,
                    'opacity-75 hover:opacity-100'
                  )}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-3 h-3" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3" />
                      Learn more
                    </>
                  )}
                </button>
              );
            })()}
            
            {onDiscussWithDoctor && (insight.discussionPoint || insight.doctorQuestions || insight.type !== 'general') && (
              <button
                onClick={() => onDiscussWithDoctor(insight)}
                className={combineClasses(
                  'text-xs flex items-center gap-1 transition-colors ml-auto font-medium',
                  colors.text,
                  'opacity-90 hover:opacity-100 underline'
                )}
              >
                <MessageSquare className="w-3 h-3" />
                Discuss with doctor
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
