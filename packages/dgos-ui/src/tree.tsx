// Tree Component - Hierarchical data display with expand/collapse
import React, { useState, useCallback, useRef, KeyboardEvent } from 'react';

/**
 * Tree node data structure
 */
export interface TreeNode<T = any> {
  /** Unique node identifier */
  id: string;
  /** Display label */
  label: string;
  /** Child nodes */
  children?: TreeNode<T>[];
  /** Custom icon */
  icon?: React.ReactNode;
  /** Whether this is a folder/parent node */
  isFolder?: boolean;
  /** Custom data attached to node */
  data?: T;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Tree component props
 */
export interface TreeProps<T = any> {
  /** Tree data */
  data: TreeNode<T>[];
  /** Selected node ID */
  selectedId?: string;
  /** Selection change callback */
  onSelect?: (node: TreeNode<T>) => void;
  /** Initially expanded node IDs */
  defaultExpandedIds?: string[];
  /** Controlled expanded node IDs */
  expandedIds?: string[];
  /** Expand/collapse callback */
  onExpandChange?: (expandedIds: string[]) => void;
  /** Show icons */
  showIcons?: boolean;
  /** Indent size in pixels */
  indentSize?: number;
  /** Custom class name */
  className?: string;
}

/**
 * Tree - Hierarchical data display with keyboard navigation
 */
export function Tree<T = any>({
  data,
  selectedId,
  onSelect,
  defaultExpandedIds = [],
  expandedIds: controlledExpandedIds,
  onExpandChange,
  showIcons = true,
  indentSize = 20,
  className = '',
}: TreeProps<T>) {
  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(
    new Set(defaultExpandedIds)
  );
  const treeRef = useRef<HTMLDivElement>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const isControlled = controlledExpandedIds !== undefined;
  const expandedIdsSet = isControlled
    ? new Set(controlledExpandedIds)
    : internalExpandedIds;

  // Toggle expand/collapse
  const toggleExpand = useCallback((nodeId: string) => {
    const newExpanded = new Set(expandedIdsSet);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }

    if (isControlled && onExpandChange) {
      onExpandChange(Array.from(newExpanded));
    } else {
      setInternalExpandedIds(newExpanded);
    }
  }, [expandedIdsSet, isControlled, onExpandChange]);

  // Flatten tree for keyboard navigation
  const flattenTree = useCallback((nodes: TreeNode<T>[], depth = 0): Array<{ node: TreeNode<T>; depth: number }> => {
    const result: Array<{ node: TreeNode<T>; depth: number }> = [];

    for (const node of nodes) {
      result.push({ node, depth });
      if (node.children && expandedIdsSet.has(node.id)) {
        result.push(...flattenTree(node.children, depth + 1));
      }
    }

    return result;
  }, [expandedIdsSet]);

  const flatNodes = flattenTree(data);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>, node: TreeNode<T>, index: number) => {
    let handled = false;

    switch (e.key) {
      case 'ArrowDown':
        // Move to next node
        if (index < flatNodes.length - 1) {
          const nextNode = flatNodes[index + 1].node;
          setFocusedId(nextNode.id);
          handled = true;
        }
        break;

      case 'ArrowUp':
        // Move to previous node
        if (index > 0) {
          const prevNode = flatNodes[index - 1].node;
          setFocusedId(prevNode.id);
          handled = true;
        }
        break;

      case 'ArrowRight':
        // Expand node or move to first child
        if (node.children && node.children.length > 0) {
          if (!expandedIdsSet.has(node.id)) {
            toggleExpand(node.id);
          } else if (index < flatNodes.length - 1) {
            const nextNode = flatNodes[index + 1].node;
            setFocusedId(nextNode.id);
          }
          handled = true;
        }
        break;

      case 'ArrowLeft':
        // Collapse node or move to parent
        if (node.children && expandedIdsSet.has(node.id)) {
          toggleExpand(node.id);
          handled = true;
        } else {
          // Find parent by looking backwards for lower depth
          const currentDepth = flatNodes[index].depth;
          for (let i = index - 1; i >= 0; i--) {
            if (flatNodes[i].depth < currentDepth) {
              setFocusedId(flatNodes[i].node.id);
              handled = true;
              break;
            }
          }
        }
        break;

      case 'Enter':
      case ' ':
        // Select node
        if (!node.disabled && onSelect) {
          onSelect(node);
          handled = true;
        }
        break;

      case 'Home':
        // Move to first node
        if (flatNodes.length > 0) {
          setFocusedId(flatNodes[0].node.id);
          handled = true;
        }
        break;

      case 'End':
        // Move to last node
        if (flatNodes.length > 0) {
          setFocusedId(flatNodes[flatNodes.length - 1].node.id);
          handled = true;
        }
        break;
    }

    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, [flatNodes, expandedIdsSet, toggleExpand, onSelect]);

  // Auto-focus on focused node
  React.useEffect(() => {
    if (focusedId && treeRef.current) {
      const element = treeRef.current.querySelector(`[data-node-id="${focusedId}"]`) as HTMLElement;
      element?.focus();
    }
  }, [focusedId]);

  // Render tree nodes recursively
  const renderNode = (node: TreeNode<T>, depth: number, index: number): React.ReactNode => {
    const isExpanded = expandedIdsSet.has(node.id);
    const isSelected = selectedId === node.id;
    const hasChildren = node.children && node.children.length > 0;
    const isFocused = focusedId === node.id;

    return (
      <div key={node.id} className="tree-node-wrapper">
        <div
          className={`tree-node ${isSelected ? 'selected' : ''} ${node.disabled ? 'disabled' : ''}`}
          style={{ paddingLeft: depth * indentSize }}
          onClick={() => {
            if (!node.disabled) {
              if (hasChildren) {
                toggleExpand(node.id);
              }
              if (onSelect) {
                onSelect(node);
              }
            }
          }}
          onKeyDown={(e) => handleKeyDown(e, node, index)}
          tabIndex={isFocused || (!focusedId && index === 0) ? 0 : -1}
          role="treeitem"
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-selected={isSelected}
          aria-disabled={node.disabled}
          data-node-id={node.id}
        >
          {hasChildren && (
            <button
              className="expand-button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
              tabIndex={-1}
            >
              <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`} aria-hidden="true">
                ▶
              </span>
            </button>
          )}

          {!hasChildren && <span className="expand-spacer" />}

          {showIcons && (
            <span className="node-icon" aria-hidden="true">
              {node.icon || (hasChildren ? '📁' : '📄')}
            </span>
          )}

          <span className="node-label">{node.label}</span>
        </div>

        {hasChildren && isExpanded && (
          <div className="tree-children" role="group">
            {node.children!.map((child, childIndex) => {
              const childFlatIndex = flatNodes.findIndex(item => item.node.id === child.id);
              return renderNode(child, depth + 1, childFlatIndex);
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={treeRef} className={`dgos-tree ${className}`} role="tree">
      {data.map((node, index) => renderNode(node, 0, index))}
    </div>
  );
}
