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
      account_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          plan_id: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_id?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_id?: string
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
          confirmed: boolean
          confirmed_at: string | null
          email: string
          event_id: string
          id: string
          invitation_sent: boolean
          mobile: string | null
          name: string
        }
        Insert: {
          confirmed?: boolean
          confirmed_at?: string | null
          email: string
          event_id: string
          id?: string
          invitation_sent?: boolean
          mobile?: string | null
          name: string
        }
        Update: {
          confirmed?: boolean
          confirmed_at?: string | null
          email?: string
          event_id?: string
          id?: string
          invitation_sent?: boolean
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
          client_id: string | null
          created_at: string
          description: string | null
          id: string
          included_sections: Json
          name: string
          template_data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          included_sections?: Json
          name: string
          template_data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          included_sections?: Json
          name?: string
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
          venue_map_link: string | null
          venue_name: string | null
          venue_notes: string | null
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
          venue_map_link?: string | null
          venue_name?: string | null
          venue_notes?: string | null
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
          venue_map_link?: string | null
          venue_name?: string | null
          venue_notes?: string | null
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
      speakers: {
        Row: {
          bio: string | null
          event_id: string
          id: string
          linkedin_url: string | null
          name: string
          photo_url: string | null
          title: string | null
        }
        Insert: {
          bio?: string | null
          event_id: string
          id?: string
          linkedin_url?: string | null
          name: string
          photo_url?: string | null
          title?: string | null
        }
        Update: {
          bio?: string | null
          event_id?: string
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
      subscription_plans: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          max_active_events: number
          max_attendees: number
          max_clients: number
          max_emails: number
          max_storage_gb: number
          monthly_price_cents: number
          name: string
          overage_attendees_per_100_cents: number
          overage_client_cents: number
          overage_emails_per_1000_cents: number
          overage_event_cents: number
          overage_storage_per_5gb_cents: number
          support_tier: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id: string
          is_active?: boolean
          max_active_events: number
          max_attendees: number
          max_clients: number
          max_emails: number
          max_storage_gb: number
          monthly_price_cents: number
          name: string
          overage_attendees_per_100_cents?: number
          overage_client_cents?: number
          overage_emails_per_1000_cents?: number
          overage_event_cents?: number
          overage_storage_per_5gb_cents?: number
          support_tier?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          max_active_events?: number
          max_attendees?: number
          max_clients?: number
          max_emails?: number
          max_storage_gb?: number
          monthly_price_cents?: number
          name?: string
          overage_attendees_per_100_cents?: number
          overage_client_cents?: number
          overage_emails_per_1000_cents?: number
          overage_event_cents?: number
          overage_storage_per_5gb_cents?: number
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
          event_id: string
          id: string
          opened_at: string | null
          sent_at: string | null
          status: string
          submitted_at: string | null
          survey_id: string
          token: string
        }
        Insert: {
          attendee_id: string
          created_at?: string
          event_id: string
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          status?: string
          submitted_at?: string | null
          survey_id: string
          token?: string
        }
        Update: {
          attendee_id?: string
          created_at?: string
          event_id?: string
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          status?: string
          submitted_at?: string | null
          survey_id?: string
          token?: string
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
