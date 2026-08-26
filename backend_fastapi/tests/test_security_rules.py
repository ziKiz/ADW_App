import os
import unittest

os.environ["APP_MODE"] = "local"

from fastapi import HTTPException

from app.config import Settings
from app.routers.reports import parse_time_value, report_identity_for_create, report_identity_for_update, validate_report_time_order
from app.security import can_access_report, is_elevated_user


class ReportAccessTests(unittest.TestCase):
    def test_owner_can_access_own_report(self):
        user = {"id": 5, "role": "traktorista"}
        report = {"user_id": 5, "service_center": "Rostlinná výroba"}

        self.assertTrue(can_access_report(report, user))

    def test_employee_cannot_access_other_report(self):
        user = {"id": 5, "role": "traktorista", "scope_department": "Rostlinná výroba"}
        report = {"user_id": 8, "service_center": "Mechanizace"}

        self.assertFalse(can_access_report(report, user, allow_scoped_review=True))

    def test_admin_can_access_any_report(self):
        user = {"id": 21, "role": "admin"}
        report = {"user_id": 8, "service_center": "Mechanizace"}

        self.assertTrue(is_elevated_user(user))
        self.assertTrue(can_access_report(report, user))

    def test_approver_can_access_same_scope_when_allowed(self):
        user = {"id": 3, "role": "schvalovatel", "scope_department": "Rostlinná výroba"}
        report = {"user_id": 8, "service_center": "Rostlinná výroba"}

        self.assertTrue(can_access_report(report, user, allow_scoped_review=True))
        self.assertFalse(can_access_report(report, user, allow_scoped_review=False))


class ReportIdentityTests(unittest.TestCase):
    def test_employee_create_ignores_payload_identity(self):
        user = {"id": 5, "role": "traktorista", "full_name": "Jan Novák"}
        payload = {"user_id": 21, "employee_name": "Ing. Martina Novotná"}

        self.assertEqual(report_identity_for_create(payload, user), (5, "Jan Novák"))

    def test_scoped_reviewer_update_preserves_original_owner(self):
        user = {"id": 3, "role": "schvalovatel", "full_name": "Ing. Filip Daňhel"}
        payload = {"user_id": 3, "employee_name": "Ing. Filip Daňhel"}
        current_report = {"user_id": 5, "employee_name": "Jan Novák"}

        self.assertEqual(report_identity_for_update(payload, user, current_report), (5, "Jan Novák"))


class ReportTimeValidationTests(unittest.TestCase):
    def test_work_report_rejects_end_before_start(self):
        with self.assertRaises(HTTPException):
            validate_report_time_order(True, parse_time_value("16:30:00"), parse_time_value("15:30:00"))

    def test_work_report_accepts_end_after_start(self):
        validate_report_time_order(True, parse_time_value("16:30:00"), parse_time_value("17:30:00"))


class SettingsTests(unittest.TestCase):
    def test_live_mode_rejects_default_jwt_secret(self):
        with self.assertRaises(ValueError):
            Settings(app_mode="live", jwt_secret="change-this-local-secret")

    def test_local_mode_allows_default_jwt_secret(self):
        settings = Settings(app_mode="local", jwt_secret="change-this-local-secret")

        self.assertEqual(settings.app_mode, "local")


if __name__ == "__main__":
    os.environ.setdefault("APP_MODE", "local")
    unittest.main()
