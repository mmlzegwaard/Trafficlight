import { spawn } from 'node:child_process';

function sanitizeHeaderValue(value) {
  return String(value).replace(/[\r\n]+/g, ' ').trim();
}

function runSendmail(message) {
  return new Promise((resolve) => {
    const child = spawn('sendmail', ['-t']);
    let stderr = '';

    child.on('error', (error) => {
      resolve({ sent: false, reason: `sendmail_unavailable:${error.code ?? 'unknown'}` });
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ sent: true, reason: 'sent' });
        return;
      }

      resolve({
        sent: false,
        reason: stderr.trim() || `sendmail_exit_${code ?? 'unknown'}`,
      });
    });

    child.stdin.end(message);
  });
}

export async function sendMovementAlert({ to, subject, body }) {
  if (!to) {
    return { sent: false, reason: 'email_not_configured' };
  }

  const safeTo = sanitizeHeaderValue(to);
  const safeSubject = sanitizeHeaderValue(subject);
  const message = `To: ${safeTo}\nSubject: ${safeSubject}\nContent-Type: text/plain; charset=utf-8\n\n${body}`;
  return runSendmail(message);
}
