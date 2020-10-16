const { resolve } = require('path')
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

module.exports.extract = async ({ dir, testsDir }, mode = 'SPEC') => {
  const fullPath = resolve(dir)
  const fullTestPath = resolve(testsDir)

  if (mode === 'SPEC') {
    const all = await getFiles(dir)
    const tests = all.filter(vhost => vhost.endsWith('.spec.js'))
    const vhosts = tests.map(specFile => ({
      file: specFile.replace(/\.spec\.js/, '.conf'),
      formatter: specFile.replace(/\.spec\.js/, '.js'),
    }))
    return { vhosts, tests }
  }

  const vhosts = (await getFiles(dir))
    .filter(file => file.endsWith('.conf'))
    .map(vhost => ({
      file: vhost,
      formatter: vhost.replace(new RegExp(fullPath), fullTestPath).replace(/\.conf/, '.js'),
    }))
  const tests = (await getFiles(testsDir)).filter(file => file.endsWith('.spec.js'))
  return { vhosts, tests }
}
