/**
 * FavoriteButton Component
 * 
 * Reusable button component for toggling favorite metrics (labs/vitals).
 * Used across LabsSection and VitalsSection to reduce code duplication.
 */

import React from 'react';
import { Star } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../../../design/designTokens';

export default function FavoriteButton({ 
  isFavorite, 
  onToggle, 
  title = "Toggle favorite",
  size = "small"
}) {
  const iconSize = size === "small" 
    ? DesignTokens.icons.small.size.full 
    : DesignTokens.icons.button.size.full;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={combineClasses(
        "transition-colors", 
        DesignTokens.colors.accent.text[500], 
        DesignTokens.colors.accent.text[600]
      )}
      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Star 
        className={combineClasses(
          iconSize,
          isFavorite 
            ? DesignTokens.components.favorite.filled 
            : DesignTokens.components.favorite.unfilled
        )} 
      />
    </button>
  );
}
