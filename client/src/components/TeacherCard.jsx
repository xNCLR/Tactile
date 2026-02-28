import { Link } from 'react-router-dom';

export default function TeacherCard({ teacher }) {
  const initials = teacher.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <Link
      to={`/teacher/${teacher.profile_id}`}
      className="block bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Avatar / photo placeholder */}
      <div className="h-40 bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center">
        {teacher.profile_photo ? (
          <img src={teacher.profile_photo} alt={teacher.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-4xl font-bold text-brand-500">{initials}</span>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-1">
          <h3 className="font-semibold text-gray-900">{teacher.name}</h3>
          {teacher.verification_status === 'verified' && (
            <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" title="Verified">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </div>

        <div className="flex items-center justify-between mb-1">
          <span></span>
          <span className="text-brand-600 font-semibold text-sm whitespace-nowrap">
            £{teacher.hourly_rate}/hr
          </span>
        </div>

        <p className="text-sm text-gray-500 mb-2">{teacher.postcode}</p>

        {teacher.bio && (
          <p className="text-sm text-gray-600 line-clamp-2">{teacher.bio}</p>
        )}

        {(() => {
          const cats = teacher.categories ? teacher.categories.split(', ') : [];
          return cats.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {cats.map(c => (
                <span key={c} className="text-xs bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full">{c}</span>
              ))}
            </div>
          ) : null;
        })()}

        <div className="mt-3 flex items-center gap-2 text-xs text-gray-400 flex-wrap">
          {teacher.avg_rating && (
            <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full flex items-center gap-1">
              <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {teacher.avg_rating} ({teacher.review_count})
            </span>
          )}
          {teacher.distance !== null && (
            <span className="bg-gray-100 px-2 py-0.5 rounded-full">{teacher.distance} km away</span>
          )}
          {teacher.available_weekdays === 1 && (
            <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded-full">Weekdays</span>
          )}
          {teacher.available_weekends === 1 && (
            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Weekends</span>
          )}
          {teacher.search_radius_km > 5 && (
            <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">Travels {teacher.search_radius_km} km</span>
          )}
          {teacher.lesson_count >= 5 && (
            <span className="bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full">{teacher.lesson_count} lessons</span>
          )}
          {teacher.first_lesson_discount > 0 && (
            <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded-full">{teacher.first_lesson_discount}% off 1st lesson</span>
          )}
        </div>
      </div>
    </Link>
  );
}
