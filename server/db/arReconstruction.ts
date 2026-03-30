import type { SchemaDefExt } from "../feathers/schema";

const schema: SchemaDefExt = {
  name: { type: String, required: true },
  briefDesc: { type: String, $editor: { props: { multiLine: true } } },
  /** Reference to Location that provides latitude, longitude, images, route, and order */
  location: { type: "id", ref: "Location", required: true },
  model: { type: "id", ref: "Attachment", fileType: "model" },
  reversed: { type: Boolean, default: false },
  triggerDistance: { type: Number, default: 20, min: 5, max: 200 },
  createdAt: { type: Date, default: Date },
  $services: {
    services: {
      arReconstructions: {},
    },
    public: {
      arReconstructions: {
        hooks_Auth: ["readOnlyHooks", "arReconstructionWithLocation"],
      },
    },
  },
  $params: {
    editor: {
      headers: ["name", "location", "createdAt"],
      group: "AR",
    },
  },
};

export default schema;
