"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./utils";
import { buttonVariants } from "./button";

interface CalendarProps {
  mode?: "single" | "multiple" | "range";
  selected?: Date | Date[] | { from?: Date; to?: Date };
  onSelect?: (date: Date | undefined) => void;
  disabled?: (date: Date) => boolean;
  className?: string;
  month?: Date;
  onMonthChange?: (date: Date) => void;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const Calendar: React.FC<CalendarProps> = ({
  mode = "single",
  selected,
  onSelect,
  disabled,
  className,
  month: controlledMonth,
  onMonthChange,
}) => {
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    if (controlledMonth) return controlledMonth;
    if (selected instanceof Date) return selected;
    return new Date();
  });

  const month = controlledMonth || currentMonth;

  const handleMonthChange = (newMonth: Date) => {
    if (!controlledMonth) {
      setCurrentMonth(newMonth);
    }
    onMonthChange?.(newMonth);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty slots for days before the first of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const isSelected = (date: Date) => {
    if (!selected) return false;
    if (selected instanceof Date) {
      return date.toDateString() === selected.toDateString();
    }
    if (Array.isArray(selected)) {
      return selected.some(d => d.toDateString() === date.toDateString());
    }
    return false;
  };

  const isToday = (date: Date) => {
    return date.toDateString() === new Date().toDateString();
  };

  const isDisabled = (date: Date) => {
    return disabled?.(date) || false;
  };

  const handleDateClick = (date: Date) => {
    if (isDisabled(date)) return;
    onSelect?.(date);
  };

  const prevMonth = () => {
    const newMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
    handleMonthChange(newMonth);
  };

  const nextMonth = () => {
    const newMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    handleMonthChange(newMonth);
  };

  const days = getDaysInMonth(month);

  return (
    <div className={cn("p-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "h-7 w-7"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-medium text-white">
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </div>
        <button
          onClick={nextMonth}
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "h-7 w-7"
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-gray-500 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="h-9 w-9" />;
          }

          const selected = isSelected(date);
          const today = isToday(date);
          const disabled = isDisabled(date);

          return (
            <button
              key={date.toISOString()}
              onClick={() => handleDateClick(date)}
              disabled={disabled}
              className={cn(
                "h-9 w-9 rounded-md text-sm font-normal transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-950",
                selected && "bg-primary text-black hover:bg-primary/90",
                !selected && !disabled && "hover:bg-gray-800 text-white",
                today && !selected && "border border-primary text-primary",
                disabled && "text-gray-600 cursor-not-allowed hover:bg-transparent"
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};
Calendar.displayName = "Calendar";

export { Calendar };
