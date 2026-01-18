import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PdfReportData {
  studentName: string;
  planName: string;
  goal: string;
  periodStart: string;
  periodEnd: string;
  overallAdherence: number;
  mealAdherence: Record<string, { rate: number; confirmed: number; total: number }>;
  exceptionStates: {
    confirmed: number;
    skipped: number;
    outOfPlan: number;
    pending: number;
    late: number;
  };
  insights: string[];
  suggestions: string[];
  hypotheses?: string[];
  comparison?: {
    previousPeriod: { rate: number; label: string };
    currentPeriod: { rate: number; label: string };
  };
  generatedAt: string;
  planType: 'gratuito' | 'premium' | 'plano_pessoal_pago' | 'profissional';
}

// Simple PDF generator using text positioning
function generatePdfContent(data: PdfReportData): string {
  const {
    studentName,
    planName,
    goal,
    periodStart,
    periodEnd,
    overallAdherence,
    mealAdherence,
    exceptionStates,
    insights,
    suggestions,
    hypotheses,
    comparison,
    generatedAt,
    planType,
  } = data;

  const showCharts = ['premium', 'plano_pessoal_pago', 'profissional'].includes(planType);
  const showInsights = ['plano_pessoal_pago', 'profissional'].includes(planType);
  const showComparison = ['plano_pessoal_pago', 'profissional'].includes(planType) && comparison;
  const showSuggestions = ['plano_pessoal_pago', 'profissional'].includes(planType);
  const showHypotheses = planType === 'profissional';

  // Build HTML content for PDF
  const goalLabel = goal === 'cut' ? 'Emagrecimento' : goal === 'bulk' ? 'Ganho de Massa' : 'Manutenção';
  
  const mealEntries = Object.entries(mealAdherence);
  const mealBarsHtml = mealEntries.map(([name, data]) => {
    const barWidth = Math.max(5, data.rate);
    const color = data.rate >= 80 ? '#22c55e' : data.rate >= 60 ? '#eab308' : '#ef4444';
    return `
      <div style="display: flex; align-items: center; margin-bottom: 6px; font-size: 9pt;">
        <span style="width: 80px; flex-shrink: 0;">${name}</span>
        <div style="flex: 1; background: #e5e7eb; height: 14px; border-radius: 2px; margin: 0 8px;">
          <div style="width: ${barWidth}%; background: ${color}; height: 100%; border-radius: 2px;"></div>
        </div>
        <span style="width: 40px; text-align: right;">${data.rate}%</span>
      </div>
    `;
  }).join('');

  const totalExceptions = exceptionStates.skipped + exceptionStates.outOfPlan + exceptionStates.pending + exceptionStates.late;
  const exceptionData = [
    { name: 'Confirmadas', value: exceptionStates.confirmed, color: '#22c55e' },
    { name: 'Puladas', value: exceptionStates.skipped, color: '#ef4444' },
    { name: 'Fora do Plano', value: exceptionStates.outOfPlan, color: '#f97316' },
    { name: 'Pendentes', value: exceptionStates.pending, color: '#6b7280' },
    { name: 'Tardias', value: exceptionStates.late, color: '#8b5cf6' },
  ].filter(e => e.value > 0);

  const total = exceptionData.reduce((sum, e) => sum + e.value, 0);
  const exceptionBarsHtml = exceptionData.map(e => {
    const pct = total > 0 ? Math.round(e.value / total * 100) : 0;
    return `
      <div style="display: flex; align-items: center; margin-bottom: 4px; font-size: 9pt;">
        <span style="width: 10px; height: 10px; background: ${e.color}; border-radius: 2px; margin-right: 6px;"></span>
        <span style="width: 90px;">${e.name}</span>
        <span style="width: 30px; text-align: right;">${e.value}</span>
        <span style="width: 40px; text-align: right; color: #6b7280;">(${pct}%)</span>
      </div>
    `;
  }).join('');

  const adherenceColor = overallAdherence >= 80 ? '#22c55e' : overallAdherence >= 60 ? '#eab308' : '#ef4444';
  
  const insightsHtml = showInsights && insights.length > 0 ? `
    <div style="margin-top: 12px;">
      <h4 style="font-size: 10pt; font-weight: 600; margin-bottom: 6px; color: #374151;">📊 Insights Automáticos</h4>
      <ul style="font-size: 9pt; color: #4b5563; margin: 0; padding-left: 16px;">
        ${insights.map(i => `<li style="margin-bottom: 3px;">${i}</li>`).join('')}
      </ul>
    </div>
  ` : '';

  const comparisonHtml = showComparison && comparison ? `
    <div style="margin-top: 12px;">
      <h4 style="font-size: 10pt; font-weight: 600; margin-bottom: 6px; color: #374151;">📈 Comparativo de Períodos</h4>
      <div style="display: flex; gap: 16px; font-size: 9pt;">
        <div style="flex: 1;">
          <div style="color: #6b7280; margin-bottom: 2px;">${comparison.previousPeriod.label}</div>
          <div style="background: #e5e7eb; height: 20px; border-radius: 3px; position: relative;">
            <div style="width: ${comparison.previousPeriod.rate}%; background: #9ca3af; height: 100%; border-radius: 3px;"></div>
            <span style="position: absolute; right: 4px; top: 2px; font-size: 8pt;">${comparison.previousPeriod.rate}%</span>
          </div>
        </div>
        <div style="flex: 1;">
          <div style="color: #6b7280; margin-bottom: 2px;">${comparison.currentPeriod.label}</div>
          <div style="background: #e5e7eb; height: 20px; border-radius: 3px; position: relative;">
            <div style="width: ${comparison.currentPeriod.rate}%; background: #3b82f6; height: 100%; border-radius: 3px;"></div>
            <span style="position: absolute; right: 4px; top: 2px; font-size: 8pt;">${comparison.currentPeriod.rate}%</span>
          </div>
        </div>
      </div>
    </div>
  ` : '';

  const suggestionsHtml = showSuggestions && suggestions.length > 0 ? `
    <div style="margin-top: 12px;">
      <h4 style="font-size: 10pt; font-weight: 600; margin-bottom: 6px; color: #374151;">💡 Sugestões</h4>
      <ul style="font-size: 9pt; color: #4b5563; margin: 0; padding-left: 16px;">
        ${suggestions.map(s => `<li style="margin-bottom: 3px;">${s}</li>`).join('')}
      </ul>
    </div>
  ` : '';

  const hypothesesHtml = showHypotheses && hypotheses && hypotheses.length > 0 ? `
    <div style="margin-top: 8px; padding: 8px; background: #f3f4f6; border-radius: 4px;">
      <h5 style="font-size: 9pt; font-weight: 600; margin-bottom: 4px; color: #1f2937;">Hipóteses Técnicas</h5>
      <ul style="font-size: 8pt; color: #4b5563; margin: 0; padding-left: 14px;">
        ${hypotheses.map(h => `<li style="margin-bottom: 2px;">${h}</li>`).join('')}
      </ul>
    </div>
  ` : '';

  const chartsHtml = showCharts ? `
    <div style="display: flex; gap: 16px; margin-top: 12px;">
      <div style="flex: 1;">
        <h4 style="font-size: 10pt; font-weight: 600; margin-bottom: 8px; color: #374151;">Adesão por Refeição</h4>
        ${mealBarsHtml}
      </div>
      <div style="flex: 1;">
        <h4 style="font-size: 10pt; font-weight: 600; margin-bottom: 8px; color: #374151;">Estados de Registro</h4>
        ${exceptionBarsHtml}
      </div>
    </div>
  ` : '';

  const summaryLine = `
    <div style="display: flex; justify-content: space-around; margin-top: 12px; padding: 10px; background: #f9fafb; border-radius: 4px; font-size: 9pt;">
      <div style="text-align: center;">
        <div style="font-size: 16pt; font-weight: 700; color: #22c55e;">${exceptionStates.confirmed}</div>
        <div style="color: #6b7280;">Confirmadas</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 16pt; font-weight: 700; color: #ef4444;">${exceptionStates.skipped}</div>
        <div style="color: #6b7280;">Puladas</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 16pt; font-weight: 700; color: #f97316;">${exceptionStates.outOfPlan}</div>
        <div style="color: #6b7280;">Fora do Plano</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 16pt; font-weight: 700; color: #6b7280;">${exceptionStates.pending}</div>
        <div style="color: #6b7280;">Pendentes</div>
      </div>
    </div>
  `;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 20mm 15mm; }
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #1f2937;
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 16px;">
    <h1 style="font-size: 16pt; font-weight: 700; color: #1f2937; margin: 0;">Relatório de Adesão Alimentar</h1>
    <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 9pt; color: #4b5563;">
      <div>
        <strong>Aluno:</strong> ${studentName}<br>
        <strong>Plano:</strong> ${planName}
      </div>
      <div style="text-align: right;">
        <strong>Objetivo:</strong> ${goalLabel}<br>
        <strong>Período:</strong> ${periodStart} a ${periodEnd}
      </div>
    </div>
  </div>

  <!-- KPI Central -->
  <div style="text-align: center; margin-bottom: 16px;">
    <div style="font-size: 36pt; font-weight: 800; color: ${adherenceColor};">${overallAdherence}%</div>
    <div style="font-size: 10pt; color: #6b7280; margin-bottom: 8px;">Adesão Geral ao Plano</div>
    <div style="background: #e5e7eb; height: 10px; border-radius: 5px; max-width: 300px; margin: 0 auto;">
      <div style="width: ${overallAdherence}%; background: ${adherenceColor}; height: 100%; border-radius: 5px;"></div>
    </div>
  </div>

  <!-- Charts (conditional) -->
  ${chartsHtml}

  <!-- Summary Line -->
  ${summaryLine}

  <!-- Insights (conditional) -->
  ${insightsHtml}

  <!-- Comparison (conditional) -->
  ${comparisonHtml}

  <!-- Suggestions (conditional) -->
  ${suggestionsHtml}
  ${hypothesesHtml}

  <!-- Footer -->
  <div style="margin-top: 20px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 8pt; color: #9ca3af;">
    <div style="display: flex; justify-content: space-between;">
      <div>
        <div>Data de geração: ${generatedAt}</div>
        <div>Baseado exclusivamente em registros reais de consumo</div>
      </div>
      <div style="text-align: right;">
        Documento gerado automaticamente pelo sistema
      </div>
    </div>
  </div>
