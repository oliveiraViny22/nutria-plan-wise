import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Documentation content - embedded for reliability
const TECHNICAL_DOC = `DOCUMENTAÇÃO TÉCNICA OFICIAL — NUTRIAPLAN

Versão do Documento: 1.1
Data de Geração: ${new Date().toLocaleDateString('pt-BR')}

═══════════════════════════════════════════════════════════════════════════════
                              SUMÁRIO
═══════════════════════════════════════════════════════════════════════════════

1. VISÃO TÉCNICA GERAL DO SISTEMA
2. OBJETIVO DO PRODUTO SOB A ÓTICA TÉCNICA
3. ARQUITETURA GERAL
4. STACK TECNOLÓGICA
5. TIPOS DE USUÁRIO E PAPÉIS DO SISTEMA
6. REGRAS DE NEGÓCIO DETALHADAS
7. FLUXOS TÉCNICOS DO SISTEMA
8. FUNCIONAMENTO DA IA
9. PERSISTÊNCIA DE DADOS
10. ESTRUTURA CONCEITUAL DO BANCO DE DADOS
11. INTEGRAÇÕES EXTERNAS
12. REQUISITOS FUNCIONAIS
13. REQUISITOS NÃO FUNCIONAIS
14. ERROS CONHECIDOS E PONTOS CRÍTICOS
15. DECISÕES TÉCNICAS JÁ TOMADAS
16. RISCOS TÉCNICOS E LIMITAÇÕES ATUAIS
17. BOAS PRÁTICAS E PADRÕES ADOTADOS
18. PRÓXIMOS PASSOS TÉCNICOS SUGERIDOS

═══════════════════════════════════════════════════════════════════════════════
                    1. VISÃO TÉCNICA GERAL DO SISTEMA
═══════════════════════════════════════════════════════════════════════════════

O NutriaPlan é uma plataforma web de nutrição inteligente que combina automação 
de planos alimentares via Inteligência Artificial com rastreamento de adesão, 
sistema de governança clínica e monetização via assinaturas Stripe.

PROPÓSITO TÉCNICO:
• Automatizar a criação de planos alimentares personalizados usando IA generativa
• Gerenciar relacionamentos profissional-aluno com controle de acesso granular
• Rastrear adesão alimentar com métricas calculadas automaticamente
• Fornecer assistente nutricional conversacional com governança por perfil
• Monetizar através de modelo de assinaturas com múltiplos planos comerciais

CARACTERÍSTICAS PRINCIPAIS:
• Multi-tenant por design: Profissionais gerenciam seus próprios alunos
• Governança de IA: A IA opera com permissões diferenciadas por tipo de usuário
• Modelo hierárquico: diet_plans → meals → meal_options → meal_option_foods
• Sistema de confirmação de refeições: Não é escolha, é confirmação do consumo real
• Equivalência nutricional obrigatória: Opções devem ser equivalentes

═══════════════════════════════════════════════════════════════════════════════
                    2. OBJETIVO DO PRODUTO - ÓTICA TÉCNICA
═══════════════════════════════════════════════════════════════════════════════

PROBLEMAS TÉCNICOS RESOLVIDOS:

1. Automação de cálculos nutricionais complexos
   • Fórmula de Mifflin-St Jeor para cálculo de TMB
   • Distribuição automática de calorias por refeição
   • Seleção inteligente de alimentos por categoria e objetivo

2. Governança de IA em contexto clínico
   • Prevenção de alterações não autorizadas em planos
   • Diferenciação de permissões por perfil de usuário
   • Auditoria de propostas de alteração

3. Rastreamento de adesão alimentar
   • Cálculo automático de métricas de adesão
   • Alertas configuráveis para profissionais
   • Relatórios PDF sob demanda

ESCOPO TÉCNICO:
• Frontend: Single Page Application (SPA) React
• Backend: Supabase (PostgreSQL + Edge Functions + Auth)
• IA: Lovable AI Gateway (Google Gemini / OpenAI GPT-5)
• Pagamentos: Stripe (webhooks, checkout, portal do cliente)

═══════════════════════════════════════════════════════════════════════════════
                         3. ARQUITETURA GERAL
═══════════════════════════════════════════════════════════════════════════════

ARQUITETURA EM CAMADAS:

┌──────────────────────────────────────────────────────────────────────────────┐
│                         CAMADA DE APRESENTAÇÃO                                │
│      React 18.3 + Vite + TailwindCSS + shadcn/ui + Framer Motion            │
├──────────────────────────────────────────────────────────────────────────────┤
│                           CAMADA DE ESTADO                                    │
│             TanStack Query + React Context (AuthContext)                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                         CAMADA DE SERVIÇOS                                    │
│                   Supabase Client (supabase-js)                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                          CAMADA DE BACKEND                                    │
│      Supabase Edge Functions (Deno) + PostgreSQL + RLS Policies             │
├──────────────────────────────────────────────────────────────────────────────┤
│                       CAMADA DE INTEGRAÇÕES                                   │
│          Lovable AI Gateway + Stripe API + Supabase Auth                     │
└──────────────────────────────────────────────────────────────────────────────┘

EDGE FUNCTIONS PRINCIPAIS:
• generate-meal-plan: Geração de planos alimentares via IA
• generate-meal-plan-v2: Versão avançada com opções equivalentes
• nutritional-chat: Chat conversacional com governança
• confirm-meal: Confirmação de consumo de refeições
• create-checkout: Criação de sessão Stripe Checkout
• stripe-webhook: Processamento de eventos Stripe
• customer-portal: Acesso ao portal do cliente Stripe
• create-student: Criação de alunos por profissionais
• adherence-report: Geração de relatórios de adesão
• generate-adherence-pdf: Geração de PDF de relatório
• ai-plan-suggestions: Sugestões de ajuste via IA
• review-suggestion: Revisão de sugestões de IA

═══════════════════════════════════════════════════════════════════════════════
                        4. STACK TECNOLÓGICA
═══════════════════════════════════════════════════════════════════════════════

FRONTEND:
┌─────────────────────┬────────────┬─────────────────────────────────┐
│ Tecnologia          │ Versão     │ Propósito                       │
├─────────────────────┼────────────┼─────────────────────────────────┤
│ React               │ ^18.3.1    │ Framework de UI                 │
│ Vite                │ Latest     │ Build tool e dev server         │
│ TypeScript          │ Latest     │ Tipagem estática                │
│ TailwindCSS         │ Latest     │ Estilização utility-first       │
│ shadcn/ui           │ Latest     │ Componentes de UI               │
│ Framer Motion       │ ^12.26.2   │ Animações                       │
│ TanStack Query      │ ^5.83.0    │ Estado servidor                 │
│ React Router DOM    │ ^6.30.1    │ Roteamento                      │
│ Recharts            │ ^2.15.4    │ Gráficos                        │
│ date-fns            │ ^3.6.0     │ Manipulação de datas            │
│ Zod                 │ ^3.25.76   │ Validação de schemas            │
│ React Hook Form     │ ^7.61.1    │ Gerenciamento de formulários    │
└─────────────────────┴────────────┴─────────────────────────────────┘

BACKEND:
┌─────────────────────┬─────────────────────────────────────────────┐
│ Tecnologia          │ Propósito                                   │
├─────────────────────┼─────────────────────────────────────────────┤
│ Supabase            │ Backend-as-a-Service                        │
│ PostgreSQL          │ Banco de dados relacional                   │
│ Deno                │ Runtime para Edge Functions                 │
│ Supabase Auth       │ Autenticação                                │
│ Supabase Storage    │ Armazenamento de arquivos                   │
└─────────────────────┴─────────────────────────────────────────────┘

INTEGRAÇÕES:
┌─────────────────────┬─────────────────────────────────────────────┐
│ Serviço             │ Propósito                                   │
├─────────────────────┼─────────────────────────────────────────────┤
│ Lovable AI Gateway  │ IA generativa (Gemini/GPT-5)                │
│ Stripe              │ Pagamentos e assinaturas                    │
└─────────────────────┴─────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
                 5. TIPOS DE USUÁRIO E PAPÉIS DO SISTEMA
═══════════════════════════════════════════════════════════════════════════════

TIPOS DE USUÁRIO (user_type - IMUTÁVEL):
┌─────────────────┬─────────────────────────────────────────────────┐
│ user_type       │ Descrição                                       │
├─────────────────┼─────────────────────────────────────────────────┤
│ aluno           │ Usuário vinculado a um profissional             │
│ usuario         │ Usuário autônomo (pessoa física)                │
│ profissional    │ Nutricionista ou profissional de saúde          │
└─────────────────┴─────────────────────────────────────────────────┘

PAPÉIS DO SISTEMA (app_role):
┌─────────────────┬─────────────────────────────────────────────────┐
│ Role            │ Descrição                                       │
├─────────────────┼─────────────────────────────────────────────────┤
│ admin           │ Administrador do sistema                        │
│ professional    │ Profissional de nutrição                        │
│ student         │ Aluno vinculado                                 │
└─────────────────┴─────────────────────────────────────────────────┘

PLANOS COMERCIAIS:
┌─────────────────────┬──────────┬───────────┬──────────────────────┐
│ Plano               │ Tipo     │ Preço/mês │ Descrição            │
├─────────────────────┼──────────┼───────────┼──────────────────────┤
│ gratuito            │ personal │ R$ 0,00   │ IA educacional básica│
│ premium             │ personal │ R$ 4,90   │ IA educacional amplia│
│ plano_pessoal_pago  │ personal │ R$ 14,90  │ IA completa autônoma │
│ profissional        │ profess. │ R$ 99,00  │ IA como assist. clín.│
└─────────────────────┴──────────┴───────────┴──────────────────────┘

MATRIZ DE PERMISSÕES:
┌──────────────────────┬──────────┬─────────┬──────────────┬──────────────┐
│ Permissão            │ Gratuito │ Premium │ Pessoal Pago │ Profissional │
├──────────────────────┼──────────┼─────────┼──────────────┼──────────────┤
│ can_view_plan        │    ✓     │    ✓    │      ✓       │      ✓       │
│ can_create_plan      │    ✗     │    ✗    │      ✓       │      ✓       │
│ can_edit_plan        │    ✗     │    ✗    │      ✓       │      ✓       │
│ can_substitute       │    ✗     │    ✗    │      ✓       │      ✓       │
│ can_adjust           │    ✗     │    ✗    │      ✓       │      ✓       │
│ can_use_ai           │ básica   │ ampliada│   completa   │   clínica    │
│ can_use_simulations  │    ✗     │    ✓    │      ✓       │      ✓       │
│ can_manage_students  │    ✗     │    ✗    │      ✗       │      ✓       │
│ can_send_requests    │ ✓ (aluno)│ ✓(aluno)│      ✗       │      ✗       │
└──────────────────────┴──────────┴─────────┴──────────────┴──────────────┘

LIMITES POR PLANO:
┌─────────────────────┬──────────┬─────────┬──────────────┬──────────────┐
│ Limite              │ Gratuito │ Premium │ Pessoal Pago │ Profissional │
├─────────────────────┼──────────┼─────────┼──────────────┼──────────────┤
│ Dietas/mês          │    0     │    0    │      5       │      ∞       │
│ Substituições/mês   │    0     │    0    │     20       │      ∞       │
│ Ajustes/mês         │    0     │    0    │     10       │      ∞       │
│ Mensagens chat/dia  │    3     │   10    │     30       │     100      │
│ Pacientes           │    0     │    0    │      0       │      50      │
│ Histórico (dias)    │    7     │   30    │     90       │    9999      │
└─────────────────────┴──────────┴─────────┴──────────────┴──────────────┘

═══════════════════════════════════════════════════════════════════════════════
                     6. REGRAS DE NEGÓCIO DETALHADAS
═══════════════════════════════════════════════════════════════════════════════

ESTRUTURA DE PLANOS ALIMENTARES - HIERARQUIA OBRIGATÓRIA:

diet_plans (plano)
  └── meals (refeições)
        └── meal_options (opções de refeição)
              └── meal_option_foods (alimentos da opção)
                    └── foods (cadastro de alimentos)

EQUIVALÊNCIA NUTRICIONAL ENTRE OPÇÕES:
┌──────────────────────┬──────────────────────────────┐
│ Nutriente            │ Margem de Tolerância         │
├──────────────────────┼──────────────────────────────┤
│ Proteína             │ ±5g                          │
│ Carboidratos         │ ±10g                         │
│ Gordura              │ ±3g                          │
│ Calorias             │ ±10%                         │
└──────────────────────┴──────────────────────────────┘

FLUXO DE CONFIRMAÇÃO DE REFEIÇÕES:

PRINCÍPIO FUNDAMENTAL: O plano é SOMENTE LEITURA. O usuário NÃO ESCOLHE 
o que vai comer. O usuário CONFIRMA o que COMEU.

Estados válidos (meal_logs.status):
• PENDENTE: Refeição ainda não registrada
• CONFIRMADA: Usuário confirmou que comeu uma das opções
• PULADA: Usuário pulou a refeição (não comeu nada)
• FORA_DO_PLANO: Usuário comeu algo diferente do plano
• CONFIRMADA_TARDIA: Confirmação feita em data retroativa

CÁLCULO DE ADESÃO:

Fórmula: overall_adherence_rate = (meals_confirmed + meals_late_confirmed) 
                                  / total_meals_expected * 100

Métricas calculadas:
• meals_confirmed: Refeições confirmadas no dia
• meals_late_confirmed: Confirmações tardias
• meals_skipped: Refeições puladas
• meals_out_of_plan: Refeições fora do plano
• days_with_records: Dias com pelo menos 1 registro
• adherence_by_meal: Adesão por tipo de refeição (JSON)
• adherence_by_option: Preferência por opções (JSON)
• exception_distribution: Distribuição de exceções (JSON)

ALERTAS DE ADESÃO:
• threshold_warning: Limite para alerta amarelo (default: 70%)
• threshold_low: Limite para alerta vermelho (default: 50%)
• check_period_days: Período de verificação (default: 7 dias)

DISTRIBUIÇÃO DE CALORIAS POR REFEIÇÃO:
┌──────────────┬──────┬──────────┬────────┬──────────┬────────┬──────┐
│ Refeições    │ Café │ LancheAM │ Almoço │ LanchePM │ Jantar │ Ceia │
├──────────────┼──────┼──────────┼────────┼──────────┼────────┼──────┤
│ 2            │  -   │    -     │  50%   │    -     │  50%   │  -   │
│ 3            │ 25%  │    -     │  40%   │    -     │  35%   │  -   │
│ 4            │ 25%  │    -     │  35%   │   10%    │  30%   │  -   │
│ 5            │ 20%  │   10%    │  30%   │   10%    │  30%   │  -   │
│ 6            │ 20%  │    8%    │  28%   │   10%    │  26%   │  8%  │
└──────────────┴──────┴──────────┴────────┴──────────┴────────┴──────┘

═══════════════════════════════════════════════════════════════════════════════
                        8. FUNCIONAMENTO DA IA
═══════════════════════════════════════════════════════════════════════════════

GATEWAY UTILIZADO:
• Endpoint: https://ai.gateway.lovable.dev/v1/chat/completions
• Modelos: google/gemini-3-flash-preview, gemini-2.5-flash, openai/gpt-5
• API Key: LOVABLE_API_KEY (auto-provisionada)

PRINCÍPIOS DE GOVERNANÇA:

A IA NÃO é autônoma.
A IA NÃO toma decisões finais.
Toda alteração real passa pelo backend.
A IA pode PROPOR, mas não EXECUTAR sem autorização.

PERFIS DE GOVERNANÇA:

ALUNO + GRATUITO:
• Verbos Permitidos: EXPLICAR, ORIENTAR
• Verbos Proibidos: ANALISAR macros, SIMULAR, PROPOR, EXECUTAR
• Limite de Frases: 2-4 frases padrão
• Bloqueio: "Não posso alterar seu plano. Posso criar uma solicitação."

ALUNO + PREMIUM:
• Verbos Permitidos: EXPLICAR, ANALISAR (leitura), SIMULAR
• Verbos Proibidos: EXECUTAR, alterar plano oficial
• Limite de Frases: 4-6 frases padrão
• Simulações: Rotuladas como simulação, sem impacto real

USUÁRIO + PLANO_PESSOAL_PAGO:
• Verbos Permitidos: EXPLICAR, ANALISAR, SIMULAR, PROPOR, EXECUTAR
• Limite de Frases: 5-8 frases padrão
• Execução: Requer confirmação explícita do usuário

PROFISSIONAL:
• Verbos Permitidos: EXPLICAR, ANALISAR, SIMULAR, PROPOR
• Execução: Somente após aprovação explícita do profissional
• Fluxo Obrigatório: IA PROPÕE → Profissional aprova → Sistema executa
• Limite de Frases: 6-10 frases padrão

GUARDRAILS DE SEGURANÇA:
1. Nunca persistir dados diretamente
2. Nunca ignorar vínculo profissional
3. Nunca fechar calorias/macros autonomamente
4. Sempre verificar permissões
5. Bloquear em caso de dúvida

═══════════════════════════════════════════════════════════════════════════════
                     11. INTEGRAÇÕES EXTERNAS
═══════════════════════════════════════════════════════════════════════════════

STRIPE:

Eventos de Webhook Processados:
• checkout.session.completed: Ativa nova assinatura
• customer.subscription.updated: Atualiza status
• customer.subscription.deleted: Marca como cancelada
• invoice.payment_succeeded: Confirma pagamento
• invoice.payment_failed: Inicia grace period

Ciclo de Vida da Assinatura:
trial → active → past_due → canceled/expired

LOVABLE AI GATEWAY:

Modelos por Edge Function:
• generate-meal-plan: gemini-3-flash-preview
• nutritional-chat: gemini-3-flash-preview
• explain-substitution: gemini-2.5-flash
• ai-plan-suggestions: gemini-2.5-flash
• summarization: gemini-2.5-flash-lite

Rate Limits:
• 429: Rate limit exceeded - Aguardar e retry
• 402: Payment required - Adicionar créditos
• 500: Erro interno - Retry com backoff

═══════════════════════════════════════════════════════════════════════════════
                     13. REQUISITOS NÃO FUNCIONAIS
═══════════════════════════════════════════════════════════════════════════════

PERFORMANCE:
• Tempo de resposta API < 2 segundos para operações comuns
• Geração de plano alimentar < 30 segundos
• Resposta do chat < 10 segundos
• Cache de permissões por 60 segundos
• Limite de 1000 rows por query no Supabase

SEGURANÇA:
• RLS habilitado em todas as tabelas
• Funções SECURITY DEFINER para operações privilegiadas
• Validação de webhook signature do Stripe
• Secrets nunca expostos no cliente
• Rate limiting em Edge Functions
• Validação de input em todas as Edge Functions
• Roles armazenados em tabela separada
• Verificação de idempotência em webhooks

ESCALABILIDADE:
• Arquitetura serverless (Edge Functions escalam automaticamente)
• Banco de dados gerenciado (Supabase/PostgreSQL)
• Sem estado no servidor (stateless)
• Suporte a múltiplos profissionais com múltiplos alunos

═══════════════════════════════════════════════════════════════════════════════
                  14. ERROS CONHECIDOS E PONTOS CRÍTICOS
═══════════════════════════════════════════════════════════════════════════════

TIMEOUTS DE CONEXÃO:
• Descrição: Queries complexas podem causar timeout no tier Pico
• Causa: Limite de 60 conexões no pool do tier Pico
• Mitigação: Cache de 60s, otimização de queries, índices
• Solução definitiva: Upgrade de instância

RLS RECURSIVO:
• Descrição: Políticas RLS podem causar recursão
• Mitigação: Uso de SECURITY DEFINER em funções helper
• Status: Parcialmente resolvido

RISCOS TÉCNICOS:
┌────────────────────────┬───────────────┬─────────┬──────────────────────┐
│ Risco                  │ Probabilidade │ Impacto │ Mitigação            │
├────────────────────────┼───────────────┼─────────┼──────────────────────┤
│ Timeout de banco       │ Alta          │ Médio   │ Cache, índices       │
│ Rate limit IA          │ Média         │ Médio   │ Rate limiting        │
│ Falha webhook Stripe   │ Baixa         │ Alto    │ Idempotência         │
│ Esgotamento créditos   │ Média         │ Alto    │ Monitoramento        │
└────────────────────────┴───────────────┴─────────┴──────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
                  18. PRÓXIMOS PASSOS TÉCNICOS SUGERIDOS
═══════════════════════════════════════════════════════════════════════════════

CURTO PRAZO (1-2 meses):
1. Upgrade de instância Supabase: Resolver timeouts
2. Implementar reconciliação de assinaturas
3. Adicionar testes automatizados
4. Otimizar queries de adesão

MÉDIO PRAZO (3-6 meses):
1. PWA/Offline: Service worker para funcionalidade offline
2. Push Notifications: Alertas de adesão via push
3. Realtime: Atualizações em tempo real para profissionais
4. Multi-idioma: i18n para expansão internacional
5. API Pública: Integrações com terceiros

LONGO PRAZO (6-12 meses):
1. App Nativo: React Native para iOS/Android
2. Integração Wearables: Apple Health, Google Fit
3. IA mais avançada: Análise preditiva de adesão
4. White-label: Versão para clínicas personalizarem
5. Marketplace de planos: Profissionais vendem planos prontos

═══════════════════════════════════════════════════════════════════════════════

Documento gerado automaticamente em ${new Date().toLocaleDateString('pt-BR')}
Versão 1.1 - NutriaPlan
`;

