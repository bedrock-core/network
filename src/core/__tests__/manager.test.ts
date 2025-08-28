import { describe, it, expect } from 'vitest';
import { NetworkManager } from '../../core/manager';
import { Network, RuleDirection } from '../../core/types';
import type { Rule } from '../../core/types';

interface Item { value: number; kind?: string }

const gtRule = (threshold: number): Rule<Item> => ({ match: (s, t) => s.value > t.value && s.value > threshold });
const sameKindRule: Rule<Item> = { match: (s, t) => !!s.kind && s.kind === t.kind };
const evenToOddRule: Rule<Item> = { targetFilter: t => t.value % 2 === 1, match: (s, t) => s.value % 2 === 0 && t.value % 2 === 1 };
const universalRule: Rule<Item> = { match: () => true }; // desires connection to any node; still needs reciprocity

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

  it('does not create edge when only newer node wants existing (unilateral)', () => {
    const mgr = new NetworkManager<Item>();
    const a = mgr.createNode('a', { value: 1 });
    const b = mgr.createNode('b', { value: 5 }, [gtRule(2)]); // wants a but a has no reciprocal rule
    const bAdj = mgr.network.adjacent(b)!;
    expect([...bAdj].map(n => n.id)).not.toContain(a.id);
  });

  it('creates edges when mutual rules both match (greater-than reciprocal variant)', () => {
    const mgr = new NetworkManager<Item>();
    // Both nodes have rule that links to smaller values, so when second inserts it wants first; when third inserts it wants both.
    // Reciprocity: smaller nodes also need a rule that matches larger? For this test we give all nodes universal rule to smaller + larger via sameKind rule.
    const anyKindRule: Rule<Item> = { match: () => true };
    const a = mgr.createNode('a', { value: 10, kind: 'k' }, [anyKindRule]);
    const b = mgr.createNode('b', { value: 3, kind: 'k' }, [anyKindRule]);
    const aAdj = mgr.network.adjacent(a)!;
    const bAdj = mgr.network.adjacent(b)!;
    expect([...aAdj].map(n => n.id)).toContain(b.id);
    expect([...bAdj].map(n => n.id)).toContain(a.id);
  });

  it('creates reciprocal edges only when both sides have matching sameKind rule', () => {
    const mgr = new NetworkManager<Item>();
    const a = mgr.createNode('a', { value: 1, kind: 'x' }, [sameKindRule]);
    const b = mgr.createNode('b', { value: 2, kind: 'x' }, [sameKindRule]);
    const aAdj = mgr.network.adjacent(a)!;
    const bAdj = mgr.network.adjacent(b)!;
    expect([...aAdj].map(n => n.id)).toContain(b.id);
    expect([...bAdj].map(n => n.id)).toContain(a.id);
    expect(aAdj.size).toBe(1);
    expect(bAdj.size).toBe(1);
  });

  it('uses targetFilter + reciprocal rule to connect even<->odd pairs', () => {
    const mgr = new NetworkManager<Item>();
    const oddAcceptEven: Rule<Item> = { targetFilter: t => t.value % 2 === 0, match: (s, t) => s.value % 2 === 1 && t.value % 2 === 0 };
    const odd1 = mgr.createNode('odd1', { value: 1 }, [oddAcceptEven]);
    mgr.createNode('odd3', { value: 3 }, [oddAcceptEven]);
    const even2 = mgr.createNode('even2', { value: 2 }, [evenToOddRule]);
    const evenAdj = [...mgr.network.adjacent(even2)!].map(n => n.id).sort();
    const odd1Adj = [...mgr.network.adjacent(odd1)!].map(n => n.id).sort();
    expect(evenAdj).toEqual(['odd1', 'odd3']);
    expect(odd1Adj).toContain('even2');
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

  it('updates node data without recomputing edges automatically (reciprocal sameKind)', () => {
    const mgr = new NetworkManager<Item>();
    const a = mgr.createNode('a', { value: 10, kind: 'k' }, [sameKindRule]);
    const b = mgr.createNode('b', { value: 5, kind: 'k' }, [sameKindRule]);
    const aAdjPre = mgr.network.adjacent(a)!;
    expect([...aAdjPre].map(n => n.id)).toContain(b.id);
    mgr.updateNodeData('b', { value: 50, kind: 'k' });
    const aAdjPost = mgr.network.adjacent(a)!;
    expect([...aAdjPost].map(n => n.id)).toContain(b.id);
  });

  it('auto-instantiates provided network class subtype when only constructor is passed', () => {
    class CustomNetwork extends Network<Item> {
      readonly kind = 'custom';
    }
    const mgr = new NetworkManager<Item, CustomNetwork>(CustomNetwork);
    expect(mgr.network).toBeInstanceOf(CustomNetwork);
    expect(mgr.network.kind).toBe('custom');
  });

  it('uses provided existing network instance when passed as second argument', () => {
    class CustomNetwork extends Network<Item> {
      value = 123;
    }
    const instance = new CustomNetwork();
    const mgr = new NetworkManager<Item, CustomNetwork>(undefined, instance);
    expect(mgr.network).toBe(instance);
    instance.value = 999;
    expect(mgr.network.value).toBe(999); // same object
  });

  it('prefers provided instance over class when both are supplied', () => {
    class CustomNetwork extends Network<Item> {
      tag = 'fromClass';
    }
    const inst = new CustomNetwork();
    inst.tag = 'fromInstance';
    const mgr = new NetworkManager<Item, CustomNetwork>(CustomNetwork, inst);
    expect(mgr.network).toBe(inst);
    expect(mgr.network.tag).toBe('fromInstance');
  });

  it('does NOT connect when only one side desires (universal vs non-matching sameKind)', () => {
    const mgr = new NetworkManager<Item>();
    const a = mgr.createNode('a', { value: 1, kind: 'x' }, [universalRule]);
    // b only wants sameKind; kinds differ
    const b = mgr.createNode('b', { value: 2, kind: 'y' }, [sameKindRule]);
    const aAdj = [...mgr.network.adjacent(a)!].map(n => n.id);
    const bAdj = [...mgr.network.adjacent(b)!].map(n => n.id);
    expect(aAdj).not.toContain('b');
    expect(bAdj).not.toContain('a');
  });

  it('universal + sameKind (matching kinds) connects once per direction after reciprocity', () => {
    const mgr = new NetworkManager<Item>();
    const a = mgr.createNode('a', { value: 1, kind: 'z' }, [universalRule]);
    const b = mgr.createNode('b', { value: 2, kind: 'z' }, [sameKindRule]);
    const aAdj = [...mgr.network.adjacent(a)!].map(n => n.id);
    const bAdj = [...mgr.network.adjacent(b)!].map(n => n.id);
    expect(aAdj).toContain('b');
    expect(bAdj).toContain('a');
    expect(aAdj.length).toBe(1);
    expect(bAdj.length).toBe(1);
  });

  it('creates one-way edge with outgoing-only initiator and incoming-only acceptor', () => {
    const mgr = new NetworkManager<Item>();
    const outgoingAll: Rule<Item> = { direction: RuleDirection.Outgoing, match: () => true };
    const incomingAll: Rule<Item> = { direction: RuleDirection.Incoming, match: () => true };
    const a = mgr.createNode('a', { value: 1 }, [outgoingAll]);
    const b = mgr.createNode('b', { value: 2 }, [incomingAll]);
    const aAdj = [...mgr.network.adjacent(a)!].map(n => n.id);
    const bAdj = mgr.network.adjacent(b) ? [...mgr.network.adjacent(b)!].map(n => n.id) : [];
    expect(aAdj).toContain('b'); // a->b
    expect(bAdj).not.toContain('a'); // b has no outgoing rule so no reverse edge
  });

  it('does not connect when both nodes are outgoing-only', () => {
    const mgr = new NetworkManager<Item>();
    const outRule: Rule<Item> = { direction: RuleDirection.Outgoing, match: () => true };
    const a = mgr.createNode('a', { value: 1 }, [outRule]);
    const b = mgr.createNode('b', { value: 2 }, [outRule]);
    const aAdj = mgr.network.adjacent(a)!;
    const bAdj = mgr.network.adjacent(b)!;
    expect(aAdj.size).toBe(0);
    expect(bAdj.size).toBe(0);
  });

  it('does not connect when both nodes are incoming-only', () => {
    const mgr = new NetworkManager<Item>();
    const inRule: Rule<Item> = { direction: RuleDirection.Incoming, match: () => true };
    const a = mgr.createNode('a', { value: 1 }, [inRule]);
    const b = mgr.createNode('b', { value: 2 }, [inRule]);
    const aAdj = mgr.network.adjacent(a)!;
    const bAdj = mgr.network.adjacent(b)!;
    expect(aAdj.size).toBe(0);
    expect(bAdj.size).toBe(0);
  });

  it('creates edges to new both-capable node; existing one-way edge remains one-way', () => {
    const mgr = new NetworkManager<Item>();
    const outgoingAll: Rule<Item> = { direction: RuleDirection.Outgoing, match: () => true };
    const incomingAll: Rule<Item> = { direction: RuleDirection.Incoming, match: () => true };
    // a initiates, b only accepts -> one-way a->b
    const a = mgr.createNode('a', { value: 1 }, [outgoingAll]);
    const b = mgr.createNode('b', { value: 2 }, [incomingAll]);
    // Now add c that can connect both ways acting as both to a & b
    const bothAll: Rule<Item> = { direction: RuleDirection.Both, match: () => true };
    const c = mgr.createNode('c', { value: 3 }, [bothAll]);
    const aAdj = [...mgr.network.adjacent(a)!].map(n => n.id);
    const bAdj = [...mgr.network.adjacent(b)!].map(n => n.id);
    const cAdj = [...mgr.network.adjacent(c)!].map(n => n.id).sort();
    expect(aAdj).toContain('b');
    expect(bAdj).not.toContain('a'); // still one-way
    expect(cAdj).toEqual(['b']);
  });
});
