<!--
  EditorCanvas.vue — Cytoscape.js-powered graph editor for automata.

  Renders the visual automaton graph (nodes = states, edges = transitions)
  and provides the full interactive editing UI including:
   - Double-click canvas to add state; double-click node to toggle final.
   - Right-click node → click target to create transition.
   - Keyboard input to set edge labels (DFA/NFA: single char, PDA: compact
     notation, TM: c/A three-char auto-commit).
   - Toolbar for add / start / final / connect / delete.
   - Multi-select via box selection or SHIFT+click with group dragging.
   - Node label editing by selecting a node and typing.
   - Simulation highlighting (locked, current state glows green).
-->

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import cytoscape from 'cytoscape'
import type { Core } from 'cytoscape'
import { Plus, Flag, CircleDot, ArrowRightCircle, Trash2, Lock, Settings } from 'lucide-vue-next'
import { currentProject, validationResult } from '@/lib/automatonStore'
import { formatTransitionLabel, requiresModalEditor } from '@/lib/automatonTypes'
import type { Transition } from '@/lib/automaton'
import {
  renameState,
  canAcceptRenameInput,
  startRename,
  appendCharacter,
  removeLastCharacter,
  cancelRename,
} from '@/lib/renameMode'
import PDATransitionEditor from './PDATransitionEditor.vue'
import TMTransitionEditor from './TMTransitionEditor.vue'

import { isDark } from '@/lib/darkMode'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

const props = defineProps<{
  /** ID of the state highlighted during single-step simulation. */
  currentSimulationState?: string | null
  /** When true the canvas is locked (no editing, no dragging). */
  isSimulating?: boolean
}>()

/** Derived locked flag for guard clauses. */
const isLocked = computed(() => props.isSimulating || false)

// ---------------------------------------------------------------------------
// Canvas & modal editor state
// ---------------------------------------------------------------------------

/** Incremented to force a full canvas re-mount after project switches. */
const canvasKey = ref(0)

// -- PDA transition editor -------------------------------------------------
const pdaEditorVisible = ref(false)
const editingTransition = ref<Transition | null>(null)
const pdaInputBuffer = ref('')

// -- TM transition editor --------------------------------------------------
const tmEditorVisible = ref(false)
const tmInputBuffer = ref('')

/**
 * Destroy and re-initialise Cytoscape when the active project changes.
 * All local selection / connection state is reset too.
 */
watch(
  () => currentProject.value.id,
  (newId, oldId) => {
    if (newId !== oldId) {
      console.log('Project switched:', oldId, '->', newId)
      canvasKey.value++

      if (cy) {
        cy.destroy()
        cy = null
      }

      selectedNodeIds.value.clear()
      selectedEdgeId.value = null
      sourceNodeForEdge.value = null
      pdaEditorVisible.value = false
      editingTransition.value = null
      pdaInputBuffer.value = ''
      // Reset TM state on project switch
      tmEditorVisible.value = false
      tmInputBuffer.value = ''

      setTimeout(() => {
        initializeCytoscape()
      }, 0)
    }
  },
)

// ---------------------------------------------------------------------------
// Cytoscape instance & local selection state
// ---------------------------------------------------------------------------

let _nodeIdCounter = 1
let edgeIdCounter = 0

/** Compute the next safe edge counter from existing transition IDs. */
const syncEdgeIdCounter = () => {
  const existing = currentProject.value.transitions
    .map((t) => {
      const m = t.id.match(/^e(\d+)$/)
      return m && m[1] != null ? parseInt(m[1], 10) : -1
    })
    .filter((n) => n >= 0)
  edgeIdCounter = existing.length > 0 ? Math.max(...existing) + 1 : 0
}

const cyContainer = ref<HTMLElement | null>(null)
let cy: Core | null = null

/** Set of currently selected node IDs (supports multi-select). */
const selectedNodeIds = ref<Set<string>>(new Set())
/** ID of the currently selected edge (at most one). */
const selectedEdgeId = ref<string | null>(null)
/** Source node when the user is creating a new transition (click target to finish). */
const sourceNodeForEdge = ref<string | null>(null)

// -- Multi-drag bookkeeping ------------------------------------------------
let isDragging = false
let dragStartPositions: Map<string, { x: number; y: number }> = new Map()

// ---------------------------------------------------------------------------
// Simulation-state watchers
// ---------------------------------------------------------------------------

/** Re-paint node & edge styles whenever the highlighted state changes. */
watch(
  () => props.currentSimulationState,
  () => {
    updateAllStyles()
  },
)

watch(isDark, () => {
  if (cy) {
    const currentZoom = cy.zoom()
    const currentPan = cy.pan()
    
    cy.destroy()
    cy = null
    initializeCytoscape()
    
    // Type assertion to let TS know initializeCytoscape() recreates the cy instance
    const newCy = cy as Core | null
    if (newCy) {
      newCy.zoom(currentZoom)
      newCy.pan(currentPan)
    }
  }
})

/**
 * When simulation starts: deselect everything, lock nodes, disable box-select.
 * When simulation ends: restore interactivity.
 */
