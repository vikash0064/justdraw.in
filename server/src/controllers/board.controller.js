const Board = require('../models/Board');
const Page = require('../models/Page');
const Workspace = require('../models/Workspace');
const { boardCache } = require('../utils/lruCache');
const { boardIndexTrie } = require('../utils/trie');

// @desc    Create a board in a workspace
// @route   POST /api/workspaces/:wsId/boards
const createBoard = async (req, res) => {
    try {
        const { title, mode } = req.body;

        // Verify workspace exists and user is a member
        const workspace = await Workspace.findById(req.params.wsId);
        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        const userIdStr = req.user._id.toString();
        const isOwner = (workspace.owner?._id || workspace.owner)?.toString() === userIdStr;
        const isMember = isOwner || (workspace.members || []).some(m => {
            const memberId = (m.user?._id || m.user)?.toString();
            return memberId === userIdStr;
        });
        if (!isMember) {
            return res.status(403).json({ message: 'Not a member of this workspace' });
        }

        const board = await Board.create({
            title: title || 'Untitled Board',
            workspace: req.params.wsId,
            createdBy: req.user._id,
            mode: mode || 'whiteboard',
        });

        // Create a default first page
        await Page.create({
            board: board._id,
            order: 0,
            title: 'Page 1',
        });

        // ── DSA Integration: Buffer new board in O(1) LRU Cache & index in O(k) Trie ──
        boardCache.put(board._id.toString(), board);
        boardIndexTrie.insert(board.title, {
            id: board._id,
            title: board.title,
            workspace: board.workspace,
            mode: board.mode,
        });

        res.status(201).json(board);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create board', error: error.message });
    }
};

// @desc    Get all boards in a workspace
// @route   GET /api/workspaces/:wsId/boards
const getBoards = async (req, res) => {
    try {
        const boards = await Board.find({ workspace: req.params.wsId })
            .populate('createdBy', 'name email avatar')
            .sort({ updatedAt: -1, createdAt: -1 })
            .lean();

        // ── DSA Integration: Hydrate RAM Cache & Prefix Trie during workspace bulk loads ──
        boards.forEach((b) => {
            boardCache.put(b._id.toString(), b);
            boardIndexTrie.insert(b.title, {
                id: b._id,
                title: b.title,
                workspace: b.workspace,
                mode: b.mode,
            });
        });

        res.json(boards);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch boards', error: error.message });
    }
};

// @desc    Get single board
// @route   GET /api/boards/:id
const getBoard = async (req, res) => {
    try {
        const boardId = req.params.id;

        // ── DSA O(1) Read-Through Cache optimization ──
        const cachedBoard = boardCache.get(boardId);
        if (cachedBoard) {
            return res.json({
                ...(cachedBoard.toObject ? cachedBoard.toObject() : cachedBoard),
                _fromCache: true,
            });
        }

        const board = await Board.findById(boardId)
            .populate('createdBy', 'name email avatar')
            .populate('workspace', 'name')
            .lean();

        if (!board) {
            return res.status(404).json({ message: 'Board not found' });
        }

        // Cache miss: promote fetched document into O(1) LRU cache and Prefix Trie
        boardCache.put(boardId, board);
        boardIndexTrie.insert(board.title, {
            id: board._id,
            title: board.title,
            workspace: board.workspace,
            mode: board.mode,
        });

        res.json(board);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch board', error: error.message });
    }
};

// @desc    Update board
// @route   PUT /api/boards/:id
const updateBoard = async (req, res) => {
    try {
        const board = await Board.findById(req.params.id);

        if (!board) {
            return res.status(404).json({ message: 'Board not found' });
        }

        const oldTitle = board.title;
        const { title, mode } = req.body;
        if (title) board.title = title;
        if (mode) board.mode = mode;

        await board.save();

        // ── DSA Integration: Keep RAM Cache and Trie synchronized on edits ──
        boardCache.put(board._id.toString(), board);
        if (title && title !== oldTitle) {
            boardIndexTrie.remove(oldTitle, board._id);
            boardIndexTrie.insert(board.title, {
                id: board._id,
                title: board.title,
                workspace: board.workspace,
                mode: board.mode,
            });
        }

        res.json(board);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update board', error: error.message });
    }
};

// @desc    Delete board and its pages
// @route   DELETE /api/boards/:id
const deleteBoard = async (req, res) => {
    try {
        const board = await Board.findById(req.params.id);

        if (!board) {
            return res.status(404).json({ message: 'Board not found' });
        }

        // Delete all pages belonging to this board
        await Page.deleteMany({ board: board._id });
        await Board.findByIdAndDelete(req.params.id);

        // ── DSA Integration: Evict removed entity from LRU Cache and Trie structure ──
        boardCache.delete(req.params.id);
        boardIndexTrie.remove(board.title, board._id);

        res.json({ message: 'Board and its pages deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete board', error: error.message });
    }
};

// @desc    Fast O(k) prefix autocomplete search for boards using Trie Data Structure
// @route   GET /api/boards/search?q=prefix
const searchBoards = (req, res) => {
    try {
        const { q, limit } = req.query;
        if (!q) {
            return res.json([]);
        }
        const results = boardIndexTrie.searchPrefix(q, parseInt(limit) || 20);
        res.json({
            query: q,
            count: results.length,
            results,
            algorithm: 'O(k) Prefix Trie Autocomplete',
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to search boards', error: error.message });
    }
};

// @desc    Get performance diagnostic telemetry of custom DSA algorithms
// @route   GET /api/boards/dsa/stats
const getDsaStats = (req, res) => {
    res.json({
        lruCache: boardCache.getStats(),
        prefixTrie: {
            totalWordsIndexed: boardIndexTrie.totalWords,
            algorithm: 'Prefix Trie (Retrieval Tree)',
        },
        description: 'Bespoke high-performance data structures built for Centrio SaaS concurrency',
    });
};

// @desc    Get recent boards across all user workspaces in 1 fast query
// @route   GET /api/boards/recent
const getRecentBoards = async (req, res) => {
    try {
        const userId = req.user._id;
        const workspaces = await Workspace.find({
            $or: [
                { 'members.user': userId },
                { owner: userId }
            ]
        }).select('_id name').lean();

        const wsMap = {};
        workspaces.forEach(w => { wsMap[w._id.toString()] = w.name; });

        const wsIds = workspaces.map(w => w._id);
        const boards = await Board.find({ workspace: { $in: wsIds } })
            .select('_id title name mode workspace createdBy createdAt updatedAt')
            .populate('createdBy', 'name email avatar')
            .sort({ updatedAt: -1, createdAt: -1 })
            .limit(16)
            .lean();

        const formatted = boards.map(b => ({
            ...b,
            workspaceName: wsMap[b.workspace?.toString()] || 'Workspace',
            workspaceId: b.workspace,
        }));

        res.json(formatted);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch recent boards', error: error.message });
    }
};

module.exports = {
    createBoard,
    getBoards,
    getBoard,
    getRecentBoards,
    updateBoard,
    deleteBoard,
    searchBoards,
    getDsaStats,
};

