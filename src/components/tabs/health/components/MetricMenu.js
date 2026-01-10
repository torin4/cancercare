/**
 * MetricMenu Component
 * 
 * Reusable dropdown menu component for metric actions.
 * Used with MetricMenuButton to provide consistent action menus.
 */

import React from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../../../design/designTokens';

export default function MetricMenu({ 
  isOpen, 
  onClose,
  onAddValue,
  onEdit,
  onDelete,
  deleteLabel = "Delete Metric",
  showAddValue = true,
  showEdit = true,
  showDelete = true
}) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[90]"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onClose();
        }}
      />
      <div className="absolute right-0 top-8 z-[100] bg-white rounded-lg shadow-lg border border-medical-neutral-200 py-1 min-w-[160px]">
        {showAddValue && onAddValue && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onClose();
              onAddValue();
            }}
            className={combineClasses(
              'w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 min-h-[44px] touch-manipulation active:opacity-70', 
              DesignTokens.colors.neutral.text[700], 
              'hover:bg-medical-neutral-100'
            )}
          >
            <Plus className="w-4 h-4" />
            Add Value
          </button>
        )}
        {showEdit && onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onClose();
              onEdit();
            }}
            className={combineClasses(
              'w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 min-h-[44px] touch-manipulation active:opacity-70', 
              DesignTokens.colors.neutral.text[700], 
              'hover:bg-medical-neutral-100'
            )}
          >
            <Edit2 className="w-4 h-4" />
            Edit Metric
          </button>
        )}
        {showDelete && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onClose();
              onDelete();
            }}
            className={combineClasses(
              "w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors min-h-[44px] touch-manipulation active:opacity-70", 
              DesignTokens.components.status.high.text, 
              DesignTokens.components.status.high.bg.replace('bg-', 'hover:bg-')
            )}
          >
            <Trash2 className="w-4 h-4" />
            {deleteLabel}
          </button>
        )}
      </div>
    </>
  );
}
