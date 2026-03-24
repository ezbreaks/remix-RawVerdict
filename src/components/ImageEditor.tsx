import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, RotateCw, Maximize, Minimize } from 'lucide-react';
import getCroppedImg from '../utils/cropImage';

interface ImageEditorProps {
  image: string;
  onSave: (croppedImage: string) => void;
  onCancel: () => void;
  aspect?: number; // Default to 2.5/3.5 for standard trading cards
}

export function ImageEditor({ image, onSave, onCancel, aspect = 2.5 / 3.5 }: ImageEditorProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const croppedImage = await getCroppedImg(image, croppedAreaPixels, rotation);
      if (croppedImage) {
        onSave(croppedImage);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950/95 backdrop-blur-md flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-900/50">
        <button 
          onClick={onCancel}
          className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-white font-bold text-lg">Crop & Rotate Card</h2>
        <button 
          onClick={handleSave}
          disabled={isProcessing}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 text-white font-bold rounded-lg transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
        >
          {isProcessing ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </span>
          ) : (
            <>
              <Check className="w-5 h-5" /> Done
            </>
          )}
        </button>
      </div>

      {/* Cropper Area */}
      <div className="relative flex-1 bg-black">
        <Cropper
          image={image}
          crop={crop}
          rotation={rotation}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onRotationChange={setRotation}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
          style={{
            containerStyle: { background: '#000' },
            cropAreaStyle: { border: '2px solid #10b981', boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)' }
          }}
        />
      </div>

      {/* Controls */}
      <div className="p-6 bg-slate-900/90 border-t border-white/10 space-y-6">
        <div className="flex flex-col gap-4 max-w-md mx-auto">
          {/* Zoom Slider */}
          <div className="flex items-center gap-4">
            <Minimize className="w-4 h-4 text-slate-400" />
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <Maximize className="w-4 h-4 text-slate-400" />
          </div>

          {/* Rotation Slider */}
          <div className="flex items-center gap-4">
            <RotateCw className="w-4 h-4 text-slate-400" />
            <input
              type="range"
              value={rotation}
              min={-180}
              max={180}
              step={0.1}
              aria-labelledby="Rotation"
              onChange={(e) => setRotation(Number(e.target.value))}
              className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex items-center gap-1 w-16">
              <input
                type="number"
                value={rotation}
                min={-180}
                max={180}
                step={0.1}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="w-full bg-slate-800 text-slate-200 text-xs font-mono text-right rounded px-1 py-1 border border-slate-700 focus:outline-none focus:border-amber-500"
              />
              <span className="text-xs font-mono text-slate-400">°</span>
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <button 
            onClick={() => setRotation(prev => (prev + 90) % 360)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <RotateCw className="w-4 h-4" /> Rotate 90°
          </button>
          <button 
            onClick={() => { setZoom(1); setRotation(0); setCrop({ x: 0, y: 0 }); }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
