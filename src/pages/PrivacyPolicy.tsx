import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <header className="container mx-auto px-4 py-6 flex items-center justify-between">
        <Logo size="lg" />
        <Link to="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </Link>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-3xl font-bold text-foreground mb-8">Política de Privacidade</h1>
        
        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Introdução</h2>
            <p>
              Esta Política de Privacidade descreve como o NutriPlan coleta, usa e protege 
              suas informações pessoais. Estamos comprometidos em proteger sua privacidade 
              e garantir a segurança de seus dados.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Informações Coletadas</h2>
            <p>Coletamos os seguintes tipos de informações:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Dados de cadastro:</strong> nome, e-mail e senha</li>
              <li><strong>Dados de perfil:</strong> idade, peso, altura, sexo, nível de atividade física</li>
              <li><strong>Preferências alimentares:</strong> restrições, preferências e objetivos nutricionais</li>
              <li><strong>Dados de uso:</strong> interações com a plataforma, histórico de planos</li>
              <li><strong>Dados de pagamento:</strong> processados de forma segura por nossos parceiros</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Como Usamos Suas Informações</h2>
            <p>Utilizamos suas informações para:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Criar e personalizar planos alimentares</li>
              <li>Melhorar nossos serviços e experiência do usuário</li>
              <li>Processar pagamentos e gerenciar assinaturas</li>
              <li>Enviar comunicações importantes sobre o serviço</li>
              <li>Fornecer suporte ao cliente</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Proteção de Dados</h2>
            <p>
              Implementamos medidas de segurança técnicas e organizacionais para proteger 
              suas informações contra acesso não autorizado, alteração, divulgação ou destruição. 
              Isso inclui:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Criptografia de dados em trânsito e em repouso</li>
              <li>Controles de acesso rigorosos</li>
              <li>Monitoramento contínuo de segurança</li>
              <li>Backups regulares</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Compartilhamento de Dados</h2>
            <p>
              Não vendemos suas informações pessoais. Podemos compartilhar dados apenas:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Com prestadores de serviços que nos ajudam a operar a plataforma</li>
              <li>Quando exigido por lei ou ordem judicial</li>
              <li>Com seu profissional de saúde vinculado, se aplicável</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Seus Direitos</h2>
            <p>Você tem o direito de:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir informações incorretas</li>
              <li>Solicitar a exclusão de seus dados</li>
              <li>Exportar seus dados em formato legível</li>
              <li>Retirar seu consentimento a qualquer momento</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Cookies e Tecnologias Similares</h2>
            <p>
              Utilizamos cookies e tecnologias similares para melhorar sua experiência, 
              analisar o uso da plataforma e personalizar conteúdo. Você pode gerenciar 
              suas preferências de cookies através das configurações do navegador.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Retenção de Dados</h2>
            <p>
              Mantemos seus dados pessoais enquanto sua conta estiver ativa ou conforme 
              necessário para fornecer nossos serviços. Após o encerramento da conta, 
              podemos reter certas informações conforme exigido por lei.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Alterações nesta Política</h2>
            <p>
              Podemos atualizar esta política periodicamente. Notificaremos você sobre 
              alterações significativas por e-mail ou através de aviso na plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Contato</h2>
            <p>
              Para exercer seus direitos ou esclarecer dúvidas sobre esta política, 
              entre em contato conosco através dos canais de suporte disponíveis na plataforma.
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
