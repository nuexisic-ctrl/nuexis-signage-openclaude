import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  BarChart3,
  Check,
  ChevronRight,
  CircleHelp,
  Copy,
  FolderOpen,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  Monitor,
  MoreHorizontal,
  PlaySquare,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Users,
  Wifi,
  X,
} from 'lucide-react';

const APP_WIDTH = 1600;
const APP_HEIGHT = 1000;
const PLAYER_CODE = 'NX7 4Q2';
const BLUE = '#1b6fff';
const CYAN = '#4dc7ff';
const GREEN = '#29c779';
const NAVY = '#08111f';
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOut = Easing.bezier(0.45, 0, 0.55, 1);
const overshoot = Easing.bezier(0.34, 1.56, 0.64, 1);

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CursorPoint = {
  frame: number;
  x: number;
  y: number;
  rotate: number;
};

type Timeline = {
  total: number;
  addClick: number;
  modalStart: number;
  modalEnd: number;
  splitStart: number;
  splitEnd: number;
  codeFocusStart: number;
  copyClick: number;
  returnStart: number;
  pasteStart: number;
  pasteEnd: number;
  pairClick: number;
  loadingStart: number;
  successStart: number;
  modalCloseStart: number;
  rowRevealStart: number;
  bannerStart: number;
  outroStart: number;
};

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;

const progress = (
  frame: number,
  start: number,
  end: number,
  easing: ((input: number) => number) = easeOut,
) => interpolate(frame, [start, end], [0, 1], {...clamp, easing});

const pulse = (frame: number, center: number, radius: number) =>
  Math.max(0, 1 - Math.abs(frame - center) / radius);

const mixRect = (from: Rect, to: Rect, amount: number): Rect => ({
  x: lerp(from.x, to.x, amount),
  y: lerp(from.y, to.y, amount),
  width: lerp(from.width, to.width, amount),
  height: lerp(from.height, to.height, amount),
});

const mapPoint = (
  rect: Rect,
  mode: 'contain' | 'cover',
  localX: number,
  localY: number,
) => {
  const scale =
    mode === 'cover'
      ? Math.max(rect.width / APP_WIDTH, rect.height / APP_HEIGHT)
      : Math.min(rect.width / APP_WIDTH, rect.height / APP_HEIGHT);
  const contentWidth = APP_WIDTH * scale;
  const contentHeight = APP_HEIGHT * scale;
  const offsetX = rect.x + (rect.width - contentWidth) / 2;
  const offsetY = rect.y + (rect.height - contentHeight) / 2;
  return {
    x: offsetX + localX * scale,
    y: offsetY + localY * scale,
  };
};

const getTimeline = (fps: number): Timeline => {
  const seconds = (value: number) => Math.round(value * fps);
  return {
    total: seconds(20),
    addClick: seconds(2.55),
    modalStart: seconds(2.72),
    modalEnd: seconds(3.45),
    splitStart: seconds(4.15),
    splitEnd: seconds(6.05),
    codeFocusStart: seconds(6.6),
    copyClick: seconds(7.95),
    returnStart: seconds(8.35),
    pasteStart: seconds(9.65),
    pasteEnd: seconds(10.05),
    pairClick: seconds(10.72),
    loadingStart: seconds(10.9),
    successStart: seconds(12.55),
    modalCloseStart: seconds(14.15),
    rowRevealStart: seconds(14.35),
    bannerStart: seconds(15.25),
    outroStart: seconds(17.4),
  };
};

const nav = [
  [LayoutDashboard, 'Dashboard'],
  [FolderOpen, 'Assets'],
  [PlaySquare, 'Playlists'],
  [Monitor, 'Screens'],
  [Users, 'Groups'],
  [BarChart3, 'Analytics'],
] as const;

const panelStyle = (
  rect: Rect,
  {
    radius,
    opacity,
    blur,
    translateY,
    scale,
  }: {
    radius: number;
    opacity?: number;
    blur?: number;
    translateY?: number;
    scale?: number;
  },
): React.CSSProperties => ({
  position: 'absolute',
  left: rect.x,
  top: rect.y + (translateY ?? 0),
  width: rect.width,
  height: rect.height,
  borderRadius: radius,
  overflow: 'hidden',
  opacity: opacity ?? 1,
  transform: `scale(${scale ?? 1})`,
  transformOrigin: 'center center',
  background: 'rgba(8, 14, 26, 0.55)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow:
    '0 35px 90px rgba(2, 8, 23, 0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
  filter: `blur(${blur ?? 0}px)`,
  backdropFilter: 'blur(18px)',
});

