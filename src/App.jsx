﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import { useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabase';
import { initBirthdaySite } from './site';
import AdminDashboard from './AdminDashboard';
import ThankYouStudio from './ThankYouStudio';
import IntroBirthdayCake from './IntroBirthdayCake';

if (typeof window !== 'undefined') {
  window.__reactChatWidgetEnabled = true;
}

const heroLines = ['Happy Birthday', 'MJ'];
const adminEmail = import.meta.env.VITE_ADMIN_EMAIL?.trim().toLowerCase() || '';
const authRedirectUrlFromEnv = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim() || '';
const AUTH_COOLDOWN_MS = 60 * 1000;
const LAST_SIGNED_IN_EMAIL_KEY = 'harshi-7-last-signed-in-email';
const THEME_STORAGE_KEY = 'harshi-7-theme';
const CLASSIC_THEME = 'classic';
const PRIVATE_IMAGES_BUCKET = 'private_images';
const PRIVATE_IMAGE_EXTENSIONS = /\.(avif|gif|jpe?g|png|webp)$/i;
const PIC_SLIDE_DIRECTIONS = ['left', 'right', 'up', 'down'];

const getRandomPicSlideDirection = () =>
  PIC_SLIDE_DIRECTIONS[Math.floor(Math.random() * PIC_SLIDE_DIRECTIONS.length)];

const isAboutPrivateImage = (path = '') => {
  const fileName = path.split('/').pop() || '';
  return /^sam_pic(?:\.[^.]+)?$/i.test(fileName);
};

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

function PrivatePicCanvas({ pic, direction, label }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!pic?.url) {
      return () => {};
    }

    const canvas = canvasRef.current;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    let ignore = false;

    const drawImage = () => {
      if (ignore || !canvas || !image.naturalWidth || !image.naturalHeight) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }

      context.clearRect(0, 0, width, height);
      context.fillStyle = 'rgba(8, 8, 10, 0.92)';
      context.fillRect(0, 0, width, height);

      const imageScale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
      const drawWidth = image.naturalWidth * imageScale;
      const drawHeight = image.naturalHeight * imageScale;
      const drawX = (width - drawWidth) / 2;
      const drawY = (height - drawHeight) / 2;

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    };

    image.onload = drawImage;
    image.src = pic.url;

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(drawImage)
      : null;
    observer?.observe(canvas);
    window.addEventListener('resize', drawImage);

    return () => {
      ignore = true;
      observer?.disconnect();
      window.removeEventListener('resize', drawImage);
    };
  }, [pic?.url]);

  useEffect(() => {
    const preventPrivateImageCapture = (event) => {
      event.preventDefault();
    };

    const handleKeyDown = (event) => {
      if (event.key === 'PrintScreen') {
        event.preventDefault();
      }
    };

    const canvas = canvasRef.current;
    canvas?.addEventListener('contextmenu', preventPrivateImageCapture);
    canvas?.addEventListener('dragstart', preventPrivateImageCapture);
    canvas?.addEventListener('selectstart', preventPrivateImageCapture);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      canvas?.removeEventListener('contextmenu', preventPrivateImageCapture);
      canvas?.removeEventListener('dragstart', preventPrivateImageCapture);
      canvas?.removeEventListener('selectstart', preventPrivateImageCapture);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`pics-main-img pics-main-img--${direction}`}
      aria-label={label}
      role="img"
      onContextMenu={(event) => event.preventDefault()}
    />
  );
}

const lockBodyScroll = () => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.add('is-scroll-locked');
  document.body.classList.add('is-scroll-locked');
};

const unlockBodyScroll = () => {
  if (typeof document === 'undefined') return;
  const hasOpenLegacyPopup = Array.from(document.querySelectorAll('.popup-box')).some(
    (popup) => popup.style.display === 'block'
  );
  const hasOpenReactPopup = document.querySelector(
    '#chatbot.is-open, .thank-you-modal.is-open, .sign-out-modal, .fullscreen-video-modal'
  );

  if (!hasOpenLegacyPopup && !hasOpenReactPopup) {
    document.documentElement.classList.remove('is-scroll-locked');
    document.body.classList.remove('is-scroll-locked');
    document.body.style.overflow = '';
  }
};

const getAuthRedirectUrl = () => {
  if (typeof window === 'undefined') {
    return authRedirectUrlFromEnv;
  }

  if (!authRedirectUrlFromEnv) {
    return window.location.origin;
  }

  const isLocalConfigured = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(authRedirectUrlFromEnv);
  const isProductionHost = !/localhost|127\.0\.0\.1/i.test(window.location.hostname);

  return isProductionHost && isLocalConfigured ? window.location.origin : authRedirectUrlFromEnv;
};

const getCooldownKey = (value) => `auth-cooldown:${value.trim().toLowerCase()}`;

const readCooldownUntil = (value) => {
  if (typeof window === 'undefined' || !value.trim()) {
    return 0;
  }

  const stored = window.localStorage.getItem(getCooldownKey(value));
  const parsed = Number(stored);
  return Number.isFinite(parsed) ? parsed : 0;
};

const writeCooldownUntil = (value, until) => {
  if (typeof window === 'undefined' || !value.trim()) {
    return;
  }

  window.localStorage.setItem(getCooldownKey(value), String(until));
};

