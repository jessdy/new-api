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
import axios from 'axios'

import {
  getServerErrorMessageKey,
  safeServerErrorMessage,
} from './server-error-message'

export class AuthOperationError extends Error {
  readonly [safeServerErrorMessage] = true
  constructor(
    message: string,
    readonly code?: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'AuthOperationError'
  }

  static from(
    error: unknown,
    fallback = 'Verification failed. Please try again.'
  ): AuthOperationError {
    if (error instanceof AuthOperationError) return error
    if (axios.isAxiosError<{ message?: string; code?: string }>(error)) {
      const status = error.response?.status
      let message = getServerErrorMessageKey(error)
      if (!message && status === 429) {
        message = 'Too many requests'
      } else if (!message && status !== undefined && status >= 500) {
        message = 'Please try again later.'
      } else if (!message) {
        message =
          error.response?.data?.message || error.message || fallback
      }
      return new AuthOperationError(message, error.response?.data?.code, {
        cause: error,
      })
    }
    return new AuthOperationError(
      error instanceof Error ? error.message : fallback,
      undefined,
      { cause: error }
    )
  }
}

export const authRequestOptions = {
  skipBusinessError: true,
  skipErrorHandler: true,
}

export async function authResult<T>(
  request: Promise<{
    data: { success: boolean; message?: string; code?: string; data?: T }
  }>,
  fallback = 'Verification failed. Please try again.'
): Promise<T> {
  try {
    const { data: response } = await request
    if (!response.success || response.data === undefined) {
      throw new AuthOperationError(
        getServerErrorMessageKey(response) || response.message || fallback,
        response.code
      )
    }
    return response.data
  } catch (error) {
    throw AuthOperationError.from(error, fallback)
  }
}
