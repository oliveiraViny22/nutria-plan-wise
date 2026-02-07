# Auditoria do Rebalanceador v2.1 - Análise Completa

**Data**: 2026-02-07
**Versão**: v2.2 (pós-auditoria)

## 📊 Resumo Executivo

Auditoria detalhada identificou **8 bugs/lacunas** no motor de rebalanceamento (`ai-rebalance`). As correções focam em garantir convergência efetiva de todas as 3 opções alimentares para as metas nutricionais.

---

## 🐛 Bugs e Lacunas Identificados

### Bug #1: EPSILON não aplicado em `validatePlan()`
**Arquivo**: `ai-rebalance/index.ts` (linhas 531-570)
**Problema**: A função `validatePlan()` usada no loop de correção não aplica tolerância EPSILON para carboidratos, causando falsos negativos em valores de fronteira.

**Impacto**: Plano com 89.95% de carbs é rejeitado mesmo sendo funcionalmente 90%.

**Solução**: Adicionar `CARB_EPSILON = 0.05` à validação de carboidratos em `validatePlan()`.

```typescript
// Antes
if (rules.carbs && percents.carbs < rules.carbs.min) {

// Depois
const CARB_EPSILON = 0.05;
if (rules.carbs && percents.carbs < rules.carbs.min - CARB_EPSILON) {
```

---

### Bug #2: Calorias mínimas muito rígidas para Cut
**Arquivo**: `ai-rebalance/index.ts` (linhas 362-367)
**Problema**: Para perfil "Cut", o range de calorias é `[100 - tolerance, 100]`, mas não há piso mínimo. Planos com 88% de calorias são aceitos implicitamente.

**Impacto**: Planos de Cut podem ter calorias muito baixas, comprometendo saúde.

**Solução**: Definir piso explícito de 90% para Cut.

```typescript
case "cut":
  rules = {
    calories: { min: 90, max: 100 }, // Piso de 90% para segurança
    protein: { min: settings.protein_floor },
    fat: { max: settings.fat_ceiling },
  };
```

---

### Bug #3: Etapa 3 (Carbs) não itera efetivamente
**Arquivo**: `ai-rebalance/index.ts` (linhas 954-983)
**Problema**: O loop da Etapa 3 usa `carbsNeeded` como condição de saída (`if (carbsNeeded <= 0) break`), mas `carbsNeeded` não é atualizado dentro do loop.

**Impacto**: Apenas o primeiro alimento de carbs é ajustado, mesmo que não seja suficiente.

**Solução**: Atualizar `carbsNeeded` após cada ajuste.

```typescript
for (const food of carbFoods) {
  if (carbsNeeded <= 0) break;
  // ... ajuste ...
  const carbsAdded = (actualGramsAdded / 100) * contrib.carbs;
  carbsNeeded -= carbsAdded; // ← FALTANDO
  console.log(`Etapa 3: +${Math.round(actualGramsAdded)}g ${food.food.name} (+${carbsAdded.toFixed(1)}g carbs)`);
}
```

---

### Bug #4: Proteína mínima não respeita contrato do gerador
**Arquivo**: `ai-rebalance/index.ts` (linhas 362-387)
**Problema**: Para Cut, o rebalanceador usa `settings.protein_floor` (padrão 95%), mas para Maintain usa `protein_floor - 10` (85%).

**Impacto**: Inconsistência com o gerador que usa 95% para TODOS os perfis.

**Solução**: Alinhar com `GENERATOR_CONTRACT.MIN_PROTEIN_PERCENT` (95%) para todos.

---

### Bug #5: `getScaleLimits` não usado na Etapa 4.5
**Arquivo**: `ai-rebalance/index.ts` (linha 1141)
**Problema**: A Etapa 4.5 (Normalização) usa `getCategoryLimits()` em vez de `getScaleLimits()`.

**Impacto**: Limites de porção mais restritivos durante normalização podem impedir convergência.

**Solução**: Usar `getScaleLimits()` para consistência.

---

### Bug #6: Falta injeção agressiva de carbs como no gerador
**Arquivo**: `ai-rebalance/index.ts`
**Problema**: O gerador (v5) possui lógica de "Stall Detection + Injeção Agressiva" para perfis Bulk de alta caloria, mas o rebalanceador não possui mecanismo equivalente.

**Impacto**: Opções 2 e 3 podem ficar presas em mínimo local sem atingir metas de carbs.

**Solução**: Adicionar lógica de injeção agressiva quando detectado stall em perfil Bulk.

---

