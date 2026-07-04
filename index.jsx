import React, { useState, useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";

/* ────────────────────────────────────────────────
   LEXIGRAPH — 유의어·반의어 그래프 단어장
   Free Dictionary API (+ Claude 폴백) · d3-force · Glassmorphism
──────────────────────────────────────────────── */

const C = {
  bg: "#F6F2E9",
  ink: "#2C2C2C",
  faint: "#8D8674",
  syn: "#77323A", // burgundy — 유의어 / 핵심 UI
  ant: "#3E5A7E", // slate navy — 반의어
  hairline: "rgba(140,130,110,.22)",
};
const SERIF = `'Cormorant Garamond','Noto Serif KR',Georgia,'Times New Roman',serif`;

/* 글래스 패널 공통 스타일 */
const glass = (alpha = 0.52, blur = 18) => ({
  background: `rgba(255,255,255,${alpha})`,
  backdropFilter: `blur(${blur}px) saturate(1.5)`,
  WebkitBackdropFilter: `blur(${blur}px) saturate(1.5)`,
  border: "1px solid rgba(255,255,255,.72)",
});

/* ───────────── persistence (window.storage, 실패 시 메모리) ───────────── */
let memoryBooks = null;
async function loadBooks() {
  try {
    const r = await window.storage.get("lexigraph-books");
    return r ? JSON.parse(r.value) : [];
  } catch {
    return memoryBooks || [];
  }
}
async function saveBooks(books) {
  memoryBooks = books;
  try {
    await window.storage.set("lexigraph-books", JSON.stringify(books));
  } catch {}
}

/* ───────────── Dictionary 데이터 소스 ─────────────
   1차: Free Dictionary API
   2차: (네트워크 차단·미등재 시) Claude API로 동일 구조의 JSON 생성 */
function normalize(word, phonetic, definitions, synonyms, antonyms) {
  const syn = new Set(synonyms), ant = new Set(antonyms);
  syn.delete(word); ant.delete(word);
  ant.forEach((a) => syn.delete(a));
  return {
    word,
    phonetic: phonetic || "",
    definitions: definitions.filter((d) => d && d.def),
    synonyms: [...syn].slice(0, 12),
    antonyms: [...ant].slice(0, 9),
  };
}

async function fetchFromDictionaryAPI(word) {
  const res = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
  );
  if (!res.ok) throw new Error("not-found");
  const data = await res.json();
  const syn = [], ant = [], definitions = [];
  data.forEach((entry) =>
    (entry.meanings || []).forEach((m) => {
      (m.synonyms || []).forEach((s) => syn.push(s));
      (m.antonyms || []).forEach((a) => ant.push(a));
      (m.definitions || []).forEach((d) => {
        definitions.push({ pos: m.partOfSpeech, def: d.definition, example: d.example || null });
        (d.synonyms || []).forEach((s) => syn.push(s));
        (d.antonyms || []).forEach((a) => ant.push(a));
      });
    })
  );
  const ph = data[0].phonetic || (data[0].phonetics || []).find((p) => p.text)?.text;
  return normalize(data[0].word, ph, definitions, syn, ant);
}

async function fetchFromClaude(word) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `You are an English dictionary. For the word "${word}", respond with ONLY a raw JSON object (no markdown fences, no prose):
{"found":true,"word":"...","phonetic":"/.../","definitions":[{"pos":"noun|verb|adjective|...","def":"concise definition","example":"a natural example sentence"}],"synonyms":["up to 12 single-word synonyms"],"antonyms":["up to 9 single-word antonyms"]}
Include 2-3 definitions. If "${word}" is not a real English word, respond {"found":false}.`,
        },
      ],
    }),
  });
  const data = await res.json();
  const text = (data.content || [])
    .filter((i) => i.type === "text")
    .map((i) => i.text)
    .join("");
  const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
  if (!parsed.found) throw new Error("not-found");
  return normalize(
    parsed.word || word,
    parsed.phonetic,
    (parsed.definitions || []).map((d) => ({ pos: d.pos, def: d.def, example: d.example || null })),
    parsed.synonyms || [],
    parsed.antonyms || []
  );
}

async function fetchWord(raw) {
  const word = raw.trim().toLowerCase();
  try {
    return await fetchFromDictionaryAPI(word);
  } catch (e) {
    // 네트워크(CSP) 차단이든 미등재든 Claude 폴백을 한 번 시도
    return await fetchFromClaude(word);
  }
}

