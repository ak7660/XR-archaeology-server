import { createContext, PropsWithChildren, useContext, useLayoutEffect, useRef, useState } from "react";
import { feathers, Application } from "@feathersjs/feathers";
import fio from "@feathersjs/socketio-client";
import socketio from "socket.io-client";

let connected = false;

function createClient(baseURL?: string) {
  let apiURL = "";
  let baseHost = "";
  if (baseURL) {
    baseHost = baseURL;
  }
  apiURL = baseHost + "/api";

  console.log("Feathers client connecting to:", apiURL);

  const socket = socketio(baseHost, {
    path: "/api/socket.io",
    transports: ["websocket"],
  });
  socket.on("connect", function () {
    console.log("Socket connected");
    connected = true;
  });
  socket.on("reconnect", function () {
    console.log("Socket reconnected");
  });
  socket.on("disconnect", function () {
    console.log("Socket disconnects");
    connected = false;
  });
  socket.on("connect_error", (err) => {
    console.warn("Client connect error:", err.message);
  });
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
  const feathers = useRef<Application>(createClient(baseURL));

  return <FeathersContext.Provider value={feathers.current}>{children}</FeathersContext.Provider>;
};
export const useFeathers = () => {
  const feathers = useContext(FeathersContext);
  if (!feathers) throw new Error("useFeathers must be used inside FeathersProvider");
  return feathers;
};
