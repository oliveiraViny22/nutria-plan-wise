import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function PrivacyPolicy() {
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
        <h1 className="text-3xl font-bold text-foreground mb-8">Política de Privacidade</h1>
        
        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Introdução</h2>
            <p>
              Esta Política de Privacidade ("Política") descreve como o NutriPlan ("nós", "nosso" ou "Plataforma") 
              coleta, usa, armazena e protege suas informações pessoais em conformidade com a Lei Geral de 
              Proteção de Dados (LGPD - Lei nº 13.709/2018) e demais regulamentações aplicáveis.
            </p>
            <p className="mt-2">
              Ao utilizar nossos serviços, você confirma que leu e compreendeu esta Política e 
              concorda com o tratamento de seus dados conforme aqui descrito.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Controlador de Dados</h2>
            <p>
              O NutriPlan é o controlador responsável pelo tratamento de seus dados pessoais. 
              Para questões relacionadas à privacidade, você pode entrar em contato conosco 
              através dos canais de suporte disponíveis na plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Informações Coletadas</h2>
            <p>Coletamos diferentes categorias de dados pessoais:</p>
            
            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">3.1 Dados de Cadastro</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Nome completo</li>
              <li>Endereço de e-mail</li>
              <li>Senha (armazenada de forma criptografada)</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">3.2 Dados de Saúde e Perfil Nutricional</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Idade, peso, altura e sexo biológico</li>
              <li>Nível de atividade física</li>
              <li>Objetivos nutricionais (emagrecimento, ganho de massa, manutenção)</li>
              <li>Histórico de peso e medidas corporais</li>
              <li>Preferências e restrições alimentares (vegetarianismo, alergias, intolerâncias)</li>
              <li>Alimentos preferidos e evitados</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">3.3 Dados de Uso</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Histórico de planos alimentares gerados</li>
              <li>Registro de refeições e aderência ao plano</li>
              <li>Interações com o assistente de IA</li>
              <li>Padrões de uso da plataforma</li>
              <li>Logs de acesso e informações do dispositivo</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">3.4 Dados de Pagamento</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Processados diretamente pelo Stripe (nosso provedor de pagamentos)</li>
              <li>Não armazenamos números completos de cartão de crédito</li>
              <li>Retemos apenas identificadores de transação para fins de faturamento</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Bases Legais para Tratamento</h2>
            <p>Tratamos seus dados pessoais com base nas seguintes bases legais (Art. 7º da LGPD):</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Execução de contrato:</strong> Para fornecer os serviços contratados</li>
              <li><strong>Consentimento:</strong> Para envio de comunicações de marketing e uso de dados sensíveis de saúde</li>
              <li><strong>Legítimo interesse:</strong> Para melhorar nossos serviços e prevenir fraudes</li>
              <li><strong>Cumprimento de obrigação legal:</strong> Para atender requisitos fiscais e regulatórios</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Finalidades do Tratamento</h2>
            <p>Utilizamos suas informações para:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Criar e personalizar planos alimentares baseados em seu perfil</li>
              <li>Calcular necessidades calóricas e distribuição de macronutrientes</li>
              <li>Gerar substituições alimentares adequadas ao seu perfil</li>
              <li>Acompanhar seu progresso e evolução</li>
              <li>Fornecer respostas personalizadas através do assistente de IA</li>
              <li>Processar pagamentos e gerenciar assinaturas</li>
              <li>Enviar comunicações importantes sobre o serviço</li>
              <li>Melhorar nossos algoritmos e experiência do usuário</li>
              <li>Prevenir fraudes e garantir a segurança da plataforma</li>
              <li>Cumprir obrigações legais e regulatórias</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Dados Sensíveis</h2>
            <p>
              Alguns dados que coletamos podem ser considerados dados sensíveis sob a LGPD, 
              especialmente dados relacionados à saúde. Tratamos esses dados com especial cuidado:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Coletamos apenas mediante seu consentimento expresso</li>
              <li>Utilizamos exclusivamente para as finalidades informadas</li>
              <li>Aplicamos medidas de segurança reforçadas</li>
              <li>Não compartilhamos com terceiros sem sua autorização explícita</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Proteção e Segurança de Dados</h2>
            <p>
              Implementamos medidas técnicas e organizacionais robustas para proteger suas informações:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Criptografia:</strong> Dados em trânsito (TLS/SSL) e em repouso</li>
              <li><strong>Controle de acesso:</strong> Políticas de Row Level Security (RLS) no banco de dados</li>
              <li><strong>Autenticação segura:</strong> Senhas hasheadas e tokens de sessão seguros</li>
              <li><strong>Monitoramento:</strong> Logs de auditoria e detecção de anomalias</li>
              <li><strong>Backups:</strong> Cópias de segurança regulares e criptografadas</li>
              <li><strong>Infraestrutura:</strong> Servidores em provedores de nuvem certificados (SOC 2, ISO 27001)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Compartilhamento de Dados</h2>
            <p className="font-medium text-foreground">
              Não vendemos, alugamos ou comercializamos suas informações pessoais.
            </p>
            <p className="mt-2">Podemos compartilhar dados apenas nas seguintes situações:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Prestadores de serviços:</strong> Processadores que nos auxiliam na operação (hospedagem, pagamentos, análises), sob contratos de proteção de dados</li>
              <li><strong>Profissionais vinculados:</strong> Se você optou por ser acompanhado por um nutricionista através da plataforma, seus dados de plano e progresso serão compartilhados com esse profissional</li>
              <li><strong>Exigências legais:</strong> Quando necessário para cumprir ordem judicial, investigação ou requisição de autoridade competente</li>
              <li><strong>Proteção de direitos:</strong> Para proteger nossos direitos, propriedade ou segurança</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Transferência Internacional de Dados</h2>
            <p>
              Seus dados podem ser processados em servidores localizados fora do Brasil. 
              Nesses casos, garantimos que:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Os países destinatários possuem nível adequado de proteção de dados, ou</li>
              <li>Utilizamos cláusulas contratuais padrão aprovadas pela ANPD, ou</li>
              <li>Obtemos seu consentimento específico para a transferência</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Seus Direitos (Art. 18 da LGPD)</h2>
            <p>Você possui os seguintes direitos em relação aos seus dados pessoais:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Confirmação e acesso:</strong> Saber se tratamos seus dados e acessá-los</li>
              <li><strong>Correção:</strong> Solicitar a correção de dados incompletos, inexatos ou desatualizados</li>
              <li><strong>Anonimização, bloqueio ou eliminação:</strong> Para dados desnecessários ou tratados em desconformidade</li>
              <li><strong>Portabilidade:</strong> Receber seus dados em formato estruturado para transferência a outro serviço</li>
              <li><strong>Eliminação:</strong> Solicitar a exclusão de dados tratados com base em consentimento</li>
              <li><strong>Informação:</strong> Conhecer as entidades com quem compartilhamos seus dados</li>
              <li><strong>Revogação do consentimento:</strong> Retirar seu consentimento a qualquer momento</li>
              <li><strong>Oposição:</strong> Opor-se ao tratamento em determinadas circunstâncias</li>
            </ul>
            <p className="mt-2">
              Para exercer esses direitos, acesse as configurações do seu perfil ou entre em contato 
              através dos canais de suporte. Responderemos em até 15 dias.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">11. Cookies e Tecnologias de Rastreamento</h2>
            <p>Utilizamos cookies e tecnologias similares para:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Cookies essenciais:</strong> Necessários para o funcionamento do site (autenticação, preferências)</li>
              <li><strong>Cookies de desempenho:</strong> Para analisar como você usa a plataforma e melhorar a experiência</li>
              <li><strong>Cookies funcionais:</strong> Para lembrar suas preferências e configurações</li>
            </ul>
            <p className="mt-2">
              Você pode gerenciar suas preferências de cookies através das configurações do navegador. 
              Note que desabilitar certos cookies pode afetar a funcionalidade da plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">12. Retenção de Dados</h2>
            <p>Mantemos seus dados pessoais pelos seguintes períodos:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Conta ativa:</strong> Enquanto você mantiver uma conta conosco</li>
              <li><strong>Após exclusão da conta:</strong> Até 30 dias para dados operacionais</li>
              <li><strong>Dados fiscais:</strong> 5 anos após a transação, conforme legislação tributária</li>
              <li><strong>Logs de segurança:</strong> 6 meses para fins de auditoria</li>
              <li><strong>Dados anonimizados:</strong> Podem ser retidos indefinidamente para análises estatísticas</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">13. Menores de Idade</h2>
            <p>
              O NutriPlan não é destinado a menores de 18 anos. Não coletamos intencionalmente 
              dados de menores sem consentimento parental. Se identificarmos que coletamos dados 
              de um menor, tomaremos medidas para excluí-los prontamente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">14. Alterações nesta Política</h2>
            <p>
              Podemos atualizar esta Política periodicamente para refletir mudanças em nossas práticas 
              ou requisitos legais. Notificaremos você sobre alterações significativas através de:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Aviso destacado na plataforma</li>
              <li>E-mail para o endereço cadastrado</li>
              <li>Atualização da data de "Última atualização"</li>
            </ul>
            <p className="mt-2">
              Recomendamos revisar esta página periodicamente para estar ciente de quaisquer alterações.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">15. Contato e Encarregado de Dados</h2>
            <p>
              Para exercer seus direitos, esclarecer dúvidas sobre esta Política ou registrar 
              reclamações relacionadas ao tratamento de dados, entre em contato conosco:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Através dos canais de suporte disponíveis na plataforma</li>
              <li>Pelo chat de atendimento ao usuário</li>
            </ul>
            <p className="mt-2">
              Você também tem o direito de peticionar à Autoridade Nacional de Proteção de Dados (ANPD) 
              caso considere que o tratamento de seus dados viola a legislação aplicável.
            </p>
          </section>

          <p className="text-sm text-muted-foreground pt-6 border-t">
            Última atualização: Fevereiro de 2026
          </p>
        </div>
      </main>
    </div>
  );
}
