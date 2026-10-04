"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

interface Personnel {
  id: string
  full_name: string
  phone_number: string
  role: "ADMIN" | "SECURITY"
  active: boolean
  created_at: string
}

export default function PersonnelPage() {
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [fullName, setFullName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"SECURITY" | "ADMIN">("SECURITY")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)

    try {
      const res = await fetch("/api/admin/personnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phoneNumber, password, role }),
      })

      if (res.ok) {
        setFullName("")
        setPhoneNumber("")
        setPassword("")
        setRole("SECURITY")
        setShowCreateForm(false)
        await fetchPersonnel()
      } else {
        const data = await res.json().catch(() => ({}))
        setCreateError(data.error || "Failed to create account")
      }
    } catch (err) {
      setCreateError("Error creating account. Please check your connection.")
    } finally {
      setCreating(false)
    }
  }

  const updateProfile = async (profileId: string, changes: Partial<Pick<Personnel, "role" | "active">>) => {
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
            <p className="text-gray-600">Create and manage staff accounts</p>
          </div>
          <button
            onClick={() => setShowCreateForm((v) => !v)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            {showCreateForm ? "Cancel" : "+ New Account"}
          </button>
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-lg shadow-md p-6 mb-8 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Create Staff Account</h3>

            {createError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">{createError}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="09XX-XXX-XXXX"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  minLength={6}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "SECURITY" | "ADMIN")}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="SECURITY">Security</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="bg-green-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Account"}
            </button>
          </form>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : personnel.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">No staff accounts yet</div>
        ) : (
          <div className="bg-white rounded-lg shadow-md divide-y">
            {personnel.map((p) => (
              <div key={p.id} className="p-6 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{p.full_name}</p>
                  <p className="text-sm text-gray-500">{p.phone_number}</p>
                </div>
                <div className="flex items-center gap-3">
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
      </div>
    </div>
  )
}