const Sidebar: React.FC = () => (
  <div
    style={{
      width: 220,
      background: '#fff',
      borderRight: '1px solid #ebeff5',
      padding: '26px 18px',
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    <Img
      src={staticFile('NuExis-logo.png')}
      style={{width: 138, height: 42, objectFit: 'contain', objectPosition: 'left'}}
    />
    <div
      style={{
        fontSize: 10,
        letterSpacing: 1.8,
        fontWeight: 800,
        color: '#8894a8',
        margin: '2px 10px 30px',
      }}
    >
      ENTERPRISE WORKSPACE
    </div>
    <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
      {nav.map(([Icon, label]) => {
        const active = label === 'Screens';
        return (
          <div
            key={label}
            style={{
              height: 45,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '0 13px',
              background: active ? '#eaf3ff' : 'transparent',
              color: active ? BLUE : '#67748a',
              fontSize: 14,
              fontWeight: 750,
            }}
          >
            <Icon size={18} />
            {label}
          </div>
        );
      })}
    </div>
    <div style={{marginTop: 'auto', borderTop: '1px solid #edf1f6', paddingTop: 18}}>
      <div style={{display: 'flex', gap: 11, alignItems: 'center'}}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            background: 'linear-gradient(145deg,#1768e5,#68a5ff)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
          }}
        >
          NK
        </div>
        <div>
          <div style={{fontSize: 13, fontWeight: 800}}>Nikhil Kumar</div>
          <div style={{fontSize: 10, color: '#8a96aa'}}>Workspace Admin</div>
        </div>
      </div>
    </div>
  </div>
);

const ScreenRow: React.FC<{
  name: string;
  location: string;
  status: 'Online' | 'Offline';
  fresh?: boolean;
  progressValue?: number;
}> = ({name, location, status, fresh, progressValue = 1}) => (
  <div
    style={{
      height: 84,
      display: 'grid',
      gridTemplateColumns: '42px 2fr 1fr 1fr 44px',
      alignItems: 'center',
      borderTop: '1px solid #edf1f6',
      padding: '0 22px',
      background: fresh ? '#f5fcf8' : '#fff',
      boxShadow: fresh ? 'inset 3px 0 #20b46b' : undefined,
      opacity: progressValue,
      transform: `translateY(${(1 - progressValue) * 18}px)`,
    }}
  >
    <div style={{width: 18, height: 18, border: '1px solid #cad2df', borderRadius: 5}} />
    <div style={{display: 'flex', alignItems: 'center', gap: 13}}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 11,
          background: fresh ? '#def7ea' : '#eef3fa',
          display: 'grid',
          placeItems: 'center',
          color: fresh ? '#16965a' : '#738097',
        }}
      >
        <Monitor size={20} />
      </div>
      <div>
        <div style={{fontWeight: 800, color: '#15223a', fontSize: 14}}>{name}</div>
        <div style={{fontSize: 11, color: '#8a96aa', marginTop: 3}}>{location}</div>
      </div>
    </div>
    <div style={{fontSize: 13, color: '#647187'}}>Landscape</div>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        color: status === 'Online' ? '#188c59' : '#8b96a8',
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          background: status === 'Online' ? '#24b36b' : '#b9c1cd',
          boxShadow: status === 'Online' ? '0 0 0 4px #e1f7eb' : undefined,
        }}
      />
      {status}
    </div>
    <MoreHorizontal size={18} color="#8994a6" />
  </div>
);

