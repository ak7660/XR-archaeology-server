/**
 * Shared rules for app-user accounts on the public API: what an account may
 * contain, what is never sent to the app, and how codes are emailed.
 *
 * Lives outside server/api/public/ because every file in that folder becomes
 * an endpoint.
 */
import { Application } from "@feathersjs/feathers";
import * as errors from "@feathersjs/errors";
import { codeMail, sendMail } from "./mail";
import { expiresIn, hashCode, newCode, RESET_MINUTES, VERIFY_MINUTES } from "./accountCodes";

/** Fields people may set on their own account. Everything else is managed by the server. */
export const EDITABLE_FIELDS = ["firstName", "lastName", "username", "phone", "dob", "bookmarks", "collections", "language", "avatar"];

/** Never sent to the app. */
export const PRIVATE_FIELDS = [
  "password",
  "verifyToken",
  "verifyExpires",
  "verifyTrial",
  "verifySentAt",
  "resetToken",
  "resetExpires",
  "resetTrial",
  "resetTime",
  "resetRequired",
  "passwordChangedAt",
  "googleId",
];

export const LANGUAGES = ["en", "hy", "ru"];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliseEmail(email: unknown): string {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

export function validateEmail(email: string) {
  if (!EMAIL.test(email) || email.length > 254) throw new errors.BadRequest("Please enter a valid email address.", { field: "email" });
}

export function validatePassword(password: unknown) {
  if (typeof password !== "string" || password.length < 8) {
    throw new errors.BadRequest("Password must be at least 8 characters.", { field: "password" });
  }
  if (password.length > 128) throw new errors.BadRequest("Password must be 128 characters or fewer.", { field: "password" });
}

/** Issue a new email-confirmation code (replacing any earlier one) and email it. */
export async function sendVerificationCode(app: Application, user: any) {
  const code = newCode();
  await app.service("users").patch(user._id, {
    verifyToken: await hashCode(code),
    verifyExpires: expiresIn(VERIFY_MINUTES),
    verifyTrial: 0,
    verifySentAt: new Date(),
  });
  await sendMail(codeMail(user.email, code, "verify", VERIFY_MINUTES, user.language));
}

/** Issue a new password-reset code (replacing any earlier one) and email it. */
export async function sendResetCode(app: Application, user: any) {
  const code = newCode();
  await app.service("users").patch(user._id, {
    resetToken: await hashCode(code),
    resetExpires: expiresIn(RESET_MINUTES),
    resetTrial: 0,
    resetTime: new Date(),
  });
  await sendMail(codeMail(user.email, code, "reset", RESET_MINUTES, user.language));
}