watch(
  () => props.isSimulating,
  (newVal) => {
    if (newVal) {
      selectedNodeIds.value.clear()
      selectedEdgeId.value = null
      sourceNodeForEdge.value = null
      pdaEditorVisible.value = false
      editingTransition.value = null
      pdaInputBuffer.value = ''
      // Reset TM editor state
      tmEditorVisible.value = false
      tmInputBuffer.value = ''

      if (cy) {
        cy.nodes().forEach((node) => {
          if (!node.id().startsWith('__start_')) {
            node.ungrabify()
          }
        })
        cy.boxSelectionEnabled(false)
      }
    } else {
      if (cy) {
        cy.nodes().forEach((node) => {
          if (!node.id().startsWith('__start_')) {
            node.grabify()
          }
        })
        cy.boxSelectionEnabled(true)
      }
    }
    updateAllStyles()
  },
)

// Reset PDA/TM input buffers whenever a different edge is selected.
watch(selectedEdgeId, () => {
  pdaInputBuffer.value = ''
  tmInputBuffer.value = ''
})

// ---------------------------------------------------------------------------
// Style management
// ---------------------------------------------------------------------------

/**
 * Recompute visual styles for every node based on selection, validation
 * errors/warnings, and simulation highlighting.
 */
const updateNodeStyles = () => {
  if (!cy) return

  cy.nodes().forEach((node) => {
    const nodeId = node.id()
    if (nodeId.startsWith('__start_')) return

    const state = currentProject.value.states.find((s) => s.id === nodeId)
    if (!state) return

    const isSelected = selectedNodeIds.value.has(nodeId)
    const isConnecting = sourceNodeForEdge.value === nodeId
    const isSimulating = props.currentSimulationState === nodeId

    const hasError = validationResult.value.errors.some((e) => e.affectedElements.includes(nodeId))
    const hasWarning = validationResult.value.warnings.some((w) =>
      w.affectedElements.includes(nodeId),
    )

    let borderColor = isDark.value ? '#e4e4e7' : '#000'
    let bgColor = isDark.value ? '#27272a' : '#fff'
    let borderWidth = state.isFinal ? 6 : 2

    if (hasError) {
      borderColor = '#dc2626'
      bgColor = isDark.value ? '#450a0a' : '#fee2e2'
    } else if (hasWarning) {
      borderColor = '#f59e0b'
      bgColor = isDark.value ? '#451a03' : '#fef3c7'
    }

    if (isSimulating) {
      borderColor = '#10b981'
      bgColor = isDark.value ? '#064e3b' : '#d1fae5'
      borderWidth = 8
    } else if (isSelected) {
      borderColor = '#3b82f6'
      borderWidth = state.isFinal ? 10 : 6
      if (!hasError && !hasWarning) {
        bgColor = isDark.value ? '#1e3a8a' : '#dbeafe'
      }
    } else if (isConnecting) {
      borderColor = '#06b6d4'
      if (!hasError && !hasWarning) {
        bgColor = isDark.value ? '#164e63' : '#cffafe'
      }
    }


    node.style({
      'background-color': bgColor,
      'border-color': borderColor,
      'border-width': borderWidth,
      'border-style': state.isFinal ? 'double' : 'solid',
      opacity: props.isSimulating && !isSimulating ? 0.4 : 1,
    })
  })
}

/**
 * Recompute visual styles for every edge based on selection and validation
 * errors.  Edges dim during simulation.
 */
const updateEdgeStyles = () => {
  if (!cy) return

  cy.edges().forEach((edge) => {
    const edgeId = edge.id()
    if (edgeId.startsWith('__start_edge_')) return

    const isSelected = selectedEdgeId.value === edgeId
    const hasError = validationResult.value.errors.some((e) => e.affectedElements.includes(edgeId))

    const color = hasError ? '#dc2626' : isSelected ? '#3b82f6' : (isDark.value ? '#e4e4e7' : '#000')

    edge.style({
      'line-color': color,
      'target-arrow-color': color,
      width: isSelected ? 4 : hasError ? 3 : 2,
      color: color,
      'font-weight': isSelected ? 'bold' : 'normal',
      opacity: props.isSimulating ? 0.5 : 1,
    })
  })
}

/** Convenience wrapper to refresh all node + edge styles. */
const updateAllStyles = () => {
  updateNodeStyles()
  updateEdgeStyles()
}

/** Builds the edge label string appropriate for the current automaton type. */
const getEdgeLabel = (transition: Transition): string => {
  if (currentProject.value.type === 'TM') {
    const read = transition.symbol || '?'
    const action = transition.tmWrite ?? transition.tmMove ?? '?'
    return `${read}/${action}`
  }
  return formatTransitionLabel(currentProject.value.type, {
    symbol: transition.symbol,
    input: transition.pdaInput,
    stackTop: transition.pdaStackTop,
    stackPush: transition.pdaStackPush,
  })
}

// ---------------------------------------------------------------------------
// Node / edge CRUD actions
// ---------------------------------------------------------------------------

/** Adds a new state node with an auto-incremented ID (q0, q1, …). */
const addNode = () => {
  if (isLocked.value) return

  const existingNumbers = currentProject.value.states
    .map((s) => {
      const match = s.id.match(/^q(\d+)$/)
      return match?.[1] ? parseInt(match[1]) : -1
    })
    .filter((n) => n >= 0)

  const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : -1
  const nextNumber = maxNumber + 1

  const id = `q${nextNumber}`
  currentProject.value.states.push({
    id,
    label: id,
    isStart: false,
    isFinal: false,
    position: { x: 150 + Math.random() * 300, y: 100 + Math.random() * 200 },
  })
  currentProject.value.updatedAt = new Date()
  syncToCytoscape()
}

