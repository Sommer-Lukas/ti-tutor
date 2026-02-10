<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import cytoscape from 'cytoscape'
import type { Core } from 'cytoscape'
import { Plus, Flag, CircleDot, ArrowRightCircle, Trash2 } from 'lucide-vue-next'
import { currentProject, validationResult } from '@/lib/automatonStore'

// --- LOCAL STATE ---
let nodeIdCounter = 1
let edgeIdCounter = 0

const cyContainer = ref<HTMLElement | null>(null)
let cy: Core | null = null

const selectedNodeIds = ref<Set<string>>(new Set())
const selectedEdgeId = ref<string | null>(null)
const sourceNodeForEdge = ref<string | null>(null)

// --- MULTI-DRAG STATE ---
let isDragging = false
let dragStartPositions: Map<string, { x: number, y: number }> = new Map()

// --- STYLES ---
const updateNodeStyles = () => {
  if (!cy) return
  
  cy.nodes().forEach(node => {
    const nodeId = node.id()
    if (nodeId.startsWith('__start_')) return
    
    const state = currentProject.value.states.find(s => s.id === nodeId)
    if (!state) return
    
    const isSelected = selectedNodeIds.value.has(nodeId)
    const isConnecting = sourceNodeForEdge.value === nodeId
    
    // Check if node has validation errors
    const hasError = validationResult.value.errors.some(e => e.affectedElements.includes(nodeId))
    const hasWarning = validationResult.value.warnings.some(w => w.affectedElements.includes(nodeId))
    
    let borderColor = '#000'
    if (hasError) borderColor = '#dc2626'
    else if (hasWarning) borderColor = '#f59e0b'
    else if (isSelected) borderColor = '#3b82f6'
    else if (isConnecting) borderColor = '#06b6d4'
    
    node.style({
      'background-color': isSelected ? '#dbeafe' : '#fff',
      'border-color': borderColor,
      'border-width': isSelected ? (state.isFinal ? 10 : 6) : (state.isFinal ? 6 : 2),
      'border-style': state.isFinal ? 'double' : 'solid'
    })
  })
}

const updateEdgeStyles = () => {
  if (!cy) return
  
  cy.edges().forEach(edge => {
    const edgeId = edge.id()
    if (edgeId.startsWith('__start_edge_')) return
    
    const isSelected = selectedEdgeId.value === edgeId
    
    // Check if edge has validation errors
    const hasError = validationResult.value.errors.some(e => e.affectedElements.includes(edgeId))
    
    const color = hasError ? '#dc2626' : (isSelected ? '#3b82f6' : '#000')
    
    edge.style({
      'line-color': color,
      'target-arrow-color': color,
      'width': isSelected ? 4 : (hasError ? 3 : 2),
      'color': color,
      'font-weight': isSelected ? 'bold' : 'normal'
    })
  })
}

const updateAllStyles = () => {
  updateNodeStyles()
  updateEdgeStyles()
}

// --- ACTIONS ---
const addNode = () => {
  const id = `q${nodeIdCounter++}`
  currentProject.value.states.push({
    id,
    label: id,
    isStart: false,
    isFinal: false,
    position: { x: 150 + Math.random() * 300, y: 100 + Math.random() * 200 }
  })
  currentProject.value.updatedAt = new Date()
  syncToCytoscape()
}

const toggleFinalState = () => {
  if (selectedNodeIds.value.size === 0) return
  selectedNodeIds.value.forEach(nodeId => {
    const state = currentProject.value.states.find(s => s.id === nodeId)
    if (state) state.isFinal = !state.isFinal
  })
  currentProject.value.updatedAt = new Date()
  updateAllStyles()
}

const setStartState = () => {
  if (selectedNodeIds.value.size === 0) return
  selectedNodeIds.value.forEach(nodeId => {
    const state = currentProject.value.states.find(s => s.id === nodeId)
    if (state) state.isStart = !state.isStart
  })
  currentProject.value.updatedAt = new Date()
  syncToCytoscape()
}

const deleteSelected = () => {
  if (selectedNodeIds.value.size > 0) {
    selectedNodeIds.value.forEach(nodeId => {
      if (cy) cy.$id(nodeId).remove()
      currentProject.value.states = currentProject.value.states.filter(s => s.id !== nodeId)
      currentProject.value.transitions = currentProject.value.transitions.filter(
        t => t.from !== nodeId && t.to !== nodeId
      )
    })
    selectedNodeIds.value.clear()
  }
  
  if (selectedEdgeId.value) {
    if (cy) cy.$id(selectedEdgeId.value).remove()
    currentProject.value.transitions = currentProject.value.transitions.filter(t => t.id !== selectedEdgeId.value)
    selectedEdgeId.value = null
  }
  currentProject.value.updatedAt = new Date()
  updateAllStyles()
}

