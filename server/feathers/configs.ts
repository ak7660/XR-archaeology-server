import fs from "fs";
import os from "os";
import crypto from "crypto";
import _ from "lodash";
import { loadAdminPagePrepath } from "@/env/load";

/** Value left in config.json where a real secret used to be committed. */
const PLACEHOLDER_SECRET = "set-via-APP_SECRET-and-WEB_SECRET-env-vars";

const mpackage = (fs.existsSync("./package.json") && JSON.parse(fs.readFileSync("./package.json").toString())) || {
  name: "app",
};
let hostname: string;
let ip: string = "localhost";
let mongoHost: string = "localhost";
let mongoParams: string = "?replicaSet=rs0";

let nodeId: string = process.env.NODE_ID || os.hostname();

export interface ServerDef {
  type: "api" | "next" | "nextapi";
  source: string;
  port: number | string;
  internal?: boolean;
  nextStatic?: string;
  nextSource?: string;
  exclude?: string[] | string;
  proxy?: boolean;
  corsAny?: boolean;
}

/**
 * Returns env configuration.
 *
 * If there is no specific config.json in .env, it uses default config.json
 * in the root directory.
 */
class config {
  _opts: any;
  [key: string]: any;
  servers: {
    [name: string]: ServerDef;
  };
  constructor(opts) {
    this._opts = opts || {};
    _.extend(this, opts);

    // JWT signing secrets come from the environment, never from config.json.
    //
    // config.json is committed, so any secret written there is readable by
    // anyone with repo access - and these two sign the auth tokens for the
    // admin API (web) and the public/app API (app). They are set as APP_SECRET
    // and WEB_SECRET in the deployment environment.
    //
    // The values still in config.json are inert placeholders kept only so the
    // shape of the file is obvious; startup refuses to use them (see below).
    if (process.env.APP_SECRET) {
      this.app = _.assign({}, this.app, { secret: process.env.APP_SECRET });
    }
    if (process.env.WEB_SECRET) {
      this.web = _.assign({}, this.web, { secret: process.env.WEB_SECRET });
    }

    for (const [name, envVar] of [
      ["app", "APP_SECRET"],
      ["web", "WEB_SECRET"],
    ] as const) {
      const secret = this[name]?.secret;
      if (!secret || secret === PLACEHOLDER_SECRET) {
        const message = `Missing ${envVar}. Set it in the environment - config.json no longer carries a usable ${name} secret.`;
        // Failing fast in production beats silently signing tokens with a
        // publicly known value.
        if (process.env.NODE_ENV === "production") throw new Error(message);
        console.warn(`[config] ${message} Falling back to an ephemeral development secret.`);
        this[name] = _.assign({}, this[name], { secret: crypto.randomBytes(32).toString("hex") });
      }
    }
  }

  get mongodb() {
    return process.env.MONGO_URL || `mongodb://${mongoHost}/${mpackage.name}${mongoParams}`;
  }

  get attachments() {
    return _.merge({}, this._opts.attachments, {
      storage: process.env.ATTACHMENTS_DIR,
    });
  }

  get prod() {
    return process.env.NODE_ENV === "production";
  }

  get dev() {
    return process.env.NODE_ENV !== "production";
  }

  get proto() {
    // FIXME: this is a temporary fix
    if (loadAdminPagePrepath()?.protocol) {
      return loadAdminPagePrepath().protocol;
    }
    return this.prod || hostname || process.env.FORCE_HTTPS ? "https" : "http";
  }

  get nodeId() {
    return nodeId;
  }

  has(name: string): boolean {
    return !!_.get(this.servers, name);
  }

  getConfig(name: string): any {
    return _.get(this.servers, name) || {};
  }

  getUrl(name: string) {
    const config = this.getConfig(name);
    // FIXME: check
    // if (config.internal) {
    //   return `http://${this.getHost(name)}`;
    // }
    if (this.getMode(name) === "https") {
      return `https://${this.getHost(name)}`;
    }
    return `${this.proto}://${this.getHost(name)}`;
  }

  getPort(name: string): string {
    const host = `PORT_${name.toUpperCase()}`;
    if (process.env[host]) return process.env[host];

    const config = this.getConfig(name);
    if (config.port) return config.port;

    throw new Error(`Missing ${host} in env or config`);
  }

  getHost(name: string): string {
    const config = this.getConfig(name);
    const host = `HOST_${name.toUpperCase()}`;
    // highest piority
    if (loadAdminPagePrepath()?.host) {
      return loadAdminPagePrepath().host;
    }
    if (process.env[host]) return process.env[host];
    if (config.internal) {
      const p = this.getPort(name);
      return `localhost:${p}`;
    }
    if (config.host) {
      if (this.getMode(name) === "https") {
        return `${config.host}${!config.port || config.port == 443 ? ":" + config.port : ""}`;
      }
      return config.host;
    } else if (process.env.NODE_ENV !== "production") {
      const p = this.getPort(name);
      if (hostname) return `${hostname}${p}.testserverhk.com`;
      return `${ip}:${p}`;
    } else {
      if (config.host) return config.host;
    }
    throw new Error(`Missing ${host} in env or config`);
  }

  getTlsInfo(name: string) {
    const config = this.getConfig(name);
    const key = `KEY_${name.toUpperCase()}`;
    const cert = `CERT_${name.toUpperCase()}`;

    return {
      key: fs.readFileSync(process.env[key] || config.key),
      cert: fs.readFileSync(process.env[cert] || config.cert),
    };
  }

  getMode(name: string) {
    const config = this.getConfig(name);
    const mode = `MODE_${name.toUpperCase()}`;
    return process.env[mode] || config.mode;
  }
}
if (process.env.CONFIG_FILE) {
  console.log(`Using config file ${process.env.CONFIG_FILE}`);
}

export const def = new config(JSON.parse(fs.readFileSync(process.env.CONFIG_FILE || "./config.json").toString()));
export default def;
