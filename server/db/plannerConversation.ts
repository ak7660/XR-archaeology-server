import type { SchemaDefExt } from "../feathers/schema";

/**
 * A trip-planner conversation saved to an app user's account.
 *
 * Written only by the `planner` service on the public API (server/api/public/planner.ts),
 * which relays each message to the AI service. `conversationId` is the AI
 * service's id, used to continue the conversation later; `tripPlan` is the
 * latest full itinerary (markdown).
 */
const schema: SchemaDefExt = {
  user: { type: "id", ref: "User", required: true, index: true },
  conversationId: { type: String, required: true, index: true },
  title: { type: String },
  language: { type: String },
  stage: { type: String },
  messages: [
    {
      role: { type: String, enum: ["user", "assistant"] },
      content: { type: String },
      at: { type: Date },
    },
  ],
  tripPlan: { type: String, $editor: { props: { multiLine: true } } },
  tripData: {
    startDate: { type: Date },
    endDate: { type: Date },
    people: { type: Number },
  },
  createdAt: { type: Date, default: Date, index: true },
  updatedAt: { type: Date, default: Date, index: true },

  $services: {
    services: {
      plannerConversations: {
        hooks_Auth: ["adminReadRemoveOnly", "plannerCleanup"],
      },
    },
    public: {
      plannerConversations: {
        hooks_Auth: ["authOnly", "ownRecordsReadRemove", "plannerCleanup"],
      },
    },
  },
  $params: {
    editor: {
      headers: ["title", "user", "stage", "updatedAt"],
      icon: "MdChat",
      roles: ["admin"],
      create: false,
      patch: false,
      import: false,
      defaultSort: "updatedAt",
      defaultSortDesc: true,
    },
  },
};

export default schema;
