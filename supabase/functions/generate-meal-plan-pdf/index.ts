import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProfileData {
  name: string | null;
  age: number | null;
  weight: number | null;
  height: number | null;
  goal: string | null;
  daily_calories: number | null;
  protein_target: number | null;
  carbs_target: number | null;
  fat_target: number | null;
  include_supplements: boolean | null;
}

interface FoodData {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface OptionData {
  option_number: number;
  foods: FoodData[];
  total_calories?: number;
  total_protein?: number;
  total_carbs?: number;
  total_fat?: number;
}

interface MealData {
  name: string;
  sort_order: number;
  total_calories: number | null;
  total_protein: number | null;
  total_carbs: number | null;
  total_fat: number | null;
  options: OptionData[];
}

interface PlanData {
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
}

interface SupplementItem {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes?: string;
}

interface SupplementRecommendation {
  mealName: string;
  items: SupplementItem[];
  totalCalories: number;
  totalProtein: number;
}

const GOAL_LABELS: Record<string, string> = {
  lose_weight: "Emagrecimento",
  maintain: "Manutenção",
  gain_muscle: "Ganho de Massa",
};

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Café da Manhã",
  morning_snack: "Lanche Manhã",
  lunch: "Almoço",
  afternoon_snack: "Lanche Tarde",
  dinner: "Jantar",
  supper: "Ceia",
};

const TIPS: Record<string, string[]> = {
  lose_weight: [
    "Priorize proteínas para saciedade",
    "Beba 2L de água/dia",
    "Vegetais verdes à vontade",
  ],
  maintain: [
    "Mantenha horários consistentes",
    "Varie frutas e vegetais",
    "Proteínas preservam massa muscular",
  ],
  gain_muscle: [
    "Distribua proteínas ao longo do dia",
    "Carboidratos complexos = energia",
    "Proteína pós-treino em 2h",
  ],
};

/**
 * Gera HTML para Página 1: Plano Alimentar com opções em colunas
 */
