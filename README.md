# AcessaNet — Site novo (lab)

Front-end experimental do redesign do site da AcessaNet. **Não substitui a
`main`**: lá fica o site de produção completo (Central do Assinante, admin e
backend). Esta branch contém só o front-end novo, para validação.

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
