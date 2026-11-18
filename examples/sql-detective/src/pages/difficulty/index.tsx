import "./style.css";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/detetive-sql.svg";
import IconNext from "../../components/Icons/IconNext";
import { getConfiguredDifficulty } from "../../services/fctool";

const difficulties = [
  { id: "facil", name: "Fácil", description: "Investigações para começar." },
  { id: "medio", name: "Médio", description: "Desafios para avançar." },
  { id: "dificil", name: "Difícil", description: "Casos para detetives experientes." },
];

export default function Difficulty() {
  const navigate = useNavigate();
  const configuredDifficulty = getConfiguredDifficulty();

  return (
    <main className="difficulty container">
      <img src={logo} alt="Detetive SQL" className="logo" />
      <h1>Escolha a dificuldade</h1>
      <p>{configuredDifficulty
        ? "Dificuldade definida nas configurações da FCTool. Um caso aleatório será carregado."
        : "Escolha a dificuldade. Um caso aleatório será carregado em seguida."}</p>
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
