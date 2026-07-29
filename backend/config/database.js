const { Pool } = require('pg');
require('dotenv').config();

// Convert SQLite-style ? placeholders to PostgreSQL $1, $2, ... style
function convertPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

// Fix SQLite-specific syntax for PostgreSQL
function fixSql(sql) {
  let s = convertPlaceholders(sql);

  // AUTOINCREMENT → SERIAL
  s = s.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');

  // DATETIME → TIMESTAMPTZ
  s = s.replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/gi, 'TIMESTAMPTZ DEFAULT NOW()');
  s = s.replace(/\bDATETIME\b/gi, 'TIMESTAMPTZ');

  // CURRENT_TIMESTAMP → NOW()
  s = s.replace(/\bCURRENT_TIMESTAMP\b/g, 'NOW()');

  // BOOLEAN integer literals → proper booleans
  s = s.replace(/\bis_published\s*=\s*1\b/gi, 'is_published = TRUE');
  s = s.replace(/\bis_published\s*=\s*0\b/gi, 'is_published = FALSE');
  s = s.replace(/\bis_public\s*=\s*1\b/gi,    'is_public = TRUE');
  s = s.replace(/\bis_public\s*=\s*0\b/gi,    'is_public = FALSE');
  s = s.replace(/\bpassed\s*=\s*1\b/gi,       'passed = TRUE');
  s = s.replace(/\bpassed\s*=\s*0\b/gi,        'passed = FALSE');

  // BOOLEAN DEFAULT 0/1
  s = s.replace(/BOOLEAN DEFAULT 0\b/gi, 'BOOLEAN DEFAULT FALSE');
  s = s.replace(/BOOLEAN DEFAULT 1\b/gi, 'BOOLEAN DEFAULT TRUE');

  return s;
}

// Fix param values: convert 0/1 booleans for BOOLEAN columns
function fixParams(params) {
  return params;  // pg driver handles JS true/false natively
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false }
    : false
});

class Database {
  constructor() {
    this.pool = pool;
  }

  async connect() {
    try {
      const client = await this.pool.connect();
      console.log('✓ Connected to PostgreSQL database');
      client.release();
    } catch (err) {
      console.error('Database connection error:', err);
      throw err;
    }
  }

  // run() — INSERT/UPDATE/DELETE — returns { id, changes }
  async run(sql, params = []) {
    const converted = fixSql(sql);

    // If INSERT with RETURNING id — extract the id
    let query = converted;
    const isInsert = /^\s*INSERT/i.test(sql);
    if (isInsert && !/RETURNING/i.test(query)) {
      query = query.replace(/;?\s*$/, ' RETURNING id');
    }

    try {
      const result = await this.pool.query(query, params);
      if (isInsert && result.rows && result.rows[0]) {
        return { id: result.rows[0].id, changes: result.rowCount };
      }
      return { id: null, changes: result.rowCount };
    } catch (err) {
      console.error('❌ DB run error:', err.message);
      console.error('   SQL:', query);
      console.error('   Params:', params);
      throw err;
    }
  }

  // get() — SELECT single row
  async get(sql, params = []) {
    const query = fixSql(sql);
    try {
      const result = await this.pool.query(query, params);
      return result.rows[0] || null;
    } catch (err) {
      console.error('❌ DB get error:', err.message);
      console.error('   SQL:', query);
      throw err;
    }
  }

  // all() — SELECT multiple rows
  async all(sql, params = []) {
    const query = fixSql(sql);
    try {
      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (err) {
      console.error('❌ DB all error:', err.message);
      console.error('   SQL:', query);
      throw err;
    }
  }

  // exec() — raw multi-statement SQL (for init scripts)
  async exec(sql) {
    try {
      await this.pool.query(sql);
    } catch (err) {
      console.error('❌ DB exec error:', err.message);
      throw err;
    }
  }

  async close() {
    await this.pool.end();
  }
}

const database = new Database();
module.exports = database;
