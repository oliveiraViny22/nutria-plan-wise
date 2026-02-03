# 🔍 Auditoria: Regras por Perfil Nutricional

**Data**: 2026-02-03  
**Escopo**: Gerador (generate-meal-plan-v5) e Rebalanceador (ai-rebalance)

---

## 📊 Resumo Executivo

| Aspecto | Gerador | Rebalanceador | Consistência |
|---------|---------|---------------|--------------|
| Detecção de Perfil | ❌ Não considera | ✅ Completo | ⚠️ GAP |
| Regras Cut | N/A | ✅ Implementado | - |
| Regras Maintain | N/A | ✅ Implementado | - |
| Regras Bulk | N/A | ✅ Implementado | - |
| Carb-First (Bulk) | ❌ Não implementado | ✅ Etapa 4.6 | ⚠️ GAP |
| Limites Gordura | ✅ Fat Share/G-10 | ✅ Por perfil | ✅ OK |

---

## 🔴 GAP CRÍTICO: Gerador Não Diferencia Perfis

### Situação Atual

O **gerador** (`generate-meal-plan-v5/index.ts`) **NÃO** utiliza o campo `profile.goal` para ajustar a composição do plano:

```typescript
// Linha 193-198 - Apenas carrega metas do perfil, não considera objetivo
const targets: MacroTargets = {
  calories: profile.daily_calories || 2000,
  protein: profile.protein_target || 100,
  carbs: profile.carbs_target || 250,
  fat: profile.fat_target || 65,
};
```

### Impacto

1. **Cut (Emagrecer)**: Plano pode ter excesso de gordura desnecessário
2. **Bulk (Ganhar Massa)**: Carboidratos não são priorizados na geração
3. **Maintain**: Sem otimização específica

### Recomendação

Implementar lógica de perfil no gerador para criar "esqueletos" mais adequados:

```typescript
// PROPOSTA: Adicionar detecção de objetivo
const objective = mapGoalToObjective(profile.goal);
const profileStrategy = getGenerationStrategy(objective);
// Ajustar seleção de alimentos âncora baseado no perfil
```

---

## ✅ Rebalanceador: Implementação por Perfil

### Mapeamento de Objetivo

```typescript
// ai-rebalance/index.ts - Linhas 332-363
function getObjectiveRules(objective: Objective, settings: OptimizerSettings): ObjectiveRules {
  switch (objective) {
    case "cut":
      return {
        calories: { min: 95, max: 100 },     // Déficit
        protein: { min: 95 },                 // Proteção alta
        fat: { max: 120 },                    // Limite normal
      };
    case "bulk":
      return {
        calories: { min: 95, max: 105 },     // Superávit permitido
        protein: { min: 90 },                 // Piso menor
        carbs: { min: 80 },                   // Mínimo de carbs
        fat: { max: 130 },                    // Mais flexível
      };
    case "maintain":
      return {
        calories: { min: 95, max: 105 },
        protein: { min: 90 },
        fat: { max: 125 },                    // Flexibilidade moderada
      };
  }
}
```

---

## 📋 Regras Detalhadas por Perfil

### 🔴 CUT (Emagrecer / lose_weight)

| Macro | Mínimo | Máximo | Justificativa |
|-------|--------|--------|---------------|
| Calorias | 90%¹ | 100% | Déficit controlado |
| Proteína | 95% | - | Preservação muscular |
| Carboidratos | - | - | Sem limite específico |
| Gordura | - | 100%² | Restrição estrita |

**Notas:**
- ¹ Configurável via `calories_tolerance` no Admin
- ² Mais restritivo que outros perfis

**Implementação no Rebalanceador:**
- ✅ Etapa 4: Redução de gordura prioritária
- ✅ Etapa 1: Proteína protegida acima de 95%
- ❌ Etapa 5 (Adição de gordura): Bloqueada se > 100%

---

### 🟢 MAINTAIN (Manter / maintain)

| Macro | Mínimo | Máximo | Justificativa |
|-------|--------|--------|---------------|
| Calorias | 95% | 105% | Equilíbrio |
| Proteína | 90%³ | - | Flexibilidade moderada |
| Carboidratos | - | - | Sem limite |
| Gordura | - | 125% | Maior tolerância |

**Notas:**
- ³ Piso 10pp menor que Cut

**Implementação no Rebalanceador:**
- ✅ Limite de gordura expandido (fat_ceiling + 5%)
- ✅ Proteína com mais margem
- ✅ Etapa 5: Pode adicionar gordura se calorias baixas

---

### 🔵 BULK (Ganhar Massa / gain_muscle)

| Macro | Mínimo | Máximo | Justificativa |
|-------|--------|--------|---------------|
| Calorias | 95% | 105% | Superávit controlado |
| Proteína | 90%⁴ | - | Síntese proteica |
| Carboidratos | 80% | 110% | **Base energética** |
| Gordura | - | 110% | Moderado |

