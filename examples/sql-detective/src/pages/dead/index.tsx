import './style.css';
import { Navigate } from 'react-router-dom';
import { useGame } from '../../context/game';

import logo from '../../assets/detetive-sql.svg';
import illustration from '../../assets/end.svg';
import IconNext from '../../components/Icons/IconNext';

export default () => {
  const { isGameOver, resetGame } = useGame();

  if (!isGameOver) return <Navigate to="/" />;

  return (
    <div className="dead">
      <img src={logo} alt="Detetive SQL" className="logo" />
      <img src={illustration} alt="Detetive" className="draw" />
      <p className="description">
        Parabéns por chegar até aqui! O jogo pode ter acabado, mas suas
        conquistas continuam. Que tal tentar de novo e resolver o caso?
      </p>
      <button className="control btn large" onClick={resetGame}>
        Reiniciar
        <IconNext />
      </button>
    </div>
  );
};
