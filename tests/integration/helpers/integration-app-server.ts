import http from "node:http";
import CDP from "chrome-remote-interface";

import { startHeadlessChromium } from "./headless-chromium.js";

export interface FoundryAppServerSession {
  stop: () => Promise<void>;
}

export interface FoundryIntegrationLifecycle {
  stop: () => Promise<void>;
}

export async function startFoundryAppServer(
  host: string,
  port: number,
): Promise<FoundryAppServerSession> {
  const server = http.createServer((request, response) => {
    if (request.url === "/game") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<html><body>foundry-target</body></html>");
      return;
    }

    response.writeHead(200, { "content-type": "text/html" });
    response.end("<html><body>generic-target</body></html>");
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

export async function startFoundryIntegrationLifecycle(
  host: string,
  cdpPort: number,
  appPort: number,
): Promise<FoundryIntegrationLifecycle> {
  const chromium = await startHeadlessChromium(host, cdpPort);
  const appServer = await startFoundryAppServer(host, appPort);

  const browser = await CDP({ host, port: cdpPort });
  try {
    await browser.Target.createTarget({
      url: `http://${host}:${appPort}/game`,
    });
  } finally {
    await browser.close();
  }

  return {
    stop: async () => {
      await appServer.stop();
      await chromium.stop();
    },
  };
}
