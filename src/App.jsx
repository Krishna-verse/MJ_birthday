import { useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabase';
import { initBirthdaySite } from './site';
import AdminDashboard from './AdminDashboard';
import ThankYouStudio from './ThankYouStudio';

const heroLines = ['Happy Birthday', 'Harshi'];
const adminEmail = import.meta.env.VITE_ADMIN_EMAIL?.trim().toLowerCase() || '';
const authRedirectUrl = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim() || window.location.origin;
const AUTH_COOLDOWN_MS = 60 * 1000;
const LAST_SIGNED_IN_EMAIL_KEY = 'harshi-7-last-signed-in-email';

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
  { id: 'picsCard', title: 'Our Pics', text: 'A tiny photo corner for us', icon: '\u{1F5BC}\u{FE0F}' },
  { id: 'rizzCard', title: 'Rizz for You', text: 'Smooth lines only', icon: '\u{1F60F}' }
];

const flowerAsset = '/saffron-flower.png';

const cardFloatStyles = [
  { x: '14px', y: '18px', duration: '6.2s', delay: '0s' },
  { x: '-16px', y: '20px', duration: '6.8s', delay: '0.35s' },
  { x: '13px', y: '16px', duration: '5.9s', delay: '0.18s' },
  { x: '-15px', y: '19px', duration: '6.5s', delay: '0.5s' },
  { x: '12px', y: '15px', duration: '6.1s', delay: '0.12s' },
  { x: '-14px', y: '18px', duration: '6.7s', delay: '0.42s' }
];

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

        <div className="auth-note">
          {cooldownRemaining > 0
            ? `Please wait ${formatWaitTime(cooldownRemaining)} before asking for another link.`
            : `Check your inbox and spam folder. If nothing arrives, your Supabase project may need SMTP enabled or your email added to the project team. The redirect URL is ${authRedirectUrl}.`}
        </div>
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
  const cardsTimer = useRef(null);
  const cleanupRef = useRef(null);

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

    window.addEventListener('birthday:home-visible', handleHomeVisible);

    return () => {
      window.clearTimeout(readyTimer);
      window.removeEventListener('birthday:home-visible', handleHomeVisible);
      if (cardsTimer.current) {
        clearTimeout(cardsTimer.current);
      }
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  return (
    <div className="app-shell">
      <div id="particles-bg" />
      <div id="overlay" className="overlay" />
      <div id="heartFloatLayer" aria-hidden="true" />

      <div className="session-bar">
        <div className="session-bar__meta">
          <span className="session-bar__label">Signed in</span>
          <span className="session-bar__email">{userEmail || 'Saved session'}</span>
        </div>
        <div className="session-bar__actions">
          {isAdmin ? (
            <button
              className="session-bar__button session-bar__button--ghost"
              type="button"
              onClick={onOpenAdminPage}
            >
              View thank you responses
            </button>
          ) : null}
          <button className="session-bar__button" type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </div>
      {sessionMessage ? <div className="session-bar__notice">{sessionMessage}</div> : null}

      <div id="chatToggle">💬</div>
      <div id="chatbot">
        <div id="chatHeader">🤖 Ask About Me</div>
        <div id="chatBody">
          <div className="bot-msg">Hi! 👋 Choose a question:</div>
          <div className="quick-btns">
            <button onClick={() => window.quickReply?.('birthday')}>🎂 Birthday?</button>
            <button onClick={() => window.quickReply?.('age')}>🎈 Age?</button>
            <button onClick={() => window.quickReply?.('hobby')}>🎮 Hobbies?</button>
          </div>
        </div>
      </div>

      <div id="startScreen" className="center birthday-hero">
        <div className="birthday-hero__stage">
          <div className="birthday-hero__content">
            <div className="hero-chip birthday-hero__chip">A tiny birthday universe</div>
            <AnimatedTitle ready={heroReady} tone="dark" />
            <p className="birthday-hero__copy">Do you want to see your gift?</p>
            <button id="startBtn" className="birthday-hero__button" type="button">
              See more
            </button>
          </div>

          <img className="birthday-hero__flower birthday-hero__flower--left" src={flowerAsset} alt="" aria-hidden="true" />
          <img className="birthday-hero__flower birthday-hero__flower--right" src={flowerAsset} alt="" aria-hidden="true" />
        </div>
      </div>

      <div id="intro" className="center">
        <h1 className="intro-text">
          <span>AND THEN...</span>
          <span>THE MAIN CHARACTER</span>
          <span>WAS BORN 🎬</span>
          <span>7TH APRIL 2008</span>
          <span>#DEVIL</span>
        </h1>
      </div>

      <audio id="bgm">
        <source src="/bgm.mp3" type="audio/mpeg" />
      </audio>

      <main id="mainContent" className="home-shell">
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
                  <div className="feature-card__shine" />
                </article>
              </div>
            ))}
          </div>
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
              onClick={() => {
                if (isAdmin) {
                  onOpenAdminPage();
                  return;
                }

                setThankYouOpen(true);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (isAdmin) {
                    onOpenAdminPage();
                    return;
                  }

                  setThankYouOpen(true);
                }
              }}
            >
              <div className="feature-card__icon">💌</div>
              <h2>Thank You</h2>
              <p>{isAdmin ? 'Review every thank-you submission from the admin inbox' : 'Leave a note, voice, photo, or video'}</p>
              <span className="feature-card__badge">{isAdmin ? 'Open responses' : 'Open the studio'}</span>
              <div className="feature-card__shine" />
            </article>
          </div>
        </section>
      </main>

      <div id="bgSettings" className="bg-settings-panel">
        <a href="javascript:void(0)" id="bgToggleLink">
          ⏸ Pause
        </a>
        <span className="volume-label">Volume:</span>
        <input id="bgVolumeSlider" type="range" min="0" max="1" step="0.05" defaultValue="0.3" />
      </div>

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
            <p>💖 May life give you peace, success, and endless happiness.</p>
            <p>🌸 May every dream you have slowly turn into reality.</p>
            <p>🎂 And may this year be kinder, sweeter, and more beautiful for you.</p>
          </div>
        </div>

        <div id="rizzPopup" className="popup-box rizz-popup">
          <span className="popup-close" onClick={() => window.closeRizz?.()}>&times;</span>
          <h2>😏 Rizz for You</h2>
          <p className="rizz-subtitle">Tap below and get a smooth line ✨</p>
          <button id="generateRizzBtn" className="primary-btn">
            ✨ Generate Rizz
          </button>
          <div id="rizzOutput" />
          <div id="heartBurstContainer" />
        </div>

        <div id="musicPopup" className="popup-box small-popup">
          <span className="popup-close" onClick={() => window.closeMusic?.()}>&times;</span>
          <h2>🎵 Birthday Playlist</h2>

          <div className="music-box">
            <h3 id="songTitle">Song 1</h3>
            <p id="songStatus">Ready to play 🎶</p>

            <div className="music-controls">
              <button className="primary-btn" id="prevBtn">
                ⏮
              </button>
              <button className="primary-btn" id="playBtn">
                ▶
              </button>
              <button className="primary-btn" id="nextBtn">
                ⏭
              </button>
            </div>

            <p id="playlistCount">1 / 5</p>
          </div>
        </div>

        <div id="aboutPopup" className="popup-box about-popup">
          <span className="popup-close" onClick={() => window.closeAbout?.()}>&times;</span>

          <div className="about-image-wrap" id="aboutImageWrap">
            <img src="/harshi_img.jpeg" alt="About You Picture" className="about-img" />
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
          <h2>🖼️ Our Pics</h2>
          <p className="pics-subtitle">A tiny gallery spot for your favorite photo.</p>
          <div className="pics-frame">
            <img src="/harshi_img.jpeg" alt="Our memory" className="pics-main-img" />
          </div>
          <p className="pics-caption">More photos can live here later. For now, this is the main one.</p>
        </div>
      </div>

      {isAdmin ? (
        <div className="admin-block-dock">
          <div className="admin-block-dock__copy">
            <span className="admin-block-dock__label">Admin email detected</span>
            <strong>Open the thank-you responses page from here anytime.</strong>
            <p>You are signed in with the admin account, so the response review page is unlocked for this session.</p>
          </div>
          <button className="admin-block-dock__button" type="button" onClick={onOpenAdminPage}>
            View thank you responses
          </button>
        </div>
      ) : null}

      <ThankYouStudio open={thankYouOpen} onClose={() => setThankYouOpen(false)} userEmail={userEmail} />
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
        setError('Please wait a minute before requesting another link.');
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

  const handleSignOut = async () => {
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
      <AdminDashboard
        onSignOut={handleSignOut}
        onBackHome={() => setActiveView('home')}
        userEmail={session.user?.email}
      />
    );
  }

  return (
      <BirthdayExperience
        onSignOut={handleSignOut}
        onOpenAdminPage={handleOpenAdminPage}
        userEmail={session.user?.email}
        isAdmin={role === 'admin'}
        sessionMessage={sessionMessage}
      />
  );
}
