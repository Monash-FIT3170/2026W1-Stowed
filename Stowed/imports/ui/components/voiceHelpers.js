export function toSpeakable(text) {
  return text
    .replace(/https?:\/\/\S+/g, "the link")
    .replace(/[*_#`]/g, "")
    .trim();
}

export function combineSpeechDraft(base, transcript) {
  return base ? `${base} ${transcript}` : transcript;
}

export function handleSpeechResult({ base, transcript, isFinal, handsFree, send, setDraft }) {
  const text = combineSpeechDraft(base, transcript);
  if (isFinal && handsFree) {
    send(text);
    return;
  }
  setDraft(text);
}

export function speakHandsFreeReply(text, { isActive, canSpeak, speak, resume }) {
  if (!isActive()) return;
  if (canSpeak && text) {
    speak(toSpeakable(text), { onEnd: resume });
    return;
  }
  resume();
}