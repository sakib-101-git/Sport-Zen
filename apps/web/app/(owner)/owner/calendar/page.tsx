'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  parseISO,
} from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Clock, User, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// Types
interface Booking {
  id: string;
  bookingNumber: string;
  playerName: string;
  playerPhone: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  totalAmount: number;
  advanceAmount: number;
  status: 'HOLD' | 'CONFIRMED' | 'COMPLETED' | 'CANCELED' | 'EXPIRED';
  paymentStage: string;
  checkinStatus: string;
  playArea: {
    id: string;
    name: string;
  };
  sportProfile: {
    sportType: {
      name: string;
    };
  };
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  bookings: Booking[];
}

// Mock API client (replace with real API client)
const fetchOwnerBookings = async (
  month: string,
  facilityId?: string
): Promise<Booking[]> => {
  const params = new URLSearchParams({ month });
  if (facilityId) params.append('facilityId', facilityId);

  const response = await fetch(`/api/v1/owner/bookings?${params}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch bookings');
  }

  const data = await response.json();
  return data.data.bookings;
};

export default function OwnerCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<string | undefined>();

  const monthString = format(currentDate, 'yyyy-MM');

  // Fetch bookings for the current month
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['owner-bookings', monthString, selectedFacility],
    queryFn: () => fetchOwnerBookings(monthString, selectedFacility),
  });

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days: CalendarDay[] = [];
    let day = startDate;
    const today = new Date();

    while (day <= endDate) {
      const dayBookings = bookings.filter((b) =>
        isSameDay(parseISO(b.startAt), day)
      );

      days.push({
        date: day,
        isCurrentMonth: isSameMonth(day, currentDate),
        isToday: isSameDay(day, today),
        bookings: dayBookings,
      });

      day = addDays(day, 1);
    }

    return days;
  }, [currentDate, bookings]);

  // Get bookings for selected date
  const selectedDayBookings = useMemo(() => {
    if (!selectedDate) return [];
    return bookings.filter((b) => isSameDay(parseISO(b.startAt), selectedDate));
  }, [selectedDate, bookings]);

  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'HOLD':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'COMPLETED':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'CANCELED':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'EXPIRED':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Booking Calendar</h1>
            <p className="text-gray-400 text-sm mt-1">
              View and manage your facility bookings
            </p>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousMonth}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="px-4 py-2 rounded-lg bg-white/5 min-w-[180px] text-center font-medium">
              {format(currentDate, 'MMMM yyyy')}
            </div>

            <button
              onClick={goToNextMonth}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <button
              onClick={goToToday}
              className="ml-2 px-4 py-2 rounded-lg bg-[#39FF14]/10 text-[#39FF14] hover:bg-[#39FF14]/20 transition-colors text-sm font-medium"
            >
              Today
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Grid */}
          <div className="lg:col-span-2">
            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b border-white/10">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div
                    key={day}
                    className="px-2 py-3 text-center text-sm font-medium text-gray-400"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, idx) => (
                  <motion.button
                    key={idx}
                    onClick={() => setSelectedDate(day.date)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'min-h-[100px] p-2 border-b border-r border-white/5 transition-colors text-left',
                      !day.isCurrentMonth && 'opacity-40',
                      day.isToday && 'bg-[#39FF14]/5',
                      selectedDate && isSameDay(day.date, selectedDate) && 'bg-[#39FF14]/10 ring-1 ring-[#39FF14]/30',
                      'hover:bg-white/5'
                    )}
                  >
                    <div
                      className={cn(
                        'text-sm font-medium mb-1',
                        day.isToday && 'text-[#39FF14]'
                      )}
                    >
                      {format(day.date, 'd')}
                    </div>

                    {/* Booking Indicators */}
                    <div className="space-y-1">
                      {day.bookings.slice(0, 3).map((booking) => (
                        <div
                          key={booking.id}
                          className={cn(
                            'text-xs px-1.5 py-0.5 rounded truncate border',
                            getStatusColor(booking.status)
                          )}
                        >
                          {format(parseISO(booking.startAt), 'HH:mm')} -{' '}
                          {booking.playArea.name}
                        </div>
                      ))}
                      {day.bookings.length > 3 && (
                        <div className="text-xs text-gray-400 px-1.5">
                          +{day.bookings.length - 3} more
                        </div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-500/50" />
                <span className="text-gray-400">Confirmed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-yellow-500/50" />
                <span className="text-gray-400">Hold</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-500/50" />
                <span className="text-gray-400">Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-500/50" />
                <span className="text-gray-400">Canceled</span>
              </div>
            </div>
          </div>

          {/* Selected Day Details */}
          <div className="lg:col-span-1">
            <div className="bg-white/5 rounded-xl border border-white/10 p-4 sticky top-4">
              <h2 className="text-lg font-semibold mb-4">
                {selectedDate
                  ? format(selectedDate, 'EEEE, MMMM d')
                  : 'Select a date'}
              </h2>

              <AnimatePresence mode="wait">
                {selectedDate && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3"
                  >
                    {selectedDayBookings.length === 0 ? (
                      <p className="text-gray-400 text-sm py-8 text-center">
                        No bookings on this date
                      </p>
                    ) : (
                      selectedDayBookings.map((booking) => (
                        <motion.div
                          key={booking.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={cn(
                            'p-3 rounded-lg border',
                            getStatusColor(booking.status)
                          )}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="font-medium">
                                {booking.bookingNumber}
                              </div>
                              <div className="text-sm opacity-80">
                                {booking.sportProfile.sportType.name}
                              </div>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded bg-white/10">
                              {booking.status}
                            </span>
                          </div>

                          <div className="space-y-1.5 text-sm">
                            <div className="flex items-center gap-2 opacity-80">
                              <Clock className="w-4 h-4" />
                              {format(parseISO(booking.startAt), 'HH:mm')} -{' '}
                              {format(parseISO(booking.endAt), 'HH:mm')}
                              <span className="text-xs">
                                ({booking.durationMinutes} min)
                              </span>
                            </div>

                            <div className="flex items-center gap-2 opacity-80">
                              <MapPin className="w-4 h-4" />
                              {booking.playArea.name}
                            </div>

                            <div className="flex items-center gap-2 opacity-80">
                              <User className="w-4 h-4" />
                              {booking.playerName}
                            </div>

                            <div className="pt-2 border-t border-white/10 mt-2">
                              <div className="flex justify-between text-sm">
                                <span>Total</span>
                                <span>৳{booking.totalAmount.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-sm opacity-70">
                                <span>Advance Paid</span>
                                <span>৳{booking.advanceAmount.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-sm opacity-70">
                                <span>Remaining</span>
                                <span>
                                  ৳{(booking.totalAmount - booking.advanceAmount).toLocaleString()}
                                </span>
                              </div>
                            </div>

                            <div className="flex gap-2 mt-3">
                              <a
                                href={`tel:${booking.playerPhone}`}
                                className="flex-1 text-center py-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors text-xs"
                              >
                                Call
                              </a>
                              {booking.status === 'CONFIRMED' &&
                                booking.checkinStatus === 'NOT_CHECKED_IN' && (
                                  <button className="flex-1 py-1.5 rounded bg-[#39FF14]/20 text-[#39FF14] hover:bg-[#39FF14]/30 transition-colors text-xs">
                                    Verify Check-in
                                  </button>
                                )}
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-[#39FF14] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
