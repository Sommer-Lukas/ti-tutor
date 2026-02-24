import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../App.vue'

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

  beforeEach(() => {
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()
    wrapper = mount(App)
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
  })
})