const formatWaitTime = (ms) => {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${String(remainingSeconds).padStart(2, '0')}s`;
};

const cards = [
  { id: 'wishCard', title: 'Wishes', text: 'Some wishes for you', icon: '\u{1F4CC}' },
  { id: 'musicCard', title: 'Music Player', text: 'Play your birthday playlist', icon: '\u{1F3B5}' },
  { id: 'aboutCard', title: 'About You', text: 'Little things that make you, you', icon: '\u{1FAF6}' },
  { id: 'memoriesCard', title: 'Our Memories', text: 'Little moments we keep forever', icon: '\u{1F5A4}' },
  { id: 'picsCard', title: 'Your Pics', text: 'A tiny photo corner for you', icon: '\u{1F5BC}\u{FE0F}' },
  { id: 'rizzCard', title: 'Rizz for You', text: 'Smooth lines only', icon: '\u{1F60F}' }
];

const memoryData = [
  {
    title: "First Birthday Wish 😉",
    description: "Voice note",
    type: "audio",
    src: "Happy Birthday Wish(MJ)-enhanced-v2.wav"
  },
  {
    title: "First Propose ❤️🩶",
    description: "You proposed a boy studying in class 12th",
    dateTime: "30th April 2026 @2:51",
    type: "video",
    src: "propose_vid.mp4" 
  },
  {
    title: "First Voice Note 🫠",
    description: "Voice note of saying 3 magic words",
    dateTime: "9th May 2026 @22:56",
    type: "audio",
    src: "Iloveyou_sam.ogg"
  },
  {
    title: "First Face Pic 😍",
    description: "Show beautiful face 👀",
    dateTime: "25th April 2026 @10:28",
    type: "video",
    src: "face_reveal.mp4" 
  }
];

const flowerAsset = '/mj_pic2.png';
const heroBackgroundVideo = '/bg_video.mp4';
const birthdayMonthIndex = 4;
const birthdayDay = 29;
const chatQuickActions = [
  { label: '✨ Who is MJ?', query: 'who is MJ' },
  { label: '🎁 Surprise clue', query: 'What should I open first?' },
  { label: '🎂 Birthday date', query: 'birthday date' },
  { label: '👀 Made by?', query: 'who made this site' },
  { label: '🖤 Memories', query: 'memories' },
  { label: '🎵 Playlist', query: 'music' },
  { label: '🫶 About you', query: 'about you' },
  { label: '😏 Rizz', query: 'give me rizz' },
];

const cardFloatStyles = [
  { x: '14px', y: '18px', duration: '6.2s', delay: '0s' },
  { x: '-16px', y: '20px', duration: '6.8s', delay: '0.35s' },
  { x: '13px', y: '16px', duration: '5.9s', delay: '0.18s' },
  { x: '-15px', y: '19px', duration: '6.5s', delay: '0.5s' },
  { x: '12px', y: '15px', duration: '6.1s', delay: '0.12s' },
  { x: '-14px', y: '18px', duration: '6.7s', delay: '0.42s' }
];

const birthdayFinaleSparkles = [
  { symbol: '✦', top: '10%', left: '8%', size: '0.75rem', duration: '6.2s', delay: '0s' },
  { symbol: '•', top: '22%', left: '18%', size: '0.45rem', duration: '5.2s', delay: '0.4s' },
  { symbol: '✧', top: '16%', left: '36%', size: '0.7rem', duration: '6.8s', delay: '0.15s' },
  { symbol: '✨', top: '26%', left: '72%', size: '0.9rem', duration: '6s', delay: '0.6s' },
  { symbol: '✦', top: '12%', left: '88%', size: '0.72rem', duration: '5.7s', delay: '0.25s' },
  { symbol: '•', top: '66%', left: '14%', size: '0.4rem', duration: '5.4s', delay: '0.7s' },
  { symbol: '✧', top: '72%', left: '82%', size: '0.72rem', duration: '6.4s', delay: '0.5s' },
  { symbol: '✨', top: '82%', left: '52%', size: '0.82rem', duration: '6.6s', delay: '0.2s' }
];

const getNextBirthdayTarget = (referenceTime = Date.now()) => {
  const now = new Date(referenceTime);
  let target = new Date(now.getFullYear(), birthdayMonthIndex, birthdayDay, 0, 0, 0, 0);
  const isBirthdayToday =
    now.getMonth() === birthdayMonthIndex &&
    now.getDate() === birthdayDay;

  if (!isBirthdayToday && referenceTime >= target.getTime()) {
    target = new Date(now.getFullYear() + 1, birthdayMonthIndex, birthdayDay, 0, 0, 0, 0);
  }

  return target;
};

const formatBirthdayCountdown = (referenceTime = Date.now()) => {
  const target = getNextBirthdayTarget(referenceTime);
  const remaining = Math.max(0, target.getTime() - referenceTime);
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const dayLabel = days === 1 ? 'DAY' : 'DAYS';

  return {
    value: remaining === 0
      ? 'Its today ...'
      : days > 0
        ? `${days} ${dayLabel} LEFT`
        : `${hours} HOUR${hours === 1 ? '' : 'S'} LEFT`,
    detail: remaining === 0
      ? 'TIME TO CELEBRATE'
      : `${String(hours).padStart(2, '0')}H ${String(minutes).padStart(2, '0')}M ${String(seconds).padStart(2, '0')}S`,
  };
};

function BirthdayCountdown({ now }) {
  const countdown = formatBirthdayCountdown(now);
  const detailId = 'birthday-countdown-detail';

  return (
    <div
      className="hero-chip birthday-hero__chip birthday-hero__chip--countdown"
      aria-label={`Birthday ${countdown.value}${countdown.detail ? `, ${countdown.detail}` : ''}`}
      aria-describedby={detailId}
    >
      <span className="birthday-hero__chip-value">{countdown.value}</span>
      <span className="birthday-hero__chip-detail" id={detailId}>
        {countdown.detail}
      </span>
    </div>
  );
}

function AnimatedTitle({ ready, tone = 'light' }) {
  return (
    <div className={`hero-title-wrap hero-title-wrap--${tone} ${ready ? 'is-ready' : ''}`}>
      {heroLines.map((line, lineIndex) => (
        <div className="hero-line" key={line}>
          {Array.from(line).map((char, charIndex) => {
            const isSpace = char === ' ';
            const direction = (lineIndex + charIndex) % 2 === 0 ? 'up' : 'down';

            return (
              <span
                className={`hero-letter hero-letter--${direction} ${isSpace ? 'is-space' : ''}`}
                key={`${lineIndex}-${charIndex}-${char}`}
                style={{ '--delay': `${lineIndex * 460 + charIndex * 140}ms` }}
              >
                {isSpace ? '\u00A0' : char}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const getChatReply = (message) => {
  const normalized = message.trim().toLowerCase();

  if (!normalized) {
    return 'Try asking about the birthday or the hidden surprise. 💬';
  }

  if (/(birthday|date|when)/.test(normalized)) {
    return '29th May is the day we are celebrating here. 🎉';
  }

  if (/(age|old|years?)/.test(normalized)) {
    return 'A beautiful legend in the making. 😌\nStill collecting iconic moments, obviously.';
  }

  if (/(hobby|hobbies|like|love|interest)/.test(normalized)) {
    return 'Gaming, good vibes, and making memories. ✨';
  }

  if (/(gift|surprise|present|gift box)/.test(normalized)) {
    return 'Open the cards around the page. The surprise is hiding in plain sight. 🎁';
  }

  if (/(who is|who's|about|tell me about).*\b(samruddhi|sam|mj)\b|\b(samruddhi|sam|mj)\b.*(who is|who's|about)/.test(normalized)) {
    return 'Samruddhi, Sam, and MJ are the same special person here. 💖\nHer full name is Samruddhi Ghanshyam Burde, and MJ is the sweet nickname this birthday page celebrates.';
  }

  if (/(name|who are you|who is this|for)/.test(normalized)) {
    return 'This page is a little birthday love note for MJ. 💖\nMade to feel personal, playful, and a tiny bit extra.';
  }

  if (/(who made this site|who made this|made this site|who created this site|created this site|owner|creator|mader|maker|how to made|how it made|how was this made|how is this made)/.test(normalized)) {
    return 'Your loved one made this site. 💖';
  }

  if (/(thank you|thanks|thank u|thx)/.test(normalized)) {
    return 'Always, cutie. 💖\nAsk me anything else about the birthday page.';
  }

  if (/(memories|memory|moments|reminisc|nostalg)/.test(normalized)) {
    return 'Open Memories if you want the softest part of the page. 🖤';
  }

  if (/(music|song|playlist|track|play)/.test(normalized)) {
    return 'The Music Player card is where the vibes live. 🎵';
  }

  if (/(about you|about|facts|cute facts)/.test(normalized)) {
    return 'Little thing that i know about you!! 🫶';
  }

  if (/(rizz|smooth|line|flirt)/.test(normalized)) {
    return 'Some pickup lines for you';
  }

  if (/(what should i open first|where should i start|start|first)/.test(normalized)) {
    return 'Start with Wishes, then About You, then Memories. 🎀';
  }

  if (/(hello|hi|hey|sup)/.test(normalized)) {
    return 'Hi hi! Birthday guide online. 💬';
  }

  return 'I’m mostly here for birthday details and the little surprises around the page. 😉';
};

const initialChatMessages = [
  { role: 'assistant', text: 'Hi! 👋 I’m your birthday guide.\nType a question or tap one of the buttons below.' },
];

function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState(initialChatMessages);
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);

  useEffect(() => {
    const handlePopState = () => {
      if (open) setOpen(false);
    };
    window.addEventListener('popstate', handlePopState);

    if (!open) {
      unlockBodyScroll();
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }

    lockBodyScroll();
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
    return () => {
      unlockBodyScroll();
      window.removeEventListener('popstate', handlePopState);
    };
  }, [open, messages, isTyping]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
      }
    };
  }, []);

  const sendMessage = (rawText) => {
    const text = rawText.trim();
    if (!text || isTyping) {
      return;
    }

    setMessages((current) => [...current, { role: 'user', text }]);
    setDraft('');
    setIsTyping(true);

    typingTimerRef.current = window.setTimeout(() => {
      setMessages((current) => [...current, { role: 'assistant', text: getChatReply(text) }]);
      setIsTyping(false);
      typingTimerRef.current = undefined;
    }, 650);
  };

  const handleToggleChat = () => {
    if (!open) {
      window.history.pushState({ popupOpen: true, type: 'chat' }, '');
      setOpen(true);
    } else {
      if (window.history.state?.popupOpen) window.history.back();
      setOpen(false);
    }
  };

  const resetChat = () => {
    setMessages(initialChatMessages);
    setDraft('');
    setIsTyping(false);
  };

  return (
    <>
      <button
        id="chatToggle"
        className={open ? 'is-open' : ''}
        type="button"
        aria-expanded={open}
        aria-controls="chatbot"
        aria-label={open ? 'Close chat' : 'Open chat'}
        onClick={handleToggleChat}
      >
        <span className="chat-toggle__icon" aria-hidden="true">
          {open ? <i className="fa-solid fa-xmark"></i> : '💬'}
        </span>
        {!open ? <span className="chat-toggle__pulse" aria-hidden="true" /> : null}
      </button>

      <section
        id="chatbot"
        className={open ? 'is-open' : ''}
        aria-hidden={!open}
      >
        <div id="chatHeader">
          <div className="chat-header__copy">
            <span className="chat-header__eyebrow">Birthday guide</span>
            <strong>Ask About Me</strong>
          </div>
          <button className="chat-header__reset" type="button" onClick={resetChat} aria-label="Reset chat">
            Reset
          </button>
        </div>

        <div id="chatBody">
          <div className="chat-log" role="log" aria-live="polite" aria-relevant="additions text">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}-${message.text}`} className={`chat-msg-row chat-msg-row--${message.role}`}>
                <span className="chat-avatar" aria-hidden="true">
                  {message.role === 'assistant' ? 'AI' : 'You'}
                </span>
                <div className={`chat-msg chat-msg--${message.role}`}>
                  {message.text}
                </div>
              </div>
            ))}
            {isTyping ? (
              <div className="chat-msg-row chat-msg-row--assistant">
                <span className="chat-avatar" aria-hidden="true">
                  AI
                </span>
                <div className="chat-msg chat-msg--assistant typing">Typing</div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

        </div>

        <div className="quick-btns" aria-label="Suggested questions">
          {chatQuickActions.map((action) => (
            <button key={action.query} type="button" onClick={() => sendMessage(action.query)}>
              {action.label}
            </button>
          ))}
        </div>

        <form
          className="chat-composer"
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage(draft);
          }}
        >
          <input
            className="chat-input"
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask a question..."
            aria-label="Type a message"
          />
          <button className="chat-send" type="submit" disabled={!draft.trim() || isTyping}>
            Send
          </button>
        </form>
      </section>
    </>
  );
}

