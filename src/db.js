import "dotenv/config";
import postgres from "postgres";

const sql = postgres({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  database: process.env.PG_DATABASE,
  username: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
});

const stationCache = new Map();
const fieldCache = new Set();

export async function initDb() {
  try {
    console.log("Initializing DB");
    await sql`
      CREATE TABLE IF NOT EXISTS stations (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL UNIQUE,
        medium     TEXT NOT NULL,
        location   TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;
  
    await sql`
      CREATE TABLE IF NOT EXISTS scraper_fields (
        id         SERIAL PRIMARY KEY,
        station_id INT NOT NULL REFERENCES stations(id),
        field      TEXT NOT NULL,
        unit       TEXT NOT NULL,
        UNIQUE (station_id, field)
      )
    `;
  
    await sql`
      CREATE TABLE IF NOT EXISTS measurements (
        time       TIMESTAMPTZ NOT NULL,
        station_id INT NOT NULL REFERENCES stations(id),
        scraped_at TIMESTAMPTZ NOT NULL,
        fields     JSONB NOT NULL
      )
    `;
  
    await sql`
      CREATE INDEX IF NOT EXISTS measurements_time_idx
      ON measurements USING BRIN (time)
    `;
  
    await sql`
      CREATE INDEX IF NOT EXISTS measurements_station_id_idx
      ON measurements (station_id)
    `;
  
    await sql`
      CREATE INDEX IF NOT EXISTS measurements_fields_idx
      ON measurements USING GIN (fields)
    `;
  } catch(error) {
    console.log("Error initializing DB");
    console.error(error);
    process.exit(1);
  }
}

async function getOrCreateStation(scraperName, medium, location) {
  if (stationCache.has(scraperName)) return stationCache.get(scraperName);

  const [station] = await sql`
    INSERT INTO stations (name, medium, location)
    VALUES (${scraperName}, ${medium}, ${location})
    ON CONFLICT (name) DO NOTHING
    RETURNING id
  `;

  const id =
    station?.id ??
    (
      await sql`
        SELECT id FROM stations WHERE name = ${scraperName}
      `
    )[0].id;

  stationCache.set(scraperName, id);
  return id;
}

async function registerFields(stationId, fields) {
  for (const [field, { unit }] of Object.entries(fields)) {
    const cacheKey = `${stationId}:${field}`;
    if (fieldCache.has(cacheKey)) continue;

    await sql`
      INSERT INTO scraper_fields (station_id, field, unit)
      VALUES (${stationId}, ${field}, ${unit})
      ON CONFLICT (station_id, field) DO NOTHING
    `;

    fieldCache.add(cacheKey);
  }
}

export async function writeScraperResult(scraperName, result) {
  const { time, medium, location, scrapedAt, fields } = result;

  const stationId = await getOrCreateStation(scraperName, medium, location);

  await registerFields(stationId, fields);

  const fieldValues = Object.fromEntries(
    Object.entries(fields).map(([key, { value }]) => [key, value])
  );
  try {
    await sql`
      INSERT INTO measurements (time, station_id, scraped_at, fields)
      VALUES (
        ${new Date(time)},
        ${stationId},
        ${new Date(scrapedAt)},
        ${sql.json(fieldValues)}
      )
    `;
    console.log("Successful DB write of scraper ", scraperName);
  } catch(error) {
    console.error("Failed to write to DB with the scraper ", scraperName);
    console.error(error);
  }
}

export async function closeDb() {
  await sql.end();
}
