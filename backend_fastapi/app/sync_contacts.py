from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.db import SessionLocal
from app.seed import load_json


async def sync_contacts() -> None:
    contacts = load_json("contacts.json", [])
    async with SessionLocal() as session:
        await session.execute(text("SELECT set_config('adw.actor_name', 'Import telefonního seznamu', true)"))
        await session.execute(text("DELETE FROM contacts"))
        for contact in contacts:
            await session.execute(
                text(
                    """
                    INSERT INTO contacts(id, section, contact_group, full_name, position, mobile, phone_extension)
                    VALUES (:id, :section, :contact_group, :full_name, :position, :mobile, :phone_extension)
                    """
                ),
                {
                    "id": contact.get("id"),
                    "section": contact.get("section"),
                    "contact_group": contact.get("group"),
                    "full_name": contact.get("name"),
                    "position": contact.get("title"),
                    "mobile": contact.get("phone"),
                    "phone_extension": contact.get("phone_extension") or None,
                },
            )
        await session.execute(text("SELECT setval('contacts_id_seq', COALESCE((SELECT MAX(id) FROM contacts), 1), true)"))
        await session.commit()


if __name__ == "__main__":
    asyncio.run(sync_contacts())
