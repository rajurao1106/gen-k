"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  expireDevSubscriptions,
  fetchDevEntitlements,
  fetchDevOrders,
  fetchDevUsers,
  grantDevPlan,
  revokeDevEntitlement,
  resetDevUsage,
  type DevEntitlement,
  type DevOrder,
  type DevUser,
} from "../lib/api";
import { useAuth } from "../lib/useAuth";

const grantablePlans = [
  "report_milan",
  "report_kundali",
  "premium_monthly",
  "premium_yearly",
  "voice_addon",
];

export default function DevToolsPage() {
  const router = useRouter();
  const { user, status } = useAuth();
  const [users, setUsers] = useState<DevUser[]>([]);
  const [orders, setOrders] = useState<DevOrder[]>([]);
  const [entitlements, setEntitlements] = useState<DevEntitlement[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [planId, setPlanId] = useState(grantablePlans[0]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async (userId: string) => {
    try {
      const [availableUsers, recentOrders, userEntitlements] = await Promise.all([
        fetchDevUsers(),
        fetchDevOrders(),
        userId ? fetchDevEntitlements(userId) : Promise.resolve([]),
      ]);
      setUsers(availableUsers);
      setOrders(recentOrders);
      setEntitlements(userEntitlements);
      setSelectedUserId((selected) =>
        availableUsers.some((item) => item.id === selected)
          ? selected
          : availableUsers[0]?.id ?? "",
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Developer tools could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/account?next=%2Fdev-tools");
    } else if (status === "authenticated" && user?.role === "admin") {
      // Load the selected account's admin-only data.
      // oxlint-disable-next-line react/set-state-in-effect
      void refresh(selectedUserId);
    }
  }, [refresh, router, selectedUserId, status, user?.role]);

  const perform = async (action: () => Promise<unknown>, successMessage: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(successMessage);
      await refresh(selectedUserId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The developer action failed.");
    } finally {
      setBusy(false);
    }
  };

  if (process.env.NODE_ENV === "production") {
    return <main className="mx-auto max-w-3xl p-6 text-[#f9f3eb]">Developer tools are disabled.</main>;
  }
  if (status === "loading") return null;
  if (status === "authenticated" && user?.role !== "admin") {
    return <main className="mx-auto max-w-3xl p-6 text-[#f9f3eb]">Administrator access is required.</main>;
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 text-[#f9f3eb] sm:p-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-[#f2c36b]">Development only</p>
        <h1 className="mt-2 font-display text-3xl font-bold">Admin developer tools</h1>
        <p className="mt-2 text-sm text-[#c9d8ed]">Test entitlements, quotas and orders. This screen and its API are disabled in production.</p>
      </header>
      {error && <p role="alert" className="rounded-xl border border-[#ef9f90]/40 bg-[#ef9f90]/10 p-3 text-sm text-[#ffd1c9]">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-[#7fd18a]/40 bg-[#7fd18a]/10 p-3 text-sm text-[#c9f2d1]">{notice}</p>}
      <section className="space-y-4 rounded-2xl border border-[#f2c36b]/20 bg-[#10273d] p-4">
        <label className="block text-sm">
          Account
          <select
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.currentTarget.value)}
            className="mt-2 w-full rounded-xl border border-white/15 bg-[#0a1a2e] px-3 py-3"
          >
            <option value="">Select an account</option>
            {users.map((item) => (
              <option key={item.id} value={item.id}>{item.phone} · {item.role}</option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <label className="min-w-48 flex-1 text-sm">
            Plan
            <select value={planId} onChange={(event) => setPlanId(event.currentTarget.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#0a1a2e] px-3 py-3">
              {grantablePlans.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
            </select>
          </label>
          <button type="button" disabled={!selectedUserId || busy} onClick={() => void perform(() => grantDevPlan(selectedUserId, planId), "Test entitlement granted.")} className="self-end rounded-xl bg-[#f2c36b] px-4 py-3 text-sm font-semibold text-[#0b1324] disabled:opacity-50">Grant plan</button>
          <button type="button" disabled={!selectedUserId || busy} onClick={() => void perform(() => resetDevUsage(selectedUserId), "Today's usage counters reset.")} className="self-end rounded-xl border border-[#f2c36b]/40 px-4 py-3 text-sm disabled:opacity-50">Reset usage</button>
          <button type="button" disabled={!selectedUserId || busy} onClick={() => void perform(() => expireDevSubscriptions(selectedUserId), "Active subscriptions expired.")} className="self-end rounded-xl border border-[#ef9f90]/40 px-4 py-3 text-sm text-[#ffd1c9] disabled:opacity-50">Expire subscription</button>
        </div>
      </section>
      <section className="rounded-2xl border border-[#f2c36b]/20 bg-[#10273d] p-4">
        <h2 className="font-display text-xl font-semibold">Account entitlements</h2>
        {loading ? <p role="status" className="mt-3 text-sm text-[#a6bddb]">Loading…</p> : entitlements.length ? (
          <ul className="mt-3 divide-y divide-white/10">
            {entitlements.map((entitlement) => (
              <li key={entitlement.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>{entitlement.planId} · {entitlement.kind} · {entitlement.status}{entitlement.remainingUses !== null ? ` · ${entitlement.remainingUses} uses` : ""}</span>
                {entitlement.status === "active" && <button type="button" disabled={busy} onClick={() => void perform(() => revokeDevEntitlement(entitlement.id), "Entitlement revoked.")} className="rounded-lg border border-[#ef9f90]/40 px-3 py-1.5 text-xs text-[#ffd1c9] disabled:opacity-50">Revoke</button>}
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-[#a6bddb]">No entitlements for this account.</p>}
      </section>
      <section className="rounded-2xl border border-[#f2c36b]/20 bg-[#10273d] p-4">
        <h2 className="font-display text-xl font-semibold">Recent orders</h2>
        <ul className="mt-3 divide-y divide-white/10">
          {orders.map((order) => <li key={order.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{order.userPhone} · {order.planId}</span><span>{order.status} · {(order.amountPaise / 100).toLocaleString("en-IN", { style: "currency", currency: order.currency })}</span></li>)}
          {!orders.length && <li className="py-3 text-sm text-[#a6bddb]">No orders found.</li>}
        </ul>
      </section>
    </main>
  );
}
