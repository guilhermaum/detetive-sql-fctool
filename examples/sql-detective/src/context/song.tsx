import { createContext, useContext, useRef, useState } from "react";
import IconMusicOff from "../components/Icons/IconMusicOff";
import IconMusic from "../components/Icons/IconMusic";
import urlSong from "../assets/song/song.mp3";
import urlHitSong from "../assets/song/hit.mp3";
import urlErrorSong from "../assets/song/error.mp3";

const SongContext = createContext<any>(null);

const SongProvider = ({ children }: any) => {

  const [musicOn, setMusicOn] = useState(false);
  const song = useRef(new Audio(urlSong));
  const songHit = useRef(new Audio(urlHitSong));
  const songError = useRef(new Audio(urlErrorSong));

  function play(audio: HTMLAudioElement) {
    void audio.play().catch((error) => {
      console.warn("Não foi possível reproduzir o áudio.", error);
    });
  }

  function playSong() {
    if (!musicOn) {
      setMusicOn(true);
      song.current.loop = true;
      play(song.current);
    }
  }

  function pauseSong() {
    if (musicOn) {
      setMusicOn(false);
      song.current.pause();
    }
  }

  function playHitSong() {
    play(songHit.current);
  }

  function playErrorSong() {
    play(songError.current);
  }

  function toggleMusicMute() {
    if (musicOn) pauseSong();
    else playSong();
  }

  function resetSong() {
    pauseSong();
    song.current.currentTime = 0;
  }

  return (
    <SongContext.Provider value={{
      playSong,
      playHitSong,
      playErrorSong,
      resetSong
    }}>
      {children}

      <button onClick={toggleMusicMute} className="control btn music">
        {musicOn ? <IconMusicOff /> : <IconMusic />}
      </button>
    </SongContext.Provider>
  );
}

const useSong = () => {
  return useContext(SongContext);
}

export { SongProvider, useSong };
