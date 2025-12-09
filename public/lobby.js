// ==================== ЗАГРУЗКА ЗАЯВОК ====================

async function loadIncomingRequests() {
    const username = localStorage.getItem("currentUser");
    if (!username) return;

    const res = await fetch(`/api/friend-requests/${username}`);
    const data = await res.json();

    const area = document.getElementById("mainArea");

    if (!data.ok) {
        return;
    }

    if (data.incoming.length === 0) {
        area.innerHTML = `<div class="placeholder">Нет входящих заявок</div>`;
        return;
    }

    area.innerHTML = `<h2 class="friend-title">Входящие заявки</h2>`;

    data.incoming.forEach(user => {
        area.innerHTML += `
            <div class="friend-request">
                <span>${user}</span>
                <button onclick="acceptRequest('${user}')">Принять</button>
            </div>
        `;
    });
}

async function loadOutgoingRequests() {
    const username = localStorage.getItem("currentUser");
    if (!username) return;

    const res = await fetch(`/api/friend-outgoing/${username}`);
    const data = await res.json();

    const area = document.getElementById("mainArea");

    if (!data.ok) {
        return;
    }

    if (data.outgoing.length === 0) {
        area.innerHTML += `<div class="placeholder">Нет исходящих заявок</div>`;
        return;
    }

    area.innerHTML += `<h2 class="friend-title">Исходящие заявки</h2>`;

    data.outgoing.forEach(user => {
        area.innerHTML += `
            <div class="friend-request outgoing">
                <span>${user}</span>
                <span class="pending">Ожидание...</span>
            </div>
        `;
    });
}

// ==================== ПРИНЯТЬ ЗАЯВКУ ====================

async function acceptRequest(fromUser) {
    const username = localStorage.getItem("currentUser");

    const res = await fetch("/api/friend-accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, from: fromUser })
    });

    const data = await res.json();

    if (data.ok) {
        loadIncomingRequests();
    }
}

// ==================== АВТО-ОБНОВЛЕНИЕ ====================

setInterval(() => {
    loadIncomingRequests();
    loadOutgoingRequests();
}, 5000); // каждые 5 секунд
