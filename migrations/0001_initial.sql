PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('buyer', 'seller')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price REAL NOT NULL CHECK (price > 0),
  category TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('new', 'like_new', 'good', 'fair')),
  location TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'reserved', 'sold', 'paused')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS listing_images (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data_url TEXT NOT NULL,
  r2_key TEXT,
  is_primary INTEGER NOT NULL CHECK (is_primary IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  buyer_id TEXT NOT NULL REFERENCES users(id),
  seller_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (
    status IN ('requested', 'awaiting_payment', 'payment_sent', 'paid', 'overdue', 'cancelled', 'sold')
  ),
  payment_due_at TEXT NOT NULL,
  overdue_notified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (buyer_id != seller_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_reservation_per_listing
  ON reservations(listing_id)
  WHERE status IN ('requested', 'awaiting_payment', 'payment_sent', 'overdue');

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (
    type IN ('reservation_created', 'message_received', 'payment_due', 'payment_overdue', 'payment_paid')
  ),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  entity_id TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_listing_images_listing_id ON listing_images(listing_id);
CREATE INDEX IF NOT EXISTS idx_reservations_buyer_id ON reservations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_reservations_seller_id ON reservations(seller_id);
CREATE INDEX IF NOT EXISTS idx_messages_reservation_id_created_at ON messages(reservation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at ON notifications(user_id, created_at);

