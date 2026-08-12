const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Resolve the safest and most persistent path for SQLite
function resolveDbPath() {
  if (process.env.DB_PATH && process.env.DB_PATH.trim()) {
    return process.env.DB_PATH.trim();
  }

  // Check persistent disk mount locations on Render / Linux cloud hosts
  const candidateDirs = [
    '/var/data',
    '/data',
    '/opt/render/project/data'
  ];

  for (const dir of candidateDirs) {
    try {
      if (fs.existsSync(dir)) {
        const testFile = path.join(dir, '.write_test');
        fs.writeFileSync(testFile, 'ok');
        fs.unlinkSync(testFile);
        console.log(`💾 Using persistent disk directory: ${dir}`);
        return path.join(dir, 'study_vision.db');
      }
    } catch (e) {
      // Directory not writable or doesn't exist
    }
  }

  // Fallback to local directory
  return path.join(__dirname, 'database.db');
}

const DB_PATH = resolveDbPath();

// Ensure parent directory exists
try {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
} catch (e) {}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Database open error:', err.message);
  } else {
    console.log('✅ Persistent SQLite database connected at:', DB_PATH);
  }
});

function initDB() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Optimize SQLite for high reliability & durability
      db.run(`PRAGMA journal_mode = WAL;`);
      db.run(`PRAGMA synchronous = NORMAL;`);
      db.run(`PRAGMA foreign_keys = ON;`);

      // 1. Users Table (Safe & Idempotent: NEVER drops or deletes existing records)
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password TEXT NOT NULL,
        is_verified INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )`, (err) => {
        if (err) console.error('Error ensuring users table exists:', err.message);
      });

      // 2. OTPs Table
      db.run(`CREATE TABLE IF NOT EXISTS otps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL COLLATE NOCASE,
        otp TEXT NOT NULL,
        purpose TEXT NOT NULL CHECK(purpose IN ('signup','forgot','login')),
        expires_at DATETIME NOT NULL,
        used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // 3. Sessions Table
      db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )`);

      // 4. Documents Library Table
      db.run(`CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        title TEXT NOT NULL,
        subject TEXT,
        year TEXT,
        stream TEXT,
        text_content TEXT,
        pages INTEGER,
        source TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )`);

      // 5. Quiz Attempts Table
      db.run(`CREATE TABLE IF NOT EXISTS quiz_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        quiz_title TEXT,
        subject TEXT,
        score INTEGER,
        total INTEGER,
        pct INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )`);

      // 6. Study Sessions (Pomodoro) Table
      db.run(`CREATE TABLE IF NOT EXISTS study_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        duration_min INTEGER,
        break_min INTEGER,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed INTEGER DEFAULT 0,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )`, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('✅ SQLite Schema verified — All user accounts & data preserved safely.');
          resolve();
        }
      });
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = { db, initDB, run, get, all, DB_PATH };
