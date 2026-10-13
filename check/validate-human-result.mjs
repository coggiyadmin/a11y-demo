import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const input = process.argv[2];

if (!input || process.argv.length !== 3) {
  console.error('usage: node check/validate-human-result.mjs path/to/result.json');
  process.exit(2);
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

try {
  const schema = readJson(path.join(ROOT, 'protocols/result.schema.json'));
  const result = readJson(path.resolve(input));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addFormat('date-time', (value) => Number.isFinite(Date.parse(value)));
  const validate = ajv.compile(schema);

  if (!validate(result)) {
    console.error(`invalid human evaluation result: ${input}`);
    for (const error of validate.errors ?? []) {
      console.error(`- ${error.instancePath || '/'} ${error.message}`);
    }
    process.exit(1);
  }

  console.log(`valid human evaluation result: ${input}`);
} catch (error) {
  console.error(`could not validate ${input}: ${error.message}`);
  process.exit(2);
}
