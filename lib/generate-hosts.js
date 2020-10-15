const fs = require('fs')
const dotenv = require('dotenv')
const { promisify } = require('util')
const path = require('path')

const preaddir = promisify(fs.readdir)
const preadFile = promisify(fs.readFile)
const pappendFile = promisify(fs.appendFile)

dotenv.config()

const dryRun = process.env.DRY_RUN
const srcVhostsDir = process.env.TEST_VHOSTS_DIR
const backendHost = process.env.BACKEND_HOST
const httpdHost = process.env.HTTPD_HOST
const legacyHost = process.env.BACKEND_LEGACY_HOST
const includedVhostFiles = process.env.INCLUDED_VHOST_FILES && process.env.INCLUDED_VHOST_FILES.split(',')

function exit(err) {
  if (err) console.log(err)
  process.exit(!!err)
}

async function genHosts() {
  let vhostFiles
  let vhosts
  try {
    vhostFiles = await preaddir(srcVhostsDir)
    vhosts = (
      await Promise.all(
        vhostFiles
          .filter(vhostFiles => (includedVhostFiles ? includedVhostFiles.includes(vhostFiles) : true))
          .map(extractHostsFromVhost),
      )
    ).join(' ')
  } catch (err) {
    return Promise.reject(err)
  }

  if (dryRun) {
    console.log(
    '/etc/hosts',
    `\n\n## APACHE VHOST\n\n127.0.0.1 ${vhosts} ${backendHost} ${legacyHost} ${httpdHost}\n`,
    )
    return Promise.resolve()
  }

  return pappendFile(
    '/etc/hosts',
    `\n\n## APACHE VHOST\n\n127.0.0.1 ${vhosts} ${backendHost} ${legacyHost} ${httpdHost}\n`,
  )
}

async function extractHostsFromVhost(confSrcFile) {
  let data
  try {
    data = await preadFile(path.join(srcVhostsDir, confSrcFile))
  } catch (err) {
    return Promise.reject(err)
  }

  return data
    .toString()
    .match(/ServerAlias ([^\n]*)/gm)[0]
    .replace(/ServerAlias/, '')
    .trim()
}

genHosts()
  .then(() => exit())
  .catch(exit)
