"use server";

import { confirmationEmail, createMailer } from "@tetoca/alerts";
import { householdProfileSchema } from "@tetoca/core";
import {
  confirmSubscription,
  createSubscription,
  deleteSubscription,
  encryptionKey,
} from "@tetoca/db";
import { z } from "zod";
import { alertsEnabled } from "@/lib/alerts-config";
import { getDb } from "@/lib/db";
import { siteUrl } from "@/lib/site";

export type SubscribeState = {
  status?: "sent" | "invalidEmail" | "consentRequired" | "unavailable" | "error";
  email?: string;
};

const emailSchema = z.string().trim().email().max(254);

export async function subscribeAction(_: SubscribeState, form: FormData): Promise<SubscribeState> {
  const email = String(form.get("email") ?? "");
  // Honeypot: bots fill every field; humans never see this one.
  if (form.get("website")) return { status: "sent" };
  if (!alertsEnabled()) return { status: "unavailable" };
  if (!emailSchema.safeParse(email).success) return { status: "invalidEmail", email };
  if (form.get("consent") !== "on") return { status: "consentRequired", email };
  let profileJson: unknown;
  try {
    profileJson = JSON.parse(String(form.get("profile") ?? ""));
  } catch {
    return { status: "error", email };
  }
  const profile = householdProfileSchema.safeParse(profileJson);
  if (!profile.success) return { status: "error", email };
  try {
    const { confirmToken } = await createSubscription(getDb(), encryptionKey(), {
      email,
      profile: profile.data,
    });
    await createMailer().send(
      confirmationEmail(email.trim(), siteUrl(`/alertas/confirmar?token=${confirmToken}`)),
    );
    return { status: "sent" };
  } catch (err) {
    console.error("subscribe failed", (err as Error).message);
    return { status: "error", email };
  }
}

export async function confirmAction(token: string): Promise<boolean> {
  if (!alertsEnabled() || !token) return false;
  return confirmSubscription(getDb(), token);
}

export async function deleteAction(id: string, token: string): Promise<boolean> {
  if (!alertsEnabled()) return false;
  return deleteSubscription(getDb(), encryptionKey(), id, token);
}
