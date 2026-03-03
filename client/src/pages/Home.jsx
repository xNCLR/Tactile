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
        <div className="max-w-5xl mx-auto px-4 py-24 text-center">
          <h1 className="font-serif text-5xl md:text-6xl text-bark leading-tight mb-6">
            Learn photography from<br />
            <span className="italic text-terracotta">real people, in person.</span>
          </h1>
          <p className="text-lg text-stone max-w-xl mx-auto mb-10 leading-relaxed">
            Connect with skilled photographers in London for hands-on lessons.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              to="/search"
              className="bg-bark text-white px-7 py-3.5 rounded-full font-medium hover:bg-charcoal transition-colors"
            >
              Find a Teacher
            </Link>
            {!user && (
              <Link
                to="/register"
                className="border border-sand text-bark px-7 py-3.5 rounded-full font-medium hover:bg-blush transition-colors"
              >
                Sign Up Free
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section>
        <div className="max-w-5xl mx-auto px-4 py-20">
          <h2 className="font-serif text-3xl text-bark text-center mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              { step: '01', title: 'Browse', desc: 'Find photographers near you by specialty, location, and availability.' },
              { step: '02', title: 'Book', desc: 'Pick a time slot, pay securely, and confirm your lesson.' },
              { step: '03', title: 'Learn', desc: 'Meet up in person and learn the craft hands-on.' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <span className="font-mono text-xs text-clay tracking-widest">{item.step}</span>
                <h3 className="font-serif text-2xl text-bark mt-2 mb-2">{item.title}</h3>
                <p className="text-sm text-stone leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="max-w-5xl mx-auto px-4 py-20 text-center">
          <h2 className="font-serif text-3xl text-bark mb-6">Ready to start?</h2>
          <Link
            to="/search"
            className="inline-block bg-terracotta text-white px-7 py-3.5 rounded-full font-medium hover:bg-brand-700 transition-colors"
          >
            Browse Teachers
          </Link>
        </div>
      </section>
    </div>
  );
}
