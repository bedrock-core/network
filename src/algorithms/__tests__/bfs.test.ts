import { describe, it, expect } from 'vitest';
import { NetworkManager } from '../../core/manager';
import { bfs } from '../../algorithms/bfs';

interface Item { v: number; type?: string }

describe('bfs', () => {
  it('traverses reachable nodes in breadth-first order (mutual consent)', () => {
    const mgr = new NetworkManager<Item>();
    const universal = { match: () => true };
    const n1 = mgr.createNode('n1', { v: 1 }, [universal]);
    const n2 = mgr.createNode('n2', { v: 2 }, [universal]);
    const n3 = mgr.createNode('n3', { v: 3 }, [universal]);
    const n4 = mgr.createNode('n4', { v: 4 }, [universal]);
    const order = bfs(mgr.network, n4, {}).map(n => n.id);
    expect(order[0]).toBe('n4');
    expect(new Set(order.slice(1))).toEqual(new Set(['n1', 'n2', 'n3']));
    expect(order.length).toBe(4);
  });

  it('accepts start id string', () => {
    const mgr = new NetworkManager<Item>();
    const rule = { match: (s: Item, t: Item) => true };
    mgr.createNode('a', { v: 1 }, [rule]);
    mgr.createNode('b', { v: 2 }, [rule]);
    const order = bfs(mgr.network, 'b', {})
      .map(n => n.id);
    expect(order).toEqual(['b', 'a']);
  });

  it('invokes visitor with depth and can early stop', () => {
    const mgr = new NetworkManager<Item>();
    // Construct a simple chain c -> b -> a so that a is only discovered after b.
    const linkToNext = { match: (s: Item, t: Item) => Math.abs(s.v - t.v) === 1 }; // symmetric chain
    const a = mgr.createNode('a', { v: 1 }, [linkToNext]);
    const b = mgr.createNode('b', { v: 2 }, [linkToNext]);
    const c = mgr.createNode('c', { v: 3 }, [linkToNext]);
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
