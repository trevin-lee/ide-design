import type { Browser } from "playwright-core";

/**
 * Launch a headless Chromium for export. Uses the Chrome already installed on
 * the machine, so ided does not download a browser of its own.
 */
export async function launchBrowser(): Promise<Browser> {
  const { chromium } = await import("playwright-core");
  const attempts: Parameters<typeof chromium.launch>[0][] = [];
  if (process.env.IDED_CHROME_PATH) attempts.push({ executablePath: process.env.IDED_CHROME_PATH });
  attempts.push({ channel: "chrome" }, { channel: "msedge" }, { channel: "chromium" }, {});
  let last: unknown;
  for (const a of attempts) {
    try {
      return await chromium.launch({ headless: true, ...a });
    } catch (e) {
      last = e;
    }
  }
  throw new Error(
    `Export needs a Chromium browser and none was found.\n` +
      `Install Google Chrome, set IDED_CHROME_PATH=/path/to/chrome, or run \`npx playwright install chromium\`.\n` +
      `(${(last as Error)?.message?.split("\n")[0] ?? "unknown error"})`,
  );
}

export async function withBrowser<T>(fn: (b: Browser) => Promise<T>): Promise<T> {
  const b = await launchBrowser();
  try {
    return await fn(b);
  } finally {
    await b.close();
  }
}
