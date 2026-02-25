import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Custom render function that wraps components with providers if needed
function customRender(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return {
    user: userEvent.setup(),
    ...render(ui, { ...options }),
  }
}

// Re-export everything from testing-library
export * from '@testing-library/react'
export { customRender as render }
export { userEvent }
