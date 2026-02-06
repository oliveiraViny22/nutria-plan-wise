# 🔬 Análise: Excesso de Proteína no Gerador de Planos

**Data**: 2026-02-06  
**Versão**: generate-plan v5.14  
**Caso Analisado**: Perfil Bulk com 3562 kcal

---

## 📊 Dados do Caso

### Perfil do Usuário
| Parâmetro | Valor |
|-----------|-------|
| Objetivo | gain_muscle (Bulk) |
| Peso | 84 kg |
| Calorias Alvo | 3562 kcal |
| Proteína Alvo | 168g (2.0 g/kg) |
| Carboidratos Alvo | 545g |
| Gordura Alvo | 79g |

### Resultado Final do Plano
| Macro | Meta | Gerado | % da Meta | Status |
|-------|------|--------|-----------|--------|
| Calorias | 3562 | 3118 | 87.5% | ❌ Abaixo |
| Proteína | 168g | 201g | **119.7%** | ⚠️ Excesso |
| Carboidratos | 545g | 459g | 84.1% | ⚠️ Abaixo do piso |
| Gordura | 79g | 49g | 62% | ✅ OK |

---

## 🔍 Causa Raiz Identificada

### Problema Principal: **Proteína Inicial Muito Alta + Escalonamento Proporcional**

#### Sequência de Eventos:

**1. Montagem Inicial das Refeições (pré-scale)**
```
Café da Manhã:   25.6g proteína
Lanche Manhã:    29.0g proteína  
Almoço:          35.9g proteína
Lanche Tarde:    35.1g proteína  ← LANCHE com 35g!
Jantar:          41.2g proteína
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL INICIAL:   166.8g (99% da meta de 168g)
CALORIAS:        1741 kcal (48.9% da meta)
```

**2. Problema: Proteína já em 99% com apenas 49% das calorias**

O plano inicial atinge a meta de proteína com **metade das calorias**. Isso significa que os alimentos selecionados têm densidade proteica muito alta em relação à densidade calórica.

**3. Tentativa de Escalonamento**

O `scale()` tenta aumentar calorias de 1741 → 3562 (fator 2.04x). O log mostra:

```
iter 0: cals=1741, prot=166.8 (99%), diff=51%
iter 1: cals=2978, prot=197.2 (117%), diff=16%  ← Proteína explodiu!
iter 2-7: cals=3118, prot=201.1 (120%), diff=12.5%  ← Travou
```

**4. Proteção Preventiva Ativada (mas tarde demais)**

```json
{
  "m": "ScaleProteinPreventive",
  "currentProtein": 201,
  "projectedProtein": 230,
  "maxAllowed": 185,
  "action": "protect_protein_foods"
}
```

A proteção foi ativada, mas a proteína **já estava em 201g** (acima do máximo de 185g). O sistema protegeu alimentos proteicos de escalar mais, mas não conseguiu **reduzir** a proteína já existente.

---

## 🧮 Análise Matemática

### Por que a proteína subiu de 167g para 201g?

Na iteração 1, o fator de escalonamento foi ~1.71x (de 1741 para 2978 kcal).

Alimentos com **alta razão proteína/caloria** escalaram proporcionalmente:
- Se um alimento tem 30g prot / 200 kcal, ao escalar 1.5x: 45g prot / 300 kcal
- A proteína escala junto com as calorias!

### Por que travou em 3118 kcal?

Com a proteção ativada, alimentos proteicos (>25% das calorias de proteína) param de escalar. Restam apenas:
- Carboidratos: Arroz, pão, etc.
- Vegetais: Baixa densidade calórica
- Gorduras: Bloqueadas para não exceder meta

**O sistema fica preso**: precisa de +444 kcal mas não pode:
- Escalar proteínas (proteção ativa)
- Adicionar gorduras (limite de gordura)
- Escalar carbs o suficiente (limites de porção atingidos)

---

## 🎯 Causas Específicas

### 1. **Lanche da Tarde com 35g de Proteína**

Um lanche com 35g de proteína é atípico. O piso deveria ser 5g, não 35g.

**Possíveis causas**:
- Âncora de proteína configurada para lanche
- `ProteinBoost` acionado desnecessariamente
- Role `proteina_leve` selecionando alimento muito proteico

### 2. **Falta de Alimentos Carb-Ricos no Plano Inicial**

Com 1741 kcal e 173g de carbs, a razão carb/caloria está baixa. Isso força o escalonamento a puxar proteínas junto.

### 3. **Limites de Porção Muito Restritivos**

Mesmo com `LIMIT_MULTIPLIER = 1.5` para bulk, os máximos de categoria podem estar impedindo convergência:
- Carboidratos: max 300g → 450g (com 1.5x)
- Se o plano tem 4 refeições principais, são ~112g de carb cada

### 4. **Ausência de Mecanismo de Redução de Proteína**

O sistema só **protege** proteínas, nunca **reduz**. Se a proteína inicial for alta, ela permanece alta.

---

## 🛠️ Recomendações de Correção

### 1. Implementar Redução Ativa de Proteína (Prioridade Alta)

```typescript
// No scale(), ANTES de escalar, verificar se proteína já está alta
if (current.protein > targetProtein * 0.95) {
  // Reduzir porções de alimentos proteicos para liberar espaço calórico
  reduceProteinFoods(mwo, targetProtein * 0.90);
}
```

### 2. Limitar Proteína em Lanches na Montagem (Prioridade Alta)

```typescript
// Em buildMeal(), para lanches:
if (isSnack) {
  const maxSnackProtein = 15; // Limite de 15g por lanche
  // Não adicionar ProteinBoost se já atingiu
  // Limitar porção de alimentos proteicos
}
```

### 3. Priorizar Carbs na Montagem Inicial para Bulk (Prioridade Média)

```typescript
// Se objetivo é bulk e meta de carbs > 400g:
// - Aumentar porções base de carboidratos em 25%
// - Garantir pelo menos 60% das calorias iniciais de carbs
```

### 4. Adicionar Fallback de Injeção de Carbs (Prioridade Média)

```typescript
// Se scale() não convergir e proteína > 110%:
// - Injetar alimento carb-rico adicional (arroz, batata)
// - Reduzir proporcionalmente alimentos proteicos
```

### 5. Revisar Âncoras de Lanches (Prioridade Alta)

Verificar se há âncoras de `proteina_principal` em lanches que não deveriam existir.

---

## 📈 Métricas para Monitoramento

| Indicador | Valor Atual | Meta | Status |
|-----------|-------------|------|--------|
| Taxa de validação OK | ~50% (estimado) | >90% | ❌ |
| Proteína média/meta | 110-120% | 95-105% | ⚠️ |
| Convergência de calorias | 87% | 95-105% | ❌ |
| Carbs em bulk | 84% | >80% | ✅ |

---

## 📁 Arquivos para Modificação

1. `supabase/functions/generate-plan/index.ts`
   - Função `scale()`: adicionar redução de proteína
   - Função `buildMeal()`: limitar proteína em lanches

2. `supabase/functions/_shared/category-limits.ts`
   - Revisar `SNACK_CATEGORY_LIMITS.proteinas.max`

3. Banco de dados:
   - Revisar `meal_anchor_foods` para lanches
   - Verificar se há âncoras proteicas em snacks

---

## 🔄 Próximos Passos

1. [ ] Implementar limite de proteína em lanches (15g max)
2. [ ] Adicionar mecanismo de redução de proteína em scale()
3. [ ] Aumentar peso de carbs na montagem inicial para bulk
4. [ ] Testar com perfil de 3500+ kcal
5. [ ] Monitorar logs de ScaleProteinPreventive
