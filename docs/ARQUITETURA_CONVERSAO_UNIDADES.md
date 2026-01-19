# Arquitetura: Sistema de Conversão Determinística de Unidades

## Princípios Imutáveis

### 1. Gramas são a Única Fonte de Verdade
- Todos os cálculos nutricionais são feitos EXCLUSIVAMENTE em gramas
- O banco de dados armazena `quantity` em gramas nas tabelas `meal_option_foods` e `meal_foods`
- `calculated_grams` é a verdade final após arredondamento

### 2. Unidades são Camada de Apresentação
- `display_quantity` e `display_unit` são APENAS para exibição ao usuário
- Nunca usar `display_quantity` para cálculos nutricionais
- Exemplos: "2 ovos", "3 fatias", "1 banana"

### 3. Conversões são Decisões Únicas
- A conversão gramas → unidades acontece UMA VEZ:
  - Na criação inicial do plano
  - Na substituição de alimentos
  - No rebalanceamento explícito de macros
- Após decidida, a conversão é PERSISTIDA e BLOQUEADA (`unit_conversion_locked = true`)

### 4. Backend Reaplica sem IA
- Exibição de plano NUNCA chama IA
- Alimentos com `unit_conversion_locked = true` usam valores persistidos
- A função determinística é chamada apenas em operações de escrita

### 5. Frontend Não Executa Lógica Nutricional
- Frontend apenas EXIBE dados já calculados
- Formatação de unidades usa `formatQuantityForDisplay()`
- Nunca recalcular macros no frontend

---

## Modelo de Dados

### Tabela `foods`
```sql
unit_name TEXT           -- Nome da unidade (ovo, fatia, etc.)
unit_weight_grams NUMERIC -- Peso de 1 unidade em gramas
unit_increment NUMERIC    -- Incremento permitido (1, 0.5)
unit_enabled BOOLEAN      -- Se TRUE, permite conversão
```

### Tabela `meal_option_foods`
```sql
quantity NUMERIC              -- Quantidade original em gramas (do cálculo)
display_quantity NUMERIC      -- Quantidade para exibição
display_unit TEXT             -- "g" ou unit_name
calculated_grams NUMERIC      -- Gramas finais após arredondamento
unit_conversion_locked BOOLEAN -- Se TRUE, não reavaliar
```

---

## Fluxo de Conversão

### 1. Geração de Plano (com conversão)
```
1. Calcular macros → quantidade em gramas
2. Para cada alimento:
   a. Verificar se unit_enabled = true
   b. Se sim, chamar convert_grams_to_unit()
   c. Verificar tolerância de ±5%
   d. Se válido: usar unidades
   e. Se inválido: fallback para gramas
3. Persistir display_quantity, display_unit, calculated_grams
4. Setar unit_conversion_locked = true
```

### 2. Exibição de Plano (sem conversão)
```
1. Buscar dados do plano
2. Usar display_quantity e display_unit diretamente
3. Formatar com formatQuantityForDisplay()
4. NUNCA recalcular
```

### 3. Substituição de Alimento (com conversão)
```
1. Verificar se alimento atual tem unit_conversion_locked = true
2. Calcular nova quantidade em gramas
3. Aplicar conversão determinística
4. Persistir novos valores
5. Setar unit_conversion_locked = true
```

---

## Função de Conversão Determinística

```typescript
function convertGramsToUnit(
  grams: number,
  unitWeightGrams: number,
  unitIncrement: number = 1,
  tolerancePercent: number = 5
): ConversionResult
```

### Algoritmo:
1. `rawUnits = grams / unitWeightGrams`
2. `roundedUnits = round(rawUnits / unitIncrement) * unitIncrement`
3. `finalGrams = roundedUnits * unitWeightGrams`
4. `errorPercent = |finalGrams - grams| / grams * 100`
5. Se `errorPercent <= 5%`: sucesso
6. Se `errorPercent > 5%`: fallback para gramas

### Exemplo:
```
Input: 95g de ovo (unit_weight = 50g, increment = 1)
rawUnits = 95 / 50 = 1.9
roundedUnits = round(1.9 / 1) * 1 = 2
finalGrams = 2 * 50 = 100g
errorPercent = |100 - 95| / 95 * 100 = 5.26%
Resultado: 5.26% > 5% → Fallback para "95g"
```

---

## Quando a IA Atua

### IA Decide (uma vez):
- ✅ Criação inicial do plano
- ✅ Substituição de alimentos
- ✅ Rebalanceamento explícito de macros
- ✅ Ajuste de metas nutricionais

### IA NÃO Atua:
- ❌ Exibição de plano existente
- ❌ Confirmação de refeição
- ❌ Visualização de histórico
- ❌ Qualquer operação de leitura

---

## Comportamento da IA

### Regras Obrigatórias:
1. **Respeitar lock**: Se `unit_conversion_locked = true`, não reavaliar
2. **Não alterar exibição**: Sem mudança nutricional, não mudar display
3. **Decisão única**: Após decidir, sistema executa deterministicamente
4. **Persistir sempre**: Toda decisão deve ser salva no banco

### Prompt de Contexto (para IA):
```
REGRAS DE CONVERSÃO DE UNIDADES:
- Gramas são verdade nutricional
- Unidades são apresentação
- Se unit_conversion_locked = true, NÃO alterar
- Conversão acontece UMA VEZ
- Sistema reaplica sem você
```

---

## Validação do Sistema

### Critérios de Sucesso:
1. ✅ Plano gerado continua correto sem nova análise da IA
2. ✅ Exibição permanece humana e executável ("2 ovos", não "100g")
3. ✅ Sistema funciona mesmo se IA indisponível
4. ✅ Equivalência nutricional mantida entre opções
5. ✅ Macros recalculados corretamente após arredondamento

### Testes:
```typescript
// Teste 1: Conversão válida
convertGramsToUnit(100, 50, 1, 5)
// → { success: true, display_quantity: 2, calculated_grams: 100 }

// Teste 2: Fallback para gramas
convertGramsToUnit(95, 50, 1, 5)
// → { success: false, display_quantity: 95, display_unit: 'g' }

// Teste 3: Meio incremento
convertGramsToUnit(75, 50, 0.5, 5)
// → { success: true, display_quantity: 1.5, calculated_grams: 75 }
```

---

## Restrições Absolutas

1. ❌ Não inventar novas funcionalidades
2. ❌ Não aumentar escopo
3. ❌ Não reprocessar dados já estáveis
4. ❌ Não depender da IA para exibição
5. ❌ Não expor lógica técnica ao usuário final
6. ❌ Não criar múltiplas unidades por alimento
7. ❌ Não criar tabelas genéricas de medidas