/** Toggles the “final state” flag on all currently selected nodes. */
const toggleFinalState = () => {
  if (isLocked.value || selectedNodeIds.value.size === 0) return

  selectedNodeIds.value.forEach((nodeId) => {
    const state = currentProject.value.states.find((s) => s.id === nodeId)
    if (state) state.isFinal = !state.isFinal
  })
  currentProject.value.updatedAt = new Date()
  updateAllStyles()
}

/** Toggles the “start state” flag on all currently selected nodes. */
const setStartState = () => {
  if (isLocked.value || selectedNodeIds.value.size === 0) return

  selectedNodeIds.value.forEach((nodeId) => {
    const state = currentProject.value.states.find((s) => s.id === nodeId)
    if (state) state.isStart = !state.isStart
  })
  currentProject.value.updatedAt = new Date()
  syncToCytoscape()
}

/** Deletes all selected nodes (and their incident edges) or the selected edge. */
const deleteSelected = () => {
  if (isLocked.value) return

  if (selectedNodeIds.value.size > 0) {
    selectedNodeIds.value.forEach((nodeId) => {
      currentProject.value.states = currentProject.value.states.filter((s) => s.id !== nodeId)
      currentProject.value.transitions = currentProject.value.transitions.filter(
        (t) => t.from !== nodeId && t.to !== nodeId,
      )
    })
    selectedNodeIds.value.clear()
  }

  if (selectedEdgeId.value) {
    currentProject.value.transitions = currentProject.value.transitions.filter(
      (t) => t.id !== selectedEdgeId.value,
    )
    selectedEdgeId.value = null
  }
  currentProject.value.updatedAt = new Date()
  syncToCytoscape()
}

/** Enters “connection mode”: the next node click completes the edge. */
const startConnection = () => {
  if (isLocked.value || selectedNodeIds.value.size !== 1) return

  const nodeId = Array.from(selectedNodeIds.value)[0]
  if (nodeId !== undefined) {
    sourceNodeForEdge.value = nodeId
    selectedNodeIds.value.clear()
    updateAllStyles()
  }
}

const toggleNodeSelection = (nodeId: string, multiSelect: boolean) => {
  if (isLocked.value) return

  if (multiSelect) {
    if (selectedNodeIds.value.has(nodeId)) {
      selectedNodeIds.value.delete(nodeId)
    } else {
      selectedNodeIds.value.add(nodeId)
    }
  } else {
    selectedNodeIds.value.clear()
    selectedNodeIds.value.add(nodeId)
  }
  updateAllStyles()
}

// ---------------------------------------------------------------------------
// PDA / TM modal editor actions
// ---------------------------------------------------------------------------

/** Opens the PDA transition modal for the given edge. */
const openPDAEditor = (transitionId: string) => {
  if (!requiresModalEditor(currentProject.value.type)) return

  const transition = currentProject.value.transitions.find((t) => t.id === transitionId)
  if (!transition) return

  editingTransition.value = transition
  pdaEditorVisible.value = true
}

/** Applies the saved PDA fields back to the transition model. */
const savePDATransition = (data: {
  pdaInput: string
  pdaStackTop: string
  pdaStackPush: string
}) => {
  if (!editingTransition.value) return

  editingTransition.value.pdaInput = data.pdaInput
  editingTransition.value.pdaStackTop = data.pdaStackTop
  editingTransition.value.pdaStackPush = data.pdaStackPush

  currentProject.value.updatedAt = new Date()
  syncToCytoscape()

  editingTransition.value = null
}

/** Opens the TM transition modal for the given edge. */
const openTMEditor = (transitionId: string) => {
  const transition = currentProject.value.transitions.find((t) => t.id === transitionId)
  if (!transition) return

  editingTransition.value = transition
  tmEditorVisible.value = true
}

/** Applies the saved TM read/action back to the transition model. */
const saveTMTransition = (data: { tmRead: string; action: string }) => {
  if (!editingTransition.value) return

  editingTransition.value.symbol = data.tmRead

  if (data.action === 'L' || data.action === 'R') {
    editingTransition.value.tmMove = data.action as 'L' | 'R'
    editingTransition.value.tmWrite = undefined
  } else {
    editingTransition.value.tmWrite = data.action
    editingTransition.value.tmMove = undefined
  }

  currentProject.value.updatedAt = new Date()
  syncToCytoscape()
  editingTransition.value = null
}

/**
 * Parses a 3-character TM input buffer ("X/Y") and writes the
 * read symbol + action (move or write) into the transition.
 */
const parseTMInput = (input: string, transition: Transition) => {
  // input ist immer genau "X/Y" — 3 Zeichen
  const read = input.charAt(0) // Position 0: Lese-Symbol
  // Position 1: immer '/'
  const action = input.charAt(2) // Position 2: L, R oder Schreib-Symbol

  if (!read || !action) return

  transition.symbol = read

  if (action === 'L' || action === 'R') {
    transition.tmMove = action as 'L' | 'R'
    transition.tmWrite = undefined
  } else {
    transition.tmWrite = action
    transition.tmMove = undefined
  }
}

// ---------------------------------------------------------------------------
// Keyboard input handlers for inline edge editing
// ---------------------------------------------------------------------------

