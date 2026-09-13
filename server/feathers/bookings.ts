/**
 * Event bookings: the rules app users book under, and what staff can do.
 *
 * Days are Armenia calendar days (UTC+4, no DST) - the same convention as the
 * admin editor (plugins/date.ts) and the app (app/composable/event_dates.ts).
 */
import { Application, HookContext } from "@feathersjs/feathers";
import * as authentication from "@feathersjs/authentication";
import * as errors from "@feathersjs/errors";
import { disallow } from "feathers-hooks-common";
import moment from "moment";
import db from "@mfeathers/db";
import { bookingMail, sendMail } from "./mail";
import { clientIp, enforce, HOUR } from "./rateLimit";
import { isStaff, STAFF_ROLES } from "./roles";

export const ARMENIA_OFFSET_MINUTES = 240;
/** Limits per booking, matching the app's steppers. */
export const MAX_ADULTS = 10;
export const MAX_CHILDREN = 10;
/** Bookings that hold a place. */
export const ACTIVE = ["confirmed", "attended"];

export function armeniaMoment(value: any) {
  return moment.utc(value).utcOffset(ARMENIA_OFFSET_MINUTES);
}

export function armeniaDay(value: any): string {
  return armeniaMoment(value).format("YYYY-MM-DD");
}

/** Every Armenia day an event covers (a missing end means one day), capped at a year. */
export function eventDays(event: { startDate?: any; endDate?: any }): string[] {
  if (!event.startDate) return [];
  const start = armeniaMoment(event.startDate).startOf("day");
  const last = armeniaDay(event.endDate || event.startDate);
  const days: string[] = [];
  while (days.length < 366) {
    const day = start.format("YYYY-MM-DD");
    if (day > last) break;
    days.push(day);
    start.add(1, "day");
  }
  return days;
}

/** Days that can still be booked: the event hasn't finished, and the day isn't before today in Armenia. */
export function bookableDays(event: { startDate?: any; endDate?: any }, now = new Date()): string[] {
  const finish = event.endDate || event.startDate;
  if (!finish || new Date(finish).getTime() < now.getTime()) return [];
  const today = armeniaDay(now);
  return eventDays(event).filter((day) => day >= today);
}

/** People already booked per day for one event. */
export async function bookedPeople(eventId: any): Promise<Record<string, number>> {
  const rows = await (db as any).EventRegistration.aggregate([
    { $match: { event: toObjectId(eventId), status: { $in: ACTIVE } } },
    { $group: { _id: "$day", people: { $sum: { $add: ["$adults", { $ifNull: ["$children", 0] }] } } } },
  ]);
  const result: Record<string, number> = {};
  for (const row of rows) result[row._id] = row.people;
  return result;
}

function toObjectId(id: any) {
  const { Types } = require("mongoose");
  return typeof id === "string" ? new Types.ObjectId(id) : id;
}

function whole(value: any, min: number, max: number, field: string, label: string) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new errors.BadRequest(`${label} must be between ${min} and ${max}.`, { field, reason: "invalidCount" });
  }
  return n;
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

  const days = bookableDays(event);
  if (!days.length) throw new errors.BadRequest("This event has ended.", { reason: "ended" });
  const day = data.day || (days.length === 1 ? days[0] : undefined);
  if (!day || !days.includes(day)) throw new errors.BadRequest("Please choose one of the event's days.", { field: "day", reason: "badDay" });

  const adults = whole(data.adults ?? 1, 1, MAX_ADULTS, "adults", "Adults");
  const children = whole(data.children ?? 0, 0, MAX_CHILDREN, "children", "Children");

  const existing = await (db as any).EventRegistration.findOne({ event: event._id, user: user._id, day, status: { $in: ACTIVE } }).lean();
  if (existing) {
    throw new errors.Conflict("You've already booked this day. Cancel that booking to change it.", { reason: "alreadyBooked" });
  }

  if (event.capacity) {
    const taken = (await bookedPeople(event._id))[day] || 0;
    const left = Math.max(0, event.capacity - taken);
    if (adults + children > left) {
      throw new errors.BadRequest(left ? `Only ${left} places are left on this day.` : "This day is fully booked.", {
        reason: left ? "notEnoughPlaces" : "full",
        left,
      });
    }
  }

  hook.params.bookingEvent = event;
  hook.data = {
    event: event._id,
    user: user._id,
    day,
    adults,
    children,
    name: [user.firstName, user.lastName].filter(Boolean).join(" "),
    email: user.email,
    phone: typeof data.phone === "string" && data.phone.trim() ? data.phone.trim().slice(0, 40) : user.phone,
    note: typeof data.note === "string" ? data.note.trim().slice(0, 500) : undefined,
    status: "confirmed",
    createdAt: new Date(),
  };
}

/** Public API: the only change a visitor can make is cancelling their own booking before the event. */
async function prepareCancel(hook: HookContext) {
  if (!hook.params.provider) return;
  if (hook.data?.status !== "cancelled" || Object.keys(hook.data).length !== 1) {
    throw new errors.BadRequest("A booking can only be cancelled. Cancel it and book again to change it.");
  }
  if (hook.id === null || hook.id === undefined) throw new errors.MethodNotAllowed();
  const booking = await (db as any).EventRegistration.findOne({ _id: toObjectId(hook.id), user: hook.params.user._id }).lean();
  if (!booking) throw new errors.NotFound("Booking not found.");
  if (booking.status === "cancelled") throw new errors.BadRequest("This booking is already cancelled.");
  if (booking.day < armeniaDay(new Date())) throw new errors.BadRequest("This booking is in the past.");
  hook.data = { status: "cancelled", cancelledAt: new Date() };
}

function ownOnly(hook: HookContext) {
  if (!hook.params.provider) return;
  hook.params.query = { ...(hook.params.query || {}), user: hook.params.user?._id };
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
        day: booking.day,
        adults: booking.adults,
        children: booking.children || 0,
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
