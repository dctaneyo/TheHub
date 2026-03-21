CREATE TABLE org_ip_mappings (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  ip_address TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES arls(id),
  created_at TEXT NOT NULL
);
