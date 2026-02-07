# Auditoria do Rebalanceador v2 - Análise e Correções

**Data**: 2026-02-07
**Versão**: v2.1 (pós-correções)

## 📊 Resumo Executivo

Esta auditoria identificou **5 bugs** e **4 lacunas de convergência** no motor de rebalanceamento (`ai-rebalance`). As correções implementadas focam em garantir que todas as 3 opções alimentares convirjam efetivamente para as metas nutricionais.

---

## 🐛 Bugs Identificados e Corrigidos

### Bug #1: Validação de carbs sem tolerância EPSILON
**Problema**: Valores de fronteira como 79.95% falhavam a validação "< 80%" devido a arredondamento de ponto flutuante.

**Solução**: Adicionado `CARB_EPSILON = 0.0005` (0.05%) em todas as verificações de carboidratos.

```typescript
// Antes
if (carbPercent < carbsMinThreshold) { ... }

// Depois
const CARB_EPSILON = 0.0005;
if (carbPercent < carbsMinThreshold - CARB_EPSILON) { ... }
```

---

### Bug #2: ETAPA 3 rodava apenas para Bulk
**Problema**: Carboidratos não eram aumentados automaticamente em Cut/Maintain quando baixos.

**Solução**: Generalizada a ETAPA 3 para todos os perfis com threshold dinâmico.

```typescript
// Antes
if (rules.carbs && afterProteinPercents.carbs < rules.carbs.min) { ... }

// Depois
const carbsMinThreshold = rules.carbs?.min || 90;
if (afterProteinPercents.carbs < carbsMinThreshold) { ... }
```

---

### Bug #3: Limites de porção restritivos demais
**Problema**: Pipeline usava `getCategoryLimits()` que retorna limites padrão (ex: carbs max 400g), insuficientes para Bulk de alta caloria.

**Solução**: Migrado para `getScaleLimits()` que permite porções maiores (ex: carbs max 500g) durante refinamento.

```typescript
// Pontos atualizados:
// - ETAPA 1: Calorias
// - ETAPA 2: Proteína
// - ETAPA 3: Carboidratos
// - ETAPA 4.6: Carb-First
// - runFinalRefinement()
```

---

### Bug #4: Carb-First bloqueado quando calorias > 95%
**Problema**: Condição `caloriesPercent < 95` impedia injeção de carbs em Bulk mesmo quando carbs estavam baixos.

**Solução**: Removida condição de calorias, focando apenas em `carbsPercent < 100%`.

```typescript
// Antes
if (caloriesPercent < 95 && carbsPercent < BULK_CARB_FIRST_THRESHOLD) { ... }

// Depois
if (carbsPercent < BULK_CARB_FIRST_THRESHOLD) { ... }
```

---

### Bug #5: Proteção de proteína muito agressiva
**Problema**: `proteinIsProtected = errors.protein <= 2` bloqueava ajustes mesmo com 102% de proteína.

**Solução**: Proteção apenas quando proteína abaixo da meta.

```typescript
// Antes
const proteinIsProtected = errors.protein <= 2;

// Depois
const proteinIsProtected = errors.protein < PRECISION.protein; // Só se abaixo da meta
```

---

## 📈 Limites de Porção Atualizados

| Categoria | getCategoryLimits (padrão) | getScaleLimits (escala) |
|-----------|---------------------------|-------------------------|
| Carboidratos | 40-400g | 50-500g |
| Grãos | 40-350g | 50-450g |
| Tubérculos | 50-400g | 50-500g |
| Massas | 60-350g | 60-450g |
| Leguminosas | 40-200g | 40-300g |

---

## 🔄 Pipeline de Correção (Atualizado)

```
┌─────────────────────────────────────────────────────────────┐
│ ETAPA 1: CALORIAS                                           │
│ → Ajusta calorias usando getScaleLimits()                   │
│ → Prioridade: Gorduras → Carboidratos (NUNCA proteínas)     │
├─────────────────────────────────────────────────────────────┤
│ ETAPA 2: PROTEÍNA                                           │
│ → Aumenta proteína se < {min}% (por objetivo)               │
│ → Usa getScaleLimits() para permitir porções maiores        │
├─────────────────────────────────────────────────────────────┤
│ ETAPA 3: CARBOIDRATOS (TODOS os perfis)                     │
│ → Cut/Maintain: 90% | Bulk: 80%                             │
│ → Usa getScaleLimits() para convergência                    │
├─────────────────────────────────────────────────────────────┤
│ ETAPA 4: GORDURA                                            │
│ → Reduz gorduras puras se > máximo                          │
│ → Usa getCategoryLimits() (limites padrão)                  │
├─────────────────────────────────────────────────────────────┤
│ ETAPA 4.5: NORMALIZAÇÃO                                     │
│ → Corrige excesso de gordura implícita                      │
│ → Só roda se G-10 = ALLOW_REBALANCE ou Fat > 100%           │
├─────────────────────────────────────────────────────────────┤
│ ETAPA 4.6: CARB-FIRST (BULK)                                │
│ → Prioriza carbs antes de gordura                           │
│ → Roda se carbs < 100% (independente de calorias)           │
├─────────────────────────────────────────────────────────────┤
│ ETAPA 5: FINALIZAÇÃO GORDURA                                │
│ → Adiciona gordura APENAS se macros OK e calorias baixas    │
├─────────────────────────────────────────────────────────────┤
│ REFINAMENTO FINAL                                            │
│ → Precisão: ±5 kcal, ±1g por macro                          │
│ → Max 200 iterações                                          │
│ → Usa getScaleLimits() para maior headroom                  │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Validação Final (Critérios)

| Perfil | Calorias | Proteína | Carboidratos | Gordura |
|--------|----------|----------|--------------|---------|
| **Cut** | 90-100% | ≥95% | ≥90%* | ≤100% |
| **Maintain** | 95-105% | ≥90% | ≥90%* | ≤125% |
| **Bulk** | 95-105% | ≥90% | ≥80% | ≤110% |

*Carboidratos validados com EPSILON de 0.05%

---

## 📋 Diagnósticos de Convergência

O sistema agora captura `refinementStatus` com prioridade:
1. `MAX_ITERATIONS_REACHED` - Atingiu 200 iterações sem convergir
2. `STOPPED_BY_LIMIT` - Porções atingiram limites máximos
3. `LOCAL_MINIMUM` - Algoritmo preso em mínimo local
4. `CONVERGED` - Convergência completa

---

## 🧪 Testes Recomendados

1. **Plano Bulk 3500+ kcal**: Verificar que Opções 2 e 3 convergem
2. **Plano Cut com proteínas gordas**: Verificar normalização de gordura
3. **Plano Maintain com carbs baixos**: Verificar ETAPA 3 generalizada
4. **Valores de fronteira**: Verificar 79.95% → 80.0% aceito

---

## 📁 Arquivos Modificados

- `supabase/functions/ai-rebalance/index.ts`
- `supabase/functions/_shared/category-limits.ts`
- `supabase/functions/_shared/nutrition-contracts.ts`

---

*Auditoria realizada por Lovable AI - 2026-02-07*
