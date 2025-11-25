import { NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";

const CACHE_FILE_PATH_REMOTE = "/mnt/cache_remoto/processos_cache.json";

const CACHE_FILE_PATH_BACKUP_LOCAL =
  "/home/joaovitor/teste/app/data/processos_cache.json";

/**
 * Lê o cache JSON do disco (Simula a leitura do compartilhamento Samba).
 * @throws {Error} Se o arquivo não puder ser lido (simulando falha de rede/Máquina 2).
 */
async function getProcessCache() {
  // 1. Tente ler do caminho remoto (Samba)
  try {
    const data = await fs.readFile(CACHE_FILE_PATH_REMOTE, "utf-8");

    // 🚨 SUCESSO na leitura remota: Atualize a cópia local de backup
    await fs.writeFile(CACHE_FILE_PATH_BACKUP_LOCAL, data, "utf-8");

    return JSON.parse(data);
  } catch (error) {
    // 2. FALHA: Se a leitura remota falhar, tente ler o backup local.
    console.warn("⚠️ Leitura remota falhou. Tentando backup local...");
    try {
      const backupData = await fs.readFile(
        CACHE_FILE_PATH_BACKUP_LOCAL,
        "utf-8"
      );
      return JSON.parse(backupData);
    } catch (backupError) {
      // 3. FALHA TOTAL: O backup local também falhou.
      console.error("❌ Falha total: Backup local também inacessível.");
      throw new Error(
        "Sistema indisponível: Falha no cache primário e backup."
      );
    }
  }
}

export async function GET(request: Request) {
  // 👈 Adicionar o tipo Request
  const { searchParams } = new URL(request.url);
  const processo = searchParams.get("numero");

  if (!processo) {
    return NextResponse.json(
      { message: "Número do processo é obrigatório." },
      { status: 400 }
    );
  }

  try {
    // 1. Tenta carregar TODO o cache
    const cache = await getProcessCache();

    // 2. Procura o processo no cache carregado
    const processData = cache[processo];

    if (!processData) {
      // Retorno 404 - Processo não encontrado no cache
      return NextResponse.json(
        { message: "Processo não encontrado" },
        { status: 404 }
      );
    }

    // Retorno 200 - Sucesso
    return NextResponse.json(processData, { status: 200 });
  } catch (error) {
    // 🚨 Este catch pega o erro lançado por getProcessCache()
    const errorMessage =
      error instanceof Error ? error.message : "Erro interno do servidor.";

    // Retorno 500. Retornar 500 aqui é crucial para simular a falha de rede/scraper
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