</body>
</html>
  `;

  return html;
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
    const { studentId, dietPlanId, periodStart, periodEnd } = body;

    console.log("Generating PDF report for:", { studentId, dietPlanId, periodStart, periodEnd });

    // Verify professional access if viewing student data
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

    // Get student profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, goal")
      .eq("user_id", targetUserId)
      .single();

    // Get user's plan type
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plans(name)")
      .eq("user_id", studentId ? user.id : targetUserId)
      .in("status", ["active", "trial"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const planName = (subscription?.plans as any)?.name || "gratuito";
    const planType = planName as 'gratuito' | 'premium' | 'plano_pessoal_pago' | 'profissional';

    // Get diet plan
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

    const startDate = periodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = periodEnd || new Date().toISOString().split('T')[0];

    // Calculate metrics
    const { data: metrics, error: metricsError } = await supabase.rpc(
      "calculate_adherence_metrics",
      {
        _user_id: targetUserId,
        _diet_plan_id: planId,
        _period_start: startDate,
        _period_end: endDate,
      }
    );

    if (metricsError) {
      console.error("Metrics error:", metricsError);
      return new Response(JSON.stringify({ error: "Erro ao calcular métricas" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get meals for adherence by meal
    const { data: meals } = await supabase
      .from("meals")
      .select("id, name")
      .eq("diet_plan_id", planId);

    // Get daily logs
    const { data: dailyLogs } = await supabase
      .from("daily_logs")
      .select(`
        *,
        meal_logs (*)
      `)
      .eq("user_id", targetUserId)
      .eq("diet_plan_id", planId)
      .gte("log_date", startDate)
      .lte("log_date", endDate);

    // Build meal adherence
    const mealAdherence: Record<string, { rate: number; confirmed: number; total: number }> = {};
    const adherenceByMeal = metrics?.adherence_by_meal || {};
    
    if (meals) {
      for (const meal of meals) {
        const mealData = adherenceByMeal[meal.name];
        mealAdherence[meal.name] = {
          rate: mealData?.rate || 0,
          confirmed: mealData?.confirmed || 0,
          total: mealData?.total || 0,
        };
      }
    }

    // Calculate exception states
    let confirmed = 0;
    let skipped = 0;
    let outOfPlan = 0;
    let pending = 0;
    let late = 0;

    if (dailyLogs) {
      for (const log of dailyLogs) {
        for (const ml of log.meal_logs || []) {
          switch (ml.status) {
            case 'CONFIRMADA': confirmed++; break;
            case 'CONFIRMADA_TARDIA': late++; confirmed++; break;
            case 'PULADA': skipped++; break;
            case 'FORA_DO_PLANO': outOfPlan++; break;
            case 'PENDENTE': pending++; break;
          }
        }
      }
    }

    // Generate insights based on data
    const insights: string[] = [];
    const adherenceRate = metrics?.adherence_rate || 0;

    if (adherenceRate >= 90) {
      insights.push("Adesão excelente no período analisado.");
    } else if (adherenceRate >= 70) {
      insights.push("Adesão satisfatória com espaço para melhoria.");
    } else if (adherenceRate < 50) {
      insights.push("Adesão abaixo do esperado - necessita atenção.");
    }

    if (skipped > confirmed * 0.3) {
      insights.push(`${skipped} refeições puladas representam mais de 30% do total.`);
    }

    if (outOfPlan > 5) {
      insights.push(`${outOfPlan} refeições foram registradas fora do plano.`);
    }

    // Find best and worst meals
    const mealRates = Object.entries(mealAdherence).map(([name, data]) => ({ name, rate: data.rate }));
    if (mealRates.length > 0) {
      const bestMeal = mealRates.reduce((a, b) => a.rate > b.rate ? a : b);
      const worstMeal = mealRates.reduce((a, b) => a.rate < b.rate ? a : b);
      if (bestMeal.rate > worstMeal.rate + 20) {
        insights.push(`${bestMeal.name} tem melhor adesão (${bestMeal.rate}%) enquanto ${worstMeal.name} precisa de atenção (${worstMeal.rate}%).`);
      }
    }

    // Generate suggestions
    const suggestions: string[] = [];
    const hypotheses: string[] = [];

    if (skipped > 3) {
      suggestions.push("Tente preparar lanches rápidos para os dias mais corridos.");
      if (planType === 'profissional') {
        hypotheses.push("Possível conflito de horários ou baixa saciedade das refeições anteriores.");
      }
    }

    if (outOfPlan > 3) {
      suggestions.push("Considere adicionar opções mais variadas ao plano.");
      if (planType === 'profissional') {
        hypotheses.push("O plano pode não estar alinhado com preferências alimentares reais.");
      }
    }

    if (late > 2) {
      suggestions.push("Ative lembretes para registrar as refeições no momento do consumo.");
      if (planType === 'profissional') {
        hypotheses.push("Falta de rotina estabelecida ou dificuldade de acesso ao aplicativo.");
      }
    }

    if (adherenceRate < 60) {
      suggestions.push("Foque em uma refeição por vez para melhorar gradualmente.");
      if (planType === 'profissional') {
        hypotheses.push("Plano pode estar complexo demais para a rotina atual do paciente.");
      }
    }

    // Check for previous period comparison
    let comparison;
    const periodDays = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    const prevEndDate = new Date(new Date(startDate).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const prevStartDate = new Date(new Date(prevEndDate).getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: prevMetrics } = await supabase.rpc(
      "calculate_adherence_metrics",
      {
        _user_id: targetUserId,
        _diet_plan_id: planId,
        _period_start: prevStartDate,
        _period_end: prevEndDate,
      }
    );

    if (prevMetrics && prevMetrics.days_with_records > 0) {
      comparison = {
        previousPeriod: {
          rate: Math.round(prevMetrics.adherence_rate || 0),
          label: `${prevStartDate} a ${prevEndDate}`,
        },
        currentPeriod: {
          rate: Math.round(adherenceRate),
          label: `${startDate} a ${endDate}`,
        },
      };
    }

    const now = new Date();
    const generatedAt = now.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const reportData: PdfReportData = {
      studentName: profile?.name || "Não informado",
      planName: planName,
      goal: profile?.goal || "manutenção",
      periodStart: startDate,
      periodEnd: endDate,
      overallAdherence: Math.round(adherenceRate),
      mealAdherence,
      exceptionStates: {
        confirmed: confirmed - late, // confirmed without late
        skipped,
        outOfPlan,
        pending,
        late,
      },
      insights,
      suggestions,
      hypotheses: planType === 'profissional' ? hypotheses : undefined,
      comparison,
      generatedAt,
      planType,
    };

    const htmlContent = generatePdfContent(reportData);

    // Store metrics snapshot
    const metricsSnapshot = {
      ...reportData,
      calculatedAt: now.toISOString(),
      planVersion: metrics?.plan_version || 1,
    };

    // Generate unique filename
    const fileName = `${targetUserId}/${planId}_${startDate}_${endDate}_${Date.now()}.html`;

    // Upload HTML to storage (will be converted to PDF on client or by a separate service)
    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
    const { error: uploadError } = await supabase.storage
      .from('adherence-reports')
      .upload(fileName, htmlBlob, {
        contentType: 'text/html',
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      // Continue without storing - return HTML directly
    } else {
      // Store reference in database
      await supabase.from('adherence_report_files').upsert({
        user_id: user.id,
        student_id: studentId || null,
        diet_plan_id: planId,
        plan_version: metrics?.plan_version || 1,
        plan_type: planType,
        period_start: startDate,
        period_end: endDate,
        file_path: fileName,
        metrics_snapshot: metricsSnapshot,
      }, {
        onConflict: 'user_id,student_id,diet_plan_id,period_start,period_end',
      });
    }

    console.log("PDF report generated successfully");

    return new Response(JSON.stringify({
      success: true,
      html: htmlContent,
      filePath: fileName,
      data: reportData,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error generating PDF:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
