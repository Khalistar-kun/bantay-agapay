export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          role: "ADMIN" | "SECURITY"
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "id" | "created_at" | "updated_at">
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>
      }
      visitors: {
        Row: {
          id: string
          full_name: string
          contact_number: string
          visitor_type: string
          face_reference_path: string | null
          face_embedding: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["visitors"]["Row"], "id" | "created_at" | "updated_at">
        Update: Partial<Database["public"]["Tables"]["visitors"]["Row"]>
      }
      destinations: {
        Row: {
          id: string
          name: string
          category: string
          building: string
          floor: string
          room: string
          description: string
          landmark: string
          directions: string
          map_x: number
          map_y: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["destinations"]["Row"], "id" | "created_at" | "updated_at">
        Update: Partial<Database["public"]["Tables"]["destinations"]["Row"]>
      }
      visits: {
        Row: {
          id: string
          visitor_id: string
          destination_id: string
          reference_number: string
          purpose: string
          status: "PENDING" | "INSIDE" | "EXITED" | "DENIED" | "CANCELLED"
          registration_time: string
          approved_at: string | null
          approved_by: string | null
          check_in: string | null
          check_out: string | null
          denied_at: string | null
          denied_by: string | null
          denial_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["visits"]["Row"], "id" | "created_at" | "updated_at">
        Update: Partial<Database["public"]["Tables"]["visits"]["Row"]>
      }
      verification_logs: {
        Row: {
          id: string
          visit_id: string
          face_status: "FACE_ENROLLED" | "FACE_VERIFIED" | "FACE_NO_MATCH" | "FACE_DETECTION_FAILED" | null
          face_similarity: number | null
          gps_status: "GPS_VERIFIED" | "OUTSIDE_AUTHORIZED_AREA" | "GPS_FAILED" | null
          gps_accuracy: number | null
          distance_from_school: number | null
          verified_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["verification_logs"]["Row"], "id">
        Update: Partial<Database["public"]["Tables"]["verification_logs"]["Row"]>
      }
      system_settings: {
        Row: {
          id: string
          key: string
          value: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["system_settings"]["Row"], "id" | "created_at" | "updated_at">
        Update: Partial<Database["public"]["Tables"]["system_settings"]["Row"]>
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string
          action: string
          entity_type: string
          entity_id: string
          metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["audit_logs"]["Row"], "id" | "created_at">
        Update: never
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}
