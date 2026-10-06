"""Separate Jana Bulickova export access from Jana Bobulova.

Revision ID: 0010_split_jana
Revises: 0009_center_approval
"""

from alembic import op


revision = "0010_split_jana"
down_revision = "0009_center_approval"
branch_labels = None
depends_on = None


JANA_BULICKOVA_PASSWORD_HASH = "$2b$12$h.QFS5mIWGXzNtEdMqmzK.EGvHMrUd0EwnTcwQOvkhnBaWXhXoOuW"


def upgrade() -> None:
    op.execute(
        f"""
        INSERT INTO users(
          username, email, password_hash, role, full_name, active, position, department_name, scope_department,
          manager_username, manager_name, approval_level, created_by, updated_by, last_change
        )
        VALUES (
          'jana.bulickova', 'jana.bulickova@lesonice.local', '{JANA_BULICKOVA_PASSWORD_HASH}',
          'approved_viewer', 'Jana Bulíčková', TRUE, 'Mzdová a personální kontrola / Helios',
          NULL, NULL, NULL, NULL, 'Schválené výkazy', 'Migrace', 'Migrace',
          'Vytvoření samostatného účtu pro exporty'
        )
        ON CONFLICT (username) DO UPDATE SET
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          full_name = EXCLUDED.full_name,
          active = TRUE,
          position = EXCLUDED.position,
          department_name = NULL,
          scope_department = NULL,
          manager_username = NULL,
          manager_name = NULL,
          approval_level = EXCLUDED.approval_level,
          archived_at = NULL,
          archived_by = NULL,
          updated_by = 'Migrace',
          last_change = 'Aktualizace samostatného účtu pro exporty'
        """
    )
    op.execute(
        """
        UPDATE users
        SET role = 'traktorista',
            position = 'Zootechnička',
            department_name = 'Živočišná výroba',
            scope_department = 'Živočišná výroba',
            manager_username = 'vit.spacek',
            manager_name = 'Vít Špaček',
            approval_level = 'Podřízený',
            active = TRUE,
            updated_by = 'Migrace',
            last_change = 'Převedení na běžný zaměstnanecký účet'
        WHERE username = 'jana.bobulova'
        """
    )
    op.execute(
        """
        UPDATE reports
        SET primary_approver_id = manager.id
        FROM users employee
        JOIN users manager ON manager.username = employee.manager_username
        WHERE reports.user_id = employee.id
          AND reports.status = 'pending'
          AND reports.primary_approver_id = (SELECT id FROM users WHERE username = 'jana.bobulova')
        """
    )
    op.execute(
        """
        UPDATE reports
        SET task_approver_id = manager.id
        FROM users manager
        WHERE reports.status = 'pending'
          AND reports.task_approver_id = (SELECT id FROM users WHERE username = 'jana.bobulova')
          AND manager.username = 'vit.spacek'
        """
    )
    op.execute("SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1), true)")


def downgrade() -> None:
    op.execute(
        """
        UPDATE users
        SET role = 'approved_viewer',
            scope_department = NULL,
            manager_username = NULL,
            manager_name = NULL,
            approval_level = 'Schválené výkazy',
            updated_by = 'Migrace rollback',
            last_change = 'Vrácení předchozí exportní role'
        WHERE username = 'jana.bobulova'
        """
    )
    op.execute(
        """
        UPDATE users
        SET archived_at = NOW(), archived_by = 'Migrace rollback', active = FALSE,
            updated_by = 'Migrace rollback', last_change = 'Archivace odděleného exportního účtu'
        WHERE username = 'jana.bulickova'
        """
    )
