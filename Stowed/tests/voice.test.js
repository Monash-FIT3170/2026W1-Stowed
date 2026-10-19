import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  toSpeakable,
  combineSpeechDraft,
  handleSpeechResult,
  speakHandsFreeReply,
} from "../imports/ui/components/voiceHelpers";
import {
  useSpeechRecognition,
  getVoiceErrorMessage,
} from "../imports/ui/components/useSpeechRecognition";
import { useSpeechSynthesis, pickVoice } from "../imports/ui/components/useSpeechSynthesis";
import { Chatbot } from "../imports/ui/components/Chatbot";
import { describeServer } from "./serverOnly";

function renderWithoutLayoutEffectWarning(element) {
  const originalError = console.error;

  console.error = (...args) => {
    if (String(args[0]).includes("useLayoutEffect does nothing on the server")) {
      return;
    }
    originalError(...args);
  };

  try {
    return renderToStaticMarkup(element);
  } finally {
    console.error = originalError;
  }
}

function captureHook(useHook, options) {
  let api;
  function Probe({ onRender }) {
    onRender(useHook(options));
    return null;
  }
  renderWithoutLayoutEffectWarning(
    React.createElement(Probe, {
      onRender: (value) => {
        api = value;
      },
    }),
  );
  return api;
}

function makeRecognitionClass() {
  const instances = [];
  class FakeRecognition {
    constructor() {
      this.startCalls = 0;
      this.stopped = false;
      this.aborted = false;
      instances.push(this);
    }
    start() {
      this.startCalls += 1;
    }
    stop() {
      this.stopped = true;
    }
    abort() {
      this.aborted = true;
    }
  }
  return { FakeRecognition, instances };
}

function resultsEvent(chunks, isFinal) {
  return {
    results: chunks.map((transcript, index) => {
      const result = [{ transcript }];
      result.isFinal = index === chunks.length - 1 ? isFinal : true;
      return result;
    }),
  };
}

function makeSynth() {
  const synth = {
    spoken: [],
    cancelCalls: 0,
    speak(utterance) {
      this.spoken.push(utterance);
    },
    cancel() {
      this.cancelCalls += 1;
    },
    getVoices() {
      return [];
    },
    addEventListener() {},
    removeEventListener() {},
  };
  class FakeUtterance {
    constructor(text) {
      this.text = text;
    }
  }
  return { synth, FakeUtterance };
}

function useFakeWindow() {
  let originalWindow;
  beforeEach(function () {
    originalWindow = globalThis.window;
  });
  afterEach(function () {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  });
}

