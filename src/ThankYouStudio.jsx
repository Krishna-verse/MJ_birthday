import { useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabase';

const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_THANKYOU_BUCKET || 'thank-you-uploads';
const SUBMISSIONS_TABLE = 'thank_you_submissions';

const tools = [
  {
    id: 'text',
    label: 'Text',
    title: 'Write a note',
    description: 'Type a message that feels right.',
    icon: '✍',
  },
  {
    id: 'voice',
    label: 'Voice',
    title: 'Record a voice note',
    description: 'Leave your message in your own voice.',
    icon: '🎙',
  },
  {
    id: 'camera',
    label: 'Record',
    title: 'Camera',
    description: 'Capture a photo or short clip.',
    icon: '📷',
  },
  {
    id: 'upload',
    label: 'Media',
    title: 'Attach files',
    description: 'Choose something from your device.',
    icon: '⬆',
  },
  {
    id: 'preview',
    label: 'Preview',
    title: 'Review your notes',
    description: 'See everything you have prepared.',
    icon: '👀',
  }
];

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'guest';

const sanitizeName = (name) => name.replace(/[^a-zA-Z0-9._-]+/g, '-');

const successTypeMeta = {
  text: { label: 'message', short: 'TXT' },
  image: { label: 'photo', short: 'PIC' },
  video: { label: 'video clip', short: 'VID' },
  audio: { label: 'audio note', short: 'AUD' },
  file: { label: 'file', short: 'FILE' },
};

const formatSuccessSentence = (items) => {
  if (!items.length) {
    return 'Your thank-you note was sent successfully.';
  }

  const parts = items.map((item) => `${item.count === 1 ? item.label : `${item.count} ${item.label}s`}`);

  if (parts.length === 1) {
    return `Your ${parts[0]} was sent successfully.`;
  }

  if (parts.length === 2) {
    return `Your ${parts[0]} and ${parts[1]} were sent successfully.`;
  }

  return `Your ${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]} were sent successfully.`;
};

const buildSuccessItems = (messageText, attachmentItems) => {
  const counts = new Map();

  if (messageText) {
    counts.set('text', 1);
  }

  attachmentItems.forEach((item) => {
    counts.set(item.kind, (counts.get(item.kind) || 0) + 1);
  });

  return Array.from(counts.entries()).map(([kind, count]) => {
    const meta = successTypeMeta[kind] || successTypeMeta.file;
    return {
      kind,
      count,
      label: meta.label,
      short: meta.short,
    };
  });
};

const pickRecorderMime = (kind) => {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  const candidates =
    kind === 'audio'
      ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
};

const formatSeconds = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
};

const photoFilters = [
  { id: 'natural', label: 'Natural', filter: 'none' },
  { id: 'soft', label: 'Soft', filter: 'brightness(1.08) contrast(0.94) saturate(1.12)' },
  { id: 'glow', label: 'Glow', filter: 'brightness(1.12) contrast(1.05) saturate(1.22)' },
  { id: 'mono', label: 'Mono', filter: 'grayscale(1) contrast(1.12) brightness(1.02)' },
  { id: 'film', label: 'Film', filter: 'sepia(0.28) contrast(1.08) saturate(1.28)' },
];

const getPhotoFilter = (id) =>
  photoFilters.find((filter) => filter.id === id) || photoFilters[0];

const pauseBackgroundAudioForRecording = () => {
  window.dispatchEvent(new CustomEvent('birthday:recording-audio-pause'));
};

const resumeBackgroundAudioAfterRecording = () => {
  window.dispatchEvent(new CustomEvent('birthday:recording-audio-resume'));
};

function createAttachment(file, kind) {
  return {
    id: uid(),
    file,
    kind,
    name: file.name,
    previewUrl: URL.createObjectURL(file),
  };
}

