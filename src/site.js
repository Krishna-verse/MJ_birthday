export function initBirthdaySite() {
/* =========================
   DOM ELEMENTS
========================= */
const overlay = document.getElementById("overlay");
const bgm = document.getElementById("bgm");
bgm.volume = 0.3;
const startBtn = document.getElementById("startBtn");
const startScreen = document.getElementById("startScreen");
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
const bgSettings = document.getElementById("bgSettings");
const bgToggleLink = document.getElementById("bgToggleLink");
const bgVolumeSlider = document.getElementById("bgVolumeSlider");

const partyPopup = document.getElementById("partyPopup");
const sharePopup = document.getElementById("sharePopup");
const gamePopup = document.getElementById("gamePopup");
const rizzPopup = document.getElementById("rizzPopup");
const musicPopup = document.getElementById("musicPopup");

let aboutTypingTimeouts = [];
let floatingInterval;
let countdownIntervalId;
let confettiRainIntervalId;
let heartRainIntervalId;
let cardHeartIntervalId;
let introMusicStopTimer;
const cardHeartLayer = document.getElementById("heartFloatLayer");


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
   PARTICLES
========================= */
const isCompactViewport = typeof window !== "undefined" && window.matchMedia("(max-width: 480px)").matches;
const isTouchDevice =
  typeof window !== "undefined" &&
  (navigator.maxTouchPoints > 0 || "ontouchstart" in window);

tsParticles.load("particles-bg", {
  particles: {
    number: { value: isCompactViewport ? 18 : 80, density: { enable: true, area: isCompactViewport ? 1200 : 800 } },
    color: { value: "#d9d9d9" },
    links: { enable: true, color: "#d9d9d9", distance: isCompactViewport ? 120 : 150 },
    move: { enable: true, speed: isCompactViewport ? 0.6 : 1 },
    size: { value: { min: 1, max: isCompactViewport ? 3 : 4 } },
    opacity: { value: isCompactViewport ? 0.45 : 0.6 }
  },
  interactivity: isTouchDevice
    ? {
        events: {
          onHover: { enable: false },
          onClick: { enable: false }
        }
      }
    : {
        events: {
          onHover: { enable: true, mode: "repulse" },
          onClick: { enable: false }
        },
        modes: {
          repulse: { distance: 120 }
        }
      },
  responsive: [
    {
      maxWidth: 768,
      options: {
        particles: {
          number: { value: 30 },
          links: { distance: 130 }
        }
      }
    },
    {
      maxWidth: 480,
      options: {
        particles: {
          number: { value: 18 },
          links: { distance: 120 },
          move: { speed: 0.6 },
          opacity: { value: 0.45 }
        }
      }
    }
  ]
});

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

  if (intro) {
    intro.style.display = "flex";
  }

  if (!introMusicEnded) {
    bgm.currentTime = 0;
    bgm.play().catch(() => {});
    stopIntroMusicAfterIntroText();
  }

  setTimeout(() => {
    startScreen.style.display = "none";
    if (intro) {
      intro.style.display = "none";
    }
    mainContent.style.display = "flex";
    window.dispatchEvent(new CustomEvent("birthday:home-visible"));
    bgSettings.style.display = "flex";
    bgLoop.play().catch(() => {});
    sideConfetti();
  }, 6000);
};

const handleHomeVisible = () => {
  startCardHeartRain();
};

window.addEventListener("birthday:home-visible", handleHomeVisible);
/* =========================
   POPUP HELPERS
========================= */
function openPopup(popup) {
  popup.style.display = "block";
  overlay.classList.add("show");
  setTimeout(() => popup.classList.add("show-popup"), 10);
  if (typeof document !== "undefined" && document.body) {
    document.body.style.overflow = "hidden";
  }
}

