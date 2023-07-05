import { normalize } from '../src/utils/Utils';

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

  test('normalize 1234567898765432123456789876543212345678987654321 with 30 decimals should return 1234567898765432123.456789876543212345678987654321', () => {
    expect(normalize('1234567898765432123456789876543212345678987654321', 30)).toBe(
      // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
      1234567898765432123.456789876543212345678987654321
    );
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

  test('normalize 1234567898765432123456789876543212345678987654321n with 30 decimals should return 1234567898765432123.456789876543212345678987654321', () => {
    expect(normalize(1234567898765432123456789876543212345678987654321n, 30)).toBe(
      // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
      1234567898765432123.456789876543212345678987654321
    );
  });

  test('normalize very big num with 18 decimals should return valid value', () => {
    expect(normalize(9727362505109649039926646061138553580287964528726457158n, 18)).toBe(
      // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
      9727362505109649039926646061138553580.287964528726457158
    );
  });
});
