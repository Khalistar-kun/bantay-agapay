"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ShieldCheck, ArrowLeft } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [phoneNumber, setPhoneNumber] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, password }),
      })

      if (response.ok) {
        const { role } = await response.json()
        router.push(role === "ADMIN" ? "/admin" : "/security")
      } else {
        const data = await response.json()
        setError(data.error || "Login failed")
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-5 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-primary-800"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to welcome</Link>
          <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-900 text-gold-300"><ShieldCheck className="h-7 w-7" aria-hidden="true" /></span>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back, staff</h1>
          <p className="text-gray-600">Bantay-Agapay · AFGBMTS</p>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-primary-100 shadow-xl shadow-primary-900/5">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div role="alert" className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>}

            <div>
              <label htmlFor="staff-phone" className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              <input
                id="staff-phone"
                autoComplete="username"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                placeholder="09XX-XXX-XXXX or +63XXX"
                required
              />
            </div>

            <div>
              <label htmlFor="staff-password" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                id="staff-password"
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-800 text-white font-semibold py-3 rounded-lg hover:bg-primary-900 transition disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-6">
            Don't have an account? Ask your administrator to create one for you.
          </p>
        </div>
      </div>
    </div>
  )
}
