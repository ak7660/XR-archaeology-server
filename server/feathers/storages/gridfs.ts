import { Application } from "@feathersjs/feathers";
import { AttachmentOpts, AttachmentStorage, InfoType, findSize } from "../attachments";
import { GridFSBucket, Db, ObjectId, MongoClient } from "mongodb";
import sharp from "sharp";
import { memoryStorage } from "multer";

const getByteRange = function (header) {
  if (header) {
    const matches = header.match(/(\d+)-(\d*)/);
    if (matches) {
      return {
        start: parseInt(matches[1], 10),
        stop: matches[2] ? parseInt(matches[2], 10) : null,
      };
    }
  }
  return null;
};

export default (opts: AttachmentOpts, app: Application): AttachmentStorage => {
  const storage = memoryStorage();

  // Register cleanup hook for deleted attachments - this will be set up after the service is available
  const setupCleanupHook = () => {
    try {
      const attachments = app.service("attachments");
      if (attachments) {
        attachments.hooks({
          after: {
            remove(hook) {
              const item: InfoType = hook.result;
              if (item) {
                const filesToRemove: string[] = [];
                if (item.src && item.src.startsWith("gridfs://")) {
                  filesToRemove.push(item.src.substring(9));
                }
                if (item.sizes) {
                  for (let size of item.sizes) {
                    if (size.src && size.src.startsWith("gridfs://")) {
                      filesToRemove.push(size.src.substring(9));
                    }
                  }
                }
                if (filesToRemove.length > 0) {
                  const db: Db = (<MongoClient>(<any>app).mdb).db();
                  const bucket = new GridFSBucket(db, {
                    bucketName: "fs",
                  });
                  for (let file of filesToRemove) {
                    try {
                      bucket.delete(new ObjectId(file));
                    } catch (e) {
                      console.warn("Error deleting GridFS file:", e);
                    }
                  }
                }
              }
            },
          },
        });
        return true;
      }
    } catch (e) {
      console.warn("Error setting up cleanup hook:", e);
    }
    return false;
  };

  // Try to set up the hook immediately, and retry if needed
  let hookSetupAttempts = 0;
  const maxAttempts = 20; // Try for up to 10 seconds (20 * 500ms)
  const hookSetupInterval = setInterval(() => {
    if (setupCleanupHook() || hookSetupAttempts >= maxAttempts) {
      clearInterval(hookSetupInterval);
      if (hookSetupAttempts >= maxAttempts) {
        console.warn("Failed to set up attachment cleanup hook after maximum retries");
      }
    }
    hookSetupAttempts++;
  }, 500);

  const result: AttachmentStorage = {
    storage,
    async updateInfo(info) {
      const db: Db = (<MongoClient>(<any>app).mdb).db();
      try {
        const bucket = new GridFSBucket(db, {
          bucketName: "fs",
        });
        // Set the src if not already set
        info.src = info.src ?? ("gridfs://" + (info.id || info._id));
        const id = info.id ? info.id : new ObjectId(info.src.substring(9));

        if (info.type === "image") {
          try {
            const image = sharp();
            const stream = bucket.openDownloadStream(id);
            stream.pipe(image);
            const metadata = await image.metadata();

            info.width = metadata.width;
            info.height = metadata.height;

            info.thumb = await image
              .clone()
              .rotate()
              .resize(200, 200, {
                fit: "inside",
              })
              .toBuffer();

            info.thumbWebp = await image
              .clone()
              .rotate()
              .resize(200, 200, {
                fit: "inside",
              })
              .toFormat("webp")
              .toBuffer();
          } catch (e) {
            if (opts.thumbRequired) throw new Error("Image is invalid");
            console.warn("Error processing image thumbnails:", e);
          }
        }
      } catch (error) {
        console.warn("GridFS updateInfo error:", error);
        throw error;
      }
    },
    async handleImage(req, res, img, { acceptWebp, size }) {
      if (!img.src?.startsWith("gridfs://")) return false;
      const range = getByteRange(req.headers.range);
      let outOfRange = false;
      if (range) {
        if (range.stop === null) range.stop = img.size;
        outOfRange = range.start >= img.size || range.stop < range.start;
        if (range.stop >= img.size - 1) {
          range.stop = img.size - 1;
        }
      }

      if (range && outOfRange) {
        res.removeHeader("Content-Length");
        res.removeHeader("Content-Type");
        res.removeHeader("Content-Disposition");
        res.removeHeader("Last-Modified");
        res.setHeader("Content-Range", `bytes */${img.size}`);
        res.writeHead(416);
        res.end();
        return;
      }

      const db: Db = (<MongoClient>(<any>app).mdb).db();

      const bucket = new GridFSBucket(db, {
        bucketName: "fs",
      });

      let target = new ObjectId(img.src.substring(9));
      let mime = img.mime;

      if (size && img.type === "image") {
        const newSize = findSize(img.sizes, size, acceptWebp);
        if (newSize && newSize.src.startsWith("gridfs://")) {
          target = new ObjectId(newSize.src.substring(9));
          if (newSize.format === "webp") {
            mime = "image/webp";
          }
        }
      }

      const oetag = req.headers["if-none-match"];

      const info = (await bucket.find({ _id: target }).toArray())[0];
      if (!info) return false;

      const etag = (<any>info).md5 || `${target}`;

      if (oetag === etag) {
        res.set("Cache-Control", "public, max-age=31557600");
        res.setHeader("Content-Type", mime);
        res.setHeader("ETag", etag);
        res.setHeader("Content-Length", info.length);
        res.status(304);
        res.send("Not Modified");
        return true;
      }

      res.set("Cache-Control", "public, max-age=31557600");
      res.setHeader("Content-Type", mime);
      res.setHeader("ETag", etag);
      res.setHeader("Content-Length", info.length);
      if (range) {
        res.setHeader("Content-Range", `bytes ${range.start}-${range.stop}/${img.size}`);
        res.removeHeader("Content-Length");
        res.setHeader("Content-Length", range.stop - range.start + 1);
        res.writeHead(206);
      }

      bucket.openDownloadStream(target, range ? { start: range.start, end: range.stop } : undefined).pipe(res);
      return true;
    },
    async upload(path, data, mime) {
      const db: Db = (<MongoClient>(<any>app).mdb).db();

      try {
        const bucket = new GridFSBucket(db, {
          bucketName: "fs",
        });

        const s = bucket.openUploadStream(path, {
          contentType: mime,
        });

        return new Promise<{ id: ObjectId }>((resolve, reject) => {
          s.once("error", reject);
          s.once("finish", () => {
            resolve({ id: s.id });
          });
          s.write(data);
          s.end();
        });
      } catch (error) {
        console.warn("GridFS upload error:", error);
        throw error;
      }
    },
  };

  return result;
};
