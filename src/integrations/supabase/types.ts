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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          created_at: string
          error_message: string | null
          estimated_cost_usd: number | null
          function_name: string
          id: string
          input_tokens: number | null
          metadata: Json | null
          model: string
          output_tokens: number | null
          success: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          estimated_cost_usd?: number | null
          function_name: string
          id?: string
          input_tokens?: number | null
          metadata?: Json | null
          model: string
          output_tokens?: number | null
          success?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          estimated_cost_usd?: number | null
          function_name?: string
          id?: string
          input_tokens?: number | null
          metadata?: Json | null
          model?: string
          output_tokens?: number | null
          success?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      body_measurements: {
        Row: {
          arm_cm: number | null
          body_fat_percent: number | null
          calf_cm: number | null
          chest_cm: number | null
          created_at: string
          hip_cm: number | null
          id: string
          measurement_date: string
          notes: string | null
          recorded_by: string | null
          thigh_cm: number | null
          user_id: string
          waist_cm: number | null
        }
        Insert: {
          arm_cm?: number | null
          body_fat_percent?: number | null
          calf_cm?: number | null
          chest_cm?: number | null
          created_at?: string
          hip_cm?: number | null
          id?: string
          measurement_date?: string
          notes?: string | null
          recorded_by?: string | null
          thigh_cm?: number | null
          user_id: string
          waist_cm?: number | null
        }
        Update: {
          arm_cm?: number | null
          body_fat_percent?: number | null
          calf_cm?: number | null
          chest_cm?: number | null
          created_at?: string
          hip_cm?: number | null
          id?: string
          measurement_date?: string
          notes?: string | null
          recorded_by?: string | null
          thigh_cm?: number | null
          user_id?: string
          waist_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_measurements_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "body_measurements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      conversion_events: {
        Row: {
          created_at: string
          event_type: string
          feature_key: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          feature_key: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          feature_key?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      daily_logs: {
        Row: {
          created_at: string
          diet_plan_id: string
          id: string
          log_date: string
          status: Database["public"]["Enums"]["daily_status"]
          total_calories_consumed: number | null
          total_carbs_consumed: number | null
          total_fat_consumed: number | null
          total_protein_consumed: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          diet_plan_id: string
          id?: string
          log_date: string
          status?: Database["public"]["Enums"]["daily_status"]
          total_calories_consumed?: number | null
          total_carbs_consumed?: number | null
          total_fat_consumed?: number | null
          total_protein_consumed?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          diet_plan_id?: string
          id?: string
          log_date?: string
          status?: Database["public"]["Enums"]["daily_status"]
          total_calories_consumed?: number | null
          total_carbs_consumed?: number | null
          total_fat_consumed?: number | null
          total_protein_consumed?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_diet_plan_id_fkey"
            columns: ["diet_plan_id"]
            isOneToOne: false
            referencedRelation: "diet_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      diet_plans: {
        Row: {
          created_at: string
          id: string
          is_saved: boolean
          objective_change_count: number
          objective_locked_until: string | null
          status: string
          total_calories: number
          total_carbs: number
          total_fat: number
          total_protein: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_saved?: boolean
          objective_change_count?: number
          objective_locked_until?: string | null
          status?: string
          total_calories: number
          total_carbs: number
          total_fat: number
          total_protein: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_saved?: boolean
          objective_change_count?: number
          objective_locked_until?: string | null
          status?: string
          total_calories?: number
          total_carbs?: number
          total_fat?: number
          total_protein?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diet_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      food_block_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          food_id: string
          id: string
          is_unblocked: boolean
          reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          food_id: string
          id?: string
          is_unblocked?: boolean
          reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          food_id?: string
          id?: string
          is_unblocked?: boolean
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_block_overrides_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: true
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      food_imports: {
        Row: {
          completed_at: string | null
          created_at: string
          errors: Json | null
          failed_rows: number
          filename: string
          id: string
          imported_by: string
          imported_rows: number
          started_at: string | null
          status: string
          total_rows: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          errors?: Json | null
          failed_rows?: number
          filename: string
          id?: string
          imported_by: string
          imported_rows?: number
          started_at?: string | null
          status?: string
          total_rows?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          errors?: Json | null
          failed_rows?: number
          filename?: string
          id?: string
          imported_by?: string
          imported_rows?: number
          started_at?: string | null
          status?: string
          total_rows?: number
        }
        Relationships: []
      }
      foods: {
        Row: {
          calories: number
          canonical_name: string | null
          carbs: number
          category: string
          confidence_level: string | null
          created_at: string
          created_by_id: string | null
          created_by_type: string | null
          fat: number
          id: string
          is_active: boolean | null
          is_optional: boolean | null
          is_supplement_item: boolean | null
          name: string
          origin: string | null
          processing_level: string | null
          protein: number
          review_status: string | null
          serving_size: string | null
          supplement_max_portion: number | null
          supplement_min_portion: number | null
          supplement_notes: string | null
          supplement_portion: string | null
          type: string | null
          unit_enabled: boolean | null
          unit_increment: number | null
          unit_name: string | null
          unit_weight_grams: number | null
        }
        Insert: {
          calories: number
          canonical_name?: string | null
          carbs: number
          category: string
          confidence_level?: string | null
          created_at?: string
          created_by_id?: string | null
          created_by_type?: string | null
          fat: number
          id?: string
          is_active?: boolean | null
          is_optional?: boolean | null
          is_supplement_item?: boolean | null
          name: string
          origin?: string | null
          processing_level?: string | null
          protein: number
          review_status?: string | null
          serving_size?: string | null
          supplement_max_portion?: number | null
          supplement_min_portion?: number | null
          supplement_notes?: string | null
          supplement_portion?: string | null
          type?: string | null
          unit_enabled?: boolean | null
          unit_increment?: number | null
          unit_name?: string | null
          unit_weight_grams?: number | null
        }
        Update: {
          calories?: number
          canonical_name?: string | null
          carbs?: number
          category?: string
          confidence_level?: string | null
          created_at?: string
          created_by_id?: string | null
          created_by_type?: string | null
          fat?: number
          id?: string
          is_active?: boolean | null
          is_optional?: boolean | null
          is_supplement_item?: boolean | null
          name?: string
          origin?: string | null
          processing_level?: string | null
          protein?: number
          review_status?: string | null
          serving_size?: string | null
          supplement_max_portion?: number | null
          supplement_min_portion?: number | null
          supplement_notes?: string | null
          supplement_portion?: string | null
          type?: string | null
          unit_enabled?: boolean | null
          unit_increment?: number | null
          unit_name?: string | null
          unit_weight_grams?: number | null
        }
        Relationships: []
      }
      meal_anchor_foods: {
        Row: {
          created_at: string
          default_quantity_grams: number
          dietary_profile: string | null
          food_id: string
          goal_type: string | null
          id: string
          is_active: boolean
          meal_type: string
          option_number: number
          role_name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_quantity_grams?: number
          dietary_profile?: string | null
          food_id: string
          goal_type?: string | null
          id?: string
          is_active?: boolean
          meal_type: string
          option_number?: number
          role_name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_quantity_grams?: number
          dietary_profile?: string | null
          food_id?: string
          goal_type?: string | null
          id?: string
          is_active?: boolean
          meal_type?: string
          option_number?: number
          role_name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_anchor_foods_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_logs: {
        Row: {
          calories_consumed: number | null
          carbs_consumed: number | null
          confirmed_at: string | null
          confirmed_option_id: string | null
          created_at: string
          daily_log_id: string
          fat_consumed: number | null
          id: string
          meal_id: string
          notes: string | null
          protein_consumed: number | null
          status: Database["public"]["Enums"]["meal_status"]
        }
        Insert: {
          calories_consumed?: number | null
          carbs_consumed?: number | null
          confirmed_at?: string | null
          confirmed_option_id?: string | null
          created_at?: string
          daily_log_id: string
          fat_consumed?: number | null
          id?: string
          meal_id: string
          notes?: string | null
          protein_consumed?: number | null
          status?: Database["public"]["Enums"]["meal_status"]
        }
        Update: {
          calories_consumed?: number | null
          carbs_consumed?: number | null
          confirmed_at?: string | null
          confirmed_option_id?: string | null
          created_at?: string
          daily_log_id?: string
          fat_consumed?: number | null
          id?: string
          meal_id?: string
          notes?: string | null
          protein_consumed?: number | null
          status?: Database["public"]["Enums"]["meal_status"]
        }
        Relationships: [
          {
            foreignKeyName: "meal_logs_confirmed_option_id_fkey"
            columns: ["confirmed_option_id"]
            isOneToOne: false
            referencedRelation: "meal_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_logs_daily_log_id_fkey"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_logs_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_option_foods: {
        Row: {
          calculated_grams: number | null
          created_at: string
          display_quantity: number | null
          display_unit: string | null
          food_id: string
          id: string
          meal_option_id: string
          quantity_grams: number
          unit_locked: boolean | null
        }
        Insert: {
          calculated_grams?: number | null
          created_at?: string
          display_quantity?: number | null
          display_unit?: string | null
          food_id: string
          id?: string
          meal_option_id: string
          quantity_grams: number
          unit_locked?: boolean | null
        }
        Update: {
          calculated_grams?: number | null
          created_at?: string
          display_quantity?: number | null
          display_unit?: string | null
          food_id?: string
          id?: string
          meal_option_id?: string
          quantity_grams?: number
          unit_locked?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_option_foods_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_option_foods_meal_option_id_fkey"
            columns: ["meal_option_id"]
            isOneToOne: false
            referencedRelation: "meal_options"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_options: {
        Row: {
          created_at: string
          id: string
          meal_id: string
          name: string | null
          option_number: number
          total_calories: number | null
          total_carbs: number | null
          total_fat: number | null
          total_protein: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          meal_id: string
          name?: string | null
          option_number?: number
          total_calories?: number | null
          total_carbs?: number | null
          total_fat?: number | null
          total_protein?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          meal_id?: string
          name?: string | null
          option_number?: number
          total_calories?: number | null
          total_carbs?: number | null
          total_fat?: number | null
          total_protein?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_options_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_role_food_categories: {
        Row: {
          category: string
          created_at: string
          id: string
          priority: number
          role_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          priority?: number
          role_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          priority?: number
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_role_food_categories_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "meal_template_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_template_roles: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          max_quantity_grams: number
          min_quantity_grams: number
          role_name: string
          sort_order: number
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          max_quantity_grams?: number
          min_quantity_grams?: number
          role_name: string
          sort_order?: number
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          max_quantity_grams?: number
          min_quantity_grams?: number
          role_name?: string
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_template_roles_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "meal_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_items: number
          meal_type: string
          min_items: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_items?: number
          meal_type: string
          min_items?: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_items?: number
          meal_type?: string
          min_items?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      meals: {
        Row: {
          created_at: string
          diet_plan_id: string
          id: string
          name: string
          sort_order: number
          total_calories: number | null
          total_carbs: number | null
          total_fat: number | null
          total_protein: number | null
        }
        Insert: {
          created_at?: string
          diet_plan_id: string
          id?: string
          name: string
          sort_order?: number
          total_calories?: number | null
          total_carbs?: number | null
          total_fat?: number | null
          total_protein?: number | null
        }
        Update: {
          created_at?: string
          diet_plan_id?: string
          id?: string
          name?: string
          sort_order?: number
          total_calories?: number | null
          total_carbs?: number | null
          total_fat?: number | null
          total_protein?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meals_diet_plan_id_fkey"
            columns: ["diet_plan_id"]
            isOneToOne: false
            referencedRelation: "diet_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      objective_change_policies: {
        Row: {
          change_number: number
          cooldown_days: number
          created_at: string
          id: string
          profile_type: string
          updated_at: string
        }
        Insert: {
          change_number: number
          cooldown_days?: number
          created_at?: string
          id?: string
          profile_type: string
          updated_at?: string
        }
        Update: {
          change_number?: number
          cooldown_days?: number
          created_at?: string
          id?: string
          profile_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      objective_change_requests: {
        Row: {
          created_at: string
          current_goal: string
          id: string
          justification: string
          professional_id: string
          professional_response: string | null
          requested_goal: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_goal: string
          id?: string
          justification: string
          professional_id: string
          professional_response?: string | null
          requested_goal: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_goal?: string
          id?: string
          justification?: string
          professional_id?: string
          professional_response?: string | null
          requested_goal?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          adjustment_limit: number
          chat_messages_per_day: number
          created_at: string
          description: string | null
          diet_limit: number
          has_chat: boolean
          id: string
          is_active: boolean
          meal_options_limit: number
          name: string
          price_monthly: number | null
          stripe_price_monthly: string | null
          stripe_product_id: string | null
          substitution_limit: number
          type: Database["public"]["Enums"]["plan_type"]
        }
        Insert: {
          adjustment_limit?: number
          chat_messages_per_day?: number
          created_at?: string
          description?: string | null
          diet_limit?: number
          has_chat?: boolean
          id?: string
          is_active?: boolean
          meal_options_limit?: number
          name: string
          price_monthly?: number | null
          stripe_price_monthly?: string | null
          stripe_product_id?: string | null
          substitution_limit?: number
          type: Database["public"]["Enums"]["plan_type"]
        }
        Update: {
          adjustment_limit?: number
          chat_messages_per_day?: number
          created_at?: string
          description?: string | null
          diet_limit?: number
          has_chat?: boolean
          id?: string
          is_active?: boolean
          meal_options_limit?: number
          name?: string
          price_monthly?: number | null
          stripe_price_monthly?: string | null
          stripe_product_id?: string | null
          substitution_limit?: number
          type?: Database["public"]["Enums"]["plan_type"]
        }
        Relationships: []
      }
      professional_students: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          professional_id: string
          status: string
          student_confirmed: boolean | null
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          professional_id: string
          status?: string
          student_confirmed?: boolean | null
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          professional_id?: string
          status?: string
          student_confirmed?: boolean | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_students_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "professional_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_level: string | null
          age: number | null
          avoided_foods: string[] | null
          carbs_target: number | null
          created_at: string
          daily_calories: number | null
          email: string | null
          evening_meal_preference: string | null
          fat_target: number | null
          goal: string | null
          height: number | null
          id: string
          include_supplements: boolean | null
          last_evening_meal: string | null
          meals_per_day: number | null
          name: string | null
          onboarding_completed: boolean | null
          preferences: string[] | null
          preferred_foods: string[] | null
          protein_target: number | null
          restrictions: string[] | null
          sex: string | null
          snack_preference: string | null
          updated_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          avoided_foods?: string[] | null
          carbs_target?: number | null
          created_at?: string
          daily_calories?: number | null
          email?: string | null
          evening_meal_preference?: string | null
          fat_target?: number | null
          goal?: string | null
          height?: number | null
          id?: string
          include_supplements?: boolean | null
          last_evening_meal?: string | null
          meals_per_day?: number | null
          name?: string | null
          onboarding_completed?: boolean | null
          preferences?: string[] | null
          preferred_foods?: string[] | null
          protein_target?: number | null
          restrictions?: string[] | null
          sex?: string | null
          snack_preference?: string | null
          updated_at?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          avoided_foods?: string[] | null
          carbs_target?: number | null
          created_at?: string
          daily_calories?: number | null
          email?: string | null
          evening_meal_preference?: string | null
          fat_target?: number | null
          goal?: string | null
          height?: number | null
          id?: string
          include_supplements?: boolean | null
          last_evening_meal?: string | null
          meals_per_day?: number | null
          name?: string | null
          onboarding_completed?: boolean | null
          preferences?: string[] | null
          preferred_foods?: string[] | null
          protein_target?: number | null
          restrictions?: string[] | null
          sex?: string | null
          snack_preference?: string | null
          updated_at?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      system_settings: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_sensitive: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_sensitive?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_sensitive?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_usage: {
        Row: {
          adjustments_used: number
          chat_messages_today: number
          created_at: string
          diets_used: number
          id: string
          last_chat_reset: string
          meal_options_override: number | null
          period_end: string
          period_start: string
          substitutions_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          adjustments_used?: number
          chat_messages_today?: number
          created_at?: string
          diets_used?: number
          id?: string
          last_chat_reset?: string
          meal_options_override?: number | null
          period_end?: string
          period_start?: string
          substitutions_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          adjustments_used?: number
          chat_messages_today?: number
          created_at?: string
          diets_used?: number
          id?: string
          last_chat_reset?: string
          meal_options_override?: number | null
          period_end?: string
          period_start?: string
          substitutions_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          id: string
          payload: Json | null
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
        }
        Relationships: []
      }
      weight_logs: {
        Row: {
          created_at: string
          id: string
          log_date: string
          notes: string | null
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          id?: string
          log_date?: string
          notes?: string | null
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          id?: string
          log_date?: string
          notes?: string | null
          user_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_objective_change: {
        Args: { _new_goal: string; _user_id: string }
        Returns: Json
      }
      can_use_feature: {
        Args: { _feature: string; _user_id: string }
        Returns: boolean
      }
      can_view_food: {
        Args: { _food_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_supplements: { Args: { _user_id: string }; Returns: boolean }
      check_objective_change_eligibility: {
        Args: { _user_id: string }
        Returns: {
          can_change: boolean
          change_count: number
          locked_until: string
          next_cooldown_days: number
          reason: string
        }[]
      }
      confirm_meal_consumption: {
        Args: {
          _log_date?: string
          _meal_id: string
          _option_id: string
          _status: string
          _user_id: string
        }
        Returns: Json
      }
      convert_grams_to_unit: {
        Args: {
          _grams: number
          _tolerance_percent?: number
          _unit_increment: number
          _unit_weight_grams: number
        }
        Returns: {
          calculated_grams: number
          display_quantity: number
          error_percent: number
          fallback_to_grams: boolean
          success: boolean
        }[]
      }
      generate_canonical_name: { Args: { food_name: string }; Returns: string }
      get_feature_flag: {
        Args: { _default_value?: boolean; _flag_key: string }
        Returns: boolean
      }
      get_rollout_percent: {
        Args: { _default_value?: number; _flag_key: string }
        Returns: number
      }
      get_usage_info: {
        Args: { _feature: string; _user_id: string }
        Returns: {
          allowed: boolean
          current_usage: number
          max_limit: number
        }[]
      }
      get_user_plan: {
        Args: { _user_id: string }
        Returns: {
          adjustment_limit: number
          chat_messages_per_day: number
          diet_limit: number
          has_chat: boolean
          meal_options_limit: number
          plan_id: string
          plan_name: string
          plan_type: Database["public"]["Enums"]["plan_type"]
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          substitution_limit: number
        }[]
      }
      get_visible_foods_for_user: {
        Args: { _user_id: string }
        Returns: {
          calories: number
          canonical_name: string | null
          carbs: number
          category: string
          confidence_level: string | null
          created_at: string
          created_by_id: string | null
          created_by_type: string | null
          fat: number
          id: string
          is_active: boolean | null
          is_optional: boolean | null
          is_supplement_item: boolean | null
          name: string
          origin: string | null
          processing_level: string | null
          protein: number
          review_status: string | null
          serving_size: string | null
          supplement_max_portion: number | null
          supplement_min_portion: number | null
          supplement_notes: string | null
          supplement_portion: string | null
          type: string | null
          unit_enabled: boolean | null
          unit_increment: number | null
          unit_name: string | null
          unit_weight_grams: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "foods"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_usage: {
        Args: { _feature: string; _user_id: string }
        Returns: boolean
      }
      is_in_rollout: {
        Args: { _flag_key: string; _user_id: string }
        Returns: boolean
      }
      remove_accents: { Args: { input_text: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "user" | "professional"
      daily_status: "no_records" | "partial" | "complete"
      meal_status:
        | "pending"
        | "confirmed"
        | "skipped"
        | "out_of_plan"
        | "late_confirmed"
      plan_type: "gratuito" | "plano_pessoal_pago" | "profissional"
      subscription_status:
        | "trial"
        | "active"
        | "past_due"
        | "canceled"
        | "expired"
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
    Enums: {
      app_role: ["admin", "user", "professional"],
      daily_status: ["no_records", "partial", "complete"],
      meal_status: [
        "pending",
        "confirmed",
        "skipped",
        "out_of_plan",
        "late_confirmed",
      ],
      plan_type: ["gratuito", "plano_pessoal_pago", "profissional"],
      subscription_status: [
        "trial",
        "active",
        "past_due",
        "canceled",
        "expired",
      ],
    },
  },
} as const
