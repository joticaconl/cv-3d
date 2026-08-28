import { Suspense, useState, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, useTexture, Decal, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Upload, Image as ImageIcon, ChevronRight, Check, X, Copy, QrCode, Moon, Sun, Globe } from 'lucide-react';

// TRANSLATIONS
const T = {
  es: {
    campaign: 'Campaña abierta · 🇻🇪 Global',
    title: ['¿Dónde vas a colocar', 'Tu marca', 'en mi CV?'],
    desc: 'No te voy a vender mi CV, pero quiero que me conozcas y créeme que yo también quiero conocerte. Estoy construyendo un servicio SaaS para un mercado americano y me gustaría aprender y crecer profesionalmente en startups en Venezuela. Si mi perfil resuena contigo, hablemos. Más que pedirte, te traje hasta aquí porque quiero trabajar. Si en tu startup hace falta una persona como yo, puedes agendar una llamada en mi Cal.com. Gracias por contribuir a lo que es para mí un financiamiento micro-semilla.',
    btnTake: 'Tomar un espacio desde $10 ↗',
    btnCancel: 'Cancelar Colocación',
    stats: { raised: 'Raised', sponsors: 'Sponsors', surface: 'Surface used' },
    ranking: 'Ranking',
    step1: 'Design', step2: 'Size & Spot',
    designTitle: 'Crea tu Sticker',
    logoLabel: 'Logo / Archivo (PNG, SVG, JPG)',
    uploadBtn: 'Subir archivo',
    textLabel: 'Texto de tu marca / social',
    fontLabel: 'Tipografía',
    bgLabel: 'Color de fondo',
    shapeLabel: 'Sticker Backing (Corte)',
    btnConfirmDesign: 'Confirmar Diseño',
    sizeTitle: 'Ubicación y Tamaño',
    sizeLabel: 'Tamaño (Impacto) y Aporte',
    tuneLabel: 'Fine tuning (Posición)',
    tiltLabel: 'Tilt (Rotación)',
    btnReview: 'Review and pay',
    uniquePay: 'Único pago, por siempre en el ranking.',
    clickCV: 'Click en el CV para ubicar tu sticker'
  },
  en: {
    campaign: 'Open Campaign · 🇻🇪 Global',
    title: ['Where will you place', 'Your brand', 'on my CV?'],
    desc: 'I\'m not going to sell you my CV, but I want you to know me and believe me, I want to know you too. I am building a SaaS service for an American market and I would like to learn and grow professionally in startups in Venezuela. If my profile resonates with you, let\'s talk. More than asking, I brought you here because I want to work. If your startup needs someone like me, you can book a call on my Cal.com. Thank you for contributing to what is a micro-seed funding for me.',
    btnTake: 'Grab a spot from $10 ↗',
    btnCancel: 'Cancel Placement',
    stats: { raised: 'Raised', sponsors: 'Sponsors', surface: 'Surface used' },
    ranking: 'Ranking',
    step1: 'Design', step2: 'Size & Spot',
    designTitle: 'Design your Sticker',
    logoLabel: 'Logo / File (PNG, SVG, JPG)',
    uploadBtn: 'Upload file',
    textLabel: 'Brand / Social text',
    fontLabel: 'Font style',
    bgLabel: 'Background Color',
    shapeLabel: 'Sticker Backing (Shape)',
    btnConfirmDesign: 'Confirm Design',
    sizeTitle: 'Spot, Size & Contribution',
    sizeLabel: 'Size (Impact) & Amount',
    tuneLabel: 'Fine tuning (Position)',
    tiltLabel: 'Tilt (Rotation)',
    btnReview: 'Review and pay',
    uniquePay: 'One-time payment, forever on the ranking.',
    clickCV: 'Click on the CV to place your sticker'
  }
};

const FONTS = ['sans-serif', 'serif', 'monospace', 'Impact', 'Comic Sans MS'];
const COLORS = ['rgba(240,240,240,0.95)', '#fcd535', '#f43f5e', '#3b82f6', '#10b981', '#09090b'];

