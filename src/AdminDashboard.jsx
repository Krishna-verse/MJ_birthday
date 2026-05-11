import { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';

const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_THANKYOU_BUCKET || 'thank-you-uploads';
const SUBMISSIONS_TABLE = 'thank_you_submissions';

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const sizeFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});

const isPreviewableImage = (type = '', path = '') =>
  type.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(path);

const isPreviewableVideo = (type = '', path = '') =>
  type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(path);

const isPreviewableAudio = (type = '', path = '') =>
  type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|webm)$/i.test(path);

const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 KB';

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${sizeFormatter.format(value)} ${units[unitIndex]}`;
};

const normalizeEmail = (value = '') => value.trim().toLowerCase();

const getSubmissionLabel = (row) => {
  const labels = [];
  const attachmentCount = row.attachment_meta?.length || 0;

  if (row.message?.trim()) labels.push('Text');
  if (attachmentCount) labels.push(`${attachmentCount} file${attachmentCount === 1 ? '' : 's'}`);

  return labels.length ? labels.join(' / ') : 'No attachments';
};

const getAttachmentPaths = (row) =>
  (row.storage_paths || []).filter(
    (path) => !path.endsWith('/manifest.json') && !path.endsWith('/thank-you-note.txt')
  );

const getSubmissionTime = (row) => (row.created_at ? new Date(row.created_at).getTime() : 0);

const getOwnerKey = (row) => normalizeEmail(row.user_email) || 'guest';

const getOwnerLabel = (row) => row.user_email?.trim() || 'Guest submissions';

const getRowSearchText = (row) =>
  [
    row.user_email,
    row.bundle_id,
    row.message,
    ...(row.attachment_meta || []).map((attachment) => attachment.name),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const buildSubmission = (row) => {
  const attachmentPaths = getAttachmentPaths(row);
  const attachmentItems = (row.attachment_meta || []).map((item, index) => ({
    ...item,
    path: attachmentPaths[index],
  }));

  return {
    ...row,
    attachmentItems,
    attachmentPaths,
    hasMessage: Boolean(row.message?.trim()),
    hasMedia: attachmentItems.length > 0,
    searchText: getRowSearchText(row),
  };
};

async function buildSignedUrlMap(rows) {
  if (!supabase) {
    return {};
  }

  const paths = Array.from(new Set(rows.flatMap((row) => row.attachmentPaths || []).filter(Boolean)));

  const entries = await Promise.all(
    paths.map(async (path) => {
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, 60 * 60);

      if (error || !data?.signedUrl) {
        return [path, null];
      }

      return [path, data.signedUrl];
    })
  );

  return Object.fromEntries(entries);
}

async function fetchSubmissions() {
  const { data, error } = await supabase
    .from(SUBMISSIONS_TABLE)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

function SubmissionAsset({ item, signedUrl }) {
  if (!signedUrl) {
    return (
      <div className="admin-asset admin-asset--fallback">
        <span className="admin-asset__icon">File</span>
        <strong>{item.name || 'Attachment'}</strong>
        <small>Preview unavailable</small>
      </div>
    );
  }

  if (isPreviewableImage(item.type, item.path)) {
    return <img className="admin-asset__media" src={signedUrl} alt={item.name || 'Uploaded image'} />;
  }

  if (isPreviewableVideo(item.type, item.path)) {
    return <video className="admin-asset__media" src={signedUrl} controls playsInline />;
  }

  if (isPreviewableAudio(item.type, item.path)) {
    return <audio className="admin-asset__audio" src={signedUrl} controls />;
  }

  return (
    <a className="admin-asset admin-asset--file" href={signedUrl} target="_blank" rel="noreferrer">
      <span className="admin-asset__icon">Open</span>
      <strong>{item.name || 'Open file'}</strong>
      <small>{item.kind || item.type || 'File'}</small>
    </a>
  );
}

function buildGroups(rows, query, filterMode) {
  const search = query.trim().toLowerCase();
  const filteredRows = rows.filter((item) => {
    if (filterMode === 'text' && !item.hasMessage) return false;
    if (filterMode === 'media' && !item.hasMedia) return false;
    if (filterMode === 'empty' && (item.hasMessage || item.hasMedia)) return false;
    if (search && !item.searchText.includes(search)) return false;
    return true;
  });

  const groups = new Map();

  filteredRows.forEach((row) => {
    const key = getOwnerKey(row);
    const label = getOwnerLabel(row);

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label,
        isGuest: key === 'guest',
        items: [],
        lastActivity: 0,
        textCount: 0,
        mediaCount: 0,
        fileCount: 0,
      });
    }

    const group = groups.get(key);
    group.items.push(row);
    group.lastActivity = Math.max(group.lastActivity, getSubmissionTime(row));
    group.textCount += row.hasMessage ? 1 : 0;
    group.mediaCount += row.hasMedia ? 1 : 0;
    group.fileCount += row.attachmentItems.length;
  });

  return Array.from(groups.values())
    .sort((a, b) => b.lastActivity - a.lastActivity || a.label.localeCompare(b.label))
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => getSubmissionTime(b) - getSubmissionTime(a)),
    }));
}

function GroupSubmissionCard({ row, signedUrls }) {
  return (
    <article className="admin-submission admin-submission--compact" key={row.id || row.bundle_id}>
      <div className="admin-submission__header">
        <div>
          <span className="admin-submission__badge">{getSubmissionLabel(row)}</span>
          <h3>Bundle {row.bundle_id}</h3>
          <p>{row.created_at ? timeFormatter.format(new Date(row.created_at)) : 'Recently sent'}</p>
        </div>

        <div className="admin-submission__id">
          <span>Storage</span>
          <strong>{row.storage_bucket || STORAGE_BUCKET}</strong>
        </div>
      </div>

      <div className="admin-message">
        <span className="admin-message__label">Message</span>
        <p>{row.message?.trim() || 'No text note was included with this submission.'}</p>
      </div>

      <div className="admin-submission__files">
        {row.attachmentItems.length ? (
          row.attachmentItems.map((item) => (
            <div className="admin-attachment" key={`${row.id || row.bundle_id}-${item.path || item.name}`}>
              <SubmissionAsset item={item} signedUrl={item.path ? signedUrls[item.path] : null} />
              <div className="admin-attachment__meta">
                <strong>{item.name || 'Attachment'}</strong>
                <span>
                  {item.kind || 'file'} / {item.type || 'unknown'} / {formatBytes(item.size)}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="admin-submission__empty">
            <span>No media files attached</span>
            <p>This submission contains only text, so there is nothing to preview here.</p>
          </div>
        )}
      </div>
    </article>
  );
}

export default function AdminDashboard({ onSignOut, onBackHome, userEmail }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [signedUrls, setSignedUrls] = useState({});
  const [lastUpdated, setLastUpdated] = useState('');
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!supabase) {
        if (mounted) {
          setLoading(false);
          setError('Supabase is not configured.');
        }
        return;
      }

      setError('');
      setLoading(true);

      try {
        const rows = (await fetchSubmissions()).map(buildSubmission);

        if (!mounted) {
          return;
        }

        setSubmissions(rows);
        setLastUpdated(new Date().toLocaleString());
        setSignedUrls(await buildSignedUrlMap(rows));
      } catch (fetchError) {
        if (!mounted) {
          return;
        }

        setSubmissions([]);
        setSignedUrls({});
        setError(fetchError?.message || 'Could not load submissions.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load().catch(() => {
      if (mounted) {
        setError('Could not load the inbox.');
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const visibleGroups = useMemo(() => buildGroups(submissions, query, filterMode), [submissions, query, filterMode]);

  const stats = useMemo(() => {
    const total = submissions.length;
    const withMessage = submissions.filter((item) => item.hasMessage).length;
    const withMedia = submissions.filter((item) => item.hasMedia).length;
    const files = submissions.reduce((count, item) => count + item.attachmentItems.length, 0);
    const senders = new Set(submissions.map((item) => getOwnerKey(item))).size;

    return [
      { label: 'Senders', value: senders, note: 'Unique email groups' },
      { label: 'Submissions', value: total, note: 'All thank-you entries' },
      { label: 'With text', value: withMessage, note: 'Written notes' },
      { label: 'Files stored', value: files, note: 'Items inside storage' },
      { label: 'With media', value: withMedia, note: 'Voice, photo, or video' },
      { label: 'Groups visible', value: visibleGroups.length, note: 'Matches current filters' },
    ];
  }, [submissions, visibleGroups.length]);

  const filterTabs = [
    { id: 'all', label: `All (${submissions.length})` },
    { id: 'text', label: `Text (${submissions.filter((item) => item.hasMessage).length})` },
    { id: 'media', label: `Media (${submissions.filter((item) => item.hasMedia).length})` },
    {
      id: 'empty',
      label: `Empty (${submissions.filter((item) => !item.hasMessage && !item.hasMedia).length})`,
    },
  ];

  const refreshInbox = async () => {
    if (refreshing) return;
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }

    setRefreshing(true);
    setError('');

    try {
      const rows = (await fetchSubmissions()).map(buildSubmission);
      setSubmissions(rows);
      setLastUpdated(new Date().toLocaleString());
      setSignedUrls(await buildSignedUrlMap(rows));
    } catch (fetchError) {
      setError(fetchError?.message || 'Could not refresh the inbox.');
    } finally {
      setRefreshing(false);
    }
  };

  const visibleCount = visibleGroups.reduce((count, group) => count + group.items.length, 0);

  return (
    <div className="admin-shell">
      <div className="admin-shell__backdrop" />

      <header className="admin-topbar">
        <div>
          <div className="admin-topbar__badge">Admin inbox</div>
          <h1>Thank-you submissions</h1>
          <p>Everything uploaded from the thank-you studio appears here, grouped by sender so each user stays separate.</p>
        </div>

        <div className="admin-topbar__actions">
          <button className="admin-topbar__button" type="button" onClick={refreshInbox} disabled={refreshing || loading}>
            {refreshing ? 'Refreshing...' : 'Refresh inbox'}
          </button>
          {onBackHome ? (
            <button className="admin-topbar__button admin-topbar__button--ghost" type="button" onClick={onBackHome}>
              Back to birthday
            </button>
          ) : null}
          <button className="admin-topbar__button admin-topbar__button--ghost" type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <section className="admin-hero">
        <div className="admin-hero__copy">
          <span className="admin-hero__eyebrow">Logged in as {userEmail || 'admin'}</span>
          <h2>Review every note, voice memo, photo, and clip by sender.</h2>
          <p>
            This dashboard keeps the inbox calm: recent users first, each sender in their own lane, and every bundle
            still easy to open when you need the details.
          </p>

          <div className="admin-hero__controls">
            <label className="admin-search">
              <span>Search</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search email, bundle, note, or file"
              />
            </label>

            <div className="admin-filters" role="tablist" aria-label="Submission filters">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`admin-filter ${filterMode === tab.id ? 'is-active' : ''}`}
                  onClick={() => setFilterMode(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-hero__meta">
            <span className="admin-hero__pill">
              {loading ? 'Loading inbox...' : `${visibleCount} visible / ${submissions.length} total`}
            </span>
            <span className="admin-hero__pill admin-hero__pill--accent">
              {lastUpdated ? `Updated ${lastUpdated}` : 'Waiting for the first refresh'}
            </span>
          </div>
        </div>

        <div className="admin-hero__card">
          {stats.map((stat) => (
            <div className="admin-stat" key={stat.label}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
              <small>{stat.note}</small>
            </div>
          ))}
        </div>
      </section>

      {error ? <div className="admin-banner admin-banner--error">{error}</div> : null}

      <section className="admin-grid">
        {loading ? (
          <div className="admin-empty admin-empty--loading">
            <div className="admin-empty__orb" />
            <h3>Loading the inbox</h3>
            <p>Gathering the latest thank-you submissions and file previews.</p>
          </div>
        ) : visibleGroups.length ? (
          <div className="admin-user-groups">
            {visibleGroups.map((group) => (
              <article className="admin-user-group" key={group.key}>
                <div className="admin-user-group__header">
                  <div className="admin-user-group__heading">
                    <span className="admin-user-group__badge">{group.isGuest ? 'Guest lane' : 'User lane'}</span>
                    <h3>{group.label}</h3>
                    <p>
                      {group.items.length} submission{group.items.length === 1 ? '' : 's'}
                      {' | '}
                      {group.fileCount} file{group.fileCount === 1 ? '' : 's'} attached
                    </p>
                  </div>

                  <div className="admin-user-group__meta">
                    <span className="admin-user-group__pill">{group.textCount} text note{group.textCount === 1 ? '' : 's'}</span>
                    <span className="admin-user-group__pill">{group.mediaCount} media post{group.mediaCount === 1 ? '' : 's'}</span>
                    <span className="admin-user-group__pill admin-user-group__pill--accent">
                      {group.lastActivity ? `Last sent ${timeFormatter.format(new Date(group.lastActivity))}` : 'Recent activity'}
                    </span>
                  </div>
                </div>

                <div className="admin-user-group__submissions">
                  {group.items.map((row) => (
                    <GroupSubmissionCard
                      key={row.id || row.bundle_id}
                      row={row}
                      signedUrls={signedUrls}
                    />
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="admin-empty">
            <div className="admin-empty__orb" />
            <h3>{query || filterMode !== 'all' ? 'No matches found' : 'No submissions yet'}</h3>
            <p>
              {query || filterMode !== 'all'
                ? 'Try clearing the search or changing the filter to bring results back.'
                : 'Once someone sends a thank-you note, the content will appear here automatically.'}
            </p>
          </div>
        )}
      </section>

      <footer className="admin-dock">
        <div className="admin-dock__copy">
          <strong>Live review mode</strong>
          <span>Use refresh to pull the latest uploads. New items appear at the top.</span>
        </div>
        <div className="admin-dock__actions">
          <button className="admin-dock__button" type="button" onClick={refreshInbox} disabled={refreshing || loading}>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="admin-dock__button admin-dock__button--ghost" type="button" onClick={onSignOut}>
            Back out
          </button>
        </div>
      </footer>
    </div>
  );
}
