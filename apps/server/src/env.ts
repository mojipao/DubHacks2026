import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { z } from "zod";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

/** Blank values (`KEY=` copied from .env.example) count as unset. */
const optional = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());

const Env = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  OWNER_TOKEN: optional,
  /** Shared secret ElevenLabs sends on voice tool calls (`x-voice-secret`). */
  VOICE_TOOL_SECRET: optional,

  SUPABASE_URL: optional,
  SUPABASE_SERVICE_ROLE_KEY: optional,

  PHOTON_PROJECT_ID: optional,
  PHOTON_API_KEY: optional,
  PHOTON_INBOUND: z.enum(["on", "off", "poll"]).default("off"),
  OWNER_HANDLE: optional,
  OWNER_NOTIFY: z.enum(["on", "off"]).default("off"),

  SQUARE_ACCESS_TOKEN: optional,
  SQUARE_LOCATION_ID: optional,
  SQUARE_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  SQUARE_WEBHOOK_SIGNATURE_KEY: optional,
  SQUARE_WEBHOOK_URL: optional,

  AGENT_MODE: z.enum(["live", "stub"]).default("stub"),
  /** on: the agent answers questions itself and checks orders with the customer first. off: every draft waits for the owner. */
  AUTONOMY: z.enum(["on", "off"]).default("on"),
  AGENT_MODEL: optional,

  ELEVENLABS_API_KEY: optional,
  ELEVENLABS_AGENT_ID: optional,
  /** The shop's phone line, put in "tap to call us back" texts while outbound calling is off. */
  PHOTON_VOICE_NUMBER: optional,
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:", z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;

/** Integrations that are missing keys run as disabled instead of crashing, so the server starts on any teammate's machine. */
export const features = {
  database: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
  photon: Boolean(env.PHOTON_PROJECT_ID && env.PHOTON_API_KEY),
  square: Boolean(env.SQUARE_ACCESS_TOKEN && env.SQUARE_LOCATION_ID),
  ownerRoutes: Boolean(env.OWNER_TOKEN),
};
