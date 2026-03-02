import { describe, expect, it } from 'vitest'
import { EXERCISES, getExercisesByType } from '../lib/exerciseStore'

const getExerciseById = (id: string) => {
  const exercise = EXERCISES.find((entry) => entry.id === id)
  expect(exercise).toBeDefined()
  return exercise!
}

const countChar = (input: string, char: string) => [...input].filter((c) => c === char).length

const isPalindrome = (s: string) => s === s.split('').reverse().join('')

describe('ExerciseStore catalogue', () => {
  it('contains all exercise types', () => {
    const dfaCount = getExercisesByType('DFA').length
    const nfaCount = getExercisesByType('NFA').length
    const pdaCount = getExercisesByType('PDA').length
    const tmCount = getExercisesByType('TM').length

    expect(dfaCount).toBeGreaterThan(0)
    expect(nfaCount).toBeGreaterThan(0)
    expect(pdaCount).toBeGreaterThan(0)
    expect(tmCount).toBeGreaterThan(0)
  })
})

describe('ExerciseStore DFA catalogue', () => {
  it('contains all newly added DFA exercises', () => {
    const dfaIds = new Set(getExercisesByType('DFA').map((exercise) => exercise.id))

    const expectedIds = [
      'dfa-02',
      'dfa-03',
      'dfa-04',
      'dfa-05',
      'dfa-06',
      'dfa-07',
      'dfa-08',
    ]

    expectedIds.forEach((id) => {
      expect(dfaIds.has(id)).toBe(true)
    })
  })

  it('dfa-02 test cases match: contains XXYZX', () => {
    const exercise = getExerciseById('dfa-02')
    const accepts = (input: string) => input.includes('XXYZX')

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('dfa-03 test cases match: contains aaa or bbb', () => {
    const exercise = getExerciseById('dfa-03')
    const accepts = (input: string) => input.includes('aaa') || input.includes('bbb')

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('dfa-04 test cases match: number of a is not 3', () => {
    const exercise = getExerciseById('dfa-04')
    const accepts = (input: string) => countChar(input, 'a') !== 3

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('dfa-05 test cases match: exactly two a and one b', () => {
    const exercise = getExerciseById('dfa-05')
    const accepts = (input: string) => /^[ab]*$/.test(input) && countChar(input, 'a') === 2 && countChar(input, 'b') === 1

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('dfa-06 test cases match: (ab)^n (aabb)^m', () => {
    const exercise = getExerciseById('dfa-06')
    const accepts = (input: string) => /^(ab)+(aabb)+$/.test(input)

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('dfa-07 test cases match: ab^n with n>=2 OR ba^m with m>=2', () => {
    const exercise = getExerciseById('dfa-07')
    const accepts = (input: string) => /^ab{2,}$/.test(input) || /^ba{2,}$/.test(input)

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('dfa-08 test cases match: at least two zeros between ones', () => {
    const exercise = getExerciseById('dfa-08')
    const accepts = (input: string) => {
      let previousOneIndex = -1
      for (let index = 0; index < input.length; index++) {
        if (input[index] !== '1') continue
        if (previousOneIndex >= 0 && index - previousOneIndex < 3) {
          return false
        }
        previousOneIndex = index
      }
      return true
    }

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })
})

describe('ExerciseStore NFA catalogue', () => {
  it('contains all newly added NFA exercises', () => {
    const nfaIds = new Set(getExercisesByType('NFA').map((exercise) => exercise.id))

    const expectedIds = [
      'nfa-01',
      'nfa-02',
      'nfa-03',
      'nfa-04',
      'nfa-05',
      'nfa-06',
      'nfa-07',
      'nfa-08',
      'nfa-09',
    ]

    expectedIds.forEach((id) => {
      expect(nfaIds.has(id)).toBe(true)
    })
  })

  it('nfa-02 test cases match: contains XXYZX', () => {
    const exercise = getExerciseById('nfa-02')
    const accepts = (input: string) => input.includes('XXYZX')

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('nfa-03 test cases match: starts with ab OR ends with ba', () => {
    const exercise = getExerciseById('nfa-03')
    const accepts = (input: string) => input.startsWith('ab') || input.endsWith('ba')

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('nfa-04 test cases match: x^n y^m x^k with k mod 3 = 0', () => {
    const exercise = getExerciseById('nfa-04')
    const accepts = (input: string) => {
      // n ≥ 1, m ≥ 1, k ≥ 0, k mod 3 = 0
      const match = /^(x+)(y+)(x*)$/.exec(input)
      if (!match || !match[1] || !match[2] || match[3] === undefined) return false
      return match[1].length >= 1 && match[2].length >= 1 && match[3].length % 3 === 0
    }

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('nfa-05 test cases match: third-to-last character is a', () => {
    const exercise = getExerciseById('nfa-05')
    const accepts = (input: string) =>
      input.length >= 3 && input[input.length - 3] === 'a'

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('nfa-06 test cases match: contains aa XOR bb', () => {
    const exercise = getExerciseById('nfa-06')
    const accepts = (input: string) => {
      const hasAA = input.includes('aa')
      const hasBB = input.includes('bb')
      return (hasAA && !hasBB) || (!hasAA && hasBB)
    }

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('nfa-07 test cases match: palindromes of length <= 5', () => {
    const exercise = getExerciseById('nfa-07')
    const accepts = (input: string) => input.length <= 5 && /^[ab]*$/.test(input) && isPalindrome(input)

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('nfa-08 test cases match: same 2-char prefix and suffix', () => {
    const exercise = getExerciseById('nfa-08')
    const accepts = (input: string) => {
      if (input.length < 4 || !/^[ab]+$/.test(input)) return false
      const prefix = input.slice(0, 2)
      const suffix = input.slice(-2)
      return prefix === suffix
    }

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('nfa-09 test cases match: contains a^n b^n as substring (n>=1)', () => {
    const exercise = getExerciseById('nfa-09')
    const accepts = (input: string) => {
      // Check if input contains a^n b^n for some n >= 1
      for (let i = 0; i < input.length; i++) {
        for (let n = 1; i + 2 * n <= input.length; n++) {
          const candidate = input.slice(i, i + 2 * n)
          if (candidate === 'a'.repeat(n) + 'b'.repeat(n)) {
            return true
          }
        }
      }
      return false
    }

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })
})

describe('ExerciseStore PDA catalogue', () => {
  it('contains all newly added PDA exercises', () => {
    const pdaIds = new Set(getExercisesByType('PDA').map((exercise) => exercise.id))

    const expectedIds = [
      'pda-01',
      'pda-02',
      'pda-03',
      'pda-04',
      'pda-05',
      'pda-06',
      'pda-07',
      'pda-08',
      'pda-09',
      'pda-10',
      'pda-11',
    ]

    expectedIds.forEach((id) => {
      expect(pdaIds.has(id)).toBe(true)
    })
  })

  it('pda-02 test cases match: a^n b^m with n <= m', () => {
    const exercise = getExerciseById('pda-02')
    const accepts = (input: string) => {
      const match = /^(a+)(b+)$/.exec(input)
      if (!match || !match[1] || !match[2]) return false
      return match[1].length <= match[2].length
    }

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('pda-03 test cases match: w c w^R', () => {
    const exercise = getExerciseById('pda-03')
    const accepts = (input: string) => {
      const parts = input.split('c')
      if (parts.length !== 2) return false
      const [left, right] = parts
      return left === right!.split('').reverse().join('') && /^[ab]*$/.test(left!)
    }

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('pda-04 test cases match: a^n b^n c^m d^m', () => {
    const exercise = getExerciseById('pda-04')
    const accepts = (input: string) => {
      const match = /^(a+)(b+)(c+)(d+)$/.exec(input)
      if (!match || !match[1] || !match[2] || !match[3] || !match[4]) return false
      return match[1].length === match[2].length && match[3].length === match[4].length
    }

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('pda-05 test cases match: a^(2n) b^n', () => {
    const exercise = getExerciseById('pda-05')
    const accepts = (input: string) => {
      const match = /^(a+)(b+)$/.exec(input)
      if (!match || !match[1] || !match[2]) return false
      return match[1].length === 2 * match[2].length
    }

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('pda-06 test cases match: a^m b^n with m > n', () => {
    const exercise = getExerciseById('pda-06')
    const accepts = (input: string) => {
      const match = /^(a+)(b*)$/.exec(input)
      if (!match || !match[1]) return false
      const bCount = match[2] ? match[2].length : 0
      return match[1].length > bCount
    }

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('pda-07 test cases match: a^n b^m c^m d^n', () => {
    const exercise = getExerciseById('pda-07')
    const accepts = (input: string) => {
      const match = /^(a+)(b+)(c+)(d+)$/.exec(input)
      if (!match || !match[1] || !match[2] || !match[3] || !match[4]) return false
      return match[1].length === match[4].length && match[2].length === match[3].length
    }

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('pda-08 test cases match: a^n b^m a^n', () => {
    const exercise = getExerciseById('pda-08')
    const accepts = (input: string) => {
      const match = /^(a+)(b+)(a+)$/.exec(input)
      if (!match || !match[1] || !match[2] || !match[3]) return false
      return match[1].length === match[3].length
    }

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('pda-09 test cases match: a^m b^n c^i with m + n = i', () => {
    const exercise = getExerciseById('pda-09')
    const accepts = (input: string) => {
      const match = /^(a*)(b+)(c+)$/.exec(input)
      if (!match || match[2] === undefined || !match[3]) return false
      const aCount = match[1] ? match[1].length : 0
      return aCount + match[2].length === match[3].length
    }

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('pda-10 test cases match: a^n b^i c^j with n = i + j', () => {
    const exercise = getExerciseById('pda-10')
    const accepts = (input: string) => {
      const match = /^(a+)(b+)(c*)$/.exec(input)
      if (!match || !match[1] || !match[2]) return false
      const cCount = match[3] ? match[3].length : 0
      return match[1].length === match[2].length + cCount
    }

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('pda-11 test cases match: a^(2m) b^n c^n d^m', () => {
    const exercise = getExerciseById('pda-11')
    const accepts = (input: string) => {
      const match = /^(a+)(b+)(c+)(d+)$/.exec(input)
      if (!match || !match[1] || !match[2] || !match[3] || !match[4]) return false
      // Check: a's must be even (for 2m), and a_count/2 = d_count, and b_count = c_count
      const aCount = match[1].length
      if (aCount % 2 !== 0) return false // a's must be even
      return (
        aCount === 2 * match[4].length && match[2].length === match[3].length
      )
    }

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })
})

describe('ExerciseStore TM catalogue', () => {
  it('contains all newly added TM exercises', () => {
    const tmIds = new Set(getExercisesByType('TM').map((exercise) => exercise.id))

    const expectedIds = [
      'tm-01',
      'tm-02',
      'tm-03',
      'tm-04',
      'tm-05',
      'tm-06',
      'tm-07',
      'tm-08',
      'tm-09',
    ]

    expectedIds.forEach((id) => {
      expect(tmIds.has(id)).toBe(true)
    })
  })

  it('tm-01 test cases match: unary increment (n -> n+1)', () => {
    const exercise = getExerciseById('tm-01')
    const transform = (input: string) => {
      if (!/^I+$/.test(input)) return null
      // Add one I (increment)
      return input + 'I'
    }

    exercise.testCases.forEach(({ input, expectedOutput }) => {
      expect(transform(input)).toBe(expectedOutput)
    })
  })

  it('tm-02 test cases match: a^n -> b$b^(n-1)', () => {
    const exercise = getExerciseById('tm-02')
    const transform = (input: string) => {
      if (!/^a+$/.test(input)) return null
      const n = input.length
      return 'b$' + 'b'.repeat(Math.max(0, n - 1))
    }

    exercise.testCases.forEach(({ input, expectedOutput }) => {
      expect(transform(input)).toBe(expectedOutput)
    })
  })

  it('tm-03 test cases match: length in unary (|x| as I\'s, where n -> n+1 I\'s)', () => {
    const exercise = getExerciseById('tm-03')
    const transform = (input: string) => {
      if (!/^[cd]+$/.test(input)) return null
      // Unary representation: n -> (n+1) I's
      return 'I'.repeat(input.length + 1)
    }

    exercise.testCases.forEach(({ input, expectedOutput }) => {
      expect(transform(input)).toBe(expectedOutput)
    })
  })

  it('tm-04 test cases match: starts with c, ends with d', () => {
    const exercise = getExerciseById('tm-04')
    const accepts = (input: string) => {
      return /^[cd]+$/.test(input) && input.startsWith('c') && input.endsWith('d')
    }

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('tm-05 test cases match: double unary (n -> 2n in unary notation)', () => {
    const exercise = getExerciseById('tm-05')
    const transform = (input: string) => {
      if (!/^I+$/.test(input)) return null
      // Input: k I's = number (k-1)
      // Output: 2*(k-1) = number, represented as 2*(k-1)+1 = 2k-1 I's
      return 'I'.repeat(input.length * 2 - 1)
    }

    exercise.testCases.forEach(({ input, expectedOutput }) => {
      expect(transform(input)).toBe(expectedOutput)
    })
  })

  it('tm-06 test cases match: binary increment', () => {
    const exercise = getExerciseById('tm-06')
    const transform = (input: string) => {
      if (!/^[01]+$/.test(input)) return null
      const decimal = parseInt(input, 2)
      return (decimal + 1).toString(2)
    }

    exercise.testCases.forEach(({ input, expectedOutput }) => {
      expect(transform(input)).toBe(expectedOutput)
    })
  })

  it('tm-07 test cases match: palindrome check', () => {
    const exercise = getExerciseById('tm-07')
    const accepts = (input: string) => {
      return /^[ab]+$/.test(input) && input === input.split('').reverse().join('')
    }

    exercise.testCases.forEach(({ input, expectedAccepted }) => {
      expect(accepts(input)).toBe(expectedAccepted)
    })
  })

  it('tm-08 test cases match: unary decrement (n -> n-1)', () => {
    const exercise = getExerciseById('tm-08')
    const transform = (input: string) => {
      if (!/^I+$/.test(input)) return null
      // Remove one I (decrement)
      return input.slice(0, -1)
    }

    exercise.testCases.forEach(({ input, expectedOutput }) => {
      expect(transform(input)).toBe(expectedOutput)
    })
  })

  it('tm-09 test cases match: copy word (x -> xx)', () => {
    const exercise = getExerciseById('tm-09')
    const transform = (input: string) => {
      if (!/^[ab]+$/.test(input)) return null
      return input + input
    }

    exercise.testCases.forEach(({ input, expectedOutput }) => {
      expect(transform(input)).toBe(expectedOutput)
    })
  })
})