/* ───────────── 그래프 뷰 ───────────── */
function GraphView({ data, filter, onNodeTap }) {
  const wrapRef = useRef(null);
  const nodeEls = useRef(new Map());
  const linkEls = useRef([]);
  const simRef = useRef(null);
  const nodesRef = useRef([]);
  const dragRef = useRef(null);

  const nodes = React.useMemo(() => {
    const cw = 34 + data.word.length * 11;
    return [
      { id: data.word, kind: "center", w: cw, r: cw / 2 + 8 },
      ...data.synonyms.map((s) => {
        const w = 26 + s.length * 8.2;
        return { id: s, kind: "syn", w, r: w / 2 + 7 };
      }),
      ...data.antonyms.map((a) => {
        const w = 26 + a.length * 8.2;
        return { id: a, kind: "ant", w, r: w / 2 + 7 };
      }),
    ];
  }, [data]);

  const links = React.useMemo(
    () =>
      nodes
        .filter((n) => n.kind !== "center")
        .map((n) => ({ source: data.word, target: n.id, kind: n.kind })),
    [nodes, data.word]
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;
    nodes.forEach((n, i) => {
      if (n.kind === "center") { n.x = W / 2; n.y = H / 2; }
      else {
        const a = (i / nodes.length) * Math.PI * 2;
        n.x = W / 2 + Math.cos(a) * 120;
        n.y = H / 2 + Math.sin(a) * 120;
      }
    });
    nodesRef.current = nodes;

    const sim = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id)
        .distance((l) => (l.kind === "syn" ? 105 : 150)).strength(0.5))
      .force("charge", d3.forceManyBody().strength(-220))
      .force("collide", d3.forceCollide((d) => d.r).iterations(2))
      .force("x", d3.forceX(W / 2).strength((d) => (d.kind === "center" ? 0.22 : 0.03)))
      .force("y", d3.forceY(H / 2).strength((d) => (d.kind === "center" ? 0.22 : 0.035)))
      .velocityDecay(0.32)
      .alpha(1);

    sim.on("tick", () => {
      const w = el.clientWidth, h = el.clientHeight;
      nodes.forEach((n) => {
        n.x = Math.max(n.r, Math.min(w - n.r, n.x));
        n.y = Math.max(n.r + 4, Math.min(h - n.r, n.y));
        const dom = nodeEls.current.get(n.id);
        if (dom) dom.style.transform = `translate(${n.x}px,${n.y}px) translate(-50%,-50%)`;
      });
      links.forEach((l, i) => {
        const dom = linkEls.current[i];
        if (dom) {
          dom.setAttribute("x1", l.source.x);
          dom.setAttribute("y1", l.source.y);
          dom.setAttribute("x2", l.target.x);
          dom.setAttribute("y2", l.target.y);
        }
      });
    });
    simRef.current = sim;
    return () => sim.stop();
  }, [nodes, links]);

  const onDown = useCallback((e, id) => {
    const n = nodesRef.current.find((d) => d.id === id);
    if (!n) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      n, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY,
      vx: 0, vy: 0, t: performance.now(), moved: false,
    };
    n.fx = n.x; n.fy = n.y;
    simRef.current?.alphaTarget(0.28).restart();
  }, []);

  const onMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    const now = performance.now();
    const dx = e.clientX - d.lx, dy = e.clientY - d.ly;
    const dt = Math.max(now - d.t, 1);
    d.vx = (dx / dt) * 16; d.vy = (dy / dt) * 16;
    d.lx = e.clientX; d.ly = e.clientY; d.t = now;
    d.n.fx += dx; d.n.fy += dy;
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) d.moved = true;
  }, []);

  const onUp = useCallback((e, id) => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    simRef.current?.alphaTarget(0);
    const clamp = (v) => Math.max(-14, Math.min(14, v));
    d.n.vx = clamp(d.vx * 1.4); // 살짝 관성
    d.n.vy = clamp(d.vy * 1.4);
    d.n.fx = null; d.n.fy = null;
    if (!d.moved) onNodeTap(id, d.n.kind);
    else simRef.current?.alpha(0.4).restart();
  }, [onNodeTap]);

  const dimmed = (kind) =>
    filter === "all" || kind === "center" || kind === filter ? 1 : 0.16;

  return (
    <div ref={wrapRef} style={{ position: "absolute", inset: 0, touchAction: "none" }}>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {links.map((l, i) => (
          <line
            key={i}
            ref={(el) => (linkEls.current[i] = el)}
            stroke={l.kind === "syn" ? C.syn : C.ant}
            strokeWidth={l.kind === "syn" ? 1.4 : 1.3}
            strokeDasharray={l.kind === "ant" ? "5 6" : "none"}
            strokeLinecap="round"
            style={{ opacity: 0.5 * dimmed(l.kind), transition: "opacity .45s ease" }}
          />
        ))}
      </svg>
      {nodes.map((n) => {
        const center = n.kind === "center";
        return (
          <div
            key={n.id}
            ref={(el) => { el ? nodeEls.current.set(n.id, el) : nodeEls.current.delete(n.id); }}
            onPointerDown={(e) => onDown(e, n.id)}
            onPointerMove={onMove}
            onPointerUp={(e) => onUp(e, n.id)}
            style={{
              position: "absolute", left: 0, top: 0,
              padding: center ? "12px 22px" : "8px 15px",
              borderRadius: 999,
              background: center ? "rgba(119,50,58,.82)" : "rgba(255,255,255,.42)",
              backdropFilter: "blur(10px) saturate(1.5)",
              WebkitBackdropFilter: "blur(10px) saturate(1.5)",
              color: center ? "#FDFAF3" : n.kind === "syn" ? C.syn : C.ant,
              fontFamily: SERIF,
              fontSize: center ? 21 : 15.5,
              fontWeight: center ? 600 : 500,
              letterSpacing: "0.01em",
              whiteSpace: "nowrap",
              cursor: "grab",
              userSelect: "none",
              border: center
                ? "1px solid rgba(255,255,255,.35)"
                : "1px solid rgba(255,255,255,.75)",
              boxShadow: center
                ? "0 14px 30px -8px rgba(119,50,58,.42), inset 0 1px 0 rgba(255,255,255,.25)"
                : "0 10px 24px -8px rgba(44,44,44,.18), inset 0 1px 0 rgba(255,255,255,.6)",
              opacity: dimmed(n.kind),
              transition: "opacity .45s ease, box-shadow .3s ease",
            }}
          >
            {n.id}
          </div>
        );
      })}
    </div>
  );
}

