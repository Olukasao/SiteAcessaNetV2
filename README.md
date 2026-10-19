# AcessaNet — Site novo

Front-end do redesign do site da AcessaNet. O site anterior completo (Central do
Assinante, admin e backend) está preservado na branch `site-antigo`.

## Stack

React 19 + Vite 7 + react-router 7, framer-motion, GSAP/ScrollTrigger e
three.js (Terra 3D do topo, carregada sob demanda, com fallback em CSS para
aparelhos sem GPU, economia de dados ou `prefers-reduced-motion`).

## Rodar

```bash
npm install
npm run dev       # desenvolvimento (porta 4181)
npm run build
npm run preview   # serve o build na porta 4180
```

PM2 do lab: `ecosystem.config.cjs` serve o build em `0.0.0.0:4198`.

`?gl=force` / `?gl=off` na URL forçam ou desligam o 3D (testes).

## Autoria

Projeto, desenvolvimento e implementação original por Lucas Soares para
ACESSANET TELECON LTDA.

Registros de autoria e proveniência:

- `AUTHORS.md`
- `NOTICE.md`
- `CONTRIBUTING.md`
- `public/.well-known/authorship.json`

## Dados

Todos os preços, planos, benefícios, contatos e cidades atendidas estão em
`src/data/site.js`, copiados do site de produção. Pendências a confirmar:

- Benefícios do 800 Mega divergem entre a home e `/planos` da produção
  (união das duas listas, marcada em `pendingConfirmation`).
- Preço do "700 Mega + Telefone Fixo" assumido igual ao 700 Mega (R$ 114,99).

Cobertura: mesma regra da produção (ViaCEP → cidade → lista de cidades),
não é viabilidade por endereço.

## Páginas

`/` · `/planos` · `/empresas` · `/contratos` · `/boas-praticas-wifi`
(conteúdo do guia da produção com camada visual nova em
`src/guia-wifi/guiaWifi.lab.css`) · `/contratar` · `/cliente/*` (Central do Assinante).

### Contratação online (`/contratar?plano=<id>`)

Formulário em 3 etapas (plano e endereço, dados, revisão) aberto por todos os
botões "Quero este plano". Plano, preço e cidades atendidas vêm do backend
(`GET /api/contratacao/planos`); o envio grava a solicitação com protocolo
(`POST /api/contratacao/solicitacoes`) e ela aparece no admin em
`/admin/contratacoes`. A cobertura mostrada é por cidade; a viabilidade no
endereço é confirmada pela equipe comercial. Sem backend a página mostra o
erro com o WhatsApp como alternativa.

### Central do Assinante (`/cliente`)

Lógica, API e componentes trazidos da branch `site-antigo` para
`src/cliente/`, com o visual refeito no design system do site em
`src/cliente/styles/cliente.lab.css` (os CSS herdados foram remapeados para os
tokens de `tokens.css`). Roda fora do header/rodapé do site.

Precisa do backend da Central (`/api`, mesma origem em produção, ou
`VITE_ACESSANET_API_URL`). Sem backend, use o **modo demonstração**: CPF
`123.456.789-09` no login, tudo roda no navegador com dados fictícios. Em produção na Hostinger, `/cliente/*` usa este front com a API da mesma
origem. O deploy preserva os assets das versões anteriores para abas abertas.
Falhas de carregamento mostram uma ação para atualizar a página.

Texturas da Terra: NASA Blue Marble / Black Marble (domínio público).

## Publicar

### Vercel

A branch de produção é definida no painel do projeto na Vercel, em
**Settings > Environments > Production > Branch Tracking**. Confira a branch
selecionada antes de publicar. O `vercel.json` configura o build, as rotas e os
headers; ele não seleciona a branch de produção neste projeto.

Com a integração Git ativa, pushes na branch de produção geram deploys de produção;
outras branches podem gerar prévias, conforme a configuração do projeto.
Se a produção acompanha `main`, um push em `site-novo` não atualiza automaticamente
o domínio de produção. Nesse caso, publique as mudanças por um pull request para
`main` ou ajuste a branch acompanhada no painel da Vercel.

Referência: [Deploying Git Repositories with Vercel](https://vercel.com/docs/git).

### Hostinger

O site e o backend (`server/`) vão juntos para o app Node.js da Hostinger:

```bash
./deploy-hostinger.sh
```

O script, nesta ordem:

1. Faz backup do MySQL (clientes cadastrados), no servidor e em `backups/mysql/` nesta máquina.
2. Compila o site e o backend.
3. Envia tudo para pastas novas e só então troca o que está no ar, com `mv`.

O banco e o `.env` do servidor nunca são tocados. A versão anterior fica como
`public.previous-*`/`dist.previous-*` no servidor, para voltar atrás.

`/assinar-documento` e `/dados` ainda saem do `legacy.html` do site antigo, que o
script reaproveita do que já está no ar. Para recompilar o site antigo junto, rode
`LEGACY_DIR=~/Site-Acessanet ./deploy-hostinger.sh`.

> O código do site antigo fica na branch `site-antigo`.
