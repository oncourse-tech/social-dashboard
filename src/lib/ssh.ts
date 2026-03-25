import { Client } from "ssh2";

const SSH_CONFIG = {
  host: process.env.OPENCLAW_SSH_HOST!,
  username: process.env.OPENCLAW_SSH_USER!,
  privateKey: Buffer.from(process.env.OPENCLAW_SSH_PRIVATE_KEY!, "base64"),
};

export async function sshExec(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => {
        conn.exec(command, (err, stream) => {
          if (err) { conn.end(); return reject(err); }
          let stdout = "";
          let stderr = "";
          stream.on("data", (data: Buffer) => { stdout += data.toString(); });
          stream.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });
          stream.on("close", () => {
            conn.end();
            if (stderr && !stdout) reject(new Error(stderr));
            else resolve(stdout);
          });
        });
      })
      .on("error", reject)
      .connect(SSH_CONFIG);
  });
}

export async function sshReadFile(remotePath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => {
        conn.sftp((err, sftp) => {
          if (err) { conn.end(); return reject(err); }
          sftp.readFile(remotePath, (err, buf) => {
            conn.end();
            if (err) reject(err);
            else resolve(buf);
          });
        });
      })
      .on("error", reject)
      .connect(SSH_CONFIG);
  });
}

export async function sshFileExists(remotePath: string): Promise<boolean> {
  try {
    await sshExec(`test -f ${remotePath} && echo exists`);
    return true;
  } catch {
    return false;
  }
}
