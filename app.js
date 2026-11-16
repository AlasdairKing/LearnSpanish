(() => {
  "use strict";

  const SESSION_SIZE = 10;
  const SPEECH_LANG = "es-ES";

  /** @typedef {{ spanish: string, meaning: string, forms: string[] }} Verb */

  /** @type {Verb[]} */
  const VERBS = [
    { spanish: "ser", meaning: "to be", forms: ["ser", "soy", "eres", "es", "somos", "sois", "son"] },
    { spanish: "estar", meaning: "to be", forms: ["estar", "estoy", "estás", "estas", "está", "esta", "estamos", "estáis", "estais", "están", "estan"] },
    { spanish: "tener", meaning: "to have", forms: ["tener", "tengo", "tienes", "tiene", "tenemos", "tenéis", "teneis", "tienen"] },
    { spanish: "hacer", meaning: "to do/make", forms: ["hacer", "hago", "haces", "hace", "hacemos", "hacéis", "haceis", "hacen"] },
    { spanish: "ir", meaning: "to go", forms: ["ir", "voy", "vas", "va", "vamos", "vais", "van"] },
    { spanish: "gustar", meaning: "to like", forms: ["gustar", "gusta", "gustan", "me gusta", "te gusta", "le gusta", "nos gusta"] },
    { spanish: "jugar", meaning: "to play", forms: ["jugar", "juego", "juegas", "juega", "jugamos", "jugáis", "jugais", "juegan"] },
    { spanish: "ver", meaning: "to see/watch", forms: ["ver", "veo", "ves", "ve", "vemos", "veis", "ven"] },
    { spanish: "comer", meaning: "to eat", forms: ["comer", "como", "comes", "come", "comemos", "coméis", "comeis", "comen"] },
    { spanish: "beber", meaning: "to drink", forms: ["beber", "bebo", "bebes", "bebe", "bebemos", "bebéis", "bebeis", "beben"] },
    { spanish: "vivir", meaning: "to live", forms: ["vivir", "vivo", "vives", "vive", "vivimos", "vivís", "vivis", "viven"] },
    { spanish: "estudiar", meaning: "to study", forms: ["estudiar", "estudio", "estudias", "estudia", "estudiamos", "estudiáis", "estudiais", "estudian"] },
    { spanish: "trabajar", meaning: "to work", forms: ["trabajar", "trabajo", "trabajas", "trabaja", "trabajamos", "trabajáis", "trabajais", "trabajan"] },
    { spanish: "hablar", meaning: "to speak/talk", forms: ["hablar", "hablo", "hablas", "habla", "hablamos", "habláis", "hablais", "hablan"] },
    { spanish: "leer", meaning: "to read", forms: ["leer", "leo", "lees", "lee", "leemos", "leéis", "leeis", "leen"] },
    { spanish: "escribir", meaning: "to write", forms: ["escribir", "escribo", "escribes", "escribe", "escribimos", "escribís", "escribis", "escriben"] },
    { spanish: "salir", meaning: "to go out/leave", forms: ["salir", "salgo", "sales", "sale", "salimos", "salís", "salis", "salen"] },
    { spanish: "querer", meaning: "to want", forms: ["querer", "quiero", "quieres", "quiere", "queremos", "queréis", "quereis", "quieren"] },
    { spanish: "poder", meaning: "can/to be able to", forms: ["poder", "puedo", "puedes", "puede", "podemos", "podéis", "podeis", "pueden"] },
    { spanish: "deber", meaning: "should/must", forms: ["deber", "debo", "debes", "debe", "debemos", "debéis", "debeis", "deben"] },
  ];

  const PRONOUNS = [
    "yo",
    "tú",
    "tu",
    "él",
    "el",
    "ella",
    "usted",
    "nosotros",
    "nosotras",
    "vosotros",
    "vosotras",
    "ellos",
    "ellas",
    "ustedes",
    "me",
    "te",
    "se",
    "nos",
    "os",
    "le",
    "les",
  ];

  const DONT_KNOW_PATTERNS = [
    /\bdon\s*t\s+know\b/i,
    /\bi\s+don\s*t\s+know\b/i,
    /\bno\s+se\b/i,
    /\bno\s+lo\s+se\b/i,
    /\bskip\b/i,
    /\bpasar\b/i,
  ];

  const menuView = document.getElementById("menu-view");
  const testView = document.getElementById("test-view");
  const scoreView = document.getElementById("score-view");
  const unsupported = document.getElementById("unsupported");
  const startTest1 = document.getElementById("start-test-1");
  const quitTest = document.getElementById("quit-test");
  const backToMenu = document.getElementById("back-to-menu");
  const micBtn = document.getElementById("mic-btn");
  const dontKnowBtn = document.getElementById("dont-know-btn");
  const nextBtn = document.getElementById("next-btn");
  const progressLabel = document.getElementById("progress-label");
  const promptMeaning = document.getElementById("prompt-meaning");
  const statusText = document.getElementById("status-text");
  const heardText = document.getElementById("heard-text");
  const reveal = document.getElementById("reveal");
  const revealVerb = document.getElementById("reveal-verb");
  const scoreValue = document.getElementById("score-value");
  const scoreNote = document.getElementById("score-note");

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  /** @type {SpeechRecognition | null} */
  let recognition = null;
  let listening = false;
  let awaitingAnswer = false;
  let preserveStatusOnEnd = false;

  /** @type {Verb[]} */
  let queue = [];
  let index = 0;
  let score = 0;

  function stripDiacritics(value) {
    return value.normalize("NFD").replace(/\p{M}/gu, "");
  }

  function normalizeSpeech(raw) {
    return stripDiacritics(String(raw || "").toLowerCase())
      .replace(/[¿?¡!.,;:…"'`´]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isDontKnow(transcript) {
    const normalized = normalizeSpeech(transcript);
    return DONT_KNOW_PATTERNS.some((pattern) => pattern.test(normalized));
  }

  /**
   * @param {string} transcript
   * @param {Verb} verb
   */
  function matchesVerb(transcript, verb) {
    const normalized = normalizeSpeech(transcript);
    if (!normalized) return false;

    const tokens = normalized.split(" ").filter(Boolean);
    const withoutPronouns = tokens.filter((token) => !PRONOUNS.includes(token));
    const candidates = [normalized, withoutPronouns.join(" ")].filter(Boolean);

    const forms = verb.forms.map((form) => normalizeSpeech(form));

    return forms.some((form) =>
      candidates.some((candidate) => {
        if (candidate === form) return true;
        if (candidate.endsWith(" " + form) || candidate.startsWith(form + " ")) {
          return true;
        }
        const parts = candidate.split(" ");
        return parts.includes(form);
      })
    );
  }

  function shuffle(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function showView(view) {
    [menuView, testView, scoreView].forEach((el) => {
      const active = el === view;
      el.classList.toggle("is-active", active);
      el.hidden = !active;
    });
  }

  function stopSpeech() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  function stopListening({ abort = false } = {}) {
    listening = false;
    micBtn.classList.remove("is-listening");
    micBtn.setAttribute("aria-pressed", "false");
    if (!recognition) return;
    try {
      if (abort) recognition.abort();
      else recognition.stop();
    } catch (_) {
      /* ignore */
    }
  }

  function leaveTest() {
    awaitingAnswer = false;
    preserveStatusOnEnd = true;
    stopListening({ abort: true });
    stopSpeech();
    showView(menuView);
  }

  function speakSpanish(text) {
    if (!window.speechSynthesis) return;
    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SPEECH_LANG;

    const voices = window.speechSynthesis.getVoices();
    const spanishVoice =
      voices.find((voice) => /es[-_]ES/i.test(voice.lang)) ||
      voices.find((voice) => /^es\b/i.test(voice.lang));
    if (spanishVoice) utterance.voice = spanishVoice;

    window.speechSynthesis.speak(utterance);
  }

  function currentVerb() {
    return queue[index];
  }

  function resetPromptUi() {
    const verb = currentVerb();
    progressLabel.textContent = `${index + 1} / ${SESSION_SIZE}`;
    promptMeaning.textContent = verb.meaning;
    statusText.textContent = SpeechRecognition
      ? "Tap the mic, then speak — or skip with Don’t know."
      : "Microphone unavailable here — tap Don’t know to reveal each verb.";
    heardText.hidden = true;
    heardText.textContent = "";
    reveal.hidden = true;
    reveal.classList.remove("is-open", "is-correct", "is-miss");
    revealVerb.textContent = "";
    micBtn.disabled = !SpeechRecognition || !awaitingAnswer;
    dontKnowBtn.disabled = !awaitingAnswer;
    nextBtn.hidden = true;
    nextBtn.textContent = index === SESSION_SIZE - 1 ? "See score" : "Next";
  }

  function startSession() {
    awaitingAnswer = false;
    preserveStatusOnEnd = true;
    stopListening({ abort: true });
    stopSpeech();

    queue = shuffle(VERBS).slice(0, SESSION_SIZE);
    index = 0;
    score = 0;
    awaitingAnswer = true;
    preserveStatusOnEnd = false;
    showView(testView);
    resetPromptUi();
  }

  function finishSession() {
    awaitingAnswer = false;
    preserveStatusOnEnd = true;
    stopListening({ abort: true });
    stopSpeech();
    scoreValue.textContent = `${score} / ${SESSION_SIZE}`;
    if (score >= 9) {
      scoreNote.textContent = "Excelente — those verbs are sticking.";
    } else if (score >= 6) {
      scoreNote.textContent = "Solid recall. Another round will lock them in.";
    } else {
      scoreNote.textContent = "Keep speaking — repetition builds memory.";
    }
    showView(scoreView);
  }

  /**
   * @param {{ correct: boolean, skipped: boolean, heard: string }} result
   */
  function revealAnswer(result) {
    if (!awaitingAnswer) return;
    awaitingAnswer = false;
    stopListening();

    const verb = currentVerb();
    if (result.correct) score += 1;

    reveal.hidden = false;
    reveal.classList.add("is-open");
    reveal.classList.toggle("is-correct", result.correct);
    reveal.classList.toggle("is-miss", !result.correct);
    revealVerb.textContent = verb.spanish;
    nextBtn.hidden = false;

    if (result.heard) {
      heardText.hidden = false;
      heardText.textContent = `Heard: “${result.heard}”`;
    }

    if (result.skipped) {
      statusText.textContent = "Skipped — here’s the verb.";
    } else if (result.correct) {
      statusText.textContent = "Correct.";
    } else {
      statusText.textContent = "Not quite — listen and try again next round.";
    }

    micBtn.disabled = true;
    dontKnowBtn.disabled = true;
    speakSpanish(verb.spanish);
  }

  function handleTranscript(transcript) {
    if (!awaitingAnswer) return;
    const trimmed = String(transcript || "").trim();
    if (!trimmed) return;

    if (isDontKnow(trimmed)) {
      revealAnswer({ correct: false, skipped: true, heard: trimmed });
      return;
    }

    const verb = currentVerb();
    const correct = matchesVerb(trimmed, verb);
    revealAnswer({ correct, skipped: false, heard: trimmed });
  }

  function setupRecognition() {
    if (!SpeechRecognition) {
      unsupported.hidden = false;
      micBtn.disabled = true;
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = SPEECH_LANG;
    recognition.interimResults = false;
    recognition.maxAlternatives = 4;
    recognition.continuous = false;

    recognition.onstart = () => {
      listening = true;
      preserveStatusOnEnd = false;
      micBtn.classList.add("is-listening");
      micBtn.setAttribute("aria-pressed", "true");
      statusText.textContent = "Listening…";
    };

    recognition.onend = () => {
      listening = false;
      micBtn.classList.remove("is-listening");
      micBtn.setAttribute("aria-pressed", "false");
      if (awaitingAnswer && !preserveStatusOnEnd) {
        statusText.textContent = "Tap the mic to try again.";
      }
      preserveStatusOnEnd = false;
    };

    recognition.onerror = (event) => {
      listening = false;
      micBtn.classList.remove("is-listening");
      micBtn.setAttribute("aria-pressed", "false");
      if (event.error === "aborted") {
        preserveStatusOnEnd = true;
        return;
      }
      if (event.error === "not-allowed") {
        preserveStatusOnEnd = true;
        statusText.textContent = "Microphone permission blocked.";
      } else if (event.error === "no-speech" && awaitingAnswer) {
        preserveStatusOnEnd = true;
        statusText.textContent = "No speech heard — tap the mic again.";
      } else if (awaitingAnswer) {
        preserveStatusOnEnd = true;
        statusText.textContent = "Couldn’t catch that — try again.";
      }
    };

    recognition.onresult = (event) => {
      const alternatives = [];
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        for (let j = 0; j < result.length; j += 1) {
          alternatives.push(result[j].transcript);
        }
      }

      const verb = currentVerb();
      const match = alternatives.find((text) => matchesVerb(text, verb));
      const skip = alternatives.find((text) => isDontKnow(text));
      handleTranscript(match || skip || alternatives[0] || "");
    };
  }

  function toggleListening() {
    if (!recognition || !awaitingAnswer) return;
    if (listening) {
      stopListening();
      statusText.textContent = "Tap the mic, then speak.";
      return;
    }

    try {
      recognition.start();
    } catch (_) {
      statusText.textContent = "Mic is busy — try again.";
    }
  }

  function goNext() {
    if (awaitingAnswer) return;
    stopSpeech();
    stopListening({ abort: true });
    if (index >= SESSION_SIZE - 1) {
      finishSession();
      return;
    }
    index += 1;
    awaitingAnswer = true;
    preserveStatusOnEnd = false;
    resetPromptUi();
  }

  startTest1.addEventListener("click", startSession);
  quitTest.addEventListener("click", leaveTest);
  backToMenu.addEventListener("click", leaveTest);
  micBtn.addEventListener("click", toggleListening);
  dontKnowBtn.addEventListener("click", () => {
    if (!awaitingAnswer) return;
    revealAnswer({ correct: false, skipped: true, heard: "don’t know" });
  });
  nextBtn.addEventListener("click", goNext);

  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }

  setupRecognition();

  // Expose helpers for manual / automated checks in the browser console.
  window.LearnSpanish = {
    VERBS,
    normalizeSpeech,
    matchesVerb,
    isDontKnow,
    startSession,
  };
})();
