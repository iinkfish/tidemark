## What this is
tidemark is an orchestrator for javascript based webscrapers and api aggregators. 
It decouples the individual scrapers from the main orchestrator by just importing files dynamically. 

## How it works
The main workhorse of tidemark is croner which is used for scheduling the scrapers. 
Tidemark is meant to be built with a docker container and it's scraper files are mounted into the container. 
Which means scrapers a scheduled and unscheduled if they're removed from the directory

This gives the benefit that the container doesn't have to be rebuild each time a new scraper is added. 

## Dev Comments
This is build and deployed with Dokploy with a Dockerfile. But you can also use the prebuilt image. 
You have to run your own postgres DB and add the environment variables yourself. 

Env vars: 
```
PG_HOST=YOUR_PG_HOST
PG_PORT=5432
PG_DATABASE=tidemark-data
PG_USER=YOUR_PG_USER
PG_PASSWORD=YOUR_PG_PASSWORD
```

### Example Docker Compose
```
services:
  app:
    image: ghcr.io/iinkfish/tidemark:latest
    environment:
      PG_HOST: YOUR_PG_HOST
      PG_PORT: 5432
      PG_DATABASE: tidemark-data
      PG_USER: YOUR_PG_USER
      PG_PASSWORD: YOUR_PG_PASSWORD
    volumes:
      - ./scrapers:/app/src/scrapers
      - ./schemas:/app/schemas
    restart: unless-stopped
```

## TODO
1. Write a docker compose with build arguments
3. Modify so schedule and schema gets read from config files instead of src file
