import { AuthenticationBaseStrategy, AuthenticationRequest, AuthenticationService, JWTStrategy } from "@feathersjs/authentication";
import { LocalStrategy } from "@feathersjs/authentication-local";
import { Application, Params } from "@feathersjs/feathers";
import * as errors from "@feathersjs/errors";
import _ from "lodash";
import configs from "@configs";
import moment from "moment";

export interface AuthOpts {
  secret?: string;
  cookie?: boolean;
  local?: boolean | any;
  reset?: boolean | any;
  domain?: string;

  oauth?: (
    | string
    | {
        name: string;
      }
  )[];
  internal?: boolean;
  jwt?:
    | boolean
    | {
        [key: string]: any;
      };
  authChannel?: string;
  dbUserPath?: string;
}

export class InternalStrategy extends AuthenticationBaseStrategy {
  get configuration() {
    const authConfig = this.authentication.configuration;
    const config = super.configuration || {};

    return {
      entity: authConfig.entity,
      entityId: authConfig.entityId,
      errorMessage: "Invalid login",
      entityPasswordField: config.passwordField,
      entityUsernameField: config.usernameField,
      ...config,
    };
  }

  async authenticate(data: AuthenticationRequest, params: Params) {
    const { passwordField, usernameField, entity } = this.configuration;
    const username = data[usernameField];
    const password = data[passwordField];

    const config = _.get(configs.internal, username);

    if (!config || config.password !== password) {
      throw new errors.NotAuthenticated("Bad password or username");
    }
    params.connection.internal = true;
    return {
      authentication: { strategy: this.name },
      [entity]: {
        _id: null,
        id: username,
        internal: true,
      },
    };
  }
}

export class ResetStrategy extends AuthenticationBaseStrategy {
  get configuration() {
    const authConfig = this.authentication.configuration;
    const config = super.configuration || {};

    return {
      entity: authConfig.entity,
      entityId: authConfig.entityId,
      service: authConfig.service,
      errorMessage: "Invalid login",
      entityPasswordField: config.passwordField,
      entityUsernameField: config.usernameField,
      ...config,
    };
  }

  async authenticate(data: AuthenticationRequest, params: Params) {
    const { passwordField, usernameField, service, entity, entityUsernameField } = this.configuration;
    const username = data[usernameField];
    const password = data[passwordField];

    let user = (
      await this.app.service(service).find({
        query: {
          [entityUsernameField]: username,
        },
        paginate: false,
        headers: params.headers,
        connection: params.connection,
      })
    )[0];

    const err = [
      null,
      {
        reason: "error",
        message: "Bad password or username",
      },
    ];

    if (user) {
      if (moment.duration(moment().diff(user.resetTime || 0)).asSeconds() > 24 * 60 * 60) {
        throw new errors.NotAuthenticated("Bad password or username");
      }

      if (user.resetTrial > 5) {
        throw new errors.NotAuthenticated("Bad password or username");
      }

      if (user.resetToken !== password) {
        await this.app.service(service).patch(
          user._id,
          {
            $inc: {
              verifyTrial: 1,
            },
          },
          {
            headers: params.headers,
            connection: params.connection,
          }
        );
        throw new errors.NotAuthenticated("Bad password or username");
      }

      user = await this.app.service(service).patch(
        user._id,
        {
          resetRequired: true,
          resetToken: null,
        },
        {
          headers: params.headers,
          connection: params.connection,
        }
      );

      return {
        authentication: { strategy: this.name },
        [entity]: user,
      };
    } else {
      throw new errors.NotAuthenticated("Bad password or username");
    }
  }
}

export class OAuthStrategy extends AuthenticationBaseStrategy {
  get configuration() {
    const authConfig = this.authentication.configuration;
    const config = super.configuration || {};

    return {
      entity: authConfig.entity,
      entityId: authConfig.entityId,
      errorMessage: "Invalid login",
      entityPasswordField: config.passwordField,
      entityUsernameField: config.usernameField,
      ...config,
    };
  }

  async authenticate(data: AuthenticationRequest, params: Params) {
    const { service, entity } = this.configuration;

    const user = await this.app.service(service).create(data, {
      headers: params.headers,
      connection: params.connection,
    });

    return {
      authentication: { strategy: this.name },
      [entity]: user,
    };
  }
}

export class AnonymousStrategy extends AuthenticationBaseStrategy {
  async authenticate(data: AuthenticationRequest, params: Params) {
    return {
      anonymous: true,
    };
  }
}

