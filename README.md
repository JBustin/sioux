# Sioux

Sioux is used to test apache rewrite rules with chaijs.

## Getting Started

### Prerequisites

You need docker, an access to your apache configuration, and some javascript knowledges.

### Installing

Sioux uses 4 resources :

- vhosts: a directory with vhost files (can contain some subdirectories)
- tests: spec.js files to test vhost files
- formatters: some js files to format vhost files before mounting in apache
- .env: need to pass some constants

### Tests organization

Two modes: SPEC or DIR.

In SPEC mode, test files should be in the same directory as the vhost file, with the same name.

Tree example:

```
root
  |- .env
  |- vhosts
     |- foo.vhost.conf
     |- foo.vhost.js
     |- foo.vhost.spec.js
     |- bar.vhost.conf
     |- bar.vhost.js
     |- bar.vhost.spec.js
```

In DIR mode, test files should be in a dedicated directory.

Tree example:

```
root
  |- .env
  |- tests
     |- foo.vhost.js
     |- foo.vhost.spec.js
     |- bar.vhost.js
     |- bar.vhost.spec.js
  |- vhosts
     |- foo.vhost.conf
     |- bar.vhost.conf
```

When all resources are ready, just do :

```
cp .env.template .env
docker run --rm \
-v ${PWD}/vhosts:/usr/app/vhosts \
-v ${PWD}/.env:/usr/app/.env \
jbustin1/sioux
```

## Tests

This project has its own test runner. Expectations come from chaijs.
Instructions:

- suite: display a name for your suite
- context: display a context for a suite of tests
- test: create a test
- fetch: node-fetch (with a timeout)
- httpBackend: inspect your backend incoming. Methods: unqueue (pop), flush (automatic sent before each test), count (count incoming stacked), noExpectations (true if incomings are stacked), calls (return a list of stacked backend incomings).

```js
suite(__filename)

context('200')

test('My route should respond by 200 status code', async () => {
  const { status } = await fetch(`http://www.mydomain.com/foo`)
  const { headers: { host } = {}, url } = httpBackend.unqueue()

  expect(status).to.equal(200)
  expect(host).to.contains('new.backend.com')
  expect(url).to.equal('foo')
  expect(httpBackend.noExpectations()).to.be.true
})
```

## Formatters (optional)

A formatter is used to extract the part of the apache vhost you want (or you can) test. It's a js function that takes environment variables and a vhost content.

Example:

```js
module.exports = ({ env, content }) => {
  const httpdPort = env.HTTPD_PORT || '80'
  const backendHost = env.BACKEND_HOST || 'new.backend.com'
  const backendPort = env.BACKEND_PORT || '3011'
  const legacyHost = env.BACKEND_LEGACY_HOST || 'old.backend.com'

  const serverConfLines = content.match(/^(.*)Server([^\n]*)/gm).join('\n  ')
  const rewriteConfLines = content
    .match(/^(.*)Rewrite([^\n]*)/gm)
    .filter(line => !line.includes('maps-seo'))
    .join('\n  ')

  return `<VirtualHost *:${httpdPort}>
  ${serverConfLines}
    ProxyPass         / http://${legacyHost}:${backendPort}/
    ProxyPassReverse  / http://${legacyHost}:${backendPort}/
    ProxyRequests On
    <Proxy "balancer://nodejscluster">
      BalancerMember "http://${backendHost}:${backendPort}"
    </Proxy>
  ${rewriteConfLines}
</VirtualHost>`
}
```

If you use the same formatter for each vhost, you can create a default formatter at the root of the vhosts directory (or tests directory in MODE=DIR) with the name _default-formatter.js_ like this :

```
root
  |- .env
  |- vhosts
     |- default-formatter.js
     |- foo.vhost.conf
     |- foo.vhost.conf.js
     |- foo.vhost.conf.spec.js
     |- bar.vhost.conf
     |- bar.vhost.conf.js
     |- bar.vhost.conf.spec.js
```

## Built With

- [chaijs](https://www.chaijs.com/) - Chai is a BDD / TDD assertion library for node and the browser that can be delightfully paired with any javascript testing framework.

## Contributing

_Incoming_

## Versioning

_Incoming_

## Authors

_Incoming_

## Todo

- json mode: launch only one test

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
