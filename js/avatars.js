/* Inline SVG avatars by gender — no network needed. */
(function () {
  "use strict";

  var uid = 0;

  var STYLES = {
    male: {
      bg: ["#6366f1", "#22d3ee"],
      hair: "#2e2a4a",
      hairBack: '<rect x="27" y="17" width="42" height="36" rx="17" fill="HAIR"/>',
      fringe:
        '<path d="M29 40 C29 24 37 17 48 17 C59 17 67 24 67 40 C63 33 59 30 53 29 C47 28 42 31 36 33 C33 34 30 36 29 40 Z" fill="HAIR"/>',
      shirt: ["#4f46e5", "#6366f1"],
      extras: "",
    },
    female: {
      bg: ["#d946ef", "#8b5cf6"],
      hair: "#54306b",
      hairBack: '<rect x="23" y="15" width="50" height="62" rx="23" fill="HAIR"/>',
      fringe:
        '<path d="M30 38 C31 22 38 16 48 16 C58 16 65 22 66 38 C61 29 54 27 48 29 C41 31 34 31 30 38 Z" fill="HAIR"/>',
      shirt: ["#db2777", "#f472b6"],
      extras:
        '<circle cx="29.5" cy="48" r="2.4" fill="#fbbf24"/><circle cx="66.5" cy="48" r="2.4" fill="#fbbf24"/>',
    },
    other: {
      bg: ["#14b8a6", "#6366f1"],
      hair: "#1f5f5b",
      hairBack: '<rect x="26" y="16" width="44" height="42" rx="18" fill="HAIR"/>',
      fringe:
        '<path d="M29 39 C30 23 37 16 48 16 C59 16 66 23 67 39 C62 32 55 31 49 32 C43 33 36 32 29 39 Z" fill="HAIR"/>',
      shirt: ["#0d9488", "#2dd4bf"],
      extras:
        '<g fill="none" stroke="#22304a" stroke-width="2"><circle cx="41" cy="42" r="5.5"/><circle cx="55" cy="42" r="5.5"/><path d="M46.5 42 h3"/></g>',
    },
  };

  /**
   * Build a standalone SVG avatar string.
   * @param {"male"|"female"|"other"} gender
   * @param {number} size — rendered px size (square)
   */
  function svg(gender, size) {
    var st = STYLES[gender] || STYLES.other;
    var id = "av" + ++uid;
    var skin = "#f2c19a";
    var s = size || 48;

    return (
      '<svg class="avatar-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="' +
      s +
      '" height="' +
      s +
      '" role="img" aria-label="' +
      (gender || "other") +
      ' avatar">' +
      "<defs>" +
      '<linearGradient id="bg' +
      id +
      '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' +
      st.bg[0] +
      '"/><stop offset="1" stop-color="' +
      st.bg[1] +
      '"/></linearGradient>' +
      '<linearGradient id="sh' +
      id +
      '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' +
      st.shirt[0] +
      '"/><stop offset="1" stop-color="' +
      st.shirt[1] +
      '"/></linearGradient>' +
      "</defs>" +
      '<circle cx="48" cy="48" r="48" fill="url(#bg' +
      id +
      ')"/>' +
      /* shoulders / shirt */
      '<path d="M20 96 C20 79 32 71 48 71 C64 71 76 79 76 96 Z" fill="url(#sh' +
      id +
      ')"/>' +
      /* hair behind the head */
      st.hairBack.replace("HAIR", st.hair) +
      /* neck */
      '<rect x="42" y="52" width="12" height="16" rx="6" fill="' +
      skin +
      '"/>' +
      /* ears + head */
      '<circle cx="30" cy="43" r="3.6" fill="' +
      skin +
      '"/><circle cx="66" cy="43" r="3.6" fill="' +
      skin +
      '"/>' +
      '<circle cx="48" cy="41" r="18.5" fill="' +
      skin +
      '"/>' +
      /* fringe over the forehead */
      st.fringe.replace("HAIR", st.hair) +
      /* face */
      '<ellipse cx="41" cy="43" rx="2.2" ry="3" fill="#2c2540"/>' +
      '<ellipse cx="55" cy="43" rx="2.2" ry="3" fill="#2c2540"/>' +
      '<circle cx="35.5" cy="49.5" r="3.2" fill="#f7a1a1" opacity="0.45"/>' +
      '<circle cx="60.5" cy="49.5" r="3.2" fill="#f7a1a1" opacity="0.45"/>' +
      '<path d="M42 51.5 Q48 56.5 54 51.5" fill="none" stroke="#2c2540" stroke-width="2.2" stroke-linecap="round"/>' +
      st.extras +
      "</svg>"
    );
  }

  /** Fill a container element with an avatar for the given gender. */
  function render(el, gender, size) {
    if (el) el.innerHTML = svg(gender, size);
  }

  window.SOP_AVATARS = { svg: svg, render: render };
})();