function VoiceAttachmentPlayer({ src, name }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  };

  const seek = (event) => {
    const audio = audioRef.current;
    const nextTime = Number(event.target.value);
    if (!audio || !Number.isFinite(nextTime)) return;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  return (
    <div className="thank-you-voice-player">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        className={`thank-you-voice-player__play ${playing ? 'is-playing' : ''}`}
        onClick={togglePlayback}
        aria-label={playing ? `Pause ${name}` : `Play ${name}`}
      >
        {playing ? 'Pause' : 'Play'}
      </button>
      <div className="thank-you-voice-player__body">
        <input
          className="thank-you-voice-player__range"
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || 0)}
          onChange={seek}
          style={{ '--voice-progress': `${progress}%` }}
          aria-label={`Voice note timeline for ${name}`}
        />
      </div>
    </div>
  );
}

export default function ThankYouStudio({ open, onClose, userEmail }) {
  const [activeTool, setActiveTool] = useState('text');
  const [cameraMode, setCameraMode] = useState('photo');
  const [photoFilterId, setPhotoFilterId] = useState('natural');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sendSuccess, setSendSuccess] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [lastCapturedId, setLastCapturedId] = useState(null);
  const [cameraMessage, setCameraMessage] = useState('Open the camera when you are ready.');
  const [recordingState, setRecordingState] = useState('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);

  const cameraRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const cameraFlashTimerRef = useRef(null);
  const attachmentsRef = useRef([]);
  const selectedPhotoFilter = getPhotoFilter(photoFilterId);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    if (!open) {
      stopCamera();
      stopRecording(false);
      setSendSuccess(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === 'undefined' || !document.body) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && open) {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      stopCamera();
      stopRecording(false);
      if (cameraFlashTimerRef.current) {
        clearTimeout(cameraFlashTimerRef.current);
      }
      attachmentsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  function clearRecordTimer() {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }

  function clearCameraFlashTimer() {
    if (cameraFlashTimerRef.current) {
      clearTimeout(cameraFlashTimerRef.current);
      cameraFlashTimerRef.current = null;
    }
  }

  function playCameraCaptureSound() {
    if (typeof window === 'undefined') {
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    try {
      const context = new AudioContextClass();
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.connect(context.destination);

      const clickOne = context.createOscillator();
      clickOne.type = 'triangle';
      clickOne.frequency.setValueAtTime(1360, context.currentTime);
      clickOne.frequency.exponentialRampToValueAtTime(260, context.currentTime + 0.07);
      clickOne.connect(gain);

      const clickTwo = context.createOscillator();
      clickTwo.type = 'square';
      clickTwo.frequency.setValueAtTime(760, context.currentTime + 0.05);
      clickTwo.frequency.exponentialRampToValueAtTime(180, context.currentTime + 0.12);
      clickTwo.connect(gain);

      gain.gain.exponentialRampToValueAtTime(0.28, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.14);

      clickOne.start(context.currentTime);
      clickOne.stop(context.currentTime + 0.08);
      clickTwo.start(context.currentTime + 0.045);
      clickTwo.stop(context.currentTime + 0.13);

      window.setTimeout(() => {
        context.close().catch(() => {});
      }, 220);
    } catch {
      // Keep capture working even if audio feedback fails.
    }
  }

  function triggerCameraFeedback(duration = 520) {
    playCameraCaptureSound();
    setIsFlashing(true);
    clearCameraFlashTimer();
    cameraFlashTimerRef.current = window.setTimeout(() => {
      setIsFlashing(false);
      cameraFlashTimerRef.current = null;
    }, duration);
  }

  function stopCamera() {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    streamRef.current = null;
    if (cameraRef.current) {
      cameraRef.current.srcObject = null;
    }
    clearCameraFlashTimer();
    setIsFlashing(false);
    setCameraReady(false);
  }

  function stopRecording(showHint = true) {
    const recorder = recorderRef.current;
    const mode = recordingState;
    
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }

    if (showHint) {
      setCameraMessage('Recording stopped. You can attach another clip or send now.');
    }
  }

  const downloadAttachment = (item) => {
    const link = document.createElement('a');
    link.href = item.previewUrl;
    link.download = item.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatus(`Downloading ${item.name}...`);
  };

  function addAttachment(file, kind) {
    const item = createAttachment(file, kind);
    setAttachments((current) => [...current, item]);
    if (kind === 'image' || kind === 'video') {
      setLastCapturedId(item.id);
      setTimeout(() => setLastCapturedId(null), 3000);
    }
  }

  function removeAttachment(id) {
    setAttachments((current) => {
      const next = current.filter((item) => item.id !== id);
      const removed = current.find((item) => item.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return next;
    });
  }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not supported in this browser.');
      return;
    }

    stopCamera();
    setError('');
    setStatus('');
    setCameraMessage('Requesting camera permission...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
        },
        audio: cameraMode === 'video',
      });

      streamRef.current = stream;
      setCameraReady(true);
      setCameraMessage(cameraMode === 'photo' ? 'Camera is ready for a snapshot.' : 'Camera is ready for video recording.');

      if (cameraRef.current) {
        cameraRef.current.srcObject = stream;
        await cameraRef.current.play().catch(() => {});
      }
    } catch (err) {
      setCameraMessage('Camera access was blocked.');
      setError(err instanceof Error ? err.message : 'Could not open the camera.');
    }
  }

  async function capturePhoto() {
    if (!cameraReady || !cameraRef.current) {
      setError('Open the camera first.');
      return;
    }

    triggerCameraFeedback(480);

    const video = cameraRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext('2d');

    if (!context) {
      setError('Could not create a photo snapshot.');
      return;
    }

    context.filter = selectedPhotoFilter.filter;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    context.filter = 'none';
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('Could not capture the photo.');
          return;
        }

        const file = new File([blob], `photo-${Date.now()}.png`, { type: 'image/png' });
        addAttachment(file, 'image');
        setStatus('Photo captured and attached.');
      },
      'image/png',
      0.95
    );
  }

  async function startVoiceRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice recording is not supported in this browser.');
      return;
    }

    if (recordingState !== 'idle') {
      return;
    }

    setActiveTool('voice');
    setError('');
    setStatus('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecorderMime('audio');
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      pauseBackgroundAudioForRecording();
      chunksRef.current = [];
      recorderRef.current = recorder;
      setRecordingState('voice');
      setRecordingTime(0);
      clearRecordTimer();
      recordTimerRef.current = window.setInterval(() => {
        setRecordingTime((value) => value + 1);
      }, 1000);
      setCameraMessage('Voice recording is live.');

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        clearRecordTimer();
        setRecordingState('idle');

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type || 'audio/webm' });
        addAttachment(file, 'audio');
        setStatus('');
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        chunksRef.current = [];
        resumeBackgroundAudioAfterRecording();
      };

      recorder.start();
    } catch (err) {
      clearRecordTimer();
      setRecordingState('idle');
      setCameraMessage('Voice recording could not start.');
      setError(err instanceof Error ? err.message : 'Could not start voice recording.');
      resumeBackgroundAudioAfterRecording();
    }
  }

  function stopVoiceRecording() {
    stopRecording(false);
  }

  async function startVideoRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Video recording is not supported in this browser.');
      return;
    }

    if (recordingState !== 'idle') {
      return;
    }

    setActiveTool('camera');
    setCameraMode('video');
    setError('');
    setStatus('');

    try {
      if (!cameraReady) {
        await openCamera();
      }

      const stream = streamRef.current;
      if (!stream) {
        throw new Error('Open the camera before recording.');
      }

      const mimeType = pickRecorderMime('video');
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      pauseBackgroundAudioForRecording();
      triggerCameraFeedback(900);
      chunksRef.current = [];
      recorderRef.current = recorder;
      setRecordingState('video');
      setRecordingTime(0);
      clearRecordTimer();
      recordTimerRef.current = window.setInterval(() => {
        setRecordingTime((value) => value + 1);
      }, 1000);
      setCameraMessage('Video recording is live.');

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        clearRecordTimer();
        setRecordingState('idle');

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'video/webm',
        });
        const file = new File([blob], `video-clip-${Date.now()}.webm`, { type: blob.type || 'video/webm' });
        addAttachment(file, 'video');
        setStatus('');
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (cameraRef.current) {
          cameraRef.current.srcObject = null;
        }
        setCameraReady(false);
        recorderRef.current = null;
        chunksRef.current = [];
        resumeBackgroundAudioAfterRecording();
      };

      recorder.start();
    } catch (err) {
      clearRecordTimer();
      setRecordingState('idle');
      setCameraMessage('Video recording could not start.');
      setError(err instanceof Error ? err.message : 'Could not start video recording.');
      resumeBackgroundAudioAfterRecording();
    }
  }

  function stopVideoRecording() {
    stopRecording(false);
  }

  function handleUploadFiles(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      const kind = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
          ? 'video'
          : file.type.startsWith('audio/')
            ? 'audio'
            : 'file';
      addAttachment(file, kind);
    });

    setStatus(`${files.length} file${files.length > 1 ? 's' : ''} added.`);
    event.target.value = '';
  }

  function resetDraft(preserveSuccess = false) {
    setMessage('');
    setStatus('');
    setError('');
    setCameraMessage('Open the camera when you are ready.');
    setAttachments((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    stopCamera();
    if (!preserveSuccess) {
      setSendSuccess(null);
    }
  }

  async function handleSend() {
    if (!supabase) {
      setError('This feature is not ready yet.');
      return;
    }

    if (!message.trim() && attachments.length === 0) {
      setError('Add something before sending.');
      return;
    }

    if (recordingState !== 'idle') {
      setError('Stop the current recording before sending.');
      return;
    }

    setUploading(true);
    setStatus('Sending...');
    setError('');

    const messageText = message.trim();
    const attachmentSnapshot = [...attachments];
    const bundleId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${slugify(userEmail || 'guest')}-${uid().slice(0, 6)}`;
    const uploads = [];
    const storagePaths = [];

    if (messageText) {
      const notePath = `${bundleId}/thank-you-note.txt`;
      uploads.push({
        file: new File([messageText], 'thank-you-note.txt', { type: 'text/plain' }),
        path: notePath,
      });
      storagePaths.push(notePath);
    }

    const manifest = {
      createdAt: new Date().toISOString(),
      userEmail: userEmail || null,
      message: messageText,
      attachments: attachmentSnapshot.map((item) => ({
        name: item.name,
        kind: item.kind,
        type: item.file.type,
        size: item.file.size,
      })),
    };

    uploads.push({
      file: new File([JSON.stringify(manifest, null, 2)], 'manifest.json', { type: 'application/json' }),
      path: `${bundleId}/manifest.json`,
    });
    storagePaths.push(`${bundleId}/manifest.json`);

    attachments.forEach((item, index) => {
      const path = `${bundleId}/${String(index + 1).padStart(2, '0')}-${sanitizeName(item.name)}`;
      uploads.push({
        file: item.file,
        path,
      });
      storagePaths.push(path);
    });

    try {
      for (const upload of uploads) {
        const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(upload.path, upload.file, {
          contentType: upload.file.type || 'application/octet-stream',
          upsert: false,
        });

        if (uploadError) {
          const isBucketIssue =
            uploadError.message.toLowerCase().includes('bucket') ||
            uploadError.message.toLowerCase().includes('not found');
          throw new Error(
            isBucketIssue
              ? 'Storage is not set up yet.'
              : 'Could not save your message right now.'
          );
        }
      }

      const { error: submissionError } = await supabase.from(SUBMISSIONS_TABLE).insert({
        bundle_id: bundleId,
        user_email: userEmail || null,
        message: messageText,
        storage_bucket: STORAGE_BUCKET,
        storage_paths: storagePaths,
        attachment_meta: attachmentSnapshot.map((item) => ({
          name: item.name,
          kind: item.kind,
          type: item.file.type,
          size: item.file.size,
        })),
      });

      if (submissionError) {
        throw new Error('Could not save your message right now.');
      }

      const successItems = buildSuccessItems(messageText, attachmentSnapshot);
      setSendSuccess({
        bundleId,
        items: successItems,
        sentence: formatSuccessSentence(successItems),
      });
      resetDraft(true);
      setStatus('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStatus('');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={`thank-you-modal ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="thank-you-modal__backdrop" onClick={onClose} />
      <section
        className={`thank-you-modal__panel ${sendSuccess ? 'is-success' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Thank you studio"
      >
        {sendSuccess ? (
          <div className="thank-you-success" role="status" aria-live="polite">
            <div className="thank-you-success__confetti" aria-hidden="true">
              {Array.from({ length: 12 }).map((_, i) => (
                <span
                  key={i}
                  className="thank-you-success__confetti-piece"
                  style={{
                    '--left': `${Math.random() * 100}%`,
                    '--rotate': `${Math.random() * 360}deg`,
                    '--duration': `${2 + Math.random() * 3}s`,
                    '--delay': `${Math.random() * 2}s`,
                  }}
                />
              ))}
            </div>

            <div className="thank-you-success__glow thank-you-success__glow--one" />
            <div className="thank-you-success__glow thank-you-success__glow--two" />

            <div className="thank-you-success__card">
              <div className="thank-you-success__badge">Sent to Krishna</div>
              <div className="thank-you-success__mark">
                <span>✓</span>
              </div>
              <h2>Note Delivered!</h2>
              <p>{sendSuccess.sentence}</p>

              <div className="thank-you-success__items">
                {sendSuccess.items.map((item, idx) => (
                  <div className="thank-you-success__item" key={item.kind} style={{ '--item-index': idx }}>
                    <small>{item.count} {item.label}{item.count !== 1 ? 's' : ''}</small>
                    <strong>{item.short}</strong>
                  </div>
                ))}
              </div>

              <div className="thank-you-success__actions">
                <button
                  type="button"
                  className="thank-you-success__button thank-you-success__button--ghost"
                  onClick={() => setSendSuccess(null)}
                >
                  Send another
                </button>
                <button
                  type="button"
                  className="thank-you-success__button thank-you-success__button--solid"
                  onClick={onClose}
                >
                  Close studio
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
        <div className="thank-you-modal__birthday-watermark" aria-hidden="true">
          <div className="birthday-finale__panel">
            <h2 className="birthday-finale__title">
              <span>Happy</span>
              <span>Birthday</span>
            </h2>
            <div className="birthday-finale__name-row">
              <span className="birthday-finale__name">Samruddhi</span>
              <span className="birthday-finale__cake">🎂</span>
            </div>
          </div>
        </div>
        <div className="thank-you-modal__header">
          <h2>Leave a note, voice, and more for me.</h2>
          <button className="thank-you-modal__close" type="button" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="thank-you-modal__toolbar">
          {tools.filter(t => t.id !== 'preview' || attachments.length > 0).map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={`thank-you-chip ${activeTool === tool.id ? 'is-active' : ''}`}
              onClick={() => setActiveTool(tool.id)}
            >
              {tool.id === 'preview' && attachments.length > 0 && (
                <span className="thank-you-chip__badge">
                  {attachments.length}
                </span>
              )}
              <span className="thank-you-chip__icon">{tool.icon}</span>
              <span>{tool.label}</span>
            </button>
          ))}
        </div>

        <div className="thank-you-modal__grid">
          <section className="thank-you-compose">
            {activeTool === 'text' ? (
              <>
                <label className="thank-you-label" htmlFor="thank-you-message">
                  Your message
                </label>
                <textarea
                  id="thank-you-message"
                  className="thank-you-textarea"
                  placeholder="Write something heartfelt..."
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
              </>
            ) : null}

            {activeTool === 'voice' ? (
              <div className="thank-you-compose__voice">
                <label className="thank-you-label">Voice note</label>
                {recordingState === 'voice' ? (
                  <div className="thank-you-voice-orbit" aria-hidden="true">
                    <span className="thank-you-voice-orbit__ring" />
                    <span className="thank-you-voice-orbit__core">REC</span>
                    {['♪', '♡', '✦', '♫', '•'].map((emoji, index) => (
                      <span
                        className="thank-you-voice-orbit__emoji"
                        key={`${emoji}-${index}`}
                        style={{
                          '--emoji-index': index,
                          '--emoji-angle': `${index * 72}deg`,
                          '--emoji-angle-inverse': `${index * -72}deg`,
                        }}
                      >
                        {emoji}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="thank-you-recorder">
                  <button
                    type="button"
                    className={`thank-you-record-btn ${recordingState === 'voice' ? 'is-recording' : ''}`}
                    onClick={recordingState === 'voice' ? stopVoiceRecording : startVoiceRecording}
                  >
                    {recordingState === 'voice' ? 'Stop Recording' : 'Record Voice'}
                  </button>
                  <div className="thank-you-recorder__status">
                    {recordingState === 'voice' ? `Recording ${formatSeconds(recordingTime)}` : 'Ready to record'}
                  </div>
                </div>
              </div>
            ) : null}

            {activeTool === 'camera' ? (
              <div className="thank-you-compose__camera">
                <label className="thank-you-label">Camera mode</label>
                <p className="thank-you-compose__voice-copy">{cameraMessage}</p>

                <div className="thank-you-segmented">
                  <button
                    type="button"
                    className={cameraMode === 'photo' ? 'is-active' : ''}
                    onClick={() => {
                      setCameraMode('photo');
                      stopCamera();
                    }}
                  >
                    Photo
                  </button>
                  <button
                    type="button"
                    className={cameraMode === 'video' ? 'is-active' : ''}
                    onClick={() => {
                      setCameraMode('video');
                      stopCamera();
                    }}
                  >
                    Video
                  </button>
                </div>

                {cameraMode === 'photo' ? (
                  <div className="thank-you-filter-strip" aria-label="Photo filters">
                    {photoFilters.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        className={`thank-you-filter-chip ${photoFilterId === filter.id ? 'is-active' : ''}`}
                        onClick={() => setPhotoFilterId(filter.id)}
                        aria-pressed={photoFilterId === filter.id}
                      >
                        <span
                          className="thank-you-filter-chip__swatch"
                          style={{ '--photo-filter': filter.filter }}
                          aria-hidden="true"
                        />
                        <span>{filter.label}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className={`thank-you-camera ${isFlashing ? 'is-flashing' : ''} ${recordingState === 'video' ? 'is-recording' : ''}`}>
                  <video
                    ref={cameraRef}
                    className="thank-you-camera__view"
                    muted
                    playsInline
                    autoPlay
                    style={{ '--active-photo-filter': cameraMode === 'photo' ? selectedPhotoFilter.filter : 'none' }}
                  />
                </div>

                <div className="thank-you-camera__actions">
                  <button type="button" className="thank-you-secondary-btn" onClick={openCamera}>
                    Open
                  </button>

                  {cameraMode === 'photo' ? (
                    <button type="button" className="thank-you-primary-btn" onClick={capturePhoto} disabled={!cameraReady}>
                      Capture Photo
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`thank-you-primary-btn ${recordingState === 'video' ? 'is-recording' : ''}`}
                      onClick={recordingState === 'video' ? stopVideoRecording : startVideoRecording}
                    >
                      {recordingState === 'video' ? `Stop Video ${formatSeconds(recordingTime)}` : 'Record Video'}
                    </button>
                  )}
                </div>

              </div>
            ) : null}

            {activeTool === 'upload' ? (
              <div className="thank-you-compose__upload">
                <label className="thank-you-label" htmlFor="thank-you-upload">
                  Upload files
                </label>
                <p className="thank-you-compose__voice-copy">Choose files from your device.</p>
                <label className="thank-you-dropzone" htmlFor="thank-you-upload">
                  <span className="thank-you-dropzone__icon" aria-hidden="true">↑</span>
                  <span>Choose files</span>
                  <small>Images, videos, audio, or documents</small>
                </label>
                <input
                  id="thank-you-upload"
                  className="thank-you-file-input"
                  type="file"
                  accept="image/*,video/*,audio/*,.pdf,.txt"
                  multiple
                  onChange={handleUploadFiles}
                />
              </div>
            ) : null}

            {activeTool === 'preview' ? (
              <div className="thank-you-preview-mode">
                <label className="thank-you-label">Review your attachments</label>
                <div className="thank-you-attachments thank-you-attachments--preview">
                  {attachments.map((item) => (
                    <article className="thank-you-attachment thank-you-attachment--large" key={item.id}>
                      <div className="thank-you-attachment__actions-overlay">
                        <button
                          type="button"
                          className="thank-you-mini-btn thank-you-mini-btn--remove"
                          onClick={() => removeAttachment(item.id)}
                          title="Remove"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>

                      <div className="thank-you-attachment__content">
                        {item.kind === 'image' ? (
                          <img src={item.previewUrl} alt={item.name} className="thank-you-attachment__preview" />
                        ) : item.kind === 'video' ? (
                          <video src={item.previewUrl} className="thank-you-attachment__preview" controls playsInline />
                        ) : item.kind === 'audio' ? (
                          <VoiceAttachmentPlayer src={item.previewUrl} name={item.name} />
                        ) : (
                          <div className="thank-you-attachment__file">File</div>
                        )}
                      </div>

                      <div className="thank-you-attachment__footer-ops">
                        <div className="thank-you-attachment__meta">
                          <span>{item.kind}</span>
                          <strong>{item.name}</strong>
                        </div>
                        <div className="thank-you-attachment__ops-btns">
                          <button 
                            className="thank-you-op-btn thank-you-op-btn--download" 
                            onClick={() => downloadAttachment(item)}
                          >
                            <i className="fa-solid fa-download"></i> Download
                          </button>
                          <button 
                            className="thank-you-op-btn thank-you-op-btn--send" 
                            onClick={handleSend}
                            disabled={uploading}
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                <button className="thank-you-secondary-btn thank-you-preview-back" onClick={() => setActiveTool('text')}>
                  ← Back to editor
                </button>
              </div>
            ) : (
              <div className="thank-you-attachments">
                {attachments
                  .filter(item => {
                    if (activeTool === 'voice') return item.kind === 'audio';
                    if (activeTool === 'camera') return item.kind === 'image' || item.kind === 'video';
                    if (activeTool === 'upload') return true;
                    return false;
                  })
                  .map((item) => (
                    <article 
                      className={`thank-you-attachment ${lastCapturedId === item.id ? 'is-captured' : ''}`} 
                      key={item.id}
                    >
                      <button
                        type="button"
                        className="thank-you-attachment__remove"
                        onClick={() => removeAttachment(item.id)}
                        aria-label={`Remove ${item.name}`}
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>

                      <div className="thank-you-attachment__content">
                        {item.kind === 'image' ? (
                          <img src={item.previewUrl} alt={item.name} className="thank-you-attachment__preview" />
                        ) : item.kind === 'video' ? (
                          <video src={item.previewUrl} className="thank-you-attachment__preview" controls playsInline />
                        ) : item.kind === 'audio' ? (
                          <VoiceAttachmentPlayer src={item.previewUrl} name={item.name} />
                        ) : (
                          <div className="thank-you-attachment__file">File</div>
                        )}
                      </div>

                      <div className="thank-you-attachment__footer-ops">
                        <div className="thank-you-attachment__meta">
                          <span>{item.kind}</span>
                          <strong>{item.name}</strong>
                        </div>
                        <div className="thank-you-attachment__ops-btns">
                          <button 
                            type="button"
                            className="thank-you-op-btn thank-you-op-btn--download" 
                            onClick={() => downloadAttachment(item)}
                          >
                            <i className="fa-solid fa-download"></i> Save
                          </button>
                          <button 
                            type="button"
                            className="thank-you-op-btn thank-you-op-btn--send" 
                            onClick={handleSend}
                            disabled={uploading}
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
            )}
          </section>
        </div>

        {status || error ? (
          <div className={`thank-you-feedback ${error ? 'is-error' : ''}`}>
            {status || error}
          </div>
        ) : null}

        <div className="thank-you-modal__footer">
          <p className="thank-you-modal__privacy">This didn&apos;t get public.</p>
          <button type="button" className="thank-you-submit-btn" onClick={handleSend} disabled={uploading || !open}>
            {uploading ? (
              'Sending...'
            ) : (
              <>
                <i className="fa-solid fa-upload" aria-hidden="true"></i>
                Send it...
              </>
            )}
          </button>
        </div>
          </>
        )}
      </section>
    </div>
  );
}
