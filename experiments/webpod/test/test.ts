import { Response } from '../src/ssh.js'

// wrap wraps a test function to catch Response errors,
// otherwise uvu will not catch them and skip the test.
export function wrap(fn: Function) {
  return async function() {
    try {
      await fn()
    } catch (err) {
      if (err instanceof Response) {
        throw new Error(`${err.stderr.trim()}\n    at ${err.location}`)
      }
      throw err
    }
  }
}
