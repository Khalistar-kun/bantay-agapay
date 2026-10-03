import { z } from "zod"

export const visitorRegistrationSchema = z.object({
  fullName: z.string().min(2, "Full name is required").max(100),
  contactNumber: z.string().min(7, "Valid contact number is required").max(20),
  visitorType: z.enum(["Parent", "Alumni", "Guest", "Supplier", "Government", "Other"]),
  purpose: z.string().min(3, "Purpose is required").max(200),
  destinationId: z.string().min(1, "Destination is required"),
})

export type VisitorRegistrationInput = z.infer<typeof visitorRegistrationSchema>

export const loginSchema = z.object({
  phoneNumber: z.string().min(10, "Valid phone number is required").max(20),
  password: z.string().min(4, "Password is required"),
})

export type LoginInput = z.infer<typeof loginSchema>

export const destinationSchema = z.object({
  name: z.string().min(2).max(100),
  category: z.string().min(2).max(50),
  building: z.string().min(2).max(100),
  floor: z.string().max(50),
  room: z.string().max(50),
  description: z.string().max(500),
  landmark: z.string().max(200),
  directions: z.string().max(1000),
  mapX: z.number().min(0).max(100),
  mapY: z.number().min(0).max(100),
})

export type DestinationInput = z.infer<typeof destinationSchema>
