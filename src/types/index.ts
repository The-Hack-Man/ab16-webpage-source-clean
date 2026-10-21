// Shared domain types for AB16 × Jamie G

import type { ElementType } from 'react';

export type Icon = ElementType;

export type ProductStatus = 'draft' | 'published' | 'archived';

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt_text: string | null;
  position: number;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  size: string;
  color: string;
  sku: string | null;
  stock: number;
  price_override: number | null; // pence
  printful_sync_variant_id: number | null;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  story: string | null;
  price: number; // pence
  compare_at_price: number | null;
  category_id: string | null;
  collection_slug: string | null;
  status: ProductStatus;
  available_for_sale: boolean;
  availability_label: string | null;
  featured: boolean;
  is_new_arrival: boolean;
  is_limited_drop: boolean;
  material_care: string | null;
  delivery_info: string | null;
  return_info: string | null;
  seo_title: string | null;
  seo_description: string | null;
  category_slug: string | null;
  created_at: string;
  product_images?: ProductImage[];
  product_variants?: ProductVariant[];
}

export interface CartItem {
  variant_id: string;
  product_id: string;
  product_slug: string;
  name: string;
  price: number;
  image_url: string | null;
  size: string;
  color: string;
  quantity: number;
  max_stock: number;
}

export type ReleaseStatus = 'draft' | 'scheduled' | 'upcoming' | 'published' | 'archived';
export type ReleaseType = 'single' | 'ep' | 'album' | 'mixtape' | 'deluxe' | 'feature' | 'remix' | 'instrumental';

export interface Track {
  id: string;
  release_id: string;
  title: string;
  position: number;
  duration: string | null;
  explicit: boolean;
  preview_url: string | null;
}

export interface MusicRelease {
  id: string;
  slug: string;
  title: string;
  artist: string;
  featured_artists: string | null;
  cover_art_url: string | null;
  release_type: ReleaseType;
  release_date: string | null;
  status: ReleaseStatus;
  description: string | null;
  spotify_url: string | null;
  apple_music_url: string | null;
  youtube_url: string | null;
  soundcloud_url: string | null;
  tidal_url: string | null;
  bandcamp_url: string | null;
  pre_save_url: string | null;
  label: string | null;
  copyright: string | null;
  explicit: boolean;
  accent_color: string | null;
  countdown_visible: boolean;
  countdown_timezone: string;
  announcement_text: string | null;
  tracks?: Track[];
}

export interface MusicVideo {
  id: string;
  slug: string;
  title: string;
  release_id: string | null;
  thumbnail_url: string | null;
  youtube_id: string | null;
  description: string | null;
  release_date: string | null;
  status: ProductStatus;
}

export interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  cover_image_url: string | null;
  body: string;
  author: string | null;
  published_at: string;
  status: ProductStatus;
  excerpt: string | null;
}

export interface Campaign {
  id: string;
  slug: string;
  name: string;
  hero_image_url: string | null;
  description: string | null;
  launch_date: string | null;
  start_date: string | null;
  end_date: string | null;
  status: 'draft' | 'scheduled' | 'live' | 'ended' | 'archived';
  discount_code: string | null;
}

export interface SiteSettings {
  id: string;
  website_url: string | null;
  business_name: string;
  contact_email: string | null;
  support_email: string | null;
  currency: string;
  store_address: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
  spotify_url: string | null;
  apple_music_url: string | null;
  amazon_music_url: string | null;
  facebook_url: string | null;
  announcement_text: string | null;
  announcement_active: boolean;
  hero_headline: string;
  hero_subtext: string;
  hero_image_url: string | null;
  maintenance_mode: boolean;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  consent_text: string;
  subscribed_at: string;
  unsubscribed_at: string | null;
}

export interface ContactEnquiry {
  id: string;
  name: string;
  email: string;
  category: string;
  message: string;
  created_at: string;
  handled: boolean;
}

export interface OrderAddress {
  firstName: string;
  lastName: string;
  address1: string;
  address2: string;
  city: string;
  postcode: string;
  country: string;
  phone?: string;
}

export interface Order {
  id: string;
  order_number: string;
  email: string;
  items: OrderItem[];
  shipping_address: OrderAddress;
  billing_address: OrderAddress;
  shipping_method: string | null;
  shipping_charge: number;
  discount_code: string | null;
  discount_amount: number;
  subtotal: number;
  total: number;
  payment_status: 'pending' | 'paid' | 'refunded' | 'failed';
  fulfilment_status: 'unfulfilled' | 'fulfilled' | 'shipped' | 'cancelled';
  tracking_reference: string | null;
  payment_intent_id: string | null;
  user_id: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  variant_id: string;
  product_name: string;
  variant_size: string;
  variant_color: string;
  quantity: number;
  price: number; // pence at purchase time
}
