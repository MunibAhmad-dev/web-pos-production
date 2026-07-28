import { useRef, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useAuth } from '../context/AuthContext';
import { useMediaQuery } from '../hooks/useMediaQuery';
import {
  Sun, Moon, Store, ArrowRight, TrendingUp,
  AlertTriangle, Package, Scissors, Factory,
  CheckCircle2, ShoppingBag,
} from 'lucide-react';

/* ── Inline theme toggle ──────────────────────────────── */
function ThemeBtn() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  return (
    <button
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label="Toggle theme"
      style={{
        width: 38, height: 38, borderRadius: 10,
        border: '1px solid rgba(0,0,0,0.1)',
        background: 'rgba(255,255,255,0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: '#555', flexShrink: 0,
      }}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

/* ── Floating hero cards ──────────────────────────────── */
function SalesCard() {
  return (
    <div style={{
      position: 'absolute', top: '4%', right: '10%',
      background: 'white', borderRadius: 22, padding: '22px 24px',
      boxShadow: '0 24px 64px rgba(0,0,0,0.10)',
      transform: 'rotate(-5deg)', width: 228, zIndex: 3,
    }}>
      <p style={{ fontSize: 10, color: '#aaa', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
        Today's Revenue
      </p>
      <p style={{ fontSize: 26, fontWeight: 800, color: '#111', lineHeight: 1, marginBottom: 10 }}>
        PKR 84,200
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <TrendingUp size={12} color="#10B981" />
        <span style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>+14% vs yesterday</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 32 }}>
        {[38, 55, 42, 70, 58, 82, 72, 88, 76, 100].map((h, i) => (
          <div key={i} style={{
            flex: 1, height: `${h}%`,
            background: i === 9 ? '#FF4E7D' : '#FFB3C8',
            borderRadius: 3,
          }} />
        ))}
      </div>
    </div>
  );
}

function CartCard() {
  return (
    <div style={{
      position: 'absolute', top: '40%', right: '0%',
      background: 'white', borderRadius: 22, padding: '20px 22px',
      boxShadow: '0 24px 64px rgba(0,0,0,0.09)',
      transform: 'rotate(4deg)', width: 248, zIndex: 2,
    }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#111', marginBottom: 14 }}>Quick Checkout</p>
      {[['Almond Giri 500g', '×2', 'PKR 1,700'], ['Cashew Splits 1kg', '×1', 'PKR 1,450']].map(([n, q, p]) => (
        <div key={n} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 11 }}>
          <span style={{ color: '#666' }}>{n} <span style={{ color: '#bbb' }}>{q}</span></span>
          <span style={{ fontWeight: 600, color: '#111' }}>{p}</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid #f2f2f2', paddingTop: 10, display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>Total</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>PKR 3,150</span>
      </div>
      <div style={{ background: '#FF4E7D', borderRadius: 12, padding: '10px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'white' }}>
        Complete Sale  →
      </div>
    </div>
  );
}

function StockCard() {
  return (
    <div style={{
      position: 'absolute', bottom: '6%', right: '14%',
      background: 'white', borderRadius: 22, padding: '18px 22px',
      boxShadow: '0 24px 64px rgba(0,0,0,0.09)',
      transform: 'rotate(-2deg)', width: 220, zIndex: 3,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF3CD', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AlertTriangle size={13} color="#F59E0B" />
        </div>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>Low Stock Alert</p>
      </div>
      {[['Dry Apricot 250g', '4 left', '#F59E0B'], ['Walnut Halves 1kg', '0 left', '#EF4444'], ['Pistachio Raw', '7 left', '#F59E0B']].map(([n, s, c]) => (
        <div key={n} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 9, fontSize: 11 }}>
          <span style={{ color: '#666' }}>{n}</span>
          <span style={{ color: c, fontWeight: 700 }}>{s}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Product section card ─────────────────────────────── */
function ProductCard({ eyebrow, icon: Icon, iconBg, name, desc, features, tags, cta }) {
  return (
    <div style={{
      background: 'white', borderRadius: 24, padding: '36px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
      border: '1px solid rgba(0,0,0,0.05)',
      display: 'flex', flexDirection: 'column', gap: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={20} color="white" />
        </div>
        <div>
          <p style={{ fontSize: 10, color: '#aaa', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>{eyebrow}</p>
          <p style={{ fontSize: 17, fontWeight: 800, color: '#111' }}>{name}</p>
        </div>
      </div>

      <p style={{ fontSize: 14, color: '#666', lineHeight: 1.7, marginBottom: 22 }}>{desc}</p>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {features.map(f => (
          <li key={f} style={{ display: 'flex', gap: 10, fontSize: 13, color: '#444', alignItems: 'flex-start' }}>
            <CheckCircle2 size={14} color="#FF4E7D" style={{ flexShrink: 0, marginTop: 2 }} />
            {f}
          </li>
        ))}
      </ul>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: cta ? 24 : 0 }}>
        {tags.map(t => (
          <span key={t} style={{ fontSize: 11, padding: '4px 11px', borderRadius: 50, background: '#F8F5FF', border: '1px solid #EDE0FF', color: '#7B5EA7' }}>
            {t}
          </span>
        ))}
      </div>

      {cta && (
        <Link to="/login" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: '#FF4E7D', color: 'white',
          borderRadius: 12, padding: '12px 22px',
          fontSize: 13, fontWeight: 700, textDecoration: 'none',
          alignSelf: 'flex-start', boxShadow: '0 6px 20px rgba(255,78,125,0.3)',
        }}>
          <Store size={14} /> Login to Web POS
        </Link>
      )}
    </div>
  );
}

/* ── Canvas drawing (app mockups) ─────────────────────── */
const D = { bg:'#0F1117', sf:'#161B22', sf2:'#1C2230', bd:'#2D3748', ac:'#FF4E7D', acl:'#FF7EA0', tx:'#E2E8F0', mu:'#718096', gr:'#10B981', rd:'#EF4444', bl:'#3B82F6', yw:'#F59E0B' };

function rr(ctx,x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=0.8;ctx.stroke();}}
function tx(ctx,s,x,y,sz=10,col=D.tx,align='left'){ctx.fillStyle=col;ctx.font=`${sz}px Inter,system-ui,sans-serif`;ctx.textAlign=align;ctx.fillText(s,x,y);}
function hl(ctx,y,x1,x2){ctx.strokeStyle=D.bd;ctx.lineWidth=0.6;ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(x2,y);ctx.stroke();}
function chrome(ctx,W,title){ctx.fillStyle=D.sf;ctx.fillRect(0,0,W,32);ctx.strokeStyle=D.bd;ctx.lineWidth=0.8;ctx.beginPath();ctx.moveTo(0,32);ctx.lineTo(W,32);ctx.stroke();[['#FF5F57',12],['#FEBC2E',28],['#28C840',44]].forEach(([c,x])=>{ctx.beginPath();ctx.arc(x,16,5,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();});tx(ctx,title,W/2,21,10,D.mu,'center');}

function drawPOS(canvas){
  const ctx=canvas.getContext('2d');const[W,H]=[560,360];
  ctx.fillStyle=D.bg;ctx.fillRect(0,0,W,H);
  chrome(ctx,W,'OsaTech POS  —  New Sale');
  ctx.fillStyle=D.sf;ctx.fillRect(0,32,148,H-32);
  ctx.strokeStyle=D.bd;ctx.lineWidth=0.6;ctx.beginPath();ctx.moveTo(148,32);ctx.lineTo(148,H);ctx.stroke();
  ['Dashboard','Sales','Products','Customers','Vendors','Reports'].forEach((n,i)=>{
    if(i===1){rr(ctx,6,44+i*34,136,28,4,'rgba(255,78,125,0.15)');ctx.fillStyle=D.ac;ctx.fillRect(4,48+i*34,2,20);}
    tx(ctx,n,20,63+i*34,10.5,i===1?D.ac:D.mu);
  });
  rr(ctx,156,40,232,26,4,D.sf2,D.bd);tx(ctx,'🔍  Search products…',166,57,9.5,D.mu);
  [['Almond Giri 500g','PKR 850',42,D.gr],['Cashew Splits 1kg','PKR 1,450',18,D.gr],['Dry Apricot 250g','PKR 320',4,D.yw],['Walnut Halves 1kg','PKR 1,200',0,D.rd],['Pistachio Roasted','PKR 1,800',22,D.gr]].forEach(([n,p,s,c],i)=>{
    const ry=78+i*46,active=i===0;
    rr(ctx,154,ry,238,40,4,active?'rgba(255,78,125,0.1)':D.sf2,active?D.ac:D.bd);
    tx(ctx,n,164,ry+14,10,active?D.ac:D.tx);tx(ctx,p,164,ry+30,9,D.mu);tx(ctx,`${s} left`,382,ry+30,8.5,c,'right');
  });
  rr(ctx,400,40,152,312,5,D.sf2,D.bd);tx(ctx,'Cart',410,60,10,D.mu);
  [['Almond Giri 500g','× 2','PKR 1,700'],['Cashew Splits 1kg','× 1','PKR 1,450']].forEach(([n,q,sub],i)=>{
    tx(ctx,n,410,80+i*58,9.5,D.tx);tx(ctx,q,410,96+i*58,9,D.mu);tx(ctx,sub,540,96+i*58,9.5,D.tx,'right');hl(ctx,108+i*58,410,542);
  });
  hl(ctx,216,410,542);tx(ctx,'Total',410,234,11,D.tx);tx(ctx,'PKR 3,150',542,234,11,D.ac,'right');
  rr(ctx,410,248,130,34,8,D.ac);tx(ctx,'Complete Sale  →',475,269,10.5,'#fff','center');
  ['Cash','Credit','Online'].forEach((m,i)=>{rr(ctx,410+i*45,292,40,20,4,i===0?'rgba(16,185,129,0.2)':D.sf);tx(ctx,m,430+i*45,306,8,i===0?D.gr:D.mu,'center');});
}

function drawERP(canvas){
  const ctx=canvas.getContext('2d');const[W,H]=[560,360];
  ctx.fillStyle=D.bg;ctx.fillRect(0,0,W,H);
  chrome(ctx,W,'Factory ERP  —  Parts Inventory');
  [['Total Parts','48 SKUs',D.bl],['Buildable Now','124 units',D.gr],['Open POs','3',D.yw],['Payables','PKR 56K',D.rd]].forEach(([l,v,c],i)=>{
    rr(ctx,8+i*136,40,130,52,5,D.sf2,D.bd);tx(ctx,v,18+i*136,63,13,c);tx(ctx,l,18+i*136,80,9,D.mu);
  });
  rr(ctx,8,102,352,250,5,D.sf2,D.bd);
  const cols=[18,196,262,340];['Part Name','Stock','Rsvd','Avail'].forEach((h,i)=>tx(ctx,h,cols[i],122,9,D.mu,i===0?'left':'right'));
  hl(ctx,130,18,350);
  [['Motor 18" 3-Speed',60,12,48,D.gr],['Hex Nut M6',800,200,600,D.gr],['Blade Set 24"',45,20,25,D.gr],['Water Pad 36"',30,30,0,D.rd],['Pump 0.5hp',22,8,14,D.gr],['Frame Sheet 18g',40,15,25,D.gr],['Mesh Guard 24"',55,10,45,D.gr]].forEach(([n,s,r,a,ac],i)=>{
    const ry=146+i*28;if(i%2===0){ctx.fillStyle='rgba(255,255,255,0.015)';ctx.fillRect(18,ry-10,332,26);}
    tx(ctx,n,18,ry+4,9.5,D.tx);tx(ctx,String(s),cols[1],ry+4,9.5,D.tx,'right');tx(ctx,String(r),cols[2],ry+4,9.5,D.mu,'right');tx(ctx,String(a),cols[3],ry+4,9.5,ac,'right');
  });
  rr(ctx,368,102,184,250,5,D.sf2,D.bd);tx(ctx,'Bill of Materials',378,122,10,D.mu);tx(ctx,'Air Cooler 24" Desert',378,142,10.5,D.ac);hl(ctx,150,378,540);
  [['Motor 18"','1 pc'],['Blade Set 24"','1 set'],['Water Pad 36"','1 pc'],['Pump 0.5hp','1 pc'],['Frame Sheet','2 pcs'],['Hex Nut M6','16 pcs'],['Mesh Guard','1 pc']].forEach(([p,q],i)=>{
    tx(ctx,p,378,168+i*24,9.5,D.tx);tx(ctx,q,540,168+i*24,9.5,D.mu,'right');
  });
  hl(ctx,322,378,540);tx(ctx,'Can Build:',378,338,9,D.mu);tx(ctx,'30 units',540,338,10.5,D.gr,'right');
}

function drawTailor(canvas){
  const ctx=canvas.getContext('2d');const[W,H]=[560,360];
  ctx.fillStyle=D.bg;ctx.fillRect(0,0,W,H);
  chrome(ctx,W,'Tailor App  —  Orders');
  ['All (24)','In Work (8)','Ready (3)','Delivered'].forEach((tab,i)=>{
    const active=i===1;rr(ctx,8+i*136,40,128,28,4,active?D.ac:D.sf2,active?D.ac:D.bd);tx(ctx,tab,72+i*136,58,10,active?'#fff':D.mu,'center');
  });
  rr(ctx,8,78,318,274,5,D.sf2,D.bd);
  [['Ahmed Raza','2 Shirts, 1 Trouser','30 Jul','In Work',D.bl],['Tariq Mehmood','1 Sherwani','28 Jul','Ready',D.gr],['Bilal Hassan','3 Shalwar Kameez','2 Aug','In Work',D.bl],['Shahid Khan','1 Trouser','Overdue','Overdue',D.rd],['Imran Butt','2 Shirts','5 Aug','In Work',D.bl]].forEach(([n,it,d,st,c],i)=>{
    const oy=90+i*52;if(i%2===0){ctx.fillStyle='rgba(255,255,255,0.015)';ctx.fillRect(18,oy,298,48);}
    tx(ctx,n,18,oy+15,10.5,D.tx);tx(ctx,it,18,oy+31,9,D.mu);
    rr(ctx,246,oy+5,62,18,3,c+'28');tx(ctx,st,277,oy+18,8,c,'center');
    tx(ctx,d,248,oy+41,8,d==='Overdue'?D.rd:D.mu);
  });
  rr(ctx,334,78,218,274,5,D.sf2,D.bd);
  tx(ctx,'Ahmed Raza',344,98,11.5,D.ac);tx(ctx,'Customer since Jan 2024',344,114,9,D.mu);hl(ctx,122,344,540);
  tx(ctx,'Saved Measurements',344,140,9.5,D.mu);
  [['Chest','40"'],['Shoulder','17"'],['Shirt Length','30"'],['Sleeve','24"'],['Trouser','38"'],['Waist','34"']].forEach(([l,v],i)=>{
    tx(ctx,l,344,158+i*22,9.5,D.mu);tx(ctx,v,540,158+i*22,9.5,D.tx,'right');
  });
  hl(ctx,300,344,540);tx(ctx,'Total',344,316,9.5,D.mu);tx(ctx,'PKR 3,600',540,316,9.5,D.tx,'right');
  tx(ctx,'Advance Paid',344,334,9.5,D.mu);tx(ctx,'PKR 2,000',540,334,9.5,D.gr,'right');
  tx(ctx,'Balance Due',344,354,10,D.tx);tx(ctx,'PKR 1,600',540,354,10.5,D.rd,'right');
}

/* ─────────────────────────────────────────────────────── */
export default function HomePage() {
  const { user } = useAuth();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const posRef = useRef();
  const erpRef = useRef();
  const tailorRef = useRef();

  useEffect(() => {
    if (posRef.current) drawPOS(posRef.current);
    if (erpRef.current) drawERP(erpRef.current);
    if (tailorRef.current) drawTailor(tailorRef.current);
  }, [isDesktop]);

  if (user?.approval_status === 'approved' && !user?.cloud_blocked) {
    return <Navigate to="/dashboard" replace />;
  }

  const GRAD = 'linear-gradient(130deg, #FFCCE0 0%, #EDD9FF 30%, #D5EDFF 65%, #B8F2DA 100%)';
  const PX = isDesktop ? '52px' : '20px';
  const SECTION_PY = isDesktop ? '100px' : '60px';

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', overflowX: 'hidden' }}>

      {/* ══ HERO ══════════════════════════════════════════ */}
      <section style={{ background: GRAD, minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>

        {/* Bokeh blobs */}
        {[
          { top: '4%', left: '10%', size: 240 },
          { top: '55%', left: '3%', size: 180 },
          { top: '10%', right: '6%', size: 150 },
          { bottom: '4%', right: '4%', size: 200 },
          { top: '40%', left: '40%', size: 120 },
        ].map((b, i) => (
          <div key={i} style={{
            position: 'absolute', borderRadius: '50%',
            background: 'rgba(255,255,255,0.6)', filter: 'blur(55px)',
            width: b.size, height: b.size,
            top: b.top, left: b.left, right: b.right, bottom: b.bottom,
            pointerEvents: 'none',
          }} />
        ))}

        {/* Nav */}
        <nav style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `0 ${PX}`, height: 64, position: 'relative', zIndex: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#FF4E7D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Store size={15} color="white" />
            </div>
            <span style={{ fontWeight: 800, fontSize: 17, color: '#111', letterSpacing: '-0.01em' }}>OsaTech</span>
          </div>

          {isDesktop && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
              {[['#pos', 'Retail POS'], ['#erp', 'Factory ERP'], ['#tailor', 'Tailor App'], ['#about', 'About']].map(([href, label]) => (
                <a key={href} href={href} style={{ fontSize: 14, color: '#444', textDecoration: 'none', fontWeight: 500 }}>
                  {label}
                </a>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThemeBtn />
            <Link to="/login" style={{
              background: '#FF4E7D', color: 'white', borderRadius: 50,
              padding: isDesktop ? '10px 26px' : '9px 18px', fontSize: 13, fontWeight: 700,
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7,
              boxShadow: '0 6px 20px rgba(255,78,125,0.35)',
            }}>
              Login {isDesktop && <ArrowRight size={13} />}
            </Link>
          </div>
        </nav>

        {/* Hero body */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr',
          alignItems: 'center',
          minHeight: 'calc(100vh - 64px)',
          padding: isDesktop ? '0 52px 72px' : '32px 20px 56px',
          position: 'relative', zIndex: 10, gap: 32,
        }}>
          {/* Left text */}
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.75)', borderRadius: 50,
              padding: '8px 20px', fontSize: 12, color: '#555', marginBottom: 28,
              backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.6)',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FF4E7D', display: 'inline-block' }} />
              Business software · Built in Pakistan
            </div>

            <h1 style={{
              fontSize: isDesktop ? 'clamp(2.4rem, 4.2vw, 3.8rem)' : 'clamp(2rem, 8vw, 2.6rem)',
              fontWeight: 900, lineHeight: 1.1,
              color: '#111', marginBottom: 20, letterSpacing: '-0.025em',
            }}>
              Complete business<br />
              software for every<br />
              <span style={{ color: '#FF4E7D' }}>Pakistani shop.</span>
            </h1>

            <p style={{ fontSize: isDesktop ? 16 : 15, color: '#555', lineHeight: 1.8, maxWidth: '44ch', marginBottom: 32 }}>
              Three purpose-built applications — retail POS, manufacturing ERP, and tailor
              management. Offline-first. PKR native. Designed for how Pakistani businesses actually work.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/login" style={{
                background: '#FF4E7D', color: 'white', borderRadius: 16,
                padding: '13px 28px', fontSize: 14, fontWeight: 700,
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9,
                boxShadow: '0 10px 30px rgba(255,78,125,0.38)',
              }}>
                <Store size={16} /> Login to Web POS
              </Link>
              <Link to="/register" style={{
                background: 'rgba(255,255,255,0.8)', color: '#333',
                borderRadius: 16, padding: '13px 28px', fontSize: 14, fontWeight: 600,
                textDecoration: 'none', border: '1px solid rgba(255,255,255,0.6)',
                backdropFilter: 'blur(8px)',
              }}>
                Register store
              </Link>
            </div>

            <div style={{ display: 'flex', gap: isDesktop ? 40 : 28, marginTop: 40, paddingTop: 32, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              {[['3', 'Applications'], ['10+', 'Business types'], ['PKR', 'Native currency']].map(([v, l]) => (
                <div key={l}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#111' }}>{v}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — floating cards (desktop only) */}
          {isDesktop && (
            <div style={{ position: 'relative', height: 520 }}>
              <SalesCard />
              <CartCard />
              <StockCard />
            </div>
          )}
        </div>
      </section>

      {/* ══ PRODUCTS ══════════════════════════════════════ */}
      <section id="pos" style={{ background: '#FAFAFA', padding: `${SECTION_PY} ${PX}` }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontSize: 11, color: '#FF4E7D', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 12 }}>
              Our Applications
            </p>
            <h2 style={{ fontSize: 'clamp(1.6rem,3vw,2.4rem)', fontWeight: 900, color: '#111', letterSpacing: '-0.02em' }}>
              Three apps, every business covered
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(3, 1fr)' : '1fr', gap: 24 }}>
            <ProductCard
              eyebrow="Web Application"
              icon={ShoppingBag}
              iconBg="#FF4E7D"
              name="OsaTech POS"
              desc="Full retail management in your browser — POS, inventory, customers, vendors, reports, and cloud sync. Works for bakery, dry fruit, medical, wholesale, and more."
              features={[
                'Barcode scanning with live stock tracking',
                'Customer ledger with credit and payment history',
                'Vendor management and purchase orders',
                'Multi-period P&L and balance sheet reports',
                'Cash register with daily closing reports',
              ]}
              tags={['Retailer', 'Bakery', 'Dry Fruit', 'Medical', 'Wholesale', 'Grocery']}
              cta
            />
            <ProductCard
              eyebrow="Desktop Application"
              icon={Factory}
              iconBg="#7C3AED"
              name="Factory ERP"
              desc="Manufacturing ERP for assemble-on-order businesses. Bill of materials consumed on each sale, parts inventory with reserved tracking, and full vendor-customer ledger."
              features={[
                'Bill of materials auto-consumed on sale',
                'Parts inventory with reserved-stock view',
                'Vendor POs, goods receipts, payable ledger',
                'Customer invoicing with PDF printing',
                'Dashboard: buildable stock & open payables',
              ]}
              tags={['Air Cooler Assembly', 'Light Manufacturing', 'Workshop', 'Made-to-Order']}
            />
            <ProductCard
              eyebrow="Desktop Application"
              icon={Scissors}
              iconBg="#0891B2"
              name="Tailor App"
              desc="Order tracking and measurement profiles for tailor shops. Permanent per-customer measurements, delivery tracking, advance payments, and order slip printing."
              features={[
                'Permanent customer measurement profiles',
                'Order lifecycle: Received → Ready → Delivered',
                'Overdue order alerts at a glance',
                'Advance payment and balance due receipts',
                'Print order slip with measurements',
              ]}
              tags={['Tailor Shop', 'Boutique', 'Sherwani House', 'Uniform Maker']}
            />
          </div>
        </div>
      </section>

      {/* ══ PRODUCT DETAIL: POS ═══════════════════════════ */}
      <section style={{ background: 'white', padding: `${SECTION_PY} ${PX}` }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: isDesktop ? 72 : 40, alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 11, color: '#FF4E7D', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 14 }}>Retail POS · Web App</p>
            <h2 style={{ fontSize: 'clamp(1.6rem,2.5vw,2.2rem)', fontWeight: 900, color: '#111', letterSpacing: '-0.02em', marginBottom: 18 }}>OsaTech POS</h2>
            <p style={{ fontSize: 15, color: '#555', lineHeight: 1.8, marginBottom: 28 }}>
              A complete retail management system accessible from any browser. Your desktop app syncs every sale, purchase, and adjustment to the cloud — log in from anywhere and see the live picture of your store.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {['Point-of-sale with barcode scanning and multiple payment methods', 'Customer credit ledger — track balances, record payments, view history', 'Vendor management with POs, goods receipts, and payable tracking', 'Sales and purchase returns with automatic stock correction', 'Cash register open/close with shift-end daily report', 'Cloud sync — one account works across desktop and web'].map(f => (
                <li key={f} style={{ display: 'flex', gap: 12, fontSize: 14, color: '#444' }}>
                  <CheckCircle2 size={15} color="#FF4E7D" style={{ flexShrink: 0, marginTop: 2 }} />{f}
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
              {['Retailer', 'Bakery', 'Dry Fruit & Nuts', 'Medical / Pharmacy', 'Wholesale', 'Grocery', 'Hardware', 'Stationery'].map(t => (
                <span key={t} style={{ fontSize: 11, padding: '5px 13px', borderRadius: 50, background: '#FFF0F4', border: '1px solid #FFD0DC', color: '#CC3063' }}>{t}</span>
              ))}
            </div>
            <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#FF4E7D', color: 'white', borderRadius: 14, padding: '13px 26px', fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: '0 8px 24px rgba(255,78,125,0.32)' }}>
              <Store size={15} /> Login to Web POS
            </Link>
          </div>
          <div style={{ borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.06)' }}>
            <canvas ref={posRef} width={560} height={360} style={{ display: 'block', width: '100%' }} />
          </div>
        </div>
      </section>

      {/* ══ PRODUCT DETAIL: ERP ═══════════════════════════ */}
      <section id="erp" style={{ background: '#F7F4FF', padding: `${SECTION_PY} ${PX}` }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: isDesktop ? 72 : 40, alignItems: 'center' }}>
          {isDesktop && (
            <div style={{ borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.10)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <canvas ref={erpRef} width={560} height={360} style={{ display: 'block', width: '100%' }} />
            </div>
          )}
          <div>
            <p style={{ fontSize: 11, color: '#7C3AED', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 14 }}>Manufacturing · Desktop App</p>
            <h2 style={{ fontSize: 'clamp(1.6rem,2.5vw,2.2rem)', fontWeight: 900, color: '#111', letterSpacing: '-0.02em', marginBottom: 18 }}>Factory ERP</h2>
            <p style={{ fontSize: 15, color: '#555', lineHeight: 1.8, marginBottom: 28 }}>
              Built for air cooler assembly and any assemble-on-order manufacturer. When a sale is confirmed, the bill of materials is consumed from parts inventory automatically — no manual stock adjustments needed.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {['Bill of materials — parts consumed automatically on every sale', 'Parts inventory shows stock, reserved, and available quantities separately', 'Vendor POs, goods receipts, and payable reconciliation', 'Customer invoicing with PKR invoice printing (PDF)', 'Khata-style receivables and payables per account', 'Dashboard: buildable stock, open payables, top parts used'].map(f => (
                <li key={f} style={{ display: 'flex', gap: 12, fontSize: 14, color: '#444' }}>
                  <CheckCircle2 size={15} color="#7C3AED" style={{ flexShrink: 0, marginTop: 2 }} />{f}
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['Air Cooler Assembly', 'Light Manufacturing', 'Workshop', 'Made-to-Order'].map(t => (
                <span key={t} style={{ fontSize: 11, padding: '5px 13px', borderRadius: 50, background: '#F3EEFF', border: '1px solid #DDD0FF', color: '#6D28D9' }}>{t}</span>
              ))}
            </div>
          </div>
          {!isDesktop && (
            <div style={{ borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.10)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <canvas ref={erpRef} width={560} height={360} style={{ display: 'block', width: '100%' }} />
            </div>
          )}
        </div>
      </section>

      {/* ══ PRODUCT DETAIL: TAILOR ════════════════════════ */}
      <section id="tailor" style={{ background: 'white', padding: `${SECTION_PY} ${PX}` }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: isDesktop ? 72 : 40, alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 11, color: '#0891B2', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 14 }}>Tailoring · Desktop App</p>
            <h2 style={{ fontSize: 'clamp(1.6rem,2.5vw,2.2rem)', fontWeight: 900, color: '#111', letterSpacing: '-0.02em', marginBottom: 18 }}>Tailor App</h2>
            <p style={{ fontSize: 15, color: '#555', lineHeight: 1.8, marginBottom: 28 }}>
              Every customer's measurements are stored permanently — repeat orders take seconds. Track orders from received to delivered, log advances and balances, and print an order slip for the customer.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {['Permanent per-customer measurement profiles (chest, shoulder, sleeve, waist…)', 'Order lifecycle: Received → In Work → Ready → Delivered', 'Overdue delivery alerts on the main order list', 'Advance payment and balance due tracking per order', 'Per-garment pricing with fabric and style notes', 'Print order slip with full measurements and delivery date'].map(f => (
                <li key={f} style={{ display: 'flex', gap: 12, fontSize: 14, color: '#444' }}>
                  <CheckCircle2 size={15} color="#0891B2" style={{ flexShrink: 0, marginTop: 2 }} />{f}
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['Darzi / Tailor Shop', 'Boutique', 'Sherwani House', 'School Uniform Maker'].map(t => (
                <span key={t} style={{ fontSize: 11, padding: '5px 13px', borderRadius: 50, background: '#ECFEFF', border: '1px solid #CFFAFE', color: '#0E7490' }}>{t}</span>
              ))}
            </div>
          </div>
          <div style={{ borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.10)', border: '1px solid rgba(0,0,0,0.06)' }}>
            <canvas ref={tailorRef} width={560} height={360} style={{ display: 'block', width: '100%' }} />
          </div>
        </div>
      </section>

      {/* ══ ABOUT ═════════════════════════════════════════ */}
      <section id="about" style={{ background: GRAD, padding: `${SECTION_PY} ${PX}`, position: 'relative' }}>
        <div style={{ position: 'absolute', pointerEvents: 'none', inset: 0, overflow: 'hidden' }}>
          {[{ top: '20%', left: '5%', size: 160 }, { bottom: '10%', right: '8%', size: 200 }].map((b, i) => (
            <div key={i} style={{ position: 'absolute', borderRadius: '50%', background: 'rgba(255,255,255,0.5)', filter: 'blur(50px)', width: b.size, height: b.size, top: b.top, left: b.left, right: b.right, bottom: b.bottom }} />
          ))}
        </div>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: isDesktop ? 80 : 48, position: 'relative', zIndex: 2 }}>
          <div>
            <p style={{ fontSize: 11, color: '#FF4E7D', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 14 }}>About</p>
            <h2 style={{ fontSize: 'clamp(1.6rem,2.5vw,2.2rem)', fontWeight: 900, color: '#111', letterSpacing: '-0.02em', marginBottom: 22 }}>Built in Pakistan, for Pakistan</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                'These applications are designed by a Pakistani developer with hands-on experience in local retail and manufacturing businesses. Every flow reflects how these businesses actually operate — not textbook theory.',
                'All three applications are built with Electron and React, targeting Windows — the platform Pakistani SMEs already use. No server to manage, no subscription to pay.',
                'Offline-first is a requirement. In markets where connectivity drops without warning, a business cannot afford software that stops when the signal does.',
              ].map((p, i) => (
                <p key={i} style={{ fontSize: 15, color: '#444', lineHeight: 1.8 }}>{p}</p>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: 11, color: '#6B7280', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 22 }}>Get in touch</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[['Email', 'munibahmadvfx@gmail.com'], ['Location', 'Pakistan'], ['Stack', 'Electron · React · SQLite · Node.js · Tailwind CSS']].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', gap: 20, paddingBottom: 16, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                  <span style={{ width: 72, flexShrink: 0, fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', paddingTop: 2 }}>{l}</span>
                  <span style={{ fontSize: 14, color: '#333' }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.85)', color: '#333', borderRadius: 14, padding: '13px 26px', fontSize: 14, fontWeight: 700, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)' }}>
                Register a store
              </Link>
              <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#FF4E7D', color: 'white', borderRadius: 14, padding: '13px 26px', fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: '0 8px 24px rgba(255,78,125,0.32)' }}>
                Login <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════ */}
      <footer style={{
        background: '#111', padding: isDesktop ? '28px 52px' : '24px 20px',
        display: 'flex', flexDirection: isDesktop ? 'row' : 'column',
        alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: '#FF4E7D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Store size={11} color="white" />
          </div>
          <span style={{ fontSize: 13, color: '#666' }}>OsaTech · 2025</span>
        </div>
        {isDesktop && <span style={{ fontSize: 12, color: '#444', fontStyle: 'italic' }}>Local roots. Professional software.</span>}
        <div style={{ display: 'flex', gap: 20 }}>
          <Link to="/register" style={{ fontSize: 12, color: '#555', textDecoration: 'none' }}>Register store</Link>
          <Link to="/login" style={{ fontSize: 12, color: '#FF4E7D', textDecoration: 'none', fontWeight: 600 }}>Login →</Link>
        </div>
      </footer>

    </div>
  );
}
