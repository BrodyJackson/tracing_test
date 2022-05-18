import api from '@opentelemetry/api'
const { context, trace } = api
import registerTelemetry from './tracer.js'
const { tracer, startTracing } = registerTelemetry('dummy app', 'koa')

// Adding Koa router (if desired)
import Router from '@koa/router'
const router = new Router()
import Koa from 'koa'

// Setup koa
const app = new Koa()
const PORT = 8081

// route definitions
router.get('/run_test', runTest)

async function setUp() {
  app.use(startTracing(tracer))
  app.use(noOp)
  app.use(router.routes())
}

/**
 *  Router functions: list, add, or show posts
*/
const posts = ['post 0', 'post 1', 'post 2']


function runTest(ctx) {
  console.log('runTest')
    /* const currentSpan = api.trace.getSpan(api.context.active())
  * const { traceId } = currentSpan.spanContext()
  * console.log(`traceid: ${traceId}`)
  * console.log(`Jaeger URL: http://localhost:16686/trace/${traceId}`)
  * console.log(`Zipkin URL: http://localhost:9411/zipkin/traces/${traceId}`)
  * ctx.body = `All posts: ${posts}` */
  console.log(trace.getSpan(context.active()), ' active span')
  console.log(ctx.parentSpan._spanContext.traceId, ' traceId')
}

async function noOp(ctx, next) {
  console.log('Sample basic koa middleware')
  const syntheticDelay = 100
  tracer.startActiveSpan('secondSpan', async (span) => {
    await new Promise((r) => setTimeout(r, syntheticDelay))
    await next()
    span.end()
  })
}

setUp().then(() => {
  app.listen(PORT)
  console.log(`Listening on http://localhost:${PORT}`)
})
