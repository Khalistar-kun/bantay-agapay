"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import QRCode from "qrcode"

interface Personnel {
  id: string
  full_name: string
  phone_number: string
  role: "ADMIN" | "SECURITY"
  active: boolean
  status: "PENDING" | "APPROVED" | "REJECTED"
  created_at: string
  photoUrl: string | null
}

export default function PersonnelPage() {
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  const [showInvite, setShowInvite] = useState(false)
  const [inviteRole, setInviteRole] = useState<"SECURITY" | "ADMIN">("SECURITY")
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inviteExpiresAt, setInviteExpiresAt] = useState<string | null>(null)
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  const fetchPersonnel = async () => {
    try {
      const res = await fetch("/api/admin/personnel")
      if (res.ok) {
        const { personnel } = await res.json()
        setPersonnel(personnel)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPersonnel()
  }, [])

  useEffect(() => {
    if (inviteUrl && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, inviteUrl, { width: 240, margin: 2 }, (err) => {
        if (err) console.error("QR render error:", err)
      })
    }
  }, [inviteUrl])

  const handleGenerateInvite = async () => {
    setGeneratingInvite(true)
    setInviteError(null)
    setInviteUrl(null)

    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: inviteRole }),
      })

      const data = await res.json()

      if (!res.ok) {
        setInviteError(data.error || "Failed to generate invite")
        return
      }

      setInviteUrl(`${window.location.origin}/invite/${data.token}`)
      setInviteExpiresAt(data.expiresAt)
    } catch (err) {
      setInviteError("Error generating invite. Please check your connection.")
    } finally {
      setGeneratingInvite(false)
    }
  }

  const updateProfile = async (profileId: string, changes: Partial<Pick<Personnel, "role" | "active" | "status">>) => {
    setUpdating(profileId)
    try {
      const res = await fetch("/api/admin/personnel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, ...changes }),
      })

      if (res.ok) {
        await fetchPersonnel()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || "Failed to update")
      }
    } catch (err) {
      alert("Error updating personnel record")
    } finally {
      setUpdating(null)
    }
  }

  const toggleActive = (p: Personnel) => updateProfile(p.id, { active: !p.active })
  const approve = (p: Personnel) => updateProfile(p.id, { status: "APPROVED" })
  const reject = (p: Personnel) => updateProfile(p.id, { status: "REJECTED" })

  const pending = personnel.filter((p) => p.status === "PENDING")
  const others = personnel.filter((p) => p.status !== "PENDING")

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Bantay-Agapay Admin</h1>
            <Link href="/admin" className="text-blue-600 hover:text-blue-800">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Personnel</h2>
            <p className="text-gray-600">Invite new staff to register from their own phone</p>
          </div>
          <button
            onClick={() => {
              setShowInvite((v) => !v)
              setInviteUrl(null)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            {showInvite ? "Cancel" : "+ Generate Invite QR"}
          </button>
        </div>

        {showInvite && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Staff Invite</h3>

            {inviteError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm mb-4">{inviteError}</div>
            )}

            {!inviteUrl ? (
              <div className="flex items-end gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "SECURITY" | "ADMIN")}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="SECURITY">Security</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <button
                  onClick={handleGenerateInvite}
                  disabled={generatingInvite}
                  className="bg-green-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  {generatingInvite ? "Generating..." : "Generate QR Code"}
                </button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-700 mb-4">
                  Show this QR code to the new <strong>{inviteRole === "ADMIN" ? "admin" : "security guard"}</strong>.
                  They'll scan it with their phone to create their own account.
                </p>
                <canvas ref={qrCanvasRef} className="mx-auto border rounded-lg p-2" />
                <p className="text-xs text-gray-500 mt-3">
                  Valid for one use, expires{" "}
                  {inviteExpiresAt ? new Date(inviteExpiresAt).toLocaleTimeString() : ""}
                </p>
                <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
                  The new account will need your approval below before it can log in.
                </p>
                <button
                  onClick={handleGenerateInvite}
                  className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-semibold"
                >
                  Generate a new one
                </button>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-10">
            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Pending Approval {pending.length > 0 && <span className="text-yellow-600">({pending.length})</span>}
              </h3>

              {pending.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
                  No accounts awaiting approval
                </div>
              ) : (
                <div className="grid gap-4">
                  {pending.map((p) => (
                    <div key={p.id} className="bg-white rounded-lg shadow-md p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {p.photoUrl ? (
                          <img src={p.photoUrl} alt={p.full_name} className="w-12 h-12 rounded-full object-cover border" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-100 border flex items-center justify-center text-gray-400 text-sm">
                            {p.full_name?.[0] || "?"}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-900">{p.full_name}</p>
                          <p className="text-sm text-gray-500">{p.phone_number}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Registered as {p.role} · {new Date(p.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => approve(p)}
                          disabled={updating === p.id}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => reject(p)}
                          disabled={updating === p.id}
                          className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">All Staff</h3>

              {others.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">No staff accounts yet</div>
              ) : (
                <div className="bg-white rounded-lg shadow-md divide-y">
                  {others.map((p) => (
                    <div key={p.id} className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {p.photoUrl ? (
                          <img src={p.photoUrl} alt={p.full_name} className="w-12 h-12 rounded-full object-cover border" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-100 border flex items-center justify-center text-gray-400 text-sm">
                            {p.full_name?.[0] || "?"}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-900">{p.full_name}</p>
                          <p className="text-sm text-gray-500">{p.phone_number}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {p.status === "REJECTED" && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                            Rejected
                          </span>
                        )}
                        <select
                          value={p.role}
                          onChange={(e) => updateProfile(p.id, { role: e.target.value as "ADMIN" | "SECURITY" })}
                          disabled={updating === p.id}
                          className={`px-3 py-1 rounded-full text-sm font-semibold border-0 ${
                            p.role === "ADMIN" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          <option value="SECURITY">SECURITY</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            p.active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {p.active ? "Active" : "Deactivated"}
                        </span>
                        <button
                          onClick={() => toggleActive(p)}
                          disabled={updating === p.id}
                          className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                        >
                          {p.active ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
