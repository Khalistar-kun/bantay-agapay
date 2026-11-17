"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

type State = "connected" | "unavailable" | "not_configured"
type Health = { status: State; database: State; checks: Record<string, State>; checkedAt: string }

const names: Record<string, string> = {
  connectivity: "Supabase database connection",
  registrationRateLimits: "Registration safety checks table",
  guardianRegistry: "Guardian registry table",
}
const badge: Record<State, string> = {
  connected: "bg-emerald-50 text-emerald-800 border-emerald-200",
  unavailable: "bg-red-50 text-red-800 border-red-200",
  not_configured: "bg-amber-50 text-amber-900 border-amber-200",
}
const wording: Record<State, string> = {
  connected: "Connected",
  unavailable: "Unavailable",
  not_configured: "Not configured",
}

export default function DatabaseHealthPage() {
  const [data, setData] = useState<Health | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/health/database", { cache: "no-store", credentials: "same-origin" })
      if (response.status === 401 || response.status === 403) {
        setData(null)
        setError("Administrator sign-in is required to view diagnostics.")
        return
      }
      const body = await response.json()
      if (!body.checks) throw new Error("Health check could not be completed.")
      setData(body)
    } catch {
      setData(null)
      setError("Unable to reach the diagnostic endpoint. Try again.")
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  return <main className="min-h-screen bg-[#faf6f8] px-4 py-8 text-[#2b1b26]">
    <div className="mx-auto max-w-3xl space-y-6">
      <div><Link href="/admin" className="text-sm font-semibold text-[#82172a]">← Administrator Dashboard</Link>
        <h1 className="mt-3 text-2xl font-extrabold">Database Connection Checker</h1>
        <p className="mt-2 text-sm text-gray-600">Read-only diagnostics. No visitor records or credentials are displayed.</p>
      </div>
      <section className="rounded-2xl border border-[#eadde1] bg-white p-5 shadow-sm" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Connection status</h2>
          <button type="button" onClick={() => void refresh()} disabled={loading}
            className="rounded-full bg-[#82172a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? "Checking…" : "Check connection again"}
          </button>
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-900">{error}</p>}
        {data && <>
          <div className="mt-5 space-y-3">
            {Object.entries(data.checks).map(([key, value]) => <div key={key}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 p-3">
              <span className="text-sm font-medium">{names[key] ?? key}</span>
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${badge[value] ?? badge.unavailable}`}>
                {wording[value] ?? "Unavailable"}
              </span>
            </div>)}
          </div>
          <p className="mt-4 text-xs text-gray-500">Last checked: {new Date(data.checkedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} (Philippine time)</p>
          {data.status !== "connected" && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Verify the Supabase URL and server-only service-role key in the deployment environment, and confirm migrations 09–12 were applied to that database. Do not disable registration safety checks.
          </p>}
          {data.status === "connected" && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
            Database tables are reachable. This does not test SMS delivery, rate-limit RPC execution, or real visitor transactions.
          </p>}
        </>}
      </section>
    </div>
  </main>
}
