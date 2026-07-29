"use strict";

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env");
const extensionRoot = path.join(projectRoot, "extension");
const outputPath = path.join(extensionRoot, "config.js");

function parseEnvFile(content) {
  const lines = content.split(/\r?\n/);
  const values = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    values[key] = value;
  }

  return values;
}

function escapeJsString(value) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function buildConfigFile(envValues) {
  const supabaseUrl = escapeJsString(envValues.SUPABASE_URL || "");
  const supabaseAnonKey = escapeJsString(envValues.SUPABASE_KEY || "");
  const webAppUrl = escapeJsString(envValues.WEB_APP_URL || "");

  // Only output Supabase config — translation API keys are user-provided
  return [
    "// This file is auto-generated from .env",
    "// Translation API keys are NOT included — users provide their own via options page",
    "window.APP_CONFIG = {",
    `  supabaseUrl: '${supabaseUrl}',`,
    `  supabaseAnonKey: '${supabaseAnonKey}',`,
    "  supabaseTable: 'vocabulary',",
    `  webAppUrl: '${webAppUrl}'`,
    "};",
    ""
  ].join("\n");
}

function main() {
  if (!fs.existsSync(envPath)) {
    throw new Error(".env file not found.");
  }
  if (!fs.existsSync(extensionRoot)) {
    throw new Error("extension folder not found.");
  }

  const envContent = fs.readFileSync(envPath, "utf8");
  const envValues = parseEnvFile(envContent);
  const output = buildConfigFile(envValues);

  fs.writeFileSync(outputPath, output, "utf8");
  console.log("Generated extension/config.js from .env");
}

main();
