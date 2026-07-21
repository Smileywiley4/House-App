/**
 * Client-side tour packet PDF (jspdf) — one page per property.
 * Print/phone friendly; not a marketing brochure.
 */
import { jsPDF } from "jspdf";
import { APP_NAME } from "@/core/constants";
import { ALL_BROWSE_SCORE_IDS } from "@/components/browse/scoreCategories";

const CATEGORY_LABELS = {
  hospital_distance: "Hospital distance",
  highway_access: "Highway access",
  schools: "Schools",
  neighborhood_safety: "Neighborhood safety",
  public_transportation: "Public transit",
  location_lifestyle: "Lifestyle location",
  bedroom_count: "Bedrooms",
  bathroom_count: "Bathrooms",
  overall_living_space: "Living space",
  hoa_cost: "HOA cost",
  garage_storage: "Garage / storage",
};

const MARGIN = 14;

function formatPrice(price) {
  if (price == null || price === "") return null;
  const n = Number(price);
  if (!Number.isFinite(n)) return String(price);
  return `$${n.toLocaleString()}`;
}

function formatStats(item) {
  const parts = [];
  if (item.bedrooms != null && item.bedrooms !== "") parts.push(`${item.bedrooms} bd`);
  if (item.bathrooms != null && item.bathrooms !== "") parts.push(`${item.bathrooms} ba`);
  if (item.sqft != null && item.sqft !== "") {
    const n = Number(item.sqft);
    parts.push(Number.isFinite(n) ? `${n.toLocaleString()} sqft` : `${item.sqft} sqft`);
  }
  if (item.year_built != null && item.year_built !== "") parts.push(`Built ${item.year_built}`);
  return parts.join(" · ");
}

function scoreColorRgb(pct) {
  if (pct >= 70) return [16, 107, 73];
  if (pct >= 40) return [245, 158, 11];
  return [239, 68, 68];
}

