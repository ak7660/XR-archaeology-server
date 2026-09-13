import type { SchemaDefExt } from "../feathers/schema";

const schema: SchemaDefExt = {
  name: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date },

  $services: {
    services: {
      arTags: {},
    },
    public: {
      // Same name as on the admin API; "tags" clashed with tag.ts on the public API.
      arTags: {
        hooks_Auth: ["readOnlyHooks"],
      },
    },
  },

  $params: {
    editor: {
      headers: ["name", "createdAt"],
      icon: "MdTag",
      group: "AR",
    },
  },
};
export default schema;
