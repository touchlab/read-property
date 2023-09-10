import * as core from '@actions/core'
import { parse } from 'dot-properties'
import * as fs from 'fs'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const file: string = core.getInput('file')
    const property: string = core.getInput('property')

    core.debug(`read-property: file-${file}`)
    core.debug(`read-property: property-${property}`)

    const src = fs.readFileSync(file, 'utf8')
    core.info(`src read ${src}`)
    const obj = parse(src)
    const propVal = obj[property]

    core.debug(`read-property: propVal-${propVal}`)

    core.setOutput("propVal", propVal)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run()
