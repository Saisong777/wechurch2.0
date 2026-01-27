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
      ai_reports: {
        Row: {
          content: string
          created_at: string
          group_number: number | null
          id: string
          report_type: string
          session_id: string
          status: string
        }
        Insert: {
          content: string
          created_at?: string
          group_number?: number | null
          id?: string
          report_type: string
          session_id: string
          status?: string
        }
        Update: {
          content?: string
          created_at?: string
          group_number?: number | null
          id?: string
          report_type?: string
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      card_questions: {
        Row: {
          content_text: string
          content_text_en: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          level: Database["public"]["Enums"]["card_level"]
          sort_order: number | null
        }
        Insert: {
          content_text: string
          content_text_en?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          level: Database["public"]["Enums"]["card_level"]
          sort_order?: number | null
        }
        Update: {
          content_text?: string
          content_text_en?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          level?: Database["public"]["Enums"]["card_level"]
          sort_order?: number | null
        }
        Relationships: []
      }
      icebreaker_games: {
        Row: {
          bible_study_session_id: string | null
          created_at: string | null
          current_card_id: string | null
          current_drawer_card_id: string | null
          current_drawer_id: string | null
          current_level: Database["public"]["Enums"]["card_level"] | null
          drawer_order: string[] | null
          group_number: number | null
          id: string
          mode: Database["public"]["Enums"]["game_mode"]
          pass_count: number | null
          room_code: string
          shared_member_ids: string[] | null
          sharing_mode: boolean
          status: string
          timer_duration: number | null
          timer_running: boolean | null
          timer_started_at: string | null
          updated_at: string | null
          used_card_ids: string[] | null
        }
        Insert: {
          bible_study_session_id?: string | null
          created_at?: string | null
          current_card_id?: string | null
          current_drawer_card_id?: string | null
          current_drawer_id?: string | null
          current_level?: Database["public"]["Enums"]["card_level"] | null
          drawer_order?: string[] | null
          group_number?: number | null
          id?: string
          mode?: Database["public"]["Enums"]["game_mode"]
          pass_count?: number | null
          room_code?: string
          shared_member_ids?: string[] | null
          sharing_mode?: boolean
          status?: string
          timer_duration?: number | null
          timer_running?: boolean | null
          timer_started_at?: string | null
          updated_at?: string | null
          used_card_ids?: string[] | null
        }
        Update: {
          bible_study_session_id?: string | null
          created_at?: string | null
          current_card_id?: string | null
          current_drawer_card_id?: string | null
          current_drawer_id?: string | null
          current_level?: Database["public"]["Enums"]["card_level"] | null
          drawer_order?: string[] | null
          group_number?: number | null
          id?: string
          mode?: Database["public"]["Enums"]["game_mode"]
          pass_count?: number | null
          room_code?: string
          shared_member_ids?: string[] | null
          sharing_mode?: boolean
          status?: string
          timer_duration?: number | null
          timer_running?: boolean | null
          timer_started_at?: string | null
          updated_at?: string | null
          used_card_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "icebreaker_games_bible_study_session_id_fkey"
            columns: ["bible_study_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icebreaker_games_bible_study_session_id_fkey"
            columns: ["bible_study_session_id"]
            isOneToOne: false
            referencedRelation: "sessions_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icebreaker_games_current_card_id_fkey"
            columns: ["current_card_id"]
            isOneToOne: false
            referencedRelation: "card_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          email: string
          gender: string
          group_number: number | null
          id: string
          joined_at: string
          location: string
          name: string
          ready_confirmed: boolean
          session_id: string
          updated_at: string | null
        }
        Insert: {
          email: string
          gender: string
          group_number?: number | null
          id?: string
          joined_at?: string
          location?: string
          name: string
          ready_confirmed?: boolean
          session_id: string
          updated_at?: string | null
        }
        Update: {
          email?: string
          gender?: string
          group_number?: number | null
          id?: string
          joined_at?: string
          location?: string
          name?: string
          ready_confirmed?: boolean
          session_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      potential_members: {
        Row: {
          created_at: string
          email: string
          first_joined_at: string
          gender: string | null
          id: string
          last_session_at: string
          name: string
          sessions_count: number
          status: string
          subscribed: boolean
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          first_joined_at?: string
          gender?: string | null
          id?: string
          last_session_at?: string
          name: string
          sessions_count?: number
          status?: string
          subscribed?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          first_joined_at?: string
          gender?: string | null
          id?: string
          last_session_at?: string
          name?: string
          sessions_count?: number
          status?: string
          subscribed?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          allow_latecomers: boolean
          created_at: string
          group_size: number | null
          grouping_method: string | null
          icebreaker_enabled: boolean
          id: string
          owner_id: string | null
          short_code: string | null
          status: string
          verse_reference: string
        }
        Insert: {
          allow_latecomers?: boolean
          created_at?: string
          group_size?: number | null
          grouping_method?: string | null
          icebreaker_enabled?: boolean
          id?: string
          owner_id?: string | null
          short_code?: string | null
          status?: string
          verse_reference: string
        }
        Update: {
          allow_latecomers?: boolean
          created_at?: string
          group_size?: number | null
          grouping_method?: string | null
          icebreaker_enabled?: boolean
          id?: string
          owner_id?: string | null
          short_code?: string | null
          status?: string
          verse_reference?: string
        }
        Relationships: []
      }
      study_responses: {
        Row: {
          action_plan: string | null
          cool_down_note: string | null
          core_insight_category:
            | Database["public"]["Enums"]["insight_category_type"]
            | null
          core_insight_note: string | null
          created_at: string
          heartbeat_verse: string | null
          id: string
          observation: string | null
          scholars_note: string | null
          session_id: string
          title_phrase: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_plan?: string | null
          cool_down_note?: string | null
          core_insight_category?:
            | Database["public"]["Enums"]["insight_category_type"]
            | null
          core_insight_note?: string | null
          created_at?: string
          heartbeat_verse?: string | null
          id?: string
          observation?: string | null
          scholars_note?: string | null
          session_id: string
          title_phrase?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_plan?: string | null
          cool_down_note?: string | null
          core_insight_category?:
            | Database["public"]["Enums"]["insight_category_type"]
            | null
          core_insight_note?: string | null
          created_at?: string
          heartbeat_verse?: string | null
          id?: string
          observation?: string | null
          scholars_note?: string | null
          session_id?: string
          title_phrase?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          application_in_life: string | null
          bible_verse: string
          email: string
          facts_discovered: string | null
          group_number: number
          id: string
          inspiration_from_god: string | null
          moving_verse: string | null
          name: string
          others: string | null
          participant_id: string
          session_id: string
          submitted_at: string
          theme: string | null
          traditional_exegesis: string | null
        }
        Insert: {
          application_in_life?: string | null
          bible_verse: string
          email: string
          facts_discovered?: string | null
          group_number: number
          id?: string
          inspiration_from_god?: string | null
          moving_verse?: string | null
          name: string
          others?: string | null
          participant_id: string
          session_id: string
          submitted_at?: string
          theme?: string | null
          traditional_exegesis?: string | null
        }
        Update: {
          application_in_life?: string | null
          bible_verse?: string
          email?: string
          facts_discovered?: string | null
          group_number?: number
          id?: string
          inspiration_from_god?: string | null
          moving_verse?: string | null
          name?: string
          others?: string | null
          participant_id?: string
          session_id?: string
          submitted_at?: string
          theme?: string | null
          traditional_exegesis?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      participant_names: {
        Row: {
          email: string | null
          gender: string | null
          group_number: number | null
          id: string | null
          joined_at: string | null
          location: string | null
          name: string | null
          ready_confirmed: boolean | null
          session_id: string | null
        }
        Insert: {
          email?: never
          gender?: string | null
          group_number?: number | null
          id?: string | null
          joined_at?: string | null
          location?: string | null
          name?: string | null
          ready_confirmed?: boolean | null
          session_id?: string | null
        }
        Update: {
          email?: never
          gender?: string | null
          group_number?: number | null
          id?: string | null
          joined_at?: string | null
          location?: string | null
          name?: string | null
          ready_confirmed?: boolean | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions_public: {
        Row: {
          allow_latecomers: boolean | null
          created_at: string | null
          group_size: number | null
          grouping_method: string | null
          icebreaker_enabled: boolean | null
          id: string | null
          short_code: string | null
          status: string | null
          verse_reference: string | null
        }
        Insert: {
          allow_latecomers?: boolean | null
          created_at?: string | null
          group_size?: number | null
          grouping_method?: string | null
          icebreaker_enabled?: boolean | null
          id?: string | null
          short_code?: string | null
          status?: string | null
          verse_reference?: string | null
        }
        Update: {
          allow_latecomers?: boolean | null
          created_at?: string | null
          group_size?: number | null
          grouping_method?: string | null
          icebreaker_enabled?: boolean | null
          id?: string | null
          short_code?: string | null
          status?: string | null
          verse_reference?: string | null
        }
        Relationships: []
      }
      study_responses_public: {
        Row: {
          action_plan: string | null
          cool_down_note: string | null
          core_insight_category:
            | Database["public"]["Enums"]["insight_category_type"]
            | null
          core_insight_note: string | null
          created_at: string | null
          email: string | null
          group_number: number | null
          heartbeat_verse: string | null
          id: string | null
          observation: string | null
          participant_name: string | null
          progress_status: string | null
          scholars_note: string | null
          session_id: string | null
          title_phrase: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions_public: {
        Row: {
          application_in_life: string | null
          bible_verse: string | null
          facts_discovered: string | null
          group_number: number | null
          id: string | null
          inspiration_from_god: string | null
          moving_verse: string | null
          name: string | null
          others: string | null
          participant_id: string | null
          session_id: string | null
          submitted_at: string | null
          theme: string | null
          traditional_exegesis: string | null
        }
        Insert: {
          application_in_life?: string | null
          bible_verse?: string | null
          facts_discovered?: string | null
          group_number?: number | null
          id?: string | null
          inspiration_from_god?: string | null
          moving_verse?: string | null
          name?: string | null
          others?: string | null
          participant_id?: string | null
          session_id?: string | null
          submitted_at?: string | null
          theme?: string | null
          traditional_exegesis?: string | null
        }
        Update: {
          application_in_life?: string | null
          bible_verse?: string | null
          facts_discovered?: string | null
          group_number?: number | null
          id?: string | null
          inspiration_from_god?: string | null
          moving_verse?: string | null
          name?: string | null
          others?: string | null
          participant_id?: string | null
          session_id?: string | null
          submitted_at?: string | null
          theme?: string | null
          traditional_exegesis?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ai_notes_feed: {
        Row: {
          action_plan: string | null
          cool_down_note: string | null
          core_insight_category:
            | Database["public"]["Enums"]["insight_category_type"]
            | null
          core_insight_note: string | null
          created_at: string | null
          first_name: string | null
          group_number: number | null
          heartbeat_verse: string | null
          observation: string | null
          scholars_note: string | null
          session_id: string | null
          title_phrase: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_create_session: { Args: { _user_id: string }; Returns: boolean }
      check_participant_rate_limit: {
        Args: { p_email: string; p_session_id: string }
        Returns: boolean
      }
      draw_next_card: {
        Args: {
          p_game_id: string
          p_level?: Database["public"]["Enums"]["card_level"]
        }
        Returns: {
          card_content: string
          card_id: string
          card_level: Database["public"]["Enums"]["card_level"]
          cards_remaining: number
        }[]
      }
      generate_short_code: { Args: never; Returns: string }
      get_participant_for_reentry: {
        Args: { p_email: string; p_session_id: string }
        Returns: {
          gender: string
          group_number: number
          id: string
          joined_at: string
          location: string
          name: string
          ready_confirmed: boolean
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin:
        | { Args: never; Returns: boolean }
        | { Args: { _user_id: string }; Returns: boolean }
      is_verified_participant: {
        Args: {
          p_email: string
          p_participant_id: string
          p_session_id: string
        }
        Returns: boolean
      }
      reset_icebreaker_deck: { Args: { p_game_id: string }; Returns: boolean }
      set_participant_ready: {
        Args: {
          p_email: string
          p_participant_id: string
          p_ready: boolean
          p_session_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "member" | "leader" | "future_leader" | "admin"
      card_level: "L1" | "L2" | "L3"
      game_mode: "standalone" | "session"
      insight_category_type: "PROMISE" | "COMMAND" | "WARNING" | "GOD_ATTRIBUTE"
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
      app_role: ["member", "leader", "future_leader", "admin"],
      card_level: ["L1", "L2", "L3"],
      game_mode: ["standalone", "session"],
      insight_category_type: ["PROMISE", "COMMAND", "WARNING", "GOD_ATTRIBUTE"],
    },
  },
} as const
