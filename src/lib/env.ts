import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Unset locally: the app uses file-backed PGlite. Set on Vercel (Neon).
  DATABASE_URL: z.url().optional(),
  // Where local PGlite keeps its files when DATABASE_URL is unset. Defaults to .data/pglite.
  PGLITE_DATA_DIR: z.string().min(1).optional(),
  // Signs the anonymous-ID cookie and hashes link tokens.
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${problems}`);
  }
  return result.data;
}

let cached: Env | undefined;

/** Validated process env, parsed once on first use. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
