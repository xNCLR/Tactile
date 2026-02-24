import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';

export default function Dashboard() {
  const { user, teacherProfile } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getBookings()
      .then((data) => setBookings(data.bookings))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCancel = async (bookingId) => {
    if (!confirm('Cancel this booking? A refund will be processed.')) return;
    try {
      await api.cancelBooking(bookingId);
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled', payment_status: 'refunded' } : b)));
    } catch (err) {
      alert(err.message);
    }
  };

  const statusColor = {
    confirmed: 'bg-green-50 text-green-700',
    pending: 'bg-yellow-50 text-yellow-700',
    cancelled: 'bg-red-50 text-red-600',
    completed: 'bg-blue-50 text-blue-700',
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link to="/profile/edit" className="text-sm text-brand-600 hover:underline">Edit Profile</Link>
      </div>
      <p className="text-gray-500 mb-6">
        Welcome back, {user?.name}. You're logged in as a <span className="font-medium text-gray-700">{user?.role}</span>.
      </p>

      {/* Teacher profile summary */}
      {user?.role === 'teacher' && teacherProfile && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold mb-2">Your Teaching Profile</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Rate:</span>{' '}
              <span className="font-medium">£{teacherProfile.hourly_rate}/hr</span>
            </div>
            <div>
              <span className="text-gray-500">Weekdays:</span>{' '}
              <span className="font-medium">{teacherProfile.available_weekdays ? 'Available' : 'Unavailable'}</span>
            </div>
            <div>
              <span className="text-gray-500">Weekends:</span>{' '}
              <span className="font-medium">{teacherProfile.available_weekends ? 'Available' : 'Unavailable'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Bookings */}
      <h2 className="font-semibold mb-4">
        {user?.role === 'teacher' ? 'Incoming Bookings' : 'Your Bookings'}
      </h2>

      {loading ? (
        <p className="text-gray-400 py-8 text-center">Loading bookings...</p>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          No bookings yet. {user?.role === 'student' && 'Find a teacher to get started!'}
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <div key={booking.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="font-medium">
                    {user?.role === 'student' ? booking.teacher_name : booking.student_name}
                  </span>
                  {user?.role === 'teacher' && booking.student_email && (
                    <span className="text-sm text-gray-400 ml-2">{booking.student_email}</span>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[booking.status] || ''}`}>
                  {booking.status}
                </span>
              </div>
              <div className="text-sm text-gray-500 space-y-1">
                <p>{booking.booking_date} &middot; {booking.start_time} – {booking.end_time}</p>
                <p>
                  {booking.duration_hours}h &middot; £{booking.total_price?.toFixed(2)}
                  {booking.payment_status === 'refunded' && <span className="text-red-500 ml-1">(refunded)</span>}
                </p>
                {booking.notes && <p className="italic text-gray-400">"{booking.notes}"</p>}
              </div>
              {booking.status === 'confirmed' && (
                <button
                  onClick={() => handleCancel(booking.id)}
                  className="mt-3 text-sm text-red-500 hover:text-red-700"
                >
                  Cancel booking
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
