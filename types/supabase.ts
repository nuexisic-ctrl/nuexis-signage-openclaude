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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          created_at: string
          description: string
          device_id: string | null
          event_type: string
          id: string
          metadata: Json | null
          team_id: string
        }
        Insert: {
          created_at?: string
          description: string
          device_id?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          team_id: string
        }
        Update: {
          created_at?: string
          description?: string
          device_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          color: string | null
          created_at: string
          file_name: string
          file_path: string
          folder_id: string | null
          id: string
          mime_type: string
          size_bytes: number
          team_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          file_name: string
          file_path: string
          folder_id?: string | null
          id?: string
          mime_type: string
          size_bytes: number
          team_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          folder_id?: string | null
          id?: string
          mime_type?: string
          size_bytes?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_attempts: {
        Row: {
          attempted_at: string
          id: string
          ip_address: string | null
          pairing_code: string | null
          user_id: string | null
        }
        Insert: {
          attempted_at?: string
          id?: string
          ip_address?: string | null
          pairing_code?: string | null
          user_id?: string | null
        }
        Update: {
          attempted_at?: string
          id?: string
          ip_address?: string | null
          pairing_code?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      devices: {
        Row: {
          asset_id: string | null
          content: string | null
          content_type: string | null
          created_at: string
          expires_at: string
          hardware_id: string | null
          id: string
          last_seen_at: string | null
          name: string | null
          orientation: number | null
          pairing_code: string
          playlist_id: string | null
          secret: string | null
          status: string
          team_id: string | null
          total_playtime_seconds: number
          app_version: string | null
          os_version: string | null
          scale_mode: string | null
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          content?: string | null
          content_type?: string | null
          created_at?: string
          expires_at?: string
          hardware_id?: string | null
          id?: string
          last_seen_at?: string | null
          name?: string | null
          orientation?: number | null
          pairing_code: string
          playlist_id?: string | null
          secret?: string | null
          status?: string
          team_id?: string | null
          total_playtime_seconds?: number
          app_version?: string | null
          os_version?: string | null
          scale_mode?: string | null
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          content?: string | null
          content_type?: string | null
          created_at?: string
          expires_at?: string
          hardware_id?: string | null
          id?: string
          last_seen_at?: string | null
          name?: string | null
          orientation?: number | null
          pairing_code?: string
          playlist_id?: string | null
          secret?: string | null
          status?: string
          team_id?: string | null
          total_playtime_seconds?: number
          app_version?: string | null
          os_version?: string | null
          scale_mode?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_items: {
        Row: {
          asset_id: string | null
          created_at: string | null
          duration_seconds: number
          id: string
          playlist_id: string | null
          sort_order: number
          type: string
          widget_config: Json | null
          widget_type: string | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string | null
          duration_seconds?: number
          id?: string
          playlist_id?: string | null
          sort_order?: number
          type: string
          widget_config?: Json | null
          widget_type?: string | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string | null
          duration_seconds?: number
          id?: string
          playlist_id?: string | null
          sort_order?: number
          type?: string
          widget_config?: Json | null
          widget_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playlist_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          created_at: string | null
          id: string
          name: string
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playlists_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          role: string
          team_id: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          role?: string
          team_id?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          role?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      screen_group_members: {
        Row: {
          added_at: string | null
          device_id: string
          group_id: string
          is_primary: boolean | null
          team_id: string
        }
        Insert: {
          added_at?: string | null
          device_id: string
          group_id: string
          is_primary?: boolean | null
          team_id: string
        }
        Update: {
          added_at?: string | null
          device_id?: string
          group_id?: string
          is_primary?: boolean | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screen_group_members_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screen_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "screen_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screen_group_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      screen_groups: {
        Row: {
          asset_id: string | null
          color: string | null
          content_type: string | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          orientation: number | null
          playlist_id: string | null
          team_id: string
        }
        Insert: {
          asset_id?: string | null
          color?: string | null
          content_type?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          orientation?: number | null
          playlist_id?: string | null
          team_id: string
        }
        Update: {
          asset_id?: string | null
          color?: string | null
          content_type?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          orientation?: number | null
          playlist_id?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screen_groups_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screen_groups_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screen_groups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          historical_playtime_seconds: number
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          historical_playtime_seconds?: number
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          historical_playtime_seconds?: number
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      widget_edit_logs: {
        Row: {
          asset_id: string
          created_at: string
          edited_by: string
          id: string
          new_name: string | null
          new_path: string | null
          previous_name: string | null
          previous_path: string | null
          team_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          edited_by: string
          id?: string
          new_name?: string | null
          new_path?: string | null
          previous_name?: string | null
          previous_path?: string | null
          team_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          edited_by?: string
          id?: string
          new_name?: string | null
          new_path?: string | null
          previous_name?: string | null
          previous_path?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_edit_logs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_edit_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_team_exists: { Args: { p_slug: string }; Returns: boolean }
      check_team_slug_available: { Args: { p_slug: string }; Returns: boolean }
      claim_device: {
        Args: {
          p_name: string
          p_pairing_code: string
          p_team_id: string
          p_user_id: string
        }
        Returns: Json
      }
      create_playlist_atomic: {
        Args: { p_items: Json; p_name: string; p_team_id: string }
        Returns: Json
      }
      device_secret_matches: {
        Args: {
          p_device: Database["public"]["Tables"]["devices"]["Row"]
          p_secret: string
        }
        Returns: boolean
      }
      get_player_asset: {
        Args: { p_asset_id: string; p_hardware_id: string; p_secret: string }
        Returns: Json
      }
      get_player_asset_info: {
        Args: { p_asset_id: string; p_hardware_id: string; p_secret: string }
        Returns: Json
      }
      get_player_device_state: {
        Args: { p_hardware_id: string; p_secret?: string }
        Returns: Json
      }
      get_player_manifest: {
        Args: { p_device_id: string; p_session_token: string }
        Returns: Json
      }
      get_player_playlist_items: {
        Args: { p_hardware_id: string; p_playlist_id: string; p_secret: string }
        Returns: Json
      }
      get_player_signed_media_url: {
        Args: {
          p_expires_in?: number
          p_file_path: string
          p_hardware_id: string
          p_secret: string
        }
        Returns: string
      }
      increment_device_playtime: {
        Args: {
          p_device_id: string
          p_hardware_id: string
          p_seconds: number
          p_secret: string
        }
        Returns: undefined
      }
      refresh_player_device_code: {
        Args: {
          p_device_id: string
          p_expires_at: string
          p_hardware_id: string
          p_pairing_code: string
          p_secret: string
        }
        Returns: Json
      }
      register_player_device: {
        Args: {
          p_expires_at: string
          p_hardware_id: string
          p_pairing_code: string
        }
        Returns: Json
      }
      report_device_health: {
        Args: {
          p_app_version?: string
          p_current_item_id?: string
          p_device_id: string
          p_free_disk_bytes?: number
          p_last_error?: string
          p_manifest_version?: string
          p_memory_class_mb?: number
          p_network_type?: string
          p_os_version?: string
          p_session_token: string
        }
        Returns: Json
      }
      resolve_device_state: {
        Args: { p_device: Database["public"]["Tables"]["devices"]["Row"] }
        Returns: {
          asset_id: string | null
          content: string | null
          content_type: string | null
          created_at: string
          expires_at: string
          hardware_id: string | null
          id: string
          last_seen_at: string | null
          name: string | null
          orientation: number | null
          pairing_code: string
          playlist_id: string | null
          secret: string | null
          status: string
          team_id: string | null
          total_playtime_seconds: number
        }
        SetofOptions: {
          from: "devices"
          to: "devices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sanitize_name: { Args: { input: string }; Returns: string }
      unpair_player_device: {
        Args: { p_device_id: string; p_hardware_id: string; p_secret: string }
        Returns: undefined
      }
      update_device_statuses: { Args: never; Returns: undefined }
      update_player_device_orientation: {
        Args: {
          p_device_id: string
          p_hardware_id: string
          p_orientation: number
          p_secret: string
        }
        Returns: undefined
      }
      update_playlist_atomic: {
        Args: {
          p_items: Json
          p_name: string
          p_playlist_id: string
          p_team_id: string
        }
        Returns: Json
      }
      ping_device: {
        Args: {
          p_device_id: string
          p_hardware_id?: string
          p_secret?: string
          p_session_token?: string
        }
        Returns: Json
      }
      validate_device_session: {
        Args: { p_device_id: string; p_session_token: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
