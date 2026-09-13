import Head from "next/head";
import Link from "next/link";
import moment from "moment";
import type { ReactNode } from "react";
import { CONTACT, LAST_UPDATED, OPERATOR, PROCESSORS } from "@/plugins/legal";
import styles from "./legal.module.css";

const PAGES = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/delete-account", label: "Delete your data" },
];

interface LegalPageProps {
  /** Path of this page, so the nav can mark it as current. */
  path: string;
  title: string;
  description: string;
  intro: ReactNode;
  children: ReactNode;
}

/** Shell for the public legal pages: plain header, readable column, contact footer.
 * Rendered without the admin layout, so visitors never need to log in. */
export default function LegalPage({ path, title, description, intro, children }: LegalPageProps) {
  const pageTitle = `${title} · ${OPERATOR.name}`;
  return (
    <div className={styles.page}>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <header className={styles.bar}>
        <div className={styles.barInner}>
          <Link href="/privacy" className={styles.wordmark}>
            {OPERATOR.name}
          </Link>
          <nav className={styles.nav} aria-label="Legal pages">
            {PAGES.map((p) => (
              <Link key={p.href} href={p.href} aria-current={p.href === path ? "page" : undefined}>
                {p.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.head}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.updated}>Last updated {moment(LAST_UPDATED, "YYYY-MM-DD").format("D MMMM YYYY")}</p>
          <p className={styles.intro}>{intro}</p>
        </div>
        {children}
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>
            {OPERATOR.name} is {OPERATOR.description}.
          </span>
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
        </div>
      </footer>
    </div>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      {children}
    </section>
  );
}

/** Contact details as a short list, used wherever a page tells people how to reach us. */
export function ContactDetails() {
  return (
    <ul className={styles.contactList}>
      <li>
        Email: <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
      </li>
      <li>
        Phone: <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
      </li>
    </ul>
  );
}

/** The outside companies that currently handle data for us. */
export function ProcessorTable() {
  const rows = PROCESSORS.filter((p) => p.when);
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Company</th>
            <th scope="col">What they do for us</th>
            <th scope="col">What they receive</th>
            <th scope="col">Where</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.name}>
              <td>
                <a href={p.policy} target="_blank" rel="noopener noreferrer">
                  {p.name}
                </a>
              </td>
              <td>{p.role}</td>
              <td>{p.data}</td>
              <td>{p.where}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { styles as legalStyles };
