const [, , file] = process.argv;

async function main() {
  if (!file) {
    console.error("No scraper file specified");
    process.exit(1);
  }

  const { pathToFileURL } = await import("url");
  const module = await import(pathToFileURL(file).href);

  const result = await module.run();

  process.send(result);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
