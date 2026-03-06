import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config: sql.config = {
  server:   process.env.DB_HOST || '',
  port:     parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME || '',
  user:     process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt:              process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: true,
    connectTimeout:       30000,
    requestTimeout:       30000,
  },
  pool: {
    max: 10, min: 0, idleTimeoutMillis: 30000
  }
};

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) return pool;
  pool = await sql.connect(config);
  console.log('✓ Conectado a SOFTcalli SQL Server');
  return pool;
}

export async function query<T>(
  queryString: string, 
  params?: Record<string, unknown>
): Promise<sql.IRecordSet<T>> {
  const db = await getPool();
  const request = db.request();
  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      request.input(key, val);
    });
  }
  const result = await request.query(queryString);
  return result.recordset;
}

export async function testConnection(): Promise<boolean> {
  try {
    await query('SELECT 1 AS test');
    return true;
  } catch (err) {
    console.error('✗ Error de conexión:', err);
    return false;
  }
}