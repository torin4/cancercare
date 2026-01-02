import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function DatePicker({ value, onChange, max, min, className = '', placeholder = 'Select date', showClear = false }) {
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
    <div ref={pickerRef} className={`relative flex items-center gap-2 ${className}`}>
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
            maxLength={10}
            pattern="\d{4}-\d{2}-\d{2}"
            className={`w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400 transition-colors ${
              !value ? 'text-gray-500' : 'text-gray-900'
            }`}
          />
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
            aria-label="Open calendar"
          >
            <Calendar className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
      {showClear && value && (
        <button
          type="button"
          onClick={handleClear}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation flex-shrink-0"
          aria-label="Clear date"
        >
          <X className="w-4 h-4" />
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
            } bg-white border border-gray-200 rounded-lg shadow-2xl p-4 animate-fade-scale ${
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
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <h3 className="font-semibold text-gray-900 text-sm">{monthName}</h3>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
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
                  className={`
                    aspect-square flex items-center justify-center text-sm rounded-lg transition-all touch-manipulation
                    ${disabled 
                      ? 'text-gray-300 cursor-not-allowed' 
                      : selected
                        ? 'bg-blue-600 text-white font-semibold'
                        : today
                          ? 'bg-blue-50 text-blue-600 font-semibold hover:bg-blue-100'
                          : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
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
            className="w-full mt-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-manipulation"
          >
            Today
          </button>
          </div>
        </>
      )}
    </div>
  );
}

