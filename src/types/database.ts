export type UserRole = "baymo_admin" | "admin" | "agent" | "viewer";

export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "lost";
export type LeadTemperature = "hot" | "warm" | "cold";
export type CampaignStatus = "draft" | "active" | "paused" | "completed";
export type CampaignChannel = "sms" | "email" | "messenger" | "viber";
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TaskType = "call" | "email" | "meeting" | "follow_up" | "other";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: UserRole;
  client_id?: string;
  is_active: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  company_name: string;
  email: string;
  phone?: string;
  webhook_secret?: string;
  integrations?: Record<string, any>;
  settings?: Record<string, any>;
  is_active: boolean;
  bamo_api_key?: string;
  bamo_webhook_url?: string;
  bamo_connected: boolean;
  created_at: string;
}

export interface Campaign {
  id: string;
  client_id: string;
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  target_action?: string;
  tone?: string;
  additional_instructions?: string;
  config?: Record<string, any>;
  email_subject?: string;
  email_template_id?: string;
  is_locked: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  client_id: string;
  campaign_id?: string;
  assigned_user_id?: string;
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  messenger_id?: string;
  viber_id?: string;
  bamo_user_id?: string;
  source?: string;
  source_override?: string;
  status: LeadStatus;
  lead_temperature?: LeadTemperature;
  lead_score?: number;
  tags?: string[];
  buyer_type?: string;
  last_message_at?: string;
  unread_count: number;
  next_follow_up_date?: string;
  last_contacted_at?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface LeadQualification {
  id: string;
  lead_id: string;
  client_id: string;
  budget_min?: number;
  budget_max?: number;
  preferred_location?: string[];
  property_type?: string;
  property_sub_type?: string;
  bedrooms?: number;
  floor_area_min?: number;
  lot_area_min?: number;
  unit_preferred?: string;
  purpose?: string;
  preferred_financing?: string;
  payment_scheme?: string;
  timeframe?: string;
  move_in_date?: string;
  income_source?: string;
  motivation?: string;
  hesitation?: string;
  decision_maker?: string;
  competing_projects?: string[];
  viewing_schedule?: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  lead_id?: string;
  client_id: string;
  assigned_to?: string;
  created_by: string;
  title: string;
  task_type: TaskType;
  notes?: string;
  due_date?: string;
  status: TaskStatus;
  triggered_by?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}