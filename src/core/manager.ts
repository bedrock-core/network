import { Network, Node, Rule, RuleDirection } from './types';

/**
 * Handles node creation/removal and data updates.
 * Edges are updated when nodes are added, removed, or when data is updated via updateNodeData().
 *
 * Data Mutation Options:
 *  - updateNodeData(): Updates data and recalculates all edges for the node (slower)
 *  - Direct mutation: Modify node.data directly via getNode(id).data (faster but edges not updated)
 *
 * Choose the appropriate method based on whether you need edge recalculation after data changes.
 */
export class NetworkManager<T, N extends Network<T> = Network<T>> {
  readonly network: N;

  /**
   * Creates a new instance of the NetworkManager.
   * @param networkClass An optional constructor for a custom network implementation.
   * @param network An optional existing network to manage.
   */
  constructor(networkClass?: new () => N, network?: N) {
    this.network = network ?? (networkClass ? new networkClass() : new Network<T>() as N);
  }

  /**
   * Create a new node in the network.
   * Edges produced:
   *  - Outgoing edges from this node using its rules.
   *  - Incoming edges from existing nodes whose rules match this node.
   * @param id The unique identifier for the node.
   * @param data The data associated with the node.
   * @param rules The rules to apply to the node.
   * @returns The created node.
   * @throws If id is missing or duplicate.
   */
  createNode(id: string, data: T, rules: readonly Rule<T>[] = []): Node<T> {
    if (!id) {
      throw new Error('Id is required');
    }

    if (this.findNode(id)) {
      throw new Error(`Duplicate node id: ${id}`);
    }

    const node: Node<T> = { id, data, rules: [...rules] };
    this.network.addNode(node);

    // Directional independent handshakes:
    // 1. Attempt node -> other (requires node outgoing|both + other incoming|both rule match pair)
    // 2. Attempt other -> node similarly.
    for (const other of this.network.nodes) {
      if (other === node) {
        continue;
      }

      if (this.tryHandshake(node, other)) {
        this.network.addEdge(node, other);
      }

      if (this.tryHandshake(other, node)) {
        this.network.addEdge(other, node);
      }
    }

    return node;
  }

  /**
   * Remove a node from the network and its touching edges.
   * @param id The unique identifier for the node.
   */
  removeNode(id: string): void {
    const node = this.findNode(id);

    if (!node) {
      return;
    }

    this.network.removeNode(node);
  }

  /**
   * Update the data of a node and recalculate its edges.
   * This removes all existing edges touching the node and recreates them
   * based on the new data and current rules.
   *
   * Note: For performance-critical scenarios where edge recalculation isn't needed,
   * you can directly mutate the node's data via getNode(id).data without calling this method.
   *
   * @param id The unique identifier for the node.
   * @param newData The new data to associate with the node.
   * @throws If the node does not exist.
   */
  updateNodeData(id: string, newData: T): void {
    const node = this.findNode(id);

    if (!node) {
      throw new Error(`No such node: ${id}`);
    }

    // Remove all edges touching this node
    const adjacentNodes = [...this.network.adjacent(node) ?? []];
    for (const adjacent of adjacentNodes) {
      this.network.removeEdge(node, adjacent);
      this.network.removeEdge(adjacent, node);
    }

    // Update the data
    node.data = newData;

    // Recalculate edges with all other nodes
    for (const other of this.network.nodes) {
      if (other === node) {
        continue;
      }

      if (this.tryHandshake(node, other)) {
        this.network.addEdge(node, other);
      }

      if (this.tryHandshake(other, node)) {
        this.network.addEdge(other, node);
      }
    }
  }

  /**
   * Get a node by its ID.
   * @param id The unique identifier for the node.
   * @returns The node, or undefined if not found.
   */
  getNode(id: string): Node<T> | undefined {
    return this.findNode(id);
  }

  /* @internal */
  private findNode(id: string): Node<T> | undefined {
    for (const n of this.network.nodes) {
      if (n.id === id) {
        return n;
      }
    }

    return undefined;
  }

  /**
   * Attempts a handshake between two nodes.
   * @param source The source node.
   * @param target The target node.
   * @returns True if the handshake was successful, false otherwise.
   */
  /* @internal */
  private tryHandshake(source: Node<T>, target: Node<T>): boolean {
    for (const sRule of source.rules) {
      const sDir = sRule.direction ?? RuleDirection.Both;

      if (sDir === RuleDirection.Incoming) {
        continue;
      }

      if (sRule.targetFilter && !sRule.targetFilter(target.data)) {
        continue;
      }

      if (!sRule.match(source.data, target.data)) {
        continue;
      }

      // Need any accepting rule on target.
      for (const tRule of target.rules) {
        const tDir = tRule.direction ?? RuleDirection.Both;

        if (tDir === RuleDirection.Outgoing) {
          continue;
        }

        if (!tRule.match(target.data, source.data)) {
          continue;
        }

        return true; // first success
      }
    }

    return false; // no success
  }
}
