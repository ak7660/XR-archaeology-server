import { config } from "dotenv";

// Try to load from .env file (for local development)
const { error, parsed } = config();

export function loadAdminPagePrepath() {
  if (error && process.env.NODE_ENV !== "production") {
    console.warn("load env failed. please follow readme.md");
  }

  // In production (Railway), use process.env directly
  // In development, use parsed .env file or fall back to process.env
  return {
    ME_CONFIG_BASICAUTH_USERNAME: parsed?.ME_CONFIG_BASICAUTH_USERNAME || process.env.ME_CONFIG_BASICAUTH_USERNAME,
    ME_CONFIG_BASICAUTH_PASSWORD: parsed?.ME_CONFIG_BASICAUTH_PASSWORD || process.env.ME_CONFIG_BASICAUTH_PASSWORD,
    host: parsed?.host || process.env.host,
    page_prefix: parsed?.page_prefix || process.env.page_prefix,
    protocol: parsed?.protocol || process.env.protocol,
  } as {
    ME_CONFIG_BASICAUTH_USERNAME: string;
    ME_CONFIG_BASICAUTH_PASSWORD: string;
    host: string;
    page_prefix: string;
    protocol: string;
  };
}
