# Plano de Adesão e Alteração de Objetivos - NutriaPlan

## Sumário
1. [Processo de Adesão ao Plano](#1-processo-de-adesão-ao-plano)
2. [Histórico e Sistema de Adesão](#2-histórico-e-sistema-de-adesão)
3. [Regras para Alteração de Objetivos](#3-regras-para-alteração-de-objetivos)

---

## 1. Processo de Adesão ao Plano

### 1.1 Etapas do Onboarding

O processo de adesão ao NutriaPlan segue um **Wizard guiado** com as seguintes etapas:

| Etapa | Descrição | Campos Coletados |
|-------|-----------|------------------|
| **1. Dados Básicos** | Coleta de informações pessoais | Nome, Email, Senha |
| **2. Dados Antropométricos** | Medidas físicas para cálculo metabólico | Idade, Sexo, Altura, Peso |
| **3. Nível de Atividade** | Frequência e intensidade de exercícios | Sedentário, Leve, Moderado, Intenso, Muito Intenso |
| **4. Objetivo Nutricional** | Meta principal de saúde | Emagrecer, Manter, Ganhar Massa |
| **5. Preferências Alimentares** | Restrições e preferências | Alimentos evitados, Preferências, Restrições |

### 1.2 Requisitos Técnicos

- **Autenticação**: Email verificado obrigatório (não há auto-confirmação)
- **Perfil Completo**: Todos os campos antropométricos são necessários para cálculo de metas
- **Plano Gratuito**: Usuários começam com limite de 1 dieta, 3 substituições, 1 ajuste

### 1.3 Cálculo Automático de Metas

Após o onboarding, o sistema calcula automaticamente:

```
TMB (Taxa Metabólica Basal):
- Homem: 10 × peso + 6.25 × altura - 5 × idade + 5
- Mulher: 10 × peso + 6.25 × altura - 5 × idade - 161

TDEE = TMB × Multiplicador de Atividade

Meta Calórica = TDEE + Ajuste por Objetivo
- Emagrecer: -500 kcal
- Manter: ±0 kcal  
- Ganhar Massa: +300 kcal
```

### 1.4 Prazos e Limites

| Recurso | Plano Gratuito | Plano Pessoal | Profissional |
|---------|----------------|---------------|--------------|
| Dietas/mês | 1 | Ilimitado | Ilimitado |
| Substituições/mês | 3 | Ilimitado | Ilimitado |
| Ajustes/mês | 1 | Ilimitado | Ilimitado |
| Mensagens IA/dia | 3 | 20 | 50 |
| Opções por Refeição | 1 | 3 | 3 |

---

## 2. Histórico e Sistema de Adesão

### 2.1 Conceito de Adesão (Adherence)

O sistema de adesão rastreia a consistência do usuário em seguir o plano alimentar:

**Critério de Dia Aderente:**
> Um dia é considerado **aderente** quando ≥70% das refeições planejadas são confirmadas.

### 2.2 Cálculo do Streak (Sequência)

```typescript
// Lógica do AdherenceStreak.tsx
const adherenceThreshold = 0.7; // 70%

// Para cada dia, verifica:
const isAdherent = confirmedMeals / totalMeals >= adherenceThreshold;
```

**Regras de Streak:**
- Dias consecutivos de adesão formam uma **sequência (streak)**
- Se o usuário não registrar hoje, a contagem começa de ontem
- O histórico considera os últimos **90 dias** para análise

### 2.3 Marcos de Gamificação

| Marco | Dias | Ícone | Descrição |
|-------|------|-------|-----------|
| **Iniciante** | 3 | ⭐ | Primeiro passo na consistência |
| **Constante** | 7 | 🔥 | Uma semana de dedicação |
| **Dedicado** | 14 | ✨ | Duas semanas de compromisso |
| **Campeão** | 30 | 🏆 | Um mês de excelência |

### 2.4 Lições Aprendidas

| Problema Identificado | Solução Implementada |
|----------------------|---------------------|
| Usuários abandonavam após 3 dias | Sistema de marcos com feedback visual |
| Falta de visibilidade do progresso | Widget de streak no Dashboard |
| Confirmação manual era esquecida | DailyLogCTA com destaque visual |
| Recálculo complexo de métricas | Cálculo em tempo real (sem persistência) |

### 2.5 Métricas de Sucesso

- **Taxa de Confirmação**: % de refeições confirmadas vs. planejadas
- **Streak Atual**: Dias consecutivos de adesão
- **Recorde Pessoal**: Maior sequência histórica
- **Status do Dia**: Ativo (registrou hoje) ou Pendente

---

## 3. Regras para Alteração de Objetivos

### 3.1 Tipos de Objetivos

| Objetivo | Enum | Ajuste Calórico | Distribuição de Macros |
|----------|------|-----------------|------------------------|
| **Emagrecer** | `lose_weight` | -500 kcal | P: 35%, C: 35%, G: 30% |
| **Manter** | `maintain` | ±0 kcal | P: 30%, C: 40%, G: 30% |
| **Ganhar Massa** | `gain_muscle` | +300 kcal | P: 35%, C: 45%, G: 20% |

### 3.2 Regras de Cooldown (Período de Espera)

O sistema implementa um **período de carência progressivo** para evitar alterações frequentes:

```sql
-- Tabela: objective_change_policies
| profile_type | change_number | cooldown_days |
|--------------|---------------|---------------|
| default      | 1             | 7             |
| default      | 2             | 14            |
| default      | 3             | 21            |
| default      | 4+            | 30            |
```

**Lógica:**
- Primeira alteração: 7 dias de espera
- Segunda alteração: 14 dias de espera
- Terceira alteração: 21 dias de espera
- Demais alterações: 30 dias de espera

### 3.3 Fluxo do Wizard de Alteração

```
┌─────────────────┐
│  1. VERIFICAR   │  Checa elegibilidade via RPC
│   ELEGIBILIDADE │  check_objective_change_eligibility()
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. INFORMAÇÕES  │  Explica impactos:
│                 │  - Metas recalculadas
│                 │  - Novo cooldown aplicado
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. SELEÇÃO      │  Escolha do novo objetivo
│                 │  (exclui objetivo atual)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. IMPACTO      │  Preview das novas metas:
│                 │  Calorias, Proteína, Carbs, Gordura
│                 │  + Opção: Gerar novo plano?
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 5. CONFIRMAÇÃO  │  Resumo final + Botão confirmar
│                 │  apply_objective_change()
└─────────────────┘
```

### 3.4 Verificação de Elegibilidade

```typescript
// Hook: useObjectiveChange.ts
interface EligibilityResult {
  can_change: boolean;         // Pode alterar?
  change_count: number;        // Quantas vezes já alterou
  locked_until: string | null; // Data de desbloqueio
  next_cooldown_days: number;  // Próximo período de espera
  reason: string;              // Motivo do bloqueio
}
```

### 3.5 Critérios de Bloqueio

| Condição | Resultado |
|----------|-----------|
| Dentro do período de cooldown | ❌ Bloqueado |
| Cooldown expirado | ✅ Liberado |
| Administrador | ✅ Sempre liberado |
| Aluno vinculado a profissional | ⚠️ Requer solicitação |

### 3.6 Procedimento para Alunos Vinculados

Alunos vinculados a profissionais seguem um fluxo diferenciado:

1. **Solicitação**: Aluno envia pedido via `objective_change_requests`
2. **Justificativa**: Deve informar motivo da alteração
3. **Análise**: Profissional recebe notificação no painel
4. **Decisão**: Aprovação ou rejeição com resposta
5. **Aplicação**: Se aprovado, sistema aplica automaticamente

```sql
-- Tabela: objective_change_requests
| Campo | Descrição |
|-------|-----------|
| student_id | ID do aluno |
| professional_id | ID do profissional |
| current_goal | Objetivo atual |
| requested_goal | Objetivo solicitado |
| justification | Motivo do pedido |
| status | pending, approved, rejected |
| professional_response | Resposta do profissional |
```

### 3.7 Impactos da Alteração

Quando o objetivo é alterado, o sistema automaticamente:

1. ✅ Atualiza o campo `goal` em `profiles`
2. ✅ Recalcula `daily_calories` baseado no TDEE + ajuste
3. ✅ Recalcula `protein_target`, `carbs_target`, `fat_target`
4. ✅ Incrementa `objective_change_count` em `diet_plans`
5. ✅ Define `objective_locked_until` com a data do próximo desbloqueio
6. ⚠️ **NÃO** gera novo plano automaticamente (usuário escolhe)

### 3.8 Regras de Rebalanceamento por Objetivo

O sistema aplica regras nutricionais específicas ao rebalancear planos:

| Objetivo | Regra de Calorias | Regra de Proteína | Regra de Gordura | Regra Especial |
|----------|-------------------|-------------------|------------------|----------------|
| **Emagrecer** | 90-100% da meta | ≥95% | ≤110% | - |
| **Manter** | 95-105% da meta | ≥90% | ≤125% | - |
| **Ganhar Massa** | 95-105% da meta | ≥90% | ≤110% | **Carb-First**: bloqueia gordura até carboidrato atingir meta |

---

## Diagrama de Fluxo Geral

```
ONBOARDING                    ADESÃO DIÁRIA                 ALTERAÇÃO
    │                              │                            │
    ▼                              ▼                            ▼
┌─────────┐                  ┌─────────┐                  ┌─────────┐
│ Signup  │                  │ Refeição│                  │ Wizard  │
│ + Email │                  │ Planejada│                  │ Guiado  │
└────┬────┘                  └────┬────┘                  └────┬────┘
     │                            │                            │
     ▼                            ▼                            ▼
┌─────────┐                  ┌─────────┐                  ┌─────────┐
│ Wizard  │                  │Confirmar│                  │ Check   │
│Onboarding│                 │   70%   │                  │Cooldown │
└────┬────┘                  └────┬────┘                  └────┬────┘
     │                            │                            │
     ▼                            ▼                            ▼
┌─────────┐                  ┌─────────┐                  ┌─────────┐
│ Calcular│                  │ Streak  │                  │ Aplicar │
│  Metas  │                  │   ++    │                  │ Mudança │
└────┬────┘                  └────┬────┘                  └────┬────┘
     │                            │                            │
     ▼                            ▼                            ▼
┌─────────┐                  ┌─────────┐                  ┌─────────┐
│ Gerar   │                  │  Marco  │                  │Recalcular│
│  Plano  │                  │Alcançado│                  │  Metas  │
└─────────┘                  └─────────┘                  └─────────┘
```

---

## Referências Técnicas

### Arquivos Principais

| Funcionalidade | Arquivo |
|----------------|---------|
| Streak de Adesão | `src/components/AdherenceStreak.tsx` |
| Wizard de Alteração | `src/components/ObjectiveChangeWizard.tsx` |
| Políticas de Cooldown | `src/hooks/useObjectiveChangePolicies.ts` |
| Verificação de Elegibilidade | `src/hooks/useObjectiveChange.ts` |
| Confirmação de Refeição | RPC: `confirm_meal_consumption` |
| Aplicar Alteração | RPC: `apply_objective_change` |
| Check Elegibilidade | RPC: `check_objective_change_eligibility` |

### Tabelas do Banco

| Tabela | Função |
|--------|--------|
| `profiles` | Dados do usuário e metas |
| `diet_plans` | Planos alimentares ativos |
| `daily_logs` | Registro de adesão diária |
| `meal_logs` | Confirmação individual de refeições |
| `objective_change_policies` | Regras de cooldown |
| `objective_change_requests` | Solicitações de alunos |

---

*Documento gerado em: 2026-02-03*
*Versão: 2.0*
