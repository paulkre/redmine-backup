import * as Client from "ssh2-sftp-client";
import { SshConfig } from "../config";

export async function createSftpClient({
  key,
  host,
  user,
}: SshConfig): Promise<Client> {
  const client = new Client();
  await client.connect({
    host,
    username: user,
    privateKey: key,
  });
  return client;
}