const CmsContent: React.FC<{
  frame: number;
  timeline: Timeline;
}> = ({frame, timeline}) => {
  const modalOpen = progress(frame, timeline.modalStart, timeline.modalEnd, overshoot);
  const split = progress(frame, timeline.splitStart, timeline.splitEnd, easeInOut);
  const pasted = progress(frame, timeline.pasteStart, timeline.pasteEnd);
  const buttonPressed = pulse(frame, timeline.pairClick, 8);
  const success = progress(frame, timeline.loadingStart + 20, timeline.successStart);
  const modalClose = progress(frame, timeline.modalCloseStart, timeline.modalCloseStart + 24);
  const rowReveal = progress(frame, timeline.rowRevealStart, timeline.rowRevealStart + 24);
  const overlayOpacity = Math.max(0, modalOpen - modalClose);
  const pairing = frame >= timeline.loadingStart && frame < timeline.successStart;
  const buttonScale = 1 - buttonPressed * 0.045;
  const modalLift = interpolate(modalOpen - modalClose, [0, 1], [18, 0], clamp);
  const heroGlow = 0.08 + split * 0.06;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background:
          'linear-gradient(180deg, #fbfdff 0%, #f6f8fc 38%, #eef3f9 100%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 85% 8%, rgba(48,110,255,0.10), transparent 28%)',
          opacity: 0.8 + split * 0.2,
        }}
      />
      <div style={{position: 'absolute', inset: 0, display: 'flex'}}>
        <Sidebar />
        <div style={{flex: 1, padding: '44px 46px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: 1.4,
                  color: BLUE,
                }}
              >
                SCREEN OPERATIONS
              </div>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 900,
                  color: '#101e35',
                  letterSpacing: -0.9,
                  marginTop: 10,
                }}
              >
                Screens
              </div>
              <div style={{fontSize: 14, color: '#79859a', marginTop: 8}}>
                Manage, pair, and monitor every connected display.
              </div>
            </div>
            <button
              style={{
                height: 46,
                padding: '0 18px',
                border: 0,
                borderRadius: 12,
                background: BLUE,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                fontWeight: 850,
                boxShadow: '0 12px 28px rgba(27,111,255,0.28)',
                transform: `scale(${1 - pulse(frame, timeline.addClick, 7) * 0.04})`,
              }}
            >
              <Plus size={17} />
              Add Screen
            </button>
          </div>

          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 28}}>
            {[
              ['Online screens', '48', 'All displays healthy'],
              ['Pending approvals', '03', 'Two displays need pairing'],
              ['Content sync', '99.98%', 'Across all active locations'],
            ].map(([label, value, description], index) => (
              <div
                key={label}
                style={{
                  borderRadius: 18,
                  padding: '18px 20px',
                  background: `linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.86))`,
                  border: '1px solid rgba(219,227,238,0.9)',
                  boxShadow: `0 10px 30px rgba(17, 30, 53, ${heroGlow})`,
                  transform: `translateY(${Math.sin((frame + index * 5) / 22) * 1.5}px)`,
                }}
              >
                <div style={{fontSize: 11, fontWeight: 800, color: '#7d889d', letterSpacing: 1}}>
                  {label.toUpperCase()}
                </div>
                <div style={{fontSize: 30, fontWeight: 900, marginTop: 12, color: '#10203a'}}>
                  {value}
                </div>
                <div style={{fontSize: 12, color: '#7f8ca0', marginTop: 8}}>{description}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 24,
              borderRadius: 20,
              border: '1px solid #e3e8f0',
              background: '#fff',
              overflow: 'hidden',
              boxShadow: '0 18px 50px rgba(26,48,83,0.07)',
            }}
          >
            <div
              style={{
                height: 72,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 20px',
              }}
            >
              <div
                style={{
                  width: 320,
                  height: 42,
                  border: '1px solid #dde3ec',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '0 13px',
                  color: '#9aa4b3',
                  fontSize: 12,
                }}
              >
                <Search size={16} />
                Search screens...
              </div>
              <div style={{display: 'flex', gap: 9}}>
                <div
                  style={{
                    height: 40,
                    padding: '0 14px',
                    border: '1px solid #dde3ec',
                    borderRadius: 10,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 12,
                    color: '#69758a',
                  }}
                >
                  Filters
                </div>
                <div
                  style={{
                    width: 40,
                    border: '1px solid #dde3ec',
                    borderRadius: 10,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Settings size={15} color="#718096" />
                </div>
              </div>
            </div>
            <div
              style={{
                height: 42,
                background: '#f8fafc',
                display: 'grid',
                gridTemplateColumns: '42px 2fr 1fr 1fr 44px',
                alignItems: 'center',
                padding: '0 22px',
                fontSize: 10,
                fontWeight: 850,
                letterSpacing: 0.8,
                color: '#8a96a8',
              }}
            >
              <span />
              <span>SCREEN</span>
              <span>ORIENTATION</span>
              <span>STATUS</span>
              <span />
            </div>
            <ScreenRow
              name="Lobby Display"
              location="Main reception / Just paired"
              status="Online"
              fresh
              progressValue={rowReveal}
            />
            <ScreenRow name="Conference Room A" location="Floor 3 / Updated 2m ago" status="Online" />
            <ScreenRow name="Cafeteria Menu" location="Ground floor / Updated 8m ago" status="Online" />
            <ScreenRow name="East Wing Directory" location="Floor 1 / Updated yesterday" status="Offline" />
          </div>
        </div>
      </div>

      {overlayOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `rgba(8,18,32,${0.24 * overlayOpacity})`,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div
            style={{
              width: 560,
              borderRadius: 24,
              background: '#ffffff',
              boxShadow:
                '0 34px 96px rgba(8, 20, 38, 0.25), 0 0 0 1px rgba(18, 45, 86, 0.08)',
              padding: 30,
              opacity: overlayOpacity,
              transform: `translateY(${modalLift}px) scale(${interpolate(
                modalOpen - modalClose,
                [0, 1],
                [0.93, 1],
                clamp,
              )})`,
            }}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
              <div>
                <div style={{fontSize: 24, fontWeight: 850, color: '#12203a'}}>Add Screen</div>
                <div style={{color: '#738097', fontSize: 13, marginTop: 6}}>
                  Enter the pairing code shown on the player to link this display.
                </div>
              </div>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  background: '#f4f6f9',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <X size={17} />
              </div>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 18, marginTop: 26}}>
              <div>
                <div style={{fontSize: 11, fontWeight: 850, letterSpacing: 0.8, color: '#536079'}}>
                  PAIRING CODE
                </div>
                <div
                  style={{
                    height: 62,
                    borderRadius: 14,
                    border: `1.5px solid ${pasted > 0.02 ? BLUE : '#d8dfe9'}`,
                    boxShadow: pasted > 0.02 ? '0 0 0 5px rgba(23,104,229,0.09)' : undefined,
                    marginTop: 9,
                    padding: '0 18px',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: 23,
                    letterSpacing: 5,
                    fontWeight: 850,
                    color: '#14213a',
                  }}
                >
                  {pasted > 0.04 ? PLAYER_CODE : (
                    <span style={{fontSize: 15, letterSpacing: 1, color: '#a4adba', fontWeight: 500}}>
                      A1B2C3
                    </span>
                  )}
                  <span
                    style={{
                      width: 2,
                      height: 27,
                      background: BLUE,
                      marginLeft: 2,
                      opacity: frame % 28 < 16 ? 1 : 0,
                    }}
                  />
                </div>
                <div
                  style={{
                    marginTop: 18,
                    borderRadius: 15,
                    background: '#f7f9fc',
                    padding: 16,
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 11,
                      background: '#e8f1ff',
                      display: 'grid',
                      placeItems: 'center',
                      color: BLUE,
                    }}
                  >
                    <CircleHelp size={18} />
                  </div>
                  <div>
                    <div style={{fontWeight: 800, fontSize: 12, color: '#33415a'}}>Find this code on your player</div>
                    <div style={{fontSize: 11, color: '#8290a4', marginTop: 3}}>
                      Open the Web Player on the display you want to connect.
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  borderRadius: 18,
                  background: 'linear-gradient(180deg, #f7fbff 0%, #eef5ff 100%)',
                  border: '1px solid #dfe9fa',
                  padding: 18,
                }}
              >
                <div style={{fontSize: 11, fontWeight: 850, letterSpacing: 0.8, color: '#536079'}}>
                  DESTINATION
                </div>
                <div
                  style={{
                    marginTop: 10,
                    padding: '14px 14px 12px',
                    borderRadius: 14,
                    background: '#fff',
                    border: '1px solid rgba(28,114,255,0.08)',
                  }}
                >
                  <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: '#ebf2ff',
                        display: 'grid',
                        placeItems: 'center',
                        color: BLUE,
                      }}
                    >
                      <Monitor size={20} />
                    </div>
                    <div>
                      <div style={{fontWeight: 850, color: '#14213a', fontSize: 13}}>Lobby Display</div>
                      <div style={{fontSize: 11, color: '#8b98ab', marginTop: 2}}>Main reception / New screen</div>
                    </div>
                  </div>
                  <div style={{marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10}}>
                    {[
                      ['Workspace', 'Acme Global'],
                      ['Location', 'Reception zone'],
                      ['Security', 'Managed pairing'],
                    ].map(([label, value]) => (
                      <div key={label} style={{display: 'flex', justifyContent: 'space-between'}}>
                        <span style={{fontSize: 11, color: '#7c879b'}}>{label}</span>
                        <span style={{fontSize: 11, color: '#1f2e48', fontWeight: 700}}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                height: 56,
                borderRadius: 14,
                marginTop: 24,
                background: success > 0.2 ? '#20a967' : BLUE,
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 850,
                fontSize: 14,
                boxShadow:
                  success > 0.2
                    ? '0 14px 32px rgba(32,169,103,0.28)'
                    : '0 14px 32px rgba(23,104,229,0.24)',
                transform: `scale(${buttonScale})`,
              }}
            >
              {pairing ? (
                <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
                  <LoaderCircle
                    size={18}
                    style={{transform: `rotate(${frame * 14}deg)`}}
                  />
                  Pairing screen...
                </div>
              ) : success > 0.2 ? (
                <div style={{display: 'flex', alignItems: 'center', gap: 9}}>
                  <Check size={19} strokeWidth={3} />
                  Screen paired
                </div>
              ) : (
                'Pair Screen'
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const WebPlayerContent: React.FC<{
  frame: number;
  timeline: Timeline;
}> = ({frame, timeline}) => {
  const focus = progress(frame, timeline.codeFocusStart, timeline.copyClick - 6);
  const connected = progress(frame, timeline.loadingStart + 18, timeline.successStart);
  const codeGlow = pulse(frame, timeline.copyClick - 4, 20);
  const copyTap = pulse(frame, timeline.copyClick, 7);
  const successPulse = pulse(frame, timeline.successStart + 4, 18);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        color: '#fff',
        background:
          'radial-gradient(circle at 50% 36%, #16447c 0%, #0b223f 46%, #050a14 100%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.2,
          backgroundImage:
            'linear-gradient(rgba(93,153,225,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(93,153,225,0.09) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
          transform: 'perspective(600px) rotateX(62deg) scale(1.8) translateY(230px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 55%, rgba(74,155,255,0.14), transparent 33%)',
          opacity: 0.55 + focus * 0.35,
        }}
      />

      <div style={{position: 'absolute', top: 34, left: 42, display: 'flex', alignItems: 'center', gap: 11}}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: 'linear-gradient(145deg,#1768e5,#61a0ff)',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 900,
          }}
        >
          N
        </div>
        <div style={{fontWeight: 850, letterSpacing: 0.4}}>
          NuExis <span style={{fontWeight: 500, color: '#7f9bbc'}}>Player</span>
        </div>
      </div>

      <div style={{position: 'absolute', top: 34, right: 42, display: 'flex', gap: 10}}>
        {['Secure', 'Managed', 'Always on'].map((label) => (
          <div
            key={label}
            style={{
              padding: '8px 12px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
              fontSize: 11,
              color: '#bbcee6',
              fontWeight: 700,
            }}
          >
            {label}
          </div>
        ))}
      </div>

      <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center'}}>
        <div
          style={{
            textAlign: 'center',
            transform: `translateY(${-connected * 12}px) scale(${1 - connected * 0.04})`,
            opacity: 1 - connected,
          }}
        >
          <div style={{fontSize: 12, letterSpacing: 2.7, color: '#8aa8cb', fontWeight: 800}}>
            PAIR THIS DISPLAY
          </div>
          <div style={{fontSize: 30, fontWeight: 850, marginTop: 16}}>Connect to your workspace</div>
          <div style={{fontSize: 14, color: '#8da1bc', marginTop: 9}}>
            Copy this code into the Add Screen flow in NuExis CMS.
          </div>

          <div
            style={{
              margin: '34px auto 0',
              width: 420,
              borderRadius: 24,
              border: `1px solid rgba(115,174,255,${0.28 + focus * 0.2})`,
              background: 'rgba(8,24,47,0.66)',
              backdropFilter: 'blur(18px)',
              boxShadow: `0 26px 74px rgba(0,0,0,0.35), 0 0 ${34 + codeGlow * 20}px rgba(65,146,255,${0.38 + codeGlow * 0.24})`,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '18px 20px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div style={{fontSize: 11, letterSpacing: 1.4, fontWeight: 800, color: '#9ab7da'}}>
                ONE-TIME PAIRING CODE
              </div>
              <div
                style={{
                  height: 36,
                  padding: '0 12px',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: `rgba(77,199,255,${0.10 + codeGlow * 0.12})`,
                  border: `1px solid rgba(77,199,255,${0.18 + codeGlow * 0.2})`,
                  transform: `scale(${1 - copyTap * 0.05})`,
                }}
              >
                <Copy size={15} />
                <span style={{fontSize: 11, fontWeight: 800}}>Copy code</span>
              </div>
            </div>
            <div
              style={{
                height: 126,
                display: 'grid',
                placeItems: 'center',
                fontSize: 42,
                fontWeight: 900,
                letterSpacing: 10,
              }}
            >
              {PLAYER_CODE}
            </div>
          </div>

          <div style={{marginTop: 22, color: '#7691b0', fontSize: 12}}>
            Code refreshes in <span style={{color: '#b5cae3'}}>04:52</span>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          opacity: connected,
          transform: `scale(${0.93 + connected * 0.07})`,
        }}
      >
        <div style={{textAlign: 'center'}}>
          <div
            style={{
              width: 102,
              height: 102,
              margin: '0 auto',
              borderRadius: 52,
              background: 'rgba(44,204,125,0.12)',
              border: '1px solid rgba(69,224,147,0.42)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: `0 0 ${70 + successPulse * 22}px rgba(45,211,129,0.26)`,
            }}
          >
            <Check size={48} color="#4ade80" strokeWidth={2.7} />
          </div>
          <div style={{fontSize: 28, fontWeight: 850, marginTop: 26}}>Display connected</div>
          <div style={{fontSize: 14, color: '#8da5c3', marginTop: 9}}>
            Linked to Acme Global. Ready to receive content from NuExis CMS.
          </div>
          <div style={{display: 'flex', justifyContent: 'center', gap: 14, marginTop: 24}}>
            {([
              [Wifi, 'Online'],
              [ShieldCheck, 'Trusted'],
              [Link2, 'Managed'],
            ] as const).map(([Icon, label]) => (
              <div
                key={label}
                style={{
                  display: 'inline-flex',
                  padding: '10px 14px',
                  borderRadius: 20,
                  background: 'rgba(42,194,116,0.1)',
                  color: '#63e6a2',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                <Icon size={14} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const Cursor: React.FC<{
  frame: number;
  points: CursorPoint[];
  clickFrames: number[];
}> = ({frame, points, clickFrames}) => {
  let from = points[0];
  let to = points[1];

  for (let index = 0; index < points.length - 1; index += 1) {
    if (frame >= points[index].frame && frame <= points[index + 1].frame) {
      from = points[index];
      to = points[index + 1];
      break;
    }
    if (frame > points[points.length - 1].frame) {
      from = points[points.length - 2];
      to = points[points.length - 1];
    }
  }

  const segment = progress(frame, from.frame, to.frame, easeInOut);
  const x = lerp(from.x, to.x, segment);
  const y = lerp(from.y, to.y, segment);
  const rotate = lerp(from.rotate, to.rotate, segment);
  const clickPulse = Math.max(...clickFrames.map((clickFrame) => pulse(frame, clickFrame, 9)));
  const velocityX = to.x - from.x;
  const velocityY = to.y - from.y;
  const blurStrength = Math.min(10, Math.hypot(velocityX, velocityY) / 42) * segment * (1 - segment);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        zIndex: 60,
        pointerEvents: 'none',
        transform: `rotate(${rotate}deg)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: 'translate(-4px, -2px)',
          opacity: Math.min(0.26, blurStrength / 24),
          filter: 'blur(10px)',
        }}
      >
        <svg width="30" height="37" viewBox="0 0 28 34">
          <path
            d="M2 1.5L25 22.5L14.2 23.8L9 32L2 1.5Z"
            fill="rgba(98,186,255,0.9)"
            stroke="rgba(98,186,255,0.45)"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div
        style={{
          position: 'absolute',
          width: 54,
          height: 54,
          borderRadius: 27,
          border: `2px solid rgba(66,142,255,${clickPulse * 0.65})`,
          transform: `translate(-18px,-18px) scale(${0.35 + clickPulse * 1.15})`,
          opacity: clickPulse,
        }}
      />
      <svg
        width="30"
        height="37"
        viewBox="0 0 28 34"
        style={{filter: 'drop-shadow(0 5px 10px rgba(0,0,0,0.28))'}}
      >
        <path
          d="M2 1.5L25 22.5L14.2 23.8L9 32L2 1.5Z"
          fill="white"
          stroke="#10213a"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export const ScreenPairingOnboarding: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const timeline = getTimeline(fps);

  const split = progress(frame, timeline.splitStart, timeline.splitEnd, easeInOut);
  const banner = progress(frame, timeline.bannerStart, timeline.bannerStart + 28, overshoot);
  const outro = progress(frame, timeline.outroStart, timeline.total - 1, easeInOut);
  const zoomOut = progress(frame, timeline.modalCloseStart, timeline.total - 1, easeInOut);

  const introRect: Rect = {x: 0, y: 0, width: 1920, height: 1080};
  const leftRect: Rect = {x: 64, y: 116, width: 862, height: 538};
  const rightRect: Rect = {x: 994, y: 116, width: 862, height: 538};
  const rightOffscreen: Rect = {x: 1980, y: 128, width: 862, height: 538};
  const currentCmsRect = mixRect(introRect, leftRect, split);
  const currentPlayerRect = mixRect(rightOffscreen, rightRect, split);

  const getCmsRectAt = (value: number) =>
    mixRect(
      introRect,
      leftRect,
      progress(value, timeline.splitStart, timeline.splitEnd, easeInOut),
    );
  const getPlayerRectAt = (value: number) =>
    mixRect(
      rightOffscreen,
      rightRect,
      progress(value, timeline.splitStart, timeline.splitEnd, easeInOut),
    );

  const pointAt = (
    value: number,
    panel: 'cms' | 'player',
    mode: 'contain' | 'cover',
    localX: number,
    localY: number,
    rotate: number,
  ): CursorPoint => {
    const mapped =
      panel === 'cms'
        ? mapPoint(getCmsRectAt(value), mode, localX, localY)
        : mapPoint(getPlayerRectAt(value), mode, localX, localY);
    return {frame: value, x: mapped.x, y: mapped.y, rotate};
  };

  const cursorPoints: CursorPoint[] = [
    pointAt(0, 'cms', 'cover', 1100, 220, -8),
    pointAt(timeline.addClick - 16, 'cms', 'cover', 1408, 146, -8),
    pointAt(timeline.addClick, 'cms', 'cover', 1436, 146, -7),
    pointAt(timeline.modalEnd + 10, 'cms', 'cover', 1180, 300, -10),
    pointAt(timeline.codeFocusStart + 8, 'player', 'contain', 1030, 526, -4),
    pointAt(timeline.copyClick, 'player', 'contain', 1180, 402, -2),
    pointAt(timeline.returnStart + 12, 'player', 'contain', 980, 590, -8),
    pointAt(timeline.pasteStart, 'cms', 'contain', 812, 492, -10),
    pointAt(timeline.pasteEnd, 'cms', 'contain', 930, 492, -10),
    pointAt(timeline.pairClick, 'cms', 'contain', 804, 782, -11),
    pointAt(timeline.successStart - 6, 'cms', 'contain', 1120, 628, -2),
    pointAt(timeline.modalCloseStart + 18, 'cms', 'contain', 1300, 256, -8),
    {frame: timeline.total - 1, x: 1770, y: 950, rotate: -6},
  ];

  const introCamera = progress(frame, 0, timeline.modalStart - 6, easeInOut);
  const backgroundFloat = Math.sin(frame / 42) * 8;
  const cmsRadius = interpolate(split, [0, 1], [0, 26], clamp);
  const cmsScale = lerp(1.06, 1, introCamera) * lerp(1, 0.985, zoomOut);
  const playerScale = lerp(0.94, 1, split) * lerp(1, 0.985, zoomOut);
  const splitBlur = Math.sin(split * Math.PI) * 6;
  const playerOpacity = interpolate(split, [0, 0.15, 1], [0, 0.35, 1], clamp);
  const cmsMotionY = lerp(0, -12, zoomOut);
  const playerMotionY = lerp(0, -12, zoomOut);

  const connection = progress(frame, timeline.loadingStart + 10, timeline.successStart - 2);
  const connectionFade = 1 - progress(frame, timeline.successStart + 12, timeline.successStart + 28);
  const successPulse = pulse(frame, timeline.successStart + 2, 22);

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(180deg, #0d1930 0%, #09111f 52%, #050910 100%)',
        fontFamily: '"Public Sans", "Aptos", "Segoe UI", sans-serif',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: -120,
          background:
            'radial-gradient(circle at 18% 18%, rgba(53,108,255,0.35), transparent 30%), radial-gradient(circle at 82% 12%, rgba(49,195,255,0.22), transparent 24%), radial-gradient(circle at 50% 100%, rgba(34,197,94,0.16), transparent 30%)',
          transform: `translateY(${backgroundFloat}px) scale(${1.02 + outro * 0.02})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.16,
          backgroundImage:
            'linear-gradient(rgba(164,188,255,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(164,188,255,0.16) 1px, transparent 1px)',
          backgroundSize: '120px 120px',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 44,
          transform: `translateX(-50%) translateY(${(1 - banner) * -10}px)`,
          opacity: 0.72 + banner * 0.28,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 16px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#c7d6ea',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 1.3,
        }}
      >
        <Link2 size={14} />
        SCREEN PAIRING WORKFLOW
      </div>

      <div style={panelStyle(currentCmsRect, {radius: cmsRadius, blur: splitBlur, translateY: cmsMotionY, scale: cmsScale})}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `scale(${currentCmsRect.width / 1920})`,
            transformOrigin: 'top left',
            width: 1920,
            height: 1080,
          }}
        >
          <CmsContent frame={frame} timeline={timeline} />
        </div>
      </div>

      <div
        style={panelStyle(currentPlayerRect, {
          radius: 26,
          opacity: playerOpacity,
          blur: splitBlur + Math.sin(split * Math.PI) * 1.5,
          translateY: playerMotionY + interpolate(split, [0, 1], [18, 0], clamp),
          scale: playerScale,
        })}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `scale(${currentPlayerRect.width / 1920})`,
            transformOrigin: 'top left',
            width: 1920,
            height: 1080,
          }}
        >
          <WebPlayerContent frame={frame} timeline={timeline} />
        </div>
      </div>

      {split > 0.25 && connectionFade > 0 && (
        <>
          <div
            style={{
              position: 'absolute',
              left: 920,
              top: 386,
              width: 90,
              height: 2,
              opacity: connection * connectionFade,
              background:
                'linear-gradient(90deg, rgba(71,135,255,0), rgba(71,135,255,0.55), rgba(77,199,255,0.65), rgba(77,199,255,0))',
              boxShadow: '0 0 20px rgba(77,199,255,0.4)',
            }}
          />
          {[0, 0.22, 0.5, 0.78].map((offset, index) => (
            <div
              key={offset}
              style={{
                position: 'absolute',
                left: 920 + interpolate((connection + offset) % 1, [0, 1], [0, 72], clamp),
                top: 382 + Math.sin((frame + index * 4) / 8) * 1.8,
                width: 10 + successPulse * 2,
                height: 10 + successPulse * 2,
                borderRadius: 999,
                opacity: connectionFade * (0.38 + connection * 0.62),
                background: index % 2 === 0 ? '#79d3ff' : '#7ab5ff',
                boxShadow:
                  index % 2 === 0
                    ? '0 0 18px rgba(121,211,255,0.72)'
                    : '0 0 18px rgba(122,181,255,0.72)',
              }}
            />
          ))}
        </>
      )}

      <Cursor
        frame={frame}
        points={cursorPoints}
        clickFrames={[timeline.addClick, timeline.copyClick, timeline.pairClick]}
      />

      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 84,
          transform: `translateX(-50%) translateY(${(1 - banner) * 28}px) scale(${0.96 + banner * 0.04})`,
          opacity: banner,
          textAlign: 'center',
          color: '#fff',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 9,
            padding: '9px 14px',
            borderRadius: 999,
            background: 'rgba(52,211,153,0.12)',
            border: '1px solid rgba(89,234,177,0.22)',
            fontSize: 11,
            fontWeight: 850,
            letterSpacing: 1.5,
            color: '#76edb7',
          }}
        >
          <Check size={14} />
          SCREEN SUCCESSFULLY PAIRED
        </div>
        <div style={{fontSize: 42, fontWeight: 900, letterSpacing: -1.2, marginTop: 18}}>
          Ready to Push Content
        </div>
        <div style={{fontSize: 15, color: '#8da5c2', marginTop: 10}}>
          The display is online, trusted, and fully linked to your CMS.
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 34,
          bottom: 28,
          color: 'rgba(166,190,220,0.62)',
          fontSize: 11,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        NuExis Digital Signage <ChevronRight size={12} />
      </div>
    </AbsoluteFill>
  );
};
