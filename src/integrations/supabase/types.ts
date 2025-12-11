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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      app_versions: {
        Row: {
          changelog: string | null
          created_at: string | null
          description: string | null
          id: string
          is_current: boolean | null
          release_date: string
          version_number: string
        }
        Insert: {
          changelog?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_current?: boolean | null
          release_date?: string
          version_number: string
        }
        Update: {
          changelog?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_current?: boolean | null
          release_date?: string
          version_number?: string
        }
        Relationships: []
      }
      jellyseerr_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          media_id: number
          media_overview: string | null
          media_poster: string | null
          media_title: string
          media_type: string
          rejection_reason: string | null
          seasons: Json | null
          status: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          media_id: number
          media_overview?: string | null
          media_poster?: string | null
          media_title: string
          media_type: string
          rejection_reason?: string | null
          seasons?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          media_id?: number
          media_overview?: string | null
          media_poster?: string | null
          media_title?: string
          media_type?: string
          rejection_reason?: string | null
          seasons?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      media_compatibility: {
        Row: {
          audio_codec: string | null
          container: string | null
          created_at: string
          id: string
          image_url: string | null
          jellyfin_item_id: string
          jellyfin_item_name: string
          jellyfin_item_type: string
          jellyfin_season_id: string | null
          jellyfin_series_id: string | null
          jellyfin_series_name: string | null
          last_scanned_at: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["compatibility_status"]
          transcode_reason: string | null
          updated_at: string
          video_codec: string | null
        }
        Insert: {
          audio_codec?: string | null
          container?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          jellyfin_item_id: string
          jellyfin_item_name: string
          jellyfin_item_type: string
          jellyfin_season_id?: string | null
          jellyfin_series_id?: string | null
          jellyfin_series_name?: string | null
          last_scanned_at?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["compatibility_status"]
          transcode_reason?: string | null
          updated_at?: string
          video_codec?: string | null
        }
        Update: {
          audio_codec?: string | null
          container?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          jellyfin_item_id?: string
          jellyfin_item_name?: string
          jellyfin_item_type?: string
          jellyfin_season_id?: string | null
          jellyfin_series_id?: string | null
          jellyfin_series_name?: string | null
          last_scanned_at?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["compatibility_status"]
          transcode_reason?: string | null
          updated_at?: string
          video_codec?: string | null
        }
        Relationships: []
      }
      media_reports: {
        Row: {
          admin_notes: string | null
          category: Database["public"]["Enums"]["media_report_category"]
          created_at: string
          id: string
          image_url: string | null
          jellyfin_item_id: string
          jellyfin_item_name: string
          jellyfin_item_type: string
          jellyfin_series_name: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          category: Database["public"]["Enums"]["media_report_category"]
          created_at?: string
          id?: string
          image_url?: string | null
          jellyfin_item_id: string
          jellyfin_item_name: string
          jellyfin_item_type: string
          jellyfin_series_name?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          category?: Database["public"]["Enums"]["media_report_category"]
          created_at?: string
          id?: string
          image_url?: string | null
          jellyfin_item_id?: string
          jellyfin_item_name?: string
          jellyfin_item_type?: string
          jellyfin_series_name?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      news_posts: {
        Row: {
          content: string
          created_at: string | null
          created_by: string
          id: string
          pinned: boolean | null
          published: boolean | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by: string
          id?: string
          pinned?: boolean | null
          published?: boolean | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string
          id?: string
          pinned?: boolean | null
          published?: boolean | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          jellyfin_user_id: string | null
          jellyfin_username: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          jellyfin_user_id?: string | null
          jellyfin_username?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          jellyfin_user_id?: string | null
          jellyfin_username?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      radarr_downloads: {
        Row: {
          created_at: string
          download_date: string
          id: string
          movie_title: string
          needs_transcode: boolean | null
          notes: string | null
          quality: string | null
          radarr_movie_id: number
          reviewed: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          size_bytes: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          download_date?: string
          id?: string
          movie_title: string
          needs_transcode?: boolean | null
          notes?: string | null
          quality?: string | null
          radarr_movie_id: number
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          download_date?: string
          id?: string
          movie_title?: string
          needs_transcode?: boolean | null
          notes?: string | null
          quality?: string | null
          radarr_movie_id?: number
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      scan_schedule: {
        Row: {
          created_at: string
          cron_expression: string
          enabled: boolean
          id: string
          last_run_at: string | null
          last_run_issues_found: number | null
          last_run_items_scanned: number | null
          last_run_status: string | null
          next_run_at: string | null
          scan_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cron_expression?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          last_run_issues_found?: number | null
          last_run_items_scanned?: number | null
          last_run_status?: string | null
          next_run_at?: string | null
          scan_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cron_expression?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          last_run_issues_found?: number | null
          last_run_items_scanned?: number | null
          last_run_status?: string | null
          next_run_at?: string | null
          scan_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      server_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      transcode_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          error: string | null
          file_path: string | null
          id: string
          jellyfin_item_id: string
          jellyfin_item_name: string
          logs: Json | null
          output_format: string
          progress: number
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          file_path?: string | null
          id?: string
          jellyfin_item_id: string
          jellyfin_item_name: string
          logs?: Json | null
          output_format?: string
          progress?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          file_path?: string | null
          id?: string
          jellyfin_item_id?: string
          jellyfin_item_name?: string
          logs?: Json | null
          output_format?: string
          progress?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      update_status: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_step: string | null
          error: string | null
          id: string
          logs: Json | null
          progress: number
          started_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_step?: string | null
          error?: string | null
          id?: string
          logs?: Json | null
          progress?: number
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_step?: string | null
          error?: string | null
          id?: string
          logs?: Json | null
          progress?: number
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_favorites: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          jellyfin_item_id: string
          jellyfin_item_name: string
          jellyfin_item_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          jellyfin_item_id: string
          jellyfin_item_name: string
          jellyfin_item_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          jellyfin_item_id?: string
          jellyfin_item_name?: string
          jellyfin_item_type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          created_at: string
          description: string
          id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_likes: {
        Row: {
          created_at: string
          id: string
          jellyfin_item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          jellyfin_item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          jellyfin_item_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      watch_history: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          jellyfin_item_id: string
          jellyfin_item_name: string
          jellyfin_item_type: string
          jellyfin_season_id: string | null
          jellyfin_series_id: string | null
          jellyfin_series_name: string | null
          last_position_ticks: number | null
          runtime_ticks: number | null
          updated_at: string
          user_id: string
          watched_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          jellyfin_item_id: string
          jellyfin_item_name: string
          jellyfin_item_type: string
          jellyfin_season_id?: string | null
          jellyfin_series_id?: string | null
          jellyfin_series_name?: string | null
          last_position_ticks?: number | null
          runtime_ticks?: number | null
          updated_at?: string
          user_id: string
          watched_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          jellyfin_item_id?: string
          jellyfin_item_name?: string
          jellyfin_item_type?: string
          jellyfin_season_id?: string | null
          jellyfin_series_id?: string | null
          jellyfin_series_name?: string | null
          last_position_ticks?: number | null
          runtime_ticks?: number | null
          updated_at?: string
          user_id?: string
          watched_at?: string
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
      setup_server_settings: {
        Args: { p_api_key: string; p_server_url: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      compatibility_status:
        | "compatible"
        | "needs_transcode"
        | "unknown"
        | "error"
      media_report_category:
        | "buffering"
        | "no_audio"
        | "no_video"
        | "subtitle_issues"
        | "wrong_file"
        | "quality_issues"
        | "other"
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
      app_role: ["admin", "user"],
      compatibility_status: [
        "compatible",
        "needs_transcode",
        "unknown",
        "error",
      ],
      media_report_category: [
        "buffering",
        "no_audio",
        "no_video",
        "subtitle_issues",
        "wrong_file",
        "quality_issues",
        "other",
      ],
    },
  },
} as const
