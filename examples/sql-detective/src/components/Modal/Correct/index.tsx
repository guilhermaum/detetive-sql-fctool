import './style.css';
import { useEffect, useState } from 'react';
import { useGame } from '../../../context/game';

import illustration1 from '../../../assets/board.svg';
import illustration2 from '../../../assets/database.svg';
import illustration3 from '../../../assets/search.svg';
import illustration4 from '../../../assets/table.svg';
import fireworks from '../../../assets/fireworks.svg';

import IconCoin from '../../Icons/IconCoin';
import IconNext from '../../Icons/IconNext';

const illustrations = [illustration1, illustration2, illustration3, illustration4];

function getRandom(min: number, max: number) {
  return Math.floor(Math.random() * (max - min) + min);
}

export default ({ action }: any) => {
  const {
    isGameWon,
    finalScore,
    gameCompleted,
    completionError,
    retryGameCompletion,
  } = useGame();
  const [illustration, setIllustration] = useState(illustrations[0]);

  useEffect(() => {
    setIllustration(illustrations[getRandom(0, 4)]);
  }, []);

  if (isGameWon)
    return (
      <div className="bg-modal">
        <div className="next">
          <div className="content">
            <img src={fireworks} alt="Fireworks" className="illustration" />
          </div>
          <p className="description">
            <strong className="score">
              <IconCoin /> {gameCompleted ? finalScore : "..."}
            </strong>
            {!gameCompleted && (
              <span className={completionError ? 'completion-error' : 'completion-status'} role={completionError ? 'alert' : 'status'}>
                {completionError ?? 'Registrando pontuacao final...'}
              </span>
            )}
            Parabens, Detetive! Voce encontrou a mente por tras do assassinato!
            A missao foi cumprida e a justica foi feita.
          </p>
          {completionError && (
            <button className="control btn large" onClick={retryGameCompletion}>
              Salvar pontuação
              <IconNext />
            </button>
          )}
        </div>
      </div>
    );

  return (
    <div className="bg-modal">
      <div className="next">
        <div className="content">
          <img src={illustration} alt="Illustration" className="illustration" />
        </div>
        <p className="description">
          Parabens! Voce encontrou mais uma pista. Estamos chegando cada vez
          mais perto de descobrir a verdade.
        </p>
        <button className="control btn large" onClick={action}>
          Proximo
          <IconNext />
        </button>
      </div>
    </div>
  );
};
