"""Redact password hashes from user audit records.

Revision ID: 0015_redact_password_audit
Revises: 0014_field_consistency
"""

from alembic import op


revision = "0015_redact_password_audit"
down_revision = "0014_field_consistency"
branch_labels = None
depends_on = None


AUDIT_FUNCTION_SQL = """
CREATE OR REPLACE FUNCTION adw_audit_row()
RETURNS TRIGGER AS $$
DECLARE
  actor_name TEXT;
  actor_id TEXT;
  rid TEXT;
  row_id BIGINT;
  old_data JSONB;
  new_data JSONB;
BEGIN
  IF TG_TABLE_NAME = 'audit_log' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  actor_name := NULLIF(current_setting('adw.actor_name', true), '');
  actor_id := NULLIF(current_setting('adw.actor_id', true), '');
  rid := NULLIF(current_setting('adw.request_id', true), '');

  IF TG_OP IN ('DELETE', 'UPDATE') THEN
    old_data := to_jsonb(OLD);
    IF TG_TABLE_NAME = 'users' THEN
      old_data := old_data - 'password_hash';
    END IF;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    new_data := to_jsonb(NEW);
    IF TG_TABLE_NAME = 'users' THEN
      new_data := new_data - 'password_hash';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    row_id := OLD.id;
    INSERT INTO audit_log(collection, record_id, action, changed_by, changed_by_id, request_id, before_data, after_data)
    VALUES (TG_TABLE_NAME, row_id, 'delete', COALESCE(actor_name, 'DB'), actor_id, rid, old_data, NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    row_id := NEW.id;
    INSERT INTO audit_log(collection, record_id, action, changed_by, changed_by_id, request_id, before_data, after_data)
    VALUES (TG_TABLE_NAME, row_id, 'update', COALESCE(actor_name, 'DB'), actor_id, rid, old_data, new_data);
    RETURN NEW;
  ELSE
    row_id := NEW.id;
    INSERT INTO audit_log(collection, record_id, action, changed_by, changed_by_id, request_id, before_data, after_data)
    VALUES (TG_TABLE_NAME, row_id, 'create', COALESCE(actor_name, 'DB'), actor_id, rid, NULL, new_data);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;
"""


def upgrade() -> None:
    op.execute(AUDIT_FUNCTION_SQL)
    op.execute(
        """
        UPDATE audit_log
        SET before_data = CASE WHEN before_data IS NULL THEN NULL ELSE before_data - 'password_hash' END,
            after_data = CASE WHEN after_data IS NULL THEN NULL ELSE after_data - 'password_hash' END
        WHERE collection = 'users'
          AND (
            COALESCE(before_data, '{}'::jsonb) ? 'password_hash'
            OR COALESCE(after_data, '{}'::jsonb) ? 'password_hash'
          )
        """
    )


def downgrade() -> None:
    op.execute(AUDIT_FUNCTION_SQL)
