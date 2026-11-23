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
    var oldQ = askLoad().length;
    var progress = courses().map(function (c) {
      var done = c.items.filter(function (l) { return !l.stub; }).length, total = c.total || done || 1, pct = Math.min(100, Math.round(done / total * 100));
      return '<div class="course-prog"><b>' + esc(c.category) + ' › ' + esc(c.site) + '</b>' +
        '<div class="progress"><span style="width:' + pct + '%"></span></div>' +
        '<span class="muted">' + (c.total ? c.total + '개 중 ' + done + '개 완료 (' + pct + '%)' : done + '개 정리됨') + '</span></div>';
    }).join("");
    var recent = LECTURES.filter(function (l) { return !l.stub; }).sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")) || b.no - a.no; }).slice(0, 3);
    app.innerHTML = sampleNotice() + (oldQ ? '<a class="card ask-form" href="#/ask" style="text-decoration:none;color:inherit"><b>이 기기에 예전 질문 ' + oldQ + '개가 남아 있어요</b><span class="muted">질문은 이제 질문함 한 곳에만 모여요. 눌러서 정리해 주세요.</span></a>' : "") +
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
        tile("#/calculator", "🧮", "계산기 · 만들 기능", "만들 예정인 계산기 4가지를 모아 뒀어요.", true) +
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
      "</div>" + askButton("lecture", l.id, lecLabel(l)) + "</div>";
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
      '<h1 class="page-title">' + esc(d.title) + '</h1>' + askButton("dict", d.id, d.title) +
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

  /* ---------- 거래처 현황 (PC 전용) ----------
     원본: data/clients.js (위하고 수임처에서 뽑은 기본 정보, PC에만 있음)
     내가 고친 값·새 거래처·수임해지·신고 완료 체크·내 항목은 이 PC 브라우저(localStorage "clients-extra")에만 저장.
     백업 .json 으로 내려받고 불러올 수 있어요. 주민등록번호·비밀번호 칸은 만들지 않아요. */
  var CX_KEY = "clients-extra";
  var SECRET_RE = /주민|비밀\s*번호|비번|암호|password|passwd|\bpw\b|패스워드|PIN|핀번호|보안카드|OTP/i;
  var MGR_FIELDS = [["main", "주담당"], ["wht", "원천세"], ["yearend", "연말정산"], ["book", "기장"], ["vat", "부가세"], ["corp", "법인세"], ["inc", "소득세"], ["site", "사업장현황신고"]];
  var INS_FIELDS = [["health", "건강보험"], ["pension", "국민연금"], ["employ", "고용보험"], ["accident", "산재보험"]];
  function cxLoad() { var x; try { x = JSON.parse(store(CX_KEY) || "null"); } catch (e) {} x = x || {}; x.fields = x.fields || []; x.values = x.values || {}; x.added = x.added || []; x.done = x.done || {}; return x; }
  function cxSave(x) { store(CX_KEY, JSON.stringify(x)); }
  function baseId(c) { return "c" + String(c.code || c.name).replace(/[^0-9A-Za-z가-힣]/g, ""); }
  function migrateKeys(x) { /* 예전 저장 키("코드|상호")를 새 id 로 옮겨요 */
    Object.keys(x.values).forEach(function (k) {
      if (k.indexOf("|") === -1) return;
      var code = k.split("|")[0], id = "c" + code.replace(/[^0-9A-Za-z가-힣]/g, "");
      x.values[id] = Object.assign({}, x.values[k], x.values[id] || {}); delete x.values[k];
    });
  }
  function allClients() {
    var x = cxLoad(); migrateKeys(x);
    var base = ((window.CLIENTS || {}).clients || []).map(function (c) {
      var d = { id: baseId(c), name: c.name, type: c.type, bizno: c.bizno, ceo: c.ceo, biz: c.biz, item: c.item, office: c.office, tel: c.tel, addr: c.addr, code: c.code,
        status: "수임중", kind: "기장", vat: "", wht: "", payday: "", fy: "12", pay: "", email: "", ins: {}, mgr: {}, custom: {} };
      return { d: d, base: true };
    });
    var added = x.added.map(function (d) { return { d: d, base: false }; });
    return base.concat(added).map(function (o) {
      var v = x.values[o.d.id] || {}, c = Object.assign({}, o.d, v);
      c.ins = Object.assign({}, o.d.ins, v.ins || {}); c.mgr = Object.assign({}, o.d.mgr, v.mgr || {}); c.custom = Object.assign({}, v.custom || {});
      x.fields.forEach(function (f) { if (v[f.id] !== undefined && c.custom[f.id] === undefined) c.custom[f.id] = v[f.id]; });
      c._base = o.base; c._orig = o.d; return c;
    }).sort(function (a, b) { return String(a.code || "~").localeCompare(String(b.code || "~")) || a.name.localeCompare(b.name, "ko"); });
  }
  function mgrOf(c, k) { return (c.mgr && (c.mgr[k] || c.mgr.main)) || "미정"; }

  /* 신고 일정: 오늘 기준으로 가까운 기한을 만들어요 (일반적인 법정 기한, 휴일 순연은 반영하지 않아요) */
  function ymd(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function endOf(y, m) { return new Date(y, m + 1, 0); }  /* m: 0-11 */
  function dday(d, today) { return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - today) / 86400000); }
  function buildTasks(list, today) {
    var T = [], y = today.getFullYear(), m = today.getMonth(), act = list.filter(function (c) { return c.status !== "수임해지"; });
    function add(t) { if (t.targets.length) T.push(t); }
    [1, 0].forEach(function (back) {  /* 지난달·이번 달 지급분 */
      var pm = new Date(y, m - back, 1), py = pm.getFullYear(), pmo = pm.getMonth();
      add({ id: "wht-" + ymd(pm).slice(0, 7), group: "원천세", label: (pmo + 1) + "월 지급분", deadline: new Date(py, pmo + 1, 10), mgr: "wht",
        targets: act.filter(function (c) { return c.wht === "월"; }) });
      add({ id: "simple-" + ymd(pm).slice(0, 7), group: "간이지급명세서", label: (pmo + 1) + "월 지급분", deadline: endOf(py, pmo + 1), mgr: "wht",
        targets: act.filter(function (c) { return c.pay === "예"; }) });
      add({ id: "payroll-" + ymd(pm).slice(0, 7), group: "급여 작업", label: (pmo + 1) + "월 귀속", deadline: endOf(py, pmo), mgr: "wht",
        targets: act.filter(function (c) { return c.pay === "예"; }) });
    });
    /* 반기 원천세: 1~6월분 7/10, 7~12월분 1/10 */
    var half = m < 6 ? { label: (y - 1) + "년 7~12월분", d: new Date(y, 0, 10), id: (y - 1) + "H2" } : { label: y + "년 1~6월분", d: new Date(y, 6, 10), id: y + "H1" };
    if (m >= 6) half = { label: y + "년 1~6월분", d: new Date(y, 6, 10), id: y + "H1" };
    if (m >= 7) half = { label: y + "년 7~12월분", d: new Date(y + 1, 0, 10), id: y + "H2" };
    add({ id: "whth-" + half.id, group: "원천세(반기)", label: half.label, deadline: half.d, mgr: "wht", targets: act.filter(function (c) { return c.wht === "반기"; }) });
    /* 부가세: 다음 기한 하나 */
    var vatDues = [[0, 25, "2기 확정", -1], [3, 25, "1기 예정", 0], [6, 25, "1기 확정", 0], [9, 25, "2기 예정", 0], [12, 25, "2기 확정", 0]];
    var nv = vatDues.map(function (v) { return { d: new Date(y, v[0], v[1]), label: (y + (v[3] || 0) + (v[0] === 12 ? 0 : 0)) + "년 " + v[2], raw: v }; })
      .filter(function (v) { return dday(v.d, today) >= -5; })[0];
    if (nv) {
      var vy = nv.raw[0] === 0 ? y - 1 : y;
      nv.label = vy + "년 " + nv.raw[2];
      var isFinal2 = nv.raw[2] === "2기 확정";
      add({ id: "vat-" + vy + nv.raw[2], group: "부가가치세", label: nv.label, deadline: nv.d, mgr: "vat",
        targets: act.filter(function (c) { return c.vat === "과세" || (isFinal2 && c.vat === "간이"); }) });
    }
    /* 사업장현황신고: 면세 개인, 2/10 */
    var sd = new Date(m >= 2 ? y + 1 : y, 1, 10);
    add({ id: "site-" + (sd.getFullYear() - 1), group: "사업장현황신고", label: (sd.getFullYear() - 1) + "년 귀속", deadline: sd, mgr: "site",
      targets: act.filter(function (c) { return c.type === "개인" && c.vat === "면세"; }) });
    /* 법인세 신고(결산월+3개월 말일)·중간예납(결산월+8개월 말일), 결산월별로 묶어요 */
    var fys = {};
    act.filter(function (c) { return c.type === "법인"; }).forEach(function (c) { var f = parseInt(c.fy, 10) || 12; (fys[f] = fys[f] || []).push(c); });
    Object.keys(fys).forEach(function (f) {
      f = +f;
      [["법인세 신고", 3], ["법인세 중간예납", 8]].forEach(function (k) {
        var best = null;
        [-1, 0, 1].forEach(function (dy) { var d = endOf(y + dy, f - 1 + k[1]); if (dday(d, today) >= -30 && (!best || d < best)) best = d; });
        if (!best) return;
        var fyY = new Date(best.getFullYear(), best.getMonth() - k[1], 1);
        add({ id: (k[1] === 3 ? "corp-" : "corpmid-") + ymd(fyY).slice(0, 7), group: k[0], label: f + "월 결산 " + (k[1] === 3 ? fyY.getFullYear() + "사업연도" : (fyY.getFullYear() + 1) + "사업연도"), deadline: best, mgr: "corp", targets: fys[f] });
      });
    });
    /* 종합소득세: 개인 5/31 (성실신고 6/30은 메모로) */
    var inc = new Date(m >= 6 ? y + 1 : y, 4, 31);
    add({ id: "inc-" + (inc.getFullYear() - 1), group: "종합소득세", label: (inc.getFullYear() - 1) + "년 귀속", deadline: inc, mgr: "inc", targets: act.filter(function (c) { return c.type === "개인"; }) });
    return T.sort(function (a, b) { return a.deadline - b.deadline; });
  }

  function loadClients(cb) {
    if (window.CLIENTS) { cb(true); return; }
    if (loadClients.failed) { cb(false); return; }
    var sc = document.createElement("script");
    sc.src = "data/clients.js";
    sc.onload = function () { cb(!!window.CLIENTS); };
    sc.onerror = function () { loadClients.failed = true; cb(false); };
    document.head.appendChild(sc);
  }
  function viewClients(id) {
    app.innerHTML = '<h1 class="page-title">거래처 현황</h1><p class="page-sub">불러오는 중이에요…</p>';
    loadClients(function (ok) {
      if (!ok) {
        app.innerHTML = '<h1 class="page-title">거래처 현황</h1>' +
          '<div class="card placeholder"><b>이 화면은 내 PC의 곳간에서만 열려요.</b><p class="muted" style="margin:6px 0 0">거래처 자료는 인터넷(휴대폰용 곳간)에 올리지 않아요. PC에서 사이트_열기로 열어 주세요.</p></div>';
        return;
      }
      if (id) clientEdit(id); else clientMain();
    });
  }

  function clientMain() {
    var list = allClients(), today = new Date(); today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var x = cxLoad(), tasks = buildTasks(list, today), showGone = clientMain.showGone || false;
    function doneOf(t) { return x.done[t.id] || {}; }
    var up = tasks.filter(function (t) { var dd = dday(t.deadline, today); return dd >= -3 && dd <= 30; });
    var chips = up.map(function (t) {
      var dd = dday(t.deadline, today), dn = t.targets.filter(function (c) { return doneOf(t)[c.id]; }).length, all = dn === t.targets.length;
      return '<a class="dl-chip' + (all ? " ok" : dd <= 5 ? " hot" : "") + '" href="#task-' + esc(t.id) + '"><b>' + (dd === 0 ? "D-day" : dd > 0 ? "D-" + dd : "D+" + (-dd)) + "</b> " + esc(t.group) +
        ' <span class="muted">' + (t.deadline.getMonth() + 1) + "/" + t.deadline.getDate() + " · " + dn + "/" + t.targets.length + (all ? " 완료 ✓" : "") + "</span></a>";
    }).join("");
    var cards = tasks.filter(function (t) { return dday(t.deadline, today) >= -45 && dday(t.deadline, today) <= 90; }).map(function (t) {
      var dn = doneOf(t), byM = {};
      t.targets.forEach(function (c) { var mg = mgrOf(c, t.mgr); (byM[mg] = byM[mg] || { n: 0, d: 0 }).n++; if (dn[c.id]) byM[mg].d++; });
      var tot = t.targets.length, td = t.targets.filter(function (c) { return dn[c.id]; }).length;
      function bar(lbl, d, n, strong) {
        var pct = n ? Math.round(d / n * 100) : 0;
        return '<div class="tk-row"><span class="tk-name">' + (strong ? "<b>" + esc(lbl) + "</b>" : esc(lbl)) + '</span><span class="tk-num"><b>' + d + "</b>/" + n + " (" + pct + "%)" + (n - d ? ' <span class="tk-left">·' + (n - d) + "</span>" : "") + '</span><span class="tk-bar"><i style="width:' + pct + '%"></i></span></div>';
      }
      var dd = dday(t.deadline, today);
      return '<section class="card tk" id="task-' + esc(t.id) + '"><h3>' + esc(t.group) + ' <span class="muted">' + esc(t.label) + "</span></h3>" +
        '<p class="muted tk-due">기한 ' + ymd(t.deadline) + " · " + (dd >= 0 ? "D-" + dd : (td < tot ? "기한 " + (-dd) + "일 지남" : "끝남")) + "</p>" +
        bar("전체", td, tot, true) + Object.keys(byM).sort().map(function (k) { return bar(k, byM[k].d, byM[k].n); }).join("") +
        '<details class="tk-list"><summary>거래처별 체크</summary><ul>' + t.targets.map(function (c) {
          return '<li><label><input type="checkbox" data-task="' + esc(t.id) + '" data-cid="' + esc(c.id) + '"' + (dn[c.id] ? " checked" : "") + "> " + esc(c.name) + ' <span class="muted">' + esc(mgrOf(c, t.mgr)) + "</span></label></li>";
        }).join("") + "</ul></details></section>";
    }).join("");
    var shown = list.filter(function (c) { return showGone || c.status !== "수임해지"; });
    var gone = list.filter(function (c) { return c.status === "수임해지"; }).length;
    var cols = [["code", "코드"], ["name", "상호"], ["status", "수임상태"], ["kind", "수임구분"], ["bizno", "사업자번호"], ["type", "법인·개인"], ["vat", "과세유형"], ["fy", "결산월"], ["wht", "원천세"]]
      .concat(MGR_FIELDS.map(function (f) { return ["mgr." + f[0], f[1] === "주담당" ? "주담당" : f[1] + "담당"]; }));
    function cell(c, k) { return k.indexOf("mgr.") === 0 ? (c.mgr[k.slice(4)] || "") : (k === "fy" && c[k] ? c[k] + "월" : (c[k] || "")); }
    var needSetup = list.filter(function (c) { return !c.vat || !c.wht; }).length;
    app.innerHTML = '<h1 class="page-title">거래처 현황 <span class="muted" style="font-size:15px;font-weight:500">총 ' + (list.length - gone) + "곳" + (gone ? " (수임해지 " + gone + "곳 제외)" : "") + "</span></h1>" +
      (needSetup ? '<div class="card ask-form"><b>' + needSetup + '곳은 과세유형·원천세 유형이 비어 있어요.</b><span class="muted">상호를 눌러 채우면 아래 신고 현황에 대상으로 잡혀요.</span></div>' : "") +
      '<section class="card"><h2 class="section-h" style="margin-top:0">📅 다가오는 신고기한 <span class="muted">30일 이내</span></h2><div class="dl-chips">' + (chips || '<span class="muted">30일 안에 기한이 없어요.</span>') + "</div></section>" +
      '<h2 class="section-h">신고 업무 현황</h2><div class="tk-grid">' + (cards || '<p class="muted">대상 거래처가 있는 신고가 없어요. 거래처 정보를 채워 주세요.</p>') + "</div>" +
      '<h2 class="section-h">거래처 목록</h2>' +
      '<div class="cl-tools"><input id="clFilter" placeholder="상호 · 사업자번호 · 코드 검색" aria-label="거래처 찾기" value="' + esc(clientMain.q || "") + '">' +
      '<label class="muted"><input type="checkbox" id="clGone"' + (showGone ? " checked" : "") + "> 수임해지 포함</label>" +
      '<a class="btn" href="#/clients/new">+ 새 거래처</a></div>' +
      '<div class="cl-table-wrap"><table class="cl-table"><thead><tr>' + cols.map(function (c) { return "<th>" + c[1] + "</th>"; }).join("") + '</tr></thead><tbody id="clBody"></tbody></table></div>' +
      '<details class="card cl-admin"><summary><b>백업 · 내 항목</b> <span class="muted">고친 내용은 이 PC 브라우저에만 저장돼요</span></summary>' +
      '<div class="ask-row" style="margin-top:12px"><button class="btn ghost" type="button" id="cxExport">백업 파일 내려받기</button><label class="btn ghost" for="cxImport">백업 파일 불러오기</label><input type="file" id="cxImport" accept=".json" hidden><span class="muted" id="cfMsg" role="status"></span></div>' +
      '<div class="cl-add"><input id="cfName" placeholder="거래처마다 둘 내 항목 (예: 홈택스 아이디 메모)" aria-label="새 항목 이름"><select id="cfType" aria-label="항목 종류"><option value="text">글자</option><option value="check">체크</option></select><button class="btn ghost" type="button" id="cfAdd">항목 추가</button></div>' +
      (x.fields.length ? '<ul class="cl-fields">' + x.fields.map(function (f) { return '<li><input value="' + esc(f.name) + '" data-ren="' + esc(f.id) + '" aria-label="항목 이름"> <span class="muted">' + (f.type === "check" ? "체크" : "글자") + '</span> <button class="btn ghost" type="button" data-delf="' + esc(f.id) + '">지우기</button></li>'; }).join("") + "</ul>" : "") +
      '<p class="muted">주민등록번호·비밀번호 같은 항목은 만들 수 없어요. 브라우저 기록을 지우면 사라질 수 있으니 가끔 백업 파일을 내려받아 두세요.</p></details>';
    function drawTable() {
      var q = String(document.getElementById("clFilter").value || "").toLowerCase().replace(/-/g, "");
      clientMain.q = document.getElementById("clFilter").value;
      var rows = shown.filter(function (c) { return !q || [c.name, c.bizno, c.code, c.ceo].join(" ").toLowerCase().replace(/-/g, "").indexOf(q) !== -1; });
      document.getElementById("clBody").innerHTML = rows.map(function (c) {
        return "<tr" + (c.status === "수임해지" ? ' class="gone"' : "") + ">" + cols.map(function (k) {
          var v = cell(c, k[0]);
          if (k[0] === "name") return '<td class="nm"><a href="#/clients/' + encodeURIComponent(c.id) + '">' + esc(v) + "</a></td>";
          return "<td>" + esc(v) + "</td>";
        }).join("") + "</tr>";
      }).join("") || '<tr><td colspan="' + cols.length + '" class="muted">맞는 거래처가 없어요.</td></tr>';
    }
    drawTable();
    document.getElementById("clFilter").oninput = drawTable;
    document.getElementById("clGone").onchange = function () { clientMain.showGone = this.checked; clientMain(); };
    app.querySelectorAll("[data-task]").forEach(function (cb) {
      cb.onchange = function () {
        var y = cxLoad(), d = y.done[cb.dataset.task] = y.done[cb.dataset.task] || {};
        if (cb.checked) d[cb.dataset.cid] = true; else delete d[cb.dataset.cid];
        cxSave(y); var open = cb.dataset.task; clientMain();
        var sec = document.getElementById("task-" + open); if (sec) { sec.querySelector("details").open = true; }
      };
    });
    app.querySelectorAll(".dl-chip").forEach(function (a) {
      a.onclick = function (e) { e.preventDefault(); var s = document.getElementById(a.getAttribute("href").slice(1)); if (s) { s.scrollIntoView({ block: "center" }); s.querySelector("details").open = true; s.classList.add("flash"); } };
    });
    var adm = app.querySelector(".cl-admin");
    adm.addEventListener("click", function (e) {
      var y = cxLoad(), msg = document.getElementById("cfMsg");
      if (e.target.id === "cfAdd") {
        var name = document.getElementById("cfName").value.trim();
        if (!name) return;
        if (SECRET_RE.test(name)) { msg.textContent = "주민번호·비밀번호는 거래처 상세 화면의 '🔒 보안 정보'(잠금 칸)에 넣어 주세요."; return; }
        y.fields.push({ id: "f" + Date.now().toString(36), name: name, type: document.getElementById("cfType").value });
        cxSave(y); clientMain(); app.querySelector(".cl-admin").open = true;
      }
      var del = e.target.closest("[data-delf]");
      if (del) {
        if (del.dataset.step !== "1") { del.dataset.step = "1"; del.textContent = "모든 거래처 값도 지워요. 정말?"; return; }
        y.fields = y.fields.filter(function (f) { return f.id !== del.dataset.delf; });
        Object.keys(y.values).forEach(function (k) { delete y.values[k][del.dataset.delf]; if (y.values[k].custom) delete y.values[k].custom[del.dataset.delf]; });
        cxSave(y); clientMain(); app.querySelector(".cl-admin").open = true;
      }
      if (e.target.id === "cxExport") {
        var blob = new Blob([JSON.stringify(y, null, 1)], { type: "application/json" }), a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = "거래처_추가정보_" + ymd(new Date()) + ".json"; a.click();
      }
    });
    adm.addEventListener("change", function (e) {
      var y = cxLoad(), msg = document.getElementById("cfMsg");
      if (e.target.dataset && e.target.dataset.ren) {
        var nm = e.target.value.trim();
        if (!nm || SECRET_RE.test(nm)) { msg.textContent = "그 이름으로는 바꿀 수 없어요."; return; }
        y.fields.forEach(function (f) { if (f.id === e.target.dataset.ren) f.name = nm; });
        cxSave(y); msg.textContent = "바꿨어요.";
      }
      if (e.target.id === "cxImport" && e.target.files[0]) {
        var rd = new FileReader();
        rd.onload = function () {
          try { var z = JSON.parse(rd.result); if (!z || typeof z.values !== "object") throw 0; cxSave(z); clientMain(); }
          catch (err) { msg.textContent = "백업 파일을 읽지 못했어요. 곳간에서 내려받은 .json 파일인지 확인해 주세요."; }
        };
        rd.readAsText(e.target.files[0]);
      }
    });
  }

  /* 🔒 보안 정보(금고): 주민등록번호·홈택스·사이트 계정을 금고 비밀번호로 암호화(AES-GCM, PBKDF2)해서 clients-extra.vault 에 저장.
     금고 비밀번호는 어디에도 저장하지 않고, 연 동안만 메모리에 열쇠를 두며 10분 동안 안 쓰면 다시 잠가요.
     비밀번호를 잊으면 아무도 풀 수 없어요(복구 불가). 백업 .json 에도 암호화된 채로 들어가요. */
  var VKEY = null, vTimer = null, VAULT_IDLE = 10 * 60 * 1000;
  function vb64e(buf) { var s = "", a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function vb64d(t) { var s = atob(t), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function vDerive(pw, salt, iter) {
    return crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]).then(function (base) {
      return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    });
  }
  function vEnc(key, obj) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(JSON.stringify(obj))).then(function (ct) { return { iv: vb64e(iv), ct: vb64e(ct) }; });
  }
  function vDec(key, box) {
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: vb64d(box.iv) }, key, vb64d(box.ct)).then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); });
  }
  function vTouch() { clearTimeout(vTimer); vTimer = setTimeout(vLock, VAULT_IDLE); }
  function vLock() { VKEY = null; clearTimeout(vTimer); var b = document.getElementById("vaultBox"); if (b) vaultRender(b.dataset.cid); }
  window.addEventListener("hashchange", function () { if (VKEY) vTouch(); });

  function vaultRender(cid) {
    var box = document.getElementById("vaultBox"); if (!box) return;
    box.dataset.cid = cid;
    var x = cxLoad(), V = x.vault;
    if (!(window.crypto && crypto.subtle)) { box.innerHTML = '<p class="muted">이 브라우저에서는 잠금 기능을 쓸 수 없어요. 크롬이나 엣지로 열어 주세요.</p>'; return; }
    if (!V) {
      box.innerHTML = '<div class="vault-lock"><p class="muted">처음 한 번 <b>금고 비밀번호</b>를 정해요. 이 비밀번호를 잊으면 보안 정보는 <b>아무도 다시 볼 수 없어요</b>(곳간도 저도 못 풀어요). 홈택스 비밀번호와는 다른 것으로 정해 주세요.</p>' +
        '<div class="vault-row"><input type="password" id="vNew1" placeholder="금고 비밀번호 (8자 이상)" autocomplete="new-password"><input type="password" id="vNew2" placeholder="한 번 더" autocomplete="new-password">' +
        '<button class="btn sm" type="button" id="vMake">금고 만들기</button></div><span class="muted" id="vMsg" role="status"></span></div>';
      document.getElementById("vMake").onclick = function () {
        var a = document.getElementById("vNew1").value, b = document.getElementById("vNew2").value, m = document.getElementById("vMsg");
        if (a.length < 8) { m.textContent = "8자 이상으로 정해 주세요."; return; }
        if (a !== b) { m.textContent = "두 칸이 달라요."; return; }
        var salt = crypto.getRandomValues(new Uint8Array(16)), iter = 310000;
        m.textContent = "만드는 중…";
        vDerive(a, salt, iter).then(function (k) {
          return vEnc(k, "gotgan-vault-ok").then(function (chk) {
            var y = cxLoad(); y.vault = { v: 1, salt: vb64e(salt), iter: iter, chk: chk, data: {} }; cxSave(y); VKEY = k; vTouch(); vaultRender(cid);
          });
        });
      };
      return;
    }
    if (!VKEY) {
      box.innerHTML = '<div class="vault-lock"><div class="vault-row"><input type="password" id="vPw" placeholder="금고 비밀번호" autocomplete="current-password">' +
        '<button class="btn sm" type="button" id="vOpen">열기</button></div><span class="muted" id="vMsg" role="status">' + (V.data[cid] ? "저장된 보안 정보가 있어요." : "아직 저장된 보안 정보가 없어요.") + "</span></div>";
      var open = function () {
        var m = document.getElementById("vMsg"); m.textContent = "여는 중…";
        vDerive(document.getElementById("vPw").value, vb64d(V.salt), V.iter).then(function (k) {
          return vDec(k, V.chk).then(function () { VKEY = k; vTouch(); vaultRender(cid); });
        }).catch(function () { m.textContent = "비밀번호가 맞지 않아요."; });
      };
      document.getElementById("vOpen").onclick = open;
      document.getElementById("vPw").onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); open(); } };
      return;
    }
    vTouch();
    (V.data[cid] ? vDec(VKEY, V.data[cid]) : Promise.resolve({})).then(function (d) {
      d = d || {}; var sites = (d.sites || []).concat([{}]);
      function sec(id, label, v, secret, ph) {
        return '<label class="ce-f"><span>' + label + '</span><span class="vault-in"><input id="' + id + '" ' + (secret ? 'type="password" ' : "") + 'value="' + esc(v || "") + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : "") + ' autocomplete="off">' +
          (secret ? '<button class="btn ghost sm" type="button" data-vshow>보기</button>' : "") + '<button class="btn ghost sm" type="button" data-vcopy>복사</button></span></label>';
      }
      function siteRow(s) {
        return '<div class="vault-site"><input data-s="name" value="' + esc(s.name || "") + '" placeholder="사이트 (예: 4대보험 EDI)"><input data-s="id" value="' + esc(s.id || "") + '" placeholder="아이디" autocomplete="off">' +
          '<span class="vault-in"><input data-s="pw" type="password" value="' + esc(s.pw || "") + '" placeholder="비밀번호" autocomplete="off"><button class="btn ghost sm" type="button" data-vshow>보기</button><button class="btn ghost sm" type="button" data-vcopy>복사</button></span></div>';
      }
      box.innerHTML = '<div class="vault-open"><div class="ce-grid">' +
        sec("v_rrn", "대표자 주민등록번호", d.rrn, true, "000000-0000000") + sec("v_htid", "홈택스 아이디", d.htid) + sec("v_htpw", "홈택스 비밀번호", d.htpw, true) +
        '</div><div class="ce-f" style="margin-top:10px"><span>그 밖의 사이트 계정</span><div id="vSites">' + sites.map(siteRow).join("") + '</div><button class="btn ghost sm" type="button" id="vAddSite">+ 사이트 추가</button></div>' +
        '<label class="ce-f" style="margin-top:10px"><span>보안 메모</span><textarea id="v_memo" rows="2">' + esc(d.memo || "") + "</textarea></label>" +
        '<p class="muted vault-note">열려 있어요. 아래 \'저장\'을 누르면 잠긴 채로 저장돼요. 10분 동안 안 쓰면 저절로 잠겨요. <button class="btn ghost sm" type="button" id="vLockBtn">지금 잠그기</button></p></div>';
      document.getElementById("vAddSite").onclick = function () { document.getElementById("vSites").insertAdjacentHTML("beforeend", siteRow({})); vTouch(); };
      document.getElementById("vLockBtn").onclick = vLock;
      box.onclick = function (e) {
        var t = e.target; vTouch();
        if (t.hasAttribute("data-vshow")) { var i = t.parentNode.querySelector("input"); var hid = i.type === "password"; i.type = hid ? "text" : "password"; t.textContent = hid ? "숨기기" : "보기"; }
        if (t.hasAttribute("data-vcopy")) {
          var v = t.parentNode.querySelector("input").value; if (!v) return;
          (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(function () { t.textContent = "복사됨"; setTimeout(function () { t.textContent = "복사"; }, 1500); }, function () { t.textContent = "복사 안 됨"; });
        }
      };
    }).catch(function () { box.innerHTML = '<p class="muted">보안 정보를 풀지 못했어요. 다른 금고(백업)에서 불러온 것인지 확인해 주세요.</p>'; });
  }
  /* 저장할 때: 잠겨 있으면 undefined(그대로 둠), 열려 있고 다 비면 null(지움), 아니면 암호화한 상자 */
  function vaultCollect(cid) {
    if (!VKEY || !document.getElementById("v_rrn")) return Promise.resolve(undefined);
    var g = function (id) { return document.getElementById(id).value.trim(); };
    var d = { rrn: g("v_rrn"), htid: g("v_htid"), htpw: document.getElementById("v_htpw").value, memo: g("v_memo"), sites: [] };
    document.querySelectorAll("#vSites .vault-site").forEach(function (r) {
      var s = {}; r.querySelectorAll("[data-s]").forEach(function (i) { if (i.value.trim()) s[i.dataset.s] = i.dataset.s === "pw" ? i.value : i.value.trim(); });
      if (s.name || s.id || s.pw) d.sites.push(s);
    });
    if (!d.rrn && !d.htid && !d.htpw && !d.memo && !d.sites.length) return Promise.resolve(null);
    return vEnc(VKEY, d);
  }

  function clientEdit(id) {
    var x = cxLoad(), isNew = id === "new";
    var c = isNew ? { id: "n" + Date.now().toString(36), name: "", type: "법인", status: "수임중", kind: "기장", vat: "과세", wht: "월", fy: "12", pay: "", ins: {}, mgr: {}, custom: {}, _base: false, _orig: {} }
      : allClients().filter(function (y) { return y.id === id; })[0];
    if (!c) { app.innerHTML = '<p>거래처를 찾지 못했어요. <a href="#/clients">거래처 현황으로</a></p>'; return; }
    function sel(name, opts, v) { return '<select id="ce_' + name + '">' + opts.map(function (o) { return "<option" + (String(o) === String(v || "") ? " selected" : "") + ">" + esc(o) + "</option>"; }).join("") + "</select>"; }
    function inp(name, v, ph) { return '<input id="ce_' + name + '" value="' + esc(v || "") + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : "") + ">"; }
    function f(label, ctl, hint) { return '<label class="ce-f"><span>' + label + "</span>" + ctl + (hint ? '<small class="muted">' + hint + "</small>" : "") + "</label>"; }
    var mgrNames = {}; allClients().forEach(function (y) { Object.keys(y.mgr || {}).forEach(function (k) { if (y.mgr[k]) mgrNames[y.mgr[k]] = 1; }); });
    var months = []; for (var i = 1; i <= 12; i++) months.push(String(i));
    app.innerHTML = '<div class="crumbs"><a href="#/clients">거래처 현황</a> › ' + (isNew ? "새 거래처" : "거래처 수정") + "</div>" +
      '<h1 class="page-title">' + (isNew ? "새 거래처" : "거래처 수정 · " + esc(c.name)) + "</h1>" +
      '<form class="card ce" id="ceForm" autocomplete="off">' +
      '<h3>기본정보</h3><div class="ce-grid">' +
      f("회사 코드", inp("code", c.code)) + f("수임상태", sel("status", ["수임중", "수임해지"], c.status)) + f("수임구분", sel("kind", ["기장", "신고대리", "조정"], c.kind)) +
      f("사업자등록번호", inp("bizno", c.bizno, "000-00-00000")) + f("상호", inp("name", c.name)) +
      f("법인·개인", sel("type", ["법인", "개인"], c.type)) + f("과세유형", sel("vat", ["", "과세", "간이", "면세"], c.vat), "부가세 신고 대상 판정에 써요") +
      f("대표자", inp("ceo", c.ceo)) + f("업태", inp("biz", c.biz)) + f("종목", inp("item", c.item)) + f("관할서", inp("office", c.office)) +
      f("원천세 신고유형", sel("wht", ["", "월", "반기", "해당없음"], c.wht)) + f("급여일", inp("payday", c.payday, "예: 당월 말일")) +
      f("결산월", sel("fy", months, c.fy || "12"), "법인은 보통 12월") + f("급여 작업 대상", sel("pay", ["", "예", "아니오"], c.pay), "예면 급여 작업·간이지급명세서 대상") +
      f("전화", inp("tel", c.tel)) + f("전자세금계산서 이메일", inp("email", c.email)) + f("사업장 주소", inp("addr", c.addr)) +
      "</div><h3>4대보험 관리번호</h3><div class=\"ce-grid two\">" +
      INS_FIELDS.map(function (k) {
        var vals = (c.ins[k[0]] || []).concat([""]);
        return '<div class="ce-f"><span>' + k[1] + ' 관리번호</span><div class="ins" data-ins="' + k[0] + '">' + vals.map(function (v) { return '<input value="' + esc(v) + '" placeholder="사업자번호-0">'; }).join("") +
          '</div><button class="btn ghost sm" type="button" data-addins="' + k[0] + '">+ 추가</button><small class="muted">지점·공장·건설현장은 번호가 따로 있어요. 빈 줄은 저장하지 않아요.</small></div>';
      }).join("") +
      '</div><h3>담당자</h3><datalist id="mgrList">' + Object.keys(mgrNames).map(function (n) { return '<option value="' + esc(n) + '">'; }).join("") + '<option value="해당없음"></datalist><div class="ce-grid">' +
      MGR_FIELDS.map(function (k) { return f(k[1], '<input id="ce_mgr_' + k[0] + '" list="mgrList" value="' + esc(c.mgr[k[0]] || "") + '">'); }).join("") +
      "</div>" +
      (x.fields.length ? "<h3>내 항목</h3><div class=\"ce-grid\">" + x.fields.map(function (fl) {
        var v = c.custom[fl.id];
        return fl.type === "check" ? f(esc(fl.name), '<input type="checkbox" id="ce_cf_' + fl.id + '"' + (v === true ? " checked" : "") + ">") : f(esc(fl.name), '<input id="ce_cf_' + fl.id + '" value="' + esc(v || "") + '">');
      }).join("") + "</div>" : "") +
      '<h3>🔒 보안 정보 <span class="muted" style="font-size:13px;font-weight:500">금고 비밀번호로 잠가서 저장해요</span></h3><div id="vaultBox"></div>' +
      '<div class="ce-actions"><a class="btn ghost" href="#/clients">취소</a><button class="btn" type="submit">저장</button>' +
      (!isNew && !c._base ? '<button class="btn ghost danger" type="button" id="ceDel">이 거래처 지우기</button>' : "") +
      '<span class="muted" id="ceMsg" role="status"></span></div></form>' +
      '<p class="muted">수임이 끝난 거래처는 수임상태를 \'수임해지\'로 바꾸면 목록과 신고 현황에서 빠져요(지우지 않아요).</p>';
    app.querySelectorAll("[data-addins]").forEach(function (b) {
      b.onclick = function () { var box = app.querySelector('[data-ins="' + b.dataset.addins + '"]'), i2 = document.createElement("input"); i2.placeholder = "사업자번호-0"; box.appendChild(i2); i2.focus(); };
    });
    var del = document.getElementById("ceDel");
    if (del) del.onclick = function () {
      if (del.dataset.step !== "1") { del.dataset.step = "1"; del.textContent = "정말 지울까요?"; return; }
      var y = cxLoad(); y.added = y.added.filter(function (a) { return a.id !== c.id; }); delete y.values[c.id]; if (y.vault) delete y.vault.data[c.id]; cxSave(y); location.hash = "#/clients";
    };
    document.getElementById("ceForm").onsubmit = function (e) {
      e.preventDefault();
      var y = cxLoad(), g = function (n) { var el = document.getElementById("ce_" + n); return el ? el.value.trim() : ""; };
      var d = { code: g("code"), status: g("status"), kind: g("kind"), bizno: g("bizno"), name: g("name"), type: g("type"), vat: g("vat"), ceo: g("ceo"), biz: g("biz"), item: g("item"),
        office: g("office"), wht: g("wht"), payday: g("payday"), fy: g("fy"), pay: g("pay"), tel: g("tel"), email: g("email"), addr: g("addr"), ins: {}, mgr: {}, custom: {} };
      if (!d.name) { document.getElementById("ceMsg").textContent = "상호를 적어 주세요."; return; }
      INS_FIELDS.forEach(function (k) { d.ins[k[0]] = Array.prototype.map.call(app.querySelectorAll('[data-ins="' + k[0] + '"] input'), function (i3) { return i3.value.trim(); }).filter(Boolean); });
      MGR_FIELDS.forEach(function (k) { var v = g("mgr_" + k[0]); if (v) d.mgr[k[0]] = v; });
      y.fields.forEach(function (fl) { var el = document.getElementById("ce_cf_" + fl.id); if (!el) return; if (fl.type === "check") { if (el.checked) d.custom[fl.id] = true; } else if (el.value.trim()) d.custom[fl.id] = el.value.trim(); });
      if (c._base) {  /* 위하고 원본과 같은 값은 저장하지 않아요 */
        var o = c._orig, ov = {};
        Object.keys(d).forEach(function (k) { if (k === "ins" || k === "mgr" || k === "custom") ov[k] = d[k]; else if (String(d[k] || "") !== String(o[k] || "")) ov[k] = d[k]; });
        y.values[c.id] = ov;
      } else {
        d.id = c.id;
        y.added = y.added.filter(function (a) { return a.id !== c.id; }).concat([d]);
      }
      vaultCollect(c.id).then(function (box) { if (box) y.vault.data[c.id] = box; else if (box === null && y.vault) delete y.vault.data[c.id]; cxSave(y); location.hash = "#/clients"; })
        .catch(function () { document.getElementById("ceMsg").textContent = "보안 정보를 저장하지 못했어요. 다시 눌러 주세요."; });
    };
    vaultRender(c.id);
  }


  /* 계산기·만들 기능: 아직 만들지 않은 기능을 사용자가 볼 수 있게 모아 둔 목록. 만들면 이 자리에 붙여요. */
  var PLANNED = [
    { t: "통합고용세액공제 계산기", d: "처음 계획",
      li: ["조세특례제한법 제29조의8 기준으로 상시근로자 증가 인원과 공제액 계산", "청년·장애인 등 우대 인원 구분, 사후관리(인원 감소 시 추가 납부) 확인", "입력한 숫자는 저장하지 않고 화면에서만 계산"] },
    { t: "임원퇴직금 한도초과 계산기", d: "질문함 · 2026-11-20",
      li: ["법인세법 한도 → 소득세법 한도 순서로 초과액 계산 (12강 CASE 1 산식 참고)", "손금불산입·상여 처분 금액과 원천징수영수증 기재 위치까지 정리"] },
    { t: "매매기준율 환율 가져오기", d: "질문함 · 2026-11-20",
      li: ["서울외국환중개 매매기준율을 날짜별로 불러오기", "외화 거래 환산(기말 평가 등)에 바로 쓰기"] },
    { t: "급여 계산기", d: "질문함 · 2026-11-20",
      li: ["세후 금액 계산, 세후 목표액에 맞춘 세전 금액 역산", "4대보험 근로자·회사 부담금 계산", "주휴시간·주휴수당, 통상임금·연장근로수당 계산"] }
  ];
  function viewCalculator() {
    app.innerHTML = '<h1 class="page-title">계산기 · 만들 기능</h1><p class="page-sub">질문함에 남긴 아이디어를 모아 둔 목록이에요. 클로드에게 "급여 계산기 만들어 줘"처럼 말하면 하나씩 만들어 이 자리에 붙여요. 입력한 숫자는 저장하지 않고 화면에서만 계산하게 만들어요.</p>' +
      PLANNED.map(function (x) {
        return '<div class="card placeholder"><b>' + esc(x.t) + '</b> <span class="pill soon">만들 예정</span> <span class="muted">' + esc(x.d) + '</span><ul>' +
          x.li.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul></div>";
      }).join("");
  }

  /* ---------- 질문 남기기 ----------
     사이트는 서버가 없어서 질문을 이 브라우저(localStorage)에 모아 둬요. PC와 휴대폰은 따로 모여요.
     '클로드에게 보낼 질문 복사'로 복사해 대화창에 붙이면, 답은 강의의 '내 질문' 탭이나 사전에 들어와요. */
  var ASK_KEY = "my-questions";
  var ASK_URL = "https://claude.ai/artifact/BozdmExwUqPrC526bARYzG";  /* 모든 기기에서 같이 쓰는 Claude 질문함 */
  function askLoad() { try { return JSON.parse(store(ASK_KEY) || "[]") || []; } catch (e) { return []; } }
  function askSave(list) { store(ASK_KEY, JSON.stringify(list)); }
  function askNorm(s) { return String(s || "").replace(/[\s?.!,·~"'()]/g, "").slice(0, 18); }
  function askAnswered(q) {
    var key = askNorm(q.text);
    if (!key) return null;
    for (var i = 0; i < LECTURES.length; i++) {
      var l = LECTURES[i], hit = l.my && notesList(l, "my").filter(function (x) { return askNorm(x.q).indexOf(key) !== -1 || key.indexOf(askNorm(x.q)) === 0 && askNorm(x.q).length > 8; })[0];
      if (hit) return { href: lecHref(l, hit.id), label: lecLabel(l) + " · 내 질문" };
    }
    return null;
  }
  function askButton(type, id, label) {
    return '<a class="btn ghost ask-btn" href="' + ASK_URL + '" target="_blank" rel="noopener" title="' + esc(label) + ' 질문은 질문함에 \'' + esc(label) + '\'로 적어 주세요">✍ 질문 남기기 ↗</a>';
  }
  function askForm(type, id, label) {
    return '<div class="card ask-form"><label for="askText"><b>질문 남기기</b> <span class="muted">' + esc(label || "일반 질문") + '</span></label>' +
      '<textarea id="askText" rows="3" placeholder="궁금한 점을 적어 두세요. 나중에 클로드에게 한꺼번에 물어봐요."></textarea>' +
      '<div class="ask-row"><button class="btn" type="button" id="askSave">저장</button>' + (type === "free" ? "" : '<a class="btn ghost" href="#/ask">내 질문함 보기</a>') + '<span class="muted" id="askMsg" role="status"></span></div></div>';
  }
  function bindAskForm(host, type, id, label) {
    host.querySelector("#askSave").onclick = function () {
      var t = host.querySelector("#askText").value.trim();
      if (!t) { host.querySelector("#askText").focus(); return; }
      var list = askLoad();
      list.push({ id: Date.now().toString(36), text: t, type: type, ref: id, label: label, at: new Date().toISOString().slice(0, 10) });
      askSave(list);
      host.querySelector("#askText").value = "";
      host.querySelector("#askMsg").textContent = "저장했어요 (질문함 " + list.length + "개)";
      if (location.hash.indexOf("#/ask") === 0) viewAsk();
    };
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("button.ask-btn");
    if (!b) return;
    var old = document.querySelector(".ask-slot");
    if (old) { old.remove(); return; }
    var slot = document.createElement("div"); slot.className = "ask-slot";
    slot.innerHTML = askForm(b.dataset.askType, b.dataset.askId, b.dataset.askLabel);
    b.insertAdjacentElement("afterend", slot);
    bindAskForm(slot, b.dataset.askType, b.dataset.askId, b.dataset.askLabel);
    slot.querySelector("textarea").focus();
  });
  function askHref(q) {
    if (q.type === "lecture") { var l = LECTURES.filter(function (x) { return x.id === q.ref; })[0]; return l ? lecHref(l) : ""; }
    if (q.type === "dict") return "#/dict/" + encodeURIComponent(q.ref);
    return "";
  }
  function askCopyText(list) {
    return "곳간 질문함에서 보낸 질문이에요. axtax(현행 조문·국세청 해석)로 답을 찾아 강의는 '내 질문' 탭(.my.md), 사전은 해당 항목에 넣어 주세요.\n\n" +
      list.map(function (q, i) { return (i + 1) + ". [" + (q.label || "일반") + "] " + q.text; }).join("\n");
  }
  /* 예전 방식(이 브라우저에만 저장)으로 남은 질문 정리 화면. 새 질문은 모두 공용 질문함(ASK_URL)으로. */
  function viewAsk() {
    var list = askLoad();
    app.innerHTML = '<h1 class="page-title">예전 질문 정리</h1>' +
      '<div class="card ask-form"><b>질문은 이제 한 곳, 질문함에만 모여요</b><p class="muted" style="margin:0">노트북·PC·휴대폰 어디서 적어도 같은 목록이 보이고, 답이 달리면 \'답변 완료\'로 바뀌어요.</p>' +
      '<p style="margin:0"><a class="btn" href="' + ASK_URL + '" target="_blank" rel="noopener">질문함 열기 ↗</a></p></div>' +
      (list.length ?
        '<h2 class="section-h">이 기기에만 남은 예전 질문 <span class="muted">' + list.length + '</span></h2>' +
        '<p class="muted">예전 방식으로 이 브라우저에만 저장된 질문이에요. 클로드에게 이미 보냈다면 비워 주세요. 아직 안 보냈다면 복사해서 보내거나 질문함에 다시 적어 주세요.</p>' +
        '<div class="ask-row" style="margin-bottom:12px"><button class="btn ghost" type="button" id="askCopy">복사</button><button class="btn ghost" type="button" id="askClear">모두 비우기</button><span class="muted" id="askCopyMsg" role="status"></span></div>' +
        '<textarea id="askCopyBox" class="ask-copybox" readonly hidden></textarea>' +
        list.map(function (q) { return '<div class="card ask-item"><div><p class="ask-q">' + esc(q.text) + '</p><p class="muted">' + esc(q.label || "일반 질문") + " · " + esc(q.at || "") + "</p></div></div>"; }).join("")
        : '<p class="muted">이 기기에 남은 예전 질문은 없어요.</p>');
    var cp = document.getElementById("askCopy");
    if (cp) cp.onclick = function () {
      var text = askCopyText(list), msg = document.getElementById("askCopyMsg"), box = document.getElementById("askCopyBox");
      function fallback() { box.hidden = false; box.value = text; box.focus(); box.select(); msg.textContent = "아래 글을 길게 눌러 복사해 주세요."; }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { msg.textContent = "복사했어요."; }, fallback);
      else fallback();
    };
    var cl = document.getElementById("askClear");
    if (cl) cl.onclick = function () {
      if (cl.dataset.step !== "1") { cl.dataset.step = "1"; cl.textContent = "정말 비울까요?"; return; }
      askSave([]); viewAsk();
    };
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
    else if (nav === "clients") viewClients(parts[1]);
    else if (nav === "dict") { if (parts[1]) viewDictEntry(parts[1], parts[2]); else viewDict(); }
    else if (nav === "calculator") viewCalculator();
    else if (nav === "ask") viewAsk();
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
