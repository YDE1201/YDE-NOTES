/* 나의 업무 노트 - 화면 동작
   데이터: data/summaries.js (tools/build_site.py 가 만듦) 또는 data/sample.js (예시)
   인터넷 연결 없이, 파일을 더블클릭해서 열어도 동작하도록 만들었어요. */
function main() {
  "use strict";

  var REAL = window.SUMMARIES || null;
  var DATA = REAL || window.SAMPLE_SUMMARIES || { meta: { total: 45 }, lectures: [] };
  var USING_SAMPLE = !REAL;
  var LECTURES = (DATA.lectures || []).slice().sort(function (a, b) { return a.no - b.no; });
  var META = DATA.meta || {};
  var app = document.getElementById("app");

  /* ---------- 작은 도우미 ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function findLecture(no) {
    for (var i = 0; i < LECTURES.length; i++) if (String(LECTURES[i].no) === String(no)) return LECTURES[i];
    return null;
  }
  function lecLabel(l) { return l.no + "강. " + l.title; }
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
  var LAW_RE = /((?:법인세법|소득세법|부가가치세법|국세기본법|국세징수법|조세특례제한법|조특법|국제조세조정에 관한 법률|국조법|지방세법|상법|민법|외감법)\s*)?((?:시행령|시행규칙)\s*)?제\d+조(?:의\d+)?(?:\s*제\d+항)?(?:\s*제\d+호)?/g;

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

  /* ---------- 화면들 ---------- */
  function sampleNotice() {
    if (!USING_SAMPLE) return "";
    return '<div class="notice">지금은 <b>예시 화면</b>이에요. 내 컴퓨터의 요약본을 넣으려면 저장소 폴더에서 <b>사이트_업데이트.bat</b> 을 두 번 클릭해 주세요.</div>';
  }

  function viewHome() {
    var total = META.total || 45, done = LECTURES.length;
    var pct = Math.min(100, Math.round(done / total * 100));
    var recent = LECTURES.slice().sort(function (a, b) { return String(b.updated || "").localeCompare(String(a.updated || "")) || b.no - a.no; }).slice(0, 3);
    app.innerHTML = sampleNotice() +
      '<h1 class="page-title">오늘도 한 걸음씩</h1>' +
      '<p class="page-sub">법인세 강의 요약과 실무 도구를 한곳에 모았어요.</p>' +
      '<div class="card"><b>법인세 강의 요약 진행</b>' +
        '<div class="progress"><span style="width:' + pct + '%"></span></div>' +
        '<span class="muted">' + total + '개 중 ' + done + '개 완료 (' + pct + '%)</span></div>' +
      '<h2 class="section-h">궁금한 내용 찾기</h2>' +
      '<form class="searchbox" id="homeSearch"><input name="q" placeholder="예: 신고기한 연장, 최초 사업연도" aria-label="검색어"><button class="btn">찾기</button></form>' +
      (recent.length ? '<h2 class="section-h">최근 추가된 요약</h2><div class="lec-list">' + recent.map(lecItem).join("") + "</div>" : "") +
      '<h2 class="section-h">메뉴</h2><div class="grid">' +
        tile("#/lectures", "📘", "법인세 강의 요약", "강의별 요약본을 읽기 좋게 모아 봐요.") +
        tile("#/search", "🔎", "검색", "요약본 전체에서 답과 출처 강의를 찾아요.") +
        tile("#/clients", "📊", "거래처 현황", "엑셀을 열어서 보기만 해요. 저장하지 않아요.", true) +
        tile("#/calculator", "🧮", "통합고용세액공제 계산기", "인원 변동으로 공제액을 계산해요.", true) +
      "</div>";
    document.getElementById("homeSearch").onsubmit = function (e) {
      e.preventDefault();
      location.hash = "#/search?q=" + encodeURIComponent(this.q.value.trim());
    };
  }
  function tile(href, ico, title, desc, soon) {
    return '<a class="card tile" href="' + href + '"><div class="big">' + ico + "</div><h3>" + esc(title) +
      (soon ? ' <span class="pill soon">준비 중</span>' : "") + "</h3><p>" + esc(desc) + "</p></a>";
  }
  function lecItem(l) {
    var kw = (l.keywords || []).slice(0, 5).join(" · ");
    return '<a class="card lec-item" href="#/lecture/' + l.no + '"><div class="lec-no">' + l.no + "</div><div><h3>" +
      esc(l.title) + "</h3><p>" + esc([l.length, kw].filter(Boolean).join("  |  ")) + "</p></div></a>";
  }

  function viewLectures() {
    app.innerHTML = sampleNotice() +
      '<h1 class="page-title">법인세 강의 요약</h1>' +
      '<p class="page-sub">' + esc(META.course || "택스에듀넷 법인세 세무조정 실무") + " · " + LECTURES.length + "개 정리됨</p>" +
      '<div class="searchbox lec-filter"><input id="lecFilter" placeholder="강의 제목이나 키워드로 거르기" aria-label="강의 거르기"></div>' +
      '<div class="lec-list" id="lecList"></div>';
    var list = document.getElementById("lecList");
    function draw(f) {
      f = (f || "").trim().toLowerCase();
      var items = LECTURES.filter(function (l) {
        return !f || (l.no + " " + l.title + " " + (l.keywords || []).join(" ")).toLowerCase().indexOf(f) !== -1;
      });
      list.innerHTML = items.length ? items.map(lecItem).join("") : '<p class="muted">맞는 강의가 없어요.</p>';
    }
    document.getElementById("lecFilter").oninput = function () { draw(this.value); };
    draw("");
  }

  var spy = null;
  function viewLecture(no, secId) {
    var l = findLecture(no);
    if (!l) { app.innerHTML = '<p>요약본을 찾지 못했어요. <a href="#/lectures">목록으로</a></p>'; return; }
    var body = renderMarkdown(l.md);
    var heads = body.querySelectorAll("h2, h3");
    var toc = '<details open><summary>목차</summary>' + Array.prototype.map.call(heads, function (h) {
      return '<a class="' + h.tagName.toLowerCase() + '" href="#/lecture/' + l.no + "/" + h.id + '" data-sec="' + h.id + '">' + esc(h.textContent) + "</a>";
    }).join("") + "</details>";
    var i = LECTURES.indexOf(l), prev = LECTURES[i - 1], next = LECTURES[i + 1];
    app.innerHTML = '<div class="lecture"><aside class="toc">' + toc + '</aside><article class="doc"><div class="doc-meta">' +
      (l.source ? "<span>" + esc(l.source) + "</span>" : "") + (l.length ? "<span>" + esc(l.length) + "</span>" : "") +
      (l.updated ? "<span>정리 " + esc(l.updated) + "</span>" : "") + '</div><div id="docBody"></div>' +
      '<div class="doc-nav">' + (prev ? '<a class="card" href="#/lecture/' + prev.no + '">← ' + esc(lecLabel(prev)) + "</a>" : "<span></span>") +
      (next ? '<a class="card next" href="#/lecture/' + next.no + '">' + esc(lecLabel(next)) + " →</a>" : "<span></span>") + "</div></article></div>";
    document.getElementById("docBody").appendChild(body);
    if (window.innerWidth <= 1100) app.querySelector(".toc details").removeAttribute("open");
    document.title = lecLabel(l) + " · 나의 업무 노트";

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

  function viewSearch(q) {
    var kws = [];
    LECTURES.forEach(function (l) { (l.keywords || []).forEach(function (k) { if (kws.indexOf(k) === -1) kws.push(k); }); });
    kws = kws.sort(function () { return Math.random() - 0.5; }).slice(0, 12);
    app.innerHTML = sampleNotice() +
      '<h1 class="page-title">검색</h1>' +
      '<p class="page-sub">요약본 전체에서 가장 가까운 내용과 출처 강의를 찾아 드려요.</p>' +
      '<form class="searchbox" id="searchForm"><input name="q" id="q" placeholder="예: 외부감사 끝나지 않으면 신고기한 연장" aria-label="검색어" value="' + esc(q) + '"><button class="btn">찾기</button></form>' +
      (kws.length ? '<div class="chips">' + kws.map(function (k) { return '<a class="chip" href="#/search?q=' + encodeURIComponent(k) + '">' + esc(k) + "</a>"; }).join("") + "</div>" : "") +
      '<div id="results" style="margin-top:22px"></div>';
    var form = document.getElementById("searchForm");
    form.onsubmit = function (e) {
      e.preventDefault();
      location.hash = "#/search?q=" + encodeURIComponent(form.q.value.trim());
    };
    if (!q) { document.getElementById("q").focus(); return; }
    var r = search(q), box = document.getElementById("results");
    if (!r.results.length) {
      box.innerHTML = '<p class="muted">"' + esc(q) + '"와 맞는 내용을 찾지 못했어요. 더 짧은 단어로 찾아보세요.</p>';
      return;
    }
    var top = r.results[0].c;
    var topMd = top.md.length > 1500 ? top.md.slice(0, top.md.lastIndexOf("\n", 1500)) + "\n\n…" : top.md;
    var ans = document.createElement("div");
    ans.className = "card answer";
    ans.innerHTML = '<div class="label">가장 가까운 내용</div><h3>' + esc(lecLabel(top.lec)) + " › " + esc(top.heading) +
      '</h3><div class="doc" id="ansBody"></div><p style="margin:12px 0 0"><a class="btn" href="#/lecture/' + top.lec.no + "/" + top.secId +
      '">본문에서 보기</a></p><p class="muted" style="font-size:13px;margin:10px 0 0">요약본에 적힌 내용을 그대로 찾아 보여 드려요. 실제 적용 전에는 조문을 한 번 더 확인하세요.</p>';
    var rendered = renderMarkdown(topMd);
    rendered.querySelectorAll("h2, h3").forEach(function (h) { h.remove(); });
    ans.querySelector("#ansBody").appendChild(rendered);
    highlight(rendered, r.terms);
    box.innerHTML = "";
    box.appendChild(ans);
    if (r.results.length > 1) {
      var more = document.createElement("div");
      more.innerHTML = '<h2 class="section-h">다른 관련 내용 ' + (r.results.length - 1) + "개</h2>" +
        r.results.slice(1).map(function (x) {
          return '<a class="card result" href="#/lecture/' + x.c.lec.no + "/" + x.c.secId + '"><div class="src">' + esc(lecLabel(x.c.lec)) +
            "</div><h4>" + esc(x.c.heading) + "</h4><p>" + esc(snippet(plain(x.c.md), r.terms)) + "</p></a>";
        }).join("");
      highlight(more, r.terms);
      box.appendChild(more);
    }
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
    document.title = "나의 업무 노트";
    if (nav === "lectures") viewLectures();
    else if (nav === "lecture") { nav = "lectures"; viewLecture(parts[1], parts[2]); }
    else if (nav === "search") viewSearch((query.match(/(?:^|&)q=([^&]*)/) || [])[1] || "");
    else if (nav === "clients") viewClients();
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
    store("theme", next);
  };
  document.getElementById("menuBtn").onclick = function () { document.body.classList.toggle("nav-open"); };
  document.getElementById("scrim").onclick = function () { document.body.classList.remove("nav-open"); };
  document.getElementById("navFoot").textContent = USING_SAMPLE ? "예시 데이터로 보는 중" :
    "요약본 " + LECTURES.length + "개" + (META.built ? " · " + META.built + " 업데이트" : "") + (META.public ? " · 공개용" : "");

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
    '<h1 class="page-title" style="font-size:22px">🔒 나의 업무 노트</h1>' +
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
