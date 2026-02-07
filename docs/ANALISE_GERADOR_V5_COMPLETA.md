# Análise Completa do Gerador de Planos v5

**Data**: 2026-02-07
**Versão**: v5.24

## 📊 Resumo Executivo

O gerador de planos alimentares (`generate-plan/index.ts`) está **corretamente implementado** com os três pilares fundamentais:

1. ✅ **Alimentos Âncora** - Filtrados por objetivo e perfil dietético
2. ✅ **Templates de Refeição** - Estruturas definidas com papéis obrigatórios/opcionais
3. ✅ **Seleção Contextual** - Regras de bloqueio por tipo de refeição

---

## 🔗 1. Sistema de Âncoras

### Carregamento (linhas 373-451)
```typescript
async function loadData(sb, userGoal, restrictions) {
  // Filtrar por goal_type (bulk/cut/maintain)
  // Filtrar por dietary_profile (vegan/vegetarian/pescatarian/standard)
  
  const [templates, roles, cats, anchors] = await Promise.all([
    sb.from("meal_templates").select("*").eq("is_active", true),
    sb.from("meal_template_roles").select("*").order("sort_order"),
    sb.from("meal_role_food_categories").select("role_id, category"),
    sb.from("meal_anchor_foods")
      .select("*, food:foods(*)")
      .eq("is_active", true)
      .or(`goal_type.is.null,goal_type.eq.${mappedGoalType}`)
      .or(dietaryProfileFilter)
  ]);
}
```

### Filtros de Âncora
| Filtro | Descrição |
|--------|-----------|
| `goal_type` | NULL = universal, específico = só para aquele objetivo |
| `dietary_profile` | NULL = universal, específico = só para aquele perfil |
| `isFattyAnchor()` | Bloqueia âncoras com >8g gordura/100g para proteínas |
| `isBlockedForMealType()` | Bloqueia alimentos inadequados por contexto |
| `hasSimilarFood()` | Evita duplicação de alimentos similares |

### Status: ✅ FUNCIONANDO CORRETAMENTE

---

## 📋 2. Templates de Refeição

### Estrutura
```
meal_templates          → Definição da refeição (café, almoço, etc.)
  └── meal_template_roles → Papéis nutricionais (proteína, carbs, etc.)
        └── meal_role_food_categories → Categorias permitidas por papel
```

### Aplicação (linhas 455-661)
```typescript
function buildMeal(mt, opt, roles, foods, anchors, ...) {
  // 1. Âncoras primeiro (prioridade)
  for (const [rn, ancs] of anchors.entries()) {
    // Aplicar âncora se disponível
  }
  
  // 2. Papéis obrigatórios (is_required = true)
  for (const r of roles.filter(r => r.is_required)) {
    // Selecionar alimento das categorias permitidas
  }
  
  // 3. Papéis opcionais (para completar contagem de itens)
  for (const r of optRoles) {
    // Preencher até atingir min/max de itens
  }
  
  // 4. Garantia de proteína mínima
  if (currentProtein < minProteinRequired) {
    // Adicionar ou aumentar proteína
  }
}
```

### Status: ✅ FUNCIONANDO CORRETAMENTE

---

## 🚫 3. Regras Contextuais

### Bloqueios por Tipo de Refeição (linhas 70-118)
```typescript
CONTEXTUAL_BLOCK_RULES = {
  BLOCKED_IN_SNACKS: ["sobrecoxa", "pernil", "ostra", "camarão", ...],
  BLOCKED_IN_BREAKFAST: ["seitan", "tempeh", "salmão", "arroz", ...],
  BLOCKED_IN_MORNING_SNACK: ["peixe", "salmão", "arroz", "feijão", ...],
  BLOCKED_IN_AFTERNOON_SNACK: ["ostra", "peixe", "salmão", ...],
  BLOCKED_IN_SUPPER: ["alface", "rúcula", "agrião", ...],
  RECIPE_KEYWORDS: ["mingau", "shake", "pizza", "lasanha", ...]
}
```

### Aplicação
| Refeição | Bloqueios |
|----------|-----------|
| Café da Manhã | Carnes pesadas, peixes, frutos do mar, arroz, feijão |
| Lanche Manhã | Peixes, frutos do mar, arroz, leguminosas |
| Almoço | Nenhum bloqueio específico |
| Lanche Tarde | Peixes, frutos do mar (muito pesados) |
| Jantar | Nenhum bloqueio específico |
| Ceia | Vegetais folhosos (alface, rúcula) sem substância |

### Status: ✅ FUNCIONANDO CORRETAMENTE

---

## 🔧 4. Regras de Bloqueio de Gordura (v5.13)

