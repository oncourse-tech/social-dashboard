import { Client } from "ssh2";
import { readFileSync } from "fs";

function getPrivateKey(): Buffer | string {
  // In production (Vercel): use base64-encoded env var
  // Locally: read from SSH_KEY_PATH or default ~/.ssh/id_ed25519
  if (process.env.OPENCLAW_SSH_KEY_PATH) {
    return readFileSync(process.env.OPENCLAW_SSH_KEY_PATH);
  }
  if (process.env.OPENCLAW_SSH_PRIVATE_KEY) {
    return Buffer.from(process.env.OPENCLAW_SSH_PRIVATE_KEY, "base64");
  }
  // Fallback: local dev default
  return readFileSync(`${process.env.HOME}/.ssh/id_ed25519`);
}

const SSH_CONFIG = {
  host: process.env.OPENCLAW_SSH_HOST!,
  username: process.env.OPENCLAW_SSH_USER!,
  privateKey: getPrivateKey(),
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
