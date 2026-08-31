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
      ad_activity_log: {
        Row: {
          action: string
          client_id: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          meta: Json | null
          performed_by: string | null
          role: string | null
        }
        Insert: {
          action: string
          client_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          meta?: Json | null
          performed_by?: string | null
          role?: string | null
        }
        Update: {
          action?: string
          client_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          meta?: Json | null
          performed_by?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_activity_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_activity_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_analytics: {
        Row: {
          campaign_id: string | null
          clicks: number | null
          client_id: string | null
          cpc: number | null
          cpm: number | null
          date: string
          id: string
          impressions: number | null
          leads: number | null
          link_clicks: number | null
          meta_ad_id: string | null
          meta_ad_name: string | null
          meta_campaign_id: string | null
          meta_campaign_name: string | null
          reach: number | null
          spend: number | null
          synced_at: string
        }
        Insert: {
          campaign_id?: string | null
          clicks?: number | null
          client_id?: string | null
          cpc?: number | null
          cpm?: number | null
          date: string
          id?: string
          impressions?: number | null
          leads?: number | null
          link_clicks?: number | null
          meta_ad_id?: string | null
          meta_ad_name?: string | null
          meta_campaign_id?: string | null
          meta_campaign_name?: string | null
          reach?: number | null
          spend?: number | null
          synced_at?: string
        }
        Update: {
          campaign_id?: string | null
          clicks?: number | null
          client_id?: string | null
          cpc?: number | null
          cpm?: number | null
          date?: string
          id?: string
          impressions?: number | null
          leads?: number | null
          link_clicks?: number | null
          meta_ad_id?: string | null
          meta_ad_name?: string | null
          meta_campaign_id?: string | null
          meta_campaign_name?: string | null
          reach?: number | null
          spend?: number | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_analytics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_analytics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_campaigns: {
        Row: {
          audience_config: Json | null
          budget_daily: number | null
          budget_total: number | null
          client_id: string | null
          content_id: string | null
          created_at: string | null
          creative_id: string | null
          ends_at: string | null
          id: string
          launched_at: string | null
          launched_by: string | null
          listing_id: string | null
          meta_ad_id: string | null
          meta_adset_id: string | null
          meta_campaign_id: string | null
          name: string
          objective: string | null
          placement: string[] | null
          social_account_id: string | null
          starts_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          audience_config?: Json | null
          budget_daily?: number | null
          budget_total?: number | null
          client_id?: string | null
          content_id?: string | null
          created_at?: string | null
          creative_id?: string | null
          ends_at?: string | null
          id?: string
          launched_at?: string | null
          launched_by?: string | null
          listing_id?: string | null
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          name: string
          objective?: string | null
          placement?: string[] | null
          social_account_id?: string | null
          starts_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          audience_config?: Json | null
          budget_daily?: number | null
          budget_total?: number | null
          client_id?: string | null
          content_id?: string | null
          created_at?: string | null
          creative_id?: string | null
          ends_at?: string | null
          id?: string
          launched_at?: string | null
          launched_by?: string | null
          listing_id?: string | null
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          name?: string
          objective?: string | null
          placement?: string[] | null
          social_account_id?: string | null
          starts_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_campaigns_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "ad_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_campaigns_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_campaigns_launched_by_fkey"
            columns: ["launched_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_campaigns_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ad_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_campaigns_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "ad_social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_content: {
        Row: {
          ai_generated: boolean | null
          caption: string | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          cta: string | null
          hashtags: string[] | null
          hook: string | null
          id: string
          listing_id: string | null
          platform: string | null
          status: string | null
          target_audience: string | null
          title: string | null
          tone: string | null
          updated_at: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          caption?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          cta?: string | null
          hashtags?: string[] | null
          hook?: string | null
          id?: string
          listing_id?: string | null
          platform?: string | null
          status?: string | null
          target_audience?: string | null
          title?: string | null
          tone?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          caption?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          cta?: string | null
          hashtags?: string[] | null
          hook?: string | null
          id?: string
          listing_id?: string | null
          platform?: string | null
          status?: string | null
          target_audience?: string | null
          title?: string | null
          tone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_content_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_content_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_creatives: {
        Row: {
          asset_url: string
          client_id: string | null
          content_id: string | null
          created_at: string | null
          duration_seconds: number | null
          height: number | null
          id: string
          render_job_id: string | null
          source: string
          status: string | null
          thumbnail_url: string | null
          type: string
          width: number | null
        }
        Insert: {
          asset_url: string
          client_id?: string | null
          content_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          height?: number | null
          id?: string
          render_job_id?: string | null
          source: string
          status?: string | null
          thumbnail_url?: string | null
          type: string
          width?: number | null
        }
        Update: {
          asset_url?: string
          client_id?: string | null
          content_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          height?: number | null
          id?: string
          render_job_id?: string | null
          source?: string
          status?: string | null
          thumbnail_url?: string | null
          type?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_creatives_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_creatives_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "ad_content"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_listings: {
        Row: {
          agent_email: string | null
          agent_name: string | null
          agent_phone: string | null
          agent_photo_url: string | null
          agent_prc_number: string | null
          bathrooms: number | null
          bedrooms: number | null
          city: string | null
          client_id: string | null
          description: string | null
          floor_area: number | null
          id: string
          listing_url: string | null
          location: string | null
          lot_area: number | null
          marketplace_listing_id: string
          photo_urls: string[] | null
          price: number | null
          primary_photo_url: string | null
          property_name: string | null
          property_type: string | null
          snapshotted_at: string | null
        }
        Insert: {
          agent_email?: string | null
          agent_name?: string | null
          agent_phone?: string | null
          agent_photo_url?: string | null
          agent_prc_number?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          client_id?: string | null
          description?: string | null
          floor_area?: number | null
          id?: string
          listing_url?: string | null
          location?: string | null
          lot_area?: number | null
          marketplace_listing_id: string
          photo_urls?: string[] | null
          price?: number | null
          primary_photo_url?: string | null
          property_name?: string | null
          property_type?: string | null
          snapshotted_at?: string | null
        }
        Update: {
          agent_email?: string | null
          agent_name?: string | null
          agent_phone?: string | null
          agent_photo_url?: string | null
          agent_prc_number?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          client_id?: string | null
          description?: string | null
          floor_area?: number | null
          id?: string
          listing_url?: string | null
          location?: string | null
          lot_area?: number | null
          marketplace_listing_id?: string
          photo_urls?: string[] | null
          price?: number | null
          primary_photo_url?: string | null
          property_name?: string | null
          property_type?: string | null
          snapshotted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_listings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_music_tracks: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          is_active: boolean
          license_note: string | null
          mood: string | null
          name: string
          url: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          license_note?: string | null
          mood?: string | null
          name: string
          url: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          license_note?: string | null
          mood?: string | null
          name?: string
          url?: string
        }
        Relationships: []
      }
      ad_notifications: {
        Row: {
          client_id: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean | null
          message: string | null
          title: string
          type: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          title: string
          type: string
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_operator_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          fb_user_id: string
          fb_user_name: string | null
          id: string
          is_active: boolean
          scopes: string[] | null
          token_type: string
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          fb_user_id: string
          fb_user_name?: string | null
          id?: string
          is_active?: boolean
          scopes?: string[] | null
          token_type?: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          fb_user_id?: string
          fb_user_name?: string | null
          id?: string
          is_active?: boolean
          scopes?: string[] | null
          token_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      ad_posts: {
        Row: {
          client_id: string | null
          content_id: string | null
          created_at: string | null
          created_by: string | null
          creative_id: string | null
          error_message: string | null
          id: string
          link_url: string | null
          media_urls: string[] | null
          message: string | null
          meta_post_id: string | null
          platform: string
          post_type: string | null
          published_at: string | null
          retry_count: number
          scheduled_at: string | null
          social_account_id: string | null
          source: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          content_id?: string | null
          created_at?: string | null
          created_by?: string | null
          creative_id?: string | null
          error_message?: string | null
          id?: string
          link_url?: string | null
          media_urls?: string[] | null
          message?: string | null
          meta_post_id?: string | null
          platform: string
          post_type?: string | null
          published_at?: string | null
          retry_count?: number
          scheduled_at?: string | null
          social_account_id?: string | null
          source?: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          content_id?: string | null
          created_at?: string | null
          created_by?: string | null
          creative_id?: string | null
          error_message?: string | null
          id?: string
          link_url?: string | null
          media_urls?: string[] | null
          message?: string | null
          meta_post_id?: string | null
          platform?: string
          post_type?: string | null
          published_at?: string | null
          retry_count?: number
          scheduled_at?: string | null
          social_account_id?: string | null
          source?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_posts_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "ad_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_posts_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_posts_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "ad_social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_reports: {
        Row: {
          client_id: string
          created_at: string
          id: string
          model: string | null
          period_end: string
          period_start: string
          status: string
          summary: string | null
          totals: Json
          verdicts: Json
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          model?: string | null
          period_end: string
          period_start: string
          status?: string
          summary?: string | null
          totals?: Json
          verdicts?: Json
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          model?: string | null
          period_end?: string
          period_start?: string
          status?: string
          summary?: string | null
          totals?: Json
          verdicts?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ad_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_social_accounts: {
        Row: {
          access_token: string | null
          account_id: string
          account_name: string | null
          client_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          meta: Json | null
          platform: string
          token_expires_at: string | null
        }
        Insert: {
          access_token?: string | null
          account_id: string
          account_name?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          meta?: Json | null
          platform: string
          token_expires_at?: string | null
        }
        Update: {
          access_token?: string | null
          account_id?: string
          account_name?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          meta?: Json | null
          platform?: string
          token_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_social_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_templates: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          source: string
          supports_music: boolean
          template_id: string
          thumbnail_url: string | null
          type: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          source: string
          supports_music?: boolean
          template_id: string
          thumbnail_url?: string | null
          type: string
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          source?: string
          supports_music?: boolean
          template_id?: string
          thumbnail_url?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_usage_limits: {
        Row: {
          carousel_generated: number | null
          client_id: string | null
          id: string
          images_generated: number | null
          month: string
          videos_generated: number | null
        }
        Insert: {
          carousel_generated?: number | null
          client_id?: string | null
          id?: string
          images_generated?: number | null
          month: string
          videos_generated?: number | null
        }
        Update: {
          carousel_generated?: number | null
          client_id?: string | null
          id?: string
          images_generated?: number | null
          month?: string
          videos_generated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_usage_limits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_ai_metrics_snapshot: {
        Row: {
          computed_at: string
          days: number
          id: number
          payload: Json
        }
        Insert: {
          computed_at?: string
          days: number
          id?: number
          payload: Json
        }
        Update: {
          computed_at?: string
          days?: number
          id?: number
          payload?: Json
        }
        Relationships: []
      }
      agent_documents: {
        Row: {
          body: string
          client_id: string
          created_at: string
          created_by: string
          id: string
          lead_id: string | null
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          body?: string
          client_id: string
          created_at?: string
          created_by: string
          id?: string
          lead_id?: string | null
          status?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_listings: {
        Row: {
          bathrooms: number | null
          bedrooms: number | null
          city: string | null
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          floor_area: number | null
          id: string
          listing_type: string | null
          location: string | null
          lot_area: number | null
          photo_urls: string[]
          price: number | null
          property_type: string | null
          source: string
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          floor_area?: number | null
          id?: string
          listing_type?: string | null
          location?: string | null
          lot_area?: number | null
          photo_urls?: string[]
          price?: number | null
          property_type?: string | null
          source?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          floor_area?: number | null
          id?: string
          listing_type?: string | null
          location?: string | null
          lot_area?: number | null
          photo_urls?: string[]
          price?: number | null
          property_type?: string | null
          source?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agent_performance_scores: {
        Row: {
          assigned_count: number
          client_id: string
          composite_score: number | null
          computed_at: string
          conversion_score: number | null
          conversion_smoothed: number | null
          hustle_raw: number | null
          hustle_score: number | null
          id: string
          is_grace: boolean
          median_response_seconds: number | null
          open_leads: number
          responsiveness_score: number | null
          touches: number
          user_id: string
          weight: number | null
          window_days: number
          won_count: number
        }
        Insert: {
          assigned_count?: number
          client_id: string
          composite_score?: number | null
          computed_at?: string
          conversion_score?: number | null
          conversion_smoothed?: number | null
          hustle_raw?: number | null
          hustle_score?: number | null
          id?: string
          is_grace?: boolean
          median_response_seconds?: number | null
          open_leads?: number
          responsiveness_score?: number | null
          touches?: number
          user_id: string
          weight?: number | null
          window_days?: number
          won_count?: number
        }
        Update: {
          assigned_count?: number
          client_id?: string
          composite_score?: number | null
          computed_at?: string
          conversion_score?: number | null
          conversion_smoothed?: number | null
          hustle_raw?: number | null
          hustle_score?: number | null
          id?: string
          is_grace?: boolean
          median_response_seconds?: number | null
          open_leads?: number
          responsiveness_score?: number | null
          touches?: number
          user_id?: string
          weight?: number | null
          window_days?: number
          won_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_performance_scores_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_performance_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_website_requests: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          id: string
          note: string | null
          status: string
          type: string
          website_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by: string
          id?: string
          note?: string | null
          status?: string
          type: string
          website_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          status?: string
          type?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_website_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_website_requests_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "agent_websites"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_websites: {
        Row: {
          admin_stage: string | null
          agent_email: string | null
          agent_name: string | null
          agent_phone: string | null
          area_coverage: string | null
          assets_drive_url: string | null
          assigned_admin: string | null
          brief_generated_at: string | null
          build_notes: string | null
          client_id: string
          company: string | null
          created_by: string
          deploy_url: string | null
          deployed_at: string | null
          facts: string | null
          generated_brief: string | null
          hero_photo_url: string | null
          id: string
          linked_listing_ids: string[]
          messenger_link: string | null
          prc_number: string | null
          preflight_at: string | null
          preflight_report: Json | null
          repo_url: string | null
          requested_at: string
          site_config: Json | null
          status: string
          updated_at: string
          vercel_project_id: string | null
          website_url: string | null
          whatsapp_link: string | null
        }
        Insert: {
          admin_stage?: string | null
          agent_email?: string | null
          agent_name?: string | null
          agent_phone?: string | null
          area_coverage?: string | null
          assets_drive_url?: string | null
          assigned_admin?: string | null
          brief_generated_at?: string | null
          build_notes?: string | null
          client_id: string
          company?: string | null
          created_by: string
          deploy_url?: string | null
          deployed_at?: string | null
          facts?: string | null
          generated_brief?: string | null
          hero_photo_url?: string | null
          id?: string
          linked_listing_ids?: string[]
          messenger_link?: string | null
          prc_number?: string | null
          preflight_at?: string | null
          preflight_report?: Json | null
          repo_url?: string | null
          requested_at?: string
          site_config?: Json | null
          status?: string
          updated_at?: string
          vercel_project_id?: string | null
          website_url?: string | null
          whatsapp_link?: string | null
        }
        Update: {
          admin_stage?: string | null
          agent_email?: string | null
          agent_name?: string | null
          agent_phone?: string | null
          area_coverage?: string | null
          assets_drive_url?: string | null
          assigned_admin?: string | null
          brief_generated_at?: string | null
          build_notes?: string | null
          client_id?: string
          company?: string | null
          created_by?: string
          deploy_url?: string | null
          deployed_at?: string | null
          facts?: string | null
          generated_brief?: string | null
          hero_photo_url?: string | null
          id?: string
          linked_listing_ids?: string[]
          messenger_link?: string | null
          prc_number?: string | null
          preflight_at?: string | null
          preflight_report?: Json | null
          repo_url?: string | null
          requested_at?: string
          site_config?: Json | null
          status?: string
          updated_at?: string
          vercel_project_id?: string | null
          website_url?: string | null
          whatsapp_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_websites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_followup_step_media: {
        Row: {
          created_at: string
          id: string
          media_description: string | null
          media_type: string
          media_url: string
          playbook_step: number
          sequence_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_description?: string | null
          media_type: string
          media_url: string
          playbook_step: number
          sequence_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          media_description?: string | null
          media_type?: string
          media_url?: string
          playbook_step?: number
          sequence_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_followup_step_media_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          client_id: string
          count: number
          period_month: string
          updated_at: string
        }
        Insert: {
          client_id: string
          count?: number
          period_month: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          count?: number
          period_month?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          client_id: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          pinned: boolean
          scope: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          pinned?: boolean
          scope?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          pinned?: boolean
          scope?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_type: string
          client_id: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          lead_id: string | null
          location: string | null
          notes: string | null
          reminded_day_at: string | null
          reminded_hour_at: string | null
          resolution_confidence: string | null
          resolved_from: string | null
          scheduled_at: string
          source: string
          source_text: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          appointment_type: string
          client_id: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          notes?: string | null
          reminded_day_at?: string | null
          reminded_hour_at?: string | null
          resolution_confidence?: string | null
          resolved_from?: string | null
          scheduled_at: string
          source?: string
          source_text?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          appointment_type?: string
          client_id?: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          notes?: string | null
          reminded_day_at?: string | null
          reminded_hour_at?: string | null
          resolution_confidence?: string | null
          resolved_from?: string | null
          scheduled_at?: string
          source?: string
          source_text?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      bamo_entity_registry: {
        Row: {
          canonical_name: string
          country_code: string
          created_at: string
          created_by_profile_id: string | null
          entity_type: string
          id: string
          notes: string | null
          registration_number: string | null
          status: string
          superseded_by_entity_id: string | null
          updated_at: string
        }
        Insert: {
          canonical_name: string
          country_code?: string
          created_at?: string
          created_by_profile_id?: string | null
          entity_type: string
          id?: string
          notes?: string | null
          registration_number?: string | null
          status?: string
          superseded_by_entity_id?: string | null
          updated_at?: string
        }
        Update: {
          canonical_name?: string
          country_code?: string
          created_at?: string
          created_by_profile_id?: string | null
          entity_type?: string
          id?: string
          notes?: string | null
          registration_number?: string | null
          status?: string
          superseded_by_entity_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bamo_entity_registry_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bamo_entity_registry_superseded_by_entity_id_fkey"
            columns: ["superseded_by_entity_id"]
            isOneToOne: false
            referencedRelation: "bamo_entity_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      bamo_registry_auth_log: {
        Row: {
          first_seen_at: string
          last_seen_at: string
          minute_bucket: string
          occurrences: number
          operation: string
          outcome: string
          presented_caller: string
        }
        Insert: {
          first_seen_at?: string
          last_seen_at?: string
          minute_bucket: string
          occurrences?: number
          operation: string
          outcome: string
          presented_caller: string
        }
        Update: {
          first_seen_at?: string
          last_seen_at?: string
          minute_bucket?: string
          occurrences?: number
          operation?: string
          outcome?: string
          presented_caller?: string
        }
        Relationships: []
      }
      bamo_registry_callers: {
        Row: {
          caller: string
          created_at: string
          description: string | null
          is_active: boolean
          updated_at: string
          vault_secret_name: string
        }
        Insert: {
          caller: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          updated_at?: string
          vault_secret_name: string
        }
        Update: {
          caller?: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          updated_at?: string
          vault_secret_name?: string
        }
        Relationships: []
      }
      bamo_registry_nonces: {
        Row: {
          caller: string
          nonce: string
          seen_at: string
        }
        Insert: {
          caller: string
          nonce: string
          seen_at?: string
        }
        Update: {
          caller?: string
          nonce?: string
          seen_at?: string
        }
        Relationships: []
      }
      campaign_knowledge_base: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          availability_status: string | null
          campaign_id: string
          campaign_name: string | null
          client_id: string
          content: string
          created_at: string
          fields: Json | null
          id: string
          is_active: boolean
          promo_valid_until: string | null
          proposed_content: string | null
          raw_document_path: string | null
          raw_document_paths: Json | null
          replaces_kb_id: string | null
          review_notes: string | null
          review_status: string
          scope: string
          source_label: string | null
          source_text: string | null
          source_type: string | null
          source_url: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          availability_status?: string | null
          campaign_id: string
          campaign_name?: string | null
          client_id: string
          content: string
          created_at?: string
          fields?: Json | null
          id?: string
          is_active?: boolean
          promo_valid_until?: string | null
          proposed_content?: string | null
          raw_document_path?: string | null
          raw_document_paths?: Json | null
          replaces_kb_id?: string | null
          review_notes?: string | null
          review_status?: string
          scope?: string
          source_label?: string | null
          source_text?: string | null
          source_type?: string | null
          source_url?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          availability_status?: string | null
          campaign_id?: string
          campaign_name?: string | null
          client_id?: string
          content?: string
          created_at?: string
          fields?: Json | null
          id?: string
          is_active?: boolean
          promo_valid_until?: string | null
          proposed_content?: string | null
          raw_document_path?: string | null
          raw_document_paths?: Json | null
          replaces_kb_id?: string | null
          review_notes?: string | null
          review_status?: string
          scope?: string
          source_label?: string | null
          source_text?: string | null
          source_type?: string | null
          source_url?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_knowledge_base_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_knowledge_base_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_knowledge_base_replaces_kb_id_fkey"
            columns: ["replaces_kb_id"]
            isOneToOne: false
            referencedRelation: "campaign_knowledge_base"
            referencedColumns: ["id"]
          },
        ]
      }
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
      campaign_prompt_backup_20260807: {
        Row: {
          ai_message_instructions: string | null
          backed_up_at: string
          campaign_id: string
          id: string
          note: string | null
        }
        Insert: {
          ai_message_instructions?: string | null
          backed_up_at?: string
          campaign_id: string
          id?: string
          note?: string | null
        }
        Update: {
          ai_message_instructions?: string | null
          backed_up_at?: string
          campaign_id?: string
          id?: string
          note?: string | null
        }
        Relationships: []
      }
      campaign_prompt_backup_20260809: {
        Row: {
          ai_message_instructions: string | null
          id: string | null
          name: string | null
          taken_at: string | null
        }
        Insert: {
          ai_message_instructions?: string | null
          id?: string | null
          name?: string | null
          taken_at?: string | null
        }
        Update: {
          ai_message_instructions?: string | null
          id?: string | null
          name?: string | null
          taken_at?: string | null
        }
        Relationships: []
      }
      campaign_prompt_backup_20260814: {
        Row: {
          ai_message_instructions: string | null
          backed_up_at: string | null
          campaign_id: string | null
        }
        Insert: {
          ai_message_instructions?: string | null
          backed_up_at?: string | null
          campaign_id?: string | null
        }
        Update: {
          ai_message_instructions?: string | null
          backed_up_at?: string | null
          campaign_id?: string | null
        }
        Relationships: []
      }
      campaign_requests: {
        Row: {
          ad_campaign_id: string | null
          budget_range: string
          client_id: string
          created_at: string | null
          created_by: string | null
          creative_id: string | null
          duration_days: number
          goal: string
          id: string
          listing_id: string | null
          notes: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          ad_campaign_id?: string | null
          budget_range: string
          client_id: string
          created_at?: string | null
          created_by?: string | null
          creative_id?: string | null
          duration_days?: number
          goal: string
          id?: string
          listing_id?: string | null
          notes?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          ad_campaign_id?: string | null
          budget_range?: string
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          creative_id?: string | null
          duration_days?: number
          goal?: string
          id?: string
          listing_id?: string | null
          notes?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_requests_ad_campaign_id_fkey"
            columns: ["ad_campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_requests_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "ad_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "agent_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_steps: {
        Row: {
          ai_screen_before_send: boolean
          campaign_id: string
          channel: string | null
          client_id: string
          created_at: string
          delay_hours: number
          id: string
          is_active: boolean
          message_template: string | null
          notification_message: string | null
          step_order: number
          step_type: string
          updated_at: string
        }
        Insert: {
          ai_screen_before_send?: boolean
          campaign_id: string
          channel?: string | null
          client_id: string
          created_at?: string
          delay_hours?: number
          id?: string
          is_active?: boolean
          message_template?: string | null
          notification_message?: string | null
          step_order: number
          step_type: string
          updated_at?: string
        }
        Update: {
          ai_screen_before_send?: boolean
          campaign_id?: string
          channel?: string | null
          client_id?: string
          created_at?: string
          delay_hours?: number
          id?: string
          is_active?: boolean
          message_template?: string | null
          notification_message?: string | null
          step_order?: number
          step_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_steps_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          additional_instructions: string | null
          ai_decision_instructions: string | null
          ai_instruction: string | null
          ai_message_instructions: string | null
          automation_scope: string
          campaign_rules: Json | null
          campaign_type: string
          channel: string | null
          client_id: string
          config: Json | null
          conversational_ai_enabled: boolean
          created_at: string | null
          created_by: string | null
          currency: string | null
          email_subject: string | null
          email_template_id: string | null
          end_date: string | null
          enrollment_rules: Json | null
          id: string
          intro_line: string | null
          is_active: boolean | null
          is_locked: boolean | null
          is_organic_owner: boolean
          job_titles: string[] | null
          name: string
          priority: number
          scheduled_steps_enabled: boolean
          scoped_ref: Json | null
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
          ai_decision_instructions?: string | null
          ai_instruction?: string | null
          ai_message_instructions?: string | null
          automation_scope?: string
          campaign_rules?: Json | null
          campaign_type?: string
          channel?: string | null
          client_id: string
          config?: Json | null
          conversational_ai_enabled?: boolean
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          email_subject?: string | null
          email_template_id?: string | null
          end_date?: string | null
          enrollment_rules?: Json | null
          id?: string
          intro_line?: string | null
          is_active?: boolean | null
          is_locked?: boolean | null
          is_organic_owner?: boolean
          job_titles?: string[] | null
          name: string
          priority?: number
          scheduled_steps_enabled?: boolean
          scoped_ref?: Json | null
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
          ai_decision_instructions?: string | null
          ai_instruction?: string | null
          ai_message_instructions?: string | null
          automation_scope?: string
          campaign_rules?: Json | null
          campaign_type?: string
          channel?: string | null
          client_id?: string
          config?: Json | null
          conversational_ai_enabled?: boolean
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          email_subject?: string | null
          email_template_id?: string | null
          end_date?: string | null
          enrollment_rules?: Json | null
          id?: string
          intro_line?: string | null
          is_active?: boolean | null
          is_locked?: boolean | null
          is_organic_owner?: boolean
          job_titles?: string[] | null
          name?: string
          priority?: number
          scheduled_steps_enabled?: boolean
          scoped_ref?: Json | null
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
      client_assets: {
        Row: {
          alt_text: string | null
          caption: string | null
          client_id: string | null
          created_at: string | null
          duration_seconds: number | null
          file_name: string
          file_size_bytes: number | null
          file_type: string
          folder: string | null
          height: number | null
          id: string
          mime_type: string | null
          public_url: string
          storage_path: string
          tags: string[] | null
          thumbnail_url: string | null
          updated_at: string | null
          uploaded_by: string | null
          usage_count: number | null
          used_in_creatives: boolean | null
          used_in_posts: boolean | null
          used_in_website: boolean | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          caption?: string | null
          client_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          file_name: string
          file_size_bytes?: number | null
          file_type: string
          folder?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          public_url: string
          storage_path: string
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          usage_count?: number | null
          used_in_creatives?: boolean | null
          used_in_posts?: boolean | null
          used_in_website?: boolean | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          caption?: string | null
          client_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          file_name?: string
          file_size_bytes?: number | null
          file_type?: string
          folder?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          public_url?: string
          storage_path?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          usage_count?: number | null
          used_in_creatives?: boolean | null
          used_in_posts?: boolean | null
          used_in_website?: boolean | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assets_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_campaigns: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          campaign_id: string
          client_id: string
          id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          campaign_id: string
          client_id: string
          id?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          campaign_id?: string
          client_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_campaigns_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_onboarding: {
        Row: {
          answers: Json
          business_type: string | null
          client_id: string | null
          company_name: string | null
          created_at: string
          current_step: number
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          profile_id: string | null
          reviewed_at: string | null
          source: string
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          answers?: Json
          business_type?: string | null
          client_id?: string | null
          company_name?: string | null
          created_at?: string
          current_step?: number
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          profile_id?: string | null
          reviewed_at?: string | null
          source?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          answers?: Json
          business_type?: string | null
          client_id?: string | null
          company_name?: string | null
          created_at?: string
          current_step?: number
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          profile_id?: string | null
          reviewed_at?: string | null
          source?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_onboarding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_onboarding_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_reference_documents: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          extracted_chars: number
          extracted_text: string
          file_type: string
          filename: string
          id: string
          size_bytes: number
          storage_path: string
          truncated: boolean
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          extracted_chars: number
          extracted_text: string
          file_type: string
          filename: string
          id?: string
          size_bytes: number
          storage_path: string
          truncated?: boolean
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          extracted_chars?: number
          extracted_text?: string
          file_type?: string
          filename?: string
          id?: string
          size_bytes?: number
          storage_path?: string
          truncated?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "client_reference_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          ad_account_id: string | null
          ads_enabled: boolean | null
          ads_plan: string | null
          ads_plan_started_at: string | null
          assignment_mode: string
          assignment_sources: string[] | null
          bamo_api_key: string | null
          bamo_connected: boolean | null
          bamo_webhook_url: string | null
          business_industry: string | null
          business_type: string | null
          company_name: string | null
          created_at: string | null
          email: string | null
          fb_page_id: string | null
          fb_page_token: string | null
          id: string
          integrations: Json | null
          is_active: boolean | null
          name: string
          phone: string | null
          plan: string
          settings: Json | null
          webhook_secret: string | null
        }
        Insert: {
          ad_account_id?: string | null
          ads_enabled?: boolean | null
          ads_plan?: string | null
          ads_plan_started_at?: string | null
          assignment_mode?: string
          assignment_sources?: string[] | null
          bamo_api_key?: string | null
          bamo_connected?: boolean | null
          bamo_webhook_url?: string | null
          business_industry?: string | null
          business_type?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          fb_page_id?: string | null
          fb_page_token?: string | null
          id?: string
          integrations?: Json | null
          is_active?: boolean | null
          name: string
          phone?: string | null
          plan?: string
          settings?: Json | null
          webhook_secret?: string | null
        }
        Update: {
          ad_account_id?: string | null
          ads_enabled?: boolean | null
          ads_plan?: string | null
          ads_plan_started_at?: string | null
          assignment_mode?: string
          assignment_sources?: string[] | null
          bamo_api_key?: string | null
          bamo_connected?: boolean | null
          bamo_webhook_url?: string | null
          business_industry?: string | null
          business_type?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          fb_page_id?: string | null
          fb_page_token?: string | null
          id?: string
          integrations?: Json | null
          is_active?: boolean | null
          name?: string
          phone?: string | null
          plan?: string
          settings?: Json | null
          webhook_secret?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          ai_decision: string | null
          ai_reason: string | null
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
          lead_score: number | null
          lead_temperature: string | null
          message_content: string | null
          sender: string | null
          sender_id: string | null
          sent_via: string | null
        }
        Insert: {
          ai_decision?: string | null
          ai_reason?: string | null
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
          lead_score?: number | null
          lead_temperature?: string | null
          message_content?: string | null
          sender?: string | null
          sender_id?: string | null
          sent_via?: string | null
        }
        Update: {
          ai_decision?: string | null
          ai_reason?: string | null
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
          lead_score?: number | null
          lead_temperature?: string | null
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
      creative_jobs: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string | null
          creative_id: string | null
          error_message: string | null
          id: string
          job_id: string | null
          job_type: string
          last_polled_at: string | null
          max_polls: number | null
          poll_count: number | null
          progress_percent: number | null
          request_payload: Json
          response_payload: Json | null
          result_url: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string | null
          creative_id?: string | null
          error_message?: string | null
          id?: string
          job_id?: string | null
          job_type: string
          last_polled_at?: string | null
          max_polls?: number | null
          poll_count?: number | null
          progress_percent?: number | null
          request_payload: Json
          response_payload?: Json | null
          result_url?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string | null
          creative_id?: string | null
          error_message?: string | null
          id?: string
          job_id?: string | null
          job_type?: string
          last_polled_at?: string | null
          max_polls?: number | null
          poll_count?: number | null
          progress_percent?: number | null
          request_payload?: Json
          response_payload?: Json | null
          result_url?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_jobs_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_prompts: {
        Row: {
          client_id: string
          created_at: string | null
          creative_type: string
          generation_method: string
          id: string
          is_favorite: boolean | null
          prompt_text: string
          template_id: string | null
          updated_at: string | null
          use_count: number | null
          variant_count: number | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          creative_type: string
          generation_method: string
          id?: string
          is_favorite?: boolean | null
          prompt_text: string
          template_id?: string | null
          updated_at?: string | null
          use_count?: number | null
          variant_count?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          creative_type?: string
          generation_method?: string
          id?: string
          is_favorite?: boolean | null
          prompt_text?: string
          template_id?: string | null
          updated_at?: string | null
          use_count?: number | null
          variant_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_prompts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_prompts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "ad_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      creatives: {
        Row: {
          asset_url: string
          client_id: string
          created_at: string | null
          creative_type: string
          deleted_at: string | null
          dimensions: string | null
          duration_seconds: number | null
          file_size_bytes: number | null
          generation_method: string
          id: string
          job_error_message: string | null
          job_id: string | null
          job_status: string | null
          metadata: Json | null
          original_filename: string | null
          parent_creative_id: string | null
          prompt_id: string | null
          render_job_id: string | null
          thumbnail_url: string | null
          updated_at: string | null
          variant_index: number | null
        }
        Insert: {
          asset_url: string
          client_id: string
          created_at?: string | null
          creative_type: string
          deleted_at?: string | null
          dimensions?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          generation_method: string
          id?: string
          job_error_message?: string | null
          job_id?: string | null
          job_status?: string | null
          metadata?: Json | null
          original_filename?: string | null
          parent_creative_id?: string | null
          prompt_id?: string | null
          render_job_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          variant_index?: number | null
        }
        Update: {
          asset_url?: string
          client_id?: string
          created_at?: string | null
          creative_type?: string
          deleted_at?: string | null
          dimensions?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          generation_method?: string
          id?: string
          job_error_message?: string | null
          job_id?: string | null
          job_status?: string | null
          metadata?: Json | null
          original_filename?: string | null
          parent_creative_id?: string | null
          prompt_id?: string | null
          render_job_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          variant_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "creatives_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creatives_parent_creative_id_fkey"
            columns: ["parent_creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creatives_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "creative_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_digest_emails: {
        Row: {
          client_id: string
          created_at: string
          digest_date: string
          error: string | null
          id: string
          provider_id: string | null
          status: string
          subject: string | null
          to_emails: string[] | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          digest_date: string
          error?: string | null
          id?: string
          provider_id?: string | null
          status?: string
          subject?: string | null
          to_emails?: string[] | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          digest_date?: string
          error?: string | null
          id?: string
          provider_id?: string | null
          status?: string
          subject?: string | null
          to_emails?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_digest_emails_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_digests: {
        Row: {
          client_id: string
          created_at: string
          digest_date: string
          id: string
          metrics: Json
          suggestions: Json
        }
        Insert: {
          client_id: string
          created_at?: string
          digest_date: string
          id?: string
          metrics?: Json
          suggestions?: Json
        }
        Update: {
          client_id?: string
          created_at?: string
          digest_date?: string
          id?: string
          metrics?: Json
          suggestions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "daily_digests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
      enrollment_rules: {
        Row: {
          ai_outbound_min_hours: number | null
          conversation_stage_filter: string[] | null
          created_at: string | null
          enabled: boolean | null
          fb_ad_id_filter: string[] | null
          id: string
          inactivity_days: number | null
          last_contacted_min_hours: number | null
          last_inbound_max_hours: number | null
          pipeline_stage_filter: string[] | null
          quality_filter: string[] | null
          rule_name: string
          sequence_id: string
          source_filter: string[] | null
          temperature_filter: string[] | null
          updated_at: string | null
        }
        Insert: {
          ai_outbound_min_hours?: number | null
          conversation_stage_filter?: string[] | null
          created_at?: string | null
          enabled?: boolean | null
          fb_ad_id_filter?: string[] | null
          id?: string
          inactivity_days?: number | null
          last_contacted_min_hours?: number | null
          last_inbound_max_hours?: number | null
          pipeline_stage_filter?: string[] | null
          quality_filter?: string[] | null
          rule_name: string
          sequence_id: string
          source_filter?: string[] | null
          temperature_filter?: string[] | null
          updated_at?: string | null
        }
        Update: {
          ai_outbound_min_hours?: number | null
          conversation_stage_filter?: string[] | null
          created_at?: string | null
          enabled?: boolean | null
          fb_ad_id_filter?: string[] | null
          id?: string
          inactivity_days?: number | null
          last_contacted_min_hours?: number | null
          last_inbound_max_hours?: number | null
          pipeline_stage_filter?: string[] | null
          quality_filter?: string[] | null
          rule_name?: string
          sequence_id?: string
          source_filter?: string[] | null
          temperature_filter?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_rules_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_decisions: {
        Row: {
          client_id: string
          context_snapshot: Json | null
          created_at: string
          decision: string
          enrollment_id: string
          goal_status: string | null
          id: string
          lead_id: string
          message_sent: string | null
          reason: string | null
          window_open: boolean | null
        }
        Insert: {
          client_id: string
          context_snapshot?: Json | null
          created_at?: string
          decision: string
          enrollment_id: string
          goal_status?: string | null
          id?: string
          lead_id: string
          message_sent?: string | null
          reason?: string | null
          window_open?: boolean | null
        }
        Update: {
          client_id?: string
          context_snapshot?: Json | null
          created_at?: string
          decision?: string
          enrollment_id?: string
          goal_status?: string | null
          id?: string
          lead_id?: string
          message_sent?: string | null
          reason?: string | null
          window_open?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_decisions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_decisions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "sequence_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_decisions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_requests: {
        Row: {
          action: string
          admin_notes: string | null
          campaign_id: string | null
          client_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          duration_days: number | null
          id: string
          notes: string | null
          requested_by: string
          status: string
          style: string | null
          updated_at: string
        }
        Insert: {
          action?: string
          admin_notes?: string | null
          campaign_id?: string | null
          client_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          duration_days?: number | null
          id?: string
          notes?: string | null
          requested_by: string
          status?: string
          style?: string | null
          updated_at?: string
        }
        Update: {
          action?: string
          admin_notes?: string | null
          campaign_id?: string | null
          client_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          duration_days?: number | null
          id?: string
          notes?: string | null
          requested_by?: string
          status?: string
          style?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_requests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_chunks: {
        Row: {
          campaign_id: string | null
          chunk_index: number
          client_id: string
          content: string
          created_at: string | null
          document_id: string
          embedding: string | null
          id: string
          token_count: number | null
        }
        Insert: {
          campaign_id?: string | null
          chunk_index: number
          client_id: string
          content: string
          created_at?: string | null
          document_id: string
          embedding?: string | null
          id?: string
          token_count?: number | null
        }
        Update: {
          campaign_id?: string | null
          chunk_index?: number
          client_id?: string
          content?: string
          created_at?: string | null
          document_id?: string
          embedding?: string | null
          id?: string
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "kb_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_documents: {
        Row: {
          campaign_id: string | null
          client_id: string
          created_at: string | null
          file_name: string
          file_type: string | null
          file_url: string | null
          id: string
          status: string | null
        }
        Insert: {
          campaign_id?: string | null
          client_id: string
          created_at?: string | null
          file_name: string
          file_type?: string | null
          file_url?: string | null
          id?: string
          status?: string | null
        }
        Update: {
          campaign_id?: string | null
          client_id?: string
          created_at?: string | null
          file_name?: string
          file_type?: string | null
          file_url?: string | null
          id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_documents_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_alert_emails: {
        Row: {
          alert_kind: string
          client_id: string
          created_at: string
          error: string | null
          id: string
          lead_id: string
          provider_id: string | null
          recipients: string | null
          status: string
          trigger_at: string | null
        }
        Insert: {
          alert_kind: string
          client_id: string
          created_at?: string
          error?: string | null
          id?: string
          lead_id: string
          provider_id?: string | null
          recipients?: string | null
          status?: string
          trigger_at?: string | null
        }
        Update: {
          alert_kind?: string
          client_id?: string
          created_at?: string
          error?: string | null
          id?: string
          lead_id?: string
          provider_id?: string | null
          recipients?: string | null
          status?: string
          trigger_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_alert_emails_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignment_events: {
        Row: {
          actor_id: string | null
          client_id: string
          created_at: string
          from_user_id: string | null
          id: string
          lead_id: string
          method: string
          to_user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          client_id: string
          created_at?: string
          from_user_id?: string | null
          id?: string
          lead_id: string
          method: string
          to_user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          client_id?: string
          created_at?: string
          from_user_id?: string | null
          id?: string
          lead_id?: string
          method?: string
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignment_events_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_events_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignment_pool: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          last_assigned_at: string | null
          user_id: string
          weight: number
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_assigned_at?: string | null
          user_id: string
          weight?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_assigned_at?: string | null
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignment_pool_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_pool_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_campaign_states: {
        Row: {
          campaign_id: string
          client_id: string
          completed_at: string | null
          conversational_ai: boolean
          created_at: string
          current_step: number
          enrolled_at: string
          id: string
          last_ai_decision: string | null
          last_execution_id: string | null
          last_message_hash: string | null
          last_step_at: string | null
          lead_id: string
          metadata: Json
          next_step_at: string | null
          paused_by: string | null
          paused_reason: string | null
          send_lock: boolean | null
          started_at: string | null
          state: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          client_id: string
          completed_at?: string | null
          conversational_ai?: boolean
          created_at?: string
          current_step?: number
          enrolled_at?: string
          id?: string
          last_ai_decision?: string | null
          last_execution_id?: string | null
          last_message_hash?: string | null
          last_step_at?: string | null
          lead_id: string
          metadata?: Json
          next_step_at?: string | null
          paused_by?: string | null
          paused_reason?: string | null
          send_lock?: boolean | null
          started_at?: string | null
          state?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          client_id?: string
          completed_at?: string | null
          conversational_ai?: boolean
          created_at?: string
          current_step?: number
          enrolled_at?: string
          id?: string
          last_ai_decision?: string | null
          last_execution_id?: string | null
          last_message_hash?: string | null
          last_step_at?: string | null
          lead_id?: string
          metadata?: Json
          next_step_at?: string | null
          paused_by?: string | null
          paused_reason?: string | null
          send_lock?: boolean | null
          started_at?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_campaign_states_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_campaign_states_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_campaign_states_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_campaign_states_paused_by_fkey"
            columns: ["paused_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_memory: {
        Row: {
          campaign_id: string | null
          client_id: string
          confidence: string | null
          created_at: string | null
          id: string
          importance_score: number | null
          is_active: boolean | null
          last_accessed_at: string | null
          lead_id: string
          memory_label: string
          memory_type: string | null
          source_message_id: string | null
          superseded_by: string | null
          updated_at: string | null
          value_json: Json | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          campaign_id?: string | null
          client_id: string
          confidence?: string | null
          created_at?: string | null
          id?: string
          importance_score?: number | null
          is_active?: boolean | null
          last_accessed_at?: string | null
          lead_id: string
          memory_label: string
          memory_type?: string | null
          source_message_id?: string | null
          superseded_by?: string | null
          updated_at?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          campaign_id?: string | null
          client_id?: string
          confidence?: string | null
          created_at?: string | null
          id?: string
          importance_score?: number | null
          is_active?: boolean | null
          last_accessed_at?: string | null
          lead_id?: string
          memory_label?: string
          memory_type?: string | null
          source_message_id?: string | null
          superseded_by?: string | null
          updated_at?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_memory_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_memory_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_memory_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_memory_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_memory_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "lead_memory"
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
      lead_qualifications: {
        Row: {
          bedrooms: number | null
          budget_max: number | null
          budget_min: number | null
          client_id: string
          competing_projects: string[] | null
          created_at: string | null
          decision_maker: string | null
          floor_area_min: number | null
          hesitation: string | null
          id: string
          income_source: string | null
          lead_id: string
          lot_area_min: number | null
          motivation: string | null
          move_in_date: string | null
          payment_scheme: string | null
          preferred_financing: string | null
          preferred_location: string[] | null
          property_sub_type: string | null
          property_type: string | null
          purpose: string | null
          timeframe: string | null
          unit_preferred: string | null
          updated_at: string | null
          viewing_schedule: string | null
        }
        Insert: {
          bedrooms?: number | null
          budget_max?: number | null
          budget_min?: number | null
          client_id: string
          competing_projects?: string[] | null
          created_at?: string | null
          decision_maker?: string | null
          floor_area_min?: number | null
          hesitation?: string | null
          id?: string
          income_source?: string | null
          lead_id: string
          lot_area_min?: number | null
          motivation?: string | null
          move_in_date?: string | null
          payment_scheme?: string | null
          preferred_financing?: string | null
          preferred_location?: string[] | null
          property_sub_type?: string | null
          property_type?: string | null
          purpose?: string | null
          timeframe?: string | null
          unit_preferred?: string | null
          updated_at?: string | null
          viewing_schedule?: string | null
        }
        Update: {
          bedrooms?: number | null
          budget_max?: number | null
          budget_min?: number | null
          client_id?: string
          competing_projects?: string[] | null
          created_at?: string | null
          decision_maker?: string | null
          floor_area_min?: number | null
          hesitation?: string | null
          id?: string
          income_source?: string | null
          lead_id?: string
          lot_area_min?: number | null
          motivation?: string | null
          move_in_date?: string | null
          payment_scheme?: string | null
          preferred_financing?: string | null
          preferred_location?: string[] | null
          property_sub_type?: string | null
          property_type?: string | null
          purpose?: string | null
          timeframe?: string | null
          unit_preferred?: string | null
          updated_at?: string | null
          viewing_schedule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_qualifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_qualifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_state_events: {
        Row: {
          change_kind: string
          changed_at: string
          changed_fields: string[]
          client_id: string | null
          conversation_stage: string | null
          id: number
          lead_grade: string | null
          lead_grade_score: number | null
          lead_id: string
          lead_score: number | null
          lost_reason: string | null
          prev_conversation_stage: string | null
          prev_lead_grade: string | null
          prev_lead_grade_score: number | null
          prev_lead_score: number | null
          prev_lost_reason: string | null
          prev_status: string | null
          status: string | null
          status_reason: string | null
          status_source: string | null
        }
        Insert: {
          change_kind: string
          changed_at?: string
          changed_fields?: string[]
          client_id?: string | null
          conversation_stage?: string | null
          id?: number
          lead_grade?: string | null
          lead_grade_score?: number | null
          lead_id: string
          lead_score?: number | null
          lost_reason?: string | null
          prev_conversation_stage?: string | null
          prev_lead_grade?: string | null
          prev_lead_grade_score?: number | null
          prev_lead_score?: number | null
          prev_lost_reason?: string | null
          prev_status?: string | null
          status?: string | null
          status_reason?: string | null
          status_source?: string | null
        }
        Update: {
          change_kind?: string
          changed_at?: string
          changed_fields?: string[]
          client_id?: string | null
          conversation_stage?: string | null
          id?: number
          lead_grade?: string | null
          lead_grade_score?: number | null
          lead_id?: string
          lead_score?: number | null
          lost_reason?: string | null
          prev_conversation_stage?: string | null
          prev_lead_grade?: string | null
          prev_lead_grade_score?: number | null
          prev_lead_score?: number | null
          prev_lost_reason?: string | null
          prev_status?: string | null
          status?: string | null
          status_reason?: string | null
          status_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_state_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_temperature_events: {
        Row: {
          changed_at: string
          client_id: string
          from_temperature: string | null
          id: string
          lead_id: string
          temperature_reason: string | null
          temperature_source: string | null
          to_temperature: string
        }
        Insert: {
          changed_at?: string
          client_id: string
          from_temperature?: string | null
          id?: string
          lead_id: string
          temperature_reason?: string | null
          temperature_source?: string | null
          to_temperature: string
        }
        Update: {
          changed_at?: string
          client_id?: string
          from_temperature?: string | null
          id?: string
          lead_id?: string
          temperature_reason?: string | null
          temperature_source?: string | null
          to_temperature?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_temperature_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_viewing_indications: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          confidence: string
          conversation_id: string | null
          created_at: string
          detected_at: string
          evidence_text: string | null
          extractor_version: string | null
          id: number
          indication_type: string
          lead_id: string
          occurred_at: string | null
          polarity: string
          recorded_by: string | null
          source: string
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          confidence?: string
          conversation_id?: string | null
          created_at?: string
          detected_at?: string
          evidence_text?: string | null
          extractor_version?: string | null
          id?: number
          indication_type: string
          lead_id: string
          occurred_at?: string | null
          polarity: string
          recorded_by?: string | null
          source: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          confidence?: string
          conversation_id?: string | null
          created_at?: string
          detected_at?: string
          evidence_text?: string | null
          extractor_version?: string | null
          id?: number
          indication_type?: string
          lead_id?: string
          occurred_at?: string | null
          polarity?: string
          recorded_by?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_viewing_indications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_viewing_indications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_viewing_indications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_viewing_indications_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_user_id: string | null
          automation_enabled: boolean | null
          automation_source: string
          bamo_user_id: string | null
          campaign_id: string | null
          client_id: string
          company: string | null
          conversation_stage: string | null
          conversation_summary: string | null
          created_at: string | null
          current_location: string | null
          email: string | null
          fb_ad_id: string | null
          follow_up_preference: string | null
          followup_opted_out: boolean
          followup_opted_out_at: string | null
          id: string
          industry: string | null
          last_ai_outbound_at: string | null
          last_contacted_at: string | null
          last_inbound_at: string | null
          last_message_at: string | null
          last_outbound_at: string | null
          last_question_asked: string | null
          last_question_attempts: number | null
          lead_grade: string | null
          lead_grade_breakdown: Json | null
          lead_grade_score: number | null
          lead_grade_updated_at: string | null
          lead_quality: string | null
          lead_quality_reason: string | null
          lead_quality_source: string
          lead_quality_updated_at: string | null
          lead_score: number | null
          lead_temperature: string | null
          lead_type: string | null
          lost_reason: string | null
          messenger_id: string | null
          metadata: Json | null
          motivation: string | null
          name: string
          next_follow_up_date: string | null
          phone: string | null
          primary_channel: string | null
          profile_completed_at: string | null
          questions_asked: Json | null
          source: string | null
          source_override: boolean | null
          status: string | null
          status_reason: string | null
          status_source: string
          status_updated_at: string | null
          tags: string[] | null
          temperature_reason: string | null
          temperature_source: string
          temperature_updated_at: string | null
          timeframe: string | null
          unread_count: number | null
          updated_at: string | null
          viber_id: string | null
          viewing_stage: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          automation_enabled?: boolean | null
          automation_source?: string
          bamo_user_id?: string | null
          campaign_id?: string | null
          client_id: string
          company?: string | null
          conversation_stage?: string | null
          conversation_summary?: string | null
          created_at?: string | null
          current_location?: string | null
          email?: string | null
          fb_ad_id?: string | null
          follow_up_preference?: string | null
          followup_opted_out?: boolean
          followup_opted_out_at?: string | null
          id?: string
          industry?: string | null
          last_ai_outbound_at?: string | null
          last_contacted_at?: string | null
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_outbound_at?: string | null
          last_question_asked?: string | null
          last_question_attempts?: number | null
          lead_grade?: string | null
          lead_grade_breakdown?: Json | null
          lead_grade_score?: number | null
          lead_grade_updated_at?: string | null
          lead_quality?: string | null
          lead_quality_reason?: string | null
          lead_quality_source?: string
          lead_quality_updated_at?: string | null
          lead_score?: number | null
          lead_temperature?: string | null
          lead_type?: string | null
          lost_reason?: string | null
          messenger_id?: string | null
          metadata?: Json | null
          motivation?: string | null
          name: string
          next_follow_up_date?: string | null
          phone?: string | null
          primary_channel?: string | null
          profile_completed_at?: string | null
          questions_asked?: Json | null
          source?: string | null
          source_override?: boolean | null
          status?: string | null
          status_reason?: string | null
          status_source?: string
          status_updated_at?: string | null
          tags?: string[] | null
          temperature_reason?: string | null
          temperature_source?: string
          temperature_updated_at?: string | null
          timeframe?: string | null
          unread_count?: number | null
          updated_at?: string | null
          viber_id?: string | null
          viewing_stage?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          automation_enabled?: boolean | null
          automation_source?: string
          bamo_user_id?: string | null
          campaign_id?: string | null
          client_id?: string
          company?: string | null
          conversation_stage?: string | null
          conversation_summary?: string | null
          created_at?: string | null
          current_location?: string | null
          email?: string | null
          fb_ad_id?: string | null
          follow_up_preference?: string | null
          followup_opted_out?: boolean
          followup_opted_out_at?: string | null
          id?: string
          industry?: string | null
          last_ai_outbound_at?: string | null
          last_contacted_at?: string | null
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_outbound_at?: string | null
          last_question_asked?: string | null
          last_question_attempts?: number | null
          lead_grade?: string | null
          lead_grade_breakdown?: Json | null
          lead_grade_score?: number | null
          lead_grade_updated_at?: string | null
          lead_quality?: string | null
          lead_quality_reason?: string | null
          lead_quality_source?: string
          lead_quality_updated_at?: string | null
          lead_score?: number | null
          lead_temperature?: string | null
          lead_type?: string | null
          lost_reason?: string | null
          messenger_id?: string | null
          metadata?: Json | null
          motivation?: string | null
          name?: string
          next_follow_up_date?: string | null
          phone?: string | null
          primary_channel?: string | null
          profile_completed_at?: string | null
          questions_asked?: Json | null
          source?: string | null
          source_override?: boolean | null
          status?: string | null
          status_reason?: string | null
          status_source?: string
          status_updated_at?: string | null
          tags?: string[] | null
          temperature_reason?: string | null
          temperature_source?: string
          temperature_updated_at?: string | null
          timeframe?: string | null
          unread_count?: number | null
          updated_at?: string | null
          viber_id?: string | null
          viewing_stage?: string | null
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
          body: string
          category: string
          channel: string | null
          client_id: string
          created_at: string | null
          created_by: string | null
          goal: string | null
          id: string
          last_used_at: string | null
          placeholders_used: Json
          title: string
          topic: string | null
          updated_at: string | null
          used_kb: boolean
        }
        Insert: {
          body: string
          category: string
          channel?: string | null
          client_id: string
          created_at?: string | null
          created_by?: string | null
          goal?: string | null
          id?: string
          last_used_at?: string | null
          placeholders_used?: Json
          title: string
          topic?: string | null
          updated_at?: string | null
          used_kb?: boolean
        }
        Update: {
          body?: string
          category?: string
          channel?: string | null
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          goal?: string | null
          id?: string
          last_used_at?: string | null
          placeholders_used?: Json
          title?: string
          topic?: string | null
          updated_at?: string | null
          used_kb?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_media_attachments: {
        Row: {
          client_id: string
          fb_attachment_id: string
          id: string
          media_type: string
          media_url: string
          uploaded_at: string
        }
        Insert: {
          client_id: string
          fb_attachment_id: string
          id?: string
          media_type: string
          media_url: string
          uploaded_at?: string
        }
        Update: {
          client_id?: string
          fb_attachment_id?: string
          id?: string
          media_type?: string
          media_url?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messenger_media_attachments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_referrals: {
        Row: {
          ad_id: string | null
          client_id: string | null
          created_at: string
          id: string
          psid: string
          raw: Json | null
          ref: string | null
          source: string | null
        }
        Insert: {
          ad_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          psid: string
          raw?: Json | null
          ref?: string | null
          source?: string | null
        }
        Update: {
          ad_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          psid?: string
          raw?: Json | null
          ref?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messenger_referrals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          ads_updates: boolean
          appointment_reminders: boolean
          daily_digest: boolean
          lead_assigned: boolean
          lead_hot: boolean
          lead_warm: boolean
          quiet_hours: boolean
          tasks: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          ads_updates?: boolean
          appointment_reminders?: boolean
          daily_digest?: boolean
          lead_assigned?: boolean
          lead_hot?: boolean
          lead_warm?: boolean
          quiet_hours?: boolean
          tasks?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          ads_updates?: boolean
          appointment_reminders?: boolean
          daily_digest?: boolean
          lead_assigned?: boolean
          lead_hot?: boolean
          lead_warm?: boolean
          quiet_hours?: boolean
          tasks?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          client_id: string | null
          created_at: string
          data: Json
          id: string
          pushed_at: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          client_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          pushed_at?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          client_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          pushed_at?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      page_connection_requests: {
        Row: {
          admin_notes: string | null
          client_id: string
          created_at: string
          id: string
          page_name: string
          page_url: string | null
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          client_id: string
          created_at?: string
          id?: string
          page_name: string
          page_url?: string | null
          requested_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          client_id?: string
          created_at?: string
          id?: string
          page_name?: string
          page_url?: string | null
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_connection_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_connection_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_limits: {
        Row: {
          ai_monthly: number | null
          leads_total: number | null
          listings_total: number | null
          plan: string
        }
        Insert: {
          ai_monthly?: number | null
          leads_total?: number | null
          listings_total?: number | null
          plan: string
        }
        Update: {
          ai_monthly?: number | null
          leads_total?: number | null
          listings_total?: number | null
          plan?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bamo_account_id: string | null
          client_id: string | null
          company: string | null
          company_logo_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          location_city: string | null
          location_province: string | null
          origin_product: string | null
          phone: string | null
          prc_number: string | null
          role: string | null
          service_area: string | null
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          bamo_account_id?: string | null
          client_id?: string | null
          company?: string | null
          company_logo_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          location_city?: string | null
          location_province?: string | null
          origin_product?: string | null
          phone?: string | null
          prc_number?: string | null
          role?: string | null
          service_area?: string | null
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          bamo_account_id?: string | null
          client_id?: string | null
          company?: string | null
          company_logo_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          location_city?: string | null
          location_province?: string | null
          origin_product?: string | null
          phone?: string | null
          prc_number?: string | null
          role?: string | null
          service_area?: string | null
          whatsapp?: string | null
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
      prompt_templates: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          template: string
          type: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          template: string
          type: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          template?: string
          type?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          device_id: string | null
          expo_push_token: string
          id: string
          platform: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          device_id?: string | null
          expo_push_token: string
          id?: string
          platform?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          device_id?: string | null
          expo_push_token?: string
          id?: string
          platform?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seq_enroll_backup_20260803: {
        Row: {
          client_id: string | null
          completed_at: string | null
          created_at: string | null
          current_step: number | null
          enrolled_at: string | null
          enrollment_rule_id: string | null
          id: string | null
          last_execution_id: string | null
          last_step_at: string | null
          lead_id: string | null
          metadata: Json | null
          next_action_at: string | null
          next_step_at: string | null
          outcome: string | null
          pass_number: number | null
          paused_by: string | null
          paused_reason: string | null
          send_lock: boolean | null
          sequence_id: string | null
          started_at: string | null
          state: string | null
          touch_count: number | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          enrolled_at?: string | null
          enrollment_rule_id?: string | null
          id?: string | null
          last_execution_id?: string | null
          last_step_at?: string | null
          lead_id?: string | null
          metadata?: Json | null
          next_action_at?: string | null
          next_step_at?: string | null
          outcome?: string | null
          pass_number?: number | null
          paused_by?: string | null
          paused_reason?: string | null
          send_lock?: boolean | null
          sequence_id?: string | null
          started_at?: string | null
          state?: string | null
          touch_count?: number | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          enrolled_at?: string | null
          enrollment_rule_id?: string | null
          id?: string | null
          last_execution_id?: string | null
          last_step_at?: string | null
          lead_id?: string | null
          metadata?: Json | null
          next_action_at?: string | null
          next_step_at?: string | null
          outcome?: string | null
          pass_number?: number | null
          paused_by?: string | null
          paused_reason?: string | null
          send_lock?: boolean | null
          sequence_id?: string | null
          started_at?: string | null
          state?: string | null
          touch_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sequence_enrollments: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          current_step: number
          enrolled_at: string
          enrollment_rule_id: string | null
          id: string
          last_execution_id: string | null
          last_step_at: string | null
          lead_id: string
          metadata: Json
          next_action_at: string | null
          next_step_at: string | null
          outcome: string | null
          pass_number: number
          paused_by: string | null
          paused_reason: string | null
          send_lock: boolean | null
          sequence_id: string
          started_at: string | null
          state: string
          touch_count: number
          updated_at: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          current_step?: number
          enrolled_at?: string
          enrollment_rule_id?: string | null
          id?: string
          last_execution_id?: string | null
          last_step_at?: string | null
          lead_id: string
          metadata?: Json
          next_action_at?: string | null
          next_step_at?: string | null
          outcome?: string | null
          pass_number?: number
          paused_by?: string | null
          paused_reason?: string | null
          send_lock?: boolean | null
          sequence_id: string
          started_at?: string | null
          state?: string
          touch_count?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          current_step?: number
          enrolled_at?: string
          enrollment_rule_id?: string | null
          id?: string
          last_execution_id?: string | null
          last_step_at?: string | null
          lead_id?: string
          metadata?: Json
          next_action_at?: string | null
          next_step_at?: string | null
          outcome?: string | null
          pass_number?: number
          paused_by?: string | null
          paused_reason?: string | null
          send_lock?: boolean | null
          sequence_id?: string
          started_at?: string | null
          state?: string
          touch_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_enrollments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_enrollment_rule_id_fkey"
            columns: ["enrollment_rule_id"]
            isOneToOne: false
            referencedRelation: "enrollment_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_steps: {
        Row: {
          created_at: string | null
          delay_hours: number
          id: string
          is_active: boolean | null
          media_type: string | null
          media_url: string | null
          message_content: string | null
          quick_replies: Json | null
          sequence_id: string
          step_order: number
          step_type: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delay_hours?: number
          id?: string
          is_active?: boolean | null
          media_type?: string | null
          media_url?: string | null
          message_content?: string | null
          quick_replies?: Json | null
          sequence_id: string
          step_order: number
          step_type: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delay_hours?: number
          id?: string
          is_active?: boolean | null
          media_type?: string | null
          media_url?: string | null
          message_content?: string | null
          quick_replies?: Json | null
          sequence_id?: string
          step_order?: number
          step_type?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences: {
        Row: {
          ai_settings: Json | null
          campaign_id: string | null
          client_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          max_passes: number | null
          mode: string
          name: string
          reenroll_cooldown_days: number | null
          scheduled_steps_enabled: boolean | null
          send_window_end: string | null
          send_window_start: string | null
          updated_at: string | null
        }
        Insert: {
          ai_settings?: Json | null
          campaign_id?: string | null
          client_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_passes?: number | null
          mode?: string
          name: string
          reenroll_cooldown_days?: number | null
          scheduled_steps_enabled?: boolean | null
          send_window_end?: string | null
          send_window_start?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_settings?: Json | null
          campaign_id?: string | null
          client_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_passes?: number | null
          mode?: string
          name?: string
          reenroll_cooldown_days?: number | null
          scheduled_steps_enabled?: boolean | null
          send_window_end?: string | null
          send_window_start?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequences_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequences_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      social_autopost_plans: {
        Row: {
          cadence: Json
          client_id: string
          created_at: string | null
          created_by: string | null
          ends_at: string
          id: string
          starts_at: string
          status: string
          updated_at: string | null
          weekly_topics: Json
        }
        Insert: {
          cadence?: Json
          client_id: string
          created_at?: string | null
          created_by?: string | null
          ends_at: string
          id?: string
          starts_at?: string
          status?: string
          updated_at?: string | null
          weekly_topics: Json
        }
        Update: {
          cadence?: Json
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          ends_at?: string
          id?: string
          starts_at?: string
          status?: string
          updated_at?: string | null
          weekly_topics?: Json
        }
        Relationships: [
          {
            foreignKeyName: "social_autopost_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_requests: {
        Row: {
          client_id: string
          created_at: string | null
          created_by: string | null
          id: string
          note: string | null
          processed_at: string | null
          processed_by: string | null
          product: string
          status: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          processed_at?: string | null
          processed_by?: string | null
          product?: string
          status?: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          processed_at?: string | null
          processed_by?: string | null
          product?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_requests_client_id_fkey"
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
          deferred_until: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          notes: string | null
          source: string | null
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
          deferred_until?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          source?: string | null
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
          deferred_until?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          source?: string | null
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
      user_onboarding_tour: {
        Row: {
          client_id: string | null
          completed_at: string | null
          created_at: string
          help_request: string | null
          listing_intent: boolean
          profile_id: string
          services_needed: string[]
          skipped: boolean
          started_at: string
          steps: Json
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          help_request?: string | null
          listing_intent?: boolean
          profile_id: string
          services_needed?: string[]
          skipped?: boolean
          started_at?: string
          steps?: Json
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          help_request?: string | null
          listing_intent?: boolean
          profile_id?: string
          services_needed?: string[]
          skipped?: boolean
          started_at?: string
          steps?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_onboarding_tour_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_onboarding_tour_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      video_requests: {
        Row: {
          client_id: string
          created_at: string | null
          created_by: string | null
          delivered_url: string | null
          duration_seconds: number
          format: string
          id: string
          listing_id: string | null
          notes: string | null
          status: string
          updated_at: string | null
          video_type: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          created_by?: string | null
          delivered_url?: string | null
          duration_seconds?: number
          format?: string
          id?: string
          listing_id?: string | null
          notes?: string | null
          status?: string
          updated_at?: string | null
          video_type: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          delivered_url?: string | null
          duration_seconds?: number
          format?: string
          id?: string
          listing_id?: string | null
          notes?: string | null
          status?: string
          updated_at?: string | null
          video_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "agent_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      viewing_outcome_requests: {
        Row: {
          answered_at: string | null
          appointment_id: string
          client_id: string | null
          created_at: string
          due_at: string | null
          first_sent_at: string | null
          id: string
          lead_id: string
          prep_reminder_due_at: string | null
          prep_reminder_sent_at: string | null
          recipients: string | null
          reminder_due_at: string | null
          reminder_sent_at: string | null
          send_error: string | null
          status: string
          suppressed_reason: string | null
          updated_at: string
        }
        Insert: {
          answered_at?: string | null
          appointment_id: string
          client_id?: string | null
          created_at?: string
          due_at?: string | null
          first_sent_at?: string | null
          id?: string
          lead_id: string
          prep_reminder_due_at?: string | null
          prep_reminder_sent_at?: string | null
          recipients?: string | null
          reminder_due_at?: string | null
          reminder_sent_at?: string | null
          send_error?: string | null
          status?: string
          suppressed_reason?: string | null
          updated_at?: string
        }
        Update: {
          answered_at?: string | null
          appointment_id?: string
          client_id?: string | null
          created_at?: string
          due_at?: string | null
          first_sent_at?: string | null
          id?: string
          lead_id?: string
          prep_reminder_due_at?: string | null
          prep_reminder_sent_at?: string | null
          recipients?: string | null
          reminder_due_at?: string | null
          reminder_sent_at?: string | null
          send_error?: string | null
          status?: string
          suppressed_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "viewing_outcome_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_outcome_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      viewing_outcome_tokens: {
        Row: {
          created_at: string
          email: string | null
          expires_at: string
          id: string
          kind: string
          profile_id: string | null
          request_id: string
          token: string
          used_at: string | null
          used_ip: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          kind?: string
          profile_id?: string | null
          request_id: string
          token: string
          used_at?: string | null
          used_ip?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          kind?: string
          profile_id?: string | null
          request_id?: string
          token?: string
          used_at?: string | null
          used_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "viewing_outcome_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_outcome_tokens_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "viewing_outcome_requests"
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
      canned_inbound_phrases: {
        Row: {
          lead_count: number | null
          msg_count: number | null
          phrase: string | null
        }
        Relationships: []
      }
      canned_outbound_phrases: {
        Row: {
          lead_count: number | null
          median_reply_secs: number | null
          msg_count: number | null
          phrase: string | null
        }
        Relationships: []
      }
      lead_engagement_counts: {
        Row: {
          canned_inbound_count: number | null
          genuine_inbound: number | null
          inbound_count: number | null
          lead_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_objection_counts: {
        Row: {
          has_hard_refusal: boolean | null
          lead_id: string | null
          objection_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_memory_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ad_source_quality: {
        Row: {
          avg_grade_score: number | null
          avg_questions_asked_back: number | null
          avg_reciprocal_replies: number | null
          avg_typed_inbound: number | null
          canned_only_leads: number | null
          client_id: string | null
          client_name: string | null
          cold: number | null
          fb_ad_id: string | null
          first_lead_at: string | null
          hot: number | null
          is_attributed: boolean | null
          last_lead_at: string | null
          leads: number | null
          median_reply_latency_mins: number | null
          pct_canned_only: number | null
          pct_hot: number | null
          pct_viewing: number | null
          reached_viewing: number | null
          warm: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      v_canned_messages: {
        Row: {
          message_content: string | null
        }
        Relationships: []
      }
      v_lead_derived_signals: {
        Row: {
          active_days: number | null
          avg_typed_len: number | null
          canned_inbound: number | null
          client_id: string | null
          days_since_last_inbound: number | null
          fastest_reply_mins: number | null
          first_inbound_at: string | null
          inbound_count: number | null
          last_inbound_at: string | null
          lead_id: string | null
          max_quiet_gap_days: number | null
          max_typed_len: number | null
          measured_replies: number | null
          median_reply_latency_mins: number | null
          night_share_pct: number | null
          nudged_returns_7d: number | null
          organic_returns_7d: number | null
          outbound_count: number | null
          questions_asked_back: number | null
          reciprocal_replies: number | null
          returns_after_14d: number | null
          returns_after_3d: number | null
          returns_after_7d: number | null
          slowest_reply_mins: number | null
          span_days: number | null
          typed_chars: number | null
          typed_inbound: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      v_lead_viewing_indication_summary: {
        Row: {
          agent_verdict: string | null
          agent_verdict_at: string | null
          appointment_id: string | null
          client_id: string | null
          conflicting: boolean | null
          first_indication_at: string | null
          indication_count: number | null
          last_indication_at: string | null
          latest_occurred_at: string | null
          lead_id: string | null
          n_agent_confirmed: number | null
          n_ambiguous: number | null
          n_deterministic: number | null
          n_handover: number | null
          n_happened: number | null
          n_inferred: number | null
          n_not_happened: number | null
          n_rescheduled: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_viewing_indications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_viewing_indications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      agent_active_recently: {
        Args: { p_lead_id: string; p_minutes?: number }
        Returns: boolean
      }
      apply_ai_followup_decision: {
        Args: {
          p_action: string
          p_context?: Json
          p_enrollment_id: string
          p_goal_status?: string
          p_message?: string
          p_next_check_hours?: number
          p_opted_out?: boolean
          p_reason?: string
          p_window_open?: boolean
        }
        Returns: undefined
      }
      check_push_dispatch_secret: { Args: { p: string }; Returns: boolean }
      client_has_active_campaign: { Args: never; Returns: boolean }
      compose_kb_content: { Args: { f: Json }; Returns: string }
      compute_admin_ai_metrics: { Args: { p_days?: number }; Returns: Json }
      compute_agent_performance_scores: {
        Args: { p_client_id?: string }
        Returns: number
      }
      consume_ai_credit: { Args: { p_client_id: string }; Returns: Json }
      create_notification: {
        Args: {
          p_body: string
          p_client_id: string
          p_data: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      digest_email_recipients: {
        Args: { p_client_id: string }
        Returns: string[]
      }
      enroll_ai_followup_candidates: {
        Args: never
        Returns: {
          client_id: string
          enrollment_id: string
          lead_id: string
          sequence_id: string
        }[]
      }
      enroll_lead: {
        Args: {
          p_attribution?: Json
          p_campaign_id?: string
          p_force?: boolean
          p_is_new?: boolean
          p_lead_id: string
          p_source?: string
        }
        Returns: Json
      }
      ensure_viewing_appointment: {
        Args: { p_lead_id: string }
        Returns: string
      }
      expire_unconfirmed_viewing_requests: { Args: never; Returns: number }
      fetch_due_ai_followups: {
        Args: { p_limit?: number }
        Returns: {
          client_id: string
          context: Json
          enrollment_id: string
          fb_page_token: string
          lead_id: string
          messenger_id: string
        }[]
      }
      get_admin_ai_metrics: { Args: { p_days?: number }; Returns: Json }
      get_campaign_context: { Args: { p_lead_id: string }; Returns: Json }
      get_client_overview: { Args: { p_months?: number }; Returns: Json }
      get_current_usage: { Args: { p_client_id: string }; Returns: Json }
      get_leads_with_details: {
        Args: {
          p_assigned_user_id?: string
          p_campaign_id?: string
          p_client_id: string
          p_lead_type?: string
          p_limit?: number
          p_offset?: number
          p_quality?: string
          p_search?: string
          p_sort_by?: string
          p_sort_dir?: string
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
          campaign_id: string
          campaign_name: string
          client_id: string
          company: string
          created_at: string
          email: string
          id: string
          last_contacted_at: string
          last_inbound_at: string
          last_message: string
          lead_quality: string
          lead_quality_reason: string
          lead_quality_source: string
          lead_quality_updated_at: string
          lead_score: number
          lead_temperature: string
          lead_type: string
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
      get_my_ad_account_status: {
        Args: never
        Returns: {
          ad_account_id: string
          ads_enabled: boolean
          ads_plan: string
          is_active: boolean
        }[]
      }
      get_my_ads_plan: {
        Args: never
        Returns: {
          ads_enabled: boolean
          ads_plan: string
          ads_plan_started_at: string
          is_active: boolean
        }[]
      }
      get_my_assignment_feed: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          direction: string
          id: string
          lead_id: string
          lead_name: string
          method: string
        }[]
      }
      get_my_assignment_settings: {
        Args: never
        Returns: {
          assignment_mode: string
          assignment_sources: string[]
        }[]
      }
      get_my_client_id: { Args: never; Returns: string }
      get_my_fb_page_id: { Args: never; Returns: string }
      get_my_role: { Args: never; Returns: string }
      get_my_social_pages: {
        Args: never
        Returns: {
          account_name: string
          is_active: boolean
          platform: string
        }[]
      }
      get_my_team_members: {
        Args: never
        Returns: {
          full_name: string
          id: string
          role: string
        }[]
      }
      get_my_usage: { Args: never; Returns: Json }
      get_my_workspace_name: { Args: never; Returns: string }
      increment_creative_usage: {
        Args: { p_client_id: string; p_creative_type: string }
        Returns: undefined
      }
      kb_catalog_clients: {
        Args: never
        Returns: {
          campaign_id: string
          campaign_name: string
          client_id: string
          client_name: string
          kb_count: number
          last_updated: string
        }[]
      }
      kb_catalog_get: {
        Args: { p_kb_id: string }
        Returns: {
          content: string
          kb_id: string
          source_label: string
          title: string
          updated_at: string
        }[]
      }
      kb_catalog_list: {
        Args: { p_campaign_id: string }
        Returns: {
          content_chars: number
          kb_id: string
          scope: string
          source_label: string
          title: string
          updated_at: string
        }[]
      }
      lead_assigned_to_me: { Args: { p_lead_id: string }; Returns: boolean }
      lead_grade_has_answer: { Args: { v: string }; Returns: boolean }
      mark_viewing_outcome_sent: {
        Args: { p_error?: string; p_recipients: string; p_request_id: string }
        Returns: undefined
      }
      mark_viewing_prep_reminder_sent: {
        Args: { p_error?: string; p_recipients: string; p_request_id: string }
        Returns: undefined
      }
      match_chunks: {
        Args: {
          match_campaign_id: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
        }[]
      }
      match_kb_chunks: {
        Args: {
          match_campaign_id: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          document_id: string
          id: string
          similarity: number
          token_count: number
        }[]
      }
      mint_viewing_outcome_tokens: {
        Args: { p_request_id: string }
        Returns: {
          email: string
          profile_id: string
          token: string
        }[]
      }
      mint_viewing_prep_tokens: {
        Args: { p_request_id: string }
        Returns: {
          email: string
          profile_id: string
          token: string
        }[]
      }
      peek_viewing_outcome_token: {
        Args: { p_polarity: string; p_token: string }
        Returns: {
          date_known: boolean
          lead_name: string
          recorded_polarity: string
          scheduled_at: string
          source_text: string
          status: string
        }[]
      }
      peek_viewing_prep_token: {
        Args: { p_answer: string; p_token: string }
        Returns: {
          date_known: boolean
          lead_name: string
          recorded_answer: string
          scheduled_at: string
          source_text: string
          status: string
        }[]
      }
      pending_lead_alerts: {
        Args: { p_limit?: number }
        Returns: {
          agent_name: string
          alert_kind: string
          client_id: string
          client_name: string
          lead_id: string
          lead_name: string
          lead_status: string
          reason: string
          temperature: string
          to_emails: string
          trigger_at: string
        }[]
      }
      pending_viewing_outcome_emails: {
        Args: { p_limit?: number }
        Returns: {
          appointment_id: string
          client_id: string
          client_name: string
          date_known: boolean
          lead_id: string
          lead_name: string
          recipient_emails: string
          request_id: string
          scheduled_at: string
          send_kind: string
          source_text: string
        }[]
      }
      pending_viewing_prep_reminders: {
        Args: { p_limit?: number }
        Returns: {
          appointment_id: string
          client_id: string
          client_name: string
          date_known: boolean
          lead_id: string
          lead_name: string
          recipient_emails: string
          request_id: string
          scheduled_at: string
          source_text: string
        }[]
      }
      reassign_task: {
        Args: { p_task_id: string; p_user_id: string }
        Returns: undefined
      }
      recompute_lead_grade: { Args: { p_lead_id?: string }; Returns: number }
      recompute_my_performance_scores: { Args: never; Returns: number }
      record_disposition_from_token: {
        Args: {
          p_disposition: string
          p_ip?: string
          p_lost_reason?: string
          p_token: string
        }
        Returns: {
          lead_name: string
          status: string
        }[]
      }
      redeem_viewing_outcome_token: {
        Args: { p_ip?: string; p_polarity: string; p_token: string }
        Returns: {
          lead_name: string
          recorded_polarity: string
          scheduled_at: string
          status: string
        }[]
      }
      redeem_viewing_prep_token: {
        Args: { p_answer: string; p_ip?: string; p_token: string }
        Returns: {
          lead_name: string
          recorded_answer: string
          scheduled_at: string
          status: string
        }[]
      }
      refresh_admin_ai_metrics: {
        Args: { p_days?: number }
        Returns: undefined
      }
      refresh_canned_inbound_phrases: { Args: never; Returns: undefined }
      request_bamo_entity: {
        Args: {
          p_canonical_name: string
          p_country_code?: string
          p_created_by_profile_id?: string
          p_entity_type: string
          p_notes?: string
          p_registration_number?: string
        }
        Returns: {
          bamo_entity_id: string
          created: boolean
        }[]
      }
      request_followup_disable: {
        Args: { p_campaign_id: string }
        Returns: Json
      }
      resolve_bamo_entity: {
        Args: { p_entity_id: string }
        Returns: {
          bamo_entity_id: string
          canonical_name: string
          entity_type: string
          registration_number: string
          requested_entity_id: string
          status: string
          was_superseded: boolean
        }[]
      }
      resolve_lead_recipients: {
        Args: { p_assigned: string; p_client_id: string }
        Returns: string[]
      }
      resolve_viewing_datetime: {
        Args: { p_anchor: string; p_text: string }
        Returns: {
          confidence: string
          scheduled_at: string
        }[]
      }
      run_appointment_reminders: { Args: never; Returns: undefined }
      run_deferred_task_sweep: { Args: never; Returns: undefined }
      search_bamo_entities: {
        Args: { p_entity_type?: string; p_limit?: number; p_query: string }
        Returns: {
          bamo_entity_id: string
          canonical_name: string
          entity_type: string
          match_quality: string
          registration_number: string
          status: string
        }[]
      }
      set_lead_disposition: {
        Args: {
          p_disposition: string
          p_lead_id: string
          p_lost_reason?: string
          p_note?: string
          p_recorded_by?: string
        }
        Returns: {
          lead_name: string
          status: string
        }[]
      }
      set_my_assignment_settings: {
        Args: { p_mode: string; p_sources: string[] }
        Returns: undefined
      }
      verify_bamo_registry_request: {
        Args: {
          p_body: string
          p_caller: string
          p_nonce: string
          p_operation?: string
          p_signature: string
          p_timestamp: string
        }
        Returns: {
          authorized: boolean
          reason: string
        }[]
      }
      viewing_outcome_due_at: { Args: { p_scheduled: string }; Returns: string }
      viewing_prep_reminder_due_at: {
        Args: { p_scheduled: string }
        Returns: string
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
