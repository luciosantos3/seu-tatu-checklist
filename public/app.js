(function () {
  "use strict";

  var API = "/api/checklist";
  var RETENTION_DAYS = 15;
  var STATUSES = ["a_gravar", "gravando", "revisao", "concluido"];
  var TYPE_LABEL = { video: "Vídeo", foto: "Foto", reels: "Reels/Stories", ugc: "UGC" };
  var AV_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ec4899", "#a78bfa", "#14b8a6", "#f97316", "#06b6d4", "#84cc16", "#e879f9"];

  var entries = [];
  var editingId = null;
  var currentStatus = "a_gravar";

  function $(sel) { return document.querySelector(sel); }

  // ---------- Toast ----------
  var toastTimer;
  function toast(msg, isError) {
    var el = $("#toast");
    el.textContent = msg;
    el.className = "toast show" + (isError ? " error" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = "toast"; }, 2600);
  }

  function avatarColor(name) {
    var sum = 0;
    for (var i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return AV_COLORS[sum % AV_COLORS.length];
  }
  function initials(name) {
    var parts = name.trim().split(/\s+/);
    var s = parts[0] ? parts[0][0] : "";
    if (parts.length > 1) s += parts[parts.length - 1][0];
    return s.toUpperCase();
  }

  // Reads the real error message out of a failed API response instead of
  // hiding it behind a generic string, so problems are visible immediately.
  function readError(res, fallback) {
    return res
      .json()
      .then(function (data) { return new Error((data && data.error) || fallback); })
      .catch(function () { return new Error(fallback + " (HTTP " + res.status + ")"); });
  }

  // ---------- Load ----------
  function load(silent) {
    fetch(API)
      .then(function (r) {
        if (!r.ok) return readError(r, "Falha ao carregar.").then(function (e) { throw e; });
        return r.json();
      })
      .then(function (data) { entries = data.entries || []; render(); })
      .catch(function (err) { if (!silent) toast(err.message || "Erro ao carregar dados.", true); });
  }

  // ---------- Render board ----------
  function render() {
    var q = ($("#searchInput").value || "").trim().toLowerCase();
    var filtered = entries.filter(function (e) {
      if (!q) return true;
      return e.title.toLowerCase().indexOf(q) !== -1 || e.responsible.toLowerCase().indexOf(q) !== -1;
    });

    var counts = { total: filtered.length, a_gravar: 0, gravando: 0, revisao: 0, concluido: 0 };
    STATUSES.forEach(function (s) {
      var body = $("#body-" + s);
      body.innerHTML = "";
      var items = filtered.filter(function (e) { return e.status === s; });
      counts[s] = items.length;
      if (!items.length) {
        var empty = document.createElement("div");
        empty.className = "empty-col";
        empty.textContent = "Nenhuma gravação aqui.";
        body.appendChild(empty);
      } else {
        items.forEach(function (e) { body.appendChild(buildCard(e)); });
      }
      $("#bdg-" + s).textContent = items.length;
    });
    $("#st-total").textContent = counts.total;
    STATUSES.forEach(function (s) { $("#st-" + s).textContent = counts[s]; });
  }

  function daysRemaining(createdAt) {
    var created = new Date(createdAt).getTime();
    var elapsedDays = (Date.now() - created) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.ceil(RETENTION_DAYS - elapsedDays));
  }

  function daysRunning(createdAt) {
    var created = new Date(createdAt).getTime();
    var elapsedDays = Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24));
    return Math.max(0, elapsedDays);
  }

  function hostnameOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch (e) { return url; }
  }

  function buildCard(entry) {
    var card = document.createElement("div");
    card.className = "card";
    card.onclick = function () { openEntryModal(entry.id); };

    var title = document.createElement("div");
    title.className = "card-title";
    title.textContent = entry.title;
    card.appendChild(title);

    var tags = document.createElement("div");
    tags.className = "card-tags";
    var typeTag = document.createElement("span");
    typeTag.className = "tag type";
    typeTag.textContent = TYPE_LABEL[entry.type] || entry.type;
    tags.appendChild(typeTag);

    var running = daysRunning(entry.createdAt);
    var ageTag = document.createElement("span");
    ageTag.className = "tag age";
    ageTag.textContent = running === 0 ? "hoje" : running + "d";
    tags.appendChild(ageTag);

    var remaining = daysRemaining(entry.createdAt);
    if (remaining <= 3) {
      var soonTag = document.createElement("span");
      soonTag.className = "tag soon";
      soonTag.textContent = remaining <= 0 ? "expira hoje" : "expira em " + remaining + "d";
      tags.appendChild(soonTag);
    }
    card.appendChild(tags);

    if (entry.link) {
      var linkRow = document.createElement("a");
      linkRow.className = "card-link";
      linkRow.href = entry.link;
      linkRow.target = "_blank";
      linkRow.rel = "noopener";
      linkRow.textContent = "🔗 " + hostnameOf(entry.link);
      linkRow.onclick = function (e) { e.stopPropagation(); };
      card.appendChild(linkRow);
    }

    var foot = document.createElement("div");
    foot.className = "card-foot";
    var av = document.createElement("div");
    av.className = "card-av";
    av.style.background = avatarColor(entry.responsible) + "33";
    av.style.color = avatarColor(entry.responsible);
    av.textContent = initials(entry.responsible);
    foot.appendChild(av);
    var name = document.createElement("span");
    name.className = "card-name";
    name.textContent = entry.responsible;
    foot.appendChild(name);
    var date = document.createElement("span");
    date.className = "card-date";
    date.textContent = new Date(entry.createdAt).toLocaleDateString("pt-BR");
    foot.appendChild(date);
    card.appendChild(foot);

    return card;
  }

  // ---------- Modal ----------
  window.selStatus = function (s) {
    currentStatus = s;
    document.querySelectorAll(".st-opt").forEach(function (btn) {
      btn.className = "st-opt" + (btn.dataset.s === s ? " sel-" + s : "");
    });
  };

  window.openEntryModal = function (id) {
    editingId = id || null;
    var entry = editingId ? entries.find(function (e) { return e.id === editingId; }) : null;

    $("#entryModalTitle").textContent = entry ? "Editar Gravação" : "Nova Gravação";
    $("#fTitle").value = entry ? entry.title : "";
    $("#fResp").value = entry ? entry.responsible : "";
    $("#fType").value = entry ? entry.type : "video";
    $("#fLink").value = entry ? entry.link || "" : "";
    $("#fNotes").value = entry ? entry.notes || "" : "";
    $("#btnDelEntry").style.display = entry ? "inline-block" : "none";
    $("#statusGrp").style.display = entry ? "block" : "none";

    currentStatus = entry ? entry.status : "a_gravar";
    if (entry) window.selStatus(currentStatus);

    $("#ovEntry").classList.add("open");
    setTimeout(function () { $("#fTitle").focus(); }, 50);
  };

  window.closeEntryModal = function () {
    $("#ovEntry").classList.remove("open");
    editingId = null;
  };

  window.saveEntry = function () {
    var title = $("#fTitle").value.trim();
    var responsible = $("#fResp").value.trim();
    if (!title || !responsible) {
      toast("Preenche o nome do criativo e o responsável.", true);
      return;
    }
    var payload = {
      title: title,
      responsible: responsible,
      type: $("#fType").value,
      link: $("#fLink").value.trim(),
      notes: $("#fNotes").value.trim()
    };

    if (editingId) {
      payload.id = editingId;
      payload.status = currentStatus;
      fetch(API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (r) {
          if (!r.ok) return readError(r, "Falha ao salvar.").then(function (e) { throw e; });
          return r.json();
        })
        .then(function (data) {
          var idx = entries.findIndex(function (e) { return e.id === editingId; });
          if (idx !== -1) entries[idx] = data.entry;
          closeEntryModal();
          render();
          toast("Gravação atualizada.");
        })
        .catch(function (err) { toast(err.message || "Erro ao salvar.", true); });
    } else {
      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (r) {
          if (!r.ok) return readError(r, "Falha ao salvar.").then(function (e) { throw e; });
          return r.json();
        })
        .then(function (data) {
          entries.push(data.entry);
          closeEntryModal();
          render();
          toast("Gravação criada. Fica disponível por 15 dias.");
        })
        .catch(function (err) { toast(err.message || "Erro ao salvar.", true); });
    }
  };

  window.deleteEntry = function () {
    if (!editingId) return;
    if (!confirm("Excluir essa gravação? Não dá pra desfazer.")) return;
    fetch(API + "?id=" + encodeURIComponent(editingId), { method: "DELETE" })
      .then(function (r) {
        if (!r.ok) return readError(r, "Falha ao excluir.").then(function (e) { throw e; });
      })
      .then(function () {
        entries = entries.filter(function (e) { return e.id !== editingId; });
        closeEntryModal();
        render();
        toast("Gravação excluída.");
      })
      .catch(function (err) { toast(err.message || "Erro ao excluir.", true); });
  };

  window.render = render;
  window.load = load;

  // ---------- Splash ----------
  (function () {
    var logo = document.getElementById("splash-logo");
    var bar = document.getElementById("splash-bar");
    var splash = document.getElementById("splash");
    setTimeout(function () { logo.classList.add("show"); bar.style.width = "100%"; }, 80);
    setTimeout(function () {
      splash.classList.add("hide");
      setTimeout(function () { splash.style.display = "none"; }, 650);
    }, 1200);
  })();

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeEntryModal();
  });

  // ---------- PWA install (iOS: Safari > Share > Add to Home Screen) ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }

  // ---------- Keep data fresh across devices ----------
  // The board only fetched once on load before, so one person's change
  // wouldn't show up for someone who already had the page open.
  function isModalOpen() {
    var ov = $("#ovEntry");
    return ov && ov.classList.contains("open");
  }

  // Refresh whenever the tab/app becomes visible again (covers switching
  // back from another app on iOS, or another browser tab).
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && !isModalOpen()) load(true);
  });
  window.addEventListener("focus", function () {
    if (!isModalOpen()) load(true);
  });

  // Light polling as a fallback for whoever just leaves the tab open and
  // visible without switching away. Skipped while a modal is open so it
  // never overwrites something someone is actively typing.
  setInterval(function () {
    if (document.visibilityState === "visible" && !isModalOpen()) load(true);
  }, 30000);

  load();
})();
