"use client";

import { useEffect, useState } from "react";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  plan: string;
  createdAt: string;
}

interface ApiResponse {
  users: User[];
  total: number;
  limit: number;
  offset: number;
}

export function UserRolesManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    loadUsers();
  }, [offset]);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?limit=${limit}&offset=${offset}`);
      const data: ApiResponse = await res.json();
      setUsers(data.users);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }

  async function updateRole(userId: string, newRole: string) {
    setUpdating(userId);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
        setMsg({ ok: true, text: "Rolle aktualisiert." });
      } else {
        setMsg({ ok: false, text: data.error ?? "Fehler beim Aktualisieren." });
      }
    } finally {
      setUpdating(null);
    }
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-neutral-900">Nutzer-Rollen verwalten</h2>

      {loading ? (
        <p className="text-sm text-neutral-500">Laden…</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="px-4 py-3 text-left font-semibold text-neutral-700">E-Mail</th>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-700">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-700">Rolle</th>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-700">Tarif</th>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-700">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="px-4 py-3 text-neutral-900">{user.email}</td>
                    <td className="px-4 py-3 text-neutral-600">{user.name || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          user.role === "admin"
                            ? "bg-red-100 text-red-800"
                            : "bg-neutral-100 text-neutral-700"
                        }`}
                      >
                        {user.role === "admin" ? "Admin" : "Nutzer"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          user.plan === "paid"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-neutral-100 text-neutral-700"
                        }`}
                      >
                        {user.plan === "paid" ? "Bezahlt" : "Kostenlos"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.role === "admin" ? (
                        <button
                          onClick={() => updateRole(user.id, "user")}
                          disabled={updating === user.id}
                          className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        >
                          Als Nutzer setzen
                        </button>
                      ) : (
                        <button
                          onClick={() => updateRole(user.id, "admin")}
                          disabled={updating === user.id}
                          className="text-xs text-orange-600 hover:text-orange-800 disabled:opacity-50"
                        >
                          Als Admin setzen
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-neutral-500">
              {total} Nutzer gesamt · Seite {currentPage} von {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-30"
              >
                ← Zurück
              </button>
              <button
                onClick={() => setOffset(Math.min(total - limit, offset + limit))}
                disabled={offset + limit >= total}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-30"
              >
                Weiter →
              </button>
            </div>
          </div>

          {msg && (
            <p className={`mt-3 text-xs ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>
              {msg.text}
            </p>
          )}
        </>
      )}
    </div>
  );
}
