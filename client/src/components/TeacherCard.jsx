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

        <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
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
