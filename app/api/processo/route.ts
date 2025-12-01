import { NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";

// 🚨 CAMINHOS DE ACESSO AO CACHE (REMOTO e LOCAL)

// 1. Primário: Caminho para a pasta compartilhada com o Samba
const CACHE_FILE_PATH_REMOTE = "/mnt/cache_remoto/processos_cache.json";

// 2. Backup: Caminho local (dentro do contêiner Docker)
const CACHE_FILE_PATH = "/teste/data/tabela_processos.json";

/**
 * Tenta ler o arquivo JSON em um dos caminhos, começando pelo remoto.
 * Se o caminho primário falhar, tenta o caminho de backup.
 * @param filePath O caminho do arquivo a ser lido.
 * @returns O conteúdo do arquivo como string.
 */
async function readFileSafe(filePath: string): Promise<string> {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    console.log(`✅ Arquivo de cache lido com sucesso em: ${filePath}`);
    return data;
  } catch (error) {
    // Se falhar (e o erro não for uma sintaxe de JSON corrompida), lançamos
    // o erro para o bloco catch de getProcessCache tentar o próximo caminho.
    throw error;
  }
}

/**
 * Tenta ler o cache JSON, priorizando o caminho remoto e usando o local como backup.
 * Agora espera-se que o cache seja um ARRAY de objetos, e a busca será feita
 * por iteração (Busca Linear).
 */
async function getProcessCache(): Promise<any[]> {
  // Alterado para retornar um Array
  let fileContent: string;
  let attemptPath: string;

  // 1. TENTATIVA REMOTA (Samba)
  attemptPath = CACHE_FILE_PATH_REMOTE;
  console.log(`⚠️ Tentando ler o cache primário (Samba): ${attemptPath}`);

  try {
    fileContent = await readFileSafe(attemptPath);
  } catch (remoteError) {
    // A leitura remota falhou (pode ser problema de rede, permissão ou arquivo inexistente)
    console.warn(
      `❌ Falha na leitura remota. Tentando o cache local. Erro: ${
        (remoteError as Error).message
      }`
    );

    // 2. TENTATIVA LOCAL (Docker)
    attemptPath = CACHE_FILE_PATH;
    console.log(`⚠️ Tentando ler o cache de backup (Local): ${attemptPath}`);

    try {
      fileContent = await readFileSafe(attemptPath);
    } catch (localError) {
      // Se a leitura local também falhar, lançamos o erro final.
      console.error(
        `❌ Falha total: O cache local também falhou. Erro: ${
          (localError as Error).message
        }`
      );
      // Lança o erro de volta para o bloco catch principal.
      throw localError;
    }
  }

  // Se chegarmos aqui, fileContent contém dados lidos com sucesso de algum dos caminhos.
  try {
    const parsedData = JSON.parse(fileContent);

    // VALIDAÇÃO CRUCIAL: Agora verificamos se o conteúdo JSON é um ARRAY
    if (!Array.isArray(parsedData)) {
      throw new Error(
        "Conteúdo do arquivo JSON inválido. A API espera uma lista (Array) de objetos."
      );
    }

    return parsedData;
  } catch (error) {
    // Captura erros de parsing ou validação de Array
    let errorMessage: string;
    let statusCode: number = 503; // Service Unavailable padrão

    if (error instanceof Error && error.name === "SyntaxError") {
      // Erro de JSON inválido.
      errorMessage =
        "Erro de parse: O conteúdo do arquivo JSON está corrompido ou mal formatado.";
      statusCode = 500; // Internal Server Error
    } else {
      errorMessage = `Falha no processamento do cache em ${attemptPath}: ${
        error instanceof Error ? error.message : "Erro desconhecido."
      }`;
    }

    console.error(`❌ Falha no processamento do cache: ${errorMessage}`);

    const customError = new Error(errorMessage);
    (customError as any).statusCode = statusCode;
    throw customError;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let processo = searchParams.get("numero");

  if (!processo) {
    return NextResponse.json(
      { message: "Número do processo é obrigatório." },
      { status: 400 } // Bad Request
    );
  }

  // Decodifica a URL e remove espaços extras.
  processo = decodeURIComponent(processo || "").trim();

  try {
    // 1. Tenta carregar TODO o cache (agora um Array, com lógica de failover)
    const cacheArray = await getProcessCache();

    // 2. Procura o processo ITERANDO sobre o Array (Busca Linear)
    // O backend espera encontrar o campo 'processo' dentro de cada objeto.
    const processData = cacheArray.find((item) => item.processo === processo);

    if (!processData) {
      // Retorno 404 - Processo não encontrado no cache
      return NextResponse.json(
        {
          message: "Processo não encontrado ou ainda não analisado.",
          details: `Chave buscada: ${processo}`,
        },
        { status: 404 }
      );
    }

    // Retorno 200 - Sucesso
    return NextResponse.json(processData, { status: 200 });
  } catch (error) {
    // Captura o erro e tenta obter o statusCode customizado que foi anexado
    const statusCode =
      error instanceof Error && "statusCode" in error
        ? (error as any).statusCode
        : 500;

    const errorMessage =
      error instanceof Error ? error.message : "Erro interno desconhecido.";

    // Retorno de erro
    return NextResponse.json({ message: errorMessage }, { status: statusCode });
  }
}
