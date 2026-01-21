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
          carbs: number
          category: string | null
          created_at: string
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
          created_at?: string
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
          created_at?: string
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
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          professional_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          professional_id?: string
          status?: string
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
          carbs_target: number | null
          created_at: string
          daily_calories: number | null
          email: string | null
          fat_target: number | null
          goal: string | null
          height: number | null
          id: string
          meals_per_day: number | null
          name: string | null
          onboarding_completed: boolean | null
          preferences: string[] | null
          protein_target: number | null
          restrictions: string[] | null
          sex: string | null
          updated_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          carbs_target?: number | null
          created_at?: string
          daily_calories?: number | null
          email?: string | null
          fat_target?: number | null
          goal?: string | null
          height?: number | null
          id?: string
          meals_per_day?: number | null
          name?: string | null
          onboarding_completed?: boolean | null
          preferences?: string[] | null
          protein_target?: number | null
          restrictions?: string[] | null
          sex?: string | null
          updated_at?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          carbs_target?: number | null
          created_at?: string
          daily_calories?: number | null
          email?: string | null
          fat_target?: number | null
          goal?: string | null
          height?: number | null
          id?: string
          meals_per_day?: number | null
          name?: string | null
          onboarding_completed?: boolean | null
          preferences?: string[] | null
          protein_target?: number | null
          restrictions?: string[] | null
          sex?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_use_feature: {
        Args: { _feature: string; _user_id: string }
        Returns: boolean
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
      get_user_plan: {
        Args: { _user_id: string }
        Returns: {
          adjustment_limit: number
          chat_messages_per_day: number
          diet_limit: number
          has_chat: boolean
          plan_id: string
          plan_name: string
          plan_type: Database["public"]["Enums"]["plan_type"]
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          substitution_limit: number
        }[]
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
