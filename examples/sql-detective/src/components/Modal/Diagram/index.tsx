import './style.css';
import IconClose from '../../Icons/IconClose';

type ModalDiagramProps = { src: string; close: () => void };

export default function ModalDiagram({ src, close }: ModalDiagramProps) {
  return (
    <div className="bg-modal">
      <div className="diagram">
        <button className="control btn" onClick={close}>
          <IconClose />
        </button>
        <div className="box">
          <img src={src} alt="Esquema do banco de dados deste caso" className="image" />
        </div>
      </div>
    </div>
  );
}
