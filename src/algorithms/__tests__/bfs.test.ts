import { describe, it, expect } from 'vitest';
import { NetworkManager } from '../../core/manager';
import { bfs } from '../../algorithms/bfs';

interface Item { v: number; type?: string }

describe('bfs', () => {
  it('traverses reachable nodes in breadth-first order', () => {
    const mgr = new NetworkManager<Item>();
    // Rules: connect to smaller value; bidirectional for same type
    const connectToSmaller = { match: (s: Item, t: Item) => s.v > t.v };
    const sameType = { match: (s: Item, t: Item) => !!s.type && s.type === t.type, bidirectional: true };

    mgr.createNode('n1', { v: 1, type: 'x' }, [sameType]);
    mgr.createNode('n2', { v: 2, type: 'x' }, [connectToSmaller]); // edges: n2->n1 + sameType n2<->n1
    mgr.createNode('n3', { v: 3 }, [connectToSmaller]); // edges: n3->n1, n3->n2

    const n4 = mgr.createNode('n4', { v: 4 }, [connectToSmaller]); // edges: n4->n1,n2,n3

    const order = bfs(mgr.network, n4, {})
      .map(n => n.id);
    // From n4, neighbors (level1) = n1,n2,n3 (order determined by insertion/Set iteration).
    // Level2 will include those reachable from its level1 nodes (but already visited avoidance).
    expect(order[0]).toBe('n4');
    expect(new Set(order.slice(1))).toEqual(new Set(['n1', 'n2', 'n3']));
    expect(order.length).toBe(4);
  });

  it('accepts start id string', () => {
    const mgr = new NetworkManager<Item>();
    mgr.createNode('a', { v: 1 });
    mgr.createNode('b', { v: 2 }, [{ match: (s: Item, t: Item) => s.v > t.v }]);
    const order = bfs(mgr.network, 'b', {})
      .map(n => n.id);
    expect(order).toEqual(['b', 'a']);
  });

  it('invokes visitor with depth and can early stop', () => {
    const mgr = new NetworkManager<Item>();
    // Construct a simple chain c -> b -> a so that a is only discovered after b.
    const linkToNext = { match: (s: Item, t: Item) => s.v - 1 === t.v };
    mgr.createNode('a', { v: 1 }); // no outgoing
    const b = mgr.createNode('b', { v: 2 }, [linkToNext]); // b -> a
    const c = mgr.createNode('c', { v: 3 }, [linkToNext]); // c -> b
    const seen: [string, number][] = [];
    const order = bfs(mgr.network, c, {
      visit: (node, depth) => {
        seen.push([node.id, depth]);
        if (node.id === b.id) return false; // early stop after reaching b
      },
    })
      .map(n => n.id);
    expect(order[0]).toBe('c');
    expect(order).toContain('b');
    expect(order).not.toContain('a'); // a would be discovered via b but traversal stopped early
    const depths = Object.fromEntries(seen);
    expect(depths.c).toBe(0);
    expect(depths.b).toBe(1);
  });

  it('throws if start id not found', () => {
    const mgr = new NetworkManager<Item>();
    expect(() => bfs(mgr.network, 'missing', {})).toThrow(/Start node not found/);
  });

  it('limits traversal by maxDepth', () => {
    const mgr = new NetworkManager<Item>();
    const a = mgr.createNode('a', { v: 1 });
    const b = mgr.createNode('b', { v: 2 });
    const c = mgr.createNode('c', { v: 3 });
    const d = mgr.createNode('d', { v: 4 });
    // Manually wire a->b->c->d
    mgr.network.addEdge(a, b);
    mgr.network.addEdge(b, c);
    mgr.network.addEdge(c, d);

    const depth1 = bfs(mgr.network, a, { maxDepth: 1 }).map(n => n.id);
    expect(depth1).toEqual(['a', 'b']);
    const depth2 = bfs(mgr.network, a, { maxDepth: 2 }).map(n => n.id);
    expect(depth2).toEqual(['a', 'b', 'c']);
  });

  it('treats nodes returning expand=false as barriers (still visited)', () => {
    const mgr = new NetworkManager<Item>();
    const a = mgr.createNode('a', { v: 1 });
    const b = mgr.createNode('b', { v: 2 });
    const c = mgr.createNode('c', { v: 3 });
    // chain a->b->c
    mgr.network.addEdge(a, b);
    mgr.network.addEdge(b, c);

    const order = bfs(mgr.network, a, { expand: node => node.id !== 'b' })
      .map(n => n.id);
    expect(order).toEqual(['a', 'b']);
  });
});
