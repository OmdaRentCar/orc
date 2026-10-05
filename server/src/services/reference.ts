import { randomInt } from 'crypto';

// No 0/O or 1/I, so customers can read the code back over the phone without mistakes
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReference(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return `RC-${code}`;
}
