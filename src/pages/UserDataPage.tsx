import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteUserDetail,
  fetchAllUserDetails,
  type UserDetailRecord,
} from "../lib/api";

export default function UserDataPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<UserDetailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const logout = () => {
    localStorage.removeItem("genk_admin_session");
    navigate("/login", { replace: true });
  };

  const loadRecords = async () => {
    try {
      setLoading(true);
      const data = await fetchAllUserDetails();
      setRecords(data);
      setError("");
    } catch {
      setError("Unable to load saved records. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (localStorage.getItem("genk_admin_session") !== "true") {
      navigate("/login", { replace: true });
      return;
    }

    void loadRecords();
  }, [navigate]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? records.filter((record) => {
          const haystack = [
            record.fullName,
            record.dateOfBirth,
            record.timeOfBirth,
            record.placeOfBirth,
            record.gender,
            record.readingLanguage,
            record.content,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(query);
        })
      : records;

    return [...filtered].sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return sortBy === "newest" ? bTime - aTime : aTime - bTime;
    });
  }, [records, search, sortBy]);

  const toggleExpanded = (id?: string) => {
    if (!id) return;
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const requestDelete = (id?: string) => {
    if (!id) return;
    setConfirmingId(id);
  };

  const cancelDelete = () => setConfirmingId(null);

  const confirmDelete = async (id?: string) => {
    if (!id) return;

    try {
      setDeletingId(id);
      await deleteUserDetail(id);
      setRecords((previous) => previous.filter((record) => record._id !== id));
    } catch {
      setError("Unable to delete this record. Please try again later.");
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  };

  const hasActiveSearch = search.trim().length > 0;

  return (
    <div className="min-h-screen bg-[#060f20] px-4 py-8 text-[#f5efe6]">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/80 p-5 shadow-2xl shadow-black/30 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#afbdd7]">
              Admin dashboard
            </p>
            <h1 className="font-display text-3xl text-[#f5efe6]">
              All saved records
            </h1>
            {!loading && !error && (
              <p className="mt-1 text-sm text-[#afbdd7]">
                {records.length} {records.length === 1 ? "record" : "records"}{" "}
                saved
                {hasActiveSearch &&
                  ` · ${filteredRecords.length} matching "${search.trim()}"`}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void loadRecords()}
              disabled={loading}
              aria-label="Refresh records"
              className="flex items-center gap-2 rounded-lg border border-[#d8b36a]/20 bg-[#111d31] px-4 py-2 text-sm text-[#f5efe6] transition hover:border-[#d8b36a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d8b36a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate("/", { replace: true })}
              className="rounded-lg border border-[#d8b36a]/20 bg-[#111d31] px-4 py-2 text-sm text-[#f5efe6] transition hover:border-[#d8b36a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d8b36a]"
            >
              Home
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg bg-[#d8b36a] px-4 py-2 text-sm font-semibold text-[#0a1529] transition hover:bg-[#c49a4f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d8b36a]"
            >
              Admin logout
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/80 p-4 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <label
                htmlFor="record-search"
                className="mb-2 block text-[10px] uppercase tracking-wide text-[#afbdd7]"
              >
                Search records
              </label>
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8ea1c2]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  id="record-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, date, place, content..."
                  className="w-full rounded-lg border border-[#d8b36a]/20 bg-[#111d31] py-2.5 pl-9 pr-9 text-sm text-[#f5e6d3] placeholder:text-[#8ea1c2] outline-none focus:border-[#d8b36a]/70"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#8ea1c2] transition hover:text-[#f5e6d3]"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="md:w-46">
              <label
                htmlFor="record-sort"
                className="mb-2 block text-[10px] uppercase tracking-wide text-[#afbdd7]"
              >
                Sort by
              </label>
              <select
                id="record-sort"
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value as "newest" | "oldest")
                }
                className="w-full rounded-lg border border-[#d8b36a]/20 bg-[#111d31] px-3 py-2.5 text-sm text-[#f5e6d3] outline-none focus:border-[#d8b36a]/70"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-[#f0958a]/30 bg-[#f0958a]/10 p-4 text-[#f0958a] shadow-lg shadow-black/10"
          >
            <div className="flex items-start gap-3">
              <svg
                viewBox="0 0 24 24"
                className="mt-0.5 h-5 w-5 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <div>
                <p className="text-sm font-medium">{error}</p>
                <button
                  type="button"
                  onClick={() => void loadRecords()}
                  className="mt-1 text-xs underline underline-offset-2 hover:text-[#f5b0a7]"
                >
                  Try again
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
              className="shrink-0 rounded p-0.5 transition hover:text-[#f5b0a7]"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div
            className="space-y-4"
            aria-busy="true"
            aria-label="Loading saved user data"
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/80 p-5 shadow-xl shadow-black/20"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-5 w-40 rounded bg-[#d8b36a]/15" />
                    <div className="h-3 w-24 rounded bg-[#d8b36a]/10" />
                  </div>
                  <div className="h-7 w-16 rounded-full bg-[#d8b36a]/10" />
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {[0, 1, 2, 3].map((j) => (
                    <div key={j} className="space-y-2">
                      <div className="h-2.5 w-16 rounded bg-[#d8b36a]/10" />
                      <div className="h-3.5 w-24 rounded bg-[#d8b36a]/10" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filteredRecords.length === 0 && (
          <div className="rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/80 p-12 text-center shadow-xl shadow-black/20">
            <svg
              viewBox="0 0 24 24"
              className="mx-auto mb-4 h-10 w-10 text-[#8ea1c2]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {hasActiveSearch ? (
                <>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </>
              ) : (
                <>
                  <path d="M4 19V6a2 2 0 0 1 2-2h9l5 5v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
                  <path d="M14 4v5h5" />
                </>
              )}
            </svg>
            <p className="text-sm text-[#afbdd7]">
              {hasActiveSearch
                ? `No records match "${search.trim()}".`
                : "No saved records yet."}
            </p>
            {hasActiveSearch && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-3 text-xs text-[#d8b36a] underline underline-offset-2 hover:text-[#f4d7a7]"
              >
                Clear search
              </button>
            )}
          </div>
        )}

        {/* Records */}
        {!loading && !error && filteredRecords.length > 0 && (
          <div className="space-y-4">
            {filteredRecords.map((record) => {
              const isExpanded = expandedIds.has(record._id ?? "");
              const isConfirming = confirmingId === record._id;
              const isDeleting = deletingId === record._id;

              return (
                <div
                  key={record._id}
                  className="rounded-2xl border border-[#d8b36a]/20 bg-[#0a1529]/80 p-5 shadow-xl shadow-black/20 transition hover:border-[#d8b36a]/40"
                >
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-display text-xl text-[#f5efe6]">
                        {record.fullName || "Unnamed User"}
                      </h2>
                      <p className="text-xs text-[#afbdd7]">
                        {record.createdAt
                          ? new Date(record.createdAt).toLocaleString()
                          : "No timestamp"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-[#d8b36a]/25 bg-[#d8b36a]/10 px-2.5 py-1 text-[10px] uppercase tracking-wide text-[#f4d7a7]">
                        {record.readingLanguage || "en"}
                      </span>

                      {isConfirming ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#afbdd7]">
                            Delete this record?
                          </span>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => void confirmDelete(record._id)}
                            className="rounded-lg border border-[#f0958a]/40 bg-[#f0958a]/20 px-3 py-1.5 text-xs font-medium text-[#f0958a] transition hover:border-[#f0958a]/60 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isDeleting ? "Deleting..." : "Yes, delete"}
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={cancelDelete}
                            className="rounded-lg border border-[#d8b36a]/20 bg-[#111d31] px-3 py-1.5 text-xs text-[#f5efe6] transition hover:border-[#d8b36a]/40"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => requestDelete(record._id)}
                          aria-label={`Delete record for ${record.fullName || "unnamed user"}`}
                          className="rounded-lg border border-[#f0958a]/25 bg-[#f0958a]/10 px-3 py-1.5 text-xs font-medium text-[#f0958a] transition hover:border-[#f0958a]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0958a]"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[#afbdd7]">
                        Date of birth
                      </p>
                      <p className="text-sm text-[#e3cbb0]">
                        {record.dateOfBirth || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[#afbdd7]">
                        Time of birth
                      </p>
                      <p className="text-sm text-[#e3cbb0]">
                        {record.timeOfBirth || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[#afbdd7]">
                        Place of birth
                      </p>
                      <p className="text-sm text-[#e3cbb0]">
                        {record.placeOfBirth || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[#afbdd7]">
                        Gender
                      </p>
                      <p className="text-sm text-[#e3cbb0]">
                        {record.gender || "Prefer not to say"}
                      </p>
                    </div>
                  </div>

                  {record.content && (
                    <div className="mt-4 rounded-xl border border-[#d8b36a]/20 bg-[#111d31]/60 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[10px] uppercase tracking-wide text-[#afbdd7]">
                          Reading content
                        </p>
                        <button
                          type="button"
                          onClick={() => toggleExpanded(record._id)}
                          className="text-xs text-[#d8b36a] underline underline-offset-2 hover:text-[#f4d7a7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d8b36a]"
                        >
                          {isExpanded ? "Show less" : "Show more"}
                        </button>
                      </div>
                      <div
                        className={`prose-kundli overflow-auto text-sm leading-7 text-[#e3cbb0] transition-[max-height] duration-200 ${
                          isExpanded ? "max-h-[32rem]" : "max-h-24"
                        }`}
                        dangerouslySetInnerHTML={{ __html: record.content }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
