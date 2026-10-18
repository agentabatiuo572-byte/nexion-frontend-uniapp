import { expect, it } from "vitest";
import { apiEnvironmentBadgeLabel, readApiRuntimeConfig } from "./runtime-config";

it("labels the configured TEST API without calling it a local development service", () => {
  const localLabel = "Development environment · local Java service";
  expect(apiEnvironmentBadgeLabel({ environment: "dev", baseUrl: "https://18.142.169.24" }, localLabel))
    .toBe("UVEL TEST");
  expect(apiEnvironmentBadgeLabel({ environment: "dev", baseUrl: "http://127.0.0.1:5173" }, localLabel))
    .toBe(localLabel);
  expect(apiEnvironmentBadgeLabel({ environment: "dev", baseUrl: "https://18.142.169.24.example.com" }, localLabel))
    .toBe("");
  expect(apiEnvironmentBadgeLabel({ environment: "prod", baseUrl: "https://api.example.com" }, localLabel))
    .toBe("");
});

it("labels a TEST proxy without changing the browser's same-origin API URL", () => {
  const config = readApiRuntimeConfig({ VITE_NEXGRID_API_PREVIEW_TARGET: "https://18.142.169.24" }, "http://127.0.0.1:5176");
  expect(config.baseUrl).toBe("http://127.0.0.1:5176");
  expect(apiEnvironmentBadgeLabel(config, "Local Java")).toBe("UVEL TEST");
  expect(apiEnvironmentBadgeLabel({ ...config, environment: "prod" }, "Local Java")).toBe("");
  expect(apiEnvironmentBadgeLabel({ ...config, baseUrl: "https://other.example" }, "Local Java")).toBe("");
});
