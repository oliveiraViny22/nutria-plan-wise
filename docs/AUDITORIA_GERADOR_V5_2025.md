# Auditoria do Gerador de Planos Alimentares v5.17

**Data**: 2025-02-07  
**Versão**: v5.17  
**Status**: ✅ Conformidade verificada com correções aplicadas

---

## 1. Contratos Nutricionais

### 1.1 Tolerâncias Calóricas
| Objetivo | Tolerância | Threshold |
|----------|------------|-----------|
| Cut/Maintain | ±10% | Padrão |
| Bulk (>3000 kcal) | ±20% | HIGH_CALORIE_BULK_THRESHOLD |

**Status**: ✅ Implementado corretamente em `nutrition-contracts.ts`

### 1.2 Limites de Macros
| Macro | Contrato | Validação |
|-------|----------|-----------|
| Proteína global | ≥95% da meta | ✅ G1 |
| Proteína refeição principal | ≥20g | ✅ MIN_PROTEIN_MAIN_MEAL_GRAMS |
| Proteína lanche | ≥5g, ≤15g | ✅ MAX_SNACK_PROTEIN |
| Gordura | ≤30% das calorias | ✅ MAX_FAT_PERCENT_OF_CALORIES |
| Carboidratos (Bulk) | ≥80% da meta | ✅ GENERATOR_CARBS_MIN_BY_OBJECTIVE |
| Carboidratos (outros) | ≥90% da meta | ✅ |

**Status**: ✅ Todos os contratos implementados e validados

---

## 2. Templates de Refeição

### 2.1 Templates Ativos
| Tipo | Templates | Status |
|------|-----------|--------|
| breakfast | 1 (Padrão) | ✅ |
| morning_snack | 1 (Padrão) | ✅ |
| lunch | 3 (Padrão, Low Carb, Mediterrâneo) | ✅ |
| afternoon_snack | 1 (Padrão) | ✅ |
| dinner | 3 (Padrão, Low Carb, Mediterrâneo) | ✅ |
| supper | 1 (Padrão) | ✅ |

### 2.2 Roles e Categorias
**Problema encontrado**: 4 roles sem categorias associadas

| Refeição | Role | Ação |
|----------|------|------|
| breakfast | vegetal | ✅ Adicionado: vegetais |
| morning_snack | carboidrato_base | ✅ Adicionado: carboidratos |
| morning_snack | laticinio | ✅ Adicionado: laticinios |
| supper | laticinio | ✅ Adicionado: laticinios |

**Status**: ✅ Corrigido

---

## 3. Âncoras por Objetivo

### 3.1 Distribuição de Âncoras
| Objetivo | Total Âncoras | Qty Média |
|----------|---------------|-----------|
| Bulk | 337 | ~140g |
| Cut | 242 | ~100g |
| Maintain | 277 | ~117g |
| Universal | 6 | ~127g |

### 3.2 Escalonamento por Objetivo
O sistema filtra âncoras via `goal_type` no banco:
- `bulk` → prioriza quantidades maiores (140g média)
- `cut` → prioriza quantidades menores (100g média)
- `maintain` → quantidades intermediárias (117g média)
- `NULL` → âncoras universais (aplicam a qualquer objetivo)

**Status**: ✅ Implementado corretamente

---

## 4. Regras de Bloqueio

### 4.1 Bloqueio de Gordura (v5.13)
| Categoria | Limite Gordura | Status |
|-----------|----------------|--------|
| Proteínas | >8g/100g | ✅ BLOCKED |
| Laticínios | >8g/100g | ✅ BLOCKED |
| Carboidratos | >5g/100g | ✅ BLOCKED |
| Genérico | >15g/100g | ✅ BLOCKED |

**Alimentos bloqueados encontrados nas âncoras** (serão ignorados na seleção):
- Ovo Frito (15.3g fat) - Proteína bloqueada
- Ovo Mexido (11.5g fat) - Proteína bloqueada
- Pasta de Amendoim (50g fat) - Genérico bloqueado
- Castanhas (43-66g fat) - Genérico bloqueado
- Aveia em Flocos (7g fat) - Carboidrato bloqueado

**Nota**: Esses alimentos estão cadastrados como âncoras mas são corretamente filtrados pelo `isFattyAnchor()` durante a geração.

### 4.2 Bloqueio Contextual (v5.16)
| Contexto | Alimentos Bloqueados |
|----------|---------------------|
| Lanches | Sobrecoxa, Coxa de Frango, Pernil, Costela, Picanha |
| Café da manhã | Seitan, Tempeh, Tofu, Carnes, Peixes, Leguminosas |

**Status**: ✅ Implementado em `isBlockedForMealType()`

### 4.3 Bloqueio de Receitas
Keywords bloqueadas: mingau, vitamina, shake, smoothie, sanduíche, wrap, tapioca recheada, crepioca, omelete, panqueca, pizza, lasanha, etc.

**Status**: ✅ Implementado em `filterFoods()`

---

## 5. Categorias de Alimentos

### 5.1 Categorias Canônicas
```typescript
const CANONICAL_CATS = [
  "carboidratos", "proteinas", "gorduras", "vegetais", "frutas",
  "laticinios", "leguminosas", "mistos", "peixes", "frutos_do_mar",
  "tuberculos", "cereais", "graos", "oleaginosas", "ovos",
  "cogumelos", "queijos", "sementes", "bebidas", "condimentos",
  "veganos", "receitas"
];
```

