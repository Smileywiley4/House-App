import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FolderKanban, Loader2, X } from "lucide-react";
import { api } from "@/api";
import { createPageUrl } from "@/utils";
import { usePlan } from "@/core/hooks/usePlan";
import { ALL_BROWSE_SCORE_IDS } from "@/components/browse/scoreCategories";

const LABELS = {
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

/**
 * Create a named project with key scoring weights, then open project detail.
 */
export default function StartProjectModal({ open, onClose, seedProperties = [] }) {
  const navigate = useNavigate();
  const { maxProjects, isPremium } = usePlan();
  const [title, setTitle] = useState("");
  const [weights, setWeights] = useState(() =>
    Object.fromEntries(ALL_BROWSE_SCORE_IDS.map((id) => [id, 5]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [projectsUsed, setProjectsUsed] = useState(0);

  useEffect(() => {
    if (!open) return;
    api.projects
      .limits()
      .then((r) => setProjectsUsed(r?.projects_used ?? 0))
      .catch(() => setProjectsUsed(0));
  }, [open]);

  if (!open) return null;

  const atLimit = projectsUsed >= maxProjects;

  const create = async () => {
    if (!title.trim()) {
      setError("Enter a project name.");
      return;
    }
    if (atLimit) {
      setError(
        isPremium
          ? `You can have up to ${maxProjects} projects.`
          : `Free plan allows ${maxProjects} projects. Upgrade for more.`
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      const project = await api.projects.create({
        title: title.trim(),
        scoring_presets: { weights },
      });
      if (seedProperties.length) {
        await api.projects.addProperties(project.id, seedProperties, { enrich_location: false });
      }
      onClose?.();
      // Soft one-time prompt: new search may have new priorities.
      try {
        const { requestPriorityQuiz } = await import("@/lib/importanceQuiz");
        requestPriorityQuiz({
          trigger: "project",
          projectId: project.id,
          projectName: title.trim(),
        });
      } catch {
        /* non-blocking */
      }
      navigate(`${createPageUrl("ProjectDetail")}?id=${encodeURIComponent(project.id)}`);
    } catch (e) {
      setError(e?.message || "Could not create project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <FolderKanban size={20} className="text-[#106B49]" />
            <h2 className="font-bold text-[#14192E] text-lg">Start project</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <p className="text-sm text-slate-500">
            Name this folder and set scoring preferences. Homes you add are scored with these weights —
            change them later to recalculate every listing.
          </p>

          <div>
            <label className="text-xs font-bold text-slate-600">Project title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Family home search"
                    className="mt-1 w-full px-3 py-2.5 rounded-xl border border-[#106B49]/50 bg-[#F8F7F4] text-sm text-[#14192E] placeholder:text-[#6B6963] focus:outline-none focus:border-[#106B49]"
              maxLength={200}
              autoFocus
            />
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-600 mb-2">Key scoring preferences</h3>
            <div className="space-y-3">
              {ALL_BROWSE_SCORE_IDS.map((id) => (
                <div key={id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700">{LABELS[id] || id}</span>
                    <span className="font-bold text-[#106B49]">{weights[id]}/10</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={weights[id]}
                    onChange={(e) =>
                      setWeights((w) => ({ ...w, [id]: Number(e.target.value) }))
                    }
                    className="w-full"
                    style={{
                      background: `linear-gradient(to right, #106B49 ${weights[id] * 10}%, #e2e8f0 ${weights[id] * 10}%)`,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {seedProperties.length > 0 && (
            <p className="text-xs text-slate-500 font-medium">
              {seedProperties.length} selected listing{seedProperties.length === 1 ? "" : "s"} will be
              added after create.
            </p>
          )}

          {atLimit && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              Project limit reached ({maxProjects}).{" "}
              {!isPremium && (
                <Link to={createPageUrl("Pricing")} className="underline font-semibold">
                  Upgrade to Premium
                </Link>
              )}
            </p>
          )}

          {error && (
            <p className="text-xs text-red-600 font-semibold bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || atLimit}
            onClick={create}
            className="flex-1 py-2.5 rounded-xl bg-[#106B49] text-white text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : null}
            Create project
          </button>
        </div>
      </div>
    </div>
  );
}