const startConnection = () => {
  if (selectedNodeIds.value.size !== 1) return
  const nodeId = Array.from(selectedNodeIds.value)[0]
  sourceNodeForEdge.value = nodeId
  selectedNodeIds.value.clear()
  updateAllStyles()
}

const toggleNodeSelection = (nodeId: string, multiSelect: boolean) => {
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

// --- CYTOSCAPE ---
onMounted(() => {
  if (!cyContainer.value) return

  cy = cytoscape({
    container: cyContainer.value,
    style: [
      {
        selector: 'node',
        style: {
          'background-color': '#fff',
          'border-width': 2,
          'border-color': '#000',
          'label': 'data(label)',
          'width': 56,
          'height': 56,
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': 12,
          'font-family': 'monospace',
          'font-weight': 'bold'
        }
      },
      {
        selector: 'node[?isStartMarker]',
        style: {
          'width': 1,
          'height': 1,
          'background-color': '#000',
          'border-width': 0,
          'label': ''
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 2,
          'line-color': '#000',
          'target-arrow-color': '#000',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'label': 'data(label)',
          'font-size': 14,
          'text-background-opacity': 1,
          'text-background-color': '#fff',
          'text-background-padding': '3px'
        }
      },
      {
        selector: 'edge[?isStartEdge]',
        style: {
          'width': 2.5,
          'line-color': '#000',
          'target-arrow-color': '#000',
          'target-arrow-shape': 'triangle',
          'curve-style': 'straight',
          'label': ''
        }
      }
    ],
    layout: { name: 'preset' },
    userZoomingEnabled: true,
    userPanningEnabled: true,
    boxSelectionEnabled: true,
    autoungrabify: false,
    autounselectify: true
  })

  syncToCytoscape()

  // --- DRAG START: Speichere Start-Positionen aller selected Nodes ---
  cy.on('grab', 'node', (event) => {
    const grabbedNode = event.target
    if (grabbedNode.id().startsWith('__start_')) return
    
    if (!selectedNodeIds.value.has(grabbedNode.id())) {
      isDragging = false
      return
    }
    
    isDragging = true
    dragStartPositions.clear()
    
    selectedNodeIds.value.forEach(nodeId => {
      const node = cy!.$id(nodeId)
      if (node.length > 0) {
        dragStartPositions.set(nodeId, {
          x: node.position('x'),
          y: node.position('y')
        })
      }
    })
  })

  // --- DRAG: Bewege alle selected Nodes synchron ---
  cy.on('drag', 'node', (event) => {
    if (!isDragging || selectedNodeIds.value.size <= 1) return
    
    const draggedNode = event.target
    const draggedNodeId = draggedNode.id()
    if (draggedNodeId.startsWith('__start_')) return
    
    const startPos = dragStartPositions.get(draggedNodeId)
    if (!startPos) return
    
    const currentPos = draggedNode.position()
    const deltaX = currentPos.x - startPos.x
    const deltaY = currentPos.y - startPos.y
    
    selectedNodeIds.value.forEach(nodeId => {
      if (nodeId === draggedNodeId) return
      
      const node = cy!.$id(nodeId)
      const nodeStartPos = dragStartPositions.get(nodeId)
      
      if (node.length > 0 && nodeStartPos) {
        node.position({
          x: nodeStartPos.x + deltaX,
          y: nodeStartPos.y + deltaY
        })
      }
    })
  })

  // --- DRAG END: Update State für alle moved Nodes ---
  cy.on('dragfree', 'node', (event) => {
    const node = event.target
    const nodeId = node.id()
    if (nodeId.startsWith('__start_')) return
    
    if (isDragging && selectedNodeIds.value.size > 1) {
      selectedNodeIds.value.forEach(id => {
        const cyNode = cy!.$id(id)
        const state = currentProject.value.states.find(s => s.id === id)
        if (state && cyNode.length > 0) {
          state.position = cyNode.position()
        }
      })
      isDragging = false
      dragStartPositions.clear()
      currentProject.value.updatedAt = new Date()
      syncToCytoscape()
    } else {
      const state = currentProject.value.states.find(s => s.id === nodeId)
      if (state) {
        state.position = node.position()
        currentProject.value.updatedAt = new Date()
        syncToCytoscape()
      }
    }
  })

  cy.on('tap', 'node', (event) => {
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
        symbol: ''
      })
      selectedEdgeId.value = edgeId
      selectedNodeIds.value.clear()
      sourceNodeForEdge.value = null
      currentProject.value.updatedAt = new Date()
      syncToCytoscape()
      return
    }
    
    toggleNodeSelection(node.id(), shiftPressed)
    selectedEdgeId.value = null
  })

  cy.on('cxttap', 'node', (event) => {
    event.preventDefault()
    const node = event.target
    if (node.id().startsWith('__start_')) return
    
    sourceNodeForEdge.value = node.id()
    selectedNodeIds.value.clear()
    selectedEdgeId.value = null
    updateAllStyles()
  })

  cy.on('tap', 'edge', (event) => {
    const edge = event.target
    if (edge.id().startsWith('__start_edge_')) return
    
    selectedEdgeId.value = edge.id()
    selectedNodeIds.value.clear()
    updateAllStyles()
  })

  cy.on('tap', (event) => {
    if (event.target === cy) {
      selectedNodeIds.value.clear()
      selectedEdgeId.value = null
      sourceNodeForEdge.value = null
      updateAllStyles()
    }
  })

  cy.on('boxend', () => {
    const cySelected = cy!.$('node:selected')
    const realNodes = cySelected.filter(node => !node.id().startsWith('__start_'))
    
    realNodes.forEach(node => {
      selectedNodeIds.value.add(node.id())
    })
    
    cy!.nodes().unselect()
    selectedEdgeId.value = null
    updateAllStyles()
  })

  cy.on('dbltap', (event) => {
    if (event.target !== cy) return
    const pos = event.position
    const id = `q${nodeIdCounter++}`
    currentProject.value.states.push({
      id,
      label: id,
      isStart: currentProject.value.states.length === 0,
      isFinal: false,
      position: { x: pos.x, y: pos.y }
    })
    currentProject.value.updatedAt = new Date()
    syncToCytoscape()
  })

  cy.on('dbltap', 'node', (event) => {
    const node = event.target
    if (node.id().startsWith('__start_')) return
    
    const state = currentProject.value.states.find(s => s.id === node.id())
    if (state) {
      state.isFinal = !state.isFinal
      currentProject.value.updatedAt = new Date()
      updateAllStyles()
    }
  })
})

