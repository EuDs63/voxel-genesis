import { describe, expect, test } from 'vitest'
import { parseRuleNotation } from './rules'

describe('rule parsing', () => {
  test('parses canonical B/S notation', () => {
    const rule = parseRuleNotation('B6/S5,6,7')
    expect(rule.birth.has(6)).toBe(true)
    expect(rule.survive.has(5)).toBe(true)
    expect(rule.notation).toBe('B6/S5,6,7')
  })

  test('throws on invalid notation', () => {
    expect(() => parseRuleNotation('S6/B5')).toThrowError()
    expect(() => parseRuleNotation('B/S')).toThrowError()
    expect(() => parseRuleNotation('B2,27/S1')).toThrowError()
  })
})
