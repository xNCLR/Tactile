const express = require('express');
const { getDb, queryAll, queryOne, runSql } = require('../db/schema');
const { authenticate } = require('../middleware/auth');
const logger = require('../lib/logger');

const router = express.Router();

// GET /api/notifications — list user's notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const notifications = queryAll(db,
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]);
    const unreadCount = queryOne(db,
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0',
      [req.user.id]);
    res.json({ notifications, unreadCount: unreadCount?.count || 0 });
  } catch (err) {
    logger.error('Notifications fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PATCH /api/notifications/read-all — mark all as read
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    runSql(db, 'UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0', [req.user.id]);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    logger.error('Mark read error:', err);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// PATCH /api/notifications/:id/read — mark single notification as read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const notification = queryOne(db,
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    runSql(db, 'UPDATE notifications SET read = 1 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    logger.error('Mark single read error:', err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// GET /api/notifications/unread-count — quick poll endpoint
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const result = queryOne(db,
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0',
      [req.user.id]);
    res.json({ count: result?.count || 0 });
  } catch (err) {
    res.status(500).json({ count: 0 });
  }
});

module.exports = router;