const syncToCytoscape = () => {
  if (!cy) return

  // --- 1. REMOVE deleted nodes/edges ---
  cy.nodes().forEach(node => {
    const nodeId = node.id()
    if (nodeId.startsWith('__start_')) {
      // Check if the target state still exists
      const targetId = nodeId.replace('__start_', '')
      const targetExists = currentProject.value.states.some(s => s.id === targetId && s.isStart)
      if (!targetExists) {
        node.remove()
      }
    } else {
      // Regular node
      if (!currentProject.value.states.some(s => s.id === nodeId)) {
        node.remove()
      }
    }
  })

  cy.edges().forEach(edge => {
    const edgeId = edge.id()
    if (edgeId.startsWith('__start_edge_')) {
      const targetId = edgeId.replace('__start_edge_', '')
      const targetExists = currentProject.value.states.some(s => s.id === targetId && s.isStart)
      if (!targetExists) {
        edge.remove()
      }
    } else {
      if (!currentProject.value.transitions.some(t => t.id === edgeId)) {
        edge.remove()
      }
    }
  })

  // --- 2. ADD/UPDATE nodes ---
  currentProject.value.states.forEach(state => {
    const existingNode = cy.$id(state.id)
    
    if (existingNode.length > 0) {
      // Update existing node
      existingNode.data('label', state.label)
      existingNode.position(state.position)
    } else {
      // Add new node
      cy.add({
        data: { id: state.id, label: state.label },
        position: state.position
      })
    }

    // Handle start marker
    const markerId = `__start_${state.id}`
    const existingMarker = cy.$id(markerId)
    
    if (state.isStart) {
      const markerPos = { x: state.position.x - 80, y: state.position.y }
      
      if (existingMarker.length > 0) {
        existingMarker.position(markerPos)
      } else {
        cy.add({
          data: { id: markerId, label: '', isStartMarker: true },
          position: markerPos
        })
        cy.$id(markerId).ungrabify()
      }

      // Add start edge
      const startEdgeId = `__start_edge_${state.id}`
      const existingStartEdge = cy.$id(startEdgeId)
      if (existingStartEdge.length === 0) {
        cy.add({
          data: { id: startEdgeId, source: markerId, target: state.id, isStartEdge: true }
        })
      }
    } else {
      // Remove marker if no longer start state
      if (existingMarker.length > 0) {
        existingMarker.remove()
      }
      const startEdgeId = `__start_edge_${state.id}`
      const existingStartEdge = cy.$id(startEdgeId)
      if (existingStartEdge.length > 0) {
        existingStartEdge.remove()
      }
    }
  })

  // --- 3. ADD/UPDATE edges ---
  currentProject.value.transitions.forEach(transition => {
    const existingEdge = cy.$id(transition.id)
    
    if (existingEdge.length > 0) {
      // Update existing edge
      existingEdge.data('label', transition.symbol || '')
      existingEdge.data('source', transition.from)
      existingEdge.data('target', transition.to)
    } else {
      // Add new edge
      cy.add({
        data: {
          id: transition.id,
          source: transition.from,
          target: transition.to,
          label: transition.symbol || ''
        }
      })
    }
  })

  updateAllStyles()
}

