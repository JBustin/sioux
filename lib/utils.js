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

  config.forEach(({ name, isDocRoot, headers, expectations, rules }) => {
    context(name)
    apply({ ...expectations, isDocRoot, headers }, rules)
  })
}

function apply(
  {
    backend: defaultBackend,
    host: defaultHost,
    pathname: defaultPathname,
    httpStatusCode: defaultHttpStatusCode,
    headers: defaultHeaders,
    body: defaultBody,
    isDocRoot: defaultIsDocRoot,
  } = {},
  rules,
) {
  rules.forEach(
    ({
      name,
      only,
      testIsDocRoot = false,
      host: requestHost,
      pathname: requestPathname,
      headers: requestHeaders,
      expectations: {
        host: expectHost,
        backend: expectBackend,
        pathname: expectPathname,
        httpStatusCode: expectStatusCode,
        body: expectBody,
      } = {},
    }) => {
      const testFn = only ? test.only : test
      testFn(name || requestPathname, async () => {
        const headers = requestHeaders || defaultHeaders || null
        const res = await fetch(`http://${requestHost}${requestPathname}`, { headers })
        const { status } = res

        const statusCode = expectStatusCode || defaultHttpStatusCode || 200
        const checkXForwardedHost = expectHost || defaultHost || requestHost
        const checkBackend = expectBackend || defaultBackend
        const checkBody = expectBody || defaultBody || false
        const isDocRoot = testIsDocRoot || defaultIsDocRoot || false

        expect(status).to.equal(statusCode)

        if (checkBody) {
          expect(await res.text()).to.equal(checkBody)
        }

        if (isDocRoot) return

        const { headers: { host, 'x-forwarded-host': xForwardedHost } = {}, url } =
          httpBackend.unqueue() || {}

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

module.exports.extractDirectories = content => {
  const rxOpen = /<Directory/g
  const rxClose = /<\/Directory>/g
  let iter
  const directoryTags = []
  const directories = []
  while ((iter = rxOpen.exec(content))) {
    directoryTags.push({ type: 'open', index: iter.index })
  }
  while ((iter = rxClose.exec(content))) {
    directoryTags.push({ type: 'close', index: iter.index })
  }

  directoryTags.sort(({ index: index1 }, { index: index2 }) => index1 - index2)
  if (directoryTags.length % 2 !== 0) throw new Error('Directories tags are corrupted.')

  while (directoryTags.length) {
    for (let i = 0; i < directoryTags.length; i++) {
      const cur = directoryTags[i]
      const next = directoryTags[i + 1]
      if (!cur || !next) i = directoryTags.length
      if (cur.type === 'open' && next.type === 'close') {
        directories.push({ open: cur.index, close: next.index })
        directoryTags.splice(i, 2)
      }
    }
  }

  return directories.reduce((acc, module) => {
    const name = (
      content.substring(module.open, module.close).match(/<Directory (.*)>/)[1] || ''
    ).replace(/"/gm, '')
    const extract = content.substring(module.open, module.close + '</Directory>'.length)
    return { ...acc, [name]: extract }
  }, {})
}

module.exports.extractModules = content => {
  const rxOpen = /<IfModule/g
  const rxClose = /<\/IfModule>/g
  let iter
  const moduleTags = []
  const modules = []
  while ((iter = rxOpen.exec(content))) {
    moduleTags.push({ type: 'open', index: iter.index })
  }
  while ((iter = rxClose.exec(content))) {
    moduleTags.push({ type: 'close', index: iter.index })
  }

  moduleTags.sort(({ index: index1 }, { index: index2 }) => index1 - index2)
  if (moduleTags.length % 2 !== 0) throw new Error('Modules tags are corrupted.')

  while (moduleTags.length) {
    for (let i = 0; i < moduleTags.length; i++) {
      const cur = moduleTags[i]
      const next = moduleTags[i + 1]
      if (!cur || !next) i = moduleTags.length
      if (cur.type === 'open' && next.type === 'close') {
        modules.push({ open: cur.index, close: next.index })
        moduleTags.splice(i, 2)
      }
    }
  }

  return modules.reduce((acc, module) => {
    const name = content.substring(module.open, module.close).match(/<IfModule (.*)>/)[1]
    const extract = content.substring(module.open, module.close + '</IfModule>'.length)
    return { ...acc, [name]: extract }
  }, {})
}

module.exports.isJson = isJson
