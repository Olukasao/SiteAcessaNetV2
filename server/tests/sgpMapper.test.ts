import { describe, expect, it } from "vitest";
import { mapSgpCustomer } from "../src/integrations/sgp/sgpMapper.js";

/**
 * Regressao de um vazamento de dados real confirmado em producao: id de
 * CLIENTE e id de CONTRATO compartilham a mesma sequencia numerica no SGP.
 * Um cliente sem nenhum contrato aninhado (ex.: cadastro de teste) tinha seu
 * PROPRIO id de cliente erroneamente tratado como "contractId" -- e esse id
 * podia colidir com o contratoId real de OUTRO cliente. Caso real: cliente
 * id 34007 (sem contrato algum) colidiu com o contratoId 34007, que
 * pertencia a um cliente completamente diferente -- o contrato "fantasma"
 * aparecia na Central e, ao ser consultado, trazia endereco/plano/fatura do
 * outro cliente.
 */
describe("mapSgpCustomer (isolamento de contratos)", () => {
  const CPF = "39581323830";

  it("usa so os contratos ANINHADOS de um cliente -- nunca o id do proprio cliente", () => {
    const rawClientes = [
      {
        id: 18277,
        nome: "Cliente Um",
        cpfcnpj: "395.813.238-30",
        contratos: [{ id: 19754, status: "Cancelado" }]
      }
    ];

    const mapped = mapSgpCustomer(CPF, rawClientes);

    expect(mapped?.contracts.map((c) => c.id)).toEqual(["19754"]);
  });

  it("CAUSA RAIZ: cliente sem nenhum contrato aninhado nunca contribui um 'contrato fantasma' com o proprio id de cliente", () => {
    const rawClientes = [
      {
        id: 18277,
        nome: "Cliente Um",
        cpfcnpj: "395.813.238-30",
        contratos: [{ id: 19754, status: "Ativo" }]
      },
      {
        // Cadastro de teste/incompleto -- tem CPF valido, mas nenhum contrato de verdade.
        id: 34007,
        nome: "Cliente Teste Sem Contrato",
        cpfcnpj: "395.813.238-30",
        contratos: []
      }
    ];

    const mapped = mapSgpCustomer(CPF, rawClientes);

    expect(mapped?.contracts.map((c) => c.id)).toEqual(["19754"]);
    expect(mapped?.contracts.some((c) => c.id === "34007")).toBe(false);
  });

  it("CENARIO DE COLISAO: o id de cliente sem contrato nunca aparece, mesmo quando numericamente igual a um contrato real de outro cliente", () => {
    // Simula exatamente o caso real: id de cliente 34007 (sem contrato) colide
    // com um contratoId 34007 que pertenceria a outra pessoa em outro lugar do
    // SGP. O mapeamento deste CPF nunca pode produzir "34007" como contrato.
    const rawClientes = [
      {
        id: 34007,
        nome: "Cliente Teste Sem Contrato",
        cpfcnpj: "395.813.238-30",
        contratos: []
      }
    ];

    const mapped = mapSgpCustomer(CPF, rawClientes);

    expect(mapped?.contracts).toEqual([]);
  });

  it("aceita um registro de contrato 'chato' (sem wrapper de cliente) quando o cpf proprio bate com o pesquisado", () => {
    const rawContratos = [
      {
        contratoId: 40773,
        clienteId: 33682,
        cpfCnpj: "395.813.238-30",
        servico_plano: "Plano X"
      }
    ];

    const mapped = mapSgpCustomer(CPF, rawContratos);

    expect(mapped?.contracts.map((c) => c.id)).toEqual(["40773"]);
  });

  it("DEFESA EXTRA: rejeita um registro de contrato 'chato' cujo cpf proprio NAO bate com o CPF pesquisado", () => {
    const rawContratos = [
      {
        contratoId: 34007,
        clienteId: 26983,
        cpfCnpj: "418.827.978-84", // CPF de outra pessoa, nao do CPF pesquisado (39581323830)
        servico_plano: "Plano de outro cliente"
      }
    ];

    const mapped = mapSgpCustomer(CPF, rawContratos);

    expect(mapped?.contracts).toEqual([]);
  });
});
