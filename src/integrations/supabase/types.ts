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
      account_metrics: {
        Row: {
          account_id: string
          created_at: string
          filled_at: string
          filled_by: string | null
          followers: number | null
          id: string
          impressions: number | null
          link_clicks: number | null
          posts: number | null
          profile_visits: number | null
          reach: number | null
          updated_at: string
          week_start: string
        }
        Insert: {
          account_id: string
          created_at?: string
          filled_at?: string
          filled_by?: string | null
          followers?: number | null
          id?: string
          impressions?: number | null
          link_clicks?: number | null
          posts?: number | null
          profile_visits?: number | null
          reach?: number | null
          updated_at?: string
          week_start: string
        }
        Update: {
          account_id?: string
          created_at?: string
          filled_at?: string
          filled_by?: string | null
          followers?: number | null
          id?: string
          impressions?: number | null
          link_clicks?: number | null
          posts?: number | null
          profile_visits?: number | null
          reach?: number | null
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_metrics_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_leads: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          published: boolean
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      availability_blocks: {
        Row: {
          all_day: boolean
          byweekday: number[]
          created_at: string
          created_by: string | null
          end_date: string | null
          end_time: string | null
          freq: string
          id: string
          interval_n: number
          note: string | null
          occurrences: number | null
          owner_kind: string
          owner_user_id: string | null
          resident_id: string | null
          start_date: string
          start_time: string | null
          strictness: string
          title: string
          until: string | null
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          byweekday?: number[]
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          end_time?: string | null
          freq?: string
          id?: string
          interval_n?: number
          note?: string | null
          occurrences?: number | null
          owner_kind?: string
          owner_user_id?: string | null
          resident_id?: string | null
          start_date: string
          start_time?: string | null
          strictness?: string
          title: string
          until?: string | null
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          byweekday?: number[]
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          end_time?: string | null
          freq?: string
          id?: string
          interval_n?: number
          note?: string | null
          occurrences?: number | null
          owner_kind?: string
          owner_user_id?: string | null
          resident_id?: string | null
          start_date?: string
          start_time?: string | null
          strictness?: string
          title?: string
          until?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_blocks_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_blocks_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_assets: {
        Row: {
          created_at: string
          created_by: string | null
          file_path: string
          id: string
          label: string
          resident_id: string
          sort: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_path: string
          id?: string
          label?: string
          resident_id: string
          sort?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_path?: string
          id?: string
          label?: string
          resident_id?: string
          sort?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_assets_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_assets_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_guidelines: {
        Row: {
          colours: Json
          created_at: string
          created_by: string | null
          donts: string | null
          dos: string | null
          id: string
          notes: string | null
          pdf_path: string | null
          primary_font: string | null
          primary_font_use: string | null
          resident_id: string
          secondary_font: string | null
          secondary_font_use: string | null
          tone: string | null
          updated_at: string
        }
        Insert: {
          colours?: Json
          created_at?: string
          created_by?: string | null
          donts?: string | null
          dos?: string | null
          id?: string
          notes?: string | null
          pdf_path?: string | null
          primary_font?: string | null
          primary_font_use?: string | null
          resident_id: string
          secondary_font?: string | null
          secondary_font_use?: string | null
          tone?: string | null
          updated_at?: string
        }
        Update: {
          colours?: Json
          created_at?: string
          created_by?: string | null
          donts?: string | null
          dos?: string | null
          id?: string
          notes?: string | null
          pdf_path?: string | null
          primary_font?: string | null
          primary_font_use?: string | null
          resident_id?: string
          secondary_font?: string | null
          secondary_font_use?: string | null
          tone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_guidelines_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: true
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_guidelines_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: true
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      briefs: {
        Row: {
          body: string | null
          content_id: string | null
          created_at: string
          created_by: string | null
          file_url: string | null
          id: string
          resident_id: string
          shoot_day_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          content_id?: string | null
          created_at?: string
          created_by?: string | null
          file_url?: string | null
          id?: string
          resident_id: string
          shoot_day_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          content_id?: string | null
          created_at?: string
          created_by?: string | null
          file_url?: string | null
          id?: string
          resident_id?: string
          shoot_day_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "briefs_shoot_day_id_fkey"
            columns: ["shoot_day_id"]
            isOneToOne: false
            referencedRelation: "shoot_days"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          cap_ugx: number
          category: string
          created_at: string
          created_by: string | null
          id: string
          month: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          cap_ugx: number
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          month: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          cap_ugx?: number
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          month?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      calendar_busy_slots: {
        Row: {
          all_day: boolean
          byweekday: number[]
          calendar_item_id: string
          created_at: string
          end_date: string
          end_time: string | null
          freq: string
          interval_n: number
          occurrences: number | null
          owner_user_id: string
          start_date: string
          start_time: string | null
          strictness: string
          until: string | null
          updated_at: string
        }
        Insert: {
          all_day: boolean
          byweekday?: number[]
          calendar_item_id: string
          created_at?: string
          end_date: string
          end_time?: string | null
          freq: string
          interval_n: number
          occurrences?: number | null
          owner_user_id: string
          start_date: string
          start_time?: string | null
          strictness: string
          until?: string | null
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          byweekday?: number[]
          calendar_item_id?: string
          created_at?: string
          end_date?: string
          end_time?: string | null
          freq?: string
          interval_n?: number
          occurrences?: number | null
          owner_user_id?: string
          start_date?: string
          start_time?: string | null
          strictness?: string
          until?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_busy_slots_calendar_item_id_fkey"
            columns: ["calendar_item_id"]
            isOneToOne: true
            referencedRelation: "calendar_items"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_items: {
        Row: {
          all_day: boolean
          byweekday: number[]
          created_at: string
          end_date: string
          end_time: string | null
          freq: string
          id: string
          interval_n: number
          location: string | null
          note: string | null
          occurrences: number | null
          owner_user_id: string
          reminder_at: string | null
          reminder_dismissed_at: string | null
          reminder_minutes: number | null
          start_date: string
          start_time: string | null
          strictness: string
          timezone: string
          title: string
          until: string | null
          updated_at: string
          visibility: string
          work_id: string | null
          work_kind: string | null
          work_label: string | null
          work_path: string | null
        }
        Insert: {
          all_day?: boolean
          byweekday?: number[]
          created_at?: string
          end_date: string
          end_time?: string | null
          freq?: string
          id?: string
          interval_n?: number
          location?: string | null
          note?: string | null
          occurrences?: number | null
          owner_user_id?: string
          reminder_at?: string | null
          reminder_dismissed_at?: string | null
          reminder_minutes?: number | null
          start_date: string
          start_time?: string | null
          strictness?: string
          timezone?: string
          title: string
          until?: string | null
          updated_at?: string
          visibility?: string
          work_id?: string | null
          work_kind?: string | null
          work_label?: string | null
          work_path?: string | null
        }
        Update: {
          all_day?: boolean
          byweekday?: number[]
          created_at?: string
          end_date?: string
          end_time?: string | null
          freq?: string
          id?: string
          interval_n?: number
          location?: string | null
          note?: string | null
          occurrences?: number | null
          owner_user_id?: string
          reminder_at?: string | null
          reminder_dismissed_at?: string | null
          reminder_minutes?: number | null
          start_date?: string
          start_time?: string | null
          strictness?: string
          timezone?: string
          title?: string
          until?: string | null
          updated_at?: string
          visibility?: string
          work_id?: string | null
          work_kind?: string | null
          work_label?: string | null
          work_path?: string | null
        }
        Relationships: []
      }
      calendar_reminder_reads: {
        Row: {
          calendar_item_id: string
          dismissed_at: string
          occurrence_date: string
          owner_user_id: string
        }
        Insert: {
          calendar_item_id: string
          dismissed_at?: string
          occurrence_date: string
          owner_user_id?: string
        }
        Update: {
          calendar_item_id?: string
          dismissed_at?: string
          occurrence_date?: string
          owner_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_reminder_reads_calendar_item_id_fkey"
            columns: ["calendar_item_id"]
            isOneToOne: false
            referencedRelation: "calendar_items"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_requests: {
        Row: {
          amount_ugx: number
          attachment_path: string | null
          category: string
          created_at: string
          decline_reason: string | null
          declined_by: string | null
          founder_approved_at: string | null
          founder_approved_by: string | null
          id: string
          md_approved_at: string | null
          md_approved_by: string | null
          needed_on: string | null
          purpose: string
          requester: string
          resident_id: string | null
          shoot_day_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_ugx: number
          attachment_path?: string | null
          category?: string
          created_at?: string
          decline_reason?: string | null
          declined_by?: string | null
          founder_approved_at?: string | null
          founder_approved_by?: string | null
          id?: string
          md_approved_at?: string | null
          md_approved_by?: string | null
          needed_on?: string | null
          purpose: string
          requester?: string
          resident_id?: string | null
          shoot_day_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_ugx?: number
          attachment_path?: string | null
          category?: string
          created_at?: string
          decline_reason?: string | null
          declined_by?: string | null
          founder_approved_at?: string | null
          founder_approved_by?: string | null
          id?: string
          md_approved_at?: string | null
          md_approved_by?: string | null
          needed_on?: string | null
          purpose?: string
          requester?: string
          resident_id?: string | null
          shoot_day_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_requests_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_requests_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_requests_shoot_day_id_fkey"
            columns: ["shoot_day_id"]
            isOneToOne: false
            referencedRelation: "shoot_days"
            referencedColumns: ["id"]
          },
        ]
      }
      cashbook_entries: {
        Row: {
          amount_ugx: number
          attachment_path: string | null
          category: string
          counterparty_kind: string
          counterparty_name: string
          created_at: string
          created_by: string | null
          direction: string
          entry_date: string
          event_id: string | null
          id: string
          note: string | null
          project_id: string | null
          reference: string | null
          resident_id: string | null
          reverses_id: string | null
          transaction_id: string | null
          transfer_group_id: string | null
          updated_at: string
          wallet_id: string
        }
        Insert: {
          amount_ugx: number
          attachment_path?: string | null
          category?: string
          counterparty_kind?: string
          counterparty_name?: string
          created_at?: string
          created_by?: string | null
          direction: string
          entry_date?: string
          event_id?: string | null
          id?: string
          note?: string | null
          project_id?: string | null
          reference?: string | null
          resident_id?: string | null
          reverses_id?: string | null
          transaction_id?: string | null
          transfer_group_id?: string | null
          updated_at?: string
          wallet_id: string
        }
        Update: {
          amount_ugx?: number
          attachment_path?: string | null
          category?: string
          counterparty_kind?: string
          counterparty_name?: string
          created_at?: string
          created_by?: string | null
          direction?: string
          entry_date?: string
          event_id?: string | null
          id?: string
          note?: string | null
          project_id?: string | null
          reference?: string | null
          resident_id?: string | null
          reverses_id?: string | null
          transaction_id?: string | null
          transfer_group_id?: string | null
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashbook_entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashbook_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashbook_entries_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashbook_entries_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashbook_entries_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: false
            referencedRelation: "cashbook_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashbook_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashbook_entries_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          edited_at: string | null
          id: string
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          id: string
          joined_at: string
          last_read_at: string
          thread_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          last_read_at?: string
          thread_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          last_read_at?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          created_by: string
          direct_key: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          direct_key: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          direct_key?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_accounts: {
        Row: {
          active: boolean
          created_at: string
          handle: string
          id: string
          platform: string
          resident_id: string
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          handle?: string
          id?: string
          platform: string
          resident_id: string
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          handle?: string
          id?: string
          platform?: string
          resident_id?: string
          sort?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_accounts_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_accounts_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      client_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          resident_id: string
          share_amount_ugx: number | null
          share_percent: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          resident_id: string
          share_amount_ugx?: number | null
          share_percent?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          resident_id?: string
          share_amount_ugx?: number | null
          share_percent?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_assignments_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assignments_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      client_funds: {
        Row: {
          added_by: string | null
          amount_ugx: number
          attachment_path: string | null
          created_at: string
          direction: string
          id: string
          method: string | null
          note: string | null
          received_on: string
          reference: string | null
          resident_id: string
          shoot_day_id: string | null
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          amount_ugx: number
          attachment_path?: string | null
          created_at?: string
          direction?: string
          id?: string
          method?: string | null
          note?: string | null
          received_on?: string
          reference?: string | null
          resident_id: string
          shoot_day_id?: string | null
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          amount_ugx?: number
          attachment_path?: string | null
          created_at?: string
          direction?: string
          id?: string
          method?: string | null
          note?: string | null
          received_on?: string
          reference?: string | null
          resident_id?: string
          shoot_day_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_funds_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_funds_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_funds_shoot_day_id_fkey"
            columns: ["shoot_day_id"]
            isOneToOne: false
            referencedRelation: "shoot_days"
            referencedColumns: ["id"]
          },
        ]
      }
      client_goals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          due_on: string | null
          id: string
          metric: string
          notes: string | null
          owner_user_id: string | null
          resident_id: string
          review_note: string | null
          review_state: string
          sort: number
          start_value: number | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          due_on?: string | null
          id?: string
          metric?: string
          notes?: string | null
          owner_user_id?: string | null
          resident_id: string
          review_note?: string | null
          review_state?: string
          sort?: number
          start_value?: number | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          due_on?: string | null
          id?: string
          metric?: string
          notes?: string | null
          owner_user_id?: string | null
          resident_id?: string
          review_note?: string | null
          review_state?: string
          sort?: number
          start_value?: number | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_goals_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_goals_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      client_plans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          owner_user_id: string | null
          resident_id: string
          review_note: string | null
          review_state: string
          submitted_at: string | null
          submitted_by: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          owner_user_id?: string | null
          resident_id: string
          review_note?: string | null
          review_state?: string
          submitted_at?: string | null
          submitted_by?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          owner_user_id?: string | null
          resident_id?: string
          review_note?: string | null
          review_state?: string
          submitted_at?: string | null
          submitted_by?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_plans_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: true
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_plans_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: true
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      client_targets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          metric: string
          month: string
          notes: string | null
          resident_id: string | null
          review_note: string | null
          review_state: string
          submitted_at: string | null
          submitted_by: string | null
          target_value: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metric: string
          month: string
          notes?: string | null
          resident_id?: string | null
          review_note?: string | null
          review_state?: string
          submitted_at?: string | null
          submitted_by?: string | null
          target_value: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metric?: string
          month?: string
          notes?: string | null
          resident_id?: string | null
          review_note?: string | null
          review_state?: string
          submitted_at?: string | null
          submitted_by?: string | null
          target_value?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_targets_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_targets_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      client_users: {
        Row: {
          accepted_at: string | null
          client_id: string
          created_at: string
          email: string
          id: string
          invited_at: string
          invited_by: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          client_id: string
          created_at?: string
          email: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          client_id?: string
          created_at?: string
          email?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          category: string
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      communication_reads: {
        Row: {
          entity_id: string
          entity_kind: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          entity_id: string
          entity_kind: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          entity_id?: string
          entity_kind?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      compliance_items: {
        Row: {
          authority: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          owner_user_id: string | null
          reference_no: string | null
          renews_on: string | null
          status: string
          updated_at: string
        }
        Insert: {
          authority?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_user_id?: string | null
          reference_no?: string | null
          renews_on?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          authority?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_user_id?: string | null
          reference_no?: string | null
          renews_on?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_crew: {
        Row: {
          content_id: string
          created_at: string
          id: string
          note: string | null
          role: string
          sort: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          note?: string | null
          role: string
          sort?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          note?: string | null
          role?: string
          sort?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_crew_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          added_by: string | null
          added_on: string
          approved_at: string | null
          approved_by: string | null
          caption_suggestions: string | null
          client_id: string | null
          content_type: string
          created_at: string
          created_by: string | null
          crew_notes: string | null
          edit_file_url: string | null
          edit_remarks: string | null
          editor: string | null
          editor_done_at: string | null
          founder_approved_at: string | null
          id: string
          lead: string | null
          link: string | null
          metrics: Json
          metrics_due_at: string | null
          metrics_filled_at: string | null
          notes: string | null
          planned_at: string | null
          platforms: string[]
          posted_at: string | null
          posted_from: string | null
          posted_links: string[]
          posted_slots: Json
          posted_to: string | null
          project_id: string | null
          ref_no: number
          resident_id: string | null
          sent_direct: boolean
          shoot_at: string | null
          shooter: string | null
          sort: number
          stage: string
          title: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          added_on?: string
          approved_at?: string | null
          approved_by?: string | null
          caption_suggestions?: string | null
          client_id?: string | null
          content_type?: string
          created_at?: string
          created_by?: string | null
          crew_notes?: string | null
          edit_file_url?: string | null
          edit_remarks?: string | null
          editor?: string | null
          editor_done_at?: string | null
          founder_approved_at?: string | null
          id?: string
          lead?: string | null
          link?: string | null
          metrics?: Json
          metrics_due_at?: string | null
          metrics_filled_at?: string | null
          notes?: string | null
          planned_at?: string | null
          platforms?: string[]
          posted_at?: string | null
          posted_from?: string | null
          posted_links?: string[]
          posted_slots?: Json
          posted_to?: string | null
          project_id?: string | null
          ref_no?: number
          resident_id?: string | null
          sent_direct?: boolean
          shoot_at?: string | null
          shooter?: string | null
          sort?: number
          stage?: string
          title: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          added_on?: string
          approved_at?: string | null
          approved_by?: string | null
          caption_suggestions?: string | null
          client_id?: string | null
          content_type?: string
          created_at?: string
          created_by?: string | null
          crew_notes?: string | null
          edit_file_url?: string | null
          edit_remarks?: string | null
          editor?: string | null
          editor_done_at?: string | null
          founder_approved_at?: string | null
          id?: string
          lead?: string | null
          link?: string | null
          metrics?: Json
          metrics_due_at?: string | null
          metrics_filled_at?: string | null
          notes?: string | null
          planned_at?: string | null
          platforms?: string[]
          posted_at?: string | null
          posted_from?: string | null
          posted_links?: string[]
          posted_slots?: Json
          posted_to?: string | null
          project_id?: string | null
          ref_no?: number
          resident_id?: string | null
          sent_direct?: boolean
          shoot_at?: string | null
          shooter?: string | null
          sort?: number
          stage?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          client_id: string | null
          contract_type: string
          created_at: string
          created_by: string | null
          ends_on: string | null
          file_path: string | null
          id: string
          notes: string | null
          owner_user_id: string | null
          party_kind: string
          party_name: string
          resident_id: string | null
          starts_on: string | null
          status: string
          title: string
          updated_at: string
          value_ugx: number | null
        }
        Insert: {
          client_id?: string | null
          contract_type?: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          file_path?: string | null
          id?: string
          notes?: string | null
          owner_user_id?: string | null
          party_kind?: string
          party_name: string
          resident_id?: string | null
          starts_on?: string | null
          status?: string
          title: string
          updated_at?: string
          value_ugx?: number | null
        }
        Update: {
          client_id?: string | null
          contract_type?: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          file_path?: string | null
          id?: string
          notes?: string | null
          owner_user_id?: string | null
          party_kind?: string
          party_name?: string
          resident_id?: string | null
          starts_on?: string | null
          status?: string
          title?: string
          updated_at?: string
          value_ugx?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_resident_id_fkey"
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
      equipment: {
        Row: {
          active: boolean
          category: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          quantity: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          quantity?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          age_limit: number | null
          airtel_number: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          gallery: string[]
          id: string
          manual_enabled: boolean
          momo_number: string | null
          organizer_name: string | null
          organizer_socials: Json
          pesapal_enabled: boolean
          policy: string | null
          poster_url: string | null
          published: boolean
          sender_from_email: string
          sender_from_name: string
          slug: string
          starts_at: string
          ticket_template_fields: Json
          ticket_template_url: string | null
          title: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          age_limit?: number | null
          airtel_number?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          gallery?: string[]
          id?: string
          manual_enabled?: boolean
          momo_number?: string | null
          organizer_name?: string | null
          organizer_socials?: Json
          pesapal_enabled?: boolean
          policy?: string | null
          poster_url?: string | null
          published?: boolean
          sender_from_email?: string
          sender_from_name?: string
          slug: string
          starts_at: string
          ticket_template_fields?: Json
          ticket_template_url?: string | null
          title: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          age_limit?: number | null
          airtel_number?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          gallery?: string[]
          id?: string
          manual_enabled?: boolean
          momo_number?: string | null
          organizer_name?: string | null
          organizer_socials?: Json
          pesapal_enabled?: boolean
          policy?: string | null
          poster_url?: string | null
          published?: boolean
          sender_from_email?: string
          sender_from_name?: string
          slug?: string
          starts_at?: string
          ticket_template_fields?: Json
          ticket_template_url?: string | null
          title?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      finance_audit: {
        Row: {
          action: string
          actor: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          row_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          row_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          row_id?: string
          table_name?: string
        }
        Relationships: []
      }
      finance_settings: {
        Row: {
          dual_pin_threshold_ugx: number
          id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          dual_pin_threshold_ugx?: number
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          dual_pin_threshold_ugx?: number
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      inbox_messages: {
        Row: {
          audience: string
          author: string | null
          body: string | null
          content_id: string | null
          created_at: string
          id: string
          kind: string
          link_path: string | null
          parent_id: string | null
          resident_id: string | null
          shoot_day_id: string | null
          subject: string
          target_role: Database["public"]["Enums"]["app_role"] | null
          target_user: string | null
          updated_at: string
        }
        Insert: {
          audience?: string
          author?: string | null
          body?: string | null
          content_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          link_path?: string | null
          parent_id?: string | null
          resident_id?: string | null
          shoot_day_id?: string | null
          subject: string
          target_role?: Database["public"]["Enums"]["app_role"] | null
          target_user?: string | null
          updated_at?: string
        }
        Update: {
          audience?: string
          author?: string | null
          body?: string | null
          content_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          link_path?: string | null
          parent_id?: string | null
          resident_id?: string | null
          shoot_day_id?: string | null
          subject?: string
          target_role?: Database["public"]["Enums"]["app_role"] | null
          target_user?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_messages_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "inbox_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_messages_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_messages_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_messages_shoot_day_id_fkey"
            columns: ["shoot_day_id"]
            isOneToOne: false
            referencedRelation: "shoot_days"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_reads: {
        Row: {
          created_at: string
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "inbox_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_counters: {
        Row: {
          n: number
          period: string
        }
        Insert: {
          n?: number
          period: string
        }
        Update: {
          n?: number
          period?: string
        }
        Relationships: []
      }
      invoice_lines: {
        Row: {
          amount_ugx: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          qty: number
          sort: number
          unit_price_ugx: number
          updated_at: string
        }
        Insert: {
          amount_ugx?: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          qty?: number
          sort?: number
          unit_price_ugx?: number
          updated_at?: string
        }
        Update: {
          amount_ugx?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          qty?: number
          sort?: number
          unit_price_ugx?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid_ugx: number
          approved_at: string | null
          approved_by: string | null
          category: string
          client_id: string | null
          contract_id: string | null
          created_at: string
          created_by: string | null
          direction: string
          due_date: string | null
          file_path: string | null
          id: string
          issue_date: string
          next_run_on: string | null
          note: string | null
          number: string | null
          party_kind: string
          party_name: string
          period_label: string | null
          recur_day: number | null
          recur_parent_id: string | null
          recurring: boolean
          resident_id: string | null
          sent_at: string | null
          status: string
          subtotal_ugx: number
          total_ugx: number
          updated_at: string
          vat_rate: number
          vat_ugx: number
        }
        Insert: {
          amount_paid_ugx?: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          direction: string
          due_date?: string | null
          file_path?: string | null
          id?: string
          issue_date?: string
          next_run_on?: string | null
          note?: string | null
          number?: string | null
          party_kind?: string
          party_name: string
          period_label?: string | null
          recur_day?: number | null
          recur_parent_id?: string | null
          recurring?: boolean
          resident_id?: string | null
          sent_at?: string | null
          status?: string
          subtotal_ugx?: number
          total_ugx?: number
          updated_at?: string
          vat_rate?: number
          vat_ugx?: number
        }
        Update: {
          amount_paid_ugx?: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          due_date?: string | null
          file_path?: string | null
          id?: string
          issue_date?: string
          next_run_on?: string | null
          note?: string | null
          number?: string | null
          party_kind?: string
          party_name?: string
          period_label?: string | null
          recur_day?: number | null
          recur_parent_id?: string | null
          recurring?: boolean
          resident_id?: string | null
          sent_at?: string | null
          status?: string
          subtotal_ugx?: number
          total_ugx?: number
          updated_at?: string
          vat_rate?: number
          vat_ugx?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_recur_parent_id_fkey"
            columns: ["recur_parent_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          file_path: string | null
          id: string
          notes: string | null
          title: string
          updated_at: string
          version: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          file_path?: string | null
          id?: string
          notes?: string | null
          title: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          file_path?: string | null
          id?: string
          notes?: string | null
          title?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: []
      }
      loan_repayments: {
        Row: {
          amount_ugx: number
          created_at: string
          created_by: string | null
          due_on: string | null
          id: string
          loan_id: string
          note: string | null
          paid_on: string | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount_ugx: number
          created_at?: string
          created_by?: string | null
          due_on?: string | null
          id?: string
          loan_id: string
          note?: string | null
          paid_on?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_ugx?: number
          created_at?: string
          created_by?: string | null
          due_on?: string | null
          id?: string
          loan_id?: string
          note?: string | null
          paid_on?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_repayments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          agreed_total_ugx: number | null
          counterparty_kind: string
          counterparty_name: string
          counterparty_user_id: string | null
          created_at: string
          created_by: string | null
          direction: string
          founder_approved_at: string | null
          founder_approved_by: string | null
          id: string
          md_approved_at: string | null
          md_approved_by: string | null
          principal_ugx: number
          purpose: string | null
          schedule_note: string | null
          start_on: string
          status: string
          updated_at: string
        }
        Insert: {
          agreed_total_ugx?: number | null
          counterparty_kind?: string
          counterparty_name: string
          counterparty_user_id?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          founder_approved_at?: string | null
          founder_approved_by?: string | null
          id?: string
          md_approved_at?: string | null
          md_approved_by?: string | null
          principal_ugx: number
          purpose?: string | null
          schedule_note?: string | null
          start_on?: string
          status?: string
          updated_at?: string
        }
        Update: {
          agreed_total_ugx?: number | null
          counterparty_kind?: string
          counterparty_name?: string
          counterparty_user_id?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          founder_approved_at?: string | null
          founder_approved_by?: string | null
          id?: string
          md_approved_at?: string | null
          md_approved_by?: string | null
          principal_ugx?: number
          purpose?: string | null
          schedule_note?: string | null
          start_on?: string
          status?: string
          updated_at?: string
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
          buyer_age: number | null
          buyer_email: string
          buyer_name: string
          buyer_phone: string
          created_at: string
          deleted_at: string | null
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
          tickets_emailed_at: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount_ugx: number
          buyer_age?: number | null
          buyer_email: string
          buyer_name: string
          buyer_phone: string
          created_at?: string
          deleted_at?: string | null
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
          tickets_emailed_at?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount_ugx?: number
          buyer_age?: number | null
          buyer_email?: string
          buyer_name?: string
          buyer_phone?: string
          created_at?: string
          deleted_at?: string | null
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
          tickets_emailed_at?: string | null
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
      partnerships: {
        Row: {
          created_at: string
          created_by: string | null
          ends_on: string | null
          file_path: string | null
          id: string
          name: string
          notes: string | null
          owner_user_id: string | null
          partner_contact: string | null
          split_kind: string
          split_value: number | null
          starts_on: string | null
          status: string
          terms: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          file_path?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_user_id?: string | null
          partner_contact?: string | null
          split_kind?: string
          split_value?: number | null
          starts_on?: string | null
          status?: string
          terms?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          file_path?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_user_id?: string | null
          partner_contact?: string | null
          split_kind?: string
          split_value?: number | null
          starts_on?: string | null
          status?: string
          terms?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_pins: {
        Row: {
          created_at: string
          failed_count: number
          locked_until: string | null
          pin_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          failed_count?: number
          locked_until?: string | null
          pin_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          failed_count?: number
          locked_until?: string | null
          pin_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_run_lines: {
        Row: {
          amount_ugx: number
          category: string
          created_at: string
          id: string
          note: string | null
          payee_kind: string
          payee_name: string
          payee_user_id: string | null
          recurring_id: string | null
          run_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_ugx: number
          category?: string
          created_at?: string
          id?: string
          note?: string | null
          payee_kind?: string
          payee_name: string
          payee_user_id?: string | null
          recurring_id?: string | null
          run_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_ugx?: number
          category?: string
          created_at?: string
          id?: string
          note?: string | null
          payee_kind?: string
          payee_name?: string
          payee_user_id?: string | null
          recurring_id?: string | null
          run_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_run_lines_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_run_lines_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "payment_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          built_at: string
          created_at: string
          id: string
          month: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          built_at?: string
          created_at?: string
          id?: string
          month: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          built_at?: string
          created_at?: string
          id?: string
          month?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: []
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
      recurring_payments: {
        Row: {
          active: boolean
          amount_ugx: number
          category: string
          created_at: string
          created_by: string | null
          day_of_month: number
          id: string
          notes: string | null
          payee_kind: string
          payee_name: string
          payee_user_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_ugx: number
          category?: string
          created_at?: string
          created_by?: string | null
          day_of_month?: number
          id?: string
          notes?: string | null
          payee_kind?: string
          payee_name: string
          payee_user_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_ugx?: number
          category?: string
          created_at?: string
          created_by?: string | null
          day_of_month?: number
          id?: string
          notes?: string | null
          payee_kind?: string
          payee_name?: string
          payee_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      resident_contracts: {
        Row: {
          created_at: string
          created_by: string | null
          ends_on: string | null
          file_path: string | null
          id: string
          notes: string | null
          resident_id: string
          starts_on: string | null
          status: string
          title: string
          updated_at: string
          value_ugx: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          file_path?: string | null
          id?: string
          notes?: string | null
          resident_id: string
          starts_on?: string | null
          status?: string
          title: string
          updated_at?: string
          value_ugx?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          file_path?: string | null
          id?: string
          notes?: string | null
          resident_id?: string
          starts_on?: string | null
          status?: string
          title?: string
          updated_at?: string
          value_ugx?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "resident_contracts_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_contracts_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
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
          contact_user_id: string | null
          created_at: string
          display_order: number
          email: string | null
          handler_user_id: string | null
          id: string
          invited_at: string
          name: string
          notes: string | null
          retainer_ugx: number
          since: string
          status: string
          territory: string
          updated_at: string
          user_id: string | null
          visible: boolean
        }
        Insert: {
          avatar_url?: string | null
          contact_user_id?: string | null
          created_at?: string
          display_order?: number
          email?: string | null
          handler_user_id?: string | null
          id?: string
          invited_at?: string
          name: string
          notes?: string | null
          retainer_ugx?: number
          since: string
          status?: string
          territory: string
          updated_at?: string
          user_id?: string | null
          visible?: boolean
        }
        Update: {
          avatar_url?: string | null
          contact_user_id?: string | null
          created_at?: string
          display_order?: number
          email?: string | null
          handler_user_id?: string | null
          id?: string
          invited_at?: string
          name?: string
          notes?: string | null
          retainer_ugx?: number
          since?: string
          status?: string
          territory?: string
          updated_at?: string
          user_id?: string | null
          visible?: boolean
        }
        Relationships: []
      }
      schedule_overrides: {
        Row: {
          approved_by: string
          blocked_resident_id: string | null
          blocked_user_id: string | null
          created_at: string
          id: string
          on_date: string
          reason: string
          shoot_day_id: string | null
        }
        Insert: {
          approved_by: string
          blocked_resident_id?: string | null
          blocked_user_id?: string | null
          created_at?: string
          id?: string
          on_date: string
          reason: string
          shoot_day_id?: string | null
        }
        Update: {
          approved_by?: string
          blocked_resident_id?: string | null
          blocked_user_id?: string | null
          created_at?: string
          id?: string
          on_date?: string
          reason?: string
          shoot_day_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_overrides_blocked_resident_id_fkey"
            columns: ["blocked_resident_id"]
            isOneToOne: false
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_overrides_blocked_resident_id_fkey"
            columns: ["blocked_resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_overrides_shoot_day_id_fkey"
            columns: ["shoot_day_id"]
            isOneToOne: false
            referencedRelation: "shoot_days"
            referencedColumns: ["id"]
          },
        ]
      }
      shoot_day_equipment: {
        Row: {
          created_at: string
          equipment_id: string
          id: string
          note: string | null
          qty: number
          shoot_day_id: string
        }
        Insert: {
          created_at?: string
          equipment_id: string
          id?: string
          note?: string | null
          qty?: number
          shoot_day_id: string
        }
        Update: {
          created_at?: string
          equipment_id?: string
          id?: string
          note?: string | null
          qty?: number
          shoot_day_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shoot_day_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shoot_day_equipment_shoot_day_id_fkey"
            columns: ["shoot_day_id"]
            isOneToOne: false
            referencedRelation: "shoot_days"
            referencedColumns: ["id"]
          },
        ]
      }
      shoot_day_items: {
        Row: {
          content_id: string
          created_at: string
          footage_where: string | null
          id: string
          outcome: string
          outcome_at: string | null
          outcome_by: string | null
          outcome_note: string | null
          shoot_day_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          footage_where?: string | null
          id?: string
          outcome?: string
          outcome_at?: string | null
          outcome_by?: string | null
          outcome_note?: string | null
          shoot_day_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          footage_where?: string | null
          id?: string
          outcome?: string
          outcome_at?: string | null
          outcome_by?: string | null
          outcome_note?: string | null
          shoot_day_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shoot_day_items_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: true
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shoot_day_items_shoot_day_id_fkey"
            columns: ["shoot_day_id"]
            isOneToOne: false
            referencedRelation: "shoot_days"
            referencedColumns: ["id"]
          },
        ]
      }
      shoot_days: {
        Row: {
          brief_sent_at: string | null
          brief_sent_by: string | null
          budget_note: string | null
          budget_ugx: number
          call_time: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          notes: string | null
          project_id: string | null
          resident_id: string | null
          shoot_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          brief_sent_at?: string | null
          brief_sent_by?: string | null
          budget_note?: string | null
          budget_ugx?: number
          call_time?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          project_id?: string | null
          resident_id?: string | null
          shoot_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          brief_sent_at?: string | null
          brief_sent_by?: string | null
          budget_note?: string | null
          budget_ugx?: number
          call_time?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          project_id?: string | null
          resident_id?: string | null
          shoot_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shoot_days_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shoot_days_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shoot_days_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      shoot_spend: {
        Row: {
          amount_ugx: number
          attachment_path: string | null
          cashbook_entry_id: string | null
          category: string
          created_at: string
          id: string
          note: string | null
          payer: string
          resident_id: string | null
          shoot_day_id: string
          spent_by: string | null
          spent_on: string
          updated_at: string
        }
        Insert: {
          amount_ugx: number
          attachment_path?: string | null
          cashbook_entry_id?: string | null
          category?: string
          created_at?: string
          id?: string
          note?: string | null
          payer?: string
          resident_id?: string | null
          shoot_day_id: string
          spent_by?: string | null
          spent_on?: string
          updated_at?: string
        }
        Update: {
          amount_ugx?: number
          attachment_path?: string | null
          cashbook_entry_id?: string | null
          category?: string
          created_at?: string
          id?: string
          note?: string | null
          payer?: string
          resident_id?: string | null
          shoot_day_id?: string
          spent_by?: string | null
          spent_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shoot_spend_cashbook_entry_id_fkey"
            columns: ["cashbook_entry_id"]
            isOneToOne: false
            referencedRelation: "cashbook_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shoot_spend_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shoot_spend_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shoot_spend_shoot_day_id_fkey"
            columns: ["shoot_day_id"]
            isOneToOne: false
            referencedRelation: "shoot_days"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_map_versions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          edges: Json
          id: string
          map_id: string | null
          nodes: Json
          notes: string | null
          resident_id: string
          review_note: string | null
          review_state: string
          submitted_at: string | null
          submitted_by: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          edges?: Json
          id?: string
          map_id?: string | null
          nodes?: Json
          notes?: string | null
          resident_id: string
          review_note?: string | null
          review_state?: string
          submitted_at?: string | null
          submitted_by?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          edges?: Json
          id?: string
          map_id?: string | null
          nodes?: Json
          notes?: string | null
          resident_id?: string
          review_note?: string | null
          review_state?: string
          submitted_at?: string | null
          submitted_by?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "strategy_map_versions_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "strategy_maps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_map_versions_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_map_versions_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_maps: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          edges: Json
          id: string
          nodes: Json
          notes: string | null
          resident_id: string
          review_note: string | null
          review_state: string
          submitted_at: string | null
          submitted_by: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          edges?: Json
          id?: string
          nodes?: Json
          notes?: string | null
          resident_id: string
          review_note?: string | null
          review_state?: string
          submitted_at?: string | null
          submitted_by?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          edges?: Json
          id?: string
          nodes?: Json
          notes?: string | null
          resident_id?: string
          review_note?: string | null
          review_state?: string
          submitted_at?: string | null
          submitted_by?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "strategy_maps_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "public_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_maps_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
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
      team_members: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string | null
          email: string
          id: string
          theme: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          email: string
          id?: string
          theme?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          email?: string
          id?: string
          theme?: string
          title?: string | null
          updated_at?: string
          user_id?: string
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
          emailed_at: string | null
          holder_name: string | null
          id: string
          order_id: string
          pdf_url: string | null
          qr_token: string
          status: string
          tier_id: string
          updated_at: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          emailed_at?: string | null
          holder_name?: string | null
          id?: string
          order_id: string
          pdf_url?: string | null
          qr_token?: string
          status?: string
          tier_id: string
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          emailed_at?: string | null
          holder_name?: string | null
          id?: string
          order_id?: string
          pdf_url?: string | null
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
      transactions: {
        Row: {
          amount_ugx: number
          category: string
          created_at: string
          direction: string
          id: string
          invoice_id: string | null
          invoice_no: string | null
          invoice_path: string | null
          method: string | null
          method_reference: string | null
          note: string | null
          paid_at: string
          paid_by: string | null
          payee_kind: string
          payee_name: string
          payee_user_id: string | null
          released_by_2: string | null
          reverses_txn_id: string | null
          source_id: string | null
          source_kind: string
          txn_ref: string
          wallet_id: string | null
        }
        Insert: {
          amount_ugx: number
          category?: string
          created_at?: string
          direction?: string
          id?: string
          invoice_id?: string | null
          invoice_no?: string | null
          invoice_path?: string | null
          method?: string | null
          method_reference?: string | null
          note?: string | null
          paid_at?: string
          paid_by?: string | null
          payee_kind?: string
          payee_name: string
          payee_user_id?: string | null
          released_by_2?: string | null
          reverses_txn_id?: string | null
          source_id?: string | null
          source_kind: string
          txn_ref: string
          wallet_id?: string | null
        }
        Update: {
          amount_ugx?: number
          category?: string
          created_at?: string
          direction?: string
          id?: string
          invoice_id?: string | null
          invoice_no?: string | null
          invoice_path?: string | null
          method?: string | null
          method_reference?: string | null
          note?: string | null
          paid_at?: string
          paid_by?: string | null
          payee_kind?: string
          payee_name?: string
          payee_user_id?: string | null
          released_by_2?: string | null
          reverses_txn_id?: string | null
          source_id?: string | null
          source_kind?: string
          txn_ref?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reverses_txn_id_fkey"
            columns: ["reverses_txn_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      txn_counters: {
        Row: {
          n: number
          period: string
        }
        Insert: {
          n?: number
          period: string
        }
        Update: {
          n?: number
          period?: string
        }
        Relationships: []
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
      wallets: {
        Row: {
          active: boolean
          created_at: string
          id: string
          kind: string
          name: string
          sort: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          name: string
          sort?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          name?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      weekly_reports: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          metrics: Json
          published: boolean
          updated_at: string
          week_start: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metrics?: Json
          published?: boolean
          updated_at?: string
          week_start: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metrics?: Json
          published?: boolean
          updated_at?: string
          week_start?: string
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
      accept_client_invite: { Args: never; Returns: boolean }
      accept_resident_invite: { Args: never; Returns: boolean }
      admin_search_orders:
        | {
            Args: { _event_id?: string; _limit?: number; _q: string }
            Returns: {
              amount_ugx: number
              buyer_email: string
              buyer_name: string
              buyer_phone: string
              created_at: string
              event_id: string
              event_title: string
              order_id: string
              payment_method: string
              similarity: number
              status: string
              ticket_count: number
            }[]
          }
        | {
            Args: {
              _event_id?: string
              _include_trashed?: boolean
              _limit?: number
              _q: string
            }
            Returns: {
              amount_ugx: number
              buyer_email: string
              buyer_name: string
              buyer_phone: string
              created_at: string
              deleted_at: string
              event_id: string
              event_title: string
              order_id: string
              payment_method: string
              similarity: number
              status: string
              ticket_count: number
            }[]
          }
      approve_cash_request: { Args: { _id: string }; Returns: string }
      approve_payment_run: {
        Args: { _line_ids?: string[]; _run_id: string }
        Returns: undefined
      }
      availability_conflicts: {
        Args: {
          _from_time?: string
          _on_date: string
          _resident_id: string
          _to_time?: string
          _user_ids: string[]
        }
        Returns: {
          all_day: boolean
          block_id: string
          end_time: string
          owner_kind: string
          owner_user_id: string
          resident_id: string
          start_time: string
          strictness: string
          title: string
        }[]
      }
      block_occurs_on: {
        Args: {
          b: Database["public"]["Tables"]["availability_blocks"]["Row"]
          d: string
        }
        Returns: boolean
      }
      build_payment_run: { Args: { _month?: string }; Returns: string }
      calendar_slot_occurs_on: {
        Args: {
          b: Database["public"]["Tables"]["calendar_busy_slots"]["Row"]
          d: string
        }
        Returns: boolean
      }
      can_approve_strategy: { Args: { _uid: string }; Returns: boolean }
      can_edit_content: { Args: { _user_id: string }; Returns: boolean }
      can_fund_client: {
        Args: { _resident_id: string; _user_id: string }
        Returns: boolean
      }
      can_see_finance: { Args: { _user_id: string }; Returns: boolean }
      can_touch_account: { Args: { _account_id: string }; Returns: boolean }
      can_touch_resident_accounts: {
        Args: { _resident_id: string }
        Returns: boolean
      }
      can_view_content: { Args: { _user_id: string }; Returns: boolean }
      chat_people: {
        Args: never
        Returns: {
          display_name: string
          person_kind: string
          subtitle: string
          user_id: string
        }[]
      }
      check_payment_pin: {
        Args: { _pin: string; _user_id: string }
        Returns: boolean
      }
      client_pay_overview: {
        Args: never
        Returns: {
          computed_ugx: number
          kind: string
          resident_id: string
          resident_name: string
          retainer_ugx: number
          share_amount_ugx: number
          share_percent: number
          user_id: string
        }[]
      }
      client_pot_balance: { Args: { _resident_id: string }; Returns: number }
      confirm_shoot_day: { Args: { _day_id: string }; Returns: undefined }
      decline_cash_request: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      finance_lookup: {
        Args: { _limit?: number; _q: string }
        Returns: {
          amount_ugx: number
          category: string
          direction: string
          id: string
          invoice_no: string
          method: string
          method_reference: string
          paid_at: string
          payee_kind: string
          payee_name: string
          reverses_txn_id: string
          source_id: string
          source_kind: string
          txn_ref: string
        }[]
      }
      finance_month_summary: {
        Args: { _month: string }
        Returns: {
          category: string
          money_in: number
          money_out: number
        }[]
      }
      finish_shoot_day: { Args: { _day_id: string }; Returns: undefined }
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
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hold_payment_line: { Args: { _line_id: string }; Returns: undefined }
      is_chat_participant: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      is_content_crew: {
        Args: { _content_id: string; _user_id: string }
        Returns: boolean
      }
      is_founder: { Args: { _user_id: string }; Returns: boolean }
      is_leadership: { Args: { _user_id: string }; Returns: boolean }
      is_md: { Args: { _user_id: string }; Returns: boolean }
      is_resident_contact: {
        Args: { _resident_id: string; _user_id: string }
        Returns: boolean
      }
      is_resident_handler: {
        Args: { _resident_id: string; _user_id: string }
        Returns: boolean
      }
      is_shoot_crew: {
        Args: { _day_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_strategy_team: { Args: { _uid: string }; Returns: boolean }
      log_cashbook_entry: {
        Args: {
          _amount: number
          _attachment_path?: string
          _category: string
          _counterparty_kind?: string
          _counterparty_name: string
          _direction: string
          _entry_date: string
          _event_id?: string
          _note?: string
          _project_id?: string
          _reference?: string
          _resident_id?: string
          _wallet_id: string
        }
        Returns: string
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
      my_client_id: { Args: never; Returns: string }
      my_pending_account_weeks: {
        Args: never
        Returns: {
          account_id: string
          handle: string
          platform: string
          resident_id: string
          resident_name: string
          week_start: string
        }[]
      }
      my_retainer_shares: {
        Args: never
        Returns: {
          computed_ugx: number
          kind: string
          resident_id: string
          resident_name: string
        }[]
      }
      next_invoice_number: { Args: never; Returns: string }
      open_direct_chat: { Args: { _target_user: string }; Returns: string }
      ops_overview: { Args: never; Returns: Json }
      raise_recurring_invoices: { Args: never; Returns: number }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_loan_repayment: {
        Args: {
          _amount: number
          _loan_id: string
          _method?: string
          _method_reference?: string
          _note?: string
          _paid_on?: string
        }
        Returns: string
      }
      record_payment: {
        Args: {
          _invoice_no?: string
          _invoice_path?: string
          _method: string
          _method_reference?: string
          _note?: string
          _paid_on?: string
          _pin?: string
          _second_pin?: string
          _second_user?: string
          _source_id: string
          _source_kind: string
          _wallet_id?: string
        }
        Returns: string
      }
      resident_options: {
        Args: never
        Returns: {
          contact_user_id: string
          handler_user_id: string
          id: string
          name: string
          territory: string
        }[]
      }
      resident_records: {
        Args: never
        Returns: {
          avatar_url: string
          contact_user_id: string
          created_at: string
          email: string
          handler_user_id: string
          id: string
          invited_at: string
          name: string
          notes: string
          since: string
          status: string
          territory: string
          user_id: string
          visible: boolean
        }[]
      }
      reverse_cashbook_entry: {
        Args: { _id: string; _reason: string }
        Returns: string
      }
      reverse_transaction: {
        Args: { _reason: string; _txn_id: string }
        Returns: string
      }
      set_client_pay: {
        Args: { _people: Json; _resident_id: string; _retainer_ugx: number }
        Returns: undefined
      }
      set_payment_pin: {
        Args: { _current_pin?: string; _pin: string }
        Returns: undefined
      }
      set_resident_logo: {
        Args: { _path: string; _resident_id: string }
        Returns: undefined
      }
      set_resident_notes: {
        Args: { _notes: string; _resident_id: string }
        Returns: undefined
      }
      settle_invoice: {
        Args: {
          _amount: number
          _invoice_id: string
          _note?: string
          _paid_on?: string
          _reference: string
          _wallet_id: string
        }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_shoot_day: { Args: { _day_id: string }; Returns: undefined }
      tier_available_counts: {
        Args: { _event_id: string }
        Returns: {
          available: number
          tier_id: string
        }[]
      }
      tier_sold_count: { Args: { _tier_id: string }; Returns: number }
      transfer_between_wallets: {
        Args: {
          _amount: number
          _entry_date: string
          _from: string
          _note?: string
          _to: string
        }
        Returns: string
      }
      wallet_balances: {
        Args: never
        Returns: {
          active: boolean
          balance: number
          kind: string
          money_in: number
          money_out: number
          sort: number
          wallet_id: string
          wallet_name: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "resident"
        | "event_manager"
        | "scanner"
        | "viewer"
        | "site_editor"
        | "founder"
        | "creative_director"
        | "managing_director"
        | "sales_head"
        | "finance_ops"
        | "creative"
        | "legal"
        | "client"
        | "strategist"
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
      app_role: [
        "admin",
        "user",
        "resident",
        "event_manager",
        "scanner",
        "viewer",
        "site_editor",
        "founder",
        "creative_director",
        "managing_director",
        "sales_head",
        "finance_ops",
        "creative",
        "legal",
        "client",
        "strategist",
      ],
    },
  },
} as const
