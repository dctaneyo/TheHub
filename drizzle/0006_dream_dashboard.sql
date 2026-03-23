-- Dream Dashboard: New columns on existing tables
ALTER TABLE locations ADD COLUMN pattern_hash TEXT;
ALTER TABLE locations ADD COLUMN latitude REAL;
ALTER TABLE locations ADD COLUMN longitude REAL;
ALTER TABLE arls ADD COLUMN pattern_hash TEXT;

-- Mood check-ins
CREATE TABLE IF NOT EXISTS mood_checkins (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'kazi' REFERENCES tenants(id),
  location_id TEXT NOT NULL REFERENCES locations(id),
  date TEXT NOT NULL,
  mood_score INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- Shift handoffs
CREATE TABLE IF NOT EXISTS shift_handoffs (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'kazi' REFERENCES tenants(id),
  location_id TEXT NOT NULL REFERENCES locations(id),
  shift_date TEXT NOT NULL,
  shift_period TEXT NOT NULL,
  completed_task_count INTEGER NOT NULL,
  remaining_task_count INTEGER NOT NULL,
  remaining_task_ids TEXT,
  arl_messages TEXT,
  mood_score_avg REAL,
  handed_off_at TEXT,
  created_at TEXT NOT NULL
);

-- Challenges
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'kazi' REFERENCES tenants(id),
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL,
  winner_location_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Challenge participants
CREATE TABLE IF NOT EXISTS challenge_participants (
  id TEXT PRIMARY KEY NOT NULL,
  challenge_id TEXT NOT NULL REFERENCES challenges(id),
  location_id TEXT NOT NULL REFERENCES locations(id),
  joined_at TEXT NOT NULL
);

-- Challenge progress
CREATE TABLE IF NOT EXISTS challenge_progress (
  id TEXT PRIMARY KEY NOT NULL,
  challenge_id TEXT NOT NULL REFERENCES challenges(id),
  location_id TEXT NOT NULL REFERENCES locations(id),
  date TEXT NOT NULL,
  progress_value INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

-- Mentorship pairs
CREATE TABLE IF NOT EXISTS mentorship_pairs (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'kazi' REFERENCES tenants(id),
  mentor_location_id TEXT NOT NULL REFERENCES locations(id),
  mentee_location_id TEXT NOT NULL REFERENCES locations(id),
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  ended_at TEXT
);
