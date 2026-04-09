import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";

export interface HeadlessChromiumSession {
  host: string;
  port: number;
  stop: () => Promise<void>;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let payload = "";
      response.on("data", (chunk) => {
        payload += chunk;
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(payload));
        } catch {
          reject(new Error(`Invalid JSON response from ${url}`));
        }
      });
    });

    request.on("error", reject);
    request.setTimeout(1000, () => {
      request.destroy(new Error(`Request timeout for ${url}`));
    });
  });
}

async function waitForCdp(host: string, port: number): Promise<void> {
  const deadline = Date.now() + 20000;

  while (Date.now() < deadline) {
    try {
      await getJson(`http://${host}:${port}/json/version`);
      return;
    } catch {
      await wait(250);
    }
  }

  throw new Error(`CDP did not become ready at ${host}:${port}`);
}

function resolveChromeBinary(): string {
  const override = process.env.CHROME_BIN;
  if (override && override.length > 0) {
    return override;
  }

  return "chromium";
}

function startProcess(port: number): ChildProcess {
  const chromeBinary = resolveChromeBinary();
  const args = [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-gpu-sandbox",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${port}`,
    "about:blank",
  ];

  return spawn(chromeBinary, args, {
    stdio: ["ignore", "ignore", "pipe"],
  });
}

async function shutdownProcess(processHandle: ChildProcess): Promise<void> {
  if (processHandle.killed || processHandle.exitCode !== null) {
    return;
  }

  processHandle.kill("SIGTERM");

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      processHandle.kill("SIGKILL");
      resolve();
    }, 2000);

    processHandle.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

export async function startHeadlessChromium(
  host: string,
  port: number,
): Promise<HeadlessChromiumSession> {
  const processHandle = startProcess(port);

  await new Promise<void>((resolve, reject) => {
    processHandle.once("error", (error) => {
      reject(error);
    });

    processHandle.stderr?.once("data", () => {
      resolve();
    });

    setTimeout(resolve, 500);
  });

  await waitForCdp(host, port);

  return {
    host,
    port,
    stop: async () => {
      await shutdownProcess(processHandle);
    },
  };
}
