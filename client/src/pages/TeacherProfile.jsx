import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import BookingModal from '../components/BookingModal';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TeacherProfile() {
  const { id } = useParams();
  const [teacher, setTeacher] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);

  useEffect(() => {
    api.getTeacher(id)
      .then((data) => {
        setTeacher(data.teacher);
        setTimeSlots(data.timeSlots);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

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
              <h1 className="text-2xl font-bold">{teacher.name}</h1>
              <p className="text-gray-500">{teacher.postcode}</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-brand-600">£{teacher.hourly_rate}</span>
              <p className="text-sm text-gray-400">per hour</p>
            </div>
          </div>

          {teacher.bio && <p className="text-gray-700 mb-4 leading-relaxed">{teacher.bio}</p>}

          {teacher.equipment_requirements && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-1">What you'll need</h3>
              <p className="text-gray-700">{teacher.equipment_requirements}</p>
            </div>
          )}

          <div className="flex gap-2 mb-6">
            {teacher.available_weekdays === 1 && (
              <span className="bg-green-50 text-green-600 text-sm px-3 py-1 rounded-full">Available weekdays</span>
            )}
            {teacher.available_weekends === 1 && (
              <span className="bg-blue-50 text-blue-600 text-sm px-3 py-1 rounded-full">Available weekends</span>
            )}
          </div>

          <button
            onClick={() => setShowBooking(true)}
            className="w-full bg-brand-600 text-white py-3 rounded-lg font-medium hover:bg-brand-700 transition-colors"
          >
            Book a Lesson
          </button>
        </div>
      </div>

      {/* Available slots */}
      {timeSlots.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold mb-4">Available Times</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {timeSlots.map((slot) => (
              <div key={slot.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-sm">{DAY_NAMES[slot.day_of_week]}</span>
                <span className="text-sm text-gray-500">{slot.start_time} – {slot.end_time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showBooking && (
        <BookingModal
          teacher={teacher}
          timeSlots={timeSlots}
          onClose={() => setShowBooking(false)}
        />
      )}
    </div>
  );
}
