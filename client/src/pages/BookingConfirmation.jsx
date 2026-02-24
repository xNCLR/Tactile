import { useLocation, Link } from 'react-router-dom';

export default function BookingConfirmation() {
  const { state } = useLocation();
  const booking = state?.booking;

  if (!booking) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">Booking details not found.</p>
        <Link to="/dashboard" className="text-brand-600 hover:underline text-sm">Go to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold mb-2">Booking Confirmed!</h1>
      <p className="text-gray-500 mb-6">You're all set for your photography lesson.</p>

      <div className="bg-white rounded-xl border border-gray-200 p-6 text-left mb-6">
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Teacher</span>
            <span className="font-medium">{booking.teacherName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Date</span>
            <span className="font-medium">{booking.bookingDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Time</span>
            <span className="font-medium">{booking.startTime} – {booking.endTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Duration</span>
            <span className="font-medium">{booking.durationHours} hour{booking.durationHours > 1 ? 's' : ''}</span>
          </div>
          <hr className="border-gray-100" />
          <div className="flex justify-between">
            <span className="text-gray-500">Total paid</span>
            <span className="font-semibold text-brand-600">£{booking.totalPrice?.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-6">
        A confirmation email has been sent (mock). The teacher has been notified.
      </p>

      <Link
        to="/dashboard"
        className="inline-block bg-brand-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-brand-700 transition-colors"
      >
        View Dashboard
      </Link>
    </div>
  );
}
