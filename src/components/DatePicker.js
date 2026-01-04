import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { DesignTokens, Layouts, combineClasses } from '../design/designTokens';

export default function DatePicker({ value, onChange, max, min, className = '', placeholder = 'YYYY-MM-DD', showClear = false, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
  const [selectedDate, setSelectedDate] = useState(value ? new Date(value) : null);
  const [position, setPosition] = useState({ top: 'auto', bottom: 'auto', left: 'auto', right: 'auto' });
  const [inputValue, setInputValue] = useState(value ? (() => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })() : '');
  const [inputFocused, setInputFocused] = useState(false);
  const pickerRef = useRef(null);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  // Calculate position when picker opens (for fixed positioning)
  useEffect(() => {
    if (isOpen && buttonRef.current && dropdownRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const dropdown = dropdownRef.current;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const dropdownHeight = 380; // Approximate height of the dropdown
      const dropdownWidth = 288; // w-72 = 288px
      
      // Check if there's enough space below
      const spaceBelow = viewportHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;
      
      // Calculate fixed position relative to viewport
      let top = buttonRect.bottom + 4; // 4px gap below button
      let left = buttonRect.left;
      
      // Position vertically: prefer below, but use above if not enough space
      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        // Position above button
        top = buttonRect.top - dropdownHeight - 4; // 4px gap above
      }
      
      // Ensure dropdown doesn't go off screen horizontally
      if (left + dropdownWidth > viewportWidth) {
        left = viewportWidth - dropdownWidth - 8; // 8px margin from right edge
      }
      if (left < 8) {
        left = 8; // 8px margin from left edge
      }
      
      // Ensure dropdown doesn't go off screen vertically
      if (top + dropdownHeight > viewportHeight) {
        top = viewportHeight - dropdownHeight - 8; // 8px margin from bottom
      }
      if (top < 8) {
        top = 8; // 8px margin from top
      }
      
      setPosition({ top: `${top}px`, left: `${left}px` });
    }
  }, [isOpen]);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [isOpen]);

  // Update view date when value changes
  useEffect(() => {
    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        setViewDate(date);
        setSelectedDate(date);
      }
    } else {
      setSelectedDate(null);
    }
  }, [value]);

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatInputValue = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handleDateSelect = (day) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    
    // Check min/max constraints
    if (min && newDate < new Date(min)) return;
    if (max && newDate > new Date(max)) return;
    
    setSelectedDate(newDate);
    const dateStr = formatInputValue(newDate);
    setInputValue(dateStr);
    onChange({ target: { value: dateStr } });
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    const todayStr = formatInputValue(today);
    setSelectedDate(today);
    setViewDate(today);
    setInputValue(todayStr);
    onChange({ target: { value: todayStr } });
    setIsOpen(false);
  };

  const daysInMonth = getDaysInMonth(viewDate);
  const firstDay = getFirstDayOfMonth(viewDate);
  const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = [];
  // Empty cells for days before the first day of the month
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  const isToday = (day) => {
    if (!day) return false;
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    return date.getTime() === today.getTime();
  };

  const isSelected = (day) => {
    if (!day || !selectedDate) return false;
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    return date.getTime() === selectedDate.getTime();
  };

  const isDisabled = (day) => {
    if (!day) return false;
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    if (min && date < new Date(min)) return true;
    if (max && date > new Date(max)) return true;
    return false;
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setInputValue('');
    onChange({ target: { value: '' } });
  };

  // Update input value when value prop changes
  useEffect(() => {
    if (value) {
      setInputValue(formatInputValue(value));
    } else {
      setInputValue('');
    }
  }, [value]);

  const handleInputChange = (e) => {
    let newValue = e.target.value.replace(/[^\d-]/g, ''); // Only allow digits and dashes
    
    // Auto-format: YYYY-MM-DD
    // Remove existing dashes and re-add them at correct positions
    const digitsOnly = newValue.replace(/-/g, '');
    if (digitsOnly.length <= 4) {
      newValue = digitsOnly;
    } else if (digitsOnly.length <= 6) {
      newValue = `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4)}`;
    } else {
      newValue = `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4, 6)}-${digitsOnly.slice(6, 8)}`;
    }
    
    setInputValue(newValue);
    
    // Try to parse the date when complete (10 characters: YYYY-MM-DD)
    if (newValue.length === 10) {
      const date = new Date(newValue);
      if (!isNaN(date.getTime())) {
        // Check min/max constraints
        if (min && date < new Date(min)) {
          // Date is before min, but still update input
          return;
        }
        if (max && date > new Date(max)) {
          // Date is after max, but still update input
          return;
        }
        
        setSelectedDate(date);
        setViewDate(date);
        onChange({ target: { value: newValue } });
      }
    } else if (newValue.length === 0) {
      // Allow clearing
      onChange({ target: { value: '' } });
    }
  };

  const handleInputBlur = () => {
    setInputFocused(false);
    // Validate and format on blur
    if (inputValue && inputValue.length !== 10) {
      // Try to parse common formats
      const parsed = new Date(inputValue);
      if (!isNaN(parsed.getTime())) {
        const formatted = formatInputValue(parsed);
        setInputValue(formatted);
        if (min && parsed < new Date(min)) return;
        if (max && parsed > new Date(max)) return;
        setSelectedDate(parsed);
        setViewDate(parsed);
        onChange({ target: { value: formatted } });
      } else {
        // Invalid date, revert to current value
        setInputValue(value ? formatInputValue(value) : '');
      }
    }
  };

  const handleInputFocus = () => {
    setInputFocused(true);
  };

  return (
    <div ref={pickerRef} className={combineClasses('relative flex items-center', DesignTokens.spacing.gap.sm, className)}>
      <div className="relative flex-1">
        <div className="relative">
          <input
            type="text"
            ref={buttonRef}
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={placeholder || 'YYYY-MM-DD'}
            title="Enter date in YYYY-MM-DD format (e.g., 2025-12-25)"
            maxLength={10}
            pattern="\d{4}-\d{2}-\d{2}"
            className={combineClasses(
              DesignTokens.components.input.base,
              'pr-10 text-left',
              disabled ? DesignTokens.components.input.disabled : '',
              !value ? DesignTokens.colors.neutral.text[500] : DesignTokens.colors.neutral.text[900]
            )}
          />
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            className={combineClasses('absolute right-2 top-1/2 -translate-y-1/2', DesignTokens.spacing.iconContainer.mobile, `hover:${DesignTokens.colors.neutral[100]}`, DesignTokens.borders.radius.sm, DesignTokens.transitions.default, 'touch-manipulation', disabled ? 'cursor-not-allowed opacity-50' : '')}
            aria-label="Open calendar"
          >
            <Calendar className={combineClasses(DesignTokens.icons.standard.size.mobile, DesignTokens.colors.neutral.text[300])} />
          </button>
        </div>
      </div>
      {showClear && value && (
        <button
          type="button"
          onClick={handleClear}
          className={combineClasses(DesignTokens.spacing.iconContainer.mobile, DesignTokens.colors.neutral.text[300], `hover:${DesignTokens.colors.neutral.text[600]}`, `hover:${DesignTokens.colors.neutral[100]}`, DesignTokens.borders.radius.sm, DesignTokens.transitions.default, 'touch-manipulation flex-shrink-0')}
          aria-label="Clear date"
        >
          <X className={DesignTokens.icons.standard.size.mobile} />
        </button>
      )}

      {isOpen && (
        <>
          {/* Mobile overlay backdrop */}
          {typeof window !== 'undefined' && window.innerWidth < 640 && (
            <div 
              className="fixed inset-0 bg-black/20 z-[9998]"
              onClick={() => setIsOpen(false)}
            />
          )}
          <div 
            ref={dropdownRef}
            className={`${
              typeof window !== 'undefined' && window.innerWidth < 640 
                ? 'fixed left-4 right-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto z-[9999]' 
                : 'fixed z-[9999]'
            } ${combineClasses('bg-white', DesignTokens.borders.width.default, DesignTokens.colors.neutral.border[200], DesignTokens.borders.radius.sm, 'shadow-2xl', DesignTokens.spacing.card.mobile, 'animate-fade-scale')} ${
              typeof window !== 'undefined' && window.innerWidth < 640 
                ? 'w-full' 
                : 'w-72'
            }`}
            style={
              typeof window !== 'undefined' && window.innerWidth >= 640 && position.top && position.left
                ? {
                    top: position.top,
                    left: position.left,
                  }
                : {}
            }
          >
          {/* Header */}
          <div className={combineClasses('flex items-center justify-between', Layouts.section)}>
            <button
              type="button"
              onClick={handlePrevMonth}
              className={combineClasses(DesignTokens.spacing.iconContainer.mobile, `hover:${DesignTokens.colors.neutral[100]}`, DesignTokens.borders.radius.sm, DesignTokens.transitions.default, 'touch-manipulation')}
              aria-label="Previous month"
            >
              <ChevronLeft className={combineClasses(DesignTokens.icons.standard.size.mobile, DesignTokens.colors.neutral.text[600])} />
            </button>
            <h3 className={combineClasses(DesignTokens.typography.h3.full, DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[900])}>{monthName}</h3>
            <button
              type="button"
              onClick={handleNextMonth}
              className={combineClasses(DesignTokens.spacing.iconContainer.mobile, `hover:${DesignTokens.colors.neutral[100]}`, DesignTokens.borders.radius.sm, DesignTokens.transitions.default, 'touch-manipulation')}
              aria-label="Next month"
            >
              <ChevronRight className={combineClasses(DesignTokens.icons.standard.size.mobile, DesignTokens.colors.neutral.text[600])} />
            </button>
          </div>

          {/* Day labels */}
          <div className={combineClasses('grid grid-cols-7', DesignTokens.spacing.gap.xs, 'mb-2')}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className={combineClasses('text-center text-xs font-medium py-1', DesignTokens.colors.neutral.text[500])}>
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className={combineClasses('grid grid-cols-7', DesignTokens.spacing.gap.xs)}>
            {days.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="aspect-square" />;
              }
              
              const disabled = isDisabled(day);
              const today = isToday(day);
              const selected = isSelected(day);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => !disabled && handleDateSelect(day)}
                  disabled={disabled}
                  className={combineClasses(
                    'aspect-square flex items-center justify-center text-sm rounded-lg transition-all touch-manipulation',
                    disabled 
                      ? combineClasses(DesignTokens.colors.neutral.text[300], 'cursor-not-allowed')
                      : selected
                        ? combineClasses(DesignTokens.colors.primary[600], 'text-white font-semibold')
                        : today
                          ? combineClasses('bg-blue-50', DesignTokens.colors.primary.text[600], 'font-semibold hover:bg-blue-100')
                          : combineClasses(DesignTokens.colors.neutral.text[700], `hover:${DesignTokens.colors.neutral[100]}`)
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today button */}
          <button
            type="button"
            onClick={handleToday}
            className={combineClasses('w-full mt-3 py-2', DesignTokens.typography.body.base, 'font-medium', DesignTokens.colors.primary.text[600], 'hover:bg-blue-50', DesignTokens.borders.radius.sm, DesignTokens.transitions.default, 'touch-manipulation')}
          >
            Today
          </button>
          </div>
        </>
      )}
    </div>
  );
}

