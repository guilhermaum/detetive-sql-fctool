import "./style.css";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useGame } from "../../../context/game";
import { useSong } from "../../../context/song";
import { checkAnswers } from "../../../services/levels";
import IconCheck from "../../../components/Icons/IconCheck";
import IconDataSearch from "../../../components/Icons/IconDataSearch";
import { emitFctoolEvent } from "../../../services/fctool";

type FormCheckProps = {
  template: Record<string, unknown>;
  correct: () => void;
};

export default function FormCheck({ template, correct }: FormCheckProps) {
  const [loading, setLoading] = useState(false);
  const { handleSubmit, register } = useForm<{ answers: string[] }>();
  const { level, sessionId, scoreGame, applySuccess, applyFault } = useGame();
  const { playHitSong, playErrorSong } = useSong();
  const [incorret, setIncorret] = useState<boolean>(false);
  const completedLevelEventSent = useRef<string | null>(null);
  const columns = Object.keys(template);

  async function submit(data: { answers: string[] }) {
    if (loading) return;

    if (!level?.id || !sessionId) {
      console.error("Nível ou ID do nível não encontrado.");
      return;
    }

    setLoading(true);
    setIncorret(false);

    const submittedLine = data.answers ?? [];
    let success = false;
    let levelCompleted = false;

    try {
      success = await checkAnswers(
        sessionId,
        level.id,
        submittedLine,
        scoreGame,
      );

      if (success) {
        playHitSong();
        applySuccess();
        setIncorret(false);

        levelCompleted = true;
        correct();
      } else {
        playErrorSong();
        await applyFault();
        setIncorret(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      emitFctoolEvent("answer_submitted", {
        submitted_line: submittedLine,
        success,
      });

      if (levelCompleted && completedLevelEventSent.current !== level.id) {
        completedLevelEventSent.current = level.id;
        emitFctoolEvent("level_completed", {
          level_completed: level.number,
          final_score: scoreGame,
        });
      }

      setLoading(false);
    }
  }

  return (
    <form
      className="form-check"
      onSubmit={handleSubmit(submit)}
      autoComplete="off"
    >
      <div className="form">
        {columns.map((column, idx) => {
          return (
            <div key={idx} className="control group">
              <label htmlFor={`answer-${idx}`}>{column}:</label>

              <input
                {...register(`answers.${idx}`, { required: true })}
                id={`answer-${idx}`}
                type="text"
                placeholder={`Informe o valor da coluna ${column}`}
                aria-label={`Valor para a coluna ${column}`}
              />
            </div>
          );
        })}

        {incorret && (
          <span className="error">
            Os valores informados não correspondem às respostas esperadas. Tente
            novamente.
          </span>
        )}
      </div>

      <button className="control btn" type="submit" disabled={loading}>
        {loading ? (
          <>
            Analisando... <IconDataSearch />
          </>
        ) : (
          <>
            Enviar <IconCheck />
          </>
        )}
      </button>
    </form>
  );
}
