"""Route pending work reports by service center.

Revision ID: 0009_center_based_approval_routing
Revises: 0008_cross_manager_approvals
"""

from alembic import op


revision = "0009_center_approval"
down_revision = "0008_cross_manager_approvals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        WITH ranked_center_leaders AS (
          SELECT
            id,
            LOWER(TRIM(COALESCE(scope_department, department_name))) AS center_key,
            ROW_NUMBER() OVER (
              PARTITION BY LOWER(TRIM(COALESCE(scope_department, department_name)))
              ORDER BY
                CASE approval_level
                  WHEN 'Hlavní vedoucí' THEN 0
                  WHEN 'Vedoucí střediska' THEN 1
                  ELSE 2
                END,
                CASE role WHEN 'schvalovatel' THEN 0 WHEN 'specialista' THEN 1 WHEN 'reditel' THEN 2 ELSE 3 END,
                id
            ) AS leader_rank
          FROM users
          WHERE active = TRUE
            AND archived_at IS NULL
            AND role IN ('admin', 'reditel', 'schvalovatel', 'specialista')
            AND COALESCE(scope_department, department_name) IS NOT NULL
        )
        UPDATE reports r
        SET
          task_approver_id = leader.id,
          task_approval_status = CASE
            WHEN leader.id = r.primary_approver_id THEN 'not_required'
            WHEN r.task_approver_id = leader.id AND r.task_approval_status = 'approved' THEN 'approved'
            ELSE 'pending'
          END,
          task_approved_at = CASE
            WHEN leader.id <> r.primary_approver_id
              AND r.task_approver_id = leader.id
              AND r.task_approval_status = 'approved'
            THEN r.task_approved_at
            ELSE NULL
          END,
          task_approved_by = CASE
            WHEN leader.id <> r.primary_approver_id
              AND r.task_approver_id = leader.id
              AND r.task_approval_status = 'approved'
            THEN r.task_approved_by
            ELSE NULL
          END
        FROM ranked_center_leaders leader
        WHERE leader.leader_rank = 1
          AND r.archived_at IS NULL
          AND r.status = 'pending'
          AND COALESCE(r.report_kind, 'work') = 'work'
          AND LOWER(TRIM(r.service_center)) = leader.center_key
        """
    )


def downgrade() -> None:
    # Previous manual routing cannot be reconstructed after it has been replaced.
    pass
