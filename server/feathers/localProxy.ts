/**
 * Serves one of this process's own servers under a path prefix of another, e.g.
 * the public API (port 3002) at `/app` on the admin API's port (9000).
 *
 * Railway gives a service only one *.up.railway.app domain, and that one points
 * at port 9000. Until a custom domain for the public API resolves, the app reaches
 * it as https://<that domain>/app/api/... - REST requests and the socket.io
 * WebSocket are both forwarded to localhost untouched, headers included, so
 * X-Forwarded-For (rate limits) and Authorization still arrive as sent.
 */
import http from "http";
import net from "net";
import type { Express } from "express";

function stripPrefix(url: string, prefix: string) {
  const rest = url.slice(prefix.length);
  return rest.startsWith("/") ? rest : "/" + rest;
}

function matches(url: string | undefined, prefix: string) {
  return !!url && (url === prefix || url.startsWith(prefix + "/") || url.startsWith(prefix + "?"));
}

/** Forward plain HTTP requests. Mount before anything that reads request bodies. */
export function mountHttpProxy(app: Express, prefix: string, targetPort: number | string) {
  app.use((req, res, next) => {
    if (!matches(req.url, prefix)) return next();
    const upstream = http.request(
      {
        host: "127.0.0.1",
        port: Number(targetPort),
        method: req.method,
        path: stripPrefix(req.url, prefix),
        headers: req.headers,
      },
      (upRes) => {
        res.writeHead(upRes.statusCode || 502, upRes.headers);
        upRes.pipe(res);
      }
    );
    upstream.on("error", (err) => {
      console.warn(`[proxy ${prefix}] request failed`, err.message);
      if (!res.headersSent) res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "The app server is starting up. Please try again in a moment." }));
    });
    req.pipe(upstream);
  });
}

/** Forward WebSocket upgrades (socket.io). */
export function mountUpgradeProxy(server: http.Server, prefix: string, targetPort: number | string) {
  server.on("upgrade", (req, socket, head) => {
    if (!matches(req.url, prefix)) return; // someone else's (e.g. this server's own socket.io)
    const upstream = net.connect(Number(targetPort), "127.0.0.1", () => {
      const lines = [`${req.method} ${stripPrefix(req.url!, prefix)} HTTP/${req.httpVersion}`];
      for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
      upstream.write(lines.join("\r\n") + "\r\n\r\n");
      if (head?.length) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    const close = () => {
      socket.destroy();
      upstream.destroy();
    };
    upstream.on("error", close);
    socket.on("error", close);
    upstream.on("close", () => socket.destroy());
    socket.on("close", () => upstream.destroy());
  });
}
