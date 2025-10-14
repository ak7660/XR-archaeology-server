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
  images: [{ type: "id", ref: "Attachment", fileType: "image" }],
  content: [
    {
      heading: { type: String },
      desc: { type: String, $editor: { props: { multiLine: true } } },
      images: [{ type: "id", ref: "Attachment", fileType: "image" }],
    },
  ],

  phone: { type: String },

  contactText: { type: String },

  personalLink: { type: String },

  language: { type: String },

  address: { type: String, required: true },

  addressLink: { type: String, required: true },

  duration: { type: String, required: true },

  order: { type: Number, default: 0, min: 0 },

  businessHours: [
    {
      openTime: { type: String, required: true, $editor: { props: { type: "time" } } },
      closeTime: { type: String, required: true, $editor: { props: { type: "time" } } },
      days: [{ type: String, required: true, enum: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] }],
    },
  ],

  $services: {
    services: {
      experience: {},
    },
    public: {
      experience: {
        hooks_Auth: ["readOnlyHooks"],
      },
    },
  },
  $params: {
    editor: {
      headers: ["name", "order"],
      icon: "MdEvent",
      groupIcon: "MdEmojiEmotions",
    },
  },
};

export default schema;
