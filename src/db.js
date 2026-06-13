import Database from 'better-sqlite3';

const db = new Database('data.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    service TEXT,
    preferred_datetime TEXT,
    notes TEXT,
    status TEXT DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const insertMessageStmt = db.prepare(
  'INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)'
);

const getHistoryStmt = db.prepare(
  'SELECT role, content FROM messages WHERE chat_id = ? ORDER BY id DESC LIMIT ?'
);

const insertBookingStmt = db.prepare(
  `INSERT INTO bookings (chat_id, customer_name, customer_phone, service, preferred_datetime, notes)
   VALUES (?, ?, ?, ?, ?, ?)`
);

const allBookingsStmt = db.prepare(
  'SELECT * FROM bookings ORDER BY id DESC'
);
const updateBookingStatusStmt = db.prepare(
  'UPDATE bookings SET status = ? WHERE id = ?'
);

const getBookingByIdStmt = db.prepare(
  'SELECT * FROM bookings WHERE id = ?'
);

export function saveMessage(chatId, role, content) {
  insertMessageStmt.run(chatId, role, content);
}

// Returns history in chronological order (oldest first), limited to last N messages
export function getHistory(chatId, limit = 12) {
  const rows = getHistoryStmt.all(chatId, limit);
  return rows.reverse();
}

export function saveBooking(chatId, booking) {
  const { customerName, customerPhone, service, preferredDatetime, notes } = booking;
  const result = insertBookingStmt.run(
    chatId,
    customerName || null,
    customerPhone || null,
    service || null,
    preferredDatetime || null,
    notes || null
  );
  return result.lastInsertRowid;
}

export function getAllBookings() {
  return allBookingsStmt.all();
}

export default db;