describe("Voice helpers", function () {
  it("reads links as 'the link' and strips markdown symbols", function () {
    assert.strictEqual(
      toSpeakable("Open it from Lists: https://stowed.app/lists/abc"),
      "Open it from Lists: the link",
    );
    assert.strictEqual(toSpeakable("  **Done** `ok` #1  "), "Done ok 1");
  });

  it("adds speech after anything already typed", function () {
    assert.strictEqual(combineSpeechDraft("", "hello"), "hello");
    assert.strictEqual(combineSpeechDraft("Add", "five milk"), "Add five milk");
  });

  it("shows live speech in the input without sending it", function () {
    const sent = [];
    let draft = "";
    handleSpeechResult({
      base: "",
      transcript: "open inv",
      isFinal: false,
      handsFree: true,
      send: (text) => sent.push(text),
      setDraft: (text) => {
        draft = text;
      },
    });
    assert.strictEqual(draft, "open inv");
    assert.deepStrictEqual(sent, []);
  });

  it("auto-sends the final transcript in hands-free mode", function () {
    const sent = [];
    let draft = "";
    handleSpeechResult({
      base: "",
      transcript: "open inventory",
      isFinal: true,
      handsFree: true,
      send: (text) => sent.push(text),
      setDraft: (text) => {
        draft = text;
      },
    });
    assert.deepStrictEqual(sent, ["open inventory"]);
    assert.strictEqual(draft, "");
  });

  it("leaves the final transcript for the user to send when hands-free is off", function () {
    const sent = [];
    let draft = "";
    handleSpeechResult({
      base: "Please",
      transcript: "open inventory",
      isFinal: true,
      handsFree: false,
      send: (text) => sent.push(text),
      setDraft: (text) => {
        draft = text;
      },
    });
    assert.strictEqual(draft, "Please open inventory");
    assert.deepStrictEqual(sent, []);
  });

  it("does nothing with replies when hands-free is off or the chat is closed", function () {
    let spoke = 0;
    let resumed = 0;
    speakHandsFreeReply("Opened Inventory.", {
      isActive: () => false,
      canSpeak: true,
      speak: () => {
        spoke += 1;
      },
      resume: () => {
        resumed += 1;
      },
    });
    assert.strictEqual(spoke, 0);
    assert.strictEqual(resumed, 0);
  });

  it("speaks the reply and only listens again once speaking has finished", function () {
    const spoken = [];
    let resumed = 0;
    speakHandsFreeReply("See https://x.com now", {
      isActive: () => true,
      canSpeak: true,
      speak: (text, options) => spoken.push({ text, options }),
      resume: () => {
        resumed += 1;
      },
    });
    assert.strictEqual(spoken.length, 1);
    assert.strictEqual(spoken[0].text, "See the link now");
    assert.strictEqual(resumed, 0);

    spoken[0].options.onEnd();
    assert.strictEqual(resumed, 1);
  });

  it("listens again straight away when the browser can't speak", function () {
    let resumed = 0;
    speakHandsFreeReply("Opened Inventory.", {
      isActive: () => true,
      canSpeak: false,
      speak: () => assert.fail("should not speak"),
      resume: () => {
        resumed += 1;
      },
    });
    assert.strictEqual(resumed, 1);
  });

  it("listens again straight away when there is nothing to say", function () {
    let resumed = 0;
    speakHandsFreeReply("", {
      isActive: () => true,
      canSpeak: true,
      speak: () => assert.fail("should not speak"),
      resume: () => {
        resumed += 1;
      },
    });
    assert.strictEqual(resumed, 1);
  });
});

describe("Voice input error messages", function () {
  it("explains a blocked microphone", function () {
    assert.ok(getVoiceErrorMessage("not-allowed").includes("blocked"));
  });

  it("asks the user to try again when nothing was heard", function () {
    assert.ok(getVoiceErrorMessage("no-speech").includes("Try again"));
  });

  it("falls back to a generic message for unknown errors", function () {
    assert.strictEqual(getVoiceErrorMessage("something-new"), "Voice input stopped unexpectedly.");
  });

  it("stays quiet when listening was cancelled on purpose", function () {
    assert.strictEqual(getVoiceErrorMessage("aborted"), null);
  });
});

