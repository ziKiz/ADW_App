"""Add field groups, shared center approvals and October production data.

Revision ID: 0011_october_ops
Revises: 0010_split_jana
"""

from __future__ import annotations

import json
from pathlib import Path

import sqlalchemy as sa
from alembic import op


revision = "0011_october_ops"
down_revision = "0010_split_jana"
branch_labels = None
depends_on = None


ZBYNEK_PASSWORD_HASH = "$2b$12$WnTGjhYrrKDWsEeZaZtGleoyFxemxyEP49TCuZBx03HU73NNY9l2m"


def _field_rows() -> list[dict]:
    path = Path(__file__).resolve().parents[2] / "app" / "data" / "production_fields_20261008.json"
    return json.loads(path.read_text(encoding="utf-8"))


def upgrade() -> None:
    op.execute("ALTER TABLE fields ADD COLUMN IF NOT EXISTS field_group TEXT")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS default_field_group TEXT")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_centers TEXT[] NOT NULL DEFAULT '{}'")
    op.execute("CREATE INDEX IF NOT EXISTS idx_fields_group ON fields(field_group) WHERE archived_at IS NULL")

    op.execute(
        """
        UPDATE users
        SET approval_centers = ARRAY[COALESCE(scope_department, department_name)],
            updated_by = 'Migrace',
            last_change = 'Nastavení oprávnění pro středisko'
        WHERE role IN ('schvalovatel', 'specialista')
          AND COALESCE(scope_department, department_name) IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE users
        SET approval_centers = ARRAY['Rostlinná výroba'],
            default_field_group = 'RSL',
            updated_by = 'Migrace',
            last_change = 'Sdílené schvalování RV a výchozí pozemky RSL'
        WHERE username IN ('zbynek.pokorny', 'filip.danhel')
        """
    )
    op.execute(
        """
        UPDATE users
        SET approval_centers = ARRAY['Mechanizace'],
            updated_by = 'Migrace',
            last_change = 'Sdílené schvalování Mechanizace'
        WHERE username IN ('martina.novotna', 'karel.trnka')
        """
    )
    op.execute(
        """
        UPDATE users
        SET default_field_group = 'RSL',
            updated_by = 'Migrace',
            last_change = 'Výchozí pozemky RSL'
        WHERE LOWER(TRIM(COALESCE(department_name, scope_department))) = LOWER('Rostlinná výroba')
        """
    )

    op.execute(
        """
        UPDATE users
        SET username = 'rostislav.kabelka',
            email = 'rostislav.kabelka@lesonice.local',
            updated_by = 'Migrace',
            last_change = 'Oprava přihlašovacího jména podle seznamu 8. 10. 2026'
        WHERE username = 'rostlislav.kabelka'
        """
    )
    op.execute(
        """
        UPDATE users
        SET username = 'martina.skucius',
            email = 'martina.skucius@lesonice.local',
            updated_by = 'Migrace',
            last_change = 'Oprava přihlašovacího jména podle seznamu 8. 10. 2026'
        WHERE username = 'martin.skucisu'
        """
    )
    op.execute(
        f"""
        UPDATE users
        SET password_hash = '{ZBYNEK_PASSWORD_HASH}',
            updated_by = 'Migrace',
            last_change = 'Oprava hesla podle seznamu 8. 10. 2026'
        WHERE username = 'zbynek.pokorny'
        """
    )
    op.execute(
        """
        UPDATE users
        SET position = 'Kontrolorka',
            updated_by = 'Migrace',
            last_change = 'Úprava názvu funkce'
        WHERE username = 'jana.bulickova'
        """
    )

    op.execute(
        """
        INSERT INTO work_types(id, name, description, created_by, updated_by, last_change)
        VALUES (27, 'Kypření', 'Kypření', 'Migrace', 'Migrace', 'Doplnění činnosti')
        ON CONFLICT (name) DO UPDATE SET
          description = EXCLUDED.description,
          archived_at = NULL,
          archived_by = NULL,
          updated_by = 'Migrace',
          last_change = 'Aktualizace činnosti'
        """
    )
    op.execute(
        """
        INSERT INTO work_types(id, name, description, created_by, updated_by, last_change)
        VALUES (105, 'Nemoc', 'Celodenní absence z důvodu nemoci', 'Migrace', 'Migrace', 'Doplnění celodenní absence')
        ON CONFLICT (name) DO UPDATE SET
          description = EXCLUDED.description,
          archived_at = NULL,
          archived_by = NULL,
          updated_by = 'Migrace',
          last_change = 'Aktualizace celodenní absence'
        """
    )
    op.execute("SELECT setval('work_types_id_seq', GREATEST((SELECT MAX(id) FROM work_types), 1), true)")

    op.execute("DELETE FROM fuel_entries")
    op.execute("UPDATE reports SET fuel_liters = 0 WHERE fuel_liters <> 0")

    op.execute(
        """
        UPDATE fields
        SET archived_at = NOW(),
            archived_by = 'Migrace 8. 10. 2026',
            updated_by = 'Migrace',
            last_change = 'Nahrazeno databází RSL/MOHE'
        WHERE archived_at IS NULL
        """
    )
    rows = [
        {
            **row,
            "quadrant": None,
            "culture": None,
            "crop": None,
            "erosion": None,
        }
        for row in _field_rows()
    ]
    op.get_bind().execute(
        sa.text(
            """
            INSERT INTO fields(
              id, field_code, field_name, field_group, area, quadrant, culture, crop, erosion,
              created_by, updated_by, last_change
            )
            VALUES (
              :id, :field_code, :field_name, :field_group, :area, :quadrant, :culture, :crop, :erosion,
              'Import 8. 10. 2026', 'Import 8. 10. 2026', :last_change
            )
            ON CONFLICT (id) DO UPDATE SET
              field_code = EXCLUDED.field_code,
              field_name = EXCLUDED.field_name,
              field_group = EXCLUDED.field_group,
              area = EXCLUDED.area,
              archived_at = NULL,
              archived_by = NULL,
              updated_by = EXCLUDED.updated_by,
              last_change = EXCLUDED.last_change
            """
        ),
        [{**row, "last_change": f"Import {row['field_group']} z {row['source_file']}"} for row in rows],
    )
    op.execute("SELECT setval('fields_id_seq', GREATEST((SELECT MAX(id) FROM fields), 1), true)")


def downgrade() -> None:
    op.execute("UPDATE fields SET archived_at = NOW(), archived_by = 'Downgrade' WHERE id >= 10001 AND id <= 10683")
    op.execute("UPDATE fields SET archived_at = NULL, archived_by = NULL WHERE last_change = 'Nahrazeno databází RSL/MOHE'")
    op.execute("UPDATE users SET approval_centers = '{}' WHERE username IN ('zbynek.pokorny', 'filip.danhel', 'martina.novotna', 'karel.trnka')")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS approval_centers")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS default_field_group")
    op.execute("DROP INDEX IF EXISTS idx_fields_group")
    op.execute("ALTER TABLE fields DROP COLUMN IF EXISTS field_group")
