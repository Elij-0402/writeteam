export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          genre: string | null
          cover_image_url: string | null
          word_count_goal: number | null
          preferred_model: string | null
          series_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          genre?: string | null
          cover_image_url?: string | null
          word_count_goal?: number | null
          preferred_model?: string | null
          series_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          genre?: string | null
          cover_image_url?: string | null
          word_count_goal?: number | null
          preferred_model?: string | null
          series_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          id: string
          project_id: string
          user_id: string
          title: string
          content: Json | null
          content_text: string | null
          word_count: number
          sort_order: number
          document_type: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          title: string
          content?: Json | null
          content_text?: string | null
          word_count?: number
          sort_order?: number
          document_type?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          title?: string
          content?: Json | null
          content_text?: string | null
          word_count?: number
          sort_order?: number
          document_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      characters: {
        Row: {
          id: string
          project_id: string
          user_id: string
          name: string
          role: string | null
          description: string | null
          personality: string | null
          appearance: string | null
          backstory: string | null
          goals: string | null
          relationships: string | null
          notes: string | null
          series_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          name: string
          role?: string | null
          description?: string | null
          personality?: string | null
          appearance?: string | null
          backstory?: string | null
          goals?: string | null
          relationships?: string | null
          notes?: string | null
          series_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          name?: string
          role?: string | null
          description?: string | null
          personality?: string | null
          appearance?: string | null
          backstory?: string | null
          goals?: string | null
          relationships?: string | null
          notes?: string | null
          series_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      story_bibles: {
        Row: {
          id: string
          project_id: string
          user_id: string
          braindump: string | null
          genre: string | null
          style: string | null
          prose_mode: string | null
          style_sample: string | null
          synopsis: string | null
          themes: string | null
          setting: string | null
          pov: string | null
          tense: string | null
          worldbuilding: string | null
          outline: Json | null
          notes: string | null
          tone: string | null
          ai_rules: string | null
          visibility: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          braindump?: string | null
          genre?: string | null
          style?: string | null
          prose_mode?: string | null
          style_sample?: string | null
          synopsis?: string | null
          themes?: string | null
          setting?: string | null
          pov?: string | null
          tense?: string | null
          worldbuilding?: string | null
          outline?: Json | null
          notes?: string | null
          tone?: string | null
          ai_rules?: string | null
          visibility?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          braindump?: string | null
          genre?: string | null
          style?: string | null
          prose_mode?: string | null
          style_sample?: string | null
          synopsis?: string | null
          themes?: string | null
          setting?: string | null
          pov?: string | null
          tense?: string | null
          worldbuilding?: string | null
          outline?: Json | null
          notes?: string | null
          tone?: string | null
          ai_rules?: string | null
          visibility?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_history: {
        Row: {
          id: string
          user_id: string
          project_id: string
          document_id: string | null
          feature: string
          prompt: string
          result: string
          model: string | null
          tokens_used: number | null
          latency_ms: number | null
          output_chars: number | null
          response_fingerprint: string | null
          user_rating: number | null
          rated_at: string | null
          error_type: string | null
          error_message: string | null
          is_retry: boolean | null
          recovery_status: string | null
          attempted_model: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id: string
          document_id?: string | null
          feature: string
          prompt: string
          result: string
          model?: string | null
          tokens_used?: number | null
          latency_ms?: number | null
          output_chars?: number | null
          response_fingerprint?: string | null
          user_rating?: number | null
          rated_at?: string | null
          error_type?: string | null
          error_message?: string | null
          is_retry?: boolean | null
          recovery_status?: string | null
          attempted_model?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string
          document_id?: string | null
          feature?: string
          prompt?: string
          result?: string
          model?: string | null
          tokens_used?: number | null
          latency_ms?: number | null
          output_chars?: number | null
          response_fingerprint?: string | null
          user_rating?: number | null
          rated_at?: string | null
          error_type?: string | null
          error_message?: string | null
          is_retry?: boolean | null
          recovery_status?: string | null
          attempted_model?: string | null
        }
        Relationships: []
      }
      plugins: {
        Row: {
          id: string
          user_id: string
          project_id: string | null
          name: string
          description: string | null
          system_prompt: string
          user_prompt_template: string
          requires_selection: boolean
          max_tokens: number
          temperature: number
          icon: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id?: string | null
          name: string
          description?: string | null
          system_prompt: string
          user_prompt_template: string
          requires_selection?: boolean
          max_tokens?: number
          temperature?: number
          icon?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string | null
          name?: string
          description?: string | null
          system_prompt?: string
          user_prompt_template?: string
          requires_selection?: boolean
          max_tokens?: number
          temperature?: number
          icon?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      series: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      series_bibles: {
        Row: {
          id: string
          series_id: string
          user_id: string
          genre: string | null
          style: string | null
          themes: string | null
          setting: string | null
          worldbuilding: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          series_id: string
          user_id: string
          genre?: string | null
          style?: string | null
          themes?: string | null
          setting?: string | null
          worldbuilding?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          series_id?: string
          user_id?: string
          genre?: string | null
          style?: string | null
          themes?: string | null
          setting?: string | null
          worldbuilding?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      canvas_nodes: {
        Row: {
          id: string
          project_id: string
          user_id: string
          node_type: string
          label: string
          content: string | null
          position_x: number
          position_y: number
          width: number
          height: number
          color: string | null
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          node_type: string
          label: string
          content?: string | null
          position_x?: number
          position_y?: number
          width?: number
          height?: number
          color?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          node_type?: string
          label?: string
          content?: string | null
          position_x?: number
          position_y?: number
          width?: number
          height?: number
          color?: string | null
          metadata?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      canvas_edges: {
        Row: {
          id: string
          project_id: string
          user_id: string
          source_node_id: string
          target_node_id: string
          label: string | null
          edge_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          source_node_id: string
          target_node_id: string
          label?: string | null
          edge_type?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          source_node_id?: string
          target_node_id?: string
          label?: string | null
          edge_type?: string | null
        }
        Relationships: []
      }
      images: {
        Row: {
          id: string
          project_id: string
          user_id: string
          prompt: string
          image_url: string
          style: string | null
          source_text: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          prompt: string
          image_url: string
          style?: string | null
          source_text?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          prompt?: string
          image_url?: string
          style?: string | null
          source_text?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reorder_documents: {
        Args: {
          p_project_id: string
          p_user_id: string
          p_ordered_document_ids: string[]
        }
        Returns: undefined
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

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type Document = Database['public']['Tables']['documents']['Row']
export type Character = Database['public']['Tables']['characters']['Row']
export type StoryBible = Database['public']['Tables']['story_bibles']['Row']
export type AIHistory = Database['public']['Tables']['ai_history']['Row']
export type Plugin = Database['public']['Tables']['plugins']['Row']
export type Series = Database['public']['Tables']['series']['Row']
export type SeriesBible = Database['public']['Tables']['series_bibles']['Row']
export type CanvasNode = Database['public']['Tables']['canvas_nodes']['Row']
export type CanvasEdge = Database['public']['Tables']['canvas_edges']['Row']
export type Image = Database['public']['Tables']['images']['Row']