// --- CUSTOM HOOK FOR STICKER TEXTURE ---
function useCustomStickerTexture(shape: string, text: string, imageUrl: string | null, font: string, bgColor: string) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // Background Shape
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    if (shape === 'circle') ctx.arc(256, 256, 240, 0, Math.PI * 2);
    else if (shape === 'square') ctx.rect(40, 40, 432, 432);
    else if (shape === 'rect') ctx.rect(20, 150, 472, 212);
    ctx.fill();

    // Border
    ctx.setLineDash([25, 20]);
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(120, 120, 120, 0.4)';
    ctx.stroke();

    const applyTexture = () => {
      const tex = new THREE.CanvasTexture(canvas);
      tex.anisotropy = 16;
      tex.needsUpdate = true;
      setTexture(tex);
    };

    if (imageUrl) {
      const img = new window.Image();
      img.src = imageUrl;
      img.onload = () => {
        ctx.save();
        if (shape === 'circle') { ctx.beginPath(); ctx.arc(256, 256, 240, 0, Math.PI * 2); ctx.clip(); } 
        else if (shape === 'square') { ctx.beginPath(); ctx.rect(40, 40, 432, 432); ctx.clip(); } 
        else if (shape === 'rect') { ctx.beginPath(); ctx.rect(20, 150, 472, 212); ctx.clip(); }
        
        const scale = Math.max(350 / img.width, 350 / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, 256 - w/2, 256 - h/2, w, h);
        ctx.restore();
        applyTexture();
      };
      img.onerror = () => {
        ctx.fillStyle = '#ff0000';
        ctx.fillText('IMG ERROR', 256, 256);
        applyTexture();
      };
    } else {
      ctx.fillStyle = bgColor === '#09090b' ? '#ffffff' : '#09090b';
      ctx.font = `bold 50px ${font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text || 'TU LOGO', 256, 256);
      applyTexture();
    }
  }, [shape, text, imageUrl, font, bgColor]);

  return texture;
}

// --- COMPONENTS ---
function InteractiveSticker({ position, rotation, scale, shape, text, imageUrl, isYummy = false, yummyTex, zIndex, onHover, name, font, bgColor }: any) {
  const [hovered, setHovered] = useState(false);
  const customTex = useCustomStickerTexture(shape, text, imageUrl, font, bgColor);
  
  const texture = isYummy ? yummyTex : customTex;
  if (!texture) return null;

  return (
    <Decal
      position={position}
      rotation={rotation}
      scale={scale}
      onPointerOver={() => { setHovered(true); if(onHover) onHover(name); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); if(onHover) onHover(null); document.body.style.cursor = 'auto'; }}
      onClick={(e) => { e.stopPropagation(); alert(`Sponsor: ${name}`); }}
    >
      <meshStandardMaterial map={texture} transparent polygonOffset polygonOffsetFactor={-zIndex} roughness={0.5} emissive={hovered ? "#333333" : "#000000"} />
    </Decal>
  );
}

function CVSheet({ placementMode, onPlaceSticker, stickers, setHoveredSticker, pendingSticker, lang }: any) {
  const { gl } = useThree();
  const [cvEsTex, cvEnTex, yummyTex] = useTexture(['/cv.png', '/cv-en.png', '/yummy.png']);
  const cvTex = lang === 'en' ? cvEnTex : cvEsTex;
  
  useEffect(() => {
    const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
    cvEsTex.anisotropy = maxAnisotropy;
    cvEnTex.anisotropy = maxAnisotropy;
    cvEsTex.needsUpdate = true;
    cvEnTex.needsUpdate = true;
  }, [cvEsTex, cvEnTex, gl]);
  
  const width = 3;
  const height = 4.24;
  const depth = 0.02;

  const pendingTex = useCustomStickerTexture(pendingSticker?.shape, pendingSticker?.name, pendingSticker?.image, pendingSticker?.font, pendingSticker?.bgColor);

  const handlePointerDown = (e: any) => {
    if (!placementMode) return;
    if (e.point.z < 0) {
      e.stopPropagation();
      onPlaceSticker({ x: e.point.x, y: e.point.y });
    }
  };

  return (
    <mesh castShadow receiveShadow onPointerDown={handlePointerDown}>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial attach="material-0" color="#f0f0f0" />
      <meshStandardMaterial attach="material-1" color="#f0f0f0" />
      <meshStandardMaterial attach="material-2" color="#f0f0f0" />
      <meshStandardMaterial attach="material-3" color="#f0f0f0" />
      <meshStandardMaterial attach="material-4" map={cvTex} roughness={0.5} />
      <meshStandardMaterial attach="material-5" color="#fafafa" roughness={0.9} />

      {stickers.filter((s: any) => s.status === 'approved' || s.id === 'yummy').map((spot: any) => (
        <InteractiveSticker
          key={spot.id}
          position={[spot.x, spot.y, -depth / 2]}
          rotation={[0, Math.PI, spot.rot]}
          scale={spot.isYummy ? [1, 1 * ((yummyTex as any).image.height / (yummyTex as any).image.width), 0.005] : spot.scale}
          shape={spot.shape}
          text={spot.name}
          imageUrl={spot.image}
          font={spot.font}
          bgColor={spot.bgColor}
          isYummy={spot.isYummy}
          yummyTex={yummyTex}
          name={spot.name}
          zIndex={spot.zIndex}
          onHover={setHoveredSticker}
        />
      ))}

      {placementMode && pendingSticker && pendingTex && (
        <Decal
          position={[pendingSticker.x, pendingSticker.y, -depth / 2]}
          rotation={[0, Math.PI, pendingSticker.rot]}
          scale={[pendingSticker.scale, pendingSticker.scale, 0.005]}
        >
          <meshStandardMaterial map={pendingTex} transparent polygonOffset polygonOffsetFactor={-1000} emissive="#333" />
        </Decal>
      )}
    </mesh>
  );
}

// --- APP ---
function App() {
  const [stickers, setStickers] = useState<any[]>([]);
  const [hoveredSticker, setHoveredSticker] = useState<string | null>(null);

  // GLOBAL STATE
  const [lang, setLang] = useState<'es'|'en'>('es');
  const [theme, setTheme] = useState<'dark'|'light'>('dark');
  const t = T[lang];

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  // Fetch stickers
  useEffect(() => {
    fetch('/api/stickers')
      .then(r => r.json())
      .then(data => {
        const yummy = { id: 'yummy', name: 'Yummy Rides', x: 0, y: 0, rot: 0, scale: [1, 1, 0.005], isYummy: true, zIndex: 100, price: 25 };
        setStickers([yummy, ...data]);
      })
      .catch(() => {
        // Fallback if no backend
        setStickers([{ id: 'yummy', name: 'Yummy Rides', x: 0, y: 0, rot: 0, scale: [1, 1, 0.005], isYummy: true, zIndex: 100, price: 25 }]);
      });
  }, []);

  // PLACEMENT STATE
  const [placementMode, setPlacementMode] = useState(false);
  const [placementStep, setPlacementStep] = useState(1);
  const [pending, setPending] = useState({
    name: '', image: null as string | null, imageName: '', shape: 'square' as 'circle' | 'square' | 'rect', sizeType: 'M', x: 0, y: 0, rot: 0,
    font: 'sans-serif', bgColor: 'rgba(240,240,240,0.95)', customPrice: 15
  });
  
  const SIZES = {
    'S': { scale: 0.4, minPrice: 5, label: 'S' }, 'M': { scale: 0.6, minPrice: 10, label: 'M' },
    'L': { scale: 0.8, minPrice: 25, label: 'L' }, 'XL': { scale: 1.2, minPrice: 50, label: 'XL' },
  };
  const currentSizeObj = SIZES[pending.sizeType as keyof typeof SIZES];
  const totalRaised = stickers.reduce((acc, s) => acc + ((s.status === 'approved' || s.id === 'yummy') ? (s.price || 0) : 0), 0);
  const surfaceUsed = Math.min(100, stickers.filter(s => s.status === 'approved' || s.id === 'yummy').length * 5);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPending({ ...pending, image: url, imageName: file.name, name: '' });
    }
  };

  const handleCanvasClick = (pos: {x: number, y: number}) => {
    if (!placementMode || placementStep !== 2) return;
    setPending(prev => ({ ...prev, x: pos.x, y: pos.y }));
  };

  const handlePaymentConfirm = async () => {
    const newSticker = {
      id: Date.now().toString(),
      name: pending.name || pending.imageName || 'New Startup',
      image: pending.image, shape: pending.shape, font: pending.font, bgColor: pending.bgColor,
      x: pending.x, y: pending.y, rot: pending.rot,
      scale: [currentSizeObj.scale, currentSizeObj.scale, 0.005],
      zIndex: stickers.length + 1, price: Math.max(currentSizeObj.minPrice, pending.customPrice),
      status: 'pending' // Admin must approve
    };

    // Attempt to send to backend
    try {
      await fetch('/api/stickers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSticker)
      });
      setStickers([...stickers, newSticker]);
    } catch (e) {
      // Offline fallback
      setStickers([...stickers, { ...newSticker, status: 'approved' }]);
    }

    setPlacementMode(false); setPlacementStep(1);
    setPending({ name: '', image: null, imageName: '', shape: 'square', sizeType: 'M', x: 0, y: 0, rot: 0, font: 'sans-serif', bgColor: 'rgba(240,240,240,0.95)', customPrice: 10 });
    alert('¡Tu sticker ha sido reservado! Se mostrará una vez se confirme el pago.');
  };

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans transition-colors duration-300">
      
      {/* LEFT PANEL */}
      <div className="w-[30%] max-w-[500px] h-full flex flex-col p-8 lg:p-12 z-10 border-r border-border bg-background relative">
        
        {/* Global Controls */}
        <div className="absolute top-6 right-6 flex items-center gap-3">
          <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')} className="flex items-center gap-1.5 text-xs font-bold text-muted hover:text-foreground transition-colors bg-panel px-3 py-1.5 rounded-full border border-border shadow-sm">
            <Globe size={14} /> {lang === 'es' ? 'ES' : 'EN'}
          </button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-muted hover:text-foreground transition-colors bg-panel p-1.5 rounded-full border border-border shadow-sm">
            {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>

        <div className="text-accent text-[10px] font-extrabold mb-6 uppercase tracking-[0.15em] flex items-center gap-2 bg-panel w-max px-3 py-1.5 rounded-full border border-border shadow-sm mt-8 sm:mt-0">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping absolute" />
          <span className="w-1.5 h-1.5 rounded-full bg-accent relative" />
          {t.campaign}
        </div>

        <h1 className="text-4xl lg:text-[2.6rem] font-black leading-[1.05] tracking-tight mb-8 text-foreground">
          {t.title[0]} <span className="text-accent">{t.title[1]}</span> {t.title[2]}
        </h1>

        <p className="text-muted text-sm lg:text-[15px] leading-relaxed mb-10 font-medium">
          {t.desc}
        </p>

        <div className="flex flex-col gap-4 mb-10 w-full sm:w-auto">
          {!placementMode ? (
            <div className="golden-border rounded-xl">
              <button onClick={() => { setPlacementMode(true); setPlacementStep(1); }} className="w-full px-7 py-3.5 rounded-xl font-bold transition-all duration-300 transform-gpu hover:-translate-y-0.5 active:scale-[0.98] bg-background hover:bg-panel text-foreground golden-glow">
                {t.btnTake}
              </button>
            </div>
          ) : (
            <button onClick={() => { setPlacementMode(false); setPlacementStep(1); }} className="w-full px-7 py-3.5 rounded-xl font-bold transition-all bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20">
              {t.btnCancel}
            </button>
          )}
          <div className="flex justify-center items-center gap-3 text-xs mt-2 font-medium">
            <a href="https://cal.com/joticaconl/30min?overlayCalendar=true" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-foreground underline decoration-dotted underline-offset-4 transition-colors">
              Agendar en Cal.com
            </a>
            <span className="text-muted opacity-50">•</span>
            <a href="https://www.linkedin.com/in/jotaconl/" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-foreground underline decoration-dotted underline-offset-4 transition-colors">
              LinkedIn
            </a>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-px bg-border border border-border rounded-xl overflow-hidden mt-auto shadow-lg">
          <div className="bg-panel p-4 flex flex-col justify-center items-center text-center">
            <div className="text-[10px] text-muted mb-1 font-bold uppercase tracking-wider">{t.stats.raised}</div>
            <div className="text-lg font-black font-mono text-accent">${totalRaised.toLocaleString()}</div>
          </div>
          <div className="bg-panel p-4 flex flex-col justify-center items-center text-center">
            <div className="text-[10px] text-muted mb-1 font-bold uppercase tracking-wider">{t.stats.sponsors}</div>
            <div className="text-lg font-black font-mono">{stickers.filter(s => s.status === 'approved' || s.id === 'yummy').length}</div>
          </div>
          <div className="bg-panel p-4 flex flex-col justify-center items-center text-center">
            <div className="text-[10px] text-muted mb-1 font-bold uppercase tracking-wider">{t.stats.surface}</div>
            <div className="text-lg font-black font-mono">{surfaceUsed}%</div>
          </div>
        </div>
      </div>

      {/* CENTER CANVAs */}
      <div className={`flex-1 relative cursor-grab active:cursor-grabbing ${theme === 'dark' ? 'bg-[#09090b]' : 'bg-white'}`}>
        {placementMode && placementStep === 2 && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-accent text-black px-6 py-2.5 rounded-full font-bold z-20 shadow-[0_0_20px_rgba(245,158,11,0.5)] pointer-events-none animate-pulse">
            {t.clickCV}
          </div>
        )}
        {hoveredSticker && !placementMode && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-5 py-2 rounded-full font-bold z-20 text-white border border-border shadow-lg">
            Mirando: <span className="text-accent">{hoveredSticker}</span>
          </div>
        )}
        <Canvas camera={{ position: [0, 0, 5], fov: 50 }} shadows>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 10]} intensity={1} castShadow />
          <directionalLight position={[-10, -10, -10]} intensity={0.5} />
          <Environment preset="city" />
          <Suspense fallback={null}>
            <CVSheet placementMode={placementMode && placementStep === 2} onPlaceSticker={handleCanvasClick} stickers={stickers} setHoveredSticker={setHoveredSticker} pendingSticker={placementMode ? { ...pending, scale: currentSizeObj.scale } : null} lang={lang} />
          </Suspense>
          <OrbitControls makeDefault autoRotate={!placementMode && !hoveredSticker} autoRotateSpeed={0.5} enablePan={false} />
        </Canvas>
      </div>

      {/* RIGHT PANEL - DYNAMIC */}
      <div className="w-[30%] max-w-[450px] h-full bg-background border-l border-border flex flex-col relative z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.05)]">
        {!placementMode ? (
          <div className="p-6 lg:p-8 overflow-y-auto h-full">
            <h2 className="text-accent font-black text-sm tracking-widest uppercase mb-8">{t.ranking}</h2>
            <div className="space-y-4">
              {[...stickers].filter(s => s.status === 'approved' || s.id === 'yummy').sort((a, b) => b.price - a.price).map((s, idx) => {
                const isFirst = idx === 0;
                return (
                  <div key={s.id} className={`relative flex items-center gap-4 p-3.5 rounded-xl border bg-panel hover:border-gray-400 transition-colors cursor-pointer group shadow-sm ${isFirst ? 'border-accent/50' : 'border-border'}`}>
                    {isFirst && <div className="absolute inset-0 rounded-xl shadow-[0_0_15px_-3px_rgba(245,158,11,0.2)] pointer-events-none" />}
                    <div className={`font-black text-sm w-6 text-center font-mono ${isFirst ? 'text-accent' : 'text-muted'}`}>#{idx + 1}</div>
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center overflow-hidden shrink-0 p-1 shadow-inner">
                      {s.id === 'yummy' ? <img src="/yummy.png" alt="Yummy" className="w-full h-full object-contain" /> : <div className="w-full h-full bg-gray-100 rounded flex items-center justify-center text-[9px] text-zinc-800 font-black text-center leading-none">{s.name}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[15px] truncate text-foreground">{s.name}</div>
                      <div className="text-xs text-muted mt-1 font-medium flex items-center gap-1.5">Aporte <span className="opacity-40">·</span> <span>${s.price?.toLocaleString()}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full bg-panel">
            <div className="p-6 lg:p-8 flex-1 overflow-y-auto">
              <div className="flex items-center gap-2 text-xs font-bold mb-8">
                <button onClick={() => setPlacementStep(1)} className={`flex items-center gap-1 ${placementStep >= 1 ? 'text-accent' : 'text-muted'}`}>{placementStep > 1 && <Check size={14} />} {t.step1}</button>
                <ChevronRight size={14} className="text-muted" />
                <button onClick={() => setPlacementStep(2)} disabled={placementStep < 2} className={`flex items-center gap-1 ${placementStep >= 2 ? 'text-accent' : 'text-muted'}`}>{placementStep > 2 && <Check size={14} />} {t.step2}</button>
              </div>

              {placementStep === 1 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <h2 className="text-2xl font-black mb-6 text-foreground">{t.designTitle}</h2>
                  
                  {/* Image Upload */}
                  <div className="mb-6">
                    <label className="block text-xs font-bold text-muted mb-2 uppercase tracking-wider">{t.logoLabel}</label>
                    <label className="flex items-center justify-center gap-3 w-full border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-accent hover:bg-accent/5 transition-colors group">
                      <input type="file" accept="image/png, image/jpeg, image/svg+xml" className="hidden" onChange={handleImageUpload} />
                      <Upload className="text-muted group-hover:text-accent transition-colors" />
                      <span className="text-sm font-bold text-muted group-hover:text-foreground">{t.uploadBtn}</span>
                    </label>
                    {pending.image && (
                      <div className="mt-3 flex items-center gap-2 bg-background p-3 rounded-lg border border-border">
                        <ImageIcon size={18} className="text-accent" />
                        <span className="text-sm truncate flex-1 font-medium text-foreground">{pending.imageName || 'My file'}</span>
                        <button onClick={() => setPending({...pending, image: null, imageName: ''})} className="text-muted hover:text-red-400"><X size={18} /></button>
                      </div>
                    )}
                  </div>

                  {/* Text Input (Disabled if Image) */}
                  <div className={`mb-6 transition-opacity ${pending.image ? 'opacity-50 pointer-events-none' : ''}`}>
                    <label className="block text-xs font-bold text-muted mb-2 uppercase tracking-wider">{t.textLabel}</label>
                    <input type="text" value={pending.name} onChange={(e) => setPending({...pending, name: e.target.value})} disabled={!!pending.image} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground outline-none focus:border-accent transition-colors font-medium" placeholder="@usuario" />
                  </div>

                  {/* Customization (Font & Bg) ONLY if text */}
                  {!pending.image && (
                    <div className="flex gap-4 mb-6">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-muted mb-2 uppercase tracking-wider">{t.fontLabel}</label>
                        <select value={pending.font} onChange={(e) => setPending({...pending, font: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3 py-3 text-foreground outline-none focus:border-accent font-medium appearance-none">
                          {FONTS.map(f => <option key={f} value={f} style={{fontFamily: f}}>{f}</option>)}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-muted mb-2 uppercase tracking-wider">{t.bgLabel}</label>
                        <div className="flex gap-2 p-2 border border-border rounded-xl bg-background overflow-x-auto">
                          {COLORS.map(c => (
                            <button key={c} onClick={() => setPending({...pending, bgColor: c})} className={`w-8 h-8 rounded-full border-2 shrink-0 ${pending.bgColor === c ? 'border-accent' : 'border-transparent'}`} style={{backgroundColor: c}} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mb-8">
                    <label className="block text-xs font-bold text-muted mb-3 uppercase tracking-wider">{t.shapeLabel}</label>
                    <div className="flex gap-3">
                      {['square', 'circle', 'rect'].map(s => (
                        <button key={s} onClick={() => setPending({...pending, shape: s as any})} className={`flex-1 py-3 capitalize font-bold rounded-xl border transition-colors ${pending.shape === s ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-background text-muted hover:border-gray-500'}`}>{s}</button>
                      ))}
                    </div>
                  </div>

                  <button onClick={() => setPlacementStep(2)} disabled={!pending.name && !pending.image} className="w-full py-4 rounded-xl bg-accent text-[#09090b] font-black hover:bg-amber-400 disabled:opacity-50 transition-colors">{t.btnConfirmDesign}</button>
                </div>
              )}

              {placementStep === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <h2 className="text-2xl font-black mb-6 text-foreground">{t.sizeTitle}</h2>
                  <div className="mb-8">
                    <label className="block text-xs font-bold text-muted mb-3 uppercase tracking-wider">{t.sizeLabel}</label>
                    <div className="flex flex-col gap-3">
                      {(Object.keys(SIZES) as Array<keyof typeof SIZES>).map(size => {
                        const sObj = SIZES[size];
                        return (
                          <div key={size} className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${pending.sizeType === size ? 'border-accent bg-accent/10 text-foreground' : 'border-border bg-background text-muted hover:border-gray-400'}`}>
                            <div className="flex-1 cursor-pointer" onClick={() => setPending({...pending, sizeType: size, customPrice: Math.max(pending.customPrice, sObj.minPrice)})}>
                              <div className="font-black text-xl mb-1">{size}</div>
                              <div className="text-xs font-mono opacity-80">Min ${sObj.minPrice}</div>
                            </div>
                            {pending.sizeType === size && (
                              <div className="w-32 flex flex-col">
                                <span className="text-[10px] font-bold uppercase text-accent mb-1">Tu Aporte ($)</span>
                                <input type="number" min={sObj.minPrice} value={pending.customPrice} onChange={(e) => setPending({...pending, customPrice: Math.max(sObj.minPrice, parseInt(e.target.value) || sObj.minPrice)})} className="w-full bg-background border border-border text-foreground p-2 rounded outline-none focus:border-accent font-mono text-lg font-black" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mb-8">
                    <label className="block text-xs font-bold text-muted mb-3 uppercase tracking-wider">{t.tuneLabel}</label>
                    <div className="flex flex-col items-center gap-2 bg-background p-4 rounded-xl border border-border">
                      <button onClick={() => setPending(p => ({...p, y: p.y + 0.05}))} className="w-12 h-10 bg-panel border border-border rounded hover:bg-border flex items-center justify-center text-foreground">↑</button>
                      <div className="flex gap-2">
                        <button onClick={() => setPending(p => ({...p, x: p.x - 0.05}))} className="w-12 h-10 bg-panel border border-border rounded hover:bg-border flex items-center justify-center text-foreground">←</button>
                        <button onClick={() => setPending(p => ({...p, y: p.y - 0.05}))} className="w-12 h-10 bg-panel border border-border rounded hover:bg-border flex items-center justify-center text-foreground">↓</button>
                        <button onClick={() => setPending(p => ({...p, x: p.x + 0.05}))} className="w-12 h-10 bg-panel border border-border rounded hover:bg-border flex items-center justify-center text-foreground">→</button>
                      </div>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-accent uppercase tracking-wider">{t.tiltLabel}</label>
                      <span className="text-xs font-mono text-muted">{(pending.rot * (180 / Math.PI)).toFixed(0)}°</span>
                    </div>
                    <input type="range" min="-3.14" max="3.14" step="0.05" value={pending.rot} onChange={(e) => setPending({...pending, rot: parseFloat(e.target.value)})} className="w-full accent-accent h-2 bg-border rounded-lg appearance-none cursor-pointer" />
                  </div>
                </div>
              )}
            </div>
            
            {placementStep === 2 && (
              <div className="p-6 lg:p-8 bg-panel border-t border-border">
                <div className="text-3xl font-black font-mono mb-1 text-foreground">${pending.customPrice.toLocaleString()}</div>
                <div className="text-xs text-muted mb-4 font-medium">{t.uniquePay}</div>
                <button onClick={() => setPlacementStep(3)} className="w-full py-4 rounded-xl bg-accent text-[#09090b] font-black hover:bg-amber-400 transition-colors shadow-[0_0_15px_-3px_rgba(245,158,11,0.4)] text-lg">{t.btnReview}</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* STEP 3 - PAYMENT MODAL */}
      {placementStep === 3 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-white text-zinc-900 w-full max-w-[460px] rounded-[24px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="bg-[#1e1e1e] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-[#fcd535] p-2 rounded-lg text-black"><QrCode size={20} /></div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">Binance Pay (USDT)</h3>
                  <p className="text-xs text-gray-400">Pago seguro para posicionar a <span className="text-white font-bold">{pending.name || 'tu marca'}</span></p>
                </div>
              </div>
              <button onClick={() => setPlacementStep(2)} className="text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="border border-gray-200 rounded-2xl p-4 mb-6 shadow-sm bg-[#fafafa]">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-xs font-bold text-gray-500 mb-1 tracking-wider uppercase">Total a transferir</div>
                    <div className="text-3xl font-black font-mono tracking-tight">${pending.customPrice.toLocaleString()}</div>
                  </div>
                  <div className="bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border border-amber-200">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Red BEP20 / Pay ID
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Monto reservado exclusivamente: <span className="font-bold font-mono ml-auto">06:58 min</span>
                </div>
              </div>
              <div className="flex gap-4 mb-6 flex-col sm:flex-row">
                <div className="w-full sm:w-[160px] aspect-square bg-gray-50 rounded-2xl border border-gray-200 flex flex-col items-center justify-center shrink-0 overflow-hidden">
                  <img src="/qr.jpg" alt="Binance QR" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="border border-gray-200 rounded-xl p-3 flex justify-between items-center bg-white shadow-sm">
                    <div><div className="text-[10px] text-gray-500 font-bold mb-0.5">Binance ID:</div><div className="text-sm font-mono font-bold">35468080</div></div>
                    <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"><Copy size={12}/> Copiar</button>
                  </div>
                  <div className="border border-gray-200 rounded-xl p-3 bg-white shadow-sm">
                    <div className="text-[10px] text-gray-500 font-bold mb-0.5">Moneda / Red:</div>
                    <div className="text-sm font-bold font-mono">USDT (Binance Pay)</div>
                  </div>
                  <div className="border border-gray-200 rounded-xl p-3 flex justify-between items-center bg-white shadow-sm">
                    <div><div className="text-[10px] text-gray-500 font-bold mb-0.5">Monto Exacto:</div><div className="text-sm font-bold font-mono text-amber-600">{pending.customPrice.toLocaleString()} USDT</div></div>
                    <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"><Copy size={12}/> Copiar</button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">ID de Transacción / Order ID de Binance *</label>
                <input type="text" placeholder="Ej: 21398741029 o Pay Order ID" className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono" />
                <p className="text-[10px] text-gray-500 mt-2 font-medium">Esto es solo por si hay algún error en tu pago, para mayor agilidad.</p>
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button onClick={() => setPlacementStep(2)} className="flex-1 py-3.5 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors">Cancelar</button>
              <button onClick={handlePaymentConfirm} className="flex-1 py-3.5 rounded-xl bg-[#fcd535] text-black font-black hover:bg-[#e6c12c] transition-colors flex items-center justify-center gap-2"><Check size={18} /> Confirmar Pago</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