function closePopup(popup) {
  popup.classList.remove("show-popup");
  overlay.classList.remove("show");
  setTimeout(() => {
    popup.style.display = "none";
    const anyOpen = [wishPopup, partyPopup, sharePopup, gamePopup, rizzPopup, musicPopup, aboutPopup, memoriesPopup, picsPopup]
      .some((p) => p && p.style.display === "block");
    if (!anyOpen && typeof document !== "undefined" && document.body) {
      document.body.style.overflow = "";
    }
  }, 300);
}
const overlayClickHandler = () => {
  [wishPopup, partyPopup, sharePopup, gamePopup, rizzPopup, musicPopup, aboutPopup, memoriesPopup, picsPopup].forEach(p => {
    if (p && p.style.display === "block") {
      p.classList.remove("show-popup");
      p.style.display = "none";
      if (p === rizzPopup) {
        stopHeartRain();
      }
    }
  });

  overlay.classList.remove("show");

  // Reset About popup properly
  aboutTypingTimeouts.forEach(timeout => clearTimeout(timeout));
  aboutTypingTimeouts = [];
  if (floatingInterval) clearInterval(floatingInterval);
  aboutText.innerHTML = "";
  aboutText.classList.add("typing-cursor");
  aboutPopup.classList.remove("blur-active");

  // Stop music popup audio if needed
  if (audioPlayer && isPlaying) {
    audioPlayer.pause();
    isPlaying = false;
    updateMusicUI();
  }
};
overlay.addEventListener("click", overlayClickHandler);

/* =========================
   CARD ACTIONS
========================= */
wishCard.onclick = () => openPopup(wishPopup);
musicCard.onclick = () => {
  stopIntroMusic();
  bgLoop.pause(); // Pause background loop when music player opens
  openPopup(musicPopup);
};
memoriesCard.onclick = () => openPopup(memoriesPopup);
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

function closeWish() { closePopup(wishPopup); }
function closeShare() { closePopup(sharePopup); }
function closeMemories() { closePopup(memoriesPopup); }
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
let targetDate = new Date("April 7, 2026 00:00:00").getTime();

function updateCountdown() {
  if (!countdownEl) {
    return;
  }

  let now = new Date().getTime();
  let gap = targetDate - now;

  if (gap <= 0) {
    countdownEl.innerHTML = "🎉 It's Today! 🎉";
    return;
  }

  let d = Math.floor(gap / (1000 * 60 * 60 * 24));
  let h = Math.floor((gap % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  let m = Math.floor((gap % (1000 * 60 * 60)) / (1000 * 60));
  let s = Math.floor((gap % (1000 * 60)) / 1000);

  countdownEl.innerHTML = `⏳ ${d} Days ${h}h ${m}m ${s}s left`;
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
  let text = "🎉 Check out this amazing birthday page! 🎂👇\n" + pageURL;
  let url = "https://wa.me/?text=" + encodeURIComponent(text);
  window.open(url, "_blank");
}

function copyLink() {
  navigator.clipboard.writeText(pageURL);
  document.getElementById("copyMsg").innerText = "✅ Link Copied!";
}

function nativeShare() {
  if (navigator.share) {
    navigator.share({
      title: "Birthday Celebration 🎉",
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
    userText = "🎂 Birthday?";
    reply = "7th April 🎉";
  } else if (type === "age") {
    userText = "🎈 Age?";
    reply = "A beautiful legend growing  😎";
  } else if (type === "hobby") {
    userText = "🎮 Hobbies?";
    reply = "Gaming, fun, vibes and making memories ✨";
  }

  chatBody.innerHTML += `<div class="user-msg">${userText}</div>`;

  let typingDiv = document.createElement("div");
  typingDiv.className = "typing";
  typingDiv.innerText = "🤖 Typing";
  chatBody.appendChild(typingDiv);

  chatBody.scrollTop = chatBody.scrollHeight;

  setTimeout(() => {
    typingDiv.remove();
    chatBody.innerHTML += `<div class="bot-msg">🤖 ${reply}</div>`;
    chatBody.scrollTop = chatBody.scrollHeight;
  }, 1200);
}

/* =========================
   CONFETTI
========================= */
function dropTopConfetti() {
  if (typeof confetti !== "function") {
    return;
  }

  confetti({
    particleCount: 12,
    angle: 90,
    spread: 28,
    startVelocity: 22,
    gravity: 1.15,
    ticks: 180,
    scalar: 0.72,
    origin: {
      x: 0.1 + Math.random() * 0.8,
      y: 0
    }
  });
}

function sideConfetti() {
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      confetti({
        particleCount: 250,
        angle: 60,
        spread: 90,
        origin: { x: 0 }
      });

      confetti({
        particleCount: 250,
        angle: 120,
        spread: 90,
        origin: { x: 1 }
      });
    }, i * 300);
  }

  if (confettiRainIntervalId) {
    clearInterval(confettiRainIntervalId);
  }

  dropTopConfetti();
  confettiRainIntervalId = setInterval(dropTopConfetti, 2200);
}

function stopHeartRain() {
  if (heartRainIntervalId) {
    clearInterval(heartRainIntervalId);
    heartRainIntervalId = undefined;
  }
}

function startHeartRain() {
  stopHeartRain();
  fireHeartBurst(8);
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
  if (!cardHeartLayer) {
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

  obj.innerText = isBomb ? "💣" : "🎂";
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
    leaderboardEl.innerHTML += `<li>🏅 ${i + 1}. ${s}</li>`;
  });
}

