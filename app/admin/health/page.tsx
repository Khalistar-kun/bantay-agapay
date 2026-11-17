"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

type State = "connected" | "unavailable" | "not_configured"
type Health = { status: State; database: State; checks: Record<string, State>; checkedAt: string }
type SmsHealth = { ready: boolean; destination: string | null; notice: string }

const names: Record<string, string> = {
  connectivity: "Supabase database connection",
  registrationRateLimits: "Registration safety checks table",
  guardianRegistry: "Guardian registry table",
  phoneVerificationProofs: "Mandatory OTP proof storage",
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
  const [sms, setSms] = useState<SmsHealth | null>(null)
  const [smsLoading, setSmsLoading] = useState(true)
  const [smsSending, setSmsSending] = useState(false)
  const [smsNotice, setSmsNotice] = useState("")
  const [smsError, setSmsError] = useState("")
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
  const checkSms = useCallback(async () => {
    setSmsLoading(true)
    setSmsError("")
    try {
      const response = await fetch("/api/admin/health/sms", { credentials: "same-origin", cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "SMS configuration unavailable")
      setSms(body)
    } catch (err) {
      setSms(null)
      setSmsError(err instanceof Error ? err.message : "Unable to check SMS configuration")
    } finally { setSmsLoading(false) }
  }, [])
  async function sendTestSms() {
    if (smsSending || !sms?.ready) return
    setSmsSending(true)
    setSmsNotice("")
    setSmsError("")
    try {
      const response = await fetch("/api/admin/health/sms", {
        method: "POST", credentials: "same-origin", cache: "no-store"
      })
      const body = await response.json()
      if (!response.ok || body.queued !== true)
        throw new Error(body.error || "Gateway did not queue the test SMS")
      setSmsNotice(body.message || "Gateway accepted the test message; check the school test phone.")
    } catch (err) {
      setSmsError(err instanceof Error ? err.message : "SMS test was unsuccessful")
    } finally { setSmsSending(false) }
  }
  useEffect(() => { void refresh(); void checkSms() }, [refresh, checkSms])
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
      <section className="rounded-2xl border border-[#eadde1] bg-white p-5 shadow-sm" aria-label="School test SMS">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Test SMS · TextBee</h2>
            <p className="mt-1 text-sm text-gray-600">Administrator-only test to a school-approved handset. No visitor number or OTP is used.</p>
          </div>
          <button type="button" onClick={() => void checkSms()} disabled={smsLoading || smsSending}
            className="rounded-full border border-[#82172a] px-4 py-2 text-sm font-semibold text-[#82172a] disabled:opacity-50">
            {smsLoading ? "Checking…" : "Refresh SMS status"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#faf6f8] p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Gateway test readiness</p>
            <p className="text-xs text-gray-600">Recipient: {sms?.destination || "Not configured"}</p>
          </div>
          <span className={"rounded-full border px-3 py-1 text-xs font-bold " +
            (sms?.ready ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
              "border-amber-200 bg-amber-50 text-amber-900")}>
            {smsLoading ? "Checking" : sms?.ready ? "Ready for test" : "Unavailable"}
          </span>
        </div>
        <p className="mt-3 text-xs text-gray-600">
          A test sends one real SMS using the school's Android SIM and may consume carrier allowance.
          Only the free TextBee gateway is supported. Queued does not mean delivered.
          Limited to two attempts per administrator/IP per hour and five across the school per day.
        </p>
        <button type="button" onClick={() => void sendTestSms()}
          disabled={!sms?.ready || smsLoading || smsSending}
          className="mt-4 rounded-full bg-[#82172a] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
          {smsSending ? "Requesting test SMS…" : "Send test SMS"}
        </button>
        {smsError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">{smsError}</p>}
        {smsNotice && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{smsNotice}</p>}
        {!sms?.ready && !smsLoading && <p className="mt-3 text-xs text-gray-600">
          Set BA_SMS_TEST_ENABLED=true and BA_SMS_TEST_PHONE to the school's approved test number,
          alongside the existing free-only TextBee configuration. No message is sent until an administrator clicks.
        </p>}
      </section>
    </div>
  </main>
}
