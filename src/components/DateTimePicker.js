import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import DatePicker from './DatePicker';

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
            placeholder="Select date"
            showClear={false}
            className="w-full"
          />
        </div>
        <div className="flex-shrink-0 w-32">
          <input
            type="time"
            value={timeValue || ''}
            onChange={handleTimeChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Time"
          />
        </div>
        {showClear && (dateValue || timeValue) && (
          <button
            type="button"
            onClick={handleClear}
            className="flex-shrink-0 px-3 text-gray-500 hover:text-gray-700 transition-colors"
            title="Clear date and time"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}

