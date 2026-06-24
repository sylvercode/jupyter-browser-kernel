import type { EndpointConfigurationReader } from "../../../src/config/endpoint-config";

export function makeSettings(
  host: string,
  port: number,
): EndpointConfigurationReader {
  return {
    get<T>(section: string, defaultValue: T): T {
      if (section === "cdpHost") return host as unknown as T;
      if (section === "cdpPort") return port as unknown as T;
      return defaultValue;
    },
  };
}
