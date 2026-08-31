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
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load data.",
      );
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

  const handleDelete = async (id?: string) => {
    if (!id) return;

    const confirmDelete = window.confirm("Delete this saved user record?");
    if (!confirmDelete) return;

    try {
      setDeletingId(id);
      await deleteUserDetail(id);
      setRecords((previous) => previous.filter((record) => record._id !== id));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete record.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#20100a] px-4 py-8 text-[#f5e6d3]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-[#e8a13a]/20 bg-[#2a1608]/80 p-5 shadow-2xl shadow-black/30 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#c99a6b]">
              Admin dashboard
            </p>
            <h1 className="font-display text-3xl text-[#fbe9d0]">
              All saved records
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/", { replace: true })}
              className="rounded-lg border border-[#e8a13a]/30 bg-[#1c0e05] px-4 py-2 text-sm text-[#fbe9d0] transition hover:border-[#e8a13a]/60"
            >
              Home
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg bg-[#e8a13a] px-4 py-2 text-sm font-semibold text-[#20100a] transition hover:bg-[#d68f28]"
            >
              Admin logout
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-[#e8a13a]/20 bg-[#2a1608]/80 p-4 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <label className="mb-2 block text-[10px] uppercase tracking-wide text-[#a9835f]">
                Search records
              </label>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, date, place, content..."
                className="w-full rounded-lg border border-[#e8a13a]/20 bg-[#1c0e05] px-3 py-2.5 text-sm text-[#f5e6d3] placeholder:text-[#7a5c40] outline-none focus:border-[#e8a13a]/70"
              />
            </div>

            <div className="md:w-46">
              <label className="mb-2 block text-[10px] uppercase tracking-wide text-[#a9835f]">
                Sort by
              </label>
              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value as "newest" | "oldest")
                }
                className="w-full rounded-lg border border-[#e8a13a]/20 bg-[#1c0e05] px-3 py-2.5 text-sm text-[#f5e6d3] outline-none focus:border-[#e8a13a]/70"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border border-[#e8a13a]/20 bg-[#2a1608]/80 p-12 text-center text-[#c99a6b] shadow-xl shadow-black/20">
            Loading saved user data...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-[#f0958a]/30 bg-[#f0958a]/10 p-4 text-[#f0958a] shadow-lg shadow-black/10">
            {error}
          </div>
        )}

        {!loading && !error && filteredRecords.length === 0 && (
          <div className="rounded-2xl border border-[#e8a13a]/20 bg-[#2a1608]/80 p-10 text-center text-[#c99a6b] shadow-xl shadow-black/20">
            No matching records found.
          </div>
        )}

        {!loading && !error && filteredRecords.length > 0 && (
          <div className="space-y-4">
            {filteredRecords.map((record) => (
              <div
                key={record._id}
                className="rounded-2xl border border-[#e8a13a]/20 bg-[#2a1608]/80 p-5 shadow-xl shadow-black/20 transition hover:border-[#e8a13a]/40"
              >
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-display text-xl text-[#fbe9d0]">
                      {record.fullName || "Unnamed User"}
                    </h2>
                    <p className="text-xs text-[#a9835f]">
                      {record.createdAt
                        ? new Date(record.createdAt).toLocaleString()
                        : "No timestamp"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-[#e8a13a]/25 bg-[#e8a13a]/10 px-2.5 py-1 text-[10px] uppercase tracking-wide text-[#f2b25c]">
                      {record.readingLanguage || "en"}
                    </span>
                    <button
                      type="button"
                      disabled={deletingId === record._id}
                      onClick={() => void handleDelete(record._id)}
                      className="rounded-lg border border-[#f0958a]/25 bg-[#f0958a]/10 px-3 py-1.5 text-xs font-medium text-[#f0958a] transition hover:border-[#f0958a]/50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingId === record._id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[#a9835f]">
                      Date of birth
                    </p>
                    <p className="text-sm text-[#e3cbb0]">
                      {record.dateOfBirth || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[#a9835f]">
                      Time of birth
                    </p>
                    <p className="text-sm text-[#e3cbb0]">
                      {record.timeOfBirth || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[#a9835f]">
                      Place of birth
                    </p>
                    <p className="text-sm text-[#e3cbb0]">
                      {record.placeOfBirth || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[#a9835f]">
                      Gender
                    </p>
                    <p className="text-sm text-[#e3cbb0]">
                      {record.gender || "Prefer not to say"}
                    </p>
                  </div>
                </div>

                {record.content && (
                  <div className="mt-4 rounded-xl border border-[#e8a13a]/20 bg-[#1c0e05]/60 p-4">
                    <p className="mb-2 text-[10px] uppercase tracking-wide text-[#a9835f]">
                      Reading content
                    </p>
                    <div
                      className="prose-kundli max-h-64 overflow-auto text-sm leading-7 text-[#e3cbb0]"
                      dangerouslySetInnerHTML={{ __html: record.content }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
