/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Hero } from '../hero'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children?: ReactNode; to: string }) => (
    <a href={props.to}>{props.children}</a>
  ),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@/hooks/use-system-config', () => ({
  useSystemConfig: () => ({
    logo: '/logo.png',
    loading: false,
    logoLoaded: true,
  }),
}))

vi.mock('../../hero-terminal-demo', () => ({
  HeroTerminalDemo: () => <div>Terminal demo</div>,
}))

describe('Hero branding', () => {
  it('shows the system logo beside the headline', () => {
    render(<Hero />)

    const heading = screen.getByRole('heading', { level: 1 })
    const logo = screen.getByRole('img', { name: 'Logo' })

    expect(heading).toContainElement(logo)
    expect(heading).toHaveTextContent('Unified API Gateway for')
  })

  it('does not show a documentation link', () => {
    render(<Hero />)

    expect(screen.queryByRole('link', { name: 'Docs' })).not.toBeInTheDocument()
  })
})
