import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function DatePicker({ value, onChange, max, min, className = '', placeholder = 'Select date', showClear = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
  const [selectedDate, setSelectedDate] = useState(value ? new Date(value) : null);
  const [position, setPosition] = useState({ top: 'auto', bottom: 'auto', left: 'auto', right: 'auto' });
  const pickerRef = useRef(null);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  // Calculate position when picker opens
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
      
      // Check if there's enough space on the right
      const spaceRight = viewportWidth - buttonRect.left;
      const spaceLeft = buttonRect.right;
      
      let top = 'auto';
      let bottom = 'auto';
      let left = '0';
      let right = 'auto';
      
      // Position vertically: prefer below, but use above if not enough space
      if (spaceBelow >= dropdownHeight || spaceBelow > spaceAbove) {
        // Position below
        top = '100%';
        bottom = 'auto';
      } else {
        // Position above
        bottom = '100%';
        top = 'auto';
      }
      
      // Position horizontally: center on mobile, align left on desktop
      if (viewportWidth < 640) {
        // Mobile: full width with padding
        left = '0';
        right = '0';
      } else {
        // Desktop: align to button left
        if (spaceRight >= dropdownWidth) {
          left = '0';
          right = 'auto';
        } else if (spaceLeft >= dropdownWidth) {
          right = '0';
          left = 'auto';
        } else {
          // Center if neither side has enough space
          left = '50%';
          right = 'auto';
        }
      }
      
      setPosition({ top, bottom, left, right });
      
      // Scroll into view if needed
      setTimeout(() => {
        if (dropdown) {
          dropdown.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 0);
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
    onChange({ target: { value: '' } });
  };

  return (
    <div ref={pickerRef} className={`relative flex items-center gap-2 ${className}`}>
      <div className="relative flex-1">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400 transition-colors ${
            !value ? 'text-gray-500' : 'text-gray-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>{value ? formatDate(value) : placeholder}</span>
          </span>
          <ChevronRight 
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} 
          />
        </button>
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
              className="fixed inset-0 bg-black/20 z-[99]"
              onClick={() => setIsOpen(false)}
            />
          )}
          <div 
            ref={dropdownRef}
            className={`${
              typeof window !== 'undefined' && window.innerWidth < 640 
                ? 'fixed left-4 right-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto z-[100]' 
                : 'absolute z-[100]'
            } bg-white border border-gray-200 rounded-lg shadow-xl p-4 animate-fade-scale ${
              typeof window !== 'undefined' && window.innerWidth < 640 
                ? 'w-full' 
                : 'w-72'
            }`}
            style={
              typeof window !== 'undefined' && window.innerWidth >= 640
                ? {
                    top: position.top !== 'auto' ? position.top : undefined,
                    bottom: position.bottom !== 'auto' ? position.bottom : undefined,
                    left: position.left !== 'auto' ? position.left : undefined,
                    right: position.right !== 'auto' ? position.right : undefined,
                    transform: position.left === '50%' ? 'translateX(-50%)' : undefined,
                    marginTop: position.top === '100%' ? '0.25rem' : undefined,
                    marginBottom: position.bottom === '100%' ? '0.25rem' : undefined,
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

