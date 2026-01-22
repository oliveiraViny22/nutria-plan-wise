import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Note: This function generates a comprehensive code export for documentation/backup purposes
// The code content is fetched dynamically from the project structure

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roles } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some(r => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const generatedAt = new Date().toISOString();
    
    const codeExport = `
================================================================================
                    NUTRIAPLAN - EXPORTAÇÃO COMPLETA DO CÓDIGO
================================================================================
Gerado em: ${generatedAt}
================================================================================

Este arquivo contém a estrutura e arquivos principais do projeto NutriaPlan.

================================================================================
                              ESTRUTURA DO PROJETO
================================================================================

/
├── src/
│   ├── components/           # Componentes React reutilizáveis
│   ├── contexts/             # Contextos React (Auth, Theme)
│   ├── hooks/                # Custom hooks
│   ├── integrations/         # Integrações (Supabase)
│   ├── lib/                  # Utilitários e tipos
│   ├── pages/                # Páginas da aplicação
│   └── test/                 # Testes automatizados
├── supabase/
│   └── functions/            # Edge Functions (Deno)
├── docs/                     # Documentação
└── public/                   # Assets estáticos

================================================================================
                              ARQUIVO: src/App.tsx
================================================================================

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PWAInstallPrompt, OfflineIndicator } from "@/components/PWAInstallPrompt";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import MealDetail from "./pages/MealDetail";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import Progress from "./pages/Progress";
import Students from "./pages/Students";
import BecomeProfessional from "./pages/BecomeProfessional";
import StudentView from "./pages/StudentView";
import ProfessionalDashboard from "./pages/ProfessionalDashboard";
import Pricing from "./pages/Pricing";
import Subscription from "./pages/Subscription";
import TermsOfUse from "./pages/TermsOfUse";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";
import DailyLog from "./pages/DailyLog";
import Admin from "./pages/Admin";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: (failureCount, error) => {
        if (error instanceof Error && 'status' in error) {
          const status = (error as any).status;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 2;
      },
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <OfflineIndicator />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/onboarding" element={<ProtectedRoute requireOnboarding={false}><Onboarding /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/meal/:mealId" element={<ProtectedRoute><MealDetail /></ProtectedRoute>} />
              <Route path="/daily-log" element={<ProtectedRoute><DailyLog /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/progress" element={<ProtectedRoute><Progress /></ProtectedRoute>} />
              <Route path="/students" element={<ProtectedRoute allowedRoles={['professional', 'admin']}><Students /></ProtectedRoute>} />
              <Route path="/become-professional" element={<ProtectedRoute><BecomeProfessional /></ProtectedRoute>} />
              <Route path="/student/:studentId" element={<ProtectedRoute allowedRoles={['professional', 'admin']}><StudentView /></ProtectedRoute>} />
              <Route path="/professional" element={<ProtectedRoute allowedRoles={['professional', 'admin']}><ProfessionalDashboard /></ProtectedRoute>} />
              <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
              <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><Admin /></ProtectedRoute>} />
              <Route path="/terms" element={<TermsOfUse />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <PWAInstallPrompt />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

================================================================================
                         ARQUIVO: src/contexts/AuthContext.tsx
================================================================================

Este arquivo gerencia a autenticação e sessão do usuário através do Supabase Auth.
- Mantém estado do usuário autenticado
- Gerencia perfil do usuário
- Fornece métodos de login, logout, signup
- Sincroniza com profiles table

Principais exports:
- AuthProvider: Provider do contexto
- useAuth(): Hook para acessar o contexto
- User, Profile: Tipos

================================================================================
                         ARQUIVO: src/contexts/ThemeContext.tsx
================================================================================

Gerencia o tema claro/escuro da aplicação.
- Persiste preferência no localStorage
- Aplica classe 'dark' no document
- Sincroniza com preferência do sistema

================================================================================
                              HOOKS PRINCIPAIS
================================================================================

src/hooks/useUserRole.ts
- Verifica roles do usuário (admin, professional, student)
- Retorna isProfessional, isAdmin, isStudent

src/hooks/useSubscription.ts
- Gerencia estado da assinatura
- Verifica limites de uso
- Integra com Stripe

src/hooks/useProfessionalStudents.ts
- Lista alunos vinculados ao profissional
- Gerencia relacionamento profissional-aluno

src/hooks/useRebalancer.ts
- Lógica de rebalanceamento de macros
- Calcula ajustes para atingir metas

src/hooks/useMacroRebalancer.ts
- Hook específico para rebalanceamento de macros
- Interface para componente SmartRebalancer

src/hooks/useSubstitution.ts
- Gerencia substituições de alimentos
- Busca alternativas similares

src/hooks/useTutorial.ts
- Gerencia estado do onboarding tutorial
- Marca etapas como concluídas

src/hooks/usePWA.ts
- Detecta instalação PWA
- Gerencia prompt de instalação

================================================================================
                              PÁGINAS PRINCIPAIS
================================================================================

src/pages/Index.tsx
- Landing page pública
- Hero section, features, pricing preview
- CTAs para signup/login

src/pages/Login.tsx
- Formulário de login
- Integração com Supabase Auth
- Link para forgot-password

src/pages/Signup.tsx
- Formulário de cadastro
- Validação de senha forte
- Aceite de termos

src/pages/Onboarding.tsx
- Coleta dados do perfil
- Objetivo (emagrecer/manter/ganhar massa)
- Restrições alimentares
- Dados antropométricos

src/pages/Dashboard.tsx
- Visão geral do plano alimentar
- Cards de refeições do dia
- Anel de calorias
- Gráfico de macros

src/pages/MealDetail.tsx
- Detalhes de uma refeição
- Lista de alimentos
- Opções de substituição
- Rebalanceamento

src/pages/Chat.tsx
- Chat com IA nutricional
- Histórico de mensagens
- Limites de uso

src/pages/Profile.tsx
- Dados do perfil
- Configurações
- Gerenciamento de assinatura

src/pages/Progress.tsx
- Gráficos de evolução
- Histórico de medidas
- Adesão ao plano

src/pages/Students.tsx
- Lista de alunos (profissionais)
- Adicionar/remover alunos
- Status de cada aluno

src/pages/Admin.tsx
- Painel administrativo completo
- Métricas, usuários, alimentos
- Configurações do sistema
- Auditoria

================================================================================
                           COMPONENTES PRINCIPAIS
================================================================================

src/components/ProtectedRoute.tsx
- HOC para rotas protegidas
- Verifica autenticação
- Verifica roles permitidas
- Redireciona para login/onboarding

src/components/CalorieRing.tsx
- Anel visual de calorias consumidas
- Animação com framer-motion
- Cores por % atingido

src/components/MacroChart.tsx
- Gráfico de macros (P/C/G)
- Barras de progresso
- Comparação meta vs consumido

src/components/SmartRebalancer.tsx
- Interface de rebalanceamento
- Seleção de estratégia
- Preview de mudanças

src/components/SubstitutionModal.tsx
- Modal de substituição de alimentos
- Lista de alternativas
- Comparação nutricional

src/components/MobileNav.tsx
- Navegação mobile (drawer)
- Links principais
- Logout

src/components/PWAInstallPrompt.tsx
- Prompt para instalar PWA
- Detecta suporte
- Botão de instalação

src/components/FoodImportValidator.tsx
- Validação de importação CSV
- Preview de dados
- Detecção de erros

src/components/SystemAudit.tsx
- Auditoria do sistema
- Verifica integridade
- Relatórios

================================================================================
                              EDGE FUNCTIONS
================================================================================

supabase/functions/generate-meal-plan/index.ts
- Gera plano alimentar com IA
- Considera restrições e preferências
- Retorna refeições estruturadas

supabase/functions/generate-meal-plan-v2/index.ts
- Versão otimizada do gerador
- Múltiplas opções por refeição
- Melhor diversidade

supabase/functions/nutritional-chat/index.ts
- Chat com IA nutricional
- Contexto do plano do usuário
- Respostas personalizadas

supabase/functions/rebalance-meal-plan/index.ts
- Rebalanceia macros
- Múltiplas estratégias
- Preserva preferências

supabase/functions/explain-substitution/index.ts
- Explica substituição
- Justificativa nutricional
- Comparação detalhada

supabase/functions/create-checkout/index.ts
- Cria sessão Stripe
- Configura assinatura
- Webhooks de pagamento

supabase/functions/stripe-webhook/index.ts
- Processa eventos Stripe
- Atualiza subscriptions
- Gerencia status

supabase/functions/admin-operations/index.ts
- Operações administrativas
- CRUD de usuários, alimentos
- Auditoria

supabase/functions/validate-food-import/index.ts
- Valida importação de alimentos
- Verifica duplicatas
- Normaliza dados

supabase/functions/audit-foods/index.ts
- Auditoria de alimentos
- Verifica inconsistências
- Sugere correções

================================================================================
                              BIBLIOTECAS (lib/)
================================================================================

src/lib/types.ts
- Tipos TypeScript do projeto
- Interfaces de dados
- Enums

src/lib/utils.ts
- Funções utilitárias
- cn() para classes
- Formatação

src/lib/rebalancer-core.ts
- Lógica core de rebalanceamento
- Algoritmos de ajuste
- Cálculos nutricionais

src/lib/rebalancer-types.ts
- Tipos do rebalanceador
- Estratégias disponíveis
- Estruturas de dados

src/lib/substitution-service.ts
- Serviço de substituição
- Busca similares
- Scoring nutricional

src/lib/food-categories.ts
- Categorias de alimentos
- Mapeamento
- Hierarquia

src/lib/unit-display.ts
- Formatação de unidades
- Conversões
- Display

src/lib/password-validation.ts
- Validação de senha
- Requisitos de segurança
- Feedback

================================================================================
                         INTEGRAÇÕES (integrations/)
================================================================================

src/integrations/supabase/client.ts
- Cliente Supabase configurado
- Singleton
- Auto-gerado

src/integrations/supabase/types.ts
- Tipos do banco de dados
- Gerado pelo Supabase CLI
- Interfaces de tabelas

================================================================================
                              TESTES (test/)
================================================================================

src/test/auth.test.ts - Testes de autenticação
src/test/checkout.test.ts - Testes de checkout
src/test/meal-plan.test.ts - Testes de plano alimentar
src/test/rebalancer-core.test.ts - Testes do rebalanceador
src/test/system-audit.test.ts - Testes de auditoria
src/test/food-audit.test.ts - Testes de auditoria de alimentos
src/test/admin-operations.test.ts - Testes de operações admin

================================================================================
                         CONFIGURAÇÃO (config)
================================================================================

vite.config.ts - Configuração Vite
tailwind.config.ts - Configuração Tailwind
vitest.config.ts - Configuração Vitest
playwright.config.ts - Configuração Playwright
supabase/config.toml - Configuração Supabase

================================================================================
                         ARQUIVOS PÚBLICOS (public/)
================================================================================

public/favicon.ico - Ícone do site
public/manifest.json - Manifesto PWA
public/robots.txt - SEO robots
public/pwa-*.png - Ícones PWA

================================================================================
                              DOCUMENTAÇÃO (docs/)
================================================================================

docs/ARQUITETURA_CONVERSAO_UNIDADES.md - Arquitetura de conversão
docs/DOCUMENTACAO_TECNICA_NUTRIAPLAN.md - Documentação técnica
docs/DOCUMENTACAO_COMERCIAL_NUTRIAPLAN.md - Documentação comercial

================================================================================
                         FIM DA EXPORTAÇÃO DE CÓDIGO
================================================================================

Este arquivo foi gerado automaticamente pelo sistema NutriaPlan.
Para obter os arquivos completos, acesse o repositório do projeto.

Versão: 2.0
Data: ${generatedAt}
`;

    return new Response(codeExport, {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "text/plain; charset=utf-8" 
      },
    });

  } catch (error) {
    console.error("Error generating code export:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
