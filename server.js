const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
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
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_token TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      timestamp INTEGER NOT NULL,
      browser_info TEXT,
      os_info TEXT,
      ip_address TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(session_token) REFERENCES sessions(token)
    )
  `);

  db.all('PRAGMA table_info(locations)', (err, columns) => {
    if (err) {
      console.error('Failed to inspect locations table:', err);
      return;
    }
    const hasSessionToken = columns.some((col) => col.name === 'session_token');
    if (!hasSessionToken) {
      db.run('ALTER TABLE locations ADD COLUMN session_token TEXT');
    }
  });
});

function generateToken() {
  return crypto.randomBytes(18).toString('hex');
}

function createSession(callback) {
  const token = generateToken();
  const createdAt = Date.now();
  db.run('INSERT INTO sessions (token, created_at) VALUES (?, ?)', [token, createdAt], function (err) {
    if (err) {
      return callback(err);
    }
    callback(null, token);
  });
}

function validateToken(token, callback) {
  if (!token || typeof token !== 'string') {
    return callback(new Error('Invalid token')); 
  }

  db.get('SELECT token FROM sessions WHERE token = ?', [token], (err, row) => {
    if (err) {
      return callback(err);
    }
    if (!row) {
      return callback(new Error('Invalid token'));
    }
    callback(null, row.token);
  });
}

function broadcastLocation(token, location) {
  const subs = subscribers.get(token) || [];
  const payload = `data: ${JSON.stringify(location)}\n\n`;
  subs.forEach((res) => {
    res.write(payload);
  });
}

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
  const { latitude, longitude, accuracy, timestamp, browserInfo, osInfo, sessionToken } = req.body;

  if (typeof latitude !== 'number' || typeof longitude !== 'number' || typeof timestamp !== 'number') {
    return res.status(400).json({ error: 'Invalid location payload.' });
  }

  const ipAddress = getClientIp(req);
  const createdAt = Date.now();

  function saveLocation(token) {
    db.run(
      `INSERT INTO locations (session_token, latitude, longitude, accuracy, timestamp, browser_info, os_info, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [token, latitude, longitude, accuracy || null, timestamp, browserInfo || '', osInfo || '', ipAddress, createdAt],
      function (err) {
        if (err) {
          console.error('Insert failed:', err);
          return res.status(500).json({ error: 'Unable to save location.' });
        }

        const location = {
          id: this.lastID,
          session_token: token,
          latitude,
          longitude,
          accuracy: accuracy || null,
          timestamp,
          browser_info: browserInfo || '',
          os_info: osInfo || '',
          ip_address: ipAddress,
          created_at: createdAt
        };

        broadcastLocation(token, location);
        res.json({ id: this.lastID, token, dashboardUrl: `/dashboard.html?token=${encodeURIComponent(token)}` });
      }
    );
  }

  if (sessionToken) {
    validateToken(sessionToken, (err, validToken) => {
      if (err) {
        createSession((createErr, newToken) => {
          if (createErr) {
            console.error('Session creation failed:', createErr);
            return res.status(500).json({ error: 'Unable to create session.' });
          }
          saveLocation(newToken);
        });
        return;
      }
      saveLocation(validToken);
    });
  } else {
    createSession((err, token) => {
      if (err) {
        console.error('Session creation failed:', err);
        return res.status(500).json({ error: 'Unable to create session.' });
      }
      saveLocation(token);
    });
  }
});

app.get('/locations', (req, res) => {
  const token = req.query.token;
  validateToken(token, (err) => {
    if (err) {
      return res.status(401).json({ error: 'Unauthorized access.' });
    }

    db.all('SELECT * FROM locations WHERE session_token = ? ORDER BY created_at DESC LIMIT 200', [token], (err, rows) => {
      if (err) {
        console.error('Query failed:', err);
        return res.status(500).json({ error: 'Unable to load locations.' });
      }
      res.json(rows);
    });
  });
});

app.get('/stream-locations', (req, res) => {
  const token = req.query.token;
  validateToken(token, (err) => {
    if (err) {
      return res.status(401).json({ error: 'Unauthorized stream access.' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });

    res.write(': connected\n\n');

    const list = subscribers.get(token) || [];
    list.push(res);
    subscribers.set(token, list);

    req.on('close', () => {
      const updated = (subscribers.get(token) || []).filter((r) => r !== res);
      subscribers.set(token, updated);
    });
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server started: http://localhost:${PORT}`);
});
