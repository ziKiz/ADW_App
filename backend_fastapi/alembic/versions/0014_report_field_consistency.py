"""Remove stale field data and enforce field consistency.

Revision ID: 0014_field_consistency
Revises: 0013_report_workflow
"""

from alembic import op


revision = "0014_field_consistency"
down_revision = "0013_report_workflow"
branch_labels = None
depends_on = None


NO_FIELD_WORK_TYPES_SQL = """
  'montáž', 'demontáž', 'oprava', 'údržba', 'práce s nakladačem',
  'práce s nakladačem, destou', 'krmení', 'nahrnování', 'dusání',
  'rozvoz minimlékarna', 'odkrývání silážních jam', 'zakrývání silážních jam',
  'úklid', 'práce bps', 'čištění stroje', 'čistění stroje', 'jiné'
"""


def upgrade() -> None:
    op.execute("ALTER TABLE reports ALTER COLUMN amount_ha DROP NOT NULL")
    op.execute(
        f"""
        CREATE OR REPLACE FUNCTION adw_enforce_report_field_consistency()
        RETURNS TRIGGER AS $$
        DECLARE
          work_type_name TEXT;
        BEGIN
          SELECT LOWER(TRIM(name)) INTO work_type_name FROM work_types WHERE id = NEW.work_type_id;
          IF NEW.report_kind IS DISTINCT FROM 'work'
             OR LOWER(TRIM(COALESCE(NEW.service_center, ''))) <> LOWER('Rostlinná výroba')
             OR work_type_name IS NULL
             OR work_type_name IN ({NO_FIELD_WORK_TYPES_SQL}) THEN
            NEW.field_id := NULL;
            NEW.field_entries := '[]'::jsonb;
            NEW.amount_ha := NULL;
          ELSIF NEW.field_id IS NULL
                AND (CASE
                       WHEN jsonb_typeof(NEW.field_entries) = 'array' THEN jsonb_array_length(NEW.field_entries)
                       ELSE 0
                     END) = 0 THEN
            NEW.amount_ha := NULL;
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute("DROP TRIGGER IF EXISTS reports_field_consistency ON reports")
    op.execute(
        """
        CREATE TRIGGER reports_field_consistency
        BEFORE INSERT OR UPDATE OF report_kind, service_center, work_type_id, field_id, field_entries, amount_ha
        ON reports
        FOR EACH ROW EXECUTE FUNCTION adw_enforce_report_field_consistency()
        """
    )
    op.execute("SELECT set_config('adw.actor_name', 'Migrace 0.5.2', true)")
    op.execute("SELECT set_config('adw.request_id', 'migration-0014-field-consistency', true)")
    op.execute(
        f"""
        UPDATE reports AS report
        SET field_id = NULL,
            field_entries = '[]'::jsonb,
            amount_ha = NULL,
            updated_by = 'Migrace 0.5.2'
        FROM work_types AS work_type
        WHERE report.work_type_id = work_type.id
          AND LOWER(TRIM(work_type.name)) IN ({NO_FIELD_WORK_TYPES_SQL})
          AND (
            report.field_id IS NOT NULL
            OR COALESCE(report.amount_ha, 0) <> 0
            OR CASE
                 WHEN jsonb_typeof(report.field_entries) = 'array' THEN jsonb_array_length(report.field_entries)
                 ELSE 0
               END > 0
          )
        """
    )
    op.execute(
        """
        UPDATE reports
        SET amount_ha = NULL,
            updated_by = 'Migrace 0.5.2'
        WHERE field_id IS NULL
          AND (CASE
                 WHEN jsonb_typeof(field_entries) = 'array' THEN jsonb_array_length(field_entries)
                 ELSE 0
               END) = 0
          AND amount_ha IS NOT NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS reports_field_consistency ON reports")
    op.execute("DROP FUNCTION IF EXISTS adw_enforce_report_field_consistency()")
    op.execute("UPDATE reports SET amount_ha = 0 WHERE amount_ha IS NULL")
    op.execute("ALTER TABLE reports ALTER COLUMN amount_ha SET NOT NULL")
