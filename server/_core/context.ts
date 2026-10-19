import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // LOCAL TESTING ONLY: auto-login as a test user
  if (!user && process.env.NODE_ENV === "development") {
    try {
      const openId = "local-dev-user";
      await db.upsertUser({
        openId,
        name: "Local User",
        email: "local@example.com",
        loginMethod: "local",
        lastSignedIn: new Date(),
      });
      user = (await db.getUserByOpenId(openId)) ?? null;
    } catch (error) {
      console.error("[Local login] failed:", error);
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}