import type { SchemaGraphNode, SchemaSelection } from "../lib/schema-types";

export interface FlowNodeData {
  schemaNode: SchemaGraphNode;
  selection: SchemaSelection | null;
  onSelectNode: (nodeId: string) => void;
  onSelectRow: (nodeId: string, rowId: string) => void;
  onHoverRow: (nodeId: string, rowId: string | null) => void;
  isSearchMatched: boolean;
  isSearchActive: boolean;
  matchedRowIds: Set<string>;
  activeSearchRowId?: string;
}
