import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Inner payment form (rendered inside Stripe Elements provider)
function PaymentForm({ bookingId, totalPrice, teacherName, onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [ready, setReady] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    onError('');

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      onError(error.message);
      setProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      // Confirm booking on our backend
      try {
        const data = await api.confirmBooking({
          bookingId,
          paymentIntentId: paymentIntent.id,
        });
        onSuccess(data.booking);
      } catch (err) {
        onError(err.message);
        setProcessing(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Card Details</label>
        <div className="border border-gray-200 rounded-lg p-3">
          <PaymentElement onReady={() => setReady(true)} />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-600">Total</span>
          <span className="text-lg font-semibold">£{totalPrice}</span>
        </div>
        <button
          type="submit"
          disabled={processing || !stripe || !ready}
          className="w-full bg-brand-600 text-white py-3 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {processing ? 'Processing payment...' : `Pay £${totalPrice}`}
        </button>
        <p className="text-xs text-gray-400 text-center mt-2">
          Secured by Stripe · Test mode
        </p>
      </div>
    </form>
  );
}

export default function BookingModal({ teacher, timeSlots, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [duration, setDuration] = useState(1);
  const [notes, setNotes] = useState('');
  const [meetingPoint, setMeetingPoint] = useState('');
  const [error, setError] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [weeks, setWeeks] = useState(4);

  // Stripe payment state
  const [step, setStep] = useState('details'); // 'details' | 'payment'
  const [clientSecret, setClientSecret] = useState(null);
  const [bookingId, setBookingId] = useState(null);
  const [creatingIntent, setCreatingIntent] = useState(false);

  function getNextDate(dayOfWeek) {
    const today = new Date();
    const diff = (dayOfWeek - today.getDay() + 7) % 7 || 7;
    const next = new Date(today);
    next.setDate(today.getDate() + diff);
    return next.toISOString().split('T')[0];
  }

  const perLesson = (teacher.hourly_rate * duration).toFixed(2);
  const totalPrice = recurring ? (perLesson * weeks).toFixed(2) : perLesson;

  const handleProceedToPayment = async () => {
    if (!user) { navigate('/login'); return; }
    if (!selectedSlot || !selectedDate) {
      setError('Please select a time slot and date');
      return;
    }

    setCreatingIntent(true);
    setError('');

    try {
      const [startH, startM] = selectedSlot.start_time.split(':').map(Number);
      const endH = startH + duration;
      const endTime = `${String(endH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;

      if (recurring) {
        const data = await api.createRecurringIntent({
          teacherId: teacher.profile_id,
          startTime: selectedSlot.start_time,
          endTime,
          durationHours: duration,
          dayOfWeek: selectedSlot.day_of_week,
          weeks,
          notes,
          meetingPoint: meetingPoint.trim() || undefined,
        });
        setClientSecret(data.clientSecret);
        setBookingId(data.bookingIds[0]);
        setStep('payment');
      } else {
        const data = await api.createPaymentIntent({
          teacherId: teacher.profile_id,
          bookingDate: selectedDate,
          startTime: selectedSlot.start_time,
          endTime,
          durationHours: duration,
          notes,
          meetingPoint: meetingPoint.trim() || undefined,
        });

        setClientSecret(data.clientSecret);
        setBookingId(data.bookingId);
        setStep('payment');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingIntent(false);
    }
  };

  const handlePaymentSuccess = (booking) => {
    navigate(`/booking/confirmation/${booking.id}`, { state: { booking } });
  };

  const stripeOptions = clientSecret ? {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: { colorPrimary: '#e05e48', borderRadius: '8px' },
    },
  } : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            {step === 'details' ? 'Book a Lesson' : 'Payment'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <p className="text-sm text-gray-500 mb-4">with {teacher.name} — £{teacher.hourly_rate}/hr</p>

        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}

        {step === 'details' && (
          <>
            {/* Time slots */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Available Time Slots</label>
              <div className="space-y-2">
                {timeSlots.length === 0 && <p className="text-sm text-gray-400">No available slots</p>}
                {timeSlots.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => { setSelectedSlot(slot); setSelectedDate(getNextDate(slot.day_of_week)); }}
                    className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                      selectedSlot?.id === slot.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="font-medium">{DAY_NAMES[slot.day_of_week]}</span>
                    <span className="text-gray-500 ml-2">{slot.start_time} – {slot.end_time}</span>
                  </button>
                ))}
              </div>
            </div>

            {selectedSlot && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (hours)</label>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value={1}>1 hour</option>
                <option value={2}>2 hours</option>
                <option value={3}>3 hours</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                Book weekly (recurring)
              </label>
            </div>

            {recurring && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of weeks</label>
                <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {[2,3,4,5,6,8,10,12].map(w => (
                    <option key={w} value={w}>{w} weeks</option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="What would you like to focus on?"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none h-20" />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Point (optional)</label>
              <input type="text" value={meetingPoint} onChange={(e) => setMeetingPoint(e.target.value)}
                placeholder="e.g. Outside Costa Coffee, W1D 3AF"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>

            <div className="border-t border-gray-100 pt-4">
              {recurring && (
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-500">{weeks} × £{perLesson}/lesson</span>
                </div>
              )}
              {!recurring && teacher.first_lesson_discount > 0 && (
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-green-600">{teacher.first_lesson_discount}% first lesson discount</span>
                  <span className="text-sm text-green-600">-£{(perLesson * teacher.first_lesson_discount / 100).toFixed(2)}</span>
                </div>
              )}
              {recurring && weeks >= 4 && teacher.bulk_discount > 0 && (
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-green-600">{teacher.bulk_discount}% package discount</span>
                  <span className="text-sm text-green-600">-£{(totalPrice * teacher.bulk_discount / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-gray-600">Total</span>
                <span className="text-lg font-semibold">£{totalPrice}</span>
              </div>
              <button
                onClick={handleProceedToPayment}
                disabled={creatingIntent || !selectedSlot}
                className="w-full bg-brand-600 text-white py-3 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creatingIntent ? 'Setting up payment...' : `Continue to Payment — £${totalPrice}`}
              </button>
            </div>
          </>
        )}

        {step === 'payment' && clientSecret && (
          <Elements stripe={stripePromise} options={stripeOptions}>
            <div className="mb-4 bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Date</span>
                <span className="font-medium">{selectedDate}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span>Time</span>
                <span className="font-medium">{selectedSlot.start_time} · {duration}h</span>
              </div>
            </div>
            <PaymentForm
              bookingId={bookingId}
              totalPrice={totalPrice}
              teacherName={teacher.name}
              onSuccess={handlePaymentSuccess}
              onError={setError}
            />
          </Elements>
        )}
      </div>
    </div>
  );
}
