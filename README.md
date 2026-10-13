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
npm run preview   # serve o build na porta 4180 (usado no pm2: ecosystem.config.cjs)
```

`?gl=force` / `?gl=off` na URL forçam ou desligam o 3D (testes).

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
`src/guia-wifi/guiaWifi.lab.css`).

Texturas da Terra: NASA Blue Marble / Black Marble (domínio público).

## Publicar

### Vercel

A Vercel publica a branch `main` (configuração em `vercel.json`). Cada push na `main` gera um deploy novo;
outras branches geram links de prévia.

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