function generateMealPlanPage(
  profile: ProfileData,
  plan: PlanData,
  meals: MealData[],
  generatedAt: string
): string {
  const goalLabel = GOAL_LABELS[profile.goal || "maintain"] || "Manutenção";
  const tips = TIPS[profile.goal || "maintain"] || TIPS.maintain;

  // Determinar número máximo de opções
  const maxOptions = Math.max(...meals.map(m => m.options?.length || 1), 1);
  const colCount = Math.min(maxOptions, 3); // Máximo 3 colunas

  // Gerar HTML das refeições com opções em colunas
  const mealsHtml = meals
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((meal) => {
      const mealLabel = MEAL_LABELS[meal.name] || meal.name;
      
      // Gerar colunas para cada opção
      const optionsColumns = [];
      for (let i = 0; i < colCount; i++) {
        const opt = meal.options[i];
        if (opt) {
          // Calcular totais da opção
          const optTotals = opt.foods.reduce(
            (acc, f) => ({
              calories: acc.calories + f.calories,
              protein: acc.protein + f.protein,
              carbs: acc.carbs + f.carbs,
              fat: acc.fat + f.fat,
            }),
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
          );

          const foodsList = opt.foods
            .map(f => `<div class="food-item"><span class="food-name">${f.name}</span><span class="food-qty">${f.quantity}</span></div>`)
            .join("");

          optionsColumns.push(`
            <div class="opt-col">
              <div class="opt-header">Opção ${opt.option_number}</div>
              <div class="opt-foods">${foodsList}</div>
              <div class="opt-totals">
                <span class="kcal">${optTotals.calories} kcal</span>
                <span class="macros">P:${optTotals.protein}g C:${optTotals.carbs}g G:${optTotals.fat}g</span>
              </div>
            </div>
          `);
        } else {
          // Célula vazia se não há opção
          optionsColumns.push(`<div class="opt-col opt-empty">—</div>`);
        }
      }

      return `
        <div class="meal-row">
          <div class="meal-name">${mealLabel}</div>
          <div class="meal-options" style="grid-template-columns: repeat(${colCount}, 1fr);">
            ${optionsColumns.join("")}
          </div>
        </div>`;
    })
    .join("");

  const tipsHtml = tips.map((tip, i) => `${i + 1}. ${tip}`).join(" · ");

  return `
    <div class="page page-meal-plan">
      <div class="header">
        <h1>🥗 Plano Alimentar</h1>
        <div class="meta">${generatedAt}<br><span class="brand">NutriAI</span></div>
      </div>
      
      <div class="profile">
        <div class="profile-card">
          <div class="profile-label">👤 Usuário</div>
          <div class="profile-content">
            <span class="name">${profile.name || "—"}</span>
            <span class="sep">•</span>
            <span>${profile.age ? `${profile.age} anos` : "—"}</span>
            <span class="sep">•</span>
            <span>${profile.weight ? `${profile.weight} kg` : "—"}</span>
            <span class="sep">•</span>
            <span>${profile.height ? `${profile.height} cm` : "—"}</span>
          </div>
          <span class="goal-badge">${goalLabel}</span>
        </div>
        
        <div class="profile-card">
          <div class="profile-label">🎯 Metas Diárias</div>
          <div><span class="macro-value">${plan.total_calories}</span> <span class="macro-unit">kcal</span></div>
          <div class="macros-summary">
            <span class="p">${plan.total_protein}g P</span>
            <span class="c">${plan.total_carbs}g C</span>
            <span class="g">${plan.total_fat}g G</span>
          </div>
        </div>
      </div>
      
      <div class="meals-section">
        <div class="meals-header-row">
          <div class="header-meal-label">🍽️ Refeições</div>
          <div class="header-options-grid" style="grid-template-columns: repeat(${colCount}, 1fr);">
            ${Array.from({ length: colCount }, (_, i) => `<div class="header-opt-label">Opção ${i + 1}</div>`).join("")}
          </div>
        </div>
        <div class="meals-grid">${mealsHtml}</div>
      </div>
      
      <div class="tips">
        <div class="tips-title">💡 Dicas</div>
        <div class="tips-content">${tipsHtml}</div>
      </div>
      
      <div class="footer"><strong>NutriAI</strong> · nutria-plan-wise.lovable.app · Consulte sempre um nutricionista</div>
    </div>`;
}

/**
 * Gera HTML para Página 2: Suplementação Recomendada
 */
