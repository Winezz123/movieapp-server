// lobby.js (полный, заменяет старую версию; содержит WS-клиент)
console.log("lobby.js (with WebSocket) loaded");

// =========================
//  Настройка API + WS
// =========================
const API = "https://movieapp-server-eq3i.onrender.com";

// WS URL (используем ws или wss в зависимости от API)
const WS_URL = API.replace(/^http/, (m) => (m === "https" ? "wss" : "ws")).replace("https", "wss").replace("http", "ws");

// универсальный fetch-wrapper
async function api(path, method = "GET", body = null) {
  try {
    const options = { method, headers: {} };
    if (body) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
    const res = await fetch(API + path, options);
    return await res.json();
  } catch (err) {
    console.error("API error:", err);
    return { ok: false, message: "Ошибка сети" };
  }
}

// =========================
//  Current user
// =========================
let currentUser = localStorage.getItem("currentUser");
if (!currentUser) {
  try { window.location.href = "register.html"; } catch (e) {}
}

// safe selector
function $id(id){ return document.getElementById(id); }

// DOM
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
const onlineList = $id("onlineList");
const requestsListContainer = document.querySelector(".requests-list");

// chat UI containers
const chatBoxEl = $id("chatBox");
const chatMessagesEl = $id("chatMessages");
const chatInputEl = $id("chatInput");
const chatSendBtn = $id("chatSendBtn");

let ws = null;
let wsConnected = false;
let currentChatUser = null;

// =========================
//  WebSocket: connect & handlers
// =========================
function connectWS() {
  try {
    // Build ws url from API (API may be https://... or http://...)
    let wsUrl = WS_URL;
    // If API is a full host, ensure wsUrl is correct (some older code replacements above)
    if (!wsUrl.startsWith("ws")) {
      wsUrl = API.replace(/^http/, "ws");
    }
    // add username query so server can use it on upgrade
    const sep = wsUrl.includes("?") ? "&" : "?";
    const finalUrl = wsUrl + sep + "username=" + encodeURIComponent(currentUser);

    ws = new WebSocket(finalUrl);

    ws.onopen = () => {
      wsConnected = true;
      console.log("WS connected", finalUrl);
      // identify explicitly as well
      ws.send(JSON.stringify({ type: "identify", username: currentUser }));
    };

    ws.onmessage = (evt) => {
      let data = null;
      try { data = JSON.parse(evt.data); } catch (e) { return; }
      if (data.type === "chat") {
        // new incoming message
        const { from, text, time } = data;
        // if open chat with that user — append
        if (currentChatUser && (currentChatUser === from)) {
          appendChatMessage({ from, text, time });
        }
        // also show toast / indicator: we can add a small badge on friend list
        showIncomingBadgeFor(from);
      } else if (data.type === "friend-request") {
        // incoming friend request — update UI
        showIncomingBadgeFor(currentUser); // update requests view later
        // optionally auto-refresh requests list
        loadIncomingRequests();
      } else if (data.type === "friend-accepted") {
        // someone accepted your request — refresh friends
        loadFriends();
      } else if (data.type === "typing") {
        // show typing indicator etc (optional)
      }
    };

    ws.onclose = () => {
      wsConnected = false;
      console.log("WS closed, reconnect in 2s");
      setTimeout(connectWS, 2000);
    };

    ws.onerror = (e) => {
      console.warn("WS error", e);
      try { ws.close(); } catch (e) {}
    };
  } catch (e) {
    console.error("connectWS error", e);
  }
}

// call connect
connectWS();

// helper to send chat over ws (or fallback to REST)
async function sendChatMessage(to, text) {
  if (wsConnected && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "chat", from: currentUser, to, text }));
    // optionally append locally
    appendChatMessage({ from: currentUser, text, time: Date.now() });
    return { ok: true };
  } else {
    // fallback: use REST
    return await api("/api/chat/send", "POST", { from: currentUser, to, text });
  }
}

