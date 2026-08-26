"""Add doctor absence work type."""

from alembic import op

revision = "0004_doctor_work_type"
down_revision = "0003_reset_sequences"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO work_types(name, description, created_by, updated_by, last_change)
        SELECT 'Doktor', 'Návštěva lékaře nebo zdravotní volno', 'Systém', 'Systém', 'Vytvoření záznamu'
        WHERE NOT EXISTS (
          SELECT 1 FROM work_types WHERE name = 'Doktor' AND archived_at IS NULL
        )
        """
    )
    op.execute(
        """
        SELECT setval(
          pg_get_serial_sequence('work_types', 'id'),
          GREATEST(COALESCE((SELECT MAX(id) FROM work_types), 0), 1),
          COALESCE((SELECT MAX(id) FROM work_types), 0) > 0
        )
        """
    )


def downgrade() -> None:
    op.execute("UPDATE work_types SET archived_at = NOW(), last_change = 'Archivace migrace' WHERE name = 'Doktor'")
