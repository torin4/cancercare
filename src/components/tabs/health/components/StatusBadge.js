/**
 * StatusBadge Component
 * 
 * Reusable badge component for displaying metric status (normal/high/low).
 * Used across LabsSection and VitalsSection for consistent status display.
 */

import React from 'react';
import { DesignTokens, combineClasses } from '../../../../design/designTokens';

export default function StatusBadge({ 
  status, 
  label,
  className = ""
}) {
  // Status can be: { color: 'green'|'yellow'|'red'|'gray', label: string }
  // Or just: 'green'|'yellow'|'red'|'gray'
  
  const statusObj = typeof status === 'object' ? status : { color: status, label };
  const { color, label: statusLabel } = statusObj;

  const statusColors = {
    green: DesignTokens.components.status.normal.text,
    yellow: DesignTokens.components.alert.text.warning,
    red: DesignTokens.components.alert.text.error,
    gray: DesignTokens.colors.neutral.text[700]
  };

  const textColor = statusColors[color] || statusColors.gray;

  return (
    <p className={combineClasses(
      "text-xs font-medium mt-1", 
      textColor,
      className
    )}>
      {statusLabel || label || 'Unknown'}
    </p>
  );
}
