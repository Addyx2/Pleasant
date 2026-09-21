const path = require("path");
const fs = require("fs");
const os = require("os");
const { Client } = require("pg");

const { default: Postgres } = require("embedded-postgres");

const PORT = Number(process.env.PG_PORT || 5432);
const DB = process.env.PG_DB || "pleasant";
const DATA_DIR = path.join(process.env.PG_DATA_DIR || path.join(os.homedir(), "AppData", "Local", "PleasantPg"));

function client() {
  return new Client({ host: "localhost", port: PORT, user: "postgres", password: "postgres", database: "postgres" });
}

async function isRunning() {
  const c = client();
  try {
    await c.connect();
    await c.end();
    return true;
  } catch {
    return false;
  }
}

async function ensureDatabase() {
  const c = client();
  try {
    await c.connect();
    const res = await c.query("SELECT 1 FROM pg_database WHERE datname = $1", [DB]);
    if (res.rowCount === 0) {
      await c.query(`CREATE DATABASE ${DB.replace(/[^a-zA-Z0-9_]/g, "")}`);
      console.log(`Created database "${DB}".`);
    } else {
      console.log(`Database "${DB}" already exists.`);
    }
  } finally {
    await c.end();
  }
}

async function start() {
  if (await isRunning()) {
    console.log(`Postgres already listening on localhost:${PORT}.`);
    await ensureDatabase();
    return;
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });

  const postgres = new Postgres({
    databaseDir: DATA_DIR,
    user: "postgres",
    password: "postgres",
    host: "localhost",
    port: PORT,
    persistent: true,
  });

  const ready = path.join(DATA_DIR, "PG_VERSION");
  if (!fs.existsSync(ready)) {
    console.log(`Initialising Postgres cluster in ${DATA_DIR} ...`);
    await postgres.initialise();
  }

  console.log(`Starting Postgres on localhost:${PORT} ...`);
  await postgres.start();
  await ensureDatabase();
  console.log("Ready.");
}

async function stop() {
  const postgres = new Postgres({ port: PORT, persistent: true });
  await postgres.stop();
  console.log("Stopped.");
}

async function main() {
  const cmd = process.argv[2] || "start";
  if (cmd === "start") await start();
  else if (cmd === "stop") await stop();
  else throw new Error(`Unknown command: ${cmd} (use "start" or "stop")`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});