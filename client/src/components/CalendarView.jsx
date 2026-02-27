import { useState } from 'react';

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

  // Group time slots by day of week
  const slotsByDay = {};
  timeSlots.forEach(slot => {
    if (!slotsByDay[slot.day_of_week]) slotsByDay[slot.day_of_week] = [];
    slotsByDay[slot.day_of_week].push(slot);
  });

  // Group bookings by date
  const bookingsByDate = {};
  bookings.forEach(b => {
    if (!bookingsByDate[b.booking_date]) bookingsByDate[b.booking_date] = [];
    bookingsByDate[b.booking_date].push(b);
  });

  const isToday = (date) => formatDate(date) === formatDate(new Date());
  const isPast = (date) => date < today;

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))}
          disabled={weekOffset === 0}
          className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1"
        >
          ← Previous
        </button>
        <span className="text-sm font-medium text-gray-600">
          {weekDates[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — {weekDates[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </span>
        <button
          onClick={() => setWeekOffset(prev => prev + 1)}
          disabled={weekOffset >= 4}
          className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1"
        >
          Next →
        </button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 overflow-x-auto">
        {weekDates.map((date, i) => {
          const daySlots = slotsByDay[date.getDay()] || [];
          const dayBookings = bookingsByDate[formatDate(date)] || [];
          const past = isPast(date);

          return (
            <div key={i} className={`min-w-[80px] ${past ? 'opacity-40' : ''}`}>
              {/* Day header */}
              <div className={`text-center pb-2 mb-1 border-b border-gray-100 ${isToday(date) ? 'text-brand-600' : 'text-gray-500'}`}>
                <p className="text-xs font-medium">{DAY_NAMES_SHORT[date.getDay()]}</p>
                <p className={`text-lg font-semibold ${isToday(date) ? 'bg-brand-600 text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto' : ''}`}>
                  {date.getDate()}
                </p>
              </div>

              {/* Time slots */}
              <div className="space-y-1">
                {daySlots.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-[10px] text-gray-300">—</p>
                  </div>
                )}
                {daySlots.map(slot => {
                  // Check if this slot has a booking
                  const booked = dayBookings.some(b =>
                    b.start_time <= slot.start_time && b.end_time >= slot.end_time &&
                    ['confirmed', 'awaiting_teacher'].includes(b.status)
                  );

                  const isClickable = !past && !booked && onSlotClick;

                  return (
                    <button
                      key={slot.id}
                      onClick={() => isClickable && onSlotClick(slot, formatDate(date))}
                      disabled={!isClickable}
                      className={`w-full text-left px-1.5 py-1 rounded text-[11px] leading-tight transition-colors ${
                        booked
                          ? 'bg-gray-100 text-gray-400 cursor-default'
                          : isClickable
                            ? 'bg-brand-50 text-brand-700 hover:bg-brand-100 cursor-pointer border border-brand-200'
                            : 'bg-green-50 text-green-600 cursor-default'
                      }`}
                    >
                      <span className="font-medium">{slot.start_time}</span>
                      <span className="text-[10px] block">{slot.end_time}</span>
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
