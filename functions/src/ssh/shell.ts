import { Client } from "ssh2";
import { SshConfig } from "../config";

function createSshClient({ key, host, user }: SshConfig): Promise<Client> {
  const client = new Client();
  return new Promise((resolve, reject) => {
    client
      .on("ready", () => {
        resolve(client);
      })
      .on("error", (err) => {
        reject(err);
      })
      .connect({
        host,
        username: user,
        privateKey: key,
      });
  });
}

type SshCommandLine = {
  run(command: string, force?: boolean): Promise<Buffer | null>;
  close(): void;
};

export async function createSshShell(
  config: SshConfig
): Promise<SshCommandLine> {
  const client = await createSshClient(config);
  return {
    close: () => client.end(),
    run: (command, force): Promise<Buffer | null> =>
      new Promise((resolve, reject) => {
        client.exec(command, (err, stream) => {
          if (err) {
            reject(err);
            return;
          }

          let hasResolvedOrRejected = false;

          stream
            .on("data", (data: Buffer) => {
              resolve(data);
              hasResolvedOrRejected = true;
            })
            .stderr.on("data", (data: Buffer) => {
              if (!force) reject(`SERVER ERROR: ${data.toString()}`);
              else resolve(null);
              hasResolvedOrRejected = true;
            })
            .on("close", (code: number) => {
              if (hasResolvedOrRejected) return;
              if (code) reject(`SERVER ERROR ("${command}"): ${code}`);
              else resolve(null);
            });
        });
      }),
  };
}
