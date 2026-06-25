CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  apns_token TEXT,
  tz TEXT,
  apns_env TEXT DEFAULT 'production',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS device_stack (
  device_id TEXT NOT NULL,
  tech_key TEXT NOT NULL,
  PRIMARY KEY (device_id, tech_key)
);
CREATE TABLE IF NOT EXISTS items (
  item_id TEXT PRIMARY KEY,
  source TEXT, cve_id TEXT, kev INTEGER DEFAULT 0,
  severity TEXT, cvss REAL, published TEXT, title TEXT,
  raw_json TEXT, summary TEXT, impact TEXT, action TEXT,
  source_url TEXT, product TEXT,
  category TEXT DEFAULT 'vuln', source_name TEXT, score REAL,
  evidence TEXT, grounded INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS item_tech (
  item_id TEXT NOT NULL,
  tech_key TEXT NOT NULL,
  PRIMARY KEY (item_id, tech_key)
);
CREATE INDEX IF NOT EXISTS idx_item_tech_key ON item_tech(tech_key);
CREATE INDEX IF NOT EXISTS idx_items_published ON items(published);
CREATE INDEX IF NOT EXISTS idx_items_created ON items(created_at);
CREATE TABLE IF NOT EXISTS push_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT, item_id TEXT, sent_at TEXT, status TEXT
);
CREATE INDEX IF NOT EXISTS idx_push_log_device_item ON push_log(device_id, item_id);
CREATE INDEX IF NOT EXISTS idx_items_category_created ON items(category, created_at);
