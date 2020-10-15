const fs = require('fs')
const dotenv = require('dotenv')
const { promisify } = require('util')
const { exec } = require('child_process')
const path = require('path')

const preaddir = promisify(fs.readdir)
const preadFile = promisify(fs.readFile)
const pwriteFile = promisify(fs.writeFile)
const pappendFile = promisify(fs.appendFile)

dotenv.config()

const dryRun = process.env.DRY_RUN
const srcVhostsDir = process.env.TEST_VHOSTS_DIR || '/usr/app/vhosts'
const formattersVhostsDir = process.env.FORMATTERS_VHOSTS_DIR || '/usr/app/formatters'
const destVhostsDir = process.env.HTTPD_VHOSTS_DIR || '/etc/apache2/sites-available/'
const includedVhostFiles = process.env.INCLUDED_VHOST_FILES && process.env.INCLUDED_VHOST_FILES.split(',')

const httpdConfFile = process.env.HTTPD_CONF_FILE || '/etc/apache2/apache2.conf'
const httpdPortFile = process.env.HTTPD_PORT_FILE || '/etc/apache2/port.conf'
const httpdPort = process.env.HTTPD_PORT || '80'
const httpdHost = process.env.HTTPD_HOST || 'httpd.front.com'

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
  let vhosts
  try {
    vhosts = (await preaddir(srcVhostsDir)).filter(vhostFiles => (includedVhostFiles ? includedVhostFiles.includes(vhostFiles) : true))
  } catch (err) {
    return Promise.reject(err)
  }

  if (dryRun) {
    console.log(httpdConfFile, `\nServerName ${httpdHost}\n`)
    console.log(httpdPortFile, `\nListen ${httpdPort}\n`)
    return await Promise.all(vhosts.map(genVhost))
  }

  return Promise.all([
    ...vhosts.map(genVhost),
    pappendFile(httpdConfFile, `ServerName ${httpdHost}\n`),
    pwriteFile(httpdPortFile, `Listen ${httpdPort}\n`),
  ])
}

async function genVhost(confSrcFile) {
  let content
  const srcPath = path.join(srcVhostsDir, confSrcFile)
  const destPath = path.join(destVhostsDir, confSrcFile)
  const formatterPath = path.join(formattersVhostsDir, `${confSrcFile}.js`)

  try {
    content = (await preadFile(srcPath)).toString()
  } catch (err) {
    return Promise.reject(err)
  }

  try {
    content = require(formatterPath)({ env: process.env, content })
  } catch (err) {
    console.warn(`${formatterPath} not found, copy all content from source`)
  }

  if (dryRun) {
    console.log(destPath)
    console.log(`${content}\n`)
    return Promise.resolve()
  }

  return Promise.all([pwriteFile(destPath, content), a2ensite(path.basename(confSrcFile, '.conf'))])
}

genConf()
  .then(() => exit())
  .catch(exit)
