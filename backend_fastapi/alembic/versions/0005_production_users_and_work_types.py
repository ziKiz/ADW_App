"""Add production user metadata."""

from alembic import op

revision = "0005_prod_users_work_types"
down_revision = "0004_doctor_work_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_username TEXT")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_name TEXT")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_level TEXT")
    op.execute("CREATE INDEX IF NOT EXISTS idx_users_manager_username ON users(manager_username)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_users_manager_username")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS approval_level")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS manager_name")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS manager_username")
