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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_entitlements: {
        Row: {
          access_until: string
          created_at: string | null
          id: string | null
          plan_id: string | null
          source: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_until?: string
          created_at?: string | null
          id?: string | null
          plan_id?: string | null
          source?: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_until?: string
          created_at?: string | null
          id?: string | null
          plan_id?: string | null
          source?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      account_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          plan_id: string
          provider: string
          provider_subscription_id: string | null
          scheduled_change_date: string | null
          scheduled_plan: string | null
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_id?: string
          provider?: string
          provider_subscription_id?: string | null
          scheduled_change_date?: string | null
          scheduled_plan?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_id?: string
          provider?: string
          provider_subscription_id?: string | null
          scheduled_change_date?: string | null
          scheduled_plan?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action_type: string
          actor_user_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
        }
        Insert: {
          action_type: string
          actor_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
        }
        Update: {
          action_type?: string
          actor_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
        }
        Relationships: []
      }
      agenda_items: {
        Row: {
          day_number: number | null
          description: string | null
          end_time: string | null
          event_id: string
          id: string
          order_index: number
          room_id: string | null
          speaker_id: string | null
          start_time: string | null
          title: string
        }
        Insert: {
          day_number?: number | null
          description?: string | null
          end_time?: string | null
          event_id: string
          id?: string
          order_index?: number
          room_id?: string | null
          speaker_id?: string | null
          start_time?: string | null
          title: string
        }
        Update: {
          day_number?: number | null
          description?: string | null
          end_time?: string | null
          event_id?: string
          id?: string
          order_index?: number
          room_id?: string | null
          speaker_id?: string | null
          start_time?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "event_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "speakers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_action_logs: {
        Row: {
          action_name: string
          category: string | null
          created_at: string | null
          id: string
          message: string | null
          metadata: Json | null
          session_id: string
          status: string
          user_id: string
        }
        Insert: {
          action_name: string
          category?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          session_id: string
          status?: string
          user_id: string
        }
        Update: {
          action_name?: string
          category?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          session_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_action_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          session_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_sessions: {
        Row: {
          client_id: string | null
          created_at: string
          event_id: string | null
          id: string
          state_json: Json
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          state_json?: Json
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          state_json?: Json
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          end_date: string | null
          event_id: string
          id: string
          order_index: number
          start_date: string | null
          text: string
        }
        Insert: {
          end_date?: string | null
          event_id: string
          id?: string
          order_index?: number
          start_date?: string | null
          text: string
        }
        Update: {
          end_date?: string | null
          event_id?: string
          id?: string
          order_index?: number
          start_date?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage_tracking: {
        Row: {
          burst_count: number
          burst_window_start: string | null
          created_at: string
          id: string
          last_request_at: string | null
          period_start: string
          resource_type: string
          updated_at: string
          usage_count: number
          user_id: string
        }
        Insert: {
          burst_count?: number
          burst_window_start?: string | null
          created_at?: string
          id?: string
          last_request_at?: string | null
          period_start?: string
          resource_type: string
          updated_at?: string
          usage_count?: number
          user_id: string
        }
        Update: {
          burst_count?: number
          burst_window_start?: string | null
          created_at?: string
          id?: string
          last_request_at?: string | null
          period_start?: string
          resource_type?: string
          updated_at?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: []
      }
      attendee_groups: {
        Row: {
          attendee_id: string
          group_id: string
        }
        Insert: {
          attendee_id: string
          group_id: string
        }
        Update: {
          attendee_id?: string
          group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendee_groups_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendee_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      attendee_transport_assignments: {
        Row: {
          assigned_at: string
          attendee_id: string
          event_id: string
          pickup_point_id: string | null
          route_id: string | null
          seat_number: string | null
          special_needs: string | null
        }
        Insert: {
          assigned_at?: string
          attendee_id: string
          event_id: string
          pickup_point_id?: string | null
          route_id?: string | null
          seat_number?: string | null
          special_needs?: string | null
        }
        Update: {
          assigned_at?: string
          attendee_id?: string
          event_id?: string
          pickup_point_id?: string | null
          route_id?: string | null
          seat_number?: string | null
          special_needs?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendee_transport_assignments_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: true
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendee_transport_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendee_transport_assignments_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "transport_pickup_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendee_transport_assignments_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "v_pickup_point_counts"
            referencedColumns: ["pickup_point_id"]
          },
          {
            foreignKeyName: "attendee_transport_assignments_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      attendees: {
        Row: {
          checked_in_at: string | null
          checked_in_via: string | null
          confirmed: boolean
          confirmed_at: string | null
          email: string
          event_id: string
          id: string
          invitation_channel: string | null
          invitation_sent: boolean
          invitation_sent_at: string | null
          last_reminder_sent_at: string | null
          mobile: string | null
          name: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_via?: string | null
          confirmed?: boolean
          confirmed_at?: string | null
          email: string
          event_id: string
          id?: string
          invitation_channel?: string | null
          invitation_sent?: boolean
          invitation_sent_at?: string | null
          last_reminder_sent_at?: string | null
          mobile?: string | null
          name: string
        }
        Update: {
          checked_in_at?: string | null
          checked_in_via?: string | null
          confirmed?: boolean
          confirmed_at?: string | null
          email?: string
          event_id?: string
          id?: string
          invitation_channel?: string | null
          invitation_sent?: boolean
          invitation_sent_at?: string | null
          last_reminder_sent_at?: string | null
          mobile?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_kits: {
        Row: {
          accent_color: string | null
          client_id: string | null
          created_at: string | null
          created_by: string
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          secondary_color: string | null
          style_tags: Json | null
          typography_preference: string | null
          updated_at: string | null
          visual_mood: string[] | null
          workspace_id: string | null
        }
        Insert: {
          accent_color?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          secondary_color?: string | null
          style_tags?: Json | null
          typography_preference?: string | null
          updated_at?: string | null
          visual_mood?: string[] | null
          workspace_id?: string | null
        }
        Update: {
          accent_color?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          secondary_color?: string | null
          style_tags?: Json | null
          typography_preference?: string | null
          updated_at?: string | null
          visual_mood?: string[] | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_kits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          created_by: string
          id: string
          logo_url: string | null
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      communications_log: {
        Row: {
          attendee_id: string | null
          channel: string
          created_at: string
          event_id: string | null
          id: string
          message: string
          recipient_info: string | null
          status: string
          subject: string | null
        }
        Insert: {
          attendee_id?: string | null
          channel: string
          created_at?: string
          event_id?: string | null
          id?: string
          message: string
          recipient_info?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          attendee_id?: string | null
          channel?: string
          created_at?: string
          event_id?: string | null
          id?: string
          message?: string
          recipient_info?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communications_log_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      concierge_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concierge_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "concierge_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      concierge_sessions: {
        Row: {
          attendee_id: string | null
          channel: string
          created_at: string
          event_id: string
          id: string
          identifier: string | null
          updated_at: string
        }
        Insert: {
          attendee_id?: string | null
          channel?: string
          created_at?: string
          event_id: string
          id?: string
          identifier?: string | null
          updated_at?: string
        }
        Update: {
          attendee_id?: string | null
          channel?: string
          created_at?: string
          event_id?: string
          id?: string
          identifier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "concierge_sessions_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concierge_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      dress_codes: {
        Row: {
          created_at: string
          custom_instructions: string | null
          day_number: number
          dress_type: string
          event_id: string
          id: string
          reference_images: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_instructions?: string | null
          day_number?: number
          dress_type?: string
          event_id: string
          id?: string
          reference_images?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_instructions?: string | null
          day_number?: number
          dress_type?: string
          event_id?: string
          id?: string
          reference_images?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dress_codes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          created_at: string
          email: string
          error: string | null
          first_name: string | null
          id: string
          send_at: string
          sent_at: string | null
          status: string
          template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          error?: string | null
          first_name?: string | null
          id?: string
          send_at?: string
          sent_at?: string | null
          status?: string
          template_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          error?: string | null
          first_name?: string | null
          id?: string
          send_at?: string
          sent_at?: string | null
          status?: string
          template_id?: string
          user_id?: string
        }
        Relationships: []
      }
      event_announcements: {
        Row: {
          created_at: string
          created_by: string | null
          end_at: string | null
          event_id: string
          id: string
          is_pinned: boolean
          link_label: string | null
          link_url: string | null
          message: string
          priority: number
          start_at: string | null
          target: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_at?: string | null
          event_id: string
          id?: string
          is_pinned?: boolean
          link_label?: string | null
          link_url?: string | null
          message: string
          priority?: number
          start_at?: string | null
          target?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_at?: string | null
          event_id?: string
          id?: string
          is_pinned?: boolean
          link_label?: string | null
          link_url?: string | null
          message?: string
          priority?: number
          start_at?: string | null
          target?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_announcements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_invites: {
        Row: {
          attendee_id: string
          created_at: string
          email_sent_at: string | null
          event_id: string
          id: string
          last_sent_at: string | null
          opened_at: string | null
          rsvp_at: string | null
          sent_via_email: boolean
          sent_via_whatsapp: boolean
          status: string
          token: string
          whatsapp_sent_at: string | null
        }
        Insert: {
          attendee_id: string
          created_at?: string
          email_sent_at?: string | null
          event_id: string
          id?: string
          last_sent_at?: string | null
          opened_at?: string | null
          rsvp_at?: string | null
          sent_via_email?: boolean
          sent_via_whatsapp?: boolean
          status?: string
          token?: string
          whatsapp_sent_at?: string | null
        }
        Update: {
          attendee_id?: string
          created_at?: string
          email_sent_at?: string | null
          event_id?: string
          id?: string
          last_sent_at?: string | null
          opened_at?: string | null
          rsvp_at?: string | null
          sent_via_email?: boolean
          sent_via_whatsapp?: boolean
          status?: string
          token?: string
          whatsapp_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_invites_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rooms: {
        Row: {
          capacity: number | null
          created_at: string
          days: Json
          event_id: string
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          days?: Json
          event_id: string
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string
          days?: Json
          event_id?: string
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_rooms_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_templates: {
        Row: {
          category: string
          client_id: string | null
          comm_templates: Json
          created_at: string
          description: string | null
          event_type: string | null
          expected_attendees: number | null
          id: string
          included_sections: Json
          is_featured: boolean
          name: string
          preview_image: string | null
          tags: string[]
          template_data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          client_id?: string | null
          comm_templates?: Json
          created_at?: string
          description?: string | null
          event_type?: string | null
          expected_attendees?: number | null
          id?: string
          included_sections?: Json
          is_featured?: boolean
          name: string
          preview_image?: string | null
          tags?: string[]
          template_data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          client_id?: string | null
          comm_templates?: Json
          created_at?: string
          description?: string | null
          event_type?: string | null
          expected_attendees?: number | null
          id?: string
          included_sections?: Json
          is_featured?: boolean
          name?: string
          preview_image?: string | null
          tags?: string[]
          template_data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          client_id: string | null
          cover_image: string | null
          created_at: string
          created_by: string
          description: string | null
          end_date: string
          event_date: string | null
          gallery_images: Json | null
          hero_images: Json | null
          id: string
          location: string | null
          max_attendees: number | null
          readiness: boolean | null
          readiness_details: Json | null
          show_attendees_publicly: boolean
          slug: string | null
          start_date: string
          status: Database["public"]["Enums"]["event_status"]
          theme_id: string
          title: string
          transportation_notes: string | null
          transportation_pickups: Json | null
          transportation_schedule: Json | null
          updated_at: string
          venue: string | null
          venue_address: string | null
          venue_images: Json | null
          venue_lat: number | null
          venue_lng: number | null
          venue_map_link: string | null
          venue_name: string | null
          venue_notes: string | null
          venue_photo_refs: Json | null
          venue_place_id: string | null
        }
        Insert: {
          client_id?: string | null
          cover_image?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          end_date: string
          event_date?: string | null
          gallery_images?: Json | null
          hero_images?: Json | null
          id?: string
          location?: string | null
          max_attendees?: number | null
          readiness?: boolean | null
          readiness_details?: Json | null
          show_attendees_publicly?: boolean
          slug?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["event_status"]
          theme_id?: string
          title: string
          transportation_notes?: string | null
          transportation_pickups?: Json | null
          transportation_schedule?: Json | null
          updated_at?: string
          venue?: string | null
          venue_address?: string | null
          venue_images?: Json | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_map_link?: string | null
          venue_name?: string | null
          venue_notes?: string | null
          venue_photo_refs?: Json | null
          venue_place_id?: string | null
        }
        Update: {
          client_id?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string
          event_date?: string | null
          gallery_images?: Json | null
          hero_images?: Json | null
          id?: string
          location?: string | null
          max_attendees?: number | null
          readiness?: boolean | null
          readiness_details?: Json | null
          show_attendees_publicly?: boolean
          slug?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["event_status"]
          theme_id?: string
          title?: string
          transportation_notes?: string | null
          transportation_pickups?: Json | null
          transportation_schedule?: Json | null
          updated_at?: string
          venue?: string | null
          venue_address?: string | null
          venue_images?: Json | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_map_link?: string | null
          venue_name?: string | null
          venue_notes?: string | null
          venue_photo_refs?: Json | null
          venue_place_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          capacity: number | null
          event_id: string
          id: string
          name: string
        }
        Insert: {
          capacity?: number | null
          event_id: string
          id?: string
          name: string
        }
        Update: {
          capacity?: number | null
          event_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_messages: {
        Row: {
          attendee_id: string | null
          body: string
          channel: string
          client_id: string | null
          event_id: string | null
          from_phone: string
          id: string
          provider: string
          provider_message_id: string | null
          raw_payload: Json | null
          received_at: string
          resolution_reason: string | null
          resolved_status: string
          to_phone: string
        }
        Insert: {
          attendee_id?: string | null
          body: string
          channel?: string
          client_id?: string | null
          event_id?: string | null
          from_phone: string
          id?: string
          provider?: string
          provider_message_id?: string | null
          raw_payload?: Json | null
          received_at?: string
          resolution_reason?: string | null
          resolved_status?: string
          to_phone: string
        }
        Update: {
          attendee_id?: string | null
          body?: string
          channel?: string
          client_id?: string | null
          event_id?: string | null
          from_phone?: string
          id?: string
          provider?: string
          provider_message_id?: string | null
          raw_payload?: Json | null
          received_at?: string
          resolution_reason?: string | null
          resolved_status?: string
          to_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_messages_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          approved: boolean | null
          attribution: string | null
          brand_kit_id: string | null
          client_id: string | null
          created_at: string | null
          created_by: string
          event_id: string | null
          file_url: string
          id: string
          media_type: string
          prompt_used: string | null
          source_type: string
          style_tags: Json | null
          template_id: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string | null
          visual_pack_name: string | null
          workspace_id: string | null
        }
        Insert: {
          approved?: boolean | null
          attribution?: string | null
          brand_kit_id?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by: string
          event_id?: string | null
          file_url: string
          id?: string
          media_type?: string
          prompt_used?: string | null
          source_type?: string
          style_tags?: Json | null
          template_id?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string | null
          visual_pack_name?: string | null
          workspace_id?: string | null
        }
        Update: {
          approved?: boolean | null
          attribution?: string | null
          brand_kit_id?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string
          event_id?: string | null
          file_url?: string
          id?: string
          media_type?: string
          prompt_used?: string | null
          source_type?: string
          style_tags?: Json | null
          template_id?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string | null
          visual_pack_name?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_brand_kit_id_fkey"
            columns: ["brand_kit_id"]
            isOneToOne: false
            referencedRelation: "brand_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "event_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      message_logs: {
        Row: {
          attendee_id: string
          channel: string
          created_at: string
          error: string | null
          event_id: string
          id: string
          message_body: string
          provider: string
          provider_message_id: string | null
          status: string
          subject: string | null
          survey_id: string | null
          to_address: string
        }
        Insert: {
          attendee_id: string
          channel: string
          created_at?: string
          error?: string | null
          event_id: string
          id?: string
          message_body: string
          provider: string
          provider_message_id?: string | null
          status?: string
          subject?: string | null
          survey_id?: string | null
          to_address: string
        }
        Update: {
          attendee_id?: string
          channel?: string
          created_at?: string
          error?: string | null
          event_id?: string
          id?: string
          message_body?: string
          provider?: string
          provider_message_id?: string | null
          status?: string
          subject?: string | null
          survey_id?: string | null
          to_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_logs_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_usage: {
        Row: {
          active_events_count: number
          attendees_count: number
          clients_count: number
          created_at: string
          emails_sent_count: number
          id: string
          period_start: string
          snapshot_at: string
          storage_used_mb: number
          user_id: string
        }
        Insert: {
          active_events_count?: number
          attendees_count?: number
          clients_count?: number
          created_at?: string
          emails_sent_count?: number
          id?: string
          period_start?: string
          snapshot_at?: string
          storage_used_mb?: number
          user_id: string
        }
        Update: {
          active_events_count?: number
          attendees_count?: number
          clients_count?: number
          created_at?: string
          emails_sent_count?: number
          id?: string
          period_start?: string
          snapshot_at?: string
          storage_used_mb?: number
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          metadata: Json | null
          read: boolean
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          metadata?: Json | null
          read?: boolean
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          metadata?: Json | null
          read?: boolean
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      organizers: {
        Row: {
          email: string | null
          event_id: string
          id: string
          mobile: string | null
          name: string
          photo_url: string | null
          role: string | null
        }
        Insert: {
          email?: string | null
          event_id: string
          id?: string
          mobile?: string | null
          name: string
          photo_url?: string | null
          role?: string | null
        }
        Update: {
          email?: string | null
          event_id?: string
          id?: string
          mobile?: string | null
          name?: string
          photo_url?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payment_intent_id: string
          processed_at: string | null
          provider: string
          provider_event_id: string | null
          raw_payload: Json | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payment_intent_id: string
          processed_at?: string | null
          provider?: string
          provider_event_id?: string | null
          raw_payload?: Json | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payment_intent_id?: string
          processed_at?: string | null
          provider?: string
          provider_event_id?: string | null
          raw_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          amount_usd_cents: number
          checkout_url: string | null
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          internal_order_id: string
          metadata: Json | null
          paid_at: string | null
          plan_id: string
          provider: string
          provider_payment_id: string | null
          provider_subscription_id: string | null
          purchase_type: string
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_usd_cents: number
          checkout_url?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          internal_order_id?: string
          metadata?: Json | null
          paid_at?: string | null
          plan_id: string
          provider?: string
          provider_payment_id?: string | null
          provider_subscription_id?: string | null
          purchase_type?: string
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_usd_cents?: number
          checkout_url?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          internal_order_id?: string
          metadata?: Json | null
          paid_at?: string | null
          plan_id?: string
          provider?: string
          provider_payment_id?: string | null
          provider_subscription_id?: string | null
          purchase_type?: string
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "account_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_limit_overrides: {
        Row: {
          created_at: string | null
          custom_limit: number | null
          id: string
          is_grandfathered: boolean | null
          reason: string | null
          resource: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          custom_limit?: number | null
          id?: string
          is_grandfathered?: boolean | null
          reason?: string | null
          resource: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          custom_limit?: number | null
          id?: string
          is_grandfathered?: boolean | null
          reason?: string | null
          resource?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_limit_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rsvp_tokens: {
        Row: {
          attendee_id: string
          event_id: string
          expires_at: string | null
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          attendee_id: string
          event_id: string
          expires_at?: string | null
          id?: string
          token?: string
          used_at?: string | null
        }
        Update: {
          attendee_id?: string
          event_id?: string
          expires_at?: string | null
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rsvp_tokens_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvp_tokens_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          attendee_id: string | null
          cancelled_at: string | null
          channel: string
          created_at: string
          created_by: string
          error: string | null
          event_id: string
          id: string
          message_type: string
          payload: Json
          scheduled_at: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attendee_id?: string | null
          cancelled_at?: string | null
          channel?: string
          created_at?: string
          created_by: string
          error?: string | null
          event_id: string
          id?: string
          message_type?: string
          payload?: Json
          scheduled_at: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attendee_id?: string | null
          cancelled_at?: string | null
          channel?: string
          created_at?: string
          created_by?: string
          error?: string | null
          event_id?: string
          id?: string
          message_type?: string
          payload?: Json
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      speakers: {
        Row: {
          bio: string | null
          day_number: number | null
          event_id: string
          gender: string
          id: string
          linkedin_url: string | null
          name: string
          photo_url: string | null
          title: string | null
        }
        Insert: {
          bio?: string | null
          day_number?: number | null
          event_id: string
          gender?: string
          id?: string
          linkedin_url?: string | null
          name: string
          photo_url?: string | null
          title?: string | null
        }
        Update: {
          bio?: string | null
          day_number?: number | null
          event_id?: string
          gender?: string
          id?: string
          linkedin_url?: string | null
          name?: string
          photo_url?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "speakers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_usage: {
        Row: {
          client_id: string
          created_at: string | null
          file_name: string
          file_size_bytes: number
          file_type: string | null
          id: string
          storage_path: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          file_name: string
          file_size_bytes: number
          file_type?: string | null
          id?: string
          storage_path: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          file_name?: string
          file_size_bytes?: number
          file_type?: string | null
          id?: string
          storage_path?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storage_usage_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          burst_per_minute: number
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          max_active_events: number
          max_ai_heavy: number
          max_ai_requests: number
          max_attendees: number
          max_clients: number
          max_emails: number
          max_maps_photos: number
          max_maps_searches: number
          max_storage_gb: number
          max_whatsapp_sends: number
          monthly_price_cents: number
          name: string
          overage_attendees_per_100_cents: number
          overage_client_cents: number
          overage_emails_per_1000_cents: number
          overage_event_cents: number
          overage_storage_per_5gb_cents: number
          slug: string | null
          support_tier: string
        }
        Insert: {
          burst_per_minute?: number
          created_at?: string
          display_order?: number
          id: string
          is_active?: boolean
          max_active_events: number
          max_ai_heavy?: number
          max_ai_requests?: number
          max_attendees: number
          max_clients: number
          max_emails: number
          max_maps_photos?: number
          max_maps_searches?: number
          max_storage_gb: number
          max_whatsapp_sends?: number
          monthly_price_cents: number
          name: string
          overage_attendees_per_100_cents?: number
          overage_client_cents?: number
          overage_emails_per_1000_cents?: number
          overage_event_cents?: number
          overage_storage_per_5gb_cents?: number
          slug?: string | null
          support_tier?: string
        }
        Update: {
          burst_per_minute?: number
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          max_active_events?: number
          max_ai_heavy?: number
          max_ai_requests?: number
          max_attendees?: number
          max_clients?: number
          max_emails?: number
          max_maps_photos?: number
          max_maps_searches?: number
          max_storage_gb?: number
          max_whatsapp_sends?: number
          monthly_price_cents?: number
          name?: string
          overage_attendees_per_100_cents?: number
          overage_client_cents?: number
          overage_emails_per_1000_cents?: number
          overage_event_cents?: number
          overage_storage_per_5gb_cents?: number
          slug?: string | null
          support_tier?: string
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          author_role: Database["public"]["Enums"]["ticket_author_role"]
          created_at: string
          id: string
          message: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          author_role?: Database["public"]["Enums"]["ticket_author_role"]
          created_at?: string
          id?: string
          message: string
          ticket_id: string
          user_id: string
        }
        Update: {
          author_role?: Database["public"]["Enums"]["ticket_author_role"]
          created_at?: string
          id?: string
          message?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: Database["public"]["Enums"]["ticket_category"]
          created_at: string
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      survey_answers: {
        Row: {
          created_at: string
          event_id: string
          id: string
          question_id: string
          response_id: string
          value_date: string | null
          value_json: Json | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          question_id: string
          response_id: string
          value_date?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          question_id?: string
          response_id?: string
          value_date?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_answers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_invites: {
        Row: {
          attendee_id: string
          created_at: string
          email_sent_at: string | null
          event_id: string
          id: string
          last_sent_at: string | null
          opened_at: string | null
          sent_at: string | null
          sent_via_email: boolean
          sent_via_whatsapp: boolean
          status: string
          submitted_at: string | null
          survey_id: string
          token: string
          whatsapp_sent_at: string | null
        }
        Insert: {
          attendee_id: string
          created_at?: string
          email_sent_at?: string | null
          event_id: string
          id?: string
          last_sent_at?: string | null
          opened_at?: string | null
          sent_at?: string | null
          sent_via_email?: boolean
          sent_via_whatsapp?: boolean
          status?: string
          submitted_at?: string | null
          survey_id: string
          token?: string
          whatsapp_sent_at?: string | null
        }
        Update: {
          attendee_id?: string
          created_at?: string
          email_sent_at?: string | null
          event_id?: string
          id?: string
          last_sent_at?: string | null
          opened_at?: string | null
          sent_at?: string | null
          sent_via_email?: boolean
          sent_via_whatsapp?: boolean
          status?: string
          submitted_at?: string | null
          survey_id?: string
          token?: string
          whatsapp_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_invites_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_invites_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_questions: {
        Row: {
          created_at: string
          event_id: string
          id: string
          order_index: number
          question_text: string
          required: boolean
          settings: Json
          survey_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          order_index?: number
          question_text?: string
          required?: boolean
          settings?: Json
          survey_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          order_index?: number
          question_text?: string
          required?: boolean
          settings?: Json
          survey_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          created_at: string
          event_id: string
          id: string
          respondent_email: string | null
          respondent_id: string | null
          status: string
          submitted_at: string | null
          survey_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          respondent_email?: string | null
          respondent_id?: string | null
          status?: string
          submitted_at?: string | null
          survey_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          respondent_email?: string | null
          respondent_id?: string | null
          status?: string
          submitted_at?: string | null
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          event_id: string
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          event_id: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          event_id?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "surveys_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_pickup_points: {
        Row: {
          address: string | null
          created_at: string
          destination: string | null
          event_id: string
          id: string
          map_url: string | null
          name: string
          notes: string | null
          order_index: number
          pickup_time: string | null
          route_id: string | null
          stop_type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          destination?: string | null
          event_id: string
          id?: string
          map_url?: string | null
          name: string
          notes?: string | null
          order_index?: number
          pickup_time?: string | null
          route_id?: string | null
          stop_type?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          destination?: string | null
          event_id?: string
          id?: string
          map_url?: string | null
          name?: string
          notes?: string | null
          order_index?: number
          pickup_time?: string | null
          route_id?: string | null
          stop_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_pickup_points_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_pickup_points_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_routes: {
        Row: {
          capacity: number | null
          created_at: string
          day_number: number | null
          departure_time: string | null
          driver_mobile: string | null
          driver_name: string | null
          event_id: string
          id: string
          name: string
          notes: string | null
          updated_at: string
          vehicle_type: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          day_number?: number | null
          departure_time?: string | null
          driver_mobile?: string | null
          driver_name?: string | null
          event_id: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          vehicle_type?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string
          day_number?: number | null
          departure_time?: string | null
          driver_mobile?: string | null
          driver_name?: string | null
          event_id?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_routes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_settings: {
        Row: {
          created_at: string
          enabled: boolean
          event_id: string
          general_instructions: string | null
          id: string
          meetup_time: string | null
          mode: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          event_id: string
          general_instructions?: string | null
          id?: string
          meetup_time?: string | null
          mode?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          event_id?: string
          general_instructions?: string | null
          id?: string
          meetup_time?: string | null
          mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_snapshots: {
        Row: {
          active_events_count: number | null
          attendees_count: number | null
          billing_cycle_end: string
          billing_cycle_start: string
          clients_count: number | null
          emails_count: number | null
          id: string
          snapshot_taken_at: string | null
          storage_bytes: number | null
          user_id: string
        }
        Insert: {
          active_events_count?: number | null
          attendees_count?: number | null
          billing_cycle_end: string
          billing_cycle_start: string
          clients_count?: number | null
          emails_count?: number | null
          id?: string
          snapshot_taken_at?: string | null
          storage_bytes?: number | null
          user_id: string
        }
        Update: {
          active_events_count?: number | null
          attendees_count?: number | null
          billing_cycle_end?: string
          billing_cycle_start?: string
          clients_count?: number | null
          emails_count?: number | null
          id?: string
          snapshot_taken_at?: string | null
          storage_bytes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_pickup_point_counts: {
        Row: {
          assigned_count: number | null
          event_id: string | null
          pickup_name: string | null
          pickup_point_id: string | null
          pickup_time: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_pickup_points_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      v_transport_overview: {
        Row: {
          assigned_count: number | null
          enabled: boolean | null
          event_id: string | null
          meetup_time: string | null
          mode: string | null
          total_attendees: number | null
          unassigned_count: number | null
        }
        Insert: {
          assigned_count?: never
          enabled?: boolean | null
          event_id?: string | null
          meetup_time?: string | null
          mode?: string | null
          total_attendees?: never
          unassigned_count?: never
        }
        Update: {
          assigned_count?: never
          enabled?: boolean | null
          event_id?: string | null
          meetup_time?: string | null
          mode?: string | null
          total_attendees?: never
          unassigned_count?: never
        }
        Relationships: [
          {
            foreignKeyName: "transport_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_confirm_payment_intent: {
        Args: { _intent_id: string; _notes?: string }
        Returns: Json
      }
      admin_update_ticket_status: {
        Args: { _new_status: string; _resolved_at?: string; _ticket_id: string }
        Returns: undefined
      }
      assert_admin: { Args: never; Returns: undefined }
      assert_owner: { Args: never; Returns: undefined }
      create_notification: {
        Args: {
          _link?: string
          _message: string
          _metadata?: Json
          _title: string
          _type: Database["public"]["Enums"]["notification_type"]
          _user_id: string
        }
        Returns: string
      }
      delete_draft_event: { Args: { _event_id: string }; Returns: undefined }
      get_user_usage: { Args: { p_user_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_event_public: { Args: { _event_id: string }; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      owner_confirm_payment_intent: {
        Args: { _intent_id: string; _notes?: string }
        Returns: Json
      }
      owns_event: { Args: { _event_id: string }; Returns: boolean }
      storage_extract_event_id: {
        Args: { bucket_name: string; object_name: string }
        Returns: string
      }
      storage_owns_client_asset: {
        Args: { object_name: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "owner"
      attendee_status: "registered" | "confirmed" | "checked_in" | "cancelled"
      event_status:
        | "draft"
        | "published"
        | "ongoing"
        | "completed"
        | "cancelled"
        | "archived"
      notification_type:
        | "support_reply"
        | "support_status_changed"
        | "payment_confirmed"
        | "payment_failed"
        | "payment_expired"
        | "subscription_upgraded"
        | "usage_warning"
        | "event_published"
        | "invitation_sent"
        | "invitation_failed"
      ticket_author_role: "user" | "support" | "admin"
      ticket_category:
        | "billing"
        | "payment"
        | "event_setup"
        | "invitations_rsvp"
        | "public_page"
        | "technical_bug"
        | "other"
      ticket_priority: "low" | "medium" | "high"
      ticket_status:
        | "open"
        | "pending_admin"
        | "pending_support"
        | "resolved"
        | "closed"
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
      app_role: ["admin", "moderator", "user", "owner"],
      attendee_status: ["registered", "confirmed", "checked_in", "cancelled"],
      event_status: [
        "draft",
        "published",
        "ongoing",
        "completed",
        "cancelled",
        "archived",
      ],
      notification_type: [
        "support_reply",
        "support_status_changed",
        "payment_confirmed",
        "payment_failed",
        "payment_expired",
        "subscription_upgraded",
        "usage_warning",
        "event_published",
        "invitation_sent",
        "invitation_failed",
      ],
      ticket_author_role: ["user", "support", "admin"],
      ticket_category: [
        "billing",
        "payment",
        "event_setup",
        "invitations_rsvp",
        "public_page",
        "technical_bug",
        "other",
      ],
      ticket_priority: ["low", "medium", "high"],
      ticket_status: [
        "open",
        "pending_admin",
        "pending_support",
        "resolved",
        "closed",
      ],
    },
  },
} as const
