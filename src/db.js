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
  const point = new Point("scraper_result")
    .tag("scraper", name)
    .fields(result) // assumes result is a flat object of primitives
    .timestamp(new Date());

  writeApi.writePoint(point);
  await writeApi.flush();
}

export async function closeDb() {
  await writeApi.close();
}
