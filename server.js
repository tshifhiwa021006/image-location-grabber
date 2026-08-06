const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_DIR = path.join(__dirname, 'db');
const DB_PATH = path.join(DB_DIR, 'locations.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to open database:', err);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      timestamp INTEGER NOT NULL,
      browser_info TEXT,
      os_info TEXT,
      ip_address TEXT,
      created_at INTEGER NOT NULL
    )
  `);
});

app.set('trust proxy', true);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection.remoteAddress || '';
}

app.post('/share-location', (req, res) => {
  const { latitude, longitude, accuracy, timestamp, browserInfo, osInfo } = req.body;

  if (typeof latitude !== 'number' || typeof longitude !== 'number' || typeof timestamp !== 'number') {
    return res.status(400).json({ error: 'Invalid location payload.' });
  }

  const ipAddress = getClientIp(req);
  const createdAt = Date.now();

  db.run(
    `INSERT INTO locations (latitude, longitude, accuracy, timestamp, browser_info, os_info, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [latitude, longitude, accuracy || null, timestamp, browserInfo || '', osInfo || '', ipAddress, createdAt],
    function (err) {
      if (err) {
        console.error('Insert failed:', err);
        return res.status(500).json({ error: 'Unable to save location.' });
      }

      res.json({ id: this.lastID, message: 'Location shared successfully.' });
    }
  );
});

app.get('/locations', (req, res) => {
  db.all('SELECT * FROM locations ORDER BY created_at DESC LIMIT 200', (err, rows) => {
    if (err) {
      console.error('Query failed:', err);
      return res.status(500).json({ error: 'Unable to load locations.' });
    }
    res.json(rows);
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server started: http://localhost:${PORT}`);
});
