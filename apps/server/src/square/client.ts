import { SquareClient, SquareEnvironment } from "square";
import { env, features } from "../env.ts";

let client: SquareClient | undefined;

export function square(): SquareClient {
  if (!features.square) throw new Error("Square not configured: set SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID");
  client ??= new SquareClient({
    token: env.SQUARE_ACCESS_TOKEN!,
    environment: env.SQUARE_ENVIRONMENT === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  });
  return client;
}
