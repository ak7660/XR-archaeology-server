import feather from "../feathers/feathers";
import { SchemaServiceClass } from "../feathers/schemas";
import configs from "@configs";
import { requireContext } from "../utils/webpack";
import { isStaff } from "../feathers/hooks";
const services = requireContext("./server/api/services/", true, /\.(js|ts)$/);

export default (internal) => {
  const app = feather("services", services, null, {
    auth: {
      secret: configs.web.secret,
      local: true,
      internal,
      cookie: true,
      jwt: true,
      domain: configs.has("next") ? configs.getUrl("next") : configs.getUrl("api"),
    },
    rest: true,
    socketio: true,
    api: {
      events: !internal,
      tasks: !internal,
      // Admin API: collections without their own hooks are public-read, staff-write.
      defaultHooks: "staffWrite",
    },
    attachments: { internal, canUpload: isStaff },
  });
  app.configure((app) => {
    app.use("/schemas", new SchemaServiceClass("services"));
  });
  return app;
};
