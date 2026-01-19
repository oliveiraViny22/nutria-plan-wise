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
      adherence_alert_configs: {
        Row: {
          check_period_days: number
          created_at: string
          id: string
          is_active: boolean
          notify_on_low: boolean
          notify_on_warning: boolean
          professional_id: string
          threshold_low: number
          threshold_warning: number
          updated_at: string
        }
        Insert: {
          check_period_days?: number
          created_at?: string
          id?: string
          is_active?: boolean
          notify_on_low?: boolean
          notify_on_warning?: boolean
          professional_id: string
          threshold_low?: number
          threshold_warning?: number
          updated_at?: string
        }
        Update: {
          check_period_days?: number
          created_at?: string
          id?: string
          is_active?: boolean
          notify_on_low?: boolean
          notify_on_warning?: boolean
          professional_id?: string
          threshold_low?: number
          threshold_warning?: number
          updated_at?: string
        }
        Relationships: []
      }
      adherence_alerts: {
        Row: {
          adherence_rate: number
          alert_type: string
          created_at: string
          diet_plan_id: string
          id: string
          is_read: boolean
          message: string
          period_end: string
          period_start: string
          professional_id: string
          read_at: string | null
          student_id: string
          threshold_used: number
        }
        Insert: {
          adherence_rate: number
          alert_type: string
          created_at?: string
          diet_plan_id: string
          id?: string
          is_read?: boolean
          message: string
          period_end: string
          period_start: string
          professional_id: string
          read_at?: string | null
          student_id: string
          threshold_used: number
        }
        Update: {
          adherence_rate?: number
          alert_type?: string
          created_at?: string
          diet_plan_id?: string
          id?: string
          is_read?: boolean
          message?: string
          period_end?: string
          period_start?: string
          professional_id?: string
          read_at?: string | null
          student_id?: string
          threshold_used?: number
        }
        Relationships: []
      }
      adherence_metrics: {
        Row: {
          adherence_by_meal: Json | null
          adherence_by_option: Json | null
          calculated_at: string
          days_with_records: number
          diet_plan_id: string
          exception_distribution: Json | null
          id: string
          meals_confirmed: number | null
          meals_late_confirmed: number | null
          meals_out_of_plan: number | null
          meals_skipped: number | null
          overall_adherence_rate: number | null
          period_end: string
          period_start: string
          plan_version: number
          total_days: number
          user_id: string
        }
        Insert: {
          adherence_by_meal?: Json | null
          adherence_by_option?: Json | null
          calculated_at?: string
          days_with_records?: number
          diet_plan_id: string
          exception_distribution?: Json | null
          id?: string
          meals_confirmed?: number | null
          meals_late_confirmed?: number | null
          meals_out_of_plan?: number | null
          meals_skipped?: number | null
          overall_adherence_rate?: number | null
          period_end: string
          period_start: string
          plan_version?: number
          total_days?: number
          user_id: string
        }
        Update: {
          adherence_by_meal?: Json | null
          adherence_by_option?: Json | null
          calculated_at?: string
          days_with_records?: number
          diet_plan_id?: string
          exception_distribution?: Json | null
          id?: string
          meals_confirmed?: number | null
          meals_late_confirmed?: number | null
          meals_out_of_plan?: number | null
          meals_skipped?: number | null
          overall_adherence_rate?: number | null
          period_end?: string
          period_start?: string
          plan_version?: number
          total_days?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adherence_metrics_diet_plan_id_fkey"
            columns: ["diet_plan_id"]
            isOneToOne: false
            referencedRelation: "diet_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      adherence_report_files: {
        Row: {
          diet_plan_id: string
          file_path: string
          generated_at: string
          id: string
          metrics_snapshot: Json
          period_end: string
          period_start: string
          plan_type: string
          plan_version: number
          student_id: string | null
          user_id: string
        }
        Insert: {
          diet_plan_id: string
          file_path: string
          generated_at?: string
          id?: string
          metrics_snapshot: Json
          period_end: string
          period_start: string
          plan_type: string
          plan_version?: number
          student_id?: string | null
          user_id: string
        }
        Update: {
          diet_plan_id?: string
          file_path?: string
          generated_at?: string
          id?: string
          metrics_snapshot?: Json
          period_end?: string
          period_start?: string
          plan_type?: string
          plan_version?: number
          student_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
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
      ai_suggestions: {
        Row: {
          adherence_data_used: Json
          created_at: string
          diet_plan_id: string
          hypothesis: string
          id: string
          proposed_changes: Json
          rationale: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggestion_type: string
          user_id: string
        }
        Insert: {
          adherence_data_used: Json
          created_at?: string
          diet_plan_id: string
          hypothesis: string
          id?: string
          proposed_changes: Json
          rationale: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggestion_type: string
          user_id: string
        }
        Update: {
          adherence_data_used?: Json
          created_at?: string
          diet_plan_id?: string
          hypothesis?: string
          id?: string
          proposed_changes?: Json
          rationale?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggestion_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestions_diet_plan_id_fkey"
            columns: ["diet_plan_id"]
            isOneToOne: false
            referencedRelation: "diet_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          role?: string
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
          plan_version: number
          status: string
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
          plan_version?: number
          status?: string
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
          plan_version?: number
          status?: string
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
        ]
      }
      diet_plans: {
        Row: {
          created_at: string | null
          id: string
          is_initial_plan: boolean
          released_to_student: boolean
          status: string
          total_calories: number
          total_carbs: number
          total_fat: number
          total_protein: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_initial_plan?: boolean
          released_to_student?: boolean
          status?: string
          total_calories: number
          total_carbs: number
          total_fat: number
          total_protein: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_initial_plan?: boolean
          released_to_student?: boolean
          status?: string
          total_calories?: number
          total_carbs?: number
          total_fat?: number
          total_protein?: number
          user_id?: string
        }
        Relationships: []
      }
      food_imports: {
        Row: {
          completed_at: string | null
          created_at: string
          errors: Json | null
          failed_rows: number | null
          filename: string
          id: string
          imported_by: string
          imported_rows: number | null
          started_at: string | null
          status: string
          total_rows: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          errors?: Json | null
          failed_rows?: number | null
          filename: string
          id?: string
          imported_by: string
          imported_rows?: number | null
          started_at?: string | null
          status?: string
          total_rows?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          errors?: Json | null
          failed_rows?: number | null
          filename?: string
          id?: string
          imported_by?: string
          imported_rows?: number | null
          started_at?: string | null
          status?: string
          total_rows?: number | null
        }
        Relationships: []
      }
      foods: {
        Row: {
          calories: number
          carbs: number
          category: string | null
          created_at: string | null
          fat: number
          id: string
          name: string
          processing_level: string | null
          protein: number
          serving_size: string | null
          unit_enabled: boolean | null
          unit_increment: number | null
          unit_name: string | null
          unit_weight_grams: number | null
        }
        Insert: {
          calories: number
          carbs: number
          category?: string | null
          created_at?: string | null
          fat: number
          id?: string
          name: string
          processing_level?: string | null
          protein: number
          serving_size?: string | null
          unit_enabled?: boolean | null
          unit_increment?: number | null
          unit_name?: string | null
          unit_weight_grams?: number | null
        }
        Update: {
          calories?: number
          carbs?: number
          category?: string | null
          created_at?: string | null
          fat?: number
          id?: string
          name?: string
          processing_level?: string | null
          protein?: number
          serving_size?: string | null
          unit_enabled?: boolean | null
          unit_increment?: number | null
          unit_name?: string | null
          unit_weight_grams?: number | null
        }
        Relationships: []
      }
      meal_foods: {
        Row: {
          calculated_grams: number | null
          created_at: string | null
          display_quantity: number | null
          display_unit: string | null
          food_id: string
          id: string
          meal_id: string
          quantity: number | null
          unit_conversion_locked: boolean | null
        }
        Insert: {
          calculated_grams?: number | null
          created_at?: string | null
          display_quantity?: number | null
          display_unit?: string | null
          food_id: string
          id?: string
          meal_id: string
          quantity?: number | null
          unit_conversion_locked?: boolean | null
        }
        Update: {
          calculated_grams?: number | null
          created_at?: string | null
          display_quantity?: number | null
          display_unit?: string | null
          food_id?: string
          id?: string
          meal_id?: string
          quantity?: number | null
          unit_conversion_locked?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_foods_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_foods_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
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
          status: string
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
          status?: string
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
          status?: string
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
          quantity: number
          unit_conversion_locked: boolean | null
        }
        Insert: {
          calculated_grams?: number | null
          created_at?: string
          display_quantity?: number | null
          display_unit?: string | null
          food_id: string
          id?: string
          meal_option_id: string
          quantity?: number
          unit_conversion_locked?: boolean | null
        }
        Update: {
          calculated_grams?: number | null
          created_at?: string
          display_quantity?: number | null
          display_unit?: string | null
          food_id?: string
          id?: string
          meal_option_id?: string
          quantity?: number
          unit_conversion_locked?: boolean | null
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
          total_calories: number
          total_carbs: number
          total_fat: number
          total_protein: number
        }
        Insert: {
          created_at?: string
          id?: string
          meal_id: string
          name?: string | null
          option_number: number
          total_calories?: number
          total_carbs?: number
          total_fat?: number
          total_protein?: number
        }
        Update: {
          created_at?: string
          id?: string
          meal_id?: string
          name?: string | null
          option_number?: number
          total_calories?: number
          total_carbs?: number
          total_fat?: number
          total_protein?: number
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
      meals: {
        Row: {
          created_at: string | null
          diet_plan_id: string
          id: string
          name: string
          total_calories: number | null
          total_carbs: number | null
          total_fat: number | null
          total_protein: number | null
        }
        Insert: {
          created_at?: string | null
          diet_plan_id: string
          id?: string
          name: string
          total_calories?: number | null
          total_carbs?: number | null
          total_fat?: number | null
          total_protein?: number | null
        }
        Update: {
          created_at?: string | null
          diet_plan_id?: string
          id?: string
          name?: string
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
      plan_history: {
        Row: {
          action: string
          created_at: string | null
          description: string
          diet_plan_id: string | null
          id: string
          new_values: Json | null
          previous_values: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          description: string
          diet_plan_id?: string | null
          id?: string
          new_values?: Json | null
          previous_values?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string
          diet_plan_id?: string | null
          id?: string
          new_values?: Json | null
          previous_values?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_history_diet_plan_id_fkey"
            columns: ["diet_plan_id"]
            isOneToOne: false
            referencedRelation: "diet_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_versions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          diet_plan_id: string
          id: string
          notes: string | null
          snapshot: Json
          version_number: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          diet_plan_id: string
          id?: string
          notes?: string | null
          snapshot: Json
          version_number?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          diet_plan_id?: string
          id?: string
          notes?: string | null
          snapshot?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_versions_diet_plan_id_fkey"
            columns: ["diet_plan_id"]
            isOneToOne: false
            referencedRelation: "diet_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          adjustment_limit: number
          chat_messages_per_day: number
          created_at: string | null
          description: string | null
          diet_limit: number
          has_chat: boolean
          history_days: number
          id: string
          is_active: boolean
          name: string
          patients_limit: number
          price_annual: number | null
          price_monthly: number | null
          price_quarterly: number | null
          price_semiannual: number | null
          stripe_price_annual: string | null
          stripe_price_monthly: string | null
          stripe_price_quarterly: string | null
          stripe_price_semiannual: string | null
          stripe_product_id: string | null
          substitution_limit: number
          type: Database["public"]["Enums"]["plan_type"]
        }
        Insert: {
          adjustment_limit?: number
          chat_messages_per_day?: number
          created_at?: string | null
          description?: string | null
          diet_limit?: number
          has_chat?: boolean
          history_days?: number
          id?: string
          is_active?: boolean
          name: string
          patients_limit?: number
          price_annual?: number | null
          price_monthly?: number | null
          price_quarterly?: number | null
          price_semiannual?: number | null
          stripe_price_annual?: string | null
          stripe_price_monthly?: string | null
          stripe_price_quarterly?: string | null
          stripe_price_semiannual?: string | null
          stripe_product_id?: string | null
          substitution_limit?: number
          type: Database["public"]["Enums"]["plan_type"]
        }
        Update: {
          adjustment_limit?: number
          chat_messages_per_day?: number
          created_at?: string | null
          description?: string | null
          diet_limit?: number
          has_chat?: boolean
          history_days?: number
          id?: string
          is_active?: boolean
          name?: string
          patients_limit?: number
          price_annual?: number | null
          price_monthly?: number | null
          price_quarterly?: number | null
          price_semiannual?: number | null
          stripe_price_annual?: string | null
          stripe_price_monthly?: string | null
          stripe_price_quarterly?: string | null
          stripe_price_semiannual?: string | null
          stripe_product_id?: string | null
          substitution_limit?: number
          type?: Database["public"]["Enums"]["plan_type"]
        }
        Relationships: []
      }
      professional_licenses: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          license_type: string
          max_students: number | null
          starts_at: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          license_type?: string
          max_students?: number | null
          starts_at?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          license_type?: string
          max_students?: number | null
          starts_at?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      professional_students: {
        Row: {
          created_at: string | null
          id: string
          professional_id: string
          status: string
          student_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          professional_id: string
          status?: string
          student_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          professional_id?: string
          status?: string
          student_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          activity_level: string | null
          age: number | null
          carbs_target: number | null
          created_at: string | null
          created_by: string | null
          daily_calories: number | null
          email: string | null
          fat_target: number | null
          goal: string | null
          height: number | null
          id: string
          is_test: boolean | null
          meals_per_day: number | null
          must_change_password: boolean | null
          name: string | null
          onboarding_completed: boolean | null
          preferences: string[] | null
          professional_id: string | null
          professional_onboarding_completed: boolean | null
          protein_target: number | null
          restrictions: string[] | null
          sex: string | null
          updated_at: string | null
          user_id: string
          user_type: Database["public"]["Enums"]["user_type"] | null
          weight: number | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          activity_level?: string | null
          age?: number | null
          carbs_target?: number | null
          created_at?: string | null
          created_by?: string | null
          daily_calories?: number | null
          email?: string | null
          fat_target?: number | null
          goal?: string | null
          height?: number | null
          id?: string
          is_test?: boolean | null
          meals_per_day?: number | null
          must_change_password?: boolean | null
          name?: string | null
          onboarding_completed?: boolean | null
          preferences?: string[] | null
          professional_id?: string | null
          professional_onboarding_completed?: boolean | null
          protein_target?: number | null
          restrictions?: string[] | null
          sex?: string | null
          updated_at?: string | null
          user_id: string
          user_type?: Database["public"]["Enums"]["user_type"] | null
          weight?: number | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          activity_level?: string | null
          age?: number | null
          carbs_target?: number | null
          created_at?: string | null
          created_by?: string | null
          daily_calories?: number | null
          email?: string | null
          fat_target?: number | null
          goal?: string | null
          height?: number | null
          id?: string
          is_test?: boolean | null
          meals_per_day?: number | null
          must_change_password?: boolean | null
          name?: string | null
          onboarding_completed?: boolean | null
          preferences?: string[] | null
          professional_id?: string | null
          professional_onboarding_completed?: boolean | null
          protein_target?: number | null
          restrictions?: string[] | null
          sex?: string | null
          updated_at?: string | null
          user_id?: string
          user_type?: Database["public"]["Enums"]["user_type"] | null
          weight?: number | null
        }
        Relationships: []
      }
      student_requests: {
        Row: {
          created_at: string | null
          description: string
          id: string
          justification: string
          professional_feedback: string | null
          professional_id: string
          professional_response: string | null
          request_type: string
          status: string
          student_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          justification: string
          professional_feedback?: string | null
          professional_id: string
          professional_response?: string | null
          request_type: string
          status?: string
          student_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          justification?: string
          professional_feedback?: string | null
          professional_id?: string
          professional_response?: string | null
          request_type?: string
          status?: string
          student_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"] | null
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          grace_period_end: string | null
          id: string
          last_reconciled: string | null
          plan_id: string
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_price_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"] | null
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          grace_period_end?: string | null
          id?: string
          last_reconciled?: string | null
          plan_id: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_price_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"] | null
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          grace_period_end?: string | null
          id?: string
          last_reconciled?: string | null
          plan_id?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_price_id?: string | null
          updated_at?: string | null
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
        ]
      }
      system_settings: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_sensitive: boolean | null
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
          is_sensitive?: boolean | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_sensitive?: boolean | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_usage: {
        Row: {
          adjustments_used: number
          chat_messages_today: number
          created_at: string | null
          diets_used: number
          id: string
          last_chat_reset: string
          period_end: string
          period_start: string
          substitutions_used: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          adjustments_used?: number
          chat_messages_today?: number
          created_at?: string | null
          diets_used?: number
          id?: string
          last_chat_reset?: string
          period_end?: string
          period_start?: string
          substitutions_used?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          adjustments_used?: number
          chat_messages_today?: number
          created_at?: string | null
          diets_used?: number
          id?: string
          last_chat_reset?: string
          period_end?: string
          period_start?: string
          substitutions_used?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json | null
          processed_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
        }
        Update: {
          created_at?: string | null
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
          created_at: string | null
          id: string
          logged_at: string
          notes: string | null
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          logged_at?: string
          notes?: string | null
          user_id: string
          weight: number
        }
        Update: {
          created_at?: string | null
          id?: string
          logged_at?: string
          notes?: string | null
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_unit_conversion: {
        Args: { _food_id: string; _quantity_grams: number }
        Returns: {
          calculated_grams: number
          conversion_applied: boolean
          display_quantity: number
          display_unit: string
        }[]
      }
      calculate_adherence_metrics: {
        Args: {
          _diet_plan_id: string
          _period_end: string
          _period_start: string
          _user_id: string
        }
        Returns: Json
      }
      can_create_plan: { Args: { _user_id: string }; Returns: boolean }
      can_edit_plan: { Args: { _user_id: string }; Returns: boolean }
      can_use_feature: {
        Args: { _feature: string; _user_id: string }
        Returns: boolean
      }
      check_feature_limit: {
        Args: { _feature: string; _user_id: string }
        Returns: {
          allowed: boolean
          current_usage: number
          max_limit: number
          upgrade_required: boolean
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
      get_professional_subscription_state: {
        Args: { _professional_id: string }
        Returns: {
          grace_end: string
          is_active: boolean
          is_grace_period: boolean
          is_suspended: boolean
          sub_status: string
        }[]
      }
      get_student_access_level: {
        Args: { _student_id: string }
        Returns: {
          access_level: string
          can_generate: boolean
          can_substitute: boolean
          can_use_chat: boolean
          can_view_history: boolean
          can_view_plan: boolean
          has_access: boolean
          professional_status: string
        }[]
      }
      get_student_count: { Args: { _professional_id: string }; Returns: number }
      get_user_permissions: {
        Args: { _user_id: string }
        Returns: {
          can_adjust: boolean
          can_create_plan: boolean
          can_edit_plan: boolean
          can_manage_students: boolean
          can_send_requests: boolean
          can_substitute: boolean
          can_use_ai: boolean
          can_use_simulations: boolean
          can_view_plan: boolean
          is_linked_to_professional: boolean
          plan_name: string
          user_type: Database["public"]["Enums"]["user_type"]
        }[]
      }
      get_user_plan: {
        Args: { _user_id: string }
        Returns: {
          adjustment_limit: number
          chat_messages_per_day: number
          diet_limit: number
          has_chat: boolean
          history_days: number
          patients_limit: number
          plan_id: string
          plan_name: string
          plan_type: Database["public"]["Enums"]["plan_type"]
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          substitution_limit: number
        }[]
      }
      has_active_license: { Args: { _user_id: string }; Returns: boolean }
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
      professional_manages_meal: {
        Args: { _meal_id: string; _professional_id: string }
        Returns: boolean
      }
      professional_manages_meal_option: {
        Args: { _meal_option_id: string; _professional_id: string }
        Returns: boolean
      }
      reset_monthly_usage: { Args: { _user_id: string }; Returns: undefined }
      user_owns_meal: {
        Args: { _meal_id: string; _user_id: string }
        Returns: boolean
      }
      user_owns_meal_option: {
        Args: { _meal_option_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      account_type: "aluno" | "plano_pessoal" | "premium" | "profissional"
      app_role: "admin" | "professional" | "student"
      billing_cycle: "monthly" | "quarterly" | "semiannual" | "annual"
      plan_type: "personal" | "professional"
      plan_type_commercial:
        | "gratuito"
        | "plano_pessoal_pago"
        | "premium"
        | "profissional"
      subscription_status:
        | "trial"
        | "active"
        | "past_due"
        | "canceled"
        | "expired"
      user_type: "aluno" | "usuario" | "profissional"
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
      account_type: ["aluno", "plano_pessoal", "premium", "profissional"],
      app_role: ["admin", "professional", "student"],
      billing_cycle: ["monthly", "quarterly", "semiannual", "annual"],
      plan_type: ["personal", "professional"],
      plan_type_commercial: [
        "gratuito",
        "plano_pessoal_pago",
        "premium",
        "profissional",
      ],
      subscription_status: [
        "trial",
        "active",
        "past_due",
        "canceled",
        "expired",
      ],
      user_type: ["aluno", "usuario", "profissional"],
    },
  },
} as const