/**
 * TM edge keyboard handler: accumulates a 3-char buffer ("c/L") and
 * auto-commits on the third character.
 */
const handleTMKeyboardInput = (e: KeyboardEvent, transition: Transition) => {
  if (e.key === 'Backspace') {
    e.preventDefault()
    tmInputBuffer.value = tmInputBuffer.value.slice(0, -1)

    // Bei leerem Buffer: Transition leeren
    if (tmInputBuffer.value === '') {
      transition.symbol = ''
      transition.tmWrite = undefined
      transition.tmMove = undefined
      currentProject.value.updatedAt = new Date()
      syncToCytoscape()
    }
    return
  }

  if (e.key === 'Escape') {
    e.preventDefault()
    tmInputBuffer.value = ''
    return
  }

  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault()
    if (/\s/.test(e.key)) return

    const bufLen = tmInputBuffer.value.length

    if (bufLen === 0) {
      // Erstes Zeichen: das Lese-Symbol
      tmInputBuffer.value = e.key
    } else if (bufLen === 1) {
      // Zweites Zeichen: MUSS '/' sein — alles andere: Buffer reset
      if (e.key !== '/') {
        tmInputBuffer.value = ''
        return
      }
      tmInputBuffer.value += e.key
    } else if (bufLen === 2) {
      // Drittes Zeichen: Action (L/R oder Schreib-Symbol) → AUTO APPLY!
      tmInputBuffer.value += e.key // Buffer: "c/L"
      parseTMInput(tmInputBuffer.value, transition)
      currentProject.value.updatedAt = new Date()
      syncToCytoscape()
      setTimeout(() => {
        tmInputBuffer.value = ''
      }, 400) // Kurzes visuelles Feedback
    }
  }
}

/**
 * PDA edge keyboard handler: accumulates input in the compact
 * `input,stackTop/stackPush` notation and commits on Enter.
 */
const handlePDAKeyboardInput = (e: KeyboardEvent, transition: Transition) => {
  if (e.key === 'Backspace') {
    e.preventDefault()
    pdaInputBuffer.value = pdaInputBuffer.value.slice(0, -1)

    if (pdaInputBuffer.value === '') {
      transition.pdaInput = ''
      transition.pdaStackTop = ''
      transition.pdaStackPush = ''
    } else {
      parsePDAInput(pdaInputBuffer.value, transition)
    }

    currentProject.value.updatedAt = new Date()
    syncToCytoscape()
    return
  }

  if (e.key === 'Enter') {
    e.preventDefault()
    parsePDAInput(pdaInputBuffer.value, transition)
    pdaInputBuffer.value = ''
    currentProject.value.updatedAt = new Date()
    syncToCytoscape()
    return
  }

  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault()

    if (/\s/.test(e.key)) {
      console.warn('⚠️ Leerzeichen sind nicht erlaubt!')
      return
    }

    pdaInputBuffer.value += e.key
    parsePDAInput(pdaInputBuffer.value, transition)
    currentProject.value.updatedAt = new Date()
    syncToCytoscape()
  }
}

const parsePDAInput = (input: string, transition: Transition) => {
  input = input.replace(/\s/g, '')

  const parts = input.split('/')
  const leftSide = parts[0] || ''
  const rightSide = parts[1] || ''

  const leftParts = leftSide.split(',')
  let inputSymbol = leftParts[0] || ''
  let stackTopSymbol = leftParts[1] || ''

  if (inputSymbol.length > 1 && inputSymbol !== 'ε') {
    inputSymbol = inputSymbol.charAt(0)
  }

  if (stackTopSymbol.length > 1 && stackTopSymbol !== 'ε') {
    stackTopSymbol = stackTopSymbol.charAt(0)
  }

  transition.pdaInput = inputSymbol === 'ε' || inputSymbol === '' ? '' : inputSymbol
  transition.pdaStackTop = stackTopSymbol === 'ε' || stackTopSymbol === '' ? '' : stackTopSymbol
  transition.pdaStackPush = rightSide === 'ε' || rightSide === '' ? '' : rightSide
}

// ---------------------------------------------------------------------------
// Cytoscape initialisation
// ---------------------------------------------------------------------------

const initializeCytoscape = () => {
  if (!cyContainer.value) return

  syncEdgeIdCounter()

  const nodeBgColor = isDark.value ? '#27272a' : '#fff'
  const nodeBorderColor = isDark.value ? '#e4e4e7' : '#000'
  const edgeColor = isDark.value ? '#e4e4e7' : '#000'
  const labelColor = isDark.value ? '#e4e4e7' : '#000'
  const textBgColor = isDark.value ? '#27272a' : '#fff'

  cy = cytoscape({
    container: cyContainer.value,
    style: [
      {
        selector: 'node',
        style: {
          'background-color': nodeBgColor,
          'border-width': 2,
          'border-color': nodeBorderColor,
          color: labelColor,
          label: 'data(label)',
          width: 56,
          height: 56,
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': 12,
          'font-family': 'monospace',
          'font-weight': 'bold',
        },
      },
      {
        selector: 'node[?isStartMarker]',
        style: {
          width: 1,
          height: 1,
          'background-color': edgeColor,
          'border-width': 0,
          label: '',
        },
      },
      {
        selector: 'edge',
        style: {
          width: 2,
          'line-color': edgeColor,
          'target-arrow-color': edgeColor,
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          label: 'data(label)',
          color: labelColor,
          'font-size': 14,
          'text-background-opacity': 1,
          'text-background-color': textBgColor,
          'text-background-padding': '3px',
        },
      },
      {
        selector: 'edge[?isStartEdge]',
        style: {
          width: 2.5,
          'line-color': edgeColor,
          'target-arrow-color': edgeColor,
          'target-arrow-shape': 'triangle',
          'curve-style': 'straight',
          label: '',
        },
      },
    ],
    layout: { name: 'preset' },
    userZoomingEnabled: true,
    userPanningEnabled: true,
    boxSelectionEnabled: true,
    autoungrabify: false,
    autounselectify: true,
  })

  registerCytoscapeEvents()
  syncToCytoscape()
}