### Bug #7: Etapa 4.6 (Carb-First) ignora resultado
**Arquivo**: `ai-rebalance/index.ts` (linhas 1268-1300)
**Problema**: A Etapa 4.6 ajusta carboidratos mas o resultado não é salvo em `quantities`. Variável `remainingCarbs` é calculada mas não usada para atualizar o mapa.

**Impacto**: Ajustes de carbs da Etapa 4.6 são perdidos.

**Solução**: Verificar se `quantities.set()` está sendo chamado corretamente.

---

### Bug #8: Refinamento não considera objetivo
**Arquivo**: `ai-rebalance/index.ts` (linhas 580-740)
**Problema**: O `runFinalRefinement()` usa pesos fixos (protein=3x) sem considerar o objetivo. Para Bulk, carboidratos deveriam ter peso maior.

**Solução**: Ajustar pesos dinamicamente baseado no objetivo.

```typescript
const WEIGHTS = objective === "bulk" 
  ? { calories: 1.0, protein: 2.0, carbs: 2.5, fat: 0.5 }  // Bulk prioriza carbs
  : objective === "cut"
  ? { calories: 1.5, protein: 3.0, carbs: 1.0, fat: 0.5 }  // Cut prioriza proteína
  : { calories: 1.0, protein: 3.0, carbs: 1.0, fat: 1.0 }; // Maintain
```

---

## 📈 Recomendações de Implementação

### Prioridade Alta (Impacto Imediato)
1. ✅ Bug #3 - Etapa 3 não itera efetivamente
2. ✅ Bug #1 - EPSILON em validatePlan()
3. ✅ Bug #7 - Etapa 4.6 ignora resultado

### Prioridade Média
4. Bug #6 - Injeção agressiva de carbs
5. Bug #8 - Pesos dinâmicos no refinamento

### Prioridade Baixa
6. Bug #2 - Piso de Cut (segurança nutricional)
7. Bug #4 - Proteína mínima por perfil
8. Bug #5 - getScaleLimits na Etapa 4.5

---

## 🔄 Pipeline de Correção (Atualizado)

```
┌─────────────────────────────────────────────────────────────┐
│ ETAPA 1: CALORIAS                                           │
│ → Ajusta calorias usando getScaleLimits()                   │
│ → Prioridade: Gorduras → Carboidratos (NUNCA proteínas)     │
├─────────────────────────────────────────────────────────────┤
│ ETAPA 2: PROTEÍNA                                           │
│ → Aumenta proteína se < {min}% (95% para todos)             │
│ → Usa getScaleLimits() para porções maiores                 │
├─────────────────────────────────────────────────────────────┤
│ ETAPA 3: CARBOIDRATOS (TODOS os perfis) [CORRIGIDO]         │
│ → Cut/Maintain: 90% | Bulk: 80%                             │
│ → Itera sobre TODOS os carbFoods até atingir meta           │
│ → Atualiza carbsNeeded a cada iteração                      │
├─────────────────────────────────────────────────────────────┤
│ ETAPA 4: GORDURA                                            │
│ → Reduz gorduras puras se > máximo                          │
├─────────────────────────────────────────────────────────────┤
│ ETAPA 4.5: NORMALIZAÇÃO                                     │
│ → Corrige excesso de gordura implícita                      │
│ → Usa getScaleLimits() [CORRIGIDO]                          │
├─────────────────────────────────────────────────────────────┤
│ ETAPA 4.6: CARB-FIRST (BULK) [CORRIGIDO]                    │
│ → Prioriza carbs antes de gordura                           │
│ → Salva resultado em quantities                             │
├─────────────────────────────────────────────────────────────┤
│ ETAPA 5: FINALIZAÇÃO GORDURA                                │
│ → Adiciona gordura APENAS se macros OK e calorias baixas    │
├─────────────────────────────────────────────────────────────┤
│ REFINAMENTO FINAL [CORRIGIDO]                               │
│ → Pesos dinâmicos por objetivo                              │
│ → Max 200 iterações                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Validação Final (Critérios)

| Perfil | Calorias | Proteína | Carboidratos | Gordura |
|--------|----------|----------|--------------|---------|
| **Cut** | 90-100% | ≥95% | ≥90%* | ≤100% |
| **Maintain** | 95-105% | ≥95% | ≥90%* | ≤125% |
| **Bulk** | 95-105% | ≥90% | ≥80%* | ≤110% |

*Com EPSILON de 0.05% aplicado

---

*Auditoria realizada por Lovable AI - 2026-02-07*
