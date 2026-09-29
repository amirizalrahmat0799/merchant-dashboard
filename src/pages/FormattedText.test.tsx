import { render, screen } from '@testing-library/react'
import { FormattedText } from './AssistantPage'

describe('FormattedText', () => {
  it('renders paragraphs, bullet lists and bold without using HTML injection', () => {
    const { container } = render(<FormattedText text={'Hello **there**\n- one\n- two\n<script>alert(1)</script>'} />)

    expect(screen.getByText('there').tagName).toBe('STRONG')
    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(container.querySelector('script')).toBeNull()
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument()
  })
})
