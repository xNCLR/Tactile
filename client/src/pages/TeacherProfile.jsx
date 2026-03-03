import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import BookingModal from '../components/BookingModal';
import CalendarView from '../components/CalendarView';
import StarRating from '../components/StarRating';
import usePageMeta from '../hooks/usePageMeta';
import AuthModal from '../components/AuthModal';
import { getInitials, getDisplayName } from '../utils/helpers';

function InquiryModal({ teacherProfileId, teacherName, onClose }) {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!content.trim()) return;
    setSending(true);
    setError('');
    try {
      // Get or create a conversation, then send message to it
      const { conversation } = await api.getOrCreateConversation(teacherProfileId);
      await api.sendConversationMessage(conversation.id, content.trim());
      setConversationId(conversation.id);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleGoToMessages = () => {
    if (conversationId) {
      navigate(`/messages?thread=${conversationId}`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-sand">
        <h2 className="text-lg font-bold font-serif text-bark mb-1">Ask {teacherName}</h2>
        {sent ? (
          <>
            <p className="text-sm text-stone mb-4">Message sent!</p>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 text-sm text-bark py-2.5 rounded-full border border-sand hover:bg-blush">Close</button>
              <button onClick={handleGoToMessages} className="flex-1 bg-bark text-white py-2.5 rounded-full text-sm font-medium hover:bg-charcoal">Go to Chat</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-stone mb-4">Ask about their teaching style, equipment, or anything else before booking.</p>
            {error && <div className="bg-red-50 text-red-600 text-sm p-2 rounded-2xl mb-3">{error}</div>}
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3}
              placeholder="Hi, I'm interested in learning about..."
              className="w-full border border-sand rounded-2xl px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-terracotta resize-none" />
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 text-sm text-bark py-2.5 rounded-full border border-sand hover:bg-blush">Cancel</button>
              <button onClick={handleSend} disabled={sending || !content.trim()}
                className="flex-1 text-sm bg-bark text-white py-2.5 rounded-full font-medium hover:bg-charcoal disabled:opacity-50">
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
  const [bookingPreselect, setBookingPreselect] = useState(null); // { startTime, endTime, date, dayOfWeek }
  const [showInquiry, setShowInquiry] = useState(false);
  const [isShortlisted, setIsShortlisted] = useState(false);
  const [togglingShortlist, setTogglingShortlist] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMessage, setAuthMessage] = useState('');

  usePageMeta({
    title: teacher ? getDisplayName(teacher.name) + ' — Photography Teacher' : 'Teacher',
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
        const match = data.teachers.some((t) => String(t.profile_id) === String(id));
        setIsShortlisted(match);
      })
      .catch(console.error);
  }, [id, user]);

  const handleToggleShortlist = async () => {
    if (!user) {
      setAuthMessage('Create an account or log in to save teachers.');
      setShowAuthModal(true);
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

  if (loading) return <div className="text-center py-16 text-clay">Loading...</div>;
  if (!teacher) return <div className="text-center py-16 text-stone">Teacher not found</div>;

  const initials = getInitials(teacher.name);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand overflow-hidden mb-6">
        <div className="h-48 bg-gradient-to-br from-blush to-sand flex items-center justify-center">
          {teacher.profile_photo ? (
            <img src={teacher.profile_photo} alt={teacher.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-6xl font-bold font-serif text-terracotta">{initials}</span>
          )}
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold font-serif text-bark">{getDisplayName(teacher.name)}</h1>
                {teacher.verification_status === 'verified' && (
                  <svg className="w-6 h-6 text-terracotta" fill="currentColor" viewBox="0 0 20 20" title="Verified Teacher">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <p className="text-stone font-mono">{teacher.postcode}</p>
              {reviewStats.average && (
                <div className="flex items-center gap-2 mt-1">
                  <StarRating rating={Math.round(reviewStats.average)} size="sm" />
                  <span className="text-sm text-stone font-mono">{reviewStats.average} ({reviewStats.total} review{reviewStats.total !== 1 ? 's' : ''})</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold font-serif text-terracotta">£{teacher.hourly_rate}</span>
              <p className="text-sm text-stone font-mono">per hour</p>
            </div>
          </div>

          {teacher.categories && teacher.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {teacher.categories.map(cat => (
                <span key={cat.slug} className="text-sm bg-blush text-bark px-3 py-1 rounded-full font-mono">{cat.name}</span>
              ))}
            </div>
          )}

          {teacher.cancellation_hours && (
            <p className="text-xs text-stone mb-3 font-mono">{teacher.cancellation_hours}h cancellation policy</p>
          )}

          {teacher.bio && <p className="text-bark mb-4 leading-relaxed">{teacher.bio}</p>}

          {teacher.equipment_requirements && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-stone mb-1 font-mono">What you'll need</h3>
              <p className="text-bark">{teacher.equipment_requirements}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-6">
            {teacher.available_weekdays === 1 && (
              <span className="bg-paper text-stone text-sm px-3 py-1 rounded-full font-mono">Available weekdays</span>
            )}
            {teacher.available_weekends === 1 && (
              <span className="bg-paper text-stone text-sm px-3 py-1 rounded-full font-mono">Available weekends</span>
            )}
            {teacher.search_radius_km > 0 && (
              <span className="bg-paper text-stone text-sm px-3 py-1 rounded-full font-mono">Travels up to {teacher.search_radius_km} km</span>
            )}
            {teacher.lesson_count >= 5 && (
              <span className="bg-paper text-stone text-sm px-3 py-1 rounded-full font-mono">{teacher.lesson_count} lessons taught</span>
            )}
            {teacher.reliability != null && teacher.reliability >= 90 && (
              <span className="bg-paper text-bark text-sm px-3 py-1 rounded-full font-mono">
                {teacher.reliability}% lessons honoured
              </span>
            )}
            {teacher.bulk_discount > 0 && (
              <span className="bg-blush text-terracotta text-sm px-3 py-1 rounded-full font-mono">
                {teacher.bulk_discount}% off weekly packages
              </span>
            )}
          </div>

          {teacher.first_lesson_discount > 0 && (
            <div className="bg-blush border border-sand rounded-2xl px-4 py-3 mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-bark font-mono">
                  {teacher.first_lesson_discount}% off your first lesson
                </p>
                <p className="text-xs text-terracotta mt-0.5 font-mono">
                  £{(teacher.hourly_rate * (1 - teacher.first_lesson_discount / 100)).toFixed(2)} for your first hour instead of £{teacher.hourly_rate.toFixed(2)}
                </p>
              </div>
              <span className="text-terracotta flex-shrink-0 ml-3">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </span>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                if (!user) { setAuthMessage('Create an account or log in to book a lesson.'); setShowAuthModal(true); return; }
                setBookingPreselect(null); setShowBooking(true);
              }}
              className="flex-1 bg-bark text-white py-3 rounded-full font-medium hover:bg-charcoal transition-colors"
            >
              Book a Lesson
            </button>
            <button
              onClick={() => {
                if (!user) { setAuthMessage('Create an account or log in to send a message.'); setShowAuthModal(true); return; }
                setShowInquiry(true);
              }}
              className="flex-1 bg-blush text-bark py-3 rounded-full font-medium hover:bg-sand transition-colors"
            >
              Ask a Question
            </button>
            <button
              onClick={handleToggleShortlist}
              disabled={togglingShortlist}
              className="px-3 bg-blush text-bark rounded-full font-medium hover:bg-sand transition-colors disabled:opacity-50 flex items-center justify-center"
              title={isShortlisted ? 'Remove from shortlist' : 'Shortlist'}
            >
              <svg
                className={`w-6 h-6 ${isShortlisted ? 'text-terracotta fill-terracotta' : 'text-clay'}`}
                fill={isShortlisted ? 'currentColor' : 'none'}
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Credentials */}
      {teacher.credentials && teacher.credentials.length > 0 && (
        <div className="bg-white rounded-2xl border border-sand p-6 mb-6">
          <h2 className="font-semibold mb-3 font-serif text-bark">Credentials</h2>
          <ul className="space-y-2">
            {teacher.credentials.map((cred) => (
              <li key={cred.id} className="flex items-start gap-2 text-sm text-bark">
                <svg className="w-4 h-4 text-terracotta mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                </svg>
                {cred.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended Gear */}
      {teacher.gear && teacher.gear.length > 0 && (
        <div className="bg-white rounded-2xl border border-sand p-6 mb-6">
          <h2 className="font-semibold mb-3 font-serif text-bark">Recommended Gear</h2>
          <p className="text-xs text-clay mb-3 font-mono">Equipment {teacher.name.split(' ')[0]} recommends for students.</p>
          <ul className="space-y-3">
            {teacher.gear.map((item) => (
              <li key={item.id} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-paper flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-stone" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-medium text-terracotta hover:underline">
                      {item.name}
                      <svg className="w-3 h-3 inline ml-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ) : (
                    <span className="text-sm font-medium text-bark">{item.name}</span>
                  )}
                  {item.description && (
                    <p className="text-xs text-stone mt-0.5 font-mono">{item.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Portfolio Photos */}
      {(teacher.photo_1 || teacher.photo_2 || teacher.photo_3) && (
        <div className="bg-white rounded-2xl border border-sand p-6 mb-6">
          <h2 className="font-semibold mb-4 font-serif text-bark">Portfolio</h2>
          <div className="grid grid-cols-3 gap-3">
            {[teacher.photo_1, teacher.photo_2, teacher.photo_3].filter(Boolean).map((photo, i) => (
              <div key={i} className="aspect-square rounded-2xl overflow-hidden">
                <img src={photo} alt={`Portfolio ${i + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      {reviews.length > 0 && (
        <div className="bg-white rounded-2xl border border-sand p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold font-serif text-bark">Reviews</h2>
            <span className="text-sm text-clay font-mono">{reviewStats.total} review{reviewStats.total !== 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="border-b border-sand last:border-0 pb-4 last:pb-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blush to-sand flex items-center justify-center overflow-hidden flex-shrink-0">
                    {review.student_photo ? (
                      <img src={review.student_photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-terracotta">
                        {getInitials(review.student_name)}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-bark">{review.student_name}</p>
                    <StarRating rating={review.rating} size="sm" />
                  </div>
                </div>
                {review.comment && <p className="text-sm text-bark ml-11">{review.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available slots */}
      {timeSlots.length > 0 && (
        <div className="bg-white rounded-2xl border border-sand p-6">
          <h2 className="font-semibold mb-4 font-serif text-bark">Availability</h2>
          <CalendarView
            timeSlots={timeSlots}
            onSlotClick={(seg, date) => {
              if (!user) { setAuthMessage('Create an account or log in to book a lesson.'); setShowAuthModal(true); return; }
              setBookingPreselect({
                startTime: seg.startTime,
                endTime: seg.endTime,
                date,
                dayOfWeek: seg.dayOfWeek,
              });
              setShowBooking(true);
            }}
          />
        </div>
      )}

      {showBooking && (
        <BookingModal
          teacher={teacher}
          timeSlots={timeSlots}
          preselect={bookingPreselect}
          onClose={() => setShowBooking(false)}
        />
      )}

      {showInquiry && (
        <InquiryModal
          teacherProfileId={teacher.profile_id}
          teacherName={getDisplayName(teacher.name)}
          onClose={() => setShowInquiry(false)}
        />
      )}

      {showAuthModal && (
        <AuthModal
          message={authMessage}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}
