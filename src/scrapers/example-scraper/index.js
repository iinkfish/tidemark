// scrapers/my-scraper/index.js
import axios from "axios";
import { load } from "cheerio";

export const config = {
  name: "my-scraper",
  schedule: "*/5 * * * *",
};

export async function run() {
  const { data: html } = await axios.get("https://example.com");
  const $ = load(html);

  const title = $("h1").text();
  const price = parseFloat($(".price").text().replace("$", ""));

  return {
    title,
    price,
    scrapedAt: new Date().toISOString(),
  };
}
