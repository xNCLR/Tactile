import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import BookingModal from '../components/BookingModal';
import CalendarView from '../components/CalendarView';
import usePageMeta from '../hooks/usePageMeta';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function StarRating({ rating, size = 'sm' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-5 h-5' };
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} className={`${sizes[size]} ${star <= rating ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function InquiryModal({ teacherProfileId, teacherName, onClose }) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!content.trim()) return;
    setSending(true);
    setError('');
    try {
      await api.sendInquiry(teacherProfileId, content.trim());
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-sm w-full p-6">
        <h2 className="text-lg font-bold mb-1">Ask {teacherName}</h2>
        {sent ? (
          <>
            <p className="text-sm text-gray-500 mb-4">Message sent! Check your messages for their reply.</p>
            <button onClick={onClose} className="w-full bg-brand-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700">Done</button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">Ask about their teaching style, equipment, or anything else before booking.</p>
            {error && <div className="bg-red-50 text-red-600 text-sm p-2 rounded-lg mb-3">{error}</div>}
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3}
              placeholder="Hi, I'm interested in learning about..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 text-sm text-gray-600 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSend} disabled={sending || !content.trim()}
                className="flex-1 text-sm bg-brand-600 text-white py-2.5 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50">
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function TeacherProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [teacher, setTeacher] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({ average: null, total: 0 });
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [showInquiry, setShowInquiry] = useState(false);
  const [isShortlisted, setIsShortlisted] = useState(false);
  const [togglingShortlist, setTogglingShortlist] = useState(false);

  usePageMeta({
    title: teacher ? teacher.name + ' — Photography Teacher' : 'Teacher',
    description: teacher?.bio || 'Book a photography lesson with a local teacher in London.',
  });

  useEffect(() => {
    api.getTeacher(id)
      .then((data) => {
        setTeacher(data.teacher);
        setTimeSlots(data.timeSlots);
        // Fetch reviews
        return api.getTeacherReviews(data.teacher.profile_id);
      })
      .then((data) => {
        setReviews(data.reviews);
        setReviewStats({ average: data.average, total: data.total });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  // Check if teacher is shortlisted
  useEffect(() => {
    if (!user) return;
    api.getShortlist()
      .then((data) => {
        const match = data.teachers.some((t) => t.profile_id === parseInt(id));
        setIsShortlisted(match);
      })
      .catch(console.error);
  }, [id, user]);

  const handleToggleShortlist = async () => {
    if (!user) {
      alert('Please log in to shortlist teachers');
      return;
    }
    setTogglingShortlist(true);
    try {
      await api.toggleShortlist(id);
      setIsShortlisted((prev) => !prev);
    } catch (err) {
      alert(err.message);
    } finally {
      setTogglingShortlist(false);
    }
  };

  if (loading) return <div className="text-center py-16 text-gray-400">Loading...</div>;
  if (!teacher) return <div className="text-center py-16 text-gray-500">Teacher not found</div>;

  const initials = teacher.name.split(' ').map((n) => n[0]).join('').toUpperCase();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="h-48 bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center">
          {teacher.profile_photo ? (
            <img src={teacher.profile_photo} alt={teacher.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-6xl font-bold text-brand-500">{initials}</span>
          )}
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{teacher.name}</h1>
                {teacher.verification_status === 'verified' && (
                  <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20" title="Verified Teacher">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <p className="text-gray-500">{teacher.postcode}</p>
              {reviewStats.average && (
                <div className="flex items-center gap-2 mt-1">
                  <StarRating rating={Math.round(reviewStats.average)} size="sm" />
                  <span className="text-sm text-gray-500">{reviewStats.average} ({reviewStats.total} review{reviewStats.total !== 1 ? 's' : ''})</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-brand-600">£{teacher.hourly_rate}</span>
              <p className="text-sm text-gray-400">per hour</p>
            </div>
          </div>

          {teacher.categories && teacher.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {teacher.categories.map(cat => (
                <span key={cat.slug} className="text-sm bg-brand-50 text-brand-600 px-3 py-1 rounded-full">{cat.name}</span>
              ))}
            </div>
          )}

          {teacher.cancellation_hours && (
            <p className="text-xs text-gray-500 mb-3">{teacher.cancellation_hours}h cancellation policy</p>
          )}

          {teacher.bio && <p className="text-gray-700 mb-4 leading-relaxed">{teacher.bio}</p>}

          {teacher.equipment_requirements && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-1">What you'll need</h3>
              <p className="text-gray-700">{teacher.equipment_requirements}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-6">
            {teacher.available_weekdays === 1 && (
              <span className="bg-green-50 text-green-600 text-sm px-3 py-1 rounded-full">Available weekdays</span>
            )}
            {teacher.available_weekends === 1 && (
              <span className="bg-blue-50 text-blue-600 text-sm px-3 py-1 rounded-full">Available weekends</span>
            )}
            {teacher.search_radius_km > 0 && (
              <span className="bg-purple-50 text-purple-600 text-sm px-3 py-1 rounded-full">Travels up to {teacher.search_radius_km} km</span>
            )}
            {teacher.lesson_count >= 5 && (
              <span className="bg-gray-50 text-gray-600 text-sm px-3 py-1 rounded-full">{teacher.lesson_count} lessons taught</span>
            )}
            {teacher.reliability != null && teacher.reliability >= 90 && (
              <span className="bg-emerald-50 text-emerald-600 text-sm px-3 py-1 rounded-full">
                {teacher.reliability}% lessons honoured
              </span>
            )}
            {teacher.first_lesson_discount > 0 && (
              <span className="bg-green-50 text-green-600 text-sm px-3 py-1 rounded-full">
                {teacher.first_lesson_discount}% off first lesson
              </span>
            )}
            {teacher.bulk_discount > 0 && (
              <span className="bg-orange-50 text-orange-600 text-sm px-3 py-1 rounded-full">
                {teacher.bulk_discount}% off weekly packages
              </span>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowBooking(true)}
              className="flex-1 bg-brand-600 text-white py-3 rounded-lg font-medium hover:bg-brand-700 transition-colors"
            >
              Book a Lesson
            </button>
            <button
              onClick={() => setShowInquiry(true)}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Ask a Question
            </button>
            <button
              onClick={handleToggleShortlist}
              disabled={togglingShortlist}
              className="px-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center"
              title={isShortlisted ? 'Remove from shortlist' : 'Shortlist'}
            >
              <svg
                className={`w-6 h-6 ${isShortlisted ? 'text-brand-500 fill-brand-500' : 'text-gray-400'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Credentials */}
      {teacher.credentials && teacher.credentials.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold mb-3">Credentials</h2>
          <ul className="space-y-2">
            {teacher.credentials.map((cred) => (
              <li key={cred.id} className="flex items-start gap-2 text-sm text-gray-700">
                <svg className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {cred.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Portfolio Photos */}
      {(teacher.photo_1 || teacher.photo_2 || teacher.photo_3) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold mb-4">Portfolio</h2>
          <div className="grid grid-cols-3 gap-3">
            {[teacher.photo_1, teacher.photo_2, teacher.photo_3].filter(Boolean).map((photo, i) => (
              <div key={i} className="aspect-square rounded-lg overflow-hidden">
                <img src={photo} alt={`Portfolio ${i + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      {reviews.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Reviews</h2>
            <span className="text-sm text-gray-400">{reviewStats.total} review{reviewStats.total !== 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {review.student_photo ? (
                      <img src={review.student_photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-brand-500">
                        {review.student_name?.split(' ').map((n) => n[0]).join('').toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{review.student_name}</p>
                    <StarRating rating={review.rating} size="sm" />
                  </div>
                </div>
                {review.comment && <p className="text-sm text-gray-600 ml-11">{review.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available slots */}
      {timeSlots.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold mb-4">Availability</h2>
          <CalendarView
            timeSlots={timeSlots}
            onSlotClick={(slot, date) => {
              setShowBooking(true);
            }}
          />
        </div>
      )}

      {showBooking && (
        <BookingModal
          teacher={teacher}
          timeSlots={timeSlots}
          onClose={() => setShowBooking(false)}
        />
      )}

      {showInquiry && (
        <InquiryModal
          teacherProfileId={teacher.profile_id}
          teacherName={teacher.name}
          onClose={() => setShowInquiry(false)}
        />
      )}
    </div>
  );
}
