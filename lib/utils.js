const { resolve } = require('path')
const { readdir } = require('fs').promises

function keepOnlyVhostWithSpec(files) {
  return files
    .flat()
    .filter(file => file.endsWith('.spec.js'))
    .map(specFile => specFile.replace(/\.spec\.js/, ''))
}

async function getFiles(dir) {
  const dirents = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    dirents.map(dirent => {
      const res = resolve(dir, dirent.name)
      return dirent.isDirectory() ? getFiles(res) : res
    }),
  )
  return Array.prototype.concat(files)
}

module.exports.getVhostFiles = async dir => keepOnlyVhostWithSpec(await getFiles(dir))
