"""Add two-stage report approval routing.

Revision ID: 0008_cross_manager_approvals
Revises: 0007_attachment_devices
"""

from alembic import op


revision = "0008_cross_manager_approvals"
down_revision = "0007_attachment_devices"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS primary_approver_id BIGINT REFERENCES users(id) ON DELETE SET NULL")
    op.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS task_approver_id BIGINT REFERENCES users(id) ON DELETE SET NULL")
    op.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS primary_approval_status TEXT NOT NULL DEFAULT 'pending'")
    op.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS task_approval_status TEXT NOT NULL DEFAULT 'not_required'")
    op.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS primary_approved_at TIMESTAMPTZ")
    op.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS task_approved_at TIMESTAMPTZ")
    op.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS primary_approved_by TEXT")
    op.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS task_approved_by TEXT")
    op.execute("ALTER TABLE approvals ADD COLUMN IF NOT EXISTS approval_role TEXT")

    op.execute(
        """
        UPDATE reports r
        SET primary_approver_id = manager.id
        FROM users employee
        JOIN users manager ON manager.username = employee.manager_username
        WHERE r.user_id = employee.id
          AND r.primary_approver_id IS NULL
          AND manager.active = TRUE
          AND manager.archived_at IS NULL
          AND manager.role IN ('admin', 'reditel', 'schvalovatel', 'specialista')
        """
    )
    op.execute(
        """
        UPDATE reports r
        SET primary_approver_id = (
          SELECT leader.id
          FROM users employee
          JOIN users leader
            ON leader.active = TRUE
           AND leader.archived_at IS NULL
           AND leader.role IN ('schvalovatel', 'specialista', 'reditel', 'admin')
           AND COALESCE(leader.scope_department, leader.department_name) = COALESCE(employee.scope_department, employee.department_name)
          WHERE employee.id = r.user_id
          ORDER BY
            CASE leader.role WHEN 'schvalovatel' THEN 0 WHEN 'specialista' THEN 1 WHEN 'reditel' THEN 2 ELSE 3 END,
            leader.id
          LIMIT 1
        )
        WHERE r.primary_approver_id IS NULL
        """
    )
    op.execute(
        """
        UPDATE reports r
        SET primary_approver_id = r.user_id
        FROM users employee
        WHERE employee.id = r.user_id
          AND r.primary_approver_id IS NULL
          AND employee.role IN ('admin', 'reditel', 'schvalovatel', 'specialista')
        """
    )
    op.execute(
        """
        UPDATE reports
        SET task_approver_id = primary_approver_id,
            task_approval_status = 'not_required',
            primary_approval_status = CASE
              WHEN status = 'approved' THEN 'approved'
              WHEN status = 'rejected' THEN 'rejected'
              ELSE 'pending'
            END,
            primary_approved_at = CASE WHEN status = 'approved' THEN COALESCE(updated_at, submitted_at, created_at) ELSE NULL END,
            primary_approved_by = CASE WHEN status = 'approved' THEN updated_by ELSE NULL END
        WHERE task_approver_id IS NULL
        """
    )

    op.execute("CREATE INDEX IF NOT EXISTS idx_reports_primary_approver ON reports(primary_approver_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_reports_task_approver ON reports(task_approver_id)")
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_reports_primary_approval_status') THEN
            ALTER TABLE reports ADD CONSTRAINT ck_reports_primary_approval_status
              CHECK (primary_approval_status IN ('pending', 'approved', 'rejected'));
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_reports_task_approval_status') THEN
            ALTER TABLE reports ADD CONSTRAINT ck_reports_task_approval_status
              CHECK (task_approval_status IN ('not_required', 'pending', 'approved', 'rejected'));
          END IF;
        END $$
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE reports DROP CONSTRAINT IF EXISTS ck_reports_task_approval_status")
    op.execute("ALTER TABLE reports DROP CONSTRAINT IF EXISTS ck_reports_primary_approval_status")
    op.execute("DROP INDEX IF EXISTS idx_reports_task_approver")
    op.execute("DROP INDEX IF EXISTS idx_reports_primary_approver")
    op.execute("ALTER TABLE approvals DROP COLUMN IF EXISTS approval_role")
    op.execute("ALTER TABLE reports DROP COLUMN IF EXISTS task_approved_by")
    op.execute("ALTER TABLE reports DROP COLUMN IF EXISTS primary_approved_by")
    op.execute("ALTER TABLE reports DROP COLUMN IF EXISTS task_approved_at")
    op.execute("ALTER TABLE reports DROP COLUMN IF EXISTS primary_approved_at")
    op.execute("ALTER TABLE reports DROP COLUMN IF EXISTS task_approval_status")
    op.execute("ALTER TABLE reports DROP COLUMN IF EXISTS primary_approval_status")
    op.execute("ALTER TABLE reports DROP COLUMN IF EXISTS task_approver_id")
    op.execute("ALTER TABLE reports DROP COLUMN IF EXISTS primary_approver_id")