// ---------------------------------------------------------------------------
// Cytoscape event registration
// ---------------------------------------------------------------------------

const registerCytoscapeEvents = () => {
  if (!cy) return

  // --- DRAG START ---
  cy.on('grab', 'node', (event) => {
    if (isLocked.value) {
      event.preventDefault()
      return
    }

    const grabbedNode = event.target
    if (grabbedNode.id().startsWith('__start_')) return

    if (!selectedNodeIds.value.has(grabbedNode.id())) {
      isDragging = false
      return
    }

    isDragging = true
    dragStartPositions.clear()

    selectedNodeIds.value.forEach((nodeId) => {
      const node = cy!.$id(nodeId)
      if (node.length > 0) {
        dragStartPositions.set(nodeId, {
          x: node.position('x'),
          y: node.position('y'),
        })
      }
    })
  })

  // --- DRAG ---
  cy.on('drag', 'node', (event) => {
    if (isLocked.value || !isDragging || selectedNodeIds.value.size <= 1) return

    const draggedNode = event.target
    const draggedNodeId = draggedNode.id()
    if (draggedNodeId.startsWith('__start_')) return

    const startPos = dragStartPositions.get(draggedNodeId)
    if (!startPos) return

    const currentPos = draggedNode.position()
    const deltaX = currentPos.x - startPos.x
    const deltaY = currentPos.y - startPos.y

    selectedNodeIds.value.forEach((nodeId) => {
      if (nodeId === draggedNodeId) return

      const node = cy!.$id(nodeId)
      const nodeStartPos = dragStartPositions.get(nodeId)

      if (node.length > 0 && nodeStartPos) {
        node.position({
          x: nodeStartPos.x + deltaX,
          y: nodeStartPos.y + deltaY,
        })
      }
    })
  })

  // --- DRAG END ---
  cy.on('dragfree', 'node', (event) => {
    if (isLocked.value) return

    const node = event.target
    const nodeId = node.id()
    if (nodeId.startsWith('__start_')) return

    if (isDragging && selectedNodeIds.value.size > 1) {
      selectedNodeIds.value.forEach((id) => {
        const cyNode = cy!.$id(id)
        const state = currentProject.value.states.find((s) => s.id === id)
        if (state && cyNode.length > 0) {
          state.position = cyNode.position()
        }
      })
      isDragging = false
      dragStartPositions.clear()
      currentProject.value.updatedAt = new Date()
      syncToCytoscape()
    } else {
      const state = currentProject.value.states.find((s) => s.id === nodeId)
      if (state) {
        state.position = node.position()
        currentProject.value.updatedAt = new Date()
        syncToCytoscape()
      }
    }
  })

  cy.on('tap', 'node', (event) => {
    if (isLocked.value) return

    const node = event.target
    if (node.id().startsWith('__start_')) return

    const shiftPressed = event.originalEvent?.shiftKey || false

    if (sourceNodeForEdge.value) {
      const targetId = node.id()
      const edgeId = `e${edgeIdCounter++}`
      currentProject.value.transitions.push({
        id: edgeId,
        from: sourceNodeForEdge.value,
        to: targetId,
        symbol: '',
        pdaInput: '',
        pdaStackTop: '',
        pdaStackPush: '',
        // tmWrite and tmMove are optional - undefined by default
      })
      selectedEdgeId.value = edgeId
      selectedNodeIds.value.clear()
      sourceNodeForEdge.value = null
      currentProject.value.updatedAt = new Date()
      syncToCytoscape()
      return
    }

    selectedEdgeId.value = null
    toggleNodeSelection(node.id(), shiftPressed)
  })

  cy.on('cxttap', 'node', (event) => {
    if (isLocked.value) return

    event.preventDefault()
    const node = event.target
    if (node.id().startsWith('__start_')) return

    sourceNodeForEdge.value = node.id()
    selectedNodeIds.value.clear()
    selectedEdgeId.value = null
    updateAllStyles()
  })

  cy.on('tap', 'edge', (event) => {
    if (isLocked.value) return

    const edge = event.target
    if (edge.id().startsWith('__start_edge_')) return

    selectedEdgeId.value = edge.id()
    selectedNodeIds.value.clear()
    updateAllStyles()
  })

  cy.on('tap', (event) => {
    if (isLocked.value) return

    if (event.target === cy) {
      selectedNodeIds.value.clear()
      selectedEdgeId.value = null
      sourceNodeForEdge.value = null
      updateAllStyles()
    }
  })

  cy.on('boxend', () => {
    if (isLocked.value) return

    const cySelected = cy!.$('node:selected')
    const realNodes = cySelected.filter((node) => !node.id().startsWith('__start_'))

    realNodes.forEach((node) => {
      selectedNodeIds.value.add(node.id())
    })

    cy!.nodes().unselect()
    selectedEdgeId.value = null
    updateAllStyles()
  })

  cy.on('dbltap', (event) => {
    if (isLocked.value) return

    if (event.target !== cy) return
    const pos = event.position

    const existingNumbers = currentProject.value.states
      .map((s) => {
        const match = s.id.match(/^q(\d+)$/)
        return match?.[1] ? parseInt(match[1]) : -1
      })
      .filter((n) => n >= 0)

    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : -1
    const nextNumber = maxNumber + 1

    const id = `q${nextNumber}`
    currentProject.value.states.push({
      id,
      label: id,
      isStart: currentProject.value.states.length === 0,
      isFinal: false,
      position: { x: pos.x, y: pos.y },
    })
    currentProject.value.updatedAt = new Date()
    syncToCytoscape()
  })

  cy.on('dbltap', 'node', (event) => {
    if (isLocked.value) return

    const node = event.target
    if (node.id().startsWith('__start_')) return

    const state = currentProject.value.states.find((s) => s.id === node.id())
    if (state) {
      state.isFinal = !state.isFinal
      currentProject.value.updatedAt = new Date()
      updateAllStyles()
    }
  })

  // Double-click on edge: PDA → PDA Modal, TM → TM Modal
  cy.on('dbltap', 'edge', (event) => {
    if (isLocked.value) return

    const edge = event.target
    if (edge.id().startsWith('__start_edge_')) return

    if (currentProject.value.type === 'PDA' && requiresModalEditor(currentProject.value.type)) {
      openPDAEditor(edge.id())
    } else if (currentProject.value.type === 'TM') {
      // Open TM modal editor
      openTMEditor(edge.id())
    }
  })
}

