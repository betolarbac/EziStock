import fastify from "fastify";

const app = fastify();

app.get("/", async (request, reply) => {
  return {status: "Bot is running!"}
})

export function startServer() {
  const port = process.env.PORT || 3000;
  app.listen({port: Number(port), host: '0.0.0.0'}, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Server listening at ${address}`);
  })
}