# SO Planner

**Bank Job preparation Routine** — a local, persistent, fully **offline** web page
for a day-wise study routine (days 1–75) with two plans.

## Features

- **Two plans**
  - **75-Day Plan** — steady pace, one syllabus day at a time.
  - **37-Day Plan** — fast pace, about two syllabus days per plan day.
- **First open** asks for your **name and gender** and gives you a matching
  **avatar**.
- **Landing page** shows the current day's goals as a **to-do list with tick marks**.
- **Progress meter** — overall ring, today's bar, streak counter and a clickable
  day map (green = day complete, amber = in progress).
- **Next-day check-in**
  - Previous day's goals all met → congratulation popup 🎉
  - Any unfinished → reminder popup listing pending tasks, with a **✕ close
    button**; pending goals are also shown **above the current day's goals**.
- **Theme** — modern, rounded cards, subtle shadows, soft gradient color scheme,
  educational vibe. Responsive down to phones.
- **Persistent** — profile, ticks and plan dates are stored in the browser
  (`localStorage`); export/import progress as JSON from Settings.

Works with no server and no internet: just open `index.html` in a browser
(double-click it). Everything runs offline.

## Structure

```
index.html            — the web page (open this)
css/styles.css        — theme
js/data.js            — generated routine data (do not edit directly)
js/avatars.js         — inline SVG avatars (male / female / other)
js/app.js             — app logic (state, checklist, popups, progress)
tools/build_data.py   — rebuilds js/data.js
tools/extension_content.py — editable topic content for days 21–75
Day Wise Routine.xlsx — source syllabus for days 1–20
```

## Routine data

- **Days 1–20** come verbatim from `Day Wise Routine.xlsx` (subjects, topics and
  books exactly as written there).
- **Days not yet in the spreadsheet** are filled with placeholder content that
  continues the same subject rotation and book list (see
  `tools/extension_content.py`). Today that is days 21–75.

### Updating the routine later (e.g. adding days 21–75 to the Excel)

The page reads the pre-built `js/data.js`, not the Excel directly. After editing
the spreadsheet:

```bash
pip install openpyxl   # once
python3 tools/build_data.py
```

Then just **refresh the page** in your browser — that's it. The builder always
merges the same way:

- whatever days exist in the Excel are used **exactly as written**;
- only the days **missing** from the Excel get placeholder content;
- interior gaps are filled too (e.g. if day 7 is missing from the sheet).

**Your progress is never reset.** Ticks, profile, streak and plan dates live in
the browser's `localStorage` and are keyed by day + task position
(`d<day>-<index>`), so they survive every data rebuild. Only caveat: if you
*reorder or delete* tasks **within** an existing day, ticks follow the task
position and may shift; adding tasks at the end of a day is always safe.

## Notes

- Progress is per browser/device. Use **Settings → Export progress** to back up
  or move your ticks to another device.
- **Settings** also lets you change your name, gender/avatar, plan, and the
  current plan's start date (the "current day" is derived from the start date).
- Switching plans keeps all ticked tasks; each plan remembers its own start date.
