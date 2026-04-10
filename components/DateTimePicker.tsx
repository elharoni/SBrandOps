import React from 'react';

interface DateTimePickerProps {
    selectedDate: Date | null;
    onChange: (date: Date | null) => void;
    onConfirm: () => void;
    onCancel: () => void;
}

// Helper to format Date to 'yyyy-MM-ddTHH:mm' for datetime-local input
const formatDateForInput = (date: Date | null): string => {
    if (!date) return '';
    // Adjust for timezone offset
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - timezoneOffset);
    return localDate.toISOString().slice(0, 16);
};

export const DateTimePicker: React.FC<DateTimePickerProps> = ({ selectedDate, onChange, onConfirm, onCancel }) => {
    const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        if (value) {
            onChange(new Date(value));
        } else {
            onChange(null);
        }
    };
    
    return (
        <div className="space-y-3">
            <label htmlFor="schedule-time" className="block text-sm font-medium text-dark-text-secondary">
                اختر وقت النشر
            </label>
            <input
                id="schedule-time"
                type="datetime-local"
                value={formatDateForInput(selectedDate)}
                onChange={handleDateChange}
                className="w-full p-2 bg-dark-bg border border-dark-border rounded-md focus:ring-brand-primary focus:border-brand-primary text-dark-text"
                style={{ colorScheme: 'dark' }}
            />
            <div className="flex items-center justify-end gap-2">
                <button onClick={onCancel} className="text-xs text-dark-text-secondary hover:text-white px-3 py-1">
                    إلغاء
                </button>
                <button 
                    onClick={onConfirm}
                    disabled={!selectedDate}
                    className="bg-brand-primary hover:bg-brand-secondary text-white font-bold text-xs py-2 px-3 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed">
                    تأكيد الجدولة
                </button>
            </div>
        </div>
    );
};