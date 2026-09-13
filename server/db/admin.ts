import type { SchemaDefExt } from "../feathers/schema";
import { MModel, MongoSchema } from "../feathers/schemas";

const schema: SchemaDefExt = {
  name: String,
  email: { type: String },
  password: { type: String, $editor: { hidden: true } },
  role: { type: String, index: true, enum: ["admin", "editor"] },
  createdAt: { type: Date, default: Date },

  $services: {
    services: {
      admins: {
        hooks_Auth: ["adminAccountHooks"],
      },
    },
  },
  $params: {
    editor: {
      headers: ["name", "role", "createdAt"],
      icon: "MdLockPerson",
    },
  },
};

export default schema;
export let type!: MongoSchema<typeof schema>;

declare module "@mfeathers/db" {
  interface DB {
    Admin: MModel<typeof type>;
  }
}
