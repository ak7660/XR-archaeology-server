/**
 * Talking to the AI trip-planner service (XR-archaeology-ai) from the server.
 *
 * The app no longer holds the AI key: it sends planner messages to the public
 * API (`planner` service), which forwards them here with AI_API_KEY.
 * AI_URL defaults to the production AI service.
 */
import { HookContext } from "@feathersjs/feathers";
import * as errors from "@feathersjs/errors";

const AI_URL = () => (process.env.AI_URL || "https://xr-archaeology-ai-production.up.railway.app").replace(/\/+$/, "");
/** Plan generation can take a while; the app shows "typing" meanwhile. */
const TIMEOUT_MS = 120 * 1000;

export interface AiChatResponse {
  conversation_id: string;
  message: string;
  stage: string;
  trip_data?: { start_date?: string | null; end_date?: string | null; number_of_people?: number | null; [key: string]: any } | null;
  trip_plan?: string | null;
  available_locations?: any[] | null;
  needs_input?: boolean;
}

function apiKey(): string {
  const key = process.env.AI_API_KEY;
  if (!key) throw new errors.Unavailable("The trip planner isn't set up on this server yet.");
  return key;
}

export async function sendChat(message: string, conversationId: string | undefined, language: string): Promise<AiChatResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${AI_URL()}/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey() },
      body: JSON.stringify({ message, conversation_id: conversationId || undefined, language }),
      signal: controller.signal,
    });
  } catch (e: any) {
    throw new errors.Unavailable(
      e?.name === "AbortError" ? "The trip planner took too long to answer. Please try again." : "The trip planner can't be reached right now. Please try again."
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    // The AI service already returns a safe, human sentence in `detail`.
    let detail = "";
    try {
      detail = (await res.json())?.detail;
    } catch {}
    const message = typeof detail === "string" && detail ? detail : "The trip planner is temporarily unavailable. Please try again in a moment.";
    if (res.status === 503 || res.status === 502 || res.status === 504) throw new errors.Unavailable(message);
    throw new errors.GeneralError(message);
  }
  return res.json();
}

/** Forget a conversation on the AI side as well (its saved planner state). */
export async function deleteAiSession(conversationId: string) {
  if (!conversationId || !process.env.AI_API_KEY) return;
  try {
    await fetch(`${AI_URL()}/chat/conversation/${encodeURIComponent(conversationId)}`, {
      method: "DELETE",
      headers: { "X-API-Key": apiKey() },
    });
  } catch (e) {
    console.warn("[planner] could not delete AI session", conversationId, e);
  }
}

/** After a saved plan is deleted, delete the AI service's copy too. */
export const plannerCleanup = {
  after: {
    async remove(hook: HookContext) {
      const removed = Array.isArray(hook.result) ? hook.result : [hook.result];
      await Promise.all(removed.filter(Boolean).map((doc: any) => deleteAiSession(doc.conversationId)));
    },
  },
};
