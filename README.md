# Admissions Oracle

A React-based college admissions guessing game where players evaluate real high school applicant profiles and guess their admissions results across different university tiers.

## Project Overview

This project was built to simulate the difficult, often unpredictable nature of college admissions. It features a completely custom frontend powered by React, a hybrid flat-file and SQLite backend, and an intelligent data scraping pipeline that leverages LLMs to turn unstructured Reddit posts into playable game scenarios.

### Architecture

The project employs a hybrid data architecture designed to cleanly separate static game content from dynamic player state:

1. **Frontend (React)**: 
   - A single-page application (SPA) living in `/public`. 
   - It runs completely in the browser via Babel standalone (no build step needed for the MVP). 
   - It features 4 primary phases (Profile Viewer, Tier Selection, School Selection, and Results Reveal) and manages its state internally before syncing scores to the backend.

2. **Backend (Express Node.js)**:
   - Lives in `server.js`.
   - Serves the static React frontend.
   - Provides a REST API for user authentication, fetching profiles, and submitting/retrieving scores.
   - Uses `jsonwebtoken` for secure stateless sessions and `bcryptjs` for password hashing.

3. **Data Storage**:
   - **Static Content (`data/profiles.jsonl`)**: The college applicant profiles. This is a flat JSONL file. To the game server, this is read-only. It is loaded into memory on startup. This allows for extremely easy updates (just replace the file).
   - **Player State (`data/game.db`)**: A robust SQLite database (`better-sqlite3`) that securely manages user accounts, password hashes, and user scores across different profiles. It also enables the real-time global leaderboard calculations.

### Data Scraping Pipeline

Because college admissions data is highly unstructured, the project includes an intelligent scraping toolkit in `scripts/scrape.js` that pulls data directly from r/collegeresults.

**Workflow:**
1. **Scraping**: `npm run scrape [--url <specific-reddit-url>]` fetches the raw post data using the unofficial `.json` endpoint (bypassing the need for PRAW/API keys for now).
2. **LLM Filtering & Extraction**: The raw text is passed to an LLM (currently configured for OpenRouter, e.g., `google/gemini-2.5-flash-lite-preview-09-2025`). The prompt includes a strict Pydantic JSON schema and instructions to apply a "Richness Filter". If the post lacks sufficient GPA/Course/Results data, the LLM rejects it. If approved, it structures the text into our exact `GameRecord` format.
3. **Queueing**: Successfully extracted profiles are saved to `data/queue.jsonl`.
4. **Human Review**: `npm run approve` provides an interactive CLI to read through the queued profiles and either `[a]pprove`, `[r]eject`, or `[q]uit`. Approved profiles are assigned a unique ID (e.g., `cr_2026_016`) and moved to the live `data/profiles.jsonl` database.

---

## Current Status & Implemented Features

- **Robust Defensive UI**: The frontend React components have been hardened with optional chaining (`?.`) so they will gracefully render empty states instead of crashing if an applicant is missing certain data (e.g., test scores, specific courses).
- **Independent Scoring Logic**: 
  - +10 points for a correct school guess.
  - -2 points for a wrong school guess (only if the tier band was a hit).
  - +10 points for correctly guessing the University tier.
  - +10 points for correctly guessing the LAC tier.
  - -5 points for guessing a completely wrong tier band.
  - "No LAC Admit" claim explicitly tracked and scored (+10 / -5).
- **Leaderboards & Persistence**: Full user registration/login flow. Scores are saved per user per profile in SQLite, enabling a dynamic global leaderboard.
- **Smart Scraper**: LLM integration correctly maps unstructured Reddit text to the required JSON schema, rejecting low-quality data upfront.

## Functions Waiting to be Implemented / Known Limitations

- **Build Pipeline Integration**: The frontend currently uses `@babel/standalone` to compile JSX in the browser. For production deployment, this needs to be transitioned to a Vite or Webpack build process.
- **PRAW Migration**: The scraper currently hits the unofficial `<url>.json` endpoint. Reddit rate limits this strictly. A documented migration path to PRAW (Python Reddit API Wrapper) is needed once an official Reddit Developer API token is acquired.
- **Advanced Admin Dashboard**: Currently, profile review is done via a terminal CLI (`npm run approve`). A web-based admin interface to edit and approve profiles would improve the content pipeline.

## Further Deployment Plan

1. **Local Content Management**: The scraping and approval process (`npm run scrape` and `npm run approve`) should always be run **locally** on a developer's machine. This prevents runaway LLM API costs and keeps garbage data off the production server.
2. **Pushing Updates**: Once the local `data/profiles.jsonl` has been enriched with new approved cases, that single file is securely pushed (via Git or SCP/SFTP) to the production server.
3. **Server Deployment**:
   - The Node Express app (`server.js`) can be deployed to any standard host (Railway, Render, DigitalOcean, or an EC2 instance).
   - Ensure the `data/` directory is mounted on a persistent volume so the `game.db` SQLite file survives deployments/restarts.
   - Environment variables (`PORT`, `JWT_SECRET`) must be configured on the host.

---

## Local Setup Instructions

1. `npm install`
2. Configure `.env` with:
   ```env
   PORT=3005
   JWT_SECRET=your_super_secret_key
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   ```
3. Run the server: `npm start`
4. Access the game at `http://localhost:3005`
