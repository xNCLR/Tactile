import { useState, useEffect } from 'react';
import { api } from '../api/client';
import TeacherCard from '../components/TeacherCard';

export default function Search() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [location, setLocation] = useState(null);
  const [radius, setRadius] = useState(10);
  const [sort, setSort] = useState('distance');
  const [availability, setAvailability] = useState('');
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');

  useEffect(() => {
    // Fetch categories
    api.getCategories()
      .then(data => setCategories(data.categories))
      .catch(console.error);

    // Try to get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          // Default to central London if denied
          setLocation({ lat: 51.5074, lng: -0.1278 });
        }
      );
    } else {
      setLocation({ lat: 51.5074, lng: -0.1278 });
    }
  }, []);

  useEffect(() => {
    if (!location) return;

    const fetchTeachers = async () => {
      setLoading(true);
      try {
        const params = {
          lat: location.lat,
          lng: location.lng,
          radius,
          sort,
        };
        if (availability) params.availability = availability;
        if (category) params.category = category;

        const data = await api.searchTeachers(params);
        setTeachers(data.teachers);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTeachers();
  }, [location, radius, sort, availability, category]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Photography Teachers in London</h1>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-4 px-4 scrollbar-hide">
        <button onClick={() => setCategory('')} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!category ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
        {categories.map(c => (
          <button key={c.slug} onClick={() => setCategory(c.slug)} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${category === c.slug ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c.name}</button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-200">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Radius:</label>
          <select
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
          >
            <option value={2}>2 km</option>
            <option value={5}>5 km</option>
            <option value={10}>10 km</option>
            <option value={25}>25 km</option>
            <option value={50}>50 km</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Sort by:</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
          >
            <option value="distance">Distance</option>
            <option value="price">Price</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Availability:</label>
          <select
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
          >
            <option value="">Any</option>
            <option value="weekdays">Weekdays</option>
            <option value="weekends">Weekends</option>
          </select>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Searching for teachers near you...</div>
      ) : teachers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-2">No teachers found within {radius} km.</p>
          <p className="text-sm text-gray-400">Try increasing the search radius.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-400 mb-4">{teachers.length} teacher{teachers.length !== 1 ? 's' : ''} found</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teachers.map((teacher) => (
              <TeacherCard key={teacher.profile_id} teacher={teacher} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
