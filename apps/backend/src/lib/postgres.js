const { Pool } = require("pg");
const { env } = require("../config/env");

let pool;

function getPostgresPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: env.database.url,
      max: 10,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }

  return pool;
}

function query(text, params) {
  return getPostgresPool().query(text, params);
}

async function closePostgresPool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

module.exports = {
  closePostgresPool,
  getPostgresPool,
  query
};
