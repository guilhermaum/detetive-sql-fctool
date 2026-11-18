import "./style.css";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { useGame } from "../../../context/game";
import { executeLevelQuery } from "../../../services/game-sessions";
import ModalDiagram from "../../../components/Modal/Diagram";
import IconPlay from "../../../components/Icons/IconPlay";
import IconImage from "../../../components/Icons/IconImage";
import { emitFctoolEvent } from "../../../services/fctool";

type QueryRow = Record<string, unknown>;
type QueryForm = { query: string };

function getApiError(error: any): { message: string; result?: QueryRow[] } {
  const response = error?.response?.data;
  return {
    message:
      response?.error ??
      response?.message ??
      "Nao foi possivel executar a consulta.",
    result: Array.isArray(response?.result) ? response.result : undefined,
  };
}

export default function SqlQuery() {
  const [loading, setLoading] = useState(false);
  const [showDiagram, setShowDiagram] = useState(false);
  const [error, setError] = useState("");
  const [sqlTable, setSqlTable] = useState<QueryRow[]>([]);
  const { handleSubmit, register, reset } = useForm<QueryForm>();
  const { level, sessionId, databaseImageUrl } = useGame();

  const openDiagram = () => {
    if (databaseImageUrl) setShowDiagram(true);
  };
  const closeDiagram = () => setShowDiagram(false);

  async function onSubmit({ query }: QueryForm) {
    if (loading) return;
    if (!sessionId || !level?.id) {
      setError("A sessao ou o nivel atual nao foi inicializado.");
      return;
    }

    let executed = false;
    let error = null;

    setError("");
    setSqlTable([]);
    setLoading(true);
    try {
      const outcome = await executeLevelQuery(sessionId, level.id, query);

      executed = true;

      setSqlTable(outcome.result);
      error = outcome.error ?? null;
      setError(outcome.error ?? "");
      reset();
    } catch (cause) {
      const apiError = getApiError(cause);
      error = apiError.message;
      executed = false;
      setError(apiError.message);
      if (apiError.result) setSqlTable(apiError.result);
    } finally {
      emitQueryEvent(query, executed, error);
      setLoading(false);
    }
  }

  function emitQueryEvent(
    query: string,
    executed: boolean,
    error: string | null,
  ) {
    try {
      emitFctoolEvent("sql_query_submitted", {
        query,
        executed,
        error,
      });
    } catch (cause) {
      console.error("[FCTool] Erro ao enviar evento de consulta SQL: ", cause);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="sql-form">
        <textarea
          {...register("query", { required: true })}
          className="control query"
          placeholder="SELECT * FROM relatorios_criminais LIMIT 1"
        />

        <div className="sql-form-control">
          <button className="control btn" type="submit" disabled={loading}>
            {loading ? "Executando..." : "Executar"}
            <IconPlay />
          </button>

          {databaseImageUrl && (
            <button className="control btn" type="button" onClick={openDiagram}>
              Esquema
              <IconImage />
            </button>
          )}
        </div>
      </form>

      <div className="table-container">
        {loading && <span className="feedback">Buscando...</span>}
        {!loading && error && (
          <span className="error" role="alert">
            {error}
          </span>
        )}
        {!loading && !error && sqlTable.length === 0 && (
          <span className="feedback">Nenhum resultado para mostrar.</span>
        )}
        {sqlTable.length > 0 && (
          <table className="sql-table">
            <thead>
              <tr>
                {Object.keys(sqlTable[0]).map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sqlTable.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {Object.keys(row).map((column) => (
                    <td key={column}>{String(row[column] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {showDiagram && databaseImageUrl && (
          <ModalDiagram src={databaseImageUrl} close={closeDiagram} />
        )}
      </div>
    </>
  );
}
