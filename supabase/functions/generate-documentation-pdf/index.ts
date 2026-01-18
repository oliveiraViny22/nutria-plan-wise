import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hardcoded documentation content (generated from docs/ files)
const TECHNICAL_DOC = `# DOCUMENTAÇÃO TÉCNICA OFICIAL — NUTRIAPLAN

## Versão do Documento: 2.0
## Data de Geração: 18 de Janeiro de 2026
## Última Atualização: 18 de Janeiro de 2026

---

## CHANGELOG

| Versão | Data | Alterações |
|--------|------|------------|
| 2.0 | 18/01/2026 | Versão consolidada: adicionados fluxos completos por perfil (Admin, Profissional, Aluno), detalhamento de gestão de alimentos, estrutura completa do banco de dados com cardinalidades, aprofundamento da IA, seção de auditoria administrativa, edge functions recentes |
| 1.1 | 18/01/2026 | Versão inicial com estrutura base |

---

# 📑 SUMÁRIO NAVEGÁVEL

## Visão Geral
- 1. Visão Técnica Geral do Sistema
- 2. Objetivo do Produto sob a Ótica Técnica

## Arquitetura e Stack
- 3. Arquitetura Geral
- 4. Stack Tecnológica

## Usuários e Permissões
- 5. Tipos de Usuário e Papéis do Sistema
- 6. Fluxos Completos por Perfil de Usuário (NOVO)

## Regras de Negócio
- 7. Regras de Negócio Detalhadas

## Gestão de Alimentos
- 8. Gestão de Alimentos (NOVO/EXPANDIDO)

## Fluxos Técnicos
- 9. Fluxos Técnicos do Sistema

## Inteligência Artificial
- 10. Funcionamento da IA (EXPANDIDO)

## Banco de Dados
- 11. Estrutura Completa do Banco de Dados (EXPANDIDO)
- 12. Persistência de Dados

## Integrações
- 13. Integrações Externas

## Requisitos
- 14. Requisitos Funcionais
- 15. Requisitos Não Funcionais

## Administração
- 16. Painel Administrativo (NOVO)

## Diagnóstico e Evolução
- 17. Erros Conhecidos e Pontos Críticos
- 18. Decisões Técnicas Já Tomadas
- 19. Riscos Técnicos e Limitações Atuais
- 20. Boas Práticas e Padrões Adotados
- 21. Próximos Passos Técnicos Sugeridos

## Apêndices
- A. Categorias de Alimentos
- B. Níveis de Processamento
- C. Tipos de Refeição
- D. Fórmula de Mifflin-St Jeor
- E. Ajuste Calórico por Objetivo
- F. Glossário Técnico (NOVO)

---

# 1. VISÃO TÉCNICA GERAL DO SISTEMA

O NutriaPlan é uma plataforma web de nutrição inteligente que combina automação de planos alimentares via Inteligência Artificial com rastreamento de adesão, sistema de governança clínica e monetização via assinaturas Stripe.

## 1.1 Propósito Técnico

O sistema foi projetado para:
- Automatizar a criação de planos alimentares personalizados usando IA generativa
- Gerenciar relacionamentos profissional-aluno com controle de acesso granular
- Rastrear adesão alimentar com métricas calculadas automaticamente
- Fornecer assistente nutricional conversacional com governança por perfil
- Monetizar através de modelo de assinaturas com múltiplos planos comerciais

## 1.2 Características Principais

- Multi-tenant por design: Profissionais gerenciam seus próprios alunos
- Governança de IA: A IA opera com permissões diferenciadas por tipo de usuário
- Modelo hierárquico de planos alimentares: diet_plans → meals → meal_options → meal_option_foods
- Sistema de confirmação de refeições: Não é escolha, é confirmação do consumo real
- Equivalência nutricional obrigatória: Opções de refeição devem ser equivalentes dentro de margens definidas

---

# 2. OBJETIVO DO PRODUTO SOB A ÓTICA TÉCNICA

## 2.1 Problemas Técnicos Resolvidos

1. Automação de cálculos nutricionais complexos
   - Fórmula de Mifflin-St Jeor para cálculo de TMB
   - Distribuição automática de calorias por refeição
   - Seleção inteligente de alimentos por categoria e objetivo

2. Governança de IA em contexto clínico
   - Prevenção de alterações não autorizadas em planos
   - Diferenciação de permissões por perfil de usuário
   - Auditoria de propostas de alteração

3. Rastreamento de adesão alimentar
   - Cálculo automático de métricas de adesão
   - Alertas configuráveis para profissionais
   - Relatórios PDF sob demanda

## 2.2 Escopo Técnico

- Frontend: Single Page Application (SPA) React
- Backend: Supabase (PostgreSQL + Edge Functions + Auth)
- IA: Lovable AI Gateway (Google Gemini / OpenAI GPT-5)
- Pagamentos: Stripe (webhooks, checkout, portal do cliente)

---

# 3. ARQUITETURA GERAL

## 3.1 Arquitetura em Camadas

CAMADA DE APRESENTAÇÃO: React 18.3 + Vite + TailwindCSS + shadcn/ui + Framer Motion
CAMADA DE ESTADO: TanStack Query + React Context (AuthContext)
CAMADA DE SERVIÇOS: Supabase Client (supabase-js)
CAMADA DE BACKEND: Supabase Edge Functions (Deno) + PostgreSQL + RLS Policies
CAMADA DE INTEGRAÇÕES: Lovable AI Gateway + Stripe API + Supabase Auth

## 3.2 Edge Functions

| Edge Function | Propósito |
|---------------|-----------|
| generate-meal-plan | Geração de planos alimentares via IA |
| generate-meal-plan-v2 | Versão avançada com opções equivalentes |
| nutritional-chat | Chat conversacional com governança |
| confirm-meal | Confirmação de consumo de refeições |
| create-checkout | Criação de sessão Stripe Checkout |
| stripe-webhook | Processamento de eventos Stripe |
| customer-portal | Acesso ao portal do cliente Stripe |
| create-student | Criação de alunos por profissionais |
| lookup-student | Busca de alunos por email |
| adherence-report | Geração de relatórios de adesão |
| generate-adherence-pdf | Geração de PDF de relatório |
| ai-plan-suggestions | Sugestões de ajuste via IA |
| review-suggestion | Revisão de sugestões de IA |
| check-adherence-alerts | Verificação de alertas de adesão |
| validate-usage | Validação de limites de uso |
| explain-substitution | Explicação de substituições alimentares |
| admin-operations | Operações administrativas centralizadas |
| seed-test-data | Geração de dados de teste |
| check-subscription | Verificação de status de assinatura |
| reconcile-subscriptions | Reconciliação periódica com Stripe |
| validate-email | Validação de formato de email |
| validate-food-import | Validação de importação de alimentos via IA |
| audit-foods | Auditoria e normalização de alimentos via IA |

---

# 4. STACK TECNOLÓGICA

## 4.1 Frontend

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| React | ^18.3.1 | Framework de UI |
| Vite | Latest | Build tool e dev server |
| TypeScript | Latest | Tipagem estática |
| TailwindCSS | Latest | Estilização utility-first |
| shadcn/ui | Latest | Componentes de UI |
| Framer Motion | ^12.26.2 | Animações |
| TanStack Query | ^5.83.0 | Gerenciamento de estado servidor |
| React Router DOM | ^6.30.1 | Roteamento |
| Recharts | ^2.15.4 | Gráficos |
| date-fns | ^3.6.0 | Manipulação de datas |
| Zod | ^3.25.76 | Validação de schemas |
| React Hook Form | ^7.61.1 | Gerenciamento de formulários |

## 4.2 Backend

| Tecnologia | Propósito |
|------------|-----------|
| Supabase | Backend-as-a-Service |
| PostgreSQL | Banco de dados relacional |
| Deno | Runtime para Edge Functions |
| Supabase Auth | Autenticação |
| Supabase Storage | Armazenamento de arquivos |

## 4.3 Integrações

| Serviço | Propósito |
|---------|-----------|
| Lovable AI Gateway | IA generativa (Gemini/GPT-5) |
| Stripe | Pagamentos e assinaturas |

---

# 5. TIPOS DE USUÁRIO E PAPÉIS DO SISTEMA

## 5.1 Tipos de Usuário (user_type - IMUTÁVEL)

| user_type | Descrição |
|-----------|-----------|
| aluno | Usuário vinculado a um profissional |
| usuario | Usuário autônomo (pessoa física) |
| profissional | Nutricionista ou profissional de saúde |

## 5.2 Papéis do Sistema (app_role)

| Role | Descrição | Pode ser atribuído a |
|------|-----------|---------------------|
| admin | Administrador do sistema | Qualquer user_type |
| professional | Profissional de nutrição | user_type = profissional |
| student | Aluno vinculado | user_type = aluno |

## 5.3 Planos Comerciais (CommercialPlan)

| Plano | Tipo | Preço/mês | Descrição |
|-------|------|-----------|-----------|
| gratuito | personal | R$ 0,00 | IA educacional básica |
| premium | personal | R$ 4,90 | IA educacional ampliada (alunos vinculados) |
| plano_pessoal_pago | personal | R$ 14,90 | IA completa com autonomia |
| profissional | professional | R$ 99,00 | IA como assistente clínica |

## 5.4 Matriz de Permissões por Plano

| Permissão | Gratuito | Premium | Pessoal Pago | Profissional |
|-----------|----------|---------|--------------|--------------|
| can_view_plan | ✓ | ✓ | ✓ | ✓ |
| can_create_plan | ✗ | ✗ | ✓ | ✓ |
| can_edit_plan | ✗ | ✗ | ✓ | ✓ |
| can_substitute | ✗ | ✗ | ✓ | ✓ |
| can_adjust | ✗ | ✗ | ✓ | ✓ |
| can_use_ai | ✓ (básica) | ✓ (ampliada) | ✓ (completa) | ✓ (clínica) |
| can_manage_students | ✗ | ✗ | ✗ | ✓ |

## 5.5 Limites por Plano

| Limite | Gratuito | Premium | Pessoal Pago | Profissional |
|--------|----------|---------|--------------|--------------|
| Dietas/mês | 0 | 0 | 5 | ∞ |
| Substituições/mês | 0 | 0 | 20 | ∞ |
| Ajustes/mês | 0 | 0 | 10 | ∞ |
| Mensagens chat/dia | 3 | 10 | 30 | 100 |
| Pacientes | 0 | 0 | 0 | 50 |
| Histórico (dias) | 7 | 30 | 90 | 9999 |

---

# 6. FLUXOS COMPLETOS POR PERFIL DE USUÁRIO

## 6.1 Fluxo do Administrador (Admin)

Ações Permitidas:
- Gerenciar usuários (CRUD em profiles, alterar roles)
- Gerenciar planos comerciais (CRUD na tabela plans)
- Gerenciar alimentos (CRUD, importação em massa, auditoria IA)
- Configurações do sistema (CRUD em system_settings)
- Visualizar audit logs

## 6.2 Fluxo do Profissional

Ações Permitidas:
- Criar e vincular alunos
- Gerar e editar planos para alunos
- Liberar planos para visualização
- Configurar alertas de adesão
- Visualizar métricas de adesão
- Aprovar sugestões de IA
- Responder solicitações de alunos

Ações Bloqueadas:
- Criar plano próprio
- Acessar alunos de outros profissionais

## 6.3 Fluxo do Aluno

Ações Permitidas (Gratuito):
- Visualizar plano liberado
- Confirmar refeições consumidas
- Registrar peso
- Enviar solicitações ao profissional
- Usar chat educacional (3 msgs/dia)

Ações Bloqueadas:
- Criar ou editar plano alimentar
- Substituir alimentos
- Ajustar macros

---

# 7. REGRAS DE NEGÓCIO DETALHADAS

## 7.1 Hierarquia de Planos Alimentares

diet_plans (plano)
  └── meals (refeições)
        └── meal_options (opções de refeição)
              └── meal_option_foods (alimentos da opção)
                    └── foods (cadastro de alimentos)

## 7.2 Equivalência Nutricional Entre Opções

| Nutriente | Margem de Tolerância |
|-----------|---------------------|
| Proteína | ±5g |
| Carboidratos | ±10g |
| Gordura | ±3g |
| Calorias | ±10% |

## 7.3 Estados de Refeição (meal_logs.status)

| Estado | Descrição | Conta para Adesão |
|--------|-----------|-------------------|
| PENDENTE | Não registrada | Não |
| CONFIRMADA | Comeu uma das opções | Sim (+) |
| PULADA | Não comeu nada | Sim (-) |
| FORA_DO_PLANO | Comeu algo diferente | Sim (-) |
| CONFIRMADA_TARDIA | Confirmação retroativa | Sim (+) |

## 7.4 Cálculo de Adesão

overall_adherence_rate = (meals_confirmed + meals_late_confirmed) / total_meals_expected * 100

---

# 8. GESTÃO DE ALIMENTOS

## 8.1 Estrutura do Cadastro

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador único |
| name | TEXT | Nome do alimento |
| calories | INTEGER | Calorias por porção |
| protein | NUMERIC | Proteína em gramas |
| carbs | NUMERIC | Carboidratos em gramas |
| fat | NUMERIC | Gordura em gramas |
| serving_size | TEXT | Descrição da porção |
| category | TEXT | Categoria do alimento |
| processing_level | TEXT | Nível de processamento |

## 8.2 Categorias

frutas, hortaliças_folhosas, legumes, cereais_tubérculos, leguminosas, proteínas_animais, laticínios, óleos_oleaginosas, suplementos

## 8.3 Níveis de Processamento

- in_natura: Alimento natural (preferencial)
- minimamente_processado: Pouco processado (permitido)
- processado: Industrializado (com restrição)
- ultraprocessado: Altamente processado (evitado)
- suplemento: Suplementação (uso específico)

---

# 9. FLUXOS TÉCNICOS DO SISTEMA

## 9.1 Fluxo de Cadastro

1. Usuário acessa /signup
2. Preenche email e senha
3. Supabase Auth cria usuário
4. Trigger handle_new_user cria registro em profiles
5. Trigger create_subscription_for_user cria assinatura gratuita
6. Redirect para /onboarding
7. Usuário preenche dados pessoais
8. Sistema calcula targets via Mifflin-St Jeor
9. Edge Function generate-meal-plan gera plano inicial
10. Redirect para /dashboard

## 9.2 Fluxo de Checkout

1. Usuário seleciona plano em /pricing
2. Frontend chama create-checkout
3. Stripe cria checkout session
4. Usuário paga no Stripe
5. Webhook checkout.session.completed recebido
6. stripe-webhook ativa assinatura
7. Redirect para /dashboard?checkout=success

---

# 10. FUNCIONAMENTO DA IA

## 10.1 Modelos Utilizados

- google/gemini-3-flash-preview: Geração de planos, chat
- google/gemini-2.5-flash: Sugestões, explicações
- google/gemini-2.5-flash-lite: Sumarização

## 10.2 Governança por Perfil

| Perfil | Verbos Permitidos | Limite Frases |
|--------|-------------------|---------------|
| Aluno Gratuito | EXPLICAR, ORIENTAR | 2-4 |
| Aluno Premium | EXPLICAR, ANALISAR, SIMULAR | 4-6 |
| Usuário Pessoal | EXPLICAR, ANALISAR, SIMULAR, PROPOR, EXECUTAR | 5-8 |
| Profissional | EXPLICAR, ANALISAR, SIMULAR, PROPOR | 6-10 |

## 10.3 Guardrails de Segurança

- Nunca persistir dados diretamente
- Nunca ignorar vínculo profissional
- Sempre verificar permissões
- Bloquear em caso de dúvida

---

# 11. ESTRUTURA DO BANCO DE DADOS

## 11.1 Tabelas Principais (27+)

profiles, diet_plans, meals, meal_options, meal_option_foods, foods, daily_logs, meal_logs, subscriptions, plans, user_roles, user_usage, professional_students, professional_licenses, student_requests, weight_logs, chat_messages, adherence_metrics, adherence_alerts, adherence_alert_configs, adherence_report_files, ai_suggestions, plan_history, plan_versions, food_imports, admin_audit_log, system_settings, webhook_events

## 11.2 Funções RPC Principais

- get_user_permissions: Retorna todas as permissões do usuário
- get_user_plan: Retorna informações do plano e limites
- can_use_feature: Verifica se pode usar feature
- calculate_adherence_metrics: Calcula métricas de adesão
- confirm_meal_consumption: Confirma consumo de refeição

---

# 12. INTEGRAÇÕES EXTERNAS

## 12.1 Stripe

Eventos processados:
- checkout.session.completed: Ativar assinatura
- customer.subscription.updated: Atualizar status
- customer.subscription.deleted: Cancelar
- invoice.payment_failed: Grace period

## 12.2 Lovable AI Gateway

Endpoint: https://ai.gateway.lovable.dev/v1/chat/completions
API Key: LOVABLE_API_KEY (auto-provisionada)

---

# APÊNDICES

## D. Fórmula de Mifflin-St Jeor

Homens: TMB = 10 × peso(kg) + 6.25 × altura(cm) - 5 × idade + 5
Mulheres: TMB = 10 × peso(kg) + 6.25 × altura(cm) - 5 × idade - 161
TDEE = TMB × Multiplicador de Atividade

## E. Ajuste Calórico por Objetivo

| Objetivo | Ajuste |
|----------|--------|
| Perder peso | -500 kcal |
| Manter peso | 0 kcal |
| Ganhar massa | +300 kcal |

## F. Glossário Técnico

- RLS: Row Level Security
- Edge Function: Função serverless
- TMB: Taxa Metabólica Basal
- TDEE: Total Daily Energy Expenditure
- Macros: Macronutrientes
- Grace Period: Período de carência

---

Documento consolidado em 18 de Janeiro de 2026
Versão 2.0 - NutriaPlan
`;

