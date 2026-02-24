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
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-semibold text-gray-900">{teacher.name}</h3>
          <span className="text-brand-600 font-semibold text-sm whitespace-nowrap ml-2">
            £{teacher.hourly_rate}/hr
          </span>
        </div>

        <p className="text-sm text-gray-500 mb-2">{teacher.postcode}</p>

        {teacher.bio && (
          <p className="text-sm text-gray-600 line-clamp-2">{teacher.bio}</p>
        )}

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
        </div>
      </div>
    </Link>
  );
}