function AuthScreen({
  email,
  setEmail,
  onSendLink,
  sending,
  status,
  error,
  configured,
  cooldownRemaining,
}) {
  return (
    <div className="auth-shell">
      <video className="auth-video" src={heroBackgroundVideo} autoPlay muted loop playsInline aria-hidden="true" />
      <div className="auth-noise" aria-hidden="true" />
      <div className="auth-ribbon auth-ribbon--one" aria-hidden="true" />
      <div className="auth-ribbon auth-ribbon--two" aria-hidden="true" />
      <div className="auth-sparkles" aria-hidden="true">
        {birthdayFinaleSparkles.slice(0, 6).map((sparkle, index) => (
          <span
            key={`${sparkle.symbol}-${index}`}
            style={{
              '--top': sparkle.top,
              '--left': sparkle.left,
              '--delay': sparkle.delay,
              '--duration': sparkle.duration,
            }}
          >
            {sparkle.symbol}
          </span>
        ))}
      </div>

      <main className="auth-card" aria-labelledby="authTitle">
        <div className="auth-media" aria-hidden="true">
          {/* <img src={flowerAsset} alt="" /> */}
          <span className="auth-media__glow" />
        </div>

        <div className="auth-badge">
          <i className="fa-solid fa-lock" aria-hidden="true"></i>
          Private birthday entry
        </div>
        
        <header className="auth-header">
          <p className="auth-kicker">For MJ only</p>
          <h1 id="authTitle">
            <span>Welcome,</span>
            <span>MJ</span>
          </h1>
          <p>A little birthday world is waiting behind this door.</p>
        </header>

        {!configured && (
          <div className="auth-status auth-status--error">
            <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
            Sign-in is offline right now.
          </div>
        )}

        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSendLink();
          }}
        >
          <div className="auth-field">
            <label className="auth-label" htmlFor="email">Email address</label>
            <div className="auth-input-wrap">
              <i className="fa-solid fa-envelope" aria-hidden="true"></i>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                disabled={sending || cooldownRemaining > 0 || !configured}
                required
              />
            </div>
          </div>

          <button 
            className="auth-button" 
            type="submit" 
            disabled={sending || cooldownRemaining > 0 || !configured}
          >
            {sending ? (
              <><i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Sending link</>
            ) : cooldownRemaining > 0 ? (
              <><i className="fa-solid fa-hourglass-half" aria-hidden="true"></i> Wait {formatWaitTime(cooldownRemaining)}</>
            ) : (
              <>Send birthday link <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i></>
            )}
          </button>
        </form>

        {status && (
          <div className="auth-status auth-status--success">
            <i className="fa-solid fa-paper-plane" aria-hidden="true"></i>
            {status}
          </div>
        )}
        
        {error && (
          <div className="auth-status auth-status--error">
            <i className="fa-solid fa-circle-xmark" aria-hidden="true"></i>
            {error}
          </div>
        )}

        <div className="auth-footer">
          <p>No password. Just one private link.</p>
          <div className="auth-footer__ornament">
            <span></span>
            <i className="fa-solid fa-heart" aria-hidden="true"></i>
            <span></span>
          </div>
        </div>
      </main>
    </div>
  );
}

