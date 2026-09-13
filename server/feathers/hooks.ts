/**
 * This file stores common hooks for feathers querying
 *
 * Guides of hooks: https://feathersjs.com/guides/basics/hooks.html
 * APIs Doc of hooks: https://feathersjs.com/api/hooks
 */

import { disallow } from "feathers-hooks-common";
import * as authentication from "@feathersjs/authentication/lib";
import { Application, HookContext } from "@feathersjs/feathers";
import * as errors from "@feathersjs/errors";
import * as local from "@feathersjs/authentication-local";

export const internalHooks = {
  before: {
    all: disallow("external"),
  },
};

export const readOnlyHooks = {
  before: {
    create: disallow("external"),
    update: disallow("external"),
    patch: disallow("external"),
    remove: disallow("external"),
  },
};

export const readCreateOnlyHooks = {
  before: {
    update: disallow("external"),
    patch: disallow("external"),
    remove: disallow("external"),
  },
};

export const readRemoveOnlyHooks = {
  before: {
    create: disallow("external"),
    update: disallow("external"),
    patch: disallow("external"),
  },
};

export const createOnlyHooks = {
  before: {
    update: disallow("external"),
    patch: disallow("external"),
    remove: disallow("external"),
    find: disallow("external"),
    get: disallow("external"),
  },
};

export const getOnlyHooks = {
  before: {
    update: disallow("external"),
    patch: disallow("external"),
    remove: disallow("external"),
    find: disallow("external"),
    create: disallow("external"),
  },
};

export function authOnly(app: Application) {
  return {
    before: {
      all: authentication.authenticate("jwt"),
    },
  };
}

export function authAdminHooks(app: Application) {
  const jwt = authentication.authenticate("jwt");
  return {
    before: {
      get: [jwt],
      create: [
        jwt,
        (hook: HookContext) => {
          if (hook.params?.provider) {
            hook.data.admin = hook.data.modifiedBy = hook.params.user;
          }
        },
      ],
      find: [jwt],
      patch: [
        jwt,
        (hook: HookContext) => {
          if (hook.params?.provider) {
            hook.data.modifiedBy = hook.params.user;
            hook.data.modified = new Date();
          }
        },
      ],
      update: [
        jwt,
        (hook: HookContext) => {
          if (hook.params?.provider) {
            hook.data.admin = hook.params.user;
            hook.data.modifiedBy = hook.params.user;
            hook.data.modified = new Date();
          }
        },
      ],
      remove: [jwt],
    },
  };
}

/** Admins only. Authenticates itself: `before.all` hooks run ahead of any
 * method-level `authenticate`, so relying on another hook set to have loaded
 * `params.user` rejected even admins. */
export function authAdminOnly(app: Application) {
  return {
    before: {
      all: [
        authentication.authenticate("jwt"),
        (hook: HookContext) => {
          if (!hook.params.provider) return;
          if (!hook.params.user || hook.params.user.role !== "admin") {
            throw new errors.Forbidden("No permission: " + hook.path);
          }
        },
      ],
    },
  };
}

import { isStaff, STAFF_ROLES } from "./roles";
export { isStaff, STAFF_ROLES };
export { bookingAppHooks, bookingStaffHooks } from "./bookings";
export { plannerCleanup } from "./aiPlanner";

function requireRole(roles: string[]) {
  return (hook: HookContext) => {
    if (!isStaff(hook.params, roles)) {
      throw new errors.Forbidden("No permission: " + hook.path);
    }
  };
}

/**
 * Default for admin-API collections that declare no hooks of their own (see
 * `defaultHooks` in handler.ts): anyone may read, only signed-in CMS staff may
 * create, change or delete. Reads stay open because installed app builds still
 * load their content from the admin API.
 */
export function staffWrite(app: Application) {
  const jwt = authentication.authenticate("jwt");
  const staff = requireRole(STAFF_ROLES);
  return {
    before: {
      create: [jwt, staff],
      update: [jwt, staff],
      patch: [jwt, staff],
      remove: [jwt, staff],
    },
  };
}

/**
 * The `admins` collection holds CMS logins: only admins may list, read or change
 * them, passwords are hashed on the way in and never returned.
 */
