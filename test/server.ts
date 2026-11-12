Bun.serve({
  port: Number(Bun.argv[2]),
  async fetch(req) {
    const file = Bun.file(`.${new URL(req.url).pathname}`);
    return (await file.exists()) ? new Response(file) : new Response(null, { status: 404 });
  },
});