onMounted(() => {
  initializeCytoscape()
})

onUnmounted(() => {
  if (cy) {
    cy.destroy()
    cy = null
  }
})

/**
 * One-way sync: pushes the project model (states + transitions) into
 * Cytoscape, adding / updating / removing elements as needed.
 */
const syncToCytoscape = () => {
  if (!cy) return

  // --- 1. REMOVE deleted nodes/edges ---
  cy.nodes().forEach((node) => {
    const nodeId = node.id()
    if (nodeId.startsWith('__start_')) {
      const targetId = nodeId.replace('__start_', '')
      const targetExists = currentProject.value.states.some((s) => s.id === targetId && s.isStart)
      if (!targetExists) {
        node.remove()
      }
    } else {
      if (!currentProject.value.states.some((s) => s.id === nodeId)) {
        node.remove()
      }
    }
  })

  cy.edges().forEach((edge) => {
    const edgeId = edge.id()
    if (edgeId.startsWith('__start_edge_')) {
      const targetId = edgeId.replace('__start_edge_', '')
      const targetExists = currentProject.value.states.some((s) => s.id === targetId && s.isStart)
      if (!targetExists) {
        edge.remove()
      }
    } else {
      if (!currentProject.value.transitions.some((t) => t.id === edgeId)) {
        edge.remove()
      }
    }
  })

  // --- 2. ADD/UPDATE nodes ---
  currentProject.value.states.forEach((state) => {
    const existingNode = cy!.$id(state.id)

    if (existingNode.length > 0) {
      existingNode.data('label', state.label)
      existingNode.position(state.position)
    } else {
      cy!.add({
        data: { id: state.id, label: state.label },
        position: state.position,
      })
    }

    const markerId = `__start_${state.id}`
    const existingMarker = cy!.$id(markerId)

    if (state.isStart) {
      const markerPos = { x: state.position.x - 80, y: state.position.y }

      if (existingMarker.length > 0) {
        existingMarker.position(markerPos)
      } else {
        cy!.add({
          data: { id: markerId, label: '', isStartMarker: true },
          position: markerPos,
        })
        cy!.$id(markerId).ungrabify()
      }

      const startEdgeId = `__start_edge_${state.id}`
      const existingStartEdge = cy!.$id(startEdgeId)
      if (existingStartEdge.length === 0) {
        cy!.add({
          data: { id: startEdgeId, source: markerId, target: state.id, isStartEdge: true },
        })
      }
    } else {
      if (existingMarker.length > 0) {
        existingMarker.remove()
      }
      const startEdgeId = `__start_edge_${state.id}`
      const existingStartEdge = cy!.$id(startEdgeId)
      if (existingStartEdge.length > 0) {
        existingStartEdge.remove()
      }
    }
  })

  // --- 3. ADD/UPDATE edges ---
  currentProject.value.transitions.forEach((transition) => {
    const existingEdge = cy!.$id(transition.id)

    // Use getEdgeLabel() for all types (incl. TM)
    const label = getEdgeLabel(transition)

    if (existingEdge.length > 0) {
      existingEdge.data('label', label)
      existingEdge.data('source', transition.from)
      existingEdge.data('target', transition.to)
    } else {
      cy!.add({
        data: {
          id: transition.id,
          source: transition.from,
          target: transition.to,
          label: label,
        },
      })
    }
  })

  updateAllStyles()
}

