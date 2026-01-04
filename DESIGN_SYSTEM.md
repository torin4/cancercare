# Design System Documentation

This document outlines the design tokens and patterns used throughout the CancerCare application to ensure visual consistency.

## Overview

All design values are centralized in `/src/design/designTokens.js`. Use these tokens instead of hardcoded values to maintain consistency.

## Import Usage

```javascript
import { DesignTokens, Layouts, combineClasses } from '../design/designTokens';
```

## Spacing & Sizing

### Container Padding
- **Mobile**: `p-3` (12px)
- **Tablet**: `sm:p-4` (16px)
- **Desktop**: `md:p-6` (24px)
- **Full**: `p-3 sm:p-4 md:p-6`

### Section Spacing (Margin Bottom)
- **Full**: `mb-4 sm:mb-6` (16px mobile, 24px tablet+)

### Gap Spacing
- **Extra Small**: `gap-1` (4px)
- **Small**: `gap-2` (8px)
- **Medium**: `gap-3` (12px)
- **Large**: `gap-4` (16px)
- **Responsive Small**: `gap-2 sm:gap-3`
- **Responsive Medium**: `gap-3 sm:gap-4`

### Icon Container Padding
- **Full**: `p-2 sm:p-2.5` (8px mobile, 10px tablet+)

### Button Padding
- **Mobile**: `px-3 sm:px-4`
- **Desktop**: `px-4 sm:px-6`
- **Icon Only**: `px-3 sm:px-6`

### Card Padding
- **Full**: `p-3 sm:p-4 md:p-5`

### Minimum Touch Target
- **Standard**: `min-h-[44px]` (44px minimum for touch accessibility)

## Colors

### Primary Colors
- **50**: Light background (`bg-medical-primary-50`)
- **100**: Hover states (`bg-medical-primary-100`)
- **200**: Borders (`border-medical-primary-200`)
- **500**: Primary button (`bg-medical-primary-500`)
- **600**: Primary button hover (`bg-medical-primary-600`)
- **700**: Active/pressed states (`bg-medical-primary-700`)

### Accent Colors
- Used for Clinical Trials and special highlights
- Same scale as primary (50-700)

### Neutral Colors
- **50-100**: Backgrounds
- **200-300**: Borders
- **500-700**: Text (secondary)
- **900**: Primary text (`text-medical-neutral-900`)

## Typography

### Heading 1 (Page Headers)
- **Size**: `text-xl sm:text-2xl md:text-3xl`
- **Weight**: `font-bold`
- **Color**: `text-medical-neutral-900`
- **Margin Bottom**: `mb-0.5 sm:mb-1`
- **Complete**: `text-xl sm:text-2xl md:text-3xl font-bold text-medical-neutral-900 mb-0.5 sm:mb-1`

### Heading 2
- **Size**: `text-lg sm:text-xl md:text-2xl`
- **Weight**: `font-semibold`

### Heading 3
- **Size**: `text-sm sm:text-base md:text-lg`
- **Weight**: `font-semibold`
- **Color**: `text-medical-neutral-900`

### Body Text
- **Small**: `text-xs sm:text-sm`
- **Base**: `text-sm sm:text-base`
- **Large**: `text-base sm:text-lg`

## Icons

### Header Icons
- **Size**: `w-5 h-5 sm:w-6 sm:h-6`

### Standard Icons
- **Size**: `w-4 h-4 sm:w-5 sm:h-5`

### Small Icons
- **Size**: `w-3.5 h-3.5 sm:w-4 sm:h-4`

### Button Icons (with text)
- **Size**: `w-4 h-4 sm:w-5 sm:h-5`

## Borders & Radius

### Border Radius
- **Small**: `rounded-lg` (8px)
- **Medium**: `rounded-xl` (12px)
- **Large**: `rounded-2xl` (16px)
- **Full**: `rounded-full` (9999px)

### Border Width
- **Default**: `border` (1px)
- **Thick**: `border-2` (2px)

### Common Border Combinations
- **Card**: `border border-medical-neutral-200`
- **Divider**: `border-b border-medical-neutral-200`
- **Active Tab**: `border-b-2 border-medical-primary-600`

## Shadows

- **Small**: `shadow-sm`
- **Medium**: `shadow`
- **Large**: `shadow-md`
- **Hover**: `hover:shadow-md`

## Common Components

### Header Component
```javascript
// Container
<div className={Layouts.header}>
  {/* Icon Container */}
  <div className={Layouts.headerIcon}>
    <Icon className={DesignTokens.components.header.icon} />
  </div>
  {/* Title */}
  <h1 className={Layouts.headerTitle}>Title</h1>
</div>
```

### Tab Navigation
```javascript
<div className={Layouts.tabsContainer}>
  <button className={combineClasses(
    DesignTokens.components.tabs.button.base,
    isActive 
      ? DesignTokens.components.tabs.button.active
      : DesignTokens.components.tabs.button.inactive
  )}>
    Tab Label
  </button>
</div>
```

### Primary Button
```javascript
<button className={DesignTokens.components.button.primary}>
  Button Text
</button>
```

### Secondary Button (Icon Button)
```javascript
<button className={DesignTokens.components.button.iconButton}>
  <Icon className={DesignTokens.icons.button.size.full} />
  <span className="hidden sm:inline">Button Text</span>
</button>
```

## Breakpoints

- **sm**: 640px
- **md**: 768px
- **lg**: 1024px
- **xl**: 1280px
- **2xl**: 1536px

## Transitions

- **Default**: `transition-colors`
- **All**: `transition-all duration-200`
- **Fast**: `transition-all duration-150`
- **Slow**: `transition-all duration-300`

## Best Practices

1. **Always use tokens** from `designTokens.js` instead of hardcoded values
2. **Use `combineClasses()`** helper to combine multiple class strings
3. **Follow responsive patterns** - mobile first, then tablet (sm:), then desktop (md:)
4. **Maintain touch targets** - minimum 44px height for interactive elements
5. **Use semantic spacing** - prefer spacing tokens over arbitrary values
6. **Consistent icon sizes** - use icon size tokens based on context

## Migration Guide

When updating existing code:

1. Replace hardcoded spacing with tokens
2. Replace hardcoded colors with color tokens
3. Replace hardcoded typography with typography tokens
4. Use component patterns for common UI elements

Example:
```javascript
// Before
<div className="p-3 sm:p-4 md:p-6 mb-4 sm:mb-6">
  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-medical-neutral-900 mb-0.5 sm:mb-1">
    Title
  </h1>
</div>

// After
<div className={combineClasses(Layouts.container, Layouts.section)}>
  <h1 className={Layouts.headerTitle}>Title</h1>
</div>
```

