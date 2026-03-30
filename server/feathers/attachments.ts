import { Application } from "@feathersjs/feathers";
import express, { Request, Response, NextFunction } from "express";
import _ from "lodash";
import path from "path";
import { v4 as uuid } from "uuid";
import multer, { StorageEngine } from "multer"; // for handling multipart/form-data requests
import { requireContext } from "../utils/webpack";
import configs from "@configs";
import { getID } from "./utils";
import cookieParser from "cookie-parser";

const storageEngines = requireContext("server/feathers/storages", true, /\.ts$/);

declare module "@feathersjs/feathers" {
  interface Application {
    // downloadFile(_id: string, type: "stream"): Promise<NodeJS.ReadableStream>;
    // downloadFile(_id: string, type: "buffer"): Promise<Buffer>;
    // downloadFile(_id: string): Promise<NodeJS.ReadableStream>;
    uploadFile(data: Buffer, mime?: string, root?: string, opts?: UploadOptions): Promise<InfoType>;
  }
}

export interface AttachmentOpts {
  storage?: string;
  internal?: boolean;
  root?: string | ((req: express.Request) => string);
  mime?: RegExp;
  thumbRequired?: boolean;
  mipmaps?:
    | boolean
    | {
        sizes?: number[]; // 400, 800, 1200, 2000
        formats?: string[]; // defaults to same/webp
      };
  userContent?: boolean;
  hooks?: any;
}

export interface UploadOptions {
  parent?: string;
  meta?: any;
  user?: string;
  hash?: string;
  userContent?: boolean;
  extra?: any;
  query?: any;
  accessToken?: string;
  name?: string;
}

type Attachment = {
  _id?: string;
  path: string;
  dir: string;
  name: string;
  size: number; //file size
  mime: string; // file mime
  type: string;
  source: string;
  parent: string;
  date: Date;
  userContent: boolean;

  thumb: Buffer;
  thumbWebp: Buffer;

  width: number; // image width
  height: number; // image height
  duration: number; // video duration

  sizes: {
    format: string;
    width: number;
    height: number;
    src: string; // optimized file
  }[];

  meta: any;
  status: string;
  src: string;
  hash: string;

  modified: Date;
};

export type InfoType = Partial<Attachment> & {
  [key: string]: any;
};

export interface AttachmentStorage {
  storage: StorageEngine;
  updateInfo(info: InfoType): Promise<void>;
  handleImage?(
    req: Request,
    res: Response,
    info: InfoType,
    opts: {
      size?: string;
      acceptWebp?: boolean;
    }
  ): Promise<boolean>;
  upload(
    path: string,
    data: Buffer,
    mime: string
  ): Promise<{
    [key: string]: any;
  }>;
}

export function getFileTypeFromMime(mime: string) {
  const type = (mime?.split("/") ?? [""])[0];
  return ["image", "video", "audio", "model"].includes(type) ? type : "others";
}

export function findSize(sizes: InfoType["sizes"], size: string, acceptWebp?: boolean): InfoType["sizes"][0] {
  let result: InfoType["sizes"][0];
  let maxSize = Math.max(1, ["small", "medium", "large", "exlarge", "exlarge"].lastIndexOf(size) + 1) * 400;
  if (acceptWebp) {
    _.each(sizes, (size) => {
      if (size.src && acceptWebp && size.width <= maxSize && size.format === "webp" && (!result || size.width > result.width)) result = size;
    });
  }
  if (result) return result;
  _.each(sizes, (size) => {
    if (size.src && size.width <= maxSize && size.format !== "webp" && (!result || size.width > result.width)) result = size;
  });
  return result;
}

