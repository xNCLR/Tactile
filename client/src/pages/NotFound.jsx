import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="font-serif text-7xl text-sand mb-4">404</p>
        <h1 className="font-serif text-2xl text-bark mb-2">Page not found</h1>
        <p className="text-stone mb-6">The page you're looking for doesn't exist or has been moved.</p>
        <div className="flex gap-3 justify-center">
          <Link to="/" className="bg-bark text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-charcoal transition-colors">
            Go Home
          </Link>
          <Link to="/search" className="bg-blush text-bark px-4 py-2 rounded-full text-sm font-medium hover:bg-sand transition-colors">
            Find Teachers
          </Link>
        </div>
      </div>
    </div>
  );
}
