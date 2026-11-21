// Renders tools/render-scene.html in headless Chromium and writes
// assets/salon.jpg plus assets/scene.js (gift and light positions).
// Usage: node tools/render.js   (needs the `playwright` package)
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

(async () => {
  const root = path.resolve(__dirname, "..");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 2000, height: 1200 } });
  await page.goto("file://" + path.join(__dirname, "render-scene.html"));
  await page.waitForFunction("window.DONE", null, { timeout: 180000 });
  const out = await page.evaluate(() => ({ meta: window.META, jpg: document.getElementById("c").toDataURL("image/jpeg", 0.88) }));
  await browser.close();

  fs.writeFileSync(path.join(root, "assets/salon.jpg"), Buffer.from(out.jpg.split(",")[1], "base64"));
  const gifts = out.meta.gifts.map(({ i, ...g }) => g);
  const twinkle = out.meta.twinkle.filter((t) => t.y < 60).slice(0, 40).map((t) => [t.x, t.y]);
  fs.writeFileSync(path.join(root, "assets/scene.js"),
    "// Positions (in % of the scene) of each gift and twinkling light in assets/salon.jpg.\n" +
    "// Regenerate with: node tools/render.js\n" +
    "window.MDS_SCENE = {\n  gifts: " + JSON.stringify(gifts) + ",\n  twinkle: " + JSON.stringify(twinkle) + "\n};\n");
  console.log(`assets/salon.jpg + assets/scene.js written (${gifts.length} gifts)`);
})();
