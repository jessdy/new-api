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
import { describe, expect, it, vi } from 'vitest'

import {
  normalizeFullTestConcurrency,
  normalizeFullTestRounds,
  runWithConcurrency,
  summarizeFullTestSamples,
  summarizeLatencies,
} from '../channel-full-test'

describe('channel full test helpers', () => {
  it('clamps rounds and concurrency to supported bounds', () => {
    expect(normalizeFullTestRounds(1)).toBe(3)
    expect(normalizeFullTestRounds(12.8)).toBe(12)
    expect(normalizeFullTestRounds(100)).toBe(50)
    expect(normalizeFullTestConcurrency(0)).toBe(1)
    expect(normalizeFullTestConcurrency(4.2)).toBe(4)
    expect(normalizeFullTestConcurrency(99)).toBe(10)
  })

  it('summarizes latency percentiles from successful samples', () => {
    const summary = summarizeLatencies([100, 200, 300, 400, 500])
    expect(summary.min).toBe(100)
    expect(summary.max).toBe(500)
    expect(summary.avg).toBe(300)
    expect(summary.p50).toBe(300)
    expect(summary.p95).toBeCloseTo(480)
  })

  it('computes success rate and ignores failed latency samples', () => {
    const summary = summarizeFullTestSamples([
      { ok: true, latencyMs: 120 },
      { ok: false, error: 'upstream timeout', errorCode: 'timeout' },
      { ok: true, latencyMs: 180 },
      { ok: false, error: 'rate limited' },
    ])

    expect(summary.total).toBe(4)
    expect(summary.success).toBe(2)
    expect(summary.failed).toBe(2)
    expect(summary.successRate).toBe(0.5)
    expect(summary.avg).toBe(150)
    expect(summary.lastError).toBe('rate limited')
  })

  it('runs tasks with a concurrency limit and reports progress', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const progress: number[] = []

    const tasks = Array.from({ length: 5 }, (_, index) => async () => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 20))
      inFlight -= 1
      return index
    })

    const results = await runWithConcurrency(tasks, 2, {
      onProgress: (completed) => {
        progress.push(completed)
      },
    })

    expect(maxInFlight).toBeLessThanOrEqual(2)
    expect(progress).toEqual([1, 2, 3, 4, 5])
    expect(results.every((result) => result.status === 'fulfilled')).toBe(true)
  })

  it('stops scheduling remaining tasks when shouldStop becomes true', async () => {
    let shouldStop = false
    const started = vi.fn()

    const tasks = Array.from({ length: 4 }, (_, index) => async () => {
      started(index)
      if (index === 0) shouldStop = true
      await new Promise((resolve) => setTimeout(resolve, 10))
      return index
    })

    const results = await runWithConcurrency(tasks, 1, {
      shouldStop: () => shouldStop,
    })

    expect(started).toHaveBeenCalledTimes(1)
    expect(results[0]?.status).toBe('fulfilled')
    expect(results.slice(1).every((result) => result.status === 'rejected')).toBe(
      true
    )
  })
})
