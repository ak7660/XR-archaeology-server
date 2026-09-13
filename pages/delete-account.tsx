import Link from "next/link";
import type { NextPageWithLayout } from "./_app";
import LegalPage, { ContactDetails, Section, legalStyles as styles } from "@/components/legal/layout";
import { CONTACT, DELETION_DAYS, FEATURES, OPERATOR } from "@/plugins/legal";

/** Public data-deletion page, at /delete-account. Google Play asks apps with
 * accounts for a web page like this, reachable without installing the app.
 * What it says depends on the switches in plugins/legal.ts. */
const DeleteAccountPage: NextPageWithLayout = () => {
  const mailto = (subject: string) => `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}`;

  return (
    <LegalPage
      path="/delete-account"
      title={FEATURES.accounts ? "Delete your account and data" : "Delete your data"}
      description={`How to delete your ${OPERATOR.name} account and the information the app holds about you.`}
      intro={
        FEATURES.accounts ? (
          <>How to delete your {OPERATOR.name} account, and what happens to your information when you do.</>
        ) : (
          <>How to remove the information the {OPERATOR.name} app holds about you.</>
        )
      }
    >
      {FEATURES.accounts ? (
        <>
          <Section id="in-app" title="Delete your account in the app">
            <ol>
              <li>Open the {OPERATOR.name} app and sign in.</li>
              <li>
                Go to <strong>Account</strong>, then <strong>Profile</strong>.
              </li>
              <li>
                Tap <strong>Delete account</strong> and confirm.
              </li>
            </ol>
            <p>
              You're signed out straight away and your account can no longer be used. Everything listed below is removed from
              our systems within {DELETION_DAYS} days.
            </p>
          </Section>

          <Section id="by-email" title="Can't open the app?">
            <p>
              Email us from the address you use for your account, with the subject{" "}
              <a href={mailto("Delete my account")}>Delete my account</a>. We'll reply to confirm it's you, then delete the
              account within {DELETION_DAYS} days.
            </p>
          </Section>

          <Section id="what" title="What's deleted, and what's kept">
            <p>We delete:</p>
            <ul>
              <li>your name, email address, phone number and password;</li>
              <li>your favourites and augmented-reality collection;</li>
              {FEATURES.eventBookings && <li>your event bookings;</li>}
              {FEATURES.plannerHistory && <li>your trip planner conversations.</li>}
            </ul>
            <p>We keep:</p>
            <ul>
              {FEATURES.linkedFeedback && (
                <li>
                  your questionnaire answers, with the link to your account removed, so they can't be traced back to you. They're
                  kept for the research until the project ends. Ask us if you'd like them deleted too.
                </li>
              )}
              <li>technical logs, which our hosting provider keeps for a limited period and then deletes.</li>
            </ul>
          </Section>
        </>
      ) : (
        <>
          <div className={styles.summary}>
            <h2>There's no account to delete</h2>
            <p>
              The {OPERATOR.name} app doesn't have user accounts yet, so it doesn't hold a profile about you. Here's how to
              remove what does exist.
            </p>
          </div>

          <Section id="phone" title="Information on your phone">
            <p>
              Your favourites, language choice and settings are stored only on your phone. To delete them, uninstall the app, or
              go to your phone's <strong>Settings</strong>, then <strong>Apps</strong>, then <strong>{OPERATOR.name}</strong>,
              then <strong>Storage</strong>, and tap <strong>Clear storage</strong>.
            </p>
          </Section>

          <Section id="questionnaires" title="Questionnaire answers">
            <p>
              If you answered one of the questionnaires and want your answers deleted, email us with the subject{" "}
              <a href={mailto("Delete my questionnaire answers")}>Delete my questionnaire answers</a>. Your answers aren't linked
              to your name, so tell us which questionnaire it was, roughly when you answered it, and something you wrote, so we
              can find them. We'll delete them within {DELETION_DAYS} days and let you know.
            </p>
          </Section>

          <Section id="planner" title="Trip planner conversations">
            <p>
              We don't save trip planner conversations. They're wiped whenever our server restarts and aren't linked to you, so
              there's nothing to request from us. Moonshot AI, which writes the replies, keeps them according to its own policy.
            </p>
          </Section>
        </>
      )}

      <Section id="contact" title="Contact us">
        <p>
          If you have questions about deleting your information, get in touch. You can read more in our{" "}
          <Link href="/privacy">privacy policy</Link>.
        </p>
        <ContactDetails />
      </Section>
    </LegalPage>
  );
};

DeleteAccountPage.standalone = true;

export default DeleteAccountPage;
