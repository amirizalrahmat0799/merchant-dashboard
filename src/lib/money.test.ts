import { formatMoney, toMinor } from './money'

describe('toMinor', () => {
  it.each([
    ['12.50', 1250],
    ['12.5', 1250],
    ['12', 1200],
    ['0.01', 1],
    [' 7.00 ', 700],
  ])('parses %s as %i sen', (input, expected) => {
    expect(toMinor(input)).toBe(expected)
  })

  it.each(['', 'abc', '1.234', '-5', '1,000'])('rejects %s', (input) => {
    expect(toMinor(input)).toBeNaN()
  })

  it('never loses a sen to floating point', () => {
    expect(toMinor('19.99')).toBe(1999)
    expect(toMinor('0.29')).toBe(29)
  })
})

describe('formatMoney', () => {
  it('formats minor units as ringgit', () => {
    expect(formatMoney(123456)).toMatch(/RM\s?1,234\.56/)
  })
})
