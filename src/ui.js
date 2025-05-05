export function displayUserData(user, transactions) {
    if (!user) {
        document.getElementById("user-name").textContent = "User data not available";
        return;
    }

    document.getElementById("user-name").textContent = user.login || "Unknown";
    console.log(user.attrs)
    document.getElementById("user-email").textContent = user.email || "Unknown";
    document.getElementById("user-contact").textContent = user.attrs.phone || "Unknown";

    const totalXP = transactions.reduce((sum, t) => sum + t.amount, 0);
    let tot = totalXP >= 1000000 ? (totalXP / 1000000).toFixed(2) : 
             totalXP >= 1000 ? (totalXP / 1000).toFixed(2) : totalXP.toFixed(2);
    document.getElementById("total-xp").textContent = `${tot.toLocaleString()}MB`;

    if (transactions.length > 0) {
        const sortedTx = [...transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        document.getElementById("current-progress").textContent = sortedTx[0].path.split("/").pop() || "Unknown";
    } else {
        document.getElementById("current-progress").textContent = "No progress data";
    }
}

export function displayStats(transactions, progress, results) {
    const statsDiv = document.getElementById("stats-details");
    const passCount = progress.filter(p => p.grade === 1).length;
    const failCount = progress.filter(p => p.grade === 0).length;
    const passRatio = (passCount / (passCount + failCount)) * 100 || 0;

    statsDiv.innerHTML = `
        <div class="stat-item">
            <p><strong>Total XP Entries:</strong> ${transactions.length}</p>
            <p><strong>Total Projects Attempted:</strong> ${progress.length}</p>
            <p><strong>Pass Rate:</strong> ${passRatio.toFixed(1)}%</p>
            <p><strong>PASS:</strong> ${passCount} | <strong>FAIL:</strong> ${failCount}</p>
        </div>`;
}

export function displayPendingProjects(items) {
    const ul = document.getElementById("pending-projects");
    ul.innerHTML = "";
    items.forEach(item => {
        const li = document.createElement("li");
        const name = item.path.split("/").pop().replace(/-/g, " ");
        const date = new Date(item.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
        li.innerHTML = `<span class="project-name">${name}</span><span class="start-date">Started: ${date}</span>`;
        ul.appendChild(li);
    });
}