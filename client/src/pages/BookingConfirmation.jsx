import { useLocation, Link } from 'react-router-dom';

export default function BookingConfirmation() {
  const { state } = useLocation();
  const booking = state?.booking;

  if (!booking) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-stone">Booking details not found.</p>
        <Link to="/dashboard" className="text-terracotta hover:underline text-sm">Go to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="w-16 h-16 bg-blush rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="font-serif text-3xl text-bark mb-2">Booking Confirmed!</h1>
      <p className="text-stone mb-6">You're all set for your photography lesson.</p>

      <div className="bg-white rounded-2xl border border-sand/60 p-6 text-left mb-6">
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="font-mono text-stone">Teacher</span>
            <span className="font-medium text-bark">{booking.teacherName}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-stone">Date</span>
            <span className="font-medium text-bark">{booking.bookingDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-stone">Time</span>
            <span className="font-medium text-bark">{booking.startTime} – {booking.endTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-stone">Duration</span>
            <span className="font-medium text-bark">{booking.durationHours} hour{booking.durationHours > 1 ? 's' : ''}</span>
          </div>
          <hr className="border-sand/40" />
          <div className="flex justify-between">
            <span className="font-mono text-stone">Total paid</span>
            <span className="font-serif text-lg font-semibold text-terracotta">£{booking.totalPrice?.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <p className="text-sm text-clay mb-6 font-mono">
        A confirmation email has been sent. The teacher has been notified.
      </p>

      <Link
        to="/dashboard"
        className="inline-block bg-bark text-white px-6 py-2.5 rounded-full font-medium hover:bg-charcoal transition-colors"
      >
        View Dashboard
      </Link>
    </div>
  );
}
