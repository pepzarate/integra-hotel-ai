import { query } from './database';

// 1. Listar TODAS las tablas de la BD
export async function getAllTables() {
  return query(`
    SELECT 
      TABLE_NAME,
      TABLE_TYPE
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);
}

// 2. Ver columnas de una tabla específica
export async function getTableColumns(tableName: string) {
  return query(`
    SELECT 
      COLUMN_NAME,
      DATA_TYPE,
      CHARACTER_MAXIMUM_LENGTH,
      IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = @tableName
    ORDER BY ORDINAL_POSITION
  `, { tableName });
}

// 3. Ver muestra de datos de cualquier tabla (TOP 5)
export async function sampleTable(tableName: string) {
  // Nota: TABLE_NAME no puede ir como parámetro en FROM, 
  // por eso validamos contra la lista de tablas primero
  const allowed = await getAllTables() as Array<{ TABLE_NAME: string }>;
  const valid = allowed.find(t => t.TABLE_NAME === tableName);
  if (!valid) throw new Error(`Tabla no encontrada: ${tableName}`);
  return query(`SELECT TOP 5 * FROM [${tableName}]`);
}

// 4. Buscar tablas por palabra clave en el nombre
export async function searchTables(keyword: string) {
  return query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
      AND TABLE_NAME LIKE @pattern
    ORDER BY TABLE_NAME
  `, { pattern: `%${keyword}%` });
}

// 5. Buscar en qué tablas existe una columna con cierto nombre
export async function searchColumns(keyword: string) {
  return query(`
    SELECT 
      TABLE_NAME,
      COLUMN_NAME,
      DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE COLUMN_NAME LIKE @pattern
    ORDER BY TABLE_NAME, COLUMN_NAME
  `, { pattern: `%${keyword}%` });
}