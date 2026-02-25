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
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
