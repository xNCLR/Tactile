import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';

function ReviewModal({ booking, onClose, onSubmit }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.createReview({ bookingId: booking.id, rating, comment: comment.trim() || undefined });
      onSubmit();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-sm w-full p-6">
        <h2 className="text-lg font-bold mb-1">Leave a Review</h2>
        <p className="text-sm text-gray-500 mb-4">How was your lesson with {booking.teacher_name}?</p>

        {error && <div className="bg-red-50 text-red-600 text-sm p-2 rounded-lg mb-3">{error}</div>}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} onClick={() => setRating(star)} className="focus:outline-none">
                <svg className={`w-8 h-8 ${star <= rating ? 'text-yellow-400' : 'text-gray-200'} hover:text-yellow-300 transition-colors`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Comment (optional)</label>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
            placeholder="Tell others about your experience..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 text-sm text-gray-600 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 text-sm bg-brand-600 text-white py-2.5 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50">
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, teacherProfile } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewBooking, setReviewBooking] = useState(null);

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

  const handleReviewSubmitted = () => {
    setReviewBooking(null);
    setBookings((prev) => prev.map((b) => (b.id === reviewBooking?.id ? { ...b, status: 'completed', has_review: 1 } : b)));
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
      <p className="text-gray-500 mb-6">Welcome back, {user?.name}.</p>

      {/* Start Teaching CTA — shown if user has no teacher profile */}
      {!teacherProfile && (
        <div className="bg-gradient-to-br from-brand-50 to-brand-100 rounded-xl border border-brand-200 p-6 mb-6">
          <h2 className="font-semibold mb-1">Share your photography skills</h2>
          <p className="text-sm text-gray-600 mb-4">
            Got a knack for portraits, street, or landscape photography? Set up a teaching profile and start earning.
          </p>
          <Link
            to="/profile/edit"
            className="inline-block bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            Start Teaching
          </Link>
        </div>
      )}

      {/* Teacher profile summary */}
      {teacherProfile && (
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
      <h2 className="font-semibold mb-4">Your Bookings</h2>

      {loading ? (
        <p className="text-gray-400 py-8 text-center">Loading bookings...</p>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          No bookings yet. Find a teacher to get started!
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const isMyStudentBooking = booking.my_role === 'student';
            return (
              <div key={booking.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="font-medium">
                      {isMyStudentBooking ? booking.teacher_name : booking.student_name}
                    </span>
                    {!isMyStudentBooking && booking.student_email && (
                      <span className="text-sm text-gray-400 ml-2">{booking.student_email}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!isMyStudentBooking && (
                      <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">teaching</span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[booking.status] || ''}`}>
                      {booking.status}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-gray-500 space-y-1">
                  <p>{booking.booking_date} &middot; {booking.start_time} – {booking.end_time}</p>
                  <p>
                    {booking.duration_hours}h &middot; £{booking.total_price?.toFixed(2)}
                    {booking.payment_status === 'refunded' && <span className="text-red-500 ml-1">(refunded)</span>}
                  </p>
                  {booking.notes && <p className="italic text-gray-400">"{booking.notes}"</p>}
                </div>
                <div className="mt-3 flex gap-3">
                  {booking.status === 'confirmed' && (
                    <button
                      onClick={() => handleCancel(booking.id)}
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      Cancel booking
                    </button>
                  )}
                  {isMyStudentBooking && (booking.status === 'confirmed' || booking.status === 'completed') && !booking.has_review && (
                    <button
                      onClick={() => setReviewBooking(booking)}
                      className="text-sm text-brand-600 hover:text-brand-800"
                    >
                      Leave a review
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {reviewBooking && (
        <ReviewModal
          booking={reviewBooking}
          onClose={() => setReviewBooking(null)}
          onSubmit={handleReviewSubmitted}
        />
      )}
    </div>
  );
}
