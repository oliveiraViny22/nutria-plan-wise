import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function TermsOfUse() {
  return (
    <div className="min-h-screen bg-background">
      <header className="container mx-auto px-4 py-6 flex items-center justify-between">
        <Logo size="lg" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-3xl font-bold text-foreground mb-8">Termos de Uso</h1>
        
        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e usar o NutriPlan, você concorda em cumprir e estar vinculado a estes Termos de Uso. 
              Se você não concordar com qualquer parte destes termos, não poderá acessar o serviço.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Descrição do Serviço</h2>
            <p>
              O NutriPlan é uma plataforma de planejamento alimentar que utiliza inteligência artificial 
              para criar planos nutricionais personalizados. O serviço inclui:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Geração de planos alimentares personalizados</li>
              <li>Substituição inteligente de alimentos</li>
              <li>Assistente de IA para dúvidas nutricionais</li>
              <li>Acompanhamento de progresso</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Uso Adequado</h2>
            <p>
              Você concorda em usar o serviço apenas para fins legais e de acordo com estes termos. 
              É proibido:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Usar o serviço para qualquer finalidade ilegal</li>
              <li>Tentar acessar áreas não autorizadas do sistema</li>
              <li>Compartilhar credenciais de acesso com terceiros</li>
              <li>Usar o serviço para substituir orientação médica profissional</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Isenção de Responsabilidade Médica</h2>
            <p>
              O NutriPlan não substitui aconselhamento médico, diagnóstico ou tratamento profissional. 
              Sempre consulte um médico ou nutricionista qualificado antes de fazer alterações 
              significativas em sua dieta, especialmente se você tiver condições de saúde preexistentes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Conta do Usuário</h2>
            <p>
              Você é responsável por manter a confidencialidade de sua conta e senha. 
              Você concorda em notificar-nos imediatamente sobre qualquer uso não autorizado de sua conta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Pagamentos e Assinaturas</h2>
            <p>
              Alguns recursos do NutriPlan requerem uma assinatura paga. Os pagamentos são processados 
              de forma segura através de nossos parceiros de pagamento. As assinaturas são renovadas 
              automaticamente, a menos que canceladas antes do próximo período de cobrança.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo do NutriPlan, incluindo textos, gráficos, logos e software, 
              é propriedade da empresa e protegido por leis de direitos autorais.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Modificações dos Termos</h2>
            <p>
              Reservamo-nos o direito de modificar estes termos a qualquer momento. 
              As alterações entrarão em vigor imediatamente após a publicação. 
              O uso contínuo do serviço após as alterações constitui aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Contato</h2>
            <p>
              Para dúvidas sobre estes Termos de Uso, entre em contato conosco através 
              dos canais de suporte disponíveis na plataforma.
            </p>
          </section>

          <p className="text-sm text-muted-foreground pt-6 border-t">
            Última atualização: Janeiro de 2026
          </p>
        </div>
      </main>
    </div>
  );
}
