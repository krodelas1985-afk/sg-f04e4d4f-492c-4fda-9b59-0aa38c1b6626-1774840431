 
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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      campaign_lead_assignments: {
        Row: {
          assigned_at: string | null
          campaign_id: string
          client_id: string
          id: string
          lead_id: string
          sequence_step: number | null
          status: string | null
        }
        Insert: {
          assigned_at?: string | null
          campaign_id: string
          client_id: string
          id?: string
          lead_id: string
          sequence_step?: number | null
          status?: string | null
        }
        Update: {
          assigned_at?: string | null
          campaign_id?: string
          client_id?: string
          id?: string
          lead_id?: string
          sequence_step?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_lead_assignments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_lead_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_lead_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          additional_instructions: string | null
          channel: string | null
          client_id: string
          config: Json | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          email_subject: string | null
          email_template_id: string | null
          end_date: string | null
          id: string
          is_locked: boolean | null
          job_titles: string[] | null
          name: string
          source_detail: string | null
          start_date: string | null
          status: string | null
          success_metric: string | null
          target_action: string | null
          target_industries: string[] | null
          tone: string | null
          updated_at: string | null
        }
        Insert: {
          additional_instructions?: string | null
          channel?: string | null
          client_id: string
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          email_subject?: string | null
          email_template_id?: string | null
          end_date?: string | null
          id?: string
          is_locked?: boolean | null
          job_titles?: string[] | null
          name: string
          source_detail?: string | null
          start_date?: string | null
          status?: string | null
          success_metric?: string | null
          target_action?: string | null
          target_industries?: string[] | null
          tone?: string | null
          updated_at?: string | null
        }
        Update: {
          additional_instructions?: string | null
          channel?: string | null
          client_id?: string
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          email_subject?: string | null
          email_template_id?: string | null
          end_date?: string | null
          id?: string
          is_locked?: boolean | null
          job_titles?: string[] | null
          name?: string
          source_detail?: string | null
          start_date?: string | null
          status?: string | null
          success_metric?: string | null
          target_action?: string | null
          target_industries?: string[] | null
          tone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          bamo_api_key: string | null
          bamo_connected: boolean | null
          bamo_webhook_url: string | null
          company_name: string | null
          created_at: string | null
          email: string | null
          id: string
          integrations: Json | null
          is_active: boolean | null
          name: string
          phone: string | null
          settings: Json | null
          webhook_secret: string | null
        }
        Insert: {
          bamo_api_key?: string | null
          bamo_connected?: boolean | null
          bamo_webhook_url?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          integrations?: Json | null
          is_active?: boolean | null
          name: string
          phone?: string | null
          settings?: Json | null
          webhook_secret?: string | null
        }
        Update: {
          bamo_api_key?: string | null
          bamo_connected?: boolean | null
          bamo_webhook_url?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          integrations?: Json | null
          is_active?: boolean | null
          name?: string
          phone?: string | null
          settings?: Json | null
          webhook_secret?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          channel: string | null
          client_id: string
          created_at: string | null
          delivery_status: string | null
          direction: string | null
          external_msg_id: string | null
          id: string
          intent_tag: string | null
          lead_id: string
          message_content: string | null
          sender: string | null
          sender_id: string | null
          sent_via: string | null
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          channel?: string | null
          client_id: string
          created_at?: string | null
          delivery_status?: string | null
          direction?: string | null
          external_msg_id?: string | null
          id?: string
          intent_tag?: string | null
          lead_id: string
          message_content?: string | null
          sender?: string | null
          sender_id?: string | null
          sent_via?: string | null
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          channel?: string | null
          client_id?: string
          created_at?: string | null
          delivery_status?: string | null
          direction?: string | null
          external_msg_id?: string | null
          id?: string
          intent_tag?: string | null
          lead_id?: string
          message_content?: string | null
          sender?: string | null
          sender_id?: string | null
          sent_via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string | null
          campaign_id: string | null
          client_id: string
          created_at: string | null
          id: string
          name: string
          subject: string | null
        }
        Insert: {
          body?: string | null
          campaign_id?: string | null
          client_id: string
          created_at?: string | null
          id?: string
          name: string
          subject?: string | null
        }
        Update: {
          body?: string | null
          campaign_id?: string | null
          client_id?: string
          created_at?: string | null
          id?: string
          name?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          client_id: string
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          lead_id: string
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_id: string
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_user_id: string | null
          bamo_user_id: string | null
          bedrooms: number | null
          budget_max: number | null
          budget_min: number | null
          buyer_type: string | null
          campaign_id: string | null
          client_id: string
          company: string | null
          created_at: string | null
          email: string | null
          id: string
          industry: string | null
          last_contacted_at: string | null
          last_message_at: string | null
          lead_score: number | null
          lead_temperature: string | null
          messenger_id: string | null
          metadata: Json | null
          name: string
          next_follow_up_date: string | null
          phone: string | null
          preferred_location: string | null
          primary_channel: string | null
          property_type: string | null
          source: string | null
          source_override: boolean | null
          status: string | null
          tags: string[] | null
          unread_count: number | null
          updated_at: string | null
          viber_id: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          bamo_user_id?: string | null
          bedrooms?: number | null
          budget_max?: number | null
          budget_min?: number | null
          buyer_type?: string | null
          campaign_id?: string | null
          client_id: string
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          last_contacted_at?: string | null
          last_message_at?: string | null
          lead_score?: number | null
          lead_temperature?: string | null
          messenger_id?: string | null
          metadata?: Json | null
          name: string
          next_follow_up_date?: string | null
          phone?: string | null
          preferred_location?: string | null
          primary_channel?: string | null
          property_type?: string | null
          source?: string | null
          source_override?: boolean | null
          status?: string | null
          tags?: string[] | null
          unread_count?: number | null
          updated_at?: string | null
          viber_id?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          bamo_user_id?: string | null
          bedrooms?: number | null
          budget_max?: number | null
          budget_min?: number | null
          buyer_type?: string | null
          campaign_id?: string | null
          client_id?: string
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          last_contacted_at?: string | null
          last_message_at?: string | null
          lead_score?: number | null
          lead_temperature?: string | null
          messenger_id?: string | null
          metadata?: Json | null
          name?: string
          next_follow_up_date?: string | null
          phone?: string | null
          preferred_location?: string | null
          primary_channel?: string | null
          property_type?: string | null
          source?: string | null
          source_override?: boolean | null
          status?: string | null
          tags?: string[] | null
          unread_count?: number | null
          updated_at?: string | null
          viber_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          client_id: string
          content: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          client_id: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          phone: string | null
          role: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          phone?: string | null
          role?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          phone?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_client_id_fk"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          client_id: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          due_date: string | null
          id: string
          lead_id: string
          notes: string | null
          status: string | null
          task_type: string | null
          title: string
          triggered_by: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          client_id: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          status?: string | null
          task_type?: string | null
          title: string
          triggered_by?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          client_id?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          status?: string | null
          task_type?: string | null
          title?: string
          triggered_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          client_id: string | null
          error_message: string | null
          id: string
          lead_id: string | null
          payload: Json | null
          received_at: string | null
          source: string | null
          status: string | null
        }
        Insert: {
          client_id?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          payload?: Json | null
          received_at?: string | null
          source?: string | null
          status?: string | null
        }
        Update: {
          client_id?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          payload?: Json | null
          received_at?: string | null
          source?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_leads_with_details: {
        Args: {
          p_assigned_user_id?: string
          p_campaign_id?: string
          p_client_id: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_source?: string
          p_stage?: string
          p_status?: string
        }
        Returns: {
          agent_name: string
          agent_role: string
          assigned_user_id: string
          bedrooms: number
          budget_max: number
          budget_min: number
          buyer_type: string
          campaign_id: string
          campaign_name: string
          client_id: string
          company: string
          created_at: string
          email: string
          id: string
          last_contacted_at: string
          last_message: string
          lead_score: number
          lead_temperature: string
          metadata: Json
          name: string
          next_follow_up_date: string
          next_task_title: string
          phone: string
          preferred_location: string
          property_type: string
          source: string
          source_override: boolean
          status: string
          updated_at: string
        }[]
      }
      get_my_client_id: { Args: never; Returns: string }
      get_my_role: { Args: never; Returns: string }
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
