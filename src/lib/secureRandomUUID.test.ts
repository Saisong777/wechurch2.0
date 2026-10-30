import { afterEach, expect, it, vi } from 'vitest';
import { secureRandomUUID } from './secureRandomUUID';
const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});
it('prefers the correctly bound native implementation', () => {
    const source = { randomUUID: vi.fn(function (this: unknown) {
            expect(this).toBe(source);
            return '00112233-4455-4677-8899-aabbccddeeff';
        }), getRandomValues: vi.fn() };
    vi.stubGlobal('crypto', source);
    expect(secureRandomUUID()).toMatch(pattern);
    expect(source.randomUUID).toHaveBeenCalledOnce();
    expect(source.getRandomValues).not.toHaveBeenCalled();
});
it('uses all sixteen secure bytes and sets the RFC v4 and variant bits when native UUID is unavailable', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
        throw Error('weak randomness');
    });
    const source = { getRandomValues: vi.fn(function (this: unknown, bytes: Uint8Array) {
            expect(this).toBe(source);
            for (let i = 0; i < bytes.length; i++)
                bytes[i] = i;
            return bytes;
        }) };
    vi.stubGlobal('crypto', source);
    expect(secureRandomUUID()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
    expect(source.getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(random).not.toHaveBeenCalled();
});
it('remains valid and distinct with actual secure getRandomValues alone', () => {
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    vi.stubGlobal('crypto', { getRandomValues });
    const values = Array.from({ length: 100 }, () => secureRandomUUID());
    expect(values.every(value => pattern.test(value))).toBe(true);
    expect(new Set(values).size).toBe(100);
});
it('fails closed when secure entropy is absent or fails', () => {
    vi.stubGlobal('crypto', {});
    expect(() => secureRandomUUID()).toThrow('無法安全建立');
    vi.stubGlobal('crypto', { getRandomValues: () => {
            throw Error('entropy unavailable');
        } });
    expect(() => secureRandomUUID()).toThrow('entropy unavailable');
});
