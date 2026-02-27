const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb, initDb, runSql, saveDb, saveDbSync } = require('./schema');

const CATEGORIES = [
  { name: 'Portrait', slug: 'portrait' },
  { name: 'Street', slug: 'street' },
  { name: 'Landscape', slug: 'landscape' },
  { name: 'Product', slug: 'product' },
  { name: 'Fashion', slug: 'fashion' },
  { name: 'Wedding', slug: 'wedding' },
  { name: 'Wildlife', slug: 'wildlife' },
  { name: 'Macro', slug: 'macro' },
  { name: 'Architecture', slug: 'architecture' },
  { name: 'Night / Astro', slug: 'night' },
  { name: 'Film / Analog', slug: 'film' },
  { name: 'Drone / Aerial', slug: 'drone' },
];

const USERS_WITH_TEACHING = [
  { name: 'Sarah Chen', email: 'sarah@example.com', postcode: 'W1D 3AF', lat: 51.5134, lng: -0.1312, phone: '07700900010',
    bio: 'Award-winning portrait photographer with 10 years of experience. I specialise in natural light techniques and helping beginners find their creative eye.', rate: 45,
    equipment: 'Camera with manual mode (I can lend a spare if needed)', weekdays: 1, weekends: 1, travelRadius: 15, cancelHours: 24,
    categories: ['portrait', 'fashion'] },
  { name: 'James Morrison', email: 'james@example.com', postcode: 'SE1 9GF', lat: 51.5045, lng: -0.0865, phone: '07700900011',
    bio: 'Street photography enthusiast and Fujifilm ambassador. 5 years teaching along the South Bank. Documentary and candid style.', rate: 55,
    equipment: 'Any camera, even a smartphone works for street photography', weekdays: 1, weekends: 0, travelRadius: 8, cancelHours: 12,
    categories: ['street', 'film'] },
  { name: 'Priya Patel', email: 'priya@example.com', postcode: 'E1 6AN', lat: 51.5175, lng: -0.0714, phone: '07700900012',
    bio: 'Fashion and editorial photographer. Private lessons covering composition, lighting setups, and directing models.', rate: 75,
    equipment: 'DSLR or mirrorless camera, external flash recommended', weekdays: 0, weekends: 1, travelRadius: 5, cancelHours: 48,
    categories: ['fashion', 'portrait'] },
  { name: 'Tom Wright', email: 'tom@example.com', postcode: 'NW1 4NR', lat: 51.5353, lng: -0.1440, phone: '07700900013',
    bio: 'Landscape and architecture photographer near Regent\'s Park. Long exposure and golden hour techniques. Lessons are outdoors!', rate: 40,
    equipment: 'Camera with manual mode, tripod strongly recommended', weekdays: 1, weekends: 1, travelRadius: 25, cancelHours: 24,
    categories: ['landscape', 'architecture', 'night'] },
  { name: 'Amara Okafor', email: 'amara@example.com', postcode: 'SW7 2DD', lat: 51.4965, lng: -0.1764, phone: '07700900014',
    bio: 'Fine art photographer and Royal College of Art graduate. Creative photography — double exposures, intentional camera movement, abstract compositions.', rate: 60,
    equipment: 'Any camera with manual controls', weekdays: 1, weekends: 1, travelRadius: 20, cancelHours: 24,
    categories: ['portrait', 'macro', 'film'] },
  { name: 'David Kim', email: 'david@example.com', postcode: 'EC2A 3AY', lat: 51.5235, lng: -0.0840, phone: '07700900015',
    bio: 'Commercial product photographer with a home studio in Shoreditch. Product and food photography for Instagram, Etsy, or personal projects.', rate: 50,
    equipment: 'Camera, I provide all studio lighting and props', weekdays: 1, weekends: 0, travelRadius: 3, cancelHours: 48,
    categories: ['product'] },
];