### 5.2 Alimentos por Categoria
| Categoria | Qtd Alimentos | Status |
|-----------|---------------|--------|
| vegetais | 46 | ✅ CANONICAL |
| frutas | 37 | ✅ CANONICAL |
| proteinas | 37 | ✅ CANONICAL |
| carboidratos | 34 | ✅ CANONICAL |
| laticinios | 29 | ✅ CANONICAL |
| suplementos | 16 | ⚠️ NON_CANONICAL (excluídos da geração) |
| leguminosas | 15 | ✅ CANONICAL |
| gorduras | 14 | ✅ CANONICAL |
| peixes | 12 | ✅ CANONICAL |
| oleaginosas | 9 | ✅ CANONICAL |
| tuberculos | 5 | ✅ CANONICAL |
| mistos | 2 | ✅ CANONICAL |

**Nota**: "suplementos" é intencionalmente excluído via `filterFoods()`.

---

## 6. Preferências do Usuário

### 6.1 Alimentos Preferidos
O sistema implementa priorização via `prefSet`:
- 80% de chance de selecionar alimento preferido quando disponível
- Busca por substring em nome do alimento
- Exemplo: "frango" → Peito de Frango, Frango Desfiado, etc.

**Status**: ✅ Implementado corretamente

### 6.2 Alimentos Evitados
O sistema implementa exclusão absoluta via `avoided`:
- Busca por match exato e substring
- Remove alimentos de todas as etapas de seleção

**Status**: ✅ Implementado corretamente

---

## 7. Restrições Dietéticas

### 7.1 Restrições Suportadas
| Restrição | Filtro Aplicado |
|-----------|-----------------|
| Low Carb | Bloqueia alimentos >15g carbs/100g |
| Vegano | Bloqueia proteinas, peixes, ovos, laticinios, queijos, frutos_do_mar |
| Pescetariano | Bloqueia carnes (permite peixes e frutos do mar) |
| Lactose | Bloqueia laticinios e queijos |
| Glúten | Bloqueia trigo, pão, massas |

### 7.2 Validação Cruzada
O sistema detecta redundâncias e incompatibilidades:
- Vegano + Lactose → Redundante (warning)
- Vegano + Pescetariano → Incompatível (usa Vegano)

**Status**: ✅ Implementado em `validateCrossRestrictions()`

---

## 8. Limites de Quantidade por Categoria

### 8.1 Limites Padrão (CATEGORY_LIMITS)
| Categoria | Min (g) | Max (g) |
|-----------|---------|---------|
| proteinas | 60 | 250 |
| carboidratos | 40 | 300 |
| gorduras | 5 | 30 |
| vegetais | 30 | 300 |
| frutas | 30 | 150 |
| leguminosas | 40 | 200 |
| laticinios | 30 | 300 |
| oleaginosas | 10 | 40 |

### 8.2 Limites de Lanche (SNACK_CATEGORY_LIMITS)
| Categoria | Min (g) | Max (g) |
|-----------|---------|---------|
| proteinas | 60 | 150 |
| carboidratos | 80 | 150 |
| gorduras | 5 | 15 |
| frutas | 80 | 150 |
| laticinios | 100 | 200 |

**Status**: ✅ Implementado em `category-limits.ts`

---

## 9. Mecanismos de Convergência

### 9.1 Proteína Boost (v5.12)
- Se refeição tem <20g proteína (principal) ou <5g (lanche)
- Aumenta porção de alimento proteico existente
- Ou adiciona nova proteína com role "proteina_boost"

### 9.2 Redução Ativa de Proteína (v5.15)
- Se proteína inicial >95% da meta mas calorias <60%
- Reduz porções de alimentos com alta densidade proteica
- Evita explosão de proteína durante scaling

### 9.3 Carb Boost para Bulk (v5.15)
- Multiplicador BULK_CARB_MULTIPLIER = 1.25
- Aplicado a carboidratos e leguminosas na montagem inicial
- Injeção agressiva de carbs se déficit >25%

### 9.4 Stall Detection (v5.17)
- Detecta quando scaling não converge
- Compensa via injeção forçada de carboidratos
- Limite máximo: 2.5x (4.0x para bulk alta demanda)

**Status**: ✅ Todos os mecanismos implementados

---

## 10. Validação Multi-Opção

O sistema valida TODAS as 3 opções de refeição:
- Calcula totais independentes por índice de opção
- Executa validação de contrato separadamente
- Gera warnings específicos por opção

**Status**: ✅ Implementado em `validateNutritionalContracts()`

---

## 11. Inconsistências Corrigidas

### 11.1 Templates e Roles
- ✅ Removidas entradas duplicadas de templates
- ✅ Padronizado `carboidrato` → `carboidrato_base`
- ✅ Padronizado `laticinios` → `laticinio`
- ✅ Adicionadas categorias faltantes aos roles

### 11.2 Dados Nutricionais
- ✅ 10 alimentos com discrepância calórica corrigidos

---

## 12. Recomendações Futuras

1. **Limpar âncoras gordas**: Considerar remover âncoras que serão sempre bloqueadas (Ovo Frito, Pasta de Amendoim como proteína principal)

2. **Âncoras universais**: Adicionar mais âncoras universais (goal_type NULL) para refeições menores

3. **Monitoramento**: Implementar logging de alimentos bloqueados para análise de eficácia

---

## 13. Conclusão

O gerador v5.17 está **em conformidade** com todos os contratos nutricionais estabelecidos. As correções aplicadas durante esta auditoria garantem:

- ✅ Templates com roles e categorias completos
- ✅ Âncoras escalonadas por objetivo (bulk/cut/maintain)
- ✅ Bloqueio efetivo de alimentos gordos
- ✅ Restrições dietéticas respeitadas
- ✅ Preferências do usuário priorizadas
- ✅ Validação multi-opção funcional
- ✅ Mecanismos de convergência ativos