function normalizeAddressKey(addr) {
  return String(addr || "")
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Map a project property row into a tour packet item.
 * @param {object} p
 */
export function projectPropertyToTourItem(p) {
  const snap = p?.property_snapshot || {};
  const auto = p?.auto_scores || {};
  const categories = [];
  const seen = new Set();
  for (const id of ALL_BROWSE_SCORE_IDS) {
    if (auto[id] == null) continue;
    const score = Number(auto[id]);
    if (!Number.isFinite(score)) continue;
    categories.push({
      id,
      label: CATEGORY_LABELS[id] || id,
      score,
      max: 10,
    });
    seen.add(id);
  }
  for (const [id, raw] of Object.entries(auto)) {
    if (seen.has(id)) continue;
    const score = Number(raw);
    if (!Number.isFinite(score)) continue;
    categories.push({
      id,
      label: CATEGORY_LABELS[id] || id,
      score,
      max: 10,
    });
  }
  return {
    address: p?.property_address || "Unknown address",
    price: snap.price ?? snap.list_price ?? null,
    bedrooms: snap.bedrooms ?? snap.beds ?? null,
    bathrooms: snap.bathrooms ?? snap.baths ?? null,
    sqft: snap.sqft ?? snap.square_feet ?? null,
    year_built: snap.year_built ?? null,
    overallScore: p?.overall_percentage ?? 0,
    categories,
    notes: null,
    photoUrls: [],
  };
}

/**
 * Map a Compare / PropertyScore row into a tour packet item.
 * @param {object} s
 */
export function compareScoreToTourItem(s) {
  const snap = s?._browseSnapshot || {};
  const categories = (s?.scores || []).map((c) => ({
    id: c.category_id,
    label: c.category_label || CATEGORY_LABELS[c.category_id] || c.category_id,
    score: Number(c.score) || 0,
    max: 10,
    importance: c.importance,
  }));
  return {
    address: s?.property_address || "Unknown address",
    price: snap.price ?? snap.list_price ?? null,
    bedrooms: snap.bedrooms ?? snap.beds ?? null,
    bathrooms: snap.bathrooms ?? snap.baths ?? null,
    sqft: snap.sqft ?? snap.square_feet ?? null,
    year_built: snap.year_built ?? null,
    overallScore: s?.percentage ?? 0,
    categories,
    notes: s?.visit_notes || s?.notes || null,
    photoUrls: Array.isArray(s?.photos)
      ? s.photos.map((ph) => ph.signed_url || ph.url).filter(Boolean)
      : [],
  };
}

/**
 * Best-effort attach visit notes/photos from the visits library by address match.
 * Silent no-op when library API is unavailable (free plan, offline, etc.).
 * @param {Array<object>} items
 * @param {{ listSaved?: Function, getSaved?: Function }} libraryApi
 */
export async function enrichTourItemsWithLibrary(items, libraryApi) {
  if (!items?.length || !libraryApi?.listSaved) return items;
  let saved = [];
  try {
    saved = (await libraryApi.listSaved()) || [];
  } catch {
    return items;
  }
  if (!saved.length) return items;

  const byKey = new Map();
  for (const row of saved) {
    const key = normalizeAddressKey(row.property_address);
    if (key) byKey.set(key, row);
  }

  const out = [];
  for (const item of items) {
    const match = byKey.get(normalizeAddressKey(item.address));
    if (!match) {
      out.push(item);
      continue;
    }
    let notes = item.notes || match.visit_notes || null;
    let photoUrls = [...(item.photoUrls || [])];
    if (libraryApi.getSaved && (!photoUrls.length || !notes)) {
      try {
        const detail = await libraryApi.getSaved(match.id);
        if (detail?.visit_notes) notes = notes || detail.visit_notes;
        const urls = (detail?.photos || [])
          .map((ph) => ph.signed_url || ph.url)
          .filter(Boolean);
        if (urls.length) photoUrls = urls.slice(0, 4);
      } catch {
        /* keep partial */
      }
    }
    out.push({ ...item, notes, photoUrls });
  }
  return out;
}

async function loadImageDataUrl(url) {
  if (!url || typeof fetch === "undefined") return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function wrapText(doc, text, maxWidth) {
  const lines = doc.splitTextToSize(String(text || ""), maxWidth);
  return Array.isArray(lines) ? lines : [String(text || "")];
}

/**
 * @param {Array<object>} items — normalized tour items
 * @param {{ title?: string, filename?: string }} [opts]
 */
export async function downloadTourPacketPdf(items, opts = {}) {
  const list = (items || []).filter((i) => i && i.address);
  if (!list.length) {
    throw new Error("Add at least one property to export a tour packet");
  }

  const title = opts.title || "Tour packet";
  const filename =
    opts.filename ||
    `tour-packet-${new Date().toISOString().slice(0, 10)}.pdf`;

  const doc = new jsPDF({ unit: "mm", format: "letter", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  const dateStr = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  for (let i = 0; i < list.length; i++) {
    if (i > 0) doc.addPage();
    const item = list[i];
    let y = MARGIN;

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(20, 25, 46);
    doc.text(APP_NAME, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`${title} · ${dateStr}`, pageW - MARGIN, y, { align: "right" });
    y += 4;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, pageW - MARGIN, y);
    y += 10;

    // Address
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(20, 25, 46);
    const addrLines = wrapText(doc, item.address, contentW);
    doc.text(addrLines, MARGIN, y);
    y += addrLines.length * 7 + 2;

    // Price + stats
    const price = formatPrice(item.price);
    const stats = formatStats(item);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 25, 46);
    if (price) {
      doc.text(price, MARGIN, y);
      y += 6;
    }
    if (stats) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(stats, MARGIN, y);
      y += 8;
    } else {
      y += 2;
    }

    // Overall score
    const pct = Math.round(Number(item.overallScore) || 0);
    const [r, g, b] = scoreColorRgb(pct);
    doc.setFillColor(r, g, b);
    doc.roundedRect(MARGIN, y, 28, 18, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(String(pct), MARGIN + 14, y + 11, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Overall score", MARGIN + 32, y + 8);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Match % from your weights", MARGIN + 32, y + 13);
    y += 24;

    // Category breakdown
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 25, 46);
    doc.text("Category breakdown", MARGIN, y);
    y += 6;

    const cats = item.categories || [];
    if (!cats.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text("No category scores yet", MARGIN, y);
      y += 8;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      for (const cat of cats) {
        if (y > pageH - 50) break;
        const label = cat.label || cat.id || "Category";
        const score = Number(cat.score);
        const max = Number(cat.max) || 10;
        doc.setTextColor(51, 65, 85);
        doc.text(label, MARGIN, y);
        const scoreText = Number.isFinite(score) ? `${score}/${max}` : "—";
        doc.setTextColor(20, 25, 46);
        doc.setFont("helvetica", "bold");
        doc.text(scoreText, pageW - MARGIN, y, { align: "right" });
        doc.setFont("helvetica", "normal");
        // thin bar
        const barY = y + 1.5;
        const barW = contentW * 0.45;
        const barX = MARGIN + contentW * 0.42;
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(barX, barY, barW, 2.2, 0.5, 0.5, "F");
        if (Number.isFinite(score) && max > 0) {
          const fill = Math.max(0, Math.min(1, score / max));
          const [cr, cg, cb] = scoreColorRgb((score / max) * 100);
          doc.setFillColor(cr, cg, cb);
          doc.roundedRect(barX, barY, barW * fill, 2.2, 0.5, 0.5, "F");
        }
        y += 7;
      }
    }

    // Notes
    if (item.notes && String(item.notes).trim()) {
      y += 4;
      if (y > pageH - 40) {
        /* keep on page — truncate notes if needed */
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(20, 25, 46);
      doc.text("Notes", MARGIN, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const noteLines = wrapText(doc, String(item.notes).trim(), contentW);
      const maxNoteLines = Math.max(2, Math.floor((pageH - y - 36) / 4.2));
      const shown = noteLines.slice(0, maxNoteLines);
      doc.text(shown, MARGIN, y);
      y += shown.length * 4.2 + 4;
      if (noteLines.length > shown.length) {
        doc.setTextColor(148, 163, 184);
        doc.text("…", MARGIN, y);
        y += 5;
      }
    }

    // Photos (small, optional)
    const urls = (item.photoUrls || []).slice(0, 3);
    if (urls.length) {
      y = Math.max(y + 2, pageH - 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(20, 25, 46);
      doc.text("Photos", MARGIN, y);
      y += 3;
      const thumbW = 42;
      const thumbH = 32;
      const gap = 4;
      let x = MARGIN;
      for (const url of urls) {
        const dataUrl = await loadImageDataUrl(url);
        if (!dataUrl) continue;
        try {
          const fmt = String(dataUrl).includes("image/png") ? "PNG" : "JPEG";
          doc.addImage(dataUrl, fmt, x, y, thumbW, thumbH);
          x += thumbW + gap;
        } catch {
          /* skip broken image */
        }
      }
    }

    // Footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i + 1} of ${list.length}`, pageW / 2, pageH - 8, { align: "center" });
  }

  doc.save(filename);
  return { pages: list.length, filename };
}