/* ───────────── 작은 공용 컴포넌트 ───────────── */
function Pill({ active, onClick, children, color = C.syn }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...(!active ? glass(0.4, 12) : {}),
        ...(active ? { background: color, border: "1px solid rgba(255,255,255,.35)" } : {}),
        color: active ? "#FDFAF3" : C.faint,
        borderRadius: 999, padding: "7px 14px",
        fontFamily: SERIF, fontSize: 13.5, fontWeight: 600,
        transition: "all .35s cubic-bezier(.22,.9,.3,1)",
        boxShadow: active ? "0 6px 16px -6px rgba(44,44,44,.35)" : "0 4px 12px -6px rgba(44,44,44,.15)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Modal({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "rgba(60,52,40,.28)", backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "lg-fade .3s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...glass(0.68, 24),
          borderRadius: 22, padding: 24, width: "min(320px, 84vw)",
          boxShadow: "0 30px 60px -20px rgba(44,44,44,.4), inset 0 1px 0 rgba(255,255,255,.8)",
          animation: "lg-pop .45s cubic-bezier(.34,1.4,.5,1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ───────────── 하단 슬라이드업 시트 (단어 상세) ───────────── */
function WordSheet({ word, books, onClose, onExplore, onAdd, onCreateBookAdd }) {
  const [detail, setDetail] = useState(null);
  const [err, setErr] = useState(false);
  const [picking, setPicking] = useState(false);
  const [newName, setNewName] = useState("");
  const [added, setAdded] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    setDetail(null); setErr(false); setPicking(false); setAdded(null);
    let live = true;
    fetchWord(word)
      .then((d) => live && setDetail(d))
      .catch(() => live && setErr(true));
    return () => { live = false; };
  }, [word]);

  const close = () => { setOpen(false); setTimeout(onClose, 420); };

  const entry = detail && {
    word: detail.word, phonetic: detail.phonetic,
    definitions: detail.definitions.slice(0, 3),
    synonyms: detail.synonyms.slice(0, 8),
    addedAt: Date.now(),
  };

  return (
    <>
      <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 40, background: open ? "rgba(60,52,40,.2)" : "transparent", transition: "background .4s ease" }} />
      <div
        style={{
          ...glass(0.62, 26),
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50,
          borderRadius: "26px 26px 0 0",
          borderBottom: "none",
          boxShadow: "0 -18px 50px -12px rgba(44,44,44,.28), inset 0 1px 0 rgba(255,255,255,.85)",
          maxHeight: "72vh", overflowY: "auto",
          padding: "14px 24px calc(24px + env(safe-area-inset-bottom))",
          transform: open ? "translateY(0)" : "translateY(105%)",
          transition: "transform .5s cubic-bezier(.22,1.1,.3,1)",
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 4, background: "rgba(140,130,110,.35)", margin: "0 auto 16px" }} />
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, color: C.ink, margin: 0 }}>{word}</h2>
          {detail?.phonetic && <span style={{ fontFamily: SERIF, color: C.faint, fontSize: 14 }}>{detail.phonetic}</span>}
        </div>

        {!detail && !err && <p style={{ fontFamily: SERIF, color: C.faint, marginTop: 18, fontSize: 14 }}>사전을 펼치는 중…</p>}
        {err && (
          <p style={{ fontFamily: SERIF, color: C.faint, marginTop: 18, lineHeight: 1.6, fontSize: 14 }}>
            이 단어의 정의를 찾지 못했어요. 철자를 확인하거나 다른 단어를 눌러 보세요.
          </p>
        )}

        {detail && (
          <div style={{ marginTop: 14 }}>
            {detail.definitions.slice(0, 3).map((d, i) => (
              <div key={i} style={{ padding: "12px 0", borderTop: i ? `1px solid ${C.hairline}` : "none" }}>
                <div style={{ fontFamily: SERIF, fontSize: 12.5, fontStyle: "italic", color: C.syn, marginBottom: 4 }}>{d.pos}</div>
                <div style={{ fontFamily: SERIF, fontSize: 15, color: C.ink, lineHeight: 1.55 }}>{d.def}</div>
                {d.example && (
                  <div style={{ fontFamily: SERIF, fontSize: 13.5, color: C.faint, fontStyle: "italic", marginTop: 6, paddingLeft: 12, borderLeft: `2px solid ${C.hairline}` }}>
                    “{d.example}”
                  </div>
                )}
              </div>
            ))}

            {!picking && !added && (
              <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                <button
                  onClick={() => setPicking(true)}
                  style={{ flex: 1, background: "rgba(119,50,58,.88)", backdropFilter: "blur(8px)", color: "#FDFAF3", border: "1px solid rgba(255,255,255,.3)", borderRadius: 14, padding: "14px 0", fontFamily: SERIF, fontSize: 15.5, fontWeight: 600, boxShadow: "0 10px 22px -8px rgba(119,50,58,.5)", cursor: "pointer" }}
                >
                  단어장에 추가하기
                </button>
                <button
                  onClick={() => { close(); onExplore(word); }}
                  style={{ ...glass(0.35, 10), color: C.ant, borderRadius: 14, padding: "14px 16px", fontFamily: SERIF, fontSize: 14.5, fontWeight: 600, cursor: "pointer" }}
                >
                  이 단어로 탐색
                </button>
              </div>
            )}

            {picking && !added && (
              <div style={{ marginTop: 16, animation: "lg-fade .35s ease" }}>
                <div style={{ fontFamily: SERIF, fontSize: 13.5, color: C.faint, marginBottom: 10 }}>어느 단어장에 담을까요?</div>
                {books.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => { onAdd(b.id, entry); setAdded(b.title); }}
                    style={{ ...glass(0.42, 10), display: "flex", justifyContent: "space-between", width: "100%", borderRadius: 12, padding: "12px 14px", marginBottom: 8, fontFamily: SERIF, fontSize: 15, color: C.ink, cursor: "pointer" }}
                  >
                    <span>{b.title}</span>
                    <span style={{ color: C.faint, fontSize: 13 }}>{b.words.length}단어</span>
                  </button>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="새 단어장 이름"
                    style={{ ...glass(0.5, 10), flex: 1, borderRadius: 12, padding: "11px 13px", fontFamily: SERIF, fontSize: 14.5, color: C.ink, outline: "none" }}
                  />
                  <button
                    onClick={() => { if (!newName.trim()) return; onCreateBookAdd(newName.trim(), entry); setAdded(newName.trim()); }}
                    style={{ background: "rgba(44,44,44,.85)", backdropFilter: "blur(8px)", color: "#FDFAF3", border: "1px solid rgba(255,255,255,.25)", borderRadius: 12, padding: "0 16px", fontFamily: SERIF, fontSize: 14, cursor: "pointer" }}
                  >
                    만들고 담기
                  </button>
                </div>
              </div>
            )}

            {added && (
              <div style={{ marginTop: 18, textAlign: "center", fontFamily: SERIF, fontSize: 15, color: C.syn, animation: "lg-pop .5s cubic-bezier(.34,1.5,.5,1)" }}>
                ❦ 『{added}』에 담았어요
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ───────────── 탐색(그래프) 화면 ───────────── */
function ExploreView({ books, addWord, createBookAdd }) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [sheetWord, setSheetWord] = useState(null);

  const search = async (w) => {
    const word = (w ?? query).trim();
    if (!word) return;
    setLoading(true); setError(null); setSheetWord(null);
    try {
      const d = await fetchWord(word);
      setData(d);
      if (!d.synonyms.length && !d.antonyms.length)
        setError("연결된 유의어·반의어가 없는 단어예요. 정의만 볼 수 있어요.");
      setQuery(word);
    } catch {
      setError("사전에서 찾지 못한 단어예요. 철자를 확인해 주세요.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "18px 20px 10px", zIndex: 10 }}>
        <div style={{ fontFamily: SERIF, fontSize: 12, letterSpacing: "0.18em", color: C.faint, textTransform: "uppercase", marginBottom: 8 }}>
          Lexigraph · 낱말의 별자리
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="영단어 검색"
            style={{
              ...glass(0.5, 16),
              flex: 1, borderRadius: 16,
              padding: "13px 16px", fontFamily: SERIF, fontSize: 16, color: C.ink,
              outline: "none",
              boxShadow: "0 10px 28px -14px rgba(44,44,44,.28), inset 0 1px 0 rgba(255,255,255,.8)",
            }}
          />
          <button
            onClick={() => search()}
            style={{ background: "rgba(44,44,44,.85)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", color: "#FDFAF3", border: "1px solid rgba(255,255,255,.25)", borderRadius: 16, padding: "0 18px", fontFamily: SERIF, fontSize: 15, fontWeight: 600, cursor: "pointer", boxShadow: "0 10px 22px -10px rgba(44,44,44,.5)" }}
          >
            찾기
          </button>
        </div>
        {data && (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Pill active={filter === "all"} onClick={() => setFilter("all")} color="rgba(44,44,44,.85)">둘 다 보기</Pill>
            <Pill active={filter === "syn"} onClick={() => setFilter("syn")} color="rgba(119,50,58,.85)">유의어만</Pill>
            <Pill active={filter === "ant"} onClick={() => setFilter("ant")} color="rgba(62,90,126,.85)">반의어만</Pill>
          </div>
        )}
      </div>

      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        {loading && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: SERIF, color: C.faint, fontSize: 14 }}>
            낱말의 지도를 그리는 중…
          </div>
        )}
        {!loading && !data && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 32, textAlign: "center" }}>
            <div style={{ ...glass(0.35, 14), borderRadius: 24, padding: "28px 26px", boxShadow: "0 18px 40px -18px rgba(44,44,44,.25)" }}>
              <div style={{ fontFamily: SERIF, fontSize: 36, color: "rgba(140,130,110,.5)", marginBottom: 8 }}>❧</div>
              <p style={{ fontFamily: SERIF, fontSize: 13.5, color: C.faint, lineHeight: 1.7, margin: 0 }}>
                단어 하나를 심으면<br />유의어는 실선으로, 반의어는 점선으로<br />주위에 피어납니다.
              </p>
            </div>
          </div>
        )}
        {!loading && data && (
          <GraphView key={data.word} data={data} filter={filter}
            onNodeTap={(id) => setSheetWord(id)} />
        )}
        {error && (
          <div style={{ ...glass(0.6, 18), position: "absolute", left: 20, right: 20, bottom: 16, borderRadius: 14, padding: "12px 16px", fontFamily: SERIF, fontSize: 13.5, color: C.faint, boxShadow: "0 12px 28px -12px rgba(44,44,44,.25)", animation: "lg-pop .4s cubic-bezier(.34,1.3,.5,1)" }}>
            {error}
          </div>
        )}
      </div>

      {sheetWord && (
        <WordSheet
          word={sheetWord}
          books={books}
          onClose={() => setSheetWord(null)}
          onExplore={(w) => search(w)}
          onAdd={addWord}
          onCreateBookAdd={createBookAdd}
        />
      )}
    </div>
  );
}

