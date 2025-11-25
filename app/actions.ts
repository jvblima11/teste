"use server";

import { promises as fs } from "fs";
import path from "path";

// Define a interface para a estrutura dos dados JSON.
export interface Process {
  processo: string;
  unidade: string;
  tipo_tabela: string;
  dias: number;
  posição: number;
}

// Define a interface para os dados de cada tipo de tabela.
export interface TabelaSummary {
  tipo_tabela: string;
  quantidadeProcessos: number;
  mediaDias: number;
}

export interface TabelaDetails {
  tipo_tabela: string;
  quantidadeProcessos: number;
  dias: number;
  percentualIntervaloDias: number;
}
/**
 * Lê o arquivo JSON e retorna os dados brutos.
 * Este é um utilitário do lado do servidor.
 * @returns {Promise<Process[]>} Um array de objetos Process.
 */
const readProcessesData = async (): Promise<Process[]> => {
  try {
    // Define o caminho para a pasta onde os arquivos JSON estão localizados.
    // process.cwd() retorna o diretório de trabalho atual do Node.js.
    const directoryPath = path.join(process.cwd(), "./src/app/data");

    // Lê todos os arquivos do diretório.
    const files = await fs.readdir(directoryPath, "utf8");

    // Filtra os arquivos para encontrar apenas aqueles que correspondem ao padrão.
    const validFiles = files.filter(
      (fileName) =>
        fileName.startsWith("tabela_processos") && fileName.endsWith(".json")
    );

    if (validFiles.length === 0) {
      console.error(
        "Nenhum arquivo 'tabela_processos.json' encontrado no diretório."
      );
      return [];
    }

    // Cria um array de promessas para obter as informações de cada arquivo (data de modificação).
    const fileStatsPromises = validFiles.map(async (fileName) => {
      const fullPath = path.join(directoryPath, fileName);
      const stats = await fs.stat(fullPath);
      return {
        name: fileName,
        mtime: stats.mtime.getTime(), // mtime é a data de modificação
      };
    });

    // Resolve todas as promessas e obtém as informações de todos os arquivos.
    const fileStats = await Promise.all(fileStatsPromises);

    // Ordena os arquivos pela data de modificação, do mais recente para o mais antigo.
    fileStats.sort((a, b) => b.mtime - a.mtime);

    // O arquivo mais recente está no topo da lista.
    const mostRecentFile = fileStats[0];
    const filePath = path.join(directoryPath, mostRecentFile.name);

    console.log("🚀 Lendo o arquivo mais recente:", filePath);

    // Lê o conteúdo do arquivo mais recente.
    const fileContent = await fs.readFile(filePath, "utf8");
    const allProcesses = JSON.parse(fileContent);

    if (!Array.isArray(allProcesses)) {
      console.error("Erro: O arquivo JSON não contém um array de processos.");
      return [];
    }

    // Retorna os dados dos processos.
    return allProcesses;
  } catch (error) {
    console.error("Falha ao ler o arquivo JSON:", error);
    return [];
  }
};

/**
 * Retorna um resumo dos processos, agrupados por tipo_tabela e filtrados por unidade.
 * Esta é a Server Action que será chamada pelo componente cliente.
 *
 * @param {string} unidade - A unidade para filtrar os dados (ex: 'Setor A', 'Setor B').
 * @returns {Promise<TabelaSummary[]>} Um array de resumos de tabela.
 */
export const getTabelasSummaryByUnidade = async (
  unidade: string
): Promise<TabelaSummary[]> => {
  try {
    const allProcesses = await readProcessesData();
    const processesByUnidade = allProcesses.filter(
      (process) => process.unidade === unidade
    );

    // Verifica se a filtragem retornou algum dado.
    if (processesByUnidade.length === 0) {
      return [];
    }

    const summaryMap = new Map<string, { totalDias: number; count: number }>();

    // Variação mais robusta da validação:
    // 1. Converte o valor de 'dias' para um número de ponto flutuante.
    // 2. Verifica se o resultado é um número finito e maior ou igual a zero.
    const validProcesses = processesByUnidade.filter((process) => {
      const diasAsNumber = parseFloat(process.dias as unknown as string);
      return Number.isFinite(diasAsNumber) && diasAsNumber > 0;
    });

    // Se a lista de processos válidos estiver vazia, retorna um array vazio
    if (validProcesses.length === 0) {
      return [];
    }

    // Depois, percorre apenas a lista de processos válidos.
    validProcesses.forEach((process) => {
      if (!summaryMap.has(process.tipo_tabela)) {
        summaryMap.set(process.tipo_tabela, { totalDias: 0, count: 0 });
      }

      const current = summaryMap.get(process.tipo_tabela)!;
      current.totalDias += parseFloat(process.dias as unknown as string);
      current.count++;
    });

    const summaryArray: TabelaSummary[] = [];
    summaryMap.forEach((value, key) => {
      const averageRounded = Math.ceil(value.totalDias / value.count);
      summaryArray.push({
        tipo_tabela: key,
        mediaDias: value.count > 0 ? averageRounded : 0,
        quantidadeProcessos: value.count,
      });
    });

    return summaryArray;
  } catch (error) {
    console.error("Erro ao processar o resumo dos dados:", error);
    return [];
  }
};

