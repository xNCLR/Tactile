const { v4: uuidv4 } = require('uuid');
const { getDb, runSql } = require('../db/schema');
const logger = require('./logger');

async function createNotification({ userId, type, title, message, link }) {
  try {
    const db = await getDb();
    const id = uuidv4();
    runSql(db, 'INSERT INTO notifications (id, user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?, ?)',
      [id, userId, type, title, message, link || null]);
    return id;
  } catch (err) {
    logger.error('Create notification error:', err);
    return null;
  }
}

module.exports = { createNotification };
