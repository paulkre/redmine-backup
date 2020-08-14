import * as functions from "firebase-functions";
import * as timestamp from "time-stamp";
import * as fs from "fs";

import { getSshConfig } from "./config";
import { createSshShell } from "./ssh/shell";
import { createSftpClient } from "./ssh/sftp";

export const backup = functions.https.onRequest(async (_, response) => {
  response.contentType("text/plain");

  try {
    const sshConfig = getSshConfig();
    const shell = await createSshShell(sshConfig);
    const sftp = await createSftpClient(sshConfig);
    console.log("Client connected");

    try {
      await shell.run(
        'echo "[mysqldump]\nuser=root\npassword=$(cat bitnami_application_password)" >> /opt/bitnami/mysql/my.cnf'
      );
      const filename = `backup_${timestamp.utc("YYYYMMDDHHmm")}.sql`;
      await shell.run(`mysqldump bitnami_redmine > ${filename}`);
      await shell.run(
        'echo "$(head -n -3 /opt/bitnami/mysql/my.cnf)" > /opt/bitnami/mysql/my.cnf'
      );
      await shell.run(`zip ${filename}.zip ${filename}`);

      await sftp.get(
        `${filename}.zip`,
        fs.createWriteStream(`${filename}.zip`)
      );

      await shell.run(`rm ${filename} ${filename}.zip`);

      response.send("OK");
    } catch (err) {
      throw err;
    } finally {
      shell.close();
      sftp.end();
    }
  } catch (err) {
    console.error(err);

    response.status(500);
    response.send(err.toString());
  }
});
