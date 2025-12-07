import { required } from "feathers-hooks-common";
import type { SchemaDefExt } from "../feathers/schema";

const schema: SchemaDefExt = {
  name: {
    en: { type: String, index: true, required: true, $editor: { label: "Name (English)" } },
    hy: { type: String, index: true, $editor: { label: "Name (Armenian)" } },
    ru: { type: String, index: true, $editor: { label: "Name (Russian)" } },
  },
  content: [
    {
      heading: {
        en: { type: String, $editor: { label: "Heading (English)" } },
        hy: { type: String, $editor: { label: "Heading (Armenian)" } },
        ru: { type: String, $editor: { label: "Heading (Russian)" } },
      },
      desc: {
        en: { type: String, $editor: { props: { multiLine: true }, label: "Description (English)" } },
        hy: { type: String, $editor: { props: { multiLine: true }, label: "Description (Armenian)" } },
        ru: { type: String, $editor: { props: { multiLine: true }, label: "Description (Russian)" } },
      },
      images: [{ type: "id", ref: "Attachment", fileType: "image" }],
    },
  ],
  /** It is used to determine which page should this document be at the app */
  page: { type: String },

  order: { type: Number, default: 0, min: 0, required: true },

  createdAt: { type: Date, default: Date },

  $services: {
    services: {
      documents: {},
    },
    public: {
      documents: {
        hooks_Auth: ["readOnlyHooks"],
      },
    },
  },
  $params: {
    editor: {
      headers: ["name.en", "name.hy", "name.ru", "order"],
      icon: "MdEditDocument",
    },
  },
};

export default schema;
