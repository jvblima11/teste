import { NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";

// 🚨 CAMINHOS DE ACESSO AO CACHE (REMOTO e LOCAL)

// 1. Primário: Caminho para a pasta compartilhada com o Samba (Mantido, mas provavelmente inacessível no seu dev local)
const CACHE_FILE_PATH_REMOTE = "/mnt/cache_remoto/tabela_processos.json";

// 2. Backup: Caminho local (ADAPTADO para rodar com 'npm run dev' no seu projeto)
// Usa process.cwd() para apontar para a raiz do seu projeto Next.js, seguido por public/data
const CACHE_FILE_PATH = path.join(
  process.cwd(),
  "data",
  "tabela_processos.json"
);

/**
 * Tenta ler o arquivo JSON em um determinado caminho.
 * @param filePath O caminho do arquivo a ser lido.
 * @returns O conteúdo do arquivo como string.
 */
async function readFileSafe(filePath: string): Promise<string> {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    console.log(`✅ Arquivo de cache lido com sucesso em: ${filePath}`);
    return data;
  } catch (error) {
    throw error;
  }
}

/**
 * Salva o conteúdo lido do cache remoto no cache local.
 * Esta função agora TENTA CRIAR O DIRETÓRIO se ele não existir, para resolver o ENOENT.
 * @param content O conteúdo do arquivo lido.
 */
async function updateLocalCache(content: string): Promise<void> {
  const dirPath = path.dirname(CACHE_FILE_PATH);
  console.log(`⚠️ Tentando atualizar o cache local: ${CACHE_FILE_PATH}`);
  try {
    // Garante que o diretório exista antes de tentar escrever o arquivo
    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(CACHE_FILE_PATH, content, "utf-8");
    console.log(`✅ Cache local atualizado com sucesso em: ${CACHE_FILE_PATH}`);
  } catch (error) {
    console.error(
      `❌ AVISO: Falha ao atualizar o cache local. Erro: ${
        (error as Error).message
      }`
    );
  }
}

/**
 * Tenta ler o cache JSON, priorizando o caminho remoto e usando o local como backup.
 * SE A LEITURA REMOTA FOR BEM-SUCEDIDA, ELE ATUALIZA O CACHE LOCAL.
 */
async function getProcessCache(): Promise<any[]> {
  let fileContent: string;
  let attemptPath: string;
  let isRemoteSuccess = false;
  let lastAttemptedPath = ""; // Para logs de erro

  // 1. TENTATIVA REMOTA (Samba)
  attemptPath = CACHE_FILE_PATH_REMOTE;
  lastAttemptedPath = attemptPath;
  console.log(`⚠️ Tentando ler o cache primário (Samba): ${attemptPath}`);

  try {
    fileContent = await readFileSafe(attemptPath);
    isRemoteSuccess = true;
  } catch (remoteError) {
    console.warn(
      `❌ Falha na leitura remota. Tentando o cache local. Erro: ${
        (remoteError as Error).message
      }`
    );

    // 2. TENTATIVA LOCAL (Dev Local)
    attemptPath = CACHE_FILE_PATH;
    lastAttemptedPath = attemptPath;
    console.log(
      `⚠️ Tentando ler o cache de backup (Local/Dev): ${attemptPath}`
    );

    try {
      fileContent = await readFileSafe(attemptPath);
    } catch (localError) {
      console.error(
        `❌ Falha total: O cache local também falhou. Erro: ${
          (localError as Error).message
        }`
      );
      throw localError;
    }
  }

  // 🚨 ATUALIZAÇÃO: Se o remoto foi lido com sucesso, atualiza o local (que agora é public/data)
  if (isRemoteSuccess) {
    await updateLocalCache(fileContent);
  }

  // Se chegarmos aqui, fileContent contém dados lidos com sucesso de algum dos caminhos.
  try {
    const parsedData = JSON.parse(fileContent);

    if (!Array.isArray(parsedData)) {
      throw new Error(
        "Conteúdo do arquivo JSON inválido. A API espera uma lista (Array) de objetos."
      );
    }

    return parsedData;
  } catch (error) {
    let errorMessage: string;
    let statusCode: number = 503;

    if (error instanceof Error && error.name === "SyntaxError") {
      errorMessage =
        "Erro de parse: O conteúdo do arquivo JSON está corrompido ou mal formatado.";
      statusCode = 500;
    } else {
      errorMessage = `Falha no processamento do cache em ${lastAttemptedPath}: ${
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
      { status: 400 }
    );
  }

  processo = decodeURIComponent(processo || "").trim();

  try {
    const cacheArray = await getProcessCache();

    const processData = cacheArray.find((item) => item.processo === processo);

    if (!processData) {
      return NextResponse.json(
        {
          message: "Processo não encontrado ou ainda não analisado.",
          details: `Chave buscada: ${processo}`,
        },
        { status: 404 }
      );
    }

    // ⭐️ RETORNA APENAS O LOCAL, CONFORME SEU CÓDIGO ATUAL
    return NextResponse.json(processData, { status: 200 });
  } catch (error) {
    const statusCode =
      error instanceof Error && "statusCode" in error
        ? (error as any).statusCode
        : 500;

    const errorMessage =
      error instanceof Error ? error.message : "Erro interno desconhecido.";

    return NextResponse.json({ message: errorMessage }, { status: statusCode });
  }
}