const COMMERCIAL_DOC = `# DOCUMENTAÇÃO COMERCIAL E INSTITUCIONAL — NUTRIAPLAN

## Versão do Documento: 2.0
## Data de Geração: 18 de Janeiro de 2026
## Última Atualização: 18 de Janeiro de 2026

---

# 1. APRESENTAÇÃO DA FERRAMENTA

## 1.1 O Que é o NutriaPlan?

O NutriaPlan é uma plataforma inteligente de nutrição que revoluciona a forma como planos alimentares são criados, acompanhados e otimizados. Combinando Inteligência Artificial avançada com governança clínica, o NutriaPlan oferece:

- Para pessoas físicas: Autonomia para criar e gerenciar seus próprios planos alimentares com suporte de IA, ou acompanhar planos prescritos por profissionais.
- Para profissionais de nutrição: Uma ferramenta completa para atender mais pacientes com qualidade, automatizando tarefas repetitivas.

## 1.2 Missão

Democratizar o acesso à nutrição de qualidade através de tecnologia.

## 1.3 Visão

Ser a plataforma líder em nutrição inteligente na América Latina.

---

# 2. PROBLEMA QUE O PRODUTO RESOLVE

## 2.1 Para Pessoas Físicas

- 78% das pessoas abandonam dietas em menos de 3 meses
- Falta de variedade e flexibilidade nos planos
- Alto custo de acompanhamento profissional

## 2.2 Para Profissionais

- Tempo gasto em tarefas administrativas
- Falta de visibilidade da adesão dos pacientes
- Dificuldade em escalar o atendimento

---

# 3. PROPOSTA DE VALOR

## Para Pessoas Físicas

"Sua alimentação personalizada, com IA que entende você."

- Planos personalizados baseados em objetivo, preferências e restrições
- Múltiplas opções por refeição, todas nutricionalmente equivalentes
- Suporte de IA 24/7

## Para Profissionais

"Atenda mais pacientes, com mais qualidade e menos esforço."

- IA cria propostas de planos para revisão
- Visibilidade total sobre adesão dos pacientes
- Alertas proativos de baixa adesão

---

# 4. TIPOS DE USUÁRIO

## 4.1 Aluno Gratuito

Para: Pessoa vinculada a um nutricionista
- Visualizar plano ✓
- Confirmar refeições ✓
- Chat educacional básico (3 msgs/dia) ✓
- Histórico: 7 dias
Custo: Gratuito

## 4.2 Aluno Premium

Para: Alunos que querem mais recursos
- Tudo do Gratuito ✓
- Chat IA ampliado (10 msgs/dia) ✓
- Simulações nutricionais ✓
- Histórico: 30 dias
Custo: R$ 4,90/mês

## 4.3 Usuário Pessoal (Plano Pessoal Pago)

Para: Pessoas com autonomia total
- Criar planos personalizados (5/mês) ✓
- Editar e ajustar planos ✓
- Substituição de alimentos (20/mês) ✓
- Chat IA completo (30 msgs/dia) ✓
- Histórico: 90 dias
Custo: R$ 14,90/mês

## 4.4 Profissional

Para: Nutricionistas e profissionais de saúde
- Gerenciar alunos (até 50) ✓
- Criação ilimitada de planos ✓
- IA como assistente clínico ✓
- Alertas de adesão configuráveis ✓
- Relatórios PDF de adesão ✓
- Histórico: Ilimitado
Custo: R$ 99,00/mês

---

# 5. COMO A PLATAFORMA FUNCIONA

## 5.1 Para Usuários Autônomos

1. Cadastro: Crie conta com email e senha
2. Onboarding: Informe dados, objetivo, nível de atividade
3. Plano gerado: IA cria plano com múltiplas opções por refeição
4. Registro diário: Confirme o que realmente comeu
5. Ajustes contínuos: Receba sugestões baseadas em adesão

## 5.2 Para Profissionais

1. Crie o perfil do aluno
2. IA sugere plano baseado nos objetivos
3. Revise e ajuste conforme sua expertise
4. Libere o plano para o aluno
5. Acompanhe adesão no dashboard
6. Receba alertas proativos

---

# 6. DIFERENCIAIS COMPETITIVOS

## 6.1 IA com Governança Clínica

A IA NUNCA altera planos sem autorização adequada.

| Tipo de Usuário | O que a IA Pode Fazer |
|-----------------|------------------------|
| Aluno Gratuito | Apenas educação nutricional básica |
| Aluno Premium | Explicar plano, simular cenários |
| Usuário Autônomo | Criar e ajustar planos com confirmação |
| Profissional | Receber propostas técnicas para aprovação |

## 6.2 Equivalência Nutricional Real

Cada refeição oferece múltiplas opções que são nutricionalmente equivalentes:
- Mesma faixa de calorias (±10%)
- Mesmo range de proteína (±5g)
- Mesmo range de carboidratos (±10g)
- Mesmo range de gordura (±3g)

## 6.3 Confirmação vs Escolha

O NutriaPlan não pergunta "o que você vai comer", mas sim "o que você comeu".
- Dados reais de adesão, não intenções
- Base para decisões baseadas em evidências

---

# 7. PLANOS E PREÇOS

| Recurso | Gratuito | Premium | Pessoal | Profissional |
|---------|----------|---------|---------|--------------|
| Preço/mês | R$ 0 | R$ 4,90 | R$ 14,90 | R$ 99,00 |
| Visualizar plano | ✓ | ✓ | ✓ | ✓ |
| Confirmar refeições | ✓ | ✓ | ✓ | ✓ |
| Criar planos | - | - | 5/mês | Ilimitado |
| Substituições | - | - | 20/mês | Ilimitado |
| Chat IA/dia | 3 | 10 | 30 | 100 |
| Histórico | 7 dias | 30 dias | 90 dias | Ilimitado |
| Gerenciar alunos | - | - | - | Até 50 |

---

# 8. MODELO DE MONETIZAÇÃO

## 8.1 Assinaturas Recorrentes (Principal)

| Plano | Preço | Target |
|-------|-------|--------|
| Premium | R$ 4,90/mês | Alunos vinculados |
| Pessoal | R$ 14,90/mês | Usuários autônomos |
| Profissional | R$ 99,00/mês | Nutricionistas |

## 8.2 Efeito Multiplicador

Profissional (R$ 99) → Cria 30 Alunos → 20% upgrade = R$ 99 + (6 × R$ 4,90) = R$ 128,40/mês

---

# 9. FUNCIONAMENTO DA IA

## 9.1 O Que a IA Faz?

Para Criação de Planos:
- Calcula necessidades calóricas (fórmula científica Mifflin-St Jeor)
- Seleciona alimentos adequados ao objetivo
- Respeita preferências e restrições
- Cria opções equivalentes para flexibilidade

Para Assistência Conversacional:
- Responde dúvidas sobre nutrição
- Explica a função de cada alimento
- Sugere substituições quando solicitado

## 9.2 O Que a IA NÃO Faz?

- Alterar plano sem confirmação: NUNCA
- Dar diagnósticos médicos: NUNCA
- Prescrever suplementos: NUNCA
- Substituir consulta médica: NUNCA

---

# 10. SEGURANÇA E CONFIABILIDADE

## 10.1 Proteção de Dados

- Conformidade com LGPD
- Criptografia em trânsito e em repouso
- Backup automático diário

## 10.2 Pagamentos

- Processados via Stripe (líder global)
- PCI-DSS compliant
- Dados de cartão nunca tocam nossos servidores

---

# 11. CASOS DE USO

## Maria, 35 anos - Emagrecimento

Situação: Já tentou várias dietas sem sucesso
Solução: Plano personalizado com opções flexíveis
Resultado: Perdeu 5kg em 2 meses com 78% de adesão

## Dra. Ana - Nutricionista

Situação: Atende 20 pacientes e não consegue acompanhar todos
Solução: Plano Profissional com alertas de adesão
Resultado: Aumentou para 35 pacientes com melhor acompanhamento

---

# 12. VISÃO DE FUTURO

## 12.1 Roadmap

Curto Prazo (1-3 meses):
- App mobile nativo
- Notificações push

Médio Prazo (3-6 meses):
- Integração com wearables
- Multi-idioma

Longo Prazo (6-12 meses):
- IA preditiva
- Marketplace de planos
- White-label para clínicas

## 12.2 Visão de Longo Prazo

Ser o ecossistema completo de nutrição digital, conectando pessoas, profissionais, clínicas e empresas.

---

Documento consolidado em 18 de Janeiro de 2026
Versão 2.0 - NutriaPlan
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
      .maybeSingle();

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
    let title: string;

    if (docType === 'technical') {
      content = TECHNICAL_DOC;
      filename = 'DOCUMENTACAO_TECNICA_NUTRIAPLAN.txt';
      title = 'DOCUMENTAÇÃO TÉCNICA - NUTRIAPLAN';
    } else if (docType === 'commercial') {
      content = COMMERCIAL_DOC;
      filename = 'DOCUMENTACAO_COMERCIAL_NUTRIAPLAN.txt';
      title = 'DOCUMENTAÇÃO COMERCIAL - NUTRIAPLAN';
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid docType. Use "technical" or "commercial"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add generation timestamp header
    const header = `================================================================================
${title}
Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
================================================================================

`;

    const finalContent = header + content;

    console.log(`[generate-documentation-pdf] Generated ${docType} TXT for admin ${user.email}`);

    return new Response(finalContent, {
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
