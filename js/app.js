/* ============ SO Planner — application logic (fully offline) ============ */
(function () {
  "use strict";

  var DATA = window.SOP_DATA;
  var AV = window.SOP_AVATARS;
  var STORE_KEY = "so_planner_v1";

  /* ------------------------------ helpers ------------------------------ */

  function $(id) { return document.getElementById(id); }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function todayISO() {
    var t = new Date();
    return t.getFullYear() + "-" + pad2(t.getMonth() + 1) + "-" + pad2(t.getDate());
  }

  function parseISO(s) {
    var p = String(s).split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function daysBetween(aISO, bISO) {
    return Math.round((parseISO(bISO) - parseISO(aISO)) / 86400000);
  }

  function formatLongDate(d) {
    try {
      return d.toLocaleDateString(undefined, {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      });
    } catch (e) {
      return d.toDateString();
    }
  }

  var SUBJECT_META = {
    "বাংলা": { cls: "sub-bn", icon: "📚" },
    "ইংরেজি": { cls: "sub-en", icon: "🌐" },
    "গণিত": { cls: "sub-math", icon: "➗" },
    "Analytical": { cls: "sub-ana", icon: "🧠" },
    "ICT": { cls: "sub-ict", icon: "💻" },
    "Financial & Banking Knowledge": { cls: "sub-fin", icon: "🏦" },
    "সাধারণ জ্ঞান": { cls: "sub-gk", icon: "🌍" },
  };

  function subjectMeta(subject) {
    return SUBJECT_META[subject] || { cls: "sub-en", icon: "📘" };
  }

  /** Turn "১। a ২। b" into one line per numbered item. */
  function formatTopics(text) {
    return String(text)
      .replace(/\s+([০-৯]+।)\s+/g, "\n$1 ")
      .trim();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ------------------------------ state ------------------------------ */

  function defaultState() {
    return {
      version: 1,
      profile: null, /* { name, gender } */
      planId: "75",
      plans: {
        "75": { startDate: null, lastOpenDate: null },
        "37": { startDate: null, lastOpenDate: null },
      },
      checks: {},
    };
  }

  function loadState() {
    var st = defaultState();
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return st;
      var saved = JSON.parse(raw);
      if (saved && typeof saved === "object") {
        if (saved.profile) {
          st.profile = saved.profile;
          if (st.profile.gender !== "male" && st.profile.gender !== "female") {
            st.profile.gender = "male";
          }
        }
        if (saved.planId && DATA.plans[saved.planId]) st.planId = saved.planId;
        if (saved.plans) {
          for (var k in st.plans) {
            if (saved.plans[k]) st.plans[k] = saved.plans[k];
          }
        }
        if (saved.checks) st.checks = saved.checks;
      }
    } catch (e) { /* corrupted storage — start fresh */ }
    return st;
  }

  function saveState() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) { /* storage full/blocked — app still works for the session */ }
  }

  var state = loadState();

  /* transient UI state */
  var viewDay = null; /* plan-day index currently displayed */

  /* ------------------------------ plan model ------------------------------ */

  function plan() { return DATA.plans[state.planId]; }

  function planState() { return state.plans[state.planId]; }

  function totalPlanDays() { return plan().totalDays; }

  /** All tasks of one plan-day: [{task, syllabusDay}] */
  function tasksOfPlanDay(planDayIndex) {
    var group = plan().groups[planDayIndex] || [];
    var out = [];
    group.forEach(function (d) {
      var entry = DATA.curriculum[d - 1];
      if (!entry) return;
      entry.tasks.forEach(function (t) {
        out.push({ task: t, syllabusDay: entry });
      });
    });
    return out;
  }

  function isDone(taskId) { return !!state.checks[taskId]; }

  function planDayDoneCount(planDayIndex) {
    var ts = tasksOfPlanDay(planDayIndex);
    var done = 0;
    ts.forEach(function (x) { if (isDone(x.task.id)) done++; });
    return { done: done, total: ts.length };
  }

  /** Current plan-day index (0-based) driven by the calendar. */
  function currentPlanDayIndex() {
    var ps = planState();
    if (!ps.startDate) return 0;
    var diff = daysBetween(ps.startDate, todayISO());
    return Math.max(0, Math.min(totalPlanDays() - 1, diff));
  }

  /** Unticked tasks from plan-days strictly before today. */
  function pendingItems() {
    var todayIdx = currentPlanDayIndex();
    var out = [];
    for (var i = 0; i < todayIdx; i++) {
      tasksOfPlanDay(i).forEach(function (x) {
        if (!isDone(x.task.id)) out.push({ planDay: i, task: x.task, syllabusDay: x.syllabusDay });
      });
    }
    return out;
  }

  function overallProgress() {
    var total = 0, done = 0;
    for (var i = 0; i < totalPlanDays(); i++) {
      var r = planDayDoneCount(i);
      total += r.total;
      done += r.done;
    }
    return { done: done, total: total, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  function streakCount() {
    var todayIdx = currentPlanDayIndex();
    var streak = 0;
    /* include today when fully complete, then walk backwards */
    var i = todayIdx;
    if (planDayDoneCount(i).done === planDayDoneCount(i).total && planDayDoneCount(i).total > 0) {
      streak++;
      i--;
    } else {
      i = todayIdx - 1;
    }
    for (; i >= 0; i--) {
      var r = planDayDoneCount(i);
      if (r.total > 0 && r.done === r.total) streak++;
      else break;
    }
    return streak;
  }

  /* ------------------------------ rendering ------------------------------ */

  var CHECK_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5 l5 5 l10-11"/></svg>';

  function taskHtml(item, opts) {
    var t = item.task;
    var meta = subjectMeta(t.subject);
    var done = isDone(t.id);
    var badge = "";
    if (opts && opts.showDayBadge) {
      badge = '<span class="task-day-badge">Day ' + item.syllabusDay.day + " · " +
        escapeHtml(item.syllabusDay.dayBn) + "</span>";
    }
    return (
      '<li class="task' + (done ? " done" : "") + '" data-id="' + t.id + '">' +
      '<label class="task-check">' +
      '<input type="checkbox" data-id="' + t.id + '"' + (done ? " checked" : "") + ">" +
      '<span class="box">' + CHECK_SVG + "</span>" +
      "</label>" +
      '<div class="task-body">' +
      '<div class="task-top">' +
      '<span class="subject-chip ' + meta.cls + '">' + meta.icon + " " + escapeHtml(t.subject) + "</span>" +
      badge +
      "</div>" +
      '<div class="task-topics">' + escapeHtml(formatTopics(t.topics)) + "</div>" +
      (t.book ? '<div class="task-book"><span>📖</span><span>' + escapeHtml(t.book) + "</span></div>" : "") +
      "</div></li>"
    );
  }

  function renderHeader() {
    var profile = state.profile || { name: "Student", gender: "other" };
    AV.render($("headerAvatar"), profile.gender, 42);

    var hour = new Date().getHours();
    var part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    $("greeting").textContent = part + ", " + profile.name + "!";

    $("headerMeta").textContent =
      plan().name + " · Day " + (currentPlanDayIndex() + 1) + " of " + totalPlanDays();
  }

  function renderHero() {
    var ov = overallProgress();
    var circ = 2 * Math.PI * 52;
    var ring = $("ringFill");
    ring.style.strokeDasharray = String(circ);
    ring.style.strokeDashoffset = String(circ - (circ * ov.pct) / 100);
    $("ringPct").textContent = ov.pct + "%";

    var idx = currentPlanDayIndex();
    $("heroTitle").innerHTML =
      'Day <span class="hl">' + (idx + 1) + "</span> of " + totalPlanDays();
    $("heroDate").textContent = formatLongDate(new Date());
    $("statDay").textContent = String(idx + 1);
    $("statTotal").textContent = String(totalPlanDays());
    $("statDone").textContent = String(ov.done);
    $("statStreak").textContent = String(streakCount());

    var today = planDayDoneCount(idx);
    $("todayBarLabel").textContent = today.done + " / " + today.total;
    $("todayBar").style.width =
      (today.total ? (today.done / today.total) * 100 : 0) + "%";

    /* day map */
    var map = $("dayMap");
    var html = "";
    for (var i = 0; i < totalPlanDays(); i++) {
      var r = planDayDoneCount(i);
      var cls = "day-dot";
      if (r.total > 0 && r.done === r.total) cls += " done";
      else if (r.done > 0) cls += " partial";
      if (i === idx) cls += " today";
      html +=
        '<button type="button" class="' + cls + '" data-day="' + i +
        '" title="Day ' + (i + 1) + " — " + r.done + "/" + r.total +
        '" aria-label="Day ' + (i + 1) + '"></button>';
    }
    map.innerHTML = html;
  }

  function renderDayNav() {
    var idx = currentPlanDayIndex();
    if (viewDay === null) viewDay = idx;
    viewDay = Math.max(0, Math.min(totalPlanDays() - 1, viewDay));

    var group = plan().groups[viewDay] || [];
    var title = "Day " + (viewDay + 1);
    if (group.length > 1) {
      title += " · Syllabus days " + group[0] + "–" + group[group.length - 1];
    }
    $("viewTitle").textContent = title;

    var subs = [];
    group.forEach(function (d) {
      var e = DATA.curriculum[d - 1];
      if (e) subs.push("Day " + d + " · " + e.dayBn);
    });
    var sub = subs.join("   |   ");
    if (viewDay !== idx) {
      sub += (sub ? "   ·   " : "") +
        (viewDay < idx ? "past day — catch up here" : "upcoming — preview");
    }
    $("viewSub").textContent = sub;

    $("prevDay").disabled = viewDay <= 0;
    $("nextDay").disabled = viewDay >= totalPlanDays() - 1;
    $("todayBtn").hidden = viewDay === idx;

    $("goalsTitle").textContent =
      viewDay === idx ? "Today's goals" : "Day " + (viewDay + 1) + " goals";
  }

  function renderGoals() {
    var items = tasksOfPlanDay(viewDay);
    var group = plan().groups[viewDay] || [];
    var html = "";
    var multi = group.length > 1;

    if (multi) {
      group.forEach(function (d) {
        var entry = DATA.curriculum[d - 1];
        if (!entry) return;
        html += '<li class="task-day-divider"><span>Day ' + d + " · " +
          escapeHtml(entry.dayBn) + "</span></li>";
        entry.tasks.forEach(function (t) {
          html += taskHtml({ task: t, syllabusDay: entry }, {});
        });
      });
    } else {
      items.forEach(function (x) { html += taskHtml(x, {}); });
    }

    $("goalList").innerHTML = html;
    $("emptyState").hidden = items.length > 0;
    $("markAllBtn").hidden = items.length === 0;

    var allDone = items.length > 0 && items.every(function (x) { return isDone(x.task.id); });
    $("markAllBtn").textContent = allDone ? "↺ Unmark all" : "✓ Mark all done";
  }

  function renderPending() {
    var pend = pendingItems();
    var show = viewDay === currentPlanDayIndex() && pend.length > 0;
    $("pendingSection").hidden = !show;
    if (!show) return;
    $("pendingCount").textContent = String(pend.length);
    var html = "";
    pend.forEach(function (x) {
      html += taskHtml(x, { showDayBadge: true });
    });
    $("pendingList").innerHTML = html;
  }

  function render() {
    renderHeader();
    renderHero();
    renderDayNav();
    renderPending();
    renderGoals();
  }

  /* ------------------------------ popups ------------------------------ */

  function openDayModal(cfg) {
    $("modalIcon").textContent = cfg.icon;
    $("modalTitle").textContent = cfg.title;
    $("modalBody").innerHTML = cfg.body;
    var actions = document.querySelector("#dayModal .modal-actions");
    actions.innerHTML =
      (cfg.secondary
        ? '<button type="button" class="btn btn-soft" id="modalSecondary">' +
          escapeHtml(cfg.secondary) + "</button>"
        : "") +
      '<button type="button" class="btn btn-primary" id="modalOk">' +
      escapeHtml(cfg.ok || "Got it") + "</button>";
    $("modalOk").addEventListener("click", closeDayModal);
    if (cfg.secondary && cfg.onSecondary) {
      $("modalSecondary").addEventListener("click", cfg.onSecondary);
    }
    $("dayModal").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeDayModal() {
    $("dayModal").hidden = true;
    document.body.style.overflow = "";
  }

  function showDayChangePopup() {
    var idx = currentPlanDayIndex();
    var pend = pendingItems();
    var name = (state.profile && state.profile.name) || "friend";

    if (pend.length === 0) {
      if (idx === 0) return; /* first day — nothing to celebrate yet */
      var prev = planDayDoneCount(idx - 1);
      if (prev.total === 0 || prev.done < prev.total) return;

      var allDone = overallProgress();
      var planComplete = idx === totalPlanDays() - 1 && allDone.done === allDone.total;

      openDayModal({
        icon: "🎉",
        title: planComplete ? "You completed the whole plan!" : "Yesterday's goals — done!",
        body:
          '<p class="confetti-line">Fantastic work, ' + escapeHtml(name) + "!</p>" +
          "<p>" + (planComplete
            ? "Every single goal of the <b>" + escapeHtml(plan().name) +
              "</b> is complete. Take a proud bow — you earned it. 🏆"
            : "You completed <b>all " + prev.total + " goals</b> of Day " + idx +
              ". Keep this momentum going!") + "</p>",
        ok: "Let's go!",
      });
      return;
    }

    /* Pending tasks exist → reminder popup (cross mark + Got it to close). */
    var prevC = idx > 0 ? planDayDoneCount(idx - 1) : null;
    var prevDoneTxt = prevC && prevC.total > 0 && prevC.done === prevC.total
      ? "<p>Nice work on Day " + idx + " — but some earlier goals are still pending.</p>"
      : "<p>Some goals from earlier days are still unfinished.</p>";

    var listHtml = "";
    pend.slice(0, 8).forEach(function (x) {
      listHtml +=
        '<li><span class="dnum">Day ' + (x.planDay + 1) + "</span><span>" +
        escapeHtml(x.syllabusDay.dayBn) + " · " + escapeHtml(x.task.subject) + "</span></li>";
    });
    if (pend.length > 8) {
      listHtml += '<li><span class="dnum">+ more</span><span>' +
        (pend.length - 8) + " more pending goals…</span></li>";
    }

    openDayModal({
      icon: "⏳",
      title: "You have " + pend.length + " pending goal" + (pend.length > 1 ? "s" : ""),
      body:
        "<p>Good to see you again, " + escapeHtml(name) + "! " +
        "Here's what is waiting for you:</p>" +
        '<ul class="modal-pending-list">' + listHtml + "</ul>" +
        prevDoneTxt,
      ok: "Got it",
      secondary: "View pending goals",
      onSecondary: function () {
        closeDayModal();
        viewDay = currentPlanDayIndex();
        render();
        $("pendingSection").scrollIntoView({ behavior: "smooth", block: "start" });
      },
    });
  }

  function maybeCelebrateDayComplete(wasAllDoneBefore) {
    if (wasAllDoneBefore) return;
    var idx = currentPlanDayIndex();
    if (viewDay !== idx) return;
    var r = planDayDoneCount(idx);
    if (r.total === 0 || r.done < r.total) return;

    var name = (state.profile && state.profile.name) || "friend";
    openDayModal({
      icon: "🌟",
      title: "Day " + (idx + 1) + " complete!",
      body:
        '<p class="confetti-line">Brilliant, ' + escapeHtml(name) + "! 🎊</p>" +
        "<p>All of today's goals are ticked off. Rest well — tomorrow is a new day.</p>",
      ok: "Thanks!",
    });
  }

  /* ------------------------------ events ------------------------------ */

  function toggleTask(id, checked) {
    var wasAll = planDayDoneCount(viewDay);
    var wasAllDone = wasAll.total > 0 && wasAll.done === wasAll.total;

    if (checked) state.checks[id] = true;
    else delete state.checks[id];
    saveState();
    render();

    if (checked) maybeCelebrateDayComplete(wasAllDone);
  }

  function onTaskListChange(e) {
    var input = e.target;
    if (input && input.matches && input.matches('input[type="checkbox"][data-id]')) {
      toggleTask(input.getAttribute("data-id"), input.checked);
    }
  }

  function markAllCurrent() {
    var items = tasksOfPlanDay(viewDay);
    var wasAll = planDayDoneCount(viewDay);
    var wasAllDone = wasAll.total > 0 && wasAll.done === wasAll.total;

    items.forEach(function (x) {
      if (wasAllDone) delete state.checks[x.task.id];
      else state.checks[x.task.id] = true;
    });
    saveState();
    render();
    if (!wasAllDone) maybeCelebrateDayComplete(false);
  }

  function selectInGroup(container, attr, value) {
    Array.prototype.forEach.call(container.querySelectorAll("[" + attr + "]"), function (btn) {
      var sel = btn.getAttribute(attr) === value;
      btn.classList.toggle("selected", sel);
      btn.setAttribute("aria-checked", sel ? "true" : "false");
    });
  }

  /* --------------------------- onboarding --------------------------- */

  var onbGender = null;

  function fillAvatarPreviews() {
    Array.prototype.forEach.call(
      document.querySelectorAll("[data-avatar]"),
      function (el) {
        AV.render(el, el.getAttribute("data-avatar"), 62);
      }
    );
  }

  function initOnboarding() {
    fillAvatarPreviews();
    selectInGroup($("onbPlan"), "data-plan", "75");

    $("onbGender").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-gender]");
      if (!btn) return;
      onbGender = btn.getAttribute("data-gender");
      selectInGroup($("onbGender"), "data-gender", onbGender);
    });

    $("onbPlan").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-plan]");
      if (!btn) return;
      selectInGroup($("onbPlan"), "data-plan", btn.getAttribute("data-plan"));
    });

    $("onbStart").addEventListener("click", function () {
      var nameInput = $("onbName");
      var name = nameInput.value.trim();
      var planBtn = $("onbPlan").querySelector(".selected");
      if (!name) {
        nameInput.classList.add("invalid");
        nameInput.focus();
        return;
      }
      nameInput.classList.remove("invalid");
      if (!onbGender) {
        $("onbGender").querySelectorAll(".gender-card").forEach(function (g) {
          g.style.borderColor = "#ef4444";
          setTimeout(function () { g.style.borderColor = ""; }, 1200);
        });
        return;
      }

      state.profile = { name: name, gender: onbGender };
      state.planId = planBtn ? planBtn.getAttribute("data-plan") : "75";
      var t = todayISO();
      planState().startDate = t;
      planState().lastOpenDate = t;
      viewDay = 0;
      saveState();
      $("onboarding").hidden = true;
      document.body.style.overflow = "";
      render();
    });

    $("onboarding").hidden = false;
    document.body.style.overflow = "hidden";
    $("onbName").focus();
  }

  /* ----------------------------- settings ----------------------------- */

  var setGenderVal = null;

  function openSettings() {
    fillAvatarPreviews();
    $("setName").value = state.profile ? state.profile.name : "";
    setGenderVal = state.profile && state.profile.gender === "female" ? "female" : "male";
    selectInGroup($("setGender"), "data-gender", setGenderVal);
    selectInGroup($("setPlan"), "data-plan", state.planId);
    $("setStartDate").value = planState().startDate || todayISO();
    $("settingsModal").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeSettings() {
    /* apply name */
    var name = $("setName").value.trim();
    if (name && state.profile) state.profile.name = name;

    /* apply gender */
    if (setGenderVal && state.profile) state.profile.gender = setGenderVal;

    /* apply plan selection */
    var planBtn = $("setPlan").querySelector(".selected");
    if (planBtn) {
      var newPlan = planBtn.getAttribute("data-plan");
      if (newPlan !== state.planId) {
        state.planId = newPlan;
        if (!planState().startDate) {
          planState().startDate = todayISO();
          planState().lastOpenDate = todayISO();
        }
      }
    }

    /* apply start date */
    var sd = $("setStartDate").value;
    if (sd) planState().startDate = sd;

    viewDay = currentPlanDayIndex();
    saveState();
    $("settingsModal").hidden = true;
    document.body.style.overflow = "";
    render();
  }

  function exportProgress() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "so-planner-progress-" + todayISO() + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function importProgress(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== "object" || !parsed.checks) {
          throw new Error("bad file");
        }
        localStorage.setItem(STORE_KEY, JSON.stringify(parsed));
        location.reload();
      } catch (e) {
        alert("Could not import that file. Please choose a SO Planner progress JSON.");
      }
    };
    reader.readAsText(file);
  }

  /* ------------------------------- init ------------------------------- */

  function init() {
    /* checkbox ticks (event delegation for both lists) */
    $("goalList").addEventListener("change", onTaskListChange);
    $("pendingList").addEventListener("change", onTaskListChange);

    $("markAllBtn").addEventListener("click", markAllCurrent);

    /* day navigation */
    $("prevDay").addEventListener("click", function () {
      if (viewDay > 0) { viewDay--; render(); }
    });
    $("nextDay").addEventListener("click", function () {
      if (viewDay < totalPlanDays() - 1) { viewDay++; render(); }
    });
    $("todayBtn").addEventListener("click", function () {
      viewDay = currentPlanDayIndex();
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    $("dayMap").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-day]");
      if (!btn) return;
      viewDay = +btn.getAttribute("data-day");
      render();
      document.querySelector(".goals-card").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    /* day-change modal close — cross mark, Got it, backdrop, Esc */
    $("modalClose").addEventListener("click", closeDayModal);
    $("dayModal").addEventListener("click", function (e) {
      if (e.target === $("dayModal")) closeDayModal();
    });

    /* settings */
    $("settingsBtn").addEventListener("click", openSettings);
    $("settingsClose").addEventListener("click", closeSettings);
    $("settingsDone").addEventListener("click", closeSettings);
    $("settingsModal").addEventListener("click", function (e) {
      if (e.target === $("settingsModal")) closeSettings();
    });
    $("setGender").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-gender]");
      if (!btn) return;
      setGenderVal = btn.getAttribute("data-gender");
      selectInGroup($("setGender"), "data-gender", setGenderVal);
    });
    $("setPlan").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-plan]");
      if (!btn) return;
      selectInGroup($("setPlan"), "data-plan", btn.getAttribute("data-plan"));
    });
    $("exportBtn").addEventListener("click", exportProgress);
    $("importBtn").addEventListener("click", function () { $("importFile").click(); });
    $("importFile").addEventListener("change", function () {
      if (this.files && this.files[0]) importProgress(this.files[0]);
      this.value = "";
    });
    $("resetBtn").addEventListener("click", function () {
      if (confirm("Reset everything? This clears your profile, plan and all ticks.")) {
        localStorage.removeItem(STORE_KEY);
        location.reload();
      }
    });

    /* Esc closes overlays */
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (!$("dayModal").hidden) closeDayModal();
      else if (!$("settingsModal").hidden) closeSettings();
    });

    /* first run vs returning user */
    if (!state.profile) {
      initOnboarding();
    } else {
      var t = todayISO();
      var ps = planState();
      if (!ps.startDate) {
        ps.startDate = t;
        ps.lastOpenDate = t;
        saveState();
      } else if (ps.lastOpenDate !== t) {
        var dateChanged = true;
        ps.lastOpenDate = t;
        viewDay = currentPlanDayIndex();
        saveState();
        render();
        if (dateChanged) showDayChangePopup();
        return;
      } else {
        viewDay = currentPlanDayIndex();
      }
      render();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
