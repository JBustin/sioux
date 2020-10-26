const { callbackify } = require('util')

const globalInjector = require('./global-injector')
const { extract, isJson, runTestFromJson } = require('./utils')

let only = false
let tests = []

function test(name, fn) {
  if (!only) tests.push({ name, fn })
}
test.only = function (name, fn) {
  only = true
  tests = [{ name, fn }]
}
test.skip = function () {}

function displaySuiteName(filename) {
  if (!only) tests.push({ name: filename, type: 'suite' })
}

function context(name) {
  if (!only) tests.push({ name, type: 'context' })
}

async function run(ctx) {
  const mode = process.env.MODE
  const dir = process.env.SYS_VHOSTS_DIR
  const testsDir = process.env.SYS_TESTS_DIR
  const { httpBackend } = ctx
  let succeed = 0
  let failed = 0

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
            let { name, fn, type } = tests[this.i]
            httpBackend.flush()
            this.i += 1

            if (type) return Promise.resolve({ value: { name, type }, done: false })

            type = 'success'
            let error
            try {
              await fn()
            } catch (err) {
              type = 'failed'
              error = err
            }
            return Promise.resolve({ value: { name, type, error }, done: false })
          },
        }
      },
    }

    for await (let { name, type, error } of testsIterator) {
      if (type === 'success') {
        succeed += 1
        console.log('\t\t✅', name)
      } else if (type === 'failed') {
        failed += 1
        console.log('\t\t❌', `${name}\n`)
        console.log(error.stack)
      } else if (type === 'context') {
        console.log(`\n\t * ${name}\n`)
      } else if (type === 'suite') {
        console.log(`\n${name}\n`)
      }
    }
  } catch (err) {
    return Promise.reject(err)
  }

  console.log(`\nResults:\n\t- Succeed: ${succeed}\n\t- Failed: ${failed}\n`)

  return Promise[failed ? 'reject' : 'resolve'](null)
}

module.exports = callbackify(run)
