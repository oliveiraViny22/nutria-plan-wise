# 🔍 Auditoria Completa: Gerador de Planos Alimentares v5

**Data**: 2026-02-06  
**Versão Auditada**: v5.14 (generate-plan)  
**Escopo**: Lógica, dados, consistência e contratos nutricionais

---

## 📊 Resumo Executivo

| Aspecto | Status | Criticidade | Ação Requerida |
|---------|--------|-------------|----------------|
| Bloqueio de Gorduras | ✅ Implementado | - | Monitorar |
| Proteínas Gordurosas no DB | ⚠️ 20 itens com fat>8 | Média | Revisar âncoras |
| Laticínios Gordurosos | ⚠️ 9 itens com fat>8 | Média | Bloquear em seleção |
| Templates Completos | ✅ 6 templates ativos | - | OK |
| Roles Mapeados | ✅ 11 roles configurados | - | OK |
| Detecção de Receitas | ✅ Implementado | - | Expandir lista |
| Bloqueio Contextual | ✅ Implementado | - | OK |
| Validação de Contratos | ✅ Bloqueia planos inválidos | - | OK |
| Carb-First para Bulk | ⚠️ Parcial | Média | Melhorar convergência |
| Proteína Mínima por Refeição | ✅ Implementado | - | OK |

---

## 🔴 INCONSISTÊNCIAS CRÍTICAS

### 1. Proteínas com Alto Teor de Gordura no Catálogo

**Problema**: Existem 20 alimentos na categoria `proteinas` com mais de 8g de gordura por 100g, o que pode causar estouro de metas de gordura.

| Alimento | Proteína | Gordura | Calorias | Razão P/G |
|----------|----------|---------|----------|-----------|
| Gema de Ovo Cozida | 16g | 27g | 322 | 0.59 |
| Costela Bovina Cozida | 24g | 21g | 292 | 1.14 |
| Ovo Frito | 13.6g | 15.3g | 196 | 0.89 |
| Sardinha | 23.8g | 14.6g | 216 | 1.63 |
| Salmão | 20g | 13g | 208 | 1.54 |
| Sobrecoxa de Frango Assada | 25g | 13g | 220 | 1.92 |
| Tempeh | 20g | 10.8g | 192 | 1.85 |

**Status Atual**: O gerador BLOQUEIA esses alimentos via `isFattyAnchor()` e `isFattyForRandomSelection()` com `MAX_FAT_PROTEIN = 8`.

**Recomendação**: 
- ✅ Lógica de bloqueio está correta
- ⚠️ Verificar se Tempeh (10.8g) está sendo usado como âncora (encontrado no DB)

---

### 2. Laticínios Gordurosos Ativos

**Problema**: 9 laticínios com mais de 8g de gordura estão ativos, incluindo queijos que podem ser selecionados aleatoriamente.

| Alimento | Gordura | Calorias |
|----------|---------|----------|
| Queijo Parmesão | 30g | 430 |
| Queijo Prato | 28g | 350 |
| Queijo Minas Padrão | 25g | 320 |
| Leite de Coco | 24g | 230 |
| Requeijão Cremoso | 23g | 257 |
| Queijo Mussarela | 22g | 300 |
| Queijo Ricota Fresca | 13g | 174 |
| Cream Cheese Light | 12g | 165 |
| Ricota | 10g | 140 |

**Status Atual**: O gerador bloqueia laticínios com `fat > 8` via `MAX_FAT_DAIRY = 8`.

**Recomendação**: 
- ✅ Lógica de bloqueio está correta
- ⚠️ Considerar adicionar "queijo parmesão", "queijo prato" à lista `BLOCKED_KEYWORDS`

---

### 3. Âncora com Alto Teor de Gordura

**Inconsistência Identificada**: O alimento **Tempeh** está configurado como âncora para `proteina_principal` no jantar (opção 3) com 10.8g de gordura/100g.

```
meal_type: dinner
option_number: 3
role_name: proteina_principal
food: Tempeh
fat: 10.8g (EXCEDE LIMITE DE 8g)
```

**Impacto**: A função `isFattyAnchor()` deveria bloquear, mas como está configurado no DB, pode passar.

**Recomendação**: 
- 🔴 **AÇÃO IMEDIATA**: Desativar âncora de Tempeh ou substituir por Tofu (4.8g fat)
- Alternativa: Usar Tofu que já está no DB como âncora

---

## ⚠️ INCONSISTÊNCIAS MÉDIAS

### 4. Convergência de Carboidratos para Bulk

**Problema**: O `boostCarbs()` pode não convergir para perfis de alta demanda calórica (>3500 kcal) em 5 iterações.

**Status Atual**: 
- `MAX_BOOST_PERCENT` aumentado para 2.5x em bulk
- `LIMIT_MULTIPLIER` de 1.5x para categorias carb-ricas
- Loop de refinamento com 5 tentativas

**Recomendação**:
- Aumentar `MAX_BOOST_PERCENT` para 3.0x em casos extremos
- Adicionar fallback: injetar alimento carb-rico se loop não convergir

---

### 5. Palavras-Chave de Receitas Incompletas

**Lista Atual** (`RECIPE_KEYWORDS`):
```
mingau, vitamina de, shake de, smoothie, sanduíche, wrap, 
tapioca recheada, crepioca, omelete, panqueca, pizza, 
lasanha, escondidinho, estrogonofe, moqueca, feijoada, risoto
```

