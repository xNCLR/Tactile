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

  if (submitted) return <p className="text-sm text-bark">Submitted for review!</p>;

  return (
    <div>
      <p className="text-sm text-stone mb-3">Get a verified badge by sharing a link to your portfolio or professional website.</p>
      {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
      <div className="flex gap-2">
        <input type="url" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)}
          placeholder="https://your-portfolio.com"
          className="flex-1 border border-sand rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
        <button onClick={handleSubmit} disabled={submitting || !portfolioUrl.trim()}
          className="bg-terracotta text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
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

  // Credentials
  const [credentials, setCredentials] = useState([]);
  const [newCred, setNewCred] = useState('');
  const [addingCred, setAddingCred] = useState(false);

  // Gear
  const [gear, setGear] = useState([]);
  const [newGearName, setNewGearName] = useState('');
  const [newGearDesc, setNewGearDesc] = useState('');
  const [newGearUrl, setNewGearUrl] = useState('');
  const [addingGear, setAddingGear] = useState(false);
  const [showGearForm, setShowGearForm] = useState(false);

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
      loadTeacherData();
    }
  }, [user, teacherProfile]);

  const loadTeacherData = async () => {
    if (!teacherProfile) return;
    setLoadingSlots(true);
    try {
      const data = await api.getTeacher(teacherProfile.id);
      setTimeSlots(data.timeSlots || []);
      setCredentials(data.teacher?.credentials || []);
      setGear(data.teacher?.gear || []);
    } catch (err) {
      console.error('Failed to load teacher data:', err);
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
      await loadTeacherData();
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
        <h1 className="text-2xl font-bold font-serif text-bark">Edit Profile</h1>
        <button onClick={() => navigate('/dashboard')} className="text-sm text-stone hover:text-bark">
          Back to Dashboard
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}
      {saved && <div className="bg-blush/60 text-bark text-sm p-3 rounded-lg mb-4">Profile saved!</div>}

      {/* Profile Photo */}
      <div className="bg-white rounded-2xl border border-sand/60 p-6 mb-6">
        <h2 className="font-semibold font-serif text-bark mb-4">Profile Photo</h2>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blush to-sand flex items-center justify-center overflow-hidden flex-shrink-0">
            {profilePhotoUrl ? (
              <img src={profilePhotoUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-rust">{initials}</span>
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
              className="text-sm bg-bark text-white px-4 py-2 rounded-full hover:bg-charcoal disabled:opacity-50"
            >
              {uploadingPhoto ? 'Uploading...' : profilePhotoUrl ? 'Change Photo' : 'Upload Photo'}
            </button>
            <p className="text-xs text-clay mt-1">JPG, PNG or WebP. Max 5MB.</p>
          </div>
        </div>
      </div>

      {/* Basic info */}
      <div className="bg-white rounded-2xl border border-sand/60 p-6 mb-6">
        <h2 className="font-semibold font-serif text-bark mb-4">Basic Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-bark font-mono mb-1">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border border-sand rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
          </div>
          <div>
            <label className="block text-sm font-medium text-bark font-mono mb-1">Postcode</label>
            <input type="text" value={postcode} onChange={(e) => setPostcode(e.target.value)}
              placeholder="e.g. SW1A 1AA"
              className="w-full border border-sand rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
          </div>
          <div>
            <label className="block text-sm font-medium text-bark font-mono mb-1">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-sand rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
          </div>
        </div>
      </div>

      {/* Teaching section — available to everyone */}
      {!showTeaching ? (
        <div className="bg-gradient-to-br from-blush to-sand rounded-2xl border border-sand p-6 mb-6 text-center">
          <h2 className="font-semibold font-serif text-bark mb-1">Want to teach?</h2>
          <p className="text-sm text-stone mb-4">Set up a teaching profile and start sharing your photography skills.</p>
          <button
            onClick={() => setShowTeaching(true)}
            className="bg-terracotta text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            Set Up Teaching Profile
          </button>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-sand/60 p-6 mb-6">
            <h2 className="font-semibold font-serif text-bark mb-4">Teaching Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-bark font-mono mb-1">Bio</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell students about yourself and your photography style..."
                  rows={4}
                  className="w-full border border-sand rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta resize-none" />
                <p className="text-xs text-clay mt-1">{bio.length}/500 characters</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-bark font-mono mb-2">Specialties (max 5)</label>
                <div className="flex flex-wrap gap-2">
                  {allCategories.map(c => {
                    const isSelected = selectedCategories.includes(c.slug);
                    return (
                      <button key={c.slug} type="button"
                        onClick={() => {
                          if (isSelected) setSelectedCategories(prev => prev.filter(s => s !== c.slug));
                          else if (selectedCategories.length < 5) setSelectedCategories(prev => [...prev, c.slug]);
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${isSelected ? 'bg-bark text-white' : 'bg-blush text-stone hover:bg-sand'}`}>
                        {c.name}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-clay mt-1">{selectedCategories.length}/5 selected</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-bark font-mono mb-1">Hourly Rate (£)</label>
                <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)}
                  min="10" max="500" step="5"
                  className="w-full border border-sand rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
              </div>

              <div className="bg-white rounded-2xl border border-sand/60 p-6 mb-6">
                <h2 className="font-semibold font-serif text-bark mb-4">Pricing & Discounts</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-bark font-mono mb-1">
                      First Lesson Discount: {firstLessonDiscount > 0 ? `${firstLessonDiscount}% off` : 'None'}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      step="5"
                      value={firstLessonDiscount}
                      onChange={(e) => setFirstLessonDiscount(Number(e.target.value))}
                      className="w-full accent-terracotta"
                    />
                    <div className="flex justify-between text-xs text-clay mt-1">
                      <span>None</span>
                      <span>25%</span>
                      <span>50%</span>
                    </div>
                    <p className="text-xs text-clay mt-1">Attract new students with a discounted first lesson.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-bark font-mono mb-1">
                      Package Discount (4+ weeks): {bulkDiscount > 0 ? `${bulkDiscount}% off` : 'None'}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      step="5"
                      value={bulkDiscount}
                      onChange={(e) => setBulkDiscount(Number(e.target.value))}
                      className="w-full accent-terracotta"
                    />
                    <div className="flex justify-between text-xs text-clay mt-1">
                      <span>None</span>
                      <span>15%</span>
                      <span>30%</span>
                    </div>
                    <p className="text-xs text-clay mt-1">Reward recurring students who book weekly packages.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-bark font-mono mb-1">Equipment Requirements</label>
                <input type="text" value={equipment} onChange={(e) => setEquipment(e.target.value)}
                  placeholder="What should students bring?"
                  className="w-full border border-sand rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
              </div>
              {/* Weekday/weekend availability is derived from time slots below */}
              <div>
                <label className="block text-sm font-medium text-bark font-mono mb-1">
                  Travel Radius: {travelRadius} km
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={travelRadius}
                  onChange={(e) => setTravelRadius(e.target.value)}
                  className="w-full accent-terracotta"
                />
                <div className="flex justify-between text-xs text-clay mt-1">
                  <span>1 km</span>
                  <span>25 km</span>
                  <span>50 km</span>
                </div>
                <p className="text-xs text-clay mt-1">How far you're willing to travel to meet students.</p>
              </div>
            </div>
          </div>

          {/* Verification */}
          {teacherProfile && (
            <div className="bg-white rounded-2xl border border-sand/60 p-6 mb-6">
              <h2 className="font-semibold font-serif text-bark mb-2">Verification</h2>
              {teacherProfile.verification_status === 'verified' ? (
                <div className="flex items-center gap-2 text-bark">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">Verified Teacher</span>
                </div>
              ) : teacherProfile.verification_status === 'pending' ? (
                <div className="flex items-center gap-2 text-terracotta">
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
          <div className="bg-white rounded-2xl border border-sand/60 p-6 mb-6">
            <h2 className="font-semibold font-serif text-bark mb-1">Portfolio Photos</h2>
            <p className="text-sm text-clay mb-4">Show off your best work. Up to 3 photos.</p>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {['photo_1', 'photo_2', 'photo_3'].map((slot) => (
                <div key={slot} className="relative aspect-square rounded-lg overflow-hidden bg-paper border border-sand">
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
                    <div className="w-full h-full flex items-center justify-center text-sand">
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
                  className="text-sm bg-bark text-white px-4 py-2 rounded-full hover:bg-charcoal disabled:opacity-50"
                >
                  {uploadingPortfolio ? 'Uploading...' : 'Add Photo'}
                </button>
              </>
            )}
          </div>

          {/* Time slots */}
          <div className="bg-white rounded-2xl border border-sand/60 p-6 mb-6">
            <h2 className="font-semibold font-serif text-bark mb-4">Availability</h2>

            {loadingSlots ? (
              <p className="text-sm text-clay">Loading slots...</p>
            ) : timeSlots.length === 0 ? (
              <p className="text-sm text-clay mb-4">No time slots yet. Add your available times below.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {[...timeSlots]
                  .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
                  .map((slot) => (
                  <div key={slot.id} className="flex items-center justify-between p-3 bg-paper rounded-lg">
                    <div className="text-sm">
                      <span className="font-medium text-bark">{DAY_NAMES[slot.day_of_week]}</span>
                      <span className="text-stone ml-2">{slot.start_time} – {slot.end_time}</span>
                    </div>
                    <button onClick={() => handleRemoveSlot(slot.id)}
                      className="text-xs text-red-500 hover:text-red-700">Remove</button>
                  </div>
                ))}
              </div>
            )}

            {/* Add slot form */}
            <div className="border-t border-sand/40 pt-4">
              <p className="text-sm font-medium text-bark font-mono mb-2">Add a time slot</p>
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <label className="block text-xs text-stone font-mono mb-1">Day</label>
                  <select value={newDay} onChange={(e) => setNewDay(e.target.value)}
                    className="border border-sand rounded-lg px-2 py-1.5 text-sm bg-paper">
                    {DAY_NAMES.map((day, i) => <option key={i} value={i}>{day}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-stone font-mono mb-1">Start</label>
                  <input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)}
                    className="border border-sand rounded-lg px-2 py-1.5 text-sm bg-paper" />
                </div>
                <div>
                  <label className="block text-xs text-stone font-mono mb-1">End</label>
                  <input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)}
                    className="border border-sand rounded-lg px-2 py-1.5 text-sm bg-paper" />
                </div>
                <button onClick={handleAddSlot}
                  className="bg-bark text-white px-3 py-1.5 rounded-lg text-sm hover:bg-charcoal">
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Credentials */}
          {teacherProfile && (
            <div className="bg-white rounded-2xl border border-sand/60 p-6 mb-6">
              <h2 className="font-semibold font-serif text-bark mb-3">Credentials</h2>
              <p className="text-xs text-clay mb-3">Qualifications, awards, experience — up to 10 items.</p>
              {credentials.length > 0 && (
                <ul className="space-y-2 mb-4">
                  {credentials.map((cred) => (
                    <li key={cred.id} className="flex items-center justify-between text-sm text-bark bg-paper rounded-lg px-3 py-2">
                      <span>{cred.text}</span>
                      <button
                        onClick={async () => {
                          try {
                            await api.deleteCredential(cred.id);
                            setCredentials(prev => prev.filter(c => c.id !== cred.id));
                          } catch (err) { alert(err.message); }
                        }}
                        className="text-sand hover:text-red-500 ml-2 flex-shrink-0"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {credentials.length < 10 && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCred}
                    onChange={(e) => setNewCred(e.target.value)}
                    placeholder="e.g. BA Photography, UAL (2018)"
                    maxLength={150}
                    className="flex-1 border border-sand rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newCred.trim()) {
                        e.preventDefault();
                        setAddingCred(true);
                        api.addCredential(newCred.trim())
                          .then((data) => { setCredentials(prev => [...prev, data.credential]); setNewCred(''); })
                          .catch(err => alert(err.message))
                          .finally(() => setAddingCred(false));
                      }
                    }}
                  />
                  <button
                    disabled={addingCred || !newCred.trim()}
                    onClick={() => {
                      setAddingCred(true);
                      api.addCredential(newCred.trim())
                        .then((data) => { setCredentials(prev => [...prev, data.credential]); setNewCred(''); })
                        .catch(err => alert(err.message))
                        .finally(() => setAddingCred(false));
                    }}
                    className="bg-terracotta text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                  >
                    {addingCred ? '...' : 'Add'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Gear Recommendations */}
          {teacherProfile && (
            <div className="bg-white rounded-2xl border border-sand/60 p-6 mb-6">
              <h2 className="font-semibold font-serif text-bark mb-3">Recommended Gear</h2>
              <p className="text-xs text-clay mb-3">Cameras, lenses, or accessories you recommend. Links can include affiliate tags — up to 15 items.</p>
              {gear.length > 0 && (
                <ul className="space-y-2 mb-4">
                  {gear.map((item) => (
                    <li key={item.id} className="flex items-start justify-between text-sm text-bark bg-paper rounded-lg px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{item.name}</span>
                        {item.description && <p className="text-xs text-stone mt-0.5">{item.description}</p>}
                        {item.url && <p className="text-xs text-terracotta truncate mt-0.5">{item.url}</p>}
                      </div>
                      <button
                        onClick={async () => {
                          try { await api.deleteGear(item.id); setGear(prev => prev.filter(g => g.id !== item.id)); }
                          catch (err) { alert(err.message); }
                        }}
                        className="text-sand hover:text-red-500 ml-2 flex-shrink-0 mt-0.5"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {gear.length < 15 && !showGearForm && (
                <button onClick={() => setShowGearForm(true)} className="text-sm text-terracotta hover:text-rust font-medium">
                  + Add gear recommendation
                </button>
              )}
              {showGearForm && gear.length < 15 && (
                <div className="space-y-2 border border-sand rounded-lg p-3">
                  <input type="text" value={newGearName} onChange={(e) => setNewGearName(e.target.value)}
                    placeholder="Item name (e.g. Canon EOS R6 Mark II)" maxLength={120}
                    className="w-full border border-sand rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
                  <input type="text" value={newGearDesc} onChange={(e) => setNewGearDesc(e.target.value)}
                    placeholder="Short description (optional)" maxLength={300}
                    className="w-full border border-sand rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
                  <input type="url" value={newGearUrl} onChange={(e) => setNewGearUrl(e.target.value)}
                    placeholder="Link (optional, e.g. affiliate URL)" maxLength={500}
                    className="w-full border border-sand rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
                  <div className="flex gap-2">
                    <button onClick={() => { setShowGearForm(false); setNewGearName(''); setNewGearDesc(''); setNewGearUrl(''); }}
                      className="text-sm text-stone py-2 px-3 rounded-lg border border-sand hover:bg-paper">Cancel</button>
                    <button
                      disabled={addingGear || !newGearName.trim()}
                      onClick={async () => {
                        setAddingGear(true);
                        try {
                          const data = await api.addGear({ name: newGearName.trim(), description: newGearDesc.trim() || undefined, url: newGearUrl.trim() || undefined });
                          setGear(prev => [...prev, data.item]);
                          setNewGearName(''); setNewGearDesc(''); setNewGearUrl('');
                          setShowGearForm(false);
                        } catch (err) { alert(err.message); }
                        finally { setAddingGear(false); }
                      }}
                      className="bg-terracotta text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                    >
                      {addingGear ? '...' : 'Add'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Save button */}
      <button onClick={handleSave} disabled={saving}
        className="w-full bg-bark text-white py-3 rounded-full font-medium hover:bg-charcoal disabled:opacity-50 transition-colors">
        {saving ? 'Saving...' : 'Save Profile'}
      </button>
    </div>
  );
}
