import type { SchemaDefExt } from "../feathers/schema";

const schema: SchemaDefExt = {
  name: { type: String, required: true },
  latitude: { type: Number, min: -90, max: 90, required: true },
  longitude: { type: Number, min: -180, max: 180, required: true },
  images: [{ type: "id", ref: "Attachment", fileType: "image" }],
  pages: [
    {
      text: { type: String, required: true, $editor: { props: { multiLine: true } } },
      imageIndex: { type: Number, default: 0, min: 0 },
    },
  ],
  route: { type: "id", ref: "Route", required: true },
  triggerDistance: { type: Number, default: 20, min: 5, max: 200 },
  order: { type: Number, default: 0, min: 0 },
  createdAt: { type: Date, default: Date },
  $services: {
    services: {
      storyboards: {},
    },
    public: {
      storyboards: {
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
