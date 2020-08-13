import * as functions from "firebase-functions";
import { Client } from "ssh2";

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

type SshConfig = {
  key: string;
  host: string;
  user: string;
};

type FirebaseConfig = {
  ssh?: Partial<SshConfig>;
};

function getSshConfig(): SshConfig {
  const { ssh }: FirebaseConfig = functions.config();

  if (!ssh) throw Error('"ssh" config object missing');

  const { key, host, user } = ssh;

  if (!key || !host || !user)
    throw Error('"ssh" config object has missing attributes');

  return { key, host, user };
}

function runSshCommand(client: Client, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      let hasResolvedOrRejected = false;

      stream
        .on("data", (data: Buffer) => {
          resolve(data.toString());
          hasResolvedOrRejected = true;
        })
        .stderr.on("data", (data: Buffer) => {
          reject(`SERVER ERROR: ${data.toString()}`);
          hasResolvedOrRejected = true;
        })
        .on("close", (code: number) => {
          if (hasResolvedOrRejected) return;
          if (code)
            reject(
              `Command "${command}" received error code ${code} from server`
            );
          else resolve(`Command "${command}" was successful`);
        });
    });
  });
}

type Terminal = {
  run(command: string): Promise<string>;
  exit(): void;
};

function createSshConsole({ key, host, user }: SshConfig): Promise<Terminal> {
  const client = new Client();
  return new Promise((resolve, reject) => {
    client
      .on("ready", () => {
        resolve({
          run: (command) => runSshCommand(client, command),
          exit: () => client.end(),
        });
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

export const helloWorld = functions.https.onRequest(async (_, response) => {
  response.contentType("text/plain");

  try {
    const { run, exit } = await createSshConsole(getSshConfig());

    console.log("Client connected");

    try {
      const data = await run("ls -alh");

      response.send(data);
    } catch (err) {
      throw err;
    } finally {
      exit();
    }
  } catch (err) {
    console.error(err);

    response.status(500);
    response.send(err.toString());
  }
});
