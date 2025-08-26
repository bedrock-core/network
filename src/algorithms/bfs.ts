import type { Network } from '../core/types';
import type { Node } from '../core/types';

export interface BFSOptions<T> {

  /**
   * Called once per visited node (in BFS order). Return false to stop traversal early.
   */
  visit?: (node: Node<T>, depth: number) => void | boolean;

  /**
   * Decide whether to expand (enqueue) this node's neighbors.
   * Return false to treat the node as a barrier (neighbors are not enqueued).
   * Return true to continue normal expansion.
   */
  expand?: (node: Node<T>, depth: number) => boolean;

  /**
   * Maximum depth to expand (root = 0). Nodes at depth > maxDepth are not enqueued.
   */
  maxDepth?: number;
}

/**
 * Breadth-first traversal over a Network starting at a node (object or id).
 *
 * Characteristics:
 *  - Visits each reachable node at most once.
 *  - Traversal order is discovery (level) order.
 *  - Neighbor iteration order matches underlying adjacency Set order.
 *
 * Barriers:
 *  - Provide options.expand returning false for a node to prevent enqueuing its neighbors (node still counted).
 *
 * @param network Network instance.
 * @param start Node object or its id to start from.
 * @param options BFSOptions.
 * @returns Array of nodes in visit order (includes start if found).
 * @throws If the start node (by id) cannot be found.
 */
// Overloads to allow calling without options
export function bfs<T>(
  network: Network<T>,
  start: Node<T> | string,
  options?: BFSOptions<T>,
): Node<T>[] {
  const { visit, expand, maxDepth } = options || {};

  const startNode: Node<T> | undefined =
    typeof start === 'string' ? findNodeById(network, start) : start;

  if (!startNode) {
    throw new Error(`Start node not found: ${typeof start === 'string' ? start : start.id}`);
  }

  const visited: Set<Node<T>> = new Set();
  const order: Node<T>[] = [];
  const queue: { node: Node<T>; depth: number }[] = [{ node: startNode, depth: 0 }];

  visited.add(startNode);

  while (queue.length) {
    const { node, depth } = queue.shift()!;
    order.push(node);

    if (visit) {
      const res = visit(node, depth);

      if (res === false) {
        return order;
      }
    }

    if (maxDepth !== undefined && depth >= maxDepth) {
      continue;
    }

    if (expand && !expand(node, depth)) {
      continue;
    }

    const adj = network.adjacent(node);

    if (!adj) {
      continue;
    }

    for (const next of adj) {
      if (visited.has(next)) {
        continue;
      }

      visited.add(next);
      queue.push({ node: next, depth: depth + 1 });
    }
  }

  return order;
}

function findNodeById<T>(network: Network<T>, id: string): Node<T> | undefined {
  for (const n of network.nodes) {
    if (n.id === id) {
      return n;
    }
  }

  return undefined;
}
