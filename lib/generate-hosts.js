const { readFile, appendFile } = require('fs').promises
const dotenv = require('dotenv')

const { extract } = require('./utils')

dotenv.config()

const dryRun = process.env.DRY_RUN
const debug = process.env.CONF_DEBUG
const backendHost = process.env.BACKEND_HOST
const httpdHost = process.env.HTTPD_HOST
const legacyHost = process.env.BACKEND_LEGACY_HOST

const mode = process.env.MODE
const dir = process.env.SYS_VHOSTS_DIR
const testsDir = process.env.SYS_TESTS_DIR

function exit(err) {
  if (err) console.log(err)
  process.exit(!!err)
}

async function genHosts() {
  let resources
  try {
    resources = await extract({ dir, testsDir }, mode)
  } catch (err) {
    return Promise.reject(err)
  }

  const { vhosts } = resources
  if (debug)
    console.log(
      'Loaded vhost files',
      vhosts.map(({ file }) => file),
    )

  let alias
  try {
    alias = (await Promise.all(vhosts.map(extractHostsFromVhost))).join(' ')
  } catch (err) {
    return Promise.reject(err)
  }

  if (dryRun || debug) {
    console.log(
      '/etc/hosts',
      `\n\n## APACHE VHOST\n\n127.0.0.1 ${alias} ${backendHost} ${legacyHost} ${httpdHost}\n`,
    )
    if (dryRun) return Promise.resolve()
  }

  return appendFile(
    '/etc/hosts',
    `\n\n## APACHE VHOST\n\n127.0.0.1 ${alias} ${backendHost} ${legacyHost} ${httpdHost}\n`,
  )
}

async function extractHostsFromVhost({ file }) {
  let data
  try {
    data = await readFile(file)
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
