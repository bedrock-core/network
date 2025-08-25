# @bedrock-core/network

Rule‑driven directed graph abstraction. Nodes carry domain data plus an immutable set of edge‑generation rules. Edges are materialized only when nodes are inserted (or removed); updating node data does **not** recompute edges.

## Install

```bash
yarn add @bedrock-core/network
# or
npm install @bedrock-core/network
```

## Quick Example

```ts
import { NetworkManager, Rule } from '@bedrock-core/network';

interface Item { value: number }

const greaterThan: Rule<Item> = {
  match: (s, t) => s.value > t.value,
  // bidirectional?: false
  // targetFilter?: (t) => t.value < 100
};

const mgr = new NetworkManager<Item>();

// Reuse the same rule object for multiple nodes (safe & common)
mgr.createNode('a', { value: 10 }, [greaterThan]);
mgr.createNode('b', { value: 5 },  [greaterThan]); // evaluates a.rules vs b and b.rules vs a
mgr.createNode('c', { value: 20 }, [greaterThan]);

// Edges are fixed until nodes are (re)inserted
mgr.updateNodeData('b', { value: 999 }); // DOES NOT trigger recomputation
```

## Core Concepts

- Rule
  - Pure functions deciding if an edge `source -> target` should exist.
  - Shape: `{ match(sourceObj, targetObj, ...); bidirectional?; targetFilter? }`.
  - Reusable: the same rule instance can be shared across many nodes.
  - Must be treated as immutable once any node is created with it.
  - `targetFilter` is an optional cheap pre‑filter to prune most candidates before `match`.

- Node
  - `{ id, data, rules }`.
  - `rules` array captured at creation time; do not mutate (clone if composing).
  - Changing `data` does not auto‑update edges.

- Network
  - Thin subclass of the underlying graph implementation.

- NetworkManager
  - Orchestrates node lifecycle:
    1. Insert new node.
    2. For each existing node:
       - Evaluate newNode.rules for outgoing edges new -> existing.
       - Evaluate existing.rules for incoming edges existing -> new.
    3. Bidirectional rules add the reverse directed edge explicitly.
  - Removal deletes the node and all incident edges.
  - Data update only mutates the `data` field.

## Edge Evaluation Lifecycle

Event: create node N

- Outgoing: every rule in `N.rules` tested against every previously present node.
- Incoming: every existing node's rules tested with N as target.
- Complexity: O(R * N) per insertion (R = total rules considered).

Event: update node data

- No edge changes.

Event: remove node

- All edges touching the node are removed; no other edges are revisited.

To reflect data‑dependent rule outcomes after a change, remove and recreate affected nodes.

## Rule Reuse

You can (and should) define common rule instances once and supply them to many nodes:

```ts
const connectedIfEven: Rule<Item> = {
  targetFilter: t => (t.value & 1) === 0,
  match: (s, t) => (s.value & 1) === 0 // both even
};

mgr.createNode('n1', { value: 2 }, [connectedIfEven]);
mgr.createNode('n2', { value: 4 }, [connectedIfEven]); // edges formed here
```

Mutating `connectedIfEven` after nodes are created is undefined behavior (do not).

## Bidirectional Rules

If `bidirectional: true` and `match` returns true for `source -> target`, an explicit reverse edge `target -> source` is also added (two directed edges).

## Performance Tips

- Provide a `targetFilter` when you can reject most candidates cheaply.
- Keep `match` side‑effect free and allocation light (it may run many times per insertion).
- If large batch insertion becomes a need, consider a future bulk API (not implemented yet).

## Invariants (Summary)

- Rules are immutable post node creation.
- Edges only change on node insertion/removal (never on data mutation).
- No hidden caches; traversal is over the underlying graph data structure.
- Reverse edges only appear when explicitly requested via `bidirectional`.

## License

MIT
