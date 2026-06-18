import { readdir, access } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { exec } from "child_process"; 
import { fork } from "child_process"; 
import { promisify } from "util"; 
import { Cron } from "croner";
import { writeScraperResult, closeDb } from "./db.js"; 

const execAsync = promisify(exec); 

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRAPERS_DIR = resolve(__dirname, "scrapers");
const DEFAULT_SCHEDULE = "0 * * * *";
const DISCOVERY_SCHEDULE = "*/1 * * * *";
const SCRAPER_TIMEOUT_MS = 30000; // changed: added timeout constant

// file path → Cron instance
const scheduled = new Map();

async function loadScrapers() {
  const entries = await readdir(SCRAPERS_DIR, { withFileTypes: true });

  const scrapers = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      scrapers.push({
        file: resolve(SCRAPERS_DIR, entry.name, "index.js"),
        dir: resolve(SCRAPERS_DIR, entry.name),
      });
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      scrapers.push({
        file: resolve(SCRAPERS_DIR, entry.name),
        dir: null,
      });
    }
  }
  return scrapers;
}

async function installDeps({ dir }) {
  if (!dir) return;
  try {
    await access(resolve(dir, "package.json"));
  } catch {
    return;
  }
  console.log(`[${dir}] Installing deps...`);
  await execAsync("npm install --prefer-offline", { cwd: dir }); // changed: execSync → execAsync
}

async function runScraperInChildProcess(file) {
  const runnerPath = resolve(__dirname, "scraperRunner.js");

  return new Promise((resolve, reject) => {
    const child = fork(runnerPath, [file], {
      env: {}, // changed: empty env, no leaking of parent env vars
      silent: true,
    });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Scraper timed out: ${file}`));
    }, SCRAPER_TIMEOUT_MS);

    child.on("message", (result) => {
      clearTimeout(timer);
      resolve(result);
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Scraper exited with code ${code}`));
      }
    });
  });
}

async function runScraper(file, name) {
  console.log(`[${new Date().toISOString()}] Running: ${name}`);
  try {
    const result = await runScraperInChildProcess(file);
    await writeScraperResult(name, result);
    console.log(`[${name}] Written to InfluxDB`);
  } catch (err) {
    console.error(`[${name}] Failed:`, err.message);
  }
}

async function discoverAndSchedule() {
  let scrapers;
  try {
    scrapers = await loadScrapers();
  } catch (err) {
    console.error("Failed to read scrapers directory:", err);
    return;
  }

  const foundFiles = new Set(scrapers.map((s) => s.file));

  // Unschedule removed scrapers
  for (const [file, job] of scheduled) {
    if (!foundFiles.has(file)) {
      job.stop();
      scheduled.delete(file);
      console.log(`Unscheduled [${file}]`);
    }
  }

  // Schedule new scrapers
  for (const { file, dir } of scrapers) {
    if (scheduled.has(file)) continue;

    try {
      await installDeps({ dir });

      const filePath = pathToFileURL(file).href;
      const module = await import(filePath);
      const name = module.config?.name ?? file;
      const schedule = module.config?.schedule ?? DEFAULT_SCHEDULE;

      const job = new Cron(schedule, async () => {
        await runScraper(file, name); 
      });

      scheduled.set(file, job);
      console.log(`Scheduled [${name}] → ${schedule}`);
    } catch (err) {
      console.error(`Failed to schedule [${file}]:`, err);
    }
  }
}

async function start() {
  console.log("Orchestrator started");

  await discoverAndSchedule();

  new Cron(DISCOVERY_SCHEDULE, discoverAndSchedule);

  console.log("Orchestrator running...");
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down...");
  await closeDb();
  process.exit(0);
});

start();
