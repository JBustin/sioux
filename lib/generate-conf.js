const { readFile, writeFile, appendFile } = require('fs').promises
const dotenv = require('dotenv')
const { exec } = require('child_process')
const path = require('path')

const { extract, extractModules, extractDirectories } = require('./utils')

dotenv.config()

const dryRun = process.env.DRY_RUN
const debug = process.env.CONF_DEBUG
const destVhostsDir = process.env.HTTPD_VHOSTS_DIR || '/etc/apache2/sites-available/'

const httpdConfFile = process.env.HTTPD_CONF_FILE || '/etc/apache2/apache2.conf'
const httpdPortFile = process.env.HTTPD_PORT_FILE || '/etc/apache2/port.conf'
const httpdPort = process.env.HTTPD_PORT || '80'
const httpdHost = process.env.HTTPD_HOST || 'httpd.front.com'

const mode = process.env.MODE
const dir = process.env.SYS_VHOSTS_DIR
const testsDir = process.env.SYS_TESTS_DIR
const DEFAULT_FORMATTER_NAME = 'default-formatter.js'

const defaultFormaterPath =
  mode === 'SPEC'
    ? path.resolve(dir, DEFAULT_FORMATTER_NAME)
    : path.resolve(testsDir, DEFAULT_FORMATTER_NAME)

let defaultFormater
try {
  defaultFormater = require(defaultFormaterPath)
} catch (err) {
  console.warn(`Default formatter ${defaultFormaterPath} not found`)
}

function exit(err) {
  if (err) console.log(err)
  process.exit(!!err)
}

function a2ensite(vhost) {
  return new Promise((resolve, reject) =>
    exec(`a2ensite -m ${vhost}`, err => (err ? reject(err) : resolve())),
  )
}

async function genConf() {
  let resources
  try {
    resources = await extract({ dir, testsDir }, mode)
  } catch (err) {
    return Promise.reject(err)
  }

  const { vhosts } = resources

  if (debug) console.log('Loaded vhost files and formatters', vhosts)

  if (dryRun || debug) {
    console.log(httpdConfFile, `\nServerName ${httpdHost}\n`)
    console.log(httpdPortFile, `\nListen ${httpdPort}\n`)
    if (dryRun) return await Promise.all(vhosts.map(genVhost))
  }

  return Promise.all([
    ...vhosts.map(genVhost),
    appendFile(httpdConfFile, `ServerName ${httpdHost}\n`),
    writeFile(httpdPortFile, `Listen ${httpdPort}\n`),
  ])
}

async function genVhost({ file: confSrcFile, formatter: specificFormatterPath }, index) {
  let content
  const uniqueVhostName = `${index}-${path.basename(confSrcFile)}`
  const destPath = path.resolve(destVhostsDir, uniqueVhostName)

  try {
    content = (await readFile(confSrcFile)).toString()
  } catch (err) {
    return Promise.reject(err)
  }

  let specificFormatter

  try {
    specificFormatter = require(specificFormatterPath)
  } catch (err) {
    if (debug) console.warn(`${specificFormatterPath} not found, use default formatter if existing`)
  }

  const formatter = specificFormatter || defaultFormater || (({ content }) => content)

  if (!specificFormatter && !defaultFormater) console.warn(`Missing formatter for ${confSrcFile}`)

  content = formatter({
    env: process.env,
    content,
    confSrcFile,
    uniqueVhostName,
    extractModules,
    extractDirectories,
  })

  if (dryRun || debug) {
    console.log(destPath)
    console.log(`${content}\n`)
    if (dryRun) return Promise.resolve()
  }

  return Promise.all([
    writeFile(destPath, content),
    a2ensite(path.basename(uniqueVhostName, '.conf')),
  ])
}

genConf()
  .then(() => exit())
  .catch(exit)
