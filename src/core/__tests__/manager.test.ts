import { describe, it, expect } from 'vitest';
import { NetworkManager } from '../../core/manager';
import type { Rule } from '../../core/types';

interface Item { value: number; kind?: string }

const gtRule = (threshold: number): Rule<Item> => ({ match: (s, t) => s.value > t.value && s.value > threshold });
const sameKindRule: Rule<Item> = { match: (s, t) => !!s.kind && s.kind === t.kind, bidirectional: true };
const evenToOddRule: Rule<Item> = { targetFilter: t => t.value % 2 === 1, match: (s, t) => s.value % 2 === 0 && t.value % 2 === 1 };

describe('NetworkManager', () => {
  it('creates node and prevents duplicate ids', () => {
    const mgr = new NetworkManager<Item>();
    mgr.createNode('a', { value: 1 });
    expect(() => mgr.createNode('a', { value: 2 })).toThrow(/Duplicate/);
  });

  it('throws when creating node with empty id', () => {
    const mgr = new NetworkManager<Item>();
    expect(() => mgr.createNode('', { value: 1 })).toThrow(/Id is required/);
  });

  it('links outgoing edges based on new node rules against existing nodes', () => {
    const mgr = new NetworkManager<Item>();
    const a = mgr.createNode('a', { value: 1 });
    const b = mgr.createNode('b', { value: 5 }, [gtRule(2)]); // b has rule; should create b->a edge (5>1 && >2)
    const bAdj = mgr.network.adjacent(b)!;
    expect([...bAdj].map(n => n.id)).toContain(a.id);
  });

  it('evaluates existing node rules against newly inserted node for incoming edges', () => {
    const mgr = new NetworkManager<Item>();
    const a = mgr.createNode('a', { value: 10 }, [gtRule(2)]); // rule will point to lower values
    const b = mgr.createNode('b', { value: 3 }); // a rule should connect a->b
    const aAdj = mgr.network.adjacent(a)!;
    expect([...aAdj].map(n => n.id)).toContain(b.id);
  });

  it('applies bidirectional rule creating two directed edges', () => {
    const mgr = new NetworkManager<Item>();
    const a = mgr.createNode('a', { value: 1, kind: 'x' }, [sameKindRule]);
    const b = mgr.createNode('b', { value: 2, kind: 'x' });
    const aAdj = mgr.network.adjacent(a)!;
    const bAdj = mgr.network.adjacent(b)!;
    expect([...aAdj].map(n => n.id)).toContain(b.id);
    expect([...bAdj].map(n => n.id)).toContain(a.id);
    // ensure only one edge each direction (Set semantics)
    expect(aAdj.size).toBe(1);
    expect(bAdj.size).toBe(1);
  });

  it('uses targetFilter to prune candidates', () => {
    const mgr = new NetworkManager<Item>();
    const odd1 = mgr.createNode('odd1', { value: 1 });
    const odd3 = mgr.createNode('odd3', { value: 3 });
    const even2 = mgr.createNode('even2', { value: 2 }, [evenToOddRule]);
    const adj = mgr.network.adjacent(even2)!;
    const ids = [...adj].map(n => n.id).sort();
    expect(ids).toEqual([odd1.id, odd3.id]);
  });

  it('removes node and its incident edges', () => {
    const mgr = new NetworkManager<Item>();
    const a = mgr.createNode('a', { value: 1, kind: 'x' }, [sameKindRule]);
    const b = mgr.createNode('b', { value: 2, kind: 'x' });
    mgr.removeNode('b');
    expect(mgr.getNode('b')).toBeUndefined();
    const aAdj = mgr.network.adjacent(a)!;
    expect([...aAdj].some(n => n.id === b.id)).toBe(false);
  });

  it('updates node data without recomputing edges automatically', () => {
    const mgr = new NetworkManager<Item>();
    const a = mgr.createNode('a', { value: 10 }, [gtRule(2)]); // will link to lower values
    const b = mgr.createNode('b', { value: 5 });
    const aAdjPre = mgr.network.adjacent(a)!;
    expect([...aAdjPre].map(n => n.id)).toContain(b.id);
    mgr.updateNodeData('b', { value: 50 }); // Should NOT remove edge a->b automatically
    const aAdjPost = mgr.network.adjacent(a)!;
    expect([...aAdjPost].map(n => n.id)).toContain(b.id);
  });
});
