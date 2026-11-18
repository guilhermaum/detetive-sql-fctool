import "./style.css";
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useGame } from "../../context/game";
import { findRanking, type RankedPlayer } from "../../services/players";
import { formatDifficulty } from "../../models/difficulty";

export default function Ranking() {
  const { cardId, caseId, caseInfo, rankingEnabled, gameCompleted } = useGame();
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!rankingEnabled || !gameCompleted) {
      setLoading(false);
      return;
    }

    if (!cardId || !caseId) {
      setError(
        "Nao foi possivel identificar o card_id ou case_id desta atividade.",
      );
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError("");
    setPlayers([]);

    findRanking(cardId, caseId)
      .then((data) => {
        if (active) setPlayers(data);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        const responseMessage = (
          cause as { response?: { data?: { message?: string } } }
        )?.response?.data?.message;
        setError(responseMessage ?? "Nao foi possivel carregar o ranking.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [cardId, caseId, gameCompleted, rankingEnabled]);

  if (!rankingEnabled) return <Navigate to="/" replace />;
  if (!gameCompleted) return <Navigate to="/" replace />;

  return (
    <main className="ranking container">
      <h1>Ranking</h1>
      {caseInfo && (
        <div className="ranking-case">
          <h2 className="ranking-case-title">{caseInfo.name}</h2>
          <p className="ranking-case-meta">
            <span>
              <strong>Dificuldade:</strong>{" "}
              {formatDifficulty(caseInfo.difficulty)}
            </span>
          </p>
        </div>
      )}
      <Link to="/finish">Voltar</Link>

      {loading && (
        <p className="ranking-message" role="status">
          Carregando...
        </p>
      )}
      {!loading && error && (
        <p className="ranking-message error" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && players.length === 0 && (
        <p className="ranking-message">
          Ainda nao ha alunos com todos os niveis concluidos nesta sessao.
        </p>
      )}

      {!loading && !error && players.length > 0 && (
        <div className="ranking-table-wrap">
          <table className="ranking-table">
            <thead>
              <tr>
                <th className="ranking-col ranking-id" scope="col">
                  #
                </th>
                <th className="ranking-col ranking-player" scope="col">
                  Jogador
                </th>
                <th className="ranking-col ranking-score" scope="col">
                  Pontos
                </th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, index) => (
                <tr key={player.id}>
                  <td className="ranking-col ranking-id">{`${index + 1}\u00ba`}</td>
                  <td className="ranking-col ranking-player">
                    {player.player_name || player.player_id || "Aluno"}
                  </td>
                  <td className="ranking-col ranking-score">{player.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
