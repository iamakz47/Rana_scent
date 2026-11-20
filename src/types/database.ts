
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "account_deletion_requests": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"reason": string,"resolution_note": string,"resolved_at": string | null,"resolved_by": string | null,"status": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string,"id"?: string,"reason"?: string,"resolution_note"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"reason"?: string,"resolution_note"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"id": number,"new_data": Json | null,"old_data": Json | null,"record_id": string | null,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"record_id"?: string | null,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"record_id"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"bundle_items": {
                  Row: {
                    "bundle_id": string,"item_product_id": string,"position": number,"quantity": number
                  }
                  ComputedFields: never
                  Insert: {
                    "bundle_id": string,"item_product_id": string,"position"?: number,"quantity"?: number
                  }
                  Update: {
                    "bundle_id"?: string,"item_product_id"?: string,"position"?: number,"quantity"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "bundle_items_bundle_id_fkey"
      columns: ["bundle_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bundle_items_item_product_id_fkey"
      columns: ["item_product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"description_ar": string,"description_en": string,"id": string,"image_id": string | null,"is_visible": boolean,"name_ar": string,"name_en": string,"position": number,"product_type": Database["public"]['Enums']["product_type"] | null,"seo_description_ar": string,"seo_description_en": string,"seo_title_ar": string,"seo_title_en": string,"show_on_home": boolean,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"description_ar"?: string,"description_en"?: string,"id"?: string,"image_id"?: string | null,"is_visible"?: boolean,"name_ar": string,"name_en": string,"position"?: number,"product_type"?: Database["public"]['Enums']["product_type"] | null,"seo_description_ar"?: string,"seo_description_en"?: string,"seo_title_ar"?: string,"seo_title_en"?: string,"show_on_home"?: boolean,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"description_ar"?: string,"description_en"?: string,"id"?: string,"image_id"?: string | null,"is_visible"?: boolean,"name_ar"?: string,"name_en"?: string,"position"?: number,"product_type"?: Database["public"]['Enums']["product_type"] | null,"seo_description_ar"?: string,"seo_description_en"?: string,"seo_title_ar"?: string,"seo_title_en"?: string,"show_on_home"?: boolean,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_image_id_fkey"
      columns: ["image_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["id"]
    }
                  ]
                },"customer_addresses": {
                  Row: {
                    "apartment": string,"area": string,"avenue": string,"block": string,"building": string,"created_at": string,"floor": string,"governorate": string,"id": string,"is_default": boolean,"label": string,"notes": string,"phone": string,"recipient_name": string,"street": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "apartment"?: string,"area": string,"avenue"?: string,"block": string,"building": string,"created_at"?: string,"floor"?: string,"governorate": string,"id"?: string,"is_default"?: boolean,"label"?: string,"notes"?: string,"phone": string,"recipient_name": string,"street": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "apartment"?: string,"area"?: string,"avenue"?: string,"block"?: string,"building"?: string,"created_at"?: string,"floor"?: string,"governorate"?: string,"id"?: string,"is_default"?: boolean,"label"?: string,"notes"?: string,"phone"?: string,"recipient_name"?: string,"street"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customer_addresses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"device_compatibility": {
                  Row: {
                    "compatible_product_id": string,"product_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "compatible_product_id": string,"product_id": string
                  }
                  Update: {
                    "compatible_product_id"?: string,"product_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "device_compatibility_compatible_product_id_fkey"
      columns: ["compatible_product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "device_compatibility_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"discount_codes": {
                  Row: {
                    "code": string,"created_at": string,"ends_at": string | null,"id": string,"is_active": boolean,"kind": string,"max_redemptions": number | null,"min_subtotal_fils": number,"redemptions_count": number,"starts_at": string | null,"updated_at": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"ends_at"?: string | null,"id"?: string,"is_active"?: boolean,"kind": string,"max_redemptions"?: number | null,"min_subtotal_fils"?: number,"redemptions_count"?: number,"starts_at"?: string | null,"updated_at"?: string,"value": number
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"ends_at"?: string | null,"id"?: string,"is_active"?: boolean,"kind"?: string,"max_redemptions"?: number | null,"min_subtotal_fils"?: number,"redemptions_count"?: number,"starts_at"?: string | null,"updated_at"?: string,"value"?: number
                  }
                  Relationships: [
                    
                  ]
                },"email_messages": {
                  Row: {
                    "attempts": number,"audience": string,"created_at": string,"dedupe_key": string,"id": string,"kind": string,"last_error": string,"locale": string,"max_attempts": number,"next_attempt_at": string,"order_id": string | null,"payload": NonNullable<Json>,"provider": string,"provider_message_id": string,"refund_id": string | null,"sent_at": string | null,"status": string,"subject": string,"to_email": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"audience": string,"created_at"?: string,"dedupe_key": string,"id"?: string,"kind": string,"last_error"?: string,"locale"?: string,"max_attempts"?: number,"next_attempt_at"?: string,"order_id"?: string | null,"payload"?: NonNullable<Json>,"provider"?: string,"provider_message_id"?: string,"refund_id"?: string | null,"sent_at"?: string | null,"status"?: string,"subject"?: string,"to_email"?: string,"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"audience"?: string,"created_at"?: string,"dedupe_key"?: string,"id"?: string,"kind"?: string,"last_error"?: string,"locale"?: string,"max_attempts"?: number,"next_attempt_at"?: string,"order_id"?: string | null,"payload"?: NonNullable<Json>,"provider"?: string,"provider_message_id"?: string,"refund_id"?: string | null,"sent_at"?: string | null,"status"?: string,"subject"?: string,"to_email"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "email_messages_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "email_messages_refund_id_fkey"
      columns: ["refund_id"]
isOneToOne: false
      referencedRelation: "refund_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "amount_fils": number,"category": string,"created_at": string,"created_by": string | null,"description": string,"id": string,"incurred_on": string,"receipt_media_id": string | null,"updated_at": string,"vendor": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_fils": number,"category": string,"created_at"?: string,"created_by"?: string | null,"description": string,"id"?: string,"incurred_on": string,"receipt_media_id"?: string | null,"updated_at"?: string,"vendor"?: string
                  }
                  Update: {
                    "amount_fils"?: number,"category"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"incurred_on"?: string,"receipt_media_id"?: string | null,"updated_at"?: string,"vendor"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_receipt_media_id_fkey"
      columns: ["receipt_media_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["id"]
    }
                  ]
                },"homepage_sections": {
                  Row: {
                    "body_ar": string,"body_en": string,"is_visible": boolean,"key": string,"position": number,"title_ar": string,"title_en": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body_ar"?: string,"body_en"?: string,"is_visible"?: boolean,"key": string,"position"?: number,"title_ar"?: string,"title_en"?: string,"updated_at"?: string
                  }
                  Update: {
                    "body_ar"?: string,"body_en"?: string,"is_visible"?: boolean,"key"?: string,"position"?: number,"title_ar"?: string,"title_en"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"homepage_slides": {
                  Row: {
                    "accent": string | null,"alt_ar": string,"alt_en": string,"composition": string | null,"created_at": string,"description_ar": string,"description_en": string,"desktop_media_id": string | null,"id": string,"is_enabled": boolean,"mobile_media_id": string | null,"position": number,"primary_cta_href": string,"primary_cta_label_ar": string,"primary_cta_label_en": string,"published_at": string | null,"secondary_cta_href": string | null,"secondary_cta_label_ar": string | null,"secondary_cta_label_en": string | null,"status": Database["public"]['Enums']["publish_status"],"theme": string,"title_ar": string,"title_en": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accent"?: string | null,"alt_ar"?: string,"alt_en"?: string,"composition"?: string | null,"created_at"?: string,"description_ar"?: string,"description_en"?: string,"desktop_media_id"?: string | null,"id"?: string,"is_enabled"?: boolean,"mobile_media_id"?: string | null,"position"?: number,"primary_cta_href": string,"primary_cta_label_ar": string,"primary_cta_label_en": string,"published_at"?: string | null,"secondary_cta_href"?: string | null,"secondary_cta_label_ar"?: string | null,"secondary_cta_label_en"?: string | null,"status"?: Database["public"]['Enums']["publish_status"],"theme"?: string,"title_ar": string,"title_en": string,"updated_at"?: string
                  }
                  Update: {
                    "accent"?: string | null,"alt_ar"?: string,"alt_en"?: string,"composition"?: string | null,"created_at"?: string,"description_ar"?: string,"description_en"?: string,"desktop_media_id"?: string | null,"id"?: string,"is_enabled"?: boolean,"mobile_media_id"?: string | null,"position"?: number,"primary_cta_href"?: string,"primary_cta_label_ar"?: string,"primary_cta_label_en"?: string,"published_at"?: string | null,"secondary_cta_href"?: string | null,"secondary_cta_label_ar"?: string | null,"secondary_cta_label_en"?: string | null,"status"?: Database["public"]['Enums']["publish_status"],"theme"?: string,"title_ar"?: string,"title_en"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "homepage_slides_desktop_media_id_fkey"
      columns: ["desktop_media_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "homepage_slides_mobile_media_id_fkey"
      columns: ["mobile_media_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory": {
                  Row: {
                    "low_stock_threshold": number,"on_hand": number,"track_inventory": boolean,"updated_at": string,"variant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "low_stock_threshold"?: number,"on_hand"?: number,"track_inventory"?: boolean,"updated_at"?: string,"variant_id": string
                  }
                  Update: {
                    "low_stock_threshold"?: number,"on_hand"?: number,"track_inventory"?: boolean,"updated_at"?: string,"variant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: true
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_movements": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"id": number,"note": string,"order_id": string | null,"quantity_after": number,"quantity_change": number,"reason": Database["public"]['Enums']["inventory_reason"],"variant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"id"?: never,"note"?: string,"order_id"?: string | null,"quantity_after": number,"quantity_change": number,"reason": Database["public"]['Enums']["inventory_reason"],"variant_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"id"?: never,"note"?: string,"order_id"?: string | null,"quantity_after"?: number,"quantity_change"?: number,"reason"?: Database["public"]['Enums']["inventory_reason"],"variant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_movements_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_movements_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"media_assets": {
                  Row: {
                    "alt_ar": string,"alt_en": string,"bucket": string,"created_at": string,"created_by": string | null,"height": number | null,"id": string,"mime_type": string,"path": string,"size_bytes": number | null,"updated_at": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alt_ar"?: string,"alt_en"?: string,"bucket": string,"created_at"?: string,"created_by"?: string | null,"height"?: number | null,"id"?: string,"mime_type": string,"path": string,"size_bytes"?: number | null,"updated_at"?: string,"width"?: number | null
                  }
                  Update: {
                    "alt_ar"?: string,"alt_en"?: string,"bucket"?: string,"created_at"?: string,"created_by"?: string | null,"height"?: number | null,"id"?: string,"mime_type"?: string,"path"?: string,"size_bytes"?: number | null,"updated_at"?: string,"width"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"notification_settings": {
                  Row: {
                    "customer_emails_enabled": boolean,"id": number,"low_stock_alerts": boolean,"staff_email": string,"staff_locale": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "customer_emails_enabled"?: boolean,"id"?: number,"low_stock_alerts"?: boolean,"staff_email"?: string,"staff_locale"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "customer_emails_enabled"?: boolean,"id"?: number,"low_stock_alerts"?: boolean,"staff_email"?: string,"staff_locale"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"order_item_fragrances": {
                  Row: {
                    "device_no": number,"fragrance_product_id": string | null,"id": number,"name_ar": string,"name_en": string,"order_item_id": string,"slot": number
                  }
                  ComputedFields: never
                  Insert: {
                    "device_no": number,"fragrance_product_id"?: string | null,"id"?: never,"name_ar": string,"name_en": string,"order_item_id": string,"slot": number
                  }
                  Update: {
                    "device_no"?: number,"fragrance_product_id"?: string | null,"id"?: never,"name_ar"?: string,"name_en"?: string,"order_item_id"?: string,"slot"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_item_fragrances_fragrance_product_id_fkey"
      columns: ["fragrance_product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_item_fragrances_order_item_id_fkey"
      columns: ["order_item_id"]
isOneToOne: false
      referencedRelation: "order_items"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "id": string,"line_total_fils": number,"name_ar": string,"name_en": string,"order_id": string,"product_id": string | null,"quantity": number,"sku": string,"unit_price_fils": number,"variant_id": string | null,"variant_label_ar": string,"variant_label_en": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"line_total_fils": number,"name_ar": string,"name_en": string,"order_id": string,"product_id"?: string | null,"quantity": number,"sku": string,"unit_price_fils": number,"variant_id"?: string | null,"variant_label_ar"?: string,"variant_label_en"?: string
                  }
                  Update: {
                    "id"?: string,"line_total_fils"?: number,"name_ar"?: string,"name_en"?: string,"order_id"?: string,"product_id"?: string | null,"quantity"?: number,"sku"?: string,"unit_price_fils"?: number,"variant_id"?: string | null,"variant_label_ar"?: string,"variant_label_en"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"order_notes": {
                  Row: {
                    "actor_id": string | null,"body": string,"created_at": string,"id": number,"order_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"body": string,"created_at"?: string,"id"?: never,"order_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"body"?: string,"created_at"?: string,"id"?: never,"order_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_notes_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_status_history": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"from_status": Database["public"]['Enums']["order_status"] | null,"id": number,"note": string,"order_id": string,"to_status": Database["public"]['Enums']["order_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["order_status"] | null,"id"?: never,"note"?: string,"order_id": string,"to_status": Database["public"]['Enums']["order_status"]
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["order_status"] | null,"id"?: never,"note"?: string,"order_id"?: string,"to_status"?: Database["public"]['Enums']["order_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_status_history_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "access_token": string,"courier": string,"created_at": string,"currency": string,"customer_name": string,"customer_note": string,"delivery_instructions": string,"discount_code_id": string | null,"discount_fils": number,"email": string,"estimated_delivery": string | null,"expires_at": string | null,"id": string,"idempotency_key": string | null,"locale": string,"number": number,"payment_method": string,"phone": string,"placed_at": string | null,"refunded_fils": number,"shipping_address": NonNullable<Json>,"shipping_fils": number,"shipping_rate_id": string | null,"status": Database["public"]['Enums']["order_status"],"stock_released": boolean,"subtotal_fils": number,"total_fils": number,"tracking_number": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "access_token"?: string,"courier"?: string,"created_at"?: string,"currency"?: string,"customer_name"?: string,"customer_note"?: string,"delivery_instructions"?: string,"discount_code_id"?: string | null,"discount_fils"?: number,"email": string,"estimated_delivery"?: string | null,"expires_at"?: string | null,"id"?: string,"idempotency_key"?: string | null,"locale"?: string,"number"?: never,"payment_method"?: string,"phone": string,"placed_at"?: string | null,"refunded_fils"?: number,"shipping_address": NonNullable<Json>,"shipping_fils"?: number,"shipping_rate_id"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"stock_released"?: boolean,"subtotal_fils": number,"total_fils": number,"tracking_number"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "access_token"?: string,"courier"?: string,"created_at"?: string,"currency"?: string,"customer_name"?: string,"customer_note"?: string,"delivery_instructions"?: string,"discount_code_id"?: string | null,"discount_fils"?: number,"email"?: string,"estimated_delivery"?: string | null,"expires_at"?: string | null,"id"?: string,"idempotency_key"?: string | null,"locale"?: string,"number"?: never,"payment_method"?: string,"phone"?: string,"placed_at"?: string | null,"refunded_fils"?: number,"shipping_address"?: NonNullable<Json>,"shipping_fils"?: number,"shipping_rate_id"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"stock_released"?: boolean,"subtotal_fils"?: number,"total_fils"?: number,"tracking_number"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_discount_code_id_fkey"
      columns: ["discount_code_id"]
isOneToOne: false
      referencedRelation: "discount_codes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_shipping_rate_id_fkey"
      columns: ["shipping_rate_id"]
isOneToOne: false
      referencedRelation: "shipping_rates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_events": {
                  Row: {
                    "event_type": string,"id": number,"payload": NonNullable<Json>,"payment_id": string | null,"processed_at": string | null,"provider": string,"provider_event_id": string,"received_at": string,"signature_valid": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "event_type": string,"id"?: never,"payload": NonNullable<Json>,"payment_id"?: string | null,"processed_at"?: string | null,"provider"?: string,"provider_event_id": string,"received_at"?: string,"signature_valid": boolean
                  }
                  Update: {
                    "event_type"?: string,"id"?: never,"payload"?: NonNullable<Json>,"payment_id"?: string | null,"processed_at"?: string | null,"provider"?: string,"provider_event_id"?: string,"received_at"?: string,"signature_valid"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_events_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_fils": number,"created_at": string,"currency": string,"id": string,"method": string | null,"order_id": string,"provider": string,"provider_charge_id": string | null,"provider_reference": string | null,"raw_status": string | null,"status": Database["public"]['Enums']["payment_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_fils": number,"created_at"?: string,"currency"?: string,"id"?: string,"method"?: string | null,"order_id": string,"provider"?: string,"provider_charge_id"?: string | null,"provider_reference"?: string | null,"raw_status"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string
                  }
                  Update: {
                    "amount_fils"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"method"?: string | null,"order_id"?: string,"provider"?: string,"provider_charge_id"?: string | null,"provider_reference"?: string | null,"raw_status"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"permissions": {
                  Row: {
                    "description": string,"key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"key": string
                  }
                  Update: {
                    "description"?: string,"key"?: string
                  }
                  Relationships: [
                    
                  ]
                },"product_categories": {
                  Row: {
                    "category_id": string,"is_primary": boolean,"product_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"is_primary"?: boolean,"product_id": string
                  }
                  Update: {
                    "category_id"?: string,"is_primary"?: boolean,"product_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_categories_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_categories_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"product_media": {
                  Row: {
                    "media_id": string,"position": number,"product_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "media_id": string,"position"?: number,"product_id": string
                  }
                  Update: {
                    "media_id"?: string,"position"?: number,"product_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_media_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_media_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"product_scents": {
                  Row: {
                    "position": number,"product_id": string,"scent_family_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "position"?: number,"product_id": string,"scent_family_id": string
                  }
                  Update: {
                    "position"?: number,"product_id"?: string,"scent_family_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_scents_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_scents_scent_family_id_fkey"
      columns: ["scent_family_id"]
isOneToOne: false
      referencedRelation: "scent_families"
      referencedColumns: ["id"]
    }
                  ]
                },"product_variants": {
                  Row: {
                    "compare_at_fils": number | null,"created_at": string,"id": string,"is_active": boolean,"label_ar": string,"label_en": string,"position": number,"price_fils": number,"product_id": string,"sku": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "compare_at_fils"?: number | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"label_ar": string,"label_en": string,"position"?: number,"price_fils": number,"product_id": string,"sku": string,"updated_at"?: string
                  }
                  Update: {
                    "compare_at_fils"?: number | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"label_ar"?: string,"label_en"?: string,"position"?: number,"price_fils"?: number,"product_id"?: string,"sku"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_variants_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description_ar": string,"description_en": string,"device_specs": NonNullable<Json>,"free_fragrance_eligible": boolean,"free_fragrances": number | null,"id": string,"info_sections": NonNullable<Json>,"is_featured": boolean,"is_new": boolean,"name_ar": string,"name_en": string,"notes": Json | null,"position": number,"published_at": string | null,"seo_description_ar": string,"seo_description_en": string,"seo_title_ar": string,"seo_title_en": string,"short_description_ar": string,"short_description_en": string,"slug": string,"spaces": (string)[],"specs": NonNullable<Json>,"specs_confirmed": boolean,"status": Database["public"]['Enums']["publish_status"],"type": Database["public"]['Enums']["product_type"],"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description_ar"?: string,"description_en"?: string,"device_specs"?: NonNullable<Json>,"free_fragrance_eligible"?: boolean,"free_fragrances"?: number | null,"id"?: string,"info_sections"?: NonNullable<Json>,"is_featured"?: boolean,"is_new"?: boolean,"name_ar": string,"name_en": string,"notes"?: Json | null,"position"?: number,"published_at"?: string | null,"seo_description_ar"?: string,"seo_description_en"?: string,"seo_title_ar"?: string,"seo_title_en"?: string,"short_description_ar"?: string,"short_description_en"?: string,"slug": string,"spaces"?: (string)[],"specs"?: NonNullable<Json>,"specs_confirmed"?: boolean,"status"?: Database["public"]['Enums']["publish_status"],"type": Database["public"]['Enums']["product_type"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description_ar"?: string,"description_en"?: string,"device_specs"?: NonNullable<Json>,"free_fragrance_eligible"?: boolean,"free_fragrances"?: number | null,"id"?: string,"info_sections"?: NonNullable<Json>,"is_featured"?: boolean,"is_new"?: boolean,"name_ar"?: string,"name_en"?: string,"notes"?: Json | null,"position"?: number,"published_at"?: string | null,"seo_description_ar"?: string,"seo_description_en"?: string,"seo_title_ar"?: string,"seo_title_en"?: string,"short_description_ar"?: string,"short_description_en"?: string,"slug"?: string,"spaces"?: (string)[],"specs"?: NonNullable<Json>,"specs_confirmed"?: boolean,"status"?: Database["public"]['Enums']["publish_status"],"type"?: Database["public"]['Enums']["product_type"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string,"id": string,"marketing_opt_in": boolean,"phone": string | null,"preferred_locale": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name"?: string,"id": string,"marketing_opt_in"?: boolean,"phone"?: string | null,"preferred_locale"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string,"id"?: string,"marketing_opt_in"?: boolean,"phone"?: string | null,"preferred_locale"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"promotions": {
                  Row: {
                    "body_ar": string,"body_en": string,"created_at": string,"ends_at": string | null,"href": string | null,"id": string,"is_active": boolean,"media_id": string | null,"position": number,"starts_at": string | null,"title_ar": string,"title_en": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body_ar"?: string,"body_en"?: string,"created_at"?: string,"ends_at"?: string | null,"href"?: string | null,"id"?: string,"is_active"?: boolean,"media_id"?: string | null,"position"?: number,"starts_at"?: string | null,"title_ar": string,"title_en": string,"updated_at"?: string
                  }
                  Update: {
                    "body_ar"?: string,"body_en"?: string,"created_at"?: string,"ends_at"?: string | null,"href"?: string | null,"id"?: string,"is_active"?: boolean,"media_id"?: string | null,"position"?: number,"starts_at"?: string | null,"title_ar"?: string,"title_en"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "promotions_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["id"]
    }
                  ]
                },"refund_requests": {
                  Row: {
                    "amount_fils": number,"approved_at": string | null,"approved_by": string | null,"created_at": string,"id": string,"last_error": string,"order_id": string,"payment_id": string | null,"processed_at": string | null,"processed_by": string | null,"provider_refund_id": string | null,"provider_status": string,"reason": string,"requested_by": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_fils": number,"approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"id"?: string,"last_error"?: string,"order_id": string,"payment_id"?: string | null,"processed_at"?: string | null,"processed_by"?: string | null,"provider_refund_id"?: string | null,"provider_status"?: string,"reason": string,"requested_by"?: string | null,"status"?: string
                  }
                  Update: {
                    "amount_fils"?: number,"approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"id"?: string,"last_error"?: string,"order_id"?: string,"payment_id"?: string | null,"processed_at"?: string | null,"processed_by"?: string | null,"provider_refund_id"?: string | null,"provider_status"?: string,"reason"?: string,"requested_by"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "refund_requests_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refund_requests_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    }
                  ]
                },"role_permissions": {
                  Row: {
                    "permission": string,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "permission": string,"role": string
                  }
                  Update: {
                    "permission"?: string,"role"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "role_permissions_permission_fkey"
      columns: ["permission"]
isOneToOne: false
      referencedRelation: "permissions"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "role_permissions_role_fkey"
      columns: ["role"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["key"]
    }
                  ]
                },"roles": {
                  Row: {
                    "description_ar": string,"description_en": string,"key": string,"name_ar": string,"name_en": string,"rank": number
                  }
                  ComputedFields: never
                  Insert: {
                    "description_ar"?: string,"description_en"?: string,"key": string,"name_ar": string,"name_en": string,"rank": number
                  }
                  Update: {
                    "description_ar"?: string,"description_en"?: string,"key"?: string,"name_ar"?: string,"name_en"?: string,"rank"?: number
                  }
                  Relationships: [
                    
                  ]
                },"scent_families": {
                  Row: {
                    "created_at": string,"id": string,"name_ar": string,"name_en": string,"notes_ar": string,"notes_en": string,"position": number,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name_ar": string,"name_en": string,"notes_ar"?: string,"notes_en"?: string,"position"?: number,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name_ar"?: string,"name_en"?: string,"notes_ar"?: string,"notes_en"?: string,"position"?: number,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"shipping_rates": {
                  Row: {
                    "created_at": string,"free_over_fils": number | null,"id": string,"is_active": boolean,"max_days": number,"min_days": number,"name_ar": string,"name_en": string,"price_fils": number,"updated_at": string,"zone_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"free_over_fils"?: number | null,"id"?: string,"is_active"?: boolean,"max_days"?: number,"min_days"?: number,"name_ar": string,"name_en": string,"price_fils": number,"updated_at"?: string,"zone_id": string
                  }
                  Update: {
                    "created_at"?: string,"free_over_fils"?: number | null,"id"?: string,"is_active"?: boolean,"max_days"?: number,"min_days"?: number,"name_ar"?: string,"name_en"?: string,"price_fils"?: number,"updated_at"?: string,"zone_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shipping_rates_zone_id_fkey"
      columns: ["zone_id"]
isOneToOne: false
      referencedRelation: "shipping_zones"
      referencedColumns: ["id"]
    }
                  ]
                },"shipping_zones": {
                  Row: {
                    "areas": (string)[],"created_at": string,"governorates": (string)[],"id": string,"is_active": boolean,"name_ar": string,"name_en": string,"position": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "areas"?: (string)[],"created_at"?: string,"governorates"?: (string)[],"id"?: string,"is_active"?: boolean,"name_ar": string,"name_en": string,"position"?: number,"updated_at"?: string
                  }
                  Update: {
                    "areas"?: (string)[],"created_at"?: string,"governorates"?: (string)[],"id"?: string,"is_active"?: boolean,"name_ar"?: string,"name_en"?: string,"position"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"site_policies": {
                  Row: {
                    "draft_body_ar": string,"draft_body_en": string,"draft_title_ar": string,"draft_title_en": string,"draft_updated_at": string,"draft_updated_by": string | null,"key": string,"position": number,"published_at": string | null,"published_body_ar": string,"published_body_en": string,"published_by": string | null,"published_title_ar": string,"published_title_en": string
                  }
                  ComputedFields: never
                  Insert: {
                    "draft_body_ar"?: string,"draft_body_en"?: string,"draft_title_ar"?: string,"draft_title_en"?: string,"draft_updated_at"?: string,"draft_updated_by"?: string | null,"key": string,"position"?: number,"published_at"?: string | null,"published_body_ar"?: string,"published_body_en"?: string,"published_by"?: string | null,"published_title_ar"?: string,"published_title_en"?: string
                  }
                  Update: {
                    "draft_body_ar"?: string,"draft_body_en"?: string,"draft_title_ar"?: string,"draft_title_en"?: string,"draft_updated_at"?: string,"draft_updated_by"?: string | null,"key"?: string,"position"?: number,"published_at"?: string | null,"published_body_ar"?: string,"published_body_en"?: string,"published_by"?: string | null,"published_title_ar"?: string,"published_title_en"?: string
                  }
                  Relationships: [
                    
                  ]
                },"staff_members": {
                  Row: {
                    "created_at": string,"display_name": string,"invited_by": string | null,"is_active": boolean,"role": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string,"invited_by"?: string | null,"is_active"?: boolean,"role": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"invited_by"?: string | null,"is_active"?: boolean,"role"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_members_role_fkey"
      columns: ["role"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["key"]
    }
                  ]
                },"store_settings": {
                  Row: {
                    "cod_enabled": boolean,"contact_email": string,"contact_phone": string,"currency": string,"default_low_stock_threshold": number,"delivery_note_ar": string,"delivery_note_en": string,"free_fragrance_allow_duplicates": boolean,"id": number,"instagram_handle": string,"online_payments_enabled": boolean,"order_expiry_minutes": number,"slider_autoplay": boolean,"slider_interval_seconds": number,"updated_at": string,"updated_by": string | null,"whatsapp_number": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cod_enabled"?: boolean,"contact_email"?: string,"contact_phone"?: string,"currency"?: string,"default_low_stock_threshold"?: number,"delivery_note_ar"?: string,"delivery_note_en"?: string,"free_fragrance_allow_duplicates"?: boolean,"id"?: number,"instagram_handle"?: string,"online_payments_enabled"?: boolean,"order_expiry_minutes"?: number,"slider_autoplay"?: boolean,"slider_interval_seconds"?: number,"updated_at"?: string,"updated_by"?: string | null,"whatsapp_number"?: string
                  }
                  Update: {
                    "cod_enabled"?: boolean,"contact_email"?: string,"contact_phone"?: string,"currency"?: string,"default_low_stock_threshold"?: number,"delivery_note_ar"?: string,"delivery_note_en"?: string,"free_fragrance_allow_duplicates"?: boolean,"id"?: number,"instagram_handle"?: string,"online_payments_enabled"?: boolean,"order_expiry_minutes"?: number,"slider_autoplay"?: boolean,"slider_interval_seconds"?: number,"updated_at"?: string,"updated_by"?: string | null,"whatsapp_number"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "abandon_unstarted_payment":
{ Args: { "p_order": string }; Returns: boolean
                           },
"adjust_inventory":
{ Args: { "note"?: string,"quantity_change": number,"reason": Database["public"]['Enums']["inventory_reason"],"target_variant": string }; Returns: number
                           },
"approve_refund":
{ Args: { "p_request": string }; Returns: Json
                           },
"assign_staff_role":
{ Args: { "name"?: string,"target_email": string,"target_role": string }; Returns: string
                           },
"attach_payment_charge":
{ Args: { "p_charge_id": string,"p_order": string,"p_provider": string }; Returns: undefined
                           },
"claim_email_batch":
{ Args: { "p_limit"?: number }; Returns: {
              "attempts": number,
"audience": string,
"created_at": string,
"dedupe_key": string,
"id": string,
"kind": string,
"last_error": string,
"locale": string,
"max_attempts": number,
"next_attempt_at": string,
"order_id": string | null,
"payload": NonNullable<Json>,
"provider": string,
"provider_message_id": string,
"refund_id": string | null,
"sent_at": string | null,
"status": string,
"subject": string,
"to_email": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "email_messages"
        isOneToOne: false
        isSetofReturn: true
      } },
"claim_guest_order":
{ Args: { "p_number": number,"p_token": string }; Returns: boolean
                           },
"consume_rate_limit":
{ Args: { "p_bucket": string,"p_limit": number,"p_window_seconds": number }; Returns: boolean
                           },
"expire_unpaid_orders":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"finish_email":
{ Args: { "p_error": string,"p_id": string,"p_ok": boolean,"p_provider": string,"p_provider_message_id": string,"p_subject": string }; Returns: undefined
                           },
"get_order_for_customer":
{ Args: { "order_number": number,"token": string }; Returns: Json
                           },
"get_policy":
{ Args: { "p_key": string }; Returns: Json
                           },
"list_customers":
{ Args: { "p_search"?: string }; Returns: {
              "customer_name": string,"email": string,"has_account": boolean,"last_order_at": string,"orders_count": number,"paid_total_fils": number,"phone": string
            }[]
                           },
"list_free_fragrances":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"name_ar": string,"name_en": string,"slug": string
            }[]
                           },
"list_published_policies":
{ Args: Record<PropertyKey, never>; Returns: {
              "key": string,"published_at": string,"title_ar": string,"title_en": string
            }[]
                           },
"list_staff":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"display_name": string,"email": string,"is_active": boolean,"last_sign_in_at": string,"role": string,"user_id": string
            }[]
                           },
"log_account_email":
{ Args: { "p_error": string,"p_kind": string,"p_locale": string,"p_ok": boolean,"p_provider": string,"p_provider_message_id": string,"p_to": string }; Returns: undefined
                           },
"media_usage":
{ Args: { "target": string }; Returns: {
              "kind": string,"label": string,"ref_id": string
            }[]
                           },
"my_orders":
{ Args: Record<PropertyKey, never>; Returns: {
              "access_token": string,"created_at": string,"items_count": number,"number": number,"payment_method": string,"placed_at": string,"status": Database["public"]['Enums']["order_status"],"total_fils": number
            }[]
                           },
"payments_to_reconcile":
{ Args: { "p_limit"?: number,"p_min_age_seconds"?: number }; Returns: {
              "kind": string,"order_id": string,"provider": string,"provider_id": string,"refund_id": string
            }[]
                           },
"place_order":
{ Args: { "p_payload": Json }; Returns: Json
                           },
"publish_policy":
{ Args: { "p_key": string }; Returns: undefined
                           },
"quote_order":
{ Args: { "p_area"?: string,"p_discount_code"?: string,"p_governorate"?: string,"p_items": Json }; Returns: Json
                           },
"record_payment_result":
{ Args: { "p_amount_fils": number,"p_charge_id": string,"p_currency": string,"p_event_id": string,"p_method": string,"p_payload": Json,"p_provider": string,"p_reference": string,"p_signature_valid": boolean,"p_status": string }; Returns: string
                           },
"record_refund_result":
{ Args: { "p_amount_fils": number,"p_currency": string,"p_error"?: string,"p_provider_refund_id": string,"p_request": string,"p_status": string }; Returns: string
                           },
"reopen_refund":
{ Args: { "p_request": string }; Returns: undefined
                           },
"reorder":
{ Args: { "ids": (string)[],"target_table": string }; Returns: undefined
                           },
"request_account_deletion":
{ Args: { "p_reason"?: string }; Returns: string
                           },
"request_refund":
{ Args: { "p_amount": number,"p_order": string,"p_reason": string }; Returns: string
                           },
"resolve_account_deletion":
{ Args: { "p_complete": boolean,"p_note"?: string,"p_request": string }; Returns: string
                           },
"resolve_refund":
{ Args: { "p_approve": boolean,"p_provider_refund_id"?: string,"p_request": string }; Returns: undefined
                           },
"retry_email":
{ Args: { "p_id": string }; Returns: undefined
                           },
"save_policy_draft":
{ Args: { "p_body_ar": string,"p_body_en": string,"p_key": string,"p_title_ar": string,"p_title_en": string }; Returns: undefined
                           },
"save_product":
{ Args: { "payload": Json }; Returns: string
                           },
"set_default_address":
{ Args: { "p_address": string }; Returns: undefined
                           },
"unpublish_policy":
{ Args: { "p_key": string }; Returns: undefined
                           },
"withdraw_account_deletion":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           }
          }
          Enums: {
            "inventory_reason": "initial"|"restock"|"adjustment"|"correction"|"damage"|"sale"|"return","order_status": "pending"|"awaiting_payment"|"paid"|"processing"|"ready_for_delivery"|"out_for_delivery"|"shipped"|"delivered"|"cancelled"|"refunded","payment_status": "initiated"|"authorized"|"captured"|"failed"|"cancelled"|"refunded","product_type": "diffuser"|"refill"|"accessory"|"bundle","publish_status": "draft"|"published"|"archived"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "inventory_reason": ["initial", "restock", "adjustment", "correction", "damage", "sale", "return"],"order_status": ["pending", "awaiting_payment", "paid", "processing", "ready_for_delivery", "out_for_delivery", "shipped", "delivered", "cancelled", "refunded"],"payment_status": ["initiated", "authorized", "captured", "failed", "cancelled", "refunded"],"product_type": ["diffuser", "refill", "accessory", "bundle"],"publish_status": ["draft", "published", "archived"]
          }
        }
} as const