/* ───────────── 단어장 뭉치(스택) 카드 ───────────── */
function BookStack({ book, expanded, onSelect }) {
  const peek1 = book.words[1]?.word;
  const peek2 = book.words[2]?.word;
  const layer = (rot, spread, z, alpha) => ({
    ...glass(alpha, 14),
    position: "absolute", inset: 0, borderRadius: 18, zIndex: z,
    boxShadow: "0 12px 26px -12px rgba(44,44,44,.22), inset 0 1px 0 rgba(255,255,255,.7)",
    transform: expanded
      ? `rotate(${rot * 2.2}deg) translateX(${spread}px) translateY(${Math.abs(spread) * -0.12}px)`
      : `rotate(${rot}deg)`,
    transition: "transform .6s cubic-bezier(.34,1.35,.4,1)",
  });
  return (
    <button
      onClick={onSelect}
      style={{ position: "relative", aspectRatio: "5/4", border: "none", background: "transparent", cursor: "pointer", padding: 0 }}
    >
      {/* 세 번째 레이어 */}
      <div style={layer(5, 26, 1, 0.28)}>
        {peek2 && <div style={{ position: "absolute", top: 7, right: 14, fontFamily: SERIF, fontSize: 12, fontStyle: "italic", color: C.faint }}>{peek2}</div>}
      </div>
      {/* 두 번째 레이어 */}
      <div style={layer(-4, -26, 2, 0.38)}>
        {peek1 && <div style={{ position: "absolute", top: 7, left: 14, fontFamily: SERIF, fontSize: 12, fontStyle: "italic", color: C.faint }}>{peek1}</div>}
      </div>
      {/* 맨 위 레이어 */}
      <div style={{
        ...layer(0, 0, 3, 0.55),
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
        boxShadow: expanded
          ? "0 20px 40px -14px rgba(119,50,58,.35), inset 0 1px 0 rgba(255,255,255,.85)"
          : "0 14px 30px -12px rgba(44,44,44,.25), inset 0 1px 0 rgba(255,255,255,.85)",
        border: expanded ? "1.5px solid rgba(119,50,58,.55)" : "1px solid rgba(255,255,255,.75)",
      }}>
        <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: C.ink, padding: "0 10px", textAlign: "center", lineHeight: 1.25 }}>{book.title}</div>
        <div style={{ fontFamily: SERIF, fontSize: 12.5, color: C.syn }}>{book.words.length}개의 낱말</div>
      </div>
    </button>
  );
}

