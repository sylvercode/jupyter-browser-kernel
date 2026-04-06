import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import CDP from "chrome-remote-interface";

import { connectToBrowserTarget } from "../../../src/transport/browser-connect.js";
import { coreTargetProfile } from "../../../src/profile/core-target-profile.js";
import { startHeadlessChromium } from "../helpers/headless-chromium.js";

const runIntegration = process.env.RUN_CDP_INTEGRATION === "1";
const host = process.env.CDP_HOST ?? "127.0.0.1";
const cdpPort = Number(process.env.CDP_PORT ?? "9222");
const appPort = Number(process.env.CDP_APP_PORT ?? "9322");

let chromiumStop: (() => Promise<void>) | undefined;
let appServer: http.Server | undefined;

before(async () => {
  if (!runIntegration) {
    return;
  }

  const chromium = await startHeadlessChromium(host, cdpPort);
  chromiumStop = chromium.stop;

  appServer = http.createServer((request, response) => {
    if (request.url === "/game") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<html><body>foundry-target</body></html>");
      return;
    }

    response.writeHead(200, { "content-type": "text/html" });
    response.end("<html><body>generic-target</body></html>");
  });

  await new Promise<void>((resolve, reject) => {
    appServer?.once("error", reject);
    appServer?.listen(appPort, host, () => {
      resolve();
    });
  });

  const browser = await CDP({ host, port: cdpPort });
  await browser.Target.createTarget({ url: `http://${host}:${appPort}/game` });
  await browser.close();
});

after(async () => {
  await new Promise<void>((resolve) => {
    if (!appServer) {
      resolve();
      return;
    }

    appServer.close(() => {
      resolve();
    });
  });

  if (chromiumStop) {
    await chromiumStop();
  }
});

test(
  "connectToBrowserTarget (core profile) attaches to a page target in headless Chromium",
  { skip: !runIntegration },
  async () => {
    const result = await connectToBrowserTarget(
      { host, port: cdpPort },
      coreTargetProfile,
    );

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(typeof result.connectedTarget.targetId, "string");
      assert.equal(typeof result.connectedTarget.sessionId, "string");
      assert.equal(result.connectedTarget.targetId.length > 0, true);
      assert.equal(result.connectedTarget.sessionId.length > 0, true);
    }
  },
);
