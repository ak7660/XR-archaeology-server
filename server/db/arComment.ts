import { SchemaDefExt } from "../feathers/schema";

const schema: SchemaDefExt = {
  user: { type: "id", ref: "User" },
  content: { type: String, required: true, $editor: { props: { multiLine: true } } },
  latitude: { type: Number, min: -90, max: 90, required: true },
  longitude: { type: Number, min: -180, max: 180, required: true },

  createdAt: { type: Date, default: Date },

  $services: {
    services: {
      arComments: {
        hooks_Auth: ["authAdminOnly"],
      },
    },
    public: {
      arComments: {
        hooks_Auth: ["authOnly", "arCommentOwnership"],
      },
    },
  },
  $params: {
    editor: {
      headers: ["user", "content", "createdAt"],
      icon: "MdComment",
      group: "AR",
    },
  },
};
export default schema;
