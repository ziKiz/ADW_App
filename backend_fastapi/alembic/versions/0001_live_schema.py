"""Initial live schema with audit triggers."""

from alembic import op

revision = "0001_live_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    for statement in [
        """
        CREATE TABLE departments (
          id BIGSERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          code TEXT NOT NULL UNIQUE,
          parent_id BIGINT REFERENCES departments(id),
          description TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_by TEXT,
          archived_at TIMESTAMPTZ,
          archived_by TEXT
        )
        """,
        """
        CREATE TABLE users (
          id BIGSERIAL PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL,
          full_name TEXT NOT NULL,
          department_name TEXT,
          scope_department TEXT,
          position TEXT,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_by TEXT,
          archived_at TIMESTAMPTZ,
          archived_by TEXT,
          last_change TEXT
        )
        """,
        """
        CREATE TABLE tractors (
          id BIGSERIAL PRIMARY KEY,
          tractor_code TEXT NOT NULL,
          tractor_name TEXT NOT NULL,
          service_centers TEXT[] NOT NULL DEFAULT '{}',
          vehicle_type TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_by TEXT,
          archived_at TIMESTAMPTZ,
          archived_by TEXT,
          last_change TEXT
        )
        """,
        """
        CREATE TABLE fields (
          id BIGSERIAL PRIMARY KEY,
          field_code TEXT NOT NULL,
          field_name TEXT NOT NULL,
          quadrant TEXT,
          area NUMERIC(10,2),
          culture TEXT,
          crop TEXT,
          erosion TEXT,
          description TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_by TEXT,
          archived_at TIMESTAMPTZ,
          archived_by TEXT,
          last_change TEXT
        )
        """,
        """
        CREATE TABLE work_types (
          id BIGSERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_by TEXT,
          archived_at TIMESTAMPTZ,
          archived_by TEXT,
          last_change TEXT
        )
        """,
        """
        CREATE TABLE reports (
          id BIGSERIAL PRIMARY KEY,
          report_number TEXT NOT NULL UNIQUE,
          report_kind TEXT NOT NULL DEFAULT 'work',
          tractor_id BIGINT REFERENCES tractors(id),
          user_id BIGINT REFERENCES users(id),
          employee_name TEXT,
          service_center TEXT,
          field_id BIGINT REFERENCES fields(id),
          field_entries JSONB NOT NULL DEFAULT '[]',
          work_type_id BIGINT REFERENCES work_types(id),
          date DATE NOT NULL,
          time_start TIME,
          time_end TIME,
          break_hours NUMERIC(5,2) NOT NULL DEFAULT 0,
          hours_worked NUMERIC(5,2) NOT NULL DEFAULT 0,
          amount_ha NUMERIC(10,2) NOT NULL DEFAULT 0,
          fuel_liters NUMERIC(10,2) NOT NULL DEFAULT 0,
          half_day_leave BOOLEAN NOT NULL DEFAULT FALSE,
          attachments JSONB NOT NULL DEFAULT '[]',
          notes TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          submitted_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_by TEXT,
          archived_at TIMESTAMPTZ,
          archived_by TEXT
        )
        """,
        """
        CREATE TABLE fuel_entries (
          id BIGSERIAL PRIMARY KEY,
          report_id BIGINT REFERENCES reports(id),
          date DATE NOT NULL,
          tractor_id BIGINT REFERENCES tractors(id),
          user_id BIGINT REFERENCES users(id),
          liters NUMERIC(10,2) NOT NULL DEFAULT 0,
          note TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          archived_at TIMESTAMPTZ,
          archived_by TEXT
        )
        """,
        """
        CREATE TABLE approvals (
          id BIGSERIAL PRIMARY KEY,
          report_id BIGINT NOT NULL REFERENCES reports(id),
          approver_id BIGINT REFERENCES users(id),
          status TEXT NOT NULL DEFAULT 'pending',
          comment TEXT,
          approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE contacts (
          id BIGSERIAL PRIMARY KEY,
          section TEXT NOT NULL,
          contact_group TEXT NOT NULL,
          full_name TEXT NOT NULL,
          position TEXT,
          mobile TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          archived_at TIMESTAMPTZ,
          archived_by TEXT
        )
        """,
        """
        CREATE TABLE service_schedule (
          id BIGSERIAL PRIMARY KEY,
          date DATE NOT NULL UNIQUE,
          workshop JSONB,
          bps_service JSONB,
          bps_feeding JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE notices (
          id BIGSERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          author TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by BIGINT REFERENCES users(id),
          archived_at TIMESTAMPTZ,
          archived_by TEXT
        )
        """,
        """
        CREATE TABLE machine_service_tasks (
          id BIGSERIAL PRIMARY KEY,
          machine TEXT NOT NULL,
          description TEXT NOT NULL,
          created_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          archived_at TIMESTAMPTZ,
          archived_by TEXT
        )
        """,
        """
        CREATE TABLE audit_log (
          id BIGSERIAL PRIMARY KEY,
          collection TEXT NOT NULL,
          record_id BIGINT,
          action TEXT NOT NULL,
          changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          changed_by TEXT,
          changed_by_id TEXT,
          request_id TEXT,
          before_data JSONB,
          after_data JSONB
        )
        """,
        "CREATE INDEX idx_reports_status ON reports(status)",
        "CREATE INDEX idx_reports_date ON reports(date)",
        "CREATE INDEX idx_reports_service_center ON reports(service_center)",
        "CREATE INDEX idx_audit_changed_at ON audit_log(changed_at DESC)",
        "CREATE INDEX idx_audit_collection ON audit_log(collection, record_id)",
    ]:
        op.execute(statement)

    op.execute(
        """
        CREATE OR REPLACE FUNCTION adw_touch_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION adw_audit_row()
        RETURNS TRIGGER AS $$
        DECLARE
          actor_name TEXT;
          actor_id TEXT;
          rid TEXT;
          row_id BIGINT;
        BEGIN
          IF TG_TABLE_NAME = 'audit_log' THEN
            IF TG_OP = 'DELETE' THEN
              RETURN OLD;
            END IF;
            RETURN NEW;
          END IF;

          actor_name := NULLIF(current_setting('adw.actor_name', true), '');
          actor_id := NULLIF(current_setting('adw.actor_id', true), '');
          rid := NULLIF(current_setting('adw.request_id', true), '');

          IF TG_OP = 'DELETE' THEN
            row_id := OLD.id;
            INSERT INTO audit_log(collection, record_id, action, changed_by, changed_by_id, request_id, before_data, after_data)
            VALUES (TG_TABLE_NAME, row_id, 'delete', COALESCE(actor_name, 'DB'), actor_id, rid, to_jsonb(OLD), NULL);
            RETURN OLD;
          ELSIF TG_OP = 'UPDATE' THEN
            row_id := NEW.id;
            INSERT INTO audit_log(collection, record_id, action, changed_by, changed_by_id, request_id, before_data, after_data)
            VALUES (TG_TABLE_NAME, row_id, 'update', COALESCE(actor_name, 'DB'), actor_id, rid, to_jsonb(OLD), to_jsonb(NEW));
            RETURN NEW;
          ELSE
            row_id := NEW.id;
            INSERT INTO audit_log(collection, record_id, action, changed_by, changed_by_id, request_id, before_data, after_data)
            VALUES (TG_TABLE_NAME, row_id, 'create', COALESCE(actor_name, 'DB'), actor_id, rid, NULL, to_jsonb(NEW));
            RETURN NEW;
          END IF;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    for table in [
        "departments",
        "users",
        "tractors",
        "fields",
        "work_types",
        "reports",
        "fuel_entries",
        "contacts",
        "service_schedule",
    ]:
        op.execute(
            f"""
            CREATE TRIGGER {table}_touch_updated_at
            BEFORE UPDATE ON {table}
            FOR EACH ROW EXECUTE FUNCTION adw_touch_updated_at();
            """
        )

    for table in [
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
    ]:
        op.execute(
            f"""
            CREATE TRIGGER {table}_audit_row
            AFTER INSERT OR UPDATE OR DELETE ON {table}
            FOR EACH ROW EXECUTE FUNCTION adw_audit_row();
            """
        )


def downgrade() -> None:
    for statement in [
        "DROP TABLE IF EXISTS audit_log CASCADE",
        "DROP TABLE IF EXISTS machine_service_tasks CASCADE",
        "DROP TABLE IF EXISTS notices CASCADE",
        "DROP TABLE IF EXISTS service_schedule CASCADE",
        "DROP TABLE IF EXISTS contacts CASCADE",
        "DROP TABLE IF EXISTS approvals CASCADE",
        "DROP TABLE IF EXISTS fuel_entries CASCADE",
        "DROP TABLE IF EXISTS reports CASCADE",
        "DROP TABLE IF EXISTS work_types CASCADE",
        "DROP TABLE IF EXISTS fields CASCADE",
        "DROP TABLE IF EXISTS tractors CASCADE",
        "DROP TABLE IF EXISTS users CASCADE",
        "DROP TABLE IF EXISTS departments CASCADE",
        "DROP FUNCTION IF EXISTS adw_audit_row()",
        "DROP FUNCTION IF EXISTS adw_touch_updated_at()",
    ]:
        op.execute(statement)
