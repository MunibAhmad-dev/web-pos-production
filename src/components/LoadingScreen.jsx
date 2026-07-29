import { ShoppingCart } from 'lucide-react';

// Inline keyframes so this component is fully self-contained
const STYLES = `
  @keyframes __ls_bar {
    0%   { left: -40%; width: 30%; }
    40%  { left: 20%;  width: 50%; }
    70%  { left: 60%;  width: 40%; }
    100% { left: 110%; width: 30%; }
  }
  @keyframes __ls_bar2 {
    0%   { left: -55%; width: 20%; }
    50%  { left: 40%;  width: 35%; }
    100% { left: 110%; width: 20%; }
  }
  @keyframes __ls_spin {
    to { transform: rotate(360deg); }
  }
  @keyframes __ls_dot {
    0%, 80%, 100% { transform: scale(0.55); opacity: 0.35; }
    40%            { transform: scale(1);    opacity: 1; }
  }
  @keyframes __ls_fadein {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes __ls_glow {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    50%      { opacity: 1;   transform: scale(1.08); }
  }
`;

/**
 * Beautiful full-screen loading overlay.
 *
 * Props:
 *  message    — primary text (default "Starting up…")
 *  submessage — secondary text below (optional)
 */
export default function LoadingScreen({
  message    = 'Starting up…',
  submessage = '',
}) {
  return (
    <>
      <style>{STYLES}</style>

      <div
        style={{
          position:       'fixed',
          inset:          0,
          zIndex:         9999,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          overflow:       'hidden',
          background:     'hsl(var(--background))',
        }}
      >
        {/* ── Ambient glow blob ─────────────────────────────────────────── */}
        <div style={{
          position:  'absolute',
          top:       '38%',
          left:      '50%',
          transform: 'translate(-50%, -50%)',
          width:     640,
          height:    640,
          borderRadius: '50%',
          background: 'radial-gradient(circle at center, hsl(var(--primary) / 0.10) 0%, transparent 70%)',
          animation:  '__ls_glow 3s ease-in-out infinite',
          pointerEvents: 'none',
        }} />

        {/* ── Top progress bar ──────────────────────────────────────────── */}
        <div style={{
          position:   'fixed',
          top:        0,
          left:       0,
          right:      0,
          height:     3,
          background: 'hsl(var(--muted))',
          zIndex:     10000,
          overflow:   'hidden',
        }}>
          {/* Primary slider */}
          <div style={{
            position:   'absolute',
            top:        0,
            height:     '100%',
            background: 'hsl(var(--primary))',
            borderRadius: 9999,
            animation:  '__ls_bar 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite',
            opacity:    0.9,
          }} />
          {/* Shadow / trailing bar */}
          <div style={{
            position:   'absolute',
            top:        0,
            height:     '100%',
            background: 'hsl(var(--primary) / 0.4)',
            borderRadius: 9999,
            animation:  '__ls_bar2 1.6s cubic-bezier(0.4, 0, 0.2, 1) 0.25s infinite',
          }} />
        </div>

        {/* ── Center card ───────────────────────────────────────────────── */}
        <div style={{ animation: '__ls_fadein 0.55s cubic-bezier(0.23, 1, 0.32, 1) forwards', textAlign: 'center' }}>

          {/* Icon + spinning ring */}
          <div style={{ position: 'relative', width: 76, height: 76, margin: '0 auto 28px' }}>
            {/* Outer spinning arc */}
            <div style={{
              position:    'absolute',
              inset:       -8,
              borderRadius: '50%',
              border:      '2.5px solid transparent',
              borderTopColor:   'hsl(var(--primary))',
              borderRightColor: 'hsl(var(--primary) / 0.35)',
              animation:   '__ls_spin 0.95s linear infinite',
            }} />
            {/* Inner arc — slower, opposite direction */}
            <div style={{
              position:    'absolute',
              inset:       -14,
              borderRadius: '50%',
              border:      '1.5px solid transparent',
              borderBottomColor: 'hsl(var(--primary) / 0.25)',
              borderLeftColor:   'hsl(var(--primary) / 0.15)',
              animation:   '__ls_spin 2.1s linear reverse infinite',
            }} />
            {/* Icon box */}
            <div style={{
              width:         76,
              height:        76,
              borderRadius:  18,
              background:    'hsl(var(--primary))',
              display:       'flex',
              alignItems:    'center',
              justifyContent:'center',
              boxShadow:     '0 16px 48px hsl(var(--primary) / 0.35), 0 4px 12px hsl(var(--primary) / 0.2)',
            }}>
              <ShoppingCart size={32} color="hsl(var(--primary-foreground))" />
            </div>
          </div>

          {/* Text */}
          <h2 style={{
            fontSize:   '1.2rem',
            fontWeight: 700,
            color:      'hsl(var(--foreground))',
            margin:     0,
            letterSpacing: '-0.01em',
          }}>
            {message}
          </h2>

          {submessage && (
            <p style={{
              fontSize:   '0.8125rem',
              color:      'hsl(var(--muted-foreground))',
              marginTop:  6,
            }}>
              {submessage}
            </p>
          )}

          {/* Bouncing dots */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 28 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width:        8,
                  height:       8,
                  borderRadius: '50%',
                  background:   'hsl(var(--primary))',
                  animation:    `__ls_dot 1.3s ease-in-out ${i * 0.16}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
