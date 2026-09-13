/**
 * Account actions on the public API: `POST /api/account` with an `action`.
 *
 *   verifyEmail         { code }                      signed in
 *   resendVerification  {}                            signed in
 *   forgotPassword      { email }                     anyone - always answers the same
 *   resetPassword       { email, code, password }     anyone
 *   changePassword      { currentPassword, password } signed in
 *
 * Codes: server/feathers/accountCodes.ts. A reset or change of password sets
 * `passwordChangedAt`, which ends every session issued before it (AppJWTStrategy).
 */
import { HookContext, Params } from "@feathersjs/feathers";
import * as authentication from "@feathersjs/authentication";
import * as errors from "@feathersjs/errors";
import bcrypt from "bcryptjs";
import { checkCode, CodeCheck } from "@/server/feathers/accountCodes";
import { clientIp, enforce, HOUR, MINUTE } from "@/server/feathers/rateLimit";
import { normaliseEmail, PRIVATE_FIELDS, sendResetCode, sendVerificationCode, validatePassword } from "@/server/feathers/appAccounts";
import _ from "lodash";

type Action = "verifyEmail" | "resendVerification" | "forgotPassword" | "resetPassword" | "changePassword";
const SIGNED_IN: Action[] = ["verifyEmail", "resendVerification", "changePassword"];

const CODE_MESSAGES: Record<Exclude<CodeCheck, "ok">, string> = {
  wrong: "That code isn't right. Check the email and try again.",
  expired: "That code has expired. Ask for a new one.",
  missing: "There's no code waiting for this account. Ask for a new one.",
  locked: "Too many wrong codes. Ask for a new one.",
};

/** "Now", rounded down to the second: tokens carry whole-second `iat`s, so a token
 * minted right after a password change must not look older than the change. */
function sessionCutoff() {
  return new Date(Math.floor(Date.now() / 1000) * 1000);
}

class AccountService {
  app: any;

  setup(app: any) {
    this.app = app;
  }

  async create(data: any, params: Params & { user?: any }) {
    const action: Action = data?.action;
    switch (action) {
      case "verifyEmail":
        return this.verifyEmail(params.user, data.code);
      case "resendVerification":
        return this.resendVerification(params.user);
      case "forgotPassword":
        return this.forgotPassword(data.email, params);
      case "resetPassword":
        return this.resetPassword(data, params);
      case "changePassword":
        return this.changePassword(params.user, data);
      default:
        throw new errors.BadRequest("Unknown account action.");
    }
  }

  private users() {
    return this.app.service("users");
  }

  /** The full stored record (with code hashes), fetched internally. */
  private async load(id: any) {
    return this.users().get(id);
  }

  private publicUser(user: any) {
    return _.omit(user, PRIVATE_FIELDS);
  }

  private async verifyEmail(sessionUser: any, code: unknown) {
    const user = await this.load(sessionUser._id);
    if (user.verified) return { verified: true, user: this.publicUser(user) };
    const check = await checkCode(code, { hash: user.verifyToken, expires: user.verifyExpires, attempts: user.verifyTrial });
    if (check !== "ok") {
      if (check === "wrong") await this.users().patch(user._id, { $inc: { verifyTrial: 1 } });
      throw new errors.BadRequest(CODE_MESSAGES[check], { reason: check });
    }
    const updated = await this.users().patch(user._id, { verified: true, verifyToken: null, verifyExpires: null, verifyTrial: 0 });
    return { verified: true, user: this.publicUser(updated) };
  }

  private async resendVerification(sessionUser: any) {
    const user = await this.load(sessionUser._id);
    if (user.verified) return { sent: false, verified: true };
    // Judged from the stored send time, so the code sent at sign-up counts too.
    if (user.verifySentAt && Date.now() - new Date(user.verifySentAt).getTime() < MINUTE) {
      throw new errors.TooManyRequests("A code was sent less than a minute ago. Check your inbox and spam folder.");
    }
    enforce(`verify-resend:${user._id}`, 5, HOUR, "Too many codes requested. Please try again in an hour.");
    await sendVerificationCode(this.app, user);
    return { sent: true };
  }

  /** Always answers `{ sent: true }`, so this can't be used to discover which emails have accounts. */
  private async forgotPassword(rawEmail: unknown, params: Params) {
    const email = normaliseEmail(rawEmail);
    enforce(`forgot-ip:${clientIp(params)}`, 10, HOUR);
    if (!email) throw new errors.BadRequest("Please enter your email address.", { field: "email" });
    const [user] = await this.users().find({ query: { email, $limit: 1 }, paginate: false });
    // Quietly stop sending after a few requests for the same address.
    if (user && (user.providers || ["local"]).includes("local")) {
      if (!params.provider || (await this.quietAllow(`forgot-email:${email}`, 3, HOUR))) {
        await sendResetCode(this.app, user);
      }
    }
    return { sent: true };
  }

  private async quietAllow(key: string, limit: number, windowMs: number) {
    try {
      enforce(key, limit, windowMs);
      return true;
    } catch {
      return false;
    }
  }

  private async resetPassword(data: any, params: Params) {
    const email = normaliseEmail(data.email);
    enforce(`reset-ip:${clientIp(params)}`, 20, HOUR);
    validatePassword(data.password);
    const [user] = await this.users().find({ query: { email, $limit: 1 }, paginate: false });
    if (!user) throw new errors.BadRequest(CODE_MESSAGES.wrong, { reason: "wrong" });
    const check = await checkCode(data.code, { hash: user.resetToken, expires: user.resetExpires, attempts: user.resetTrial });
    if (check !== "ok") {
      if (check === "wrong") await this.users().patch(user._id, { $inc: { resetTrial: 1 } });
      throw new errors.BadRequest(CODE_MESSAGES[check], { reason: check });
    }
    await this.users().patch(user._id, {
      password: await bcrypt.hash(data.password, 10),
      resetToken: null,
      resetExpires: null,
      resetTrial: 0,
      resetRequired: false,
      passwordChangedAt: sessionCutoff(),
      // The code arrived by email, so the address is proven.
      verified: true,
    });
    return { reset: true };
  }

  private async changePassword(sessionUser: any, data: any) {
    enforce(`change-password:${sessionUser._id}`, 10, HOUR);
    const user = await this.load(sessionUser._id);
    if (user.password && !(await bcrypt.compare(String(data.currentPassword ?? ""), user.password))) {
      throw new errors.BadRequest("Your current password isn't right.", { field: "currentPassword" });
    }
    validatePassword(data.password);
    const changedAt = sessionCutoff();
    await this.users().patch(user._id, { password: await bcrypt.hash(data.password, 10), passwordChangedAt: changedAt });
    // Other sessions end; this one gets a fresh token so the person stays signed in here.
    const accessToken = await this.app.service("authentication").createAccessToken({}, { subject: String(user._id) });
    return { changed: true, accessToken };
  }
}

export default new AccountService();

export const hooks = {
  before: {
    create: [
      async (hook: HookContext) => {
        if (!hook.params.provider) return;
        if (SIGNED_IN.includes(hook.data?.action)) {
          await authentication.authenticate("jwt")(hook as any);
        }
      },
    ],
  },
};
