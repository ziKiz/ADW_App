import pool from '../config/database';
import { documentTractors, extractDocumentFields } from '../data/documentData';

async function importData() {
  const fields = extractDocumentFields();

  await pool.query('BEGIN');
  try {
    await pool.query("ALTER TABLE tractors ADD COLUMN IF NOT EXISTS service_centers TEXT[] DEFAULT '{}'");
    await pool.query("UPDATE tractors SET status = 'inactive' WHERE vehicle_type = 'traktor'");

    for (const tractor of documentTractors) {
      await pool.query(
        `INSERT INTO tractors (tractor_code, tractor_name, service_centers, vehicle_type, status)
         VALUES ($1, $2, $3, 'traktor', 'active')
         ON CONFLICT (tractor_code)
         DO UPDATE SET tractor_name = EXCLUDED.tractor_name, service_centers = EXCLUDED.service_centers, vehicle_type = EXCLUDED.vehicle_type, status = 'active'`,
        [tractor.code, tractor.name, tractor.service_centers]
      );
    }

    for (const field of fields) {
      await pool.query(
        `INSERT INTO fields (field_code, field_name, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (field_code)
         DO UPDATE SET field_name = EXCLUDED.field_name, description = EXCLUDED.description`,
        [field.code, field.name, `Import z ${field.source}`]
      );
    }

    await pool.query('COMMIT');
    console.log(`Import hotov: ${documentTractors.length} traktorů, ${fields.length} polí.`);
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  } finally {
    await pool.end();
  }
}

importData().catch((error) => {
  console.error(error);
  process.exit(1);
});
