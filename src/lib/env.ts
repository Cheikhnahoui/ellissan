import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  QR_TOKEN_SECRET: z.string().min(32, "QR_TOKEN_SECRET must be at least 32 characters"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_TIMEZONE: z.string().default("Africa/Nouakchott"),
});

let cached: z.infer<typeof schema> | undefined;

/** Validated server-side environment. Never import this from client components. */
export function env() {
  cached ??= schema.parse(process.env);
  return cached;
}
