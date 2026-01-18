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
        }
        Relationships: []
      }
      meal_foods: {
        Row: {
          created_at: string | null
          food_id: string
          id: string
          meal_id: string
          quantity: number | null
        }
        Insert: {
          created_at?: string | null
          food_id: string
          id?: string
          meal_id: string
          quantity?: number | null
        }
        Update: {
          created_at?: string | null
          food_id?: string
          id?: string
          meal_id?: string
          quantity?: number | null
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
      reset_monthly_usage: { Args: { _user_id: string }; Returns: undefined }
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
