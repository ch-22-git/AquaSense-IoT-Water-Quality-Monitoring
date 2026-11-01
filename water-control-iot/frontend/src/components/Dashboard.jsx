import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';

// ─── Mini sparkline SVG ───────────────────────────────────────────────────────
function Sparkline({ data, color, min, max }) {
  if (!data || data.length < 2) return null;
  const W = 120, H = 40, pad = 4;
  const lo = min ?? Math.min(...data);
  const hi = max ?? Math.max(...data);
  const range = hi - lo || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - lo) / range) * (H - pad * 2);
    return `${x},${y}`;
  });
  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${pad},${H} ${pts.join(' ')} ${W - pad},${H}`} fill={`url(#sg-${color.replace('#','')})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {(() => {
        const last = pts[pts.length - 1].split(',');
        return <circle cx={last[0]} cy={last[1]} r="3" fill={color} />;
      })()}
    </svg>
  );
}

// ─── Full line chart SVG ─────────────────────────────────────────────────────
function LineChart({ data, label, color, unit, yMin, yMax }) {
  if (!data || data.length < 2) return (
    <div style={{ color: 'rgba(255,255,255,0.3)', padding: '40px', textAlign: 'center' }}>Pas assez de données</div>
  );
  const W = 100, H = 100;
  const pad = { top: 8, right: 4, bottom: 18, left: 10 };
  const lo = yMin ?? Math.min(...data.map(d => d.v));
  const hi = yMax ?? Math.max(...data.map(d => d.v));
  const range = hi - lo || 1;
  const toX = i => pad.left + (i / (data.length - 1)) * (W - pad.left - pad.right);
  const toY = v => pad.top + (1 - (v - lo) / range) * (H - pad.top - pad.bottom);
  const pts = data.map((d, i) => `${toX(i)},${toY(d.v)}`);
  const area = [`${toX(0)},${H - pad.bottom}`, ...pts, `${toX(data.length - 1)},${H - pad.bottom}`];
  const gridCount = 4;
  const gridLines = Array.from({ length: gridCount + 1 }, (_, i) => {
    const v = lo + (range * i) / gridCount;
    return { y: toY(v), v };
  });
  const step = Math.max(1, Math.floor(data.length / 5));
  const xLabels = data.filter((_, i) => i % step === 0 || i === data.length - 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`lg-${label}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <clipPath id={`cp-${label}`}>
          <rect x={pad.left} y={pad.top} width={W - pad.left - pad.right} height={H - pad.top - pad.bottom} />
        </clipPath>
      </defs>
      {gridLines.map(({ y, v }) => (
        <g key={v}>
          <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="0.3" />
          <text x={pad.left - 1} y={y + 0.8} fontSize="2.8" fill="rgba(255,255,255,0.35)" textAnchor="end">{v.toFixed(1)}</text>
        </g>
      ))}
      <polygon points={area.join(' ')} fill={`url(#lg-${label})`} clipPath={`url(#cp-${label})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="0.8" strokeLinejoin="round" clipPath={`url(#cp-${label})`} />
      {xLabels.map((d, i) => {
        const idx = data.indexOf(d);
        return (
          <text key={i} x={toX(idx)} y={H - pad.bottom + 4} fontSize="2.5" fill="rgba(255,255,255,0.4)" textAnchor="middle">
            {d.label}
          </text>
        );
      })}
      {(() => {
        const x = toX(data.length - 1);
        const y = toY(data[data.length - 1].v);
        return (
          <>
            <circle cx={x} cy={y} r="1.2" fill={color} />
            <circle cx={x} cy={y} r="2.5" fill={color} fillOpacity="0.25" />
          </>
        );
      })()}
    </svg>
  );
}

// ─── Particle background ─────────────────────────────────────────────────────
function ParticleBG() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animId;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const N = 80;
    const particles = Array.from({ length: N }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 3.2 + 1.0,
      dx: (Math.random() - 0.5) * 0.35,
      dy: (Math.random() - 0.5) * 0.35,
      o: Math.random() * 0.45 + 0.35,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        // glow halo
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        grad.addColorStop(0, `rgba(80,190,255,${p.o})`);
        grad.addColorStop(1, `rgba(80,190,255,0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        // solid bright core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,230,255,${Math.min(1, p.o + 0.3)})`;
        ctx.fill();
      });
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 160) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(100,200,255,${0.25 * (1 - dist / 160)})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />;
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const [currentData, setCurrentData] = useState({ ph: 7.0, tds: 300, turbidity: 5.0, temperature: 20.0 });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [darkMode, setDarkMode] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [formData, setFormData] = useState({ ph: '', tds: '', turbidity: '', temperature: '' });
  const [submitting, setSubmitting] = useState(false);

  const makeLabel = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  };

  const toChartData = (field) =>
    history.map(item => ({ v: parseFloat(item[field]) || 0, label: makeLabel(item.timestamp) }));

  const generateAlerts = useCallback((data) => {
    const now = new Date().toLocaleString();
    const newAlerts = [];
    if (data.ph > 8.5) newAlerts.push({ id: Date.now()+1, type:'PH_HIGH', message:'pH trop élevé', valeur:data.ph, seuil:8.5, niveau:'critical', date:now });
    if (data.ph < 6.5) newAlerts.push({ id: Date.now()+2, type:'PH_LOW',  message:'pH trop bas',   valeur:data.ph, seuil:6.5, niveau:'warning', date:now });
    if (data.tds > 500) newAlerts.push({ id: Date.now()+3, type:'TDS_HIGH', message:'TDS dépasse la limite', valeur:data.tds, seuil:500, niveau:'critical', date:now });
    if (data.turbidity > 5) newAlerts.push({ id: Date.now()+4, type:'TURB_HIGH', message:'Turbidité élevée', valeur:data.turbidity, seuil:5, niveau:'warning', date:now });
    if (newAlerts.length) setAlerts(prev => [...newAlerts, ...prev].slice(0, 30));
  }, []);

  const loadData = useCallback(async () => {
    try {
      const response = await api.getData();
      if (response && response.success) {
        if (response.current) {
          const cur = {
            ph: parseFloat(response.current.ph) || 7.0,
            tds: parseInt(response.current.tds) || 300,
            turbidity: parseFloat(response.current.turbidity) || 5.0,
            temperature: parseFloat(response.current.temperature) || 20.0,
          };
          setCurrentData(cur);
          generateAlerts(cur);
        }
        if (response.history && Array.isArray(response.history)) {
          setHistory(response.history.map(item => ({
            id: item.id,
            ph: parseFloat(item.ph) || 0,
            tds: parseInt(item.tds) || 0,
            turbidity: parseFloat(item.turbidity) || 0,
            temperature: parseFloat(item.temperature) || 0,
            timestamp: item.timestamp,
          })));
        }
        setError(null);
      } else {
        setError(response?.error || 'Erreur inconnue');
      }
    } catch (err) {
      setError(err.message || 'Impossible de se connecter au backend Flask.');
    } finally {
      setLoading(false);
    }
  }, [generateAlerts]);

  useEffect(() => { loadData(); }, []);

  const handleAddManual = async () => {
    const ph = parseFloat(formData.ph);
    const tds = parseInt(formData.tds);
    const turbidity = parseFloat(formData.turbidity);
    const temperature = parseFloat(formData.temperature);
    if ([ph, tds, turbidity, temperature].some(isNaN)) return alert('Valeurs invalides');
    setSubmitting(true);
    try {
      await api.addData({ ph, tds, turbidity, temperature });
      await loadData();
      setAddModal(false);
      setFormData({ ph: '', tds: '', turbidity: '', temperature: '' });
    } catch { alert("Erreur lors de l'ajout"); }
    finally { setSubmitting(false); }
  };

  const handleGenerate = async () => {
    try { await api.generateData(); await loadData(); }
    catch (err) { console.error(err); }
  };

  const kpis = [
    { key: 'ph',          label: 'pH',           value: currentData.ph.toFixed(2),          unit: '',    color: '#38bdf8', icon: '⬡', normal: '6.5 – 8.5', yMin: 0, yMax: 14 },
    { key: 'tds',         label: 'TDS',           value: currentData.tds,                    unit: 'ppm', color: '#34d399', icon: '◈', normal: '< 500 ppm' },
    { key: 'turbidity',   label: 'Turbidité',     value: currentData.turbidity.toFixed(2),   unit: 'NTU', color: '#fbbf24', icon: '◉', normal: '< 5 NTU',   yMin: 0 },
    { key: 'temperature', label: 'Température',   value: currentData.temperature.toFixed(1), unit: '°C',  color: '#f87171', icon: '◈', normal: '15 – 30 °C', yMin: 0 },
  ];

  const alertsLast24h = alerts.filter(a => {
    try { return (Date.now() - new Date(a.date).getTime()) < 86400000; } catch { return false; }
  }).length;

  const dm = darkMode;

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root {
      width: 100%; height: 100%;
      background: ${dm ? '#05090f' : '#eef2f8'};
      color: ${dm ? '#e2eaf5' : '#0c2340'};
      font-family: 'Syne', sans-serif;
      overflow-x: hidden;
    }
    ::-webkit-scrollbar { width: 5px; background: transparent; }
    ::-webkit-scrollbar-thumb { background: #38bdf8; border-radius: 10px; }
    .mono { font-family: 'DM Mono', monospace; }

    /* ── topbar — full width, bigger ── */
    .topbar {
      position: sticky; top: 0; z-index: 100;
      width: 100%;
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;
      gap: 12px;
      padding: 1.1rem 2.4rem;
      background: ${dm ? 'rgba(5,9,15,0.82)' : 'rgba(238,242,248,0.82)'};
      backdrop-filter: blur(20px);
      border-bottom: 1px solid ${dm ? 'rgba(56,189,248,0.14)' : 'rgba(14,165,233,0.2)'};
    }
    .brand {
      font-size: 1.7rem; font-weight: 800; letter-spacing: -1px;
      white-space: nowrap;
    }
    .brand span { color: #38bdf8; }
    .brand-sub {
      font-size: 0.72rem; font-weight: 400;
      color: ${dm ? '#6d8fb5' : '#4a7099'};
      margin-left: 10px; vertical-align: middle;
    }
    .topbar-center { display: flex; gap: 4px; align-items: center; }
    .topbar-right { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

    /* ── tabs ── */
    .tabs { display: flex; gap: 4px; background: ${dm ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.07)'}; border-radius: 14px; padding: 5px; }
    .tab { padding: 7px 18px; border-radius: 10px; border: none; background: none; color: ${dm ? '#6d8fb5' : '#4a7099'}; cursor: pointer; font-family: 'Syne', sans-serif; font-size: 0.87rem; font-weight: 700; transition: all 0.18s; white-space: nowrap; }
    .tab.active { background: #38bdf8; color: #05090f; }
    .tab:hover:not(.active) { color: #38bdf8; }

    /* ── buttons ── */
    .btn { padding: 8px 18px; border: none; border-radius: 11px; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: all 0.18s; white-space: nowrap; }
    .btn-primary { background: #38bdf8; color: #05090f; }
    .btn-primary:hover { filter: brightness(1.15); }
    .btn-ghost { background: ${dm ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}; border: 1px solid ${dm ? 'rgba(56,189,248,0.18)' : 'rgba(14,165,233,0.25)'}; color: ${dm ? '#e2eaf5' : '#0c2340'}; }
    .btn-ghost:hover { border-color: #38bdf8; color: #38bdf8; }
    .btn-orange { background: #f59e0b; color: #05090f; }
    .btn-orange:hover { filter: brightness(1.1); }

    /* ── full-width page wrapper ── */
    .page {
      width: 100%;
      padding: 2rem 2.4rem;
    }

    /* ── KPI grid ── */
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.2rem; margin-bottom: 2rem; }
    @media (max-width: 1100px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 600px)  { .kpi-grid { grid-template-columns: 1fr; } }

    .kpi-card {
      background: ${dm ? 'rgba(14,22,38,0.82)' : 'rgba(255,255,255,0.82)'};
      backdrop-filter: blur(14px);
      border: 1px solid ${dm ? 'rgba(56,189,248,0.12)' : 'rgba(14,165,233,0.18)'};
      border-radius: 22px; padding: 1.5rem 1.7rem;
      position: relative; overflow: hidden;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .kpi-card:hover { transform: translateY(-4px); box-shadow: 0 20px 45px rgba(0,0,0,0.28); }
    .kpi-card::before { content:''; position:absolute; top:-50px; right:-50px; width:140px; height:140px; border-radius:50%; background:radial-gradient(circle, var(--kpi-color) 0%, transparent 70%); opacity:0.13; }
    .kpi-icon { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .kpi-label { font-size: 0.73rem; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: ${dm ? '#6d8fb5' : '#4a7099'}; margin-bottom: 0.7rem; }
    .kpi-value { font-size: 2.6rem; font-weight: 800; line-height: 1; margin-bottom: 0.45rem; }
    .kpi-normal { font-size: 0.74rem; color: ${dm ? '#6d8fb5' : '#4a7099'}; margin-bottom: 0.9rem; }
    .kpi-spark { display: flex; justify-content: flex-end; }

    /* ── charts ── */
    .chart-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.4rem; }
    @media (max-width: 900px) { .chart-grid { grid-template-columns: 1fr; } }

    .chart-card {
      background: ${dm ? 'rgba(14,22,38,0.82)' : 'rgba(255,255,255,0.82)'};
      backdrop-filter: blur(14px);
      border: 1px solid ${dm ? 'rgba(56,189,248,0.12)' : 'rgba(14,165,233,0.18)'};
      border-radius: 22px; padding: 1.5rem;
      height: 300px; display: flex; flex-direction: column;
    }
    .chart-title { font-size: 0.82rem; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: ${dm ? '#6d8fb5' : '#4a7099'}; margin-bottom: 1rem; }
    .chart-inner { flex: 1; min-height: 0; }

    /* ── table ── */
    .table-card {
      background: ${dm ? 'rgba(14,22,38,0.82)' : 'rgba(255,255,255,0.82)'};
      backdrop-filter: blur(14px);
      border: 1px solid ${dm ? 'rgba(56,189,248,0.12)' : 'rgba(14,165,233,0.18)'};
      border-radius: 22px; overflow: hidden;
    }
    .table-header { padding: 1.3rem 1.8rem; border-bottom: 1px solid ${dm ? 'rgba(56,189,248,0.12)' : 'rgba(14,165,233,0.18)'}; display: flex; justify-content: space-between; align-items: center; }
    .table-header h3 { font-size: 1rem; font-weight: 700; }
    .table-wrap { overflow-x: auto; max-height: 500px; overflow-y: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    thead { position: sticky; top: 0; background: ${dm ? '#0e1826' : '#dde8f5'}; z-index: 1; }
    th { padding: 11px 16px; text-align: left; font-weight: 700; font-size: 0.76rem; letter-spacing: 1px; text-transform: uppercase; color: #38bdf8; }
    td { padding: 10px 16px; border-bottom: 1px solid ${dm ? 'rgba(56,189,248,0.07)' : 'rgba(14,165,233,0.12)'}; }
    tbody tr:hover { background: rgba(56,189,248,0.04); }

    /* ── alerts ── */
    .alert-list { display: flex; flex-direction: column; gap: 10px; }
    .alert-item {
      background: ${dm ? 'rgba(14,22,38,0.82)' : 'rgba(255,255,255,0.82)'};
      border: 1px solid ${dm ? 'rgba(56,189,248,0.12)' : 'rgba(14,165,233,0.18)'};
      border-left: 3px solid; border-radius: 15px; padding: 1rem 1.5rem;
      display: flex; align-items: center; gap: 14px;
    }
    .badge { padding: 3px 12px; border-radius: 30px; font-size: 0.72rem; font-weight: 700; }

    /* ── modal ── */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(7px); z-index: 200; display: flex; align-items: center; justify-content: center; }
    .modal { background: ${dm ? '#0e1826' : '#fff'}; border: 1px solid ${dm ? 'rgba(56,189,248,0.2)' : 'rgba(14,165,233,0.25)'}; border-radius: 26px; padding: 2.2rem; width: 440px; max-width: 95vw; }
    .modal h3 { font-size: 1.2rem; font-weight: 800; margin-bottom: 1.5rem; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.78rem; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: ${dm ? '#6d8fb5' : '#4a7099'}; margin-bottom: 6px; }
    .form-group input { width: 100%; padding: 11px 14px; background: ${dm ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}; border: 1px solid ${dm ? 'rgba(56,189,248,0.18)' : 'rgba(14,165,233,0.25)'}; border-radius: 11px; color: ${dm ? '#e2eaf5' : '#0c2340'}; font-family: 'DM Mono', monospace; font-size: 0.9rem; outline: none; }
    .form-group input:focus { border-color: #38bdf8; }
    .modal-btns { display: flex; gap: 10px; margin-top: 1.6rem; justify-content: flex-end; }

    /* ── misc ── */
    .dot { width: 9px; height: 9px; border-radius: 50%; background: #34d399; display: inline-block; margin-right: 6px; box-shadow: 0 0 8px #34d399; animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
    .empty { text-align: center; padding: 70px 20px; color: ${dm ? '#6d8fb5' : '#4a7099'}; }
    .empty .big { font-size: 3.5rem; margin-bottom: 14px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;

  if (loading && history.length === 0) {
    return (
      <>
        <style>{css}</style>
        <ParticleBG />
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:22, position:'relative', zIndex:1 }}>
          <div className="brand" style={{ fontSize:'2.4rem' }}>Aqua<span>Sense</span></div>
          <div style={{ width:44, height:44, border:'3px solid rgba(56,189,248,0.2)', borderTop:'3px solid #38bdf8', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
          <p style={{ color:'#6d8fb5' }}>Connexion au backend…</p>
        </div>
      </>
    );
  }

  if (error && history.length === 0) {
    return (
      <>
        <style>{css}</style>
        <ParticleBG />
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:18, position:'relative', zIndex:1, padding:'1rem' }}>
          <div className="brand" style={{ fontSize:'2.4rem' }}>Aqua<span>Sense</span></div>
          <div style={{ background:'rgba(14,22,38,0.9)', border:'1px solid rgba(248,113,113,0.35)', borderRadius:22, padding:'2.2rem', maxWidth:480, textAlign:'center' }}>
            <div style={{ fontSize:'2.2rem', marginBottom:14 }}>⚠️</div>
            <p style={{ marginBottom:18, color:'#f87171' }}>{error}</p>
            <button className="btn btn-primary" onClick={loadData}>🔄 Réessayer</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{css}</style>
      <ParticleBG />
      <div style={{ position:'relative', zIndex:1, minHeight:'100vh', width:'100%' }}>

        {/* ── Top bar ── */}
        <div className="topbar">
          <div className="brand">
            Aqua<span>Vision</span>
            <span className="brand-sub"><span className="dot" />Live</span>
          </div>
          <div className="topbar-center">
            <div className="tabs">
              {[['overview',"Vue d'ensemble"],['charts','Graphiques'],['history','Historique'],['alerts','Alertes']].map(([key, lbl]) => (
                <button key={key} className={`tab${activeTab===key?' active':''}`} onClick={() => setActiveTab(key)}>
                  {lbl}{key==='alerts' && alertsLast24h > 0 ? ` (${alertsLast24h})` : ''}
                </button>
              ))}
            </div>
          </div>
          <div className="topbar-right">
            <button className="btn btn-ghost" onClick={() => setDarkMode(d => !d)}>{dm ? '☀️' : '🌙'}</button>
            <button className="btn btn-orange" onClick={handleGenerate}>⚡ Générer</button>
            <button className="btn btn-primary" onClick={() => setAddModal(true)}>+ Ajouter</button>
            <button className="btn btn-ghost" onClick={loadData}>🔄</button>
          </div>
        </div>

        <div className="page">

          {/* ══ OVERVIEW ══ */}
          {activeTab === 'overview' && (
            <>
              <div className="kpi-grid">
                {kpis.map(k => (
                  <div className="kpi-card" key={k.key} style={{ '--kpi-color': k.color }}>
                    <div className="kpi-icon" style={{ color: k.color }}>{k.icon}</div>
                    <div className="kpi-label">{k.label}</div>
                    <div className="kpi-value mono" style={{ color: k.color }}>
                      {k.value}<span style={{ fontSize:'1rem', marginLeft:4, fontWeight:500 }}>{k.unit}</span>
                    </div>
                    <div className="kpi-normal">Normal : {k.normal}</div>
                    <div className="kpi-spark">
                      <Sparkline data={history.map(h => parseFloat(h[k.key]) || 0)} color={k.color} min={k.yMin} max={k.yMax} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="chart-grid">
                {kpis.map(k => (
                  <div className="chart-card" key={k.key}>
                    <div className="chart-title" style={{ color: k.color }}>{k.label} — historique</div>
                    <div className="chart-inner">
                      <LineChart data={toChartData(k.key)} label={k.key} color={k.color} unit={k.unit} yMin={k.yMin} yMax={k.yMax} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ══ CHARTS ══ */}
          {activeTab === 'charts' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'1.6rem' }}>
              {kpis.map(k => (
                <div key={k.key} style={{ background: dm?'rgba(14,22,38,0.82)':'rgba(255,255,255,0.82)', border:'1px solid rgba(56,189,248,0.12)', borderRadius:22, padding:'1.5rem', height:320, display:'flex', flexDirection:'column' }}>
                  <div className="chart-title" style={{ color: k.color }}>{k.label} ({k.unit}) — {history.length} points</div>
                  <div className="chart-inner">
                    <LineChart data={toChartData(k.key)} label={k.key} color={k.color} unit={k.unit} yMin={k.yMin} yMax={k.yMax} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══ HISTORY ══ */}
          {activeTab === 'history' && (
            <div className="table-card">
              <div className="table-header">
                <h3>Historique ({history.length} enregistrements)</h3>
              </div>
              {history.length === 0 ? (
                <div className="empty"><div className="big">📋</div>Aucune donnée. Utilisez "Générer" ou "Ajouter".</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>#</th><th>Date / Heure</th><th>pH</th><th>TDS (ppm)</th><th>Turbidité (NTU)</th><th>Température (°C)</th></tr>
                    </thead>
                    <tbody>
                      {[...history].reverse().slice(0,50).map((item, i) => (
                        <tr key={item.id || i}>
                          <td className="mono" style={{ color:'#6d8fb5', fontSize:'0.75rem' }}>{history.length - i}</td>
                          <td className="mono" style={{ fontSize:'0.8rem' }}>{item.timestamp ? new Date(item.timestamp).toLocaleString('fr-FR') : 'N/A'}</td>
                          <td className="mono" style={{ color:'#38bdf8' }}>{parseFloat(item.ph).toFixed(2)}</td>
                          <td className="mono" style={{ color:'#34d399' }}>{item.tds}</td>
                          <td className="mono" style={{ color:'#fbbf24' }}>{parseFloat(item.turbidity).toFixed(2)}</td>
                          <td className="mono" style={{ color:'#f87171' }}>{parseFloat(item.temperature).toFixed(1)}°C</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══ ALERTS ══ */}
          {activeTab === 'alerts' && (
            <div className="alert-list">
              {alerts.length === 0 ? (
                <div className="empty"><div className="big">✅</div>Aucune alerte — tout est nominal.</div>
              ) : alerts.map(a => (
                <div key={a.id} className="alert-item" style={{ borderLeftColor: a.niveau==='critical'?'#f87171':'#fbbf24' }}>
                  <span style={{ fontSize:'1.6rem' }}>{a.niveau==='critical'?'🔴':'🟡'}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, marginBottom:2 }}>{a.message}</div>
                    <div className="mono" style={{ fontSize:'0.78rem', color:'#6d8fb5' }}>Valeur : {a.valeur} · Seuil : {a.seuil} · {a.date}</div>
                  </div>
                  <span className="badge" style={{ background: a.niveau==='critical'?'rgba(248,113,113,0.15)':'rgba(251,191,36,0.15)', color: a.niveau==='critical'?'#f87171':'#fbbf24' }}>
                    {a.niveau==='critical'?'CRITIQUE':'AVERTISSEMENT'}
                  </span>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* ── Modal ── */}
      {addModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setAddModal(false)}>
          <div className="modal">
            <h3>Ajouter une mesure manuelle</h3>
            {[
              ['ph','pH','7.2','6.5 – 8.5'],
              ['tds','TDS (ppm)','320','< 500'],
              ['turbidity','Turbidité (NTU)','2.5','< 5'],
              ['temperature','Température (°C)','22.5','15 – 30'],
            ].map(([field, label, placeholder, hint]) => (
              <div className="form-group" key={field}>
                <label>{label} <span style={{ fontWeight:400, opacity:0.6 }}>({hint})</span></label>
                <input type="number" placeholder={placeholder} value={formData[field]}
                  onChange={e => setFormData(f => ({ ...f, [field]: e.target.value }))} />
              </div>
            ))}
            <div className="modal-btns">
              <button className="btn btn-ghost" onClick={() => setAddModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleAddManual} disabled={submitting}>
                {submitting ? 'Envoi…' : '✓ Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}