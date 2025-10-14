import type { SchemaDefExt } from "../feathers/schema";

const schema: SchemaDefExt = {
  name: {
    en: { type: String, index: true, $editor: { label: "Name (English)" } },
    hy: { type: String, index: true, $editor: { label: "Name (Armenian)" } },
    ru: { type: String, index: true, $editor: { label: "Name (Russian)" } },
  },
  briefDesc: {
    en: { type: String, $editor: { props: { multiLine: true }, label: "Brief Description (English)" } },
    hy: { type: String, $editor: { props: { multiLine: true }, label: "Brief Description (Armenian)" } },
    ru: { type: String, $editor: { props: { multiLine: true }, label: "Brief Description (Russian)" } },
  },
  desc: {
    en: { type: String, $editor: { props: { multiLine: true }, label: "Description (English)" } },
    hy: { type: String, $editor: { props: { multiLine: true }, label: "Description (Armenian)" } },
    ru: { type: String, $editor: { props: { multiLine: true }, label: "Description (Russian)" } },
  },
  content: [
    {
      heading: { type: String },
      desc: { type: String, $editor: { props: { multiLine: true } } },
      images: [{ type: "id", ref: "Attachment", fileType: "image" }],
    },
  ],
  thumbnails: [{ type: "id", ref: "Attachment", fileType: "image" }],

  /** Difficulty of the route */
  difficulty: { type: String, enum: ["Easy", "Moderate", "Difficult"], default: "Moderate" },

  order: { type: Number, default: 0, min: 0, required: true },

  createdAt: { type: Date, default: Date },

  $services: {
    services: {
      routes: {},
    },
    public: {
      routes: {
        hooks_Auth: ["readOnlyHooks"],
      },
    },
  },
  $params: {
    editor: {
      headers: ["name", "order"],
      group: "hike",
      icon: "MdOutlineRoute",
      groupIcon: "MdLandscape",
    },
  },
};

export default schema;
