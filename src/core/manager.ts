import { Network, Node, Rule } from './types';

/**
 * Handles node creation/removal.
 * Edges are updated when nodes are added or removed.
 */
export class NetworkManager<T> {
  readonly network: Network<T> = new Network<T>();

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

    for (const other of this.network.nodes) {
      if (other === node) {
        continue;
      }

      for (const rule of node.rules) {
        this.tryApplyRuleEdge(node, other, rule);
      }

      for (const rule of other.rules) {
        this.tryApplyRuleEdge(other, node, rule);
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

    for (const other of this.network.nodes) {
      if (other === node) {
        continue;
      }

      this.network.removeEdge(node, other);
      this.network.removeEdge(other, node);
    }
    this.network.removeNode(node);
  }

  /**
   * Update the data of a node.
   * @param id The unique identifier for the node.
   * @param newData The new data to associate with the node.
   * @throws If the node does not exist.
   */
  updateNodeData(id: string, newData: T): void {
    const node = this.findNode(id);

    if (!node) {
      throw new Error(`No such node: ${id}`);
    }

    node.data = newData;
  }

  /**
   * Get a node by its ID.
   * @param id The unique identifier for the node.
   * @returns The node, or undefined if not found.
   */
  getNode(id: string): Node<T> | undefined {
    return this.findNode(id);
  }

  // ---------- Internals ----------

  private findNode(id: string): Node<T> | undefined {
    for (const n of this.network.nodes) {
      if (n.id === id) {
        return n;
      }
    }
    return undefined;
  }

  private tryApplyRuleEdge(
    source: Node<T>,
    target: Node<T>,
    rule: Rule<T>
  ): void {
    if (rule.targetFilter && !rule.targetFilter(target.data)) {
      return;
    }

    if (!rule.match(source.data, target.data)) {
      return;
    }

    this.network.addEdge(source, target);

    if (rule.bidirectional) {
      this.network.addEdge(target, source);
    }
  }
}
