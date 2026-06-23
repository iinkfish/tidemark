import "dotenv/config";
import { InfluxDB, Point } from "@influxdata/influxdb-client";

const client = new InfluxDB({
  url: process.env.INFLUX_URL,
  token: process.env.INFLUX_TOKEN,
});
const writeApi = client.getWriteApi(
  process.env.INFLUX_ORG,
  process.env.INFLUX_BUCKET
);

export async function writeScraperResult(name, result) {
  const { measurement, medium, type, location, time, scrapedAt, ...rest } = result;

  const point = new Point(measurement)
    .tag("scraper", name)
    .tag("medium", medium)
    .tag("type", type)
    .tag("location", location)
    .timestamp(new Date(scrapedAt ?? Date.now()));

  function addField(key, value) {
      if (typeof value === "number") {
        point.floatField(key, value);
      } else if (typeof value === "boolean") {
        point.booleanField(key, value);
      } else {
        point.stringField(key, String(value));
      }
    }

  for (const [key, value] of Object.entries(rest)) {
    if (value && typeof value === "object") {
      Object.entries(value).forEach(([nestedKey, nestedVal]) => {
        addField(nestedKey, nestedVal);
      });
    } else {
      addField(key, value);
    }
  }

  writeApi.writePoint(point);
  await writeApi.flush();
}

export async function closeDb() {
  await writeApi.close();
}