**Recomendações de Adição**:
```
hambúrguer, salada de, salada pronta, poke, açaí preparado,
caldo de, sopa de, purê de, torta, quiche, empada, pastel
```

---

### 6. Mapeamento de Categorias nos Roles

**Verificação**: 

| Role | Categorias | Status |
|------|------------|--------|
| carboidrato_base | carboidratos | ✅ OK |
| proteina_principal | proteinas | ✅ OK |
| proteina_leve | laticinios, proteinas | ✅ OK |
| leguminosa | leguminosas | ✅ OK |
| vegetal | vegetais | ✅ OK |
| fruta | frutas | ✅ OK |
| gordura | gorduras | ✅ OK |
| laticinio | laticinios | ✅ OK |

**Observação**: O role `proteina_leve` aceita laticínios E proteínas, o que é correto para lanches.

---

## ✅ LÓGICA VALIDADA (SEM PROBLEMAS)

### 7. Sistema de Bloqueio de Gorduras

```typescript
FATTY_FOOD_RULES = {
  MAX_FAT_PROTEIN: 8,      // ✅ Proteínas
  MAX_FAT_DAIRY: 8,        // ✅ Laticínios
  MAX_FAT_CARBS: 5,        // ✅ Carboidratos
  MAX_FAT_GENERIC: 15,     // ✅ Genérico
  BLOCKED_KEYWORDS: [...]  // ✅ Oleaginosas, queijos gordos
  BLOCKED_CATEGORIES_AS_RANDOM: ["gorduras"] // ✅ Não seleciona aleatoriamente
}
```

### 8. Detecção de Alimentos Similares

```typescript
SIMILAR_FOOD_GROUPS = [
  ["iogurte", "yogurt"],   // ✅ Evita 2 iogurtes
  ["leite"],               // ✅ Evita 2 leites
  ["queijo"],              // ✅ Evita 2 queijos
  ["frango", "peito de frango"],  // ✅
  ...
]
```

### 9. Validação de Contratos Nutricionais

```typescript
validateNutritionalContracts():
  - ✅ Verifica TODAS as opções (1, 2, 3)
  - ✅ Valida calorias ±10%
  - ✅ Valida proteína ≥95%
  - ✅ Valida carbs ≥90% (80% bulk)
  - ✅ Valida gordura ≤30% das calorias
  - ✅ BLOQUEIA salvamento se inválido (HTTP 400)
```

### 10. Proteína Mínima por Refeição

```typescript
minProteinRequired:
  - Refeições principais: 20g ✅
  - Lanches: 5g ✅
  - ProteinBoost automático se abaixo ✅
```

---

## 📈 MÉTRICAS DO CATÁLOGO

| Categoria | Total | Ativos | Aprovados | Alto Fat (>15g) |
|-----------|-------|--------|-----------|-----------------|
| proteinas | 47 | 45 | 47 | 4 |
| vegetais | 43 | 43 | 43 | 0 |
| carboidratos | 40 | 34 | 34 | 0 |
| frutas | 37 | 37 | 37 | 0 |
| laticinios | 23 | 23 | 23 | 6 |
| gorduras | 21 | 21 | 21 | 0 (esperado) |
| leguminosas | 15 | 15 | 15 | 0 |
| suplementos | 14 | 14 | 14 | 0 |
| mistos | 3 | 3 | 3 | 2 |

---

## 🛠️ RECOMENDAÇÕES PRIORIZADAS

### Prioridade Alta (Fazer Agora)

1. **Desativar âncora de Tempeh no jantar**
   ```sql
   UPDATE meal_anchor_foods 
   SET is_active = false 
   WHERE food_id = (SELECT id FROM foods WHERE name = 'Tempeh')
   AND meal_type = 'dinner';
   ```

2. **Adicionar queijos gordos à lista de bloqueio**
   ```typescript
   BLOCKED_KEYWORDS: [
     ...existing,
     "queijo parmesão", "queijo prato", "queijo minas padrão",
     "requeijão cremoso"
   ]
   ```

### Prioridade Média (Próxima Sprint)

3. **Expandir lista de receitas bloqueadas**
   - Adicionar: hambúrguer, salada pronta, poke, purê, sopa

4. **Melhorar convergência de carbs para bulk**
   - Aumentar iterações de boost para 8 em alta demanda
   - Adicionar fallback de injeção de carb-rico

### Prioridade Baixa (Backlog)

5. **Criar logs de auditoria em produção**
   - Salvar métricas de validação em tabela dedicada
   - Dashboard de taxa de sucesso/falha

6. **Testes automatizados por perfil**
   - Cut: validar gordura ≤100%
   - Bulk: validar carbs ≥80%
   - Maintain: validar flexibilidade

---

## 📁 Arquivos Relacionados

- `supabase/functions/generate-plan/index.ts` - Gerador v5.14
- `supabase/functions/_shared/nutrition-contracts.ts` - Contratos
- `supabase/functions/_shared/category-limits.ts` - Limites
- `supabase/functions/_shared/food-categories.ts` - Categorias
- `docs/AUDITORIA_PERFIS_NUTRICIONAIS.md` - Auditoria de perfis

---

## 📝 Changelog da Auditoria

| Data | Versão | Alterações |
|------|--------|------------|
| 2026-02-06 | 1.0 | Auditoria inicial completa |
