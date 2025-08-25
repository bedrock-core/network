import { Graph } from 'graph-data-structure';

/**
 * Pure, reusable edge‑generation rule.
 *
 * Life‑cycle / invariants:
 *  - A rule set is fixed for a node at creation time (immutable afterwards).
 *  - Rules are evaluated ONLY at node insertion time (for new node's outgoing edges)
 *    and when other nodes are inserted (to see if their rules connect to the existing node).
 *  - No automatic re-evaluation happens when node data changes; callers must remove & re-add
 *    the node if they desire edge recalculation.
 *
 * Evaluation model:
 *  - When a node N is inserted, every rule in N.rules is evaluated against every
 *    existing node (candidate targets) to decide outgoing edges N -> M.
 *  - Simultaneously, every existing node's rules are evaluated with N as a candidate
 *    target to decide incoming edges M -> N.
 *  - No re‑evaluation occurs on data updates; to reflect data‑driven edge changes
 *    you must remove & recreate the node(s).
 *
 * Purity / side effects:
 *  - `match` (and `targetFilter` if provided) must be pure and side‑effect free.
 *    They can run O(N) times per insertion, so avoid allocations or external mutations.
 *  - Do not capture mutable per‑node state inside closures; rely solely on the
 *    `sourceObj`, `targetObj`
 *
 * Performance:
 *  - Provide a cheap `targetFilter` when you can prune most candidates quickly
 *    before invoking the (potentially heavier) `match` predicate.
 *
 * Directionality:
 *  - If `bidirectional` is true and the rule matches for source->target, an
 *    explicit reverse edge target->source is also inserted (two directed edges).
 */
export interface Rule<T> {
  /**
   * Decide if an edge from source->target should exist.
   * Must be pure; no side effects; deterministic for given inputs.
   */
  match: (sourceObj: T, targetObj: T) => boolean;
  /** When true, also create target->source edge. */
  bidirectional?: boolean;
  /** Optional cheap pre-filter to skip most non-viable targets before calling match. */
  targetFilter?: (targetObj: T) => boolean;
}

/**
 * Concrete node object stored in the graph.
 *
 * Fields:
 *  - id: caller-supplied stable identifier (must be unique in graph scope).
 *  - data: domain payload (not copied; mutate with caution because edges are NOT auto-updated).
 *  - rules: immutable array of NodeRule objects evaluated only at insertion time(s) described above.
 *
 * Mutation guidelines:
 *  - Do not push/pop rules after creation; instead recreate the node if rule set must change.
 *  - If you change data in-place and want edges to reflect new values, remove and re-add the node.
 */
export interface Node<T> {
  id: string;
  data: T;
  rules: readonly Rule<T>[];
}

/**
 * Graph subclass (no extra fields). Extending for future semantic hooks.
 */
export class Network<T> extends Graph<Node<T>> { }
