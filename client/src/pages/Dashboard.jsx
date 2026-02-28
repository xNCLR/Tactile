import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import CalendarView from '../components/CalendarView';

function DisputeModal({ booking, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [refundType, setRefundType] = useState('full');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!reason.trim()) { setError('Please describe the issue'); return; }
    setSubmitting(true);
    setError('');
    try {
      await api.createDispute({ bookingId: booking.id, reason: reason.trim(), refundType });
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
        <h2 className="text-lg font-bold mb-1">Report a Problem</h2>
        <p className="text-sm text-gray-500 mb-4">Describe the issue with your booking.</p>
        {error && <div className="bg-red-50 text-red-600 text-sm p-2 rounded-lg mb-3">{error}</div>}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">What happened?</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
            placeholder="Describe the issue..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Refund requested</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="refundType" value="full" checked={refundType === 'full'} onChange={() => setRefundType('full')}
                className="text-brand-600 focus:ring-brand-500" />
              Full refund
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="refundType" value="partial" checked={refundType === 'partial'} onChange={() => setRefundType('partial')}
                className="text-brand-600 focus:ring-brand-500" />
              Partial refund
            </label>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 text-sm text-gray-600 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 text-sm bg-red-600 text-white py-2.5 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50">
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DisputeResponseModal({ dispute, onClose, onSubmit }) {
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleRespond = async (action) => {
    setSubmitting(true);
    setError('');
    try {
      await api.respondToDispute(dispute.id, { action, response: response.trim() || undefined });
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
        <h2 className="text-lg font-bold mb-1">Respond to Dispute</h2>
        <p className="text-sm text-gray-500 mb-2">Student requested a {dispute.refund_type} refund:</p>
        <p className="text-sm bg-gray-50 p-3 rounded-lg mb-4 italic">&ldquo;{dispute.reason}&rdquo;</p>
        {error && <div className="bg-red-50 text-red-600 text-sm p-2 rounded-lg mb-3">{error}</div>}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Your response (optional)</label>
          <textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={2}
            placeholder="Add a note..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 text-sm text-gray-600 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={() => handleRespond('decline')} disabled={submitting}
            className="flex-1 text-sm bg-gray-900 text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50">Decline</button>
          <button onClick={() => handleRespond('accept')} disabled={submitting}
            className="flex-1 text-sm bg-red-600 text-white py-2.5 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50">Accept Refund</button>
        </div>
      </div>
    </div>
  );
}

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

function EditReviewModal({ review, onClose, onSubmit }) {
  const [rating, setRating] = useState(review.rating);
  const [comment, setComment] = useState(review.comment || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.editReview(review.id, { rating, comment: comment.trim() || undefined });
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
        <h2 className="text-lg font-bold mb-1">Edit Your Review</h2>
        <p className="text-sm text-gray-500 mb-4">Update your rating and comments.</p>

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
            {submitting ? 'Saving...' : 'Save Changes'}
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
  const [editingReview, setEditingReview] = useState(null);
  const [disputeBooking, setDisputeBooking] = useState(null);
  const [respondDispute, setRespondDispute] = useState(null);
  const [disputes, setDisputes] = useState({ asStudent: [], asTeacher: [] });
  const [rebookSuggestions, setRebookSuggestions] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [teacherTimeSlots, setTeacherTimeSlots] = useState([]);
  const [shortlist, setShortlist] = useState([]);

  const loadData = () => {
    api.getBookings()
      .then((data) => setBookings(data.bookings))
      .catch(console.error)
      .finally(() => setLoading(false));
    api.getDisputes()
      .then((data) => setDisputes(data))
      .catch(console.error);
    api.getRebookSuggestions()
      .then((data) => setRebookSuggestions(data.suggestions || []))
      .catch(console.error);
    api.getShortlist()
      .then((data) => setShortlist(data.teachers || []))
      .catch(console.error);
    if (teacherProfile) {
      api.getEarnings()
        .then(data => setEarnings(data))
        .catch(console.error);
      api.getTeacher(teacherProfile.id)
        .then(data => setTeacherTimeSlots(data.timeSlots || []))
        .catch(console.error);
    }
  };

  useEffect(() => {
    loadData();
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

  const handleEditReviewSubmitted = () => {
    setEditingReview(null);
    // Review is already updated, no need to reload bookings
  };

  const handleDisputeSubmitted = () => {
    setDisputeBooking(null);
    loadData();
  };

  const handleDisputeResponded = () => {
    setRespondDispute(null);
    loadData();
  };

  // Check if a booking already has a dispute
  const bookingHasDispute = (bookingId) => {
    return [...disputes.asStudent, ...disputes.asTeacher].some((d) => d.booking_id === bookingId);
  };

  const statusColor = {
    confirmed: 'bg-green-50 text-green-700',
    pending: 'bg-yellow-50 text-yellow-700',
    awaiting_teacher: 'bg-orange-50 text-orange-600',
    declined: 'bg-red-50 text-red-600',
    cancelled: 'bg-red-50 text-red-600',
    completed: 'bg-blue-50 text-blue-700',
  };

  const handleAccept = async (bookingId) => {
    try {
      await api.acceptBooking(bookingId);
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'confirmed' } : b));
    } catch (err) { alert(err.message); }
  };

  const handleDecline = async (bookingId) => {
    if (!confirm('Decline this booking? The student will be refunded.')) return;
    try {
      await api.declineBooking(bookingId);
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'declined' } : b));
    } catch (err) { alert(err.message); }
  };

  const handleBlockStudent = async (studentId, studentName) => {
    const reason = prompt(`Block ${studentName}? They won't be able to book with you again.\n\nOptional reason:`);
    if (reason === null) return; // cancelled
    try {
      await api.blockStudent(studentId, reason || undefined);
      alert(`${studentName} has been blocked.`);
      loadData();
    } catch (err) {
      alert(err.message);
    }
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

      {/* Earnings */}
      {teacherProfile && earnings && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold mb-4">Earnings</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-brand-600">£{earnings.monthEarnings.toFixed(0)}</p>
              <p className="text-xs text-gray-400 mt-1">This month</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">£{earnings.totalEarnings.toFixed(0)}</p>
              <p className="text-xs text-gray-400 mt-1">All time</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-500">£{earnings.pendingEarnings.toFixed(0)}</p>
              <p className="text-xs text-gray-400 mt-1">Pending</p>
            </div>
          </div>
          {earnings.lessonCount > 0 && (
            <p className="text-xs text-gray-400 text-center mt-3 pt-3 border-t border-gray-100">
              {earnings.lessonCount} lesson{earnings.lessonCount !== 1 ? 's' : ''} completed
            </p>
          )}
        </div>
      )}

      {/* Your Week calendar */}
      {teacherProfile && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold mb-4">Your Week</h2>
          <CalendarView
            timeSlots={teacherTimeSlots}
            bookings={bookings.filter(b => b.my_role === 'teacher')}
            compact
          />
        </div>
      )}

      {/* Rebook nudge */}
      {rebookSuggestions.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-3">Book again?</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {rebookSuggestions.map((s) => {
              const initials = s.name.split(' ').map((n) => n[0]).join('').toUpperCase();
              return (
                <Link
                  key={s.profile_id}
                  to={`/teacher/${s.profile_id}`}
                  className="flex-shrink-0 bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow w-56"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {s.profile_photo ? (
                        <img src={s.profile_photo} alt={s.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-brand-500">{initials}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{s.name}</p>
                      <p className="text-xs text-gray-400">
                        {s.lessons_with} lesson{s.lessons_with !== 1 ? 's' : ''} together
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-brand-600 font-medium">£{s.hourly_rate}/hr</p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Shortlist */}
      {shortlist.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-3">Your Shortlist</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {shortlist.map((teacher) => {
              const initials = teacher.name.split(' ').map((n) => n[0]).join('').toUpperCase();
              return (
                <Link
                  key={teacher.profile_id}
                  to={`/teacher/${teacher.profile_id}`}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {teacher.profile_photo ? (
                        <img src={teacher.profile_photo} alt={teacher.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-brand-500">{initials}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{teacher.name}</p>
                      <p className="text-xs text-brand-600 font-medium">£{teacher.hourly_rate}/hr</p>
                      {teacher.average_rating && (
                        <div className="flex items-center gap-1 mt-1">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <svg key={star} className={`w-3 h-3 ${star <= Math.round(teacher.average_rating) ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                          <span className="text-xs text-gray-500">{teacher.average_rating}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {teacher.postcode && <p className="text-xs text-gray-400">{teacher.postcode}</p>}
                </Link>
              );
            })}
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
                  {booking.meeting_point && (
                    <p className="text-sm text-gray-500">
                      <span className="text-gray-400">Meeting at:</span> {booking.meeting_point}
                    </p>
                  )}
                </div>
                <div className="mt-3 flex gap-3 flex-wrap">
                  {!isMyStudentBooking && booking.status === 'awaiting_teacher' && (
                    <>
                      <button onClick={() => handleAccept(booking.id)} className="text-sm bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700">Accept</button>
                      <button onClick={() => handleDecline(booking.id)} className="text-sm bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700">Decline</button>
                    </>
                  )}
                  {isMyStudentBooking && booking.status === 'awaiting_teacher' && (
                    <span className="text-sm text-gray-500">Waiting for teacher to confirm</span>
                  )}
                  {booking.status === 'confirmed' && (
                    <>
                      <button
                        onClick={() => handleCancel(booking.id)}
                        className="text-sm text-red-500 hover:text-red-700"
                      >
                        Cancel booking
                      </button>
                      <button
                        onClick={() => {
                          const point = prompt('Meeting point:', booking.meeting_point || '');
                          if (point !== null && point.trim()) {
                            api.updateMeetingPoint(booking.id, point.trim())
                              .then(() => setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, meeting_point: point.trim() } : b)))
                              .catch(err => alert(err.message));
                          }
                        }}
                        className="text-sm text-brand-600 hover:text-brand-800"
                      >
                        {booking.meeting_point ? 'Update meeting point' : 'Set meeting point'}
                      </button>
                    </>
                  )}
                  {!isMyStudentBooking && ['completed', 'confirmed'].includes(booking.status) && (
                    <button
                      onClick={() => handleBlockStudent(booking.student_id, booking.student_name)}
                      className="text-sm text-gray-400 hover:text-red-500"
                    >
                      Block student
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
                  {isMyStudentBooking && booking.has_review && booking.review && (
                    <button
                      onClick={() => setEditingReview(booking.review)}
                      className="text-sm text-brand-600 hover:text-brand-800"
                    >
                      Edit review
                    </button>
                  )}
                  {isMyStudentBooking && ['confirmed', 'completed'].includes(booking.status) && !bookingHasDispute(booking.id) && (
                    <button
                      onClick={() => setDisputeBooking(booking)}
                      className="text-sm text-gray-400 hover:text-red-600"
                    >
                      Report a problem
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Disputes Section */}
      {(disputes.asStudent.length > 0 || disputes.asTeacher.length > 0) && (
        <>
          <h2 className="font-semibold mt-8 mb-4">Disputes</h2>
          <div className="space-y-3">
            {/* Student disputes */}
            {disputes.asStudent.map((dispute) => {
              const statusColors = {
                open: 'bg-red-50 border-red-200 text-red-600',
                responded: 'bg-yellow-50 border-yellow-200 text-yellow-600',
                escalated: 'bg-purple-50 border-purple-200 text-purple-600',
                resolved: 'bg-green-50 border-green-200 text-green-600',
              };
              return (
                <div
                  key={dispute.id}
                  className={`rounded-xl border p-4 ${statusColors[dispute.status] || statusColors.open}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-medium">{dispute.teacher_name}</span>
                      <span className="text-xs ml-2">{dispute.refund_type} refund requested</span>
                    </div>
                    <span className="text-xs bg-white/50 px-2 py-0.5 rounded-full font-medium">
                      {dispute.status}
                    </span>
                  </div>
                  <p className="text-sm mb-2 italic">&ldquo;{dispute.reason}&rdquo;</p>
                  {dispute.response && (
                    <p className="text-sm bg-white/40 p-2 rounded mb-2 italic">
                      Response: &ldquo;{dispute.response}&rdquo;
                    </p>
                  )}
                  <p className="text-xs opacity-75">
                    {dispute.booking_date} &middot; {dispute.start_time}
                  </p>
                </div>
              );
            })}

            {/* Teacher disputes */}
            {disputes.asTeacher.map((dispute) => {
              const statusColors = {
                open: 'bg-red-50 border-red-200 text-red-600',
                responded: 'bg-yellow-50 border-yellow-200 text-yellow-600',
                escalated: 'bg-purple-50 border-purple-200 text-purple-600',
                resolved: 'bg-green-50 border-green-200 text-green-600',
              };
              return (
                <div
                  key={dispute.id}
                  className={`rounded-xl border p-4 ${statusColors[dispute.status] || statusColors.open}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-medium">{dispute.student_name}</span>
                      <span className="text-xs ml-2">{dispute.refund_type} refund requested</span>
                    </div>
                    <span className="text-xs bg-white/50 px-2 py-0.5 rounded-full font-medium">
                      {dispute.status}
                    </span>
                  </div>
                  <p className="text-sm mb-2 italic">&ldquo;{dispute.reason}&rdquo;</p>
                  {dispute.response && (
                    <p className="text-sm bg-white/40 p-2 rounded mb-2 italic">
                      Response: &ldquo;{dispute.response}&rdquo;
                    </p>
                  )}
                  <p className="text-xs opacity-75 mb-3">
                    {dispute.booking_date} &middot; {dispute.start_time}
                  </p>
                  {dispute.status === 'open' && (
                    <button
                      onClick={() => setRespondDispute(dispute)}
                      className="text-sm bg-gray-900 text-white px-4 py-1.5 rounded-lg hover:bg-gray-800"
                    >
                      Respond
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {reviewBooking && (
        <ReviewModal
          booking={reviewBooking}
          onClose={() => setReviewBooking(null)}
          onSubmit={handleReviewSubmitted}
        />
      )}
      {editingReview && (
        <EditReviewModal
          review={editingReview}
          onClose={() => setEditingReview(null)}
          onSubmit={handleEditReviewSubmitted}
        />
      )}
      {disputeBooking && (
        <DisputeModal
          booking={disputeBooking}
          onClose={() => setDisputeBooking(null)}
          onSubmit={handleDisputeSubmitted}
        />
      )}
      {respondDispute && (
        <DisputeResponseModal
          dispute={respondDispute}
          onClose={() => setRespondDispute(null)}
          onSubmit={handleDisputeResponded}
        />
      )}
    </div>
  );
}
