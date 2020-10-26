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

  config.forEach(({ name, expectations, rules }) => {
    context(name)
    apply(expectations, rules)
  })
}

function apply(
  { host: defaultHost, pathname: defaultPathname, httpStatusCode: defaultHttpStatusCode } = {},
  rules,
) {
  rules.forEach(
    ({
      name,
      host: requestHost,
      pathname: requestPathname,
      headers,
      expectations: {
        host: expectHost,
        pathname: expectPathname,
        httpStatusCode: expectStatusCode,
      } = {},
    }) =>
      test(name || requestPathname, async () => {
        const { status } = await fetch(`http://${requestHost}/${requestPathname}`, { headers })
        const { headers: { host } = {}, url } = httpBackend.unqueue() || {}
        const statusCode = expectStatusCode || defaultHttpStatusCode || 200
        expect(status).to.equal(statusCode)
        if (statusCode < 400) {
          expect(host.replace(/(:[0-9]{0,4})/, '')).to.equal(
            expectHost || defaultHost || requestHost,
          )
          expect(url).to.equal(expectPathname || defaultPathname || requestPathname)
        }
        expect(httpBackend.noExpectations()).to.be.true
      }),
  )
}

module.exports.isJson = isJson
