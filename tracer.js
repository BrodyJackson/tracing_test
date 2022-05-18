import telemetry from '@opentelemetry/api'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { JaegerExporter } from '@opentelemetry/exporter-jaeger'
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express'
import { KoaInstrumentation } from '@opentelemetry/instrumentation-koa'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'

const createTracer = (serviceName) => {
  // Enable OpenTelemetry exporters to export traces to Grafan Tempo.
  const tracerProvider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName
    })
  })

  // Initialize the exporter.
  // TODO: paramaterize the endpoint
  const options = {
    serviceName: serviceName,
    tags: [],
      /* endpoint: 'foo-grafana-agent:14268/api/traces' */
    // forward this 12345 into 14268 on the cluster service to send requests into cluster agent 
    endpoint: 'http://0.0.0.0:12345/api/traces'
  }
  /**
  *
  * Configure the span processor to send spans to the exporter
  */
  tracerProvider.addSpanProcessor(new BatchSpanProcessor(new JaegerExporter(options)))

  registerInstrumentations({
    instrumentations: [
      new ExpressInstrumentation(),
      new KoaInstrumentation(),
      new HttpInstrumentation()
    ],
    tracerProvider: tracerProvider
  })

  // Initialize the OpenTelemetry APIs to use the NodeTracerProvider bindings
  // allows the provider to be discovered by instrumentations
  tracerProvider.register()

  const tracer = telemetry.trace.getTracer(serviceName)

  return tracer
}

const registerTelemetry = (serviceName, serverType) => {
  const tracer = createTracer(serviceName)
  const startTracing = serverType === 'koa' ? startTracingKoa : addTraceIdExpress
  return {
    tracer,
    startTracing
  }
}

const addTraceIdExpress = (req, res, next) => {
  const activeSpan = telemetry.context.active()
  const spanContext = telemetry.trace.getSpanContext(activeSpan)
  req.traceId = spanContext && spanContext.traceId
  next()
}

const startTracingKoa = (tracer) => {
  return async function tracingMiddleware (ctx, next) {
    // Grab the telemetry trace Id and place into ctx
    const activeSpan = telemetry.context.active()
    const spanContext = telemetry.trace.getSpanContext(activeSpan)
    ctx.traceId = spanContext && spanContext.traceId
    // Start a parent span for the service
      /* const mainSpan = tracer.startSpan('main') */
    const spantest = tracer.startActiveSpan('mainSpan', async (span) => {
      ctx.parentSpan = span
      await next()
      span.end()
    })
    console.log('span test ', spantest)
  }
}

export default registerTelemetry