function MemoryVoicePlayer({ src, onPlay, onPause, onEnded }) {
  const audioRef = useRef(null);
  const wasPlayingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);

  useEffect(() => {
    let active = true;

    const getSecureUrl = async () => {
      if (!src) return;
      try {
        let finalUrl;
        if (!src.startsWith('http') && !src.startsWith('/')) {
          const { data, error } = await supabase.storage.from('private_vid').createSignedUrl(src, 3600);
          if (error) throw error;
          finalUrl = data.signedUrl;
        } else {
          finalUrl = src;
        }

        if (active) {
          setAudioUrl(finalUrl);
        }
      } catch (err) {
        console.error("Audio loading failed", err);
      }
    };
    getSecureUrl();

    return () => {
      active = false;
      const audio = audioRef.current;
      const wasPlaying = wasPlayingRef.current || Boolean(audio && !audio.paused);
      if (audio && !audio.paused) {
        audio.pause();
      }
      if (wasPlaying) {
        window.dispatchEvent(new CustomEvent('birthday:recording-audio-resume'));
      }
    };
  }, [src]);

  const formatTime = (time) => {
    const mins = Math.floor(time / 60) || 0;
    const secs = Math.floor(time % 60) || 0;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    if (audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  };

  return (
    <div className="memory-voice-player">
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onPlay={() => { wasPlayingRef.current = true; setIsPlaying(true); onPlay(); }}
        onPause={() => { wasPlayingRef.current = false; setIsPlaying(false); onPause(); }}
        onEnded={() => { wasPlayingRef.current = false; setIsPlaying(false); onEnded(); }}
        onTimeUpdate={() => setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => setDuration(audioRef.current.duration)}
      />
      <button 
        type="button" 
        className="memory-voice-btn" 
        onClick={togglePlay}
      >
        {isPlaying ? <i className="fa-solid fa-pause"></i> : <i className="fa-solid fa-play"></i>}
      </button>
      <div className="memory-voice-info">
        <input 
          type="range" 
          className="memory-voice-slider"
          min="0" 
          max={duration || 0} 
          step="0.01"
          value={currentTime} 
          onChange={(e) => audioRef.current.currentTime = Number(e.target.value)}
          style={{ '--progress': `${progress}%` }}
        />
        <div className="memory-voice-time">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

function MemoryVideoPlayer({ src, onPlay, onPause, onEnded }) {
  const videoRef = useRef(null);
  const wasPlayingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);

    const getSecureUrl = async () => {
      if (!src) { setLoading(false); return; }
      try {
        let finalUrl;
        if (!src.startsWith('http') && !src.startsWith('/')) {
          const { data, error } = await supabase.storage.from('private_vid').createSignedUrl(src, 3600);
          if (error) throw error;
          finalUrl = data.signedUrl;
        } else {
          finalUrl = src;
        }

        if (active) {
          setVideoUrl(finalUrl);
          // We keep loading true until the video actually can play
        }
      } catch (err) {
        console.error("Video loading failed", err);
        if (active) {
          setLoadError(true);
          setLoading(false);
        }
      }
    };
    getSecureUrl();
    return () => {
      active = false;
      const video = videoRef.current;
      const wasPlaying = wasPlayingRef.current || Boolean(video && !video.paused);
      if (video && !video.paused) {
        video.pause();
      }
      if (wasPlaying) {
        window.dispatchEvent(new CustomEvent('birthday:recording-audio-resume'));
      }
    };
  }, [src]);

  useEffect(() => {
    const closeMenu = () => setMenuOpen(false);
    if (menuOpen) {
      window.addEventListener('click', closeMenu);
    }
    return () => window.removeEventListener('click', closeMenu);
  }, [menuOpen]);

  const handleDownload = (e) => {
    e.stopPropagation();
    if (!videoUrl) return;
    window.open(videoUrl, '_blank');
    setMenuOpen(false);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(e => console.warn("Video playback blocked:", e));
    } else {
      videoRef.current.pause();
    }
  };

  const formatVideoTime = (time) => {
    const mins = Math.floor(time / 60) || 0;
    const secs = Math.floor(time % 60) || 0;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVideoSeek = (event) => {
    if (!videoRef.current) return;
    const nextTime = Number(event.target.value);
    videoRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const showLoader = (loading || isBuffering) && !loadError;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`memory-video-custom ${isPlaying ? 'is-playing' : ''}`}>
      {showLoader && (
        <div className="video-loader">
          <i className="fa-solid fa-circle-notch fa-spin"></i>
          <span>{loading ? "Wait MJ" : "Buffering..."}</span>
        </div>
      )}

      {loadError && (
        <div className="video-loader video-loader--error">
          <div className="video-loader__content">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span>Video Unavailable</span>
          </div>
        </div>
      )}

      {videoUrl && (
        <>
          <video
            ref={videoRef}
            src={videoUrl}
            playsInline
            autoPlay
            preload="auto"
            muted={false}
            onCanPlay={() => { setLoading(false); }}
            onWaiting={() => setIsBuffering(true)}
            onPlaying={() => { setIsBuffering(false); setLoading(false); setIsPlaying(true); }}
            onPlay={() => { wasPlayingRef.current = true; setIsPlaying(true); onPlay(); }}
            onPause={() => { wasPlayingRef.current = false; setIsPlaying(false); onPause(); }}
            onEnded={() => { wasPlayingRef.current = false; setIsPlaying(false); onEnded(); }}
            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
            onLoadedMetadata={() => {
              const video = videoRef.current;
              setDuration(video?.duration || 0);
            }}
            className={`memory-video-element ${showLoader ? 'is-loading' : ''} is-visible`}
            onClick={togglePlay}
            onContextMenu={(e) => e.preventDefault()}
          />
          
          <div className={`video-custom-controls ${showLoader ? 'is-hidden' : ''}`}>
            <div className="video-time-ribbon">
              <span>{formatVideoTime(currentTime)}</span>
              <input
                type="range"
                className="video-memory-timeline"
                min="0"
                max={duration || 0}
                step="0.01"
                value={currentTime}
                onChange={handleVideoSeek}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                aria-label="Memory video timeline"
                style={{ '--video-progress': `${progress}%` }}
              />
              <span>{formatVideoTime(duration)}</span>
            </div>

            <div className="video-control-row">
              <button type="button" className="video-play-pause-btn" onClick={togglePlay}>
                {isPlaying ? <i className="fa-solid fa-pause"></i> : <i className="fa-solid fa-play"></i>}
              </button>
              
              <div className="video-controls-right">
                <div 
                  className={`video-more-btn ${menuOpen ? 'is-active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(!menuOpen);
                  }}
                >
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                {menuOpen && (
                  <div className="video-dropdown-menu">
                    <button type="button" onClick={handleDownload}>
                      <i className="fa-solid fa-download"></i> Download
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Overlay gradient to make controls pop */}
          <div className="video-overlay-shimmer" />
        </>
      )}
    </div>
  );
}

function BirthdayExperience({
  onSignOut,
  onOpenAdminPage,
  userEmail,
  isAdmin,
  sessionMessage,
}) {
  const [heroReady, setHeroReady] = useState(false);
  const [cardsVisible, setCardsVisible] = useState(false);
  const [thankYouOpen, setThankYouOpen] = useState(false);
  const [notInterestedShift, setNotInterestedShift] = useState({ x: 0, y: 0 });
  const [adminDockOpen, setAdminDockOpen] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [introCakeKey, setIntroCakeKey] = useState(0);
  const [privatePics, setPrivatePics] = useState([]);
  const [fullscreenVid, setFullscreenVid] = useState(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState(null);
  const [memoryIndex, setMemoryIndex] = useState(0);
  const [privatePicsIndex, setPrivatePicsIndex] = useState(0);
  const [privatePicsDirection, setPrivatePicsDirection] = useState('right');
  const [privatePicsPrevious, setPrivatePicsPrevious] = useState(null);
  const [privatePicsLoading, setPrivatePicsLoading] = useState(true);
  const [privatePicsError, setPrivatePicsError] = useState('');
  const cardsTimer = useRef(null);

  const touchStartX = useRef(0);

  const handleTouchStart = (e) => {
    // Ignore swipes starting on the volume/progress sliders
    if (e.target.tagName === 'INPUT') {
      touchStartX.current = 0;
      return;
    }
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === 0) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const swipeThreshold = 50;
    const diff = touchStartX.current - touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0 && memoryIndex < memoryData.length - 1) {
        // Swiped Left -> Next
        if (activeMediaIndex !== null) {
          window.dispatchEvent(new CustomEvent('birthday:recording-audio-resume'));
        }
        setMemoryIndex(v => v + 1);
        setActiveMediaIndex(null);
      } else if (diff < 0 && memoryIndex > 0) {
        // Swiped Right -> Previous
        if (activeMediaIndex !== null) {
          window.dispatchEvent(new CustomEvent('birthday:recording-audio-resume'));
        }
        setMemoryIndex(v => v - 1);
        setActiveMediaIndex(null);
      }
    }
    touchStartX.current = 0;
  };

  const cleanupRef = useRef(null);
  const thankYouRevealRef = useRef(null);
  const [thankYouFabVisible, setThankYouFabVisible] = useState(false);
  const aboutPrivateImage = privatePics.find((pic) => isAboutPrivateImage(pic.path));
  const aboutBackgroundImage = aboutPrivateImage?.url || '/sam_pic.jpeg';

  const closeMemoriesAndReset = () => {
    window.closeMemories?.();
    setMemoryIndex(0);
    if (activeMediaIndex !== null) {
      window.dispatchEvent(new CustomEvent('birthday:recording-audio-resume'));
    }
    setActiveMediaIndex(null);
  };

  const openThankYouStudio = () => {
    setThankYouOpen(true);
    window.history.pushState({ popupOpen: true, type: 'thank-you' }, '');
  };

  const closeFullscreenVideo = (event) => {
    event?.stopPropagation();
    window.dispatchEvent(new CustomEvent('birthday:recording-audio-resume'));

    if (window.history.state?.type === 'fullscreen-video') {
      window.history.back();
      return;
    }

    setFullscreenVid(null);
  };

  useEffect(() => {
    const handlePopState = () => {
      if (thankYouOpen) setThankYouOpen(false);
      if (fullscreenVid) setFullscreenVid(null);
    };
    window.addEventListener('popstate', handlePopState);

    if (thankYouOpen || !!fullscreenVid) {
      lockBodyScroll();
    } else {
      unlockBodyScroll();
    }

    return () => {
      unlockBodyScroll();
      window.removeEventListener('popstate', handlePopState);
    };
  }, [thankYouOpen, fullscreenVid]);

  const moveNotInterestedButton = (event) => {
    const touchPoint = event.touches?.[0] || event.changedTouches?.[0];
    const clientX = touchPoint?.clientX ?? event.clientX;
    const clientY = touchPoint?.clientY ?? event.clientY;
    const buttonRect = event.currentTarget.getBoundingClientRect();
    const centerX = buttonRect.left + buttonRect.width / 2;
    const centerY = buttonRect.top + buttonRect.height / 2;
    const cursorLeftOfButton = clientX < centerX;
    const cursorAboveButton = clientY < centerY;

    setNotInterestedShift({
      x: cursorLeftOfButton ? 120 : -120,
      y: cursorAboveButton ? 42 : -42,
    });
  };

  const resetNotInterestedButton = () => {
    setNotInterestedShift({ x: 0, y: 0 });
  };

  const playNotInterestedSound = () => {
    if (typeof Audio === 'undefined') {
      return;
    }

    const sound = new Audio('/Faah.mpeg');
    sound.volume = 1;
    sound.play().catch(() => {});
  };

  useEffect(() => {
    const readyTimer = window.setTimeout(() => setHeroReady(true), 120);
    cleanupRef.current = initBirthdaySite();

    const handleHomeVisible = () => {
      if (cardsTimer.current) {
        clearTimeout(cardsTimer.current);
      }

      cardsTimer.current = window.setTimeout(() => {
        setCardsVisible(true);
      }, 900);
    };

    const handleIntroStart = () => {
      setIntroCakeKey((key) => key + 1);
    };

    window.addEventListener('birthday:intro-start', handleIntroStart);
    window.addEventListener('birthday:home-visible', handleHomeVisible);

    return () => {
      window.clearTimeout(readyTimer);
      window.removeEventListener('birthday:intro-start', handleIntroStart);
      window.removeEventListener('birthday:home-visible', handleHomeVisible);
      if (cardsTimer.current) {
        clearTimeout(cardsTimer.current);
      }
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadPrivatePics = async () => {
      if (!supabase) {
        setPrivatePicsLoading(false);
        setPrivatePicsError('Private gallery is offline right now.');
        return;
      }

      setPrivatePicsLoading(true);
      setPrivatePicsError('');

      const listImagePaths = async (folder = '') => {
        const { data: files, error: listError } = await supabase.storage
          .from(PRIVATE_IMAGES_BUCKET)
          .list(folder, {
            limit: 100,
            sortBy: { column: 'name', order: 'asc' },
          });

        if (listError) {
          throw listError;
        }

        const paths = [];

        for (const file of files || []) {
          const path = folder ? `${folder}/${file.name}` : file.name;

          if (PRIVATE_IMAGE_EXTENSIONS.test(file.name)) {
            paths.push(path);
          } else if (!file.name.includes('.')) {
            const nestedPaths = await listImagePaths(path);
            paths.push(...nestedPaths);
          }
        }

        return paths;
      };

      let imagePaths = [];

      try {
        imagePaths = await listImagePaths();
      } catch (listError) {
        if (ignore) return;
        setPrivatePics([]);
        setPrivatePicsError('Could not load private images right now.');
        setPrivatePicsLoading(false);
        return;
      }

      if (ignore) return;

      if (!imagePaths.length) {
        setPrivatePics([]);
        setPrivatePicsError('No images found in private_images.');
        setPrivatePicsLoading(false);
        return;
      }

      const { data: signedFiles, error: signedError } = await supabase.storage
        .from(PRIVATE_IMAGES_BUCKET)
        .createSignedUrls(imagePaths, 3600);

      if (ignore) return;

      if (signedError) {
        setPrivatePics([]);
        setPrivatePicsError('Could not open private images right now.');
        setPrivatePicsLoading(false);
        return;
      }

      const nextPics = (signedFiles || [])
        .map((item, index) => {
          if (!item.signedUrl) return null;
          return {
            path: imagePaths[index],
            url: item.signedUrl,
          };
        })
        .filter(Boolean);

      if (ignore) return;

      setPrivatePics(nextPics);
      setPrivatePicsIndex(0);
      setPrivatePicsLoading(false);
    };

    loadPrivatePics();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (privatePics.length < 2) {
      return () => {};
    }

    const timer = window.setInterval(() => {
      const nextDirection = getRandomPicSlideDirection();
      setPrivatePicsDirection(nextDirection);
      setPrivatePicsIndex((index) => {
        setPrivatePicsPrevious({
          direction: nextDirection,
          index,
          pic: privatePics[index],
        });
        return (index + 1) % privatePics.length;
      });
    }, 3600);

    return () => window.clearInterval(timer);
  }, [privatePics]);

  useEffect(() => {
    if (!privatePicsPrevious) {
      return () => {};
    }

    const timer = window.setTimeout(() => {
      setPrivatePicsPrevious(null);
    }, 950);

    return () => window.clearTimeout(timer);
  }, [privatePicsPrevious]);

  useEffect(() => {
    const target = thankYouRevealRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') {
      setThankYouFabVisible(true);
      return () => {};
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setThankYouFabVisible(entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0.08,
        rootMargin: '0px 0px -10% 0px',
      }
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const footerSignOutButton = document.getElementById('footerSignOutBtn');

    if (!footerSignOutButton) {
      return () => {};
    }

    const handleFooterSignOut = (event) => {
      event.preventDefault();
      onSignOut();
    };

    footerSignOutButton.addEventListener('click', handleFooterSignOut);

    return () => {
      footerSignOutButton.removeEventListener('click', handleFooterSignOut);
    };
  }, [onSignOut]);

  return (
    <div className="app-shell">
      <div id="particles-bg" aria-hidden="true">
        <canvas id="starCanvas" aria-hidden="true" />
      </div>
      <div className="cursor" id="cursor" aria-hidden="true" />
      <div className="cursor-trail" id="cursorTrail" aria-hidden="true" />
      <div className="petal-layer" id="petalLayer" aria-hidden="true" />
      <div id="overlay" className="overlay" />
      <div id="heartFloatLayer" aria-hidden="true" />

      <ChatWidget />

      <div className="session-bar">
        {!isAdmin ? (
          <div className="session-bar__meta">
            <span className="session-bar__label">Signed in</span>
            <span className="session-bar__email">{userEmail || 'Saved session'}</span>
          </div>
        ) : null}
      </div>
      {sessionMessage ? <div className="session-bar__notice">{sessionMessage}</div> : null}

      <div id="startScreen" className="center birthday-hero">
        <div className="birthday-hero__stage">
          <video
            className="birthday-hero__bg-video"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
          >
            <source src={heroBackgroundVideo} />
          </video>
          <div className="birthday-hero__content">
            <BirthdayCountdown now={clockNow} />
            <div className="birthday-hero__title-row">
              <img
                className="birthday-hero__flower birthday-hero__flower--mobile birthday-hero__flower--mobile-left"
                src={flowerAsset}
                alt=""
                aria-hidden="true"
              />
              <AnimatedTitle ready={heroReady} tone="dark" />
              <img
                className="birthday-hero__flower birthday-hero__flower--mobile birthday-hero__flower--mobile-right"
                src={flowerAsset}
                alt=""
                aria-hidden="true"
              />
            </div>
            <p className="birthday-hero__copy">Do you want to see your gift?</p>
            <div className="birthday-hero__actions">
              <button id="startBtn" className="birthday-hero__button" type="button">
                Yes
              </button>
              <button
                className="birthday-hero__button birthday-hero__button--ghost birthday-hero__button--escape"
                type="button"
                onPointerEnter={moveNotInterestedButton}
                onPointerMove={moveNotInterestedButton}
                onPointerDown={(event) => {
                  event.preventDefault();
                  playNotInterestedSound();
                  moveNotInterestedButton(event);
                }}
                onPointerLeave={resetNotInterestedButton}
                onTouchStart={(event) => {
                  event.preventDefault();
                  moveNotInterestedButton(event);
                }}
                onClick={(event) => event.preventDefault()}
                style={{
                  transform: `translate(${notInterestedShift.x}px, ${notInterestedShift.y}px)`,
                }}
              >
                Not interested
              </button>
            </div>
          </div>

          <img className="birthday-hero__flower birthday-hero__flower--left" src={flowerAsset} alt="" aria-hidden="true" />
          <img className="birthday-hero__flower birthday-hero__flower--right" src={flowerAsset} alt="" aria-hidden="true" />
        </div>
      </div>

      <div id="intro" className="center">
        <div className="intro-stage" aria-hidden="true">
          <span className="intro-stage__light intro-stage__light--one" />
          <span className="intro-stage__light intro-stage__light--two" />
          <span className="intro-stage__light intro-stage__light--three" />
        </div>
        <IntroBirthdayCake key={introCakeKey} />
        <h1 className="intro-text">
          <span>FOR THE GIRL</span>
          <span>WHO OWNS MY HEART</span>
          <span>29TH MAY 2008</span>
          <span>#SUBMISSIVE BADDIE</span>
          <span>#KNIGHT</span>
        </h1>
      </div>

      <audio id="bgm">
        <source src="/bg_intro_music.mpeg" type="audio/mpeg" />
      </audio>

      <main id="mainContent" className="home-shell">
        <div className="home-shell__heading">
          <h2 className="home-shell__title">Happy Birthday</h2>
          <div className="home-shell__subtitle-wrap">
            <div className="home-shell__subtitle">Samruddhi</div>
            <img className="home-shell__bow" src="/samruddhi-bow.avif" alt="" aria-hidden="true" />
          </div>
        </div>

        <section className={`cards-stage ${cardsVisible ? 'is-visible' : ''}`}>
          <div className="cards-thread" aria-hidden="true">
            <span className="cards-thread__spine" />
            <span className="cards-thread__knot" />
          </div>
          <div className="cards-grid">
            {cards.map((card, index) => (
              <div
                className="feature-card-shell"
                key={card.id}
                style={{
                  '--card-delay': `${index * 90}ms`,
                  '--float-x': cardFloatStyles[index].x,
                  '--float-y': cardFloatStyles[index].y,
                  '--float-duration': cardFloatStyles[index].duration,
                  '--float-delay': cardFloatStyles[index].delay
                }}
              >
                <article className="feature-card" id={card.id}>
                  <div className="feature-card__icon">{card.icon}</div>
                  <h2>{card.title}</h2>
                  <p>{card.text}</p>
                </article>
              </div>
            ))}
          </div>
          {!isAdmin ? (
            <div
              className={`feature-card-shell feature-card-shell--thank-you ${cardsVisible ? 'is-visible' : ''}`}
              style={{
                '--float-x': '18px',
                '--float-y': '24px',
                '--float-duration': '6.4s',
                '--float-delay': '0.2s'
              }}
            >
              <article
                className="feature-card feature-card--thank-you"
                id="thankYouCard"
                onClick={openThankYouStudio}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openThankYouStudio();
                  }
                }}
              >
                <div className="feature-card__icon">💌</div>
                <h2>Thank You</h2>
                <p>Leave a note, voice, photo, or video</p>
                <span className="feature-card__badge">Open the studio</span>
              </article>
            </div>
          ) : null}
        </section>
        <section className={`birthday-finale ${cardsVisible ? 'is-visible' : ''}`} aria-label="Birthday finale">
          <div className="birthday-finale__sparkles" aria-hidden="true">
            {birthdayFinaleSparkles.map((sparkle, index) => (
              <span
                key={`${sparkle.symbol}-${index}`}
                className="birthday-finale__sparkle"
                style={{
                  top: sparkle.top,
                  left: sparkle.left,
                  fontSize: sparkle.size,
                  animationDuration: sparkle.duration,
                  animationDelay: sparkle.delay,
                }}
              >
                {sparkle.symbol}
              </span>
            ))}
          </div>
          <div className="birthday-finale__panel">
            <h2 className="birthday-finale__title">
              <span>Happy</span>
              <span>Birthday</span>
            </h2>
            <div className="birthday-finale__name-row">
              <span className="birthday-finale__name">Samruddhi</span>
              <span className="birthday-finale__cake" aria-hidden="true">🎂</span>
            </div>
            <p>Wishing you all the magic this world holds ✨</p>
          </div>
        </section>
        <button
          type="button"
          className={`thank-you-fab ${thankYouFabVisible ? 'is-visible' : ''} ${thankYouOpen ? 'is-hidden' : ''}`}
          onClick={openThankYouStudio}
          aria-label="Open the thank you popup"
        >
          <span className="thank-you-fab__icon" aria-hidden="true">
            💌
          </span>
          <span className="thank-you-fab__copy">
            <strong>Say thank you</strong>
            <small>Open the note studio</small>
          </span>
        </button>
        <div ref={thankYouRevealRef} className="thank-you-fab-sentinel" aria-hidden="true" />
      </main>

      <div id="popupLayer" className="popup-layer">
        <div id="partyPopup" className="popup-box wide-popup">
          <span className="popup-close" onClick={() => window.closeParty?.()}><i className="fa-solid fa-xmark"></i></span>
          <div className="video-wrapper">
            <video id="partyVideo" playsInline controls />
          </div>
          <button className="primary-btn" onClick={() => window.closeParty?.()}>
            Close Party
          </button>
        </div>

        <div id="wishPopup" className="popup-box wish-popup">
          <span className="popup-close" onClick={() => window.closeWish?.()}><i className="fa-solid fa-xmark"></i></span>
          <div className="wish-image-wrap" id="wishImageWrap">
            <div className="wish-image-overlay" />
          </div>
          <div className="wish-content">
            <h2>💌 Some Wishes for You</h2>
            <div className="message-card">
              <p>✨ May your smile always stay this bright.</p>
              <p>💖 May life give you peace, success, and endless happiness May every dream you have slowly turn into reality.</p>
            
              <p>🌸Happy Birthday to the most special girl in my life 🥰🩶</p>
              <p>💖Every moment with you feels like something I never want to lose ❣️</p>
              <p>🎂I am grateful for your smile, your care, your madness, and even your stubbornness❤️</p>
              <p>✨I just want to keep making memories with you 🥰</p>
              <p>🌸Today is your day, and I hope you feel loved every second of it🩶😉</p>
            </div>
          </div>
        </div>

        <div id="rizzPopup" className="popup-box rizz-popup">
          <span className="popup-close" onClick={() => window.closeRizz?.()}><i className="fa-solid fa-xmark"></i></span>
          <div className="rizz-image-wrap" id="rizzImageWrap">
            <div className="rizz-image-overlay" />
          </div>
          <div className="rizz-content">
            <h2>😏 Rizz for You</h2>
            <p className="rizz-subtitle">Tap below and get a smooth line ✨</p>
            <button id="generateRizzBtn" className="primary-btn">
              ✨ Get rizz
            </button>
            <div id="rizzOutput" />
          </div>
          <div id="heartBurstContainer" />
        </div>

        <div id="musicPopup" className="popup-box music-popup">
          <span className="popup-close" onClick={() => window.closeMusic?.()}><i className="fa-solid fa-xmark"></i></span>

          <div className="music-player">
            <div className="music-player__art-section">
              <div className="music-player__art-wrap">
                <span className="music-player__halo" aria-hidden="true" />
                <img
                  id="musicArt"
                  src="/music_img.png"
                  className="music-player__art"
                  alt="Album art"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = '/mj_pic.png';
                  }}
                />
              </div>
            </div>

            <div className="music-player__info">
              <h3 id="songTitle">Loading...</h3>
              <p id="songArtist" className="music-player__artist">MJ's Selection</p>
            </div>

            <div className="music-player__progress">
              <div className="music-player__progress-container">
                <input 
                  id="musicProgressBar" 
                  type="range" 
                  min="0" 
                  max="100" 
                  step="0.1" 
                  defaultValue="0" 
                  className="music-player__range" 
                />
                <div className="music-player__progress-bar">
                  <span id="musicProgressFill" />
                </div>
              </div>
              <div className="music-player__time">
                <span id="musicCurrentTime">0:00</span>
                <span id="musicDuration">0:00</span>
              </div>
            </div>

            <div className="music-controls" aria-label="Music controls">
              <button className="music-control-btn" id="prevBtn" type="button" aria-label="Previous song">⏮</button>
              <button className="music-control-btn music-control-btn--play" id="playBtn" type="button" aria-label="Play or pause">▶</button>
              <button className="music-control-btn" id="nextBtn" type="button" aria-label="Next song">⏭</button>
            </div>

            <div className="music-player__volume">
              <span className="music-player__volume-icon" aria-hidden="true">🔊</span>
              <input 
                id="musicVolume" 
                type="range" 
                min="0" 
                max="100" 
                defaultValue="85" 
                className="music-player__volume-slider" 
              />
              <span id="musicVolumeValue" className="music-player__volume-text">85%</span>
            </div>
            
            {/* Hidden elements to maintain compatibility with site.js logic */}
            <div id="musicEmojiLayer" hidden aria-hidden="true" />
            <div id="songStatus" hidden aria-hidden="true" />
            <div id="playlistCount" hidden aria-hidden="true" />
            <div id="musicTrackList" hidden aria-hidden="true" />
          </div>
        </div>

        <div id="aboutPopup" className="popup-box about-popup">
          <span className="popup-close" onClick={() => window.closeAbout?.()}><i className="fa-solid fa-xmark"></i></span>

          <div
            className="about-image-wrap"
            id="aboutImageWrap"
            style={{ backgroundImage: `url("${aboutBackgroundImage}")` }}
          >
            <div className="about-image-overlay" />
          </div>

          <div className="about-content">
            <h2>🫶 About You</h2>
            <p className="about-subtitle">Some cute facts, some dangerous facts 😌</p>
            <div id="aboutText" className="about-text typing-cursor" />
          </div>
        </div>

        <div id="memoriesPopup" className="popup-box memories-popup">
          <span className="popup-close" onClick={closeMemoriesAndReset}><i className="fa-solid fa-xmark"></i></span>
          <h2>🖤 Our Memories</h2>
          
          <div className="memory-progress-header">
            <div className="memory-progress-track">
              <div 
                className="memory-progress-fill" 
                style={{ width: `${(memoryIndex / (memoryData.length - 1)) * 100}%` }}
              />
              {memoryData.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`memory-progress-step ${idx <= memoryIndex ? 'is-active' : ''} ${idx < memoryIndex ? 'is-complete' : ''}`}
                  onClick={() => { setMemoryIndex(idx); setActiveMediaIndex(null); }}
                >
                  <span>#{idx + 1}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div 
            className="memory-slider"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {memoryData.map((memory, idx) => (
              <div 
                key={idx} 
                className={`memory-slide ${idx === memoryIndex ? 'is-active' : ''}`}
                style={{ display: idx === memoryIndex ? 'block' : 'none' }}
              >
                <div className={`memory-card ${activeMediaIndex === idx ? 'is-playing' : ''}`}>
                  <div className="memory-card__header">
                    <span className="memory-card__badge">Memory #{idx + 1}</span>
                    <h3>{memory.title}</h3>
                  </div>

                  <div className="memory-card__body">
                    <p>{memory.description}</p>
                    {memory.dateTime && <p className="memory-card__date-line">{memory.dateTime}</p>}
                    <div className="memory-card__media-wrap">
                      {idx === memoryIndex && memory.type === 'audio' && (
                        <MemoryVoicePlayer 
                          src={memory.src}
                          onPlay={() => {
                            setActiveMediaIndex(idx);
                            window.dispatchEvent(new CustomEvent('birthday:recording-audio-pause'));
                          }}
                          onPause={() => {
                            setActiveMediaIndex(null);
                            window.dispatchEvent(new CustomEvent('birthday:recording-audio-resume'));
                          }}
                          onEnded={() => {
                            setActiveMediaIndex(null);
                            window.dispatchEvent(new CustomEvent('birthday:recording-audio-resume'));
                          }}
                        />
                      )}
                      {idx === memoryIndex && memory.type === 'video' && (
                        <div className="memory-video-launcher">
                          <button 
                            className="special-see-btn" 
                            onClick={() => {
                              setFullscreenVid(memory);
                              window.history.pushState({ popupOpen: true, type: 'fullscreen-video' }, '');
                              window.dispatchEvent(new CustomEvent('birthday:recording-audio-pause'));
                            }}
                          >
                            <i className="fa-solid fa-play"></i> Watch Memory
                          </button>
                        </div>
                      )}
                      {memory.type === 'image' && (
                        <img src={memory.src} alt="" className="memory-card__img" onError={(e) => e.target.style.display = 'none'} />
                      )}
                    </div>
                  </div>

                  <div className="memory-card__nav">
                    {memoryIndex > 0 && (
                      <button 
                        className="memory-nav-btn" 
                        onClick={() => {
                          if (activeMediaIndex !== null) {
                            window.dispatchEvent(new CustomEvent('birthday:recording-audio-resume'));
                          }
                          setMemoryIndex(v => v - 1);
                          setActiveMediaIndex(null);
                        }}
                      >
                        <i className="fa-solid fa-left-long"></i>
                      </button>
                    )}
                    {memoryIndex < memoryData.length - 1 && (
                      <button 
                        className="memory-nav-btn memory-nav-btn--next" 
                        onClick={() => {
                          if (activeMediaIndex !== null) {
                            window.dispatchEvent(new CustomEvent('birthday:recording-audio-resume'));
                          }
                          setMemoryIndex(v => v + 1);
                          setActiveMediaIndex(null);
                        }}
                      >
                        <i className="fa-solid fa-right-long"></i>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div id="picsPopup" className="popup-box pics-popup">
          <span className="popup-close" onClick={() => window.closePics?.()}><i className="fa-solid fa-xmark"></i></span>
          <h2>🖼️ Your Pics</h2>
          <p className="pics-subtitle">Your private gallery, one memory at a time.</p>
          <div className="pics-frame">
            {privatePicsLoading ? (
              <div className="pics-state">Loading photos...</div>
            ) : privatePics.length ? (
              <>
                <div className="pics-viewport">
                  {privatePicsPrevious ? (
                    <PrivatePicCanvas
                      key={`previous-${privatePicsPrevious.pic.path}-${privatePicsPrevious.direction}`}
                      pic={privatePicsPrevious.pic}
                      direction={`exit-${privatePicsPrevious.direction}`}
                      label={`Previous private memory ${privatePicsPrevious.index + 1}`}
                    />
                  ) : null}
                  <PrivatePicCanvas
                    key={`${privatePics[privatePicsIndex].path}-${privatePicsDirection}`}
                    pic={privatePics[privatePicsIndex]}
                    direction={`enter-${privatePicsDirection}`}
                    label={`Private memory ${privatePicsIndex + 1}`}
                  />
                </div>
              </>
            ) : (
              <div className="pics-state">{privatePicsError || 'No photos found yet.'}</div>
            )}
          </div>
          {!privatePics.length && (
            <p className="pics-caption">Upload images to the private_images bucket to show them here.</p>
          )}
        </div>
      </div>

      {isAdmin ? (
        <div className="admin-block-dock">
          {!adminDockOpen ? (
            <button
              className="admin-block-dock__summary"
              type="button"
              onClick={() => setAdminDockOpen(true)}
              aria-expanded={adminDockOpen}
            >
              <span className="admin-block-dock__label">Admin email detected</span>
              <span className="admin-block-dock__summary-hint">Tap to open</span>
            </button>
          ) : (
            <button className="admin-block-dock__button" type="button" onClick={onOpenAdminPage}>
              View thank you responses
            </button>
          )}
        </div>
      ) : null}

      <ThankYouStudio 
        open={thankYouOpen} 
        onClose={() => {
          setThankYouOpen(false);
          if (window.history.state?.popupOpen) window.history.back();
        }} 
        userEmail={userEmail} 
      />

      {fullscreenVid && (
        <div className="fullscreen-video-modal" onClick={closeFullscreenVideo}>
          <div className="fullscreen-video-panel" onClick={e => e.stopPropagation()}>
            <button 
              className="fullscreen-video-close" 
              type="button"
              onClick={closeFullscreenVideo}
            ><i className="fa-solid fa-xmark"></i>
            </button>
            <div className="fullscreen-video-body">
              <MemoryVideoPlayer 
                src={fullscreenVid.src}
                onPlay={() => window.dispatchEvent(new CustomEvent('birthday:recording-audio-pause'))}
                onPause={() => window.dispatchEvent(new CustomEvent('birthday:recording-audio-resume'))}
                onEnded={() => window.dispatchEvent(new CustomEvent('birthday:recording-audio-resume'))}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SignOutConfirmModal({ open, busy, onCancel, onConfirm }) {
  useEffect(() => {
    if (!open) {
      unlockBodyScroll();
      return () => {};
    }

    lockBodyScroll();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unlockBodyScroll();
    };
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="sign-out-modal"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="sign-out-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signOutTitle"
        aria-describedby="signOutDesc"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="signOutTitle">Sign out?</h2>
        <p id="signOutDesc">
          You’ll need to sign in again to get back into the birthday page.
        </p>

        <div className="sign-out-modal__actions">
          <button className="sign-out-modal__button sign-out-modal__button--ghost" type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="sign-out-modal__button sign-out-modal__button--danger" type="button" onClick={onConfirm} disabled={busy}>
            {busy ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const [role, setRole] = useState(null);
  const [activeView, setActiveView] = useState('home');
  const [theme] = useState(() => {
    if (typeof window === 'undefined') {
      return CLASSIC_THEME;
    }

    return CLASSIC_THEME;
  });
  const [sendingLink, setSendingLink] = useState(false);
  const [email, setEmail] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    return window.localStorage.getItem(LAST_SIGNED_IN_EMAIL_KEY) || '';
  });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [sessionMessage, setSessionMessage] = useState('');
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const handleGlobalPopState = (event) => {
      const state = event.state;
      if (activeView === 'admin' && state?.type !== 'admin') {
        setActiveView('home');
      }
      if (signOutConfirmOpen && !state?.popupOpen) {
        setSignOutConfirmOpen(false);
      }
    };
    window.addEventListener('popstate', handleGlobalPopState);
    return () => window.removeEventListener('popstate', handleGlobalPopState);
  }, [activeView, signOutConfirmOpen]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return () => {};
    }

    document.body.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent('birthday:theme-change', { detail: { theme } }));

    return () => {};
  }, [theme]);

  useEffect(() => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setCooldownRemaining(0);
      return () => {};
    }

    const refreshCooldown = () => {
      const cooldownUntil = readCooldownUntil(trimmedEmail);
      setCooldownRemaining(Math.max(0, cooldownUntil - Date.now()));
    };

    refreshCooldown();
    const interval = window.setInterval(refreshCooldown, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [email]);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      setAuthReady(true);
      return () => {};
    }

    let mounted = true;
    const bootstrapTimeout = window.setTimeout(() => {
      if (!mounted) return;
      setAuthReady(true);
      setAuthLoading(false);
    }, 1500);

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthReady(true);
      setAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || nextSession) {
        setAuthReady(true);
        setAuthLoading(false);
      }
    });

    return () => {
      mounted = false;
      window.clearTimeout(bootstrapTimeout);
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.email) {
      setRole(null);
      setRoleLoading(false);
      return;
    }

    let mounted = true;
    setRoleLoading(true);

    const resolveRole = async () => {
      const currentEmail = session.user.email.trim().toLowerCase();

      if (mounted) {
        window.localStorage.setItem(LAST_SIGNED_IN_EMAIL_KEY, session.user.email.trim());
        setRole(adminEmail && currentEmail === adminEmail ? 'admin' : 'user');
        setRoleLoading(false);
      }
    };

    resolveRole().catch(() => {
      if (mounted) {
        setRole('user');
        setRoleLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [session]);

  const handleSendLink = async () => {
    if (!supabase) {
      setError('Sign-in is offline right now. Please try again later.');
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter an email address.');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (sendingLink) {
      return;
    }

    if (session?.user?.email?.trim().toLowerCase() === trimmedEmail.toLowerCase()) {
      setStatus('You are already signed in on this browser.');
      setError('');
      return;
    }

    const cooldownUntil = readCooldownUntil(trimmedEmail);
    const remaining = Math.max(0, cooldownUntil - Date.now());
    if (remaining > 0) {
      setCooldownRemaining(remaining);
      setError(`Please wait ${formatWaitTime(remaining)} before requesting another link.`);
      return;
    }

    setSendingLink(true);
    setStatus('');
    setError('');
    const authRedirectUrl = getAuthRedirectUrl();

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        emailRedirectTo: authRedirectUrl
      }
    });

    if (authError) {
      const message = authError.message || 'Could not send the link.';
      const isRateLimit =
        authError.status === 429 ||
        message.includes('429') ||
        message.toLowerCase().includes('rate limit') ||
        message.toLowerCase().includes('too many requests') ||
        message.toLowerCase().includes('wait') ||
        message.toLowerCase().includes('otp');

      if (isRateLimit) {
        const until = Date.now() + AUTH_COOLDOWN_MS;
        writeCooldownUntil(trimmedEmail, until);
        setCooldownRemaining(AUTH_COOLDOWN_MS);
        setError('Too many link requests. Wait 60 seconds and try again.');
        console.warn('[auth] magic link rate-limited', {
          email: trimmedEmail,
          redirectTo: authRedirectUrl,
          error: authError
        });
      } else if (
        message.toLowerCase().includes('smtp') ||
        message.toLowerCase().includes('deliver') ||
        message.toLowerCase().includes('team') ||
        message.toLowerCase().includes('redirect')
      ) {
        setError('Could not send the email right now. Please try again later.');
      } else {
        setError('Could not send the magic link. Please try again.');
      }
    } else {
      const until = Date.now() + AUTH_COOLDOWN_MS;
      writeCooldownUntil(trimmedEmail, until);
      setCooldownRemaining(AUTH_COOLDOWN_MS);
      setStatus(`Magic link sent to ${trimmedEmail}. Check your inbox.`);
    }

    setSendingLink(false);
  };

  const handleRefreshLoginLink = async () => {
    if (!supabase) {
      setSessionMessage('Sign-in is offline right now.');
      return;
    }

    const targetEmail = session?.user?.email?.trim();
    if (!targetEmail) {
      setSessionMessage('No signed-in email was found.');
      return;
    }

    const cooldownUntil = readCooldownUntil(targetEmail);
    const remaining = Math.max(0, cooldownUntil - Date.now());
    if (remaining > 0) {
      setSessionMessage(`Please wait ${formatWaitTime(remaining)} before requesting another link.`);
      return;
    }

    const authRedirectUrl = getAuthRedirectUrl();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: {
        emailRedirectTo: authRedirectUrl
      }
    });

    if (authError) {
      setSessionMessage('Could not send the magic link. Please try again.');
      return;
    }

    const until = Date.now() + AUTH_COOLDOWN_MS;
    writeCooldownUntil(targetEmail, until);
    setCooldownRemaining(AUTH_COOLDOWN_MS);
    setSessionMessage(`Fresh login link sent to ${targetEmail}. Check your inbox.`);
  };

  const handleSignOutRequest = () => {
    setSignOutConfirmOpen(true);
    window.history.pushState({ popupOpen: true, type: 'sign-out-confirm' }, '');
  };

  const handleSignOutCancel = () => {
    if (signingOut) {
      return;
    }

    setSignOutConfirmOpen(false);
    if (window.history.state?.popupOpen) window.history.back();
  };

  const handleSignOut = async () => {
    if (signingOut) {
      return;
    }

    setSigningOut(true);

    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(LAST_SIGNED_IN_EMAIL_KEY);
      }
      setSession(null);
      setRole(null);
      setRoleLoading(false);
      setActiveView('home');
      setSessionMessage('');
    } finally {
      setSignOutConfirmOpen(false);
      setSigningOut(false);
    }
  };

  const handleOpenAdminPage = () => {
    setActiveView('admin');
    window.history.pushState({ type: 'admin' }, '');
  };

  if (authLoading) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-badge">Loading</div>
          <h1>Checking your session...</h1>
          <p>Please wait a moment.</p>
        </div>
      </div>
    );
  }

  if (!authReady) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-badge">Loading</div>
          <h1>Restoring your signed-in session...</h1>
          <p>Please wait a moment.</p>
        </div>
      </div>
    );
  }

  if (session && roleLoading) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-badge">Loading</div>
          <h1>Opening your space...</h1>
          <p>Please wait a moment.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <AuthScreen
        email={email}
        setEmail={setEmail}
        onSendLink={handleSendLink}
        sending={sendingLink}
        status={status}
        error={error}
        configured={Boolean(supabase)}
        cooldownRemaining={cooldownRemaining}
      />
    );
  }

  if (activeView === 'admin' && role === 'admin') {
    return (
      <>
      <AdminDashboard
          onBackHome={() => {
            setActiveView('home');
            if (window.history.state?.type === 'admin') window.history.back();
          }}
          userEmail={session.user?.email}
        />
        <SignOutConfirmModal
          open={signOutConfirmOpen}
          busy={signingOut}
          onCancel={handleSignOutCancel}
          onConfirm={handleSignOut}
        />
      </>
    );
  }

  return (
    <>
      <BirthdayExperience
        onSignOut={handleSignOutRequest}
        onOpenAdminPage={handleOpenAdminPage}
        userEmail={session.user?.email}
        isAdmin={role === 'admin'}
        sessionMessage={sessionMessage}
      />
      <SignOutConfirmModal
        open={signOutConfirmOpen}
        busy={signingOut}
        onCancel={handleSignOutCancel}
        onConfirm={handleSignOut}
      />
    </>
  );
}
