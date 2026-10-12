const $ = (id) => document.getElementById(id);
let streaming = false,
  busy = false,
  online = false,
  cameraReady = false,
  setupAccess = false,
  scanning = false,
  scanAttempted = false,
  saving = false,
  restarting = false,
  statusPending = false;
let networkChoices = [];
const collectedNetworks = new Map();
const signalLabel = (rssi) =>
  rssi >= -55 ? 'Strong' : rssi >= -67 ? 'Good' : rssi >= -75 ? 'Fair' : 'Weak';
function syncControls() {
  $('capture').disabled = !online || !cameraReady || busy || restarting;
  $('fullscreen').disabled = !streaming;
  $('rescan').disabled = scanning || saving || restarting || !online;
  $('download-csv').disabled = collectedNetworks.size === 0;
  $('save-wifi').disabled = saving || restarting || !setupAccess;
}
function stop() {
  streaming = false;
  $('stream').removeAttribute('src');
  $('stream').hidden = true;
  $('placeholder').hidden = false;
  $('toggle').textContent = 'Start stream';
  syncControls();
}
$('toggle').onclick = () => {
  if (streaming) {
    stop();
    $('message').textContent = 'Stream paused.';
    return;
  }
  streaming = true;
  $('toggle').textContent = 'Stop stream';
  $('stream').hidden = false;
  $('placeholder').hidden = true;
  const url = new URL('/stream', location.href);
  url.port = '81';
  url.searchParams.set('t', Date.now());
  $('stream').src = url.href;
  syncControls();
  $('message').textContent = 'Streaming. Save a photo whenever you like.';
};
$('stream').onerror = () => {
  stop();
  $('message').textContent = 'Stream disconnected. Check the connection and try again.';
};
$('fullscreen').hidden = !document.fullscreenEnabled;
$('fullscreen').onclick = async () => {
  try {
    await $('viewport').requestFullscreen();
  } catch {
    $('message').textContent = 'Fullscreen is unavailable in this browser.';
  }
};
$('exit-fullscreen').onclick = () => document.exitFullscreen();
$('capture').onclick = async () => {
  if (busy) return;
  busy = true;
  syncControls();
  $('capture').textContent = 'Saving…';
  try {
    const r = await fetch('/capture', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw Error(await r.text());
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = 'figgy-' + new Date().toISOString().replace(/[:.]/g, '-') + '.jpg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    $('message').textContent = 'Photo saved · ' + new Date().toLocaleTimeString();
  } catch (e) {
    $('message').textContent = 'Could not capture photo: ' + e.message;
  } finally {
    busy = false;
    $('capture').textContent = 'Save photo';
    syncControls();
  }
};
async function status() {
  if (statusPending || restarting || document.hidden) return;
  statusPending = true;
  try {
    const r = await fetch('/status', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw Error();
    const s = await r.json();
    if (restarting) return;
    const wasOnline = online;
    online = true;
    cameraReady = s.camera;
    setupAccess = !!s.setup_access;
    $('badge').textContent = s.camera ? 'Camera ready' : 'Camera unavailable';
    $('toggle').disabled = !s.camera || s.stream === false;
    $('wifi').hidden = !setupAccess;
    $('wifi-summary').textContent = setupAccess ? 'Connect to your Wi-Fi' : 'Wi-Fi networks & CSV';
    $('wifi-intro').textContent = setupAccess
      ? 'Pick a nearby 2.4 GHz network or enter its name below. Scanning may briefly affect live video.'
      : 'Discover nearby 2.4 GHz networks and collect a CSV. Scanning may briefly affect live video.';
    $('toggle').hidden = !!s.detection;
    $('wifi-state').textContent = s.connected
      ? (s.ssid || 'Connected') + (typeof s.rssi === 'number' ? ' · ' + signalLabel(s.rssi) : '')
      : 'Setup network';
    $('device-ip').textContent = setupAccess ? '192.168.4.1' : s.ip;
    $('network').textContent = setupAccess ? 'Setup network · 192.168.4.1' : 'Connected · ' + s.ip;
    if (!s.camera) {
      stop();
      $('viewtitle').textContent = 'Camera needs attention.';
      $('viewhint').textContent = 'Check the ribbon cable and board model.';
      $('message').textContent =
        'Camera initialization failed. See USB serial output for the error.';
    } else if (s.detection) {
      $('viewtitle').textContent = 'Ready for object detection.';
      $('viewhint').textContent = 'Run the 002 detector on your computer to see labels and boxes.';
      if (!busy)
        $('message').textContent =
          '002 · Snapshot mode. Wi-Fi setup and Save photo are available here.';
    } else if (s.stream === false) {
      stop();
      $('message').textContent =
        'Video server unavailable. Still photos work; restart the device to retry video.';
    } else {
      $('viewtitle').textContent = 'Ready when you are.';
      $('viewhint').textContent = 'Start the stream to see what’s happening.';
      if (!wasOnline) $('message').textContent = 'Ready. Start a stream or save a photo.';
    }
    syncControls();
    if (setupAccess && !scanAttempted) {
      $('settings').open = true;
      scanNetworks();
    }
  } catch {
    if (restarting) return;
    online = false;
    setupAccess = false;
    stop();
    $('badge').textContent = 'Offline';
    $('wifi-state').textContent = 'Disconnected';
    $('device-ip').textContent = '—';
    $('network').textContent = 'Device unreachable';
    $('toggle').disabled = true;
    $('message').textContent =
      'Cannot reach the camera. Reconnect to its network; this page will retry automatically.';
    syncControls();
  } finally {
    statusPending = false;
  }
}
function renderNetworks(items) {
  const unique = new Map();
  items
    .filter((n) => n.ssid)
    .sort((a, b) => b.rssi - a.rssi)
    .forEach((n) => {
      if (!unique.has(n.ssid)) unique.set(n.ssid, n);
    });
  networkChoices = [...unique.values()];
  $('networks').replaceChildren();
  networkChoices.forEach((n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'network-choice';
    b.disabled = !setupAccess;
    b.setAttribute('aria-pressed', String($('ssid').value === n.ssid));
    const name = document.createElement('span');
    name.textContent = n.ssid;
    const info = document.createElement('small');
    info.textContent =
      signalLabel(n.rssi) +
      ' · ' +
      (n.security || (n.open ? 'Open' : 'Secured')) +
      (n.channel ? ' · Ch ' + n.channel : '');
    b.append(name, info);
    b.onclick = () => {
      if (saving || restarting) return;
      if ($('ssid').value !== n.ssid) $('password').value = '';
      $('ssid').value = n.ssid;
      $('password-help').textContent = n.open
        ? 'Open network. No password is needed.'
        : 'Enter the password for ' + n.ssid + '.';
      renderNetworks(networkChoices);
      $('password').focus();
    };
    $('networks').append(b);
  });
  $('scan-status').textContent = networkChoices.length
    ? networkChoices.length +
      ' network' +
      (networkChoices.length === 1 ? '' : 's') +
      ' found.' +
      (setupAccess ? ' Select yours below.' : '')
    : 'No named networks found. Try scanning again or enter a hidden network below.';
}
$('ssid').oninput = () => {
  $('password-help').textContent = 'Leave blank only for an open network.';
  for (const b of $('networks').children) b.setAttribute('aria-pressed', 'false');
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function scanNetworks() {
  if (scanning || saving || restarting || !online) return;
  scanning = true;
  scanAttempted = true;
  syncControls();
  $('scan-status').textContent = 'Looking for nearby 2.4 GHz networks…';
  try {
    let r = await fetch('/wifi/scan', {
      method: 'POST',
      headers: { 'X-Figgy-Setup': '1' },
      signal: AbortSignal.timeout(5000),
    });
    for (let attempt = 0; attempt < 20; attempt++) {
      if (r.status === 202) {
        await pause(750);
        r = await fetch('/wifi/scan', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
        continue;
      }
      if (!r.ok) throw Error(await r.text());
      const result = await r.json();
      collectNetworks(result.networks);
      renderNetworks(result.networks);
      return;
    }
    throw Error('Scan timed out. Try again.');
  } catch (e) {
    $('scan-status').textContent =
      'Could not scan. ' + e.message + ' You can still enter the network name manually.';
  } finally {
    scanning = false;
    syncControls();
  }
}
function collectNetworks(networks) {
  const seen = new Date().toISOString();
  for (const n of networks) {
    const key = n.bssid || n.ssid + '|' + n.channel;
    const previous = collectedNetworks.get(key);
    collectedNetworks.delete(key);
    collectedNetworks.set(key, {
      ...n,
      firstSeen: previous ? previous.firstSeen : seen,
      lastSeen: seen,
    });
    if (collectedNetworks.size > 256)
      collectedNetworks.delete(collectedNetworks.keys().next().value);
  }
  $('collection-status').textContent =
    collectedNetworks.size +
    ' access point' +
    (collectedNetworks.size === 1 ? '' : 's') +
    ' collected this visit.';
  syncControls();
}
function csvCell(value) {
  // SSIDs are untrusted text. Quote cells and neutralize spreadsheet formulas.
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]|^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
function networkCsv() {
  const rows = [
    ['SSID', 'BSSID', 'Channel', 'Security', 'RSSI (dBm)', 'First seen (UTC)', 'Last seen (UTC)'],
  ];
  for (const n of collectedNetworks.values())
    rows.push([n.ssid, n.bssid, n.channel, n.security, n.rssi, n.firstSeen, n.lastSeen]);
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row.map((v, i) => (i === 4 && typeof v === 'number' ? String(v) : csvCell(v))).join(','),
      )
      .join('\r\n') +
    '\r\n'
  );
}
$('download-csv').onclick = () => {
  if (!collectedNetworks.size) return;
  const url = URL.createObjectURL(new Blob([networkCsv()], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'figgy-networks-' + new Date().toISOString().replace(/[:.]/g, '-') + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
};
$('rescan').onclick = scanNetworks;
$('settings').ontoggle = () => {
  if ($('settings').open && !scanAttempted) scanNetworks();
};
$('show-password').onclick = () => {
  const show = $('password').type === 'password';
  $('password').type = show ? 'text' : 'password';
  $('show-password').textContent = show ? 'Hide' : 'Show';
  $('show-password').setAttribute('aria-pressed', String(show));
};
$('wifi').onsubmit = async (e) => {
  e.preventDefault();
  if (saving || restarting || !setupAccess) return;
  const ssid = $('ssid').value,
    password = $('password').value;
  const bytes = (s) => new TextEncoder().encode(s).length;
  if (bytes(ssid) < 1 || bytes(ssid) > 32) {
    $('wifi-message').textContent =
      'Network names must be 1–32 bytes. Check the name and try again.';
    return;
  }
  if (password && (bytes(password) < 8 || bytes(password) > 63)) {
    $('wifi-message').textContent = 'Passwords must be 8–63 bytes, or blank for an open network.';
    return;
  }
  saving = true;
  syncControls();
  $('save-wifi').textContent = 'Saving…';
  $('wifi-message').textContent = 'Saving your Wi-Fi settings…';
  try {
    const r = await fetch('/wifi', {
      method: 'POST',
      headers: { 'X-Figgy-Setup': '1' },
      body: new URLSearchParams({ ssid, password }),
      signal: AbortSignal.timeout(8000),
    });
    const text = await r.text();
    if (!r.ok) throw Error(text);
    restarting = true;
    stop();
    $('toggle').disabled = true;
    $('badge').textContent = 'Restarting…';
    $('wifi-message').textContent = text;
    $('password').value = '';
    $('password').type = 'password';
    $('show-password').textContent = 'Show';
    $('show-password').setAttribute('aria-pressed', 'false');
    $('save-wifi').textContent = 'Saved · restarting';
    $('message').textContent = 'Wi-Fi saved. Follow the steps below to reconnect.';
  } catch (err) {
    $('wifi-message').textContent =
      'Could not confirm the save. ' +
      err.message +
      ' If the device restarted, reconnect to your Wi-Fi and open gettin-figgy.local.';
  } finally {
    saving = false;
    if (!restarting) $('save-wifi').textContent = 'Save and restart';
    syncControls();
  }
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop();
  else status();
});
status();
setInterval(status, 8000);
