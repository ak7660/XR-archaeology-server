import type { SchemaDefExt } from "../feathers/schema";

/**
 * A place booked at an event by an app user.
 *
 * Name, email and phone are copied from the account when booking, so the list
 * in the admin stays readable even if the person later edits or deletes their
 * account. `day` is the Armenia calendar day (YYYY-MM-DD) - for a multi-day
 * event the visitor picks which day they come.
 *
 * Rules for app users (dates, capacity, one booking per day, cancelling) live
 * in server/feathers/bookings.ts.
 */
const schema: SchemaDefExt = {
  event: { type: "id", ref: "Event", required: true, index: true },
  user: { type: "id", ref: "User", index: true },
  day: { type: String, required: true, index: true, $editor: { label: "Day (Armenia)", props: { readOnly: true } } },
  adults: { type: Number, required: true, min: 1, max: 20 },
  children: { type: Number, default: 0, min: 0, max: 20 },

  name: { type: String, $editor: { label: "Name" } },
  email: { type: String, $editor: { label: "Email" } },
  phone: { type: String, $editor: { label: "Phone" } },
  note: { type: String, maxlength: 500, $editor: { props: { multiLine: true }, label: "Note from the visitor" } },

  status: { type: String, enum: ["confirmed", "cancelled", "attended"], default: "confirmed", index: true },
  cancelledAt: { type: Date, $editor: { props: { readOnly: true } } },
  createdAt: { type: Date, default: Date, index: true, $editor: { props: { readOnly: true } } },

  $services: {
    services: {
      eventRegistrations: {
        hooks_Auth: ["bookingStaffHooks"],
      },
    },
    public: {
      eventRegistrations: {
        hooks_Auth: ["authOnly", "bookingAppHooks"],
      },
    },
  },
  $params: {
    editor: {
      name: "$",
      headers: ["event", "day", "name", "email", "adults", "children", "status", "createdAt"],
      icon: "MdConfirmationNumber",
      group: "events",
      groupIcon: "MdEvent",
      order: 2,
      create: false,
      defaultSort: "createdAt",
      defaultSortDesc: true,
    },
  },
};

export default schema;
