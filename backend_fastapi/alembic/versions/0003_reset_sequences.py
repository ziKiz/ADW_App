"""Reset serial sequences after seeded IDs."""

from alembic import op

revision = "0003_reset_sequences"
down_revision = "0002_contact_extensions"
branch_labels = None
depends_on = None


TABLES = [
    "departments",
    "users",
    "tractors",
    "fields",
    "work_types",
    "reports",
    "fuel_entries",
    "approvals",
    "contacts",
    "service_schedule",
    "notices",
    "machine_service_tasks",
    "audit_log",
]


def upgrade() -> None:
    for table in TABLES:
        op.execute(
            f"""
            SELECT setval(
              pg_get_serial_sequence('{table}', 'id'),
              GREATEST(COALESCE((SELECT MAX(id) FROM {table}), 0), 1),
              COALESCE((SELECT MAX(id) FROM {table}), 0) > 0
            )
            """
        )


def downgrade() -> None:
    pass
