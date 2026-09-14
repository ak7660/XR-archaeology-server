/**
 * Event bookings: the rules app users book under, and what staff can do.
 *
 * Deliberately simple: a person books an event once (for 1-10 people), can
 * cancel it, and can book again after cancelling. An event may limit the total
 * number of places; once they're taken it's fully booked.
 */
import { Application, HookContext } from "@feathersjs/feathers";
import * as authentication from "@feathersjs/authentication";
import * as errors from "@feathersjs/errors";
import { disallow } from "feathers-hooks-common";
import db from "@mfeathers/db";
import { bookingMail, sendMail } from "./mail";
import { clientIp, enforce, HOUR } from "./rateLimit";
import { isStaff, STAFF_ROLES } from "./roles";

/** Largest group one booking can be for, matching the app's stepper. */
export const MAX_PEOPLE = 10;
/** Bookings that hold places. */
export const ACTIVE = ["confirmed", "attended"];

/** Bookable while the event hasn't finished (judged by its end, or its start if it has none). */
export function eventEnded(event: { startDate?: any; endDate?: any }, now = new Date()) {
  const finish = event.endDate || event.startDate;
  return !finish || new Date(finish).getTime() < now.getTime();
}

/** Places already taken for one event. */
export async function placesTaken(eventId: any): Promise<number> {
  const rows = await (db as any).EventRegistration.aggregate([
    { $match: { event: toObjectId(eventId), status: { $in: ACTIVE } } },
    { $group: { _id: null, people: { $sum: "$people" } } },
  ]);
  return rows[0]?.people || 0;
}

function toObjectId(id: any) {
  const { Types } = require("mongoose");
  return typeof id === "string" ? new Types.ObjectId(id) : id;
}

function localized(text: any, language?: string): string {
  if (!text || typeof text === "string") return text || "";
  return text[language || "en"] || text.en || text.hy || text.ru || "";
}

/** Public API: validate a new booking and fill in who is booking. */
async function prepareBooking(hook: HookContext) {
  if (!hook.params.provider) return;
  const user = hook.params.user;
  enforce(`booking:${user._id}`, 20, HOUR, "Too many bookings in a short time. Please try again later.");
  enforce(`booking-ip:${clientIp(hook.params)}`, 60, HOUR);
  if (!user.verified) {
    throw new errors.Forbidden("Confirm your email address before booking.", { reason: "unverified" });
  }
  const data = hook.data || {};
  let event: any;
  try {
    event = await hook.app.service("events").get(data.event);
  } catch {
    throw new errors.NotFound("This event is no longer available.", { reason: "noEvent" });
  }
  if (event.bookingEnabled === false) throw new errors.BadRequest("This event doesn't take bookings.", { reason: "notBookable" });
  if (eventEnded(event)) throw new errors.BadRequest("This event has ended.", { reason: "ended" });

  const people = Number(data.people ?? 1);
  if (!Number.isInteger(people) || people < 1 || people > MAX_PEOPLE) {
    throw new errors.BadRequest(`A booking can be for 1 to ${MAX_PEOPLE} people.`, { field: "people", reason: "invalidCount" });
  }

  const existing = await (db as any).EventRegistration.findOne({ event: event._id, user: user._id, status: { $in: ACTIVE } }).lean();
  if (existing) {
    throw new errors.Conflict("You've already booked this event.", { reason: "alreadyBooked" });
  }

  if (event.capacity) {
    const left = Math.max(0, event.capacity - (await placesTaken(event._id)));
    if (people > left) {
      const message = left === 0 ? "This event is fully booked." : left === 1 ? "Only 1 place is left." : `Only ${left} places are left.`;
      throw new errors.BadRequest(message, {
        reason: left ? "notEnoughPlaces" : "full",
        left,
      });
    }
  }

  hook.params.bookingEvent = event;
  hook.data = {
    event: event._id,
    user: user._id,
    people,
    name: [user.firstName, user.lastName].filter(Boolean).join(" "),
    email: user.email,
    phone: typeof data.phone === "string" && data.phone.trim() ? data.phone.trim().slice(0, 40) : user.phone,
    note: typeof data.note === "string" ? data.note.trim().slice(0, 500) : undefined,
    status: "confirmed",
    createdAt: new Date(),
  };
}

