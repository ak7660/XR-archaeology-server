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
  desc: { 
    en: { type: String, $editor: { props: { multiLine: true }, label: "Description (English)" } },
    hy: { type: String, $editor: { props: { multiLine: true }, label: "Description (Armenian)" } },
    ru: { type: String, $editor: { props: { multiLine: true }, label: "Description (Russian)" } },
   },
  content: [
    {
      heading: { type: String },
      desc: { type: String, $editor: { props: { multiLine: true } } },
      images: [{ type: "id", ref: "Attachment", fileType: "image" }],
    },
  ],
  thumbnails: [{ type: "id", ref: "Attachment", fileType: "image" }],
  tags: [{ type: "id", ref: "Tag" }],
  contact: { type: String },
  entranceFee: { type: Number, default: 0 },

  order: { type: Number, default: 0, min: 0 },

  latitude: { type: Number, min: -90, max: 90 },
  longitude: { type: Number, min: -180, max: 180 },

  businessHours: [
    {
      openTime: { type: String, required: true, $editor: { props: { type: "time" } } },
      closeTime: { type: String, required: true, $editor: { props: { type: "time" } } },
      days: [{ type: String, required: true, enum: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] }],
    },
  ],

  /** To determine which tourism industry the object is */
  type: { type: String, enum: ["Attraction", "Restaurant", "Lodging", "Other"], default: "Other", required: true, index: true },

  createdAt: { type: Date, default: Date },

  $services: {
    services: {
      attractions: {},
    },
    public: {
      attractions: {
        hooks_Auth: ["readOnlyHooks"],
      },
    },
  },
  $params: {
    editor: [
      {
        headers: ["name.en", "name.hy", "order"],
        name: "attractions",
        path: "attractions",
        filter: { type: "Attraction" },
        icon: "MdOutlineWbSunny",
      },
      {
        headers: ["name.en", "name.hy", "order"],
        name: "restaurants",
        path: "restaurants",
        filter: { type: "Restaurant" },
        icon: "MdOutlineRestaurant",
      },
      {
        headers: ["name.en", "name.hy", "order"],
        name: "lodgings",
        path: "lodgings",
        filter: { type: "Lodging" },
        icon: "MdOutlineBed",
      },
      {
        headers: ["name.en", "name.hy", "order"],
        name: "venues",
        path: "venues",
        filter: { type: "Other" },
        icon: "MdApps",
      },
    ],
  },
};

export default schema;
