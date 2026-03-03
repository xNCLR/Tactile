import { useState } from 'react';
import { DAY_NAMES_SHORT, splitSlotIntoHours } from '../utils/helpers';

function getWeekDates(startDate) {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

export default function CalendarView({ timeSlots = [], bookings = [], onSlotClick, compact = false }) {
  const [weekOffset, setWeekOffset] = useState(0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() + (weekOffset * 7));
  const weekDates = getWeekDates(weekStart);

  // Split all slots into hourly segments, grouped by day
  const hoursByDay = {};
  timeSlots.forEach(slot => {
    const segments = splitSlotIntoHours(slot);
    segments.forEach(seg => {
      if (!hoursByDay[seg.dayOfWeek]) hoursByDay[seg.dayOfWeek] = [];
      hoursByDay[seg.dayOfWeek].push(seg);
    });
  });
  // Sort each day's segments by hour
  Object.values(hoursByDay).forEach(segs => segs.sort((a, b) => a.hour - b.hour));

  // Group bookings by date
  const bookingsByDate = {};
  bookings.forEach(b => {
    if (!bookingsByDate[b.booking_date]) bookingsByDate[b.booking_date] = [];
    bookingsByDate[b.booking_date].push(b);
  });

  const isToday = (date) => formatDate(date) === formatDate(new Date());
  const isPast = (date) => date < today;

  // Check if a specific hour segment is booked on a given date
  const isHourBooked = (date, seg) => {
    const dayBookings = bookingsByDate[formatDate(date)] || [];
    return dayBookings.some(b =>
      b.start_time <= seg.startTime && b.end_time >= seg.endTime &&
      ['confirmed', 'awaiting_teacher'].includes(b.status)
    );
  };

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))}
          disabled={weekOffset === 0}
          className="text-sm text-stone hover:text-bark disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1"
        >
          &larr; Previous
        </button>
        <span className="font-mono text-sm font-medium text-stone">
          {weekDates[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — {weekDates[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </span>
        <button
          onClick={() => setWeekOffset(prev => prev + 1)}
          disabled={weekOffset >= 4}
          className="text-sm text-stone hover:text-bark disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1"
        >
          Next &rarr;
        </button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 overflow-x-auto">
        {weekDates.map((date, i) => {
          const daySegments = hoursByDay[date.getDay()] || [];
          const past = isPast(date);

          return (
            <div key={i} className={`min-w-[80px] ${past ? 'opacity-40' : ''}`}>
              {/* Day header */}
              <div className={`text-center pb-2 mb-1 border-b border-sand/40 ${isToday(date) ? 'text-terracotta' : 'text-stone'}`}>
                <p className="font-mono text-xs font-medium">{DAY_NAMES_SHORT[date.getDay()]}</p>
                <p className={`text-lg font-semibold ${isToday(date) ? 'bg-terracotta text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto' : ''}`}>
                  {date.getDate()}
                </p>
              </div>

              {/* Hourly segments */}
              <div className="space-y-1">
                {daySegments.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-[10px] text-sand">&mdash;</p>
                  </div>
                )}
                {daySegments.map(seg => {
                  const booked = isHourBooked(date, seg);
                  const isClickable = !past && !booked && onSlotClick;

                  return (
                    <button
                      key={`${seg.slotId}-${seg.hour}`}
                      onClick={() => isClickable && onSlotClick(seg, formatDate(date))}
                      disabled={!isClickable}
                      className={`w-full text-left px-1.5 py-1.5 rounded text-[11px] leading-tight transition-colors font-mono ${
                        booked
                          ? 'bg-paper text-clay cursor-default'
                          : isClickable
                            ? 'bg-blush text-bark hover:bg-sand cursor-pointer border border-sand'
                            : 'bg-blush/60 text-stone cursor-default'
                      }`}
                    >
                      <span className="font-medium">{seg.startTime}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
