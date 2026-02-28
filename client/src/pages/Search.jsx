import { useState, useEffect, lazy, Suspense } from 'react';
import { api } from '../api/client';
import TeacherCard from '../components/TeacherCard';
import usePageMeta from '../hooks/usePageMeta';

const TeacherMap = lazy(() => import('../components/TeacherMap'));

export default function Search() {
  usePageMeta({
    title: 'Find Photography Teachers',
    description: 'Browse photography teachers in London. Filter by specialties, availability, and location. Book your lesson today.',
  });
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [location, setLocation] = useState(null);
  const [radius, setRadius] = useState(10);
  const [sort, setSort] = useState('distance');
  const [availability, setAvailability] = useState('');
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [view, setView] = useState('list');

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Photography Teachers in London</h1>

        {/* View toggle */}
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === 'list'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              List
            </span>
          </button>
          <button
            onClick={() => setView('map')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === 'map'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Map
            </span>
          </button>
        </div>
      </div>

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

          {view === 'list' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teachers.map((teacher) => (
                <TeacherCard key={teacher.profile_id} teacher={teacher} />
              ))}
            </div>
          ) : (
            <Suspense fallback={<div className="text-center py-12 text-gray-400">Loading map...</div>}>
              <TeacherMap teachers={teachers} center={location} />
            </Suspense>
          )}
        </>
      )}
    </div>
  );
}
