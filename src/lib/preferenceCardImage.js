/**
 * Draw a privacy-safe preference pattern card to canvas and download as PNG.
 * Preferences only — no address, price, or photo.
 */
import { APP_NAME } from "@/core/constants";

/**
 * @param {{
 *   summary_line?: string,
 *   homes_scored?: number,
 *   top_priorities?: Array<{ label?: string, avg_importance?: number }>,
 *   display_name?: string | null,
 * }} card
 */
export function downloadPreferenceCardPng(card) {
  if (typeof document === "undefined") return;
  const width = 1200;
  const height = 630;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Atmosphere — soft navy → teal, not flat white
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#0f172a");
  bg.addColorStop(0.55, "#132337");
  bg.addColorStop(1, "#0d3d36");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle arc accent
  ctx.beginPath();
  ctx.arc(width - 80, 80, 220, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(16, 107, 73, 0.08)";
  ctx.fill();

  ctx.fillStyle = "#106B49";
  ctx.font = "700 28px system-ui, -apple-system, sans-serif";
  ctx.fillText(APP_NAME, 64, 72);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 18px system-ui, -apple-system, sans-serif";
  ctx.fillText("Scoring preference pattern", 64, 108);

  const priorities = (card?.top_priorities || []).slice(0, 3);
  const homes = Number(card?.homes_scored) || 0;
  const headline =
    homes > 0
      ? `Based on ${homes} home${homes === 1 ? "" : "s"} scored`
      : "From saved scoring preferences";

  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 44px Georgia, 'Times New Roman', serif";
  wrapText(ctx, headline, 64, 190, width - 128, 52);

  let y = 300;
  priorities.forEach((p, i) => {
    const label = p?.label || `Priority ${i + 1}`;
    const avg = p?.avg_importance != null ? Number(p.avg_importance).toFixed(1) : "—";
    ctx.fillStyle = "#106B49";
    ctx.font = "700 22px system-ui, -apple-system, sans-serif";
    ctx.fillText(`${i + 1}.`, 64, y);
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "600 28px system-ui, -apple-system, sans-serif";
    ctx.fillText(label, 110, y);
    ctx.fillStyle = "rgba(148, 163, 184, 0.95)";
    ctx.font = "500 20px system-ui, -apple-system, sans-serif";
    ctx.fillText(`avg importance ${avg}/10`, 110, y + 32);
    y += 78;
  });

  ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
  ctx.font = "500 16px system-ui, -apple-system, sans-serif";
  ctx.fillText("Preferences only · no addresses, prices, or photos", 64, height - 48);

  const link = document.createElement("a");
  link.download = "property-pocket-preference-pattern.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(" ");
  let line = "";
  let cy = y;
  for (let n = 0; n < words.length; n += 1) {
    const test = line ? `${line} ${words[n]}` : words[n];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = words[n];
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}
