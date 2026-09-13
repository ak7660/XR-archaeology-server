/**
 * Account emails, sent through Resend (https://resend.com/docs/api-reference/emails/send-email).
 *
 * Needs RESEND_API_KEY and MAIL_FROM. Without a key outside production, emails
 * are printed to the console instead, so sign-up can be exercised locally.
 */
import { CONTACT } from "@/plugins/legal";

export type MailLanguage = "en" | "hy" | "ru";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendMail(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "Veditourism <no-reply@veditourism.com>";
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not set; cannot send email");
    console.log(`[mail:dev] to=${mail.to} subject=${JSON.stringify(mail.subject)}\n${mail.text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [mail.to],
      // no-reply@ has no mailbox, so replies go to the project's contact address.
      reply_to: CONTACT.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend rejected the email (${res.status}): ${body.slice(0, 300)}`);
  }
}

export type CodePurpose = "verify" | "reset";

const COPY: Record<
  MailLanguage,
  Record<CodePurpose, { subject: (code: string) => string; intro: string }> & { expires: (minutes: number) => string; ignore: string }
> = {
  en: {
    verify: {
      subject: (code) => `${code} is your Veditourism confirmation code`,
      intro: "Enter this code in the Veditourism app to confirm your email address:",
    },
    reset: {
      subject: (code) => `${code} is your Veditourism password reset code`,
      intro: "Enter this code in the Veditourism app to choose a new password:",
    },
    expires: (m) => `The code expires in ${m} minutes and can only be used once.`,
    ignore: "If you didn't ask for this, you can ignore this email. Nothing will change.",
  },
  hy: {
    verify: {
      subject: (code) => `${code}՝ ձեր Veditourism հաստատման կոդը`,
      intro: "Մուտքագրեք այս կոդը Veditourism հավելվածում՝ ձեր էլ. հասցեն հաստատելու համար։",
    },
    reset: {
      subject: (code) => `${code}՝ ձեր Veditourism գաղտնաբառի վերականգնման կոդը`,
      intro: "Մուտքագրեք այս կոդը Veditourism հավելվածում՝ նոր գաղտնաբառ ընտրելու համար։",
    },
    expires: (m) => `Կոդը գործում է ${m} րոպե և կարող է օգտագործվել միայն մեկ անգամ։`,
    ignore: "Եթե դուք սա չեք խնդրել, կարող եք անտեսել այս նամակը։ Ոչինչ չի փոխվի։",
  },
  ru: {
    verify: {
      subject: (code) => `${code} — ваш код подтверждения Veditourism`,
      intro: "Введите этот код в приложении Veditourism, чтобы подтвердить адрес электронной почты:",
    },
    reset: {
      subject: (code) => `${code} — ваш код для сброса пароля Veditourism`,
      intro: "Введите этот код в приложении Veditourism, чтобы выбрать новый пароль:",
    },
    expires: (m) => `Код действует ${m} минут и может быть использован только один раз.`,
    ignore: "Если вы не запрашивали код, просто проигнорируйте это письмо. Ничего не изменится.",
  },
};

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The email carrying a one-time code, in the user's app language. */
export function codeMail(to: string, code: string, purpose: CodePurpose, minutes: number, language?: string): Mail {
  const lang: MailLanguage = language === "hy" || language === "ru" ? language : "en";
  const copy = COPY[lang];
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const text = `Veditourism\n\n${copy[purpose].intro}\n\n${spaced}\n\n${copy.expires(minutes)}\n\n${copy.ignore}\n`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1b2730">
<p style="font-family:Georgia,serif;font-size:20px;font-weight:700;margin:0 0 20px">Veditourism</p>
<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(copy[purpose].intro)}</p>
<p style="font-size:32px;letter-spacing:6px;font-weight:700;margin:20px 0;color:#0160D6">${spaced}</p>
<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(copy.expires(minutes))}</p>
<p style="margin:0;color:#56646e;font-size:13px;line-height:1.5">${escapeHtml(copy.ignore)}</p>
</div>`;
  return { to, subject: copy[purpose].subject(code), text, html };
}
