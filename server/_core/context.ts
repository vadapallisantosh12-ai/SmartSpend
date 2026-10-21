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

  // Auto-login default user so SmartSpend works seamlessly without Manus login
  if (!user) {
    try {
      const openId = "local-dev-user";
      await db.upsertUser({
        openId,
        name: "SmartSpend User",
        email: "user@smartspend.local",
        loginMethod: "local",
        lastSignedIn: new Date(),
      });
      user = (await db.getUserByOpenId(openId)) ?? null;
    } catch (error) {
      console.warn("[Auto login] DB upsert failed, using memory fallback:", error);
    }

    if (!user) {
      user = {
        id: 1,
        openId: "local-dev-user",
        name: "SmartSpend User",
        email: "user@smartspend.local",
        loginMethod: "local",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      };
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}