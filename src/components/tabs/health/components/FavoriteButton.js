/**
 * FavoriteButton Component
 *
 * Reusable button for pinning/unpinning key metrics (labs/vitals).
 * Used across LabsSection and VitalsSection to reduce code duplication.
 */

import React from 'react';
import { Star } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../../../design/designTokens';

export default function FavoriteButton({ 
  isFavorite, 
  onToggle, 
  title = "Pin to key metrics",
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
      title={isFavorite ? "Unpin from key metrics" : "Pin to key metrics"}
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
