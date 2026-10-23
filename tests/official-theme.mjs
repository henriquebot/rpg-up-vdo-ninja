import assert from "node:assert/strict";
import { themeCSS, encodeThemeCSS } from "../src/theme.js";
import { presentationCSS } from "../src/presentation.js";

const { chromium } = await import("playwright");

// Probe the official VDO website and CSS injection. No user media or signalling.
// Fake feeds do not mount video tiles in its DOM. Attach a temporary test video
// with the same class as the official renderer to verify injected CSS.
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 900, height: 600 } });
  await context.routeWebSocket(/.*/, ws => ws.close());
  const page = await context.newPage();
  const theme = themeCSS({ theme: "scifi", slots: { probe: "slot_test" } }, [{ id: "probe", color: "#aabbdd" }]);
  const target = new URL("https://vdo.ninja/");
  target.searchParams.set("room", "RPGUPVisualSmoke");
  target.searchParams.set("scene", "");
  target.searchParams.set("fakeguests", "2");
  target.searchParams.set("videodevice", "0");
  target.searchParams.set("audiodevice", "0");
  target.searchParams.set("noaudio", "");
  target.searchParams.set("meterstyle", "2");
  target.searchParams.set("base64css", encodeThemeCSS(theme));
  assert.ok(target.href.length <= 6900, "Real VDO URL must not risk nginx 414");
  const response = await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: 40000 });
  assert.equal(response?.status(), 200);
  await page.waitForFunction(() => globalThis.session?.fakeFeeds?.length === 2 &&
    session.fakeFeeds.every(video => video.videoWidth > 0), undefined, { timeout: 45000 });
  const result = await page.evaluate(() => {
    // Fake guests are detached test feeds; they are not actual peers.
    const tile = document.createElement("video");
    tile.className = "tile";
    tile.dataset.streamid = "slot_test";
    tile.style.width = "320px";
    tile.style.height = "180px";
    document.body.append(tile);
    const styles = getComputedStyle(tile);
    const data = {
      version: session.version,
      meterStyle: session.meterStyle,
      shadow: styles.boxShadow,
      outline: styles.outlineStyle,
      outlineColor: styles.outlineColor,
      appliedColor: styles.getPropertyValue("--c").trim()
    };
    tile.remove();
    return data;
  });
  assert.equal(String(result.meterStyle), "2", "Official VDO must recognize native speaker meter");
  assert.notEqual(result.shadow, "none", "Official VDO must apply Sci-fi glow CSS");
  assert.notEqual(result.outline, "none", "Official VDO must apply the camera outline");
  assert.equal(result.appliedColor, "#aabbdd", "Stream ID selects Foundry user color");
  // Upstream compatibility probe: the real VDO website (not our fixture)
  // must accept the documented iframe style command sent by the parent.
  const host = await context.newPage();
  await host.goto("about:blank");
  const betaURL = new URL("https://vdo.ninja/");
  betaURL.searchParams.set("room", "RPGUPBetaProbe");
  betaURL.searchParams.set("push", "rpgup_beta_probe");
  betaURL.searchParams.set("videodevice", "0");
  betaURL.searchParams.set("audiodevice", "0");
  betaURL.searchParams.set("noaudio", "");
  betaURL.searchParams.set("showheader", "");
  await host.evaluate(url => new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("allow", "camera; microphone; autoplay; fullscreen");
    iframe.onload = resolve;
    iframe.onerror = () => reject(new Error("VDO beta iframe indisponível"));
    iframe.src = url;
    document.body.append(iframe);
  }), betaURL.href);
  const header = host.frameLocator("iframe").locator("#header");
  await header.waitFor({ state: "attached" });
  const css = presentationCSS("minimal") + "#header{--rpgup-beta-probe:yes!important}";
  await host.locator("iframe").evaluate((iframe, cssText) =>
    iframe.contentWindow.postMessage({ style: cssText }, "https://vdo.ninja"), css);
  const accepted = await header.evaluate(async element => {
    for (let n = 0; n < 40; n++) {
      if (getComputedStyle(element).getPropertyValue("--rpgup-beta-probe").trim() === "yes") return true;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  });
  assert.equal(accepted, true, "Official VDO.Ninja iframe must accept its documented style postMessage command");
  await host.close();
  console.log("Official VDO CSS and meter parse smoke OK:", JSON.stringify(result));
} finally { await browser.close(); }
