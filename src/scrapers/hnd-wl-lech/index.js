import { load } from "cheerio";

export const config = {
  name: "hnd-wl-lech",
  schedule: "*/1 * * * *",
  pointSchema: "environmental-schema",
};

export async function run() {
  const url = "https://www.hnd.bayern.de/pegel/iller_lech/augsburg-u-d-wertachmuendung-12006000";

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const html = await response.text();
  const $ = load(html);

  const firstRow = $(".tblsort tbody tr.row").first();
  const date = firstRow.find("td").eq(0).text().trim();
  const waterLevel = parseInt(firstRow.find("td").eq(1).text().trim(), 10);

  console.log(date);

  return {
    time: date,
    medium: "water",
    location: "Augsburg, Wertachmuendung",
    measurement: "environmental",
    scrapedAt: new Date().toISOString(),
    fields: {
      waterlevel_cm: waterLevel,
    },
  };
}
