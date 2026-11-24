import "./style.css";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/detetive-sql.svg";
import IconNext from "../../components/Icons/IconNext";
import { getConfiguredGameConfiguration } from "../../services/fctool";
import type { GameDifficulty } from "../../models/gameConfiguration";

const difficulties = [
  { id: "facil", name: "Fácil", description: "Investigações para começar." },
  { id: "medio", name: "Médio", description: "Desafios para avançar." },
  { id: "dificil", name: "Difícil", description: "Casos para detetives experientes." },
];

const difficultyLabels: Record<GameDifficulty, string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
};

export default function Difficulty() {
  const navigate = useNavigate();
  const configuration = getConfiguredGameConfiguration();
  const configuredDifficulty = configuration.difficulty;
  const caseSelectionDescription =
    configuration.selection === "student"
      ? "Depois você poderá escolher um caso."
      : "O sistema selecionará um caso.";

  return (
    <main className="difficulty container">
      <img src={logo} alt="Detetive SQL" className="logo" />
      <h1>Escolha a dificuldade</h1>
      <p>
        {configuredDifficulty
          ? `Dificuldade definida nas configurações da FCTool: ${difficultyLabels[configuredDifficulty]}. `
          : "Escolha a dificuldade. "}
        {caseSelectionDescription}
      </p>
      <div className="difficulty-list">
        {difficulties.filter((difficulty) => !configuredDifficulty || difficulty.id === configuredDifficulty).map((difficulty) => (
          <button key={difficulty.id} type="button" className="control btn choice-card"
            title={`${difficulty.name}: ${difficulty.description}`}
            onClick={() => navigate(`/cases?difficulty=${configuredDifficulty ?? difficulty.id}`)}>
            <span className="choice-card-copy">
              <strong>{difficulty.name}</strong>
              <span>{difficulty.description}</span>
            </span>
            <IconNext />
          </button>
        ))}
      </div>
      <button type="button" className="control btn" onClick={() => navigate("/")}>Voltar</button>
    </main>
  );
}
