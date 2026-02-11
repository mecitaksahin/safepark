-- Sprint-4 Install Flow platform state
-- Target: PostgreSQL

CREATE TABLE IF NOT EXISTS platform_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_installed BOOLEAN NOT NULL DEFAULT FALSE,
  installed_at TIMESTAMPTZ NULL,
  installed_tenant_id UUID NULL REFERENCES tenants(id) ON DELETE SET NULL,
  installed_branch_id UUID NULL REFERENCES branches(id) ON DELETE SET NULL,
  installed_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_state (id, is_installed, installed_at, installed_tenant_id, installed_branch_id, installed_user_id, updated_at)
VALUES (1, FALSE, NULL, NULL, NULL, NULL, NOW())
ON CONFLICT (id) DO NOTHING;
