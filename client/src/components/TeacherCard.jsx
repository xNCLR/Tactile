import { Link } from 'react-router-dom';
import { getInitials, getDisplayName } from '../utils/helpers';

export default function TeacherCard({ teacher }) {
  const initials = getInitials(teacher.name);

  return (
    <Link
      to={`/teacher/${teacher.profile_id}`}
      className="block bg-white rounded-2xl border border-sand/60 overflow-hidden hover:shadow-md hover:shadow-sand/40 transition-all"
    >
      {/* Avatar / photo placeholder */}
      <div className="h-44 bg-gradient-to-br from-blush to-sand flex items-center justify-center">
        {teacher.profile_photo ? (
          <img src={teacher.profile_photo} alt={teacher.name} className="w-full h-full object-cover" />
        ) : (
          <span className="font-serif text-4xl italic text-rust">{initials}</span>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-1">
          <h3 className="font-serif text-lg text-bark">{getDisplayName(teacher.name)}</h3>
          {teacher.verification_status === 'verified' && (
            <svg className="w-4 h-4 text-terracotta flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" title="Verified">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </div>

        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono text-stone">{teacher.postcode}</span>
          <span className="text-terracotta font-semibold text-sm whitespace-nowrap">
            £{teacher.hourly_rate}/hr
          </span>
        </div>

        {teacher.bio && (
          <p className="text-sm text-stone line-clamp-2 mt-2 leading-relaxed">{teacher.bio}</p>
        )}

        {(() => {
          const cats = Array.isArray(teacher.categories) ? teacher.categories : [];
          return cats.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {cats.map(c => (
                <span key={c} className="text-xs font-mono bg-blush text-bark px-2 py-0.5 rounded-full">{c}</span>
              ))}
            </div>
          ) : null;
        })()}

        <div className="mt-3 flex items-center gap-2 text-xs font-mono text-stone flex-wrap">
          {teacher.avg_rating && (
            <span className="bg-blush text-bark px-2 py-0.5 rounded-full flex items-center gap-1">
              <svg className="w-3 h-3 text-terracotta" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {teacher.avg_rating} ({teacher.review_count})
            </span>
          )}
          {teacher.distance !== null && (
            <span className="bg-paper px-2 py-0.5 rounded-full">{teacher.distance} km</span>
          )}
          {teacher.available_weekdays === 1 && (
            <span className="bg-paper text-stone px-2 py-0.5 rounded-full">Weekdays</span>
          )}
          {teacher.available_weekends === 1 && (
            <span className="bg-paper text-stone px-2 py-0.5 rounded-full">Weekends</span>
          )}
          {teacher.search_radius_km > 5 && (
            <span className="bg-paper text-stone px-2 py-0.5 rounded-full">Travels {teacher.search_radius_km} km</span>
          )}
          {teacher.lesson_count >= 5 && (
            <span className="bg-paper text-stone px-2 py-0.5 rounded-full">{teacher.lesson_count} lessons</span>
          )}
          {teacher.first_lesson_discount > 0 && (
            <span className="bg-blush text-terracotta px-2 py-0.5 rounded-full">{teacher.first_lesson_discount}% off 1st</span>
          )}
        </div>
      </div>
    </Link>
  );
}
