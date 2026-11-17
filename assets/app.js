/* 숫자곳간 - 화면 동작
   데이터: data/summaries.js (tools/build_site.py 가 만듦) 또는 data/sample.js (예시)
   인터넷 연결 없이, 파일을 더블클릭해서 열어도 동작하도록 만들었어요. */
function main() {
  "use strict";

  var REAL = window.SUMMARIES || null;
  var DATA = REAL || window.SAMPLE_SUMMARIES || { meta: { total: 45 }, lectures: [] };
  var USING_SAMPLE = !REAL;
  var LECTURES = (DATA.lectures || []).slice();
  LECTURES.forEach(function (l) {
    l.category = l.category || "법인세";
    l.site = l.site || "택스에듀넷";
    l.id = l.id || (l.category + "-" + l.site + "-" + l.no);
    l.date = l.date || l.updated || "";
  });
  LECTURES.sort(function (a, b) { return a.category.localeCompare(b.category) || a.site.localeCompare(b.site) || a.no - b.no; });
  var META = DATA.meta || {};
  var DICT = (DATA.dict || []).slice().sort(function (a, b) { return a.category.localeCompare(b.category) || a.title.localeCompare(b.title); });
  // 사전 항목을 검색·조문 연결에서 강의처럼 다룰 수 있게 해 줘요
  DICT.forEach(function (d) { d._lec = { id: "dict-" + d.id, category: "법인세", keywords: d.keywords || [], title: d.title, isDict: true }; });
  function dictHref(d, sec) { return "#/dict/" + encodeURIComponent(d.id) + (sec ? "/" + sec : ""); }
  var app = document.getElementById("app");

  /* ---------- 작은 도우미 ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function findLecture(id) {
    for (var i = 0; i < LECTURES.length; i++) if (LECTURES[i].id === id) return LECTURES[i];
    for (i = 0; i < LECTURES.length; i++) if (String(LECTURES[i].no) === String(id)) return LECTURES[i];
    return null;
  }
  function lecLabel(l) { return l.no + "강. " + l.title; }
  function lecHref(l, sub) { return "#/lecture/" + encodeURIComponent(l.id) + (sub ? "/" + sub : ""); }
  function courses() {
    var list = [];
    (META.courses || []).forEach(function (c) { list.push({ category: c.category, site: c.site, total: c.total }); });
    LECTURES.forEach(function (l) {
      if (!list.some(function (c) { return c.category === l.category && c.site === l.site; })) list.push({ category: l.category, site: l.site });
    });
    list.forEach(function (c) {
      c.items = LECTURES.filter(function (l) { return l.category === c.category && l.site === c.site; });
      if (!c.total && c.category === "법인세" && c.site === "택스에듀넷") c.total = META.total;
    });
    return list;
  }
  function store(key, val) {
    try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { return null; }
  }

  /* 한국어 굵은 글씨(**...**) 뒤에 조사가 붙으면 마크다운이 굵게 처리하지 못해서 미리 바꿔 둬요. */
  function prepMarkdown(md) {
    md = String(md || "").replace(/^---[\s\S]*?\n---\s*\n/, "");
    return md.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
  }
  function plain(md) {
    return String(md || "")
      .replace(/<[^>]+>/g, "")
      .replace(/\*\*|__|`/g, "")
      .replace(/^\s*[>#|-]+\s?/gm, "")
      .replace(/\|/g, " ")
      .replace(/[ \t]+/g, " ")
      .trim();
  }

  /* ---------- 강의 본문 꾸미기 ---------- */
  var LAW_RE = /((?:국제조세조정에 관한 법률|고용보험 및 산업재해보상보험의 보험료징수 등에 관한 법률|근로자퇴직급여 보장법|주식회사 등의 외부감사에 관한 법률|상법|민법|[가-힣]{1,15}법)\s*)?((?:시행령|시행규칙)\s*)?제\d+조(?:의\d+)?(?:\s*제\d+항)?(?:\s*제\d+호)?/g;

  function badgeLaws(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [], n;
    while ((n = walker.nextNode())) {
      if (n.parentNode.closest("th, code, .law, h1, h2, h3, .toc")) continue;
      LAW_RE.lastIndex = 0;
      if (LAW_RE.test(n.nodeValue)) nodes.push(n);
    }
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment(), text = node.nodeValue, last = 0, m;
      LAW_RE.lastIndex = 0;
      while ((m = LAW_RE.exec(text))) {
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        var span = document.createElement("span");
        span.className = "law";
        span.textContent = m[0];
        frag.appendChild(span);
        last = m.index + m[0].length;
      }
      frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  function makeCases(root) {
    var ps = Array.prototype.slice.call(root.querySelectorAll(":scope > p"));
    ps.forEach(function (p) {
      var first = p.firstElementChild;
      if (!first || first.tagName !== "STRONG" || p.firstChild !== first) return;
      if (!/^\s*사례\s*\d*/.test(first.textContent)) return;
      var box = document.createElement("div");
      box.className = "case";
      p.parentNode.insertBefore(box, p);
      var cur = p;
      do {
        var next = cur.nextElementSibling;
        box.appendChild(cur);
        cur = next;
      } while (cur && !/^(H1|H2|H3|HR)$/.test(cur.tagName) &&
               !(cur.tagName === "P" && cur.firstElementChild && cur.firstChild === cur.firstElementChild &&
                 cur.firstElementChild.tagName === "STRONG" && /^\s*사례/.test(cur.firstElementChild.textContent)));
    });
  }

  function renderMarkdown(md) {
    var div = document.createElement("div");
    div.innerHTML = window.marked ? window.marked.parse(prepMarkdown(md), { gfm: true, breaks: true }) : "<pre>" + esc(md) + "</pre>";
    var sec = 0;
    div.querySelectorAll("h2, h3").forEach(function (h) { h.id = "sec-" + (++sec); });
    div.querySelectorAll("table").forEach(function (t) {
      var w = document.createElement("div");
      w.className = "table-wrap";
      t.parentNode.insertBefore(w, t);
      w.appendChild(t);
    });
    div.querySelectorAll("blockquote").forEach(function (b) {
      if (/^\s*(⚠|주의|개정)/.test(b.textContent)) b.classList.add("warn");
    });
    // 표에서 '조문' 열은 칸 전체를 조문 배지로 보여 줘요
    div.querySelectorAll("table").forEach(function (t) {
      var col = -1;
      t.querySelectorAll("thead th").forEach(function (th, i) { if (col === -1 && /조문|근거/.test(th.textContent)) col = i; });
      if (col === -1) return;
      t.querySelectorAll("tbody tr").forEach(function (tr) {
        var td = tr.children[col];
        if (!td || !/제\d+조/.test(td.textContent)) return;
        var span = document.createElement("span");
        span.className = "law cell";
        while (td.firstChild) span.appendChild(td.firstChild);
        td.appendChild(span);
      });
    });
    makeCases(div);
    badgeLaws(div);
    labelTables(div);
    return div;
  }

  /* ---------- 검색 ---------- */
  var INDEX = null;
  function buildIndex() {
    if (INDEX) return INDEX;
    INDEX = [];
    LECTURES.forEach(function (l) {
      var lines = String(l.md || "").replace(/^---[\s\S]*?\n---\s*\n/, "").split(/\r?\n/);
      var sec = 0, h2 = "", heading = "", secId = "", buf = [];
      function flush() {
        var md = buf.join("\n").trim();
        buf = [];
        if (!md) return;
        // 사례는 따로 떼어서 더 정확히 찾을 수 있게 해요
        var parts = md.split(/\n(?=\*\*\s*사례)/);
        parts.forEach(function (part) {
          var cm = part.match(/^\*\*\s*(사례[^*]*)\*\*/);
          INDEX.push({
            lec: l, secId: secId,
            heading: cm ? (heading ? heading + " › " : "") + cm[1].trim() : (heading || "개요"),
            md: part, text: plain(part).toLowerCase()
          });
        });
      }
      lines.forEach(function (line) {
        var m = line.match(/^(#{1,3})\s+(.*)$/);
        if (m) {
          if (m[1].length === 1) { return; }
          flush();
          sec++;
          secId = "sec-" + sec;
          var t = m[2].replace(/\*\*/g, "").trim();
          if (m[1].length === 2) { h2 = t; heading = t; } else { heading = h2 ? h2 + " › " + t : t; }
          buf.push(line);
          return;
        }
        buf.push(line);
      });
      flush();
      ["qa", "my"].forEach(function (kind) {
        notesList(l, kind).forEach(function (x) {
          INDEX.push({ lec: l, secId: x.id, kind: kind, heading: NOTE_KIND[kind].head + " › " + x.q, md: "**Q. " + x.q + "**\n\n" + x.a,
            text: plain(x.q + "\n" + x.a).toLowerCase() });
        });
      });
    });
    DICT.forEach(function (d) {
      var sec = 0, head = "", buf = [];
      function flush() {
        var md = buf.join("\n").trim(); buf = [];
        if (!md) return;
        INDEX.push({ lec: d._lec, secId: "sec-" + sec, heading: d.title + (head ? " › " + head : ""), md: md, text: plain(d.title + "\n" + md).toLowerCase(),
          href: dictHref(d, sec ? "sec-" + sec : ""), src: "세무 사전", short: "사전" });
      }
      String(d.md || "").split(/\r?\n/).forEach(function (line) {
        var m = line.match(/^(#{2,3})\s+(.*)$/);
        if (m) { flush(); sec++; head = m[2].replace(/\*\*/g, "").trim(); }
        buf.push(line);
      });
      flush();
    });
    return INDEX;
  }

  var JOSA = ["으로부터", "에서는", "에게서", "이라면", "인가요", "인지요", "하려면", "하는법", "하는", "되나요", "에서", "으로", "까지", "부터", "에게", "이란", "이랑", "하고", "인지", "은", "는", "이", "가", "을", "를", "에", "의", "도", "로", "와", "과", "만", "란", "요"];
  function variants(tok) {
    var out = [tok];
    JOSA.forEach(function (j) {
      if (tok.length > j.length + 1 && tok.slice(-j.length) === j) out.push(tok.slice(0, -j.length));
    });
    for (var k = tok.length - 1; k >= 2; k--) out.push(tok.slice(0, k));
    return out.filter(function (v, i) { return out.indexOf(v) === i; });
  }
  function countOf(text, w) {
    var c = 0, i = 0;
    while ((i = text.indexOf(w, i)) !== -1) { c++; i += w.length; }
    return c;
  }
  function search(q) {
    var idx = buildIndex();
    var toks = String(q || "").toLowerCase().split(/[\s,.?!·~"'()\[\]{}:;/]+/).filter(function (t) { return t.length >= 2 || /\d/.test(t); });
    if (!toks.length) return { terms: [], results: [] };
    // 전체 요약본에 실제로 나오는 형태로 단어를 맞춰요 (예: "연장은" → "연장")
    var all = idx.map(function (c) { return c.text; }).join("\n");
    var terms = [];
    toks.forEach(function (t) {
      var vs = variants(t);
      for (var i = 0; i < vs.length; i++) if (all.indexOf(vs[i]) !== -1) { terms.push(vs[i]); return; }
    });
    terms = terms.filter(function (v, i) { return terms.indexOf(v) === i; });
    if (!terms.length) return { terms: [], results: [] };
    var results = [];
    idx.forEach(function (c) {
      var score = 0, hit = 0, head = c.heading.toLowerCase();
      var kws = (c.lec.keywords || []).join(" ").toLowerCase();
      terms.forEach(function (t) {
        var n = countOf(c.text, t);
        if (n) { hit++; score += (1 + Math.log(n)) * Math.min(t.length, 6); }
        if (head.indexOf(t) !== -1) score += 6;
        if (kws.indexOf(t) !== -1) score += 1.5;
      });
      if (!hit) return;
      score *= hit / terms.length;
      if (hit === terms.length && terms.length > 1) score *= 1.5;
      results.push({ c: c, score: score });
    });
    results.sort(function (a, b) { return b.score - a.score; });
    return { terms: terms, results: results.slice(0, 30) };
  }
  function highlight(root, terms) {
    if (!terms.length) return;
    var re = new RegExp("(" + terms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")", "gi");
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), nodes = [], n;
    while ((n = walker.nextNode())) { re.lastIndex = 0; if (re.test(n.nodeValue)) nodes.push(n); }
    nodes.forEach(function (node) {
      var span = document.createElement("span");
      span.innerHTML = esc(node.nodeValue).replace(re, "<mark>$1</mark>");
      node.parentNode.replaceChild(span, node);
    });
  }
  function snippet(text, terms, len) {
    len = len || 140;
    var pos = -1;
    terms.forEach(function (t) { var p = text.indexOf(t); if (p !== -1 && (pos === -1 || p < pos)) pos = p; });
    var start = Math.max(0, pos - 40);
    var s = (start > 0 ? "…" : "") + text.slice(start, start + len) + (start + len < text.length ? "…" : "");
    return s.replace(/\n+/g, " ");
  }

  /* ---------- 법령 조문 전체 (data/laws.js, tools/fetch_laws.py 가 받아요) ---------- */
  var LAWIDX = null, LAWALL = "";
  function loadLaws(cb) {
    if (window.LAWS) { buildLawIdx(); cb(true); return; }
    if (loadLaws.failed) { cb(false); return; }
    (loadLaws.wait = loadLaws.wait || []).push(cb);
    if (loadLaws.wait.length > 1) return;
    var sc = document.createElement("script");
    sc.src = "data/laws.js";
    sc.onload = function () { buildLawIdx(); var w = loadLaws.wait; loadLaws.wait = []; w.forEach(function (f) { f(!!window.LAWS); }); };
    sc.onerror = function () { loadLaws.failed = true; var w = loadLaws.wait; loadLaws.wait = []; w.forEach(function (f) { f(false); }); };
    document.head.appendChild(sc);
  }
  function buildLawIdx() {
    if (LAWIDX || !window.LAWS) return;
    LAWIDX = [];
    var parts = [];
    (window.LAWS.laws || []).forEach(function (law) {
      (law.arts || []).forEach(function (a) {
        var low = (a[1] + "\n" + a[2]).toLowerCase();
        LAWIDX.push({ law: law.name, ef: law.ef, no: a[0], title: a[1], text: a[2], chapter: a[3] || "", low: low, key: law.name + " " + a[0] });
        parts.push(low);
      });
    });
    LAWALL = parts.join("\n");
  }
  function findArticle(key) {
    if (!LAWIDX) return null;
    for (var i = 0; i < LAWIDX.length; i++) if (LAWIDX[i].key === key) return LAWIDX[i];
    return null;
  }
  function searchLaws(q, limit) {
    if (!LAWIDX) return [];
    var out = [], seen = {};
    // "법인세법 제60조"처럼 조문을 바로 적으면 그 조문을 맨 앞에
    LAW_RE.lastIndex = 0;
    var m, cite = [];
    while ((m = LAW_RE.exec(q))) { var r = resolveLaw(m[0], null); if (r) cite.push(r.key); }
    cite.forEach(function (k) { var a = findArticle(k); if (a && !seen[k]) { seen[k] = 1; out.push(a); } });
    var rest = q.replace(LAW_RE, " ");
    var toks = String(rest || "").toLowerCase().split(/[\s,.?!·~"'()\[\]{}:;/]+/).filter(function (t) { return t.length >= 2; });
    var terms = [];
    toks.forEach(function (t) {
      var vs = variants(t);
      for (var i = 0; i < vs.length; i++) if (LAWALL.indexOf(vs[i]) !== -1) { terms.push(vs[i]); return; }
    });
    terms = terms.filter(function (v, i) { return terms.indexOf(v) === i; });
    if (terms.length) {
      var scored = [];
      LAWIDX.forEach(function (a) {
        var hit = 0, score = 0, tl = a.title.toLowerCase();
        terms.forEach(function (t) {
          var n = countOf(a.low, t);
          if (n) { hit++; score += (1 + Math.log(n)) * Math.min(t.length, 6); }
          if (tl.indexOf(t) !== -1) score += 12;
        });
        if (!hit) return;
        if (hit < terms.length) score *= 0.3 * hit / terms.length;
        else if (terms.length > 1) score *= 1.5;
        if (/시행규칙/.test(a.law)) score *= 0.8;
        scored.push({ a: a, s: score });
      });
      scored.sort(function (x, y) { return y.s - x.s; });
      scored.forEach(function (x) { if (!seen[x.a.key]) { seen[x.a.key] = 1; out.push(x.a); } });
    }
    return out.slice(0, limit || 10);
  }
  function lawTerms(q) {
    var toks = String(q || "").replace(LAW_RE, " ").toLowerCase().split(/[\s,.?!·~"'()\[\]{}:;/]+/).filter(function (t) { return t.length >= 2; });
    var terms = [];
    toks.forEach(function (t) { var vs = variants(t); for (var i = 0; i < vs.length; i++) if (LAWALL.indexOf(vs[i]) !== -1) { terms.push(vs[i]); return; } });
    return terms;
  }
  // 국세청 해석·판례는 원문 사이트에서 같은 검색어로 찾아요
  var OUT_LINKS = [
    { label: "국세청 해석(질의회신·예규)", url: function (q) { return "https://taxlaw.nts.go.kr/is/USEISA001M.do?schVcb=" + encodeURIComponent(q); } },
    { label: "판례(대법원 등)", url: function (q) { return "https://www.law.go.kr/LSW/precSc.do?menuId=7&query=" + encodeURIComponent(q); } },
    { label: "법령 원문", url: function (q) { return "https://www.law.go.kr/LSW/lsSc.do?menuId=1&query=" + encodeURIComponent(q); } }
  ];
  function outLinks(q) {
    return '<div class="out-links">' + OUT_LINKS.map(function (o) {
      return '<a class="btn ghost" href="' + esc(o.url(q)) + '" target="_blank" rel="noopener">' + esc(o.label) + ' ↗</a>';
    }).join("") + "</div>";
  }

  /* ---------- 검색창 아래 미리보기: 볼 조문 · 국세청 해석 · 강의 목차 ---------- */
  var RULING_RE = /\[((?:서면|사전|법규|기획재정부|조심|국심|법인세과|소득세과|원천세과|부가가치세과|기준)[^\]]*)\]\((https?:[^)\s]+)\)/g;
  function previewData(q) {
    var r = search(q);
    var lawHits = searchLaws(q, 4);
    if (!r.results.length && !lawHits.length) return null;
    var top = r.results.slice(0, 8), laws = [], seen = {}, rulings = [], seenR = {};
    function addLaw(rr, lec) { if (rr && !seen[rr.key]) { seen[rr.key] = 1; laws.push({ r: rr, lec: lec }); } }
    top.forEach(function (x) {
      var c = x.c, m;
      LAW_RE.lastIndex = 0;
      while ((m = LAW_RE.exec(c.md))) addLaw(resolveLaw(m[0], c.lec), c.lec);
      RULING_RE.lastIndex = 0;
      while ((m = RULING_RE.exec(c.md))) if (!seenR[m[1]]) { seenR[m[1]] = 1; rulings.push({ t: m[1], u: m[2], lec: c.lec }); }
    });
    // axtax(krlaw)로 정리해 둔 조문 요지에 검색어가 들어 있으면 함께 보여 줘요
    LECTURES.forEach(function (l) {
      var arts = (l.laws && l.laws.articles) || {};
      Object.keys(arts).forEach(function (k) {
        var hay = (k + " " + arts[k]).toLowerCase();
        if (r.terms.some(function (t) { return hay.indexOf(t) !== -1; })) {
          var mm = k.match(/^(.*?)\s*(제\d+조(?:의\d+)?)$/);
          if (mm) addLaw({ law: mm[1], article: mm[2], key: k }, l);
        }
      });
    });
    var secs = [], seenS = {};
    top.forEach(function (x) {
      var k = x.c.lec.id + "|" + x.c.secId;
      if (!seenS[k] && secs.length < 5) { seenS[k] = 1; secs.push(x.c); }
    });
    // 법령 조문 전체에서 찾은 조문을 앞에
    var fromLaw = lawHits.map(function (a) { return { r: { law: a.law, article: a.no, key: a.key }, lec: null, title: a.title }; });
    laws = fromLaw.concat(laws.filter(function (x) { return !fromLaw.some(function (y) { return y.r.key === x.r.key; }); }));
    return { laws: laws.slice(0, 8), rulings: rulings.slice(0, 5), secs: secs };
  }
  function renderPreview(box, q) {
    q = String(q || "").trim();
    var d = q.length >= 2 ? previewData(q) : null;
    if (!d) { box.hidden = true; box.innerHTML = ""; return; }
    box.innerHTML =
      (d.laws.length ? '<div class="pv-row"><div class="pv-h">볼 조문</div><div class="pv-chips">' + d.laws.map(function (x, i) {
        var has = LECTURES.some(function (o) { return o.laws && o.laws.articles && o.laws.articles[x.r.key]; });
        return '<button type="button" class="chip pv-law' + (has ? " has-note" : "") + '" data-i="' + i + '" title="현행 조문 보기">' +
          esc(x.r.key) + (x.title ? ' <span class="muted">' + esc(x.title) + "</span>" : "") + "</button>";
      }).join("") + "</div></div>" : "") +
      (d.rulings.length ? '<div class="pv-row"><div class="pv-h">국세청 해석</div><div class="pv-list">' + d.rulings.map(function (x) {
        return '<a href="' + esc(x.u) + '" target="_blank" rel="noopener">' + esc(x.t) + ' <span class="muted">↗</span></a>';
      }).join("") + "</div></div>" : "") +
      (d.secs.length ? '<div class="pv-row"><div class="pv-h">볼 강의 목차 · 사전</div><div class="pv-list">' + d.secs.map(function (c) {
        return '<a href="' + (c.href || lecHref(c.lec, c.secId)) + '"><span class="pv-src">' + esc(c.short || c.lec.no + "강") + "</span> " + esc(c.heading) + "</a>";
      }).join("") + "</div></div>" : "") +
      '<div class="pv-row"><div class="pv-h">원문 사이트에서 찾기</div>' + outLinks(q) + "</div>";
    box.querySelectorAll(".pv-law").forEach(function (b) {
      b.onclick = function () { var x = d.laws[+b.dataset.i]; openLaw(x.r, x.lec); };
    });
    box.hidden = false;
  }
  function attachPreview(input, box) {
    var t = null;
    input.addEventListener("input", function () {
      clearTimeout(t);
      t = setTimeout(function () { renderPreview(box, input.value); }, 180);
    });
    if (input.value) renderPreview(box, input.value);
    loadLaws(function (ok) { if (ok && input.value) renderPreview(box, input.value); });
  }

  /* ---------- 화면들 ---------- */
  function sampleNotice() {
    if (!USING_SAMPLE) return "";
    return '<div class="notice">지금은 <b>예시 화면</b>이에요. 내 컴퓨터의 요약본을 넣으려면 저장소 폴더에서 <b>사이트_업데이트.bat</b> 을 두 번 클릭해 주세요.</div>';
  }

  function viewHome() {
    var progress = courses().map(function (c) {
      var done = c.items.filter(function (l) { return !l.stub; }).length, total = c.total || done || 1, pct = Math.min(100, Math.round(done / total * 100));
      return '<div class="course-prog"><b>' + esc(c.category) + ' › ' + esc(c.site) + '</b>' +
        '<div class="progress"><span style="width:' + pct + '%"></span></div>' +
        '<span class="muted">' + (c.total ? c.total + '개 중 ' + done + '개 완료 (' + pct + '%)' : done + '개 정리됨') + '</span></div>';
    }).join("");
    var recent = LECTURES.filter(function (l) { return !l.stub; }).sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")) || b.no - a.no; }).slice(0, 3);
    app.innerHTML = sampleNotice() +
      '<h1 class="page-title">오늘도 한 걸음씩</h1>' +
      '<p class="page-sub">강의 요약과 실무 도구를 한곳에 모았어요.</p>' +
      '<div class="card course-progs">' + progress + '</div>' +
      '<h2 class="section-h">궁금한 내용 찾기</h2>' +
      '<form class="searchbox" id="homeSearch"><input name="q" placeholder="예: 신고기한 연장, 최초 사업연도" aria-label="검색어"><button class="btn">찾기</button></form>' +
      '<div class="card preview" id="homePv" hidden aria-live="polite"></div>' +
      (recent.length ? '<h2 class="section-h">최근 추가된 요약</h2><div class="lec-list">' + recent.map(lecItem).join("") + "</div>" : "") +
      '<h2 class="section-h">메뉴</h2><div class="grid">' +
        tile("#/lectures", "📘", "강의 요약", "세목 › 강의 사이트 › 강의별로 요약과 거래처 Q&A를 모아 봐요.") +
        tile("#/search", "🔎", "검색", "강의 요약·사전·세법 조문에서 찾고, 해석·판례로 이어 줘요.") +
        tile("#/dict", "📖", "나의 세무 사전", "블로그 주제마다 조문과 실무 포인트를 덧붙였어요.") +
        tile("#/clients", "📊", "거래처 현황", "엑셀을 열어서 보기만 해요. 저장하지 않아요.", true) +
        tile("#/calculator", "🧮", "통합고용세액공제 계산기", "인원 변동으로 공제액을 계산해요.", true) +
      "</div>";
    document.getElementById("homeSearch").onsubmit = function (e) {
      e.preventDefault();
      location.hash = "#/search?q=" + encodeURIComponent(this.q.value.trim());
    };
    attachPreview(document.getElementById("homeSearch").q, document.getElementById("homePv"));
  }
  function tile(href, ico, title, desc, soon) {
    return '<a class="card tile" href="' + href + '"><div class="big">' + ico + "</div><h3>" + esc(title) +
      (soon ? ' <span class="pill soon">준비 중</span>' : "") + "</h3><p>" + esc(desc) + "</p></a>";
  }
  function lecItem(l) {
    var kw = (l.keywords || []).slice(0, 5).join(" · ");
    return '<a class="card lec-item" href="' + lecHref(l, l.stub ? "my" : "") + '"><div class="lec-no">' + l.no + "</div><div><h3>" +
      esc(l.title) + (l.lecture_date ? ' <span class="lec-date">(' + esc(l.lecture_date) + ')</span>' : "") +
      (l.stub ? ' <span class="pill soon">요약 준비 중</span>' : "") +
      (l.qa ? ' <span class="pill soon">Q&amp;A ' + qaList(l).length + '</span>' : "") +
      (l.my ? ' <span class="pill mine">내 질문 ' + notesList(l, "my").length + '</span>' : "") + "</h3><p>" +
      esc([l.date ? "요약 " + l.date : "", l.length, kw].filter(Boolean).join("  |  ")) + "</p></div></a>";
  }

  var lecCat = "";
  function viewLectures() {
    var cs = courses(), cats = [];
    cs.forEach(function (c) { if (cats.indexOf(c.category) === -1) cats.push(c.category); });
    app.innerHTML = sampleNotice() +
      '<h1 class="page-title">강의 요약</h1>' +
      '<p class="page-sub">대분류(세목) › 중분류(강의 사이트) › 강의 순서로 모았어요. 총 ' + LECTURES.length + '개</p>' +
      '<div class="chips cat-chips" id="catChips">' + ['전체'].concat(cats).map(function (c) {
        return '<button type="button" class="chip' + ((lecCat || "전체") === c ? " on" : "") + '" data-cat="' + esc(c) + '">' + esc(c) + "</button>";
      }).join("") + "</div>" +
      '<div class="searchbox lec-filter"><input id="lecFilter" placeholder="강의 제목이나 키워드로 거르기" aria-label="강의 거르기"></div>' +
      '<div id="lecTree"></div>';
    var tree = document.getElementById("lecTree");
    function draw(f) {
      f = (f || "").trim().toLowerCase();
      var html = "", lastCat = "";
      cs.forEach(function (c) {
        if (lecCat && lecCat !== "전체" && c.category !== lecCat) return;
        var items = c.items.filter(function (l) {
          return !f || (l.no + " " + l.title + " " + l.date + " " + (l.keywords || []).join(" ")).toLowerCase().indexOf(f) !== -1;
        });
        if (f && !items.length) return;
        if (c.category !== lastCat) { html += '<h2 class="cat-h">' + esc(c.category) + "</h2>"; lastCat = c.category; }
        html += '<section class="site-group"><h3 class="site-h">' + esc(c.site) +
          ' <span class="muted">' + (c.total ? c.items.length + " / " + c.total + "강" : c.items.length + "강") + "</span></h3>" +
          '<div class="lec-list">' + (items.length ? items.map(lecItem).join("") : '<p class="muted">아직 정리된 강의가 없어요.</p>') + "</div></section>";
      });
      tree.innerHTML = html || '<p class="muted">맞는 강의가 없어요.</p>';
    }
    document.getElementById("catChips").onclick = function (e) {
      var b = e.target.closest("[data-cat]"); if (!b) return;
      lecCat = b.dataset.cat;
      this.querySelectorAll(".chip").forEach(function (x) { x.classList.toggle("on", x === b); });
      draw(document.getElementById("lecFilter").value);
    };
    document.getElementById("lecFilter").oninput = function () { draw(this.value); };
    draw("");
  }

  /* ---------- 강의 머리(분류 경로)와 탭: 요약 | 거래처 Q&A ---------- */
  function lecHead(l, tab) {
    var n = l.qa ? qaList(l).length : 0, nm = l.my ? notesList(l, "my").length : 0;
    return '<div class="lec-head"><div class="crumbs"><a href="#/lectures">' + esc(l.category) + '</a> › ' + esc(l.site) +
      ' › ' + esc(lecLabel(l)) + (l.lecture_date ? ' (' + esc(l.lecture_date) + ')' : "") +
      (l.date ? ' <span class="muted">· 요약 ' + esc(l.date) + '</span>' : "") + '</div>' +
      '<div class="tabs" role="tablist">' +
      '<a role="tab" class="tab' + (tab === "sum" ? " on" : "") + '" href="' + lecHref(l) + '">강의 요약</a>' +
      '<a role="tab" class="tab' + (tab === "qa" ? " on" : "") + '" href="' + lecHref(l, "qa") + '">거래처 예상 질문' + (n ? " " + n : "") + '</a>' +
      '<a role="tab" class="tab' + (tab === "my" ? " on" : "") + '" href="' + lecHref(l, "my") + '">내 질문' + (nm ? " " + nm : "") + '</a>' +
      "</div></div>";
  }
  function lecNav(l) {
    var i = LECTURES.indexOf(l), prev = LECTURES[i - 1], next = LECTURES[i + 1];
    if (prev && (prev.category !== l.category || prev.site !== l.site)) prev = null;
    if (next && (next.category !== l.category || next.site !== l.site)) next = null;
    return '<div class="doc-nav">' + (prev ? '<a class="card" href="' + lecHref(prev) + '">← ' + esc(lecLabel(prev)) + "</a>" : "<span></span>") +
      (next ? '<a class="card next" href="' + lecHref(next) + '">' + esc(lecLabel(next)) + " →</a>" : "<span></span>") + "</div>";
  }

  /* ---------- 강의별 질문 탭 ----------
     거래처 예상 질문: <이름>.qa.md / 내 질문: <이름>.my.md ('## 질문' 줄 아래에 답변) */
  var NOTE_KIND = {
    qa: { tab: "거래처 예상 질문", head: "거래처 질문", file: ".qa.md", q: "Q",
      sub: "거래처에서 자주 물어볼 만한 질문을 강의 내용으로 답해 두었어요. 답변은 상황에 맞게 다듬어 쓰세요." },
    my: { tab: "내 질문", head: "내 질문", file: ".my.md", q: "내",
      sub: "강의를 듣다 궁금했던 점이에요. 답은 axtax로 현행 조문과 국세청 해석(서면질의 회신 등)을 찾아 달았어요. 근거 문서는 눌러서 원문을 볼 수 있어요." }
  };
  function notesList(l, kind) {
    var key = "_" + kind;
    if (l[key]) return l[key];
    var out = [], cur = null;
    String(l[kind] || "").split(/\r?\n/).forEach(function (line) {
      var m = line.match(/^##\s+(.*)$/);
      if (m) { cur = { q: m[1].replace(/^Q\d*[.)]\s*/, "").trim(), a: [] }; out.push(cur); return; }
      if (cur) cur.a.push(line);
    });
    out.forEach(function (x, i) { x.a = x.a.join("\n").trim(); x.id = kind + "-" + (i + 1); });
    l[key] = out;
    return out;
  }
  function qaList(l) { return notesList(l, "qa"); }
  function viewQA(l, openId, kind) {
    kind = kind || "qa";
    var K = NOTE_KIND[kind], list = notesList(l, kind);
    var base = String(l.file || "강의").replace(/\.(my\.)?md$/, "");
    app.innerHTML = lecHead(l, kind) +
      '<p class="page-sub">' + esc(K.sub) + '</p>' +
      (list.length ? '<div class="qa-list">' + list.map(function (x, i) {
        return '<details class="card qa" id="' + x.id + '"' + (x.id === openId || (kind === "my" && list.length === 1) ? " open" : "") + '><summary><span class="qn">' + K.q + (i + 1) +
          '</span><span class="qq">' + esc(x.q) + '</span></summary><div class="doc qa-a" data-i="' + i + '"></div></details>';
      }).join("") + "</div>" :
      '<div class="card placeholder"><b>아직 질문이 없어요.</b><p class="muted" style="margin:6px 0 0">' +
      (kind === "my" ? "궁금한 점을 클로드에게 말해 주면 답을 찾아 여기에 달아 둘게요. (요약 폴더의 <code>" + esc(base) + ".my.md</code>)" :
        "요약 폴더에 <code>" + esc(base) + ".qa.md</code> 파일이 생기면 여기에 보여요.") + '</p></div>') + lecNav(l);
    app.querySelectorAll(".qa-a").forEach(function (box) {
      var x = list[+box.dataset.i];
      if (!x.a) { box.innerHTML = '<p class="muted">아직 답을 달지 않았어요.</p>'; return; }
      var md = renderMarkdown(x.a);
      box.appendChild(md);
      bindLaws(md, l);
      md.querySelectorAll('a[href^="http"]').forEach(function (a) { a.target = "_blank"; a.rel = "noopener"; });
    });
    document.title = lecLabel(l) + " " + K.head + " · 숫자곳간";
    var t = openId && document.getElementById(openId);
    if (t) { t.scrollIntoView(); t.classList.add("flash"); } else window.scrollTo(0, 0);
  }

  /* ---------- 조문 배지 → 현행 조문 (krlaw 확인본) + 국가법령정보센터 ---------- */
  var LAW_ALIAS = {
    "법인세": { "법": "법인세법", "령": "법인세법 시행령", "시행령": "법인세법 시행령", "칙": "법인세법 시행규칙", "규칙": "법인세법 시행규칙" },
    "부가가치세": { "법": "부가가치세법", "령": "부가가치세법 시행령", "시행령": "부가가치세법 시행령", "칙": "부가가치세법 시행규칙" },
    "소득세": { "법": "소득세법", "령": "소득세법 시행령", "시행령": "소득세법 시행령", "칙": "소득세법 시행규칙" }
  };
  var LAW_SHORT = { "국조법": "국제조세조정에 관한 법률", "조특법": "조세특례제한법", "국기법": "국세기본법", "국징법": "국세징수법",
    "부가세법": "부가가치세법", "외감법": "주식회사 등의 외부감사에 관한 법률" };
  function resolveLaw(text, l) {
    var t = String(text).replace(/\s+/g, " ").trim();
    var m = t.match(/^(.*?)\s*(제\d+조(?:의\d+)?)/);
    if (!m) return null;
    var name = m[1].trim(), alias = LAW_ALIAS[l && l.category] || LAW_ALIAS["법인세"];
    if (!name) name = "법";
    var sub = name.match(/^(.*?)\s*(시행령|시행규칙)$/);
    if (alias[name]) name = alias[name];
    else if (LAW_SHORT[name]) name = LAW_SHORT[name];
    else if (sub && sub[1]) name = (LAW_SHORT[sub[1]] || sub[1]) + " " + sub[2];
    else if (sub && !sub[1]) name = alias[sub[2]] || name;
    return { law: name, article: m[2], key: name + " " + m[2] };
  }
  function lawUrl(r) { return "https://www.law.go.kr/" + encodeURIComponent("법령") + "/" + encodeURIComponent(r.law.replace(/\s+/g, "")) + "/" + encodeURIComponent(r.article); }
  function bindLaws(root, l) {
    root.querySelectorAll(".law, .art").forEach(function (b) {
      if (b.dataset.bound) return;
      var r = resolveLaw(b.textContent, l);
      if (!r) return;
      b.dataset.bound = "1";
      b.classList.add("law-link");
      b.setAttribute("role", "button");
      b.setAttribute("tabindex", "0");
      b.title = r.key + " 현행 조문 보기";
      b.addEventListener("click", function (e) { e.preventDefault(); openLaw(r, l); });
      b.addEventListener("keydown", function (e) { if (e.key === "Enter") openLaw(r, l); });
    });
  }
  function openLaw(r, l) {
    var laws = (l && l.laws) || {}, arts = laws.articles || {}, note = arts[r.key];
    if (!note) LECTURES.some(function (o) {
      var a = o.laws && o.laws.articles;
      if (a && a[r.key]) { laws = o.laws; note = a[r.key]; return true; }
    });
    var sheet = document.getElementById("lawSheet");
    if (!sheet) {
      sheet = document.createElement("div");
      sheet.id = "lawSheet";
      sheet.innerHTML = '<div class="ls-scrim"></div><div class="ls-box card" role="dialog" aria-modal="true" aria-labelledby="lsTitle"></div>';
      document.body.appendChild(sheet);
      sheet.querySelector(".ls-scrim").onclick = function () { sheet.hidden = true; };
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") sheet.hidden = true; });
    }
    var art = findArticle(r.key);
    sheet.querySelector(".ls-box").innerHTML =
      '<div class="ls-top"><h3 id="lsTitle">' + esc(r.key) + (art && art.title ? " (" + esc(art.title) + ")" : "") + '</h3><button type="button" class="btn ghost ls-x" aria-label="닫기">닫기</button></div>' +
      (note ? '<div class="ls-label">현행 조문 요지</div><p class="ls-note">' + esc(note) + '</p>' +
        '<p class="muted ls-src">' + esc(laws.source || "krlaw") + " 기준 · " + esc(laws.checked || "") + " 확인</p>" : "") +
      (art ? '<div class="ls-label">현행 조문 전문</div><div class="ls-full">' + esc(art.text) + '</div>' +
        '<p class="muted ls-src">시행 ' + esc(String(art.ef).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1.$2.$3")) + " 판 · " + esc((window.LAWS || {}).built || "") + " 받음</p>"
        : (note ? "" : '<p class="muted">곳간에 담긴 조문이 아니에요. 아래에서 현행 원문을 바로 볼 수 있어요.</p>')) +
      '<a class="btn" href="' + lawUrl(r) + '" target="_blank" rel="noopener">국가법령정보센터에서 현행 원문 보기</a>';
    sheet.querySelector(".ls-x").onclick = function () { sheet.hidden = true; };
    sheet.hidden = false;
    sheet.querySelector(".ls-x").focus();
    if (!art && !window.LAWS && !loadLaws.failed) loadLaws(function (ok) { if (ok && findArticle(r.key)) openLaw(r, l); });
  }

  function viewStub(l) {
    app.innerHTML = lecHead(l, "sum") + '<div class="card placeholder"><b>이 강의는 아직 요약 전이에요.</b>' +
      '<p class="muted" style="margin:6px 0 0">요약본이 올라오면 여기에 보여요. 먼저 적어 둔 질문은 <a href="' + lecHref(l, "my") + '">내 질문</a> 탭에 있어요.</p></div>' + lecNav(l);
    document.title = lecLabel(l) + " · 숫자곳간";
    window.scrollTo(0, 0);
  }

  var spy = null;
  function viewLecture(id, secId) {
    var l = findLecture(id);
    if (!l) { app.innerHTML = '<p>요약본을 찾지 못했어요. <a href="#/lectures">목록으로</a></p>'; return; }
    var nm = secId && secId.match(/^(qa|my)(-\d+)?$/);
    if (nm) { viewQA(l, nm[2] ? secId : "", nm[1]); return; }
    if (l.stub) { viewStub(l); return; }
    if (l.html) { viewLectureHtml(l, secId); return; }
    var body = renderMarkdown(l.md);
    var heads = body.querySelectorAll("h2, h3");
    var toc = '<details open><summary>목차</summary>' + Array.prototype.map.call(heads, function (h) {
      return '<a class="' + h.tagName.toLowerCase() + '" href="' + lecHref(l, h.id) + '" data-sec="' + h.id + '">' + esc(h.textContent) + "</a>";
    }).join("") + "</details>";
    var i = LECTURES.indexOf(l), prev = LECTURES[i - 1], next = LECTURES[i + 1];
    app.innerHTML = lecHead(l, "sum") + '<div class="lecture"><aside class="toc">' + toc + '</aside><article class="doc"><div class="doc-meta">' +
      (l.source ? "<span>" + esc(l.source) + "</span>" : "") + (l.length ? "<span>" + esc(l.length) + "</span>" : "") +
      (l.updated ? "<span>정리 " + esc(l.updated) + "</span>" : "") + '</div><div id="docBody"></div>' + lecNav(l) + "</article></div>";
    document.getElementById("docBody").appendChild(body);
    bindLaws(body, l);
    if (window.innerWidth <= 1100) app.querySelector(".toc details").removeAttribute("open");
    document.title = lecLabel(l) + " · 숫자곳간";

    if (spy) spy.disconnect();
    if ("IntersectionObserver" in window) {
      spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          app.querySelectorAll(".toc a").forEach(function (a) { a.classList.toggle("on", a.dataset.sec === e.target.id); });
        });
      }, { rootMargin: "-70px 0px -70% 0px" });
      heads.forEach(function (h) { spy.observe(h); });
    }
    if (secId) {
      var t = document.getElementById(secId);
      if (t) { t.scrollIntoView(); t.classList.remove("flash"); void t.offsetWidth; t.classList.add("flash"); return; }
    }
    window.scrollTo(0, 0);
  }

  /* 휴대폰에서는 표를 한 줄씩 카드로 쌓아 보여 줘요. 칸마다 제목(머리글)을 붙여 둬요. */
  function labelTables(root) {
    root.querySelectorAll("table").forEach(function (t) {
      var heads = Array.prototype.map.call(t.querySelectorAll("thead th"), function (th) { return th.textContent.trim(); });
      if (!heads.length) return;
      t.classList.add("stack");
      t.querySelectorAll("tbody tr").forEach(function (tr) {
        Array.prototype.forEach.call(tr.children, function (td, i) { if (heads[i]) td.setAttribute("data-label", heads[i]); });
      });
    });
  }
  var STACK_CSS = "@media (max-width:640px){" +
    "table.stack{min-width:0 !important;width:100%;border:0}" +
    "table.stack thead{display:none}" +
    "table.stack,table.stack tbody,table.stack tr,table.stack td{display:block;width:100%}" +
    "table.stack tr{padding:12px 14px;border-bottom:1px solid var(--line)}" +
    "table.stack tr:last-child{border-bottom:0}" +
    "table.stack td{border:0 !important;padding:2px 0 !important;white-space:normal !important}" +
    "table.stack td:first-child{font-weight:700;font-size:1.02em;padding-bottom:6px !important}" +
    "table.stack td:not(:first-child)[data-label]::before{content:attr(data-label);display:block;font-size:12px;font-weight:600;color:var(--muted, var(--text-2));margin-top:4px}" +
    "table.stack td:empty{display:none}" +
    "table.stack .art,table.stack .law{white-space:normal}" +
    ".tbl,.table-wrap{overflow-x:visible}" +
    "}";

  /* 강의 요약 작업에서 따로 꾸민 페이지(.html)가 있으면 그 디자인 그대로 보여 줘요.
     페이지의 스타일이 곳간 화면과 섞이지 않도록 Shadow DOM 안에 넣어요. */
  function lectureCss(css) {
    return String(css || "")
      .replace(/:root:not\(\[data-theme="light"\]\)/g, ':host(:not([data-theme="light"]))')
      .replace(/:root\[data-theme="dark"\]/g, ':host([data-theme="dark"])')
      .replace(/:root\b/g, ":host")
      .replace(/(^|[}\s,])body\s*\{/g, "$1.lec-body{")
      + "\n:host{display:block}" +
      "\n.lec-body{padding:0 !important;background:transparent}" +
      "\nnav.toc{top:76px !important}" +
      "\n.law-link{cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px}.law-link:hover{outline:2px solid var(--accent)}" +
      "\nmain{grid-template-columns:minmax(0,1fr)}main>*{min-width:0}" +
      "\n.flash{animation:flash 1.6s ease-out}@keyframes flash{from{background:var(--accent-soft)}to{background:transparent}}";
  }
  function norm(t) { return String(t || "").replace(/^[\s\d.\-·]+/, "").replace(/[^0-9a-z가-힣]/gi, "").toLowerCase(); }
  function viewLectureHtml(l, secId) {
    if (l.fontHref && !document.querySelector('link[data-lec-font]')) {
      var lk = document.createElement("link");
      lk.rel = "stylesheet"; lk.href = l.fontHref; lk.setAttribute("data-lec-font", "1");
      document.head.appendChild(lk);
    }
    var i = LECTURES.indexOf(l), prev = LECTURES[i - 1], next = LECTURES[i + 1];
    app.innerHTML = lecHead(l, "sum") + '<div class="lec-host"></div>' + lecNav(l);
    var host = app.querySelector(".lec-host");
    var theme = document.documentElement.getAttribute("data-theme");
    if (theme) host.setAttribute("data-theme", theme);
    var root = host.attachShadow({ mode: "open" });
    root.innerHTML = "<style>" + lectureCss(l.css) + STACK_CSS + '</style><div class="lec-body">' + l.html + "</div>";
    labelTables(root);
    bindLaws(root, l);
    // 페이지 안 목차 링크(#concept 등)는 그 자리로 스크롤만 해요
    root.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var t = root.getElementById(a.getAttribute("href").slice(1));
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: "smooth" }); }
    });
    document.title = lecLabel(l) + " · 숫자곳간";
    if (secId) {
      // 검색 결과에서 왔으면, 요약본의 같은 제목을 이 페이지에서 찾아 보여 줘요
      var md = renderMarkdown(l.md), h = md.querySelector("#" + secId);
      var want = norm(h && h.textContent);
      var target = null;
      if (want) {
        root.querySelectorAll("h2, h3, .case .q, .case, section").forEach(function (el) {
          if (target) return;
          var t = norm(el.matches(".case") ? (el.querySelector(".q") || el).textContent : el.textContent);
          if (t && (t === want || (want.length >= 4 && t.indexOf(want) === 0) || (t.length >= 4 && want.indexOf(t) === 0))) target = el;
        });
        if (!target) {
          root.querySelectorAll("h2, h3, .case .q").forEach(function (el) {
            var t = norm(el.textContent);
            if (!target && t.length >= 2 && (want.indexOf(t) !== -1 || t.indexOf(want) !== -1)) target = el;
          });
        }
      }
      if (target) { target.scrollIntoView(); target.classList.add("flash"); return; }
    }
    window.scrollTo(0, 0);
  }

  function viewSearch(q) {
    var kws = [];
    LECTURES.forEach(function (l) { (l.keywords || []).forEach(function (k) { if (kws.indexOf(k) === -1) kws.push(k); }); });
    kws = kws.sort(function () { return Math.random() - 0.5; }).slice(0, 12);
    app.innerHTML = sampleNotice() +
      '<h1 class="page-title">검색</h1>' +
      '<p class="page-sub">강의 요약·거래처 질문·내 질문과 주요 세법 조문 전체에서 찾고, 국세청 해석과 판례는 원문 사이트로 바로 이어 드려요. 단어만 넣어도 아래에 볼 조문과 강의 목차가 바로 보여요.</p>' +
      '<form class="searchbox" id="searchForm"><input name="q" id="q" placeholder="예: 외부감사 끝나지 않으면 신고기한 연장" aria-label="검색어" value="' + esc(q) + '"><button class="btn">찾기</button></form>' +
      '<div class="card preview" id="pv" hidden aria-live="polite"></div>' +
      (kws.length ? '<div class="chips">' + kws.map(function (k) { return '<a class="chip" href="#/search?q=' + encodeURIComponent(k) + '">' + esc(k) + "</a>"; }).join("") + "</div>" : "") +
      '<div id="results" style="margin-top:22px"></div>';
    var form = document.getElementById("searchForm");
    attachPreview(form.q, document.getElementById("pv"));
    form.onsubmit = function (e) {
      e.preventDefault();
      location.hash = "#/search?q=" + encodeURIComponent(form.q.value.trim());
    };
    if (!q) { document.getElementById("q").focus(); return; }
    var r = search(q), box = document.getElementById("results");
    box.innerHTML = "";
    var lawBox = document.createElement("div");
    function drawLaws() {
      var hits = searchLaws(q, 8), terms = lawTerms(q);
      lawBox.innerHTML = '<h2 class="section-h">법령 조문' + (hits.length ? " " + hits.length + "개" : "") + '</h2>' +
        (hits.length ? hits.map(function (a, i) {
          return '<button type="button" class="card result law-hit" data-i="' + i + '"><div class="src">' + esc(a.law) + (a.chapter ? " · " + esc(a.chapter) : "") +
            "</div><h4>" + esc(a.no) + (a.title ? " (" + esc(a.title) + ")" : "") + "</h4><p>" + esc(snippet(a.text, terms.length ? terms : [""], 160)) + "</p></button>";
        }).join("") : (window.LAWS ? '<p class="muted">곳간에 담긴 세법 조문에서는 찾지 못했어요.</p>' :
          '<p class="muted">' + (loadLaws.failed ? "아직 법령 조문을 받지 않았어요. PC에서 사이트_업데이트.bat 을 한 번 실행하면 주요 세법 조문이 들어와요." : "법령 조문을 불러오는 중이에요…") + "</p>")) +
        '<h2 class="section-h">국세청 해석 · 판례</h2><p class="muted" style="margin:0 0 8px">같은 검색어로 원문 사이트를 새 탭에서 열어요.</p>' + outLinks(q);
      lawBox.querySelectorAll(".law-hit").forEach(function (b) {
        b.onclick = function () { var a = hits[+b.dataset.i]; openLaw({ law: a.law, article: a.no, key: a.key }, null); };
      });
      lawBox.querySelectorAll(".law-hit").forEach(function (b) { highlight(b, terms); });
    }
    if (!r.results.length) {
      box.innerHTML = '<p class="muted">강의 요약과 질문에서는 "' + esc(q) + '"와 맞는 내용을 찾지 못했어요.</p>';
      box.appendChild(lawBox);
      drawLaws();
      loadLaws(function () { drawLaws(); });
      return;
    }
    var top = r.results[0].c;
    var topMd = top.md.length > 1500 ? top.md.slice(0, top.md.lastIndexOf("\n", 1500)) + "\n\n…" : top.md;
    var ans = document.createElement("div");
    ans.className = "card answer";
    ans.innerHTML = '<div class="label">강의 요약·질문·사전에서 가장 가까운 내용</div><h3>' + esc(top.src || lecLabel(top.lec)) + " › " + esc(top.heading) +
      '</h3><div class="doc" id="ansBody"></div><p style="margin:12px 0 0"><a class="btn" href="' + (top.href || lecHref(top.lec, top.secId)) +
      '">본문에서 보기</a></p><p class="muted" style="font-size:13px;margin:10px 0 0">강의 요약·질문에 적힌 내용을 그대로 찾아 보여 드려요. 실제 적용 전에는 조문을 한 번 더 확인하세요.</p>';
    var rendered = renderMarkdown(topMd);
    rendered.querySelectorAll("h2, h3").forEach(function (h) { h.remove(); });
    ans.querySelector("#ansBody").appendChild(rendered);
    highlight(rendered, r.terms);
    box.appendChild(ans);
    box.appendChild(lawBox);
    drawLaws();
    loadLaws(function () { drawLaws(); });
    if (r.results.length > 1) {
      var more = document.createElement("div");
      more.innerHTML = '<h2 class="section-h">다른 관련 내용 ' + (r.results.length - 1) + "개</h2>" +
        r.results.slice(1).map(function (x) {
          return '<a class="card result" href="' + (x.c.href || lecHref(x.c.lec, x.c.secId)) + '"><div class="src">' + esc(x.c.src || lecLabel(x.c.lec)) +
            "</div><h4>" + esc(x.c.heading) + "</h4><p>" + esc(snippet(plain(x.c.md), r.terms)) + "</p></a>";
        }).join("");
      highlight(more, r.terms);
      box.appendChild(more);
    }
  }

  /* ---------- 나의 세무 사전 (블로그 주제마다 조문·실무를 덧붙인 내 사전) ---------- */
  function viewDict() {
    var cats = [];
    DICT.forEach(function (d) { if (cats.indexOf(d.category) === -1) cats.push(d.category); });
    app.innerHTML = '<h1 class="page-title">나의 세무 사전</h1>' +
      '<p class="page-sub">블로그에 쉽게 풀어 쓴 주제마다 조문·해석·실무 포인트를 덧붙였어요. 조문을 누르면 현행 조문이 떠요.</p>' +
      (DICT.length ? '<div class="searchbox"><input id="dictFilter" placeholder="주제나 단어로 거르기" aria-label="사전 거르기"></div><div id="dictList"></div>' :
        '<div class="card placeholder"><b>아직 사전 항목이 없어요.</b><p class="muted" style="margin:6px 0 0">블로그 주제를 알려 주면 클로드가 항목을 만들어 \'나의 업무 노트\\사전\' 폴더에 넣어 둬요.</p></div>');
    if (!DICT.length) return;
    function draw(f) {
      f = String(f || "").toLowerCase();
      document.getElementById("dictList").innerHTML = cats.map(function (c) {
        var items = DICT.filter(function (d) { return d.category === c && (!f || (d.title + " " + (d.keywords || []).join(" ") + " " + d.md).toLowerCase().indexOf(f) !== -1); });
        if (!items.length) return "";
        return '<h2 class="section-h">' + esc(c) + ' <span class="muted">' + items.length + '</span></h2><div class="lec-list">' + items.map(function (d) {
          return '<a class="card lec-item" href="' + dictHref(d) + '"><div class="lec-no">📖</div><div><h3>' + esc(d.title) + (d.draft ? ' <span class="pill soon">살 붙이기 전</span>' : "") + '</h3><p>' +
            esc([d.blog_date ? "블로그 " + d.blog_date : "", (d.keywords || []).slice(0, 5).join(" · ")].filter(Boolean).join("  |  ")) + "</p></div></a>";
        }).join("") + "</div>";
      }).join("") || '<p class="muted">맞는 항목이 없어요.</p>';
    }
    draw("");
    document.getElementById("dictFilter").oninput = function () { draw(this.value); };
  }
  function viewDictEntry(id, sec) {
    var d = DICT.filter(function (x) { return x.id === id; })[0];
    if (!d) { app.innerHTML = '<p>사전 항목을 찾지 못했어요. <a href="#/dict">사전으로</a></p>'; return; }
    app.innerHTML = '<div class="lec-head"><div class="crumbs"><a href="#/dict">나의 세무 사전</a> › ' + esc(d.category) + '</div></div>' +
      '<h1 class="page-title">' + esc(d.title) + '</h1>' +
      (d.blog ? '<p style="margin:0 0 14px"><a class="btn ghost" href="' + esc(d.blog) + '" target="_blank" rel="noopener">블로그 글 보기 ↗</a>' +
        (d.blog_date ? ' <span class="muted">' + esc(d.blog_date) + ' 발행</span>' : "") + "</p>" : "") +
      '<article class="card doc" id="dictBody"></article>';
    var body = renderMarkdown(d.md);
    document.getElementById("dictBody").appendChild(body);
    bindLaws(body, d._lec);
    body.querySelectorAll('a[href^="http"]').forEach(function (a) { a.target = "_blank"; a.rel = "noopener"; });
    document.title = d.title + " · 나의 세무 사전";
    var t = sec && document.getElementById(sec);
    if (t) { t.scrollIntoView(); t.classList.add("flash"); } else window.scrollTo(0, 0);
  }

  function viewClients() {
    app.innerHTML = '<h1 class="page-title">거래처 현황</h1><p class="page-sub">준비 중이에요. 무엇을 보고 싶은지 함께 정한 뒤 만들어요.</p>' +
      '<div class="card placeholder"><b>이렇게 만들 계획이에요</b><ul>' +
      "<li>내 컴퓨터의 거래처 엑셀(또는 CSV)을 <b>그때그때 열어서 보기만</b> 해요.</li>" +
      "<li>열어 본 자료는 사이트나 GitHub 어디에도 <b>저장되지 않아요.</b> 창을 닫으면 사라져요.</li>" +
      "<li>예: 신고 마감 일정, 기장 진행 상황, 결산 월별 거래처 수, 외감 대상 경계 거래처 표시</li>" +
      "</ul></div>";
  }
  function viewCalculator() {
    app.innerHTML = '<h1 class="page-title">통합고용세액공제 계산기</h1><p class="page-sub">준비 중이에요. 계산기가 완성되면 이 자리에 들어와요.</p>' +
      '<div class="card placeholder"><b>들어갈 내용</b><ul>' +
      "<li>조세특례제한법 제29조의8 기준으로 상시근로자 증가 인원과 공제액 계산</li>" +
      "<li>청년·장애인 등 우대 인원 구분, 사후관리(인원 감소 시 추가 납부) 확인</li>" +
      "<li>입력한 숫자는 저장하지 않고 화면에서만 계산</li>" +
      "</ul></div>";
  }

  /* ---------- 길 찾기(라우터) ---------- */
  function route() {
    var h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    var path = h.split("?")[0], query = h.indexOf("?") !== -1 ? h.slice(h.indexOf("?") + 1) : "";
    var parts = path.split("/").filter(Boolean);
    var nav = parts[0] || "home";
    document.body.classList.remove("nav-open");
    document.title = "숫자곳간";
    if (nav === "lectures") viewLectures();
    else if (nav === "lecture") { nav = "lectures"; viewLecture(parts[1], parts[2]); }
    else if (nav === "search") viewSearch((query.match(/(?:^|&)q=([^&]*)/) || [])[1] || "");
    else if (nav === "clients") viewClients();
    else if (nav === "dict") { if (parts[1]) viewDictEntry(parts[1], parts[2]); else viewDict(); }
    else if (nav === "calculator") viewCalculator();
    else { nav = "home"; viewHome(); }
    document.querySelectorAll(".sidenav a").forEach(function (a) { a.classList.toggle("active", a.dataset.nav === nav); });
    if (parts[0] !== "lecture") window.scrollTo(0, 0);
  }

  /* ---------- 테마, 메뉴 ---------- */
  var saved = store("theme");
  if (saved === "dark" || saved === "light") document.documentElement.setAttribute("data-theme", saved);
  document.getElementById("themeBtn").onclick = function () {
    var cur = document.documentElement.getAttribute("data-theme") ||
      (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    var next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    document.querySelectorAll(".lec-host").forEach(function (h) { h.setAttribute("data-theme", next); });
    store("theme", next);
  };
  document.getElementById("menuBtn").onclick = function () { document.body.classList.toggle("nav-open"); };
  document.getElementById("scrim").onclick = function () { document.body.classList.remove("nav-open"); };
  document.getElementById("navFoot").textContent = USING_SAMPLE ? "예시 데이터로 보는 중" :
    "요약본 " + LECTURES.filter(function (l) { return !l.stub; }).length + "개" + (META.built ? " · " + META.built + " 업데이트" : "") + (META.public ? " · 공개용" : "");

  if (!document.getElementById("stackCss")) {
    var st = document.createElement("style"); st.id = "stackCss"; st.textContent = STACK_CSS; document.head.appendChild(st);
  }
  window.addEventListener("hashchange", route);
  route();
}

/* ---------- 비밀번호 잠금 (인터넷에 올린 버전) ----------
   data/encrypted.js 가 있으면 비밀번호를 받아 요약본을 풀어요 (AES-GCM, PBKDF2-SHA256). */
function b64(s) { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function unlock(password) {
  var E = window.ENCRYPTED_SUMMARIES, enc = new TextEncoder();
  return crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]).then(function (base) {
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(E.salt), iterations: E.iter, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  }).then(function (key) {
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(E.iv) }, key, b64(E.data));
  }).then(function (buf) { return JSON.parse(new TextDecoder().decode(buf)); });
}
function lockScreen() {
  var app = document.getElementById("app");
  document.getElementById("sidenav").style.visibility = "hidden";
  app.innerHTML = '<div class="card" style="max-width:420px;margin:40px auto">' +
    '<h1 class="page-title" style="font-size:22px">🔒 숫자곳간</h1>' +
    '<p class="muted" style="margin:0 0 16px">비밀번호를 넣으면 열려요.</p>' +
    '<form id="lockForm" class="searchbox"><input id="pw" type="password" autocomplete="current-password" placeholder="비밀번호" aria-label="비밀번호"><button class="btn">열기</button></form>' +
    '<label class="muted" style="display:flex;gap:6px;align-items:center;margin-top:12px;font-size:14px"><input type="checkbox" id="remember" checked> 이 기기에서 기억하기</label>' +
    '<p id="lockMsg" style="color:var(--warn-line);min-height:1.5em;margin:10px 0 0"></p></div>';
  document.getElementById("lockForm").onsubmit = function (e) {
    e.preventDefault();
    var pw = document.getElementById("pw").value, msg = document.getElementById("lockMsg");
    msg.textContent = "여는 중…";
    unlock(pw).then(function (data) {
      try { if (document.getElementById("remember").checked) localStorage.setItem("notes-pw", pw); } catch (err) {}
      openWith(data);
    }).catch(function () { msg.textContent = "비밀번호가 맞지 않아요. 다시 넣어 주세요."; });
  };
}
function openWith(data) {
  window.SUMMARIES = data;
  document.getElementById("sidenav").style.visibility = "";
  main();
}
(function boot() {
  if (window.SUMMARIES || !window.ENCRYPTED_SUMMARIES) { main(); return; }
  if (!(window.crypto && crypto.subtle)) {
    document.getElementById("app").innerHTML = "<p>이 브라우저에서는 열 수 없어요. 크롬이나 사파리 최신 버전으로 열어 주세요.</p>";
    return;
  }
  var saved = null;
  try { saved = localStorage.getItem("notes-pw"); } catch (e) {}
  if (saved) unlock(saved).then(openWith).catch(lockScreen); else lockScreen();
})();
