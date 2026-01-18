import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PDF Generation helpers
async function generatePDF(title: string, sections: { title: string; content: string[] }[]) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 50;
  const lineHeight = 14;
  const titleSize = 24;
  const sectionTitleSize = 14;
  const bodySize = 10;
  
  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let yPosition = pageHeight - margin;
  
  // Helper to add new page
  const addNewPage = () => {
    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    yPosition = pageHeight - margin;
  };
  
  // Helper to check if we need a new page
  const checkNewPage = (neededHeight: number) => {
    if (yPosition - neededHeight < margin) {
      addNewPage();
    }
  };
  
  // Draw main title
  currentPage.drawText(title, {
    x: margin,
    y: yPosition,
    size: titleSize,
    font: boldFont,
    color: rgb(0.13, 0.55, 0.13), // Green color
  });
  yPosition -= titleSize + 10;
  
  // Draw date
  const dateStr = `Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`;
  currentPage.drawText(dateStr, {
    x: margin,
    y: yPosition,
    size: 9,
    font: font,
    color: rgb(0.5, 0.5, 0.5),
  });
  yPosition -= 30;
  
  // Draw separator line
  currentPage.drawLine({
    start: { x: margin, y: yPosition },
    end: { x: pageWidth - margin, y: yPosition },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
  yPosition -= 20;
  
  // Process sections
  for (const section of sections) {
    checkNewPage(sectionTitleSize + 30);
    
    // Section title
    currentPage.drawText(section.title.toUpperCase(), {
      x: margin,
      y: yPosition,
      size: sectionTitleSize,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= sectionTitleSize + 10;
    
    // Section content
    for (const line of section.content) {
      // Word wrap
      const maxWidth = pageWidth - (margin * 2);
      const words = line.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const textWidth = font.widthOfTextAtSize(testLine, bodySize);
        
        if (textWidth > maxWidth && currentLine) {
          checkNewPage(lineHeight);
          currentPage.drawText(currentLine, {
            x: margin,
            y: yPosition,
            size: bodySize,
            font: line.startsWith('•') || line.startsWith('-') ? font : font,
            color: rgb(0.1, 0.1, 0.1),
          });
          yPosition -= lineHeight;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine) {
        checkNewPage(lineHeight);
        currentPage.drawText(currentLine, {
          x: margin,
          y: yPosition,
          size: bodySize,
          font: font,
          color: rgb(0.1, 0.1, 0.1),
        });
        yPosition -= lineHeight;
      }
    }
    
    yPosition -= 15; // Space between sections
  }
  
  // Add page numbers
  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    page.drawText(`Página ${i + 1} de ${pages.length}`, {
      x: pageWidth - margin - 70,
      y: 30,
      size: 8,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    page.drawText('NutriaPlan - Documentação Oficial', {
      x: margin,
      y: 30,
      size: 8,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }
  
  return await pdfDoc.save();
}

// Technical documentation content
const TECHNICAL_SECTIONS = [
  {
    title: "1. Visão Técnica Geral",
    content: [
      "O NutriaPlan é uma plataforma web de nutrição inteligente que combina automação de planos alimentares via Inteligência Artificial com rastreamento de adesão, sistema de governança clínica e monetização via assinaturas Stripe.",
      "",
      "• Multi-tenant por design: Profissionais gerenciam seus próprios alunos",
      "• Governança de IA: A IA opera com permissões diferenciadas por tipo de usuário",
      "• Modelo hierárquico: diet_plans → meals → meal_options → meal_option_foods",
      "• Sistema de confirmação de refeições: Não é escolha, é confirmação do consumo real",
      "• Equivalência nutricional obrigatória: Opções devem ser equivalentes nutricionalmente",
    ]
  },
  {
    title: "2. Arquitetura Geral",
    content: [
      "CAMADA DE APRESENTAÇÃO:",
      "• React 18.3 + Vite + TailwindCSS + shadcn/ui + Framer Motion",
      "",
      "CAMADA DE ESTADO:",
      "• TanStack Query + React Context (AuthContext)",
      "",
      "CAMADA DE SERVIÇOS:",
      "• Supabase Client (supabase-js)",
      "",
      "CAMADA DE BACKEND:",
      "• Supabase Edge Functions (Deno) + PostgreSQL + RLS Policies",
      "",
      "CAMADA DE INTEGRAÇÕES:",
      "• Lovable AI Gateway + Stripe API + Supabase Auth",
    ]
  },
  {
    title: "3. Stack Tecnológica",
    content: [
      "FRONTEND:",
      "• React ^18.3.1 - Framework de UI",
      "• Vite - Build tool e dev server",
      "• TypeScript - Tipagem estática",
      "• TailwindCSS - Estilização utility-first",
      "• shadcn/ui - Componentes de UI",
      "• Framer Motion ^12.26.2 - Animações",
      "• TanStack Query ^5.83.0 - Estado servidor",
      "• React Router DOM ^6.30.1 - Roteamento",
      "• Recharts ^2.15.4 - Gráficos",
      "• Zod ^3.25.76 - Validação de schemas",
      "",
      "BACKEND:",
      "• Supabase - Backend-as-a-Service",
      "• PostgreSQL - Banco de dados relacional",
      "• Deno - Runtime para Edge Functions",
      "• Supabase Auth - Autenticação",
      "",
      "INTEGRAÇÕES:",
      "• Lovable AI Gateway - IA generativa (Gemini/GPT-5)",
      "• Stripe - Pagamentos e assinaturas",
    ]
  },
  {
    title: "4. Tipos de Usuário e Permissões",
    content: [
      "TIPOS DE USUÁRIO (user_type - IMUTÁVEL):",
      "• aluno - Usuário vinculado a um profissional",
      "• usuario - Usuário autônomo (pessoa física)",
      "• profissional - Nutricionista ou profissional de saúde",
      "",
      "PAPÉIS DO SISTEMA (app_role):",
      "• admin - Administrador do sistema",
      "• professional - Profissional de nutrição",
      "• student - Aluno vinculado",
      "",
      "PLANOS COMERCIAIS:",
      "• gratuito (R$ 0,00) - IA educacional básica",
      "• premium (R$ 4,90/mês) - IA educacional ampliada",
      "• plano_pessoal_pago (R$ 14,90/mês) - IA completa autônoma",
      "• profissional (R$ 99,00/mês) - IA como assistente clínica",
    ]
  },
  {
    title: "5. Regras de Negócio",
    content: [
      "HIERARQUIA DE PLANOS ALIMENTARES:",
      "diet_plans → meals → meal_options → meal_option_foods → foods",
      "",
      "EQUIVALÊNCIA NUTRICIONAL:",
      "• Proteína: ±5g",
      "• Carboidratos: ±10g",
      "• Gordura: ±3g",
      "• Calorias: ±10%",
      "",
      "ESTADOS DE REFEIÇÃO:",
      "• PENDENTE - Refeição ainda não registrada",
      "• CONFIRMADA - Usuário confirmou que comeu",
      "• PULADA - Usuário pulou a refeição",
      "• FORA_DO_PLANO - Usuário comeu algo diferente",
      "• CONFIRMADA_TARDIA - Confirmação retroativa",
      "",
      "CÁLCULO DE ADESÃO:",
      "adherence_rate = (confirmadas + tardias) / total_esperadas × 100",
    ]
  },
  {
    title: "6. Governança da IA",
    content: [
      "PRINCÍPIOS FUNDAMENTAIS:",
      "• A IA NÃO é autônoma",
      "• A IA NÃO toma decisões finais",
      "• Toda alteração real passa pelo backend",
      "• A IA pode PROPOR, mas não EXECUTAR sem autorização",
      "",
      "PERFIS DE GOVERNANÇA:",
      "",
      "ALUNO + GRATUITO:",
      "• Verbos: EXPLICAR, ORIENTAR (2-4 frases)",
      "• Bloqueado: ANALISAR, SIMULAR, PROPOR, EXECUTAR",
      "",
      "ALUNO + PREMIUM:",
      "• Verbos: EXPLICAR, ANALISAR, SIMULAR (4-6 frases)",
      "• Simulações rotuladas, sem impacto real",
      "",
      "USUÁRIO + PESSOAL PAGO:",
      "• Verbos: TODOS (5-8 frases)",
      "• Execução requer confirmação do usuário",
      "",
      "PROFISSIONAL:",
      "• Verbos: EXPLICAR, ANALISAR, SIMULAR, PROPOR (6-10 frases)",
      "• Fluxo: IA PROPÕE → Profissional aprova → Sistema executa",
    ]
  },
  {
    title: "7. Edge Functions",
    content: [
      "PRINCIPAIS FUNÇÕES:",
      "• generate-meal-plan - Geração de planos via IA",
      "• generate-meal-plan-v2 - Versão com opções equivalentes",
      "• nutritional-chat - Chat conversacional governado",
      "• confirm-meal - Confirmação de consumo",
      "• create-checkout - Sessão Stripe Checkout",
      "• stripe-webhook - Eventos Stripe",
      "• create-student - Criação de alunos",
      "• adherence-report - Relatórios de adesão",
      "• ai-plan-suggestions - Sugestões de ajuste",
      "• check-adherence-alerts - Verificação de alertas",
    ]
  },
  {
    title: "8. Integrações",
    content: [
      "STRIPE:",
      "• Eventos: checkout.session.completed, subscription.updated/deleted",
      "• Ciclo: trial → active → past_due → canceled/expired",
      "• Grace period: 7 dias",
      "",
      "LOVABLE AI GATEWAY:",
      "• Endpoint: https://ai.gateway.lovable.dev/v1/chat/completions",
      "• Modelos: gemini-3-flash-preview, gemini-2.5-flash, gpt-5",
      "• Rate limits: 429 (aguardar), 402 (créditos), 500 (retry)",
    ]
  },
  {
    title: "9. Segurança",
    content: [
      "• RLS habilitado em todas as tabelas",
      "• Funções SECURITY DEFINER para operações privilegiadas",
      "• Validação de webhook signature do Stripe",
      "• Secrets nunca expostos no cliente",
      "• Rate limiting em Edge Functions",
      "• Roles armazenados em tabela separada (user_roles)",
      "• Verificação de idempotência em webhooks",
    ]
  },
  {
    title: "10. Próximos Passos Sugeridos",
    content: [
      "CURTO PRAZO (1-2 meses):",
      "• Upgrade de instância Supabase",
      "• Reconciliação de assinaturas",
      "• Testes automatizados",
      "",
      "MÉDIO PRAZO (3-6 meses):",
      "• PWA/Offline",
      "• Push Notifications",
      "• Realtime updates",
      "• Multi-idioma",
      "",
      "LONGO PRAZO (6-12 meses):",
      "• App Nativo (React Native)",
      "• Integração Wearables",
      "• IA preditiva",
      "• White-label para clínicas",
    ]
  },
];

// Commercial documentation content
const COMMERCIAL_SECTIONS = [
  {
    title: "1. Apresentação",
    content: [
      "O NutriaPlan é uma plataforma de nutrição inteligente que revoluciona a forma como profissionais de nutrição e seus pacientes interagem com planos alimentares.",
      "",
      "Combinando Inteligência Artificial avançada com uma interface intuitiva, o NutriaPlan automatiza a criação de planos alimentares personalizados, monitora a adesão em tempo real e fornece insights valiosos para otimizar resultados.",
    ]
  },
  {
    title: "2. Problema Resolvido",
    content: [
      "PARA PROFISSIONAIS:",
      "• Criação manual de planos consome 2-4 horas por paciente",
      "• Dificuldade em monitorar adesão entre consultas",
      "• Falta de dados objetivos para ajustar planos",
      "• Escala limitada pela capacidade operacional",
      "",
      "PARA PACIENTES:",
      "• Planos genéricos que não consideram preferências",
      "• Falta de variedade leva ao abandono",
      "• Dificuldade em registrar o que comeu",
      "• Sem acompanhamento entre consultas",
    ]
  },
  {
    title: "3. Proposta de Valor",
    content: [
      "\"Planos alimentares personalizados em minutos, não horas.\"",
      "\"Acompanhamento contínuo, não apenas nas consultas.\"",
      "",
      "PARA PROFISSIONAIS:",
      "• Gere planos personalizados em 30 segundos com IA",
      "• Acompanhe a adesão de todos os pacientes em um painel",
      "• Receba alertas automáticos quando a adesão cair",
      "• Atenda mais pacientes com a mesma qualidade",
      "",
      "PARA PACIENTES:",
      "• Variedade com opções equivalentes para cada refeição",
      "• Registre refeições com um toque",
      "• Chat com assistente nutricional 24/7",
      "• Visualize seu progresso e evolução",
    ]
  },
  {
    title: "4. Público-Alvo",
    content: [
      "PRIMÁRIO - Profissionais de Saúde:",
      "• Nutricionistas clínicos e esportivos",
      "• Personal trainers com certificação em nutrição",
      "• Clínicas de nutrição e estética",
      "",
      "SECUNDÁRIO - Usuários Individuais:",
      "• Pessoas buscando perda de peso",
      "• Atletas amadores",
      "• Pessoas com objetivos fitness específicos",
    ]
  },
  {
    title: "5. Diferenciais Competitivos",
    content: [
      "1. IA COM GOVERNANÇA CLÍNICA",
      "A inteligência artificial respeita hierarquias. Para pacientes vinculados, apenas o profissional pode aprovar alterações no plano.",
      "",
      "2. OPÇÕES NUTRICIONALMENTE EQUIVALENTES",
      "Cada refeição tem múltiplas opções com os mesmos valores nutricionais, dando liberdade de escolha sem comprometer resultados.",
      "",
      "3. SISTEMA DE CONFIRMAÇÃO",
      "O paciente confirma o que comeu, não escolhe antecipadamente. Isso gera dados reais de adesão.",
      "",
      "4. ALERTAS PROATIVOS",
      "O profissional recebe alertas automáticos quando a adesão do paciente cai.",
      "",
      "5. CHAT CONTEXTUALIZADO",
      "O assistente conhece o plano do paciente e responde de forma personalizada.",
    ]
  },
  {
    title: "6. Planos e Preços",
    content: [
      "PLANO GRATUITO (R$ 0/mês)",
      "• Visualização do plano alimentar",
      "• Confirmação de refeições",
      "• Chat básico (3 mensagens/dia)",
      "• Histórico de 7 dias",
      "",
      "PLANO PREMIUM (R$ 4,90/mês)",
      "• Tudo do Gratuito",
      "• Chat ampliado (10 mensagens/dia)",
      "• Simulações nutricionais",
      "• Histórico de 30 dias",
      "",
      "PLANO PESSOAL PAGO (R$ 14,90/mês)",
      "• IA completa com autonomia",
      "• Até 5 planos/mês",
      "• 20 substituições/mês",
      "• Chat avançado (30 mensagens/dia)",
      "• Histórico de 90 dias",
      "",
      "PLANO PROFISSIONAL (R$ 99,00/mês)",
      "• Geração ilimitada de planos",
      "• Até 50 pacientes ativos",
      "• Dashboard centralizado",
      "• Alertas automáticos",
      "• Relatórios PDF",
      "• Chat profissional (100 mensagens/dia)",
    ]
  },
  {
    title: "7. Modelo de Monetização",
    content: [
      "RECEITA RECORRENTE (SaaS):",
      "• Assinaturas mensais de profissionais (R$ 99/mês)",
      "• Upgrade de pacientes para Premium (R$ 4,90/mês)",
      "• Planos pessoais pagos (R$ 14,90/mês)",
      "",
      "POTENCIAL DE RECEITA:",
      "• 100 profissionais × R$ 99 = R$ 9.900/mês",
      "• 1.000 pacientes premium × R$ 4,90 = R$ 4.900/mês",
      "• 500 usuários pessoais × R$ 14,90 = R$ 7.450/mês",
      "• Total potencial: R$ 22.250/mês (R$ 267.000/ano)",
    ]
  },
  {
    title: "8. Benefícios por Tipo de Usuário",
    content: [
      "PARA PROFISSIONAIS:",
      "• ANTES: 2-4 horas para criar plano → DEPOIS: 30 segundos com IA",
      "• ANTES: Sem dados de adesão → DEPOIS: Métricas em tempo real",
      "• ANTES: Ajustes apenas na consulta → DEPOIS: Alertas automáticos",
      "• ANTES: Escala limitada → DEPOIS: Até 50 pacientes ativos",
      "",
      "PARA PACIENTES:",
      "• ANTES: Plano único e monótono → DEPOIS: Múltiplas opções",
      "• ANTES: Sem acompanhamento → DEPOIS: Chat 24/7",
      "• ANTES: Registro difícil → DEPOIS: Confirmação com um toque",
      "• ANTES: Sem progresso visível → DEPOIS: Dashboard de evolução",
    ]
  },
  {
    title: "9. Segurança e Confiabilidade",
    content: [
      "• Dados criptografados em trânsito e em repouso",
      "• Autenticação segura via Supabase Auth",
      "• Conformidade com LGPD",
      "• Backups automáticos diários",
      "• Infraestrutura em nuvem escalável",
      "• Pagamentos seguros via Stripe",
    ]
  },
  {
    title: "10. Visão de Futuro",
    content: [
      "CURTO PRAZO (6 meses):",
      "• App mobile para iOS e Android",
      "• Notificações push de lembretes",
      "• Integração com balança inteligente",
      "",
      "MÉDIO PRAZO (12 meses):",
      "• IA preditiva para antecipar abandono",
      "• Integração com Apple Health e Google Fit",
      "• Versão internacional (inglês e espanhol)",
      "",
      "LONGO PRAZO (24 meses):",
      "• Marketplace de planos alimentares",
      "• White-label para redes de clínicas",
      "• Análise genética para personalização",
    ]
  },
];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const { docType } = await req.json();
    
    let pdfBytes: Uint8Array;
    let filename: string;

    if (docType === 'technical') {
      pdfBytes = await generatePDF('DOCUMENTAÇÃO TÉCNICA - NUTRIAPLAN', TECHNICAL_SECTIONS);
      filename = 'DOCUMENTACAO_TECNICA_NUTRIAPLAN.pdf';
    } else if (docType === 'commercial') {
      pdfBytes = await generatePDF('DOCUMENTAÇÃO COMERCIAL - NUTRIAPLAN', COMMERCIAL_SECTIONS);
      filename = 'DOCUMENTACAO_COMERCIAL_NUTRIAPLAN.pdf';
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid docType. Use "technical" or "commercial"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[generate-documentation-pdf] Generated ${docType} PDF for admin ${user.email}`);

    return new Response(new Uint8Array(pdfBytes), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('[generate-documentation-pdf] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