/* ───────────── 단어장 목록 화면 ───────────── */
function BooksView({ books, setBooks, onFlashcards }) {
  const [selected, setSelected] = useState(null);
  const [listOpen, setListOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const sel = books.find((b) => b.id === selected);
  const mutate = (fn) => setBooks((prev) => { const next = fn(prev); saveBooks(next); return next; });

  return (
    <div style={{ position: "absolute", inset: 0, overflowY: "auto", padding: "18px 20px 140px" }}>
      <div style={{ fontFamily: SERIF, fontSize: 12, letterSpacing: "0.18em", color: C.faint, textTransform: "uppercase", marginBottom: 4 }}>
        Bookshelf
      </div>
      <h1 style={{ fontFamily: SERIF, fontSize: 27, fontWeight: 700, color: C.ink, margin: "0 0 20px" }}>나의 단어장</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "26px 20px" }}>
        {books.map((b) => (
          <BookStack key={b.id} book={b} expanded={selected === b.id}
            onSelect={() => setSelected(selected === b.id ? null : b.id)} />
        ))}
        <button
          onClick={() => { setCreating(true); setName(""); }}
          style={{ ...glass(0.25, 10), aspectRatio: "5/4", borderRadius: 18, border: "1.5px dashed rgba(140,130,110,.4)", fontFamily: SERIF, fontSize: 14.5, color: C.faint, cursor: "pointer" }}
        >
          ＋ 새 단어장
        </button>
      </div>

      {books.length === 0 && (
        <p style={{ fontFamily: SERIF, color: C.faint, fontSize: 13.5, lineHeight: 1.7, marginTop: 26 }}>
          아직 단어장이 비어 있어요. 탐색 탭에서 단어를 검색하고, 마음에 드는 낱말을 담아 보세요.
        </p>
      )}

      {/* 선택 시 하단 액션 바 */}
      <div
        style={{
          ...glass(0.6, 22),
          position: "fixed", left: 16, right: 16, bottom: "calc(84px + env(safe-area-inset-bottom))", zIndex: 30,
          borderRadius: 20,
          boxShadow: "0 20px 44px -16px rgba(44,44,44,.35), inset 0 1px 0 rgba(255,255,255,.85)",
          padding: 10,
          display: "flex", gap: 8,
          transform: sel ? "translateY(0)" : "translateY(140%)",
          opacity: sel ? 1 : 0,
          transition: "transform .55s cubic-bezier(.3,1.25,.4,1), opacity .4s ease",
          pointerEvents: sel ? "auto" : "none",
        }}
      >
        {[
          { label: "단어장 보기", fn: () => setListOpen(true), primary: true },
          { label: "암기 카드", fn: () => sel.words.length && onFlashcards(sel) },
          { label: "이름 변경", fn: () => { setName(sel.title); setRenaming(true); } },
          { label: "삭제", fn: () => setConfirmDel(true), danger: true },
        ].map((a) => (
          <button key={a.label} onClick={a.fn}
            style={{
              flex: 1, borderRadius: 13, padding: "12px 0",
              fontFamily: SERIF, fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: a.primary ? "rgba(119,50,58,.88)" : "transparent",
              border: a.primary ? "1px solid rgba(255,255,255,.3)" : "none",
              color: a.primary ? "#FDFAF3" : a.danger ? C.syn : C.ink,
            }}>
            {a.label}
          </button>
        ))}
      </div>

      {/* 단어 목록 패널 */}
      {listOpen && sel && (
        <div style={{ position: "fixed", inset: 0, zIndex: 55, background: "rgba(246,242,233,.82)", backdropFilter: "blur(22px) saturate(1.4)", WebkitBackdropFilter: "blur(22px) saturate(1.4)", animation: "lg-slideup .5s cubic-bezier(.22,1,.3,1)", overflowY: "auto", padding: "18px 22px 40px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: C.ink, margin: 0 }}>{sel.title}</h2>
            <button onClick={() => setListOpen(false)} style={{ border: "none", background: "transparent", fontFamily: SERIF, fontSize: 24, color: C.faint, cursor: "pointer" }}>✕</button>
          </div>
          {sel.words.length === 0 && <p style={{ fontFamily: SERIF, color: C.faint, fontSize: 13.5 }}>아직 담긴 낱말이 없어요.</p>}
          {sel.words.map((w, i) => (
            <div key={i} style={{ ...glass(0.5, 14), borderRadius: 16, padding: "14px 16px", marginBottom: 10, boxShadow: "0 8px 20px -12px rgba(44,44,44,.18), inset 0 1px 0 rgba(255,255,255,.75)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: C.ink }}>{w.word}</span>
                <button
                  onClick={() => mutate((prev) => prev.map((b) => b.id === sel.id ? { ...b, words: b.words.filter((_, j) => j !== i) } : b))}
                  style={{ border: "none", background: "transparent", color: C.faint, fontFamily: SERIF, fontSize: 12.5, cursor: "pointer" }}
                >빼기</button>
              </div>
              <div style={{ fontFamily: SERIF, fontSize: 13.5, color: C.faint, marginTop: 4, lineHeight: 1.5 }}>
                {w.definitions[0]?.def}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 새 단어장 / 이름 변경 / 삭제 확인 모달 */}
      {(creating || renaming) && (
        <Modal onClose={() => { setCreating(false); setRenaming(false); }}>
          <h3 style={{ fontFamily: SERIF, fontSize: 18, color: C.ink, margin: "0 0 14px" }}>
            {creating ? "새 단어장 만들기" : "이름 변경"}
          </h3>
          <input
            autoFocus value={name} onChange={(e) => setName(e.target.value)}
            placeholder="단어장 이름"
            style={{ ...glass(0.55, 10), width: "100%", boxSizing: "border-box", borderRadius: 12, padding: "12px 14px", fontFamily: SERIF, fontSize: 15, color: C.ink, outline: "none" }}
          />
          <button
            onClick={() => {
              const t = name.trim(); if (!t) return;
              if (creating) mutate((prev) => [...prev, { id: Date.now().toString(36), title: t, words: [] }]);
              else mutate((prev) => prev.map((b) => (b.id === selected ? { ...b, title: t } : b)));
              setCreating(false); setRenaming(false);
            }}
            style={{ width: "100%", marginTop: 12, background: "rgba(119,50,58,.88)", color: "#FDFAF3", border: "1px solid rgba(255,255,255,.3)", borderRadius: 12, padding: "13px 0", fontFamily: SERIF, fontSize: 15, fontWeight: 600, cursor: "pointer" }}
          >
            저장
          </button>
        </Modal>
      )}

      {confirmDel && sel && (
        <Modal onClose={() => setConfirmDel(false)}>
          <h3 style={{ fontFamily: SERIF, fontSize: 18, color: C.ink, margin: "0 0 8px" }}>『{sel.title}』 삭제</h3>
          <p style={{ fontFamily: SERIF, fontSize: 13.5, color: C.faint, lineHeight: 1.6, margin: "0 0 16px" }}>
            담긴 {sel.words.length}개의 낱말도 함께 사라져요. 되돌릴 수 없어요.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmDel(false)} style={{ ...glass(0.4, 10), flex: 1, borderRadius: 12, padding: "12px 0", fontFamily: SERIF, fontSize: 14.5, color: C.ink, cursor: "pointer" }}>취소</button>
            <button
              onClick={() => { mutate((prev) => prev.filter((b) => b.id !== selected)); setSelected(null); setConfirmDel(false); }}
              style={{ flex: 1, background: "rgba(119,50,58,.88)", color: "#FDFAF3", border: "1px solid rgba(255,255,255,.3)", borderRadius: 12, padding: "12px 0", fontFamily: SERIF, fontSize: 14.5, fontWeight: 600, cursor: "pointer" }}
            >삭제</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ───────────── 암기 카드 화면 ───────────── */
function FlashcardView({ book, onClose }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const w = book.words[idx];
  const go = (d) => {
    setFlipped(false);
    setTimeout(() => setIdx((i) => (i + d + book.words.length) % book.words.length), 160);
  };

  const face = {
    ...glass(0.55, 22),
    position: "absolute", inset: 0, backfaceVisibility: "hidden",
    borderRadius: 24,
    boxShadow: "0 24px 50px -18px rgba(44,44,44,.28), inset 0 1px 0 rgba(255,255,255,.85)",
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(246,242,233,.86)", backdropFilter: "blur(20px) saturate(1.3)", WebkitBackdropFilter: "blur(20px) saturate(1.3)", display: "flex", flexDirection: "column", animation: "lg-fade .35s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px" }}>
        <span style={{ fontFamily: SERIF, fontSize: 15.5, fontWeight: 600, color: C.ink }}>{book.title}</span>
        <button onClick={onClose} style={{ border: "none", background: "transparent", fontSize: 22, color: C.faint, cursor: "pointer", fontFamily: SERIF }}>✕</button>
      </div>

      <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "0 28px", perspective: 1100 }}>
        <div
          onClick={() => setFlipped((f) => !f)}
          style={{
            position: "relative", width: "100%", maxWidth: 360, aspectRatio: "3/4",
            transformStyle: "preserve-3d", cursor: "pointer",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0)",
            transition: "transform .65s cubic-bezier(.3,1.15,.35,1)",
          }}
        >
          {/* 앞면 */}
          <div style={{ ...face, display: "grid", placeItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 700, color: C.ink }}>{w.word}</div>
              {w.phonetic && <div style={{ fontFamily: SERIF, fontSize: 15, color: C.faint, marginTop: 6 }}>{w.phonetic}</div>}
              <div style={{ fontFamily: SERIF, fontSize: 11.5, color: "rgba(140,130,110,.6)", marginTop: 30, letterSpacing: "0.14em" }}>탭하여 뒤집기</div>
            </div>
          </div>
          {/* 뒷면 */}
          <div style={{ ...face, transform: "rotateY(180deg)", padding: 24, overflowY: "auto" }}>
            <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 700, color: C.syn, marginBottom: 12 }}>{w.word}</div>
            {w.definitions.map((d, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 12, color: C.ant }}>{d.pos}</span>
                <div style={{ fontFamily: SERIF, fontSize: 14.5, color: C.ink, lineHeight: 1.55 }}>{d.def}</div>
                {d.example && <div style={{ fontFamily: SERIF, fontSize: 13, fontStyle: "italic", color: C.faint, marginTop: 3 }}>“{d.example}”</div>}
              </div>
            ))}
            {w.synonyms?.length > 0 && (
              <div style={{ borderTop: `1px solid ${C.hairline}`, paddingTop: 12 }}>
                <div style={{ fontFamily: SERIF, fontSize: 11.5, letterSpacing: "0.15em", color: C.faint, marginBottom: 8 }}>SYNONYMS</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {w.synonyms.map((s) => (
                    <span key={s} style={{ ...glass(0.4, 8), fontFamily: SERIF, fontSize: 13, color: C.syn, borderRadius: 999, padding: "3px 11px" }}>{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 26, padding: "0 0 calc(30px + env(safe-area-inset-bottom))" }}>
        <button onClick={() => go(-1)} style={{ border: "none", background: "transparent", fontFamily: SERIF, fontSize: 26, color: C.faint, cursor: "pointer" }}>‹</button>
        <span style={{ fontFamily: SERIF, fontSize: 13.5, color: C.faint }}>{idx + 1} / {book.words.length}</span>
        <button onClick={() => go(1)} style={{ border: "none", background: "transparent", fontFamily: SERIF, fontSize: 26, color: C.faint, cursor: "pointer" }}>›</button>
      </div>
    </div>
  );
}

/* ───────────── 루트 앱 ───────────── */
export default function App() {
  const [tab, setTab] = useState("explore");
  const [books, setBooks] = useState([]);
  const [flashBook, setFlashBook] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => { loadBooks().then((b) => { setBooks(b); setReady(true); }); }, []);

  const addWord = (bookId, entry) => {
    if (!entry) return;
    setBooks((prev) => {
      const next = prev.map((b) =>
        b.id === bookId && !b.words.some((w) => w.word === entry.word)
          ? { ...b, words: [...b.words, entry] } : b
      );
      saveBooks(next);
      return next;
    });
  };
  const createBookAdd = (title, entry) => {
    setBooks((prev) => {
      const next = [...prev, { id: Date.now().toString(36), title, words: entry ? [entry] : [] }];
      saveBooks(next);
      return next;
    });
  };

  const liveFlash = flashBook && books.find((b) => b.id === flashBook.id);

  return (
    <div style={{ position: "fixed", inset: 0, background: C.bg, overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Noto+Serif+KR:wght@400;600;700&display=swap');
        *{ -webkit-tap-highlight-color: transparent; }
        input::placeholder{ color: rgba(140,130,110,.7); }
        @keyframes lg-fade{ from{opacity:0} to{opacity:1} }
        @keyframes lg-pop{ from{opacity:0; transform:scale(.92) translateY(8px)} to{opacity:1; transform:scale(1) translateY(0)} }
        @keyframes lg-slideup{ from{transform:translateY(6%);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes lg-drift{ 0%,100%{transform:translate(0,0)} 50%{transform:translate(18px,-14px)} }
        @media (prefers-reduced-motion: reduce){ *{transition-duration:.01ms !important; animation-duration:.01ms !important} }
        ::-webkit-scrollbar{ width:0; height:0 }
      `}</style>

      {/* 글래스가 살아나도록 배경에 은은한 컬러 블롭 */}
      <div style={{ position: "absolute", width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle, rgba(119,50,58,.16), transparent 68%)", top: -140, right: -140, pointerEvents: "none", animation: "lg-drift 16s ease-in-out infinite" }} />
      <div style={{ position: "absolute", width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(62,90,126,.15), transparent 68%)", bottom: -110, left: -140, pointerEvents: "none", animation: "lg-drift 20s ease-in-out infinite reverse" }} />
      <div style={{ position: "absolute", width: 340, height: 340, borderRadius: "50%", background: "radial-gradient(circle, rgba(196,160,84,.13), transparent 70%)", top: "38%", left: "52%", pointerEvents: "none", animation: "lg-drift 24s ease-in-out infinite" }} />

      <div style={{ position: "absolute", inset: "0 0 calc(72px + env(safe-area-inset-bottom)) 0" }}>
        {ready && tab === "explore" && (
          <ExploreView books={books} addWord={addWord} createBookAdd={createBookAdd} />
        )}
        {ready && tab === "books" && (
          <BooksView books={books} setBooks={setBooks} onFlashcards={(b) => setFlashBook(b)} />
        )}
      </div>

      {/* 하단 탭 바 */}
      <nav style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        height: "calc(72px + env(safe-area-inset-bottom))",
        paddingBottom: "env(safe-area-inset-bottom)",
        background: "rgba(255,255,255,.42)",
        backdropFilter: "blur(20px) saturate(1.5)",
        WebkitBackdropFilter: "blur(20px) saturate(1.5)",
        borderTop: "1px solid rgba(255,255,255,.65)",
        display: "flex", zIndex: 20,
      }}>
        {[
          { id: "explore", label: "탐색", glyph: "❋" },
          { id: "books", label: "단어장", glyph: "❦" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, border: "none", background: "transparent", cursor: "pointer", fontFamily: SERIF, color: tab === t.id ? C.syn : C.faint, transition: "color .3s ease" }}>
            <div style={{ fontSize: 19, transform: tab === t.id ? "translateY(-2px)" : "none", transition: "transform .35s cubic-bezier(.34,1.5,.5,1)" }}>{t.glyph}</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{t.label}</div>
          </button>
        ))}
      </nav>

      {liveFlash && liveFlash.words.length > 0 && (
        <FlashcardView book={liveFlash} onClose={() => setFlashBook(null)} />
      )}
    </div>
  );
}
