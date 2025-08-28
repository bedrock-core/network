import { Graph } from 'graph-data-structure';

export enum RuleDirection {
  Outgoing = 'outgoing',
  Incoming = 'incoming',
  Both = 'both',
}


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
 * Directionality model (independent handshakes):
 *  - Rules carry a direction: outgoing | incoming | both (default both).
 *  - A directed edge A->B is created at insertion time of one of the nodes if AND ONLY IF:
 *      (1) A has at least one rule whose direction permits initiation (outgoing|both) AND whose
 *          optional targetFilter + match(A,B) both succeed; AND
 *      (2) B has at least one rule whose direction permits acceptance (incoming|both) AND whose
 *          match(B,A) succeeds.
 *  - The reverse edge B->A is evaluated independently under the same criteria. Thus one‑way edges
 *    can exist if only one direction's handshake succeeds.
 *  - Evaluation occurs when a node is inserted against all existing nodes (and vice versa for
 *    future insertions). Node data mutation does NOT trigger re-evaluation.
 *  - To change edges based on data, remove & re-add the affected node(s).
 */
export interface Rule<T> {
  /**
   * Direction this rule applies to. Defaults to 'both'.
   *  - outgoing: initiates connections.
   *  - incoming: accepts connection attempts.
   *  - both: does both.
   */
  direction?: RuleDirection;
  /**
   * Predicate for desire / acceptance. For outgoing/both it's evaluated with (source,target).
   * For incoming/both (acceptance) it's evaluated with (acceptor, initiator).
   */
  match: (sourceObj: T, targetObj: T) => boolean;
  /** Optional cheap pre-filter for outgoing initiation only. */
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