const COMMERCIAL_DOC = `DOCUMENTAÇÃO COMERCIAL — NUTRIAPLAN

Versão do Documento: 1.0
Data de Geração: ${new Date().toLocaleDateString('pt-BR')}

═══════════════════════════════════════════════════════════════════════════════
                         APRESENTAÇÃO DA FERRAMENTA
═══════════════════════════════════════════════════════════════════════════════

O NutriaPlan é uma plataforma de nutrição inteligente que revoluciona a forma 
como profissionais de nutrição e seus pacientes interagem com planos alimentares.

Combinando Inteligência Artificial avançada com uma interface intuitiva, o 
NutriaPlan automatiza a criação de planos alimentares personalizados, monitora 
a adesão em tempo real e fornece insights valiosos para otimizar resultados.

═══════════════════════════════════════════════════════════════════════════════
                      PROBLEMA QUE O PRODUTO RESOLVE
═══════════════════════════════════════════════════════════════════════════════

PARA PROFISSIONAIS DE NUTRIÇÃO:
• Criação manual de planos consome 2-4 horas por paciente
• Dificuldade em monitorar adesão entre consultas
• Falta de dados objetivos para ajustar planos
• Escala limitada pela capacidade operacional

PARA PACIENTES:
• Planos genéricos que não consideram preferências
• Falta de variedade leva ao abandono
• Dificuldade em registrar o que comeu
• Sem acompanhamento entre consultas

═══════════════════════════════════════════════════════════════════════════════
                          PROPOSTA DE VALOR
═══════════════════════════════════════════════════════════════════════════════

"Planos alimentares personalizados em minutos, não horas. 
 Acompanhamento contínuo, não apenas nas consultas."

PARA PROFISSIONAIS:
✓ Gere planos personalizados em 30 segundos com IA
✓ Acompanhe a adesão de todos os pacientes em um painel
✓ Receba alertas automáticos quando a adesão cair
✓ Atenda mais pacientes com a mesma qualidade

PARA PACIENTES:
✓ Variedade com opções equivalentes para cada refeição
✓ Registre refeições com um toque
✓ Chat com assistente nutricional 24/7
✓ Visualize seu progresso e evolução

═══════════════════════════════════════════════════════════════════════════════
                            PÚBLICO-ALVO
═══════════════════════════════════════════════════════════════════════════════

PRIMÁRIO - Nutricionistas e Profissionais de Saúde:
• Nutricionistas clínicos
• Nutricionistas esportivos
• Personal trainers com certificação em nutrição
• Clínicas de nutrição e estética

SECUNDÁRIO - Usuários Individuais:
• Pessoas buscando perda de peso
• Atletas amadores
• Pessoas com objetivos fitness específicos
• Usuários conscientes de saúde

═══════════════════════════════════════════════════════════════════════════════
                     COMO A PLATAFORMA FUNCIONA
═══════════════════════════════════════════════════════════════════════════════

PARA O PROFISSIONAL:

1. CADASTRE seus pacientes na plataforma
2. DEFINA metas calóricas e de macronutrientes
3. GERE planos alimentares personalizados com IA
4. ACOMPANHE a adesão em tempo real
5. RECEBA alertas e ajuste planos quando necessário

PARA O PACIENTE:

1. ACESSE seu plano alimentar personalizado
2. VEJA opções equivalentes para cada refeição
3. CONFIRME o que comeu durante o dia
4. CONVERSE com o assistente nutricional
5. ACOMPANHE seu progresso

═══════════════════════════════════════════════════════════════════════════════
                      DIFERENCIAIS COMPETITIVOS
═══════════════════════════════════════════════════════════════════════════════

1. IA COM GOVERNANÇA CLÍNICA
   A inteligência artificial respeita hierarquias. Para pacientes vinculados,
   apenas o profissional pode aprovar alterações no plano.

2. OPÇÕES NUTRICIONALMENTE EQUIVALENTES
   Cada refeição tem múltiplas opções com os mesmos valores nutricionais,
   dando liberdade de escolha sem comprometer resultados.

3. SISTEMA DE CONFIRMAÇÃO, NÃO ESCOLHA
   O paciente confirma o que comeu, não escolhe antecipadamente. 
   Isso gera dados reais de adesão.

4. ALERTAS PROATIVOS
   O profissional recebe alertas automáticos quando a adesão do 
   paciente cai abaixo do limite configurado.

5. CHAT CONTEXTUALIZADO
   O assistente conhece o plano do paciente e responde de forma
   personalizada, respeitando as regras definidas pelo profissional.

═══════════════════════════════════════════════════════════════════════════════
                        PLANOS E PREÇOS
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│                           PLANO GRATUITO                                     │
│                              R$ 0/mês                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Visualização do plano alimentar                                           │
│ • Confirmação de refeições                                                  │
│ • Chat educacional básico (3 mensagens/dia)                                 │
│ • Histórico de 7 dias                                                       │
│ • Ideal para: Pacientes vinculados a profissionais                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           PLANO PREMIUM                                      │
│                            R$ 4,90/mês                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Tudo do plano Gratuito                                                    │
│ • Chat educacional ampliado (10 mensagens/dia)                              │
│ • Simulações nutricionais                                                   │
│ • Histórico de 30 dias                                                      │
│ • Ideal para: Pacientes que querem mais suporte                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         PLANO PESSOAL PAGO                                   │
│                            R$ 14,90/mês                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ • IA completa com autonomia                                                 │
│ • Gerar até 5 planos/mês                                                    │
│ • 20 substituições de alimentos/mês                                         │
│ • 10 ajustes de macros/mês                                                  │
│ • Chat avançado (30 mensagens/dia)                                          │
│ • Histórico de 90 dias                                                      │
│ • Ideal para: Usuários autônomos sem profissional                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        PLANO PROFISSIONAL                                    │
│                            R$ 99,00/mês                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Geração ilimitada de planos                                               │
│ • Até 50 pacientes ativos                                                   │
│ • Dashboard de adesão centralizado                                          │
│ • Alertas automáticos de baixa adesão                                       │
│ • Relatórios PDF para pacientes                                             │
│ • IA como assistente clínica                                                │
│ • Sugestões de ajuste baseadas em dados                                     │
│ • Chat profissional (100 mensagens/dia)                                     │
│ • Histórico completo                                                        │
│ • Ideal para: Nutricionistas e profissionais de saúde                       │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
                       MODELO DE MONETIZAÇÃO
═══════════════════════════════════════════════════════════════════════════════

RECEITA RECORRENTE (SaaS):
• Assinaturas mensais de profissionais (R$ 99/mês)
• Upgrade de pacientes para Premium (R$ 4,90/mês)
• Planos pessoais pagos (R$ 14,90/mês)

POTENCIAL DE RECEITA:
• 100 profissionais × R$ 99 = R$ 9.900/mês
• 1.000 pacientes premium × R$ 4,90 = R$ 4.900/mês
• 500 usuários pessoais × R$ 14,90 = R$ 7.450/mês
• Total potencial: R$ 22.250/mês (R$ 267.000/ano)

═══════════════════════════════════════════════════════════════════════════════
                   BENEFÍCIOS POR TIPO DE USUÁRIO
═══════════════════════════════════════════════════════════════════════════════

PARA PROFISSIONAIS:
┌─────────────────────────────────────────────────────────────────────────────┐
│ ANTES do NutriaPlan           │ DEPOIS do NutriaPlan                        │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 2-4 horas para criar plano    │ 30 segundos com IA                          │
│ Sem dados de adesão           │ Métricas em tempo real                      │
│ Ajustes apenas na consulta    │ Alertas automáticos                         │
│ Escala limitada               │ Até 50 pacientes ativos                     │
│ Planilhas e papel             │ Tudo digital e organizado                   │
└───────────────────────────────┴─────────────────────────────────────────────┘

PARA PACIENTES:
┌─────────────────────────────────────────────────────────────────────────────┐
│ ANTES do NutriaPlan           │ DEPOIS do NutriaPlan                        │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ Plano único e monótono        │ Múltiplas opções equivalentes               │
│ Sem acompanhamento            │ Chat nutricional 24/7                       │
│ Registro manual difícil       │ Confirmação com um toque                    │
│ Sem visibilidade de progresso │ Dashboard de evolução                       │
│ Dúvidas até a próxima consulta│ Respostas imediatas da IA                   │
└───────────────────────────────┴─────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
                       ESCALABILIDADE DO NEGÓCIO
═══════════════════════════════════════════════════════════════════════════════

FASE 1 - VALIDAÇÃO (atual):
• Foco em nutricionistas brasileiros
• Produto mínimo viável completo
• Modelo de assinatura estabelecido

FASE 2 - CRESCIMENTO:
• App mobile (iOS/Android)
• Integração com wearables (Apple Health, Google Fit)
• Notificações push
• Expansão para personal trainers

FASE 3 - EXPANSÃO:
• Internacionalização (LATAM)
• API para integrações
• White-label para clínicas
• Marketplace de planos prontos

═══════════════════════════════════════════════════════════════════════════════
                     SEGURANÇA E CONFIABILIDADE
═══════════════════════════════════════════════════════════════════════════════

• Dados criptografados em trânsito e em repouso
• Autenticação segura via Supabase Auth
• Conformidade com LGPD
• Backups automáticos diários
• Infraestrutura em nuvem escalável
• Pagamentos seguros via Stripe

═══════════════════════════════════════════════════════════════════════════════
                          CASOS DE USO
═══════════════════════════════════════════════════════════════════════════════

CASO 1 - Nutricionista Clínica
"Antes eu passava 3 horas montando cada plano. Agora gero em 30 segundos e 
ainda tenho tempo de personalizar. Consigo atender 30% mais pacientes."

CASO 2 - Atleta Amador
"Ter opções equivalentes mudou tudo. Não preciso comer sempre a mesma coisa
e sei que estou atingindo meus macros."

CASO 3 - Paciente em Tratamento
"O chat me ajuda quando tenho dúvidas fora do horário. E meu nutricionista
consegue ver quando eu saio do plano e já me orienta na próxima consulta."

═══════════════════════════════════════════════════════════════════════════════
                        VISÃO DE FUTURO
═══════════════════════════════════════════════════════════════════════════════

CURTO PRAZO (6 meses):
• App mobile para iOS e Android
• Notificações push de lembretes
• Integração com balança inteligente

MÉDIO PRAZO (12 meses):
• IA preditiva para antecipar abandono
• Integração com Apple Health e Google Fit
• Versão internacional (inglês e espanhol)

LONGO PRAZO (24 meses):
• Marketplace de planos alimentares
• White-label para redes de clínicas
• Análise genética para personalização

═══════════════════════════════════════════════════════════════════════════════

CONTATO:
• Email: contato@nutriaplan.com.br
• Website: https://nutriaplan.com.br

Documento gerado automaticamente em ${new Date().toLocaleDateString('pt-BR')}
NutriaPlan - Nutrição Inteligente
`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const { docType } = await req.json();
    
    let content: string;
    let filename: string;

    if (docType === 'technical') {
      content = TECHNICAL_DOC;
      filename = 'DOCUMENTACAO_TECNICA_NUTRIAPLAN.txt';
    } else if (docType === 'commercial') {
      content = COMMERCIAL_DOC;
      filename = 'DOCUMENTACAO_COMERCIAL_NUTRIAPLAN.txt';
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid docType. Use "technical" or "commercial"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return the document as downloadable text file
    // Using UTF-8 encoded text which preserves formatting
    const encoder = new TextEncoder();
    const bytes = encoder.encode(content);

    console.log(`[generate-documentation-pdf] Generated ${docType} doc for admin ${user.email}`);

    return new Response(bytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('[generate-documentation-pdf] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
