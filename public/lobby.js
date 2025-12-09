// lobby.js - исправленная версия (копируй целиком)

// =========================
//  Настройка API
// =========================
const API = "https://movieapp-server-eq3i.onrender.com";

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
//  Текущий пользователь
// =========================
let currentUser = localStorage.getItem("currentUser");
if (!currentUser) {
  // если не залогинен — кидаем на регистрацию
  // не ломаем, просто перенаправление
  try { window.location.href = "register.html"; } catch(e){}
}

// безопасный селектор
function $id(id){ return document.getElementById(id); }

// DOM элементы (может чего не быть — поэтому проверяем)
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

// =========================
//  Профиль: загрузить
// =========================
async function loadProfile() {
  if (!currentUser) return;
  const res = await api(`/api/user/${encodeURIComponent(currentUser)}`);
  if (!res.ok) return;
  const u = res.user;
  if (profileNameEl) profileNameEl.textContent = u.username || currentUser;
  if (profileAvatarEl && u.avatar) profileAvatarEl.src = u.avatar;
}

// =========================
//  Настройки профиля
// =========================
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
//  Добавление друга (UI)
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
    setTimeout(()=>{ if (friendMsgEl) friendMsgEl.textContent=""; }, 2000);

    // обновим исходящие
    loadOutgoingRequests();
  };
}

// =========================
//  Загрузка друзей (гибко: пробуем /api/friends, если нет — /api/user)
// =========================
async function loadFriends() {
  if (!currentUser) return;
  const sidebar = friendsListContainer;
  if (!sidebar) return;
  sidebar.innerHTML = "<div class='loading'>Загрузка...</div>";

  // Попробуем сначала явный endpoint /api/friends/:user
  let res = await api(`/api/friends/${encodeURIComponent(currentUser)}`, "GET");
  if (!res.ok) {
    // fallback: юзер с полем friends
    const r2 = await api(`/api/user/${encodeURIComponent(currentUser)}`, "GET");
    if (!r2.ok) {
      sidebar.innerHTML = "<div class='empty'>Ошибка загрузки</div>";
      return;
    }
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
    el.onclick = () => openChat(name);
    container.appendChild(el);
  });
}

// =========================
//  Заявки: входящие / исходящие (используем endpoints, которые у тебя на сервере)
// =========================
async function loadIncomingRequests() {
  if (!currentUser) return;
  const area = requestsListContainer;
  if (!area) return;

  area.innerHTML = "<div class='loading'>Загрузка...</div>";

  // try /api/friend-requests/:user
  const res = await api(`/api/friend-requests/${encodeURIComponent(currentUser)}`, "GET");
  if (!res.ok) {
    area.innerHTML = "<div class='empty'>Ошибка загрузки</div>";
    return;
  }

  const incoming = res.incoming || [];
  if (incoming.length === 0) {
    area.innerHTML = "<div class='empty'>Нет входящих заявок</div>";
    return;
  }

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
      if (r.ok) {
        await loadIncomingRequests();
        await loadFriends();
        await loadOutgoingRequests();
      } else {
        console.warn("accept failed", r);
      }
    };

    decline.onclick = async () => {
      // try decline endpoint (if exists on server)
      const r = await api("/api/request/decline", "POST", { username: currentUser, from });
      if (r.ok) {
        await loadIncomingRequests();
      } else {
        // fallback: call friend-accept with special flag? just remove locally by calling a remove endpoint if you add it server-side
        console.warn("decline failed or not supported on server", r);
        // as another fallback, ask the server to accept false by hitting friend-accept with different body is not safe.
        // best is to add decline endpoint on server; I'll show that if needed.
        await loadIncomingRequests();
      }
    };

    area.appendChild(box);
  });
}

async function loadOutgoingRequests() {
  if (!currentUser) return;
  const outArea = $id("outgoingList") || $id("outgoingArea") || null;
  // if no outgoing container, skip
  if (!outArea) return;

  outArea.innerHTML = "<div class='loading'>Загрузка...</div>";

  const res = await api(`/api/friend-outgoing/${encodeURIComponent(currentUser)}`, "GET");
  if (!res.ok) {
    outArea.innerHTML = "<div class='empty'>Ошибка загрузки</div>";
    return;
  }

  const outgoing = res.outgoing || [];
  if (outgoing.length === 0) {
    outArea.innerHTML = "<div class='empty'>Нет исходящих заявок</div>";
    return;
  }

  outArea.innerHTML = "";
  outgoing.forEach(to => {
    const el = document.createElement("div");
    el.className = "friend-request outgoing";
    el.innerHTML = `<span>${to}</span><span class="pending">Ожидание...</span>`;
    outArea.appendChild(el);
  });
}

// =========================
//  UI вкладки (online / requests)
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

// =========================
//  Инициализация
// =========================
window.addEventListener("DOMContentLoaded", () => {
  loadProfile();
  loadFriends();
  loadIncomingRequests();
  loadOutgoingRequests();

  // interval refresh
  setInterval(() => {
    loadFriends();
    loadIncomingRequests();
    loadOutgoingRequests();
  }, 4000);

  const addBtn = document.querySelector(".add-friend-btn");
  if (addBtn) addBtn.onclick = openAddFriend;

  // expose functions to HTML onclick if used
  window.openAddFriend = openAddFriend;
  window.closeAddFriend = closeAddFriend;
  window.showOnline = showOnline;
  window.showRequests = showRequests;
});