describeServer("Voice input (speech to text)", function () {
  useFakeWindow();

  it("reports unsupported and does nothing when the browser has no speech recognition", function () {
    globalThis.window = {};
    const voice = captureHook(useSpeechRecognition, {});
    assert.strictEqual(voice.isSupported, false);
    assert.doesNotThrow(() => voice.start());
  });

  it("supports the webkit-prefixed API used by Chrome and Safari", function () {
    const { FakeRecognition } = makeRecognitionClass();
    globalThis.window = { webkitSpeechRecognition: FakeRecognition };
    assert.strictEqual(captureHook(useSpeechRecognition, {}).isSupported, true);
  });

  it("listens in Australian English with live results", function () {
    const { FakeRecognition, instances } = makeRecognitionClass();
    globalThis.window = { SpeechRecognition: FakeRecognition };
    captureHook(useSpeechRecognition, {}).start();

    assert.strictEqual(instances.length, 1);
    assert.strictEqual(instances[0].lang, "en-AU");
    assert.strictEqual(instances[0].interimResults, true);
    assert.strictEqual(instances[0].continuous, false);
    assert.strictEqual(instances[0].startCalls, 1);
  });

  it("ignores a second start while already listening", function () {
    const { FakeRecognition, instances } = makeRecognitionClass();
    globalThis.window = { SpeechRecognition: FakeRecognition };
    const voice = captureHook(useSpeechRecognition, {});
    voice.start();
    voice.start();
    assert.strictEqual(instances.length, 1);
  });

  it("passes the full transcript and whether it is final", function () {
    const { FakeRecognition, instances } = makeRecognitionClass();
    globalThis.window = { SpeechRecognition: FakeRecognition };
    const calls = [];
    const voice = captureHook(useSpeechRecognition, {
      onResult: (transcript, isFinal) => calls.push([transcript, isFinal]),
    });
    voice.start();

    instances[0].onresult(resultsEvent(["take me", " to inventory"], false));
    instances[0].onresult(resultsEvent(["take me", " to inventory"], true));

    assert.deepStrictEqual(calls, [
      ["take me to inventory", false],
      ["take me to inventory", true],
    ]);
  });

  it("stop lets the browser finish and abort discards straight away", function () {
    const { FakeRecognition, instances } = makeRecognitionClass();
    globalThis.window = { SpeechRecognition: FakeRecognition };
    const voice = captureHook(useSpeechRecognition, {});

    voice.start();
    voice.stop();
    assert.strictEqual(instances[0].stopped, true);

    voice.abort();
    assert.strictEqual(instances[0].aborted, true);
  });

  it("can start listening again straight after an abort", function () {
    const { FakeRecognition, instances } = makeRecognitionClass();
    globalThis.window = { SpeechRecognition: FakeRecognition };
    const voice = captureHook(useSpeechRecognition, {});

    voice.start();
    voice.abort();
    voice.start();

    assert.strictEqual(instances.length, 2);
    assert.strictEqual(instances[1].startCalls, 1);
  });

  it("ignores a late end event from a session that was already aborted", function () {
    const { FakeRecognition, instances } = makeRecognitionClass();
    globalThis.window = { SpeechRecognition: FakeRecognition };
    const voice = captureHook(useSpeechRecognition, {});

    voice.start();
    voice.abort();
    voice.start();
    instances[0].onend();
    voice.start();

    assert.strictEqual(instances.length, 2);
  });
});

