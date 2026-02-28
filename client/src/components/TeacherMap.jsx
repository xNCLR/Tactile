import { useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon path with bundlers
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Brand-coloured marker
const teacherIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:32px;height:32px;background:#2d5a27;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -34],
});

// Reports map bounds whenever the user pans or zooms
function BoundsReporter({ onBoundsChange }) {
  const map = useMapEvents({
    moveend: () => {
      const b = map.getBounds();
      onBoundsChange({
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      });
    },
  });

  // Fire initial bounds on mount
  useEffect(() => {
    const b = map.getBounds();
    onBoundsChange({
      south: b.getSouth(),
      west: b.getWest(),
      north: b.getNorth(),
      east: b.getEast(),
    });
  }, [map, onBoundsChange]);

  return null;
}

export default function TeacherMap({ teachers, center, onBoundsChange }) {
  if (!center) return null;

  const handleBoundsChange = useCallback((bounds) => {
    onBoundsChange?.(bounds);
  }, [onBoundsChange]);

  return (
    <div>
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: '500px' }}>
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <BoundsReporter onBoundsChange={handleBoundsChange} />

          {teachers.map((teacher) => {
            if (!teacher.latitude || !teacher.longitude) return null;
            return (
              <Marker
                key={teacher.profile_id}
                position={[teacher.latitude, teacher.longitude]}
                icon={teacherIcon}
              >
                <Popup>
                  <div className="min-w-[180px]">
                    <p className="font-semibold text-sm">{teacher.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {teacher.distance != null ? `${teacher.distance} km away` : teacher.postcode}
                    </p>
                    <p className="text-xs text-gray-500">
                      From £{teacher.hourly_rate}/hr
                      {teacher.avg_rating ? ` · ${teacher.avg_rating}★` : ''}
                    </p>
                    {teacher.bio && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{teacher.bio}</p>
                    )}
                    <Link
                      to={`/teacher/${teacher.profile_id}`}
                      className="inline-block mt-2 text-xs font-medium text-brand-600 hover:text-brand-800"
                    >
                      View Profile →
                    </Link>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
      <p className="text-xs text-gray-400 mt-2 text-center">
        Teacher locations are approximate for privacy.
      </p>
    </div>
  );
}
