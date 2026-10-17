import { useEffect, useRef, useState } from "react";

function getSynth() {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis || null;
}

export function pickVoice(voices, lang) {
  return (
    voices.find((voice) => voice.lang === lang) ||
    voices.find((voice) => voice.lang?.startsWith(lang.split("-")[0])) ||
    null
  );
}

export function useSpeechSynthesis({ lang = "en-AU" } = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const voiceRef = useRef(null);
  const utteranceRef = useRef(null);
  const isSupported = getSynth() !== null;

  useEffect(() => {
    const synth = getSynth();
    if (!synth) return undefined;

    const loadVoices = () => {
      voiceRef.current = pickVoice(synth.getVoices(), lang);
    };
    loadVoices();
    synth.addEventListener("voiceschanged", loadVoices);

    return () => {
      synth.removeEventListener("voiceschanged", loadVoices);
      utteranceRef.current = null;
      synth.cancel();
    };
  }, [lang]);

  function speak(text, { onEnd } = {}) {
    const synth = getSynth();
    if (!synth || !text) {
      onEnd?.();
      return;
    }

    synth.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    if (voiceRef.current) utterance.voice = voiceRef.current;

    const finish = () => {
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null;
      setIsSpeaking(false);
      onEnd?.();
    };
    utterance.onend = finish;
    utterance.onerror = finish;

    utteranceRef.current = utterance;
    setIsSpeaking(true);
    synth.speak(utterance);
  }

  function cancel() {
    utteranceRef.current = null;
    setIsSpeaking(false);
    getSynth()?.cancel();
  }

  return { isSupported, isSpeaking, speak, cancel };
}
