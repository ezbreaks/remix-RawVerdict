import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Gavel } from 'lucide-react';

interface SplashProps {
  onComplete: () => void;
}

const inspirationalQuotes = [
  { text: "It's not whether you get knocked down, it's whether you get up.", author: "Vince Lombardi" },
  { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
  { text: "The more difficult the victory, the greater the happiness in winning.", author: "Pelé" },
  { text: "I've failed over and over and over again in my life. And that is why I succeed.", author: "Michael Jordan" },
  { text: "Winning isn't everything, but wanting to win is.", author: "Vince Lombardi" },
  { text: "Don't count the days, make the days count.", author: "Muhammad Ali" },
  { text: "The only way to prove that you’re a good sport is to lose.", author: "Ernie Banks" },
  { text: "Age is no barrier. It’s a limitation you put on your mind.", author: "Jackie Joyner-Kersee" },
  { text: "If you fail to prepare, you’re prepared to fail.", author: "Mark Spitz" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "Your time is limited, so don't waste it living someone else's life.", author: "Steve Jobs" },
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { text: "Everything you've ever wanted is on the other side of fear.", author: "George Addair" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
  { text: "What you get by achieving your goals is not as important as what you become by achieving your goals.", author: "Zig Ziglar" }
];

export function Splash({ onComplete }: SplashProps) {
  const [clicked, setClicked] = useState(false);
  const [quote, setQuote] = useState<{ text: string; author: string } | null>(null);

  useEffect(() => {
    const randomQuote = inspirationalQuotes[Math.floor(Math.random() * inspirationalQuotes.length)];
    setQuote(randomQuote);
  }, []);

  const handleEnter = () => {
    setClicked(true);
    setTimeout(onComplete, 1200); // Wait for animation + short pause
  };

  return (
    <motion.div 
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white overflow-hidden"
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
    >
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>
      
      <div className="relative z-10 flex flex-col items-center justify-center">
        
        {/* Gavel Container */}
        <div className="relative mb-16 z-20">
            <motion.div
                initial={{ rotate: -120, x: 60, y: -60, opacity: 0 }}
                animate={clicked ? { rotate: 0, x: 0, y: 0, opacity: 1 } : { rotate: -45, x: 20, y: -20, opacity: 1 }}
                transition={clicked ? { 
                    duration: 0.3, 
                    ease: "backIn",
                } : {
                    duration: 1,
                    ease: "easeOut"
                }}
                style={{ originX: 0.8, originY: 0.8 }} // Pivot point near handle base
            >
                <Gavel className="w-32 h-32 text-amber-500 fill-amber-500/20 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
            </motion.div>
        </div>

        {/* Text Container */}
        <div className="relative z-10">
            <motion.h1 
                className="text-7xl font-black tracking-tighter text-white drop-shadow-2xl"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ 
                    opacity: 1, 
                    scale: 1, 
                    y: 0,
                }}
                transition={{ duration: 0.8, ease: "easeOut" }}
            >
                <motion.span
                    animate={clicked ? { 
                        scale: [1, 0.95, 1.05, 1],
                        y: [0, 5, -5, 0],
                        filter: ["blur(0px)", "blur(4px)", "blur(0px)"]
                    } : {}}
                    transition={{
                        duration: 0.4,
                        ease: "easeInOut",
                        times: [0, 0.2, 0.6, 1],
                        delay: 0.1
                    }}
                    className="inline-block"
                >
                    Raw
                </motion.span>
                <motion.span
                    animate={clicked ? { 
                        scale: [1, 0.95, 1.05, 1],
                        y: [0, 5, -5, 0],
                        filter: ["blur(0px)", "blur(4px)", "blur(0px)"],
                        color: ["#ffffff", "#f59e0b", "#f59e0b"] // Flash to amber on hit
                    } : {}}
                    transition={{
                        duration: 0.4,
                        ease: "easeInOut",
                        times: [0, 0.2, 0.6, 1],
                        delay: 0.1
                    }}
                    className="inline-block text-amber-500"
                >
                    Verdict
                </motion.span>
            </motion.h1>
        </div>
        
        {/* Impact Ripple/Flash */}
        {clicked && (
            <motion.div
                className="absolute top-1/2 left-1/2 w-full h-32 bg-amber-500/40 blur-3xl rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 0.8, 0], scale: [0.5, 2.5, 3] }}
                transition={{ duration: 0.6, ease: "easeOut" }}
            />
        )}

        {/* Subtitle */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-center text-slate-500 mt-6 font-mono text-sm tracking-[0.4em] uppercase"
        >
          To Grade or Not to Grade
        </motion.p>

        {/* Enter Button */}
        {!clicked && (
            <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 0.5 }}
                whileHover={{ scale: 1.05, backgroundColor: "rgba(245, 158, 11, 0.2)" }}
                whileTap={{ scale: 0.95 }}
                onClick={handleEnter}
                className="mt-12 px-8 py-3 bg-transparent border border-amber-500/50 text-amber-500 font-bold tracking-widest rounded-full hover:border-amber-500 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all uppercase text-sm cursor-pointer"
            >
                Enter
            </motion.button>
        )}

        {quote && !clicked && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="mt-16 max-w-xs text-center"
          >
            <p className="text-slate-500 text-xs italic leading-relaxed">
              "{quote.text}"
            </p>
            <p className="text-slate-600 text-[10px] mt-2 font-medium uppercase tracking-[0.2em]">
              — {quote.author}
            </p>
          </motion.div>
        )}

      </div>
    </motion.div>
  );
}
