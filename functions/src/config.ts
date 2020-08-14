import * as functions from "firebase-functions";

export type SshConfig = {
  key: string;
  host: string;
  user: string;
};

type FirebaseConfig = {
  ssh?: Partial<SshConfig>;
};

export function getSshConfig(): SshConfig {
  const { ssh }: FirebaseConfig = functions.config();

  if (!ssh) throw Error('"ssh" config object missing');

  const { key, host, user } = ssh;

  if (!key || !host || !user)
    throw Error('"ssh" config object has missing attributes');

  return { key, host, user };
}
