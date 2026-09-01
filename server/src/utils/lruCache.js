/**
 * Custom Data Structure: Least Recently Used (LRU) Cache
 * 
 * Implemented using a combination of:
 * 1. Hash Map (JavaScript Map) -> O(1) key lookups and reference tracking.
 * 2. Doubly Linked List -> O(1) removal and re-insertion at head (most recent) or eviction at tail (least recent).
 * 
 * Application in Centrio:
 * Buffers frequently accessed diagram boards and workspaces in memory. During concurrent whiteboard sessions,
 * repeatedly reading board metadata from MongoDB incurs disk and serialization latency. Our O(1) LRU cache
 * intercepts read requests and serves active boards from high-speed Node memory, evicting cold boards automatically.
 */

class DoublyLinkedListNode {
    constructor(key, value) {
        this.key = key;
        this.value = value;
        this.prev = null;
        this.next = null;
    }
}

class LRUCache {
    /**
     * @param {number} capacity - Maximum items before eviction occurs.
     */
    constructor(capacity = 500) {
        if (capacity <= 0) {
            throw new Error('LRUCache capacity must be greater than 0');
        }
        this.capacity = capacity;
        this.cache = new Map();

        // Sentinel dummy head and tail nodes to avoid edge cases in insertion/removal
        this.head = new DoublyLinkedListNode(null, null);
        this.tail = new DoublyLinkedListNode(null, null);
        this.head.next = this.tail;
        this.tail.prev = this.head;

        // Statistics for monitoring performance efficiency
        this.hits = 0;
        this.misses = 0;
    }

    /**
     * Internal Helper: Add a node right after dummy head (mark as most recently used)
     * Time Complexity: O(1)
     */
    _addToHead(node) {
        node.prev = this.head;
        node.next = this.head.next;
        this.head.next.prev = node;
        this.head.next = node;
    }

    /**
     * Internal Helper: Unlink a node from its current position in the list
     * Time Complexity: O(1)
     */
    _removeNode(node) {
        const prevNode = node.prev;
        const nextNode = node.next;
        prevNode.next = nextNode;
        nextNode.prev = prevNode;
    }

    /**
     * Internal Helper: Move an existing node to head (most recently used)
     * Time Complexity: O(1)
     */
    _moveToHead(node) {
        this._removeNode(node);
        this._addToHead(node);
    }

    /**
     * Internal Helper: Evict least recently used node (node right before dummy tail)
     * Time Complexity: O(1)
     */
    _popTail() {
        const res = this.tail.prev;
        if (res === this.head) return null; // Empty list
        this._removeNode(res);
        return res;
    }

    /**
     * Get item from cache by key.
     * Time Complexity: O(1)
     * @param {string} key
     * @returns {any|null}
     */
    get(key) {
        const node = this.cache.get(key);
        if (!node) {
            this.misses++;
            return null;
        }
        // Mark as accessed by promoting to head
        this._moveToHead(node);
        this.hits++;
        return node.value;
    }

    /**
     * Insert or update an item in the cache.
     * Time Complexity: O(1)
     * @param {string} key
     * @param {any} value
     */
    put(key, value) {
        let node = this.cache.get(key);

        if (!node) {
            // New entry: instantiate node and append to head
            const newNode = new DoublyLinkedListNode(key, value);
            this.cache.set(key, newNode);
            this._addToHead(newNode);

            // Evict oldest node if capacity exceeded
            if (this.cache.size > this.capacity) {
                const tail = this._popTail();
                if (tail && tail.key !== null) {
                    this.cache.delete(tail.key);
                }
            }
        } else {
            // Existing entry: update value and promote to head
            node.value = value;
            this._moveToHead(node);
        }
    }

    /**
     * Remove an explicit key from cache (used during entity deletion or invalidation).
     * Time Complexity: O(1)
     * @param {string} key
     * @returns {boolean}
     */
    delete(key) {
        const node = this.cache.get(key);
        if (!node) return false;
        this._removeNode(node);
        this.cache.delete(key);
        return true;
    }

    /**
     * Clear all cached items.
     * Time Complexity: O(1) reference reassignment / O(N) garbage collection
     */
    clear() {
        this.cache.clear();
        this.head.next = this.tail;
        this.tail.prev = this.head;
        this.hits = 0;
        this.misses = 0;
    }

    /**
     * Retrieve diagnostic performance stats
     */
    getStats() {
        return {
            size: this.cache.size,
            capacity: this.capacity,
            hits: this.hits,
            misses: this.misses,
            hitRate: (this.hits + this.misses) === 0 ? 0 : Number((this.hits / (this.hits + this.misses)).toFixed(2))
        };
    }
}

// Singleton instance tuned for Centrio Board buffering
const boardCache = new LRUCache(500);

module.exports = {
    LRUCache,
    boardCache
};
