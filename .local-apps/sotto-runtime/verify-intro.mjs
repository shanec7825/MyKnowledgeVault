import assert from 'node:assert/strict';
import { freshIntroProtocol } from '/app/apps/web/src/lib/classes/intro/protocol.ts';
import { readFileSync } from 'node:fs';

for (const immersion of [true, false]) {
  const protocol = freshIntroProtocol(immersion);
  const example = {
    target: "We are going to check the code, aren't we?",
    meaning: 'The speaker asks for confirmation of the plan to check the code.',
    note: 'The tag asks the listener to agree.',
  };
  assert(protocol.exampleSchema.safeParse(example).success);
  assert(!protocol.exampleSchema.safeParse({ target: example.target, note: example.note }).success);
  for (const response of [protocol.generationResponseFormat, protocol.repairResponseFormat]) {
    assert(response.schema.properties.examples.items.required.includes('meaning'));
  }
}
const generator = readFileSync('/app/apps/web/src/lib/classes/class-intro.ts', 'utf8');
assert(!generator.includes('Do not return meaning'));
for (const file of ['generate-class-intro.md', 'repair-class-intro.md']) {
  const prompt = readFileSync(`/app/apps/web/prompts/class/${file}`, 'utf8');
  assert(!prompt.includes('derives immersion meanings'));
  assert(!prompt.includes("derives each new immersion example's meaning"));
}
console.log('PASS: generation, repair and prompts preserve immersion explanations.');
