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
          height: number | null
          id: string
          mime_type: string
          size_bytes: number
          team_id: string
          width: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          file_name: string
          file_path: string
          folder_id?: string | null
          height?: number | null
          id?: string
          mime_type: string
          size_bytes: number
          team_id: string
          width?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          folder_id?: string | null
          height?: number | null
          id?: string
          mime_type?: string
          size_bytes?: number
          team_id?: string
          width?: number | null
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
      device_health_events: {
        Row: {
          app_version: string | null
          created_at: string
          current_item_id: string | null
          device_id: string
          free_disk_bytes: number | null
          id: string
          last_error: string | null
          manifest_version: string | null
          memory_class_mb: number | null
          network_type: string | null
          os_version: string | null
          team_id: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id?: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_health_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_health_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      device_health_events_y2026_06_12: {
        Row: {
          app_version: string | null
          created_at: string
          current_item_id: string | null
          device_id: string
          free_disk_bytes: number | null
          id: string
          last_error: string | null
          manifest_version: string | null
          memory_class_mb: number | null
          network_type: string | null
          os_version: string | null
          team_id: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id?: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Relationships: []
      }
      device_health_events_y2026_06_13: {
        Row: {
          app_version: string | null
          created_at: string
          current_item_id: string | null
          device_id: string
          free_disk_bytes: number | null
          id: string
          last_error: string | null
          manifest_version: string | null
          memory_class_mb: number | null
          network_type: string | null
          os_version: string | null
          team_id: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id?: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Relationships: []
      }
      device_health_events_y2026_06_14: {
        Row: {
          app_version: string | null
          created_at: string
          current_item_id: string | null
          device_id: string
          free_disk_bytes: number | null
          id: string
          last_error: string | null
          manifest_version: string | null
          memory_class_mb: number | null
          network_type: string | null
          os_version: string | null
          team_id: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id?: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Relationships: []
      }
      device_health_events_y2026_06_15: {
        Row: {
          app_version: string | null
          created_at: string
          current_item_id: string | null
          device_id: string
          free_disk_bytes: number | null
          id: string
          last_error: string | null
          manifest_version: string | null
          memory_class_mb: number | null
          network_type: string | null
          os_version: string | null
          team_id: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id?: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Relationships: []
      }
      device_health_events_y2026_06_16: {
        Row: {
          app_version: string | null
          created_at: string
          current_item_id: string | null
          device_id: string
          free_disk_bytes: number | null
          id: string
          last_error: string | null
          manifest_version: string | null
          memory_class_mb: number | null
          network_type: string | null
          os_version: string | null
          team_id: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id?: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Relationships: []
      }
      device_health_events_y2026_06_17: {
        Row: {
          app_version: string | null
          created_at: string
          current_item_id: string | null
          device_id: string
          free_disk_bytes: number | null
          id: string
          last_error: string | null
          manifest_version: string | null
          memory_class_mb: number | null
          network_type: string | null
          os_version: string | null
          team_id: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id?: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Relationships: []
      }
      device_health_events_y2026_06_18: {
        Row: {
          app_version: string | null
          created_at: string
          current_item_id: string | null
          device_id: string
          free_disk_bytes: number | null
          id: string
          last_error: string | null
          manifest_version: string | null
          memory_class_mb: number | null
          network_type: string | null
          os_version: string | null
          team_id: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id?: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Relationships: []
      }
      device_health_events_y2026_06_19: {
        Row: {
          app_version: string | null
          created_at: string
          current_item_id: string | null
          device_id: string
          free_disk_bytes: number | null
          id: string
          last_error: string | null
          manifest_version: string | null
          memory_class_mb: number | null
          network_type: string | null
          os_version: string | null
          team_id: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id?: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Relationships: []
      }
      device_health_events_y2026_06_20: {
        Row: {
          app_version: string | null
          created_at: string
          current_item_id: string | null
          device_id: string
          free_disk_bytes: number | null
          id: string
          last_error: string | null
          manifest_version: string | null
          memory_class_mb: number | null
          network_type: string | null
          os_version: string | null
          team_id: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id?: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Relationships: []
      }
      device_health_events_y2026_06_21: {
        Row: {
          app_version: string | null
          created_at: string
          current_item_id: string | null
          device_id: string
          free_disk_bytes: number | null
          id: string
          last_error: string | null
          manifest_version: string | null
          memory_class_mb: number | null
          network_type: string | null
          os_version: string | null
          team_id: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id?: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Relationships: []
      }
      device_health_events_y2026_06_22: {
        Row: {
          app_version: string | null
          created_at: string
          current_item_id: string | null
          device_id: string
          free_disk_bytes: number | null
          id: string
          last_error: string | null
          manifest_version: string | null
          memory_class_mb: number | null
          network_type: string | null
          os_version: string | null
          team_id: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          current_item_id?: string | null
          device_id?: string
          free_disk_bytes?: number | null
          id?: string
          last_error?: string | null
          manifest_version?: string | null
          memory_class_mb?: number | null
          network_type?: string | null
          os_version?: string | null
          team_id?: string | null
        }
        Relationships: []
      }
      device_playback_events: {
        Row: {
          asset_id: string | null
          cache_status: string | null
          created_at: string
          device_id: string
          duration_ms: number
          error_message: string | null
          event_type: string
          id: string
          item_id: string | null
          position_ms: number
          team_id: string | null
        }
        Insert: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id: string
          duration_ms?: number
          error_message?: string | null
          event_type: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Update: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id?: string
          duration_ms?: number
          error_message?: string | null
          event_type?: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_playback_events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_playback_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_playback_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      device_playback_events_y2026_06_12: {
        Row: {
          asset_id: string | null
          cache_status: string | null
          created_at: string
          device_id: string
          duration_ms: number
          error_message: string | null
          event_type: string
          id: string
          item_id: string | null
          position_ms: number
          team_id: string | null
        }
        Insert: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id: string
          duration_ms?: number
          error_message?: string | null
          event_type: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Update: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id?: string
          duration_ms?: number
          error_message?: string | null
          event_type?: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Relationships: []
      }
      device_playback_events_y2026_06_13: {
        Row: {
          asset_id: string | null
          cache_status: string | null
          created_at: string
          device_id: string
          duration_ms: number
          error_message: string | null
          event_type: string
          id: string
          item_id: string | null
          position_ms: number
          team_id: string | null
        }
        Insert: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id: string
          duration_ms?: number
          error_message?: string | null
          event_type: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Update: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id?: string
          duration_ms?: number
          error_message?: string | null
          event_type?: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Relationships: []
      }
      device_playback_events_y2026_06_14: {
        Row: {
          asset_id: string | null
          cache_status: string | null
          created_at: string
          device_id: string
          duration_ms: number
          error_message: string | null
          event_type: string
          id: string
          item_id: string | null
          position_ms: number
          team_id: string | null
        }
        Insert: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id: string
          duration_ms?: number
          error_message?: string | null
          event_type: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Update: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id?: string
          duration_ms?: number
          error_message?: string | null
          event_type?: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Relationships: []
      }
      device_playback_events_y2026_06_15: {
        Row: {
          asset_id: string | null
          cache_status: string | null
          created_at: string
          device_id: string
          duration_ms: number
          error_message: string | null
          event_type: string
          id: string
          item_id: string | null
          position_ms: number
          team_id: string | null
        }
        Insert: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id: string
          duration_ms?: number
          error_message?: string | null
          event_type: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Update: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id?: string
          duration_ms?: number
          error_message?: string | null
          event_type?: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Relationships: []
      }
      device_playback_events_y2026_06_16: {
        Row: {
          asset_id: string | null
          cache_status: string | null
          created_at: string
          device_id: string
          duration_ms: number
          error_message: string | null
          event_type: string
          id: string
          item_id: string | null
          position_ms: number
          team_id: string | null
        }
        Insert: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id: string
          duration_ms?: number
          error_message?: string | null
          event_type: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Update: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id?: string
          duration_ms?: number
          error_message?: string | null
          event_type?: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Relationships: []
      }
      device_playback_events_y2026_06_17: {
        Row: {
          asset_id: string | null
          cache_status: string | null
          created_at: string
          device_id: string
          duration_ms: number
          error_message: string | null
          event_type: string
          id: string
          item_id: string | null
          position_ms: number
          team_id: string | null
        }
        Insert: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id: string
          duration_ms?: number
          error_message?: string | null
          event_type: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Update: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id?: string
          duration_ms?: number
          error_message?: string | null
          event_type?: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Relationships: []
      }
      device_playback_events_y2026_06_18: {
        Row: {
          asset_id: string | null
          cache_status: string | null
          created_at: string
          device_id: string
          duration_ms: number
          error_message: string | null
          event_type: string
          id: string
          item_id: string | null
          position_ms: number
          team_id: string | null
        }
        Insert: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id: string
          duration_ms?: number
          error_message?: string | null
          event_type: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Update: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id?: string
          duration_ms?: number
          error_message?: string | null
          event_type?: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Relationships: []
      }
      device_playback_events_y2026_06_19: {
        Row: {
          asset_id: string | null
          cache_status: string | null
          created_at: string
          device_id: string
          duration_ms: number
          error_message: string | null
          event_type: string
          id: string
          item_id: string | null
          position_ms: number
          team_id: string | null
        }
        Insert: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id: string
          duration_ms?: number
          error_message?: string | null
          event_type: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Update: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id?: string
          duration_ms?: number
          error_message?: string | null
          event_type?: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Relationships: []
      }
      device_playback_events_y2026_06_20: {
        Row: {
          asset_id: string | null
          cache_status: string | null
          created_at: string
          device_id: string
          duration_ms: number
          error_message: string | null
          event_type: string
          id: string
          item_id: string | null
          position_ms: number
          team_id: string | null
        }
        Insert: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id: string
          duration_ms?: number
          error_message?: string | null
          event_type: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Update: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id?: string
          duration_ms?: number
          error_message?: string | null
          event_type?: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Relationships: []
      }
      device_playback_events_y2026_06_21: {
        Row: {
          asset_id: string | null
          cache_status: string | null
          created_at: string
          device_id: string
          duration_ms: number
          error_message: string | null
          event_type: string
          id: string
          item_id: string | null
          position_ms: number
          team_id: string | null
        }
        Insert: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id: string
          duration_ms?: number
          error_message?: string | null
          event_type: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Update: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id?: string
          duration_ms?: number
          error_message?: string | null
          event_type?: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Relationships: []
      }
      device_playback_events_y2026_06_22: {
        Row: {
          asset_id: string | null
          cache_status: string | null
          created_at: string
          device_id: string
          duration_ms: number
          error_message: string | null
          event_type: string
          id: string
          item_id: string | null
          position_ms: number
          team_id: string | null
        }
        Insert: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id: string
          duration_ms?: number
          error_message?: string | null
          event_type: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Update: {
          asset_id?: string | null
          cache_status?: string | null
          created_at?: string
          device_id?: string
          duration_ms?: number
          error_message?: string | null
          event_type?: string
          id?: string
          item_id?: string | null
          position_ms?: number
          team_id?: string | null
        }
        Relationships: []
      }
      device_sessions: {
        Row: {
          device_id: string
          expires_at: string
          id: string
          issued_at: string
          last_seen_at: string | null
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          device_id: string
          expires_at: string
          id?: string
          issued_at?: string
          last_seen_at?: string | null
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          device_id?: string
          expires_at?: string
          id?: string
          issued_at?: string
          last_seen_at?: string | null
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_sessions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          app_version: string | null
          asset_id: string | null
          content: string | null
          content_type: string | null
          created_at: string
          current_manifest_version: string | null
          expires_at: string
          free_disk_bytes: number | null
          hardware_id: string | null
          id: string
          last_error: string | null
          last_seen_at: string | null
          memory_class_mb: number | null
          name: string | null
          network_type: string | null
          orientation: number | null
          os_version: string | null
          pairing_code: string
          playlist_id: string | null
          scale_mode: string | null
          secret: string | null
          status: string
          team_id: string | null
          total_playtime_seconds: number
          updated_at: string | null
        }
        Insert: {
          app_version?: string | null
          asset_id?: string | null
          content?: string | null
          content_type?: string | null
          created_at?: string
          current_manifest_version?: string | null
          expires_at?: string
          free_disk_bytes?: number | null
          hardware_id?: string | null
          id?: string
          last_error?: string | null
          last_seen_at?: string | null
          memory_class_mb?: number | null
          name?: string | null
          network_type?: string | null
          orientation?: number | null
          os_version?: string | null
          pairing_code: string
          playlist_id?: string | null
          scale_mode?: string | null
          secret?: string | null
          status?: string
          team_id?: string | null
          total_playtime_seconds?: number
          updated_at?: string | null
        }
        Update: {
          app_version?: string | null
          asset_id?: string | null
          content?: string | null
          content_type?: string | null
          created_at?: string
          current_manifest_version?: string | null
          expires_at?: string
          free_disk_bytes?: number | null
          hardware_id?: string | null
          id?: string
          last_error?: string | null
          last_seen_at?: string | null
          memory_class_mb?: number | null
          name?: string | null
          network_type?: string | null
          orientation?: number | null
          os_version?: string | null
          pairing_code?: string
          playlist_id?: string | null
          scale_mode?: string | null
          secret?: string | null
          status?: string
          team_id?: string | null
          total_playtime_seconds?: number
          updated_at?: string | null
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
          allowed_domains: string[] | null
          created_at: string | null
          historical_playtime_seconds: number
          id: string
          name: string
          slug: string
        }
        Insert: {
          allowed_domains?: string[] | null
          created_at?: string | null
          historical_playtime_seconds?: number
          id?: string
          name: string
          slug: string
        }
        Update: {
          allowed_domains?: string[] | null
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
      check_device_session_token: {
        Args: { p_device_id: string; p_token: string }
        Returns: boolean
      }
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
      exchange_device_secret_for_session: {
        Args: { p_device_id: string; p_hardware_id: string; p_secret: string }
        Returns: Json
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
        Args: {
          p_app_version?: string
          p_hardware_id: string
          p_os_version?: string
          p_secret?: string
        }
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
      get_player_signed_media_url_by_session: {
        Args: {
          p_device_id: string
          p_expires_in?: number
          p_file_path: string
          p_session_token: string
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
      manage_partitions: { Args: never; Returns: undefined }
      notify_devices_for_asset: {
        Args: { p_asset_id: string }
        Returns: undefined
      }
      notify_devices_for_playlist: {
        Args: { p_playlist_id: string }
        Returns: undefined
      }
      ping_device:
        | {
            Args: {
              p_device_id: string
              p_hardware_id: string
              p_secret: string
            }
            Returns: Json
          }
        | {
            Args: { p_device_id: string; p_session_token: string }
            Returns: Json
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
          app_version: string | null
          asset_id: string | null
          content: string | null
          content_type: string | null
          created_at: string
          current_manifest_version: string | null
          expires_at: string
          free_disk_bytes: number | null
          hardware_id: string | null
          id: string
          last_error: string | null
          last_seen_at: string | null
          memory_class_mb: number | null
          name: string | null
          network_type: string | null
          orientation: number | null
          os_version: string | null
          pairing_code: string
          playlist_id: string | null
          scale_mode: string | null
          secret: string | null
          status: string
          team_id: string | null
          total_playtime_seconds: number
          updated_at: string | null
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
        Returns: Json
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
      url_encode_path: { Args: { p_path: string }; Returns: string }
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
  public: {
    Enums: {},
  },
} as const
