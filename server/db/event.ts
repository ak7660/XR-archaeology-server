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

  venue: { type: "id", ref: "Attraction" },
  startDate: { type: Date, required: true },
  endDate: { type: Date },

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
      headers: ["name", "order"],
      icon: "MdEvent",
      groupIcon: "MdEmojiEmotions",
    },
  },
};

export default schema;
