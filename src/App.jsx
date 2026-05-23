import { useEffect, useRef, useState } from 'react';
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

function PrivatePicCanvas({ pic, direction, label }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!pic?.url) {
      return () => {};
    }

    const canvas = canvasRef.current;
    const image = new Image();
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
  document.body.classList.add('is-scroll-locked');
};

const unlockBodyScroll = () => {
  if (typeof document === 'undefined') return;
  const hasOpenLegacyPopup = Array.from(document.querySelectorAll('.popup-box')).some(
    (popup) => popup.style.display === 'block'
  );
  const hasOpenReactPopup = document.querySelector(
    '#chatbot.is-open, .thank-you-modal.is-open, .sign-out-modal'
  );

  if (!hasOpenLegacyPopup && !hasOpenReactPopup) {
    document.body.classList.remove('is-scroll-locked');
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

  if (referenceTime >= target.getTime()) {
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
      ? 'TODAY'
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
      aria-label={`Birthday countdown ${countdown.value}${countdown.detail ? `, ${countdown.detail}` : ''}`}
      aria-describedby={detailId}
    >
      <span className="birthday-hero__chip-label">Countdown</span>
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
    return 'About You is the sweet little ego boost section. 🫶';
  }

  if (/(rizz|smooth|line|flirt)/.test(normalized)) {
    return 'Rizz for You is for dramatic entrance energy. 😏';
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
    if (!open) {
      unlockBodyScroll();
      return () => {};
    }

    lockBodyScroll();
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
    return () => {
      unlockBodyScroll();
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
        onClick={() => setOpen((value) => !value)}
      >
        <span className="chat-toggle__icon" aria-hidden="true">
          {open ? '×' : '💬'}
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
      <div className="auth-glow auth-glow--one" />
      <div className="auth-glow auth-glow--two" />
      <div className="auth-card">
        <div className="auth-badge">Birthday access</div>
        <h1>Sign in to enter the birthday page</h1>
        <p>The full experience stays hidden until you log in. We'll send a one-time magic link to your email.</p>

        {!configured ? (
          <div className="auth-status auth-status--error">
            Sign-in is not ready yet. Add the app connection values to your env file.
          </div>
        ) : null}

        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSendLink();
          }}
        >
          <label className="auth-label" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
            disabled={sending || cooldownRemaining > 0 || !configured}
          />

          <button className="auth-button" type="submit" disabled={sending || cooldownRemaining > 0 || !configured}>
            {sending
              ? 'Sending link...'
              : cooldownRemaining > 0
                ? `Wait ${formatWaitTime(cooldownRemaining)}`
                : 'Send access link'}
          </button>
        </form>

        {status ? <div className="auth-status">{status}</div> : null}
        {error ? <div className="auth-status auth-status--error">{error}</div> : null}
      </div>
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
  const [privatePicsIndex, setPrivatePicsIndex] = useState(0);
  const [privatePicsDirection, setPrivatePicsDirection] = useState('right');
  const [privatePicsPrevious, setPrivatePicsPrevious] = useState(null);
  const [privatePicsLoading, setPrivatePicsLoading] = useState(true);
  const [privatePicsError, setPrivatePicsError] = useState('');
  const cardsTimer = useRef(null);
  const cleanupRef = useRef(null);
  const thankYouRevealRef = useRef(null);
  const [thankYouFabVisible, setThankYouFabVisible] = useState(false);

  const openThankYouStudio = () => {
    setThankYouOpen(true);
  };

  useEffect(() => {
    if (thankYouOpen) {
      lockBodyScroll();
    } else {
      unlockBodyScroll();
    }

    return () => {
      unlockBodyScroll();
    };
  }, [thankYouOpen]);

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

  const movePrivatePic = (step) => {
    if (!privatePics.length) {
      return;
    }

    const nextDirection = getRandomPicSlideDirection();
    setPrivatePicsDirection(nextDirection);
    setPrivatePicsIndex((index) => {
      setPrivatePicsPrevious({
        direction: nextDirection,
        index,
        pic: privatePics[index],
      });
      return (index + step + privatePics.length) % privatePics.length;
    });
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
        setPrivatePicsError('Supabase is not configured yet.');
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
        setPrivatePicsError(listError.message || 'Could not load private images.');
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
        .createSignedUrls(imagePaths, 120);

      if (ignore) return;

      if (signedError) {
        setPrivatePics([]);
        setPrivatePicsError(signedError.message || 'Could not open private images.');
        setPrivatePicsLoading(false);
        return;
      }

      const objectUrls = [];
      const nextPics = (await Promise.all(
        (signedFiles || []).map(async (item, index) => {
          if (!item.signedUrl) {
            return null;
          }

          try {
            const response = await fetch(item.signedUrl, { cache: 'no-store' });
            if (!response.ok) {
              return null;
            }

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            objectUrls.push(objectUrl);

            return {
              path: imagePaths[index],
              url: objectUrl,
            };
          } catch {
            return null;
          }
        })
      )).filter(Boolean);

      if (ignore) {
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
        return undefined;
      }

      setPrivatePics(nextPics);
      setPrivatePicsIndex(0);
      setPrivatePicsLoading(false);

      return () => {
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
      };
    };

    let revokeLoadedPics = () => {};
    loadPrivatePics().then((cleanup) => {
      if (typeof cleanup === 'function') {
        if (ignore) {
          cleanup();
        } else {
          revokeLoadedPics = cleanup;
        }
      }
    });

    return () => {
      ignore = true;
      revokeLoadedPics();
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

      <div id="popupLayer" className="popup-layer" aria-hidden="true">
        <div id="partyPopup" className="popup-box wide-popup">
          <span className="popup-close" onClick={() => window.closeParty?.()}>&times;</span>
          <div className="video-wrapper">
            <video id="partyVideo" playsInline controls />
          </div>
          <button className="primary-btn" onClick={() => window.closeParty?.()}>
            Close Party
          </button>
        </div>

        <div id="wishPopup" className="popup-box">
          <span className="popup-close" onClick={() => window.closeWish?.()}>&times;</span>
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

        <div id="rizzPopup" className="popup-box rizz-popup">
          <span className="popup-close" onClick={() => window.closeRizz?.()}>&times;</span>
          <h2>😏 Rizz for You</h2>
          <p className="rizz-subtitle">Tap below and get a smooth line ✨</p>
          <button id="generateRizzBtn" className="primary-btn">
            ✨ Get rizz
          </button>
          <div id="rizzOutput" />
          <div id="heartBurstContainer" />
        </div>

        <div id="musicPopup" className="popup-box music-popup">
          <span className="popup-close" onClick={() => window.closeMusic?.()}>&times;</span>

          <div className="music-player">
            <div className="music-player__emoji-layer" id="musicEmojiLayer" aria-hidden="true" />
            <div className="music-player__header">
              <h2>Playlist for MJ</h2>
              <p>Soft songs, birthday glow, and a little extra drama.</p>
            </div>

            <div className="music-player__stage">
              <div className="music-player__disc" aria-hidden="true">
                <span className="music-player__disc-core" />
              </div>

              <div className="music-player__track">
                <span className="music-player__status" id="songStatus">Ready to play</span>
                <h3 id="songTitle">Song 1</h3>
                <span className="music-player__count" id="playlistCount">1 / 3</span>
              </div>
            </div>

            <div className="music-player__progress" aria-hidden="true">
              <div className="music-player__progress-bar">
                <span id="musicProgressFill" />
              </div>
              <div className="music-player__time">
                <span id="musicCurrentTime">0:00</span>
                <span id="musicDuration">0:00</span>
              </div>
            </div>

            <div className="music-player__volume">
              <span className="music-player__volume-icon" aria-hidden="true">🔊</span>
              <label htmlFor="musicVolume">Volume</label>
              <input id="musicVolume" type="range" min="0" max="100" defaultValue="85" aria-label="Music volume" />
              <span id="musicVolumeValue">85%</span>
            </div>

            <div className="music-controls" aria-label="Music controls">
              <button className="music-control-btn" id="prevBtn" type="button" aria-label="Previous song">
                ⏮
              </button>
              <button className="music-control-btn music-control-btn--play" id="playBtn" type="button" aria-label="Play or pause">
                ▶
              </button>
              <button className="music-control-btn" id="nextBtn" type="button" aria-label="Next song">
                ⏭
              </button>
            </div>

            <div className="music-player__queue" id="musicTrackList" aria-label="Playlist songs" />
          </div>
        </div>

        <div id="aboutPopup" className="popup-box about-popup">
          <span className="popup-close" onClick={() => window.closeAbout?.()}>&times;</span>

          <div
            className="about-image-wrap"
            id="aboutImageWrap"
            style={{ backgroundImage: "url('/sam_pic.jpeg')" }}
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
          <span className="popup-close" onClick={() => window.closeMemories?.()}>&times;</span>
          <h2>🖤 Our Memories</h2>
          <p className="memories-subtitle">A small timeline of the moments that matter most.</p>
          <div className="memory-list">
            <div className="memory-item">
              <span className="memory-item__dot" />
              <div>
                <h3>First vibe check</h3>
                <p>That first moment when everything started feeling special.</p>
              </div>
            </div>
            <div className="memory-item">
              <span className="memory-item__dot" />
              <div>
                <h3>Countless laughs</h3>
                <p>Inside jokes, late replies, and all the random fun in between.</p>
              </div>
            </div>
            <div className="memory-item">
              <span className="memory-item__dot" />
              <div>
                <h3>Birthday forever</h3>
                <p>This page keeps the memories alive in one clean little space.</p>
              </div>
            </div>
          </div>
        </div>

        <div id="picsPopup" className="popup-box pics-popup">
          <span className="popup-close" onClick={() => window.closePics?.()}>&times;</span>
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
                {privatePics.length > 1 ? (
                  <div className="pics-controls" aria-label="Photo slideshow controls">
                    <button
                      type="button"
                      className="pics-control"
                      aria-label="Previous photo"
                      onClick={() => movePrivatePic(-1)}
                    >
                      ‹
                    </button>
                    <span className="pics-count">
                      {privatePicsIndex + 1} / {privatePics.length}
                    </span>
                    <button
                      type="button"
                      className="pics-control"
                      aria-label="Next photo"
                      onClick={() => movePrivatePic(1)}
                    >
                      ›
                    </button>
                  </div>
                ) : null}
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

      <ThankYouStudio open={thankYouOpen} onClose={() => setThankYouOpen(false)} userEmail={userEmail} />
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
      if (data.session) {
        setAuthReady(true);
        setAuthLoading(false);
      }
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
      setError('Supabase is not configured yet.');
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter an email address.');
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
        setError(
          'Supabase rate-limited this magic link request. Wait 60 seconds and try again. If it keeps happening, add the email to your Supabase Team allowlist or configure custom SMTP in Supabase Auth.'
        );
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
        setError(
          'Supabase could not send the email. Check that your project has SMTP configured and that this email is allowed in the Supabase Team tab or redirect allow list.'
        );
      } else {
        setError(message);
      }
    } else {
      const until = Date.now() + AUTH_COOLDOWN_MS;
      writeCooldownUntil(trimmedEmail, until);
      setCooldownRemaining(AUTH_COOLDOWN_MS);
      setStatus(`Access link sent to ${trimmedEmail}. Check your inbox.`);
    }

    setSendingLink(false);
  };

  const handleRefreshLoginLink = async () => {
    if (!supabase) {
      setSessionMessage('Supabase is not configured yet.');
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
      const message = authError.message || 'Could not send the link.';
      setSessionMessage(message);
      return;
    }

    const until = Date.now() + AUTH_COOLDOWN_MS;
    writeCooldownUntil(targetEmail, until);
    setCooldownRemaining(AUTH_COOLDOWN_MS);
    setSessionMessage(`Fresh login link sent to ${targetEmail}. Check your inbox.`);
  };

  const handleSignOutRequest = () => {
    setSignOutConfirmOpen(true);
  };

  const handleSignOutCancel = () => {
    if (signingOut) {
      return;
    }

    setSignOutConfirmOpen(false);
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
          onBackHome={() => setActiveView('home')}
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
