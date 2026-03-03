import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { DAY_NAMES, splitSlotIntoHours, getDisplayName } from '../utils/helpers';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

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
        <label className="block text-sm font-medium text-bark mb-2">Card Details</label>
        <div className="border border-sand/60 rounded-lg p-3">
          <PaymentElement onReady={() => setReady(true)} />
        </div>
      </div>

      <div className="border-t border-sand/40 pt-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-stone">Total</span>
          <span className="text-lg font-serif font-semibold text-bark">£{totalPrice}</span>
        </div>
        <button
          type="submit"
          disabled={processing || !stripe || !ready}
          className="w-full bg-bark text-white py-3 rounded-full font-medium hover:bg-charcoal disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {processing ? 'Processing payment...' : `Pay £${totalPrice}`}
        </button>
        <p className="font-mono text-xs text-clay text-center mt-2">
          Secured by Stripe · Test mode
        </p>
      </div>
    </form>
  );
}

export default function BookingModal({ teacher, timeSlots, preselect, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Build all hourly segments from time slots
  const allSegments = useMemo(() => {
    const segs = [];
    timeSlots.forEach(slot => {
      segs.push(...splitSlotIntoHours(slot));
    });
    return segs;
  }, [timeSlots]);

  // Find max consecutive hours from a given start time on a given day
  const getMaxHours = (startTime, dayOfWeek) => {
    const seg = allSegments.find(s => s.startTime === startTime && s.dayOfWeek === dayOfWeek);
    return seg ? seg.maxHours : 1;
  };

  // Initialize from preselect or empty
  const [selectedStartTime, setSelectedStartTime] = useState(preselect?.startTime || '');
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState(preselect?.dayOfWeek ?? null);
  const [selectedDate, setSelectedDate] = useState(preselect?.date || '');
  const [duration, setDuration] = useState(1);
  const [notes, setNotes] = useState('');
  const [meetingPoint, setMeetingPoint] = useState('');
  const [error, setError] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [weeks, setWeeks] = useState(4);

  // Stripe payment state
  const [step, setStep] = useState(preselect ? 'confirm' : 'select'); // 'select' | 'confirm' | 'payment'
  const [clientSecret, setClientSecret] = useState(null);
  const [bookingId, setBookingId] = useState(null);
  const [creatingIntent, setCreatingIntent] = useState(false);

  const maxHours = (selectedStartTime && selectedDayOfWeek !== null)
    ? getMaxHours(selectedStartTime, selectedDayOfWeek)
    : 3;

  // Reset duration if it exceeds max
  useEffect(() => {
    if (duration > maxHours) setDuration(maxHours);
  }, [maxHours, duration]);

  function getNextDate(dayOfWeek) {
    const today = new Date();
    const diff = (dayOfWeek - today.getDay() + 7) % 7 || 7;
    const next = new Date(today);
    next.setDate(today.getDate() + diff);
    return next.toISOString().split('T')[0];
  }

  const endTimeStr = useMemo(() => {
    if (!selectedStartTime) return '';
    const [h, m] = selectedStartTime.split(':').map(Number);
    return `${String(h + duration).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }, [selectedStartTime, duration]);

  const perLesson = (teacher.hourly_rate * duration).toFixed(2);
  const totalPrice = recurring ? (perLesson * weeks).toFixed(2) : perLesson;

  const handleSelectSegment = (seg) => {
    setSelectedStartTime(seg.startTime);
    setSelectedDayOfWeek(seg.dayOfWeek);
    setSelectedDate(getNextDate(seg.dayOfWeek));
    setDuration(1);
    setStep('confirm');
  };

  const handleProceedToPayment = async () => {
    if (!user) { navigate('/login'); return; }
    if (!selectedStartTime || !selectedDate) {
      setError('Please select a time slot and date');
      return;
    }

    setCreatingIntent(true);
    setError('');

    try {
      if (recurring) {
        const data = await api.createRecurringIntent({
          teacherId: teacher.profile_id,
          startTime: selectedStartTime,
          endTime: endTimeStr,
          durationHours: duration,
          dayOfWeek: selectedDayOfWeek,
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
          startTime: selectedStartTime,
          endTime: endTimeStr,
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
      variables: { colorPrimary: '#CC6B4D', borderRadius: '8px' },
    },
  } : null;

  // Group segments by day for the selection step
  const segmentsByDay = useMemo(() => {
    const grouped = {};
    allSegments.forEach(seg => {
      if (!grouped[seg.dayOfWeek]) grouped[seg.dayOfWeek] = [];
      grouped[seg.dayOfWeek].push(seg);
    });
    return grouped;
  }, [allSegments]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-serif font-semibold text-bark">
            {step === 'select' ? 'Pick a Time' : step === 'confirm' ? 'Book a Lesson' : 'Payment'}
          </h2>
          <button onClick={onClose} className="text-clay hover:text-stone text-xl">&times;</button>
        </div>

        <p className="text-sm text-stone mb-4">with {getDisplayName(teacher.name)} — £{teacher.hourly_rate}/hr</p>

        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}

        {/* Step 1: Select a time (shown when opened from "Book a Lesson" button without calendar click) */}
        {step === 'select' && (
          <>
            <p className="text-sm text-stone mb-3">Choose an available hour to get started:</p>
            {Object.keys(segmentsByDay).length === 0 && (
              <p className="text-sm text-clay py-4 text-center">No available slots</p>
            )}
            <div className="space-y-3">
              {Object.entries(segmentsByDay)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([day, segs]) => (
                <div key={day}>
                  <p className="text-xs font-medium text-stone mb-1.5">{DAY_NAMES[Number(day)]}</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {segs.map(seg => (
                      <button
                        key={`${seg.slotId}-${seg.hour}`}
                        onClick={() => handleSelectSegment(seg)}
                        className="px-3 py-1.5 text-sm rounded-lg border border-sand bg-blush text-bark hover:bg-sand transition-colors"
                      >
                        {seg.startTime}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Step 2: Confirm details (time pre-filled, choose duration/date/extras) */}
        {step === 'confirm' && (
          <>
            {/* Selected time summary */}
            <div className="bg-blush border border-sand rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-bark">
                    {DAY_NAMES[selectedDayOfWeek]} at {selectedStartTime}
                  </p>
                  <p className="text-xs text-terracotta mt-0.5">{selectedDate}</p>
                </div>
                <button
                  onClick={() => setStep('select')}
                  className="text-xs text-terracotta hover:text-bark underline"
                >
                  Change
                </button>
              </div>
            </div>

            {/* Duration picker */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-bark mb-2">Duration</label>
              <div className="flex gap-2">
                {Array.from({ length: Math.min(maxHours, 3) }, (_, i) => i + 1).map(h => (
                  <button
                    key={h}
                    onClick={() => setDuration(h)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      duration === h
                        ? 'border-terracotta bg-blush text-bark'
                        : 'border-sand text-stone hover:border-sand'
                    }`}
                  >
                    {h}h
                    <span className="block text-xs font-normal mt-0.5 text-clay">
                      £{(teacher.hourly_rate * h).toFixed(0)}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-clay mt-1.5 font-mono">
                {selectedStartTime} – {endTimeStr}
              </p>
            </div>

            {/* Date */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-bark mb-1">Date</label>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full border border-sand/60 rounded-lg px-3 py-2 text-sm text-bark" />
            </div>

            {/* Recurring */}
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm text-bark">
                <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)}
                  className="rounded border-sand text-terracotta focus:ring-terracotta" />
                Book weekly (recurring)
              </label>
            </div>

            {recurring && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-bark mb-1">Number of weeks</label>
                <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}
                  className="w-full border border-sand/60 rounded-lg px-3 py-2 text-sm text-bark">
                  {[2,3,4,5,6,8,10,12].map(w => (
                    <option key={w} value={w}>{w} weeks</option>
                  ))}
                </select>
              </div>
            )}

            {/* Notes */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-bark mb-1">Notes (optional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="What would you like to focus on?"
                className="w-full border border-sand/60 rounded-lg px-3 py-2 text-sm text-bark placeholder-stone resize-none h-20" />
            </div>

            {/* Meeting point */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-bark mb-1">Meeting Point (optional)</label>
              <input type="text" value={meetingPoint} onChange={(e) => setMeetingPoint(e.target.value)}
                placeholder="e.g. Outside Costa Coffee, W1D 3AF"
                className="w-full border border-sand/60 rounded-lg px-3 py-2 text-sm text-bark placeholder-stone" />
            </div>

            {/* Price summary + CTA */}
            <div className="border-t border-sand/40 pt-4">
              {recurring && (
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-stone">{weeks} × £{perLesson}/lesson</span>
                </div>
              )}
              {!recurring && teacher.first_lesson_discount > 0 && (
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-terracotta">{teacher.first_lesson_discount}% first lesson discount</span>
                  <span className="text-sm text-terracotta">-£{(perLesson * teacher.first_lesson_discount / 100).toFixed(2)}</span>
                </div>
              )}
              {recurring && weeks >= 4 && teacher.bulk_discount > 0 && (
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-terracotta">{teacher.bulk_discount}% package discount</span>
                  <span className="text-sm text-terracotta">-£{(totalPrice * teacher.bulk_discount / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-stone">Total</span>
                <span className="text-lg font-serif font-semibold text-bark">£{totalPrice}</span>
              </div>
              <button
                onClick={handleProceedToPayment}
                disabled={creatingIntent}
                className="w-full bg-bark text-white py-3 rounded-full font-medium hover:bg-charcoal disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creatingIntent ? 'Setting up payment...' : `Continue to Payment — £${totalPrice}`}
              </button>
            </div>
          </>
        )}

        {/* Step 3: Stripe payment */}
        {step === 'payment' && clientSecret && (
          <Elements stripe={stripePromise} options={stripeOptions}>
            <div className="mb-4 bg-paper rounded-lg p-3 text-sm text-stone font-mono">
              <div className="flex justify-between">
                <span>Date</span>
                <span className="font-medium text-bark">{selectedDate}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span>Time</span>
                <span className="font-medium text-bark">{selectedStartTime} – {endTimeStr} ({duration}h)</span>
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
