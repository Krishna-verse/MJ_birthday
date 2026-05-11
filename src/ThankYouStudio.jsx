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
    label: 'Camera',
    title: 'Camera',
    description: 'Capture a photo or short clip.',
    icon: '📷',
  },
  {
    id: 'upload',
    label: 'Upload',
    title: 'Attach files',
    description: 'Choose something from your device.',
    icon: '⬆',
  },
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

function createAttachment(file, kind) {
  return {
    id: uid(),
    file,
    kind,
    name: file.name,
    previewUrl: URL.createObjectURL(file),
  };
}

export default function ThankYouStudio({ open, onClose, userEmail }) {
  const [activeTool, setActiveTool] = useState('text');
  const [cameraMode, setCameraMode] = useState('photo');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraMessage, setCameraMessage] = useState('Open the camera when you are ready.');
  const [recordingState, setRecordingState] = useState('idle');
  const [recordingTime, setRecordingTime] = useState(0);

  const cameraRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const attachmentsRef = useRef([]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    if (!open) {
      stopCamera();
      stopRecording(false);
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
      attachmentsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  function clearRecordTimer() {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
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
    setCameraReady(false);
  }

  function stopRecording(showHint = true) {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }

    if (showHint) {
      setCameraMessage('Recording stopped. You can attach another clip or send now.');
    }
  }

  function addAttachment(file, kind) {
    setAttachments((current) => [...current, createAttachment(file, kind)]);
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

    const video = cameraRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext('2d');

    if (!context) {
      setError('Could not create a photo snapshot.');
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
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
        setStatus('Voice note attached.');
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        chunksRef.current = [];
      };

      recorder.start();
    } catch (err) {
      clearRecordTimer();
      setRecordingState('idle');
      setCameraMessage('Voice recording could not start.');
      setError(err instanceof Error ? err.message : 'Could not start voice recording.');
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
        setStatus('Video clip attached.');
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (cameraRef.current) {
          cameraRef.current.srcObject = null;
        }
        setCameraReady(false);
        recorderRef.current = null;
        chunksRef.current = [];
      };

      recorder.start();
    } catch (err) {
      clearRecordTimer();
      setRecordingState('idle');
      setCameraMessage('Video recording could not start.');
      setError(err instanceof Error ? err.message : 'Could not start video recording.');
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

  function clearDraft() {
    setMessage('');
    setStatus('');
    setError('');
    setCameraMessage('Open the camera when you are ready.');
    setAttachments((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    stopCamera();
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

    setUploading(true);
    setStatus('Sending...');
    setError('');

    const bundleId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${slugify(userEmail || 'guest')}-${uid().slice(0, 6)}`;
    const uploads = [];
    const storagePaths = [];

    if (message.trim()) {
      const notePath = `${bundleId}/thank-you-note.txt`;
      uploads.push({
        file: new File([message.trim()], 'thank-you-note.txt', { type: 'text/plain' }),
        path: notePath,
      });
      storagePaths.push(notePath);
    }

    const manifest = {
      createdAt: new Date().toISOString(),
      userEmail: userEmail || null,
      message: message.trim(),
      attachments: attachments.map((item) => ({
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
        message: message.trim(),
        storage_bucket: STORAGE_BUCKET,
        storage_paths: storagePaths,
        attachment_meta: attachments.map((item) => ({
          name: item.name,
          kind: item.kind,
          type: item.file.type,
          size: item.file.size,
        })),
      });

      if (submissionError) {
        throw new Error('Could not save your message right now.');
      }

      clearDraft();
      setStatus('Sent successfully.');
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
      <section className="thank-you-modal__panel" role="dialog" aria-modal="true" aria-label="Thank you studio">
        <div className="thank-you-modal__header">
          <div>
            <div className="thank-you-modal__badge">Thank You</div>
            <h2>Leave a note, voice, photo, or video</h2>
            <p>Write something sweet, record a voice note, or attach a moment you want to share.</p>
          </div>
          <button className="thank-you-modal__close" type="button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="thank-you-modal__toolbar">
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={`thank-you-chip ${activeTool === tool.id ? 'is-active' : ''}`}
              onClick={() => setActiveTool(tool.id)}
            >
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
                <p className="thank-you-compose__voice-copy">{cameraMessage}</p>
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

                <div className="thank-you-camera">
                  <video ref={cameraRef} className="thank-you-camera__view" muted playsInline autoPlay />
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

                <button type="button" className="thank-you-link-btn" onClick={stopCamera}>
                  Close
                </button>
              </div>
            ) : null}

            {activeTool === 'upload' ? (
              <div className="thank-you-compose__upload">
                <label className="thank-you-label" htmlFor="thank-you-upload">
                  Upload files
                </label>
                <p className="thank-you-compose__voice-copy">Choose files from your device.</p>
                <label className="thank-you-dropzone" htmlFor="thank-you-upload">
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

            <div className="thank-you-compose__meta">
              <span className="thank-you-compose__pill">{userEmail || 'Guest'}</span>
              <span className="thank-you-compose__pill">Ready to send</span>
            </div>

            <div className="thank-you-attachments">
              {attachments.length ? (
                attachments.map((item) => (
                  <article className="thank-you-attachment" key={item.id}>
                    <button
                      type="button"
                      className="thank-you-attachment__remove"
                      onClick={() => removeAttachment(item.id)}
                      aria-label={`Remove ${item.name}`}
                    >
                      ×
                    </button>

                    {item.kind === 'image' ? (
                      <img src={item.previewUrl} alt={item.name} className="thank-you-attachment__preview" />
                    ) : item.kind === 'video' ? (
                      <video src={item.previewUrl} className="thank-you-attachment__preview" controls playsInline />
                    ) : item.kind === 'audio' ? (
                      <audio src={item.previewUrl} className="thank-you-attachment__audio" controls />
                    ) : (
                      <div className="thank-you-attachment__file">File</div>
                    )}

                    <div className="thank-you-attachment__meta">
                      <span>{item.kind}</span>
                      <strong>{item.name}</strong>
                    </div>
                  </article>
                ))
              ) : (
                <div className="thank-you-empty">
                  <span>Nothing attached yet.</span>
                  <p>Add a voice note, photo, video, or file when you’re ready.</p>
                </div>
              )}
            </div>
          </section>

          <aside className="thank-you-tool">
            {activeTool === 'text' ? (
              <div className="thank-you-tool__panel">
                <h3>Text mode</h3>
                <p>Type your message in the left panel.</p>
              </div>
            ) : null}

            {activeTool === 'voice' ? (
              <div className="thank-you-tool__panel">
                <h3>Voice mode</h3>
                <p>Your recorder is on the left.</p>
              </div>
            ) : null}

            {activeTool === 'camera' ? (
              <div className="thank-you-tool__panel">
                <h3>Camera mode</h3>
                <p>Open the camera from the left panel and capture a photo or clip.</p>
              </div>
            ) : null}

            {activeTool === 'upload' ? (
              <div className="thank-you-tool__panel">
                <h3>Upload files</h3>
                <p>Your files go in the left panel.</p>
              </div>
            ) : null}
          </aside>
        </div>

        {status || error ? (
          <div className={`thank-you-feedback ${error ? 'is-error' : ''}`}>
            {status || error}
          </div>
        ) : null}

        <div className="thank-you-modal__footer">
          <button type="button" className="thank-you-ghost-btn" onClick={clearDraft}>
            Clear Draft
          </button>
          <button type="button" className="thank-you-submit-btn" onClick={handleSend} disabled={uploading || !open}>
            {uploading ? 'Sending...' : 'Send it...'}
          </button>
        </div>
      </section>
    </div>
  );
}
