const { readFile, appendFile } = require('fs').promises
const dotenv = require('dotenv')

const { getVhostFiles } = require('./utils')

dotenv.config()

const dryRun = process.env.DRY_RUN
const debug = process.env.CONF_DEBUG
const srcVhostsDir = process.env.TEST_VHOSTS_DIR
const backendHost = process.env.BACKEND_HOST
const httpdHost = process.env.HTTPD_HOST
const legacyHost = process.env.BACKEND_LEGACY_HOST

function exit(err) {
  if (err) console.log(err)
  process.exit(!!err)
}

async function genHosts() {
  let vhostFiles
  let vhosts
  try {
    vhostFiles = await getVhostFiles(srcVhostsDir)
    if (debug) console.log('Loaded vhost files', vhostFiles)
    vhosts = (await Promise.all(vhostFiles.map(extractHostsFromVhost))).join(' ')
  } catch (err) {
    return Promise.reject(err)
  }

  if (dryRun || debug) {
    console.log(
      '/etc/hosts',
      `\n\n## APACHE VHOST\n\n127.0.0.1 ${vhosts} ${backendHost} ${legacyHost} ${httpdHost}\n`,
    )
    return Promise.resolve()
  }

  return appendFile(
    '/etc/hosts',
    `\n\n## APACHE VHOST\n\n127.0.0.1 ${vhosts} ${backendHost} ${legacyHost} ${httpdHost}\n`,
  )
}

async function extractHostsFromVhost(confSrcFile) {
  let data
  try {
    data = await readFile(confSrcFile)
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
