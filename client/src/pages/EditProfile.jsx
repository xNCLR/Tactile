import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function VerificationForm() {
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!portfolioUrl.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await api.submitVerification({ portfolioUrl });
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) return <p className="text-sm text-green-600">Submitted for review!</p>;

  return (
    <div>
      <p className="text-sm text-gray-500 mb-3">Get a verified badge by sharing a link to your portfolio or professional website.</p>
      {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
      <div className="flex gap-2">
        <input type="url" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)}
          placeholder="https://your-portfolio.com"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        <button onClick={handleSubmit} disabled={submitting || !portfolioUrl.trim()}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </div>
  );
}

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

  // Teaching fields (available to all users)
  const [showTeaching, setShowTeaching] = useState(false);
  const [bio, setBio] = useState('');
  const [hourlyRate, setHourlyRate] = useState(30);
  const [equipment, setEquipment] = useState('');
  const [weekdays, setWeekdays] = useState(true);
  const [weekends, setWeekends] = useState(true);
  const [travelRadius, setTravelRadius] = useState(10);
  const [timeSlots, setTimeSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Photo state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [portfolioPhotos, setPortfolioPhotos] = useState({ photo_1: null, photo_2: null, photo_3: null });
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const profilePhotoRef = useRef(null);
  const portfolioPhotoRef = useRef(null);

  // New slot form
  const [newDay, setNewDay] = useState(1);
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('12:00');

  // Categories
  const [allCategories, setAllCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);

  // Discounts
  const [firstLessonDiscount, setFirstLessonDiscount] = useState(0);
  const [bulkDiscount, setBulkDiscount] = useState(0);

  useEffect(() => {
    // Fetch categories
    api.getCategories()
      .then(data => setAllCategories(data.categories || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setPostcode(user.postcode || '');
    }
    if (teacherProfile) {
      setShowTeaching(true);
      setBio(teacherProfile.bio || '');
      setHourlyRate(teacherProfile.hourly_rate || 30);
      setEquipment(teacherProfile.equipment_requirements || '');
      setWeekdays(!!teacherProfile.available_weekdays);
      setWeekends(!!teacherProfile.available_weekends);
      setTravelRadius(teacherProfile.search_radius_km || 10);
      setFirstLessonDiscount(teacherProfile.first_lesson_discount || 0);
      setBulkDiscount(teacherProfile.bulk_discount || 0);
      setPortfolioPhotos({
        photo_1: teacherProfile.photo_1 || null,
        photo_2: teacherProfile.photo_2 || null,
        photo_3: teacherProfile.photo_3 || null,
      });
      // Load categories if available
      if (teacherProfile.categories) {
        const categoryIds = Array.isArray(teacherProfile.categories)
          ? teacherProfile.categories.map(c => c.slug)
          : [];
        setSelectedCategories(categoryIds);
      }
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

  const handleProfilePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPhoto(true);
    setError('');
    try {
      await api.uploadProfilePhoto(file);
      await refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePortfolioUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPortfolio(true);
    setError('');
    try {
      const result = await api.uploadPortfolioPhoto(file);
      setPortfolioPhotos((prev) => ({ ...prev, [result.slot]: result.url }));
      await refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingPortfolio(false);
    }
  };

  const handleDeletePortfolioPhoto = async (slot) => {
    try {
      await api.deletePortfolioPhoto(slot);
      setPortfolioPhotos((prev) => ({ ...prev, [slot]: null }));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);

    try {
      await api.updateProfile({ name, phone, postcode });

      if (showTeaching) {
        // This will create a new teacher profile or update existing
        await api.updateTeacherProfile({
          bio,
          hourlyRate: parseFloat(hourlyRate),
          equipmentRequirements: equipment,
          availableWeekdays: weekdays,
          availableWeekends: weekends,
          searchRadiusKm: parseInt(travelRadius),
          firstLessonDiscount: parseInt(firstLessonDiscount),
          bulkDiscount: parseInt(bulkDiscount),
          categories: selectedCategories,
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

  const initials = user.name?.split(' ').map((n) => n[0]).join('').toUpperCase() || '?';
  const profilePhotoUrl = user.profilePhoto || user.profile_photo;

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

      {/* Profile Photo */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold mb-4">Profile Photo</h2>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center overflow-hidden flex-shrink-0">
            {profilePhotoUrl ? (
              <img src={profilePhotoUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-brand-500">{initials}</span>
            )}
          </div>
          <div>
            <input
              ref={profilePhotoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleProfilePhotoUpload}
              className="hidden"
            />
            <button
              onClick={() => profilePhotoRef.current?.click()}
              disabled={uploadingPhoto}
              className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {uploadingPhoto ? 'Uploading...' : profilePhotoUrl ? 'Change Photo' : 'Upload Photo'}
            </button>
            <p className="text-xs text-gray-400 mt-1">JPG, PNG or WebP. Max 5MB.</p>
          </div>
        </div>
      </div>

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

      {/* Teaching section — available to everyone */}
      {!showTeaching ? (
        <div className="bg-gradient-to-br from-brand-50 to-brand-100 rounded-xl border border-brand-200 p-6 mb-6 text-center">
          <h2 className="font-semibold mb-1">Want to teach?</h2>
          <p className="text-sm text-gray-600 mb-4">Set up a teaching profile and start sharing your photography skills.</p>
          <button
            onClick={() => setShowTeaching(true)}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            Set Up Teaching Profile
          </button>
        </div>
      ) : (
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Specialties (max 5)</label>
                <div className="flex flex-wrap gap-2">
                  {allCategories.map(c => {
                    const isSelected = selectedCategories.includes(c.slug);
                    return (
                      <button key={c.slug} type="button"
                        onClick={() => {
                          if (isSelected) setSelectedCategories(prev => prev.filter(s => s !== c.slug));
                          else if (selectedCategories.length < 5) setSelectedCategories(prev => [...prev, c.slug]);
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${isSelected ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {c.name}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-1">{selectedCategories.length}/5 selected</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate (£)</label>
                <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)}
                  min="10" max="500" step="5"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                <h2 className="font-semibold mb-4">Pricing & Discounts</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Lesson Discount: {firstLessonDiscount > 0 ? `${firstLessonDiscount}% off` : 'None'}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      step="5"
                      value={firstLessonDiscount}
                      onChange={(e) => setFirstLessonDiscount(Number(e.target.value))}
                      className="w-full accent-brand-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>None</span>
                      <span>25%</span>
                      <span>50%</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Attract new students with a discounted first lesson.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Package Discount (4+ weeks): {bulkDiscount > 0 ? `${bulkDiscount}% off` : 'None'}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      step="5"
                      value={bulkDiscount}
                      onChange={(e) => setBulkDiscount(Number(e.target.value))}
                      className="w-full accent-brand-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>None</span>
                      <span>15%</span>
                      <span>30%</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Reward recurring students who book weekly packages.</p>
                  </div>
                </div>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Travel Radius: {travelRadius} km
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={travelRadius}
                  onChange={(e) => setTravelRadius(e.target.value)}
                  className="w-full accent-brand-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1 km</span>
                  <span>25 km</span>
                  <span>50 km</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">How far you're willing to travel to meet students.</p>
              </div>
            </div>
          </div>

          {/* Verification */}
          {teacherProfile && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <h2 className="font-semibold mb-2">Verification</h2>
              {teacherProfile.verification_status === 'verified' ? (
                <div className="flex items-center gap-2 text-green-600">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">Verified Teacher</span>
                </div>
              ) : teacherProfile.verification_status === 'pending' ? (
                <div className="flex items-center gap-2 text-orange-500">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium">Verification Pending</span>
                </div>
              ) : (
                <VerificationForm />
              )}
            </div>
          )}

          {/* Portfolio Photos */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold mb-1">Portfolio Photos</h2>
            <p className="text-sm text-gray-400 mb-4">Show off your best work. Up to 3 photos.</p>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {['photo_1', 'photo_2', 'photo_3'].map((slot) => (
                <div key={slot} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  {portfolioPhotos[slot] ? (
                    <>
                      <img src={portfolioPhotos[slot]} alt="Portfolio" className="w-full h-full object-cover" />
                      <button
                        onClick={() => handleDeletePortfolioPhoto(slot)}
                        className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/80"
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {Object.values(portfolioPhotos).some((p) => !p) && (
              <>
                <input
                  ref={portfolioPhotoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePortfolioUpload}
                  className="hidden"
                />
                <button
                  onClick={() => portfolioPhotoRef.current?.click()}
                  disabled={uploadingPortfolio}
                  className="text-sm bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  {uploadingPortfolio ? 'Uploading...' : 'Add Photo'}
                </button>
              </>
            )}
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
