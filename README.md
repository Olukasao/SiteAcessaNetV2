# AcessaNet — Site Institucional & Central do Assinante

Plataforma web da **AcessaNet**, provedor de internet fibra óptica. O projeto reúne três frentes em um único repositório: o **site institucional** (apresentação da empresa e dos planos), a **Central do Assinante** (autoatendimento do cliente logado) e o **Painel Administrativo**, todos servidos por um backend próprio em Node.js integrado ao sistema de gestão (SGP) e à infraestrutura de rede.

## Visão geral

| Camada | Descrição |
| --- | --- |
| `src/` | SPA em React (site público + Central do Assinante + Admin), construída com Vite |
| `server/` | API própria em Fastify/TypeScript — autenticação, integração com SGP, detecção de incidentes de rede, e-mail, assinatura de documentos |
| `deploy-hostinger.sh` | Deploy atômico (frontend + backend) para a hospedagem na Hostinger |

## Site institucional

- **Home** com seções de apresentação: hero, indicadores (StatsBar), planos em destaque, benefícios, parcerias de valor agregado (TemSaúde, WatchTV, Graviola, App do Provedor) e seção de linha fixa.
- **Planos** — catálogo completo de planos de internet.
- **História**, **Trabalhe Conosco**, **Contatos**, **Contratos**, **LGPD** — páginas institucionais.
- **Disponibilidade** — consulta de cobertura por endereço, com mapa interativo (Leaflet).
- **Assinar Documento** — fluxo de assinatura eletrônica de documentos vinculado ao SGP.
- **Guia de Wi-Fi** — central de ajuda para configuração de rede doméstica.
- **Formulário de parceria (Mundiale)** — captação de dados para campanha específica.
- **Temas sazonais** — sistema de theming que troca o visual do site em campanhas (ex.: Outubro Rosa, Independência, Copa do Mundo 2026, Dia das Mães) sem alterar a estrutura das páginas.
- Componentes de engajamento sempre ativos: chatbot, cursor customizado, scroll suave (Lenis) e botão de voltar ao topo.

## Central do Assinante (`/cliente`)

Área logada do cliente, autenticada por CPF + senha:

- **Dashboard** com dados cadastrais, dados técnicos do contrato e atividade recente.
- **Faturas** — consulta financeira do contrato.
- **Chamados** — abertura de chamado com triagem guiada (diagnóstico de problema antes de acionar o suporte) e acompanhamento do último chamado.
- **Promessa de pagamento** — liberação temporária de serviço suspenso, com regras de elegibilidade validadas no SGP.
- **Assinaturas pendentes** — aviso e modal de documentos aguardando assinatura.
- **Upgrade de plano** — vitrine de planos superiores disponíveis para o contrato.
- **Avisos** — central de comunicados segmentados por público.
- **Status da rede** — aviso de instabilidade quando o contrato está dentro de uma área com incidente detectado.
- **Segurança** — troca de senha, incluindo fluxo obrigatório de primeiro acesso.
- **Relato de bugs** — canal para o cliente reportar problemas no próprio site.

## Painel Administrativo (`/admin`)

- Autenticação e controle de permissões por administrador.
- Gestão de **clientes e contratos**, com histórico de chamados e atividades.
- Gestão de **chamados** (visualização, motivo de encerramento, informações técnicas).
- Gestão de **avisos** enviados aos clientes.
- **Incidentes de rede** — visão consolidada dos incidentes detectados na infraestrutura.
- **Analytics** — métricas de uso da Central do Assinante.
- Lista de **bugs relatados** pelos clientes.

## Backend (`server/`)

API em **Fastify + TypeScript**, responsável por:

- Autenticação de clientes (senha local com política de segurança, redefinição de senha, limite de tentativas) e de administradores.
- Integração com o **SGP**: dados de contrato, faturas, chamados, promessa de pagamento, status de assinatura de documentos.
- Integração com a **OLT Cloud**: leitura de alertas de rede (CTO/PON/OLT) para detecção de incidentes individuais e regionais.
- Motor de **diagnóstico/triagem** usado antes da abertura de chamado.
- Envio de e-mail transacional (recuperação de senha, OTP).
- Persistência em SQLite (padrão local) ou MySQL (produção), com camada de repositórios intercambiável.
- Auditoria de ações administrativas e controle de sessões.

Testes automatizados (Vitest) cobrem os principais serviços de negócio em `server/tests/`.

## Stack tecnológica

**Frontend**
- React 19 + React Router 7
- Vite
- Framer Motion (animações) e Lenis (smooth scroll)
- React Leaflet (mapas de cobertura)
- React Helmet Async (SEO)

**Backend**
- Node.js + TypeScript
- Fastify (+ `@fastify/cors`, `@fastify/helmet`, `@fastify/static`)
- Zod (validação)
- MySQL2 / SQLite nativo
- Nodemailer
- Vitest (testes)

## Como rodar localmente

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
cd server
npm install
cp .env.example .env   # preencher com as credenciais do SGP/SMTP
npm run dev
```

## Deploy

O deploy em produção (Hostinger) é feito via `deploy-hostinger.sh`: o build é sincronizado para um diretório novo e só então promovido com um `mv` atômico, evitando qualquer janela com arquivos de builds diferentes misturados no ar. O script também faz backup do banco local antes de cada deploy.

## Contato

📍 AcessaNet
🌐 https://acessanet.com.br
📱 0800 444 5799
