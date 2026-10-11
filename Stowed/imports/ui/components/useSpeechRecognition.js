import { useEffect, useRef, useState } from "react";

const ERROR_MESSAGES = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser settings.",
  "service-not-allowed": "Microphone access is blocked. Allow it in your browser settings.",
  "no-speech": "Didn't catch that. Try again.",
  "audio-capture": "No microphone found.",
  network: "Voice input needs an internet connection.",
};

function getRecognitionClass() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function useSpeechRecognition({ onResult, lang = "en-AU" } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef(null);
  const onResultRef = useRef(onResult);
  const isSupported = getRecognitionClass() !== null;

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  function start() {
    const Recognition = getRecognitionClass();
    if (!Recognition || recognitionRef.current) return;

    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join("");
      onResultRef.current?.(transcript);
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") return;
      setError(ERROR_MESSAGES[event.error] || "Voice input stopped unexpectedly.");
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setError("");
    setIsListening(true);
    recognition.start();
  }

  function stop() {
    recognitionRef.current?.stop();
  }

  function abort() {
    recognitionRef.current?.abort();
  }

  return { isSupported, isListening, error, start, stop, abort };
}
