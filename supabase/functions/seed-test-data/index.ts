import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestUserConfig {
  email: string;
  password: string;
  name: string;
  planType: string;
  accountType: string;
  isTest: boolean;
  createdBy: string;
  mustChangePassword?: boolean;
  role?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error("Invalid authentication");
    }

    // Check admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      throw new Error("Admin access required");
    }

    const results: Record<string, unknown> = {};

    // ==========================================
    // 1. CREATE ADMIN ACCOUNT (NOT TEST)
    // ==========================================
    const adminEmail = "admin@nutriai.app";
    const adminPassword = "AdmInit-2026!";

    // Check if admin already exists
    const { data: existingAdmin } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("email", adminEmail)
      .single();

    if (!existingAdmin) {
      const { data: adminUser, error: adminError } = await supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: {
          name: "Administrador Sistema",
          created_by: "system_admin_seed",
          is_production_admin: true
        }
      });

      if (adminError) {
        console.error("Error creating admin:", adminError);
        results.admin = { error: adminError.message };
      } else if (adminUser.user) {
        // Update profile for admin - NOT test, requires password change
        await supabaseAdmin
          .from("profiles")
          .update({
            name: "Administrador Sistema",
            is_test: false,
            must_change_password: true,
            created_by: "system_admin_seed",
            onboarding_completed: true,
            account_type: "plano_pessoal"
          })
          .eq("user_id", adminUser.user.id);

        // Assign admin role
        await supabaseAdmin
          .from("user_roles")
          .insert({
            user_id: adminUser.user.id,
            role: "admin"
          });

        // Delete any auto-created subscription for admin
        await supabaseAdmin
          .from("subscriptions")
          .delete()
          .eq("user_id", adminUser.user.id);

        // Delete any auto-created usage for admin
        await supabaseAdmin
          .from("user_usage")
          .delete()
          .eq("user_id", adminUser.user.id);

        results.admin = { 
          success: true, 
          email: adminEmail, 
          user_id: adminUser.user.id,
          note: "Password change required on first login"
        };
      }
    } else {
      results.admin = { skipped: true, reason: "Admin already exists" };
    }

    // ==========================================
    // 2. CREATE TEST USERS FOR EACH PLAN
    // ==========================================
    const testUsers: TestUserConfig[] = [
      {
        email: "test+gratuito@nutriai.dev",
        password: "TestGratuito123!",
        name: "Usuário Teste Gratuito",
        planType: "gratuito",
        accountType: "plano_pessoal",
        isTest: true,
        createdBy: "system_test_seed"
      },
      {
        email: "test+premium@nutriai.dev",
        password: "TestPremium123!",
        name: "Usuário Teste Premium",
        planType: "premium",
        accountType: "premium",
        isTest: true,
        createdBy: "system_test_seed"
      },
      {
        email: "test+pessoal_pago@nutriai.dev",
        password: "TestPessoalPago123!",
        name: "Usuário Teste Plano Pessoal Pago",
        planType: "plano_pessoal_pago",
        accountType: "plano_pessoal",
        isTest: true,
        createdBy: "system_test_seed"
      },
      {
        email: "test+profissional@nutriai.dev",
        password: "TestProfissional123!",
        name: "Nutricionista Teste",
        planType: "profissional",
        accountType: "profissional",
        isTest: true,
        createdBy: "system_test_seed",
        role: "professional"
      }
    ];

    for (const testUser of testUsers) {
      // Check if already exists
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("email", testUser.email)
        .single();

      if (existing) {
        results[testUser.planType] = { skipped: true, reason: "Already exists" };
        continue;
      }

      // Create user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: testUser.email,
        password: testUser.password,
        email_confirm: true,
        user_metadata: {
          name: testUser.name,
          created_by: testUser.createdBy,
          is_test: true
        }
      });

      if (createError) {
        results[testUser.planType] = { error: createError.message };
        continue;
      }

      if (!newUser.user) continue;

      const userId = newUser.user.id;

      // Update profile
      await supabaseAdmin
        .from("profiles")
        .update({
          name: testUser.name,
          is_test: true,
          created_by: testUser.createdBy,
          account_type: testUser.accountType,
          onboarding_completed: true,
          age: 30,
          weight: 70,
          height: 170,
          sex: "M",
          activity_level: "moderado",
          goal: "manter_peso",
          daily_calories: 2000,
          protein_target: 150,
          carbs_target: 250,
          fat_target: 65,
          meals_per_day: 5
        })
        .eq("user_id", userId);

      // Get plan ID
      const { data: planData } = await supabaseAdmin
        .from("plans")
        .select("id")
        .eq("name", testUser.planType)
        .single();

      if (planData) {
        // Delete auto-created subscription and create correct one
        await supabaseAdmin
          .from("subscriptions")
          .delete()
          .eq("user_id", userId);

        await supabaseAdmin
          .from("subscriptions")
          .insert({
            user_id: userId,
            plan_id: planData.id,
            status: "active",
            billing_cycle: "monthly",
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          });
      }

      // Assign role if specified
      if (testUser.role) {
        await supabaseAdmin
          .from("user_roles")
          .insert({
            user_id: userId,
            role: testUser.role
          });

        // Create professional license for professionals
        if (testUser.role === "professional") {
          await supabaseAdmin
            .from("professional_licenses")
            .insert({
              user_id: userId,
              license_type: "test",
              max_students: 10,
              starts_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            });
        }
      }

      // Create test diet plan
      const { data: dietPlan } = await supabaseAdmin
        .from("diet_plans")
        .insert({
          user_id: userId,
          status: "active",
          total_calories: 2000,
          total_protein: 150,
          total_carbs: 250,
          total_fat: 65,
          is_initial_plan: true
        })
        .select()
        .single();

      if (dietPlan) {
        // Create test meals
        const meals = ["Café da Manhã", "Lanche da Manhã", "Almoço", "Lanche da Tarde", "Jantar"];
        
        for (let i = 0; i < meals.length; i++) {
          const { data: meal } = await supabaseAdmin
            .from("meals")
            .insert({
              diet_plan_id: dietPlan.id,
              name: meals[i],
              total_calories: 400,
              total_protein: 30,
              total_carbs: 50,
              total_fat: 13
            })
            .select()
            .single();

          if (meal) {
            // Create meal options
            await supabaseAdmin
              .from("meal_options")
              .insert({
                meal_id: meal.id,
                option_number: 1,
                name: `Opção 1 - ${meals[i]}`,
                total_calories: 400,
                total_protein: 30,
                total_carbs: 50,
                total_fat: 13
              });
          }
        }

        // Create test daily logs
        const today = new Date();
        for (let d = 0; d < 7; d++) {
          const logDate = new Date(today);
          logDate.setDate(today.getDate() - d);
          
          await supabaseAdmin
            .from("daily_logs")
            .insert({
              user_id: userId,
              diet_plan_id: dietPlan.id,
              log_date: logDate.toISOString().split('T')[0],
              status: d === 0 ? "PARCIAL" : "COMPLETO",
              total_calories_consumed: 1800 + Math.floor(Math.random() * 400),
              total_protein_consumed: 140 + Math.floor(Math.random() * 20),
              total_carbs_consumed: 230 + Math.floor(Math.random() * 40),
              total_fat_consumed: 60 + Math.floor(Math.random() * 10)
            });
        }
      }

      // Create test chat history
      if (testUser.planType !== "gratuito") {
        await supabaseAdmin
          .from("chat_messages")
          .insert([
            {
              user_id: userId,
              role: "user",
              content: "Posso substituir arroz por batata doce?"
            },
            {
              user_id: userId,
              role: "assistant",
              content: "Sim! A batata doce é uma excelente alternativa ao arroz. Para cada 100g de arroz, você pode usar aproximadamente 150g de batata doce cozida, mantendo valores calóricos semelhantes."
            }
          ]);
      }

      // Create test weight logs
      for (let w = 0; w < 4; w++) {
        const logDate = new Date();
        logDate.setDate(logDate.getDate() - (w * 7));
        
        await supabaseAdmin
          .from("weight_logs")
          .insert({
            user_id: userId,
            weight: 70 - (w * 0.3),
            logged_at: logDate.toISOString(),
            notes: w === 0 ? null : "Registro semanal de teste"
          });
      }

      results[testUser.planType] = { 
        success: true, 
        email: testUser.email,
        user_id: userId 
      };
    }

    // ==========================================
    // 3. CREATE TEST STUDENTS FOR PROFESSIONAL
    // ==========================================
    const { data: professionalProfile } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("email", "test+profissional@nutriai.dev")
      .single();

    if (professionalProfile) {
      const professionalId = professionalProfile.user_id;
      const testStudents = [
        {
          email: "test+aluno1@nutriai.dev",
          name: "Aluno Teste 1",
          goal: "perder_peso"
        },
        {
          email: "test+aluno2@nutriai.dev",
          name: "Aluno Teste 2",
          goal: "ganhar_massa"
        },
        {
          email: "test+aluno3@nutriai.dev",
          name: "Aluno Teste 3 (Grace Period)",
          goal: "manter_peso"
        }
      ];

      const studentResults: Record<string, unknown>[] = [];

      for (const student of testStudents) {
        const { data: existingStudent } = await supabaseAdmin
          .from("profiles")
          .select("user_id")
          .eq("email", student.email)
          .single();

        if (existingStudent) {
          studentResults.push({ email: student.email, skipped: true });
          continue;
        }

        const { data: newStudent, error: studentError } = await supabaseAdmin.auth.admin.createUser({
          email: student.email,
          password: "TestAluno123!",
          email_confirm: true,
          user_metadata: {
            name: student.name,
            created_by: "system_test_seed",
            is_test: true
          }
        });

        if (studentError || !newStudent.user) {
          studentResults.push({ email: student.email, error: studentError?.message });
          continue;
        }

        const studentId = newStudent.user.id;

        // Update profile
        await supabaseAdmin
          .from("profiles")
          .update({
            name: student.name,
            is_test: true,
            created_by: "system_test_seed",
            account_type: "aluno",
            user_type: "aluno",
            professional_id: professionalId,
            onboarding_completed: true,
            age: 25,
            weight: 65,
            height: 165,
            sex: "F",
            activity_level: "leve",
            goal: student.goal,
            daily_calories: 1800,
            protein_target: 120,
            carbs_target: 200,
            fat_target: 60,
            meals_per_day: 5
          })
          .eq("user_id", studentId);

        // Link to professional
        await supabaseAdmin
          .from("professional_students")
          .insert({
            professional_id: professionalId,
            student_id: studentId,
            status: "active"
          });

        // Assign student role
        await supabaseAdmin
          .from("user_roles")
          .insert({
            user_id: studentId,
            role: "student"
          });

        // Delete auto-created subscription (students use professional's plan)
        await supabaseAdmin
          .from("subscriptions")
          .delete()
          .eq("user_id", studentId);

        // Create diet plan for student
        const { data: studentDietPlan } = await supabaseAdmin
          .from("diet_plans")
          .insert({
            user_id: studentId,
            status: "active",
            total_calories: 1800,
            total_protein: 120,
            total_carbs: 200,
            total_fat: 60,
            is_initial_plan: true,
            released_to_student: true
          })
          .select()
          .single();

        if (studentDietPlan) {
          const meals = ["Café da Manhã", "Lanche", "Almoço", "Lanche", "Jantar"];
          for (const mealName of meals) {
            await supabaseAdmin
              .from("meals")
              .insert({
                diet_plan_id: studentDietPlan.id,
                name: mealName,
                total_calories: 360,
                total_protein: 24,
                total_carbs: 40,
                total_fat: 12
              });
          }
        }

        studentResults.push({ email: student.email, success: true, user_id: studentId });
      }

      results.test_students = studentResults;
    }

    // ==========================================
    // 4. CREATE TEST DATA FOR GRACE PERIOD
    // ==========================================
    // Create a past_due subscription scenario for testing
    const { data: gracePeriodUser } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("email", "test+aluno3@nutriai.dev")
      .single();

    if (gracePeriodUser) {
      // This student's professional will have grace period in testing
      results.grace_period_test = { 
        note: "Aluno 3 pode ser usado para testar grace period alterando o status da subscription do profissional"
      };
    }

    // Log audit
    await supabaseAdmin
      .from("admin_audit_log")
      .insert({
        user_id: userData.user.id,
        action: "seed_test_data",
        entity_type: "system",
        entity_id: null,
        new_value: results
      });

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Seed error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