/** Public API: the only change a visitor can make is cancelling their own booking before the event ends. */
async function prepareCancel(hook: HookContext) {
  if (!hook.params.provider) return;
  if (hook.data?.status !== "cancelled" || Object.keys(hook.data).length !== 1) {
    throw new errors.BadRequest("A booking can only be cancelled. Cancel it and book again to change it.");
  }
  if (hook.id === null || hook.id === undefined) throw new errors.MethodNotAllowed();
  const booking = await (db as any).EventRegistration.findOne({ _id: toObjectId(hook.id), user: hook.params.user._id }).lean();
  if (!booking) throw new errors.NotFound("Booking not found.");
  if (booking.status === "cancelled") throw new errors.BadRequest("This booking is already cancelled.");
  const event = await hook.app.service("events").get(booking.event).catch(() => null);
  if (event && eventEnded(event)) throw new errors.BadRequest("This event has already ended.");
  hook.data = { status: "cancelled", cancelledAt: new Date() };
}

function ownOnly(hook: HookContext) {
  if (!hook.params.provider) return;
  hook.params.query = { ...(hook.params.query || {}), user: hook.params.user?._id };
}

/** Refused bookings are logged (reason only, nothing personal) so problems can be traced. */
function logRefusal(hook: HookContext) {
  if (hook.params.provider) console.warn(`[bookings] ${hook.method} refused: ${hook.error?.code} ${hook.error?.message}`);
}

async function emailBooking(hook: HookContext, kind: "confirmed" | "cancelledByOrganiser") {
  const booking = hook.result;
  if (!booking?.email) return;
  try {
    const event = hook.params.bookingEvent || (await hook.app.service("events").get(booking.event));
    const user = booking.user ? await (db as any).User.findById(booking.user).lean() : null;
    const language = user?.language || "en";
    await sendMail(
      bookingMail(kind, booking.email, language, {
        eventName: localized(event.name, language),
        startDate: event.startDate,
        endDate: event.endDate,
        people: booking.people,
      })
    );
  } catch (e) {
    console.warn("[bookings] email failed", e);
  }
}

/** Public API `eventRegistrations`: your own bookings only. */
export function bookingAppHooks(app: Application) {
  return {
    before: {
      find: [ownOnly],
      get: [ownOnly],
      create: [prepareBooking],
      patch: [ownOnly, prepareCancel],
      update: disallow("external"),
      remove: disallow("external"),
    },
    after: {
      create: [(hook: HookContext) => hook.params.provider && emailBooking(hook, "confirmed")],
    },
    error: {
      create: [logRefusal],
      patch: [logRefusal],
    },
  };
}

/** Admin API `eventRegistrations`: personal data, so staff only for every method,
 * reading included. A booking marked cancelled by staff is emailed to the visitor. */
export function bookingStaffHooks(app: Application) {
  const jwt = authentication.authenticate("jwt");
  const staff = (hook: HookContext) => {
    if (!isStaff(hook.params, STAFF_ROLES)) throw new errors.Forbidden("No permission: " + hook.path);
  };
  return {
    before: {
      all: [jwt, staff],
      patch: [
        async (hook: HookContext) => {
          if (hook.id === null || hook.id === undefined) return;
          const before = await (db as any).EventRegistration.findById(hook.id).lean();
          hook.params.previousStatus = before?.status;
          if (hook.data?.status === "cancelled" && before?.status !== "cancelled") hook.data.cancelledAt = new Date();
        },
      ],
    },
    after: {
      patch: [
        (hook: HookContext) => {
          if (hook.params.provider && hook.result?.status === "cancelled" && hook.params.previousStatus !== "cancelled") {
            return emailBooking(hook, "cancelledByOrganiser");
          }
        },
      ],
    },
  };
}
