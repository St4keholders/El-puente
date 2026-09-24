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
      activity_events: {
        Row: {
          actor_name: string | null
          cause_id: string
          city: string | null
          country_code: string
          created_at: string
          id: number
          kind: Database["public"]["Enums"]["activity_kind"]
        }
        Insert: {
          actor_name?: string | null
          cause_id: string
          city?: string | null
          country_code: string
          created_at?: string
          id?: never
          kind: Database["public"]["Enums"]["activity_kind"]
        }
        Update: {
          actor_name?: string | null
          cause_id?: string
          city?: string | null
          country_code?: string
          created_at?: string
          id?: never
          kind?: Database["public"]["Enums"]["activity_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_cause_id_fkey"
            columns: ["cause_id"]
            isOneToOne: false
            referencedRelation: "causes"
            referencedColumns: ["id"]
          },
        ]
      }
      cause_media: {
        Row: {
          alt: string | null
          bucket: string
          bytes: number | null
          cause_id: string
          created_at: string
          duration_seconds: number | null
          height: number | null
          id: string
          is_poster: boolean
          kind: Database["public"]["Enums"]["media_kind"]
          owner_id: string
          phase: Database["public"]["Enums"]["media_phase"]
          position: number
          storage_path: string
          thumb_path: string | null
          width: number | null
        }
        Insert: {
          alt?: string | null
          bucket: string
          bytes?: number | null
          cause_id: string
          created_at?: string
          duration_seconds?: number | null
          height?: number | null
          id?: string
          is_poster?: boolean
          kind: Database["public"]["Enums"]["media_kind"]
          owner_id: string
          phase?: Database["public"]["Enums"]["media_phase"]
          position?: number
          storage_path: string
          thumb_path?: string | null
          width?: number | null
        }
        Update: {
          alt?: string | null
          bucket?: string
          bytes?: number | null
          cause_id?: string
          created_at?: string
          duration_seconds?: number | null
          height?: number | null
          id?: string
          is_poster?: boolean
          kind?: Database["public"]["Enums"]["media_kind"]
          owner_id?: string
          phase?: Database["public"]["Enums"]["media_phase"]
          position?: number
          storage_path?: string
          thumb_path?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cause_media_cause_id_fkey"
            columns: ["cause_id"]
            isOneToOne: false
            referencedRelation: "causes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cause_media_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cause_results: {
        Row: {
          amount_received: number
          cause_id: string
          created_at: string
          currency: string
          owner_id: string
          summary: string
          updated_at: string
        }
        Insert: {
          amount_received: number
          cause_id: string
          created_at?: string
          currency?: string
          owner_id: string
          summary: string
          updated_at?: string
        }
        Update: {
          amount_received?: number
          cause_id?: string
          created_at?: string
          currency?: string
          owner_id?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cause_results_cause_id_fkey"
            columns: ["cause_id"]
            isOneToOne: true
            referencedRelation: "causes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cause_results_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cause_supplies: {
        Row: {
          cause_id: string
          created_at: string
          id: string
          name: string
          owner_id: string
          position: number
          quantity_needed: number | null
          quantity_received: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          cause_id: string
          created_at?: string
          id?: string
          name: string
          owner_id: string
          position?: number
          quantity_needed?: number | null
          quantity_received?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          cause_id?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          position?: number
          quantity_needed?: number | null
          quantity_received?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cause_supplies_cause_id_fkey"
            columns: ["cause_id"]
            isOneToOne: false
            referencedRelation: "causes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cause_supplies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      causes: {
        Row: {
          author_id: string
          category: Database["public"]["Enums"]["cause_category"]
          city: string | null
          closed_at: string | null
          closing_note: string | null
          collection_type: Database["public"]["Enums"]["collection_type"]
          comments_count: number
          country_code: string | null
          created_at: string
          currency: string
          description: string | null
          finalized_at: string | null
          first_support_confirmed_at: string | null
          goal_amount: number | null
          id: string
          is_example: boolean
          is_seed: boolean
          lat: number | null
          lng: number | null
          published_at: string | null
          raised_reported: number | null
          region: string | null
          saves_count: number
          status: Database["public"]["Enums"]["cause_status"]
          supplies_instructions: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          category?: Database["public"]["Enums"]["cause_category"]
          city?: string | null
          closed_at?: string | null
          closing_note?: string | null
          collection_type?: Database["public"]["Enums"]["collection_type"]
          comments_count?: number
          country_code?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          finalized_at?: string | null
          first_support_confirmed_at?: string | null
          goal_amount?: number | null
          id?: string
          is_example?: boolean
          is_seed?: boolean
          lat?: number | null
          lng?: number | null
          published_at?: string | null
          raised_reported?: number | null
          region?: string | null
          saves_count?: number
          status?: Database["public"]["Enums"]["cause_status"]
          supplies_instructions?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          category?: Database["public"]["Enums"]["cause_category"]
          city?: string | null
          closed_at?: string | null
          closing_note?: string | null
          collection_type?: Database["public"]["Enums"]["collection_type"]
          comments_count?: number
          country_code?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          finalized_at?: string | null
          first_support_confirmed_at?: string | null
          goal_amount?: number | null
          id?: string
          is_example?: boolean
          is_seed?: boolean
          lat?: number | null
          lng?: number | null
          published_at?: string | null
          raised_reported?: number | null
          region?: string | null
          saves_count?: number
          status?: Database["public"]["Enums"]["cause_status"]
          supplies_instructions?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "causes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          cause_id: string
          created_at: string
          edited_at: string | null
          id: string
          parent_id: string | null
          replies_count: number
          thread: Database["public"]["Enums"]["comment_thread"]
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          cause_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          parent_id?: string | null
          replies_count?: number
          thread?: Database["public"]["Enums"]["comment_thread"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          cause_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          parent_id?: string | null
          replies_count?: number
          thread?: Database["public"]["Enums"]["comment_thread"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_cause_id_fkey"
            columns: ["cause_id"]
            isOneToOne: false
            referencedRelation: "causes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      donation_methods: {
        Row: {
          account_holder: string
          account_value: string
          cause_id: string
          created_at: string
          details: string | null
          id: string
          kind: Database["public"]["Enums"]["donation_method_kind"]
          owner_id: string
          position: number
          profile_method_id: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          account_holder: string
          account_value: string
          cause_id: string
          created_at?: string
          details?: string | null
          id?: string
          kind: Database["public"]["Enums"]["donation_method_kind"]
          owner_id: string
          position?: number
          profile_method_id?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          account_holder?: string
          account_value?: string
          cause_id?: string
          created_at?: string
          details?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["donation_method_kind"]
          owner_id?: string
          position?: number
          profile_method_id?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "donation_methods_cause_id_fkey"
            columns: ["cause_id"]
            isOneToOne: false
            referencedRelation: "causes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_methods_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_methods_profile_method_id_fkey"
            columns: ["profile_method_id"]
            isOneToOne: false
            referencedRelation: "profile_donation_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_donation_methods: {
        Row: {
          account_holder: string
          account_value: string
          created_at: string
          details: string | null
          id: string
          kind: Database["public"]["Enums"]["donation_method_kind"]
          owner_id: string
          position: number
          provider: string
          updated_at: string
        }
        Insert: {
          account_holder: string
          account_value: string
          created_at?: string
          details?: string | null
          id?: string
          kind: Database["public"]["Enums"]["donation_method_kind"]
          owner_id: string
          position?: number
          provider: string
          updated_at?: string
        }
        Update: {
          account_holder?: string
          account_value?: string
          created_at?: string
          details?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["donation_method_kind"]
          owner_id?: string
          position?: number
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_donation_methods_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_private: {
        Row: {
          created_at: string
          id: string
          phone: string | null
          phone_verified_at: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          phone?: string | null
          phone_verified_at?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          phone?: string | null
          phone_verified_at?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_private_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          causes_count: number
          city: string | null
          country_code: string | null
          created_at: string
          followers_count: number
          following_count: number
          full_name: string
          id: string
          is_seed: boolean
          onboarding_completed_at: string | null
          public_id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          causes_count?: number
          city?: string | null
          country_code?: string | null
          created_at?: string
          followers_count?: number
          following_count?: number
          full_name?: string
          id: string
          is_seed?: boolean
          onboarding_completed_at?: string | null
          public_id?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          causes_count?: number
          city?: string | null
          country_code?: string | null
          created_at?: string
          followers_count?: number
          following_count?: number
          full_name?: string
          id?: string
          is_seed?: boolean
          onboarding_completed_at?: string | null
          public_id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          cause_id: string | null
          comment_id: string | null
          created_at: string
          details: string | null
          id: string
          profile_id: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          status: string
        }
        Insert: {
          cause_id?: string | null
          comment_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          profile_id?: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          status?: string
        }
        Update: {
          cause_id?: string | null
          comment_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          profile_id?: string | null
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_cause_id_fkey"
            columns: ["cause_id"]
            isOneToOne: false
            referencedRelation: "causes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saves: {
        Row: {
          cause_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          cause_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          cause_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saves_cause_id_fkey"
            columns: ["cause_id"]
            isOneToOne: false
            referencedRelation: "causes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      country_cause_counts: {
        Row: {
          active_count: number | null
          country_code: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      complete_onboarding: {
        Args: { p_full_name: string; p_phone: string; p_terms_version: string }
        Returns: undefined
      }
      confirm_support: {
        Args: { p_amount?: number; p_cause_id: string; p_supplies?: Json }
        Returns: undefined
      }
      create_example_cause: { Args: never; Returns: string }
      escape_like: { Args: { t: string }; Returns: string }
      f_unaccent: { Args: { "": string }; Returns: string }
      gen_public_id: { Args: never; Returns: string }
      feed_causes: {
        Args: {
          p_category?: Database["public"]["Enums"]["cause_category"]
          p_country?: string
          p_cursor_id?: string
          p_cursor_ts?: string
          p_following?: boolean
          p_limit?: number
          p_q?: string
          p_status: Database["public"]["Enums"]["cause_status"]
        }
        Returns: {
          author_id: string
          category: Database["public"]["Enums"]["cause_category"]
          city: string | null
          closed_at: string | null
          closing_note: string | null
          collection_type: Database["public"]["Enums"]["collection_type"]
          comments_count: number
          country_code: string | null
          created_at: string
          currency: string
          description: string | null
          finalized_at: string | null
          first_support_confirmed_at: string | null
          goal_amount: number | null
          id: string
          is_example: boolean
          is_seed: boolean
          lat: number | null
          lng: number | null
          published_at: string | null
          raised_reported: number | null
          region: string | null
          saves_count: number
          status: Database["public"]["Enums"]["cause_status"]
          supplies_instructions: string | null
          title: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "causes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      feed_facets: {
        Args: {
          p_category?: Database["public"]["Enums"]["cause_category"]
          p_country?: string
          p_following?: boolean
          p_q?: string
          p_status: Database["public"]["Enums"]["cause_status"]
        }
        Returns: Json
      }
      is_onboarded: { Args: never; Returns: boolean }
      recent_closures: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          author_id: string
          category: Database["public"]["Enums"]["cause_category"]
          city: string | null
          closed_at: string | null
          closing_note: string | null
          collection_type: Database["public"]["Enums"]["collection_type"]
          comments_count: number
          country_code: string | null
          created_at: string
          currency: string
          description: string | null
          finalized_at: string | null
          first_support_confirmed_at: string | null
          goal_amount: number | null
          id: string
          is_example: boolean
          is_seed: boolean
          lat: number | null
          lng: number | null
          published_at: string | null
          raised_reported: number | null
          region: string | null
          saves_count: number
          status: Database["public"]["Enums"]["cause_status"]
          supplies_instructions: string | null
          title: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "causes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_people_and_causes: {
        Args: { max_results?: number; q: string }
        Returns: {
          country_code: string
          id: string
          kind: string
          label: string
          lat: number
          lng: number
          public_id: string
          score: number
          sublabel: string
        }[]
      }
      sync_profile_method: { Args: { p_method_id: string }; Returns: number }
      username_available: { Args: { p_username: string }; Returns: boolean }
      username_is_valid: { Args: { p: string }; Returns: boolean }
    }
    Enums: {
      activity_kind: "causa_publicada" | "causa_cerrada" | "causa_finalizada"
      cause_category:
        | "terremoto"
        | "inundacion"
        | "incendio"
        | "tormenta"
        | "sequia"
        | "salud"
        | "alimentacion"
        | "vivienda"
        | "educacion"
        | "otra"
      cause_status: "borrador" | "activa" | "cerrada" | "finalizada" | "oculta"
      collection_type: "dinero" | "insumos" | "ambas"
      comment_thread: "causa" | "resultado"
      donation_method_kind:
        | "transferencia_bancaria"
        | "billetera_digital"
        | "paypal"
        | "enlace_de_pago"
        | "otro"
      media_kind: "imagen" | "video"
      media_phase: "causa" | "resultado"
      report_reason:
        | "fraude"
        | "informacion_falsa"
        | "contenido_inapropiado"
        | "spam"
        | "otro"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      activity_kind: ["causa_publicada", "causa_cerrada", "causa_finalizada"],
      cause_category: [
        "terremoto",
        "inundacion",
        "incendio",
        "tormenta",
        "sequia",
        "salud",
        "alimentacion",
        "vivienda",
        "educacion",
        "otra",
      ],
      cause_status: ["borrador", "activa", "cerrada", "finalizada", "oculta"],
      collection_type: ["dinero", "insumos", "ambas"],
      comment_thread: ["causa", "resultado"],
      donation_method_kind: [
        "transferencia_bancaria",
        "billetera_digital",
        "paypal",
        "enlace_de_pago",
        "otro",
      ],
      media_kind: ["imagen", "video"],
      media_phase: ["causa", "resultado"],
      report_reason: [
        "fraude",
        "informacion_falsa",
        "contenido_inapropiado",
        "spam",
        "otro",
      ],
    },
  },
} as const
