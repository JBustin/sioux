const { callbackify } = require('util')

const globalInjector = require('./global-injector')
const { extract, isJson, runTestFromJson } = require('./utils')

let only = false
let tests = []
let currentContext
let currentSuite

function test(name, fn) {
  if (!only) tests.push({ suite: currentSuite, context: currentContext, name, fn })
}
test.only = function (name, fn) {
  only = true
  tests = [{ suite: currentSuite, context: currentContext, name, fn }]
}
test.skip = function () {}

function displaySuiteName(suiteName) {
  currentSuite = suiteName
  if (!only) tests.push({ suite: suiteName, type: 'suite' })
}

function context(contextName) {
  currentContext = contextName
  if (!only) tests.push({ context: contextName, type: 'context' })
}

async function run(ctx) {
  const mode = process.env.MODE
  const dir = process.env.SYS_VHOSTS_DIR
  const testsDir = process.env.SYS_TESTS_DIR
  const { httpBackend } = ctx
  const failed = []
  let succeed = 0

  console.log('Test runner', { mode, dir, testsDir })

  globalInjector({ test, context, httpBackend, suite: displaySuiteName })

  try {
    const suites = (await extract({ dir, testsDir }, mode)).tests
    suites.forEach(suite => {
      if (isJson(suite)) {
        const { name, tests } = require(suite)
        return runTestFromJson(name || suite, tests)
      }
      return require(suite.replace(/\.js/, ''))
    })

    const testsIterator = {
      [Symbol.asyncIterator]() {
        return {
          i: 0,
          async next() {
            if (this.i >= tests.length) return Promise.resolve({ done: true })
            let { suite, context, name, fn, type } = tests[this.i]
            httpBackend.flush()
            this.i += 1

            if (type) return Promise.resolve({ value: { suite, context, name, type }, done: false })

            type = 'success'
            let error
            try {
              await fn()
            } catch (err) {
              type = 'failed'
              error = err
            }

            return Promise.resolve({ value: { suite, context, name, type, error }, done: false })
          },
        }
      },
    }

    for await (let { suite, context, name, type, error } of testsIterator) {
      if (type === 'success') {
        succeed += 1
        console.log('\t\t✅', name)
      } else if (type === 'failed') {
        failed.push({ suite, context, name, type, error })
        console.log('\t\t❌', `${name}\n`)
        console.log(error.stack)
      } else if (type === 'context') {
        console.log(`\n\t * ${context}\n`)
      } else if (type === 'suite') {
        console.log(`\n${suite}\n`)
      }
    }
  } catch (err) {
    return Promise.reject(err)
  }

  console.log(`\nResults:\n\t- Succeed: ${succeed}\n\t- Failed: ${failed.length}\n`)

  failed.map(({ suite, context, name, error }) => {
    console.log(`\n${suite}\n`)
    console.log(`\n\t * ${context}\n`)
    console.log('\t\t❌', `${name}\n`)
    console.log(error.stack)
  })

  return Promise[failed.length ? 'reject' : 'resolve'](null)
}

module.exports = callbackify(run)
