import { useState, useEffect } from 'react';
import { Play, Square, ChevronLeft, ChevronRight, Maximize2, Minimize2, Presentation } from 'lucide-react';
import '../../styles/presentation.css';

export default function PresentationMode({ 
    shapes = [], 
    onStart, 
    onStop, 
    onFocusFrame, 
    isActive, 
    setIsActive 
}) {
    const [frames, setFrames] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    // Extract and sort frame elements
    useEffect(() => {
        const frameElements = shapes.filter(s => s.type === 'frame');
        // Sort left-to-right, then top-to-bottom
        const sorted = [...frameElements].sort((a, b) => {
            if (Math.abs(a.y - b.y) < 50) {
                return a.x - b.x;
            }
            return a.y - b.y;
        });
        setFrames(sorted);
    }, [shapes]);

    // Handle slide change
    useEffect(() => {
        if (isActive && frames.length > 0 && frames[currentIndex]) {
            onFocusFrame(frames[currentIndex]);
        }
    }, [currentIndex, isActive, frames]);

    const startPresentation = () => {
        setIsActive(true);
        setCurrentIndex(0);
        onStart?.();
    };

    const stopPresentation = () => {
        setIsActive(false);
        onStop?.();
    };

    const handleNext = () => {
        if (currentIndex < Math.max(1, frames.length) - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isActive) return;
            if (e.key === 'ArrowRight' || e.key === 'Space') {
                e.preventDefault();
                handleNext();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                handlePrev();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                stopPresentation();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isActive, currentIndex, frames]);

    if (!isActive) {
        return (
            <button 
                className="exc-top-btn presentation-trigger-btn-icon"
                disabled={frames.length === 0}
                onClick={startPresentation}
                title={frames.length === 0 ? 'Create a Frame element to present' : 'Start Presentation Mode'}
                style={{
                    background: frames.length > 0 ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                    color: frames.length > 0 ? '#c084fc' : 'inherit'
                }}
            >
                <Play size={14} fill={frames.length > 0 ? "currentColor" : "none"} />
            </button>
        );
    }

    const activeFrame = frames[currentIndex];

    return (
        <div className="presentation-overlay">
            {/* Slide title banner */}
            <div className="presentation-header">
                <div className="slide-title">
                    <h4>{activeFrame?.label || activeFrame?.text || `Slide ${currentIndex + 1}`}</h4>
                    <span className="slide-counter">Slide {currentIndex + 1} of {frames.length}</span>
                </div>
                <button className="pres-exit-btn" onClick={stopPresentation}>
                    <Square size={14} fill="currentColor" /> Exit
                </button>
            </div>

            {/* Navigation controls at bottom */}
            <div className="presentation-controls glass">
                <button 
                    disabled={currentIndex === 0}
                    onClick={handlePrev}
                    className="pres-nav-btn"
                >
                    <ChevronLeft size={24} />
                </button>
                
                <div className="pres-progress">
                    {frames.map((_, i) => (
                        <div 
                            key={i} 
                            className={`pres-dot ${i === currentIndex ? 'active' : ''}`}
                            onClick={() => setCurrentIndex(i)}
                        />
                    ))}
                </div>

                <button 
                    disabled={currentIndex === frames.length - 1}
                    onClick={handleNext}
                    className="pres-nav-btn"
                >
                    <ChevronRight size={24} />
                </button>
            </div>
        </div>
    );
}
