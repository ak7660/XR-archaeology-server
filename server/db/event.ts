import type { SchemaDefExt } from "../feathers/schema";

const schema: SchemaDefExt = {
  name: {
    en: { type: String, index: true, $editor: { label: "Name (English)" } },
    hy: { type: String, index: true, $editor: { label: "Name (Armenian)" } },
    ru: { type: String, index: true, $editor: { label: "Name (Russian)" } },
  },
  briefDesc: {
    en: { type: String, $editor: { props: { multiLine: true }, label: "Brief Description (English)" } },
    hy: { type: String, $editor: { props: { multiLine: true }, label: "Brief Description (Armenian)" } },
    ru: { type: String, $editor: { props: { multiLine: true }, label: "Brief Description (Russian)" } },
  },
  content: { 
    en: { type: String, $editor: { props: { multiLine: true }, label: "Content (English)" } },
    hy: { type: String, $editor: { props: { multiLine: true }, label: "Content (Armenian)" } },
    ru: { type: String, $editor: { props: { multiLine: true }, label: "Content (Russian)" } },
  },
  images: [{ type: "id", ref: "Attachment", fileType: "image" }],

  /** Where the event takes place. One attraction, not several.
   *
   * The picker lists the whole `attractions` collection, which mixes venues
   * with restaurants and lodging, so it is sorted by English name to make it
   * navigable. Narrow it further by adding a filter to this query, e.g.
   * `type: { $in: ["Attraction", "Other"] }` - an already-saved venue outside
   * the filter still resolves and displays correctly.
   */
  venue: {
    type: "id",
    ref: "Attraction",
    $editor: { props: { query: { $sort: { "name.en": 1 } } } },
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date },

  /** Whether visitors can book a place in the app. Off for events that are open to all. */
  bookingEnabled: { type: Boolean, default: true, $editor: { label: "Accept bookings in the app" } },
  /** Places (adults + children) per day. Empty means no limit. */
  capacity: { type: Number, min: 1, $editor: { label: "Places per day (leave empty for no limit)" } },

  order: { type: Number, default: 0, min: 0 },
  createdAt: { type: Date, default: Date },

  $services: {
    services: {
      events: {},
    },
    public: {
      events: {
        hooks_Auth: ["readOnlyHooks"],
      },
    },
  },
  $params: {
    editor: {
      headers: ["name.en", "startDate", "bookingEnabled", "capacity", "order"],
      icon: "MdEvent",
      group: "events",
      groupIcon: "MdEvent",
      order: 1,
    },
  },
};

export default schema;
