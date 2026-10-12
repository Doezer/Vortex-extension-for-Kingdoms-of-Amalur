'use strict';

const { runHealthChecks } = require('./health');

const descriptions = {
  'amalur-health-framework': 'Required to load framework mods, including KOA Reforged.',
  'amalur-health-save-editor': 'Edit characters and inventory with the remaster Save Editor.',
  'amalur-health-f2-console': 'Open an in-game Lua console. Requires Mod Framework.',
  'amalur-health-no-logos': 'Skip the startup logos.',
};
const styles = {
  page: { color: 'var(--color-neutral-strong, #e5e5e5)', fontSize: 14, fontWeight: 400, lineHeight: 1.5 },
  content: { padding: 24, maxWidth: 1000, width: '100%', boxSizing: 'border-box' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 },
  title: { color: 'inherit', fontSize: 24, fontWeight: 600, margin: '0 0 4px' },
  muted: { margin: 0, opacity: 0.75 },
  heading: { color: 'inherit', fontSize: 16, fontWeight: 600, margin: '24px 0 12px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 12 },
  card: { background: 'var(--color-surface-translucent-low, rgba(128,128,128,0.08))', border: '1px solid var(--color-stroke-weak, rgba(128,128,128,0.22))', borderRadius: 8, padding: 20, minWidth: 0 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 },
  name: { color: 'inherit', fontSize: 17, fontWeight: 600, margin: 0 },
  badge: { fontSize: 12, fontWeight: 600, borderRadius: 20, padding: '3px 10px', background: 'rgba(128,128,128,0.15)', whiteSpace: 'nowrap' },
  button: { color: 'inherit', background: 'rgba(128,128,128,0.12)', border: '1px solid rgba(128,128,128,0.35)', borderRadius: 4, padding: '7px 12px', cursor: 'pointer', fontWeight: 500, fontSize: 13 },
};

function createHealthPage(checks, api, MainPage = 'div') {
  return function AmalurEssentials({ active }) {
    const React = require('react'); // Vortex supplies React; never bundle it.
    const h = React.createElement;
    const [rows, setRows] = React.useState([]);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');
    const [downloading, setDownloading] = React.useState('');
    const [message, setMessage] = React.useState('');
    const pendingDownload = React.useRef(false);
    const request = React.useRef(0);
    const mounted = React.useRef(false);

    const refresh = React.useCallback(async () => {
      const current = ++request.current;
      setBusy(true);
      setError('');
      try {
        const results = await runHealthChecks(checks, api);
        if (mounted.current && current === request.current) setRows(results);
      } catch (failure) {
        if (mounted.current && current === request.current) setError(failure.message);
      } finally {
        if (mounted.current && current === request.current) setBusy(false);
      }
    }, []);

    React.useEffect(() => {
      mounted.current = true;
      // Hidden legacy pages stay mounted. Subscribe only while this page is active.
      if (active !== false) refresh();
      const rescan = () => { refresh(); };
      if (active !== false) api.events.on('amalur-health-refresh', rescan);
      return () => {
        mounted.current = false;
        request.current += 1;
        api.events.removeListener('amalur-health-refresh', rescan);
      };
    }, [active, refresh]);

    const openPage = async (check) => {
      try { await check.fix(api); }
      catch (failure) { if (mounted.current) setError(failure.message); }
    };
    const download = async (check, downloadId) => {
      if (pendingDownload.current) return;
      pendingDownload.current = true;
      setDownloading(check.id);
      setError('');
      setMessage('');
      try {
        const id = downloadId ? await check.installDownloaded(downloadId) : await check.download(api);
        if (id && mounted.current) setMessage(check.standaloneInstall
          ? 'Save Editor installed in tools/KoAR.SaveEditor and linked in Dashboard > Tools.'
          : check.modId === 8
          ? 'Save Editor downloaded. Extract its complete archive to tools/KoAR.SaveEditor in the game folder, then configure it in Dashboard > Tools.'
          : `${check.name} downloaded. Install it from Downloads, enable it, and deploy your mods.`);
      } catch (failure) {
        if (mounted.current && !['UserCanceled', 'ProcessCanceled'].includes(failure.name)) setError(failure.message);
      } finally {
        pendingDownload.current = false;
        if (mounted.current) setDownloading('');
      }
    };
    const section = (optional, title) => h('section', { key: title, 'aria-label': title },
      h('h3', { style: styles.heading }, title),
      optional && h('p', { style: { ...styles.muted, marginBottom: 12 } }, 'These additions are optional and do not block modding.'),
      h('div', { style: optional ? styles.grid : undefined },
        ...rows.filter(({ check }) => check.optional === optional).map(({ check, result }) => {
          const passed = result.status === 'passed';
          const failed = result.status === 'failed' || result.status === 'error';
          const label = passed ? 'Ready' : failed ? 'Needs attention' : optional ? 'Optional' : 'Check setup';
          return h('article', { key: check.id, style: styles.card },
            h('div', { style: styles.row },
              h('h4', { style: styles.name }, check.name),
              h('span', { style: { ...styles.badge, ...(passed ? { color: 'var(--color-success-strong, #80cfa0)', background: 'rgba(64,160,96,0.12)' } : failed ? { color: 'var(--color-warning-strong, #f3bb72)', background: 'rgba(220,150,60,0.12)' } : {}) } }, label)),
            h('p', { style: styles.muted }, descriptions[check.id] || check.description),
            h('p', { role: 'status', style: { margin: '12px 0', fontSize: 13 } }, result.message),
            !passed && h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
              h('button', { type: 'button', style: styles.button, disabled: Boolean(downloading), onClick: () => download(check), 'aria-label': `Download ${check.name} with Vortex` }, downloading === check.id ? (check.standaloneInstall ? 'Installing…' : 'Downloading…') : check.standaloneInstall ? 'Download & install' : 'Download with Vortex'),
              check.installDownloaded && result.metadata?.downloadId && h('button', { type: 'button', style: styles.button, disabled: Boolean(downloading), onClick: () => download(check, result.metadata.downloadId), 'aria-label': 'Install downloaded Save Editor' }, 'Install downloaded copy'),
              h('button', { type: 'button', style: { ...styles.button, background: 'transparent', borderColor: 'transparent' }, onClick: () => openPage(check), 'aria-label': `Open ${check.name} page` }, 'Mod page')),
            result.details && h('details', { style: { marginTop: 12, fontSize: 12, opacity: 0.8 } },
              h('summary', { style: { cursor: 'pointer' } }, 'Details'),
              h('p', { style: { margin: '8px 0 0', overflowWrap: 'anywhere' } }, result.details)));
        })),
    );

    return h(MainPage, null,
      h(MainPage.Body || 'div', { style: { ...styles.page, overflowY: 'auto', minHeight: 0 } },
        h('div', { style: styles.content, 'aria-busy': busy },
          h('div', { style: styles.header },
            h('div', null, h('h2', { style: styles.title }, 'Amalur Essentials'), h('p', { style: styles.muted }, 'Your modding setup at a glance.')),
            h('button', { type: 'button', style: styles.button, disabled: busy, onClick: refresh }, busy ? 'Checking…' : 'Refresh status')),
          error && h('p', { role: 'alert' }, error),
          message && h('p', { role: 'status' }, message),
          rows.length === 0 && h('p', { role: 'status' }, busy ? 'Checking your setup…' : 'Open this page to check your setup.'),
          rows.length > 0 && section(false, 'Mod framework'),
          rows.length > 0 && section(true, 'Optional tools and mods'))));
  };
}

module.exports = { createHealthPage };
