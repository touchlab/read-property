/**
 * Unit tests for the action's entrypoint, src/index.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as core from '@actions/core'
import * as fs from 'fs'
import * as path from 'path'
import * as index from '../src/index'

// fs exports are non-configurable in modern Node, so jest.spyOn can't replace
// readFileSync; swap the module for one whose readFileSync is a jest.fn that
// delegates to the real implementation by default.
jest.mock('fs', () => {
  const actual = jest.requireActual<typeof import('fs')>('fs')
  return { ...actual, readFileSync: jest.fn(actual.readFileSync) }
})

// Mock the GitHub Actions core library. These need real (no-op)
// implementations rather than calling through: the real core.setFailed sets
// process.exitCode, which would make Jest exit non-zero even when every test
// passes.
const getInputMock = jest.spyOn(core, 'getInput').mockImplementation(() => '')
const setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation(() => {})
const setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation(() => {})
jest.spyOn(core, 'debug').mockImplementation(() => {})

// Mock the action's entrypoint
const runMock = jest.spyOn(index, 'run')

const fixture = path.join(__dirname, 'fixtures', 'gradle.properties')

const mockInputs = (file: string, property: string): void => {
  getInputMock.mockImplementation((name: string): string => {
    switch (name) {
      case 'file':
        return file
      case 'property':
        return property
      default:
        return ''
    }
  })
}

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sets propVal from the properties file', async () => {
    mockInputs(fixture, 'LIBRARY_VERSION')

    await index.run()
    expect(runMock).toHaveReturned()

    expect(setOutputMock).toHaveBeenNthCalledWith(1, 'propVal', '1.4.2')
    expect(setFailedMock).not.toHaveBeenCalled()
  })

  it('reads a dotted key', async () => {
    mockInputs(fixture, 'kotlin.code.style')

    await index.run()
    expect(runMock).toHaveReturned()

    expect(setOutputMock).toHaveBeenNthCalledWith(1, 'propVal', 'official')
  })

  it('sets an undefined output for a missing key', async () => {
    mockInputs(fixture, 'NOT_A_REAL_KEY')

    await index.run()
    expect(runMock).toHaveReturned()

    expect(setOutputMock).toHaveBeenNthCalledWith(1, 'propVal', undefined)
    expect(setFailedMock).not.toHaveBeenCalled()
  })

  it('sets a failed status when the file cannot be read', async () => {
    mockInputs(
      path.join(__dirname, 'fixtures', 'does-not-exist.properties'),
      'X'
    )

    // The error has to be constructed inside the test realm: errors raised by
    // node's own fs are not `instanceof Error` inside Jest's sandbox, so the
    // action's `error instanceof Error` guard would silently skip setFailed.
    ;(fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
      throw new Error('ENOENT: no such file or directory')
    })

    await index.run()
    expect(runMock).toHaveReturned()

    expect(setFailedMock).toHaveBeenCalledTimes(1)
    expect(setFailedMock).toHaveBeenCalledWith(
      expect.stringContaining('ENOENT')
    )
    expect(setOutputMock).not.toHaveBeenCalled()
  })
})
