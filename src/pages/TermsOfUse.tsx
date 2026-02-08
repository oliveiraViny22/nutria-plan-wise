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
              Ao acessar e usar o NutriaPlan ("Plataforma", "Serviço", "nós" ou "nosso"), você ("Usuário", "você") 
              concorda em cumprir e estar vinculado a estes Termos de Uso. Se você não concordar com qualquer 
              parte destes termos, não poderá acessar o serviço. O uso continuado da plataforma após quaisquer 
              alterações constitui aceitação dos termos modificados.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Descrição do Serviço</h2>
            <p>
              O NutriaPlan é uma plataforma de planejamento alimentar que utiliza inteligência artificial 
              para criar planos nutricionais personalizados. O serviço inclui, mas não se limita a:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Geração automatizada de planos alimentares personalizados baseados em suas preferências e objetivos</li>
              <li>Substituição inteligente de alimentos com equivalência nutricional</li>
              <li>Assistente de IA para esclarecimento de dúvidas nutricionais</li>
              <li>Acompanhamento e registro de progresso (peso, medidas, aderência)</li>
              <li>Múltiplas opções de refeições para maior flexibilidade</li>
              <li>Funcionalidades profissionais para nutricionistas (quando aplicável)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Elegibilidade e Cadastro</h2>
            <p>Para usar o NutriaPlan, você deve:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Ter pelo menos 18 anos de idade ou possuir autorização de um responsável legal</li>
              <li>Fornecer informações verdadeiras, precisas e completas durante o cadastro</li>
              <li>Manter suas informações de conta atualizadas</li>
              <li>Ser responsável por todas as atividades realizadas em sua conta</li>
            </ul>
            <p className="mt-2">
              Reservamo-nos o direito de recusar, suspender ou encerrar contas a nosso critério, 
              especialmente em casos de violação destes termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Uso Adequado</h2>
            <p>
              Você concorda em usar o serviço apenas para fins legais e de acordo com estes termos. 
              É expressamente proibido:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Usar o serviço para qualquer finalidade ilegal ou não autorizada</li>
              <li>Tentar acessar áreas não autorizadas do sistema ou de outros usuários</li>
              <li>Compartilhar credenciais de acesso com terceiros</li>
              <li>Criar múltiplas contas para burlar limites ou restrições</li>
              <li>Usar bots, scrapers ou ferramentas automatizadas não autorizadas</li>
              <li>Transmitir vírus, malware ou código malicioso</li>
              <li>Revender, sublicenciar ou redistribuir o serviço sem autorização</li>
              <li>Usar o serviço como única fonte de orientação para condições médicas</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Isenção de Responsabilidade Médica</h2>
            <p className="font-medium text-foreground">
              IMPORTANTE: O NutriaPlan é uma ferramenta de educação nutricional e planejamento alimentar. 
              NÃO substitui aconselhamento médico, diagnóstico ou tratamento profissional.
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Sempre consulte um médico ou nutricionista qualificado antes de fazer alterações significativas em sua dieta</li>
              <li>Se você possui condições de saúde preexistentes (diabetes, hipertensão, alergias alimentares, distúrbios alimentares, etc.), busque orientação profissional antes de utilizar o serviço</li>
              <li>As recomendações geradas são baseadas em algoritmos e podem não considerar todas as suas condições individuais</li>
              <li>Em caso de emergência médica, procure atendimento médico imediatamente</li>
            </ul>
            <p className="mt-2">
              Não nos responsabilizamos por quaisquer danos à saúde resultantes do uso inadequado 
              do serviço ou da não consulta a profissionais de saúde qualificados.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Conta do Usuário e Segurança</h2>
            <p>
              Você é responsável por manter a confidencialidade de sua conta e senha. Compromete-se a:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Criar uma senha forte e única para sua conta</li>
              <li>Não compartilhar suas credenciais de acesso</li>
              <li>Notificar-nos imediatamente sobre qualquer uso não autorizado ou suspeita de violação de segurança</li>
              <li>Encerrar sua sessão ao usar dispositivos compartilhados</li>
            </ul>
            <p className="mt-2">
              Não seremos responsáveis por perdas resultantes do uso não autorizado de sua conta 
              quando este decorrer de negligência do usuário na proteção de suas credenciais.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Planos e Pagamentos</h2>
            <p>O NutriaPlan oferece diferentes níveis de acesso:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Plano Gratuito:</strong> Acesso limitado às funcionalidades básicas</li>
              <li><strong>Plano Pessoal:</strong> Acesso completo às funcionalidades para uso individual</li>
              <li><strong>Plano Profissional:</strong> Recursos adicionais para nutricionistas e profissionais de saúde</li>
            </ul>
            <p className="mt-2">Para assinaturas pagas:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Os pagamentos são processados de forma segura através do Stripe</li>
              <li>As assinaturas são renovadas automaticamente, salvo cancelamento prévio</li>
              <li>O cancelamento pode ser realizado a qualquer momento, mas não há reembolso proporcional</li>
              <li>Reservamo-nos o direito de modificar preços com aviso prévio de 30 dias</li>
              <li>Em caso de inadimplência, o acesso pode ser suspenso até regularização</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo do NutriaPlan, incluindo mas não limitado a textos, gráficos, logos, 
              ícones, imagens, clipes de áudio, downloads digitais, compilações de dados e software, 
              é propriedade exclusiva do NutriaPlan ou de seus licenciadores e está protegido por leis 
              de direitos autorais, marcas registradas e outras leis de propriedade intelectual.
            </p>
            <p className="mt-2">
              Você recebe uma licença limitada, não exclusiva e não transferível para usar o serviço 
              para fins pessoais e não comerciais. Esta licença não inclui direito de:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Copiar, modificar ou distribuir o conteúdo do serviço</li>
              <li>Fazer engenharia reversa do software</li>
              <li>Remover avisos de direitos autorais ou marcas registradas</li>
              <li>Usar o conteúdo para fins comerciais sem autorização expressa</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Conteúdo do Usuário</h2>
            <p>
              Ao fornecer dados, informações ou conteúdo ao serviço ("Conteúdo do Usuário"), você:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Mantém todos os direitos sobre seu conteúdo</li>
              <li>Concede-nos licença para usar, processar e armazenar seus dados para fornecer o serviço</li>
              <li>Garante que seu conteúdo não viola direitos de terceiros</li>
              <li>Entende que podemos usar dados anonimizados para melhorar nossos algoritmos</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Limitação de Responsabilidade</h2>
            <p>
              Na extensão máxima permitida por lei aplicável:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>O serviço é fornecido "como está" e "conforme disponível"</li>
              <li>Não garantimos que o serviço será ininterrupto, seguro ou livre de erros</li>
              <li>Não nos responsabilizamos por danos indiretos, incidentais, especiais ou consequenciais</li>
              <li>Nossa responsabilidade total está limitada ao valor pago pelo serviço nos últimos 12 meses</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">11. Indenização</h2>
            <p>
              Você concorda em defender, indenizar e isentar o NutriaPlan, seus diretores, funcionários 
              e parceiros de quaisquer reclamações, danos, obrigações, perdas, responsabilidades, custos 
              ou dívidas decorrentes de: (i) seu uso do serviço; (ii) violação destes termos; 
              (iii) violação de direitos de terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">12. Modificações dos Termos</h2>
            <p>
              Reservamo-nos o direito de modificar estes termos a qualquer momento. As alterações 
              serão comunicadas através de:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Aviso na plataforma</li>
              <li>E-mail para o endereço cadastrado (para alterações significativas)</li>
              <li>Atualização da data de "Última atualização" nesta página</li>
            </ul>
            <p className="mt-2">
              O uso contínuo do serviço após as alterações constitui aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">13. Rescisão</h2>
            <p>
              Podemos suspender ou encerrar seu acesso ao serviço imediatamente, sem aviso prévio, 
              se você violar estes termos. Você pode encerrar sua conta a qualquer momento através 
              das configurações do perfil. Após o encerramento:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Seu direito de uso do serviço cessará imediatamente</li>
              <li>Podemos reter seus dados conforme nossa Política de Privacidade</li>
              <li>Não haverá reembolso de valores já pagos</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">14. Disposições Gerais</h2>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Lei Aplicável:</strong> Estes termos são regidos pelas leis da República Federativa do Brasil</li>
              <li><strong>Foro:</strong> Eventuais disputas serão resolvidas no foro da comarca de São Paulo/SP</li>
              <li><strong>Integralidade:</strong> Estes termos constituem o acordo integral entre as partes</li>
              <li><strong>Renúncia:</strong> A falha em exercer qualquer direito não constitui renúncia</li>
              <li><strong>Separabilidade:</strong> Se qualquer disposição for inválida, as demais permanecem em vigor</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">15. Contato</h2>
            <p>
              Para dúvidas sobre estes Termos de Uso, entre em contato conosco:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Através dos canais de suporte disponíveis na plataforma</li>
              <li>Pelo chat de atendimento ao usuário</li>
            </ul>
          </section>

          <p className="text-sm text-muted-foreground pt-6 border-t">
            Última atualização: Fevereiro de 2026
          </p>
        </div>
      </main>
    </div>
  );
}
