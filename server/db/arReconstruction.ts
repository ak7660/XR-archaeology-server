import type { SchemaDefExt } from "../feathers/schema";

const schema: SchemaDefExt = {
  name: { type: String, required: true },
  briefDesc: { type: String, $editor: { props: { multiLine: true } } },
  latitude: { type: Number, min: -90, max: 90, required: true },
  longitude: { type: Number, min: -180, max: 180, required: true },
  model: { type: "id", ref: "Attachment", fileType: "model" },
  images: [{ type: "id", ref: "Attachment", fileType: "image" }],
  reversed: { type: Boolean, default: false },
  route: { type: "id", ref: "Route", required: true },
  triggerDistance: { type: Number, default: 20, min: 5, max: 200 },
  order: { type: Number, default: 0, min: 0 },
  createdAt: { type: Date, default: Date },
  $services: {
    services: {
      arReconstructions: {},
    },
    public: {
      arReconstructions: {
        hooks_Auth: ["readOnlyHooks"],
      },
    },
  },
  $params: {
    editor: {
      headers: ["name", "latitude", "longitude", "order", "createdAt"],
      group: "AR",
    },
  },
};

export default schema;
