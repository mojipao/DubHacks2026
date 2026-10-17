import { Photon } from "@photon-ai/api";
import { env, features } from "../env.ts";

let client: Photon | undefined;

/** Photon 2.0 beta client with the project API key. Beta docs only: https://photon.codes/docs/beta/ */
export function photon(): Photon {
  if (!features.photon) throw new Error("Photon not configured: set PHOTON_PROJECT_ID and PHOTON_API_KEY");
  client ??= new Photon({ headers: { Authorization: `Bearer ${env.PHOTON_API_KEY}` } });
  return client;
}

export function projectPath() {
  return { id: env.PHOTON_PROJECT_ID! };
}