/* =========================
   RIZZ GENERATOR
========================= */
let generateRizzBtn = document.getElementById("generateRizzBtn");
let rizzOutput = document.getElementById("rizzOutput");
let heartBurstContainer = document.getElementById("heartBurstContainer");

const rizzLines = [
  "Are you my favorite song? Because I could listen to you forever. 💖",
  "You walked into my life and suddenly everything felt brighter. ✨",
  "If I had one wish, I’d spend every birthday with you. 🎂",
  "You’re the kind of person my heart would always choose. ❤️",
  "Are you WiFi? Because I’m feeling a strong connection. 📶😂",
  "Do you believe in love at first sight, or should I walk by again? 😏",
  "You must be a magician, because whenever I see you, everyone else disappears. 🎩",
  "You must be a keyboard, because you’re just my type. ⌨️😂",
  "Are you cheese? Because you make everything better. 🧀",
  "If beauty were time, you’d be eternity. ⏳",
  "You must be made of stars, because you light up everything. 🌟",
  "You stole my heart... should I call the police? 🚔❤️",
  "You look like trouble... and honestly, I like that. 😉",
  "If I flirt any harder, this page might catch fire. 🔥",
  "You’re dangerously cute, and I’m not complaining. 😌",
  "I was doing fine until you showed up looking like that. 😏",
  "Are you JavaScript? Because you make my heart asynchronous. 💻❤️",
  "You must be a function, because you complete my life. 🤓",
  "Are you CSS? Because you’ve styled my whole mood. 🎨",
  "You’re like clean code — rare and beautiful. ✨"
];

let lastRizzIndex = -1;

rizzCard.onclick = function () {
  openPopup(rizzPopup);
  startHeartRain();
};

