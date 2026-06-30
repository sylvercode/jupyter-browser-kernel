import http from "node:http";
import CDP from "chrome-remote-interface";

import { startHeadlessChromium } from "./headless-chromium.js";

export interface StaticPageRoute {
  path: string;
  body: string;
}

export interface StaticAppServerOptions {
  routes?: StaticPageRoute[];
  defaultBody?: string;
}

export interface FoundryAppServerSession {
  stop: () => Promise<void>;
}

export interface FoundryIntegrationLifecycle {
  stop: () => Promise<void>;
}

export type StaticAppServerSession = FoundryAppServerSession;
export type StaticIntegrationLifecycle = FoundryIntegrationLifecycle;

export async function startStaticAppServer(
  host: string,
  port: number,
  options?: StaticAppServerOptions,
): Promise<StaticAppServerSession> {
  const routeMap = new Map(
    (options?.routes ?? []).map((route) => [route.path, route.body]),
  );
  const defaultBody =
    options?.defaultBody ?? "<html><body>generic-target</body></html>";

  const server = http.createServer((request, response) => {
    const requestPath = request.url
      ? (request.url.split("?")[0] ?? request.url)
      : undefined;
    const routeBody = requestPath ? routeMap.get(requestPath) : undefined;

    response.writeHead(200, { "content-type": "text/html" });
    response.end(routeBody ?? defaultBody);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      resolve();
    });
  });

  return {
    stop: async () => {
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    },
  };
}

export async function startStaticIntegrationLifecycle(
  host: string,
  cdpPort: number,
  appPort: number,
  targetPath: string = "/game",
): Promise<StaticIntegrationLifecycle> {
  const chromium = await startHeadlessChromium(host, cdpPort);
  const appServer = await startStaticAppServer(host, appPort, {
    routes: [
      {
        path: targetPath,
        body: "<html><body>static-target</body></html>",
      },
    ],
  });

  const browser = await CDP({ host, port: cdpPort });
  try {
    await browser.Target.createTarget({
      url: `http://${host}:${appPort}${targetPath}`,
    });
  } finally {
    await browser.close();
  }

  return {
    stop: async () => {
      await chromium.stop();
      await appServer.stop();
    },
  };
}

export async function startFoundryAppServer(
  host: string,
  port: number,
): Promise<FoundryAppServerSession> {
  return startStaticAppServer(host, port, {
    routes: [
      {
        path: "/game",
        body: "<html><body>foundry-target</body></html>",
      },
    ],
  });
}

export async function startFoundryIntegrationLifecycle(
  host: string,
  cdpPort: number,
  appPort: number,
): Promise<FoundryIntegrationLifecycle> {
  return startStaticIntegrationLifecycle(host, cdpPort, appPort, "/game");
}
