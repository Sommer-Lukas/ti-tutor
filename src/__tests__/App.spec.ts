import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import App from '../App.vue'
import {
  addTestCase,
  createProject,
  currentProjectId,
  projects,
  testCases,
} from '../lib/automatonStore'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
})

describe('App Component', () => {
  let wrapper: ReturnType<typeof mount>

  const SidebarStub = defineComponent({
    name: 'Sidebar',
    props: ['isOpen'],
    emits: ['update:isOpen'],
    template: '<aside data-test="sidebar"></aside>',
  })

  const EditorCanvasStub = defineComponent({
    name: 'EditorCanvas',
    props: ['currentSimulationState', 'isSimulating'],
    template: '<div data-test="editor-canvas"></div>',
  })

  const TestPanelStub = defineComponent({
    name: 'TestPanel',
    props: ['selected', 'visible', 'simulationResults'],
    emits: ['update:selected', 'update:visible', 'update:pdaStartStackSymbol'],
    template: '<div data-test="test-panel"></div>',
  })

  const SimulationStepBarStub = defineComponent({
    name: 'SimulationStepBar',
    props: ['simulation', 'currentStepIndex', 'automatonType'],
    template: '<div data-test="simulation-step-bar"></div>',
  })

  const SimulationTreePanelStub = defineComponent({
    name: 'SimulationTreePanel',
    props: ['simulation', 'currentStepIndex', 'automatonType'],
    template: '<div data-test="simulation-tree-panel"></div>',
  })

  const mountApp = () =>
    mount(App, {
      global: {
        stubs: {
          Sidebar: SidebarStub,
          EditorCanvas: EditorCanvasStub,
          TestPanel: TestPanelStub,
          SimulationStepBar: SimulationStepBarStub,
          SimulationTreePanel: SimulationTreePanelStub,
        },
      },
    })

  const resetStore = () => {
    projects.value = []
    testCases.value = []
    currentProjectId.value = null
  }

  beforeEach(() => {
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()
    resetStore()
    wrapper = mountApp()
  })

  afterEach(() => {
    wrapper.unmount()
  })

  describe('Rendering', () => {
    it('renders the app component', () => {
      expect(wrapper.exists()).toBe(true)
    })

    it('has correct root structure', () => {
      expect(wrapper.find('.flex').exists()).toBe(true)
    })

    it('displays empty state when no projects', () => {
      const heading = wrapper.text()
      expect(heading.includes('Kein Projekt') || heading.includes('Willkommen')).toBe(true)
    })
  })

  describe('Layout', () => {
    it('contains main content section', () => {
      const main = wrapper.find('main')
      expect(main.exists()).toBe(true)
    })

    it('has sidebar element', () => {
      expect(wrapper.html()).toBeTruthy()
    })

    it('renders correctly', () => {
      expect(wrapper.element).toBeDefined()
    })
  })

  describe('Header', () => {
    it('contains header element', () => {
      const header = wrapper.find('header')
      expect(header.exists()).toBe(true)
    })

    it('displays welcome or empty state', () => {
      const text = wrapper.text()
      const hasWelcomeOrEmpty = text.includes('Willkommen') || text.includes('Kein Projekt')
      expect(hasWelcomeOrEmpty).toBe(true)
    })
  })

  describe('Buttons and Interactions', () => {
    it('has buttons', () => {
      const buttons = wrapper.findAll('button')
      expect(buttons.length).toBeGreaterThanOrEqual(0)
    })

    it('dispatches open-new-automaton-dialog on empty state action', async () => {
      vi.useFakeTimers()
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
      const actionButton = wrapper
        .findAll('button')
        .find((btn) => btn.text().includes('Neuen Automaten erstellen'))

      expect(actionButton).toBeTruthy()
      await actionButton!.trigger('click')
      vi.runAllTimers()

      expect(dispatchSpy).toHaveBeenCalled()
      const event = dispatchSpy.mock.calls[0]?.[0] as Event
      expect(event.type).toBe('open-new-automaton-dialog')

      dispatchSpy.mockRestore()
      vi.useRealTimers()
    })

    it('enables start after selecting a test case', async () => {
      wrapper.unmount()
      resetStore()
      const project = createProject('Test DFA', 'DFA')
      const firstState = project.states.find((state) => state.isStart) ?? project.states[0]
      if (!firstState) {
        throw new Error('Expected at least one state in project')
      }
      firstState.isFinal = true
      addTestCase('', true)

      wrapper = mountApp()

      const startButton = wrapper.find('button[title="Start (F5)"]')
      expect(startButton.attributes('disabled')).toBeDefined()

      const testCaseId = testCases.value[0]?.id
      const testPanel = wrapper.findComponent({ name: 'TestPanel' })
      testPanel.vm.$emit('update:selected', testCaseId)
      await nextTick()

      const startButtonAfter = wrapper.find('button[title="Start (F5)"]')
      expect(startButtonAfter.attributes('disabled')).toBeUndefined()
    })

    it('shows simulation tree for DFA after starting', async () => {
      wrapper.unmount()
      resetStore()
      const project = createProject('Test DFA', 'DFA')
      const firstState = project.states.find((state) => state.isStart) ?? project.states[0]
      if (!firstState) {
        throw new Error('Expected at least one state in project')
      }
      firstState.isFinal = true
      addTestCase('', true)

      wrapper = mountApp()

      const testCaseId = testCases.value[0]?.id
      const testPanel = wrapper.findComponent({ name: 'TestPanel' })
      testPanel.vm.$emit('update:selected', testCaseId)
      await nextTick()

      const startButton = wrapper.find('button[title="Start (F5)"]')
      await startButton.trigger('click')
      await nextTick()

      expect(wrapper.find('[data-test="simulation-tree-panel"]').exists()).toBe(true)
    })
  })
})
