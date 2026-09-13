/**
 * AI trip planner on the public API: `POST /api/planner` { message, conversationId?, language?, hidden? }.
 *
 * Relays the message to the AI service and returns its answer unchanged, so the
 * app's chat screen works as before. Anyone may use it (rate-limited); for a
 * signed-in person the conversation is also saved to `plannerConversations`,
 * which the app lists as "My trip plans".
 *
 * `hidden` marks the app's automatic opening message, which isn't shown in
 * the chat and so isn't saved as something the person said.
 */
import { HookContext, Params } from "@feathersjs/feathers";
import * as authentication from "@feathersjs/authentication";
import * as errors from "@feathersjs/errors";
import db from "@mfeathers/db";
import { sendChat } from "@/server/feathers/aiPlanner";
import { clientIp, enforce, HOUR } from "@/server/feathers/rateLimit";

const LANGUAGES = ["en", "hy", "ru"];
const MAX_MESSAGE = 1000;

class PlannerService {
  async create(data: any, params: Params & { user?: any }) {
    const message = typeof data?.message === "string" ? data.message.trim() : "";
    if (!message) throw new errors.BadRequest("Please type a message.");
    if (message.length > MAX_MESSAGE) throw new errors.BadRequest(`Messages can be up to ${MAX_MESSAGE} characters.`);
    const language = LANGUAGES.includes(data.language) ? data.language : "en";
    const user = params.user;

    if (params.provider) {
      if (user?._id) enforce(`planner:${user._id}`, 150, HOUR, "You've sent a lot of messages. Please take a break and try again in a while.");
      else enforce(`planner-ip:${clientIp(params)}`, 60, HOUR, "Too many messages from this network. Please try again in a while.");
    }

    const conversationId = typeof data.conversationId === "string" ? data.conversationId : undefined;
    const answer = await sendChat(message, conversationId, language);

    let savedId: string | undefined;
    if (user?._id) {
      savedId = await save(user._id, conversationId, answer, data.hidden ? undefined : message, language).catch((e) => {
        console.warn("[planner] could not save conversation", e);
        return undefined;
      });
    }
    return { ...answer, savedId };
  }
}

/** Latest full itinerary: while refining, the AI puts the revised plan in the message itself. */
function latestPlan(answer: any, previous?: string) {
  if (answer.stage === "refining_plan" && typeof answer.message === "string" && answer.message.includes("#")) return answer.message;
  return answer.trip_plan || previous || undefined;
}

async function save(userId: any, requestedId: string | undefined, answer: any, userMessage: string | undefined, language: string) {
  const Model = (db as any).PlannerConversation;
  const now = new Date();
  // Look up by the id the app sent; the AI answers with the same one unless it had to start afresh.
  let doc = await Model.findOne({ user: userId, conversationId: requestedId || answer.conversation_id });
  const newMessages = [
    ...(userMessage ? [{ role: "user", content: userMessage, at: now }] : []),
    ...(answer.message ? [{ role: "assistant", content: answer.message, at: now }] : []),
  ];
  const tripData = {
    startDate: answer.trip_data?.start_date || undefined,
    endDate: answer.trip_data?.end_date || undefined,
    people: answer.trip_data?.number_of_people || undefined,
  };
  if (!doc) {
    doc = await Model.create({
      user: userId,
      conversationId: answer.conversation_id,
      title: userMessage ? userMessage.slice(0, 80) : undefined,
      language,
      stage: answer.stage,
      messages: newMessages,
      tripPlan: latestPlan(answer),
      tripData,
      createdAt: now,
      updatedAt: now,
    });
    return String(doc._id);
  }
  doc.conversationId = answer.conversation_id;
  doc.messages.push(...newMessages);
  if (!doc.title && userMessage) doc.title = userMessage.slice(0, 80);
  doc.stage = answer.stage;
  doc.language = language;
  doc.tripPlan = latestPlan(answer, doc.tripPlan);
  doc.tripData = { ...(doc.tripData?.toObject?.() || doc.tripData || {}), ...Object.fromEntries(Object.entries(tripData).filter(([, v]) => v !== undefined)) };
  doc.updatedAt = now;
  await doc.save();
  return String(doc._id);
}

export default new PlannerService();

export const hooks = {
  before: {
    create: [
      // Signed in is optional: use the session when there is one.
      async (hook: HookContext) => {
        if (hook.params.provider && hook.params.authentication) {
          await authentication.authenticate("jwt")(hook as any);
        }
      },
    ],
  },
};
