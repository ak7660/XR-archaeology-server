import { useRef, Suspense, type ReactElement, type ReactNode } from "react";
import type { NextPage, NextPageContext } from "next";
import type { AppProps } from "next/app";
import Head from "next/head";
import { FeathersProvider } from "@/contexts/feathers";
import { HeaderProvider } from "@/contexts/header";
import { SchemasProvider } from "@/contexts/schemas";
import { ViewSettingProvider } from "@/contexts/viewSettings";
import { AuthProvider } from "@/contexts/auth";

import "../styles/main.css";
import "../plugins/i18n";

// server-side only code: to configure server api URL
MyApp.getInitialProps = async (ctx: NextPageContext) => {
  try {
    const { def: configs } = await import("@configs");
    // temp VPN for transferring dev api url
    const baseURL = configs.prod ? configs.getUrl("internal") : process.env.API_URL ?? configs.getUrl("api");
    return { baseURL };
  } catch (error) {
    return {};
  }
};

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
  baseURL?: string;
};

export default function MyApp({ Component, baseURL, pageProps }: AppPropsWithLayout) {
  // Use the layout defined at the page level, if available
  const getLayout = Component.getLayout ?? ((page) => page);
  const baseUrl = useRef<string>(baseURL); // fix next.js buggy refetch from server each time client navigate
  return (
    <>
      <Head>
        <title>APSAP</title>
        {/* <link rel="icon" href="/favicon.ico" /> */}
      </Head>
      <FeathersProvider baseURL={baseUrl.current}>
        <AuthProvider>
          <SchemasProvider>
            <ViewSettingProvider>
              <HeaderProvider>
                <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                  {getLayout(<Component {...pageProps} />)}
                </Suspense>
              </HeaderProvider>
            </ViewSettingProvider>
          </SchemasProvider>
        </AuthProvider>
      </FeathersProvider>
    </>
  );
}
