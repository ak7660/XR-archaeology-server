import { HookContext } from "@feathersjs/feathers";
import type { SchemaDefExt } from "../feathers/schema";
import { MModel, MongoSchema } from "../feathers/schemas";

const schema: SchemaDefExt = {
  firstName: { type: String, index: true, required: true },
  // Optional: Google profiles, and people with one name, may have no family name.
  lastName: { type: String, index: true },
  username: { type: String },
  email: { type: String, index: { unique: true } },
  /** Stores both area code and mobile number, in format of "+<area code>  <phone number>"*/
  phone: { type: String },
  dob: { type: Date },
  password: { type: String, minlength: 8, $editor: { hidden: true } },
  createdAt: { type: Date, default: Date, $editor: { props: { readOnly: true } } },

  bookmarks: [{ type: "id", ref: "Attraction" }],
  collections: [{ type: "id", ref: "Artifact" }],

  /** App language (en | hy | ru), so emails arrive in the language the app is used in. */
  language: { type: String, enum: ["en", "hy", "ru"], default: "en" },
  /** How the person signs in: "local" (email + password) and/or "google". */
  providers: [{ type: String, enum: ["local", "google"] }],
  /** Google account id ("sub"), set when Google sign-in is added. */
  googleId: { type: String, index: { unique: true, sparse: true }, $editor: { hidden: true } },
  avatar: { type: String },
  lastLoginAt: { type: Date, $editor: { props: { readOnly: true } } },
  /** Sessions issued before this moment stop working (password reset, sign out everywhere). */
  passwordChangedAt: { type: Date, $editor: { hidden: true } },

  // Password reset: a hashed 6-digit code (server/feathers/accountCodes.ts).
  resetRequired: { type: Boolean, default: false, $editor: { hidden: true } },
  resetTime: { type: Date, $editor: { hidden: true } },
  resetToken: { type: String, $editor: { hidden: true } },
  resetExpires: { type: Date, $editor: { hidden: true } },
  resetTrial: { type: Number, $editor: { hidden: true } },

  // Email confirmation: a hashed 6-digit code.
  verifyToken: { type: String, $editor: { hidden: true } },
  verifyExpires: { type: Date, $editor: { hidden: true } },
  verifyTrial: { type: Number, $editor: { hidden: true } },
  verifySentAt: { type: Date, $editor: { hidden: true } },
  verified: { type: Boolean, default: false },

  $params: {
    services: {
      services: {
        path: "appUsers",
      },
    },
    editor: {
      headers: ["name", "email", "createdAt"],
      icon: "MdOutlinePerson",
      roles: ["admin"],
    },
  },
};

export default schema;

export let type!: MongoSchema<typeof schema>;

declare module "@mfeathers/db" {
  interface DB {
    User: MModel<typeof type>;
  }
}
