import i18n from "i18next";
import detector from 'i18next-browser-languagedetector';
import { initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";

// see https://nextjs.org/docs/pages/building-your-application/configuring/environment-variables
const prefix = process.env.NEXT_PUBLIC_PAGE_PREFIX || "";

i18n
  .use(Backend)
  .use(initReactI18next)
  .use(detector)
  .init({
    supportedLngs: ['en', 'hy'],
    backend: {
      // When using basePath in Next.js, static files are served from basePath/path
      // Handle both with prefix (/admin/locales/) and without prefix (/locales/)
      loadPath: prefix && prefix.length > 0 ? `${prefix}/locales/{{lng}}.json` : '/locales/{{lng}}.json',
      // Add crossDomain option for better compatibility
      crossDomain: false,
      // Prevent caching issues in production
      queryStringParams: { v: '1.0.0' },
    },
    fallbackLng: "en",
    // Preload languages to ensure they're loaded before page renders
    preload: ['en', 'hy'],
    // Wait for translations to load before rendering
    react: {
      useSuspense: true,
    },
    interpolation: {
      // not needed for react as it escapes by default
      escapeValue: false,
    },
    // Add debug to see what's happening
    debug: process.env.NODE_ENV === 'development',
  });

export default i18n;
