// Loopback only, and only the folders tests load from: the rest of the checkout stays private.
const served = ["/dist/", "/test/assets/"];

Bun.serve({
  hostname: "127.0.0.1",
  port: Number(Bun.argv[2]),
  async fetch(req) {
    const { pathname } = new URL(req.url);
    const file = Bun.file(`.${pathname}`);
    const found = served.some((folder) => pathname.startsWith(folder)) && (await file.exists());
    return found ? new Response(file) : new Response(null, { status: 404 });
  },
});
