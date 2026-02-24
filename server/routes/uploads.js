const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDb, queryOne, runSql } = require('../db/schema');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Configure multer
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .jpg, .jpeg, .png, .webp files are allowed'));
    }
  },
});

// POST /api/uploads/profile-photo — upload/replace profile photo
router.post('/profile-photo', authenticate, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const photoUrl = `/uploads/${req.file.filename}`;
    const db = await getDb();

    // Delete old file if exists
    const user = queryOne(db, 'SELECT profile_photo FROM users WHERE id = ?', [req.user.id]);
    if (user?.profile_photo) {
      const oldPath = path.join(__dirname, '..', user.profile_photo);
      try { require('fs').unlinkSync(oldPath); } catch {}
    }

    runSql(db, 'UPDATE users SET profile_photo = ?, updated_at = datetime(\'now\') WHERE id = ?', [photoUrl, req.user.id]);

    res.json({ url: photoUrl });
  } catch (err) {
    console.error('Profile photo upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// POST /api/uploads/portfolio — upload a portfolio photo (teachers only, max 3)
router.post('/portfolio', authenticate, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const db = await getDb();
    const profile = queryOne(db, 'SELECT * FROM teacher_profiles WHERE user_id = ?', [req.user.id]);
    if (!profile) return res.status(403).json({ error: 'Only teachers can upload portfolio photos' });

    const photoUrl = `/uploads/${req.file.filename}`;

    // Find the first empty slot
    let slot = null;
    if (!profile.photo_1) slot = 'photo_1';
    else if (!profile.photo_2) slot = 'photo_2';
    else if (!profile.photo_3) slot = 'photo_3';
    else return res.status(400).json({ error: 'Maximum 3 portfolio photos. Delete one first.' });

    runSql(db, `UPDATE teacher_profiles SET ${slot} = ? WHERE user_id = ?`, [photoUrl, req.user.id]);

    res.json({ url: photoUrl, slot });
  } catch (err) {
    console.error('Portfolio upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// DELETE /api/uploads/portfolio/:slot — remove a portfolio photo
router.delete('/portfolio/:slot', authenticate, async (req, res) => {
  try {
    const { slot } = req.params;
    if (!['photo_1', 'photo_2', 'photo_3'].includes(slot)) {
      return res.status(400).json({ error: 'Invalid slot' });
    }

    const db = await getDb();
    const profile = queryOne(db, 'SELECT * FROM teacher_profiles WHERE user_id = ?', [req.user.id]);
    if (!profile) return res.status(403).json({ error: 'Not a teacher' });

    // Delete file
    if (profile[slot]) {
      const filePath = path.join(__dirname, '..', profile[slot]);
      try { require('fs').unlinkSync(filePath); } catch {}
    }

    runSql(db, `UPDATE teacher_profiles SET ${slot} = NULL WHERE user_id = ?`, [req.user.id]);

    res.json({ message: 'Photo removed' });
  } catch (err) {
    console.error('Portfolio delete error:', err);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

module.exports = router;
