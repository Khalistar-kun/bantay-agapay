"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { visitorRegistrationSchema, type VisitorRegistrationInput } from "@/lib/validation/schemas"
import { createClient } from "@/lib/supabase/client"

interface Destination {
  id: string
  name: string
  building: string
}

export function RegistrationForm({ onNext }: { onNext: (data: VisitorRegistrationInput & { sessionToken: string }) => void }) {
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VisitorRegistrationInput>({
    resolver: zodResolver(visitorRegistrationSchema),
  })

  useEffect(() => {
    const fetchDestinations = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from("destinations").select("id, name, building").eq("active", true).order("name")

        if (error) {
          console.error("Error loading destinations from database:", error)
          setLoadError(error.message)
        } else if (data && data.length > 0) {
          setDestinations(data)
        } else {
          setLoadError("No destinations found in database")
        }
      } catch (error: any) {
        console.error("Error loading destinations:", error)
        setLoadError(error?.message || "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchDestinations()
  }, [])

  const onSubmit = async (data: VisitorRegistrationInput) => {
    const sessionToken = Math.random().toString(36).substring(7)
    onNext({ ...data, sessionToken })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-semibold text-sm">⚠️ Could not load destinations from database</p>
          <p className="text-red-700 text-xs mt-1">{loadError}</p>
          <p className="text-red-700 text-xs mt-1">Registration is unavailable until the school destinations can be loaded. Please notify the administrator.</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
        <input
          {...register("fullName")}
          type="text"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
          placeholder="Enter your full name"
        />
        {errors.fullName && <p className="text-red-500 text-sm mt-1">{errors.fullName.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number *</label>
        <input
          {...register("contactNumber")}
          type="tel"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
          placeholder="09XX-XXX-XXXX"
        />
        {errors.contactNumber && <p className="text-red-500 text-sm mt-1">{errors.contactNumber.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Visitor Type *</label>
        <select
          {...register("visitorType")}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">Select visitor type</option>
          <option value="Parent">Parent / Guardian</option>
          <option value="Alumni">Alumni</option>
          <option value="Guest">Guest</option>
          <option value="Supplier">Supplier / Contractor</option>
          <option value="Government">Government / Official Visitor</option>
          <option value="Other">Other</option>
        </select>
        {errors.visitorType && <p className="text-red-500 text-sm mt-1">{errors.visitorType.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Purpose of Visit *</label>
        <input
          {...register("purpose")}
          type="text"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
          placeholder="What is the purpose of your visit?"
        />
        {errors.purpose && <p className="text-red-500 text-sm mt-1">{errors.purpose.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Destination *</label>
        {loading ? (
          <div className="animate-pulse bg-gray-200 h-10 rounded-lg"></div>
        ) : (
          <select
            {...register("destinationId")}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Select destination</option>
            {destinations.map((dest) => (
              <option key={dest.id} value={dest.id}>
                {dest.name} ({dest.building})
              </option>
            ))}
          </select>
        )}
        {errors.destinationId && <p className="text-red-500 text-sm mt-1">{errors.destinationId.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting || loading || !!loadError || destinations.length === 0}
        className="w-full bg-primary-600 text-white font-semibold py-3 rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
      >
        {isSubmitting ? "Processing..." : "Continue to Face Verification"}
      </button>
    </form>
  )
}
