"""Add phone extension to contacts."""

from alembic import op
import sqlalchemy as sa


revision = "0002_contact_extensions"
down_revision = "0001_live_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("contacts", sa.Column("phone_extension", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("contacts", "phone_extension")
