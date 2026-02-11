"use strict";

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { roleKeys } = require("../models/tenantFoundationModels");

const DEFAULT_DB1_URL = "postgresql://safepark:safepark@localhost:5433/safepark_ops";
const DB1_URL = String(process.env.DB1_URL || DEFAULT_DB1_URL);

const pool = new Pool({
  connectionString: DB1_URL,
});

const roleDescriptions = {
  platform_admin: "Platform-level administrator",
  super_admin: "Tenant-level super administrator",
  branch_manager: "Branch-level manager",
  operator: "Operational user",
};

function migrationFilePath(fileName) {
  return path.join(__dirname, "migrations", fileName);
}

async function query(text, params) {
  return pool.query(text, params);
}

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function ensureRolesSeeded(queryable) {
  for (const roleKey of roleKeys) {
    await queryable.query(
      "INSERT INTO roles (key, description) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
      [roleKey, roleDescriptions[roleKey] || roleKey]
    );
  }
}

async function ensurePlatformStateRow(queryable) {
  await queryable.query(
    `INSERT INTO platform_state (
      id,
      is_installed,
      installed_at,
      installed_tenant_id,
      installed_branch_id,
      installed_user_id,
      updated_at
    )
    VALUES (1, FALSE, NULL, NULL, NULL, NULL, NOW())
    ON CONFLICT (id) DO NOTHING`
  );
}

async function runMigrations() {
  const migrationFiles = ["0001_tenant_foundation.sql", "0002_platform_state.sql"];
  for (const migrationFile of migrationFiles) {
    const sql = fs.readFileSync(migrationFilePath(migrationFile), "utf8");
    await pool.query(sql);
  }

  await ensureRolesSeeded(pool);
  await ensurePlatformStateRow(pool);
}

async function closePool() {
  await pool.end();
}

module.exports = {
  DB1_URL,
  pool,
  query,
  withTransaction,
  runMigrations,
  closePool,
};
