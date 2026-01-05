# Design System Documentation

This document outlines the design tokens and patterns used throughout the CancerCare application to ensure visual consistency.

## Table of Contents

- [Overview](#overview)
- [Import Usage](#import-usage)
- [Spacing & Sizing](#spacing--sizing)
- [Colors](#colors)
- [Typography](#typography)
- [Icons](#icons)
- [Borders & Radius](#borders--radius)
- [Shadows](#shadows)
- [Common Components](#common-components)
- [Breakpoints](#breakpoints)
- [Transitions](#transitions)
- [Best Practices](#best-practices)
- [Migration Guide](#migration-guide)

## Overview

All design values are centralized in `/src/design/designTokens.js`. Use these tokens instead of hardcoded values to maintain consistency.

**Note**: The design tokens are currently defined and ready to use. The codebase is gradually migrating to use these tokens instead of hardcoded values.

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
- **Token**: `DesignTokens.spacing.container.full` or `Layouts.container`

### Section Spacing (Margin Bottom)
- **Full**: `mb-4 sm:mb-6` (16px mobile, 24px tablet+)
- **Token**: `DesignTokens.spacing.section.full` or `Layouts.section`

### Header Spacing (Margin Bottom)
- **Full**: `mb-4 sm:mb-6` (16px mobile, 24px tablet+)
- **Token**: `DesignTokens.spacing.header.full`

### Gap Spacing
- **Extra Small**: `gap-1` (4px) - `DesignTokens.spacing.gap.xs`
- **Small**: `gap-2` (8px) - `DesignTokens.spacing.gap.sm`
- **Medium**: `gap-3` (12px) - `DesignTokens.spacing.gap.md`
- **Large**: `gap-4` (16px) - `DesignTokens.spacing.gap.lg`
- **Responsive Small**: `gap-2 sm:gap-3` - `DesignTokens.spacing.gap.responsive.sm`
- **Responsive Medium**: `gap-3 sm:gap-4` - `DesignTokens.spacing.gap.responsive.md`

### Icon Container Padding
- **Full**: `p-2 sm:p-2.5` (8px mobile, 10px tablet+)
- **Token**: `DesignTokens.spacing.iconContainer.full`

### Button Padding
- **Mobile**: `px-3 sm:px-4`
- **Desktop**: `px-4 sm:px-6`
- **Icon Only**: `px-3 sm:px-6`
- **Token**: `DesignTokens.spacing.button.full` or `DesignTokens.spacing.button.iconOnly`

### Card Padding
- **Full**: `p-3 sm:p-4 md:p-5`
- **Token**: `DesignTokens.spacing.card.full`

### Minimum Touch Target
- **Standard**: `min-h-[44px]` (44px minimum for touch accessibility)
- **Token**: `DesignTokens.spacing.touchTarget`

## Colors

### Primary Colors (HealthTab Only)
**Note**: Primary blue colors (`medical-primary`) are now reserved for HealthTab only. All other app-level UI uses the App Theme (dark gray).

- **50**: Light background (`bg-medical-primary-50`) - `DesignTokens.colors.primary[50]`
- **100**: Hover states (`bg-medical-primary-100`) - `DesignTokens.colors.primary[100]`
- **200**: Borders (`bg-medical-primary-200`) - `DesignTokens.colors.primary[200]`
- **500**: Primary button (`bg-medical-primary-500`) - `DesignTokens.colors.primary[500]`
- **600**: Primary button hover (`bg-medical-primary-600`) - `DesignTokens.colors.primary[600]`
- **700**: Active/pressed states (`bg-medical-primary-700`) - `DesignTokens.colors.primary[700]`

### Text Colors
- Use `DesignTokens.colors.primary.text[50-700]` for text colors (HealthTab only)
- Use `DesignTokens.colors.primary.border[200|600]` for border colors (HealthTab only)

### App Theme (Dark Gray) - Navigation & App-Level UI
**Used for**: Navigation bar, general app UI, modals, buttons, links (NOT HealthTab)

- **50**: Light background (`bg-gray-50`) - `DesignTokens.colors.app[50]`
- **100**: Hover states (`bg-gray-100`) - `DesignTokens.colors.app[100]`
- **200**: Borders (`bg-gray-200`) - `DesignTokens.colors.app[200]`
- **500**: Medium gray (`bg-gray-500`) - `DesignTokens.colors.app[500]`
- **600**: Medium-dark gray (`bg-gray-600`) - `DesignTokens.colors.app[600]`
- **700**: Dark gray (`bg-gray-700`) - `DesignTokens.colors.app[700]`
- **800**: Very dark gray (`bg-gray-800`) - `DesignTokens.colors.app[800]` - **Primary app color**
- **900**: Darkest gray (`bg-gray-900`) - `DesignTokens.colors.app[900]`

### App Theme Text Colors
- Use `DesignTokens.colors.app.text[50-900]` for text colors
- Use `DesignTokens.colors.app.border[200|300]` for border colors

### Accent Colors
- Used for Clinical Trials and special highlights
- Same scale as primary (50-700)
- Access via `DesignTokens.colors.accent[50-700]`

### Neutral Colors
- **50-100**: Backgrounds - `DesignTokens.colors.neutral[50|100]`
- **200-300**: Borders - `DesignTokens.colors.neutral.border[200|300]`
- **500-700**: Text (secondary) - `DesignTokens.colors.neutral.text[500|600|700]`
- **900**: Primary text (`text-medical-neutral-900`) - `DesignTokens.colors.neutral.text[900]`

## Typography

### Heading 1 (Page Headers)
- **Size**: `text-xl sm:text-2xl md:text-3xl` - `DesignTokens.typography.h1.full`
- **Weight**: `font-bold` - `DesignTokens.typography.h1.weight`
- **Color**: `text-medical-neutral-900` - `DesignTokens.typography.h1.color`
- **Margin Bottom**: `mb-0.5 sm:mb-1` - `DesignTokens.typography.h1.marginBottom`
- **Complete**: `text-xl sm:text-2xl md:text-3xl font-bold text-medical-neutral-900 mb-0.5 sm:mb-1`
- **Token**: `DesignTokens.typography.h1.complete` or `Layouts.headerTitle`

### Heading 2
- **Size**: `text-lg sm:text-xl md:text-2xl` - `DesignTokens.typography.h2.full`
- **Weight**: `font-semibold` - `DesignTokens.typography.h2.weight`

### Heading 3
- **Size**: `text-sm sm:text-base md:text-lg` - `DesignTokens.typography.h3.full`
- **Weight**: `font-semibold` - `DesignTokens.typography.h3.weight`
- **Color**: `text-medical-neutral-900` - `DesignTokens.typography.h3.color`

### Body Text
- **Extra Small**: `text-xs` - `DesignTokens.typography.body.xs`
- **Small**: `text-xs sm:text-sm` - `DesignTokens.typography.body.sm`
- **Base**: `text-sm sm:text-base` - `DesignTokens.typography.body.base`
- **Large**: `text-base sm:text-lg` - `DesignTokens.typography.body.lg`

## Icons

### Header Icons
- **Size**: `w-5 h-5 sm:w-6 sm:h-6` - `DesignTokens.icons.header.size.full`
- **Token**: `DesignTokens.components.header.icon`

### Standard Icons
- **Size**: `w-4 h-4 sm:w-5 sm:h-5` - `DesignTokens.icons.standard.size.full`

### Small Icons
- **Size**: `w-3.5 h-3.5 sm:w-4 sm:h-4` - `DesignTokens.icons.small.size.full`

### Button Icons (with text)
- **Size**: `w-4 h-4 sm:w-5 sm:h-5` - `DesignTokens.icons.button.size.full`

## Borders & Radius

### Border Radius
- **Small**: `rounded-lg` (8px) - `DesignTokens.borders.radius.sm`
- **Medium**: `rounded-xl` (12px) - `DesignTokens.borders.radius.md`
- **Large**: `rounded-2xl` (16px) - `DesignTokens.borders.radius.lg`
- **Full**: `rounded-full` (9999px) - `DesignTokens.borders.radius.full`

### Border Width
- **Default**: `border` (1px) - `DesignTokens.borders.width.default`
- **Thick**: `border-2` (2px) - `DesignTokens.borders.width.thick`

### Common Border Combinations
- **Card**: `border border-medical-neutral-200` - `DesignTokens.borders.card`
- **Divider**: `border-b border-medical-neutral-200` - `DesignTokens.borders.divider`
- **Active Tab**: `border-b-2 border-medical-primary-600` - `DesignTokens.borders.active`

## Shadows

- **Small**: `shadow-sm` - `DesignTokens.shadows.sm`
- **Medium**: `shadow` - `DesignTokens.shadows.md`
- **Large**: `shadow-md` - `DesignTokens.shadows.lg`
- **Hover**: `hover:shadow-md` - `DesignTokens.shadows.hover`

## Z-Index Layers

For consistent layering across the application:

- **Base**: `z-0` - Default content
- **Dropdown**: `z-10` - Dropdown menus, select options
- **Sticky**: `z-20` - Sticky headers, navigation
- **Overlay**: `z-30` - Tooltips, popovers, chart overlays
- **Modal**: `z-50` - Modal dialogs, full-screen overlays
- **Tooltip**: `z-70` - Special tooltips (Lab descriptions, etc.)
- **Notification**: `z-100` - Toast notifications, banners

Access via `DesignTokens.zIndex[base|dropdown|sticky|overlay|modal|tooltip|notification]`

## Common Components

### Header Component

**Current Implementation** (hardcoded):
```javascript
<div className="mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
  <div className="bg-medical-primary-50 p-2 sm:p-2.5 rounded-lg">
    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-medical-primary-600" />
  </div>
  <div>
    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-medical-neutral-900 mb-0.5 sm:mb-1">
      Title
    </h1>
  </div>
</div>
```

**Recommended Implementation** (using tokens):
```javascript
<div className={Layouts.header}>
  <div className={Layouts.headerIcon}>
    <Icon className={DesignTokens.components.header.icon} />
  </div>
  <div>
    <h1 className={Layouts.headerTitle}>Title</h1>
  </div>
</div>
```

### Tab Navigation

**Current Implementation** (hardcoded):
```javascript
<div className="flex gap-1 sm:gap-4 mb-4 sm:mb-6 overflow-x-auto">
  <button className={combineClasses(
    'pb-3 px-2 sm:px-4 font-medium transition-all duration-200 flex items-center gap-1 sm:gap-2 min-h-[44px] touch-manipulation active:opacity-70 whitespace-nowrap flex-shrink-0',
    isActive 
      ? 'text-medical-primary-600 border-b-2 border-medical-primary-600'
      : 'text-medical-neutral-600 hover:text-medical-primary-600'
  )}>
    Tab Label
  </button>
</div>
```

**Recommended Implementation** (using tokens):
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

**Note**: Inner tab navigation (within tabs like Health or Files) does not use bottom borders on the container, only on active tab buttons.

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

### Card Component
```javascript
<div className={combineClasses(
  DesignTokens.components.card.container,
  DesignTokens.components.card.hover
)}>
  {/* Card content */}
</div>
```

### Modal Component
```javascript
<div className={DesignTokens.components.modal.backdrop}>
  <div className={DesignTokens.components.modal.container}>
    <div className={DesignTokens.components.modal.header}>
      <h3 className={DesignTokens.components.modal.title}>Modal Title</h3>
      <button className={DesignTokens.components.modal.closeButton}>
        <X className="w-6 h-6" />
      </button>
    </div>
    <div className={DesignTokens.components.modal.body}>
      {/* Modal content */}
    </div>
    <div className={DesignTokens.components.modal.footer}>
      {/* Modal actions */}
    </div>
  </div>
</div>
```

### Form Input
```javascript
<input
  type="text"
  className={combineClasses(
    DesignTokens.components.input.base,
    disabled && DesignTokens.components.input.disabled
  )}
  placeholder="Enter text..."
/>
```

### Textarea
```javascript
<textarea
  className={combineClasses(
    DesignTokens.components.input.base,
    DesignTokens.components.input.textarea
  )}
  rows={6}
/>
```

### Loading Overlay
```javascript
<div className={DesignTokens.components.loading.overlay}>
  <div className={DesignTokens.components.loading.container}>
    <div className={DesignTokens.components.loading.spinner}>
      <Loader2 className={DesignTokens.components.loading.spinnerIcon} />
    </div>
    <h3 className={DesignTokens.components.loading.title}>Loading...</h3>
    <p className={DesignTokens.components.loading.message}>Please wait</p>
  </div>
</div>
```

### Empty State
```javascript
<div className={DesignTokens.components.emptyState.container}>
  <div className={DesignTokens.components.emptyState.iconContainer}>
    <Icon className={DesignTokens.components.emptyState.icon} />
  </div>
  <h3 className={DesignTokens.components.emptyState.title}>No Data Yet</h3>
  <p className={DesignTokens.components.emptyState.message}>
    Get started by adding your first item
  </p>
  <div className={DesignTokens.components.emptyState.actions}>
    <button className={DesignTokens.components.button.primary}>
      Add Item
    </button>
  </div>
</div>
```

### Alert/Banner
```javascript
{/* Success Alert */}
<div className={DesignTokens.components.alert.success}>
  <p className={DesignTokens.components.alert.text.success}>
    Operation completed successfully
  </p>
</div>

{/* Error Alert */}
<div className={DesignTokens.components.alert.error}>
  <p className={DesignTokens.components.alert.text.error}>
    An error occurred
  </p>
</div>

{/* Warning Alert */}
<div className={DesignTokens.components.alert.warning}>
  <p className={DesignTokens.components.alert.text.warning}>
    Please review this information
  </p>
</div>

{/* Info Alert */}
<div className={DesignTokens.components.alert.info}>
  <p className={DesignTokens.components.alert.text.info}>
    Additional information
  </p>
</div>
```

### Chat Message Bubbles
```javascript
{/* User Message */}
<div className={DesignTokens.components.chat.userBubble}>
  User message text
</div>

{/* AI Message */}
<div className={DesignTokens.components.chat.aiBubble}>
  AI response text
</div>

{/* Analysis Message */}
<div className={DesignTokens.components.chat.analysisBubble}>
  Analysis results
</div>

{/* Chat Avatar */}
<div className={DesignTokens.components.chat.avatar}>
  <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
</div>
```

### Status Indicators
```javascript
{/* Normal Status */}
<div className={combineClasses(
  DesignTokens.components.status.normal.bg,
  DesignTokens.components.status.normal.border,
  'rounded-lg p-2'
)}>
  <Activity className={DesignTokens.components.status.normal.icon} />
  <span className={DesignTokens.components.status.normal.text}>Normal</span>
</div>

{/* High Status */}
<div className={combineClasses(
  DesignTokens.components.status.high.bg,
  DesignTokens.components.status.high.border,
  'rounded-lg p-2'
)}>
  <TrendingUp className={DesignTokens.components.status.high.icon} />
  <span className={DesignTokens.components.status.high.text}>High</span>
</div>

{/* Low Status */}
<div className={combineClasses(
  DesignTokens.components.status.low.bg,
  DesignTokens.components.status.low.border,
  'rounded-lg p-2'
)}>
  <TrendingDown className={DesignTokens.components.status.low.icon} />
  <span className={DesignTokens.components.status.low.text}>Low</span>
</div>
```

## Breakpoints

- **sm**: 640px
- **md**: 768px
- **lg**: 1024px
- **xl**: 1280px
- **2xl**: 1536px

Access via `DesignTokens.breakpoints[sm|md|lg|xl|'2xl']`

## Transitions

- **Default**: `transition-colors` - `DesignTokens.transitions.default`
- **All**: `transition-all duration-200` - `DesignTokens.transitions.all`
- **Fast**: `transition-all duration-150` - `DesignTokens.transitions.fast`
- **Slow**: `transition-all duration-300` - `DesignTokens.transitions.slow`

## Best Practices

1. **Always use tokens** from `designTokens.js` instead of hardcoded values
2. **Use `combineClasses()`** helper to combine multiple class strings
3. **Follow responsive patterns** - mobile first, then tablet (sm:), then desktop (md:)
4. **Maintain touch targets** - minimum 44px height for interactive elements
5. **Use semantic spacing** - prefer spacing tokens over arbitrary values
6. **Consistent icon sizes** - use icon size tokens based on context
7. **Use Layouts helpers** - prefer `Layouts.container`, `Layouts.header`, etc. for common patterns

## Migration Guide

When updating existing code:

1. Replace hardcoded spacing with tokens
2. Replace hardcoded colors with color tokens
3. Replace hardcoded typography with typography tokens
4. Use component patterns for common UI elements

### Example Migration

**Before** (hardcoded):
```javascript
<div className="p-3 sm:p-4 md:p-6 mb-4 sm:mb-6">
  <div className="mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
    <div className="bg-medical-primary-50 p-2 sm:p-2.5 rounded-lg">
      <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-medical-primary-600" />
    </div>
    <div>
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-medical-neutral-900 mb-0.5 sm:mb-1">
        Title
      </h1>
    </div>
  </div>
</div>
```

**After** (using tokens):
```javascript
<div className={combineClasses(Layouts.container, Layouts.section)}>
  <div className={Layouts.header}>
    <div className={Layouts.headerIcon}>
      <Icon className={DesignTokens.components.header.icon} />
    </div>
    <div>
      <h1 className={Layouts.headerTitle}>Title</h1>
    </div>
  </div>
</div>
```

## Status

- ✅ Design tokens defined in `designTokens.js`
- ✅ Layout helpers available via `Layouts` export
- ✅ Documentation complete
- ⚠️ Migration in progress - codebase gradually adopting tokens
