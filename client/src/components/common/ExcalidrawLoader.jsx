import React from 'react';
import { motion } from 'framer-motion';
import '../../styles/excalidraw-loader.css';

/**
 * ExcalidrawLoader - Playful, bouncy 3-shape animated loader matching Excalidraw
 * Features realistic bounce physics, elastic squash & stretch, dynamic rotation, and ground shadows.
 * 
 * @param {Object} props
 * @param {boolean} [props.fullScreen=true] - Fullscreen or inline
 * @param {'sm'|'default'|'lg'} [props.size='default'] - Size variation
 */
export const ExcalidrawLoader = ({ fullScreen = true, size = 'default' }) => {
    return (
        <div className={`exc-minimal-loader-wrapper ${fullScreen ? 'fullscreen' : 'inline'} size-${size}`}>
            <div className="exc-shapes-row">
                {/* 1. Yellow Diamond */}
                <div className="exc-shape-item">
                    <motion.div
                        className="exc-shape exc-shape-diamond"
                        animate={{
                            y: [0, -20, 0, 3, 0],
                            rotate: [45, 135, 225, 315, 405],
                            scaleX: [1, 0.85, 1.16, 0.95, 1],
                            scaleY: [1, 1.18, 0.82, 1.06, 1],
                        }}
                        transition={{
                            duration: 1.15,
                            repeat: Infinity,
                            ease: "easeInOut",
                            times: [0, 0.35, 0.7, 0.85, 1],
                            delay: 0,
                        }}
                    />
                    <motion.div
                        className="exc-shape-shadow"
                        animate={{
                            scale: [1, 0.4, 1, 1.2, 1],
                            opacity: [0.6, 0.15, 0.6, 0.85, 0.6],
                        }}
                        transition={{
                            duration: 1.15,
                            repeat: Infinity,
                            ease: "easeInOut",
                            times: [0, 0.35, 0.7, 0.85, 1],
                            delay: 0,
                        }}
                    />
                </div>

                {/* 2. Green Square */}
                <div className="exc-shape-item">
                    <motion.div
                        className="exc-shape exc-shape-square"
                        animate={{
                            y: [0, -20, 0, 3, 0],
                            rotate: [0, -18, 0, 8, 0],
                            scaleX: [1, 0.84, 1.2, 0.94, 1],
                            scaleY: [1, 1.2, 0.8, 1.06, 1],
                        }}
                        transition={{
                            duration: 1.15,
                            repeat: Infinity,
                            ease: "easeInOut",
                            times: [0, 0.35, 0.7, 0.85, 1],
                            delay: 0.18,
                        }}
                    />
                    <motion.div
                        className="exc-shape-shadow"
                        animate={{
                            scale: [1, 0.4, 1, 1.2, 1],
                            opacity: [0.6, 0.15, 0.6, 0.85, 0.6],
                        }}
                        transition={{
                            duration: 1.15,
                            repeat: Infinity,
                            ease: "easeInOut",
                            times: [0, 0.35, 0.7, 0.85, 1],
                            delay: 0.18,
                        }}
                    />
                </div>

                {/* 3. Coral Red Circle */}
                <div className="exc-shape-item">
                    <motion.div
                        className="exc-shape exc-shape-circle"
                        animate={{
                            y: [0, -20, 0, 3, 0],
                            scaleX: [1, 0.8, 1.24, 0.94, 1],
                            scaleY: [1, 1.24, 0.76, 1.06, 1],
                        }}
                        transition={{
                            duration: 1.15,
                            repeat: Infinity,
                            ease: "easeInOut",
                            times: [0, 0.35, 0.7, 0.85, 1],
                            delay: 0.36,
                        }}
                    />
                    <motion.div
                        className="exc-shape-shadow"
                        animate={{
                            scale: [1, 0.4, 1, 1.2, 1],
                            opacity: [0.6, 0.15, 0.6, 0.85, 0.6],
                        }}
                        transition={{
                            duration: 1.15,
                            repeat: Infinity,
                            ease: "easeInOut",
                            times: [0, 0.35, 0.7, 0.85, 1],
                            delay: 0.36,
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default ExcalidrawLoader;
