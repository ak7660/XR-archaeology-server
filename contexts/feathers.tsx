import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";
import { feathers, Application } from "@feathersjs/feathers";
import fio from "@feathersjs/socketio-client";
import socketio from "socket.io-client";

/** The admin CMS talks to the API over a single websocket, opened in the browser.
 *
 * ⚠ It must never be opened while Next.js renders on the server. `pages/_app.tsx`
 * has `getInitialProps`, so **every** request to the site is server-rendered, and
 * a socket opened during a server render is never closed again: React runs no
 * effects and no cleanups there, and the render result is thrown away while the
 * socket lives on in the Node process.
 *
 * That leak is what drove the Railway bill up: by 2026-11-11 the container that
 * had been running since 2026-09-14 held **~6000 permanently open websockets** to
 * its own API — Next.js at 1.7 GB and 0.56 vCPU, the API at 364 MB, both doing
 * nothing but socket.io heartbeats, each heartbeat billed as egress. See
 * `ai_context/07-deployment-railway.md`.
 */
const isBrowser = typeof window !== "undefined";

function createClient(baseURL?: string) {
  const baseHost = baseURL ?? "";
  const apiURL = baseHost + "/api";

  // `autoConnect` is the guard: on the server the client is built so that
  // `app.service(...)` still exists for any code that touches it during a render,
  // but no connection is ever made.
  const socket = socketio(baseHost, {
    path: "/api/socket.io",
    transports: ["websocket"],
    autoConnect: isBrowser,
  });

  if (isBrowser) {
    console.log("Feathers client connecting to:", apiURL);

    socket.on("connect", function () {
      console.log("Socket connected");
    });
    socket.on("reconnect", function () {
      console.log("Socket reconnected");
    });
    socket.on("disconnect", function () {
      console.log("Socket disconnects");
    });
    // Reconnection is endless by design, so the failure is reported a few times
    // and then only occasionally: an unreachable API used to fill the logs.
    let failures = 0;
    socket.on("connect_error", (err) => {
      failures += 1;
      if (failures <= 3 || failures % 50 === 0) {
        console.warn(`Client connect error (${failures}):`, err.message);
      }
    });
  }

  // Set up Socket.io client with the socket. Timeout as 30s
  let app: Application = feathers().configure(fio(socket, { timeout: 30000 }));

  app.post = async function (url: string, data: any, params: any) {
    // authentication with token in header
    return fetch(`${apiURL}/${url}`, {
      method: "POST",
      body: data,
      ...params,
    });
  };

  app.apiURL = apiURL;

  return app;
}

type Props = {
  baseURL?: string;
} & PropsWithChildren<{}>;

export const FeathersContext = createContext<Application | undefined>(undefined);
export const FeathersProvider = ({ children, baseURL }: Props) => {
  // One client per mount. `useRef(createClient(baseURL))` ran createClient on
  // every render and kept only the first result, so every re-render opened
  // another socket and dropped the handle to it.
  const [client] = useState<Application>(() => createClient(baseURL));

  useEffect(() => {
    return () => {
      (client as any).io?.close?.();
    };
  }, [client]);

  return <FeathersContext.Provider value={client}>{children}</FeathersContext.Provider>;
};
export const useFeathers = () => {
  const feathers = useContext(FeathersContext);
  if (!feathers) throw new Error("useFeathers must be used inside FeathersProvider");
  return feathers;
};
