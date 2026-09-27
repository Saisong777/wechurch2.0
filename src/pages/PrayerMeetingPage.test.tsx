// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import PrayerMeetingPage from './PrayerMeetingPage';

afterEach(cleanup);
function Destination() { const location = useLocation(); return <p>{location.pathname}{location.search}</p>; }
it('retires the legacy UI without forwarding meeting codes', async () => {
  render(<MemoryRouter initialEntries={['/prayer-meeting?code=TEST']}><Routes>
    <Route path="/prayer-meeting" element={<PrayerMeetingPage />} />
    <Route path="/prayer-wall" element={<Destination />} />
  </Routes></MemoryRouter>);
  expect(await screen.findByText('/prayer-wall')).toBeInTheDocument();
  expect(screen.queryByText(/code=/)).toBeNull();
});