### Limites (linhas 46-64)
```typescript
FATTY_FOOD_RULES = {
  MAX_FAT_PROTEIN: 8,    // Proteínas com >8g gordura/100g
  MAX_FAT_DAIRY: 8,      // Laticínios com >8g gordura/100g
  MAX_FAT_CARBS: 5,      // Carboidratos com >5g gordura/100g
  MAX_FAT_LEGUMES: 6,    // Leguminosas com >6g gordura/100g
  MAX_FAT_GENERIC: 15,   // Qualquer alimento >15g gordura/100g
  BLOCKED_KEYWORDS: ["oleaginosa", "castanha", "bacon", "queijo amarelo", ...]
}
```

### Status: ✅ FUNCIONANDO CORRETAMENTE

---

## 📈 5. Escalonamento e Boost de Carboidratos

### Pipeline de Geração
```
┌─────────────────────────────────────────────────────────────┐
│ 1. CARREGAMENTO (loadData)                                  │
│ → Âncoras filtradas por goal + dietary_profile              │
│ → Templates + Papéis + Categorias                           │
├─────────────────────────────────────────────────────────────┤
│ 2. MONTAGEM (buildMeal)                                     │
│ → Âncoras primeiro                                          │
│ → Papéis obrigatórios                                       │
│ → Papéis opcionais                                          │
│ → Garantia de proteína mínima (20g pratos, 5g lanches)      │
├─────────────────────────────────────────────────────────────┤
│ 3. ESCALONAMENTO (scale)                                    │
│ → Redução ativa de proteína se >95% inicial                 │
│ → Proteção preventiva (não escalar proteínas se >110%)      │
│ → Compensação via carboidratos                              │
│ → Injeção agressiva de carbs para Bulk travado              │
├─────────────────────────────────────────────────────────────┤
│ 4. BOOST DE CARBS (boostCarbs) - v5.22                      │
│ → Aplicado POR OPÇÃO, não apenas agregação geral            │
│ → Modo agressivo para Bulk com alta demanda                 │
│ → Limite expandido (1.5x-2.5x normal)                       │
├─────────────────────────────────────────────────────────────┤
│ 5. REDUÇÃO DE CALORIAS (reduceCaloriesPreferNonCarb)        │
│ → Se excedeu calorias após boost                            │
│ → Prioriza reduzir gorduras e proteínas                     │
│ → Preserva carboidratos                                     │
├─────────────────────────────────────────────────────────────┤
│ 6. VALIDAÇÃO (validateNutritionalContracts)                 │
│ → TODAS as 3 opções validadas independentemente             │
│ → Contratos: Cal ±10%, Prot ≥95%, Carb ≥80/90%, Fat ≤30%    │
└─────────────────────────────────────────────────────────────┘
```

### Status: ✅ FUNCIONANDO CORRETAMENTE

---

## 📊 6. Diagnósticos e Observabilidade

### Estados de Geração
```typescript
enum GenerationState {
  NORMAL,                  // Geração padrão
  STALL_DETECTED,          // Detectado travamento
  FORCED_CARB_INJECTION    // Injeção agressiva aplicada
}
```

### Metadados Capturados
- `scaleIterations`: Número de iterações de escalonamento
- `stallFallbackTriggered`: Se fallback foi acionado
- `carbInjectionApplied`: Se injeção de carbs foi aplicada
- `expandedLimitFoods`: Alimentos com limites expandidos

---

## ✅ Conclusão da Análise

O gerador v5.24 está **totalmente funcional** e incorpora corretamente:

| Componente | Status | Observações |
|------------|--------|-------------|
| **Âncoras** | ✅ | Filtro por goal_type e dietary_profile |
| **Templates** | ✅ | Papéis obrigatórios/opcionais respeitados |
| **Contexto** | ✅ | Bloqueios por tipo de refeição ativos |
| **Gordura** | ✅ | Limites rigorosos por categoria |
| **Escalonamento** | ✅ | Proteção de proteína + boost de carbs |
| **Validação** | ✅ | Todas as 3 opções validadas |

### Fluxo Verificado
1. ✅ `loadData()` carrega âncoras filtradas por objetivo e restrições
2. ✅ `buildMeal()` aplica âncoras primeiro, depois papéis do template
3. ✅ `isBlockedForMealType()` filtra alimentos inadequados por contexto
4. ✅ `isFattyAnchor()` e `isFattyForRandomSelection()` controlam gordura
5. ✅ `scale()` escala porções com proteção preventiva
6. ✅ `boostCarbs()` aplica boost por opção (v5.22)
7. ✅ `validateNutritionalContracts()` valida todas as opções

---

*Análise realizada por Lovable AI - 2026-02-07*
