import "../styles/lgpd.css"


export default function LGPD() {
  return (
    <section className="lgpd-container">
      <div className="lgpd-content">

        <h1>Proteção de Dados Pessoais – LGPD</h1>

        <p>
          A <strong>Acessanet Telecom</strong> se compromete com a proteção dos seus dados pessoais,
          em total conformidade com a Lei Geral de Proteção de Dados Pessoais
          (Lei nº 13.709/2018 – LGPD).
        </p>

        <h2>Dados que coletamos</h2>
        <p>Coletamos apenas os dados essenciais para a prestação de nossos serviços, como:</p>

        <ul>
          <li>Nome completo</li>
          <li>CPF e RG</li>
          <li>Endereço completo</li>
          <li>Telefone e e-mail</li>
          <li>Dados bancários (quando necessário para cobrança)</li>
        </ul>

        <h2>Como utilizamos seus dados</h2>
        <p>Essas informações são utilizadas exclusivamente para:</p>

        <ul>
          <li>Instalação e manutenção dos serviços contratados</li>
          <li>Emissão de boletos e faturas</li>
          <li>Atendimento e suporte técnico</li>
          <li>
            Envio de comunicações sobre os serviços (vencimentos, promoções e avisos)
          </li>
        </ul>

        <h2>Segurança das informações</h2>
        <p>
          Todos os dados são armazenados com segurança, com acesso restrito a profissionais
          autorizados e seguindo rígidos padrões de confidencialidade.
        </p>

        <h2>Seus direitos</h2>
        <p>Você tem o direito de:</p>

        <ul>
          <li>Acessar seus dados</li>
          <li>Corrigir informações incompletas ou desatualizadas</li>
          <li>Solicitar a exclusão de dados (quando permitido por lei)</li>
          <li>Solicitar a portabilidade ou limitação do uso de seus dados</li>
        </ul>

        <h2>Contato</h2>
        <p>
          Para mais informações ou para exercer seus direitos, entre em contato pelo e-mail:
        </p>

        <a href="mailto:contato@acessanet.com" className="lgpd-email">
          contato@acessanet.com
        </a>

      </div>
    </section>
  );
}