import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import usePageMeta from '../hooks/usePageMeta';

export default function Home() {
  const { user } = useAuth();

  usePageMeta({
    title: 'In-person Photography Lessons in London',
    description: 'Find local photography teachers for hands-on lessons. Portrait, street, landscape, and more. Book your first lesson today.',
  });

  return (
    <div>
      {/* Hero */}
      <section className="bg-white">
        <div className="max-w-5xl mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-4">
            Learn photography from<br />
            <span className="text-brand-600">real people, in person.</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto mb-8">
            Connect with skilled photographers in London for hands-on lessons.
            No online tutorials — just you, a camera, and a great teacher.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to="/search"
              className="bg-brand-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-brand-700 transition-colors"
            >
              Find a Teacher
            </Link>
            {!user && (
              <Link
                to="/register"
                className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Sign Up Free
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-center mb-10">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Browse', desc: 'Find photographers near you, filtered by distance and price.' },
              { step: '2', title: 'Book', desc: 'Pick a time slot that works, pay securely, and you\'re confirmed.' },
              { step: '3', title: 'Learn', desc: 'Meet up, shoot together, and level up your photography skills.' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-10 h-10 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center font-bold mx-auto mb-3">
                  {item.step}
                </div>
                <h3 className="font-semibold mb-1">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl font-bold mb-3">Ready to start?</h2>
          <p className="text-gray-500 mb-6">Photography lessons from £40/hr across Central London.</p>
          <Link
            to="/search"
            className="inline-block bg-brand-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-brand-700 transition-colors"
          >
            Browse Teachers
          </Link>
        </div>
      </section>
    </div>
  );
}
