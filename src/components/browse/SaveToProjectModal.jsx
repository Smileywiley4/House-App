import { useEffect, useState } from "react";
import { FolderPlus, Loader2, Plus, X } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/api";
import { createPageUrl } from "@/utils";
import { usePlan } from "@/core/hooks/usePlan";

/**
 * Save one or more browse listings into an existing or new project.
 */
export default function SaveToProjectModal({ open, onClose, properties = [], onSaved }) {
  const { maxProjects, isPremium } = usePlan();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("pick"); // pick | create
  const [title, setTitle] = useState("");
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setMode("pick");
    setTitle("");
    setSelectedId("");
    setLoading(true);
    api.projects
      .list()
      .then((list) => {
        setProjects(list || []);
        if (list?.[0]) setSelectedId(list[0].id);
      })
      .catch((e) => setError(e?.message || "Could not load projects"))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const atLimit = projects.length >= maxProjects;

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      let projectId = selectedId;
      if (mode === "create") {
        if (!title.trim()) {
          setError("Enter a project name.");
          setSaving(false);
          return;
        }
        if (atLimit) {
          setError(
            isPremium
              ? `You can have up to ${maxProjects} projects.`
              : `Free plan allows ${maxProjects} projects. Upgrade for more.`
          );
          setSaving(false);
          return;
        }
        const created = await api.projects.create({ title: title.trim() });
        projectId = created.id;
      }
      if (!projectId) {
        setError("Choose a project or create one.");
        setSaving(false);
        return;
      }
      if (properties.length === 1) {
        await api.projects.addProperty(projectId, properties[0], { enrich_location: true });
      } else {
        await api.projects.addProperties(projectId, properties, { enrich_location: false });
      }
      onSaved?.(projectId);
      onClose?.();
    } catch (e) {
      setError(e?.message || "Could not save to project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-[#14192E] text-lg">Save to project</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {properties.length} propert{properties.length === 1 ? "y" : "ies"} selected
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-sm">
              <Loader2 className="animate-spin" size={18} /> Loading projects…
            </div>
          ) : (
            <>
              <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setMode("pick")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    mode === "pick" ? "bg-white shadow text-[#14192E]" : "text-slate-500"
                  }`}
                >
                  Existing
                </button>
                <button
                  type="button"
                  onClick={() => setMode("create")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    mode === "create" ? "bg-white shadow text-[#14192E]" : "text-slate-500"
                  }`}
                >
                  New project
                </button>
              </div>

              {mode === "pick" ? (
                projects.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No projects yet. Create one to save these homes.
                  </p>
                ) : (
                  <ul className="space-y-2 max-h-48 overflow-y-auto">
                    {projects.map((p) => (
                      <li key={p.id}>
                        <label
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer ${
                            selectedId === p.id
                              ? "border-[#106B49] bg-propurty-green-tint/50"
                              : "border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="project"
                            checked={selectedId === p.id}
                            onChange={() => setSelectedId(p.id)}
                            className="accent-[#106B49]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-[#14192E] truncate">{p.title}</span>
                            <span className="text-[11px] text-slate-500">
                              {p.property_count ?? 0} saved
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <div>
                  <label className="text-xs font-bold text-slate-600">Project name</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Downtown condos"
                    className="mt-1 w-full px-3 py-2.5 rounded-xl border border-[#106B49]/50 bg-[#F8F7F4] text-sm text-[#14192E] placeholder:text-[#6B6963] focus:outline-none focus:border-[#106B49]"
                    maxLength={200}
                  />
                  {atLimit && (
                    <p className="mt-2 text-xs text-amber-700">
                      Limit reached ({maxProjects}).{" "}
                      {!isPremium && (
                        <Link to={createPageUrl("Pricing")} className="underline font-semibold">
                          Upgrade
                        </Link>
                      )}
                    </p>
                  )}
                </div>
              )}

              {error && (
                <p className="text-xs text-red-600 font-semibold bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || loading || (mode === "pick" && !selectedId && projects.length > 0)}
            onClick={save}
            className="flex-1 py-2.5 rounded-xl bg-[#106B49] text-white text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : mode === "create" ? <Plus size={16} /> : <FolderPlus size={16} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
