import type { SchemaDefExt } from "../feathers/schema";

const schema: SchemaDefExt = {
  name: { type: String, index: true, unique: true }, //filename
  size: Number, //file size in bytes
  mime: String, // file mime, e.g. image/png, image/jpg and video/mp4
  type: { type: String, index: true }, // video | image | audio | model | other
  source: { type: String, index: true }, // path of parent
  parent: { type: String, index: true },
  date: { type: Date, default: Date, index: true }, // upload date

  thumb: { type: Buffer, contentType: String },

  uploadDate: { type: Date, default: Date, index: true }, // upload date
  width: Number, // image width
  height: Number, // image height
  duration: Number, // video duration
  sizes: [
    {
      format: String,
      width: Number,
      height: Number,
      src: { type: String }, // optimized file
    },
  ],

  meta: Object,
  status: String,
  src: { type: String }, // original file
  hash: String,

  $services: {
    services: {
      attachments: {},
    },
    public: {
      attachments: {
        hooks_Auth: ["readOnlyHooks"],
      },
    },
  },

  $params: {
    editor: {
      headers: ["name", "type", "mime", "size", "date"],
      icon: "MdPhotoLibrary",
      order: 9999,
    },
    services: {
      services: {
        path: "attachments",
      },
      public: {
        path: "attachments",
      },
    },
  },
};

export default schema;
