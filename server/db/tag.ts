import type { SchemaDefExt } from "../feathers/schema";

const schema: SchemaDefExt = {
  name: {
    en: { type: String, index: true, required: true, $editor: { label: "Name (English)" } },
    hy: { type: String, index: true, $editor: { label: "Name (Armenian)" } },
    ru: { type: String, index: true, $editor: { label: "Name (Russian)" } },
  },
  createdAt: { type: Date, default: Date },

  $services: {
    services: {
      tags: {},
    },
    public: {
      tags: {
        hooks_Auth: ["readOnlyHooks"],
      },
    },
  },

  $params: {
    editor: {
      headers: ["name.en", "name.hy", "name.ru", "createdAt"],
      icon: "MdTag",
    },
  },
};
export default schema;
