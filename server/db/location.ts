import type { SchemaDefExt } from "../feathers/schema";

const schema: SchemaDefExt = {
  name: {
    en: { type: String, index: true, $editor: { label: "Name (English)" } },
    hy: { type: String, index: true, $editor: { label: "Name (Armenian)" } },
    ru: { type: String, index: true, $editor: { label: "Name (Russian)" } },
  },
  desc: {
    en: { type: String, $editor: { props: { multiLine: true }, label: "Description (English)" } },
    hy: { type: String, $editor: { props: { multiLine: true }, label: "Description (Armenian)" } },
    ru: { type: String, $editor: { props: { multiLine: true }, label: "Description (Russian)" } },
  },
  latitude: { type: Number, min: -90, max: 90, required: true, index: true },
  longitude: { type: Number, min: -180, max: 180, required: true, index: true },
  images: [{ type: "id", ref: "Attachment", fileType: "image" }],
  /** Determine which route this location belongs to */
  route: { type: "id", ref: "Route", required: true },
  order: { type: Number, default: 0, min: 0, required: true },

  createdAt: { type: Date, default: Date },

  $services: {
    services: {
      locations: {},
    },
    public: {
      locations: {
        hooks_Auth: ["readOnlyHooks"],
      },
    },
  },
  $params: {
    editor: {
      headers: ["name.en", "name.hy", "name.ru", "latitude", "longitude", "order"],
      icon: "MdLocationOn",
      group: "hike",
      groupIcon: "MdLandscape",
    },
  },
};

export default schema;
