// lobby.js — полная версия, под lobby.html (копируй целиком)

console.log("lobby.js loaded");

// =========================
// CONFIG
// =========================
const API = "https://movieapp-server-eq3i.onrender.com";

// build WS url from API
function buildWsUrl() {
  try {
    const url = new URL(API);
    if (url.protocol === "https:") url.protocol = "wss:";
    else url.protocol = "ws:";
    return url.toString();
  } catch (e) {
    // fallback
    return API.replace(/^http/, (m) => (m === "https" ? "wss" : "ws"));
  }
}
const WS_URL = buildWsUrl();

// safe selector
function $id(id) { return document.getElementById(id); }

// =========================
// CURRENT USER
// =========================
let currentUser = localStorage.getItem("currentUser");
if (!currentUser) {
  try { window.location.href = "register.html"; } catch (e) {}
}

// =========================
// API helper
// =========================
async function api(path, method = "GET", body = null) {
  try {
    const opts = { method, headers: {} };
    if (body) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(API + path, opts);
    return await res.json();
  } catch (err) {
    console.error("API error:", err);
    return { ok: false, message: "Ошибка сети" };
  }
}

// =========================
// DOM refs (guarded)
// =========================
const profileNameEl = $id("profileName");
const profileAvatarEl = $id("profileAvatar");
const settingsBtn = $id("settingsBtn");
const settingsModal = $id("settingsModal");
const closeProfileBtn = $id("closeProfile");
const saveProfileBtn = $id("saveProfile");
const newNickInput = $id("newNick");
const avatarFileInput = $id("avatarFile");

const addFriendModal = $id("addFriendModal");
const friendNameInput = $id("friendName");
const sendFriendRequestBtn = $id("sendFriendRequest");
const friendMsgEl = $id("friendMsg");

const friendsListContainer = $id("friendsList");
const requestsListContainer = document.querySelector(".requests-list");

const placeholderEl = $id("placeholder");
const chatAreaEl = $id("chatArea");
const chatNameEl = $id("chatName");
const chatAvatarEl = $id("chatAvatar");
const chatMessagesEl = $id("chatMessages");
const chatInputEl = $id("chatInput");
const chatSendBtn = $id("chatSendBtn");
const requestsAreaEl = $id("requestsArea");

// =========================
// WebSocket (optional) and helpers
// =========================
let ws = null;
let wsConnected = false;

function connectWS() {
  if (!currentUser) return;
  try {
    let url = WS_URL;
    // ensure query param for username so server can pick it up
    const hasQ = url.includes("?");
    url += (hasQ ? "&" : "?") + "username=" + encodeURIComponent(currentUser);

    ws = new WebSocket(url);

    ws.onopen = () => {
      wsConnected = true;
      console.log("WS connected:", url);
      // send identify message too (server may expect)
      try { ws.send(JSON.stringify({ type: "identify", username: currentUser })); } catch (e) {}
    };

    ws.onmessage = (ev) => {
      let data = null;
      try { data = JSON.parse(ev.data); } catch (e) { return; }

      if (!data) return;

      if (data.type === "chat") {
        // incoming chat message
        handleIncomingChat(data);
      } else if (data.type === "friend-request") {
        // incoming friend request
        refreshRequests();
        showReqBadge();
      } else if (data.type === "friend-accepted") {
        loadFriends();
      } else if (data.type === "typing") {
        // optional: show typing
      }
    };

    ws.onclose = () => {
      wsConnected = false;
      console.log("WS closed, reconnecting in 2s...");
      setTimeout(connectWS, 2000);
    };

    ws.onerror = (e) => {
      console.warn("WS error", e);
      try { ws.close(); } catch (e) {}
    };
  } catch (e) {
    console.error("connectWS err", e);
  }
}

// try to connect (safe)
connectWS();

// helper: send via WS or fallback to REST
async function sendChatMessage(to, text) {
  if (!to || !text) return { ok: false, message: "Пустое" };

  if (wsConnected && ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify({ type: "chat", from: currentUser, to, text }));
      // add local
      appendChatMessage({ from: currentUser, text, time: Date.now() });
      return { ok: true };
    } catch (e) {
      console.warn("WS send fail, fallback to REST", e);
    }
  }

  // fallback to REST endpoint
  return await api("/api/chat/send", "POST", { from: currentUser, to, text });
}

// =========================
// Profile load & settings
// =========================
async function loadProfile() {
  if (!currentUser) return;
  const res = await api(`/api/user/${encodeURIComponent(currentUser)}`, "GET");
  if (!res.ok) return;
  const u = res.user;
  if (profileNameEl) profileNameEl.textContent = u.username || currentUser;
  if (profileAvatarEl && u.avatar) profileAvatarEl.src = u.avatar;
}
loadProfile();

