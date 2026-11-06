import { neon } from '@neondatabase/serverless';

async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS candidatos (
      id SERIAL PRIMARY KEY,
      nombre_completo TEXT NOT NULL,
      correo_institucional TEXT NOT NULL,
      direccion_aproximada TEXT NOT NULL,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export default async function handler(req, res) {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    return res.status(500).json({ message: 'Falta DATABASE_URL/POSTGRES_URL. Configura la base de datos en Vercel (Storage → Postgres/Neon).' });
  }
  const sql = neon(url);
  try {
    await ensureSchema(sql);
    if (req.method === 'GET') {
      const rows = await sql`SELECT id, nombre_completo, correo_institucional, direccion_aproximada, lat, lng, created_at FROM candidatos ORDER BY created_at DESC`;
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const nombre = (body.nombreCompleto || '').trim();
      const correo = (body.correoInstitucional || '').trim().toLowerCase();
      const direccion = (body.direccionAproximada || '').trim();
      const lat = body.lat === '' || body.lat == null ? null : Number(body.lat);
      const lng = body.lng === '' || body.lng == null ? null : Number(body.lng);
      if (!nombre || !correo || !direccion) {
        return res.status(400).json({ message: 'Nombre, correo institucional y dirección aproximada son obligatorios.' });
      }
      if (!/^[A-Za-z0-9._%+-]+@correo\.uss\.cl$/.test(correo)) {
        return res.status(400).json({ message: 'El correo debe ser @correo.uss.cl.' });
      }
      if ((lat == null) !== (lng == null) || (lat != null && (!Number.isFinite(lat) || !Number.isFinite(lng)))) {
        return res.status(400).json({ message: 'Ubicación inválida.' });
      }
      await sql`INSERT INTO candidatos (nombre_completo, correo_institucional, direccion_aproximada, lat, lng) VALUES (${nombre}, ${correo}, ${direccion}, ${lat}, ${lng})`;
      return res.status(201).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ message: 'Método no permitido.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error en el servidor.' });
  }
}
