import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../App.vue'

describe('App Component', () => {
  let wrapper: any

  beforeEach(() => {
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
      const emptyState = wrapper.find('h1')
      expect(emptyState.text()).toContain('Kein Projekt')
    })
  })

  describe('Layout', () => {
    it('contains main content section', () => {
      const main = wrapper.find('main')
      expect(main.exists()).toBe(true)
    })

    it('renders sidebar component', () => {
      // Sidebar is mounted as a child component
      expect(wrapper.findComponent({ name: 'Sidebar' }).exists()).toBe(true)
    })

    it('renders test panel component', () => {
      expect(wrapper.findComponent({ name: 'TestPanel' }).exists()).toBe(true)
    })
  })

  describe('Header', () => {
    it('contains header element', () => {
      const header = wrapper.find('header')
      expect(header.exists()).toBe(true)
    })

    it('displays welcome message in empty state', () => {
      const heading = wrapper.find('h2')
      expect(heading.text()).toContain('Willkommen')
    })
  })

  describe('Buttons and Interactions', () => {
    it('has new automaton button', () => {
      const buttons = wrapper.findAll('button')
      expect(buttons.length).toBeGreaterThan(0)
    })
  })
})
