/**
 * JWT strategy for app users on the public API.
 *
 * Tokens are long-lived (the app keeps you signed in), so a password reset or
 * change needs a way to end the sessions issued before it: any token older than
 * the user's `passwordChangedAt` is refused. A deleted account's tokens stop
 * working because the user can no longer be loaded.
 */
import { JWTStrategy } from "@feathersjs/authentication";
import { Params } from "@feathersjs/feathers";
import * as errors from "@feathersjs/errors";

export class AppJWTStrategy extends JWTStrategy {
  async authenticate(authentication: any, params: Params) {
    let result: any;
    try {
      result = await super.authenticate(authentication, params);
    } catch (e: any) {
      // The account was deleted: that is "signed out", not "not found".
      if (e?.code === 404) throw new errors.NotAuthenticated("This account no longer exists.");
      throw e;
    }
    const changedAt = result.user?.passwordChangedAt ? new Date(result.user.passwordChangedAt).getTime() : 0;
    const issuedAt = (result.authentication?.payload?.iat || 0) * 1000;
    if (changedAt && issuedAt < changedAt) {
      throw new errors.NotAuthenticated("Your session has ended. Please sign in again.");
    }
    return result;
  }
}
