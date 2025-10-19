import i18n from "i18next";
import detector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";

const prefix = process.env.NEXT_PUBLIC_PAGE_PREFIX || "";

i18n
  .use(Backend)
  .use(initReactI18next)
  .use(detector)
  .init({
    supportedLngs: ["en", "hy"],
    backend: {
      loadPath: prefix && prefix.length > 0 ? `${prefix}/locales/{{lng}}.json` : "/locales/{{lng}}.json",
      crossDomain: false,
      queryStringParams: { v: "1.0.0" },
    },
    fallbackLng: "en",
    preload: ["en", "hy"],
    react: {
      useSuspense: true,
    },
    interpolation: {
      escapeValue: false,
    },
    debug: process.env.NODE_ENV === "development",
  });

export default i18n;
