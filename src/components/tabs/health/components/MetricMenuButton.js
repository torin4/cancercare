/**
 * MetricMenuButton Component
 * 
 * Reusable menu button component for metric cards (labs/vitals).
 * Provides a consistent "more options" menu with actions like Add Value, Edit, Delete.
 */

import React from 'react';
import { MoreVertical } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../../../design/designTokens';

export default function MetricMenuButton({ 
  isOpen, 
  onToggle,
  menuId,
  position = "top-right" // top-right, top-left, bottom-right, bottom-left
}) {
  const positionClasses = {
    'top-right': 'absolute top-2 right-2',
    'top-left': 'absolute top-2 left-2',
    'bottom-right': 'absolute bottom-2 right-2',
    'bottom-left': 'absolute bottom-2 left-2'
  };

  return (
    <div className={positionClasses[position]}>
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onToggle(menuId);
          }}
          className="p-2 text-medical-neutral-500 hover:bg-medical-neutral-100 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:opacity-70"
          title="More options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
