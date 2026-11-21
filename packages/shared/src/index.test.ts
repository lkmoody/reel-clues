import { describe, expect, expectTypeOf, it } from 'vitest';

import { GAME_NAME } from './index.ts';

describe('GAME_NAME', () => {
  it('is the name of the game', () => {
    expect(GAME_NAME).toBe('Reel Clues');
  });

  it('has a literal type, not just string', () => {
    expectTypeOf<typeof GAME_NAME>().toEqualTypeOf<'Reel Clues'>();
  });
});
