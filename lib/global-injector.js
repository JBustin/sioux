const chai = require('chai')
const fetch = require('node-fetch')
const url = require('url')
const AbortController = require('abort-controller')

const timeoutMs = parseInt(process.env.FETCH_TIMEOUT_MS || 3000, 10)
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), timeoutMs)
const fetchTimeout = async (url, data) => {
  let response
  try {
    response = await fetch(url, { ...data, signal: controller.signal })
  } catch (err) {
    return Promise.reject(err)
  } finally {
    clearTimeout(timeout)
  }

  return Promise.resolve(response)
}

module.exports = tools => {
  const httpdPort = process.env.HTTPD_PORT
  const nodeHost = process.env.BACKEND_HOST
  const nodePort = process.env.BACKEND_PORT

  global.expect = chai.expect
  global.fetch = fetchTimeout
  global.fetchHttpd = (urlOrData, data) => {
    let parsedUrl = typeof urlOrData === 'string' ? url.parse(urlOrData) : urlOrData
    return fetchTimeout(url.format({ protocol: 'http', ...parsedUrl, port: httpdPort }), data)
  }
  global.isNode = host => host === `${nodeHost}:${nodePort}`

  Object.entries(tools).forEach(([name, lib]) => {
    global[name] = lib
  })
}