// ---------------------------------------------------------------------------
// Global keyboard handler
// ---------------------------------------------------------------------------

/** Handles Delete, ESC, and per-type edge/node label editing keystrokes. */
const handleKeyDown = (e: KeyboardEvent) => {
  // Skip keyboard input if any modal is open
  if (pdaEditorVisible.value || tmEditorVisible.value) return

  if (!cy || isLocked.value) return

  // GLOBAL FOCUS CHECK: If any input element is focused, don't interfere
  // This prevents blocking input in dialogs, test panels, etc.
  const activeEl = document.activeElement as HTMLElement
  if (
    activeEl?.tagName === 'INPUT' ||
    activeEl?.tagName === 'TEXTAREA' ||
    activeEl?.contentEditable === 'true'
  ) {
    return
  }

  if (e.key === 'Escape' && sourceNodeForEdge.value) {
    sourceNodeForEdge.value = null
    updateAllStyles()
    return
  }

  if (e.key === 'Escape' && renameState.value.active) {
    cancelRename()
    return
  }

  if (e.key === 'Delete') {
    e.preventDefault()
    deleteSelected()
    return
  }

  // Edge editing with keyboard
  if (selectedEdgeId.value) {
    const transition = currentProject.value.transitions.find((t) => t.id === selectedEdgeId.value)
    if (!transition) return

    // PDA: Keyboard Parser
    if (currentProject.value.type === 'PDA') {
      handlePDAKeyboardInput(e, transition)
      return
    }

    // TM keyboard input parser
    if (currentProject.value.type === 'TM') {
      handleTMKeyboardInput(e, transition)
      return
    }

    // DFA/NFA: Single character replacement
    if (e.key === 'Backspace') {
      e.preventDefault()
      transition.symbol = ''
      currentProject.value.updatedAt = new Date()
      syncToCytoscape()
      return
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()

      if (currentProject.value.type === 'NFA' && e.key === 'ε') {
        console.warn('⚠️ Im NEA sind keine ε-Übergänge erlaubt!')
        return
      }

      transition.symbol = e.key
      currentProject.value.updatedAt = new Date()
      syncToCytoscape()
    }
    return
  }

  // NODE LABEL EDITING
  if (selectedNodeIds.value.size === 1) {
    const nodeId = Array.from(selectedNodeIds.value)[0]!
    const state = currentProject.value.states.find((s) => s.id === nodeId)
    if (!state) return

    // Start rename mode if not already active
    if (!renameState.value.active && e.key.length === 1) {
      e.preventDefault()
      startRename('canvas-node', nodeId, state.label)
      appendCharacter(e.key)
      if (cy) cy.$id(nodeId).data('label', renameState.value.value)
      return
    }

    // Continue rename if already in node-rename mode
    if (renameState.value.mode === 'canvas-node') {
      if (e.key === 'Backspace') {
        e.preventDefault()
        removeLastCharacter()
        const updatedLabel = renameState.value.value
        state.label = updatedLabel
        if (cy) cy.$id(nodeId).data('label', updatedLabel)
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        state.label = renameState.value.value
        currentProject.value.updatedAt = new Date()
        cancelRename()
        syncToCytoscape()
        return
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        appendCharacter(e.key)
        const updatedLabel = renameState.value.value
        state.label = updatedLabel
        if (cy) cy.$id(nodeId).data('label', updatedLabel)
      }
    }
  }
}

onMounted(() => window.addEventListener('keydown', handleKeyDown))
onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))
</script>