// =========================
//  Profile load + settings (same as before)
// =========================
async function loadProfile() {
  if (!currentUser) return;
  const res = await api(`/api/user/${encodeURIComponent(currentUser)}`);
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
//  Friends / Requests logic (same endpoints) - reuse existing functions
// =========================
function openAddFriend(){ if (addFriendModal) addFriendModal.classList.remove("hidden"); }
function closeAddFriend(){ if (addFriendModal) addFriendModal.classList.add("hidden"); if (friendMsgEl) friendMsgEl.textContent=""; if (friendNameInput) friendNameInput.value=""; }

if (sendFriendRequestBtn) {
  sendFriendRequestBtn.onclick = async () => {
    if (!friendNameInput) return;
    const friend = friendNameInput.value.trim();
    if (!friend) {
      if (friendMsgEl) { friendMsgEl.textContent = "Введите имя пользователя"; friendMsgEl.style.color = "red"; }
      return;
    }
    const found = await api(`/api/find/${encodeURIComponent(friend)}`);
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
    setTimeout(()=>{ if (friendMsgEl) friendMsgEl.textContent=""; },2000);
    loadOutgoingRequests();
  };
}

async function loadFriends() {
  if (!currentUser) return;
  const sidebar = friendsListContainer;
  if (!sidebar) return;
  sidebar.innerHTML = "<div class='loading'>Загрузка...</div>";
  let res = await api(`/api/friends/${encodeURIComponent(currentUser)}`, "GET");
  if (!res.ok) {
    const r2 = await api(`/api/user/${encodeURIComponent(currentUser)}`, "GET");
    if (!r2.ok) { sidebar.innerHTML = "<div class='empty'>Ошибка загрузки</div>"; return; }
    const friendsArray = r2.user.friends || [];
    renderFriendsList(sidebar, friendsArray);
    return;
  }
  const friends = res.friends || [];
  renderFriendsList(sidebar, friends.map(f => f.username || f));
}

function renderFriendsList(container, friendsArr) {
  if (!container) return;
  container.innerHTML = "";
  if (!friendsArr || friendsArr.length === 0) {
    container.innerHTML = "<div class='empty'>У вас пока нет друзей</div>";
    return;
  }
  friendsArr.forEach(f => {
    const name = typeof f === "string" ? f : (f.username || f.name || "unknown");
    const el = document.createElement("div");
    el.className = "channel";
    el.textContent = name;
    el.onclick = () => {
      // open chat when clicking friend
      openChat(name);
    };
    container.appendChild(el);
  });
}

// =========================
//  Requests (incoming/outgoing)
// =========================
async function loadIncomingRequests() {
  if (!currentUser) return;
  const area = requestsListContainer;
  if (!area) return;
  area.innerHTML = "<div class='loading'>Загрузка...</div>";
  const res = await api(`/api/friend-requests/${encodeURIComponent(currentUser)}`, "GET");
  if (!res.ok) { area.innerHTML = "<div class='empty'>Ошибка загрузки</div>"; return; }
  const incoming = res.incoming || [];
  if (incoming.length === 0) { area.innerHTML = "<div class='empty'>Нет входящих заявок</div>"; return; }
  area.innerHTML = "";
  incoming.forEach(from => {
    const box = document.createElement("div");
    box.className = "request-box";
    box.innerHTML = `
      <div class="req-left"><b>${from}</b></div>
      <div class="req-right">
        <button class="accept-btn">Принять</button>
        <button class="decline-btn">Отклонить</button>
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
}

async function loadOutgoingRequests() {
  if (!currentUser) return;
  const outArea = $id("outgoingList") || $id("outgoingArea") || null;
  if (!outArea) return;
  outArea.innerHTML = "<div class='loading'>Загрузка...</div>";
  const res = await api(`/api/friend-outgoing/${encodeURIComponent(currentUser)}`, "GET");
  if (!res.ok) { outArea.innerHTML = "<div class='empty'>Ошибка загрузки</div>"; return; }
  const outgoing = res.outgoing || [];
  if (outgoing.length === 0) { outArea.innerHTML = "<div class='empty'>Нет исходящих заявок</div>"; return; }
  outArea.innerHTML = "";
  outgoing.forEach(to => {
    const el = document.createElement("div");
    el.className = "friend-request outgoing";
    el.innerHTML = `<span>${to}</span><span class="pending">Ожидание...</span>`;
    outArea.appendChild(el);
  });
}

// =========================
//  Chat functions (WS + UI)
// =========================

function appendChatMessage(msg) {
  if (!chatMessagesEl) return;
  const d = document.createElement("div");
  d.className = msg.from === currentUser ? "msg me" : "msg other";
  d.textContent = msg.text;
  chatMessagesEl.appendChild(d);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

// show tiny badge on friend in sidebar (simple implementation)
function showIncomingBadgeFor(username) {
  // try to find friend element and add badge
  const nodes = document.querySelectorAll(".channel");
  nodes.forEach(n => {
    if (n.textContent.trim() === username) {
      let b = n.querySelector(".notif-badge");
      if (!b) {
        b = document.createElement("span");
        b.className = "notif-badge";
        b.style = "background:red;color:#fff;padding:2px 6px;border-radius:10px;margin-left:8px;font-size:12px;";
        n.appendChild(b);
      }
      // increment or set dot
      b.textContent = "1";
    }
  });
}

// open chat UI and load history
async function openChat(friend) {
  currentChatUser = friend;
  // hide main area but keep layout
  const mainArea = $id("mainArea");
  if (mainArea) mainArea.classList.add("hidden");
  if (chatBoxEl) chatBoxEl.classList.remove("hidden");
  if (chatMessagesEl) chatMessagesEl.innerHTML = "<div class='loading'>Загрузка...</div>";

  // load history via REST (server has /api/chat/:u1/:u2)
  const res = await api(`/api/chat/${encodeURIComponent(currentUser)}/${encodeURIComponent(friend)}`, "GET");
  if (!res.ok) {
    chatMessagesEl.innerHTML = "<div class='empty'>Нет истории</div>";
    return;
  }
  chatMessagesEl.innerHTML = "";
  (res.messages || []).forEach(m => appendChatMessage(m));
  // focus input
  if (chatInputEl) chatInputEl.focus();
}

// send button handler
if (chatSendBtn) {
  chatSendBtn.onclick = async () => {
    if (!currentChatUser) return;
    const txt = chatInputEl ? chatInputEl.value.trim() : "";
    if (!txt) return;
    // send via ws if possible (sendChatMessage handles fallback)
    await sendChatMessage(currentChatUser, txt);
    if (chatInputEl) chatInputEl.value = "";
    // append is done by appendChatMessage in sendChatMessage when ws fallback used
  };
}

// auto-refresh chat when opened (polling ensures fallback reliability)
setInterval(() => {
  if (currentChatUser) {
    // reload history to ensure sync (lightweight for short chats)
    api(`/api/chat/${encodeURIComponent(currentUser)}/${encodeURIComponent(currentChatUser)}`, "GET")
    .then(res => {
      if (res.ok && chatMessagesEl) {
        chatMessagesEl.innerHTML = "";
        (res.messages || []).forEach(m => appendChatMessage(m));
      }
    }).catch(()=>{});
  }
}, 3000);

// =========================
//  Tabs & init
// =========================
function showOnline() {
  const onlineArea = $id("onlineArea");
  const requestsArea = $id("requestsArea");
  if (onlineArea) onlineArea.classList.remove("hidden");
  if (requestsArea) requestsArea.classList.add("hidden");
  const t = document.querySelectorAll(".f-tab");
  if (t && t[0]) t[0].classList.add("active");
  if (t && t[1]) t[1].classList.remove("active");
  loadFriends();
}

function showRequests() {
  const onlineArea = $id("onlineArea");
  const requestsArea = $id("requestsArea");
  if (onlineArea) onlineArea.classList.add("hidden");
  if (requestsArea) requestsArea.classList.remove("hidden");
  const t = document.querySelectorAll(".f-tab");
  if (t && t[0]) t[0].classList.remove("active");
  if (t && t[1]) t[1].classList.add("active");
  loadIncomingRequests();
  loadOutgoingRequests();
}

window.addEventListener("DOMContentLoaded", () => {
  loadProfile();
  loadFriends();
  loadIncomingRequests();
  loadOutgoingRequests();

  setInterval(()=>{ loadFriends(); loadIncomingRequests(); loadOutgoingRequests(); }, 5000);

  const addBtn = document.querySelector(".add-friend-btn");
  if (addBtn) addBtn.onclick = openAddFriend;

  window.openAddFriend = openAddFriend;
  window.closeAddFriend = closeAddFriend;
  window.showOnline = showOnline;
  window.showRequests = showRequests;
});