function generateSupplementPage(
  profile: ProfileData,
  supplements: SupplementRecommendation[],
  generatedAt: string
): string {
  const goalLabel = GOAL_LABELS[profile.goal || "maintain"] || "Manutenção";

  const supplementsHtml = supplements
    .map((supp) => {
      const itemsHtml = supp.items
        .map(item => `
          <tr>
            <td>${item.name}</td>
            <td class="tc">${item.quantity}</td>
            <td class="tr">${item.calories}</td>
            <td class="tr">${item.protein}g</td>
            <td class="tr">${item.carbs}g</td>
            <td class="tr">${item.fat}g</td>
          </tr>
        `)
        .join("");

      return `
        <div class="supp-card">
          <div class="supp-header">
            <span class="supp-meal">${supp.mealName}</span>
            <span class="supp-totals">${supp.totalCalories} kcal · ${supp.totalProtein}g proteína</span>
          </div>
          <table class="supp-table">
            <thead>
              <tr>
                <th style="width:35%">Item</th>
                <th style="width:20%" class="tc">Quantidade</th>
                <th style="width:11%" class="tr">Kcal</th>
                <th style="width:11%" class="tr">P</th>
                <th style="width:11%" class="tr">C</th>
                <th style="width:11%" class="tr">G</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div class="supp-tip">
            💧 <strong>Preparo:</strong> Misture os suplementos em pó com 150-200ml de água. Consuma em vez da refeição indicada.
          </div>
        </div>
      `;
    })
    .join("");

  // Gerar HTML para micronutrientes recomendados
  const micronutrientsHtml = `
    <div class="micro-section">
      <div class="micro-title">🧬 Micronutrientes Recomendados</div>
      <div class="micro-grid">
        <div class="micro-card">
          <div class="micro-header">Vitamina D3</div>
          <div class="micro-dose">2000 UI</div>
          <div class="micro-timing">Com gordura (café/almoço)</div>
          <div class="micro-benefit">Imunidade e saúde óssea</div>
        </div>
        <div class="micro-card">
          <div class="micro-header">Ômega-3</div>
          <div class="micro-dose">1000-2000mg</div>
          <div class="micro-timing">Com o jantar</div>
          <div class="micro-benefit">Anti-inflamatório e cardiovascular</div>
        </div>
        <div class="micro-card">
          <div class="micro-header">Magnésio</div>
          <div class="micro-dose">200-400mg</div>
          <div class="micro-timing">Antes de dormir</div>
          <div class="micro-benefit">Relaxamento e sono</div>
        </div>
        <div class="micro-card">
          <div class="micro-header">Multivitamínico</div>
          <div class="micro-dose">1 cápsula</div>
          <div class="micro-timing">Com o café da manhã</div>
          <div class="micro-benefit">Cobertura nutricional geral</div>
        </div>
      </div>
    </div>
  `;

  // Suporte adicional baseado no objetivo
  const supportItems = {
    lose_weight: [
      { name: 'Cafeína', dose: '100-200mg', timing: 'Antes do treino', benefit: 'Aumenta metabolismo' },
      { name: 'Fibras (Psyllium)', dose: '5g', timing: 'Com água, antes das refeições', benefit: 'Saciedade' },
    ],
    maintain: [
      { name: 'Probióticos', dose: 'Conforme rótulo', timing: 'Em jejum', benefit: 'Saúde intestinal' },
    ],
    gain_muscle: [
      { name: 'Creatina Monohidratada', dose: '5g', timing: 'Dose única diária', benefit: 'Força e volume muscular' },
      { name: 'Beta-Alanina', dose: '2-4g', timing: 'Pré-treino', benefit: 'Resistência muscular' },
    ],
  };

  const goalSupports = supportItems[profile.goal as keyof typeof supportItems] || supportItems.maintain;
  const supportHtml = `
    <div class="support-section">
      <div class="support-title">💪 Suporte para ${goalLabel}</div>
      <div class="support-grid">
        ${goalSupports.map(s => `
          <div class="support-card">
            <div class="support-name">${s.name}</div>
            <div class="support-details">
              <span class="support-dose">${s.dose}</span>
              <span class="support-timing">${s.timing}</span>
            </div>
            <div class="support-benefit">${s.benefit}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  return `
    <div class="page page-supplements">
      <div class="header">
        <h1>💊 Suplementação Recomendada</h1>
        <div class="meta">${generatedAt}<br><span class="brand">NutriAI</span></div>
      </div>
      
      <div class="supp-intro">
        <div class="supp-intro-card">
          <div class="intro-icon">⚠️</div>
          <div class="intro-text">
            <strong>Alternativas de Refeição</strong>
            <p>Use estas opções EM VEZ da refeição planejada quando não conseguir consumir a refeição original. Os valores nutricionais são equivalentes.</p>
          </div>
        </div>
        <div class="goal-indicator">
          Objetivo: <span class="goal-badge">${goalLabel}</span>
        </div>
      </div>
      
      <div class="supp-section">
        ${supplements.length > 0 ? supplementsHtml : '<p class="no-supp">Nenhuma alternativa de refeição para este plano.</p>'}
      </div>
      
      ${micronutrientsHtml}
      
      ${supportHtml}
      
      <div class="supp-notes">
        <div class="note-title">📋 Observações Importantes</div>
        <ul>
          <li>Suplementos são <strong>complementos</strong>, não substituem uma alimentação equilibrada.</li>
          <li>Whey protein: ideal para situações onde não é possível consumir proteína de alimentos sólidos.</li>
          <li>Aveia: fonte de carboidratos complexos, fibras e energia sustentada.</li>
          <li>Consulte um profissional antes de iniciar qualquer suplementação.</li>
        </ul>
      </div>
      
      <div class="footer"><strong>NutriAI</strong> · nutria-plan-wise.lovable.app · Consulte sempre um nutricionista</div>
    </div>`;
}