/**
 * Encontra um processo específico pelo seu número e retorna os dados.
 * @param {string} numeroDoProcesso - O número do processo a ser encontrado.
 * @returns {Promise<Process | undefined>} O objeto Process ou undefined se não for encontrado.
 */
export const getProcessByNumber = async (
  numeroDoProcesso: string
): Promise<Process | undefined> => {
  const processes = await readProcessesData();
  return processes.find((process) => process.processo === numeroDoProcesso);
};

/**
 * Calcula a média geral de dias para todos os processos de uma unidade específica.
 * @param {string} unidade - A unidade para filtrar os dados.
 * @returns {Promise<number>} A média de dias de todos os processos da unidade.
 */
export const getOverallAverageDaysByUnidade = async (
  unidade: string
): Promise<number> => {
  const allProcesses = await readProcessesData();
  const processesByUnidade = allProcesses.filter(
    (process) => process.unidade === unidade
  );
  if (processesByUnidade.length === 0) {
    return 0;
  }
  const totalDays = processesByUnidade.reduce(
    (sum, process) => sum + process.dias,
    0
  );
  return parseFloat((totalDays / processesByUnidade.length).toFixed(2));
};

export async function getProcessosByUnidadeAndTabela(
  tipoTabela: string,
  unidade: string
): Promise<Process[] | null> {
  try {
    // Lê todos os processos do seu arquivo JSON.
    const allProcesses = await readProcessesData();

    // Filtra os processos com base na unidade e no tipo de tabela.
    const filteredProcesses = allProcesses.filter(
      (process) =>
        process.unidade === unidade && process.tipo_tabela === tipoTabela
    );

    // Se a lista filtrada tiver elementos, a retorna.
    if (filteredProcesses.length > 0) {
      return filteredProcesses;
    }

    // Caso contrário, retorna null.
    return null;
  } catch (error) {
    console.error("Erro ao buscar processos por unidade e tabela:", error);
    return null;
  }
}

export async function getDetailsByUnidadeAndTabela(
  tipoTabela: string,
  unidade: string,
  dias: number
): Promise<TabelaDetails | null> {
  try {
    const processes = await getProcessosByUnidadeAndTabela(tipoTabela, unidade);

    if (!processes || processes.length === 0) {
      return null;
    }

    const quantidadeProcessos = processes.length;
    let intervaloProcessos = 0;

    processes.forEach((process) => {
      const diasAsNumber = parseFloat(process.dias as unknown as string);

      if (
        Number.isFinite(diasAsNumber) &&
        diasAsNumber > 0 &&
        diasAsNumber <= dias
      ) {
        intervaloProcessos++;
      }
    });

    const percent = parseFloat(
      ((intervaloProcessos / quantidadeProcessos) * 100).toFixed(2)
    );

    return {
      tipo_tabela: tipoTabela,
      quantidadeProcessos: quantidadeProcessos,
      dias: intervaloProcessos,
      percentualIntervaloDias: percent,
    };
  } catch (error) {
    console.error(
      `Erro ao calcular detalhes para Tabela: ${tipoTabela}, Unidade: ${unidade}`,
      error
    );

    return null;
  }
}

export async function getInvalidProcessesDetails(
  tipoTabela: string,
  unidade: string
): Promise<{
  tipo_tabela: string;
  quantidadeProcessosInvalidos: number;
  totalGeralProcessos: number;
} | null> {
  try {
    // 1. Lê todos os processos.
    const allProcesses = await readProcessesData();

    // 2. Filtra pelo tipoTabela e unidade.
    const processes = allProcesses.filter(
      (process) =>
        process.unidade === unidade && process.tipo_tabela === tipoTabela
    );

    if (processes.length === 0) {
      return null;
    }

    const totalGeralProcessos = processes.length;
    let quantidadeProcessosInvalidos = 0;

    // 3. Itera e conta os processos inválidos.
    processes.forEach((process) => {
      // Tenta converter 'dias' para número. Ele pode ser um número, string, null, ou undefined.
      const diasValue = process.dias as unknown;

      // Verifica se o valor é null, undefined, ou se a conversão resulta em não-finito (NaN)
      // ou se é um número menor ou igual a zero (0 ou negativo).

      const isNullOrUndefined = diasValue === null || diasValue === undefined;

      const diasAsNumber = parseFloat(diasValue as string);

      // Um processo é inválido se:
      // a) O valor original é null/undefined (ou nem existe).
      // b) O valor convertido não é um número finito (inclui NaN).
      // c) O valor é 0 ou negativo.
      const isNotValidNumberOrNegative =
        !Number.isFinite(diasAsNumber) || diasAsNumber <= 0;

      // Se qualquer uma dessas condições for verdadeira, o processo é inválido
      if (isNullOrUndefined || isNotValidNumberOrNegative) {
        quantidadeProcessosInvalidos++;
      }
    });

    return {
      tipo_tabela: tipoTabela,
      quantidadeProcessosInvalidos: quantidadeProcessosInvalidos,
      totalGeralProcessos: totalGeralProcessos,
    };
  } catch (error) {
    console.error("Erro ao buscar detalhes de processos inválidos:", error);
    return null;
  }
}
