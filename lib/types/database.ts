export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          email: string | null
          phone_number: string | null
          password_hash: string | null
          photo_path: string | null
          role: "ADMIN" | "SECURITY" | null
          status: "PENDING" | "APPROVED" | "REJECTED"
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
          visitor_type: string | null
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
          category: string | null
          building: string | null
          floor: string | null
          room: string | null
          description: string | null
          landmark: string | null
          directions: string | null
          map_x: number | null
          map_y: number | null
          latitude: number | null
          longitude: number | null
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
          purpose: string | null
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
          latitude: number | null
          longitude: number | null
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
      staff_sessions: {
        Row: {
          token: string
          profile_id: string
          created_at: string
          expires_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["staff_sessions"]["Row"], "created_at">
        Update: Partial<Database["public"]["Tables"]["staff_sessions"]["Row"]>
      }
      staff_invites: {
        Row: {
          token: string
          role: "ADMIN" | "SECURITY"
          created_by: string | null
          used_at: string | null
          used_by_profile_id: string | null
          created_at: string
          expires_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["staff_invites"]["Row"], "created_at">
        Update: Partial<Database["public"]["Tables"]["staff_invites"]["Row"]>
      }
    }
    Views: {}
    Functions: {
      get_pending_visitors: {
        Args: Record<string, never>
        Returns: {
          id: string
          reference_number: string
          full_name: string
          visitor_type: string
          purpose: string
          destination_name: string
          registration_time: string
          contact_number: string
          face_reference_path: string | null
        }[]
      }
      get_visit_status: {
        Args: { token: string }
        Returns: {
          status: string
          visitor_name: string
          reference_number: string
          destination_name: string
          approved_at: string | null
          denied_reason: string | null
        }[]
      }
      get_visit_directions: {
        Args: { token: string }
        Returns: {
          status: string
          destination_name: string
          building: string | null
          floor: string | null
          room: string | null
          landmark: string | null
          directions: string | null
          map_x: number | null
          map_y: number | null
        }[]
      }
      get_visit_detail: {
        Args: { visit_id: string }
        Returns: {
          id: string
          reference_number: string
          full_name: string
          visitor_type: string
          contact_number: string
          purpose: string
          destination_name: string
          status: string
          registration_time: string
          face_reference_path: string | null
        }[]
      }
      get_visit_verification: {
        Args: { p_visit_id: string }
        Returns: {
          gps_status: string | null
          gps_accuracy: number | null
          distance_from_school: number | null
          latitude: number | null
          longitude: number | null
          verified_at: string
        }[]
      }
    }
    Enums: {}
    CompositeTypes: {}
  }
}
