import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Camera,
  FolderPlus,
  Trash2,
  Share2,
  ImagePlus,
  Loader2,
  Home,
  ChevronRight,
  Users,
} from "lucide-react";
import { api } from "@/api";
import RequireAuth from "@/components/RequireAuth";
import { usePlan } from "@/core/hooks/usePlan";
import { useAuth } from "@/lib/AuthContext";

export default function PropertyVisits() {
  return (
    <RequireAuth message="Sign in to save visit photos and scores">
      <PropertyVisitsInner />
    </RequireAuth>
  );
}

function PropertyVisitsInner() {
  const { isPremium } = usePlan();
  const { checkAppState } = useAuth();
  const [saved, setSaved] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [newAddress, setNewAddress] = useState("");
  const [creating, setCreating] = useState(false);

  const [listingUrl, setListingUrl] = useState("");
  const [importing, setImporting] = useState(false);

  const [folderName, setFolderName] = useState("");
  const [realtorQuery, setRealtorQuery] = useState("");
  const [realtors, setRealtors] = useState([]);
  const [shareMsg, setShareMsg] = useState("");
  const [sharing, setSharing] = useState(false);

  const [sharedWithMe, setSharedWithMe] = useState([]);
  const [peerQuery, setPeerQuery] = useState("");
  const [peerUsers, setPeerUsers] = useState([]);
  const [peerShareMsg, setPeerShareMsg] = useState("");
  const [shareFolderOpen, setShareFolderOpen] = useState(null);

  const load = useCallback(async () => {
    if (!isPremium) {
      setLoading(false);
      return;
    }
    setErr(null);
    try {
      const incomingP = api.library.sharedWithMe ? api.library.sharedWithMe().catch(() => []) : Promise.resolve([]);
      const [list, flds, incoming] = await Promise.all([
        api.library.listSaved(),
        api.library.listFolders(),
        incomingP,
      ]);
      setSaved(Array.isArray(list) ? list : []);
      setFolders(Array.isArray(flds) ? flds : []);
      setSharedWithMe(Array.isArray(incoming) ? incoming : []);
    } catch (e) {
      setErr(e?.message || "Could not load library");
      setSaved([]);
      setFolders([]);
      setSharedWithMe([]);
    } finally {
      setLoading(false);
    }
  }, [isPremium]);

  useEffect(() => {
    load();
    checkAppState?.();
  }, [load, checkAppState]);

  const fetchDetail = useCallback(async (id) => {
    if (!id) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    try {
      const d = await api.library.getSaved(id);
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    fetchDetail(selectedId);
  }, [selectedId, fetchDetail]);

  const createProperty = async () => {
    const a = newAddress.trim();
    if (a.length < 3) return;
    setCreating(true);
    setErr(null);
    try {
      const row = await api.library.createSaved({ property_address: a });
      setNewAddress("");
      await load();
      setSelectedId(row.id);
    } catch (e) {
      setErr(e?.message || "Could not save");
    } finally {
      setCreating(false);
    }
  };

  const searchR = async () => {
    try {
      const r = await api.library.searchRealtors(realtorQuery);
      setRealtors(Array.isArray(r) ? r : []);
    } catch {
      setRealtors([]);
    }
  };

  const searchPeers = async () => {
    try {
      const r = await api.library.searchUsers(peerQuery);
      setPeerUsers(Array.isArray(r) ? r : []);
    } catch {
      setPeerUsers([]);
    }
  };

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-[#fafaf8] px-4 py-12 max-w-lg mx-auto text-center">
        <Camera className="w-14 h-14 mx-auto text-[#10b981] mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Property visits</h1>
        <p className="text-slate-600 mb-6">
          Upload in-person photos, save your visit score, organize homes into folders, import listing photos, and share
          with your subscribed realtor.
        </p>
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
          Premium or Realtor subscription required.
        </p>
        <Link
          to={createPageUrl("Pricing")}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#10b981] text-white font-semibold"
        >
          View plans
          <ChevronRight size={18} />
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafaf8] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#10b981] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafaf8] pb-16">
      <div className="bg-[#1a2234] px-4 sm:px-6 py-8">
        <div className="max-w-5xl mx-auto flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#10b981]/20 flex items-center justify-center shrink-0">
            <Camera className="text-[#10b981]" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Property visits</h1>
            <p className="text-slate-400 text-sm mt-1">
              Photos, scores, folders — share updates with your realtor (Realtor subscription).
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-4 grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Home size={18} className="text-[#10b981]" />
            Saved properties
          </h2>
          {err && <p className="text-sm text-red-600">{err}</p>}

          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Street address to track"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
            />
            <button
              type="button"
              disabled={creating}
              onClick={createProperty}
              className="px-4 py-2 rounded-xl bg-[#10b981] text-white text-sm font-medium disabled:opacity-50"
            >
              {creating ? "…" : "Add"}
            </button>
          </div>

          <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {saved.length === 0 && <li className="py-4 text-sm text-slate-500">No saved visits yet.</li>}
            {saved.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={`w-full text-left py-3 px-2 rounded-lg text-sm ${
                    selectedId === s.id ? "bg-emerald-50 text-emerald-900" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="font-medium text-slate-800 line-clamp-2">{s.property_address}</div>
                  {s.personal_score != null && (
                    <div className="text-xs text-slate-500 mt-0.5">Your visit score: {s.personal_score}/10</div>
                  )}
                </button>
              </li>
            ))}
          </ul>

          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <FolderPlus size={16} />
              Folders
            </h3>
            <div className="flex gap-2 mb-2">
              <input
                className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                placeholder="New folder name"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
              />
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-sm"
                onClick={async () => {
                  if (!folderName.trim()) return;
                  await api.library.createFolder({ name: folderName.trim(), sort_order: 0 });
                  setFolderName("");
                  load();
                }}
              >
                Create
              </button>
            </div>
            <ul className="text-sm text-slate-600 space-y-2">
              {folders.map((f) => (
                <li key={f.id} className="border border-slate-100 rounded-lg p-2">
                  <div className="flex justify-between items-center gap-2">
                    <span>
                      {f.name} <span className="text-slate-400">({f.item_count})</span>
                    </span>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        className="text-[#10b981] text-xs font-medium"
                        onClick={() => setShareFolderOpen((x) => (x === f.id ? null : f.id))}
                      >
                        {shareFolderOpen === f.id ? "Close" : "Share"}
                      </button>
                      <button
                        type="button"
                        className="text-red-600 text-xs"
                        onClick={() => api.library.deleteFolder(f.id).then(load)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {shareFolderOpen === f.id && (
                    <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
                      <p className="text-[11px] text-slate-500">Share the whole folder (all listings inside) with another account.</p>
                      <div className="flex gap-2">
                        <input
                          className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
                          placeholder="Search name or email"
                          value={peerQuery}
                          onChange={(e) => setPeerQuery(e.target.value)}
                        />
                        <button
                          type="button"
                          className="px-2 py-1 rounded bg-slate-100 text-xs"
                          onClick={searchPeers}
                        >
                          Find
                        </button>
                      </div>
                      <ul className="text-xs space-y-1 max-h-24 overflow-y-auto">
                        {peerUsers.map((u) => (
                          <li key={u.id} className="flex justify-between gap-1">
                            <span>{u.full_name || u.email}</span>
                            <button
                              type="button"
                              className="text-[#10b981] font-medium"
                              onClick={async () => {
                                try {
                                  await api.library.createPeerShare({
                                    recipient_user_id: u.id,
                                    folder_id: f.id,
                                    message: peerShareMsg || undefined,
                                  });
                                  setShareFolderOpen(null);
                                  load();
                                } catch (e) {
                                  setErr(e?.message || "Could not share folder");
                                }
                              }}
                            >
                              Share folder
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {selectedId && folders.length > 0 && (
              <p className="text-xs text-slate-500 mt-2">
                Add current property to folder:{" "}
                <select
                  className="border rounded px-2 py-1 ml-1"
                  onChange={async (e) => {
                    const fid = e.target.value;
                    if (!fid) return;
                    await api.library.addToFolder(fid, selectedId);
                    load();
                    e.target.value = "";
                  }}
                  defaultValue=""
                >
                  <option value="">Choose folder…</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </p>
            )}

            {sharedWithMe.length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Users size={16} className="text-[#10b981]" />
                  Shared with you
                </h3>
                <ul className="space-y-3 max-h-56 overflow-y-auto text-sm">
                  {sharedWithMe.map((item) => (
                    <li key={item.share_id} className="rounded-lg border border-slate-100 p-2 bg-slate-50/80">
                      <div className="text-xs text-slate-500 mb-1">
                        From {item.owner?.full_name || item.owner?.email || "Someone"}
                      </div>
                      {item.kind === "saved_property" && item.property && (
                        <button
                          type="button"
                          onClick={() => setSelectedId(item.property.id)}
                          className="text-left font-medium text-slate-800 hover:text-[#10b981]"
                        >
                          {item.property.property_address}
                        </button>
                      )}
                      {item.kind === "folder" && item.folder && (
                        <div>
                          <div className="font-medium text-slate-800">{item.folder.name}</div>
                          <ul className="mt-1 space-y-1">
                            {(item.properties || []).map((p) => (
                              <li key={p.id}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedId(p.id)}
                                  className="text-left text-xs text-slate-600 hover:text-[#10b981] underline"
                                >
                                  {p.property_address}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 min-h-[320px]">
          {!selectedId && (
            <p className="text-slate-500 text-sm">Select a property or add an address to manage visit photos and scores.</p>
          )}
          {selectedId && detailLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#10b981] animate-spin" />
            </div>
          )}
          {selectedId && detail && !detailLoading && (() => {
            const isOwner = !detail.access || detail.access === "owner";
            return (
            <div className="space-y-4">
              {!isOwner && (
                <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2 text-sm text-indigo-900">
                  <strong>View-only</strong> — shared by {detail.owner?.full_name || detail.owner?.email || "another user"}.
                  Realtors you work with can still receive shares from your own copies when you save a property to your library.
                </div>
              )}
              <div className="flex justify-between gap-2">
                <h2 className="font-semibold text-slate-900 line-clamp-3">{detail.property_address}</h2>
                {isOwner && (
                <button
                  type="button"
                  className="text-red-600 text-sm shrink-0"
                  onClick={async () => {
                    await api.library.deleteSaved(detail.id);
                    setSelectedId(null);
                    setDetail(null);
                    load();
                  }}
                >
                  Delete
                </button>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Your visit score (1–10)</label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={detail.personal_score ?? 5}
                  disabled={!isOwner}
                  onChange={async (e) => {
                    const v = Number(e.target.value);
                    const u = await api.library.updateSaved(detail.id, { personal_score: v });
                    setDetail({ ...detail, ...u });
                  }}
                  className="w-full mt-1"
                />
                <div className="text-sm text-slate-700">{detail.personal_score ?? "—"}</div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Notes</label>
                <textarea
                  className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[80px] disabled:bg-slate-50"
                  value={detail.visit_notes || ""}
                  disabled={!isOwner}
                  onBlur={async (e) => {
                    if (!isOwner) return;
                    await api.library.updateSaved(detail.id, { visit_notes: e.target.value });
                  }}
                  onChange={(e) => setDetail({ ...detail, visit_notes: e.target.value })}
                />
              </div>

              {isOwner && (
              <div>
                <label className="text-xs font-medium text-slate-600">Import photos from a listing URL</label>
                <div className="flex gap-2 mt-1">
                  <input
                    className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="https://…"
                    value={listingUrl}
                    onChange={(e) => setListingUrl(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={importing}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-sm"
                    onClick={async () => {
                      if (!listingUrl.trim()) return;
                      setImporting(true);
                      try {
                        await api.library.importListingPhotos(detail.id, listingUrl.trim());
                        setListingUrl("");
                        fetchDetail(detail.id);
                      } catch (e) {
                        setErr(e?.message || "Import failed");
                      } finally {
                        setImporting(false);
                      }
                    }}
                  >
                    {importing ? "…" : "Import"}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Only use URLs you have rights to view. Best-effort image detection.</p>
              </div>
              )}

              {isOwner && (
              <div>
                <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
                  <ImagePlus size={14} />
                  Your photos (upload from device)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  className="mt-2 text-sm"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      await api.library.uploadPhoto(detail.id, f);
                      fetchDetail(detail.id);
                    } catch (err2) {
                      setErr(err2?.message || "Upload failed");
                    }
                    e.target.value = "";
                  }}
                />
              </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(detail.photos || []).map((p) => (
                  <div key={p.id} className="relative group rounded-lg overflow-hidden border border-slate-100 aspect-square bg-slate-100">
                    {p.signed_url ? (
                      <img src={p.signed_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">No preview</div>
                    )}
                    <span className="absolute bottom-0 left-0 right-0 text-[10px] bg-black/50 text-white px-1 py-0.5 truncate">
                      {p.source === "listing_import" ? "Listing" : "Yours"}
                    </span>
                    {isOwner && (
                    <button
                      type="button"
                      className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100"
                      onClick={async () => {
                        await api.library.deletePhoto(detail.id, p.id);
                        fetchDetail(detail.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                    )}
                  </div>
                ))}
              </div>

              {isOwner && (
              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-2">
                  <Share2 size={16} />
                  Share with realtor
                </h3>
                <div className="flex gap-2 mb-2">
                  <input
                    className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="Search realtor name or email"
                    value={realtorQuery}
                    onChange={(e) => setRealtorQuery(e.target.value)}
                  />
                  <button type="button" className="px-3 py-1.5 rounded-lg bg-slate-100 text-sm" onClick={searchR}>
                    Search
                  </button>
                </div>
                <ul className="text-sm space-y-1 mb-2 max-h-28 overflow-y-auto">
                  {realtors.map((r) => (
                    <li key={r.id} className="flex justify-between items-center gap-2">
                      <span>
                        {r.full_name || r.email}{" "}
                        <span className="text-slate-400 text-xs">{r.brokerage}</span>
                      </span>
                      <button
                        type="button"
                        className="text-[#10b981] text-xs font-medium"
                        onClick={async () => {
                          setSharing(true);
                          try {
                            await api.library.shareWithRealtor(detail.id, {
                              realtor_id: r.id,
                              message: shareMsg || undefined,
                              include_photos: true,
                            });
                            setShareMsg("");
                          } catch (e) {
                            setErr(e?.message || "Share failed");
                          } finally {
                            setSharing(false);
                          }
                        }}
                        disabled={sharing}
                      >
                        Share
                      </button>
                    </li>
                  ))}
                </ul>
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  placeholder="Optional message to your realtor"
                  value={shareMsg}
                  onChange={(e) => setShareMsg(e.target.value)}
                  rows={2}
                />
              </div>
              )}

              {isOwner && (
              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-2">
                  <Users size={16} />
                  Share with another account
                </h3>
                <p className="text-xs text-slate-500 mb-2">
                  Share this saved visit with a partner, co-buyer, or realtor (any plan). They’ll see it under Visits → Shared with you.
                </p>
                <div className="flex gap-2 mb-2">
                  <input
                    className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="Search name or email"
                    value={peerQuery}
                    onChange={(e) => setPeerQuery(e.target.value)}
                  />
                  <button type="button" className="px-3 py-1.5 rounded-lg bg-slate-100 text-sm" onClick={searchPeers}>
                    Find
                  </button>
                </div>
                <ul className="text-sm space-y-1 mb-2 max-h-28 overflow-y-auto">
                  {peerUsers.map((u) => (
                    <li key={u.id} className="flex justify-between items-center gap-2">
                      <span>
                        {u.full_name || u.email} <span className="text-slate-400 text-xs">{u.plan}</span>
                      </span>
                      <button
                        type="button"
                        className="text-[#10b981] text-xs font-medium"
                        onClick={async () => {
                          try {
                            await api.library.createPeerShare({
                              recipient_user_id: u.id,
                              saved_property_id: detail.id,
                              message: peerShareMsg || undefined,
                            });
                            setPeerShareMsg("");
                            load();
                          } catch (e) {
                            setErr(e?.message || "Share failed");
                          }
                        }}
                      >
                        Share property
                      </button>
                    </li>
                  ))}
                </ul>
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  placeholder="Optional note"
                  value={peerShareMsg}
                  onChange={(e) => setPeerShareMsg(e.target.value)}
                  rows={2}
                />
              </div>
              )}
            </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
