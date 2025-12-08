async function loadProfile() {
  const username = localStorage.getItem("currentUser");
  if (!username) {
    window.location.href = "/register.html";
    return;
  }

  const res = await fetch(`/api/user/${encodeURIComponent(username)}`);
  const data = await res.json();

  if (data.ok) {
    document.getElementById("profileName").textContent = data.user.username;

    if (data.user.avatar) {
      document.getElementById("profileAvatar").src = data.user.avatar;
    }
  }
}

window.onload = loadProfile;

// ==================== ЧАТЫ ====================
function openChat(name) {
  const area = document.getElementById("mainArea");
  area.innerHTML = `
    <div style="padding:40px; color:#eee; font-size:28px;">
      <b>${name}</b>
      <div style="margin-top:20px; font-size:16px; color:#ccc;">Здесь будет чат</div>
    </div>`;
}

// ==================== НАСТРОЙКИ ====================
document.getElementById("settingsBtn").onclick = () => {
  document.getElementById("settingsModal").classList.remove("hidden");
};

document.getElementById("closeProfile").onclick = () => {
  document.getElementById("settingsModal").classList.add("hidden");
};

document.getElementById("saveProfile").onclick = async () => {
  const msg = document.getElementById("profileMsg");
  msg.textContent = "";

  const username = localStorage.getItem("currentUser");
  const newNick = document.getElementById("newNick").value.trim();
  const fileInput = document.getElementById("avatarFile");

  let avatarBase64 = null;
  if (fileInput.files && fileInput.files[0]) {
    avatarBase64 = await readFileAsDataURL(fileInput.files[0]);
  }

  const res = await fetch("/api/update-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, newUsername: newNick || null, avatarBase64 })
  });

  const data = await res.json();
  if (data.ok) {
    localStorage.setItem("currentUser", data.user.username);
    document.getElementById("profileName").textContent = data.user.username;
    if (data.user.avatar) document.getElementById("profileAvatar").src = data.user.avatar;

    msg.textContent = "Сохранено!";
    setTimeout(() => {
      document.getElementById("settingsModal").classList.add("hidden");
      msg.textContent = "";
    }, 900);
  } else {
    msg.textContent = data.message || "Ошибка";
  }
};

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// ==================== ДОБАВЛЕНИЕ ДРУГА ====================
function openAddFriend() {
  document.getElementById("addFriendModal").classList.remove("hidden");
}

function closeAddFriend() {
  document.getElementById("addFriendModal").classList.add("hidden");
  document.getElementById("friendMsg").textContent = "";
  document.getElementById("friendName").value = "";
}

document.getElementById("sendFriendRequest").onclick = async () => {
  const username = localStorage.getItem("currentUser");
  const friend = document.getElementById("friendName").value.trim();
  const msg = document.getElementById("friendMsg");

  if (!friend) {
    msg.textContent = "Введите имя пользователя";
    msg.style.color = "red";
    return;
  }

  const find = await fetch(`/api/find/${friend}`);
  const fdata = await find.json();

  if (!fdata.ok) {
    msg.textContent = "Хм, не получилось... Проверьте имя пользователя.";
    msg.style.color = "red";
    return;
  }

  const req = await fetch("/api/friend-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: username, to: friend })
  });

  const data = await req.json();

  if (!data.ok) {
    msg.textContent = data.message;
    msg.style.color = "red";
    return;
  }

  msg.textContent = "Заявка отправлена!";
  msg.style.color = "lime";
};
