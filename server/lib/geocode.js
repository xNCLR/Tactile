/**
 * Geocode a UK postcode using the free postcodes.io API.
 * Returns { latitude, longitude } or null if lookup fails.
 */
async function geocodePostcode(postcode) {
  if (!postcode) return null;

  const cleaned = postcode.trim().replace(/\s+/g, '');
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleaned)}`);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== 200 || !data.result) return null;

    return {
      latitude: data.result.latitude,
      longitude: data.result.longitude,
    };
  } catch (err) {
    console.error('Geocode error:', err.message);
    return null;
  }
}

module.exports = { geocodePostcode };
