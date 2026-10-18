import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Crop,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Check,
  X,
  RotateCcw,
  Move,
} from 'lucide-react';
import { useBodyScrollLock } from '../utils/scrollLock';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  onCropComplete: (croppedBase64: string) => void;
  onSkipCrop?: () => void;
  onClose: () => void;
}

const CROP_SIZE = 280; // Size of the square crop area in pixels
const OUTPUT_SIZE = 512; // High-resolution avatar output size

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageSrc,
  onCropComplete,
  onSkipCrop,
  onClose,
}) => {
  useBodyScrollLock(isOpen);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const offsetStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Load the image when modal opens or imageSrc changes
  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    setIsLoaded(false);
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      imgRef.current = img;
      setIsLoaded(true);
    };
  }, [isOpen, imageSrc]);

  // Compute base scaling so image covers the crop area
  const getBaseScale = useCallback((img: HTMLImageElement, rot: number) => {
    const isRotated = rot === 90 || rot === 270;
    const w = isRotated ? img.naturalHeight : img.naturalWidth;
    const h = isRotated ? img.naturalWidth : img.naturalHeight;
    return Math.max(CROP_SIZE / w, CROP_SIZE / h);
  }, []);

  // Redraw canvas whenever zoom, rotation, or offset changes
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !isLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);

    const baseScale = getBaseScale(img, rotation);
    const totalScale = baseScale * zoom;

    ctx.save();
    // Center of canvas + pan offset
    ctx.translate(CROP_SIZE / 2 + offset.x, CROP_SIZE / 2 + offset.y);
    ctx.rotate((rotation * Math.PI) / 180);

    const drawW = img.naturalWidth * totalScale;
    const drawH = img.naturalHeight * totalScale;

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Also update mini circular preview canvas
    const previewCanvas = previewCanvasRef.current;
    if (previewCanvas) {
      const pCtx = previewCanvas.getContext('2d');
      if (pCtx) {
        const pSize = previewCanvas.width;
        pCtx.clearRect(0, 0, pSize, pSize);
        pCtx.save();
        pCtx.beginPath();
        pCtx.arc(pSize / 2, pSize / 2, pSize / 2, 0, Math.PI * 2);
        pCtx.clip();
        pCtx.drawImage(canvas, 0, 0, pSize, pSize);
        pCtx.restore();
      }
    }
  }, [getBaseScale, isLoaded, offset, rotation, zoom]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Mouse & Touch Drag Handlers
  const handlePointerDown = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartRef.current = { x: clientX, y: clientY };
    offsetStartRef.current = { ...offset };
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    setOffset({
      x: offsetStartRef.current.x + dx,
      y: offsetStartRef.current.y + dy,
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((prev) => Math.min(3, Math.max(1, +(prev + delta).toFixed(2))));
  };

  // Rotate 90° Clockwise
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
    setOffset({ x: 0, y: 0 }); // Re-center on rotate
  };

  // Reset Position & Zoom
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  };

  // Generate cropped output canvas and export Base64 Data URL
  const handleApplyCrop = () => {
    const img = imgRef.current;
    if (!img || !isLoaded) return;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = OUTPUT_SIZE;
    outCanvas.height = OUTPUT_SIZE;

    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return;

    const scaleFactor = OUTPUT_SIZE / CROP_SIZE;
    const baseScale = getBaseScale(img, rotation);
    const totalScale = baseScale * zoom * scaleFactor;

    outCtx.save();
    outCtx.translate(
      OUTPUT_SIZE / 2 + offset.x * scaleFactor,
      OUTPUT_SIZE / 2 + offset.y * scaleFactor
    );
    outCtx.rotate((rotation * Math.PI) / 180);

    const drawW = img.naturalWidth * totalScale;
    const drawH = img.naturalHeight * totalScale;

    outCtx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    outCtx.restore();

    // Export as high quality JPEG Data URL
    const croppedDataUrl = outCanvas.toDataURL('image/jpeg', 0.92);
    onCropComplete(croppedDataUrl);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto overscroll-contain"
      onClick={onClose}
    >
      <div
        className="bg-dark-card border border-dark-border rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-dark-border mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-flame-500/15 border border-flame-500/30 flex items-center justify-center text-flame-400">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-1.5">
                Crop Profile Picture
              </h3>
              <p className="text-[11px] text-dark-muted">
                Drag to position and pinch or zoom to frame your avatar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-dark-surface rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cropping Viewport Area */}
        <div className="flex flex-col items-center flex-1 overflow-y-auto min-h-0 pr-1">
          <div
            className="relative rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-inner select-none cursor-grab active:cursor-grabbing touch-none"
            style={{ width: CROP_SIZE, height: CROP_SIZE }}
            onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
            onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={(e) => {
              if (e.touches[0]) {
                handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onTouchMove={(e) => {
              if (e.touches[0]) {
                handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onTouchEnd={handlePointerUp}
            onWheel={handleWheel}
          >
            {/* The main canvas */}
            <canvas
              ref={canvasRef}
              width={CROP_SIZE}
              height={CROP_SIZE}
              className="block w-full h-full"
            />

            {/* Circular Mask & Grid Overlay */}
            <div className="pointer-events-none absolute inset-0">
              {/* Outer dark overlay with circular cutout */}
              <div
                className="absolute inset-0 rounded-full border-2 border-flame-500/80 shadow-[0_0_0_9999px_rgba(9,9,11,0.65)]"
                style={{ borderRadius: '50%' }}
              />

              {/* Rule of thirds grid inside the circle */}
              <div className="absolute inset-0 rounded-full overflow-hidden opacity-30">
                <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/40 border-r border-dashed border-white/60" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/40 border-r border-dashed border-white/60" />
                <div className="absolute top-1/3 left-0 right-0 h-px bg-white/40 border-b border-dashed border-white/60" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-white/40 border-b border-dashed border-white/60" />
              </div>

              {/* Drag indicator hint */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-900/80 text-[10px] text-zinc-300 font-mono border border-zinc-700/50">
                <Move className="w-2.5 h-2.5 text-flame-400" />
                <span>Drag to move</span>
              </div>
            </div>

            {!isLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 text-xs text-dark-muted">
                <div className="w-4 h-4 border-2 border-flame-500 border-t-transparent rounded-full animate-spin mr-2" />
                Loading image...
              </div>
            )}
          </div>

          {/* Quick controls bar under viewport */}
          <div className="w-full mt-4 space-y-3">
            {/* Zoom Slider */}
            <div className="flex items-center gap-3 px-1">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(1, +(z - 0.2).toFixed(1)))}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-dark-surface rounded-lg transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-flame-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
              />

              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(1)))}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-dark-surface rounded-lg transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <span className="text-xs font-mono font-bold text-flame-400 w-11 text-right">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            {/* Rotation and Avatar Live Preview Row */}
            <div className="flex items-center justify-between pt-1 border-t border-dark-border/60">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRotate}
                  className="px-2.5 py-1.5 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-300 hover:text-zinc-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Rotate 90 degrees"
                >
                  <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Rotate</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="px-2.5 py-1.5 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-400 hover:text-zinc-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Reset position and zoom"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>

              {/* Real-time mini circular avatar preview */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-dark-muted font-mono">Avatar:</span>
                <canvas
                  ref={previewCanvasRef}
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded-full border-2 border-flame-500/50 shadow-sm bg-zinc-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 mt-4 pt-3 sm:pt-4 border-t border-dark-border shrink-0">
          {onSkipCrop ? (
            <button
              type="button"
              onClick={onSkipCrop}
              className="text-xs text-zinc-400 hover:text-zinc-200 underline font-medium transition-colors"
            >
              Use full uncropped image
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-zinc-200 hover:bg-dark-surface rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyCrop}
              disabled={!isLoaded}
              className="px-4 py-2 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-bold text-xs rounded-xl shadow-md shadow-flame-500/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Apply Crop</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
