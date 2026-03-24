import React, { useState } from 'react';
import { Search, Trash2, Edit, ExternalLink, Image as ImageIcon, CheckSquare, Square, Grid, List, ChevronLeft, ChevronRight, RefreshCw, AlertTriangle, X } from 'lucide-react';

interface Card {
  id: number;
  year: string;
  set_name: string;
  card_number: string;
  player_name: string;
  team_name: string;
  variant: string;
  serial_number: string;
  quantity: number;
  market_price?: string;
  front_image: string;
  notes: string;
  graded_by?: string;
  grade?: string;
  cert_number?: string;
  slab_image?: string;
}

interface CardListProps {
  cards: Card[];
  onDelete: (id: number) => void;
  onEdit: (card: Card) => void;
  onBulkDelete?: (ids: number[]) => void;
  onDeduplicate?: () => void;
}

export function CardList({ cards, onDelete, onEdit, onBulkDelete, onDeduplicate }: CardListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  // Initialize from localStorage, default to false if not found
  const [isCompact, setIsCompact] = useState(() => {
    const saved = localStorage.getItem('cardListCompactView');
    return saved ? JSON.parse(saved) : false;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = isCompact ? 6 : 12; // Default to 12 for normal view, 6 for compact as requested

  // Persist to localStorage whenever isCompact changes
  const toggleCompactView = () => {
    const newValue = !isCompact;
    setIsCompact(newValue);
    localStorage.setItem('cardListCompactView', JSON.stringify(newValue));
  };

  const filteredCards = cards.filter(card => 
    `${card.year} ${card.set_name} ${card.player_name} ${card.team_name} ${card.card_number}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  // Pagination Logic
  const totalPages = Math.ceil(filteredCards.length / itemsPerPage);
  const paginatedCards = filteredCards.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const [showDeleteWarning, setShowDeleteWarning] = useState(false);

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setShowDeleteWarning(true);
  };

  const confirmDelete = () => {
    onBulkDelete?.(selectedIds);
    setSelectedIds([]);
    setShowDeleteWarning(false);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredCards.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCards.map(c => c.id));
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <div className="mb-6 flex flex-col gap-3">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search your collection..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset to first page on search
            }}
            className="w-full pl-10 pr-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-white/50 focus:ring-2 focus:ring-cyan-400 outline-none transition-all"
          />
        </div>
        
        <div className="flex gap-2 justify-between items-center">
          <div className="flex items-center gap-3 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
            <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <span>Compact View</span>
            </span>
            
            <button 
              onClick={toggleCompactView}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${isCompact ? 'bg-indigo-600' : 'bg-slate-600'}`}
              title={isCompact ? "Switch to Normal View" : "Switch to Compact View"}
            >
              <span className="sr-only">Toggle view</span>
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isCompact ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>

          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <button 
                onClick={handleBulkDelete}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 shadow-lg shadow-red-500/20"
              >
                <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Delete</span> ({selectedIds.length})
              </button>
            )}
            
            <button 
              onClick={toggleSelectAll}
              className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-white/10"
            >
              {selectedIds.length === filteredCards.length && filteredCards.length > 0 ? 'Deselect' : 'Select'} <span className="hidden sm:inline">All</span>
            </button>

            {onDeduplicate && (
              <button 
                onClick={onDeduplicate}
                className="bg-indigo-600/80 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 shadow-lg shadow-indigo-500/20 border border-white/10"
                title="Search and merge duplicate cards"
              >
                <RefreshCw className="w-4 h-4" /> <span>Merge Duplicates</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={`grid ${isCompact ? 'gap-3' : 'gap-6'} ${isCompact 
        ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6' 
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      }`}>
        {paginatedCards.map(card => (
          <div 
            key={card.id} 
            className={`bg-white/90 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group border flex flex-col ${selectedIds.includes(card.id) ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-white/20'}`}
          >
            <div className="relative aspect-[3/4] overflow-hidden bg-slate-200 flex items-center justify-center bg-slate-100">
              <img 
                src={card.slab_image || card.front_image} 
                alt={card.player_name} 
                className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110 cursor-pointer" 
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(card);
                }}
              />
              
              {card.slab_image && (
                <div className="absolute top-2 right-12 z-20">
                  <div className="bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm border border-emerald-400 uppercase tracking-tighter">
                    Graded
                  </div>
                </div>
              )}
              {/* Always visible checkbox */}
              <div 
                className="absolute top-2 left-2 z-20 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelection(card.id);
                }}
              >
                <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors shadow-sm ${selectedIds.includes(card.id) ? 'bg-indigo-600 border-indigo-600' : 'bg-white/40 border-slate-300 hover:bg-white/60'}`}>
                  {selectedIds.includes(card.id) && <CheckSquare className="w-4 h-4 text-white" />}
                </div>
              </div>
              
              <div className="absolute top-2 right-2 flex flex-col gap-2 z-20">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(card); }}
                  className="bg-indigo-600 text-white p-1.5 rounded-lg shadow-lg flex items-center justify-center gap-1 hover:bg-indigo-700 transition-colors"
                  title="Edit Card"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold">Edit</span>
                </button>
              </div>

              {card.market_price && card.market_price !== 'N/A' && (
                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-lg z-10 flex items-center gap-1">
                  <span className="text-emerald-400">Est:</span> {card.market_price}
                </div>
              )}
            </div>
            
            <div className={`p-2 sm:p-4 relative ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
              <div className="flex justify-between items-start mb-1">
                <div className="flex flex-col min-w-0 flex-1">
                  {isCompact ? (
                    <div className="flex flex-col leading-none mb-1">
                      <span className="font-bold text-slate-800 truncate text-[10px] uppercase">
                        {card.player_name.split(' ')[0]}
                      </span>
                      <span className="font-bold text-slate-800 truncate text-[10px] uppercase">
                        {card.player_name.split(' ').slice(1).join(' ')}
                      </span>
                    </div>
                  ) : (
                    <h3 className="font-bold text-slate-800 truncate pr-1 text-sm mb-0.5">{card.player_name}</h3>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">Qty: {card.quantity}</span>
                    {card.market_price && card.market_price !== 'N/A' && (
                      <span className="text-[9px] sm:text-[10px] font-bold text-emerald-600 uppercase">Val: {card.market_price}</span>
                    )}
                  </div>
                </div>
                <span className="text-[9px] sm:text-xs font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded ml-1 shrink-0">#{card.card_number}</span>
              </div>
              {card.team_name && (
                <p className="text-[9px] sm:text-xs font-semibold text-slate-500 mb-0.5 truncate uppercase tracking-wide">{card.team_name}</p>
              )}
              {!isCompact && <p className="text-xs sm:text-sm text-slate-600 mb-0.5 truncate">{card.year} {card.set_name}</p>}
              {card.variant && (
                <p className="text-[9px] sm:text-xs text-indigo-600 font-medium truncate">{card.variant}</p>
              )}
              {card.graded_by && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[9px] sm:text-xs bg-slate-800 text-white px-1 py-0.5 rounded font-bold uppercase">{card.graded_by}</span>
                  {card.grade && <span className="text-[9px] sm:text-xs font-bold text-slate-700">{card.grade}</span>}
                  {card.cert_number && (
                    <a
                      href={(() => {
                        const cert = card.cert_number.trim();
                        const company = card.graded_by.toLowerCase();
                        if (company.includes('psa')) return `https://www.psacard.com/cert/${cert}`;
                        if (company.includes('bgs') || company.includes('beckett')) return `https://www.beckett.com/grading/card-lookup?item_type=BGS&item_id=${cert}`;
                        if (company.includes('sgc')) return `https://www.gosgc.com/cert-verification?cert=${cert}`;
                        if (company.includes('cgc')) return `https://www.cgccards.com/certlookup/${cert}/`;
                        return '#';
                      })()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[8px] sm:text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold hover:bg-indigo-200 transition-colors ml-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      POP
                    </a>
                  )}
                </div>
              )}
              {!isCompact && card.serial_number && (
                <p className="text-[9px] sm:text-xs text-amber-600 font-mono mt-0.5">{card.serial_number}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {filteredCards.length === 0 && (
        <div className="text-center py-20 text-white/60">
          <p className="text-xl">No cards found matching your search.</p>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <span className="text-white font-medium">
            Page {currentPage} of {totalPages}
          </span>
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Delete Warning Modal */}
      {showDeleteWarning && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Cards?</h3>
              <p className="text-slate-600 mb-6">
                You are about to delete <span className="font-bold text-slate-900">{selectedIds.length}</span> cards from your collection. 
                <br/><br/>
                <span className="text-red-600 font-semibold">This action cannot be undone.</span>
                <br/>
                Are you sure you wish to continue?
              </p>
              
              <div className="flex gap-3 justify-center">
                <button 
                  onClick={() => setShowDeleteWarning(false)}
                  className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  className="px-5 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 shadow-lg shadow-red-500/30 transition-colors"
                >
                  Delete Forever
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
