// src/app/busca/page.jsx
"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Defina a interface para o formato de dados esperado da API
interface ProcessData {
  processo: string;
  dias: number;
  tipo_tabela: string;
  unidade: string;
  posição: number; // Chave com cedilha
  local?: string;
}

const BuscaPage = () => {
  const [termoBusca, setTermoBusca] = useState("");
  const [resultado, setResultado] = useState<React.ReactNode | null>(null);
  const [loading, setLoading] = useState(false);

  // Função que lida com a formatação e atualização do estado do input
  const handleProcessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove tudo que não for dígito
    const value = e.target.value.replace(/\D/g, "");
    let formattedValue = "";

    // Lógica para adicionar pontos e hífens
    if (value.length > 0) formattedValue += value.substring(0, 4);
    if (value.length > 4) formattedValue += "." + value.substring(4, 10);
    if (value.length > 10) formattedValue += "/" + value.substring(10, 14);
    if (value.length > 14) formattedValue += "-" + value.substring(14, 16);

    // Limita o tamanho total
    if (formattedValue.length > 19)
      formattedValue = formattedValue.substring(0, 19);

    setTermoBusca(formattedValue);
  };

  const router = useRouter();

  const buscaProcesso = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const processo = termoBusca.trim();
    // Regex ajustada para checar apenas o formato final (com 19 caracteres)
    const regex = /^\d{4}\.\d{6}\/\d{4}-\d{2}$/;

    // 1. VALIDAÇÃO DO FORMATO
    if (!regex.test(processo)) {
      setResultado(
        <p className="mensagem text-red-500">
          Digite o processo no formato correto: xxxx.xxxxxx/xxxx-xx
        </p>
      );
      return;
    }

    setLoading(true); // Inicia o estado de carregamento

    // Monta a URL da API, codificando o número do processo
    const apiUrl = `/api/processo?numero=${encodeURIComponent(processo)}`;

    try {
      const response = await fetch(apiUrl);

      if (response.ok) {
        const processoEncontrado: ProcessData = await response.json();

        console.log("Dados recebidos da API:", processoEncontrado);

        // 2. RENDERIZAÇÃO DA TABELA COMPLETA
        // Refinamento: Adiciona uma validação final para garantir que o objeto não é nulo/vazio.
        if (processoEncontrado) {
          setResultado(
            <div className="relative overflow-x-auto shadow-md sm:rounded-lg w-full md:w-4/6 mx-auto">
              <table className="w-full text-sm text-left rtl:text-right text-gray-500">
                <thead className="text-xs bg-gray-300 text-gray-700 uppercase">
                  <tr>
                    <th scope="col" className="px-6 py-3">
                      Posição na Fila
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Processo
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Dias
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Marcador no SEI
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Unidade COMRAR
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white border-b border-gray-200">
                    {/* Mapeamento das chaves do JSON para a tabela */}
                    <td className="px-6 py-4">{processoEncontrado.posição}</td>
                    <td className="px-6 py-4">{processoEncontrado.processo}</td>
                    <td className="px-6 py-4">{processoEncontrado.dias}</td>
                    <td className="px-6 py-4">
                      {processoEncontrado.tipo_tabela}
                    </td>
                    <td className="px-6 py-4">{processoEncontrado.unidade}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        }
      } else {
        // 3. TRATAMENTO DE ERROS (Status 4xx, 5xx)
        const errorData = await response.json();

        const isNotFound = response.status === 404;
        const errorMessage = isNotFound
          ? "Processo não encontrado, ou não inserido na fila de análise"
          : errorData.message || "Ocorreu um erro ao buscar o processo.";

        setResultado(
          <div className="justify-content-center align-items-center text-center">
            <p className="mensagem text-red-500">{errorMessage}</p>
            <p className="mensagem text-red-500">
              Entre em contato pelo n&uacute;mero: <b>3212-9665</b>
            </p>
          </div>
        );
      }
    } catch (error) {
      // Erro de rede/conexão
      console.error("Erro de rede/API:", error);
      setResultado(
        <p className="mensagem text-red-500">
          Ocorreu um erro de conexão ao buscar o processo. Por favor, tente
          novamente.
        </p>
      );
    } finally {
      setLoading(false); // Finaliza o estado de carregamento
    }
  };

  return (
    <div className="bg-gray-200 min-h-screen pt-10">
      <div className="container mx-auto p-5 bg-white border border-slate-950 rounded-md max-w-5xl">
        <div className="flex items-center justify-between mb-3 gap-x-2">
          <Image src="/icons/CAR.png" alt="car" width={64} height={64} />
          <h2 className="text-black">
            COMRAR - Coordenadoria de Regulariza&ccedil;&atilde;o Ambiental
            Rural
          </h2>
          <Image src="/icons/PPRA.png" alt="car" width={64} height={64} />
        </div>
        <div className="border-t border-gray-300">
          <h1 className="font-bold my-2 text-black">
            Buscar Processo da Coordenadoria de Regulariza&ccedil;&atilde;o
            Ambiental Rural COMRAR
          </h1>
        </div>
        {/* O formulário agora envolve o input e o botão */}
        <form onSubmit={buscaProcesso}>
          <div className="flex mb-2 gap-1 justify-center items-center">
            <label className="text-sm text-black" htmlFor="buscaProcesso">
              Digite o n&uacute;mero do processo:
            </label>
            <br />
            <input
              className="flex text-center border border-slate-600 rounded text-sm text-slate-800"
              type="text"
              id="buscaProcesso"
              name="buscaProcesso"
              placeholder="0000.000000/0000-00"
              maxLength={19}
              value={termoBusca}
              onChange={handleProcessChange}
            />
          </div>
          <div className="buttomContainer flex gap-2">
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-green-700 cursor-pointer"
              disabled={loading}
            >
              {loading ? "Buscando..." : "✅ Confirmar"}
            </button>
          </div>
        </form>

        <div className="flex items-center justify-center mt-10 w-full">
          {/* O resultado é renderizado aqui */}
          {resultado}
        </div>

        <footer className="text-center py-4 text-sm text-black mt-10 border-t border-gray-300">
          <p>
            &copy; Coordenadoria de Regulariza&ccedil;&atilde;o Ambiental Rural.
            Todos os direitos reservados.
          </p>
          <p>
            <strong>Endere&ccedil;o</strong> Estr. de Santo Ant&ocirc;nio, 5323
            - Tri&acirc;ngulo - Porto Velho - Rond&ocirc;nia, 76805-809
          </p>
        </footer>
      </div>
    </div>
  );
};

export default BuscaPage;
