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

export const authAdminOnly = {
  before: {
    all(hook: HookContext) {
      if (!hook.params.provider) return;
      if (!hook.params.user || hook.params.user.role !== "admin") {
        throw new errors.BadRequest("No permission: " + hook.path);
      }
    },
  },
};

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
