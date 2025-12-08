const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const USERS_FILE = path.join(__dirname, "users.json");

// =============== UTILS ===============

function readUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, "[]", "utf8");
    }
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8") || "[]");
}

function writeUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

// =============== REGISTER ===============

app.post("/api/register", (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password)
        return res.json({ ok: false, message: "Заполните все поля" });

    const users = readUsers();

    if (users.find(u => u.username.toLowerCase() === username.toLowerCase()))
        return res.json({ ok: false, message: "Имя уже занято" });

    const user = {
        username,
        password,
        avatar: null,
        friends: [],
        incoming: [], // входящие заявки
        outgoing: []  // исходящие заявки
    };

    users.push(user);
    writeUsers(users);

    return res.json({ ok: true, user });
});

// =============== LOGIN ===============

app.post("/api/login", (req, res) => {
    const { username, password } = req.body || {};
    const users = readUsers();

    const user = users.find(u => u.username === username && u.password === password);

    if (!user)
        return res.json({ ok: false, message: "Неверный логин или пароль" });

    return res.json({ ok: true, user });
});

// =============== GET USER ===============

app.get("/api/user/:username", (req, res) => {
    const { username } = req.params;
    const users = readUsers();
    const user = users.find(u => u.username === username);

    if (!user)
        return res.json({ ok: false, message: "Пользователь не найден" });

    return res.json({ ok: true, user });
});

// =============== UPDATE PROFILE ===============

app.post("/api/update-profile", (req, res) => {
    const { username, newUsername, avatarBase64 } = req.body || {};
    const users = readUsers();

    const user = users.find(u => u.username === username);
    if (!user)
        return res.json({ ok: false, message: "Пользователь не найден" });

    // изменение ника
    if (newUsername && newUsername !== username) {
        if (users.find(u => u.username.toLowerCase() === newUsername.toLowerCase()))
            return res.json({ ok: false, message: "Ник уже занят" });

        user.username = newUsername;
    }

    // изменение аватарки
    if (avatarBase64) {
        user.avatar = avatarBase64;
    }

    writeUsers(users);
    return res.json({ ok: true, user });
});

// =============== FIND USER (для поиска друзей) ===============

app.get("/api/find/:username", (req, res) => {
    const name = req.params.username.toLowerCase();
    const users = readUsers();

    const user = users.find(u => u.username.toLowerCase() === name);

    if (!user) return res.json({ ok: false });
    return res.json({ ok: true, user });
});

// =============== SEND FRIEND REQUEST ===============

app.post("/api/friend-request", (req, res) => {
    const { from, to } = req.body || {};
    const users = readUsers();

    const sender = users.find(u => u.username === from);
    const receiver = users.find(u => u.username === to);

    if (!sender || !receiver)
        return res.json({ ok: false, message: "Пользователь не найден" });

    if (sender.username === receiver.username)
        return res.json({ ok: false, message: "Нельзя добавить себя" });

    if (sender.friends.includes(receiver.username))
        return res.json({ ok: false, message: "Вы уже друзья" });

    if (receiver.incoming.includes(sender.username))
        return res.json({ ok: false, message: "Заявка уже отправлена" });

    receiver.incoming.push(sender.username);
    sender.outgoing.push(receiver.username);

    writeUsers(users);

    return res.json({ ok: true, message: "Заявка отправлена" });
});

// =============== ACCEPT FRIEND REQUEST ===============

app.post("/api/friend-accept", (req, res) => {
    const { username, from } = req.body || {};
    const users = readUsers();

    const me = users.find(u => u.username === username);
    const sender = users.find(u => u.username === from);

    if (!me || !sender)
        return res.json({ ok: false });

    me.incoming = me.incoming.filter(u => u !== from);
    sender.outgoing = sender.outgoing.filter(u => u !== username);

    me.friends.push(from);
    sender.friends.push(username);

    writeUsers(users);

    return res.json({ ok: true });
});

// =============== START SERVER ===============

app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
