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
          agent_email: string | null
          agent_name: string | null
          agent_phone: string | null
          area_coverage: string | null
          assets_drive_url: string | null
          client_id: string
          company: string | null
          created_by: string
          facts: string | null
          hero_photo_url: string | null
          id: string
          linked_listing_ids: string[]
          messenger_link: string | null
          prc_number: string | null
          requested_at: string
          status: string
          updated_at: string
          website_url: string | null
          whatsapp_link: string | null
        }
        Insert: {
          agent_email?: string | null
          agent_name?: string | null
          agent_phone?: string | null
          area_coverage?: string | null
          assets_drive_url?: string | null
          client_id: string
          company?: string | null
          created_by: string
          facts?: string | null
          hero_photo_url?: string | null
          id?: string
          linked_listing_ids?: string[]
          messenger_link?: string | null
          prc_number?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          website_url?: string | null
          whatsapp_link?: string | null
        }
        Update: {
          agent_email?: string | null
          agent_name?: string | null
          agent_phone?: string | null
          area_coverage?: string | null
          assets_drive_url?: string | null
          client_id?: string
          company?: string | null
          created_by?: string
          facts?: string | null
          hero_photo_url?: string | null
          id?: string
          linked_listing_ids?: string[]
          messenger_link?: string | null
          prc_number?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
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
          scheduled_at: string
          source: string
          status: string
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
          scheduled_at: string
          source?: string
          status?: string
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
          scheduled_at?: string
          source?: string
          status?: string
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
          review_notes: string | null
          review_status: string
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
          review_notes?: string | null
          review_status?: string
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
          review_notes?: string | null
          review_status?: string
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
          campaign_rules: Json | null
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
          is_active: boolean | null
          is_locked: boolean | null
          job_titles: string[] | null
          name: string
          priority: number
          scheduled_steps_enabled: boolean
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
          campaign_rules?: Json | null
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
          is_active?: boolean | null
          is_locked?: boolean | null
          job_titles?: string[] | null
          name: string
          priority?: number
          scheduled_steps_enabled?: boolean
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
          campaign_rules?: Json | null
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
          is_active?: boolean | null
          is_locked?: boolean | null
          job_titles?: string[] | null
          name?: string
          priority?: number
          scheduled_steps_enabled?: boolean
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
      client_bamo_website: {
        Row: {
          accent_color: string | null
          built_at: string | null
          client_id: string | null
          content: Json | null
          created_at: string | null
          created_by: string | null
          custom_domain: string | null
          deployment_logs: string | null
          description: string | null
          domain_status: string | null
          favicon_url: string | null
          hero_image_url: string | null
          id: string
          last_updated_at: string | null
          lead_form_enabled: boolean | null
          lead_form_title: string | null
          lead_webhook_url: string | null
          listing_filter: Json | null
          logo_url: string | null
          primary_color: string | null
          published_at: string | null
          show_listings: boolean | null
          site_name: string
          status: string | null
          subdomain: string | null
          tagline: string | null
          theme: string | null
          updated_at: string | null
          vercel_deployment_url: string | null
          vercel_project_id: string | null
        }
        Insert: {
          accent_color?: string | null
          built_at?: string | null
          client_id?: string | null
          content?: Json | null
          created_at?: string | null
          created_by?: string | null
          custom_domain?: string | null
          deployment_logs?: string | null
          description?: string | null
          domain_status?: string | null
          favicon_url?: string | null
          hero_image_url?: string | null
          id?: string
          last_updated_at?: string | null
          lead_form_enabled?: boolean | null
          lead_form_title?: string | null
          lead_webhook_url?: string | null
          listing_filter?: Json | null
          logo_url?: string | null
          primary_color?: string | null
          published_at?: string | null
          show_listings?: boolean | null
          site_name: string
          status?: string | null
          subdomain?: string | null
          tagline?: string | null
          theme?: string | null
          updated_at?: string | null
          vercel_deployment_url?: string | null
          vercel_project_id?: string | null
        }
        Update: {
          accent_color?: string | null
          built_at?: string | null
          client_id?: string | null
          content?: Json | null
          created_at?: string | null
          created_by?: string | null
          custom_domain?: string | null
          deployment_logs?: string | null
          description?: string | null
          domain_status?: string | null
          favicon_url?: string | null
          hero_image_url?: string | null
          id?: string
          last_updated_at?: string | null
          lead_form_enabled?: boolean | null
          lead_form_title?: string | null
          lead_webhook_url?: string | null
          listing_filter?: Json | null
          logo_url?: string | null
          primary_color?: string | null
          published_at?: string | null
          show_listings?: boolean | null
          site_name?: string
          status?: string | null
          subdomain?: string | null
          tagline?: string | null
          theme?: string | null
          updated_at?: string | null
          vercel_deployment_url?: string | null
          vercel_project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_bamo_website_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_bamo_website_created_by_fkey"
            columns: ["created_by"]
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
      client_website_analytics: {
        Row: {
          avg_session_seconds: number | null
          bounce_rate: number | null
          client_id: string | null
          date: string
          id: string
          lead_form_submissions: number | null
          listing_clicks: number | null
          page_views: number | null
          unique_visitors: number | null
          website_id: string | null
        }
        Insert: {
          avg_session_seconds?: number | null
          bounce_rate?: number | null
          client_id?: string | null
          date: string
          id?: string
          lead_form_submissions?: number | null
          listing_clicks?: number | null
          page_views?: number | null
          unique_visitors?: number | null
          website_id?: string | null
        }
        Update: {
          avg_session_seconds?: number | null
          bounce_rate?: number | null
          client_id?: string | null
          date?: string
          id?: string
          lead_form_submissions?: number | null
          listing_clicks?: number | null
          page_views?: number | null
          unique_visitors?: number | null
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_website_analytics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_website_analytics_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "client_bamo_website"
            referencedColumns: ["id"]
          },
        ]
      }
      client_website_builds: {
        Row: {
          build_log: string | null
          client_id: string | null
          completed_at: string | null
          deployment_url: string | null
          id: string
          started_at: string | null
          status: string | null
          triggered_by: string | null
          website_id: string | null
        }
        Insert: {
          build_log?: string | null
          client_id?: string | null
          completed_at?: string | null
          deployment_url?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
          triggered_by?: string | null
          website_id?: string | null
        }
        Update: {
          build_log?: string | null
          client_id?: string | null
          completed_at?: string | null
          deployment_url?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
          triggered_by?: string | null
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_website_builds_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_website_builds_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_website_builds_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "client_bamo_website"
            referencedColumns: ["id"]
          },
        ]
      }
      client_website_pages: {
        Row: {
          client_id: string | null
          content: Json | null
          created_at: string | null
          id: string
          is_published: boolean | null
          slug: string
          sort_order: number | null
          title: string
          updated_at: string | null
          website_id: string | null
        }
        Insert: {
          client_id?: string | null
          content?: Json | null
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          slug: string
          sort_order?: number | null
          title: string
          updated_at?: string | null
          website_id?: string | null
        }
        Update: {
          client_id?: string | null
          content?: Json | null
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          slug?: string
          sort_order?: number | null
          title?: string
          updated_at?: string | null
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_website_pages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_website_pages_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "client_bamo_website"
            referencedColumns: ["id"]
          },
        ]
      }
      client_website_sections: {
        Row: {
          content: Json | null
          created_at: string | null
          id: string
          is_visible: boolean | null
          page_id: string | null
          section_type: string
          sort_order: number | null
          website_id: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          page_id?: string | null
          section_type: string
          sort_order?: number | null
          website_id?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          page_id?: string | null
          section_type?: string
          sort_order?: number | null
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_website_sections_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "client_website_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_website_sections_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "client_bamo_website"
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
          settings: Json | null
          webhook_secret: string | null
        }
        Insert: {
          ad_account_id?: string | null
          ads_enabled?: boolean | null
          ads_plan?: string | null
          ads_plan_started_at?: string | null
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
          settings?: Json | null
          webhook_secret?: string | null
        }
        Update: {
          ad_account_id?: string | null
          ads_enabled?: boolean | null
          ads_plan?: string | null
          ads_plan_started_at?: string | null
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
          id: string
          industry: string | null
          last_ai_outbound_at: string | null
          last_contacted_at: string | null
          last_inbound_at: string | null
          last_message_at: string | null
          last_outbound_at: string | null
          last_question_asked: string | null
          last_question_attempts: number | null
          lead_quality: string | null
          lead_quality_reason: string | null
          lead_quality_source: string
          lead_quality_updated_at: string | null
          lead_score: number | null
          lead_temperature: string | null
          lead_type: string | null
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
          id?: string
          industry?: string | null
          last_ai_outbound_at?: string | null
          last_contacted_at?: string | null
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_outbound_at?: string | null
          last_question_asked?: string | null
          last_question_attempts?: number | null
          lead_quality?: string | null
          lead_quality_reason?: string | null
          lead_quality_source?: string
          lead_quality_updated_at?: string | null
          lead_score?: number | null
          lead_temperature?: string | null
          lead_type?: string | null
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
          id?: string
          industry?: string | null
          last_ai_outbound_at?: string | null
          last_contacted_at?: string | null
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_outbound_at?: string | null
          last_question_asked?: string | null
          last_question_attempts?: number | null
          lead_quality?: string | null
          lead_quality_reason?: string | null
          lead_quality_source?: string
          lead_quality_updated_at?: string | null
          lead_score?: number | null
          lead_temperature?: string | null
          lead_type?: string | null
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
          next_step_at: string | null
          outcome: string | null
          pass_number: number
          paused_by: string | null
          paused_reason: string | null
          send_lock: boolean | null
          sequence_id: string
          started_at: string | null
          state: string
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
          next_step_at?: string | null
          outcome?: string | null
          pass_number?: number
          paused_by?: string | null
          paused_reason?: string | null
          send_lock?: boolean | null
          sequence_id: string
          started_at?: string | null
          state?: string
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
          next_step_at?: string | null
          outcome?: string | null
          pass_number?: number
          paused_by?: string | null
          paused_reason?: string | null
          send_lock?: boolean | null
          sequence_id?: string
          started_at?: string | null
          state?: string
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
          client_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          max_passes: number | null
          name: string
          reenroll_cooldown_days: number | null
          scheduled_steps_enabled: boolean | null
          send_window_end: string | null
          send_window_start: string | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_passes?: number | null
          name: string
          reenroll_cooldown_days?: number | null
          scheduled_steps_enabled?: boolean | null
          send_window_end?: string | null
          send_window_start?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_passes?: number | null
          name?: string
          reenroll_cooldown_days?: number | null
          scheduled_steps_enabled?: boolean | null
          send_window_end?: string | null
          send_window_start?: string | null
          updated_at?: string | null
        }
        Relationships: [
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
          due_date: string | null
          id: string
          lead_id: string
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
          due_date?: string | null
          id?: string
          lead_id: string
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
          due_date?: string | null
          id?: string
          lead_id?: string
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
      compose_kb_content: { Args: { f: Json }; Returns: string }
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
      get_campaign_context: { Args: { p_lead_id: string }; Returns: Json }
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
      get_my_client_id: { Args: never; Returns: string }
      get_my_role: { Args: never; Returns: string }
      get_my_social_pages: {
        Args: never
        Returns: {
          account_name: string
          is_active: boolean
          platform: string
        }[]
      }
      get_my_workspace_name: { Args: never; Returns: string }
      increment_creative_usage: {
        Args: { p_client_id: string; p_creative_type: string }
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
