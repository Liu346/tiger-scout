CREATE TABLE IF NOT EXISTS scouting_records (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  match_number TEXT NOT NULL,
  team TEXT NOT NULL,
  scout TEXT,
  alliance TEXT,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_records_event ON scouting_records(event);
CREATE INDEX IF NOT EXISTS idx_records_team ON scouting_records(team);
CREATE INDEX IF NOT EXISTS idx_records_updated ON scouting_records(updated_at);

