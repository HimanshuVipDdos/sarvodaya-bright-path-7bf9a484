export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      batches: {
        Row: {
          created_at: string
          demo_video_url: string | null
          description: string | null
          duration: string | null
          exam_category: string
          faculty: string[] | null
          features: string[] | null
          fees_inr: number
          id: string
          is_active: boolean
          is_featured: boolean
          original_fees_inr: number | null
          slug: string
          starts_on: string | null
          subjects: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          demo_video_url?: string | null
          description?: string | null
          duration?: string | null
          exam_category: string
          faculty?: string[] | null
          features?: string[] | null
          fees_inr?: number
          id?: string
          is_active?: boolean
          is_featured?: boolean
          original_fees_inr?: number | null
          slug: string
          starts_on?: string | null
          subjects?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          demo_video_url?: string | null
          description?: string | null
          duration?: string | null
          exam_category?: string
          faculty?: string[] | null
          features?: string[] | null
          fees_inr?: number
          id?: string
          is_active?: boolean
          is_featured?: boolean
          original_fees_inr?: number | null
          slug?: string
          starts_on?: string | null
          subjects?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      current_affairs: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_active: boolean
          pdf_url: string | null
          publish_date: string
          summary: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          pdf_url?: string | null
          publish_date?: string
          summary?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          pdf_url?: string | null
          publish_date?: string
          summary?: string | null
          title?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          amount_paid_inr: number | null
          batch_id: string
          enrolled_at: string
          expires_at: string | null
          id: string
          payment_provider: string | null
          payment_ref: string | null
          payment_status: string
          status: string
          user_id: string
        }
        Insert: {
          amount_paid_inr?: number | null
          batch_id: string
          enrolled_at?: string
          expires_at?: string | null
          id?: string
          payment_provider?: string | null
          payment_ref?: string | null
          payment_status?: string
          status?: string
          user_id: string
        }
        Update: {
          amount_paid_inr?: number | null
          batch_id?: string
          enrolled_at?: string
          expires_at?: string | null
          id?: string
          payment_provider?: string | null
          payment_ref?: string | null
          payment_status?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      faculty: {
        Row: {
          bio: string | null
          created_at: string
          designation: string | null
          experience_years: number | null
          id: string
          is_active: boolean
          name: string
          photo_url: string | null
          sort_order: number | null
          subject: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          designation?: string | null
          experience_years?: number | null
          id?: string
          is_active?: boolean
          name: string
          photo_url?: string | null
          sort_order?: number | null
          subject?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          designation?: string | null
          experience_years?: number | null
          id?: string
          is_active?: boolean
          name?: string
          photo_url?: string | null
          sort_order?: number | null
          subject?: string | null
        }
        Relationships: []
      }
      gallery: {
        Row: {
          category: string | null
          created_at: string
          id: string
          image_url: string
          sort_order: number | null
          title: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          image_url: string
          sort_order?: number | null
          title?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string
          sort_order?: number | null
          title?: string | null
        }
        Relationships: []
      }
      inquiries: {
        Row: {
          class_level: string | null
          created_at: string
          exam_target: string | null
          full_name: string
          id: string
          message: string | null
          phone: string
          status: string
        }
        Insert: {
          class_level?: string | null
          created_at?: string
          exam_target?: string | null
          full_name: string
          id?: string
          message?: string | null
          phone: string
          status?: string
        }
        Update: {
          class_level?: string | null
          created_at?: string
          exam_target?: string | null
          full_name?: string
          id?: string
          message?: string | null
          phone?: string
          status?: string
        }
        Relationships: []
      }
      lectures: {
        Row: {
          batch_id: string | null
          chapter: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          is_published: boolean
          lecture_number: number | null
          subject: string | null
          thumbnail_url: string | null
          title: string
          video_url: string | null
        }
        Insert: {
          batch_id?: string | null
          chapter?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean
          lecture_number?: number | null
          subject?: string | null
          thumbnail_url?: string | null
          title: string
          video_url?: string | null
        }
        Update: {
          batch_id?: string | null
          chapter?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean
          lecture_number?: number | null
          subject?: string | null
          thumbnail_url?: string | null
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lectures_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      live_classes: {
        Row: {
          auto_end: boolean
          auto_start: boolean
          batch_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          end_at: string | null
          id: string
          is_live: boolean
          meet_url: string | null
          recorded_lecture_id: string | null
          scheduled_at: string
          thumbnail_url: string | null
          title: string
          youtube_url: string | null
          zoom_url: string | null
        }
        Insert: {
          auto_end?: boolean
          auto_start?: boolean
          batch_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          end_at?: string | null
          id?: string
          is_live?: boolean
          meet_url?: string | null
          recorded_lecture_id?: string | null
          scheduled_at: string
          thumbnail_url?: string | null
          title: string
          youtube_url?: string | null
          zoom_url?: string | null
        }
        Update: {
          auto_end?: boolean
          auto_start?: boolean
          batch_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          end_at?: string | null
          id?: string
          is_live?: boolean
          meet_url?: string | null
          recorded_lecture_id?: string | null
          scheduled_at?: string
          thumbnail_url?: string | null
          title?: string
          youtube_url?: string | null
          zoom_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_classes_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_classes_recorded_lecture_id_fkey"
            columns: ["recorded_lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          exam_date: string | null
          id: string
          is_active: boolean
          link_url: string | null
          title: string
        }
        Insert: {
          body?: string | null
          category?: string
          created_at?: string
          exam_date?: string | null
          id?: string
          is_active?: boolean
          link_url?: string | null
          title: string
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          exam_date?: string | null
          id?: string
          is_active?: boolean
          link_url?: string | null
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          class_level: string | null
          created_at: string
          exam_target: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          class_level?: string | null
          created_at?: string
          exam_target?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          class_level?: string | null
          created_at?: string
          exam_target?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      results: {
        Row: {
          created_at: string
          exam_name: string
          id: string
          is_featured: boolean
          photo_url: string | null
          rank_or_marks: string | null
          sort_order: number | null
          student_name: string
          testimonial: string | null
          year: number | null
        }
        Insert: {
          created_at?: string
          exam_name: string
          id?: string
          is_featured?: boolean
          photo_url?: string | null
          rank_or_marks?: string | null
          sort_order?: number | null
          student_name: string
          testimonial?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string
          exam_name?: string
          id?: string
          is_featured?: boolean
          photo_url?: string | null
          rank_or_marks?: string | null
          sort_order?: number | null
          student_name?: string
          testimonial?: string | null
          year?: number | null
        }
        Relationships: []
      }
      study_materials: {
        Row: {
          batch_id: string | null
          chapter: string | null
          created_at: string
          description: string | null
          file_url: string | null
          id: string
          is_free: boolean
          material_type: string
          subject: string | null
          title: string
        }
        Insert: {
          batch_id?: string | null
          chapter?: string | null
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          is_free?: boolean
          material_type?: string
          subject?: string | null
          title: string
        }
        Update: {
          batch_id?: string | null
          chapter?: string | null
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          is_free?: boolean
          material_type?: string
          subject?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_materials_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      tick_live_classes: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "student"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "student"],
    },
  },
} as const
