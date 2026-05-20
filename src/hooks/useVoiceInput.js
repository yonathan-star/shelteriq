import { useState, useRef, useCallback } from "react";

const LANG_MAP = { en: "en-US", es: "es-ES", ht: "fr-HT" };

export function useVoiceInput(onResult, language = "en") {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const start = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = LANG_MAP[language] || "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = e => {
      const transcript = e.results[0][0].transcript;
      onResult(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [language, onResult]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, start, stop };
}
