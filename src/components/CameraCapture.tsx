import React, { useCallback, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, Check, Upload } from 'lucide-react';
import { motion } from 'motion/react';

interface CameraCaptureProps {
  onCapture: (imageSrc: string) => void;
  label: string;
}

export function CameraCapture({ onCapture, label }: CameraCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setImage(imageSrc);
      onCapture(imageSrc);
    }
  }, [webcamRef, onCapture]);

  const retake = () => {
    setImage(null);
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    setError(null);
  };

  const handleError = (err: string | DOMException) => {
    console.error("Camera error:", err);
    const errorMessage = typeof err === 'string' ? err : err.message;
    
    if (errorMessage?.toLowerCase().includes('permission') || errorMessage?.toLowerCase().includes('notallowed') || errorMessage?.toLowerCase().includes('denied')) {
      setError("Camera permission denied. Please allow camera access in your browser or use file upload.");
      // Automatically trigger file upload dialog if camera is blocked
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 500);
      return;
    }

    if (facingMode === 'environment') {
      // Fallback to user camera if environment camera fails
      setFacingMode('user');
    } else {
      setError("Could not access camera. Please check permissions or use file upload.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImage(result);
        onCapture(result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md mx-auto p-4 bg-black/20 rounded-xl backdrop-blur-sm border border-white/10">
      <h3 className="text-white font-medium text-lg">{label}</h3>
      <div className="relative w-full aspect-[3/4] bg-black rounded-lg overflow-hidden border-2 border-white/20 shadow-inner flex items-center justify-center">
        {error ? (
          <div className="text-red-400 text-center p-4 flex flex-col items-center gap-4">
            <p className="mb-2">{error}</p>
            <div className="flex gap-4">
              <button onClick={() => setError(null)} className="px-4 py-2 bg-white/10 rounded-lg text-white text-sm hover:bg-white/20">Retry Camera</button>
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/30 flex items-center gap-2">
                <Upload className="w-4 h-4" /> Upload File
              </button>
            </div>
          </div>
        ) : image ? (
          <img src={image} alt="Captured" className="w-full h-full object-contain" />
        ) : (
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode }}
            className="w-full h-full object-cover"
            disablePictureInPicture={false}
            forceScreenshotSourceSize={false}
            imageSmoothing={true}
            mirrored={false}
            screenshotQuality={0.92}
            minScreenshotHeight={undefined}
            onUserMedia={() => setError(null)}
            onUserMediaError={handleError}
          />
        )}
      </div>
      
      <input 
        type="file" 
        accept="image/*" 
        className="hidden" 
        ref={fileInputRef}
        onChange={handleFileUpload}
      />
      
      <div className="flex gap-4">
        {!image ? (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              title="Upload Image"
            >
              <Upload className="w-6 h-6" />
            </button>
            <button
              onClick={toggleCamera}
              className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              title="Switch Camera"
            >
              <RefreshCw className="w-6 h-6" />
            </button>
            <button
              onClick={capture}
              className="p-4 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
              title="Take Photo"
            >
              <Camera className="w-8 h-8" />
            </button>
          </>
        ) : (
          <button
            onClick={retake}
            className="px-6 py-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors font-medium"
          >
            Retake
          </button>
        )}
      </div>
    </div>
  );
}
