import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import compress from 'koa-compress'
import mount from 'koa-mount'
import ApplicationError from 'rseg-domain/ApplicationError'
import checkJwtMiddleware from './middleware/checkJwtMiddleware'
import createApplicationKernelMiddleware from './middleware/applicationKernelMiddleware'
import setPermissionsMiddleware from './middleware/setPermissionsMiddleware'
import importantCookiesAndHeadersMiddleware from './middleware/importantCookiesAndHeadersMiddleware'
import requestKernelMiddleware from './middleware/requestKernelMiddleware'
import { koaMiddleware } from 'prometheus-api-metrics'
import registerTelemetry from 'rseg-utils/tracer'
import { context } from '@opentelemetry/api'
// can use tracer.setSpan and tracer.getSpan
const loggerMiddleware = require('rseg-domain/middleware/requestLoggerMiddleware')
const { tracer, startTracing } = registerTelemetry('Data Access', 'koa')
const app = new Koa()

export const defaultDependencies = {
  config: require('rseg-config'),
  koaMiddleware,
  checkJwtMiddleware,
  requestKernelMiddleware,
  setPermissionsMiddleware,
  useMockDAS: false
}

export const injectDependencies = (deps) => {
  return {
    config: deps.config || null,
    koaMiddleware: deps.koaMiddleware || null,
    checkJwtMiddleware: deps.checkJwtMiddleware || null,
    requestKernelMiddleware: deps.requestKernelMiddleware || null,
    setPermissionsMiddleware: deps.setPermissionsMiddleware || null,
    useMockDAS: deps.useMockDAS || null
  }
}

export default function main (dependencies = defaultDependencies) {
  const {
    config,
    koaMiddleware,
    checkJwtMiddleware,
    requestKernelMiddleware,
    setPermissionsMiddleware
  } = dependencies

  // Those 2 routes MUST before all others
  app.use(require('./controllers/appHomeFront').routes())
  app.use(require('./controllers/version').routes())
  app.use(koaMiddleware())
  app.use(startTracing(tracer))
  app.use(loggerMiddleware(
    {
      routesToIgnore: [
        { route: '/metrics', method: 'GET' },
        { route: '/readyz', method: 'GET' },
        { route: '/version', method: 'GET' }
      ]
    }
  ))

  app.use(createApplicationKernelMiddleware(config))
  app.use(require('./controllers/readyz').routes())

  app.use(mount('/boom', ctx => {
    throw new ApplicationError('Boom!', { someDetails: 'some error details' })
  }))

  app.use(bodyParser({
    jsonLimit: config.dataAccess?.requestBodyLimit
  }))

  app.use(checkJwtMiddleware)
  app.use(setPermissionsMiddleware)
  app.use(importantCookiesAndHeadersMiddleware)
  app.use(requestKernelMiddleware)

  // Enable gzip compression for responses over 1k. Filters by response
  // Content-Type in compressible library (https://github.com/jshttp/compressible);
  // this can be overridden using ctx.compress = true|false
  // Compression is requested using Accept-Encoding header.
  app.use(compress({
    threshold: 1024
  }))

  // This will only be true for a test in _e2e_tests_/data-source-hydration.spec.ts
  if (dependencies.useMockDAS) {
    app.use(require('./mocks/mockDataAccessService').routes())
  }

  app.use(require('./controllers').routes())

  return app
}
