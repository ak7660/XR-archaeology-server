import Link from "next/link";
import type { NextPageWithLayout } from "./_app";
import LegalPage, { ContactDetails, ProcessorTable, Section, legalStyles as styles } from "@/components/legal/layout";
import { CONTACT, DELETION_DAYS, FEATURES, OPERATOR } from "@/plugins/legal";

/** Public privacy policy for the Veditourism app, at /privacy.
 * What it says depends on the switches in plugins/legal.ts - keep them true to
 * what the released app does. */
const PrivacyPolicyPage: NextPageWithLayout = () => {
  const sections = [
    { id: "who", title: "Who we are" },
    { id: "collect", title: "What the app collects" },
    { id: "accounts", title: "Accounts" },
    { id: "why", title: "Why we use it" },
    { id: "sharing", title: "Who else handles it" },
    { id: "storage", title: "Where it’s kept, and for how long" },
    { id: "security", title: "Keeping it safe" },
    { id: "rights", title: "Your choices and rights" },
    { id: "children", title: "Children" },
    { id: "changes", title: "Changes to this policy" },
    { id: "contact", title: "Contact us" },
  ];

  return (
    <LegalPage
      path="/privacy"
      title="Privacy policy"
      description="How the Veditourism app handles your information."
      intro={
        <>
          This policy explains what information the {OPERATOR.name} app collects when you use it to explore Vedi and its
          surroundings, why, and what you can do about it.
        </>
      }
    >
      <div className={styles.summary}>
        <h2>The short version</h2>
        <ul>
          <li>Your location and camera are used on your phone for the map and augmented reality. They aren’t sent to us.</li>
          <li>Messages you type in the AI trip planner go to our server and to Moonshot AI, which writes the replies.</li>
          <li>The questionnaires are optional. Your answers are used to evaluate the app as part of a university research project.</li>
          <li>There are no ads or tracking tools, and we never sell your information.</li>
          <li>
            You can ask us to see or delete your information at any time: <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>.
          </li>
        </ul>
      </div>

      <nav className={styles.contents} aria-label="On this page">
        <h2>On this page</h2>
        <ol>
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      <Section id="who" title="Who we are">
        <p>
          {OPERATOR.name} is {OPERATOR.description}. It makes a free mobile app and this website to help visitors discover the
          history of Vedi, Armenia, including augmented-reality reconstructions, maps, events and an AI trip planner. We’re
          responsible for the information described here. You can reach us using the details under{" "}
          <a href="#contact">Contact us</a>.
        </p>
      </Section>

      <Section id="collect" title="What the app collects">
        <h3>Your location</h3>
        <p>
          If you allow it, the app uses your phone’s location to show where you are on the map, how far you are from each site,
          and when to start an augmented-reality scene. This happens on your phone. Your location isn’t sent to our servers or
          stored. The app only uses location while it’s open. If you don’t allow it, you can still browse everything, but the
          map and augmented reality won’t know where you are.
        </p>

        <h3>Your camera</h3>
        <p>
          The camera is only used for augmented reality, to place reconstructions over the real view. The camera feed is
          processed on your phone and isn’t recorded or uploaded. If you take a photo during augmented reality, it’s saved to
          your phone’s gallery and isn’t uploaded.
        </p>
        <p>
          This application runs on Google Play Services for AR (ARCore), which is provided by Google and governed by the{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
            Google Privacy Policy
          </a>
          .
        </p>

        <h3>Audio</h3>
        <p>
          The app has no feature that records or listens to audio. When the app reads text aloud, it uses your phone’s own
          speech engine.
        </p>

        <h3>Things saved on your phone</h3>
        <p>
          The places you save as favourites, your language choice and whether you’ve seen the welcome questionnaire are stored
          on your phone. {!FEATURES.accounts && "They stay there and aren’t sent to us."}
        </p>

        <h3>The AI trip planner</h3>
        <p>
          When you use the trip planner, the messages you type and the trip details you give it, such as dates, group size,
          interests and language, are sent to our server. Our server passes them to Moonshot AI, whose Kimi model writes the
          replies.{" "}
          {FEATURES.plannerHistory && FEATURES.accounts
            ? "If you’re signed in, the conversation and the plan it produces are saved to your account so you can come back to them. Without an account, the conversation is kept for up to 30 days so it can continue, then deleted automatically."
            : "We don’t save conversations. They’re kept in our server’s memory only while the conversation is going on, aren’t linked to your name, and are wiped whenever the server restarts."}{" "}
          Please don’t type anything sensitive, such as health details or passport numbers, into the planner.
        </p>

        <h3>Questionnaires</h3>
        <p>
          The app offers two optional questionnaires: one when you first open the app and one under Help and feedback. They’re
          part of the university research that evaluates the app. They’re hosted by Tally, so your answers are stored by Tally
          and read by the project team. Each form tells you what it asks before you answer.{" "}
          {FEATURES.linkedFeedback && FEATURES.accounts
            ? "If you’re signed in, your answers are linked to your account so we can tell which answers came from the same person."
            : "Your answers aren’t linked to anything else the app knows about you."}
        </p>

        {FEATURES.eventBookings && FEATURES.accounts && (
          <>
            <h3>Event bookings</h3>
            <p>
              When you book an event, we keep the event, how many people are coming and the name, email address and phone
              number on your account. The event organisers on our team see these to prepare for your visit.
            </p>
          </>
        )}

        <h3>Technical information</h3>
        <p>
          Like any online service, our servers receive technical information with each request, such as your IP address, the
          type of device and app version, and the time. Our hosting provider keeps these logs for a limited period so we can
          keep the service secure and fix problems.
        </p>

        <h3>What we don’t do</h3>
        <p>
          The app has no advertising and no analytics or tracking tools. We don’t build profiles of you, and we never sell or
          rent your information.
        </p>
      </Section>

      <Section id="accounts" title="Accounts">
        {FEATURES.accounts ? (
          <>
            <p>You can use the app without an account. If you create one, we keep:</p>
            <ul>
              <li>your name and email address, and your phone number if you add it;</li>
              <li>
                your password, stored only in a scrambled form (a hash) that can’t be turned back into the password, so we can’t
                read it;
              </li>
              <li>
                your favourites and augmented-reality collection
                {FEATURES.eventBookings && ", your event bookings"}
                {FEATURES.plannerHistory && ", your trip planner conversations"}
                {FEATURES.linkedFeedback && " and which questionnaires you’ve answered"}, so they’re there when you sign in on
                another phone;
              </li>
              <li>
                comments you post in augmented reality. Other signed-in visitors see them with your first and last name, but
                never your email address.
              </li>
            </ul>
            <p>
              We send a few emails that the account needs, such as a code to confirm your address or reset your password
              {FEATURES.eventBookings && ", and confirmations of your bookings"}. We don’t send marketing emails.
            </p>
            {FEATURES.googleSignIn && (
              <>
                <h3>Signing in with Google</h3>
                <p>
                  If you choose “Continue with Google”, Google tells us your name, email address, profile photo and a Google
                  account ID. We don’t receive your Google password or anything else from your Google account. Google’s handling
                  of your sign-in is covered by the{" "}
                  <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                    Google Privacy Policy
                  </a>
                  .
                </p>
              </>
            )}
            <p>
              You can delete your account at any time. <Link href="/delete-account">Here’s how</Link>.
            </p>
          </>
        ) : (
          <p>
            The app doesn’t offer accounts yet. Before we add them, we’ll update this page to describe exactly what an account
            stores.
          </p>
        )}
      </Section>

      <Section id="why" title="Why we use it">
        <ul>
          <li>
            <strong>To provide the features you use.</strong> For example, showing your position on the map or answering you in
            the trip planner.
          </li>
          <li>
            <strong>For research, with your agreement.</strong> Questionnaire answers help the project evaluate how well the app
            works for visitors. Answering is always optional.
          </li>
          <li>
            <strong>To keep the service working and secure.</strong> Technical logs help us spot misuse and fix faults.
          </li>
        </ul>
        <p>We don’t use your information for advertising, and we don’t make automated decisions about you.</p>
      </Section>

      <Section id="sharing" title="Who else handles it">
        <p>
          These companies handle information for us, only to provide the service. Their names link to their own privacy
          policies.
        </p>
        <ProcessorTable />
        <p>
          Within the project, only the team members who run the app can access information on our servers. We’d share
          information with authorities only if the law required it.
        </p>
      </Section>

      <Section id="storage" title="Where it’s kept, and for how long">
        <p>
          Our servers and database are in Singapore. The companies in the table above may handle information in other countries,
          so your information may be processed outside the country where you live.
        </p>
        <ul>
          {FEATURES.accounts && (
            <li>
              <strong>Account information</strong> is kept until you delete your account. We remove it within {DELETION_DAYS} days
              of your request.
            </li>
          )}
          <li>
            <strong>Trip planner conversations</strong>{" "}
            {FEATURES.plannerHistory && FEATURES.accounts
              ? "are kept in your account until you delete them or your account. Conversations without an account are deleted automatically after 30 days without use."
              : "are wiped whenever our server restarts, and aren’t kept anywhere else by us."}{" "}
            Moonshot AI keeps them according to its own policy.
          </li>
          <li>
            <strong>Questionnaire answers</strong> are kept until the research project ends, then deleted or anonymised.
          </li>
          <li>
            <strong>Technical logs</strong> are kept by our hosting provider for a limited period.
          </li>
          <li>
            <strong>Information on your phone</strong> stays until you delete the app or clear its storage.
          </li>
        </ul>
      </Section>

      <Section id="security" title="Keeping it safe">
        <p>
          Information travelling between the app and our servers is encrypted (HTTPS). Access to our servers is limited to the
          project team.{FEATURES.accounts && " Passwords are stored only as hashes."} No system is perfectly secure, so if you
          think something is wrong, please tell us straight away.
        </p>
      </Section>

      <Section id="rights" title="Your choices and rights">
        <ul>
          <li>You can turn location and camera access on or off at any time in your phone’s settings.</li>
          <li>Deleting the app removes everything it saved on your phone.</li>
          <li>
            You can ask us for a copy of the information we hold about you, ask us to correct it, or ask us to delete it. Email{" "}
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> and we’ll reply within 30 days.{" "}
            <Link href="/delete-account">How to delete your data</Link>.
          </li>
          <li>You can withdraw from the research at any time by asking us to delete your questionnaire answers.</li>
        </ul>
        <p>
          If you’re unhappy with how we’ve handled your information, please contact us first. You can also complain to a data
          protection authority. In Hong Kong that’s the{" "}
          <a href="https://www.pcpd.org.hk/" target="_blank" rel="noopener noreferrer">
            Office of the Privacy Commissioner for Personal Data
          </a>
          , and elsewhere it’s the authority where you live.
        </p>
      </Section>

      <Section id="children" title="Children">
        <p>
          The app isn’t aimed at children under 13, and we don’t knowingly collect their information. If you think a child has
          given us information, contact us and we’ll delete it.
        </p>
      </Section>

      <Section id="changes" title="Changes to this policy">
        <p>
          When the app changes what it collects, we update this page and the date at the top. For significant changes, we’ll
          also let you know in the app.
        </p>
      </Section>

      <Section id="contact" title="Contact us">
        <p>For questions about this policy or your information:</p>
        <ContactDetails />
      </Section>
    </LegalPage>
  );
};

PrivacyPolicyPage.standalone = true;

export default PrivacyPolicyPage;
