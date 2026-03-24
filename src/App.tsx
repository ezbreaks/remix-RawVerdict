import React, { useState, useEffect, useRef } from 'react';
import { Splash } from './components/Splash';
import { CameraCapture } from './components/CameraCapture';
import { CardForm } from './components/CardForm';
import { CardList } from './components/CardList';
import { BatchUploader } from './components/BatchUploader';
import { ImageEditor } from './components/ImageEditor';
import { Auth } from './components/Auth';
import { AdminDashboard } from './components/AdminDashboard';
import { ProfileModal } from './components/ProfileModal';
import { identifyCard, generateBackground, CardDetails, CardAnalysis } from './services/gemini';
import { Plus, Database, Download, Upload, RefreshCw, Image as ImageIcon, Loader2, Camera, FileImage, ImagePlus, Menu, DollarSign, FileText, Shield, ShieldAlert, LogOut, Users, Gavel, X, User, ArrowRight, Mail, Copy, Bell, BellRing, BellOff } from 'lucide-react';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'motion/react';

declare global {
  interface Window {
    aistudio?: {
      openSelectKey: () => Promise<void>;
      hasSelectedApiKey: () => Promise<boolean>;
    };
  }
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [view, setView] = useState<'list' | 'scan_front' | 'scan_back' | 'edit' | 'upload_select' | 'batch_upload'>('list');
  const [cards, setCards] = useState<any[]>([]);
  const [currentCard, setCurrentCard] = useState<Partial<CardDetails> & { id?: number; front_image?: string; back_image?: string; analysis?: CardAnalysis }>({});
  const [editingImage, setEditingImage] = useState<{ src: string; side: 'front' | 'back' } | null>(null);
  const [loading, setLoading] = useState(false);
  const [bgImage, setBgImage] = useState<string>('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showThemeSubmenu, setShowThemeSubmenu] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [saveReminderInterval, setSaveReminderInterval] = useState<number>(() => {
    const saved = localStorage.getItem('rawverdict_save_reminder');
    return saved ? parseInt(saved, 10) : 0; // 0 = off, 5 = 5min, 10 = 10min
  });
  const [showReminderSubmenu, setShowReminderSubmenu] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState<boolean>(() => {
    return localStorage.getItem('rawverdict_terms_accepted') === 'true';
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMenuOpen && 
          menuRef.current && 
          !menuRef.current.contains(event.target as Node) &&
          buttonRef.current &&
          !buttonRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [checkingKey, setCheckingKey] = useState(true);

  useEffect(() => {
    checkAuth();
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    if (window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(hasKey);
    } else {
      // Fallback for environments without aistudio global
      setHasApiKey(true);
    }
    setCheckingKey(false);
  };

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true); // Assume success per guidelines
    }
  };

  useEffect(() => {
    if (saveReminderInterval === 0) return;

    const intervalId = setInterval(() => {
      // Simple alert for now, could be a toast in the future
      if (confirm("Reminder: Don't forget to save your work! Click OK to dismiss.")) {
        // User acknowledged
      }
    }, saveReminderInterval * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [saveReminderInterval]);

  const handleSetSaveReminder = (minutes: number) => {
    setSaveReminderInterval(minutes);
    localStorage.setItem('rawverdict_save_reminder', minutes.toString());
    setShowReminderSubmenu(false);
    setIsMenuOpen(false);
    alert(`Save reminder set to: ${minutes === 0 ? 'Off' : `${minutes} minutes`}`);
  };

  const getToken = () => {
    return localStorage.getItem('rawverdict_token') || sessionStorage.getItem('rawverdict_token');
  };

  const checkAuth = async () => {
    // Migration/Cleanup: If token exists in localStorage but remember flag is missing, 
    // it's likely an old persistent token from before the "Remember Me" feature.
    // We clear it to force a one-time re-login for the new system.
    if (localStorage.getItem('rawverdict_token') && localStorage.getItem('rawverdict_remember') !== 'true') {
      localStorage.removeItem('rawverdict_token');
    }

    const token = getToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        localStorage.removeItem('rawverdict_token');
        localStorage.removeItem('rawverdict_remember');
        sessionStorage.removeItem('rawverdict_token');
      }
    } catch (error) {
      console.error("Auth check failed", error);
    } finally {
      setAuthChecking(false);
    }
  };

  const handleLogin = (data: any, rememberMe: boolean) => {
    if (rememberMe) {
      localStorage.setItem('rawverdict_token', data.token);
      localStorage.setItem('rawverdict_remember', 'true');
    } else {
      sessionStorage.setItem('rawverdict_token', data.token);
      localStorage.removeItem('rawverdict_token');
      localStorage.removeItem('rawverdict_remember');
    }
    setUser(data.user);
    fetchCards();
  };

  const handleProfileUpdate = (data: any) => {
    if (localStorage.getItem('rawverdict_remember') === 'true') {
      localStorage.setItem('rawverdict_token', data.token);
    } else {
      sessionStorage.setItem('rawverdict_token', data.token);
    }
    setUser(data.user);
  };

  const handleLogout = () => {
    localStorage.removeItem('rawverdict_token');
    localStorage.removeItem('rawverdict_remember');
    sessionStorage.removeItem('rawverdict_token');
    setUser(null);
    setCards([]);
    setIsMenuOpen(false);
  };

  useEffect(() => {
    if (user) {
      fetchCards();
    }
    const storedBg = localStorage.getItem('rawverdict_bg');
    if (storedBg) {
      setBgImage(storedBg);
    }
    
    // Show terms if not accepted
    if (!hasAcceptedTerms) {
      setShowTerms(true);
    }
  }, [hasAcceptedTerms, user]);

  const handleAcceptTerms = () => {
    localStorage.setItem('rawverdict_terms_accepted', 'true');
    setHasAcceptedTerms(true);
    setShowTerms(false);
  };

  const fetchCards = async () => {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch('/api/cards', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setCards(data);
      } else {
        console.error("API returned non-array data:", data);
        setCards([]);
      }
    } catch (error) {
      console.error("Failed to fetch cards", error);
      setCards([]);
    }
  };

  const handleFrontCapture = (imageSrc: string) => {
    setEditingImage({ src: imageSrc, side: 'front' });
  };

  const handleBackCapture = (imageSrc: string) => {
    setEditingImage({ src: imageSrc, side: 'back' });
  };

  const handleImageSave = (croppedImage: string) => {
    if (editingImage?.side === 'front') {
      setCurrentCard(prev => ({ ...prev, front_image: croppedImage }));
      setEditingImage(null);
      setView('scan_back');
    } else if (editingImage?.side === 'back') {
      const updatedCard = { ...currentCard, back_image: croppedImage };
      setCurrentCard(updatedCard);
      setEditingImage(null);
      processCard(updatedCard.front_image!, croppedImage);
    }
  };

  const handleImageCancel = () => {
    const src = editingImage?.src;
    const side = editingImage?.side;
    setEditingImage(null);
    
    if (side === 'front') {
      setCurrentCard(prev => ({ ...prev, front_image: src }));
      setView('scan_back');
    } else if (side === 'back') {
      const updatedCard = { ...currentCard, back_image: src };
      setCurrentCard(updatedCard);
      processCard(updatedCard.front_image!, src);
    }
  };

  const handleSkipBack = async () => {
    await processCard(currentCard.front_image!, undefined);
  };

  const processCard = async (front: string, back?: string) => {
    setLoading(true);
    try {
      const details = await identifyCard(front, back);
      const cardData = { ...details, front_image: front, back_image: back };
      
      // Auto-save the identified card
      const token = getToken();
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(cardData),
      });
      
      if (res.ok) {
        const { id } = await res.json();
        setCurrentCard({ ...cardData, id });
        fetchCards(); // Refresh list in background
      } else {
        setCurrentCard(cardData);
      }
      
      setView('edit');
    } catch (error: any) {
      console.error("Process card failed", error);
      alert(`Failed to identify card. ${error.message || "Please try again or enter details manually."}`);
      setCurrentCard({ front_image: front, back_image: back, year: '', set_name: '', card_number: '', player_name: '', team_name: '', variant: '', serial_number: '', graded_by: '', grade: '', cert_number: '' });
      setView('edit');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchComplete = async (processedCards: any[]) => {
    setLoading(true);
    const token = getToken();
    try {
      // Save all cards
      for (const card of processedCards) {
        await fetch('/api/cards', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(card),
        });
      }
      await fetchCards();
      setView('list');
      alert(`Successfully added ${processedCards.length} cards!`);
    } catch (error) {
      console.error("Failed to save batch", error);
      alert("Some cards failed to save.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCard = async (data: any, stayInEdit: boolean = false) => {
    const token = getToken();
    try {
      if (data.id) {
        await fetch(`/api/cards/${data.id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(data),
        });
      } else {
        const res = await fetch('/api/cards', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(data),
        });
        if (res.ok && stayInEdit) {
          const { id } = await res.json();
          data.id = id;
        }
      }
      await fetchCards();
      if (!stayInEdit) {
        setView('list');
        setCurrentCard({});
      } else {
        setCurrentCard(data);
      }
    } catch (error) {
      console.error("Failed to save card", error);
    }
  };

  const handleDeleteCard = async (id: number) => {
    if (!confirm("Are you sure you want to delete this card?")) return;
    const token = getToken();
    try {
      await fetch(`/api/cards/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchCards();
    } catch (error) {
      console.error("Failed to delete card", error);
    }
  };

  const handleBulkDelete = async (ids: number[]) => {
    const token = getToken();
    try {
      // Execute all deletes in parallel
      await Promise.all(ids.map(id => fetch(`/api/cards/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })));
      fetchCards();
    } catch (error) {
      console.error("Failed to bulk delete cards", error);
      alert("Failed to delete some cards.");
    }
  };

  const handleBackupCSV = () => {
    // Define the desired column order and exclude ID, front_image, and back_image
    const columnOrder = [
      'year', 'set_name', 'card_number', 'player_name', 'team_name', 
      'variant', 'serial_number', 'graded_by', 'grade', 'quantity', 'market_price', 
      'market_updated_at', 'notes', 'created_at'
    ];

    const sanitizedCards = cards.map(card => {
      const newCard: any = {};
      columnOrder.forEach(key => {
        // We can't truly "center" in CSV, but we can ensure clean data
        newCard[key] = card[key] !== null && card[key] !== undefined ? card[key] : '';
      });
      return newCard;
    });

    const csv = Papa.unparse(sanitizedCards);
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rawverdict_inventory.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleBackupDB = async () => {
    const token = getToken();
    try {
      const res = await fetch('/api/backup/db', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Backup failed");
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rawverdict_backup_${user.username}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Backup failed", error);
      alert("Backup failed");
    }
  };

  const handleRestoreDB = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      
      setLoading(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const cards = JSON.parse(e.target?.result as string);
          const token = getToken();
          const res = await fetch('/api/restore/db', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ cards }),
          });
          
          if (!res.ok) throw new Error("Restore failed");
          
          await fetchCards();
          setView('list');
          alert("Collection restored successfully!");
        } catch (error) {
          alert("Failed to restore collection. Ensure it's a valid RawVerdict JSON backup.");
        } finally {
          setLoading(false);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleDeduplicate = async () => {
    setLoading(true);
    const token = getToken();
    try {
      const res = await fetch('/api/deduplicate', { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      alert(`Deduplication complete. Deleted ${data.deleted} duplicates and updated ${data.updated} records.`);
      fetchCards();
    } catch (error) {
      console.error("Deduplication failed", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBackground = async (theme: string = "Sports") => {
    setLoading(true);
    try {
      const bg = await generateBackground(theme);
      if (bg) {
        setBgImage(bg);
        localStorage.setItem('rawverdict_bg', bg);
      }
    } catch (error) {
      alert("Failed to generate background");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadBackground = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setBgImage(result);
        localStorage.setItem('rawverdict_bg', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const calculateTotalValue = () => {
    if (!Array.isArray(cards)) return '$0.00';
    const total = cards.reduce((sum, card) => {
      if (card.market_price && card.market_price !== 'N/A') {
        const price = parseFloat(card.market_price.replace(/[^0-9.]/g, ''));
        if (!isNaN(price)) {
          return sum + (price * (card.quantity || 1));
        }
      }
      return sum;
    }, 0);
    return total.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  if (showSplash) {
    return <Splash onComplete={() => setShowSplash(false)} />;
  }

  if (!hasApiKey && !checkingKey) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-10 h-10 text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">API Key Required</h2>
          <p className="text-slate-400 mb-8">
            To use advanced card identification and market analysis, you need to select a Gemini API key.
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
          >
            Select API Key <Plus className="w-5 h-5" />
          </button>
          <p className="mt-6 text-xs text-slate-500">
            Don't have a key? <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline">Learn about Gemini API billing</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-800 font-sans relative overflow-x-hidden">
      {/* Dynamic Background */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center transition-all duration-1000"
        style={{ 
          backgroundImage: bgImage ? `url(${bgImage})` : 'linear-gradient(to bottom right, #0f172a, #1e1b4b)',
          opacity: 0.8
        }}
      />
      <div className="fixed inset-0 z-0 bg-black/40 backdrop-blur-[2px]" />

      {/* Header */}
      <header className="relative z-[200] sticky top-0 shadow-xl">
        {/* Top Bar: Branding & Controls */}
        <div className="relative z-20 bg-slate-900/90 backdrop-blur-xl border-b border-white/10 p-3">
          <div className="max-w-7xl mx-auto flex justify-between items-center px-2">
            
            {/* Left: Menu Button */}
            <div className="relative">
              <button 
                ref={buttonRef}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>

              {/* Dropdown Menu */}
              <AnimatePresence>
                {isMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-[205] bg-black/40 backdrop-blur-sm"
                      onClick={() => setIsMenuOpen(false)}
                    />
                    <motion.div
                      ref={menuRef}
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className="absolute top-full left-0 mt-2 w-56 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[210] py-2"
                    >
                      <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Account
                      </div>
                      <button 
                        onClick={() => { setShowProfile(true); setIsMenuOpen(false); }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-white/10 hover:text-white flex items-center gap-3 transition-colors"
                      >
                        <User className="w-4 h-4 text-cyan-400" /> Profile Settings
                      </button>

                      <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Settings
                      </div>

                      <div className="relative">
                        <button 
                          onClick={() => setShowReminderSubmenu(!showReminderSubmenu)}
                          className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-white/10 hover:text-white flex items-center justify-between transition-colors"
                        >
                          <span className="flex items-center gap-3">
                            {saveReminderInterval === 0 ? <BellOff className="w-4 h-4" /> : <BellRing className="w-4 h-4 text-amber-400" />} 
                            Save Reminder
                          </span>
                          <span className="text-xs text-slate-500">
                            {saveReminderInterval === 0 ? 'Off' : `${saveReminderInterval}m`} ▼
                          </span>
                        </button>
                        
                        <AnimatePresence>
                          {showReminderSubmenu && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="bg-slate-800/50 overflow-hidden"
                            >
                              {[0, 5, 10].map((mins) => (
                                <button
                                  key={mins}
                                  onClick={() => handleSetSaveReminder(mins)}
                                  className={`w-full px-8 py-2 text-left text-xs hover:text-white hover:bg-white/5 transition-colors border-l-2 ${saveReminderInterval === mins ? 'border-amber-500 text-white bg-white/5' : 'border-transparent text-slate-300'}`}
                                >
                                  {mins === 0 ? 'Off' : `${mins} Minutes`}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Theme
                      </div>
                      
                      <div className="relative">
                        <button 
                          onClick={() => setShowThemeSubmenu(!showThemeSubmenu)}
                          className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-white/10 hover:text-white flex items-center justify-between transition-colors"
                        >
                          <span className="flex items-center gap-3"><ImageIcon className="w-4 h-4" /> AI Theme</span>
                          <span className="text-xs text-slate-500">▼</span>
                        </button>
                        
                        <AnimatePresence>
                          {showThemeSubmenu && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="bg-slate-800/50 overflow-hidden"
                            >
                              {["Baseball", "Football", "Hockey", "Soccer", "Pokémon", "Digimon", "Magic"].map((theme) => (
                                <button
                                  key={theme}
                                  onClick={() => { 
                                    handleGenerateBackground(theme); 
                                    setIsMenuOpen(false); 
                                    setShowThemeSubmenu(false);
                                  }}
                                  className="w-full px-8 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-indigo-500"
                                >
                                  {theme}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <label className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-white/10 hover:text-white flex items-center gap-3 transition-colors cursor-pointer">
                        <ImagePlus className="w-4 h-4" /> Upload BG
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { handleUploadBackground(e); setIsMenuOpen(false); }} />
                      </label>

                      <div className="my-2 border-t border-white/10"></div>
                      
                      <button 
                        onClick={() => { setShowAbout(true); setIsMenuOpen(false); }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-white/10 hover:text-white flex items-center gap-3 transition-colors"
                      >
                        <Plus className="w-4 h-4 rotate-45" /> About
                      </button>

                      <button 
                        onClick={() => { setShowTerms(true); setIsMenuOpen(false); }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-white/10 hover:text-white flex items-center gap-3 transition-colors"
                      >
                        <FileText className="w-4 h-4" /> Terms of Service
                      </button>

                      <button 
                        onClick={() => { setShowSupport(true); setIsMenuOpen(false); }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-white/10 hover:text-white flex items-center gap-3 transition-colors"
                      >
                        <Mail className="w-4 h-4" /> Support
                      </button>

                      {user.role === 'admin' && (
                        <>
                          <div className="my-1 border-t border-white/10" />
                          <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            System
                          </div>
                          <button 
                            onClick={() => { setShowAdmin(true); setIsMenuOpen(false); }}
                            className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-indigo-500/10 hover:text-white flex items-center gap-3 transition-colors group"
                          >
                            <Shield className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" /> 
                            <span className="font-medium">Admin Dashboard</span>
                          </button>
                        </>
                      )}

                      <div className="my-1 border-t border-white/10" />
                      
                      <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Data
                      </div>
                      <button 
                        onClick={() => { handleBackupCSV(); setIsMenuOpen(false); }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-white/10 hover:text-white flex items-center gap-3 transition-colors"
                      >
                        <Download className="w-4 h-4" /> Export CSV
                      </button>
                      <button 
                        onClick={() => { handleBackupDB(); setIsMenuOpen(false); }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-white/10 hover:text-white flex items-center gap-3 transition-colors"
                      >
                        <Database className="w-4 h-4" /> Backup DB
                      </button>
                      <button 
                        onClick={() => { handleRestoreDB(); setIsMenuOpen(false); }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-white/10 hover:text-white flex items-center gap-3 transition-colors"
                      >
                        <Upload className="w-4 h-4" /> Restore DB
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Center: Branding */}
            <div className="flex items-center gap-3 cursor-pointer absolute left-1/2 -translate-x-1/2" onClick={() => setView('list')}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Gavel className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight hidden sm:block">RawVerdict</h1>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-2">
              {user.role === 'admin' && (
                <button 
                  onClick={() => setShowAdmin(true)}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 rounded-lg font-medium text-sm transition-all shadow-lg shadow-indigo-500/10"
                  title="Admin Dashboard"
                >
                  <Shield className="w-4 h-4" />
                  <span className="hidden md:inline">Admin</span>
                </button>
              )}
              <button 
                onClick={() => alert(`Total Collection Value (Market Snapshots): ${calculateTotalValue()}`)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium border border-white/10 text-sm transition-all"
                title="Total Collection Value"
              >
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span className="hidden md:inline">Value:</span>
                <span>{calculateTotalValue()}</span>
              </button>
              <button 
                onClick={() => setView('upload_select')}
                className="hidden sm:flex px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-lg font-medium shadow-lg shadow-emerald-500/20 transition-all active:scale-95 items-center gap-1.5 border border-white/10 text-sm"
              >
                <Plus className="w-4 h-4" /> 
                <span>Add Card</span>
              </button>
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Sub-Header: Value & Add Card */}
        <div className="sm:hidden bg-slate-900/80 backdrop-blur-lg border-b border-white/10 p-3 flex flex-col items-center gap-3">
          {user.role === 'admin' && (
            <button 
              onClick={() => setShowAdmin(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500/20 text-indigo-300 rounded-full font-medium border border-indigo-500/30 text-sm transition-all active:bg-indigo-500/30 w-full justify-center"
            >
              <Shield className="w-4 h-4" />
              <span>Admin Dashboard</span>
            </button>
          )}
          <button 
            onClick={() => alert(`Total Collection Value (Market Snapshots): ${calculateTotalValue()}`)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white rounded-full font-medium border border-white/10 text-sm transition-all active:bg-white/10"
          >
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="opacity-60">Collection Value:</span>
            <span className="text-emerald-400">{calculateTotalValue()}</span>
          </button>
          <button 
            onClick={() => setView('upload_select')}
            className="w-full max-w-[280px] py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold shadow-xl shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 border border-white/10"
          >
            <Plus className="w-5 h-5" /> 
            <span>Add New Card</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 p-4 min-h-[calc(100vh-80px)]">
        {loading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <p className="text-slate-600 font-medium">Processing with RawVerdict AI...</p>
            </div>
          </div>
        )}

        {view === 'list' && (
          <>
            {user.role === 'admin' && (
              <div className="max-w-6xl mx-auto px-4 mb-4">
                <motion.button
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setShowAdmin(true)}
                  className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98] border border-white/10"
                >
                  <Shield className="w-6 h-6" />
                  <span className="text-lg">Open Admin Dashboard</span>
                  <ArrowRight className="w-5 h-5 opacity-50" />
                </motion.button>
              </div>
            )}
            <CardList 
              cards={cards} 
              onDelete={handleDeleteCard} 
              onEdit={(card) => {
                setCurrentCard(card);
                setView('edit');
              }}
              onBulkDelete={handleBulkDelete}
              onDeduplicate={handleDeduplicate}
            />
          </>
        )}

        {view === 'upload_select' && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setView('scan_front')}
                className="bg-white/90 backdrop-blur-md p-8 rounded-2xl shadow-xl flex flex-col items-center gap-4 border border-white/20 hover:bg-white transition-colors"
              >
                <div className="p-6 bg-indigo-100 rounded-full">
                  <Camera className="w-12 h-12 text-indigo-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800">Scan with Camera</h3>
                <p className="text-slate-500 text-center">Use your device camera to scan cards one by one.</p>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setView('batch_upload')}
                className="bg-white/90 backdrop-blur-md p-8 rounded-2xl shadow-xl flex flex-col items-center gap-4 border border-white/20 hover:bg-white transition-colors"
              >
                <div className="p-6 bg-cyan-100 rounded-full">
                  <FileImage className="w-12 h-12 text-cyan-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800">Upload Files</h3>
                <p className="text-slate-500 text-center">Upload multiple images from your device.</p>
                <p className="text-xs text-indigo-500 font-medium text-center mt-2 bg-indigo-50 px-3 py-1.5 rounded-full">
                  Tip: Keep images in order for better accuracy
                </p>
              </motion.button>

              <button 
                onClick={() => setView('list')}
                className="md:col-span-2 mt-4 text-white/70 hover:text-white font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {view === 'batch_upload' && (
          <BatchUploader 
            onComplete={handleBatchComplete}
            onCancel={() => setView('list')}
          />
        )}

        {view === 'scan_front' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            <div className="text-center text-white mb-4">
              <h2 className="text-3xl font-bold mb-2">Scan Front</h2>
              <p className="text-white/60">Position the card front within the frame</p>
            </div>
            <CameraCapture onCapture={handleFrontCapture} label="Front of Card" />
            <button onClick={() => setView('list')} className="text-white/60 hover:text-white mt-4">Cancel</button>
          </div>
        )}

        {view === 'scan_back' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            <div className="text-center text-white mb-4">
              <h2 className="text-3xl font-bold mb-2">Scan Back</h2>
              <p className="text-white/60">Position the card back within the frame</p>
            </div>
            <CameraCapture onCapture={handleBackCapture} label="Back of Card" />
            <div className="flex gap-4 mt-4">
              <button onClick={handleSkipBack} className="px-6 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20">Skip Back</button>
              <button onClick={() => setView('list')} className="text-white/60 hover:text-white py-2">Cancel</button>
            </div>
          </div>
        )}

        {view === 'edit' && (
          <div className="py-8">
            <CardForm 
              initialData={currentCard as CardDetails} 
              frontImage={currentCard.front_image!}
              backImage={currentCard.back_image}
              initialAnalysis={currentCard.analysis}
              onSave={handleSaveCard}
              onCancel={() => {
                setCurrentCard({});
                setView('list');
              }}
            />
          </div>
        )}
      </main>

      {/* Admin Dashboard Modal */}
      <AnimatePresence>
        {showAdmin && (
          <AdminDashboard onClose={() => setShowAdmin(false)} currentUser={user} />
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfile && (
          <ProfileModal 
            user={user} 
            onClose={() => setShowProfile(false)} 
            onUpdate={handleProfileUpdate}
          />
        )}
      </AnimatePresence>

      {/* About Modal */}
      <AnimatePresence>
        {showAbout && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowAbout(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-indigo-600 rotate-45" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">About RawVerdict</h3>
              <p className="text-slate-600 leading-relaxed mb-8">
                RawVerdict delivers data-driven price estimates, grading suggestions, and market outlooks. 
                Because market conditions fluctuate, we cannot guarantee the absolute accuracy of every result. 
                RawVerdict should be used as a supplementary resource alongside your own independent research.
              </p>
              <button 
                onClick={() => setShowAbout(false)}
                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Support Modal */}
      <AnimatePresence>
        {showSupport && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowSupport(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Contact Support</h3>
              <p className="text-slate-600 mb-6">
                Need help? Reach out to our support team directly.
              </p>
              
              <div className="bg-slate-100 p-4 rounded-xl flex items-center justify-between gap-3 mb-6 border border-slate-200">
                <code className="text-slate-800 font-mono text-sm break-all select-all">rawverdictsupport@gmail.com</code>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText('rawverdictsupport@gmail.com');
                    alert('Email copied to clipboard!');
                  }}
                  className="p-2 bg-white hover:bg-slate-50 text-indigo-600 rounded-lg border border-slate-200 transition-colors shadow-sm"
                  title="Copy Email"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-3">
                <a 
                  href="mailto:rawverdictsupport@gmail.com"
                  className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" /> Open Mail App
                </a>
                <button 
                  onClick={() => setShowSupport(false)}
                  className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Terms of Service Modal */}
      <AnimatePresence>
        {showTerms && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => {
              if (hasAcceptedTerms) setShowTerms(false);
            }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <ShieldAlert className="w-5 h-5 text-amber-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Terms of Service: Data Usage & Disclaimers</h3>
                </div>
                {hasAcceptedTerms && (
                  <button onClick={() => setShowTerms(false)} className="text-slate-400 hover:text-slate-600 p-1">
                    <Plus className="w-6 h-6 rotate-45" />
                  </button>
                )}
              </div>
              
              <div className="p-6 overflow-y-auto text-left">
                <div className="space-y-6 text-slate-600 leading-relaxed">
                  <section>
                    <h4 className="font-bold text-slate-800 mb-2">1. Nature of Services</h4>
                    <p>RawVerdict provides automated tools for sports card enthusiasts, including price estimations, grading recommendations, player biographies, and market analytics. These features are designed to assist in collection management and are based on available market data at the time of the query.</p>
                  </section>

                  <section>
                    <h4 className="font-bold text-slate-800 mb-2">2. Accuracy of Information</h4>
                    <p>While RawVerdict strives to provide the most current and precise data, all pricing, grading projections, and market outlooks are estimates only. Users acknowledge that:</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      <li>Automated grading is a preliminary assessment and does not guarantee the results of a third-party professional grading service (e.g., PSA, BGS, SGC).</li>
                      <li>Market valuations are subject to rapid fluctuations and may not reflect real-time private sales or localized market trends.</li>
                      <li>Descriptions and biographies are pulled from various databases; while generally reliable, we do not warrant their absolute factual accuracy.</li>
                    </ul>
                  </section>

                  <section>
                    <h4 className="font-bold text-slate-800 mb-2">3. No Financial Advice</h4>
                    <p>RawVerdict is an informational tool and does not provide financial, investment, or legal advice. Any decision to buy, sell, or trade assets based on information provided by the app is made at the user's sole discretion. We strongly recommend conducting independent research and consulting with professional appraisers for high-value transactions.</p>
                  </section>

                  <section>
                    <h4 className="font-bold text-slate-800 mb-2">4. Limitation of Liability</h4>
                    <p>To the maximum extent permitted by law, RawVerdict and its developers shall not be held liable for any financial losses, damages, or inaccuracies resulting from the use of the platform’s data.</p>
                  </section>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100">
                <button 
                  onClick={handleAcceptTerms}
                  className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
                >
                  {hasAcceptedTerms ? 'Close' : 'I Accept & Understand'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {editingImage && (
        <ImageEditor
          image={editingImage.src}
          onSave={handleImageSave}
          onCancel={handleImageCancel}
          aspect={2.5 / 3.5}
        />
      )}
    </div>
  );
}

