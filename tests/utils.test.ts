import { normalize } from '../src/utils/utils';

describe('testing normalize functions with strings', () => {
  test('normalize 123456789 with 0 decimals should return 123456789', () => {
    expect(normalize('123456789', 0)).toBe(123456789);
  });

  test('normalize 123456789 with 6 decimals should return 123.456789', () => {
    expect(normalize('123456789', 6)).toBe(123.456789);
  });

  test('normalize 123456789 with 12 decimals should return 0.000123456789', () => {
    expect(normalize('123456789', 12)).toBe(0.000123456789);
  });

  test('normalize very big num with 18 decimals should return valid value', () => {
    expect(normalize('9727362505109649039926646061138553580287964528726457158', 18)).toBe(
      // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
      9727362505109649039926646061138553580.287964528726457158
    );
  });
});

describe('testing normalize functions with BigInt', () => {
  test('normalize 123456789n with 0 decimals should return 123456789', () => {
    expect(normalize(123456789n, 0)).toBe(123456789);
  });

  test('normalize 123456789n with 6 decimals should return 123.456789', () => {
    expect(normalize(123456789n, 6)).toBe(123.456789);
  });

  test('normalize 123456789n with 12 decimals should return 0.000123456789', () => {
    expect(normalize(123456789n, 12)).toBe(0.000123456789);
  });

  test('normalize very big num with 18 decimals should return valid value', () => {
    expect(normalize(9727362505109649039926646061138553580287964528726457158n, 18)).toBe(
      // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
      9727362505109649039926646061138553580.287964528726457158
    );
  });
});
