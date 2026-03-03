import { useMemo } from 'react';

/**
 * Two sine waves, phase-shifted, that weave in and out of proximity.
 * "Curves that nearly touch carry more tension than curves that intersect."
 *
 * y = sin(t × π × 2.3 + phase) × 35 × scale + sin(t × π × 0.9 + phase × 0.4) × 18 × scale
 * Second curve gets phase offset of 0.55.
 */
function generateWavePath(width, height, phase, scale = 1) {
  const centerY = height / 2;
  const steps = 200;
  const points = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = t * width;
    const y =
      Math.sin(t * Math.PI * 2.3 + phase) * 35 * scale +
      Math.sin(t * Math.PI * 0.9 + phase * 0.4) * 18 * scale;
    points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${(centerY + y).toFixed(1)}`);
  }

  return points.join(' ');
}

export default function WaveBackground() {
  const paths = useMemo(() => {
    const w = 1440;
    const h = 300;
    return {
      wave1: generateWavePath(w, h, 0, 1.6),
      wave2: generateWavePath(w, h, 0.55, 1.6),
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      {/* Upper pair */}
      <svg
        viewBox="0 0 1440 300"
        preserveAspectRatio="none"
        className="absolute top-[12%] left-0 w-full h-[300px] opacity-[0.15]"
      >
        <path d={paths.wave1} fill="none" stroke="#D9C7AD" strokeWidth="3" />
        <path d={paths.wave2} fill="none" stroke="#B8947A" strokeWidth="3" />
      </svg>

      {/* Lower pair — flipped and offset */}
      <svg
        viewBox="0 0 1440 300"
        preserveAspectRatio="none"
        className="absolute top-[55%] left-0 w-full h-[300px] opacity-[0.10]"
        style={{ transform: 'scaleX(-1)' }}
      >
        <path d={paths.wave1} fill="none" stroke="#D9C7AD" strokeWidth="3" />
        <path d={paths.wave2} fill="none" stroke="#B8947A" strokeWidth="3" />
      </svg>
    </div>
  );
}
