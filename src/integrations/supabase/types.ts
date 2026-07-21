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
      access_requests: {
        Row: {
          brand: string
          brief: string
          created_at: string
          email: string
          id: string
          name: string
          territory: string
        }
        Insert: {
          brand: string
          brief: string
          created_at?: string
          email: string
          id?: string
          name: string
          territory: string
        }
        Update: {
          brand?: string
          brief?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          territory?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          body: string | null
          created_at: string
          id: string
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      briefs: {
        Row: {
          body: string | null
          created_at: string
          file_url: string | null
          id: string
          resident_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          resident_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          resident_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefs_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefs_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          airtel_number: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          momo_number: string | null
          published: boolean
          slug: string
          starts_at: string
          title: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          airtel_number?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          momo_number?: string | null
          published?: boolean
          slug: string
          starts_at: string
          title: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          airtel_number?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          momo_number?: string | null
          published?: boolean
          slug?: string
          starts_at?: string
          title?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          resident_id: string
          sender_role: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          resident_id: string
          sender_role: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          resident_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          admin_notes: string | null
          amount_ugx: number
          buyer_email: string
          buyer_name: string
          buyer_phone: string
          created_at: string
          event_id: string
          id: string
          manual_confirmed_at: string | null
          manual_confirmed_by: string | null
          manual_provider: string | null
          manual_tid: string | null
          paid_at: string | null
          payment_method: string
          pesapal_merchant_reference: string | null
          pesapal_tracking_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount_ugx: number
          buyer_email: string
          buyer_name: string
          buyer_phone: string
          created_at?: string
          event_id: string
          id?: string
          manual_confirmed_at?: string | null
          manual_confirmed_by?: string | null
          manual_provider?: string | null
          manual_tid?: string | null
          paid_at?: string | null
          payment_method?: string
          pesapal_merchant_reference?: string | null
          pesapal_tracking_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount_ugx?: number
          buyer_email?: string
          buyer_name?: string
          buyer_phone?: string
          created_at?: string
          event_id?: string
          id?: string
          manual_confirmed_at?: string | null
          manual_confirmed_by?: string | null
          manual_provider?: string | null
          manual_tid?: string | null
          paid_at?: string | null
          payment_method?: string
          pesapal_merchant_reference?: string | null
          pesapal_tracking_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          aspect_ratio: string
          client: string
          cover_url: string
          created_at: string
          description: string | null
          display_order: number
          external_url: string | null
          gallery_urls: string[]
          id: string
          tag: string
          title: string
          updated_at: string
          year: string
          youtube_url: string | null
        }
        Insert: {
          aspect_ratio?: string
          client: string
          cover_url: string
          created_at?: string
          description?: string | null
          display_order?: number
          external_url?: string | null
          gallery_urls?: string[]
          id?: string
          tag: string
          title: string
          updated_at?: string
          year: string
          youtube_url?: string | null
        }
        Update: {
          aspect_ratio?: string
          client?: string
          cover_url?: string
          created_at?: string
          description?: string | null
          display_order?: number
          external_url?: string | null
          gallery_urls?: string[]
          id?: string
          tag?: string
          title?: string
          updated_at?: string
          year?: string
          youtube_url?: string | null
        }
        Relationships: []
      }
      resident_projects: {
        Row: {
          created_at: string
          project_id: string
          resident_id: string
        }
        Insert: {
          created_at?: string
          project_id: string
          resident_id: string
        }
        Update: {
          created_at?: string
          project_id?: string
          resident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resident_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_projects_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_projects_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      residents: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_order: number
          email: string | null
          id: string
          invited_at: string
          name: string
          since: string
          status: string
          territory: string
          updated_at: string
          user_id: string | null
          visible: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_order?: number
          email?: string | null
          id?: string
          invited_at?: string
          name: string
          since: string
          status?: string
          territory: string
          updated_at?: string
          user_id?: string | null
          visible?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_order?: number
          email?: string | null
          id?: string
          invited_at?: string
          name?: string
          since?: string
          status?: string
          territory?: string
          updated_at?: string
          user_id?: string | null
          visible?: boolean
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      ticket_tiers: {
        Row: {
          capacity: number
          created_at: string
          event_id: string
          id: string
          name: string
          price_ugx: number
          sales_end_at: string | null
          sales_start_at: string | null
          sort: number
          updated_at: string
        }
        Insert: {
          capacity: number
          created_at?: string
          event_id: string
          id?: string
          name: string
          price_ugx: number
          sales_end_at?: string | null
          sales_start_at?: string | null
          sort?: number
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          price_ugx?: number
          sales_end_at?: string | null
          sales_start_at?: string | null
          sort?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_tiers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          created_at: string
          holder_name: string | null
          id: string
          order_id: string
          qr_token: string
          status: string
          tier_id: string
          updated_at: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          holder_name?: string | null
          id?: string
          order_id: string
          qr_token?: string
          status?: string
          tier_id: string
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          holder_name?: string | null
          id?: string
          order_id?: string
          qr_token?: string
          status?: string
          tier_id?: string
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "ticket_tiers"
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
      public_residents: {
        Row: {
          avatar_url: string | null
          display_order: number | null
          id: string | null
          name: string | null
          since: string | null
          status: string | null
          territory: string | null
          visible: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          display_order?: number | null
          id?: string | null
          name?: string | null
          since?: string | null
          status?: string | null
          territory?: string | null
          visible?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          display_order?: number | null
          id?: string | null
          name?: string | null
          since?: string | null
          status?: string | null
          territory?: string | null
          visible?: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_resident_invite: { Args: never; Returns: boolean }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_order_summary: {
        Args: { _ref: string }
        Returns: {
          amount_ugx: number
          buyer_email: string
          event_slug: string
          event_title: string
          order_id: string
          status: string
          ticket_count: number
        }[]
      }
      get_ticket_by_token: {
        Args: { _token: string }
        Returns: {
          event_slug: string
          event_starts_at: string
          event_title: string
          event_venue: string
          holder_name: string
          qr_token: string
          status: string
          ticket_id: string
          tier_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      tier_sold_count: { Args: { _tier_id: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user" | "resident"
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
      app_role: ["admin", "user", "resident"],
    },
  },
} as const
