/**
 * This file starts feathersjs app for server
 */

import express, { Router } from "express";
import { RequireContext } from "./feathers";
import { Application } from "@feathersjs/feathers";
import _ from "lodash";
import { cors } from "@feathersjs/express";
import http from "http";
import https from "https";
import dbInit, { setSchema } from "./db";
import configs, { type ServerDef } from "@configs";
import readline from "readline";

function createServer<T = any>(servers: RequireContext, item: ServerDef) {
  const s = servers ? servers(item.source) : null;
  const mapi: Application<T> & Router & { setup(http) } = s ? s.default(item.internal) : null;

  const app = express();

  const whitelist = _.map(configs.servers, (v, k) => configs.getUrl(k));
  // Add allowed origins from environment variable (comma-separated)
  if (process.env.CORS_ORIGINS) {
    whitelist.push(...process.env.CORS_ORIGINS.split(",").map((s) => s.trim()));
  }
  if (process.env.NODE_ENV === "production" && !item.corsAny) {
    console.log("CORS WhiteList", whitelist.join());
    app.use(
      "/api/",
      cors({
        origin: function (origin, callback) {
          console.log("CORS origin check:", origin);
          if (whitelist.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
          } else {
            console.warn("CORS blocked origin:", origin);
            callback(new Error("Not allowed by CORS"));
          }
        },
        allowedHeaders: ["Authorization", "Content-Type", "X-Requested-With"],
        credentials: true,
      })
    );
  } else {
    app.use(cors());
  }

  app.set("port", configs.port);

  if (mapi) {
    app.use("/api", function (req, res, next) {
      req.basepath = "/api";
      mapi(req, res, next);
    });
  }
  // production error handler
  // no stacktraces leaked to user
  app.use(function (err, req, res, next) {
    res.status(err.code || err.status || 500);
    res.send({
      message: err.message,
      error: {},
    });
  });

  return { app, api: mapi, item };
}
interface SchemaOpts {
  schema?: RequireContext | RequireContext[];
  mixins?: RequireContext;
}

function ask(q: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(q, (a) => {
      rl.close();
      resolve(a);
    });
  });
}

async function startServer(servers: RequireContext) {
  // Start MongoDB connection
  await dbInit();

  const dict: {
    [key: string]: {
      app: express.Express;
      api: Application<any> & Router & { setup(http) };
      item: ServerDef;
      http?: http.Server;
      https?: https.Server;
    };
  } = _.fromPairs(
    _.filter(
      _.map(configs.servers, (item, name) => {
        if (item.type === "next") return;
        return [name, createServer(servers, item)];
      }),
      (it) => !!it
    )
  );

  if (process.env.INIT_ADMIN) {
    const email = await ask("Email: ");
    const password = await ask("Password: ");

    console.log(`creating, ${email} / ${password}`);
    const server = dict.api;
    let user = (
      await server.api.service("users").find({
        query: { email },
        paginate: false,
      })
    )[0];
    if (user) {
      console.log(`replacing, ${email} / ${password}`);
      await server.api.service("users").patch(user._id, {
        password: password,
        role: "admin",
      });
    } else {
      await server.api.service("users").create({
        name: "Admin",
        email,
        password,
        role: "admin",
      });
    }

    console.log("done");
    // process.exit();
  }

  _.each(dict, (server, name) => {
    if (+configs.getPort(name) === -1) {
      console.log(`Skipping server ${name}`);
      return;
    }
    if (configs.getMode(name) === "https") {
      const s = https.createServer(configs.getTlsInfo(name), server.app);
      s.listen(configs.getPort(name));
      server.api.setup(s);
      server.https = s;
    } else {
      const s = http.createServer(server.app);
      s.listen(configs.getPort(name));
      server.api.setup(s);
      server.http = s;
    }

    console.log(`Listening ${name} at ${configs.getUrl(name)} ${configs.getPort(name)}`);
  });
  return dict;
}

export default function (
  servers: RequireContext,
  { schema, mixins }: SchemaOpts = {},
  fn?: (servers: {
    [key: string]: {
      app: express.Express;
      api: Application<any> & Router & { setup(http) };
      item: ServerDef;
      http?: http.Server;
      https?: https.Server;
    };
  }) => void
) {
  if (schema) {
    console.log("Start setting schema");
    setSchema(schema, mixins);
  } else {
    console.log("Start in no DB mode");
  }
  startServer(servers)
    .then((servers) => {
      console.log("Server started");
      return fn?.(servers);
    })
    .catch((e) => {
      console.log(e);
      process.exit(1);
    });
}
