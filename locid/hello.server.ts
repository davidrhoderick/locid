export default async function helloServer(args: { name: string }) {
  return {
    message: `Hello from Locid, ${args.name}!`,
    timestamp: new Date().toISOString(),
  }
}
