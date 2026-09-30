// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './select';

afterEach(cleanup);
it('bounds the dropdown to available space and retains readable option labels', () => {
  render(<Select open value="overview"><SelectTrigger aria-label="管理項目"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="members">會員名單</SelectItem><SelectItem value="overview">牧養總覽</SelectItem></SelectContent></Select>);
  expect(screen.getByRole('listbox')).toHaveClass('max-h-[min(24rem,var(--radix-select-content-available-height,80vh))]', 'max-w-[calc(100vw-16px)]');
  expect(screen.getByRole('option', { name: '會員名單' })).toHaveClass('min-h-11');
});
