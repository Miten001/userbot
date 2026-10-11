/*!
 * GhostShell Shield — ISOLATED world bridge.
 *
 * The MAIN-world script has no access to chrome.storage, so it asks us for
 * the config. We reply as soon as storage resolves (a few ms); the MAIN
 * world has already installed safe defaults by then, so nothing is exposed
 * in the meantime.
 */
(() => {
  'use strict';
  if (window.__ghostshellBridge) return;
  window.__ghostshellBridge = true;

  let replied = false;

  const send = (config) => {
    if (replied) return;
    replied = true;
    window.postMessage({ __ghostshell: true, type: 'config', config }, '*');
  };

  window.addEventListener('message', (ev) => {
    if (!ev || ev.source !== window) return;
    const d = ev.data;
    if (d && d.__ghostshell && d.type === 'ready') {
      try {
        chrome.storage.local.get('config', (res) => {
          send(res && res.config ? res.config : null);
        });
      } catch (e) {
        send(null);
      }
      // Safety net: never leave the page waiting.
      setTimeout(() => send(null), 1500);
    }
  }, false);
})();
