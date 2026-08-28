"""support user and blood donation work type"""

from alembic import op


revision = "0006_support_blood"
down_revision = "0005_prod_users_work_types"
branch_labels = None
depends_on = None


TOMAS_PASSWORD_HASH = "$2b$12$uKTQGvB6Y/0GGMMJOa7Qb.wn2cki8.T5VZdS7CHJHq2rv6YMmsDZ6"


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO work_types(id, name, description, created_by, updated_by, archived_at, archived_by, last_change)
        VALUES (104, 'Darování krve', 'Celodenní absence z důvodu darování krve', 'Migrace', 'Migrace', NULL, NULL, 'Doplnění interní absence')
        ON CONFLICT (name) DO UPDATE SET
          id = EXCLUDED.id,
          description = EXCLUDED.description,
          archived_at = NULL,
          archived_by = NULL,
          updated_by = 'Migrace',
          last_change = 'Aktualizace interní absence'
        """
    )
    op.execute(
        f"""
        INSERT INTO users(
          username, email, password_hash, role, full_name, active, position, department_name, scope_department,
          manager_username, manager_name, approval_level, created_by, updated_by, last_change
        )
        VALUES (
          'tomas.zika', 'tomas.zika@lesonice.local', '{TOMAS_PASSWORD_HASH}', 'admin', 'Tomáš Zika',
          TRUE, 'Kontrola provozu', 'Kontrola', 'Kontrola', NULL, NULL, 'Administrátor', 'Migrace', 'Migrace',
          'Vytvoření kontrolního účtu'
        )
        ON CONFLICT (username) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          full_name = EXCLUDED.full_name,
          active = TRUE,
          position = EXCLUDED.position,
          department_name = EXCLUDED.department_name,
          scope_department = EXCLUDED.scope_department,
          approval_level = EXCLUDED.approval_level,
          updated_by = 'Migrace',
          last_change = 'Aktualizace kontrolního účtu'
        """
    )
    op.execute(
        """
        UPDATE users
        SET role = 'approved_viewer',
            scope_department = NULL,
            approval_level = 'Schválené výkazy',
            updated_by = 'Migrace',
            last_change = 'Omezení pouze na schválené výkazy'
        WHERE full_name IN ('Jana Bulíčková', 'Jana Bobulová')
           OR username IN ('jana.bulickova', 'jana.bobulova')
        """
    )
    op.execute("SELECT setval('work_types_id_seq', COALESCE((SELECT MAX(id) FROM work_types), 1), true)")
    op.execute("SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1), true)")


def downgrade() -> None:
    op.execute("UPDATE work_types SET archived_at = NOW(), archived_by = 'Migrace rollback' WHERE name = 'Darování krve'")
    op.execute("UPDATE users SET archived_at = NOW(), archived_by = 'Migrace rollback' WHERE username = 'tomas.zika'")
    op.execute(
        """
        UPDATE users
        SET role = 'schvalovatel', updated_by = 'Migrace rollback', last_change = 'Vrácení role schvalovatele'
        WHERE role = 'approved_viewer'
          AND (full_name IN ('Jana Bulíčková', 'Jana Bobulová') OR username IN ('jana.bulickova', 'jana.bobulova'))
        """
    )
