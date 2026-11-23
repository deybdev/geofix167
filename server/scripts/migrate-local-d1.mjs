import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const wranglerPackage = require.resolve("wrangler/package.json");
const wrangler = join(dirname(wranglerPackage), require(wranglerPackage).bin.wrangler);
const server = fileURLToPath(new URL("../", import.meta.url));
const binding = "geofix167_db";
const oldMigration = "0030_consolidate_mobile_auth_flows.sql";
const canonicalMigration = "0035_consolidate_mobile_auth_flows.sql";
const legacyTables = [
  "mobile_oauth_tickets",
  "mobile_registration_tickets",
  "mobile_registration_identities",
];
const archivedTables = legacyTables.map(name => `${name}_old`);
const authTable = "auth_flows";
const expiryIndex = "idx_auth_flows_expiry";
const historyTable = "d1_migrations";

const sqlString = value => `'${value.replaceAll("'", "''")}'`;
const inspectedNames = [
  historyTable, authTable, expiryIndex, "auth_flows_next", ...legacyTables, ...archivedTables,
];
const schemaQuery = `
  SELECT json_group_array(json_array(name, type, sql)) AS snapshot
  FROM (
    SELECT name, type, sql FROM sqlite_schema
    WHERE name IN (${inspectedNames.map(sqlString).join(", ")})
       OR (tbl_name = 'd1_migrations' AND type = 'trigger')
    ORDER BY name
  )
`;
const migrationNames = [oldMigration, canonicalMigration].map(sqlString).join(", ");

function runWrangler(args, capture = false) {
  const result = spawnSync(process.execPath, [wrangler, "d1", ...args, "--local"], {
    cwd: server,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim();
    throw new Error(`Wrangler d1 ${args[0]} failed (${result.signal ?? result.status}).${detail ? `\n${detail}` : ""}`);
  }
  return result.stdout;
}

function execute(sql) {
  const output = runWrangler(["execute", binding, "--json", "--command", sql], true);
  const [result] = JSON.parse(output);
  if (!result?.success || !Array.isArray(result.results)) {
    throw new Error("Wrangler did not return a successful local SQL result.");
  }
  return result.results;
}

function normalizeSql(sql) {
  return sql?.replace(/^(CREATE (?:TABLE|INDEX) )IF NOT EXISTS /, "$1")
    .replace(/^(CREATE TABLE )"auth_flows"/, "$1auth_flows")
    .replace(/\s+/g, " ")
    .replace(/\s*([(),])\s*/g, "$1")
    .trim();
}

function migrationSql(name) {
  return readFileSync(join(server, "src", "migrations", name), "utf8");
}

function reconcile() {
  const [{ snapshot }] = execute(schemaQuery);
  const objects = new Map(JSON.parse(snapshot).map(([name, type, sql]) => [name, { type, sql }]));
  const mismatch = reason => {
    throw new Error(`Local migration history and schema disagree. ${reason} Reconciliation stopped before changing the database.`);
  };

  if (objects.has(historyTable) && objects.get(historyTable).type !== "table") {
    mismatch(`Expected ${historyTable} to be a table.`);
  }
  const history = objects.has(historyTable)
    ? execute(`SELECT id, name, applied_at FROM d1_migrations WHERE name IN (${migrationNames})`)
    : [];
  if (history.length > 1) {
    mismatch("Found multiple history rows for the 0030/0035 mobile auth migration.");
  }

  const [record] = history;
  const typeOf = name => objects.get(name)?.type;
  const sqlOf = name => normalizeSql(objects.get(name)?.sql);
  if (objects.has("auth_flows_next")) {
    mismatch("Found the intermediate auth_flows_next object.");
  }
  if (!record) {
    if (archivedTables.some(name => objects.has(name))) {
      mismatch("Found archived mobile auth tables without a 0030 or 0035 history row.");
    }
    if (objects.has(authTable)) {
      const before = migrationSql("0017_registration_identity.sql").match(/CREATE TABLE IF NOT EXISTS auth_flows\b[^;]+/)[0];
      if (typeOf(authTable) !== "table" || sqlOf(authTable) !== normalizeSql(before)) {
        mismatch("Expected the pre-consolidation auth_flows table because neither migration filename is recorded.");
      }
    }
    return;
  }

  const missingArchives = archivedTables.filter(name => typeOf(name) !== "table");
  const remainingLegacy = legacyTables.filter(name => objects.has(name));
  if (missingArchives.length || remainingLegacy.length) {
    mismatch(`${record.name} is recorded. Missing archived tables: ${missingArchives.join(", ") || "none"}. Remaining legacy objects: ${remainingLegacy.join(", ") || "none"}.`);
  }
  const consolidated = migrationSql(canonicalMigration);
  const expectedTable = consolidated.match(/CREATE TABLE auth_flows_next\b[^;]+/)[0].replace("auth_flows_next", authTable);
  const expectedIndex = consolidated.match(/CREATE INDEX idx_auth_flows_expiry\b[^;]+/)[0];
  if (typeOf(authTable) !== "table" || sqlOf(authTable) !== normalizeSql(expectedTable)
      || typeOf(expiryIndex) !== "index" || sqlOf(expiryIndex) !== normalizeSql(expectedIndex)) {
    mismatch(`${record.name} is recorded, but auth_flows or its expiry index differs from the consolidated schema.`);
  }
  if (record.name === canonicalMigration) return;
  if ([...objects.values()].some(object => object.type === "trigger")) {
    mismatch("Found a trigger on the migration history table.");
  }

  const backupRoot = join(server, ".wrangler", "backups");
  mkdirSync(backupRoot, { recursive: true });
  const backup = join(mkdtempSync(join(backupRoot, "before-0035-")), "geofix167-db.sql");
  runWrangler(["export", binding, "--output", backup]);
  console.log(`Backed up local D1 to ${backup}`);

  // Recheck the history and relevant schema in the same statement as the rename.
  const updated = execute(`
    UPDATE d1_migrations
    SET name = ${sqlString(canonicalMigration)}
    WHERE id = ${Number(record.id)} AND name = ${sqlString(oldMigration)}
      AND applied_at = ${sqlString(record.applied_at)}
      AND (SELECT COUNT(*) FROM d1_migrations WHERE name IN (${migrationNames})) = 1
      AND (${schemaQuery}) = ${sqlString(snapshot)}
    RETURNING id
  `);
  if (updated.length !== 1) {
    throw new Error("Local D1 history or schema changed during backup. Rerun npm run db:migrate.");
  }
  console.log(`Reconciled local migration history from ${oldMigration} to ${canonicalMigration}.`);
}

try {
  reconcile();
  runWrangler(["migrations", "apply", binding]);
} catch (error) {
  console.error(`Local D1 migration failed. ${error.message}`);
  process.exitCode = 1;
}
