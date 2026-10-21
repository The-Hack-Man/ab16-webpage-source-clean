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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          entity: string | null
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      ai_mastering_jobs: {
        Row: {
          id: string
          release_id: string | null
          track_title: string
          preset: string
          status: string
          input_url: string | null
          output_url: string | null
          stripe_session_id: string | null
          payment_intent_id: string | null
          paid: boolean
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          release_id?: string | null
          track_title: string
          preset: string
          status?: string
          input_url?: string | null
          output_url?: string | null
          stripe_session_id?: string | null
          payment_intent_id?: string | null
          paid?: boolean
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          release_id?: string | null
          track_title?: string
          preset?: string
          status?: string
          input_url?: string | null
          output_url?: string | null
          stripe_session_id?: string | null
          payment_intent_id?: string | null
          paid?: boolean
          created_at?: string
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_mastering_jobs_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "music_releases"
            referencedColumns: ["id"]
          }
        ]
      }
      campaign_products: {
        Row: {
          campaign_id: string
          product_id: string
        }
        Insert: {
          campaign_id: string
          product_id: string
        }
        Update: {
          campaign_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_products_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_releases: {
        Row: {
          campaign_id: string
          release_id: string
        }
        Insert: {
          campaign_id: string
          release_id: string
        }
        Update: {
          campaign_id?: string
          release_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_releases_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_releases_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "music_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          description: string | null
          discount_code: string | null
          end_date: string | null
          hero_image_url: string | null
          id: string
          launch_date: string | null
          name: string
          slug: string
          start_date: string | null
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_code?: string | null
          end_date?: string | null
          hero_image_url?: string | null
          id?: string
          launch_date?: string | null
          name: string
          slug: string
          start_date?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_code?: string | null
          end_date?: string | null
          hero_image_url?: string | null
          id?: string
          launch_date?: string | null
          name?: string
          slug?: string
          start_date?: string | null
          status?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          position: number
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          position?: number
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          position?: number
          slug?: string
        }
        Relationships: []
      }
      collections: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          launch_date: string | null
          name: string
          slug: string
          status: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          launch_date?: string | null
          name: string
          slug: string
          status?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          launch_date?: string | null
          name?: string
          slug?: string
          status?: string
        }
        Relationships: []
      }
      contact_enquiries: {
        Row: {
          category: string
          created_at: string
          email: string
          handled: boolean
          id: string
          message: string
          name: string
        }
        Insert: {
          category: string
          created_at?: string
          email: string
          handled?: boolean
          id?: string
          message: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          email?: string
          handled?: boolean
          id?: string
          message?: string
          name?: string
        }
        Relationships: []
      }
      discounts: {
        Row: {
          active: boolean
          code: string
          created_at: string
          ends_at: string | null
          id: string
          min_order_value: number
          per_customer_limit: number | null
          starts_at: string | null
          type: string
          usage_limit: number | null
          used_count: number
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          ends_at?: string | null
          id?: string
          min_order_value?: number
          per_customer_limit?: number | null
          starts_at?: string | null
          type: string
          usage_limit?: number | null
          used_count?: number
          value?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          min_order_value?: number
          per_customer_limit?: number | null
          starts_at?: string | null
          type?: string
          usage_limit?: number | null
          used_count?: number
          value?: number
        }
        Relationships: []
      }
      events: {
        Row: {
          city: string | null
          created_at: string
          event_date: string | null
          event_image_url: string | null
          id: string
          name: string
          status: string
          ticket_url: string | null
          venue: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          event_date?: string | null
          event_image_url?: string | null
          id?: string
          name: string
          status?: string
          ticket_url?: string | null
          venue?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          event_date?: string | null
          event_image_url?: string | null
          id?: string
          name?: string
          status?: string
          ticket_url?: string | null
          venue?: string | null
        }
        Relationships: []
      }
      music_releases: {
         Row: {
          accent_color: string | null
          announcement_text: string | null
          apple_music_url: string | null
          artist: string
          bandcamp_url: string | null
          copyright: string | null
          countdown_timezone: string
          countdown_visible: boolean
          cover_art_url: string | null
          created_at: string
          description: string | null
          explicit: boolean
          featured_artists: string | null
          id: string
          label: string | null
          pre_save_url: string | null
          release_date: string | null
          release_type: string
          slug: string
          soundcloud_url: string | null
          spotify_url: string | null
          status: string
          tidal_url: string | null
          title: string
          updated_at: string
          youtube_url: string | null
        }
        Insert: {
          accent_color?: string | null
          announcement_text?: string | null
          apple_music_url?: string | null
          artist?: string
          bandcamp_url?: string | null
          copyright?: string | null
          countdown_timezone?: string
          countdown_visible?: boolean
          cover_art_url?: string | null
          created_at?: string
          description?: string | null
          explicit?: boolean
          featured_artists?: string | null
          id?: string
          label?: string | null
          pre_save_url?: string | null
          release_date?: string | null
          release_type?: string
          slug: string
          soundcloud_url?: string | null
          spotify_url?: string | null
          status?: string
          tidal_url?: string | null
          title: string
          updated_at?: string
          youtube_url?: string | null
        }
        Update: {
          accent_color?: string | null
          announcement_text?: string | null
          apple_music_url?: string | null
          artist?: string
          bandcamp_url?: string | null
          copyright?: string | null
          countdown_timezone?: string
          countdown_visible?: boolean
          cover_art_url?: string | null
          created_at?: string
          description?: string | null
          explicit?: boolean
          featured_artists?: string | null
          id?: string
          label?: string | null
          pre_save_url?: string | null
          release_date?: string | null
          release_type?: string
          slug?: string
          soundcloud_url?: string | null
          spotify_url?: string | null
          status?: string
          tidal_url?: string | null
          title?: string
          updated_at?: string
          youtube_url?: string | null
        }
        Relationships: []
      }
      music_videos: {
        Row: {
          created_at: string
          description: string | null
          id: string
          release_date: string | null
          release_id: string | null
          slug: string
          status: string
          thumbnail_url: string | null
          title: string
          youtube_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          release_date?: string | null
          release_id?: string | null
          slug: string
          status?: string
          thumbnail_url?: string | null
          title: string
          youtube_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          release_date?: string | null
          release_id?: string | null
          slug?: string
          status?: string
          thumbnail_url?: string | null
          title?: string
          youtube_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "music_videos_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "music_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      news_articles: {
        Row: {
          author: string | null
          body: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published_at: string
          slug: string
          status: string
          title: string
        }
        Insert: {
          author?: string | null
          body: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string
          slug: string
          status?: string
          title: string
        }
        Update: {
          author?: string | null
          body?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string
          slug?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          consent_text: string
          email: string
          id: string
          subscribed_at: string
          unsubscribed_at: string | null
        }
        Insert: {
          consent_text: string
          email: string
          id?: string
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Update: {
          consent_text?: string
          email?: string
          id?: string
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          price: number
          product_name: string
          quantity: number
          variant_color: string | null
          variant_id: string | null
          variant_size: string | null
        }
        Insert: {
          id?: string
          order_id: string
          price: number
          product_name: string
          quantity: number
          variant_color?: string | null
          variant_id?: string | null
          variant_size?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          price?: number
          product_name?: string
          quantity?: number
          variant_color?: string | null
          variant_id?: string | null
          variant_size?: string | null
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
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address: Json | null
          created_at: string
          discount_amount: number
          discount_code: string | null
          email: string
          fulfilment_status: string
          id: string
          items: Json
          order_number: string
          owner_order_notified_at: string | null
          payment_intent_id: string | null
          payment_status: string
          shipping_address: Json | null
          shipping_charge: number
          shipping_method: string | null
          subtotal: number
          total: number
          tracking_reference: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          billing_address?: Json | null
          created_at?: string
          discount_amount?: number
          discount_code?: string | null
          email: string
          fulfilment_status?: string
          id?: string
          items?: Json
          order_number: string
          owner_order_notified_at?: string | null
          payment_intent_id?: string | null
          payment_status?: string
          shipping_address?: Json | null
          shipping_charge?: number
          shipping_method?: string | null
          subtotal?: number
          total?: number
          tracking_reference?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          billing_address?: Json | null
          created_at?: string
          discount_amount?: number
          discount_code?: string | null
          email?: string
          fulfilment_status?: string
          id?: string
          items?: Json
          order_number?: string
          owner_order_notified_at?: string | null
          payment_intent_id?: string | null
          payment_status?: string
          shipping_address?: Json | null
          shipping_charge?: number
          shipping_method?: string | null
          subtotal?: number
          total?: number
          tracking_reference?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          position: number
          product_id: string
          url: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          position?: number
          product_id: string
          url: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          position?: number
          product_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color: string
          created_at: string
          id: string
          price_override: number | null
          printful_sync_variant_id: number | null
          product_id: string
          size: string
          sku: string | null
          stock: number
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          price_override?: number | null
          printful_sync_variant_id?: number | null
          product_id: string
          size: string
          sku?: string | null
          stock?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          price_override?: number | null
          printful_sync_variant_id?: number | null
          product_id?: string
          size?: string
          sku?: string | null
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          availability_label: string | null
          available_for_sale: boolean
          category_id: string | null
          category_slug: string | null
          collection_id: string | null
          collection_slug: string | null
          compare_at_price: number | null
          created_at: string
          delivery_info: string | null
          description: string | null
          featured: boolean
          id: string
          is_limited_drop: boolean
          is_new_arrival: boolean
          material_care: string | null
          name: string
          price: number
          return_info: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          story: string | null
          updated_at: string
        }
        Insert: {
          availability_label?: string | null
          available_for_sale?: boolean
          category_id?: string | null
          category_slug?: string | null
          collection_id?: string | null
          collection_slug?: string | null
          compare_at_price?: number | null
          created_at?: string
          delivery_info?: string | null
          description?: string | null
          featured?: boolean
          id?: string
          is_limited_drop?: boolean
          is_new_arrival?: boolean
          material_care?: string | null
          name: string
          price: number
          return_info?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          story?: string | null
          updated_at?: string
        }
        Update: {
          availability_label?: string | null
          available_for_sale?: boolean
          category_id?: string | null
          category_slug?: string | null
          collection_id?: string | null
          collection_slug?: string | null
          compare_at_price?: number | null
          created_at?: string
          delivery_info?: string | null
          description?: string | null
          featured?: boolean
          id?: string
          is_limited_drop?: boolean
          is_new_arrival?: boolean
          material_care?: string | null
          name?: string
          price?: number
          return_info?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          story?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          amazon_music_url: string | null
          announcement_active: boolean
          announcement_text: string | null
          apple_music_url: string | null
          business_name: string
          contact_email: string | null
          currency: string
          facebook_url: string | null
          hero_headline: string
          hero_image_url: string | null
          hero_subtext: string
          hero_video_url: string | null
          id: string
          instagram_url: string | null
          maintenance_mode: boolean
          spotify_url: string | null
          store_address: string | null
          support_email: string | null
          tiktok_url: string | null
          updated_at: string
          website_url: string | null
          youtube_url: string | null
        }
        Insert: {
          amazon_music_url?: string | null
          announcement_active?: boolean
          announcement_text?: string | null
          apple_music_url?: string | null
          business_name?: string
          contact_email?: string | null
          currency?: string
          facebook_url?: string | null
          hero_headline?: string
          hero_image_url?: string | null
          hero_subtext?: string
          hero_video_url?: string | null
          id?: string
          instagram_url?: string | null
          maintenance_mode?: boolean
          spotify_url?: string | null
          store_address?: string | null
          support_email?: string | null
          tiktok_url?: string | null
          updated_at?: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          amazon_music_url?: string | null
          announcement_active?: boolean
          announcement_text?: string | null
          apple_music_url?: string | null
          business_name?: string
          contact_email?: string | null
          currency?: string
          facebook_url?: string | null
          hero_headline?: string
          hero_image_url?: string | null
          hero_subtext?: string
          hero_video_url?: string | null
          id?: string
          instagram_url?: string | null
          maintenance_mode?: boolean
          spotify_url?: string | null
          store_address?: string | null
          support_email?: string | null
          tiktok_url?: string | null
          updated_at?: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      tracks: {
        Row: {
          created_at: string
          duration: string | null
          explicit: boolean
          id: string
          position: number
          preview_url: string | null
          release_id: string
          title: string
        }
        Insert: {
          created_at?: string
          duration?: string | null
          explicit?: boolean
          id?: string
          position?: number
          preview_url?: string | null
          release_id: string
          title: string
        }
        Update: {
          created_at?: string
          duration?: string | null
          explicit?: boolean
          id?: string
          position?: number
          preview_url?: string | null
          release_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracks_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "music_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      mastering_credits: {
        Row: {
          created_at: string
          credits: number
          id: string
          total_purchased: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          id?: string
          total_purchased?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          credits?: number
          id?: string
          total_purchased?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_mastering_credit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      grant_mastering_credits: {
        Args: {
          p_credits: number
          p_payment_intent_id?: string | null
          p_stripe_session_id: string
          p_user_id: string
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

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
