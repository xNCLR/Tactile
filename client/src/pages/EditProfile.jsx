import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function EditProfile() {
  const { user, teacherProfile, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // User fields (shared)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [postcode, setPostcode] = useState('');

  // Teacher-only fields
  const [bio, setBio] = useState('');
  const [hourlyRate, setHourlyRate] = useState(30);
  const [equipment, setEquipment] = useState('');
  const [weekdays, setWeekdays] = useState(true);
  const [weekends, setWeekends] = useState(true);
  const [timeSlots, setTimeSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // New slot form
  const [newDay, setNewDay] = useState(1);
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('12:00');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setPostcode(user.postcode || '');
    }
    if (teacherProfile) {
      setBio(teacherProfile.bio || '');
      setHourlyRate(teacherProfile.hourly_rate || 30);
      setEquipment(teacherProfile.equipment_requirements || '');
      setWeekdays(!!teacherProfile.available_weekdays);
      setWeekends(!!teacherProfile.available_weekends);
      loadTimeSlots();
    }
  }, [user, teacherProfile]);

  const loadTimeSlots = async () => {
    if (!teacherProfile) return;
    setLoadingSlots(true);
    try {
      const data = await api.getTeacher(teacherProfile.id);
      setTimeSlots(data.timeSlots || []);
    } catch (err) {
      console.error('Failed to load time slots:', err);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);

    try {
      // Update user profile
      await api.updateProfile({ name, phone, postcode });

      // Update teacher profile if teacher
      if (user.role === 'teacher') {
        await api.updateTeacherProfile({
          bio,
          hourlyRate: parseFloat(hourlyRate),
          equipmentRequirements: equipment,
          availableWeekdays: weekdays,
          availableWeekends: weekends,
        });
      }

      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddSlot = async () => {
    try {
      await api.addTimeSlot({ dayOfWeek: parseInt(newDay), startTime: newStart, endTime: newEnd });
      await loadTimeSlots();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveSlot = async (slotId) => {
    try {
      await api.removeTimeSlot(slotId);
      setTimeSlots((prev) => prev.filter((s) => s.id !== slotId));
    } catch (err) {
      setError(err.message);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Edit Profile</h1>
        <button onClick={() => navigate('/dashboard')} className="text-sm text-gray-500 hover:text-gray-700">
          Back to Dashboard
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}
      {saved && <div className="bg-green-50 text-green-600 text-sm p-3 rounded-lg mb-4">Profile saved!</div>}

      {/* Basic info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold mb-4">Basic Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
            <input type="text" value={postcode} onChange={(e) => setPostcode(e.target.value)}
              placeholder="e.g. SW1A 1AA"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
        </div>
      </div>

      {/* Teacher-specific fields */}
      {user.role === 'teacher' && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold mb-4">Teaching Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell students about yourself and your photography style..."
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
                <p className="text-xs text-gray-400 mt-1">{bio.length}/500 characters</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate (£)</label>
                <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)}
                  min="10" max="500" step="5"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Equipment Requirements</label>
                <input type="text" value={equipment} onChange={(e) => setEquipment(e.target.value)}
                  placeholder="What should students bring?"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={weekdays} onChange={(e) => setWeekdays(e.target.checked)}
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                  Available weekdays
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={weekends} onChange={(e) => setWeekends(e.target.checked)}
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                  Available weekends
                </label>
              </div>
            </div>
          </div>

          {/* Time slots */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold mb-4">Time Slots</h2>

            {loadingSlots ? (
              <p className="text-sm text-gray-400">Loading slots...</p>
            ) : timeSlots.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">No time slots yet. Add your available times below.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {timeSlots.map((slot) => (
                  <div key={slot.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm">
                      <span className="font-medium">{DAY_NAMES[slot.day_of_week]}</span>
                      <span className="text-gray-500 ml-2">{slot.start_time} – {slot.end_time}</span>
                    </div>
                    <button onClick={() => handleRemoveSlot(slot.id)}
                      className="text-xs text-red-500 hover:text-red-700">Remove</button>
                  </div>
                ))}
              </div>
            )}

            {/* Add slot form */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Add a time slot</p>
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Day</label>
                  <select value={newDay} onChange={(e) => setNewDay(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                    {DAY_NAMES.map((day, i) => <option key={i} value={i}>{day}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start</label>
                  <input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">End</label>
                  <input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                </div>
                <button onClick={handleAddSlot}
                  className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-gray-800">
                  Add
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Save button */}
      <button onClick={handleSave} disabled={saving}
        className="w-full bg-brand-600 text-white py-3 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors">
        {saving ? 'Saving...' : 'Save Profile'}
      </button>
    </div>
  );
}
