const msg = document.getElementById("friendMessage");
const input = document.getElementById("friendInput");
const btn = document.getElementById("friendSearch");

btn.onclick = async () => {
    msg.textContent = "";
    const name = input.value.trim();
    const currentUser = localStorage.getItem("currentUser");

    if (!name) {
        msg.textContent = "Введите имя пользователя";
        msg.style.color = "red";
        return;
    }

    // Проверяем существование
    const res = await fetch(`/api/find/${name}`);
    const data = await res.json();

    if (!data.ok) {
        msg.textContent = "Хм, не получилось... Проверьте, правильное ли имя пользователя вы ввели.";
        msg.style.color = "red";
        return;
    }

    // Отправляем заявку
    const req = await fetch("/api/friend-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: currentUser, to: name })
    });

    const resp = await req.json();

    if (!resp.ok) {
        msg.textContent = resp.message;
        msg.style.color = "red";
        return;
    }

    msg.textContent = "Заявка отправлена!";
    msg.style.color = "lime";
};
