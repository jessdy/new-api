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

export const FULL_TEST_DEFAULT_ROUNDS = 10
export const FULL_TEST_MIN_ROUNDS = 3
export const FULL_TEST_MAX_ROUNDS = 50
export const FULL_TEST_DEFAULT_CONCURRENCY = 3
export const FULL_TEST_MIN_CONCURRENCY = 1
export const FULL_TEST_MAX_CONCURRENCY = 10

export type FullTestSample = {
  ok: boolean
  /** Response time in milliseconds. */
  latencyMs?: number
  error?: string
  errorCode?: string
}

export type FullTestLatencySummary = {
  avg: number | null
  min: number | null
  max: number | null
  p50: number | null
  p95: number | null
}

export type FullTestSummary = FullTestLatencySummary & {
  total: number
  success: number
  failed: number
  successRate: number
  lastError?: string
  lastErrorCode?: string
}

export type RunWithConcurrencyOptions = {
  signal?: AbortSignal
  onProgress?: (completed: number, total: number) => void
  shouldStop?: () => boolean
}

function clampInt(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(value)))
}

export function normalizeFullTestRounds(value: number) {
  return clampInt(
    value,
    FULL_TEST_MIN_ROUNDS,
    FULL_TEST_MAX_ROUNDS,
    FULL_TEST_DEFAULT_ROUNDS
  )
}

export function normalizeFullTestConcurrency(value: number) {
  return clampInt(
    value,
    FULL_TEST_MIN_CONCURRENCY,
    FULL_TEST_MAX_CONCURRENCY,
    FULL_TEST_DEFAULT_CONCURRENCY
  )
}

function percentile(sorted: number[], ratio: number): number | null {
  if (sorted.length === 0) return null
  if (sorted.length === 1) return sorted[0]
  const index = (sorted.length - 1) * ratio
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  const weight = index - lower
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

export function summarizeLatencies(
  samplesMs: Array<number | undefined | null>
): FullTestLatencySummary {
  const values = samplesMs
    .filter((value): value is number => typeof value === 'number')
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((left, right) => left - right)

  if (values.length === 0) {
    return { avg: null, min: null, max: null, p50: null, p95: null }
  }

  const sum = values.reduce((total, value) => total + value, 0)
  return {
    avg: sum / values.length,
    min: values.at(0) ?? null,
    max: values.at(-1) ?? null,
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
  }
}

export function summarizeFullTestSamples(
  samples: FullTestSample[]
): FullTestSummary {
  const total = samples.length
  const success = samples.filter((sample) => sample.ok).length
  const failed = total - success
  const latency = summarizeLatencies(
    samples.filter((sample) => sample.ok).map((sample) => sample.latencyMs)
  )
  const lastFailure = [...samples].reverse().find((sample) => !sample.ok)

  return {
    total,
    success,
    failed,
    successRate: total === 0 ? 0 : success / total,
    avg: latency.avg,
    min: latency.min,
    max: latency.max,
    p50: latency.p50,
    p95: latency.p95,
    lastError: lastFailure?.error,
    lastErrorCode: lastFailure?.errorCode,
  }
}

export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
  options: RunWithConcurrencyOptions = {}
): Promise<Array<PromiseSettledResult<T>>> {
  const limit = normalizeFullTestConcurrency(concurrency)
  const results: Array<PromiseSettledResult<T> | undefined> = Array.from({
    length: tasks.length,
  })
  let nextIndex = 0
  let completed = 0

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (nextIndex < tasks.length) {
      if (options.signal?.aborted || options.shouldStop?.()) {
        break
      }
      const current = nextIndex
      nextIndex += 1
      const task = tasks[current]
      try {
        const value = await task()
        results[current] = { status: 'fulfilled', value }
      } catch (error) {
        results[current] = { status: 'rejected', reason: error }
      }
      completed += 1
      options.onProgress?.(completed, tasks.length)
    }
  })

  await Promise.all(workers)

  while (nextIndex < tasks.length) {
    results[nextIndex] = {
      status: 'rejected',
      reason: new DOMException('Full test stopped', 'AbortError'),
    }
    nextIndex += 1
  }

  return results.map(
    (result) =>
      result ?? {
        status: 'rejected' as const,
        reason: new DOMException('Full test stopped', 'AbortError'),
      }
  )
}
