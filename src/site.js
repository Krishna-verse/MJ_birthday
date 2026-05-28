﻿﻿﻿﻿﻿export function initBirthdaySite() {
/* =========================
   DOM ELEMENTS
========================= */
const overlay = document.getElementById("overlay");
const bgm = document.getElementById("bgm");
bgm.volume = 0.3;
const startBtn = document.getElementById("startBtn");
const startScreen = document.getElementById("startScreen");
const heroVideo = document.querySelector(".birthday-hero__bg-video");
const intro = document.getElementById("intro");
const mainContent = document.getElementById("mainContent");

/* Cards */
const wishCard = document.getElementById("wishCard");
const musicCard = document.getElementById("musicCard");
const shareCard = document.getElementById("shareCard");
const gameCard = document.getElementById("gameCard");
const rizzCard = document.getElementById("rizzCard");
const aboutCard = document.getElementById("aboutCard");
const memoriesCard = document.getElementById("memoriesCard");
const picsCard = document.getElementById("picsCard");
const aboutPopup = document.getElementById("aboutPopup");
const memoriesPopup = document.getElementById("memoriesPopup");
const picsPopup = document.getElementById("picsPopup");
const aboutText = document.getElementById("aboutText");
/* Popups */
const wishPopup = document.getElementById("wishPopup");

/* BG Loop Audio */
const bgLoop = new Audio("/2.mp3");
bgLoop.loop = true;
bgLoop.volume = 0.6;

const partyPopup = document.getElementById("partyPopup");
const sharePopup = document.getElementById("sharePopup");
const gamePopup = document.getElementById("gamePopup");
const rizzPopup = document.getElementById("rizzPopup");
const musicPopup = document.getElementById("musicPopup");
const legacyPopups = [wishPopup, partyPopup, sharePopup, gamePopup, rizzPopup, musicPopup, aboutPopup, memoriesPopup, picsPopup];
const popupCloseMs = 260;

let aboutTypingTimeouts = [];
let floatingInterval;
let countdownIntervalId;
let confettiRainIntervalId;
let heartRainIntervalId;
let cardHeartIntervalId;
let musicEmojiIntervalId;
let introMusicStopTimer;
let introCandleTimer;
let introCutTimer;
const cardHeartLayer = document.getElementById("heartFloatLayer");

function pauseBackgroundMusicForPlayer() {
  if (bgm) {
    bgm.pause();
  }
  bgLoop.pause();
}

function resumeBackgroundLoop() {
  if (!bgLoop || isPlaying || (audioPlayer && !audioPlayer.paused)) {
    return;
  }

  const mainIsVisible = mainContent && window.getComputedStyle(mainContent).display !== "none";
  if (mainIsVisible) {
    bgLoop.play().catch(() => {});
  }
}

function stopIntroMusic() {
  bgm.pause();
  bgm.currentTime = 0;
}

function stopIntroMusicAfterIntroText() {
  if (!intro) return;

  const introText = intro.querySelector(".intro-text");
  const lastLine = introText?.querySelector("span:last-child");
  if (!lastLine) return;

  const styles = window.getComputedStyle(lastLine);
  const firstAnimationDuration = styles.animationDuration.split(",")[0] || "0s";
  const firstAnimationDelay = styles.animationDelay.split(",")[0] || "0s";
  const toMs = (value) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? (value.trim().endsWith("ms") ? parsed : parsed * 1000) : 0;
  };

  const stopOnce = () => {
    if (introMusicEnded) return;
    if (introMusicStopTimer) {
      clearTimeout(introMusicStopTimer);
      introMusicStopTimer = undefined;
    }
    stopIntroMusic();
    introMusicEnded = true;
  };

  lastLine.addEventListener(
    "animationend",
    (event) => {
      if (event.animationName === "introReveal") {
        stopOnce();
      }
    },
    { once: true }
  );

  if (introMusicStopTimer) {
    clearTimeout(introMusicStopTimer);
  }

  introMusicStopTimer = setTimeout(stopOnce, toMs(firstAnimationDuration) + toMs(firstAnimationDelay) + 120);
}

/* =========================
   COSMIC BACKDROP
========================= */
const starCanvas = document.getElementById("starCanvas");
const starCtx = starCanvas?.getContext("2d");
const cursor = document.getElementById("cursor");
const cursorTrail = document.getElementById("cursorTrail");
const petalLayer = document.getElementById("petalLayer");
const isTouchDevice =
  typeof window !== "undefined" &&
  (navigator.maxTouchPoints > 0 || "ontouchstart" in window);
const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobilePerformanceMode =
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;
const COSMIC_THEME = "cosmic";
const CLASSIC_THEME = "classic";
let starAnimationFrameId;
let cursorAnimationFrameId;
let resizeHandler;
let mouseMoveHandler;
let themeChangeHandler;

function createStars() {
  if (!starCanvas || !starCtx) {
    return [];
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const count = width < 480 ? 90 : width < 768 ? 130 : 180;

  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 1.5 + 0.35,
    speed: Math.random() * 0.28 + 0.05,
    twinkle: Math.random() * Math.PI * 2
  }));
}

let stars = createStars();

