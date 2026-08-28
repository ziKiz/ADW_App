"""Add attachment device dictionary."""

from alembic import op

revision = "0007_attachment_devices"
down_revision = "0006_support_user_and_blood_donation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS attachments (
          id BIGSERIAL PRIMARY KEY,
          attachment_code TEXT,
          attachment_name TEXT NOT NULL,
          license_plate TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_by TEXT,
          archived_at TIMESTAMPTZ,
          archived_by TEXT,
          last_change TEXT
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_attachments_status ON attachments(status)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_attachments_code ON attachments(attachment_code)")
    op.execute(
        """
        CREATE TRIGGER attachments_touch_updated_at
        BEFORE UPDATE ON attachments
        FOR EACH ROW EXECUTE FUNCTION adw_touch_updated_at();
        """
    )
    op.execute(
        """
        CREATE TRIGGER attachments_audit_row
        AFTER INSERT OR UPDATE OR DELETE ON attachments
        FOR EACH ROW EXECUTE FUNCTION adw_audit_row();
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS attachments CASCADE")
