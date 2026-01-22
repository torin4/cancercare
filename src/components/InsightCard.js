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
          {/* Show details if no explanation or if details is different */}
          {insight.details && 
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
          
          {isExpanded && insight.details && (
            <div className={combineClasses('text-xs mt-2 pt-2 border-t', colors.border, colors.text, 'opacity-80')}>
              {insight.details}
            </div>
          )}
          
          <div className="flex items-center gap-2 mt-3">
            {insight.details && (
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
            )}
            
            {onDiscussWithDoctor && (insight.doctorQuestions || insight.type !== 'general') && (
              <button
                onClick={() => onDiscussWithDoctor(insight)}
                className={combineClasses(
                  'text-xs flex items-center gap-1 transition-colors ml-auto',
                  colors.text,
                  'opacity-75 hover:opacity-100 underline'
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
