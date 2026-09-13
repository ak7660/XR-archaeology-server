/*
 * This file registered feathersjs app for server
 */

import { feathers } from "@feathersjs/feathers";
import express, { rest } from "@feathersjs/express";
import socketio from "@feathersjs/socketio";
import bodyParser from "body-parser";
import compress from "compression";
import { RequestHandler } from "express";
import { Socket } from "socket.io";
import _ from "lodash";
import handler, { type ApiOpts } from "./handler";
import dbInit, { db, DB, schemas } from "./db";
import attachments, { AttachmentOpts } from "./attachments";
import { SchemaDef } from "./schema";
import { MongoClient } from "mongodb";
import mongoose, { Mongoose } from "mongoose";
import auth, { AuthOpts } from "./auth";

declare module "@feathersjs/feathers" {
  interface Application<Services = any, Settings = any> {
    _services: Services;
    appName: string;
    schemas: {
      [key: string]: SchemaDef;
    };
    models: DB;
    mdb: MongoClient;
    db: Mongoose;
  }
}
interface RestOpts {
  limit: string;
}

export type { ApiOpts } from "./handler";

export interface FeathersOpts {
  auth?: boolean | AuthOpts;
  attachments?: boolean | AttachmentOpts;
  rest?: boolean | RestOpts;
  socketio?:
    | boolean
    | {
        path?: string;
        use?: (socket: Socket, fn: (err?: any) => void) => void;
      };
  api?: ApiOpts;
  before?: RequestHandler;
  internal?: boolean;
  bodyVerifier?(req: Request, res: Response, buf: Buffer, encoding: string): void;

  sessionInherits?: (
    | string
    | {
        path: string;
        debugLog?: (v: any) => any;
      }
  )[];
}

export interface RequireContext {
  keys(): string[];
  (file: any): any;
}

export default function (
  name: string,
  services: RequireContext | (RequireContext | [RequireContext, any])[],
  mixins?: RequireContext,
  props: FeathersOpts = {}
) {
  const app = express(feathers());
  app.appName = name;
  app.schemas = schemas;
  app.models = dbInit;
  app.mdb = db;
  app.db = mongoose;

  const restOpts = props.rest && _.assign({ limit: "50mb" }, props.rest);

  // Turn on JSON parser for REST services
  app
    .use(compress())
    .use(bodyParser.json({ limit: restOpts.limit }))
    .use(bodyParser.urlencoded({ extended: true, limit: restOpts.limit }))
    .use(bodyParser.text({ type: ["text/html", "application/xml"], limit: restOpts.limit }));

  if (props.before) app.use(props.before);

  // Register attachments service
  if (props.attachments) app.configure(<any>attachments(typeof props.attachments === "object" ? props.attachments : {}));
  // Register REST service handler
  if (props.rest) {
    app.configure(
      rest(function (req, res, next) {
        if (res.data && res.data.$status) {
          res.status(res.data.$status);
          delete res.data.$status;
        }
        if (!res.data) {
          res.format({
            "application/json": function () {
              res.end(JSON.stringify(res.data));
            },
          });
        }
        // Format the message as text/plain
        if (typeof res.data === "string") {
          res.format({
            "text/plain": function () {
              res.end(res.data);
            },
            "application/json": function () {
              res.end(JSON.stringify(res.data));
            },
          });
        } else if (res.data instanceof Buffer) {
          const mime = (<any>res.data).mime;
          res.format({
            [mime]: function () {
              if (res.data.cache) res.setHeader("Cache-Control", res.data.cache);
              res.end(res.data);
            },
          });
        } else if (res.data.$redirect) {
          if (res.data.$cache) res.setHeader("Cache-Control", res.data.$cache);
          res.redirect(res.data.$status || 302, res.data.$redirect);
        } else if (res.data.$stream) {
          if (res.data.$mime) res.setHeader("Content-Type", res.data.$mime);
          if (res.data.$filename) res.attachment(res.data.$filename);
          res.data.$stream.pipe(res);
        } else if (res.data.$html) {
          res.format({
            "text/html": function () {
              res.end(res.data.$html);
            },
          });
        } else {
          res.format({
            "application/json": function () {
              res.end(JSON.stringify(res.data));
            },
          });
        }
      })
    );
  }
  // Configure Socket.io real-time APIs
  if (props.socketio) {
    const sockOpts = typeof props.socketio === "object" ? props.socketio : {};
    app.configure(
      socketio({ path: sockOpts.path || "/api/socket.io", ...sockOpts }, (io) => {
        const maxListen =
          _.sumBy(Array.isArray(services) ? services : [services], (ctx) => (Array.isArray(ctx) ? ctx : [ctx])[0].keys().length) +
          _.keys(_.get(dbInit, "_services." + name, {})).length;
        io.sockets.setMaxListeners(maxListen + 32);

        io.on("connection", function (socket) {
          Object.assign((<any>socket).feathers, { headers: socket.handshake.headers });
          (<any>socket).feathers.ip =
            socket.handshake.headers["cf-connecting-ip"] ||
            socket.handshake.headers["x-real-ip"] ||
            socket.handshake.headers["x-forwarded-for"] ||
            socket.conn.remoteAddress;
          (<any>socket).feathers.internal = props.internal || false;

          socket.once("disconnect", function () {
            app.emit("disconnect", (<any>socket).feathers);
          });
        });
        if (sockOpts.use) {
          io.use(sockOpts.use);
        }
      })
    );
  }
  if (props.auth) app.configure(auth(typeof props.auth === "object" ? props.auth : {}));
  if (props.rest) {
    app.configure((app) => {
      app.use(function (req, res, next) {
        req.feathers.ip = req.headers["cf-connecting-ip"] || req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || req.ip;
        req.feathers.request = {};
        Object.defineProperty(req.feathers.request, "value", {
          enumerable: false,
          value: req,
        });
        req.feathers.internal = props.internal || false;
        next();
      });
    });
  }

  app.configure(handler(name, services, mixins, props.api));
  return app;
}
