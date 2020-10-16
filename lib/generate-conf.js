const { readFile, writeFile, appendFile } = require('fs').promises
const dotenv = require('dotenv')
const { exec } = require('child_process')
const path = require('path')

const { getVhostFiles } = require('./utils')

dotenv.config()

const dryRun = process.env.DRY_RUN
const debug = process.env.CONF_DEBUG
const srcVhostsDir = process.env.TEST_VHOSTS_DIR || '/usr/app/vhosts'
const defaultFormaterPath =
  process.env.TEST_DEFAULT_FORMATTER || '/usr/app/vhosts/default-formatter.js'
const destVhostsDir = process.env.HTTPD_VHOSTS_DIR || '/etc/apache2/sites-available/'

const httpdConfFile = process.env.HTTPD_CONF_FILE || '/etc/apache2/apache2.conf'
const httpdPortFile = process.env.HTTPD_PORT_FILE || '/etc/apache2/port.conf'
const httpdPort = process.env.HTTPD_PORT || '80'
const httpdHost = process.env.HTTPD_HOST || 'httpd.front.com'

let defaultFormater
try {
  defaultFormater = require(defaultFormaterPath)
} catch (err) {
  if (debug) console.warn(`Default formatter ${defaultFormaterPath} not found`)
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
  let vhostFiles
  try {
    vhostFiles = await getVhostFiles(srcVhostsDir)
  } catch (err) {
    return Promise.reject(err)
  }

  if (debug) console.log('Loaded vhostFiles', vhostFiles)

  if (dryRun || debug) {
    console.log(httpdConfFile, `\nServerName ${httpdHost}\n`)
    console.log(httpdPortFile, `\nListen ${httpdPort}\n`)
    return await Promise.all(vhostFiles.map(genVhost))
  }

  return Promise.all([
    ...vhostFiles.map(genVhost),
    appendFile(httpdConfFile, `ServerName ${httpdHost}\n`),
    writeFile(httpdPortFile, `Listen ${httpdPort}\n`),
  ])
}

async function genVhost(confSrcFile, index) {
  let content
  const uniqueVhostName = `${index}-${path.basename(confSrcFile)}`
  const destPath = path.join(destVhostsDir, uniqueVhostName)

  try {
    content = (await readFile(confSrcFile)).toString()
  } catch (err) {
    return Promise.reject(err)
  }

  let specificFormatter

  try {
    specificFormatter = require(`${confSrcFile}.js`)
  } catch (err) {
    if (debug) console.warn(`${specificFormatter} not found, copy all content from source`)
  }

  const formatter = specificFormatter || defaultFormater || (({ content }) => content)

  content = formatter({ env: process.env, content })

  if (dryRun || debug) {
    console.log(destPath)
    console.log(`${content}\n`)
    return Promise.resolve()
  }

  return Promise.all([
    writeFile(destPath, content),
    a2ensite(path.basename(uniqueVhostName, '.conf')),
  ])
}

genConf()
  .then(() => exit())
  .catch(exit)
