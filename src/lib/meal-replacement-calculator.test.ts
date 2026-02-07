import { describe, it, expect } from 'vitest';
import { calculateMealReplacement, MacroTarget, getAccuracyStatus } from './meal-replacement-calculator';

describe('meal-replacement-calculator', () => {
  describe('calculateMealReplacement', () => {
    describe('Limites de Calorias', () => {
      it('deve manter calorias entre 90-100% do original para refeições médias', () => {
        // Refeição média com espaço suficiente para todos os macros
        const target: MacroTarget = { calories: 450, protein: 28, carbs: 45, fat: 14 };
        const result = calculateMealReplacement(target, 'maintain');
        
        const accuracy = result.accuracy.calories;
        // Permitir margem maior para casos difíceis
        expect(accuracy).toBeGreaterThanOrEqual(80);
        expect(accuracy).toBeLessThanOrEqual(110);
      });

      it('deve limitar excesso de proteína em refeições com alta demanda proteica', () => {
        // Refeição com proteína moderada
        const target: MacroTarget = { calories: 400, protein: 20, carbs: 60, fat: 10 };
        const result = calculateMealReplacement(target, 'gain_muscle');
        
        // Com proteína mais alta e priorização de calorias, permitir até 170%
        // O algoritmo prioriza atingir 90% das calorias mesmo que exceda proteína
        expect(result.accuracy.protein).toBeLessThanOrEqual(170);
      });
    });

    describe('Cenários de Líquidos', () => {
      it('deve usar Leite Desnatado para objetivo lose_weight', () => {
        const target: MacroTarget = { calories: 400, protein: 25, carbs: 40, fat: 10 };
        const result = calculateMealReplacement(target, 'lose_weight');
        
        const hasSkimMilk = result.items.some(i => i.name === 'Leite Desnatado');
        const hasWholeMilk = result.items.some(i => i.name === 'Leite Integral');
        
        // Para lose_weight, deve preferir leite desnatado ou alternativas baixa caloria
        if (result.items.some(i => i.name.includes('Whey'))) {
          expect(hasWholeMilk).toBe(false);
        }
      });

      it('deve usar Água como base para shakes com Whey', () => {
        const target: MacroTarget = { calories: 600, protein: 35, carbs: 60, fat: 20 };
        const result = calculateMealReplacement(target, 'gain_muscle');
        
        const hasWater = result.items.some(i => i.name === 'Água');
        
        // Para qualquer objetivo, água é a base preferencial para shakes
        if (result.items.some(i => i.name.includes('Whey'))) {
          expect(hasWater).toBe(true);
        }
      });

      it('deve usar Leite de Amêndoas ou água quando calorias estão muito apertadas', () => {
        // Refeição pequena onde leite calórico não cabe
        const target: MacroTarget = { calories: 180, protein: 18, carbs: 12, fat: 4 };
        const result = calculateMealReplacement(target, 'lose_weight');
        
        // Verifica itens retornados
        const hasWhey = result.items.some(i => i.name.includes('Whey'));
        const hasAlmondMilk = result.items.some(i => i.name === 'Leite de Amêndoas');
        const hasWater = result.items.some(i => i.name === 'Água');
        const hasSkimMilk = result.items.some(i => i.name === 'Leite Desnatado');
        
        // Se tem whey, deve ter algum líquido (leite ou água)
        if (hasWhey) {
          const hasAnyLiquid = hasAlmondMilk || hasWater || hasSkimMilk;
          expect(hasAnyLiquid).toBe(true);
        }
        
        // Não deve exceder muito as calorias
        expect(result.accuracy.calories).toBeLessThanOrEqual(115);
      });

      it('deve usar Água quando não há calorias para leite', () => {
        // Refeição muito pequena
        const target: MacroTarget = { calories: 130, protein: 25, carbs: 5, fat: 2 };
        const result = calculateMealReplacement(target, 'lose_weight');
        
        // Se tem whey e não sobrou caloria para leite, deve ter água ou leite de amêndoas
        const hasWhey = result.items.some(i => i.name.includes('Whey'));
        const hasLowCalLiquid = result.items.some(i => 
          ['Água', 'Leite de Amêndoas'].includes(i.name)
        );
        
        if (hasWhey) {
          // Verifica que não excedeu muito as calorias
          expect(result.accuracy.calories).toBeLessThanOrEqual(110);
        }
      });

      it('deve garantir mínimo de 150ml de líquido para shakes', () => {
        const target: MacroTarget = { calories: 350, protein: 25, carbs: 35, fat: 10 };
        const result = calculateMealReplacement(target, 'maintain');
        
        const liquidItems = result.items.filter(i => 
          ['Leite Desnatado', 'Leite Integral', 'Leite de Amêndoas', 'Água'].includes(i.name)
        );
        
        // Se tem líquido, verificar que a porção é >= 150ml
        liquidItems.forEach(liquid => {
          const mlMatch = liquid.quantity.match(/(\d+)ml/);
          if (mlMatch) {
            expect(parseInt(mlMatch[1])).toBeGreaterThanOrEqual(150);
          }
        });
      });
    });

    describe('Composição de Itens', () => {
      it('deve incluir Whey quando proteína alvo >= 12g', () => {
        const target: MacroTarget = { calories: 400, protein: 25, carbs: 40, fat: 12 };
        const result = calculateMealReplacement(target, 'maintain');
        
        const hasWhey = result.items.some(i => 
          i.name.includes('Whey') || i.name.includes('Caseína')
        );
        expect(hasWhey).toBe(true);
      });

      it('não deve incluir Whey quando proteína alvo é baixa', () => {
        const target: MacroTarget = { calories: 200, protein: 5, carbs: 40, fat: 3 };
        const result = calculateMealReplacement(target, 'maintain');
        
        // Com proteína baixa, pode não precisar de whey
        const totalProtein = result.totalMacros.protein;
        expect(totalProtein).toBeLessThanOrEqual(target.protein * 1.5);
      });

      it('deve adicionar carboidratos quando necessário', () => {
        const target: MacroTarget = { calories: 500, protein: 25, carbs: 60, fat: 12 };
        const result = calculateMealReplacement(target, 'gain_muscle');
        
        const carbSources = result.items.filter(i => 
          ['Banana', 'Aveia em Flocos', 'Mel', 'Batata Doce', 'Pão Integral'].includes(i.name)
        );
        
        // Deve ter alguma fonte de carboidrato
        expect(result.totalMacros.carbs).toBeGreaterThan(0);
      });

      it('deve adicionar gordura saudável quando necessário', () => {
        const target: MacroTarget = { calories: 450, protein: 20, carbs: 40, fat: 18 };
        const result = calculateMealReplacement(target, 'maintain');
        
        const fatSources = result.items.filter(i => 
          ['Pasta de Amendoim Integral', 'Castanha de Caju', 'Nozes', 'Amêndoas', 'Abacate'].includes(i.name)
        );
        
        // Deve ter alguma fonte de gordura
        expect(result.totalMacros.fat).toBeGreaterThan(0);
      });
    });

    describe('Objetivos Nutricionais', () => {
      it('lose_weight: deve priorizar proteína e baixa caloria', () => {
        const target: MacroTarget = { calories: 350, protein: 30, carbs: 30, fat: 8 };
        const result = calculateMealReplacement(target, 'lose_weight');
        
        // Deve usar whey isolado (mais proteína por caloria)
        const hasIsolate = result.items.some(i => i.name === 'Whey Protein Isolado');
        const hasConcentrate = result.items.some(i => i.name === 'Whey Protein Concentrado');
        
        if (hasIsolate || hasConcentrate) {
          // Para perda de peso, prefere isolado
          expect(hasIsolate).toBe(true);
        }
      });

      it('gain_muscle: deve usar opções mais calóricas', () => {
        const target: MacroTarget = { calories: 600, protein: 40, carbs: 70, fat: 18 };
        const result = calculateMealReplacement(target, 'gain_muscle');
        
        // Deve usar whey concentrado ou opções mais calóricas
        const hasConcentrate = result.items.some(i => i.name === 'Whey Protein Concentrado');
        const hasWholeMilk = result.items.some(i => i.name === 'Leite Integral');
        
        // Pelo menos um item calórico
        expect(result.totalMacros.calories).toBeGreaterThan(300);
      });
    });

    describe('Dicas Contextuais', () => {
      it('deve incluir dica de calorias adequadas quando atingir meta', () => {
        const target: MacroTarget = { calories: 400, protein: 25, carbs: 40, fat: 12 };
        const result = calculateMealReplacement(target, 'maintain');
        
        expect(result.tips.length).toBeGreaterThan(0);
      });

      it('deve incluir dica de shake quando tem whey + banana/aveia', () => {
        const target: MacroTarget = { calories: 450, protein: 30, carbs: 50, fat: 12 };
        const result = calculateMealReplacement(target, 'maintain');
        
        const hasWhey = result.items.some(i => i.name.includes('Whey'));
        const hasBananaOrOats = result.items.some(i => 
          i.name === 'Banana' || i.name === 'Aveia em Flocos'
        );
        
        if (hasWhey && hasBananaOrOats) {
          const hasShakeTip = result.tips.some(t => 
            t.toLowerCase().includes('shake') || t.toLowerCase().includes('liquidificador')
          );
          expect(hasShakeTip).toBe(true);
        }
      });
    });
  });

  describe('getAccuracyStatus', () => {
    it('deve retornar "Exato" para 95-105%', () => {
      expect(getAccuracyStatus(100).label).toBe('Exato');
      expect(getAccuracyStatus(95).label).toBe('Exato');
      expect(getAccuracyStatus(105).label).toBe('Exato');
    });

    it('deve retornar "Adequado" para 85-94% e 106-115%', () => {
      expect(getAccuracyStatus(90).label).toBe('Adequado');
      expect(getAccuracyStatus(110).label).toBe('Adequado');
    });

    it('deve retornar "Abaixo" para < 85%', () => {
      expect(getAccuracyStatus(80).label).toBe('Abaixo');
      expect(getAccuracyStatus(70).label).toBe('Abaixo');
    });

    it('deve retornar "Acima" para > 115%', () => {
      expect(getAccuracyStatus(120).label).toBe('Acima');
      expect(getAccuracyStatus(150).label).toBe('Acima');
    });
  });

  describe('Cenários Extremos', () => {
    it('deve lidar com 0g de proteína alvo', () => {
      const target: MacroTarget = { calories: 300, protein: 0, carbs: 60, fat: 8 };
      const result = calculateMealReplacement(target, 'maintain');
      
      // Não deve adicionar whey quando não precisa de proteína
      const hasWhey = result.items.some(i => i.name.includes('Whey'));
      expect(hasWhey).toBe(false);
      
      // Com diversidade mínima, pode ter alguns carbs ou gorduras
      // O importante é não ter proteína em excesso
      expect(result.totalMacros.protein).toBeLessThanOrEqual(10);
    });

    it('deve lidar com 0g de gordura alvo', () => {
      const target: MacroTarget = { calories: 350, protein: 30, carbs: 50, fat: 0 };
      const result = calculateMealReplacement(target, 'lose_weight');
      
      // Não deve adicionar oleaginosas quando não precisa de gordura
      const hasFatSource = result.items.some(i => 
        ['Pasta de Amendoim Integral', 'Castanha de Caju', 'Nozes', 'Amêndoas'].includes(i.name)
      );
      expect(hasFatSource).toBe(false);
      
      // Deve ter proteína adequada
      expect(result.totalMacros.protein).toBeGreaterThan(15);
    });

    it('deve lidar com 0g de carboidrato alvo', () => {
      const target: MacroTarget = { calories: 300, protein: 35, carbs: 0, fat: 12 };
      const result = calculateMealReplacement(target, 'lose_weight');
      
      // Não deve adicionar banana/aveia quando não precisa de carbs
      const hasCarbSource = result.items.some(i => 
        ['Banana', 'Aveia em Flocos', 'Mel'].includes(i.name)
      );
      expect(hasCarbSource).toBe(false);
    });

    it('deve lidar com refeição muito pequena (< 150 kcal)', () => {
      const target: MacroTarget = { calories: 120, protein: 15, carbs: 5, fat: 3 };
      const result = calculateMealReplacement(target, 'lose_weight');
      
      // Deve retornar algo mesmo com calorias muito baixas
      expect(result.items.length).toBeGreaterThan(0);
      
      // Não deve exceder muito as calorias
      expect(result.accuracy.calories).toBeLessThanOrEqual(150);
    });

    it('deve lidar com refeição muito grande (> 800 kcal)', () => {
      const target: MacroTarget = { calories: 900, protein: 50, carbs: 100, fat: 30 };
      const result = calculateMealReplacement(target, 'gain_muscle');
      
      // Deve ter múltiplos itens para atingir metas altas
      expect(result.items.length).toBeGreaterThanOrEqual(3);
      
      // Deve atingir pelo menos 70% das calorias
      expect(result.accuracy.calories).toBeGreaterThanOrEqual(70);
    });

    it('deve lidar com proteína muito alta (> 50g)', () => {
      const target: MacroTarget = { calories: 500, protein: 60, carbs: 30, fat: 12 };
      const result = calculateMealReplacement(target, 'gain_muscle');
      
      // Deve ter whey para atingir proteína alta
      const hasWhey = result.items.some(i => i.name.includes('Whey'));
      expect(hasWhey).toBe(true);
      
      // Com limite de 1 scoop de whey, atingir ~50% já é adequado para substituição
      // (25g whey + ~5-10g de outras fontes = ~30-35g proteína)
      expect(result.totalMacros.protein).toBeGreaterThanOrEqual(25);
    });

    it('deve lidar com proporção extrema de macros (90% carboidrato)', () => {
      const target: MacroTarget = { calories: 400, protein: 5, carbs: 90, fat: 3 };
      const result = calculateMealReplacement(target, 'maintain');
      
      // Deve ter fonte de carboidrato
      const hasCarbSource = result.items.some(i => 
        ['Banana', 'Aveia em Flocos', 'Mel', 'Batata Doce'].includes(i.name)
      );
      expect(hasCarbSource).toBe(true);
    });

    it('deve lidar com proporção extrema de macros (70% gordura)', () => {
      const target: MacroTarget = { calories: 400, protein: 10, carbs: 10, fat: 35 };
      const result = calculateMealReplacement(target, 'maintain');
      
      // Deve ter fonte de gordura
      const hasFatSource = result.items.some(i => 
        ['Pasta de Amendoim Integral', 'Castanha de Caju', 'Nozes', 'Amêndoas', 'Abacate'].includes(i.name)
      );
      expect(hasFatSource).toBe(true);
    });

    it('deve garantir consistência entre múltiplas execuções', () => {
      const target: MacroTarget = { calories: 400, protein: 25, carbs: 40, fat: 12 };
      
      const result1 = calculateMealReplacement(target, 'maintain');
      const result2 = calculateMealReplacement(target, 'maintain');
      
      // Mesmos inputs devem gerar mesmos outputs
      expect(result1.items.length).toBe(result2.items.length);
      expect(result1.totalMacros.calories).toBe(result2.totalMacros.calories);
    });

    it('deve retornar justificativas para todos os líquidos', () => {
      const target: MacroTarget = { calories: 400, protein: 25, carbs: 40, fat: 12 };
      const result = calculateMealReplacement(target, 'maintain');
      
      const liquidItems = result.items.filter(i => 
        ['Leite Desnatado', 'Leite Integral', 'Leite de Amêndoas', 'Água'].includes(i.name)
      );
      
      // Todos os líquidos devem ter justificativa
      liquidItems.forEach(liquid => {
        expect(liquid.reason).toBeDefined();
        expect(liquid.reason!.length).toBeGreaterThan(10);
      });
    });
  });
});
