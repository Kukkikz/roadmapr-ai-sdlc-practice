import { test as base } from "@playwright/test";

// Rate limits are keyed on IP, and every Playwright browser shares 127.0.0.1. Give each test
// its own made-up address so the limits never leak between tests, retries or reruns.
export const randomIp = () =>
  `10.${[1, 2, 3].map(() => 1 + Math.floor(Math.random() * 250)).join(".")}`;

export const test = base.extend({
  extraHTTPHeaders: async ({}, provide) => {
    await provide({ "x-forwarded-for": randomIp() });
  },
});
