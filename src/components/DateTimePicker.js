import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import DatePicker from './DatePicker';
import { DesignTokens, combineClasses } from '../design/designTokens';

export default function DateTimePicker({ value, onChange, max, min, className = '', placeholder = 'Select date and time', showClear = false }) {
  // Parse the datetime-local value (format: "YYYY-MM-DDTHH:mm")
  const parseDateTime = (dateTimeString) => {
    if (!dateTimeString) return { date: '', time: '' };
    const [date, time] = dateTimeString.split('T');
    return { date: date || '', time: time || '' };
  };

  const formatDateTime = (date, time) => {
    if (!date) return '';
    if (!time) return date;
    return `${date}T${time}`;
  };

  const initial = parseDateTime(value);
  const [dateValue, setDateValue] = useState(initial.date);
  const [timeValue, setTimeValue] = useState(initial.time);

  // Update when value prop changes
  useEffect(() => {
    const parsed = parseDateTime(value);
    setDateValue(parsed.date);
    setTimeValue(parsed.time);
  }, [value]);

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setDateValue(newDate);
    const newDateTime = formatDateTime(newDate, timeValue);
    if (onChange) {
      onChange({ target: { value: newDateTime } });
    }
  };

  const handleTimeChange = (e) => {
    const newTime = e.target.value;
    setTimeValue(newTime);
    const newDateTime = formatDateTime(dateValue, newTime);
    if (onChange) {
      onChange({ target: { value: newDateTime } });
    }
  };

  const handleClear = () => {
    setDateValue('');
    setTimeValue('');
    if (onChange) {
      onChange({ target: { value: '' } });
    }
  };

  // Format max/min for DatePicker (date only)
  const dateMax = max ? max.split('T')[0] : undefined;
  const dateMin = min ? min.split('T')[0] : undefined;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex gap-2">
        <div className="flex-1">
          <DatePicker
            value={dateValue}
            onChange={handleDateChange}
            max={dateMax}
            min={dateMin}
            placeholder="YYYY-MM-DD"
            showClear={false}
            className="w-full"
          />
        </div>
        <div className="flex-shrink-0 w-32">
          <input
            type="time"
            value={timeValue || ''}
            onChange={handleTimeChange}
            className={DesignTokens.components.input.base}
            placeholder="Time"
          />
        </div>
        {showClear && (dateValue || timeValue) && (
          <button
            type="button"
            onClick={handleClear}
            className={combineClasses('flex-shrink-0 px-3', DesignTokens.colors.neutral.text[500], `hover:${DesignTokens.colors.neutral.text[700]}`, DesignTokens.transitions.default)}
            title="Clear date and time"
          >
            <X className={DesignTokens.icons.standard.size.full} />
          </button>
        )}
      </div>
    </div>
  );
}

