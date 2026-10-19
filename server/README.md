# Backend do Site-Acessanet (Central do Assinante)

Backend próprio do site (autenticação, contrato, triagem, abertura de
chamado) — **não depende do repositório `AcessaNet app`**. Roda como
processo PM2 separado (`site-acessanet-server`, porta padrão `9531`).

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencher com as credenciais reais do SGP
npm run dev
```

## Estado da integração com o SGP (2026-09-26)

- `/api/ura/*` (consulta cliente, ocorrências) — funcionando, credenciais
  já configuradas.
- `SGP_CPF_SEARCH_FIELDS` — só `cpfcnpj` filtra de verdade nesta instância
  do SGP. Os outros nomes (`cpf_cnpj`, `cpfCnpj`, `cpf`) são ignorados pelo
  SGP e devolvem a base inteira de clientes sem filtro (~20s, ~3MB) — não
  adicionar de volta sem testar direto contra `/api/ura/clientes/` antes.
- `POST /api/central/chamado/` (abertura de chamado) — **implementado, mas
  bloqueado por permissão**: nem `SGP_TOKEN`/`SGP_APP` (conta "ura") nem
  `SGP_BASIC_USERNAME`/`SGP_BASIC_PASSWORD` têm acesso à família
  `/api/central/*` (confirmado: 403 em `/api/central/tipoocorrencia/list/`
  com as duas). **Falta gerar um token dedicado** no SGP
  (`Sistema → Ferramentas → Painel Admin → Tokens`, permissão "Central
  Assinante") e configurar `SGP_CHAMADO_APP`/`SGP_CHAMADO_TOKEN`.
- `SGP_CHAMADO_MAPPING` — preenchido. Decisão do usuário: toda
  classificação de triagem cai em `ocorrenciaTipo=1063` ("SUPORTE N1",
  confirmado via `/api/os/ocorrencia/tipo/list/`) com
  `motivoOs=6` ("REPARO", confirmado via `/api/os/ocorrencia/motivo/list/`).
  Não existe tipo/motivo próprio de "troca de senha de wifi" no catálogo do
  SGP, então essa classificação também cai em N1/REPARO. O detalhe do
  problema (qual sintoma, respostas da triagem) vai todo no `conteudo`, não
  no tipo.
- Catálogo completo de tipos/motivos salvo em `/tmp/sgp_tipos_os.json` e
  `/tmp/sgp_motivos.json` (105 tipos, 112 motivos) — útil se um dia quiser
  refinar o mapeamento além de "tudo N1".

## Integração OLT Cloud (detecção de queda coletiva) -- 2026-09-30

Somente leitura (`server/src/integrations/oltcloud`) -- usada para futuramente
avisar o cliente na Central quando ele estiver dentro de uma queda coletiva
(CTO/PON/OLT), sem depender só de bairro. Ainda **não está ligada a nenhuma
tela real** -- só existe o client, o classificador de incidente, a rota de
teste (`GET /api/debug/oltcloud/client-status/:contractId`, protegida por
`OLTCLOUD_DEBUG_TOKEN` e desligada em produção por padrão) e um componente
React de debug (`src/components/central/debug/OltCloudIncidentDebug.jsx`,
não importado em nenhuma rota).

- **Bloqueado por credenciais**: `OLTCLOUD_BASE_URL`/`OLTCLOUD_TOKEN` ainda
  não foram preenchidos no `.env` -- todo o código foi validado contra um
  mock HTTP local que reproduz o shape descrito na documentação
  (`GET /api/v2/ftth/alert/list`, `GET /api/v2/client/device_alert`), não
  contra a API real. Depois de preencher as credenciais, rodar
  `npm run test:oltcloud -- <contractId>` (ou
  `node scripts/test-oltcloud.js <contractId>`) para validar de ponta a
  ponta e confirmar o shape real das respostas.
- Critério de "incidente ativo" documentado em
  `incidentClassifier.ts` (`isActiveNetworkIncident`) -- `end_date == null`
  E `ignored !== true` E `active_devices_count` não zerado quando presente.
  `confirm_date` não entra no critério (é confirmação humana, não estado de
  rede).
- Tipos com regra própria: `cto_loss`, `pon_loss`, `no_power`. Qualquer
  outro `alert_type` é tratado como desconhecido (sem regra inventada).
- Mensagem aprovada pro cliente enquanto não houver integração com
  chamados/NOC: "Identificamos uma possível instabilidade que pode estar
  afetando sua conexão." -- nunca prometer "nossa equipe já está
  trabalhando" sem confirmação real de atendimento.
- GET-only, sem exceção -- nenhum código aqui deve chamar
  confirm/ignore/reactivate/POST/PUT/PATCH/DELETE da OLT Cloud.

## Deteccao de instabilidade regional -- 2026-09-30

Expande a integracao OLT Cloud (acima) pra responder "existe uma
instabilidade relevante perto deste cliente?" sem depender so do alerta
individual do contrato. Modulo: `server/src/services/networkIncidentDetection/`.

- **Dados reais usados**: bairro/cidade (SGP, `clientRegionResolver.ts`) e
  topologia OLT/PON/CTO (OLT Cloud, `networkTopologyResolver.ts`).
  **Coordenadas nao existem em lugar nenhum do backend** -- a clusterizacao
  por proximidade (`classifyProximityCluster`, Haversine) esta pronta e
  testada, mas fica inerte ate essa fonte de dado existir.
- **Motor de evidencias** (`regionalIncidentClassifier.ts`): agrupa alertas
  ativos da OLT Cloud por CTO/PON/OLT; `alert_type` oficial
  (`cto_loss`/`pon_loss`/`no_power`) vira `confirmed` direto -- nunca
  inventamos incidente se a API ja classifica. Sem tipo oficial, a confianca
  vem da contagem (`REGIONAL_INCIDENT_MIN_CLIENTS`, default 3): `<2` low
  (descartado), `2` medium, `>=min` high.
- **Correlacao sem alerta oficial**: quando o cliente consultado nao tem
  alerta na CTO/PON dele, `RegionalIncidentService.probeEquipmentNeighbors`
  cruza com `equipment/list?status=offline` da mesma OLT/PON (cache por
  `REGIONAL_INCIDENT_EQUIPMENT_PROBE_TTL_MS`).
- **Ciclo de vida** (`regionalIncidentRepository.ts`): baseado em frescor de
  evidencia, nao em "sumiu de uma lista" -- confirmed/suspected enquanto
  fresco, `recovering` apos a folga, `resolved` apos
  `REGIONAL_INCIDENT_RECOVERY_WINDOW_MINUTES` sem evidencia nova.
- **Nao existe roster de clientes por bairro** -- correlacao entre clientes
  DIFERENTES pelo bairro nao e feita (exigiria varrer o SGP inteiro, fora de
  escopo). Bairro so serve hoje como contexto informativo pontual, nunca
  como criterio de deteccao cruzada.
- **Endpoint publico**: `GET /api/central/network-status` (sessao de
  cliente obrigatoria, `contractId` opcional na query mas sempre validado
  por `OwnershipService` -- 404 igual pra "nao existe" e "nao e seu"). Nunca
  serializa topologia/confidence/incidentId.
- **Endpoint interno**: `GET /admin/api/network-incidents` (sessao admin) --
  lista completa com OLT/PON/CTO, so backend por enquanto (sem tela React
  dedicada ainda).
- **Frontend**: `src/components/central/NetworkIncidentBanner.jsx` +
  `getNetworkStatus()` em `clienteApi.js` -- componente pronto, mas **ainda
  nao montado em nenhuma pagina de producao** (precisa ser importado na home
  da Central e testado no navegador antes de ir pra producao de verdade).
- Testes: `tests/regionalIncidentDetection.test.ts` (9 casos pedidos +
  cenario mock "Jardim Luciana" + ciclo de vida do repositorio).

## Próximo passo pra abertura de chamado funcionar de ponta a ponta

1. Gerar o token dedicado pra "Central Assinante" no SGP.
2. Preencher `SGP_CHAMADO_APP`/`SGP_CHAMADO_TOKEN` no `.env`.
3. `pm2 restart site-acessanet-server`.
4. Teste controlado: login real → triagem → abrir chamado → conferir no
   painel do SGP que o chamado apareceu na fila N1 com o `conteudo` completo.
