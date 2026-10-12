"""Update report workflow, work types and Martin Skucius account.

Revision ID: 0013_report_workflow
Revises: 0012_martina_admin
"""

from alembic import op


revision = "0013_report_workflow"
down_revision = "0012_martina_admin"
branch_labels = None
depends_on = None


MARTIN_SKUCIUS_PASSWORD_HASH = "$2b$12$UjRRI6lOmQ68djJj5BASU.McouSj5G9gN1TUlTz1B3pjQ1d0zUciG"


def upgrade() -> None:
    op.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS custom_work_description TEXT")
    op.execute(
        """
        UPDATE work_types
        SET name = 'Práce s nakladačem, destou',
            description = 'Práce s nakladačem, destou',
            updated_by = 'Migrace 0.5.0',
            last_change = 'Upřesnění názvu činnosti'
        WHERE name = 'Práce s nakladačem'
        """
    )
    op.execute(
        """
        INSERT INTO work_types(id, name, description, created_by, updated_by, last_change)
        VALUES (28, 'Jiné', 'Jiná práce s povinným vlastním popisem', 'Migrace 0.5.0', 'Migrace 0.5.0', 'Doplnění činnosti')
        ON CONFLICT (name) DO UPDATE SET
          description = EXCLUDED.description,
          archived_at = NULL,
          archived_by = NULL,
          updated_by = EXCLUDED.updated_by,
          last_change = EXCLUDED.last_change
        """
    )
    op.execute("SELECT setval('work_types_id_seq', GREATEST((SELECT MAX(id) FROM work_types), 1), true)")
    op.execute(
        f"""
        UPDATE users
        SET full_name = 'Martin Skucius',
            password_hash = '{MARTIN_SKUCIUS_PASSWORD_HASH}',
            updated_by = 'Migrace 0.5.0',
            last_change = 'Oprava jména a přihlášení podle platného seznamu'
        WHERE username = 'martina.skucius'
          AND archived_at IS NULL
        """
    )
    op.execute(
        """
        UPDATE reports
        SET employee_name = 'Martin Skucius',
            updated_by = 'Migrace 0.5.0'
        WHERE user_id = (SELECT id FROM users WHERE username = 'martina.skucius')
          AND employee_name = 'Martina Skucius'
        """
    )


def downgrade() -> None:
    op.execute("UPDATE work_types SET archived_at = NOW(), archived_by = 'Downgrade' WHERE name = 'Jiné'")
    op.execute(
        """
        UPDATE work_types
        SET name = 'Práce s nakladačem', description = 'Práce s nakladačem'
        WHERE name = 'Práce s nakladačem, destou'
        """
    )
    op.execute("ALTER TABLE reports DROP COLUMN IF EXISTS custom_work_description")
