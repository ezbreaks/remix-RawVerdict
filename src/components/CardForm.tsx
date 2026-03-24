import React, { useState, useEffect, useRef } from 'react';
import { CardDetails, getCardAnalysis, getCardGrade, CardAnalysis, getRecentSales, MarketData } from '../services/gemini';
import { ExternalLink, Save, Trash2, X, Sparkles, Loader2, DollarSign, RefreshCw, RotateCw, Download, Printer, Image as ImageIcon, Database, Crop, Award, Gavel } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { processImage } from '../lib/imageUtils';
import { toPng, toJpeg } from 'html-to-image';
import { ImageEditor } from './ImageEditor';

interface CardFormProps {
  initialData: CardDetails;
  initialAnalysis?: CardAnalysis;
  frontImage: string;
  backImage?: string;
  onSave: (data: any, stayInEdit?: boolean) => void;
  onCancel: () => void;
}

export function CardForm({ initialData, initialAnalysis, frontImage, backImage, onSave, onCancel }: CardFormProps) {
  const [formData, setFormData] = useState(initialData);
  const [notes, setNotes] = useState('');
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CardAnalysis | null>(initialAnalysis || null);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [isCheckingPrice, setIsCheckingPrice] = useState(false);
  const [activeReport, setActiveReport] = useState<'analysis' | 'grade' | null>(null);
  const [showSlab, setShowSlab] = useState(false);
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const slabRef = useRef<HTMLDivElement>(null);
  
  const [frontImgSrc, setFrontImgSrc] = useState(frontImage);
  const [backImgSrc, setBackImgSrc] = useState(backImage);
  const [slabImgSrc, setSlabImgSrc] = useState(initialData.slab_image || '');
  const [isRotating, setIsRotating] = useState(false);
  const [isCapturingSlab, setIsCapturingSlab] = useState(false);
  const [editingImage, setEditingImage] = useState<{ src: string; side: 'front' | 'back' } | null>(null);

  useEffect(() => {
    setFrontImgSrc(frontImage);
  }, [frontImage]);

  useEffect(() => {
    setBackImgSrc(backImage);
  }, [backImage]);

  useEffect(() => {
    // Manual check only
    // handleCheckPrice(); 
  }, []);

  const handleRotate = async (side: 'front' | 'back') => {
    if (isRotating) return;
    setIsRotating(true);
    try {
      const src = side === 'front' ? frontImgSrc : backImgSrc;
      if (!src) return;
      
      // Rotate 90 degrees clockwise
      // Use full crop [0, 0, 100, 100] to keep entire image
      const rotated = await processImage(src, [0, 0, 100, 100], 90, false);
      
      if (side === 'front') {
        setFrontImgSrc(rotated);
      } else {
        setBackImgSrc(rotated);
      }
    } catch (e) {
      console.error("Rotation failed", e);
    } finally {
      setIsRotating(false);
    }
  };

  const handleImageSave = (croppedImage: string) => {
    if (editingImage?.side === 'front') {
      setFrontImgSrc(croppedImage);
    } else if (editingImage?.side === 'back') {
      setBackImgSrc(croppedImage);
    }
    setEditingImage(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'notes') {
      setNotes(value);
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ 
      ...formData, 
      notes, 
      front_image: frontImgSrc, 
      back_image: backImgSrc,
      slab_image: slabImgSrc,
      market_price: formData.market_price,
      analysis: analysis || undefined
    });
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setActiveReport('analysis');
    try {
      const result = await getCardAnalysis(formData, frontImage, backImage);
      // Merge with existing grading info if it exists
      const mergedResult = {
        ...result,
        estimated_grade: analysis?.estimated_grade,
        numeric_grade: analysis?.numeric_grade,
        justification: analysis?.justification,
        subgrades: analysis?.subgrades
      };
      setAnalysis(mergedResult);
      // Auto-save the analysis results
      onSave({ 
        ...formData, 
        analysis: mergedResult,
        front_image: frontImgSrc,
        back_image: backImgSrc,
        notes
      }, true);
    } catch (error) {
      console.error("Analysis failed", error);
      alert("Failed to generate analysis. Please try again.");
      setActiveReport(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGrade = async () => {
    setIsGrading(true);
    setActiveReport('grade');
    try {
      const gradeResult = await getCardGrade(formData, frontImage, backImage, analysis?.numeric_grade);
      
      // Merge with existing analysis if it exists
      const updatedAnalysis = {
        ...(analysis || {
          description: "",
          player_bio: "",
          market_outlook: "",
          grading_recommendation: ""
        }),
        ...gradeResult
      } as CardAnalysis;
      
      setAnalysis(updatedAnalysis);
      // Auto-save the analysis results
      onSave({ 
        ...formData, 
        analysis: updatedAnalysis,
        front_image: frontImgSrc,
        back_image: backImgSrc,
        notes
      }, true);
    } catch (error) {
      console.error("Grading failed", error);
      alert("Failed to generate grade. Please try again.");
    } finally {
      setIsGrading(false);
    }
  };

  const handleCheckPrice = async () => {
    // Don't search if we don't have minimal info
    if (!formData.player_name && !formData.set_name) {
      return;
    }
    setIsCheckingPrice(true);
    try {
      const data = await getRecentSales(formData);
      setMarketData(data);
      
      const lowEndValue = data.estimated_value;
      if (lowEndValue && lowEndValue !== "N/A" && lowEndValue !== "Unknown") {
        setFormData(prev => ({ ...prev, market_price: lowEndValue }));
        // Auto-save the market data
        onSave({ 
          ...formData, 
          market_price: lowEndValue,
          front_image: frontImgSrc, 
          back_image: backImgSrc,
          notes,
          analysis: analysis || undefined
        }, true);
      }
    } catch (error) {
      console.error("Price check failed", error);
      // Don't alert on auto-check failure, just log it
    } finally {
      setIsCheckingPrice(false);
    }
  };

  const handleDownloadSlab = async (format: 'png' | 'jpeg') => {
    if (!slabRef.current) return;
    try {
      const dataUrl = format === 'png' 
        ? await toPng(slabRef.current, { quality: 1.0, pixelRatio: 2, backgroundColor: '#f1f5f9' })
        : await toJpeg(slabRef.current, { quality: 1.0, pixelRatio: 2, backgroundColor: '#f1f5f9' });
      
      const link = document.createElement('a');
      link.download = `RawVerdict-Slab-${formData.player_name || 'Card'}.${format}`;
      link.href = dataUrl;
      link.click();
      setShowSaveOptions(false);
    } catch (err) {
      console.error('Failed to download slab', err);
      alert('Failed to generate image. Please try again.');
    }
  };

  const handleSaveSlabToCard = async () => {
    if (!slabRef.current) return;
    setIsCapturingSlab(true);
    try {
      const dataUrl = await toJpeg(slabRef.current, { quality: 0.9, pixelRatio: 2, backgroundColor: '#f1f5f9' });
      setSlabImgSrc(dataUrl);
      setShowSlab(false);
      alert("Slab image attached to card inventory!");
    } catch (err) {
      console.error('Failed to save slab to card', err);
      alert('Failed to capture slab image. Please try again.');
    } finally {
      setIsCapturingSlab(false);
    }
  };

  const formattedCardNumber = formData.card_number ? (formData.card_number.startsWith('#') ? formData.card_number : `#${formData.card_number}`) : '';
  const searchQuery = `${formData.year} ${formData.set_name} ${formData.player_name} ${formData.team_name} ${formattedCardNumber} ${formData.variant}`;
  const ebaySoldUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchQuery)}&_sacat=0&LH_Sold=1&LH_Complete=1`;
  const ebayLiveUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchQuery)}&_sacat=0`;

  const getSearchUrl = (source?: string) => {
    const query = encodeURIComponent(searchQuery);
    if (!source) return ebaySoldUrl;
    
    const s = source.toLowerCase();
    if (s.includes('tcgplayer')) return `https://www.tcgplayer.com/search/all/product?q=${query}`;
    if (s.includes('mercari')) return `https://www.mercari.com/search/?keyword=${query}`;
    if (s.includes('pwcc')) return `https://www.pwccmarketplace.com/sales-history?q=${query}`;
    if (s.includes('goldin')) return `https://goldin.co/buy/?q=${query}`;
    if (s.includes('myslabs')) return `https://myslabs.com/search/?q=${query}`;
    if (s.includes('alt')) return `https://app.onlyalt.com/search?q=${query}`;
    if (s.includes('sportscardpro')) return `https://www.sportscardpro.com/search-products?q=${query}`;
    if (s.includes('pricecharting')) return `https://www.pricecharting.com/search-products?q=${query}`;
    
    return ebaySoldUrl;
  };

  return (
    <>
      <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 shadow-2xl max-w-2xl mx-auto border border-white/20 relative">
        <button 
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors z-10"
          title="Close"
        >
          <X className="w-6 h-6" />
        </button>
        
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b pb-4 pr-10 md:pr-10 gap-4">
          <h2 className="text-2xl font-bold text-slate-800 w-full text-center md:text-left">Edit Card Details</h2>
          <div className="flex flex-wrap justify-center md:justify-end gap-2 w-full md:w-auto">
            {analysis?.description && !activeReport && (
              <button
                type="button"
                onClick={() => setActiveReport('analysis')}
                className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-xs sm:text-sm font-medium hover:bg-indigo-100 transition-all flex-1 sm:flex-none whitespace-nowrap"
                title="View Analysis"
              >
                <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> View Analysis
              </button>
            )}
            {analysis?.estimated_grade && !activeReport && (
              <button
                type="button"
                onClick={() => setActiveReport('grade')}
                className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-xs sm:text-sm font-medium hover:bg-emerald-100 transition-all flex-1 sm:flex-none whitespace-nowrap"
                title="View Grade"
              >
                <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> View Grade
              </button>
            )}
            <button
              type="button"
              onClick={handleAnalyze}
              className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-lg text-xs sm:text-sm font-medium shadow-md hover:shadow-lg transition-all hover:scale-105 flex-1 sm:flex-none whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {analysis?.description ? 'Re-run Analysis' : 'RawVerdict Analysis'}
            </button>
            <button
              type="button"
              onClick={handleGrade}
              className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg text-xs sm:text-sm font-medium shadow-md hover:shadow-lg transition-all hover:scale-105 flex-1 sm:flex-none whitespace-nowrap"
            >
              <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {analysis?.estimated_grade ? 'Re-run Grade' : 'Estimate Grade'}
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-4">
            <div className="relative group">
              <div 
                className="aspect-[3/4] bg-slate-100 rounded-lg overflow-hidden border shadow-inner cursor-zoom-in flex items-center justify-center"
                onClick={() => setFullScreenImage(frontImgSrc)}
              >
                <img 
                  src={frontImgSrc} 
                  alt="Front" 
                  className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" 
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
                  <span className="opacity-0 group-hover:opacity-100 bg-black/60 text-white text-xs px-2 py-1 rounded-full transition-opacity">View Full Screen</span>
                </div>
              </div>
              <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all z-10">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleRotate('front'); }}
                  className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all"
                  title="Rotate 90°"
                >
                  <RotateCw className={`w-4 h-4 ${isRotating ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setEditingImage({ src: frontImgSrc, side: 'front' }); }}
                  className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all"
                  title="Crop & Rotate"
                >
                  <Crop className="w-4 h-4" />
                </button>
              </div>
            </div>

            {backImgSrc && (
               <div className="relative group">
                 <div 
                  className="aspect-[3/4] bg-slate-100 rounded-lg overflow-hidden border shadow-inner cursor-zoom-in flex items-center justify-center"
                  onClick={() => setFullScreenImage(backImgSrc)}
                 >
                 <img 
                  src={backImgSrc} 
                  alt="Back" 
                  className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" 
                 />
                 <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
                  <span className="opacity-0 group-hover:opacity-100 bg-black/60 text-white text-xs px-2 py-1 rounded-full transition-opacity">View Full Screen</span>
                </div>
               </div>
               <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all z-10">
                 <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleRotate('back'); }}
                    className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all"
                    title="Rotate 90°"
                  >
                    <RotateCw className={`w-4 h-4 ${isRotating ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEditingImage({ src: backImgSrc!, side: 'back' }); }}
                    className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all"
                    title="Crop & Rotate"
                  >
                    <Crop className="w-4 h-4" />
                  </button>
                </div>
             </div>
            )}

            {slabImgSrc && (
              <div className="relative group">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Digital Slab</div>
                <div 
                  className="aspect-[2.5/4] bg-slate-100 rounded-lg overflow-hidden border shadow-inner cursor-zoom-in flex items-center justify-center"
                  onClick={() => setFullScreenImage(slabImgSrc)}
                >
                  <img 
                    src={slabImgSrc} 
                    alt="Slab" 
                    className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" 
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
                    <span className="opacity-0 group-hover:opacity-100 bg-black/60 text-white text-xs px-2 py-1 rounded-full transition-opacity">View Full Screen</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSlabImgSrc('')}
                  className="absolute top-6 right-2 p-1.5 bg-red-500/80 hover:bg-red-600 text-white rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                  title="Remove Slab"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Year</label>
              <input
                type="text"
                name="year"
                value={formData.year || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Set Name</label>
              <input
                type="text"
                name="set_name"
                value={formData.set_name || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Card Number</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">#</span>
                <input
                  type="text"
                  name="card_number"
                  value={formData.card_number || ''}
                  onChange={handleChange}
                  className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Name</label>
              <input
                type="text"
                name="player_name"
                value={formData.player_name || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Team Name</label>
              <input
                type="text"
                name="team_name"
                value={formData.team_name || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Parallel/Rarity</label>
              <input
                type="text"
                name="variant"
                value={formData.variant || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Serial Number</label>
              <input
                type="text"
                name="serial_number"
                value={formData.serial_number || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Graded By</label>
              <input
                type="text"
                name="graded_by"
                placeholder="PSA, BGS, SGC, etc."
                value={formData.graded_by || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Grade</label>
              <input
                type="text"
                name="grade"
                placeholder="10, 9.5, 9, etc."
                value={formData.grade || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Cert Number</label>
                {formData.cert_number && formData.graded_by && (
                  <a
                    href={(() => {
                      const cert = formData.cert_number.trim();
                      const company = formData.graded_by.toLowerCase();
                      if (company.includes('psa')) return `https://www.psacard.com/cert/${cert}`;
                      if (company.includes('bgs') || company.includes('beckett')) return `https://www.beckett.com/grading/card-lookup?item_type=BGS&item_id=${cert}`;
                      if (company.includes('sgc')) return `https://www.gosgc.com/cert-verification?cert=${cert}`;
                      if (company.includes('cgc')) return `https://www.cgccards.com/certlookup/${cert}/`;
                      return '#';
                    })()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold hover:bg-indigo-200 transition-colors flex items-center gap-1"
                  >
                    POP <ExternalLink size={10} />
                  </a>
                )}
              </div>
              <input
                type="text"
                name="cert_number"
                placeholder="Certificate #"
                value={formData.cert_number || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Qty</label>
              <input
                type="number"
                name="quantity"
                min="1"
                value={formData.quantity || 1}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Market Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <input
                  type="text"
                  name="market_price"
                  placeholder="0.00"
                  value={formData.market_price ? formData.market_price.replace('$', '') : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, market_price: val ? `$${val}` : '' }));
                  }}
                  className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Notes</label>
              <textarea
                name="notes"
                value={notes}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all h-24 resize-none"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <a
                href={ebaySoldUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
              >
                <ExternalLink className="w-4 h-4" /> eBay Sold
              </a>
              <a
                href={ebayLiveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
              >
                <ExternalLink className="w-4 h-4" /> eBay Live
              </a>
            </div>

            {/* Market Data Section */}
            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" /> Market Snapshot
                </h3>
                <button 
                  type="button"
                  onClick={handleCheckPrice}
                  disabled={isCheckingPrice}
                  className="text-xs bg-white border border-slate-300 px-2 py-1 rounded hover:bg-slate-100 transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {isCheckingPrice ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {marketData ? 'Refresh' : 'Check Price'}
                </button>
              </div>

              {isCheckingPrice ? (
                <div className="text-center py-4 text-slate-500 text-sm">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                  Analyzing market data...
                </div>
              ) : marketData ? (
                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-2xl font-bold text-slate-800">{marketData.estimated_value}</span>
                    <span className="text-xs text-slate-500">Estimated Value</span>
                  </div>
                  {marketData.estimated_value && marketData.estimated_value !== "N/A" && marketData.estimated_value !== "Unknown" && (
                    <div className="text-[10px] text-emerald-600 font-medium mb-4">
                      * {marketData.estimated_value} will be saved as the card's value.
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Demand</div>
                      <div className="text-sm font-medium text-slate-700">{marketData.market_demand}</div>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Confidence</div>
                      <div className="text-sm font-medium text-slate-700">{marketData.confidence_score}</div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-slate-600 mb-4 bg-blue-50/50 p-2.5 rounded border border-blue-100/50">
                    <span className="font-semibold text-blue-800">Analyst Notes:</span> {marketData.notes}
                  </div>

                  <div className="border-t border-slate-200 pt-3">
                    <div className="text-xs font-semibold text-slate-700 mb-2">Verify Recent Sales:</div>
                    <div className="flex flex-wrap gap-2">
                      <a href={getSearchUrl('ebay')} target="_blank" rel="noopener noreferrer" className="text-xs bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-700 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
                        eBay Sold <ExternalLink className="w-3 h-3" />
                      </a>
                      <a href={getSearchUrl('tcgplayer')} target="_blank" rel="noopener noreferrer" className="text-xs bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-700 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
                        TCGplayer <ExternalLink className="w-3 h-3" />
                      </a>
                      <a href={getSearchUrl('sportscardpro')} target="_blank" rel="noopener noreferrer" className="text-xs bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-700 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
                        SportsCardPro <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-2 text-slate-400 text-xs italic">
                  Click "Check Price" to analyze market data.
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-6 mt-6 border-t border-slate-200">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-4 py-3 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                className="flex-1 px-4 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" /> Save Card
              </motion.button>
            </div>
          </form>
        </div>
      </div>

      {/* Full Screen Image Modal */}
      <AnimatePresence>
        {editingImage && (
          <ImageEditor 
            image={editingImage.src}
            onSave={handleImageSave}
            onCancel={() => setEditingImage(null)}
            aspect={2.5 / 3.5}
          />
        )}
        
        {fullScreenImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setFullScreenImage(null)}
          >
            <button 
              className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
              onClick={() => setFullScreenImage(null)}
            >
              <X className="w-8 h-8" />
            </button>
            <motion.img 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={fullScreenImage} 
              alt="Full Screen" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Analysis Modal */}
      <AnimatePresence>
        {activeReport !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setActiveReport(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`p-4 border-b flex justify-between items-center bg-gradient-to-r ${activeReport === 'grade' ? 'from-emerald-50 to-teal-50' : 'from-violet-50 to-fuchsia-50'}`}>
                <div className={`flex items-center gap-2 ${activeReport === 'grade' ? 'text-emerald-700' : 'text-violet-700'}`}>
                  {activeReport === 'grade' ? <Award className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                  <h3 className="font-bold text-lg">
                    {activeReport === 'grade' ? 'RawVerdict Grade Estimate' : 'RawVerdict Analysis'}
                  </h3>
                </div>
                <button 
                  onClick={() => setActiveReport(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar">
                {isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4 text-slate-500">
                    <Loader2 className="w-10 h-10 animate-spin text-violet-500" />
                    <div className="text-center space-y-2">
                      <p className="font-medium animate-pulse">RawVerdict is analyzing your card...</p>
                      <p className="text-sm opacity-80 max-w-xs mx-auto">This may take a moment. Thank you for your patience.</p>
                    </div>
                  </div>
                ) : isGrading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4 text-slate-500">
                    <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                    <div className="text-center space-y-2">
                      <p className="font-medium animate-pulse">RawVerdict is estimating the grade...</p>
                      <p className="text-sm opacity-80 max-w-xs mx-auto">This may take an extended time due to the 10-pass grading analysis. Thank you for your patience.</p>
                    </div>
                  </div>
                ) : analysis ? (
                  <div className="space-y-6">
                    {activeReport === 'analysis' && (
                      <>
                        {analysis.description && (
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Card Description
                            </h4>
                            <p className="text-slate-700 leading-relaxed text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">
                              {analysis.description}
                            </p>
                          </div>
                        )}
                        
                        {analysis.player_bio && (
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Player Bio
                            </h4>
                            <p className="text-slate-700 leading-relaxed text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">
                              {analysis.player_bio}
                            </p>
                          </div>
                        )}
                        
                        {analysis.market_outlook && (
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Market Outlook
                            </h4>
                            <p className="text-slate-700 leading-relaxed text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">
                              {analysis.market_outlook}
                            </p>
                          </div>
                        )}
                        
                        {analysis.grading_recommendation && (
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> Grading Recommendation
                            </h4>
                            <p className="text-slate-700 leading-relaxed text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">
                              {analysis.grading_recommendation}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {activeReport === 'grade' && analysis.estimated_grade && (
                      <div className="flex flex-col items-center gap-6">
                        {/* Mini Slab Preview inside Grade Report */}
                        <div className="w-full max-w-[240px] mx-auto">
                          <div 
                            className="bg-slate-200 p-2 rounded-2xl shadow-lg border-2 border-slate-300 aspect-[2.5/4] flex flex-col cursor-pointer transform transition-transform hover:scale-[1.02]"
                            onClick={() => setShowSlab(true)}
                          >
                            <div className="bg-gradient-to-br from-indigo-700 via-blue-800 to-indigo-950 rounded-lg p-3 mb-3 shadow-inner border border-indigo-900 flex justify-between items-start overflow-hidden relative pb-8 text-white">
                              <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
                              <div className="flex-1 z-10">
                                <div className="flex items-center gap-1 mb-1">
                                  <Gavel className="w-3 h-3 text-amber-400 drop-shadow-sm" />
                                  <div className="text-white font-black text-[10px] leading-none italic drop-shadow-sm">RawVerdict</div>
                                </div>
                                <div className="text-[8px] font-bold text-indigo-100 leading-tight uppercase truncate w-32 drop-shadow-sm">
                                  {formData.player_name}
                                </div>
                              </div>
                              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded px-2 py-1 min-w-[30px] text-center z-10 shadow-sm">
                                <div className="text-sm font-black text-white leading-none drop-shadow-md">
                                  {(() => {
                                    if (analysis.numeric_grade !== undefined && analysis.numeric_grade !== 0) {
                                      return analysis.numeric_grade;
                                    }
                                    const gradeMatch = analysis.estimated_grade?.match(/\d+(\.\d+)?/);
                                    return gradeMatch ? gradeMatch[0] : 'N/A';
                                  })()}
                                </div>
                              </div>
                              {/* Subgrades on Mini Slab */}
                              {analysis.subgrades && (
                                <div className="absolute bottom-1.5 left-2 right-2 flex justify-between border-t border-white/20 pt-1.5">
                                  <div className="flex items-center gap-0.5 bg-black/20 px-1 rounded border border-white/10">
                                    <span className="text-[5px] font-bold text-indigo-200 uppercase tracking-tighter">Cen</span>
                                    <span className="text-[8px] font-black text-white leading-none">{analysis.subgrades.centering}</span>
                                  </div>
                                  <div className="flex items-center gap-0.5 bg-black/20 px-1 rounded border border-white/10">
                                    <span className="text-[5px] font-bold text-indigo-200 uppercase tracking-tighter">Cor</span>
                                    <span className="text-[8px] font-black text-white leading-none">{analysis.subgrades.corners}</span>
                                  </div>
                                  <div className="flex items-center gap-0.5 bg-black/20 px-1 rounded border border-white/10">
                                    <span className="text-[5px] font-bold text-indigo-200 uppercase tracking-tighter">Edg</span>
                                    <span className="text-[8px] font-black text-white leading-none">{analysis.subgrades.edges}</span>
                                  </div>
                                  <div className="flex items-center gap-0.5 bg-black/20 px-1 rounded border border-white/10">
                                    <span className="text-[5px] font-bold text-indigo-200 uppercase tracking-tighter">Sur</span>
                                    <span className="text-[8px] font-black text-white leading-none">{analysis.subgrades.surface}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 bg-slate-800 rounded-lg overflow-hidden relative border border-slate-400/30">
                              <img src={frontImgSrc || ''} alt="Slab Preview" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10" />
                            </div>
                          </div>
                          <div className="text-center mt-2 text-[10px] text-slate-500 font-medium">Click slab to view full size</div>
                        </div>

                        <div className="w-full">
                          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Estimated Grade
                          </h4>
                          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                            <p className="text-slate-700 leading-relaxed text-sm mb-4">
                              {analysis.estimated_grade}
                            </p>
                            
                            {analysis.subgrades && (
                              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200/60">
                                <div className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-slate-100 shadow-sm">
                                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Centering</span>
                                  <span className="text-sm font-black text-indigo-600">{analysis.subgrades.centering}</span>
                                </div>
                                <div className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-slate-100 shadow-sm">
                                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Corners</span>
                                  <span className="text-sm font-black text-indigo-600">{analysis.subgrades.corners}</span>
                                </div>
                                <div className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-slate-100 shadow-sm">
                                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Edges</span>
                                  <span className="text-sm font-black text-indigo-600">{analysis.subgrades.edges}</span>
                                </div>
                                <div className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-slate-100 shadow-sm">
                                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Surface</span>
                                  <span className="text-sm font-black text-indigo-600">{analysis.subgrades.surface}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <p>No analysis available.</p>
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t bg-slate-50 flex justify-end">
                <button 
                  onClick={() => setActiveReport(null)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 font-medium hover:bg-slate-100 transition-colors text-sm shadow-sm"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slab Preview Modal */}
      <AnimatePresence>
        {showSlab && analysis && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setShowSlab(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button 
                onClick={() => setShowSlab(false)}
                className="absolute -top-12 right-0 text-white/70 hover:text-white p-2 transition-colors"
              >
                <X className="w-8 h-8" />
              </button>

              {/* The Slab */}
              <div 
                ref={slabRef}
                className="bg-slate-200 p-3 rounded-[2rem] shadow-2xl border-4 border-slate-300 relative overflow-hidden aspect-[2.5/4] flex flex-col"
              >
                {/* Inner Plastic Border */}
                <div className="absolute inset-1 border border-white/30 rounded-[1.8rem] pointer-events-none z-10" />
                
                {/* Slab Label */}
                <div className="bg-gradient-to-br from-indigo-700 via-blue-800 to-indigo-950 rounded-xl p-4 mb-4 shadow-inner border border-indigo-900 flex justify-between items-start relative overflow-hidden pb-10 text-white">
                  {/* Label Background Texture */}
                  <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
                  
                  <div className="flex-1 z-10">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Gavel className="w-5 h-5 text-amber-400 drop-shadow-sm" />
                      <div className="text-white font-black text-lg leading-none tracking-tighter italic drop-shadow-sm">
                        RawVerdict
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold text-indigo-200 leading-tight uppercase drop-shadow-sm">
                        {formData.year} {formData.set_name}
                      </p>
                      <p className="text-[11px] font-black text-white leading-tight uppercase truncate max-w-[180px] drop-shadow-sm">
                        {formData.player_name}
                      </p>
                      <p className="text-[9px] font-bold text-indigo-300 leading-tight uppercase drop-shadow-sm">
                        {formData.variant} {formData.card_number ? `#${formData.card_number}` : ''}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center justify-center bg-white/10 backdrop-blur-md border-2 border-white/20 rounded-lg px-3 py-1 shadow-lg min-w-[60px] z-10">
                    <div className="text-[8px] font-bold text-indigo-200 uppercase tracking-widest leading-none mb-1">Grade</div>
                    <div className="text-3xl font-black text-white leading-none drop-shadow-md">
                      {(() => {
                        if (analysis.numeric_grade !== undefined && analysis.numeric_grade !== 0) {
                          return analysis.numeric_grade;
                        }
                        const gradeMatch = analysis.estimated_grade?.match(/\d+(\.\d+)?/);
                        return gradeMatch ? gradeMatch[0] : 'N/A';
                      })()}
                    </div>
                  </div>

                  {/* Subgrades on Slab */}
                  {analysis.subgrades && (
                    <div className="absolute bottom-1.5 left-4 right-4 flex justify-between border-t border-white/20 pt-2">
                      <div className="flex items-center gap-1 bg-black/20 px-1.5 py-0.5 rounded shadow-sm border border-white/10">
                        <span className="text-[7px] font-bold text-indigo-200 uppercase tracking-tighter">Cen</span>
                        <span className="text-[11px] font-black text-white leading-none">{analysis.subgrades.centering}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-black/20 px-1.5 py-0.5 rounded shadow-sm border border-white/10">
                        <span className="text-[7px] font-bold text-indigo-200 uppercase tracking-tighter">Cor</span>
                        <span className="text-[11px] font-black text-white leading-none">{analysis.subgrades.corners}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-black/20 px-1.5 py-0.5 rounded shadow-sm border border-white/10">
                        <span className="text-[7px] font-bold text-indigo-200 uppercase tracking-tighter">Edg</span>
                        <span className="text-[11px] font-black text-white leading-none">{analysis.subgrades.edges}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-black/20 px-1.5 py-0.5 rounded shadow-sm border border-white/10">
                        <span className="text-[7px] font-bold text-indigo-200 uppercase tracking-tighter">Sur</span>
                        <span className="text-[11px] font-black text-white leading-none">{analysis.subgrades.surface}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Main Area */}
                <div className="flex-1 bg-slate-800 rounded-2xl overflow-hidden relative border-4 border-slate-400/30 shadow-inner flex items-center justify-center">
                  {/* Card Image */}
                  <img 
                    src={frontImgSrc} 
                    alt="Slabbed Card" 
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Glass Reflection Effect */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/20 pointer-events-none" />
                  <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                </div>

                {/* Slab Bottom Detail */}
                <div className="mt-4 flex justify-center">
                  <div className="w-12 h-1 bg-slate-400/30 rounded-full" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-col gap-3">
                <button 
                  onClick={handleSaveSlabToCard}
                  disabled={isCapturingSlab}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2"
                >
                  {isCapturingSlab ? <Loader2 className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
                  Attach Slab to Card
                </button>

                <div className="relative">
                  <button 
                    onClick={() => setShowSaveOptions(!showSaveOptions)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" /> Save Slab
                  </button>

                  <AnimatePresence>
                    {showSaveOptions && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-20"
                      >
                        <button 
                          onClick={() => handleDownloadSlab('png')}
                          className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3 text-slate-700 font-medium transition-colors border-b border-slate-100"
                        >
                          <ImageIcon className="w-4 h-4 text-indigo-500" />
                          Download as PNG
                        </button>
                        <button 
                          onClick={() => handleDownloadSlab('jpeg')}
                          className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3 text-slate-700 font-medium transition-colors border-b border-slate-100"
                        >
                          <ImageIcon className="w-4 h-4 text-emerald-500" />
                          Download as JPEG
                        </button>
                        <button 
                          onClick={() => {
                            window.print();
                            setShowSaveOptions(false);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3 text-slate-700 font-medium transition-colors"
                        >
                          <Printer className="w-4 h-4 text-slate-500" />
                          Print Slab
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button 
                  onClick={() => setShowSlab(false)}
                  className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 py-3 rounded-xl font-bold transition-all"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
