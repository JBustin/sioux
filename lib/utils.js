const { resolve, basename } = require('path')
const { readdir } = require('fs').promises

async function getFiles(dir) {
  const dirents = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    dirents.map(dirent => {
      const res = resolve(dir, dirent.name)
      return dirent.isDirectory() ? getFiles(res) : res
    }),
  )
  return Array.prototype.concat(files).flat()
}

function isJson(specFile) {
  return /\.spec\.json/.test(specFile)
}

module.exports.extract = async ({ dir, testsDir }, mode = 'SPEC') => {
  const fullPath = resolve(dir)
  const fullTestPath = resolve(testsDir)

  if (mode === 'SPEC') {
    const all = await getFiles(dir)
    const tests = all.filter(vhost => vhost.endsWith('.spec.js') || vhost.endsWith('.spec.json'))
    const vhosts = tests.map(specFile => {
      const extPattern = isJson(specFile) ? /\.spec\.json/ : /\.spec\.js/
      return {
        file: specFile.replace(/\.spec\.js/, '.conf'),
        formatter: specFile.replace(extPattern, '.js'),
      }
    })
    return { vhosts, tests }
  }

  const tests = (await getFiles(testsDir)).filter(
    file => file.endsWith('.spec.js') || file.endsWith('.spec.json'),
  )

  const testNames = tests.map(test =>
    isJson(test) ? basename(test, '.spec.json') : basename(test, '.spec.js'),
  )

  const vhosts = (await getFiles(dir))
    .filter(file => file.endsWith('.conf') && testNames.includes(basename(file, '.conf')))
    .map(vhost => ({
      file: vhost,
      formatter: vhost.replace(new RegExp(fullPath), fullTestPath).replace(/\.conf/, '.js'),
    }))
  return { vhosts, tests }
}

module.exports.runTestFromJson = (suiteName, config) => {
  suite(suiteName)

  config.forEach(({ name, headers, expectations, rules }) => {
    context(name)
    apply({ ...expectations, headers }, rules)
  })
}

function apply(
  {
    backend: defaultBackend,
    host: defaultHost,
    pathname: defaultPathname,
    httpStatusCode: defaultHttpStatusCode,
    headers: defaultHeaders,
  } = {},
  rules,
) {
  rules.forEach(
    ({
      name,
      only,
      host: requestHost,
      pathname: requestPathname,
      headers: requestHeaders,
      expectations: {
        host: expectHost,
        backend: expectBackend,
        pathname: expectPathname,
        httpStatusCode: expectStatusCode,
      } = {},
    }) => {
      const testFn = only ? test.only : test
      testFn(name || requestPathname, async () => {
        const headers = requestHeaders || defaultHeaders || null

        const { status } = await fetch(`http://${requestHost}/${requestPathname}`, { headers })
        const { headers: { host, 'x-forwarded-host': xForwardedHost } = {}, url } =
          httpBackend.unqueue() || {}

        const statusCode = expectStatusCode || defaultHttpStatusCode || 200
        const checkXForwardedHost = expectHost || defaultHost || requestHost
        const checkBackend = expectBackend || defaultBackend

        expect(status).to.equal(statusCode)
        if (statusCode < 400) {
          if (checkBackend) expect(host.replace(/(:[0-9]{0,4})/, '')).to.equal(checkBackend)
          expect(xForwardedHost).to.equal(checkXForwardedHost)
          expect(url).to.equal(expectPathname || defaultPathname || requestPathname)
        }
        expect(httpBackend.noExpectations()).to.be.true
      })
    },
  )
}

module.exports.isJson = isJson
