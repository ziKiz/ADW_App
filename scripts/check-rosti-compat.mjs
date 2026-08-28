#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const checks = [];
const fail = (message) => checks.push(message);
const includes = (content, value, message) => {
  if (!content.includes(value)) fail(message);
};
const matches = (content, pattern, message) => {
  if (!pattern.test(content)) fail(message);
};

const dockerfile = read("Dockerfile");
const compose = read("docker-compose.rosti.yml");
const gitignore = read(".gitignore");
const docs = read("docs/ROSTI_COMPATIBILITY.md");

matches(
  dockerfile,
  /^FROM node:20-alpine@sha256:[a-f0-9]{64} AS frontend-build$/m,
  "Dockerfile must pin Node 20 Alpine by sha256 digest.",
);
matches(
  dockerfile,
  /^FROM python:3\.11-slim@sha256:[a-f0-9]{64} AS runtime$/m,
  "Dockerfile must pin Python 3.11 slim by sha256 digest.",
);
if (/^FROM\s+\S+:latest(?:\s|$)/m.test(dockerfile)) {
  fail("Dockerfile must not use latest tags.");
}

matches(
  compose,
  /image:\s*postgres:16-alpine@sha256:[a-f0-9]{64}/,
  "docker-compose.rosti.yml must pin PostgreSQL 16 Alpine by sha256 digest.",
);
if (/image:\s*\S+:latest(?:\s|$)/.test(compose.replace("image: localhost/app:latest", ""))) {
  fail("docker-compose.rosti.yml must not use latest tags for pulled images.");
}
includes(compose, '- "80:80"', "Roští app service must expose port 80:80.");
includes(compose, "./pgsql-data:/var/lib/postgresql/data", "PostgreSQL data must stay in ./pgsql-data volume.");
includes(compose, "DATABASE_URL:", "DATABASE_URL must be configured through environment.");
includes(compose, "JWT_SECRET:", "JWT_SECRET must be configured through environment.");
includes(compose, "CORS_ORIGINS:", "CORS_ORIGINS must be configured through environment.");
includes(compose, "ADW_SEED_DEMO:", "ADW_SEED_DEMO must be explicit in Roští compose.");

includes(docs, "Roští", "docs/ROSTI_COMPATIBILITY.md must mention Roští.");
includes(docs, "pgsql-data", "docs/ROSTI_COMPATIBILITY.md must document pgsql-data persistence.");
includes(docs, "node scripts/check-rosti-compat.mjs", "docs/ROSTI_COMPATIBILITY.md must document this check.");
includes(gitignore, "Documents/*ihla*udaje.xlsx", ".gitignore must protect login spreadsheet.");

if (checks.length) {
  console.error("Roští kompatibilita selhala:");
  for (const check of checks) console.error(`- ${check}`);
  process.exit(1);
}

console.log("Roští kompatibilita OK.");
