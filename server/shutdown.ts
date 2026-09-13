interface ClosableServer { close(callback: (error?: Error) => void): unknown }
interface ClosablePool { end(): Promise<void> }

// Drain requests before releasing the database they may still be using.
export async function drainServer(server: ClosableServer, pool: ClosablePool): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
  await pool.end();
}
