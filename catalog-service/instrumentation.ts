// Uncomment this file to enable instrumentation and observability using OpenTelemetry
// Refer to the docs for installation instructions: https://docs.medusajs.com/learn/debugging-and-testing/instrumentation

// import { registerOtel } from "@medusajs/medusa"
// // If using an exporter other than Zipkin, require it here.
// import { ZipkinExporter } from "@opentelemetry/exporter-zipkin"

// // If using an exporter other than Zipkin, initialize it here.
// const exporter = new ZipkinExporter({
//   serviceName: 'my-medusa-project',
// })

// export function register() {
//   registerOtel({
//     serviceName: 'medusajs',
//     // pass exporter
//     exporter,
//     instrument: {
//       http: true,
//       workflows: true,
//       query: true
//     },
//   })
// }

/**
 * Increase body parser limit for media uploads
 * This allows larger base64 encoded images to be uploaded
 */
export function register() {
  // This function is called by Medusa to register custom instrumentation
  // We can use it to modify Express app configuration
  // Note: This is a workaround - Medusa doesn't expose body parser config directly
}

// Express app'e erişip body parser limit'ini artırmak için
// Medusa.js'in body parser middleware'ini override etmek gerekiyor
// Ancak bu doğrudan mümkün olmayabilir, bu yüzden medusa-config.ts'de
// bodyParser konfigürasyonunu kullanıyoruz