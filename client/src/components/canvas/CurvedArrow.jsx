import React, { useState, useRef, useEffect, useCallback, useId } from 'react';

/**
 * CurvedArrow - An interactive, editable curved arrow component using SVG
 * 
 * @param {Object} props
 * @param {Object} [props.initialPoints] - { start: {x, y}, control: {x, y}, end: {x, y} }
 * @param {boolean} [props.isSelected=true] - Whether the arrow is selected (shows bounding box and handles)
 * @param {function} [props.onChange] - Callback fired when points update: onChange({ start, control, end })
 * @param {string} [props.stroke='#ffffff'] - Stroke color of the arrow
 * @param {number} [props.strokeWidth=2] - Stroke width of the arrow line
 * @param {string} [props.handleColor='#6366f1'] - Color for control handles & selection box
 */
export const CurvedArrow = ({
    initialPoints,
    isSelected = true,
    onChange,
    stroke = '#ffffff',
    strokeWidth = 2,
    handleColor = '#6366f1',
    className = ''
}) => {
    const markerId = useId();

    // Default points if none provided
    const defaultStart = initialPoints?.start || { x: 100, y: 250 };
    const defaultEnd = initialPoints?.end || { x: 450, y: 250 };
    const defaultControl = initialPoints?.control || {
        x: (defaultStart.x + defaultEnd.x) / 2,
        y: (defaultStart.y + defaultEnd.y) / 2 - 80
    };

    // State for the three points
    const [points, setPoints] = useState({
        start: defaultStart,
        control: defaultControl,
        end: defaultEnd
    });

    // Ref to hold latest points to prevent stale closures in global mouse listeners
    const pointsRef = useRef(points);
    useEffect(() => {
        pointsRef.current = points;
    }, [points]);

    // Active drag state: 'start' | 'control' | 'end' | null
    const [draggingHandle, setDraggingHandle] = useState(null);
    const draggingHandleRef = useRef(null);
    const svgRef = useRef(null);

    // Update parent onChange
    const notifyChange = useCallback((newPoints) => {
        if (onChange) {
            onChange(newPoints);
        }
    }, [onChange]);

    // Drag move handler on window
    const handleWindowMouseMove = useCallback((e) => {
        const handle = draggingHandleRef.current;
        if (!handle || !svgRef.current) return;

        const svgRect = svgRef.current.getBoundingClientRect();
        const mouseX = e.clientX - svgRect.left;
        const mouseY = e.clientY - svgRect.top;

        setPoints((prev) => {
            const updated = {
                ...prev,
                [handle]: { x: Math.round(mouseX), y: Math.round(mouseY) }
            };
            pointsRef.current = updated;
            notifyChange(updated);
            return updated;
        });
    }, [notifyChange]);

    // Drag end handler on window
    const handleWindowMouseUp = useCallback(() => {
        draggingHandleRef.current = null;
        setDraggingHandle(null);
        window.removeEventListener('mousemove', handleWindowMouseMove);
        window.removeEventListener('mouseup', handleWindowMouseUp);
    }, [handleWindowMouseMove]);

    // Start dragging a handle
    const handleMouseDownOnPoint = (handleType, e) => {
        e.stopPropagation();
        e.preventDefault();
        draggingHandleRef.current = handleType;
        setDraggingHandle(handleType);

        window.addEventListener('mousemove', handleWindowMouseMove);
        window.addEventListener('mouseup', handleWindowMouseUp);
    };

    // Clean up event listeners on unmount
    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
        };
    }, [handleWindowMouseMove, handleWindowMouseUp]);

    const { start, control, end } = points;

    // Quadratic bezier path definition
    const pathD = `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;

    // Compute bounding box for selection
    const padding = 16;
    const minX = Math.min(start.x, control.x, end.x) - padding;
    const maxX = Math.max(start.x, control.x, end.x) + padding;
    const minY = Math.min(start.y, control.y, end.y) - padding;
    const maxY = Math.max(start.y, control.y, end.y) + padding;
    const bboxWidth = maxX - minX;
    const bboxHeight = maxY - minY;

    return (
        <svg
            ref={svgRef}
            className={`curved-arrow-canvas ${className}`}
            style={{
                width: '100%',
                height: '100%',
                overflow: 'visible',
                userSelect: 'none',
                cursor: draggingHandle ? 'grabbing' : 'default'
            }}
        >
            <defs>
                {/* Clean Excalidraw-Style Arrowhead Marker */}
                <marker
                    id={markerId}
                    viewBox="0 0 12 12"
                    refX="10"
                    refY="6"
                    markerWidth="9"
                    markerHeight="9"
                    orient="auto-start-reverse"
                >
                    <path
                        d="M 2 2 L 10 6 L 2 10"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </marker>
            </defs>

            {/* 1. Selection Bounding Box & Corner Handles (when selected) */}
            {isSelected && (
                <g className="selection-box" opacity="0.85">
                    {/* Dashed Bounding Box */}
                    <rect
                        x={minX}
                        y={minY}
                        width={bboxWidth}
                        height={bboxHeight}
                        fill="none"
                        stroke={handleColor}
                        strokeWidth="1"
                        strokeDasharray="4 4"
                        rx="4"
                    />
                    {/* 4 Corner Resize Handles */}
                    <rect x={minX - 4} y={minY - 4} width="8" height="8" fill="#181824" stroke={handleColor} strokeWidth="1.5" rx="1.5" />
                    <rect x={maxX - 4} y={minY - 4} width="8" height="8" fill="#181824" stroke={handleColor} strokeWidth="1.5" rx="1.5" />
                    <rect x={minX - 4} y={maxY - 4} width="8" height="8" fill="#181824" stroke={handleColor} strokeWidth="1.5" rx="1.5" />
                    <rect x={maxX - 4} y={maxY - 4} width="8" height="8" fill="#181824" stroke={handleColor} strokeWidth="1.5" rx="1.5" />

                    {/* Top Rotation Indicator */}
                    <circle cx={minX + bboxWidth / 2} cy={minY - 14} r="4" fill="#181824" stroke={handleColor} strokeWidth="1.5" />
                    <line x1={minX + bboxWidth / 2} y1={minY} x2={minX + bboxWidth / 2} y2={minY - 10} stroke={handleColor} strokeWidth="1" />
                </g>
            )}

            {/* 2. Tangent Helper Lines from Start & End to Control Point (Subtle Dashed) */}
            {isSelected && (
                <g className="tangent-lines" opacity="0.35">
                    <line x1={start.x} y1={start.y} x2={control.x} y2={control.y} stroke={handleColor} strokeWidth="1" strokeDasharray="3 3" />
                    <line x1={end.x} y1={end.y} x2={control.x} y2={control.y} stroke={handleColor} strokeWidth="1" strokeDasharray="3 3" />
                </g>
            )}

            {/* 3. The Curved Arrow Path */}
            <path
                d={pathD}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                markerEnd={`url(#${markerId})`}
                style={{ cursor: 'pointer' }}
            />

            {/* 4. Interactive Control Points / Draggable Handles */}
            {isSelected && (
                <g className="arrow-handles">
                    {/* Start Point (Tail) - Filled Anchor Ring */}
                    <circle
                        cx={start.x}
                        cy={start.y}
                        r="6"
                        fill={draggingHandle === 'start' ? handleColor : '#1e1e2e'}
                        stroke={handleColor}
                        strokeWidth="2"
                        style={{ cursor: 'grab' }}
                        onMouseDown={(e) => handleMouseDownOnPoint('start', e)}
                    />

                    {/* Control Point (Bend / Midpoint) - Highlighted Bezier Handle */}
                    <circle
                        cx={control.x}
                        cy={control.y}
                        r="7"
                        fill={handleColor}
                        stroke="#ffffff"
                        strokeWidth="2"
                        style={{
                            cursor: 'grab',
                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))'
                        }}
                        onMouseDown={(e) => handleMouseDownOnPoint('control', e)}
                    />

                    {/* End Point (Arrowhead) - Filled Anchor Ring */}
                    <circle
                        cx={end.x}
                        cy={end.y}
                        r="6"
                        fill={draggingHandle === 'end' ? handleColor : '#1e1e2e'}
                        stroke={handleColor}
                        strokeWidth="2"
                        style={{ cursor: 'grab' }}
                        onMouseDown={(e) => handleMouseDownOnPoint('end', e)}
                    />
                </g>
            )}
        </svg>
    );
};

export default CurvedArrow;
