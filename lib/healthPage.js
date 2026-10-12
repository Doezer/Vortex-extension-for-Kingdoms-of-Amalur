'use strict';

const { runHealthChecks } = require('./health');

function createHealthPage(checks, api) {
  return function AmalurHealthChecks({ active }) {
    const React = require('react'); // Provided by Vortex; never bundled with the extension.
    const h = React.createElement;
    const [rows, setRows] = React.useState([]);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');
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
      if (active !== false) refresh();
      const rescan = () => { if (active !== false) refresh(); };
      api.events.on('amalur-health-refresh', rescan);
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
    const section = (optional, title) => h('section', { key: title },
      h('h3', null, title),
      ...rows.filter(({ check }) => check.optional === optional).map(({ check, result }) => h('article', {
        key: check.id,
        style: { padding: '16px', marginBottom: '12px', border: '1px solid currentColor', borderRadius: '4px' },
      },
      h('h4', null, check.name),
      h('p', { role: 'status' }, result.message),
      h('p', null, result.details),
      result.status !== 'passed' && h('button', {
        type: 'button', className: 'btn btn-default', onClick: () => openPage(check),
      }, `Open ${check.name} page`))),
    );

    return h('div', { style: { padding: '20px', overflowY: 'auto', height: '100%' } },
      h('h2', null, 'Amalur health checks'),
      h('p', null, 'Check the framework runtime and review optional tools and mods. Optional suggestions do not block modding.'),
      h('button', { type: 'button', className: 'btn btn-default', disabled: busy, onClick: refresh }, busy ? 'Checking…' : 'Refresh checks'),
      error && h('p', { role: 'alert' }, error),
      section(false, 'Required for framework mods'),
      section(true, 'Optional suggestions'),
    );
  };
}

module.exports = { createHealthPage };