// --- KEYBOARD ---
const handleKeyDown = (e: KeyboardEvent) => {
  if (!cy) return

  if (e.key === 'Escape' && sourceNodeForEdge.value) {
    sourceNodeForEdge.value = null
    updateAllStyles()
    return
  }

  if (e.key === 'Delete') {
    e.preventDefault()
    deleteSelected()
    return
  }

  if (selectedEdgeId.value) {
    const transition = currentProject.value.transitions.find(t => t.id === selectedEdgeId.value)
    if (!transition) return

    if (e.key === 'Backspace') {
      e.preventDefault()
      transition.symbol = transition.symbol.slice(0, -1)
      currentProject.value.updatedAt = new Date()
      syncToCytoscape()
      return
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      transition.symbol += e.key
      currentProject.value.updatedAt = new Date()
      syncToCytoscape()
    }
    return
  }

  if (selectedNodeIds.value.size === 1) {
    const nodeId = Array.from(selectedNodeIds.value)[0]
    const state = currentProject.value.states.find(s => s.id === nodeId)
    if (!state) return

    if (e.key === 'Backspace') {
      e.preventDefault()
      state.label = state.label.slice(0, -1)
      if (cy) cy.$id(nodeId).data('label', state.label)
      return
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      state.label += e.key
      if (cy) cy.$id(nodeId).data('label', state.label)
    }
  }
}

onMounted(() => window.addEventListener('keydown', handleKeyDown))
onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))
</script>

<template>
  <div class="relative w-full h-full">

    <!-- Grid -->
    <div 
      class="absolute inset-0 pointer-events-none" 
      style="
        background-image: radial-gradient(circle, #cbd5e1 1px, transparent 1px);
        background-size: 20px 20px;
      "
    ></div>

    <!-- Toolbar (z-50 - ÜBER Modal!) -->
    <div class="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-white/95 backdrop-blur-md rounded-full shadow-xl border border-zinc-200/50 px-3 py-2.5 flex items-center gap-2">
      
      <button @click="addNode" class="p-2.5 rounded-full hover:bg-zinc-100 transition-colors">
        <Plus class="w-6 h-6 text-zinc-700" />
      </button>

      <div class="w-px h-6 bg-zinc-200"></div>

      <button 
        @click="setStartState"
        :disabled="selectedNodeIds.size === 0"
        class="p-2.5 rounded-full transition-colors"
        :class="selectedNodeIds.size > 0 ? 'hover:bg-green-50 text-green-600' : 'text-zinc-300 cursor-not-allowed'"
      >
        <Flag class="w-6 h-6" />
      </button>

      <button 
        @click="toggleFinalState"
        :disabled="selectedNodeIds.size === 0"
        class="p-2.5 rounded-full transition-colors"
        :class="selectedNodeIds.size > 0 ? 'hover:bg-purple-50 text-purple-600' : 'text-zinc-300 cursor-not-allowed'"
      >
        <CircleDot class="w-6 h-6" />
      </button>

      <button 
        @click="startConnection"
        :disabled="selectedNodeIds.size !== 1"
        class="p-2.5 rounded-full transition-colors"
        :class="selectedNodeIds.size === 1 ? 'hover:bg-cyan-50 text-cyan-600' : 'text-zinc-300 cursor-not-allowed'"
      >
        <ArrowRightCircle class="w-6 h-6" />
      </button>

      <div class="w-px h-6 bg-zinc-200"></div>

      <button 
        @click="deleteSelected"
        :disabled="selectedNodeIds.size === 0 && !selectedEdgeId"
        class="p-2.5 rounded-full transition-colors"
        :class="(selectedNodeIds.size > 0 || selectedEdgeId) ? 'hover:bg-red-50 text-red-600' : 'text-zinc-300 cursor-not-allowed'"
      >
        <Trash2 class="w-6 h-6" />
      </button>

    </div>

    <!-- Connection Banner -->
    <div 
      v-if="sourceNodeForEdge" 
      class="absolute bottom-4 right-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-2 rounded-full shadow-lg z-40 text-xs font-medium flex items-center gap-2"
    >
      <ArrowRightCircle class="w-3 h-3" />
      Ziel wählen (ESC = Abbruch)
    </div>

    <!-- Multi-Select Counter -->
    <div 
      v-if="selectedNodeIds.size > 0"
      class="absolute bottom-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg z-40 text-xs font-bold"
    >
      {{ selectedNodeIds.size }} Node{{ selectedNodeIds.size > 1 ? 's' : '' }} • SHIFT+Click • Drag to move all
    </div>
    
    <!-- Cytoscape -->
    <div ref="cyContainer" class="w-full h-full relative z-10"></div>

  </div>
</template>
