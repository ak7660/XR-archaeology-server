/**
 * App user accounts on the public API (`/api/users`).
 *
 * - create: sign up with email + password. Anyone may call it (rate-limited per
 *   address); a confirmation code is emailed straight away.
 * - get/find/patch/remove: only your own account, once signed in. `remove` is
 *   "delete my account" and also deletes what the account owns.
 * Password changes, email confirmation and password reset live in `account`.
 */
import db from "@mfeathers/db";
import service from "feathers-mongoose";
import { disallow, iff, isProvider } from "feathers-hooks-common";
import * as local from "@feathersjs/authentication-local";
import { HookContext } from "@feathersjs/feathers";
import * as authentication from "@feathersjs/authentication";
import * as errors from "@feathersjs/errors";
import _ from "lodash";
import { clientIp, enforce, HOUR } from "@/server/feathers/rateLimit";
import {
  EDITABLE_FIELDS,
  LANGUAGES,
  PRIVATE_FIELDS,
  normaliseEmail,
  sendVerificationCode,
  validateEmail,
  validatePassword,
} from "@/server/feathers/appAccounts";

let def = service({
  Model: db.User,
});

export default def;

function cleanName(value: unknown, field: string, required: boolean) {
  const name = String(value ?? "").trim();
  if (!name && required) throw new errors.BadRequest("Please enter your first name.", { field });
  if (name.length > 60) throw new errors.BadRequest("Names must be 60 characters or fewer.", { field });
  return name || undefined;
}

async function prepareSignup(hook: HookContext) {
  if (!hook.params.provider) return;
  enforce(`signup:${clientIp(hook.params)}`, 10, HOUR, "Too many sign-ups from this network. Please try again later.");

  const data = hook.data || {};
  const email = normaliseEmail(data.email);
  validateEmail(email);
  validatePassword(data.password);

  const existing = await hook.app.service("users").find({ query: { email, $limit: 1 }, paginate: false });
  if ((existing as any[]).length) {
    throw new errors.Conflict("An account with this email already exists. Sign in, or reset your password.", { field: "email" });
  }

  hook.data = {
    ..._.pick(data, EDITABLE_FIELDS),
    firstName: cleanName(data.firstName, "firstName", true),
    lastName: cleanName(data.lastName, "lastName", false),
    email,
    password: data.password,
    language: LANGUAGES.includes(data.language) ? data.language : "en",
    providers: ["local"],
    verified: false,
    bookmarks: Array.isArray(data.bookmarks) ? data.bookmarks : [],
    collections: Array.isArray(data.collections) ? data.collections : [],
    createdAt: new Date(),
  };
}

function preparePatch(hook: HookContext) {
  if (!hook.params.provider) return;
  const data = _.pick(hook.data || {}, EDITABLE_FIELDS);
  if ("firstName" in data) data.firstName = cleanName(data.firstName, "firstName", true);
  if ("lastName" in data) data.lastName = cleanName(data.lastName, "lastName", false) ?? "";
  if ("language" in data && !LANGUAGES.includes(data.language)) delete data.language;
  if (_.isEmpty(data)) throw new errors.BadRequest("Nothing to update.");
  hook.data = data;
}

/** Scope a signed-in call to the caller's own account. */
function ownAccountOnly(hook: HookContext) {
  if (!hook.params.provider) return;
  hook.params.query = { ...(hook.params.query || {}), _id: hook.params.user?._id };
}

/** Email the first confirmation code. A failed email must not undo the sign-up:
 * the app offers "send a new code". */
async function afterSignup(hook: HookContext) {
  if (!hook.params.provider) return;
  try {
    await sendVerificationCode(hook.app, hook.result);
  } catch (e) {
    console.warn("[users] sign-up confirmation email failed", e);
  }
}

/** Deleting an account deletes what it owns. */
async function afterRemove(hook: HookContext) {
  const id = hook.result?._id;
  if (!id) return;
  await (db as any).ArComment.deleteMany({ user: id }).catch((e: any) => console.warn("[users] comment cleanup failed", e));
}

export const hooks = {
  before: {
    get: [iff(isProvider("external"), authentication.authenticate("jwt"), ownAccountOnly)],
    find: [iff(isProvider("external"), authentication.authenticate("jwt"), ownAccountOnly)],
    create: [prepareSignup, local.hooks.hashPassword("password")],
    patch: [iff(isProvider("external"), authentication.authenticate("jwt"), ownAccountOnly), preparePatch],
    update: disallow("external"),
    remove: [iff(isProvider("external"), authentication.authenticate("jwt"), ownAccountOnly)],
  },
  after: {
    all: [iff(isProvider("external"), local.hooks.protect(...PRIVATE_FIELDS))],
    create: [afterSignup],
    patch(hook: HookContext) {
      if (hook.params.user) _.assign(hook.params.user, _.omit(hook.result, PRIVATE_FIELDS));
    },
    remove: [afterRemove],
  },
};
