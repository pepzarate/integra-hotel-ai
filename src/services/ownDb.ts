import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
});

export async function queryOwn(text: string, params?: any[]): Promise<any> {
    const client = await pool.connect();
    try {
        const result = await client.query(text, params);
        return result.rows;
    } finally {
        client.release();
    }
}

export async function initDb(): Promise<void> {
    await queryOwn(`
    CREATE TABLE IF NOT EXISTS prereservaciones (
      id SERIAL PRIMARY KEY,
      folio VARCHAR(50) UNIQUE NOT NULL,
      nombre VARCHAR(200) NOT NULL,
      email VARCHAR(200) NOT NULL,
      telefono VARCHAR(50) NOT NULL,
      tipo_habitacion VARCHAR(20) NOT NULL,
      fecha_entrada DATE NOT NULL,
      fecha_salida DATE NOT NULL,
      personas INTEGER NOT NULL,
      notas TEXT,
      status VARCHAR(20) DEFAULT 'pendiente',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
    console.log('  ✓ Tabla prereservaciones lista');
}

export async function insertPrereservacion(data: {
    folio: string;
    nombre: string;
    email: string;
    telefono: string;
    tipo_habitacion: string;
    fecha_entrada: string;
    fecha_salida: string;
    personas: number;
    notas?: string;
}): Promise<any> {
    const rows = await queryOwn(
        `INSERT INTO prereservaciones 
      (folio, nombre, email, telefono, tipo_habitacion, fecha_entrada, fecha_salida, personas, notas)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
        [
            data.folio,
            data.nombre,
            data.email,
            data.telefono,
            data.tipo_habitacion,
            data.fecha_entrada.split('T')[0],
            data.fecha_salida.split('T')[0],
            data.personas,
            data.notas || null,
        ]
    );
    return rows[0];
}

export async function getPrereservaciones(): Promise<any[]> {
    const rows = await queryOwn(
        `SELECT 
      id,
      folio,
      nombre,
      email,
      telefono,
      tipo_habitacion,
      personas,
      TO_CHAR(fecha_entrada, 'YYYY-MM-DD') AS fecha_entrada,
      TO_CHAR(fecha_salida,  'YYYY-MM-DD') AS fecha_salida,
      notas,
      status,
      TO_CHAR(created_at AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD HH24:MI:SS') AS fecha_prereservacion
    FROM prereservaciones 
    ORDER BY created_at DESC 
    LIMIT 50`
    );
    return rows;
}