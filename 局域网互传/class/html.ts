// 浏览器端聊天页 HTML（访问 http://<ip>:<port>/ 时返回）
// 内部 JS 全程使用引号拼接，避免反引号/插值与外层模板字符串冲突

export function chatPageHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>文件传输</title>
<style>
  :root{ color-scheme:light dark; --bg:#f5f5f7; --card:rgba(255,255,255,.72); --text:#1d1d1f; --muted:#6e6e73; --line:rgba(60,60,67,.12); --accent:#007aff; --me:#007aff; --metext:#fff; --bubble-other:rgba(255,255,255,.9); --bubble-text-other:#1d1d1f }
  @media (prefers-color-scheme: dark){ :root{ --bg:#0b0d12; --card:rgba(28,30,40,.72); --text:#f5f5f7; --muted:#9a9aa3; --line:rgba(255,255,255,.1); --accent:#3b82f6; --me:#0a84ff; --metext:#fff; --bubble-other:rgba(40,42,52,.9); --bubble-text-other:#f5f5f7 } }
  *{ box-sizing:border-box; -webkit-tap-highlight-color:transparent }
  html,body{ height:100%; margin:0 }
  body{ display:flex; flex-direction:column; height:100dvh; background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC",sans-serif }
  body.dragging::after{ content:"松开发送文件"; position:fixed; inset:12px; z-index:20; display:flex; align-items:center; justify-content:center; border:2px dashed var(--accent); border-radius:22px; background:color-mix(in srgb,var(--bg) 88%,transparent); color:var(--accent); font-size:20px; font-weight:600; pointer-events:none }
  header{ display:flex; align-items:center; gap:8px; padding:14px 16px; padding-top:calc(14px + env(safe-area-inset-top)); border-bottom:1px solid var(--line); background:var(--card); backdrop-filter:blur(20px) saturate(140%); -webkit-backdrop-filter:blur(20px) saturate(140%) }
  header .title{ font-size:17px; font-weight:600; flex:1 }
  .status{ font-size:13px; display:flex; align-items:center; gap:5px }
  .status.on{ color:#34c759 }
  .status.off{ color:var(--muted) }
  main{ flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:14px 14px 24px; display:flex; flex-direction:column; gap:10px }
  .msg{ display:flex; width:100% }
  .msg.me{ justify-content:flex-end }
  .msg.other{ justify-content:flex-start }
  .bubble{ max-width:78%; padding:10px 14px; border-radius:18px; font-size:16px; line-height:1.42; word-break:break-word; white-space:pre-wrap; box-shadow:0 1px 2px rgba(0,0,0,.08) }
  .bubble.text{ background:var(--bubble-other); color:var(--bubble-text-other) }
  .msg.me .bubble.text{ background:var(--me); color:var(--metext) }
  .bubble.clipboard{ display:flex; flex-direction:column; gap:8px; background:var(--bubble-other); color:var(--bubble-text-other) }
  .clipboard-source{ font-size:12px; color:var(--muted) }
  .text-actions{ display:flex; justify-content:flex-end; gap:6px; margin-top:8px }
  .text-action{ border:0; border-radius:10px; padding:6px 12px; background:rgba(120,120,128,.18); color:inherit; font-size:13px; line-height:1.2; text-decoration:none }
  .msg.me .text-action{ background:rgba(255,255,255,.25) }
  .bubble.file{ display:flex; align-items:center; gap:10px; padding:10px 12px; background:var(--bubble-other); color:var(--bubble-text-other) }
  .bubble.file.document{ flex-direction:column; align-items:stretch }
  .file-row{ display:flex; align-items:center; gap:10px }
  .file-row .finame{ flex:1; min-width:0; overflow-wrap:anywhere }
  .file-actions{ display:flex; justify-content:flex-end; gap:6px }
  .file-preview{ max-width:520px; max-height:260px; margin:2px 0 0; padding:10px; overflow:auto; border-radius:10px; background:rgba(120,120,128,.12); font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace; white-space:pre-wrap; word-break:break-word }
  .msg.me .bubble.file{ background:var(--me); color:var(--metext) }
  .bubble.file.image{ flex-direction:column; padding:6px; gap:8px; align-items:stretch }
  .bubble.file.image img{ width:100%; max-width:220px; border-radius:12px; display:block }
  .image-actions{ display:flex; justify-content:flex-end; gap:6px; padding:0 4px 4px }
  .bubble.file .meta{ font-size:12px; opacity:.8; margin-top:4px }
  .ficon{ font-size:22px }
  .finame{ font-weight:500 }
  .fsize{ font-size:12px; opacity:.7 }
  .dlbtn{ text-decoration:none; color:inherit; font-size:13px; padding:6px 12px; border-radius:10px; background:rgba(120,120,128,.18); white-space:nowrap }
  .msg.me .dlbtn{ background:rgba(255,255,255,.25) }
  footer{ display:flex; gap:8px; align-items:center; padding:10px 12px; padding-bottom:calc(10px + env(safe-area-inset-bottom)); border-top:1px solid var(--line); background:var(--card); backdrop-filter:blur(20px) saturate(140%); -webkit-backdrop-filter:blur(20px) saturate(140%) }
  footer input[type="text"]{ flex:1; font-size:16px; padding:10px 14px; border-radius:18px; border:1px solid var(--line); background:transparent; color:var(--text); outline:none }
  footer button{ border:none; background:var(--accent); color:#fff; padding:10px 16px; border-radius:18px; font-size:15px; font-weight:600 }
  footer .icon{ background:transparent; color:var(--accent); padding:8px 10px; font-size:24px; line-height:1 }
  footer .clipboard-icon{ width:28px; height:28px; display:block; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round }
  footer button:active{ opacity:.7 }
  .clipboard-hint{ position:fixed; left:50%; bottom:calc(76px + env(safe-area-inset-bottom)); z-index:9; max-width:calc(100% - 32px); padding:8px 14px; border:1px solid var(--line); border-radius:14px; background:var(--card); color:var(--text); box-shadow:0 5px 20px rgba(0,0,0,.14); backdrop-filter:blur(18px) saturate(140%); -webkit-backdrop-filter:blur(18px) saturate(140%); font-size:13px; text-align:center; white-space:nowrap; opacity:0; transform:translate(-50%,8px); transition:opacity .18s ease,transform .18s ease; pointer-events:none }
  .clipboard-hint.show{ opacity:1; transform:translate(-50%,0) }
  .pair-gate{ position:fixed; inset:0; z-index:10; display:flex; align-items:center; justify-content:center; padding:24px; background:var(--bg) }
  .pair-card{ width:min(100%,360px); padding:26px 22px; border:1px solid var(--line); border-radius:24px; background:var(--card); box-shadow:0 16px 48px rgba(0,0,0,.12); text-align:center }
  .pair-icon{ font-size:42px; margin-bottom:10px }
  .pair-card h1{ margin:0 0 8px; font-size:23px }
  .pair-card p{ margin:0 0 20px; color:var(--muted); font-size:14px; line-height:1.5 }
  .pair-card input[type="text"]{ width:100%; border:1px solid var(--line); border-radius:15px; padding:13px 12px; background:transparent; color:var(--text); font-size:24px; font-weight:600; text-align:center; letter-spacing:.28em; outline:none }
  .pair-card input[type="text"]:focus{ border-color:var(--accent); box-shadow:0 0 0 3px rgba(0,122,255,.14) }
  .remember{ display:flex; align-items:center; justify-content:center; gap:8px; margin-top:14px; color:var(--muted); font-size:14px }
  .remember input{ width:18px; height:18px; accent-color:var(--accent) }
  .pair-card button{ width:100%; margin-top:12px; border:0; border-radius:15px; padding:13px; background:var(--accent); color:#fff; font-size:16px; font-weight:600 }
  .pair-card button:disabled{ opacity:.55 }
  .pair-error{ min-height:20px; margin-top:10px; color:#ff3b30; font-size:13px }
  body.paired .pair-gate{ display:none }
</style>
</head>
<body>
<section id="pairGate" class="pair-gate" aria-label="配对认证">
  <form id="pairForm" class="pair-card">
    <div class="pair-icon">🔐</div>
    <h1>与设备配对</h1>
    <p>请输入 Scripting 设备上显示的 6 位配对码</p>
    <input id="pairInput" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" aria-label="6 位配对码">
    <label class="remember"><input id="rememberInput" type="checkbox"> 信任此浏览器，下次自动连接</label>
    <button id="pairBtn" type="submit">配对</button>
    <div id="pairError" class="pair-error" role="alert"></div>
  </form>
</section>
<header>
  <div class="title">文件传输</div>
  <div id="status" class="status off">● 等待配对…</div>
</header>
<main id="messages"></main>
<div id="clipboardHint" class="clipboard-hint" role="status" aria-live="polite"></div>
<footer>
  <button id="attachBtn" class="icon">+</button>
  <button id="syncClipboardBtn" class="icon" type="button" title="粘贴剪贴板" aria-label="粘贴剪贴板"><svg class="clipboard-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 6.5H6.8A1.8 1.8 0 0 0 5 8.3v10.9A1.8 1.8 0 0 0 6.8 21h7.9a1.8 1.8 0 0 0 1.8-1.8v-1.7"/><path d="M11 3h6.2A1.8 1.8 0 0 1 19 4.8v9.4a1.8 1.8 0 0 1-1.8 1.8H11a1.8 1.8 0 0 1-1.8-1.8V4.8A1.8 1.8 0 0 1 11 3Z"/><path d="M12.2 3V2.6c0-.9.7-1.6 1.6-1.6h.7c.9 0 1.6.7 1.6 1.6V3"/></svg></button>
  <input id="fileInput" type="file" multiple hidden>
  <input id="textInput" type="text" placeholder="说点什么…">
  <button id="sendBtn">发送</button>
</footer>
<script>
var messagesEl = document.getElementById('messages');
var textInput = document.getElementById('textInput');
var sendBtn = document.getElementById('sendBtn');
var attachBtn = document.getElementById('attachBtn');
var syncClipboardBtn = document.getElementById('syncClipboardBtn');
var fileInput = document.getElementById('fileInput');
var statusEl = document.getElementById('status');
var clipboardHintEl = document.getElementById('clipboardHint');
var clipboardHintTimer = 0;
var pairForm = document.getElementById('pairForm');
var pairInput = document.getElementById('pairInput');
var rememberInput = document.getElementById('rememberInput');
var pairBtn = document.getElementById('pairBtn');
var pairError = document.getElementById('pairError');
var authToken = sessionStorage.getItem('lan-transfer-token') || '';
var clientId = sessionStorage.getItem('lan-transfer-client-id') || '';
var resuming = false;
var seenMessageIds = Object.create(null);
var recentClipboardSignatures = Object.create(null);
var recentClipboardOrder = [];

function showClipboardHint(text){
  clipboardHintEl.textContent = text;
  clipboardHintEl.classList.add('show');
  clearTimeout(clipboardHintTimer);
  clipboardHintTimer = setTimeout(function(){ clipboardHintEl.classList.remove('show'); }, 2200);
}

function markNewClipboard(signature){
  if (recentClipboardSignatures[signature]) return false;
  recentClipboardSignatures[signature] = true;
  recentClipboardOrder.push(signature);
  if (recentClipboardOrder.length > 50) delete recentClipboardSignatures[recentClipboardOrder.shift()];
  return true;
}
async function blobSignature(blob){
  var bytes = new Uint8Array(await blob.arrayBuffer());
  var hash = 2166136261;
  for (var i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i], 16777619) >>> 0;
  return 'file:' + (blob.type || '') + ':' + blob.size + ':' + hash;
}

function deviceName(){
  var platform = navigator.userAgentData && navigator.userAgentData.platform;
  return String(platform || navigator.platform || '浏览器').slice(0, 60);
}

function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function fmtSize(b){ b = b || 0; if (b < 1024) return b + ' B'; var u = ['KB','MB','GB','TB']; var i = Math.min(Math.floor(Math.log(b) / Math.log(1024)) - 1, u.length - 1); return (b / Math.pow(1024, i + 1)).toFixed(b >= Math.pow(1024, i + 2) ? 1 : 0) + ' ' + u[i]; }
function isImage(mime){ return String(mime || '').toLowerCase().indexOf('image/') === 0; }
function copyText(text, button){
  function done(){ button.textContent = '已复制'; setTimeout(function(){ button.textContent = '复制'; }, 1200); }
  if (navigator.clipboard && window.isSecureContext){
    navigator.clipboard.writeText(text).then(done).catch(function(){ fallbackCopy(text, done); });
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, done){
  var area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed'; area.style.opacity = '0';
  document.body.appendChild(area); area.focus(); area.select();
  try { if (document.execCommand('copy')) done(); } catch (e){}
  area.remove();
}
async function copyImage(src, button){
  if (!window.isSecureContext || !navigator.clipboard || typeof ClipboardItem === 'undefined'){
    showClipboardHint('请右键图片，选择“复制图像”');
    return;
  }
  try {
    var response = await fetch(src);
    if (!response.ok) throw new Error('图片读取失败');
    var blob = await response.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
    button.textContent = '已复制';
    setTimeout(function(){ button.textContent = imageCopyLabel(); }, 1200);
  } catch (e) {
    showClipboardHint('复制失败，请右键图片选择“复制图像”');
    button.textContent = imageCopyLabel();
  }
}
function imageCopyLabel(){
  return window.isSecureContext && navigator.clipboard && typeof ClipboardItem !== 'undefined' ? '复制图片' : '右键复制';
}
function firstHttpUrl(text){
  var match = String(text || '').match(/https?:\\/\\/[^\\s<>'"]+/i);
  if (!match) return '';
  try { var url = new URL(match[0]); return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : ''; }
  catch (e) { return ''; }
}
function fileExtension(name){ var m = String(name || '').toLowerCase().match(/\\.([a-z0-9]+)$/); return m ? m[1] : ''; }
function isNamedTextFile(name){
  name = String(name || '').toLowerCase().split(/[\\\\/]/).pop();
  return ['license','copying','notice','readme','changelog','authors','contributors','makefile','dockerfile'].indexOf(name) >= 0;
}
function canOpenFile(mime, name){
  mime = String(mime || '').toLowerCase();
  if (mime.indexOf('text/') === 0 || mime.indexOf('audio/') === 0 || mime.indexOf('video/') === 0) return true;
  if (mime === 'application/pdf' || mime.indexOf('json') >= 0 || mime.indexOf('xml') >= 0) return true;
  return isNamedTextFile(name) || ['txt','md','json','xml','csv','log','js','ts','tsx','jsx','css','html','htm','yaml','yml','pdf','mp3','m4a','wav','ogg','mp4','webm','mov'].indexOf(fileExtension(name)) >= 0;
}
function canPreviewText(mime, name, size){
  mime = String(mime || '').toLowerCase();
  var ext = fileExtension(name);
  var textLike = isNamedTextFile(name) || mime.indexOf('text/') === 0 || mime.indexOf('json') >= 0 || mime.indexOf('xml') >= 0 || ['txt','md','json','xml','csv','log','js','ts','tsx','jsx','css','html','htm','yaml','yml'].indexOf(ext) >= 0;
  return textLike && Number(size || 0) <= 512 * 1024;
}
async function toggleFilePreview(m, preview, button){
  if (!preview.hidden){ preview.hidden = true; button.textContent = '预览'; return; }
  if (preview.dataset.loaded === '1'){ preview.hidden = false; button.textContent = '收起'; return; }
  button.textContent = '读取中…';
  try {
    var response = await fetch(m.url || '');
    if (!response.ok) throw new Error('读取失败');
    var text = await response.text();
    preview.textContent = text.slice(0, 50000) + (text.length > 50000 ? '\\n…内容已截断' : '');
    preview.dataset.loaded = '1'; preview.hidden = false; button.textContent = '收起';
  } catch (e) { button.textContent = '预览失败'; setTimeout(function(){ button.textContent = '预览'; }, 1600); }
}
function textActions(text){
  var url = firstHttpUrl(text);
  return '<div class="text-actions"><button class="text-action copy-text" type="button">复制</button>' +
    (url ? '<a class="text-action" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">打开</a>' : '') + '</div>';
}

function addMessage(m){
  var wrap = document.createElement('div');
  wrap.className = 'msg ' + (m.role === 'browser' ? 'me' : 'other');
  var inner = '';
  if (m.kind === 'clipboard'){
    inner = '<div class="bubble clipboard"><div class="clipboard-source">来自 ' + esc(m.deviceName || '其他设备') + '</div><div>' + esc(m.text || '') + '</div>' + textActions(m.text || '') + '</div>';
  } else if (m.kind === 'text'){
    inner = '<div class="bubble text"><div>' + esc(m.text || '') + '</div>' + textActions(m.text || '') + '</div>';
  } else if (isImage(m.mime)){
    inner = '<div class="bubble file image"><img src="' + esc(m.url || '') + '" alt="' + esc(m.fileName || '') + '"><div class="meta">' + esc(m.fileName || '图片') + ' · ' + fmtSize(m.fileSize) + '</div><div class="image-actions"><button class="text-action image-copy" type="button">' + imageCopyLabel() + '</button><a class="text-action" href="' + esc(m.url || '') + '" target="_blank" rel="noopener noreferrer">打开</a><a class="text-action" href="' + esc(m.url || '') + '" download="' + esc(m.fileName || '图片') + '">下载原图</a></div></div>';
  } else {
    var openable = canOpenFile(m.mime, m.fileName);
    var previewable = canPreviewText(m.mime, m.fileName, m.fileSize);
    inner = '<div class="bubble file document"><div class="file-row"><div class="ficon">📎</div><div class="finame">' + esc(m.fileName || '文件') + '</div><div class="fsize">' + fmtSize(m.fileSize) + '</div></div><div class="file-actions">' + (previewable ? '<button class="text-action file-preview-toggle" type="button">预览</button>' : '') + (openable ? '<a class="text-action" href="' + esc(m.url || '') + '" target="_blank" rel="noopener noreferrer">打开</a>' : '') + '<a class="text-action" href="' + esc(m.url || '') + '" download="' + esc(m.fileName || '') + '">下载</a></div>' + (previewable ? '<pre class="file-preview" hidden></pre>' : '') + '</div>';
  }
  wrap.innerHTML = inner;
  var copyBtn = wrap.querySelector('.copy-text');
  if (copyBtn) copyBtn.onclick = function(){ copyText(m.text || '', copyBtn); };
  var imageCopyBtn = wrap.querySelector('.image-copy');
  if (imageCopyBtn) imageCopyBtn.onclick = function(){ copyImage(m.url || '', imageCopyBtn); };
  var previewBtn = wrap.querySelector('.file-preview-toggle');
  var previewEl = wrap.querySelector('.file-preview');
  if (previewBtn && previewEl) previewBtn.onclick = function(){ toggleFilePreview(m, previewEl, previewBtn); };
  messagesEl.appendChild(wrap);
  wrap.scrollIntoView({ behavior: 'smooth' });
}

var ws = null, reconnectTimer = null, heartbeatTimer = null, wsAuthenticated = false;
function stopHeartbeat(){ if (heartbeatTimer){ clearInterval(heartbeatTimer); heartbeatTimer = null; } }
function startHeartbeat(){
  stopHeartbeat();
  heartbeatTimer = setInterval(function(){
    if (wsAuthenticated && ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
  }, 5000);
}
function connect(){
  if (!authToken || !clientId) return;
  wsAuthenticated = false;
  try { ws = new WebSocket((location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host + '/ws'); }
  catch (e){ scheduleReconnect(); return; }
  ws.onopen = function(){ ws.send(JSON.stringify({ type: 'auth', token: authToken, clientId: clientId })); };
  ws.onclose = function(){
    stopHeartbeat();
    var wasAuthenticated = wsAuthenticated;
    wsAuthenticated = false;
    setStatus(false);
    if (wasAuthenticated) scheduleReconnect();
    else resumeTrusted(true);
  };
  ws.onerror = function(){};
  ws.onmessage = function(ev){ handleIncoming(ev.data); };
}
function scheduleReconnect(){ if (!authToken || reconnectTimer) return; reconnectTimer = setTimeout(function(){ reconnectTimer = null; connect(); }, 2000); }
function setStatus(on){ statusEl.textContent = on ? '● 已连接到设备' : '● 正在连接设备…'; statusEl.className = 'status ' + (on ? 'on' : 'off'); }

function handleIncoming(raw){
  var p; try { p = JSON.parse(raw); } catch (e){ return; }
  if (p.type === 'auth_ok'){ wsAuthenticated = true; startHeartbeat(); setStatus(true); }
  else if (p.type === 'auth_error'){
    resumeTrusted(true);
  }
  else if (p.role === 'app' && p.type === 'text'){
    if (p.id && seenMessageIds[p.id]) return;
    if (p.id) seenMessageIds[p.id] = true;
    addMessage({ role: 'app', kind: 'text', text: p.text });
  }
  else if (p.role === 'app' && p.type === 'file'){
    if (p.id && seenMessageIds[p.id]) return;
    if (p.id) seenMessageIds[p.id] = true;
    addMessage({ role: 'app', kind: 'file', fileName: p.fileName, fileSize: p.fileSize, mime: p.mime, url: location.origin + p.url });
  }
}

window.addEventListener('pagehide', function(){ stopHeartbeat(); if (ws) try { ws.close(); } catch (e){} });

pairInput.addEventListener('input', function(){ pairInput.value = pairInput.value.replace(/\\D/g, '').slice(0, 6); pairError.textContent = ''; });
pairForm.onsubmit = function(e){
  e.preventDefault();
  var code = pairInput.value.trim();
  if (!/^\\d{6}$/.test(code)){ pairError.textContent = '请输入 6 位数字配对码'; return; }
  pairBtn.disabled = true;
  pairError.textContent = '';
  fetch('/pair', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: code, remember: rememberInput.checked, deviceName: deviceName() })
  }).then(function(res){ return res.json().catch(function(){ return {}; }).then(function(body){ return { status: res.status, body: body }; }); })
    .then(function(result){
      if (result.status !== 200 || !result.body.token || !result.body.clientId) throw new Error(result.body.error || '配对失败');
      authToken = result.body.token;
      clientId = result.body.clientId;
      sessionStorage.setItem('lan-transfer-token', authToken);
      sessionStorage.setItem('lan-transfer-client-id', clientId);
      document.body.classList.add('paired');
      pairInput.value = '';
      connect();
    })
    .catch(function(err){ pairError.textContent = err.message || '配对失败'; })
    .then(function(){ pairBtn.disabled = false; });
};

function clearPairing(message){
  authToken = '';
  clientId = '';
  sessionStorage.removeItem('lan-transfer-token');
  sessionStorage.removeItem('lan-transfer-client-id');
  document.body.classList.remove('paired');
  pairError.textContent = message || '';
  statusEl.textContent = '● 等待配对…';
  statusEl.className = 'status off';
  if (reconnectTimer){ clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws){ try { ws.close(); } catch (e){} ws = null; }
  pairInput.focus();
}

function resumeTrusted(showError){
  if (resuming) return;
  resuming = true;
  authToken = '';
  clientId = '';
  sessionStorage.removeItem('lan-transfer-token');
  sessionStorage.removeItem('lan-transfer-client-id');
  if (reconnectTimer){ clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws){ try { ws.close(); } catch (e){} ws = null; }
  statusEl.textContent = '● 正在恢复受信任会话…';
  statusEl.className = 'status off';
  fetch('/resume', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deviceName: deviceName() })
  }).then(function(res){ return res.json().catch(function(){ return {}; }).then(function(body){ return { status: res.status, body: body }; }); })
    .then(function(result){
      if (result.status !== 200 || !result.body.token || !result.body.clientId) throw new Error(result.body.error || '自动连接失败');
      authToken = result.body.token;
      clientId = result.body.clientId;
      sessionStorage.setItem('lan-transfer-token', authToken);
      sessionStorage.setItem('lan-transfer-client-id', clientId);
      document.body.classList.add('paired');
      connect();
    })
    .catch(function(err){
      clearPairing(showError ? (err.message || '自动连接失败，请重新配对') : '');
    })
    .then(function(){ resuming = false; });
}

function authorizedFetch(url, options){
  options = options || {};
  options.headers = Object.assign({}, options.headers || {}, { 'x-session-token': authToken, 'x-client-id': clientId });
  return fetch(url, options).then(function(res){
    if (res.status === 401){ clearPairing('配对会话已失效，请重新配对'); throw new Error('未授权'); }
    if (!res.ok) throw new Error('请求失败（' + res.status + '）');
    return res;
  });
}

function sendText(){
  var t = textInput.value.trim();
  if (!t || !ws || ws.readyState !== 1) return;
  var id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  ws.send(JSON.stringify({ type: 'text', text: t, id: id, ts: Date.now() }));
  addMessage({ role: 'browser', kind: 'text', text: t });
  textInput.value = '';
}
function sendClipboard(text){
  text = String(text || '').slice(0, 100000);
  if (!text || !wsAuthenticated || !ws || ws.readyState !== 1) return false;
  if (!markNewClipboard('text:' + text)) return false;
  var id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  ws.send(JSON.stringify({ type: 'clipboard', text: text, id: id, ts: Date.now() }));
  addMessage({ role: 'browser', kind: 'text', text: text });
  return true;
}
async function syncBrowserClipboard(){
  if (!wsAuthenticated){ showClipboardHint('请先完成配对'); return; }
  try {
    if (navigator.clipboard && typeof navigator.clipboard.read === 'function'){
      var items = await navigator.clipboard.read();
      var sent = 0;
      for (var i = 0; i < items.length; i++){
        var item = items[i];
        var imageType = item.types.find(function(type){ return type.indexOf('image/') === 0; });
        if (imageType){
          var blob = await item.getType(imageType);
          if (!markNewClipboard(await blobSignature(blob))) continue;
          var ext = imageType.split('/')[1].replace('jpeg', 'jpg') || 'png';
          uploadFile(new File([blob], '剪贴板-' + Date.now() + '.' + ext, { type: imageType }));
          sent++;
          continue;
        }
        if (item.types.indexOf('text/plain') >= 0){
          var textBlob = await item.getType('text/plain');
          var value = await textBlob.text();
          if (value && sendClipboard(value)) sent++;
        }
      }
      showClipboardHint(sent ? '剪贴板已粘贴' : (items.length ? '该剪贴板内容已发送' : '剪贴板没有可粘贴内容'));
      return;
    }
    if (navigator.clipboard && typeof navigator.clipboard.readText === 'function'){
      var text = await navigator.clipboard.readText();
      if (text){
        showClipboardHint(sendClipboard(text) ? '剪贴板已粘贴' : '该剪贴板内容已发送');
        return;
      }
    }
    throw new Error('clipboard-unavailable');
  } catch (error){
    showClipboardHint('浏览器限制读取，请按 Ctrl+V');
    textInput.placeholder = '按 Ctrl+V 粘贴剪贴板…';
    textInput.focus();
  }
}
syncClipboardBtn.onclick = syncBrowserClipboard;
sendBtn.onclick = sendText;
textInput.addEventListener('keydown', function(e){ if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendText(); } });
document.addEventListener('paste', async function(e){
  if (!wsAuthenticated || e.target === pairInput) return;
  var files = Array.prototype.slice.call((e.clipboardData && e.clipboardData.files) || []);
  if (files.length){
    e.preventDefault();
    for (var i = 0; i < files.length; i++){
      if (markNewClipboard(await blobSignature(files[i]))) uploadFile(files[i]);
    }
    return;
  }
  var text = e.clipboardData && e.clipboardData.getData('text/plain');
  if (!text) return;
  e.preventDefault();
  if (!sendClipboard(text)) showClipboardHint('该剪贴板内容已发送');
});

attachBtn.onclick = function(){ fileInput.click(); };
fileInput.onchange = function(){
  var files = Array.prototype.slice.call(fileInput.files || []);
  fileInput.value = '';
  files.forEach(uploadFile);
};
var dragDepth = 0;
document.addEventListener('dragenter', function(e){
  e.preventDefault();
  dragDepth += 1;
  document.body.classList.add('dragging');
});
document.addEventListener('dragover', function(e){
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
});
document.addEventListener('dragleave', function(e){
  e.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) document.body.classList.remove('dragging');
});
document.addEventListener('drop', function(e){
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('dragging');
  var files = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []);
  files.forEach(uploadFile);
});
function uploadFile(file){
  addMessage({ role: 'browser', kind: 'file', fileName: file.name, fileSize: file.size, mime: file.type, url: URL.createObjectURL(file) });
  authorizedFetch('/upload?name=' + encodeURIComponent(file.name || '未命名'), {
    method: 'POST',
    headers: { 'content-type': file.type || 'application/octet-stream' },
    body: file
  }).catch(function(){});
}

if (authToken && clientId){ document.body.classList.add('paired'); connect(); }
else { document.body.classList.add('paired'); resumeTrusted(false); }
</script>
</body>
</html>`;
}
