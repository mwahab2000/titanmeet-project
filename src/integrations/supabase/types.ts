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
      agenda_items: {
        Row: {
          day_number: number | null
          description: string | null
          end_time: string | null
          event_id: string
          id: string
          order_index: number
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
          event_id: string
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
          event_id: string
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
          event_id?: string
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
      event_attendees: {
        Row: {
          event_id: string
          id: string
          registered_at: string
          status: Database["public"]["Enums"]["attendee_status"]
          ticket_number: string | null
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          registered_at?: string
          status?: Database["public"]["Enums"]["attendee_status"]
          ticket_number?: string | null
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          registered_at?: string
          status?: Database["public"]["Enums"]["attendee_status"]
          ticket_number?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sessions: {
        Row: {
          created_at: string
          description: string | null
          end_time: string
          event_id: string
          id: string
          location: string | null
          start_time: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_time: string
          event_id: string
          id?: string
          location?: string | null
          start_time: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_time?: string
          event_id?: string
          id?: string
          location?: string | null
          start_time?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_speakers: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          event_id: string
          id: string
          name: string
          session_id: string | null
          title: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          event_id: string
          id?: string
          name: string
          session_id?: string | null
          title?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          session_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_speakers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_speakers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "event_sessions"
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_event: { Args: { _event_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      attendee_status: "registered" | "confirmed" | "checked_in" | "cancelled"
      event_status:
        | "draft"
        | "published"
        | "ongoing"
        | "completed"
        | "cancelled"
        | "archived"
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
      app_role: ["admin", "moderator", "user"],
      attendee_status: ["registered", "confirmed", "checked_in", "cancelled"],
      event_status: [
        "draft",
        "published",
        "ongoing",
        "completed",
        "cancelled",
        "archived",
      ],
    },
  },
} as const