const USERS_WITHOUT_TEACHING = [
  { name: 'Alex Turner', email: 'alex@example.com', postcode: 'W1T 1JY', lat: 51.5178, lng: -0.1353, phone: '07700900001' },
  { name: 'Emma Watson', email: 'emma@example.com', postcode: 'SE1 7PB', lat: 51.5055, lng: -0.0910, phone: '07700900002' },
  { name: 'Rahul Sharma', email: 'rahul@example.com', postcode: 'E2 8DY', lat: 51.5275, lng: -0.0670, phone: '07700900003' },
];

const TIME_SLOTS = [
  { day: 1, start: '09:00', end: '12:00' },
  { day: 1, start: '14:00', end: '17:00' },
  { day: 2, start: '10:00', end: '13:00' },
  { day: 3, start: '09:00', end: '12:00' },
  { day: 4, start: '14:00', end: '17:00' },
  { day: 5, start: '10:00', end: '16:00' },
  { day: 6, start: '09:00', end: '17:00' },
  { day: 0, start: '10:00', end: '15:00' },
];

async function seed() {
  await initDb();
  const db = await getDb();
  const passwordHash = bcrypt.hashSync('password123', 10);

  // Clear existing data
  db.run('DELETE FROM teacher_categories');
  db.run('DELETE FROM disputes');
  db.run('DELETE FROM messages');
  db.run('DELETE FROM reviews');
  db.run('DELETE FROM bookings');
  db.run('DELETE FROM time_slots');
  db.run('DELETE FROM teacher_profiles');
  db.run('DELETE FROM categories');
  db.run('DELETE FROM password_reset_tokens');
  db.run('DELETE FROM users');

  // Seed categories
  const categoryIds = {};
  for (const cat of CATEGORIES) {
    const id = uuidv4();
    categoryIds[cat.slug] = id;
    db.run('INSERT INTO categories (id, name, slug) VALUES (?, ?, ?)', [id, cat.name, cat.slug]);
  }

  // Create users with teaching profiles
  for (const t of USERS_WITH_TEACHING) {
    const userId = uuidv4();
    const profileId = uuidv4();

    db.run(`INSERT INTO users (id, email, password_hash, name, role, phone, postcode, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, t.email, passwordHash, t.name, 'user', t.phone, t.postcode, t.lat, t.lng]);

    db.run(`INSERT INTO teacher_profiles (id, user_id, bio, hourly_rate, equipment_requirements, available_weekdays, available_weekends, search_radius_km, cancellation_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [profileId, userId, t.bio, t.rate, t.equipment, t.weekdays, t.weekends, t.travelRadius || 10, t.cancelHours || 24]);

    // Link categories
    for (const slug of (t.categories || [])) {
      if (categoryIds[slug]) {
        db.run('INSERT INTO teacher_categories (teacher_id, category_id) VALUES (?, ?)', [profileId, categoryIds[slug]]);
      }
    }

    for (const slot of TIME_SLOTS) {
      const isWeekend = slot.day === 0 || slot.day === 6;
      if (isWeekend && !t.weekends) continue;
      if (!isWeekend && !t.weekdays) continue;
      db.run(`INSERT INTO time_slots (id, teacher_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), profileId, slot.day, slot.start, slot.end]);
    }
  }

  // Create users without teaching profiles
  for (const s of USERS_WITHOUT_TEACHING) {
    db.run(`INSERT INTO users (id, email, password_hash, name, role, phone, postcode, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), s.email, passwordHash, s.name, 'user', s.phone, s.postcode, s.lat, s.lng]);
  }

  saveDbSync();
  console.log('Seed data inserted successfully!');
  console.log(`  ${CATEGORIES.length} photography categories`);
  console.log(`  ${USERS_WITH_TEACHING.length} users with teaching profiles`);
  console.log(`  ${USERS_WITHOUT_TEACHING.length} users without teaching profiles`);
  console.log('  All users can book lessons AND optionally teach');
  console.log('  Login with any email above + password: password123');
}

seed().catch(console.error);