/**
 * Gera o documento PDF completo (1 ou 2 páginas)
 */
function generateExecutivePdf(
  profile: ProfileData,
  plan: PlanData,
  meals: MealData[],
  supplements: SupplementRecommendation[],
  generatedAt: string,
  showSupplements: boolean
): string {
  const page1 = generateMealPlanPage(profile, plan, meals, generatedAt);
  const page2 = showSupplements && supplements.length > 0 
    ? generateSupplementPage(profile, supplements, generatedAt) 
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { 
      size: 210mm 297mm; 
      margin: 0; 
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { 
      margin: 0; 
      padding: 0;
      font-family: 'Segoe UI', -apple-system, sans-serif;
      font-size: 8pt;
      line-height: 1.3;
      color: #1f2937;
      background: #fff;
    }
    
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 8mm 10mm;
      page-break-after: always;
      display: flex;
      flex-direction: column;
    }
    .page:last-child { page-break-after: auto; }
    
    /* Header */
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      padding-bottom: 6px; 
      margin-bottom: 8px; 
      border-bottom: 2px solid #3b82f6;
    }
    .header h1 { font-size: 14pt; font-weight: 700; }
    .header .meta { text-align: right; font-size: 7pt; color: #6b7280; }
    .header .brand { font-weight: 600; color: #3b82f6; }
    
    /* Profile section */
    .profile { 
      display: flex; 
      gap: 8px; 
      margin-bottom: 8px;
    }
    .profile-card { 
      flex: 1; 
      background: #f8fafc; 
      border-radius: 5px; 
      padding: 6px 8px; 
      border: 1px solid #e2e8f0; 
    }
    .profile-label { 
      font-size: 6pt; 
      color: #6b7280; 
      text-transform: uppercase; 
      letter-spacing: 0.03em; 
      font-weight: 600; 
      margin-bottom: 3px; 
    }
    .profile-content { 
      font-size: 7pt; 
      display: flex; 
      flex-wrap: wrap; 
      gap: 3px; 
      align-items: center; 
    }
    .profile-content .name { font-weight: 700; font-size: 8pt; }
    .profile-content .sep { color: #cbd5e1; }
    .goal-badge { 
      background: #3b82f6; 
      color: #fff; 
      padding: 2px 6px; 
      border-radius: 10px; 
      font-size: 6pt; 
      font-weight: 600; 
      display: inline-block; 
    }
    .macro-value { font-size: 16pt; font-weight: 800; color: #f59e0b; }
    .macro-unit { font-size: 8pt; color: #6b7280; }
    .macros-summary { display: flex; gap: 8px; font-size: 7pt; margin-top: 2px; }
    .macros-summary span { font-weight: 700; }
    .macros-summary .p { color: #3b82f6; }
    .macros-summary .c { color: #eab308; }
    .macros-summary .g { color: #f97316; }
    
    /* Meals section - columnar layout */
    .meals-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .meals-header-row {
      display: flex;
      margin-bottom: 4px;
      padding-bottom: 3px;
      border-bottom: 1px solid #e2e8f0;
    }
    .header-meal-label { 
      width: 80px;
      min-width: 80px;
      font-size: 9pt; 
      font-weight: 700;
      display: flex;
      align-items: center;
    }
    .header-options-grid {
      flex: 1;
      display: grid;
      gap: 1px;
    }
    .header-opt-label {
      text-align: center;
      font-size: 7pt;
      font-weight: 600;
      color: #3b82f6;
      background: #eff6ff;
      padding: 3px 6px;
      border-radius: 4px;
    }
    .meals-grid { 
      flex: 1;
      display: flex; 
      flex-direction: column; 
      gap: 3px;
    }
    
    /* Meal row */
    .meal-row { 
      display: flex;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
      flex: 1;
    }
    .meal-name { 
      width: 80px;
      min-width: 80px;
      background: linear-gradient(135deg, #3b82f6, #2563eb); 
      color: #fff; 
      padding: 4px 6px; 
      font-size: 7pt; 
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .meal-options {
      flex: 1;
      display: grid;
      gap: 1px;
      background: #e2e8f0;
    }
    
    /* Option column */
    .opt-col {
      background: #fff;
      padding: 3px 5px;
      display: flex;
      flex-direction: column;
    }
    .opt-col.opt-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #cbd5e1;
      font-size: 7pt;
    }
    .opt-header {
      font-size: 6pt;
      font-weight: 600;
      color: #6b7280;
      margin-bottom: 2px;
      text-align: center;
      display: none; /* Hidden since we have legend */
    }
    .opt-foods {
      flex: 1;
      font-size: 6.5pt;
    }
    .food-item {
      display: flex;
      justify-content: space-between;
      gap: 4px;
      padding: 1px 0;
      border-bottom: 1px dotted #f1f5f9;
    }
    .food-item:last-child { border-bottom: none; }
    .food-name { 
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .food-qty { 
      color: #6b7280; 
      font-size: 6pt;
      white-space: nowrap;
    }
    .opt-totals {
      margin-top: 2px;
      padding-top: 2px;
      border-top: 1px solid #e2e8f0;
      font-size: 6pt;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .opt-totals .kcal {
      font-weight: 700;
      color: #f59e0b;
    }
    .opt-totals .macros {
      color: #6b7280;
      font-size: 5.5pt;
    }
    
    /* Tips */
    .tips { 
      background: #fffbeb; 
      border-radius: 4px; 
      padding: 5px 8px; 
      border-left: 3px solid #f59e0b; 
      margin-top: 6px;
    }
    .tips-title { font-weight: 700; color: #92400e; font-size: 7pt; margin-bottom: 2px; }
    .tips-content { font-size: 6pt; color: #78350f; line-height: 1.4; }
    
    /* Footer */
    .footer { 
      text-align: center; 
      padding-top: 6px; 
      margin-top: 6px;
      border-top: 1px solid #e2e8f0; 
      font-size: 6pt; 
      color: #9ca3af;
    }
    
    /* ============ PAGE 2: SUPPLEMENTS ============ */
    .page-supplements {
      background: linear-gradient(180deg, #faf5ff 0%, #fff 100%);
      max-height: 297mm;
      overflow: hidden;
    }
    .page-supplements .header {
      border-bottom-color: #8b5cf6;
    }
    .page-supplements .header h1 { color: #7c3aed; }
    
    .supp-intro {
      display: flex;
      gap: 8px;
      margin-bottom: 6px;
    }
    .supp-intro-card {
      flex: 1;
      display: flex;
      gap: 6px;
      background: #fef3c7;
      border: 1px solid #fcd34d;
      border-radius: 5px;
      padding: 5px 8px;
    }
    .intro-icon { font-size: 12pt; }
    .intro-text strong { font-size: 7pt; color: #92400e; }
    .intro-text p { font-size: 6pt; color: #78350f; margin-top: 1px; line-height: 1.2; }
    .goal-indicator {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 6pt;
      color: #6b7280;
    }
    .goal-indicator .goal-badge {
      background: #8b5cf6;
    }
    
    .supp-section {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    .supp-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 5px;
      margin-bottom: 5px;
      overflow: hidden;
    }
    .supp-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #8b5cf6, #7c3aed);
      color: #fff;
      padding: 4px 8px;
    }
    .supp-meal { font-weight: 700; font-size: 7pt; }
    .supp-totals { font-size: 6pt; opacity: 0.9; }
    
    .supp-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 6pt;
    }
    .supp-table thead tr { background: #f8fafc; }
    .supp-table th {
      padding: 2px 4px;
      text-align: left;
      font-weight: 600;
      font-size: 5.5pt;
      text-transform: uppercase;
      color: #6b7280;
    }
    .supp-table td {
      padding: 2px 4px;
      border-bottom: 1px solid #f1f5f9;
    }
    .tc { text-align: center; }
    .tr { text-align: right; }
    
    .supp-tip {
      padding: 3px 6px;
      background: #f0fdf4;
      border-top: 1px solid #bbf7d0;
      font-size: 5.5pt;
      color: #166534;
    }
    
    .supp-notes {
      background: #f8fafc;
      border-radius: 5px;
      padding: 6px 8px;
      margin-top: 6px;
    }
    .note-title { font-weight: 700; font-size: 7pt; margin-bottom: 3px; }
    .supp-notes ul {
      list-style: none;
      font-size: 6pt;
      color: #4b5563;
      columns: 2;
      column-gap: 12px;
    }
    .supp-notes li {
      padding: 1px 0;
      padding-left: 10px;
      position: relative;
      break-inside: avoid;
    }
    .supp-notes li::before {
      content: "•";
      position: absolute;
      left: 0;
      color: #8b5cf6;
    }
    
    .no-supp {
      text-align: center;
      padding: 12px;
      color: #9ca3af;
      font-size: 8pt;
    }
    
    /* Micronutrientes - Compacto */
    .micro-section {
      margin-top: 6px;
      margin-bottom: 6px;
    }
    .micro-title {
      font-size: 8pt;
      font-weight: 700;
      color: #7c3aed;
      margin-bottom: 4px;
      text-align: center;
    }
    .micro-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 5px;
    }
    .micro-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 4px 5px;
      text-align: center;
    }
    .micro-header {
      font-size: 6pt;
      font-weight: 700;
      color: #374151;
      margin-bottom: 2px;
    }
    .micro-dose {
      font-size: 8pt;
      font-weight: 800;
      color: #8b5cf6;
      margin-bottom: 1px;
    }
    .micro-timing {
      font-size: 5pt;
      color: #6b7280;
      margin-bottom: 2px;
    }
    .micro-benefit {
      font-size: 5pt;
      color: #059669;
      background: #ecfdf5;
      padding: 1px 3px;
      border-radius: 2px;
    }
    
    /* Suporte por objetivo - Compacto */
    .support-section {
      margin-top: 6px;
      margin-bottom: 6px;
    }
    .support-title {
      font-size: 8pt;
      font-weight: 700;
      color: #7c3aed;
      margin-bottom: 4px;
      text-align: center;
    }
    .support-grid {
      display: flex;
      justify-content: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .support-card {
      background: linear-gradient(135deg, #f3e8ff, #fff);
      border: 1px solid #c4b5fd;
      border-radius: 4px;
      padding: 5px 8px;
      min-width: 120px;
      text-align: center;
    }
    .support-name {
      font-size: 6.5pt;
      font-weight: 700;
      color: #6d28d9;
      margin-bottom: 2px;
    }
    .support-details {
      display: flex;
      flex-direction: column;
      gap: 1px;
      margin-bottom: 2px;
    }
    .support-dose {
      font-size: 7pt;
      font-weight: 800;
      color: #7c3aed;
    }
    .support-timing {
      font-size: 5pt;
      color: #6b7280;
    }
    .support-benefit {
      font-size: 5pt;
      color: #059669;
      background: #ecfdf5;
      padding: 1px 4px;
      border-radius: 2px;
    }
    
    @media print {
      html, body { width: 210mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { overflow: hidden; }
    }
  </style>
</head>
<body>
  ${page1}
  ${page2}
</body>
</html>`;
}

/**
 * Calcula suplementação recomendada para cada refeição
 * Usa lógica simplificada baseada nos macros da refeição
 */
function calculateSupplementRecommendations(
  meals: MealData[],
  goal: string
): SupplementRecommendation[] {
  const recommendations: SupplementRecommendation[] = [];

  for (const meal of meals) {
    const mealLabel = MEAL_LABELS[meal.name] || meal.name;
    const targetCalories = meal.total_calories || 0;
    const targetProtein = meal.total_protein || 0;

    // Só gerar suplementação para refeições com calorias significativas
    if (targetCalories < 150) continue;

    const items: SupplementItem[] = [];
    let totalCal = 0;
    let totalProt = 0;

    // 1. Whey protein para atingir meta proteica
    if (targetProtein >= 15) {
      const wheyType = goal === 'lose_weight' ? 'Whey Protein Isolado' : 'Whey Protein Concentrado';
      const wheyProtein = goal === 'lose_weight' ? 25 : 24;
      const wheyCal = goal === 'lose_weight' ? 120 : 130;
      
      // Calcular porções (máx 1.5 scoops)
      const scoopsNeeded = Math.min(1.5, Math.max(0.5, targetProtein * 0.9 / wheyProtein));
      const roundedScoops = Math.round(scoopsNeeded * 2) / 2;
      const grams = Math.round(30 * roundedScoops);
      
      items.push({
        name: wheyType,
        quantity: `${grams}g`,
        calories: Math.round(wheyCal * roundedScoops),
        protein: Math.round(wheyProtein * roundedScoops),
        carbs: goal === 'lose_weight' ? Math.round(2 * roundedScoops) : Math.round(4 * roundedScoops),
        fat: goal === 'lose_weight' ? Math.round(1 * roundedScoops) : Math.round(2 * roundedScoops),
      });
      totalCal += Math.round(wheyCal * roundedScoops);
      totalProt += Math.round(wheyProtein * roundedScoops);
    }

    // 2. Aveia para carboidratos
    const targetCarbs = meal.total_carbs || 0;
    if (targetCarbs >= 20 && totalCal < targetCalories * 0.9) {
      const oatScale = Math.min(1.5, (targetCalories - totalCal) / 150);
      if (oatScale >= 0.5) {
        const roundedScale = Math.round(oatScale * 2) / 2;
        const grams = Math.round(40 * roundedScale);
        items.push({
          name: 'Aveia em Flocos',
          quantity: `${grams}g`,
          calories: Math.round(150 * roundedScale),
          protein: Math.round(5 * roundedScale),
          carbs: Math.round(27 * roundedScale),
          fat: Math.round(3 * roundedScale),
        });
        totalCal += Math.round(150 * roundedScale);
        totalProt += Math.round(5 * roundedScale);
      }
    }

    // 3. Banana para completar calorias
    if (totalCal < targetCalories * 0.85) {
      const bananaScale = Math.min(2, (targetCalories - totalCal) / 90);
      if (bananaScale >= 0.5) {
        const roundedScale = Math.round(bananaScale * 2) / 2;
        let qty = '';
        if (roundedScale === 0.5) qty = '½ banana (50g)';
        else if (roundedScale === 1) qty = '1 banana (100g)';
        else if (roundedScale === 1.5) qty = '1½ banana (150g)';
        else qty = `${roundedScale} bananas (${Math.round(100 * roundedScale)}g)`;
        
        items.push({
          name: 'Banana',
          quantity: qty,
          calories: Math.round(90 * roundedScale),
          protein: Math.round(1 * roundedScale),
          carbs: Math.round(23 * roundedScale),
          fat: 0,
        });
        totalCal += Math.round(90 * roundedScale);
      }
    }

    // 4. Água (sempre adicionar se tem suplementos)
    if (items.length > 0) {
      items.push({
        name: 'Água',
        quantity: '150-200ml',
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        notes: 'Base para shake',
      });
    }

    if (items.length > 0) {
      recommendations.push({
        mealName: mealLabel,
        items,
        totalCalories: totalCal,
        totalProtein: totalProt,
      });
    }
  }

  return recommendations;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { studentId, dietPlanId } = body;

    let targetUserId = studentId || user.id;
    if (studentId && studentId !== user.id) {
      const { data: studentLink } = await supabase
        .from("professional_students")
        .select("id")
        .eq("professional_id", user.id)
        .eq("student_id", studentId)
        .eq("status", "active")
        .single();

      if (!studentLink) {
        return new Response(JSON.stringify({ error: "Sem permissão" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Buscar perfil com flag de suplementos
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name, age, weight, height, goal, daily_calories, protein_target, carbs_target, fat_target, include_supplements")
      .eq("user_id", targetUserId)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Perfil não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar se usuário é pago
    const { data: userPlan } = await supabase.rpc("get_user_plan", { _user_id: targetUserId });
    const isPaidUser = userPlan?.[0]?.plan_type && userPlan[0].plan_type !== 'gratuito';

    let planId = dietPlanId;
    if (!planId) {
      const { data: activePlan } = await supabase
        .from("diet_plans")
        .select("id")
        .eq("user_id", targetUserId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!activePlan) {
        return new Response(JSON.stringify({ error: "Nenhum plano ativo encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      planId = activePlan.id;
    }

    const { data: plan, error: planError } = await supabase
      .from("diet_plans")
      .select("total_calories, total_protein, total_carbs, total_fat")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: "Plano não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: mealsData, error: mealsError } = await supabase
      .from("meals")
      .select(`
        id,
        name,
        sort_order,
        total_calories,
        total_protein,
        total_carbs,
        total_fat,
        meal_options (
          id,
          option_number,
          meal_option_foods (
            quantity_grams,
            display_quantity,
            display_unit,
            food:foods (
              name,
              calories,
              protein,
              carbs,
              fat
            )
          )
        )
      `)
      .eq("diet_plan_id", planId)
      .order("sort_order");

    if (mealsError) {
      console.error("Meals error:", mealsError);
      return new Response(JSON.stringify({ error: "Erro ao buscar refeições" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const meals: MealData[] = (mealsData || []).map((meal: any) => ({
      name: meal.name,
      sort_order: meal.sort_order,
      total_calories: meal.total_calories,
      total_protein: meal.total_protein,
      total_carbs: meal.total_carbs,
      total_fat: meal.total_fat,
      options: (meal.meal_options || [])
        .sort((a: any, b: any) => a.option_number - b.option_number)
        .map((opt: any) => ({
          option_number: opt.option_number,
          foods: (opt.meal_option_foods || []).map((mof: any) => {
            const food = mof.food;
            const grams = mof.quantity_grams || 0;
            const factor = grams / 100;
            
            let quantity = `${Math.round(grams)}g`;
            if (mof.display_quantity && mof.display_unit) {
              const displayQty = Number.isInteger(mof.display_quantity) 
                ? mof.display_quantity 
                : Number(mof.display_quantity).toFixed(1);
              quantity = `${displayQty} ${mof.display_unit} (${Math.round(grams)}g)`;
            }

            return {
              name: food?.name || "Alimento",
              quantity,
              calories: Math.round((food?.calories || 0) * factor),
              protein: Math.round((food?.protein || 0) * factor),
              carbs: Math.round((food?.carbs || 0) * factor),
              fat: Math.round((food?.fat || 0) * factor),
            };
          }),
        })),
    }));

    // Gerar recomendações de suplementação
    const showSupplements = isPaidUser && profile.include_supplements === true;
    const supplements = showSupplements 
      ? calculateSupplementRecommendations(meals, profile.goal || 'maintain')
      : [];

    const generatedAt = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const html = generateExecutivePdf(profile, plan, meals, supplements, generatedAt, showSupplements);

    return new Response(JSON.stringify({ html }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error generating PDF:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
