/** Everything the public privacy and data-deletion pages say that can change.
 *
 * The pages (pages/privacy.tsx, pages/delete-account.tsx) only describe what the
 * app actually does, so each account feature has a switch here. When a feature
 * ships, turn its switch on and move LAST_UPDATED to that day - the matching
 * paragraphs appear on both pages. Nothing else needs editing.
 */

/** Shown at the top of both pages. Move it whenever the wording or a switch changes. */
export const LAST_UPDATED = "2026-09-13";

export const OPERATOR = {
  name: "Veditourism",
  description: "a university research project based in Hong Kong",
  website: "https://www.veditourism.com",
};

export const CONTACT = {
  email: "yaowy151@gmail.com",
  phone: "+852 6586 4025",
  phoneHref: "tel:+85265864025",
};

/** How long a deletion request takes, stated on both pages. */
export const DELETION_DAYS = 30;

export const FEATURES = {
  /** Email-and-password accounts in the app. Turns on the account sections on both pages. */
  accounts: false,
  /** "Continue with Google". Only meaningful with accounts on. */
  googleSignIn: false,
  /** Booking an event from the app. */
  eventBookings: false,
  /** AI trip planner conversations saved to the account instead of only for the session. */
  plannerHistory: false,
  /** Questionnaire answers linked to the account that sent them. */
  linkedFeedback: false,
};

/** Outside companies that handle personal data for us. `when` decides whether a row is shown. */
export const PROCESSORS: {
  name: string;
  role: string;
  data: string;
  where: string;
  policy: string;
  when: boolean;
}[] = [
  {
    name: "Railway",
    role: "Hosts our servers and database",
    data: "Everything our servers keep, plus technical logs that include IP addresses",
    where: "Singapore",
    policy: "https://railway.com/legal/privacy",
    when: true,
  },
  {
    name: "Moonshot AI (Kimi)",
    role: "Writes the AI trip planner's replies",
    data: "The messages you type in the planner and the trip details you give it",
    where: "Outside Hong Kong",
    policy: "https://platform.kimi.ai/docs/agreement/userprivacy",
    when: true,
  },
  {
    name: "Tally",
    role: "Hosts the two research questionnaires",
    data: "Your questionnaire answers",
    where: "European Union",
    policy: "https://tally.so/help/privacy-policy",
    when: true,
  },
  {
    name: "Google",
    role: "Shows the map (Google Maps) and runs augmented reality (Google Play Services for AR)",
    data: "Device and usage information, as described in Google's policy",
    where: "Worldwide",
    policy: "https://policies.google.com/privacy",
    when: true,
  },
  {
    name: "Resend",
    role: "Sends account emails, such as confirmation and password-reset codes",
    data: "Your email address and the email we send you",
    where: "United States and European Union",
    policy: "https://resend.com/legal/privacy-policy",
    when: FEATURES.accounts,
  },
];
