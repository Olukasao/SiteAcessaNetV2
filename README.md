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
`src/guia-wifi/guiaWifi.lab.css`) · `/cliente/*` (Central do Assinante).

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

```bash
npm ci
npm run build
```

Envie **o conteúdo** da pasta `dist/` (não a pasta em si) para `public_html/` pelo Gerenciador de Arquivos
ou FTP. O `dist/.htaccess` (vem de `public/.htaccess`) já faz as rotas `/planos`, `/contratos` etc.
funcionarem, força HTTPS e configura cache. Arquivos ocultos precisam estar visíveis no gerenciador para
o `.htaccess` ir junto.

> O site antigo completo (Central do Assinante, admin e backend) fica na branch `site-antigo`.
