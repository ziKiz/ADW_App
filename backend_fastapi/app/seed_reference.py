from __future__ import annotations

import asyncio
from sqlalchemy import text

from app.db import SessionLocal
from app.seed import load_json


async def sync_attachments_for_session(session) -> int:
    attachments = load_json("attachments.json", [])
    await session.execute(text("SELECT set_config('adw.actor_name', 'Sync přípojných zařízení', true)"))
    for item in attachments:
        await session.execute(
            text(
                """
                INSERT INTO attachments(
                  id, attachment_code, attachment_name, license_plate, status,
                  created_by, updated_by, archived_at, archived_by, last_change
                )
                VALUES (
                  :id, :attachment_code, :attachment_name, :license_plate, :status,
                  'Sync přípojných zařízení', 'Sync přípojných zařízení', NULL, NULL, 'Import ostrého seznamu'
                )
                ON CONFLICT (id) DO NOTHING
                """
            ),
            {
                "id": item.get("id"),
                "attachment_code": item.get("attachment_code") or None,
                "attachment_name": item.get("attachment_name"),
                "license_plate": item.get("license_plate") or None,
                "status": item.get("status") or "active",
            },
        )
    await session.execute(text("SELECT setval('attachments_id_seq', COALESCE((SELECT MAX(id) FROM attachments), 1), true)"))
    return len(attachments)


async def sync_attachments() -> int:
    async with SessionLocal() as session:
        count = await sync_attachments_for_session(session)
        await session.commit()
    return count


def main() -> None:
    count = asyncio.run(sync_attachments())
    print(f"Attachment sync complete: {count} devices.")


if __name__ == "__main__":
    main()
