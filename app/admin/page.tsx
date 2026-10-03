"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState({
    todayVisitors: 0,
    currentlyInside: 0,
    pendingApproval: 0,
    completedToday: 0,
  })

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/admin/stats")
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (error) {
        console.error("Error fetching stats:", error)
      }
    }

    fetchStats()
  }, [])

  const handleLogout = () => {
    // Clear session cookie
    document.cookie = "auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Bantay-Agapay Admin</h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <p className="text-gray-600 text-sm">Visitors Today</p>
            <p className="text-4xl font-bold text-gray-900 mt-2">{stats.todayVisitors}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <p className="text-gray-600 text-sm">Currently Inside</p>
            <p className="text-4xl font-bold text-green-600 mt-2">{stats.currentlyInside}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <p className="text-gray-600 text-sm">Pending Approval</p>
            <p className="text-4xl font-bold text-yellow-600 mt-2">{stats.pendingApproval}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <p className="text-gray-600 text-sm">Completed Today</p>
            <p className="text-4xl font-bold text-blue-600 mt-2">{stats.completedToday}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Link href="/admin/visitors" className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Visitor Records</h3>
            <p className="text-gray-600 text-sm">Search and view visitor history</p>
          </Link>

          <Link href="/admin/destinations" className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Destinations</h3>
            <p className="text-gray-600 text-sm">Manage campus destinations</p>
          </Link>

          <Link href="/admin/personnel" className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Personnel</h3>
            <p className="text-gray-600 text-sm">Manage security staff accounts</p>
          </Link>

          <Link href="/admin/settings" className="bg-blue-50 p-6 rounded-lg shadow-md hover:shadow-lg transition border-2 border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">⚙️ Settings</h3>
            <p className="text-blue-700 text-sm">Configure school location & geofence</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