export default function (auth: AuthOpts) {
  return function (this: Application) {
    const app = this;
    const strategies: string[] = [];
    const authOpts: any = {
      secret: auth.secret,
      entity: "user",
      entityId: "_id",
      service: "users",
    };

    const initAuth: ((auth: AuthenticationService) => void)[] = [];

    if (auth.local) {
      authOpts.local = _.assign(
        {
          usernameField: "email",
          passwordField: "password",
          entityId: "_id",
          entity: "user",
        },
        typeof auth.local === "object" ? auth.local : {}
      );
      strategies.push("local");
      initAuth.push((authentication) =>
        authentication.register("local", auth.local?.customClass ? new auth.local.customClass() : new LocalStrategy())
      );
    }

    if (auth.jwt) {
      let customClass: any;
      if (typeof auth.jwt === "object" && auth.jwt.customClass) {
        customClass = auth.jwt.customClass;
        delete auth.jwt.customClass;
      }
      authOpts.jwtOptions = _.assign(
        {
          header: { typ: "access" },
          issuer: "feathers",
          audience: auth.domain || process.env.DEFAULT_JWT_DOMAIN || "",
          algorithm: "HS256",
          expiresIn: "1y",
        },
        typeof auth.jwt === "object" ? auth.jwt : {}
      );

      strategies.push("jwt");
      initAuth.push((authentication) => authentication.register("jwt", customClass ? new customClass() : new JWTStrategy()));
    }

    if (auth.internal) {
      authOpts.internal = _.assign(
        {
          usernameField: "username",
          passwordField: "password",
          entityId: "_id",
          entity: "user",
        },
        typeof auth.internal === "object" ? auth.internal : {}
      );
      strategies.push("internal");
      initAuth.push((authentication) => authentication.register("internal", new InternalStrategy()));
    }

    if (auth.reset) {
      authOpts.reset = _.assign(
        {
          usernameField: "email",
          passwordField: "password",
          entityId: "_id",
          entity: "user",
          service: "users",
        },
        typeof auth.reset === "object" ? auth.reset : {}
      );
      strategies.push("reset");
      initAuth.push((authentication) => authentication.register("reset", new ResetStrategy()));
    }

    if (auth.oauth) {
      for (let oauth of auth.oauth) {
        const oauthOpts =
          typeof oauth === "string"
            ? {
                name: oauth,
              }
            : oauth;
        authOpts[oauthOpts.name] = _.assign(
          {
            entityId: "_id",
            entity: "user",
            service: `users/${oauthOpts.name}/login`,
          },
          typeof auth.internal === "object" ? auth.internal : {}
        );
        strategies.push(oauthOpts.name);
        initAuth.push((authentication) => authentication.register(oauthOpts.name, new OAuthStrategy()));
      }
    }
    authOpts.authStrategies = strategies;

    app.set("authentication", authOpts);

    app.on("connection", (connection) => {
      app.channel("anonymous").join(connection);
    });

    app.on("login", (payload, { connection }) => {
      if (connection) {
        if (connection._login) return;
        const { user } = connection;
        if (user) {
          connection._login = true;
          if (user.internal) {
            connection.internal = true;
            app.channel("internal").join(connection);
          } else {
            app.channel(auth.authChannel || "authenticated").join(connection);
          }
        }
      }
    });

    app.on("logout", (payload, { connection }) => {
      if (connection) {
        if (!connection._login) return;
        delete connection._login;
        if (connection.internal) {
          app.channel("internal").leave(connection);
          connection.internal = false;
        } else {
          app.channel(auth.authChannel || "authenticated").leave(connection);
        }
      }
    });

    const authentication = new AuthenticationService(app);

    _.each(initAuth, (func) => func(authentication));

    app.use("/authentication", authentication);
    app.service("authentication").hooks({
      before: {
        remove(hook) {
          if (!hook.params.authentication) {
            hook.result = {};
          }
        },
      },
      after: {
        create(hook) {
          if (hook.params?.connection) {
            // Deliberately NOT `connection.authenticated = true`: that flag makes the
            // authenticate hook skip every later call on this socket, so the user
            // stayed frozen as it was at sign-in (an email confirmed afterwards still
            // read as unconfirmed; a password change or deleted account didn't end
            // the session). Feathers keeps the token on `connection.authentication`,
            // and each call re-checks it and loads the user fresh.
            hook.params.connection.user = hook.result.user;

            app.emit("login", hook.result, hook.params);
          }
        },
        remove(hook) {
          (hook.params as any).user = null;
          if (hook.params.connection) {
            hook.params.connection.user = null;
            hook.params.connection.authentication = null;
            hook.params.connection.authenticated = false;

            app.emit("logout", hook.result, hook.params);
          }
          hook.result = {};
        },
      },
    });
  };
}
