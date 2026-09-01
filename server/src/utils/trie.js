/**
 * Custom Data Structure: Prefix Trie (Prefix Tree / Retrieval Tree)
 * 
 * Implemented as a specialized tree structure where each node represents a character.
 * Paths down the tree represent words or titles indexed in the Centrio ecosystem.
 * 
 * Application in Centrio:
 * Whiteboard environments accumulate dozens of diagrams and workspaces. Standard SQL/MongoDB regex searches
 * perform sequential scans (O(N) over table entries). Our Prefix Trie achieves ultra-fast autocomplete
 * keyword suggestions in O(k) time, where k is the character length of the search query!
 */

class TrieNode {
    constructor(char = '') {
        this.char = char;
        this.children = new Map(); // char -> TrieNode
        this.isEndOfWord = false;
        this.metadata = []; // Stores matching board/item IDs and labels
    }
}

class PrefixTrie {
    constructor() {
        this.root = new TrieNode();
        this.totalWords = 0;
    }

    /**
     * Insert a title or keyword into the Trie alongside arbitrary item metadata.
     * Time Complexity: O(k), where k is string length.
     * Space Complexity: O(k) across new tree nodes.
     * @param {string} word - The keyword or title (e.g., Board title)
     * @param {Object} data - Arbitrary record payload (e.g., { id: 'board_1', title: 'Architecture Diagram' })
     */
    insert(word, data = {}) {
        if (!word || typeof word !== 'string') return;
        const normalized = word.toLowerCase().trim();
        let current = this.root;

        for (const char of normalized) {
            if (!current.children.has(char)) {
                current.children.set(char, new TrieNode(char));
            }
            current = current.children.get(char);
        }

        if (!current.isEndOfWord) {
            current.isEndOfWord = true;
            this.totalWords++;
        }

        // Avoid duplicate ID insertions in the same word terminal node
        const exists = current.metadata.some(m => m.id && data.id && m.id.toString() === data.id.toString());
        if (!exists) {
            current.metadata.push(data);
        }
    }

    /**
     * Remove a specific record from a word entry in the Trie.
     * Time Complexity: O(k)
     * @param {string} word 
     * @param {string} targetId 
     */
    remove(word, targetId) {
        if (!word || typeof word !== 'string') return false;
        const normalized = word.toLowerCase().trim();
        let current = this.root;
        const path = [current];

        for (const char of normalized) {
            if (!current.children.has(char)) return false;
            current = current.children.get(char);
            path.push(current);
        }

        if (!current.isEndOfWord) return false;

        // Filter out the specific ID
        current.metadata = current.metadata.filter(m => m.id && targetId && m.id.toString() !== targetId.toString());

        // If metadata is empty, unset terminal word state and prune redundant empty leaf branches
        if (current.metadata.length === 0) {
            current.isEndOfWord = false;
            this.totalWords--;

            // Backtrack to prune nodes with no children and no endOfWord flag
            for (let i = path.length - 1; i > 0; i--) {
                const node = path[i];
                const parent = path[i - 1];
                if (!node.isEndOfWord && node.children.size === 0) {
                    parent.children.delete(node.char);
                } else {
                    break;
                }
            }
        }
        return true;
    }

    /**
     * Search for all indexed records whose title starts with the given prefix.
     * Time Complexity: O(k + M) where k is prefix length and M is matched subnodes.
     * @param {string} prefix 
     * @param {number} limit - Max results returned
     * @returns {Array} List of matching metadata records
     */
    searchPrefix(prefix, limit = 20) {
        if (!prefix || typeof prefix !== 'string') return [];
        const normalized = prefix.toLowerCase().trim();
        let current = this.root;

        // Step 1: Navigate to prefix root node in O(k) time
        for (const char of normalized) {
            if (!current.children.has(char)) {
                return []; // Prefix does not exist in our dataset
            }
            current = current.children.get(char);
        }

        // Step 2: DFS traversal from the prefix node to gather matching words
        const results = [];
        this._collectWords(current, results, limit);
        return results;
    }

    /**
     * Helper: Depth-First Search traversal to harvest terminal metadata payloads
     */
    _collectWords(node, results, limit) {
        if (results.length >= limit) return;
        if (node.isEndOfWord && node.metadata.length > 0) {
            for (const item of node.metadata) {
                if (results.length < limit) {
                    results.push(item);
                }
            }
        }
        for (const childNode of node.children.values()) {
            this._collectWords(childNode, results, limit);
            if (results.length >= limit) break;
        }
    }

    /**
     * Clear the Trie structure
     */
    clear() {
        this.root = new TrieNode();
        this.totalWords = 0;
    }
}

// Singleton instance indexing active Board titles across Centrio workspaces
const boardIndexTrie = new PrefixTrie();

module.exports = {
    PrefixTrie,
    boardIndexTrie
};