**Notas:**
- ⁴ Piso menor (bulk = mais calorias, não só proteína)

**Implementação no Rebalanceador:**

#### Etapa 4.6: Carb-First Logic (EXCLUSIVO BULK)

```typescript
// ai-rebalance/index.ts - Linhas 1200-1284
const BULK_CARB_FIRST_THRESHOLD = 100; // Carbs devem atingir 100% ANTES de gordura

if (objective === "bulk") {
  if (caloriesPercent < 95 && carbsPercent < BULK_CARB_FIRST_THRESHOLD) {
    // PRIORIZAR CARBOIDRATOS para atingir calorias
    // Gordura SÓ liberada quando carbs >= 100%
  }
}
```

#### Bloqueio de Gordura

```typescript
// Linha 1314
const carbFirstOk = objective !== "bulk" || afterFatPercents.carbs >= BULK_CARB_FIRST_THRESHOLD;

if (proteinOk && carbsOk && caloriesLow && carbFirstOk) {
  // Só então permite adicionar gordura
}
```

---

## 🔄 Pipeline de Etapas por Perfil

### Fluxo Comum (Todas os Perfis)

```
Etapa 1: Otimização de Proteína
    ↓
Etapa 2: Otimização de Carboidratos  
    ↓
Etapa 3: Balanceamento de Alto Nível
    ↓
Etapa 4: Redução de Gordura
    ↓
Etapa 4.5: Normalização Implícita (se G-10 = ALLOW_REBALANCE)
```

### Etapas Específicas por Perfil

| Etapa | Cut | Maintain | Bulk |
|-------|-----|----------|------|
| 4.6 Carb-First | ❌ Skip | ❌ Skip | ✅ Ativa |
| 5 Adição Gordura | ⚠️ Restrito | ✅ Permitido | ⚠️ Só após carbs ≥100% |

---

## 📈 Validação Final por Perfil

### Constantes de Validação (Todos os Perfis)

```typescript
const VALIDATION_CONSTANTS = {
  CALORIES_MAX: 1.05,      // 105%
  PROTEIN_MIN: 0.95,       // 95%
  CARBS_MIN: 0.90,         // 90%
  FAT_MAX_STANDARD: 1.10,  // 110%
  FAT_MAX_TOLERANCE: 1.15, // 115% (tolerância clínica)
  HARD_FAIL_CALORIES: 1.10, // 110%
  HARD_FAIL_FAT: 1.20,      // 120%
};
```

### Status de Validação

| Status | Significado | Ação |
|--------|-------------|------|
| `VALIDATED` | Dentro de todos os limites | ✅ Salvar |
| `VALIDATED_WITH_TOLERANCE` | Gordura 110-115% | ⚠️ Salvar com alerta |
| `STRUCTURALLY_INVALID` | Fora de limites | ❌ Regenerar plano |

---

## 🛠️ Recomendações

### Prioridade Alta

1. **Implementar detecção de perfil no Gerador**
   - Carregar `profile.goal` e mapear para `cut/maintain/bulk`
   - Ajustar seleção de âncoras baseado no perfil
   - Priorizar proteínas magras para Cut
   - Priorizar carboidratos complexos para Bulk

2. **Carb-First no Gerador para Bulk**
   - Garantir que templates de Bulk priorizem carboidratos
   - Distribuição calórica: Carbs > Proteína > Gordura

### Prioridade Média

3. **Logs estruturados no Gerador**
   - Adicionar `logProfileRules` similar ao rebalanceador
   - Facilitar debug de planos por perfil

4. **Testes de integração por perfil**
   - Gerar plano + rebalancear para cada objetivo
   - Validar que regras são consistentes end-to-end

---

## 📊 Matriz de Cobertura de Testes

| Cenário | Gerador | Rebalanceador | Integração |
|---------|---------|---------------|------------|
| Cut: Calorias 90-100% | ❌ | ✅ | ❌ |
| Cut: Proteína ≥95% | ❌ | ✅ | ❌ |
| Cut: Gordura ≤100% | ⚠️ Fat Share | ✅ | ❌ |
| Maintain: Flexibilidade gordura | ❌ | ✅ | ❌ |
| Bulk: Carbs ≥80% | ❌ | ✅ | ❌ |
| Bulk: Carb-First | ❌ | ✅ | ❌ |

**Legenda:**
- ✅ Implementado e testado
- ⚠️ Parcialmente implementado
- ❌ Não implementado/testado

---

## 📁 Arquivos Relacionados

- `supabase/functions/generate-meal-plan-v5/index.ts` - Gerador principal
- `supabase/functions/ai-rebalance/index.ts` - Rebalanceador
- `supabase/functions/ai-rebalance/profile-rules.test.ts` - Testes por perfil
- `supabase/functions/_shared/nutrition-contracts.ts` - Contratos nutricionais