describeServer("Voice replies (text to speech)", function () {
  useFakeWindow();

  it("reports unsupported and finishes immediately when the browser can't speak", function () {
    globalThis.window = {};
    const voice = captureHook(useSpeechSynthesis, {});
    let ended = 0;
    voice.speak("Hello", {
      onEnd: () => {
        ended += 1;
      },
    });
    assert.strictEqual(voice.isSupported, false);
    assert.strictEqual(ended, 1);
  });

  it("speaks in Australian English and cancels anything already playing", function () {
    const { synth, FakeUtterance } = makeSynth();
    globalThis.window = { speechSynthesis: synth, SpeechSynthesisUtterance: FakeUtterance };
    captureHook(useSpeechSynthesis, {}).speak("Opened Inventory.");

    assert.strictEqual(synth.cancelCalls, 1);
    assert.strictEqual(synth.spoken.length, 1);
    assert.strictEqual(synth.spoken[0].text, "Opened Inventory.");
    assert.strictEqual(synth.spoken[0].lang, "en-AU");
  });

  it("calls onEnd only once speaking has finished", function () {
    const { synth, FakeUtterance } = makeSynth();
    globalThis.window = { speechSynthesis: synth, SpeechSynthesisUtterance: FakeUtterance };
    let ended = 0;
    captureHook(useSpeechSynthesis, {}).speak("Hi", {
      onEnd: () => {
        ended += 1;
      },
    });

    assert.strictEqual(ended, 0);
    synth.spoken[0].onend();
    assert.strictEqual(ended, 1);
  });

  it("still calls onEnd if speaking fails, so hands-free carries on", function () {
    const { synth, FakeUtterance } = makeSynth();
    globalThis.window = { speechSynthesis: synth, SpeechSynthesisUtterance: FakeUtterance };
    let ended = 0;
    captureHook(useSpeechSynthesis, {}).speak("Hi", {
      onEnd: () => {
        ended += 1;
      },
    });

    synth.spoken[0].onerror();
    assert.strictEqual(ended, 1);
  });

  it("ignores the end of an older reply that was replaced by a newer one", function () {
    const { synth, FakeUtterance } = makeSynth();
    globalThis.window = { speechSynthesis: synth, SpeechSynthesisUtterance: FakeUtterance };
    const voice = captureHook(useSpeechSynthesis, {});
    let firstEnded = 0;
    let secondEnded = 0;

    voice.speak("First", {
      onEnd: () => {
        firstEnded += 1;
      },
    });
    voice.speak("Second", {
      onEnd: () => {
        secondEnded += 1;
      },
    });

    synth.spoken[0].onend();
    assert.strictEqual(firstEnded, 0);

    synth.spoken[1].onend();
    assert.strictEqual(secondEnded, 1);
  });

  it("cancelling stops speech without restarting the mic", function () {
    const { synth, FakeUtterance } = makeSynth();
    globalThis.window = { speechSynthesis: synth, SpeechSynthesisUtterance: FakeUtterance };
    const voice = captureHook(useSpeechSynthesis, {});
    let ended = 0;

    voice.speak("Hi", {
      onEnd: () => {
        ended += 1;
      },
    });
    voice.cancel();
    synth.spoken[0].onend();

    assert.strictEqual(synth.cancelCalls, 2);
    assert.strictEqual(ended, 0);
  });

  it("finishes immediately without speaking when there is no text", function () {
    const { synth, FakeUtterance } = makeSynth();
    globalThis.window = { speechSynthesis: synth, SpeechSynthesisUtterance: FakeUtterance };
    let ended = 0;
    captureHook(useSpeechSynthesis, {}).speak("", {
      onEnd: () => {
        ended += 1;
      },
    });

    assert.strictEqual(synth.spoken.length, 0);
    assert.strictEqual(ended, 1);
  });

  it("prefers an Australian voice, then any English voice", function () {
    const us = { lang: "en-US", name: "US" };
    const au = { lang: "en-AU", name: "AU" };
    const gb = { lang: "en-GB", name: "GB" };
    const fr = { lang: "fr-FR", name: "FR" };

    assert.strictEqual(pickVoice([us, au], "en-AU"), au);
    assert.strictEqual(pickVoice([fr, gb], "en-AU"), gb);
    assert.strictEqual(pickVoice([fr], "en-AU"), null);
  });
});

describeServer("Chatbot voice controls", function () {
  useFakeWindow();

  function renderChatbot(props) {
    return renderWithoutLayoutEffectWarning(
      React.createElement(MemoryRouter, null, React.createElement(Chatbot, props)),
    );
  }

  it("shows only the launcher while the chat is closed", function () {
    const { FakeRecognition } = makeRecognitionClass();
    globalThis.window = { SpeechRecognition: FakeRecognition };
    const html = renderChatbot();
    assert.ok(html.includes('aria-label="Open chatbot"'));
    assert.ok(!html.includes("Start voice input"));
  });

  it("shows the mic and hands-free toggle when speech recognition is available", function () {
    const { FakeRecognition } = makeRecognitionClass();
    globalThis.window = { SpeechRecognition: FakeRecognition };
    const html = renderChatbot({ initialOpen: true });

    assert.ok(html.includes('aria-label="Start voice input"'));
    assert.ok(html.includes("Hands-free"));
    assert.ok(html.includes('aria-pressed="false"'));
    assert.ok(html.includes('placeholder="Ask Stowed..."'));
  });

  it("hides voice controls when the browser can't do speech recognition", function () {
    globalThis.window = {};
    const html = renderChatbot({ initialOpen: true });

    assert.ok(!html.includes("Start voice input"));
    assert.ok(!html.includes("Hands-free"));
    assert.ok(html.includes('aria-label="Send message"'));
  });
});
