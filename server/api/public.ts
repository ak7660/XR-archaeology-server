import feather from "../feathers/feathers";
import configs from "@configs";
import { HookContext } from "@feathersjs/feathers";
import { requireContext } from "../utils/webpack";
import { AppJWTStrategy } from "../feathers/appJwt";
import { clientIp, enforce, MINUTE, reset } from "../feathers/rateLimit";
import { normaliseEmail } from "../feathers/appAccounts";
const services = requireContext("./server/api/public/", true, /\.(js|ts)$/);

/**
 * The public API: what the mobile app talks to. App users sign in here, with a
 * secret (APP_SECRET) separate from the admin API's, so an app user's token is
 * never accepted by the admin API. Content collections are read-only here.
 */
export default () => {
  const app = feather("public", services, null, {
    auth: {
      secret: configs.app.secret,
      local: true,
      jwt: { customClass: AppJWTStrategy },
    },
    rest: true,
    socketio: true,
    api: {
      // Anything without its own hooks is read-only for outside callers.
      defaultHooks: "readOnlyHooks",
    },
    // Serves images to the app; nobody uploads through the public API.
    attachments: { canUpload: false },
  });

  app.service("authentication").hooks({
    before: {
      create: [limitPasswordSignIn],
    },
    after: {
      create: [recordSignIn],
    },
  });
  return app;
};

/** Emails are stored lower-case; slow down password guessing per address and per network. */
function limitPasswordSignIn(hook: HookContext) {
  if (!hook.params.provider || hook.data?.strategy !== "local") return;
  hook.data.email = normaliseEmail(hook.data.email);
  enforce(`signin-email:${hook.data.email}`, 10, 15 * MINUTE, "Too many sign-in attempts for this account. Please wait 15 minutes or reset your password.");
  enforce(`signin-ip:${clientIp(hook.params)}`, 50, 15 * MINUTE, "Too many sign-in attempts from this network. Please wait 15 minutes.");
}

async function recordSignIn(hook: HookContext) {
  if (hook.data?.strategy !== "local" || !hook.result?.user?._id) return;
  reset(`signin-email:${hook.data.email}`);
  await hook.app
    .service("users")
    .patch(hook.result.user._id, { lastLoginAt: new Date() })
    .catch((e: any) => console.warn("[auth] could not record sign-in", e));
}
