# @bedrock-core/network

Rule‑driven directed graph abstraction. Nodes carry domain data plus an immutable set of edge‑generation rules. Edges are materialized when nodes are inserted, removed, or when data is updated via `updateNodeData()`.

> ⚠️ Beta Status: This library is currently in active beta. Expect breaking changes in any release without prior deprecation warnings until a stable 1.0.0 is published. Pin exact versions if you need stability.

## Install

```bash
yarn add @bedrock-core/network
# or
npm install @bedrock-core/network
```

## Quick Example

```ts
import { NetworkManager, Rule, RuleDirection } from '@bedrock-core/network';

interface Item { value: number }

const greaterThan: Rule<Item> = {
  direction: RuleDirection.Outgoing, // initiates edges to smaller valued nodes when accepted
  match: (s, t) => s.value > t.value,
};
const acceptSmaller: Rule<Item> = {
  direction: RuleDirection.Incoming, // only accepts connections from higher valued nodes
  match: (self, initiator) => initiator.value > self.value,
};

const mgr = new NetworkManager<Item>();

// Reuse the same rule object for multiple nodes (safe & common)
mgr.createNode('a', { value: 10 }, [greaterThan, acceptSmaller]);
mgr.createNode('b', { value: 5 },  [acceptSmaller]); // b can accept from higher but can't initiate upwards
mgr.createNode('c', { value: 20 }, [greaterThan, acceptSmaller]); // c can initiate to a & b (who accept),
// and a accepts c (a<-c) but b only accepts from higher so c->b edge forms; b has no outgoing to c.
```

## Data Mutation Options

The library provides two approaches for updating node data:

1. **`updateNodeData()`**: Updates data and recalculates all edges for the node
   - Use when data changes should affect edge connectivity
   - Slower but ensures edges reflect current data

2. **Direct mutation**: Modify `node.data` directly via `getNode(id).data`
   - Use for performance-critical scenarios when edges don't need updating
   - Faster but edges remain unchanged

```ts
// Method 1: Recalculate edges
mgr.updateNodeData('nodeId', newData);

// Method 2: Direct mutation (no edge recalculation)
const node = mgr.getNode('nodeId')!;
node.data.someProperty = newValue;
```

## Core Concepts

- Rule
  - Pure edge intent / acceptance predicate.
  - Shape: `{ direction?: 'outgoing'|'incoming'|'both'; match; targetFilter? }`.
  - Direction semantics:
    - outgoing: rule may initiate edges to targets it matches (handshake requires target has an incoming/both rule that matches back).
    - incoming: rule may accept edges initiated by others that match it.
    - both (default): participates in both roles.
  - `targetFilter` (optional) is only applied on the initiating side before calling `match`.
  - Rules are reusable & treated as immutable post node creation.

- Node
  - `{ id, data, rules }`.
  - `rules` array captured at creation time; do not mutate (clone if composing).
  - `data` can be mutated directly for performance, or via `updateNodeData()` for edge recalculation.

- Network
  - Thin subclass of the underlying graph implementation.

- NetworkManager
  - On insertion of node N, for each existing node E performs two independent handshakes:
    1. N -> E: needs an initiating rule on N (outgoing|both) whose `targetFilter` (if any) and `match(N,E)` succeed AND an accepting rule on E (incoming|both) whose `match(E,N)` succeeds.
    2. E -> N: same logic with roles swapped.
  - If only the forward handshake succeeds you get a one‑way edge N->E; if both succeed you have two directed edges.
  - Removal deletes node + incident edges; `updateNodeData()` recalculates edges for the updated node.

## Edge Evaluation Lifecycle

Event: create node N

- Outgoing: every rule in `N.rules` tested against every previously present node.
- Incoming: every existing node's rules tested with N as target.
- Complexity: O(R * N) per insertion (R = total rules considered).

Event: update node data via `updateNodeData()`

- Removes all edges touching the node
- Recalculates edges between the updated node and all other nodes
- Complexity: O(R * N) per update (same as insertion)

Event: direct data mutation

- No edge changes.

Event: remove node

- All edges touching the node are removed; no other edges are revisited.

To reflect data‑dependent rule outcomes after a direct data change, call `updateNodeData()` or remove and recreate the node.

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

## Directionality & One‑Way Edges

Edges are created per direction via handshake (initiator rule + acceptor rule). Reverse direction is independent. This permits:

```ts
const wantsAll: Rule<Item> = { direction: RuleDirection.Outgoing, match: () => true };
const onlyAcceptHigh: Rule<Item> = { direction: RuleDirection.Incoming, match: (self, init) => init.value > self.value };

// Node X (value 5) only has incoming acceptance; Node Y (value 10) has outgoing initiation.
// Y->X edge forms (Y initiates, X accepts). X->Y does NOT (X cannot initiate).
```

## Performance Tips

- Provide a `targetFilter` when you can reject most candidates cheaply.
- Keep `match` side‑effect free and allocation light (it may run many times per insertion).
- Use direct data mutation when edge recalculation isn't needed for better performance.
- Use `updateNodeData()` when data changes should affect connectivity.
- If large batch insertion becomes a need, consider a future bulk API (not implemented yet).

## Invariants (Summary)

- Rules are immutable post node creation.
- Edges change on node insertion/removal and when `updateNodeData()` is called.
- Direct data mutation does not trigger edge recalculation.
- No hidden caches; traversal is over the underlying graph data structure.
- Reverse edges only appear if a separate successful handshake for that direction occurs.

## License

MIT
