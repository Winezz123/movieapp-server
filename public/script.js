// SPLASH (если есть splash экран)
let loader = document.getElementById("loader");
let loginScreen = document.getElementById("login-screen");

if (loader && loginScreen) {
    setTimeout(() => {
        loader.style.opacity = 0;
        setTimeout(() => {
            loader.classList.add("hidden");
            loginScreen.style.display = "block";
        }, 700);
    }, 5000);
}

// ==================== РЕГИСТРАЦИЯ ====================

let msg = document.getElementById("msg");

async function registerUser() {
    const username = document.getElementById("regUser").value.trim();
    const password = document.getElementById("regPass").value.trim();

    msg.textContent = "";

    if (!username || !password) {
        msg.textContent = "Заполните все поля";
        return;
    }

    const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.ok) {
        localStorage.setItem("currentUser", username);
        window.location.href = "lobby.html";
    } else {
        msg.textContent = data.message || "Ошибка регистрации";
    }
}

async function loginUser() {
    const username = document.getElementById("loginUser").value.trim();
    const password = document.getElementById("loginPass").value.trim();

    msg.textContent = "";

    if (!username || !password) {
        msg.textContent = "Введите данные";
        return;
    }

    const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.ok) {
        localStorage.setItem("currentUser", username);
        window.location.href = "lobby.html";
    } else {
        msg.textContent = data.message || "Ошибка входа";
    }
}

const regBtn = document.getElementById("btnRegister");
if (regBtn) regBtn.onclick = registerUser;

const loginBtn = document.getElementById("btnLogin");
if (loginBtn) loginBtn.onclick = loginUser;
