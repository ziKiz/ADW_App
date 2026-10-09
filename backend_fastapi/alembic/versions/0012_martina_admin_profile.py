"""Restore Martina's admin profile while preserving Mechanizace approvals.

Revision ID: 0012_martina_admin
Revises: 0011_october_ops
"""

from alembic import op


revision = "0012_martina_admin"
down_revision = "0011_october_ops"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE users
        SET role = 'admin',
            approval_centers = ARRAY['Mechanizace'],
            updated_by = 'Migrace 0.4.1',
            last_change = 'Obnovení administrátorského profilu se schvalováním Mechanizace'
        WHERE username = 'martina.novotna'
          AND archived_at IS NULL
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE users
        SET role = 'schvalovatel',
            approval_centers = ARRAY['Mechanizace'],
            updated_by = 'Migrace rollback',
            last_change = 'Vrácení role vedoucí Mechanizace'
        WHERE username = 'martina.novotna'
          AND archived_at IS NULL
        """
    )
