// Loads a .env file when one is present (local dev). On Northflank the values
// are injected as real environment variables and this is a no-op.
import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See backend/.env.example.`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const env = {
  NODE_ENV: optional("NODE_ENV", "development"),
  PORT: Number(optional("PORT", "3004")),

  DATABASE_URL: required("DATABASE_URL"),

  // Signs the JWTs handed to the web app. Rotating it logs everyone out.
  JWT_SECRET: required("JWT_SECRET"),
  JWT_EXPIRES_IN: optional("JWT_EXPIRES_IN", "30d"),

  // Shared secret the Raspberry Pi sends as `x-api-key` on POST /pi_data.
  // Canes are not browser clients, so they do not get a JWT.
  PI_INGEST_KEY: required("PI_INGEST_KEY"),

  GROQ_API_KEY: required("GROQ_API_KEY"),
  GROQ_MODEL: optional("GROQ_MODEL", "openai/gpt-oss-120b"),

  // Comma-separated list of browser origins allowed to call this API.
  CORS_ORIGINS: optional("CORS_ORIGINS", "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
} as const;

export const isProduction = env.NODE_ENV === "production";
