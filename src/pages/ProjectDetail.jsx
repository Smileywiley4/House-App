import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  FolderKanban,
  Loader2,
  Trash2,
  SlidersHorizontal,
  Home as HomeIcon,
} from "lucide-react";
import { api } from "@/api";
import { createPageUrl } from "@/utils";
import RequireAuth from "@/components/RequireAuth";
import StartProjectModal from "@/components/browse/StartProjectModal";
import ExportTourPacketButton from "@/components/ExportTourPacketButton";
import LoadingWithTimeout from "@/components/async/LoadingWithTimeout";
import FetchErrorState from "@/components/async/FetchErrorState";
import EmptyState from "@/components/EmptyState";
import { ALL_BROWSE_SCORE_IDS } from "@/components/browse/scoreCategories";
import { projectPropertyToTourItem } from "@/lib/tourPacketPdf";

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

function scoreColor(pct) {
  if (pct >= 70) return "#106B49";
  if (pct >= 40) return "#f59e0b";
  return "#ef4444";
}

export default function ProjectDetail() {
  return (
    <RequireAuth message="Sign in to view and manage your scoring projects">
      <ProjectDetailInner />
    </RequireAuth>
  );
}

function ProjectDetailInner() {
  const [params] = useSearchParams();
  const projectId = params.get("id");
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [projectList, setProjectList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [weights, setWeights] = useState({});
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [titleEdit, setTitleEdit] = useState("");
  const [startOpen, setStartOpen] = useState(false);
  const [invites, setInvites] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [list, pending] = await Promise.all([
        api.projects.list(),
        api.projects.listInvites?.().catch(() => []) || Promise.resolve([]),
      ]);
      setProjectList(list || []);
      setInvites(Array.isArray(pending) ? pending : []);
      setProject(null);
    } catch (e) {
      setError(e?.message || "Could not load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    if (!projectId) {
      await loadList();
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await api.projects.get(projectId);
      setProject(data);
      setTitleEdit(data.title || "");
      setWeights(data.scoring_presets?.weights || {});
    } catch (e) {
      setError(e?.message || "Could not load project");
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, loadList]);

  useEffect(() => {
    load();
  }, [load]);

  const savePrefs = async () => {
    setSavingPrefs(true);
    setError("");
    try {
      const updated = await api.projects.update(projectId, {
        title: titleEdit.trim() || project.title,
        scoring_presets: { weights },
      });
      setProject(updated);
      setPrefsOpen(false);
    } catch (e) {
      setError(e?.message || "Could not update preferences");
    } finally {
      setSavingPrefs(false);
    }
  };

  const removeProp = async (propId) => {
    try {
      await api.projects.removeProperty(projectId, propId);
      await load();
    } catch (e) {
      setError(e?.message || "Could not remove property");
    }
  };

  const deleteProject = async () => {
    if (!window.confirm("Delete this project and all saved listings in it?")) return;
    try {
      await api.projects.delete(projectId);
      navigate(createPageUrl("ProjectDetail"));
    } catch (e) {
      setError(e?.message || "Could not delete project");
    }
  };

  if (loading) {
    return (
      <LoadingWithTimeout
        isLoading
        onRetry={() => (projectId ? load() : loadList())}
        fullPage
        label="Loading…"
        skeleton={projectId ? "cards" : "list"}
        skeletonRows={projectId ? 3 : 4}
      />
    );
  }

  if (!projectId) {
    return (
      <>
        <div className="min-h-screen bg-[#F8F7F4]">
          <div className="relative overflow-hidden bg-[#14192E] px-6 py-8">
            <div className="relative max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white">Projects</h1>
                <p className="text-slate-400 text-sm mt-1">
                  Folder-like collections with project-only scoring preferences
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStartOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#106B49] text-white text-sm font-bold"
              >
                <FolderKanban size={16} /> Start project
              </button>
            </div>
          </div>
          <div className="max-w-5xl mx-auto px-6 py-8">
            {error && (
              <FetchErrorState compact message={error} onRetry={loadList} className="mb-4" />
            )}
            {projectList.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="No projects yet"
                description="Start a project from here or from Search Properties."
                actionLabel="Search properties"
                actionTo={createPageUrl("BrowseProperties")}
              />
            ) : (
              <ul className="space-y-3">
                {projectList.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={`${createPageUrl("ProjectDetail")}?id=${encodeURIComponent(p.id)}`}
                      className="block bg-white rounded-2xl border border-slate-100 p-4 hover:border-[#106B49]/40 transition"
                    >
                      <div className="font-bold text-[#14192E]">{p.title}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {p.property_count ?? 0} propert{(p.property_count ?? 0) === 1 ? "y" : "ies"}
                        {p.membership === "collaborator" ? " · shared with you" : ""}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {invites.length > 0 && (
              <div className="mt-10 space-y-3">
                <h2 className="text-sm font-bold text-[#14192E]">Pending project invites</h2>
                {invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-amber-100 bg-amber-50/40 p-4"
                  >
                    <div>
                      <p className="font-semibold text-[#14192E] text-sm">
                        {inv.project?.title || "Project"}
                      </p>
                      <p className="text-xs text-slate-500">
                        From {inv.invited_by?.full_name || inv.invited_by?.email || "someone"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-[#106B49] px-3 py-1.5 text-xs font-bold text-white"
                        onClick={async () => {
                          try {
                            await api.projects.acceptInvite(inv.id);
                            await loadList();
                          } catch (e) {
                            setError(e?.message || "Could not accept");
                          }
                        }}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                        onClick={async () => {
                          try {
                            await api.projects.declineInvite(inv.id);
                            await loadList();
                          } catch (e) {
                            setError(e?.message || "Could not decline");
                          }
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <StartProjectModal open={startOpen} onClose={() => setStartOpen(false)} />
      </>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex flex-col items-center justify-center px-6">
        <FetchErrorState
          title="Project not found"
          message={error || "This project may have been deleted or you no longer have access."}
          onRetry={loadList}
        />
        <Link to={createPageUrl("ProjectDetail")} className="text-[#106B49] font-semibold text-sm -mt-2">
          Back to projects
        </Link>
      </div>
    );
  }

  const properties = project.properties || [];
  const members = project.members || [];
  const isOwner = project.is_owner === true || project.membership === "owner";

  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      <div className="relative overflow-hidden bg-[#14192E] px-6 py-8">
        <div className="absolute inset-0 bg-[#14192E]/75" />
        <div className="relative max-w-5xl mx-auto">
          <Link
            to={createPageUrl("ProjectDetail")}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm mb-4"
          >
            <ChevronLeft size={16} /> All projects
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[#106B49] text-xs font-bold uppercase tracking-wide mb-1">
                <FolderKanban size={14} /> Project
                {!isOwner && <span className="text-slate-400 font-semibold normal-case">· collaborator</span>}
              </div>
              <h1 className="text-2xl font-bold text-white">{project.title}</h1>
              <p className="text-slate-400 text-sm mt-1">
                {properties.length} propert{properties.length === 1 ? "y" : "ies"} · scores use this
                project&apos;s preferences
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {properties.length >= 1 && (
                <ExportTourPacketButton
                  items={properties.map(projectPropertyToTourItem)}
                  title={project.title ? `${project.title} · Tour packet` : "Tour packet"}
                  filename={`tour-packet-${(project.title || "project")
                    .replace(/[^\w\-]+/g, "-")
                    .replace(/-+/g, "-")
                    .toLowerCase()
                    .slice(0, 40)}.pdf`}
                />
              )}
              {isOwner && (
                <>
                  <button
                    type="button"
                    onClick={() => setPrefsOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold"
                  >
                    <SlidersHorizontal size={15} /> Scoring prefs
                  </button>
                  <button
                    type="button"
                    onClick={deleteProject}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/20 text-slate-300 hover:text-white text-sm font-semibold"
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {error && (
          <FetchErrorState compact message={error} onRetry={load} className="mb-4" />
        )}

        {isOwner && (
          <div className="mb-8 rounded-2xl border border-slate-100 bg-white p-4 space-y-3">
            <h2 className="text-sm font-bold text-[#14192E]">Invite collaborator</h2>
            <p className="text-xs text-slate-500">
              Collaborators can add and edit properties. Only you manage preferences and deletion.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Their account email"
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#106B49]/30"
              />
              <button
                type="button"
                disabled={inviteBusy || !inviteEmail.trim()}
                onClick={async () => {
                  setInviteBusy(true);
                  setError("");
                  try {
                    await api.projects.inviteMember(projectId, { email: inviteEmail.trim() });
                    setInviteEmail("");
                    await load();
                  } catch (e) {
                    setError(e?.message || "Invite failed");
                  } finally {
                    setInviteBusy(false);
                  }
                }}
                className="rounded-xl bg-[#14192E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {inviteBusy ? "Inviting…" : "Invite"}
              </button>
            </div>
            {members.length > 0 && (
              <ul className="divide-y divide-slate-100 text-sm">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2 gap-2">
                    <span className="truncate">
                      {m.user?.full_name || m.user?.email || m.user_id}
                      <span className="text-xs text-slate-400 ml-2">{m.status}</span>
                    </span>
                    {m.status === "accepted" && (
                      <button
                        type="button"
                        className="text-xs text-slate-400 hover:text-red-600"
                        onClick={async () => {
                          try {
                            await api.projects.removeMember(projectId, m.id);
                            await load();
                          } catch (e) {
                            setError(e?.message || "Could not remove");
                          }
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {properties.length === 0 ? (
          <EmptyState
            icon={HomeIcon}
            title="No properties yet"
            description="Select homes on Search Properties and use Save to project, or Start project with a selection."
            actionLabel="Browse homes"
            actionTo={createPageUrl("BrowseProperties")}
          />
        ) : (
          <ul className="space-y-3">
            {properties.map((p) => {
              const snap = p.property_snapshot || {};
              const pct = p.overall_percentage ?? 0;
              const color = scoreColor(pct);
              return (
                <li
                  key={p.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex gap-4 items-start"
                >
                  <div
                    className="w-16 h-16 rounded-xl flex flex-col items-center justify-center shrink-0 font-bold"
                    style={{ background: `${color}18`, color }}
                  >
                    <span className="text-xl leading-none">{pct}</span>
                    <span className="text-[9px] uppercase tracking-wide opacity-80">score</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-[#14192E] truncate">{p.property_address}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {[
                        snap.bedrooms != null ? `${snap.bedrooms} bd` : null,
                        snap.bathrooms != null ? `${snap.bathrooms} ba` : null,
                        snap.sqft != null ? `${Number(snap.sqft).toLocaleString()} sqft` : null,
                        snap.price != null ? `$${Number(snap.price).toLocaleString()}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Listing details"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeProp(p.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                    aria-label="Remove from project"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {prefsOpen && (
        <div className="fixed inset-0 z-[80] flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => setPrefsOpen(false)}
          />
          <div className="relative w-full max-w-md h-full bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h2 className="font-bold text-[#14192E]">Project scoring prefs</h2>
              <button
                type="button"
                onClick={() => setPrefsOpen(false)}
                className="text-sm font-semibold text-slate-500"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <p className="text-xs text-slate-500">
                These weights apply only to this project. Saving recalculates scores for every
                property here.
              </p>
              <div>
                <label className="text-xs font-bold text-slate-600">Title</label>
                <input
                  value={titleEdit}
                  onChange={(e) => setTitleEdit(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#106B49]"
                />
              </div>
              {ALL_BROWSE_SCORE_IDS.map((id) => (
                <div key={id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700">{LABELS[id] || id}</span>
                    <span className="font-bold text-[#106B49]">{weights[id] ?? 5}/10</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={weights[id] ?? 5}
                    onChange={(e) => setWeights((w) => ({ ...w, [id]: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100">
              <button
                type="button"
                disabled={savingPrefs}
                onClick={savePrefs}
                className="w-full py-2.5 rounded-xl bg-[#106B49] text-white text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {savingPrefs ? <Loader2 className="animate-spin" size={16} /> : null}
                Save &amp; rescore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
