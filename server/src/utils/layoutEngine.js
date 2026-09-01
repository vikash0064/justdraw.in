/**
 * Layout Engine — Algorithmic positioning for AI-generated diagrams.
 * Provides tree, grid, DAG, and force-directed layout strategies.
 */

/**
 * Main layout dispatcher
 * @param {Array} nodes - Canvas elements (non-arrows)
 * @param {Array} edges - Arrow elements with fromId/toId
 * @param {Object} options - { algorithm, direction, spacing }
 * @returns {Object} Map of elementId → { x, y }
 */
function layout(nodes, edges, options = {}) {
    const { algorithm = 'tree', direction = 'TB', spacing = 80 } = options;

    switch (algorithm) {
        case 'tree':
            return treeLayout(nodes, edges, direction, spacing);
        case 'grid':
            return gridLayout(nodes, spacing);
        case 'dag':
            return dagLayout(nodes, edges, direction, spacing);
        case 'force':
            return forceLayout(nodes, edges, spacing);
        default:
            return treeLayout(nodes, edges, direction, spacing);
    }
}

/**
 * Tree / Hierarchical layout
 * Finds root nodes (no incoming edges) and positions children below them
 */
function treeLayout(nodes, edges, direction, spacing) {
    if (nodes.length === 0) return {};

    const positions = {};
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Build adjacency list
    const children = new Map(); // parentId → [childIds]
    const hasParent = new Set();

    for (const edge of edges) {
        if (edge.fromId && edge.toId && nodeMap.has(edge.fromId) && nodeMap.has(edge.toId)) {
            if (!children.has(edge.fromId)) children.set(edge.fromId, []);
            children.get(edge.fromId).push(edge.toId);
            hasParent.add(edge.toId);
        }
    }

    // Find root nodes (no incoming edges)
    const roots = nodes.filter(n => !hasParent.has(n.id));
    if (roots.length === 0) {
        // Fallback: use first node as root
        roots.push(nodes[0]);
    }

    const nodeWidth = 180;
    const nodeHeight = 90;
    const hSpacing = spacing + nodeWidth;
    const vSpacing = spacing + nodeHeight;

    // BFS to compute subtree widths
    function subtreeWidth(nodeId, visited = new Set()) {
        if (visited.has(nodeId)) return 1;
        visited.add(nodeId);
        const kids = children.get(nodeId) || [];
        if (kids.length === 0) return 1;
        return kids.reduce((sum, kid) => sum + subtreeWidth(kid, visited), 0);
    }

    // Position nodes recursively
    function positionNode(nodeId, x, y, depth, visited = new Set()) {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        if (direction === 'TB' || direction === 'BT') {
            positions[nodeId] = { x, y: direction === 'BT' ? -y : y };
        } else {
            positions[nodeId] = { x: direction === 'RL' ? -y : y, y: x };
        }

        const kids = children.get(nodeId) || [];
        if (kids.length === 0) return;

        const totalWidth = kids.reduce((sum, kid) => sum + subtreeWidth(kid, new Set(visited)), 0);
        let currentX = x - ((totalWidth - 1) * hSpacing) / 2;

        for (const kid of kids) {
            const kidWidth = subtreeWidth(kid, new Set(visited));
            const kidX = currentX + ((kidWidth - 1) * hSpacing) / 2;
            positionNode(kid, kidX, y + vSpacing, depth + 1, visited);
            currentX += kidWidth * hSpacing;
        }
    }

    // Layout each root tree
    let rootOffset = 0;
    const visited = new Set();
    for (const root of roots) {
        const width = subtreeWidth(root.id);
        positionNode(root.id, rootOffset + ((width - 1) * hSpacing) / 2, 100, 0, visited);
        rootOffset += width * hSpacing + spacing;
    }

    // Position any orphan nodes that weren't connected
    let orphanX = rootOffset;
    for (const node of nodes) {
        if (!positions[node.id]) {
            positions[node.id] = { x: orphanX, y: 100 };
            orphanX += hSpacing;
        }
    }

    return positions;
}

/**
 * Grid layout — arranges all nodes in a uniform grid
 */
function gridLayout(nodes, spacing) {
    if (nodes.length === 0) return {};

    const positions = {};
    const nodeWidth = 180;
    const nodeHeight = 90;
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const hSpacing = spacing + nodeWidth;
    const vSpacing = spacing + nodeHeight;

    nodes.forEach((node, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        positions[node.id] = {
            x: 100 + col * hSpacing,
            y: 100 + row * vSpacing,
        };
    });

    return positions;
}

/**
 * DAG layout — Topological sort based
 */