export default (opts: AttachmentOpts) =>
  function (this: Application & express.Express) {
    const app = this;

    const storageType = opts.storage || configs.storage || "gridfs";
    const storage: AttachmentStorage = storageEngines(`./${storageType}.ts`).default(opts, app);
    if (opts.mipmaps === true) opts.mipmaps = {};
    opts.mipmaps = _.assign(
      {
        sizes: [400, 800, 1200, 2000],
        formats: ["same", "webp"],
      },
      opts.mipmaps
    );

    var upload = multer({
      storage: storage.storage,
      limits: {
        fileSize: 1024 * 1024 * 256,
        files: 1,
      },
    });

    function wrap(fn: (req: Request, res: Response, next?: NextFunction) => Promise<void>) {
      return (req: Request, res: Response, next?: NextFunction) => {
        const routePromise = fn(req, res, next);
        if (routePromise.catch) {
          routePromise.catch((err) => next(err));
        }
      };
    }

    async function handleUpload(
      path: string,
      filename: string,
      mime: string,
      size: number,
      { parent, meta, user, hash, userContent, extra, query, accessToken }: UploadOptions
    ) {
      const detectedType = getFileTypeFromMime(mime);
      const requestedType = query?.type;
      const type = requestedType === "image" || requestedType === "model" ? requestedType : detectedType;

      let info: InfoType = {
        type,
        path,
        name: filename,
        size,
        mime,
        parent,
        date: new Date(),
        meta: meta || {},
        ...(user
          ? {
              user: user,
            }
          : {}),
        hash: hash,
        status: "normal",
        userContent,
        ...extra,
      };
      // update info
      await storage.updateInfo(info);

      // Create data in db.attachments.
      let resp = await app.service("attachments").create({
        ...query,
        ...info,
      });
      // TODO handle svg, video and wavefront file

      return resp;
    }

    app.uploadFile = async (data, mime, root, opts) => {
      const n = uuid();
      root = path.join(root, n);
      try {
        const result = await storage.upload(root, data, mime);
        const resp = await handleUpload(root, n, mime, data.length, {
          extra: result,
          ...opts,
        });
        return resp;
      } catch (error) {
        console.log("feather setup upload failed", error);
      }
    };

    const fileUploader = wrap(async function (req, res, next) {
      const file = req.file;
      console.log(req.file);
      try {
        const result = await storage.upload(`${uuid()}/${file.originalname}`, file.buffer, file.mimetype);
        const resp = await handleUpload(file.path, file.originalname, file.mimetype, file.size, {
          parent: req.params.id,
          meta: (<any>file).meta || {},
          user: <any>getID((<any>req).user),
          hash: req.query.hash || (<any>file).hash,
          userContent: req.query.userContent || opts.userContent ? true : false,
          extra: {
            url: (<any>file).url,
            id: (<any>file).id || result.id,
          },
          query: _.omit(req.query, "token"),
          accessToken: req.headers.authorization ? req.headers.authorization.substring(7) : <string>req.query.token || "",
        });
        res.send({ status: true, info: resp });
      } catch (e) {
        console.warn(e);
        try {
          await new Promise<void>((resolve, reject) => {
            storage.storage._removeFile(req, file, (err) => (err ? reject(err) : resolve()));
          });
        } catch (e) {
          console.warn(e);
        }
        next(e);
      }
    });

    var router = express.Router();

    // Register POST API for attachments
    router.post("/upload", upload.single("file"), fileUploader);
    router.post("/upload/:source", upload.single("file"), fileUploader);
    router.post("/upload/:source/:id", upload.single("file"), fileUploader);

    app.use("/attachments", router);

    // Register GET API for attachments.
    // feathersId, rather than id, is to prevent the conflict from feathers-mongoose service
    app.get("/attachments/:feathersId", async (req: Request, res: Response, next: NextFunction) => {
      let id = req.params.feathersId;
      let acceptWebp = false;
      let size: string;
      if (path.extname(id)) {
        const ext = path.extname(id);
        id = path.basename(id, ext);
        if (ext === ".webp") acceptWebp = true;
      }
      if (path.extname(id)) {
        const ext = path.extname(id);
        id = path.basename(id, ext);
        size = ext.substring(1);
      }
      try {
        const img = await app.service("attachments").get(id, {
          query: {
            $select: ["thumb", "src", "sizes", "mime", "type", "size"],
          },
        } as const);

        if (!img) {
          res.status(404).send("Attachment not found");
          return;
        }

        if (img.thumb && !img.src) {
          res.set("Cache-Control", "public, max-age=31557600");
          res.header("Content-Type", img.mime || "image/png");
          res.send(img.thumb.buffer ? img.thumb.buffer : img.thumb);
          return;
        }

        if (storage.handleImage) {
          try {
            if (
              await storage.handleImage(req, res, img, {
                acceptWebp,
                size,
              })
            )
              return;
          } catch (e) {
            console.warn("handle image error", img._id, e);
          }
        }

        res.set("Cache-Control", "public, max-age=31557600");
        res.redirect(302, img.src);
      } catch (e) {
        console.log("attachment get error", e);
        next();
      }
    });
  };
