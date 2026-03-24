import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { processBatchImages } from '../services/gemini';
import { processImage } from '../lib/imageUtils';

interface BatchUploaderProps {
  onComplete: (cards: any[]) => void;
  onCancel: () => void;
}

export function BatchUploader({ onComplete, onCancel }: BatchUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
      
      // Generate previews
      newFiles.forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
             setPreviews(prev => [...prev, e.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setStatus('RawVerdict AI is analyzing your cards...');

    try {
      // Process in chunks of 4 to avoid rate limits
      const chunkSize = 4;
      const allProcessedCards: any[] = [];
      
      for (let i = 0; i < previews.length; i += chunkSize) {
        const chunk = previews.slice(i, i + chunkSize);
        const chunkIndexOffset = i;
        
        setStatus(`Analyzing batch ${Math.floor(i / chunkSize) + 1} of ${Math.ceil(previews.length / chunkSize)}...`);
        
        // 1. Send chunk to Gemini
        const results = await processBatchImages(chunk);
        
        setStatus(`Identified ${results.length} cards in batch ${Math.floor(i / chunkSize) + 1}...`);
        
        // 2. Process images based on Gemini results
        const processedChunk = await Promise.all(results.map(async (card: any) => {
          // Adjust indices to match global previews array
          const globalFrontIndex = chunkIndexOffset + card.front_image_index;
          const globalBackIndex = card.back_image_index !== null ? chunkIndexOffset + card.back_image_index : null;

          // Process Front
          const frontRaw = previews[globalFrontIndex];
          const frontProcessed = await processImage(
            frontRaw,
            card.front_crop,
            card.front_rotation
          );

          // Process Back (if exists)
          let backProcessed = undefined;
          if (globalBackIndex !== null && globalBackIndex !== undefined) {
            const backRaw = previews[globalBackIndex];
            backProcessed = await processImage(
              backRaw,
              card.back_crop,
              card.back_rotation
            );
          }

          return {
            ...card.details,
            front_image: frontProcessed,
            back_image: backProcessed
          };
        }));
        
        allProcessedCards.push(...processedChunk);
        
        // Small delay between chunks to be nice to the API
        if (i + chunkSize < previews.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      onComplete(allProcessedCards);
    } catch (error) {
      console.error(error);
      alert('Failed to process batch. Please try fewer images or clearer photos.');
      setStatus('Error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full max-w-4xl mx-auto p-6">
      <div className="bg-white/90 backdrop-blur-md rounded-2xl p-8 shadow-2xl w-full border border-white/20">
        <h2 className="text-2xl font-bold mb-6 text-slate-800 text-center">Batch Upload Cards</h2>
        
        {!loading ? (
          <>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-3 border-dashed border-slate-300 rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-indigo-400 transition-all group mb-8"
            >
              <div className="p-4 bg-indigo-50 rounded-full mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8 text-indigo-600" />
              </div>
              <p className="text-lg font-medium text-slate-700">Click to upload files</p>
              <p className="text-sm text-slate-500 mt-1">Select multiple images (Fronts & Backs)</p>
              <p className="text-xs text-indigo-600 font-medium mt-3 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100 shadow-sm">
                Tip: If uploading multiple images, keep them in order (Front, Back, Front, Back) for better accuracy
              </p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                multiple 
                accept="image/*" 
                className="hidden" 
              />
            </div>

            {previews.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Selected Images ({previews.length})</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                  <AnimatePresence>
                    {previews.map((src, index) => (
                      <motion.div 
                        key={index}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="relative aspect-[3/4] rounded-lg overflow-hidden shadow-md group"
                      >
                        <img src={src} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                        <button 
                          onClick={() => removeFile(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button 
                onClick={onCancel}
                className="flex-1 py-3 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleProcess}
                disabled={files.length === 0}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Process Images
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mb-6" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">{status}</h3>
            <p className="text-slate-500 text-center max-w-md">
              RawVerdict AI is searching for card information, matching fronts to backs, and extracting details. This may take a moment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