export function adminAccountHooks(app: Application) {
  const jwt = authentication.authenticate("jwt");
  const admin = requireRole(["admin"]);
  const dropEmptyPassword = (hook: HookContext) => {
    if (hook.data && !hook.data.password) delete hook.data.password;
  };
  return {
    before: {
      all: [jwt, admin],
      create: [local.hooks.hashPassword("password")],
      update: [dropEmptyPassword, local.hooks.hashPassword("password")],
      patch: [dropEmptyPassword, local.hooks.hashPassword("password")],
    },
    after: {
      all: [local.hooks.protect("password")],
    },
  };
}

/** Public API: records that belong to the signed-in user (e.g. saved trip plans).
 * Reads and deletes are scoped to the caller; creating or changing them is left
 * to server code. */
export const ownRecordsReadRemove = {
  before: {
    find: [ownRecords],
    get: [ownRecords],
    remove: [ownRecords],
    create: disallow("external"),
    update: disallow("external"),
    patch: disallow("external"),
  },
};

function ownRecords(hook: HookContext) {
  if (!hook.params.provider) return;
  if (hook.method === "remove" && (hook.id === null || hook.id === undefined)) throw new errors.MethodNotAllowed();
  hook.params.query = { ...(hook.params.query || {}), user: hook.params.user?._id };
}

/** Admin API: admins may list, read and delete; nobody edits through the CMS. */
export function adminReadRemoveOnly(app: Application) {
  const jwt = authentication.authenticate("jwt");
  const admin = requireRole(["admin"]);
  return {
    before: {
      all: [jwt, admin],
      create: disallow("external"),
      update: disallow("external"),
      patch: disallow("external"),
    },
  };
}

/** The only parts of an app user that other people may see (e.g. beside a comment). */
export const PUBLIC_USER_FIELDS = "firstName lastName username avatar";

/**
 * Public API `arComments`: comments are signed in and belong to their author.
 * - create: the author is whoever is signed in, whatever the request says;
 * - patch/remove: only your own comments; update is not offered;
 * - reads: `$populate` of the author returns only PUBLIC_USER_FIELDS - a plain
 *   populate would hand every reader the commenter's email and password hash.
 */
export const arCommentOwnership = {
  before: {
    find: [limitAuthorPopulate],
    get: [limitAuthorPopulate],
    create(hook: HookContext) {
      if (!hook.params.provider) return;
      const data = { ...(hook.data || {}) };
      delete data._id;
      delete data.createdAt;
      hook.data = { ...data, user: hook.params.user?._id };
    },
    update: disallow("external"),
    patch: [ownCommentsOnly, (hook: HookContext) => {
      if (hook.params.provider && hook.data) {
        delete hook.data.user;
        delete hook.data._id;
      }
    }],
    remove: [ownCommentsOnly],
  },
};

function ownCommentsOnly(hook: HookContext) {
  if (!hook.params.provider) return;
  hook.params.query = { ...(hook.params.query || {}), user: hook.params.user?._id };
}

function limitAuthorPopulate(hook: HookContext) {
  if (!hook.params.provider) return;
  const q = hook.params.query || {};
  if (!q.$populate) return;
  const asked = (Array.isArray(q.$populate) ? q.$populate : [q.$populate]).map((p: any) => (typeof p === "string" ? p : p?.path));
  if (asked.includes("user")) q.$populate = [{ path: "user", select: PUBLIC_USER_FIELDS }];
  else delete q.$populate;
  hook.params.query = q;
}

/**
 * Hook for arReconstructions service that automatically populates location data
 * and merges location fields (latitude, longitude, images, route, order) into the root level.
 * This keeps the API response format identical to the original while using location references in MongoDB.
 */
export const arReconstructionWithLocation = {
  after: {
    async get(hook: HookContext) {
      if (hook.result && hook.result.location) {
        const location = await hook.app.service("locations").get(hook.result.location);
        if (location) {
          hook.result.latitude = location.latitude;
          hook.result.longitude = location.longitude;
          hook.result.images = location.images;
          hook.result.route = location.route;
          hook.result.order = location.order;
        }
      }
    },
    async find(hook: HookContext) {
      if (hook.result.data && Array.isArray(hook.result.data)) {
        await Promise.all(
          hook.result.data.map(async (record: any) => {
            if (record.location) {
              try {
                const location = await hook.app.service("locations").get(record.location);
                if (location) {
                  record.latitude = location.latitude;
                  record.longitude = location.longitude;
                  record.images = location.images;
                  record.route = location.route;
                  record.order = location.order;
                }
              } catch (error) {
                console.warn(`Failed to populate location ${record.location}:`, error);
              }
            }
          })
        );
      }
    },
  },
};
