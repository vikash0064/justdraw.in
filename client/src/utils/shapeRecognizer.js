/**
 * shapeRecognizer.js
 * Analyzes array of freehand stroke points [x1, y1, x2, y2, ...]
 * and recognizes geometric shapes: 'circle', 'rect', 'diamond', 'line', 'arrow'
 */

export function recognizeShapeFromPoints(points) {
    if (!points || points.length < 6) return null;

    // Convert flat array [x1, y1, x2, y2, ...] to 2D points [{x, y}]
    const pts = [];
    for (let i = 0; i < points.length; i += 2) {
        pts.push({ x: points[i], y: points[i + 1] });
    }

    const n = pts.length;
    const startPt = pts[0];
    const endPt = pts[n - 1];

    // Compute bounding box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }

    const width = maxX - minX;
    const height = maxY - minY;

    // Too small -> skip recognition
    if (width < 15 && height < 15) return null;

    // Calculate total stroke length
    let strokeLength = 0;
    for (let i = 1; i < n; i++) {
        strokeLength += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }

    // Distance between start and end point
    const gap = Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y);
    const isClosed = gap < Math.max(30, strokeLength * 0.25);

    // ── 1. Line or Arrow (Open stroke) ──
    if (!isClosed) {
        const directDist = Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y);
        const straightness = directDist / strokeLength;

        if (straightness > 0.75) {
            // Check if end of stroke has a small hook / arrow head
            const dx = endPt.x - startPt.x;
            const dy = endPt.y - startPt.y;
            const isArrow = strokeLength > 40 && gap < directDist * 0.95;

            if (isArrow) {
                return {
                    type: 'arrow',
                    points: [startPt.x, startPt.y, endPt.x, endPt.y]
                };
            } else {
                return {
                    type: 'arrow', // Default line/arrow
                    points: [startPt.x, startPt.y, endPt.x, endPt.y]
                };
            }
        }
    }

    // ── 2. Closed Shapes (Circle, Rect, Diamond) ──
    const aspect = width / Math.max(1, height);
    const centerX = minX + width / 2;
    const centerY = minY + height / 2;

    // Calculate average distance from center (radius consistency check for Circle)
    let avgDist = 0;
    for (const p of pts) {
        avgDist += Math.hypot(p.x - centerX, p.y - centerY);
    }
    avgDist /= n;

    let distVariance = 0;
    for (const p of pts) {
        const d = Math.hypot(p.x - centerX, p.y - centerY);
        distVariance += Math.pow(d - avgDist, 2);
    }
    distVariance = Math.sqrt(distVariance / n) / avgDist;

    // Low variance in distance from center -> CIRCLE
    if (distVariance < 0.22 && aspect > 0.7 && aspect < 1.4) {
        const radius = Math.round((width + height) / 4);
        return {
            type: 'circle',
            x: Math.round(centerX),
            y: Math.round(centerY),
            radius: Math.max(20, radius)
        };
    }

    // Count corners (points with high direction change)
    let cornerCount = 0;
    const step = Math.max(2, Math.floor(n / 20));
    for (let i = step; i < n - step; i += step) {
        const v1 = { x: pts[i].x - pts[i - step].x, y: pts[i].y - pts[i - step].y };
        const v2 = { x: pts[i + step].x - pts[i].x, y: pts[i + step].y - pts[i].y };
        const angle = Math.abs(Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x));
        if (angle > 0.8 && angle < 2.4) {
            cornerCount++;
        }
    }

    // Check if points are clustered near center edges (DIAMOND)
    let topPt = false, rightPt = false, bottomPt = false, leftPt = false;
    const tol = Math.max(10, width * 0.2);
    for (const p of pts) {
        if (Math.abs(p.x - centerX) < tol && Math.abs(p.y - minY) < tol) topPt = true;
        if (Math.abs(p.x - maxX) < tol && Math.abs(p.y - centerY) < tol) rightPt = true;
        if (Math.abs(p.x - centerX) < tol && Math.abs(p.y - maxY) < tol) bottomPt = true;
        if (Math.abs(p.x - minX) < tol && Math.abs(p.y - centerY) < tol) leftPt = true;
    }

    if (topPt && rightPt && bottomPt && leftPt && (aspect > 0.6 && aspect < 1.6)) {
        return {
            type: 'diamond',
            x: Math.round(minX),
            y: Math.round(minY),
            width: Math.round(width),
            height: Math.round(height)
        };
    }

    // Default closed shape -> RECTANGLE
    return {
        type: 'rect',
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.round(width),
        height: Math.round(height),
        edges: 'round'
    };
}
