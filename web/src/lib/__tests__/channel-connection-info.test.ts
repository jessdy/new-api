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
import assert from 'node:assert/strict'

import { describe, test } from 'vitest'

import {
  channelBaseUrlFromConnection,
  openAICompatibleBaseUrl,
} from '@/lib/channel-connection-info'

describe('openAICompatibleBaseUrl', () => {
  test('adds /v1 and keeps an existing suffix', () => {
    assert.equal(
      openAICompatibleBaseUrl('https://api.example.com'),
      'https://api.example.com/v1'
    )
    assert.equal(
      openAICompatibleBaseUrl('https://api.example.com/'),
      'https://api.example.com/v1'
    )
    assert.equal(
      openAICompatibleBaseUrl('https://api.example.com/v1'),
      'https://api.example.com/v1'
    )
    assert.equal(
      openAICompatibleBaseUrl('https://api.example.com/v1/'),
      'https://api.example.com/v1'
    )
  })
})

describe('channelBaseUrlFromConnection', () => {
  test('removes the OpenAI /v1 suffix before it is stored as a channel base URL', () => {
    assert.equal(
      channelBaseUrlFromConnection('https://api.example.com/v1'),
      'https://api.example.com'
    )
    assert.equal(
      channelBaseUrlFromConnection('https://api.example.com/v1/'),
      'https://api.example.com'
    )
    assert.equal(
      channelBaseUrlFromConnection('https://api.example.com'),
      'https://api.example.com'
    )
  })
})