if (settingsBtn) {
  settingsBtn.onclick = () => {
    if (settingsModal) settingsModal.classList.remove("hidden");
    if (newNickInput && profileNameEl) newNickInput.value = profileNameEl.textContent || "";
  };
}
if (closeProfileBtn) closeProfileBtn.onclick = () => { if (settingsModal) settingsModal.classList.add("hidden"); };

if (saveProfileBtn) {
  saveProfileBtn.onclick = async () => {
    const msgEl = $id("profileMsg");
    if (msgEl) { msgEl.textContent = ""; msgEl.style.color = ""; }
    const newNick = newNickInput ? newNickInput.value.trim() : null;
    let avatarBase64 = null;
    try {
      if (avatarFileInput && avatarFileInput.files && avatarFileInput.files[0]) {
        avatarBase64 = await readFileAsDataURL(avatarFileInput.files[0]);
      }
    } catch (e) { console.error(e); }

    const res = await api("/api/update-profile", "POST", { username: currentUser, newUsername: newNick || null, avatarBase64 });
    if (!res.ok) {
      if (msgEl) { msgEl.textContent = res.message || "Ошибка"; msgEl.style.color = "red"; }
      return;
    }
    const updated = res.user;
    if (updated && updated.username) {
      localStorage.setItem("currentUser", updated.username);
      currentUser = updated.username;
    }
    if (profileNameEl) profileNameEl.textContent = updated.username || currentUser;
    if (profileAvatarEl && updated.avatar) profileAvatarEl.src = updated.avatar;
    if (msgEl) { msgEl.textContent = "Сохранено"; msgEl.style.color = "lime"; }
    setTimeout(()=>{ if (settingsModal) settingsModal.classList.add("hidden"); if (msgEl) msgEl.textContent = ""; }, 900);
  };
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// =========================
// Friends & rendering
// =========================
async function loadFriends() {
  if (!currentUser) return;
  const sidebar = friendsListContainer;
  if (!sidebar) return;
  sidebar.innerHTML = "<div class='empty'>Загрузка...</div>";

  // try explicit endpoint first
  const res = await api(`/api/friends/${encodeURIComponent(currentUser)}`, "GET");
  if (!res.ok) {
    const r2 = await api(`/api/user/${encodeURIComponent(currentUser)}`, "GET");
    if (!r2.ok) { sidebar.innerHTML = "<div class='empty'>Ошибка</div>"; return; }
    const friendsArray = r2.user.friends || [];
    renderFriendsList(sidebar, friendsArray);
    return;
  }
  const friends = res.friends || [];
  renderFriendsList(sidebar, friends.map(f => typeof f === "string" ? f : (f.username || f)));
}

function renderFriendsList(container, friendsArr) {
  if (!container) return;
  container.innerHTML = "";
  if (!friendsArr || friendsArr.length === 0) {
    container.innerHTML = "<div class='empty'>У вас пока нет друзей</div>";
    return;
  }
  friendsArr.forEach(f => {
    const name = typeof f === "string" ? f : (f.username || f);
    const el = document.createElement("div");
    el.className = "channel";
    // build inner content with avatar if we can fetch it later
    el.innerHTML = `<span class="friend-name">${escapeHtml(name)}</span>`;
    el.onclick = () => openChat(name, null);
    container.appendChild(el);
  });
}

// simple html escape
function escapeHtml(s) {
  if (!s) return "";
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// =========================
// Friend requests (incoming/outgoing)
// =========================
async function loadIncomingRequests() {
  if (!currentUser) return;
  const area = requestsListContainer;
  if (!area) return;
  area.innerHTML = "<div class='empty'>Загрузка...</div>";
  const res = await api(`/api/friend-requests/${encodeURIComponent(currentUser)}`, "GET");
  if (!res.ok) { area.innerHTML = "<div class='empty'>Ошибка загрузки</div>"; return; }
  const incoming = res.incoming || [];
  if (incoming.length === 0) { area.innerHTML = "<div class='empty'>Нет входящих заявок</div>"; return; }
  area.innerHTML = "";
  incoming.forEach(from => {
    const box = document.createElement("div");
    box.className = "request-box";
    box.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <img src="https://img.icons8.com/ios-filled/50/ffffff/user.png" style="width:36px;height:36px;border-radius:6px;">
        <div><b>${escapeHtml(from)}</b></div>
      </div>
      <div>
        <button class="accept-btn">Принять</button>
        <button class="decline-btn" style="margin-left:8px;background:#777;color:#fff">Отклонить</button>
      </div>`;
    const accept = box.querySelector(".accept-btn");
    const decline = box.querySelector(".decline-btn");
    accept.onclick = async () => {
      const r = await api("/api/friend-accept", "POST", { username: currentUser, from });
      if (r.ok) { await loadIncomingRequests(); await loadFriends(); await loadOutgoingRequests(); }
    };
    decline.onclick = async () => {
      const r = await api("/api/request/decline", "POST", { username: currentUser, from });
      if (r.ok) { await loadIncomingRequests(); }
    };
    area.appendChild(box);
  });

  // badge
  updateReqBadge(incoming.length);
}

async function loadOutgoingRequests() {
  if (!currentUser) return;
  const outArea = $id("outgoingList") || null;
  if (!outArea) return;
  outArea.innerHTML = "<div class='empty'>Загрузка...</div>";
  const res = await api(`/api/friend-outgoing/${encodeURIComponent(currentUser)}`, "GET");
  if (!res.ok) { outArea.innerHTML = "<div class='empty'>Ошибка загрузки</div>"; return; }
  const outgoing = res.outgoing || [];
  if (outgoing.length === 0) { outArea.innerHTML = "<div class='empty'>Нет исходящих заявок</div>"; return; }
  outArea.innerHTML = "";
  outgoing.forEach(to => {
    const el = document.createElement("div");
    el.className = "friend-request outgoing";
    el.innerHTML = `<span>${escapeHtml(to)}</span><span class="pending">Ожидание...</span>`;
    outArea.appendChild(el);
  });
}

function updateReqBadge(count) {
  // find badge element in sidebar tabs (if exists)
  const tabs = document.querySelectorAll(".tab");
  // We added tabs manually; find the second tab for "Личные сообщения" (index 1)
  const tab = tabs && tabs[1];
  if (!tab) return;
  // ensure a badge span
  let b = tab.querySelector(".req-badge");
  if (!b) {
    b = document.createElement("span");
    b.className = "req-badge";
    b.style = "background:red;color:#fff;padding:2px 6px;border-radius:10px;font-size:12px;margin-left:6px;";
    tab.appendChild(b);
  }
  if (count > 0) {
    b.textContent = count;
    b.classList.remove("hidden");
  } else {
    b.classList.add("hidden");
  }
}

function showReqBadge() {
  // reload incoming to update badge
  loadIncomingRequests().catch(()=>{});
}

// =========================
// Chat UI functions
// =========================
let openedChatUser = null;

function ensureChatVisible(show) {
  if (show) {
    if (placeholderEl) placeholderEl.classList.add("hidden");
    if (chatAreaEl) chatAreaEl.classList.remove("hidden");
    if (requestsAreaEl) requestsAreaEl.classList.add("hidden");
  } else {
    if (chatAreaEl) chatAreaEl.classList.add("hidden");
    if (placeholderEl) placeholderEl.classList.remove("hidden");
  }
}

async function openChat(friendName, avatar) {
  openedChatUser = friendName;
  ensureChatVisible(true);
  if (chatNameEl) chatNameEl.textContent = friendName;
  if (chatAvatarEl) chatAvatarEl.src = avatar || "https://img.icons8.com/ios-filled/100/ffffff/user.png";

  // clear messages box
  if (chatMessagesEl) chatMessagesEl.innerHTML = "<div class='empty'>Загрузка...</div>";

  // load history (REST)
  const res = await api(`/api/chat/${encodeURIComponent(currentUser)}/${encodeURIComponent(friendName)}`, "GET");
  if (!res.ok) {
    if (chatMessagesEl) chatMessagesEl.innerHTML = "<div class='empty'>Нет истории</div>";
    return;
  }
  if (chatMessagesEl) chatMessagesEl.innerHTML = "";
  (res.messages || []).forEach(m => {
    appendChatMessage(m);
  });
  if (chatInputEl) chatInputEl.focus();
}

// append message into chatMessagesEl
function appendChatMessage(msg) {
  if (!chatMessagesEl) return;
  // msg: { from, text, time }
  const el = document.createElement("div");
  el.className = "chat-message " + (msg.from === currentUser ? "self" : "other");
  // show author for messages not from current user
  let inner = "";
  if (msg.from && msg.from !== currentUser) {
    inner += `<div class="author">${escapeHtml(msg.from)}</div>`;
  }
  inner += `<div class="text">${escapeHtml(msg.text)}</div>`;
  if (msg.time) {
    const d = new Date(msg.time);
    inner += `<div class="time">${d.toLocaleTimeString()}</div>`;
  }
  el.innerHTML = inner;
  chatMessagesEl.appendChild(el);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

// handle incoming ws chat
function handleIncomingChat(data) {
  const { from, to, text, time } = data;
  // if open chat with that user, append
  if (openedChatUser && openedChatUser === from) {
    appendChatMessage({ from, text, time });
  } else {
    // show small badge for friend
    showIncomingBadgeFor(from);
  }
}

// send message click
if (chatSendBtn) {
  chatSendBtn.onclick = async () => {
    const txt = chatInputEl ? chatInputEl.value.trim() : "";
    if (!txt || !openedChatUser) return;
    // send via WS or fallback
    await sendChatMessage(openedChatUser, txt);
    if (chatInputEl) chatInputEl.value = "";
  };
}

// =========================
// small incoming badge for friend row
// =========================
function showIncomingBadgeFor(name) {
  const nodes = document.querySelectorAll(".channel");
  nodes.forEach(n => {
    if ((n.textContent || "").trim() === name) {
      let b = n.querySelector(".notif-badge");
      if (!b) {
        b = document.createElement("span");
        b.className = "notif-badge";
        b.style.cssText = "background:red;color:#fff;padding:2px 6px;border-radius:10px;margin-left:8px;font-size:12px;";
        n.appendChild(b);
      }
      // set count or dot
      b.textContent = "1";
    }
  });
}

// =========================
// Add friend UI handlers
// =========================
function openAddFriend() { if (addFriendModal) addFriendModal.classList.remove("hidden"); }
function closeAddFriend() { if (addFriendModal) addFriendModal.classList.add("hidden"); if (friendMsgEl) friendMsgEl.textContent = ""; if (friendNameInput) friendNameInput.value = ""; }

if (sendFriendRequestBtn) {
  sendFriendRequestBtn.onclick = async () => {
    if (!friendNameInput) return;
    const friend = friendNameInput.value.trim();
    if (!friend) {
      if (friendMsgEl) { friendMsgEl.textContent = "Введите имя пользователя"; friendMsgEl.style.color = "red"; }
      return;
    }
    const found = await api(`/api/find/${encodeURIComponent(friend)}`, "GET");
    if (!found.ok) {
      if (friendMsgEl) { friendMsgEl.textContent = "Хм, не получилось... Проверьте имя"; friendMsgEl.style.color = "red"; }
      return;
    }
    const res = await api("/api/friend-request", "POST", { from: currentUser, to: friend });
    if (!res.ok) {
      if (friendMsgEl) { friendMsgEl.textContent = res.message || "Ошибка отправки"; friendMsgEl.style.color = "red"; }
      return;
    }
    if (friendMsgEl) { friendMsgEl.textContent = "Запрос отправлен!"; friendMsgEl.style.color = "lime"; }
    setTimeout(()=>{ if (friendMsgEl) friendMsgEl.textContent = ""; },2000);
    loadOutgoingRequests();
  };
}

// =========================
// Tabs: friends / dms
// =========================
function showFriendsMenu() {
  // show friends (sidebar already), show placeholder
  ensureHideRequests();
  ensureHideChat();
  if (placeholderEl) placeholderEl.classList.remove("hidden");
}
function showDmMenu() {
  // show placeholder "Выберите чат"
  ensureHideRequests();
  ensureHideChat();
  if (placeholderEl) placeholderEl.classList.remove("hidden");
  // also refresh incoming requests badge/count
  loadIncomingRequests().catch(()=>{});
}

function ensureHideChat() {
  if (chatAreaEl) chatAreaEl.classList.add("hidden");
}
function ensureHideRequests() {
  if (requestsAreaEl) requestsAreaEl.classList.add("hidden");
}

// =========================
// Refresh helpers
// =========================
async function refreshAll() {
  await loadProfile().catch(()=>{});
  await loadFriends().catch(()=>{});
  await loadIncomingRequests().catch(()=>{});
  await loadOutgoingRequests().catch(()=>{});
}

// initial load
window.addEventListener("DOMContentLoaded", () => {
  refreshAll();
  setInterval(() => {
    loadFriends().catch(()=>{});
    loadIncomingRequests().catch(()=>{});
    loadOutgoingRequests().catch(()=>{});
  }, 5000);

  // show friends by default
  showFriendsMenu();
});

// expose some functions to global
window.openAddFriend = openAddFriend;
window.closeAddFriend = closeAddFriend;
window.showFriendsMenu = showFriendsMenu;
window.showDmMenu = showDmMenu;
window.openChat = openChat;