function resizeStarCanvas() {
  if (!starCanvas || !starCtx) {
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;

  starCanvas.width = Math.max(1, Math.floor(width * dpr));
  starCanvas.height = Math.max(1, Math.floor(height * dpr));
  starCanvas.style.width = `${width}px`;
  starCanvas.style.height = `${height}px`;
  starCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  stars = createStars();
}

function drawStars() {
  if (!starCanvas || !starCtx) {
    return;
  }

  starCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  stars.forEach((star) => {
    star.twinkle += 0.018;
    const alpha = 0.28 + 0.52 * Math.abs(Math.sin(star.twinkle));

    starCtx.beginPath();
    starCtx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    starCtx.fillStyle = `rgba(255, 248, 240, ${alpha})`;
    starCtx.fill();

    star.y -= star.speed;
    if (star.y < -5) {
      star.y = window.innerHeight + 5;
      star.x = Math.random() * window.innerWidth;
    }
  });

  starAnimationFrameId = window.requestAnimationFrame(drawStars);
}

function setupCursorTrail() {
  if (isTouchDevice || !cursor || !cursorTrail) {
    return () => {};
  }

  let mx = window.innerWidth / 2;
  let my = window.innerHeight / 2;
  let tx = mx;
  let ty = my;

  cursor.style.left = `${mx}px`;
  cursor.style.top = `${my}px`;
  cursorTrail.style.left = `${tx}px`;
  cursorTrail.style.top = `${ty}px`;

  mouseMoveHandler = (event) => {
    mx = event.clientX;
    my = event.clientY;
    cursor.style.left = `${mx}px`;
    cursor.style.top = `${my}px`;
  };

  document.addEventListener("mousemove", mouseMoveHandler);

  const animateTrail = () => {
    tx += (mx - tx) * 0.15;
    ty += (my - ty) * 0.15;
    cursorTrail.style.left = `${tx}px`;
    cursorTrail.style.top = `${ty}px`;
    cursorAnimationFrameId = window.requestAnimationFrame(animateTrail);
  };

  cursorAnimationFrameId = window.requestAnimationFrame(animateTrail);

  return () => {
    document.removeEventListener("mousemove", mouseMoveHandler);
    if (cursorAnimationFrameId) {
      window.cancelAnimationFrame(cursorAnimationFrameId);
    }
  };
}

function spawnPetals() {
  if (isTouchDevice || prefersReducedMotion || !petalLayer) {
    return;
  }

  const petals = ["\u{1F338}", "\u{2728}", "\u{1F38A}", "\u{2B50}", "\u{1F49B}", "\u{1F388}", "\u{1F31F}", "\u{1F4AB}", "\u{1F389}"];

  for (let i = 0; i < 18; i++) {
    const petal = document.createElement("span");
    petal.className = "petal";
    petal.textContent = petals[Math.floor(Math.random() * petals.length)];
    petal.style.left = `${Math.random() * 100}vw`;
    petal.style.animationDuration = `${7 + Math.random() * 8}s`;
    petal.style.animationDelay = `${Math.random() * 8}s`;
    petal.style.fontSize = `${0.9 + Math.random() * 1.2}rem`;
    petalLayer.appendChild(petal);
  }
}

function clearPetals() {
  if (petalLayer) {
    petalLayer.innerHTML = "";
  }
}

function syncBackdropTheme(nextTheme) {
  if (nextTheme === CLASSIC_THEME) {
    clearPetals();
    return;
  }

  if (petalLayer && !petalLayer.childElementCount) {
    spawnPetals();
  }
}

function setupCosmicBackdrop() {
  const stopCursorTrail = setupCursorTrail();

  if (starCanvas && starCtx && !isMobilePerformanceMode && !prefersReducedMotion) {
    resizeHandler = () => {
      resizeStarCanvas();
    };

    resizeStarCanvas();
    window.addEventListener("resize", resizeHandler);
    drawStars();
  }

  syncBackdropTheme(document.body?.dataset.theme || COSMIC_THEME);

  themeChangeHandler = (event) => {
    const nextTheme = event.detail?.theme || document.body?.dataset.theme || COSMIC_THEME;
    syncBackdropTheme(nextTheme);
  };
  window.addEventListener("birthday:theme-change", themeChangeHandler);

  return () => {
    stopCursorTrail();

    if (themeChangeHandler) {
      window.removeEventListener("birthday:theme-change", themeChangeHandler);
    }

    if (resizeHandler) {
      window.removeEventListener("resize", resizeHandler);
    }

    if (starAnimationFrameId) {
      window.cancelAnimationFrame(starAnimationFrameId);
    }

    if (cursorAnimationFrameId) {
      window.cancelAnimationFrame(cursorAnimationFrameId);
    }

    if (petalLayer) {
      clearPetals();
    }
  };
}

const stopCosmicBackdrop = setupCosmicBackdrop();

/* =========================
   START FLOW
========================= */
/* =========================
   START FLOW
========================= */
let introMusicEnded = false;

startBtn.onclick = function () {
  startScreen.style.opacity = "0";
  startScreen.style.pointerEvents = "none";
  if (heroVideo) {
    heroVideo.pause();
  }

  if (intro) {
    intro.classList.remove("intro-candle-on");
    intro.classList.remove("is-cake-cutting");
    if (introCandleTimer) {
      clearTimeout(introCandleTimer);
    }
    if (introCutTimer) {
      clearTimeout(introCutTimer);
    }
    window.dispatchEvent(new CustomEvent("birthday:intro-start"));
    intro.style.display = "flex";
    introCandleTimer = setTimeout(() => {
      intro?.classList.add("intro-candle-on");
    }, 7000);
    introCutTimer = setTimeout(() => {
      intro?.classList.add("is-cake-cutting");
    }, 3600);
  }

  if (!introMusicEnded) {
    bgm.currentTime = 0;
    bgm.play().catch(() => {});
    stopIntroMusicAfterIntroText();
  }

  setTimeout(() => {
    startScreen.style.display = "none";
    if (intro) {
      intro.classList.remove("intro-candle-on");
      intro.classList.remove("is-cake-cutting");
      intro.style.display = "none";
    }
    if (introCandleTimer) {
      clearTimeout(introCandleTimer);
      introCandleTimer = undefined;
    }
    if (introCutTimer) {
      clearTimeout(introCutTimer);
      introCutTimer = undefined;
    }
    mainContent.style.display = "flex";
    window.dispatchEvent(new CustomEvent("birthday:home-visible"));
    if (!isPlaying) {
      bgLoop.play().catch(() => {});
    }
    sideConfetti();
  }, 10500);
};

const handleHomeVisible = () => {
  startCardHeartRain();
};

window.addEventListener("birthday:home-visible", handleHomeVisible);
/* =========================
   POPUP HELPERS
========================= */
function openPopup(popup) {
  if (popup._closeTimer) {
    clearTimeout(popup._closeTimer);
    popup._closeTimer = undefined;
  }
  popup.classList.remove("is-closing");
  popup.style.display = "block";
  overlay.classList.add("show");
  setTimeout(() => popup.classList.add("show-popup"), 10);
  if (typeof document !== "undefined" && document.body) {
    document.body.classList.add("is-scroll-locked");
    document.body.style.overflow = "hidden";
  }
  window.history.pushState({ popupOpen: true }, "");
  fireCardOpenConfetti();
}

function closePopup(popup, isPopState = false) {
  if (!popup || popup.style.display !== "block") {
    return;
  }

  if (popup._closeTimer) {
    clearTimeout(popup._closeTimer);
  }

  popup.classList.remove("show-popup");
  popup.classList.add("is-closing");
  overlay.classList.remove("show");

  popup._closeTimer = setTimeout(() => {
    popup._closeTimer = undefined;
    popup.classList.remove("is-closing");
    popup.style.display = "none";
    const anyOpen = legacyPopups
      .some((p) => p && p.style.display === "block");
    if (!anyOpen && typeof document !== "undefined" && document.body) {
      document.body.classList.remove("is-scroll-locked");
      document.body.style.overflow = "";
    }

    if (!isPopState && window.history.state?.popupOpen) {
      window.history.back();
    }
  }, popupCloseMs);
}
const overlayClickHandler = (event) => {
  const isPopState = event === "popstate";
  let anyWasOpen = false;

  legacyPopups.forEach(p => {
    if (p && p.style.display === "block") {
      anyWasOpen = true;
      p.classList.remove("blur-active");
      p.classList.remove("show-popup");
      p.classList.add("is-closing");
      if (p._closeTimer) {
        clearTimeout(p._closeTimer);
      }
      p._closeTimer = setTimeout(() => {
        p._closeTimer = undefined;
        p.classList.remove("is-closing");
        p.style.display = "none";
      }, popupCloseMs);
      if (p === rizzPopup) {
        stopHeartRain();
      }
    }
  });

  if (anyWasOpen && !isPopState && window.history.state?.popupOpen) {
    window.history.back();
  }

  overlay.classList.remove("show");
  if (typeof document !== "undefined" && document.body) {
    setTimeout(() => {
      const anyOpen = legacyPopups.some((p) => p && p.style.display === "block");
      if (!anyOpen) {
        document.body.classList.remove("is-scroll-locked");
        document.body.style.overflow = "";
      }
    }, popupCloseMs);
  }

  // Reset About popup properly
  aboutTypingTimeouts.forEach(timeout => clearTimeout(timeout));
  aboutTypingTimeouts = [];
  if (floatingInterval) clearInterval(floatingInterval);
  aboutText.innerHTML = "";
  aboutText.classList.add("typing-cursor");
  aboutPopup.classList.remove("blur-active");
  wishPopup.classList.remove("blur-active");
  rizzPopup.classList.remove("blur-active");

  // Stop music popup audio if needed
  if (isMusicOpen) {
    audioPlayer.pause();
    isPlaying = false;
    updateMusicUI();
    stopIntroMusic();
    stopMusicEmojiFloat();
    resumeBackgroundLoop();
  }

  if (isMemoriesOpen) {
    resumeBackgroundLoop();
  }
};
overlay.addEventListener("click", overlayClickHandler);

/* =========================
   CARD ACTIONS
========================= */
wishCard.onclick = () => {
  openPopup(wishPopup);
  // Trigger background animation after opening
  setTimeout(() => {
    wishPopup.classList.add("blur-active");
    startFloatingEffects("wishImageWrap");
  }, 400);
};
musicCard.onclick = () => {
  pauseBackgroundMusicForPlayer();
  openPopup(musicPopup);
};
memoriesCard.onclick = () => {
  pauseBackgroundMusicForPlayer();
  openPopup(memoriesPopup);
};
picsCard.onclick = () => openPopup(picsPopup);
if (shareCard) shareCard.onclick = () => openPopup(sharePopup);
if (gameCard) {
  gameCard.onclick = () => {
    openPopup(gamePopup);
    gameStart.style.display = "block";
    gameScreen.style.display = "none";
    gameEnd.style.display = "none";
  };
}

function closeWish() { 
  closePopup(wishPopup);
  // Reset blur effect when closed
  setTimeout(() => {
    if (floatingInterval) clearInterval(floatingInterval);
    wishPopup.classList.remove("blur-active");
  }, 300);
}
function closeShare() { closePopup(sharePopup); }
function closeMemories() { 
  closePopup(memoriesPopup); 
  resumeBackgroundLoop();
}
function closePics() { closePopup(picsPopup); }

function closeParty() {
  const partyVideo = document.getElementById("partyVideo");
  if (partyVideo) {
    partyVideo.pause();
    partyVideo.currentTime = 0;
  }
  closePopup(partyPopup);
}

/* =========================
   COUNTDOWN
========================= */
let countdownEl = document.getElementById("countdown");
let targetDate = new Date("May 29, 2026 00:00:00").getTime();

function updateCountdown() {
  if (!countdownEl) {
    return;
  }

  let now = new Date().getTime();
  let gap = targetDate - now;

  if (gap <= 0) {
    countdownEl.innerHTML = "\u{1F389} It's Today! \u{1F389}";
    return;
  }

  let d = Math.floor(gap / (1000 * 60 * 60 * 24));
  let h = Math.floor((gap % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  let m = Math.floor((gap % (1000 * 60 * 60)) / (1000 * 60));
  let s = Math.floor((gap % (1000 * 60)) / 1000);

  countdownEl.innerHTML = `\u{23F3} ${d} Days ${h}h ${m}m ${s}s left`;
}
if (countdownEl) {
  countdownIntervalId = setInterval(updateCountdown, 1000);
  updateCountdown();
}

/* =========================
   SHARE
========================= */
let pageURL = window.location.href;

function shareWhatsApp() {
  let text = "\u{1F389} Check out this amazing birthday page! \u{1F382}\u{1F447}\n" + pageURL;
  let url = "https://wa.me/?text=" + encodeURIComponent(text);
  window.open(url, "_blank");
}

function copyLink() {
  navigator.clipboard.writeText(pageURL);
  document.getElementById("copyMsg").innerText = "\u{2705} Link Copied!";
}

function nativeShare() {
  if (navigator.share) {
    navigator.share({
      title: "Birthday Celebration \u{1F389}",
      text: "Check out this awesome birthday page!",
      url: pageURL
    });
  } else {
    alert("Sharing not supported on this device");
  }
}

/* =========================
   CHATBOT
========================= */
const chatToggle = document.getElementById("chatToggle");
const chatbot = document.getElementById("chatbot");

if (chatToggle && chatbot && !window.__reactChatWidgetEnabled) {
  chatToggle.onclick = function () {
    chatbot.style.display = chatbot.style.display === "block" ? "none" : "block";
  };
}

function quickReply(type) {
  let chatBody = document.getElementById("chatBody");
  let userText = "";
  let reply = "";

  if (type === "birthday") {
    userText = "\u{1F382} Birthday?";
    reply = "29th May \u{1F389}";
  } else if (type === "age") {
    userText = "\u{1F388} Age?";
    reply = "A beautiful legend growing  \u{1F60E}";
  } else if (type === "hobby") {
    userText = "\u{1F3AE} Hobbies?";
    reply = "Gaming, fun, vibes and making memories \u{2728}";
  }

  chatBody.innerHTML += `<div class="user-msg">${userText}</div>`;

  let typingDiv = document.createElement("div");
  typingDiv.className = "typing";
  typingDiv.innerText = "\u{1F916} Typing";
  chatBody.appendChild(typingDiv);

  chatBody.scrollTop = chatBody.scrollHeight;

  setTimeout(() => {
    typingDiv.remove();
    chatBody.innerHTML += `<div class="bot-msg">\u{1F916} ${reply}</div>`;
    chatBody.scrollTop = chatBody.scrollHeight;
  }, 1200);
}

/* =========================
   CONFETTI
========================= */
function dropTopConfetti() {
  if (prefersReducedMotion || typeof confetti !== "function") {
    return;
  }

  confetti({
    particleCount: isMobilePerformanceMode ? 5 : 12,
    angle: 90,
    spread: isMobilePerformanceMode ? 18 : 28,
    startVelocity: isMobilePerformanceMode ? 16 : 22,
    gravity: 1.15,
    ticks: isMobilePerformanceMode ? 90 : 180,
    scalar: isMobilePerformanceMode ? 0.52 : 0.72,
    origin: {
      x: 0.1 + Math.random() * 0.8,
      y: 0
    }
  });
}

function sideConfetti() {
  if (prefersReducedMotion || typeof confetti !== "function") {
    return;
  }

  const bursts = isMobilePerformanceMode ? 2 : 3;
  const particleCount = isMobilePerformanceMode ? 42 : 250;
  const spread = isMobilePerformanceMode ? 54 : 90;
  const scalar = isMobilePerformanceMode ? 0.56 : 1;
  const startVelocity = isMobilePerformanceMode ? 28 : 45;

  for (let i = 0; i < bursts; i++) {
    setTimeout(() => {
      confetti({
        particleCount,
        angle: 60,
        spread,
        scalar,
        startVelocity,
        origin: { x: 0 }
      });

      confetti({
        particleCount,
        angle: 120,
        spread,
        scalar,
        startVelocity,
        origin: { x: 1 }
      });
    }, i * 300);
  }

  if (confettiRainIntervalId) {
    clearInterval(confettiRainIntervalId);
  }

  dropTopConfetti();
  confettiRainIntervalId = setInterval(dropTopConfetti, isMobilePerformanceMode ? 5200 : 2200);
}

function fireCardOpenConfetti() {
  if (prefersReducedMotion || typeof confetti !== "function") {
    return;
  }

  const particleCount = isMobilePerformanceMode ? 28 : 90;
  const scalar = isMobilePerformanceMode ? 0.58 : 0.9;

  confetti({
    particleCount,
    spread: isMobilePerformanceMode ? 58 : 72,
    startVelocity: isMobilePerformanceMode ? 28 : 36,
    gravity: 0.95,
    ticks: isMobilePerformanceMode ? 105 : 160,
    scalar,
    origin: { x: 0.5, y: 0.62 }
  });

  if (isMobilePerformanceMode) {
    return;
  }

  setTimeout(() => {
    confetti({
      particleCount: 36,
      angle: 60,
      spread: 55,
      startVelocity: 30,
      scalar: 0.75,
      origin: { x: 0.08, y: 0.72 }
    });

    confetti({
      particleCount: 36,
      angle: 120,
      spread: 55,
      startVelocity: 30,
      scalar: 0.75,
      origin: { x: 0.92, y: 0.72 }
    });
  }, 120);
}

function stopHeartRain() {
  if (heartRainIntervalId) {
    clearInterval(heartRainIntervalId);
    heartRainIntervalId = undefined;
  }
}

function startHeartRain() {
  stopHeartRain();
  fireHeartBurst(isMobilePerformanceMode ? 3 : 8);
  if (isMobilePerformanceMode) {
    return;
  }
  heartRainIntervalId = setInterval(() => fireHeartBurst(3), 700);
}

function spawnCardHeart() {
  if (!cardHeartLayer) {
    return;
  }

  const heart = document.createElement("span");
  heart.className = "card-heart";
  heart.textContent = ["\u{1F496}", "\u{1F498}", "\u{1F495}", "\u{2764}\u{FE0F}", "\u{1F49E}"][Math.floor(Math.random() * 5)];
  heart.style.left = `${Math.random() * 100}%`;
  heart.style.setProperty("--size", `${14 + Math.random() * 18}px`);
  heart.style.setProperty("--duration", `${5.5 + Math.random() * 3.5}s`);
  heart.style.setProperty("--drift", `${(Math.random() - 0.5) * 120}px`);
  cardHeartLayer.appendChild(heart);

  setTimeout(() => heart.remove(), 9500);
}

function startCardHeartRain() {
  if (!cardHeartLayer || isMobilePerformanceMode) {
    return;
  }

  if (cardHeartIntervalId) {
    clearInterval(cardHeartIntervalId);
  }

  spawnCardHeart();
  spawnCardHeart();
  spawnCardHeart();
  cardHeartIntervalId = setInterval(() => {
    spawnCardHeart();
    spawnCardHeart();
  }, 420);
}

function stopCardHeartRain() {
  if (cardHeartIntervalId) {
    clearInterval(cardHeartIntervalId);
    cardHeartIntervalId = undefined;
  }
}

/* =========================
   GAME
========================= */
let gameStart = document.getElementById("gameStart");
let gameScreen = document.getElementById("gameScreen");
let gameEnd = document.getElementById("gameEnd");
let gameArea = document.getElementById("gameArea");

let scoreEl = document.getElementById("score");
let timeEl = document.getElementById("timeLeft");
let finalScoreEl = document.getElementById("finalScore");
let leaderboardEl = document.getElementById("leaderboard");

let score = 0;
let timeLeft = 40;
let gameInterval, timerInterval;
let spawnSpeed = 800;

function startGameUI() {
  gameStart.style.display = "none";
  gameScreen.style.display = "block";

  score = 0;
  timeLeft = 40;
  spawnSpeed = 800;

  scoreEl.innerText = score;
  timeEl.innerText = timeLeft;
  gameArea.innerHTML = "";

  gameInterval = setInterval(createObject, spawnSpeed);

  timerInterval = setInterval(() => {
    timeLeft--;
    timeEl.innerText = timeLeft;

    if (timeLeft % 5 === 0 && spawnSpeed > 300) {
      spawnSpeed -= 100;
      clearInterval(gameInterval);
      gameInterval = setInterval(createObject, spawnSpeed);
    }

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

function endGame() {
  clearInterval(gameInterval);
  clearInterval(timerInterval);

  gameScreen.style.display = "none";
  gameEnd.style.display = "block";

  finalScoreEl.innerText = score;

  saveScore(score);
  loadLeaderboard();
}

function restartGame() {
  gameEnd.style.display = "none";
  startGameUI();
}

function closeGame() {
  closePopup(gamePopup);
  clearInterval(gameInterval);
  clearInterval(timerInterval);
}

function createObject() {
  let obj = document.createElement("div");
  let isBomb = Math.random() < 0.2;

  obj.innerText = isBomb ? "\u{1F4A3}" : "\u{1F382}";
  obj.className = isBomb ? "bomb" : "cake";

  obj.style.left = Math.random() * 90 + "%";
  obj.style.top = "-30px";

  let duration = Math.random() * 2 + 2;
  gameArea.appendChild(obj);

  obj.onclick = function () {
    if (isBomb) {
      score -= 2;
    } else {
      score += 1;
      if (typeof confetti === "function") {
        confetti({ particleCount: 40, spread: 50 });
      }
    }
    scoreEl.innerText = score;
    obj.remove();
  };

  obj.animate(
    [{ transform: "translateY(0px)" }, { transform: "translateY(350px)" }],
    { duration: duration * 1000, easing: "linear" }
  );

  setTimeout(() => obj.remove(), duration * 1000);
}

function saveScore(score) {
  let scores = JSON.parse(localStorage.getItem("leaderboard")) || [];
  scores.push(score);
  scores.sort((a, b) => b - a);
  scores = scores.slice(0, 5);
  localStorage.setItem("leaderboard", JSON.stringify(scores));
}

function loadLeaderboard() {
  let scores = JSON.parse(localStorage.getItem("leaderboard")) || [];
  leaderboardEl.innerHTML = "";
  scores.forEach((s, i) => {
    leaderboardEl.innerHTML += `<li>\u{1F3C6} ${i + 1}. ${s}</li>`;
  });
}

/* =========================
   RIZZ GENERATOR
========================= */
let generateRizzBtn = document.getElementById("generateRizzBtn");
let rizzOutput = document.getElementById("rizzOutput");
let heartBurstContainer = document.getElementById("heartBurstContainer");

const rizzLines = [
  "I don't need Spotify recommendations anymore. You already became my favorite track.",
  "If confidence had a face, it'd still be nervous talking to you.",
  "You're proof that God flexes sometimes.",
  "I swear your voice fixes bad days faster than sleep.",
  "You're the only distraction I've never tried to fix.",
  "You're the first person I want to tell things to.",
  "You've got me smiling at my phone like an idiot in public.",
  "You walked in and suddenly everyone else became background characters.",
  "Loving you feels less like a choice and more like something my heart decided before I could think.",
  "I could have the worst day ever, and one message from you still fixes it.",
  "Even in a crowded room, my eyes still search for you first.",
  "I don't need perfect days. I just need days with you in them.",
  "No matter how busy life gets, you'll always be my favorite part of it."
];

let lastRizzIndex = -1;

rizzCard.onclick = function () {
  openPopup(rizzPopup);
  startHeartRain();
  setTimeout(() => {
    rizzPopup.classList.add("blur-active");
    startFloatingEffects("rizzImageWrap");
  }, 400);
};

function closeRizz() {
  closePopup(rizzPopup);
  stopHeartRain();
  setTimeout(() => {
    rizzOutput.innerHTML = "";
    rizzPopup.classList.remove("blur-active");
    if (floatingInterval) clearInterval(floatingInterval);
  }, 300);
}

generateRizzBtn.addEventListener("click", () => {
  let randomIndex;

  do {
    randomIndex = Math.floor(Math.random() * rizzLines.length);
  } while (randomIndex === lastRizzIndex && rizzLines.length > 1);

  lastRizzIndex = randomIndex;
  const randomLine = rizzLines[randomIndex];

  rizzOutput.innerHTML = `
    <div class="rizz-card">
      <div id="rizzText" class="rizz-text typing-cursor"></div>
      <button id="copyRizzBtn" class="copy-btn" style="display:none;">\u{1F4CB} Copy</button>
    </div>
  `;

  typeWriterEffect(randomLine, document.getElementById("rizzText"), () => {
    document.getElementById("rizzText").classList.remove("typing-cursor");
    document.getElementById("copyRizzBtn").style.display = "inline-block";

    document.getElementById("copyRizzBtn").addEventListener("click", () => {
      const text = document.getElementById("rizzText").innerText;
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById("copyRizzBtn");
        btn.textContent = "\u{2705} Copied!";
        setTimeout(() => btn.textContent = "\u{1F4CB} Copy", 2000);
      });
    });
  });

  fireHeartBurst(10);

  if (typeof confetti === "function") {
    confetti({
      particleCount: 60,
      spread: 65,
      origin: { y: 0.7 }
    });
  }
});

function typeWriterEffect(text, element, callback) {
  let i = 0;
  element.textContent = "";

  function type() {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      setTimeout(type, 35);
    } else {
      if (callback) callback();
    }
  }

  type();
}

function heartBurst() {
  const hearts = ["\u{1F496}", "\u{1F498}", "\u{1F495}", "\u{2764}\u{FE0F}", "\u{1F49E}"];

  for (let i = 0; i < 14; i++) {
    const heart = document.createElement("span");
    heart.className = "heart";
    heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];

    const startX = 45 + Math.random() * 10;
    const startY = 55 + Math.random() * 10;

    heart.style.left = `${startX}%`;
    heart.style.top = `${startY}%`;

    const xMove = (Math.random() - 0.5) * 220 + "px";
    const yMove = -(Math.random() * 180 + 60) + "px";

    heart.style.setProperty("--xMove", xMove);
    heart.style.setProperty("--yMove", yMove);

    heartBurstContainer.appendChild(heart);

    setTimeout(() => {
      heart.remove();
    }, 1800);
  }
}

function fireHeartBurst(count = 14) {
  if (!heartBurstContainer) {
    return;
  }

  const hearts = ["\u{1F496}", "\u{1F498}", "\u{1F495}", "\u{2764}\u{FE0F}", "\u{1F49E}"];

  for (let i = 0; i < count; i++) {
    const heart = document.createElement("span");
    heart.className = "heart";
    heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];

    const startX = 8 + Math.random() * 84;
    const startY = Math.random() * 8;

    heart.style.left = `${startX}%`;
    heart.style.bottom = `${startY}%`;

    const xMove = `${(Math.random() - 0.5) * 160}px`;
    const yMove = `${-(Math.random() * 260 + 140)}px`;

    heart.style.setProperty("--xMove", xMove);
    heart.style.setProperty("--yMove", yMove);
    heart.style.animationDelay = `${Math.random() * 0.2}s`;

    heartBurstContainer.appendChild(heart);

    setTimeout(() => {
      heart.remove();
    }, 1800);
  }
}

function closeMusic() {
  stopIntroMusic(); // force stop bgm too
  closePopup(musicPopup);

  if (audioPlayer) {
    audioPlayer.pause();
  }
  isPlaying = false;
  updateMusicUI();
  stopMusicEmojiFloat();
  resumeBackgroundLoop();
}
/* =========================
   YOUTUBE MUSIC PLAYER
========================= */
const songs = [
  {
    title: "Arcades",
    artist: "",
    url: "/Arcades.aac",
    image: "/first_music_img.jpeg",
    glow: {
      primary: "144, 144, 144",
      secondary: "22, 22, 22",
      highlight: "232, 232, 232",
      core: "96, 96, 96",
    },
  },
  {
    title: "Bairan",
    artist: "Amit Saini Rohtakiya",
    url: "/Bairan.mpeg",
    image: "/second_music_img.jpeg",
    glow: {
      primary: "255, 255, 255",
      secondary: "214, 214, 214",
      highlight: "255, 255, 255",
      core: "248, 248, 248",
    },
  },
  {
    title: "New West",
    artist: "Those Eyes",
    url: "/New west Those eyes.mpeg",
    image: "/third_music_img.jpeg",
    glow: {
      primary: "84, 138, 255",
      secondary: "255, 72, 138",
      highlight: "214, 232, 255",
      core: "129, 168, 255",
    },
  },
  {
    title: "Runaway",
    artist: "",
    url: "/Runaway.mpeg",
    image: "/fouth_music_img.jpeg",
    glow: {
      primary: "255, 207, 64",
      secondary: "214, 26, 26",
      highlight: "255, 238, 165",
      core: "255, 176, 36",
    },
  },
  {
    title: "Main khoo gya",
    artist: "Anuv Jain",
    url: "/Main khoo gya.mpeg",
    image: "/fifth_music_img.jpeg",
    glow: {
      primary: "114, 196, 116",
      secondary: "230, 255, 230",
      highlight: "255, 255, 255",
      core: "158, 226, 160",
    },
  },
  {
    title:'let me love you',
    artist:'',
    url : '/let me love you.aac',
    image : '/sixth_music_img.jpeg',
    glow: {
      primary: "128, 128, 128",
      secondary: "0, 0, 0",
      highlight: "255, 255, 255",
      core: "160, 160, 160",
    },
  },
  {
    title:"i don't know what to do",
    artist:'',
    url : '/I dont know what to do.aac',
    image : '/seventh_music_img.jpeg',
    glow: {
      primary: "255, 0, 0",
      secondary: "255, 255, 0",
      highlight: "255, 255, 255",
      core: "0, 255, 0",
    },
  },
  {
    title:"Middle of the  night",
    artist:'',
    url : '/Middle of the night.aac',
    image : '/eight_music_img.jpeg',
    glow: {
      primary: "255, 105, 180",
      secondary: "0, 0, 255",
      highlight: "255, 255, 255",
      core: "40, 40, 40",
    },
  },
  {
    title:'Night we met',
    artist:'',
    url : '/Night we met.aac',
    image : '/ninth_music_img.jpeg',
    glow: {
      primary: "255, 105, 180",
      secondary: "0, 0, 0",
      highlight: "255, 255, 255",
      core: "255, 0, 0",
    },
  },
  {
    title:'On my way',
    artist:'',
    url : '/On my way.aac',
    image : '/tenth_music_img.jpeg',
    glow: {
      primary: "255, 255, 255",
      secondary: "0, 0, 0",
      highlight: "200, 200, 200",
      core: "128, 128, 128",
    },
  },
  {
    title:'Sugar and brownies',
    artist:'',
    url : '/Sugar and brownies.aac',
    image : '/eleventh_music_img.jpeg',
    glow: {
      primary: "128, 128, 128",
      secondary: "0, 0, 0",
      highlight: "255, 255, 255",
      core: "255, 255, 0",
    },
  },
  {
    title:'Her',
    artist:'',
    url : '/Her.aac',
    image : '/twelveth_music_img.jpeg',
    glow: {
      primary: "255, 255, 255",
      secondary: "0, 0, 0",
      highlight: "255, 255, 255",
      core: "30, 30, 30",
    },
  },
  {
    title:'Dark side',
    artist:'',
    url : '/Dark side.aac',
    image : '/thirteen_music_img.jpeg',
    glow: {
      primary: "255, 255, 255",
      secondary: "0, 0, 0",
      highlight: "255, 255, 255",
      core: "30, 30, 30",
    },
  },
  {
    title:'Dhyan rakha kar',
    artist:'',
    url : '/Dhyan rakha kar.aac',
    image : '/fourteen_music_img.jpeg',
    glow: {
      primary: "0, 0, 255",
      secondary: "255, 255, 0",
      highlight: "255, 255, 255",
      core: "255, 0, 0",
    },
  },
];

let audioPlayer = new Audio();
audioPlayer.preload = "auto";
audioPlayer.volume = 0.85;
let currentSong = 0;
let isPlaying = false;
let recordingAudioState = null;
let suppressBackgroundResume = false;

const songTitle = document.getElementById("songTitle");
const musicArt = document.getElementById("musicArt");
const musicArtWrap = document.querySelector(".music-player__art-wrap");
const songStatus = document.getElementById("songStatus");
const playBtn = document.getElementById("playBtn");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");
const playlistCount = document.getElementById("playlistCount");
const musicProgressFill = document.getElementById("musicProgressFill");
const musicCurrentTime = document.getElementById("musicCurrentTime");
const musicDuration = document.getElementById("musicDuration");
const musicTrackList = document.getElementById("musicTrackList");
const musicEmojiLayer = document.getElementById("musicEmojiLayer");
const musicVolume = document.getElementById("musicVolume");
const musicVolumeValue = document.getElementById("musicVolumeValue");
const musicProgressBar = document.getElementById("musicProgressBar");

function formatTrackTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function renderMusicQueue() {
  if (!musicTrackList) {
    return;
  }

  musicTrackList.innerHTML = songs.map((song, index) => `
    <div class="music-queue-item${index === currentSong ? " is-active" : ""}">
      <span class="music-queue-item__number">${String(index + 1).padStart(2, "0")}</span>
      <span class="music-queue-item__title">${song.title}</span>
      <span class="music-queue-item__tag">${index === currentSong ? "Live" : "Queue"}</span>
    </div>
  `).join("");
}

let isDraggingProgress = false;

function updateMusicProgress() {
  if (isDraggingProgress) return;

  if (musicProgressFill || musicProgressBar || musicCurrentTime || musicDuration) {
    const duration = audioPlayer.duration;
    const currentTime = audioPlayer.currentTime;
    
    if (Number.isFinite(duration) && duration > 0) {
      const progress = Math.min(100, (currentTime / duration) * 100);
      if (musicProgressFill) musicProgressFill.style.width = `${progress}%`;
      if (musicProgressBar) musicProgressBar.value = progress;
      
      if (musicCurrentTime) musicCurrentTime.textContent = formatTrackTime(currentTime);
      if (musicDuration) {
        const remaining = duration - currentTime;
        musicDuration.textContent = "-" + formatTrackTime(remaining > 0 ? remaining : 0);
      }
    } else {
      if (musicProgressFill) musicProgressFill.style.width = "0%";
      if (musicProgressBar) musicProgressBar.value = 0;
      if (musicCurrentTime) musicCurrentTime.textContent = "0:00";
      if (musicDuration) musicDuration.textContent = "0:00";
    }
  }
}

function updateMusicUI() {
  const currentTrack = songs[currentSong];
  if (songTitle) songTitle.textContent = songs[currentSong].title;
  if (musicArt) {
    musicArt.src = currentTrack.image || "/music_img.png";
    musicArt.alt = `${currentTrack.title} cover art`;
  }
  if (musicArtWrap) {
    const glow = currentTrack.glow || songs[0].glow;
    musicArtWrap.style.setProperty("--music-glow-primary", glow.primary);
    musicArtWrap.style.setProperty("--music-glow-secondary", glow.secondary);
    musicArtWrap.style.setProperty("--music-glow-highlight", glow.highlight);
    musicArtWrap.style.setProperty("--music-glow-core", glow.core);
  }
  const songArtist = document.getElementById("songArtist");
  if (songArtist) songArtist.textContent = currentTrack.artist || "MJ's Selection";
  
  if (playlistCount) playlistCount.textContent = `${currentSong + 1} / ${songs.length}`;
  if (playBtn) {
    playBtn.innerHTML = isPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
    playBtn.setAttribute("aria-label", isPlaying ? "Pause song" : "Play song");
  }
  if (songStatus) songStatus.textContent = isPlaying ? "Now Playing" : "Paused";
  
  musicPopup?.classList.toggle("is-playing", isPlaying);
  renderMusicQueue();
  updateMusicProgress();
}

function updateMusicVolume(value) {
  const parsedValue = Number.parseInt(value, 10);
  const volume = Number.isFinite(parsedValue)
    ? Math.min(100, Math.max(0, parsedValue))
    : 85;

  audioPlayer.volume = volume / 100;

  if (musicVolumeValue) {
    musicVolumeValue.textContent = `${volume}%`;
  }
}

function spawnMusicEmoji() {
  if (!musicEmojiLayer || !musicPopup?.classList.contains("show-popup")) {
    return;
  }

  const emoji = document.createElement("span");
  emoji.className = "music-floating-emoji";
  emoji.textContent = ["\u{1F3B5}", "\u{1F3B6}", "\u{2728}", "\u{1F496}", "\u{1F49F}"][Math.floor(Math.random() * 5)];
  emoji.style.left = `${12 + Math.random() * 76}%`;
  emoji.style.bottom = `${8 + Math.random() * 18}%`;
  emoji.style.setProperty("--xMove", `${(Math.random() - 0.5) * 120}px`);
  emoji.style.setProperty("--yMove", `${-(120 + Math.random() * 170)}px`);
  emoji.style.setProperty("--spin", `${(Math.random() - 0.5) * 36}deg`);
  emoji.style.animationDuration = `${2.2 + Math.random() * 1.1}s`;

  musicEmojiLayer.appendChild(emoji);
  setTimeout(() => emoji.remove(), 3600);
}

function startMusicEmojiFloat() {
  return;
}

function stopMusicEmojiFloat() {
  if (musicEmojiIntervalId) {
    clearInterval(musicEmojiIntervalId);
    musicEmojiIntervalId = undefined;
  }
  if (musicEmojiLayer) {
    musicEmojiLayer.innerHTML = "";
  }
}

audioPlayer.onended = () => {
  nextSong();
};

audioPlayer.ontimeupdate = updateMusicProgress;
audioPlayer.onloadedmetadata = updateMusicProgress;
audioPlayer.addEventListener("play", () => {
  pauseBackgroundMusicForPlayer();
});
audioPlayer.addEventListener("pause", () => {
  if (suppressBackgroundResume) {
    return;
  }

  if (!isPlaying) {
    resumeBackgroundLoop();
  }
});

function pauseAudioForRecording() {
  if (recordingAudioState) {
    return;
  }

  recordingAudioState = {
    bgmWasPlaying: Boolean(bgm && !bgm.paused),
    bgLoopWasPlaying: Boolean(bgLoop && !bgLoop.paused),
    audioPlayerWasPlaying: Boolean(audioPlayer && !audioPlayer.paused),
  };

  suppressBackgroundResume = true;
  bgm?.pause();
  bgLoop?.pause();
  audioPlayer?.pause();
  suppressBackgroundResume = false;

  if (recordingAudioState.audioPlayerWasPlaying) {
    isPlaying = false;
    updateMusicUI();
    stopMusicEmojiFloat();
  }
}

function resumeAudioAfterRecording() {
  if (!recordingAudioState) {
    return;
  }

  const state = recordingAudioState;
  recordingAudioState = null;

  if (state.audioPlayerWasPlaying && audioPlayer) {
    isPlaying = true;
    pauseBackgroundMusicForPlayer();
    audioPlayer.play().catch(() => {
      isPlaying = false;
      updateMusicUI();
      resumeBackgroundLoop();
    });
    updateMusicUI();
    startMusicEmojiFloat();
    return;
  }

  if (state.bgmWasPlaying && bgm) {
    bgm.play().catch(() => {});
    return;
  }

  if (state.bgLoopWasPlaying) {
    bgLoop.play().catch(() => {});
  }
}

window.addEventListener("birthday:recording-audio-pause", pauseAudioForRecording);
window.addEventListener("birthday:recording-audio-resume", resumeAudioAfterRecording);

function playSong() {
  pauseBackgroundMusicForPlayer();
  if (!audioPlayer.src) {
    audioPlayer.src = songs[currentSong].url;
    audioPlayer.load();
  }
  isPlaying = true;
  const playPromise = audioPlayer.play();
  if (playPromise?.catch) {
    playPromise.catch(() => {
      isPlaying = false;
      if (songStatus) {
        songStatus.textContent = "Tap play again";
      }
      updateMusicUI();
      stopMusicEmojiFloat();
      resumeBackgroundLoop();
    });
  }
  updateMusicUI();
  startMusicEmojiFloat();
}

function pauseSong() {
  audioPlayer.pause();
  isPlaying = false;
  updateMusicUI();
  stopMusicEmojiFloat();
  resumeBackgroundLoop();
}

function loadSong(index, autoplay = true) {
  currentSong = index;
  audioPlayer.src = songs[currentSong].url;
  audioPlayer.load();

  if (!autoplay) {
    audioPlayer.pause();
    isPlaying = false;
  } else {
    pauseBackgroundMusicForPlayer();
    audioPlayer.currentTime = 0;
    isPlaying = true;
    const playPromise = audioPlayer.play();
    if (playPromise?.catch) {
      playPromise.catch(() => {
        isPlaying = false;
        if (songStatus) {
          songStatus.textContent = "Tap play again";
        }
        updateMusicUI();
        stopMusicEmojiFloat();
        resumeBackgroundLoop();
      });
    }
    startMusicEmojiFloat();
  }

  updateMusicUI();
}

function nextSong() {
  currentSong = (currentSong + 1) % songs.length;
  loadSong(currentSong, true);
}

function prevSong() {
  currentSong = (currentSong - 1 + songs.length) % songs.length;
  loadSong(currentSong, true);
}

playBtn.addEventListener("click", () => {
  if (!isPlaying) {
    playSong();
  } else {
    pauseSong();
  }
});

nextBtn.addEventListener("click", () => {
  nextSong();
});

prevBtn.addEventListener("click", () => {
  prevSong();
});

if (musicVolume) {
  updateMusicVolume(musicVolume.value);
  musicVolume.addEventListener("input", (event) => {
    updateMusicVolume(event.target.value);
  });
}

if (musicProgressBar) {
  const startDrag = () => {
    isDraggingProgress = true;
  };
  const stopDrag = () => {
    if (isDraggingProgress) {
      applySeekFromBar();
    }
    isDraggingProgress = false;
  };
  const applySeekFromBar = () => {
    if (!Number.isFinite(audioPlayer.duration) || audioPlayer.duration <= 0) {
      return;
    }
    const seekTime = (Number(musicProgressBar.value) / 100) * audioPlayer.duration;
    audioPlayer.currentTime = seekTime;
  };

  musicProgressBar.addEventListener("pointerdown", startDrag);
  musicProgressBar.addEventListener("pointerup", stopDrag);
  musicProgressBar.addEventListener("pointercancel", stopDrag);
  musicProgressBar.addEventListener("change", stopDrag);
  window.addEventListener("blur", stopDrag);

  musicProgressBar.addEventListener("input", () => {
    applySeekFromBar();
    if (musicProgressFill) {
      musicProgressFill.style.width = `${musicProgressBar.value}%`;
    }
    if (audioPlayer.duration && musicCurrentTime) {
      const seekTime = (musicProgressBar.value / 100) * audioPlayer.duration;
      musicCurrentTime.textContent = formatTrackTime(seekTime);
      const remaining = audioPlayer.duration - seekTime;
      if (musicDuration) musicDuration.textContent = "-" + formatTrackTime(remaining > 0 ? remaining : 0);
    }
  });
}

loadSong(currentSong, false);

/* =========================
   ABOUT YOU POPUP
========================= */
const aboutPoints = [
  "• Samruddhi Ghanshyam Burde (#samu)",
  "• So Vincenzo (fav kdrama) se----- vin + cenzo----cenzo----senzo(s mera name ka first letter hai)-----senoo(sound acha kar raha tha😂)",
  "• Opposite of Honey bunn",
  "• Follow Take respect, give respect formula",
  "• Completed class 12th and wants to get into IT",
  "• Actual interest to be a Hacker",
  "• Wanna go in cyber",
  "• DOB =May 29 , 2008",
  "• play CODM",
  "• Have one big brother(Himanshu)",
  "• Bahut shariff😉",
  "• likes butterscotch icecream",
  "• likes grey colour",
  "• Surname = Burde",
  "• I met her on 13/04/2026 on behalf of blocked by Honey bunn",
  "• Time = 1:51 She confronts me and said (. .... ...) on 29th May 2008",
  "• shoe size 8 no.",
  "• overthinker",
  "• submissive baddie",
  "• likes colour grey",
  "• loves butterscotch icecream",
  "• introvert",
  "• fav. Series = Vincenzo",
  "• fav. Food = Biryani (Chicken)",
  "• Boa Hancock",
  "• Osara",
  "• MJ",
  "• Kanojo",
  "• wants to make parents proud",
  "• loves to play CODM",
  "• likes to do writing",
  "• It's me or them (story written by her)",
  "• Overshare",
  "• what's her type? = The one respects her and one who won't cheat, understand her and love her (Sam Words)",
  "• Swimming class 5 to 6 o'clock in Evening",
  "• Mom is strict",
  "• very emotional towards the person she loves",
  "• likes coffee",
  "• Loves to explore new things",
  "• Under confident but try to be confident 👌",
  "• negative thinking 😑(Generally)",
  "• Sweetheart ❤️‍🩹",
  "• Kind hearted 🩶",
  "• Live in Nagpur, Maharashtra",
  "• Use LHS = RHS formula IRL🙃",
  "• Video Editor",
  "• Quakwhooooooooo",
  "• Marathi Mulgi",
  "• Gamer 💝"
];
const aboutContent = document.querySelector("#aboutPopup .about-content");

aboutCard.onclick = function () {
  openPopup(aboutPopup);
  startAboutTyping();
};

function closeAbout() {
  closePopup(aboutPopup);

  aboutTypingTimeouts.forEach(timeout => clearTimeout(timeout));
  aboutTypingTimeouts = [];
  if (floatingInterval) clearInterval(floatingInterval);

  setTimeout(() => {
    aboutText.innerHTML = "";
    aboutText.classList.add("typing-cursor");
    aboutPopup.classList.remove("blur-active");
  }, 300);
}

function startAboutTyping() {
  aboutTypingTimeouts.forEach(timeout => clearTimeout(timeout));
  aboutTypingTimeouts = [];

  aboutText.innerHTML = "";
  aboutText.classList.add("typing-cursor");
  aboutPopup.classList.remove("blur-active");
  if (aboutContent) {
    aboutContent.scrollTop = 0;
  }
  if (aboutText) {
    aboutText.scrollTop = 0;
  }

  const slideAboutText = () => {
    window.requestAnimationFrame(() => {
      if (aboutContent) {
        aboutContent.scrollTop = aboutContent.scrollHeight;
      }
      if (aboutText) {
        aboutText.scrollTop = aboutText.scrollHeight;
      }
    });
  };

  // Start blur effect after a short delay
  setTimeout(() => {
    aboutPopup.classList.add("blur-active");
    startFloatingEffects();
  }, 400);

  let pointIndex = 0;
  function typeNextPoint() {
    if (pointIndex >= aboutPoints.length) {
      aboutText.classList.remove("typing-cursor");
      return;
    }

    const point = aboutPoints[pointIndex];
    const span = document.createElement("span");
    span.className = "point";
    aboutText.appendChild(span);

    let charIndex = 0;
    function typeLetter() {
      if (charIndex < point.length) {
        span.textContent += point[charIndex];
        charIndex++;
        slideAboutText();
        let t = setTimeout(typeLetter, 30);
        aboutTypingTimeouts.push(t);
      } else {
        pointIndex++;
        slideAboutText();
        let t = setTimeout(typeNextPoint, 300);
        aboutTypingTimeouts.push(t);
      }
    }
    typeLetter();
  }

  let startT = setTimeout(typeNextPoint, 800);
  aboutTypingTimeouts.push(startT);
}

function startFloatingEffects(containerId = "aboutImageWrap") {
  if (floatingInterval) clearInterval(floatingInterval);
  const container = document.getElementById(containerId);
  if (!container) return;
  floatingInterval = setInterval(() => {
    const symbols = ["\u{1F496}", "\u{2728}", "\u{1F338}", "\u{2B50}", "\u{1F498}"];
    const item = document.createElement("span");
    item.className = "floating-item";
    item.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    item.style.left = Math.random() * 100 + "%";
    item.style.top = Math.random() * 100 + "%";
    container.appendChild(item);
    setTimeout(() => item.remove(), 2500);
  }, 400);
}
/* =========================
   FOOTER
========================= */
const footer = document.createElement("footer");
footer.className = "site-footer";
footer.innerHTML = `
  <div class="site-footer__inner">
    <div class="site-footer__copy">
      <span class="site-footer__badge">Made with love</span>
      <p>Happy Birthday, MJ</p>
    </div>
    <button class="site-footer__button" id="footerSignOutBtn" type="button">Sign out</button>
  </div>
`;
mainContent.appendChild(footer);

Object.assign(window, {
  closeParty,
  closeWish,
  closeShare,
  shareWhatsApp,
  copyLink,
  nativeShare,
  closeRizz,
  closeGame,
  startGameUI,
  restartGame,
  closeMusic,
  closeAbout,
  closeMemories,
  closePics
});

const handlePopState = () => {
  if (document.querySelector(".fullscreen-video-modal")) {
    return;
  }
  overlayClickHandler("popstate");
};
window.addEventListener("popstate", handlePopState);

return () => {
  overlay.removeEventListener("click", overlayClickHandler);
  window.removeEventListener("popstate", handlePopState);
  window.removeEventListener("birthday:home-visible", handleHomeVisible);
  window.removeEventListener("birthday:recording-audio-pause", pauseAudioForRecording);
  window.removeEventListener("birthday:recording-audio-resume", resumeAudioAfterRecording);
  clearInterval(countdownIntervalId);
  if (confettiRainIntervalId) clearInterval(confettiRainIntervalId);
  stopHeartRain();
  stopCardHeartRain();
  if (floatingInterval) clearInterval(floatingInterval);
  if (gameInterval) clearInterval(gameInterval);
  if (timerInterval) clearInterval(timerInterval);
  if (introMusicStopTimer) clearTimeout(introMusicStopTimer);
  aboutTypingTimeouts.forEach(timeout => clearTimeout(timeout));
  aboutTypingTimeouts = [];
  if (audioPlayer) audioPlayer.pause();
  stopMusicEmojiFloat();
  if (bgLoop) bgLoop.pause();
  stopIntroMusic();
  if (stopCosmicBackdrop) stopCosmicBackdrop();
};
}