<template>
  <div :key="canvasKey" class="relative w-full h-full">
    <!-- Grid -->
    <div
      class="absolute inset-0 pointer-events-none"
      style="
        background-image: radial-gradient(circle, #cbd5e1 1px, transparent 1px);
        background-size: 20px 20px;
      "
    ></div>

    <!-- Simulation Status Badge -->
    <div
      v-if="isSimulating"
      class="absolute top-4 right-4 z-40 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse"
    >
      <Lock class="w-4 h-4" />
      <span class="text-xs font-bold">Simulation Running</span>
    </div>

    <!-- Toolbar -->
    <div
      class="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-full shadow-xl border border-zinc-200/50 dark:border-zinc-700/50 px-3 py-2.5 flex items-center gap-2"
    >
      <button
        @click="addNode"
        :disabled="isSimulating"
        class="p-2.5 rounded-full transition-colors"
        :class="
          isSimulating ? 'text-zinc-300 dark:text-zinc-600 cursor-not-allowed' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
        "
      >
        <Plus class="w-6 h-6" />
      </button>

      <div class="w-px h-6 bg-zinc-200 dark:bg-zinc-700"></div>

      <button
        @click="setStartState"
        :disabled="selectedNodeIds.size === 0 || isSimulating"
        class="p-2.5 rounded-full transition-colors"
        :class="
          selectedNodeIds.size > 0 && !isSimulating
            ? 'hover:bg-green-50 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400'
            : 'text-zinc-300 dark:text-zinc-600 cursor-not-allowed'
        "
      >
        <Flag class="w-6 h-6" />
      </button>

      <button
        @click="toggleFinalState"
        :disabled="selectedNodeIds.size === 0 || isSimulating"
        class="p-2.5 rounded-full transition-colors"
        :class="
          selectedNodeIds.size > 0 && !isSimulating
            ? 'hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400'
            : 'text-zinc-300 dark:text-zinc-600 cursor-not-allowed'
        "
      >
        <CircleDot class="w-6 h-6" />
      </button>

      <button
        @click="startConnection"
        :disabled="selectedNodeIds.size !== 1 || isSimulating"
        class="p-2.5 rounded-full transition-colors"
        :class="
          selectedNodeIds.size === 1 && !isSimulating
            ? 'hover:bg-cyan-50 dark:hover:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400'
            : 'text-zinc-300 dark:text-zinc-600 cursor-not-allowed'
        "
      >
        <ArrowRightCircle class="w-6 h-6" />
      </button>

      <div class="w-px h-6 bg-zinc-200 dark:bg-zinc-700"></div>

      <button
        @click="deleteSelected"
        :disabled="(selectedNodeIds.size === 0 && !selectedEdgeId) || isSimulating"
        class="p-2.5 rounded-full transition-colors"
        :class="
          (selectedNodeIds.size > 0 || selectedEdgeId) && !isSimulating
            ? 'hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400'
            : 'text-zinc-300 dark:text-zinc-600 cursor-not-allowed'
        "
      >
        <Trash2 class="w-6 h-6" />
      </button>
    </div>

    <!-- Connection Banner -->
    <div
      v-if="sourceNodeForEdge && !isSimulating"
      class="absolute bottom-4 right-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-2 rounded-full shadow-lg z-40 text-xs font-medium flex items-center gap-2"
    >
      <ArrowRightCircle class="w-3 h-3" />
      Ziel wählen (ESC = Abbruch)
    </div>

    <!-- PDA Keyboard Input Buffer -->
    <div
      v-if="
        selectedEdgeId &&
        currentProject.type === 'PDA' &&
        pdaInputBuffer.length > 0 &&
        !isSimulating &&
        !pdaEditorVisible
      "
      class="absolute bottom-4 right-4 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl z-40 border-2 border-emerald-400"
    >
      <div class="flex items-center gap-3">
        <span class="text-xs font-semibold opacity-75">Input:</span>
        <code class="text-lg font-mono font-bold bg-emerald-700 px-3 py-1 rounded">
          {{ pdaInputBuffer }}<span class="animate-pulse">|</span>
        </code>
      </div>
      <p class="text-[10px] mt-1 opacity-75">
        Format: input,stackTop/stackPush • Enter zum Bestätigen
      </p>
    </div>

    <!-- PDA Editing Hint (buffer empty) -->
    <div
      v-if="
        selectedEdgeId &&
        currentProject.type === 'PDA' &&
        pdaInputBuffer.length === 0 &&
        !isSimulating &&
        !pdaEditorVisible
      "
      class="absolute bottom-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-full shadow-lg z-40 text-xs font-medium flex items-center gap-2"
    >
      <span>+</span>
      Tippen: a,$/aa (verwende ε für Epsilon) • Doppelklick für Editor
    </div>

    <!-- TM Keyboard Input Buffer -->
    <div
      v-if="
        selectedEdgeId &&
        currentProject.type === 'TM' &&
        tmInputBuffer.length > 0 &&
        !isSimulating &&
        !tmEditorVisible
      "
      class="absolute bottom-4 right-4 bg-blue-600 text-white px-4 py-3 rounded-xl shadow-2xl z-40 border-2 border-blue-400"
    >
      <div class="flex items-center gap-3">
        <span class="text-xs font-semibold opacity-75 flex items-center gap-1"><Settings class="w-3 h-3" /> TM Eingabe:</span>
        <code class="text-lg font-mono font-bold bg-blue-700 px-3 py-1 rounded">
          {{ tmInputBuffer }}<span class="animate-pulse">|</span>
        </code>
      </div>
      <p class="text-[10px] mt-1 opacity-75">
        Format: c/L • c/d • w/R • Wird automatisch übernommen
      </p>
    </div>

    <!-- TM editing hint when buffer is empty -->
    <div
      v-if="
        selectedEdgeId &&
        currentProject.type === 'TM' &&
        tmInputBuffer.length === 0 &&
        !isSimulating &&
        !tmEditorVisible
      "
      class="absolute bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg z-40 text-xs font-medium flex items-center gap-2"
    >
      <Settings class="w-4 h-4" />
      Tippen: c/L • c/d • w/R • Doppelklick für Editor
    </div>

    <!-- Multi-Select Counter -->
    <div
      v-if="selectedNodeIds.size > 0 && !isSimulating"
      class="absolute bottom-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg z-40 text-xs font-bold"
    >
      {{ selectedNodeIds.size }} Node{{ selectedNodeIds.size > 1 ? 's' : '' }} • SHIFT+Click • Drag
      to move all
    </div>

    <!-- Cytoscape -->
    <div ref="cyContainer" class="w-full h-full relative z-10"></div>

    <!-- PDA Transition Editor Modal -->
    <PDATransitionEditor
      :visible="pdaEditorVisible"
      :transition="editingTransition"
      @close="pdaEditorVisible = false; editingTransition = null"
      @save="savePDATransition"
    />

    <!-- TM transition editor modal -->
    <TMTransitionEditor
      :visible="tmEditorVisible"
      :transition="editingTransition"
      @close="tmEditorVisible = false; editingTransition = null"
      @save="saveTMTransition"
    />
  </div>
</template>
