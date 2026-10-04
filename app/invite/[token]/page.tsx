"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"

export default function InviteRegistrationPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [checking, setChecking] = useState(true)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)

  const [fullName, setFullName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const checkInvite = async () => {
      try {
        const res = await fetch(`/api/invite/${token}`)
        const data = await res.json()

        if (!res.ok) {
          setInviteError(data.error || "Invalid invite link")
        } else {
          setRole(data.role)
        }
      } catch (err) {
        setInviteError("Failed to validate invite link")
      } finally {
        setChecking(false)
      }
    }

    checkInvite()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (password !== confirmPassword) {
      setSubmitError("Passwords do not match")
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch(`/api/invite/${token}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phoneNumber, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data.error || "Failed to create account")
        setSubmitting(false)
        return
      }

      setDone(true)
    } catch (err) {
      setSubmitError("Error submitting registration. Please check your connection.")
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (inviteError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
          <p className="text-red-600 font-semibold text-lg mb-2">Invite Link Invalid</p>
          <p className="text-gray-600">{inviteError}</p>
          <p className="text-gray-500 text-sm mt-4">Please ask your administrator for a new invite link.</p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
          <div className="text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Created</h1>
          <p className="text-gray-600 mb-6">
            Your account has been submitted and is awaiting administrator approval. You'll be able to log in once
            approved.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="w-full bg-primary-600 text-white font-semibold py-3 rounded-lg hover:bg-primary-700 transition"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bantay-Agapay</h1>
          <p className="text-gray-600">{role === "ADMIN" ? "Admin" : "Security Guard"} Registration</p>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-md">
          <form onSubmit={handleSubmit} className="space-y-6">
            {submitError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{submitError}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="09XX-XXX-XXXX"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                minLength={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary-600 text-white font-semibold py-3 rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
            >
              {submitting ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-6">
            Your account will need administrator approval before you can log in.
          </p>
        </div>
      </div>
    </div>
  )
}