function closeRizz() {
  closePopup(rizzPopup);
  stopHeartRain();
  setTimeout(() => {
    rizzOutput.innerHTML = "";
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
      <button id="copyRizzBtn" class="copy-btn" style="display:none;">📋 Copy</button>
    </div>
  `;

  typeWriterEffect(randomLine, document.getElementById("rizzText"), () => {
    document.getElementById("rizzText").classList.remove("typing-cursor");
    document.getElementById("copyRizzBtn").style.display = "inline-block";

    document.getElementById("copyRizzBtn").addEventListener("click", () => {
      const text = document.getElementById("rizzText").innerText;
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById("copyRizzBtn");
        btn.textContent = "✅ Copied!";
        setTimeout(() => btn.textContent = "📋 Copy", 2000);
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
  const hearts = ["💖", "💘", "💕", "❤️", "💞"];

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

  const hearts = ["💖", "💘", "💕", "❤️", "💞"];

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

/* =========================
   BG MUSIC SETTINGS LOGIC
========================= */
bgToggleLink.onclick = () => {
  if (bgLoop.paused) {
    bgLoop.play();
    bgToggleLink.innerText = "⏸ Pause";
  } else {
    bgLoop.pause();
    bgToggleLink.innerText = "▶ Play";
  }
};

bgVolumeSlider.oninput = (e) => {
  bgLoop.volume = e.target.value;
};

/* =========================*/
function closeMusic() {
  stopIntroMusic(); // force stop bgm too
  closePopup(musicPopup);

  if (audioPlayer && isPlaying) {
    audioPlayer.pause();
    isPlaying = false;
    updateMusicUI();
  }
}
/* =========================
   YOUTUBE MUSIC PLAYER
========================= */
const songs = [
  {
    title: "Song 1",
    url: "/1.mp3"
  },
  {
    title: "Song 2",
    url: "/2.mp3"
  },
  {
    title: "Song 3",
    url: "/3.mp3"
  },
  // {
  //   title: "Song 4",
  //   url: "4.mp3"
  // },
  // {
  //   title: "Song 5",
  //   url: "5.mp3"
  // }
];

let audioPlayer = new Audio();
audioPlayer.preload = "auto";
let currentSong = 0;
let isPlaying = false;

const songTitle = document.getElementById("songTitle");
const songStatus = document.getElementById("songStatus");
const playBtn = document.getElementById("playBtn");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");
const playlistCount = document.getElementById("playlistCount");

function updateMusicUI() {
  if (!songTitle || !songStatus || !playBtn || !playlistCount) return;
  songTitle.textContent = songs[currentSong].title;
  playlistCount.textContent = `${currentSong + 1} / ${songs.length}`;
  playBtn.textContent = isPlaying ? "⏸" : "▶";
  songStatus.textContent = isPlaying ? "Now Playing 🎶" : "Paused ⏸";
}

audioPlayer.onended = () => {
  nextSong();
};

function playSong() {
  if (bgm) {
    bgm.pause();
  }
  if (!audioPlayer.src) {
    audioPlayer.src = songs[currentSong].url;
    audioPlayer.load();
  }
  const playPromise = audioPlayer.play();
  if (playPromise?.catch) {
    playPromise.catch(() => {
      isPlaying = false;
      if (songStatus) {
        songStatus.textContent = "Tap play again";
      }
      updateMusicUI();
    });
  }
  isPlaying = true;
  updateMusicUI();
}

function pauseSong() {
  audioPlayer.pause();
  isPlaying = false;
  updateMusicUI();
}

function loadSong(index, autoplay = true) {
  currentSong = index;
  audioPlayer.src = songs[currentSong].url;
  audioPlayer.load();

  if (!autoplay) {
    audioPlayer.pause();
    isPlaying = false;
  } else {
    audioPlayer.currentTime = 0;
    const playPromise = audioPlayer.play();
    if (playPromise?.catch) {
      playPromise.catch(() => {
        isPlaying = false;
        if (songStatus) {
          songStatus.textContent = "Tap play again";
        }
        updateMusicUI();
      });
    }
    isPlaying = true;
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

updateMusicUI();

/* =========================
   ABOUT YOU POPUP
========================= */
const aboutPoints = [
  "• Dominant",
  "• Overthinker",
  "• Two Sisters",
  "• Love manga (BL also)",
  "• Loves to play OWO, Among Us",
  "• Don't like flirting",
  "• Dude not miss",
  "• Vibe Checking Secretly",
  "• Birthday on 7th April",
  "• Don't like Krishna's humor",
  "• Do sarcasm",
  "• Devil",
  "• Wants to learn editing",
  "• Went dance class 5 to 6",
  "• Likes non veg",
  "• Have two babies (Turtles)",
  "• Ailurophile (love cats)",
  "• Melophile (love music)",
  "• Preparing for CET",
  "• Don't wanna tell boards mark",
  "• Study in class 12th and exam is near",
  "• Marathi Mulgi",
  "• Ambivert",
  "• Nalli",
  "• Don't like changing People (Dogle log)",
  "• Height 5'5'' or 5'6''",
  "• Wanna try All water sports",
  "• Wheelie on Bike",
  "• Hangout with Friends (including me 😑)",
  "• Wanna do Go Karting",
  "• Bunji Jumping",
  "• Sky Diving",
  "• Wanna Travel alone",
  "• Want peace but also kick",
  "• Mood Swings (Typical Mahila)",
  "• Car Drifting",
  "• We meet online on 27th March 2026",
  "• Time = 11:26",
  "• Black, white, and gray are most fav. colours, followed by silver!"
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
        if (aboutContent) {
          aboutContent.scrollTop = aboutContent.scrollHeight;
        }
        let t = setTimeout(typeLetter, 30);
        aboutTypingTimeouts.push(t);
      } else {
        pointIndex++;
        if (aboutContent) {
          aboutContent.scrollTop = aboutContent.scrollHeight;
        }
        let t = setTimeout(typeNextPoint, 300);
        aboutTypingTimeouts.push(t);
      }
    }
    typeLetter();
  }

  let startT = setTimeout(typeNextPoint, 800);
  aboutTypingTimeouts.push(startT);
}

function startFloatingEffects() {
  if (floatingInterval) clearInterval(floatingInterval);
  const container = document.getElementById("aboutImageWrap");
  if (!container) return;
  floatingInterval = setInterval(() => {
    const symbols = ["💖", "✨", "🌸", "⭐", "💘"];
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
  <p>💖 Made for Someone Special ✨</p>
  <span>------------</span>
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

return () => {
  overlay.removeEventListener("click", overlayClickHandler);
  window.removeEventListener("birthday:home-visible", handleHomeVisible);
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
  if (bgLoop) bgLoop.pause();
  stopIntroMusic();
};
}