function dagLayout(nodes, edges, direction, spacing) {
    if (nodes.length === 0) return {};

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const adjList = new Map();
    const inDegree = new Map();

    // Initialise
    for (const n of nodes) {
        adjList.set(n.id, []);
        inDegree.set(n.id, 0);
    }

    for (const edge of edges) {
        if (edge.fromId && edge.toId && nodeMap.has(edge.fromId) && nodeMap.has(edge.toId)) {
            adjList.get(edge.fromId).push(edge.toId);
            inDegree.set(edge.toId, (inDegree.get(edge.toId) || 0) + 1);
        }
    }

    // Kahn's algorithm for topological sort → assign levels
    const queue = [];
    const levels = new Map();

    for (const [id, deg] of inDegree) {
        if (deg === 0) {
            queue.push(id);
            levels.set(id, 0);
        }
    }

    while (queue.length > 0) {
        const current = queue.shift();
        const currentLevel = levels.get(current);
        for (const neighbor of adjList.get(current) || []) {
            inDegree.set(neighbor, inDegree.get(neighbor) - 1);
            if (!levels.has(neighbor) || levels.get(neighbor) < currentLevel + 1) {
                levels.set(neighbor, currentLevel + 1);
            }
            if (inDegree.get(neighbor) === 0) {
                queue.push(neighbor);
            }
        }
    }

    // Handle nodes not reached by BFS (cycles or disconnected)
    for (const n of nodes) {
        if (!levels.has(n.id)) {
            levels.set(n.id, 0);
        }
    }

    // Group by level
    const levelGroups = new Map();
    for (const [id, level] of levels) {
        if (!levelGroups.has(level)) levelGroups.set(level, []);
        levelGroups.get(level).push(id);
    }

    const positions = {};
    const nodeWidth = 180;
    const nodeHeight = 90;
    const hSpacing = spacing + nodeWidth;
    const vSpacing = spacing + nodeHeight;

    for (const [level, ids] of levelGroups) {
        const totalWidth = ids.length * hSpacing;
        const startX = -(totalWidth / 2) + hSpacing / 2 + 400;

        ids.forEach((id, i) => {
            if (direction === 'TB' || direction === 'BT') {
                const yMult = direction === 'BT' ? -1 : 1;
                positions[id] = { x: startX + i * hSpacing, y: 100 + level * vSpacing * yMult };
            } else {
                const xMult = direction === 'RL' ? -1 : 1;
                positions[id] = { x: 100 + level * hSpacing * xMult, y: startX + i * vSpacing };
            }
        });
    }

    return positions;
}

/**
 * Force-directed layout — simple spring simulation
 */
function forceLayout(nodes, edges, spacing) {
    if (nodes.length === 0) return {};

    // Initialise positions randomly around center
    const positions = {};
    const velocities = {};
    const centerX = 400;
    const centerY = 300;

    nodes.forEach((n, i) => {
        const angle = (2 * Math.PI * i) / nodes.length;
        const radius = 200;
        positions[n.id] = {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
        };
        velocities[n.id] = { x: 0, y: 0 };
    });

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const edgePairs = edges
        .filter(e => e.fromId && e.toId && nodeMap.has(e.fromId) && nodeMap.has(e.toId))
        .map(e => [e.fromId, e.toId]);

    // Run simulation
    const iterations = 100;
    const repulsion = 5000;
    const attraction = 0.01;
    const damping = 0.9;

    for (let iter = 0; iter < iterations; iter++) {
        // Repulsion between all node pairs
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i].id;
                const b = nodes[j].id;
                const dx = positions[a].x - positions[b].x;
                const dy = positions[a].y - positions[b].y;
                const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
                const force = repulsion / (dist * dist);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                velocities[a].x += fx;
                velocities[a].y += fy;
                velocities[b].x -= fx;
                velocities[b].y -= fy;
            }
        }

        // Attraction along edges
        for (const [fromId, toId] of edgePairs) {
            const dx = positions[fromId].x - positions[toId].x;
            const dy = positions[fromId].y - positions[toId].y;
            const fx = dx * attraction;
            const fy = dy * attraction;
            velocities[fromId].x -= fx;
            velocities[fromId].y -= fy;
            velocities[toId].x += fx;
            velocities[toId].y += fy;
        }

        // Apply velocities with damping
        for (const n of nodes) {
            velocities[n.id].x *= damping;
            velocities[n.id].y *= damping;
            positions[n.id].x += velocities[n.id].x;
            positions[n.id].y += velocities[n.id].y;
        }
    }

    // Normalise — shift so minimum position is at (100, 100)
    let minX = Infinity, minY = Infinity;
    for (const p of Object.values(positions)) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
    }
    for (const id of Object.keys(positions)) {
        positions[id].x = Math.round(positions[id].x - minX + 100);
        positions[id].y = Math.round(positions[id].y - minY + 100);
    }

    return positions;
}

module.exports = { layout, treeLayout, gridLayout, dagLayout, forceLayout };
