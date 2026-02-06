import { useState, useRef, useEffect, useCallback } from "react";
import { TranscriptLine } from "../types";

interface TranscriptOverlayProps {
  lines: TranscriptLine[];
  isVisible: boolean;
  onSave: () => void;
  onClear: () => void;
  onToggleVisibility: () => void;
}

interface AnimatedTranscriptLineProps {
  line: TranscriptLine;
}

function AnimatedTranscriptLine({ line }: AnimatedTranscriptLineProps) {
  const speakerConfig = {
    recruiter: { color: "var(--accent)", label: "Recruiter", icon: "🔵" },
    hiring_manager: { color: "var(--success)", label: "Hiring Manager", icon: "🟢" },
  };
  
  const config = speakerConfig[line.speaker];
  
  return (
    <div className="animate-line mb-4 px-4 py-2">
      {/* Speaker label */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{config.icon}</span>
        <span 
          className="font-medium text-sm"
          style={{ color: config.color }}
        >
          {config.label}
        </span>
        {!line.isFinal && (
          <span className="text-xs text-[var(--text-muted)] italic">
            (typing...)
          </span>
        )}
      </div>
      
      {/* Animated words */}
      <div className="text-base leading-relaxed">
        {line.words.map((wordObj, idx) => (
          <span
            key={`${line.id}-word-${idx}`}
            className={`animate-word ${
              line.isFinal ? "final-word" : "interim-word"
            }`}
            style={{
              animationDelay: `${idx * 50}ms`,
            }}
          >
            {wordObj.word}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TranscriptOverlay({
  lines,
  isVisible,
  onSave,
  onClear,
  onToggleVisibility,
}: TranscriptOverlayProps) {
  // State management
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 700, height: 400 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll logic
  useEffect(() => {
    if (autoScroll && !userHasScrolled && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [lines, autoScroll, userHasScrolled]);
  
  // Handle scroll detection
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const isAtBottom = Math.abs(container.scrollHeight - container.scrollTop - container.clientHeight) < 10;
    
    if (!isAtBottom && autoScroll) {
      setUserHasScrolled(true);
    } else if (isAtBottom) {
      setUserHasScrolled(false);
    }
  }, [autoScroll]);
  
  // Jump to latest
  const handleJumpToLatest = useCallback(() => {
    setUserHasScrolled(false);
    setAutoScroll(true);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, []);
  
  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position]);
  
  useEffect(() => {
    if (!isDragging) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      
      // Keep within viewport bounds
      const maxX = window.innerWidth - size.width;
      const maxY = window.innerHeight - size.height;
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, size]);
  
  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    });
  }, [size]);
  
  useEffect(() => {
    if (!isResizing) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;
      
      const newWidth = Math.max(400, Math.min(window.innerWidth * 0.95, resizeStart.width + deltaX));
      const newHeight = Math.max(200, Math.min(window.innerHeight * 0.8, resizeStart.height + deltaY));
      
      setSize({ width: newWidth, height: newHeight });
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeStart]);
  
  if (!isVisible) return null;
  
  // Minimized pill view
  if (isMinimized) {
    const finalLines = lines.filter(l => l.isFinal);
    const latestLine = lines[lines.length - 1];
    const latestSpeaker = latestLine?.speaker === "recruiter" ? "Recruiter" : "Hiring Manager";
    
    return (
      <div 
        className="fixed top-8 left-1/2 -translate-x-1/2 z-40 animate-pill cursor-pointer"
        onClick={() => setIsMinimized(false)}
      >
        <div className="bg-white rounded-full shadow-lg border border-[var(--border-color)] px-6 py-3 flex items-center gap-3 hover:shadow-xl transition-shadow">
          <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            Transcript ({finalLines.length} lines)
          </span>
          {latestLine && !latestLine.isFinal && (
            <span className="text-xs text-[var(--text-muted)] italic">
              • {latestSpeaker} speaking...
            </span>
          )}
        </div>
      </div>
    );
  }
  
  // Full overlay view
  const finalLines = lines.filter(l => l.isFinal);
  
  return (
    <div 
      className="fixed z-40"
      style={{
        top: position.y || '2rem',
        left: position.x || '50%',
        transform: position.x ? 'none' : 'translateX(-50%)',
      }}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl border border-[var(--border-color)] overflow-hidden"
        style={{ width: size.width, height: size.height }}
      >
        {/* HEADER - Draggable */}
        <div 
          className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] px-4 py-3 cursor-move select-none"
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
              <span className="font-medium text-white">Live Transcript</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
                className="w-7 h-7 rounded-md hover:bg-white/20 flex items-center justify-center transition-colors"
                title="Minimize"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
                className="w-7 h-7 rounded-md hover:bg-white/20 flex items-center justify-center transition-colors"
                title="Close"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {/* CONTENT - Scrollable */}
        <div 
          ref={scrollContainerRef}
          className="overflow-y-auto bg-[var(--bg-secondary)]"
          style={{ height: size.height - 120 }}
          onScroll={handleScroll}
        >
          {lines.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)]">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <p className="text-sm font-medium">Waiting for conversation to start...</p>
              <p className="text-xs mt-1">Transcripts will appear here in real-time</p>
            </div>
          ) : (
            <div className="py-2">
              {lines.map((line) => (
                <AnimatedTranscriptLine 
                  key={line.id} 
                  line={line}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* FOOTER - Controls */}
        <div className="border-t border-[var(--border-color)] px-4 py-3 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {userHasScrolled && (
                <button 
                  onClick={handleJumpToLatest}
                  className="px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  Jump to Latest
                </button>
              )}
              {!userHasScrolled && (
                <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-[var(--success)] rounded-full animate-pulse" />
                  Auto-scrolling
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--text-muted)]">
                {finalLines.length} {finalLines.length === 1 ? 'line' : 'lines'}
              </span>
              <button 
                onClick={onSave}
                disabled={finalLines.length === 0}
                className="px-3 py-1.5 text-xs bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-md hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                title="Save transcript as .txt file"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save
              </button>
              <button 
                onClick={onClear}
                disabled={lines.length === 0}
                className="px-3 py-1.5 text-xs bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-md hover:bg-[var(--error)]/10 hover:text-[var(--error)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                title="Clear all transcript lines"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear
              </button>
            </div>
          </div>
        </div>
        
        {/* RESIZE HANDLE */}
        <div 
          className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize group"
          onMouseDown={handleResizeStart}
        >
          <svg className="w-4 h-4 text-[var(--text-muted)] absolute bottom-1 right-1 group-hover:text-[var(--accent)] transition-colors" fill="currentColor" viewBox="0 0 24 24">
            <path d="M22 22H20V20H22V22M22 18H20V16H22V18M18 22H16V20H18V22M18 18H16V16H18V18M14 22H12V20H14V22M22 14H20V12H22V14Z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
