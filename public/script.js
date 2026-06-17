async function loadData(){

  const res = await fetch("/api/status");
  const data = await res.json();

  document.getElementById("ping").innerText =
    data.ping + " ms";

  document.getElementById("ram").innerText =
    data.ram + " MB";

  document.getElementById("uptime").innerText =
    data.uptime + " s";

  let html = "";

  data.guilds.forEach(guild => {
    html += `
      <div class="server">
        <h3>${guild.name}</h3>
        <p>👥 ${guild.members} Members</p>
      </div>
    `;
  });

  document.getElementById("servers").innerHTML = html;
}

loadData();
setInterval(loadData,2000);