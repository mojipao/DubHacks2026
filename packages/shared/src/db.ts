// Generated from Supabase project jxluhvblusfzrlktqaee. Regenerate after every migration; do not edit by hand.

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      conversations: {
        Row: {
          created_at: string
          customer_id: string | null
          handle: string
          id: string
          last_message_at: string
          photon_agent_user_id: string | null
          photon_space_id: string | null
          platform: string
          role: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          handle: string
          id?: string
          last_message_at?: string
          photon_agent_user_id?: string | null
          photon_space_id?: string | null
          platform?: string
          role?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          handle?: string
          id?: string
          last_message_at?: string
          photon_agent_user_id?: string | null
          photon_space_id?: string | null
          platform?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          handle: string | null
          id: string
          is_demo_persona: boolean
          name: string
          notes: string | null
          square_customer_id: string | null
        }
        Insert: {
          created_at?: string
          handle?: string | null
          id?: string
          is_demo_persona?: boolean
          name: string
          notes?: string | null
          square_customer_id?: string | null
        }
        Update: {
          created_at?: string
          handle?: string | null
          id?: string
          is_demo_persona?: boolean
          name?: string
          notes?: string | null
          square_customer_id?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          actor: string
          at: string
          data: Json
          id: number
          subject_id: string | null
          subject_type: string | null
          type: string
        }
        Insert: {
          actor: string
          at?: string
          data?: Json
          id?: number
          subject_id?: string | null
          subject_type?: string | null
          type: string
        }
        Update: {
          actor?: string
          at?: string
          data?: Json
          id?: number
          subject_id?: string | null
          subject_type?: string | null
          type?: string
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          id: string
          name: string
          on_hand: number
          on_order: number
          reorder_point: number
          supplier: string
          unit: string
          unit_cost_cents: number
        }
        Insert: {
          id: string
          name: string
          on_hand: number
          on_order?: number
          reorder_point: number
          supplier: string
          unit: string
          unit_cost_cents: number
        }
        Update: {
          id?: string
          name?: string
          on_hand?: number
          on_order?: number
          reorder_point?: number
          supplier?: string
          unit?: string
          unit_cost_cents?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          direction: string
          id: string
          photon_message_id: string | null
          status: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          photon_message_id?: string | null
          status: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          photon_message_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          order_id: string
          product_id: string
          qty: number
          unit_price_cents: number
        }
        Insert: {
          order_id: string
          product_id: string
          qty: number
          unit_price_cents: number
        }
        Update: {
          order_id?: string
          product_id?: string
          qty?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string | null
          discount_cents: number
          id: string
          paid_at: string | null
          payment_url: string | null
          pickup_at: string
          proposal_id: string | null
          source: string
          square_order_id: string | null
          square_payment_link_id: string | null
          status: string
          total_cents: number
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          discount_cents?: number
          id?: string
          paid_at?: string | null
          payment_url?: string | null
          pickup_at: string
          proposal_id?: string | null
          source: string
          square_order_id?: string | null
          square_payment_link_id?: string | null
          status: string
          total_cents: number
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          discount_cents?: number
          id?: string
          paid_at?: string | null
          payment_url?: string | null
          pickup_at?: string
          proposal_id?: string | null
          source?: string
          square_order_id?: string | null
          square_payment_link_id?: string | null
          status?: string
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      photon_cursor: {
        Row: {
          id: number
          seq: number
        }
        Insert: {
          id?: number
          seq?: number
        }
        Update: {
          id?: number
          seq?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          aliases: string[]
          category: string
          daily_capacity: number
          id: string
          name: string
          price_cents: number
        }
        Insert: {
          active?: boolean
          aliases?: string[]
          category: string
          daily_capacity: number
          id: string
          name: string
          price_cents: number
        }
        Update: {
          active?: boolean
          aliases?: string[]
          category?: string
          daily_capacity?: number
          id?: string
          name?: string
          price_cents?: number
        }
        Relationships: []
      }
      proposals: {
        Row: {
          agent: string
          confidence: number | null
          conversation_id: string | null
          created_at: string
          decided_at: string | null
          error: string | null
          evidence: Json
          executed_at: string | null
          id: string
          kind: string
          owner_notified_at: string | null
          parent_proposal_id: string | null
          payload: Json
          rationale: string
          reads: Json
          risk_flags: string[]
          short_code: string | null
          status: string
          summary: string
          title: string
          trigger_message_id: string | null
        }
        Insert: {
          agent: string
          confidence?: number | null
          conversation_id?: string | null
          created_at?: string
          decided_at?: string | null
          error?: string | null
          evidence?: Json
          executed_at?: string | null
          id?: string
          kind: string
          owner_notified_at?: string | null
          parent_proposal_id?: string | null
          payload: Json
          rationale?: string
          reads?: Json
          risk_flags?: string[]
          short_code?: string | null
          status?: string
          summary: string
          title: string
          trigger_message_id?: string | null
        }
        Update: {
          agent?: string
          confidence?: number | null
          conversation_id?: string | null
          created_at?: string
          decided_at?: string | null
          error?: string | null
          evidence?: Json
          executed_at?: string | null
          id?: string
          kind?: string
          owner_notified_at?: string | null
          parent_proposal_id?: string | null
          payload?: Json
          rationale?: string
          reads?: Json
          risk_flags?: string[]
          short_code?: string | null
          status?: string
          summary?: string
          title?: string
          trigger_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_parent_proposal_id_fkey"
            columns: ["parent_proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_trigger_message_id_fkey"
            columns: ["trigger_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_lines: {
        Row: {
          ingredient_id: string
          product_id: string
          qty_per_unit: number
        }
        Insert: {
          ingredient_id: string
          product_id: string
          qty_per_unit: number
        }
        Update: {
          ingredient_id?: string
          product_id?: string
          qty_per_unit?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_lines_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
